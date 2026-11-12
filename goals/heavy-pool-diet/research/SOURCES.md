# Heavy Pool Diet — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  [`explorations/ten-minute-certainty/research/SOURCES.md`](../../../explorations/ten-minute-certainty/research/SOURCES.md).
- **Lever status check:** made 2026-11-09 against `origin/main` 6eb2e0588e2 and re-verified at c90929b1ff1, `git show --stat 027664ba178`
  (#3019) and the head of #3041 (937e2a20f8c); re-checked 2026-11-10 at b757bd0400f after #3041 merged as
  e8c9a47971b. Every source is this repository or its hosted CI; no
  external code is mined.

## 1. Mined source corpus

The lever rows of the exploration's ranked plan,
`explorations/ten-minute-certainty/research/phase2/PLAN.md`, with the per-area records under
`explorations/ten-minute-certainty/research/phase2/merged` they were merged from. Locations name the plan tier
and row, then the area record.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `LINT-01` | Build JSDoc inventory programs with noResolve, as an opt-in factory option | this repo | PLAN T2 row 2; lint-laws-knowledge | JSDoc chain | landed (#3019); two missing fixtures, noResolve parity and measurement kept (D26) |
| `LINT-05` | Drop the duplicate jsdoc inventory and ratchet from the hosted Lint Policy plan (absorbs HOST-03 jsdoc half) | this repo | PLAN T1 row 2; lint-laws-knowledge | JSDoc chain | adopt |
| `LINT-02` | Lint Policy stage widths: knowledge doctor abreast of medium, changed-scope state width derived jointly (merges HOST-04, LINT-03) | this repo | PLAN T2 row 3; lint-laws-knowledge | Lint Policy stages | slice 1 landed in #3041 (e8c9a47971b); slice 2 and A/B adopt |
| `LINT-04` | PR C checker algorithms: P55, S4, P12/P11, P28, S2 | this repo | PLAN T3 row 8; lint-laws-knowledge | checker cost | landed (#3019); unpaid per-family gates and measurement kept (D26) |
| `HOST-06` | Hoist heavy route_skips, goals-only and Docgen decisions to job-level `if` before Spot boot | this repo | PLAN T2 row 4; hosted-ci | heavy occupancy | adopt |
| `HOST-02` fallback | `needs:` ordering of required heavy lanes with `if: !cancelled()` (the hosted move is refuted) | this repo | PLAN align question "Moving Heavy / Lint Policy off the cap-2 heavy pool?"; hosted-ci | heavy occupancy | adopt as the D11 ordering slice |
| `HOST-08` | Queue-aware Test Unit leg-width A/B after #3007 reaches steady state | this repo | PLAN T2 row 5; hosted-ci | Test Unit legs | gated on steady state |
| `PERIH-01` | Heavy Admission from the pinned CI binary with a closure-digest fallback; delete the dead coverage-rollout probe (absorbs DEPS-02 admission half) | this repo | PLAN T2 row 1; peripheral-hosted, deps-toolchain | admission chain | adopt |
| `PERIH-11` | Closure-digest binary builds and reviewed pin-bump PRs (merges PERIH-08) | this repo | PLAN T5 row 7; peripheral-hosted | CI binary | adopt |
| critique | Conflicts, double counting, dependency order (items 3, 4, 6), numbers without a primary source | this repo | PLAN "Cross-area critique" | ordering and credit | adopt as constraints |
| reviewer | CodeRabbit on #3017: PERIH-01 legacy outputs | this repo | `explorations/ten-minute-certainty/MAP.md` "Reviewer constraints" | admission chain | adopt as a decision file |

## 2. Upstream repositories & licenses

None. No lever takes code or a pattern from another repository.

## 3. External research sources

None. The exploration ledger cites no external source for these levers.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Hosted Lint Policy plan | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`policyStateTasks` 3705-3714, `policyCachedStateTasks` 3723, `POLICY_UNSCOPED_STATE_WIDTH` 3727, `knowledgeDoctorPolicySteps` 3831 spread at 3900 and 3980) | extend: LINT-05, LINT-02 slice 2 |
| Changed-scope widening and Turbo target probe | `packages/tooling/tool/cli/src/commands/Quality/internal/LintPolicyScope.ts` | reuse |
| JSDoc inventory | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` (line 1342) | landed (`noResolve`); add merged-namespace and module-augmentation fixtures |
| JSDoc ratchet | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts` | reuse |
| ts-morph project factory | `packages/tooling/library/repo-cli-kit/src/tsmorph/ProjectFactory.ts` | reuse (`compilerOptions` from #3019) |
| Heavy admission decision | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts`, `packages/tooling/tool/cli/src/commands/Ci/CiAdmission.ts` | extend: bundle into the binary |
| CI binary surface | `packages/tooling/tool/cli/src/commands/Ci/CiBootstrap.command.ts` (lines 141-149), `packages/tooling/tool/cli/src/commands/Ci/CiBinary.ts`, `packages/tooling/tool/cli/src/commands/Ci/CiCompileBinary.ts`, `packages/tooling/tool/cli/src/bin-ci.ts` | extend: admission command, closure projection |
| Binary release workflow | `.github/workflows/beep-ci-binary.yml` (path trigger, lines 11-22) | extend: closure-digest trigger, pin-bump PR |
| Binary fetch and pin | `.github/actions/fetch-beep-ci/action.yml` (lines 20-21) | reuse; bumped by reviewed PRs |
| Admission jobs | `.github/workflows/check.yml` (job `admission` with its `Setup monorepo CI` and `Decide heavy admission` steps and the constant `legacy_coverage` output; job `test-integration`, literal name `Heavy / Test Integration`; the `coverage-regression` job name is COVE-08's; #3116 deleted the coverage-rollout probe, `legacy_integration` and the `LEGACY_COVERAGE` env line and assertion), `.github/workflows/heavy-admit.yml` | extend |
| Heavy lanes | `.github/workflows/heavy.yml` (Lint Policy job lines 102-107, lane gate from line 137) | extend: job-level skips, `needs:` order |
| Hosted lane timings | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` | reuse: interim readings |
| Test Unit partitions | `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts`, `packages/tooling/tool/cli/vitest.shards.json` | read only (owned by `ci-lane-economics`) |
| Required contexts | `standards/branch-protection-contexts.json` | reuse: JSDoc Ratchet required, Lint Policy not |
| Cache-policy baseline | `standards/cache-qualification-baseline.json`, `docs/runbooks/turbo-cache-inputs.md` | re-record per global-input PR |
| CI binary ruling | `goals/scripts-to-beep-cli/decisions/2026-11-07-ci-binary-release-asset.md` | inherited: a PR's head never builds the binary that gates it |
| Lint Policy placement record | `goals/ci-lane-economics/research/placement-decision.md` | inherited: Lint Policy retained on the fleet |

## 5. Cross-links & provenance

- Source exploration: [`README.md`](../../../explorations/ten-minute-certainty/README.md),
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md) (D5, D11, D19, D25),
  [`research/phase2/PLAN.md`](../../../explorations/ten-minute-certainty/research/phase2/PLAN.md).
- Requires: [`goals/certainty-scorecard`](../../certainty-scorecard/README.md) (`ci/certainty-scorecard`).
- Cross-goal dependencies: [`goals/route-soundness-repair`](../../route-soundness-repair/README.md) (PERIH-10
  before the binary admission switch); [`goals/hosted-setup-tax`](../../hosted-setup-tax/README.md) (PERIH-02
  shares the Lint Policy task list; ROUT-01, which HOST-08 needed, landed in #3030); COVE-08 in
  `route-soundness-repair` owns making the Coverage Regression job name a literal; whichever of COVE-08 and
  PERIH-01's probe deletion lands second deletes the `legacy_coverage` output.
- Siblings: [`goals/main-verdict-every-commit`](../../main-verdict-every-commit/README.md) (cancel ban and
  throughput layout), [`goals/local-proof-under-ten`](../../local-proof-under-ten/README.md).
- Downstream (D28): [`explorations/github-merge-queue`](../../../explorations/github-merge-queue/README.md):
  its gated `merge-group-parity` waits on this goal (with route-soundness-repair and hosted-setup-tax) merging,
  and `merge-queue-activation` waits on `merge-group-parity`. That exploration's live goal,
  [`goals/merge-queue-lab`](../../merge-queue-lab/README.md), runs now and does not wait on this packet.
- Related: [`goals/ci-lane-economics`](../../ci-lane-economics/README.md) (Test Unit layout, last changed in #3043 and #3046),
  [`goals/scripts-to-beep-cli`](../../scripts-to-beep-cli/README.md) (CI binary origin, #2906),
  [`goals/lint-policy-single-digit`](../../lint-policy-single-digit/README.md) (completed-retained predecessor).
- Shipped precursors: #2997, #3014, #3019 (lint efficiency program); #3005 (Test Integration off the heavy pool);
  #3041 (LINT-02 slice 1, e8c9a47971b).
