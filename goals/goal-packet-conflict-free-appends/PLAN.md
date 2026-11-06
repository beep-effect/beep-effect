# Goal packet conflict-free appends Plan

## Status

Status: `active`

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
  (`bun run beep goals decisions add goal-packet-conflict-free-appends --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/goal-packet-conflict-free-appends/GOAL.md)" -le 4000
jq . goals/goal-packet-conflict-free-appends/ops/manifest.json
rg -n "goal-packet-conflict-free-appends|GOAL.md|agentLaunchers|packetAnchorDocument" goals/goal-packet-conflict-free-appends
git diff --check -- goals/goal-packet-conflict-free-appends
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug goal-packet-conflict-free-appends`; add a `kind: checkpoint` file there, never edit this block._

### Implementation landed in one lane, 2026-11-05

Schema, service contract, projection core, doctor findings, `beep goals decisions check|write|add`, bootstrap templates, golden fixtures, repo docs and this packet landed together in feat/goal-packet-decision-files. The knowledge doctor reads the same projection from a Git tree. Remaining: review window and merge by the orchestrator.

Lane `feat/goal-packet-decision-files`

Reverse: Revert the PR.

### Implementation merged; closeout re-final, 2026-11-06

PR #2702 merged 2026-11-06T00:10Z (merge 072748d024) without a closeout proposal. This docs-only PR carries the reflection, the phase flips and `proposedCloseout`. On main after merge: `decisions check` reported `packets=272 decisions=47 invalid=0 drift=0`, `goals doctor` reported `blocking_new=0`, and `goals-decisions.test.ts` passed 6/6. 13 packets now hold decision files and no open PR is CONFLICTING.

Lane `docs/goal-packet-conflict-free-appends-closeout`

Reverse: Revert this PR; the packet returns to active with no proposal.

<!-- beep:decisions:end -->
