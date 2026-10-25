import type { JSX } from "solid-js"
import { Show } from "solid-js"
import type { ApiErrorKind, InboxState, KnownUnknown } from "./api"
import { useLanguage } from "@/runtime/i18n/language"

// Small pieces every Boltrig screen shares, so the screens stay in one grammar.

export function Tile(props: { children: JSX.Element; large?: boolean }) {
  return (
    <span
      class={`grid shrink-0 place-items-center bg-v2-background-bg-layer-03 font-semibold text-v2-text-text-base ${
        props.large ? "size-11 rounded-xl text-[19px]" : "size-[18px] rounded-[5px] text-[10px] leading-[var(--line-height-compact)]"
      }`}
    >
      {props.children}
    </span>
  )
}

// A filled dot is a running agent; a ring is one that is not running. Colour only for "needs you".
export function Dot(props: { live?: boolean; needsYou?: boolean }) {
  return (
    <span
      class={`size-1.5 shrink-0 rounded-full ${
        props.needsYou
          ? "bg-v2-text-text-accent"
          : props.live
            ? "bg-v2-text-text-muted"
            : "border border-v2-border-border-strong"
      }`}
    />
  )
}

export function Pill(props: { children: JSX.Element; mono?: boolean }) {
  return (
    <span
      class={`inline-flex h-5 shrink-0 items-center rounded-full border border-v2-border-border-strong px-2 text-[11.5px] text-v2-text-text-muted ${
        props.mono ? "font-mono" : ""
      }`}
    >
      {props.children}
    </span>
  )
}

export function Note(props: { title: JSX.Element; aside?: JSX.Element; children?: JSX.Element; dashed?: boolean }) {
  return (
    <div
      class={`rounded-[8px] border bg-v2-background-bg-layer-01 px-3 py-2.5 ${
        props.dashed ? "border-dashed border-v2-border-border-strong" : "border-v2-border-border-base"
      }`}
    >
      <div class="flex items-center gap-2 text-v2-text-text-base">
        <span class="font-medium">{props.title}</span>
        <Show when={props.aside}>
          <span class="ms-auto text-xs text-v2-text-text-faint">{props.aside}</span>
        </Show>
      </div>
      <Show when={props.children}>
        <div class="mt-1 text-v2-text-text-muted">{props.children}</div>
      </Show>
    </div>
  )
}

export function Caption(props: { children: JSX.Element }) {
  return <div class="px-2.5 pt-1 pb-1 text-xs text-v2-text-text-faint">{props.children}</div>
}

export function useBoltrigWords() {
  const language = useLanguage()
  const turnState = (state: InboxState) => language.t(`boltrig.turn.state.${state}`)
  const errorText = (kind: ApiErrorKind) => language.t(`boltrig.error.${kind}`)
  const time = (iso: string) =>
    new Date(iso).toLocaleString(language.intl(), { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
  // Why a value is not here, in the server's own words: the contract names the reason, so the screen does too.
  const unknown = (value: KnownUnknown<unknown>) =>
    value.state === "unknown" ? language.t(`boltrig.unknown.${value.reason}`) : ""
  return { turnState, errorText, time, unknown }
}

// A row-level source error: one read failed, the rest of the page stands.
export function RowError(props: { kind: ApiErrorKind }) {
  const words = useBoltrigWords()
  return <div class="px-2.5 py-1.5 text-xs text-v2-text-text-faint">{words.errorText(props.kind)}</div>
}
