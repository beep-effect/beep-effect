/**
 * Schema role file for the Quality command family.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import * as S from "effect/Schema";
import { QualityTaskStep } from "../../internal/process/index.ts";
import { GITHUB_CHECK_MODE_VALUES, GithubCheckMode as GithubCheckModeSchema } from "../../internal/repo-run/index.ts";
import type { GithubCheckMode as GithubCheckModeType } from "../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Quality/Quality.schemas");

/**
 * Canonical quality task name.
 *
 * @example
 * ```ts
 * import { QualityTaskName } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QualityTaskName.is.lint("lint"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityTaskName = LiteralKit(["build", "check", "test", "lint", "audit", "coverage"]).pipe(
  $I.annoteSchema("QualityTaskName", {
    description: "Canonical quality task name handled by beep-cli.",
  })
);

/**
 * Canonical quality task name.
 *
 * @example
 * ```ts
 * import type { QualityTaskName } from "@beep/repo-cli/commands/Quality"
 *
 * const task: QualityTaskName = "check"
 * console.log(task) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type QualityTaskName = typeof QualityTaskName.Type;

/**
 * Root CLI flags that bypass the quality task fast path.
 *
 * @example
 * ```ts
 * import { QualityTaskBypassArgName } from "@beep/repo-cli/test/Quality"
 *
 * console.log(QualityTaskBypassArgName.is["--help"]("--help"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityTaskBypassArgName = LiteralKit([
  "--completions",
  "--help",
  "--log-level",
  "--version",
  "-h",
  "-v",
]).pipe(
  $I.annoteSchema("QualityTaskBypassArgName", {
    description: "Root CLI flag names that must bypass the quality task fast path.",
  })
);

/**
 * Root CLI flag name that bypasses the quality task fast path.
 *
 * @example
 * ```ts
 * import type { QualityTaskBypassArgName } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const flag: QualityTaskBypassArgName = "--help"
 * console.log(flag) // "--help"
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type QualityTaskBypassArgName = typeof QualityTaskBypassArgName.Type;

/**
 * Lint policy subcommands owned by the full command tree.
 *
 * @example
 * ```ts
 * import { LintPolicySubcommand } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LintPolicySubcommand.is.policy("policy"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const LintPolicySubcommand = LiteralKit([
  "circular",
  "deprecated-apis",
  "goal-packets",
  "identity-registry",
  "package-test-imports",
  "policy",
  "reflection-artifacts",
  "roadmap-refs",
  "schema-first",
  "schema-topology",
  "tooling-schema-first",
]).pipe(
  $I.annoteSchema("LintPolicySubcommand", {
    description: "Lint policy subcommands that remain owned by the full command tree.",
  })
);

/**
 * Lint policy subcommand owned by the full command tree.
 *
 * @example
 * ```ts
 * import type { LintPolicySubcommand } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const subcommand: LintPolicySubcommand = "schema-first"
 * console.log(subcommand) // "schema-first"
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type LintPolicySubcommand = typeof LintPolicySubcommand.Type;

/**
 * Root audit mode names supported by the quality task adapter.
 *
 * @example
 * ```ts
 * import { RootAuditMode } from "@beep/repo-cli/test/Quality"
 *
 * console.log(RootAuditMode.is.github("github"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const RootAuditMode = LiteralKit(["packages", "github"]).pipe(
  $I.annoteSchema("RootAuditMode", {
    description: "Root audit mode names supported by the quality task adapter.",
  })
);

/**
 * Root audit mode name.
 *
 * @example
 * ```ts
 * import type { RootAuditMode } from "@beep/repo-cli/test/Quality"
 *
 * const mode: RootAuditMode = "packages"
 * console.log(mode) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type RootAuditMode = typeof RootAuditMode.Type;

/**
 * Package-local script profile used by the quality task adapter.
 *
 * @example
 * ```ts
 * import { PackageTaskProfile } from "@beep/repo-cli/commands/Quality"
 *
 * const profile = PackageTaskProfile.make({
 *   task: "lint",
 *   script: "beep:lint",
 *   fixScript: "beep:lint:fix"
 * })
 * console.log(profile.script)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageTaskProfile extends S.Class<PackageTaskProfile>($I`PackageTaskProfile`)(
  {
    task: QualityTaskName,
    script: S.String,
    fixScript: S.optionalKey(S.String),
  },
  $I.annote("PackageTaskProfile", {
    description: "Package-local script profile used by the quality task adapter.",
  })
) {}

/**
 * Result of parsing a quality command invocation.
 *
 * @example
 * ```ts
 * import { QualityTaskInvocation } from "@beep/repo-cli/commands/Quality"
 *
 * const invocation = QualityTaskInvocation.make({
 *   task: "lint",
 *   args: ["--filter=@beep/repo-cli"],
 *   fix: false
 * })
 * console.log(invocation.task)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityTaskInvocation extends S.Class<QualityTaskInvocation>($I`QualityTaskInvocation`)(
  {
    task: QualityTaskName,
    args: S.Array(S.String),
    fix: S.Boolean,
  },
  $I.annote("QualityTaskInvocation", {
    description: "Result of parsing a quality command invocation.",
  })
) {}

/**
 * Object-form `package.json` workspaces entry used by quality task resolution.
 *
 * @example
 * ```ts
 * import { PackageJsonWorkspacesDocument } from "@beep/repo-cli/test/Quality"
 *
 * const workspaces = PackageJsonWorkspacesDocument.make({ packages: ["packages/*"] })
 * console.log(workspaces.packages)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageJsonWorkspacesDocument extends S.Class<PackageJsonWorkspacesDocument>(
  $I`PackageJsonWorkspacesDocument`
)(
  {
    packages: S.Array(S.String),
  },
  $I.annote("PackageJsonWorkspacesDocument", {
    description: "Object-form package.json workspaces entry used by quality task resolution.",
  })
) {}

/**
 * Minimal `package.json` document shape used by quality task resolution.
 *
 * @example
 * ```ts
 * import { PackageJsonDocument } from "@beep/repo-cli/test/Quality"
 *
 * const manifest = PackageJsonDocument.make({ name: "@beep/example", scripts: { check: "tsc" } })
 * console.log(manifest.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageJsonDocument extends S.Class<PackageJsonDocument>($I`PackageJsonDocument`)(
  {
    name: S.optionalKey(S.String),
    scripts: S.optionalKey(S.Record(S.String, S.String)),
    workspaces: S.optionalKey(S.Union([S.Array(S.String), PackageJsonWorkspacesDocument])),
  },
  $I.annote("PackageJsonDocument", {
    description: "Minimal package.json shape used by quality task resolution.",
  })
) {}

/**
 * Decode a JSON string into the minimal quality task package manifest shape.
 *
 * @example
 * ```ts
 * import { decodePackageJsonDocument } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodePackageJsonDocument)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodePackageJsonDocument = S.decodeUnknownEffect(S.fromJsonString(PackageJsonDocument));

/**
 * Explicit machine profile used to tune future quality scheduling.
 *
 * @example
 * ```ts
 * import { QualityHardwareProfile } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QualityHardwareProfile.is.workstation("workstation"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const QualityHardwareProfile = LiteralKit(["current", "workstation", "ci"]).pipe(
  $I.annoteSchema("QualityHardwareProfile", {
    description: "Named local hardware profile for quality scheduling guidance.",
  })
);

/**
 * Explicit machine profile used to tune future quality scheduling.
 *
 * @example
 * ```ts
 * import type { QualityHardwareProfile } from "@beep/repo-cli/commands/Quality"
 *
 * const profile: QualityHardwareProfile = "current"
 * console.log(profile) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type QualityHardwareProfile = typeof QualityHardwareProfile.Type;

/**
 * Static quality scheduling settings for a hardware profile.
 *
 * @example
 * ```ts
 * import { QualityProfileConfig } from "@beep/repo-cli/commands/Quality"
 *
 * const config = QualityProfileConfig.make({
 *   profile: "current",
 *   turboConcurrency: 3,
 *   docgenParallel: 3,
 *   fullProofSlots: 1,
 *   reviewFixSlots: 1,
 *   notes: []
 * })
 * console.log(config.profile)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityProfileConfig extends S.Class<QualityProfileConfig>($I`QualityProfileConfig`)(
  {
    profile: QualityHardwareProfile,
    turboConcurrency: S.Finite,
    docgenParallel: S.Finite,
    fullProofSlots: S.Finite,
    reviewFixSlots: S.Finite,
    notes: S.Array(S.String),
  },
  $I.annote("QualityProfileConfig", {
    description: "Static quality scheduling settings for a hardware profile.",
  })
) {}

/**
 * Detected quality profile plus host facts.
 *
 * @example
 * ```ts
 * import { QualityProfileDetection } from "@beep/repo-cli/commands/Quality"
 *
 * const detection = QualityProfileDetection.make({
 *   profile: "current",
 *   cpuCount: 8,
 *   memoryGiB: 16,
 *   config: {
 *     profile: "current",
 *     turboConcurrency: 3,
 *     docgenParallel: 3,
 *     fullProofSlots: 1,
 *     reviewFixSlots: 1,
 *     notes: []
 *   }
 * })
 * console.log(detection.profile)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityProfileDetection extends S.Class<QualityProfileDetection>($I`QualityProfileDetection`)(
  {
    profile: QualityHardwareProfile,
    cpuCount: S.Finite,
    memoryGiB: S.Finite,
    config: QualityProfileConfig,
  },
  $I.annote("QualityProfileDetection", {
    description: "Detected quality profile plus host facts.",
  })
) {}

/**
 * Host facts used when selecting a quality profile.
 *
 * @example
 * ```ts
 * import type { QualityProfileDetectionInput } from "@beep/repo-cli/test/Quality"
 *
 * const input: QualityProfileDetectionInput = { ci: false, cpuCount: 8, totalMemoryBytes: 16 }
 * console.log(input.cpuCount)
 * ```
 * @category models
 * @since 0.0.0
 */
export class QualityProfileDetectionInput extends S.Class<QualityProfileDetectionInput>(
  $I`QualityProfileDetectionInput`
)(
  {
    ci: S.Boolean,
    cpuCount: S.Finite,
    totalMemoryBytes: S.Finite,
  },
  $I.annote("QualityProfileDetectionInput", {
    description: "Host facts used when selecting a quality profile.",
  })
) {}

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * @example
 * ```ts
 * import { GithubCheckMode } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckMode.is.quality("quality"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const GithubCheckMode = GithubCheckModeSchema;

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * @example
 * ```ts
 * import type { GithubCheckMode } from "@beep/repo-cli/commands/Quality"
 *
 * const mode: GithubCheckMode = "quality"
 * console.log(mode) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type GithubCheckMode = GithubCheckModeType;

/**
 * GitHub check mode values as CLI flag choices.
 *
 * @example
 * ```ts
 * import { githubCheckModeFlagChoices } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckModeFlagChoices[0])
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const githubCheckModeFlagChoices: ReadonlyArray<readonly [GithubCheckMode, GithubCheckMode]> = A.map(
  GITHUB_CHECK_MODE_VALUES,
  (mode) => [mode, mode] as const
);

/**
 * Fallow feature-family row tracked by the quality-enforcement matrix.
 *
 * @example
 * ```ts
 * import { FallowQualityFeatureFamily } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityFeatureFamily.is.audit("audit"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const FallowQualityFeatureFamily = LiteralKit([
  "audit",
  "dead-code",
  "health",
  "boundaries",
  "flags",
  "security",
  "fix-preview",
  "runtime-coverage",
  "editor-mcp-hooks",
]).pipe(
  $I.annoteSchema("FallowQualityFeatureFamily", {
    description: "Fallow feature family row tracked by the quality-enforcement matrix.",
  })
);

/**
 * Fallow feature-family row tracked by the quality-enforcement matrix.
 *
 * @example
 * ```ts
 * import type { FallowQualityFeatureFamily } from "@beep/repo-cli/test/Quality"
 *
 * const family: FallowQualityFeatureFamily = "security"
 * console.log(family) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityFeatureFamily = typeof FallowQualityFeatureFamily.Type;

/**
 * CI posture for a Fallow feature-family matrix row.
 *
 * @example
 * ```ts
 * import { FallowQualityCiMode } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityCiMode.is["blocking-check"]("blocking-check"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const FallowQualityCiMode = LiteralKit(["none", "advisory-artifact", "warning-check", "blocking-check"]).pipe(
  $I.annoteSchema("FallowQualityCiMode", {
    description: "CI posture for a Fallow feature-family matrix row.",
  })
);

/**
 * CI posture for a Fallow feature-family matrix row.
 *
 * @example
 * ```ts
 * import type { FallowQualityCiMode } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const mode: FallowQualityCiMode = "blocking-check"
 * console.log(mode) // "blocking-check"
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityCiMode = typeof FallowQualityCiMode.Type;

/**
 * Promotion posture for a Fallow feature-family matrix row.
 *
 * @example
 * ```ts
 * import { FallowQualityPromotionStatus } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityPromotionStatus.is.blocking("blocking"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const FallowQualityPromotionStatus = LiteralKit([
  "research",
  "advisory",
  "candidate-blocking",
  "blocking",
  "deferred",
  "rejected",
]).pipe(
  $I.annoteSchema("FallowQualityPromotionStatus", {
    description: "Promotion posture for a Fallow feature-family matrix row.",
  })
);

/**
 * Promotion posture for a Fallow feature-family matrix row.
 *
 * @example
 * ```ts
 * import type { FallowQualityPromotionStatus } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const status: FallowQualityPromotionStatus = "blocking"
 * console.log(status) // "blocking"
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityPromotionStatus = typeof FallowQualityPromotionStatus.Type;

/**
 * Minimal Fallow feature-matrix row used by GitHub check plan validation.
 *
 * @example
 * ```ts
 * import { GithubChecksFallowFeatureMatrixRow } from "@beep/repo-cli/test/Quality"
 *
 * const row = GithubChecksFallowFeatureMatrixRow.make({
 *   featureFamily: "security",
 *   ciMode: "blocking-check",
 *   promotionStatus: "blocking"
 * })
 * console.log(row.featureFamily)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GithubChecksFallowFeatureMatrixRow extends S.Class<GithubChecksFallowFeatureMatrixRow>(
  $I`GithubChecksFallowFeatureMatrixRow`
)(
  {
    featureFamily: FallowQualityFeatureFamily,
    ciMode: FallowQualityCiMode,
    promotionStatus: FallowQualityPromotionStatus,
  },
  $I.annote("GithubChecksFallowFeatureMatrixRow", {
    description: "Minimal Fallow feature-matrix row used by GitHub check plan contract validation.",
  })
) {}

/**
 * Minimal Fallow feature matrix used by GitHub check plan contract validation.
 *
 * @example
 * ```ts
 * import { GithubChecksFallowFeatureMatrix } from "@beep/repo-cli/commands/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(matrix.features.length)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GithubChecksFallowFeatureMatrix extends S.Class<GithubChecksFallowFeatureMatrix>(
  $I`GithubChecksFallowFeatureMatrix`
)(
  {
    features: S.Array(GithubChecksFallowFeatureMatrixRow),
  },
  $I.annote("GithubChecksFallowFeatureMatrix", {
    description: "Minimal Fallow feature matrix used by GitHub check plan contract validation.",
  })
) {}

/**
 * Decode unknown JSONC data into the Fallow feature matrix contract.
 *
 * @example
 * ```ts
 * import { decodeGithubChecksFallowFeatureMatrix } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodeGithubChecksFallowFeatureMatrix)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeGithubChecksFallowFeatureMatrix = S.decodeUnknownEffect(GithubChecksFallowFeatureMatrix);

/**
 * Stage label for a GitHub check collector lane.
 *
 * @example
 * ```ts
 * import { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckLaneStage.is["repo-quality"]("repo-quality"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const GithubCheckLaneStage = LiteralKit(["repo-quality", "repo-sanity", "diff-security", "environment"]).pipe(
  $I.annoteSchema("GithubCheckLaneStage", {
    description: "Stage label for a GitHub check collector lane.",
  })
);

/**
 * Stage label for a GitHub check collector lane.
 *
 * @example
 * ```ts
 * import type { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality"
 *
 * const stage: GithubCheckLaneStage = "repo-quality"
 * console.log(stage) // example value
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type GithubCheckLaneStage = typeof GithubCheckLaneStage.Type;

/**
 * Executable lane specification for GitHub check collectors.
 *
 * @example
 * ```ts
 * import { GithubCheckLaneSpec } from "@beep/repo-cli/commands/Quality"
 * import { QualityTaskStep } from "@beep/repo-cli/test/Quality"
 *
 * const lane = GithubCheckLaneSpec.make({
 *   id: "quality:build",
 *   stage: "repo-quality",
 *   blockedBy: [],
 *   step: QualityTaskStep.make({ label: "build", command: "bun", args: ["run", "build"], cwd: "/repo" })
 * })
 * console.log(lane.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GithubCheckLaneSpec extends S.Class<GithubCheckLaneSpec>($I`GithubCheckLaneSpec`)(
  {
    id: S.String,
    stage: GithubCheckLaneStage,
    blockedBy: S.Array(S.String),
    step: QualityTaskStep,
  },
  $I.annote("GithubCheckLaneSpec", {
    description: "Executable lane specification for GitHub check collectors.",
  })
) {}
