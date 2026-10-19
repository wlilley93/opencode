import { expect, test, type Page } from "@playwright/test"
import type { SessionMessageInfo } from "@opencode/client/promise"
import { holdRoute, pageMessagesFrom, project, seed, session, sessionHref, SERVER } from "../utils/app"
import { mockOpenCodeServer } from "../utils/mock-server"

const record = process.env.SESSION_WARM_OPEN_RECORD

test.use({
  viewport: { width: 1280, height: 800 },
  serviceWorkers: "block",
  video: record ? { mode: "on", size: { width: 1280, height: 800 } } : "off",
})

const sessions = [
  { id: "ses_warm_atlas", directory: "/work/atlas", title: "Atlas renderer", model: "alpha" },
  { id: "ses_warm_borealis", directory: "/work/borealis", title: "Borealis sync", model: "beta" },
  { id: "ses_warm_cinder", directory: "/work/cinder", title: "Cinder release", model: "alpha" },
] as const

const provider = {
  all: [
    {
      id: "acme",
      name: "Acme",
      models: {
        alpha: { id: "alpha", name: "Alpha", limit: { context: 200_000 }, variants: { high: {}, low: {} } },
        beta: { id: "beta", name: "Beta", limit: { context: 200_000 }, variants: { high: {}, low: {} } },
      },
    },
  ],
  connected: ["acme"],
  default: { providerID: "acme", modelID: "alpha" },
}

const messages = Object.fromEntries(
  sessions.map((item) => [
    item.id,
    Array.from({ length: 6 }, (_, turn): SessionMessageInfo[] => [
      {
        id: `msg_${item.id}_${turn}_u`,
        type: "user",
        time: { created: 1700000000000 + turn * 10_000 },
        text: `${item.title}: question ${turn + 1}`,
        metadata: { agent: "build", model: { providerID: "acme", modelID: item.model, variant: "high" } },
      },
      {
        id: `msg_${item.id}_${turn}_a`,
        type: "assistant",
        time: { created: 1700000001000 + turn * 10_000, completed: 1700000005000 + turn * 10_000 },
        model: { id: item.model, providerID: "acme", variant: "high" },
        agent: "build",
        cost: 0,
        tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
        finish: "stop",
        content: [
          {
            type: "text",
            text: `**${item.title}, answer ${turn + 1}.**\n\n${"The renderer keeps its frame budget while the sync settles. ".repeat(6)}\n\n- one\n- two\n- three`,
          },
        ],
      },
    ]).flat(),
  ]),
)

async function open(page: Page, latency: { messages?: number; location?: number } = {}) {
  await mockOpenCodeServer(page, {
    directory: sessions[0].directory,
    project: project({ id: "proj_atlas", directory: sessions[0].directory }),
    projects: sessions.map((item) => project({ id: `proj_${item.id}`, directory: item.directory })),
    sessions: sessions.map((item) =>
      session({
        id: item.id,
        title: item.title,
        directory: item.directory,
        location: { directory: item.directory },
        projectID: `proj_${item.id}`,
        agent: "build",
        model: { id: item.model, providerID: "acme", variant: "high" },
      }),
    ),
    provider,
    pageMessages: pageMessagesFrom(messages),
    messageDelay: latency.messages,
  })

  if (latency.location) {
    // A Location the server has not served yet answers its catalogs after it loads.
    await page.route(
      (url) => url.pathname.startsWith("/api/") && !!url.searchParams.get("location[directory]"),
      async (route) => {
        if (route.request().method() !== "OPTIONS")
          await new Promise((resolve) => setTimeout(resolve, latency.location))
        await route.fallback()
      },
    )
  }

  await seed(page, {
    tabs: sessions.map((item) => item.id),
    settings: { appearance: { tabLayout: "vertical" } },
    theme: { id: "oc-2", scheme: "dark" },
    // Names this device's chips showed before, as after any earlier use of these models.
    storage: {
      "opencode.global.dat:model": {
        label: {
          "acme/alpha": { provider: "Acme", model: "Alpha", variants: ["high", "low"] },
          "acme/beta": { provider: "Acme", model: "Beta", variants: ["high", "low"] },
        },
      },
    },
  })
}

const tab = (page: Page, id: string) => page.locator(`[data-slot="vertical-tabs"] a[href="${sessionHref(id, SERVER)}"]`)

const chip = (page: Page) => page.locator('[data-action="composer-model"]')

const placeholder = (page: Page) => page.locator('[data-component="session-timeline-placeholder"]')

const message = (page: Page, id: string) =>
  page.locator(`[data-timeline-virtual-content] [data-message-id^="msg_${id}_"]`)

async function openAtlas(page: Page) {
  await page.goto(sessionHref(sessions[0].id))
  await expect(chip(page)).toHaveText("Acme / Alpha")
  await expect(message(page, sessions[0].id).first()).toBeVisible()
}

test("paints a session's remembered model before its Location's agents and config load", async ({ page }) => {
  await open(page)
  await openAtlas(page)
  const location = sessions[1].directory

  const held = await holdRoute(
    page,
    (url) =>
      ["/api/agent", "/api/config"].includes(url.pathname) && url.searchParams.get("location[directory]") === location,
  )

  try {
    await tab(page, sessions[1].id).click()

    await held.arrived
    await expect(chip(page)).toHaveText("Acme / Beta")
    await expect(page.getByRole("button", { name: "Choose model variant" })).toHaveText("high")
    const painted = await chip(page).elementHandle()
    held.release()
    await page.waitForResponse((response) => new URL(response.url()).pathname === "/api/agent")
    await page.waitForTimeout(300)
    // The loaded selection keeps the same chip instead of replacing it.
    expect(await painted?.evaluate((element) => element.isConnected)).toBe(true)
    await expect(chip(page)).toHaveText("Acme / Beta")
  } finally {
    held.release()
  }
})

test("shows a placeholder while a cold transcript loads, then its newest turns", async ({ page }) => {
  await open(page)
  await openAtlas(page)
  const held = await holdRoute(page, `**/api/session/${sessions[1].id}/message**`, { method: "GET" })

  try {
    await tab(page, sessions[1].id).click()
    await held.arrived
    await expect(placeholder(page)).toHaveAttribute("data-state", "open")
    await expect.poll(() => placeholder(page).evaluate((element) => getComputedStyle(element).opacity)).toBe("0.7")
    held.release()
    await expect(message(page, sessions[1].id).last()).toBeVisible()
    await expect(placeholder(page)).toHaveCount(0)
  } finally {
    held.release()
  }
})

test("loads a hovered tab's transcript before it is clicked and opens it warm", async ({ page }) => {
  const requested: string[] = []
  page.on("request", (request) => {
    const match = new URL(request.url()).pathname.match(/^\/api\/session\/([^/]+)\/message$/)

    if (match && request.method() === "GET") requested.push(match[1]!)
  })
  await open(page)
  await openAtlas(page)

  // Passing over a tab loads nothing.
  await tab(page, sessions[2].id).hover()
  await tab(page, sessions[0].id).hover()
  await page.waitForTimeout(300)
  expect(requested).not.toContain(sessions[2].id)

  await tab(page, sessions[1].id).hover()
  await expect.poll(() => requested.includes(sessions[1].id)).toBe(true)
  await page.waitForTimeout(200)
  await tab(page, sessions[1].id).click()
  await expect(message(page, sessions[1].id).last()).toBeVisible()
  await expect(placeholder(page)).toHaveCount(0)
  expect(requested.filter((id) => id === sessions[1].id)).toHaveLength(1)
})

test("reopens a session from another Location without a placeholder frame", async ({ page }) => {
  await open(page)
  await openAtlas(page)
  await tab(page, sessions[1].id).click()
  await expect(message(page, sessions[1].id).last()).toBeVisible()
  await expect(placeholder(page)).toHaveCount(0)

  await startSampling(page, sessions[0].id)
  await tab(page, sessions[0].id).click()
  await expect(message(page, sessions[0].id).last()).toBeVisible()
  await page.waitForTimeout(200)
  const samples = await stopSampling(page)

  expect(samples.length).toBeGreaterThan(0)
  // Every frame shows one session's rows: the previous one's until the reopened one's paint in its place.
  expect(samples.filter((sample) => sample.placeholder > 0 || !sample.visible || !sample.any)).toEqual([])
})

type Sample = { t: number; rows: number; any: boolean; visible: boolean; placeholder: number; chip: string | null }

declare global {
  interface Window {
    __warmOpen?: { start: number; samples: Sample[]; stop: boolean }
  }
}

// Samples every frame after the next pointerdown: the opened session's rows, any rows, and the placeholder and chip.
async function startSampling(page: Page, sessionID: string) {
  await page.evaluate((sessionID) => {
    const samples: Sample[] = []
    const state = { start: 0, samples, stop: false }
    window.__warmOpen = state
    document
      .querySelectorAll('[data-action="composer-model"]')
      .forEach((element) => element.setAttribute("data-stale", ""))
    document.addEventListener("pointerdown", () => (state.start = performance.now()), { capture: true, once: true })

    const tick = () => {
      if (state.stop) return

      if (state.start) {
        const content = document.querySelector<HTMLElement>("[data-timeline-virtual-content]")
        const chip = document.querySelector<HTMLElement>('[data-action="composer-model"]:not([data-stale])')
        const placeholder = document.querySelector<HTMLElement>('[data-component="session-timeline-placeholder"]')

        state.samples.push({
          t: Math.round(performance.now() - state.start),
          rows: content?.querySelectorAll(`[data-message-id^="msg_${sessionID}_"]`).length ?? 0,
          any: !!content?.querySelector("[data-message-id]"),
          visible: !!content && content.checkVisibility({ checkVisibilityCSS: true }),
          placeholder: placeholder ? Number(getComputedStyle(placeholder).opacity) : 0,
          chip: chip?.checkVisibility({ opacityProperty: true }) ? chip.textContent : null,
        })
      }

      requestAnimationFrame(tick)
    }

    tick()
  }, sessionID)
}

async function stopSampling(page: Page) {
  return page.evaluate(() => {
    const state = window.__warmOpen

    if (!state) return []
    state.stop = true

    return state.samples
  })
}

async function switchTo(page: Page, id: string, label: string, dwell: number) {
  await startSampling(page, id)
  // A person rests the pointer on a tab before pressing it.
  await tab(page, id).hover()
  await page.waitForTimeout(dwell)
  await tab(page, id).click()

  console.log(`click ${label} at ${Date.now() - recordStart}ms`)
  await page.screenshot({ path: `${record}/${label}-after-click.png` })
  await page.waitForTimeout(1200)
  const samples = await stopSampling(page)
  const first = (test: (sample: Sample) => boolean) => samples.find(test)?.t
  const shown = (sample: Sample) => sample.visible && sample.rows > 0

  const summary = {
    label,
    timeline: first(shown),
    chip: first((sample) => !!sample.chip),
    emptyFrames: samples.filter((sample) => !shown(sample) && sample.placeholder < 0.05).length,
    placeholderFrames: samples.filter((sample) => !shown(sample) && sample.placeholder >= 0.05).length,
  }

  console.log(JSON.stringify(summary))

  return summary
}

let recordStart = 0

// Evidence only: SESSION_WARM_OPEN_RECORD=<dir> records switching between three sessions with realistic latency.
test("records switching between sessions with history", async ({ page }) => {
  test.skip(!record, "set SESSION_WARM_OPEN_RECORD to record")
  test.setTimeout(60_000)
  recordStart = Date.now()
  await open(page, { messages: 250, location: 200 })
  await openAtlas(page)
  await page.waitForTimeout(800)
  const dwell = Number(process.env.SESSION_WARM_OPEN_DWELL ?? 150)

  await switchTo(page, sessions[1].id, "1-borealis-cold", dwell)
  await switchTo(page, sessions[2].id, "2-cinder-cold", dwell)
  await switchTo(page, sessions[0].id, "3-atlas-warm", dwell)
  await switchTo(page, sessions[1].id, "4-borealis-warm", dwell)
})
