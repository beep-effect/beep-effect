# Hosted Setup Tax — Sources & Provenance

- **Source exploration:** `explorations/ten-minute-certainty` — primary ledger:
  [`explorations/ten-minute-certainty/research/SOURCES.md`](../../../explorations/ten-minute-certainty/research/SOURCES.md).

## 1. Mined source corpus

Every row is a lever row in the exploration's ranked plan
(`explorations/ten-minute-certainty/research/phase2/PLAN.md`, found with `grep -n '^#### .*<ID>'`) and its
merged area record under `explorations/ten-minute-certainty/research/phase2/merged/`. Status evidence is from
the lever check of 2026-11-09 against `origin/main` 6eb2e0588e2, re-checked at c90929b1ff1 and at 5e09d90a6da.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| TURB-01 | Owner-map generated standards inventories in CoverageScope | this repo | PLAN.md T3 #1; `merged/turbo.md` (TURB-01) | duplicate fan-out | adopt (open; first slice) |
| TEST-01 | Property sweep runs only property-executing tests: file split first, then a census checked by an oracle | this repo | PLAN.md T3 #2; `merged/tests.md` | duplicate execution | landed in part by #3030 (f818c6e52bf); adopt the remainder under D26: oracle census, then the residual file split with its outcome recorded |
| PERIL-01 | Fold the non-required Fallow envelopes into Labs after its coverage body | this repo | PLAN.md T3 #3; `merged/peripheral-local.md` | setup tax | adopt under the MAP.md reviewer constraint |
| PERIH-02 | One hosted lint:shadcn owner in required Repo Sanity | this repo | PLAN.md T1 #1; `merged/peripheral-hosted.md` | duplicate execution | adopt |
| PERIH-04 | Job-level lane-relevance skips for Codegen, Ecosystem, Nix and IPC (Labs excluded) | this repo | PLAN.md T3 #4; `merged/peripheral-hosted.md` | setup tax | adopt after PERIH-11, PERIH-10 and ROUT-07 |
| PERIH-05 | Run the Nix Shell lane without installing the JS workspace | this repo | PLAN.md T1 #3; `merged/peripheral-hosted.md` | setup tax | adopt |
| PERIH-06 | Security and SAST dispatch without the workspace install, with a head fallback | this repo | PLAN.md T3 #6; `merged/peripheral-hosted.md` | setup tax | adopt |
| HOST-09 | Fold PR Size Label into Change Profile, Rerun Runner Loss from the binary, PR Build A/B | this repo | PLAN.md T3 #5; `merged/hosted-ci.md` | setup tax | adopt the PR Size fold (CLI, pin bump, workflow switch) and the Build A/B; the rerun slice waits (decision file) |
| DEPS-01 | Explicit trustedDependencies allowlist with a lifecycle-script census guard | this repo | PLAN.md T3 #7; `merged/deps-toolchain.md` | install trust and time | adopt |
| PERIL-04 | Run changeset-graph once in Repo Sanity | this repo | PLAN.md T1 #4; `merged/peripheral-local.md` | duplicate execution | adopt |
| ROUT-01 | Skip empty partitions before setup (merges HOST-07) | this repo | PLAN.md T3 #9; `merged/routing.md` | empty legs | landed by #3030 (Test Plan job); residual gate and measurement only |
| HOST-05 | Shard the Property Laws repo-cli sweep under a fail-closed census aggregate | this repo | PLAN.md T2 #6; `merged/hosted-ci.md` | latency at a compute cost | gated (D10, D26): read only after the census and the residual file split |
| Cross-area critique | Conflicts, double counting, dependency order items 3 to 5, numbers without a primary source | this repo | PLAN.md "## Cross-area critique" | ordering and caveats | adopt as constraints |

## 2. Upstream repositories & licenses

None. No lever in this goal takes code or a pattern from an upstream repository.

## 3. External research sources

None. The exploration ledger records no external source for these levers.

## 4. In-repo capability references

| Brick | Path | Verdict |
|---|---|---|
| Coverage owner rows and full fallback | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` (`:76-98` owner rows, `:772` "no current workspace owner") | extend (TURB-01) |
| Hosted Lint Policy plan | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` (`policyStateTasks`, `:3706` `lint:shadcn`) | edit (PERIH-02) |
| Lane bodies and partition plan | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` (`:1953` `changeset-graph` step, `shadcn-lint` and `nix` bodies, `--plan-partitions`), `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts` | edit |
| Local repo-sanity lane | `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts` (`:577-581`) | keep (only local graph check) |
| Change Profile patterns | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json`, `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts` | extend (PERIH-04) |
| Route lane rows | `packages/tooling/tool/cli/src/commands/Ci/RouteFootprints.ts`, `packages/tooling/tool/cli/src/commands/Ci/RouteCensus.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts` | edit when a job folds |
| Merge-gate check-run read | `packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts`, `packages/tooling/tool/cli/src/commands/Yeet/internal/GateTable.ts` | reuse (PERIL-01 fixture) |
| Rerun classifier (owned by yeet-monitor-app-identity) | `packages/tooling/tool/cli/src/commands/Ci/CiRerunRunnerLoss.ts`, `.github/workflows/rerun-runner-loss.yml` | wait (HOST-09 slice 2) |
| Hosted workflow | `.github/workflows/check.yml` (`pr-size`, `verify`, `shadcn-lint`, `labs`, `fallow-advisory`, `test-plan`, `property-laws-shard`, `security`, `nix`, `sast`), `.github/workflows/heavy.yml` | edit |
| Setup actions | `.github/actions/setup-monorepo-ci/action.yml`, `.github/actions/setup-bun/action.yml`, `.github/actions/fetch-beep-ci/action.yml` | reuse |
| Property selection (#3030) | `packages/tooling/test-kit/fc-runs/src/PropertySelection.ts`, `packages/tooling/test-kit/fc-runs/test/PropertySelection.test.ts`, `vitest.property-runner.ts`, `vitest.shared.ts` | extend with the oracle census (TEST-01) |
| Required contexts | `standards/branch-protection-contexts.json` | read only |
| Seals and baselines | `standards/policy-tools.fingerprint.json`, `standards/cache-qualification-baseline.json`, `standards/coverage.regression-baseline.jsonc` | reseal or re-record; never lower a floor |
| Install trust | `package.json` (no `trustedDependencies` today), `scripts/cloud/bootstrap.sh` (trust-list comment) | edit (DEPS-01) |
| Tests | `packages/tooling/tool/cli/test/ci-lane.test.ts`, `packages/tooling/tool/cli/test/quality-tasks.test.ts`, `packages/tooling/tool/cli/test/labs-ceremony-scoping.test.ts`, `packages/tooling/tool/cli/test/ci-runner-security.test.ts`, `packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts`, `packages/tooling/tool/cli/test/changeset-graph.test.ts` | extend |
| Runbooks | `docs/runbooks/design-system-lint.md`, `docs/runbooks/ci-coverage-artifacts.md`, `docs/runbooks/turbo-cache-inputs.md` | update with the slice that changes them |

## 5. Cross-links & provenance

- Source exploration: [`README.md`](../../../explorations/ten-minute-certainty/README.md),
  [`BRIEF.md`](../../../explorations/ten-minute-certainty/BRIEF.md),
  [`MAP.md`](../../../explorations/ten-minute-certainty/MAP.md),
  [`DECISIONS.md`](../../../explorations/ten-minute-certainty/DECISIONS.md),
  [`RESEARCH.md`](../../../explorations/ten-minute-certainty/RESEARCH.md),
  [`research/phase2/PLAN.md`](../../../explorations/ten-minute-certainty/research/phase2/PLAN.md).
- Requires: certainty-scorecard (`ci/certainty-scorecard`), route-soundness-repair (`ci/route-soundness`).
- Sibling goals from the same exploration: heavy-pool-diet (PERIH-11 pin bumps, Lint Policy diet),
  main-verdict-every-commit (cancel ban and throughput layout; per-SHA groups moved to `merge-queue-activation`, D28), local-proof-under-ten.
- Related goals: [`goals/ci-lane-economics`](../../ci-lane-economics/README.md) (partition layout, #3030,
  #3040, #3043), [`goals/yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md) (rerun-runner-loss),
  [`goals/turborepo-quality-cache-adoption`](../../turborepo-quality-cache-adoption/README.md) (paused, R2).
- Shipped precursors: #3005, #3028, #3029, #3030, #3039, #3040, #3041, #3043, #3045, #3046, #3056.
- Downstream: `explorations/github-merge-queue` (gated `merge-group-parity` waits on this goal merging, D28).
