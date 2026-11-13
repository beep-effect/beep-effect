# Main Verdict Every Commit Spec

## Objective

Deliver the prerequisites for a per-commit `main` verdict and raise the interim verdict rate. Today about 13%
of non-docs `main` commits get a completed hosted verdict, a `Check` push run for that exact SHA ending in
success or failure (D7). Main pushes share one concurrency group (the top-level `concurrency` block of `.github/workflows/check.yml`:
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
- No further CLI guard. `GhOps.ts` reads runs per PR head SHA, but a main push run on the same SHA was reachable;
  #3140 closed that (checkpoint `cancel-guard-in-commands`): `cancel-queued` and the merge gate cancel only
  pull-request runs. The rest of the fix is policy plus re-dispatch.
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

Workflow surfaces are cited by job, step and key name, not line number: open PR #3122 rewrites
`.github/workflows/check.yml`. Re-read at `origin/main` 7a462a27d4f.

- `AGENTS.md`, Autonomy, the "Inherited reds" bullet. Before slice 1 it told the orchestrator to declare
  one unblocker and cancel "runs, running ones included, on PRs that must re-run anyway so the unblocker gets
  runners and merges first"; slice 1 (#3111) added the clause: never a `refs/heads/main` run, queued or running.
  `CLAUDE.md` is a symlink to `AGENTS.md`; edit `AGENTS.md`.
- `.claude/skills/orchestrate/SKILL.md`: the "Red check" row (which runs `yeet gh checks cancel-queued` and
  notes it "also cancels running runs") and the "Queue starved" row ("Cancel queued runs on PRs that must re-run
  anyway") carry the same exclusion since #3111. #3140 enforces it in the commands: `cancel-queued` and the merge
  gate's `cancelMergedHeadRuns` cancel only pull-request runs (`isAgentCancellableWorkflowRun`).
- `.github/workflows/check.yml`:
  - the `test-plan` job, whose `Publish partition plan` step publishes every partition on a push: env
    `ALL_TEST_UNIT_PARTITIONS` (24 since #3043) and `ALL_TEST_INTEGRATION_PARTITIONS` (20) (throughput layout);
  - `timeout-minutes` on the `test-unit-shard` and `test-integration-shard` jobs, 20 minutes since #3046;
  - the `heavy` job, which calls `heavy.yml@main`. The admission job's `Determine coverage rollout context`
    step, which resolved that identity from the run's `referenced_workflows`, was deleted by #3116; the run
    payload's `referenced_workflows[].sha` still carries it;
  - the top-level `concurrency` block, read only: re-dispatch is designed around the shared main group.
- `.github/workflows/rerun-runner-loss.yml`: a separate re-dispatch job on the same `workflow_run` trigger
  (the existing job runs only on `conclusion == 'failure'`). `.github/workflows/heavy.yml` only if the replay
  shows the push layout must batch heavy lanes (two-PR rule below).
- `packages/tooling/tool/cli/src/commands/Ci` (`@beep/repo-cli`):
  - `CiLanePartitions.ts`, `CiPartitions.service.ts`, `CiPartitions.schemas.ts` and
    `packages/tooling/tool/cli/vitest.shards.json`: the push layout, derived from the same generator as the PR
    plans, with a census-parity test;
  - `CiRerunRunnerLoss.ts` and `RunnerLossRerun.ts`: the re-dispatch pattern (bounded attempts, head gate,
    rendered summary). The `superseded-head` reason of `RunnerLossRerunReason` exists because a rerun
    in the shared group cancels the tip's run, which is why re-dispatch fills only idle time;
  - `CiGovernance.ts`: the workflow-lint rule "main pushes must not be cancelled by workflow concurrency",
    which every workflow slice keeps passing;
  - `LaneTimings.ts`: hosted job and step reads the replay can reuse;
  - a planned merge-timestamp replay subcommand on `@beep/repo-cli` and a planned re-dispatch subcommand,
    both NET-NEW, beside these files;
  - tests in `packages/tooling/tool/cli/test/` (`ci-governance.test.ts`, `ci-rerun-runner-loss.test.ts`,
    `ci-partitions.test.ts`, `ci-lane.test.ts`, `ci-lane-timings.test.ts`).
- `docs/runbooks/ci-runner-reliability.md`: amended when re-dispatch lands.
- This packet (`goals/main-verdict-every-commit/`), including the replay report under `history/`.

No new workspace package is planned.

### Levers

Status from the lever check of 2026-11-09, re-read on `origin/main` 7a462a27d4f (2026-11-13).

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| HOST-01 a | AGENTS.md and orchestrate skill: never cancel a `refs/heads/main` run | landed (slice 1, #3111): the AGENTS.md Inherited-reds clause and the skill's Red check and Queue starved rows; start date 2026-11-10 (checkpoint `cancel-ban-start-anchor`); enforced in `cancel-queued` and the merge gate by #3140 (checkpoint `cancel-guard-in-commands`) | none (policy text); batched with other always-loaded edits only if one is ready the same day | nothing |
| HOST-01 b | Throughput layout for main push runs: fewer, coarser push partitions from the same generator, full profile | open: #3030 kept full allocation on push (`test-plan` job, `Publish partition plan` step) | census of canonical test ids equals the full profile exactly; every push leg projected, from measured file seconds, to finish inside its 20-minute shard timeout (`timeout-minutes` on `test-unit-shard` and `test-integration-shard`); Coverage Regression receives a manifest from every push partition; the replay with the layout shows PR first-wave pickup p95 and heavy-wait p95 regressed by at most 1 min and reports projected heavy slot-hours per day | scorecard queue numbers |
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
  documented Team default with no admin-side read; a peak of exactly 60 concurrent hosted jobs was observed on
  each of three measured days (research note `2026-11-13-check-run-queue-day-measure.md`, decision
  `check-run-queue-measurements`), which bounds the ceiling from below without an admin read. The replay runs at 60 and
  states its sensitivity at the highest concurrency the scorecard has observed.
- **Heavy pool at cap 2 (D11):** no slice assumes more. Heavy EC2 minutes are paid while GitHub-hosted minutes
  are free for this public repository, so the replay reports projected heavy slot-hours per day. Raising the
  cap or the runner class is money and goes to the operator with the measured post-diet residual.
- **Jobs per run.** D7 costed a full run at about 62 jobs (12 Heavy). A push allocates every partition, 24 Test
  Unit and 20 Test Integration (`test-plan` job, `Publish partition plan` step), and #3046's commit message put a
  full Check run at about 75 hosted jobs. Measured on 2026-11-10 and 2026-11-12: every main push run that
  started a job had 44 test shards and 69 to 71 hosted jobs; the median full run on 2026-11-12 had 70 (decision
  `check-run-queue-measurements`). The per-commit cost
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
  under a later heavy profile. The run payload's `referenced_workflows[].sha` records that identity (the
  admission step that read it was deleted by #3116); the
  scorecard is to report both (it does not yet: decision `scorecard-field-census`), and the re-dispatch path
  is tested for it.
- **Re-dispatch never displaces a pending main run** (own decision; the re-run API facts are in decision
  `rerun-api-cancelled-push-runs`): main pushes share one group, so it re-runs
  only when no main Check run is queued or pending, newest unverdicted non-docs SHA first, with an attempt
  ceiling and a repository-variable kill switch like `BEEP_RERUN_RUNNER_LOSS`. It reads missing verdicts from
  the scorecard's main census and builds no second census. Its GitHub reads run on `GITHUB_TOKEN` (shared
  1,000 requests per hour per repository), bounded per evaluation.
- **`workflow_run` runs the default branch's copy:** the re-dispatch job takes effect only after it merges; its
  pre-merge proof is decision tests, its post-merge proof is the first re-dispatch on `main`.
- **`heavy.yml` is called at `@main`** (the `heavy` job of `check.yml`): any hosted heavy-lane input change is
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
      `@beep/repo-cli`), no push partition hits its 20-minute shard timeout (`timeout-minutes` on
      `test-unit-shard` and `test-integration-shard`) over its
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

### Check-run measurements: the 60-job peak, 70 jobs per full run and main pre-job waits are settled; the cancel actor and 7-day p95s are not, 2026-11-13

Another session measured Check runs on 2026-11-10 (day A, first day on the final shard layout) and 2026-11-12 (day B, after the cancel ban) against a 2026-11-09 baseline and handed the results to the certainty packets on the operator's instruction. They are filed as `research/2026-11-13-check-run-queue-day-measure.md`. Its clock runs from a run's first job start to the `Test Unit` and `Heavy / Test Integration` aggregate verdicts: it is not the scorecard's push-to-green clock and excludes the wait before the first job. Limits: three runs missing on HTTP 502 and re-run attempts mixed by `filter=latest`.

What it settles for this goal:

- The hosted concurrency cap: a peak of exactly 60 concurrent hosted jobs on all three days, with 78 to 257 minutes per day at 55 or more. That bounds the documented ~60 ceiling from below without an admin read; the replay (slice 2) runs at 60 as the SPEC says, and a higher ceiling is not supported by any reading.
- Jobs per run: every main push run that started a job had 44 test shards (24 Test Unit + 20 Test Integration) and 69 to 71 hosted jobs; the median full run on day B had 70 hosted jobs and 44 test shards. This replaces #3046's commit-message estimate of about 75 as the replay's per-run input, pending a scorecard row.
- Wait before the first job on main pushes: median 5.6 and p90 16.3 min on day A, median 4.2 and p90 13.8 min on day B (baseline median 7.0, p90 36.0). This is the queue a throughput layout and re-dispatch compete in.
- Main push cancels: 14 of 20 runs cancelled on day A, 11 of 20 on day B. Derived from the sender's per-run table: 13 of 14 and 11 of 11 were cancelled before any job started (one day A run had 69 jobs). Runs cancelled before their first job match GitHub's replacement of the one pending run per group (decision `rerun-api-cancelled-push-runs`), the pattern `goals/ci-lane-economics` found (82 of 100) and the reason D7's 55 to 65% estimate is at risk.

What it does not settle:

- The cancel actor. Day B is after the ban (#3111, guard #3140), but the measurement does not separate concurrency supersession from an agent cancel, so day B's 11 cancels are not evidence of a ban violation, and the zero-agent-cancel acceptance stays unread. The actor is still the missing field (decision `scorecard-field-census`).
- PR first-wave pickup p95 and heavy-wait p95 over 7 days. Two single days in five-hour bursts, on a first-job clock, are not the scorecard's populations, so slice 2 stays held under SPEC "Stop Conditions" and none of these numbers is an acceptance read.
- The main verdict rate: verdicts per run, not per non-docs first-parent SHA; the history note `2026-11-13-pre-ban-main-verdict-rate` is the scorecard read.

Statements in other packets the measurements bear on (not edited here; their next PRs can cite the research note):

- `goals/hosted-setup-tax/SPEC.md`: the decision that job removals precede `merge-group-parity` calls the ~60 concurrent hosted job ceiling unverified, and its reversal waits on "the scorecard measures the hosted concurrent-job ceiling"; a 60 peak was observed on three days. Its "ROUT-01 and HOST-07 are one lever" constraint says the Test Plan job's own setup "the exploration did not measure" is netted in the scorecard: the Test Plan ran a median 1.2 min on pull requests on both days.
- `goals/heavy-pool-diet/SPEC.md`: the job-ceiling constraint (HOST-08 lands "inside the unverified ~60 concurrent hosted job ceiling") and the HOST-08 steady-state rule: slowest shard per full run median 8.7 / 8.4 min, p90 9.9 / 9.7 min; shards of 10 min or longer in 2 and 3 runs, the worst a `law-practice-6` leg of 16.9 min on a main push that ran 5 to 7 min in 26 other runs; runner waits cost a median 2.4 / 2.2 min and p90 8.9 / 9.6 min per full run, and no full run whose shards waited 1 min or more met 10 min.
- `goals/heavy-pool-diet` and `goals/certainty-scorecard`, the admission-to-Heavy and heavy-wait rows: the hosted `Heavy / Test Integration` aggregate waited for a hosted runner after its last shard finished, p90 5.0 min (day A) and 8.7 min (day B), maximum 10.6. That is hosted-pool wait inside a `Heavy / ` context, which the pre-#3144 `admissionToHeavy` row timed; #3144 moves the row to heavy-pool pickup.
- `goals/certainty-scorecard/SPEC.md`: "Inherited risks" says the ~60 ceiling "is documented, not measured, and the scorecard does not claim it", and `CI_CERTAINTY_NOT_COVERED` lists "the hosted concurrent-job ceiling (no admin read)": the observed peak is now a lower bound it can cite. The "Numbers the scorecard reports" row for hosted jobs per run (replay input) has two days of measured values to calibrate against. Its "Test Integration partition setup versus body" not-covered entry is unchanged: the note reports per-shard run time, not setup.
Source: research note `research/2026-11-13-check-run-queue-day-measure.md`; the sender's report, day summaries, baseline summary and per-run tables (outside the repository).

Lane claude/amazing-swirles-67011b

Reverse: If the scorecard's 7-day reads contradict these two days, cite the scorecard and restate this decision; the research note stays as evidence.

### The re-run API accepts a cancelled push run; whether it re-enters the shared main group is undocumented, so re-dispatch fires only when nothing is pending, 2026-11-13

P0 fact for slice 4 (re-dispatch): does `POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun` accept a cancelled push run, and does the rerun re-enter `check.yml`'s shared main concurrency group? Read from GitHub's documentation and read-only `gh api` calls on 2026-11-13; no main run was re-run or cancelled.

Documented:

- The REST reference for "Re-run a workflow" ("Re-runs your workflow run using its id") states no restriction on the run's conclusion, documents only `201 Created`, and takes only `enable_debug_logging`. `rerun-failed-jobs` re-runs "failed jobs and their dependent jobs"; the docs do not say a cancelled job counts as failed, so re-dispatch uses the whole-run endpoint.
- "Re-running workflows and jobs": re-runs are possible up to 30 days after the initial run, use the original event's `GITHUB_SHA` and `GITHUB_REF`, and run with the privileges of the actor who triggered the original run. A re-run therefore stays a `push` run on `refs/heads/main` for the same SHA, which the verdict definition (decision `every-main-commit-verdict`) counts.
- Neither the REST reference nor the re-run page nor the concurrency pages mention re-runs and concurrency together. The concurrency reference says a group holds at most one running and, under the default `queue: single`, one pending run, and that a newly queued run cancels and replaces the pending one.

Observed (read-only):

- Cancelled main push runs expose `rerun_url` and no `concurrency` field in the run payload; for example run 43337600976 (head 7b8116b26cb, attempt 1, cancelled before any job: `total_count` 0).
- On 2026-11-12 between 19:20:42Z and 19:22:00Z four consecutive main push runs (43289187669, 43289242017, 43289284656, 43289325218) were each cancelled 15 to 30 s after creation, when the next push's run was created, with no job started: GitHub's pending-run replacement in the shared group.
- The only main push re-runs in the last 100 main push runs are re-runs of failed attempts (43289409901 attempt 2 by `github-actions[bot]`, 42642693204 attempts 2 and 3). No cancelled main push run has been re-run, so no live record shows whether a re-run queues behind, or displaces, a pending run in the group.

Conclusion: the endpoint accepts a completed run with no documented conclusion restriction, so a cancelled push run is re-runnable by contract, within 30 days and for its original SHA. Whether the re-run joins the `${{ github.workflow }}-${{ github.ref }}` group is undocumented; this goal keeps the conservative reading the runner-loss classifier already encodes (the `superseded-head` reason in `RunnerLossRerun.ts`: "re-running it would cancel the current head's run") and the decision `redispatch-never-displaces-a-pending-run`: re-dispatch fires only when no main Check run is queued or pending. Slice 4 proves both halves on its first post-merge re-dispatch (a `workflow_run` job runs from `main`'s copy) and records the attempt's `run_attempt`, start time and any concurrently pending main run; a 4xx on a cancelled run there reopens this decision.

Found in passing: the concurrency reference now documents `queue: max` (up to 100 pending runs per group, FIFO not guaranteed, not combinable with `cancel-in-progress: true`). It would keep superseded main pushes pending instead of cancelling them, which bears on the 82-of-100 pending-supersession finding in the SPEC's Constraints. `check.yml` sets `cancel-in-progress` by expression (true for pull requests), so adopting it needs a design for the PR branch and a replay of the queueing cost. It is not adopted here; it is recorded as an input for slice 2's replay and slice 4's design.
Source: docs.github.com REST "Workflow runs" (re-run a workflow, re-run failed jobs), "Re-running workflows and jobs", workflow syntax `concurrency` and "Control the concurrency of workflows and jobs", read 2026-11-13; `gh api repos/{owner}/{repo}/actions/workflows/check.yml/runs?branch=main&event=push` and `.../actions/runs/{id}/attempts/{n}` (read-only).

Lane claude/amazing-swirles-67011b

Reverse: If slice 4's first post-merge re-dispatch shows the re-run bypasses the concurrency group (or is refused), restate this decision with that run's evidence and widen or drop the idle-only gate.

### Scorecard field census: the main verdict rate is reported, pickup p95, heavy-wait p95, job counts and the cancel actor are not, 2026-11-13

P0 fact: which certainty-scorecard fields this goal is judged on exist on `main` (read at 7a462a27d4f, after #3118). `bun run beep ci certainty` emits `CiCertaintyReport` (`schemaVersion` `ci-certainty-report/v1`) from `packages/tooling/tool/cli/src/commands/Ci/Certainty.schemas.ts`.

Present:

- Main verdict rate over non-docs first-parent SHAs: `CiCertaintyReport.main` (`CiCertaintyMainStat`: `commits`, `docsCommits`, `verdicts`, `cancelled`, `noRun`, `open`, `unread`, `rate`) and `CiCertaintyReport.mainRows` (`CiCertaintyMainRow`: `sha`, `committedAt`, `docsOnly`, `runIds`, and `verdict`, a `CiCertaintyMainVerdict` of `success`, `failure`, `cancelled`, `no-run`, `open` or `unread`). Since #3168 (3b85830d051) the push listing is read before the pull-request job reads, and an incomplete listing marks every main commit `unread` and leaves `rate` empty instead of folding them to `no-run`; a consumer of `mainRows` (re-dispatch, slice 4) must treat `unread` as unknown, never as missing. This is the before/after verdict read and the missing-verdict list re-dispatch (slice 4) needs; history note `2026-11-13-pre-ban-main-verdict-rate` records the first read (refused before #3168, the main block an artifact) and the second, complete main read after it: 70 of 283 non-docs commits verdicted, rate 24.7%.
- Admission to Heavy: `CiCertaintyReport.admissionToHeavy` (`CiCertaintyAdmissionStat`: `n`, `p50Minutes`). #3144 (merged) redefined it as heavy-pool pickup per producer run and the runner-minutes rows (`CiCertaintyRunnerStat`) as per head attempt, keeping the field names; cite #3144 when reading either.
- Push-to-required-green latency (`slo`, `mergeable`, `greenOnly`: `CiCertaintyLatencyStat`) and the Test Unit conversion row (`CiCertaintyTestUnitConversion.fullLayoutJobs`, Test Unit partition jobs only).

Missing:

- PR first-wave pickup p95: no field. `CiCertaintyLatencyStat` measures push to required green, not run creation to first job.
- Heavy-wait p95: `CiCertaintyAdmissionStat` has a p50 and no p95; `CI_CERTAINTY_NOT_COVERED` in `packages/tooling/tool/cli/src/commands/Ci/Certainty.ts` defers "the main run cancel actor and heavy-queue pickup p95 (later slices)".
- Hosted jobs per run: no field (runner-minutes, not job counts). The research note `2026-11-13-check-run-queue-day-measure.md` has two measured days (decision `check-run-queue-measurements`), not a scorecard row.
- Main run cancel actor: `CiCertaintyMainStat.cancelled` counts cancelled verdicts with no actor; deferred by the same `CI_CERTAINTY_NOT_COVERED` entry. Zero-agent-cancel acceptance cannot be read without it.
- Heavy identity beside each main verdict: `CiCertaintyMainRow` carries no resolved `heavy.yml@main` identity, although the SPEC's verdict-identity constraint says the scorecard reports it.
- The hosted concurrent-job ceiling: `CI_CERTAINTY_NOT_COVERED` ("no admin read").

The certainty-scorecard SPEC lists first-wave pickup p95, heavy-wait p95, the cancel actor and the replay inputs among the numbers it reports for this goal ("Numbers the scorecard reports"), but its PLAN has no slice that builds any of them: slices 1 to 17 cover the report, partition mapping, refusal attribution, the nightly workflow, journals, fleet reads, terminations, step fields, unit-result timings, the ledger fold and PSI joins. Under SPEC "Stop Conditions" ("cannot report the main verdict rate, first-wave pickup or heavy wait") slice 2 (the replay) stays held, and with it slices 3 and 4, which gate on the replay. This goal builds no second census; the gap is reported to the certainty-scorecard owner.
Source: `Certainty.schemas.ts` and `Certainty.ts` at 7a462a27d4f; goals/certainty-scorecard/SPEC.md ("Numbers the scorecard reports") and PLAN.md (Slices); PR #3144 body ("Report rows that change meaning").

Lane claude/amazing-swirles-67011b

Reverse: When a certainty-scorecard slice adds the missing fields, record a decision naming them and release slice 2 from the stop condition.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
