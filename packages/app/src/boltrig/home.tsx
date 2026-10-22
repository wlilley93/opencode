import { Icon } from "@opencode/ui/icon"
import { For, Show } from "solid-js"
import { BoltrigComposer } from "./composer"
import { connectors, modeOf, person, summaries } from "./model"

// Home is the person's double: the one agent they talk to, with what is moving across the three modes.
export function BoltrigHome() {
  const waiting = () => summaries.filter((item) => item.needsYou).length

  return (
    <div data-slot="boltrig-home" class="flex flex-1 flex-col items-center pt-[150px]">
      <div class="mb-3.5 grid size-11 place-items-center rounded-xl bg-v2-background-bg-layer-03 text-[19px] font-semibold text-v2-text-text-base">
        {person.double.name[0]}
      </div>
      <div class="mb-1 text-xl font-medium text-v2-text-text-base">Morning, {person.name}.</div>
      <div class="mb-5.5 text-v2-text-text-faint">
        {waiting() === 1 ? "One thing needs you." : `${waiting()} things need you.`} Everything else is moving.
      </div>
      <div class="w-[640px] max-w-[calc(100%-48px)]">
        <BoltrigComposer
          placeholder={`Ask ${person.double.name}…`}
          lane="Lane: front door"
          meter="Personal world · 3% context"
        />
        <div class="px-2.5 pt-1 pb-1 text-xs text-v2-text-text-faint">Across the three modes</div>
        <div class="mt-1">
          <For each={summaries}>
            {(item) => (
              <div class="flex h-[34px] items-center gap-2.5 rounded-[7px] px-2.5 text-v2-text-text-muted">
                <span class="flex w-[92px] shrink-0 items-center gap-1 text-xs text-v2-text-text-faint">
                  <Icon name={modeOf(item.mode).icon} size="small" />
                  {modeOf(item.mode).label}
                </span>
                <span class="truncate text-v2-text-text-base">{item.text}</span>
                <Show when={item.needsYou}>
                  <span class="size-1.5 shrink-0 rounded-full bg-v2-text-text-accent" />
                </Show>
                <span class="ms-auto shrink-0 text-xs text-v2-text-text-faint">{item.owner}</span>
              </div>
            )}
          </For>
        </div>
        <div class="my-3 h-px bg-v2-border-border-base" />
        <div class="flex items-center gap-2 px-2.5 text-xs text-v2-text-text-faint">
          Interfacing runs in the tools you already use
          <span class="ms-auto flex gap-1.5">
            <For each={connectors}>
              {(name) => (
                <span class="rounded-full border border-v2-border-border-strong px-2 py-px text-v2-text-text-muted">
                  {name}
                </span>
              )}
            </For>
            <span class="inline-flex items-center gap-1 rounded-full border border-v2-border-border-strong px-2 py-px text-v2-text-text-muted">
              <Icon name="plus-small" size="small" />
              Connect
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
