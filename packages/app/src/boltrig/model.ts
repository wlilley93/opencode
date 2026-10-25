// The Boltrig shell's model, read live from the Client API: the viewer, their teams (tree.get) and agents
// (agents.list), their works (work.list) and turns (turn.list, turn.show), and the conversations they start
// with a team's head (conversation.send). Polled; the contract has no stream yet (stream.read is not implemented).

import { createContext, onCleanup, useContext } from "solid-js"
import { createStore, produce } from "solid-js/store"
import {
  BoltrigApiError,
  CONTRACT_MINOR,
  RESEARCH_MINOR,
  call,
  hello,
  known,
  type AgentDetail,
  type AgentRow,
  type DoctorReport,
  type HeldPage,
  type LogTail,
  type SourceDetail,
  type SourcesPage,
  type StatusReport,
  type WorkContext,
  type WorkDetail,
  type ApiErrorKind,
  type InboxState,
  type ResearchGraph,
  type ResearchLeads,
  type ResearchPartUnavailable,
  type ResearchViewResponse,
  type SendResponse,
  type SourceError,
  type StepItem,
  type TreeResponse,
  type TreeRole,
  type Turn,
  type TurnDetail,
  type ViewerResponse,
  type Work,
} from "./api"
import { signOut, token } from "./auth"

export type ModeID = "learning" | "doing" | "interfacing"

export type Mode = { id: ModeID; icon: string; team?: string }

// Learning is Research's mode, Doing is Delivery's; Interfacing belongs to the person's own tools.
export const modes: Mode[] = [
  { id: "learning", icon: "graduation-cap", team: "research" },
  { id: "doing", icon: "circle-check", team: "delivery" },
  { id: "interfacing", icon: "speech-bubble" },
]

export function modeOf(id: ModeID) {
  return modes.find((mode) => mode.id === id)!
}

export const TERMINAL: ReadonlySet<InboxState> = new Set(["done", "failed", "expired", "cancelled"])

export type Message = {
  key: string
  workId: string
  text: string
  sentAt: string
  // lost: no answer came back, so the server may or may not hold it; not_received: reconcile says it does not.
  state: "sending" | SendResponse["state"] | "failed" | "lost" | "not_received"
  roleId?: string
  position?: number
  error?: ApiErrorKind
}

export type Conversation = { teamId: string; sessionHandle?: string; messages: Message[] }

type Loadable<T> = { value?: T; error?: ApiErrorKind; sourceErrors?: SourceError[]; complete?: boolean }

// The research view as the screen draws it: every page of research.view.get walked and joined. `restarted` counts
// the walks begun again because the view changed under the client (generatedAt or inputsDigest moved).
export type ResearchView = {
  graph: ResearchGraph | ResearchPartUnavailable
  leads: ResearchLeads | ResearchPartUnavailable
  summary: ResearchViewResponse["summary"]
  pages: number
  restarted: number
  capped: boolean
}

// Not served is a state, not an error: the server negotiated below 2.3, or does not list research.read for the team.
export type ResearchState =
  | { status: "loading" }
  | { status: "not_served"; minor: number; capability?: string }
  | { status: "error"; error: ApiErrorKind }
  | { status: "ready"; view: ResearchView }

type State = {
  status: "loading" | "ready" | "not_a_member" | "error"
  error?: ApiErrorKind
  viewer?: Extract<ViewerResponse, { state: "member" }>
  trees: Record<string, Loadable<TreeResponse>>
  agents: Loadable<AgentRow[]>
  works: Loadable<Work[]>
  turns: Loadable<Turn[]>
  uncertain: Loadable<Turn[]>
  turnDetails: Record<string, Loadable<TurnDetail>>
  agentDetails: Record<string, Loadable<AgentDetail>>
  conversations: Record<string, Conversation>
  transcripts: Record<string, Loadable<StepItem[]>>
  research: Record<string, ResearchState>
  // Operator reads (operator.read): all read-only. Each is a Loadable so one refusal marks one pane, not the page.
  sources: Loadable<SourcesPage>
  sourceDetails: Record<string, Loadable<SourceDetail>>
  held: Loadable<HeldPage>
  doctor: Loadable<DoctorReport>
  serverStatus: Loadable<StatusReport>
  logs: Record<string, Loadable<LogTail>>
  workDetails: Record<string, Loadable<WorkDetail>>
  workContexts: Record<string, Loadable<WorkContext>>
  minor?: number
  observedAt?: string
}

const CONVERSATIONS_KEY = "boltrig.conversations"

function readConversations(): Record<string, Conversation> {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CONVERSATIONS_KEY) ?? "{}") as Record<string, Conversation>
    // A send in flight when the tab went away is a lost send: its answer will never arrive here.
    Object.values(saved).forEach((conversation) =>
      conversation.messages.forEach((message) => {
        if (message.state === "sending") message.state = "lost"
      }),
    )
    return saved
  } catch {
    return {}
  }
}

function uuid() {
  return crypto.randomUUID()
}

export function createBoltrigData() {
  const [state, setState] = createStore<State>({
    status: "loading",
    trees: {},
    agents: {},
    works: {},
    turns: {},
    uncertain: {},
    turnDetails: {},
    agentDetails: {},
    conversations: readConversations(),
    transcripts: {},
    research: {},
    sources: {},
    sourceDetails: {},
    held: {},
    doctor: {},
    serverStatus: {},
    logs: {},
    workDetails: {},
    workContexts: {},
  })

  // Every call goes through here: a 401 signs the person out; any other refusal is returned as a kind for the
  // row that asked, so one failing read never blanks the page.
  async function attempt<T>(run: (bearer: string) => Promise<T>): Promise<{ value: T } | { error: ApiErrorKind }> {
    const bearer = token()
    if (!bearer) return { error: "signed_out" }
    try {
      return { value: await run(bearer) }
    } catch (error) {
      if (error instanceof BoltrigApiError) {
        if (error.kind === "signed_out") signOut("refused")
        return { error: error.kind }
      }
      return { error: "network" }
    }
  }

  // hello needs no token. A server that does not answer it is treated as 2.2: every op this shell shipped with
  // works there, and the research view says it is not served.
  let negotiation: Promise<number> | undefined
  function negotiate() {
    negotiation ??= hello()
      .then((answer) => answer.negotiated.minor)
      .catch(() => CONTRACT_MINOR)
      .then((minor) => {
        setState("minor", minor)
        return minor
      })
    return negotiation
  }

  // One read into a Loadable: success clears the error, a refusal keeps what was last read and marks the pane.
  async function read<T>(run: (bearer: string) => Promise<T>): Promise<Loadable<T>> {
    const result = await attempt(run)
    return "error" in result ? { error: result.error } : { value: result.value, error: undefined }
  }

  const loadSources = async () => setState("sources", await read((bearer) => call("sources.list", {}, bearer)))
  const loadHeld = async () => setState("held", await read((bearer) => call("held.list", {}, bearer)))
  const loadDoctor = async () => setState("doctor", await read((bearer) => call("doctor.get", {}, bearer)))
  const loadStatus = async () => setState("serverStatus", await read((bearer) => call("status.get", {}, bearer)))
  const loadLogs = async (team: string, tail = 100) =>
    setState("logs", team, await read((bearer) => call("logs.tail", { team, tail }, bearer)))
  const loadSource = async (source: string) =>
    setState("sourceDetails", source, await read((bearer) => call("sources.show", { source }, bearer)))
  // sources.show pages the keys by `after`; the next page is appended to the ones already shown.
  async function loadMoreKeys(source: string) {
    const current = state.sourceDetails[source]?.value?.keys
    const after = current?.state === "known" ? known(current.value.nextAfter) : undefined
    if (!after) return
    const more = await read((bearer) => call("sources.show", { source, after }, bearer))
    if (!more.value) return setState("sourceDetails", source, "error", more.error)
    const page = more.value.keys
    setState(
      "sourceDetails",
      source,
      produce((draft) => {
        if (draft.value?.keys.state !== "known" || page.state !== "known") return
        draft.value.keys.value.rows.push(...page.value.rows)
        draft.value.keys.value.nextAfter = page.value.nextAfter
        draft.value.keys.value.more = page.value.more
      }),
    )
  }
  const loadWork = async (workId: string, teamId: string) => {
    const [detail, context] = await Promise.all([
      read((bearer) => call("work.show", { workId }, bearer)),
      read((bearer) => call("work_context.get", { teamId, workId }, bearer)),
    ])
    setState("workDetails", workId, detail)
    setState("workContexts", workId, context)
  }

  async function loadResearch(teamId: string) {
    if (!state.research[teamId] || state.research[teamId].status !== "ready") setState("research", teamId, { status: "loading" })
    const minor = await negotiate()
    if (minor < RESEARCH_MINOR) return setState("research", teamId, { status: "not_served", minor })
    const capabilities = await attempt((bearer) =>
      call("capabilities.get", { scope: { kind: "team", teamId } }, bearer, { minor: RESEARCH_MINOR }),
    )
    if ("error" in capabilities) return setState("research", teamId, { status: "error", error: capabilities.error })
    const capability = capabilities.value.capabilities.find((item) => item.id === "research.read")
    if (capability?.state !== "available")
      return setState("research", teamId, {
        status: "not_served",
        minor,
        capability: capability?.state === "unavailable" ? capability.reason : "not_listed",
      })
    const view = await attempt((bearer) => walkResearch(teamId, bearer))
    if ("error" in view) {
      // 409 here means the server negotiated 3 but refused the 2.3 header: the op is not served after all.
      if (view.error === "version") return setState("research", teamId, { status: "not_served", minor })
      return setState("research", teamId, { status: "error", error: view.error })
    }
    setState("research", teamId, { status: "ready", view: view.value })
  }

  async function loadViewer() {
    const result = await attempt((bearer) => call("viewer.get", {}, bearer))
    if ("error" in result) {
      setState({ status: "error", error: result.error })
      return
    }
    if (result.value.state === "not_a_member") {
      setState({ status: "not_a_member", viewer: undefined })
      return
    }
    setState({ status: "ready", viewer: result.value, error: undefined })
    await Promise.all(result.value.teams.map((team) => loadTree(team.teamId)))
  }

  async function loadTree(teamId: string) {
    const result = await attempt((bearer) => call("tree.get", { teamId }, bearer))
    setState("trees", teamId, "error" in result ? { error: result.error } : { value: result.value })
  }

  async function loadAgents() {
    const rows: AgentRow[] = []
    const sourceErrors: SourceError[] = []
    let offset = 0
    let complete = true
    // Page through the inventory; the server bounds a page and says where the next one starts.
    for (let page = 0; page < 20; page++) {
      const result = await attempt((bearer) => call("agents.list", { offset, limit: 50 }, bearer))
      if ("error" in result) {
        setState("agents", { error: result.error })
        return
      }
      rows.push(...result.value.rows)
      sourceErrors.push(...result.value.sourceErrors)
      complete = complete && result.value.sourceErrors.length === 0
      const next = known(result.value.nextOffset)
      if (next === undefined) break
      offset = next
    }
    setState("agents", { value: rows, sourceErrors, complete, error: undefined })
  }

  async function loadWorks() {
    const result = await attempt((bearer) => call("work.list", {}, bearer))
    if ("error" in result) return setState("works", { error: result.error })
    setState("works", {
      value: result.value.rows,
      sourceErrors: result.value.sourceErrors,
      complete: result.value.complete,
      error: undefined,
    })
    setState("observedAt", result.value.observedAt)
  }

  async function loadTurns() {
    const [all, uncertain] = await Promise.all([
      attempt((bearer) => call("turn.list", { uncertain: false }, bearer)),
      attempt((bearer) => call("turn.list", { uncertain: true }, bearer)),
    ])
    if ("error" in all) setState("turns", { error: all.error })
    else
      setState("turns", {
        value: all.value.rows,
        sourceErrors: all.value.sourceErrors,
        complete: all.value.complete,
        error: undefined,
      })
    if ("error" in uncertain) setState("uncertain", { error: uncertain.error })
    else setState("uncertain", { value: uncertain.value.rows, error: undefined })
  }

  async function loadTurn(turnId: string) {
    const result = await attempt((bearer) => call("turn.show", { turnId }, bearer))
    setState(
      "turnDetails",
      turnId,
      "error" in result
        ? { error: result.error }
        : { value: result.value, complete: result.value.complete, sourceErrors: result.value.sourceErrors },
    )
  }

  async function loadAgent(team: string, role: string) {
    const result = await attempt((bearer) => call("agent.show", { team, role }, bearer))
    setState("agentDetails", `${team}/${role}`, "error" in result ? { error: result.error } : { value: result.value })
  }

  // The conversation's own text, if the server serves it: the session's runs (runs.list), then each run's steps
  // (steps.list). A refusal here is a row error on the transcript; the turn events still show progress.
  async function loadTranscript(teamId: string) {
    const handle = state.conversations[teamId]?.sessionHandle
    if (!handle) return
    const runs = await attempt((bearer) => call("runs.list", { sessionHandle: handle, limit: 50 }, bearer))
    if ("error" in runs) return setState("transcripts", teamId, { error: runs.error })
    const pages = await Promise.all(
      runs.value.runs.map((run) => attempt((bearer) => call("steps.list", { runHandle: run.runHandle, limit: 200 }, bearer))),
    )
    const failed = pages.find((page) => "error" in page)
    if (failed && "error" in failed) return setState("transcripts", teamId, { error: failed.error })
    setState("transcripts", teamId, {
      value: pages.flatMap((page) => ("value" in page ? page.value.steps : [])),
      error: undefined,
    })
  }

  function saveConversations() {
    try {
      sessionStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(state.conversations))
    } catch {}
  }

  async function send(teamId: string, text: string, roleId?: string) {
    const body = text.trim()
    if (!body) return
    const existing = state.conversations[teamId]
    const message: Message = {
      key: uuid(),
      workId: existing?.messages.at(-1)?.workId ?? uuid(),
      roleId,
      text: body,
      sentAt: new Date().toISOString(),
      state: "sending",
    }
    setState(
      produce((draft) => {
        const conversation = (draft.conversations[teamId] ??= { teamId, messages: [] })
        conversation.messages.push(message)
      }),
    )
    const handle = existing?.sessionHandle
    const result = await attempt((bearer) =>
      call(
        "conversation.send",
        handle
          ? { kind: "continue", teamId, roleId, sessionHandle: handle, idempotencyKey: message.key, text: body }
          : { kind: "new", teamId, roleId, workId: message.workId, idempotencyKey: message.key, text: body },
        bearer,
      ),
    )
    if ("error" in result) {
      // No answer (network) or a source that did not answer (503): the server may have taken the message, so
      // it is asked before anything is sent again.
      const lost = result.error === "network" || result.error === "unavailable"
      setState("conversations", teamId, "messages", (item) => item.key === message.key, {
        state: lost ? "lost" : "failed",
        error: result.error,
      })
      saveConversations()
      if (lost) await reconcile(teamId, message.key)
      return
    }
    applySend(teamId, message.key, result.value)
    saveConversations()
    void loadTurns()
    void loadTranscript(teamId)
  }

  function applySend(teamId: string, key: string, response: SendResponse) {
    setState(
      produce((draft) => {
        const conversation = draft.conversations[teamId]!
        const sent = conversation.messages.find((item) => item.key === key)!
        sent.state = response.state
        sent.error = undefined
        sent.workId = response.workId
        if (response.state === "queued") sent.position = response.position
        conversation.sessionHandle = response.sessionHandle
      }),
    )
  }

  // conversation.reconcile: ask the server what became of a send by its idempotency key. Found: the message takes
  // the state the server reports. 404: the server never received it, so a resend is safe. Anything else leaves it
  // lost, and the person can ask again.
  async function reconcile(teamId: string, key: string) {
    const message = state.conversations[teamId]?.messages.find((item) => item.key === key)
    if (!message) return
    const result = await attempt((bearer) =>
      call("conversation.reconcile", { teamId, roleId: message.roleId, idempotencyKey: key }, bearer),
    )
    if ("error" in result) {
      setState("conversations", teamId, "messages", (item) => item.key === key, {
        state: result.error === "not_found" ? "not_received" : "lost",
        error: result.error,
      })
      return saveConversations()
    }
    applySend(teamId, key, result.value)
    saveConversations()
    void loadTurns()
    void loadTranscript(teamId)
  }

  // A resend after reconcile said not_received: the old bubble goes, a fresh send (new key) replaces it.
  async function resend(teamId: string, key: string) {
    const message = state.conversations[teamId]?.messages.find((item) => item.key === key)
    if (!message || message.state !== "not_received") return
    setState("conversations", teamId, "messages", (items) => items.filter((item) => item.key !== key))
    await send(teamId, message.text, message.roleId)
  }

  // A conversation this tab did not start (the desktop did, or this tab was closed): the head's newest session,
  // from sessions.list, so its text is readable here and the next message continues it.
  async function adoptSession(teamId: string) {
    if (state.conversations[teamId]) return
    const roleId = head(teamId)?.roleId
    if (!roleId) return
    const result = await attempt((bearer) => call("sessions.list", { teamId, roleId, limit: 20 }, bearer))
    if ("error" in result || state.conversations[teamId]) return
    const latest = result.value.sessions.slice().sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt))[0]
    if (!latest) return
    setState("conversations", teamId, { teamId, sessionHandle: latest.sessionHandle, messages: [] })
    saveConversations()
    void loadTranscript(teamId)
  }

  function newConversation(teamId: string) {
    setState("conversations", teamId, { teamId, messages: [] })
    setState("transcripts", teamId, {})
    saveConversations()
  }

  // The turns that answer a conversation: the team's turns on the works its messages opened.
  function conversationTurns(teamId: string) {
    const works = new Set((state.conversations[teamId]?.messages ?? []).map((message) => message.workId))
    return (state.turns.value ?? [])
      .filter((turn) => turn.team === teamId && works.has(turn.work))
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
  }

  function busy() {
    const pending = Object.values(state.conversations).some((conversation) =>
      conversation.messages.some((message) => message.state === "sending" || message.state === "queued"),
    )
    const active = (state.turns.value ?? []).some(
      (turn) => !TERMINAL.has(turn.state) && Date.now() - Date.parse(turn.receivedAt) < 30 * 60_000,
    )
    return pending || active
  }

  async function refresh() {
    void negotiate()
    await loadViewer()
    if (state.status !== "ready") return
    await Promise.all([loadAgents(), loadWorks(), loadTurns()])
    // Sends left lost by a reload are asked about before anything is shown as failed.
    Object.values(state.conversations).forEach((conversation) =>
      conversation.messages.filter((message) => message.state === "lost").forEach((message) => void reconcile(conversation.teamId, message.key)),
    )
  }

  // Poll: fast while a conversation is waiting on its head, slow otherwise. Open turn details refresh too.
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  async function tick() {
    if (stopped) return
    if (token() && state.status === "ready") {
      await Promise.all([loadTurns(), loadAgents(), loadWorks()])
      const open = Object.entries(state.turnDetails)
        .filter(([, detail]) => detail.value && (!TERMINAL.has(detail.value.turn.state) || !detail.value.complete))
        .map(([id]) => id)
      const answering = Object.keys(state.conversations).flatMap((teamId) =>
        conversationTurns(teamId).map((turn) => turn.id),
      )
      await Promise.all([...new Set([...open, ...answering])].map(loadTurn))
      await Promise.all(
        Object.values(state.conversations)
          .filter((conversation) => conversation.sessionHandle && state.transcripts[conversation.teamId]?.error !== "not_found")
          .map((conversation) => loadTranscript(conversation.teamId)),
      )
    }
    if (!stopped) timer = setTimeout(tick, busy() ? 2500 : 10_000)
  }

  void refresh().then(() => {
    timer = setTimeout(tick, 2500)
  })
  onCleanup(() => {
    stopped = true
    if (timer) clearTimeout(timer)
  })

  // ---- Derived reads for the screens --------------------------------------------------------------------------

  const teams = () => state.viewer?.teams ?? []
  const roles = (teamId: string): TreeRole[] => {
    const tree = state.trees[teamId]?.value
    return tree?.state === "running" ? tree.roles : []
  }
  const head = (teamId: string) =>
    roles(teamId).find((role) => known(role.humanFacing) === true) ?? roles(teamId).find((role) => role.tier === "head")
  const agent = (teamId: string, roleId: string) =>
    state.agents.value?.find((row) => row.team === teamId && row.role === roleId)
  const roleName = (role: TreeRole) => known(role.displayName) ?? role.roleId
  const teamTurns = (teamId: string) => (state.turns.value ?? []).filter((turn) => turn.team === teamId)

  return {
    state,
    refresh,
    loadTurn,
    loadAgent,
    loadResearch,
    loadSources,
    loadSource,
    loadMoreKeys,
    loadHeld,
    loadDoctor,
    loadStatus,
    loadLogs,
    loadWork,
    send,
    reconcile,
    resend,
    adoptSession,
    newConversation,
    conversationTurns,
    teams,
    roles,
    head,
    agent,
    roleName,
    teamTurns,
  }
}

// Walk every page of research.view.get. Each list pages from its own offset; a list already finished is asked
// from its total and anything it returns is ignored. If the view changes between pages (generatedAt or
// inputsDigest), the walk starts again, at most three times; past 40 pages it stops and says the view is capped.
async function walkResearch(teamId: string, bearer: string): Promise<ResearchView> {
  const walk = async (restarted: number): Promise<ResearchView> => {
    const first = await call("research.view.get", { teamId }, bearer, { minor: RESEARCH_MINOR })
    const stamp = freshness(first)
    const graph = first.graph.state === "available" ? { ...first.graph, nodes: [...first.graph.nodes], edges: [...first.graph.edges] } : first.graph
    const leads = first.leads.state === "available" ? { ...first.leads, rows: [...first.leads.rows] } : first.leads
    const offsets = (part: Pick<ResearchViewResponse, "graph" | "leads">) => ({
      nodesFrom: part.graph.state === "available" ? known(part.graph.nextNodes) : undefined,
      edgesFrom: part.graph.state === "available" ? known(part.graph.nextEdges) : undefined,
      leadsFrom: part.leads.state === "available" ? known(part.leads.next) : undefined,
    })
    const pages = { count: 1, next: offsets({ graph, leads }) }
    while (pages.next.nodesFrom !== undefined || pages.next.edgesFrom !== undefined || pages.next.leadsFrom !== undefined) {
      if (pages.count >= 40) return { graph, leads, summary: first.summary, pages: pages.count, restarted, capped: true }
      const asked = pages.next
      const page = await call(
        "research.view.get",
        {
          teamId,
          nodesFrom: asked.nodesFrom ?? (graph.state === "available" ? graph.totalNodes : 0),
          edgesFrom: asked.edgesFrom ?? (graph.state === "available" ? graph.totalEdges : 0),
          leadsFrom: asked.leadsFrom ?? (leads.state === "available" ? leads.totalRows : 0),
        },
        bearer,
        { minor: RESEARCH_MINOR },
      )
      pages.count++
      if (freshness(page) !== stamp || page.graph.state !== graph.state || page.leads.state !== leads.state) {
        if (restarted >= 3) throw new BoltrigApiError("research.view.get", "unavailable", 0, "changing", "The view kept changing.")
        return walk(restarted + 1)
      }
      if (page.graph.state === "available" && graph.state === "available") {
        if (asked.nodesFrom !== undefined) graph.nodes.push(...page.graph.nodes)
        if (asked.edgesFrom !== undefined) graph.edges.push(...page.graph.edges)
        graph.skipped = Math.max(graph.skipped, page.graph.skipped)
      }
      if (page.leads.state === "available" && leads.state === "available" && asked.leadsFrom !== undefined)
        leads.rows.push(...page.leads.rows)
      const after = offsets(page)
      pages.next = {
        nodesFrom: asked.nodesFrom === undefined ? undefined : after.nodesFrom,
        edgesFrom: asked.edgesFrom === undefined ? undefined : after.edgesFrom,
        leadsFrom: asked.leadsFrom === undefined ? undefined : after.leadsFrom,
      }
    }
    return { graph, leads, summary: first.summary, pages: pages.count, restarted, capped: false }
  }
  return walk(0)
}

function freshness(response: ResearchViewResponse) {
  return `${known(response.summary.generatedAt) ?? "-"}|${known(response.summary.inputsDigest) ?? "-"}`
}

export type BoltrigData = ReturnType<typeof createBoltrigData>

export const BoltrigDataContext = createContext<BoltrigData>()

export function useBoltrig() {
  const data = useContext(BoltrigDataContext)
  if (!data) throw new Error("useBoltrig outside BoltrigDataContext")
  return data
}

// A live agent is one whose container is up and whose runtime answers; anything else is drawn as a ring.
export function isLive(row: AgentRow | undefined) {
  return !!row && row.runtimeAvailability === "available" && known(row.containerState) === "running"
}

export function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}
