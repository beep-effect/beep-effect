/**
 * Canonical quality task adapter for repo root and workspace package scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot, insertEndOfOptions } from "@beep/repo-utils";
import { PosInt } from "@beep/schema/Int";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  Console,
  DateTime,
  Duration,
  Effect,
  FileSystem,
  flow,
  Inspectable,
  Match,
  Order,
  Path,
  pipe,
  Ref,
} from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  canUseTurboCacheSecretSession,
  configStringEqualsSync,
  configStringOption,
  isUnresolvedSecretReference,
  readTurboCacheEnvironmentSync,
  renderTurboEnvironmentHealthWarning,
  turboCacheSecretSessionEnvironment,
  turboEnvExtendsAmbient,
  turboEnvironmentHealthWarnings,
  turboEnvOverrides,
} from "../../internal/cli/EnvConfig.ts";
import { isLabsWorkspacePath, LABS_TURBO_EXCLUDE_FILTER } from "../../internal/cli/Labs/index.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import {
  hasRemoteTurboCacheArgs,
  isTurboCacheControlArg,
  localOnlyTurboCacheArgs,
  resolveTurboCachePlan,
  turboCacheEnvironmentNeedsSecretSession,
  turboCachePlanArgs,
  turboCachePlanNeedsSecretSession,
  turboCachePullRequestPosture,
} from "../../internal/cli/TurboCache.ts";
import {
  CapturedStep,
  formatCommandLine,
  QualityTaskStep,
  qualityStepOutputBound,
  runCaptured,
  runToExit,
} from "../../internal/process/index.ts";
import { collectChangedFiles, collectDirtyWorktreeFiles } from "../../internal/repo-run/ChangedFiles.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import {
  cleanCoverageRegressionOutputs,
  compareCoverageRegressionBaseline,
  coverageBaselineRowDeltaFromBase,
  coverageRegressionBaselinePath,
  writeCoverageRegressionBaseline,
} from "./internal/CoverageRegression.ts";
import {
  coverageScopeWeightSeconds,
  planCoverageFullShards,
  planWorkspaceCoverageAffectedScope,
} from "./internal/CoverageScope.ts";
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
import { hasReusableLaneProof, persistLaneProofs, prepareLaneProofSession } from "./internal/LaneProofReuse.ts";
import { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Quality.errors.ts";
import {
  decodePackageJsonDocument,
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckLaneRun,
  GithubCheckMode,
  GithubCheckRunReport,
  LintPolicySubcommand,
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
import type { DomainError, NoSuchFileError } from "@beep/repo-utils";
import type { PgliteTestcontainerResource } from "@beep/test-utils";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CaptureCommandTimedOutError } from "../../internal/process/index.ts";
import type { CoverageBaselineRowDelta } from "./internal/CoverageScope.ts";
import type { FlakeQuarantineTask } from "./internal/FlakeQuarantine.ts";
import type { UnexpectedQualityTaskFailure } from "./Quality.errors.ts";
import type {
  GithubCheckFailurePolicy,
  GithubCheckLaneWaveSpec,
  PackageJsonDocument,
  PackageJsonWorkspacesDocument,
} from "./Quality.schemas.ts";

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

const CHANGED_PATH_DIFF_FILTER = ["A", "C", "M", "R", "T", "U", "X", "B"].join("");
const LOCAL_BIOME_BIN = "./node_modules/.bin/biome";
const BIOME_FIX_CHANGED_ARGS = ["check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched"] as const;
const LINT_FIX_AGGREGATE_ARGS = ["--full", "--repo"] as const;
const ROOT_TURBO_CONCURRENCY_ARG = "--concurrency=3";
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
// candidate. Full coverage and full baseline regeneration share this shard
// worker shape so V8 instrumentation remains comparable. Scoped baseline
// writes retain the two-worker shape used by the long-pole packages.
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
const COVERAGE_SCOPED_BASELINE_VITEST_ARGS = [
  "--",
  COVERAGE_FULL_VITEST_FILE_PARALLELISM_ARG,
  COVERAGE_FULL_VITEST_LONG_POLE_MAX_WORKERS_ARG,
] as const;
const COVERAGE_WRITE_BASELINE_ARG = "--write-baseline";
const COVERAGE_REPLACE_ALL_ARG = "--replace-all";
const DEFAULT_COVERAGE_FAST_CHECK_SEED = "20260708";
const COVERAGE_NODE_OPTIONS_ARG = "--no-experimental-webstorage";
// Full root lint runs the aggregate Turbo graph plus repo policy tools. Keep
// its group fan-out aligned with the root Turbo cap so hosted main checks do
// not start multiple CPU/memory-heavy process graphs at once.
const ROOT_LINT_STEP_CONCURRENCY = 3;
// Lint-policy steps are independent read-only tools (oxlint, eslint-jsdoc, law
// checks, madge...). Running them grouped-concurrent
// converts the lane from sum-of-steps to max-of-steps. After the P1 shard
// parallelism landed (PR #678) the lane became sum-bound at 2 (~1124s total
// work / 2 ≈ 9.5 min hosted); 3 puts the floor back under the deprecated-apis
// long pole (~435s) on the 64 GiB heavy runner. The worst LPT co-resident trio
// (deprecated shards ~12-16 GiB, docgen, semantic-delta) fits; evidence:
// goals/lint-policy-single-digit (P1 hosted profile + closeout).
const LINT_POLICY_STEP_CONCURRENCY = 3;
// A single lost child-exit signal must fail with the command name while the
// workflow still has time to report and clean up. The longest healthy policy
// child is under eight minutes on the hosted heavy runner.
const QUALITY_CAPTURE_TIMEOUT_MILLIS = PosInt.make(Duration.toMillis("15 minutes"));
const QUALITY_CAPTURE_FORCE_KILL_AFTER: Duration.Input = "5 seconds";
const QUALITY_CAPTURE_TIMEOUT_EXIT_CODE = 124;
const REPO_CLI_ENTRY_PATH = "packages/tooling/tool/cli/src/bin.ts";

const capturedTimeoutResult = (error: CaptureCommandTimedOutError): CapturedStep =>
  CapturedStep.make({
    exitCode: QUALITY_CAPTURE_TIMEOUT_EXIT_CODE,
    output: error.message,
    truncated: false,
  });

type QualityTaskEnvironment = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

type PackageJsonWorkspaces = ReadonlyArray<string> | PackageJsonWorkspacesDocument;

const isPackageJsonWorkspacePatternList = (workspaces: PackageJsonWorkspaces): workspaces is ReadonlyArray<string> =>
  A.isArray(workspaces);

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
  A.some(QualityTaskBypassArgName.Options, (name) => Str.startsWith(`${name}=`)(arg));

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

const workspacePatternsFromPackageJson = (packageJson: PackageJsonDocument): ReadonlyArray<string> => {
  const workspaces: PackageJsonWorkspaces | undefined = packageJson.workspaces;
  if (workspaces === undefined) {
    return A.empty();
  }

  return isPackageJsonWorkspacePatternList(workspaces) ? workspaces : (workspaces.packages ?? A.empty());
};

const readJsonFile = Effect.fn("QualityTasks.readJsonFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(QualityTaskConfigurationError.mapError(`Failed to read ${filePath}`));

  return yield* decodePackageJsonDocument(content).pipe(
    QualityTaskConfigurationError.mapError(`Failed to parse ${filePath}`)
  );
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
  pattern.length > 0 && !pattern.startsWith("/") && !pattern.split("/").some((segment) => segment === "..");

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

  if (pattern.endsWith("/*")) {
    const base = path.join(repoRoot, pattern.slice(0, -2));
    const entries = yield* fs
      .readDirectory(base)
      .pipe(
        Effect.mapError(() =>
          QualityTaskConfigurationError.make({ message: `Failed to read workspace directory ${base}` })
        )
      );

    return A.map(entries, (entry) => path.join(base, entry));
  }

  return [path.join(repoRoot, pattern)];
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
  const rootPackageJson = yield* readJsonFile(path.join(repoRoot, "package.json"));
  const candidateDirs = yield* Effect.forEach(
    workspacePatternsFromPackageJson(rootPackageJson),
    (pattern) => workspaceCandidateDirsForPattern(repoRoot, pattern),
    { concurrency: 4 }
  );

  const owners = yield* Effect.forEach(
    pipe(A.flatten(candidateDirs), A.dedupe, A.sort(Order.String)),
    Effect.fn(function* (packageDir) {
      const packageJsonPath = path.join(packageDir, "package.json");
      const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(thunkFalse));
      if (!exists) {
        return O.none<WorkspaceTaskOwner>();
      }

      const packageJson = yield* readJsonFile(packageJsonPath);
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
    : isCi()
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
  args: ReadonlyArray<string>
): Effect.fn.Return<CoverageTaskOptions, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const parsed = parseCoverageTaskOptions(args);
  if (parsed.replaceAll && parsed.scoped) {
    return yield* QualityTaskConfigurationError.new(
      `${COVERAGE_REPLACE_ALL_ARG} only applies to an unscoped ${COVERAGE_WRITE_BASELINE_ARG} run.`
    );
  }
  if (parsed.replaceAll && !parsed.writeBaseline) {
    return yield* QualityTaskConfigurationError.new(
      `${COVERAGE_REPLACE_ALL_ARG} requires ${COVERAGE_WRITE_BASELINE_ARG}; it only controls coverage baseline replacement.`
    );
  }
  if (!A.some(args, isCoverageAffectedArg)) {
    return parsed;
  }
  if (A.some(args, (arg) => isExplicitTurboScopeArg(arg))) {
    return yield* QualityTaskConfigurationError.new(
      "Affected coverage cannot be combined with --filter or --since; let the coverage planner choose exact owners or a full fallback."
    );
  }

  const base = yield* configStringOption("TURBO_SCM_BASE").pipe(
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
    Match.discriminatorsExhaustive("_tag")({
      full: ({ reasons }) =>
        Console.log(`[beep-cli] coverage:affected: full fallback (${A.join(reasons, "; ")})`).pipe(
          Effect.as(parseCoverageTaskOptions(passthroughArgs))
        ),
      selected: ({ packageNames, dependentPackageNames }) =>
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
        ),
      noop: () =>
        Effect.succeed({
          args: A.empty<string>(),
          expectedPackageNames: A.empty<string>(),
          replaceAll: parsed.replaceAll,
          scoped: true,
          skip: true,
          writeBaseline: parsed.writeBaseline,
        }),
    })
  );
});

/**
 * Validate root coverage arguments through the runtime option resolver.
 *
 * **Example** (Build a validation effect)
 *
 * ```ts
 * import { validateCoverageTaskArgsForTesting } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(validateCoverageTaskArgsForTesting("/repo", ["--write-baseline"]))) // true
 * ```
 *
 * @param repoRoot - Repository root used if affected scope requires workspace discovery.
 * @param args - Root coverage passthrough arguments to validate.
 * @category testing
 * @since 0.0.0
 */
export const validateCoverageTaskArgsForTesting = Effect.fn("QualityTasks.validateCoverageTaskArgsForTesting")(
  function* (repoRoot: string, args: ReadonlyArray<string>) {
    yield* resolveCoverageTaskOptions(repoRoot, args);
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

const isCi = (): boolean => Bun.env.CI === "true" || configStringEqualsSync("CI", "true");

// A workstation configured for remote reads is honored; everything else falls
// back to local-only. The decision itself lives in `internal/cli/TurboCache`
// so the whole matrix stays unit-testable without mutating the environment.
const turboCachePlan = (args: ReadonlyArray<string>) =>
  resolveTurboCachePlan(readTurboCacheEnvironmentSync(), { args, ci: isCi() });

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
  isCi() && !A.some(args, isTurboCacheControlArg) ? ["--force", ...args] : args;

const isUnscopedInvocation = (args: ReadonlyArray<string>): boolean => A.isReadonlyArrayEmpty(args);

// lab-apps-lifecycle P2 (ratified row 9): labs never enter the required root
// turbo graphs. The exclude filter joins the argv at final assembly, AFTER the
// owned-arg parsers (isExplicitTurboScopeArg, shouldRunRepoWideSteps,
// parseCoverageTaskOptions) have classified the caller-visible args, so it can
// never demote repo-wide steps or flip coverage into its scoped shape. `build`
// stays outside this set deliberately (ratified-minimal); the coverage:prebuild
// step carries the filter explicitly instead.
const LABS_EXCLUDED_TURBO_TASKS: ReadonlyArray<string> = [
  "check",
  "lint",
  "lint:fix",
  "test",
  "test:integration",
  "test:integration:parallel",
  "test:integration:serial",
  "coverage",
];

const isTurboPassthroughDelimiter = (arg: string): boolean => arg === "--";

const labsExcludeFilterArgs = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.some(tasks, (task) => A.contains(LABS_EXCLUDED_TURBO_TASKS, task)) && !A.contains(args, LABS_TURBO_EXCLUDE_FILTER)
    ? A.of(LABS_TURBO_EXCLUDE_FILTER)
    : A.empty<string>();

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
  return [
    "turbo",
    "run",
    ...tasks,
    ...turboCacheArgsFor(tasks, args),
    ...optionArgs,
    ...labsExcludeFilterArgs(tasks, optionArgs),
    ...passthroughArgs,
  ];
};

const boundedRootTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.some(args, isTurboConcurrencyArg)
    ? args
    : isCi()
      ? [CI_TURBO_CONCURRENCY_ARG, ...args]
      : [ROOT_TURBO_CONCURRENCY_ARG, ...args];

const includesTurboCoverageTask = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): boolean =>
  A.some(tasks, (task) => task === "coverage") || A.some(args, (arg) => arg === "coverage");

const coverageNodeOptions = (): string =>
  pipe(
    O.fromUndefinedOr(Bun.env.NODE_OPTIONS),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.map((nodeOptions) =>
      Str.includes(COVERAGE_NODE_OPTIONS_ARG)(nodeOptions) ? nodeOptions : `${nodeOptions} ${COVERAGE_NODE_OPTIONS_ARG}`
    ),
    O.getOrElse(() => COVERAGE_NODE_OPTIONS_ARG)
  );

// Coverage compares instrumentation metrics across runs, so its default seed
// is reproducible. Callers can override it for additional exploration, while
// the unseeded nightly property-law sweep remains responsible for breadth.
const coverageFastCheckSeed = (): string =>
  pipe(
    O.fromUndefinedOr(Bun.env.BEEP_FC_SEED),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrElse(() => DEFAULT_COVERAGE_FAST_CHECK_SEED)
  );

// Coverage is a hosted ratchet. Pin its CI identity, remove desktop terminal
// metadata, and reduce the Turbo remote-cache quad to the pull-request posture
// so local baseline generation, PR jobs, and main pushes all exercise the same
// branches: a workstation's 1Password-backed TURBO_TOKEN and a main push's
// literal token each reach arms of internal/cli/EnvConfig.ts that a PR job's
// blank quad never does (ship-velocity B9). Step env wins over
// turboEnvOverrides at spawn time, and the prebuild step never receives this
// record, so main pushes keep their remote-cache reads for the build graph.
const coverageEnvironment = (): Record<string, string | undefined> => ({
  BEEP_FC_SEED: coverageFastCheckSeed(),
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_OPTIONS: coverageNodeOptions(),
  TERM_PROGRAM: undefined,
  TERM_PROGRAM_VERSION: undefined,
  ...turboCachePullRequestPosture,
  VITEST_COVERAGE_RATCHET: "1",
});

// fallow-ignore-next-line code-duplication -- coverage detection stays beside its deterministic hosted environment
const turboCoverageEnv = (
  tasks: ReadonlyArray<string>,
  args: ReadonlyArray<string>
): Record<string, string | undefined> | undefined =>
  // fallow-ignore-next-line code-duplication -- only Turbo coverage runs receive the hosted coverage environment
  includesTurboCoverageTask(tasks, args) ? coverageEnvironment() : undefined;

const collectExistingWorkingTreeChangedFiles = Effect.fn("QualityTasks.collectExistingWorkingTreeChangedFiles")(
  function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const changedFiles = yield* collectDirtyWorktreeFiles(repoRoot, {
      diffArgs: [`--diff-filter=${CHANGED_PATH_DIFF_FILTER}`],
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

const turboSecretSessionStep: {
  (environment: Readonly<Record<string, string | undefined>>): (step: QualityTaskStep) => QualityTaskStep;
  (step: QualityTaskStep, environment: Readonly<Record<string, string | undefined>>): QualityTaskStep;
} = dual(
  2,
  (step: QualityTaskStep, environment: Readonly<Record<string, string | undefined>>): QualityTaskStep =>
    QualityTaskStep.make({
      label: `${step.label} (op run)`,
      command: "op",
      args: ["run", "--", step.command, ...step.args],
      cwd: step.cwd,
      ...carriedStepProps(step),
      env: turboCacheSecretSessionEnvironment({ ...environment, ...(step.env ?? {}) }),
    })
);

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
  if (step.useLocalEnv !== true) {
    return withoutUnusableRemoteCache(step, needsTurboSecretSession());
  }

  const environmentWarnings = yield* turboEnvironmentHealthWarnings(step.cwd, Bun.env);
  yield* Effect.forEach(environmentWarnings, flow(renderTurboEnvironmentHealthWarning, Console.warn), {
    discard: true,
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
  yield* Console.log(`[beep-cli] ${resolved.label}: ${commandText(resolved.command, resolved.args)}`);
  const exitCode = yield* runToExit({
    command: resolved.command,
    args: resolved.args,
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
const runStepCapturedForQuarantine = Effect.fn("QualityTasks.runStepCapturedForQuarantine")(function* (
  step: QualityTaskStep
): Effect.fn.Return<QuarantineStepAttempt, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const resolved = yield* withTurboSecretSession(step);
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args, Bun.env);
  const command = commandText(resolved.command, resolved.args);
  yield* Console.log(`[beep-cli] ${resolved.label}: ${command}`);
  const result = yield* runCaptured({
    command: resolved.command,
    args: resolved.args,
    cwd: resolved.cwd,
    env: {
      ...envOverrides,
      ...(resolved.env ?? {}),
    },
    extendEnv: turboEnvExtendsAmbient(resolved.command, resolved.args),
    source: "all",
    bound: flakeQuarantineOutputBound,
    tee: true,
  }).pipe(
    Effect.catchTag("CaptureCommandTimedOutError", (error) => Effect.succeed(capturedTimeoutResult(error))),
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
    O.filter(() => !isCi()),
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
  if (step.flakeQuarantine === undefined || isCi()) {
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
) => Effect.Effect<void, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path>;

const ignoreStreamingOutcome: StreamingOutcomeObserver = () => Effect.void;

const collectStreamingStepOutcomes = Effect.fn("QualityTasks.collectStreamingStepOutcomes")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1,
  onOutcome: StreamingOutcomeObserver = ignoreStreamingOutcome
) {
  if (A.isReadonlyArrayEmpty(steps)) {
    return A.empty<StreamingStepOutcome>();
  }

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
      const [elapsed, failure] = yield* runStepWithQuarantine(step, incidents).pipe(Effect.timed);
      const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const durationMs = Duration.toMillis(elapsed);
      yield* Console.log(`[beep-cli] ${step.label}: ${O.isNone(failure) ? "ok" : "failed"} in ${durationMs}ms`);
      const outcome = { durationMs, endedAt, failure, startedAt, step };
      yield* onOutcome(outcome, index);
      return outcome;
    }),
    { concurrency }
  );
  yield* O.match(artifactCwd, {
    onNone: () => Effect.void,
    onSome: (cwd) => Effect.flatMap(Ref.get(incidents), (recorded) => writeFlakeQuarantineArtifact(cwd, recorded)),
  });

  return outcomes;
});

const collectStreamingStepFailures = Effect.fn("QualityTasks.collectStreamingStepFailures")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1
) {
  return pipe(
    yield* collectStreamingStepOutcomes(label, steps, concurrency),
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
export type QualityTaskLaneInput = readonly [id: string, step: QualityTaskStep, inputDigest: O.Option<string>];

const qualityTaskLaneRunFromOutcome = (
  id: string,
  inputDigest: O.Option<string>,
  outcome: StreamingStepOutcome
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
    inputDigest,
  });

const collectQualityTaskLaneRuns = Effect.fn("QualityTasks.collectQualityTaskLaneRuns")(function* (
  label: string,
  lanes: ReadonlyArray<QualityTaskLaneInput>,
  concurrency = 1
) {
  const outcomes = yield* collectStreamingStepOutcomes(
    label,
    A.map(lanes, ([, step]) => step),
    concurrency,
    (outcome, index) =>
      pipe(
        A.get(lanes, index),
        O.match({
          onNone: () => Effect.void,
          onSome: ([id, , inputDigest]) =>
            appendQualityTaskLaneRun(qualityTaskLaneRunFromOutcome(id, inputDigest, outcome)),
        })
      )
  );
  return {
    report: QualityTaskLaneRunReport.make({
      schemaVersion: "quality-task-lane-run/v1",
      lanes: A.map(A.zip(lanes, outcomes), ([[id, , inputDigest], outcome]) =>
        qualityTaskLaneRunFromOutcome(id, inputDigest, outcome)
      ),
    }),
    failures: pipe(
      outcomes,
      A.map((outcome) => outcome.failure),
      A.getSomes
    ),
  };
});

// fallow-ignore-next-line complexity -- each lane must complete its proof lookup, run, failure capture, and receipt write in order
const runGithubCheckWave = Effect.fn("QualityTasks.runGithubCheckWave")(function* (
  label: string,
  wave: GithubCheckLaneWaveSpec
) {
  let activeReusableIds = A.empty<string>();
  let failures = A.empty<QualityTaskFailed>();
  let laneRuns = A.empty<QualityTaskLaneRun>();
  for (const lane of wave.lanes) {
    const session = yield* prepareLaneProofSession([lane]);
    const reusable = O.exists(session, (prepared) => hasReusableLaneProof(prepared, lane.id));
    const activeReuse = reusable && O.exists(session, (prepared) => prepared.mode === "active");
    if (reusable) {
      yield* Console.log(`[lane-proof] ${activeReuse ? "reusing" : "shadow hit for"} exact lane proof: ${lane.id}`);
    }
    if (activeReuse) {
      activeReusableIds = A.append(activeReusableIds, lane.id);
      const laneRun = QualityTaskLaneRun.make({
        id: lane.id,
        label: lane.step.label,
        status: "reused",
        inputDigest: O.none(),
      });
      yield* appendQualityTaskLaneRun(laneRun);
      laneRuns = A.append(laneRuns, laneRun);
      continue;
    }

    yield* Console.log(`[beep-cli] ${label}: running lane ${lane.id}`);
    const result = yield* collectQualityTaskLaneRuns(`${label}:${lane.id}`, [[lane.id, lane.step, O.none()]], 1);
    const run = A.head(result.report.lanes);
    if (O.isSome(run)) {
      laneRuns = A.append(laneRuns, run.value);
    }
    if (A.isReadonlyArrayNonEmpty(result.failures)) {
      failures = A.appendAll(failures, result.failures);
    } else {
      const durationMs = pipe(
        run,
        O.flatMap((laneRun) => laneRun.durationMs),
        O.getOrElse(() => 0)
      );
      yield* O.match(session, {
        onNone: () => Effect.void,
        onSome: (prepared) =>
          persistLaneProofs(prepared, [[lane, durationMs]]).pipe(
            Effect.catch((error) =>
              Console.error(`[lane-proof] could not persist lane proof: ${Inspectable.toStringUnknown(error)}`)
            )
          ),
      });
    }
  }
  return { activeReusableIds, failures, laneRuns };
});

const runStreamingStepGroup = Effect.fn("QualityTasks.runStreamingStepGroup")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1
) {
  const failures = yield* collectStreamingStepFailures(label, steps, concurrency);
  yield* failQualityTaskFailures(label, failures);
});

/**
 * Execute static GitHub-check waves and retain every sibling failure in the
 * active wave before applying the selected scheduling policy.
 *
 * **Example** (Inspect an empty fail-fast run)
 *
 * ```ts
 * import { collectGithubCheckLaneWavesForTesting } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const report = collectGithubCheckLaneWavesForTesting("pre-push", [], "fail-fast").pipe(
 *   Effect.map(({ report: value }) => value)
 * )
 * console.log(Effect.isEffect(report)) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param waves - Static lane waves in execution order.
 * @param failurePolicy - Whether a failed wave stops later scheduling.
 * @returns The schema-backed run report and all failures observed in executed waves.
 * @category execution
 * @since 0.0.0
 */
const collectGithubCheckLaneWaves = Effect.fn("QualityTasks.collectGithubCheckLaneWaves")(function* (
  label: string,
  waves: ReadonlyArray<GithubCheckLaneWaveSpec>,
  failurePolicy: GithubCheckFailurePolicy
) {
  let failures = A.empty<QualityTaskFailed>();
  let laneRuns = A.empty<GithubCheckLaneRun>();
  let qualityTaskLaneRuns = A.empty<QualityTaskLaneRun>();
  let stopped = false;

  for (const wave of waves) {
    if (stopped) {
      laneRuns = A.appendAll(
        laneRuns,
        A.map(wave.lanes, (lane) =>
          GithubCheckLaneRun.make({ id: lane.id, stage: lane.stage, status: "not-run-early-stop", wave: lane.wave })
        )
      );
      qualityTaskLaneRuns = A.appendAll(
        qualityTaskLaneRuns,
        yield* Effect.forEach(wave.lanes, (lane) => {
          const laneRun = QualityTaskLaneRun.make({
            id: lane.id,
            label: lane.step.label,
            status: "not-run-early-stop",
            inputDigest: O.none(),
          });
          return appendQualityTaskLaneRun(laneRun).pipe(Effect.as(laneRun));
        })
      );
      continue;
    }

    const {
      activeReusableIds,
      failures: waveFailures,
      laneRuns: waveLaneRuns,
    } = yield* runGithubCheckWave(`${label}:${wave.wave}`, wave);
    const failedLabels = A.map(waveFailures, (failure) => failure.label);
    laneRuns = A.appendAll(
      laneRuns,
      A.map(wave.lanes, (lane) =>
        GithubCheckLaneRun.make({
          id: lane.id,
          stage: lane.stage,
          status: A.contains(activeReusableIds, lane.id)
            ? "reused"
            : A.contains(failedLabels, lane.step.label)
              ? "failed"
              : "passed",
          wave: lane.wave,
        })
      )
    );
    qualityTaskLaneRuns = A.appendAll(qualityTaskLaneRuns, waveLaneRuns);
    failures = A.appendAll(failures, waveFailures);
    stopped = failurePolicy === "fail-fast" && A.isReadonlyArrayNonEmpty(waveFailures);
  }

  return {
    report: GithubCheckRunReport.make({ failurePolicy, lanes: laneRuns, schemaVersion: "github-check-run/v1" }),
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
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQualityTaskGithubCheckLaneWaves("pre-push", [], "fail-fast"))) // true
 * ```
 *
 * @param label - Group label rendered in CLI output.
 * @param waves - Static lane waves in execution order.
 * @param failurePolicy - Whether a failed wave stops later scheduling.
 * @category execution
 * @since 0.0.0
 */
export const runQualityTaskGithubCheckLaneWaves = Effect.fn("QualityTasks.runGithubCheckLaneWaves")(function* (
  label: string,
  waves: ReadonlyArray<GithubCheckLaneWaveSpec>,
  failurePolicy: GithubCheckFailurePolicy
) {
  const result = yield* collectGithubCheckLaneWaves(label, waves, failurePolicy);
  const reportJson = yield* githubCheckRunReportJson
    .encode(result.report)
    .pipe(QualityTaskConfigurationError.mapError("Failed to encode the GitHub-check wave report."));
  yield* Console.log(`${GITHUB_CHECK_RUN_REPORT_PREFIX}${reportJson}`);
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
): Effect.fn.Return<QualityTaskStepOutput, QualityTaskConfigurationError, ChildProcessSpawner.ChildProcessSpawner> {
  const command = commandText(step.command, step.args);
  const envOverrides = yield* turboEnvOverrides(step.command, step.args, Bun.env);
  const captureTimeout = step.captureTimeoutMillis;
  const result = yield* runCaptured({
    command: step.command,
    args: step.args,
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
    Effect.catchTag("CaptureCommandTimedOutError", (error) => Effect.succeed(capturedTimeoutResult(error))),
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

const coverageStep = (cwd: string, options: CoverageTaskOptions) =>
  QualityTaskStep.make({
    label: options.writeBaseline ? "coverage:baseline" : "coverage:ratchet",
    command: "bunx",
    args: turboRunArgs(
      ["coverage"],
      options.writeBaseline ? [...options.args, ...COVERAGE_SCOPED_BASELINE_VITEST_ARGS] : options.args
    ),
    cwd,
    env: {
      ...coverageEnvironment(),
      ...(options.writeBaseline ? { VITEST_COVERAGE_REPORT_ONLY: "1" } : {}),
    },
  });

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
        "--",
        COVERAGE_FULL_VITEST_FILE_PARALLELISM_ARG,
        A.some(packageNames, (packageName) => A.contains(COVERAGE_FULL_TWO_WORKER_PACKAGE_NAMES, packageName))
          ? COVERAGE_FULL_VITEST_LONG_POLE_MAX_WORKERS_ARG
          : COVERAGE_FULL_VITEST_MIXED_MAX_WORKERS_ARG,
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
 * import { Effect } from "effect"
 *
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

const rootBuildSteps = (repoRoot: string, args: ReadonlyArray<string>) => [
  QualityTaskStep.make({
    ...turboStep(repoRoot, "build", ["build"], boundedRootTurboArgs(args)),
    flakeQuarantine: "ts2589-no-location",
  }),
];

const rootCheckSteps = (repoRoot: string, args: ReadonlyArray<string>) => [
  QualityTaskStep.make({
    ...turboStep(repoRoot, "check", ["check"], boundedRootTurboArgs(args)),
    flakeQuarantine: "ts2589-no-location",
  }),
  ...optionalQualityTaskStep({
    enabled: shouldRunRepoWideSteps(args),
    step: () => repoCliStep(repoRoot, "check:tsgo:rules", ["quality", "tsgo-rules"]),
  }),
  ...optionalQualityTaskStep({
    enabled: shouldRunRepoWideSteps(args),
    step: () => repoCliStep(repoRoot, "check:tsgo:tests", ["quality", "test-tsgo"]),
  }),
  ...optionalQualityTaskStep({
    enabled: shouldRunRepoWideSteps(args),
    step: () => repoCliStep(repoRoot, "check:tsgo:smoke", ["quality", "tsgo-smoke"]),
  }),
];

const rootUnitTestSteps = (repoRoot: string, lanes: TestLaneSelectionState) => {
  const testArgs = boundedRootTurboArgs(lanes.args);

  return optionalQualityTaskStep({
    enabled: lanes.unit,
    step: () => turboStep(repoRoot, "test:unit", ["test"], testArgs),
  });
};

const rootTestSteps = (repoRoot: string, args: ReadonlyArray<string>) => {
  const lanes = parseTestLaneSelection(args);

  return [
    ...rootUnitTestSteps(repoRoot, lanes),
    ...optionalQualityTaskStep({
      enabled: lanes.integration,
      step: () =>
        turboStep(
          repoRoot,
          "test:integration:parallel",
          ["test:integration:parallel"],
          boundedRootTurboArgs(lanes.args)
        ),
    }),
    ...optionalQualityTaskStep({
      enabled: lanes.integration,
      step: () =>
        turboStep(
          repoRoot,
          "test:integration:serial",
          ["test:integration:serial"],
          ["--concurrency=1", ...withoutTurboConcurrencyArgs(lanes.args)]
        ),
    }),
  ];
};

const isLawSourcePath = (filePath: string): boolean =>
  (Str.startsWith("apps/")(filePath) || Str.startsWith("packages/")(filePath) || Str.startsWith("infra/")(filePath)) &&
  (Str.endsWith(".ts")(filePath) || Str.endsWith(".tsx")(filePath));

const isEcosystemPolarityPath = (filePath: string): boolean => {
  const segments = Str.split(filePath, "/");
  const memberPathHead = A.get(segments, 3);

  return (
    O.exists(A.get(segments, 0), Str.equivalence("packages")) &&
    O.exists(A.get(segments, 1), Str.equivalence("ecosystem")) &&
    O.exists(A.get(segments, 2), Str.isNonEmpty) &&
    O.exists(memberPathHead, (segment) => Str.equivalence("package.json")(segment) || Str.equivalence("src")(segment))
  );
};

const isPackageTestImportPath = (filePath: string): boolean =>
  Str.startsWith("packages/")(filePath) &&
  (Str.endsWith(".ts")(filePath) || Str.endsWith(".tsx")(filePath)) &&
  pipe(
    Str.split(filePath, "/test/"),
    A.head,
    O.exists((prefix) => !Str.equivalence(filePath)(prefix) && !Str.includes("/src/")(prefix))
  );

const scopedRepoCliStep = (
  repoRoot: string,
  label: string,
  args: ReadonlyArray<string>,
  isRelevant: (filePath: string) => boolean,
  files?: ReadonlyArray<string>
): ReadonlyArray<QualityTaskStep> => {
  if (P.isUndefined(files)) {
    return A.of(repoCliStep(repoRoot, label, args));
  }

  return A.match(A.filter(files, isRelevant), {
    onEmpty: A.empty,
    onNonEmpty: (relevantFiles) =>
      A.of(repoCliStep(repoRoot, label, [...args, "--include", A.join(relevantFiles, ",")])),
  });
};

const scopedLawStep = (
  repoRoot: string,
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  files?: ReadonlyArray<string>
): ReadonlyArray<QualityTaskStep> =>
  scopedRepoCliStep(repoRoot, label, ["laws", command, ...args], isLawSourcePath, files);

const rootRepoLintPolicySteps = (repoRoot: string, files?: ReadonlyArray<string>): ReadonlyArray<QualityTaskStep> =>
  A.map(
    [
      // Static LPT order from research/00-evidence-brief.md (run 31683014887):
      // deprecated-apis 975199ms, semantic-delta 78127ms,
      // schema-first 51162ms, then every remaining step in descending measured duration.
      repoCliStep(repoRoot, "lint:deprecated-apis", ["lint", "deprecated-apis"]),
      // Paired merge-base/HEAD comparison, so it is never file-scoped: it fails only on findings
      // introduced by this branch and lets the corpus keep its inherited ones.
      repoCliStep(repoRoot, "knowledge:semantic-delta", ["knowledge", "semantic-delta"]),
      // Whole-tree census with a zero-tolerance gate on live host-path classes; never file-scoped
      // because any tracked document can introduce a machine-local reference.
      repoCliStep(repoRoot, "knowledge:refs-check", ["knowledge", "refs", "--check"]),
      repoCliStep(repoRoot, "lint:schema-first", ["lint", "schema-first"]),
      ...scopedLawStep(repoRoot, "lint:terse-effect", "terse-effect", ["--check", "--advisory"], files),
      bunxStep(repoRoot, "lint:jsdoc", ["eslint", ".", "--max-warnings=0"]),
      ...scopedLawStep(repoRoot, "lint:native-runtime", "native-runtime", ["--check"], files),
      repoCliStep(repoRoot, "lint:identity-registry", ["lint", "identity-registry"]),
      ...scopedLawStep(repoRoot, "lint:frozen-grant-set", "frozen-grant-set", ["--check"], files),
      repoCliStep(repoRoot, "lint:circular", ["lint", "circular"]),
      ...scopedLawStep(repoRoot, "lint:effect-fn", "effect-fn", ["--check"], files),
      ...scopedRepoCliStep(
        repoRoot,
        "lint:package-test-imports",
        ["lint", "package-test-imports"],
        isPackageTestImportPath,
        files
      ),
      ...scopedLawStep(repoRoot, "lint:effect-imports", "effect-imports", ["--check"], files),
      // Standalone Markdown is invisible to Biome and the JSDoc inventory. Keep this
      // full authored-corpus pass advisory until the final per-module import flip.
      repoCliStep(repoRoot, "lint:effect-imports-markdown", [
        "laws",
        "effect-imports",
        "--mode",
        "markdown",
        "--check",
      ]),
      repoCliStep(repoRoot, "lint:package-test-typecheck", ["lint", "package-test-typecheck"]),
      repoCliStep(repoRoot, "lint:tsgo-rules", ["quality", "tsgo-rules"]),
      // Gate on mandatory (error) oxlint rules; --quiet suppresses the large advisory (warn)
      // backlog so the policy lane stays readable. `bun run lint:oxlint` stays verbose.
      // --disable-nested-config: the root config is the only real one; a live agent
      // worktree under .claude/worktrees/ carries a copy whose same-named `beep`
      // jsPlugin otherwise double-registers and aborts the run.
      bunxStep(repoRoot, "lint:oxlint", ["oxlint", "--quiet", "--disable-nested-config"]),
      ...scopedRepoCliStep(
        repoRoot,
        "lint:ecosystem-polarity",
        ["lint", "ecosystem-polarity"],
        isEcosystemPolarityPath,
        files
      ),
      repoCliStep(repoRoot, "lint:allowlist", ["laws", "allowlist-check"]),
      repoCliStep(repoRoot, "lint:jsdoc-module-tags", ["quality", "jsdoc-module-tags"]),
      repoCliStep(repoRoot, "goals:doctor", ["goals", "doctor"]),
      repoCliStep(repoRoot, "goals:index-check", ["goals", "index", "--check"]),
      repoCliStep(repoRoot, "lint:reflection-artifacts", ["lint", "reflection-artifacts"]),
      repoCliStep(repoRoot, "lint:roadmap-refs", ["lint", "roadmap-refs"]),
      repoCliStep(repoRoot, "lint:judge-rubric", ["lint", "judge-rubric"]),
      bunxStep(repoRoot, "lint:typos", ["typos"]),
    ],
    (step) =>
      QualityTaskStep.make({
        ...step,
        captureTimeoutMillis: QUALITY_CAPTURE_TIMEOUT_MILLIS,
      })
  );

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
 * @param files - Optional changed-file scope for naturally file-scoped policy steps.
 * @returns Planned subprocess steps for policy-only lint verification.
 * @category utilities
 * @since 0.0.0
 */
export const rootLintPolicyStepsForTesting: {
  (files?: ReadonlyArray<string>): (repoRoot: string) => ReadonlyArray<QualityTaskStep>;
  (repoRoot: string, files?: ReadonlyArray<string>): ReadonlyArray<QualityTaskStep>;
} = dual(
  (args: IArguments) => P.isString(args[0]),
  (repoRoot: string, files?: ReadonlyArray<string>): ReadonlyArray<QualityTaskStep> =>
    rootRepoLintPolicySteps(repoRoot, files)
);

/**
 * Run the repo-wide root lint policy checks without the aggregate Turbo lint lane.
 *
 * **Example** (Run a quality task)
 *
 * ```ts
 * import { runRootLintPolicyTask } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * const program = runRootLintPolicyTask(false)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
const runRootLintPolicyTaskInternal = Effect.fn("QualityTasks.runRootLintPolicyTask")(function* (
  full: boolean
): Effect.fn.Return<void, QualityTaskError, QualityTaskEnvironment> {
  const path = yield* Path.Path;
  const cwd = path.resolve(process.cwd());
  const repoRoot = yield* findRepoRoot(cwd);
  const runFull = full || isCi();
  let files: ReadonlyArray<string> | undefined;
  if (!runFull) {
    files = yield* collectChangedFiles(repoRoot, "origin/main", "HEAD");
  }
  const changedFileCount = pipe(
    O.fromUndefinedOr(files),
    O.map(A.length),
    O.getOrElse(() => 0)
  );

  yield* Console.log(`[beep-cli] lint:policy: scope=${runFull ? "full" : `changed (${changedFileCount} files)`}`);
  yield* Console.log(
    "[beep-cli] lint:policy: full-state checks: allowlist, tsgo-rules, identity-registry, judge-rubric, package-test-typecheck, reflection-artifacts, roadmap-refs, goals, schema-first, deprecated-apis, jsdoc, jsdoc-module-tags, docgen, circular, typos, oxlint"
  );
  yield* runStepGroup("lint:policy", rootRepoLintPolicySteps(repoRoot, files), LINT_POLICY_STEP_CONCURRENCY);
});

/**
 * Run the root lint policy battery (changed-scope by default, full on demand).
 *
 * **Example** (Use runRootLintPolicyTask)
 *
 * ```ts
 * import { runRootLintPolicyTask } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * const program = runRootLintPolicyTask(false)
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @param full - Run the full-repo sweep instead of the changed-scope default.
 * @returns The lint policy battery effect.
 * @category tasks
 * @since 0.0.0
 */
export const runRootLintPolicyTask = (full = false) => runRootLintPolicyTaskInternal(full);

const rootLintPolicySteps = (
  repoRoot: string,
  args: ReadonlyArray<string>,
  fix: boolean
): ReadonlyArray<QualityTaskStep> => {
  if (fix || !shouldRunLintRepoWideSteps(args)) {
    return A.empty<QualityTaskStep>();
  }

  return rootRepoLintPolicySteps(repoRoot);
};

const rootLintSteps = (repoRoot: string, args: ReadonlyArray<string>, fix: boolean) => {
  const lintArgs = boundedRootTurboArgs(fix ? stripLintFixAggregateArgs(args) : args);
  return [
    fix ? turboStep(repoRoot, "lint:fix", ["lint:fix"], lintArgs) : turboStep(repoRoot, "lint", ["lint"], lintArgs),
    ...rootLintPolicySteps(repoRoot, lintArgs, fix),
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

  const lintArgs = boundedRootTurboArgs(strippedLintArgs);
  const lintStep = fix
    ? turboStep(repoRoot, "lint:fix", ["lint:fix"], lintArgs)
    : turboStep(repoRoot, "lint", ["lint"], lintArgs);
  if (fix || !shouldRunLintRepoWideSteps(lintArgs)) {
    yield* runStep(lintStep);
    return;
  }

  yield* runStepGroup("lint", [lintStep, ...rootRepoLintPolicySteps(repoRoot)], ROOT_LINT_STEP_CONCURRENCY);
});

const rootAuditSteps = (repoRoot: string, args: ReadonlyArray<string>) => {
  const selection = parseRootAuditSelection(args);

  if (selection.mode === "packages") {
    return [turboStep(repoRoot, "audit:packages", ["audit"], boundedRootTurboArgs(ciFreshTurboArgs(selection.args)))];
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

const rootCoverageSteps = (repoRoot: string, args: ReadonlyArray<string>) => [
  coverageStep(repoRoot, parseCoverageTaskOptions(args)),
];

const invocationArgs = (invocation: QualityTaskInvocation): ReadonlyArray<string> =>
  invocation.args ?? A.empty<string>();
const invocationFix = (invocation: QualityTaskInvocation): boolean => invocation.fix ?? false;

const rootStepsFor = (repoRoot: string, invocation: QualityTaskInvocation): ReadonlyArray<QualityTaskStep> =>
  pipe(invocation, (current) =>
    Match.type<QualityTaskName>().pipe(
      Match.when("build", () => rootBuildSteps(repoRoot, invocationArgs(current))),
      Match.when("check", () => rootCheckSteps(repoRoot, invocationArgs(current))),
      Match.when("test", () => rootTestSteps(repoRoot, invocationArgs(current))),
      Match.when("lint", () => rootLintSteps(repoRoot, invocationArgs(current), invocationFix(current))),
      Match.when("audit", () => rootAuditSteps(repoRoot, invocationArgs(current))),
      Match.when("coverage", () => rootCoverageSteps(repoRoot, invocationArgs(current))),
      Match.exhaustive
    )(current.task)
  );

/**
 * Build root quality task subprocess steps. Exposed for focused unit tests.
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
    // The prebuild turbo task is `build`, which stays outside
    // LABS_EXCLUDED_TURBO_TASKS (ratified-minimal), so the required Coverage
    // Regression lane excludes labs here explicitly (lab-apps-lifecycle P2 row 9).
    turboStep(
      repoRoot,
      "coverage:prebuild",
      ["build"],
      [CI_TURBO_CONCURRENCY_ARG, "--summarize", LABS_TURBO_EXCLUDE_FILTER, ...prebuildFilterArgs, ...passthroughArgs]
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
    A.empty<string>()
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
  shardedExecutor && isWideSelectedCoverage(options)
    ? coverageSelectedShardedSteps(repoRoot, options)
    : [coverageStep(repoRoot, options)];

/**
 * Build the steps a planned selected coverage scope executes.
 *
 * **Details**
 *
 * Narrow selections stay one Turbo invocation. A selection whose planner
 * weight exceeds the single-invocation budget runs like the full lane on
 * hosted runners and baseline writes: one prebuild filtered to the selected
 * owners, then weighted `--only` shards with capped Vitest workers.
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
  const path = yield* Path.Path;
  const owners = yield* workspaceTaskOwners(repoRoot);
  const packageNames = pipe(
    owners,
    A.filter(ownerDefinesScript("coverage")),
    // lab-apps-lifecycle P2 (ratified row 9): labs never join the full-coverage
    // shard owner set, even when a lab defines a coverage script.
    A.filter((owner) => !isLabsWorkspacePath(path.relative(repoRoot, owner.packageDir))),
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
  const steps = coverageSelectedSteps(repoRoot, options, usesShardedCoverageExecutor(isCi(), options.writeBaseline));
  if (A.isReadonlyArrayNonEmpty(A.tailNonEmpty(steps))) {
    yield* Console.log(
      `[beep-cli] coverage:affected: selection weighs ${Math.round(coverageScopeWeightSeconds(options.expectedPackageNames))}s of planner budget (> ${COVERAGE_SELECTED_SINGLE_RUN_MAX_WEIGHT_SECONDS}s); using the weighted shard executor`
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
  if (!options.scoped && usesShardedCoverageExecutor(isCi(), options.writeBaseline)) {
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
  return yield* readJsonFile(path.join(packageDir, "package.json"));
});

const runPackageTask = Effect.fn("QualityTasks.runPackageTask")(function* (
  packageDir: string,
  invocation: QualityTaskInvocation
) {
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
});

const runRootTestTask = Effect.fn("QualityTasks.runRootTestTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const lanes = parseTestLaneSelection(args);
  const unitSteps = optionalQualityTaskStep({
    enabled: lanes.unit,
    step: () => turboStep(repoRoot, "test:unit", ["test"], boundedRootTurboArgs(lanes.args)),
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
        boundedRootTurboArgs(parallelArgs)
      ),
      ...optionalQualityTaskStep({
        enabled: A.isReadonlyArrayNonEmpty(unsplitFilters),
        step: () =>
          turboStep(
            repoRoot,
            "test:integration",
            ["test:integration"],
            boundedRootTurboArgs([...unsplitFilters, ...lanes.args])
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

  const steps = rootStepsFor(repoRoot, invocation);
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
export const runQualityTask: (
  invocation: QualityTaskInvocation
) => Effect.Effect<void, QualityTaskError, QualityTaskEnvironment> = Effect.fn("QualityTasks.runQualityTask")(
  function* (invocation: QualityTaskInvocation) {
    const path = yield* Path.Path;
    const cwd = path.resolve(process.cwd());
    const repoRoot = yield* findRepoRoot(cwd);
    const packageDir = yield* resolvePackageDir(repoRoot, cwd);

    yield* pipe(
      packageDir,
      O.map((dir) => runPackageTask(dir, invocation)),
      O.getOrElse(() => runRootTask(repoRoot, invocation))
    );
  }
);

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
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
 * Execute GitHub-check waves without raising their collected subprocess
 * failures. Exposed for focused scheduling tests.
 *
 * **Example** (Inspect a report effect)
 *
 * ```ts
 * import { collectGithubCheckLaneWavesForTesting } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
