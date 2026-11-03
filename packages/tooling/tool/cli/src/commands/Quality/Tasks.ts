/**
 * Canonical quality task adapter for repo root and workspace package scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { GlobSet } from "@beep/glob/GlobSet";
import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { findRepoRoot, insertEndOfOptions } from "@beep/repo-utils";
import { enumerate } from "@beep/repo-workspaces/internal/enumerate";
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as Inspectable from "effect/Inspectable";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { REPO_CLI_ENTRY_PATH } from "../../internal/cli/EntryPath.ts";
import {
  canUseTurboCacheSecretSession,
  configStringEqualsSync,
  configStringOption,
  isCiSync,
  isUnresolvedSecretReference,
  readTurboCacheEnvironmentSync,
  renderTurboEnvironmentHealthWarnings,
  turboEnvExtendsAmbient,
  turboEnvironmentHealthWarnings,
  turboEnvOverrides,
  turboSecretSessionStep,
} from "../../internal/cli/EnvConfig.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import {
  hasRemoteTurboCacheArgs,
  isTurboCacheControlArg,
  localOnlyTurboCacheArgs,
  resolveTurboCachePlan,
  turboCacheEnvironmentNeedsSecretSession,
  turboCachePlanArgs,
  turboCachePlanNeedsSecretSession,
} from "../../internal/cli/TurboCache.ts";
import { coverageEnvironment } from "./internal/CoverageEnvironment.ts";
import type { Git } from "@beep/git/Git";

export { coverageProducerEnvironment } from "./internal/CoverageEnvironment.ts";

import { manifestParser } from "../../internal/ManifestRead.ts";
import {
  CapturedStep,
  formatCommandLine,
  OutputBound,
  QualityTaskStep,
  qualityStepOutputBound,
  repoRunOutputBound,
  runCaptured,
  runToExit,
} from "../../internal/process/index.ts";
import { collectChangedFiles, collectDirtyWorktreeFiles } from "../../internal/repo-run/ChangedFiles.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { PosInt } from "../../internal/schema/PosInt.ts";
import { assertCacheRuntimeKeyUnspecified, cacheRuntimeStep } from "../Cache/Cache.runtime.step.ts";
import { CoverageProducerIdentity, resolveCoverageProducerIdentity } from "./internal/CoverageArtifacts.ts";
import {
  cleanCoverageRegressionOutputs,
  compareCoverageRegressionBaseline,
  coverageBaselineRowDeltaFromBase,
  coverageRegressionBaselinePath,
  writeCoverageRegressionBaseline,
} from "./internal/CoverageRegression.ts";
import {
  CoverageScopeOwner,
  coverageScopeWeightSeconds,
  planCoverageFullShards,
  planWorkspaceCoverageAffectedScope,
  workspaceCoverageScopeOwners,
} from "./internal/CoverageScope.ts";
import { DOCS_OXLINT_CONFIG, prepareDocsOxlintConfig } from "./internal/DocsOxlintPlugin.ts";
import {
  detectNoLocationTs2589Flake,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifact,
  FlakeQuarantineArtifactJson,
  FlakeQuarantineIncident,
  flakeQuarantineOutputBound,
  laneQuarantineRerunStep,
  MAX_QUARANTINED_TASKS_PER_LANE,
  standaloneQuarantineRerunStep,
} from "./internal/FlakeQuarantine.ts";
import {
  explainLaneProofRefusal,
  hasReusableLaneProof,
  persistLaneProofs,
  prepareLaneProofSession,
  renderLaneProofRefusal,
} from "./internal/LaneProofReuse.ts";
import {
  LINT_POLICY_TARGET_TASKS,
  LintPolicyFullScope,
  LintPolicyScope,
  lintPolicyAffectedTargetsFromDryRun,
  resolveLintPolicyScope,
} from "./internal/LintPolicyScope.ts";
import {
  appendTurboLaneLedger,
  closeTurboLaneLedger,
  readTurboLaneDigest,
  readTurboLaneLedger,
  TURBO_LANE_LEDGER_ENV,
  turboLaneDigestCacheable,
  turboLaneDigestPackages,
} from "./internal/TurboLaneDigest.ts";
import { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Quality.errors.ts";
import { localQualityConcurrencyPlan, provideQualityConcurrency, qualityConcurrencyPlan } from "./Quality.plan.ts";
import {
  GatePrecisionClass,
  GateRedSchedulingDecision,
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckFailurePolicy,
  GithubCheckLaneIsolation,
  GithubCheckLaneRun,
  GithubCheckLaneRunStatus,
  GithubCheckMode,
  GithubCheckRunReport,
  LintPolicySubcommand,
  LintPolicySweeps,
  PackageTaskProfile,
  QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
  QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
  QUALITY_TASK_LANE_RUN_REPORT_PREFIX,
  QualityTaskBypassArgName,
  QualityTaskInvocation,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
  QualityTaskName,
  RootAuditMode,
} from "./Quality.schemas.ts";
import type { GlobPatternError } from "@beep/glob/GlobPattern";
import type { LenientManifest } from "@beep/package-json/LenientManifest";
import type { DomainError, NoSuchFileError } from "@beep/repo-utils";
import type { EnumerationFailure } from "@beep/repo-workspaces/internal/enumerate";
import type { PgliteTestcontainerResource } from "@beep/test-utils";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type * as Scope from "effect/Scope";
import type { CaptureCommandTimedOutError } from "../../internal/process/index.ts";
import type { CoverageBaselineRowDelta } from "./internal/CoverageScope.ts";
import type { FlakeQuarantineTask } from "./internal/FlakeQuarantine.ts";
import type { LaneProofSession } from "./internal/LaneProofReuse.ts";
import type { LintPolicyAffectedTargets } from "./internal/LintPolicyScope.ts";
import type { TurboLaneDigest } from "./internal/TurboLaneDigest.ts";
import type { UnexpectedQualityTaskFailure } from "./Quality.errors.ts";
import type { GithubCheckLaneSpec, GithubCheckLaneWaveSpec, QualityConcurrencyPlan } from "./Quality.schemas.ts";

export { QualityTaskStep } from "../../internal/process/index.ts";
/**
 * Public quality task error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export {
  QualityTaskConfigurationError,
  QualityTaskFailed,
  QualityTaskGroupFailed,
  UnexpectedQualityTaskFailure,
} from "./Quality.errors.ts";

const CHANGED_PATH_DIFF_FILTER = A.join(["A", "C", "M", "R", "T", "U", "X", "B"], "");
const LOCAL_BIOME_BIN = "./node_modules/.bin/biome";
const BIOME_FIX_CHANGED_ARGS = ["check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched"] as const;
const LINT_FIX_AGGREGATE_ARGS = ["--full", "--repo"] as const;
// The root build/check/test/lint graphs take their width from the resolved
// concurrency plan (`Quality.plan.ts`): the `ci` profile is the heavy-fleet cap,
// local profiles widen with the detected hardware. Coverage keeps its own fixed
// caps below because its worker topology is the ratchet's baseline shape.
// Hosted runners died ("runner lost communication") under turbo's default concurrency
// (~10) stacking multi-GB tsgo processes on the smallest hosted machines; see
// goals/quality-speedup/research/instantiation-census.md §5. The heavy lanes now
// run on 32GB beep-ec2-heavy fleet workers, so the cap is back to the 8vCPU
// tuning; the 16GB-survival value was 2.
const CI_TURBO_CONCURRENCY_ARG = "--concurrency=4";
const ROOT_COVERAGE_TURBO_CONCURRENCY_ARG = "--concurrency=3";
// Ten weighted shards keep the work inside one fleet job while shortening the
// mixed package tail that controlled the rejected nine-shard live run. The
// serial-import-heavy repo-cli long pole retains two Vitest workers; repo-utils
// and the eight mixed shards use one each, bounding aggregate test-process
// fan-out at 11 on the 8-vCPU runner.
const COVERAGE_FULL_SHARD_COUNT = 10;
const COVERAGE_FULL_TWO_WORKER_PACKAGE_NAMES = ["@beep/repo-cli"] as const;
// repo-cli deliberately disables file parallelism for ordinary package runs,
// but serial imports consumed 728.76 seconds in the rejected live coverage
// candidate. Every coverage producer — the full shards, scoped baseline writes,
// and the narrow ratchet invocation — derives its Vitest topology from
// `coverageVitestTopologyArgs`, so a row a writer records is measured under the
// same worker shape the lane that judges it uses.
const COVERAGE_FULL_VITEST_FILE_PARALLELISM_ARG = "--fileParallelism=true";
const COVERAGE_FULL_VITEST_LONG_POLE_MAX_WORKERS_ARG = "--maxWorkers=2";
const COVERAGE_FULL_VITEST_MIXED_MAX_WORKERS_ARG = "--maxWorkers=1";
const COVERAGE_FULL_VITEST_WORKER_CAP = 11;
// Planner weight (sequential seconds) above which a selected scope runs through
// the weighted shard executor instead of one Turbo invocation. The 45 hosted
// scoped jobs in the 2026-08-24 sweep all finished under 300 s wall-clock on
// the single-invocation path; dependents widen selections well past that
// (`@beep/md` alone pulls 17 owners including `@beep/professional-desktop`),
// where the full run's prebuild + capped-worker shards are the proven shape.
const COVERAGE_SELECTED_SINGLE_RUN_MAX_WEIGHT_SECONDS = 300;
const COVERAGE_WRITE_BASELINE_ARG = "--write-baseline";
const COVERAGE_REPLACE_ALL_ARG = "--replace-all";
// A single lost child-exit signal must fail with the command name while the
// workflow still has time to report and clean up. The longest healthy policy
// child is under eight minutes on the hosted heavy runner.
const QUALITY_CAPTURE_TIMEOUT_MILLIS = PosInt.make(Duration.toMillis("15 minutes"));
const QUALITY_CAPTURE_FORCE_KILL_AFTER: Duration.Input = "5 seconds";
const QUALITY_CAPTURE_TIMEOUT_EXIT_CODE = 124;

const capturedTimeoutResult = (error: CaptureCommandTimedOutError): CapturedStep =>
  CapturedStep.make({
    exitCode: QUALITY_CAPTURE_TIMEOUT_EXIT_CODE,
    output: error.message,
    truncated: false,
  });

type QualityTaskEnvironment =
  | Digest.Digest
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Git;

type OptionalQualityTaskStep = {
  readonly enabled: boolean;
  readonly step: () => QualityTaskStep;
};

type QualityTaskStepOutput = {
  readonly command: string;
  readonly exitCode: number;
  readonly output: string;
  readonly step: QualityTaskStep;
};

type ParsedFixArgsState = {
  readonly fix: boolean;
  readonly args: ReadonlyArray<string>;
};

type TestLaneSelectionState = {
  readonly unit: boolean;
  readonly integration: boolean;
  readonly args: ReadonlyArray<string>;
};

type WorkspaceTaskOwner = {
  readonly packageName: string;
  readonly packageDir: string;
  readonly scripts: Readonly<Record<string, string>>;
};

type RootAuditSelectionState = {
  readonly mode: RootAuditMode;
  readonly args: ReadonlyArray<string>;
};

type CoverageTaskOptions = {
  readonly topologyPackageNames?: ReadonlyArray<string>;
  readonly args: ReadonlyArray<string>;
  readonly expectedPackageNames: ReadonlyArray<string>;
  readonly replaceAll: boolean;
  readonly scoped: boolean;
  readonly skip: boolean;
  readonly writeBaseline: boolean;
};

const emptyParsedFixArgs: ParsedFixArgsState = {
  fix: false,
  args: A.empty<string>(),
};

const emptyTestLaneSelection: TestLaneSelectionState = {
  unit: false,
  integration: false,
  args: A.empty<string>(),
};

const profileByTask: Readonly<Record<QualityTaskName, PackageTaskProfile>> = {
  build: PackageTaskProfile.make({ task: QualityTaskName.Enum.build, script: "beep:build" }),
  check: PackageTaskProfile.make({ task: QualityTaskName.Enum.check, script: "beep:check" }),
  test: PackageTaskProfile.make({ task: QualityTaskName.Enum.test, script: "beep:test" }),
  lint: PackageTaskProfile.make({ task: QualityTaskName.Enum.lint, script: "beep:lint", fixScript: "beep:lint:fix" }),
  audit: PackageTaskProfile.make({ task: QualityTaskName.Enum.audit, script: "beep:audit" }),
  coverage: PackageTaskProfile.make({ task: QualityTaskName.Enum.coverage, script: "coverage" }),
};

const isQualityTaskName = S.is(QualityTaskName);
const isLintPolicySubcommandName = S.is(LintPolicySubcommand);
const isExactQualityTaskBypassArgName = S.is(QualityTaskBypassArgName);
const isRootAuditMode = S.is(RootAuditMode);

const isLintPolicySubcommand = (value: string | undefined): boolean =>
  value !== undefined && isLintPolicySubcommandName(value);

const isQualityTaskBypassArg = (arg: string): boolean =>
  isExactQualityTaskBypassArgName(arg) ||
  A.some(QualityTaskBypassArgName.literals, (name) => Str.startsWith(`${name}=`)(arg));

const hasQualityTaskBypassArg = (argv: ReadonlyArray<string>): boolean => A.some(argv, isQualityTaskBypassArg);

const isGithubCheckMode = S.is(GithubCheckMode);

const stripPassthroughDelimiter = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    A.head(args),
    O.filter((arg) => arg === "--"),
    O.map(() => A.drop(args, 1)),
    O.getOrElse(() => args)
  );

const parseFixArgs = (args: ReadonlyArray<string>): ParsedFixArgsState =>
  A.reduce(stripPassthroughDelimiter(args), emptyParsedFixArgs, (parsed, arg) =>
    arg === "--fix" ? { ...parsed, fix: true } : { ...parsed, args: pipe(parsed.args, A.append(arg)) }
  );

const parseTestLaneSelection = (args: ReadonlyArray<string>): TestLaneSelectionState => {
  const selected = A.reduce(stripPassthroughDelimiter(args), emptyTestLaneSelection, (lanes, arg) =>
    Match.value(arg).pipe(
      Match.when("--unit", () => ({ ...lanes, unit: true })),
      Match.when("--integration", () => ({ ...lanes, integration: true })),
      Match.orElse(() => ({ ...lanes, args: pipe(lanes.args, A.append(arg)) }))
    )
  );
  const hasLane = selected.unit || selected.integration;
  return {
    unit: hasLane ? selected.unit : true,
    integration: hasLane ? selected.integration : true,
    args: selected.args,
  };
};

/**
 * Resolve which unit/integration lanes a root `test` invocation selects.
 * Exposed for focused unit tests.
 *
 * **Example** (Both lanes run when neither flag is passed)
 *
 * ```ts
 * import { parseTestLaneSelectionForTesting } from "@beep/repo-cli/commands/Quality/Tasks"
 *
 * console.log(parseTestLaneSelectionForTesting(["--concurrency=2"]))
 * // { unit: true, integration: true, args: ["--concurrency=2"] }
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseTestLaneSelectionForTesting = parseTestLaneSelection;

const parseRootAuditSelection = (args: ReadonlyArray<string>): RootAuditSelectionState =>
  A.match(stripPassthroughDelimiter(args), {
    onEmpty: () => ({
      mode: "packages",
      args: A.empty<string>(),
    }),
    onNonEmpty: ([head, ...tail]) => {
      if (isRootAuditMode(head)) {
        return {
          mode: head,
          args: tail,
        };
      }

      if (isGithubCheckMode(head)) {
        return {
          mode: "github",
          args: [head, ...tail],
        };
      }

      return {
        mode: "packages",
        args: [head, ...tail],
      };
    },
  });

const parsePackageJson = manifestParser(["name", "scripts"]);

/**
 * Read a quality-task `package.json` text: its `name` and `scripts`, each of
 * which must keep its JSON shape when present.
 *
 * **Details**
 *
 * Strict JSON only: JSONC text fails. The root's workspace patterns are not
 * read here: `workspaceTaskOwners` takes them from `@beep/repo-workspaces`
 * `WorkspacePatterns` (4-A2).
 *
 * **Example** (Read a package's scripts)
 *
 * ```ts
 * import { readQualityTaskManifest } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = Effect.runSync(readQualityTaskManifest('{"name":"@beep/demo","scripts":{"check":"tsc"}}', "package.json"))
 * console.log(manifest.scripts) // { check: "tsc" }
 * ```
 *
 * @param content - `package.json` text.
 * @param filePath - Path named in a failure.
 * @returns The manifest through `LenientManifest`.
 * @category parsing
 * @since 0.0.0
 */
export const readQualityTaskManifest = Effect.fn("QualityTasks.readQualityTaskManifest")(function* (
  content: string,
  filePath: string
): Effect.fn.Return<LenientManifest, QualityTaskConfigurationError> {
  return yield* parsePackageJson(content).pipe(QualityTaskConfigurationError.mapError(`Failed to parse ${filePath}`));
});

const readPackageJsonFile = Effect.fn("QualityTasks.readPackageJsonFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(QualityTaskConfigurationError.mapError(`Failed to read ${filePath}`));

  return yield* readQualityTaskManifest(content, filePath);
});

const resolvePackageDir = Effect.fn("QualityTasks.resolvePackageDir")(function* (
  repoRoot: string,
  cwd: string
): Effect.fn.Return<O.Option<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(repoRoot);

  const findPackageDir: (current: string) => Effect.Effect<O.Option<string>, QualityTaskConfigurationError> = Effect.fn(
    "QualityTasks.findPackageDir"
  )(function* (current): Effect.fn.Return<O.Option<string>, QualityTaskConfigurationError> {
    const packageJsonPath = path.join(current, "package.json");
    const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(thunkFalse));

    if (exists) {
      return current === root ? O.none() : O.some(current);
    }

    if (current === root) {
      return O.none();
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return yield* QualityTaskConfigurationError.new(`Could not find package.json between ${cwd} and ${repoRoot}.`);
    }
    return yield* findPackageDir(parent);
  });

  return yield* findPackageDir(path.resolve(cwd));
});

const isSafeWorkspacePattern = (pattern: string): boolean =>
  pattern.length > 0 &&
  !Str.startsWith("/")(pattern) &&
  !A.some(Str.split("/")(pattern), (segment) => segment === "..");

const isWorkspaceExclusion = Str.startsWith("!");

const invalidWorkspacePattern = (error: GlobPatternError): QualityTaskConfigurationError =>
  QualityTaskConfigurationError.new(`Invalid workspace pattern "${error.pattern}": ${error.message}`);

const unenumerableWorkspacePattern = (failure: EnumerationFailure): QualityTaskConfigurationError =>
  QualityTaskConfigurationError.new(
    `Failed to enumerate workspace pattern "${failure.pattern}" (${failure.kind}: ${failure.detail})`
  );

const workspaceCandidateDirsForPattern = Effect.fn("QualityTasks.workspaceCandidateDirsForPattern")(function* (
  repoRoot: string,
  pattern: string
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  if (!isSafeWorkspacePattern(pattern)) {
    return yield* QualityTaskConfigurationError.new(
      `Unsafe workspace pattern "${pattern}" escapes the repository root.`
    );
  }

  const compiled = yield* GlobPattern.compile(pattern).pipe(Effect.mapError(invalidWorkspacePattern));
  // Only a pattern naming exactly one path is a literal member; a brace list
  // without wildcards (`packages/{api,web}`) has no magic but names several.
  if (O.isSome(compiled.literalPath)) {
    return [path.join(repoRoot, compiled.literalPath.value)];
  }

  // `dir/*` over a literal `dir` keeps its one-level read and its failure text.
  if (Str.endsWith("/*")(pattern) && compiled.enumerationPrefix === Str.slice(0, -1)(pattern)) {
    const base = path.join(repoRoot, Str.slice(0, -2)(pattern));
    const entries = yield* fs
      .readDirectory(base)
      .pipe(
        Effect.mapError(() =>
          QualityTaskConfigurationError.make({ message: `Failed to read workspace directory ${base}` })
        )
      );

    return A.map(entries, (entry) => path.join(base, entry));
  }

  // Any other pattern (`packages/**`, `apps/*/web`, braces) walks through the
  // workspace enumerator `WorkspaceDiscovery` uses, bounded and pruned.
  const globs = yield* GlobSet.compile([pattern]).pipe(Effect.mapError(invalidWorkspacePattern));
  const directories = yield* enumerate(repoRoot, globs).pipe(Effect.mapError(unenumerableWorkspacePattern));
  return A.map(directories, (directory) => directory.path);
});

const workspaceTaskOwners = Effect.fn("QualityTasks.workspaceTaskOwners")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<WorkspaceTaskOwner>,
  QualityTaskConfigurationError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const patterns = yield* WorkspacePatterns.read(repoRoot).pipe(
    QualityTaskConfigurationError.mapError(`Failed to read workspace patterns under ${repoRoot}`)
  );
  // A `!pattern` entry excludes, as pnpm and the package managers read it: it
  // contributes no candidates and removes every candidate it matches.
  const { excludes } = yield* GlobSet.compile(patterns).pipe(Effect.mapError(invalidWorkspacePattern));
  const isExcludedDir = (packageDir: string): boolean => {
    const relativeDir = path.relative(repoRoot, packageDir);
    return A.some(excludes, (exclude) => exclude.matches(relativeDir));
  };
  const candidateDirs = yield* Effect.forEach(
    A.filter(patterns, P.not(isWorkspaceExclusion)),
    (pattern) => workspaceCandidateDirsForPattern(repoRoot, pattern),
    { concurrency: 4 }
  );

  const owners = yield* Effect.forEach(
    pipe(A.flatten(candidateDirs), A.filter(P.not(isExcludedDir)), A.dedupe, A.sort(Order.String)),
    Effect.fn(function* (packageDir) {
      const packageJsonPath = path.join(packageDir, "package.json");
      const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(thunkFalse));
      if (!exists) {
        return O.none<WorkspaceTaskOwner>();
      }

      const packageJson = yield* readPackageJsonFile(packageJsonPath);
      if (packageJson.name === undefined) {
        return O.none<WorkspaceTaskOwner>();
      }

      return O.some({
        packageName: packageJson.name,
        packageDir,
        scripts: packageJson.scripts ?? {},
      });
    }),
    { concurrency: 8 }
  );

  return pipe(
    owners,
    A.getSomes,
    A.sort(Order.mapInput(Order.String, (owner: WorkspaceTaskOwner) => owner.packageName))
  );
});

const ownerDefinesScript =
  (script: string) =>
  (owner: WorkspaceTaskOwner): boolean =>
    pipe(owner.scripts, R.get(script), O.isSome);

const ownerFilter = (owner: WorkspaceTaskOwner): string => `--filter=${owner.packageName}`;

const workspaceTaskFilters = Effect.fn("QualityTasks.workspaceTaskFilters")(function* (
  repoRoot: string,
  script: string
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const owners = yield* workspaceTaskOwners(repoRoot);

  return pipe(owners, A.filter(ownerDefinesScript(script)), A.map(ownerFilter));
});

const SPLIT_INTEGRATION_SCRIPTS = ["test:integration:parallel", "test:integration:serial"];

// Packages that predate the parallel/serial integration split still ship a plain
// `test:integration`; without this bucket they would be silently dropped from the
// root integration lane instead of running alongside the bounded-parallel packages.
const unsplitIntegrationTaskFilters = Effect.fn("QualityTasks.unsplitIntegrationTaskFilters")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const owners = yield* workspaceTaskOwners(repoRoot);

  return pipe(
    owners,
    A.filter(
      (owner) =>
        ownerDefinesScript("test:integration")(owner) &&
        !A.some(SPLIT_INTEGRATION_SCRIPTS, (script) => ownerDefinesScript(script)(owner))
    ),
    A.map(ownerFilter)
  );
});

const requireWorkspaceTaskFilters = Effect.fn("QualityTasks.requireWorkspaceTaskFilters")(function* (
  repoRoot: string,
  script: string
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const filters = yield* workspaceTaskFilters(repoRoot, script);
  if (A.isReadonlyArrayEmpty(filters)) {
    return yield* QualityTaskConfigurationError.new(`No workspace packages define ${script}.`);
  }

  return filters;
});

const workspaceTaskArgs = Effect.fn("QualityTasks.workspaceTaskArgs")(function* (
  repoRoot: string,
  script: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  if (A.some(args, isExplicitTurboAffectedOrScopeArg)) {
    return args;
  }

  const filters = yield* requireWorkspaceTaskFilters(repoRoot, script);
  return [...filters, ...args];
});

/**
 * Resolve Turbo filters for workspace packages that define a script.
 * Exposed for focused unit tests of root quality orchestration.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { workspaceTaskFiltersForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const result = workspaceTaskFiltersForTesting("@beep/repo-cli")
 * console.log(result) // rendered command output
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const workspaceTaskFiltersForTesting = workspaceTaskFilters;

const commandText = formatCommandLine;

const isTurboConcurrencyArg = (arg: string): boolean =>
  arg === "--concurrency" || Str.startsWith("--concurrency=")(arg);

// The serial integration phase always pins --concurrency=1 (shared-SQL tests
// serialize by design); a caller-supplied concurrency flag would reach turbo
// twice, which it rejects as a duplicate argument.
const withoutTurboConcurrencyArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isTurboConcurrencyArg(arg)
);

const isExplicitTurboScopeArg = (arg: string): boolean =>
  Str.startsWith("--filter")(arg) || Str.startsWith("--since")(arg);

const isExplicitTurboAffectedOrScopeArg = (arg: string): boolean =>
  arg === "--affected" || isExplicitTurboScopeArg(arg);

const TURBO_FILTER_ARG = "--filter";
const TURBO_FILTER_ARG_PREFIX = `${TURBO_FILTER_ARG}=`;

const inlineTurboFilterValue = (arg: string): O.Option<string> =>
  pipe(
    O.liftPredicate(Str.startsWith(TURBO_FILTER_ARG_PREFIX))(arg),
    O.map(Str.replace(TURBO_FILTER_ARG_PREFIX, "")),
    O.filter(Str.isNonEmpty)
  );

const explicitTurboFilterValues = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const inlineValues = pipe(args, A.map(inlineTurboFilterValue), A.getSomes);
  const pairedValues = pipe(
    A.zip(args, A.drop(args, 1)),
    A.map(([arg, value]) => (arg === TURBO_FILTER_ARG && Str.isNonEmpty(value) ? O.some(value) : O.none())),
    A.getSomes
  );

  return pipe(A.appendAll(inlineValues, pairedValues), A.dedupe);
};

const isCoverageWriteBaselineArg = (arg: string): boolean => arg === COVERAGE_WRITE_BASELINE_ARG;
const isCoverageReplaceAllArg = (arg: string): boolean => arg === COVERAGE_REPLACE_ALL_ARG;

const isCoveragePassthroughDelimiter = (arg: string): boolean => arg === "--";

const stripCoverageControlArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isCoverageWriteBaselineArg(arg) && !isCoverageReplaceAllArg(arg) && !isCoveragePassthroughDelimiter(arg)
);

const coverageTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const stripped = stripCoverageControlArgs(stripPassthroughDelimiter(args));
  return A.some(stripped, isTurboConcurrencyArg)
    ? stripped
    : isCiSync()
      ? [CI_TURBO_CONCURRENCY_ARG, ...stripped]
      : [ROOT_COVERAGE_TURBO_CONCURRENCY_ARG, ...stripped];
};

const parseCoverageTaskOptions = (args: ReadonlyArray<string>): CoverageTaskOptions => {
  const stripped = stripPassthroughDelimiter(args);
  return {
    args: coverageTurboArgs(stripped),
    expectedPackageNames: A.empty<string>(),
    replaceAll: A.some(stripped, isCoverageReplaceAllArg),
    scoped: A.some(stripped, isExplicitTurboAffectedOrScopeArg),
    skip: false,
    writeBaseline: A.some(stripped, isCoverageWriteBaselineArg),
  };
};

const resolveExplicitCoveragePackageNames = Effect.fn("QualityTasks.resolveExplicitCoveragePackageNames")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const requestedPackageNames = explicitTurboFilterValues(args);
  if (A.isReadonlyArrayEmpty(requestedPackageNames)) {
    return yield* QualityTaskConfigurationError.new(
      `Scoped ${COVERAGE_WRITE_BASELINE_ARG} runs require exact --filter=<workspace-package> selectors or --affected; Turbo ranges and --since cannot provide verifier-equivalent coverage shards.`
    );
  }

  const coverageOwnerNames = pipe(
    yield* workspaceTaskOwners(repoRoot),
    A.filter(ownerDefinesScript("coverage")),
    A.map((owner) => owner.packageName)
  );
  const unsupportedSelectors = A.filter(
    requestedPackageNames,
    (packageName) => !A.contains(coverageOwnerNames, packageName)
  );
  if (A.isReadonlyArrayNonEmpty(unsupportedSelectors)) {
    return yield* QualityTaskConfigurationError.new(
      `Scoped ${COVERAGE_WRITE_BASELINE_ARG} selectors must name exact workspace packages that define coverage. Unsupported selector(s): ${A.join(unsupportedSelectors, ", ")}.`
    );
  }

  return requestedPackageNames;
});

const resolveNonAffectedCoverageTaskOptions = Effect.fn("QualityTasks.resolveNonAffectedCoverageTaskOptions")(
  function* (repoRoot: string, args: ReadonlyArray<string>, parsed: CoverageTaskOptions) {
    if (!parsed.writeBaseline || !parsed.scoped) {
      const owners = yield* workspaceCoverageScopeOwners(repoRoot);
      return { ...parsed, topologyPackageNames: coverageSelectorPackageNames(owners, explicitTurboFilterValues(args)) };
    }

    const expectedPackageNames = yield* resolveExplicitCoveragePackageNames(repoRoot, args);
    return { ...parsed, expectedPackageNames };
  }
);

// The dot dialect keeps the previous matcher's behaviour, which let `*` match a dot-leading segment;
// negation and comment prefixes stay the literal characters they were to it. `?`, `[..]`, `{a,b}`,
// `+(..)`, `\` and an in-segment `**` (`src/**.ts`) are minimatch magic here where the old compiler
// read them literally; no live pattern uses them (R2b oracle, `dialectMagic` section).
const coverageSelectorGlob = GlobPatternOptions.make({ dot: true, nonegate: true, nocomment: true });

const isResolvableCoverageSelector = S.is(
  S.String.check(S.isPattern(/^(?:\.\.\.\^?)?(?:\{\.\/[^{}![\]^]+\}|[^{}![\]^]+?)(?:\^?\.\.\.)?$/u))
);

const coverageGraphClosure = (
  owners: ReadonlyArray<CoverageScopeOwner>,
  seeds: ReadonlyArray<string>,
  dependencies: boolean
): ReadonlyArray<string> => {
  let selected = seeds;
  let frontier = seeds;
  while (A.isReadonlyArrayNonEmpty(frontier)) {
    const next = dependencies
      ? A.flatMap(
          A.filter(owners, (owner) => A.contains(frontier, owner.packageName)),
          (owner: CoverageScopeOwner) => owner.workspaceDependencies
        )
      : A.map(
          A.filter(owners, (owner) => A.some(owner.workspaceDependencies, (name) => A.contains(frontier, name))),
          (owner) => owner.packageName
        );
    frontier = A.difference(
      A.intersection(
        next,
        A.map(owners, (owner) => owner.packageName)
      ),
      selected
    );
    selected = A.union(selected, frontier);
  }
  return selected;
};

/**
 * Resolve a Turbo package or directory selector against the workspace graph.
 *
 * **Example** (Resolve an exact package)
 *
 * ```ts
 * import { resolveCoverageSelector } from "@beep/repo-cli/commands/Quality/Tasks"
 *
 * const result = resolveCoverageSelector([], "missing")
 * console.log(result._tag) // "None"
 * ```
 *
 * @param owners - Complete workspace inventory, including packages without coverage.
 * @param selector - Turbo name, name glob, or directory selector with graph operators.
 * @returns Sorted selected names, or None for unsupported or unmatched selectors.
 * @category utilities
 * @since 0.0.0
 */
export const resolveCoverageSelector: {
  (owners: ReadonlyArray<CoverageScopeOwner>, selector: string): O.Option<ReadonlyArray<string>>;
  (selector: string): (owners: ReadonlyArray<CoverageScopeOwner>) => O.Option<ReadonlyArray<string>>;
} = dual(2, (owners: ReadonlyArray<CoverageScopeOwner>, selector: string): O.Option<ReadonlyArray<string>> => {
  if (!isResolvableCoverageSelector(selector)) return O.none();
  const pattern = Str.replace(/^(?:\.\.\.\^?)|(?:\^?\.\.\.)$/gu, "")(selector);
  const directory = Str.startsWith("./")(pattern) || Str.startsWith("{./")(pattern);
  const normalized = Str.replace(/^\{?|\}$/gu, "")(pattern);
  // A selector the glob compiler rejects is unsupported, like an unmatched one.
  const compiled = GlobPattern.compileResult(Str.replace(/^\.\//u, "")(normalized), coverageSelectorGlob);
  if (Result.isFailure(compiled)) return O.none();
  const seeds = A.map(
    A.filter(owners, (owner) => compiled.success.matches(directory ? owner.packagePath : owner.packageName)),
    (owner) => owner.packageName
  );
  if (A.isReadonlyArrayEmpty(seeds)) return O.none();
  const dependencies = Str.endsWith("...")(selector) ? coverageGraphClosure(owners, seeds, true) : seeds;
  const dependents = Str.startsWith("...")(selector) ? coverageGraphClosure(owners, seeds, false) : seeds;
  const selected = A.union(dependencies, dependents);
  return O.some(A.sort(Str.contains("^")(selector) ? A.difference(selected, seeds) : selected, Order.String));
});

// Unsupported or unmatched selectors retain the conservative long-pole topology.
const coverageSelectorPackageNames = (
  owners: ReadonlyArray<CoverageScopeOwner>,
  selectors: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.isReadonlyArrayEmpty(selectors)
    ? A.map(owners, (owner) => owner.packageName)
    : pipe(
        selectors,
        A.flatMap((selector) =>
          O.getOrElse(resolveCoverageSelector(owners, selector), () => COVERAGE_FULL_TWO_WORKER_PACKAGE_NAMES)
        ),
        A.dedupe
      );

/**
 * The Vitest passthrough every coverage producer appends.
 *
 * **Details**
 *
 * Worker count is the only axis that varies, and it varies by package: the
 * serial-import long poles get two workers, everything else gets one. File
 * parallelism is always on. A baseline written under one topology and judged
 * under another produces a per-file V8 snapshot the writer's own rows cannot
 * satisfy, which is why the full shards, scoped writes, and the narrow ratchet
 * invocation all read their argv from here.
 *
 * **Example** (A long-pole selection earns two workers)
 *
 * ```ts
 * import { coverageVitestTopologyArgs } from "@beep/repo-cli/test/Quality"
 *
 * console.log(coverageVitestTopologyArgs(["@beep/repo-cli"]))
 * // [ "--", "--fileParallelism=true", "--maxWorkers=2" ]
 * ```
 *
 * @param packageNames - Coverage owners this invocation measures.
 * @returns The passthrough delimiter followed by the Vitest topology flags.
 * @category utilities
 * @since 0.0.0
 */
export const coverageVitestTopologyArgs = (packageNames: ReadonlyArray<string>): ReadonlyArray<string> => [
  "--",
  COVERAGE_FULL_VITEST_FILE_PARALLELISM_ARG,
  A.some(packageNames, (packageName) => A.contains(COVERAGE_FULL_TWO_WORKER_PACKAGE_NAMES, packageName))
    ? COVERAGE_FULL_VITEST_LONG_POLE_MAX_WORKERS_ARG
    : COVERAGE_FULL_VITEST_MIXED_MAX_WORKERS_ARG,
];

const isCoverageAffectedArg = (arg: string): boolean => arg === "--affected";
const withoutCoverageAffectedArg: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isCoverageAffectedArg(arg)
);

const isCoverageFullOwnedBooleanArg = (arg: string): boolean =>
  arg === COVERAGE_WRITE_BASELINE_ARG ||
  arg === COVERAGE_REPLACE_ALL_ARG ||
  arg === "--only" ||
  Str.startsWith("--only=")(arg) ||
  arg === "--summarize" ||
  Str.startsWith("--summarize=")(arg);

const isCoverageFullOwnedValueArg = (arg: string): boolean =>
  arg === "--concurrency" || arg === "--filter" || arg === "--since";

const isCoverageFullOwnedArg = (arg: string): boolean =>
  isCoverageAffectedArg(arg) ||
  isCoverageFullOwnedBooleanArg(arg) ||
  isCoverageFullOwnedValueArg(arg) ||
  isTurboConcurrencyArg(arg) ||
  isExplicitTurboScopeArg(arg);

const coverageFullPassthroughArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const passthrough: Array<string> = [];
  let skipValue = false;

  for (const arg of args) {
    if (skipValue && !Str.startsWith("--")(arg)) {
      skipValue = false;
      continue;
    }
    skipValue = false;
    if (isCoverageFullOwnedValueArg(arg)) {
      skipValue = true;
      continue;
    }
    if (!isCoverageFullOwnedArg(arg)) {
      passthrough.push(arg);
    }
  }

  return passthrough;
};

const resolveCoverageTaskOptions = Effect.fn("QualityTasks.resolveCoverageTaskOptions")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  baseOverride?: string
): Effect.fn.Return<CoverageTaskOptions, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const parsed = parseCoverageTaskOptions(args);
  // A scoped `--replace-all` is the deliberate re-measure path: it adopts every
  // package this run measured, and the hosted pull-request run judges every row
  // it raises.
  if (parsed.replaceAll && !parsed.writeBaseline) {
    return yield* QualityTaskConfigurationError.new(
      `${COVERAGE_REPLACE_ALL_ARG} requires ${COVERAGE_WRITE_BASELINE_ARG}; it only controls coverage baseline replacement.`
    );
  }
  if (!A.some(args, isCoverageAffectedArg)) {
    return yield* resolveNonAffectedCoverageTaskOptions(repoRoot, args, parsed);
  }
  if (A.some(args, (arg) => isExplicitTurboScopeArg(arg))) {
    return yield* QualityTaskConfigurationError.new(
      "Affected coverage cannot be combined with --filter or --since; let the coverage planner choose exact owners or a full fallback."
    );
  }

  const base = yield* (
    baseOverride === undefined ? configStringOption("TURBO_SCM_BASE") : Effect.succeedSome(baseOverride)
  ).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => QualityTaskConfigurationError.new("Affected coverage requires TURBO_SCM_BASE."),
        onSome: Effect.succeed,
      })
    )
  );
  const changedFiles = yield* collectChangedFiles(repoRoot, base, "HEAD").pipe(
    QualityTaskConfigurationError.mapError(`Failed to collect affected coverage files from ${base}...HEAD.`)
  );
  // A row-only baseline edit is validated by measuring the packages whose rows
  // changed; anything else in the document keeps the baseline a global input.
  // This line reports the diff only — the planner's own scope line below is
  // the authority on what runs, since a row can still force `full` or `noop`.
  const baselineRowPackages = A.contains(changedFiles, coverageRegressionBaselinePath)
    ? yield* coverageBaselineRowDeltaFromBase(repoRoot, base)
    : O.none<CoverageBaselineRowDelta>();
  yield* O.match(baselineRowPackages, {
    onNone: () => Effect.void,
    onSome: (delta) => {
      const rows = A.appendAll(
        A.map(delta.present, (packageName) => `${packageName} (present)`),
        A.map(delta.removed, (packageName) => `${packageName} (removed)`)
      );
      return Console.log(
        A.isReadonlyArrayNonEmpty(rows)
          ? `[beep-cli] coverage:affected: ${coverageRegressionBaselinePath} differs from ${base} only in the row(s) for ${A.join(rows, ", ")}; planning from those rows`
          : `[beep-cli] coverage:affected: ${coverageRegressionBaselinePath} differs from ${base} only in provenance fields`
      );
    },
  });
  const scope = yield* planWorkspaceCoverageAffectedScope(repoRoot, changedFiles, baselineRowPackages);
  const passthroughArgs = withoutCoverageAffectedArg(args);

  return yield* Match.value(scope).pipe(
    Match.discriminator("_tag")("full", ({ reasons }) =>
      Console.log(`[beep-cli] coverage:affected: full fallback (${A.join(reasons, "; ")})`).pipe(
        Effect.as(parseCoverageTaskOptions(passthroughArgs))
      )
    ),
    Match.discriminator("_tag")("selected", ({ packageNames, dependentPackageNames }) =>
      Console.log(
        `[beep-cli] coverage:affected: selected ${A.join(packageNames, ", ")}${
          A.isReadonlyArrayNonEmpty(dependentPackageNames)
            ? ` (dependents: ${A.join(dependentPackageNames, ", ")})`
            : ""
        }`
      ).pipe(
        Effect.as({
          args: coverageTurboArgs([...passthroughArgs, ...A.map(packageNames, (name) => `--filter=${name}`)]),
          expectedPackageNames: packageNames,
          replaceAll: parsed.replaceAll,
          scoped: true,
          skip: false,
          writeBaseline: parsed.writeBaseline,
        })
      )
    ),
    Match.discriminator("_tag")("noop", () =>
      Effect.succeed({
        args: A.empty<string>(),
        expectedPackageNames: A.empty<string>(),
        replaceAll: parsed.replaceAll,
        scoped: true,
        skip: true,
        writeBaseline: parsed.writeBaseline,
      })
    ),
    Match.exhaustive
  );
});

/**
 * Authoritative coverage owners and checkout identity for test producers.
 *
 * **Example** (Inspect the shared plan contract)
 * ```ts
 * import { CiCoverageArtifactPlan } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiCoverageArtifactPlan)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CiCoverageArtifactPlan extends S.Opaque<CiCoverageArtifactPlan, { readonly brand: unique symbol }>()(
  S.Struct({ identity: CoverageProducerIdentity, owners: S.Array(CoverageScopeOwner), scoped: S.Boolean }).pipe(
    $RepoCliId.create("commands/Quality/Tasks").annoteSchema("CiCoverageArtifactPlan", {
      description: "Coverage planner owners and trusted workflow identity shared by producers and comparator.",
    })
  )
) {}

/**
 * Reuse the legacy coverage scope planner without cleaning or executing tests.
 *
 * **Example** (Build a report planning effect)
 * ```ts
 * import { resolveCiCoverageArtifactPlan } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(resolveCiCoverageArtifactPlan("/repo", [])))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const resolveCiCoverageArtifactPlan = Effect.fn("QualityTasks.resolveCiCoverageArtifactPlan")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  base?: string
) {
  const options = yield* resolveCoverageTaskOptions(repoRoot, args, base);
  const owners = yield* workspaceCoverageScopeOwners(repoRoot);
  const names = options.skip
    ? A.empty<string>()
    : options.scoped
      ? options.expectedPackageNames
      : A.map(
          A.filter(owners, (owner) => owner.hasCoverage),
          (owner) => owner.packageName
        );
  const selected = A.filter(owners, (owner) => A.contains(names, owner.packageName));
  const comparisonBase = base ?? O.getOrElse(yield* configStringOption("TURBO_SCM_BASE"), () => "origin/main");
  return CiCoverageArtifactPlan.make({
    identity: yield* resolveCoverageProducerIdentity(repoRoot, { base: comparisonBase, packageNames: names }),
    owners: selected,
    scoped: options.scoped,
  });
});

/**
 * Validate root coverage arguments through the runtime option resolver.
 *
 * **Example** (Build a validation effect)
 *
 * ```ts
 * import { validateCoverageTaskArgsForTesting } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(validateCoverageTaskArgsForTesting("/repo", ["--write-baseline"]))) // true
 * ```
 *
 * @param repoRoot - Repository root used if affected scope requires workspace discovery.
 * @param args - Root coverage passthrough arguments to validate.
 * @returns The resolved coverage options after scope validation.
 * @category testing
 * @since 0.0.0
 */
export const validateCoverageTaskArgsForTesting = Effect.fn("QualityTasks.validateCoverageTaskArgsForTesting")(
  function* (repoRoot: string, args: ReadonlyArray<string>) {
    return yield* resolveCoverageTaskOptions(repoRoot, args);
  }
);

const isLintFixAggregateArg = (arg: string): boolean => A.some(LINT_FIX_AGGREGATE_ARGS, (name) => name === arg);

const stripLintFixAggregateArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isLintFixAggregateArg(arg)
);

const shouldForceAggregateLintFix = (args: ReadonlyArray<string>): boolean => A.some(args, isLintFixAggregateArg);

const shouldRunRepoWideSteps = (args: ReadonlyArray<string>): boolean => !A.some(args, isExplicitTurboScopeArg);
const shouldRunLintRepoWideSteps = (args: ReadonlyArray<string>): boolean =>
  !A.some(args, isExplicitTurboAffectedOrScopeArg);

// A workstation configured for remote reads is honored; everything else falls
// back to local-only. The decision itself lives in `internal/cli/TurboCache`
// so the whole matrix stays unit-testable without mutating the environment.
const turboCachePlan = (args: ReadonlyArray<string>) =>
  resolveTurboCachePlan(readTurboCacheEnvironmentSync(), { args, ci: isCiSync() });

const localTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(turboCachePlan(args));

// Steps carrying their own environment stay outside the remote-cache secret
// session. They are `cache: false` lanes in turbo.json, so they lose no remote
// hits by staying unwrapped; the run-time degradation below keeps a
// reference-backed remote posture from reaching them anyway.
// The session verdict is a parameter for the same reason it is on
// `withoutUnusableRemoteCache`: taken from the ambient environment here, the
// opt-in arm is unreachable on any checkout whose credentials are literal.
const turboStepLocalEnv: {
  (needsSecretSession: boolean): (env: Record<string, string | undefined> | undefined) => O.Option<boolean>;
  (env: Record<string, string | undefined> | undefined, needsSecretSession: boolean): O.Option<boolean>;
} = dual(
  2,
  (env: Record<string, string | undefined> | undefined, needsSecretSession: boolean): O.Option<boolean> =>
    env === undefined && needsSecretSession ? O.some(true) : O.none()
);

/**
 * Decide whether a Turbo step opts into a remote-cache secret session. Exposed
 * for focused unit tests.
 *
 * **Example** (Opt a credential-free step in)
 *
 * ```ts
 * import { turboStepLocalEnvForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(turboStepLocalEnvForTesting(undefined, true))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const turboStepLocalEnvForTesting = turboStepLocalEnv;

const needsTurboSecretSession = (): boolean => turboCacheEnvironmentNeedsSecretSession(readTurboCacheEnvironmentSync());

const ciFreshTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  isCiSync() && !A.some(args, isTurboCacheControlArg) ? ["--force", ...args] : args;

const isUnscopedInvocation = (args: ReadonlyArray<string>): boolean => A.isReadonlyArrayEmpty(args);

const isTurboPassthroughDelimiter = (arg: string): boolean => arg === "--";

// Split turbo args at the `--` passthrough delimiter so injected turbo options
// never leak into the child task argv (coverage steps forward Vitest args).
const splitAtTurboPassthrough = (
  args: ReadonlyArray<string>
): readonly [ReadonlyArray<string>, ReadonlyArray<string>] =>
  pipe(
    A.findFirstIndex(args, isTurboPassthroughDelimiter),
    O.match({
      onNone: (): readonly [ReadonlyArray<string>, ReadonlyArray<string>] => [args, A.empty<string>()],
      onSome: (index) => A.splitAt(args, index),
    })
  );

// Coverage children receive the pull-request posture in their environment,
// but a generated `--cache=local:rw,remote:r` argument outranks TURBO_CACHE and
// would have turbo read a remote cache whose credentials that posture just
// scrubbed. Downgrade the generated plan to local-only for coverage runs; a
// caller-owned cache argument stays caller-owned (standards/turbo-remote-cache.md).
const turboCacheArgsFor = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  includesTurboCoverageTask(tasks, args)
    ? localOnlyTurboCacheArgs(localTurboCacheArgs(args))
    : localTurboCacheArgs(args);

const turboRunArgs = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const [optionArgs, passthroughArgs] = splitAtTurboPassthrough(args);
  // Golden regeneration writes fixtures, so even a second identical invocation
  // must execute instead of replaying a successful cached regeneration.
  const executionArgs = configStringEqualsSync("REGEN_GOLDENS", "1")
    ? ["--force", ...A.filter(optionArgs, (arg) => arg !== "--force" && !Str.startsWith(arg, "--force="))]
    : optionArgs;
  return ["turbo", "run", ...tasks, ...turboCacheArgsFor(tasks, args), ...executionArgs, ...passthroughArgs];
};

const boundedRootTurboArgs = (
  args: ReadonlyArray<string>,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
): ReadonlyArray<string> => (A.some(args, isTurboConcurrencyArg) ? args : [`--concurrency=${plan.rootTurbo}`, ...args]);

const includesTurboCoverageTask = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): boolean =>
  A.some(tasks, (task) => task === "coverage") || A.some(args, (arg) => arg === "coverage");

const turboCoverageEnv = (
  tasks: ReadonlyArray<string>,
  args: ReadonlyArray<string>
): Record<string, string | undefined> | undefined =>
  includesTurboCoverageTask(tasks, args) ? coverageEnvironment() : undefined;

const collectExistingWorkingTreeChangedFiles = Effect.fn("QualityTasks.collectExistingWorkingTreeChangedFiles")(
  function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const changedFiles = yield* collectDirtyWorktreeFiles(repoRoot, {
      diffFilter: CHANGED_PATH_DIFF_FILTER,
      pathspecs: A.empty(),
      onProbeFailure: "ignore",
    }).pipe(Effect.orElseSucceed(A.empty<string>));

    return yield* Effect.filter(pipe(changedFiles, A.dedupe, A.sort(Order.String)), (file) =>
      fs.exists(path.join(repoRoot, file)).pipe(Effect.orElseSucceed(thunkFalse))
    );
  }
);

const lintFixChangedStep = (repoRoot: string, files: ReadonlyArray<string>) =>
  QualityTaskStep.make({
    label: "lint:fix:changed",
    command: LOCAL_BIOME_BIN,
    args: insertEndOfOptions(BIOME_FIX_CHANGED_ARGS, files),
    cwd: repoRoot,
  });

const usableSqlConnectionUri = (value: string | undefined): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(value),
    O.filter(Str.isNonEmpty),
    O.filter((uri) => !isUnresolvedSecretReference(uri))
  );

const sqlIntegrationConnectionUriFromEnv = (env: Record<string, string | undefined>): O.Option<string> =>
  usableSqlConnectionUri(env.BEEP_TEST_DATABASE_URL);

const carriedStepProps = (step: QualityTaskStep) => ({
  ...optionalProp("env", O.fromUndefinedOr(step.env)),
  ...optionalProp("flakeQuarantine", O.fromUndefinedOr(step.flakeQuarantine)),
  ...optionalProp("captureTimeoutMillis", O.fromUndefinedOr(step.captureTimeoutMillis)),
});

// A spawn that is not wrapped in `op run` sees the credentials exactly as this
// process does — unresolved `op://` references — so it must not carry a remote
// cache posture. Rewriting is a no-op for arguments that carry none, which is
// every step outside a checkout configured for reference-backed remote reads.
// The session verdict is a parameter so both arms are reachable from a test
// without mutating the ambient environment.
const withoutUnusableRemoteCache: {
  (needsSecretSession: boolean): (step: QualityTaskStep) => QualityTaskStep;
  (step: QualityTaskStep, needsSecretSession: boolean): QualityTaskStep;
} = dual(
  2,
  (step: QualityTaskStep, needsSecretSession: boolean): QualityTaskStep =>
    needsSecretSession && hasRemoteTurboCacheArgs(step.args)
      ? QualityTaskStep.make({
          label: step.label,
          command: step.command,
          args: localOnlyTurboCacheArgs(step.args),
          cwd: step.cwd,
          ...carriedStepProps(step),
        })
      : step
);

/**
 * Strip an unusable remote cache posture from a step that will not run under
 * `op run`. Exposed for focused unit tests.
 *
 * **Example** (Degrade an unwrapped step)
 *
 * ```ts
 * import { QualityTaskStep, withoutUnusableRemoteCacheForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const step = QualityTaskStep.make({
 *   label: "check",
 *   command: "bunx",
 *   args: ["turbo", "run", "check", "--cache=local:rw,remote:r"],
 *   cwd: "/repo"
 * })
 * console.log(withoutUnusableRemoteCacheForTesting(step, true).args)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withoutUnusableRemoteCacheForTesting = withoutUnusableRemoteCache;

/**
 * Wrap a Turbo step in the least-privilege remote-cache secret session.
 *
 * **Details**
 *
 * The wrapper does not load the project environment file. Its explicit child
 * environment retains only the Turbo credential references and ordinary
 * ambient values; spawn sites pair it with `extendEnv: false`.
 *
 * **Example** (Wrap a Turbo check step)
 *
 * ```ts
 * import { QualityTaskStep, turboSecretSessionStepForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const step = QualityTaskStep.make({
 *   label: "check",
 *   command: "bunx",
 *   args: ["turbo", "run", "check"],
 *   cwd: "/repo"
 * })
 * console.log(turboSecretSessionStepForTesting(step, { PATH: "/usr/bin" }).command) // "op"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const turboSecretSessionStepForTesting = turboSecretSessionStep;

const withTurboSecretSession = Effect.fn("QualityTasks.withTurboSecretSession")(function* (step: QualityTaskStep) {
  yield* assertCacheRuntimeKeyUnspecified(step.command, step.args, Bun.env, step.env ?? {}).pipe(
    QualityTaskConfigurationError.mapError("Rejected a caller-provided cache runtime identity.")
  );
  if (step.useLocalEnv !== true) {
    return withoutUnusableRemoteCache(step, needsTurboSecretSession());
  }

  const environmentWarnings = yield* turboEnvironmentHealthWarnings(step.cwd, Bun.env);
  yield* O.match(renderTurboEnvironmentHealthWarnings(environmentWarnings), {
    onNone: () => Effect.void,
    onSome: Console.warn,
  });

  // A missing, expired, or denied 1Password session degrades the lane to
  // local-only instead of failing it.
  const canUseSecretSession = yield* canUseTurboCacheSecretSession(step.cwd, Bun.env);
  if (!canUseSecretSession) {
    return withoutUnusableRemoteCache(step, needsTurboSecretSession());
  }

  return turboSecretSessionStep(step, Bun.env);
});

const runStep = Effect.fn("QualityTasks.runStep")(function* (step: QualityTaskStep) {
  const resolved = yield* withTurboSecretSession(step);
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args, Bun.env);
  const runtime = cacheRuntimeStep(resolved);
  yield* Console.log(`[beep-cli] ${resolved.label}: ${commandText(resolved.command, resolved.args)}`);
  const exitCode = yield* runToExit({
    command: runtime.command,
    args: runtime.args,
    cwd: resolved.cwd,
    env: {
      ...envOverrides,
      ...(resolved.env ?? {}),
    },
    extendEnv: turboEnvExtendsAmbient(resolved.command, resolved.args),
    stdin: "inherit",
    stdio: "inherit",
  }).pipe(QualityTaskConfigurationError.mapError(`Failed to spawn ${commandText(resolved.command, resolved.args)}`));

  if (exitCode !== 0) {
    return yield* QualityTaskFailed.new(exitCode, resolved.label, commandText(resolved.command, resolved.args));
  }
});

const renderFailureSummary = (label: string, failures: ReadonlyArray<QualityTaskFailed>): string =>
  A.join(
    [
      `[beep-cli] ${label}: failed ${A.length(failures)} step(s)`,
      ...A.map(
        failures,
        (failure) =>
          `[beep-cli]   ${failure.label}: exit ${failure.exitCode}\n[beep-cli]     command: ${failure.command}`
      ),
    ],
    "\n"
  );

const failQualityTaskGroup = Effect.fn("QualityTasks.failQualityTaskGroup")(function* (
  label: string,
  failures: ReadonlyArray<QualityTaskFailed>
) {
  const firstFailure = A.head(failures);
  if (O.isSome(firstFailure)) {
    yield* Console.error(renderFailureSummary(label, failures));
    return yield* QualityTaskGroupFailed.new(failures, label, firstFailure.value.exitCode);
  }
});

const failQualityTaskFailures = Effect.fn("QualityTasks.failQualityTaskFailures")(function* (
  label: string,
  failures: ReadonlyArray<QualityTaskFailed>
) {
  yield* failQualityTaskGroup(label, failures);
});

type QuarantineStepAttempt = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
  readonly label: string;
  readonly command: string;
};

type QuarantineStandaloneRun = {
  readonly taskId: string;
  readonly packageName: string;
  readonly task: string;
  readonly standaloneCommand: string;
  readonly detectedAt: string;
  readonly standaloneDurationMs: number;
};

type QuarantineWave = {
  readonly tasks: ReadonlyArray<FlakeQuarantineTask>;
  readonly detectedAt: string;
};

// Quarantine-eligible lanes capture while teeing so a failure's output can be
// matched against the no-location TS2589 signature; everything else keeps the
// inherited-stdio path unchanged.
const runStepCapturedForQuarantine = (
  step: QualityTaskStep
): Effect.Effect<QuarantineStepAttempt, QualityTaskConfigurationError, QualityTaskEnvironment> =>
  runStepCaptured(step, flakeQuarantineOutputBound, true);

// Buffered steps run beside one another, so their output is captured without teeing and replayed whole
// once the step ends: the log stays readable per package instead of interleaving two vitest runs.
const runStepBuffered = Effect.fn("QualityTasks.runStepBuffered")(function* (
  step: QualityTaskStep
): Effect.fn.Return<O.Option<QualityTaskFailed>, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const attempt = yield* runStepCaptured(step, repoRunOutputBound, false);
  if (Str.isNonEmpty(Str.trim(attempt.output))) {
    yield* Console.log(attempt.output);
  }
  return attempt.exitCode === 0
    ? O.none()
    : O.some(QualityTaskFailed.new(attempt.exitCode, attempt.label, attempt.command));
});

const runStepCaptured = Effect.fn("QualityTasks.runStepCaptured")(function* (
  step: QualityTaskStep,
  bound: OutputBound,
  tee: boolean
): Effect.fn.Return<QuarantineStepAttempt, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const resolved = yield* withTurboSecretSession(step);
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args, Bun.env);
  const runtime = cacheRuntimeStep(resolved);
  const command = commandText(resolved.command, resolved.args);
  yield* Console.log(`[beep-cli] ${resolved.label}: ${command}`);
  const result = yield* runCaptured({
    command: runtime.command,
    args: runtime.args,
    cwd: resolved.cwd,
    env: {
      ...envOverrides,
      ...(resolved.env ?? {}),
    },
    extendEnv: turboEnvExtendsAmbient(resolved.command, resolved.args),
    source: "all",
    bound,
    tee,
  }).pipe(
    Effect.catchTag("CaptureCommandTimedOutError", (error) => error.pipe(capturedTimeoutResult, Effect.succeed)),
    QualityTaskConfigurationError.mapError(`Failed to spawn ${command}`)
  );

  return {
    exitCode: result.exitCode,
    output: result.output,
    truncated: result.truncated,
    label: resolved.label,
    command,
  };
});

const selectFlakeQuarantineWave = Effect.fn("QualityTasks.selectFlakeQuarantineWave")(function* (
  step: QualityTaskStep,
  attempt: QuarantineStepAttempt,
  standaloneRuns: ReadonlyArray<QuarantineStandaloneRun>
) {
  if (attempt.truncated) {
    yield* Console.log(`[flake-quarantine] ${step.label}: captured output truncated; keeping failure hard`);
    return O.none<QuarantineWave>();
  }

  const detected = detectNoLocationTs2589Flake(attempt.output);
  if (O.isNone(detected)) {
    yield* Console.log(
      `[flake-quarantine] ${step.label}: failure does not match the no-location TS2589 flake signature; keeping failure hard`
    );
    return O.none<QuarantineWave>();
  }

  const recordedTaskIds = A.map(standaloneRuns, (run) => run.taskId);
  const repeatedTaskIds = pipe(
    detected.value,
    A.filter((task) => A.contains(recordedTaskIds, task.taskId)),
    A.map((task) => task.taskId)
  );
  if (A.isReadonlyArrayNonEmpty(repeatedTaskIds)) {
    yield* Console.log(
      `[flake-quarantine] ${step.label}: lane rerun repeated the flake for ${A.join(repeatedTaskIds, ", ")}; keeping failure hard`
    );
    return O.none<QuarantineWave>();
  }

  if (A.length(detected.value) > MAX_QUARANTINED_TASKS_PER_LANE - A.length(standaloneRuns)) {
    yield* Console.log(
      `[flake-quarantine] ${step.label}: cumulative task cap ${MAX_QUARANTINED_TASKS_PER_LANE} exceeded; keeping failure hard`
    );
    return O.none<QuarantineWave>();
  }

  const detectedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  yield* Console.log(
    `[flake-quarantine] ${step.label}: no-location TS2589 flake signature detected for ${A.join(
      A.map(detected.value, (task) => task.taskId),
      ", "
    )}; rerunning standalone once`
  );
  return O.some<QuarantineWave>({ tasks: detected.value, detectedAt });
});

const runStandaloneQuarantineWave = Effect.fn("QualityTasks.runStandaloneQuarantineWave")(function* (
  step: QualityTaskStep,
  wave: QuarantineWave
) {
  const runs: Array<QuarantineStandaloneRun> = [];
  for (const task of wave.tasks) {
    const [elapsed, rerun] = yield* runStepCapturedForQuarantine(standaloneQuarantineRerunStep(step, task)).pipe(
      Effect.timed
    );
    if (rerun.exitCode !== 0) {
      yield* Console.log(
        `[flake-quarantine] ${step.label}: standalone rerun for ${task.taskId} failed with exit ${rerun.exitCode}; keeping failure hard`
      );
      return O.none<ReadonlyArray<QuarantineStandaloneRun>>();
    }
    runs.push({
      taskId: task.taskId,
      packageName: task.packageName,
      task: task.task,
      standaloneCommand: rerun.command,
      detectedAt: wave.detectedAt,
      standaloneDurationMs: Duration.toMillis(elapsed),
    });
  }
  return O.some<ReadonlyArray<QuarantineStandaloneRun>>(runs);
});

const quarantineIncidents = (
  policy: NonNullable<QualityTaskStep["flakeQuarantine"]>,
  laneLabel: string,
  laneRerunDurationMs: number,
  runs: ReadonlyArray<QuarantineStandaloneRun>
): ReadonlyArray<FlakeQuarantineIncident> =>
  A.map(runs, (run) =>
    FlakeQuarantineIncident.make({
      policy,
      laneLabel,
      taskId: run.taskId,
      packageName: run.packageName,
      task: run.task,
      standaloneCommand: run.standaloneCommand,
      detectedAt: run.detectedAt,
      standaloneDurationMs: run.standaloneDurationMs,
      laneRerunDurationMs,
    })
  );

const runFlakeQuarantineWaves = Effect.fn("QualityTasks.runFlakeQuarantineWaves")(function* (
  step: QualityTaskStep,
  attempt: QuarantineStepAttempt,
  policy: NonNullable<QualityTaskStep["flakeQuarantine"]>
) {
  const standaloneRuns: Array<QuarantineStandaloneRun> = [];
  let currentAttempt = attempt;

  while (true) {
    const wave = yield* selectFlakeQuarantineWave(step, currentAttempt, standaloneRuns);
    if (O.isNone(wave)) return A.empty<FlakeQuarantineIncident>();

    const waveRuns = yield* runStandaloneQuarantineWave(step, wave.value);
    if (O.isNone(waveRuns)) return A.empty<FlakeQuarantineIncident>();
    standaloneRuns.push(...waveRuns.value);

    const [laneElapsed, laneRerun] = yield* runStepCapturedForQuarantine(laneQuarantineRerunStep(step)).pipe(
      Effect.timed
    );
    if (laneRerun.exitCode !== 0) {
      yield* Console.log(
        `[flake-quarantine] ${step.label}: lane rerun failed with exit ${laneRerun.exitCode}; checking for another quarantinable task`
      );
      currentAttempt = laneRerun;
      continue;
    }

    const laneRerunDurationMs = Duration.toMillis(laneElapsed);
    yield* Console.log(
      `[flake-quarantine] ${step.label}: quarantined ${A.length(standaloneRuns)} environment-only TS2589 flake incident(s); lane rerun green`
    );
    return quarantineIncidents(policy, step.label, laneRerunDurationMs, standaloneRuns);
  }
});

// Every newly flake-attributed package reruns standalone once, then the whole
// lane resumes from cache so tasks Turbo skipped after the flake still execute.
// A resumed lane can expose another near-ceiling package, so arbitration
// continues while each failure has the strict signature and the cumulative
// task cap is intact. Any repeated task or non-matching failure stays hard.
// Returns every incident only after a complete lane rerun succeeds.
const attemptFlakeQuarantine = Effect.fn("QualityTasks.attemptFlakeQuarantine")(function* (
  step: QualityTaskStep,
  attempt: QuarantineStepAttempt
): Effect.fn.Return<ReadonlyArray<FlakeQuarantineIncident>, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const policy = step.flakeQuarantine;
  if (policy === undefined) {
    return A.empty();
  }
  return yield* runFlakeQuarantineWaves(step, attempt, policy);
});

const quarantineArtifactCwd = (steps: ReadonlyArray<QualityTaskStep>): O.Option<string> =>
  pipe(
    A.findFirst(steps, (step) => step.flakeQuarantine !== undefined),
    O.filter(() => !isCiSync()),
    O.map((step) => step.cwd)
  );

const removeStaleFlakeQuarantineArtifact = Effect.fn("QualityTasks.removeStaleFlakeQuarantineArtifact")(function* (
  cwd: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.remove(path.join(cwd, FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH)).pipe(Effect.ignore);
});

// A failed artifact write must not turn an already re-proven lane red; it is
// reported loudly and the run continues with console evidence only.
const writeFlakeQuarantineArtifact = Effect.fn("QualityTasks.writeFlakeQuarantineArtifact")(function* (
  cwd: string,
  incidents: ReadonlyArray<FlakeQuarantineIncident>
) {
  if (A.isReadonlyArrayEmpty(incidents)) {
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifactPath = path.join(cwd, FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH);
  yield* fs.makeDirectory(path.dirname(artifactPath), { recursive: true }).pipe(Effect.ignore);
  yield* FlakeQuarantineArtifactJson.encode(
    FlakeQuarantineArtifact.make({ schemaVersion: "yeet-flake-quarantine/v1", incidents })
  ).pipe(
    Effect.flatMap((text) => fs.writeFileString(artifactPath, `${text}\n`)),
    Effect.tap(() => Console.log(`[flake-quarantine] recorded ${A.length(incidents)} incident(s) at ${artifactPath}`)),
    Effect.catch((error) =>
      Console.error(`[flake-quarantine] failed to write ${artifactPath}: ${Inspectable.toStringUnknown(error)}`)
    )
  );
});

const runStepWithQuarantine = Effect.fn("QualityTasks.runStepWithQuarantine")(function* (
  step: QualityTaskStep,
  incidents: Ref.Ref<ReadonlyArray<FlakeQuarantineIncident>>
): Effect.fn.Return<O.Option<QualityTaskFailed>, QualityTaskConfigurationError, QualityTaskEnvironment> {
  if (step.flakeQuarantine === undefined || isCiSync()) {
    return yield* runStep(step).pipe(
      Effect.as(O.none<QualityTaskFailed>()),
      Effect.catchTag("QualityTaskFailed", (failure) => Effect.succeedSome(failure))
    );
  }

  const attempt = yield* runStepCapturedForQuarantine(step);
  if (attempt.exitCode === 0) {
    return O.none();
  }

  const quarantined = yield* attemptFlakeQuarantine(step, attempt);
  if (A.isReadonlyArrayEmpty(quarantined)) {
    return O.some(QualityTaskFailed.new(attempt.exitCode, attempt.label, attempt.command));
  }
  yield* Ref.update(incidents, A.appendAll(quarantined));
  return O.none();
});

interface StreamingStepOutcome {
  readonly durationMs: number;
  readonly endedAt: string;
  readonly failure: O.Option<QualityTaskFailed>;
  readonly startedAt: string;
  readonly step: QualityTaskStep;
}

type StreamingOutcomeObserver = (
  outcome: StreamingStepOutcome,
  index: number
) => Effect.Effect<void, QualityTaskConfigurationError, Digest.Digest | FileSystem.FileSystem | Path.Path>;

const ignoreStreamingOutcome: StreamingOutcomeObserver = () => Effect.void;

// A `bunx turbo run <tasks…> --summarize` step names its tasks bare (F-A); those names select
// the rows of the attempt's own summary that fold into the lane digest. A wrapper-backed lane
// (`bun run beep ci lane <id>`) runs Turbo inside its child, which shares `.turbo/runs` with
// every concurrent lane, so the child declares its own digests to a ledger the parent names
// through `TURBO_LANE_LEDGER_ENV` instead of the parent folding every fresh summary.
const argAt = (step: QualityTaskStep, index: number, expected: string): boolean =>
  O.contains(A.get(step.args, index), expected);

const isDirectTurboSummarizeStep = (step: QualityTaskStep): boolean =>
  step.command === "bunx" && argAt(step, 0, "turbo") && argAt(step, 1, "run") && A.contains(step.args, "--summarize");

const isWrapperLaneStep = (step: QualityTaskStep): boolean =>
  step.command === "bun" &&
  argAt(step, 0, "run") &&
  argAt(step, 1, "beep") &&
  argAt(step, 2, "ci") &&
  argAt(step, 3, "lane");

const directTurboTaskNames = (step: QualityTaskStep): O.Option<ReadonlyArray<string>> =>
  isDirectTurboSummarizeStep(step)
    ? O.some(pipe(A.drop(step.args, 2), A.takeWhile(P.not(Str.startsWith("-")))))
    : O.none();

const turboLaneLedgerPath = (): O.Option<string> => O.fromUndefinedOr(Bun.env[TURBO_LANE_LEDGER_ENV]);

const turboLaneLedgerDirectory = (path: Path.Path, cwd: string): string =>
  path.join(cwd, ".beep", "quality", "lane-ledgers");

// Each wrapper step owns a freshly created directory under the lane-ledgers root, so concurrent
// collectors in one checkout never share a ledger; the directory is removed once the ledger is read.
const withTurboLaneLedger = Effect.fn("QualityTasks.withTurboLaneLedger")(function* (step: QualityTaskStep) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = turboLaneLedgerDirectory(path, step.cwd);
  yield* fs.makeDirectory(root, { recursive: true });
  const directory = yield* fs.makeTempDirectory({ directory: root, prefix: "lane-" });
  return QualityTaskStep.make({
    ...step,
    env: { ...step.env, [TURBO_LANE_LEDGER_ENV]: path.join(directory, "ledger.jsonl") },
  });
});

const removeTurboLaneLedger = Effect.fn("QualityTasks.removeTurboLaneLedger")(function* (ledgerPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.remove(path.dirname(ledgerPath), { recursive: true }).pipe(Effect.ignore);
});

/**
 * Declare one direct Turbo step's digest to the lane ledger the parent named (the child side of the handoff).
 *
 * **Details**
 *
 * Runs after each direct Turbo step, passed or failed (ruling 72: a red step's
 * digest is an observation, so the parent can record a failed lane against the
 * key it would have reused). The group's close record carries the attempt count
 * so the parent can refuse a ledger missing any declaration.
 *
 * @param ledger - Ledger path the parent named, if any.
 * @param outcome - The finished direct step.
 * @returns `None` when no declaration was attempted, otherwise whether it landed.
 */
const recordTurboLaneLedgerRow = Effect.fn("QualityTasks.recordTurboLaneLedgerRow")(function* (
  ledger: O.Option<string>,
  outcome: StreamingStepOutcome
) {
  const tasks = directTurboTaskNames(outcome.step);
  if (O.isNone(ledger) || O.isNone(tasks)) {
    return O.none<boolean>();
  }
  const digest = yield* readTurboLaneDigest(outcome.step.cwd, outcome.startedAt, tasks.value).pipe(
    Effect.orElseSucceed(O.none<TurboLaneDigest>)
  );
  return yield* O.match(digest, {
    onNone: () => Effect.succeedSome(false),
    onSome: (declared) =>
      appendTurboLaneLedger(ledger.value, declared).pipe(
        Effect.as(O.some(true)),
        Effect.orElseSucceed(() => O.some(false))
      ),
  });
});

const closeTurboLaneLedgerIfNamed = (ledger: O.Option<string>, attempted: number) =>
  O.match(ledger, {
    onNone: () => Effect.void,
    onSome: (ledgerPath) => closeTurboLaneLedger(ledgerPath, attempted).pipe(Effect.ignore),
  });

const collectStreamingStepOutcomes = Effect.fn("QualityTasks.collectStreamingStepOutcomes")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1,
  onOutcome: StreamingOutcomeObserver = ignoreStreamingOutcome,
  buffered = false
) {
  if (A.isReadonlyArrayEmpty(steps)) {
    return A.empty<StreamingStepOutcome>();
  }

  const ledger = turboLaneLedgerPath();
  const ledgerAttempts = yield* Ref.make(0);
  yield* Console.log(`[beep-cli] ${label}: running ${A.length(steps)} streaming step(s)`);
  const incidents = yield* Ref.make<ReadonlyArray<FlakeQuarantineIncident>>(A.empty());
  const artifactCwd = quarantineArtifactCwd(steps);
  yield* O.match(artifactCwd, {
    onNone: () => Effect.void,
    onSome: removeStaleFlakeQuarantineArtifact,
  });
  const outcomes = yield* Effect.forEach(
    steps,
    Effect.fnUntraced(function* (step, index) {
      const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const attempt = buffered === true ? runStepBuffered(step) : runStepWithQuarantine(step, incidents);
      const [elapsed, failure] = yield* Effect.timed(attempt);
      const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const durationMs = Duration.toMillis(elapsed);
      yield* Console.log(`[beep-cli] ${step.label}: ${O.isNone(failure) ? "ok" : "failed"} in ${durationMs}ms`);
      const outcome = { durationMs, endedAt, failure, startedAt, step };
      yield* onOutcome(outcome, index);
      const declaration = yield* recordTurboLaneLedgerRow(ledger, outcome);
      if (O.isSome(declaration)) {
        yield* Ref.update(ledgerAttempts, (attempts) => attempts + 1);
      }
      return outcome;
    }),
    { concurrency }
  );
  yield* closeTurboLaneLedgerIfNamed(ledger, yield* Ref.get(ledgerAttempts));
  yield* O.match(artifactCwd, {
    onNone: () => Effect.void,
    onSome: (cwd) => Effect.flatMap(Ref.get(incidents), (recorded) => writeFlakeQuarantineArtifact(cwd, recorded)),
  });

  return outcomes;
});

const collectStreamingStepFailures = Effect.fn("QualityTasks.collectStreamingStepFailures")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1,
  buffered = false
) {
  return pipe(
    yield* collectStreamingStepOutcomes(label, steps, concurrency, ignoreStreamingOutcome, buffered),
    A.map((outcome) => outcome.failure),
    A.getSomes
  );
});

/**
 * Named wrapper-lane input paired with an executor-provided digest when one exists.
 *
 * **Example** (Name a lane without a digest)
 *
 * ```ts
 * import type { QualityTaskLaneInput } from "@beep/repo-cli/commands/Quality/Tasks"
 * import { QualityTaskStep } from "@beep/repo-cli/commands/Quality"
 * import * as O from "effect/Option"
 *
 * const input: QualityTaskLaneInput = [
 *   "check",
 *   QualityTaskStep.make({ label: "check", command: "bun", args: ["run", "check"], cwd: "." }),
 *   O.none()
 * ]
 * console.log(input[0]) // "check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type QualityTaskLaneInput = readonly [
  id: string,
  step: QualityTaskStep,
  inputDigest: O.Option<string>,
  redSchedulingDecision?: GateRedSchedulingDecision,
];

/**
 * What a lane's Turbo inputs resolved to: the digest it can be reused by, the
 * workspace packages that digest folds (ruling 68), and whether Turbo caches
 * every task it folds (ruling 69's lock).
 */
type LaneInputResolution = {
  readonly inputDigest: O.Option<string>;
  readonly inputPackages: ReadonlyArray<string>;
  readonly inputsCacheable: boolean;
};

const qualityTaskLaneRunFromOutcome = (
  id: string,
  inputs: LaneInputResolution,
  outcome: StreamingStepOutcome,
  redSchedulingDecision: O.Option<GateRedSchedulingDecision> = O.none()
): QualityTaskLaneRun =>
  QualityTaskLaneRun.make({
    id,
    label: outcome.step.label,
    status: O.isSome(outcome.failure) ? "failed" : "passed",
    startedAt: O.some(outcome.startedAt),
    endedAt: O.some(outcome.endedAt),
    durationMs: O.some(outcome.durationMs),
    exitCode: O.some(
      pipe(
        outcome.failure,
        O.map((failure) => failure.exitCode),
        O.getOrElse(() => 0)
      )
    ),
    inputDigest: inputs.inputDigest,
    inputPackages: inputs.inputPackages,
    inputsCacheable: inputs.inputsCacheable,
    redSchedulingDecision: O.isSome(outcome.failure) ? redSchedulingDecision : O.none(),
    commandText: O.some(commandText(outcome.step.command, outcome.step.args)),
  });

const skippedQualityTaskLaneRun = (lane: GithubCheckLaneWaveSpec["lanes"][number]): QualityTaskLaneRun =>
  QualityTaskLaneRun.make({
    id: lane.id,
    label: lane.step.label,
    status: "not-run-early-stop",
    inputDigest: O.none(),
    commandText: O.some(commandText(lane.step.command, lane.step.args)),
  });

const appendSkippedQualityTaskLaneRun = Effect.fn("QualityTasks.appendSkippedLaneRun")(function* (
  lane: GithubCheckLaneWaveSpec["lanes"][number]
) {
  const laneRun = skippedQualityTaskLaneRun(lane);
  yield* appendQualityTaskLaneRun(laneRun);
  return laneRun;
});

const stopAfterRed = (): GateRedSchedulingDecision => GateRedSchedulingDecision.Enum["stop-after-red"];
const continueAfterImpreciseRed = (): GateRedSchedulingDecision =>
  GateRedSchedulingDecision.Enum["continue-after-imprecise-red"];

/**
 * Decide whether a red lane stops the local proof wave.
 *
 * **Details**
 *
 * An unseeded lane and a lane whose seed row is `precise` stop scheduling
 * after a red; only an explicitly `imprecise` lane lets the wave continue.
 *
 * **Example** (Stop after an unseeded red)
 *
 * ```ts
 * import { redSchedulingDecision } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * console.log(redSchedulingDecision(O.none())) // "stop-after-red"
 * ```
 *
 * @param estimate - The lane's gate-order seed row, when the seed covers it.
 * @returns The scheduling decision applied when the lane turns red.
 * @category policies
 * @since 0.0.0
 */
export const redSchedulingDecision = (
  estimate: GithubCheckLaneWaveSpec["lanes"][number]["orderEstimate"]
): GateRedSchedulingDecision =>
  O.match(estimate, {
    onNone: stopAfterRed,
    onSome: (value) =>
      GatePrecisionClass.match(value.precision, {
        precise: stopAfterRed,
        imprecise: continueAfterImpreciseRed,
      }),
  });

type QualityTaskLaneRunObserver = (
  laneRun: QualityTaskLaneRun
) => Effect.Effect<void, QualityTaskConfigurationError, Digest.Digest | FileSystem.FileSystem | Path.Path>;

const ignoreQualityTaskLaneRun: QualityTaskLaneRunObserver = () => Effect.void;

const digestValue = (digest: TurboLaneDigest): string => digest.digest;

// A lane that resolved no Turbo digest also has no package scope: an undeclared
// lane, a missing lane ledger and a ledger missing a declaration all land here
// (ruling 68). A declared-digest lane carries an empty scope by construction,
// and not for want of a ledger: `laneStepsWithLedgers` attaches one to every
// wrapper step whatever the caller declared, and `resolveLaneInputDigest`
// removes it under `Effect.ensuring`. The scope is discarded because
// `resolveLaneInputDigestSource` returns at its `O.isSome(declared)`
// short-circuit, before the ledger is ever read. A failed lane is not
// short-circuited (ruling 72): it resolves its digest and package scope through
// the same wrapper-ledger or direct-Turbo path as a pass, so its key is the one
// a pass of the same inputs records, the ledger can see a hit-versus-failed
// disagreement, and the changed-package tripwire sees a failed lane's scope.
// Such a lane is not cacheable either: no Turbo definition vouches for its digest.
const unscopedLaneInputs = (inputDigest: O.Option<string>): LaneInputResolution => ({
  inputDigest,
  inputPackages: A.empty<string>(),
  inputsCacheable: false,
});

const laneInputsFromTurboDigest = (digest: O.Option<TurboLaneDigest>): LaneInputResolution => ({
  inputDigest: O.map(digest, digestValue),
  inputPackages: O.match(digest, { onNone: A.empty<string>, onSome: turboLaneDigestPackages }),
  inputsCacheable: O.exists(digest, turboLaneDigestCacheable),
});

const readLaneInputs = <Failure, Requirements>(
  read: Effect.Effect<O.Option<TurboLaneDigest>, Failure, Requirements>
): Effect.Effect<LaneInputResolution, never, Requirements> =>
  read.pipe(
    Effect.map(laneInputsFromTurboDigest),
    Effect.orElseSucceed(() => unscopedLaneInputs(O.none()))
  );

/**
 * Resolve a lane's input digest and package scope from its declared digest, wrapper ledger, or direct Turbo run.
 *
 * **Details**
 *
 * A declared digest wins and carries no package scope. Otherwise a wrapper
 * lane reads the ledger its child declared to, and a direct step reads its own
 * Turbo run summary. A failed step takes the same path as a passed one
 * (ruling 72), so its key is the one a pass of the same inputs records.
 *
 * @param outcome - The finished lane step.
 * @param declared - Digest the caller declared, if any.
 * @param ledger - Wrapper lane ledger path, if the step carries one.
 * @returns The lane's input digest, package scope (ruling 68) and cacheability (ruling 69).
 */
const resolveLaneInputDigestSource = Effect.fn("QualityTasks.resolveLaneInputDigestSource")(function* (
  outcome: StreamingStepOutcome,
  declared: O.Option<string>,
  ledger: O.Option<string>
) {
  if (O.isSome(declared)) {
    return unscopedLaneInputs(declared);
  }
  if (isWrapperLaneStep(outcome.step)) {
    return yield* O.match(ledger, {
      onNone: () => O.none().pipe(unscopedLaneInputs, Effect.succeed),
      onSome: (ledgerPath) => readLaneInputs(readTurboLaneLedger(ledgerPath)),
    });
  }
  return yield* O.match(directTurboTaskNames(outcome.step), {
    onNone: () => O.none().pipe(unscopedLaneInputs, Effect.succeed),
    onSome: (tasks) => readLaneInputs(readTurboLaneDigest(outcome.step.cwd, outcome.startedAt, tasks)),
  });
});

// The parent side of the handoff: a wrapper lane's digest is whatever its child declared to
// the ledger this parent named on the step; the ledger is removed once read, pass or fail.
const resolveLaneInputDigest = Effect.fn("QualityTasks.resolveLaneInputDigest")(function* (
  outcome: StreamingStepOutcome,
  declared: O.Option<string>
) {
  const ledger = isWrapperLaneStep(outcome.step)
    ? O.fromUndefinedOr(outcome.step.env?.[TURBO_LANE_LEDGER_ENV])
    : O.none<string>();
  return yield* resolveLaneInputDigestSource(outcome, declared, ledger).pipe(
    Effect.ensuring(O.match(ledger, { onNone: () => Effect.void, onSome: removeTurboLaneLedger }))
  );
});

const laneStepsWithLedgers = Effect.fn("QualityTasks.laneStepsWithLedgers")(function* (
  lanes: ReadonlyArray<QualityTaskLaneInput>
) {
  return yield* Effect.forEach(lanes, ([, step]) =>
    isWrapperLaneStep(step) ? withTurboLaneLedger(step) : Effect.succeed(step)
  ).pipe(QualityTaskConfigurationError.mapError("Failed to prepare a wrapper lane ledger"));
});

const collectQualityTaskLaneRuns = Effect.fn("QualityTasks.collectQualityTaskLaneRuns")(function* (
  label: string,
  lanes: ReadonlyArray<QualityTaskLaneInput>,
  concurrency = 1,
  onLaneRun: QualityTaskLaneRunObserver = appendQualityTaskLaneRun
) {
  const resolved = MutableHashMap.empty<number, LaneInputResolution>();
  const steps = yield* laneStepsWithLedgers(lanes);
  const outcomes = yield* collectStreamingStepOutcomes(label, steps, concurrency, (outcome, index) =>
    pipe(
      A.get(lanes, index),
      O.match({
        onNone: () => Effect.void,
        onSome: ([id, , inputDigest, decision]) =>
          resolveLaneInputDigest(outcome, inputDigest).pipe(
            Effect.flatMap((inputs) => {
              MutableHashMap.set(resolved, index, inputs);
              return onLaneRun(qualityTaskLaneRunFromOutcome(id, inputs, outcome, O.fromUndefinedOr(decision)));
            })
          ),
      })
    )
  );
  return {
    report: QualityTaskLaneRunReport.make({
      schemaVersion: "quality-task-lane-run/v1",
      lanes: A.map(A.zip(lanes, outcomes), ([[id, , inputDigest, decision], outcome], index) =>
        qualityTaskLaneRunFromOutcome(
          id,
          O.getOrElse(MutableHashMap.get(resolved, index), () => unscopedLaneInputs(inputDigest)),
          outcome,
          O.fromUndefinedOr(decision)
        )
      ),
    }),
    failures: pipe(
      outcomes,
      A.map((outcome) => outcome.failure),
      A.getSomes
    ),
  };
});

type GithubCheckWaveLane = GithubCheckLaneWaveSpec["lanes"][number];

// What one lane contributed to its wave. The journal append and the proof
// persist are left to the wave runner so lanes that ran concurrently are
// still recorded in wave order and never write the proof ledger at once.
type GithubCheckLaneOutcome = {
  readonly lane: GithubCheckWaveLane;
  readonly laneRun: O.Option<QualityTaskLaneRun>;
  readonly failures: ReadonlyArray<QualityTaskFailed>;
  readonly reused: boolean;
  readonly stopAfterRed: boolean;
};

const runGithubCheckLane = Effect.fn("QualityTasks.runGithubCheckLane")(function* (
  label: string,
  lane: GithubCheckWaveLane,
  session: O.Option<LaneProofSession>
) {
  const reusable = O.exists(session, (prepared) => hasReusableLaneProof(prepared, lane.id));
  const activeReuse = reusable && O.exists(session, (prepared) => prepared.mode === "active");
  if (reusable) {
    yield* Console.log(`[lane-proof] ${activeReuse ? "reusing" : "shadow hit for"} exact lane proof: ${lane.id}`);
  } else {
    yield* O.match(O.flatMap(session, explainLaneProofRefusal(lane.id)), {
      onNone: () => Effect.void,
      onSome: flow(renderLaneProofRefusal, Console.log),
    });
  }
  if (activeReuse) {
    return {
      lane,
      laneRun: O.some(
        QualityTaskLaneRun.make({
          id: lane.id,
          label: lane.step.label,
          status: "reused",
          inputDigest: O.none(),
          commandText: O.some(commandText(lane.step.command, lane.step.args)),
        })
      ),
      failures: A.empty<QualityTaskFailed>(),
      reused: true,
      stopAfterRed: false,
    } satisfies GithubCheckLaneOutcome;
  }

  yield* Console.log(`[beep-cli] ${label}: running lane ${lane.id}`);
  const result = yield* collectQualityTaskLaneRuns(
    `${label}:${lane.id}`,
    [[lane.id, lane.step, O.none(), redSchedulingDecision(lane.orderEstimate)]],
    1,
    ignoreQualityTaskLaneRun
  );
  const laneRun = A.head(result.report.lanes);
  return {
    lane,
    laneRun,
    failures: result.failures,
    reused: false,
    stopAfterRed:
      A.isReadonlyArrayNonEmpty(result.failures) &&
      O.exists(laneRun, (run) => O.exists(run.redSchedulingDecision, GateRedSchedulingDecision.is["stop-after-red"])),
  } satisfies GithubCheckLaneOutcome;
});

// A lane that ran green, with the duration its proof records.
const githubCheckLaneProofSuccess = (
  outcome: GithubCheckLaneOutcome
): O.Option<readonly [lane: GithubCheckWaveLane, durationMs: number]> =>
  outcome.reused || A.isReadonlyArrayNonEmpty(outcome.failures)
    ? O.none()
    : O.some([
        outcome.lane,
        pipe(
          outcome.laneRun,
          O.flatMap((laneRun) => laneRun.durationMs),
          O.getOrElse(() => 0)
        ),
      ]);

/**
 * Re-identify the tree after a wave, then persist the wave's green lanes.
 *
 * **Details**
 *
 * One virtual-tree hash per wave replaces the two each lane used to pay. The
 * refreshed session is the moved-tree fence for this wave's proofs (a wave
 * that changed a non-ignored file persists none) and the reuse basis for the
 * next wave, so a later lane is never reused against a tree an earlier wave
 * already moved.
 */
const advanceGithubCheckLaneProofs = Effect.fn("QualityTasks.advanceGithubCheckLaneProofs")(function* (
  session: O.Option<LaneProofSession>,
  lanes: ReadonlyArray<GithubCheckWaveLane>,
  successes: ReadonlyArray<readonly [lane: GithubCheckWaveLane, durationMs: number]>
) {
  if (O.isNone(session)) {
    return session;
  }
  const refreshed = yield* prepareLaneProofSession(lanes, session.value.mode).pipe(
    QualityTaskConfigurationError.mapError("Failed to refresh the lane-proof session.")
  );
  yield* O.match(refreshed, {
    onNone: () => Effect.void,
    onSome: (current) =>
      persistLaneProofs(session.value, successes, current).pipe(
        Effect.catch((error) =>
          Console.error(`[lane-proof] could not persist lane proof: ${Inspectable.toStringUnknown(error)}`)
        )
      ),
  });
  return refreshed;
});

// Journal one finished lane: a skipped lane gets its early-stop row, a run or
// reused lane its own row.
const journalGithubCheckLaneOutcome = Effect.fnUntraced(function* (
  lane: GithubCheckWaveLane | undefined,
  outcome: O.Option<GithubCheckLaneOutcome>
) {
  if (O.isSome(outcome)) {
    yield* O.match(outcome.value.laneRun, { onNone: () => Effect.void, onSome: appendQualityTaskLaneRun });
    return outcome.value.laneRun;
  }
  return P.isUndefined(lane) ? O.none<QualityTaskLaneRun>() : O.some(yield* appendSkippedQualityTaskLaneRun(lane));
});

/**
 * Split one wave's lanes into the segments that run in sequence.
 *
 * **Details**
 *
 * An `exclusive` lane (one that owns mutable state another lane could touch)
 * is a segment of its own, so nothing else runs beside it; every run of
 * consecutive shared lanes between exclusive lanes forms one segment, whose
 * lanes share a pool. Each entry keeps the lane's index in the wave so results
 * still fold in declaration order.
 *
 * **Example** (An exclusive lane splits its neighbours)
 *
 * ```ts
 * import { githubCheckLanePlan } from "@beep/repo-cli/test/Quality"
 * import { githubCheckWaveSegments } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as A from "effect/Array"
 *
 * const lane = (id: string) =>
 *   githubCheckLanePlan.githubCheckLane(id, "pre-push", "repo-quality", "test", githubCheckLanePlan.bunRunLane("/repo", id, ["x"]))
 * const lanes = [lane("a"), githubCheckLanePlan.exclusiveGithubCheckLane(lane("b")), lane("c")]
 * console.log(A.map(githubCheckWaveSegments(lanes), A.length)) // [1, 1, 1]
 * ```
 *
 * @param lanes - Lanes of one wave in execution order.
 * @returns Segments in execution order; every lane appears exactly once with its wave index.
 * @category utilities
 * @since 0.0.0
 */
export const githubCheckWaveSegments = (
  lanes: ReadonlyArray<GithubCheckLaneSpec>
): ReadonlyArray<ReadonlyArray<readonly [index: number, lane: GithubCheckLaneSpec]>> =>
  A.reduce(
    lanes,
    A.empty<ReadonlyArray<readonly [index: number, lane: GithubCheckLaneSpec]>>(),
    (segments, lane, index) => {
      const entry = [index, lane] as const;
      const previous = A.last(segments);
      const joinsPrevious =
        GithubCheckLaneIsolation.is.shared(lane.isolation) &&
        O.exists(previous, (segment) =>
          O.exists(A.last(segment), ([, held]) => GithubCheckLaneIsolation.is.shared(held.isolation))
        );
      return joinsPrevious
        ? A.append(A.dropRight(segments, 1), A.append(O.getOrElse(previous, A.empty), entry))
        : A.append(segments, [entry]);
    }
  );

/**
 * Run one wave's lanes through a pool of `concurrency` slots, journaling in wave order.
 *
 * **Details**
 *
 * A lane starts as soon as a slot frees, so one slow lane holds one slot
 * rather than the whole wave. Fail-fast works at lane granularity: once a
 * precise red lands, lanes not yet started are skipped and lanes already
 * running finish. Results are folded in declaration order whatever the
 * completion order, which keeps the first red, the journal artifact, and the
 * proof-ledger writes identical to the serial runner when `concurrency` is 1
 * and deterministic above it.
 */
const runGithubCheckWave = Effect.fn("QualityTasks.runGithubCheckWave")(function* (
  label: string,
  wave: GithubCheckLaneWaveSpec,
  failurePolicy: GithubCheckFailurePolicy,
  concurrency: number,
  session: O.Option<LaneProofSession>
) {
  const failFast = GithubCheckFailurePolicy.is["fail-fast"](failurePolicy);
  const stopRequested = yield* Ref.make(false);
  // Lanes finish in any order, but the journal only takes the finished
  // declaration-order prefix: it stays wave-ordered, and an interrupted wave
  // still leaves every lane that finished ahead of the first running one.
  const journalPermit = yield* Semaphore.make(1);
  const finished = MutableHashMap.empty<number, O.Option<GithubCheckLaneOutcome>>();
  let journaledCount = 0;
  let laneRuns = A.empty<QualityTaskLaneRun>();
  const journalFinishedPrefix = Effect.fnUntraced(function* () {
    for (
      let next = MutableHashMap.get(finished, journaledCount);
      O.isSome(next);
      next = MutableHashMap.get(finished, journaledCount)
    ) {
      const laneRun = yield* journalGithubCheckLaneOutcome(wave.lanes[journaledCount], next.value);
      laneRuns = O.match(laneRun, { onNone: () => laneRuns, onSome: (run) => A.append(laneRuns, run) });
      journaledCount += 1;
    }
  });
  // A lane blocked by an earlier lane of its wave starts only once that lane
  // finished; the pool starts lanes in declaration order, so a waiting lane
  // never holds the slot its blocker needs.
  const laneFinished = yield* Effect.forEach(wave.lanes, () => Deferred.make<void>());
  const awaitBlockers = (lane: GithubCheckWaveLane, index: number) =>
    Effect.forEach(
      A.filter(A.zip(A.take(wave.lanes, index), A.take(laneFinished, index)), ([blocker]) =>
        A.contains(lane.blockedBy, blocker.id)
      ),
      ([, blocker]) => Deferred.await(blocker),
      { discard: true }
    );
  const runPooledLane = ([index, lane]: readonly [index: number, lane: GithubCheckWaveLane]) =>
    awaitBlockers(lane, index).pipe(
      Effect.andThen(Ref.get(stopRequested)),
      Effect.flatMap((stop) =>
        stop
          ? Effect.succeed(O.none<GithubCheckLaneOutcome>())
          : runGithubCheckLane(label, lane, session).pipe(
              Effect.tap((outcome) => (failFast && outcome.stopAfterRed ? Ref.set(stopRequested, true) : Effect.void)),
              Effect.asSome
            )
      ),
      Effect.tap((outcome) =>
        Effect.sync(() => MutableHashMap.set(finished, index, outcome)).pipe(
          Effect.andThen(journalPermit.withPermit(journalFinishedPrefix()))
        )
      ),
      Effect.ensuring(
        O.match(A.get(laneFinished, index), {
          onNone: () => Effect.void,
          onSome: (done) => Deferred.succeed(done, undefined),
        })
      )
    );
  // Segments run in sequence (an exclusive lane runs alone); the lanes of one
  // shared segment share the pool.
  const outcomes = A.flatten(
    yield* Effect.forEach(githubCheckWaveSegments(wave.lanes), (segment) =>
      Effect.forEach(segment, runPooledLane, { concurrency: Math.max(1, concurrency) })
    )
  );
  const ran = A.getSomes(outcomes);
  return {
    activeReusableIds: A.map(
      A.filter(ran, (outcome) => outcome.reused),
      (outcome) => outcome.lane.id
    ),
    failures: A.flatMap(ran, (outcome) => outcome.failures),
    laneRuns,
    skippedLaneIds: A.getSomes(
      A.map(A.zip(wave.lanes, outcomes), ([lane, outcome]) => (O.isNone(outcome) ? O.some(lane.id) : O.none()))
    ),
    stoppedAfterRed: yield* Ref.get(stopRequested),
    successes: A.getSomes(A.map(ran, githubCheckLaneProofSuccess)),
  };
});

const githubCheckLaneRunStatus = (
  lane: GithubCheckLaneWaveSpec["lanes"][number],
  activeReusableIds: ReadonlyArray<string>,
  failedLabels: ReadonlyArray<string>,
  skippedLaneIds: ReadonlyArray<string>
): GithubCheckLaneRun["status"] => {
  if (A.contains(skippedLaneIds, lane.id)) {
    return "not-run-early-stop";
  }
  if (A.contains(activeReusableIds, lane.id)) {
    return "reused";
  }
  if (A.contains(failedLabels, lane.step.label)) {
    return "failed";
  }
  return "passed";
};

const runStreamingStepGroup = Effect.fn("QualityTasks.runStreamingStepGroup")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1,
  buffered = false
) {
  const failures = yield* collectStreamingStepFailures(label, steps, concurrency, buffered);
  yield* failQualityTaskFailures(label, failures);
});

/**
 * Execute static GitHub-check waves and stop scheduling after a precise red.
 * Imprecise reds continue so operators still receive independently actionable
 * evidence; collect-all schedules every lane regardless of precision.
 *
 * **Example** (Inspect an empty fail-fast run)
 *
 * ```ts
 * import { collectGithubCheckLaneWavesForTesting } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect";
 * const report = collectGithubCheckLaneWavesForTesting("pre-push", [], "fail-fast").pipe(
 *   Effect.map(({ report: value }) => value)
 * )
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param waves - Static lane waves in execution order.
 * @param failurePolicy - Whether a precise red stops subsequent scheduling.
 * @param laneProofMode - Lane-proof ledger mode override for tests.
 * @param concurrency - Lanes run at once inside one wave; 1 keeps the serial pre-push runner.
 * @returns The schema-backed run report and all failures observed in executed waves.
 * @category execution
 * @since 0.0.0
 */
const collectGithubCheckLaneWaves = Effect.fn("QualityTasks.collectGithubCheckLaneWaves")(function* (
  label: string,
  waves: ReadonlyArray<GithubCheckLaneWaveSpec>,
  failurePolicy: GithubCheckFailurePolicy,
  laneProofMode?: LaneProofSession["mode"],
  concurrency = 1
) {
  let failures = A.empty<QualityTaskFailed>();
  let laneRuns = A.empty<GithubCheckLaneRun>();
  let qualityTaskLaneRuns = A.empty<QualityTaskLaneRun>();
  let stopped = false;
  // One virtual-tree hash identifies every reusable lane up front; each wave
  // then refreshes it once (see advanceGithubCheckLaneProofs).
  const allLanes = A.flatMap(waves, (wave) => wave.lanes);
  let session = yield* prepareLaneProofSession(allLanes, laneProofMode).pipe(
    QualityTaskConfigurationError.mapError("Failed to prepare the lane-proof session.")
  );

  for (const [waveIndex, wave] of A.map(waves, (wave, index) => [index, wave] as const)) {
    if (stopped) {
      laneRuns = A.appendAll(
        laneRuns,
        A.map(wave.lanes, (lane) =>
          GithubCheckLaneRun.make({ id: lane.id, stage: lane.stage, status: "not-run-early-stop", wave: lane.wave })
        )
      );
      qualityTaskLaneRuns = A.appendAll(
        qualityTaskLaneRuns,
        yield* Effect.forEach(wave.lanes, appendSkippedQualityTaskLaneRun)
      );
      continue;
    }

    const {
      activeReusableIds,
      failures: waveFailures,
      laneRuns: waveLaneRuns,
      skippedLaneIds,
      stoppedAfterRed,
      successes,
    } = yield* runGithubCheckWave(`${label}:${wave.wave}`, wave, failurePolicy, concurrency, session);
    // The refresh is skipped only when nothing would read it: no proof to
    // persist and no later wave to identify.
    if (A.isReadonlyArrayNonEmpty(successes) || (!stoppedAfterRed && waveIndex < A.length(waves) - 1)) {
      session = yield* advanceGithubCheckLaneProofs(session, allLanes, successes);
    }
    const failedLabels = A.map(waveFailures, (failure) => failure.label);
    laneRuns = A.appendAll(
      laneRuns,
      A.map(wave.lanes, (lane) =>
        GithubCheckLaneRun.make({
          id: lane.id,
          stage: lane.stage,
          status: githubCheckLaneRunStatus(lane, activeReusableIds, failedLabels, skippedLaneIds),
          wave: lane.wave,
        })
      )
    );
    qualityTaskLaneRuns = A.appendAll(qualityTaskLaneRuns, waveLaneRuns);
    failures = A.appendAll(failures, waveFailures);
    stopped = stoppedAfterRed;
  }

  const firstRed = pipe(
    A.head(failures),
    O.map((failure) => failure.label)
  );
  const skippedAfterRed = A.length(
    A.filter(laneRuns, (lane) => GithubCheckLaneRunStatus.is["not-run-early-stop"](lane.status))
  );

  return {
    report: GithubCheckRunReport.make({
      failurePolicy,
      firstRed,
      lanes: laneRuns,
      schemaVersion: "github-check-run/v1",
      skippedAfterRed,
    }),
    laneReport: QualityTaskLaneRunReport.make({
      schemaVersion: "quality-task-lane-run/v1",
      lanes: qualityTaskLaneRuns,
    }),
    failures,
  };
});

const githubCheckRunReportJson = JsonStringCodec(GithubCheckRunReport);
const qualityTaskLaneRunReportJson = JsonStringCodec(QualityTaskLaneRunReport);
const decodeQualityTaskLaneRunReportOption = S.decodeUnknownOption(S.fromJsonString(QualityTaskLaneRunReport));
const laneReportTextEncoder = new TextEncoder();

const appendQualityTaskLaneRun = Effect.fn("QualityTasks.appendLaneRun")(function* (lane: QualityTaskLaneRun) {
  const parentLaneId = O.fromUndefinedOr(Bun.env[QUALITY_TASK_LANE_RUN_PARENT_ID_ENV]);
  const artifactPath = O.fromUndefinedOr(Bun.env[QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV]);
  yield* O.match(artifactPath, {
    onNone: () => Effect.void,
    onSome: Effect.fn("QualityTasks.appendLaneRun.onSome")(function* (target) {
      const reportJson = yield* qualityTaskLaneRunReportJson
        .encode(
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            parentLaneId,
            lanes: [lane],
          })
        )
        .pipe(QualityTaskConfigurationError.mapError("Failed to encode the quality-task lane run report."));
      yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          const file = yield* fs.open(target, { flag: "a" });
          yield* file.writeAll(laneReportTextEncoder.encode(`${reportJson}\n`));
          yield* file.sync;
        }).pipe(QualityTaskConfigurationError.mapError("Failed to write the durable quality-task lane report."))
      );
    }),
  });
});

const qualityTaskLaneRunReportFromArtifact = Effect.fn("QualityTasks.reportFromArtifact")(function* (
  fallback: QualityTaskLaneRunReport
) {
  const artifactPath = O.fromUndefinedOr(Bun.env[QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV]);
  const parentLaneId = O.fromUndefinedOr(Bun.env[QUALITY_TASK_LANE_RUN_PARENT_ID_ENV]);
  return yield* O.match(artifactPath, {
    onNone: () => Effect.succeed(QualityTaskLaneRunReport.make({ ...fallback, parentLaneId })),
    onSome: Effect.fn("QualityTasks.reportFromArtifact.onSome")(function* (target) {
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(target).pipe(Effect.option);
      if (O.isNone(text)) {
        return QualityTaskLaneRunReport.make({ ...fallback, parentLaneId });
      }
      const reports = A.getSomes(
        A.map(pipe(text.value, Str.split("\n"), A.filter(Str.isNonEmpty)), (line) =>
          decodeQualityTaskLaneRunReportOption(line)
        )
      );
      const matchingReports = A.filter(
        reports,
        (report) => O.getOrElse(report.parentLaneId, () => Str.empty) === O.getOrElse(parentLaneId, () => Str.empty)
      );
      return A.isReadonlyArrayNonEmpty(matchingReports)
        ? QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            parentLaneId,
            lanes: A.flatMap(matchingReports, (report) => report.lanes),
          })
        : QualityTaskLaneRunReport.make({ ...fallback, parentLaneId });
    }),
  });
});

const emitQualityTaskLaneRunReport = Effect.fn("QualityTasks.emitLaneRunReport")(function* (
  report: QualityTaskLaneRunReport
) {
  const reportJson = yield* qualityTaskLaneRunReportJson
    .encode(report)
    .pipe(QualityTaskConfigurationError.mapError("Failed to encode the quality-task lane run report."));
  yield* Console.log(`${QUALITY_TASK_LANE_RUN_REPORT_PREFIX}${reportJson}`);
});

/**
 * Run local GitHub-check waves, emit their schema-backed report, and fail with
 * the aggregate failures from every wave that was scheduled.
 *
 * **Example** (Run an empty battery)
 *
 * ```ts
 * import { runQualityTaskGithubCheckLaneWaves } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskGithubCheckLaneWaves("pre-push", [], "fail-fast"))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param waves - Static lane waves in execution order.
 * @param failurePolicy - Whether a precise red stops subsequent scheduling.
 * @param concurrency - Lanes run at once inside one wave (D9: 4 for the cheap tier, 1 for pre-push).
 * @category execution
 * @since 0.0.0
 */
export const runQualityTaskGithubCheckLaneWaves = Effect.fn("QualityTasks.runGithubCheckLaneWaves")(function* (
  label: string,
  waves: ReadonlyArray<GithubCheckLaneWaveSpec>,
  failurePolicy: GithubCheckFailurePolicy,
  concurrency = 1
) {
  const result = yield* collectGithubCheckLaneWaves(label, waves, failurePolicy, undefined, concurrency);
  const reportJson = yield* githubCheckRunReportJson
    .encode(result.report)
    .pipe(QualityTaskConfigurationError.mapError("Failed to encode the GitHub-check wave report."));
  yield* Console.log(`${GITHUB_CHECK_RUN_REPORT_PREFIX}${reportJson}`);
  yield* O.match(result.report.firstRed, {
    onNone: () => Effect.void,
    onSome: (firstRed) =>
      Console.error(
        `[beep-cli] ${label}: first red ${firstRed}; skipped ${result.report.skippedAfterRed} lane(s) after red`
      ),
  });
  yield* emitQualityTaskLaneRunReport(yield* qualityTaskLaneRunReportFromArtifact(result.laneReport));
  yield* failQualityTaskFailures(label, result.failures);
});

/**
 * Execute named streaming lanes, emit their execution report, and retain every
 * failure before returning.
 *
 * **Example** (Run an empty named battery)
 *
 * ```ts
 * import { runQualityTaskStreamingLaneGroup } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runQualityTaskStreamingLaneGroup("ci:local", []))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param lanes - Stable lane ids, executable steps, and optional executor-provided digests.
 * @param concurrency - Maximum number of lanes executed concurrently.
 * @category execution
 * @since 0.0.0
 */
export const runQualityTaskStreamingLaneGroup = Effect.fn("QualityTasks.runStreamingLaneGroup")(function* (
  label: string,
  lanes: ReadonlyArray<QualityTaskLaneInput>,
  concurrency = 1
) {
  const result = yield* collectQualityTaskLaneRuns(label, lanes, concurrency);
  yield* emitQualityTaskLaneRunReport(yield* qualityTaskLaneRunReportFromArtifact(result.report));
  yield* failQualityTaskFailures(label, result.failures);
});

const collectResolvedStepOutput = Effect.fn("QualityTasks.collectResolvedStepOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<
  QualityTaskStepOutput,
  QualityTaskConfigurationError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  yield* assertCacheRuntimeKeyUnspecified(step.command, step.args, Bun.env, step.env ?? {}).pipe(
    QualityTaskConfigurationError.mapError("Rejected a caller-provided cache runtime identity.")
  );
  const command = commandText(step.command, step.args);
  const envOverrides = yield* turboEnvOverrides(step.command, step.args, Bun.env);
  const runtime = cacheRuntimeStep(step);
  const captureTimeout = step.captureTimeoutMillis;
  const result = yield* runCaptured({
    command: runtime.command,
    args: runtime.args,
    cwd: step.cwd,
    env: {
      ...envOverrides,
      ...(step.env ?? {}),
    },
    extendEnv: turboEnvExtendsAmbient(step.command, step.args),
    source: "all",
    bound: qualityStepOutputBound,
    trim: true,
    ...(P.isUndefined(captureTimeout)
      ? {}
      : {
          forceKillAfter: QUALITY_CAPTURE_FORCE_KILL_AFTER,
          timeout: captureTimeout,
        }),
  }).pipe(
    Effect.catchTag("CaptureCommandTimedOutError", (error) => error.pipe(capturedTimeoutResult, Effect.succeed)),
    QualityTaskConfigurationError.mapError(`Failed to spawn ${command}`)
  );

  return {
    command,
    exitCode: result.exitCode,
    output: result.output,
    step,
  };
});

const collectStepOutputInternal = Effect.fn("QualityTasks.collectStepOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<QualityTaskStepOutput, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const resolved = yield* withTurboSecretSession(step);
  return yield* collectResolvedStepOutput(resolved);
});

const renderStepOutput = Effect.fn("QualityTasks.renderStepOutput")(function* (result: QualityTaskStepOutput) {
  if (Str.isNonEmpty(result.output)) {
    yield* Console.log(`[beep-cli] ${result.step.label} output:\n${result.output}`);
  }
});

const failureFromOutput = (result: QualityTaskStepOutput) =>
  QualityTaskFailed.new(result.exitCode, result.step.label, result.command);

const failedStepOutputs: (results: ReadonlyArray<QualityTaskStepOutput>) => ReadonlyArray<QualityTaskFailed> = flow(
  A.filter((result) => result.exitCode !== 0),
  A.map(failureFromOutput)
);

const runStepGroup = Effect.fn("QualityTasks.runStepGroup")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency: number
) {
  if (A.isReadonlyArrayEmpty(steps)) {
    return;
  }

  yield* Console.log(`[beep-cli] ${label}: running ${A.length(steps)} step(s) with concurrency ${concurrency}`);
  const resolvedSteps = yield* Effect.forEach(steps, withTurboSecretSession);
  yield* Effect.forEach(resolvedSteps, (step) =>
    Console.log(`[beep-cli] ${step.label}: ${commandText(step.command, step.args)}`)
  );
  const results = yield* Effect.forEach(
    resolvedSteps,
    (step) =>
      collectResolvedStepOutput(step).pipe(
        Effect.timed,
        Effect.tap(([elapsed]) => Console.log(`[beep-cli] ${step.label}: done in ${Duration.toMillis(elapsed)}ms`)),
        Effect.map(([, result]) => result)
      ),
    { concurrency }
  );

  yield* Effect.forEach(results, renderStepOutput, { discard: true });

  const failures = failedStepOutputs(results);
  yield* failQualityTaskGroup(label, failures);
});

const turboStep = (cwd: string, label: string, tasks: ReadonlyArray<string>, args: ReadonlyArray<string>) => {
  const env = turboCoverageEnv(tasks, args);
  return QualityTaskStep.make({
    label,
    command: "bunx",
    args: turboRunArgs(tasks, args),
    cwd,
    ...O.getSomesStruct({
      env: O.fromUndefinedOr(env),
      useLocalEnv: turboStepLocalEnv(env, turboCachePlanNeedsSecretSession(turboCachePlan(args))),
    }),
  });
};

const coverageStep = (cwd: string, options: CoverageTaskOptions) => {
  // A narrow ratchet run resolves its owners through the planner, but a direct
  // invocation only carries them as turbo filters.
  const topologyPackageNames =
    options.topologyPackageNames ??
    (A.isReadonlyArrayNonEmpty(options.expectedPackageNames)
      ? options.expectedPackageNames
      : explicitTurboFilterValues(options.args));
  return QualityTaskStep.make({
    label: options.writeBaseline ? "coverage:baseline" : "coverage:ratchet",
    command: "bunx",
    args: turboRunArgs(["coverage"], [...options.args, ...coverageVitestTopologyArgs(topologyPackageNames)]),
    cwd,
    env: {
      ...coverageEnvironment(),
      ...(options.writeBaseline ? { VITEST_COVERAGE_REPORT_ONLY: "1" } : {}),
    },
  });
};

const coverageFullShardStep = (
  cwd: string,
  index: number,
  packageNames: ReadonlyArray<string>,
  passthroughArgs: ReadonlyArray<string>,
  writeBaseline: boolean
) =>
  QualityTaskStep.make({
    label: `coverage:shard-${index}`,
    command: "bunx",
    args: turboRunArgs(
      ["coverage"],
      [
        "--only",
        "--concurrency=1",
        "--summarize",
        ...passthroughArgs,
        ...A.map(packageNames, (packageName) => `--filter=${packageName}`),
        ...coverageVitestTopologyArgs(packageNames),
      ]
    ),
    cwd,
    env: {
      ...coverageEnvironment(),
      ...(writeBaseline ? { VITEST_COVERAGE_REPORT_ONLY: "1" } : {}),
    },
  });

const bunRunStep = (cwd: string, label: string, args: ReadonlyArray<string>) =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["run", ...args],
    cwd,
  });

const bunxStep = (cwd: string, label: string, args: ReadonlyArray<string>) =>
  QualityTaskStep.make({
    label,
    command: "bunx",
    args,
    cwd,
  });

const repoCliStep = (cwd: string, label: string, args: ReadonlyArray<string>) =>
  bunRunStep(cwd, label, [REPO_CLI_ENTRY_PATH, "--", ...args]);

type SqlIntegrationChildCommand = {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
};

type SqlIntegrationLaneResource = Pick<PgliteTestcontainerResource, "connectionUri">;

type SqlIntegrationLaneOptions = {
  readonly acquireResource: Effect.Effect<SqlIntegrationLaneResource, QualityTaskConfigurationError, Scope.Scope>;
  readonly args: ReadonlyArray<string>;
  readonly childCommand?: SqlIntegrationChildCommand;
  readonly repoRoot: string;
};

const sqlIntegrationEnv = (connectionUri: string): Record<string, string> => ({
  BEEP_TEST_DATABASE_CONNECT_TIMEOUT_MS: "5000",
  BEEP_TEST_DATABASE_DRIVER: "pg-external",
  BEEP_TEST_DATABASE_ISOLATION: "schema",
  BEEP_TEST_DATABASE_MAX_CONNECTIONS: "1",
  BEEP_TEST_DATABASE_SCHEMA_PREFIX: "beep_test",
  BEEP_TEST_DATABASE_SSL: "false",
  BEEP_TEST_DATABASE_URL: connectionUri,
});

const sqlIntegrationChildCommand = (args: ReadonlyArray<string>): SqlIntegrationChildCommand => ({
  command: "bunx",
  args: turboRunArgs(["test:integration:serial"], ["--concurrency=1", ...withoutTurboConcurrencyArgs(args)]),
});

const withRyukDisabledDuringAcquire = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const env = globalThis.process.env;
      const previous = env.TESTCONTAINERS_RYUK_DISABLED;
      if (previous === undefined) {
        env.TESTCONTAINERS_RYUK_DISABLED = "true";
      }
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        const env = globalThis.process.env;
        if (previous === undefined) {
          delete env.TESTCONTAINERS_RYUK_DISABLED;
        } else {
          env.TESTCONTAINERS_RYUK_DISABLED = previous;
        }
      })
  );

const sqlIntegrationStep = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  resource: SqlIntegrationLaneResource,
  childCommand: SqlIntegrationChildCommand = sqlIntegrationChildCommand(args)
) =>
  QualityTaskStep.make({
    label: "test:integration:serial",
    command: childCommand.command,
    args: childCommand.args,
    cwd: repoRoot,
    env: sqlIntegrationEnv(resource.connectionUri),
  });

const loadTestUtilsModule = Effect.tryPromise({
  try: () => import("@beep/test-utils"),
  catch: (cause) =>
    QualityTaskConfigurationError.new(
      `Failed to load @beep/test-utils SQL integration helpers: ${Inspectable.toStringUnknown(cause, 0)}`
    ),
});

const acquireTestcontainersSqlIntegrationResource = withRyukDisabledDuringAcquire(
  Effect.flatMap(loadTestUtilsModule, ({ makePgliteTestcontainerResource }) => makePgliteTestcontainerResource())
).pipe(QualityTaskConfigurationError.mapError("Failed to start shared PGLite SQL integration database"));

const acquireExternalSqlIntegrationResource = (connectionUri: string): Effect.Effect<SqlIntegrationLaneResource> =>
  Effect.succeed({ connectionUri });

const acquireDefaultSqlIntegrationResource = Effect.gen(function* () {
  const beepTestDatabaseUrl = yield* configStringOption("BEEP_TEST_DATABASE_URL");
  const databaseUrl = yield* configStringOption("DATABASE_URL");
  const databaseUrlUnpooled = yield* configStringOption("DATABASE_URL_UNPOOLED");

  return yield* pipe(
    sqlIntegrationConnectionUriFromEnv({
      BEEP_TEST_DATABASE_URL: O.getOrUndefined(beepTestDatabaseUrl),
      DATABASE_URL: O.getOrUndefined(databaseUrl),
      DATABASE_URL_UNPOOLED: O.getOrUndefined(databaseUrlUnpooled),
    }),
    O.match({
      onNone: () => acquireTestcontainersSqlIntegrationResource,
      onSome: acquireExternalSqlIntegrationResource,
    })
  );
});

const runSqlIntegrationTestLane = Effect.fn("QualityTasks.runSqlIntegrationTestLane")(function* (
  options: SqlIntegrationLaneOptions
) {
  yield* Effect.scoped(
    Effect.gen(function* () {
      const resource = yield* options.acquireResource;
      yield* runStep(sqlIntegrationStep(options.repoRoot, options.args, resource, options.childCommand));
    })
  );
});

type SqlIntegrationStepForTestingOptions = {
  readonly connectionUri: string;
};

/**
 * Build the SQL integration test subprocess step. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { sqlIntegrationStepForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const step = sqlIntegrationStepForTesting("/repo", ["--filter", "@beep/db"], {
 *   connectionUri: "postgres://localhost:5432/test"
 * })
 * console.log(step.label) // "test:integration"
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param args - Turbo passthrough arguments.
 * @param options - Shared PostgreSQL-compatible test database options.
 * @returns Planned SQL integration subprocess step.
 * @category utilities
 * @since 0.0.0
 */
export const sqlIntegrationStepForTesting: {
  (repoRoot: string, args: ReadonlyArray<string>, options: SqlIntegrationStepForTestingOptions): QualityTaskStep;
  (args: ReadonlyArray<string>, options: SqlIntegrationStepForTestingOptions): (repoRoot: string) => QualityTaskStep;
} = dual(3, (repoRoot: string, args: ReadonlyArray<string>, options: SqlIntegrationStepForTestingOptions) =>
  sqlIntegrationStep(repoRoot, args, options)
);

/**
 * Run the SQL integration lane with an injected resource and child command.
 * Exposed for lifecycle-focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runSqlIntegrationTestLaneForTesting } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * const program = runSqlIntegrationTestLaneForTesting({
 *   acquireResource: Effect.die("provide a real SQL resource acquisition"),
 *   args: [],
 *   repoRoot: "/repo"
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runSqlIntegrationTestLaneForTesting = runSqlIntegrationTestLane;

/**
 * Resolve the SQL integration database connection URI from environment variables.
 * Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { sqlIntegrationConnectionUriFromEnvForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const result = sqlIntegrationConnectionUriFromEnvForTesting({ DATABASE_URL: "postgres://localhost/beep" })
 * console.log(result) // rendered command output
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sqlIntegrationConnectionUriFromEnvForTesting = sqlIntegrationConnectionUriFromEnv;

const optionalQualityTaskStep = ({ enabled, step }: OptionalQualityTaskStep): ReadonlyArray<QualityTaskStep> =>
  enabled ? A.of(step()) : A.empty();

const rootBuildSteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
) => [
  QualityTaskStep.make({
    ...turboStep(repoRoot, "build", ["build"], boundedRootTurboArgs(args, plan)),
    flakeQuarantine: "ts2589-no-location",
  }),
];

const rootCheckSteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
) => [
  QualityTaskStep.make({
    ...turboStep(repoRoot, "check", ["check"], boundedRootTurboArgs(args, plan)),
    flakeQuarantine: "ts2589-no-location",
  }),
  // `tsgo-rules` keeps its single owner in lint-policy (`lint:tsgo-rules`);
  // standalone rule diagnostics have their own parallel heavy lane. Test-file
  // typecheck (`quality test-tsgo`) also has one owner, the lint-policy plan:
  // its Turbo task is uncached, so a second copy here made `audit packages`
  // and a check-then-lint session walk the test files twice (perf audit G8,
  // 2026-11-02). Check owns only the smoke canary; run
  // `bun run beep quality test-tsgo` directly for a check-only session.
  ...optionalQualityTaskStep({
    enabled: shouldRunRepoWideSteps(args),
    step: () => repoCliStep(repoRoot, "quality:tsgo-smoke", ["quality", "tsgo-smoke"]),
  }),
];

// Policy lint takes its width from the concurrency plan: Check's accepted overrides
// (`BEEP_QUALITY_CHECK_CONCURRENCY`) over the profile's policy lint budget. Two graphs that
// run abreast split that budget through `width`.
const policyLintTurboStep = (
  repoRoot: string,
  label: string,
  tasks: ReadonlyArray<string>,
  base?: string,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan(),
  width: number = plan.policyLint
): QualityTaskStep => {
  // Scope is the caller's decision: a base means a scoped local run, no base means full scope
  // (the policy task folds CI into full scope before building the plan).
  const affected = !P.isUndefined(base);
  const step = turboStep(repoRoot, label, tasks, [
    `--concurrency=${width}`,
    "--continue=dependencies-successful",
    "--summarize",
    ...(affected ? ["--affected"] : []),
  ]);
  return QualityTaskStep.make({
    ...step,
    ...(affected ? { env: { ...step.env, TURBO_SCM_BASE: base } } : {}),
  });
};

const deprecatedApisTurboStep = (
  repoRoot: string,
  base?: string,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
): QualityTaskStep => policyLintTurboStep(repoRoot, "lint:deprecated-apis", ["lint:deprecated-apis"], base, plan);

const decodeLintPolicySweeps = Jsonc.bind(LintPolicySweeps).decode;
const oxlintPolicySweeps = LintPolicySweeps.make({ schemaVersion: "lint-policy-sweeps/v1", deprecatedApis: "oxlint" });

/**
 * Read the required repository sweep selection, failing on missing or invalid JSONC.
 *
 * **Example** (Read the sweep configuration)
 * ```ts
 * import { readLintPolicySweeps } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(readLintPolicySweeps("/repo")))
 * ```
 *
 * @param repoRoot - Repository containing the required standards file.
 * @returns The validated sweep configuration.
 * @category configuration
 * @since 0.0.0
 */
export const readLintPolicySweeps = Effect.fn("QualityTasks.readLintPolicySweeps")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, "standards/lint-policy.sweeps.jsonc");
  return yield* fs
    .readFileString(file)
    .pipe(
      Effect.flatMap(decodeLintPolicySweeps),
      QualityTaskConfigurationError.mapError(`Cannot read lint policy sweep configuration: ${file}`)
    );
});

// D10 partitions the existing policy checks. D2 and uncertified binary walkers
// are unfiltered even locally; their non-file state cannot drive affected selection.
const policyCheapTasks = [
  "lint:package-scripts",
  "lint:deprecated-imports",
  "lint:policy-fingerprint",
  "lint:tsgo-rules",
  "lint:ecosystem-polarity",
  "lint:allowlist",
  "goals:index-check",
  "lint:reflection-artifacts",
  "lint:roadmap-refs",
  "lint:judge-rubric",
];
const policyMediumTasks = [
  "lint:laws",
  "lint:native-runtime:roots",
  "lint:schema-first",
  "lint:identity-registry",
  "lint:circular",
  "lint:effect-imports",
  "lint:effect-imports-markdown",
  "lint:markdown-fences",
  "lint:retired-effect-paths",
  "lint:retired-iri-authorities",
  "lint:schema-tag-idioms",
  "lint:holds",
  "lint:tsconfig-overlay",
  "lint:package-test-typecheck",
  "lint:effect-vitest",
  "lint:opaque-roundtrips",
];
// The git-delta checks compare the merge-base archive with HEAD. They are uncached by
// contract and cost about two minutes on a clean tree, so a local full-scope `bun run lint`
// (no review base, no PR) leaves them to the hosted plan and to the changed-scope
// `lint:policy` run, which carries an explicit base.
const policyGitDeltaTasks = ["knowledge:semantic-delta", "knowledge:refs-check"];
const policyStateTasks = [
  ...policyGitDeltaTasks,
  "lint:jsdoc-module-tags",
  "goals:doctor",
  "lint:oxlint",
  "lint:shadcn",
  "lint:typos",
  "jsdoc:inventory:check",
  "jsdoc:ratchet:check",
];
const fullScopeStateTasks = (hosted: boolean): ReadonlyArray<string> =>
  hosted ? policyStateTasks : A.filter(policyStateTasks, (task) => !A.contains(policyGitDeltaTasks, task));
// Changed scope splits the state phase by cache contract. The cached tasks' inputs are certified
// (standards/cache-qualification-baseline.json), so Turbo's task-input selection skips them exactly
// when a cache hit would replay them; they join the affected medium graph. The D2 git-delta and
// clock checks and the uncertified binary walkers stay unfiltered (standards/turbo-remote-cache.md)
// in a graph that runs abreast of the medium one, so its long poles overlap as they do in the
// single full-scope graph.
const policyCachedStateTasks = ["lint:jsdoc-module-tags", "jsdoc:inventory:check", "jsdoc:ratchet:check"];
const policyUnscopedStateTasks = A.filter(policyStateTasks, (task) => !A.contains(policyCachedStateTasks, task));
// The unfiltered state graph is a handful of single-process tasks whose serial sum stays under
// the medium graph's long pole, so one slot of the budget is enough for it.
const POLICY_UNSCOPED_STATE_WIDTH = 1;
// Root documentation lint always runs oxlint; Turbo owns package/incremental caches.
const rootDocsArgs = (docsConfig: string): ReadonlyArray<string> => [
  "oxlint",
  ".",
  "--config",
  docsConfig,
  "--max-warnings=0",
];
// Changed scope: one oxlint process over the package directories Turbo's `lint:jsdoc` selection
// picked (perf audit M16), instead of one repo-cli boot plus plugin load per package.
const affectedDocsArgs = (docsConfig: string, targets: ReadonlyArray<string>): ReadonlyArray<string> => [
  "oxlint",
  "--config",
  docsConfig,
  "--max-warnings=0",
  ...targets,
];
const rootDocsCacheKeySources = [
  ".oxlintrc.docs.json",
  "tsdoc.json",
  "bun.lock",
  "packages/tooling/policy-pack/lint-rules/package.json",
  "packages/tooling/policy-pack/lint-rules/src",
];
// The key a pure plan carries when no repository is read (tests and static plan inspection).
const UNKEYED_ROOT_DOCS_CACHE = "unkeyed";

const listRootDocsCacheKeyFiles = Effect.fnUntraced(function* (repoRoot: string, source: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.join(repoRoot, source);
  const info = yield* fs.stat(absolute);
  if (info.type !== "Directory") {
    return [source];
  }
  const entries = yield* fs.readDirectory(absolute, { recursive: true });
  const candidates = A.filter(
    entries,
    (entry) => Str.endsWith(".ts")(entry) || Str.endsWith(".mjs")(entry) || Str.endsWith(".json")(entry)
  );
  // A recursive listing may name directories; only files are read into the digest.
  const files = yield* Effect.filter(candidates, (entry) =>
    fs.stat(path.join(absolute, entry)).pipe(Effect.map((entryInfo) => entryInfo.type === "File"))
  );
  return A.map(files, (entry) => `${source}/${entry}`);
});

/**
 * Digest documentation config, plugin source and the installed dependency lock.
 *
 * **Details**
 * Package lint caches are owned by Turbo. Root oxlint does not use a persistent
 * result cache; this digest records the documentation inputs for plan consumers.
 * Missing inputs yield the unkeyed sentinel.
 *
 * **Example** (Identify documentation inputs)
 * ```ts
 * import { rootDocsCacheKey } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(rootDocsCacheKey("/repo")))
 * ```
 * @param repoRoot - Repository root directory.
 * @returns A deterministic input digest.
 * @category utilities
 * @since 0.0.0
 */
export const rootDocsCacheKey = Effect.fn("QualityTasks.rootDocsCacheKey")(
  function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const crypto = yield* Digest.Digest;
    const files = pipe(
      yield* Effect.forEach(rootDocsCacheKeySources, (source) => listRootDocsCacheKeyFiles(repoRoot, source)),
      A.flatten,
      A.sort(Order.String)
    );
    const parts = yield* Effect.forEach(files, (file) =>
      fs.readFileString(`${repoRoot}/${file}`).pipe(Effect.map((content) => `${file}\0${content}\0`))
    );
    const digest = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(A.join(parts, "")));
    return Str.slice(0, 16)(Hex.encode(digest));
  },
  Effect.orElseSucceed(() => UNKEYED_ROOT_DOCS_CACHE)
);

// The Stage-2 knowledge doctor follows the semantic delta wherever that runs. `doctor ci` stays
// report-only (exit 0 on findings) until the merge-base tracks the sealed baseline the CI mint
// opens; a branch touching the baseline or promotions gets the gate and its seal guard even before
// then. Under the gate only promoted kinds and governance findings block (K24). A local full-scope
// plan leaves it to the hosted plan.
const knowledgeDoctorPolicySteps = (repoRoot: string, base: string | undefined, hosted: boolean) =>
  O.match(O.fromUndefinedOr(base), {
    onNone: () => (hosted ? [repoCliStep(repoRoot, "knowledge:doctor", ["knowledge", "doctor", "ci"])] : []),
    onSome: (ref) => [repoCliStep(repoRoot, "knowledge:doctor", ["knowledge", "doctor", "ci", "--base", ref])],
  });

// Inputs the runtime resolves before planning; a pure plan reads the source docs config and has no
// Turbo target probe, so its changed-scope medium graph keeps the per-package `lint:jsdoc` tasks.
type LintPolicyPlanOptions = {
  readonly docsConfig?: string | undefined;
  readonly targets?: LintPolicyAffectedTargets | undefined;
};

// A stage's steps run abreast; stages run in order.
type LintPolicyStage = A.NonEmptyReadonlyArray<QualityTaskStep>;

const withPolicyCaptureTimeout = (step: QualityTaskStep): QualityTaskStep =>
  QualityTaskStep.make({ ...step, captureTimeoutMillis: QUALITY_CAPTURE_TIMEOUT_MILLIS });

const policyStage = (...steps: A.NonEmptyReadonlyArray<QualityTaskStep>): LintPolicyStage =>
  A.map(steps, withPolicyCaptureTimeout);

// The test lane's own Turbo task is `package-test-typecheck` (uncached by tripwire
// ruling); the orchestrating command stays a repo-cli step.
const testTsgoPolicyStage = (repoRoot: string): LintPolicyStage =>
  policyStage(repoCliStep(repoRoot, "quality:test-tsgo", ["quality", "test-tsgo"]));

const fullScopePolicyStages = (
  repoRoot: string,
  sweeps: LintPolicySweeps,
  hosted: boolean,
  docsConfig: string,
  plan: QualityConcurrencyPlan
): ReadonlyArray<LintPolicyStage> => [
  policyStage(policyLintTurboStep(repoRoot, "lint:policy:cheap", policyCheapTasks, undefined, plan)),
  policyStage(
    policyLintTurboStep(
      repoRoot,
      "lint:policy:medium",
      [...policyMediumTasks, ...fullScopeStateTasks(hosted)],
      undefined,
      plan
    )
  ),
  ...A.map(knowledgeDoctorPolicySteps(repoRoot, undefined, hosted), (step) => policyStage(step)),
  // Ruling 31 retains the hosted root docs program independently of the
  // deprecated-API sweep switch. It has no Turbo summary of its own.
  policyStage(bunxStep(repoRoot, "lint:jsdoc", rootDocsArgs(docsConfig))),
  policyStage(
    sweeps.deprecatedApis === "oxlint"
      ? repoCliStep(repoRoot, "lint:deprecated-apis", ["lint", "deprecated-apis", "--full"])
      : deprecatedApisTurboStep(repoRoot, undefined, plan)
  ),
  testTsgoPolicyStage(repoRoot),
];

// With a Turbo target probe, the documentation and (oxlint-swept) deprecated-API package tasks
// each run as one root process over the directories Turbo selected; an empty selection plans no
// step. Without one, the per-package Turbo tasks stay in their graphs.
const changedScopeDocsStages = (
  repoRoot: string,
  docsConfig: string,
  targets: O.Option<LintPolicyAffectedTargets>
): ReadonlyArray<LintPolicyStage> =>
  pipe(
    targets,
    O.flatMap(({ jsdoc }) => O.liftPredicate(jsdoc, A.isReadonlyArrayNonEmpty)),
    O.match({
      onNone: A.empty<LintPolicyStage>,
      onSome: (jsdoc) => [policyStage(bunxStep(repoRoot, "lint:jsdoc", affectedDocsArgs(docsConfig, jsdoc)))],
    })
  );

const changedScopeDeprecatedApisStages = (
  repoRoot: string,
  base: string,
  sweeps: LintPolicySweeps,
  targets: O.Option<LintPolicyAffectedTargets>,
  plan: QualityConcurrencyPlan
): ReadonlyArray<LintPolicyStage> =>
  O.match(
    O.filter(targets, () => sweeps.deprecatedApis === "oxlint"),
    {
      onNone: () => [policyStage(deprecatedApisTurboStep(repoRoot, base, plan))],
      onSome: ({ deprecatedApis }) =>
        A.isReadonlyArrayNonEmpty(deprecatedApis)
          ? [
              policyStage(
                repoCliStep(repoRoot, "lint:deprecated-apis", [
                  "lint",
                  "deprecated-apis",
                  ...A.flatMap(deprecatedApis, (target) => ["--target", target]),
                ])
              ),
            ]
          : [],
    }
  );

const changedScopePolicyStages = (
  repoRoot: string,
  base: string,
  sweeps: LintPolicySweeps,
  hosted: boolean,
  docsConfig: string,
  targets: O.Option<LintPolicyAffectedTargets>,
  plan: QualityConcurrencyPlan
): ReadonlyArray<LintPolicyStage> => [
  policyStage(policyLintTurboStep(repoRoot, "lint:policy:cheap", policyCheapTasks, base, plan)),
  policyStage(
    policyLintTurboStep(
      repoRoot,
      "lint:policy:medium",
      [
        ...policyMediumTasks,
        ...(O.isNone(targets) ? ["lint:jsdoc"] : []),
        "lint:jsdoc:root",
        ...policyCachedStateTasks,
      ],
      base,
      plan,
      Math.max(1, plan.policyLint - POLICY_UNSCOPED_STATE_WIDTH)
    ),
    policyLintTurboStep(
      repoRoot,
      "lint:policy:state",
      policyUnscopedStateTasks,
      undefined,
      plan,
      POLICY_UNSCOPED_STATE_WIDTH
    )
  ),
  ...A.map(knowledgeDoctorPolicySteps(repoRoot, base, hosted), (step) => policyStage(step)),
  ...changedScopeDocsStages(repoRoot, docsConfig, targets),
  ...changedScopeDeprecatedApisStages(repoRoot, base, sweeps, targets, plan),
  testTsgoPolicyStage(repoRoot),
];

// The overlay, test-typecheck, effect-vitest and JSDoc ratchet checks are root Turbo
// tasks (cached, fingerprint-closed) inside the medium and state phases; the JSDoc ratchet
// depends on the inventory task, so Turbo's `--continue=dependencies-successful` skips the
// compare whenever the inventory phase is red instead of a label-keyed rule here. The
// documentation input digest stays a plan input for consumers; the argv does not carry it.
const rootRepoLintPolicyStages = (
  repoRoot: string,
  base: string | undefined,
  sweeps: LintPolicySweeps,
  hosted: boolean,
  _docsCacheKey: string,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan(),
  options: LintPolicyPlanOptions = {}
): ReadonlyArray<LintPolicyStage> => {
  const docsConfig = options.docsConfig ?? DOCS_OXLINT_CONFIG;
  return O.match(O.fromUndefinedOr(base), {
    onNone: () => fullScopePolicyStages(repoRoot, sweeps, hosted, docsConfig, plan),
    onSome: (ref) =>
      changedScopePolicyStages(repoRoot, ref, sweeps, hosted, docsConfig, O.fromUndefinedOr(options.targets), plan),
  });
};

const rootRepoLintPolicySteps = (
  repoRoot: string,
  _files: ReadonlyArray<string> | undefined,
  base: string | undefined,
  sweeps: LintPolicySweeps,
  hosted: boolean,
  docsCacheKey: string,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan(),
  options: LintPolicyPlanOptions = {}
): ReadonlyArray<QualityTaskStep> =>
  A.flatten(rootRepoLintPolicyStages(repoRoot, base, sweeps, hosted, docsCacheKey, plan, options));

// Run each stage in order, its steps abreast. Full-scope and hosted runs collect every failure
// (a hosted pull request runs changed-scope and must still report every phase); only a local
// changed-scope run stops after a red cheap phase.
const stopsAfterCheapRed = (step: QualityTaskStep, collectAll: boolean, result: QualityTaskStepOutput): boolean =>
  !collectAll && step.label === "lint:policy:cheap" && result.exitCode !== 0;

// Every command line is announced before the stage starts; outputs render in plan order once the
// whole stage finishes, so abreast steps never interleave their blocks.
const runPolicyStage = Effect.fn("QualityTasks.runPolicyStage")(function* (stage: LintPolicyStage) {
  const resolved = yield* Effect.forEach(stage, withTurboSecretSession);
  yield* Effect.forEach(
    stage,
    (step) => Console.log(`[beep-cli] ${step.label}: ${commandText(step.command, step.args)}`),
    { discard: true }
  );
  const results = yield* Effect.forEach(resolved, collectResolvedStepOutput, { concurrency: "unbounded" });
  yield* Effect.forEach(results, renderStepOutput, { discard: true });
  return results;
});

const runPolicyStages = Effect.fn("QualityTasks.runPolicyStages")(function* (
  stages: ReadonlyArray<LintPolicyStage>,
  collectAll: boolean
) {
  const results = A.empty<QualityTaskStepOutput>();
  yield* Console.log(`[beep-cli] lint:policy: running ${A.length(A.flatten(stages))} ordered step(s)`);
  for (const stage of stages) {
    const stageResults = yield* runPolicyStage(stage);
    A.appendAllInPlace(results, stageResults);
    if (A.some(A.zip(stage, stageResults), ([step, result]) => stopsAfterCheapRed(step, collectAll, result))) {
      yield* failQualityTaskGroup("lint:policy", failedStepOutputs(results));
    }
  }
  yield* failQualityTaskGroup("lint:policy", failedStepOutputs(results));
});

const runPolicySteps = (steps: ReadonlyArray<QualityTaskStep>, collectAll: boolean) =>
  runPolicyStages(A.map(steps, A.of), collectAll);

/**
 * Build the repo-wide root lint policy subprocess steps.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { rootLintPolicyStepsForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(rootLintPolicyStepsForTesting("/repo").map((step) => step.label))
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param files - Compatibility input; Turbo now owns file selection from the caller base.
 * @param base - Caller base for affected Turbo tasks; omitted for full scope.
 * @param sweeps - Explicit sweep selection; pure test plans default to oxlint.
 * @param hosted - Whether the plan is a hosted (CI) plan; a local full-scope plan leaves the
 *   git-delta knowledge checks and the report-only knowledge doctor to the hosted run. Defaults to
 *   the live CI detection.
 * @param docsCacheKey - Documentation input digest; the runtime digests the docs
 *   configuration sources, a pure plan carries `unkeyed`.
 * @param options - Runtime-resolved documentation config and Turbo target probe; a pure plan
 *   lints with the source docs config and keeps the per-package documentation tasks.
 * @returns Planned subprocess steps for policy-only lint verification.
 * @category utilities
 * @since 0.0.0
 */
export const rootLintPolicyStepsForTesting: {
  (
    files?: ReadonlyArray<string>,
    base?: string,
    sweeps?: LintPolicySweeps,
    hosted?: boolean,
    docsCacheKey?: string,
    options?: LintPolicyPlanOptions
  ): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
  (
    repoRoot: string,
    files?: ReadonlyArray<string>,
    base?: string,
    sweeps?: LintPolicySweeps,
    hosted?: boolean,
    docsCacheKey?: string,
    options?: LintPolicyPlanOptions
  ): ReadonlyArray<QualityTaskStep>;
} = dual(
  (args: IArguments) => P.isString(args[0]),
  (
    repoRoot: string,
    files?: ReadonlyArray<string>,
    base?: string,
    sweeps = oxlintPolicySweeps,
    hosted = isCiSync(),
    docsCacheKey = UNKEYED_ROOT_DOCS_CACHE,
    options: LintPolicyPlanOptions = {}
  ): ReadonlyArray<QualityTaskStep> =>
    rootRepoLintPolicySteps(repoRoot, files, base, sweeps, hosted, docsCacheKey, localQualityConcurrencyPlan(), options)
);

// A stage-level plan request: the scope base, the hosted posture and the runtime-resolved inputs.
type LintPolicyStagesRequest = LintPolicyPlanOptions & {
  readonly base?: string | undefined;
  readonly hosted?: boolean | undefined;
};

/**
 * Build the repo-wide root lint policy plan as ordered stages of abreast steps.
 *
 * **Example** (Inspect the changed-scope stages)
 *
 * ```ts
 * import { rootLintPolicyStagesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const stages = rootLintPolicyStagesForTesting("/repo", { base: "origin/main", hosted: true })
 * console.log(stages.map((stage) => stage.map((step) => step.label)))
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param request - Scope base (omitted for full scope), hosted posture (defaults to the live CI
 *   detection), documentation config and Turbo target probe.
 * @returns The plan's stages; each stage's steps run abreast.
 * @category utilities
 * @since 0.0.0
 */
export const rootLintPolicyStagesForTesting: {
  (request: LintPolicyStagesRequest): (repoRoot: string) => ReadonlyArray<ReadonlyArray<QualityTaskStep>>;
  (repoRoot: string, request: LintPolicyStagesRequest): ReadonlyArray<ReadonlyArray<QualityTaskStep>>;
} = dual(
  2,
  (repoRoot: string, request: LintPolicyStagesRequest): ReadonlyArray<ReadonlyArray<QualityTaskStep>> =>
    rootRepoLintPolicyStages(
      repoRoot,
      request.base,
      oxlintPolicySweeps,
      request.hosted ?? isCiSync(),
      UNKEYED_ROOT_DOCS_CACHE,
      localQualityConcurrencyPlan(),
      request
    )
);

// Turbo's dry-run plan carries every task's input hash map (tens of MiB on this graph), so the
// probe reads stdout under its own bound instead of the step output bound.
const LINT_POLICY_TARGET_PROBE_BOUND = OutputBound.make({
  maxChars: 512 * 1024 * 1024,
  truncatedNotice: "\n[beep-cli] lint:policy:targets: dry-run plan truncated",
});

const lintPolicyTargetProbeArgs = (): ReadonlyArray<string> => [
  "turbo",
  "run",
  ...LINT_POLICY_TARGET_TASKS,
  "--affected",
  "--dry=json",
  "--cache=local:r",
];

// Ask Turbo which `lint:jsdoc` / `lint:deprecated-apis` package tasks its changed-scope plan selects
// (the same `affectedUsingTaskInputs` selection the per-package tasks used). Any failure keeps the
// per-package Turbo tasks, which are slower but select the same packages.
const probeLintPolicyAffectedTargets = Effect.fn("QualityTasks.probeLintPolicyAffectedTargets")(function* (
  repoRoot: string,
  base: string
) {
  const args = lintPolicyTargetProbeArgs();
  yield* Console.log(`[beep-cli] lint:policy:targets: TURBO_SCM_BASE=${base} ${commandText("bunx", args)}`);
  const probe = yield* runCaptured({
    command: "bunx",
    args,
    cwd: repoRoot,
    env: { TURBO_SCM_BASE: base },
    extendEnv: true,
    source: "stdout",
    bound: LINT_POLICY_TARGET_PROBE_BOUND,
  }).pipe(
    QualityTaskConfigurationError.mapError("Failed to spawn the lint policy target probe."),
    Effect.filterOrFail(
      (result) => result.exitCode === 0 && !result.truncated,
      (result) =>
        QualityTaskConfigurationError.new(
          result.truncated
            ? "The lint policy target probe exceeded its capture bound."
            : `The lint policy target probe exited with code ${result.exitCode}.`
        )
    ),
    Effect.flatMap((result) => lintPolicyAffectedTargetsFromDryRun(result.output)),
    Effect.tapError((error) =>
      Console.log(`[beep-cli] lint:policy:targets: ${error.message} Keeping the per-package Turbo tasks.`)
    ),
    Effect.option
  );
  yield* O.match(probe, {
    onNone: () => Effect.void,
    onSome: ({ jsdoc, deprecatedApis }) =>
      Console.log(
        `[beep-cli] lint:policy:targets: lint:jsdoc ${A.length(jsdoc)} package(s), lint:deprecated-apis ${A.length(deprecatedApis)} package(s)`
      ),
  });
  return probe;
});

const LINT_POLICY_SCOPE_LOGGED_ESCALATIONS = 10;

const lintPolicyScopeLine = (scope: LintPolicyScope): string =>
  LintPolicyScope.match(scope, {
    affected: ({ changedFileCount }) => `changed (${changedFileCount} files)`,
    full: ({ escalations }) =>
      A.match(escalations, {
        onEmpty: () => "full",
        onNonEmpty: (all) => {
          const shown = A.map(
            A.take(all, LINT_POLICY_SCOPE_LOGGED_ESCALATIONS),
            ({ trigger, path }) => `${trigger} ${path}`
          );
          const hidden = A.length(all) - A.length(shown);
          return `full (escalated: ${A.join(shown, "; ")}${hidden > 0 ? `; +${hidden} more` : ""})`;
        },
      }),
  });

/**
 * Run the repo-wide root lint policy checks without the aggregate Turbo lint lane.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runRootLintPolicyTask } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const program = runRootLintPolicyTask(false)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
const runRootLintPolicyTaskInternal = Effect.fn("QualityTasks.runRootLintPolicyTask")(function* (
  full: boolean,
  base: string
): Effect.fn.Return<void, QualityTaskError, QualityTaskEnvironment> {
  const path = yield* Path.Path;
  const cwd = path.resolve(process.cwd());
  const repoRoot = yield* findRepoRoot(cwd);
  const sweeps = yield* readLintPolicySweeps(repoRoot);
  const scope = full ? LintPolicyFullScope.make({ escalations: [] }) : yield* resolveLintPolicyScope(repoRoot, base);
  yield* Console.log(`[beep-cli] lint:policy: scope=${lintPolicyScopeLine(scope)}`);
  const runFull = scope._tag === "full";
  const targets = runFull ? O.none() : yield* probeLintPolicyAffectedTargets(repoRoot, base);
  const docsConfig = yield* prepareDocsOxlintConfig(repoRoot);
  const docsCacheKey = yield* rootDocsCacheKey(repoRoot);
  const plan = yield* qualityConcurrencyPlan;
  yield* runPolicyStages(
    rootRepoLintPolicyStages(repoRoot, runFull ? undefined : base, sweeps, isCiSync(), docsCacheKey, plan, {
      docsConfig,
      targets: O.getOrUndefined(targets),
    }),
    runFull || isCiSync()
  );
});

/**
 * Run the root lint policy battery (changed-scope by default, full on demand).
 *
 * **Example** (Use runRootLintPolicyTask)
 *
 * ```ts
 * import { runRootLintPolicyTask } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const program = runRootLintPolicyTask(false)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param full - Run the full-repo sweep instead of the changed-scope default; the
 *   command decides this from `--full` or `CI`, so the task never reads the environment.
 * @param base - Caller base for changed files and affected Turbo tasks.
 * @returns The lint policy battery effect.
 * @category tasks
 * @since 0.0.0
 */
export const runRootLintPolicyTask: {
  (full?: boolean): Effect.Effect<void, QualityTaskError, QualityTaskEnvironment>;
  (full: boolean, base: string): Effect.Effect<void, QualityTaskError, QualityTaskEnvironment>;
  (base: string): (full: boolean) => Effect.Effect<void, QualityTaskError, QualityTaskEnvironment>;
} = dual(
  (args: IArguments) => !P.isString(args[0]),
  (full = false, base = "origin/main") => runRootLintPolicyTaskInternal(full, base)
);

/**
 * Run the same bounded deprecated-API Turbo step used by the policy plan.
 *
 * **Example** (Build an affected deprecated-API check)
 *
 * ```ts
 * import { runRootDeprecatedApisTask } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(runRootDeprecatedApisTask("origin/main"))) // true
 * ```
 *
 * @param base - Caller base for affected selection; omitted for a full Turbo sweep.
 * @category tasks
 * @since 0.0.0
 */
export const runRootDeprecatedApisTask = Effect.fn("QualityTasks.runRootDeprecatedApisTask")(function* (base?: string) {
  const repoRoot = yield* findRepoRoot();
  yield* runStep(deprecatedApisTurboStep(repoRoot, base, yield* qualityConcurrencyPlan));
});

const rootLintPolicySteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  fix: boolean,
  docsCacheKey: string,
  plan: QualityConcurrencyPlan
): ReadonlyArray<QualityTaskStep> => {
  if (fix || !shouldRunLintRepoWideSteps(args)) {
    return A.empty<QualityTaskStep>();
  }

  return rootRepoLintPolicySteps(repoRoot, undefined, undefined, oxlintPolicySweeps, isCiSync(), docsCacheKey, plan);
};

// The one root lint plan: the aggregate Turbo lint (or lint:fix) followed by
// the policy siblings when the invocation is repo-wide. `runRootLintTask` runs
// exactly this list, so the plan the tests inspect is the plan the CLI runs.
const rootLintSteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  fix: boolean,
  docsCacheKey: string = UNKEYED_ROOT_DOCS_CACHE,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] => {
  const lintArgs = boundedRootTurboArgs(fix ? stripLintFixAggregateArgs(args) : args, plan);
  return [
    fix ? turboStep(repoRoot, "lint:fix", ["lint:fix"], lintArgs) : turboStep(repoRoot, "lint", ["lint"], lintArgs),
    ...rootLintPolicySteps(repoRoot, lintArgs, fix, docsCacheKey, plan),
  ];
};

const runRootLintTask = Effect.fn("QualityTasks.runRootLintTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  fix: boolean
) {
  const strippedLintArgs = fix ? stripLintFixAggregateArgs(args) : args;
  if (fix && !shouldForceAggregateLintFix(args) && isUnscopedInvocation(strippedLintArgs)) {
    const files = yield* collectExistingWorkingTreeChangedFiles(repoRoot);
    if (A.isReadonlyArrayEmpty(files)) {
      yield* Console.log("[beep-cli] lint:fix: no changed files");
      return;
    }

    yield* runStep(lintFixChangedStep(repoRoot, files));
    return;
  }

  const steps = rootLintSteps(repoRoot, args, fix, yield* rootDocsCacheKey(repoRoot), yield* qualityConcurrencyPlan);
  if (A.length(steps) === 1) {
    yield* runStep(A.headNonEmpty(steps));
    return;
  }

  yield* runPolicySteps(steps, true);
});

// `bun run audit` is the four cached quality graphs in order (build, check, test,
// lint), not a fifth per-package `audit` script: the old `turbo run audit` task was
// uncached, chained through `^audit`, and repeated build+check+test+lint inside every
// package (43 minutes on a 188-package tree for work the cached graphs already do).
// CI keeps the fresh-run posture by forcing every graph; a local run reuses caches.
const rootAuditPackagesArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> => ciFreshTurboArgs(args);

// The static part of the composed audit plan. `test` has no static plan (its runner
// resolves lanes and the SQL resource at run time), so `runRootTask` runs the test
// lane between the check and lint steps listed here.
const rootAuditPackagesStaticSteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
): ReadonlyArray<QualityTaskStep> => [
  ...rootBuildSteps(repoRoot, args, plan),
  ...rootCheckSteps(repoRoot, args, plan),
  ...rootLintSteps(repoRoot, args, false, undefined, plan),
];

const rootAuditSteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
) => {
  const selection = parseRootAuditSelection(args);

  if (selection.mode === "packages") {
    return rootAuditPackagesStaticSteps(repoRoot, rootAuditPackagesArgs(selection.args), plan);
  }

  const auditArgs = selection.args;
  const scriptMode = pipe(
    A.head(auditArgs),
    O.getOrElse(() => "pre-push")
  );
  const scriptArgs = A.match(auditArgs, {
    onEmpty: () => ["pre-push"],
    onNonEmpty: () => auditArgs,
  });

  return [repoCliStep(repoRoot, `audit:${scriptMode}`, ["quality", "github-checks", ...scriptArgs])];
};

const runRootAuditPackagesTask = Effect.fn("QualityTasks.runRootAuditPackagesTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const graphArgs = rootAuditPackagesArgs(args);
  const plan = yield* qualityConcurrencyPlan;
  yield* runStreamingStepGroup("audit", [
    ...rootBuildSteps(repoRoot, graphArgs, plan),
    ...rootCheckSteps(repoRoot, graphArgs, plan),
  ]);
  yield* runRootTestTask(repoRoot, graphArgs);
  yield* runRootLintTask(repoRoot, graphArgs, false);
});

const invocationArgs = (invocation: QualityTaskInvocation): ReadonlyArray<string> =>
  invocation.args ?? A.empty<string>();
const invocationFix = (invocation: QualityTaskInvocation): boolean => invocation.fix ?? false;

const rootStepsFor = (
  repoRoot: string,
  invocation: QualityTaskInvocation,
  plan: QualityConcurrencyPlan = localQualityConcurrencyPlan()
): ReadonlyArray<QualityTaskStep> =>
  pipe(invocation, (current) =>
    Match.type<QualityTaskName>().pipe(
      Match.when("build", () => rootBuildSteps(repoRoot, invocationArgs(current), plan)),
      Match.when("check", () => rootCheckSteps(repoRoot, invocationArgs(current), plan)),
      Match.when("lint", () =>
        rootLintSteps(repoRoot, invocationArgs(current), invocationFix(current), undefined, plan)
      ),
      Match.when("audit", () => rootAuditSteps(repoRoot, invocationArgs(current), plan)),
      // `test` and `coverage` have no static plan: `runRootTask` hands them to
      // runners that resolve lane selection, the SQL container resource, and
      // the coverage scope at run time. The shadow builders that used to sit
      // here described a plan the CLI never ran (quality-lane audit
      // 2026-09-09, E1).
      Match.whenOr("test", "coverage", A.empty<QualityTaskStep>),
      Match.exhaustive
    )(current.task)
  );

/**
 * Build root quality task subprocess steps. Exposed for focused unit tests.
 *
 * **Details**
 *
 * Only `build`, `check`, `lint`, and `audit` have a static plan; `test` and
 * `coverage` return no steps because their runners plan at run time. The
 * package `audit` plan lists its build, check and lint steps; its test lane is
 * run-time planned like `test`.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { rootQualityStepsForTesting } from "@beep/repo-cli/commands/Quality"
 * import { QualityTaskInvocation } from "@beep/repo-cli/commands/Quality/Tasks"
 *
 * const steps = rootQualityStepsForTesting(
 *   "/repo",
 *   QualityTaskInvocation.make({ task: "check", args: [], fix: false })
 * )
 * console.log(steps.length > 0) // true
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param invocation - Parsed quality invocation.
 * @returns Planned subprocess steps.
 * @category utilities
 * @since 0.0.0
 */
export const rootQualityStepsForTesting: {
  (repoRoot: string, invocation: QualityTaskInvocation): ReadonlyArray<QualityTaskStep>;
  (invocation: QualityTaskInvocation): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
} = dual(
  2,
  (repoRoot: string, invocation: QualityTaskInvocation): ReadonlyArray<QualityTaskStep> =>
    rootStepsFor(repoRoot, invocation)
);

const coverageShardedSteps = (
  repoRoot: string,
  packageNames: ReadonlyArray<string>,
  passthroughArgs: ReadonlyArray<string>,
  writeBaseline: boolean,
  prebuildFilterArgs: ReadonlyArray<string>
): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] => {
  // A shard count above the owner count leaves empty shards; an empty shard
  // would hand turbo a filter-less `coverage` run over the whole workspace.
  const shards = pipe(
    planCoverageFullShards(packageNames, COVERAGE_FULL_SHARD_COUNT),
    A.filter((shard) => A.isReadonlyArrayNonEmpty(shard.packageNames))
  );

  return [
    turboStep(
      repoRoot,
      "coverage:prebuild",
      ["build"],
      [CI_TURBO_CONCURRENCY_ARG, "--summarize", ...prebuildFilterArgs, ...passthroughArgs]
    ),
    ...A.map(shards, (shard) =>
      coverageFullShardStep(repoRoot, shard.index, shard.packageNames, passthroughArgs, writeBaseline)
    ),
  ];
};

const coverageFullSteps = (
  repoRoot: string,
  packageNames: ReadonlyArray<string>,
  args: ReadonlyArray<string>
): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] =>
  coverageShardedSteps(
    repoRoot,
    packageNames,
    coverageFullPassthroughArgs(args),
    A.some(args, isCoverageWriteBaselineArg),
    // Build only the coverage owners (turbo adds their `^build` closure). An
    // unfiltered prebuild also built @beep/storybook, which owns no coverage
    // task and sits in no owner's build closure (quality audit A2, 2026-11-02).
    packageFilterArgs(packageNames)
  );

const packageFilterArgs: (packageNames: ReadonlyArray<string>) => ReadonlyArray<string> = A.map(
  (packageName: string) => `--filter=${packageName}`
);

const coverageSelectedShardedSteps = (
  repoRoot: string,
  options: CoverageTaskOptions
): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] =>
  coverageShardedSteps(
    repoRoot,
    options.expectedPackageNames,
    coverageFullPassthroughArgs(options.args),
    options.writeBaseline,
    // Build only the selected owners (turbo adds their `^build` dependencies);
    // the shards then run `--only` against that prebuilt graph.
    packageFilterArgs(options.expectedPackageNames)
  );

// Baseline writes and ratchet checks must use the same worker topology. Repo-cli
// deliberately changes file parallelism in the weighted executor; falling back
// to Turbo's local scheduling therefore produces a different per-file V8
// coverage snapshot that the writer's own baseline cannot satisfy.
const usesShardedCoverageExecutor = (_hosted: boolean, _writeBaseline: boolean): boolean => true;

const isWideSelectedCoverage = (options: CoverageTaskOptions): boolean =>
  options.scoped &&
  A.isReadonlyArrayNonEmpty(options.expectedPackageNames) &&
  coverageScopeWeightSeconds(options.expectedPackageNames) > COVERAGE_SELECTED_SINGLE_RUN_MAX_WEIGHT_SECONDS;

const coverageSelectedSteps = (
  repoRoot: string,
  options: CoverageTaskOptions,
  shardedExecutor: boolean
): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] =>
  shardedExecutor && (options.writeBaseline || isWideSelectedCoverage(options))
    ? coverageSelectedShardedSteps(repoRoot, options)
    : [coverageStep(repoRoot, options)];

/**
 * Build the steps a planned selected coverage scope executes.
 *
 * **Details**
 *
 * Narrow ratchet selections stay one Turbo invocation. Baseline writes and
 * selections whose planner weight exceeds the single-invocation budget run
 * like the full lane: one prebuild filtered to the selected owners, then
 * weighted `--only` shards with verifier-equivalent Vitest worker counts.
 *
 * **Example** (Inspect a narrow selection)
 *
 * ```ts
 * import { coverageSelectedStepsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const steps = coverageSelectedStepsForTesting("/repo", ["@beep/types"], [], { hosted: true, writeBaseline: false })
 * console.log(steps.length) // 1
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param packageNames - Exact selected coverage owners, dependents included.
 * @param args - Turbo arguments the planner already resolved for the selection.
 * @param options - Whether the run is hosted (`CI=true` in production) and whether it regenerates the baseline.
 * @returns One ratchet step, or a prebuild step followed by the selected shards.
 * @category testing
 * @since 0.0.0
 */
export const coverageSelectedStepsForTesting: {
  (
    packageNames: ReadonlyArray<string>,
    args: ReadonlyArray<string>,
    options: { readonly hosted: boolean; readonly writeBaseline: boolean }
  ): (repoRoot: string) => readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>];
  (
    repoRoot: string,
    packageNames: ReadonlyArray<string>,
    args: ReadonlyArray<string>,
    options: { readonly hosted: boolean; readonly writeBaseline: boolean }
  ): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>];
} = dual(
  4,
  (
    repoRoot: string,
    packageNames: ReadonlyArray<string>,
    args: ReadonlyArray<string>,
    options: { readonly hosted: boolean; readonly writeBaseline: boolean }
  ): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>] =>
    coverageSelectedSteps(
      repoRoot,
      {
        args: coverageTurboArgs([...args, ...packageFilterArgs(packageNames)]),
        expectedPackageNames: packageNames,
        replaceAll: false,
        scoped: true,
        skip: false,
        writeBaseline: options.writeBaseline,
      },
      usesShardedCoverageExecutor(options.hosted, options.writeBaseline)
    )
);

/**
 * Build the single Turbo coverage invocation for one set of caller args.
 *
 * **Details**
 *
 * This is the step the selected coverage path runs when the selection fits one
 * Turbo run; wide selections and the full lane shard instead (see
 * {@link coverageSelectedStepsForTesting}). It is not a root plan — root
 * `bun run coverage` resolves its scope at run time — but the env posture
 * (`CI=true`, scrubbed remote-cache credentials, Node options, fast-check
 * seed) is decided here for every coverage child, so it is testable alone.
 *
 * **Example** (Inspect the ratchet step)
 *
 * ```ts
 * import { coverageStepForTesting } from "@beep/repo-cli/test/Quality"
 *
 * console.log(coverageStepForTesting("/repo", []).label) // "coverage:ratchet"
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param args - Caller-visible coverage args, `--` passthrough included.
 * @param owners - Optional workspace graph for exercising direct selector resolution.
 * @returns The ratchet or baseline-write coverage step.
 * @category testing
 * @since 0.0.0
 */
export const coverageStepForTesting: {
  (repoRoot: string, args: ReadonlyArray<string>, owners?: ReadonlyArray<CoverageScopeOwner>): QualityTaskStep;
  (args: ReadonlyArray<string>, owners?: ReadonlyArray<CoverageScopeOwner>): (repoRoot: string) => QualityTaskStep;
} = dual(
  (args) => P.isString(args[0]),
  (repoRoot: string, args: ReadonlyArray<string>, owners?: ReadonlyArray<CoverageScopeOwner>): QualityTaskStep =>
    coverageStep(repoRoot, {
      ...parseCoverageTaskOptions(args),
      ...O.getSomesStruct({
        topologyPackageNames: O.map(O.fromUndefinedOr(owners), (owners) =>
          coverageSelectorPackageNames(owners, explicitTurboFilterValues(args))
        ),
      }),
    })
);

/**
 * Build the prebuild and weighted shard steps for a full hosted coverage run.
 *
 * **Example** (Preserve caller cache controls)
 *
 * ```ts
 * import { coverageFullStepsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const steps = coverageFullStepsForTesting("/repo", ["@beep/schema"], ["--remote-only"])
 * console.log(steps[0]?.args)
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param packageNames - Coverage-owning workspace package names.
 * @param args - Parsed Turbo arguments supplied by the caller.
 * @returns One prebuild step followed by the weighted coverage shard steps.
 * @category testing
 * @since 0.0.0
 */
export const coverageFullStepsForTesting: {
  (
    packageNames: ReadonlyArray<string>,
    args: ReadonlyArray<string>
  ): (repoRoot: string) => readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>];
  (
    repoRoot: string,
    packageNames: ReadonlyArray<string>,
    args: ReadonlyArray<string>
  ): readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>];
} = dual(3, coverageFullSteps);

const runFullShardedCoverage = Effect.fn("QualityTasks.runFullShardedCoverage")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const owners = yield* workspaceTaskOwners(repoRoot);
  const packageNames = pipe(
    owners,
    A.filter(ownerDefinesScript("coverage")),
    A.map((owner) => owner.packageName)
  );
  if (A.isReadonlyArrayEmpty(packageNames)) {
    return yield* QualityTaskConfigurationError.new("No workspace packages define coverage.");
  }

  yield* runShardedCoverage("coverage:full", coverageFullSteps(repoRoot, packageNames, args));
});

const runShardedCoverage = Effect.fn("QualityTasks.runShardedCoverage")(function* (
  label: string,
  steps: readonly [QualityTaskStep, ...ReadonlyArray<QualityTaskStep>]
) {
  const [prebuildStep, ...shardSteps] = steps;
  yield* Console.log(
    `[beep-cli] ${label}: prebuild once, then ${A.length(shardSteps)} weighted in-job shard(s) with aggregate Vitest worker cap ${COVERAGE_FULL_VITEST_WORKER_CAP}`
  );
  yield* runStep(prebuildStep);
  yield* runStreamingStepGroup(label, shardSteps, COVERAGE_FULL_SHARD_COUNT);
});

const runSelectedCoverage = Effect.fn("QualityTasks.runSelectedCoverage")(function* (
  repoRoot: string,
  options: CoverageTaskOptions
) {
  const steps = coverageSelectedSteps(
    repoRoot,
    options,
    usesShardedCoverageExecutor(isCiSync(), options.writeBaseline)
  );
  if (A.isReadonlyArrayNonEmpty(A.tailNonEmpty(steps))) {
    yield* Console.log(
      options.writeBaseline
        ? "[beep-cli] coverage:affected: baseline regeneration uses the weighted shard executor for verifier-equivalent worker topology"
        : `[beep-cli] coverage:affected: selection weighs ${Math.round(coverageScopeWeightSeconds(options.expectedPackageNames))}s of planner budget (> ${COVERAGE_SELECTED_SINGLE_RUN_MAX_WEIGHT_SECONDS}s); using the weighted shard executor`
    );
    return yield* runShardedCoverage("coverage:selected", steps);
  }
  yield* runStep(A.headNonEmpty(steps));
});

const runRootCoverageTask = Effect.fn("QualityTasks.runRootCoverageTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const options = yield* resolveCoverageTaskOptions(repoRoot, args);
  if (!options.writeBaseline && configStringEqualsSync("VITEST_COVERAGE_REPORT_ONLY", "1")) {
    return yield* QualityTaskConfigurationError.new(
      "VITEST_COVERAGE_REPORT_ONLY is only supported for coverage baseline regeneration. Run `bun run coverage:baseline:write` to regenerate the baseline, or unset it for the coverage gate."
    );
  }

  if (options.skip) {
    yield* Console.log("[beep-cli] coverage:affected: no coverage-bearing inputs changed");
    return;
  }

  yield* cleanCoverageRegressionOutputs(repoRoot);
  if (!options.scoped && usesShardedCoverageExecutor(isCiSync(), options.writeBaseline)) {
    yield* runFullShardedCoverage(repoRoot, options.args);
  } else {
    yield* runSelectedCoverage(repoRoot, options);
  }

  if (options.writeBaseline) {
    yield* writeCoverageRegressionBaseline(repoRoot, options.scoped, options.expectedPackageNames, {
      replaceAll: options.replaceAll,
    });
    return;
  }

  yield* compareCoverageRegressionBaseline(repoRoot, options.scoped, options.expectedPackageNames);
});

const readPackageJson = Effect.fn("QualityTasks.readPackageJson")(function* (packageDir: string) {
  const path = yield* Path.Path;
  return yield* readPackageJsonFile(path.join(packageDir, "package.json"));
});

// A package-scoped `beep audit` runs the package's own quality scripts in graph order;
// there is no separate `beep:audit` script (see `rootAuditSteps`).
const packageAuditTasks: ReadonlyArray<QualityTaskName> = ["build", "check", "test", "lint"];

const runPackageTask: (
  packageDir: string,
  invocation: QualityTaskInvocation
) => Effect.Effect<void, QualityTaskError, QualityTaskEnvironment> = Effect.fn("QualityTasks.runPackageTask")(
  function* (packageDir: string, invocation: QualityTaskInvocation) {
    if (invocation.task === "audit") {
      for (const task of packageAuditTasks) {
        yield* runPackageTask(packageDir, QualityTaskInvocation.make({ ...invocation, task }));
      }
      return;
    }

    const packageJson = yield* readPackageJson(packageDir);
    const scripts = packageJson.scripts ?? {};
    const profile = profileByTask[invocation.task];
    const fix = invocationFix(invocation);
    const args = invocationArgs(invocation);
    const script = pipe(
      O.fromUndefinedOr(profile.fixScript),
      O.filter(() => fix),
      O.getOrElse(() => profile.script)
    );
    const packageName = packageJson.name ?? packageDir;

    if (pipe(scripts, R.get(script), O.isNone)) {
      yield* Console.log(`[beep-cli] ${packageName} ${invocation.task}${fix ? ":fix" : ""}: no-op`);
      return;
    }

    yield* runStep(
      QualityTaskStep.make({
        label: `${packageName} ${script}`,
        command: "bun",
        args: ["run", script, ...args],
        cwd: packageDir,
      })
    );
  }
);

const runRootTestTask = Effect.fn("QualityTasks.runRootTestTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const lanes = parseTestLaneSelection(args);
  const plan = yield* qualityConcurrencyPlan;
  const unitSteps = optionalQualityTaskStep({
    enabled: lanes.unit,
    step: () => turboStep(repoRoot, "test:unit", ["test"], boundedRootTurboArgs(lanes.args, plan)),
  });
  const unitFailures = yield* collectStreamingStepFailures("test", unitSteps);
  let integrationFailures = A.empty<QualityTaskFailed>();
  if (lanes.integration) {
    const parallelArgs = yield* workspaceTaskArgs(repoRoot, "test:integration:parallel", lanes.args);
    const unsplitFilters = A.some(lanes.args, isExplicitTurboAffectedOrScopeArg)
      ? A.empty<string>()
      : yield* unsplitIntegrationTaskFilters(repoRoot);
    const parallelFailures = yield* collectStreamingStepFailures("test:integration:parallel", [
      turboStep(
        repoRoot,
        "test:integration:parallel",
        ["test:integration:parallel"],
        boundedRootTurboArgs(parallelArgs, plan)
      ),
      ...optionalQualityTaskStep({
        enabled: A.isReadonlyArrayNonEmpty(unsplitFilters),
        step: () =>
          turboStep(
            repoRoot,
            "test:integration",
            ["test:integration"],
            boundedRootTurboArgs([...unsplitFilters, ...lanes.args], plan)
          ),
      }),
    ]);
    const serialFailures = yield* Effect.scoped(
      Effect.gen(function* () {
        const serialArgs = yield* workspaceTaskArgs(repoRoot, "test:integration:serial", lanes.args);
        const resource = yield* acquireDefaultSqlIntegrationResource;
        return yield* collectStreamingStepFailures("test:integration:serial", [
          sqlIntegrationStep(repoRoot, serialArgs, resource),
        ]);
      })
    );
    integrationFailures = A.appendAll(parallelFailures, serialFailures);
  }

  yield* failQualityTaskFailures("test", A.appendAll(unitFailures, integrationFailures));
});

const runRootTask = Effect.fn("QualityTasks.runRootTask")(function* (
  repoRoot: string,
  invocation: QualityTaskInvocation
) {
  if (invocation.task === "test") {
    yield* runRootTestTask(repoRoot, invocationArgs(invocation));
    return;
  }

  if (invocation.task === "lint") {
    yield* runRootLintTask(repoRoot, invocationArgs(invocation), invocationFix(invocation));
    return;
  }

  if (invocation.task === "coverage") {
    yield* runRootCoverageTask(repoRoot, invocationArgs(invocation));
    return;
  }

  if (invocation.task === "audit") {
    const selection = parseRootAuditSelection(invocationArgs(invocation));
    if (selection.mode === "packages") {
      yield* runRootAuditPackagesTask(repoRoot, selection.args);
      return;
    }
  }

  const steps = rootStepsFor(repoRoot, invocation, yield* qualityConcurrencyPlan);
  const step = A.head(steps);
  if (A.length(steps) === 1 && O.isSome(step) && step.value.flakeQuarantine === undefined) {
    yield* runStep(step.value);
    return;
  }

  yield* runStreamingStepGroup(invocation.task, steps);
});

type QualityTaskError =
  | DomainError
  | NoSuchFileError
  | QualityTaskConfigurationError
  | QualityTaskFailed
  | QualityTaskGroupFailed
  | UnexpectedQualityTaskFailure;

/**
 * Parse a raw argv vector into a quality task invocation when the first token is
 * one of the canonical quality task names.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { parseQualityTaskInvocation } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as O from "effect/Option"
 * const invocation = parseQualityTaskInvocation(["lint", "--fix"])
 * const handled = O.isSome(invocation)
 * ```
 *
 * @param argv - Raw command arguments after the binary name.
 * @returns Parsed invocation or `None` when another command group should handle it.
 * @category utilities
 * @since 0.0.0
 */
export const parseQualityTaskInvocation = (argv: ReadonlyArray<string>): O.Option<QualityTaskInvocation> => {
  const parseCommand = ([command, ...rawArgs]: A.NonEmptyReadonlyArray<string>): O.Option<QualityTaskInvocation> => {
    if (!isQualityTaskName(command) || hasQualityTaskBypassArg(argv)) {
      return O.none();
    }

    if (QualityTaskName.is.lint(command) && isLintPolicySubcommand(pipe(A.get(rawArgs, 0), O.getOrUndefined))) {
      return O.none();
    }

    const parsed = parseFixArgs(rawArgs);
    return O.some(
      QualityTaskInvocation.make({
        task: command,
        args: parsed.args,
        fix: QualityTaskName.is.lint(command) && parsed.fix,
      })
    );
  };

  return A.match(argv, {
    onEmpty: O.none,
    onNonEmpty: parseCommand,
  });
};

/**
 * Run a parsed quality task in either repo-root or package-local mode.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { QualityTaskInvocation, runQualityTask } from "@beep/repo-cli/commands/Quality/Tasks"
 * const program = runQualityTask(
 *   QualityTaskInvocation.make({
 *     task: "check",
 *     args: [],
 *     fix: false
 *   })
 * )
 * ```
 *
 * @param invocation - Parsed quality task invocation.
 * @category use-cases
 * @since 0.0.0
 */
const runQualityTaskInternal = Effect.fn("QualityTasks.runQualityTask")(function* (invocation: QualityTaskInvocation) {
  const path = yield* Path.Path;
  const cwd = path.resolve(process.cwd());
  const repoRoot = yield* findRepoRoot(cwd);
  const packageDir = yield* resolvePackageDir(repoRoot, cwd);

  yield* pipe(
    packageDir,
    O.map((dir) => runPackageTask(dir, invocation)),
    O.getOrElse(() => runRootTask(repoRoot, invocation))
  );
});

/**
 * Run a quality task under one admission-aware concurrency plan.
 *
 * **Details**
 *
 * The plan is resolved once per invocation; the planners fall back to the
 * unscaled local plan wherever the service is not provided (tests).
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTask } from "@beep/repo-cli/commands/Quality/Tasks"
 * import { QualityTaskInvocation } from "@beep/repo-cli/commands/Quality"
 * const program = runQualityTask(QualityTaskInvocation.make({ task: "check", args: [], fix: false }))
 * ```
 *
 * @param invocation - Parsed quality task invocation.
 * @returns The task run under the live concurrency plan.
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTask = (
  invocation: QualityTaskInvocation
): Effect.Effect<void, QualityTaskError, QualityTaskEnvironment> =>
  provideQualityConcurrency(runQualityTaskInternal(invocation));

/**
 * Run a quality task directly from a raw argv vector.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTaskIfRequested } from "@beep/repo-cli/commands/Quality/Tasks"
 * const program = runQualityTaskIfRequested(["build", "--affected"])
 * ```
 *
 * @param argv - Raw command arguments after the binary name.
 * @returns `true` when the invocation was handled by the quality adapter.
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTaskIfRequested: (
  argv: ReadonlyArray<string>
) => Effect.Effect<boolean, QualityTaskError, QualityTaskEnvironment> = Effect.fn(
  "QualityTasks.runQualityTaskIfRequested"
)(function* (argv: ReadonlyArray<string>) {
  return yield* pipe(
    parseQualityTaskInvocation(argv),
    O.map((invocation) => runQualityTask(invocation).pipe(Effect.as(true))),
    O.getOrElse(() => Effect.succeed(false))
  );
});

/**
 * Run a subprocess and capture all output. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { collectStepOutput, QualityTaskStep } from "@beep/repo-cli/commands/Quality/Tasks"
 * const output = collectStepOutput(
 *   QualityTaskStep.make({
 *     label: "version",
 *     command: "bun",
 *     args: ["--version"],
 *     cwd: "/repo"
 *   })
 * )
 * ```
 *
 * @param step - Step to run.
 * @returns Captured combined stdout/stderr and exit code.
 * @category utilities
 * @since 0.0.0
 */
export const collectStepOutput = (step: QualityTaskStep) =>
  collectStepOutputInternal(step).pipe(Effect.map(({ output, exitCode }) => ({ output, exitCode })));

/**
 * Run a bounded quality task group. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTaskStepGroup } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskStepGroup("lint", [], 1))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @param concurrency - Maximum number of steps to run at once.
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTaskStepGroup = runStepGroup;

/**
 * Run independent quality task subprocess steps sequentially while streaming
 * output, then fail with all subprocess failures.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTaskStreamingStepGroup } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskStreamingStepGroup("lint", []))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTaskStreamingStepGroup = runStreamingStepGroup;

/**
 * Run quality task subprocess steps with their output buffered and replayed
 * whole as each step ends, then fail with all subprocess failures.
 *
 * **Details**
 *
 * Use this for steps that run beside other steps (two coverage producers on
 * one runner): streaming both would interleave their lines, so each step's
 * combined stdout and stderr is captured without teeing and printed in one
 * block, bounded by `repoRunOutputBound`. Flake quarantine does not apply to
 * a buffered step.
 *
 * **Example** (Run a buffered group)
 *
 * ```ts
 * import { runQualityTaskBufferedStepGroup } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskBufferedStepGroup("test", []))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @category use-cases
 * @since 0.1.0
 */
export const runQualityTaskBufferedStepGroup = Effect.fn("QualityTasks.runQualityTaskBufferedStepGroup")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>
) {
  yield* runStreamingStepGroup(label, steps, 1, true);
});

/**
 * Execute GitHub-check waves without raising their collected subprocess
 * failures. Exposed for focused scheduling tests.
 *
 * **Example** (Inspect a report effect)
 *
 * ```ts
 * import { collectGithubCheckLaneWavesForTesting } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(collectGithubCheckLaneWavesForTesting("pre-push", [], "fail-fast"))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const collectGithubCheckLaneWavesForTesting = collectGithubCheckLaneWaves;

/**
 * Collect named wrapper-lane execution facts without raising collected failures.
 *
 * **Example** (Inspect a report effect)
 *
 * ```ts
 * import { collectQualityTaskLaneRunsForTesting } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(collectQualityTaskLaneRunsForTesting("ci:local", []))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const collectQualityTaskLaneRunsForTesting = collectQualityTaskLaneRuns;

/**
 * Run a bounded quality task group. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTaskStepGroupForTesting } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskStepGroupForTesting("lint", [], 1))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @param concurrency - Maximum number of steps to run at once.
 * @category testing
 * @since 0.0.0
 */
export const runQualityTaskStepGroupForTesting = runQualityTaskStepGroup;

/**
 * Run independent quality task subprocess steps sequentially while streaming
 * output. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runQualityTaskStreamingStepGroupForTesting } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(runQualityTaskStreamingStepGroupForTesting("lint", []))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @category testing
 * @since 0.0.0
 */
export const runQualityTaskStreamingStepGroupForTesting = runQualityTaskStreamingStepGroup;

/**
 * Declare one direct Turbo step's digest to a wrapper lane ledger, passed or failed, exposed for
 * tests.
 *
 * **Example** (Declare without a ledger)
 *
 * ```ts
 * import { recordTurboLaneLedgerRowForTesting } from "@beep/repo-cli/commands/Quality"
 * import { QualityTaskStep } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const step = QualityTaskStep.make({ label: "lint", command: "bunx", args: ["turbo", "run", "lint"], cwd: "." })
 * const outcome = { durationMs: 1, startedAt: "", endedAt: "", failure: O.none(), step }
 * console.log(Effect.isEffect(recordTurboLaneLedgerRowForTesting(O.none(), outcome))) // true
 * ```
 *
 * @param ledger - The ledger path the parent named, if any.
 * @param outcome - The finished step.
 * @category testing
 * @since 0.0.0
 */
export const recordTurboLaneLedgerRowForTesting = recordTurboLaneLedgerRow;

/**
 * Resolve a lane's input digest and package scope from its declared value, its
 * ledger, or its own summaries, exposed for tests.
 *
 * **Details**
 *
 * The resolution carries both halves of ruling 68: the digest a later attempt
 * can be reused by, and the workspace packages the Turbo tasks that digest
 * folds belong to. Only a lane whose Turbo digest was actually read carries
 * package names — a declared digest, a wrapper lane with no ledger and a
 * direct step that named no Turbo task all resolve an empty scope, matching
 * the lanes whose input source is `undeclared`. A failed step resolves through
 * the same path as a passed one (ruling 72), so it carries the digest and scope
 * of the work it ran.
 *
 * **Example** (A declared digest wins and carries no package scope)
 *
 * ```ts
 * import { QualityTaskStep, resolveLaneInputDigestForTesting } from "@beep/repo-cli/commands/Quality"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 *
 * const step = QualityTaskStep.make({ label: "lint", command: "bunx", args: ["turbo", "run", "lint"], cwd: "." })
 * const outcome = { durationMs: 1, startedAt: "", endedAt: "", failure: O.none(), step }
 * console.log(Effect.isEffect(resolveLaneInputDigestForTesting(outcome, O.some("abc")))) // true
 * ```
 *
 * @param outcome - The finished lane step.
 * @param declared - The digest the executor already declared, if any.
 * @category testing
 * @since 0.0.0
 */
export const resolveLaneInputDigestForTesting = resolveLaneInputDigest;

/**
 * Collect existing changed files for the root lint fix fast path.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { collectLintFixChangedFilesForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const result = collectLintFixChangedFilesForTesting
 * console.log(result) // rendered command output
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @category utilities
 * @since 0.0.0
 */
export const collectLintFixChangedFilesForTesting = collectExistingWorkingTreeChangedFiles;

/**
 * Collect committed and dirty changed paths using the same rename-safe scope as
 * affected coverage. Exposed for focused integration tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const collectCoverageChangedFilesForTesting = collectChangedFiles;

/**
 * Build the root lint fix changed-file step. Exposed for focused unit tests.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { lintFixChangedStepForTesting } from "@beep/repo-cli/commands/Quality"
 * console.log(lintFixChangedStepForTesting("/repo", ["src/example.ts"]))
 * ```
 *
 * @param repoRoot - Repository root directory.
 * @param files - Changed files to pass to Biome.
 * @category utilities
 * @since 0.0.0
 */
export const lintFixChangedStepForTesting: {
  (files: ReadonlyArray<string>): (repoRoot: string) => QualityTaskStep;
  (repoRoot: string, files: ReadonlyArray<string>): QualityTaskStep;
} = dual(2, lintFixChangedStep);
