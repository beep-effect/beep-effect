# Identity IRI Core Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm authority host (BLOCKING); inspect audit-B surface + prototype donors; confirm scope. | Authority ruled; preserve-exactly inventory confirmed current; blockers recorded. |
| P1 Implement | pending | Shape-stable harness first, then port Vocab/Curie/PnLocal/Composer into `@beep/identity` with house conventions. | SPEC acceptance criteria met; zero call-site changes. |
| P2 Verify | pending | Type-level tests, registry round-trips, interning/rebase pins, blast-radius measurement, package gates. | Verification green or blockers documented (inherited main-red per Exception Ledger). |
| P3 Close | pending | PR via yeet, review response, closeout reflection, packet status update. | PR mergeable; reflection exists; manifest/README updated. |

## P3 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes (elpresidank edits the same tree in
  parallel sessions).
- The scratchpad prototype is the port donor, not the deliverable — it stays
  untouched as exploration provenance.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Archive the blast-radius measurement and harness evidence under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/identity-iri-core/GOAL.md)" -le 4000
jq . goals/identity-iri-core/ops/manifest.json
rg -n "identity-iri-core|GOAL.md|agentLaunchers|packetAnchorDocument" goals/identity-iri-core
git diff --check -- goals/identity-iri-core
bunx turbo run test --filter @beep/identity
```
