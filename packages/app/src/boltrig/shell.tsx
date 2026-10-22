import { Icon } from "@opencode/ui/icon"
import { createSignal, Match, Switch } from "solid-js"
import { BoltrigHome } from "./home"
import { modeOf, person } from "./model"
import { BoltrigSidebar, type BoltrigSelection } from "./sidebar"

function title(selection: BoltrigSelection) {
  if (selection.kind === "home") return { name: person.double.name, meta: "your double" }
  if (selection.kind === "mode") return { name: modeOf(selection.mode).label, meta: "" }
  return { name: selection.id, meta: "" }
}

// The Boltrig shell: the sidebar on the window chrome, and one working panel with a hairline border.
export function BoltrigShell(props: { initial?: BoltrigSelection }) {
  const [selection, setSelection] = createSignal<BoltrigSelection>(props.initial ?? { kind: "home" })

  return (
    <div data-slot="boltrig-shell" class="flex h-full min-h-0 w-full bg-v2-background-bg-deep text-[13px]">
      <BoltrigSidebar selection={selection()} onSelect={setSelection} />
      <main class="my-2 me-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-base">
        <div class="flex h-11 shrink-0 items-center gap-2 border-b border-v2-border-border-base ps-4 pe-3">
          <span class="flex items-center gap-1 font-medium text-v2-text-text-base">
            {title(selection()).name}
            <Icon name="chevron-down" size="small" class="text-v2-icon-icon-muted" />
          </span>
          <span class="text-v2-text-text-faint">{title(selection()).meta}</span>
          <Icon name="layout-right" class="ms-auto text-v2-icon-icon-muted" />
        </div>
        <Switch
          fallback={<div class="flex flex-1 items-center justify-center text-v2-text-text-faint">Not built yet</div>}
        >
          <Match when={selection().kind === "home"}>
            <BoltrigHome />
          </Match>
        </Switch>
      </main>
    </div>
  )
}

export function BoltrigRoute() {
  return (
    <div class="flex h-dvh w-full">
      <BoltrigShell />
    </div>
  )
}
