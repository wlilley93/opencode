import { Icon } from "@opencode/ui/icon"
import { createEffect, createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type Work, type WorkState } from "./api"
import { BoltrigComposer } from "./composer"
import { TurnBlock } from "./conversation"
import { TERMINAL, useBoltrig } from "./model"
import { Caption, Dot, Pill, RowError, useBoltrigWords } from "./parts"
import type { BoltrigSelection } from "./sidebar"

const groups: WorkState[] = ["open", "closed", "cancelled"]

// Doing (Figma 609:2): every work the person can see (work.list), grouped by state, with the turns that ran on
// it (turn.list, turn.show). Linear issues are not served by the Client API, so works stand in for them.
export function BoltrigDoing(props: { onSelect: (selection: BoltrigSelection) => void }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const works = () => data.state.works.value ?? []
  const [picked, setPicked] = createSignal<string>()
  // On a phone the list and the work are two screens: a tapped work opens full width, with a way back.
  const [detailOpen, setDetailOpen] = createSignal(false)
  const selected = createMemo(() => works().find((work) => work.id === picked()) ?? works().find((work) => work.status === "open"))
  const turnsOf = (workId: string) =>
    (data.state.turns.value ?? []).filter((turn) => turn.work === workId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  const roleName = (teamId: string, roleId: string) => {
    const role = data.roles(teamId).find((item) => item.roleId === roleId)
    return role ? data.roleName(role) : `${teamId}/${roleId}`
  }
  const delivery = () => data.head("delivery")
  // The selected work is read in full (work.show) and with its Linear context (work_context.get).
  createEffect(() => {
    const work = selected()
    if (work) void data.loadWork(work.id, work.origin.team)
  })

  return (
    <div data-slot="boltrig-doing" class="flex min-h-0 flex-1">
      <div classList={{ "max-[700px]:hidden": detailOpen() }} class="flex min-w-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] max-[700px]:max-w-[calc(100%-24px)] py-4">
            <Show when={data.state.works.error}>{(kind) => <RowError kind={kind()} />}</Show>
            <Show when={data.state.works.value && works().length === 0}>
              <div class="py-8 text-center text-v2-text-text-faint">{language.t("boltrig.doing.empty")}</div>
            </Show>
            <For each={groups}>
              {(group) => {
                const rows = () => works().filter((work) => work.status === group)
                return (
                  <Show when={rows().length > 0}>
                    <div class="mt-3 flex h-7 items-center gap-2 px-2.5 text-xs text-v2-text-text-faint">
                      {language.t(`boltrig.doing.group.${group}`)}
                      <span>{rows().length}</span>
                    </div>
                    <For each={rows()}>
                      {(work) => {
                        const turns = () => turnsOf(work.id)
                        const waiting = () => turns().some((turn) => turn.state === "uncertain")
                        const active = () => turns().some((turn) => !TERMINAL.has(turn.state))
                        return (
                          <button
                            type="button"
                            data-slot="boltrig-work-row"
                            onClick={() => {
                              setPicked(work.id)
                              setDetailOpen(true)
                            }}
                            class={`flex h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left max-[700px]:h-11 hover:bg-v2-overlay-simple-overlay-hover ${
                              selected()?.id === work.id ? "bg-v2-overlay-simple-overlay-hover" : ""
                            }`}
                          >
                            <span class="w-[70px] shrink-0 font-mono max-[700px]:w-[64px] text-[11.5px] text-v2-text-text-faint">{work.id.slice(0, 8)}</span>
                            <span class="min-w-0 flex-1 truncate text-v2-text-text-base">
                              {language.t("boltrig.doing.title", { kind: work.origin.kind, team: work.origin.team })}
                            </span>
                            <Show when={waiting() || active()}>
                              <Dot needsYou={waiting()} live={active()} />
                            </Show>
                            <span class="shrink-0 text-xs text-v2-text-text-faint">
                              {language.plural("boltrig.doing.turns", turns().length)}
                            </span>
                            <span class="w-[64px] shrink-0 text-end text-xs text-v2-text-text-faint max-[700px]:w-[44px]">
                              {work.used}/{work.maxSteps}
                            </span>
                          </button>
                        )
                      }}
                    </For>
                  </Show>
                )
              }}
            </For>
          </div>
        </div>
        <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] max-[700px]:max-w-[calc(100%-24px)] shrink-0 pb-4">
          <BoltrigComposer
            placeholder={language.t("boltrig.composer.ask", {
              name: delivery() ? data.roleName(delivery()!) : language.t("boltrig.conversation.head"),
            })}
            target={delivery() ? data.roleName(delivery()!) : ""}
            meter={language.t("boltrig.doing.meter", { open: works().filter((work) => work.status === "open").length })}
            disabled={!delivery()}
            disabledReason={language.t("boltrig.conversation.notRunning")}
            onSend={async (text) => {
              void data.send("delivery", text)
              props.onSelect({ kind: "team", teamId: "delivery", talk: true })
            }}
          />
        </div>
      </div>
      <aside
        classList={{ "max-[700px]:hidden": !detailOpen() }}
        class="w-[420px] shrink-0 overflow-y-auto border-s border-v2-border-border-base max-[700px]:w-full max-[700px]:border-s-0"
      >
        <button
          type="button"
          onClick={() => setDetailOpen(false)}
          class="hidden h-11 items-center gap-1 px-3 text-v2-text-text-muted max-[700px]:flex"
        >
          <Icon name="chevron-left" size="small" />
          {language.t("boltrig.doing.back")}
        </button>
        <Show when={selected()} fallback={<div class="p-4 text-v2-text-text-faint">{language.t("boltrig.doing.pick")}</div>}>
          {(work) => (
            <div class="flex flex-col gap-3 p-4">
              <div>
                <div class="font-mono text-xs text-v2-text-text-faint">{work().id}</div>
                <div class="mt-1 text-[15px] font-medium text-v2-text-text-base">
                  {language.t("boltrig.doing.title", { kind: work().origin.kind, team: work().origin.team })}
                </div>
              </div>
              <div class="grid grid-cols-[112px_minmax(0,1fr)] gap-y-1.5 text-v2-text-text-base">
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.status")}</span>
                <span>
                  <Pill>{language.t(`boltrig.doing.group.${work().status}`)}</Pill>
                </span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.team")}</span>
                <span>{work().origin.team}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.requester")}</span>
                <span class="truncate font-mono text-xs leading-[var(--line-height-base)]">{work().origin.requester}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.accountable")}</span>
                <span class="truncate font-mono text-xs leading-[var(--line-height-base)]">{work().origin.accountable}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.steps")}</span>
                <span>{language.t("boltrig.doing.steps", { used: work().used, max: work().maxSteps })}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.participants")}</span>
                <span class="font-mono text-xs leading-[var(--line-height-base)]">{work().participants.join(", ") || "—"}</span>
              </div>
              <div>
                <Caption>{language.plural("boltrig.doing.turns", turnsOf(work().id).length)}</Caption>
                <For each={turnsOf(work().id)}>
                  {(turn) => <TurnBlock turn={turn} name={roleName(turn.team, turn.role)} open={false} />}
                </For>
              </div>
              <WorkExtra work={work()} onPick={(id) => setPicked(id)} />
              <div class="text-[11.5px] text-v2-text-text-faint">
                {data.state.observedAt ? language.t("boltrig.observed", { time: words.time(data.state.observedAt) }) : ""}
              </div>
            </div>
          )}
        </Show>
      </aside>
    </div>
  )
}

const link = "inline-flex min-h-11 min-w-11 items-center break-all text-v2-text-text-base underline min-[701px]:min-h-7"

// What work.show and work_context.get add to the list row: the server's own account of the work (steps, approvals
// waiting) and the issue, documents and neighbouring works. Texts marked untrusted are drawn as plain text; a link is
// only a link when it is https.
function WorkExtra(props: { work: Work; onPick: (workId: string) => void }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const detail = () => data.state.workDetails[props.work.id]
  const context = () => data.state.workContexts[props.work.id]
  const safe = (url: string) => url.startsWith("https://")
  const row = "grid grid-cols-[112px_minmax(0,1fr)] gap-y-1.5 text-v2-text-text-base"
  const ids = (list: string[]) => (
    <For each={list}>
      {(id) => (
        <button type="button" onClick={() => props.onPick(id)} class="inline-flex min-h-11 min-w-11 items-center font-mono text-xs underline min-[701px]:min-h-7">
          {id.slice(0, 8)}
        </button>
      )}
    </For>
  )
  return (
    <>
      <div data-slot="boltrig-work-detail" class="flex flex-col gap-1.5">
        <Caption>{language.t("boltrig.work.detail")}</Caption>
        <Switch>
          <Match when={detail()?.error && !detail()?.value}>
            <RowError kind={detail()!.error!} />
          </Match>
          <Match when={!detail()?.value}>
            <div class="px-2.5 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
          </Match>
          <Match when={detail()?.value}>
            {(value) => (
              <>
                <div class={`${row} px-2.5`}>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.status")}</span>
                  <span>{language.t(`boltrig.doing.group.${value().status}`)}</span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.doing.prop.steps")}</span>
                  <span>{language.t("boltrig.doing.steps", { used: value().used, max: value().maxSteps })}</span>
                </div>
                <Caption>{language.plural("boltrig.work.approvals", value().approvals.length)}</Caption>
                <For each={value().approvals}>
                  {(approval) => (
                    <div data-slot="boltrig-approval" class="mx-2.5 rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 py-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-mono text-xs text-v2-text-text-base">{approval.code}</span>
                        <Pill>{approval.state}</Pill>
                        <span class="ms-auto text-xs text-v2-text-text-faint">{language.t("boltrig.work.expires", { time: words.time(approval.expiresAt) })}</span>
                      </div>
                      <div class="mt-1 break-words text-v2-text-text-muted">{approval.summary}</div>
                      <div class="mt-1 text-xs text-v2-text-text-faint">{language.t("boltrig.work.requestedBy", { who: approval.requestedBy })}</div>
                    </div>
                  )}
                </For>
                <Show when={value().approvals.length > 0}>
                  <div class="px-2.5 text-xs text-v2-text-text-faint">{language.t("boltrig.work.approvalsReadOnly")}</div>
                </Show>
              </>
            )}
          </Match>
        </Switch>
      </div>
      <div data-slot="boltrig-work-context" class="flex flex-col gap-1.5">
        <Caption>{language.t("boltrig.work.context")}</Caption>
        <Switch>
          <Match when={context()?.error && !context()?.value}>
            <RowError kind={context()!.error!} />
          </Match>
          <Match when={!context()?.value}>
            <div class="px-2.5 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
          </Match>
          <Match when={context()?.value}>
            {(value) => {
              const issue = () => {
                const item = value().issue
                return item.state === "known" ? item.value : undefined
              }
              const documents = () => {
                const item = value().documents
                return item.state === "known" ? item.value : undefined
              }
              const state = () => known(value().state)
              return (
                <div class={`${row} px-2.5`}>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.role")}</span>
                  <span>{language.t(`boltrig.work.role.${value().role}`)}</span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.issue")}</span>
                  <span>
                    <Show when={issue()} fallback={<span class="text-v2-text-text-muted">{language.t("boltrig.work.noIssue", { reason: words.unknown(value().issue) })}</span>}>
                      {(item) => (
                        <Show when={known(item().url)} fallback={<span>{item().key.text}</span>}>
                          {(url) => (
                            <Show when={safe(url())} fallback={<span>{item().key.text}</span>}>
                              <a href={url()} target="_blank" rel="noopener noreferrer" class={link}>
                                {item().key.text}
                              </a>
                            </Show>
                          )}
                        </Show>
                      )}
                    </Show>
                  </span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.linearState")}</span>
                  <span>{state() ? language.t(`boltrig.doing.group.${state()!}`) : words.unknown(value().state)}</span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.linearStatus")}</span>
                  <span>{known(value().status)?.text ?? words.unknown(value().status)}</span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.documents")}</span>
                  <span class="flex flex-col">
                    <For each={documents()} fallback={<span class="text-v2-text-text-muted">{documents() ? language.t("boltrig.work.noDocuments") : words.unknown(value().documents)}</span>}>
                      {(item) => (
                        <Show when={safe(item.url)} fallback={<span>{item.title.text}</span>}>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" class={link}>
                            {item.title.text}
                          </a>
                        </Show>
                      )}
                    </For>
                  </span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.parent")}</span>
                  <span>
                    <Show when={known(value().parent)} fallback={<span class="text-v2-text-text-muted">{words.unknown(value().parent)}</span>}>
                      {(id) => ids([id()])}
                    </Show>
                  </span>
                  <span class="text-v2-text-text-faint">{language.t("boltrig.work.children")}</span>
                  <span class="flex flex-wrap gap-x-2">
                    <Show when={known(value().children)} fallback={<span class="text-v2-text-text-muted">{words.unknown(value().children)}</span>}>
                      {(list) => (list().length === 0 ? <span class="text-v2-text-text-muted">{language.t("boltrig.work.noChildren")}</span> : ids(list()))}
                    </Show>
                  </span>
                </div>
              )
            }}
          </Match>
        </Switch>
      </div>
    </>
  )
}
