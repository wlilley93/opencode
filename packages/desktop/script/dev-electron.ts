import { $ } from "bun"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export async function prepareDevElectron() {
  const electron = dirname(fileURLToPath(import.meta.resolve("electron/package.json")))
  const icon = Bun.file(join(import.meta.dirname, "../icons/dev/icon.icns"))
  const launcher = Bun.file(join(import.meta.dirname, "dev-launcher.js"))

  const hash = new Bun.CryptoHasher("sha256")
    .update(electron)
    .update(process.arch)
    .update(await Bun.file(join(electron, "package.json")).text())
    .update(await icon.arrayBuffer())
    .update(await Bun.file(import.meta.filename).text())
    .update(await launcher.text())
    .digest("hex")
    .slice(0, 16)

  const root = join(import.meta.dirname, "../node_modules/.cache/opencode-dev", hash)
  const bundle = join(root, "Boltrig OS.app")
  // Electron uses the executable's name to distinguish development from packaged apps.
  const executable = join(bundle, "Contents/MacOS/Electron")

  if (await Bun.file(join(root, "ready")).exists()) return executable

  // macOS reads the Dock and app-switcher identity from the bundle, even after app.setName().
  await $`mkdir -p ${root}`
  await $`ditto ${join(electron, "dist/Electron.app")} ${bundle}`
  const plist = join(bundle, "Contents/Info.plist")

  for (const key of ["CFBundleName", "CFBundleDisplayName"]) {
    await $`plutil -replace ${key} -string ${"Boltrig OS"} ${plist}`
  }

  await $`plutil -replace CFBundleIdentifier -string ai.boltrig.os.desktop ${plist}`
  await $`plutil -insert NSAutoFillRequiresTextContentTypeForOneTimeCodeOnMac -bool true ${plist}`
  await Bun.write(join(bundle, "Contents/Resources/electron.icns"), icon)
  await installLauncher(join(bundle, "Contents/Resources/default_app.asar"), join(root, "default_app"), launcher)
  // Changing the bundle resources invalidates Electron's signature.
  await $`codesign --force --deep --sign - ${bundle}`
  await Bun.write(join(root, "ready"), "")

  return executable
}

// Boltrig OS: the Dock pins this bundle, and opening it without an app path shows Electron's
// placeholder page. Front Electron's default app with dev-launcher.js, which starts `bun run dev`.
async function installLauncher(asar: string, staging: string, launcher: Bun.BunFile) {
  // electron-builder carries @electron/asar; the desktop package does not depend on it directly.
  const require = createRequire(import.meta.resolve("app-builder-lib/package.json"))
  const { createPackage, extractAll }: {
    createPackage(source: string, archive: string): Promise<void>
    extractAll(archive: string, destination: string): void
  } = require("@electron/asar")

  await $`rm -rf ${staging}`
  extractAll(asar, staging)
  const manifest = await Bun.file(join(staging, "package.json")).json()
  await Bun.write(join(staging, "package.json"), JSON.stringify({ ...manifest, main: "launcher.js" }, null, 2))
  await Bun.write(join(staging, "launcher.js"), launcher)
  await Bun.write(
    join(staging, "launcher.json"),
    JSON.stringify({
      bun: process.execPath,
      cwd: join(import.meta.dirname, ".."),
      path: process.env.PATH,
      log: join(staging, "../dev.log"),
    }),
  )
  await createPackage(staging, asar)
}
