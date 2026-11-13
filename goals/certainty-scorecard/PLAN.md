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
| 5b | feat(repo-cli): stamp capacity and host pressure on admitted and released rows | SCHE-09 slice 2 | S | Old rows decode and older readers keep the new optional fields byte-for-byte; promotion p95 overhead measured before and after; where the facts live (journal rows or unit observations) recorded as a decision | 5 |
| 6 | feat(yeet): journal final-check attempts | MEAS-07 | S | Journaling unit test plus a ready-gate regression fixture | none |
| 7 | fix(worktree): export attempt journals to local state on retire | PERIL-11 slice 1 | M | Retire, copy-failure, restore, duplicate-import, residue-reap maxAgeDays=0 fixture; each (runId, attemptId) once | 6 |
| 8 | chore(fleet): T3 root in roots.json; split monitor time out of economics | PERIL-11 slice 2 | S | `yeet economics --fleet` counts the T3 lane; runbook list updated | 7 |
| 9 | feat(yeet): optional host and seat fields on started rows; read fleet hosts read-only | PERIL-11 slice 3 | M | Old rows decode; fleet read uses only existing SSH routes and writes nothing remote; no raw rows leave local state | 7 |
| 10 | fix(yeet): report terminations apart from reds | MEAS-03 | S | Adjudicated fixtures; denominator change recorded | 3, 6 |
| 10b | fix(yeet): type the handler errors still read as unlocated | MEAS-03 slice 2 (unscheduled) | S | Adjudicated fixtures for the residual classes (publish input refusals, GitHub transport and rate limits, review-thread readiness refusals) drawn from a stratified sample of the live `unlocated` rows; `actionableLaneMix` total equals `redAttempts`; an unknown bucket stays | 10 |
| 11 | feat(ci): optional step and per-task outcome fields under v1 | ROUT-05 slice 2 | M | v1 corpora still decode; aggregator and setup reds become unknown | 2 |
| 11b | feat(ci): emit per-task outcome records the route capture reads into `tasks` | ROUT-05 slice 2b (the ROUT-06 producer) | S | Each lane step writes one `{task, outcome}` record per Turbo task from its run summary, uploaded with the run, and the capture fills `HostedJob.tasks` from it with its extra reads counted against the REST budget; a `check.yml` change, so the operator hand-merges it (the App token cannot merge a workflow PR) and the cache-policy baseline is re-recorded in the same PR; emitted rows decode under `route-corpus/v1`; a seeded failing task is classified `task` and a seeded setup failure `setup` | 11 |
| 12 | chore(route): capture 2026-10-31..now | ROUT-05 slice 3 | S | Captured by date range as a bounded background reader under github-budget-ledger's reserve signal (by hand and checkpointed until the signal lands); census conservation holds | 11 |
| 13 | feat(ci): project unit-results.json timings | MEAS-06 | S | Adds its own every-event upload (today's is failure-only); rows for every executed package; file counts equal expectedTestFiles by event; `check.yml` only, no `heavy.yml` edit; cache-policy baseline re-recorded in the same PR; merge identity planned (App token cannot merge workflow PRs) | 1 |
| 14 | refactor(ci): consolidate the lane-id maps | MEAS-05 slice 1 | S | One map; existing census and corpus tests unchanged | 2 |
| 15 | feat(quality): ledger fold with absent-source rows | MEAS-05 slice 2 | M | At least 95% of job-minutes mapped on three reference runs; no umbrella double count; the empty-leg runner-minutes row computed per run, with a fixture for a run that allocated an empty partition | 14, 1 |
| 16 | feat(yeet): join PSI samples | MEAS-08 | S | None (pure join, no hot-path stamps) | 15 |
| 17 | docs(goals): certainty-scorecard closeout | evidence | S | 7-night evidence note, fleet census note, reflection, `closeout` | all |

Waves under the three-PR limit: {1, 2, 3}, then {4, 5, 6} as each of the first wave merges, then {7, 10, 11},
{8, 9, 12}, {5b, 13, 14}, then {11b, 15}, then 16, then 17. Slice 10b is unscheduled: it takes a free slot in
any wave after 10 merges and does not gate the closeout.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status certainty-scorecard completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug certainty-scorecard` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- **First slice:** slice 1 above. It is CLI only; the nightly is slice 4. Name the command, its files and its
  test in that PR, not here.
- **Baseline before after-numbers:** the first certified nightly is the "before" for every sibling goal. Record
  it under `history/` with run ids and aggregates only; never a raw head list with branch names that carry
  session ids.
- **The nightly does not re-poll main (7-day horizon not built):** each night reads its day's main SHAs once,
  at its capture (decision `certainty-nightly-workflow`), so a verdict that lands later is counted only if that
  day is re-run. Build the re-poll when either holds: a recorded night in `history/certainty-nightly.md` has
  main commits still `open` or `no-run` at capture that later received a completed push run, or
  `main-verdict-every-commit` lands re-dispatch of missing main verdicts (its verdicts arrive after the push run
  they replace, so a once-read rate would understate main).
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

### Slice 1 merged; slice 2 (ROUT-05 slice 1) in review, 2026-11-12

Slice 1 (MEAS-01 slice 1 with MEAS-04) merged as #3118; its coverage rows were fixed by #3121 (decision `slice-1-coverage-reds`). Slice 2 maps every hosted job to a lane, a support job or unknown, and adds the conservation census `jobMinutes` to `beep ci route census` (decision `job-attribution-classes`). Next startable: MEAS-02 (slice 3) and the certainty-nightly workflow (slice 4); ROUT-05 slice 2 (PLAN slice 11) and the lane-id map consolidation (slice 14) wait on this slice.

Lane fix/rout-05-partition-map

Reverse: Delete this checkpoint and restore the slice-1 checkpoint as the latest PLAN status note.

### Baselines before d8326d5593 are not comparable (declaration-only builds), 2026-11-13

#3208 merged at d8326d55935849b4bf6fd29ec4ef80327efd6af8 (2026-11-13T05:44:35Z). Library builds are now `tsrs -p tsconfig.json --emitDeclarationOnly` with no Babel step and no JavaScript in a library dist. Every #build cache entry misses once from that commit, and the first cold run is not a regression. Any wall-time, cache-size or dist-size baseline recorded before it is not comparable with a reading after it, and the first certified nightly must be taken after it. Measured by the owning goal over 181 packages: build 80.9 s to 32.9 s, dist 232.5 MB to 147.9 MB (goals/declaration-only-builds/research/2026-11-13-build-after.md).

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

### Certainty nightly is live; first run recorded, 2026-11-13

The workflow from slice 4 (#3266) is on main. Its first run, dispatched for 2026-11-12, certified: run 43433123124, attempt 1, 84 GitHub requests, 2m43s of job time (3 billed minutes), 43 heads judged. Readings for that day: push to every required green over 32 code heads has 14 misses and a p50 of 23.3 minutes with p95 not attained; green-only code heads p50 15.8 and p95 27.9 minutes; main verdict rate 47.1% (8 of 17 non-docs commits, 9 cancelled); runner-minutes per green code head attempt p50 108.7. The row and the aggregates-only summary are under `history/`. This day is before the first countable day (2026-11-14), so P2 has zero of seven nights. Slices on main: 1, 2, 3, 4, 5, 6, 10, 11; in review: 7 (#3263).

Lane docs/certainty-nightly-first-run

Reverse: Delete this checkpoint and the 2026-11-12 row; they record a measurement and change no behaviour.

### Check-lane baselines before 3e822c71c5 are not comparable (check once), 2026-11-13

#3242 merged at 3e822c71c5 (2026-11-13). The root Turbo `check` task now depends on the package's own `build` for declaration-only packages, and their `beep:check` runs the declaration-only build command. Every `check` hash misses once, and the first cold run is not a regression. Build minutes now sit inside the check lane (Heavy / Check and Heavy / Build start together on separate VMs and both compute the build on a cold hash), so a check-lane wall-time or runner-minute baseline from before that commit is not comparable, and the first certified nightly must be taken after it. The cache-qualification and check-census baselines were re-recorded in that PR. `TSRS_FAST` is a global Turbo input and part of tsrs incremental state, so each baseline records whether it was set.

Lane fix/certainty-meas-03-terminations

Reverse: Delete this checkpoint; it records a fact about main and changes no behaviour.

### Slice 6 merged; slice 10 (MEAS-03) reports terminations apart from reds, 2026-11-13

Slice 6 (MEAS-07) merged as #3228. Slice 10 (MEAS-03) classes every economics attempt green, red or terminated in `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts`: a terminated attempt leaves `firstFailure.redAttempts` and its mixes, `attempts.*.classMix` reports the classes, `modeDurations` reports each run mode's elapsed p50 and p95 (final-check included), and a final-check moved-tree refusal is typed `refusal:moved-tree`. The report is `yeet-economics/v3` (decision `terminations-apart-from-reds`, which states the denominator before and after). The admission gate is `packages/tooling/tool/cli/test/yeet-economics-adjudicated.test.ts` over the committed journal `test/fixtures/yeet-economics/adjudicated-terminations.ndjson`, every attempt classified by hand with its reason. Other second- and third-wave slices run in their own lanes.

Lane fix/certainty-meas-03-terminations

Reverse: Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-10 PR.

### Slices 5 and 6 merged; slice 11 (ROUT-05 slice 2) in review: failed jobs keep their steps, uncharged reds become unknown, 2026-11-13

Slices 5 (SCHE-09 slice 1, #3227) and 6 (MEAS-07, #3228) merged; 11 is in review; 7 (PERIL-11 slice 1) and 10 (MEAS-03) started. Slice 11 adds optional `steps` and `tasks` keys to the v1 route corpus row and an origin for every failed job's red; aggregate, setup and harness reds are charged to no lane and reported as unknown in the replay (decision `step-classes-and-red-origins`). The old 2026-09-01..10-30 receipt still replays to 242 skipped lane runs and 0 skipped reds. The 2026-10-31..now capture (slice 12) starts once slice 11 merges, and is the first corpus whose failed jobs carry steps. New slice 11b, after 11, is the producer of per-task outcome records, a `check.yml` change the operator hand-merges; until it lands `tasks` stays absent.

Lane feat/certainty-rout-05-step-outcomes

Reverse: Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-11 commits.

### Slice 14 (MEAS-05 slice 1) in review: one lane map for every job-name join, 2026-11-13

Slice 14 makes `CI_LANE_DESCRIPTORS` the one job-name map: the descriptors gain `jobAliases` and `shardFamily`, and the new `packages/tooling/tool/cli/src/commands/Ci/CiLaneJobs.ts` derives the joins the route census, the lane-timings census, the certainty scorecard, heavy admission and the ruleset governance check read, in place of their own literals (decision `lane-job-map`). #3256's overflow name is the map's one called shard job. The admission gate holds: no existing test changed, `ci-lane-jobs.test.ts` reproduces every answer the replaced mappers gave on a56516d6d30 (fixture `test/fixtures/ci-lane-jobs/job-name-conservation.json`), and the 2026-09-01..10-30 receipt still replays to 242 skipped lane runs and 0 skipped reds. Slice 15 (the ledger fold) can read lanes and shard families from the map.

Lane refactor/certainty-meas-05-lane-map

Reverse: Delete this checkpoint so the certainty-nightly first-run checkpoint is the latest PLAN status note, and revert the slice-14 PR.

### Slice 2 merged; slice 3 (MEAS-02 with DEPS-10) attributes refusals by failure kind, 2026-11-13

Slice 2 (ROUT-05 slice 1) merged as #3141. Slice 3 fixes `actionableLane` in `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` on the read side: a handler-error verdict names the first unexecuted planned step as `failedStepId` (`Handler.ts`), so refusals were charged to `publish:00-head-install-preflight`. Refusals are now classified first, as rows of the same `actionableLaneMix`: `refusal:lock-bounce`, `refusal:stale-base` (the publish stale-base refusal sentence) and `refusal:closeout` (any red closeout). Then the first failed inner lane, then `failedStepId` only for a `step-exit` failure, then the first failed lane, then `unexecuted` (a handler error that ran no lane) or `unlocated`. Every red attempt stays one row, so the mix total equals `redAttempts` and the WaveOrder `mixSum` check keeps holding; `unchangedFingerprint.byActionableLane` uses the same classes. The writer in `Handler.ts`, `WaveOrder.ts`, `EconomicsSeedSourceView` and the frozen `goals/time-to-certainty/research/economics.json` are unchanged; the re-seed belongs to local-proof-under-ten (YEET-07). Rejected: filtering refusals out of the mix (breaks the `redAttempts` invariant and the seed check) and changing the writer (old journal rows would still carry the preflight id).

Lane claude/determined-morse-ea66a8

Reverse: Revert the slice-3 commit (actionableLane returns to the failed-step fallback) and delete this checkpoint so the slice-2 checkpoint is the latest PLAN status note.

### Slice 4 (MEAS-01 slice 2) in review: the certainty nightly workflow, 2026-11-13

Slices 10 (MEAS-03, #3262) and 11 (ROUT-05 slice 2, #3257) merged; slice 7 (PERIL-11 slice 1, #3263) is in review. Slice 4 (MEAS-01 slice 2) adds `.github/workflows/certainty-nightly.yml`: each night it scores the previous UTC day with `bun run beep ci certainty` from main's code, under the workflow token's `actions: read` and `contents: read`, with a request bound of the token bucket's remaining reads less the 15% reserve, and the run turns red when the report is not certified (decision `certainty-nightly-workflow`). The CLI gains `--summary-out`, an aggregates-only Markdown rendering used as the job summary. The record of each night goes to `history/certainty-nightly.md`, written by the driver from the run's artifact. A workflow change cannot be merged with the orchestrator App token, so the operator merges slice 4 by hand; P2's seven nights start at 2026-11-14, the first whole UTC day after both baseline breaks.

Lane ci/certainty-nightly-workflow

Reverse: Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-4 PR.

### Slice 5 (SCHE-09 slice 1) in review: trimmed admission rows archived and folded, 2026-11-13

Slice 3 (MEAS-02 with DEPS-10) merged as #3176. Slice 5 archives the rows the 200-admission ring trims to UTC day segments kept for 30 days under the admission root, folds them with the live journal in `bun run beep quality scheduler history`, and prunes aged segments in the scheduler reap pass (decision `sche-09-admission-archive`). The SCHE-09 pressure fields are the new slice 5b. local-proof-under-ten can read the retained history before its scheduler levers (SCHE-08, SCHE-07, SCHE-01/02) once every live checkout runs this revision. Still startable in the second wave: the certainty-nightly workflow (slice 4) and MEAS-07 final-check attempt journals (slice 6).

Lane feat/certainty-sche-09-admission-archive

Reverse: Delete this checkpoint so the slice-3 checkpoint is the latest PLAN status note, and revert the slice-5 commit.

### Slice 6 (MEAS-07) journals final-check attempts, 2026-11-13

Slice 3 (MEAS-02 with DEPS-10) merged as #3176. Slice 6 writes every `yeet final-check` run past the dirty-tree refusal to the branch's Yeet attempt journal as a `final-check` attempt, with the receipt it wrote, through `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts` and `AttemptJournal.ts` (decision `final-check-attempt-journal`). The admission gate is `packages/tooling/tool/cli/test/yeet-final-check-journal.test.ts`: unit tests for the terminal rows (pass, red gate, refusal, interrupt, defect, codec round-trip), a scratch-repository run that journals three attempts and folds them in economics, and the ready-gate regression fixture, in which `yeet ready` admits and refuses on the head receipt exactly as before while the journal holds an earlier passing receipt for the same head. Next startable once this merges: PERIL-11 slice 1 (slice 7, export attempt journals on retire) and MEAS-03 (slice 10, terminations apart from reds). Slices 4 and 5 run in their own lanes.

Lane feat/certainty-meas-07-final-check-journal

Reverse: Delete this checkpoint so the slice-3 checkpoint is the latest PLAN status note, and revert the slice-6 PR.

### Slice 7 (PERIL-11 slice 1) files attempt journals on removal, 2026-11-13

Slice 6 (MEAS-07) merged as #3228. Slice 7 files a checkout's Yeet attempt journals in the workstation attempt-journal store before any removal deletes it, and before residue-reap deletes a directory that holds checkouts; `yeet economics --fleet` reads the store as `(retained)`, so retired lanes stay in the fleet census (decision `attempt-journal-store`). The export runs in `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts` (inside the archive fence, before any capture, and before a plain removal), where a copy failure refuses the removal with preservation step `export-attempt-journals`, and in `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts`, where it keeps the directory with skip reason `journal-export-failed`. The admission gate is `packages/tooling/tool/cli/test/yeet-attempt-journal-store.test.ts`: retire against a planted copy failure, retire, restore from the archive ref, retire again (a duplicate import that appends only the new attempt), residue-reap with `maxAgeDays: 0`, residue-reap before a retirement, and a Codex worktree removal, with a fleet census after each step that holds each (runId, attemptId) once. Prune: the store has none; once it passes 256 MB, a prune needs its own decision (the store held 0 bytes at landing; the workstation's 371 live journals total 8.9 MB). Next startable once this merges: PERIL-11 slices 2 and 3 (slices 8 and 9).

Lane fix/certainty-peril-11-journal-export

Reverse: Delete this checkpoint so the slice-6 checkpoint is the latest PLAN status note, and revert the slice-7 PR.

<!-- beep:decisions:end -->
