import { describe, expect, it } from "bun:test"
import { dict } from "@/runtime/i18n/en"
import { planApprovalReady, sessionMode, sessionModeAgent, sessionModeCopy } from "./mode"

describe("session mode", () => {
  it("maps the selected agent to Ask, Plan, and Auto", () => {
    expect(sessionMode("ask")).toBe("ask")
    expect(sessionMode("plan")).toBe("plan")
    expect(sessionMode("build")).toBe("auto")
    expect(sessionMode(undefined)).toBe("auto")
  })

  it("maps each mode to its durable session agent", () => {
    expect(sessionModeAgent("ask")).toBe("ask")
    expect(sessionModeAgent("plan")).toBe("plan")
    expect(sessionModeAgent("auto")).toBe("build")
  })

  it("provides concise, distinct mode guidance", () => {
    expect(sessionModeCopy("ask")).toEqual({
      label: "session.mode.ask.label",
      description: "session.mode.ask.description",
    })
    expect(sessionModeCopy("plan")).toEqual({
      label: "session.mode.plan.label",
      description: "session.mode.plan.description",
    })
    expect(sessionModeCopy("auto")).toEqual({
      label: "session.mode.auto.label",
      description: "session.mode.auto.description",
    })
    expect(dict["session.mode.plan.approve"]).toBe("Approve plan & switch to Auto")
    expect(dict["session.mode.plan.approveHint"]).toBe("Review the plan, then approve to continue.")
  })

  it("offers plan approval only after a completed Plan response", () => {
    const response = [{ type: "assistant", agent: "plan", finish: "stop" }]
    expect(planApprovalReady("plan", false, response)).toBe(true)
    expect(planApprovalReady("plan", true, response)).toBe(false)
    expect(planApprovalReady("plan", false, [])).toBe(false)
    expect(planApprovalReady("plan", false, [{ type: "assistant", agent: "plan" }])).toBe(false)
    expect(planApprovalReady("auto", false, response)).toBe(false)
  })
})
