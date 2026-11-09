# Map: Ten-Minute Certainty

Decomposition drafted 2026-11-09 from `BRIEF.md`, `research/phase2/PLAN.md` (85 ranked rows, the
cross-area critic's dependency order) and rulings D1 to D19. Lever ids refer to `research/phase2/PLAN.md`
and the per-area records under `research/phase2/merged/`.

## Candidate goal packets

| # | Slug | Mission | Levers | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `certainty-scorecard` | Report the target nightly per head SHA and make every other packet's claim checkable: push-to-every-required-green on code heads (misses counted), runner-minutes per run, main verdict rate, time-to-mergeable beside it; attributable local economics across the fleet. | MEAS-01, MEAS-04, MEAS-02, MEAS-03, MEAS-05, MEAS-06, MEAS-07, MEAS-08, PERIL-11, ROUT-05, SCHE-09 | none |
| 2 | `route-soundness-repair` | Close the soundness holes the audit found so narrowing can be admitted on a sound base: goal-data consumers on the code route, knowledge policy on docs-only PRs, the `@beep/glob` setup closure, the bare-coverage self-judge, versioned final-check receipts, Node 22 local coverage, base-ref CI patterns, one relevance model. | ROUT-03, ROUT-02, TEST-10, COVE-02, YEET-08, COVE-03, PERIH-10, ROUT-07 | none |
| 3 | `main-verdict-every-commit` | Give every non-docs main SHA a completed hosted verdict without regressing PR latency: cancel ban in AGENTS.md, a throughput layout for main pushes, per-SHA concurrency groups, re-dispatch of missing verdicts. | HOST-01 | 1 |
| 4 | `heavy-pool-diet` | Cut heavy-pool occupancy and the admission chain on code PRs: JSDoc inventory `noResolve`, drop the duplicate JSDoc chain from Lint Policy, knowledge doctor abreast, PR C checker algorithms, job-level route and docs skips, Heavy Admission on the pinned CI binary, automated pin bumps. | LINT-01, LINT-05, LINT-02, LINT-04, HOST-06, PERIH-01, PERIH-11, HOST-08 | 1 |
| 5 | `hosted-setup-tax` | Remove duplicate hosted work and the setup tax with no proof-depth change: owner rows for generated standards files, the Property Laws file split, Fallow into Labs, one `lint:shadcn` owner, lane-relevance skips, Nix, Security and SAST without the install, `trustedDependencies`, PR Size into Change Profile, empty-leg skips. | TURB-01, TEST-01, PERIL-01, PERIH-02, PERIH-04, PERIH-05, PERIH-06, HOST-09, DEPS-01, PERIL-04, ROUT-01 | 1, 2 |
| 6 | `local-proof-under-ten` | Make local publish and verify predictable under agent fan-out through the existing QualityScheduler: admission units of lane or package, measured weights, final-check and agent-shell work admitted, the bounded in-publish advisory ratchet, hosted partitions run locally in shadow, monitor back-off and REST budgeting, C4.2 enforcement and wave re-seed re-homed, merged-preview marked dormant. | SCHE-08, SCHE-09, SCHE-07, SCHE-02, SCHE-01, SCHE-06, SCHE-05, COVE-01, TEST-04, TEST-08, YEET-02, YEET-05, YEET-06, YEET-07, TURB-05, PERIL-02, PERIL-03, PERIL-10, PERIL-13 | 1, 2 |

## Sequencing and rationale

1. **Measurement first** (packet 1): no target claim is checkable without the scorecard; the attribution
   fix must precede any wave re-seed; partition mapping must precede any route refinement replay.
2. **Soundness before any narrowing** (packet 2, alongside 1): a narrowing lever admitted on an unsound
   selector inherits the hole. ROUT-03 is widening-only and safe under head reads, so it lands first; the
   base-ref pattern read (PERIH-10) comes after the closure-digest binary release trigger.
3. **Job-removing before job-adding**: every lever that adds hosted jobs or legs (main verdicts, Property
   Laws sharding, extra Unit legs) draws on the same unverified ~60-job ceiling, so packets 4 and 5 land
   the removals before packet 3 lands per-SHA groups.
4. **Main verdicts only with their throughput layout** (packet 3): the cancel ban is an AGENTS.md
   amendment and lands at once; per-SHA groups wait for the layout and a merge-timestamp replay against
   the ceiling and the heavy pool.
5. **Heavy-pool diet before any capacity question** (packet 4): the capacity decision is money and is taken
   only against the post-diet heavy-queue residual the scorecard reports.
6. **Local proof last but started early** (packet 6): the schema (AdmissionUnit) and retention land first
   because every scheduler claim needs them; enforcement stays shadow under the R2 pause.

Lever-order constraints inherited from the critic: LINT-01 before LINT-05 before LINT-02 before LINT-04;
COVE-03 before COVE-01 and TEST-04; SCHE-09 and SCHE-08 before SCHE-07 before SCHE-01/02; ROUT-05 before
any refinement replay; `heavy.yml` is called at `@main`, so any hosted heavy-lane input change is two PRs;
any `turbo.json`, `bun.lock` or workflow change freezes coverage rows and needs a cache-policy baseline
re-record in the same PR.

## First vertical slice

`fix(ci): keep goal ops scripts, fixtures and research inputs on the code route` (ROUT-03 slice 1, S): a
generated census test finds every `goals/` path a test reads, spawns or imports, or that a `turbo.json`
declares, asserts each is non-docs-only in `CiOperational.patterns.json`, and ships with a mutation fixture
(malform the frozen citation fixture; the eyecite and law-practice tests must be selected). It closes a
confirmed missed-red path, exercises the route-replay admission gate end to end, and is small enough to
land alone. The other two ready PRs follow in parallel: `feat(quality): derive coverage owners for
generated standards inventories` (TURB-01 slice 1, M) and `feat(ci): beep ci certainty head-level
required-green and main-verdict report` (MEAS-01 slice 1, M).

## Capability check

| Component | Existing capability (path) or NET-NEW |
| --- | --- |
| Head-level scorecard | NET-NEW command `ci certainty`, composed from `commands/Ci/LaneTimings.ts` (hosted job and step reads), `standards/branch-protection-contexts.json` (required contexts), `commands/Yeet/internal/Economics.ts` (local attempts); nightly workflow follows `.github/workflows/knowledge-baseline-mint.yml` |
| Journal retention and fleet roots | `internal/.../ResidueReap.ts`, `commands/Worktree` archive path, `docs/runbooks/fleet-roots-and-registry.md` (`roots.json`); NET-NEW: export on retire, seat and host fields on `AttemptJournal.ts` rows |
| Route corpus partition mapping | `commands/Ci/RouteCorpus.ts`, `RouteCensus.ts`; NET-NEW: partition job name mapping and per-lane outcome fields |
| Goal-data consumer census | `commands/Ci/CiOperational.schemas.ts` and `CiOperational.patterns.json`; NET-NEW: generated census test over `goals/` reads, spawns, imports and `turbo.json` inputs |
| Docs-policy hosted job | `commands/Lint/*` knowledge gates (`knowledge:semantic-delta`, `knowledge:refs-check`), `commands/Ci/CiLane.ts`; NET-NEW: one check.yml job and a CiLane id |
| Setup-closure test key | `turbo.json` `dependsOn` and the root-tasks input tests (`packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`); no new code |
| Bare-coverage self-judge | `commands/Quality/internal/CoverageRegression.ts` (`base` parameter exists, unused on this path), `commands/Quality/Tasks.ts`; no new code |
| Final-check obligation registry | `commands/Yeet/internal/FinalCheck.schemas.ts`, `FinalCheck.ts`, `ReadyGate.ts`; NET-NEW: versioned receipt digest and registry schema |
| Node 22 local coverage | `check.yml` coverage runtime pin, `commands/Quality/internal/CoverageEnvironment.ts`; NET-NEW: shared pin source and drift test |
| Main throughput layout and per-SHA groups | `check.yml` concurrency, `commands/Ci/RerunRunnerLoss.ts` (re-dispatch pattern); NET-NEW: main layout and missing-verdict re-dispatch |
| JSDoc inventory `noResolve` | `commands/Quality/internal/JSDocDocumentationInventory.ts`; small option |
| Lint Policy plan and widths | `commands/Quality/Tasks.ts`, `commands/Quality/internal/LintPolicyScope.ts`; no new code |
| Heavy Admission on the binary | `commands/Ci/HeavyAdmission.ts`, `CiBinary.ts`, `.github/workflows/beep-ci-binary.yml`, `.github/actions/fetch-beep-ci`; NET-NEW: closure-digest release trigger and pin-bump PRs |
| Coverage owner rows | `commands/Quality/internal/CoverageScope.ts` consumer tables; data rows |
| Property file split and census | `packages/tooling/test-kit/fc-runs`, `vitest.shared.ts` property markers; NET-NEW: census tripwire |
| Hosted job folds and install removals | `check.yml`, `.github/actions/setup-monorepo-ci`; `trustedDependencies` is a Bun manifest field |
| Partition plan-only mode | `commands/Ci/CiLanePartitions.ts`, `CiLane.ts`; NET-NEW flag |
| Admission units and weights | `internal/repo-run/QualityScheduler.ts`, `QualityScheduler.schemas.ts`, `withQualityAdmission`; NET-NEW: `AdmissionUnit` schema and resizable lease |
| Advisory direct-owner coverage | `commands/Quality/internal/CoverageScope.ts` (`changedCoverageOwners`), `commands/Quality/Tasks.ts`; NET-NEW: `--direct` scope mode and the publish step |
| Local partitions in shadow | `commands/Ci/CiLane.ts` test-unit partitions and coverage consumer; NET-NEW: local producer/consumer wiring under admission |
| Monitor cadence and reuse | `commands/Yeet/internal/MonitorLoop.ts`, `MonitorPolicy.ts`, `ProofJobLauncher.ts`; small changes |
| C4.2 enforcement and wave re-seed | `commands/Yeet/internal/ProofShadow.ts`, `ProofLedger.ts`, `WaveOrder.ts`, `goals/time-to-certainty/research/gate-order-handoff.json`; existing seams |

## Inherited risks

- #3007 (Test Unit repack) was still open when the plan was synthesized; every Test Unit figure is pre-steady-state.
- The route corpus does not map the #3005 partition jobs (29% of run minutes) until ROUT-05 lands.
- GitHub hosted runner-loss incidents (one hit this packet's own PR) and the shared REST token budget.
- The ~60 concurrent hosted job ceiling is documented, not measured; the heavy pool stays at cap 2.
- Fleet and T3 local figures are censored until journal retention and roots land.

## Gated candidates (re-entry points, not goals)

| Candidate | Gate that reopens it |
| --- | --- |
| Heavy-pool capacity (cap above 2, larger runner class) | scorecard shows the post-diet heavy-queue p95 still binding the required path |
| Property Laws sharding (HOST-05) | Property Laws p95 over 10 min after the file split, and a ruling that mergeable contexts bind |
| Coverage Regression as a required context | scorecard shows coverage-verdict p95 under 10 min; fixed context name landed |
| Smoke-per-PR corpus replay | main verdict rate at or above 95% for 14 days |
| Per-SHA main groups | throughput layout landed and the merge-timestamp replay shows PR p95 regressing under one minute |
| Enforced cache reuse (TURB-05, YEET-05, YEET-06 beyond cheap lanes) | the R2 pause lifts |
| Hub `^transit` narrowing (TEST-07) | module-graph evidence plus a qualified affected-route refinement |
| File-level test selection as a receipt (TEST-08) | 100% recall over at least 50 red episodes |
| Merge queue, stacked PRs | their recorded flip conditions (80% main required-green over 14 days) |
