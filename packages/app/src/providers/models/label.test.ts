import { describe, expect, test } from "bun:test"
import { rememberModelLabel } from "./label"

const label = (model: string) => ({ provider: "Acme", model, variants: ["high", "low"] })

describe("rememberModelLabel", () => {
  test("reports no change when the label is already remembered", () => {
    expect(rememberModelLabel({ "acme/alpha": label("Alpha") }, "acme/alpha", label("Alpha"))).toBeUndefined()
  })

  test("moves an updated label to the newest position", () => {
    const next = rememberModelLabel(
      { "acme/alpha": label("Alpha"), "acme/beta": label("Beta") },
      "acme/alpha",
      label("Alpha 2"),
    )

    expect(Object.keys(next ?? {})).toEqual(["acme/beta", "acme/alpha"])
    expect(next?.["acme/alpha"]).toEqual(label("Alpha 2"))
  })

  test("keeps the newest 32 labels", () => {
    const labels = Object.fromEntries(Array.from({ length: 32 }, (_, index) => [`acme/m${index}`, label(`M${index}`)]))
    const next = rememberModelLabel(labels, "acme/new", label("New"))

    expect(Object.keys(next ?? {})).toHaveLength(32)
    expect(next?.["acme/m0"]).toBeUndefined()
    expect(Object.keys(next ?? {}).at(-1)).toBe("acme/new")
  })
})
