# Yeet Async Merge and Native Stacks Plan

## Status

Status: `in-progress` (slices A and B merged; slice C next)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | in-progress | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

P1 Implement and P3 Yeet run once per slice; a slice is a PR.

| Slice | Status | First step | Done when |
| --- | --- | --- | --- |
| A, async merge | done: port merged 2026-11-12 (#3099); legacy call and switch deleted 2026-11-13; evidence in [`history/2026-11-13-slice-a-closed.md`](history/2026-11-13-slice-a-closed.md) | Schema for the request and the outcome union; then the `GithubRest` call and poll. | The slice's own PR merges through the new path and a blocked PR shows the hold. |
| B, rewrite-stable proof | done: head-move classifier, window carry and receipt carry merged 2026-11-12 (#3130); decisions `2026-11-12-*` | Head-move classifier over patch-ids, with the test's rewritten heads as fixtures. | Window and receipt survive an unchanged rewrite and restart on a changed one. |
| C, two-layer stacks | pending | Decide in P0 whether layers are linked through `gh stack` or the Stacks REST API. | One real two-layer stack lands through Yeet end to end. |
| D, pilot | pending | Start the pilot record on the first routine stack. | Two weeks measured and the continue-or-stop decision filed. |

P0 Research settles, before slice A: the async endpoint's behaviour for a
409 and for an expired result (settled 2026-11-10, see
[`research/merge-async-p0-probes-2026-11.md`](research/merge-async-p0-probes-2026-11.md)); and before slice C: how to wake
`beep-reviewer` without the S32 commit, and how a layer is created and
linked.

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
  (`bun run beep goals decisions add yeet-async-merge-and-stacks --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/yeet-async-merge-and-stacks/GOAL.md)" -le 4000
jq . goals/yeet-async-merge-and-stacks/ops/manifest.json
rg -n "yeet-async-merge-and-stacks|GOAL.md|agentLaunchers|packetAnchorDocument" goals/yeet-async-merge-and-stacks
git diff --check -- goals/yeet-async-merge-and-stacks
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug yeet-async-merge-and-stacks`; add a `kind: checkpoint` file there, never edit this block._

### Slice A: P0 probes recorded and the async merge port published, 2026-11-10

P0 research for slice A is recorded in research/merge-async-p0-probes-2026-11.md (live probes on throwaway-base PRs 3082 to 3085, nothing reached main). The port adds GithubAsyncMergeRequest and the GithubAsyncMergeOutcome tagged union, requestAsyncMerge and asyncMergeResult on GithubRest, and settleYeetMerge, which all four merge call sites use. Strict merges send bypass_rules false; only merge-gate --relaxed with a recorded red sends true. Next: the slice A PR merges through merge-async, the blocked-PR hold and that merge line are recorded under history/, and the legacy call is deleted on or after 2026-11-11.

Lane claude/trusting-hamilton-1ad7d1

Reverse: Revert the slice A PR; BEEP_YEET_MERGE_ENDPOINT=legacy restores the old call without a revert while the switch exists.

### Slice B: head-move classifier and rewrite carry published, 2026-11-12

Slice B adds YeetHeadMoveClassifier (HeadMove.ts), the repository-activity read and the pull base sha in GithubRest, the review-window carry (ReviewWindow.ts, seams in GhOps, MergeGate and GateTable) and the receipt carry in yeet ready (FinalCheckRefresh.ts, ReadyGate.ts). On the recorded #3050/#3051 heads all six rewrite pairs classify unchanged and the stale-base, retarget and layer-2-versus-layer-3 counterexamples classify changed. The carried #3050 window anchors on ready at 02:25:19Z and elapses at 02:45:19Z instead of restarting at 02:54:20Z. yeet gh pr status and merge now read the shared window and honour BEEP_YEET_REVIEW_WINDOW. Next: the slice B PR merges; then slice C.

Lane feat/yeet-rewrite-stable-proof

Reverse: Revert the slice B PR; every head move restarts the window and voids the receipt again.

### Slices A and B merged; slice A closed, 2026-11-13

Slice A's port merged on 2026-11-12 as #3099 and slice B merged the same day as #3130. Four relaxed merges that day (#3121, #3125, #3126, #3119) left gate comments naming merge-async, the gated head and the bypass sent; history/2026-11-13-slice-a-closed.md quotes them and says what was not observed (a strict merge leaves no trace on GitHub, and whether #3099 itself merged through the new path is not known). The legacy call is deleted in this PR, which closes slice A. Next: slice C, two-layer stacks, then the pilot.

Lane chore/yeet-delete-legacy-merge

Reverse: Checkpoint only; nothing to reverse.

<!-- beep:decisions:end -->
