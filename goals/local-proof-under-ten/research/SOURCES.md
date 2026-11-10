# Local Proof Under Ten — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  [`explorations/ten-minute-certainty/research/SOURCES.md`](../../../explorations/ten-minute-certainty/research/SOURCES.md).

## 1. Mined source corpus

Lever rows from the exploration's ranked plan. Location is the row heading in
`explorations/ten-minute-certainty/research/phase2/PLAN.md` and the merged area record under
`explorations/ten-minute-certainty/research/phase2/merged/`. Status is from the 2026-11-09 check; see the
Levers table in [`SPEC.md`](../SPEC.md) for the evidence.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| SCHE-08 | AdmissionUnit, weight source and owner schema; scheduler service facade; Cache uses its own kind | in-repo | PLAN.md "SCHE-08"; merged scheduler.md | admission units | adopt |
| SCHE-07 | Calibrate unit weights from measured envelopes (raise-only) | in-repo | PLAN.md "SCHE-07"; merged scheduler.md | weights | adopt |
| SCHE-02 | Admit final-check gates, package-verify and agent-shell heavy commands (absorbs YEET-03 slice 1) | in-repo | PLAN.md "SCHE-02"; merged scheduler.md | admitted work | adopt |
| SCHE-01 | Resizable lease units under one proof nonce | in-repo | PLAN.md "SCHE-01"; merged scheduler.md | admission units | adopt |
| SCHE-06 | Conditional starvation bound with EASY backfill and per-origin fairness | in-repo | PLAN.md "SCHE-06"; merged scheduler.md | fairness | adopt |
| SCHE-05 | Typed admission backpressure with a 600 s deadline outcome | in-repo | PLAN.md "SCHE-05"; merged scheduler.md | agent UX | adopt |
| SCHE-09 | Retain admission history beyond the 200-row ring | in-repo | PLAN.md "SCHE-09"; merged scheduler.md | measurement | consumed (owned by certainty-scorecard) |
| COVE-01 | Advisory direct-owner coverage scope, bounded inside publish | in-repo | PLAN.md "COVE-01"; merged coverage.md | local coverage | adopt (D15) |
| TEST-04 | Verify runs the hosted Test Unit producer partitions as admitted units (merges YEET-01, TEST-05) | in-repo | PLAN.md "TEST-04"; merged tests.md | local coverage | adopt |
| TEST-08 | Advisory related-tests lane with a read-graph recorder and recall audit | in-repo | PLAN.md "TEST-08"; merged tests.md | diagnosis | adopt (advisory only) |
| YEET-02 | File-scope effect-imports in the publish cheap tier with full escalation | in-repo | PLAN.md "YEET-02"; merged yeet-pipeline.md | publish scope | adopt |
| YEET-05 | final-check reuses same-head cheap-lane proofs (pinned base, shadow first) | in-repo | PLAN.md "YEET-05"; merged yeet-pipeline.md | reuse | adopt (shadow, D14) |
| YEET-06 | ProofLedger C4.2 enforcement for cheap-tier lanes | in-repo | PLAN.md "YEET-06"; merged yeet-pipeline.md | reuse | adopt (re-homed, D13) |
| YEET-07 | Re-seed WaveOrder from current economics after the attribution fix | in-repo | PLAN.md "YEET-07"; merged yeet-pipeline.md | wave order | adopt (re-homed, D13) |
| TURB-05 | Scope local TURBO_FORCE to path-detected patches and overrides | in-repo | PLAN.md "TURB-05"; merged turbo.md | reuse | adopt (shadow, D14) |
| TURB-10 | Attribute first-cold cross-host cache reuse on fleet hosts | in-repo | PLAN.md "TURB-10"; merged turbo.md | measurement | adopt (assigned here, D14) |
| PERIL-02 | One readiness monitor per PR in a checkout | in-repo | PLAN.md "PERIL-02"; merged peripheral-local.md | monitors | adopt |
| PERIL-03 | State-aware monitor cadence, wake on a local ref change | in-repo | PLAN.md "PERIL-03"; merged peripheral-local.md | monitors | partly landed (#3032); residual adopted |
| PERIL-09 | Keep the review-window anchor across a diff-preserving merge of main | in-repo | PLAN.md "PERIL-09"; merged peripheral-local.md | review window | adopt (assigned here, D12) |
| PERIL-10 | Summarize scheduler quarantine and archive-reap aged entries; retire the beep-heavy doctrine | in-repo | PLAN.md "PERIL-10"; merged peripheral-local.md | scheduler hygiene | adopt |
| PERIL-13 | Mark merged-preview admission dormant | in-repo | PLAN.md "PERIL-13"; merged peripheral-local.md | merged preview | adopt (D17) |
| PERIL-06, PERIL-07, PERIL-08, PERIL-12, TEST-09, YEET-09, COVE-09 | Plan rows with no goal home | in-repo | PLAN.md row headings | various | not adopted; a new decision file may adopt one |

## 2. Upstream repositories & licenses

None. No lever takes code or a pattern from an external repository. SCHE-06 names EASY backfill as a
scheduling technique; the exploration ledger records no upstream source for it.

## 3. External research sources

None for this goal's levers in the exploration ledger.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Admission scheduler | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` (`withQualityAdmission`) | extend: service facade, resize, backfill, backpressure |
| Admission schemas | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` (`AdmissionWorkKind`, `admissionTokenWeight`) | extend: `AdmissionUnit`, weight source, owner |
| Admission journal ring | `packages/tooling/tool/cli/src/internal/repo-run/AdmissionJournal.ts` (`RETAINED_ADMISSIONS = 200`) | reuse; retention is SCHE-09 (certainty-scorecard) |
| Memory samples | `packages/tooling/tool/cli/src/internal/repo-run/MemoryStats.service.ts` | extend: per-wave anon and file |
| Proof cgroup | `packages/tooling/tool/cli/src/internal/repo-run/RunScope.ts` | reuse under a resized lease |
| Yeet admission wrappers | `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` | extend |
| Final-check | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts`, `FinalCheck.schemas.ts` | extend: per-step admission, receipt grain |
| Cache admission sites | `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts` and four sibling Cache modules | extend: own work kind |
| Coverage scope | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` (`changedCoverageOwners`, `CoverageScopeMode`) | extend: direct mode |
| Coverage judge and runtime | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`, `CoverageEnvironment.ts` | reuse (COVE-02 and COVE-03 fix them in route-soundness-repair) |
| Hosted partitions | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`, `CiLanePartitions.ts`, `packages/tooling/tool/cli/vitest.shards.json` | reuse as the local producer plan |
| Lane-proof reuse | `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts` | extend: shadow reuse in final-check |
| Proof ledger and shadow | `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofLedger.ts`, `ProofShadow.ts` | extend: C4.2 enforcement |
| Wave order and seed handoff | `packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts`, `goals/time-to-certainty/research/gate-order-handoff.json` (read only) | extend: re-seed into a new handoff |
| Force planning | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` | extend: shadow narrowed force |
| Monitors | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`, `MonitorPolicy.ts`, `MonitorRateLimit.ts`, `ProofJob.ts`, `ProofJobLauncher.ts`, `ReadyGate.ts` | extend: reuse and back-off |
| Review window | `packages/tooling/tool/cli/src/commands/Yeet/internal/ReviewWindow.ts`, `GhOps.ts` | extend: patch-id anchor |
| Scheduler status | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` | extend: quarantine summary |
| Local economics | `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` | reuse (`yeet economics --fleet`) |
| Simulation lab | `apps/labs/ciops` | extend: backfill and fairness model |
| Skills | `.claude/skills/yeet/SKILL.md`, `.claude/skills/yeet/references/detached-jobs.md`, `.claude/skills/orchestrate/SKILL.md` | extend |

## 5. Cross-links & provenance

- Source exploration: [`README.md`](../../../explorations/ten-minute-certainty/README.md),
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md),
  [`research/phase2/PLAN.md`](../../../explorations/ten-minute-certainty/research/phase2/PLAN.md).
- Requires: [`goals/certainty-scorecard`](../../certainty-scorecard/README.md) (`ci/certainty-scorecard`) and
  [`goals/route-soundness-repair`](../../route-soundness-repair/README.md) (`ci/route-soundness`).
- Siblings: [`goals/main-verdict-every-commit`](../../main-verdict-every-commit/README.md),
  [`goals/heavy-pool-diet`](../../heavy-pool-diet/README.md) (LINT-01 and LINT-04, which YEET-02 needed, landed in #3019),
  [`goals/hosted-setup-tax`](../../hosted-setup-tax/README.md).
- Related: [`goals/time-to-certainty`](../../time-to-certainty/README.md) (paused; seams re-homed here, D13),
  [`goals/github-state-worker`](../../github-state-worker/README.md),
  [`goals/github-budget-ledger`](../../github-budget-ledger/README.md),
  [`goals/yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md) (monitor split),
  [`goals/turborepo-quality-cache-adoption`](../../turborepo-quality-cache-adoption/README.md) (R2 pause),
  [`goals/compute-profile-gate-routing`](../../compute-profile-gate-routing/README.md) (worker-host refusal),
  [`goals/push-first-publish`](../../push-first-publish/README.md) (archived; D1/D2 amended by D15).
- Shipped precursors: #3008 (bare local coverage defaults to affected), #3032 (90 s monitor poll, rate-limit
  sleep).
