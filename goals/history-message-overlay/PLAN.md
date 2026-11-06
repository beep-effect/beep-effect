# History Message Overlay Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | pending | Slice 1: map import + schema + `@beep/git` notes reads + `history notes --check`. Slice 2: `--write`, `sync`, worktree/cloud bootstrap hooks. Slice 3: post-merge publication workflow. Slice 4: cutover folder archive + docs. (Order: `explorations/git-history-rewrite/MAP.md`.) | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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
  (`bun run beep goals decisions add history-message-overlay --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/history-message-overlay/GOAL.md)" -le 4000
jq . goals/history-message-overlay/ops/manifest.json
rg -n "history-message-overlay|GOAL.md|agentLaunchers|packetAnchorDocument" goals/history-message-overlay
git diff --check -- goals/history-message-overlay
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug history-message-overlay`; add a `kind: checkpoint` file there, never edit this block._

### Slice 1 landed in the lane: map tracked, history notes --check, 2026-11-06

docs/history/commit-message-map.json (940 rows) tracked; @beep/git gains notesList and hashObject; beep history notes --check decodes the map, proves every key reachable from origin/main and compares published notes by blob id. Real-repo run: 940/940 reachable, ref not yet published. Next: slice 2 (--write, sync, bootstrap hooks).

Lane `docs/git-history-rewrite-exploration` · PR #2785

Reverse: Revert the slice-1 commits on the branch

<!-- beep:decisions:end -->
