/**
 * Canonical quality task adapter for repo root and workspace package scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot, insertEndOfOptions } from "@beep/repo-utils";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Duration, Effect, FileSystem, flow, Inspectable, Match, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import {
  canUseLocalEnv,
  configStringEqualsSync,
  configStringOption,
  isUnresolvedSecretReference,
  turboEnvOverrides,
} from "../../internal/cli/EnvConfig.js";
import {
  collectText,
  formatCommandLine,
  QualityTaskStep,
  qualityStepOutputBound,
  runCaptured,
  runToExit,
} from "../../internal/process/index.js";
import {
  cleanCoverageRegressionOutputs,
  compareCoverageRegressionBaseline,
  writeCoverageRegressionBaseline,
} from "./internal/CoverageRegression.js";
import { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Quality.errors.js";
import {
  decodePackageJsonDocument,
  GithubCheckMode,
  LintPolicySubcommand,
  PackageTaskProfile,
  QualityTaskBypassArgName,
  QualityTaskInvocation,
  QualityTaskName,
  RootAuditMode,
} from "./Quality.schemas.js";
import type { DomainError, NoSuchFileError } from "@beep/repo-utils";
import type { PgliteTestcontainerResource } from "@beep/test-utils";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { UnexpectedQualityTaskFailure } from "./Quality.errors.js";
import type { PackageJsonDocument, PackageJsonWorkspacesDocument } from "./Quality.schemas.js";

export { QualityTaskStep } from "../../internal/process/index.js";
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
} from "./Quality.errors.js";

const CHANGED_PATH_DIFF_FILTER = ["A", "C", "M", "R", "T", "U", "X", "B"].join("");
const LOCAL_BIOME_BIN = "./node_modules/.bin/biome";
const BIOME_FIX_CHANGED_ARGS = ["check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched"] as const;
const LINT_FIX_AGGREGATE_ARGS = ["--full", "--repo"] as const;
const ROOT_TURBO_CONCURRENCY_ARG = "--concurrency=3";
const ROOT_COVERAGE_TURBO_CONCURRENCY_ARG = "--concurrency=3";
const COVERAGE_WRITE_BASELINE_ARG = "--write-baseline";
// Full root lint runs the aggregate Turbo graph plus repo policy tools. Keep
// its group fan-out aligned with the root Turbo cap so hosted main checks do
// not start multiple CPU/memory-heavy process graphs at once.
const ROOT_LINT_STEP_CONCURRENCY = 3;
// Lint-policy steps are independent read-only tools (cspell, markdownlint,
// oxlint, eslint-jsdoc, law checks, madge...). Running them grouped-concurrent
// converts the lane from sum-of-steps to max-of-steps; keep it at the same
// hosted-stable cap as full root lint so policy-only checks do not overload
// constrained runners.
const LINT_POLICY_STEP_CONCURRENCY = 3;

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
  readonly types: boolean;
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
  readonly scoped: boolean;
  readonly writeBaseline: boolean;
};

const emptyParsedFixArgs: ParsedFixArgsState = {
  fix: false,
  args: A.empty<string>(),
};

const emptyTestLaneSelection: TestLaneSelectionState = {
  unit: false,
  integration: false,
  types: false,
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
      Match.when("--types", () => ({ ...lanes, types: true })),
      Match.orElse(() => ({ ...lanes, args: pipe(lanes.args, A.append(arg)) }))
    )
  );
  const hasLane = selected.unit || selected.integration || selected.types;
  return {
    unit: hasLane ? selected.unit : true,
    integration: hasLane ? selected.integration : true,
    types: hasLane ? selected.types : true,
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

const workspaceTaskFilters = Effect.fn("QualityTasks.workspaceTaskFilters")(function* (
  repoRoot: string,
  script: string
): Effect.fn.Return<ReadonlyArray<string>, QualityTaskConfigurationError, FileSystem.FileSystem | Path.Path> {
  const owners = yield* workspaceTaskOwners(repoRoot);

  return pipe(
    owners,
    A.filter((owner) => pipe(owner.scripts, R.get(script), O.isSome)),
    A.map((owner) => `--filter=${owner.packageName}`)
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
 * @example
 * ```ts
 * import { workspaceTaskFiltersForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const result = workspaceTaskFiltersForTesting("@beep/repo-cli")
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const workspaceTaskFiltersForTesting = workspaceTaskFilters;

const commandText = formatCommandLine;

const isTurboCacheControlArg = (arg: string): boolean =>
  arg === "--no-cache" ||
  arg === "--force" ||
  Str.startsWith("--force=")(arg) ||
  arg === "--remote-only" ||
  Str.startsWith("--remote-only=")(arg) ||
  arg === "--remote-cache-read-only" ||
  Str.startsWith("--remote-cache-read-only=")(arg) ||
  Str.startsWith("--cache=")(arg);

const isTurboConcurrencyArg = (arg: string): boolean =>
  arg === "--concurrency" || Str.startsWith("--concurrency=")(arg);

const isExplicitTurboScopeArg = (arg: string): boolean =>
  Str.startsWith("--filter")(arg) || Str.startsWith("--since")(arg);

const isExplicitTurboAffectedOrScopeArg = (arg: string): boolean =>
  arg === "--affected" || isExplicitTurboScopeArg(arg);

const isCoverageWriteBaselineArg = (arg: string): boolean => arg === COVERAGE_WRITE_BASELINE_ARG;

const isCoveragePassthroughDelimiter = (arg: string): boolean => arg === "--";

const stripCoverageControlArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isCoverageWriteBaselineArg(arg) && !isCoveragePassthroughDelimiter(arg)
);

const coverageTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> => {
  const stripped = stripCoverageControlArgs(stripPassthroughDelimiter(args));
  return isCi() || A.some(stripped, isTurboConcurrencyArg)
    ? stripped
    : [ROOT_COVERAGE_TURBO_CONCURRENCY_ARG, ...stripped];
};

const parseCoverageTaskOptions = (args: ReadonlyArray<string>): CoverageTaskOptions => {
  const stripped = stripPassthroughDelimiter(args);
  return {
    args: coverageTurboArgs(stripped),
    scoped: A.some(stripped, isExplicitTurboAffectedOrScopeArg),
    writeBaseline: A.some(stripped, isCoverageWriteBaselineArg),
  };
};

const isLintFixAggregateArg = (arg: string): boolean => A.some(LINT_FIX_AGGREGATE_ARGS, (name) => name === arg);

const stripLintFixAggregateArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isLintFixAggregateArg(arg)
);

const shouldForceAggregateLintFix = (args: ReadonlyArray<string>): boolean => A.some(args, isLintFixAggregateArg);

const shouldRunRepoWideSteps = (args: ReadonlyArray<string>): boolean => !A.some(args, isExplicitTurboScopeArg);
const shouldRunLintRepoWideSteps = (args: ReadonlyArray<string>): boolean =>
  !A.some(args, isExplicitTurboAffectedOrScopeArg);

const isCi = (): boolean => Bun.env.CI === "true" || configStringEqualsSync("CI", "true");

const localTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  isCi() || A.some(args, isTurboCacheControlArg) ? A.empty() : ["--cache=local:rw"];

const ciFreshTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  isCi() && !A.some(args, isTurboCacheControlArg) ? ["--force", ...args] : args;

const isUnscopedInvocation = (args: ReadonlyArray<string>): boolean => A.isReadonlyArrayEmpty(args);

const turboRunArgs = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  ...tasks,
  ...localTurboCacheArgs(args),
  ...args,
];

const boundedRootTurboArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  isCi() || A.some(args, isTurboConcurrencyArg) ? args : [ROOT_TURBO_CONCURRENCY_ARG, ...args];

const includesTurboCoverageTask = (tasks: ReadonlyArray<string>, args: ReadonlyArray<string>): boolean =>
  A.some(tasks, (task) => task === "coverage") || A.some(args, (arg) => arg === "coverage");

// fallow-ignore-next-line code-duplication
const turboCoverageEnv = (
  tasks: ReadonlyArray<string>,
  args: ReadonlyArray<string>
): Record<string, string> | undefined =>
  // fallow-ignore-next-line code-duplication
  includesTurboCoverageTask(tasks, args) ? { VITEST_COVERAGE_RATCHET: "1" } : undefined;

const linesFromText = (text: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(text), A.map(Str.trim), A.filter(Str.isNonEmpty));

const runGitLines = Effect.fn("QualityTasks.runGitLines")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const output = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", [...args], {
        cwd: repoRoot,
        stderr: "ignore",
        stdout: "pipe",
      });
      const text = yield* collectText(handle.stdout);
      const exitCode = yield* handle.exitCode;
      if (exitCode !== 0) {
        return yield* QualityTaskConfigurationError.new(`git ${A.join(args, " ")} failed with exit code ${exitCode}.`);
      }
      return text;
    })
  ).pipe(QualityTaskConfigurationError.mapError(`Failed to spawn git ${A.join(args, " ")}`));

  return linesFromText(output);
});

const collectWorkingTreeChangedFiles = Effect.fn("QualityTasks.collectWorkingTreeChangedFiles")(function* (
  repoRoot: string
) {
  const gitArgs: ReadonlyArray<ReadonlyArray<string>> = [
    ["diff", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "HEAD", "--"],
    ["diff", "--cached", "--name-only", `--diff-filter=${CHANGED_PATH_DIFF_FILTER}`, "--"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const files = yield* Effect.forEach(
    gitArgs,
    (args) => runGitLines(repoRoot, args).pipe(Effect.option, Effect.map(O.getOrElse(A.empty<string>))),
    { concurrency: 3 }
  );

  return pipe(A.flatten(files), A.dedupe, A.sort(Order.String));
});

const collectExistingWorkingTreeChangedFiles = Effect.fn("QualityTasks.collectExistingWorkingTreeChangedFiles")(
  function* (repoRoot: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const changedFiles = yield* collectWorkingTreeChangedFiles(repoRoot);

    return yield* Effect.filter(changedFiles, (file) =>
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

const withLocalEnv = Effect.fn("QualityTasks.withLocalEnv")(function* (step: QualityTaskStep) {
  if (step.useLocalEnv !== true) {
    return step;
  }

  const shouldUseLocalEnv = yield* canUseLocalEnv(step.cwd);
  if (!shouldUseLocalEnv) {
    return step;
  }

  return QualityTaskStep.make({
    label: `${step.label} (op run)`,
    command: "op",
    args: ["run", "--env-file=.env", "--", step.command, ...step.args],
    cwd: step.cwd,
  });
});

const runStep = Effect.fn("QualityTasks.runStep")(function* (step: QualityTaskStep) {
  const resolved = yield* withLocalEnv(step);
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args);
  yield* Console.log(`[beep-cli] ${resolved.label}: ${commandText(resolved.command, resolved.args)}`);
  const exitCode = yield* runToExit({
    command: resolved.command,
    args: resolved.args,
    cwd: resolved.cwd,
    env: {
      ...envOverrides,
      ...(resolved.env ?? {}),
    },
    extendEnv: true,
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

const collectStreamingStepFailures = Effect.fn("QualityTasks.collectStreamingStepFailures")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>
) {
  if (A.isReadonlyArrayEmpty(steps)) {
    return A.empty<QualityTaskFailed>();
  }

  yield* Console.log(`[beep-cli] ${label}: running ${A.length(steps)} streaming step(s)`);
  const failures = yield* Effect.forEach(
    steps,
    (step) =>
      runStep(step).pipe(
        Effect.as(O.none<QualityTaskFailed>()),
        Effect.catchTag("QualityTaskFailed", (failure) => Effect.succeed(O.some(failure))),
        Effect.timed,
        Effect.tap(([elapsed, outcome]) =>
          Console.log(
            `[beep-cli] ${step.label}: ${O.isNone(outcome) ? "ok" : "failed"} in ${Duration.toMillis(elapsed)}ms`
          )
        ),
        Effect.map(([, outcome]) => outcome)
      ),
    { concurrency: 1 }
  );

  return A.getSomes(failures);
});

const runStreamingStepGroup = Effect.fn("QualityTasks.runStreamingStepGroup")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>
) {
  const failures = yield* collectStreamingStepFailures(label, steps);
  yield* failQualityTaskFailures(label, failures);
});

const collectResolvedStepOutput = Effect.fn("QualityTasks.collectResolvedStepOutput")(function* (
  step: QualityTaskStep
): Effect.fn.Return<QualityTaskStepOutput, QualityTaskConfigurationError, ChildProcessSpawner.ChildProcessSpawner> {
  const command = commandText(step.command, step.args);
  const envOverrides = yield* turboEnvOverrides(step.command, step.args);
  const result = yield* runCaptured({
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: {
      ...envOverrides,
      ...(step.env ?? {}),
    },
    extendEnv: true,
    stdin: "inherit",
    source: "all",
    bound: qualityStepOutputBound,
    trim: true,
  }).pipe(QualityTaskConfigurationError.mapError(`Failed to spawn ${command}`));

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
  const resolved = yield* withLocalEnv(step);
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
  const resolvedSteps = yield* Effect.forEach(steps, withLocalEnv);
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
    ...O.getSomesStruct({ env: O.fromUndefinedOr(env) }),
  });
};

const coverageStep = (cwd: string, options: CoverageTaskOptions) =>
  QualityTaskStep.make({
    label: options.writeBaseline ? "coverage:baseline" : "coverage:ratchet",
    command: "bunx",
    args: turboRunArgs(["coverage"], options.args),
    cwd,
    env: {
      VITEST_COVERAGE_RATCHET: "1",
      ...(options.writeBaseline ? { VITEST_COVERAGE_REPORT_ONLY: "1" } : {}),
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
  bunRunStep(cwd, label, ["beep", ...args]);

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
  args: turboRunArgs(["test:integration"], ["--concurrency=1", ...args]),
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
    label: "test:integration",
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
 * @param repoRoot - Repository root directory.
 * @param args - Turbo passthrough arguments.
 * @param options - Shared PostgreSQL-compatible test database options.
 * @returns Planned SQL integration subprocess step.
 * @example
 * ```ts
 * import { sqlIntegrationStepForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const step = sqlIntegrationStepForTesting("/repo", ["--filter", "@beep/db"], {
 *   connectionUri: "postgres://localhost:5432/test"
 * })
 * console.log(step.label) // "test:integration"
 * ```
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
 * @example
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
 * @category utilities
 * @since 0.0.0
 */
export const runSqlIntegrationTestLaneForTesting = runSqlIntegrationTestLane;

/**
 * Resolve the SQL integration database connection URI from environment variables.
 * Exposed for focused unit tests.
 *
 * @example
 * ```ts
 * import { sqlIntegrationConnectionUriFromEnvForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const result = sqlIntegrationConnectionUriFromEnvForTesting({ DATABASE_URL: "postgres://localhost/beep" })
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const sqlIntegrationConnectionUriFromEnvForTesting = sqlIntegrationConnectionUriFromEnv;

const optionalQualityTaskStep = ({ enabled, step }: OptionalQualityTaskStep): ReadonlyArray<QualityTaskStep> =>
  enabled ? A.of(step()) : A.empty();

const rootBuildSteps = (repoRoot: string, args: ReadonlyArray<string>) => [
  QualityTaskStep.make({
    label: "build",
    command: "bunx",
    args: turboRunArgs(["build"], boundedRootTurboArgs(args)),
    cwd: repoRoot,
    useLocalEnv: true,
  }),
];

const rootCheckSteps = (repoRoot: string, args: ReadonlyArray<string>) => [
  turboStep(repoRoot, "check", ["check"], boundedRootTurboArgs(args)),
  ...optionalQualityTaskStep({
    enabled: shouldRunRepoWideSteps(args),
    step: () => repoCliStep(repoRoot, "check:dtslint:tsgo", ["quality", "dtslint-tsgo"]),
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

const rootUnitAndTypeTestSteps = (repoRoot: string, lanes: TestLaneSelectionState) => {
  const testArgs = boundedRootTurboArgs(lanes.args);

  return [
    ...optionalQualityTaskStep({
      enabled: lanes.unit,
      step: () => turboStep(repoRoot, "test:unit", ["test"], testArgs),
    }),
    ...optionalQualityTaskStep({
      enabled: lanes.types,
      step: () => turboStep(repoRoot, "test:types", ["type-test"], testArgs),
    }),
  ];
};

const rootTestSteps = (repoRoot: string, args: ReadonlyArray<string>) => {
  const lanes = parseTestLaneSelection(args);

  return [
    ...rootUnitAndTypeTestSteps(repoRoot, lanes),
    ...optionalQualityTaskStep({
      enabled: lanes.integration,
      step: () => turboStep(repoRoot, "test:integration", ["test:integration"], ["--concurrency=1", ...lanes.args]),
    }),
  ];
};

const rootRepoLintPolicySteps = (repoRoot: string): ReadonlyArray<QualityTaskStep> => [
  repoCliStep(repoRoot, "lint:effect-imports", ["laws", "effect-imports", "--check"]),
  repoCliStep(repoRoot, "lint:terse-effect", ["laws", "terse-effect", "--check"]),
  repoCliStep(repoRoot, "lint:effect-fn", ["laws", "effect-fn", "--check"]),
  repoCliStep(repoRoot, "lint:native-runtime", ["laws", "native-runtime", "--check"]),
  repoCliStep(repoRoot, "lint:dual-arity", ["laws", "dual-arity", "--check"]),
  repoCliStep(repoRoot, "lint:allowlist", ["laws", "allowlist-check"]),
  repoCliStep(repoRoot, "lint:tsgo-rules", ["quality", "tsgo-rules"]),
  repoCliStep(repoRoot, "lint:identity-registry", ["lint", "identity-registry"]),
  repoCliStep(repoRoot, "lint:package-test-imports", ["lint", "package-test-imports"]),
  repoCliStep(repoRoot, "lint:reflection-artifacts", ["lint", "reflection-artifacts"]),
  repoCliStep(repoRoot, "lint:roadmap-refs", ["lint", "roadmap-refs"]),
  repoCliStep(repoRoot, "goals:doctor", ["goals", "doctor"]),
  repoCliStep(repoRoot, "goals:index-check", ["goals", "index", "--check"]),
  repoCliStep(repoRoot, "lint:schema-first", ["lint", "schema-first"]),
  repoCliStep(repoRoot, "lint:deprecated-apis", ["lint", "deprecated-apis"]),
  bunxStep(repoRoot, "lint:jsdoc", ["eslint", ".", "--max-warnings=0"]),
  repoCliStep(repoRoot, "lint:jsdoc-module-tags", ["quality", "jsdoc-module-tags"]),
  repoCliStep(repoRoot, "lint:docgen", ["docgen", "check", "--reuse-proof-manifest"]),
  bunxStep(repoRoot, "lint:spell", ["cspell", ".", "--no-progress"]),
  bunxStep(repoRoot, "lint:markdown", ["markdownlint-cli2"]),
  repoCliStep(repoRoot, "lint:circular", ["lint", "circular"]),
  bunxStep(repoRoot, "lint:typos", ["typos"]),
  // Gate on the mandatory (error) oxlint rule only; --quiet suppresses the large advisory
  // (warn) backlog so the policy lane stays readable. `bun run lint:oxlint` stays verbose.
  bunxStep(repoRoot, "lint:oxlint", ["oxlint", "--quiet"]),
];

/**
 * Build the repo-wide root lint policy subprocess steps.
 *
 * @param repoRoot - Repository root directory.
 * @returns Planned subprocess steps for policy-only lint verification.
 * @example
 * ```ts
 * import { rootLintPolicyStepsForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * console.log(rootLintPolicyStepsForTesting("/repo").map((step) => step.label))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const rootLintPolicyStepsForTesting = (repoRoot: string): ReadonlyArray<QualityTaskStep> =>
  rootRepoLintPolicySteps(repoRoot);

/**
 * Run the repo-wide root lint policy checks without the aggregate Turbo lint lane.
 *
 * @example
 * ```ts
 * import { runRootLintPolicyTask } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(runRootLintPolicyTask)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runRootLintPolicyTask: Effect.Effect<void, QualityTaskError, QualityTaskEnvironment> = Effect.gen(
  function* () {
    const path = yield* Path.Path;
    const cwd = path.resolve(process.cwd());
    const repoRoot = yield* findRepoRoot(cwd);

    yield* runStepGroup("lint:policy", rootRepoLintPolicySteps(repoRoot), LINT_POLICY_STEP_CONCURRENCY);
  }
);

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
 * @param repoRoot - Repository root directory.
 * @param invocation - Parsed quality invocation.
 * @returns Planned subprocess steps.
 * @example
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

const runRootCoverageTask = Effect.fn("QualityTasks.runRootCoverageTask")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
) {
  const options = parseCoverageTaskOptions(args);
  if (!options.writeBaseline && configStringEqualsSync("VITEST_COVERAGE_REPORT_ONLY", "1")) {
    return yield* QualityTaskConfigurationError.new(
      "VITEST_COVERAGE_REPORT_ONLY is only supported for coverage baseline regeneration. Run `bun run coverage:baseline:write` to regenerate the baseline, or unset it for the coverage gate."
    );
  }

  yield* cleanCoverageRegressionOutputs(repoRoot);
  yield* runStep(coverageStep(repoRoot, options));

  if (options.writeBaseline) {
    yield* writeCoverageRegressionBaseline(repoRoot);
    return;
  }

  yield* compareCoverageRegressionBaseline(repoRoot, options.scoped);
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
  const typeArgs = lanes.types ? yield* workspaceTaskArgs(repoRoot, "type-test", lanes.args) : A.empty<string>();
  const unitAndTypeSteps = [
    ...optionalQualityTaskStep({
      enabled: lanes.unit,
      step: () => turboStep(repoRoot, "test:unit", ["test"], boundedRootTurboArgs(lanes.args)),
    }),
    ...optionalQualityTaskStep({
      enabled: lanes.types,
      step: () => turboStep(repoRoot, "test:types", ["type-test"], boundedRootTurboArgs(typeArgs)),
    }),
  ];
  const unitAndTypeFailures = yield* collectStreamingStepFailures("test", unitAndTypeSteps);
  const integrationFailures = lanes.integration
    ? yield* Effect.scoped(
        Effect.gen(function* () {
          const integrationArgs = yield* workspaceTaskArgs(repoRoot, "test:integration", lanes.args);
          const resource = yield* acquireDefaultSqlIntegrationResource;
          return yield* collectStreamingStepFailures("test:integration", [
            sqlIntegrationStep(repoRoot, integrationArgs, resource),
          ]);
        })
      )
    : A.empty<QualityTaskFailed>();

  yield* failQualityTaskFailures("test", A.appendAll(unitAndTypeFailures, integrationFailures));
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
  if (A.length(steps) === 1 && O.isSome(step)) {
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
 * @param argv - Raw command arguments after the binary name.
 * @returns Parsed invocation or `None` when another command group should handle it.
 * @example
 * ```ts
 * import { parseQualityTaskInvocation } from "@beep/repo-cli/commands/Quality/Tasks"
 * import * as O from "effect/Option"
 * const invocation = parseQualityTaskInvocation(["lint", "--fix"])
 * const handled = O.isSome(invocation)
 * ```
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
 * @param invocation - Parsed quality task invocation.
 * @example
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
 * @param argv - Raw command arguments after the binary name.
 * @returns `true` when the invocation was handled by the quality adapter.
 * @example
 * ```ts
 * import { runQualityTaskIfRequested } from "@beep/repo-cli/commands/Quality/Tasks"
 * const program = runQualityTaskIfRequested(["build", "--affected"])
 * ```
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
 * @param step - Step to run.
 * @returns Captured combined stdout/stderr and exit code.
 * @example
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
 * @category utilities
 * @since 0.0.0
 */
export const collectStepOutput = (step: QualityTaskStep) =>
  collectStepOutputInternal(step).pipe(Effect.map(({ output, exitCode }) => ({ output, exitCode })));

/**
 * Run a bounded quality task group. Exposed for focused unit tests.
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @param concurrency - Maximum number of steps to run at once.
 * @example
 * ```ts
 * import { runQualityTaskStepGroup } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQualityTaskStepGroup("lint", [], 1))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTaskStepGroup = runStepGroup;

/**
 * Run independent quality task subprocess steps sequentially while streaming
 * output, then fail with all subprocess failures.
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @example
 * ```ts
 * import { runQualityTaskStreamingStepGroup } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQualityTaskStreamingStepGroup("lint", []))) // true
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runQualityTaskStreamingStepGroup = runStreamingStepGroup;

/**
 * Run a bounded quality task group. Exposed for focused unit tests.
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @param concurrency - Maximum number of steps to run at once.
 * @example
 * ```ts
 * import { runQualityTaskStepGroupForTesting } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQualityTaskStepGroupForTesting("lint", [], 1))) // true
 * ```
 * @category testing
 * @since 0.0.0
 */
export const runQualityTaskStepGroupForTesting = runQualityTaskStepGroup;

/**
 * Run independent quality task subprocess steps sequentially while streaming
 * output. Exposed for focused unit tests.
 *
 * @param label - Group label rendered in CLI output.
 * @param steps - Subprocess steps to execute.
 * @example
 * ```ts
 * import { runQualityTaskStreamingStepGroupForTesting } from "@beep/repo-cli/commands/Quality"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQualityTaskStreamingStepGroupForTesting("lint", []))) // true
 * ```
 * @category testing
 * @since 0.0.0
 */
export const runQualityTaskStreamingStepGroupForTesting = runQualityTaskStreamingStepGroup;

/**
 * Collect existing changed files for the root lint fix fast path.
 *
 * @param repoRoot - Repository root directory.
 * @example
 * ```ts
 * import { collectLintFixChangedFilesForTesting } from "@beep/repo-cli/commands/Quality"
 *
 * const result = collectLintFixChangedFilesForTesting
 * console.log(result) // rendered command output
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const collectLintFixChangedFilesForTesting = collectExistingWorkingTreeChangedFiles;

/**
 * Build the root lint fix changed-file step. Exposed for focused unit tests.
 *
 * @param repoRoot - Repository root directory.
 * @param files - Changed files to pass to Biome.
 * @example
 * ```ts
 * import { lintFixChangedStepForTesting } from "@beep/repo-cli/commands/Quality"
 * console.log(lintFixChangedStepForTesting("/repo", ["src/example.ts"]))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const lintFixChangedStepForTesting = lintFixChangedStep;
