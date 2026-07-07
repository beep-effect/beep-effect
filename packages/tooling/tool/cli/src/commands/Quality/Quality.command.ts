/**
 * Repo operational quality commands migrated from root scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { cpus, totalmem } from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, Str, thunkFalse, thunkTrue } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, flow, Match, Order, Path, pipe, Stream } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { ChildProcess } from "effect/unstable/process";
import { XMLParser } from "fast-xml-parser";
import { parse } from "jsonc-parser";
import { printLines } from "../../internal/cli/Printer.js";
import { GITHUB_CHECK_MODE_VALUES, GithubCheckMode as GithubCheckModeSchema } from "../../internal/repo-run/index.js";
import { runChangesetGraphCheck } from "./ChangesetGraph.js";
import { qualityFallowCommand } from "./FallowQuality.command.js";
import { configStringEqualsSync } from "./internal/Config.js";
import { writeJSDocDocumentationInventory } from "./internal/JSDocDocumentationInventory.js";
import { defaultJSDocInventoryPath, defaultJSDocTotalsBaselinePath, runJSDocRatchet } from "./internal/JSDocRatchet.js";
import { defaultKnipBaselinePath, runKnipRatchet } from "./internal/KnipRatchet.js";
import { runPackageVerifyCli } from "./internal/PackageVerify.js";
import { repoRelative } from "./internal/QualityArtifactSupport.js";
import {
  renderTurboConfigProofReport,
  renderTurboConfigProofReportJson,
  runTurboConfigProof,
} from "./internal/TurboConfigProof.js";
import { QualityScriptCommandError } from "./Quality.errors.js";
import { QualityTaskStep, runQualityTaskStreamingStepGroup } from "./Tasks.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ParseError } from "jsonc-parser";
import type { GithubCheckMode as GithubCheckModeType } from "../../internal/repo-run/index.js";
import type { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Tasks.js";

/**
 * Public quality script command error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { QualityScriptCommandError } from "./Quality.errors.js";

const $I = $RepoCliId.create("commands/Quality/ScriptCommands");

const ignoredTestDirectoryNames = ["node_modules", "dist", "coverage", "tmp"] as const;
const ignoredTestPathSegments = ["/test/fixtures/"] as const;
const dtslintSearchRoots = ["apps", "packages", "tooling"] as const;
const testSearchRoots = ["apps", "packages", "tooling", "infra"] as const;
const moduleTagScannedRoots = [".patterns", "apps", "packages", "tooling"] as const;
const moduleTagScannedExtensions = [".hbs", ".md", ".ts", ".tsx"] as const;
const effectDiagnosticsDirectiveScannedRoots = ["apps", "packages", "tooling", "infra"] as const;
const effectDiagnosticsDirectiveScannedExtensions = [".cts", ".mts", ".ts", ".tsx"] as const;
const effectDiagnosticsDirectiveIgnoredDirectoryNames = ["node_modules", "dist", "coverage", "tmp", "scripts"] as const;
const effectTsgoDiagnosticsTableStartMarker = "<!-- diagnostics-table:start -->";
const effectTsgoDiagnosticsTableEndMarker = "<!-- diagnostics-table:end -->";
const effectDiagnosticsDirectivePrefix = "@effect-diagnostics";
const effectDiagnosticsOffDirectivePattern = new RegExp(`${effectDiagnosticsDirectivePrefix}[^\\n]*:${"off"}\\b`, "u");
const effectTsgoDiagnosticPattern = /\b(?:error|warning) TS\d+: .* effect\([^)]+\)/u;
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));
const QUALITY_PROFILE_NAMES = ["current", "workstation", "ci"] as const;
const effectTsgoReadmeParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

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
export const QualityHardwareProfile = LiteralKit(QUALITY_PROFILE_NAMES).pipe(
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
 * console.log(profile)
 * ```
 * @category models
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

type QualityProfileDetectionInput = {
  readonly ci: boolean;
  readonly cpuCount: number;
  readonly totalMemoryBytes: number;
};

const gibibytes = (bytes: number): number => Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10;

/**
 * Return static quality scheduling settings for a hardware profile.
 *
 * @param profile - Quality hardware profile to map to scheduling settings.
 * @returns Static quality scheduling configuration for the profile.
 * @example
 * ```ts
 * import { qualityProfileConfigForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(qualityProfileConfigForTesting("workstation").reviewFixSlots)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const qualityProfileConfigForTesting = (profile: QualityHardwareProfile): QualityProfileConfig =>
  QualityHardwareProfile.$match(profile, {
    ci: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 3,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["CI keeps conservative parallelism and relies on hosted job sharding."],
      }),
    current: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 3,
        docgenParallel: 3,
        fullProofSlots: 1,
        reviewFixSlots: 1,
        notes: ["Current local profile keeps one heavyweight proof active at a time."],
      }),
    workstation: () =>
      QualityProfileConfig.make({
        profile,
        turboConcurrency: 8,
        docgenParallel: 6,
        fullProofSlots: 1,
        reviewFixSlots: 3,
        notes: ["Workstation profile allows parallel review-fix loops while keeping full proofs serialized."],
      }),
  });

/**
 * Detect the quality hardware profile from host facts.
 *
 * @param input - Host and CI facts used for profile detection.
 * @returns Detected quality profile with derived scheduling configuration.
 * @example
 * ```ts
 * import { detectQualityProfileForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const profile = detectQualityProfileForTesting({
 *   ci: false,
 *   cpuCount: 64,
 *   totalMemoryBytes: 128 * 1024 * 1024 * 1024
 * })
 * console.log(profile.profile)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfileForTesting = (input: QualityProfileDetectionInput): QualityProfileDetection => {
  const profile: QualityHardwareProfile = input.ci
    ? "ci"
    : input.cpuCount >= 32 && input.totalMemoryBytes >= 64 * 1024 * 1024 * 1024
      ? "workstation"
      : "current";

  return QualityProfileDetection.make({
    profile,
    cpuCount: input.cpuCount,
    memoryGiB: gibibytes(input.totalMemoryBytes),
    config: qualityProfileConfigForTesting(profile),
  });
};

const detectQualityProfile = (): QualityProfileDetection =>
  detectQualityProfileForTesting({
    ci: Str.isNonEmpty(Bun.env.CI ?? ""),
    cpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
  });

class EffectTsgoRuleCell extends S.Class<EffectTsgoRuleCell>($I`EffectTsgoRuleCell`)(
  {
    code: S.String,
  },
  $I.annote("EffectTsgoRuleCell", {
    description: "Parsed diagnostics table cell containing an Effect tsgo rule code.",
  })
) {}

class EffectTsgoRuleRow extends S.Class<EffectTsgoRuleRow>($I`EffectTsgoRuleRow`)(
  {
    td: S.Array(S.Unknown),
  },
  $I.annote("EffectTsgoRuleRow", {
    description: "Parsed diagnostics table row from the installed Effect tsgo README.",
  })
) {}

class EffectTsgoDiagnosticsTbody extends S.Class<EffectTsgoDiagnosticsTbody>($I`EffectTsgoDiagnosticsTbody`)(
  {
    tr: S.Array(S.Unknown),
  },
  $I.annote("EffectTsgoDiagnosticsTbody", {
    description: "Parsed diagnostics table body containing Effect tsgo rule rows.",
  })
) {}

class EffectTsgoDiagnosticsTableNode extends S.Class<EffectTsgoDiagnosticsTableNode>(
  $I`EffectTsgoDiagnosticsTableNode`
)(
  {
    tbody: EffectTsgoDiagnosticsTbody,
  },
  $I.annote("EffectTsgoDiagnosticsTableNode", {
    description: "Parsed diagnostics table node from the installed Effect tsgo README.",
  })
) {}

class EffectTsgoDiagnosticsRoot extends S.Class<EffectTsgoDiagnosticsRoot>($I`EffectTsgoDiagnosticsRoot`)(
  {
    table: EffectTsgoDiagnosticsTableNode,
  },
  $I.annote("EffectTsgoDiagnosticsRoot", {
    description: "Root wrapper used to parse the Effect tsgo diagnostics table fragment.",
  })
) {}

class EffectTsgoDiagnosticsTable extends S.Class<EffectTsgoDiagnosticsTable>($I`EffectTsgoDiagnosticsTable`)(
  {
    root: EffectTsgoDiagnosticsRoot,
  },
  $I.annote("EffectTsgoDiagnosticsTable", {
    description: "Parsed diagnostics table fragment from the installed Effect tsgo README.",
  })
) {}

const decodeEffectTsgoRuleCellOption = S.decodeUnknownOption(EffectTsgoRuleCell);
const decodeEffectTsgoRuleRowOption = S.decodeUnknownOption(EffectTsgoRuleRow);
const decodeEffectTsgoDiagnosticsTableOption = S.decodeUnknownOption(EffectTsgoDiagnosticsTable);

type QualityScriptEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;
type GithubCheckError =
  | QualityScriptCommandError
  | QualityTaskConfigurationError
  | QualityTaskFailed
  | QualityTaskGroupFailed;
type GithubCheckRunOptions = {
  readonly base?: string;
  readonly head?: string;
};
type TsgoDiagnosticOutput = {
  readonly output: string;
};

/**
 * GitHub check mode handled by `beep quality github-checks`.
 *
 * @example
 * ```ts
 * import { GithubCheckMode } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const mode: GithubCheckMode = "repo-sanity"
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
 * import type { GithubCheckMode } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const mode: GithubCheckMode = "quality"
 * ```
 * @category models
 * @since 0.0.0
 */
export type GithubCheckMode = GithubCheckModeType;

const githubCheckModeFlagChoices: ReadonlyArray<readonly [GithubCheckMode, GithubCheckMode]> = A.map(
  GITHUB_CHECK_MODE_VALUES,
  (mode) => [mode, mode] as const
);

const FallowQualityFeatureFamily = LiteralKit([
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

type FallowQualityFeatureFamily = typeof FallowQualityFeatureFamily.Type;

const FallowQualityCiMode = LiteralKit(["none", "advisory-artifact", "warning-check", "blocking-check"]).pipe(
  $I.annoteSchema("FallowQualityCiMode", {
    description: "CI posture for a Fallow feature-family matrix row.",
  })
);

const FallowQualityPromotionStatus = LiteralKit([
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

class GithubChecksFallowFeatureMatrixRow extends S.Class<GithubChecksFallowFeatureMatrixRow>(
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
 * import { GithubChecksFallowFeatureMatrix } from "@beep/repo-cli/commands/Quality/Quality.command"
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

const decodeGithubChecksFallowFeatureMatrix = S.decodeUnknownEffect(GithubChecksFallowFeatureMatrix);

const commandText = (command: string, args: ReadonlyArray<string>) => A.join([command, ...args], " ");

const normalizeExtraArgs = (args: unknown): ReadonlyArray<string> => {
  if (P.isUndefined(args)) {
    return A.empty();
  }

  if (P.isString(args)) {
    return A.make(args);
  }

  return P.isIterable(args) ? pipe(A.fromIterable(args), A.filter(P.isString)) : A.empty();
};

const withExitCode = (label: string, command: string, args: ReadonlyArray<string>, exitCode: number) =>
  QualityScriptCommandError.make({
    message: `${label} failed with exit code ${exitCode}.`,
    command: commandText(command, args),
    exitCode,
  });

const runStep = Effect.fn("QualityScriptCommands.runStep")(function* (
  step: QualityTaskStep
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[beep-cli] ${step.label}: ${commandText(step.command, step.args)}`);
  const exitCode = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(step.command, [...step.args], {
        cwd: step.cwd,
        env: step.env,
        extendEnv: true,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });
      return yield* handle.exitCode;
    })
  ).pipe(
    QualityScriptCommandError.mapError(`Failed to spawn ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );

  if (exitCode !== 0) {
    return yield* withExitCode(step.label, step.command, step.args, exitCode);
  }
});

const runBun = (repoRoot: string, label: string, args: ReadonlyArray<string>) =>
  runStep(
    QualityTaskStep.make({
      label,
      command: "bun",
      args: ["run", ...args],
      cwd: repoRoot,
    })
  );

const runBunWithEnv = (
  repoRoot: string,
  label: string,
  args: ReadonlyArray<string>,
  env: Record<string, string | undefined>
) =>
  runStep(
    QualityTaskStep.make({
      label,
      command: "bun",
      args: ["run", ...args],
      cwd: repoRoot,
      env,
    })
  );

const runFixedStep = (repoRoot: string, label: string, command: string, args: ReadonlyArray<string>) =>
  runStep(
    QualityTaskStep.make({
      label,
      command,
      args,
      cwd: repoRoot,
    })
  );

/**
 * Stage label for a GitHub check collector lane.
 *
 * @example
 * ```ts
 * import { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const stage = GithubCheckLaneStage
 * console.log(stage)
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
 * import type { GithubCheckLaneStage } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const stage: GithubCheckLaneStage = "repo-quality"
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
 * import { GithubCheckLaneSpec } from "@beep/repo-cli/commands/Quality/Quality.command"
 * import { QualityTaskStep } from "@beep/repo-cli/commands/Quality/Tasks"
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

const bunRunLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["run", ...args],
    cwd: repoRoot,
  });

const bunxLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  QualityTaskStep.make({
    label,
    command: "bunx",
    args,
    cwd: repoRoot,
  });

const repoCliLane = (repoRoot: string, label: string, args: ReadonlyArray<string>): QualityTaskStep =>
  bunRunLane(repoRoot, label, ["beep", "quality", ...args]);

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

const githubCheckLaneSteps = (lanes: ReadonlyArray<GithubCheckLaneSpec>): ReadonlyArray<QualityTaskStep> =>
  A.map(lanes, (lane) => lane.step);

const runGithubCheckLaneGroup = (
  label: string,
  lanes: ReadonlyArray<GithubCheckLaneSpec>
): Effect.Effect<void, QualityTaskConfigurationError | QualityTaskGroupFailed, QualityScriptEnvironment> =>
  runQualityTaskStreamingStepGroup(label, githubCheckLaneSteps(lanes));

const collectOutput = Effect.fn("QualityScriptCommands.collectOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<
  {
    readonly output: string;
    readonly exitCode: number;
  },
  QualityScriptCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(step.command, [...step.args], {
        cwd: step.cwd,
        env: step.env,
        extendEnv: true,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc, chunk) => acc + chunk
        )
      );
      const exitCode = yield* handle.exitCode;
      return {
        output: Str.trim(output),
        exitCode,
      };
    })
  ).pipe(
    QualityScriptCommandError.mapError(`Failed to collect output from ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );
});

const collectSuccessfulOutput = Effect.fn("QualityScriptCommands.collectSuccessfulOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<string, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* collectOutput(step);

  if (result.exitCode !== 0) {
    return yield* withExitCode(step.label, step.command, step.args, result.exitCode);
  }

  return result.output;
});

const isTruthyMainPush = (): boolean =>
  configStringEqualsSync("GITHUB_EVENT_NAME", "push") && configStringEqualsSync("GITHUB_REF_NAME", "main");

const currentBranch = Effect.fn("QualityScriptCommands.currentBranch")(function* (
  repoRoot: string
): Effect.fn.Return<string, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  return yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "git:branch",
      command: "git",
      args: ["branch", "--show-current"],
      cwd: repoRoot,
    })
  );
});

const ensureOriginMain = Effect.fn("QualityScriptCommands.ensureOriginMain")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log("[github-checks] refreshing origin/main");
  const shallow = yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "git:shallow",
      command: "git",
      args: ["rev-parse", "--is-shallow-repository"],
      cwd: repoRoot,
    })
  );

  if (shallow === "true") {
    yield* runFixedStep(repoRoot, "git:fetch:unshallow", "git", ["fetch", "origin", "--quiet", "--unshallow"]);
  }

  yield* runFixedStep(repoRoot, "git:fetch:origin-main", "git", [
    "fetch",
    "origin",
    "main:refs/remotes/origin/main",
    "--quiet",
  ]);
});

// The changeset-status lane is appended at runtime by the quality and pre-push
// composers (it depends on the current branch and is skipped on main pushes),
// so it is intentionally absent from the static GITHUB_CHECK_MODE_VALUES lane
// list. Hosted CI's Repo Sanity lane runs the same check; keep them in parity.
const githubCheckChangesetStatusLanes = Effect.fn("QualityScriptCommands.githubCheckChangesetStatusLanes")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<GithubCheckLaneSpec>,
  QualityScriptCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  if (isTruthyMainPush()) {
    yield* Console.log("[github-checks] quality: skipped changeset status on main push");
    return A.empty<GithubCheckLaneSpec>();
  }

  const branch = yield* currentBranch(repoRoot);
  if (branch === "main") {
    yield* Console.log("[github-checks] quality: skipped changeset status on main");
    return A.empty<GithubCheckLaneSpec>();
  }

  return [
    githubCheckLane(
      "quality:changeset-status",
      "repo-quality",
      bunRunLane(repoRoot, "quality:changeset-status", ["changeset:status:since-main"])
    ),
  ];
});

// `[[IgnoredVulns]]` table header delimiting one OSV ignore entry in
// osv-scanner.toml. Splitting the config on this header yields one chunk per
// ignore block (plus a leading comment/preamble chunk).
const OSV_IGNORED_VULNS_HEADER = "[[IgnoredVulns]]";
// Per-block field patterns. The `m` flag anchors `^`/`$` to each physical line
// inside a multi-line block chunk; `ignoreUntil` is a bare RFC-3339 TOML
// datetime (optionally quoted) such as `2026-09-13T00:00:00Z`.
const osvIgnoreIdPattern = /^\s*id\s*=\s*"(.+)"\s*$/mu;
const osvIgnoreUntilPattern = /^\s*ignoreUntil\s*=\s*"?([^"#\s]+)"?\s*$/mu;

type OsvIgnoreEntry = {
  readonly id: string;
  // `O.none` when the block declares no expiry; `O.some` with the parsed
  // instant when `ignoreUntil` is present and parseable. A present-but-
  // unparseable `ignoreUntil` is reported via `expiryMalformed` so the entry
  // fails closed (it is not allowed to suppress the advisory).
  readonly ignoreUntil: O.Option<DateTime.DateTime>;
  readonly expiryMalformed: boolean;
};

const parseOsvIgnoreBlock = (block: string): O.Option<OsvIgnoreEntry> =>
  pipe(
    O.fromNullishOr(osvIgnoreIdPattern.exec(block)),
    O.flatMap((match) => O.fromNullishOr(match[1])),
    O.map((id) => {
      const rawIgnoreUntil = pipe(
        O.fromNullishOr(osvIgnoreUntilPattern.exec(block)),
        O.flatMap((match) => O.fromNullishOr(match[1]))
      );
      const ignoreUntil = O.flatMap(rawIgnoreUntil, DateTime.make);
      return {
        id,
        ignoreUntil,
        expiryMalformed: O.isSome(rawIgnoreUntil) && O.isNone(ignoreUntil),
      };
    })
  );

const parseOsvIgnoreEntries = (configText: string): ReadonlyArray<OsvIgnoreEntry> =>
  pipe(Str.split(configText, OSV_IGNORED_VULNS_HEADER), A.drop(1), A.map(parseOsvIgnoreBlock), A.getSomes);

const osvIgnoreEntryIsActive = (now: DateTime.DateTime): ((entry: OsvIgnoreEntry) => boolean) =>
  flow(
    O.liftPredicate((entry: OsvIgnoreEntry) => !entry.expiryMalformed),
    // Keep when there is no expiry, or the expiry is still in the future
    // (`ignoreUntil >= now`); drop malformed or expired ignores so the audit
    // fails closed and re-flags the advisory.
    O.map((entry) =>
      O.match(entry.ignoreUntil, {
        onNone: thunkTrue,
        onSome: Order.isGreaterThanOrEqualTo(DateTime.Order)(now),
      })
    ),
    O.getOrElse(thunkFalse)
  );

/**
 * Select the OSV advisory ids that may still be suppressed at `now`.
 *
 * Entries whose `ignoreUntil` has passed, or whose `ignoreUntil` is present but
 * unparseable, are dropped so the Bun audit lane stops mirroring expired
 * ignores and fails closed once the configured expiry elapses.
 *
 * @param configText - Raw `osv-scanner.toml` contents.
 * @param now - Current instant used to compare against each `ignoreUntil`.
 * @returns Active advisory ids in config order.
 * @example
 * ```ts
 * import { DateTime } from "effect"
 * import { activeOsvIgnoreIdsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const ids = activeOsvIgnoreIdsForTesting(
 *   '[[IgnoredVulns]]\nid = "GHSA-x"\nignoreUntil = 2999-01-01T00:00:00Z\n',
 *   DateTime.makeUnsafe("2026-06-17T00:00:00Z")
 * )
 * console.log(ids)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const activeOsvIgnoreIdsForTesting: {
  (configText: string, now: DateTime.DateTime): ReadonlyArray<string>;
  (now: DateTime.DateTime): (configText: string) => ReadonlyArray<string>;
} = dual(
  2,
  (configText: string, now: DateTime.DateTime): ReadonlyArray<string> =>
    pipe(
      parseOsvIgnoreEntries(configText),
      A.filter(osvIgnoreEntryIsActive(now)),
      A.map((entry) => entry.id)
    )
);

/**
 * Run Bun's high-severity package audit with OSV ignores mirrored from config.
 *
 * Only ignores whose `ignoreUntil` is still in the future are forwarded to
 * `bun audit --ignore`; expired or malformed-expiry entries are dropped so the
 * audit re-flags the advisory instead of silently suppressing it past expiry.
 *
 * @param repoRoot - Repository root directory.
 * @returns Effect that exits non-zero when audit fails.
 * @example
 * ```ts
 * import { runBunAudit } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runBunAudit("/repo")
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runBunAudit = Effect.fn("QualityScriptCommands.runBunAudit")(function* (
  repoRoot: string
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configPath = path.join(repoRoot, "osv-scanner.toml");
  const configText = yield* fs
    .readFileString(configPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${configPath}.`));
  const now = yield* DateTime.now;
  const entries = parseOsvIgnoreEntries(configText);
  const isActive = osvIgnoreEntryIsActive(now);
  const ignoredIds = pipe(
    entries,
    A.filter(isActive),
    A.map((entry) => entry.id)
  );
  const droppedIds = pipe(
    entries,
    A.filter((entry) => !isActive(entry)),
    A.map((entry) => entry.id)
  );

  if (A.isArrayNonEmpty(droppedIds)) {
    yield* Console.log(
      `[github-checks] repo-sanity:bun-audit: dropping expired/malformed OSV ignore(s): ${A.join(droppedIds, ", ")}`
    );
  }

  yield* runFixedStep(repoRoot, "repo-sanity:bun-audit", "bun", [
    "audit",
    "--audit-level=high",
    ...A.map(ignoredIds, (id) => `--ignore=${id}`),
  ]);
});

const githubCheckQualityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
  githubCheckLane("quality:build", "repo-quality", bunRunLane(repoRoot, "quality:build", ["build"])),
  githubCheckLane("quality:check", "repo-quality", bunRunLane(repoRoot, "quality:check", ["check"])),
  githubCheckLane("quality:knip", "repo-quality", repoCliLane(repoRoot, "quality:knip", ["knip"])),
  githubCheckLane(
    "quality:jsdoc-ratchet",
    "repo-quality",
    repoCliLane(repoRoot, "quality:jsdoc-ratchet", ["jsdoc-ratchet"])
  ),
  githubCheckLane("quality:lint", "repo-quality", bunRunLane(repoRoot, "quality:lint", ["lint"])),
  githubCheckLane("quality:docgen", "repo-quality", bunRunLane(repoRoot, "quality:docgen", ["docgen"])),
  githubCheckLane("quality:test", "repo-quality", bunRunLane(repoRoot, "quality:test", ["test"])),
];

const githubCheckRepoSanityLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
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

const githubCheckPrePushExternalLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
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
const githubCheckFallowLanes = (repoRoot: string): ReadonlyArray<GithubCheckLaneSpec> => [
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
 * console.log(githubCheckPrePushExternalLanesForTesting("/repo"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanesForTesting = githubCheckPrePushExternalLanes;

const runRepoSanity = Effect.fn("QualityScriptCommands.runRepoSanity")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityTaskConfigurationError | QualityTaskGroupFailed, QualityScriptEnvironment> {
  yield* runGithubCheckLaneGroup("github-checks:repo-sanity", githubCheckRepoSanityLanes(repoRoot));
});

const runQuality = Effect.fn("QualityScriptCommands.runQuality")(function* (
  repoRoot: string
): Effect.fn.Return<
  void,
  QualityScriptCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment
> {
  const changesetStatusLanes = yield* githubCheckChangesetStatusLanes(repoRoot);
  yield* runGithubCheckLaneGroup("github-checks:quality", [
    ...githubCheckQualityLanes(repoRoot),
    ...githubCheckRepoSanityLanes(repoRoot),
    ...changesetStatusLanes,
  ]);
});

const runPrePushChecks = Effect.fn("QualityScriptCommands.runPrePushChecks")(function* (
  repoRoot: string
): Effect.fn.Return<
  void,
  QualityScriptCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment
> {
  const changesetStatusLanes = yield* githubCheckChangesetStatusLanes(repoRoot);
  yield* runGithubCheckLaneGroup("github-checks:pre-push", [
    ...githubCheckQualityLanes(repoRoot),
    ...githubCheckFallowLanes(repoRoot),
    ...githubCheckRepoSanityLanes(repoRoot),
    ...changesetStatusLanes,
    ...githubCheckPrePushExternalLanes(repoRoot),
  ]);
});

const qualityRangeEnv = (base: string, head: string): Record<string, string | undefined> => ({
  TURBO_SCM_BASE: base,
  TURBO_SCM_HEAD: head,
});

const devQualityAffectedArgs = ["--affected", "--summarize"] as const;

type DevQualityStepOptions = { readonly base: string; readonly head: string; readonly surface: boolean };

/**
 * Build the balanced local development quality steps for a repository.
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param options - Git range and surface-check options for the dev quality lane.
 * @returns Planned quality task steps for the requested development profile.
 * @example
 * ```ts
 * import { devQualityStepsForTesting } from "@beep/repo-cli/test/Quality"
 * import * as A from "effect/Array"
 * import { pipe } from "effect"
 *
 * const labels = pipe(
 *   "/repo",
 *   devQualityStepsForTesting({
 *     base: "origin/main",
 *     head: "HEAD",
 *     surface: false
 *   }),
 *   A.map((step) => step.label)
 * )
 * console.log(labels)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const devQualityStepsForTesting: {
  (options: DevQualityStepOptions): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
  (repoRoot: string, options: DevQualityStepOptions): ReadonlyArray<QualityTaskStep>;
} = dual(2, (repoRoot: string, options: DevQualityStepOptions): ReadonlyArray<QualityTaskStep> => {
  const env = qualityRangeEnv(options.base, options.head);
  const baseSteps = [
    QualityTaskStep.make({
      label: "dev:lint",
      command: "bun",
      args: ["run", "lint", "--", ...devQualityAffectedArgs],
      cwd: repoRoot,
      env,
    }),
    QualityTaskStep.make({
      label: "dev:check",
      command: "bun",
      args: ["run", "check", "--", ...devQualityAffectedArgs],
      cwd: repoRoot,
      env,
    }),
    QualityTaskStep.make({
      label: "dev:test",
      command: "bun",
      args: ["run", "test", "--", "--unit", "--types", ...devQualityAffectedArgs],
      cwd: repoRoot,
      env,
    }),
  ];

  if (!options.surface) {
    return baseSteps;
  }

  return [
    ...baseSteps,
    QualityTaskStep.make({
      label: "dev:docgen-local",
      command: "bun",
      args: ["run", "docgen:local", "--", "--base", options.base, "--head", options.head, "--parallel=3"],
      cwd: repoRoot,
    }),
  ];
});

const runDevQuality = Effect.fn("QualityScriptCommands.runDevQuality")(function* (
  repoRoot: string,
  options: { readonly base: string; readonly head: string; readonly surface: boolean }
): Effect.fn.Return<void, QualityTaskConfigurationError | QualityTaskGroupFailed, QualityScriptEnvironment> {
  yield* runQualityTaskStreamingStepGroup("quality:dev", devQualityStepsForTesting(repoRoot, options));
});

/**
 * Build the docgen command arguments for the review-fix proof lane.
 *
 * @param base - Git base ref for changed package discovery.
 * @param head - Git head ref for changed package discovery.
 * @returns Arguments passed to `bun run`.
 * @example
 * ```ts
 * import { reviewFixDocgenLocalArgsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(reviewFixDocgenLocalArgsForTesting("origin/main", "HEAD"))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const reviewFixDocgenLocalArgsForTesting: {
  (base: string, head: string): ReadonlyArray<string>;
  (head: string): (base: string) => ReadonlyArray<string>;
} = dual(
  2,
  (base: string, head: string): ReadonlyArray<string> => [
    "docgen:local",
    "--",
    "--base",
    base,
    "--head",
    head,
    "--parallel=3",
    "--full",
  ]
);

const runReviewFix = Effect.fn("QualityScriptCommands.runReviewFix")(function* (
  repoRoot: string,
  options: GithubCheckRunOptions
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const base = options.base ?? "origin/main";
  const head = options.head ?? "HEAD";
  const env = qualityRangeEnv(base, head);

  yield* Console.log(`[github-checks] review-fix: affected build/check/lint/test for ${base}...${head}`);
  yield* runBunWithEnv(repoRoot, "review-fix:build", ["build", "--", "--affected", "--summarize"], env);
  yield* runBunWithEnv(repoRoot, "review-fix:check", ["check", "--", "--affected", "--summarize"], env);
  yield* runBunWithEnv(repoRoot, "review-fix:lint", ["lint", "--", "--affected", "--summarize"], env);
  yield* runBunWithEnv(
    repoRoot,
    "review-fix:test",
    ["test", "--", "--unit", "--types", "--affected", "--summarize"],
    env
  );

  yield* Console.log("[github-checks] review-fix: local docgen");
  yield* runBun(repoRoot, "review-fix:docgen-local", reviewFixDocgenLocalArgsForTesting(base, head));
});

const runSecretScan = Effect.fn("QualityScriptCommands.runSecretScan")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const mergeBase = yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "secrets:merge-base",
      command: "git",
      args: ["merge-base", "origin/main", "HEAD"],
      cwd: repoRoot,
    })
  );

  yield* Console.log("[github-checks] secrets: gitleaks");
  yield* runFixedStep(repoRoot, "secrets:gitleaks", "gitleaks", [
    "git",
    "--no-banner",
    "--redact",
    "--config",
    ".gitleaks.toml",
    "--gitleaks-ignore-path",
    ".gitleaksignore",
    "--log-opts",
    `${mergeBase}..HEAD`,
    ".",
  ]);
});

const runSecurityScan = Effect.fn("QualityScriptCommands.runSecurityScan")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log("[github-checks] security: osv scan");
  yield* runFixedStep(repoRoot, "security:osv-scan", "docker", [
    "run",
    "--rm",
    "-v",
    `${repoRoot}:/github/workspace`,
    "-w",
    "/github/workspace",
    "ghcr.io/google/osv-scanner-action:v2.3.3",
    "--lockfile=bun.lock",
    "--config=osv-scanner.toml",
  ]);
});

const runSastScan = Effect.fn("QualityScriptCommands.runSastScan")(function* (
  repoRoot: string
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const trackedFilesOutput = yield* collectSuccessfulOutput(
    QualityTaskStep.make({
      label: "sast:changed-files",
      command: "git",
      args: [
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        "origin/main...HEAD",
        "--",
        "*.ts",
        "*.tsx",
        "*.js",
        "*.jsx",
        "*.mjs",
        "*.cjs",
      ],
      cwd: repoRoot,
    })
  );
  const candidateFiles = pipe(
    Str.split(trackedFilesOutput, "\n"),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.filter(P.not(Str.startsWith(".repos/")))
  );
  const semgrepFiles = yield* Effect.forEach(
    candidateFiles,
    Effect.fn(function* (filePath) {
      const absolutePath = path.join(repoRoot, filePath);
      const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
      if (!exists) {
        return O.none<string>();
      }

      const symlinkTarget = yield* fs.readLink(absolutePath).pipe(Effect.option);
      if (O.isSome(symlinkTarget)) {
        return yield* QualityScriptCommandError.make({
          message: `Changed JavaScript/TypeScript symlink paths are not accepted by the SAST scan: ${filePath}`,
        });
      }

      const canonicalPath = yield* fs.realPath(absolutePath).pipe(Effect.option);
      if (O.isNone(canonicalPath) || canonicalPath.value !== path.resolve(absolutePath)) {
        return O.none<string>();
      }

      return O.some(filePath);
    }),
    { concurrency: 8 }
  ).pipe(Effect.map(A.getSomes));

  if (A.isReadonlyArrayEmpty(semgrepFiles)) {
    yield* Console.log("[github-checks] sast: skipped, no tracked JavaScript or TypeScript files");
    return;
  }

  yield* Console.log("[github-checks] sast: semgrep");
  yield* runFixedStep(repoRoot, "sast:semgrep", "docker", [
    "run",
    "--rm",
    "-e",
    "SEMGREP_SEND_METRICS=off",
    "-v",
    `${repoRoot}:/src`,
    "-w",
    "/src",
    "semgrep/semgrep",
    "semgrep",
    "scan",
    "--config",
    "p/typescript",
    "--config",
    "p/javascript",
    "--config",
    "p/security-audit",
    "--config",
    "p/secrets",
    "--disable-version-check",
    "--timeout",
    "20",
    ...semgrepFiles,
  ]);
});

const runNixChecks = Effect.fn("QualityScriptCommands.runNixChecks")(function* (
  repoRoot: string
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log("[github-checks] nix: flake check");
  yield* runFixedStep(repoRoot, "nix:flake-check", "nix", [
    "--option",
    "warn-dirty",
    "false",
    "flake",
    "check",
    "--all-systems",
  ]);

  yield* Console.log("[github-checks] nix: dev shell");
  yield* runFixedStep(repoRoot, "nix:dev-shell", "nix", [
    "--option",
    "warn-dirty",
    "false",
    "develop",
    "--command",
    "echo",
    "Dev shell OK",
  ]);
});

/**
 * Run a GitHub checks mode from the repository root.
 *
 * @param mode - GitHub check mode to run.
 * @returns Effect that executes the requested mode.
 * @example
 * ```ts
 * import { runGithubChecks } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runGithubChecks("repo-sanity")
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runGithubChecks = Effect.fn("QualityScriptCommands.runGithubChecks")(function* (
  mode: GithubCheckMode,
  options: GithubCheckRunOptions = {}
): Effect.fn.Return<void, GithubCheckError, QualityScriptEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));

  yield* GithubCheckMode.$match(mode, {
    quality: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runQuality(repoRoot))),
    "review-fix": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runReviewFix(repoRoot, options))),
    "repo-sanity": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runRepoSanity(repoRoot))),
    secrets: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runSecretScan(repoRoot))),
    security: () => runSecurityScan(repoRoot),
    sast: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runSastScan(repoRoot))),
    nix: () => runNixChecks(repoRoot),
    "pre-push": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runPrePushChecks(repoRoot))),
  });
});

const readGithubChecksFallowFeatureMatrix = Effect.fn("QualityScriptCommands.readGithubChecksFallowFeatureMatrix")(
  function* (
    repoRoot: string,
    featureMatrixPath: string
  ): Effect.fn.Return<GithubChecksFallowFeatureMatrix, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const absolutePath = path.resolve(repoRoot, featureMatrixPath);
    const text = yield* fs
      .readFileString(absolutePath)
      .pipe(QualityScriptCommandError.mapError(`Failed to read ${featureMatrixPath}.`));
    const parseErrors: Array<ParseError> = [];
    const parsed = parse(text, parseErrors, {
      allowTrailingComma: true,
      disallowComments: false,
    });

    if (A.isReadonlyArrayNonEmpty(parseErrors)) {
      yield* Console.error(`[github-checks] failed to parse ${featureMatrixPath}`);
      yield* Console.error(
        A.join(
          A.map(parseErrors, (error) => `parse error ${error.error} at offset ${error.offset}`),
          "\n"
        )
      );
      return yield* QualityScriptCommandError.make({
        message: `${featureMatrixPath} is not valid JSONC.`,
        exitCode: 1,
      });
    }

    return yield* decodeGithubChecksFallowFeatureMatrix(parsed).pipe(
      QualityScriptCommandError.mapError(`Failed to decode ${featureMatrixPath}.`)
    );
  }
);

const runGithubChecksPlanContractCheck = Effect.fn("QualityScriptCommands.runGithubChecksPlanContractCheck")(function* (
  mode: GithubCheckMode,
  featureMatrixPath: string,
  expectPromotedFallowLanes: boolean
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const matrix = yield* readGithubChecksFallowFeatureMatrix(repoRoot, featureMatrixPath);
  const diagnostics = expectPromotedFallowLanes
    ? githubCheckPromotedFallowLaneDiagnosticsForTesting(repoRoot, mode, matrix)
    : A.empty<string>();

  if (A.isReadonlyArrayNonEmpty(diagnostics)) {
    yield* Console.error(`[github-checks] plan contract failed for ${mode}:`);
    yield* Console.error(
      A.join(
        A.map(diagnostics, (diagnostic) => `  - ${diagnostic}`),
        "\n"
      )
    );
    return yield* QualityScriptCommandError.make({
      message: `github-checks plan contract failed for ${mode}.`,
      exitCode: 1,
    });
  }

  const promotedCount = A.length(promotedFallowGithubCheckLaneIdsForTesting(matrix));
  yield* Console.log(`[github-checks] plan contract ok: ${mode} (${promotedCount} promoted Fallow lane(s))`);
});

const normalizePath = Str.replaceAll("\\", "/");

const pathContainsSegment = (filePath: string, segments: ReadonlyArray<string>): boolean =>
  A.some(segments, (segment) => Str.includes(segment)(filePath));

const collectFiles = Effect.fn("QualityScriptCommands.collectFiles")(function* (
  searchRoot: string,
  shouldInclude: (normalizedPath: string, name: string) => boolean,
  shouldSkipDirectory: (normalizedPath: string, name: string) => boolean
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(searchRoot).pipe(Effect.orElseSucceed(thunkFalse));

  if (!exists) {
    return A.empty<string>();
  }

  const visit = Effect.fn("QualityScriptCommands.collectFiles.visit")(function* (
    currentPath: string
  ): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(currentPath)
      .pipe(QualityScriptCommandError.mapError(`Failed to read directory ${currentPath}.`));
    let files = A.empty<string>();

    for (const entry of entries) {
      const childPath = path.join(currentPath, entry);
      const normalized = normalizePath(childPath);
      const symlinkTarget = yield* fs.readLink(childPath).pipe(Effect.option);

      if (O.isSome(symlinkTarget)) {
        continue;
      }

      const stat = yield* fs.stat(childPath).pipe(QualityScriptCommandError.mapError(`Failed to stat ${childPath}.`));

      if (stat.type === "Directory") {
        if (!shouldSkipDirectory(`${normalized}/`, entry)) {
          files = A.appendAll(files, yield* visit(childPath));
        }
        continue;
      }

      if (stat.type === "File" && shouldInclude(normalized, entry)) {
        files = A.append(files, childPath);
      }
    }

    return files;
  });

  return pipe(yield* visit(searchRoot), A.sort(Order.String));
});

type TestTsgoPackageGroup = {
  readonly packageDir: string;
  readonly tsconfigPath: string;
  readonly files: ReadonlyArray<string>;
};

type TestTsgoPackageResult = {
  readonly group: TestTsgoPackageGroup;
  readonly output: string;
  readonly exitCode: number;
  readonly syntheticConfigPath: string;
};

const tsgoTestPackageLabel = (repoRoot: string, packageDir: string): string =>
  pipe(packageDir, Str.replace(`${repoRoot}/`, ""), Str.replaceAll("/", "-"), Str.replaceAll("@", ""));

const findOwningPackageDir = Effect.fn("QualityScriptCommands.findOwningPackageDir")(function* (
  repoRoot: string,
  filePath: string
): Effect.fn.Return<string, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let current = path.dirname(filePath);

  while (current !== repoRoot && Str.startsWith(repoRoot)(current)) {
    const packageJsonPath = path.join(current, "package.json");
    const hasPackageJson = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(thunkFalse));

    if (hasPackageJson) {
      return current;
    }

    current = path.dirname(current);
  }

  return repoRoot;
});

const resolveTestTsconfigPath = Effect.fn("QualityScriptCommands.resolveTestTsconfigPath")(function* (
  packageDir: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = [
    path.join(packageDir, "tsconfig.test.json"),
    path.join(packageDir, "test", "tsconfig.json"),
    path.join(packageDir, "tsconfig.json"),
  ];

  for (const candidate of candidates) {
    const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(thunkFalse));

    if (exists) {
      return candidate;
    }
  }

  return path.join(packageDir, "tsconfig.json");
});

const collectTestTsgoPackageGroups = Effect.fn("QualityScriptCommands.collectTestTsgoPackageGroups")(function* (
  repoRoot: string,
  discoveredFiles: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<TestTsgoPackageGroup>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fileEntries = yield* Effect.forEach(
    discoveredFiles,
    Effect.fnUntraced(function* (filePath) {
      const packageDir = yield* findOwningPackageDir(repoRoot, filePath);
      return [packageDir, filePath] as const;
    }),
    { concurrency: 1 }
  );
  const packageDirs = pipe(
    fileEntries,
    A.map(([packageDir]) => packageDir),
    A.dedupe,
    A.sort(Order.String)
  );

  return yield* Effect.forEach(
    packageDirs,
    Effect.fnUntraced(function* (packageDir) {
      const tsconfigPath = yield* resolveTestTsconfigPath(packageDir);
      const files = pipe(
        fileEntries,
        A.filter(([entryPackageDir]) => entryPackageDir === packageDir),
        A.map(([, filePath]) => filePath),
        A.sort(Order.String)
      );
      return {
        packageDir,
        tsconfigPath,
        files,
      } satisfies TestTsgoPackageGroup;
    }),
    { concurrency: 1 }
  );
});

const runTestTsgoPackageGroup = Effect.fn("QualityScriptCommands.runTestTsgoPackageGroup")(function* (
  repoRoot: string,
  tempDir: string,
  extraArgs: ReadonlyArray<string>,
  group: TestTsgoPackageGroup
): Effect.fn.Return<
  TestTsgoPackageResult,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const groupLabel = tsgoTestPackageLabel(repoRoot, group.packageDir);
  const syntheticConfigPath = path.join(tempDir, `${groupLabel}.tsconfig.json`);
  const syntheticConfig = {
    extends: group.tsconfigPath,
    references: [],
    include: group.files,
    exclude: [],
    compilerOptions: {
      composite: false,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      incremental: false,
      noEmit: true,
      rootDir: repoRoot,
      sourceMap: false,
      tsBuildInfoFile: path.join(tempDir, `${groupLabel}.tsbuildinfo`),
      types: ["node", "bun"],
    },
  };
  const configText = yield* jsonStringifyPretty(syntheticConfig).pipe(
    QualityScriptCommandError.mapError(`Failed to encode ${groupLabel} test tsconfig.`)
  );

  yield* fs
    .writeFileString(syntheticConfigPath, `${configText}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${syntheticConfigPath}.`));

  const result = yield* collectOutput(
    QualityTaskStep.make({
      label: `check:tsgo:tests:${groupLabel}`,
      command: path.join(repoRoot, "node_modules", ".bin", "tsgo"),
      args: ["-p", syntheticConfigPath, "--pretty", "false", ...extraArgs],
      cwd: repoRoot,
    })
  ).pipe(Effect.ensuring(fs.remove(syntheticConfigPath).pipe(Effect.ignore)));

  return {
    group,
    output: result.output,
    exitCode: result.exitCode,
    syntheticConfigPath,
  };
});

/**
 * Collect Effect tsgo diagnostics from command output regardless of process exit code.
 *
 * @param results - Completed tsgo command outputs to scan.
 * @returns Matching Effect diagnostic output lines.
 * @example
 * ```ts
 * import { collectEffectTsgoDiagnosticLines } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const diagnostics = collectEffectTsgoDiagnosticLines([{ output: "warning TS90001: effect(service)\\n" }])
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const collectEffectTsgoDiagnosticLines: (results: ReadonlyArray<TsgoDiagnosticOutput>) => ReadonlyArray<string> =
  flow(
    A.flatMap((result: TsgoDiagnosticOutput) =>
      pipe(
        Str.split(result.output, "\n"),
        A.filter((line) => effectTsgoDiagnosticPattern.test(line))
      )
    )
  );

const unknownRecordProperty: {
  (value: unknown, key: string): O.Option<unknown>;
  (key: string): (value: unknown) => O.Option<unknown>;
} = dual(2, (value: unknown, key: string): O.Option<unknown> => {
  if (A.isArray(value)) {
    return O.none();
  }

  return pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => O.fromUndefinedOr(record[key]))
  );
});

const unknownRecordKeys = (value: unknown): ReadonlyArray<string> =>
  A.isArray(value)
    ? A.empty<string>()
    : pipe(decodeUnknownRecordOption(value), O.map(flow(R.keys, A.sort(Order.String))), O.getOrElse(A.empty<string>));

const extractEffectTsgoDiagnosticsTableFragment = (readme: string): O.Option<string> => {
  const tableStart = readme.indexOf(effectTsgoDiagnosticsTableStartMarker);
  const tableEnd = readme.indexOf(effectTsgoDiagnosticsTableEndMarker);

  return tableStart === -1 || tableEnd === -1 || tableEnd <= tableStart
    ? O.none()
    : O.some(Str.slice(tableStart + effectTsgoDiagnosticsTableStartMarker.length, tableEnd)(readme));
};

const extractEffectTsgoRuleNameFromRow = flow(
  decodeEffectTsgoRuleRowOption,
  O.flatMap((decodedRow) => A.head(decodedRow.td)),
  O.flatMap(decodeEffectTsgoRuleCellOption),
  O.map((cell) => cell.code)
);

const extractEffectTsgoReadmeRuleNames = flow(
  extractEffectTsgoDiagnosticsTableFragment,
  O.map((fragment) => effectTsgoReadmeParser.parse(`<root>${fragment}</root>`)),
  O.flatMap(decodeEffectTsgoDiagnosticsTableOption),
  O.map((decoded) =>
    pipe(
      decoded.root.table.tbody.tr,
      A.flatMap((row) =>
        pipe(
          extractEffectTsgoRuleNameFromRow(row),
          O.match({
            onNone: A.empty<string>,
            onSome: A.of,
          })
        )
      ),
      A.dedupe,
      A.sort(Order.String)
    )
  ),
  O.getOrElse(A.empty<string>)
);

const findEffectLanguageServicePlugin = (config: unknown): O.Option<Readonly<Record<string, unknown>>> =>
  pipe(
    unknownRecordProperty(config, "compilerOptions"),
    O.flatMap((compilerOptions) => unknownRecordProperty(compilerOptions, "plugins")),
    O.flatMap(decodeUnknownArrayOption),
    O.flatMap(
      A.findFirst((plugin) =>
        pipe(
          unknownRecordProperty(plugin, "name"),
          O.exists((name) => name === "@effect/language-service")
        )
      )
    ),
    O.flatMap(decodeUnknownRecordOption)
  );

const collectDisabledDiagnosticSeverityEntries = (
  value: unknown,
  propertyPath: ReadonlyArray<string>
): ReadonlyArray<string> => {
  if (A.isArray(value)) {
    return pipe(
      value,
      A.flatMap((entry, index) =>
        collectDisabledDiagnosticSeverityEntries(entry, pipe(propertyPath, A.append(`[${index}]`)))
      )
    );
  }

  const record = decodeUnknownRecordOption(value);
  if (O.isNone(record)) {
    return A.empty<string>();
  }

  return pipe(
    unknownRecordKeys(value),
    A.flatMap((key) => {
      const entryPath = pipe(propertyPath, A.append(key));
      const nested = record.value[key];
      const disabledAtThisProperty =
        key === "diagnosticSeverity"
          ? pipe(
              unknownRecordKeys(nested),
              A.flatMap((ruleName) =>
                pipe(
                  unknownRecordProperty(nested, ruleName),
                  O.filter((severity) => severity === "off"),
                  O.match({
                    onNone: A.empty<string>,
                    onSome: () => A.of(`${A.join(entryPath, ".")}.${ruleName}`),
                  })
                )
              )
            )
          : A.empty<string>();

      return A.appendAll(disabledAtThisProperty, collectDisabledDiagnosticSeverityEntries(nested, entryPath));
    })
  );
};

const renderTsgoRuleDiagnostics = (label: string, diagnostics: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.isReadonlyArrayNonEmpty(diagnostics)
    ? [`${label}:`, ...A.map(diagnostics, (diagnostic) => `  - ${diagnostic}`)]
    : [];

/**
 * Check that the root tsgo Effect diagnostics configuration enables every installed rule as an error.
 *
 * @returns Effect that fails when tsgo rules drift or local source suppresses Effect diagnostics.
 * @example
 * ```ts
 * import { runTsgoRulesCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTsgoRulesCheck()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runTsgoRulesCheck = Effect.fn("QualityScriptCommands.runTsgoRulesCheck")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  QualityScriptEnvironment
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const readmePath = path.join(repoRoot, "node_modules", "@effect", "tsgo", "README.md");
  const tsconfigPath = path.join(repoRoot, "tsconfig.base.json");
  const readmeText = yield* fs
    .readFileString(readmePath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${readmePath}.`));
  const installedRuleNames = extractEffectTsgoReadmeRuleNames(readmeText);

  if (A.isReadonlyArrayEmpty(installedRuleNames)) {
    return yield* QualityScriptCommandError.make({
      message: "Failed to discover @effect/tsgo diagnostic rules from the installed README.",
      exitCode: 1,
    });
  }

  const configText = yield* fs
    .readFileString(tsconfigPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${tsconfigPath}.`));
  const parseErrors: Array<ParseError> = [];
  const config = parse(configText, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  if (A.isReadonlyArrayNonEmpty(parseErrors)) {
    yield* Console.error("[check:tsgo-rules] failed to parse tsconfig.base.json");
    yield* Console.error(
      A.join(
        A.map(parseErrors, (error) => `parse error ${error.error} at offset ${error.offset}`),
        "\n"
      )
    );
    return yield* QualityScriptCommandError.make({
      message: "tsconfig.base.json is not valid JSONC.",
      exitCode: 1,
    });
  }

  const plugin = findEffectLanguageServicePlugin(config);
  if (O.isNone(plugin)) {
    return yield* QualityScriptCommandError.make({
      message: "tsconfig.base.json is missing the @effect/language-service plugin.",
      exitCode: 1,
    });
  }

  const diagnosticSeverity = pipe(
    unknownRecordProperty(plugin.value, "diagnosticSeverity"),
    O.flatMap(decodeUnknownRecordOption)
  );
  if (O.isNone(diagnosticSeverity)) {
    return yield* QualityScriptCommandError.make({
      message: "tsconfig.base.json is missing the root @effect/language-service diagnosticSeverity map.",
      exitCode: 1,
    });
  }

  const configuredRuleNames = pipe(R.keys(diagnosticSeverity.value), A.sort(Order.String));
  const missingRuleNames = A.filter(installedRuleNames, (ruleName) => !A.contains(configuredRuleNames, ruleName));
  const extraRuleNames = A.filter(configuredRuleNames, (ruleName) => !A.contains(installedRuleNames, ruleName));
  const nonErrorSeverities = pipe(
    configuredRuleNames,
    A.flatMap((ruleName) =>
      diagnosticSeverity.value[ruleName] === "error"
        ? A.empty<string>()
        : A.of(`${ruleName}: ${String(diagnosticSeverity.value[ruleName])}`)
    )
  );
  const disabledSeverityEntries = collectDisabledDiagnosticSeverityEntries(plugin.value, [
    "compilerOptions",
    "plugins",
    "@effect/language-service",
  ]);
  const scannedFiles = yield* Effect.forEach(
    effectDiagnosticsDirectiveScannedRoots,
    (root) =>
      collectFiles(
        path.join(repoRoot, root),
        (_normalized, name) => A.contains(effectDiagnosticsDirectiveScannedExtensions, path.extname(name)),
        (_normalized, name) => A.contains(effectDiagnosticsDirectiveIgnoredDirectoryNames, name)
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
  const disabledDirectives = yield* Effect.forEach(
    scannedFiles,
    Effect.fn(function* (filePath) {
      const text = yield* fs
        .readFileString(filePath)
        .pipe(QualityScriptCommandError.mapError(`Failed to read ${filePath}.`));
      return pipe(
        Str.split(text, "\n"),
        A.flatMap((line, index) =>
          effectDiagnosticsOffDirectivePattern.test(line)
            ? A.of(`${normalizePath(path.relative(repoRoot, filePath))}:${index + 1}`)
            : A.empty<string>()
        )
      );
    }),
    { concurrency: 8 }
  ).pipe(Effect.map(A.flatten));
  const diagnostics = [
    ...renderTsgoRuleDiagnostics("missing installed rules", missingRuleNames),
    ...renderTsgoRuleDiagnostics("unexpected configured rules", extraRuleNames),
    ...renderTsgoRuleDiagnostics("rules not configured as error", nonErrorSeverities),
    ...renderTsgoRuleDiagnostics("diagnosticSeverity entries set to off", disabledSeverityEntries),
    ...renderTsgoRuleDiagnostics("disabled Effect diagnostic directives", disabledDirectives),
  ];

  if (A.isReadonlyArrayNonEmpty(diagnostics)) {
    yield* Console.error("[check:tsgo-rules] @effect/tsgo diagnostics are not globally enforced.");
    yield* Console.error(A.join(diagnostics, "\n"));
    return yield* QualityScriptCommandError.make({
      message: "@effect/tsgo rule enforcement drift found.",
      exitCode: 1,
    });
  }

  yield* Console.log(
    `[check:tsgo-rules] verified ${A.length(installedRuleNames)} installed @effect/tsgo rule(s) are configured as error`
  );
});

const runTsgoWithSyntheticConfig = Effect.fn("QualityScriptCommands.runTsgoWithSyntheticConfig")(function* (
  repoRoot: string,
  label: string,
  discoveredFiles: ReadonlyArray<string>,
  configName: string,
  baseTsconfig: string,
  extraCompilerOptions: Record<string, unknown>,
  extraArgs: unknown
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tempDir = path.join(repoRoot, "node_modules", ".tmp", label);
  const syntheticConfigPath = path.join(tempDir, configName);
  const normalizedExtraArgs = normalizeExtraArgs(extraArgs);
  const syntheticConfig = {
    extends: path.join(repoRoot, baseTsconfig),
    references: [],
    include: discoveredFiles,
    exclude: [],
    compilerOptions: {
      composite: false,
      incremental: false,
      noEmit: true,
      rootDir: repoRoot,
      ...extraCompilerOptions,
    },
  };
  const configText = yield* jsonStringifyPretty(syntheticConfig).pipe(
    QualityScriptCommandError.mapError(`Failed to encode ${label} synthetic tsconfig.`)
  );

  yield* fs
    .makeDirectory(tempDir, { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${tempDir}.`));
  yield* fs
    .writeFileString(syntheticConfigPath, `${configText}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${syntheticConfigPath}.`));

  yield* runFixedStep(repoRoot, label, path.join(repoRoot, "node_modules", ".bin", "tsgo"), [
    "-p",
    syntheticConfigPath,
    ...normalizedExtraArgs,
  ]).pipe(Effect.ensuring(fs.remove(syntheticConfigPath, { recursive: false }).pipe(Effect.ignore)));
});

/**
 * Run repo-wide tsgo diagnostics for dtslint files.
 *
 * @param extraArgs - Additional arguments passed to tsgo.
 * @returns Effect that runs the dtslint tsgo lane.
 * @example
 * ```ts
 * import { runDtslintTsgoChecks } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runDtslintTsgoChecks([])
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runDtslintTsgoChecks = Effect.fn("QualityScriptCommands.runDtslintTsgoChecks")(function* (
  extraArgs: ReadonlyArray<string>
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const discoveredFiles = yield* Effect.forEach(
    dtslintSearchRoots,
    (root) =>
      collectFiles(
        path.join(repoRoot, root),
        (normalized, name) => Str.includes("/dtslint/")(normalized) && /\.tst\.[^.]+$/u.test(name),
        thunkFalse
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

  if (A.isReadonlyArrayEmpty(discoveredFiles)) {
    yield* Console.log("[check:dtslint:tsgo] no dtslint files found");
    return;
  }

  yield* Console.log(`[check:dtslint:tsgo] checking ${A.length(discoveredFiles)} file(s) with tsconfig.json`);
  yield* runTsgoWithSyntheticConfig(
    repoRoot,
    "check:dtslint:tsgo",
    discoveredFiles,
    "dtslint.tsconfig.json",
    "tsconfig.json",
    {},
    extraArgs
  );
});

/**
 * Run repo-wide Effect diagnostics for test files.
 *
 * @param extraArgs - Additional arguments passed to tsgo.
 * @returns Effect that runs the test-file tsgo lane.
 * @example
 * ```ts
 * import { runTestTsgoChecks } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTestTsgoChecks([])
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runTestTsgoChecks = Effect.fn("QualityScriptCommands.runTestTsgoChecks")(function* (
  extraArgs: unknown
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const discoveredFiles = yield* Effect.forEach(
    testSearchRoots,
    (root) =>
      collectFiles(
        path.join(repoRoot, root),
        (normalized, name) =>
          Str.includes("/test/")(normalized) &&
          !pathContainsSegment(normalized, ignoredTestPathSegments) &&
          /\.(?:cts|mts|ts|tsx)$/u.test(name),
        (normalized, name) =>
          A.contains(ignoredTestDirectoryNames as ReadonlyArray<string>, name) ||
          pathContainsSegment(normalized, ignoredTestPathSegments)
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

  if (A.isReadonlyArrayEmpty(discoveredFiles)) {
    yield* Console.log("[check:tsgo:tests] no test files found");
    return;
  }

  const tempDir = path.join(repoRoot, "node_modules", ".tmp", "tsgo-test-checks");
  const normalizedExtraArgs = normalizeExtraArgs(extraArgs);
  const packageGroups = yield* collectTestTsgoPackageGroups(repoRoot, discoveredFiles);

  yield* pipe(
    fs.makeDirectory(tempDir, { recursive: true }),
    QualityScriptCommandError.mapError(`Failed to create ${tempDir}.`)
  );

  yield* Console.log(
    `[check:tsgo:tests] checking ${A.length(discoveredFiles)} file(s) across ${A.length(packageGroups)} package(s)`
  );
  const results = yield* Effect.forEach(
    packageGroups,
    (group) => runTestTsgoPackageGroup(repoRoot, tempDir, normalizedExtraArgs, group),
    { concurrency: 1 }
  ).pipe(
    Effect.ensuring(
      fs
        .remove(tempDir, {
          recursive: true,
          force: true,
        })
        .pipe(Effect.ignore)
    )
  );
  const failures = A.filter(results, (result) => result.exitCode !== 0);
  const effectDiagnosticLines = collectEffectTsgoDiagnosticLines(results);

  if (A.isReadonlyArrayNonEmpty(effectDiagnosticLines)) {
    yield* Console.error(
      `[check:tsgo:tests] found ${A.length(effectDiagnosticLines)} Effect diagnostic(s) in test files`
    );
    yield* Console.error(A.join(effectDiagnosticLines, "\n"));
  }

  if (A.isReadonlyArrayNonEmpty(failures)) {
    for (const failure of failures) {
      const packageName = tsgoTestPackageLabel(repoRoot, failure.group.packageDir);
      const configName = pipe(failure.group.tsconfigPath, Str.replace(`${failure.group.packageDir}/`, ""));
      yield* Console.error(`[check:tsgo:tests] ${packageName} failed with ${configName}`);
      if (Str.isNonEmpty(failure.output)) {
        yield* Console.error(failure.output);
      }
    }
  }

  if (A.isReadonlyArrayNonEmpty(effectDiagnosticLines) || A.isReadonlyArrayNonEmpty(failures)) {
    return yield* withExitCode(
      "check:tsgo:tests",
      path.join(repoRoot, "node_modules", ".bin", "tsgo"),
      ["-p", "<package-test-tsconfig>"],
      1
    );
  }
});

/**
 * Verify that tsgo reports the Effect diagnostic expected by this repo.
 *
 * @returns Effect that performs the smoke check.
 * @example
 * ```ts
 * import { runTsgoSmokeCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTsgoSmokeCheck()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runTsgoSmokeCheck = Effect.fn("QualityScriptCommands.runTsgoSmokeCheck")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  QualityScriptEnvironment
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const tempRoot = path.join(repoRoot, "node_modules", ".tmp");
  const smokeDir = yield* fs
    .makeTempDirectory({ directory: tempRoot })
    .pipe(QualityScriptCommandError.mapError("Failed to create tsgo smoke dir."));
  const srcDir = path.join(smokeDir, "src");
  const tsconfigPath = path.join(smokeDir, "tsconfig.json");
  const sourcePath = path.join(srcDir, "index.ts");
  const tsgoPath = path.join(repoRoot, "node_modules", ".bin", "tsgo");

  yield* fs
    .makeDirectory(srcDir, { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${srcDir}.`));
  yield* fs
    .writeFileString(
      sourcePath,
      A.join(
        [
          'import { Effect } from "effect";',
          "",
          "export const shouldHaveSuggestion = () => {",
          "  return Effect.gen(function* () {",
          "    yield* Effect.succeed(1);",
          "    return 42;",
          "  });",
          "};",
          "",
        ],
        "\n"
      )
    )
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${sourcePath}.`));
  const configText = yield* jsonStringifyPretty({
    extends: path.join(repoRoot, "tsconfig.base.json"),
    include: ["src/**/*.ts"],
    exclude: [],
    compilerOptions: {
      composite: false,
      incremental: false,
      noEmit: true,
    },
  }).pipe(QualityScriptCommandError.mapError("Failed to encode smoke config."));

  yield* fs
    .writeFileString(tsconfigPath, `${configText}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${tsconfigPath}.`));
  const result = yield* collectOutput(
    QualityTaskStep.make({
      label: "check:tsgo:smoke",
      command: tsgoPath,
      args: ["-p", tsconfigPath, "--pretty", "false"],
      cwd: repoRoot,
    })
  ).pipe(Effect.ensuring(fs.remove(smokeDir, { recursive: true }).pipe(Effect.ignore)));

  if (result.exitCode === 0) {
    yield* Console.error("[check:tsgo:smoke] expected tsgo to fail on effectFnOpportunity but it exited successfully");
    if (Str.isNonEmpty(result.output)) {
      yield* Console.error(result.output);
    }
    return yield* QualityScriptCommandError.make({
      message: "tsgo smoke check unexpectedly passed.",
      exitCode: 1,
    });
  }

  if (!Str.includes("effect(effectFnOpportunity)")(result.output)) {
    yield* Console.error(
      "[check:tsgo:smoke] tsgo failed, but did not report the expected effectFnOpportunity diagnostic"
    );
    if (Str.isNonEmpty(result.output)) {
      yield* Console.error(result.output);
    }
    return yield* QualityScriptCommandError.make({
      message: "tsgo smoke check did not report effectFnOpportunity.",
      exitCode: 1,
    });
  }

  yield* Console.log("[check:tsgo:smoke] verified tsgo CLI reports effectFnOpportunity under the repo base config");
});

/**
 * Verify tracked fileoverview comments do not use the legacy `@module` tag.
 *
 * @returns Effect that performs the module-tag lint.
 * @example
 * ```ts
 * import { runJSDocModuleTagsCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runJSDocModuleTagsCheck()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocModuleTagsCheck = Effect.fn("QualityScriptCommands.runJSDocModuleTagsCheck")(
  function* (): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repoRoot = yield* findRepoRoot().pipe(
      QualityScriptCommandError.mapError("Failed to locate repository root.")
    );
    const result = yield* collectOutput(
      QualityTaskStep.make({
        label: "lint:jsdoc-module-tags:git-ls-files",
        command: "git",
        args: ["ls-files"],
        cwd: repoRoot,
      })
    );

    if (result.exitCode !== 0) {
      yield* Console.error("[check:jsdoc-module-tags] failed to list tracked files with git ls-files");
      if (Str.isNonEmpty(result.output)) {
        yield* Console.error(result.output);
      }
      return yield* withExitCode("lint:jsdoc-module-tags", "git", ["ls-files"], result.exitCode);
    }

    const isScannedPath = (filePath: string): boolean =>
      A.some(moduleTagScannedRoots, (root) => filePath === root || Str.startsWith(`${root}/`)(filePath)) &&
      A.contains(moduleTagScannedExtensions as ReadonlyArray<string>, path.extname(filePath));
    const violations = yield* Effect.forEach(
      pipe(Str.split(result.output, "\n"), A.filter(Str.isNonEmpty), A.filter(isScannedPath)),
      Effect.fn(function* (filePath) {
        const absolutePath = path.join(repoRoot, filePath);
        const exists = yield* fs.exists(absolutePath).pipe(Effect.orElseSucceed(thunkFalse));
        if (!exists) {
          return A.empty<string>();
        }

        const text = yield* fs
          .readFileString(absolutePath)
          .pipe(QualityScriptCommandError.mapError(`Failed to read ${absolutePath}.`));
        return pipe(
          Str.split(text, "\n"),
          A.flatMap((line, index) =>
            /^\s*\* @module\b.*$/u.test(line)
              ? A.of(`${filePath}:${index + 1}: replace @module with @packageDocumentation`)
              : A.empty<string>()
          )
        );
      }),
      { concurrency: 8 }
    ).pipe(Effect.map(A.flatten));

    if (A.isReadonlyArrayNonEmpty(violations)) {
      yield* Console.error("[check:jsdoc-module-tags] @module is not valid under the repo TSDoc policy.");
      yield* Console.error("[check:jsdoc-module-tags] Use @packageDocumentation for fileoverview JSDoc blocks.");
      yield* Console.error(A.join(violations, "\n"));
      return yield* QualityScriptCommandError.make({
        message: "JSDoc module tag violations were found.",
        exitCode: 1,
      });
    }

    yield* Console.log("[check:jsdoc-module-tags] verified tracked fileoverview comments do not use @module");
  }
);

/**
 * Run the JSDoc inventory generator now owned by repo-cli.
 *
 * @returns Effect that writes the tracked inventory artifacts.
 * @example
 * ```ts
 * import { runJSDocInventory } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runJSDocInventory()
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocInventory = Effect.fn("QualityScriptCommands.runJSDocInventory")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));

  const result = yield* writeJSDocDocumentationInventory({ rootDir: repoRoot }).pipe(
    QualityScriptCommandError.mapError("Failed to generate JSDoc documentation inventory.", {
      command: "bun run beep quality jsdoc-inventory",
      exitCode: 1,
    })
  );

  yield* Console.log(`wrote ${repoRelative(result.outputJsonPath, repoRoot, path)}`);
  yield* Console.log(`wrote ${repoRelative(result.outputMarkdownPath, repoRoot, path)}`);
  yield* Console.log(
    `packages=${result.totals.packages} openPackages=${result.totals.packagesNeedingRemediation} openExports=${result.totals.openExports} openModules=${result.totals.openModules} rootPolicyOpen=${result.totals.rootPolicyOpen}`
  );
});

/**
 * Run the repo-wide JSDoc quality gate.
 *
 * @example
 * ```ts
 * import { runJSDocQuality } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const program = runJSDocQuality()
 * console.log(program)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocQuality = Effect.fn("QualityScriptCommands.runJSDocQuality")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));

  yield* runBun(repoRoot, "quality:jsdoc-quality", [
    "beep",
    "--",
    "docgen",
    "quality",
    "--all",
    "--check",
    "--packet-limit",
    "0",
  ]);
});

const runQualityProgram = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<void, E, R> =>
  effect.pipe(Effect.asVoid);

const variadicStrings: (values: ReadonlyArray<unknown>) => ReadonlyArray<string> = A.filter(P.isString);

const renderQualityProfileConfigLines = (config: QualityProfileConfig): ReadonlyArray<string> => [
  `profile=${config.profile}`,
  `turbo_concurrency=${config.turboConcurrency}`,
  `docgen_parallel=${config.docgenParallel}`,
  `full_proof_slots=${config.fullProofSlots}`,
  `review_fix_slots=${config.reviewFixSlots}`,
  ...A.map(config.notes, (note) => `note=${note}`),
];

const printQualityProfileConfig = (
  config: QualityProfileConfig,
  json: boolean
): Effect.Effect<void, QualityScriptCommandError> =>
  json
    ? jsonStringifyPretty(config).pipe(
        QualityScriptCommandError.mapError("Failed to encode quality profile config."),
        Effect.flatMap(Console.log)
      )
    : printLines(renderQualityProfileConfigLines(config));

const printQualityProfileDetection = (
  detection: QualityProfileDetection,
  json: boolean
): Effect.Effect<void, QualityScriptCommandError> =>
  json
    ? jsonStringifyPretty(detection).pipe(
        QualityScriptCommandError.mapError("Failed to encode quality profile detection."),
        Effect.flatMap(Console.log)
      )
    : printLines([
        `profile=${detection.profile}`,
        `cpu_count=${detection.cpuCount}`,
        `memory_gib=${detection.memoryGiB}`,
        ...renderQualityProfileConfigLines(detection.config),
      ]);

const githubChecksCommand = Command.make(
  "github-checks",
  {
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for affected review-fix checks")
    ),
    head: Flag.string("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head git ref for affected checks")),
    mode: Argument.choice("mode", GITHUB_CHECK_MODE_VALUES).pipe(Argument.withDescription("GitHub check mode to run")),
  },
  ({ base, head, mode }) => runQualityProgram(runGithubChecks(mode, { base, head }))
).pipe(Command.withDescription("Run repository GitHub verification lanes"));

const githubChecksPlanContractCheckCommand = Command.make(
  "plan-contract-check",
  {
    expectPromotedFallowLanes: Flag.boolean("expect-promoted-fallow-lanes").pipe(
      Flag.withDescription("Assert that every matrix-promoted Fallow lane is wired into the selected GitHub check mode")
    ),
    featureMatrix: Flag.string("feature-matrix").pipe(
      Flag.withDefault("goals/fallow-quality-enforcement/research/feature-matrix.jsonc"),
      Flag.withDescription("Fallow feature matrix JSONC path")
    ),
    mode: Flag.choiceWithValue("mode", githubCheckModeFlagChoices).pipe(
      Flag.withDefault("pre-push"),
      Flag.withDescription("GitHub check mode whose static lane plan should be inspected")
    ),
  },
  ({ expectPromotedFallowLanes, featureMatrix, mode }) =>
    runQualityProgram(runGithubChecksPlanContractCheck(mode, featureMatrix, expectPromotedFallowLanes))
).pipe(Command.withDescription("Validate the static GitHub check lane plan against packet promotion metadata"));

const githubChecksCommandWithSubcommands = githubChecksCommand.pipe(
  Command.withSubcommands([githubChecksPlanContractCheckCommand])
);

const devQualityCommand = Command.make(
  "dev",
  {
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for the local development quality range")
    ),
    head: Flag.string("head").pipe(
      Flag.withDefault("HEAD"),
      Flag.withDescription("Head git ref for the local development quality range")
    ),
    surface: Flag.boolean("surface").pipe(
      Flag.withDescription("Also run affected docgen and repo-export checks for public surface edits")
    ),
  },
  ({ base, head, surface }) =>
    runQualityProgram(
      findRepoRoot().pipe(
        QualityScriptCommandError.mapError("Failed to locate repository root."),
        Effect.flatMap((repoRoot) => runDevQuality(repoRoot, { base, head, surface }))
      )
    )
).pipe(Command.withDescription("Run balanced affected local development quality checks"));

const bunAuditCommand = Command.make("bun-audit", {}, () =>
  runQualityProgram(
    findRepoRoot().pipe(
      QualityScriptCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap(runBunAudit)
    )
  )
).pipe(Command.withDescription("Run Bun audit with OSV ignore config"));

const dtslintTsgoCommand = Command.make(
  "dtslint-tsgo",
  {
    args: Argument.string("args").pipe(Argument.variadic),
  },
  ({ args }) => runQualityProgram(runDtslintTsgoChecks(args as ReadonlyArray<string>))
).pipe(Command.withDescription("Run tsgo diagnostics for dtslint files"));

const testTsgoCommand = Command.make(
  "test-tsgo",
  {
    args: Argument.string("args").pipe(Argument.variadic),
  },
  ({ args }) => runQualityProgram(runTestTsgoChecks(args as ReadonlyArray<string>))
).pipe(Command.withDescription("Run Effect tsgo diagnostics for test files"));

const tsgoSmokeCommand = Command.make("tsgo-smoke", {}, () => runQualityProgram(runTsgoSmokeCheck())).pipe(
  Command.withDescription("Smoke test the repo tsgo Effect diagnostics")
);

const tsgoRulesCommand = Command.make("tsgo-rules", {}, () => runQualityProgram(runTsgoRulesCheck())).pipe(
  Command.withDescription("Check root @effect/tsgo diagnostic severities")
);

const jsdocModuleTagsCommand = Command.make("jsdoc-module-tags", {}, () =>
  runQualityProgram(runJSDocModuleTagsCheck())
).pipe(Command.withDescription("Check for forbidden @module fileoverview tags"));

const jsdocInventoryCommand = Command.make("jsdoc-inventory", {}, () => runQualityProgram(runJSDocInventory())).pipe(
  Command.withDescription("Generate the tracked JSDoc documentation inventory")
);

const jsdocQualityCommand = Command.make("jsdoc-quality", {}, () => runQualityProgram(runJSDocQuality())).pipe(
  Command.withDescription("Fail when repo-wide JSDoc quality reports warnings or failures")
);

const jsdocRatchetCommand = Command.make(
  "jsdoc-ratchet",
  {
    baseline: Flag.string("baseline").pipe(
      Flag.withDefault(defaultJSDocTotalsBaselinePath),
      Flag.withDescription("Committed JSDoc totals regression baseline JSONC path")
    ),
    inventory: Flag.string("inventory").pipe(
      Flag.withDefault(defaultJSDocInventoryPath),
      Flag.withDescription("Generated JSDoc documentation inventory JSONC path")
    ),
    writeBaseline: Flag.boolean("write-baseline").pipe(
      Flag.withDescription("Rewrite the JSDoc totals regression baseline from the generated inventory")
    ),
  },
  ({ baseline, inventory, writeBaseline }) =>
    runQualityProgram(
      runJSDocRatchet({
        baselinePath: baseline,
        inventoryPath: inventory,
        writeBaseline,
      })
    )
).pipe(Command.withDescription("Run JSDoc inventory totals as a fail-on-growth regression-baseline gate"));

const knipCommand = Command.make(
  "knip",
  {
    baseline: Flag.string("baseline").pipe(
      Flag.withDefault(defaultKnipBaselinePath),
      Flag.withDescription("Committed Knip regression baseline JSONC path")
    ),
    writeBaseline: Flag.boolean("write-baseline").pipe(
      Flag.withDescription("Rewrite the Knip regression baseline from the current normalized finding set")
    ),
  },
  ({ baseline, writeBaseline }) =>
    runQualityProgram(
      runKnipRatchet({
        baselinePath: baseline,
        writeBaseline,
      })
    )
).pipe(Command.withDescription("Run Knip as a fail-on-growth regression-baseline gate"));

const turboConfigProofCommand = Command.make(
  "turbo-config-proof",
  {
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for Turbo affected query proof")
    ),
    head: Flag.string("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head git ref for proof")),
    selector: Flag.choiceWithValue("selector", [
      ["affected", "affected"],
      ["filter-range", "filter-range"],
    ]).pipe(
      Flag.withDefault("affected"),
      Flag.withDescription("Dry-run selector: affected for CI shape, filter-range for deterministic base/head probes")
    ),
    json: Flag.boolean("json").pipe(Flag.withDescription("Print the proof report as JSON")),
    taskArgs: Argument.string("task").pipe(
      Argument.variadic,
      Argument.withDescription("Optional Turbo tasks to prove; defaults to lint check test type-test docgen")
    ),
  },
  ({ base, head, json, selector, taskArgs }) =>
    runQualityProgram(
      findRepoRoot().pipe(
        QualityScriptCommandError.mapError("Failed to locate repository root."),
        Effect.flatMap((repoRoot) =>
          runTurboConfigProof(repoRoot, {
            base,
            head,
            selector,
            tasks: variadicStrings(taskArgs),
          }).pipe(
            Effect.mapError((error) =>
              QualityScriptCommandError.new(error, error.message, {
                command: "bun run beep quality turbo-config-proof",
                exitCode: 1,
              })
            )
          )
        ),
        Effect.flatMap((report) =>
          (json ? renderTurboConfigProofReportJson(report) : Effect.succeed(renderTurboConfigProofReport(report))).pipe(
            Effect.mapError((error) =>
              QualityScriptCommandError.new(error, error.message, {
                command: "bun run beep quality turbo-config-proof",
                exitCode: 1,
              })
            ),
            Effect.flatMap(Console.log)
          )
        )
      )
    )
).pipe(Command.withDescription("Summarize Turbo affected and dry-run task-input blast radius"));

const packageVerifyCommand = Command.make(
  "package-verify",
  {
    packageArgs: Argument.string("package").pipe(
      Argument.variadic,
      Argument.withDescription("Optional workspace package name to verify")
    ),
    quick: Flag.boolean("quick").pipe(Flag.withDescription("Run lint and check only")),
  },
  ({ packageArgs, quick }) =>
    runQualityProgram(runPackageVerifyCli({ packageArgs: variadicStrings(packageArgs), quick }))
).pipe(Command.withDescription("Run package-local lint/check/test verification"));

const changesetGraphCommand = Command.make("changeset-graph", {}, () =>
  runQualityProgram(
    findRepoRoot().pipe(
      QualityScriptCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap((repoRoot) =>
        runChangesetGraphCheck(repoRoot).pipe(
          Effect.mapError((error) =>
            QualityScriptCommandError.new(error, error.message, {
              command: "bun run beep quality changeset-graph",
              exitCode: 1,
            })
          )
        )
      )
    )
  )
).pipe(Command.withDescription("Validate changesets against the current workspace package graph"));

const qualityProfileDetectCommand = Command.make(
  "detect",
  {
    json: Flag.boolean("json").pipe(Flag.withDescription("Print the detected profile as JSON")),
  },
  ({ json }) => runQualityProgram(printQualityProfileDetection(detectQualityProfile(), json))
).pipe(Command.withDescription("Detect the local quality hardware profile"));

const qualityProfileConfigCommand = Command.make(
  "config",
  {
    json: Flag.boolean("json").pipe(Flag.withDescription("Print the profile config as JSON")),
    profile: Argument.choice("profile", QUALITY_PROFILE_NAMES).pipe(
      Argument.withDescription("Quality hardware profile to inspect")
    ),
  },
  ({ json, profile }) => runQualityProgram(printQualityProfileConfig(qualityProfileConfigForTesting(profile), json))
).pipe(Command.withDescription("Print quality scheduling settings for a hardware profile"));

const qualityProfileCommand = Command.make("profile", {}, () =>
  printLines([
    "Quality profile commands:",
    "- bun run beep quality profile detect",
    "- bun run beep quality profile config current",
    "- bun run beep quality profile config workstation",
    "- bun run beep quality profile config ci",
  ])
).pipe(
  Command.withDescription("Inspect quality scheduling hardware profiles"),
  Command.withSubcommands([qualityProfileDetectCommand, qualityProfileConfigCommand])
);

/**
 * Quality command group for repo operational checks.
 *
 * @example
 * ```ts
 * console.log("qualityCommand")
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const qualityCommand = Command.make("quality", {}, () =>
  printLines([
    "Quality commands:",
    "- bun run beep quality dev",
    "- bun run beep quality dev --surface",
    "- bun run beep quality github-checks quality",
    "- bun run beep quality github-checks repo-sanity",
    "- bun run beep quality github-checks plan-contract-check --mode pre-push --expect-promoted-fallow-lanes",
    "- bun run coverage",
    "- bun run coverage:baseline:write",
    "- bun run beep quality bun-audit",
    "- bun run beep quality dtslint-tsgo",
    "- bun run beep quality test-tsgo",
    "- bun run beep quality tsgo-smoke",
    "- bun run beep quality tsgo-rules",
    "- bun run beep quality jsdoc-module-tags",
    "- bun run beep quality jsdoc-inventory",
    "- bun run beep quality jsdoc-quality",
    "- bun run beep quality jsdoc-ratchet",
    "- bun run beep quality jsdoc-ratchet --write-baseline",
    "- bun run beep quality knip",
    "- bun run beep quality knip --write-baseline",
    "- bun run beep quality turbo-config-proof --base origin/main --head HEAD",
    "- bun run beep quality profile detect",
    "- bun run beep quality package-verify @beep/repo-cli",
    "- bun run beep quality changeset-graph",
    "- bun run beep quality fallow audit --advisory",
  ])
).pipe(
  Command.withDescription("Repository operational quality commands"),
  Command.withSubcommands([
    devQualityCommand,
    githubChecksCommandWithSubcommands,
    bunAuditCommand,
    dtslintTsgoCommand,
    testTsgoCommand,
    tsgoSmokeCommand,
    tsgoRulesCommand,
    jsdocModuleTagsCommand,
    jsdocInventoryCommand,
    jsdocQualityCommand,
    jsdocRatchetCommand,
    knipCommand,
    turboConfigProofCommand,
    qualityProfileCommand,
    packageVerifyCommand,
    changesetGraphCommand,
    qualityFallowCommand,
  ])
);
