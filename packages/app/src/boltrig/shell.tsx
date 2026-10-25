import { createSignal, For, lazy, Match, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { session } from "./auth"
import { TurnBlock } from "./conversation"
import { BoltrigHome } from "./home"
import { BoltrigLearning } from "./learning"
import { BoltrigDataContext, createBoltrigData, useBoltrig } from "./model"
import { RowError } from "./parts"
import { BoltrigSidebar, type BoltrigSelection } from "./sidebar"
import { BoltrigSignIn } from "./signin"
import { BoltrigTeam } from "./team"

const BoltrigDoing = lazy(() => import("./doing").then((module) => ({ default: module.BoltrigDoing })))
const BoltrigInterfacing = lazy(() => import("./interfacing").then((module) => ({ default: module.BoltrigInterfacing })))

function useTitle(selection: () => BoltrigSelection) {
  const data = useBoltrig()
  const language = useLanguage()
  return () => {
    const current = selection()
    if (current.kind === "home") return { name: language.t("boltrig.double.name"), meta: language.t("boltrig.double.meta") }
    if (current.kind === "inbox") return { name: language.t("boltrig.inbox"), meta: language.t("boltrig.inbox.meta") }
    if (current.kind === "mode")
      return { name: language.t(`boltrig.mode.${current.mode}`), meta: language.t(`boltrig.mode.${current.mode}.meta`) }
    const team = data.teams().find((item) => item.teamId === current.teamId)
    return { name: team?.displayName ?? current.teamId, meta: language.t("boltrig.team.meta") }
  }
}

// Turns the server marks uncertain: the ones that need the person to look.
function BoltrigInbox() {
  const data = useBoltrig()
  const language = useLanguage()
  return (
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] py-6">
        <Show when={data.state.uncertain.error}>{(kind) => <RowError kind={kind()} />}</Show>
        <For
          each={data.state.uncertain.value ?? []}
          fallback={<div class="py-8 text-center text-v2-text-text-faint">{language.t("boltrig.inbox.empty")}</div>}
        >
          {(turn) => <TurnBlock turn={turn} name={`${turn.team}/${turn.role}`} open={false} />}
        </For>
      </div>
    </div>
  )
}

function Body(props: { selection: BoltrigSelection; onSelect: (selection: BoltrigSelection) => void }) {
  const data = useBoltrig()
  const language = useLanguage()
  return (
    <Switch>
      <Match when={data.state.status === "loading"}>
        <div class="flex flex-1 items-center justify-center text-v2-text-text-faint">{language.t("boltrig.loading")}</div>
      </Match>
      <Match when={data.state.status === "not_a_member"}>
        <div class="flex flex-1 items-center justify-center text-v2-text-text-faint">{language.t("boltrig.notAMember")}</div>
      </Match>
      <Match when={data.state.status === "error"}>
        <div class="flex flex-1 flex-col items-center justify-center gap-2 text-v2-text-text-faint">
          <RowError kind={data.state.error ?? "network"} />
          <button type="button" class="underline" onClick={() => void data.refresh()}>
            {language.t("boltrig.retry")}
          </button>
        </div>
      </Match>
      <Match when={props.selection.kind === "home"}>
        <BoltrigHome onSelect={props.onSelect} />
      </Match>
      <Match when={props.selection.kind === "inbox"}>
        <BoltrigInbox />
      </Match>
      <Match when={props.selection.kind === "mode" && props.selection.mode === "learning"}>
        <BoltrigLearning />
      </Match>
      <Match when={props.selection.kind === "mode" && props.selection.mode === "doing"}>
        <BoltrigDoing onSelect={props.onSelect} />
      </Match>
      <Match when={props.selection.kind === "mode" && props.selection.mode === "interfacing"}>
        <BoltrigInterfacing />
      </Match>
      <Match when={props.selection.kind === "team" && props.selection}>
        {(selection) => {
          const team = selection() as Extract<BoltrigSelection, { kind: "team" }>
          return <BoltrigTeam teamId={team.teamId} roleId={team.roleId} talk={team.talk} onSelect={props.onSelect} />
        }}
      </Match>
    </Switch>
  )
}

// The Boltrig shell: the sidebar on the window chrome, and one working panel with a hairline border.
export function BoltrigShell(props: { initial?: BoltrigSelection }) {
  const data = createBoltrigData()
  const [selection, setSelection] = createSignal<BoltrigSelection>(props.initial ?? { kind: "home" })

  return (
    <BoltrigDataContext.Provider value={data}>
      <ShellFrame selection={selection()} onSelect={setSelection} />
    </BoltrigDataContext.Provider>
  )
}

function ShellFrame(props: { selection: BoltrigSelection; onSelect: (selection: BoltrigSelection) => void }) {
  const title = useTitle(() => props.selection)
  return (
    <div data-slot="boltrig-shell" class="flex h-full min-h-0 w-full bg-v2-background-bg-deep text-[13px]">
      <BoltrigSidebar selection={props.selection} onSelect={props.onSelect} />
      <main class="my-2 me-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base">
        <div class="flex h-11 shrink-0 items-center gap-2 border-b border-v2-border-border-base ps-4 pe-3">
          <span class="font-medium text-v2-text-text-base">{title().name}</span>
          <span class="truncate text-v2-text-text-faint">{title().meta}</span>
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          <Body selection={props.selection} onSelect={props.onSelect} />
        </div>
      </main>
    </div>
  )
}

export function BoltrigRoute() {
  return (
    <div class="flex h-dvh w-full">
      {/* Keyed on the session: signing in builds a fresh model, signing out drops it. */}
      <Show when={session()} keyed fallback={<BoltrigSignIn />}>
        <BoltrigShell />
      </Show>
    </div>
  )
}
