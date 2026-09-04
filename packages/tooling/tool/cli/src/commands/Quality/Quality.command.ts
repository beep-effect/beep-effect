/**
 * Repo operational quality commands migrated from root scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, jsonStringifyPretty } from "@beep/repo-utils";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A, Str, thunkFalse } from "@beep/utils";
import * as OptionUtils from "@beep/utils/Option";
import {
  Clock,
  Console,
  DateTime,
  Effect,
  Equal,
  FileSystem,
  flow,
  Inspectable,
  Layer,
  Order,
  Path,
  pipe,
} from "effect";
import { dual } from "effect/Function";
import * as HM from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";
import { XMLParser } from "fast-xml-parser";
import { parse } from "jsonc-parser";
import { configStringOption } from "../../internal/cli/EnvConfig.ts";
import { isLabsWorkspacePath } from "../../internal/cli/Labs/index.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { unknownRecordKeys, unknownRecordProperty } from "../../internal/cli/UnknownProbe.ts";
import { formatCommandLine, QualityTaskStep, runCaptured, runToExit } from "../../internal/process/index.ts";
import {
  AdmissionConfig,
  admissionProtocolStatus,
  admissionStatus,
  GITHUB_CHECK_MODE_VALUES,
  reapAdmissionState,
  reconcileAttemptJournalsForCheckout,
  runTmpfsReap,
  setAdmissionEvictionProtocol,
  TmpfsReapReport,
} from "../../internal/repo-run/index.ts";
import { WaveOrder } from "../Yeet/internal/WaveOrder.ts";
import { runChangesetGraphCheck } from "./ChangesetGraph.ts";
import { changesetStatusCommand } from "./ChangesetStatus.ts";
import { qualityFallowCommand } from "./FallowQuality.command.ts";
import {
  githubCheckChangesetStatusLane,
  githubCheckCheapGateLanes,
  githubCheckFallowLanes,
  githubCheckLanePlan,
  githubCheckLanesForModeForTesting as githubCheckLanesForModeForTestingImpl,
  githubCheckPrePushExternalLanes,
  githubCheckPrePushExternalLanesForTesting as githubCheckPrePushExternalLanesForTestingImpl,
  githubCheckPromotedFallowLaneDiagnosticsForTesting as githubCheckPromotedFallowLaneDiagnosticsForTestingImpl,
  githubCheckQualityLanes,
  githubCheckQualityLanesForTesting as githubCheckQualityLanesForTestingImpl,
  githubCheckRepoSanityLanes,
  githubCheckRepoSanityLanesForTesting as githubCheckRepoSanityLanesForTestingImpl,
  promotedFallowGithubCheckLaneIdsForTesting as promotedFallowGithubCheckLaneIdsForTestingImpl,
} from "./internal/GithubChecks.ts";
import {
  JSDocDocumentationInventoryOptions,
  writeJSDocDocumentationInventory,
} from "./internal/JSDocDocumentationInventory.ts";
import {
  RunJSDocMigrateApplyOptions,
  RunJSDocMigrateVerifyOptions,
  runJSDocMigrateApply,
  runJSDocMigrateVerify,
} from "./internal/JSDocMigrateApply.ts";
import { RunJSDocMigrateExtractOptions, runJSDocMigrateExtract } from "./internal/JSDocMigrateExtract.ts";
import { RunJSDocMigrateTitlesOptions, runJSDocMigrateTitles } from "./internal/JSDocMigrateTitles.ts";
import { defaultJSDocInventoryPath, defaultJSDocTotalsBaselinePath, runJSDocRatchet } from "./internal/JSDocRatchet.ts";
import { defaultKnipBaselinePath, runKnipRatchet } from "./internal/KnipRatchet.ts";
import { runPackageVerifyCli } from "./internal/PackageVerify.ts";
import { repoRelative } from "./internal/QualityArtifactSupport.ts";
import { testTsgoSyntheticConfigTemplate } from "./internal/TestTsgoSyntheticConfig.ts";
import {
  renderTurboConfigProofReport,
  renderTurboConfigProofReportJson,
  runTurboConfigProof,
} from "./internal/TurboConfigProof.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import {
  activeOsvIgnoreIdsForTesting as activeOsvIgnoreIdsForTestingImpl,
  selectOsvIgnoreIdsForAudit,
} from "./Quality.osv-ignore.ts";
import {
  detectQualityProfile,
  detectQualityProfileForTesting as detectQualityProfileForTestingImpl,
  qualityProfileConfigForTesting as qualityProfileConfigForTestingImpl,
} from "./Quality.plan.ts";
import { printQualityProfileConfig, printQualityProfileDetection } from "./Quality.render.ts";
import {
  decodeGithubChecksFallowFeatureMatrix,
  GithubCheckFailurePolicy,
  GithubCheckMode,
  githubCheckModeFlagChoices,
  QualityHardwareProfile,
} from "./Quality.schemas.ts";
import { runQualityTaskGithubCheckLaneWaves, runQualityTaskStreamingStepGroup } from "./Tasks.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { ParseError } from "jsonc-parser";
import type { AdmissionSnapshot } from "../../internal/repo-run/index.ts";
import type {
  GithubCheckFailurePolicy as GithubCheckFailurePolicyType,
  GithubCheckLaneSpec,
  GithubChecksFallowFeatureMatrix,
  QualityProfileDetectionInput as QualityProfileDetectionInputType,
} from "./Quality.schemas.ts";
import type { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Tasks.ts";

/**
 * Public quality script command error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { QualityScriptCommandError } from "./Quality.errors.ts";
/**
 * Public Quality schemas retained at the legacy command-module specifier.
 *
 * @category models
 * @since 0.0.0
 */
export {
  GithubCheckLaneSpec,
  GithubCheckLaneStage,
  GithubCheckMode,
  GithubChecksFallowFeatureMatrix,
  QualityHardwareProfile,
  QualityProfileConfig,
  QualityProfileDetection,
} from "./Quality.schemas.ts";
/**
 * Synthetic tsgo test config fields shared by package workers.
 *
 * @category configuration
 * @since 0.0.0
 */
export { testTsgoSyntheticConfigTemplate };
/**
 * Host facts used when selecting a quality profile.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import type { QualityProfileDetectionInput } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const example: QualityProfileDetectionInput | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QualityProfileDetectionInput = QualityProfileDetectionInputType;

/**
 * Return the static GitHub check collector lanes for a mode.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { githubCheckLanesForModeForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof githubCheckLanesForModeForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const githubCheckLanesForModeForTesting = githubCheckLanesForModeForTestingImpl;

/**
 * Build the external pre-push diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { githubCheckPrePushExternalLanesForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof githubCheckPrePushExternalLanesForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPrePushExternalLanesForTesting = githubCheckPrePushExternalLanesForTestingImpl;

/**
 * Compare promoted Fallow matrix rows against static GitHub check lanes.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { githubCheckPromotedFallowLaneDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof githubCheckPromotedFallowLaneDiagnosticsForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const githubCheckPromotedFallowLaneDiagnosticsForTesting =
  githubCheckPromotedFallowLaneDiagnosticsForTestingImpl;

/**
 * Build the repo-quality diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { githubCheckQualityLanesForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof githubCheckQualityLanesForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const githubCheckQualityLanesForTesting = githubCheckQualityLanesForTestingImpl;

/**
 * Build the repo-sanity diagnostic lanes used by GitHub check collectors.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { githubCheckRepoSanityLanesForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof githubCheckRepoSanityLanesForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const githubCheckRepoSanityLanesForTesting = githubCheckRepoSanityLanesForTestingImpl;

/**
 * Derive GitHub check lane ids required by promoted Fallow matrix rows.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { promotedFallowGithubCheckLaneIdsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof promotedFallowGithubCheckLaneIdsForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const promotedFallowGithubCheckLaneIdsForTesting = promotedFallowGithubCheckLaneIdsForTestingImpl;

/**
 * Detect the quality hardware profile from host facts.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { detectQualityProfileForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof detectQualityProfileForTesting !== "undefined") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const detectQualityProfileForTesting = detectQualityProfileForTestingImpl;

/**
 * Return static quality scheduling settings for a hardware profile.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { qualityProfileConfigForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof qualityProfileConfigForTesting !== "undefined") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const qualityProfileConfigForTesting = qualityProfileConfigForTestingImpl;

/**
 * Select OSV advisory ids that may still be suppressed at a given time.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { activeOsvIgnoreIdsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof activeOsvIgnoreIdsForTesting !== "undefined") // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const activeOsvIgnoreIdsForTesting = activeOsvIgnoreIdsForTestingImpl;

const $I = $RepoCliId.create("commands/Quality/ScriptCommands");
const { githubCheckLaneWaves, githubCheckOrderedLaneWaves } = githubCheckLanePlan;

const ignoredTestDirectoryNames = ["node_modules", "dist", "coverage", "tmp"] as const;
// infra/lambda/**: self-contained esbuild-bundled Lambda packages typecheck
// their own tests via tsc in build.sh; they are not workspace test surface.
const ignoredTestPathSegments = ["/test/fixtures/", "/infra/lambda/"] as const;
// No `tooling` root: tooling workspaces live under `packages/tooling/*`, which
// the `packages` root already walks. A top-level `tooling/` directory has never
// existed in this repo, so the entry only cost a wasted existence probe.
const testSearchRoots = ["apps", "packages", "infra"] as const;
const moduleTagScannedRoots = [".patterns", "apps", "packages", "tooling"] as const;
const moduleTagScannedExtensions = [".hbs", ".md", ".ts", ".tsx"] as const;
const effectDiagnosticsDirectiveScannedRoots = ["apps", "packages", "tooling", "infra"] as const;
const effectDiagnosticsDirectiveScannedExtensions = [".cts", ".mts", ".ts", ".tsx"] as const;
const effectDiagnosticsDirectiveIgnoredDirectoryNames = ["node_modules", "dist", "coverage", "tmp"] as const;
const tsgoProfileScannedRoots = ["apps", "packages", "infra", "scratchpad"] as const;
const effectTsgoDiagnosticsTableStartMarker = "<!-- diagnostics-table:start -->";
const effectTsgoDiagnosticsTableEndMarker = "<!-- diagnostics-table:end -->";
const effectDiagnosticsDirectivePrefix = "@effect-diagnostics";
const effectDiagnosticsDirectivePattern = new RegExp(
  `^\\s*(?:/\\*\\*?|//)\\s*${effectDiagnosticsDirectivePrefix}(?:-next-line)?\\b`,
  "u"
);
const effectTsgoDiagnosticPattern = /\b(?:error|warning) TS\d+: .* effect\([^)]+\)/u;
const EcosystemEffectDiagnosticOffRule = LiteralKit(["missedPipeableOpportunity"]);
const isEcosystemEffectDiagnosticOffRule = S.is(EcosystemEffectDiagnosticOffRule);
const TsconfigFileName = S.String.check(S.isPattern(/^tsconfig(?:\..+)?\.json$/u));
const isTsconfigFileName = S.is(TsconfigFileName);
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));
const decodeStringArrayOption = S.decodeUnknownOption(S.Array(S.String));
const decodeAliasPathsOption = S.decodeUnknownOption(S.Record(S.String, S.Array(S.String)));
const effectTsgoReadmeParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

/**
 * Detect an active Effect diagnostics directive comment.
 *
 * **Example** (Recognize a file suppression)
 *
 * ```ts
 * import { isEffectDiagnosticsDirectiveForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * isEffectDiagnosticsDirectiveForTesting("// @effect-diagnostics strictEffectProvide:skip-file") // true
 * ```
 *
 * @param line - Source line to test for a diagnostics directive comment.
 * @returns Whether the line is an active Effect diagnostics directive.
 * @category testing
 * @since 0.0.0
 */
export const isEffectDiagnosticsDirectiveForTesting = (line: string): boolean =>
  effectDiagnosticsDirectivePattern.test(line);

class EffectTsgoRuleCell extends S.Class<EffectTsgoRuleCell>($I`EffectTsgoRuleCell`)(
  {
    code: S.String,
  },
  $I.annote("EffectTsgoRuleCell", {
    description: "Parsed diagnostics table cell containing an Effect tsgo rule code.",
  })
) {}

class EffectTsgoLinkedRuleCell extends S.Class<EffectTsgoLinkedRuleCell>($I`EffectTsgoLinkedRuleCell`)(
  {
    a: EffectTsgoRuleCell,
  },
  $I.annote("EffectTsgoLinkedRuleCell", {
    description: "Diagnostics table cell whose rule code is wrapped in a link to that rule's doc page.",
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
const decodeEffectTsgoLinkedRuleCellOption = S.decodeUnknownOption(EffectTsgoLinkedRuleCell);
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
  readonly failurePolicy?: GithubCheckFailurePolicyType;
};
type TsgoDiagnosticOutput = {
  readonly output: string;
};

const TestTsgoPackageResultVersion = LiteralKit(["test-tsgo-package-result/v1"]);

class TestTsgoPackageManifest extends S.Class<TestTsgoPackageManifest>($I`TestTsgoPackageManifest`)(
  {
    name: S.String,
    scripts: S.optionalKey(S.Record(S.String, S.String)),
  },
  $I.annote("TestTsgoPackageManifest", {
    description: "Package identity needed to address one package-owned Turbo task.",
  })
) {}

class TestTsgoPackageResultArtifact extends S.Class<TestTsgoPackageResultArtifact>($I`TestTsgoPackageResultArtifact`)(
  {
    schemaVersion: TestTsgoPackageResultVersion,
    packageName: S.String,
    output: S.String,
    exitCode: NonNegativeInt,
  },
  $I.annote("TestTsgoPackageResultArtifact", {
    description: "One package worker result consumed by the repo-wide tsgo test renderer.",
  })
) {}

class TestTsgoTurboTaskSummary extends S.Class<TestTsgoTurboTaskSummary>($I`TestTsgoTurboTaskSummary`)(
  {
    taskId: S.String,
    hash: S.String,
  },
  $I.annote("TestTsgoTurboTaskSummary", {
    description: "Task identity and hash recorded by the tsgo tests Turbo run.",
  })
) {}

class TestTsgoTurboRunSummary extends S.Class<TestTsgoTurboRunSummary>($I`TestTsgoTurboRunSummary`)(
  { tasks: S.Array(TestTsgoTurboTaskSummary) },
  $I.annote("TestTsgoTurboRunSummary", {
    description: "Turbo run-summary fields consumed by the tsgo tests aggregate lane.",
  })
) {}

const decodeTestTsgoPackageManifest = S.decodeUnknownEffect(S.fromJsonString(TestTsgoPackageManifest));
const decodeTestTsgoPackageResultArtifact = S.decodeUnknownEffect(S.fromJsonString(TestTsgoPackageResultArtifact));
const decodeTestTsgoTurboRunSummary = S.decodeUnknownEffect(S.fromJsonString(TestTsgoTurboRunSummary));

const testTsgoPackageTaskName = "package-test-typecheck";
const testTsgoPackageTaskScript = "beep-cli quality test-tsgo-package";
const testTsgoPackageResultRelativePath = ".turbo/package-test-typecheck-result.json";

const commandText = formatCommandLine;

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

const qualityFileContext = Effect.fn("QualityScriptCommands.qualityFileContext")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));

  return { fs, path, repoRoot };
});

const runStep = Effect.fn("QualityScriptCommands.runStep")(function* (
  step: QualityTaskStep
): Effect.fn.Return<void, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  yield* Console.log(`[beep-cli] ${step.label}: ${commandText(step.command, step.args)}`);
  const exitCode = yield* runToExit({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: step.env,
    extendEnv: true,
    stdin: "inherit",
    stdio: "inherit",
  }).pipe(
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

const runGithubCheckLaneGroup = (
  label: string,
  lanes: ReadonlyArray<GithubCheckLaneSpec>,
  failurePolicy: GithubCheckFailurePolicyType
): Effect.Effect<void, QualityTaskConfigurationError | QualityTaskGroupFailed, QualityScriptEnvironment> =>
  runQualityTaskGithubCheckLaneWaves(label, githubCheckLaneWaves(lanes), failurePolicy);

const runEvidenceOrderedGithubCheckLaneGroup = Effect.fn(
  "QualityScriptCommands.runEvidenceOrderedGithubCheckLaneGroup"
)(function* (
  label: string,
  lanes: ReadonlyArray<GithubCheckLaneSpec>,
  failurePolicy: GithubCheckFailurePolicyType
): Effect.fn.Return<
  void,
  QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment | WaveOrder
> {
  const waveOrder = yield* WaveOrder;
  yield* runQualityTaskGithubCheckLaneWaves(label, githubCheckOrderedLaneWaves(waveOrder.order(lanes)), failurePolicy);
});

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
  const result = yield* runCaptured({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: step.env,
    extendEnv: true,
    source: "all",
    trim: true,
  }).pipe(
    QualityScriptCommandError.mapError(`Failed to collect output from ${commandText(step.command, step.args)}.`, {
      command: commandText(step.command, step.args),
    })
  );

  return {
    output: result.output,
    exitCode: result.exitCode,
  };
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

const isTruthyMainPush = Effect.fn("QualityScriptCommands.isTruthyMainPush")(function* () {
  const eventName = yield* configStringOption("GITHUB_EVENT_NAME");
  const refName = yield* configStringOption("GITHUB_REF_NAME");

  return O.contains(eventName, "push") && O.contains(refName, "main");
});

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
  if (yield* isTruthyMainPush()) {
    yield* Console.log("[github-checks] quality: skipped changeset status on main push");
    return A.empty<GithubCheckLaneSpec>();
  }

  const branch = yield* currentBranch(repoRoot);
  if (branch === "main") {
    yield* Console.log("[github-checks] quality: skipped changeset status on main");
    return A.empty<GithubCheckLaneSpec>();
  }

  return [githubCheckChangesetStatusLane(repoRoot)];
});

// `[[IgnoredVulns]]` table header delimiting one OSV ignore entry in
// osv-scanner.toml. Splitting the config on this header yields one chunk per
// ignore block (plus a leading comment/preamble chunk).
/**
 * Run Bun's high-severity package audit with OSV ignores mirrored from config.
 *
 * Only ignores whose `ignoreUntil` is still in the future are forwarded to
 * `bun audit --ignore`; expired or malformed-expiry entries are dropped so the
 * audit re-flags the advisory instead of silently suppressing it past expiry.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runBunAudit } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runBunAudit("/repo")
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @returns Effect that exits non-zero when audit fails.
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
  const selection = selectOsvIgnoreIdsForAudit(configText, now);

  if (A.isArrayNonEmpty(selection.droppedIds)) {
    yield* Console.log(
      `[github-checks] repo-sanity:bun-audit: dropping expired/malformed OSV ignore(s): ${A.join(selection.droppedIds, ", ")}`
    );
  }

  yield* runFixedStep(repoRoot, "repo-sanity:bun-audit", "bun", [
    "audit",
    "--audit-level=high",
    ...A.map(selection.activeIds, (id) => `--ignore=${id}`),
  ]);
});

const runRepoSanity = Effect.fn("QualityScriptCommands.runRepoSanity")(function* (
  repoRoot: string,
  failurePolicy: GithubCheckFailurePolicyType
): Effect.fn.Return<void, QualityTaskConfigurationError | QualityTaskGroupFailed, QualityScriptEnvironment> {
  yield* runGithubCheckLaneGroup("github-checks:repo-sanity", githubCheckRepoSanityLanes(repoRoot), failurePolicy);
});

const runQuality = Effect.fn("QualityScriptCommands.runQuality")(function* (
  repoRoot: string,
  failurePolicy: GithubCheckFailurePolicyType
): Effect.fn.Return<
  void,
  QualityScriptCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment
> {
  const changesetStatusLanes = yield* githubCheckChangesetStatusLanes(repoRoot);
  yield* runGithubCheckLaneGroup(
    "github-checks:quality",
    [...changesetStatusLanes, ...githubCheckRepoSanityLanes(repoRoot), ...githubCheckQualityLanes(repoRoot)],
    failurePolicy
  );
});

const runPrePushChecks = Effect.fn("QualityScriptCommands.runPrePushChecks")(function* (
  repoRoot: string,
  failurePolicy: GithubCheckFailurePolicyType
): Effect.fn.Return<
  void,
  QualityScriptCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment
> {
  const changesetStatusLanes = yield* githubCheckChangesetStatusLanes(repoRoot);
  yield* runEvidenceOrderedGithubCheckLaneGroup(
    "github-checks:pre-push",
    [
      ...changesetStatusLanes,
      ...githubCheckRepoSanityLanes(repoRoot),
      ...githubCheckQualityLanes(repoRoot),
      ...githubCheckFallowLanes(repoRoot),
      ...githubCheckPrePushExternalLanes(repoRoot),
    ],
    failurePolicy
  ).pipe(Effect.provide(WaveOrder.Default));
});

const runCheapGates = Effect.fn("QualityScriptCommands.runCheapGates")(function* (
  repoRoot: string
): Effect.fn.Return<
  void,
  QualityScriptCommandError | QualityTaskConfigurationError | QualityTaskGroupFailed,
  QualityScriptEnvironment
> {
  const changesetStatusLanes = yield* githubCheckChangesetStatusLanes(repoRoot);
  yield* runGithubCheckLaneGroup(
    "github-checks:cheap-gates",
    [...changesetStatusLanes, ...githubCheckCheapGateLanes(repoRoot)],
    "collect-all"
  );
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
 * **Example** (Run a quality command)
 *
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
 * console.log(labels) // example value
 * ```
 *
 * @param repoRoot - Repository root used as the subprocess working directory.
 * @param options - Git range and surface-check options for the dev quality lane.
 * @returns Planned quality task steps for the requested development profile.
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
      args: ["run", "test", "--", "--unit", ...devQualityAffectedArgs],
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
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { reviewFixDocgenLocalArgsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(reviewFixDocgenLocalArgsForTesting("origin/main", "HEAD"))
 * ```
 *
 * @param base - Git base ref for changed package discovery.
 * @param head - Git head ref for changed package discovery.
 * @returns Arguments passed to `bun run`.
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
  yield* runBunWithEnv(repoRoot, "review-fix:test", ["test", "--", "--unit", "--affected", "--summarize"], env);

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
    A.filter(P.not(Str.startsWith(".repos/"))),
    A.filter(P.not(Str.startsWith(".claude/skills/impeccable/"))),
    A.filter(P.not(Str.startsWith(".github/skills/impeccable/"))),
    A.filter(P.not(Str.startsWith("infra/ci-runners/sdks/")))
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
    // DELIBERATE fail-open: Semgrep only runs when tracked JS/TS files are present.
    // Record this path-filter constraint in the gate-integrity expectation file.
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
    // Fail the lane on findings. Without this, `semgrep scan` exits 0 even on
    // blocking findings, so every rule below is advisory-only.
    "--error",
    "--config",
    "p/typescript",
    "--config",
    "p/javascript",
    "--config",
    "p/security-audit",
    "--config",
    "p/secrets",
    // Vendored, offline first-party rules — keep CI and the local replay
    // verdict-identical without registry auth. See .semgrep/first-party.yml.
    "--config",
    "/src/.semgrep/first-party.yml",
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
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runGithubChecks } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runGithubChecks("repo-sanity")
 * ```
 *
 * @param mode - GitHub check mode to run.
 * @returns Effect that executes the requested mode.
 * @category use-cases
 * @since 0.0.0
 */
export const runGithubChecks = Effect.fn("QualityScriptCommands.runGithubChecks")(function* (
  mode: GithubCheckMode,
  options: GithubCheckRunOptions = {}
): Effect.fn.Return<void, GithubCheckError, QualityScriptEnvironment> {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const failurePolicy = options.failurePolicy ?? GithubCheckFailurePolicy.Enum["fail-fast"];

  yield* GithubCheckMode.$match(mode, {
    "cheap-gates": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runCheapGates(repoRoot))),
    quality: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runQuality(repoRoot, failurePolicy))),
    "review-fix": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runReviewFix(repoRoot, options))),
    "repo-sanity": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runRepoSanity(repoRoot, failurePolicy))),
    secrets: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runSecretScan(repoRoot))),
    security: () => runSecurityScan(repoRoot),
    sast: () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runSastScan(repoRoot))),
    nix: () => runNixChecks(repoRoot),
    "pre-push": () => pipe(ensureOriginMain(repoRoot), Effect.andThen(runPrePushChecks(repoRoot, failurePolicy))),
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

const isTestTsgoFile = (normalizedPath: string, name: string): boolean =>
  Str.includes("/test/")(normalizedPath) &&
  !pathContainsSegment(normalizedPath, ignoredTestPathSegments) &&
  /\.(?:cts|mts|ts|tsx)$/u.test(name);

const isIgnoredTestTsgoDirectory = (normalizedPath: string, name: string): boolean =>
  A.contains(ignoredTestDirectoryNames as ReadonlyArray<string>, name) ||
  pathContainsSegment(normalizedPath, ignoredTestPathSegments);

const collectTestTsgoFilesUnder = (searchRoot: string) =>
  collectFiles(searchRoot, isTestTsgoFile, isIgnoredTestTsgoDirectory);

type TestTsgoPackageGroup = {
  readonly packageName: string;
  readonly packageDir: string;
  readonly tsconfigPath: string;
  readonly files: ReadonlyArray<string>;
  readonly hasTaskScript: boolean;
};

type TestTsgoPackageResult = {
  readonly group: TestTsgoPackageGroup;
  readonly output: string;
  readonly exitCode: number;
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

const collectOwnedTestTsgoFiles = Effect.fn("QualityScriptCommands.collectOwnedTestTsgoFiles")(function* (
  repoRoot: string,
  packageDir: string
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const candidates = yield* collectTestTsgoFilesUnder(packageDir);
  const ownership = yield* Effect.forEach(
    candidates,
    Effect.fnUntraced(function* (filePath) {
      const owner = yield* findOwningPackageDir(repoRoot, filePath);
      return owner === packageDir ? O.some(filePath) : O.none<string>();
    }),
    { concurrency: 1 }
  );

  return A.getSomes(ownership);
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
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
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
      const packageManifest = yield* decodeTestTsgoPackageManifest(
        yield* fs
          .readFileString(path.join(packageDir, "package.json"))
          .pipe(QualityScriptCommandError.mapError(`Failed to read ${path.join(packageDir, "package.json")}.`))
      ).pipe(QualityScriptCommandError.mapError(`Failed to decode ${path.join(packageDir, "package.json")}.`));
      const tsconfigPath = yield* resolveTestTsconfigPath(packageDir);
      const files = pipe(
        fileEntries,
        A.filter(([entryPackageDir]) => entryPackageDir === packageDir),
        A.map(([, filePath]) => filePath),
        A.sort(Order.String)
      );
      return {
        packageName: packageManifest.name,
        packageDir,
        tsconfigPath,
        files,
        hasTaskScript: R.has(packageManifest.scripts ?? {}, testTsgoPackageTaskName),
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
    ...testTsgoSyntheticConfigTemplate,
    extends: group.tsconfigPath,
    include: group.files,
    compilerOptions: {
      ...testTsgoSyntheticConfigTemplate.compilerOptions,
      rootDir: repoRoot,
      tsBuildInfoFile: path.join(tempDir, `${groupLabel}.tsbuildinfo`),
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
  };
});

const testTsgoPackageResultPath = (path: Path.Path, packageDir: string): string =>
  path.join(packageDir, testTsgoPackageResultRelativePath);

const writeTestTsgoPackageResult = Effect.fn("QualityScriptCommands.writeTestTsgoPackageResult")(function* (
  result: TestTsgoPackageResult
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resultPath = testTsgoPackageResultPath(path, result.group.packageDir);
  const artifact = TestTsgoPackageResultArtifact.make({
    schemaVersion: "test-tsgo-package-result/v1",
    packageName: result.group.packageName,
    output: result.output,
    exitCode: NonNegativeInt.make(result.exitCode),
  });
  const artifactText = yield* jsonStringifyPretty(artifact).pipe(
    QualityScriptCommandError.mapError(`Failed to encode ${result.group.packageName} test tsgo result.`)
  );

  yield* fs
    .makeDirectory(path.dirname(resultPath), { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${path.dirname(resultPath)}.`));
  yield* fs
    .writeFileString(resultPath, `${artifactText}\n`)
    .pipe(QualityScriptCommandError.mapError(`Failed to write ${resultPath}.`));
});

const runTestTsgoPackageTask = Effect.fn("QualityScriptCommands.runTestTsgoPackageTask")(function* (
  extraArgs: unknown
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const { fs, path, repoRoot } = yield* qualityFileContext();
  const packageDir = path.resolve(process.cwd());
  const files = yield* collectOwnedTestTsgoFiles(repoRoot, packageDir);
  const groups = yield* collectTestTsgoPackageGroups(repoRoot, files);
  const group = A.head(groups);

  if (O.isNone(group)) {
    return yield* QualityScriptCommandError.make({
      message: `${packageDir} has no package-owned test files for ${testTsgoPackageTaskName}.`,
      exitCode: 1,
    });
  }

  const tempDir = path.join(repoRoot, "node_modules", ".tmp", "tsgo-test-checks");
  yield* fs
    .makeDirectory(tempDir, { recursive: true })
    .pipe(QualityScriptCommandError.mapError(`Failed to create ${tempDir}.`));
  const result = yield* runTestTsgoPackageGroup(repoRoot, tempDir, normalizeExtraArgs(extraArgs), group.value);
  yield* writeTestTsgoPackageResult(result);
});

const testTsgoTurboArgs = (
  groups: ReadonlyArray<TestTsgoPackageGroup>,
  extraArgs: ReadonlyArray<string>
): ReadonlyArray<string> => [
  "run",
  testTsgoPackageTaskName,
  "--concurrency=1",
  "--continue=always",
  "--output-logs=none",
  "--summarize",
  ...A.map(groups, (group) => `--filter=${group.packageName}`),
  ...(A.isReadonlyArrayNonEmpty(extraArgs) ? ["--", ...extraArgs] : A.empty<string>()),
];

const testTsgoTurboSummaryPath = (output: string): O.Option<string> =>
  pipe(
    Str.split(output, "\n"),
    A.findFirst(Str.includes("Summary:")),
    O.map(flow(Str.replace(/^.*Summary:\s*/u, ""), Str.trim)),
    O.filter(Str.isNonEmpty)
  );

const readTestTsgoPackageResult = Effect.fn("QualityScriptCommands.readTestTsgoPackageResult")(function* (
  group: TestTsgoPackageGroup
): Effect.fn.Return<TestTsgoPackageResult, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resultPath = testTsgoPackageResultPath(path, group.packageDir);
  const artifact = yield* fs
    .readFileString(resultPath)
    .pipe(
      QualityScriptCommandError.mapError(
        `Turbo task ${group.packageName}#${testTsgoPackageTaskName} did not write ${resultPath}.`
      ),
      Effect.flatMap(decodeTestTsgoPackageResultArtifact),
      QualityScriptCommandError.mapError(`Failed to decode ${resultPath}.`)
    );

  if (artifact.packageName !== group.packageName) {
    return yield* QualityScriptCommandError.make({
      message: `${resultPath} belongs to ${artifact.packageName}, expected ${group.packageName}.`,
      exitCode: 1,
    });
  }

  return {
    group,
    output: artifact.output,
    exitCode: artifact.exitCode,
  };
});

const readTestTsgoTurboResults = Effect.fn("QualityScriptCommands.readTestTsgoTurboResults")(function* (
  repoRoot: string,
  turboOutput: string,
  groups: ReadonlyArray<TestTsgoPackageGroup>
): Effect.fn.Return<
  ReadonlyArray<TestTsgoPackageResult>,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const summaryPathOption = testTsgoTurboSummaryPath(turboOutput);

  if (O.isNone(summaryPathOption)) {
    return yield* QualityScriptCommandError.make({
      message: `Turbo did not report a run summary for ${testTsgoPackageTaskName}.`,
      exitCode: 1,
    });
  }

  const summaryPath = path.resolve(repoRoot, summaryPathOption.value);
  const summary = yield* fs
    .readFileString(summaryPath)
    .pipe(
      QualityScriptCommandError.mapError(`Failed to read ${summaryPath}.`),
      Effect.flatMap(decodeTestTsgoTurboRunSummary),
      QualityScriptCommandError.mapError(`Failed to decode ${summaryPath}.`)
    );
  const tasksById = HM.fromIterable(A.map(summary.tasks, (task) => [task.taskId, task] as const));

  return yield* Effect.forEach(
    groups,
    Effect.fnUntraced(function* (group) {
      const taskId = `${group.packageName}#${testTsgoPackageTaskName}`;
      const task = HM.get(tasksById, taskId);

      if (O.isNone(task) || !Str.isNonEmpty(task.value.hash)) {
        return yield* QualityScriptCommandError.make({
          message: `${summaryPath} has no hashed task for ${taskId}.`,
          exitCode: 1,
        });
      }

      return yield* readTestTsgoPackageResult(group);
    }),
    { concurrency: 1 }
  );
});

const runTestTsgoTurboTasks = Effect.fn("QualityScriptCommands.runTestTsgoTurboTasks")(function* (
  repoRoot: string,
  groups: ReadonlyArray<TestTsgoPackageGroup>,
  extraArgs: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<TestTsgoPackageResult>, QualityScriptCommandError, QualityScriptEnvironment> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* Effect.forEach(
    groups,
    (group) =>
      fs
        .remove(testTsgoPackageResultPath(path, group.packageDir), { force: true })
        .pipe(QualityScriptCommandError.mapError(`Failed to clear ${group.packageName} test tsgo result.`)),
    { concurrency: 1, discard: true }
  );
  const turbo = yield* runCaptured({
    command: path.join(repoRoot, "node_modules", ".bin", "turbo"),
    args: testTsgoTurboArgs(groups, extraArgs),
    cwd: repoRoot,
    env: {
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      TURBO_TELEMETRY_DISABLED: "1",
      TURBO_UI: "stream",
    },
    extendEnv: true,
    source: "all",
    trim: true,
  }).pipe(QualityScriptCommandError.mapError(`Failed to run ${testTsgoPackageTaskName} Turbo tasks.`));

  if (turbo.exitCode !== 0) {
    return yield* QualityScriptCommandError.make({
      message: `${testTsgoPackageTaskName} Turbo execution failed with exit code ${turbo.exitCode}.`,
      exitCode: turbo.exitCode,
    });
  }

  return yield* readTestTsgoTurboResults(repoRoot, turbo.output, groups);
});

/**
 * Collect Effect tsgo diagnostics from command output regardless of process exit code.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { collectEffectTsgoDiagnosticLines } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const diagnostics = collectEffectTsgoDiagnosticLines([{ output: "warning TS90001: effect(service)\\n" }])
 * ```
 *
 * @param results - Completed tsgo command outputs to scan.
 * @returns Matching Effect diagnostic output lines.
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

type TestTsgoTaskOwner = {
  readonly packageName: string;
  readonly hasTaskScript: boolean;
};

/**
 * Build the actionable preflight failure for discovered packages without the Turbo worker script.
 *
 * **Example** (Report a missing package task)
 *
 * ```ts
 * import { missingTestTsgoTaskMessageForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const message = missingTestTsgoTaskMessageForTesting([
 *   { packageName: "@beep/example", hasTaskScript: false }
 * ])
 * ```
 *
 * @param groups - Discovered package owners and whether their manifests expose the task script.
 * @returns The preflight failure message, or `None` when every package can run the Turbo worker.
 * @category testing
 * @since 0.0.0
 */
export const missingTestTsgoTaskMessageForTesting = (groups: ReadonlyArray<TestTsgoTaskOwner>): O.Option<string> => {
  const missingPackageNames = pipe(
    groups,
    A.filter((group) => !group.hasTaskScript),
    A.map((group) => group.packageName),
    A.sort(Order.String)
  );

  return A.isReadonlyArrayEmpty(missingPackageNames)
    ? O.none()
    : O.some(
        `[check:tsgo:tests] missing required "${testTsgoPackageTaskName}" package script for ${A.join(
          missingPackageNames,
          ", "
        )}. Add "${testTsgoPackageTaskName}": "${testTsgoPackageTaskScript}" to each named package.json.`
      );
};

const extractEffectTsgoDiagnosticsTableFragment = (readme: string): O.Option<string> => {
  const tableStart = readme.indexOf(effectTsgoDiagnosticsTableStartMarker);
  const tableEnd = readme.indexOf(effectTsgoDiagnosticsTableEndMarker);

  return tableStart === -1 || tableEnd === -1 || tableEnd <= tableStart
    ? O.none()
    : O.some(Str.slice(tableStart + effectTsgoDiagnosticsTableStartMarker.length, tableEnd)(readme));
};

// 0.19 wrote the code bare (`<td><code>name</code></td>`); 0.33 wraps it in a
// link to the rule's doc page, which nests it one level deeper. Accept both so
// the lane keeps reading the table across upgrades instead of silently
// discovering zero rules.
const extractEffectTsgoRuleCellCode = (cell: unknown): O.Option<string> =>
  pipe(
    decodeEffectTsgoRuleCellOption(cell),
    O.orElse(() => O.map(decodeEffectTsgoLinkedRuleCellOption(cell), (linked) => linked.a)),
    O.map((decoded) => decoded.code)
  );

const extractEffectTsgoRuleNameFromRow = flow(
  decodeEffectTsgoRuleRowOption,
  O.flatMap((decodedRow) => A.head(decodedRow.td)),
  O.flatMap(extractEffectTsgoRuleCellCode)
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

const findConfiguredPlugins = (config: unknown): O.Option<ReadonlyArray<unknown>> =>
  pipe(
    unknownRecordProperty(config, "compilerOptions"),
    O.flatMap((compilerOptions) => unknownRecordProperty(compilerOptions, "plugins")),
    O.flatMap(decodeUnknownArrayOption)
  );

const findEffectLanguageServicePlugins = (config: unknown): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  pipe(
    findConfiguredPlugins(config),
    O.map(
      A.flatMap((plugin) =>
        pipe(
          decodeUnknownRecordOption(plugin),
          O.filter((record) => record.name === "@effect/language-service"),
          O.match({ onNone: A.empty<Readonly<Record<string, unknown>>>, onSome: A.of })
        )
      )
    ),
    O.getOrElse(A.empty<Readonly<Record<string, unknown>>>)
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

const isDirectEffectDrizzleTsconfig = (filePath: string): boolean => {
  const segments = Str.split(normalizePath(filePath), "/");
  return (
    A.length(segments) === 4 &&
    O.exists(A.get(segments, 0), Str.equivalence("packages")) &&
    O.exists(A.get(segments, 1), Str.equivalence("ecosystem")) &&
    O.exists(A.get(segments, 2), Str.equivalence("effect-drizzle")) &&
    O.exists(A.get(segments, 3), isTsconfigFileName)
  );
};

const findDiagnosticSeverityMap = (
  plugin: Readonly<Record<string, unknown>>
): O.Option<Readonly<Record<string, unknown>>> =>
  pipe(unknownRecordProperty(plugin, "diagnosticSeverity"), O.flatMap(decodeUnknownRecordOption));

const collectEffectDrizzleSeverityDiffDiagnostics = (
  file: string,
  baseSeverity: Readonly<Record<string, unknown>>,
  severity: Readonly<Record<string, unknown>>
): ReadonlyArray<string> => {
  const baseRuleNames = pipe(R.keys(baseSeverity), A.sort(Order.String));
  const configuredRuleNames = pipe(R.keys(severity), A.sort(Order.String));
  const missing = pipe(
    baseRuleNames,
    A.filter((ruleName) => !A.contains(configuredRuleNames, ruleName)),
    A.map((ruleName) => `${file}: Effect Drizzle diagnosticSeverity is missing rule ${ruleName}`)
  );
  const unexpected = pipe(
    configuredRuleNames,
    A.filter((ruleName) => !A.contains(baseRuleNames, ruleName)),
    A.map((ruleName) => `${file}: Effect Drizzle diagnosticSeverity has unexpected rule ${ruleName}`)
  );
  const mismatched = pipe(
    baseRuleNames,
    A.filter((ruleName) => {
      const expectedSeverity = isEcosystemEffectDiagnosticOffRule(ruleName)
        ? "off"
        : pipe(R.get(baseSeverity, ruleName), O.getOrUndefined);
      const actualSeverity = pipe(R.get(severity, ruleName), O.getOrUndefined);
      return actualSeverity !== undefined && actualSeverity !== expectedSeverity;
    }),
    A.map((ruleName) => {
      const expectedSeverity = isEcosystemEffectDiagnosticOffRule(ruleName)
        ? "off"
        : pipe(R.get(baseSeverity, ruleName), O.getOrUndefined);
      const actualSeverity = pipe(R.get(severity, ruleName), O.getOrUndefined);
      return `${file}: Effect Drizzle diagnosticSeverity.${ruleName} must be ${Inspectable.toStringUnknown(expectedSeverity, 0)}; found ${Inspectable.toStringUnknown(actualSeverity, 0)}`;
    })
  );
  return A.appendAll(A.appendAll(missing, unexpected), mismatched);
};

interface LocalEffectPluginResolution {
  readonly diagnostics: ReadonlyArray<string>;
  readonly plugin: O.Option<Readonly<Record<string, unknown>>>;
}

const localEffectPluginResolution = (file: string, config: unknown): LocalEffectPluginResolution => {
  const localPluginsProperty = pipe(
    unknownRecordProperty(config, "compilerOptions"),
    O.flatMap((compilerOptions) => unknownRecordProperty(compilerOptions, "plugins"))
  );
  if (O.isNone(localPluginsProperty)) {
    return {
      diagnostics: isDirectEffectDrizzleTsconfig(file)
        ? A.of(`Effect Drizzle tsconfig ${file} is missing its explicit @effect/language-service profile`)
        : A.empty(),
      plugin: O.none(),
    };
  }
  if (O.isNone(decodeUnknownArrayOption(localPluginsProperty.value))) {
    return { diagnostics: A.of(`${file}: compilerOptions.plugins must be an array`), plugin: O.none() };
  }

  const effectPlugins = findEffectLanguageServicePlugins(config);
  if (A.isReadonlyArrayEmpty(effectPlugins)) {
    return {
      diagnostics: A.of(
        `${file}: local compilerOptions.plugins replaces the inherited @effect/language-service profile`
      ),
      plugin: O.none(),
    };
  }
  if (A.length(effectPlugins) !== 1) {
    return {
      diagnostics: A.of(`${file}: compilerOptions.plugins must contain @effect/language-service exactly once`),
      plugin: O.none(),
    };
  }
  return O.match(A.head(effectPlugins), {
    onNone: () => ({
      diagnostics: A.of(`${file}: failed to read the local @effect/language-service profile`),
      plugin: O.none(),
    }),
    onSome: (plugin) => ({ diagnostics: A.empty(), plugin: O.some(plugin) }),
  });
};

const collectPluginMismatchDiagnostics = (
  file: string,
  plugin: Readonly<Record<string, unknown>>,
  basePlugin: Readonly<Record<string, unknown>>,
  baseSeverity: Readonly<Record<string, unknown>>
): ReadonlyArray<string> => {
  const expectedPlugin = isDirectEffectDrizzleTsconfig(file)
    ? {
        ...basePlugin,
        diagnosticSeverity: {
          ...baseSeverity,
          missedPipeableOpportunity: "off",
        },
      }
    : basePlugin;
  if (Equal.equals(plugin, expectedPlugin)) {
    return A.empty();
  }
  if (!isDirectEffectDrizzleTsconfig(file)) {
    return A.of(`${file}: local @effect/language-service profile must exactly match tsconfig.base.json`);
  }

  const severityDiagnostics = O.match(findDiagnosticSeverityMap(plugin), {
    onNone: () => A.of(`${file}: Effect Drizzle @effect/language-service profile is missing diagnosticSeverity`),
    onSome: (configured) => collectEffectDrizzleSeverityDiffDiagnostics(file, baseSeverity, configured),
  });
  return A.isReadonlyArrayNonEmpty(severityDiagnostics)
    ? severityDiagnostics
    : A.of(
        `${file}: Effect Drizzle @effect/language-service profile differs from tsconfig.base.json beyond missedPipeableOpportunity`
      );
};

const collectLocalPluginProfileDiagnostics = (
  file: string,
  config: unknown,
  basePlugin: Readonly<Record<string, unknown>>,
  baseSeverity: Readonly<Record<string, unknown>>
): ReadonlyArray<string> => {
  if (file === "tsconfig.base.json") {
    return A.empty();
  }

  const resolution = localEffectPluginResolution(file, config);
  return O.match(resolution.plugin, {
    onNone: () => resolution.diagnostics,
    onSome: (plugin) => collectPluginMismatchDiagnostics(file, plugin, basePlugin, baseSeverity),
  });
};

const collectPluginProfileDiagnostics = (
  basePlugin: Readonly<Record<string, unknown>>,
  configs: ReadonlyArray<readonly [file: string, config: unknown]>
): ReadonlyArray<string> =>
  O.match(findDiagnosticSeverityMap(basePlugin), {
    onNone: () => A.of("tsconfig.base.json is missing the root @effect/language-service diagnosticSeverity map"),
    onSome: (baseSeverity) =>
      A.flatMap(configs, ([file, config]) =>
        collectLocalPluginProfileDiagnostics(file, config, basePlugin, baseSeverity)
      ),
  });

const excludedStandaloneTsconfigs = [
  "infra/ci-runners/sdks/ghaRunners/tsconfig.json",
  "infra/lambda/turbo-cache/tsconfig.json",
] as const;

const isExcludedTsgoProfileTsconfig = (file: string): boolean =>
  Str.includes("/test/fixtures/")(file) ||
  Str.includes("/docs/examples/")(file) ||
  A.contains(excludedStandaloneTsconfigs, file);

const resolveRelativeTsconfigPath = (file: string, extended: string): string => {
  let segments = A.dropRight(Str.split(file, "/"), 1);
  for (const segment of Str.split(extended, "/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    segments = segment === ".." ? A.dropRight(segments, 1) : A.append(segments, segment);
  }
  return A.join(segments, "/");
};

const findTsconfigExtends = (config: unknown): O.Option<ReadonlyArray<string>> =>
  pipe(
    unknownRecordProperty(config, "extends"),
    O.flatMap((extended) => (P.isString(extended) ? O.some(A.of(extended)) : decodeStringArrayOption(extended)))
  );

type TsconfigInheritanceResolution =
  | { readonly _tag: "ReachedBase" }
  | { readonly _tag: "Unresolved"; readonly diagnostic: string };

const reachedTsconfigBase: TsconfigInheritanceResolution = { _tag: "ReachedBase" };

const unresolvedTsconfigInheritance = (file: string, detail: string): TsconfigInheritanceResolution => ({
  _tag: "Unresolved",
  diagnostic: `${file}: ${detail}`,
});

const resolveTsconfigInheritance = (
  file: string,
  current: string,
  configByFile: Readonly<Record<string, unknown>>,
  visited: ReadonlyArray<string>
): TsconfigInheritanceResolution => {
  if (current === "tsconfig.base.json") {
    return reachedTsconfigBase;
  }
  if (A.contains(visited, current)) {
    return unresolvedTsconfigInheritance(file, `tsconfig extends cycle encountered at ${current}`);
  }

  const currentConfig = R.get(configByFile, current);
  if (O.isNone(currentConfig)) {
    return unresolvedTsconfigInheritance(file, `tsconfig extends chain references missing config ${current}`);
  }

  return resolveTsconfigInheritanceBranches(file, current, currentConfig.value, configByFile, visited);
};

const resolveTsconfigInheritanceBranches = (
  file: string,
  current: string,
  currentConfig: unknown,
  configByFile: Readonly<Record<string, unknown>>,
  visited: ReadonlyArray<string>
): TsconfigInheritanceResolution => {
  const extended = findTsconfigExtends(currentConfig);
  if (O.isNone(extended) || A.isReadonlyArrayEmpty(extended.value)) {
    return unresolvedTsconfigInheritance(file, "tsconfig extends chain does not reach tsconfig.base.json");
  }

  const nextVisited = A.append(visited, current);
  const resolutions = A.map(extended.value, (base) =>
    resolveTsconfigInheritance(file, resolveRelativeTsconfigPath(current, base), configByFile, nextVisited)
  );
  return pipe(
    A.findFirst(resolutions, (resolution) => resolution._tag === "ReachedBase"),
    O.orElse(() => A.head(resolutions)),
    O.getOrElse(() => unresolvedTsconfigInheritance(file, "tsconfig extends chain does not reach tsconfig.base.json"))
  );
};

const collectTsconfigInheritanceDiagnostics = (
  configs: ReadonlyArray<readonly [file: string, config: unknown]>
): ReadonlyArray<string> => {
  const configByFile = R.fromEntries(configs);
  return pipe(
    configs,
    A.filter(([file]) => file !== "tsconfig.base.json" && !isExcludedTsgoProfileTsconfig(file)),
    A.flatMap(([file]) => {
      if (O.isNone(R.get(configByFile, "tsconfig.base.json"))) {
        return A.of(`${file}: tsconfig extends chain references missing config tsconfig.base.json`);
      }
      const resolution = resolveTsconfigInheritance(file, file, configByFile, A.empty());
      return resolution._tag === "ReachedBase" ? A.empty<string>() : A.of(resolution.diagnostic);
    })
  );
};

interface TsgoPluginProfileDiagnosticsInput {
  readonly basePlugin: Readonly<Record<string, unknown>>;
  readonly configs: ReadonlyArray<readonly [file: string, config: unknown]>;
}

/**
 * Validate local Effect language-service profiles against the root profile.
 *
 * **Example** (Check inherited profiles)
 *
 * ```ts
 * import { collectTsgoPluginProfileDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const basePlugin = { name: "@effect/language-service", diagnosticSeverity: { floatingEffect: "error" } }
 * const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting({ basePlugin, configs: [] })
 * console.log(diagnostics.length) // => 0
 * ```
 *
 * @param input - Root plugin profile and repository tsconfig documents to validate.
 * @returns Human-readable profile diagnostics; empty when every profile obeys the repository policy.
 * @category testing
 * @since 0.0.0
 */
export const collectTsgoPluginProfileDiagnosticsForTesting = (
  input: TsgoPluginProfileDiagnosticsInput
): ReadonlyArray<string> => collectPluginProfileDiagnostics(input.basePlugin, input.configs);

/**
 * Validate that tsconfig inheritance reaches the repository base profile.
 *
 * **Example** (Check an indirect extends chain)
 *
 * ```ts
 * import { collectTsconfigInheritanceDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const diagnostics = collectTsconfigInheritanceDiagnosticsForTesting([
 *   ["tsconfig.base.json", {}],
 *   ["packages/example/tsconfig.json", { extends: "../../../tsconfig.base.json" }],
 * ])
 * console.log(diagnostics.length) // => 0
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const collectTsconfigInheritanceDiagnosticsForTesting = collectTsconfigInheritanceDiagnostics;

const collectGeneratedVitestAliasDiagnostics = (
  rootTsconfig: unknown,
  generatedVitestAliases: unknown
): ReadonlyArray<string> => {
  const rootTsconfigAliasPaths = pipe(
    unknownRecordProperty(rootTsconfig, "compilerOptions"),
    O.flatMap(decodeUnknownRecordOption),
    O.flatMap((compilerOptions) => unknownRecordProperty(compilerOptions, "paths")),
    O.flatMap(decodeAliasPathsOption)
  );
  const generatedAliasPaths = decodeAliasPathsOption(generatedVitestAliases);
  return O.isSome(rootTsconfigAliasPaths) &&
    O.isSome(generatedAliasPaths) &&
    Equal.equals(rootTsconfigAliasPaths.value, generatedAliasPaths.value)
    ? A.empty<string>()
    : A.of("vitest.aliases.generated.json differs from tsconfig.json compilerOptions.paths; regenerate the alias data");
};

const collectWorkspaceTsconfigProfileDiagnostics = Effect.fn(
  "QualityScriptCommands.collectWorkspaceTsconfigProfileDiagnostics"
)(function* (repoRoot: string, basePlugin: Readonly<Record<string, unknown>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rootTsconfigFiles = pipe(
    yield* fs.readDirectory(repoRoot).pipe(QualityScriptCommandError.mapError(`Failed to read ${repoRoot}.`)),
    A.filter(isTsconfigFileName),
    A.map((name) => path.join(repoRoot, name))
  );
  const workspaceTsconfigFiles = yield* Effect.forEach(
    tsgoProfileScannedRoots,
    (root) =>
      collectFiles(
        path.join(repoRoot, root),
        (_normalized, name) => isTsconfigFileName(name),
        (_normalized, name) => A.contains(effectDiagnosticsDirectiveIgnoredDirectoryNames, name)
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
  const tsconfigFiles = pipe(A.appendAll(rootTsconfigFiles, workspaceTsconfigFiles), A.dedupe, A.sort(Order.String));
  const tsconfigs = yield* Effect.forEach(
    tsconfigFiles,
    Effect.fnUntraced(function* (filePath) {
      const text = yield* fs
        .readFileString(filePath)
        .pipe(QualityScriptCommandError.mapError(`Failed to read ${filePath}.`));
      const errors: Array<ParseError> = [];
      const parsed = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
      if (A.isReadonlyArrayNonEmpty(errors)) {
        return yield* QualityScriptCommandError.make({
          message: `${normalizePath(path.relative(repoRoot, filePath))} is not valid JSONC.`,
          exitCode: 1,
        });
      }
      return [normalizePath(path.relative(repoRoot, filePath)), parsed] as const;
    }),
    { concurrency: 8 }
  );
  return A.appendAll(
    collectPluginProfileDiagnostics(basePlugin, tsconfigs),
    collectTsconfigInheritanceDiagnostics(tsconfigs)
  );
});

const collectDisabledEffectDiagnosticDirectives = Effect.fn(
  "QualityScriptCommands.collectDisabledEffectDiagnosticDirectives"
)(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scannedFiles = yield* Effect.forEach(
    effectDiagnosticsDirectiveScannedRoots,
    (root) =>
      collectFiles(
        path.join(repoRoot, root),
        (_normalized, name) => A.contains(effectDiagnosticsDirectiveScannedExtensions, path.extname(name)),
        (normalized, name) =>
          A.contains(effectDiagnosticsDirectiveIgnoredDirectoryNames, name) ||
          name === ".storybook" ||
          Str.includes("/apps/storybook/")(normalized)
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
  return yield* Effect.forEach(
    scannedFiles,
    Effect.fnUntraced(function* (filePath) {
      const text = yield* fs
        .readFileString(filePath)
        .pipe(QualityScriptCommandError.mapError(`Failed to read ${filePath}.`));
      return pipe(
        Str.split(text, "\n"),
        A.flatMap((line, index) =>
          effectDiagnosticsDirectivePattern.test(line)
            ? A.of(`${normalizePath(path.relative(repoRoot, filePath))}:${index + 1}`)
            : A.empty<string>()
        )
      );
    }),
    { concurrency: 8 }
  ).pipe(Effect.map(A.flatten));
});

const assembleTsgoRuleDiagnostics = (
  missingRuleNames: ReadonlyArray<string>,
  extraRuleNames: ReadonlyArray<string>,
  nonErrorSeverities: ReadonlyArray<string>,
  disabledSeverityEntries: ReadonlyArray<string>,
  pluginProfileDiagnostics: ReadonlyArray<string>,
  generatedAliasDiagnostics: ReadonlyArray<string>,
  disabledDirectives: ReadonlyArray<string>
): ReadonlyArray<string> => [
  ...renderTsgoRuleDiagnostics("missing installed rules", missingRuleNames),
  ...renderTsgoRuleDiagnostics("unexpected configured rules", extraRuleNames),
  ...renderTsgoRuleDiagnostics("rules not configured as error", nonErrorSeverities),
  ...renderTsgoRuleDiagnostics("diagnosticSeverity entries set to off", disabledSeverityEntries),
  ...renderTsgoRuleDiagnostics("invalid workspace Effect language-service profiles", pluginProfileDiagnostics),
  ...renderTsgoRuleDiagnostics("generated Vitest alias drift", generatedAliasDiagnostics),
  ...renderTsgoRuleDiagnostics("disabled Effect diagnostic directives", disabledDirectives),
];

/**
 * Check that the root tsgo Effect diagnostics configuration enables every installed rule as an error.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runTsgoRulesCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTsgoRulesCheck()
 * ```
 *
 * @returns Effect that fails when tsgo rules drift or local source suppresses Effect diagnostics.
 * @category use-cases
 * @since 0.0.0
 */
export const runTsgoRulesCheck = Effect.fn("QualityScriptCommands.runTsgoRulesCheck")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  QualityScriptEnvironment
> {
  const { fs, path, repoRoot } = yield* qualityFileContext();
  const readmePath = path.join(repoRoot, "node_modules", "@effect", "tsgo", "README.md");
  const tsconfigPath = path.join(repoRoot, "tsconfig.base.json");
  const rootTsconfigPath = path.join(repoRoot, "tsconfig.json");
  const generatedVitestAliasesPath = path.join(repoRoot, "vitest.aliases.generated.json");
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

  const rootTsconfigText = yield* fs
    .readFileString(rootTsconfigPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${rootTsconfigPath}.`));
  const rootTsconfigParseErrors: Array<ParseError> = [];
  const rootTsconfig = parse(rootTsconfigText, rootTsconfigParseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  const generatedVitestAliasesText = yield* fs
    .readFileString(generatedVitestAliasesPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${generatedVitestAliasesPath}.`));
  const generatedVitestAliasesParseErrors: Array<ParseError> = [];
  const generatedVitestAliases = parse(generatedVitestAliasesText, generatedVitestAliasesParseErrors, {
    allowTrailingComma: false,
    disallowComments: true,
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

  if (
    A.isReadonlyArrayNonEmpty(rootTsconfigParseErrors) ||
    A.isReadonlyArrayNonEmpty(generatedVitestAliasesParseErrors)
  ) {
    return yield* QualityScriptCommandError.make({
      message: "Root tsconfig or generated Vitest aliases are not valid JSONC.",
      exitCode: 1,
    });
  }

  const rootEffectPlugins = findEffectLanguageServicePlugins(config);
  if (A.length(rootEffectPlugins) !== 1) {
    return yield* QualityScriptCommandError.make({
      message: "tsconfig.base.json must contain @effect/language-service exactly once.",
      exitCode: 1,
    });
  }
  const plugin = A.head(rootEffectPlugins);
  if (O.isNone(plugin)) {
    return yield* QualityScriptCommandError.make({
      message: "Failed to read the root @effect/language-service plugin.",
      exitCode: 1,
    });
  }

  const diagnosticSeverity = pipe(
    unknownRecordProperty(plugin.value, "diagnosticSeverity"),
    O.flatMap(decodeUnknownRecordOption)
  );
  const generatedAliasDiagnostics = collectGeneratedVitestAliasDiagnostics(rootTsconfig, generatedVitestAliases);
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
  const pluginProfileDiagnostics = yield* collectWorkspaceTsconfigProfileDiagnostics(repoRoot, plugin.value);
  const disabledDirectives = yield* collectDisabledEffectDiagnosticDirectives(repoRoot);
  const diagnostics = assembleTsgoRuleDiagnostics(
    missingRuleNames,
    extraRuleNames,
    nonErrorSeverities,
    disabledSeverityEntries,
    pluginProfileDiagnostics,
    generatedAliasDiagnostics,
    disabledDirectives
  );

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

/**
 * Run repo-wide Effect diagnostics for test files.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runTestTsgoChecks } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTestTsgoChecks([])
 * ```
 *
 * @param extraArgs - Additional arguments passed to tsgo.
 * @returns Effect that runs the test-file tsgo lane.
 * @category use-cases
 * @since 0.0.0
 */
export const runTestTsgoChecks = Effect.fn("QualityScriptCommands.runTestTsgoChecks")(function* (
  extraArgs: unknown
): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
  const { fs, path, repoRoot } = yield* qualityFileContext();
  const discoveredFiles = yield* Effect.forEach(
    testSearchRoots,
    (root) => collectTestTsgoFilesUnder(path.join(repoRoot, root)),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

  if (A.isReadonlyArrayEmpty(discoveredFiles)) {
    yield* Console.log("[check:tsgo:tests] no test files found");
    return;
  }

  const tempDir = path.join(repoRoot, "node_modules", ".tmp", "tsgo-test-checks");
  const normalizedExtraArgs = normalizeExtraArgs(extraArgs);
  const packageGroups = yield* collectTestTsgoPackageGroups(repoRoot, discoveredFiles);
  const missingTaskMessage = missingTestTsgoTaskMessageForTesting(packageGroups);

  if (O.isSome(missingTaskMessage)) {
    return yield* QualityScriptCommandError.make({
      message: missingTaskMessage.value,
      exitCode: 1,
    });
  }

  yield* Console.log(
    `[check:tsgo:tests] checking ${A.length(discoveredFiles)} file(s) across ${A.length(packageGroups)} package(s)`
  );
  const results = yield* runTestTsgoTurboTasks(repoRoot, packageGroups, normalizedExtraArgs).pipe(
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
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runTsgoSmokeCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runTsgoSmokeCheck()
 * ```
 *
 * @returns Effect that performs the smoke check.
 * @category use-cases
 * @since 0.0.0
 */
export const runTsgoSmokeCheck = Effect.fn("QualityScriptCommands.runTsgoSmokeCheck")(function* (): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  QualityScriptEnvironment
> {
  const { fs, path, repoRoot } = yield* qualityFileContext();
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
 * Predicate deciding whether a tracked file joins the module-tags scan.
 *
 * **Details**
 *
 * Lab apps under `apps/labs` are ceremony-exempt (goals/lab-apps-lifecycle D2)
 * and never enter the scan; every other scanned root keeps its coverage.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { isModuleTagScannedPathForTesting } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * console.log(typeof isModuleTagScannedPathForTesting !== "undefined") // true
 * ```
 *
 * @param path - Path service used to normalize the candidate file path.
 * @returns Whether the file belongs in the module-tags scan.
 * @category testing
 * @since 0.0.0
 */
export const isModuleTagScannedPathForTesting =
  (path: Path.Path) =>
  (filePath: string): boolean =>
    A.some(moduleTagScannedRoots, (root) => filePath === root || Str.startsWith(`${root}/`)(filePath)) &&
    !isLabsWorkspacePath(filePath) &&
    A.contains(moduleTagScannedExtensions as ReadonlyArray<string>, path.extname(filePath));

/**
 * Verify tracked fileoverview comments do not use the legacy `@module` tag.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runJSDocModuleTagsCheck } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runJSDocModuleTagsCheck()
 * ```
 *
 * @returns Effect that performs the module-tag lint.
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocModuleTagsCheck = Effect.fn("QualityScriptCommands.runJSDocModuleTagsCheck")(
  function* (): Effect.fn.Return<void, QualityScriptCommandError, QualityScriptEnvironment> {
    const { fs, path, repoRoot } = yield* qualityFileContext();
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

    const isScannedPath = isModuleTagScannedPathForTesting(path);
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
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runJSDocInventory } from "@beep/repo-cli/commands/Quality/Quality.command"
 * const program = runJSDocInventory()
 * ```
 *
 * @returns Effect that writes the tracked inventory artifacts.
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocInventory = Effect.fn("QualityScriptCommands.runJSDocInventory")(function* (
  options: JSDocDocumentationInventoryOptions = {}
): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  const outputJsonPath = pipe(
    options.outputJsonPath,
    O.fromUndefinedOr,
    O.map((outputPath) => path.resolve(repoRoot, outputPath))
  );
  const outputMarkdownPath = pipe(
    options.outputMarkdownPath,
    O.fromUndefinedOr,
    O.map((outputPath) => path.resolve(repoRoot, outputPath))
  );

  const result = yield* writeJSDocDocumentationInventory({
    ...options,
    rootDir: repoRoot,
    ...OptionUtils.getSomesStruct({ outputJsonPath, outputMarkdownPath }),
  }).pipe(
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
 * **Example** (Run a quality command)
 *
 * ```ts
 * import { runJSDocQuality } from "@beep/repo-cli/commands/Quality/Quality.command"
 *
 * const program = runJSDocQuality()
 * console.log(program) // example value
 * ```
 *
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

const githubChecksCommand = Command.make(
  "github-checks",
  {
    base: Flag.string("base").pipe(
      Flag.withDefault("origin/main"),
      Flag.withDescription("Base git ref for affected review-fix checks")
    ),
    head: Flag.string("head").pipe(Flag.withDefault("HEAD"), Flag.withDescription("Head git ref for affected checks")),
    collectAll: Flag.boolean("collect-all").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Run every local GitHub-check wave after failures instead of stopping before later waves")
    ),
    noFailFast: Flag.boolean("no-fail-fast").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Keep launching local gates after a precise red to collect the full diagnostic picture")
    ),
    mode: Argument.choice("mode", GITHUB_CHECK_MODE_VALUES).pipe(Argument.withDescription("GitHub check mode to run")),
  },
  ({ base, collectAll, head, mode, noFailFast }) =>
    runQualityProgram(
      runGithubChecks(mode, {
        base,
        head,
        failurePolicy: collectAll || noFailFast ? "collect-all" : "fail-fast",
      })
    )
).pipe(Command.withDescription("Run repository GitHub verification lanes"));

const githubChecksPlanContractCheckCommand = Command.make(
  "plan-contract-check",
  {
    expectPromotedFallowLanes: Flag.boolean("expect-promoted-fallow-lanes").pipe(
      Flag.withDefault(false),
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
      Flag.withDefault(false),
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

const testTsgoCommand = Command.make(
  "test-tsgo",
  {
    args: Argument.string("args").pipe(Argument.variadic),
  },
  ({ args }) => runQualityProgram(runTestTsgoChecks(args as ReadonlyArray<string>))
).pipe(Command.withDescription("Run Effect tsgo diagnostics for test files"));

const testTsgoPackageCommand = Command.make(
  "test-tsgo-package",
  {
    args: Argument.string("args").pipe(Argument.variadic),
  },
  ({ args }) => runQualityProgram(runTestTsgoPackageTask(args as ReadonlyArray<string>))
).pipe(Command.withDescription("Run one package-owned tsgo test task for the aggregate lane"));

const tsgoSmokeCommand = Command.make("tsgo-smoke", {}, () => runQualityProgram(runTsgoSmokeCheck())).pipe(
  Command.withDescription("Smoke test the repo tsgo Effect diagnostics")
);

const tsgoRulesCommand = Command.make("tsgo-rules", {}, () => runQualityProgram(runTsgoRulesCheck())).pipe(
  Command.withDescription("Check root @effect/tsgo diagnostic severities")
);

const jsdocModuleTagsCommand = Command.make("jsdoc-module-tags", {}, () =>
  runQualityProgram(runJSDocModuleTagsCheck())
).pipe(Command.withDescription("Check for forbidden @module fileoverview tags"));

const jsdocInventoryCommand = Command.make(
  "jsdoc-inventory",
  {
    outputJson: Flag.string("output-json").pipe(
      Flag.withDescription("JSONC inventory output path; defaults to the tracked standards artifact"),
      Flag.optional
    ),
    outputMarkdown: Flag.string("output-markdown").pipe(
      Flag.withDescription("Markdown inventory output path; defaults to the tracked standards artifact"),
      Flag.optional
    ),
  },
  ({ outputJson, outputMarkdown }) =>
    runQualityProgram(
      runJSDocInventory(
        JSDocDocumentationInventoryOptions.make({
          ...OptionUtils.getSomesStruct({ outputJsonPath: outputJson, outputMarkdownPath: outputMarkdown }),
        })
      )
    )
).pipe(Command.withDescription("Generate the JSDoc documentation inventory"));

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
      Flag.withDefault(false),
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

const jsdocMigrateExtractCommand = Command.make(
  "extract",
  {
    output: Flag.string("output").pipe(
      Flag.withDescription("extract.jsonl output path; defaults to the goal packet data directory"),
      Flag.optional
    ),
  },
  ({ output }) =>
    runQualityProgram(
      runJSDocMigrateExtract(RunJSDocMigrateExtractOptions.make({ ...OptionUtils.getSomesStruct({ output }) }))
    )
).pipe(Command.withDescription("Scan the corpus and emit one extract.jsonl record per legacy doc block"));

const jsdocMigrateTitlesCommand = Command.make(
  "titles",
  {
    extract: Flag.string("extract").pipe(Flag.withDescription("extract.jsonl input path"), Flag.optional),
    titles: Flag.string("titles").pipe(Flag.withDescription("titles.jsonl append path"), Flag.optional),
    proxyUrl: Flag.string("proxy-url").pipe(
      Flag.withDescription("Local CLIProxyAPI base URL; never the xAI API"),
      Flag.optional
    ),
    model: Flag.string("model").pipe(Flag.withDescription("Proxy model id"), Flag.optional),
    limitFiles: Flag.integer("limit-files").pipe(
      Flag.withDescription("Process at most this many pending files this run"),
      Flag.optional
    ),
    concurrency: Flag.integer("concurrency").pipe(
      Flag.withDescription("Concurrent proxy requests (one per file); default 12"),
      Flag.optional
    ),
  },
  ({ concurrency, extract, limitFiles, model, proxyUrl, titles }) =>
    runQualityProgram(
      Effect.scoped(
        Layer.build(FetchHttpClient.layer).pipe(
          Effect.flatMap((context) =>
            Effect.provideContext(
              runJSDocMigrateTitles(
                RunJSDocMigrateTitlesOptions.make({
                  ...OptionUtils.getSomesStruct({ extract, titles, proxyUrl, model, limitFiles, concurrency }),
                })
              ),
              context
            )
          )
        )
      )
    )
).pipe(Command.withDescription("Append per-anchor title records from the local model proxy (data only)"));

const jsdocMigrateApplyCommand = Command.make(
  "apply",
  {
    titles: Flag.string("titles").pipe(Flag.withDescription("titles.jsonl input path"), Flag.optional),
    overrides: Flag.string("overrides").pipe(Flag.withDescription("overrides.jsonl input path"), Flag.optional),
    manifest: Flag.string("manifest").pipe(Flag.withDescription("Proof manifest output path"), Flag.optional),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Report outcomes without writing any file")
    ),
    syntheticTitles: Flag.boolean("synthetic-titles").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Generate in-memory placeholder titles for the residue measurement")
    ),
  },
  ({ dryRun, manifest, overrides, syntheticTitles, titles }) =>
    runQualityProgram(
      runJSDocMigrateApply(
        RunJSDocMigrateApplyOptions.make({
          dryRun,
          syntheticTitles,
          ...OptionUtils.getSomesStruct({ titles, overrides, manifest }),
        })
      )
    )
).pipe(Command.withDescription("Rewrite affected blocks text-surgically; fail closed on binding doubt"));

const jsdocMigrateVerifyCommand = Command.make(
  "verify",
  {
    extract: Flag.string("extract").pipe(Flag.withDescription("Frozen extract.jsonl input path"), Flag.optional),
    titles: Flag.string("titles").pipe(Flag.withDescription("titles.jsonl input path"), Flag.optional),
    overrides: Flag.string("overrides").pipe(Flag.withDescription("overrides.jsonl input path"), Flag.optional),
    manifest: Flag.string("manifest").pipe(Flag.withDescription("Proof manifest output path"), Flag.optional),
  },
  ({ extract, manifest, overrides, titles }) =>
    runQualityProgram(
      runJSDocMigrateVerify(
        RunJSDocMigrateVerifyOptions.make({ ...OptionUtils.getSomesStruct({ extract, titles, overrides, manifest }) })
      )
    )
).pipe(Command.withDescription("Prove conservation between frozen originals and the current tree"));

const jsdocMigrateCommand = Command.make("jsdoc-migrate", {}, () =>
  printLines([
    "JSDoc carrier-migration commands:",
    "- bun run beep quality jsdoc-migrate extract",
    "- bun run beep quality jsdoc-migrate titles --limit-files 5",
    "- bun run beep quality jsdoc-migrate apply --dry-run --synthetic-titles",
    "- bun run beep quality jsdoc-migrate apply",
    "- bun run beep quality jsdoc-migrate verify",
  ])
).pipe(
  Command.withDescription("JSDoc legacy-carrier migration pipeline (extract, titles, apply, verify)"),
  Command.withSubcommands([
    jsdocMigrateExtractCommand,
    jsdocMigrateTitlesCommand,
    jsdocMigrateApplyCommand,
    jsdocMigrateVerifyCommand,
  ])
);

const knipCommand = Command.make(
  "knip",
  {
    baseline: Flag.string("baseline").pipe(
      Flag.withDefault(defaultKnipBaselinePath),
      Flag.withDescription("Committed Knip regression baseline JSONC path")
    ),
    writeBaseline: Flag.boolean("write-baseline").pipe(
      Flag.withDefault(false),
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
    json: Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the proof report as JSON")),
    taskArgs: Argument.string("task").pipe(
      Argument.variadic,
      Argument.withDescription("Optional Turbo tasks to prove; defaults to lint check test docgen")
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

/**
 * Verify one workspace package against freshly built dependency artifacts.
 *
 * **Details**
 *
 * Default verification first runs the selected package's upstream Turbo build
 * closure without rebuilding the package itself, and only then runs the package
 * audit. A genuine closure-build or audit failure still records the existing P0
 * package-audit inbox shard. Quick mode continues to run only lint and check.
 *
 * **Example** (Verify the repository CLI package)
 *
 * ```ts
 * const command = "bun run beep quality package-verify @beep/repo-cli"
 * console.log(command)
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
const packageVerifyCommand = Command.make(
  "package-verify",
  {
    packageArgs: Argument.string("package").pipe(
      Argument.variadic,
      Argument.withDescription("Optional workspace package name to verify")
    ),
    quick: Flag.boolean("quick").pipe(Flag.withDefault(false), Flag.withDescription("Run lint and check only")),
  },
  ({ packageArgs, quick }) =>
    runQualityProgram(runPackageVerifyCli({ packageArgs: variadicStrings(packageArgs), quick }))
).pipe(Command.withDescription("Build a package's upstream dependencies, then run package-local verification"));

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
    json: Flag.boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Print the detected profile as JSON")
    ),
  },
  ({ json }) => runQualityProgram(printQualityProfileDetection(detectQualityProfile(), json))
).pipe(Command.withDescription("Detect the local quality hardware profile"));

const qualityProfileConfigCommand = Command.make(
  "config",
  {
    json: Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the profile config as JSON")),
    profile: Argument.choice("profile", QualityHardwareProfile.Options).pipe(
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

const renderAdmissionSnapshotLines = (snapshot: AdmissionSnapshot, nowMillis: number): ReadonlyArray<string> => [
  `admission capacity: ${snapshot.activeTokens}/${snapshot.capacityTokens} tokens (MemAvailable ${snapshot.memAvailableGib.toFixed(1)} GiB${snapshot.hardFloorEngaged ? ", HARD FLOOR ENGAGED" : ""})`,
  ...A.map(snapshot.leases, (lease) => {
    const suspect =
      nowMillis - lease.heartbeatAtMillis > AdmissionConfig.make({}).suspectAfterSeconds * 1000
        ? " [suspect: heartbeat stale]"
        : "";
    const runScope = pipe(
      O.fromUndefinedOr(lease.runScope),
      O.map((scope) => {
        const peak = pipe(
          O.fromUndefinedOr(scope.memoryPeakBytes),
          O.map((bytes) => ` peak=${bytes} bytes`),
          O.getOrElse(() => "")
        );
        return ` scope=${scope.unitName} support=${scope.support}${peak}`;
      }),
      O.getOrElse(() => "")
    );
    return `- lease pid ${lease.pid} ${lease.kind}(${lease.weightTokens}) ${lease.checkoutRoot} @ ${lease.branch} since ${lease.startedAt}${runScope}${suspect}`;
  }),
  ...A.map(
    snapshot.tickets,
    (ticket) =>
      `- queued pid ${ticket.pid} ${ticket.kind}(${ticket.weightTokens}) ${ticket.checkoutRoot} @ ${ticket.branch}`
  ),
  ...A.map(snapshot.dead, (path) => `- dead: ${path}`),
  ...A.map(snapshot.quarantined, (path) => `- quarantined: ${path}`),
];

/**
 * Render admission status lines, including run-scope details per lease.
 *
 * **Example** (Render an empty snapshot)
 *
 * ```ts
 * import { AdmissionSnapshot } from "@beep/repo-cli/test/RepoRun"
 * import { renderAdmissionSnapshotLinesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const snapshot = AdmissionSnapshot.make({
 *   capacityTokens: 10, activeTokens: 0, memAvailableGib: 64, hardFloorEngaged: false,
 *   leases: [], tickets: [], dead: [], quarantined: [],
 * })
 * console.log(renderAdmissionSnapshotLinesForTesting(snapshot, 0)[0]) // "admission capacity: 0/10 tokens (MemAvailable 64.0 GiB)"
 * ```
 *
 * @param snapshot - Admission snapshot to render.
 * @param nowMillis - Current time used to flag stale heartbeats.
 * @returns Operator-facing status lines.
 * @category testing
 * @since 0.0.0
 */
export const renderAdmissionSnapshotLinesForTesting: {
  (snapshot: AdmissionSnapshot, nowMillis: number): ReadonlyArray<string>;
  (nowMillis: number): (snapshot: AdmissionSnapshot) => ReadonlyArray<string>;
} = dual(2, renderAdmissionSnapshotLines);

const schedulerStatusCommand = Command.make(
  "status",
  {
    json: Flag.boolean("json").pipe(Flag.withDescription("Emit the admission snapshot as JSON")),
  },
  Effect.fn(function* ({ json }) {
    const snapshot = yield* admissionStatus();
    if (json) {
      const rendered = yield* jsonStringifyPretty(snapshot);
      yield* printLines([rendered]);
      return;
    }
    const nowMillis = yield* Clock.currentTimeMillis;
    yield* printLines(renderAdmissionSnapshotLines(snapshot, nowMillis));
  })
).pipe(Command.withDescription("Show machine-wide admission capacity, leases, and queue"));

const reconcileCurrentCheckoutAttemptJournals = Effect.fn("Quality.reconcileCurrentCheckoutAttempts")(function* () {
  const repoRoot = yield* findRepoRoot().pipe(QualityScriptCommandError.mapError("Failed to locate repository root."));
  return yield* reconcileAttemptJournalsForCheckout(repoRoot);
});

const schedulerReapCommand = Command.make(
  "reap",
  {
    apply: Flag.boolean("apply").pipe(
      Flag.withDescription("Actually remove dead admission state (default: dry-run report)")
    ),
  },
  Effect.fn(function* ({ apply }) {
    const snapshot = yield* reapAdmissionState({ apply });
    const reconciledAttempts = apply ? yield* reconcileCurrentCheckoutAttemptJournals() : 0;
    const deadLines = A.map(snapshot.dead, (path) => `- ${path}`);
    yield* printLines([
      apply ? "reaped dead admission state:" : "dry run — would reap:",
      ...(A.length(deadLines) === 0 ? ["(nothing dead)"] : deadLines),
      ...(apply ? [`reconciled owner-dead attempts: ${reconciledAttempts}`] : []),
    ]);
  })
).pipe(
  Command.withDescription(
    "Reap dead admission state and reconcile this checkout's attempts when applied (dry-run by default)"
  )
);

const schedulerProtocolCommand = Command.make(
  "protocol",
  {
    enableEvictions: Flag.boolean("enable-evictions").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Enable v2 eviction rows after every live checkout runs the preservation release")
    ),
    disableEvictions: Flag.boolean("disable-evictions").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Disable v2 eviction rows while mixed fleet revisions may still rewrite the journal")
    ),
  },
  Effect.fn(function* ({ disableEvictions, enableEvictions }) {
    if (disableEvictions && enableEvictions) {
      return yield* QualityScriptCommandError.make({
        message: "Choose only one of --enable-evictions or --disable-evictions.",
        command: "bun run beep quality scheduler protocol",
        exitCode: 1,
      });
    }
    const protocol = enableEvictions
      ? yield* setAdmissionEvictionProtocol("on")
      : disableEvictions
        ? yield* setAdmissionEvictionProtocol("off")
        : yield* admissionProtocolStatus();
    yield* printLines([
      `admission eviction rows: ${protocol.eviction}`,
      "Enable only after every live checkout runs the preservation release.",
    ]);
  })
).pipe(Command.withDescription("Inspect or change the mixed-checkout eviction-row protocol gate"));

const schedulerReconcileAttemptsCommand = Command.make(
  "reconcile-attempts",
  {},
  Effect.fn(function* () {
    const reconciled = yield* reconcileCurrentCheckoutAttemptJournals();
    yield* printLines([`reconciled owner-dead attempts: ${reconciled}`]);
  })
).pipe(Command.withDescription("Close unfinished attempt starts whose PID/start-time owner is dead"));

const qualitySchedulerCommand = Command.make("scheduler", {}, () =>
  printLines([
    "Quality scheduler commands:",
    "- bun run beep quality scheduler status",
    "- bun run beep quality scheduler status --json",
    "- bun run beep quality scheduler reap",
    "- bun run beep quality scheduler reap --apply",
    "- bun run beep quality scheduler protocol",
    "- bun run beep quality scheduler protocol --enable-evictions",
    "- bun run beep quality scheduler protocol --disable-evictions",
    "- bun run beep quality scheduler reconcile-attempts",
    "Eviction rows default off; enable only after every live checkout runs the preservation release.",
  ])
).pipe(
  Command.withDescription("Inspect and repair machine-wide quality admission"),
  Command.withSubcommands([
    schedulerStatusCommand,
    schedulerReapCommand,
    schedulerProtocolCommand,
    schedulerReconcileAttemptsCommand,
  ])
);

const renderTmpfsCandidateLine = (candidate: TmpfsReapReport["candidates"][number]): string => {
  const bytes = pipe(
    O.fromUndefinedOr(candidate.bytes),
    O.map((value) => ` bytes=${value}`),
    O.getOrElse(() => "")
  );
  const skip = pipe(
    O.fromUndefinedOr(candidate.skipReason),
    O.map((reason) => ` reason=${reason}`),
    O.getOrElse(() => "")
  );
  const root = pipe(
    O.fromUndefinedOr(candidate.root),
    O.map((value) => ` root=${value}`),
    O.getOrElse(() => "")
  );
  return `- ${candidate.action} class=${candidate.reapClass}${root} age=${candidate.ageHours.toFixed(1)}h refs=${candidate.refCount}${bytes}${skip} ${candidate.path}`;
};

const renderTmpfsReportLines = (report: TmpfsReapReport, apply: boolean): ReadonlyArray<string> => [
  apply
    ? "TMPFS REAP APPLY — removing only classified, idle artifacts with zero live references"
    : "TMPFS REAP DRY RUN — nothing will be removed; pass --apply to reap eligible artifacts",
  `scratch roots: ${A.join(
    O.getOrElse(O.fromUndefinedOr(report.tmpRoots), () => [report.tmpRoot]),
    ", "
  )}`,
  ...A.map(report.candidates, renderTmpfsCandidateLine),
  `totals: candidates=${A.length(report.candidates)} reaped=${report.reapedCount} reclaimed-bytes=${report.reclaimedBytes}`,
  ...A.map(report.warnings, (warning) => `warning: ${warning}`),
];

/**
 * Render the operator-facing tmpfs janitor report without running the command.
 *
 * **Example** (Render a dry-run report)
 *
 * ```ts
 * import { TmpfsReapReport } from "@beep/repo-cli/test/RepoRun"
 * import { renderTmpfsReportLinesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const report = TmpfsReapReport.make({
 *   scannedAt: "2026-08-30T12:00:00.000Z", tmpRoot: "/tmp", applied: false,
 *   candidates: [], reapedCount: 0, reclaimedBytes: 0, warnings: [],
 * })
 * console.log(renderTmpfsReportLinesForTesting(report, false)[1]) // "scratch roots: /tmp"
 * ```
 *
 * @param report - Completed janitor report to render.
 * @param apply - Whether the command was invoked in apply mode.
 * @returns Operator-facing summary, candidate, total, and warning lines.
 * @category testing
 * @since 0.0.0
 */
export const renderTmpfsReportLinesForTesting: {
  (report: TmpfsReapReport, apply: boolean): ReadonlyArray<string>;
  (apply: boolean): (report: TmpfsReapReport) => ReadonlyArray<string>;
} = dual(2, renderTmpfsReportLines);

const tmpfsReapCommand = Command.make(
  "tmpfs-reap",
  {
    apply: Flag.boolean("apply").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Apply eligible removals (default: loud dry-run only)")
    ),
    json: Flag.boolean("json").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Emit the encoded tmpfs-reap/v1 report as JSON")
    ),
  },
  Effect.fn(function* ({ apply, json }) {
    const report = yield* runTmpfsReap({ apply });
    if (json) {
      const encoded = yield* S.encodeUnknownEffect(TmpfsReapReport)(report);
      yield* printLines([yield* jsonStringifyPretty(encoded)]);
      return;
    }
    yield* printLines(renderTmpfsReportLines(report, apply));
  })
).pipe(
  Command.withDescription(
    "Dry-run-first janitor for idle artifacts under /tmp and a distinct absolute TMPDIR; includes Vitest forks scratch and dangling worktree stubs"
  )
);

/**
 * Quality command group for repo operational checks.
 *
 * **Example** (Run a quality command)
 *
 * ```ts
 * console.log("qualityCommand")
 * ```
 *
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
    "- bun run beep quality test-tsgo",
    "- bun run beep quality tsgo-smoke",
    "- bun run beep quality tsgo-rules",
    "- bun run beep quality jsdoc-module-tags",
    "- bun run beep quality jsdoc-inventory",
    "- bun run beep quality jsdoc-quality",
    "- bun run beep quality jsdoc-ratchet",
    "- bun run beep quality jsdoc-ratchet --write-baseline",
    "- bun run beep quality jsdoc-migrate extract",
    "- bun run beep quality jsdoc-migrate apply --dry-run --synthetic-titles",
    "- bun run beep quality knip",
    "- bun run beep quality knip --write-baseline",
    "- bun run beep quality turbo-config-proof --base origin/main --head HEAD",
    "- bun run beep quality profile detect",
    "- bun run beep quality tmpfs-reap [--apply] [--json]",
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
    testTsgoCommand,
    testTsgoPackageCommand,
    tsgoSmokeCommand,
    tsgoRulesCommand,
    jsdocModuleTagsCommand,
    jsdocInventoryCommand,
    jsdocQualityCommand,
    jsdocRatchetCommand,
    jsdocMigrateCommand,
    knipCommand,
    turboConfigProofCommand,
    qualityProfileCommand,
    qualitySchedulerCommand,
    tmpfsReapCommand,
    packageVerifyCommand,
    changesetGraphCommand,
    changesetStatusCommand,
    qualityFallowCommand,
  ])
);
