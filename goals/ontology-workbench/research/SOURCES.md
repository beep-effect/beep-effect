# Ontology Workbench — Sources & Provenance

- **Source exploration:** none — authored directly from a `/grill-with-docs`
  interview (2026-07-08). The align/shape/decompose work normally done in an
  exploration packet happened in that session; its 13 locked decisions are
  recorded as `SPEC.md` Constraints.
- **Round 2 (same day, post-ship):** a second `/grill-with-docs` round
  (9 locked decisions, recorded as `SPEC.md` Constraints 13–18 + scope
  changes) after exploring the ontosphere reference repo; phases were
  restructured P0–P6.
- **Provenance:** five Codex research reports saved verbatim in this
  directory (each ends with its Codex session/thread ID):
  - [`ontology-playground-report.md`](./ontology-playground-report.md) —
    survey of the reference repo `Ontology-Playground`.
  - [`beep-repo-capability-report.md`](./beep-repo-capability-report.md) —
    in-repo capability inventory (professional-desktop shape, slice template,
    reusable substrate, packet format).
  - [`graph-performance-report.md`](./graph-performance-report.md) —
    large-graph web rendering landscape and Tauri WebGPU reality check.
  - [`ontosphere-survey-report.md`](./ontosphere-survey-report.md) — deep
    survey of the ontosphere reference repo (stack, architecture, features,
    patterns, anti-patterns, docs/benchmark inventory).
  - [`ontosphere-delta-report.md`](./ontosphere-delta-report.md) —
    prioritized delta analysis of ontosphere against this packet's locked
    decisions (15 opportunities + validations).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `op-graph` | Cytoscape graph setup, incremental form↔graph sync, focus-neighborhood | Ontology-Playground | `src/components/OntologyGraph.tsx`, `src/components/designer/DesignerPreview.tsx` | viz interaction patterns | port-with-attribution (patterns; renderer differs — we use cosmos.gl) |
| `op-designer` | Split-pane designer (forms left, live preview right), undo/redo snapshot store, validation rules | Ontology-Playground | `src/components/OntologyDesigner.tsx`, `src/store/designerStore.ts` | editor UX + history discipline | port-with-attribution (patterns; our history is change-op based, not snapshots) |
| `op-panels` | Inspector, stats, path finder (BFS), search/filter side panels | Ontology-Playground | `src/components/InspectorPanel.tsx`, `src/lib/pathFinder.ts`, `src/components/SearchFilter.tsx` | explorer UX | port-with-attribution |
| `op-roundtrip` | Build-time catalogue compile + RDF parse/serialize round-trip validation | Ontology-Playground | `scripts/compile-catalogue.ts`, `scripts/validate-rdf.ts` | round-trip proof discipline | port-with-attribution (idea feeds the P1 fixture round-trip test) |
| `op-parser` | Hand-rolled RDF/XML DOMParser parser/serializer | Ontology-Playground | `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts` | anti-template | reference only (cautionary; we wrap N3.js instead) |
| `os-partitions` | Derived named-graph session partitions (data/ontologies/inferred/shapes/provenance) with ONE shared reasoning-exclusion rule | ontosphere | `src/workers/rdfManager.runtime.ts` (`EXCLUDED_FROM_REASONING`), `src/mcp/manifest.ts` | session architecture | port-with-attribution (as derived indexes; files+change-log stay truth) |
| `os-worker-protocol` | Typed worker protocol with runtime-validated command payloads | ontosphere | `src/utils/rdfManager.workerProtocol.ts` | worker boundary discipline | port-with-attribution (re-expressed as Effect Schema) |
| `os-abox-tbox` | ABox/TBox view classification as ONE rule shared by canvas + search; drag-type-to-instantiate | ontosphere | `src/providers/N3DataProvider.ts` (`classifyEntityView`), `src/components/Canvas/ReactodiaCanvas.tsx` | explorer/editor semantics | port-with-attribution |
| `os-folding` | Fold levels L0–L3; structural grouping BEFORE community clustering; auto-cluster threshold; worker layouts with phantom fixed-node substitution | ontosphere | `src/components/Canvas/core/ClusterLevelManager.ts`, `structuralGroups.ts`, `clusterAlgorithms/*`, `layout/*` | visualizer LOD | port-with-attribution (renderer differs — cosmos.gl) |
| `os-repairs` | Ranked repair suggestions verified against the store, applied as one undoable operation | ontosphere | `src/components/Canvas/RepairSuggestions.tsx`, `src/mcp/tools/computeRepairs.ts` | validation → change-op proposals | port-with-attribution (proposals become typed change ops) |
| `os-shacl` | SHACL shapes graph, validation over asserted+inferred, panel with focus-node navigation | ontosphere | `src/utils/shaclShapeLoader.ts`, `src/components/Canvas/ShaclShapesPanel.tsx` | validation lane | port-with-attribution (engine behind `@beep/semantic-web` contract) |
| `os-sparql-ux` | SPARQL panel UX: prefix-aware defaults, examples, Ctrl/Cmd+Enter, LIMIT injection, result truncation | ontosphere | `src/components/Canvas/SparqlPanel.tsx`, `src/mcp/tools/graph.ts` | query UX + safeguards | port-with-attribution (engine stays Oxigraph) |
| `os-invalidation` | Incremental reasoning: changed-signature accumulation, module-scoped recompute, drift-cap fail-closed full pass | ontosphere | `src/workers/rdfManager.runtime.ts`, `rdfManager.workerProtocol.ts` | inference invalidation | port-with-attribution (technique only; our inference stays domain-native) |
| `os-provenance` | PROV-O edit journal with real added/removed deltas and batch revert (volatile in ontosphere — cautionary) | ontosphere | `src/mcp/provenance.ts` | provenance export | port-with-attribution (derived from our durable change log instead) |
| `os-metrics` | Worker-computed metrics + OQuaRE-flavored quality heuristics panel | ontosphere | `src/components/Canvas/MetricsPanel.tsx` | observability panel | port-with-attribution |
| `os-benchmarks` | ontoauthor-mat competency tasks t1–t6 (task.md + cq.sparql + reference.ttl + shapes.ttl) + pizza/FOAF demo ontologies + stepwise pizza tutorial | ontosphere | `benchmarks/ontoauthor-mat/**`, `docs/mcp-demo/**` | canonical test fixtures + E2E script | port-with-attribution (Apache-2.0) |
| `os-mcp` | 43-tool MCP surface with manifest-as-doctrine (graph roles, batching rules, workflows) | ontosphere | `src/mcp/manifest.ts`, `ontosphereMcpServer.ts`, `tools/*` | agent surface blueprint | reference only (blueprint for the `ontology-agent-tools` follow-up packet) |
| `os-runtime` | 6,222-line worker runtime module; volatile persistence; Konclude SharedArrayBuffer/COOP/COEP hosting constraint | ontosphere | `src/workers/rdfManager.runtime.ts`, `src/mcp/provenance.ts` | anti-template | reference only (cautionary: keep boundaries small, persistence durable) |

**How these inform implementation:** the playground's UI composition and
history/validation discipline transfer; its semantics do not (no axioms, no
individuals editing, no SPARQL/reasoning, RDF/XML-only). Our stack replaces
every semantic layer with real libraries behind drivers. ontosphere is the
inverse: semantically deep (OWL DL reasoning, SHACL, repairs, MCP) but built
on a renderer/engine stack we rejected — we port its disciplines and fixtures,
not its stack.

### Evaluated and deferred (round-2 interview, 2026-07-08)

| Item | ontosphere evidence | Decision |
|------|---------------------|----------|
| Term-reuse search before IRI minting | `rdfManager.runtime.ts` ranked label/localname search | Not adopted (interview Q3); revisit post-packet |
| Namespace legend + guarded bulk URI rename | `rdfManager.workerProtocol.ts` `RenameNamespaceUriPayload` | Not adopted (interview Q3); revisit post-packet |
| Comunica as SPARQL engine | `package.json` `@comunica/query-sparql-rdfjs` | Rejected — Oxigraph contract stays locked; panel UX adopted |
| Reactodia as renderer | `package.json` `@reactodia/workspace`, `docs/reactodia-vs-reactflow-analysis.md` | Rejected — cosmos.gl stays locked; interaction semantics adopted |
| EL fast path / Konclude OWL 2 DL baseline | `rdfManager.runtime.ts` EL + Konclude WASM | Rejected as baseline (interview Q6); recorded as reasoner-port candidates (SharedArrayBuffer/COOP/COEP caveat) |
| Multi-format + remote loading (`rdf-parse`) | `rdfManager.impl.ts` import paths | Stays a non-goal (future packet) |
| MCP/agent tool surface | `src/mcp/**` (43 tools) | Deferred to named follow-up packet `ontology-agent-tools`; this packet is agent-ready by construction (SPEC 16) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Ontology-Playground (local checkout: `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontology-Playground`) | MIT (`LICENSE`) | port-with-attribution | UI patterns per corpus table above |
| ontosphere (local checkout: `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere`; citable — `CITATION.cff`, ISWC 2026 paper in-repo) | Apache-2.0 (`LICENSE`) | port-with-attribution | Session/worker/validation disciplines, fixtures, and panel UX per `os-*` corpus rows; renderer/engine stack explicitly not taken. Its own `ACKNOWLEDGEMENTS.md` credits Konclude, Reactodia, N3.js, SHACL, ELK/Dagre, Comunica |
| cosmos.gl `@cosmos.gl/graph` (https://github.com/cosmosgl/graph) | MIT | dependency (wrapped in `packages/drivers/cosmos`) | WebGL2 GPU force sim + rendering |
| sigma.js + graphology (https://www.sigmajs.org/) | MIT | dependency (fallback path) | WebGL renderer + worker layouts |
| N3.js | MIT | dependency (wrapped in `packages/drivers/n3`) | Turtle parse/serialize |
| Oxigraph (WASM npm build) | MIT/Apache-2.0 | dependency (wrapped in `packages/drivers/oxigraph`) | SPARQL 1.1 in-memory store |

License verification of the npm dependencies happens at driver-creation time
(P1/P3/P4); the table records the expected SPDX from upstream metadata.

## 3. External research sources

All URLs below appear on disk in
[`graph-performance-report.md`](./graph-performance-report.md) (Sources
section), including: cosmos.gl repo + Cosmograph docs + million-node writeup,
sigma.js docs, react-sigma worker layouts, AntV G6, react-force-graph /
3d-force-graph, ngraph.pixel / ngraph.forcelayout, Tauri webview versions,
WebGPU implementation status / caniuse, WebGPU compute samples,
d3-force-webgpu.

## 4. In-repo capability references

| Capability | Package path | Use |
|------------|--------------|-----|
| RDF value models (IRI, CURIE, named node, literal, quad, dataset, JSON-LD) | `packages/foundation/modeling/rdf` (`@beep/rdf`) | reuse — slice domain builds on these |
| SPARQL / SHACL / canonicalization service contracts | `packages/foundation/capability/semantic-web` (`@beep/semantic-web`) | reuse — Oxigraph driver implements the SPARQL contract; SHACL driver implements the SHACL contract |
| RDF canonicalization driver | `packages/drivers/rdf-canonize` (`@beep/rdf-canonize`) | reuse — round-trip fingerprint proof |
| FOLIO-oriented OWL models | `packages/foundation/modeling/ontology` (`@beep/ontology`) | adjacent only — disambiguate, do not extend |
| UI system (shadcn, Tailwind v4, MUI X Tree View, D3 knowledge-graph) | `packages/foundation/ui-system/ui` (`@beep/ui`) | reuse — tree explorer, panels; knowledge-graph component NOT the main viewport |
| Rich text/code surfaces | `@beep/editor` | reuse — Turtle source view |
| Slice RPC/atom pattern | `packages/agents/{use-cases,client,server}` + `apps/professional-desktop/src/runtime` | template — OntologyRpcs follows ChatRpcs |
| Canonical slice topology | `packages/architecture-lab/*` | template — package shape proof |
| Turtle codec driver | `packages/drivers/n3` | NET-NEW |
| Graph viewport driver | `packages/drivers/cosmos` | NET-NEW |
| SPARQL engine driver | `packages/drivers/oxigraph` | NET-NEW |
| SHACL validation driver | `packages/drivers/shacl` | NET-NEW |
| Ontology slice | `packages/ontology/{domain,use-cases,server,client,ui}` | NET-NEW |

## 5. Cross-links & provenance

- Prior packets: [`goals/ontology-modeling-foundation`](../../ontology-modeling-foundation)
  (superseded) and [`goals/ontology-interop-roadmap`](../../ontology-interop-roadmap)
  (complete) — foundation modeling work, related but non-overlapping; this
  packet builds a product feature that edits user ontology documents.
- Repo-internal schema-derived ontology authoring belongs to
  [`explorations/identity-as-iri`](../../../explorations/identity-as-iri);
  boundary noted in `SPEC.md` Non-Goals.
- Decision log: `SPEC.md` Constraints — 1–12 locked during the 2026-07-08
  grilling interview (the viz decision, cosmos.gl over Cytoscape, superseded
  an interim choice after the performance research landed); 13–18 locked in
  the same-day round-2 interview (9 decisions) after the ontosphere
  exploration, which also restructured the phases to P0–P6 and named the
  `ontology-agent-tools` follow-up packet.
