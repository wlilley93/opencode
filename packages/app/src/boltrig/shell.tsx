import { Icon } from "@opencode/ui/icon"
import { createEffect, createSignal, For, lazy, Match, onCleanup, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { session } from "./auth"
import { compact, followVisualViewport } from "./layout"
import { TurnBlock } from "./conversation"
import { BoltrigHome } from "./home"
import { BoltrigLearning } from "./learning"
import { BoltrigDataContext, createBoltrigData, useBoltrig } from "./model"
import { RowError } from "./parts"
import { BoltrigSidebar, type BoltrigSelection } from "./sidebar"
import { BoltrigSignIn } from "./signin"
import { BoltrigStatus } from "./status"
import { BoltrigTeam } from "./team"

const BoltrigDoing = lazy(() => import("./doing").then((module) => ({ default: module.BoltrigDoing })))
const BoltrigInterfacing = lazy(() => import("./interfacing").then((module) => ({ default: module.BoltrigInterfacing })))

function useTitle(selection: () => BoltrigSelection) {
  const data = useBoltrig()
  const language = useLanguage()
  return () => {
    const current = selection()
    if (current.kind === "home") return { name: language.t("boltrig.double.name"), meta: language.t("boltrig.double.meta") }
    if (current.kind === "status") return { name: language.t("boltrig.status.title"), meta: language.t("boltrig.status.meta") }
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
      <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] py-6 max-[700px]:max-w-[calc(100%-24px)]">
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
      <Match when={props.selection.kind === "status"}>
        <BoltrigStatus />
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
  const data = useBoltrig()
  const language = useLanguage()
  const [drawer, setDrawer] = createSignal(false)
  const select = (selection: BoltrigSelection) => {
    props.onSelect(selection)
    setDrawer(false)
  }
  // A drawer left open must not survive the window growing past the breakpoint.
  createEffect(() => {
    if (!compact()) setDrawer(false)
  })
  const escape = (event: KeyboardEvent) => event.key === "Escape" && setDrawer(false)
  document.addEventListener("keydown", escape)
  onCleanup(() => document.removeEventListener("keydown", escape))

  return (
    <div
      data-slot="boltrig-shell"
      class="flex h-full min-h-0 w-full bg-v2-background-bg-deep text-[13px] max-[700px]:ps-[env(safe-area-inset-left)] max-[700px]:pe-[env(safe-area-inset-right)]"
    >
      <Show when={compact()} fallback={<BoltrigSidebar selection={props.selection} onSelect={select} />}>
        <div
          data-slot="boltrig-drawer"
          data-open={drawer() ? "" : undefined}
          class="invisible fixed inset-0 z-40 transition-[visibility] duration-200 data-[open]:visible"
        >
          <button
            type="button"
            aria-label={language.t("boltrig.menu.close")}
            tabindex={drawer() ? 0 : -1}
            onClick={() => setDrawer(false)}
            class={`absolute inset-0 bg-black/55 transition-opacity duration-200 ${drawer() ? "opacity-100" : "opacity-0"}`}
          />
          <div
            class={`absolute inset-y-0 start-0 flex w-[min(300px,86vw)] flex-col border-e border-v2-border-border-base bg-v2-background-bg-deep pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-left)] transition-transform duration-200 ${
              drawer() ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <BoltrigSidebar drawer selection={props.selection} onSelect={select} />
          </div>
        </div>
      </Show>
      <main class="my-2 me-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base max-[700px]:m-0 max-[700px]:rounded-none max-[700px]:border-0 max-[700px]:pb-[env(safe-area-inset-bottom)]">
        <div class="flex min-h-11 shrink-0 items-center gap-2 border-b border-v2-border-border-base ps-4 pe-3 max-[700px]:min-h-14 max-[700px]:ps-1 max-[700px]:pt-[env(safe-area-inset-top)]">
          <Show when={compact()}>
            <button
              type="button"
              data-slot="boltrig-menu"
              aria-label={language.t("boltrig.menu.open")}
              aria-expanded={drawer()}
              onClick={() => setDrawer(true)}
              class="relative grid size-11 shrink-0 place-items-center rounded-lg text-v2-text-text-muted hover:bg-v2-overlay-simple-overlay-hover"
            >
              <Icon name="menu" />
              <Show when={(data.state.uncertain.value?.length ?? 0) > 0}>
                <span class="absolute end-2.5 top-2.5 size-1.5 rounded-full bg-v2-text-text-accent" />
              </Show>
            </button>
          </Show>
          <span class="shrink-0 font-medium text-v2-text-text-base">{title().name}</span>
          <span class="min-w-0 truncate text-v2-text-text-faint">{title().meta}</span>
        </div>
        <div class="flex min-h-0 flex-1 flex-col">
          <Body selection={props.selection} onSelect={props.onSelect} />
        </div>
      </main>
    </div>
  )
}

export function BoltrigRoute() {
  onCleanup(followVisualViewport())
  return (
    <div class="flex w-full" style={{ height: "var(--boltrig-vh, 100dvh)" }}>
      {/* Keyed on the session: signing in builds a fresh model, signing out drops it. */}
      <Show when={session()} keyed fallback={<BoltrigSignIn />}>
        <BoltrigShell />
      </Show>
    </div>
  )
}
