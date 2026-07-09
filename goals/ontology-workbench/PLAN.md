# Ontology Workbench Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Bootstrap | pending | Branch from fresh `origin/main`; confirm packet sources, re-read SPEC constraints, verify `@beep/rdf` / `@beep/semantic-web` / `@beep/rdf-canonize` surfaces still match `research/beep-repo-capability-report.md`. | Facts confirmed or drift recorded; scope re-affirmed. |
| P1 Foundation | pending | Scaffold `ontology` slice (minimum legal set: domain + use-cases + server via `bun run beep architecture`). Schema-first domain on `@beep/rdf` values; typed change-op tagged unions; session = base + change log. `packages/drivers/n3` Turtle codec. Ports: OntologyFileStore (Effect `FileSystem`, sidecar-side), TurtleCodec. | Fixture ontologies round-trip by canonize fingerprint; slice tests green in isolation. |
| P2 Explorer + Editor | pending | Add `client` (OntologyRpcs per the `agents` ChatRpcs pattern, atoms via `@effect/atom-react`) and `ui` packages. Workspace shell, MUI X Tree View hierarchy explorer, inspector/form editing, search, Turtle source view (`@beep/editor`), undo/redo, dirty state, open/save. App wiring: navigation shell (chat ⇄ workbench), RuntimeLive + sidecar RPC registration. | Author-edit-save loop works in the running desktop app; undo/redo + change log render. |
| P3 Visualizer | pending | `packages/drivers/cosmos` wrapping `@cosmos.gl/graph` (browser-safe entrypoint). Worker-side projection: model → typed-array node/link buffers with incremental diffs. Focus-neighborhood, progressive disclosure, label LOD, light editing (select-to-edit, drag-between-nodes → change op). sigma.js fallback behind capability detection. Early spike: cosmos.gl on webkitgtk before deep integration (SPEC stop condition). | Synthetic 100k-element ontology interactive on webkitgtk; benchmark note in `history/`. |
| P4 SPARQL + Reasoning | pending | `packages/drivers/oxigraph` implementing the `@beep/semantic-web` SPARQL contract; query panel UI (SELECT/CONSTRUCT). Domain-native structural inference (closure, domain/range propagation, disjointness) incremental over the change log; inferred-view toggle; reasoner port. | SPARQL + inferred-view acceptance criteria pass. |
| P5 Harden + Close | pending | Protégé/ROBOT interop validation against real ontologies (record evidence), performance pass, disambiguation README notes, docs. Yeet closeout + reflection. | All SPEC acceptance criteria checked; PR(s) mergeable; closeout reflection exists. |

Each phase lands as one or more PRs driven through
`bun run beep yeet` (repair → verify → publish → monitor); the packet is not
complete until P5's PR is mergeable.

## P5 Closeout Checklist

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
- Ontology-Playground ports carry MIT attribution (see
  `research/SOURCES.md` port discipline table).
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
