import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { mkdir } from "node:fs/promises"
import { defineScript, Effect, Llm } from "opencode-drive"
import { closeDesktop, launchDesktop } from "./desktop-harness"

export default defineScript({
  launch: "manual",
  project: {
    git: true,
    files: { "README.md": "# Desktop Drive prototype\n\nThis project is controlled by OpenCode Drive.\n" },
  },
  config: { autoupdate: false, username: "Desktop Drive" },
  run: ({ server, llm, artifacts }) =>
    Effect.gen(function* () {
      yield* server.launch()
      yield* llm.queue(Llm.text("Hello from the simulated OpenCode Drive model."))
      const screenshot =
        process.env.OPENCODE_DESKTOP_DRIVE_SCREENSHOT ?? join(tmpdir(), "opencode-drive-desktop-prototype.png")
      yield* Effect.promise(() => mkdir(dirname(screenshot), { recursive: true }))

      yield* Effect.acquireUseRelease(
        Effect.promise(() => launchDesktop(artifacts)),
        ({ page }) =>
          Effect.promise(async () => {
            const overlay = page.locator('[data-component="startup-overlay"]')
            await overlay.waitFor({ state: "attached" })
            await overlay.waitFor({ state: "hidden" })
            await page.screenshot({ path: screenshot.replace(/\.png$/, "-startup.png") })
            const editor = page.locator('[data-component="composer-editor"]')
            await editor.waitFor()
            await editor.fill("Say hello from the Desktop prototype.")
            await editor.press("Enter")
            await page.getByText("Hello from the simulated OpenCode Drive model.", { exact: true }).waitFor()
            await page.screenshot({ path: screenshot })
            console.log(`desktop screenshot: ${screenshot}`)
          }),
        (desktop) => Effect.promise(() => closeDesktop(desktop)),
      )
    }),
})
