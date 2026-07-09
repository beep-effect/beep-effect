# Ontology Workbench Spec

## Objective

Ship a fully featured ontology explorer, editor, and visualizer inside
`apps/professional-desktop`, delivered as a new `ontology` vertical slice
(`packages/ontology/{domain,use-cases,server,client,ui}`) plus supporting
drivers. At completion a user can open a Turtle ontology document from disk,
explore it (hierarchy tree, search, large-scale graph), edit it structurally
(classes, object/data properties, individuals, annotations, subclass axioms)
with undo/redo, query it with SPARQL, see bounded inference results, and save
deterministic Turtle that Protégé and ROBOT parse.

## Non-Goals

- Multi-format import/export (RDF/XML, JSON-LD, OBO, OWL/XML). Turtle-first;
  other formats are a later packet.
- External ontology registry fetch (OLS, BioPortal, LOV).
- Full OWL 2 DL reasoning (HermiT-class). Reasoning is bounded to
  domain-native structural inference (see Constraints).
- Server-backed or multi-user workspaces. Files on disk are the only truth.
- Fixing the existing chat feature's app-local UI drift.
- Replacing or extending `@beep/ontology` (foundation FOLIO models) or the
  `identity-as-iri` authoring surface — this workbench edits **user ontology
  documents**, not repo-internal schema-derived ontologies.

## Source Hierarchy

1. User objective: fully featured ontology explorer/editor/visualizer in
   professional-desktop (grilling session, 2026-07-08).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and `standards/architecture/*` (esp. 01
   slices, 03 driver boundaries, 13 minimum viable slice).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/`, `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/ontology/{domain,use-cases,server,client,ui}` (new slice).
- `packages/drivers/n3` (new: Turtle parse/serialize wrapping N3.js).
- `packages/drivers/cosmos` (new: `@cosmos.gl/graph` wrapper, browser-safe).
- `packages/drivers/oxigraph` (new: Oxigraph WASM implementing the existing
  `@beep/semantic-web` SPARQL contract).
- `apps/professional-desktop` (navigation shell, RuntimeLive additions,
  sidecar RPC registration only).
- `packages/foundation/modeling/ontology/README.md` +
  `packages/ontology/domain/README.md` (mutual disambiguation notes).

## Constraints (locked decisions, normative)

1. Schema-first beep-native ontology domain model (tagged unions for classes,
   properties, individuals, axioms); OWL/Turtle interop only at driver
   boundaries. Domain builds on `@beep/rdf` value models (IRI, CURIE, literal,
   quad) — do not reinvent them.
2. Files as truth: Turtle documents on disk, open/save like a project. Any
   index or cache is derived, never authoritative.
3. Edits are typed change operations (KGCL-inspired tagged unions). Session =
   base ontology + change log; undo/redo, dirty tracking, and semantic diffs
   derive from it.
4. Viz stack: cosmos.gl (WebGL2 GPU force sim + render) as the main viewport;
   sigma.js v3 + graphology behind capability detection; Web Workers for
   parsing/diffing/search indexes; label LOD. WebGPU MUST NOT be a baseline
   dependency (Tauri Linux = WebKitGTK; assume `navigator.gpu` absent).
5. Viz role: explore-first with light editing (select-to-edit side panel,
   drag-between-nodes overlay → typed change op). Tree/form views are the
   primary editing surface.
6. SPARQL: Oxigraph WASM in-memory store loaded from a Turtle projection of
   the session graph, invalidated on change-log commits, implementing the
   existing `@beep/semantic-web` SPARQL service contract.
7. Reasoning: domain-native structural inference in the slice (subclass /
   subproperty transitive closure, domain/range type propagation, disjointness
   violations), incremental over the change log, surfaced as an inferred-view
   toggle. Define a reasoner port so a heavier engine (eyereasoner) can slot
   in later.
8. Slice UI package owns all product screens; professional-desktop keeps only
   a thin app-local shell (navigation, transport wiring). Follow the
   `agents` slice RPC pattern (use-cases Rpcs → sidecar server → client
   atoms via `@effect/atom-react`).
9. File IO runs sidecar-side through Effect `FileSystem` ports; the webview
   never touches the filesystem directly.
10. Scaffold with `bun run beep architecture` (create slice / add concept,
    aggregates archetype); start with the minimum legal set
    (domain + use-cases + server) and add client/ui when P2 reaches them.
11. Round-trip fidelity is proven with `@beep/rdf-canonize` fingerprint
    equality, not string equality.
12. Ontology-Playground (MIT) may be ported from with attribution for UI
    patterns (split-pane designer, focus-neighborhood, path finder, round-trip
    validation script); its data model and hand-rolled parser are explicitly
    not templates.

## Acceptance Criteria

- [ ] A real BFO-aligned knowledge-graph ontology can be authored end-to-end
      in-app: classes, object/data properties, individuals, annotations,
      subclass axioms.
- [ ] Save produces deterministic Turtle that Protégé and ROBOT parse;
      load→save round-trips losslessly by canonicalization fingerprint
      (`@beep/rdf-canonize`).
- [ ] Undo/redo works across all edit kinds; a human-readable change log
      renders from the typed change operations.
- [ ] Hierarchy explorer, search, and graph viewport stay interactive with a
      synthetic 100k-element ontology on webkitgtk (no main-thread stalls
      > 100 ms during pan/zoom/hover).
- [ ] SPARQL panel executes SELECT and CONSTRUCT over the loaded ontology.
- [ ] Inferred-view toggle shows derived hierarchy/types and flags
      disjointness violations.
- [ ] Slice tests run with only its own Layers + shared test-kit + driver
      test Layers (no app runtime boot).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/ontology-workbench/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ontology-workbench/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/ontology-workbench` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |
| Slice tests | slice + driver test suites (exact filter recorded in PLAN as they land) | Green |
| Round-trip proof | fixture-ontology round-trip test (P1) + external check: fixture opens in Protégé / `robot --input` without error (recorded in `history/`) | Passes |
| Scale benchmark | synthetic 100k-element benchmark note under `history/` (P3) | Interactive per acceptance |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- cosmos.gl proves non-viable on webkitgtk during the P3 spike → stop, record
  evidence, and re-decide viz stack (sigma.js fallback is pre-approved).

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
