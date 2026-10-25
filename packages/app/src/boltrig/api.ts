// A typed client for the Boltrig Client API, contract boltrig.human 2.2 (@boltrig/human-contract 2.0.0-pre.5).
// Every op is POST <base>/<op> with JSON, the contract header and a bearer token; `hello` alone needs no token.
// The base is same-origin (`/boltrig-api`, proxied to the server by the dev server) because the Client API
// sends no CORS headers. Nothing secret lives here: the token is passed in by the caller on every call.

export const CONTRACT = "boltrig.human"
export const CONTRACT_MINOR = 2
export const CONTRACT_HEADER = `${CONTRACT}/2.${CONTRACT_MINOR}`

export const apiBase = (import.meta.env.VITE_BOLTRIG_API as string | undefined) ?? "/boltrig-api"

// ---- Shared shapes -------------------------------------------------------------------------------------------

export type UnknownReason = "not_reported" | "not_applicable" | "not_recorded" | "unavailable" | "outside_scope"
export type KnownUnknown<T> = { state: "known"; value: T } | { state: "unknown"; reason: UnknownReason }

export function known<T>(value: KnownUnknown<T>): T | undefined {
  return value.state === "known" ? value.value : undefined
}

export type SourceErrorCode = "unavailable" | "malformed" | "deadline" | "bounded-window" | "forbidden" | "refused"
export type SourceError = { source: string; code: SourceErrorCode }

type Page = { observedAt: string; complete: boolean; sourceErrors: SourceError[] }

// ---- hello, capabilities.get, viewer.get ---------------------------------------------------------------------

export type HelloResponse = {
  contract: typeof CONTRACT
  negotiated: { major: 2; minor: number }
  supported: { major: 2; minors: number[] }
}

export type Capability =
  | { id: string; state: "available" }
  | { id: string; state: "unavailable"; reason: string }
export type CapabilitiesResponse = { scope: { kind: "viewer" } | { kind: "team"; teamId: string }; capabilities: Capability[] }

export type ViewerTeam = { teamId: string; displayName: string }
export type ViewerResponse =
  | { state: "member"; person: { personId: string; displayName: string }; teams: ViewerTeam[] }
  | { state: "not_a_member" }

// ---- tree.get, agents.list, agent.show -----------------------------------------------------------------------

export type RoleTier = "head" | "vp" | "pm" | "worker"
export type TreeRole = {
  roleId: string
  displayName: KnownUnknown<string>
  tier: RoleTier
  humanFacing: KnownUnknown<boolean>
  reportsTo: KnownUnknown<{ teamId: string; roleId: string }>
}
export type TreeResponse = { state: "running"; teamId: string; roles: TreeRole[] } | { state: "not_running"; teamId: string }

export type Execution = "unstarted" | "idle" | "queued" | "running" | "blocked" | "drained" | "unknown"
export type Availability = "available" | "stopped" | "unavailable" | "disconnected" | "unknown"
export type ContainerState = "starting" | "running" | "stopping" | "stopped" | "failed"

export type AgentRow = {
  agentId: string
  team: string
  role: string
  configuredRuntime: KnownUnknown<string>
  effectiveRuntime: KnownUnknown<string>
  containerId: KnownUnknown<string>
  containerState: KnownUnknown<ContainerState>
  executionStatus: Execution
  runtimeAvailability: Availability
  containerAvailability: Availability
  currentTurnId: KnownUnknown<string>
  activeWorkId: KnownUnknown<string>
  blockedTurnId: KnownUnknown<string>
  blockedWorkId: KnownUnknown<string>
  lastActivityAt: KnownUnknown<string>
  observedAt: string
  stale: boolean
}
export type AgentsResponse = {
  rows: AgentRow[]
  total: number
  nextOffset: KnownUnknown<number>
  complete: boolean
  sourceErrors: SourceError[]
  observedAt: string
}

export type InboxState = "new" | "open" | "processing" | "done" | "failed" | "uncertain" | "expired" | "cancelled"
export type AgentDetail = {
  agentId: string
  inventory: AgentRow
  inbox: { id: string; work: string; state: InboxState; receivedAt: string; resolvedAt: KnownUnknown<string> }[]
  unavailable: Record<string, string>
  sourceErrors: SourceError[]
  complete: boolean
}

// ---- work.list, turn.list, turn.show -------------------------------------------------------------------------

export type WorkState = "open" | "cancelled" | "closed"
export type Work = {
  id: string
  origin: { kind: string; team: string; requester: string; accountable: string }
  status: WorkState
  maxSteps: number
  used: number
  participants: string[]
  approvals: unknown[]
}
export type WorkPage = Page & { rows: Work[]; more: boolean }

export type Turn = { id: string; team: string; role: string; work: string; state: InboxState; receivedAt: string }
export type TurnPage = Page & { rows: Turn[]; more: boolean }
export type TurnEvent = { at: string; kind: string; text: string }
export type TurnDetail = { turn: Turn; events: TurnEvent[]; complete: boolean; sourceErrors: SourceError[] }

// ---- conversation.send ---------------------------------------------------------------------------------------

export type SendRequest =
  | { kind: "new"; teamId: string; roleId?: string; workId: string; idempotencyKey: string; text: string }
  | { kind: "continue"; teamId: string; roleId?: string; sessionHandle: string; idempotencyKey: string; text: string }
export type SendResponse =
  | { state: "queued"; position: number; sessionHandle: string; workId: string }
  | { state: "running"; sessionHandle: string; workId: string }
  | { state: "done"; sessionHandle: string; workId: string }

// ---- sessions.list, runs.list, steps.list (history.read): the conversation itself ---------------------------

export type Untrusted = { text: string; untrusted: true }
export type SessionItem = {
  sessionHandle: string
  roleId: string
  subject: { workId: string }
  title: KnownUnknown<Untrusted>
  lastActivityAt: string
  state: "active" | "idle" | "blocked" | "retrying"
  provenance: unknown
}
export type RunItem = {
  runHandle: string
  ordinal: number
  startedAt: KnownUnknown<string>
  finishedAt: KnownUnknown<string>
  state: { kind: "running" } | { kind: "uncertain" } | { kind: "finished" } | { kind: "cancelled" }
}
export type StepKind = "message" | "agent_message" | "question" | "approval_request" | "status" | "tool_summary"
export type StepItem = {
  stepHandle: string
  ordinal: number
  roleId: KnownUnknown<string>
  kind: StepKind
  status: KnownUnknown<string>
  startedAt: KnownUnknown<string>
  finishedAt: KnownUnknown<string>
  body: KnownUnknown<Untrusted>
  links: unknown[]
}
type Cursor = KnownUnknown<string>

// ---- The op table: one place that ties each op to its request and response ---------------------------------

type Ops = {
  hello: [{ contract: typeof CONTRACT; version: { major: 2; minor: number }; client: { name: string; version: string } }, HelloResponse]
  "capabilities.get": [{ scope: { kind: "viewer" } | { kind: "team"; teamId: string } }, CapabilitiesResponse]
  "viewer.get": [Record<string, never>, ViewerResponse]
  "tree.get": [{ teamId: string }, TreeResponse]
  "agents.list": [{ team?: string; role?: string; offset?: number; limit?: number }, AgentsResponse]
  "agent.show": [{ team: string; role: string; turn?: string }, AgentDetail]
  "work.list": [Record<string, never>, WorkPage]
  "turn.list": [{ uncertain?: boolean }, TurnPage]
  "turn.show": [{ turnId: string; agent?: string }, TurnDetail]
  "conversation.send": [SendRequest, SendResponse]
  "sessions.list": [{ teamId: string; roleId?: string; cursor?: string; limit: number }, { sessions: SessionItem[]; cursor: Cursor }]
  "runs.list": [{ sessionHandle: string; cursor?: string; limit: number }, { runs: RunItem[]; cursor: Cursor }]
  "steps.list": [{ runHandle: string; cursor?: string; limit: number }, { steps: StepItem[]; cursor: Cursor }]
}
export type Op = keyof Ops

// ---- Errors --------------------------------------------------------------------------------------------------

// What the screen does with a refusal: 401 signs the person out, 409 asks for a newer client, 404 is a missing
// row, 503 is a source error on the one row that asked (never the page), anything else is shown as it came.
export type ApiErrorKind = "signed_out" | "version" | "not_found" | "unavailable" | "rate_limited" | "invalid" | "network"

export class BoltrigApiError extends Error {
  constructor(
    readonly op: Op,
    readonly kind: ApiErrorKind,
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

function kindOf(status: number): ApiErrorKind {
  if (status === 401) return "signed_out"
  if (status === 409) return "version"
  if (status === 404) return "not_found"
  if (status === 503) return "unavailable"
  if (status === 429) return "rate_limited"
  return "invalid"
}

// Last status seen per op, for the developer strip and the report; holds codes only, never bodies or tokens.
export const lastStatus = new Map<Op, number>()

export async function call<O extends Op>(
  op: O,
  body: Ops[O][0],
  token: string | undefined,
  init?: { signal?: AbortSignal },
): Promise<Ops[O][1]> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "boltrig-contract": CONTRACT_HEADER,
  }
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${apiBase}/${op}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: init?.signal,
  }).catch((error: unknown) => {
    throw new BoltrigApiError(op, "network", 0, "network", error instanceof Error ? error.message : String(error))
  })
  lastStatus.set(op, response.status)

  if (response.ok) return (await response.json()) as Ops[O][1]

  const refusal = (await response.json().catch(() => undefined)) as
    | { error?: { code?: string; message?: string } }
    | undefined
  throw new BoltrigApiError(
    op,
    kindOf(response.status),
    response.status,
    refusal?.error?.code ?? "unknown",
    refusal?.error?.message ?? response.statusText,
  )
}

export const hello = () =>
  call(
    "hello",
    { contract: CONTRACT, version: { major: 2, minor: CONTRACT_MINOR }, client: { name: "boltrig-web", version: "0" } },
    undefined,
  )
