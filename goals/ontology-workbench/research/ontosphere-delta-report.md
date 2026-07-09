Read-only check completed. I did not modify, create, or delete files. Paths below are relative to `.../ontology_repos/ontosphere`.

**Prioritized Opportunities**

1. **Add SHACL validation as a P4/P5 validation lane**
   Evidence: `README.md:121-123` lists “SHACL validation” plus focus/path/severity reporting; `src/components/Canvas/ShaclShapesPanel.tsx:165-172` gives a “No shapes loaded” state and `?shaclShapes=` hook; `docs/demo-scripts/feat-shacl.md:40-49` shows reasoning changing validation targets.
   Packet surface: `SPEC` acceptance criterion, `PLAN` P4/P5.
   Recommendation: **Adapt**. SHACL complements structural inference without violating the “not a full OWL reasoner” decision.

2. **Add repair suggestions as typed change-operation proposals**
   Evidence: `README.md:117-119` describes ranked verified fixes; `src/components/Canvas/RepairSuggestions.tsx:187-229` computes and verifies repairs; `RepairSuggestions.tsx:276-403` applies one undoable fix.
   Packet surface: `SPEC` Constraint 3, `PLAN` P4.
   Recommendation: **Adapt**. Keep KGCL-style tagged unions as the edit model, but let diagnostics propose verified operations.

3. **Add explicit ABox/TBox view modes and type-drag instantiation**
   Evidence: `src/providers/N3DataProvider.ts:17` defines `ViewMode = 'abox' | 'tbox'`; `N3DataProvider.ts:91-114` classifies resources into ABox/TBox/both; `ReactodiaCanvas.tsx:1800-1869` creates a new instance when a class/type IRI is dropped.
   Packet surface: `SPEC` visualizer/editor constraints, `PLAN` P2/P3.
   Recommendation: **Adopt**. This fits the MUI Tree + explorer/editor split and clarifies schema versus instance workflows.

4. **Use derived named-graph partitions inside the session**
   Evidence: `src/workers/rdfManager.runtime.ts:302-306` separates data, ontologies, inferred, shapes, workflows, provenance; `rdfManager.runtime.ts:315-320` excludes derived/meta graphs from reasoning.
   Packet surface: `SPEC` Constraints 2 and 7, `PLAN` P1/P4.
   Recommendation: **Adapt**. Use partitions as derived in-memory indexes only; Turtle files and typed change logs remain authoritative truth.

5. **Add term-reuse search before minting new IRIs**
   Evidence: `rdfManager.workerProtocol.ts:167-171` says search should help reuse existing IRIs; `rdfManager.runtime.ts:2516-2520` searches labels/local names across all graphs; `rdfManager.runtime.ts:2582-2611` ranks exact label, startsWith, substring, and local-name matches.
   Packet surface: `PLAN` P2 editor/search acceptance.
   Recommendation: **Adopt**. This is small, high-value, and prevents accidental vocabulary duplication.

6. **Add namespace registry, legend, and guarded URI rename**
   Evidence: `README.md:111` names live namespace URI renaming; `README.md:269` says legend renames propagate across stored triples; `rdfManager.workerProtocol.ts:75-79` has a typed `RenameNamespaceUriPayload`.
   Packet surface: `PLAN` P2, maybe `SPEC` edit operation coverage.
   Recommendation: **Adapt**. Make rename a previewable bulk typed change op with undo, not a silent store mutation.

7. **Strengthen visualizer progressive disclosure with fold levels and clustering**
   Evidence: `README.md:110` documents L1/L2 folding and community clustering; `TopBar.tsx:59-107` exposes fold controls and algorithms; `docs/demo-scripts/feat-clustering.md:3-5` demos L1 annotation collapse, L2 structural fold, L3 Louvain.
   Packet surface: `SPEC` Constraint 4, `PLAN` P3 100k-scale criteria.
   Recommendation: **Adapt**. Keep cosmos.gl/sigma, but copy the fold taxonomy and worker-computed cluster overlays.

8. **Add an ontology metrics and quality heuristics panel**
   Evidence: `MetricsPanel.tsx:1-12` describes counts and OQuaRE-flavored heuristics; `MetricsPanel.tsx:168-268` renders triples, subjects, classes, properties, namespace breakdown, and ratios.
   Packet surface: `PLAN` P5 hardening or P2 sidebar.
   Recommendation: **Adopt**. Low-risk observability for users and test fixtures.

9. **Add FAIR metadata export later, not as core editing**
   Evidence: `metadataTools.ts:56-60` generates VoID + DCAT metadata; `voidGenerator.ts:253-320` emits a pure Turtle description; `README.md:138` includes `generateDatasetMetadata`.
   Packet surface: `PLAN` P5, `research/SOURCES.md`.
   Recommendation: **Adapt**. Useful provenance/export sidecar, but keep Turtle authoring and round-trip as the primary contract.

10. **Reject Comunica as the SPARQL engine, but copy panel UX**
    Evidence: `package.json:71` uses `@comunica/query-sparql-rdfjs`; `rdfManager.runtime.ts:5086-5150` handles SELECT/CONSTRUCT/UPDATE/ASK; `SparqlPanel.tsx:37-50` builds prefix-aware default queries and `SparqlPanel.tsx:160-168` supports Ctrl/Cmd+Enter.
    Packet surface: `SPEC` Constraint 6, `PLAN` P4.
    Recommendation: **Reject replacement**. Oxigraph WASM stays locked, but prefix insertion, examples, keyboard run, and result truncation are worth adopting.

11. **Reject Reactodia as primary renderer, but copy interaction semantics**
    Evidence: `package.json:101` uses `@reactodia/workspace`; `README.md:108` highlights halo authoring and autocomplete; `docs/reactodia-vs-reactflow-analysis.md:20-32` documents rendering-pipeline techniques.
    Packet surface: `SPEC` Constraints 4 and 5, `PLAN` P3.
    Recommendation: **Reject replacement**. Reactodia is strong for thousands and rich authoring, but cosmos.gl/sigma better matches the locked 100k WebGL2 requirement.

12. **Incremental reasoning should track full changed signatures**
    Evidence: `rdfManager.workerProtocol.ts:209-226` describes module-scoped incremental reasoning; `ReactodiaCanvas.tsx:1543-1549` accumulates subjects plus predicate/object signature; `rdfManager.runtime.ts:350-357` forces full revalidation after 20 incremental steps.
    Packet surface: `SPEC` Constraint 7, `PLAN` P4.
    Recommendation: **Adapt**. Use the technique for structural closure invalidation, while rejecting full Konclude as baseline.

13. **Add agent/edit provenance as a derived view over the packet change log**
    Evidence: `README.md:122-123` mentions PROV-O edit provenance and reversal; `src/mcp/provenance.ts:4-10` stores agent edits in `urn:vg:provenance`; `provenance.ts:30-34` admits the journal is volatile.
    Packet surface: `SPEC` Constraint 3, `PLAN` P2/P5.
    Recommendation: **Adapt**. Generate PROV-O from durable typed change operations; do not make a volatile provenance graph authoritative.

14. **Reject multi-format/remote loading for this packet, cite as future work**
    Evidence: `README.md:103-105` supports RDF/XML, JSON-LD, N-Quads, TriG and canonical hashes; `package.json:121-123` uses `rdf-canonize`, `rdf-parse`, and Konclude; `README.md:407-438` has URL/import autoload.
    Packet surface: `SPEC` Non-goals, `research/SOURCES.md`.
    Recommendation: **Reject now**. Turtle files-as-truth and N3 driver are locked; multi-format and remote endpoint loading belong in a later packet.

15. **Add Ontosphere provenance entries to `research/SOURCES.md`**
    Evidence: `CITATION.cff:3-14` gives title, version, abstract; `CITATION.cff:25-28` gives repo, URL, license, release date; `ACKNOWLEDGEMENTS.md:7-35` lists Konclude, Reactodia, N3.js, SHACL, ELK/Dagre, Comunica.
    Packet surface: `research/SOURCES.md`.
    Recommendation: **Adopt**. Cite Ontosphere as an Apache-2.0 reference implementation/pattern source, not as code to port wholesale.

**Validates Locked Decisions**

- N3/RDFJS substrate: Ontosphere uses `n3` and RDF/JS heavily, validating the N3.js driver direction.
- Derived inferred graph: `urn:vg:inferred` is separate and clearable, validating asserted-versus-inferred separation.
- Worker-heavy architecture: RDF parsing, querying, reasoning, and layout are pushed off the main thread, validating packet worker requirements.
- Canonicalization: `src/utils/rdfCanonicalize.ts` validates the packet’s round-trip/canonical proof instinct.
- No WebGPU baseline needed: Ontosphere’s browser client uses Web Workers/WASM and conventional rendering, not WebGPU.
- Structural/incremental reasoning discipline: locality modules, changed signatures, and periodic full recompute validate bounded inference plus explicit invalidation.
- UI slice ownership: Ontosphere’s canvas/sidebar/panels own product workflows, matching the packet’s “slice UI owns screens” decision.
- Oxigraph remains defensible: Ontosphere’s Comunica path works, but nothing found genuinely dislodges the locked `@beep/semantic-web` + Oxigraph WASM contract.

---
Codex thread: 019f4477-44b8-7ae3-ae85-5b6a2cc5e6af (read-only delta analysis vs goals/ontology-workbench, 2026-07-08)
