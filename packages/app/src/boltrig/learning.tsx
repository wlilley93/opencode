import { createMemo, createSignal, For, Match, onMount, Show, Switch } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { known, type KnownUnknown, type ResearchEdge, type ResearchGraph, type ResearchLeads, type ResearchSummary } from "./api"
import { BoltrigConversation } from "./conversation"
import { useBoltrig, type ResearchView } from "./model"
import { Note, Pill, RowError, useBoltrigWords } from "./parts"

const tabs = ["graph", "files", "leads", "review"] as const
const TEAM = "research"

// Learning (Figma 642:2 graph, 633:2 leads, 643:2 light): the conversation with the Head of Research, with the
// team's research account beside it. Graph and leads come from research.view.get (boltrig.human 2.3); on a server
// that does not serve it, and for files and review, which no op reads, the pane says so instead of inventing data.
export function BoltrigLearning() {
  const data = useBoltrig()
  const language = useLanguage()
  const [tab, setTab] = createSignal<(typeof tabs)[number]>("graph")
  const research = () => data.state.research[TEAM]
  const notServed = () => {
    const state = research()
    return state?.status === "not_served" ? state : undefined
  }
  const failed = () => {
    const state = research()
    return state?.status === "error" ? state : undefined
  }
  const ready = () => {
    const state = research()
    return state?.status === "ready" ? state : undefined
  }
  onMount(() => void data.loadResearch(TEAM))

  return (
    <div data-slot="boltrig-learning" class="flex min-h-0 flex-1">
      <BoltrigConversation teamId={TEAM} />
      <aside class="flex w-[480px] shrink-0 flex-col border-s border-v2-border-border-base">
        <div class="flex h-10 shrink-0 items-center gap-1 border-b border-v2-border-border-base px-2.5 text-[12.5px]">
          <For each={tabs}>
            {(item) => (
              <button
                type="button"
                onClick={() => setTab(item)}
                class={`rounded-[5px] px-2.5 py-0.5 ${tab() === item ? "bg-v2-overlay-simple-overlay-hover text-v2-text-text-base" : "text-v2-text-text-muted"}`}
              >
                {language.t(`boltrig.learning.tab.${item}`)}
              </button>
            )}
          </For>
          <Show when={(tab() === "graph" || tab() === "leads") && research()?.status !== "loading"}>
            <button
              type="button"
              onClick={() => void data.loadResearch(TEAM)}
              class="ms-auto rounded-[5px] px-2 py-0.5 text-xs text-v2-text-text-faint hover:text-v2-text-text-base"
            >
              {language.t("boltrig.research.reload")}
            </button>
          </Show>
        </div>
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Switch>
            <Match when={tab() === "files" || tab() === "review"}>
              <NotServed tab={tab() as "files" | "review"} />
            </Match>
            <Match when={!research() || research()!.status === "loading"}>
              <div class="text-xs text-v2-text-text-faint">{language.t("boltrig.research.loading")}</div>
            </Match>
            <Match when={notServed()}>
              {(state) => (
                <NotServed tab={tab() as "graph" | "leads"}>
                  {state().capability
                    ? language.t("boltrig.research.notServed.capability", { reason: state().capability! })
                    : language.t("boltrig.research.notServed.minor", { minor: state().minor })}
                </NotServed>
              )}
            </Match>
            <Match when={failed()}>{(state) => <RowError kind={state().error} />}</Match>
            <Match when={ready()}>
              {(state) => (
                <>
                  <Summary summary={state().view.summary} />
                  <Show when={tab() === "graph"} fallback={<LeadsPane leads={state().view.leads} />}>
                    <GraphPane view={state().view} />
                  </Show>
                </>
              )}
            </Match>
          </Switch>
        </div>
      </aside>
    </div>
  )
}

function NotServed(props: { tab: (typeof tabs)[number]; children?: string }) {
  const language = useLanguage()
  return (
    <>
      <Note title={language.t(`boltrig.learning.${props.tab}.title`)} aside={language.t("boltrig.notServed")} dashed>
        {props.children ?? language.t(`boltrig.learning.${props.tab}.body`)}
      </Note>
      <Note title={language.t("boltrig.learning.needs.title")}>
        <div class="font-mono text-[11.5px] leading-[var(--line-height-base)]">
          {language.t(`boltrig.learning.${props.tab}.op`)}
        </div>
      </Note>
    </>
  )
}

// The header both panes share: what the view holds, when it was generated, and from which inputs.
function Summary(props: { summary: ResearchSummary }) {
  const language = useLanguage()
  const words = useBoltrigWords()
  const count = (value: KnownUnknown<number>, key: "entities" | "edges" | "claims") =>
    value.state === "known"
      ? language.t(`boltrig.research.${key}`, { count: value.value })
      : `${key} ${language.t(value.reason === "not_reported" ? "boltrig.research.notReported" : "boltrig.research.unavailable")}`
  const unknownText = (value: KnownUnknown<unknown>) =>
    value.state === "unknown" && value.reason === "not_reported"
      ? language.t("boltrig.research.notReported")
      : language.t("boltrig.research.unavailable")
  const verdicts = () =>
    known(props.summary.verdicts)
      ?.slice()
      .sort((a, b) => assessmentOrder.indexOf(a.assessment) - assessmentOrder.indexOf(b.assessment))
  return (
    <div data-slot="boltrig-research-summary" class="flex flex-col gap-1 text-xs text-v2-text-text-muted">
      <div class="flex flex-wrap items-baseline gap-x-1.5">
        <span class="font-mono text-[11.5px] text-v2-text-text-base">{language.t("boltrig.research.file")}</span>
        <span>· {count(props.summary.entities, "entities")}</span>
        <span>· {count(props.summary.edges, "edges")}</span>
        <span>· {count(props.summary.claims, "claims")}</span>
      </div>
      <div class="flex flex-wrap items-baseline gap-x-1.5">
        <span>
          {language.t("boltrig.research.generated", {
            time:
              props.summary.generatedAt.state === "known"
                ? words.time(props.summary.generatedAt.value)
                : unknownText(props.summary.generatedAt),
          })}
        </span>
        <span>·</span>
        <span>{language.t("boltrig.research.digest")}</span>
        <span class="font-mono text-[11.5px]" title={known(props.summary.inputsDigest)}>
          {known(props.summary.inputsDigest)?.slice(0, 12) ?? unknownText(props.summary.inputsDigest)}
        </span>
        <span>·</span>
        <span>
          {props.summary.leads.state === "known"
            ? language.t("boltrig.research.leadsCount", {
                count: props.summary.leads.value,
                open: known(props.summary.openLeads) ?? unknownText(props.summary.openLeads),
              })
            : language.t("boltrig.research.leadsUnknown", { reason: unknownText(props.summary.leads) })}
        </span>
      </div>
      <div class="flex flex-wrap items-baseline gap-x-1.5">
        <span>{language.t("boltrig.research.verdicts")}:</span>
        <Show when={verdicts()} fallback={<span>{unknownText(props.summary.verdicts)}</span>}>
          {(list) => (
            <For each={list()}>
              {(item, index) => (
                <span>
                  <b class="font-medium text-v2-text-text-base">{item.count}</b>{" "}
                  {language.t(`boltrig.research.assessment.${item.assessment}`)}
                  {index() < list().length - 1 ? " ·" : ""}
                </span>
              )}
            </For>
          )}
        </Show>
      </div>
    </div>
  )
}

const assessmentOrder = [
  "supported",
  "reproduced",
  "inconclusive",
  "contested",
  "contradicted",
  "not_reproduced",
  "unassessed",
] as const

// ---- Graph ---------------------------------------------------------------------------------------------------

type Line = "supported" | "open" | "contested"

// What a line may claim to be. Supported only when every claim on it is supported or reproduced; any contested,
// contradicted or not-reproduced claim makes it contested; everything else (unassessed, inconclusive, mixed) is
// open. Nothing is drawn as settled by default.
function lineOf(edge: ResearchEdge): Line {
  const total = edge.assessment.reduce((sum, item) => sum + item.count, 0)
  const against = edge.assessment
    .filter((item) => item.assessment === "contested" || item.assessment === "contradicted" || item.assessment === "not_reproduced")
    .reduce((sum, item) => sum + item.count, 0)
  if (against > 0) return "contested"
  const supported = edge.assessment
    .filter((item) => item.assessment === "supported" || item.assessment === "reproduced")
    .reduce((sum, item) => sum + item.count, 0)
  if (total > 0 && supported === total) return "supported"
  return "open"
}

const lineStyle: Record<Line, { dash?: string; opacity: number; width: number }> = {
  supported: { opacity: 0.55, width: 0.9 },
  open: { dash: "3 2.5", opacity: 0.22, width: 0.75 },
  contested: { dash: "0.5 2", opacity: 0.7, width: 1.3 },
}

const W = 448
const H = 320

function GraphPane(props: { view: ResearchView }) {
  const language = useLanguage()
  const [selected, setSelected] = createSignal<{ kind: "edge" | "node"; id: string }>()
  const graph = () => (props.view.graph.state === "available" ? props.view.graph : undefined)
  const layout = createMemo(() => {
    const value = graph()
    return value ? computeLayout(value) : undefined
  })
  const labelOf = (id: string) => layout()?.byId.get(id)?.node.label.text ?? id

  return (
    <Show
      when={graph()}
      fallback={
        <Note title={language.t("boltrig.learning.graph.title")} aside={language.t("boltrig.research.unavailable")} dashed>
          {language.t(`boltrig.research.reason.${(props.view.graph as { reason: "invalid" }).reason}`)}
        </Note>
      }
    >
      {(value) => (
        <>
          <Show when={value().nodes.length > 0} fallback={<div class="text-xs text-v2-text-text-faint">{language.t("boltrig.research.empty")}</div>}>
            <svg
              data-slot="boltrig-research-graph"
              viewBox={`0 0 ${W} ${H}`}
              class="w-full shrink-0 rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-01 text-v2-text-text-base"
              onClick={(event) => event.target === event.currentTarget && setSelected(undefined)}
            >
              <For each={layout()!.edges}>
                {(edge) => {
                  const style = lineStyle[edge.line]
                  const isSelected = () => selected()?.kind === "edge" && selected()?.id === edge.edge.id
                  return (
                    <g class="cursor-pointer" onClick={() => setSelected({ kind: "edge", id: edge.edge.id })}>
                      <Show when={isSelected()}>
                        <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="currentColor" stroke-opacity="0.18" stroke-width="7" stroke-linecap="round" />
                      </Show>
                      <line
                        x1={edge.x1}
                        y1={edge.y1}
                        x2={edge.x2}
                        y2={edge.y2}
                        stroke="currentColor"
                        stroke-opacity={isSelected() ? 1 : style.opacity}
                        stroke-width={isSelected() ? 2 : style.width}
                        stroke-dasharray={style.dash}
                        stroke-linecap="round"
                      />
                      <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke="transparent" stroke-width="5">
                        <title>{`${labelOf(edge.edge.source)} —${edge.edge.predicate}→ ${labelOf(edge.edge.target)}`}</title>
                      </line>
                    </g>
                  )
                }}
              </For>
              <For each={layout()!.nodes}>
                {(node) => {
                  const isSelected = () => selected()?.kind === "node" && selected()?.id === node.node.id
                  return (
                    <circle
                      class="cursor-pointer"
                      cx={node.x}
                      cy={node.y}
                      r={node.r}
                      fill="currentColor"
                      fill-opacity={isSelected() ? 1 : 0.75}
                      stroke="currentColor"
                      stroke-opacity={isSelected() ? 0.5 : 0}
                      stroke-width={isSelected() ? 3 : 0}
                      onClick={() => setSelected({ kind: "node", id: node.node.id })}
                    >
                      <title>{`${node.node.label.text} (${node.node.type})`}</title>
                    </circle>
                  )
                }}
              </For>
            </svg>
          </Show>

          <div data-slot="boltrig-research-legend" class="flex flex-col gap-1.5 text-xs text-v2-text-text-muted">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <For each={["supported", "open", "contested"] as const}>
                {(line) => (
                  <span class="inline-flex items-center gap-1.5">
                    <svg width="22" height="6" class="text-v2-text-text-base">
                      <line
                        x1="1"
                        y1="3"
                        x2="21"
                        y2="3"
                        stroke="currentColor"
                        stroke-opacity={Math.min(1, lineStyle[line].opacity + 0.25)}
                        stroke-width={lineStyle[line].width + 0.4}
                        stroke-dasharray={lineStyle[line].dash}
                        stroke-linecap="round"
                      />
                    </svg>
                    <b class="font-medium text-v2-text-text-base">{layout()?.counts[line] ?? 0}</b>
                    {language.t(`boltrig.research.line.${line}`)}
                  </span>
                )}
              </For>
            </div>
            <div class="text-v2-text-text-faint">{language.t("boltrig.research.line.rule")}</div>
          </div>

          <Selection
            selected={selected()}
            graph={value()}
            labelOf={labelOf}
            degree={(id) => layout()?.byId.get(id)?.degree ?? 0}
          />

          <div class="text-xs text-v2-text-text-faint">
            {language.t("boltrig.research.read", {
              nodes: value().nodes.length,
              totalNodes: value().totalNodes,
              edges: value().edges.length,
              totalEdges: value().totalEdges,
              pages: props.view.pages,
            })}
            <Show when={value().skipped > 0}>{` · ${language.t("boltrig.research.skipped", { count: value().skipped })}`}</Show>
            <Show when={props.view.capped}>{` · ${language.t("boltrig.research.capped")}`}</Show>
            <Show when={props.view.restarted > 0}>
              {` · ${language.t("boltrig.research.restarted", { count: props.view.restarted })}`}
            </Show>
          </div>
        </>
      )}
    </Show>
  )
}

function Selection(props: {
  selected?: { kind: "edge" | "node"; id: string }
  graph: ResearchGraph
  labelOf: (id: string) => string
  degree: (id: string) => number
}) {
  const language = useLanguage()
  const edge = () => (props.selected?.kind === "edge" ? props.graph.edges.find((item) => item.id === props.selected!.id) : undefined)
  const node = () => (props.selected?.kind === "node" ? props.graph.nodes.find((item) => item.id === props.selected!.id) : undefined)
  const row = "grid grid-cols-[88px_1fr] gap-x-2 gap-y-1"
  return (
    <Switch fallback={<div class="text-xs text-v2-text-text-faint">{language.t("boltrig.research.select")}</div>}>
      <Match when={edge()}>
        {(value) => (
          <Note
            title={<span class="font-mono text-[11.5px]">{language.t("boltrig.research.edge.title", { id: value().id })}</span>}
            aside={language.t(`boltrig.research.line.${lineOf(value())}`)}
          >
            <div data-slot="boltrig-research-edge" class={`${row} text-xs`}>
              <div class="col-span-2 text-v2-text-text-base">
                <span title={value().source}>{props.labelOf(value().source)}</span>
                <span class="font-mono text-v2-text-text-muted"> —{value().predicate}→ </span>
                <span title={value().target}>{props.labelOf(value().target)}</span>
              </div>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.edge.predicate")}</span>
              <span class="font-mono text-[11.5px] text-v2-text-text-base">{value().predicate}</span>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.edge.claims")}</span>
              <span class="text-v2-text-text-base">{value().claims}</span>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.edge.claimIds")}</span>
              <span>{language.t("boltrig.research.edge.claimIdsNotServed")}</span>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.edge.assessment")}</span>
              <span class="flex flex-wrap gap-1">
                <For each={value().assessment}>
                  {(item) => (
                    <Pill>
                      {item.count} {language.t(`boltrig.research.assessment.${item.assessment}`)}
                    </Pill>
                  )}
                </For>
              </span>
            </div>
          </Note>
        )}
      </Match>
      <Match when={node()}>
        {(value) => (
          <Note title={<span class="font-mono text-[11.5px]">{language.t("boltrig.research.node.title", { id: value().id })}</span>}>
            <div data-slot="boltrig-research-node" class={`${row} text-xs`}>
              <div class="col-span-2 text-v2-text-text-base">
                {value().label.text}
                <span class="ms-1.5 text-v2-text-text-faint">({language.t("boltrig.research.outsideText")})</span>
              </div>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.node.type")}</span>
              <span class="font-mono text-[11.5px] text-v2-text-text-base">{value().type}</span>
              <span class="text-v2-text-text-faint">{language.t("boltrig.research.node.lines")}</span>
              <span class="text-v2-text-text-base">{props.degree(value().id)}</span>
            </div>
          </Note>
        )}
      </Match>
    </Switch>
  )
}

// A force layout computed once per view (Fruchterman-Reingold with a cooling step), from a seeded start so the
// same view always draws the same picture. Plain SVG; the fork carries no graph library.
function computeLayout(graph: ResearchGraph) {
  const index = new Map(graph.nodes.map((node, at) => [node.id, at]))
  const links = graph.edges
    .map((edge) => [index.get(edge.source), index.get(edge.target)] as const)
    .filter((pair): pair is readonly [number, number] => pair[0] !== undefined && pair[1] !== undefined && pair[0] !== pair[1])
  const count = graph.nodes.length
  const degree = new Float64Array(count)
  links.forEach(([a, b]) => {
    degree[a]++
    degree[b]++
  })
  const seed = { value: 17 }
  const random = () => {
    seed.value = (seed.value * 1664525 + 1013904223) % 4294967296
    return seed.value / 4294967296
  }
  const x = Float64Array.from({ length: count }, () => W / 2 + (random() - 0.5) * W * 0.8)
  const y = Float64Array.from({ length: count }, () => H / 2 + (random() - 0.5) * H * 0.8)
  const k = Math.sqrt((W * H) / Math.max(count, 1)) * 0.5
  const dx = new Float64Array(count)
  const dy = new Float64Array(count)
  const iterations = 120
  Array.from({ length: iterations }).forEach((_, step) => {
    const temperature = (W / 10) * (1 - step / iterations)
    dx.fill(0)
    dy.fill(0)
    for (let a = 0; a < count; a++)
      for (let b = a + 1; b < count; b++) {
        const ddx = x[a] - x[b]
        const ddy = y[a] - y[b]
        const d2 = ddx * ddx + ddy * ddy + 0.01
        const force = (k * k) / d2
        dx[a] += ddx * force
        dy[a] += ddy * force
        dx[b] -= ddx * force
        dy[b] -= ddy * force
      }
    links.forEach(([a, b]) => {
      const ddx = x[a] - x[b]
      const ddy = y[a] - y[b]
      const d = Math.sqrt(ddx * ddx + ddy * ddy) + 0.01
      const force = d / k
      dx[a] -= ddx * force
      dy[a] -= ddy * force
      dx[b] += ddx * force
      dy[b] += ddy * force
    })
    for (let at = 0; at < count; at++) {
      // A pull to the centre keeps nodes without lines off the walls. Total repulsion on an outer node is about
      // W·H·0.25/distance whatever the node count, so the pull is a constant per pixel, stronger across the short side.
      dx[at] += (W / 2 - x[at]) * 0.8
      dy[at] += (H / 2 - y[at]) * 0.8 * (W / H)
      const length = Math.sqrt(dx[at] * dx[at] + dy[at] * dy[at]) + 0.01
      x[at] = Math.min(W - 6, Math.max(6, x[at] + (dx[at] / length) * Math.min(length, temperature)))
      y[at] = Math.min(H - 6, Math.max(6, y[at] + (dy[at] / length) * Math.min(length, temperature)))
    }
  })
  const nodes = graph.nodes.map((node, at) => ({
    node,
    x: x[at],
    y: y[at],
    r: 1.4 + Math.min(degree[at], 14) * 0.18,
    degree: degree[at],
  }))
  const byId = new Map(nodes.map((item) => [item.node.id, item]))
  const edges = graph.edges.flatMap((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) return []
    return [{ edge, line: lineOf(edge), x1: source.x, y1: source.y, x2: target.x, y2: target.y }]
  })
  const counts = { supported: 0, open: 0, contested: 0 }
  edges.forEach((item) => counts[item.line]++)
  return { nodes, edges, byId, counts }
}

// ---- Leads ---------------------------------------------------------------------------------------------------

function LeadsPane(props: { leads: ResearchView["leads"] }) {
  const language = useLanguage()
  const notReported = language.t("boltrig.research.notReported")
  return (
    <Show
      when={props.leads.state === "available" && (props.leads as ResearchLeads)}
      fallback={
        <Note title={language.t("boltrig.learning.leads.title")} aside={language.t("boltrig.research.unavailable")} dashed>
          {language.t(`boltrig.research.reason.${(props.leads as { reason: "invalid" }).reason}`)}
        </Note>
      }
    >
      {(leads) => (
        <>
          <div class="flex items-baseline gap-2 text-xs text-v2-text-text-muted">
            <span class="font-medium text-v2-text-text-base">{language.t("boltrig.learning.leads.title")}</span>
            <span>
              {language.t("boltrig.research.leads.files", {
                files: leads().files,
                rows: leads().rows.length,
                total: leads().totalRows,
              })}
            </span>
            <Show when={leads().skipped > 0}>
              <span>· {language.t("boltrig.research.skipped", { count: leads().skipped })}</span>
            </Show>
          </div>
          <div class="text-xs text-v2-text-text-faint">{language.t("boltrig.learning.leads.body")}</div>
          <Show when={leads().rows.length > 0} fallback={<div class="text-xs text-v2-text-text-faint">{language.t("boltrig.research.leads.empty")}</div>}>
            <div data-slot="boltrig-research-leads" class="flex flex-col divide-y divide-v2-border-border-base rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-layer-01">
              <For each={leads().rows}>
                {(lead) => (
                  <div class="flex flex-col gap-1.5 px-3 py-2.5">
                    <div class="text-[13px] leading-[var(--line-height-base)] text-v2-text-text-base">
                      <span class="me-2 font-mono text-[11.5px] text-v2-text-text-muted">{lead.id}</span>
                      {lead.question.text}
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <Pill>{language.t("boltrig.research.lead.status", { status: known(lead.status) ?? notReported })}</Pill>
                      <Pill>{language.t("boltrig.research.lead.handledBy", { who: known(lead.handledBy) ?? notReported })}</Pill>
                      <span class="ms-auto font-mono text-[11px] text-v2-text-text-faint">{lead.file}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </>
      )}
    </Show>
  )
}
