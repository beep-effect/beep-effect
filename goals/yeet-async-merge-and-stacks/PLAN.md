# Yeet Async Merge and Native Stacks Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | pending | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

P1 Implement and P3 Yeet run once per slice; a slice is a PR.

| Slice | Status | First step | Done when |
| --- | --- | --- | --- |
| A, async merge | pending | Schema for the request and the outcome union; then the `GithubRest` call and poll. | The slice's own PR merges through the new path and a blocked PR shows the hold. |
| B, rewrite-stable proof | pending | Head-move classifier over patch-ids, with the test's rewritten heads as fixtures. | Window and receipt survive an unchanged rewrite and restart on a changed one. |
| C, two-layer stacks | pending | Decide in P0 whether layers are linked through `gh stack` or the Stacks REST API. | One real two-layer stack lands through Yeet end to end. |
| D, pilot | pending | Start the pilot record on the first routine stack. | Two weeks measured and the continue-or-stop decision filed. |

P0 Research settles, before slice A: the async endpoint's behaviour for a
409 and for an expired result; and before slice C: how to wake
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

_No checkpoint files yet._

<!-- beep:decisions:end -->
