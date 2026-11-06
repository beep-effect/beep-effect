# Research library ontology core Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | in-progress | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | in-progress | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add research-library-ontology-core --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/research-library-ontology-core/GOAL.md)" -le 4000
jq . goals/research-library-ontology-core/ops/manifest.json
rg -n "research-library-ontology-core|GOAL.md|agentLaunchers|packetAnchorDocument" goals/research-library-ontology-core
git diff --check -- goals/research-library-ontology-core
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug research-library-ontology-core`; add a `kind: checkpoint` file there, never edit this block._

### Real library migrated to catalog v2 and ontology rendered after #2771 merged, 2026-11-06

With main's reader on v2 (#2771, merge 92b42155b3), research library migrate ran against the operator library. The dry run, then the write, both reported shacl conforms=true violations=0. Receipt ops/migrations/2026-11-06T17-32-07.946Z-catalog-v2.json records validator research-library-shapes/1, v1 to v2, catalog e88cf958... to 5cda99e5..., index.md 1048b6e6... (unchanged on disk), and intakes 2026-10-06 and 2026-10-14. The pre-migration catalog was backed up to catalog/history/e88cf958....json. A second migrate run was a no-op. ontology render wrote research-library.ttl (521755de...) and research-library.shacl.ttl (267e1e0d...), byte-identical to the lane fold. verify on v2 reports shacl conforms=true violations=0 plus the 10 inherited data-gap integrity issues that main also reports.

Lane `docs/research-library-ontology-closeout`

Reverse: Copy catalog/history/e88cf95833389975bedc1143c9b8e20bd1fd3775ead6589cd931baa9b1054f52.json over catalog/library.json and delete ontology/

<!-- beep:decisions:end -->
