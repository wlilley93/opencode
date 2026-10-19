export const SESSION_MODES = ["ask", "plan", "auto"] as const

export type SessionMode = (typeof SESSION_MODES)[number]

export function sessionMode(agent: string | undefined): SessionMode {
  if (agent === "ask") return "ask"
  if (agent === "plan") return "plan"
  return "auto"
}

export function sessionModeCopy(mode: SessionMode) {
  if (mode === "ask") return { label: "session.mode.ask.label", description: "session.mode.ask.description" } as const
  if (mode === "plan")
    return { label: "session.mode.plan.label", description: "session.mode.plan.description" } as const
  return { label: "session.mode.auto.label", description: "session.mode.auto.description" } as const
}

export function sessionModeAgent(mode: SessionMode) {
  if (mode === "ask") return "ask"
  if (mode === "plan") return "plan"
  return "build"
}

export function planApprovalReady(
  mode: SessionMode,
  working: boolean,
  messages: ReadonlyArray<{ type: string; agent?: string; finish?: string }>,
) {
  return (
    mode === "plan" &&
    !working &&
    messages.some((message) => message.type === "assistant" && message.agent === "plan" && message.finish)
  )
}
