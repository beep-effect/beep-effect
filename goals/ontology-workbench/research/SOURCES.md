# Ontology Workbench — Sources & Provenance

- **Source exploration:** none — authored directly from a `/grill-with-docs`
  interview (2026-07-08). The align/shape/decompose work normally done in an
  exploration packet happened in that session; its 13 locked decisions are
  recorded as `SPEC.md` Constraints.
- **Provenance:** three Codex research reports saved verbatim in this
  directory (each ends with its Codex session ID):
  - [`ontology-playground-report.md`](./ontology-playground-report.md) —
    survey of the reference repo `Ontology-Playground`.
  - [`beep-repo-capability-report.md`](./beep-repo-capability-report.md) —
    in-repo capability inventory (professional-desktop shape, slice template,
    reusable substrate, packet format).
  - [`graph-performance-report.md`](./graph-performance-report.md) —
    large-graph web rendering landscape and Tauri WebGPU reality check.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `op-graph` | Cytoscape graph setup, incremental form↔graph sync, focus-neighborhood | Ontology-Playground | `src/components/OntologyGraph.tsx`, `src/components/designer/DesignerPreview.tsx` | viz interaction patterns | port-with-attribution (patterns; renderer differs — we use cosmos.gl) |
| `op-designer` | Split-pane designer (forms left, live preview right), undo/redo snapshot store, validation rules | Ontology-Playground | `src/components/OntologyDesigner.tsx`, `src/store/designerStore.ts` | editor UX + history discipline | port-with-attribution (patterns; our history is change-op based, not snapshots) |
| `op-panels` | Inspector, stats, path finder (BFS), search/filter side panels | Ontology-Playground | `src/components/InspectorPanel.tsx`, `src/lib/pathFinder.ts`, `src/components/SearchFilter.tsx` | explorer UX | port-with-attribution |
| `op-roundtrip` | Build-time catalogue compile + RDF parse/serialize round-trip validation | Ontology-Playground | `scripts/compile-catalogue.ts`, `scripts/validate-rdf.ts` | round-trip proof discipline | port-with-attribution (idea feeds the P1 fixture round-trip test) |
| `op-parser` | Hand-rolled RDF/XML DOMParser parser/serializer | Ontology-Playground | `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts` | anti-template | reference only (cautionary; we wrap N3.js instead) |

**How these inform implementation:** the playground's UI composition and
history/validation discipline transfer; its semantics do not (no axioms, no
individuals editing, no SPARQL/reasoning, RDF/XML-only). Our stack replaces
every semantic layer with real libraries behind drivers.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Ontology-Playground (local checkout: `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/Ontology-Playground`) | MIT (`LICENSE`) | port-with-attribution | UI patterns per corpus table above |
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
| SPARQL / SHACL / canonicalization service contracts | `packages/foundation/capability/semantic-web` (`@beep/semantic-web`) | reuse — Oxigraph driver implements the SPARQL contract |
| RDF canonicalization driver | `packages/drivers/rdf-canonize` (`@beep/rdf-canonize`) | reuse — round-trip fingerprint proof |
| FOLIO-oriented OWL models | `packages/foundation/modeling/ontology` (`@beep/ontology`) | adjacent only — disambiguate, do not extend |
| UI system (shadcn, Tailwind v4, MUI X Tree View, D3 knowledge-graph) | `packages/foundation/ui-system/ui` (`@beep/ui`) | reuse — tree explorer, panels; knowledge-graph component NOT the main viewport |
| Rich text/code surfaces | `@beep/editor` | reuse — Turtle source view |
| Slice RPC/atom pattern | `packages/agents/{use-cases,client,server}` + `apps/professional-desktop/src/runtime` | template — OntologyRpcs follows ChatRpcs |
| Canonical slice topology | `packages/architecture-lab/*` | template — package shape proof |
| Turtle codec driver | `packages/drivers/n3` | NET-NEW |
| Graph viewport driver | `packages/drivers/cosmos` | NET-NEW |
| SPARQL engine driver | `packages/drivers/oxigraph` | NET-NEW |
| Ontology slice | `packages/ontology/{domain,use-cases,server,client,ui}` | NET-NEW |

## 5. Cross-links & provenance

- Prior packets: [`goals/ontology-modeling-foundation`](../../ontology-modeling-foundation)
  (superseded) and [`goals/ontology-interop-roadmap`](../../ontology-interop-roadmap)
  (complete) — foundation modeling work, related but non-overlapping; this
  packet builds a product feature that edits user ontology documents.
- Repo-internal schema-derived ontology authoring belongs to
  [`explorations/identity-as-iri`](../../../explorations/identity-as-iri);
  boundary noted in `SPEC.md` Non-Goals.
- Decision log: `SPEC.md` Constraints (13 items) — locked during the
  2026-07-08 grilling interview; the viz decision (cosmos.gl over Cytoscape)
  superseded an interim choice after the performance research landed.
