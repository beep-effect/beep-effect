# Route Soundness Repair — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  [`explorations/ten-minute-certainty/research/SOURCES.md`](../../../explorations/ten-minute-certainty/research/SOURCES.md).
  Rows below are the subset this goal uses; the exploration ledger stays authoritative.

## 1. Mined source corpus

Lever rows from the phase 2 plan and the per-area merged records.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| ROUT-03 | Register goal-folder data consumers; narrow the #2999 widening for consumed paths | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:51`, `explorations/ten-minute-certainty/research/phase2/merged/routing.md` | routing soundness | adopt (first slice) |
| ROUT-02 | Knowledge and packet policy on docs-only and goals-only PRs in their own job | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:59`, `explorations/ten-minute-certainty/research/phase2/merged/routing.md` | routing soundness | adopt |
| TEST-10 | Key test, test:property and doctest on `@beep/glob#transit` (merges TURB-04) | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:43`, `explorations/ten-minute-certainty/research/phase2/merged/tests.md`, `explorations/ten-minute-certainty/research/phase2/merged/turbo.md` | cache soundness | adopt |
| COVE-02 | Bare `bun run coverage` judges against the merge base it planned from | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:68`, `explorations/ten-minute-certainty/research/phase2/merged/coverage.md` | coverage soundness | adopt |
| YEET-08 | Versioned final-check receipts, exact gate names, named hosted obligations | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:76`, `explorations/ten-minute-certainty/research/phase2/merged/yeet-pipeline.md` | proof contract | adopt |
| COVE-03 | Local coverage on Node 22.23.4 from one shared pin | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:85`, `explorations/ten-minute-certainty/research/phase2/merged/coverage.md` | runtime parity | adopt |
| PERIH-10 | Classify PRs against base-ref CI patterns | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:93`, `explorations/ten-minute-certainty/research/phase2/merged/peripheral-hosted.md` | self-classification | adopt (after PERIH-11) |
| ROUT-07 | Differential test across the seven classifiers, then one relevance model | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:612`, `explorations/ten-minute-certainty/research/phase2/merged/routing.md` | drift prevention | adopt (after ROUT-05) |
| COVE-04 | Label coverage failure rows | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:690`, `explorations/ten-minute-certainty/research/phase2/merged/coverage.md` | coverage measurement | adopt (assigned here, D15) |
| COVE-08 | Fixed coverage comparator context name | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:699`, `explorations/ten-minute-certainty/research/phase2/merged/coverage.md` | context stability | adopt (assigned here, D6) |
| Critique | Conflicts, double counting, dependency order | in-repo | `explorations/ten-minute-certainty/research/phase2/PLAN.md:898-978` | ordering | adopt as constraints |

## 2. Upstream repositories & licenses

None. Every lever changes in-repo tooling and takes no code or pattern from an upstream repository.

## 3. External research sources

None. The exploration ledger records no external source for these levers.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Docs-only and goals-only patterns | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`, `packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json` | extend: consumed `goals/` paths leave the docs class (ROUT-03) |
| Change-profile runtime | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts` | extend: base-ref read with compat decode (PERIH-10) |
| Heavy admission docs path | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts`, `packages/tooling/tool/cli/test/ci-heavy-admission.test.ts`, `packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts` | reuse: fixtures for the census and docs-policy job |
| CI lanes | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | extend: docs-policy lane id (ROUT-02) |
| Route classifier and replay | `packages/tooling/tool/cli/src/commands/Ci/RouteClassify.ts`, `packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts`, `packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts` | reuse: replay gate; one of the seven classifiers (ROUT-07) |
| Coverage scope | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` | extend: goal-data consumer rows (ROUT-03 slice 2) |
| Lint policy scope | `packages/tooling/tool/cli/src/commands/Quality/internal/LintPolicyScope.ts` | reuse: classifier compared by ROUT-07 |
| Coverage comparator | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts` (`compareCoverageRegressionBaseline` takes `base`) | reuse: pass the planned base (COVE-02); label rows (COVE-04) |
| Coverage task entry | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (bare path, line 4838), `packages/tooling/tool/cli/test/quality-tasks.test.ts` | extend: COVE-02 fixture |
| Coverage environment | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageEnvironment.ts` | extend: shared Node pin (COVE-03) |
| Final-check contract | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.schemas.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheck.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` | extend: gate-set versioning (YEET-08) |
| Turbo inputs | `turbo.json`, `packages/tooling/tool/cli/turbo.json`, `packages/drivers/eyecite/turbo.json`, `apps/labs/semantica/turbo.json`, `apps/labs/ciops/turbo.json`, `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts`, `standards/cache-qualification-baseline.json`, `standards/policy-tools.fingerprint.json` | extend: TEST-10 edge, ROUT-03 per-package inputs |
| Setup closure | `vitest.setup.ts`, `packages/foundation/modeling/glob/src/GlobPattern.ts` | reuse: the import TEST-10 keys on |
| Goal-data consumers | `goals/citation-extraction-engine/ops/probe-regex-characters.py`, `goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs`, `goals/time-to-certainty/research/gate-order-handoff.json`, `apps/labs/semantica/test/CanaryC2Report.test.ts`, `apps/labs/ciops/test/lane-plan.test.ts`, `packages/drivers/eyecite/test/index.test.ts`, `packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts`, `packages/law-practice/use-cases/test/fixtures/eyecite/authority-identity-cases.json` (ROUT-09 hole) | reuse: census seeds and mutation targets |
| Hosted workflow | `.github/workflows/check.yml`, `.github/actions/fetch-beep-ci/action.yml` | extend: docs-policy job (setup modeled on #3039's goals-only Repo Sanity path), comparator name (coverage-regression job, line 1160), change-profile call sites (also in `.github/workflows/heavy.yml`, `.github/workflows/heavy-admit.yml`, `.github/workflows/storybook.yml`) |
| Cloud bootstrap | `scripts/cloud/bootstrap.sh` | extend: provision the coverage runtime (COVE-03) |
| Node pins | `.nvmrc`, `mise.toml` | reuse: COVE-03 drift test input |
| Docs-only evidence | `docs/reports/ci-docs-only-acceptance-2026-11-09.md` (#3010), `docs/reports/local-docs-gates-2026-11-06.md` (#3011) | reuse: baseline for ROUT-02 |

## 5. Cross-links & provenance

- Source exploration: [`explorations/ten-minute-certainty`](../../../explorations/ten-minute-certainty/README.md) —
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md) (D6, D8, D15, D19, D23, D24),
  [`explorations/ten-minute-certainty/research/phase2/PLAN.md`](../../../explorations/ten-minute-certainty/research/phase2/PLAN.md).
- Sibling goals: certainty-scorecard (runs alongside; ROUT-05 gates ROUT-07), heavy-pool-diet (PERIH-11 gates
  PERIH-10; HOST-06 gates ROUT-02; PERIH-01's probe-deletion slice shares the coverage-regression edge with COVE-08: whichever lands second deletes `legacy_coverage`),
  hosted-setup-tax and local-proof-under-ten (both require `ci/route-soundness`), main-verdict-every-commit.
- Related goals: [`compute-profile-gate-routing`](../../compute-profile-gate-routing/README.md) (final-check
  receipt keys), [`verification-route`](../../verification-route/README.md) (route corpus, completed-retained),
  [`ci-lane-economics`](../../ci-lane-economics/README.md) (Test Unit sizing, #3008 decision),
  [`turborepo-quality-cache-adoption`](../../turborepo-quality-cache-adoption/README.md) (R2 pause).
- Shipped precursors: #2999 (the widening this goal narrows), #2935, #2919 (fix for the #2909 escape), #3008, #3010,
  #3011.
