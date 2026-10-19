import { readdir } from "node:fs/promises"
import { join } from "node:path"
import type { Browser, Page } from "@playwright/test"

export type Desktop = {
  browser: Browser
  page: Page
  process: Bun.Subprocess
}

export async function launchDesktop(
  artifacts: string,
  options: { port?: number; env?: Record<string, string>; serviceFile?: string | false } = {},
): Promise<Desktop> {
  const root = process.env.OPENCODE_DEV ?? process.cwd()
  const port = options.port ?? 9333
  const serviceFile =
    options.serviceFile === false ? false : (options.serviceFile ?? (await findServiceFile(artifacts)))
  const child = Bun.spawn(
    ["bun", "run", "dev:desktop", ...(serviceFile ? ["--", "--service-file", serviceFile] : [])],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENCODE_DESKTOP_TEST_ROOT: join(artifacts, "desktop-profile"),
        OPENCODE_DESKTOP_REMOTE_DEBUGGING_PORT: String(port),
        ...options.env,
      },
      stdout: "pipe",
      stderr: "pipe",
      detached: true,
    },
  )
  const output = Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()])

  try {
    await waitForCdp(port, child)
    const { chromium } = await import(join(root, "node_modules", "@playwright", "test", "index.mjs"))
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    return { browser, page: await waitForPage(browser, child), process: child }
  } catch (error) {
    stopProcess(child)
    const [stdout, stderr] = await output
    throw new Error(`Desktop failed to start\n\n${stdout}\n${stderr}`, { cause: error })
  }
}

export async function closeDesktop(desktop: Desktop) {
  await desktop.browser.close().catch(() => undefined)
  stopProcess(desktop.process)
  await Promise.race([desktop.process.exited, Bun.sleep(5_000)])
  if (!(await exited(desktop.process))) process.kill(-desktop.process.pid, "SIGKILL")
}

async function findServiceFile(artifacts: string) {
  const directory = join(artifacts, "home", ".local", "state", "opencode")
  const names = (await readdir(directory)).filter((name) => /^service(?:-[^.]+)?\.json$/.test(name)).sort()
  const name = ["service-local.json", "service.json", ...names].find((candidate) => names.includes(candidate))
  if (!name) throw new Error(`OpenCode Drive service registration not found in ${directory}`)
  return join(directory, name)
}

async function waitForCdp(port: number, child: Bun.Subprocess) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (await exited(child)) throw new Error(`Desktop exited with status ${await child.exited}`)
    const ready = await fetch(`http://127.0.0.1:${port}/json/version`).then(
      (response) => response.ok,
      () => false,
    )
    if (ready) return
    await Bun.sleep(50)
  }
  throw new Error("Timed out waiting for the Desktop CDP endpoint")
}

async function waitForPage(browser: Browser, child: Bun.Subprocess) {
  const context = browser.contexts()[0]
  if (!context) throw new Error("Desktop did not expose a browser context")
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (await exited(child)) throw new Error(`Desktop exited with status ${await child.exited}`)
    const page = context.pages().find((candidate) => candidate.url().startsWith("http://localhost:"))
    if (page) {
      await page.locator("body").waitFor()
      return page
    }
    await Bun.sleep(50)
  }
  throw new Error("Timed out waiting for the Desktop renderer")
}

function stopProcess(child: Bun.Subprocess) {
  try {
    process.kill(-child.pid, "SIGTERM")
  } catch {
    child.kill()
  }
}

async function exited(child: Bun.Subprocess) {
  try {
    process.kill(child.pid, 0)
    return false
  } catch {
    return true
  }
}
