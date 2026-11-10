# Main Verdict Every Commit Spec

## Objective

Deliver the prerequisites for a per-commit `main` verdict and raise the interim verdict rate. Today about 13%
of non-docs `main` commits get a completed hosted verdict, a `Check` push run for that exact SHA ending in
success or failure (D7). Main pushes share one concurrency group (`.github/workflows/check.yml` lines 12 to 14:
`${{ github.workflow }}-${{ github.ref }}`, with `cancel-in-progress` true only for pull requests), so GitHub
keeps one pending run and every later merge cancels it, and in-progress main runs are cancelled by hand: 27 of
60 sampled main runs were cancelled mid-run, traced to ad hoc agent `gh run cancel` calls licensed by the
AGENTS.md "Inherited reds" law, not to tooling (`MergeGate.ts` `cancelMergedHeadRuns` and `yeet gh checks
cancel-queued` act only on PR head SHAs). A main red nobody sees is a stale green for every lane that merges
`main` next, and the post-merge Heavy probe in `docs/runbooks/ci-hosted-settings.md` needs the main push run
of the merge SHA to finish.

The work is HOST-01 as D7 stages it, amended by the operator's `verdict-placement` ruling
(`explorations/github-merge-queue/DECISIONS.md`) and D28: this goal keeps the first two stages, an AGENTS.md
and orchestrate-skill ban on cancelling `refs/heads/main` runs and a throughput layout for main push runs with
its merge-timestamp replay, and adds re-dispatch of missing verdicts. The per-commit verdict itself arrives
later as the merge-group run, one run per commit placed before the merge, owned by the gated
`merge-queue-activation` candidate in `explorations/github-merge-queue/MAP.md`, whose gate waits on this goal's
throughput layout. This goal does not build per-SHA concurrency groups.

`ci/main-verdict`, the capability this goal provides, means: the throughput layout landed on `main`, which
`merge-queue-activation`'s gate waits on; the merge-timestamp replay published under `history/`, as input for
that candidate's owner whether or not its gate names it (D28 open edge); and the interim main verdict rate the
scorecard reports after the layout and re-dispatch.

Every number this goal is judged by is read from the certainty scorecard
([`certainty-scorecard`](../certainty-scorecard/README.md), capability `ci/certainty-scorecard`): the main
verdict rate over non-docs SHAs, PR first-wave pickup p95, heavy-wait p95 and agent-initiated main cancels.

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) —
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 2, "Main verdicts"),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (packet 3, "State at graduation", gated candidates),
[`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D2, D7, D9, D11, D19, D28),
`explorations/ten-minute-certainty/research/phase2/PLAN.md` (row 1, HOST-01) and
`explorations/ten-minute-certainty/research/phase2/merged/hosted-ci.md` (HOST-01 record). Merge-queue rulings:
[`explorations/github-merge-queue/DECISIONS.md`](../../explorations/github-merge-queue/DECISIONS.md)
(`verdict-placement`, `gate-restatement`, `sequencing-against-ten-minute-certainty`).

## Non-Goals

- No per-SHA concurrency groups for main pushes. That stage folded into `merge-queue-activation`
  (`verdict-placement`, D28); two packets building the same verdict would pay for two full runs per commit.
- No merge-group arms in `check.yml` or `heavy.yml` (`merge-group-parity`), no queue activation, and no merge
  doctrine rewrite: all owned by `explorations/github-merge-queue` and its lab goal
  [`merge-queue-lab`](../merge-queue-lab/README.md). Stacked PRs keep the reopen gate in
  `explorations/stacked-pr-adoption/DECISIONS.md`.
- No proof-depth reduction. The main throughput layout runs the full profile: its census of canonical test ids
  equals the full profile's exactly. Property run floors and seeds, coverage floors, the full canonical corpus
  replay on every PR and the required contexts stay as they are.
- No smoke-per-PR corpus replay. It is a gated candidate (main verdict rate at or above 95% for 14 days, D9;
  `pr-head-slimming` in `explorations/github-merge-queue/MAP.md` cites D9 too); this goal reports the rate and
  never proposes the smoke replay.
- No coalesced verdicts (a verdict on a later SHA covering earlier commits); D7 required a separate ruling for
  them and none exists.
- No heavy-pool capacity change: no cap above 2, no larger runner class, no new paid runners (D11).
- No change to pull-request concurrency: PR supersession still cancels in progress.
- No change to the pull-request partition tables or shard plans; those belong to
  [`ci-lane-economics`](../ci-lane-economics/README.md).
- Not the scorecard or its main census (MEAS-01, owned by `certainty-scorecard`); this goal consumes it.
- Not the runner-loss classifier's flake classes or the `workflow_run.workflows` list of
  `.github/workflows/rerun-runner-loss.yml`; those belong to
  [`yeet-monitor-app-identity`](../yeet-monitor-app-identity/README.md) (3a).
- No CLI guard on `cancel-queued`: it cannot reach main SHAs (`GhOps.ts` reads runs per PR head SHA), so the fix
  is policy plus re-dispatch.
- Not trusting the hosted concurrent-job ceiling as measured, and no organization plan or limit change (money).
- Not restoring main-run Turbo summary uploads for test bodies (the critique's "missing from the plan" note).

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

Line numbers re-read at `origin/main` c90929b1ff1.

- `AGENTS.md`, Autonomy, the "Inherited reds" bullet (lines 198 to 202). It tells the orchestrator to declare
  one unblocker and cancel "runs, running ones included, on PRs that must re-run anyway so the unblocker gets
  runners and merges first". The amendment adds one clause: never a `refs/heads/main` run, queued or running.
  `CLAUDE.md` is a symlink to `AGENTS.md`; edit `AGENTS.md`.
- `.claude/skills/orchestrate/SKILL.md`: the "Red check" row (line 255, which runs `yeet gh checks
  cancel-queued` and notes it "also cancels running runs") and the "Queue starved" row (line 261, "Cancel queued
  runs on PRs that must re-run anyway") gain the same exclusion.
- `.github/workflows/check.yml`:
  - the `test-plan` job (lines 721 to 818), whose push branch (line 798) publishes every partition:
    `ALL_TEST_UNIT_PARTITIONS` (24 since #3043) and `ALL_TEST_INTEGRATION_PARTITIONS` (20) at lines 739 and
    740 (throughput layout);
  - the Test Unit and Test Integration shard timeouts, 20 minutes since #3046 (lines 825 and 1014);
  - the admission job's resolved `heavy.yml@main` identity (line 149) and the `heavy` caller (line 214);
  - lines 12 to 14, the concurrency group, read only: re-dispatch is designed around the shared main group.
- `.github/workflows/rerun-runner-loss.yml`: a separate re-dispatch job on the same `workflow_run` trigger
  (the existing job runs only on `conclusion == 'failure'`). `.github/workflows/heavy.yml` only if the replay
  shows the push layout must batch heavy lanes (two-PR rule below).
- `packages/tooling/tool/cli/src/commands/Ci` (`@beep/repo-cli`):
  - `CiLanePartitions.ts`, `CiPartitions.service.ts`, `CiPartitions.schemas.ts` and
    `packages/tooling/tool/cli/vitest.shards.json`: the push layout, derived from the same generator as the PR
    plans, with a census-parity test;
  - `CiRerunRunnerLoss.ts` and `RunnerLossRerun.ts`: the re-dispatch pattern (bounded attempts, head gate,
    rendered summary). The `superseded-head` gate (`RunnerLossRerun.ts` lines 28 to 32) exists because a rerun
    in the shared group cancels the tip's run, which is why re-dispatch fills only idle time;
  - `CiGovernance.ts`: the workflow-lint rule "main pushes must not be cancelled by workflow concurrency"
    (lines 385 to 392), which every workflow slice keeps passing;
  - `LaneTimings.ts`: hosted job and step reads the replay can reuse;
  - a planned merge-timestamp replay subcommand on `@beep/repo-cli` and a planned re-dispatch subcommand,
    both NET-NEW, beside these files;
  - tests in `packages/tooling/tool/cli/test/` (`ci-governance.test.ts`, `ci-rerun-runner-loss.test.ts`,
    `ci-partitions.test.ts`, `ci-lane.test.ts`, `ci-lane-timings.test.ts`).
- `docs/runbooks/ci-runner-reliability.md`: amended when re-dispatch lands.
- This packet (`goals/main-verdict-every-commit/`), including the replay report under `history/`.

No new workspace package is planned.

### Levers

Status from the lever check of 2026-11-09, re-read on `origin/main` c90929b1ff1.

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| HOST-01 a | AGENTS.md and orchestrate skill: never cancel a `refs/heads/main` run | landed (slice 1, `docs(agents): never cancel refs/heads/main runs`): the AGENTS.md Inherited-reds clause and the skill's Red check and Queue starved rows; start date 2026-11-10 (checkpoint `cancel-ban-start-anchor`) | none (policy text); batched with other always-loaded edits only if one is ready the same day | nothing |
| HOST-01 b | Throughput layout for main push runs: fewer, coarser push partitions from the same generator, full profile | open: #3030 kept full allocation on push (`check.yml:798`) | census of canonical test ids equals the full profile exactly; every push leg projected, from measured file seconds, to finish inside its 20-minute shard timeout (`check.yml:825`, `:1014`); Coverage Regression receives a manifest from every push partition; the replay with the layout shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min and reports projected heavy slot-hours per day | scorecard queue numbers |
| HOST-01 c | Re-dispatch of missing or cancelled non-docs main verdicts | open: `rerun-runner-loss.yml` handles failures only | decision tests per case; never displaces a pending main run; attempt ceiling; kill switch; the replay with re-dispatch shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min | replay; scorecard main census |
| HOST-01 d | Per-SHA verdict for every main commit | handed to `merge-queue-activation` (`verdict-placement`, D28): delivered as the merge-group run | not built here | b (the queue's gate waits on the landed layout) |
| replay | 7 to 14 days of real main merge timestamps and PR Check runs, simulated at the documented 60-job ceiling and the cap-2 heavy pool, current layout vs throughput layout, with and without re-dispatch | open (measurement, NET-NEW) | the current-layout replay is calibrated against the scorecard's measured week | scorecard |

## Constraints

- **Staging (D7 as amended by D28):** cancel ban first; layout and replay once the scorecard reports the main
  verdict rate and the queue numbers; re-dispatch after them. Per-SHA verdicts are not a stage here.
- **What the replay counts (D19):** every lever that adds hosted jobs or legs draws on the same unverified
  ceiling of about 60 concurrent hosted jobs. The replay counts the job-adding and job-removing levers that have
  landed when it runs. Under `sequencing-against-ten-minute-certainty` the job removals now precede
  `merge-group-parity`, which waits on route-soundness-repair, heavy-pool-diet and hosted-setup-tax merging;
  they gate no slice of this goal. The layout removes jobs. Re-dispatch adds full Check runs (about 75 hosted
  jobs each per #3046) while no main run is queued or pending, so it is the one job-adding slice here and lands
  only if the replay shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min.
- **The ceiling is a documented default, not a measurement.** The ~60 concurrent hosted-job limit is the
  documented Team default with no admin-side read; 59 concurrent were measured. The replay runs at 60 and
  states its sensitivity at the highest concurrency the scorecard has observed.
- **Heavy pool at cap 2 (D11):** no slice assumes more. Heavy EC2 minutes are paid while GitHub-hosted minutes
  are free for this public repository, so the replay reports projected heavy slot-hours per day. Raising the
  cap or the runner class is money and goes to the operator with the measured post-diet residual.
- **Jobs per run, unverified figures.** D7 costed a full run at about 62 jobs (12 Heavy). At c90929b1ff1 a push
  allocates every partition, 24 Test Unit and 20 Test Integration (`check.yml:739-740`, `:798`), and #3046's
  commit message puts a full Check run at about 75 hosted jobs against the 60-job cap. The per-commit cost
  figures (about 9.7k runner-min/day claimed by the lever, 20 to 36k recomputed by the skeptic, docs-only skip
  share unmeasured) now bear on `merge-queue-activation`; the replay reports runner-minutes for the layout and
  re-dispatch only, from the scorecard.
- **The D7 first-stage estimate is at risk.** D7's "about 55 to 65%" after the cancel ban comes from a 60-run
  sample in which 27 cancels were in progress. `goals/ci-lane-economics/SPEC.md` ("Not changed") later found 82
  of 100 main push runs cancelled (2026-11-08 02:09Z to 2026-11-09 21:51Z) with nine of twelve sampled having
  started no job, which points at pending supersession, which a ban does not prevent. Record the measured rate;
  do not treat the estimate as a gate.
- **Verdict identity:** a verdict counts for its event SHA (`github.sha` on push). A queued main run resolves
  `heavy.yml@main` when it starts, and a re-dispatched run resolves it again, so a verdict can certify a commit
  under a later heavy profile. The admission job already resolves that identity (`check.yml:149`); the
  scorecard reports both, and the re-dispatch path is tested for it.
- **Re-dispatch never displaces a pending main run** (own decision): main pushes share one group, so it re-runs
  only when no main Check run is queued or pending, newest unverdicted non-docs SHA first, with an attempt
  ceiling and a repository-variable kill switch like `BEEP_RERUN_RUNNER_LOSS`. It reads missing verdicts from
  the scorecard's main census and builds no second census. Its GitHub reads run on `GITHUB_TOKEN` (shared
  1,000 requests per hour per repository), bounded per evaluation.
- **`workflow_run` runs the default branch's copy:** the re-dispatch job takes effect only after it merges; its
  pre-merge proof is decision tests, its post-merge proof is the first re-dispatch on `main`.
- **`heavy.yml` is called at `@main`** (`check.yml:214`, pin at `:149`): any hosted heavy-lane input change is
  two PRs. The first ships additive under a migration name, the second retires it after `main` resolves it, and
  each runs the post-merge Heavy probe in `docs/runbooks/ci-hosted-settings.md`.
- **Global inputs and baselines:** any PR that touches a workflow file, `turbo.json`, `bun.lock` or the root
  `package.json` freezes coverage rows at base and escalates to a full matrix; plan the S11 path from the start
  and re-record the cache-qualification baseline in the same PR.
- **Workflow PRs are merged by their owner:** the orchestrator's App token has no `workflows` permission, so a
  PR touching `.github/workflows/` is merged with the workflow-scoped user token pinned to the head SHA. Every
  workflow slice names its revert in the PR body (PLAN.md lists each).
- **Shared doctrine files:** the cancel ban edits `AGENTS.md` and `.claude/skills/orchestrate/SKILL.md`.
  [`local-proof-under-ten`](../local-proof-under-ten/README.md) also edits `AGENTS.md` (PERIL-09, the
  review-window anchor) and the orchestrate skill (PERIL-10); whichever lands second merges `main` first. Keep
  the ban one clause in the always-loaded file and batch it with another ready edit only when both are ready the
  same day; it does not wait. `merge-queue-activation` will later rewrite the merge doctrine in `AGENTS.md` and
  the orchestrate and yeet skills; the ban's clause must survive that rewrite or be restated by it.
- **Partition ownership:** `ci-lane-economics` owns the PR partition tables and shard plans (#3030, #3040 and
  #3043 are its slices). The push layout changes only the push branch of the Test Plan job.
- **Runner-loss classifier ownership:** `yeet-monitor-app-identity` widens `rerun-runner-loss.yml` and its
  classifier (3a) and requires its workflow list to stay `[Check, Heavy Admit]`. The re-dispatch job adds no
  workflow; whichever PR lands second merges `main` first.
- **Reviewer constraints** from `MAP.md` (HOST-09, PERIH-01, PERIH-04, PERIL-01) bind other packets; none
  names HOST-01.
- **Code laws:** Effect v4, schema first (`LiteralKit` for decision reasons, `S.Class` reports), `effect/HashMap`
  and `HashSet`, `Effect.fn`, effect/http; repo-cli tests pass on Node and Bun.
- **Packet rule:** at most three open PRs across this packet's lanes.

## Acceptance Criteria

Read from the certainty scorecard unless stated; windows are UTC days.

- [x] `AGENTS.md` (Autonomy, "Inherited reds") and `.claude/skills/orchestrate/SKILL.md` (the "Red check" and
      "Queue starved" rows) forbid cancelling any `refs/heads/main` run, queued or running.
- [ ] Zero agent-initiated main cancels over the 7 days after the cancel ban lands, and over the final 7-day
      window: no `refs/heads/main` Check run, queued or in progress, cancelled by any actor other than
      concurrency supersession of a pending run, as the scorecard attributes cancels.
- [ ] PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min over the 7 days after the layout
      and re-dispatch land, against the 7 days before the layout.
- [ ] The main verdict rate over non-docs SHAs is recorded for the 7 days before and after the cancel ban, and
      for the 7 days after the layout and re-dispatch land, in `history/`, with the scorecard command that
      produced each. The bar is the plan's: at least 95% of non-docs main SHAs verdicted over 7 days. Whatever
      gap remains is recorded as `merge-queue-activation`'s to close with the merge-group run, not this goal's.
- [ ] The throughput layout's census of canonical test ids equals the full profile's exactly (a test in
      `@beep/repo-cli`), no push partition hits its 20-minute shard timeout (`check.yml:825`, `:1014`) over its
      first 7 days, and Coverage Regression on main pushes receives a manifest from every push partition.
- [ ] The merge-timestamp replay is published under `history/`: 7 to 14 days of real main merge timestamps and
      PR Check runs at the 60-job ceiling and the cap-2 heavy pool, for the current layout, the throughput
      layout and the throughput layout with re-dispatch, stating its calibration error, PR first-wave pickup p95, heavy-wait p95 and projected heavy
      slot-hours per day for each. It is published for `explorations/github-merge-queue` whether or not that
      packet's gate names it; that gate names the landed layout only (D28).
- [ ] Re-dispatch decides from tests: a cancelled or missing non-docs main verdict is re-run only when no main
      Check run is queued or pending; docs-only SHAs, pull-request runs and SHAs at the attempt ceiling are not;
      the kill switch disables it.
- [ ] The 14-day main verdict rate is recorded for the smoke-replay gated candidate (D9), whatever its value.
- [ ] Each workflow slice's PR names its revert and was merged by its owner on the workflow-scoped token.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/main-verdict-every-commit/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/main-verdict-every-commit/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/main-verdict-every-commit` | Passes |
| Workflow policy | `bun run beep ci workflow-lint` | Passes, including "main pushes must not be cancelled by workflow concurrency" |
| Shard plans | `bun run beep ci partitions rebalance --check` | Passes |
| CI command tests (Node) | `bunx vitest run packages/tooling/tool/cli/test/ci-governance.test.ts packages/tooling/tool/cli/test/ci-rerun-runner-loss.test.ts packages/tooling/tool/cli/test/ci-partitions.test.ts packages/tooling/tool/cli/test/ci-lane.test.ts packages/tooling/tool/cli/test/ci-lane-timings.test.ts` plus the new re-dispatch and replay test files | Passes |
| CI command tests (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-governance.test.ts test/ci-rerun-runner-loss.test.ts test/ci-partitions.test.ts test/ci-lane.test.ts test/ci-lane-timings.test.ts` plus the new test files | Passes |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Main push census today | `bun run beep ci lane-timings --window --event push --branch main`, with `--since` and `--until` bounding the week | Records the pre-change main population |
| Decision log | `bun run beep goals decisions check --slug main-verdict-every-commit` | No drift |
| Final gate | `bun run beep yeet final-check` | Passing receipt for each PR head |
| Post-merge Heavy probe | the procedure in `docs/runbooks/ci-hosted-settings.md` for any `heavy.yml` change | Every `Heavy / *` lane `heavy.yml` defines today (five at c90929b1ff1: Lint Policy, Check, Docgen, Doctest, Build) executes on the merge SHA; the runbook's "seven" is stale (`docs/runbooks/ci-hosted-settings.md:14` against the five jobs `heavy.yml` defines) |
| Scorecard numbers | the certainty scorecard's main verdict, pickup, heavy-wait and cancel figures, saved under `history/` | Meet the Acceptance Criteria |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator. That includes a heavy-pool cap above 2, a larger runner class or an organization plan change to
  lift the hosted job ceiling.
- The same blocker repeats after reasonable investigation.
- The replay shows the throughput layout or re-dispatch regressing PR first-wave pickup p95 or heavy-wait p95 by
  more than 1 min: do not land that slice; record the replay and report it.
- The certainty scorecard cannot report the main verdict rate, first-wave pickup or heavy wait: hold the layout
  and re-dispatch slices and report to the scorecard owner; do not build a second census here.
- The merge-queue lab ends in park or kill: the per-commit verdict has no owner again; record it and reopen D28
  in the exploration rather than building per-SHA groups here.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add main-verdict-every-commit --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug main-verdict-every-commit`; add a `kind: decision` file there, never edit this block._

### Every main commit gets a hosted verdict as part of the target, 2026-11-09

The program's target is p95 push-to-every-required-context-green on PR runs, reported beside runner-minutes per run, plus a completed hosted verdict for every main commit. A per-job target was rejected because main runs serialize and 12 of 15 were cancelled on 2026-11-09, so it would hide that most merged commits get no verdict. Since D28 this goal raises the interim rate and reports it: a non-docs main SHA counts as verdicted only when a Check push run for that exact SHA reaches success or failure; cancelled, missing or still-pending runs count as misses. The per-commit verdict itself arrives as the merge-group run under `merge-queue-activation`; the gap between the interim rate and the plan's 95% bar is recorded as that candidate's.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D2, D28).

Reverse: Re-rule D2 in the exploration so the target counts PR runs only; this goal then stops reporting the main verdict rate.

### This goal assumes the heavy pool at cap 2 and asks for no capacity, 2026-11-09

Heavy-pool capacity (a cap above 2 or a larger runner class) is money and is decided only against the post-diet heavy-queue residual the certainty scorecard reports. The throughput layout, the replay and re-dispatch all assume cap 2; no slice may raise the cap, change the runner class or depend on either. If the replay shows the layout or re-dispatch cannot fit at cap 2 without regressing PR heavy-wait p95 by more than 1 min, the goal does not land that slice and records the residual as an operator money question. Rejected: sizing the layout against a larger pool (unmeasured, and money).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D11).

Reverse: If the operator raises the cap after the post-diet residual, re-run the replay at the new cap and record it as a new decision.

### HOST-01 is open: #3030 left main push runs at full partition allocation, 2026-11-09

No HOST-01 slice has landed; re-checked at `origin/main` c90929b1ff1. The AGENTS.md Inherited-reds bullet (lines 198 to 202) still tells the orchestrator to cancel runs, running ones included, the main concurrency group is unchanged (`.github/workflows/check.yml` lines 12 to 14), and `rerun-runner-loss.yml` handles failures only. #3030 changed what a pull request allocates, not a push: its Test Plan job publishes every partition on a push (`check.yml:798`), 24 Test Unit (since #3043) and 20 Test Integration partitions (`check.yml:739-740`). The throughput layout therefore changes only the push branch of the Test Plan, and the PR partition tables stay with goals/ci-lane-economics, which owns them.
Source: this goal's lever check, 2026-11-09, repeated at c90929b1ff1 (git show --stat f818c6e52bf and 08972a39a16; goals/ci-lane-economics/SPEC.md, "Not changed").

Reverse: If a later PR lands any HOST-01 slice, mark that slice landed in SPEC.md with its evidence and keep only the residual.

### The replay counts the job-adding and job-removing levers that have landed, 2026-11-09

Every lever that adds hosted jobs or legs draws on the same unverified ceiling of about 60 concurrent hosted jobs, so the critic ordered job-removing levers before job-adding ones. Per-SHA groups, the job-adding stage this order gated, left this goal (D28). Under `sequencing-against-ten-minute-certainty` the job removals in heavy-pool-diet and hosted-setup-tax now precede `merge-group-parity`, which waits on route-soundness-repair, heavy-pool-diet and hosted-setup-tax merging. Here they gate no slice: the merge-timestamp replay counts the job-adding and job-removing levers that have landed when it runs. The cancel ban adds no jobs, the throughput layout lowers a push run's job count, and re-dispatch adds full Check runs (about 75 hosted jobs each per #3046) but only while no main run is queued or pending, and it lands only if the replay shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min. Rejected: keeping the removals as a gate on the layout (the layout removes jobs; re-dispatch, the one job-adding slice, is gated by the replay instead).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19, D28) and `explorations/github-merge-queue/DECISIONS.md` (`sequencing-against-ten-minute-certainty`).

Reverse: Make the job removals a gate on the layout or re-dispatch slice here, with a decision file naming the levers.

### Per-SHA main verdicts are handed to merge-queue-activation; this goal provides the layout and the replay, 2026-11-09

The operator's `verdict-placement` ruling makes the merge group the per-commit main verdict, one run per commit placed before the merge, and folds "Per-SHA main groups" into the gated `merge-queue-activation` candidate of `explorations/github-merge-queue`, after D7's throughput layout lands. D28 applies it to this goal: the per-SHA concurrency slice is removed from PLAN.md and the HOST-01 per-SHA stage is marked handed off in the lever table. `ci/main-verdict` now means the landed throughput layout, which `merge-queue-activation`'s gate waits on; the merge-timestamp replay, published as input for that candidate's owner whether or not its gate names it (D28); and the interim main verdict rate after the layout and re-dispatch. The plan's 95% bar stays the bar; the remaining gap is recorded as `merge-queue-activation`'s. Rejected: keeping per-SHA groups here as a fallback slice (built against a ruling; two full runs per commit).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D28) and `explorations/github-merge-queue/DECISIONS.md` (`verdict-placement`).

Reverse: A decision file here restoring the per-SHA slice, after a ruling that the merge queue will not carry the verdict (D28's reversal).

### Re-dispatch fills idle main capacity and never displaces a pending main run, 2026-11-09

While main Check pushes share one concurrency group (`.github/workflows/check.yml` lines 12 to 14), GitHub keeps one pending run per group, so re-running a cancelled main run while another is pending would cancel that newer run and trade one missing verdict for another; the runner-loss classifier already refuses such reruns for this reason (`superseded-head`, `packages/tooling/tool/cli/src/commands/Ci/RunnerLossRerun.ts` lines 28 to 32). Re-dispatch therefore re-runs a missing non-docs main verdict only when no main Check run is queued or pending, newest unverdicted SHA first, with a per-SHA attempt ceiling in the style of the runner-loss rerun. It extends the `workflow_run` pattern of `.github/workflows/rerun-runner-loss.yml` (today it acts only on `conclusion == 'failure'`) as a separate job or subcommand, so the workflow list and runner-loss classifier that yeet-monitor-app-identity widens stay unchanged; missing-verdict detection reads the certainty scorecard's main census, never a second census. Rejected: re-running every cancelled main run immediately (fights the shared group); a new census here (duplicates MEAS-01).
Source: this goal's lever check, 2026-11-09 (check.yml:12-14; rerun-runner-loss.yml job `if`; RunnerLossRerun.ts:28-32).

Reverse: Disable the re-dispatch job with its repository variable, or revert its workflow PR.

### Smoke-per-PR corpus replay stays gated on a 95% main verdict rate for 14 days, 2026-11-09

Test Integration keeps the full canonical citation corpus replay on every PR. Smoke per PR plus a full replay on main is reconsidered only after the certainty scorecard shows the main verdict rate at or above 95% for 14 days; with a 13% rate a main or nightly replay would not reliably run, and the replay is the only production-deadline witness. This goal never proposes the smoke replay itself: it reports the 14-day rate, and the reopening belongs to the gated candidate in the exploration's MAP.md. `pr-head-slimming` in `explorations/github-merge-queue/MAP.md` cites D9 too. Rejected: smoke per PR now (proof-depth reduction, ruling 5).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D9).

Reverse: Re-rule D9 in the exploration; this goal's verdict-rate report is then informational only for the corpus replay.

### Main verdicts are staged: cancel ban, throughput layout and replay, then re-dispatch; per-SHA verdicts move to the merge queue, 2026-11-09

D7 staged main verdicts as a cancel ban, a throughput layout for main pushes, then per-SHA concurrency groups. The operator's `verdict-placement` ruling, applied by D28, amends it: the merge group is the per-commit verdict, so D7's third stage folds into the gated `merge-queue-activation` candidate of `explorations/github-merge-queue`, after D7's throughput layout lands. This goal therefore lands three stages: (1) amend AGENTS.md and the orchestrate skill to forbid cancelling `refs/heads/main` runs (D7's estimate: verdict rate to about 55 to 65%, now at risk, see the exploration's MAP.md "State at graduation"), (2) a throughput layout for main push runs with the merge-timestamp replay, and (3) re-dispatch of missing verdicts, this goal's addition, which only fills idle time in the shared main group. D7 put per-SHA groups after the throughput layout because the full per-SHA profile costs about 20 to 36k runner-min/day and about 62 jobs per run against a roughly 60-job ceiling (more today); `verdict-placement` accepts that cost and moves the stage into the merge-group run; coalesced verdicts were never ruled to satisfy every commit and are not built.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D7, as amended by D28) and `explorations/github-merge-queue/DECISIONS.md` (`verdict-placement`).

Reverse: Restore the per-SHA stage here only after a ruling that the merge queue will not carry the verdict (D28's reversal); revert the AGENTS.md clause to re-allow main cancels.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
