import { Icon } from "@opencode/ui/icon"
import { createEffect, createMemo, createSignal, For, Match, Show, Switch, type JSX } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type AgentRow, type TreeRole } from "./api"
import { BoltrigConversation, TurnBlock } from "./conversation"
import { initialOf, isLive, useBoltrig } from "./model"
import { Caption, Dot, Note, Pill, RowError, Tile, useBoltrigWords } from "./parts"
import type { BoltrigSelection } from "./sidebar"

function Prop(props: { label: string; children: JSX.Element }) {
  return (
    <div class="flex min-h-7 items-start gap-3 py-1">
      <span class="w-[112px] shrink-0 text-v2-text-text-faint">{props.label}</span>
      <span class="min-w-0 flex-1 break-words text-v2-text-text-base">{props.children}</span>
    </div>
  )
}

function runtimeText(row: AgentRow | undefined, unknown: string) {
  if (!row) return unknown
  const configured = known(row.configuredRuntime)
  const effective = known(row.effectiveRuntime)
  if (configured && effective && configured !== effective) return `${effective} (${configured})`
  return effective ?? configured ?? unknown
}

// The right pane: one agent, read with agent.show — inventory, inbox and what the Client cannot see.
function AgentPane(props: { teamId: string; role: TreeRole }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const key = () => `${props.teamId}/${props.role.roleId}`
  const detail = () => data.state.agentDetails[key()]

  createEffect(() => {
    key()
    void data.loadAgent(props.teamId, props.role.roleId)
  })

  return (
    <div class="flex flex-col gap-3 p-4">
      <div class="flex items-center gap-2.5">
        <Tile>{initialOf(data.roleName(props.role))}</Tile>
        <span class="font-medium text-v2-text-text-base">{data.roleName(props.role)}</span>
        <span class="font-mono text-[11.5px] text-v2-text-text-faint">{key()}</span>
      </div>
      <Switch>
        <Match when={detail()?.error}>{(kind) => <RowError kind={kind()} />}</Match>
        <Match when={!detail()?.value}>
          <div class="text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
        </Match>
        <Match when={detail()?.value}>
          {(value) => {
            const row = () => value().inventory
            const unknown = language.t("boltrig.unknown")
            return (
              <>
                <div>
                  <Prop label={language.t("boltrig.agent.runtime")}>{runtimeText(row(), unknown)}</Prop>
                  <Prop label={language.t("boltrig.agent.execution")}>
                    {language.t(`boltrig.execution.${row().executionStatus}`)}
                  </Prop>
                  <Prop label={language.t("boltrig.agent.container")}>
                    {known(row().containerState) ?? unknown} · {language.t(`boltrig.availability.${row().containerAvailability}`)}
                  </Prop>
                  <Prop label={language.t("boltrig.agent.runtimeAvailability")}>
                    {language.t(`boltrig.availability.${row().runtimeAvailability}`)}
                  </Prop>
                  <Prop label={language.t("boltrig.agent.lastActivity")}>
                    {known(row().lastActivityAt) ? words.time(known(row().lastActivityAt)!) : unknown}
                  </Prop>
                  <Show when={known(row().activeWorkId)}>
                    {(work) => (
                      <Prop label={language.t("boltrig.agent.activeWork")}>
                        <span class="font-mono text-xs">{work()}</span>
                      </Prop>
                    )}
                  </Show>
                </div>
                <div>
                  <Caption>{language.plural("boltrig.agent.inbox", value().inbox.length)}</Caption>
                  <For each={[...value().inbox].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 10)}>
                    {(item) => (
                      <TurnBlock
                        turn={{ ...item, team: props.teamId, role: props.role.roleId }}
                        name={data.roleName(props.role)}
                        open={false}
                      />
                    )}
                  </For>
                </div>
                <Show when={Object.keys(value().unavailable).length > 0}>
                  <Note title={language.t("boltrig.agent.notServed")}>
                    <div class="font-mono text-[11.5px]">
                      <For each={Object.entries(value().unavailable)}>
                        {([name, why]) => (
                          <div>
                            {name}: {why}
                          </div>
                        )}
                      </For>
                    </div>
                  </Note>
                </Show>
              </>
            )
          }}
        </Match>
      </Switch>
    </div>
  )
}

// The team screen (adapted from "Build your team", Figma 632:2): the roster read from tree.get and
// agents.list, one agent in the right pane, and the team's head one click away.
export function BoltrigTeam(props: {
  teamId: string
  roleId?: string
  talk?: boolean
  onSelect: (selection: BoltrigSelection) => void
}) {
  const data = useBoltrig()
  const language = useLanguage()
  const team = () => data.teams().find((item) => item.teamId === props.teamId)
  const tree = () => data.state.trees[props.teamId]
  const roles = () => data.roles(props.teamId)
  const selectedRole = createMemo(() => roles().find((role) => role.roleId === props.roleId) ?? data.head(props.teamId))
  const live = () => roles().filter((role) => isLive(data.agent(props.teamId, role.roleId))).length
  const head = () => data.head(props.teamId)
  // On a phone the roster and the agent are two screens, not two columns: tapping a role opens the agent.
  const [agentOpen, setAgentOpen] = createSignal(false)
  createEffect(() => {
    props.teamId
    setAgentOpen(!!props.roleId && !props.talk)
  })

  return (
    <div data-slot="boltrig-team" class="flex min-h-0 flex-1">
      <div classList={{ "max-[700px]:hidden": agentOpen() }} class="flex min-w-0 flex-1 flex-col">
        <div class="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-v2-border-border-base px-4 text-[12.5px] max-[700px]:h-12 max-[700px]:px-2">
          <button
            type="button"
            onClick={() => props.onSelect({ kind: "team", teamId: props.teamId, roleId: props.roleId })}
            class={`rounded-[5px] px-2.5 py-0.5 whitespace-nowrap max-[700px]:min-h-11 max-[700px]:px-3.5 ${!props.talk ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base" : "text-v2-text-text-muted"}`}
          >
            {language.t("boltrig.team.roster")}
          </button>
          <Show when={head()}>
            {(role) => (
              <button
                type="button"
                onClick={() => props.onSelect({ kind: "team", teamId: props.teamId, roleId: props.roleId, talk: true })}
                class={`rounded-[5px] px-2.5 py-0.5 whitespace-nowrap max-[700px]:min-h-11 max-[700px]:px-3.5 ${props.talk ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base" : "text-v2-text-text-muted"}`}
              >
                {language.t("boltrig.team.talk", { name: data.roleName(role()) })}
              </button>
            )}
          </Show>
        </div>
        <Show
          when={!props.talk}
          fallback={<BoltrigConversation teamId={props.teamId} />}
        >
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div class="mx-auto w-[640px] max-w-[calc(100%-48px)] max-[700px]:max-w-[calc(100%-24px)] py-8">
              <div class="mb-6 flex items-start gap-3.5">
                <Tile large>{initialOf(team()?.displayName ?? props.teamId)}</Tile>
                <div>
                  <div class="text-xl font-medium text-v2-text-text-base">{team()?.displayName ?? props.teamId}</div>
                  <div class="text-v2-text-text-faint">
                    <Switch>
                      <Match when={tree()?.error}>{(kind) => <RowError kind={kind()} />}</Match>
                      <Match when={tree()?.value?.state === "not_running"}>{language.t("boltrig.team.notRunning")}</Match>
                      <Match when={tree()?.value?.state === "running"}>
                        {language.t("boltrig.team.summary", { roles: roles().length, live: live() })}
                      </Match>
                      <Match when={!tree()}>{language.t("boltrig.turn.loading")}</Match>
                    </Switch>
                  </div>
                </div>
              </div>

              <div data-slot="boltrig-roster" class="overflow-x-auto">
              <div class="min-w-[560px]">
              <div class="grid grid-cols-[minmax(0,1.4fr)_70px_minmax(0,1fr)_minmax(0,1fr)_16px] items-center gap-x-3 px-2.5 pb-1.5 text-xs text-v2-text-text-faint">
                <span>{language.t("boltrig.team.col.role")}</span>
                <span>{language.t("boltrig.team.col.tier")}</span>
                <span>{language.t("boltrig.team.col.runtime")}</span>
                <span>{language.t("boltrig.team.col.status")}</span>
                <span />
              </div>
              <For each={roles()}>
                {(role) => {
                  const row = () => data.agent(props.teamId, role.roleId)
                  const reports = () => known(role.reportsTo)
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        props.onSelect({ kind: "team", teamId: props.teamId, roleId: role.roleId })
                        setAgentOpen(true)
                      }}
                      class={`grid min-h-[44px] w-full grid-cols-[minmax(0,1.4fr)_70px_minmax(0,1fr)_minmax(0,1fr)_16px] items-center gap-x-3 rounded-[7px] px-2.5 py-1.5 text-left hover:bg-v2-overlay-simple-overlay-hover ${
                        selectedRole()?.roleId === role.roleId ? "bg-v2-overlay-simple-overlay-hover" : ""
                      }`}
                    >
                      <span class="flex min-w-0 items-center gap-2.5">
                        <Tile>{initialOf(data.roleName(role))}</Tile>
                        <span class="min-w-0">
                          <span class="block truncate text-v2-text-text-base">{data.roleName(role)}</span>
                          <span class="block truncate text-[11.5px] text-v2-text-text-faint">
                            <span class="font-mono">{role.roleId}</span>
                            <Show when={reports()}>
                              {(to) => <> · {language.t("boltrig.team.reportsTo", { role: to().roleId })}</>}
                            </Show>
                            <Show when={known(role.humanFacing)}> · {language.t("boltrig.team.humanFacing")}</Show>
                          </span>
                        </span>
                      </span>
                      <span>
                        <Pill>{language.t(`boltrig.tier.${role.tier}`)}</Pill>
                      </span>
                      <span class="truncate font-mono text-xs text-v2-text-text-muted">
                        {runtimeText(row(), language.t("boltrig.unknown"))}
                      </span>
                      <span class="truncate text-v2-text-text-muted">
                        {row() ? language.t(`boltrig.execution.${row()!.executionStatus}`) : language.t("boltrig.unknown")}
                      </span>
                      <Dot live={isLive(row())} needsYou={row()?.executionStatus === "blocked"} />
                    </button>
                  )
                }}
              </For>
              </div>
              </div>
              <Show when={data.state.agents.error}>{(kind) => <RowError kind={kind()} />}</Show>

              <div class="mt-6">
                <Note title={language.t("boltrig.addAgent")} aside={language.t("boltrig.notServed")} dashed>
                  {language.t("boltrig.team.addAgentNotServed")}
                </Note>
              </div>
            </div>
          </div>
        </Show>
      </div>
      <aside
        classList={{ "max-[700px]:hidden": !agentOpen() }}
        class="w-[400px] shrink-0 overflow-y-auto border-s border-v2-border-border-base max-[700px]:w-full max-[700px]:border-s-0"
      >
        <button
          type="button"
          onClick={() => setAgentOpen(false)}
          class="hidden h-11 items-center gap-1 px-3 text-v2-text-text-muted max-[700px]:flex"
        >
          <Icon name="chevron-left" size="small" />
          {language.t("boltrig.team.roster")}
        </button>
        <Show
          when={selectedRole()}
          fallback={<div class="p-4 text-v2-text-text-faint">{language.t("boltrig.team.noRoles")}</div>}
        >
          {(role) => <AgentPane teamId={props.teamId} role={role()} />}
        </Show>
      </aside>
    </div>
  )
}
