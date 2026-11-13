# GitHub State Worker Plan

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
   `bun run beep goals set-status github-state-worker completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug github-state-worker` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add github-state-worker --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- **Dependency:** starts after `github-budget-ledger` lands its reserve signal and ledger
  (`requires: github/budget-ledger`). Record the "before" numbers from that ledger, worker off, before any reader
  change merges.
- **P0 first:** decide the snapshot store, freshness bound, cadence and ETag partition key as decision files, and
  measure `rateLimit { cost }` for the fingerprint and detail documents before fixing their shape.
- **First slice:** the ETag `fetch` layer in `@beep/github` plus the worker writing PR snapshots for the locally
  owned set, with the monitor as the first reader. Then ready/merge-gate, then watch/gate-table/watchers and
  `status --cached` with the skill updates. Keep at most three open PRs across the packet.
- **Hands off to `yeet-monitor-app-identity`:** keep the token behind `LoadCredential=` so goal 3 swaps only the
  credential; its rerun widening (3a) may run alongside this goal.
- **Shared file with goal 3a:** `src/commands/Yeet/internal/MonitorLoop.ts`. This goal stops the monitor's polling
  and migrates its reads (including the job-log GETs the flake fingerprints use); 3a deletes `rerunJob` and moves
  `YeetMonitorFlakeClass` and its log fingerprints to `src/internal/github/FlakeClass.ts` beside `JobShape.ts`.
  Whichever PR lands second merges `main` first; if 3a has landed, import the classifier from its new path.

## Verification Commands

```sh
test "$(wc -m < goals/github-state-worker/GOAL.md)" -le 4000
jq . goals/github-state-worker/ops/manifest.json
rg -n "github-state-worker|GOAL.md|agentLaunchers|packetAnchorDocument" goals/github-state-worker
git diff --check -- goals/github-state-worker
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug github-state-worker`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
