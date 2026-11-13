# Main Verdict Every Commit Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Land the cancel ban (slice 1) and settle the facts the later slices need: which scorecard fields report main verdicts, first-wave pickup, heavy wait and cancel attribution; whether the re-run API accepts a cancelled push run. | Slice 1 merged; each fact recorded as a decision file or a `history/` note with its evidence. |
| P1 Implement | pending | Slices 2 to 4 in the order below, each behind its admission gate. | Each slice merged, or refused by its gate and the refusal recorded. |
| P2 Verify | pending | Read the 7-day (and 14-day) windows from the scorecard. | Acceptance numbers recorded under `history/`, the residual against the 95% bar named as `merge-queue-activation`'s. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

PR-sized, in landing order. At most three of this packet's PRs are open at once: slice 1 lands alone, slices 2
to 4 may be open together. Every slice touching `.github/workflows/` is merged by its owner with the
workflow-scoped user token (the orchestrator's App token cannot merge it) and freezes coverage rows at base:
plan the S11 path and re-record the cache-qualification baseline in the same PR. Per-SHA concurrency groups
are not a slice: the per-commit verdict is handed to `merge-queue-activation` (`verdict-placement`, D28).

| # | Slice (PR title) | Lever | Size | Admission gate | Depends on | Revert |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `docs(agents): never cancel refs/heads/main runs` (one clause in the AGENTS.md "Inherited reds" bullet; the "Red check" and "Queue starved" rows of the orchestrate skill) | HOST-01 a | S | none; carry another ready always-loaded edit in the same PR only if it is ready the same day | nothing | `git revert` of the commit; docs only, so the orchestrator may merge it |
| 2 | `feat(ci): replay main merge timestamps against the hosted ceiling and heavy pool` (a planned replay subcommand on `@beep/repo-cli` plus the report under `history/`, published as input for `merge-queue-activation`'s owner) | replay | M | the current-layout replay is calibrated against the scorecard's measured week, and the report states the calibration error, before any projection is used | scorecard: main verdict rate, per-run job counts, PR first-wave pickup and heavy wait | revert the command; the report stays as evidence |
| 3 | `perf(ci): throughput partition layout for main push runs` (push branch of the Test Plan job, the partition generator, a census-parity test) | HOST-01 b | M; L if heavy lanes change | canonical test-id census equals the full profile exactly; every push leg projected, from measured file seconds, to finish inside its 20-minute shard timeout (`timeout-minutes` on the `test-unit-shard` and `test-integration-shard` jobs); Coverage Regression still gets every push manifest; the replay with the layout shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min and reports projected heavy slot-hours per day | 2; `main` merged | revert PR: the push branch publishes every partition again (`test-plan` job, `Publish partition plan` step, env `ALL_TEST_UNIT_PARTITIONS` and `ALL_TEST_INTEGRATION_PARTITIONS`) |
| 3b | only if the replay says heavy lanes must batch on push: additive `heavy.yml` layout under a migration name, then a retiring PR | HOST-01 b | M + S | post-merge Heavy probe on each merge SHA (`docs/runbooks/ci-hosted-settings.md`) | 3 | the retiring PR is not opened; revert the additive PR |
| 4 | `feat(ci): re-dispatch missing main verdicts beside rerun-runner-loss` (a separate job on the same `workflow_run` trigger plus a planned re-dispatch subcommand) | HOST-01 c | S | decision tests: re-run only when no main Check run is queued or pending, newest unverdicted non-docs SHA first, attempt ceiling, docs-only and PR runs refused, kill switch honoured; the replay, run with re-dispatch included, shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min | 2; scorecard main census; merge `main` after yeet-monitor-app-identity 3a if it is open | set the kill-switch repository variable to `false`, then revert the PR |

Slices 2 and 3 deliver the layout `merge-queue-activation` waits on and the replay published for its owner;
with slice 4 they complete `ci/main-verdict`. Tell the `explorations/github-merge-queue` owner when the layout
lands and the replay is published.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status main-verdict-every-commit completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug main-verdict-every-commit` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add main-verdict-every-commit --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.
- **Dependency:** requires `ci/certainty-scorecard` for every number. Slice 1 needs nothing and starts now.
  Read the pre-change week's main verdict rate before slice 1 merges if the scorecard already reports it;
  otherwise record the start date so the scorecard can read it later.
- **Order constraints:** cancel ban, then replay and layout, then re-dispatch (D7 as amended by D28); the
  replay counts the job-adding and job-removing levers that have landed (D19); heavy pool at cap 2 throughout
  (D11).
- **Shared files:** `.github/workflows/check.yml` (every CI goal), `.github/workflows/rerun-runner-loss.yml` and
  `RunnerLossRerun.ts` (yeet-monitor-app-identity 3a), the Test Plan job and `vitest.shards.json`
  (ci-lane-economics), `AGENTS.md` (local-proof-under-ten's PERIL-09) and `.claude/skills/orchestrate/SKILL.md`
  (local-proof-under-ten's PERIL-10). Merge `main` before each push to these files; whichever lands second
  merges `main` first. `merge-queue-activation` will later rewrite the merge doctrine in `AGENTS.md` and the
  orchestrate and yeet skills.
- **Evidence:** every window read (dates, command, numbers) goes under `history/`, never raw run dumps.

## Verification Commands

```sh
test "$(wc -m < goals/main-verdict-every-commit/GOAL.md)" -le 4000
jq . goals/main-verdict-every-commit/ops/manifest.json
rg -n "main-verdict-every-commit|GOAL.md|agentLaunchers|packetAnchorDocument" goals/main-verdict-every-commit
git diff --check -- goals/main-verdict-every-commit
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug main-verdict-every-commit`; add a `kind: checkpoint` file there, never edit this block._

### Main cancel ban starts 2026-11-10; anchor for the before/after verdict reads, 2026-11-10

Slice 1 (HOST-01 a) adds the ban to the AGENTS.md Inherited-reds bullet and the orchestrate skill's Red check and Queue starved rows: the unblocker cancels pull-request runs only, never a `refs/heads/main` run, queued or running. No certainty scorecard is on `main` yet (MEAS-01 slice 1 is unmerged), so the pre-change main verdict rate cannot be read now. The ban's start date is 2026-11-10 (UTC, the day this PR merges): the 7-day before window is 2026-11-03 to 2026-11-09 and the 7-day after window, which is also the first zero-agent-cancel window, is 2026-11-11 to 2026-11-17. The scorecard reads both once it reports the main verdict rate and cancel attribution; slice 2 (the replay) waits on those numbers.

Update 2026-11-13: #3118 has since put `beep ci certainty` on `main`. It reports the main verdict rate but not cancel attribution, first-wave pickup p95 or heavy-wait p95 (decision `scorecard-field-census`); the before-window read is in `history/2026-11-13-pre-ban-main-verdict-rate.md`.

Lane docs/main-cancel-ban

Reverse: Revert the cancel-ban PR and delete this checkpoint; the before/after reads then have no anchor.

### Cancel ban enforced by the cancel commands, 2026-11-12

Post-merge review of #3111 found that the ban was doctrine only: `yeet gh checks cancel-queued` (`runYeetGhChecks`) and the merge gate's post-merge `cancelMergedHeadRuns` cancelled every active run on a head sha, so a PR head equal to a commit with a live main push run would have its main run cancelled. `GithubWorkflowRunRecord` now carries `event` and `headBranch` from the actions/runs payload, and both commands cancel only runs `isAgentCancellableWorkflowRun` accepts (event `pull_request` or `pull_request_target`). A push, merge_group, scheduled or unreported-event run is left alone. A recorded-payload test pins a main push run on the PR head sha as kept.

Lane fix/cancel-queued-pr-runs-only

Reverse: Revert the PR; the ban then rests on the AGENTS.md clause and the orchestrate skill alone.

### P0 complete; P1 held until the scorecard reports first-wave pickup and heavy wait, 2026-11-13

P0 Research is complete: slice 1 merged (#3111, guard #3140), and each P0 fact is recorded with its evidence: decision `scorecard-field-census` (which scorecard fields report main verdicts, first-wave pickup, heavy wait and cancel attribution), decision `rerun-api-cancelled-push-runs` (the re-run API and cancelled push runs) and the history note `2026-11-13-pre-ban-main-verdict-rate`. P1 stays pending: slice 2 (the replay) is held under SPEC "Stop Conditions" because the scorecard cannot report first-wave pickup or heavy wait, and slices 3 and 4 gate on the replay. The two measured days of Check runs (decision `check-run-queue-measurements`) are calibration input for the replay, not a substitute for the scorecard.

Lane claude/amazing-swirles-67011b

Reverse: Set P0 back to in-progress and delete this checkpoint if a P0 fact is found unrecorded.

<!-- beep:decisions:end -->
