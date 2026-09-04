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
import { QualityTaskStep } from "../../../internal/process/index.ts";
import { CiLocalStepPlan, ciLaneDispatchStep } from "../../Ci/CiLane.ts";
import { GithubCheckLaneSpec, GithubCheckLaneWave, GithubCheckLaneWaveSpec } from "../Quality.schemas.ts";
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
 * **Example** (Inspect GitHub checks)
 *
 * ```ts
 * import { githubCheckLane, bunRunLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLane("quality:check", "repo-quality", "heavy", bunRunLane("/repo", "quality:check", ["check"])).id)
 * ```
 *
 * @param id - Stable lane id.
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
  stage: GithubCheckLaneStage,
  wave: GithubCheckLaneWaveType,
  step: QualityTaskStep,
  blockedBy: ReadonlyArray<string> = A.empty<string>()
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    id,
    stage,
    wave,
    blockedBy,
    step,
  });

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
  githubCheckLaneWaves,
  repoCliLane,
  ts2589QuarantineLane,
} as const;

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
    "repo-quality",
    "heavy",
    ts2589QuarantineLane(ciLaneStep(repoRoot, "quality:build", "build"))
  ),
  githubCheckLane("quality:lint", "repo-quality", "heavy", ciLaneStep(repoRoot, "quality:lint", "lint")),
  githubCheckLane(
    "quality:lint-policy",
    "repo-quality",
    "heavy",
    ciLaneStep(repoRoot, "quality:lint-policy", "lint-policy")
  ),
  githubCheckLane(
    "quality:check",
    "repo-quality",
    "heavy",
    ts2589QuarantineLane(ciLaneStep(repoRoot, "quality:check", "check"))
  ),
  // The hosted Check context runs affected-scoped, which suppresses the two
  // repo-wide extras root `bun run check` used to carry. They are the only gate
  // on Effect tsgo diagnostics in test files, so they stay as their own local
  // lanes rather than disappearing with the root command.
  githubCheckLane(
    "quality:check:tsgo-tests",
    "repo-quality",
    "heavy",
    repoCliLane(repoRoot, "quality:check:tsgo-tests", ["test-tsgo"])
  ),
  githubCheckLane(
    "quality:check:tsgo-smoke",
    "repo-quality",
    "heavy",
    repoCliLane(repoRoot, "quality:check:tsgo-smoke", ["tsgo-smoke"])
  ),
  githubCheckLane("quality:knip", "repo-quality", "preflight", repoCliLane(repoRoot, "quality:knip", ["knip"])),
  githubCheckLane(
    "quality:jsdoc-ratchet",
    "repo-quality",
    "documentation",
    bunRunLane(repoRoot, "quality:jsdoc-ratchet", ["beep", "ci", "lane", "jsdoc-ratchet"])
  ),
  // Local proof uses bounded docgen (origin/main...HEAD + dirty files) and self-escalates
  // to the full proof when global docgen inputs changed; the hosted Docgen lane keeps the
  // full-repo proof (goals/quality-speedup grill decision, 2026-08-04).
  githubCheckLane("quality:docgen", "repo-quality", "documentation", ciLaneStep(repoRoot, "quality:docgen", "docgen")),
  githubCheckLane("quality:coverage", "repo-quality", "test", ciLaneStep(repoRoot, "quality:coverage", "coverage")),
  githubCheckLane("quality:codegen", "repo-quality", "preflight", ciLaneStep(repoRoot, "quality:codegen", "codegen")),
  githubCheckLane(
    "quality:commitlint",
    "repo-quality",
    "preflight",
    ciLaneStep(repoRoot, "quality:commitlint", "commitlint")
  ),
  githubCheckLane(
    "quality:desktop-ipc",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:desktop-ipc", "desktop-ipc")
  ),
  githubCheckLane("quality:test-unit", "repo-quality", "test", ciLaneStep(repoRoot, "quality:test-unit", "test-unit")),
  githubCheckLane(
    "quality:test-integration",
    "repo-quality",
    "test",
    ciLaneStep(repoRoot, "quality:test-integration", "test-integration")
  ),
];

/**
 * Build the branch-only changeset-status preflight lane.
 *
 * **Details**
 *
 * Routes through the path-aware wrapper — `beep quality changeset-status`
 * with `--since origin/main` — so lab-only branches stay changeset-ceremony exempt
 * (lab-apps-lifecycle P2, ratified row 8).
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
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "repo-sanity:changeset-graph", ["changeset-graph"])
  ),
  githubCheckLane(
    "repo-sanity:tsconfig-sync",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "repo-sanity:tsconfig-sync", ["config-sync:check"])
  ),
  githubCheckLane(
    "repo-sanity:fallow-boundaries-config",
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "repo-sanity:fallow-boundaries-config", ["fallow", "boundaries", "config-check", "--check"])
  ),
  githubCheckLane(
    "repo-sanity:versions",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "repo-sanity:versions", ["version-sync", "--skip-network"])
  ),
  githubCheckLane(
    "repo-sanity:syncpack",
    "repo-sanity",
    "preflight",
    bunxLane(repoRoot, "repo-sanity:syncpack", ["syncpack", "lint"])
  ),
  githubCheckLane(
    "repo-sanity:sherif",
    "repo-sanity",
    "preflight",
    bunxLane(repoRoot, "repo-sanity:sherif", ["sherif@1.10.0", "-r", "non-existent-packages"])
  ),
  githubCheckLane(
    "repo-sanity:bun-audit",
    "repo-sanity",
    "preflight",
    repoCliLane(repoRoot, "repo-sanity:bun-audit", ["bun-audit"])
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
    "pre-push:secrets",
    "diff-security",
    "preflight",
    ciLaneStep(repoRoot, "pre-push:secrets", "secrets")
  ),
  githubCheckLane(
    "pre-push:security",
    "diff-security",
    "preflight",
    ciLaneStep(repoRoot, "pre-push:security", "security")
  ),
  githubCheckLane("pre-push:sast", "diff-security", "preflight", ciLaneStep(repoRoot, "pre-push:sast", "sast")),
  githubCheckLane("pre-push:nix", "environment", "preflight", ciLaneStep(repoRoot, "pre-push:nix", "nix")),
];

const fallowGithubCheckLaneId = (featureFamily: FallowQualityFeatureFamily): string => `fallow:${featureFamily}`;

// Promoted blocking Fallow lanes (goals/fallow-quality-enforcement feature
// matrix rows with promotionStatus blocking). The dead-code lane holds the
// zero regression baseline. The audit lane (complexity/duplication smells) is
// advisory-only and is no longer wired here.
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
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "fallow:audit", ["fallow", "audit", "--check", "--quiet"])
  ),
  githubCheckLane(
    "fallow:dead-code",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "fallow:dead-code", ["fallow", "dead-code", "--check", "--quiet"])
  ),
];

/**
 * Build the deterministic cheap-gate tier that precedes local full proofs.
 *
 * **Details**
 *
 * Every lane belongs to the same preflight wave so the caller can collect all
 * failures without scheduling any heavyweight build, lint, check, test, or
 * docgen lane. The JSDoc lane reads the committed inventory and baseline; the
 * full inventory rescan remains in the documentation wave of `pre-push`.
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
    "cheap-gates:goals-index",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:goals-index", ["beep", "goals", "index", "--check"])
  ),
  githubCheckLane(
    "cheap-gates:exploration-atlas",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:exploration-atlas", ["beep", "explore", "atlas", "--check"])
  ),
  githubCheckLane(
    "cheap-gates:config-sync",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:config-sync", ["config-sync:check"])
  ),
  githubCheckLane(
    "cheap-gates:tsgo-rules",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "cheap-gates:tsgo-rules", ["tsgo-rules"])
  ),
  githubCheckLane(
    "cheap-gates:test-tsgo",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "cheap-gates:test-tsgo", ["test-tsgo"])
  ),
  githubCheckLane(
    "cheap-gates:effect-imports",
    "repo-quality",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:effect-imports", ["beep", "laws", "effect-imports", "--check"])
  ),
  githubCheckLane(
    "cheap-gates:schema-first",
    "repo-quality",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:schema-first", ["beep", "lint", "schema-first"])
  ),
  githubCheckLane(
    "cheap-gates:allowlist-check",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:allowlist-check", ["beep", "laws", "allowlist-check"])
  ),
  githubCheckLane(
    "cheap-gates:goals-doctor",
    "repo-sanity",
    "preflight",
    bunRunLane(repoRoot, "cheap-gates:goals-doctor", ["beep", "goals", "doctor"])
  ),
  githubCheckLane(
    "cheap-gates:jsdoc-ratchet",
    "repo-quality",
    "preflight",
    repoCliLane(repoRoot, "cheap-gates:jsdoc-ratchet", ["jsdoc-ratchet"])
  ),
  githubCheckLane("cheap-gates:knip", "repo-quality", "preflight", repoCliLane(repoRoot, "cheap-gates:knip", ["knip"])),
  ...githubCheckFallowLanes(repoRoot),
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
    Match.when("secrets", () => externalLane("pre-push:secrets")),
    Match.when("security", () => externalLane("pre-push:security")),
    Match.when("sast", () => externalLane("pre-push:sast")),
    Match.when("nix", () => externalLane("pre-push:nix")),
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
