import { describe, expect, test } from "bun:test"
import { resolve } from "node:path"
import { selectOptions } from "./dev-options"

describe("desktop development options", () => {
  test.each([
    {
      name: "defaults to the source server",
      args: ["--inspect=9229"],
      expected: { server: { type: "build" }, electron: ["--inspect=9229"] },
    },
    {
      name: "adopts an external registration without consuming Electron arguments",
      args: ["--service-file", "registration.json", "--remote-debugging-port=9333"],
      expected: {
        server: { type: "build" },
        serviceFile: resolve("registration.json"),
        electron: ["--remote-debugging-port=9333"],
      },
    },
    {
      name: "downloads a requested server version",
      args: ["--download-server", "2.0.31", "--trace-warnings"],
      expected: { server: { type: "download", version: "2.0.31" }, electron: ["--trace-warnings"] },
    },
  ])("$name", ({ args, expected }) => {
    expect(selectOptions(args)).toEqual(expected)
  })

  test.each([
    [["--build-server", "--download-server", "2.0.31"], "cannot be used together"],
    [["--download-server"], "requires a version"],
    [["--service-file"], "requires a path"],
  ])("rejects invalid options", (args, message) => {
    expect(() => selectOptions(args)).toThrow(message)
  })
})
