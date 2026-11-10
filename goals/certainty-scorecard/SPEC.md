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
  - `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts`: per-attempt job reads (the jobs read is
    `filter=all` at line 1059), partial-row stamping that reuses the `--window` preview stamp (line 3891), a
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
#3046; no status changed (decision `lever-status-at-graduation`).

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| MEAS-01 | Nightly head-SHA scorecard: push to every required green, main verdict cohorts, runner-minutes, mergeable beside | open (no certainty command exists) | Fixture replay: 4 of 30 under 10 min, green-only p95 101.9, about 315 runner-min per run, plus per-head cases (two producers, three attempts, docs-only, cancelled); monotonicity fixture (turning a green head red never lowers the statistic); an api-partial census refuses certification; the nightly fits the GITHUB_TOKEN budget or resumes | MEAS-04 |
| MEAS-04 | lane-timings per-attempt job reads, partial-row stamping, filtered recent mode | open (`LaneTimings.ts:1059` still reads `filter=all`) | Fixtures for 502, exhaustion, duplicate and rerun; partial output reuses the `--window` preview stamp on both renderers; live union parity on run 42655574858; 180 jobs on run 42646019844 | none |
| MEAS-02 | Attribute lock-bounce, stale-base and closeout refusals outside first-failure lanes (merges DEPS-10) | open (`Economics.ts:1154` falls back to the failed step id) | Fixtures in `yeet-economics.test.ts`; `actionableLaneMix` total equals `redAttempts`; `gate-order-handoff.test.ts` stays green | none |
| MEAS-03 | Separate terminations and type unlocated failures | partly landed (terminations census at `Economics.ts:1399`; terminated attempts still count as red, `Economics.ts:1013`) | Adjudicated fixtures; the denominator change is recorded | MEAS-02, MEAS-07 |
| MEAS-07 | Journal final-check invocations and keep per-run history | open (`FinalCheck.ts` writes no attempt journal) | Journaling unit test plus a ready-gate regression fixture | none |
| PERIL-11 | Keep attempt journals outside the reaped residue root; T3 lanes via `roots.json`; seat and host fields (merges MEAS-09) | open (`ResidueReap.ts:1776`, `yeet` not retained; no T3 row in the runbook list) | Fixture: retire, simulate a copy failure, restore, import duplicates, run residue-reap with maxAgeDays=0, re-census; each (runId, attemptId) appears exactly once and a copy failure blocks deletion | MEAS-07 |
| ROUT-05 | Route corpus with partition mapping, step classes and per-lane outcomes in one capture (merges ROUT-06) | open (`RouteCensus.ts:168` strips the suffix to `Test Integration`, which matches no lane context; the lane is `Heavy / Test Integration`, `CiLane.ts:477`) | An old receipt restored to a scratch `--corpus` dir reproduces 242 skipped and 0 skippedReds; a post-#3043/#3046 fixture maps every job (conservation test: mapped plus unknown minutes equal total); aggregator and setup reds become unknown, never dropped | none |
| MEAS-06 | Project the existing Vitest unit-results.json into per-file and per-package timing on every event | open (unit-results.json is uploaded only by the failure-only step at `.github/workflows/check.yml:924-934`; nothing projects it) | Rows exist for every executed package and file counts equal expectedTestFiles, stratified by event | MEAS-01 |
| MEAS-05 | Joined per-check cost ledger at (lane, partition) grain with asymmetric digests | open | At least 95% of job-minutes mapped on the three reference runs; an umbrella-plus-partition fixture shows no double count | ROUT-05, MEAS-04 |
| MEAS-08 | Time-join PSI samples onto attempts (no hot-path stamps) | open | None | MEAS-05 |
| SCHE-09 | Retain admission history beyond the 200-row ring, with pressure fields | open (`AdmissionJournal.ts:59`) | Archive fold tests | none |

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
- **Job names the mapping must handle** (live at c90929b1ff1): `Test Integration (<partition>)` (`check.yml:1010`;
  20 partitions since #3029: 19 lps-int shards plus int-rest) and its aggregate, whose name is conditional (`Test Integration Partitions`
  or `Heavy / Test Integration`, `check.yml:1133`); `Test Unit (<partition>)` (`check.yml:821`; 24 jobs since #3043: nine
  repo-cli and eight law-practice shards on two Vitest workers since #3040, seven unit bins on one) and
  the `Test Unit` aggregate (`check.yml:978`); `Test Plan` (`check.yml:732`, #3030); `Property Laws
  (<partition>)` slices (`check.yml:1426`) under the `Property Laws` aggregate (`check.yml:1538`, #3030); the
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

- [ ] The certainty command reproduces the committed fixture corpus (decision `in-repo-fixture-corpus`): 4 of
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
      jobs, Test Plan, two Property Laws slices) every job maps to a lane or an
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

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
