# Yeet Monitor App Identity Plan

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

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status yeet-monitor-app-identity completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug yeet-monitor-app-identity` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- First slice (3a): port the monitor's five flake classes into the
  `beep ci rerun-runner-loss` classifier with per-class tests, widen the
  workflow triggers, then delete `rerunJob` from `MonitorLoop.ts` in the same
  PR so no window exists where neither side reruns.
- 3a starts after `github-budget-ledger` lands and can open while
  `github-state-worker` is in flight; keep the three-open-PR cap across the
  three packets. 3a does not touch the snapshot readers, but it shares
  `MonitorLoop.ts` with goal 2 (goal 2 stops the monitor's polling and
  migrates its reads, including the job-log GETs the fingerprints use; 3a
  deletes `rerunJob` and moves `YeetMonitorFlakeClass` to
  `src/internal/github/FlakeClass.ts`). Whichever PR lands second merges
  `main` first.
- 3b starts only after `github-state-worker` and 3a merge: swap the worker's
  credential source to the App via `LoadCredential=`, add the App installation
  to the ledger's configured identities, and land the ruling-reversal
  decision. `user` stays an explicit per-host configuration value, not an
  automatic fallback.
- Before/after evidence comes from the `github-budget-ledger` ledger: capture
  a 24 h user-identity baseline before the switch and a comparable window
  after it, and record both in `history/`.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add yeet-monitor-app-identity --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/yeet-monitor-app-identity/GOAL.md)" -le 4000
jq . goals/yeet-monitor-app-identity/ops/manifest.json
rg -n "yeet-monitor-app-identity|GOAL.md|agentLaunchers|packetAnchorDocument" goals/yeet-monitor-app-identity
git diff --check -- goals/yeet-monitor-app-identity
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug yeet-monitor-app-identity`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
