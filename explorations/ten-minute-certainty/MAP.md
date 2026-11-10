# Map: Ten-Minute Certainty

Decomposition drafted 2026-11-09 from `BRIEF.md`, `research/phase2/PLAN.md` (85 ranked rows, the
cross-area critic's dependency order) and rulings D1 to D19. Lever ids refer to `research/phase2/PLAN.md`
and the per-area records under `research/phase2/merged/`.

## Candidate goal packets

| # | Slug | Mission | Levers | Depends on |
| --- | --- | --- | --- | --- |
| 1 | `certainty-scorecard` | Report the target nightly per head SHA and make every other packet's claim checkable: push-to-every-required-green on code heads (misses counted), runner-minutes per run, main verdict rate, time-to-mergeable beside it; attributable local economics across the fleet. | MEAS-01, MEAS-04, MEAS-02, MEAS-03, MEAS-05, MEAS-06, MEAS-07, MEAS-08, PERIL-11, ROUT-05, SCHE-09 | none |
| 2 | `route-soundness-repair` | Close the soundness holes the audit found so narrowing can be admitted on a sound base: goal-data consumers on the code route, knowledge policy on docs-only PRs, the `@beep/glob` setup closure, the bare-coverage self-judge, versioned final-check receipts, Node 22 local coverage, base-ref CI patterns, one relevance model. | ROUT-03, ROUT-02, TEST-10, COVE-02, YEET-08, COVE-03, PERIH-10, ROUT-07, COVE-08, COVE-04 | none |
| 3 | `main-verdict-every-commit` | Give every non-docs main SHA a completed hosted verdict without regressing PR latency: cancel ban in AGENTS.md, a throughput layout for main pushes, per-SHA concurrency groups, re-dispatch of missing verdicts. | HOST-01 | 1 |
| 4 | `heavy-pool-diet` | Cut heavy-pool occupancy and the admission chain on code PRs: JSDoc inventory `noResolve`, drop the duplicate JSDoc chain from Lint Policy, knowledge doctor abreast, PR C checker algorithms, job-level route and docs skips, Heavy Admission on the pinned CI binary, automated pin bumps. | LINT-01, LINT-05, LINT-02, LINT-04, HOST-06, PERIH-01, PERIH-11, HOST-08 | 1 |
| 5 | `hosted-setup-tax` | Remove duplicate hosted work and the setup tax with no proof-depth change: owner rows for generated standards files, the Property Laws file split, Fallow into Labs, one `lint:shadcn` owner, lane-relevance skips, Nix, Security and SAST without the install, `trustedDependencies`, PR Size into Change Profile, empty-leg skips. | TURB-01, TEST-01, PERIL-01, PERIH-02, PERIH-04, PERIH-05, PERIH-06, HOST-09, DEPS-01, PERIL-04, ROUT-01 | 1, 2 |
| 6 | `local-proof-under-ten` | Make local publish and verify predictable under agent fan-out through the existing QualityScheduler: admission units of lane or package, measured weights, final-check and agent-shell work admitted, the bounded in-publish advisory ratchet, hosted partitions run locally in shadow, monitor back-off and REST budgeting, C4.2 enforcement and wave re-seed re-homed, merged-preview marked dormant. | SCHE-08, SCHE-07, SCHE-02, SCHE-01, SCHE-06, SCHE-05, COVE-01, TEST-04, TEST-08, YEET-02, YEET-05, YEET-06, YEET-07, TURB-05, TURB-10, PERIL-02, PERIL-03, PERIL-09, PERIL-10, PERIL-13 | 1, 2 |

Amended at graduation, 2026-11-09 (D23): COVE-08 and COVE-04 joined packet 2, PERIL-09 and TURB-10 joined
packet 6, and SCHE-09 has one owner, packet 1 (packet 6 consumes it). Rulings D6, D12 and D14 name
COVE-08, PERIL-09 and TURB-10, and the first draft of this table had left them without a home. Packet 3
no longer builds per-SHA concurrency groups (D28): the operator's `verdict-placement` ruling in
`explorations/github-merge-queue` folds them into that packet's gated `merge-queue-activation`.

Capability edges in the goal manifests: `certainty-scorecard` provides `ci/certainty-scorecard`;
`route-soundness-repair` provides `ci/route-soundness`; `main-verdict-every-commit` provides
`ci/main-verdict`; `heavy-pool-diet` provides `ci/heavy-pool-diet`; `hosted-setup-tax` provides
`ci/hosted-setup-tax`; `local-proof-under-ten` provides `quality/local-proof-admission`. Packets 3 and 4
require `ci/certainty-scorecard`; packets 5 and 6 require it and `ci/route-soundness`. A requirement gates a
packet's acceptance numbers and its narrowing levers, not its first slices: each goal's `statusNote` says
what is startable now.

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

Amended at graduation, 2026-11-09 (D28): items 3 and 4 were approved with per-SHA groups as packet 3's
last stage. That stage moved to `merge-queue-activation` in `explorations/github-merge-queue`. Packets 4
and 5 now land their removals before the merge group adds jobs (`merge-group-parity` there), and packet
3's throughput layout still waits for the merge-timestamp replay against the ceiling and the heavy pool.

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
| Journal retention and fleet roots | `commands/Worktree/internal/ResidueReap.ts`, the `commands/Worktree` archive path, `docs/runbooks/fleet-roots-and-registry.md` (`roots.json`); NET-NEW: export on retire, seat and host fields on `AttemptJournal.ts` rows |
| Route corpus partition mapping | `commands/Ci/RouteCorpus.ts`, `RouteCensus.ts`; NET-NEW: partition job name mapping and per-lane outcome fields |
| Goal-data consumer census | `commands/Ci/CiOperational.schemas.ts` and `CiOperational.patterns.json`; NET-NEW: generated census test over `goals/` reads, spawns, imports and `turbo.json` inputs |
| Docs-policy hosted job | `commands/Knowledge/*` (the `knowledge:semantic-delta` and `knowledge:refs-check` root tasks), `commands/Ci/CiLane.ts`; NET-NEW: one check.yml job and a CiLane id |
| Setup-closure test key | `turbo.json` `dependsOn` and the root-tasks input tests (`packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`); no new code |
| Bare-coverage self-judge | `commands/Quality/internal/CoverageRegression.ts` (`base` parameter exists, unused on this path), `commands/Quality/Tasks.ts`; no new code |
| Final-check obligation registry | `commands/Yeet/internal/FinalCheck.schemas.ts`, `FinalCheck.ts`, `ReadyGate.ts`; NET-NEW: versioned receipt digest and registry schema |
| Node 22 local coverage | `check.yml` coverage runtime pin, `commands/Quality/internal/CoverageEnvironment.ts`; NET-NEW: shared pin source and drift test |
| Main throughput layout and re-dispatch | `check.yml` concurrency, `commands/Ci/CiRerunRunnerLoss.ts` and `.github/workflows/rerun-runner-loss.yml` (re-dispatch pattern); NET-NEW: main layout and missing-verdict re-dispatch |
| JSDoc inventory `noResolve` | `commands/Quality/internal/JSDocDocumentationInventory.ts`; small option |
| Lint Policy plan and widths | `commands/Quality/Tasks.ts`, `commands/Quality/internal/LintPolicyScope.ts`; no new code |
| Heavy Admission on the binary | `commands/Ci/HeavyAdmission.ts`, `CiBinary.ts`, `.github/workflows/beep-ci-binary.yml`, `.github/actions/fetch-beep-ci`; NET-NEW: closure-digest release trigger and pin-bump PRs |
| Coverage owner rows | `commands/Quality/internal/CoverageScope.ts` consumer tables; data rows |
| Property file split and census | `packages/tooling/test-kit/fc-runs`, `vitest.shared.ts` property markers; NET-NEW: census tripwire |
| Hosted job folds and install removals | `check.yml`, `.github/actions/setup-monorepo-ci`; `trustedDependencies` is a Bun manifest field |
| Partition plan-only mode | `commands/Ci/CiLanePartitions.ts`, `CiLane.ts`; NET-NEW flag |
| Admission units and weights | `internal/repo-run/QualityScheduler.ts`, `QualityScheduler.schemas.ts`, the `withQualityAdmission` wrappers in `commands/Yeet/internal/Handler.ts`; NET-NEW: `AdmissionUnit` schema and resizable lease |
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

### Reviewer constraints (CodeRabbit on #3017, 2026-11-09)

Carried into the owning packets as lever constraints. The seat reports and merged records they annotate
are research records: where a sentence proposed something invalid, it is corrected in place and marked as
a reviewer correction with the date, so the record never contradicts the constraint.

- **HOST-09 (fold PR Size Label into Change Profile), packet 5:** the label write must never sit on the
  `Change Profile -> Test Unit / Heavy Admission` dependency path. Keep it a separate non-blocking step or
  job that fails open, so a label API failure cannot hold required checks. Label failures are reported on
  their own (a dedicated step summary line and a `label_failed` output, never the job's exit status), and
  the slice ships a failure-injection gate: a fixture that makes the label API call fail must still show
  Change Profile green, Test Unit and Heavy Admission scheduled, and the failure visible in the report.
- **PERIH-01 (Heavy Admission on the pinned binary, deleting the coverage-rollout probe), packet 4:**
  `check.yml` derives both `legacy_coverage` and `legacy_integration` from that step. The slice must set
  both outputs explicitly or remove their consumers in the same PR; hard-coding the coverage job name alone
  leaves `legacy_coverage` empty and fails the comparator's boolean check on non-docs runs.
- **PERIH-04 (job-level lane-relevance skips), packet 5:** Labs is excluded from the gate. On non-docs PRs
  Labs produces coverage for transitive dependents or an empty manifest that Coverage Regression requires
  from a successful producer; skipping the job would leave the comparator without it.
- **PERIL-01 (fold Fallow envelopes into Labs), packet 5:** fork PR tokens are read-only and Labs has
  `contents: read` only, so the folded step cannot publish a commit status for fork runs, and commit
  statuses have no `skipped` state. The host job must carry `checks: write`, because a step can only
  create a check run through the Checks API (and `statuses: write` as well only if a commit status is
  also posted); Labs runs with `contents: read` today, for same-repository PRs too, and no workflow
  declares `checks: write`. The standalone Fallow job stays whenever publication is unavailable: fork
  PRs, or any host job lacking the needed permission. The folded step must produce a check run, not
  only a commit status: Yeet's merge gate reads check runs
  (`commands/Yeet/internal/GhOps.ts`) and `GateTable.ts` reports a failed status without holding
  `GATE-MET`, so a status alone would weaken the gate; the seeded-failure fixture must show the merge
  gate refusing the PR. Only then may the standalone job be removed.

## State at graduation (2026-11-09)

The plan was synthesized around 17:30Z on 2026-11-09 and other lanes kept merging. Each goal's author
re-read its levers from `origin/main` at 6eb2e0588e2 and again at c90929b1ff1, eleven commits later, where
this graduation was rebased; the per-lever table with its evidence is in each goal's `SPEC.md`. What had
moved:

- **The per-commit verdict moved to the merge group (D28).** #3047 landed
  `explorations/github-merge-queue` with the operator's `verdict-placement` ruling: one run per commit,
  placed before the merge. Per-SHA main groups are no longer packet 3's last slice; they are folded into
  that packet's gated `merge-queue-activation`, whose gate includes packet 3's throughput layout. Its
  `gate-restatement` ruling supersedes the 80% bar `BRIEF.md` cites for a merge queue, and its
  `merge-group-parity` candidate waits on packets 2, 4 and 5 merging.
- **Landed.** LINT-01 and LINT-04 in #3019 (JSDoc inventory `noResolve`, the checker algorithms). ROUT-01's
  empty-partition skips in #3030, with a Test Plan job. Each goal keeps the unpaid part of the lever's
  admission gate and its reading in the scorecard.
- **Partly landed.** TEST-01: #3030 made the deep sweep skip provably plain tests at collection time, with
  no oracle census; a file split remains only where module-scope or hook cost still dominates (D26).
  PERIL-03: #3032 set a 90 s poll and a sleep through rate limits; the state-aware back-off and the
  ref-change wake are open. MEAS-03: a terminations line exists, and terminated attempts still count as
  red. LINT-02 slice 1 is in open #3041, which is not landed until it merges.
- **Open.** Every other lever.
- **Property Laws runs as two slices** under one context since #3030, ahead of D10's order (D26).
- **The monitor's GitHub read path** now belongs to the three goals graduated from
  `explorations/github-api-quota` (D27).
- **Figures that moved.** Test Integration has 20 partitions since #3029 (19 law-practice-server shards plus
  int-rest), where the plan says 16 or 17. Test Unit runs 24 jobs since #3043, down from 30; its 17 sharded jobs use two Vitest workers since #3040. #3046 creates the
  test shards before the non-test lanes and caps shard timeouts at 20 minutes; its message puts a full
  Check run at about 75 hosted jobs against the 60-job cap, above the 62 that D7's costing used. The 264
  runner-minute baseline predates #3028, #3029, #3030, #3040, #3043 and #3046. `heavy.yml` holds five heavy
  lanes today, where `BRIEF.md` counts six.
- **Also landed since.** #3039 added the private-home-paths law to the cheap gates and to hosted Repo
  Sanity, which runs it alone on goals-only diffs. #3045 moved Vercel deployments to an Actions workflow
  that deploys only when Turbo says the app changed, which bears on backlog row PERIH-12.
- **D7's first-stage estimate is at risk.** The 55 to 65% verdict rate after the cancel ban rests on a
  sample of hand cancels. `goals/ci-lane-economics` later found most cancelled main runs were pending runs
  displaced by newer merges, which a ban does not prevent. The staging stands; the scorecard's main verdict
  rate decides whether stage one delivered.
- **The corpora behind the MEAS-01 gate figures are not repo artifacts.** Slice 1 commits its own fixture
  corpus.

## Plan rows with no goal home (backlog, not goals)

Seventeen rows of `research/phase2/PLAN.md` are neither parked there nor assigned above (D24). They stay
in the plan as backlog. The goal named beside each row may adopt it with a decision file of its own; none
is promised by this graduation.

| Natural home | Rows |
| --- | --- |
| `hosted-setup-tax` | DEPS-05, DEPS-06, DEPS-08, HOST-10, PERIH-07, PERIH-09, PERIH-12, TURB-03, TURB-07, TURB-09 |
| `local-proof-under-ten` | PERIL-06, PERIL-07, PERIL-08, PERIL-12, TEST-09, YEET-09, COVE-09 |

Rows the plan itself parks (TEST-07, ROUT-04, LINT-07, COVE-07, LINT-09, DEPS-09) and HOST-05 are covered
by the gated candidates below or stay parked.

## Gated candidates (re-entry points, not goals)

| Candidate | Gate that reopens it |
| --- | --- |
| Heavy-pool capacity (cap above 2, larger runner class) | scorecard shows the post-diet heavy-queue p95 still binding the required path |
| Property Laws sharding (HOST-05) | Property Laws p95 over 10 min after the file split, and a ruling that mergeable contexts bind |
| Coverage Regression as a required context | scorecard shows coverage-verdict p95 under 10 min; fixed context name landed |
| Smoke-per-PR corpus replay | main verdict rate at or above 95% for 14 days |
| Per-SHA main groups | merged into `merge-queue-activation` in [`explorations/github-merge-queue/MAP.md`](../github-merge-queue/MAP.md) (operator ruling `verdict-placement`, 2026-11-09): the per-commit verdict runs as a merge group before the merge. The throughput layout and the merge-timestamp replay stay its prerequisites |
| Enforced cache reuse (TURB-05, YEET-05, YEET-06 beyond cheap lanes) | the R2 pause lifts |
| Hub `^transit` narrowing (TEST-07) | module-graph evidence plus a qualified affected-route refinement |
| File-level test selection as a receipt (TEST-08) | 100% recall over at least 50 red episodes |
| Merge queue | owned by `explorations/github-merge-queue`; the 80% bar is superseded (ruling `gate-restatement`, 2026-11-09) by parity, p90 merge-group wall time at or under 15 minutes and false ejections at or under 5% over 100 entries |
| Stacked PRs | the stacks-reopen gate in `explorations/stacked-pr-adoption/DECISIONS.md` |
