import { Icon } from "@opencode/ui/icon"
import { createMemo, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { BoltrigComposer } from "./composer"
import { modeOf, TERMINAL, useBoltrig, type ModeID } from "./model"
import { Caption, Dot, Tile, useBoltrigWords } from "./parts"
import type { BoltrigSelection } from "./sidebar"

// Home is the person's double: the one place they start from, with what is moving across the three modes.
// The server has no personal double yet, so Home's composer reaches a team's head, chosen beside the box.
export function BoltrigHome(props: { onSelect: (selection: BoltrigSelection) => void }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()

  const runningTeams = createMemo(() =>
    data.teams().filter((team) => data.state.trees[team.teamId]?.value?.state === "running" && data.head(team.teamId)),
  )
  const [target, setTarget] = createSignal<string>()
  const chosen = () => target() ?? runningTeams()[0]?.teamId
  const chosenName = () => {
    const teamId = chosen()
    if (!teamId) return ""
    const head = data.head(teamId)
    return head ? data.roleName(head) : teamId
  }

  const waiting = () => data.state.uncertain.value?.length ?? 0
  const firstName = () => data.state.viewer?.person.displayName.split(" ")[0] ?? ""
  const hour = new Date().getHours()
  const greeting = () =>
    language.t(hour < 12 ? "boltrig.home.morning" : hour < 18 ? "boltrig.home.afternoon" : "boltrig.home.evening", {
      name: firstName(),
    })

  type Summary = { mode: ModeID; text: string; owner: string; needsYou?: boolean; go: BoltrigSelection }
  const summaries = createMemo<Summary[]>(() => {
    const research = data.teamTurns("research").sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]
    const researchHead = data.head("research")
    const works = data.state.works.value ?? []
    const open = works.filter((work) => work.status === "open").length
    const active = (data.state.turns.value ?? []).filter((turn) => !TERMINAL.has(turn.state)).length
    return [
      {
        mode: "learning",
        text: research
          ? language.t("boltrig.home.learning.last", {
              name: researchHead ? data.roleName(researchHead) : research.role,
              state: words.turnState(research.state),
              time: words.time(research.receivedAt),
            })
          : language.t("boltrig.home.learning.none"),
        owner: language.t("boltrig.home.owner.research"),
        go: { kind: "mode", mode: "learning" },
      },
      {
        mode: "doing",
        text: language.t("boltrig.home.doing.summary", { open, active }),
        owner: language.t("boltrig.home.owner.delivery"),
        needsYou: waiting() > 0,
        go: { kind: "mode", mode: "doing" },
      },
      {
        mode: "interfacing",
        text: language.t("boltrig.home.interfacing.none"),
        owner: language.t("boltrig.home.owner.tools"),
        go: { kind: "mode", mode: "interfacing" },
      },
    ]
  })

  return (
    <div data-slot="boltrig-home" class="flex flex-1 flex-col items-center overflow-y-auto pt-[120px] pb-10 max-[700px]:pt-10">
      <div class="mb-3.5">
        <Tile large>{language.t("boltrig.double.initial")}</Tile>
      </div>
      <div class="mb-1 text-xl font-medium text-v2-text-text-base">{greeting()}</div>
      <div class="mb-5.5 text-v2-text-text-faint">
        {waiting() === 0
          ? language.t("boltrig.home.nothingWaiting")
          : language.plural("boltrig.home.waiting", waiting())}
      </div>
      <div class="w-[640px] max-w-[calc(100%-48px)] max-[700px]:max-w-[calc(100%-24px)]">
        <BoltrigComposer
          placeholder={language.t("boltrig.composer.ask", { name: chosenName() || language.t("boltrig.double.name") })}
          target={chosenName()}
          meter={language.t("boltrig.home.meter", { team: chosen() ?? "—" })}
          disabled={!chosen()}
          disabledReason={language.t("boltrig.home.noHead")}
          onSend={async (text) => {
            const teamId = chosen()
            if (!teamId) return
            void data.send(teamId, text)
            props.onSelect(teamId === "research" ? { kind: "mode", mode: "learning" } : { kind: "team", teamId, talk: true })
          }}
        />
        <Show when={runningTeams().length > 1}>
          <div class="-mt-5 mb-2 flex flex-wrap gap-1.5 px-0.5 text-[11.5px] max-[700px]:mt-1">
            <For each={runningTeams()}>
              {(team) => (
                <button
                  type="button"
                  onClick={() => setTarget(team.teamId)}
                  class={`rounded-full border px-2 py-px max-[700px]:min-h-11 max-[700px]:min-w-11 max-[700px]:px-4 ${
                    chosen() === team.teamId
                      ? "border-v2-border-border-strong bg-v2-overlay-simple-overlay-hover text-v2-text-text-base"
                      : "border-v2-border-border-base text-v2-text-text-faint"
                  }`}
                >
                  {team.displayName}
                </button>
              )}
            </For>
          </div>
        </Show>
        <Caption>{language.t("boltrig.home.across")}</Caption>
        <div class="mt-1">
          <For each={summaries()}>
            {(item) => (
              <button
                type="button"
                onClick={() => props.onSelect(item.go)}
                class="flex h-[34px] w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-v2-text-text-muted max-[700px]:h-11 hover:bg-v2-overlay-simple-overlay-hover"
              >
                <span class="flex w-[92px] shrink-0 items-center gap-1 text-xs text-v2-text-text-faint">
                  <Icon name={modeOf(item.mode).icon} size="small" />
                  {language.t(`boltrig.mode.${item.mode}`)}
                </span>
                <span class="truncate text-v2-text-text-base">{item.text}</span>
                <Show when={item.needsYou}>
                  <Dot needsYou />
                </Show>
                <span class="ms-auto shrink-0 text-xs text-v2-text-text-faint">{item.owner}</span>
              </button>
            )}
          </For>
        </div>
        <div class="my-3 h-px bg-v2-border-border-base" />
        <div class="flex items-center gap-2 px-2.5 text-xs text-v2-text-text-faint">
          {language.t("boltrig.home.interfacingNote")}
        </div>
      </div>
    </div>
  )
}
