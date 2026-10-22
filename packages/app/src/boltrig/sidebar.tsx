import { Icon } from "@opencode/ui/icon"
import { createSignal, For, Show, type JSX } from "solid-js"
import { modes, person, worlds, type ModeID, type Team } from "./model"

export type BoltrigSelection = { kind: "home" } | { kind: "mode"; mode: ModeID } | { kind: "agent"; id: string }

function Tile(props: { children: JSX.Element }) {
  return (
    <span class="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-v2-background-bg-layer-03 text-[10px] leading-none font-semibold text-v2-text-text-base">
      {props.children}
    </span>
  )
}

function Row(props: {
  selected?: boolean
  dim?: boolean
  indent?: boolean
  onClick?: () => void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      data-slot="boltrig-nav-row"
      data-selected={props.selected ? "" : undefined}
      onClick={() => props.onClick?.()}
      class={`
        flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] whitespace-nowrap
        ${props.indent ? "ps-[30px]" : ""}
        ${props.selected ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base" : props.dim ? "text-v2-text-text-faint" : "text-v2-text-text-muted"}
        hover:bg-v2-overlay-simple-overlay-hover
      `}
    >
      {props.children}
    </button>
  )
}

function Group(props: { children: JSX.Element }) {
  return (
    <div class="mt-3.5 flex h-[26px] items-center gap-1 px-2 text-xs text-v2-text-text-faint">{props.children}</div>
  )
}

function TeamRows(props: { team: Team; selection: BoltrigSelection; onSelect: (selection: BoltrigSelection) => void }) {
  const [open, setOpen] = createSignal(props.team.id === "research")

  return (
    <>
      <Row onClick={() => setOpen(!open())}>
        <Icon name={open() ? "chevron-down" : "chevron-right"} size="small" class="text-v2-icon-icon-muted" />
        <Tile>{props.team.name[0]}</Tile>
        {props.team.name}
      </Row>
      <Show when={open()}>
        <For each={props.team.agents}>
          {(agent) => (
            <Row
              indent
              dim={!agent.live}
              selected={props.selection.kind === "agent" && props.selection.id === agent.id}
              onClick={() => props.onSelect({ kind: "agent", id: agent.id })}
            >
              {agent.name}
              {/* A filled dot is a running agent; a ring is a drafted profile that is not running yet. */}
              <span
                class={`ms-auto size-1.5 rounded-full ${agent.live ? "bg-v2-text-text-muted" : "border border-v2-border-border-strong"}`}
              />
            </Row>
          )}
        </For>
      </Show>
    </>
  )
}

export function BoltrigSidebar(props: {
  selection: BoltrigSelection
  onSelect: (selection: BoltrigSelection) => void
}) {
  const modeSelected = (mode: ModeID) => props.selection.kind === "mode" && props.selection.mode === mode

  return (
    <aside
      data-slot="boltrig-sidebar"
      class="flex w-[244px] shrink-0 flex-col py-2.5 ps-2.5 pe-2 text-v2-text-text-muted"
    >
      <div class="flex h-8 items-center gap-2 px-1.5 font-medium text-v2-text-text-base">
        <Tile>{person.initial}</Tile>
        {person.name}
        <Icon name="chevron-down" size="small" class="text-v2-icon-icon-muted" />
        <span class="ms-auto flex gap-0.5 text-v2-icon-icon-muted">
          <Icon name="magnifying-glass" />
          <Icon name="new-session" />
        </span>
      </div>
      <div class="h-2" />
      <Row selected={props.selection.kind === "home"} onClick={() => props.onSelect({ kind: "home" })}>
        <Tile>{person.double.name[0]}</Tile>
        {person.double.name}
        <span class="ms-auto text-[11.5px] text-v2-text-text-faint">your double</span>
      </Row>
      <Row>
        <Icon name="archive" class="text-v2-icon-icon-muted" />
        Inbox
        <span class="ms-auto size-1.5 rounded-full bg-v2-text-text-accent" />
      </Row>

      <Group>Modes</Group>
      <For each={modes}>
        {(mode) => (
          <Row selected={modeSelected(mode.id)} onClick={() => props.onSelect({ kind: "mode", mode: mode.id })}>
            <Icon name={mode.icon} class="text-v2-icon-icon-muted" />
            {mode.label}
            <span class="ms-auto text-[11.5px] text-v2-text-text-faint">{mode.hint}</span>
          </Row>
        )}
      </For>

      <Group>
        {person.double.name}'s team
        <Icon name="chevron-down" size="small" />
      </Group>
      <For each={person.team}>
        {(agent) => (
          <Row
            selected={props.selection.kind === "agent" && props.selection.id === agent.id}
            onClick={() => props.onSelect({ kind: "agent", id: agent.id })}
          >
            <Tile>{agent.name[0]}</Tile>
            {agent.name}
          </Row>
        )}
      </For>
      <Row dim>
        <Icon name="plus-small" />
        Add an agent
      </Row>

      <For each={worlds}>
        {(world) => (
          <>
            <Group>
              {world.name}
              <Icon name="chevron-down" size="small" />
            </Group>
            <For each={world.teams}>
              {(team) => <TeamRows team={team} selection={props.selection} onSelect={props.onSelect} />}
            </For>
          </>
        )}
      </For>

      <div class="mt-auto">
        <Row>
          <Icon name="monitor" class="text-v2-icon-icon-muted" />
          Connect a server
        </Row>
      </div>
    </aside>
  )
}
