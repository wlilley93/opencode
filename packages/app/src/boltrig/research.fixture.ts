import type { ResearchAssessment, ResearchEdge, ResearchLead, ResearchNode, ResearchViewRequest, ResearchViewResponse } from "./api"

// research.view.get fixtures, for screens and screenshots while the deployed server does not serve the op.
// `contract` holds the bodies of @boltrig/human-contract 2.0.0-pre.6 fixtures/valid/research.view.get verbatim, so
// typecheck holds the client's types to the contract. `researchFixture` answers a request from a generated view
// paged the way the server pages (offsets per list, `next` until not_applicable), at a page size small enough to
// make the client walk more than one page. Every label and question in it says it is a fixture.

const K = <T>(value: T) => ({ state: "known" as const, value })
const U = (reason: "not_reported" | "not_applicable" | "unavailable") => ({ state: "unknown" as const, reason })
const text = (value: string) => ({ text: value, untrusted: true as const })

const unavailableSummary = {
  entities: U("unavailable"),
  edges: U("unavailable"),
  claims: U("unavailable"),
  verdicts: U("unavailable"),
  generatedAt: U("unavailable"),
  inputsDigest: U("unavailable"),
  leads: U("unavailable"),
  openLeads: U("unavailable"),
}

export const contract = {
  read: {
    teamId: "research",
    graph: {
      state: "available",
      nodes: [
        { id: "person:ada-example", type: "Person", label: text("Ada Example") },
        { id: "work:example-engine", type: "Work", label: text("Example Engine") },
      ],
      edges: [
        {
          id: "e1",
          source: "person:ada-example",
          target: "work:example-engine",
          predicate: "made",
          claims: 2,
          assessment: [
            { assessment: "supported", count: 1 },
            { assessment: "reproduced", count: 1 },
            { assessment: "contested", count: 1 },
            { assessment: "inconclusive", count: 1 },
            { assessment: "contradicted", count: 1 },
            { assessment: "not_reproduced", count: 1 },
            { assessment: "unassessed", count: 1 },
          ],
        },
      ],
      totalNodes: 2,
      totalEdges: 1,
      skipped: 0,
      nextNodes: U("not_applicable"),
      nextEdges: U("not_applicable"),
    },
    leads: {
      state: "available",
      files: 1,
      rows: [
        {
          id: "RES-1:L001",
          file: "RES-1",
          question: text("Does finding RES-1:L001 hold?"),
          status: K("open"),
          handledBy: K("research/scout"),
        },
        {
          id: "RES-1:L002",
          file: "RES-1",
          question: text("Does finding RES-1:L002 hold?"),
          status: U("not_reported"),
          handledBy: U("not_reported"),
        },
      ],
      totalRows: 2,
      skipped: 0,
      next: U("not_applicable"),
    },
    summary: {
      entities: K(2),
      edges: K(1),
      claims: K(2),
      verdicts: K([
        { assessment: "supported", count: 1 },
        { assessment: "unassessed", count: 1 },
      ]),
      generatedAt: K("2026-10-17T09:00:00.000Z"),
      inputsDigest: K("0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f"),
      leads: K(2),
      openLeads: K(1),
    },
  },
  morePagesWithNoLeadsFolder: {
    teamId: "research",
    graph: {
      state: "available",
      nodes: [],
      edges: [],
      totalNodes: 6000,
      totalEdges: 9000,
      skipped: 3,
      nextNodes: K(1000),
      nextEdges: K(1000),
    },
    leads: { state: "unavailable", reason: "file_missing" },
    summary: {
      entities: K(6000),
      edges: K(9000),
      claims: U("not_reported"),
      verdicts: U("not_reported"),
      generatedAt: U("not_reported"),
      inputsDigest: U("not_reported"),
      leads: U("unavailable"),
      openLeads: U("unavailable"),
    },
  },
  notRunning: {
    teamId: "research",
    graph: { state: "unavailable", reason: "not_running" },
    leads: { state: "unavailable", reason: "no_head" },
    summary: unavailableSummary,
  },
  containerMissingAndTooLarge: {
    teamId: "research",
    graph: { state: "unavailable", reason: "container_missing" },
    leads: { state: "unavailable", reason: "too_large" },
    summary: unavailableSummary,
  },
  unreadableAndInvalid: {
    teamId: "research",
    graph: { state: "unavailable", reason: "invalid" },
    leads: { state: "unavailable", reason: "unreadable" },
    summary: unavailableSummary,
  },
} satisfies Record<string, ResearchViewResponse>

// ---- A generated view the size of a small team's, paged ------------------------------------------------------

const types = ["Person", "Person", "Person", "Work", "Org", "Idea", "Place", "Agent"]
const predicates = ["made", "founded", "member_of", "carried", "transformed", "played_at", "influenced"]

// A small deterministic generator, so every screenshot draws the same view.
function seeded(seed: number) {
  const state = { value: seed }
  return () => {
    state.value = (state.value * 1664525 + 1013904223) % 4294967296
    return state.value / 4294967296
  }
}

function generate() {
  const random = seeded(7)
  const nodes: ResearchNode[] = Array.from({ length: 180 }, (_, index) => {
    const type = types[Math.floor(random() * types.length)]!
    return { id: `${type.toLowerCase()}:fixture-${index}`, type, label: text(`Fixture ${type.toLowerCase()} ${index}`) }
  })
  // Edges cluster in two neighbourhoods with a few links across, like a merged view with a gap.
  const pick = (cluster: number) => nodes[cluster * 90 + Math.floor(random() * 90)]!
  const edges: ResearchEdge[] = Array.from({ length: 240 }, (_, index) => {
    const cluster = index % 2
    const across = random() < 0.04
    const source = pick(cluster)
    const target = pick(across ? 1 - cluster : cluster)
    const claims = 1 + Math.floor(random() * 3)
    const roll = random()
    const assessment: { assessment: ResearchAssessment; count: number }[] =
      roll < 0.62
        ? [{ assessment: "unassessed", count: claims }]
        : roll < 0.82
          ? [{ assessment: "supported", count: claims }]
          : roll < 0.88
            ? [
                { assessment: "supported", count: 1 },
                { assessment: "unassessed", count: claims },
              ]
            : roll < 0.93
              ? [{ assessment: "reproduced", count: claims }]
              : roll < 0.97
                ? [
                    { assessment: "contested", count: 1 },
                    { assessment: "supported", count: claims },
                  ]
                : [{ assessment: "contradicted", count: claims }]
    return {
      id: `e${index}`,
      source: source.id,
      target: target.id,
      predicate: predicates[Math.floor(random() * predicates.length)]!,
      claims: assessment.reduce((sum, item) => sum + item.count, 0),
      assessment,
    }
  })
  const statuses = ["open", "open", "closed", "open", "parked"]
  const handlers = ["research/scout", "research/extractor", "research/resolver"]
  const leads: ResearchLead[] = Array.from({ length: 14 }, (_, index) => {
    const file = `RES-${60 + Math.floor(index / 5)}`
    return {
      id: `${file}:L${String((index % 5) + 1).padStart(3, "0")}`,
      file,
      question: text(`(fixture) Lead ${index + 1}: which source would settle this question about the collected graph?`),
      status: index % 6 === 5 ? U("not_reported") : K(statuses[index % statuses.length]!),
      handledBy: index % 4 === 3 ? U("not_reported") : K(handlers[index % handlers.length]!),
    }
  })
  return { nodes, edges, leads }
}

const view = generate()

export function researchFixture(request: ResearchViewRequest, pageSize = 100): ResearchViewResponse {
  const nodesFrom = request.nodesFrom ?? 0
  const edgesFrom = request.edgesFrom ?? 0
  const leadsFrom = request.leadsFrom ?? 0
  const next = (from: number, total: number) =>
    from + pageSize < total ? K(from + pageSize) : U("not_applicable")
  const verdicts = new Map<ResearchAssessment, number>()
  view.edges.forEach((edge) =>
    edge.assessment.forEach((item) => verdicts.set(item.assessment, (verdicts.get(item.assessment) ?? 0) + item.count)),
  )
  return {
    teamId: request.teamId,
    graph: {
      state: "available",
      nodes: view.nodes.slice(nodesFrom, nodesFrom + pageSize),
      edges: view.edges.slice(edgesFrom, edgesFrom + pageSize),
      totalNodes: view.nodes.length,
      totalEdges: view.edges.length,
      skipped: 0,
      nextNodes: next(nodesFrom, view.nodes.length),
      nextEdges: next(edgesFrom, view.edges.length),
    },
    leads: {
      state: "available",
      files: new Set(view.leads.map((lead) => lead.file)).size,
      rows: view.leads.slice(leadsFrom, leadsFrom + pageSize),
      totalRows: view.leads.length,
      skipped: 0,
      next: next(leadsFrom, view.leads.length),
    },
    summary: {
      entities: K(view.nodes.length),
      edges: K(view.edges.length),
      claims: K(view.edges.reduce((sum, edge) => sum + edge.claims, 0)),
      verdicts: K([...verdicts].map(([assessment, count]) => ({ assessment, count }))),
      generatedAt: K("2026-10-25T09:00:00.000Z"),
      inputsDigest: K("3b7e1f0c9a2d4e8b6c1f5a0d7e9b2c4a8f6e1d3c5b7a9e0f2d4c6b8a1e3f5d7c"),
      leads: K(view.leads.length),
      openLeads: K(view.leads.filter((lead) => lead.status.state === "known" && lead.status.value === "open").length),
    },
  }
}
