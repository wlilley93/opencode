import { Icon } from "@opencode/ui/icon"
import { createSignal, For } from "solid-js"

const permissions = ["Ask", "Plan", "Auto"] as const

// The one-line composer, in OpenCode's shape: permission mode above, lane and effort beside the input, a meter below.
export function BoltrigComposer(props: {
  placeholder: string
  lane: string
  meter: string
  mode?: (typeof permissions)[number]
}) {
  const [mode, setMode] = createSignal(props.mode ?? "Ask")

  return (
    <div data-slot="boltrig-composer" class="w-full">
      <div class="mb-2 inline-flex gap-0.5 rounded-[7px] border border-v2-border-border-base bg-v2-background-bg-layer-01 p-0.5">
        <For each={permissions}>
          {(item) => (
            <button
              type="button"
              onClick={() => setMode(item)}
              class={`rounded-[5px] px-2.5 py-0.5 text-[12.5px] ${
                mode() === item
                  ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base"
                  : "text-v2-text-text-muted"
              }`}
            >
              {item}
            </button>
          )}
        </For>
      </div>
      <div class="rounded-[10px] border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-3 pt-3 pb-2">
        <textarea
          rows={1}
          placeholder={props.placeholder}
          class="h-[30px] w-full resize-none bg-transparent text-[13px] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
        />
        <div class="flex items-center gap-3.5 text-[12.5px] text-v2-text-text-muted">
          <Icon name="plus" />
          <span class="inline-flex items-center gap-1">
            {props.lane}
            <Icon name="chevron-down" size="small" />
          </span>
          <span class="inline-flex items-center gap-1">
            High
            <Icon name="chevron-down" size="small" />
          </span>
          <Icon name="waveform" class="ms-auto" />
          <button
            type="button"
            aria-label="Send"
            class="grid size-[26px] place-items-center rounded-[7px] bg-v2-text-text-accent text-v2-background-bg-base"
          >
            <Icon name="arrow-up" size="small" />
          </button>
        </div>
      </div>
      <div class="flex justify-end px-0.5 pt-1.5 text-[11.5px] text-v2-text-text-faint">{props.meter}</div>
    </div>
  )
}
