# Ontology Workbench Plan

## Status

Status: `complete` (P0-P6 landed as PRs #351/#354/#355/#357/#358/#359 plus the P6 close branch; all hosted checks green; host proofs and the T2/T3 DL-reasoning deferral recorded in history/; closeout reflection history/reflections/2026-07-09-claude.md)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Bootstrap | complete | Branch from fresh `origin/main`; confirm packet sources, re-read SPEC constraints, verify `@beep/rdf` / `@beep/semantic-web` / `@beep/rdf-canonize` surfaces still match `research/beep-repo-capability-report.md`. | Facts confirmed in `history/2026-07-08-p0-bootstrap.md`; no decision-invalidating drift found; scope re-affirmed. |
| P1 Foundation | complete | Scaffold `ontology` slice (minimum legal set: domain + use-cases + server via `bun run beep architecture`). Schema-first domain on `@beep/rdf` values; typed change-op tagged unions; session = base + change log, partitioned into derived named graphs (asserted/ontologies/inferred/shapes/provenance) with one shared exclusion rule (SPEC 13). `packages/drivers/n3` Turtle codec. Ports: OntologyFileStore (Effect `FileSystem`, sidecar-side), TurtleCodec. Effect-Schema-typed worker protocol for parse/diff workers (SPEC 14). Port ontoauthor-mat + pizza/FOAF fixtures (Apache-2.0 attribution). | Direct `rdfc-1.0` fingerprint round-trip proof passed for FOAF + ontoauthor Turtle fixtures in sandbox; package `check` + `lint` passed. Host must run install and Vitest slice tests because sandbox Bun/Vitest workers failed before importing tests. Evidence: `history/2026-07-09-p1-foundation.md`. |
| P2 Explorer + Editor | complete | Add `client` (OntologyRpcs per the `agents` ChatRpcs pattern, atoms via `@effect/atom-react`; batch ops return real deltas, SPEC 16) and `ui` packages. Workspace shell, MUI X Tree View hierarchy explorer, ABox/TBox view modes (one classification rule shared with search, SPEC acceptance), inspector/form editing, search, Turtle source view (`@beep/editor`), undo/redo, dirty state, open/save, worker-computed metrics/quality panel. App wiring: navigation shell (chat ⇄ workbench), RuntimeLive + sidecar RPC registration. E2E authoring script = ported pizza tutorial. | Live app proof completed core flows; P2 polish fixed the missing change-log panel, nested tooltip button markup, and Turtle prefix-preserving save path. Local package `check`, `lint`, docgen, JSDoc inventory/ratchet, and node-backed slice tests passed. Host must rerun bun-backed tests and running desktop author-edit-save proof. Evidence: `history/2026-07-09-p2-explorer-editor.md`. |
| P3 Visualizer | complete | `packages/drivers/cosmos` wrapping `@cosmos.gl/graph` (browser-safe entrypoint). Worker-side projection: model → typed-array node/link buffers with incremental diffs. Focus-neighborhood, progressive disclosure, label LOD, fold levels L0–L3 (annotation collapse, structural folding BEFORE community clustering, worker-computed, auto-cluster above threshold), ABox/TBox viewport filter, halo light-editing gestures → typed change ops (connect/delete/expand + predicate autocomplete), pinned-node layout preservation, drag-type-to-instantiate. sigma.js fallback behind capability detection. Early spike: cosmos.gl on webkitgtk before deep integration (SPEC stop condition). | P3 code path implemented with worker projection, graph delta protocol, workbench panel, halo gesture change-op wiring, sigma fallback preservation, and folded worker-backed spike contract. Local package check/lint/docgen, JSDoc inventory/ratchet, boundaries, version sync, syncpack lint, and node-backed tests passed. Host must rerun the 100k folded webkitgtk proof via `window.__COSMOS_SPIKE__`; evidence: `history/2026-07-09-p3-visualizer.md`. |
| P4 SPARQL + Reasoning | complete | `packages/drivers/oxigraph` implementing the `@beep/semantic-web` SPARQL contract; query panel UI (SELECT/CONSTRUCT) with prefix-aware defaults, example library, Ctrl/Cmd+Enter run, LIMIT injection, result truncation (SPEC 16). Domain-native structural inference (closure, domain/range propagation, disjointness) incremental over the change log with the SPEC 15 invalidation discipline (changed signatures, module-scoped recompute, drift-cap fail-closed full pass); inferred-view toggle; reasoner port. | Oxigraph driver, reasoner, SPARQL runner, client atoms, workbench panels, and desktop RPC wiring are implemented; local check/lint/docgen/JSDoc/knip/fallow/syncpack/changeset gates and node-backed Vitest proof pass. Host must run install metadata refresh plus running browser/Tauri query and inferred-view proof. Evidence: `history/2026-07-09-p4-sparql-reasoning.md`. |
| P5 Validation + Provenance | complete | `packages/drivers/shacl` implementing the `@beep/semantic-web` SHACL contract (SPEC 17); validation panel (focus-node navigation, validates asserted + inferred). Verified repair suggestions offered as undoable typed change-op proposals. PROV-O journal export derived from the change log; VoID/DCAT dataset description at export; metrics panel hardening. | SHACL driver, validation runner, verified repair proposals, validation panel, metrics wiring, and PROV-O + VoID/DCAT sidecar exports are implemented. Local package checks and formatting passed; sandbox network blocked registry verification and Bun/Vitest workers timed out before test import. Host must verify dependency versions, install, rerun tests, and complete browser acceptance. Evidence: `history/2026-07-09-p5-validation-provenance.md`. |
| P6 Harden + Close | complete | Protégé/ROBOT interop validation against real ontologies (record evidence), ontoauthor-mat competency pass (t1–t6), performance pass, disambiguation README notes, docs. Yeet closeout + reflection. | Structural Turtle interop, ontoauthor-mat executable status suite, node-side projection benchmark, disambiguation notes, authored docs, and acceptance checklist are recorded in `history/2026-07-09-p6-harden-close.md`; host must run ROBOT/Protégé, GUI/Tauri proof, `/reflect`, reflection lint, Yeet verify/publish/monitor, and resolve or explicitly defer the remaining OWL DL competency gaps before packet closure. |

Each phase lands as one or more PRs driven through
`bun run beep yeet` (repair → verify → publish → monitor); the packet is not
complete until P6's PR is mergeable.

## P6 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate
   against `ReflectionFrontmatter`).
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true` —
   a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update it only when the contract changes.
- Ontology-Playground ports carry MIT attribution; ontosphere ports
  (fixtures, patterns) carry Apache-2.0 attribution (see
  `research/SOURCES.md` port discipline tables).
- The `explorations/identity-as-iri` lineage owns repo-internal
  schema-derived ontologies; this slice edits user ontology documents. Keep
  the boundary crisp — shared needs route through `@beep/rdf` /
  `@beep/semantic-web`, never slice-to-foundation leakage of product language.
- Archive run outputs, benchmarks, and interop evidence under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/ontology-workbench/GOAL.md)" -le 4000
jq . goals/ontology-workbench/ops/manifest.json
rg -n "ontology-workbench|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-workbench
git diff --check -- goals/ontology-workbench
bun run beep yeet verify
```
