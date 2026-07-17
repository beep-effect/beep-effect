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
import { GithubCheckLaneSpec } from "../Quality.schemas.ts";
import type {
  FallowQualityFeatureFamily,
  GithubCheckLaneStage,
  GithubCheckMode,
  GithubChecksFallowFeatureMatrix,
  GithubChecksFallowFeatureMatrixRow,
} from "../Quality.schemas.ts";

/**
 * Build a `bun run` quality lane step.
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed after `bun run`.
 * @returns Planned quality task step.
 * @example
 * ```ts
 * import { bunRunLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(bunRunLane("/repo", "quality:check", ["check"]).args)
 * ```
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
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed to `bunx`.
 * @returns Planned quality task step.
 * @example
 * ```ts
 * import { bunxLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(bunxLane("/repo", "repo-sanity:syncpack", ["syncpack", "lint"]).command)
 * ```
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
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param label - Human-readable lane label.
 * @param args - Arguments passed after `beep quality`.
 * @returns Planned quality task step.
 * @example
 * ```ts
 * import { repoCliLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(repoCliLane("/repo", "quality:knip", ["knip"]).args)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const repoCliLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  bunRunLane(repoRoot, label, ["beep", "quality", ...args]);

/**
 * Attach metadata to a GitHub check lane step.
 *
 * @param id - Stable lane id.
 * @param stage - Stage bucket used for reporting.
 * @param step - Planned subprocess step.
 * @param blockedBy - Upstream lane ids that must pass first.
 * @returns GitHub check lane specification.
 * @example
 * ```ts
 * import { githubCheckLane, bunRunLane } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLane("quality:check", "repo-quality", bunRunLane("/repo", "quality:check", ["check"])).id)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const githubCheckLane = (
  id: string,
  stage: GithubCheckLaneStage,
  step: QualityTaskStep,
  blockedBy: ReadonlyArray<string> = A.empty<string>()
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    id,
    stage,
    blockedBy,
    step,
  });

/**
 * Project lane specs down to executable task steps.
 *
 * @param lanes - GitHub check lane specs.
 * @returns Quality task steps in lane order.
 * @example
 * ```ts
 * import { githubCheckLaneSteps } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLaneSteps([]))
 * ```
 * @category utilities
 * @since 0.0.0
 */
const githubCheckLaneSteps = (lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<QualityTaskStep> =>
  A.map(lanes, (lane) => lane.step);

/**
 * Command-internal GitHub check lane constructors.
 *
 * @example
 * ```ts
 * import { githubCheckLanePlan } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLanePlan.bunRunLane("/repo", "quality:check", ["check"]).label)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckLanePlan = {
  bunRunLane,
  githubCheckLane,
  githubCheckLaneSteps,
  repoCliLane,
} as const;

/**
 * Build the repo-quality diagnostic lanes used by GitHub check collectors.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-quality lane specifications.
 * @example
 * ```ts
 * import { githubCheckQualityLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckQualityLanes("/repo"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckQualityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane("quality:build", "repo-quality", bunRunLane(repoRoot, "quality:build", ["build"])),
  githubCheckLane("quality:check", "repo-quality", bunRunLane(repoRoot, "quality:check", ["check"])),
  githubCheckLane("quality:knip", "repo-quality", repoCliLane(repoRoot, "quality:knip", ["knip"])),
  githubCheckLane(
    "quality:jsdoc-ratchet",
    "repo-quality",
    bunRunLane(repoRoot, "quality:jsdoc-ratchet", ["beep", "ci", "lane", "jsdoc-ratchet"])
  ),
  githubCheckLane("quality:lint", "repo-quality", bunRunLane(repoRoot, "quality:lint", ["lint"])),
  githubCheckLane("quality:docgen", "repo-quality", bunRunLane(repoRoot, "quality:docgen", ["docgen"])),
  githubCheckLane("quality:test", "repo-quality", bunRunLane(repoRoot, "quality:test", ["test"])),
];

/**
 * Build the repo-sanity diagnostic lanes used by GitHub check collectors.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-sanity lane specifications.
 * @example
 * ```ts
 * import { githubCheckRepoSanityLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckRepoSanityLanes("/repo"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckRepoSanityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "repo-sanity:changeset-graph",
    "repo-sanity",
    repoCliLane(repoRoot, "repo-sanity:changeset-graph", ["changeset-graph"])
  ),
  githubCheckLane(
    "repo-sanity:tsconfig-sync",
    "repo-sanity",
    bunRunLane(repoRoot, "repo-sanity:tsconfig-sync", ["config-sync:check"])
  ),
  githubCheckLane(
    "repo-sanity:fallow-boundaries-config",
    "repo-sanity",
    repoCliLane(repoRoot, "repo-sanity:fallow-boundaries-config", ["fallow", "boundaries", "config-check", "--check"])
  ),
  githubCheckLane(
    "repo-sanity:versions",
    "repo-sanity",
    bunRunLane(repoRoot, "repo-sanity:versions", ["version-sync", "--skip-network"])
  ),
  githubCheckLane(
    "repo-sanity:syncpack",
    "repo-sanity",
    bunxLane(repoRoot, "repo-sanity:syncpack", ["syncpack", "lint"])
  ),
  githubCheckLane(
    "repo-sanity:sherif",
    "repo-sanity",
    bunxLane(repoRoot, "repo-sanity:sherif", ["sherif@1.10.0", "-r", "non-existent-packages"])
  ),
  githubCheckLane(
    "repo-sanity:bun-audit",
    "repo-sanity",
    repoCliLane(repoRoot, "repo-sanity:bun-audit", ["bun-audit"])
  ),
];

/**
 * Build the external pre-push diagnostic lanes.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered pre-push lane specifications for secrets, security, SAST, and Nix.
 * @example
 * ```ts
 * import { githubCheckPrePushExternalLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckPrePushExternalLanes("/repo"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "pre-push:secrets",
    "diff-security",
    repoCliLane(repoRoot, "pre-push:secrets", ["github-checks", "secrets"])
  ),
  githubCheckLane(
    "pre-push:security",
    "diff-security",
    repoCliLane(repoRoot, "pre-push:security", ["github-checks", "security"])
  ),
  githubCheckLane("pre-push:sast", "diff-security", repoCliLane(repoRoot, "pre-push:sast", ["github-checks", "sast"])),
  githubCheckLane("pre-push:nix", "environment", repoCliLane(repoRoot, "pre-push:nix", ["github-checks", "nix"])),
];

const fallowGithubCheckLaneId = (featureFamily: FallowQualityFeatureFamily): string => `fallow:${featureFamily}`;

// Promoted blocking Fallow lanes (goals/fallow-quality-enforcement feature
// matrix rows with promotionStatus blocking). The dead-code lane holds the
// zero regression baseline. The audit lane (complexity/duplication smells) is
// advisory-only and is no longer wired here.
/**
 * Build promoted Fallow lanes included in pre-push checks.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered promoted Fallow lane specifications.
 * @example
 * ```ts
 * import { githubCheckFallowLanes } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckFallowLanes("/repo"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckFallowLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane(
    "fallow:audit",
    "repo-quality",
    repoCliLane(repoRoot, "fallow:audit", ["fallow", "audit", "--check", "--quiet"])
  ),
  githubCheckLane(
    "fallow:dead-code",
    "repo-quality",
    repoCliLane(repoRoot, "fallow:dead-code", ["fallow", "dead-code", "--check", "--quiet"])
  ),
];

const isBlockingFallowMatrixRow = (row: GithubChecksFallowFeatureMatrixRow): boolean =>
  row.promotionStatus === "candidate-blocking" || row.promotionStatus === "blocking" || row.ciMode === "blocking-check";

/**
 * Derive the GitHub check lane ids required by currently promoted Fallow matrix rows.
 *
 * @param matrix - Minimal Fallow feature matrix.
 * @returns Sorted lane ids for feature families marked as blocking.
 * @example
 * ```ts
 * import { GithubChecksFallowFeatureMatrix, promotedFallowGithubCheckLaneIdsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(promotedFallowGithubCheckLaneIdsForTesting(matrix))
 * ```
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
 * @param repoRoot - Repository root used for subprocess working directories.
 * @param mode - GitHub check mode.
 * @returns Static lane specs owned by the mode.
 * @example
 * ```ts
 * import { githubCheckLanesForModeForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckLanesForModeForTesting("/repo", "pre-push").map((lane) => lane.id))
 * ```
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
 * @param repoRoot - Repository root used for lane construction.
 * @param mode - GitHub check mode to inspect.
 * @param matrix - Minimal Fallow feature matrix.
 * @returns Diagnostics explaining missing or premature Fallow pre-push lanes.
 * @example
 * ```ts
 * import { GithubChecksFallowFeatureMatrix, githubCheckPromotedFallowLaneDiagnosticsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix))
 * ```
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
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-quality lane specifications.
 * @example
 * ```ts
 * import { githubCheckQualityLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckQualityLanesForTesting("/repo"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const githubCheckQualityLanesForTesting = githubCheckQualityLanes;

/**
 * Build the repo-sanity diagnostic lanes used by GitHub check collectors.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered repo-sanity lane specifications.
 * @example
 * ```ts
 * import { githubCheckRepoSanityLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckRepoSanityLanesForTesting("/repo"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const githubCheckRepoSanityLanesForTesting = githubCheckRepoSanityLanes;

/**
 * Build the external pre-push diagnostic lanes used by GitHub check collectors.
 *
 * @param repoRoot - Repository root path used as every subprocess working directory.
 * @returns Ordered pre-push lane specifications for secrets, security, SAST, and Nix.
 * @example
 * ```ts
 * import { githubCheckPrePushExternalLanesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckPrePushExternalLanesForTesting("/repo"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanesForTesting = githubCheckPrePushExternalLanes;
