import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import "./placeholder.css"

const turns = [
  { prompt: "38%", lines: ["92%", "86%", "64%"] },
  { prompt: "24%", lines: ["88%", "94%", "90%", "48%"] },
]

// Where the opened session's newest turns will paint while its transcript loads. It stays until the timeline shows
// those rows, then fades out over them. A session whose transcript is already here never shows it.
export function TimelinePlaceholder(props: { identity: string; waiting: boolean; shown: boolean; centered: boolean }) {
  const open = createMemo<{ identity: string; open: boolean }>((previous) => ({
    identity: props.identity,
    open: props.waiting || (previous?.identity === props.identity && previous.open && !props.shown),
  }))
  const loading = () => open().open
  const [present, setPresent] = createSignal(loading())

  createEffect(() => {
    if (loading()) {
      setPresent(true)

      return
    }

    const timer = setTimeout(() => setPresent(false), 160)
    onCleanup(() => clearTimeout(timer))
  })

  return (
    <Show when={present()}>
      <div
        data-component="session-timeline-placeholder"
        data-state={loading() ? "open" : "closed"}
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-6 pb-16"
      >
        <For each={turns}>
          {(turn) => (
            <div
              class="flex min-w-0 w-full flex-col gap-4 px-4 md:px-6"
              classList={{ "md:max-w-session md:mx-auto": props.centered }}
            >
              <div class="ms-auto h-9 rounded-[12px] bg-v2-background-bg-deep" style={{ width: turn.prompt }} />
              <div class="flex flex-col gap-2.5">
                <For each={turn.lines}>
                  {(width) => <div class="h-2.5 rounded-full bg-v2-background-bg-deep" style={{ width }} />}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
