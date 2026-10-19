import { resolve } from "node:path"

export type ServerSource = { type: "build" } | { type: "download"; version: string }

export type DevOptions = { server: ServerSource; serviceFile?: string; electron: string[] }

export function selectOptions(args: string[]): DevOptions {
  const build = args.indexOf("--build-server")
  const download = args.indexOf("--download-server")
  const service = args.indexOf("--service-file")

  if (build >= 0 && download >= 0) throw new Error("--build-server and --download-server cannot be used together")
  if (download >= 0 && !args[download + 1]) throw new Error("--download-server requires a version")
  if (service >= 0 && !args[service + 1]) throw new Error("--service-file requires a path")
  const consumed = new Set([
    build,
    download,
    download >= 0 ? download + 1 : -1,
    service,
    service >= 0 ? service + 1 : -1,
  ])

  return {
    server: download >= 0 ? { type: "download", version: args[download + 1] } : { type: "build" },
    ...(service >= 0 ? { serviceFile: resolve(args[service + 1]) } : {}),
    electron: args.filter((_, index) => !consumed.has(index)),
  }
}
