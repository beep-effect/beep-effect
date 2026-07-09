Root inspected: `/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere`. I kept this read-only and did not run build/test commands because they may create caches or generated output.

## 1. Project Purpose, Maturity, License

Ontosphere is a browser-only ontology/RDF workbench: a React/TypeScript app for loading RDF/OWL graphs, visually editing nodes and triples, running OWL reasoning, validating with SHACL, querying with SPARQL, exporting graph/data artifacts, and exposing the whole surface through MCP tools for AI agents. The package description says it is a “Browser-based interactive RDF/ontology knowledge graph editor” with OWL 2 DL reasoning, clustering, layout, and MCP support, running entirely client-side in [package.json](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:2). The README’s overview says all computation runs in-browser against an in-memory RDF store backed by Web Workers, with no backend required in [README.md](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/README.md:64).

Maturity signals are strong for a research/demo-grade but serious workbench: version `1.5.2`, public package metadata, Apache-2.0 license, DOI/paper links, a large README, release notes, demo videos, Playwright e2e specs, Vitest coverage, benchmark fixtures, patches for upstream packages, and dedicated scripts for MCP generation and demo recording. There is some version drift: the README badge still says `1.5.0`, while `package.json` says `1.5.2`.

License: `Apache-2.0` in [package.json](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:4), with the full Apache License 2.0 text and copyright attribution to Thomas Hanke and Fraunhofer IWM in [LICENSE](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/LICENSE:1).

## 2. Tech Stack And Notable Libraries

Only root JS/TS package manifests were present: `package.json`, `package-lock.json`, and `bun.lockb`. I did not find `Cargo.toml`, `pyproject.toml`, or root `requirements*.txt`.

| Area | Libraries / Versions | Evidence | Role |
|---|---:|---|---|
| App/runtime | React `19.2.0`, React DOM `19.2.0`, Vite `^7.1.12`, TypeScript `^5.9.3` | [package.json:124](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:124) | Browser SPA and build toolchain. |
| Graph editor/rendering | `@reactodia/workspace` `0.34.1` | [package.json:101](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:101) | Main canvas, visual authoring, layout worker integration, templates. |
| RDF parsing/store | `n3` `1.26.0`, `rdf-parse` `4.0.0`, `@rdfjs/data-model` `^2.1.1`, `@rdfjs/dataset` `^2.0.2` | [package.json:99](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:99) | RDF terms, store, streaming parser, SHACL dataset conversion. |
| RDF canonicalization | `rdf-canonize` `^5.0.0` | [package.json:121](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:121) | W3C RDFC-1.0 canonical N-Quads and hash. |
| SPARQL | `@comunica/query-sparql-rdfjs` `^5.2.1`, `sparqljs` `^3.7.4` | [package.json:71](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:71) | Worker-side SPARQL engine plus query parsing/rewriting. |
| OWL reasoning | `rdf-reasoner-konclude` `^0.3.2`; N3 reasoner fallback | [package.json:123](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:123) | Konclude WASM OWL DL reasoning, plus N3 rulesets. |
| SHACL | `shacl-engine` `^1.1.0` | [package.json:131](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:131) | Data+inferred validation against shapes graph. |
| Layout engines | `dagre` `0.8.5`, `elkjs` `0.11.0`, Reactodia default layout worker | [package.json:107](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:107) | Horizontal/vertical Dagre; ELK layered/force/stress/radial surfaces. |
| Clustering / graph algorithms | `ml-kmeans` `7.0.0`, `ngraph.graph` `20.1.1`, `ngraph.louvain` `2.0.0`, `ngraph.coarsen` `1.5.0`, `ngraph.slpa` `0.1.0` | [package.json:114](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:114) | Community detection and large graph folding. |
| State | `zustand` `5.0.8`, `@tanstack/react-query` `5.90.6` | [package.json:102](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:102) | Config, settings, ontology and workflow state. |
| UI/components | Radix UI packages, `lucide-react` `0.552.0`, `sonner` `2.0.7`, `cmdk` `1.1.1`, `react-resizable-panels` `3.0.6`, `recharts` `3.3.0` | [package.json:72](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:72) | shadcn/Radix-style controls, icons, toasts, panels, metrics. |
| Workers/WASM | RDF manager worker, Dagre worker, ELK worker, Reactodia layout worker, Konclude WASM worker, Pyodide workflow worker | [ReactodiaCanvas.tsx:59](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ReactodiaCanvas.tsx:59), [pyodide.runtime.ts:28](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/pyodide.runtime.ts:28) | Off-main-thread parse/query/reason/layout/workflow execution. |
| Server/dev glue | `express` `5.1.0`, `socket.io` `4.8.3`, `coi-serviceworker` `^0.1.7` | [package.json:110](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:110) | Local/static serving, relay demos, COOP/COEP support. |
| Testing | Vitest `^4.0.6`, Playwright `^1.59.1`, Testing Library React `^16.3.2`, jsdom `^27.1.0` | [package.json:141](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:141) | Unit, integration, browser/e2e. |

Editors: no Monaco/Codemirror dependency. Editing is Reactodia visual authoring plus custom property panels and a plain textarea SPARQL editor.

## 3. Architecture Map

High-level flow:

1. `src/main.tsx` initializes theme/config/debug flags, registers MCP, and mounts the React app.
2. `src/App.tsx` wraps routing, React Query, tooltips, and deferred workflow catalog loading.
3. `src/pages/Index.tsx` renders the main `ReactodiaCanvas`.
4. `ReactodiaCanvas` wires Reactodia, app config, search, layout, authoring, inferred graph display, view switching, undo/redo, file load, export, and reasoning.
5. `rdfManager` is a main-thread facade over `rdfManager.workerClient`, which talks to `src/workers/rdfManager.worker.ts` and `src/workers/rdfManager.runtime.ts`.
6. The worker owns the N3 store, RDF parse/import/export, SPARQL, SHACL, OWL reasoning, incremental reasoning, module extraction, namespaces, and subject-change events.
7. `N3DataProvider` adapts RDF quads to Reactodia models and indexes subjects, types, inferred markings, graph names, ABox/TBox membership, structural groups, and community clusters.
8. MCP tools call the same RDF manager and workspace context, so agent edits flow through the same store/canvas/reasoning pipeline as UI edits.

Key module boundaries:

| Boundary | Files | Responsibility |
|---|---|---|
| Rendering/editing | `src/components/Canvas/ReactodiaCanvas.tsx`, templates under `src/templates/`, `NodePropertyEditor.tsx`, `rdfPropertyEditor.tsx` | Reactodia canvas, authoring, visual templates, property editing, keyboard undo/redo. |
| RDF facade | `src/utils/rdfManager.ts`, `src/utils/rdfManager.impl.ts`, `src/utils/rdfManager.workerClient.ts` | Main-thread API and worker RPC wrapper. |
| Worker protocol | `src/utils/rdfManager.workerProtocol.ts`, `src/utils/rdfSerialization.ts` | Typed commands/payload validation for worker calls. |
| RDF/runtime | `src/workers/rdfManager.runtime.ts` | Store, import/export, SPARQL, SHACL, Konclude/N3 reasoning, incremental reasoning, modules. |
| Canvas adapter/index | `src/providers/N3DataProvider.ts` | Reactodia data provider, search/type/class indexes, inferred metadata, clustering inputs. |
| Layout | `src/components/Canvas/layout/*` | Dagre/ELK workers, fixed-node phantom substitution, silent layout. |
| Large graph folding | `src/components/Canvas/core/ClusterLevelManager.ts`, `structuralGroups.ts`, `clusterAlgorithms/*` | L0-L3 fold levels, structural groups, community clustering. |
| State/persistence | `src/stores/appConfigStore.ts`, `settingsStore.ts`, `ontologyStore.ts`, `stateStorage.ts` | Zustand stores, browser `localStorage`, loaded ontology metadata/config. |
| MCP/AI | `src/mcp/manifest.ts`, `ontosphereMcpServer.ts`, `workspaceContext.ts`, `tools/*`, `relayBridge.ts` | 43-tool MCP surface, relay bridge, provenance, graph/navigation/reasoning/edit tools. |
| Workflows/Pyodide | `src/workers/pyodide.*`, workflow stores/utils/components | Offthread Python workflow execution and workflow template catalog. |

Named graph/persistence model:

| Graph | Purpose |
|---|---|
| `urn:vg:data` | Asserted user/data triples; most mutations write here. |
| `urn:vg:ontologies` | Loaded ontology/schema triples. |
| `urn:vg:inferred` | OWL/N3 inferred triples; can be cleared independently. |
| `urn:vg:shapes` | SHACL shapes. |
| `urn:vg:workflows` | Workflow/catalog data. |
| `urn:vg:provenance` | PROV-O agent edit journal sidecar. |

The graph partition is explicitly documented in the MCP server description in [manifest.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/manifest.ts:16). The RDF runtime centralizes reasoner exclusions, with the important excerpt `EXCLUDED_FROM_REASONING` covering workflows, inferred, shapes, and provenance in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:315). Dataset-faithful exports collect `urn:vg:data`, `urn:vg:inferred`, `urn:vg:shapes`, `urn:vg:ontologies`, and `urn:vg:workflows` in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:3761).

Persistence is deliberately browser-local and mostly volatile. App/settings live in `localStorage` via Zustand persist keys such as `ontology-painter-config` in [appConfigStore.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/stores/appConfigStore.ts:95). The RDF store and provenance journal are in-memory; provenance comments explicitly say reload clears both data and provenance in [provenance.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/provenance.ts:30).

Offthread boundaries:

| Worker/offthread path | Role |
|---|---|
| `src/workers/rdfManager.worker.ts` / `rdfManager.runtime.ts` | RDF parse/import/export, store mutation, SPARQL, SHACL, reasoning. |
| `public/rdf-reasoner-konclude/worker.js` expected by runtime | Konclude WASM worker copied by `postinstall`. |
| `src/components/Canvas/layout/dagre.worker.ts` | Dagre layout. |
| `src/components/Canvas/layout/elk.worker.ts` | ELK layout worker. |
| Reactodia layout worker | Default Reactodia/cola-style layout. |
| `src/workers/pyodide.worker.ts` / `pyodide.runtime.ts` | Python workflow execution, stdout/stderr/input events. |

## 4. Feature Inventory

Explorer/navigation:
- ABox/TBox view switching, each with its own saved layout/imported diagram state in `ReactodiaCanvas`.
- Search by label/IRI, class tree/entity sections, match counter, keyboard cycling.
- Pan/zoom/minimap/fit/focus through Reactodia plus MCP `focusNode` and `fitCanvas`.
- Namespace legend and color palette with namespace URI rename support.
- `getNeighbors` and `findPath` MCP navigation tools.

Import/loading:
- Local RDF file load with `.ttl`, `.owl`, `.rdf`, `.n3`, `.nt`, `.jsonld`, `.trig`, `.nq`, `.xml` accepted in [ReactodiaCanvas.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ReactodiaCanvas.tsx:1731).
- Remote URL loading, CORS proxy fallback, SPARQL endpoint CONSTRUCT loading in [rdfManager.impl.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.impl.ts:1213).
- Streaming RDF parse through `rdf-parse`; import chunks of `5000` quads with progress events in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:4036).
- `owl:imports` discovery and well-known ontology registry in `ontologyStore` / `wellKnownOntologies`.

Editing:
- Reactodia always-on authoring: add nodes, link halo, relation changes, entity deletions.
- Custom node property editor that avoids RDF reads at render time and writes minimal RDF on save; its own comment calls this a “streamlined” editor in [NodePropertyEditor.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/NodePropertyEditor.tsx:3).
- Undo/redo delegates to Reactodia model history; excerpts are `model.history.undo()` and `model.history.redo()` in [ReactodiaCanvas.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ReactodiaCanvas.tsx:1707).
- MCP mutation tools: `loadRdf`, `addNode`, `updateNode`, `removeNode`, `addTriple`, `removeLink`, namespace tools.

Visualization modes:
- Reactodia canvas with custom RDF element/link templates.
- ABox/TBox split using `classifyEntityView`, where unknown resources default to ABox in [N3DataProvider.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/providers/N3DataProvider.ts:91).
- Fold levels L0-L3: annotation hiding, structural grouping, community clusters.
- Layouts: Dagre LR/TB, ELK layered/force/stress/radial surfaces, Reactodia default.
- Export canvas as PNG/SVG/print.

Search/query:
- Search index from `N3DataProvider`, with data/inferred graph allowlist.
- SPARQL panel with prefix insertion, examples, Ctrl/Cmd+Enter, SELECT/CONSTRUCT/ASK/UPDATE rendering in [SparqlPanel.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/SparqlPanel.tsx:25).
- MCP `queryGraph` injects prefixes, parses with `sparqljs`, and injects LIMIT when missing in [graph.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/tools/graph.ts:315).
- Worker-side Comunica uses `unionDefaultGraph: true` in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:5092).

Reasoning/inference:
- Konclude OWL 2 DL path with consistency check, reasoning, MIPS inconsistency explanations, and inferred graph replacement in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:5480).
- N3 backend fallback with public rulesets under `public/reasoning-rules`.
- Incremental reasoning using locality modules and subject-local inferred graph splicing in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:2696).
- EL fast path guarded by conformance/fallback-to-Konclude logic in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:2828).
- Entailment explanation, module extraction, OWL profile checks, repair suggestions.

Validation:
- SHACL shapes loaded into `urn:vg:shapes`; direct URL and GitHub folder support in [shaclShapeLoader.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/shaclShapeLoader.ts:75).
- SHACL validates asserted data plus inferred graph in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:2283).
- SHACL panel groups shapes, constraints, validation messages, and can navigate to focus nodes in [ShaclShapesPanel.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ShaclShapesPanel.tsx:29).

Import/export formats:
- Import: Turtle, N3, N-Triples, N-Quads, TriG, JSON-LD, RDF/XML/OWL/XML through `rdf-parse` and file/MIME hints.
- Export: Turtle, JSON-LD, RDF/XML, N-Quads, TriG in [rdfManager.impl.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.impl.ts:1605).
- RDFC-1.0 canonical N-Quads and hash in [rdfManager.impl.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.impl.ts:1674).
- Metadata generation: VoID/DCAT via `src/utils/voidGenerator.ts` and `src/mcp/tools/metadataTools.ts`.

Collaboration/AI:
- Browser MCP server with 43 tools in README and manifest.
- `window.__mcpTools` built even when `navigator.modelContext` is missing, for relay/browser automation in [ontosphereMcpServer.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/ontosphereMcpServer.ts:55).
- Relay bridge/bookmarklet docs and components.
- PROV-O edit provenance and one-click batch reversal.

## 5. Standout Patterns Worth Porting

1. Named graph partition as the central contract.
   The repo has a clean split between asserted data, ontologies, inferred triples, SHACL, workflows, and provenance. The strongest part is that the reasoner and module extractor share a single exclusion definition instead of scattered filters. Port this pattern wholesale.

2. Typed worker protocol with runtime validation.
   `RDFWorkerCommandPayloads` defines every command, including `runReasoning`, `importSerialized`, `sparqlQuery`, `verifyRepair`, `searchTerms`, `extractModule`, and `reasonIncremental` in [rdfManager.workerProtocol.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.workerProtocol.ts:104). Validators start around [rdfManager.workerProtocol.ts:287](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.workerProtocol.ts:287). This is a good pattern for worker-heavy ontology tools.

3. RDF store as source of truth; canvas as projection.
   Reactodia authoring is flushed into RDF batches, and then subject-change events re-project into the canvas. Brief excerpt: `Flush all staged authoring state` in [ReactodiaCanvas.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ReactodiaCanvas.tsx:78). This avoids divergent graph/editor state.

4. Batch operations return real deltas.
   `applyBatch` returns actual added/removed counts after dedupe/match resolution in [rdfManager.impl.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.impl.ts:1465). That makes provenance, undo, and partial failure reporting honest.

5. Provenance as sidecar graph plus in-memory reversible journal.
   Every mutating MCP edit records exact added/removed triples into `urn:vg:provenance`, excluded from reasoning/export, with datatype/language metadata for faithful revert in [provenance.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/provenance.ts:4). This is a practical change-operation model for agent-driven editors.

6. ABox/TBox classification centralized in the data provider.
   `classifyEntityView` is the single rule used by both view filtering and search indexing in [N3DataProvider.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/providers/N3DataProvider.ts:91). This avoids the common bug where search and canvas disagree.

7. Large graph LOD/folding stack.
   `ClusterLevelManager` owns levels L0-L3, preserves membership across group/ungroup, and consumes precomputed positions from silent layout in [ClusterLevelManager.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/core/ClusterLevelManager.ts:1). Initial load auto-clusters above threshold and precomputes L1/L2 in the background in [ReactodiaCanvas.tsx](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/ReactodiaCanvas.tsx:487).

8. Structural grouping before community detection.
   `N3DataProvider` contracts L2 structural groups into super-nodes before clustering, then expands assignments back to original IRIs in [N3DataProvider.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/providers/N3DataProvider.ts:431). This is a useful technique for ontology graphs with long subclass chains and OWL list structures.

9. Layout workers with fixed-node preservation.
   Dagre and ELK use workers and a phantom substitution strategy for fixed nodes in [layouts.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/layout/layouts.ts:11). This is worth porting if users can pin nodes.

10. Import chunking with progress and blank-node skolemization.
    The worker buffers parsed quads, skolemizes, inserts in chunks, and emits import progress; excerpt `IMPORT_CHUNK_SIZE = 5000` in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:4149). This is a good baseline for browser RDF ingestion.

11. Reasoning safety over speed.
    Incremental reasoning falls back to full Konclude when the baseline is missing, inconsistent, empty, or drift-capped in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:3378). The EL fast path is explicitly fail-closed to Konclude in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:2874).

12. Query safeguards.
    MCP query handling normalizes prefixes, validates parse, caps result sizes, and injects LIMIT if absent in [graph.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/tools/graph.ts:331). That is exactly the right shape for agent-facing SPARQL.

13. Dataset-faithful export plus canonical hash.
    N-Quads/TriG preserve named graphs; canonicalization can exclude inferred triples by default and hash asserted content in [rdfManager.impl.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/utils/rdfManager.impl.ts:1641). This is useful for snapshots, reproducible demos, and diffing.

14. MCP manifest as operational doctrine.
    The manifest includes graph architecture, batching rules, workflow guidance, and tool schemas in [manifest.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/manifest.ts:4). This is better than exposing raw functions to agents without behavioral rules.

## 6. Cautionary Anti-Patterns To Avoid

- Several modules are too large and too central: `rdfManager.runtime.ts` is 6,222 lines, `ReactodiaCanvas.tsx` 2,204 lines, `rdfManager.impl.ts` 1,736 lines, `N3DataProvider.ts` 777 lines, and `mcp/manifest.ts` 662 lines. They contain good ideas, but port the ideas into smaller boundaries.
- The repo has some rename residue: several comments and identifiers still say `VG` / `VocabGraph` while the product is Ontosphere. That can confuse future contributors.
- Docs/package drift exists: README version badge says `1.5.0`; package version is `1.5.2`.
- Persistence is mostly volatile. RDF data and provenance disappear on reload unless exported; this is correct for the zero-backend design, but not enough for a collaborative/durable ontology workbench.
- Konclude deployment requires `SharedArrayBuffer`, HTTPS/localhost, and COOP/COEP headers. The runtime throws a specific fallback warning in [rdfManager.runtime.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/workers/rdfManager.runtime.ts:5481), but this remains a real hosting constraint.
- `structuralGroups.ts` explicitly still has `TODO: extend subclass grouping to rdfs:subPropertyOf` in [structuralGroups.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/core/structuralGroups.ts:34).
- Layout API drift: `ELK_ALGORITHM_IDS` includes `radial`, and MCP exposes `elk-radial`, but `createElkLayout` is typed only as `layered | force | stress` in [layouts.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/components/Canvas/layout/layouts.ts:85), while [layout.ts](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/src/mcp/tools/layout.ts:122) calls it with `radial`.
- Some safety knowledge lives in long comments inside giant files. The comments are valuable, but important invariants should eventually become smaller modules plus tests/docs.

## 7. Tests, Build Scripts, Tooling

Scripts of note in [package.json](/home/elpresidank/YeeBois/research/ontology_research/ontology_repos/ontosphere/package.json:31):

| Script | Purpose |
|---|---|
| `npm run dev` / `dev:https` | Vite dev server with debug flag. |
| `npm run build` | `prebuild` generates MCP JSON, then Vite build. |
| `npm run test` | Vitest. |
| `npm run typecheck` | TypeScript no-emit. |
| `npm run typecheck:ratchet` | Baseline/ratchet typecheck script. |
| `npm run lint` | ESLint. |
| `npm run check:mcp` | Validate generated MCP JSON. |
| `npm run test:e2e` | Playwright. |
| `npm run demo:*` | MCP/demo scenario generation and video workflows. |
| `npm run ui-overview*` | Generate UI overview assets. |

Tooling files:
- `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `tsconfig*.json`, `components.json`, `tailwind.config.ts`.
- `playwright.config.ts`, `playwright.demo.config.ts`, `playwright.openwebui.config.ts`.
- Custom Vite plugins: `vite-plugin-worker-comunica.ts`, `vite-plugin-mcp-manifest.ts`, `vite-plugin-bookmarklet.ts`.
- `patch-package` used in `postinstall`, plus `scripts/copy-konclude-assets.mjs`.

Test surface:
- Component tests for autocomplete, canvas autoload/preserve, property editor, reasoning modal, repair suggestions, SHACL/SPARQL panels, metrics, workflow dialogs.
- Store/RDF tests for import formats, dataset export, chunked import, namespace subscriptions, mutations, inferred graph persistence, OWL imports, ontology removal.
- Worker tests for SHACL, EL reasoner, locality module, incremental reasoning conformance/repro/EL fast path, diagnostics, repair verification.
- MCP tests for graph, nodes, links, layout, reasoning, navigation, SHACL, provenance, metadata, search terms, axiom weakening, compute repairs.
- E2E specs cover feature demos, FOAF, pizza, scene ontology, reasoning inconsistency/named restrictions, relay bookmarklet flows, Open WebUI, SPARQL worker.

## 8. Documentation, Research Notes, Papers, Reference Material Inside Repo

Top-level:
- `README.md` — main product, architecture, feature, MCP, reasoning, SHACL, startup, deployment docs.
- `LICENSE` — Apache-2.0 license and copyright.
- `ACKNOWLEDGEMENTS.md` — credits and dependency acknowledgements.
- `CITATION.cff` — citation metadata.
- `AGENTS.md` / `CLAUDE.md` — local agent/development rules.
- `ontosphere-iswc2026-paper.pdf` — ISWC 2026 paper PDF.
- `public/paper/index.html` — HTML paper.
- `public/paper/media/architecture.svg` — paper architecture diagram.
- `public/paper/media/css/acm.css`, `dokieli.css`, `lncs.css` — paper styles.
- `public/paper/media/fonts/*` and `public/paper/scripts/dokieli.js` — paper rendering assets.
- `public/ui-overview.svg`, `public/ui-overview.png`, `public/visgraph_ui.png` — UI reference images.
- `src/clustering_algos.md` — clustering algorithm notes.
- `src/components/Canvas/core/clusterAlgorithms/README.md` — clustering implementation reference.

Demo scripts and recordings:
- `docs/demo-scripts/HOWTO.md` — demo recording/run instructions.
- `docs/demo-scripts/feat-ai-relay.md` — AI relay demo script.
- `docs/demo-scripts/feat-authoring.md` — visual authoring demo script.
- `docs/demo-scripts/feat-clustering.md` — clustering/folding demo script.
- `docs/demo-scripts/feat-exploration.md` — exploration/navigation demo script.
- `docs/demo-scripts/feat-loading.md` — loading/import demo script.
- `docs/demo-scripts/feat-reasoning.md` — reasoning demo script.
- `docs/demo-scripts/feat-shacl.md` — SHACL demo script.
- `docs/demo-scripts/foaf-social-network.md` — FOAF demo script.
- `docs/demo-scripts/iswc2026-comprehensive.md` — comprehensive ISWC demo script.
- `docs/demo-scripts/pizza-ontology.md` — pizza ontology demo script.
- `docs/demo-scripts/reasoning-demo.md` — reasoning scenario script.
- `docs/demo-scripts/scene-ontology.md` — scene ontology script.
- `docs/demo-videos/*.mp4` and `*.video.json` — feature/workflow recordings and metadata.

MCP demo material:
- `docs/mcp-demo/foaf-social-network.md`, `graph.ttl`, `01-tbox.svg`, `02-before-reasoning.svg`, `03-after-reasoning.svg`, `04-frank-focus.svg` — FOAF tutorial, source graph, snapshots.
- `docs/mcp-demo/reasoning-demo.md`, `graph.ttl`, `01-tbox.svg`, `02-before-reasoning.svg`, `03-after-reasoning.svg`, `04-dave-focus.svg` — reasoning demo and snapshots.
- `docs/mcp-demo/scene-ontology.md`, `graph.ttl`, `01-tbox.svg`, `02-abox-full.svg`, `03-after-reasoning.svg`, `04-jake-focus.svg` — scene ontology demo.
- `docs/mcp-demo/pizza-tutorial.md` plus `01-root-classes-bare.svg` through `20-owa-vegetarian-lesson.svg` — stepwise pizza ontology construction and reasoning sequence.
- `docs/mcp-demo/seeds/*.md` — seed prompts/scripts for all demo scenarios.

Architecture/research notes:
- `docs/reactodia-vs-reactflow-analysis.md` — graph renderer/editor comparison.
- `docs/relay-bridge.md` — AI relay bridge design.
- `docs/owui-relay-session.md` — Open WebUI relay notes.
- `docs/release-notes-v1.5.0.md` — feature/release context.
- `docs/solutions/architecture-patterns/owui-relay-fire-on-idle-dispatch-2026-04-30.md` — relay dispatch architecture note.
- `docs/solutions/developer-experience/owui-websocket-blocked-playwright.md` — Playwright/WebSocket troubleshooting.
- `docs/solutions/developer-experience/vitest-jsdom-broken-in-isolation-2026-04-21.md` — Vitest/jsdom issue note.
- `docs/solutions/logic-errors/konclude-v030-abox-realization-gaps-2026-06-10.md` — Konclude behavior/gap note.
- `docs/solutions/logic-errors/relay-inline-param-iri-splitting-2026-04-21.md` — relay parsing bug note.

Benchmarks/reference RDF:
- `benchmarks/ontoauthor-mat/README.md` — benchmark suite overview.
- `benchmarks/ontoauthor-mat/t1-subsumption/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — subsumption task/query/reference/shapes.
- `benchmarks/ontoauthor-mat/t2-existential/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — existential restriction task.
- `benchmarks/ontoauthor-mat/t3-universal/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — universal restriction task.
- `benchmarks/ontoauthor-mat/t4-disjointness/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — disjointness task.
- `benchmarks/ontoauthor-mat/t5-sameas/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — sameAs task.
- `benchmarks/ontoauthor-mat/t6-unsatisfiability/{task.md,cq.sparql,reference.ttl,shapes.ttl}` — unsatisfiability task.

Bundled runtime references:
- `public/reasoning-rules/best-practice.n3`, `owl-e.n3`, `owl-p.n3`, `owl-rl.n3` — N3 rulesets.
- `public/shacl-shapes/ontology-quality.shacl.ttl`, `reasoning-demo.shacl.ttl` — bundled SHACL shapes.
- `public/reasoning-demo.ttl`, `public/reasoning-demo-inconsistent.ttl` — bundled demo graphs.
- `public/demo-stage.html`, `public/demo-stage-owui.html`, `public/relay.html`, `public/relay-mock-chat.html`, `public/relay-fhgenie-mock.html` — demo/relay harnesses.

## Summary Table

| Item | File path(s) | Why it matters for an ontology explorer/editor/visualizer |
|---|---|---|
| Product contract | `README.md`, `package.json`, `LICENSE` | Defines scope: browser RDF/OWL editor, reasoning, SHACL, MCP, Apache-2.0. |
| Named graph architecture | `src/mcp/manifest.ts`, `src/workers/rdfManager.runtime.ts`, `src/utils/rdfManager.impl.ts` | Clean separation of asserted, inferred, shapes, ontologies, workflows, provenance. |
| RDF worker pipeline | `src/utils/rdfManager.workerProtocol.ts`, `src/utils/rdfManager.workerClient.ts`, `src/workers/rdfManager.runtime.ts` | Strong model for offthread parsing, SPARQL, reasoning, validation, import/export. |
| Reactodia canvas/editor | `src/components/Canvas/ReactodiaCanvas.tsx`, `src/providers/N3DataProvider.ts`, `src/templates/*` | Practical visual RDF editing and projection layer. |
| Large graph LOD | `ClusterLevelManager.ts`, `structuralGroups.ts`, `clusterAlgorithms/*`, `layout/*` | Folding, clustering, worker layouts, fixed-node preservation. |
| Reasoning/repair | `rdfManager.runtime.ts`, `src/workers/elReasoner.ts`, `localityModule.ts`, `src/mcp/tools/reasoning.ts`, `computeRepairs.ts`, `axiomWeakening.ts` | OWL DL, incremental modules, EL fast path, explanations, verified repairs. |
| SHACL validation | `src/utils/shaclShapeLoader.ts`, `src/components/Canvas/ShaclShapesPanel.tsx`, `src/mcp/tools/shacl.ts` | Shape loading, validation, focus-node UX. |
| SPARQL/query | `src/components/Canvas/SparqlPanel.tsx`, `src/mcp/tools/graph.ts`, `rdfManager.runtime.ts` | User and agent query/update path with safeguards. |
| Agent/MCP surface | `src/mcp/manifest.ts`, `ontosphereMcpServer.ts`, `workspaceContext.ts`, `tools/*`, `provenance.ts` | High-value blueprint for AI-operated ontology tools. |
| Reversible edits | `src/mcp/provenance.ts`, `AgentEditsPanel.tsx`, mutation tools | Batch diff/revert with typed/language literal fidelity. |
| Export/canonicalization | `rdfManager.impl.ts`, `rdfCanonicalize.ts`, `voidGenerator.ts`, `metadataTools.ts` | Dataset export, RDFC hash, FAIR metadata. |
| Persistence model | `appConfigStore.ts`, `settingsStore.ts`, `ontologyStore.ts`, `stateStorage.ts`, `provenance.ts` | Shows what is durable config vs volatile RDF session state. |
| Documentation/paper/demos | `README.md`, `public/paper/*`, `docs/demo-*`, `docs/mcp-demo/*`, `docs/solutions/*` | Rich material to mine for UX flows, architecture rationale, and demo scenarios. |
| Benchmarks | `benchmarks/ontoauthor-mat/**` | Ready-made competency tasks, SPARQL checks, references, SHACL shapes. |
| Test corpus | `src/__tests__/**`, `src/workers/__tests__/**`, `src/mcp/__tests__/**`, `e2e/**` | Regression map for parser, reasoner, editor, MCP, and browser flows. |


---
Codex thread: 019f4475-6037-7fa0-bf52-a604e56f0ec1 (read-only survey, 2026-07-08)
