import { describe, expect, test } from "bun:test"
import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client/promise"
import { contextPercent, formatCost, formatTokens, sessionUsage } from "./usage"

const assistant = (
  cost: number,
  tokens: { input: number; output: number; reasoning?: number; read?: number; write?: number },
): SessionMessageAssistant => ({
  id: "msg",
  type: "assistant",
  time: { created: 0 },
  agent: "build",
  model: { id: "test", providerID: "test" },
  content: [],
  cost,
  tokens: {
    input: tokens.input,
    output: tokens.output,
    reasoning: tokens.reasoning ?? 0,
    cache: { read: tokens.read ?? 0, write: tokens.write ?? 0 },
  },
})

describe("sessionUsage", () => {
  test("sums cost and tokens while keeping the newest context step", () => {
    const usage = sessionUsage([assistant(0.01, { input: 100, output: 20 }), assistant(0.02, { input: 300, output: 40, read: 1000 })])

    expect(usage.cost).toBeCloseTo(0.03)
    expect(usage.tokens).toBe(1460)
    expect(usage.context).toBe(1340)
  })

  test("ignores messages without usage", () => {
    const user = { id: "msg", type: "user", text: "", time: { created: 0 } } satisfies SessionMessageInfo

    expect(sessionUsage([user])).toEqual({ cost: 0, tokens: 0, context: 0 })
  })
})

describe("usage formatting", () => {
  test("keeps small costs precise and compacts token counts", () => {
    expect(formatCost(0.0042)).toBe("$0.0042")
    expect(formatCost(1.234)).toBe("$1.23")
    expect(formatTokens(999)).toBe("999")
    expect(formatTokens(12_300)).toBe("12k")
    expect(formatTokens(1_250_000)).toBe("1.3m")
  })

  test("clamps the context meter", () => {
    expect(contextPercent(50, 100)).toBe(50)
    expect(contextPercent(200, 100)).toBe(100)
    expect(contextPercent(50, undefined)).toBeUndefined()
  })
})
