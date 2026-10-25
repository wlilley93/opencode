import { Icon } from "@opencode/ui/icon"
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type StepItem, type Turn } from "./api"
import { BoltrigComposer } from "./composer"
import { isLive, TERMINAL, useBoltrig, type Message } from "./model"
import { Caption, RowError, useBoltrigWords } from "./parts"

// One turn: its state, and the events the server journals for it (turn.show), polled until it is finished.
export function TurnBlock(props: { turn: Turn; name: string; open?: boolean }) {
  const data = useBoltrig()
  const words = useBoltrigWords()
  const language = useLanguage()
  const [open, setOpen] = createSignal(props.open ?? true)
  const detail = () => data.state.turnDetails[props.turn.id]

  createEffect(() => {
    if (open() && !detail()) void data.loadTurn(props.turn.id)
  })

  const finished = () => TERMINAL.has(props.turn.state)

  return (
    <div data-slot="boltrig-turn" class="py-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open())}
        class="flex w-full items-center gap-2 text-left text-v2-text-text-muted"
      >
        <Icon
          name={finished() ? (props.turn.state === "done" ? "check" : "circle-xmark") : "status-active"}
          size="small"
          class="text-v2-icon-icon-muted"
        />
        <span class="font-medium text-v2-text-text-base">{props.name}</span>
        <span>{words.turnState(props.turn.state)}</span>
        <span class="ms-auto font-mono text-[11.5px] text-v2-text-text-faint">{props.turn.id.slice(0, 8)}</span>
        <span class="text-[11.5px] text-v2-text-text-faint">{words.time(props.turn.receivedAt)}</span>
      </button>
      <Show when={open()}>
        <div class="mt-1.5 ms-[7px] border-s border-v2-border-border-base ps-4">
          <Switch>
            <Match when={detail()?.error}>{(kind) => <RowError kind={kind()} />}</Match>
            <Match when={!detail()?.value}>
              <div class="py-1 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
            </Match>
            <Match when={detail()?.value}>
              {(value) => (
                <>
                  <For
                    each={value().events}
                    fallback={<div class="py-1 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.noEvents")}</div>}
                  >
                    {(event) => (
                      <div class="flex gap-3 py-[3px] text-[12.5px]">
                        <span class="w-[124px] shrink-0 truncate font-mono text-[11.5px] text-v2-text-text-faint">
                          {event.kind}
                        </span>
                        <span class="min-w-0 flex-1 break-words text-v2-text-text-muted">{event.text}</span>
                        <span class="shrink-0 text-[11px] text-v2-text-text-faint">
                          {new Date(event.at).toLocaleTimeString(language.intl(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                    )}
                  </For>
                  <Show when={!value().complete}>
                    <div class="py-1 text-xs text-v2-text-text-faint">
                      {language.t("boltrig.turn.partial", {
                        sources: value().sourceErrors.map((error) => `${error.source} (${error.code})`).join(", ") || "—",
                      })}
                    </div>
                  </Show>
                </>
              )}
            </Match>
          </Switch>
        </div>
      </Show>
    </div>
  )
}

function Bubble(props: { message: Message; answered: boolean }) {
  const language = useLanguage()
  const words = useBoltrigWords()
  const status = () => {
    const message = props.message
    if (message.state === "failed") return words.errorText(message.error ?? "invalid")
    // Once the head has a turn on this work, the turn carries the progress; the send state would only go stale.
    if (props.answered) return ""
    if (message.state === "queued") return language.t("boltrig.send.queued", { position: message.position ?? 0 })
    return language.t(`boltrig.send.${message.state}`)
  }
  return (
    <div class="flex flex-col items-end py-2">
      <div class="max-w-[80%] rounded-[10px] border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 py-2 whitespace-pre-wrap text-v2-text-text-base">
        {props.message.text}
      </div>
      <div class="mt-1 text-[11px] text-v2-text-text-faint">{status()}</div>
    </div>
  )
}

// A step the server serves as text: the head's reply (agent_message), a question or a status. Untrusted text is
// drawn as text, never as markup.
function Said(props: { step: StepItem; name: string }) {
  const language = useLanguage()
  const body = () => (props.step.body.state === "known" ? props.step.body.value.text : "")
  return (
    <div class="py-2">
      <div class="mb-1 flex items-center gap-2 text-xs text-v2-text-text-faint">
        <span class="font-medium text-v2-text-text-muted">{props.name}</span>
        <span>{language.t(`boltrig.step.${props.step.kind}`)}</span>
      </div>
      <div class="leading-[var(--line-height-base)] whitespace-pre-wrap text-v2-text-text-base">{body()}</div>
    </div>
  )
}

// A conversation with a team's head: what the person sent (kept in this tab only; the server does not retain
// conversation text for the Client) and the turns the head ran on those works, live.
export function BoltrigConversation(props: { teamId: string; emptyHint?: string }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const head = () => data.head(props.teamId)
  const headName = () => {
    const role = head()
    return role ? data.roleName(role) : language.t("boltrig.conversation.head")
  }
  const row = () => (head() ? data.agent(props.teamId, head()!.roleId) : undefined)
  const conversation = () => data.state.conversations[props.teamId]

  type Item = { at: string; message?: Message; turn?: Turn; step?: StepItem }
  const items = createMemo<Item[]>(() => {
    const sent = conversation()?.messages ?? []
    const mine = new Set(sent.map((message) => message.text))
    const messages = sent.map((message) => ({ at: message.sentAt, message }))
    const turns = data.conversationTurns(props.teamId).map((turn) => ({ at: turn.receivedAt, turn }))
    // What the head said, from steps.list; the person's own messages are already drawn from this tab.
    const steps = (data.state.transcripts[props.teamId]?.value ?? [])
      .filter((step) => step.kind !== "tool_summary" && step.body.state === "known" && !mine.has(step.body.value.text))
      .map((step) => ({ at: known(step.startedAt) ?? known(step.finishedAt) ?? "", step }))
    return [...messages, ...turns, ...steps].sort((a, b) => a.at.localeCompare(b.at))
  })

  const earlier = createMemo(() => {
    const mine = new Set(data.conversationTurns(props.teamId).map((turn) => turn.id))
    const role = head()?.roleId
    return data
      .teamTurns(props.teamId)
      .filter((turn) => !mine.has(turn.id) && (!role || turn.role === role))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, 12)
  })

  let scroller: HTMLDivElement | undefined
  createEffect(() => {
    items().length
    queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight }))
  })

  const meter = () => {
    const agent = row()
    const runtime = agent?.effectiveRuntime.state === "known" ? agent.effectiveRuntime.value : language.t("boltrig.unknown")
    const status = agent ? language.t(`boltrig.execution.${agent.executionStatus}`) : language.t("boltrig.unknown")
    return language.t("boltrig.conversation.meter", { team: props.teamId, runtime, status })
  }

  const notRunning = () => data.state.trees[props.teamId]?.value?.state === "not_running"

  return (
    <div data-slot="boltrig-conversation" class="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] py-6">
          <Show
            when={items().length > 0}
            fallback={
              <div class="py-8 text-center text-v2-text-text-faint">
                {props.emptyHint ?? language.t("boltrig.conversation.empty", { name: headName() })}
              </div>
            }
          >
            <For each={items()}>
              {(item) => (
                <Switch>
                  <Match when={item.message}>
                    {(message) => (
                      <Bubble
                        message={message()}
                        answered={data.conversationTurns(props.teamId).some((turn) => turn.work === message().workId && turn.receivedAt >= message().sentAt.slice(0, 19))}
                      />
                    )}
                  </Match>
                  <Match when={item.turn}>{(turn) => <TurnBlock turn={turn()} name={headName()} />}</Match>
                  <Match when={item.step}>
                    {(step) => (
                      <Said
                        step={step()}
                        name={known(step().roleId) && known(step().roleId) !== head()?.roleId ? known(step().roleId)! : headName()}
                      />
                    )}
                  </Match>
                </Switch>
              )}
            </For>
            <Show when={data.state.transcripts[props.teamId]?.error}>
              {(kind) => (
                <div class="py-1 text-xs text-v2-text-text-faint">
                  {language.t("boltrig.conversation.transcriptUnavailable", { reason: words.errorText(kind()) })}
                </div>
              )}
            </Show>
            <Show when={(conversation()?.messages.length ?? 0) > 0 && data.conversationTurns(props.teamId).length === 0}>
              <div class="py-2 text-xs text-v2-text-text-faint">{language.t("boltrig.conversation.waiting")}</div>
            </Show>
          </Show>

          <Show when={earlier().length > 0}>
            <div class="mt-6 border-t border-v2-border-border-base pt-3">
              <Caption>{language.t("boltrig.conversation.earlier")}</Caption>
              <For each={earlier()}>{(turn) => <TurnBlock turn={turn} name={headName()} open={false} />}</For>
            </div>
          </Show>
        </div>
      </div>
      <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] shrink-0 pb-4">
        <div class="mb-1.5 flex items-center gap-2 text-xs text-v2-text-text-faint">
          <Show when={(conversation()?.messages.length ?? 0) > 0}>
            <button type="button" class="hover:text-v2-text-text-muted" onClick={() => data.newConversation(props.teamId)}>
              {language.t("boltrig.conversation.new")}
            </button>
          </Show>
        </div>
        <BoltrigComposer
          placeholder={language.t("boltrig.composer.ask", { name: headName() })}
          target={headName()}
          meter={meter()}
          disabled={notRunning() || !head()}
          disabledReason={language.t("boltrig.conversation.notRunning")}
          onSend={(text) => data.send(props.teamId, text)}
        />
        <Show when={row() && !isLive(row())}>
          <div class="px-0.5 pt-1 text-[11.5px] text-v2-text-text-faint">{language.t("boltrig.conversation.headNotLive")}</div>
        </Show>
      </div>
    </div>
  )
}
