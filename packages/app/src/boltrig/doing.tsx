import { createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import type { WorkState } from "./api"
import { BoltrigComposer } from "./composer"
import { TurnBlock } from "./conversation"
import { TERMINAL, useBoltrig } from "./model"
import { Caption, Dot, Note, Pill, RowError, useBoltrigWords } from "./parts"
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
  const selected = createMemo(() => works().find((work) => work.id === picked()) ?? works().find((work) => work.status === "open"))
  const turnsOf = (workId: string) =>
    (data.state.turns.value ?? []).filter((turn) => turn.work === workId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  const roleName = (teamId: string, roleId: string) => {
    const role = data.roles(teamId).find((item) => item.roleId === roleId)
    return role ? data.roleName(role) : `${teamId}/${roleId}`
  }
  const delivery = () => data.head("delivery")

  return (
    <div data-slot="boltrig-doing" class="flex min-h-0 flex-1">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] py-4">
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
                            onClick={() => setPicked(work.id)}
                            class={`flex h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left hover:bg-v2-overlay-simple-overlay-hover ${
                              selected()?.id === work.id ? "bg-v2-overlay-simple-overlay-hover" : ""
                            }`}
                          >
                            <span class="w-[70px] shrink-0 font-mono text-[11.5px] text-v2-text-text-faint">{work.id.slice(0, 8)}</span>
                            <span class="min-w-0 flex-1 truncate text-v2-text-text-base">
                              {language.t("boltrig.doing.title", { kind: work.origin.kind, team: work.origin.team })}
                            </span>
                            <Show when={waiting() || active()}>
                              <Dot needsYou={waiting()} live={active()} />
                            </Show>
                            <span class="shrink-0 text-xs text-v2-text-text-faint">
                              {language.plural("boltrig.doing.turns", turns().length)}
                            </span>
                            <span class="w-[64px] shrink-0 text-end text-xs text-v2-text-text-faint">
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
        <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] shrink-0 pb-4">
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
      <aside class="w-[420px] shrink-0 overflow-y-auto border-s border-v2-border-border-base">
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
              <Note title={language.t("boltrig.doing.issue.title")} aside={language.t("boltrig.notServed")} dashed>
                {language.t("boltrig.doing.issue.body")}
              </Note>
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
