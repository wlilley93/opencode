import { createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type DoctorVerdict, type StatusAgent } from "./api"
import { useBoltrig } from "./model"
import { Caption, Dot, Note, Pill, RowError, useBoltrigWords } from "./parts"

const verdicts: DoctorVerdict[] = ["fail", "warn", "pass", "skipped"]

// Status: what the server says about itself, all read-only. status.get (teams, agents, counts), doctor.get (the
// checks and why each passed or failed) and logs.tail for the team the person picks. Nothing here changes anything.
export function BoltrigStatus() {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const [team, setTeam] = createSignal<string>()
  const chosen = createMemo(() => team() ?? data.teams()[0]?.teamId)
  const reload = () => {
    void data.loadStatus()
    void data.loadDoctor()
    const id = chosen()
    if (id) void data.loadLogs(id)
  }
  onMount(reload)
  const pick = (teamId: string) => {
    setTeam(teamId)
    void data.loadLogs(teamId)
  }
  const checks = () => data.state.doctor.value?.checks ?? []
  const count = (verdict: DoctorVerdict) => checks().filter((item) => item.verdict === verdict).length
  const runtime = (agent: StatusAgent) => known(agent.effectiveRuntime) ?? known(agent.configuredRuntime) ?? language.t("boltrig.unknown")
  const logs = () => (chosen() ? data.state.logs[chosen()!] : undefined)

  return (
    <div data-slot="boltrig-status" class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-[680px] max-w-[calc(100%-48px)] py-6 max-[700px]:max-w-[calc(100%-24px)] max-[700px]:py-4">
        <div class="mb-3 flex items-center gap-2">
          <div class="min-w-0 flex-1 text-xl font-medium text-v2-text-text-base">{language.t("boltrig.status.title")}</div>
          <button
            type="button"
            onClick={reload}
            class="shrink-0 rounded-[5px] px-2 py-0.5 text-xs text-v2-text-text-faint hover:text-v2-text-text-base max-[700px]:min-h-11 max-[700px]:min-w-11 max-[700px]:px-3"
          >
            {language.t("boltrig.research.reload")}
          </button>
        </div>

        <Switch>
          <Match when={data.state.serverStatus.error && !data.state.serverStatus.value}>
            <RowError kind={data.state.serverStatus.error!} />
          </Match>
          <Match when={!data.state.serverStatus.value}>
            <div class="py-2 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
          </Match>
          <Match when={data.state.serverStatus.value}>
            {(report) => (
              <>
                <div data-slot="boltrig-status-counts" class="grid grid-cols-3 gap-2 max-[700px]:grid-cols-2">
                  <For each={["teams", "openWork", "heldEvents", "uncertainTurns", "pendingApprovals"] as const}>
                    {(key) => (
                      <div class="rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-01 px-3 py-2.5">
                        <div class="flex items-center gap-1.5 text-xl font-medium text-v2-text-text-base">
                          {report().counts[key]}
                          <Show when={(key === "uncertainTurns" || key === "pendingApprovals") && report().counts[key] > 0}>
                            <Dot needsYou />
                          </Show>
                        </div>
                        <div class="text-xs text-v2-text-text-faint">{language.t(`boltrig.status.count.${key}`)}</div>
                      </div>
                    )}
                  </For>
                </div>
                <Show when={!report().complete}>
                  <div class="px-0.5 pt-2 text-xs text-v2-text-text-faint">
                    {language.t("boltrig.turn.partial", {
                      sources: report().sourceErrors.map((error) => `${error.source} (${error.code})`).join(", ") || "—",
                    })}
                  </div>
                </Show>

                <div class="mt-5">
                  <Caption>{language.t("boltrig.status.teams")}</Caption>
                  <For each={report().teams}>
                    {(item) => (
                      <div data-slot="boltrig-status-team" class="border-b border-v2-border-border-base px-2.5 py-2.5">
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-v2-text-text-base">{item.team}</span>
                          <Pill>{known(item.container) ?? words.unknown(item.container)}</Pill>
                          <span class="ms-auto font-mono text-[11.5px] text-v2-text-text-faint">{known(item.containerId) ?? ""}</span>
                        </div>
                        <For each={item.agents}>
                          {(agent) => (
                            <div class="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-v2-text-text-muted">
                              <Dot live={agent.busy} needsYou={agent.blocked} />
                              <span class="font-mono text-xs text-v2-text-text-base">{agent.role}</span>
                              <span class="text-xs">{runtime(agent)}</span>
                              <span class="text-xs text-v2-text-text-faint">
                                {agent.blocked ? language.t("boltrig.status.blocked") : agent.busy ? language.t("boltrig.status.busy") : language.t("boltrig.status.idle")}
                              </span>
                              <span class="ms-auto text-xs text-v2-text-text-faint">
                                {agent.inbox.map((entry) => `${entry.count} ${words.turnState(entry.state)}`).join(" · ")}
                              </span>
                            </div>
                          )}
                        </For>
                      </div>
                    )}
                  </For>
                </div>
              </>
            )}
          </Match>
        </Switch>

        <div class="mt-5">
          <Caption>{language.t("boltrig.status.doctor")}</Caption>
          <Switch>
            <Match when={data.state.doctor.error && !data.state.doctor.value}>
              <RowError kind={data.state.doctor.error!} />
            </Match>
            <Match when={!data.state.doctor.value}>
              <div class="px-2.5 py-1 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
            </Match>
            <Match when={data.state.doctor.value}>
              <div class="px-2.5 pb-1.5 text-xs text-v2-text-text-muted">
                {verdicts.map((verdict) => `${count(verdict)} ${language.t(`boltrig.doctor.${verdict}`)}`).join(" · ")}
              </div>
              <div data-slot="boltrig-doctor" class="flex flex-col">
                <For
                  each={[...checks()].sort((a, b) => verdicts.indexOf(a.verdict) - verdicts.indexOf(b.verdict))}
                  fallback={<div class="px-2.5 py-2 text-v2-text-text-faint">{language.t("boltrig.doctor.none")}</div>}
                >
                  {(item) => (
                    <div data-verdict={item.verdict} class="flex flex-col gap-0.5 border-b border-v2-border-border-base px-2.5 py-2">
                      <div class="flex min-h-7 items-center gap-2">
                        <Dot needsYou={item.verdict === "fail"} live={item.verdict === "pass"} />
                        <span class="font-mono text-xs text-v2-text-text-base">{item.check}</span>
                        <Pill>{language.t(`boltrig.doctor.${item.verdict}`)}</Pill>
                      </div>
                      <div class="ps-3.5 text-xs break-words text-v2-text-text-muted">{item.reason}</div>
                    </div>
                  )}
                </For>
              </div>
            </Match>
          </Switch>
        </div>

        <div class="mt-5">
          <Caption>{language.t("boltrig.status.logs")}</Caption>
          <div class="flex flex-wrap gap-1.5 px-0.5 pb-2 text-[12.5px]">
            <For each={data.teams()}>
              {(item) => (
                <button
                  type="button"
                  aria-pressed={chosen() === item.teamId}
                  onClick={() => pick(item.teamId)}
                  class={`rounded-full border px-3 py-0.5 max-[700px]:min-h-11 max-[700px]:min-w-11 max-[700px]:px-4 ${
                    chosen() === item.teamId
                      ? "border-v2-border-border-strong bg-v2-overlay-simple-overlay-hover text-v2-text-text-base"
                      : "border-v2-border-border-base text-v2-text-text-faint"
                  }`}
                >
                  {item.displayName}
                </button>
              )}
            </For>
          </div>
          <Switch>
            <Match when={logs()?.error && !logs()?.value}>
              <RowError kind={logs()!.error!} />
            </Match>
            <Match when={!logs()?.value}>
              <div class="px-2.5 py-1 text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
            </Match>
            <Match when={logs()?.value}>
              {(tail) => (
                <>
                  <div data-slot="boltrig-logs" class="flex flex-col rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-01">
                    <For
                      each={tail().lines}
                      fallback={<div class="px-3 py-2.5 text-v2-text-text-faint">{language.t("boltrig.logs.none")}</div>}
                    >
                      {(line) => (
                        <div class="flex flex-col gap-0.5 border-b border-v2-border-border-base px-3 py-1.5 last:border-b-0">
                          <div class="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-v2-text-text-faint">
                            <span>{new Date(line.at).toLocaleTimeString(language.intl(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                            <span>{line.source}</span>
                            <Show when={known(line.role)}>{(role) => <span>{role()}</span>}</Show>
                          </div>
                          <div class="font-mono text-xs break-words text-v2-text-text-base">{line.text}</div>
                        </div>
                      )}
                    </For>
                  </div>
                  <Show when={!tail().complete}>
                    <div class="px-0.5 pt-2 text-xs text-v2-text-text-faint">
                      {language.t("boltrig.turn.partial", {
                        sources: tail().sourceErrors.map((error) => `${error.source} (${error.code})`).join(", ") || "—",
                      })}
                    </div>
                  </Show>
                  <div class="mt-2">
                    <Note title={language.t("boltrig.logs.limits.title")} dashed>
                      {language.t("boltrig.logs.limits.body", {
                        message: tail().capabilities.publicMessageText,
                        host: tail().capabilities.hostLogs,
                      })}
                    </Note>
                  </div>
                </>
              )}
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
