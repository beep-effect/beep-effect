# Certainty Scorecard Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-read the live job names, lane contexts and journal shapes the levers touch; confirm the lever status table. | `SPEC.md` lever table matches the checkout at the start commit; any drift is a decision file. |
| P1 Implement | in-progress | Land the slices below in order: the CLI and mapping first, the nightly next, the local economics after. | Every slice merged with its admission gate green. |
| P2 Verify | pending | Run the nightly for 7 consecutive nights on main and the fleet economics census across a lane retirement. | 7 certified reports with no api-partial certification; retire fixture and fleet census recorded under `history/`. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. At most three open at once; the first three can open together as soon as the
graduation merges. Lever gates are in `SPEC.md` (Levers).

| # | PR | Levers | Size | Admission gate | Depends on |
| --- | --- | --- | --- | --- | --- |
| 1 | feat(ci): beep ci certainty head-level required-green and main-verdict report | MEAS-01 slice 1, MEAS-04 | M | Committed fixture corpus replays exactly; fixtures for the admission-to-Heavy start p50 and the full-to-owner-scoped Test Unit conversion share rows; monotonicity fixture; api-partial census refuses certification; per-attempt reads avoid the run 42646019844 502s; CLI only | none |
| 2 | fix(ci): map partition jobs to lanes with a conservation test | ROUT-05 slice 1 | S | Post-#3043/#3046 fixture maps every job (20 Test Integration partitions, 24 Test Unit jobs, Test Integration, Test Unit, Property Laws partitions, Test Plan, conditional aggregate names); old receipt reproduces 242 skipped, 0 skippedReds | none |
| 3 | fix(yeet): attribute refusals by failure kind | MEAS-02 (with DEPS-10) | S | `actionableLaneMix` total equals `redAttempts`; `gate-order-handoff.test.ts` green | none; must merge before any WaveOrder re-seed in `local-proof-under-ten` |
| 4 | ci: certainty-nightly workflow | MEAS-01 slice 2 | S | Workflow-security enumeration test; first run's runner-minutes and request count recorded; cache-policy baseline re-recorded; merge identity planned (App token cannot merge workflow PRs) | 1 |
| 5 | feat(repo-cli): archive trimmed admission rows | SCHE-09 | S | Archive fold tests; mixed-revision rows decode | none; `local-proof-under-ten` reads it before its scheduler levers |
| 6 | feat(yeet): journal final-check attempts | MEAS-07 | S | Journaling unit test plus a ready-gate regression fixture | none |
| 7 | fix(worktree): export attempt journals to local state on retire | PERIL-11 slice 1 | M | Retire, copy-failure, restore, duplicate-import, residue-reap maxAgeDays=0 fixture; each (runId, attemptId) once | 6 |
| 8 | chore(fleet): T3 root in roots.json; split monitor time out of economics | PERIL-11 slice 2 | S | `yeet economics --fleet` counts the T3 lane; runbook list updated | 7 |
| 9 | feat(yeet): optional host and seat fields on started rows; read fleet hosts read-only | PERIL-11 slice 3 | M | Old rows decode; fleet read uses only existing SSH routes and writes nothing remote; no raw rows leave local state | 7 |
| 10 | fix(yeet): report terminations apart from reds | MEAS-03 | S | Adjudicated fixtures; denominator change recorded | 3, 6 |
| 11 | feat(ci): optional step and per-task outcome fields under v1 | ROUT-05 slice 2 | M | v1 corpora still decode; aggregator and setup reds become unknown | 2 |
| 12 | chore(route): capture 2026-10-31..now | ROUT-05 slice 3 | S | Captured by date range as a bounded background reader under github-budget-ledger's reserve signal (by hand and checkpointed until the signal lands); census conservation holds | 11 |
| 13 | feat(ci): project unit-results.json timings | MEAS-06 | S | Adds its own every-event upload (today's is failure-only); rows for every executed package; file counts equal expectedTestFiles by event; `check.yml` only, no `heavy.yml` edit; cache-policy baseline re-recorded in the same PR; merge identity planned (App token cannot merge workflow PRs) | 1 |
| 14 | refactor(ci): consolidate the lane-id maps | MEAS-05 slice 1 | S | One map; existing census and corpus tests unchanged | 2 |
| 15 | feat(quality): ledger fold with absent-source rows | MEAS-05 slice 2 | M | At least 95% of job-minutes mapped on three reference runs; no umbrella double count; the empty-leg runner-minutes row computed per run, with a fixture for a run that allocated an empty partition | 14, 1 |
| 16 | feat(yeet): join PSI samples | MEAS-08 | S | None (pure join, no hot-path stamps) | 15 |
| 17 | docs(goals): certainty-scorecard closeout | evidence | S | 7-night evidence note, fleet census note, reflection, `proposedCloseout` | all |

Waves under the three-PR limit: {1, 2, 3}, then {4, 5, 6} as each of the first wave merges, then {7, 10, 11},
{8, 9, 12}, {13, 14}, then 15, then 16, then 17.

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

- **First slice:** slice 1 above. It is CLI only; the nightly is slice 4. Name the command, its files and its
  test in that PR, not here.
- **Baseline before after-numbers:** the first certified nightly is the "before" for every sibling goal. Record
  it under `history/` with run ids and aggregates only; never a raw head list with branch names that carry
  session ids.
- **Merge `main` before touching `LaneTimings.ts`:** `goals/ci-lane-economics` edits its shard layouts with
  every partition change.
- **Hand-offs:** slice 2 unblocks route refinement replays in `route-soundness-repair` and `hosted-setup-tax`;
  slice 3 unblocks the WaveOrder re-seed in `local-proof-under-ten`; slice 5 is that goal's scheduler evidence.
- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add certainty-scorecard --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/certainty-scorecard/GOAL.md)" -le 4000
jq . goals/certainty-scorecard/ops/manifest.json
rg -n "certainty-scorecard|GOAL.md|agentLaunchers|packetAnchorDocument" goals/certainty-scorecard
git diff --check -- goals/certainty-scorecard
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug certainty-scorecard`; add a `kind: checkpoint` file there, never edit this block._

### P0 complete; slice 1 (MEAS-01 slice 1 with MEAS-04) in review, 2026-11-10

P0 re-check at a0c7f356af3 is recorded in decision `p0-recheck-at-a0c7f356`. Slice 1 adds `beep ci certainty` (`packages/tooling/tool/cli/src/commands/Ci/Certainty.ts`, `Certainty.schemas.ts`), the per-attempt jobs read with partial-read stamping in `LaneTimings.ts`, and `packages/tooling/tool/cli/test/ci-certainty.test.ts` over two committed real captures. Next startable slices: ROUT-05 slice 1 (slice 2) and MEAS-02 (slice 3); the certainty-nightly workflow (slice 4) starts once slice 1 merges.

Lane claude/jovial-sammet-084b0a

Reverse: Delete this checkpoint and set P0 and P1 back to pending in ops/manifest.json.

<!-- beep:decisions:end -->
