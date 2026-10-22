// The Boltrig shell's model: a person, their double, the three modes, and the worlds they belong to.
// Mock data until the Boltrig server exposes these; names follow lineage/agents and FOUNDATION §1.

export type ModeID = "learning" | "doing" | "interfacing"

export type Mode = {
  id: ModeID
  label: string
  icon: string
  hint: string
}

export type Agent = {
  id: string
  name: string
  live: boolean
  head?: boolean
}

export type Team = {
  id: string
  name: string
  key: string
  agents: Agent[]
}

export type World = {
  id: string
  name: string
  teams: Team[]
}

export type ModeSummary = {
  mode: ModeID
  text: string
  owner: string
  needsYou?: boolean
}

export type Person = {
  name: string
  initial: string
  double: Agent
  team: Agent[]
}

export const modes: Mode[] = [
  { id: "learning", label: "Learning", icon: "graduation-cap", hint: "RES" },
  { id: "doing", label: "Doing", icon: "circle-check", hint: "REQ · DEL" },
  { id: "interfacing", label: "Interfacing", icon: "speech-bubble", hint: "your tools" },
]

export const person: Person = {
  name: "Will",
  initial: "W",
  double: { id: "maya", name: "Maya", live: true, head: true },
  team: [
    { id: "jarvis", name: "Jarvis", live: true },
    { id: "companion", name: "Companion", live: true },
  ],
}

export const worlds: World[] = [
  {
    id: "balmoral",
    name: "Balmoral & Co",
    teams: [
      {
        id: "research",
        name: "Research",
        key: "RES",
        agents: [
          { id: "head-of-research", name: "Head of Research", live: true, head: true },
          { id: "scout", name: "Scout", live: false },
          { id: "extractor", name: "Extractor", live: false },
          { id: "resolver", name: "Resolver", live: false },
          { id: "verifier", name: "Verifier", live: false },
          { id: "cartographer", name: "Cartographer", live: false },
        ],
      },
      {
        id: "delivery",
        name: "Delivery",
        key: "DEL",
        agents: [{ id: "head-of-delivery", name: "Head of Delivery", live: true, head: true }],
      },
      { id: "commercial", name: "Commercial", key: "COM", agents: [] },
    ],
  },
]

export const summaries: ModeSummary[] = [
  { mode: "learning", text: "RES-61 found its gap: San Francisco 1997–2023, no bridges yet", owner: "Research" },
  { mode: "doing", text: "Seven gateway tools in backlog; Flue is the default runtime", owner: "Delivery" },
  { mode: "interfacing", text: "A drafted reply is waiting for your approval", owner: "Outlook", needsYou: true },
]

export const connectors = ["Outlook", "Granola"]

export function modeOf(id: ModeID) {
  return modes.find((mode) => mode.id === id)!
}
