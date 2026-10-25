import { Icon } from "@opencode/ui/icon"
import { createStore } from "solid-js/store"
import { Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"

// The composer, in OpenCode's shape: the box with a placeholder, a row under it with who it reaches and the send
// button, and a meter line below. Ask / Plan / Auto and effort are left out until the contract carries a mode:
// a control that changes nothing on the server would be a lie.
export function BoltrigComposer(props: {
  placeholder: string
  target: string
  meter: string
  disabled?: boolean
  disabledReason?: string
  onSend: (text: string) => Promise<void> | void
}) {
  const language = useLanguage()
  const [draft, setDraft] = createStore({ text: "", sending: false })

  const submit = async () => {
    const text = draft.text.trim()
    if (!text || draft.sending || props.disabled) return
    setDraft({ sending: true })
    try {
      await props.onSend(text)
      setDraft({ text: "" })
    } finally {
      setDraft({ sending: false })
    }
  }

  return (
    <div data-slot="boltrig-composer" class="w-full">
      <div class="rounded-[10px] border border-v2-border-border-strong bg-v2-background-bg-layer-01 px-3 pt-3 pb-2">
        <textarea
          rows={2}
          value={draft.text}
          disabled={props.disabled}
          placeholder={props.disabled ? (props.disabledReason ?? props.placeholder) : props.placeholder}
          aria-label={props.placeholder}
          onInput={(event) => setDraft({ text: event.currentTarget.value })}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) return
            event.preventDefault()
            void submit()
          }}
          class="min-h-[40px] w-full resize-none bg-transparent text-[13px] leading-[var(--line-height-base)] text-v2-text-text-base outline-none placeholder:text-v2-text-text-faint"
        />
        <div class="flex h-[26px] items-center gap-3.5 text-[12.5px] text-v2-text-text-muted">
          <span class="truncate">{props.target}</span>
          <button
            type="button"
            aria-label={language.t("boltrig.composer.send")}
            disabled={props.disabled || draft.sending || !draft.text.trim()}
            onClick={() => void submit()}
            class="ms-auto grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-v2-text-text-accent text-v2-background-bg-base disabled:opacity-40"
          >
            <Show when={!draft.sending} fallback={<Icon name="status" size="small" />}>
              <Icon name="arrow-up" size="small" />
            </Show>
          </button>
        </div>
      </div>
      <div class="flex justify-end px-0.5 pt-1.5 text-[11.5px] text-v2-text-text-faint">{props.meter}</div>
    </div>
  )
}
