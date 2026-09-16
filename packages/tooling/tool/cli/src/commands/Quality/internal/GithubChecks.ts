/**
 * GitHub check lane planning for Quality commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Match, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { readTurboCacheEnvironmentSync } from "../../../internal/cli/EnvConfig.ts";
import { resolveTurboCachePlan, turboCachePlanArgs } from "../../../internal/cli/TurboCache.ts";
import { QualityTaskStep } from "../../../internal/process/index.ts";
import { CiLocalStepPlan, ciLaneDispatchStep } from "../../Ci/CiLane.ts";
import {
  GithubCheckLaneSpec,
  GithubCheckLaneTier,
  GithubCheckLaneWave,
  GithubCheckLaneWaveSpec,
} from "../Quality.schemas.ts";
import type { CiLaneId } from "../../Ci/CiLane.ts";
import type {
  FallowQualityFeatureFamily,
  GithubCheckLaneStage,
  GithubCheckLaneWave as GithubCheckLaneWaveType,
  GithubCheckMode,
  GithubChecksFallowFeatureMatrix,
  GithubChecksFallowFeatureMatrixRow,
} from "../Quality.schemas.ts";

/**
 * Build a `bun run` quality lane step.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { bunRunLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(bunRunLane("/repo", "quality:check", ["check"]).args)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed after `bun run`.
 * @returns Planned quality task step.
 * @category utilities
 * @since 0.0.0
 */
const bunRunLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["run", ...args],
    cwd: repoRoot,
  });

/**
 * Build a `bunx` quality lane step.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { bunxLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(bunxLane("/repo", "repo-sanity:syncpack", ["syncpack", "lint"]).command)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed to `bunx`.
 * @returns Planned quality task step.
 * @category utilities
 * @since 0.0.0
 */
const bunxLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bunx",
    args,
    cwd: repoRoot,
  });

const rootTaskLane = (repoRoot: string, label: string, task: string, base?: string): QualityTaskStep =>
  QualityTaskStep.make({
    ...bunxLane(repoRoot, label, [
      "turbo",
      "run",
      task,
      ...turboCachePlanArgs(
        resolveTurboCachePlan(readTurboCacheEnvironmentSync(), {
          args: ["--summarize"],
          ci: Bun.env.CI === "true",
        })
      ),
      "--summarize",
    ]),
    ...(base === undefined ? {} : { env: { BEEP_PROOF_BASE: base } }),
  });

/**
 * Build a `bun run beep quality ...` lane step.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { repoCliLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(repoCliLane("/repo", "quality:knip", ["knip"]).args)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed after `beep quality`.
 * @returns Planned quality task step.
 * @category utilities
 * @since 0.0.0
 */
const repoCliLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  bunRunLane(repoRoot, label, ["beep", "quality", ...args]);

// PR shape for locally replayed hosted lanes: affected against the `origin/main`
// the collector already refreshed, matching what check.yml passes its matrix
// jobs. Env posture stays local on purpose — B1 makes the command identical, not
// the environment (`CI=true`, blank PR secrets, and cache flags belong to the
// later `--ci-parity` tier). `onMainBranch` only shapes the repo-sanity lane,
// which this collector plans separately.
const PRE_PUSH_CI_LANE_PLAN = CiLocalStepPlan.make({
  affected: true,
  base: "origin/main",
  onMainBranch: false,
});

/**
 * Build a pre-push lane step that dispatches the hosted lane body verbatim.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckQualityLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckQualityLanes("/repo")[1]?.step.args)
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Lane label used for failure attribution.
 * @param laneId - Hosted CI lane replayed by this pre-push lane.
 * @returns The `beep ci lane` dispatch step for the lane.
 * @category utilities
 * @since 0.0.0
 */
const ciLaneStep = (repoRoot: string, label: string, laneId: CiLaneId): QualityTaskStep =>
  ciLaneDispatchStep(repoRoot, label, laneId, PRE_PUSH_CI_LANE_PLAN);

/**
 * Opt a Turbo-backed lane into no-location TS2589 flake quarantine.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLanePlan } from "@beep/repo-cli/test/Quality"
 *
 * const lane = githubCheckLanePlan.bunRunLane("/repo", "quality:build", ["build"])
 * console.log(githubCheckLanePlan.ts2589QuarantineLane(lane).flakeQuarantine)
 * ```
 *
 * @param step - Planned lane step running a full Turbo build or check sweep.
 * @returns The same step carrying the `ts2589-no-location` quarantine policy.
 * @category utilities
 * @since 0.0.0
 */
const ts2589QuarantineLane = (step: QualityTaskStep): QualityTaskStep =>
  QualityTaskStep.make({
    ...step,
    flakeQuarantine: "ts2589-no-location",
  });

/**
 * Attach metadata to a GitHub check lane step.
 *
 * **Details**
 *
 * The lane id is the name of the command the lane runs and doubles as the
 * step label, so the `[beep-cli] <label>` log prefix, the lane-proof ledger
 * key, the remediation hint needle, and the wave-order seed key are one
 * string (TTC ruling 28). The tier is metadata: the same id may be scheduled
 * by both local proof tiers.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLane, bunRunLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLane("quality:check", "pre-push", "repo-quality", "heavy", bunRunLane("/repo", "quality:check", ["check"])).id)
 * ```
 *
 * @param id - Stable lane id; equals the step label.
 * @param tier - Local proof tier that schedules the lane.
 * @param stage - Stage bucket used for reporting.
 * @param wave - Static cost-ordered execution wave.
 * @param step - Planned subprocess step.
 * @param blockedBy - Upstream lane ids that must pass first.
 * @returns GitHub check lane specification.
 * @category utilities
 * @since 0.0.0
 */
const githubCheckLane = (
  id: string,
  tier: GithubCheckLaneTier,
  stage: GithubCheckLaneStage,
  wave: GithubCheckLaneWaveType,
  step: QualityTaskStep,
  blockedBy: ReadonlyArray<string> = A.empty<string>()
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    id,
    tier,
    stage,
    wave,
    blockedBy,
    step,
  });

/**
 * Re-home a lane spec under another local proof tier without changing its id.
 *
 * **Example** (Schedule a promoted Fallow lane in the cheap tier)
 *
 * ```ts
 * import { githubCheckFallowLanes, githubCheckLanePlan } from "@beep/repo-cli/test/Quality"
 * import * as A from "effect/Array"
 *
 * const lanes = A.map(githubCheckFallowLanes("/repo"), githubCheckLanePlan.githubCheckLaneInTier("cheap-gates"))
 * console.log(lanes[0]?.tier) // "cheap-gates"
 * ```
 *
 * @param lane - Lane spec declared for one tier.
 * @param tier - Tier that will schedule the lane.
 * @returns The same lane spec carrying the new tier.
 * @category utilities
 * @since 0.0.0
 */
const githubCheckLaneInTier: {
  (lane: GithubCheckLaneSpec, tier: GithubCheckLaneTier): GithubCheckLaneSpec;
  (tier: GithubCheckLaneTier): (lane: GithubCheckLaneSpec) => GithubCheckLaneSpec;
} = dual(
  2,
  (lane: GithubCheckLaneSpec, tier: GithubCheckLaneTier): GithubCheckLaneSpec =>
    GithubCheckLaneSpec.make({ ...lane, tier })
);

/**
 * Group lane specs into their static cost-ordered execution waves.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLaneWaves } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLaneWaves([]))
 * ```
 *
 * @param lanes - GitHub check lane specs.
 * @returns Non-empty waves in fail-fast execution order.
 * @category utilities
 * @since 0.0.0
 */
// Canonical local order: preflight -> heavy (build, lint, check) -> test -> documentation.
// Evidence: goals/quality-speedup/research/quality-time-inventory.md §2 records the cheap
// policy gates as higher-yield and JSDoc/Docgen as the slowest low-failure tail.
const githubCheckLaneWaves = (lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<GithubCheckLaneWaveSpec> =>
  pipe(
    GithubCheckLaneWave.Options,
    A.map((wave) => {
      const waveLanes = A.filter(lanes, (lane) => lane.wave === wave);
      return A.isReadonlyArrayEmpty(waveLanes)
        ? O.none()
        : O.some(GithubCheckLaneWaveSpec.make({ lanes: waveLanes, wave }));
    }),
    A.getSomes
  );

const githubCheckOrderedLaneWaves = (
  lanes: ReadonlyArray<GithubCheckLaneSpec>
): ReadonlyArray<GithubCheckLaneWaveSpec> =>
  A.map(lanes, (lane) => GithubCheckLaneWaveSpec.make({ lanes: [lane], wave: lane.wave }));

/**
 * Command-internal GitHub check lane constructors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLanePlan } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLanePlan.bunRunLane("/repo", "quality:check", ["check"]).label)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckLanePlan = {
  bunRunLane,
  githubCheckOrderedLaneWaves,
  githubCheckLane,
  githubCheckLaneInTier,
  githubCheckLaneWaves,
  repoCliLane,
  ts2589QuarantineLane,
} as const;

const tsconfigSyncLane = (repoRoot: string, tier: GithubCheckLaneTier): GithubCheckLaneSpec =>
  githubCheckLane(
    "repo-sanity:tsconfig-sync",
    tier,
    "repo-sanity",
    "preflight",
    rootTaskLane(repoRoot, "repo-sanity:tsconfig-sync", "config-sync:check")
  );

const knipLane = (repoRoot: string, tier: GithubCheckLaneTier): GithubCheckLaneSpec =>
  githubCheckLane(
    "quality:knip",
    tier,
    "repo-quality",
    "preflight",
    rootTaskLane(repoRoot, "quality:knip", "knip:check")
  );

/**
 * Build the repo-quality diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckQualityLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckQualityLanes("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-quality lane specifications.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckQualityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "quality:build",
    "pre-push",
    "repo-quality",
    "heavy",
    ts2589QuarantineLane(ciLaneStep(repoRoot, "quality:build", "build"))
  ),
  githubCheckLane("quality:lint", "pre-push", "repo-quality", "heavy", ciLaneStep(repoRoot, "quality:lint", "lint")),
  githubCheckLane(
    "quality:lint-policy",
    "pre-push",
    "repo-quality",
    "heavy",
    ciLaneStep(repoRoot, "quality:lint-policy", "lint-policy")
  ),
  // `quality:check` replays `beep ci lane check --affected`, whose root `bun run
  // check` carries the repo-wide `quality:test-tsgo` and `quality:tsgo-smoke`
  // extras by design: `shouldRunRepoWideSteps` demotes them only under an
  // explicit `--filter`/`--since`, never under `--affected`, so the affected
  // replay still owns the only gate on Effect tsgo diagnostics in test files.
  // Standalone copies of those extras were deleted as pure repeats
  // (quality-lane audit 2026-09-09, D6).
  githubCheckLane(
    "quality:check",
    "pre-push",
    "repo-quality",
    "heavy",
    ts2589QuarantineLane(ciLaneStep(repoRoot, "quality:check", "check"))
  ),
  knipLane(repoRoot, "pre-push"),
  githubCheckLane(
    "quality:jsdoc-ratchet",
    "pre-push",
    "repo-quality",
    "documentation",
    bunRunLane(repoRoot, "quality:jsdoc-ratchet", ["beep", "ci", "lane", "jsdoc-ratchet"])
  ),
  // Local proof uses bounded docgen (origin/main...HEAD + dirty files) and self-escalates
  // to the full proof when global docgen inputs changed; the hosted Docgen lane keeps the
  // full-repo proof (goals/quality-speedup grill decision, 2026-08-04).
  githubCheckLane(
    "quality:docgen",
    "pre-push",
    "repo-quality",
    "documentation",
    ciLaneStep(repoRoot, "quality:docgen", "docgen")
  ),
  // Hosted `Heavy / Doctest` is required; before this lane the local proof
  // reached it only through `beep ci local` during publish, so a branch could
  // be verify-green and red on a required context (quality-lane audit
  // 2026-09-09, C1 / D8). Affected mode matches the hosted PR shape.
  githubCheckLane(
    "quality:doctest",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:doctest", "doctest")
  ),
  githubCheckLane(
    "quality:coverage",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:coverage", "coverage")
  ),
  githubCheckLane(
    "quality:codegen",
    "pre-push",
    "repo-quality",
    "preflight",
    ciLaneStep(repoRoot, "quality:codegen", "codegen")
  ),
  githubCheckLane(
    "quality:commitlint",
    "pre-push",
    "repo-quality",
    "preflight",
    ciLaneStep(repoRoot, "quality:commitlint", "commitlint")
  ),
  githubCheckLane(
    "quality:desktop-ipc",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:desktop-ipc", "desktop-ipc")
  ),
  githubCheckLane(
    "quality:test-unit",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:test-unit", "test-unit")
  ),
  githubCheckLane(
    "quality:test-integration",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:test-integration", "test-integration")
  ),
  // Quality-lane audit D13: additive, non-required hosted context. The
  // pre-push plan passes the affected shape, which the lane turns into its
  // change-profile gate, so a branch without Storybook inputs pays one git
  // diff instead of the 584 s build + browser run.
  githubCheckLane(
    "quality:storybook",
    "pre-push",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:storybook", "storybook")
  ),
];

/**
 * Build the branch-only changeset-status preflight lane.
 *
 * **Details**
 *
 * Routes through the path-aware wrapper — `beep quality changeset-status`
 * with `--since origin/main` — so lab-only branches stay changeset-ceremony exempt
 * (lab-apps-lifecycle P2, ratified row 8). Declared for the pre-push tier; the
 * cheap tier re-homes it with {@link githubCheckLanePlan.githubCheckLaneInTier}.
 *
 * **Example** (Inspect the changeset preflight)
 *
 * ```ts
 * import { githubCheckChangesetStatusLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckChangesetStatusLane("/repo").wave) // "preflight"
 * ```
 *
 * @param repoRoot - Repository root path used as the subprocess working directory.
 * @returns The changeset-status lane assigned to the preflight wave.
 * @category constructors
 * @since 0.0.0
 */
export const githubCheckChangesetStatusLane = (repoRoot: string): GithubCheckLaneSpec =>
  githubCheckLane(
    "quality:changeset-status",
    "pre-push",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "quality:changeset-status", ["changeset-status", "--since", "origin/main"])
  );

/**
 * Build the repo-sanity diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckRepoSanityLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckRepoSanityLanes("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-sanity lane specifications.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckRepoSanityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "repo-sanity:changeset-graph",
    "pre-push",
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "repo-sanity:changeset-graph", ["changeset-graph"])
  ),
  tsconfigSyncLane(repoRoot, "pre-push"),
  githubCheckLane(
    "repo-sanity:fallow-boundaries-config",
    "pre-push",
    "repo-sanity",
    "preflight",
    rootTaskLane(repoRoot, "repo-sanity:fallow-boundaries-config", "fallow:boundaries:config-check")
  ),
  githubCheckLane(
    "repo-sanity:versions",
    "pre-push",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "repo-sanity:versions", ["version-sync", "--skip-network"])
  ),
  githubCheckLane(
    "repo-sanity:syncpack",
    "pre-push",
    "repo-sanity",
    "preflight",
    bunxLane(repoRoot, "repo-sanity:syncpack", ["syncpack", "lint"])
  ),
  githubCheckLane(
    "repo-sanity:sherif",
    "pre-push",
    "repo-sanity",
    "preflight",
    bunxLane(repoRoot, "repo-sanity:sherif", ["sherif@1.10.0", "-r", "non-existent-packages"])
  ),
  // Root tsconfig.configs.json: every vitest.*.ts plus the root config files
  // (syncpack, commitlint), which no package project reaches (D16 blind spot).
  githubCheckLane(
    "repo-sanity:config-typecheck",
    "pre-push",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "repo-sanity:config-typecheck", ["check:configs"])
  ),
  githubCheckLane(
    "repo-sanity:bun-audit",
    "pre-push",
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "repo-sanity:bun-audit", ["bun-audit"])
  ),
  githubCheckLane(
    "quality:cache-policy",
    "pre-push",
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "quality:cache-policy", ["cache-policy"])
  ),
];

/**
 * Build the external pre-push diagnostic lanes.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckPrePushExternalLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckPrePushExternalLanes("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered pre-push lane specifications for secrets, security, SAST, and Nix.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "quality:secrets",
    "pre-push",
    "diff-security",
    "preflight",
    ciLaneStep(repoRoot, "quality:secrets", "secrets")
  ),
  githubCheckLane(
    "quality:security",
    "pre-push",
    "diff-security",
    "preflight",
    ciLaneStep(repoRoot, "quality:security", "security")
  ),
  githubCheckLane(
    "quality:sast",
    "pre-push",
    "diff-security",
    "preflight",
    ciLaneStep(repoRoot, "quality:sast", "sast")
  ),
  githubCheckLane("quality:nix", "pre-push", "environment", "preflight", ciLaneStep(repoRoot, "quality:nix", "nix")),
];

/**
 * Lanes one local proof tier runs at once.
 *
 * **Details**
 *
 * The cheap tier is sixteen-odd sub-second gates that each pay a
 * `bun run beep` boot, so it runs four abreast; wave order still decides
 * which red is reported first. Pre-push lanes are heavy Turbo runs that already saturate
 * the machine, so that tier stays serial (quality-lane audit 2026-09-09, D9).
 *
 * **Example** (Read the cheap tier's width)
 *
 * ```ts
 * import { githubCheckTierConcurrency } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckTierConcurrency("cheap-gates")) // 4
 * ```
 *
 * @param tier - Local proof tier.
 * @returns Lane concurrency for one wave of that tier.
 * @category configuration
 * @since 0.0.0
 */
export const githubCheckTierConcurrency = (tier: GithubCheckLaneTier): number =>
  GithubCheckLaneTier.$match(tier, { "cheap-gates": () => 4, "pre-push": () => 1 });

const fallowGithubCheckLaneId = (featureFamily: FallowQualityFeatureFamily): string => `fallow:${featureFamily}`;

// Promoted blocking Fallow lanes (goals/fallow-quality-enforcement feature
// matrix rows with promotionStatus blocking). Dead-code holds the zero
// regression baseline, health holds the committed complexity baseline, and
// audit gates introduced complexity and duplication findings.
/**
 * Build promoted Fallow lanes included in pre-push checks.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckFallowLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckFallowLanes("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered promoted Fallow lane specifications.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckFallowLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "fallow:audit",
    "pre-push",
    "repo-quality",
    "preflight",
    rootTaskLane(repoRoot, "fallow:audit", "fallow:audit:check", PRE_PUSH_CI_LANE_PLAN.base)
  ),
  githubCheckLane(
    "fallow:dead-code",
    "pre-push",
    "repo-quality",
    "preflight",
    rootTaskLane(repoRoot, "fallow:dead-code", "fallow:dead-code:check", PRE_PUSH_CI_LANE_PLAN.base)
  ),
  githubCheckLane(
    "fallow:health",
    "pre-push",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "fallow:health", ["fallow", "health", "--check", "--quiet"])
  ),
];

/**
 * Build the deterministic cheap-gate tier that precedes local full proofs.
 *
 * **Details**
 *
 * Every lane belongs to the same preflight wave so the caller can collect all
 * failures without scheduling any heavyweight build, lint, check, test, or
 * docgen lane. Lanes that repeat a lint-policy step or a pre-push lane carry
 * that step's id, so one command has one name across tiers (TTC ruling 28).
 * The committed-inventory comparison remains a distinct CLI aggregate; the
 * hosted JSDoc dispatcher generates a fresh Turbo inventory before comparison.
 *
 * **Example** (Inspect cheap gates)
 *
 * ```ts
 * import { githubCheckCheapGateLanes } from "@beep/repo-cli/test/Quality"
 * import * as A from "effect/Array"
 *
 * console.log(A.every(githubCheckCheapGateLanes("/repo"), (lane) => lane.wave === "preflight"))
 * ```
 *
 * @param repoRoot - Repository root used as every subprocess working directory.
 * @returns Ordered cheap-gate lane specifications.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckCheapGateLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "quality:cache-policy",
    "cheap-gates",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "quality:cache-policy", ["cache-policy"])
  ),
  githubCheckLane(
    "goals:index-check",
    "cheap-gates",
    "repo-sanity",
    "preflight",
    rootTaskLane(repoRoot, "goals:index-check", "goals:index-check")
  ),
  githubCheckLane(
    "explore:atlas-check",
    "cheap-gates",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "explore:atlas-check", ["beep", "explore", "atlas", "--check"])
  ),
  tsconfigSyncLane(repoRoot, "cheap-gates"),
  githubCheckLane(
    "lint:effect-imports",
    "cheap-gates",
    "repo-quality",
    "preflight",
    rootTaskLane(repoRoot, "lint:effect-imports", "lint:effect-imports")
  ),
  githubCheckLane(
    "lint:schema-first",
    "cheap-gates",
    "repo-quality",
    "preflight",
    rootTaskLane(repoRoot, "lint:schema-first", "lint:schema-first")
  ),
  githubCheckLane(
    "lint:effect-vitest",
    "cheap-gates",
    "repo-quality",
    "preflight",
    bunRunLane(repoRoot, "lint:effect-vitest", ["beep", "lint", "effect-vitest"])
  ),
  githubCheckLane(
    "lint:allowlist",
    "cheap-gates",
    "repo-sanity",
    "preflight",
    rootTaskLane(repoRoot, "lint:allowlist", "lint:allowlist")
  ),
  githubCheckLane(
    "goals:doctor",
    "cheap-gates",
    "repo-sanity",
    "preflight",
    rootTaskLane(repoRoot, "goals:doctor", "goals:doctor")
  ),
  githubCheckLane(
    "quality:jsdoc-ratchet:committed",
    "cheap-gates",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "quality:jsdoc-ratchet:committed", ["jsdoc-ratchet"])
  ),
  knipLane(repoRoot, "cheap-gates"),
  ...A.map(githubCheckFallowLanes(repoRoot), githubCheckLaneInTier("cheap-gates")),
];

const isBlockingFallowMatrixRow = (row: GithubChecksFallowFeatureMatrixRow): boolean =>
  row.promotionStatus === "candidate-blocking" || row.promotionStatus === "blocking" || row.ciMode === "blocking-check";

/**
 * Derive the GitHub check lane ids required by currently promoted Fallow matrix rows.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { GithubChecksFallowFeatureMatrix, promotedFallowGithubCheckLaneIdsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(promotedFallowGithubCheckLaneIdsForTesting(matrix))
 * ```
 *
 * @param matrix - Minimal Fallow feature matrix.
 * @returns Sorted lane ids for feature families marked as blocking.
 * @category testing
 * @since 0.0.0
 */
export const promotedFallowGithubCheckLaneIdsForTesting = (
  matrix: GithubChecksFallowFeatureMatrix
): ReadonlyArray<string> =>
  pipe(
    matrix.features,
    A.filter(isBlockingFallowMatrixRow),
    A.map((row) => fallowGithubCheckLaneId(row.featureFamily)),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Return the static GitHub check collector lanes for a mode.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLanesForModeForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLanesForModeForTesting("/repo", "pre-push").map((lane) => lane.id))
 * ```
 *
 * @param repoRoot - Repository root used for subprocess working directories.
 * @param mode - GitHub check mode.
 * @returns Static lane specs owned by the mode.
 * @category testing
 * @since 0.0.0
 */
export const githubCheckLanesForModeForTesting: {
  (repoRoot: string, mode: GithubCheckMode): ReadonlyArray<GithubCheckLaneSpec>;
  (mode: GithubCheckMode): (repoRoot: string) => ReadonlyArray<GithubCheckLaneSpec>;
} = dual(2, (repoRoot: string, mode: GithubCheckMode): ReadonlyArray<GithubCheckLaneSpec> => {
  const externalLanes = githubCheckPrePushExternalLanes(repoRoot);
  const externalLane = (id: string): ReadonlyArray<GithubCheckLaneSpec> =>
    pipe(
      externalLanes,
      A.findFirst((lane) => lane.id === id),
      O.match({
        onNone: A.empty<GithubCheckLaneSpec>,
        onSome: A.of,
      })
    );

  return pipe(
    Match.value(mode),
    Match.when("cheap-gates", () => githubCheckCheapGateLanes(repoRoot)),
    Match.when("quality", () => [...githubCheckQualityLanes(repoRoot), ...githubCheckRepoSanityLanes(repoRoot)]),
    Match.when("repo-sanity", () => githubCheckRepoSanityLanes(repoRoot)),
    Match.when("secrets", () => externalLane("quality:secrets")),
    Match.when("security", () => externalLane("quality:security")),
    Match.when("sast", () => externalLane("quality:sast")),
    Match.when("nix", () => externalLane("quality:nix")),
    Match.when("pre-push", () => [
      ...githubCheckQualityLanes(repoRoot),
      ...githubCheckFallowLanes(repoRoot),
      ...githubCheckRepoSanityLanes(repoRoot),
      ...githubCheckPrePushExternalLanes(repoRoot),
    ]),
    Match.when("review-fix", A.empty<GithubCheckLaneSpec>),
    Match.exhaustive
  );
});

/**
 * Compare promoted Fallow matrix rows against static GitHub check lanes.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { GithubChecksFallowFeatureMatrix, githubCheckPromotedFallowLaneDiagnosticsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix))
 * ```
 *
 * @param repoRoot - Repository root used for lane construction.
 * @param mode - GitHub check mode to inspect.
 * @param matrix - Minimal Fallow feature matrix.
 * @returns Diagnostics explaining missing or premature Fallow pre-push lanes.
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPromotedFallowLaneDiagnosticsForTesting: {
  (repoRoot: string, mode: GithubCheckMode, matrix: GithubChecksFallowFeatureMatrix): ReadonlyArray<string>;
  (mode: GithubCheckMode, matrix: GithubChecksFallowFeatureMatrix): (repoRoot: string) => ReadonlyArray<string>;
} = dual(
  3,
  (repoRoot: string, mode: GithubCheckMode, matrix: GithubChecksFallowFeatureMatrix): ReadonlyArray<string> => {
    const promotedLaneIds = promotedFallowGithubCheckLaneIdsForTesting(matrix);
    const actualLaneIds = pipe(
      githubCheckLanesForModeForTesting(repoRoot, mode),
      A.map((lane) => lane.id),
      A.dedupe,
      A.sort(Order.String)
    );
    const actualFallowLaneIds = A.filter(actualLaneIds, Str.startsWith("fallow:"));
    const missingPromotedLaneIds = A.filter(promotedLaneIds, (laneId) => !A.contains(actualLaneIds, laneId));
    const unpromotedLaneIds = A.filter(actualFallowLaneIds, (laneId) => !A.contains(promotedLaneIds, laneId));

    return [
      ...A.map(missingPromotedLaneIds, (laneId) => `missing promoted Fallow GitHub check lane ${laneId}`),
      ...A.map(unpromotedLaneIds, (laneId) => `unpromoted Fallow GitHub check lane is wired: ${laneId}`),
    ];
  }
);

/**
 * Build the repo-quality diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckQualityLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckQualityLanesForTesting("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-quality lane specifications.
 * @category testing
 * @since 0.0.0
 */
export const githubCheckQualityLanesForTesting = githubCheckQualityLanes;

/**
 * Build the repo-sanity diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckRepoSanityLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckRepoSanityLanesForTesting("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-sanity lane specifications.
 * @category testing
 * @since 0.0.0
 */
export const githubCheckRepoSanityLanesForTesting = githubCheckRepoSanityLanes;

/**
 * Build the external pre-push diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckPrePushExternalLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckPrePushExternalLanesForTesting("/repo"))
 * ```
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered pre-push lane specifications for secrets, security, SAST, and Nix.
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanesForTesting = githubCheckPrePushExternalLanes;
