// The Boltrig shell's model, read live from the Client API: the viewer, their teams (tree.get) and agents
// (agents.list), their works (work.list) and turns (turn.list, turn.show), and the conversations they start
// with a team's head (conversation.send). Polled; the contract has no stream yet (stream.read is not implemented).

import { createContext, onCleanup, useContext } from "solid-js"
import { createStore, produce } from "solid-js/store"
import {
  BoltrigApiError,
  call,
  known,
  type AgentDetail,
  type AgentRow,
  type ApiErrorKind,
  type InboxState,
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
  state: "sending" | SendResponse["state"] | "failed"
  position?: number
  error?: ApiErrorKind
}

export type Conversation = { teamId: string; sessionHandle?: string; messages: Message[] }

type Loadable<T> = { value?: T; error?: ApiErrorKind; sourceErrors?: SourceError[]; complete?: boolean }

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
  observedAt?: string
}

const CONVERSATIONS_KEY = "boltrig.conversations"

function readConversations(): Record<string, Conversation> {
  try {
    return JSON.parse(sessionStorage.getItem(CONVERSATIONS_KEY) ?? "{}") as Record<string, Conversation>
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
    setState(
      produce((draft) => {
        const conversation = draft.conversations[teamId]!
        const sent = conversation.messages.find((item) => item.key === message.key)!
        if ("error" in result) {
          sent.state = "failed"
          sent.error = result.error
          return
        }
        sent.state = result.value.state
        sent.workId = result.value.workId
        if (result.value.state === "queued") sent.position = result.value.position
        conversation.sessionHandle = result.value.sessionHandle
      }),
    )
    saveConversations()
    void loadTurns()
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
    await loadViewer()
    if (state.status !== "ready") return
    await Promise.all([loadAgents(), loadWorks(), loadTurns()])
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
    send,
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
