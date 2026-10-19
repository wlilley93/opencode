import { describe, expect, test } from "bun:test"
import { normalizePermissionRules } from "./permission-rules"

describe("normalizePermissionRules", () => {
  test("trims editable fields and keeps the effect", () => {
    expect(normalizePermissionRules([{ action: " bash ", resource: " git * ", effect: "ask" }])).toEqual([
      { action: "bash", resource: "git *", effect: "ask" },
    ])
  })

  test("drops incomplete rows rather than sending an empty match", () => {
    expect(
      normalizePermissionRules([
        { action: "", resource: "*", effect: "allow" },
        { action: "read", resource: "  ", effect: "deny" },
        { action: " edit ", resource: "*", effect: "allow" },
      ]),
    ).toEqual([{ action: "edit", resource: "*", effect: "allow" }])
  })
})
