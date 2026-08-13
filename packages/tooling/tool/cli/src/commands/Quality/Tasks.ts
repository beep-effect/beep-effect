/**
 * Canonical quality task adapter for repo root and workspace package scripts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot, insertEndOfOptions } from "@beep/repo-utils";
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
  canUseLocalEnv,
  configStringEqualsSync,
  configStringOption,
  isUnresolvedSecretReference,
  turboEnvOverrides,
} from "../../internal/cli/EnvConfig.ts";
import {
  formatCommandLine,
  QualityTaskStep,
  qualityStepOutputBound,
  runCaptured,
  runToExit,
} from "../../internal/process/index.ts";
import { collectChangedFiles } from "../../internal/repo-run/ChangedFiles.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import {
  cleanCoverageRegressionOutputs,
  compareCoverageRegressionBaseline,
  writeCoverageRegressionBaseline,
} from "./internal/CoverageRegression.ts";
import { CoverageScopeOwner, planCoverageAffectedScope, planCoverageFullShards } from "./internal/CoverageScope.ts";
import {
  detectNoLocationTs2589Flake,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifact,
  FlakeQuarantineArtifactJson,
  FlakeQuarantineIncident,
  flakeQuarantineOutputBound,
  laneQuarantineRerunStep,
  standaloneQuarantineRerunStep,
} from "./internal/FlakeQuarantine.ts";
import { QualityTaskConfigurationError, QualityTaskFailed, QualityTaskGroupFailed } from "./Quality.errors.ts";
import {
  decodePackageJsonDocument,
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckLaneRun,
  GithubCheckMode,
  GithubCheckRunReport,
  LintPolicySubcommand,
  PackageTaskProfile,
  QualityTaskBypassArgName,
  QualityTaskInvocation,
  QualityTaskName,
  RootAuditMode,
} from "./Quality.schemas.ts";
import type { DomainError, NoSuchFileError } from "@beep/repo-utils";
import type { PgliteTestcontainerResource } from "@beep/test-utils";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
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
const COVERAGE_FULL_SHARD_COUNT = 5;
const COVERAGE_WRITE_BASELINE_ARG = "--write-baseline";
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

const isCoveragePassthroughDelimiter = (arg: string): boolean => arg === "--";

const stripCoverageControlArgs: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isCoverageWriteBaselineArg(arg) && !isCoveragePassthroughDelimiter(arg)
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
    scoped: A.some(stripped, isExplicitTurboAffectedOrScopeArg),
    skip: false,
    writeBaseline: A.some(stripped, isCoverageWriteBaselineArg),
  };
};

const isCoverageAffectedArg = (arg: string): boolean => arg === "--affected";
const withoutCoverageAffectedArg: (args: ReadonlyArray<string>) => ReadonlyArray<string> = A.filter(
  (arg) => !isCoverageAffectedArg(arg)
);

const resolveCoverageTaskOptions = Effect.fn("QualityTasks.resolveCoverageTaskOptions")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<CoverageTaskOptions, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const parsed = parseCoverageTaskOptions(args);
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
  const path = yield* Path.Path;
  const owners = yield* workspaceTaskOwners(repoRoot);
  const scopeOwners = A.map(owners, (owner) =>
    CoverageScopeOwner.make({
      hasCoverage: ownerDefinesScript("coverage")(owner),
      packageName: owner.packageName,
      packagePath: pipe(path.relative(repoRoot, owner.packageDir), Str.replace(/\\/gu, "/")),
    })
  );
  const scope = planCoverageAffectedScope(scopeOwners, changedFiles);
  const passthroughArgs = withoutCoverageAffectedArg(args);

  return yield* Match.value(scope).pipe(
    Match.discriminatorsExhaustive("_tag")({
      full: ({ reasons }) =>
        Console.log(`[beep-cli] coverage:affected: full fallback (${A.join(reasons, "; ")})`).pipe(
          Effect.as(parseCoverageTaskOptions(passthroughArgs))
        ),
      selected: ({ packageNames }) =>
        Console.log(`[beep-cli] coverage:affected: selected ${A.join(packageNames, ", ")}`).pipe(
          Effect.as({
            args: coverageTurboArgs([...passthroughArgs, ...A.map(packageNames, (name) => `--filter=${name}`)]),
            expectedPackageNames: packageNames,
            scoped: true,
            skip: false,
            writeBaseline: parsed.writeBaseline,
          })
        ),
      noop: () =>
        Effect.succeed({
          args: A.empty<string>(),
          expectedPackageNames: A.empty<string>(),
          scoped: true,
          skip: true,
          writeBaseline: parsed.writeBaseline,
        }),
    })
  );
});

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

// Coverage is a hosted ratchet. Pin its CI identity and remove desktop terminal
// metadata so local baseline generation exercises the same branches as GitHub.
const coverageEnvironment = (): Record<string, string | undefined> => ({
  BEEP_FC_SEED: coverageFastCheckSeed(),
  CI: "true",
  GITHUB_ACTIONS: "true",
  NODE_OPTIONS: coverageNodeOptions(),
  TERM_PROGRAM: undefined,
  TERM_PROGRAM_VERSION: undefined,
  VITEST_COVERAGE_RATCHET: "1",
});

// fallow-ignore-next-line code-duplication -- coverage detection stays beside its deterministic hosted environment
const turboCoverageEnv = (
  tasks: ReadonlyArray<string>,
  args: ReadonlyArray<string>
): Record<string, string | undefined> | undefined =>
  // fallow-ignore-next-line code-duplication -- only Turbo coverage runs receive the hosted coverage environment
  includesTurboCoverageTask(tasks, args) ? coverageEnvironment() : undefined;

const linesFromText = (text: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(text), A.map(Str.trim), A.filter(Str.isNonEmpty));

const runGitLines = Effect.fn("QualityTasks.runGitLines")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const result = yield* runCaptured({
    command: "git",
    args,
    cwd: repoRoot,
    source: "stdout",
  }).pipe(QualityTaskConfigurationError.mapError(`Failed to spawn git ${A.join(args, " ")}`));
  if (result.exitCode !== 0) {
    return yield* QualityTaskConfigurationError.new(
      `git ${A.join(args, " ")} failed with exit code ${result.exitCode}.`
    );
  }
  return linesFromText(result.output);
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

type QuarantineStepAttempt = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
  readonly label: string;
  readonly command: string;
};

// Quarantine-eligible lanes capture while teeing so a failure's output can be
// matched against the no-location TS2589 signature; everything else keeps the
// inherited-stdio path unchanged.
const runStepCapturedForQuarantine = Effect.fn("QualityTasks.runStepCapturedForQuarantine")(function* (
  step: QualityTaskStep
): Effect.fn.Return<QuarantineStepAttempt, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const resolved = yield* withLocalEnv(step);
  const envOverrides = yield* turboEnvOverrides(resolved.command, resolved.args);
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
    extendEnv: true,
    source: "all",
    bound: flakeQuarantineOutputBound,
    tee: true,
  }).pipe(QualityTaskConfigurationError.mapError(`Failed to spawn ${command}`));

  return {
    exitCode: result.exitCode,
    output: result.output,
    truncated: result.truncated,
    label: resolved.label,
    command,
  };
});

// One quarantine attempt per lane failure: every flake-attributed package
// reruns standalone once, then the whole lane reruns once (cache-resumed) so
// tasks Turbo skipped after the flake still execute. Any rerun failure keeps
// the original failure hard. Returns the incidents when quarantine succeeded.
const attemptFlakeQuarantine = Effect.fn("QualityTasks.attemptFlakeQuarantine")(function* (
  step: QualityTaskStep,
  attempt: QuarantineStepAttempt
): Effect.fn.Return<ReadonlyArray<FlakeQuarantineIncident>, QualityTaskConfigurationError, QualityTaskEnvironment> {
  const policy = step.flakeQuarantine;
  if (policy === undefined) {
    return A.empty();
  }
  if (attempt.truncated) {
    yield* Console.log(`[flake-quarantine] ${step.label}: captured output truncated; keeping failure hard`);
    return A.empty();
  }

  const detected = detectNoLocationTs2589Flake(attempt.output);
  if (O.isNone(detected)) {
    yield* Console.log(
      `[flake-quarantine] ${step.label}: failure does not match the no-location TS2589 flake signature; keeping failure hard`
    );
    return A.empty();
  }

  const tasks = detected.value;
  const detectedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  yield* Console.log(
    `[flake-quarantine] ${step.label}: no-location TS2589 flake signature detected for ${A.join(
      A.map(tasks, (task) => task.taskId),
      ", "
    )}; rerunning standalone once`
  );

  const standaloneRuns: Array<{
    readonly taskId: string;
    readonly packageName: string;
    readonly task: string;
    readonly standaloneCommand: string;
    readonly standaloneDurationMs: number;
  }> = [];
  for (const task of tasks) {
    const [elapsed, rerun] = yield* runStepCapturedForQuarantine(standaloneQuarantineRerunStep(step, task)).pipe(
      Effect.timed
    );
    if (rerun.exitCode !== 0) {
      yield* Console.log(
        `[flake-quarantine] ${step.label}: standalone rerun for ${task.taskId} failed with exit ${rerun.exitCode}; keeping failure hard`
      );
      return A.empty();
    }
    standaloneRuns.push({
      taskId: task.taskId,
      packageName: task.packageName,
      task: task.task,
      standaloneCommand: rerun.command,
      standaloneDurationMs: Duration.toMillis(elapsed),
    });
  }

  const [laneElapsed, laneRerun] = yield* runStepCapturedForQuarantine(laneQuarantineRerunStep(step)).pipe(
    Effect.timed
  );
  if (laneRerun.exitCode !== 0) {
    yield* Console.log(
      `[flake-quarantine] ${step.label}: lane rerun failed with exit ${laneRerun.exitCode}; keeping failure hard`
    );
    return A.empty();
  }

  const laneRerunDurationMs = Duration.toMillis(laneElapsed);
  yield* Console.log(
    `[flake-quarantine] ${step.label}: quarantined ${A.length(standaloneRuns)} environment-only TS2589 flake incident(s); lane rerun green`
  );
  return A.map(standaloneRuns, (run) =>
    FlakeQuarantineIncident.make({
      policy,
      laneLabel: step.label,
      taskId: run.taskId,
      packageName: run.packageName,
      task: run.task,
      standaloneCommand: run.standaloneCommand,
      detectedAt,
      standaloneDurationMs: run.standaloneDurationMs,
      laneRerunDurationMs,
    })
  );
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
      Effect.catchTag("QualityTaskFailed", (failure) => Effect.succeed(O.some(failure)))
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

const collectStreamingStepFailures = Effect.fn("QualityTasks.collectStreamingStepFailures")(function* (
  label: string,
  steps: ReadonlyArray<QualityTaskStep>,
  concurrency = 1
) {
  if (A.isReadonlyArrayEmpty(steps)) {
    return A.empty<QualityTaskFailed>();
  }

  yield* Console.log(`[beep-cli] ${label}: running ${A.length(steps)} streaming step(s)`);
  const incidents = yield* Ref.make<ReadonlyArray<FlakeQuarantineIncident>>(A.empty());
  const artifactCwd = quarantineArtifactCwd(steps);
  yield* O.match(artifactCwd, {
    onNone: () => Effect.void,
    onSome: removeStaleFlakeQuarantineArtifact,
  });
  const failures = yield* Effect.forEach(
    steps,
    (step) =>
      runStepWithQuarantine(step, incidents).pipe(
        Effect.timed,
        Effect.tap(([elapsed, outcome]) =>
          Console.log(
            `[beep-cli] ${step.label}: ${O.isNone(outcome) ? "ok" : "failed"} in ${Duration.toMillis(elapsed)}ms`
          )
        ),
        Effect.map(([, outcome]) => outcome)
      ),
    { concurrency }
  );
  yield* O.match(artifactCwd, {
    onNone: () => Effect.void,
    onSome: (cwd) => Effect.flatMap(Ref.get(incidents), (recorded) => writeFlakeQuarantineArtifact(cwd, recorded)),
  });

  return A.getSomes(failures);
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
  let stopped = false;

  for (const wave of waves) {
    if (stopped) {
      laneRuns = A.appendAll(
        laneRuns,
        A.map(wave.lanes, (lane) =>
          GithubCheckLaneRun.make({ id: lane.id, stage: lane.stage, status: "not-run-early-stop", wave: lane.wave })
        )
      );
      continue;
    }

    const waveFailures = yield* collectStreamingStepFailures(
      `${label}:${wave.wave}`,
      A.map(wave.lanes, (lane) => lane.step)
    );
    const failedLabels = A.map(waveFailures, (failure) => failure.label);
    laneRuns = A.appendAll(
      laneRuns,
      A.map(wave.lanes, (lane) =>
        GithubCheckLaneRun.make({
          id: lane.id,
          stage: lane.stage,
          status: A.contains(failedLabels, lane.step.label) ? "failed" : "passed",
          wave: lane.wave,
        })
      )
    );
    failures = A.appendAll(failures, waveFailures);
    stopped = failurePolicy === "fail-fast" && A.isReadonlyArrayNonEmpty(waveFailures);
  }

  return {
    report: GithubCheckRunReport.make({ failurePolicy, lanes: laneRuns, schemaVersion: "github-check-run/v1" }),
    failures,
  };
});

const githubCheckRunReportJson = JsonStringCodec(GithubCheckRunReport);

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
  yield* failQualityTaskFailures(label, result.failures);
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
      ...coverageEnvironment(),
      ...(options.writeBaseline ? { VITEST_COVERAGE_REPORT_ONLY: "1" } : {}),
    },
  });

const coverageFullShardStep = (cwd: string, index: number, packageNames: ReadonlyArray<string>) =>
  QualityTaskStep.make({
    label: `coverage:shard-${index}`,
    command: "bunx",
    args: turboRunArgs(
      ["coverage"],
      ["--only", "--concurrency=1", "--summarize", ...A.map(packageNames, (packageName) => `--filter=${packageName}`)]
    ),
    cwd,
    env: coverageEnvironment(),
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

const rootRepoLintPolicySteps = (repoRoot: string, files?: ReadonlyArray<string>): ReadonlyArray<QualityTaskStep> => [
  // Static LPT order from research/00-evidence-brief.md (run 31683014887):
  // deprecated-apis 975199ms, docgen 197298ms, semantic-delta 78127ms,
  // schema-first 51162ms, then every remaining step in descending measured duration.
  repoCliStep(repoRoot, "lint:deprecated-apis", ["lint", "deprecated-apis"]),
  repoCliStep(repoRoot, "lint:docgen", ["docgen", "check", "--reuse-proof-manifest"]),
  // Paired merge-base/HEAD comparison, so it is never file-scoped: it fails only on findings
  // introduced by this branch and lets the corpus keep its inherited ones.
  repoCliStep(repoRoot, "knowledge:semantic-delta", ["knowledge", "semantic-delta"]),
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
  repoCliStep(repoRoot, "lint:package-test-typecheck", ["lint", "package-test-typecheck"]),
  repoCliStep(repoRoot, "lint:tsgo-rules", ["quality", "tsgo-rules"]),
  // Gate on mandatory (error) oxlint rules; --quiet suppresses the large advisory (warn)
  // backlog so the policy lane stays readable. `bun run lint:oxlint` stays verbose.
  bunxStep(repoRoot, "lint:oxlint", ["oxlint", "--quiet"]),
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
];

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

const runFullShardedCoverage = Effect.fn("QualityTasks.runFullShardedCoverage")(function* (repoRoot: string) {
  const owners = yield* workspaceTaskOwners(repoRoot);
  const packageNames = pipe(
    owners,
    A.filter(ownerDefinesScript("coverage")),
    A.map((owner) => owner.packageName)
  );
  if (A.isReadonlyArrayEmpty(packageNames)) {
    return yield* QualityTaskConfigurationError.new("No workspace packages define coverage.");
  }

  const shards = planCoverageFullShards(packageNames, COVERAGE_FULL_SHARD_COUNT);
  yield* Console.log(
    `[beep-cli] coverage:full: prebuild once, then ${A.length(shards)} weighted in-job shard(s) at aggregate concurrency ${COVERAGE_FULL_SHARD_COUNT}`
  );
  yield* runStep(turboStep(repoRoot, "coverage:prebuild", ["build"], [CI_TURBO_CONCURRENCY_ARG, "--summarize"]));
  yield* runStreamingStepGroup(
    "coverage:full",
    A.map(shards, (shard) => coverageFullShardStep(repoRoot, shard.index, shard.packageNames)),
    COVERAGE_FULL_SHARD_COUNT
  );
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
  if (isCi() && !options.scoped && !options.writeBaseline) {
    yield* runFullShardedCoverage(repoRoot);
  } else {
    yield* runStep(coverageStep(repoRoot, options));
  }

  if (options.writeBaseline) {
    yield* writeCoverageRegressionBaseline(repoRoot, options.scoped);
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
