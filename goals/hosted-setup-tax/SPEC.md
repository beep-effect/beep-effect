# Hosted Setup Tax Spec

## Objective

Remove hosted CI work that is duplicated or pays setup to prove nothing, without changing what any proof
covers. On a code PR run today, generated standards files with no declared coverage owner widen Test Unit to
the full repo, `lint:shadcn` runs in two hosted jobs, Fallow runs in its own job beside Labs, `changeset-graph`
runs twice inside Repo Sanity, the Property Laws sweep has no census proving its test-level selection keeps
every property-executing test, Nix, Security, SAST and PR Size Label each install the JS workspace (or a Bun
toolchain plus a lockfile install) to run a command that does not need it, Codegen, Ecosystem, Nix and IPC take
a runner to decide at step level that they have nothing to do, and Bun runs third-party lifecycle scripts from
its default trust list on every install. This goal removes each of those, one PR-sized slice at a time, each
behind the admission gate the plan sets for it, and proves the result with the certainty scorecard's
runner-minutes per green code run.

The plan's acceptance line: runner-minutes per green code run p50 down by at least 20 against the 264
baseline, measured by the scorecard, with every required context still present and parity ledgers green.
Latency is not this goal's target: almost every lever here moves 0 critical-path minutes (PLAN.md lever rows).

Source exploration: [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md) —
[`BRIEF.md`](../../explorations/ten-minute-certainty/BRIEF.md) (move 4 of the solution sketch),
[`MAP.md`](../../explorations/ten-minute-certainty/MAP.md) (goal 5, its reviewer constraints and gated
candidates), [`DECISIONS.md`](../../explorations/ten-minute-certainty/DECISIONS.md) (D5, D7, D9, D10, D11, D14, D19, D24, D26),
[`research/phase2/PLAN.md`](../../explorations/ten-minute-certainty/research/phase2/PLAN.md) (lever rows and the
cross-area critique).

## Non-Goals

- **No proof-depth reduction presented as efficiency** (BRIEF no-go). Property run floors and seeds, coverage
  floors, the canonical test census, the full canonical corpus replay (no smoke or sampled subset) on every push and on every code PR whose selection includes its owners (D9) and the 15 required
  contexts in `standards/branch-protection-contexts.json` stay as they are. A lever that would need any of them
  changed is out of scope, whatever it saves.
- Coverage Regression, Property Laws and Lint Policy stay on the Yeet mergeable gate; the Fallow advisory
  context keeps gating mergeable after PERIL-01 moves it.
- **Property Laws sharding (HOST-05)** is a gated candidate, not work here: it reopens only if Property Laws
  p95 stays over 10 minutes after the oracle census and the residual file split slice, and the operator
  rules that mergeable contexts bind (D10, D26, D5). The HOST-05 gate is read only after that slice lands.
- Moving Lint Policy to standard hosted runners (rabbit hole: 32 to 36 GiB peaks against 16 GB), the Lint
  Policy diet (LINT-01, LINT-05, LINT-02, LINT-04), Heavy Admission on the pinned binary (PERIH-01) and
  automated pin bumps (PERIH-11): owned by heavy-pool-diet. PERIH-02 strips only the
  shadcn half of the Lint Policy dedupe; the JSDoc half is LINT-05's.
- Caching coverage results or enforcing any cache reuse under the R2 pause (D14); hub `^transit` narrowing
  (TEST-07); file-level test selection as a receipt (TEST-08).
- Main-branch verdicts: the cancel ban and the throughput layout (main-verdict-every-commit); per-SHA main
  groups, now the merge-group run under the gated `merge-queue-activation` candidate in
  `explorations/github-merge-queue` (D28).
- The soundness repairs (ROUT-03 goal-data consumers, ROUT-02 docs-policy job, ROUT-07 classifier differential,
  PERIH-10 base-ref patterns, COVE-02, COVE-03, TEST-10, YEET-08): route-soundness-repair (`ci/route-soundness`).
- The scorecard itself and the route corpus partition mapping (MEAS-01, MEAS-04, ROUT-05): certainty-scorecard
  (`ci/certainty-scorecard`). This goal consumes its numbers.
- Test Unit and Test Integration shard counts, bin packing and Vitest worker counts: `goals/ci-lane-economics`
  (#3040 and #3043 landed there). This goal does not resize partitions.
- Any spend: no larger runner class, no heavy-pool cap above 2, no paid service (D11 defers capacity to the
  operator).
- Plan rows with no goal home (D24). This goal may adopt one only by a new decision file:
  - DEPS-05: `--libc=glibc` install filter (slice a only; scratchpad onnx drop excluded).
  - DEPS-06: filtered-install parity experiment (side workflow only).
  - DEPS-08: retire the baked-AMI Bun fast path, which keys on the lockfile and saves about 1 s.
  - HOST-10: trim proven-unused provisioning in short hosted jobs.
  - PERIH-07: decide Storybook selection before the full install.
  - PERIH-09: scoped installs for administrative workflows.
  - PERIH-12: read-only Vercel deployment census, then a closure-scoped ignoreCommand. #3045 (f651b3bd6db)
    turned off Git-triggered deploys for todox and oip-web and added `.github/workflows/vercel-deploy.yml`:
    production deploys only when Turbo says the app's build is affected since its last ready deployment,
    previews only for PRs that change the app directory. What remains is the read-only census and
    closure-scoped (rather than directory-scoped) previews.
  - TURB-03: classify `turbo.json` edits by effective task-definition change.
  - TURB-07: key root scripts and workspaces only on root tasks; drop root tsconfig from build/check after a
    read trace.
  - TURB-09: ignore Python tool caches in repo-cli and assert that every hashed input is tracked.

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

- `.github/workflows/check.yml`: the Shadcn Lint job (`shadcn-lint`), Repo Sanity (`verify`), PR Size Label
  (`pr-size`), Change Profile outputs (`change-profile`), the Codegen, Ecosystem, Nix Shell and Professional
  Desktop IPC Stdio jobs, Labs, Fallow Advisory Envelopes (`fallow-advisory`), Security, SAST, the Test Plan
  job and the Property Laws slices.
- `.github/workflows/heavy.yml`: only if a slice changes a heavy-lane input (two-PR rule below).
- `.github/actions/setup-monorepo-ci/action.yml`, `.github/actions/setup-bun/action.yml`,
  `.github/actions/fetch-beep-ci/action.yml`: the install and binary steps the removals bypass.
- `packages/tooling/tool/cli` (`@beep/repo-cli`):
  - `src/commands/Quality/internal/CoverageScope.ts`: owner rows for generated standards inventories (TURB-01).
  - `src/commands/Quality/Tasks.ts`: the hosted Lint Policy plan (`policyStateTasks`, PERIH-02).
  - `src/commands/Ci/CiLane.ts` (lane bodies: `repo-sanity`, `shadcn-lint`, `nix`, `sast`, `security`;
    the partition plan) and `src/commands/Ci/CiLanePartitions.ts`.
  - `src/commands/Quality/internal/GithubChecks.ts` (the `repo-sanity:changeset-graph` lane, PERIL-04).
  - `src/commands/Ci/CiOperational.patterns.json` and `CiOperational.schemas.ts` (lane-relevance keys, PERIH-04).
  - `src/commands/Ci/RouteFootprints.ts`, `RouteCensus.ts` (lane rows that change when a job folds or retires).
  - `src/commands/Yeet/internal/WaveOrder.ts`, `GhOps.ts`, `GateTable.ts` (the Fallow check-run read).
  - Tests under `packages/tooling/tool/cli/test/`, among them `ci-lane.test.ts`, `quality-tasks.test.ts`,
    `labs-ceremony-scoping.test.ts`, `ci-runner-security.test.ts`, `ci-docs-job-admission.test.ts`,
    `changeset-graph.test.ts`.
- `packages/tooling/test-kit/fc-runs` (`@beep/fc-runs`): `src/PropertySelection.ts` and its tests, plus
  `vitest.property-runner.ts` and `vitest.shared.ts` at the root (TEST-01 census and residual file split).
- Root `package.json` (`trustedDependencies`, DEPS-01) and `scripts/cloud/bootstrap.sh` (its trust-list comment).
- `standards/policy-tools.fingerprint.json` (reseal when `CoverageScope.ts` or another fingerprinted file
  changes) and `standards/cache-qualification-baseline.json` (re-record on any global-input PR).
- This packet (`goals/hosted-setup-tax/`).

No new workspace package is planned.

## Levers

Status is from the lever check of 2026-11-09 against `origin/main` 6eb2e0588e2, re-checked at c90929b1ff1 and at 5e09d90a6da (evidence in
[`decisions/`](./decisions/) and [`research/SOURCES.md`](./research/SOURCES.md)).

| Id | What | Status | Admission gate before landing | Depends on |
| --- | --- | --- | --- | --- |
| TURB-01 | Owner rows in `CoverageScope.ts` for generated standards inventories (instrumentation catalog, JSDoc and schema-first inventories, policy fingerprint, cache-qualification baseline, `fallow.boundaries.generated.jsonc`) so they stop forcing a full Test Unit fallback | slice 1 merged as #3063 (b757bd0400f): before it, rows at `CoverageScope.ts:76-98` covered none of them and `:772` returned "no current workspace owner"; now `COVERAGE_GENERATED_STANDARDS_OWNER_ROWS` with a reader scan and live drift check (decision file); replay: 67 of 727 first-parent commits shrink (`research/turb-01/REPLAY.md`); slice 2 (scorecard conversion share) open | Per-file planner fixtures select exactly the scanned readers; an unmapped standards file still returns full; an in-repo first-parent replay shrinks only commits whose sole full trigger is a mapped file; a token- and segment-aware reader drift check proven by a seeded `path.join` fixture; policy fingerprint resealed | ROUT-05 (soft, corpus) |
| TEST-01 | Property sweep runs only property-executing tests, then an oracle-checked census | partly landed: #3030 (f818c6e52bf) test-level selection; #3056 (741b1492b2a) runs the sweep as four slices, two of them Vitest shards of repo-cli (decision file); open: the oracle census, then a file split where the census and its per-file collection and hook timings show module-scope or hook cost still dominating (D26) | Old and new oracle logs identical in (file, test, runs, seed) on 3 heads, with per-file collection and hook time recorded; `passWithNoTests` override; fixtures for module-scope `fcRuns`, props without `fcRuns`, renamed tests; the split slice records its outcome (files split, or none qualifies) in a decision file | none |
| PERIL-01 | Fold the Fallow advisory envelopes into Labs after its coverage body | open: standalone `fallow-advisory` job; Labs has `contents: read` only | Shadow on a draft PR for at least 10 runs with matching envelope fields; seeded finding gives a failed check run and the merge gate refuses the PR; a check-run post without `checks: write` is visible; a Labs failure still posts; Coverage Regression green with a red Fallow step; RouteCensus keeps a Fallow row | PERIH-04 |
| PERIH-02 | One hosted `lint:shadcn` owner in required Repo Sanity; retire Shadcn Lint; drop it from the hosted Lint Policy plan | merged as #3117 (10ed12d4410): the `shadcn-lint` job and its case arm left `check.yml`, the CiLane `shadcn-lint` lane retired, `lint:shadcn` left `policyStateTasks` (was `Tasks.ts:3709`) and runs as the `ci:repo-sanity:shadcn` step of the `repo-sanity` lane body; `ci-repo-sanity-owners.test.ts` holds one owner and the no-masking property | Planted violation turns Repo Sanity red on PR and push, green when removed; a unit test asserts exactly one hosted owner; an earlier Repo Sanity failure cannot mask the step | none |
| PERIH-04 | Job-level lane-relevance skips for Codegen, Ecosystem, Nix and IPC from Change Profile outputs (Labs excluded) | open: Change Profile outputs only `docs_only` and `goals_only`; the four lanes gate at step level | Offline replay of historical PR heads: zero heads where the old gate runs and the new one skips; push events emit all-true; an old-binary/new-workflow fixture shows guards written `!= 'false'` still run the lane | PERIH-11, PERIH-10 (route-soundness-repair), ROUT-07 |
| PERIH-05 | Run Nix Shell without installing the JS workspace | open: `nix` job runs `setup-monorepo-ci` when its lane gate passes | Green on its own PR; a broken-flake mutation turns it red; an argv drift test against the CiLane nix steps (including `--option warn-dirty false`); the `ci-runner-security` assertion updated | none |
| PERIH-06 | Security and SAST dispatch without the workspace install, with a head fallback on mismatch | open: both jobs run `bun install --frozen-lockfile --ignore-scripts` | Parity ledger of argv and env, red exits, fixture exclusions and a planted Semgrep finding; head-install fallback on any compatibility mismatch | PERIH-11, PERIH-10 (slice 2) |
| HOST-09 | Fold PR Size Label into Change Profile (plus the PR Build A/B; rerun slice deferred) | open: `pr-size` job installs the workspace to run `beep ci pr-size`; the pinned binary's bootstrap command set has no `pr-size`, so the fold is CLI, pin bump, then workflow switch | Label-set parity; the reviewer failure-injection fixture; Build A/B with peak RSS on 5 hub-touching heads | PERIH-11, PERIH-10 |
| DEPS-01 | Explicit `trustedDependencies` allowlist with a lifecycle-script census guard | open: root `package.json` declares none | Two-head A/B over at least 2 to 3 paired runs: identical census and verdicts, `bun pm untrusted` equals the deny set; the guard reads installed `package.json` scripts, not `bun.lock` `hasInstallScript`; coverage-floor freeze planned | none |
| PERIL-04 | Run `changeset-graph` once in Repo Sanity | merged as #3117 (10ed12d4410): the CiLane `repo-sanity` body step (was `CiLane.ts:1973`) is removed; the `GithubChecks.ts:577-581` `repo-sanity:changeset-graph` lane, which the body runs through `audit:github repo-sanity`, is the one execution (plan-label test in `ci-repo-sanity-owners.test.ts`) | A plan-label test shows one execution; a corrupt `.changeset` fixture stays red | none |
| ROUT-01 | Skip empty Test Unit and Test Integration partitions before setup (merges HOST-07) | landed: #3030 Test Plan job; residual is the after-the-fact gate and the measurement | Replay of the plan against hosted logs; mutation fixtures force the full lane on partition, scope and `turbo.json` edits; empty partitions still seal a manifest; push events plan everything | ROUT-07 (for the residual) |

## Constraints

- **Reviewer constraints (MAP.md, CodeRabbit on #3017, 2026-11-09), binding in full:**
  - **HOST-09:** the label write must never sit on the `Change Profile -> Test Unit / Heavy Admission`
    dependency path. Keep it a separate non-blocking step or job that fails open, so a label API failure cannot
    hold required checks. Label failures are reported on their own (a dedicated step summary line and a
    `label_failed` output, never the job's exit status), and the slice ships a failure-injection gate: a fixture
    that makes the label API call fail must still show Change Profile green, Test Unit and Heavy Admission
    scheduled, and the failure visible in the report.
  - **PERIH-04:** Labs is excluded from the gate. On non-docs PRs Labs produces coverage for transitive
    dependents or an empty manifest that Coverage Regression requires from a successful producer; skipping the
    job would leave the comparator without it.
  - **PERIL-01:** fork PR tokens are read-only and Labs has `contents: read` only, so the folded step cannot
    publish a commit status for fork runs, and commit statuses have no `skipped` state. The host job must carry
    `checks: write`, because a step can only create a check run through the Checks API (and `statuses: write` as
    well only if a commit status is also posted); Labs runs with `contents: read` today, for same-repository PRs
    too, and no workflow declares `checks: write`. The standalone Fallow job stays whenever publication is
    unavailable: fork PRs, or any host job lacking the needed permission. The folded step must produce a check
    run, not only a commit status: Yeet's merge gate reads check runs
    (`packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts`) and `GateTable.ts` reports a failed status
    without holding `GATE-MET`, so a status alone would weaken the gate; the seeded-failure fixture must show the
    merge gate refusing the PR. Only then may the standalone job be removed.
- **Exactly one hosted owner of `lint:shadcn`** (critique, Conflicts). PERIH-02 owns the decision; HOST-03,
  HOST-09 and LINT-05 carry no shadcn half. The PERIH-02 slice adds the unit test asserting one owner across
  the `check.yml` jobs and the hosted Lint Policy plan. `//#lint:shadcn` is `cache: false` and runs nowhere
  else, so removing both copies would be a proof-depth loss.
- **Fallow fold placement** (critique, Conflicts): the host is a job no lever skips at job level. Labs qualifies
  only because PERIH-04 excludes it; PERIL-01 lands after PERIH-04 and HOST-09 have settled job-level `if`s.
  The Fallow step runs strictly after the coverage body with `continue-on-error`, so a Fallow red never turns
  Coverage Regression red (it authenticates that the latest Labs execution succeeded). Re-evaluate if Coverage
  Regression ever becomes required (D6 option A).
- **ROUT-01 and HOST-07 are one lever.** Measured empty-leg value is about 2.8 to 4 runner-min per run, not 9
  to 11; credit it once (critique, Double counting). The Test Plan job's own setup, which the exploration did not
  measure, is netted against it in the scorecard; the plan's net of -2 to +2 runner-min per run was costed for
  a per-shard pre-install plan, not for #3030's single Test Plan job.
- **PERIH-04 guards are written `!= 'false'`** with an old-binary/new-workflow fixture, and follow the CI binary
  chain: heavy-pool-diet's closure-digest builds and pin-bump PRs (PERIH-11), then route-soundness-repair's
  base-ref patterns (PERIH-10). Each binary change is three PRs: CLI, pin bump, then the workflow switch.
  A guard written `== 'true'` against a binary that predates the new keys would skip required Codegen, Nix
  and IPC on every PR and on main.
- **Property Laws layout (D26, #3056).** #3030 ran Property Laws as two Turbo-filter slices (repo-cli, rest),
  accepted by D26 ahead of D10's order. Since #3056 (741b1492b2a, ci-lane-economics) it runs as four slices
  under the same aggregate: `repo-cli-1` and `repo-cli-2` (two Vitest shards of the repo-cli sweep),
  `foundation-drivers` and `rest`. This goal accepts that layout as landed and does not revert it (decision
  file). D10's order still binds what follows: no further Property Laws shard or slice lands unless p95 stays
  over 10 minutes after the oracle census and the residual file split slice, and the census joins its log
  across all four slices. A return to fewer slices is ci-lane-economics' recorded reversal, which this goal
  may ask for by a decision file.
- **Narrowing waits on soundness.** ROUT-01's residual and PERIH-04 are route narrowing: neither lands (or, for
  ROUT-01, is declared done) before route-soundness-repair's classifier differential (ROUT-07) reports zero
  unadmitted disagreements for the classifiers they read.
- **Global inputs freeze coverage rows.** Any PR touching `turbo.json`, `bun.lock`, root `package.json` or a
  workflow file freezes coverage floors at base and escalates to a full matrix; re-record
  `standards/cache-qualification-baseline.json` in the same PR, plan the S11 path, and batch such changes so
  the packet pays for as few full-matrix runs as possible. DEPS-01 and every `check.yml` slice are global-input
  PRs.
- **`heavy.yml` is called at `@main`.** A change to a hosted heavy-lane input is two PRs: the first additive
  under a migration name, the second retiring it after `main` resolves.
- **Every CI-YAML slice names a tested revert** in its PR body and decision file (critique, Missing from the
  plan). The orchestrator App token cannot merge workflow PRs; plan the merge identity for each `check.yml` PR.
- **Job-removing before job-adding** (D19, D28, MAP.md sequencing item 3): the job-removing levers
  (PERIH-02, ROUT-01, PERIH-04, HOST-09's PR Size fold, PERIL-01) land ahead of the gated `merge-group-parity`
  candidate in `explorations/github-merge-queue`, which waits on this goal, route-soundness-repair and
  heavy-pool-diet merging. Each removal is recorded as a checkpoint in PLAN.md so that candidate's owner can
  read it.
- **Lane ordering since #3046.** Repo Sanity, Codegen, Ecosystem, Shadcn Lint, Labs, the Lint shards, IPC,
  the Property Laws slices, Fallow, JSDoc Ratchet and Nix have always needed Change Profile; #3046 added
  `test-plan` and `admission` to their `needs` plus the explicit `needs.change-profile.result == 'success'`
  term. Change Profile therefore gates these eleven non-test lanes, not only Test Unit and Heavy Admission
  (Commitlint, Secret Scanning, Security, SAST and PR Size Label do not need it). HOST-09's label write must stay out of the
  Change Profile job's result (a separate job that needs Change Profile, or a `continue-on-error` step whose
  failure is reported through `label_failed`), or a label API failure would skip eleven lanes. PERIH-04's
  relevance guards join the existing job-level `if`s of those lanes and must keep the `!cancelled()` and
  Change Profile success terms.
- **Required-context names never change.** Retiring Shadcn Lint, PR Size Label and (eventually) Fallow Advisory
  Envelopes removes non-required jobs only; Codegen Drift, Nix Shell, Professional Desktop IPC Stdio, Security
  and SAST stay present on every head, skipped jobs included.
- **Ownership with other goals.** `goals/ci-lane-economics` owns the Test Unit and Test Integration
  partition layout (#3030, #3040, #3043); ROUT-01's residual and TEST-01's census do not change shard counts. The
  four-slice Property Laws layout of #3056 is accepted landed state; its reversal is ci-lane-economics'. `goals/yeet-monitor-app-identity` owns
  `.github/workflows/rerun-runner-loss.yml` and `CiRerunRunnerLoss.ts`; HOST-09's rerun slice waits for it.
  heavy-pool-diet owns the Lint Policy plan's JSDoc and knowledge-doctor tasks in `Tasks.ts`; PERIH-02 touches
  only the `lint:shadcn` entry and merges `main` after any heavy-pool-diet change to the same list.
  `goals/turborepo-quality-cache-adoption` is paused (R2); no slice here requests a cache-policy re-record
  beyond the qualification baseline a global-input PR must carry.
- **Shared generated files.** #3038, #3039, #3040, #3041, #3043, #3045, #3046 and #3056 have merged and are
  part of the base (checked at 5e09d90a6da). A slice that reseals the policy fingerprint or re-records the
  cache-qualification baseline while another PR touches them merges `origin/main` and reseals or re-records,
  never hand-merging generated files.
- **Numbers carry their caveats.** TURB-01's "15-19% of PR runs" is from a replay that is not a repo artifact;
  the skeptic's sample says about 8% fully convert, and the 727-commit corpus must be rebuilt in-repo before
  the replay gate can run. DEPS-01's "4-12 s per job" is a confounded cross-job comparison (within one run
  25.97 s and 23.41 s did not differ); book it near zero until its A/B. Weekly figures are censored until the
  scorecard's journals and cohorts land.
- Packet rule: at most three open PRs across this packet's lanes. Repo-cli tests must pass on Node and Bun.
  Schema first, then `Context.Service`, then implementation for any new CLI surface (Effect v4 only).

## Acceptance Criteria

- [ ] **Runner-minutes.** Over a 7-day certainty-scorecard cohort of green code heads, runner-minutes per run
      p50 is at most 244 (down by at least 20 from the 264 baseline) as the scorecard reports it, with p95
      reported beside it (baseline 556), and the per-lever attribution (plan dedup order, each lever once)
      reports each of this goal's levers' minutes once, in the plan's dedup order. Minutes from #3028, #3029,
      #3030, #3040, #3043, #3046 and sibling goals are reported separately and never counted toward this goal. A scorecard
      re-baseline taken before this goal's first workflow slice merges is also reported.
- [ ] **Required contexts present.** On every code head in that cohort all 15 contexts in
      `standards/branch-protection-contexts.json` report a conclusion (a job-level skip counts only where the
      lane's relevance output was `false`), and `bun run beep ci ruleset --check` passes.
- [ ] **Parity ledgers green.** HOST-09 label-set parity, PERIH-06 Security/SAST dispatch parity, DEPS-01
      install census and verdict parity, PERIL-01 envelope-field shadow (10 runs) and the TEST-01 oracle log
      parity on 3 heads are recorded under `history/` with zero unexplained mismatches.
- [ ] **No proof depth lost.** No property run floor or seed, coverage floor, census entry or required context
      is lowered or removed; the full canonical corpus replay (no smoke or sampled subset) runs on every push
      and on every code PR whose selection includes its owners, and no lever here removes a replay partition
      from a plan that selects it.
- [ ] TURB-01: the planner fixtures, the in-repo replay and the seeded `path.join` drift fixture pass; the
      scorecard reports the share of PR runs that convert from a full to an owner-scoped Test Unit selection.
- [ ] PERIH-02: one hosted owner of `lint:shadcn` (unit test), and a planted violation turns Repo Sanity red.
- [ ] PERIL-01: the seeded Fallow finding produces a failed check run and the Yeet merge gate refuses the PR;
      the standalone job remains for fork PRs.
- [ ] HOST-09: the failure-injection fixture shows Change Profile green, Test Unit and Heavy Admission
      scheduled and `label_failed` visible; the PR Size Label job is gone.
- [ ] PERIH-04: the offline replay shows zero heads where the old gate runs and the new one skips, and the
      old-binary/new-workflow fixture runs every lane.
- [ ] PERIH-05, PERIH-06, PERIL-04: their mutation fixtures (broken flake, planted Semgrep finding, corrupt
      `.changeset`) stay red after the install or duplicate is removed.
- [ ] ROUT-01 and TEST-01 residuals: the hosted-log replay and mutation fixtures for the Test Plan, and the
      oracle census tripwire, land; the residual file split slice lands with its outcome recorded in a decision
      file (files split, or none qualifies); the scorecard reports empty-leg minutes and Property Laws p95, and
      HOST-05's gate is read only after the split slice.
- [ ] Every CI-YAML slice merged with a named, tested revert.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/hosted-setup-tax/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/hosted-setup-tax/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/hosted-setup-tax` | Passes |
| Decision log | `bun run beep goals decisions check --slug hosted-setup-tax` | No drift |
| CLI package | `bun run beep quality package-verify @beep/repo-cli` | Passes |
| Property selection package | `bun run beep quality package-verify @beep/fc-runs` | Passes |
| Lane, plan and scope tests (Node) | `bunx vitest run packages/tooling/tool/cli/test/ci-lane.test.ts packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/labs-ceremony-scoping.test.ts packages/tooling/tool/cli/test/ci-runner-security.test.ts packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts packages/tooling/tool/cli/test/changeset-graph.test.ts` plus each slice's new test file | Passes |
| Lane, plan and scope tests (Bun) | `cd packages/tooling/tool/cli && bunx --bun vitest run test/ci-lane.test.ts test/quality-tasks.test.ts test/labs-ceremony-scoping.test.ts test/ci-runner-security.test.ts test/ci-docs-job-admission.test.ts test/changeset-graph.test.ts` | Passes |
| Property selection tests | `bunx vitest run packages/tooling/test-kit/fc-runs/test/PropertySelection.test.ts` | Passes |
| Workflow policy | `bun run beep ci workflow-lint` | Passes on every `check.yml` slice |
| Ruleset contexts | `bun run beep ci ruleset --check` | No drift |
| Policy seal | `bun run beep lint policy-fingerprint --check` | Passes after each reseal |
| Partition plan | `bun run beep ci partitions rebalance --check`; `bun run beep ci lane test-unit --partition repo-cli-1 --dry-run` | Passes; plan unchanged by this goal |
| Route replay | `bun run beep ci route replay` over the certainty-scorecard corpus | No recall loss on any slice that changes selection |
| Hosted timings | `bun run beep ci lane-timings` on the slice's PR runs | Recorded with the parity ledger |
| Final gate | `bun run beep yeet final-check` | Passing receipt for each PR head |
| Acceptance number | certainty-scorecard report, 7-day code-head cohort | p50 at most 244 runner-min, contexts present |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A lever's gate can only pass by lowering a floor, a seed, a census entry, the corpus replay or a required
  context: drop the lever and record why, never land it.
- The scorecard is not yet producing runner-minutes per green code head: slices may land, but the acceptance
  criterion is not claimed and the goal does not close.
- ROUT-07 reports an unadmitted disagreement in a classifier PERIH-04 or the Test Plan reads: hold PERIH-04 and
  report to route-soundness-repair.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add hosted-setup-tax --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug hosted-setup-tax`; add a `kind: decision` file there, never edit this block._

### Acceptance reads the 264 baseline as stated, with a post-#3030 re-baseline and per-lever attribution beside it, 2026-11-09

The plan's 264 runner-min p50 per green code head was measured on 2026-11-09 before #3028, #3029, #3030, #3040, #3043 and #3046 changed the Test Unit and Test Integration layout, and the plan's 20 to 40 projection includes heavy-pool-diet's LINT levers. Acceptance stays as written (p50 at most 244 against 264, measured by the certainty scorecard), with no separate per-goal minute threshold. Beside it the goal reports each of its levers' minutes once, in the plan's dedup order; minutes from #3028, #3029, #3030, #3040, #3043, #3046 and sibling goals are reported separately and never counted toward this goal; and a scorecard re-baseline taken before its first workflow slice merges is also reported. Rejected: replace 264 with the re-baseline (would change the approved acceptance line); invent a per-goal minute threshold (no packet file quantifies one); count #3030 or heavy-pool-diet minutes as this goal's in the attribution.
Source: this goal's reading of `explorations/ten-minute-certainty/research/phase2/PLAN.md` (operator numbers table, How to state the projection) against commits dbaf55668cb, 8c902a15b26, f818c6e52bf, 694c91bbf9d, 08972a39a16 and c90929b1ff1.

Reverse: Replace the acceptance number by a new decision that names a scorecard re-baseline as the reference, if the operator rules the pre-#3030 baseline is no longer meaningful.

### The full canonical corpus replay stays on every push and every code PR that selects its owners; no lever here may shrink it, 2026-11-09

Test Integration replays the full canonical citation corpus (no smoke or sampled subset) at the real 30 s extractDeadline on every push and on every code PR whose selection includes its owners, and it is the only production-deadline witness. No lever in this goal (empty-leg skips under ROUT-01, lane-relevance skips under PERIH-04, setup removals) may drop, sample or narrow that replay: a partition that carries a replay test is always planned when its owners are selected, and int-rest is always planned. Rejected: smoke per PR plus full on main or nightly (with a 13% main verdict rate a deadline regression could reach main undetected). TEST-03 stays dropped.
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D9).

Reverse: Only a new exploration ruling after main verdicts reach at least 95% (D7) may move the replay to smoke-per-PR plus full on main; this goal would then record the change as a new decision.

### HOST-09 here is the PR Size fold and the PR Build A/B; the rerun-runner-loss slice waits for yeet-monitor-app-identity, 2026-11-09

HOST-09 has three slices. The PR Size fold into Change Profile is the minute saving (about 600 to 1,000 runner-min/week) and lands here under the reviewer constraint. The PR Build hosted-runner A/B is measurement only and lands here as a draft experiment. Running Rerun Runner Loss from the CI binary bills about 0 and edits .github/workflows/rerun-runner-loss.yml and CiRerunRunnerLoss.ts, which goals/yeet-monitor-app-identity is widening; that slice waits until that goal's rerun change merges, so the two goals never hold the same file at once. Rejected: three HOST-09 slices in parallel (file conflict with a sibling goal for no billed saving).
Source: this goal's check of goals/yeet-monitor-app-identity/SPEC.md target surfaces and `explorations/ten-minute-certainty/research/phase2/PLAN.md` (HOST-09).

Reverse: Take the rerun-runner-loss-from-binary slice into this goal by a new decision once yeet-monitor-app-identity has merged its rerun widening.

### Job-removing before job-adding: this goal's removals land ahead of merge-group-parity, 2026-11-09

Every lever that adds hosted jobs or legs draws on the same unverified ceiling of about 60 concurrent hosted jobs; #3046 puts a full Check run at about 75 hosted jobs. The job-removing levers in this goal (PERIH-02 Shadcn Lint retired, ROUT-01 empty legs, PERIH-04 lane-relevance skips, HOST-09's PR Size fold, PERIL-01 Fallow folded) land ahead of the gated merge-group-parity candidate in explorations/github-merge-queue, which per D28 and that packet's sequencing ruling waits on this goal, route-soundness-repair and heavy-pool-diet merging; per-SHA main groups are no longer built by main-verdict-every-commit. Each removal is recorded as a PLAN.md checkpoint so that candidate's owner can read it. The packet keeps at most three open PRs at once. The order is MAP.md sequencing item 3 under the D19 appetite; D19 also opens TURB-01 slice 1 now. Rejected: add the merge-group run first (more jobs per main commit against the ceiling regress PR p95 in merge bursts).
Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D19 order: job-removing before job-adding; D28 for the merge-group placement; D7 for the PR-p95 rationale) and `explorations/ten-minute-certainty/MAP.md` (sequencing item 3).

Reverse: Drop the ordering constraint by a new decision if the scorecard measures the hosted concurrent-job ceiling and shows headroom for the merge-group run without these removals.

### Property Laws: census and the residual file split first; sharding stays a gated candidate, 2026-11-09

D10 orders the file split first with a census tripwire; D26 records that #3030's test-level selection already does the split's job at test grain and keeps D10 binding for what follows. In this goal the oracle census lands first, then the file split wherever the census and its per-file collection and hook timings show module-scope or hook cost still dominating, with its outcome recorded either way. Sharding the repo-cli sweep (HOST-05, +6 to +10 runner-min per run for about 3.4 min off the mergeable tail) is not work here: no further Property Laws shard lands unless p95 stays over 10 minutes after the census and the split slice, and then only with a ruling that mergeable contexts bind (D5). Rejected: shard now (compute for a tail-only latency gain); stop Yeet waiting on Property Laws (a property red would no longer hold merges). Run floors and seeds are unchanged.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D10, D26).

Reverse: Open HOST-05 as its own lever by a new decision once Property Laws p95 is measured over 10 minutes after the census and the residual file split slice, and the operator rules that mergeable contexts bind.

### Reviewer constraints bind HOST-09, PERIH-04 and PERIL-01, 2026-11-09

HOST-09: the PR size label write never sits on the Change Profile to Test Unit / Heavy Admission dependency path; it is a separate non-blocking step or job that fails open, reports a failure through its own step summary line and a label_failed output (never the job exit status), and ships a failure-injection fixture showing Change Profile green, Test Unit and Heavy Admission scheduled and the failure visible. PERIH-04: Labs is excluded, because Coverage Regression requires its manifest from a successful producer. PERIL-01: the Fallow host job carries checks: write (statuses: write only if a commit status is also posted) and creates a check run, not only a commit status; the standalone Fallow job stays wherever publication is unavailable (fork PRs, any host without the permission); a seeded-failure fixture shows the Yeet merge gate refusing the PR before the standalone job is removed. Rejected: a status-only Fallow fold (GateTable reports a failed status without holding GATE-MET).
Source: exploration `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints, CodeRabbit on #3017, 2026-11-09).

Reverse: Lift a constraint only by a new decision that cites a replacement proof (for example a merge gate that reads commit statuses as holding) and keeps its failure-injection or seeded-failure fixture.

### ROUT-01 empty-leg skips landed in #3030; this goal keeps only the admission evidence and the measurement, 2026-11-09

#3030 added the Test Plan job to check.yml: a push publishes every Test Unit and Test Integration partition, a pull request only those with selected tasks; each allocated partition re-derives the plan and fails with unplanned-partition when one is missing, Coverage Regression requires a manifest from every partition with expected owners, and both aggregates fail on a failed or malformed plan. The integration partitions moved from heavy.yml to check.yml in #3005, so ROUT-01's heavy.yml slice is moot. The residual kept here is the gate the plan set before landing, applied after the fact: a replay of the plan against hosted logs, mutation fixtures showing partition, scope and turbo.json edits force the full lane, and ROUT-07's differential over the plan's classifier; plus the scorecard measurement (gross 2.8 to 4 runner-min per run in empty legs; the plan's net of -2 to +2 runner-min per run was costed for a per-shard pre-install plan in which each non-empty shard pays 5 to 20 s, so the net of #3030's single Test Plan job is unmeasured and the scorecard measures it). The plan job installs the workspace; moving it to the pinned binary is not planned unless the scorecard shows a positive net.
Source: this goal's lever check of commit f818c6e52bf (.github/workflows/check.yml Test Plan job) and `explorations/ten-minute-certainty/research/phase2/PLAN.md` (ROUT-01).

Reverse: Take the full ROUT-01 lever back into this goal by a new decision (for example, moving the Test Plan job to the pinned binary) if the hosted-log replay or ROUT-07's differential shows the #3030 plan unsound; reverting #3030 itself is ci-lane-economics' decision.

### One hosted lint:shadcn owner in required Repo Sanity makes shadcn findings merge-blocking, 2026-11-09

PERIH-02 retires the non-required Shadcn Lint job, runs lint:shadcn inside the required Repo Sanity lane and removes it from the hosted Lint Policy plan (policyStateTasks in Tasks.ts), so exactly one hosted job runs it. Repo Sanity is a required context, so a shadcn finding now blocks merges instead of showing a red non-required check. A unit test asserts exactly one hosted owner of lint:shadcn across check.yml jobs and the hosted Lint Policy plan, so no later dedupe (HOST-03, LINT-05) can leave zero owners. Rejected: keep the Shadcn Lint job and drop the Lint Policy copy (keeps 60 to 70 s of setup per run); drop both copies (//#lint:shadcn is cache:false and runs nowhere else, a proof-depth loss).
Source: `explorations/ten-minute-certainty/research/phase2/PLAN.md` (PERIH-02 row and Cross-area critique, Conflicts).

Reverse: Restore the Shadcn Lint job in check.yml and its lane arm, and remove the lint:shadcn step from Repo Sanity, in one PR.

### TEST-01 is partly landed by #3030; the oracle census comes next, then a file split where it still pays, 2026-11-09

#3030 (f818c6e52bf) made the deep sweep skip provably plain tests at collection time: PropertySelection.ts in packages/tooling/test-kit/fc-runs and vitest.property-runner.ts skip a plain it or it.effect registration in a file whose import graph never runs a property inline. That does the file split's job at test grain, so no single-property file is split unconditionally. TEST-01's remainder, in order: the oracle-checked census as the tripwire (old and new oracle logs identical in file, test, runs and seed on three heads, with per-file collection and hook time recorded; fixtures for module-scope fcRuns, props without fcRuns, renamed tests; a passWithNoTests override), then a file split wherever the census and its per-file collection and hook timings show module-scope or hook cost still dominating a property file. That split slice records its outcome either way (the files split, or a finding that none qualifies) in a decision file. #3030 also runs the hosted lane as two Turbo-filter slices (repo-cli, rest) under one Property Laws aggregate. D26 accepts that layout as landed, ahead of D10's order; this goal owns any decision that returns Property Laws to one slice. No further shard lands unless Property Laws p95 stays over 10 minutes after the census and the split slice, and the HOST-05 gate is read only then.

Source: exploration `explorations/ten-minute-certainty/DECISIONS.md` (D26, D10); this goal's lever check of commit f818c6e52bf.

Reverse: Return Property Laws to one slice, or revert the #3030 selection to file-level selection, by a new decision in this goal if the census shows the selection or the two-slice layout unsound.

### lint:shadcn runs as a Repo Sanity lane-body step and changeset-graph runs once through the repo-sanity collector, 2026-11-10

PERIH-02 places `lint:shadcn` as the `ci:repo-sanity:shadcn` step of the CiLane `repo-sanity` body (uncached root task, `turbo run lint:shadcn --summarize`), retires the `shadcn-lint` job and its case arm in `check.yml` and the `shadcn-lint` CiLane id, and drops the task from `policyStateTasks`. The body runs through one collecting step group (`runQualityTaskStreamingStepGroup`), so every step runs and the group fails with all reds: an earlier Repo Sanity red cannot hide a shadcn finding. A pre-push lane in `githubCheckRepoSanityLanes` was rejected: hosted Repo Sanity also runs that collector through `audit:github repo-sanity`, whose default fail-fast policy would let an earlier precise red skip the lane, and the body step would then be a second hosted copy. `yeet final-check` replays the body through `ci lane repo-sanity`, so the step keeps a local replay; on the `worker` profile final-check narrows Repo Sanity to changeset status and hosted CI proves the step. Repo Sanity also runs on docs-only (non-goals) diffs, where the retired job skipped; the walk takes about 11 s locally and is accepted.

PERIL-04 removes the `ci:repo-sanity:changeset-graph` body step. The body's `audit:github repo-sanity` step runs `githubCheckRepoSanityLanes`, whose first lane is `repo-sanity:changeset-graph` (`bun run beep quality changeset-graph`), so that lane is the single execution on hosted CI and the only local graph check. Its corrupt `.changeset` cases stay red in `changeset-graph.test.ts`.

Gates: `ci-repo-sanity-owners.test.ts` asserts exactly one hosted owner (`check.yml#verify` on pull requests and pushes) across every `check.yml` job's lane body and `run:` scripts and the hosted Lint Policy plan in full and changed scope, replays the real body with every earlier step red and proves the shadcn step still ran, and plans `changeset-graph` once. A planted `bg-zinc-100` in `packages/foundation/ui-system/ui/src` turned `turbo run lint:shadcn` red (no-raw-colors) and green once removed; the PR's first push carries the same plant for the hosted red. This is a global-input PR (workflow file): the full matrix runs and coverage rows freeze at base. `standards/cache-qualification-baseline.json` records task configuration, which this diff does not change (`beep quality cache-policy`: 0 blocking findings), so its re-record writes nothing. Merge identity: the orchestrator App token cannot merge workflow PRs, so this lane merges with the operator's `gh` identity.

Lane claude/relaxed-wu-e85a5e

Reverse: Revert this PR: it restores the Shadcn Lint job and its check.yml case arm, the shadcn-lint CiLane lane, lint:shadcn in policyStateTasks and the CiLane repo-sanity changeset-graph step, and removes the ci:repo-sanity:shadcn step; ci-repo-sanity-owners.test.ts then fails until it is reverted with them.

### #3056 landed four Property Laws slices; this goal accepts the layout and keeps D10's order for everything after it, 2026-11-10

#3056 (741b1492b2a, ci-lane-economics, 2026-11-10) replaced the two Turbo-filter slices that D26 accepted with four: `repo-cli-1` and `repo-cli-2` are the two Vitest shards (`--shard 1/2`, `--shard 2/2`) of the @beep/repo-cli sweep, `foundation-drivers` takes `./packages/foundation/**` and `./packages/drivers/**`, and `rest` takes every other package, by complementary filters under the unchanged Property Laws aggregate. The shards now wait on Change Profile and Test Plan instead of Heavy Admission. The cause was latency: as two slices, repo-cli ran 5.7 to 7.9 min and a full rest 8.0 to 9.5 min, so one slow runner put the verdict past ten minutes. Run floors and seeds did not change.

This goes further than D26, and splitting the repo-cli sweep into two Vitest shards is the shape HOST-05 described, landed before the oracle census and the residual file split that D10 put first. This goal does not revert it: the layout is ci-lane-economics' landed state and its reversal is recorded there. D10's order still binds what follows. No further Property Laws shard or slice lands before the oracle census and the residual file split slice, and HOST-05 is read as the gate for any shard beyond these four, still only after the split slice and with the D5 ruling. The census slice must now join its (file, test, runs, seed) log across all four slices and prove the union equals the full sweep with no test in two slices, including the Vitest shard boundary inside repo-cli. The p95 that the HOST-05 gate reads is the aggregate's, over the four-slice layout.

Rejected: revert to two slices (undoes a measured latency fix owned by another goal for no proof gain); treat HOST-05 as done (the census aggregate it required has not landed).

Source: commit 741b1492b2a (`.github/workflows/check.yml` Property Laws matrix, `CiLane.ts` lane filters and `--shard`), `goals/ci-lane-economics/decisions/2026-11-10-split-property-laws-into-four-slices-and-create-them-with-the-test-shards.md`; exploration `explorations/ten-minute-certainty/DECISIONS.md` (D10, D26).

Lane feat/turb-01-standards-coverage-owners

Reverse: Return Property Laws to two slices by ci-lane-economics' recorded reversal (restore the [repo-cli, rest] matrix and its two filters); this goal may ask for it by a new decision if the census shows the four-slice layout loses or duplicates a property-executing test.

### TURB-01 slice 1: generated standards files get owner rows that a reader scan derives and a live drift check holds, 2026-11-10

Six generated standards paths fell through to the `no current workspace owner` fallback in `CoverageScope.ts` (rows at `:76-98`, fallback at `:772` on 5e09d90a6da): the instrumentation catalog directory, the JSDoc and schema-first inventories, the policy fingerprint, the cache-qualification baseline and `fallow.boundaries.generated.jsonc`. They now have rows in `COVERAGE_GENERATED_STANDARDS_OWNER_ROWS`, each `[readerPath, ownerPattern, packageName]`, spread into the repository fixture rows, so a change selects its owner as a fixture owner (no dependents seeded).

The owners are derived, not asserted. `CoverageScopeReaders.ts` holds a reader scan: a workspace source reads a path when one of its string tokens (TypeScript parser via ts-morph, so comments never count; folded `+` chains of literals and template parts do) has the path's basename as one whole path segment. A read outside a package's `test/` tree also makes that package's coverage-bearing dependents owners. The live drift check in `test/coverage-scope-standards-owners.test.ts` scans every `packages/**` and `apps/**` source and fails when a row and the scan disagree in either direction; seeding a wrong owner turned it red. On this head the scan finds @beep/repo-cli alone for all six (repo-cli-kit and repo-configs mention three of them only in comments or a schema tag). Basename-segment matching over-approximates on purpose: a stale-looking extra owner costs a test run, a missed reader would cost a green it did not earn.

Gates: planner fixtures select exactly @beep/repo-cli for each row and keep `standards/fallow.boundaries.provenance.jsonc` (unmapped) and prefix look-alikes on full; the seeded `path.join` fixture and the comment and longer-segment negatives pin the scan; the first-parent replay over 727 commits rebuilt from git (`ops/turb-01-replay.ts`, `research/turb-01/REPLAY.md`) shrinks 67 commits from full to owner-scoped with zero violations. `beep lint policy-fingerprint --check` reports the seal current with these changes (CoverageScope.ts is not a sealed input), so the reseal wrote nothing; the PR touches no `turbo.json`, `bun.lock`, root `package.json` or workflow file, so it is not a global input and re-records no cache-qualification baseline.

Rejected: hand-asserted rows (they drift as readers move); scanning raw text with ripgrep (counts comments and misses `path.join` splits); deriving owners at plan time (the planner would parse the workspace on every run).
Source: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` at 5e09d90a6da; this PR's replay receipt `research/turb-01/replay-5e09d90a6da.json`.

Lane feat/turb-01-standards-coverage-owners

Reverse: Delete COVERAGE_GENERATED_STANDARDS_OWNER_ROWS and its spread from CoverageScope.ts (the files return to the full fallback), and delete CoverageScopeReaders.ts with its test; no generated file or seal changes.

### Workflow policy runs inside the Repo Sanity lane body, 2026-11-12

The post-merge review of #3117 found that check.yml ran `beep ci workflow-lint` as its own Repo Sanity step ahead of "Run verification lane", whose `if:` has no `!cancelled()`. A workflow-lint red therefore skipped the whole lane body, the shadcn step included, which contradicted the no-masking claim. The check now runs as `ci:repo-sanity:workflow-lint`, the first step of the collecting lane body. Local final-check replays it on the workstation profile or with `--force-local`; on the worker profile final-check narrows Repo Sanity to changeset status, so hosted Repo Sanity proves it. I chose this over adding `!cancelled()` to the lane step, which would also run the lane after a broken setup step. `ciLaneFailurePolicy` names the per-lane runner choice (`collect-all`, or `fail-fast` for the JSDoc ratchet), and `runCiLaneSteps` applies it: `beep ci lane` hands every step-planned body to that runner. `ci-repo-sanity-owners.test.ts` drives `runCiLaneSteps` with the real Repo Sanity labels, every step before shadcn red, and shows the shadcn step still runs; a fail-fast contrast shows the ratchet stops at its first red. Known limit: a red in a check.yml setup step still skips the lane body, and the owners test guards only the `ci workflow-lint` script, so a different pre-lane check added later to the verify job would bring the masking back without a red test. Such a check belongs in the lane body.

Lane ci/repo-sanity-workflow-lint-in-lane

Reverse: Restore the check.yml 'Check workflow policy' step and drop the ci:repo-sanity:workflow-lint body step

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
