# T3 Code Fleet Rollout Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Restore a tom-pc-1 access route; record each host's arch, Node and service state; confirm how to disable T3's updater on fork builds. | Required facts and blockers are recorded. |
| P1 Implement | pending | DankStation pack and publish; pull timer and `t3 service` on beep-worker, dankserver, tom-pc-1 WSL; Tailscale HTTPS; hub-and-spoke links; runbook and host profiles. | Acceptance criteria are met. |
| P2 Verify | pending | Version parity, reboot survival, a reachability check from DankStation, and one linked-thread turn per host, recorded in `history/`. | Verification is green or blockers are documented. |
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

## Verification Commands

```sh
test "$(wc -m < goals/t3code-fleet-rollout/GOAL.md)" -le 4000
jq . goals/t3code-fleet-rollout/ops/manifest.json
rg -n "t3code-fleet-rollout|GOAL.md|agentLaunchers|packetAnchorDocument" goals/t3code-fleet-rollout
git diff --check -- goals/t3code-fleet-rollout
```
