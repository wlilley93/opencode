// A typed client for the Boltrig Client API, contract boltrig.human 2.2, and 2.3 for research.view.get
// (@boltrig/human-contract 2.0.0-pre.6). Every op is POST <base>/<op> with JSON, the contract header
// (`boltrig.human/2.<minor>`) and a bearer token; `hello` alone needs no token.
// The base is same-origin (`/boltrig-api`, proxied to the server by the dev server) because the Client API
// sends no CORS headers. Nothing secret lives here: the token is passed in by the caller on every call.

import { activeCompany } from "./companies"

export const CONTRACT = "boltrig.human"
export const CONTRACT_MINOR = 2
// The highest minor this client implements. `hello` asks for it; a server that does not offer it answers a lower
// one, and the client keeps every 2.2 op on 2.2. Only the research view (and the capability listing that names
// `research.read`) is sent at 2.3, and only once the server has negotiated 3.
export const RESEARCH_MINOR = 3
export const contractHeader = (minor: number) => `${CONTRACT}/2.${minor}`

export const apiBase = () => activeCompany().apiBase

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

// ---- sources.list, sources.show, held.list, doctor.get, status.get, logs.tail (operator.read, read-only) ----------

export type SourceType = "webhook" | "api" | "schedule"
export type SourceRow = {
  id: string
  type: SourceType
  status: "active" | "paused"
  preset: KnownUnknown<string>
  held: number
}
export type SourcesPage = Page & { rows: SourceRow[]; more: boolean }
export type SourceKey = { id: string; label: string; createdAt: string; lastUsedAt: KnownUnknown<string>; revoked: boolean }
export type SourceReceipt = {
  id: string
  state: string
  receivedAt: string
  reason: KnownUnknown<string>
  workId: KnownUnknown<string>
}
// The contract carries no delivery target ("to") for a source: only its type, preset, state, held count, keys and
// last receipts. The screen says so rather than inventing one.
export type SourceDetail = Omit<SourceRow, never> & {
  keys: KnownUnknown<{ rows: SourceKey[]; nextAfter: KnownUnknown<string>; more: boolean }>
  lastEvents: SourceReceipt[]
}
export type HeldReceipt = { id: string; team: string; reason: KnownUnknown<string>; receivedAt: string }
export type HeldPage = Page & { rows: HeldReceipt[]; more: boolean }

export type DoctorVerdict = "pass" | "warn" | "fail" | "skipped"
export type DoctorReport = { checks: { check: string; verdict: DoctorVerdict; reason: string }[] }

export type StatusAgent = {
  role: string
  busy: boolean
  blocked: boolean
  configuredRuntime: KnownUnknown<string>
  effectiveRuntime: KnownUnknown<string>
  inbox: { state: InboxState; count: number }[]
}
export type StatusTeam = {
  team: string
  container: KnownUnknown<"starting" | "running" | "stopping" | "stopped" | "failed">
  containerId: KnownUnknown<string>
  agents: StatusAgent[]
}
export type StatusReport = {
  teams: StatusTeam[]
  counts: { teams: number; openWork: number; heldEvents: number; uncertainTurns: number; pendingApprovals: number }
  complete: boolean
  sourceErrors: SourceError[]
}

export type LogLine = { at: string; source: string; role: KnownUnknown<string>; text: string }
export type LogTail = {
  team: string
  role: KnownUnknown<string>
  tail: number
  lines: LogLine[]
  complete: boolean
  sourceErrors: SourceError[]
  capabilities: { rawRuntimeLogs: string; rawContainerLogs: string; publicMessageText: string; hostLogs: string }
}

// ---- work.show, work_context.get ---------------------------------------------------------------------------

export type WorkApproval = {
  code: string
  work: string
  summary: string
  requestedBy: string
  eligible: string[]
  state: string
  expiresAt: string
  decidedBy: KnownUnknown<string>
  decidedAt: KnownUnknown<string>
}
export type WorkDetail = Omit<Work, "approvals"> & { approvals: WorkApproval[] }
export type WorkContext = {
  workId: string
  role: "origin" | "participant"
  issue: KnownUnknown<{ key: Untrusted; url: KnownUnknown<string> }>
  state: KnownUnknown<WorkState>
  status: KnownUnknown<Untrusted>
  documents: KnownUnknown<{ title: Untrusted; url: string }[]>
  parent: KnownUnknown<string>
  children: KnownUnknown<string[]>
}

// ---- conversation.send ---------------------------------------------------------------------------------------

export type SendRequest =
  | { kind: "new"; teamId: string; roleId?: string; workId: string; idempotencyKey: string; text: string }
  | { kind: "continue"; teamId: string; roleId?: string; sessionHandle: string; idempotencyKey: string; text: string }
export type ReconcileRequest = { teamId: string; roleId?: string; idempotencyKey: string }
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
// `person_message` is not in contract 2.0.0-pre.6 yet: the server work in progress adds it, so the client reads it
// when it arrives and never depends on it.
export type StepKind = "person_message" | "message" | "agent_message" | "question" | "approval_request" | "status" | "tool_summary"
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

// ---- research.view.get (research.read, minor 3): a team head's merged view and leads, read-only ------------

export type ResearchAssessment =
  | "supported"
  | "reproduced"
  | "contested"
  | "inconclusive"
  | "contradicted"
  | "not_reproduced"
  | "unassessed"
export type ResearchTally = { assessment: ResearchAssessment; count: number }
export type ResearchUnavailableReason =
  | "not_running"
  | "no_head"
  | "container_missing"
  | "file_missing"
  | "too_large"
  | "unreadable"
  | "invalid"
export type ResearchPartUnavailable = { state: "unavailable"; reason: ResearchUnavailableReason }
export type ResearchNode = { id: string; type: string; label: Untrusted }
export type ResearchEdge = {
  id: string
  source: string
  target: string
  predicate: string
  claims: number
  assessment: ResearchTally[]
}
export type ResearchGraph = {
  state: "available"
  nodes: ResearchNode[]
  edges: ResearchEdge[]
  totalNodes: number
  totalEdges: number
  skipped: number
  nextNodes: KnownUnknown<number>
  nextEdges: KnownUnknown<number>
}
export type ResearchLead = {
  id: string
  file: string
  question: Untrusted
  status: KnownUnknown<string>
  handledBy: KnownUnknown<string>
}
export type ResearchLeads = {
  state: "available"
  files: number
  rows: ResearchLead[]
  totalRows: number
  skipped: number
  next: KnownUnknown<number>
}
export type ResearchSummary = {
  entities: KnownUnknown<number>
  edges: KnownUnknown<number>
  claims: KnownUnknown<number>
  verdicts: KnownUnknown<ResearchTally[]>
  generatedAt: KnownUnknown<string>
  inputsDigest: KnownUnknown<string>
  leads: KnownUnknown<number>
  openLeads: KnownUnknown<number>
}
export type ResearchViewRequest = { teamId: string; nodesFrom?: number; edgesFrom?: number; leadsFrom?: number }
export type ResearchViewResponse = {
  teamId: string
  graph: ResearchGraph | ResearchPartUnavailable
  leads: ResearchLeads | ResearchPartUnavailable
  summary: ResearchSummary
}

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
  "conversation.reconcile": [ReconcileRequest, SendResponse]
  "sources.list": [Record<string, never>, SourcesPage]
  "sources.show": [{ source: string; after?: string; limit?: number }, SourceDetail]
  "held.list": [Record<string, never>, HeldPage]
  "status.get": [Record<string, never>, StatusReport]
  "doctor.get": [Record<string, never>, DoctorReport]
  "logs.tail": [{ team: string; role?: string; tail?: number }, LogTail]
  "work.show": [{ workId: string }, WorkDetail]
  "work_context.get": [{ teamId: string; workId: string }, WorkContext]
  "sessions.list": [{ teamId: string; roleId?: string; cursor?: string; limit: number }, { sessions: SessionItem[]; cursor: Cursor }]
  "runs.list": [{ sessionHandle: string; cursor?: string; limit: number }, { runs: RunItem[]; cursor: Cursor }]
  "steps.list": [{ runHandle: string; cursor?: string; limit: number }, { steps: StepItem[]; cursor: Cursor }]
  "research.view.get": [ResearchViewRequest, ResearchViewResponse]
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
  init?: { signal?: AbortSignal; minor?: number },
): Promise<Ops[O][1]> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "boltrig-contract": contractHeader(init?.minor ?? CONTRACT_MINOR),
  }
  if (token) headers.authorization = `Bearer ${token}`

  const response = await fetch(`${apiBase()}/${op}`, {
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
    { contract: CONTRACT, version: { major: 2, minor: RESEARCH_MINOR }, client: { name: "boltrig-web", version: "0" } },
    undefined,
  )
