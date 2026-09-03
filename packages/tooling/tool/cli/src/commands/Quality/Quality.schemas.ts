/**
 * Schema role file for the Quality command family.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect as EffectRuntime } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { LINT_POLICY_SUBCOMMANDS } from "../../internal/cli/LintRouting.ts";
import { QualityTaskStep } from "../../internal/process/index.ts";
import {
  GITHUB_CHECK_MODE_VALUES,
  GithubCheckMode as GithubCheckModeSchema,
} from "../../internal/repo-run/RepoRun.proofs.ts";
import type * as Effect from "effect/Effect";
import type * as AST from "effect/SchemaAST";
import type { GithubCheckMode as GithubCheckModeType } from "../../internal/repo-run/RepoRun.proofs.ts";

const $I = $RepoCliId.create("commands/Quality/Quality.schemas");

/**
 * Output-line prefix carrying the schema-backed GitHub-check run report.
 *
 * **Example** (Recognize a report line)
 *
 * ```ts
 * import { GITHUB_CHECK_RUN_REPORT_PREFIX } from "@beep/repo-cli/commands/Quality"
 * import * as Str from "effect/String"
 *
 * console.log(Str.startsWith(GITHUB_CHECK_RUN_REPORT_PREFIX)(`${GITHUB_CHECK_RUN_REPORT_PREFIX}{}`)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GITHUB_CHECK_RUN_REPORT_PREFIX = "[beep-github-check-run] ";

/**
 * Output-line prefix carrying execution facts for the lanes inside a wrapper.
 *
 * **Example** (Recognize a lane report line)
 *
 * ```ts
 * import { QUALITY_TASK_LANE_RUN_REPORT_PREFIX } from "@beep/repo-cli/commands/Quality"
 * import * as Str from "effect/String"
 *
 * console.log(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)(`${QUALITY_TASK_LANE_RUN_REPORT_PREFIX}{}`)) // true
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const QUALITY_TASK_LANE_RUN_REPORT_PREFIX = "[beep-quality-task-lane-run] ";

/**
 * Environment key naming the durable NDJSON side channel for wrapper lane facts.
 *
 * **Example** (Pass the side-channel path)
 *
 * ```ts
 * import { QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV) // "BEEP_YEET_INNER_LANE_REPORT_PATH"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV = "BEEP_YEET_INNER_LANE_REPORT_PATH";

/**
 * Environment key joining a durable inner-lane report to its wrapper lane.
 *
 * **Example** (Pass the wrapper lane id)
 *
 * ```ts
 * import { QUALITY_TASK_LANE_RUN_PARENT_ID_ENV } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QUALITY_TASK_LANE_RUN_PARENT_ID_ENV) // "BEEP_YEET_INNER_LANE_PARENT_ID"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const QUALITY_TASK_LANE_RUN_PARENT_ID_ENV = "BEEP_YEET_INNER_LANE_PARENT_ID";

/**
 * Canonical quality task name.
 *
 * **Example** (Check quality task name membership)
 *
 * ```ts
 * import { QualityTaskName } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QualityTaskName.is.lint("lint"))
 * ```
 *
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
 * **Example** (Annotate a value as QualityTaskName)
 *
 * ```ts
 * import type { QualityTaskName } from "@beep/repo-cli/commands/Quality"
 *
 * const task: QualityTaskName = "check"
 * console.log(task) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QualityTaskName = typeof QualityTaskName.Type;

/**
 * Root CLI flags that bypass the quality task fast path.
 *
 * **Example** (Check quality task bypass arg name membership)
 *
 * ```ts
 * import { QualityTaskBypassArgName } from "@beep/repo-cli/test/Quality"
 *
 * console.log(QualityTaskBypassArgName.is["--help"]("--help"))
 * ```
 *
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
 * **Example** (Annotate a value as QualityTaskBypassArgName)
 *
 * ```ts
 * import type { QualityTaskBypassArgName } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const flag: QualityTaskBypassArgName = "--help"
 * console.log(flag) // "--help"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QualityTaskBypassArgName = typeof QualityTaskBypassArgName.Type;

/**
 * Lint policy subcommands owned by the full command tree.
 *
 * **Example** (Check lint policy subcommand membership)
 *
 * ```ts
 * import { LintPolicySubcommand } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LintPolicySubcommand.is.policy("policy"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LintPolicySubcommand = LiteralKit(LINT_POLICY_SUBCOMMANDS).pipe(
  $I.annoteSchema("LintPolicySubcommand", {
    description: "Lint policy subcommands that remain owned by the full command tree.",
  })
);

/**
 * Lint policy subcommand owned by the full command tree.
 *
 * **Example** (Annotate a value as LintPolicySubcommand)
 *
 * ```ts
 * import type { LintPolicySubcommand } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const subcommand: LintPolicySubcommand = "schema-first"
 * console.log(subcommand) // "schema-first"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LintPolicySubcommand = typeof LintPolicySubcommand.Type;

/**
 * Root audit mode names supported by the quality task adapter.
 *
 * **Example** (Check root audit mode membership)
 *
 * ```ts
 * import { RootAuditMode } from "@beep/repo-cli/test/Quality"
 *
 * console.log(RootAuditMode.is.github("github"))
 * ```
 *
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
 * **Example** (Annotate a value as RootAuditMode)
 *
 * ```ts
 * import type { RootAuditMode } from "@beep/repo-cli/test/Quality"
 *
 * const mode: RootAuditMode = "packages"
 * console.log(mode) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RootAuditMode = typeof RootAuditMode.Type;

/**
 * Package-local script profile used by the quality task adapter.
 *
 * **Example** (Construct a package task profile)
 *
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
 *
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
 * **Example** (Construct a quality task invocation)
 *
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
 *
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
 * **Example** (Construct a package json workspaces document)
 *
 * ```ts
 * import { PackageJsonWorkspacesDocument } from "@beep/repo-cli/test/Quality"
 *
 * const workspaces = PackageJsonWorkspacesDocument.make({ packages: ["packages/*"] })
 * console.log(workspaces.packages)
 * ```
 *
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
 * **Example** (Construct a package json document)
 *
 * ```ts
 * import { PackageJsonDocument } from "@beep/repo-cli/test/Quality"
 *
 * const manifest = PackageJsonDocument.make({ name: "@beep/example", scripts: { check: "tsc" } })
 * console.log(manifest.name)
 * ```
 *
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
 * **Example** (Reference the package.json decoder)
 *
 * ```ts
 * import { decodePackageJsonDocument } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodePackageJsonDocument)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodePackageJsonDocument: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<PackageJsonDocument, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<PackageJsonDocument, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(PackageJsonDocument)));

/**
 * Explicit machine profile used to tune future quality scheduling.
 *
 * **Example** (Check quality hardware profile membership)
 *
 * ```ts
 * import { QualityHardwareProfile } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(QualityHardwareProfile.is.workstation("workstation"))
 * ```
 *
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
 * **Example** (Annotate a value as QualityHardwareProfile)
 *
 * ```ts
 * import type { QualityHardwareProfile } from "@beep/repo-cli/commands/Quality"
 *
 * const profile: QualityHardwareProfile = "current"
 * console.log(profile) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QualityHardwareProfile = typeof QualityHardwareProfile.Type;

/**
 * Static quality scheduling settings for a hardware profile.
 *
 * **Example** (Construct a quality profile config)
 *
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
 *
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
 * **Example** (Construct a quality profile detection)
 *
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
 *
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
 * **Example** (Describe a detection input)
 *
 * ```ts
 * import type { QualityProfileDetectionInput } from "@beep/repo-cli/test/Quality"
 *
 * const input: QualityProfileDetectionInput = { ci: false, cpuCount: 8, totalMemoryBytes: 16 }
 * console.log(input.cpuCount)
 * ```
 *
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
 * **Example** (Check github check mode membership)
 *
 * ```ts
 * import { GithubCheckMode } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckMode.is.quality("quality"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubCheckMode = GithubCheckModeSchema;

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * **Example** (Annotate a value as GithubCheckMode)
 *
 * ```ts
 * import type { GithubCheckMode } from "@beep/repo-cli/commands/Quality"
 *
 * const mode: GithubCheckMode = "quality"
 * console.log(mode) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GithubCheckMode = GithubCheckModeType;

/**
 * GitHub check mode values as CLI flag choices.
 *
 * **Example** (Read the first flag choice)
 *
 * ```ts
 * import { githubCheckModeFlagChoices } from "@beep/repo-cli/test/Quality"
 *
 * console.log(githubCheckModeFlagChoices[0])
 * ```
 *
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
 * **Example** (Check fallow quality feature family membership)
 *
 * ```ts
 * import { FallowQualityFeatureFamily } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityFeatureFamily.is.audit("audit"))
 * ```
 *
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
 * **Example** (Annotate a value as FallowQualityFeatureFamily)
 *
 * ```ts
 * import type { FallowQualityFeatureFamily } from "@beep/repo-cli/test/Quality"
 *
 * const family: FallowQualityFeatureFamily = "security"
 * console.log(family) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityFeatureFamily = typeof FallowQualityFeatureFamily.Type;

/**
 * CI posture for a Fallow feature-family matrix row.
 *
 * **Example** (Check fallow quality ci mode membership)
 *
 * ```ts
 * import { FallowQualityCiMode } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityCiMode.is["blocking-check"]("blocking-check"))
 * ```
 *
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
 * **Example** (Annotate a value as FallowQualityCiMode)
 *
 * ```ts
 * import type { FallowQualityCiMode } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const mode: FallowQualityCiMode = "blocking-check"
 * console.log(mode) // "blocking-check"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityCiMode = typeof FallowQualityCiMode.Type;

/**
 * Promotion posture for a Fallow feature-family matrix row.
 *
 * **Example** (Check fallow quality promotion status membership)
 *
 * ```ts
 * import { FallowQualityPromotionStatus } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FallowQualityPromotionStatus.is.blocking("blocking"))
 * ```
 *
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
 * **Example** (Annotate a value as FallowQualityPromotionStatus)
 *
 * ```ts
 * import type { FallowQualityPromotionStatus } from "@beep/repo-cli/commands/Quality/Quality.schemas"
 *
 * const status: FallowQualityPromotionStatus = "blocking"
 * console.log(status) // "blocking"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type FallowQualityPromotionStatus = typeof FallowQualityPromotionStatus.Type;

/**
 * Minimal Fallow feature-matrix row used by GitHub check plan validation.
 *
 * **Example** (Construct a github checks fallow feature matrix row)
 *
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
 *
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
 * **Example** (Construct a github checks fallow feature matrix)
 *
 * ```ts
 * import { GithubChecksFallowFeatureMatrix } from "@beep/repo-cli/commands/Quality"
 *
 * const matrix = GithubChecksFallowFeatureMatrix.make({ features: [] })
 * console.log(matrix.features.length)
 * ```
 *
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
 * **Example** (Reference the feature matrix decoder)
 *
 * ```ts
 * import { decodeGithubChecksFallowFeatureMatrix } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(decodeGithubChecksFallowFeatureMatrix)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeGithubChecksFallowFeatureMatrix: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<GithubChecksFallowFeatureMatrix, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<GithubChecksFallowFeatureMatrix, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(GithubChecksFallowFeatureMatrix));

/**
 * Stage label for a GitHub check collector lane.
 *
 * **Example** (Check github check lane stage membership)
 *
 * ```ts
 * import { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckLaneStage.is["repo-quality"]("repo-quality"))
 * ```
 *
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
 * **Example** (Annotate a value as GithubCheckLaneStage)
 *
 * ```ts
 * import type { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality"
 *
 * const stage: GithubCheckLaneStage = "repo-quality"
 * console.log(stage) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type GithubCheckLaneStage = typeof GithubCheckLaneStage.Type;

/**
 * Failure scheduling policy for local GitHub-check batteries.
 *
 * **Example** (Select aggregate diagnostics)
 *
 * ```ts
 * import { GithubCheckFailurePolicy } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckFailurePolicy.is["collect-all"]("collect-all")) // true
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const GithubCheckFailurePolicy = LiteralKit(["fail-fast", "collect-all"]).annotate(
  $I.annote("GithubCheckFailurePolicy", {
    description: "Policy controlling whether local GitHub-check execution stops after the first failed wave.",
  })
);

/**
 * Decoded failure scheduling policy for local GitHub-check batteries.
 *
 * @see {@link GithubCheckFailurePolicy} for the runtime schema and literal helpers.
 * @category policies
 * @since 0.0.0
 */
export type GithubCheckFailurePolicy = typeof GithubCheckFailurePolicy.Type;

/**
 * Static cost-ordered wave assigned to a local GitHub-check lane.
 *
 * **Example** (Inspect the preflight wave)
 *
 * ```ts
 * import { GithubCheckLaneWave } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckLaneWave.is.preflight("preflight")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubCheckLaneWave = LiteralKit(["preflight", "heavy", "test", "documentation"]).annotate(
  $I.annote("GithubCheckLaneWave", {
    description: "Static cost-ordered execution wave for local GitHub-check lanes.",
  })
);

/**
 * Decoded static execution wave for a local GitHub-check lane.
 *
 * @see {@link GithubCheckLaneWave} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type GithubCheckLaneWave = typeof GithubCheckLaneWave.Type;

/**
 * Executable lane specification for GitHub check collectors.
 *
 * **Example** (Construct a github check lane spec)
 *
 * ```ts
 * import { GithubCheckLaneSpec } from "@beep/repo-cli/commands/Quality"
 * import { QualityTaskStep } from "@beep/repo-cli/test/Quality"
 *
 * const lane = GithubCheckLaneSpec.make({
 *   id: "quality:build",
 *   stage: "repo-quality",
 *   wave: "heavy",
 *   blockedBy: [],
 *   step: QualityTaskStep.make({ label: "build", command: "bun", args: ["run", "build"], cwd: "/repo" })
 * })
 * console.log(lane.id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCheckLaneSpec extends S.Class<GithubCheckLaneSpec>($I`GithubCheckLaneSpec`)(
  {
    id: S.String,
    stage: GithubCheckLaneStage,
    wave: GithubCheckLaneWave,
    blockedBy: S.Array(S.String),
    step: QualityTaskStep,
  },
  $I.annote("GithubCheckLaneSpec", {
    description: "Executable lane specification for GitHub check collectors.",
  })
) {}

/**
 * One ordered execution wave of local GitHub-check lanes.
 *
 * **Example** (Build a documentation wave)
 *
 * ```ts
 * import { GithubCheckLaneWaveSpec } from "@beep/repo-cli/commands/Quality"
 *
 * const wave = GithubCheckLaneWaveSpec.make({ lanes: [], wave: "documentation" })
 * console.log(wave.wave)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCheckLaneWaveSpec extends S.Class<GithubCheckLaneWaveSpec>($I`GithubCheckLaneWaveSpec`)(
  {
    wave: GithubCheckLaneWave,
    lanes: S.Array(GithubCheckLaneSpec),
  },
  $I.annote("GithubCheckLaneWaveSpec", {
    description: "One ordered execution wave of local GitHub-check lanes.",
  })
) {}

/**
 * Execution status recorded for one GitHub-check lane.
 *
 * **Example** (Identify an early stop)
 *
 * ```ts
 * import { GithubCheckLaneRunStatus } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(GithubCheckLaneRunStatus.is["not-run-early-stop"]("not-run-early-stop")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubCheckLaneRunStatus = LiteralKit(["passed", "reused", "failed", "not-run-early-stop"]).annotate(
  $I.annote("GithubCheckLaneRunStatus", {
    description: "Terminal status of one lane in a local GitHub-check wave run.",
  })
);

/**
 * Decoded terminal status for one local GitHub-check lane.
 *
 * @see {@link GithubCheckLaneRunStatus} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type GithubCheckLaneRunStatus = typeof GithubCheckLaneRunStatus.Type;

const OptionalLaneRunString = S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);
const OptionalLaneRunFinite = S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);
const NullableLaneInputDigest = S.OptionFromNullOr(S.String).pipe(
  SchemaUtils.withNoneDefault,
  S.withDecodingDefaultKey(EffectRuntime.succeed(null))
);

/**
 * Timing and outcome facts for one lane executed inside a wrapper command.
 *
 * **Details**
 *
 * `inputDigest` encodes absence as `null`; callers supply a digest only when it
 * comes from the executor, such as a Turbo task hash.
 *
 * **Example** (Record a completed lane)
 *
 * ```ts
 * import { QualityTaskLaneRun } from "@beep/repo-cli/commands/Quality"
 * import * as O from "effect/Option"
 *
 * const lane = QualityTaskLaneRun.make({
 *   id: "quality:check",
 *   label: "quality:check",
 *   status: "passed",
 *   startedAt: O.some("2026-09-03T00:00:00.000Z"),
 *   endedAt: O.some("2026-09-03T00:00:01.000Z"),
 *   durationMs: O.some(1000),
 *   exitCode: O.some(0),
 *   inputDigest: O.none()
 * })
 * console.log(lane.status) // "passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QualityTaskLaneRun extends S.Class<QualityTaskLaneRun>($I`QualityTaskLaneRun`)(
  {
    id: S.String,
    label: S.String,
    status: GithubCheckLaneRunStatus,
    startedAt: OptionalLaneRunString,
    endedAt: OptionalLaneRunString,
    durationMs: OptionalLaneRunFinite,
    exitCode: OptionalLaneRunFinite,
    inputDigest: NullableLaneInputDigest,
  },
  $I.annote("QualityTaskLaneRun", {
    description: "Timing and outcome facts for one lane executed inside a wrapper command.",
  })
) {}

/**
 * Machine-readable execution facts emitted by a lane wrapper.
 *
 * **Example** (Build an empty lane report)
 *
 * ```ts
 * import { QualityTaskLaneRunReport } from "@beep/repo-cli/commands/Quality"
 *
 * const report = QualityTaskLaneRunReport.make({
 *   schemaVersion: "quality-task-lane-run/v1",
 *   lanes: []
 * })
 * console.log(report.lanes.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QualityTaskLaneRunReport extends S.Class<QualityTaskLaneRunReport>($I`QualityTaskLaneRunReport`)(
  {
    schemaVersion: S.Literal("quality-task-lane-run/v1"),
    parentLaneId: OptionalLaneRunString,
    lanes: S.Array(QualityTaskLaneRun),
  },
  $I.annote("QualityTaskLaneRunReport", {
    description: "Machine-readable execution facts emitted by a quality or CI lane wrapper.",
  })
) {}

/**
 * One lane outcome in a local GitHub-check wave report.
 *
 * **Example** (Record an early-stopped lane)
 *
 * ```ts
 * import { GithubCheckLaneRun } from "@beep/repo-cli/commands/Quality"
 *
 * const lane = GithubCheckLaneRun.make({
 *   id: "quality:docgen",
 *   stage: "repo-quality",
 *   status: "not-run-early-stop",
 *   wave: "documentation"
 * })
 * console.log(lane.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCheckLaneRun extends S.Class<GithubCheckLaneRun>($I`GithubCheckLaneRun`)(
  {
    id: S.String,
    stage: GithubCheckLaneStage,
    status: GithubCheckLaneRunStatus,
    wave: GithubCheckLaneWave,
  },
  $I.annote("GithubCheckLaneRun", {
    description: "One lane outcome in a local GitHub-check wave report.",
  })
) {}

/**
 * Machine-readable report emitted after a local GitHub-check wave run.
 *
 * **Example** (Record a fail-fast run)
 *
 * ```ts
 * import { GithubCheckRunReport } from "@beep/repo-cli/commands/Quality"
 *
 * const report = GithubCheckRunReport.make({
 *   failurePolicy: "fail-fast",
 *   lanes: [],
 *   schemaVersion: "github-check-run/v1"
 * })
 * console.log(report.failurePolicy)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubCheckRunReport extends S.Class<GithubCheckRunReport>($I`GithubCheckRunReport`)(
  {
    schemaVersion: S.Literal("github-check-run/v1"),
    failurePolicy: GithubCheckFailurePolicy,
    lanes: S.Array(GithubCheckLaneRun),
  },
  $I.annote("GithubCheckRunReport", {
    description: "Machine-readable lane outcomes and failure policy for a local GitHub-check wave run.",
  })
) {}
