// Boltrig OS: entry of the dev bundle's default_app.asar. electron-vite starts the bundle with the
// app path, which Electron's own default app loads as usual. Opened from the Dock or Finder there is
// no path and Electron would show its "To run a local app" page, so start `bun run dev` instead and
// let the window it opens take over.
import { spawn } from "node:child_process"
import { openSync, readFileSync } from "node:fs"
import { app } from "electron/main"

const target = process.argv.slice(1).some((arg) => !arg.startsWith("-") || arg.startsWith("--app="))

if (target) await import("./main.js")
else {
  const config = JSON.parse(readFileSync(new URL("./launcher.json", import.meta.url), "utf8"))
  const log = openSync(config.log, "a")
  spawn(config.bun, ["run", "dev"], {
    cwd: config.cwd,
    env: { ...process.env, PATH: config.path },
    detached: true,
    stdio: ["ignore", log, log],
  }).unref()
  app.quit()
}
