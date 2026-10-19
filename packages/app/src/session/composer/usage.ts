import type { SessionMessageInfo, TokenUsageInfo } from "@opencode/client/promise"

export type SessionUsage = {
  cost: number
  tokens: number
  context: number
}

const empty = { cost: 0, tokens: 0, context: 0 } satisfies SessionUsage

function tokenTotal(tokens: TokenUsageInfo) {
  return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write
}

function contextTotal(tokens: TokenUsageInfo) {
  return tokens.input + tokens.output + tokens.cache.read + tokens.cache.write
}

/** Sum billed usage and take the newest step's context size from the session history. */
export function sessionUsage(messages: readonly SessionMessageInfo[]): SessionUsage {
  let cost = 0
  let tokens = 0
  let context = 0

  for (const message of messages) {
    if (message.type !== "assistant" && message.type !== "compaction") continue

    // SAFETY: the assistant and compaction variants carry optional usage; the running compaction does not.
    const value = message as typeof message & { cost?: number; tokens?: TokenUsageInfo }

    if (value.cost !== undefined) cost += value.cost

    if (!value.tokens) continue

    tokens += tokenTotal(value.tokens)
    context = contextTotal(value.tokens)
  }

  if (cost === 0 && tokens === 0 && context === 0) return empty

  return { cost, tokens, context }
}

export function formatTokens(value: number) {
  if (value < 1_000) return String(value)

  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}k`

  return `${(value / 1_000_000).toFixed(1)}m`
}

export function formatCost(value: number) {
  if (value === 0) return "$0"

  if (value < 0.01) return `$${value.toFixed(4)}`

  return `$${value.toFixed(2)}`
}

export function contextPercent(context: number, limit: number | undefined) {
  if (!limit || limit <= 0) return undefined

  return Math.min(100, Math.round((context / limit) * 100))
}
