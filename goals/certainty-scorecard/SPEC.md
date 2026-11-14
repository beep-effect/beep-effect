# Certainty Scorecard Spec

## Objective

Make the ten-minute target reportable and every sibling goal's claim checkable. Concretely:

- A read-only head-level report, a planned `ci certainty` subcommand on `@beep/repo-cli`, computes per PR head
  SHA the time from the first push to every one of the 15 required contexts green, and per main first-parent
  commit whether it received a completed hosted verdict. A nightly workflow runs it and uploads the report.
- The headline statistic is p95 push to every required context green on **code heads**, with red, held and
  api-partial heads counted as not attained and superseded heads censored. Beside it, never inside it: the
  green-only p95 (diagnostic), runner-minutes per run split by pool, push to Yeet-mergeable, coverage-verdict
  p95, the main verdict rate, and docs heads as their own class.
- `ci lane-timings` reads jobs per attempt, stamps partial reads, and refuses to certify an incomplete census.
- The route corpus maps every hosted partition job to its lane, so the census and the cost ledger stop losing
  29% of run minutes.
- Local economics become attributable: refusals are classed by failure kind, terminations are reported apart
  from reds, final-check attempts are journaled, journals survive lane retirement, T3 lanes and fleet hosts
  are read, and admission history outlives the 200-row ring.
- The report names what it does not cover.

Baseline the scorecard must reproduce first, from the plan
(`explorations/ten-minute-certainty/research/phase2/PLAN.md`, "How to state the projection" and "First three PRs") and
the measurement area record (`explorations/ten-minute-certainty/research/phase2/merged/measurement.md`): code heads p50 48.5 and p95 124.5 min with 2 of 27 under 10 (Opus, 90 heads);
docs-only heads p95 4.0 min; 42% of PR runner-minutes on superseded heads; 4 of 30 runs under 10 with a
green-only p95 of 101.9 min and about 315 runner-min per run (Astra, 30 runs); main verdict rate 13% (13 of
101 commits, Opus) and 16.67% (5 of 30 first-parent commits, Astra).

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md),
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 1, Measure),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (goal 1),
[`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D2, D5, D6, D16, D18, D19, D23, D27, D28).

## Non-Goals

- Moving the target. This goal measures it; no lever here removes, adds or reorders a job on the pull-request or main
  Check path (the certainty nightly is a separate scheduled, read-only workflow, and MEAS-06 adds only a step to
  an existing `check.yml` job), and it promises no p95 (D20: the plan's own projection is p95 70 to 115 min for code heads without capacity).
- Any proof-depth reduction: property run floors and seeds, coverage floors, the canonical test census, the
  full corpus replay per PR and the required contexts stay as they are.
- Counting Yeet-mergeable contexts (Lint Policy, Property Laws, Coverage Regression, Fallow) inside the SLO
  statistic. They are reported beside it (D5).
- Making Coverage Regression a required context. The scorecard reports the number that reopens that candidate;
  the decision is not taken here (D6).
- The main throughput layout, the never-cancel-main amendment and missing-verdict re-dispatch
  (`main-verdict-every-commit`), and per-SHA main groups, now folded into the gated `merge-queue-activation`
  candidate in `explorations/github-merge-queue` (D28, operator ruling `verdict-placement`). This goal reports
  the verdict rate, the cancel actor and the replay inputs `main-verdict-every-commit` is judged on; no
  scorecard row is a merge-queue gate, and it does not report the merge-queue lab's own merge-group numbers
  (ruling `gate-restatement`).
- Heavy-pool capacity. The scorecard reports the post-diet heavy-queue p95; any cap change is money and goes
  to the operator only with that residual (D11).
- A budget rule or a new GitHub identity. The reserve signal belongs to `github-budget-ledger` (D27).
- Using measurement windows as route gates. The scorecard is evidence, not an admission gate (C7 in the
  measurement area record).
- Committing raw attempt journals, admission rows, home paths, session or machine identifiers to the public
  repository (D18).
- Caching or reusing any proof result. Shadow and attribution only while the R2 pause holds (D14).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli` (`@beep/repo-cli`):
  - A new `Certainty.ts` and `Certainty.schemas.ts` under `packages/tooling/tool/cli/src/commands/Ci`, wired in
    `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts`; reads required contexts through
    `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts` and `standards/branch-protection-contexts.json`,
    check runs through `packages/tooling/tool/cli/src/internal/github/GithubRest.ts`.
  - `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts`: per-attempt job reads
    (`collectCiWorkflowRunAttemptJobs`; the recent mode still reads `filter=all` at line 1131), partial-row
    stamping that reuses the `--window` preview stamp (`renderCiLaneTimingWindowPreviewBanner`, line 3960), a
    filtered recent mode.
  - `packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts` (`jobNameToLane`, line 168) and
    `packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts`: partition job mapping, step classes and
    per-lane outcome fields.
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` (`actionableLane`, line 1154;
    `isRed`, line 1013; `terminations`, line 1399) and
    `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts`: refusal classes, terminations
    apart from reds, optional seat and host fields, the PSI join.
  - `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts`: journal final-check attempts.
  - `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueReap.ts` (the `yeet` entry is not retained,
    line 1776) and the Worktree archive path: export journals on retire.
  - `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` (`RETAINED_ADMISSIONS = 200`, line
    59): archive trimmed admission rows with pressure fields.
  - Tests under `packages/tooling/tool/cli/test/`: `ci-lane-timings.test.ts`, `ci-route-census.test.ts`,
    `ci-route-corpus.test.ts`, `yeet-economics.test.ts`, `gate-order-handoff.test.ts`, `residue-reap.test.ts`,
    `yeet-final-check.test.ts`, `quality-scheduler.test.ts`, `ci-runner-security.test.ts`, and a new
    `ci-certainty.test.ts` with a committed fixture corpus.
- `.github/workflows/`: a new certainty-nightly workflow modelled on
  `.github/workflows/knowledge-baseline-mint.yml` (schedule, one run at a time, `contents: read`), and the
  unit-results projection step in `.github/workflows/check.yml` (MEAS-06; today the only upload is the
  failure-only step at lines 924 to 934 of that workflow, so the projection needs its own every-event step).
- `docs/runbooks/fleet-roots-and-registry.md`: the T3 root row in the intended `roots.json` list.
- This packet (`goals/certainty-scorecard/**`).

No new workspace package is planned. If one becomes necessary it is bootstrapped with
`bun run beep create-package`.

### Levers

Status checked against the live checkout at 6eb2e0588e2 and re-checked at c90929b1ff1 after #3040, #3043 and
#3046; no status changed (decision `lever-status-at-graduation`). Re-checked at a0c7f356af3 after #3056 and #3041
(decision `p0-recheck-at-a0c7f356`); slice 1 moves MEAS-01 and MEAS-04.

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| MEAS-01 | Nightly head-SHA scorecard: push to every required green, main verdict cohorts, runner-minutes, mergeable beside | slice 1 landed: `beep ci certainty` CLI (`Certainty.ts`, `Certainty.schemas.ts`), scoring fixed 2026-11-13 (decision `certainty-scoring-fixes`), landed over two unrecoverable replay anchors (decision `slice-1-gate-anchors`); fixture replay reproduces green-only p95 101.9 and the per-head cases, but not 4 of 30 under 10 min (1 code head under ten in the fixture) or about 315 runner-min per run (251.08 per head attempt; 315.3 is one head), membership unrecoverable (decision `fixture-corpus-real-captures`); slice 2, the nightly workflow (PLAN slice 4), is in review: `.github/workflows/certainty-nightly.yml` scores, from main's code, the UTC day before each run's `created_at` (kept by a GitHub re-run) or a dispatched `day`, within the token bucket less the 15% reserve and fails red on an uncertified report, and `--summary-out` renders the aggregates-only job summary (decision `certainty-nightly-workflow`) | Fixture replay: 4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run, plus per-head cases (two producers, three attempts, docs-only, cancelled); monotonicity fixture (turning a green head red never lowers the statistic); an api-partial census refuses certification; the nightly fits the GITHUB_TOKEN budget or resumes | MEAS-04 |
| MEAS-04 | lane-timings per-attempt job reads, partial-row stamping, filtered recent mode | partly landed: the window census and the certainty reader read jobs per attempt with a 30-job fallback and stamp partial reads (decision `per-attempt-page-fallback`); the recent mode still reads `filter=all` (`LaneTimings.ts:1131`) and has no filters | Fixtures for 502, exhaustion, duplicate and rerun; partial output reuses the `--window` preview stamp on both renderers; live union parity on run 42655574858; 180 jobs on run 42646019844 | none |
| MEAS-02 | Attribute lock-bounce, stale-base and closeout refusals outside first-failure lanes (merges DEPS-10) | landed (slice 3, #3176, 0f7a40369eb: refusals attributed by failure kind inside `actionableLaneMix`, checkpoint `slice-3-refusal-attribution`) | Fixtures in `yeet-economics.test.ts`; `actionableLaneMix` total equals `redAttempts`; `gate-order-handoff.test.ts` stays green | none |
| MEAS-03 | Separate terminations and type unlocated failures | slice 10 (decision `terminations-apart-from-reds`): terminated attempts count apart from reds in `yeet-economics/v3` (`classMix`, a restated `redAttempts`), `modeDurations` reports per-mode p50 and p95, a final-check moved tree is `refusal:moved-tree` and a verdict-less red `unrecorded`; slice 10b (#3342, decision `handler-errors-typed-and-located`) types the residual `unlocated` handler errors at the raise site (`YeetHandlerErrorKind`, the verdict's `handlerErrorKind`) and locates them as `refusal:publish-input`, `refusal:review-threads`, `github:rate-limit` and `github:transport`, with `unlocated` kept as the unknown bucket | Adjudicated fixtures; the denominator change is recorded | MEAS-02, MEAS-07 |
| MEAS-07 | Journal final-check invocations and keep per-run history | landed in slice 6 (decision `final-check-attempt-journal`: each run is a `final-check` attempt in the branch attempt journal, carrying the receipt it wrote; `yeet ready` still reads only the head receipt); the per-mode duration row rides MEAS-03 (slice 10) | Journaling unit test plus a ready-gate regression fixture | none |
| PERIL-11 | Keep attempt journals outside the reaped residue root; T3 lanes via `roots.json`; seat and host fields (merges MEAS-09) | partly landed: slice 1 (PLAN slice 7, decision `attempt-journal-store`) files a checkout's journals in the workstation store before any removal deletes it (a copy failure refuses the removal) and before residue-reap deletes a directory holding checkouts (a copy failure keeps it), and `yeet economics --fleet` reads the store as `(retained)` with live rows winning; slice 2 (PLAN slice 8, decision `peril-11-slice-2-t3-root-and-monitor-waits`) adds the T3 Code worktree root to the runbook's intended `roots.json` list, reads a checkout reachable through two roots once, and reports monitor waits apart from local work (`yeet-economics/v4`); the workstation's own `roots.json` is not written yet (its orphaned lanes' journals go to the store first); no host or seat fields (slice 9) | Fixture: retire, simulate a copy failure, restore, import duplicates, run residue-reap with maxAgeDays=0, re-census; each (runId, attemptId) appears exactly once and a copy failure blocks deletion | MEAS-07 |
| ROUT-05 | Route corpus with partition mapping, step classes and per-lane outcomes in one capture (merges ROUT-06) | partly landed (slice 1: partition and alias mapping with a lane, support or unknown conservation census, decision `job-attribution-classes`; guarded by literal per-class minutes from the fixture's raw timestamps, and the replay marks recall uncertain when a skipping head has a failed job no rule maps, decision `replay-unknown-reds`; slice 2 in review: failed jobs keep their steps and rows take optional per-task outcomes under v1, and aggregate, setup and harness reds are charged to no lane and reported as unknown, decision `step-classes-and-red-origins`; the 2026-10-31..now capture remains) | An old receipt restored to a scratch `--corpus` dir reproduces 242 skipped and 0 skippedReds; a post-#3043/#3046 fixture maps every job (conservation test: mapped plus unknown minutes equal total); aggregator and setup reds become unknown, never dropped | none |
| MEAS-06 | Project the existing Vitest unit-results.json into per-file and per-package timing on every event | open (unit-results.json is uploaded only by the failure-only step at `.github/workflows/check.yml:924-934`; nothing projects it) | Rows exist for every executed package and file counts equal expectedTestFiles, stratified by event | MEAS-01 |
| MEAS-05 | Joined per-check cost ledger at (lane, partition) grain with asymmetric digests | slice 1 landed (PLAN slice 14, #3274, decision `lane-job-map`): `CI_LANE_DESCRIPTORS` is the one job-name map (`jobAliases`, `shardFamily`) and `CiLaneJobs.ts` derives the census, scorecard and admission joins from it, held by a conservation fixture of the replaced mappers; the ledger fold (slice 15) remains | At least 95% of job-minutes mapped on the three reference runs; an umbrella-plus-partition fixture shows no double count | ROUT-05, MEAS-04 |
| MEAS-08 | Time-join PSI samples onto attempts (no hot-path stamps) | open | None | MEAS-05 |
| SCHE-09 | Retain admission history beyond the 200-row ring, with pressure fields | partly landed: slice 5 (#3227, decision `sche-09-admission-archive`) archives the rows the ring (`AdmissionJournal.ts:59`) trims and folds them in `quality scheduler history`; slice 5b (#3344, in review) stamps an optional capacity and host-pressure `pressure` key on admitted and v3 released rows behind the protocol's own `pressure` gate (decision `sche-09-pressure-stamps`) | Archive fold tests | none |

### Numbers the scorecard reports

Each row is per nightly report with its n, attainment and censoring counts, split code and docs heads where it
applies. "Reader" is the goal or gated candidate whose acceptance or gate is judged on the row.

| Row | Reader |
| --- | --- |
| p95 push to every required context green, code heads, misses counted (the SLO statistic); p50 and attainment under 10 min | all goals; BRIEF target |
| Green-only p95 (diagnostic only) | none; shown so the gap to the SLO statistic is visible |
| Push to Yeet-mergeable p95, beside the statistic | operator view of the gap D5 excludes; review-window binding share |
| Coverage-verdict p95 per code head | gated candidate "Coverage Regression as a required context" (under 10 min) |
| Runner-minutes per run, split GitHub-hosted and beep-ec2-heavy; per green code run p50 and p95 | `hosted-setup-tax` (p50 at most 244 against the 264 baseline, p95 reported beside it; a re-baseline taken before its first workflow slice merges is reported beside the bar, not substituted) |
| Heavy slot-minutes per code run; heavy-queue (pickup) p95 on the required path | `heavy-pool-diet` (at least 20% down); gated candidate "heavy-pool capacity" (post-diet p95 still binding) |
| Lint Policy wall p95; Property Laws p95 | `heavy-pool-diet` (Lint Policy at most 9 min); gated candidate "Property Laws sharding" (over 10 min after the split) |
| Main verdict rate over non-docs first-parent SHAs, 7-day late-arrival horizon; main run cancel actor | `main-verdict-every-commit` (its layout and re-dispatch criteria, zero agent-initiated cancels, and the residual against the plan's 95% bar, which `merge-queue-activation` in `explorations/github-merge-queue` is expected to close, D28; not that candidate's gate); gated candidate "smoke-per-PR corpus replay" (at least 95% for 14 days) |
| PR first-wave pickup p95 and heavy-wait p95; merge-timestamp replay inputs (main merge timestamps and hosted jobs per run) | `main-verdict-every-commit` (at most 1 min regression, judged on its merge-timestamp replay) |
| Superseded-head runner-minute share | operator view of push churn (42% at baseline) |
| Admission-to-Heavy start p50 on non-docs PR runs: the `Heavy Admission` job's start (`check.yml:87`) to the first `Heavy / *` job's start, from the per-attempt job reads | `heavy-pool-diet` (at least 0.5 min faster p50) |
| Share of PR runs converting from a full to an owner-scoped Test Unit selection: the Test Unit partition jobs a PR run allocated against the full layout, after the `Test Plan` job (`check.yml:732`) | `hosted-setup-tax` (TURB-01) |
| Empty-leg runner-minutes per run: runner-minutes of Test Unit and Test Integration partition jobs whose plan selected no tasks, from the MEAS-05 (lane, partition) ledger joined to the `Test Plan` output | `hosted-setup-tax` (ROUT-01) |
| Local publish p95 and verify p50 and p95 on the fleet census, with censoring counts | `local-proof-under-ten` (publish p95 at most 8 min, verify p50 at most 10 min) |

## Constraints

- **Design order:** schema first (head row, head state literal `green | red | cancelled | held | open |
  api-partial` as a `LiteralKit`, main-commit verdict row, report and censoring counts, ruleset digest, refusal
  classes, the retained-journal and archived-admission rows), then a `Context.Service` contract for the report
  reader, then implementation. Effect v4 only, validated against `.repos/effect`; `Effect.fn` /
  `Effect.fnUntraced`; `effect/HashMap` / `HashSet`, never native `Map` / `Set`.
- **SLO statistic (D5):** all terminal, non-superseded code heads are in the denominator; red, held and
  api-partial heads count as not attained; superseded heads are censored and their cost reported as a share.
  T0 is the first `check.yml` pull_request run's `created_at`, with its clock source recorded. Heavy contexts
  come from two workflows (`check.yml` and `heavy-admit.yml`): the latest start wins and skip-satisfied
  counts. A ruleset digest is recorded per head; a head judged under a different ruleset says so.
- **Job names the mapping must handle** (live at a0c7f356af3): `Test Integration (<partition>)` (`check.yml:1010`;
  20 partitions since #3029: 19 lps-int shards plus int-rest) and its aggregate, whose name is conditional (`Test Integration Partitions`
  or `Heavy / Test Integration`, `check.yml:1133`); `Test Unit (<partition>)` (`check.yml:821`; 24 jobs since #3043: nine
  repo-cli and eight law-practice shards on two Vitest workers since #3040, seven unit bins on one) and
  the `Test Unit` aggregate (`check.yml:978`); `Test Plan` (`check.yml:732`, #3030); `Property Laws
  (<partition>)` slices (`check.yml:1435`; four since #3056) under the `Property Laws` aggregate (`check.yml:1549`, #3030); the
  conditional `Coverage Artifact Migration` / `Heavy / Coverage Regression` name (`check.yml:1160`). Since #3046
  test shards are created before the non-test lanes and shard timeouts cap at 20 minutes, so job order within
  a run is not a stable key.
  An unmapped job is reported as unknown, never dropped. Required-context names do not change.
- **Order (critic):** MEAS-04 before MEAS-01; MEAS-02 before any WaveOrder re-seed (YEET-07) or preflight
  reordering in `local-proof-under-ten`, as one slice with DEPS-10 so the seed is re-cut once (gate-order seed
  pointers index into `actionableLaneMix`); ROUT-05 before any census or ledger (MEAS-05) is trusted and before
  any route refinement replay in other goals; MEAS-07 before PERIL-11; MEAS-05 before MEAS-08.
- **Nightly cost (critique caveat):** the plan books MEAS-01 at about 3-6 runner-min per night and the area
  record at about 1; the critique notes that the latter ignores install cost and the GITHUB_TOKEN budget
  (about 1,000 requests per hour per repository) against about 700 re-polled main SHAs plus per-attempt job
  reads. The nightly measures its own runner-minutes and request count from its first run, re-polls only SHAs
  inside the 7-day horizon, and checkpoints and resumes rather than certifying a partial census.
- **REST budget (D16, D27):** local captures (route corpus, ad-hoc certainty or lane-timings runs) are background
  readers under `github-budget-ledger`'s 15% per identity x resource reserve signal; until that signal lands
  they run by hand, bounded, and resume from a checkpoint after a rate-limit stop. The ROUT-05 annotation
  capture was estimated at about 40k API calls by the routing skeptics: slice it by date range. No budget rule
  is defined here.
- **Fleet economics (D18):** journals are exported outside the reaped residue root before a retire deletes
  them, and a copy failure blocks deletion; T3 lanes enter through one `roots.json` row; fleet hosts are read
  read-only over the existing SSH routes; seat and host fields are optional so mixed-revision journals decode;
  raw journals and admission rows stay in local state, and only aggregates appear in reports or packet files.
- **Workflow PRs:** the nightly workflow and the MEAS-06 `check.yml` step are workflow changes. A workflow
  change freezes coverage rows at base and needs the cache-policy baseline re-recorded in the same PR; the new
  workflow needs its enumeration edit in `ci-runner-security.test.ts`; the orchestrator App token cannot merge a
  workflow PR, so plan the merge identity before opening it. `heavy.yml` is called at `@main`
  (`check.yml` pins it), so any heavy-lane input change is two PRs; MEAS-06 avoids `heavy.yml` entirely.
- **Overlaps, not claimed:** shard-layout upkeep in the lane-timings census (`plannedBy`, `shardLayouts`) is
  `goals/ci-lane-economics`, edited with each partition change (#3007, #3030); merge `main` before touching
  `LaneTimings.ts`. The time-to-certainty M1 metric and its frozen fixtures stay untouched (paused goal, D13);
  this goal only keeps `gate-order-handoff.test.ts` green. The GitHub reserve signal is
  `goals/github-budget-ledger`; PR snapshots are `goals/github-state-worker`. `goals/verification-route` is
  completed; ROUT-05 extends its corpus under v1 without changing its replay semantics.
- **Reviewer constraints (MAP.md, CodeRabbit on #3017):** none targets this goal's levers; they bind HOST-09,
  PERIL-01 and PERIH-04 in `hosted-setup-tax` and PERIH-01 in `heavy-pool-diet`. The one consequence here: when
  the Fallow fold lands as a check run inside Labs, the scorecard keeps reading mergeable contexts as check
  runs by name, so the row survives the fold.
- **Inherited risks:** every Test Unit figure in the plan predates #3007's steady state; the ~60 concurrent
  hosted job ceiling is documented, not measured, and the scorecard does not claim it; fleet and T3 figures
  are censored until retention lands. Baselines are re-measured after #3028, #3029, #3030, #3040, #3043 and #3046 and reported beside the stated
  acceptance baselines, which stay as written.
- `@beep/repo-cli` tests must pass on Node and Bun. At most three open PRs in this packet.

## Acceptance Criteria

- [x] The certainty command reproduces the committed fixture corpus (decisions `in-repo-fixture-corpus`,
      `fixture-corpus-real-captures`; slice 1, `packages/tooling/tool/cli/test/ci-certainty.test.ts`): 4 of
      30 under 10 min, green-only p95 101.9, about 315 runner-min per run, and the named per-head cases. A
      monotonicity fixture shows that turning a green head red never lowers the SLO statistic, and an
      api-partial census refuses certification.
- [ ] lane-timings reads jobs per attempt: the run 42646019844 read returns 180 jobs without a 502 failure,
      union parity holds on run 42655574858, and a partial read carries the preview stamp on both renderers.
- [ ] **7 consecutive nightly reports** uploaded by the nightly workflow on main, each certified (no
      api-partial certification), each with its runner-minute and request cost, recorded under `history/`
      with run ids and aggregates only.
- [ ] Each report shows push to Yeet-mergeable beside push to every required green, the code and docs classes
      apart, superseded-head share, the main verdict rate, and every row in "Numbers the scorecard reports".
- [ ] Each report carries a "Not covered" section naming at least: Vercel deployment statuses; per-task
      hosted Turbo durations; the hosted concurrent-job ceiling (no admin read); agent seats as admission
      demand; fleet hosts or T3 lanes not yet read; local figures censored before retention; Test Integration
      partition setup versus body and its 1,395-1,551 s outlier legs; Property Laws nightly verdicts
      (`.github/workflows/property-laws-nightly.yml`); runs the compute-profile refusal routed to hosted.
- [ ] **Partition jobs fully mapped:** on a post-#3043/#3046 reference run (20 Test Integration partitions, 24 Test Unit
      jobs, Test Plan, four Property Laws slices since #3056) every job maps to a lane or an
      explicit non-lane class (conservation test: mapped plus unknown minutes equal total), the old receipt
      reproduces 242 skipped and 0 skippedReds, and the MEAS-05 ledger maps at least 95% of job-minutes on its
      three reference runs with no umbrella double count.
- [ ] **Fleet journals retained across retirement:** the PERIL-11 retire fixture passes (each (runId,
      attemptId) exactly once, a copy failure blocks deletion), `yeet economics --fleet` counts T3 lanes through
      the `roots.json` row, and fleet-host journals are read read-only.
- [ ] Refusal attribution: `actionableLaneMix` totals equal `redAttempts`, preflight first-reds drop from
      about 181 toward about 3 real failures on the recorded journal set, and terminations report apart from
      reds (321 toward about 243) with the denominator change recorded.
- [ ] Final-check attempts appear in economics (p50 6.3, p95 50 min at baseline); admission rows past the
      200-row ring are archived and folded; unit-results timings exist for every executed package.
- [ ] No raw journal, admission row, home path, session or machine id appears in any committed file.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/certainty-scorecard/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/certainty-scorecard/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/certainty-scorecard` | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Lane timings, route census and corpus (Node) | `bunx vitest run packages/tooling/tool/cli/test/ci-lane-timings.test.ts packages/tooling/tool/cli/test/ci-route-census.test.ts packages/tooling/tool/cli/test/ci-route-corpus.test.ts` plus the new certainty test | Passes |
| Economics, final-check, residue, scheduler (Node) | `bunx vitest run packages/tooling/tool/cli/test/yeet-economics.test.ts packages/tooling/tool/cli/test/gate-order-handoff.test.ts packages/tooling/tool/cli/test/yeet-final-check.test.ts packages/tooling/tool/cli/test/residue-reap.test.ts packages/tooling/tool/cli/test/quality-scheduler.test.ts` | Passes |
| Same suites (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-lane-timings.test.ts test/yeet-economics.test.ts test/residue-reap.test.ts` plus the new certainty test | Passes |
| Workflow security enumeration | `bunx vitest run packages/tooling/tool/cli/test/ci-runner-security.test.ts` | Passes with the nightly listed |
| Workflow lint | `bun run beep ci workflow-lint` | Passes |
| Ruleset snapshot | `bun run beep ci ruleset` | No drift, or the digest change is recorded per head |
| Economics report | `bun run beep yeet economics --fleet --json` | Decodes; T3 and retained journals counted |
| Nightly evidence | `history/` note with 7 consecutive certified report run ids | Present |
| Decision log | `bun run beep goals decisions check --slug certainty-scorecard` | No drift |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |
| Final | `bun run beep yeet final-check` | Passes on the pushed head |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- The nightly cannot fit its read budget after checkpointing and resume, three nights running: report the
  measured request count instead of widening the token or adding an identity (an identity is
  `goals/yeet-monitor-app-identity`'s call).
- A fleet-host read would need a new credential or a write on the host: stop that read and report it; the
  existing SSH routes are the only path (D18).

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add certainty-scorecard --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug certainty-scorecard`; add a `kind: decision` file there, never edit this block._

### Counted: the 15 ruleset contexts on code heads; misses count, mergeable beside, never inside, 2026-11-09

The SLO statistic counts only the 15 contexts of ruleset 10240248 (`standards/branch-protection-contexts.json`). Code heads are reported apart from docs heads. Red, held and api-partial heads count as not attained; superseded heads are censored and their runner-minute share is reported; a green-only p95 is a diagnostic, never the target. Time to Yeet-mergeable (Lint Policy, Property Laws, Coverage Regression, Fallow) is reported beside the statistic, never inside it. Rejected: including the mergeable contexts (would make Property Laws sharding and heavy-pool capacity target-critical before cheaper levers land) and green-only pooled heads (gameable by turning slow passes red; pooled docs heads at p95 about 4 min flatter the number). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D5).

Reverse: Supersede with a decision that widens the context set or pools heads, and recompute every published scorecard under the new rule.

### Report coverage-verdict p95: the number that reopens Coverage Regression as a required context, 2026-11-09

Heavy / Coverage Regression stays non-required and keeps gating Yeet mergeable. The scorecard reports push-to-coverage-verdict p95 per code head (measured p50 29 min when the plan was written) as its own row, because the gated candidate "Coverage Regression as a required context" reopens only when that p95 is under 10 minutes and the fixed context name has landed. The row must handle the conditional job name (Heavy / Coverage Regression or Coverage Artifact Migration). Rejected: making it required now (a 29-minute verdict on the required path) and dropping the gate (floor regressions reach main). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D6).

Reverse: Drop the coverage-verdict row and supersede, leaving the required-context question to a new operator ruling.

### Fleet economics: retain journals on retire, T3 via one roots.json row, fleet hosts read-only, 2026-11-09

Retiring a lane exports its attempt journals outside the reaped residue root before deletion, and a copy failure blocks the deletion (PERIL-11). T3 lanes are counted through one row in the fleet `roots.json`, with no new code path. Fleet hosts are read over the existing SSH routes, read-only. Attempt rows gain optional seat and host fields, so older rows still decode. Raw journals stay out of the public repository; only aggregates are published. Rejected: local retention only (fleet p95 stays unmeasured) and leaving it as is (85% of merged branches since 10-25 have no surviving journal). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D18).

Reverse: Stop exporting journals on retire and drop the T3 row and the fleet read; the optional seat and host fields decode as absent.

### MEAS-01 fixtures are a committed corpus, not the audit's scratch files, 2026-11-09

The plan's gate for MEAS-01 replays the Opus head corpus and the Astra 60-run corpus, but neither file is tracked in this repository (`git ls-files` finds no such file at 6eb2e0588e2 or at c90929b1ff1). Slice 1 therefore commits a small recorded fixture corpus under the CLI's test fixtures: the named heads (eb295434 with two producers, facc14a6 with three attempts, a docs-only head, a cancelled head) and a frozen run set whose expected counts reproduce the recorded figures (4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run). Rejected: depending on session scratch files (not reviewable, lost on cleanup). Source: lever status check in this packet, `research/SOURCES.md` section 1.

Reverse: Point the parity test at an external corpus path and record where it lives; the committed fixtures can then be deleted.

### No lever landed before graduation; #3007 and #3030 census changes stay with ci-lane-economics, 2026-11-09

Checked at 6eb2e0588e2 and re-checked at c90929b1ff1 (after #3040, #3043 and #3046: #3043 added the two-worker Test Unit layout to the census, #3040 changed worker flags and #3046 job order, and none touched the jobs read): all eleven levers are open except MEAS-03, which is partly landed (economics already prints a terminations census, but terminated attempts still count as red). #3007 and #3030 changed `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` only to teach the census new shard layouts and planned shard subsets; the jobs read is still `filter=all` (LaneTimings.ts:1059), so MEAS-04 stays open. Shard-layout upkeep in the census belongs to `goals/ci-lane-economics`, which edits it with every partition change; this goal does not claim it. Rejected: crediting MEAS-04 as partly landed (the 502 exposure it fixes is unchanged). Source: lever status table in this packet's `SPEC.md`.

Reverse: Mark a lever landed by a superseding decision that names its commit; the goal then keeps only its scorecard measurement.

### Sequencing: measurement goes first, at most three open PRs in this packet, 2026-11-09

This goal has no upstream dependency and goes first: the other five goals read their acceptance numbers from the scorecard, the MEAS-02 attribution fix precedes any WaveOrder re-seed, and the ROUT-05 partition mapping precedes any census, ledger or route refinement replay. MEAS-01 slice 1 (CLI only) is one of the three PRs ready to open at graduation. The packet keeps at most three concurrently open PRs. Rejected: first three PRs only (no owner for the rest) and scorecard plus soundness only (defers the compute and local work the audit was asked for). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19).

Reverse: Let a sibling goal start against the exploration's baselines and record which of its claims stay unverified until the scorecard lands.

### SCHE-09 admission history retention is owned here; local-proof-under-ten consumes it, 2026-11-09

The plan's candidate list put SCHE-09 (retain admission history beyond the 200-row ring, with pressure fields) under local-proof-under-ten while MAP.md row 1 listed it here; exploration ruling D23 gives it one owner, this goal, because retention of admission history is measurement; local-proof-under-ten reads the retained history as the before/after evidence for its scheduler levers (SCHE-08, SCHE-07, SCHE-01/02) and does not implement it. The ring is `RETAINED_ADMISSIONS = 200` in `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` today. Rejected (this author's addition, not part of D23): owning it in local-proof-under-ten, where the scheduler goal would grade itself on history it also writes. Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D23), recorded in the `explorations/ten-minute-certainty/MAP.md` candidate-table amendment (row 1).

Reverse: Move SCHE-09 to local-proof-under-ten by a superseding decision in both packets; the retained rows keep their schema.

### REST budget: the nightly and corpus capture are background readers under github-budget-ledger's reserve, 2026-11-09

The nightly scorecard and the route corpus capture share GitHub read budget with readiness monitors and lane-timings. This goal adds no budget rule of its own: a local run (corpus capture, an ad-hoc certainty or lane-timings census) is a background reader and obeys the 15% per identity x resource reserve signal that `goals/github-budget-ledger` publishes, and records its own request count. The hosted nightly reads with the workflow's GITHUB_TOKEN, re-polls main SHAs only inside the 7-day late-arrival horizon, and checkpoints and resumes instead of certifying a partial read. Rejected: a second threshold defined here (D27: two packets claiming one read path would produce two budgets), and no budgeting (D16: census aborts recur). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D16 as amended by D27).

Reverse: Supersede once github-budget-ledger changes its reserve signal or a dedicated identity takes these reads; no scorecard-side threshold to remove.

### Target: p95 push to every required context green on PR runs, beside runner-minutes per run, 2026-11-09

The scorecard's headline is the p95 time from a push to every required context green on pull-request runs, reported beside total runner-minutes per run; latency and compute are separate objectives and are never summed. It also reports whether every main commit got a hosted verdict, and local `yeet verify` and `yeet publish` p95. Rejected: a per-job wall target (the #3007 layout lowered the slowest Unit job from 1,108 to 650 s while raising Unit job-minutes from 151 to 202), and push to mergeable as the target (it would require changing the review window). Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D2).

Reverse: Supersede with a decision that names a different statistic, and re-baseline the scorecard history under it.

### The committed MEAS-01 corpus is two real captures; the recorded 30-run membership is not recoverable, 2026-11-10

Decision `in-repo-fixture-corpus` asked for a committed corpus reproducing the recorded figures (4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run). The exploration never recorded which 30 runs Astra used, so slice 1 commits two real captures of `beep ci certainty --write-corpus` instead, slimmed to the fields the fold reads and with branch names replaced by `<label>-branch-NN` (D18): `baseline-2026-11-09.json` (T0 2026-11-09 12:00-18:00Z, 64 GitHub reads) and `planned-2026-11-10.json` (01:00-04:00Z on 2026-11-10, after #3030, for the admission-to-Heavy and Test Unit selection rows). Of the three recorded anchors the baseline reproduces one: green-only p95 101.9 min (facc14a6, three attempts). The other two are not reproduced, because their 30-run membership is unrecoverable. "4 of 30 under 10 min" counted runs on the code statistic, and the fixture has 1 code head under ten minutes; its three docs heads under ten are their own class and are never added to the code count. "About 315 runner-min per run" matches one head, 9f30182f, at 40.2 min to every required green on 315.3 runner-min (the plan's spot check of run 42637312401), not the per-run mean. The baseline also carries every named per-head case (eb295434 two producers, facc14a6 three attempts, docs-only b85ee265, cancelled 9294d40e, and ecc04921 cancelled in the same second as its successor). Its own figures, stated beside the recorded ones and not substituted for them, as re-derived after the 2026-11-13 scoring fixes (decision `certainty-scoring-fixes`): the SLO statistic is p50 63.35 min with p95 not attained (6 misses of 17 counted code heads, 14 superseded censored, f6c4a648 and ecc04921 having traded places), and runner-minutes per head attempt (one check.yml run, all of its run_attempts, with its admitted heavy-admit.yml runs; facc14a6's three attempts above are run_attempts of one such run) average 251.08 over 35 head attempts. Slice 1 also reported 6 of 17 with 14 superseded, but over different heads, and 219.7 over 40 producer runs; those came from the scoring defects that decision fixes. The fixtures are excluded from Biome like the other large replay corpora.

Lane claude/jovial-sammet-084b0a

Reverse: Replace the two fixtures with a corpus whose membership reproduces the Astra 30-run figures exactly, if that corpus is recovered, and restate the replay assertions.

### P0 re-check at a0c7f356af3: four Property Laws slices, shifted check.yml lines, MEAS-01 slice 1 and MEAS-04 window reads land in slice 1, 2026-11-10

Re-checked every lever row, the job-name constraint and every cited file:line against a0c7f356af3 before writing code. Drift since c90929b1ff1: #3056 split Property Laws into four slices created with the test shards, so the slice job is `check.yml:1435` (was 1426) and the aggregate `check.yml:1549` (was 1538), and the partition-mapping acceptance names four slices, not two. Every other citation holds: `Heavy Admission` 87, `Test Plan` 732, `Test Unit (<partition>)` 821, `Test Unit` 978, `Test Integration (<partition>)` 1010, the conditional integration aggregate 1133, the conditional coverage name 1160, the failure-only unit-results upload 924-934; `RouteCensus.ts:168`, `CiLane.ts:477`, `Economics.ts:1013/1154/1399`, `ResidueReap.ts:1776`, `AdmissionJournal.ts:59`. #3041 touched none of them. Slice 1 changes two rows: MEAS-01 has its CLI (`beep ci certainty`, nightly still open) and MEAS-04 is partly landed (the window census and the certainty reader read jobs per attempt and stamp partial reads; the recent mode still reads `filter=all`, now `LaneTimings.ts:1131`, and has no filters yet). The reserve signal of `github-budget-ledger` has not landed (#3068 open), so the certainty reads are counted and bounded by `--max-requests` and run by hand, as decision `shared-rest-budget` says; no budget rule is added.

Lane claude/jovial-sammet-084b0a

Reverse: Revert the SPEC lever, job-name and acceptance edits to the c90929b1ff1 wording; the citations then point at the pre-#3056 lines again.

### Per-attempt job reads fall back to 30-job pages before a run is stamped partial, 2026-11-10

Live probes on 2026-11-10: run 42646019844 returned all 180 jobs as three per-attempt reads of 60 after transient 502s the retries absorbed, and the per-attempt union of Heavy Admit 42655574858 equals its `filter=all` listing (22 of 22 `(id, run_attempt)` tuples). Run 42669948388's attempts 2 and 3 still returned 502 on every one of five 100-job reads, while the same attempts read cleanly at `per_page=30` and 50. The reader therefore retries an exhausted attempt once in pages of 30 and only then records a partial read. A partial read is never dropped: the window census refuses it without `--preview` and stamps it with the existing preview banner (new guard reason `partial-read`), and the certainty report marks the head api-partial and refuses certification. Rerun attempts list their unchanged jobs again with the original timestamps; runner-minute sums de-duplicate those copies by (name, started_at, completed_at) within the run.

Lane claude/jovial-sammet-084b0a

Reverse: Drop the 30-job retry in collectCiWorkflowRunAttemptJobs; exhausted 100-job pages then stamp the attempt partial directly.

### Hosted jobs are attributed as lane, support or unknown, and the census conserves their time, 2026-11-12

ROUT-05 slice 1 fixes the join `RouteCensus.ts` used: a `Test Integration (<partition>)` job stripped to `Test Integration`, which is no lane context, so the 20 partition jobs and their minutes fell out of every census and replay. `jobNameToLane` now joins, in order: the lane context name; an earlier or conditional context name (`Build` before Heavy, until 2026-09-09; `Coverage Artifact Migration`; `Test Integration Partitions`); then a partition family (`<context> (<partition>)`, plus `Test Integration` for the `Heavy / Test Integration` lane), only for names that carry a partition suffix. Every job is then classed by the new `RouteJobClass` literal: `lane`, `support` (Change Profile, Heavy Admission and its `Heavy` call placeholder, Test Plan, PR Size Label and the four heavy.yml producer-pilot jobs) or `unknown`. Test Plan is support, not a lane job: it selects the Test Unit and Test Integration partitions at once, so charging it to one lane would misstate that lane. The census gains `jobMinutes` (`RouteJobMinutes`): lane, support and unknown jobs and milliseconds that sum to the totals, with each unknown name listed once. On Check run 43322847791 (2026-11-12, attempt 1, 80 jobs, committed as `test/fixtures/ci-route/census/partition-runs-2026-11-12.json`) every job maps: 72 lane jobs (21 test-integration, 25 test-unit, 5 property, 3 lint) and 8 support jobs, 0 unknown. On the 2026-09-01..10-30 corpus the names still unknown are retired lanes (`Knip`, `Shadcn Lint`, `Heavy / Effect Diagnostics`) and one unexpanded matrix name; they are reported, not mapped. The names newly joined there (`Build`, `Coverage Artifact Migration`) carry no pull-request red on a lane the footprint record can skip (`build`, `check`), so the replay totals cannot move. Per-step classes and per-task outcomes (aggregator and setup reds as unknown) stay in slice 2 (PLAN slice 11).

Lane fix/rout-05-partition-map

Reverse: Drop RouteJobAttribution, RouteJobMinutes and the alias tables in RouteCensus.ts; jobNameToLane then joins on context names and partition suffixes alone.

### Slice 1 merged with two coverage rows red; #3121 fixed them, 2026-11-12

#3118 (slice 1) merged as 8390750a8e3 with Heavy / Coverage Regression red on two rows it introduced: `LaneTimings.ts` branches at 99.4% against a 100% baseline (the `partial-read` reason folded into the preview verdict was never exercised) and `Certainty.ts`, a new file with no baseline row, at 75-81%. Main run 43310132188 on 5e9ee8341bd showed both. #3121 (3e2e0acaed8) fixed them with tests only: `test/ci-certainty-reader.test.ts` drives the live reader through a scripted GitHub transport and git, and a `--window --preview` lane-timings run covers the partial-read banner; scoped coverage then read 100% on all four `Certainty.ts` measures and on `LaneTimings.ts` branches, with no source or baseline change. The yeet inbox row for that red was acknowledged against 3e2e0acaed8. The other rows in that run belonged to other PRs.

Lane fix/rout-05-partition-map

Reverse: None needed: this records history. Delete the file if the attribution proves wrong.

### PERIL-11 slice 1: removals file attempt journals in the workstation store, 2026-11-13

Every removal through the worktree removal service (`yeet sweep --retire`, `worktree remove` with or without `--archive`, `worktree reap`) now files the checkout's `.beep/yeet/runs/<runId>/attempts.ndjson` journals under `<yeet state>/attempts/<host__owner__name>/runs/<runId>/attempts.ndjson` before it deletes anything, through the `AttemptJournalStore` service in `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournalStore.ts`. The yeet state root is `BEEP_YEET_STATE_ROOT`, else `$XDG_STATE_HOME/beep/yeet`, else `~/.local/state/beep/yeet` (the PR session registry's root), which residue-reap never cleans. The partition key is the GitHub repository named by the `origin` of the clone the checkout's own git metadata points to (`readCheckoutClone`, moved from `Economics.ts` into `FleetRoots.ts`), the key the session ledger and the fleet roots use, so a fenced or nested checkout still files under its own repository. The store location is resolved and validated once, against the checkout at its original path and before anything is renamed (as the residue root is), and the export writes only to that validated location: a store under the lane, lexically or through a symbolic link, dangling ones included, is refused while there is nothing to restore, so writing the store can never recreate a vacated lane path. In an archive retirement the export then runs inside the fence, after the head authority check and before any capture, so a failed export leaves the fenced copy as it was and the existing restore puts the lane back whole.

- Format: the checkout's own run layout and rows, byte for byte, so economics reads the store with the reader it uses for a live checkout. Each export appends, in one write that starts with a newline (the SCHE-09 archive rule), only the rows the stored journal does not already hold, so a repeated export, or a restored lane's grown journal, stores each row once.
- Failure on removal: an unreadable runs directory, a journal the no-follow guard cannot inspect or that cannot be read, git metadata (`.git`, the clone's `.git/config`) that exists but cannot be read, an unresolvable or relative state root, a store that would lie inside the checkout, or a store directory or file that cannot be created, read or appended refuses the removal with preservation step `export-attempt-journals` and deletes nothing. The driver's brief asked that a copy failure not block the retire; SPEC D18, the PERIL-11 lever gate and the acceptance criterion say a copy failure blocks deletion, and the SPEC won (driver ruling on #3263). A runs path that is missing or crosses a file holds no journal and exports nothing; a symlinked run directory or journal and a stray file under `runs/` are skipped, as economics skips them. A clone whose origin names no GitHub repository has no partition and no fleet reader; a removal reports its journals `unpartitioned` and proceeds.
- Residue-reap: the driver asked for an export before the janitor moves a merged lane's `.beep/yeet` into `.beep/residue-reap/<run>/archive/`, a move the first draft of this decision claimed; the move does not happen. The checkout classes have scoped the `yeet` entry to `.beep/yeet/jobs/*` since they were introduced (#1580, 2026-10-09; before that no checkout class existed), so `.beep/yeet/runs` is never a candidate and no archive entry can hold an attempt journal. On this workstation the one `.beep/residue-reap` directory (the primary clone) holds 3 runs, 0 archive entries and 0 journals, so there is nothing to import and nothing unrecoverable. The janitor path that does delete journals is a directory removal: every class assessed by the directory census (`codex-worktrees`, `beep-cache-disposable`, directory entries of `turbo-cache`) and `merged-preview` delete whole directories, embedded checkouts included. The census that authorizes such a removal now records the checkouts it found on the candidate (`embeddedCheckouts`, the set its clean-tree gate already checks; a census that meets a symlink or its budget is incomplete and never authorizes a removal), and before the removal the reaper files their journals, or a merged preview's own, with the same append-only rule. The SPEC is silent on the janitor, so an export that fails, or that finds journals with no store partition, keeps the directory with skip reason `journal-export-failed` and a warning: the janitor never loses data to make progress. Today 21 Codex worktrees hold 2 journals, and both carry symlinks the census refuses, so neither is removable yet.
- Visibility: `WorktreeRemovalReceipt.attemptJournals` (an optional key, absent when the checkout held no journal) and one summary line in the `worktree remove` and `yeet sweep --retire` output; residue-reap reports a failed export as the candidate's skip reason and a warning.
- Economics: `yeet economics --fleet` also reads the partition for the clone's repository, as checkout `(retained)`. Rows of a retained attempt that a live journal of the same run also holds are dropped before the fold and counted in `duplicateStartedRowsDeduplicated` and `duplicateFinishedRowsDeduplicated` (the A1 loader's live-overwrites rule), so each (runId, attemptId) is counted once.
- Admission gate: `packages/tooling/tool/cli/test/yeet-attempt-journal-store.test.ts` retires a scratch lane with a file planted where the store belongs (refused; lane, journal, material and branch kept), retires it, restores it from the archive ref with its old rows and one new attempt, retires it again (only the new attempt's rows appended), runs residue-reap with `maxAgeDays: 0`, and checks after every step that the fleet census holds each (runId, attemptId) exactly once. Both orders hold: residue-reap first (a merged lane's `checkout-jobs` archive moves only `.beep/yeet/jobs/*`, then the retirement files the journal once) and retire first. A Codex worktree removal is refused with `journal-export-failed` under a planted copy failure, then files the journal and removes the directory, while a Codex worktree whose census meets a symlink is never removed; a Codex worktree of a clone with no GitHub origin is kept; a Turbo cache directory holding a checkout files its journal before removal. Store unit cases cover an uninspectable journal, an unreadable `.git/config`, and relative and in-checkout state roots.
- Size: the workstation's 371 live journals total 8.9 MB (p50 13 KB, p95 73 KB, max 206 KB), so the store has no prune in this slice. A prune would censor the fleet census the store exists to complete; once the store passes 256 MB (about 10,000 journals at the measured mean), a prune needs its own decision.

Rejected: copying `.beep/yeet` into the archive's `beep-material` (the residue root is a cache, and a restore would move the journals back into a live lane); SCHE-09 day segments (terminal rows carry no run id, so a segment loses the run a terminal row belongs to, and economics folds per run journal); exporting only on archive retirement (a plain `worktree remove` deletes the same journals); counting a live-and-retained attempt from the retained copy (a restored lane's live journal can hold a newer terminal row); an export hook on residue-reap archive moves (they never carry journals; the admission test pins that the `yeet` entry yields only `jobs/*` candidates).

Not in this slice: the T3 `roots.json` row and the monitor-time split (slice 8), host and seat fields and read-only fleet-host reads (slice 9).

Lane fix/certainty-peril-11-journal-export

Reverse: Revert the slice-7 PR: removals and residue-reap stop exporting and economics stops reading the store; delete <yeet state>/attempts by hand if the retained journals are not wanted.

### The certainty nightly scores one whole UTC day on main's code and fails red when the report is not certified, 2026-11-13

PLAN slice 4 (MEAS-01 slice 2) adds `.github/workflows/certainty-nightly.yml`, whose one job is `Certainty Nightly Report`.

- **Window.** A run scores one whole UTC day, `[D 00:00Z, D+1 00:00Z)`. With no `day` input (every scheduled run, and a dispatch that names none), D is the UTC day before the run's own `created_at`, read from the run's own REST record with the job's `actions: read`. A GitHub re-run keeps that `created_at`: run 43374964920's attempt 2 reads 05:53:32Z at the run's record and 06:24:33Z at attempt 2's record, while `run_started_at` moved to 06:24:31Z. So re-running a night days later still scores that night's day. Computing "yesterday" from the re-run's clock would have scored D+1 twice and left D unscored (beep-reviewer thread on #3266). If the run record cannot be read or its `created_at` is malformed, the night is refused before any other read. A dispatch may instead name the day through the `day` input; the format and not-yet-ended checks apply either way. The scheduled cron is `41 4 * * *`. Whole UTC days tile the calendar, so seven consecutive nights are seven consecutive days with no overlap. A rolling "24 hours before now" window would drift, because GitHub starts scheduled runs late: the `knowledge-baseline-mint.yml` cron `17 6 * * 1` started at 16:26Z on 2026-11-09. Heads pushed late on the scored day have at least 4 h 41 min to finish before the capture.
- **Code and token.** The job runs only when `github.ref` is the default branch, so it scores with main's CLI, #3229's census and every later fix included. It checks out full history without blobs (the capture reads first-parent history and tree-only diffs), installs with the `.github/actions/setup-bun/action.yml` action and `bun install --frozen-lockfile --ignore-scripts` (the `rerun-runner-loss.yml` pattern for GitHub-API commands) and passes `--main-ref HEAD`. Permissions are `actions: read` and `contents: read`, no secret is read, and there is no `pull_request` trigger.
- **Budget.** A free `/rate_limit` read gives the token's core bucket. The request bound is its remaining reads less `ceil(0.15 × limit)`, github-budget-ledger's background reserve, capped at the CLI default of 1,500; a bucket already inside the reserve refuses the night before any read. One day costs 83 GitHub reads: the 2026-11-12 window, run locally through the workflow's own plan, score and summary scripts at 3cc15874ec2, captured 43 heads in 99 s and was certified (SLO n 32 with 14 misses, p50 23.3 min, p95 not attained; main verdict rate 8 of 17). That day predates both baseline breaks, so it measures cost only and is no baseline. The hosted runner-minutes are not measured yet. An estimate from existing hosted steps (a full-history checkout of 72 s in `knowledge-baseline-mint.yml`, Bun and a script-free install of 19 s in `rerun-runner-loss.yml`) plus the capture puts one night at about 4 billed minutes, inside the plan's 3 to 6; the first dispatched run replaces the estimate with a measurement.
- **Failure.** The CLI exits non-zero on an uncertified report (`api-partial` or `empty-population`), and the score step also rejects any `report.json` whose `certified` is not true. The run turns red with an error annotation naming the refusal, and the job summary keeps the CLI's refusal stamp. A capture that fails before scoring is red with its own annotation.
- **What is published.** The artifact `certainty-report-<day>-attempt-<n>` holds `report.json` (heads by SHA, no branch names) and `summary.md`, kept 90 days, this repository's maximum. The summary is the new `--summary-out` rendering (`renderCiCertaintySummaryMarkdown`): the full report with its per-head table replaced by a count, so the public job summary carries aggregates and run ids only. The corpus is never written, because its runs name branches.
- **Durable record.** The workflow never pushes. After each night the driver copies the run's `summary.md` to `history/certainty-nightly/<day>.md` and adds a row to `history/certainty-nightly.md` with the run id, the job's runner-minutes and the request count; the procedure is in that file.
- **Counting.** A day counts toward P2's seven when a run on main for that day concluded `success` and its `report.json` is certified. A re-run of the same day may stand in for a scheduled night that was dropped or refused: the CLI has no checkpoint, so re-running the day is the resume path. The re-run is either a new dispatch with `-f day=<day>` or a GitHub re-run of the refused run (which scores the same day, see Window), and the history row for that day must say it was a re-run and give the run id and attempt number that counted (coordinator ruling on #3266). The first countable day is 2026-11-14, the first whole UTC day after both baseline breaks (d8326d55935 at 2026-11-13T05:44Z, 3e822c71c5 at 2026-11-13T10:11Z).
- **First run.** Once the operator has merged this PR, the driver dispatches `gh workflow run certainty-nightly.yml --ref main -f day=<yesterday>` and records that run's id, job minutes and request count as the first row of `history/certainty-nightly.md`. It counts toward the seven only if its day is 2026-11-14 or later.
- **Late main verdicts.** Main SHAs are read once, by the night that scores their day. A main verdict that lands after that night's capture (04:41Z or later, when GitHub starts the schedule late) is picked up only by a re-run of that day; nothing re-polls the SHAs inside the SPEC's 7-day late-arrival horizon. Until one is re-run, such a commit reads `open` (or `no-run`) and lowers that night's main verdict rate. PLAN.md's execution notes say what would trigger building the re-poll.
- **Cache baseline.** Not re-recorded. `bun run beep cache audit` reports 0 blocking findings. Its one review finding, `configuration-source-drift: turbo.json`, comes from #3249, which changed turbo.json after #3242's re-record. Workflow files are not Turbo inputs (the `turbo.json` global inputs name no `.github/` path) and this job runs no Turbo task, so a re-record would change nothing this PR owns. The packet rule (SPEC "Workflow PRs", and hosted-setup-tax's "global input") is for workflow edits that move cache inputs; earlier workflow additions such as #3045 (`vercel-deploy.yml`) did not re-record either.
- **Merge identity.** The orchestrator App token cannot merge a workflow change, so the operator merges this PR by hand.

Rejected: committing each night from the workflow (a write token on a scheduled job, and pushes to main); the full Markdown report as the job summary (per-head rows on a public page); `--preview` plus a jq check (the certification rule would be restated in YAML instead of read from the CLI).

Lane ci/certainty-nightly-workflow

Reverse: Delete .github/workflows/certainty-nightly.yml and the --summary-out flag with renderCiCertaintySummaryMarkdown; nights already recorded under history/ stay as evidence.

### Certainty scoring fixes: verdict-instant supersession, heavy-pool admission, head-attempt runner-minutes, 2026-11-13

A post-merge review of #3118 found three scoring defects in `Certainty.ts`; all three change reported numbers that sibling goals read.

1. Supersession. A non-green head was censored when the next push started before its last job of any kind finished, so a red head with a slow non-required job was censored rather than counted as a miss. That broke D5, and flipping a counted green head red could lower p95: with counted values 5, 8, 30 and 40 min, the 40-minute head turned red was censored and p95 fell from 40 to 30. A non-green head is now judged against the instant its verdict was decided: the first red or cancelled required context's completion, else the latest required job's completion. Jobs outside the required set never move it. check.yml cancels in-progress pull_request runs, and that cancel completes in the same second the successor's run is created, so a cancelled head is superseded when the next push starts at or before its decided instant; a red head keeps the strict comparison, so the red flip stays monotone (review thread on #3144). On the baseline fixture, red head f6c4a648 moves from superseded to counted and cancelled head ecc04921 (cancelled at 12:43:02Z, cf49be58 created at 12:43:02Z) moves from counted to superseded: n 17, misses 6, superseded 14, and p50 stays 63.35, with a different membership. 9294d40e is the counted cancelled head with no successor. A synthetic fixture (required-green at 40, a non-required job to 55, the next push at 45) pins the flip.
2. Admission to Heavy. The row took the earliest non-skipped `Heavy / ` job of check.yml runs. Since #3030 that is mostly the hosted `Heavy / Test Integration` aggregate, which starts after every integration shard, so the row measured shard time, not heavy-pool pickup. Each producer run of a code head, check.yml or heavy-admit.yml, now pairs its own Heavy Admission start with its first executed job on the heavy pool (beep-ec2-heavy runner labels). The planned fixture p50 goes from 6.45 to 1.22 min (n 15); the baseline goes from 1.35 (n 31) to 1.32 (n 32). heavy-pool-diet's gate (p50 at least 0.5 min faster) reads this row.
3. Runner-minutes. Per-run figures counted check.yml and heavy-admit.yml runs separately, all-skipped heavy-admit runs included. The green code-run percentiles left out a label-admitted head's beep-ec2-heavy minutes, which ran in heavy-admit.yml. The population is now head attempts: each check.yml run (all of its run_attempts, so a rerun is part of the same head attempt) plus the admitted heavy-admit.yml runs of its head. A heavy-admit run joins the latest check.yml run created at or before it, and one whose Heavy Admission was skipped is dropped. Baseline: 40 runs averaging 219.7 become 35 attempts averaging 251.08, and green code p50/p95 go from 271.63/385.35 to 278.85/385.35. Planned: 45 runs averaging 97.49 become 29 attempts averaging 151.28, and green code p50/p95 go from 208.88/334.23 to 222.62/351.75. The superseded runner-minute share on the baseline goes from 0.4083 to 0.42, because ecc04921 is now superseded and f6c4a648 no longer is. hosted-setup-tax reads greenCodeRunP50 and greenCodeRunP95. main-verdict-every-commit reads the SLO counts.

Field names are unchanged (`ci-certainty-report/v1`); the schema descriptions and the Markdown labels now say "head attempts" and "heavy pool". Decision `fixture-corpus-real-captures` is restated, because two of its three anchors are not reproduced. The baseline test now asserts one code head under ten minutes instead of adding the docs heads to it.

Lane fix/certainty-scoring-fixes

Reverse: Revert the Certainty.ts changes of this PR; the report then reads terminalAt over every job, the first Heavy-prefixed job of check.yml runs, and per-producer-run minutes again.

### Final-check runs are journaled as Yeet attempts; the head receipt stays the only ready input, 2026-11-13

MEAS-07 (slice 6). `yeet final-check` now writes each run past the dirty-tree refusal to the branch's Yeet attempt journal (`.beep/yeet/runs/<runId>/attempts.ndjson`), through the row schemas Yeet runs use: `attempt-started`, then `attempt-finished` or `attempt-terminated`, with mode `final-check`. Rows go through `appendYeetAttemptJournalEventForCheckout` (new in `AttemptJournal.ts`), which uses the lock, torn-tail repair, owner reconciliation and bounded retention of the existing append primitive. The finished row's verdict has one lane per receipt step (phase = gate; a `--resume` step that reused its proof reads `reused`), outcome, `failureKind` and `failedStepId`. A red gate is `step-exit` and names the first failed step. A moved tree or a receipt that could not be written is `handler-error`. The row also carries the exact receipt the run wrote, in a new optional `finalCheckReceipt` key on `YeetAttemptFinished`; older rows decode with it absent, and readers that do not know the key strip it. An interrupt ends in `attempt-terminated` with reason `interrupted`, a defect with `unrecorded-failure`, and a killed process is closed later as `owner-dead` from the recorded owner pid and start time. A dirty-tree refusal runs no gate and is not journaled; the driver confirmed this on review, because recording those near-instant refusals would pull the final-check duration percentiles toward zero.

The per-head receipt file is overwritten by every run on that head and remains what `yeet ready` reads, unchanged. The journal is the per-run history: two runs on one head keep both receipts. The ready-gate regression fixture (`test/yeet-final-check-journal.test.ts`) flips on a passing head receipt and refuses once a later subset run overwrites it, or once the file is deleted, while the journal still holds the passing receipt. Journal writes are measurement: a write failure prints `[yeet] final-check attempt journal not written` on stderr and changes neither the run, its receipt nor its exit.

Rejected: a history file beside the receipts in `.beep/yeet/final-check/`, because the ready refresh and rewrite carries list that directory for `<head>.json` receipts. Also rejected: per-gate start and end rows under new tags, because retention keeps unknown rows forever and economics counts them as invalid. Consequences: final-check attempts share the 50-attempt retention of the branch journal with Yeet runs, and PERIL-11 (slice 7) exports them on retire. Economics needs no code change: final-check runs appear in `attempts.all.modeMix`, in the lane populations (as inner lanes) and in `firstFailure`, where a red gate's actionable lane is its final-check step and a moved tree reads `unlocated` until MEAS-03 (slice 10) types it. The comparable red-to-green modes are unchanged. No per-mode duration row is added here, so the p50 6.3 / p95 50 min baseline is not reported yet; by the driver's ruling, per-mode economics durations ride MEAS-03 (slice 10). The new test file changes the working directory, so it is declared in the isolated Vitest project (`isolatedSuites` in `packages/tooling/tool/cli/vitest.config.ts`), which the isolation census requires. The private attempt-id generator in `Handler.ts` moved to `AttemptJournal.ts` as `generateYeetAttemptId`, shared by both writers.

Lane feat/certainty-meas-07-final-check-journal

Reverse: Revert this PR: final-check stops journaling, YeetAttemptFinished loses finalCheckReceipt (rows that carry it still decode with the key stripped), and Handler.ts keeps its own attempt-id generator.

### The lane descriptors are the one job-name map; the census, scorecard and admission read job names from it, 2026-11-13

MEAS-05 slice 1 (PLAN slice 14). Before this slice five files in `packages/tooling/tool/cli/src/commands/Ci/` each spelled hosted job names: `RouteCensus.ts` (the lane-by-context table, three alias rows, the `Test Integration` partition family, nine support job names, the partition suffix and the ` / ` caller rule), `LaneTimings.ts` (the `Heavy / ` prefix, the `Test Plan` name, and the aggregator, census lane and every shard name of the three sharded lanes, about 160 literals), `Certainty.ts` (`Heavy Admission`, `Docs Policy`, `Test Plan`, the `Test Unit (` prefix, the two coverage names and the Yeet-mergeable contexts), `HeavyAdmission.ts` (the `Heavy / ` prefix and a five-lane literal of heavy.yml's lanes) and `CiGovernance.ts` (the `Heavy / ` prefix of heavy.yml contexts).

`CI_LANE_DESCRIPTORS` (`CiLane.ts`) is now the one map. `CiLaneDescriptor` gains `jobAliases` (earlier and conditional names of the reporting job: `Build`, `Coverage Artifact Migration`, `Test Integration Partitions`) and `shardFamily` (the family partition jobs report under when it is not the context name: `Test Integration`); it already carried the lane id, workflow, `contextName` and `required`. The new `CiLaneJobs.ts` derives every join from it: `ciLaneDescriptor`, `ciLaneReportingNames`, `ciLaneShardFamilies`, `ciLaneShardJobPrefix`, `ciLaneShardJobName`, the inverse joins `ciLaneOfReportingName` and `ciLaneOfShardFamily`, `isCiHeavyLane`, the support jobs (`CiSupportJobName` plus the context of each non-lane descriptor no lane claims, i.e. `PR Size Label`), `HEAVY_CONTEXT_PREFIX` (moved from `HeavyAdmission.ts`), `ciCalledJobName` and `ciCallerJobName` for `<caller> / <job>` names, and `ciShardJobNames` / `isCiShardJobNamed`, which hold the one list of jobs a shard runs through a called workflow (`Overflow`, folded in from #3256). `jobNameToLane` stays in `RouteCensus.ts` with the same three rules, now over those joins; LaneTimings keeps its layout history but lists partition ids and builds shard names, the aggregator and the census lane from the map. `prePushLaneId` and `ciLaneOfPrePushLaneId` (pre-push ids, not job names), `CI_LANE_PARTITIONS` and `RouteFootprints.ts` (keyed by lane id) are unchanged.

Conservation: `packages/tooling/tool/cli/test/fixtures/ci-lane-jobs/job-name-conservation.json` was generated on origin/main a56516d6d30 from the replaced mappers before they were deleted, over 263 job names (the 2026-09-01..10-30 route corpus, every CI fixture, two live lane-timings reads, every workflow's declared contexts, the mappers' own tables, the hosted partitions and edge probes), the 24 lanes, the scorecard's context names, and the lane-timings census rows of 130 synthetic runs (one green run per recorded layout and one per red shard). `ci-lane-jobs.test.ts` holds every lane id to exactly one descriptor and reproduces every recorded answer: 0 mismatches. The 2026-09-01..10-30 receipt replays byte for byte as before (5,083 heads, 242 skipped lane runs, 0 skipped reds, recall certain), the certainty fixture corpora and a 2026-11-12 lane-timings window render identically, and no existing test changed.

Behaviour notes: `beep ci lane --list` prints the new `jobAliases` key on every descriptor and `shardFamily` on test-integration. The census reads a run of the 2026-11-09 Test Unit layout (30 shards) against the 2026-11-10 layout (24 shards), which is a subset of it, so a red on one of the six shards only the older layout has reads green; this predates the slice and is kept as is.

Lane refactor/certainty-meas-05-lane-map

Reverse: Revert the slice-14 PR: RouteCensus, LaneTimings, Certainty, HeavyAdmission and CiGovernance get their own job-name literals back, and the conservation test and fixture go with it.

### An incomplete main push listing leaves main commits unread, and main is read before the job reads, 2026-11-13

A 7-day run, `bun run beep ci certainty --since 2026-11-03 --until 2026-11-10`, was refused as api-partial: the default 1,500-request bound ran out during the per-attempt pull-request job reads, before the check.yml push listing was read. The report then folded every main commit to `no-run`, with rate 0 and no partial marker, although the commits had push runs (fda98a2c4bd has push run 42717956683). A `--preview` reader would have taken "not read" as a main verdict rate of 0. Two changes fix this. The push listing, a few pages, is now read before the job reads, so the bound refuses a pull-request job read instead: that head is stamped api-partial, and main keeps its real verdicts. When the listing still does not complete, every main commit gets the new verdict `unread` (`CiCertaintyMainVerdict`), never `no-run`. The main stat then counts them in `unread` and reports no rate. Certification is refused as before.

Lane fix/certainty-main-unread

Reverse: Revert this PR: main commits then fold to no-run when the listing fails, and the push listing is read after the pull-request job reads again.

### PERIL-11 slice 2: T3 root in the fleet roots list; monitor waits apart from local work, 2026-11-13

PERIL-11 slice 2 (PLAN slice 8). Two parts: T3 Code lanes enter the fleet census through one roots row, and the time monitors spend waiting on hosted CI leaves local work.

T3 root. T3 Code creates its lanes as linked worktrees of the clone under `<home>/.t3/worktrees/<clone name>/<lane>`. The fleet mirror (`beep worktree fleet`) and `beep quality residue-reap --fleet` already list them through `git worktree list` (39 on this workstation), so only `yeet economics --fleet`, which reads the filesystem without git, missed them. As SPEC D18 says, the root is one row of data: `docs/runbooks/fleet-roots-and-registry.md` adds `{ "path": "<home>/.t3/worktrees/beep-effect" }` to the intended `roots.json` list and gains a "T3 Code lanes" section, with no T3 path in code. Each T3 lane passes the origin rule through its `.git` file. One code change makes the row safe: `resolveScopeRoots` in `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` now reads a checkout reachable through two roots once, keyed by real path, under the first path that reached it. Before, a symlinked alias of a root (a T3 root behind a link, say) counted every lane under it twice, because the dedupe compared path strings. A nested lane listed under its clone and again under a root at the clone's Claude Code worktrees directory was already read once, and the fixture pins both cases. Removal does not know the T3 root, and this slice leaves it that way: `worktree remove`, `yeet sweep --retire` and `worktree reap` act only on lanes in the clone's sibling `-worktrees` directory or in the worktrees Claude Code nests inside the clone, and for a T3 lane the removal service refuses in `validateRemovalRequest` before any export, fence or deletion. T3 removes its own lanes with `git worktree remove`, which deletes `.beep/yeet/runs` without filing the journals in the attempt-journal store, so a T3 lane counts only while it exists.

The workstation's own `roots.json` is not written by this PR. Writing the list moves economics from the derived root to configured mode, which admits only origin-matched checkouts. Measured on the same journals with the pre-change fold: derived, 137 checkouts, 363 journals, 2,673 attempts; the runbook list without the T3 row, 128, 340 and 2,586; with it, 142, 361 and 2,673 (14 T3 checkouts, 21 journals, 87 attempts). The 9 checkouts that leave are `beep-effect-private` (another repository, a correction) and 8 orphaned lanes whose clones (`beep-effect5` to `beep-effect8`) were deleted, which are real history. Filing those orphans' journals in the attempt-journal store first would keep them, but that is an operator-workstation step, so it is recorded here and not taken.

Monitor waits. The detached readiness monitor that `yeet open` submits writes no attempt journal (`Yeet.command.ts`: the porcelain monitor loops write no run verdict), so its hour was never in economics. Two kinds of wait were: the checks watch (`monitor:02-pr-checks-watch`, `gh pr checks --watch`) in `yeet monitor` runs and in publishes that watch inline, and the readiness loop a publish runs attached when background monitoring is unavailable (`monitor:00-until-ready-submit` labelled `monitor:until-ready:attached`). They inflated publish durations, made up 24% of wrapper-lane time and counted hosted reds as local reds. The fold now treats those lanes as monitor waits. The detached submit (labelled `monitor:until-ready:submit`) launches the job in about a second and stays local work.

- A fourth attempt class, `monitor`. A `monitor`-mode run is `monitor` (green, red check or cut-off wait) unless the monitor itself failed: a handler error, a verdict-less red or a failed non-wait lane stays red. Any other red whose failure is a step exit and whose failed lanes are all wait lanes is `monitor`, because its local work had finished. Classes still partition attempts, and `actionableLaneMix` and `receiptProxyMix` still total `redAttempts`.
- `modeDurations` measures local work: elapsed less the attempt's monitor wait, over attempts that ran to their end; rows gain `monitorAttempts`. The lane populations drop the wait lanes and divide by local work.
- New section `monitorWait`: waiting attempts, how many waits ended failed, wall p50, p95 and total, and their run modes.
- Unchanged: the M1 walk (it reads outcomes; its machine minutes still include waits, since changing them moves a baseline other goals are judged on), the M4 proxy, terminations and data quality. The open-streak split gains `rightCensoredMonitorAttempts`; red, terminated and monitor members sum to the v2 figure.

The report becomes `yeet-economics/v4`, because `red`, `green` and `terminated`, the `modeDurations` percentiles and the lane populations change meaning; the new fields are additive. Reader census: the JSON goes to stdout, and only this package's tests decode it, in the same process; `--fleet` reads raw `yeet-attempt-journal/v1` rows, not reports; the WaveOrder seed is `verification-economics/v1` and untouched. The `v3` mentions in goal packets are prose records of past runs that nothing decodes.

Before and after on identical journals (derived root, 2,673 attempts). Classes: red 1,339 to 1,109, green 952 to 916, terminated 382 to 358, monitor 290 (230 from red, 36 from green, 24 from terminated); comparable red 978 to 814, monitor 164. Failure kinds: step-exit 762 to 532. First failure: red 1,339 to 1,109, reconstructable 762 to 532, completion p50 7.04 to 6.48 min and p95 47.24 to 29.42 min; the checks-watch row (131) leaves the actionable mix and the ready-monitor row falls from 122 to 23 (the failed detached submits). Mode durations: publish p50 2.65 to 0.25 min, p95 45.19 to 30.28 min (in the raw journals, 481 of 1,125 publish verdicts ran under 15 s, and 111 of the 220 publishes that waited did under 15 s of local work); monitor p50 3.53 min to 3 s, p95 47.51 min to 9 s. Monitor waits: 333 attempts (publish 220, monitor 113), 237 ended failed, p50 5.42 min, p95 55.39 min, 76.4 h. Wrapper lanes: 315.47 to 239.06 h over 343.46 to 267.05 h of attempt time (91.85% to 89.52%); `full:01-pre-push` share 49.36% to 65.13%. Inner lanes: attempt time 79.26 to 78.03 h (91.10% to 92.54%). M1: 282 closed comparable episodes, p50 35.33 min, p95 334.63 min, unchanged; right-censored members red 445 to 333, monitor 112, terminated 200.

Admission gate: `packages/tooling/tool/cli/test/yeet-economics-fleet-roots.test.ts` (a `roots.json` row counts a T3-style lane once, from the clone and from the lane; a symlinked alias root and a nested-lane root do not double-count; a foreign lane under the T3 root is skipped; the derived root misses the lane) and `packages/tooling/tool/cli/test/yeet-economics-monitor-wait.test.ts` (fifteen hand-classified attempts with their v3 and v4 classes and reasons, the invariants, local-work durations, the monitor-wait row, the lane populations and the unchanged M1 walk).

Rejected: a T3 path derived in code (D18 asks for one data row, no new code path); excluding `monitor`-mode attempts from the report altogether (a monitor that failed by itself is a local red worth seeing); classing a publish whose attached wait reported red as green (its verdict failed, and `green` keeps meaning a success verdict); changing M1 machine minutes here; teaching the removal service the T3 root (T3 owns those lanes' lifecycle, and the fence would have to know T3's own holders).

Lane chore/certainty-peril-11-fleet-roots

Reverse: Revert the slice-8 PR: economics returns to yeet-economics/v3 (no monitor class, monitorWait or local-work durations), path-string dedupe of fleet checkouts, and the runbook list without the T3 row.

### The route replay marks recall uncertain when a skipping head has a failed unmapped job, 2026-11-13

A post-merge review of #3141 found that `beep ci route replay` judged skipped reds only through jobs that map to a lane. A failed job whose name no rule maps (class `unknown`) never entered the red set. If the build or check job were renamed, a head whose route skipped check and whose renamed check job failed would leave `skippedReds` at 0, and recall would print 1 with no marker. `RouteReplay` now carries three fields:
- `unknownRedHeads`: heads that skipped at least one lane and have a failed `unknown`-class job.
- `unknownRedJobNames`: those jobs' names, each listed once.
- `recallCertain`: false whenever the count is above zero; recall is then an upper bound, and the text output says so.

Only skipping heads count, because a head that skipped nothing cannot hide a skipped red. The same review found that two assertions in the ROUT-05 fixture test held by construction, since each attributed job has exactly one class. They are replaced by literal per-class totals re-derived from the fixture's raw timestamps (20,200,000 ms total, 240,000 ms support, 0 unknown), which is the guard. The 2026-09-01..10-30 corpus has failed jobs on retired lanes (Knip, Shadcn Lint), so its replay may now report recall as uncertain; it was not re-run here.

Lane fix/certainty-wave2-fixes

Reverse: Drop unknownRedHeads, unknownRedJobNames and recallCertain from RouteReplay; recall then ignores failed jobs no rule maps.

### SCHE-09 slice 1: trimmed admission rows go to a 30-day archive and fold back with the live journal, 2026-11-13

The admission journal keeps 200 admissions (2,400 known rows) and used to drop everything older. Now the locked rewrite in `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` first appends every row the ring trims to `<admission root>/journal-archive/<YYYY-MM-DD>.ndjson` (the UTC day of the trim), under the same journal lock and after an ownership fence, and only then publishes the trimmed journal. The ring, the live journal and its readers are unchanged.

- A copy that fails keeps the trimmed rows in the live journal (one stderr line) until a later rewrite archives them, so a trim never deletes a row it could not copy (the D18 rule that a copy failure blocks deletion).
- Each batch starts with a newline, so a torn tail left by an interrupted append stays on its own undecodable line.
- `readAdmissionJournalHistory` (schemas `AdmissionJournalArchive`, `AdmissionJournalHistory`) folds segments oldest first, then the live journal. It drops byte-identical repeats (a crash between copy and publish, or a retried rewrite) and decodes through `AdmissionJournalReader`, so v1, v2 and v3 rows decode together. Rows it cannot decode are counted, not hidden.
- `bun run beep quality scheduler history` prints aggregates: rows read, admissions, the admitted span and wait p50, p95 and max. `--json` prints every row for the scheduler levers in local-proof-under-ten. First run on the workstation, 2026-11-13: 600 live rows, 200 admissions from 2026-11-09 to 2026-11-13, wait p50 0.1 s, p95 28.4 s, max 279.1 s, no archive segment yet.
- Retention follows the PERIL-10 shape (#3139, #3199). The scheduler reap pass (each promotion tick's repair and `quality scheduler reap --apply`) deletes segments whose UTC day ended at least 30 days ago. It lists names only and never reads a segment on the admission path, and the reap dry run previews the prune with the same predicate. There is no byte cap: at roughly 160 rows a day of about 400 bytes, 30 days is about 2 MB.

Gotchas: checkouts on an older revision still trim without copying, so history is complete only once every live checkout runs this revision. The pressure fields the lever names (capacity tokens and MemAvailable at admit, PSI some10, unadmitted slice memory) are not in this slice. They add reads on the promotion path, and the scheduler record's seats disagree on whether they belong on journal rows or in unit observations (ontology run-3 ruling 9 parked journal capacity stamps). They are PLAN slice 5b.

Rejected: archiving in the reap pass alone (the trimmed rows are gone by then); one immutable file per trim (one file per admission at steady state); folding the archive into `quality scheduler status` (status stays a point-in-time snapshot).

Lane feat/certainty-sche-09-admission-archive

Reverse: Revert this PR: the ring drops trimmed rows again and quality scheduler history goes away; delete any journal-archive/ segments left under the admission root by hand.

### Slice 1 lands over two unrecoverable MEAS-01 replay anchors, 2026-11-13

The MEAS-01 admission gate names three fixture-replay anchors from the exploration: 4 of 30 under 10 min, green-only p95 101.9, and about 315 runner-min per run. The committed fixtures reproduce only the 101.9 p95. The 30-run membership behind the other two was never recorded (decision `fixture-corpus-real-captures`), so no corpus can be shown to reproduce them. Slice 1 is therefore marked landed against the anchors that can be checked: green-only p95 101.9; the named per-head cases (two producers, three run_attempts, docs-only, cancelled); the monotonicity fixtures (the baseline flip and the verdict-instant counterexample, decision `certainty-scoring-fixes`); and the api-partial refusal. The fixture's own figures are stated beside the recorded ones and never substituted for them: 1 code head under ten minutes, and 251.08 runner-min per head attempt over 35 attempts. The gate column itself is left as written, because it records the target the exploration set. The nightly's first certified week (P2) re-measures both anchors on live heads; that measurement, not the fixture, decides whether the recorded targets hold.

Lane fix/certainty-scoring-fixes · PR #3144

Reverse: Delete this file and set the MEAS-01 lever back to open until a corpus reproducing the 4-of-30 and about-315 anchors is recovered.

### Failed hosted jobs keep their steps; aggregate, setup and harness reds are charged to no lane, 2026-11-13

ROUT-05 slice 2 (PLAN slice 11). `HostedJob` gains two optional keys under `route-corpus/v1`: `steps` (each step's name and conclusion) and `tasks` (per-task outcomes, `RouteTaskOutcome`: pass, fail, not-run, unknown). An absent key decodes as `None` and encodes back to an absent key, so every v1 row decodes and re-encodes byte for byte. The capture keeps steps only on a job that concluded `failure`, the only jobs the replay judges by their steps, which keeps the committed corpus small. The step list comes with the jobs payload the capture already reads, so it costs no API call; check-run annotations (about 40k calls) are not read. No capture fills `tasks` yet: its producer is PLAN slice 11b, a `check.yml` change the operator hand-merges. Until 11b lands, `tasks` is always absent and classification rests on steps alone.

A failed job's red now has an origin (`RouteRedOrigin`), read by `hostedJobRedOrigin` in `RouteCensus.ts`:
- `task`: a recorded task failed, or the job stopped in a step of the lane's own work;
- `aggregate`: it stopped in a `Require every …` step, where an aggregate job checks its shards;
- `setup`: it stopped in GitHub's `Set up job` or a named preparation step of a lane job (checkout, fetching the base or the CI binary, the lane gate, toolchain setup, installs);
- `harness`: every recorded task passed, yet the job failed;
- `unattributed`: no steps and no tasks, which is every row captured before this slice.

The step a job stopped in is its first failed step, else its first step that never concluded or was cancelled (a timeout, a lost runner). Step classes (`RouteStepClass`) come from exact step names in check.yml and heavy.yml (`ROUTE_SETUP_STEP_NAMES`). An unlisted or renamed step counts as the lane's own work, so a name the table does not know never moves a red off its lane. A contract test in `ci-route-census.test.ts` reads check.yml and follows every job that calls a reusable workflow (heavy.yml today, any `uses` caller in general). A caller has no steps of its own and is not checked; the called workflow's jobs are, under the `<caller> / <job>` names GitHub reports. The test finds each lane job by that reported name, and fails when a listed name is no longer a step of any lane job, when a step before a lane's own work is neither setup nor declared lane work, or when a setup step follows the lane's work. It reads structure (job names, step order), not line numbers. A renamed or new setup step therefore fails the test instead of charging the lane. Composite actions are not read: GitHub lists only the step that calls one, so their inner step names never reach the jobs API. `jobNameToLane` gains one rule for such names: a `<caller> / <job>` name that joins no lane as a whole joins its caller's lane, so a shard run through a called workflow (the overflow job of #3256, `Test Unit (<partition>) / Overflow`) stays on its lane. `Heavy` joins no lane, so the heavy.yml jobs and the retired `Heavy / Effect Diagnostics` are unchanged, and no name in the committed corpora or fixtures changes its class.

`task` and `unattributed` reds are charged to the lane, so an old corpus replays exactly as before. `aggregate`, `setup` and `harness` reds are charged to no lane, on the head and on the base. They are not dropped: a skipped lane whose only head reds are uncharged, and which is not red on the base, is listed in the new `RouteReplayHead.unknownReds`. Its jobs join `unknownRedJobNames` and count in `unknownRedHeads`, so `recallCertain` turns false and the text output says recall is an upper bound. On the base, an uncharged red no longer excuses a head red: the lane is then neither green nor red there, so the head's red counts as a skipped red and the head is base-unknown (fail-closed).

Gate evidence: the 2026-09-01..10-30 receipt (sha256 e840ea6d…), copied to a scratch `--corpus` directory, replays on this branch to 5,083 heads, 242 skipped lane runs (build 121, check 121), 0 skipped reds, 0 base-unknown, 0 unresolved, recall 1, 0 unknown-red heads, recall certain (8 min 13 s). Five rows of that corpus, branch names replaced, are committed as `test/fixtures/ci-route/corpus/v1-rows-2026-09.ndjson`; they decode with no steps or tasks, their 15 failed jobs are `unattributed`, and they re-encode byte for byte.

Rejected: dropping aggregate and setup reds from recall, which would hide reds the route itself causes (an install failure on a lockfile change, a skip-satisfied aggregate that failed); classifying aggregates by job name, because before #3005 `Heavy / Test Integration` was the lane's own job; reusing `detectGithubJobShapeClass` (`internal/github/JobShape.ts`), whose install pattern does not see `Setup monorepo CI`, where check.yml lanes install, and which answers rerun policy rather than attribution; a `route-corpus/v2`, which a continuing capture would refuse on every v1 receipt.

Lane feat/certainty-rout-05-step-outcomes

Reverse: Revert this PR: every failed lane job is charged to its lane again; rows captured with steps still decode, because decoding drops keys the schema does not name.

### Terminations count apart from reds; yeet-economics/v3 restates the red denominator, 2026-11-13

MEAS-03 (slice 10). `economicsAttemptClass` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts`) classes every attempt `green`, `red` or `terminated`. A verdict decides when there is one. A verdict-less attempt (an `attempt-terminated` row) is red only when its reason names a failure of the attempt itself: `unrecorded-failure` (a defect, or a proof job that exited without a verdict) and the first A5 writer's legacy `failure`. Every other reason is a termination: `interrupted`, `signal`, `cancelled`, `timeout`, `oom-killed`, `owner-dead`, `lease-eviction`, `queued-submitter-death`, `job-start-failed`, `finalizer-missing`, `terminal-row-missing`, `legacy-unowned-start`, `stale-unverifiable-owner` and the legacy `success` (no verdict and no failure named). The reason table is an exhaustive match, so a new reason is classed where it is added.

The denominator. Before (v2), `firstFailure.redAttempts` counted every attempt that was not green: failure verdicts plus every verdict-less termination. After (v3), it counts the `red` class only. The slice-3 invariant holds under the new definition: `actionableLaneMix` and `receiptProxyMix` still total `redAttempts`, one row per red attempt. `attemptsWithoutReconstructableOuterFailure` drops by the terminations (they never had lanes), and `failureKindMix` covers reds only (its old `unknown` row was the terminations). A v2 red count is the v3 `red` plus `terminated` rows of the new `attempts.all.classMix` (also on `attempts.comparable`), so the red rate is `red` over all attempts and the old figure stays recoverable. Because existing fields changed meaning, the document is versioned `yeet-economics/v3` and a v2 document no longer decodes as one; every other change is additive.

Two actionable rows are new. `refusal:moved-tree` is a final-check handler error carrying the moved-tree sentence from `FinalCheck.ts`, classed with the other refusals before any lane; MEAS-07 left it as `unlocated`. `unrecorded` is a red with no verdict. A dirty-tree refusal is never journaled (decision `final-check-attempt-journal`), so it is neither a red nor a termination. The per-mode row MEAS-07 handed over is `modeDurations`: per run mode, attempts, red and terminated counts, and the nearest-rank elapsed p50 and p95 of its green and red attempts. A terminated attempt's elapsed time is how long it ran before it was cut off, so it is counted beside the percentiles, never inside them. Final-check runs are one row; they are reported, not gated.

Unchanged: the M1 red-to-green walk (ruling 75) still lets a termination open or extend a streak, so M1 stays comparable with the baselines other goals are judged on; M4 counts verdict-bearing reds only, as before; the A1 seed (`WaveOrder.ts`, the frozen `economics.json`) is untouched. The admission gate is `packages/tooling/tool/cli/test/yeet-economics-adjudicated.test.ts` over the committed journal `test/fixtures/yeet-economics/adjudicated-terminations.ndjson`: sixteen attempts, each with its expected class, actionable row and reason written down (a genuine red, an interrupt, a signal, a timeout, a dead owner, an unrecorded failure, a moved-tree refusal, a red gate, a green run, a red and an interrupted retry left open as an M1 streak, and five rows in shapes from before the newer fields existed, the legacy `success` and `failure` reasons among them), replayed through the live loader and fold.

Measured on the workstation fleet (aggregates only). Before, v2: 2661 attempts, 1710 red (1330 failure verdicts plus 380 terminations), `unlocated` 536. After, v3: 2658 attempts, 1330 red, 381 terminated, 947 green; `unlocated` 157, `unrecorded` 1; comparable modes 970 red and 352 terminated. Final-check: 7 runs, 4 terminated, 3 measured, p50 7.2 min, p95 12.7 min, beside the SPEC baseline of p50 6.3 and p95 50 min. The remaining `unlocated` reds are handler errors after lanes ran (publish input refusals, GitHub transport and rate-limit failures, review-thread readiness refusals). Typing them is unscheduled work, recorded as PLAN slice 10b; this slice leaves them `unlocated`.

M1 names follow the new meaning of red. The M1 walk keeps every not-green attempt in a streak, so the open-streak count v2 called `rightCensoredRedAttempts` held terminations too. v3 keeps that name for the red-class members only and adds `rightCensoredTerminatedAttempts` beside it; the rendered censoring line reads "N red and M terminated attempt(s)", and the episode labels say a streak runs from the first not-green attempt. The split was chosen over renaming the field (`rightCensoredNotGreenAttempts`): the streak count, episode spans and observed span are unchanged, the v2 figure is the sum of the two fields, and the report then has one meaning of red everywhere, the same red-plus-terminated identity as `firstFailure`. A rename would also keep M1 comparable but leave a mixed population under a new name.

Readers of the version change. No code in the repository decodes a stored or piped `yeet-economics` document: the JSON goes to stdout and only this package's tests decode it, in the same process. `--fleet` never merges per-checkout reports; it reads each checkout's raw attempt journals (`yeet-attempt-journal/v1`, whose writers this slice does not change) and folds them with the reader's own code, so a checkout still on v2 code is classed by the reader and nothing aborts or miscounts. The A1 seed that `WaveOrder.ts` reads is `verification-economics/v1`, a different schema, and is untouched. The `yeet-economics/v1` and `v2` mentions in goal and exploration packets are prose records of past runs that nothing decodes; the local-proof-under-ten P0 baseline quotes the outcome mix (failure, success, unknown), which v3 keeps unchanged.

Rejected: keeping v2 and renaming `redAttempts` (it would break the A1 field-name parity the report keeps); classing `unrecorded-failure` as a termination (the attempt failed by itself, nothing cut it off); taking terminations out of the M1 walk here (that changes a baseline other goals are judged on and needs its own ruling); timing terminated attempts inside the per-mode percentiles.

Lane fix/certainty-meas-03-terminations

Reverse: Revert the slice-10 PR: economics returns to yeet-economics/v2, terminated attempts count as reds again, and classMix, modeDurations and the moved-tree and unrecorded actionable rows go away.

### Residual handler errors are typed at the raise site and located by kind, 2026-11-14

MEAS-03 slice 2 (PLAN slice 10b). Slice 10 left 160 reds `unlocated` on the workstation fleet: handler errors that ran lanes, failed none and stepped out of no step. Slice 10b gives the classes the plan names a typed error at the raise site and a located row in `actionableLaneMix`.

The type. `YeetHandlerErrorKind` (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts`) is a closed `LiteralKit` domain: `publish-input` (publish refusing the worktree, staging or commit message it was handed), `review-threads` (merge readiness refusing outstanding review threads), `github-rate-limit` and `github-transport` (any other failed GitHub call the handler needed). It rides the existing handler error: `YeetCommandError` gains an optional `handlerErrorKind`, set where the refusal is raised (`PublishScope.ts`: nothing reviewed to publish, untracked, unstaged, partially staged, nothing staged after staging; `Handler.ts`: a missing `--message`, outstanding review threads; `Guards.ts`: commitlint). GitHub failures are typed by the class that already types them: `yeetHandlerErrorKind` reads a `GitHubError` cause by its structural `kind` (`rateLimited` is a rate limit, any other kind is transport), so no GitHub site needs editing and no message is matched. The verdict writer (`writeRunVerdict`) records the kind as the optional verdict key `handlerErrorKind` (`yeet-verdict/v2`, additive: a verdict without it encodes byte for byte as before, and older readers drop the key on decode).

The attribution. The economics fold reads the kind only after the refusal, lane and step tiers, so a red any of them located keeps its row, and before `unexecuted`, so a typed error names what failed whether or not a lane ran. The kind is the verdict's `handlerErrorKind` when this reader knows it, else the kind a handler error's message names, for rows written before the key existed: the raise sites' opening sentences, the retired review-thread sentence that said "unresolved", the retired `gh pr create failed:`, and GitHub's own rate-limit text through the monitor's existing `classifyYeetGithubRateLimit`. Refusal sentences are matched first, so a commit message that quotes rate-limit words stays a publish input refusal. A kind this reader does not know decodes as none, so the row still counts. The rows are `refusal:publish-input`, `refusal:review-threads`, `github:rate-limit` and `github:transport`. `unlocated` stays the unknown bucket under its old name, so the before and after mixes compare. Every red is still one row: the mix total equals `redAttempts`; terminations stay apart (slice 10). The report stays `yeet-economics/v4`: no field changes meaning, and new keys in an open-keyed mix are additive, as slice 3's refusal rows were.

Measured on the workstation fleet, live checkouts and the attempt-journal store, read-only (aggregates only). Every one of the 160 `unlocated` rows was read and grouped by what failed; the fixtures are hand-written rows, one or more per stratum. Before: 3052 attempts, 1201 red, `unlocated` 160. After: 133 located, `unlocated` 27; `refusal:publish-input` 57 (nothing reviewed to publish 41, unstaged 5, untracked 4, partially staged 2, missing `--message` 2, commitlint 2, nothing staged after staging 1), `refusal:review-threads` 42, `github:rate-limit` 33 (the branch pull request read 16, the retired `gh pr create` 10, the default branch read 7), `github:transport` 1 (the monitor's comment poll). Every other row of the mix is unchanged: `unexecuted` stays 52 (none of its rows matches a new class), `refusal:closeout` 100 (two closeouts carrying rate-limit text stay closeout refusals), and `redAttempts` and the mix total stay 1201. `unchangedFingerprint.byActionableLane` moves the same way.

Left in unknown, none above 5% of the 160: a pull request number decode after a full success, 8 (5.0%; a handler bug since fixed in source, where an empty monitor phase is a no-op, so no new rows arise); `git diff` output over the capture limit, 5; files the proof wrote after the commit, 4 (the proof changed the tree, not an input refusal); the published pull request ownership lease write, 3; admission state staging, 2; and five single rows (stale reuse-verified proof state, no reusable proof state, a ready open without a final-check receipt, an RSS-instrumented pre-push failure, a merge preview conflict).

The admission gate is `packages/tooling/tool/cli/test/yeet-economics-handler-errors.test.ts` over the committed journal `test/fixtures/yeet-economics/adjudicated-handler-errors.ndjson`: 24 attempts, each with the row slice 10 gave it, the row it gets now and why, replayed through the live loader and fold. It asserts each attempt's row from a one-attempt report, that an old row moved only if it was `unlocated`, that the actionable and receipt-proxy totals equal `redAttempts` (a class counted twice fails the sum), and that `unlocated` keeps 5 rows. Unit tests cover `yeetHandlerErrorKind` and the verdict key's round trip; the raise-site tests assert the kind.

Rejected: matching messages only (every sentence edit would silently move rows back to `unlocated`, while the raise site knows the kind); one new tagged error class per kind (the handler's error channel is `YeetCommandError` end to end, and splitting it widens every signature on the path for nothing the reader needs); reading the kind before the lane tiers (a row a lane or step located would move; on the live sample both placements agree); reading it after `unexecuted` (a typed refusal that ran no lane would say only that nothing ran); typing the push-only and open refusals now (they are `unexecuted`, already located, and outside the residual); a class for the pull request number decode (a fixed bug's history, at but not above the threshold); renaming `unlocated` to `unknown` (breaks the before and after comparison).

Lane fix/certainty-type-unlocated-errors

Reverse: Revert the slice-10b PR: YeetCommandError and the verdict lose handlerErrorKind (verdicts written meanwhile keep the key, which older readers drop), and the four new rows fold back into unlocated.

### SCHE-09 slice 2: admitted and released rows carry an optional capacity and host-pressure stamp behind a pressure protocol key, 2026-11-14

PLAN slice 5b. Admitted rows and v3 released rows gain one optional key, `pressure` (`AdmissionPressureStamp` in `QualityScheduler.schemas.ts`): `capacityTokens`, `activeTokens` (every live lease, the row's own included), `queuedTokens` and `queuedTickets` (the other tickets still waiting), `memAvailableGib`, `psiCpuSome10`, `psiMemorySome10` and `psiIoSome10` (the `some avg10` share of `/proc/pressure/{cpu,memory,io}`, parsed with the host-pressure parcel's `parsePressureFile`), and `unadmittedSliceGib` (`agent-runs.slice` `memory.current` minus the `memory.current` of each live lease owner's cgroup in the slice). The three PSI fields and the slice field are optional and left out when the host cannot give them. `unadmittedSliceGib` is a number only when the writer runs inside the slice and every lease owner's cgroup membership and every cgroup's `memory.current` read; a lease whose owner exited between the scan and the read makes it absent, so it is never a sum over only some of the leases. A readable membership outside the slice is left out of the sum, as before. The PLAN row names capacity and host pressure; the slice 5 decision (`sche-09-admission-archive`) lists the lever's fields as capacity tokens, MemAvailable, PSI some10 and unadmitted slice memory, so every one of them is stamped.

The facts live on the journal rows, not in unit observations. No unit-observation schema or store exists (SCHE-08 shipped `unit`, `weightSource` and `owner`, not observations), and a separate observation log would mean a second write per transition, a second reader and a join by nonce, where the rows already carry the nonce, pid, attempt and unit. Ontology run-3 ruling 9 parked journal capacity stamps because they fed a re-parked family; SCHE-01, SCHE-02, SCHE-04 and SCHE-07 now read them, and the reopen evidence (40.2 of 97.6 long-wait minutes with one 3-token lease held) cannot be attributed without capacity at admit. The stamp therefore reopens ruling 9 behind its own gate, which stays off until someone turns it on.

How each writer stamps:
- The admitted row has one writer, `promotionAdmissionEvent`, which copies the promotion transition's stamp. `stageSelfLease` reads the protocol's `pressure` gate and, when it is on, the stamp, once the overshoot check has passed (a rolled-back attempt reads nothing), from the scan, capacity and memory reading the admission was checked against, and persists it on the `lease-published` transition. Recovery of that transition journals the same stamp; a promotion recovered from `prepared` has no reading from its admission instant and journals no stamp.
- The v3 released row has one writer, the release in `runAdmitted`, which reads the `pressure` gate and, when it is on, a fresh read-only scan just before journaling, while its own lease still counts as active. A scan that fails leaves the row unstamped.
- Enqueued, withdrawn, eviction and routing rows are not stamped, and nothing writes v1 releases.

No admission decision reads the stamp: every read is best effort and returns `None` instead of failing. The capacity figures come from the function the scheduler already used, extracted as `capacityTokensFor` and shared by the promotion tick, the lease check, status and the release stamp. Admission order, weights and caps are unchanged.

The gate is a new additive `pressure` key (`off` or `on`, default `off`) on the `yeet-admission-protocol/v2` marker, flipped with `bun run beep quality scheduler protocol --pressure on|off`, rather than the `units` key. The SCHE-08 gate decision puts behind `units` the work kinds and unit variants a pre-SCHE-08 reader quarantines. The stamp needs no reader census: every revision since the journal's first commit (#878) decodes these rows ignoring unknown keys, and its locked rewrite keeps each row's raw line. The stamp does add reads on the promotion path, so it gets its own switch. The mechanics match `units`: an older writer that rewrites the marker drops the key and turns the stamps off, and `writeAdmissionProtocol` changes one gate and keeps the others. As with `units`, once any gate is flipped the marker records `"pressure":"off"` alongside it. Unlike `units`, which `withQualityAdmission` reads once when it builds the ticket, the `pressure` gate is read afresh at each transition, before the admission samples and before the release samples. Turning it off therefore leaves a queued request's later admission and a running request's release unstamped, and turning it on while work runs stamps that work's release though its admission carries no stamp (pinned by test; each row's stamp stands alone, so a release stamp needs no admission stamp). A stamp an admission already took is copied whatever the gate says later: the transition carries it, so the admitted row journaled by the same process or by a later recovery keeps it.

Compatibility evidence, in `packages/tooling/tool/cli/test/quality-scheduler-admission-pressure.test.ts`:
- With every gate off, the lease, ticket, enqueued, admitted, released and withdrawn rows and a published promotion transition match the bytes captured from origin/main's encoder at 653c2cdef18 before any code changed. With only the units gate on, the lease and the enqueued, admitted and released rows match origin/main's units-on bytes.
- With the gate on, the admitted and released rows are origin/main's bytes plus one trailing key.
- The gate turned off while a request runs leaves its release unstamped; turned on while it runs, the release is stamped and the admission is not; turned off while it waits in the queue, its admission and release are unstamped; a promotion recovered with the gate off still journals the stamp its admission took.
- With a lease whose owner's `/proc/<pid>/cgroup` cannot be read, `unadmittedSliceGib` is absent.
- Rows without the key decode it as `None` and re-encode byte for byte. A stamp shape this revision cannot decode reads as `None`, and the row still decodes.
- origin/main's reader, slice 3's reader (#3308) and a pre-SCHE-08 reader, each built as #3308 built its pre-unit reader (the row schemas without the keys that revision lacked), decode a stamped row exactly as the unstamped row; a property test checks any stamp.
- A locked rewrite run with each older reader keeps stamped rows byte for byte, both in the journal and in the archive segment it trims them to.
- `quality scheduler history --json` carries the stamps and the text output counts the stamped rows. The ciops lab replays the frozen journal 41 of 41 with a stamp on every admitted and released row. `beep ci certainty` and `yeet economics` fold no admission rows, so they have nothing to read or ignore.

Overhead, from `goals/certainty-scorecard/ops/admission-stamp-overhead.ts`: one sequential run per mode of 100 admissions after 10 warm-ups, on the real filesystem, over a 600-row journal. The host was busy (load average 13 to 20 on 64 cores), so the spread is wide.
- Before (origin/main code): promotion p50 64.7 ms, p95 172.6 ms; release p50 16.0 ms, p95 33.7 ms.
- First revision, which held the gate captured at the ticket and did no extra work with it off. Gate off: promotion p50 50.7 ms, p95 60.2 ms; release p50 13.2 ms, p95 17.8 ms. Gate on: promotion p50 55.9 ms, p95 152.8 ms (max 915.6 ms); release p50 16.4 ms, p95 38.3 ms.
- This revision, which reads the small protocol marker once more at each admission and release even with the gate off, measured again at load average 19. Gate off: promotion p50 58.1 ms, p95 157.5 ms; release p50 15.1 ms, p95 31.4 ms. Gate on: promotion p50 88.9 ms, p95 157.9 ms (max 4,752 ms); release p50 20.9 ms, p95 40.4 ms.

The same mode moved by up to 33 ms at p50 between the two measurements, as much as the gap between gate off and gate on, so host load, not the stamp, sets the run-to-run figure here. The first measurement put the stamp at about 5 ms on the promotion p50 and 3 ms on the release p50; the second, taken under heavier load, at about 31 ms and 6 ms. A stamp is about 165 bytes on each admitted and released row. The measured journal grew from 174,863 to 211,327 bytes with 220 of its 599 rows stamped, so a fully stamped 600-row journal is about 240 KB (+38%), read and decoded by every locked rewrite.

Rejected:
- Unit observations: no schema or store, and a second write per transition.
- Stamping enqueued rows: the slice names admitted and released rows, and the wait start is already `enqueuedAtMillis`.
- Writing behind `units`: it would wait on a reader census the stamp does not need.
- Writing unconditionally: no byte-identical off state and no overhead switch.
- Whole PSI readings (avg60, avg300, totals, `full` lines): about three times the bytes.
- Stamping the lease file: it is rewritten every heartbeat.
- A time-join with the PSI recorder: that is MEAS-08, PLAN slice 16, and stays planned.

Lane feat/certainty-admission-pressure-fields

Reverse: Run bun run beep quality scheduler protocol --pressure off to stop the stamps at once; revert the slice-5b PR to remove the key; rows already stamped keep decoding on every revision, which ignores the key.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
