import { createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type SourceRow } from "./api"
import { useBoltrig } from "./model"
import { Caption, Note, Pill, RowError, Tile, useBoltrigWords } from "./parts"

const otherConnectors = ["microsoft", "granola", "crm"] as const

// Interfacing: the person's inbound channels and the tools Boltrig reaches. Everything here is read: channels from
// sources.list and sources.show, events the server held from held.list, and the Linear connection from the
// doctor's checks. The Client is read-only, so nothing can be retried, paused or connected from this screen.
export function BoltrigInterfacing() {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const [open, setOpen] = createSignal<string>()
  const reload = () => {
    void data.loadSources()
    void data.loadHeld()
    void data.loadDoctor()
    const id = open()
    if (id) void data.loadSource(id)
  }
  onMount(reload)

  const unknownText = words.unknown
  const linear = () => (data.state.doctor.value?.checks ?? []).filter((item) => item.check === "linear" || item.check.startsWith("linear:"))

  const toggle = (row: SourceRow) => {
    const next = open() === row.id ? undefined : row.id
    setOpen(next)
    if (next) void data.loadSource(next)
  }

  return (
    <div data-slot="boltrig-interfacing" class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-[640px] max-w-[calc(100%-48px)] py-8 max-[700px]:max-w-[calc(100%-24px)] max-[700px]:py-4">
        <div class="mb-5 flex items-start gap-3.5">
          <Tile large>I</Tile>
          <div class="min-w-0 flex-1">
            <div class="text-xl font-medium text-v2-text-text-base">{language.t("boltrig.iface.title")}</div>
            <div class="text-v2-text-text-faint">{language.t("boltrig.iface.subtitle")}</div>
          </div>
          <button
            type="button"
            onClick={reload}
            class="shrink-0 rounded-[5px] px-2 py-0.5 text-xs text-v2-text-text-faint hover:text-v2-text-text-base max-[700px]:min-h-11 max-[700px]:min-w-11 max-[700px]:px-3"
          >
            {language.t("boltrig.research.reload")}
          </button>
        </div>

        <Caption>{language.t("boltrig.iface.sources")}</Caption>
        <Show when={data.state.sources.error}>{(kind) => <RowError kind={kind()} />}</Show>
        <Show when={data.state.sources.value?.rows.length === 0}>
          <div class="px-2.5 py-3 text-v2-text-text-faint">{language.t("boltrig.iface.sources.none")}</div>
        </Show>
        <div data-slot="boltrig-sources" class="flex flex-col">
          <For each={data.state.sources.value?.rows}>
            {(row) => (
              <div class="border-b border-v2-border-border-base">
                <button
                  type="button"
                  aria-expanded={open() === row.id}
                  onClick={() => toggle(row)}
                  class="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-[7px] px-2.5 py-2 text-left hover:bg-v2-overlay-simple-overlay-hover"
                >
                  <span class="font-mono text-v2-text-text-base">{row.id}</span>
                  <Pill>{language.t(`boltrig.source.type.${row.type}`)}</Pill>
                  <Pill>{language.t(`boltrig.source.state.${row.status}`)}</Pill>
                  <Show when={row.held > 0}>
                    <Pill>{language.t("boltrig.source.held", { count: row.held })}</Pill>
                  </Show>
                  <span class="ms-auto text-xs text-v2-text-text-faint">
                    {known(row.preset) ?? ""}
                  </span>
                </button>
                <Show when={open() === row.id}>
                  <SourcePane id={row.id} />
                </Show>
              </div>
            )}
          </For>
        </div>
        <Show when={data.state.sources.value?.more}>
          <div class="px-2.5 pt-2 text-xs text-v2-text-text-faint">{language.t("boltrig.iface.more")}</div>
        </Show>
        <Show when={data.state.sources.value && !data.state.sources.value.complete}>
          <div class="px-2.5 pt-2 text-xs text-v2-text-text-faint">
            {language.t("boltrig.turn.partial", {
              sources: data.state.sources.value!.sourceErrors.map((error) => `${error.source} (${error.code})`).join(", ") || "—",
            })}
          </div>
        </Show>

        <div class="mt-6">
          <Caption>{language.t("boltrig.iface.held")}</Caption>
          <Show when={data.state.held.error}>{(kind) => <RowError kind={kind()} />}</Show>
          <Show when={data.state.held.value?.rows.length === 0}>
            <div class="px-2.5 py-2 text-v2-text-text-faint">{language.t("boltrig.iface.held.none")}</div>
          </Show>
          <div data-slot="boltrig-held" class="flex flex-col">
            <For each={data.state.held.value?.rows}>
              {(item) => (
                <div class="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-v2-border-border-base px-2.5 py-2">
                  <span class="font-mono text-xs text-v2-text-text-base">{item.id}</span>
                  <Pill>{item.team}</Pill>
                  <span class="text-v2-text-text-muted">{known(item.reason) ?? unknownText(item.reason)}</span>
                  <span class="ms-auto text-xs text-v2-text-text-faint">{words.time(item.receivedAt)}</span>
                </div>
              )}
            </For>
          </div>
          <Show when={data.state.held.value?.more}>
            <div class="px-2.5 pt-2 text-xs text-v2-text-text-faint">{language.t("boltrig.iface.more")}</div>
          </Show>
          <div class="mt-2">
            <Note title={language.t("boltrig.iface.retry.title")} aside={language.t("boltrig.iface.retry.aside")} dashed>
              {language.t("boltrig.iface.retry.body")}
            </Note>
          </div>
        </div>

        <div class="mt-6">
          <Caption>{language.t("boltrig.iface.connections")}</Caption>
          <div data-slot="boltrig-connections" class="flex flex-col">
            <Switch>
              <Match when={data.state.doctor.error && !data.state.doctor.value}>
                <ConnectionRow initial="L" name={language.t("boltrig.iface.linear.name")} state={words.errorText(data.state.doctor.error!)} />
              </Match>
              <Match when={linear().length === 0}>
                <ConnectionRow
                  initial="L"
                  name={language.t("boltrig.iface.linear.name")}
                  state={data.state.doctor.value ? language.t("boltrig.iface.linear.noCheck") : language.t("boltrig.turn.loading")}
                />
              </Match>
              <Match when={true}>
                <For each={linear()}>
                  {(item) => (
                    <ConnectionRow
                      initial="L"
                      name={`${language.t("boltrig.iface.linear.name")}${item.check.includes(":") ? ` · ${item.check.slice(item.check.indexOf(":") + 1)}` : ""}`}
                      state={language.t(`boltrig.iface.linear.${item.verdict}`)}
                      reason={item.reason}
                    />
                  )}
                </For>
              </Match>
            </Switch>
            <For each={otherConnectors}>
              {(item) => (
                <ConnectionRow
                  initial={language.t(`boltrig.iface.${item}.initial`)}
                  name={language.t(`boltrig.iface.${item}.name`)}
                  reason={language.t(`boltrig.iface.${item}.holds`)}
                  state={language.t("boltrig.notServed")}
                />
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConnectionRow(props: { initial: string; name: string; state: string; reason?: string }) {
  return (
    <div class="flex min-h-[52px] items-center gap-3 border-b border-v2-border-border-base px-1 py-2">
      <Tile>{props.initial}</Tile>
      <div class="min-w-0 flex-1">
        <div class="text-v2-text-text-base">{props.name}</div>
        <Show when={props.reason}>
          <div class="text-xs break-words text-v2-text-text-faint">{props.reason}</div>
        </Show>
      </div>
      <span class="shrink-0 text-end text-xs text-v2-text-text-muted">{props.state}</span>
    </div>
  )
}

// One channel, read with sources.show: its facts, the keys of an api channel (labels and dates only; the contract
// never carries a secret) and the last receipts.
function SourcePane(props: { id: string }) {
  const data = useBoltrig()
  const language = useLanguage()
  const words = useBoltrigWords()
  const detail = () => data.state.sourceDetails[props.id]
  const unknownText = words.unknown
  const cell = "grid grid-cols-[112px_minmax(0,1fr)] gap-y-1.5 text-v2-text-text-base"
  return (
    <div data-slot="boltrig-source-detail" class="flex flex-col gap-3 px-2.5 pt-1 pb-4">
      <Switch>
        <Match when={detail()?.error && !detail()?.value}>{<RowError kind={detail()!.error!} />}</Match>
        <Match when={!detail()?.value}>
          <div class="text-xs text-v2-text-text-faint">{language.t("boltrig.turn.loading")}</div>
        </Match>
        <Match when={detail()?.value}>
          {(value) => {
            const keys = () => {
              const page = value().keys
              return page.state === "known" ? page.value : undefined
            }
            return (
            <>
              <div class={cell}>
                <span class="text-v2-text-text-faint">{language.t("boltrig.source.prop.type")}</span>
                <span>{language.t(`boltrig.source.type.${value().type}`)}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.source.prop.state")}</span>
                <span>{language.t(`boltrig.source.state.${value().status}`)}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.source.prop.preset")}</span>
                <span>{known(value().preset) ?? language.t("boltrig.source.noPreset")}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.source.prop.held")}</span>
                <span>{value().held}</span>
                <span class="text-v2-text-text-faint">{language.t("boltrig.source.prop.to")}</span>
                <span class="text-v2-text-text-muted">{language.t("boltrig.source.toNotServed")}</span>
              </div>
              <Show when={keys()}>
                {(page) => (
                    <div data-slot="boltrig-source-keys">
                      <Caption>{language.t("boltrig.source.keys")}</Caption>
                      <For each={page().rows} fallback={<div class="px-2.5 text-xs text-v2-text-text-faint">{language.t("boltrig.source.keys.none")}</div>}>
                        {(key) => (
                          <div class="flex min-h-11 flex-wrap items-center gap-x-2 border-b border-v2-border-border-base px-2.5 py-1.5">
                            <span class="text-v2-text-text-base">{key.label}</span>
                            <Show when={key.revoked}>
                              <Pill>{language.t("boltrig.source.revoked")}</Pill>
                            </Show>
                            <span class="ms-auto text-xs text-v2-text-text-faint">
                              {language.t("boltrig.source.lastUsed", { time: key.lastUsedAt.state === "known" ? words.time(key.lastUsedAt.value) : unknownText(key.lastUsedAt) })}
                            </span>
                          </div>
                        )}
                      </For>
                      <Show when={page().more}>
                        <button
                          type="button"
                          onClick={() => void data.loadMoreKeys(props.id)}
                          class="mt-1 min-h-11 rounded-[7px] px-2.5 text-xs text-v2-text-text-muted underline"
                        >
                          {language.t("boltrig.source.moreKeys")}
                        </button>
                      </Show>
                    </div>
                )}
              </Show>
              <Show when={value().lastEvents.length > 0}>
                <div data-slot="boltrig-source-events">
                  <Caption>{language.t("boltrig.source.events")}</Caption>
                  <For each={value().lastEvents}>
                    {(event) => (
                      <div class="flex min-h-11 flex-wrap items-center gap-x-2 border-b border-v2-border-border-base px-2.5 py-1.5 text-xs">
                        <Pill>{event.state}</Pill>
                        <span class="text-v2-text-text-muted">{known(event.reason) ?? ""}</span>
                        <span class="ms-auto text-v2-text-text-faint">{words.time(event.receivedAt)}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </>
            )
          }}
        </Match>
      </Switch>
    </div>
  )
}
