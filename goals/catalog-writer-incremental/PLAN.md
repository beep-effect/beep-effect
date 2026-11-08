# Incremental Catalog Writer Plan

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
  (`bun run beep goals decisions add catalog-writer-incremental --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/catalog-writer-incremental/GOAL.md)" -le 4000
jq . goals/catalog-writer-incremental/ops/manifest.json
rg -n "catalog-writer-incremental|GOAL.md|agentLaunchers|packetAnchorDocument" goals/catalog-writer-incremental
git diff --check -- goals/catalog-writer-incremental
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug catalog-writer-incremental`; add a `kind: checkpoint` file there, never edit this block._

### P1 implemented, P2 measured, 2026-11-08

The scoped schema-catalog writer now splices per file: it drops each in-scope owner's committed entries for the staged paths, parses only the staged files the full scan would read, and merges the result, with the full run unchanged and sharing the same entry-collection helper. Exports are read syntactically instead of through ts-morph isExported(), which built the type checker. The five-fixture scoped run fell from 5.31 GB / 15.3 s to 0.63 GB / 2.1 s with byte-identical shards; the full check stays current and the full writer leaves the tree clean. Tests added in catalog-shard-scope.test.ts cover add, modify, delete, move, an unstaged sibling that is never parsed, a malformed shard, and an instrumentation-writer move.

Reverse: n/a

<!-- beep:decisions:end -->
