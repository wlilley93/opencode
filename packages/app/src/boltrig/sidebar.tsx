import { Icon } from "@opencode/ui/icon"
import { createSignal, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { signOut } from "./auth"
import { initialOf, isLive, modes, useBoltrig, type ModeID } from "./model"
import { Dot, RowError, Tile } from "./parts"

export type BoltrigSelection =
  | { kind: "home" }
  | { kind: "inbox" }
  | { kind: "mode"; mode: ModeID }
  | { kind: "team"; teamId: string; roleId?: string; talk?: boolean }

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
        flex h-7 w-full shrink-0 items-center gap-2.5 rounded-md px-2 text-left text-[13px] whitespace-nowrap
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
    <div class="mt-3.5 flex h-[26px] shrink-0 items-center gap-1 px-2 text-xs text-v2-text-text-faint">
      {props.children}
    </div>
  )
}

function TeamRows(props: {
  teamId: string
  name: string
  selection: BoltrigSelection
  onSelect: (selection: BoltrigSelection) => void
}) {
  const data = useBoltrig()
  const language = useLanguage()
  const [open, setOpen] = createSignal(props.teamId === "research")
  const tree = () => data.state.trees[props.teamId]
  const selected = (roleId?: string) =>
    props.selection.kind === "team" && props.selection.teamId === props.teamId && props.selection.roleId === roleId

  return (
    <>
      <Row
        selected={selected(undefined)}
        dim={tree()?.value?.state === "not_running"}
        onClick={() => {
          setOpen(!open() || !selected(undefined))
          props.onSelect({ kind: "team", teamId: props.teamId })
        }}
      >
        <Icon name={open() ? "chevron-down" : "chevron-right"} size="small" class="text-v2-icon-icon-muted" />
        <Tile>{initialOf(props.name)}</Tile>
        {props.name}
        <Show when={tree()?.value?.state === "not_running"}>
          <span class="ms-auto text-[11.5px] text-v2-text-text-faint">{language.t("boltrig.team.stopped")}</span>
        </Show>
      </Row>
      <Show when={open()}>
        <Show when={tree()?.error}>{(kind) => <RowError kind={kind()} />}</Show>
        <For each={data.roles(props.teamId)}>
          {(role) => {
            const row = () => data.agent(props.teamId, role.roleId)
            return (
              <Row
                indent
                dim={!isLive(row())}
                selected={selected(role.roleId)}
                onClick={() => props.onSelect({ kind: "team", teamId: props.teamId, roleId: role.roleId })}
              >
                <span class="truncate">{data.roleName(role)}</span>
                <span class="ms-auto flex items-center">
                  <Dot live={isLive(row())} needsYou={row()?.executionStatus === "blocked"} />
                </span>
              </Row>
            )
          }}
        </For>
      </Show>
    </>
  )
}

export function BoltrigSidebar(props: {
  selection: BoltrigSelection
  onSelect: (selection: BoltrigSelection) => void
}) {
  const data = useBoltrig()
  const language = useLanguage()
  const modeSelected = (mode: ModeID) => props.selection.kind === "mode" && props.selection.mode === mode
  const person = () => data.state.viewer?.person.displayName ?? ""
  const waiting = () => data.state.uncertain.value?.length ?? 0

  return (
    <aside
      data-slot="boltrig-sidebar"
      class="flex w-[244px] shrink-0 flex-col overflow-y-auto py-2.5 ps-2.5 pe-2 text-v2-text-text-muted"
    >
      <div class="flex h-8 shrink-0 items-center gap-2 px-1.5 font-medium text-v2-text-text-base">
        <Tile>{initialOf(person())}</Tile>
        <span class="truncate">{person()}</span>
        <button
          type="button"
          class="ms-auto rounded px-1 text-xs font-normal text-v2-text-text-faint hover:text-v2-text-text-muted"
          onClick={() => signOut()}
        >
          {language.t("boltrig.signout")}
        </button>
      </div>
      <div class="h-2 shrink-0" />
      <Row selected={props.selection.kind === "home"} onClick={() => props.onSelect({ kind: "home" })}>
        <Tile>{language.t("boltrig.double.initial")}</Tile>
        {language.t("boltrig.double.name")}
      </Row>
      <Row selected={props.selection.kind === "inbox"} onClick={() => props.onSelect({ kind: "inbox" })}>
        <Icon name="archive" class="text-v2-icon-icon-muted" />
        {language.t("boltrig.inbox")}
        <Show when={waiting() > 0}>
          <span class="ms-auto flex items-center gap-1.5 text-[11.5px] text-v2-text-text-faint">
            {waiting()}
            <Dot needsYou />
          </span>
        </Show>
      </Row>

      <Group>{language.t("boltrig.modes")}</Group>
      <For each={modes}>
        {(mode) => (
          <Row selected={modeSelected(mode.id)} onClick={() => props.onSelect({ kind: "mode", mode: mode.id })}>
            <Icon name={mode.icon} class="text-v2-icon-icon-muted" />
            {language.t(`boltrig.mode.${mode.id}`)}
            <span class="ms-auto text-[11.5px] text-v2-text-text-faint">
              {language.t(`boltrig.mode.${mode.id}.hint`)}
            </span>
          </Row>
        )}
      </For>

      <Group>{language.t("boltrig.yourTeam")}</Group>
      <Row dim>
        <Icon name="plus" size="small" />
        {language.t("boltrig.addAgent")}
      </Row>

      <Group>{language.t("boltrig.teams")}</Group>
      <For each={data.teams()}>
        {(team) => (
          <TeamRows teamId={team.teamId} name={team.displayName} selection={props.selection} onSelect={props.onSelect} />
        )}
      </For>

      <div class="mt-auto shrink-0 pt-3">
        <div class="flex h-7 items-center gap-2.5 px-2 text-[11.5px] text-v2-text-text-faint">
          <Icon name="monitor" class="text-v2-icon-icon-muted" />
          <span class="truncate">{language.t("boltrig.server", { minor: data.state.minor ?? "…" })}</span>
        </div>
      </div>
    </aside>
  )
}
