# Ontology Workbench Plan

## Status

Status: `active` (P0 complete; P1 Foundation implemented; host verification pending)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Bootstrap | complete | Branch from fresh `origin/main`; confirm packet sources, re-read SPEC constraints, verify `@beep/rdf` / `@beep/semantic-web` / `@beep/rdf-canonize` surfaces still match `research/beep-repo-capability-report.md`. | Facts confirmed in `history/2026-07-08-p0-bootstrap.md`; no decision-invalidating drift found; scope re-affirmed. |
| P1 Foundation | host-verification-required | Scaffold `ontology` slice (minimum legal set: domain + use-cases + server via `bun run beep architecture`). Schema-first domain on `@beep/rdf` values; typed change-op tagged unions; session = base + change log, partitioned into derived named graphs (asserted/ontologies/inferred/shapes/provenance) with one shared exclusion rule (SPEC 13). `packages/drivers/n3` Turtle codec. Ports: OntologyFileStore (Effect `FileSystem`, sidecar-side), TurtleCodec. Effect-Schema-typed worker protocol for parse/diff workers (SPEC 14). Port ontoauthor-mat + pizza/FOAF fixtures (Apache-2.0 attribution). | Direct `rdfc-1.0` fingerprint round-trip proof passed for FOAF + ontoauthor Turtle fixtures in sandbox; package `check` + `lint` passed. Host must run install and Vitest slice tests because sandbox Bun/Vitest workers failed before importing tests. Evidence: `history/2026-07-09-p1-foundation.md`. |
| P2 Explorer + Editor | pending | Add `client` (OntologyRpcs per the `agents` ChatRpcs pattern, atoms via `@effect/atom-react`; batch ops return real deltas, SPEC 16) and `ui` packages. Workspace shell, MUI X Tree View hierarchy explorer, ABox/TBox view modes (one classification rule shared with search, SPEC acceptance), inspector/form editing, search, Turtle source view (`@beep/editor`), undo/redo, dirty state, open/save, worker-computed metrics/quality panel. App wiring: navigation shell (chat ⇄ workbench), RuntimeLive + sidecar RPC registration. E2E authoring script = ported pizza tutorial. | Author-edit-save loop works in the running desktop app; undo/redo + change log render; ABox/TBox toggle consistent. |
| P3 Visualizer | pending | `packages/drivers/cosmos` wrapping `@cosmos.gl/graph` (browser-safe entrypoint). Worker-side projection: model → typed-array node/link buffers with incremental diffs. Focus-neighborhood, progressive disclosure, label LOD, fold levels L0–L3 (annotation collapse, structural folding BEFORE community clustering, worker-computed, auto-cluster above threshold), ABox/TBox viewport filter, halo light-editing gestures → typed change ops (connect/delete/expand + predicate autocomplete), pinned-node layout preservation, drag-type-to-instantiate. sigma.js fallback behind capability detection. Early spike: cosmos.gl on webkitgtk before deep integration (SPEC stop condition). | Synthetic 100k-element ontology interactive on webkitgtk (folds active); benchmark note in `history/`. |
| P4 SPARQL + Reasoning | pending | `packages/drivers/oxigraph` implementing the `@beep/semantic-web` SPARQL contract; query panel UI (SELECT/CONSTRUCT) with prefix-aware defaults, example library, Ctrl/Cmd+Enter run, LIMIT injection, result truncation (SPEC 16). Domain-native structural inference (closure, domain/range propagation, disjointness) incremental over the change log with the SPEC 15 invalidation discipline (changed signatures, module-scoped recompute, drift-cap fail-closed full pass); inferred-view toggle; reasoner port. | SPARQL + inferred-view acceptance criteria pass. |
| P5 Validation + Provenance | pending | `packages/drivers/shacl` implementing the `@beep/semantic-web` SHACL contract (SPEC 17); validation panel (focus-node navigation, validates asserted + inferred). Verified repair suggestions offered as undoable typed change-op proposals. PROV-O journal export derived from the change log; VoID/DCAT dataset description at export; metrics panel hardening. | SHACL violation → verified repair → undo acceptance passes; PROV-O + VoID/DCAT exports produced. |
| P6 Harden + Close | pending | Protégé/ROBOT interop validation against real ontologies (record evidence), ontoauthor-mat competency pass (t1–t6), performance pass, disambiguation README notes, docs. Yeet closeout + reflection. | All SPEC acceptance criteria checked; PR(s) mergeable; closeout reflection exists. |

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
