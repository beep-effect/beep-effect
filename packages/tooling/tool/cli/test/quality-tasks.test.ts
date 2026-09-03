import {
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLaneStepsForTesting,
  ciLocalStepsForTesting,
} from "@beep/repo-cli/commands/Ci";
import {
  QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
  QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
} from "@beep/repo-cli/commands/Quality";
import {
  collectAuditDiffInputForTesting,
  fallowAuditDiffFallbackArgsForTesting,
  fallowAuditNeedsDiffFallbackForTesting,
  fallowCiUploadDiagnosticsForTesting,
} from "@beep/repo-cli/commands/Quality/FallowQuality.command";
import {
  collectCoverageChangedFilesForTesting,
  collectGithubCheckLaneWavesForTesting,
  collectQualityTaskLaneRunsForTesting,
  runQualityTaskGithubCheckLaneWaves,
  runQualityTaskStreamingLaneGroup,
} from "@beep/repo-cli/commands/Quality/Tasks";
import {
  baselineEntriesLostByReplacement,
  CoverageBaselineChangeSet,
  CoverageBaselineRowDelta,
  CoverageComparisonFailure,
  CoverageFileBaseline,
  CoveragePackageBaseline,
  CoverageRegressionBaseline,
  CoverageScopeOwner,
  CoverageUncoveredCounts,
  changedCoverageOwners,
  collectEffectTsgoDiagnosticLines,
  compareCoverageRegressionSnapshotsForExpectedPackagesForTesting,
  compareCoverageRegressionSnapshotsForTesting,
  compareJSDocTotalsForTesting,
  compareKnipFindingsForTesting,
  coverageBaselineRowDelta,
  coverageBaselineRowDeltaFromBase,
  coverageBaselineWriterChangedFiles,
  coverageBaselineWriteSummary,
  coverageDependentOwners,
  coverageDispositionGapsForTesting,
  coverageFullStepsForTesting,
  coveragePackageBaselineFromSummaryForTesting,
  coverageScopedBaselineWriteCommand,
  coverageScopeWeightSeconds,
  coverageSelectedStepsForTesting,
  detectQualityProfileForTesting,
  devQualityStepsForTesting,
  FallowReportFinding,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifactJson,
  GITHUB_CHECK_RUN_REPORT_PREFIX,
  GithubCheckFailurePolicy,
  GithubCheckLaneSpec,
  GithubCheckLaneWaveSpec,
  GithubCheckMode,
  GithubCheckRunReport,
  GithubChecksFallowFeatureMatrix,
  githubCheckChangesetStatusLane,
  githubCheckCheapGateLanes,
  githubCheckLanePlan,
  githubCheckLanesForModeForTesting,
  githubCheckPrePushExternalLanesForTesting,
  githubCheckPromotedFallowLaneDiagnosticsForTesting,
  githubCheckQualityLanesForTesting,
  githubCheckRepoSanityLanesForTesting,
  KnipFinding,
  LaneProofSession,
  lintFixChangedStepForTesting,
  mergeCoverageBaselinePackagesForTesting,
  missingTestTsgoTaskMessageForTesting,
  normalizeKnipReportForTesting,
  parseQualityTaskInvocation,
  persistLaneProofs,
  planCoverageAffectedScope,
  planCoverageAffectedScopeWithBaseline,
  planCoverageBaselineWrite,
  planCoverageFullShards,
  planWorkspaceCoverageAffectedScope,
  prepareLaneProofSession,
  promotedFallowGithubCheckLaneIdsForTesting,
  QUALITY_TASK_LANE_RUN_REPORT_PREFIX,
  QualityTaskFailed,
  QualityTaskGroupFailed,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
  QualityTaskStep,
  qualityProfileConfigForTesting,
  readCoverageComparisonBaselineForTesting,
  renderCoverageFailuresForTesting,
  renderCoverageRemediation,
  reviewFixDocgenLocalArgsForTesting,
  rootLintPolicyStepsForTesting,
  rootQualityStepsForTesting,
  runGithubChecks,
  runQualityTask,
  runQualityTaskStepGroupForTesting,
  runQualityTaskStreamingStepGroupForTesting,
  runRootLintPolicyTask,
  runSqlIntegrationTestLaneForTesting,
  sqlIntegrationConnectionUriFromEnvForTesting,
  sqlIntegrationStepForTesting,
  turboSecretSessionStepForTesting,
  turboStepLocalEnvForTesting,
  validateCoverageTaskArgsForTesting,
  withoutUnusableRemoteCacheForTesting,
  workspaceCoverageScopeOwners,
  workspaceTaskFiltersForTesting,
  writeCoverageRegressionBaseline,
} from "@beep/repo-cli/test/Quality";
import {
  hasRemoteTurboCacheArgs,
  localOnlyTurboCacheArgs,
  readTurboCacheEnvironmentSync,
  resolveTurboCachePlan,
  turboCachePlanArgs,
} from "@beep/repo-cli/test/SharedInternals";
import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { PosInt } from "@beep/schema/Int";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { NonNegativeInt } from "@beep/schema/Number";
import { Percentage } from "@beep/schema/Percentage";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  Cause,
  ConfigProvider,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  Inspectable,
  Layer,
  Order,
  Path,
  pipe,
  Sink,
  Stream,
} from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type { CiLaneId } from "@beep/repo-cli/commands/Ci";
import type { GithubCheckLaneWave, QualityTaskInvocation } from "@beep/repo-cli/test/Quality";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer)),
  TestConsole.layer
);
const PullRequestConfigLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REF_NAME: "feature/cheap-gates" })
);
const MainPushConfigLayer = ConfigProvider.layer(
  ConfigProvider.fromUnknown({ GITHUB_EVENT_NAME: "push", GITHUB_REF_NAME: "main" })
);
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const decodeGithubChecksFallowFeatureMatrixJsoncForTesting = decodeJsoncTextAs(GithubChecksFallowFeatureMatrix);
const decodeCoverageRegressionBaselineJsoncForTesting = decodeJsoncTextAs(CoverageRegressionBaseline);
const isDomainError = S.is(DomainError);
const isQualityTaskFailed = S.is(QualityTaskFailed);
const isQualityTaskGroupFailed = S.is(QualityTaskGroupFailed);
const isString = (value: unknown): value is string => typeof value === "string";
const repoCliEntryArgs = (...args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "run",
  "packages/tooling/tool/cli/src/bin.ts",
  "--",
  ...args,
];
const qualityLaneArgs = (lanes: ReadonlyArray<GithubCheckLaneSpec>, laneId: string): ReadonlyArray<string> =>
  pipe(
    lanes,
    A.findFirst((lane) => lane.id === laneId),
    O.map((lane) => lane.step.args),
    O.getOrThrowWith(() => new Error(`missing quality lane ${laneId}`))
  );
const runGit = Effect.fn("QualityTasksTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  assert.strictEqual(yield* handle.exitCode, 0);
});
const coveragePercentages = (value: number) => ({
  lines: Percentage.make(value),
  statements: Percentage.make(value),
  branches: Percentage.make(value),
  functions: Percentage.make(value),
});
const coveragePackageBaseline = (path: string, metric = 50): CoveragePackageBaseline =>
  CoveragePackageBaseline.make({
    path,
    ...coveragePercentages(metric),
    uncovered: coverageUncovered(0),
    files: {},
  });
const coverageUncovered = (count: number): CoverageUncoveredCounts => {
  const decoded = NonNegativeInt.make(count);
  return CoverageUncoveredCounts.make({
    lines: decoded,
    statements: decoded,
    branches: decoded,
    functions: decoded,
  });
};
const coverageFileBaseline = (metric: number, uncovered: number): CoverageFileBaseline =>
  CoverageFileBaseline.make({
    ...coveragePercentages(metric),
    uncovered: coverageUncovered(uncovered),
  });
const vitestCoverageMetrics = (total: number, covered: number, pct: number | "Unknown") => ({
  lines: { total, covered, skipped: 0, pct },
  statements: { total, covered, skipped: 0, pct },
  branches: { total, covered, skipped: 0, pct },
  functions: { total, covered, skipped: 0, pct },
});
const coverageRegressionBaseline = CoverageRegressionBaseline.make({
  schema_version: 2,
  generated_at: "2026-07-06T00:00:00.000Z",
  git_sha: "test-sha",
  command: "bun run coverage:baseline:write",
  epsilon: 0.001,
  minimum: coveragePercentages(0),
  exemptions: {},
  follow_ups: {},
  packages: {
    "@beep/existing": coveragePackageBaseline("packages/existing"),
  },
});

const withTempRepo = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const originalCwd = process.cwd;
      const repositoryPath = yield* fs.makeTempDirectory();

      yield* Effect.sync(() => {
        process.cwd = () => repositoryPath;
      });
      yield* fs.makeDirectory(path.join(repositoryPath, ".git"), { recursive: true });
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            process.cwd = originalCwd;
          });
          yield* fs.remove(repositoryPath, { force: true, recursive: true }).pipe(Effect.orDie);
        })
      );

      return yield* use;
    })
  ).pipe(provideScopedLayer(PlatformLayer));

const getInvocation = (argv: ReadonlyArray<string>): QualityTaskInvocation => {
  const invocation = parseQualityTaskInvocation(argv);
  if (O.isNone(invocation)) {
    throw new Error(`Expected ${A.join(argv, " ")} to parse as a quality task.`);
  }
  return invocation.value;
};

const withEnvVar = <A>(name: string, value: string | undefined, use: () => A): A => {
  const previousValue = Bun.env[name];
  if (value === undefined) {
    delete Bun.env[name];
  } else {
    Bun.env[name] = value;
  }

  try {
    return use();
  } finally {
    if (previousValue === undefined) {
      delete Bun.env[name];
    } else {
      Bun.env[name] = previousValue;
    }
  }
};

const withEnvVarEffect = <Out, E, R>(
  name: string,
  value: string | undefined,
  use: Effect.Effect<Out, E, R>
): Effect.Effect<Out, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousValue = Bun.env[name];
      if (value === undefined) {
        delete Bun.env[name];
      } else {
        Bun.env[name] = value;
      }
      return previousValue;
    }),
    () => use,
    (previousValue) =>
      Effect.sync(() => {
        if (previousValue === undefined) {
          delete Bun.env[name];
        } else {
          Bun.env[name] = previousValue;
        }
      })
  );

const isTurboConcurrencyArg = (arg: string): boolean =>
  arg === "--concurrency" || Str.startsWith("--concurrency=")(arg);

// lab-apps-lifecycle P2 (ratified row 9): the exact filter literal every
// excluded root turbo task must carry, inserted before any `--` passthrough
// tail so it stays a turbo option instead of leaking into the child task argv.
const LABS_EXCLUDE_FILTER = "--filter=!./apps/labs/**";
const LABS_EXCLUDED_TASKS: ReadonlyArray<string> = [
  "check",
  "lint",
  "lint:fix",
  "test",
  "test:integration",
  "test:integration:parallel",
  "test:integration:serial",
  "coverage",
];
const withExpectedLabsExclude = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> => {
  if (!A.contains(LABS_EXCLUDED_TASKS, task) || A.contains(args, LABS_EXCLUDE_FILTER)) {
    return args;
  }
  return pipe(
    A.findFirstIndex(args, (arg) => arg === "--"),
    O.match({
      onNone: (): ReadonlyArray<string> => [...args, LABS_EXCLUDE_FILTER],
      onSome: (index) => {
        const [head, tail] = A.splitAt(args, index);
        return [...head, LABS_EXCLUDE_FILTER, ...tail];
      },
    })
  );
};

// The cache posture itself is proven in `turbo-cache.test.ts`; these step
// assertions prove that whatever the resolver decides is what reaches turbo.
// Deriving it keeps them green on a checkout configured for remote reads
// instead of pinning the local-only fallback into every expectation.
const expectedTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironmentSync(), { args, ci: Bun.env.CI === "true" }));
const expectedTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  task,
  ...expectedTurboCacheArgs(args),
  ...withExpectedLabsExclude(task, args),
];
const expectedRootTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  expectedTurboArgs(
    task,
    A.some(args, isTurboConcurrencyArg)
      ? args
      : Bun.env.CI === "true"
        ? ["--concurrency=4", ...args]
        : ["--concurrency=3", ...args]
  );
const bunScriptStep = (label: string, source: string) =>
  QualityTaskStep.make({
    label,
    command: "bun",
    args: ["-e", source],
    cwd: process.cwd(),
  });

const githubCheckTestLane = (id: string, wave: GithubCheckLaneWave, source: string): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    blockedBy: [],
    id,
    stage: "repo-quality",
    step: bunScriptStep(id, source),
    wave,
  });

const initializeLaneProofRepository = Effect.fn("QualityTasksTest.initializeLaneProofRepository")(function* (
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(repoRoot, ".gitignore"), "/.beep/\n");
  yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# baseline\n");
  yield* runGit(repoRoot, ["init"]);
  yield* runGit(repoRoot, ["config", "user.email", "lane-proof@example.test"]);
  yield* runGit(repoRoot, ["config", "user.name", "Lane Proof Test"]);
  yield* runGit(repoRoot, ["add", "."]);
  yield* runGit(repoRoot, ["commit", "-m", "baseline"]);
  yield* runGit(repoRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
});

const laneProofTestLane = (
  repoRoot: string,
  id: string,
  wave: GithubCheckLaneWave,
  source: string,
  useLocalEnv = false
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    id,
    stage: "repo-quality",
    wave,
    blockedBy: [],
    step: QualityTaskStep.make({
      label: id,
      command: "bash",
      args: ["-c", source],
      cwd: repoRoot,
      useLocalEnv,
    }),
  });

const commandOutputEncoder = new TextEncoder();

const qualityCommandHandle = (output: string, exitCode: number) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(commandOutputEncoder.encode(output)),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.make(commandOutputEncoder.encode(output)),
    unref: Effect.succeed(Effect.void),
  });

const cheapGatesSpawnerLayer = (spawned: Array<string>, failedCommands: ReadonlyArray<string>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (ChildProcess.isStandardCommand(command)) {
        const commandText = A.join([command.command, ...command.args], " ");
        A.appendInPlace(spawned, commandText);
        const output = A.contains(command.args, "--is-shallow-repository")
          ? "false"
          : A.contains(command.args, "--show-current")
            ? "feature/cheap-gates"
            : "";
        const exitCode = A.contains(failedCommands, commandText) ? 1 : 0;
        return Effect.succeed(qualityCommandHandle(output, exitCode));
      }

      return Effect.die("the cheap-gates test never spawns a piped command");
    })
  );

const cheapGatesTestLayer = (spawned: Array<string>, failedCommands: ReadonlyArray<string>) =>
  Layer.mergeAll(FileSystemLayer, TestConsole.layer, cheapGatesSpawnerLayer(spawned, failedCommands));

type FallowFeatureMatrixRowTuple = readonly [
  featureFamily: "audit" | "dead-code" | "health",
  ciMode: "advisory-artifact" | "blocking-check",
  promotionStatus: "advisory" | "research" | "candidate-blocking" | "blocking",
];

const fallowFeatureMatrix = (features: ReadonlyArray<FallowFeatureMatrixRowTuple>) =>
  GithubChecksFallowFeatureMatrix.make({
    features: A.map(features, ([featureFamily, ciMode, promotionStatus]) => ({
      ciMode,
      featureFamily,
      promotionStatus,
    })),
  });

const expectUnpromotedWiredFallowLanes = (matrix: GithubChecksFallowFeatureMatrix): void => {
  expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
    "unpromoted Fallow GitHub check lane is wired: fallow:audit",
    "unpromoted Fallow GitHub check lane is wired: fallow:dead-code",
  ]);
};

const expectSubstringBefore = (text: string, before: string, after: string): void => {
  const beforeIndex = Str.indexOf(before)(text);
  const afterIndex = Str.indexOf(after)(text);

  expect(O.isSome(beforeIndex)).toBe(true);
  expect(O.isSome(afterIndex)).toBe(true);

  if (O.isSome(beforeIndex) && O.isSome(afterIndex)) {
    expect(beforeIndex.value).toBeLessThan(afterIndex.value);
  }
};

describe("quality task adapter", () => {
  it("parses canonical task invocations and preserves passthrough args", () => {
    expect(getInvocation(["build", "--affected", "--summarize"])).toMatchObject({
      task: "build",
      fix: false,
      args: ["--affected", "--summarize"],
    });
    expect(getInvocation(["lint", "--fix", "--filter=@beep/schema"])).toMatchObject({
      task: "lint",
      fix: true,
      args: ["--filter=@beep/schema"],
    });
    expect(getInvocation(["lint", "--fix", "--dry=json"])).toMatchObject({
      task: "lint",
      fix: true,
      args: ["--dry=json"],
    });
    expect(getInvocation(["audit", "packages", "--filter=@beep/schema"])).toMatchObject({
      task: "audit",
      fix: false,
      args: ["packages", "--filter=@beep/schema"],
    });
    expect(getInvocation(["coverage", "--affected"])).toMatchObject({
      task: "coverage",
      fix: false,
      args: ["--affected"],
    });
  });

  it("builds package-only audit steps by default and keeps turbo filters", () =>
    withEnvVar("CI", undefined, () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--filter=@beep/schema", "--summarize"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        label: "audit:packages",
        command: "bunx",
        args: expectedRootTurboArgs("audit", ["--filter=@beep/schema", "--summarize"]),
        cwd: "/repo",
      });
    }));

  it("keeps package audit cacheable by default for local runs", () =>
    withEnvVar("CI", undefined, () => {
      const steps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "--filter=@beep/schema"]));

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual(expectedRootTurboArgs("audit", ["--filter=@beep/schema"]));
    }));

  it("forces package audit execution in CI unless cache behavior is explicit", () =>
    withEnvVar("CI", "true", () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--filter=@beep/schema", "--dry=json"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual([
        "turbo",
        "run",
        "audit",
        "--concurrency=4",
        "--force",
        "--filter=@beep/schema",
        "--dry=json",
      ]);
    }));

  it("honors explicit audit cache-control args in CI", () =>
    withEnvVar("CI", "true", () => {
      const steps = rootQualityStepsForTesting(
        "/repo",
        getInvocation(["audit", "--cache=local:rw", "--filter=@beep/schema"])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]?.args).toEqual([
        "turbo",
        "run",
        "audit",
        "--concurrency=4",
        "--cache=local:rw",
        "--filter=@beep/schema",
      ]);
    }));

  it("routes explicit and legacy github audit modes to script checks", () => {
    const explicitSteps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "github", "repo-sanity"]));
    const legacySteps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "repo-sanity"]));

    expect(explicitSteps).toHaveLength(1);
    expect(legacySteps).toHaveLength(1);
    expect(explicitSteps[0]).toMatchObject({
      label: "audit:repo-sanity",
      command: "bun",
      args: repoCliEntryArgs("quality", "github-checks", "repo-sanity"),
      cwd: "/repo",
    });
    expect(legacySteps[0]).toMatchObject({
      label: "audit:repo-sanity",
      command: "bun",
      args: repoCliEntryArgs("quality", "github-checks", "repo-sanity"),
      cwd: "/repo",
    });
  });

  it("includes the targeted review-fix github check mode", () => {
    expect(GithubCheckMode.is["review-fix"]("review-fix")).toBe(true);
  });

  it("includes the collected cheap-gates github check mode", () => {
    expect(GithubCheckMode.is["cheap-gates"]("cheap-gates")).toBe(true);
  });

  it("lets review-fix docgen escalate when docgen tooling changed", () => {
    expect(reviewFixDocgenLocalArgsForTesting("origin/main", "HEAD")).toEqual([
      "docgen:local",
      "--",
      "--base",
      "origin/main",
      "--head",
      "HEAD",
      "--parallel=3",
      "--full",
    ]);
  });

  it("builds balanced affected local development quality steps by default", () => {
    const steps = devQualityStepsForTesting("/repo", {
      base: "origin/main",
      head: "HEAD",
      surface: false,
    });

    expect(A.map(steps, (step) => step.label)).toEqual(["dev:lint", "dev:check", "dev:test"]);
    expect(steps[0]).toMatchObject({
      command: "bun",
      args: ["run", "lint", "--", "--affected", "--summarize"],
      cwd: "/repo",
      env: {
        TURBO_SCM_BASE: "origin/main",
        TURBO_SCM_HEAD: "HEAD",
      },
    });
    expect(steps[1]?.args).toEqual(["run", "check", "--", "--affected", "--summarize"]);
    expect(steps[2]?.args).toEqual(["run", "test", "--", "--unit", "--affected", "--summarize"]);
    expect(
      A.some(
        A.map(steps, (step) => step.label),
        (label) =>
          A.some(
            [
              "build",
              "integration",
              "docgen",
              "repo-sanity",
              "audit",
              "nix",
              "sast",
              "coverage",
              "storybook",
              "fallow",
            ],
            (fragment) => Str.includes(fragment)(label)
          )
      )
    ).toBe(false);
  });

  it("adds surface-only docgen check when requested", () => {
    const steps = devQualityStepsForTesting("/repo", {
      base: "main",
      head: "feature",
      surface: true,
    });

    expect(A.map(steps, (step) => step.label)).toEqual(["dev:lint", "dev:check", "dev:test", "dev:docgen-local"]);
    expect(steps[3]).toMatchObject({
      command: "bun",
      args: ["run", "docgen:local", "--", "--base", "main", "--head", "feature", "--parallel=3"],
      cwd: "/repo",
    });
  });

  it("maps repo-quality github checks as independent collector lanes", () => {
    const lanes = githubCheckQualityLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "quality:build",
      "quality:lint",
      "quality:lint-policy",
      "quality:check",
      "quality:check:tsgo-tests",
      "quality:check:tsgo-smoke",
      "quality:knip",
      "quality:jsdoc-ratchet",
      "quality:docgen",
      "quality:coverage",
      "quality:codegen",
      "quality:commitlint",
      "quality:desktop-ipc",
      "quality:test-unit",
      "quality:test-integration",
    ]);
    expect(A.every(lanes, (lane) => lane.stage === "repo-quality")).toBe(true);
    expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
    expect(qualityLaneArgs(lanes, "quality:build")).toEqual(["run", "beep", "ci", "lane", "build"]);
    expect(qualityLaneArgs(lanes, "quality:knip")).toEqual(["run", "beep", "quality", "knip"]);
    expect(qualityLaneArgs(lanes, "quality:jsdoc-ratchet")).toEqual(["run", "beep", "ci", "lane", "jsdoc-ratchet"]);
    // Affected-scoped `beep ci lane check` drops the repo-wide tsgo extras root
    // `bun run check` carried, so they keep running as their own local lanes.
    expect(qualityLaneArgs(lanes, "quality:check:tsgo-tests")).toEqual(["run", "beep", "quality", "test-tsgo"]);
    expect(qualityLaneArgs(lanes, "quality:check:tsgo-smoke")).toEqual(["run", "beep", "quality", "tsgo-smoke"]);
    expect(A.map(githubCheckLanePlan.githubCheckLaneWaves(lanes), (wave) => wave.wave)).toEqual([
      "preflight",
      "heavy",
      "test",
      "documentation",
    ]);
  });

  it("plans every deterministic cheap gate in one preflight wave", () => {
    const lanes = githubCheckCheapGateLanes("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "cheap-gates:goals-index",
      "cheap-gates:exploration-atlas",
      "cheap-gates:config-sync",
      "cheap-gates:tsgo-rules",
      "cheap-gates:test-tsgo",
      "cheap-gates:effect-imports",
      "cheap-gates:schema-first",
      "cheap-gates:allowlist-check",
      "cheap-gates:goals-doctor",
      "cheap-gates:jsdoc-ratchet",
      "cheap-gates:knip",
      "fallow:audit",
      "fallow:dead-code",
    ]);
    expect(A.every(lanes, (lane) => lane.wave === "preflight")).toBe(true);
    expect(A.map(githubCheckLanePlan.githubCheckLaneWaves(lanes), (wave) => wave.wave)).toEqual(["preflight"]);
    expect(qualityLaneArgs(lanes, "cheap-gates:config-sync")).toEqual(["run", "config-sync:check"]);
    expect(qualityLaneArgs(lanes, "cheap-gates:effect-imports")).toEqual([
      "run",
      "beep",
      "laws",
      "effect-imports",
      "--check",
    ]);
    expect(qualityLaneArgs(lanes, "cheap-gates:jsdoc-ratchet")).toEqual(["run", "beep", "quality", "jsdoc-ratchet"]);
    expect(A.map(githubCheckLanesForModeForTesting("/repo", "cheap-gates"), (lane) => lane.id)).toEqual(
      A.map(lanes, (lane) => lane.id)
    );
  });

  // ship-velocity B1: a local green must mean what a hosted green means, so the
  // pre-push collector dispatches the hosted lane bodies verbatim instead of
  // running cousin root commands that only approximate them.
  it("dispatches every replayable required lane through the hosted beep ci lane argv", () => {
    const lanes = githubCheckQualityLanesForTesting("/repo");
    const prPlan = CiLocalStepPlan.make({ affected: true, base: "origin/main", onMainBranch: false });
    const hostedArgs = (laneId: CiLaneId): ReadonlyArray<string> =>
      O.getOrThrow(A.head(ciLocalStepsForTesting("/repo", [laneId], prPlan))).args;

    expect(qualityLaneArgs(lanes, "quality:lint")).toEqual(hostedArgs("lint"));
    expect(qualityLaneArgs(lanes, "quality:build")).toEqual(hostedArgs("build"));
    expect(qualityLaneArgs(lanes, "quality:lint-policy")).toEqual(hostedArgs("lint-policy"));
    expect(qualityLaneArgs(lanes, "quality:check")).toEqual(hostedArgs("check"));
    expect(qualityLaneArgs(lanes, "quality:test-unit")).toEqual(hostedArgs("test-unit"));
    expect(qualityLaneArgs(lanes, "quality:test-integration")).toEqual(hostedArgs("test-integration"));
    expect(qualityLaneArgs(lanes, "quality:coverage")).toEqual(hostedArgs("coverage"));
    expect(qualityLaneArgs(lanes, "quality:codegen")).toEqual(hostedArgs("codegen"));
    expect(qualityLaneArgs(lanes, "quality:commitlint")).toEqual(hostedArgs("commitlint"));
    expect(qualityLaneArgs(lanes, "quality:desktop-ipc")).toEqual(hostedArgs("desktop-ipc"));
    expect(qualityLaneArgs(lanes, "quality:docgen")).toEqual(hostedArgs("docgen"));

    expect(qualityLaneArgs(lanes, "quality:check")).toEqual([
      "run",
      "beep",
      "ci",
      "lane",
      "check",
      "--affected",
      "--base",
      "origin/main",
      "--summarize",
    ]);
  });

  it("carries a quarantine package filter into the nested check lane's Turbo invocation", () => {
    const steps = withEnvVar("GITHUB_ACTIONS", undefined, () =>
      withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", undefined, () =>
        ciLaneStepsForTesting(
          "/repo",
          "check",
          CiLaneRunOptions.make({
            affected: true,
            base: "origin/main",
            head: "HEAD",
            summarize: true,
            mode: "affected",
            to: "HEAD",
            last: false,
            changesetStatus: false,
            validateEnvelopes: false,
            filter: "@beep/schema",
          })
        )
      )
    );

    expect(steps[0]?.args).toEqual([
      "run",
      "check",
      "--",
      "--concurrency=3",
      "--affected",
      "--summarize",
      "--filter=@beep/schema",
    ]);
  });

  it("pins direct CI Turbo lanes to a requested local-only cache", () =>
    withEnvVar("CI", undefined, () =>
      withEnvVar("TURBO_CACHE", "local:rw", () => {
        const options = CiLaneRunOptions.make({
          affected: true,
          base: "origin/main",
          head: "HEAD",
          summarize: true,
          mode: "affected",
          to: "HEAD",
          last: false,
          changesetStatus: false,
          validateEnvelopes: false,
        });

        for (const lane of ["lint", "labs", "property"] as const) {
          const args = O.getOrThrow(A.head(ciLaneStepsForTesting("/repo", lane, options))).args;
          expect(args).toContain("--cache=local:rw");
          expect(args).not.toContain("--cache=local:rw,remote:r");
        }
      })
    ));

  it("keeps the ts2589 flake quarantine on the dispatched check lane", () => {
    const lanes = githubCheckQualityLanesForTesting("/repo");
    const quarantined = pipe(
      lanes,
      A.filter((lane) => O.isSome(O.fromNullishOr(lane.step.flakeQuarantine))),
      A.map((lane) => lane.id)
    );

    expect(quarantined).toEqual(["quality:build", "quality:check"]);
  });

  it("maps repo-sanity github checks as collector lanes", () => {
    const lanes = githubCheckRepoSanityLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "repo-sanity:changeset-graph",
      "repo-sanity:tsconfig-sync",
      "repo-sanity:fallow-boundaries-config",
      "repo-sanity:versions",
      "repo-sanity:syncpack",
      "repo-sanity:sherif",
      "repo-sanity:bun-audit",
    ]);
    expect(A.every(lanes, (lane) => lane.stage === "repo-sanity")).toBe(true);
    expect(lanes[0]?.step.args).toEqual(["run", "beep", "quality", "changeset-graph"]);
    expect(lanes[2]?.step.args).toEqual(["run", "beep", "quality", "fallow", "boundaries", "config-check", "--check"]);
    expect(lanes[6]?.step.args).toEqual(["run", "beep", "quality", "bun-audit"]);
  });

  it("maps pre-push external gates after repo diagnostics", () => {
    const lanes = githubCheckPrePushExternalLanesForTesting("/repo");

    expect(A.map(lanes, (lane) => lane.id)).toEqual([
      "pre-push:secrets",
      "pre-push:security",
      "pre-push:sast",
      "pre-push:nix",
    ]);
    expect(A.map(lanes, (lane) => lane.stage)).toEqual([
      "diff-security",
      "diff-security",
      "diff-security",
      "environment",
    ]);
    expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
  });

  it("decodes the failure policy and wave report schemas", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* S.decodeEffect(GithubCheckFailurePolicy)("fail-fast")).toBe("fail-fast");
        const report = yield* S.decodeEffect(GithubCheckRunReport)({
          failurePolicy: "collect-all",
          lanes: [
            {
              id: "quality:test",
              stage: "repo-quality",
              status: "passed",
              wave: "test",
            },
          ],
          schemaVersion: "github-check-run/v1",
        });
        expect(report.lanes[0]?.wave).toBe("test");
      })
    ));

  it("decodes legacy lane rows and encodes unknown input digests as null", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const legacy = yield* S.decodeEffect(QualityTaskLaneRun)({
          id: "check",
          label: "ci:check",
          status: "passed",
        });
        expect(legacy.startedAt).toStrictEqual(O.none());
        expect(legacy.endedAt).toStrictEqual(O.none());
        expect(legacy.durationMs).toStrictEqual(O.none());
        expect(legacy.exitCode).toStrictEqual(O.none());
        expect(legacy.inputDigest).toStrictEqual(O.none());

        const encoded = yield* S.encodeEffect(QualityTaskLaneRunReport)(
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            lanes: [legacy],
          })
        );
        expect(encoded.lanes[0]?.inputDigest).toBeNull();
      })
    ));

  it("records timings, exits, and only executor-provided lane digests", () =>
    Effect.runPromise(
      collectQualityTaskLaneRunsForTesting(
        "ci:local",
        [
          ["check", bunScriptStep("ci:check", "process.exit(0)"), O.some("turbo-task-hash")],
          ["nix", bunScriptStep("ci:nix", "process.exit(7)"), O.none()],
        ],
        2
      ).pipe(
        Effect.map(({ failures, report }) => {
          expect(failures).toHaveLength(1);
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["passed", "failed"]);
          expect(A.map(report.lanes, (lane) => lane.exitCode)).toEqual([O.some(0), O.some(7)]);
          expect(report.lanes[0]?.inputDigest).toStrictEqual(O.some("turbo-task-hash"));
          expect(report.lanes[1]?.inputDigest).toStrictEqual(O.none());
          expect(A.every(report.lanes, (lane) => O.exists(lane.startedAt, Str.isNonEmpty))).toBe(true);
          expect(A.every(report.lanes, (lane) => O.exists(lane.endedAt, Str.isNonEmpty))).toBe(true);
          expect(A.every(report.lanes, (lane) => O.exists(lane.durationMs, (duration) => duration >= 0))).toBe(true);
        }),
        provideScopedLayer(PlatformLayer)
      )
    ));

  it("tolerates an outcome whose mutable lane source disappears while the step runs", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const lanes = [["check", bunScriptStep("ci:check", "await Bun.sleep(100)"), O.none()]] as Array<
          Parameters<typeof collectQualityTaskLaneRunsForTesting>[1][number]
        >;
        const running = yield* Effect.forkChild(collectQualityTaskLaneRunsForTesting("ci:mutable", lanes));
        yield* Effect.sleep("20 millis");
        lanes.length = 0;

        const result = yield* Fiber.join(running);

        expect(result.report.lanes).toHaveLength(0);
        expect(result.failures).toHaveLength(0);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("emits machine-readable lane reports from both wrapper writers", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* runQualityTaskGithubCheckLaneWaves("pre-push", [], "fail-fast");
        yield* runQualityTaskStreamingLaneGroup("ci:local", []);
        const reportLines = pipe(
          yield* TestConsole.logLines,
          A.filter(isString),
          A.filter(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX))
        );
        expect(reportLines).toHaveLength(2);
        yield* Effect.forEach(
          reportLines,
          (line) =>
            S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
              Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(line)
            ),
          { discard: true }
        );
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("appends schema-versioned lane rows and ignores malformed side-channel rows", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectory();
        const artifactPath = path.join(tempDir, "inner-lanes.ndjson");
        yield* fs.writeFileString(artifactPath, "not-json\n");
        yield* withEnvVarEffect(
          QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
          artifactPath,
          withEnvVarEffect(
            QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
            "full:02-ci-parity",
            runQualityTaskStreamingLaneGroup("ci:local", [
              ["check", bunScriptStep("ci:check", "process.exit(0)"), O.none()],
            ])
          )
        );
        const lines = pipe(yield* fs.readFileString(artifactPath), Str.split("\n"), A.filter(Str.isNonEmpty));
        expect(lines).toHaveLength(2);
        const report = yield* S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(lines[1]);
        expect(report.schemaVersion).toBe("quality-task-lane-run/v1");
        expect(report.parentLaneId).toStrictEqual(O.some("full:02-ci-parity"));
        expect(A.map(report.lanes, (lane) => lane.id)).toEqual(["check"]);
        const emitted = pipe(
          yield* TestConsole.logLines,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow
        );
        const emittedReport = yield* S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(emitted)
        );
        expect(A.map(emittedReport.lanes, (lane) => lane.id)).toEqual(["check"]);
        yield* fs.remove(tempDir, { recursive: true, force: true });
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("rebuilds an unscoped lane report from an unscoped artifact", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectory();
        const artifactPath = path.join(tempDir, "unscoped-inner-lanes.ndjson");
        const durableReport = yield* S.encodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            parentLaneId: O.none(),
            lanes: [
              QualityTaskLaneRun.make({
                id: "check",
                label: "ci:check",
                status: "passed",
                inputDigest: O.none(),
              }),
            ],
          })
        );
        yield* fs.writeFileString(artifactPath, `${durableReport}\n`);

        yield* withEnvVarEffect(
          QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
          artifactPath,
          withEnvVarEffect(
            QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
            undefined,
            runQualityTaskStreamingLaneGroup("ci:local", [])
          )
        );

        const emitted = pipe(
          yield* TestConsole.logLines,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow
        );
        const emittedReport = yield* S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(emitted)
        );
        expect(emittedReport.parentLaneId).toStrictEqual(O.none());
        expect(A.map(emittedReport.lanes, (lane) => lane.id)).toEqual(["check"]);
        yield* fs.remove(tempDir, { recursive: true, force: true });
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("falls back when a lane artifact is missing or belongs to another parent", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectory();
        const missingPath = path.join(tempDir, "missing.ndjson");
        const foreignPath = path.join(tempDir, "foreign.ndjson");
        const foreignReport = yield* S.encodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            parentLaneId: O.some("full:foreign-parent"),
            lanes: [],
          })
        );
        yield* fs.writeFileString(foreignPath, `${foreignReport}\n`);

        yield* Effect.forEach(
          [missingPath, foreignPath],
          (artifactPath) =>
            withEnvVarEffect(
              QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
              artifactPath,
              withEnvVarEffect(
                QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
                "full:current-parent",
                runQualityTaskGithubCheckLaneWaves("pre-push", [], "fail-fast")
              )
            ),
          { discard: true }
        );

        const reportLines = pipe(
          yield* TestConsole.logLines,
          A.filter(isString),
          A.filter(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX))
        );
        expect(reportLines).toHaveLength(2);
        const reports = yield* Effect.forEach(reportLines, (line) =>
          S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(
            Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(line)
          )
        );
        expect(A.every(reports, (report) => A.isReadonlyArrayEmpty(report.lanes))).toBe(true);
        expect(A.every(reports, (report) => O.contains(report.parentLaneId, "full:current-parent"))).toBe(true);
        yield* fs.remove(tempDir, { recursive: true, force: true });
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("retains each completed inner lane when its wrapper is interrupted", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectory();
        const artifactPath = path.join(tempDir, "inner-lanes.ndjson");
        const waves = [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane("first", "preflight", "process.exit(0)"),
              githubCheckTestLane("second", "preflight", "process.exit(0)"),
              githubCheckTestLane("interrupted", "preflight", "await Bun.sleep(60_000)"),
            ],
          }),
        ];

        yield* withEnvVarEffect(
          QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
          artifactPath,
          withEnvVarEffect(
            QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
            "full:02-ci-parity",
            Effect.gen(function* () {
              const wrapper = yield* Effect.forkChild(
                runQualityTaskGithubCheckLaneWaves("pre-push", waves, "fail-fast")
              );
              let lines = A.empty<string>();
              for (let attempt = 0; attempt < 200 && A.length(lines) < 2; attempt++) {
                yield* Effect.sleep("10 millis");
                lines = pipe(
                  yield* fs.readFileString(artifactPath).pipe(Effect.orElseSucceed(() => Str.empty)),
                  Str.split("\n"),
                  A.filter(Str.isNonEmpty)
                );
              }
              yield* Fiber.interrupt(wrapper);
              expect(lines).toHaveLength(2);
              const reports = yield* Effect.forEach(lines, (line) =>
                S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(line)
              );
              expect(A.flatMap(reports, (report) => A.map(report.lanes, (lane) => lane.id))).toEqual([
                "first",
                "second",
              ]);
            })
          )
        );
        yield* fs.remove(tempDir, { recursive: true, force: true });
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("retains completed streaming lanes before the group returns", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectory();
        const artifactPath = path.join(tempDir, "streaming-inner-lanes.ndjson");
        yield* withEnvVarEffect(
          QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
          artifactPath,
          withEnvVarEffect(
            QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
            "full:02-ci-parity",
            Effect.gen(function* () {
              const wrapper = yield* Effect.forkChild(
                runQualityTaskStreamingLaneGroup(
                  "ci:local",
                  [
                    ["first", bunScriptStep("ci:first", "process.exit(0)"), O.none()],
                    ["second", bunScriptStep("ci:second", "process.exit(0)"), O.none()],
                    ["interrupted", bunScriptStep("ci:interrupted", "await Bun.sleep(60_000)"), O.none()],
                  ],
                  1
                )
              );
              let lines = A.empty<string>();
              for (let attempt = 0; attempt < 200 && A.length(lines) < 2; attempt++) {
                yield* Effect.sleep("10 millis");
                lines = pipe(
                  yield* fs.readFileString(artifactPath).pipe(Effect.orElseSucceed(() => Str.empty)),
                  Str.split("\n"),
                  A.filter(Str.isNonEmpty)
                );
              }
              yield* Fiber.interrupt(wrapper);
              expect(lines).toHaveLength(2);
              const reports = yield* Effect.forEach(lines, (line) =>
                S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport))(line)
              );
              expect(A.flatMap(reports, (report) => A.map(report.lanes, (lane) => lane.id))).toEqual([
                "first",
                "second",
              ]);
            })
          )
        );
        yield* fs.remove(tempDir, { recursive: true, force: true });
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("property: the wave report schema round-trips arbitrary reports", () => {
    const ReportArbitrary = S.toArbitrary(GithubCheckRunReport)(fc);
    fc.assert(
      fc.property(ReportArbitrary, (report) => {
        const decoded = S.decodeSync(GithubCheckRunReport)(S.encodeSync(GithubCheckRunReport)(report));
        expect(decoded.schemaVersion).toBe("github-check-run/v1");
        expect(decoded.failurePolicy).toBe(report.failurePolicy);
        expect(A.map(decoded.lanes, (lane) => lane.id)).toEqual(A.map(report.lanes, (lane) => lane.id));
      }),
      fcRuns(32)
    );
  });

  it("finishes a failed wave, reports sibling failures, and marks later waves not run", () =>
    Effect.runPromise(
      collectGithubCheckLaneWavesForTesting(
        "pre-push",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane("preflight:a", "preflight", "process.exit(2)"),
              githubCheckTestLane("preflight:b", "preflight", "process.exit(3)"),
            ],
          }),
          GithubCheckLaneWaveSpec.make({
            wave: "heavy",
            lanes: [githubCheckTestLane("heavy:check", "heavy", "process.exit(0)")],
          }),
        ],
        "fail-fast"
      ).pipe(
        Effect.map(({ failures, laneReport, report }) => {
          expect(A.map(failures, (failure) => failure.label)).toEqual(["preflight:a", "preflight:b"]);
          expect(A.map(report.lanes, (lane) => [lane.id, lane.status])).toEqual([
            ["preflight:a", "failed"],
            ["preflight:b", "failed"],
            ["heavy:check", "not-run-early-stop"],
          ]);
          expect(A.map(laneReport.lanes, (lane) => [lane.id, lane.status])).toEqual([
            ["preflight:a", "failed"],
            ["preflight:b", "failed"],
            ["heavy:check", "not-run-early-stop"],
          ]);
          expect(A.every(A.take(laneReport.lanes, 2), (lane) => O.isSome(lane.startedAt))).toBe(true);
          expect(laneReport.lanes[2]?.inputDigest).toStrictEqual(O.none());
        }),
        provideScopedLayer(PlatformLayer)
      )
    ));

  it("runs later waves under collect-all", () =>
    Effect.runPromise(
      collectGithubCheckLaneWavesForTesting(
        "pre-push",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [githubCheckTestLane("preflight:failed", "preflight", "process.exit(1)")],
          }),
          GithubCheckLaneWaveSpec.make({
            wave: "heavy",
            lanes: [githubCheckTestLane("heavy:passed", "heavy", "process.exit(0)")],
          }),
        ],
        "collect-all"
      ).pipe(
        Effect.map(({ report }) => {
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["failed", "passed"]);
        }),
        provideScopedLayer(PlatformLayer)
      )
    ));

  it.effect(
    "reuses only exact lane proofs and invalidates them when the virtual tree changes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-reuse-" });
      const markerPath = path.join(tempRoot, ".beep", "lane-marker.txt");
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(tempRoot, "proof:test", "preflight", "echo run >> .beep/lane-marker.txt");
      const waves = [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })];
      const run = collectGithubCheckLaneWavesForTesting("proof", waves, "fail-fast");
      const runWithLaneProof = withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        "active",
        withEnvVarEffect("BEEP_YEET_PROOF_BASE", undefined, run)
      );

      const first = yield* runWithLaneProof;
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
      const second = yield* runWithLaneProof;
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["reused"]);
      const shadow = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "shadow", run);
      expect(A.map(shadow.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(markerPath)).toBe("run\nrun\n");

      yield* fs.writeFileString(path.join(tempRoot, "README.md"), "# changed\n");
      const invalidated = yield* runWithLaneProof;
      expect(A.map(invalidated.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(markerPath)).toBe("run\nrun\nrun\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "isolates lane-proof defaults and persistence guards from the parent process environment",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-defaults-" });
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(tempRoot, "proof:defaults", "preflight", "process.exit(0)", true);
      const disabled = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", undefined, prepareLaneProofSession([lane]));
      const invalid = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "invalid", prepareLaneProofSession([lane]));
      const withDefaultBase = yield* withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        "active",
        withEnvVarEffect("BEEP_YEET_PROOF_BASE", undefined, prepareLaneProofSession([lane]))
      );

      expect(O.isNone(disabled)).toBe(true);
      expect(O.isNone(invalid)).toBe(true);
      expect(O.isSome(withDefaultBase)).toBe(true);

      const emptySession = LaneProofSession.make({
        mode: "active",
        path: path.join(tempRoot, ".beep", "yeet", "lane-proofs.json"),
        records: [],
        identities: [],
      });
      yield* persistLaneProofs(emptySession, []);
      yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", undefined, persistLaneProofs(emptySession, [[lane, 1]]));
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "invalidates a lane proof when the property-test run floor increases",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-fc-runs-" });
      const markerPath = path.join(tempRoot, ".beep", "property-marker.txt");
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(tempRoot, "quality:test-unit", "heavy", "echo run >> .beep/property-marker.txt");
      const waves = [GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: [lane] })];
      const run = collectGithubCheckLaneWavesForTesting("proof-fc-runs", waves, "fail-fast");
      const atRuns = (runs: string) =>
        withEnvVarEffect(
          "BEEP_YEET_LANE_PROOF_MODE",
          "active",
          withEnvVarEffect("BEEP_YEET_PROOF_BASE", undefined, withEnvVarEffect("BEEP_FC_NUM_RUNS", runs, run))
        );

      expect(A.map((yield* atRuns("100")).report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(A.map((yield* atRuns("100")).report.lanes, (result) => result.status)).toEqual(["reused"]);
      expect(A.map((yield* atRuns("400")).report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(markerPath)).toBe("run\nrun\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "runs the lane when the configured proof base cannot be resolved",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-missing-base-" });
      const markerPath = path.join(tempRoot, ".beep", "missing-base-marker.txt");
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(
        tempRoot,
        "proof:missing-base",
        "preflight",
        "mkdir -p .beep; echo run >> .beep/missing-base-marker.txt"
      );
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-missing-base",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
        "fail-fast"
      );
      const withMissingBase = withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        "active",
        withEnvVarEffect("BEEP_YEET_PROOF_BASE", "refs/heads/does-not-exist", run)
      );

      expect(A.map((yield* withMissingBase).report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(A.map((yield* withMissingBase).report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(markerPath)).toBe("run\nrun\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "merges successful lane proofs across waves",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-waves-" });
      yield* initializeLaneProofRepository(tempRoot);

      const waves = [
        GithubCheckLaneWaveSpec.make({
          wave: "preflight",
          lanes: [laneProofTestLane(tempRoot, "proof:preflight", "preflight", "echo preflight >> .beep/lanes.txt")],
        }),
        GithubCheckLaneWaveSpec.make({
          wave: "heavy",
          lanes: [laneProofTestLane(tempRoot, "proof:heavy", "heavy", "echo heavy >> .beep/lanes.txt")],
        }),
      ];
      const run = collectGithubCheckLaneWavesForTesting("proof-waves", waves, "fail-fast");

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed", "passed"]);
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["reused", "reused"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "lanes.txt"))).toBe("preflight\nheavy\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "invalidates history-sensitive proofs after a same-tree history rewrite",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-history-rewrite-" });
      yield* initializeLaneProofRepository(tempRoot);

      const secretsLane = laneProofTestLane(
        tempRoot,
        "pre-push:secrets",
        "preflight",
        "echo secrets >> .beep/secrets-history.txt"
      );
      const commitlintLane = laneProofTestLane(
        tempRoot,
        "quality:commitlint",
        "preflight",
        "echo commitlint >> .beep/commitlint-history.txt"
      );
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-history-rewrite",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [secretsLane, commitlintLane] })],
        "fail-fast"
      );

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed", "passed"]);
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["reused", "reused"]);

      const originalTree = yield* runGit(tempRoot, ["rev-parse", "HEAD^{tree}"]);
      yield* runGit(tempRoot, ["commit", "--amend", "-m", "same tree, rewritten history"]);
      expect(yield* runGit(tempRoot, ["rev-parse", "HEAD^{tree}"])).toBe(originalTree);

      const rewritten = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(rewritten.report.lanes, (result) => result.status)).toEqual(["passed", "passed"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "secrets-history.txt"))).toBe("secrets\nsecrets\n");
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "commitlint-history.txt"))).toBe(
        "commitlint\ncommitlint\n"
      );
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "rechecks a later-wave proof after an earlier wave changes the tree",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-cross-wave-mutation-" });
      yield* initializeLaneProofRepository(tempRoot);

      const heavyLane = laneProofTestLane(
        tempRoot,
        "proof:heavy-after-mutation",
        "heavy",
        "echo heavy >> .beep/heavy-after-mutation.txt"
      );
      const seedHeavy = collectGithubCheckLaneWavesForTesting(
        "proof-cross-wave-seed",
        [GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: [heavyLane] })],
        "fail-fast"
      );
      const seeded = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", seedHeavy);
      expect(A.map(seeded.report.lanes, (result) => result.status)).toEqual(["passed"]);

      const mutateLane = laneProofTestLane(
        tempRoot,
        "proof:mutate-before-heavy",
        "preflight",
        "printf '# changed before heavy\\n' > README.md"
      );
      const runMutatingWaves = collectGithubCheckLaneWavesForTesting(
        "proof-cross-wave-mutation",
        [
          GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [mutateLane] }),
          GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: [heavyLane] }),
        ],
        "fail-fast"
      );
      const afterMutation = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", runMutatingWaves);

      expect(A.map(afterMutation.report.lanes, (result) => result.status)).toEqual(["passed", "passed"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "heavy-after-mutation.txt"))).toBe("heavy\nheavy\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "never reuses volatile OSV security proofs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-security-" });
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(tempRoot, "pre-push:security", "preflight", "echo security >> .beep/security.txt");
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-security",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
        "fail-fast"
      );

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "security.txt"))).toBe("security\nsecurity\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "refuses to persist a proof when the lane changes the virtual tree",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-mutation-" });
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(
        tempRoot,
        "proof:mutation",
        "preflight",
        "echo run >> .beep/mutation.txt; printf '# mutated\\n' > README.md"
      );
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-mutation",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
        "fail-fast"
      );

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
      yield* fs.writeFileString(path.join(tempRoot, "README.md"), "# baseline\n");
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "mutation.txt"))).toBe("run\nrun\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "uses a temporary proof index from a linked worktree git path",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-worktree-" });
      const primaryRoot = path.join(parent, "primary");
      const worktreeRoot = path.join(parent, "linked");
      yield* fs.makeDirectory(primaryRoot);
      yield* initializeLaneProofRepository(primaryRoot);
      yield* runGit(primaryRoot, ["worktree", "add", "-b", "lane-proof-linked", worktreeRoot, "HEAD"]);

      const lane = laneProofTestLane(worktreeRoot, "proof:worktree", "preflight", "echo run >> .beep/worktree.txt");
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-worktree",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
        "fail-fast"
      );

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["reused"]);
      expect(yield* fs.readFileString(path.join(worktreeRoot, ".beep", "worktree.txt"))).toBe("run\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it.effect(
    "does not persist a proof for an injected lane failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-failure-" });
      yield* initializeLaneProofRepository(tempRoot);

      const lane = laneProofTestLane(
        tempRoot,
        "proof:failure",
        "preflight",
        "if [[ -f .beep/pass-now ]]; then echo run >> .beep/failure.txt; else touch .beep/pass-now; exit 7; fi"
      );
      const run = collectGithubCheckLaneWavesForTesting(
        "proof-failure",
        [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
        "fail-fast"
      );

      const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      const third = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
      expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["failed"]);
      expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["passed"]);
      expect(A.map(third.report.lanes, (result) => result.status)).toEqual(["reused"]);
      expect(yield* fs.readFileString(path.join(tempRoot, ".beep", "failure.txt"))).toBe("run\n");
    }, provideScopedLayer(PlatformLayer))
  );

  it("collects multiple cheap-gate findings in one schema-valid run", () =>
    Effect.runPromise(
      collectGithubCheckLaneWavesForTesting(
        "cheap-gates",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane("cheap-gates:config-sync", "preflight", "process.exit(2)"),
              githubCheckTestLane("cheap-gates:effect-imports", "preflight", "process.exit(3)"),
            ],
          }),
        ],
        "collect-all"
      ).pipe(
        Effect.map(({ failures, report }) => {
          expect(report.schemaVersion).toBe("github-check-run/v1");
          expect(report.failurePolicy).toBe("collect-all");
          expect(A.map(failures, (failure) => failure.label)).toEqual([
            "cheap-gates:config-sync",
            "cheap-gates:effect-imports",
          ]);
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["failed", "failed"]);
        }),
        provideScopedLayer(PlatformLayer)
      )
    ));

  it("runs every cheap gate through the collected runner when all lanes pass", () => {
    const spawned: Array<string> = [];
    const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
    const changesetStatusLane = githubCheckChangesetStatusLane(process.cwd());
    const changesetStatusCommand = A.join([changesetStatusLane.step.command, ...changesetStatusLane.step.args], " ");

    return Effect.runPromise(
      withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        undefined,
        runGithubChecks("cheap-gates").pipe(
          Effect.tap(
            Effect.fnUntraced(function* () {
              const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
              expect(logText).toContain(GITHUB_CHECK_RUN_REPORT_PREFIX);
              expect(logText).toContain('"failurePolicy":"collect-all"');
              expect(logText).toContain('"status":"passed"');
              expect(spawned).toContain(changesetStatusCommand);
              expect(
                A.every(cheapGateLanes, (lane) =>
                  A.contains(spawned, A.join([lane.step.command, ...lane.step.args], " "))
                )
              ).toBe(true);
            })
          ),
          provideScopedLayer(Layer.mergeAll(cheapGatesTestLayer(spawned, A.empty()), PullRequestConfigLayer))
        )
      )
    );
  });

  it("skips changeset status on a main push while running every cheap gate", () => {
    const spawned: Array<string> = [];
    const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
    const changesetStatusLane = githubCheckChangesetStatusLane(process.cwd());
    const changesetStatusCommand = A.join([changesetStatusLane.step.command, ...changesetStatusLane.step.args], " ");

    return Effect.runPromise(
      withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        "off",
        runGithubChecks("cheap-gates").pipe(
          Effect.tap(
            Effect.fnUntraced(function* () {
              const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
              expect(logText).toContain("[github-checks] quality: skipped changeset status on main push");
              expect(spawned).not.toContain(changesetStatusCommand);
              expect(
                A.every(cheapGateLanes, (lane) =>
                  A.contains(spawned, A.join([lane.step.command, ...lane.step.args], " "))
                )
              ).toBe(true);
            })
          ),
          provideScopedLayer(Layer.mergeAll(cheapGatesTestLayer(spawned, A.empty()), MainPushConfigLayer))
        )
      )
    );
  });

  it("collects multiple failures through the cheap-gates runner without stopping later lanes", () => {
    const spawned: Array<string> = [];
    const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
    const failedCommands = [
      A.join(["bun", ...qualityLaneArgs(cheapGateLanes, "cheap-gates:config-sync")], " "),
      A.join(["bun", ...qualityLaneArgs(cheapGateLanes, "cheap-gates:effect-imports")], " "),
    ];
    const lastLane = O.getOrThrow(A.last(cheapGateLanes));
    const lastCommand = A.join([lastLane.step.command, ...lastLane.step.args], " ");

    return Effect.runPromise(
      withEnvVarEffect(
        "BEEP_YEET_LANE_PROOF_MODE",
        "off",
        Effect.gen(function* () {
          const exit = yield* Effect.exit(runGithubChecks("cheap-gates"));

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(A.map(failure.failures, (step) => step.label)).toEqual([
                "cheap-gates:config-sync",
                "cheap-gates:effect-imports",
              ]);
            }
          }

          expect(spawned).toContain(lastCommand);
          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain(GITHUB_CHECK_RUN_REPORT_PREFIX);
          expect(logText).toContain('"failurePolicy":"collect-all"');
          expect(logText).toContain('"id":"cheap-gates:config-sync","stage":"repo-sanity","status":"failed"');
          expect(logText).toContain('"id":"cheap-gates:effect-imports","stage":"repo-quality","status":"failed"');
          expect(logText).toContain('"status":"passed"');
        })
      ).pipe(provideScopedLayer(Layer.mergeAll(cheapGatesTestLayer(spawned, failedCommands), PullRequestConfigLayer)))
    );
  });

  it("accepts the current packet state with audit and dead-code as promoted pre-push lanes", () => {
    const matrix = fallowFeatureMatrix([
      ["audit", "blocking-check", "blocking"],
      ["dead-code", "blocking-check", "blocking"],
    ]);

    expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual(["fallow:audit", "fallow:dead-code"]);
    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([]);
  });

  it("falls back to diff-scoped audit when Fallow cannot create the base worktree", () => {
    expect(
      fallowAuditNeedsDiffFallbackForTesting({
        exitCode: 2,
        stdout: JSON.stringify({
          error: true,
          message: "could not create a temporary worktree for base ref 'origin/main'",
          exit_code: 2,
        }),
      })
    ).toBe(true);
    expect(
      fallowAuditNeedsDiffFallbackForTesting({
        exitCode: 2,
        stdout: "",
        stderr: JSON.stringify({
          error: true,
          message: "could not create a temporary worktree for base ref 'origin/main'",
          exit_code: 2,
        }),
      })
    ).toBe(true);
    expect(fallowAuditNeedsDiffFallbackForTesting({ exitCode: 2, stdout: '{"error":true}' })).toBe(false);
    expect(fallowAuditDiffFallbackArgsForTesting({ diffPath: "/tmp/audit.diff", quiet: true })("origin/main")).toEqual([
      "run",
      "fallow",
      "--",
      "audit",
      "--config",
      ".fallowrc.jsonc",
      "--format",
      "json",
      "--quiet",
      "--base",
      "origin/main",
      "--diff-file",
      "/tmp/audit.diff",
      "--gate",
      "all",
    ]);
  });

  it("includes untracked files in the diff-scoped audit input", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.acquireUseRelease(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = yield* fs.makeTempDirectory();

            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "quality-test@example.com"]);
            yield* runGit(repoRoot, ["config", "user.name", "Quality Test"]);
            yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
            yield* fs.writeFileString(path.join(repoRoot, "tracked.ts"), "export const tracked = 1;\n");
            yield* runGit(repoRoot, ["add", "tracked.ts"]);
            yield* runGit(repoRoot, ["commit", "-m", "init"]);
            yield* fs.writeFileString(path.join(repoRoot, "tracked.ts"), "export const tracked = 2;\n");
            yield* fs.writeFileString(path.join(repoRoot, "untracked.ts"), "export const untracked = true;\n");

            return { fs, repoRoot } as const;
          }),
          ({ repoRoot }) =>
            Effect.gen(function* () {
              const result = yield* collectAuditDiffInputForTesting(repoRoot, "HEAD");

              expect(result.exitCode).toBe(0);
              expect(result.stdout).toContain("tracked.ts");
              expect(result.stdout).toContain("untracked.ts");
              expect(result.stdout).toContain("new file mode");
            }),
          ({ fs, repoRoot }) => fs.remove(repoRoot, { recursive: true, force: true }).pipe(Effect.ignore)
        ).pipe(provideScopedLayer(PlatformLayer))
      )
    ));

  it("keeps wired pre-push Fallow lanes in parity with authoritative promoted matrix lanes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const matrixText = yield* fs.readFileString(
          path.join(repoRoot, "goals/fallow-quality-enforcement/research/feature-matrix.jsonc")
        );
        const matrix = yield* decodeGithubChecksFallowFeatureMatrixJsoncForTesting(matrixText);
        const promotedLaneIds = promotedFallowGithubCheckLaneIdsForTesting(matrix);
        const wiredFallowLaneIds = pipe(
          githubCheckLanesForModeForTesting("/repo", "pre-push"),
          A.map((lane) => lane.id),
          A.filter(Str.startsWith("fallow:")),
          A.dedupe,
          A.sort(Order.String)
        );

        expect(wiredFallowLaneIds).toEqual(promotedLaneIds);
        expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([]);
      }).pipe(provideScopedLayer(FileSystemLayer))
    ));

  it("does not wire removed Fallow dupes or reuse clone lanes", () => {
    const laneIds = pipe(
      githubCheckLanesForModeForTesting("/repo", "pre-push"),
      A.map((lane) => lane.id)
    );

    expect(laneIds).toContain("repo-sanity:fallow-boundaries-config");
    expect(laneIds).not.toContain("quality:reuse-clones");
    expect(laneIds).not.toContain("fallow:dupes");
    expect(laneIds).not.toContain("fallow:boundaries");
  });

  it("keeps CI Fallow blocking failures deferred until advisory envelopes are written", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const workflowText = yield* fs.readFileString(path.join(repoRoot, ".github/workflows/check.yml"));

        // The fallow lane body lives in the beep CLI (one-round-loop P0
        // inversion): check.yml dispatches `beep ci lane fallow`, and the
        // deferred-exit ordering (blocking lanes run first, advisory lanes
        // still execute, envelope existence is checked, THEN blocking
        // status fails the lane) is owned by runCiFallowLane and pinned by
        // the ci-lane step-plan tests. Here we pin the workflow contract:
        // the dispatch line, and envelope validation as a separate
        // always()-guarded step after the run step.
        const dispatchIndex = workflowText.indexOf(
          'bun run beep ci lane fallow --base "${{ steps.base.outputs.base_ref }}"'
        );
        const validateStepIndex = workflowText.indexOf("      - name: Validate Fallow envelopes", dispatchIndex);
        const uploadStepIndex = workflowText.indexOf("      - name: Upload Fallow envelopes", validateStepIndex);

        expect(dispatchIndex).toBeGreaterThan(-1);
        expect(workflowText).not.toContain("run_blocking_fallow()");
        expect(validateStepIndex).toBeGreaterThan(dispatchIndex);
        expect(uploadStepIndex).toBeGreaterThan(validateStepIndex);

        // Deferred-exit ordering, from the lane's own step plan: both
        // blocking lanes precede every advisory lane, and envelope
        // validation steps come last when replayed locally.
        const plan = ciLaneStepsForTesting(
          "/repo",
          "fallow",
          CiLaneRunOptions.make({
            affected: false,
            base: "origin/main",
            head: "HEAD",
            summarize: false,
            mode: "affected",
            to: "HEAD",
            last: false,
            changesetStatus: false,
            validateEnvelopes: true,
          })
        );
        const labels = A.map(plan, (step) => step.label);
        expect(A.take(labels, 2)).toEqual(["ci:fallow:audit", "ci:fallow:dead-code"]);
        expect(labels).toContain("ci:fallow:envelope-check:dead-code");
      }).pipe(provideScopedLayer(FileSystemLayer))
    ));

  it("rejects a promoted Fallow matrix row that is not wired into pre-push", () => {
    // dead-code is wired; health is promoted but not wired → missing health diagnostic
    const matrix = fallowFeatureMatrix([
      ["audit", "blocking-check", "blocking"],
      ["dead-code", "blocking-check", "blocking"],
      ["health", "blocking-check", "blocking"],
    ]);

    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
      "missing promoted Fallow GitHub check lane fallow:health",
    ]);
  });

  it("rejects a wired Fallow lane whose matrix row is not promoted", () => {
    expectUnpromotedWiredFallowLanes(
      fallowFeatureMatrix([
        ["audit", "advisory-artifact", "research"],
        ["dead-code", "advisory-artifact", "research"],
      ])
    );
  });

  it("treats candidate-blocking Fallow rows as promotion contract inputs", () => {
    // health=candidate-blocking counts as promoted; dead-code wired but research → both diagnostics fire
    const matrix = fallowFeatureMatrix([
      ["health", "advisory-artifact", "candidate-blocking"],
      ["audit", "advisory-artifact", "research"],
      ["dead-code", "advisory-artifact", "research"],
    ]);
    expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual(["fallow:health"]);
    expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
      "missing promoted Fallow GitHub check lane fallow:health",
      "unpromoted Fallow GitHub check lane is wired: fallow:audit",
      "unpromoted Fallow GitHub check lane is wired: fallow:dead-code",
    ]);
  });

  it("requires Fallow CI upload wiring only when the contract requires uploads", () => {
    const uploadStep = {
      uses: "actions/upload-artifact@v4",
      with: {
        "if-no-files-found": "error",
        path: ".beep/fallow/**",
      },
    };

    expect(fallowCiUploadDiagnosticsForTesting(false, [], [], ".beep/fallow", "error")).toEqual([]);
    expect(fallowCiUploadDiagnosticsForTesting(true, [], [], ".beep/fallow", "error")).toEqual([
      "missing upload of complete Fallow output tree: .beep/fallow/**",
      "missing actions/upload-artifact step",
      "missing if-no-files-found: error",
    ]);
    expect(
      fallowCiUploadDiagnosticsForTesting(true, ["actions/upload-artifact@v4"], [uploadStep], ".beep/fallow", "error")
    ).toEqual([]);
  });

  it("accepts promoted Fallow findings with blocking true in report envelopes", () => {
    expect(
      FallowReportFinding.make({
        attribution: "introduced",
        blocking: true,
        featureFamily: "audit",
        id: "audit-introduced-dead-code-1",
        parser: "fallow/audit/v1",
        sourceRef: "standards/fallow.pilot.inventory.jsonc",
        subCategory: "fallow:audit:dead-code",
      }).blocking
    ).toBe(true);
  });

  it("detects explicit quality hardware profiles", () => {
    expect(
      detectQualityProfileForTesting({
        ci: true,
        cpuCount: 64,
        totalMemoryBytes: 128 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "ci",
      config: { fullProofSlots: 1, reviewFixSlots: 1 },
    });
    expect(
      detectQualityProfileForTesting({
        ci: false,
        cpuCount: 64,
        totalMemoryBytes: 128 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "workstation",
      config: { docgenParallel: 6, reviewFixSlots: 3 },
    });
    expect(
      detectQualityProfileForTesting({
        ci: false,
        cpuCount: 8,
        totalMemoryBytes: 16 * 1024 * 1024 * 1024,
      })
    ).toMatchObject({
      profile: "current",
      config: { docgenParallel: 3, reviewFixSlots: 1 },
    });
    expect(qualityProfileConfigForTesting("workstation")).toMatchObject({
      fullProofSlots: 1,
      turboConcurrency: 8,
    });
  });

  it("includes repo-level tsgo diagnostics for affected root check lanes", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--affected", "--summarize"]));

    expect(steps).toHaveLength(4);
    expect(steps[0]).toMatchObject({
      label: "check",
      command: "bunx",
      cwd: "/repo",
    });
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("check", ["--affected", "--summarize"]));
    expect(A.slice(steps, { start: 1 })).toEqual([
      expect.objectContaining({
        label: "check:tsgo:rules",
        command: "bun",
        args: repoCliEntryArgs("quality", "tsgo-rules"),
      }),
      expect.objectContaining({
        label: "check:tsgo:tests",
        command: "bun",
        args: repoCliEntryArgs("quality", "test-tsgo"),
      }),
      expect.objectContaining({
        label: "check:tsgo:smoke",
        command: "bun",
        args: repoCliEntryArgs("quality", "tsgo-smoke"),
      }),
    ]);
  });

  it("collects Effect tsgo warnings from successful package results", () => {
    const diagnostics = collectEffectTsgoDiagnosticLines([
      {
        output: [
          "src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage",
          "src/example.test.ts:2:1 - warning TS99999: unrelated diagnostic",
        ].join("\n"),
      },
    ]);

    expect(diagnostics).toEqual(["src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage"]);
  });

  it("names packages missing the required test tsgo Turbo script", () => {
    expect(
      missingTestTsgoTaskMessageForTesting([
        { packageName: "@beep/ready", hasTaskScript: true },
        { packageName: "@beep/zulu", hasTaskScript: false },
        { packageName: "@beep/alpha", hasTaskScript: false },
      ])
    ).toEqual(
      O.some(
        '[check:tsgo:tests] missing required "package-test-typecheck" package script for @beep/alpha, ' +
          '@beep/zulu. Add "package-test-typecheck": "beep-cli quality test-tsgo-package" to each named package.json.'
      )
    );
    expect(missingTestTsgoTaskMessageForTesting([{ packageName: "@beep/ready", hasTaskScript: true }])).toEqual(
      O.none()
    );
  });

  it("normalizes Knip findings with stable ordering and without position fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const findings = yield* normalizeKnipReportForTesting(
          encodeJson({
            issues: [
              {
                file: "b.ts",
                exports: [{ name: "Beta", line: 5, col: 14, pos: 100 }],
              },
              {
                file: "a.ts",
                dependencies: [{ name: "left-pad", line: 10, col: 6, pos: 220 }],
                files: [{ name: "a.ts" }],
              },
            ],
          })
        );

        expect(findings).toEqual([
          KnipFinding.make({ kind: "dependencies", file: "a.ts", name: "left-pad" }),
          KnipFinding.make({ kind: "exports", file: "b.ts", name: "Beta" }),
          KnipFinding.make({ kind: "files", file: "a.ts", name: "a.ts" }),
        ]);
      })
    ));

  it("compares Knip findings as fail-on-growth and advisory shrinkage", () => {
    const inherited = KnipFinding.make({ kind: "exports", file: "src/a.ts", name: "legacy" });
    const removed = KnipFinding.make({ kind: "dependencies", file: "package.json", name: "unused-lib" });
    const introduced = KnipFinding.make({ kind: "types", file: "src/b.ts", name: "NewType" });

    expect(compareKnipFindingsForTesting([inherited], [removed, inherited])).toMatchObject({
      current_count: 1,
      baseline_count: 2,
      introduced: [],
      resolved: [removed],
    });
    expect(compareKnipFindingsForTesting([inherited, introduced], [inherited])).toMatchObject({
      current_count: 2,
      baseline_count: 1,
      introduced: [introduced],
      resolved: [],
    });
  });

  it("compares JSDoc totals as fail-on-growth and advisory shrinkage", () => {
    expect(
      compareJSDocTotalsForTesting(
        {
          missingExportExamples: 10,
          unsafeExampleFindings: 2,
        },
        {
          missingExportExamples: 12,
          unsafeExampleFindings: 2,
        }
      )
    ).toMatchObject({
      increased: [],
      decreased: [
        {
          metric: "missingExportExamples",
          baseline: 12,
          current: 10,
          delta: -2,
        },
      ],
      missing_current_metrics: [],
    });

    expect(
      compareJSDocTotalsForTesting(
        {
          missingExportExamples: 13,
        },
        {
          missingExportExamples: 12,
          unsafeExampleFindings: 2,
        }
      )
    ).toMatchObject({
      increased: [
        {
          metric: "missingExportExamples",
          baseline: 12,
          current: 13,
          delta: 1,
        },
      ],
      decreased: [],
      missing_current_metrics: ["unsafeExampleFindings"],
    });
  });

  it("skips repo-level tsgo diagnostics only for explicit package filters", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--filter=@beep/schema"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("check", ["--filter=@beep/schema"]));
  });

  it("keeps scope args in the aggregate lint --fix step", () => {
    const steps = rootQualityStepsForTesting(
      "/repo",
      getInvocation(["lint", "--fix", "--filter=@beep/schema", "--affected", "--dry=json"])
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: expectedRootTurboArgs("lint:fix", ["--filter=@beep/schema", "--affected", "--dry=json"]),
    });
  });

  it("strips lint --fix aggregate aliases before delegating to Turbo", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", "--full", "--repo"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: expectedRootTurboArgs("lint:fix", []),
    });
  });

  it("preserves explicit lint Turbo concurrency", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", "--full", "--concurrency=1"]));

    expect(steps[0]?.args).toEqual(expectedTurboArgs("lint:fix", ["--concurrency=1"]));
  });

  it("plans repo-wide root lint as aggregate and policy sibling steps", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint"]));

    expect(A.map(steps, (step) => step.label)).toEqual([
      "lint",
      "lint:deprecated-apis",
      "knowledge:semantic-delta",
      "knowledge:refs-check",
      "lint:schema-first",
      "lint:terse-effect",
      "lint:jsdoc",
      "lint:native-runtime",
      "lint:identity-registry",
      "lint:frozen-grant-set",
      "lint:circular",
      "lint:effect-fn",
      "lint:package-test-imports",
      "lint:effect-imports",
      "lint:effect-imports-markdown",
      "lint:package-test-typecheck",
      "lint:tsgo-rules",
      "lint:oxlint",
      "lint:ecosystem-polarity",
      "lint:allowlist",
      "lint:jsdoc-module-tags",
      "goals:doctor",
      "goals:index-check",
      "lint:reflection-artifacts",
      "lint:roadmap-refs",
      "lint:judge-rubric",
      "lint:typos",
    ]);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", []));
    expect(steps[0]?.captureTimeoutMillis).toBeUndefined();
    expect(steps.slice(1).every((step) => step.captureTimeoutMillis === 15 * 60 * 1_000)).toBe(true);
  });

  it("plans repo-wide root lint policy without the aggregate lint lane", () => {
    const steps = rootLintPolicyStepsForTesting("/repo");

    expect(A.map(steps, (step) => step.label)).toEqual([
      "lint:deprecated-apis",
      "knowledge:semantic-delta",
      "knowledge:refs-check",
      "lint:schema-first",
      "lint:terse-effect",
      "lint:jsdoc",
      "lint:native-runtime",
      "lint:identity-registry",
      "lint:frozen-grant-set",
      "lint:circular",
      "lint:effect-fn",
      "lint:package-test-imports",
      "lint:effect-imports",
      "lint:effect-imports-markdown",
      "lint:package-test-typecheck",
      "lint:tsgo-rules",
      "lint:oxlint",
      "lint:ecosystem-polarity",
      "lint:allowlist",
      "lint:jsdoc-module-tags",
      "goals:doctor",
      "goals:index-check",
      "lint:reflection-artifacts",
      "lint:roadmap-refs",
      "lint:judge-rubric",
      "lint:typos",
    ]);
    expect(steps.find((step) => step.label === "lint:jsdoc")?.args).toEqual(["eslint", ".", "--max-warnings=0"]);
    expect(steps.find((step) => step.label === "lint:terse-effect")?.args).toContain("--advisory");
    expect(steps.find((step) => step.label === "lint:native-runtime")?.args).toEqual(
      repoCliEntryArgs("laws", "native-runtime", "--check")
    );
    expect(steps.find((step) => step.label === "lint:effect-imports-markdown")?.args).toEqual(
      repoCliEntryArgs("laws", "effect-imports", "--mode", "markdown", "--check")
    );
    expect(steps.every((step) => step.captureTimeoutMillis === 15 * 60 * 1_000)).toBe(true);
  });

  it("passes changed TypeScript files to file-oriented policy laws", () => {
    const files = [
      "packages/demo/src/index.ts",
      "packages/demo/test/Example.test.ts",
      "packages/ecosystem/demo/src/index.ts",
      "README.md",
    ];
    const steps = rootLintPolicyStepsForTesting("/repo", files);

    expect(steps.find((step) => step.label === "lint:effect-fn")?.args).toEqual(
      repoCliEntryArgs(
        "laws",
        "effect-fn",
        "--check",
        "--include",
        "packages/demo/src/index.ts,packages/demo/test/Example.test.ts,packages/ecosystem/demo/src/index.ts"
      )
    );
    expect(steps.find((step) => step.label === "lint:terse-effect")?.args).toContain("--advisory");
    expect(steps.find((step) => step.label === "lint:allowlist")?.args).toEqual(
      repoCliEntryArgs("laws", "allowlist-check")
    );
    expect(steps.find((step) => step.label === "lint:package-test-imports")?.args).toContain(
      "packages/demo/test/Example.test.ts"
    );
    expect(steps.find((step) => step.label === "lint:ecosystem-polarity")?.args).toEqual(
      repoCliEntryArgs("lint", "ecosystem-polarity", "--include", "packages/ecosystem/demo/src/index.ts")
    );
  });

  it("omits empty changed-scope policy steps instead of constructing empty includes", () => {
    const steps = rootLintPolicyStepsForTesting("/repo", ["docs/README.md"]);
    const labels = A.map(steps, (step) => step.label);

    expect(labels).not.toContain("lint:effect-imports");
    expect(labels).toContain("lint:effect-imports-markdown");
    expect(labels).not.toContain("lint:terse-effect");
    expect(labels).not.toContain("lint:effect-fn");
    expect(labels).not.toContain("lint:frozen-grant-set");
    expect(labels).not.toContain("lint:native-runtime");
    expect(labels).not.toContain("lint:ecosystem-polarity");
    expect(labels).not.toContain("lint:package-test-imports");
    expect(A.some(steps, (step) => A.some(step.args, Str.equivalence("")))).toBe(false);
  });

  it("runs repo-wide root lint policy with hosted-stable concurrency", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const binDir = path.join(tmpDir, "bin");
          const fakeBunxPath = path.join(binDir, "bunx");
          const fakeBunPath = path.join(binDir, "bun");

          yield* fs.makeDirectory(binDir, { recursive: true });
          yield* fs.writeFileString(fakeBunxPath, ["#!/usr/bin/env sh", "exit 0", ""].join("\n"));
          yield* fs.writeFileString(fakeBunPath, ["#!/usr/bin/env sh", "exit 0", ""].join("\n"));
          yield* fs.chmod(fakeBunxPath, 0o755);
          yield* fs.chmod(fakeBunPath, 0o755);

          const exit = yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.exit(runRootLintPolicyTask(true))
          );

          expect(Exit.isSuccess(exit)).toBe(true);

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          // Derived from the same plan the runtime executes: a lint policy step
          // added on another branch must not break this assertion when the two
          // land together in a merge.
          const policyStepCount = A.length(rootLintPolicyStepsForTesting(tmpDir));
          expect(logText).toContain(`[beep-cli] lint:policy: running ${policyStepCount} step(s) with concurrency 3`);
        })
      )
    ));

  it("applies Biome lint fixes in the changed-file lint fix fast path", () => {
    const step = lintFixChangedStepForTesting("/repo", ["packages/example/src/index.ts"]);

    expect(step).toMatchObject({
      label: "lint:fix:changed",
      command: "./node_modules/.bin/biome",
      args: [
        "check",
        "--write",
        "--files-ignore-unknown=true",
        "--no-errors-on-unmatched",
        "--",
        "packages/example/src/index.ts",
      ],
      cwd: "/repo",
    });
  });

  it("lets Biome own changed-file matching in the lint fix fast path", () => {
    const step = lintFixChangedStepForTesting("/repo", [
      ".claude/skills/yeet/SKILL.md",
      "packages/example/src/index.ts",
      "schema/example.graphql",
    ]);

    expect(step.args).toEqual([
      "check",
      "--write",
      "--files-ignore-unknown=true",
      "--no-errors-on-unmatched",
      "--",
      ".claude/skills/yeet/SKILL.md",
      "packages/example/src/index.ts",
      "schema/example.graphql",
    ]);
  });

  it("runs combined root coverage tasks in ratchet mode", () => {
    const passthroughTasks = ["build", "check", "test", "coverage", "audit", "lint", "docgen"] as const;
    const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", undefined, () =>
        rootQualityStepsForTesting("/repo", getInvocation(["lint", "--fix", ...passthroughTasks]))
      )
    );

    expect(steps[0]).toMatchObject({
      label: "lint:fix",
      command: "bunx",
      args: localOnlyTurboCacheArgs(expectedRootTurboArgs("lint:fix", passthroughTasks)),
      env: {
        BEEP_FC_SEED: "20260708",
        CI: "true",
        GITHUB_ACTIONS: "true",
        NODE_OPTIONS: "--no-experimental-webstorage",
        TERM_PROGRAM: undefined,
        TERM_PROGRAM_VERSION: undefined,
        TURBO_API: undefined,
        TURBO_CACHE: "local:rw",
        TURBO_TEAM: undefined,
        TURBO_TOKEN: undefined,
        VITEST_COVERAGE_RATCHET: "1",
      },
    });
    expect(steps[0]?.env).not.toHaveProperty("VITEST_COVERAGE_REPORT_ONLY");
  });

  it("runs root coverage as the ratchet gate by default", () => {
    const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", undefined, () => rootQualityStepsForTesting("/repo", getInvocation(["coverage"])))
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "coverage:ratchet",
      command: "bunx",
      args: localOnlyTurboCacheArgs(expectedRootTurboArgs("coverage", [])),
      env: {
        BEEP_FC_SEED: "20260708",
        CI: "true",
        GITHUB_ACTIONS: "true",
        NODE_OPTIONS: "--no-experimental-webstorage",
        TERM_PROGRAM: undefined,
        TERM_PROGRAM_VERSION: undefined,
        TURBO_API: undefined,
        TURBO_CACHE: "local:rw",
        TURBO_TEAM: undefined,
        TURBO_TOKEN: undefined,
        VITEST_COVERAGE_RATCHET: "1",
      },
    });
    expect(steps[0]?.env).not.toHaveProperty("VITEST_COVERAGE_REPORT_ONLY");
  });

  it("reduces coverage children to the pull-request Turbo posture whatever the host carries", () => {
    const steps = withEnvVar("TURBO_API", "https://cache.example.test", () =>
      withEnvVar("TURBO_TOKEN", "op://fixture-vault/turbo/token", () =>
        withEnvVar("TURBO_TEAM", "team_fixture", () =>
          withEnvVar("TURBO_CACHE", "local:rw,remote:r", () =>
            rootQualityStepsForTesting("/repo", getInvocation(["coverage"]))
          )
        )
      )
    );
    const env = steps[0]?.env ?? {};

    // Present-and-undefined is the spawn-time "unset" signal, so the keys must
    // exist rather than merely be absent from a toMatchObject expectation.
    expect(env).toHaveProperty("TURBO_API");
    expect(env).toHaveProperty("TURBO_TOKEN");
    expect(env).toHaveProperty("TURBO_TEAM");
    expect(env.TURBO_API).toBeUndefined();
    expect(env.TURBO_TOKEN).toBeUndefined();
    expect(env.TURBO_TEAM).toBeUndefined();
    expect(env.TURBO_CACHE).toBe("local:rw");
  });

  it("never hands a coverage turbo run a generated remote cache argument", () => {
    // A generated `--cache=local:rw,remote:r` outranks the TURBO_CACHE the
    // coverage environment pins, and the credentials it would need were just
    // scrubbed from that environment. Whatever the ambient plan resolves to
    // (this checkout may be configured for remote reads), coverage invocations
    // carry no remote posture while the caller-owned passthrough survives.
    const ambientPlanArgs = expectedTurboCacheArgs([]);
    const coverage = rootQualityStepsForTesting("/repo", getInvocation(["coverage"]));
    const fullSteps = coverageFullStepsForTesting("/repo", ["@beep/schema"], []);
    const callerOwned = coverageFullStepsForTesting("/repo", ["@beep/schema"], ["--remote-only"]);

    expect(A.every(coverage, (step) => !hasRemoteTurboCacheArgs(step.args))).toBe(true);
    expect(A.every(A.drop(fullSteps, 1), (step) => !hasRemoteTurboCacheArgs(step.args))).toBe(true);
    expect(
      A.every(coverage, (step) => A.isReadonlyArrayEmpty(ambientPlanArgs) || A.contains(step.args, "--cache=local:rw"))
    ).toBe(true);
    // The prebuild is a plain build invocation and keeps the ambient plan.
    expect(fullSteps[0]?.args).toEqual(expect.arrayContaining([...ambientPlanArgs]));
    expect(A.every(A.drop(callerOwned, 1), (step) => A.contains(step.args, "--remote-only"))).toBe(true);
  });

  it("preserves existing Node options when disabling experimental Web Storage for coverage", () => {
    const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", "--max-old-space-size=4096", () =>
        rootQualityStepsForTesting("/repo", getInvocation(["coverage"]))
      )
    );

    expect(steps[0]?.env).toMatchObject({
      BEEP_FC_SEED: "20260708",
      NODE_OPTIONS: "--max-old-space-size=4096 --no-experimental-webstorage",
    });
  });

  it("honors an explicit fast-check seed for exploratory coverage runs", () => {
    const steps = withEnvVar("NODE_OPTIONS", undefined, () =>
      withEnvVar("BEEP_FC_SEED", "8675309", () => rootQualityStepsForTesting("/repo", getInvocation(["coverage"])))
    );

    expect(steps[0]?.env).toMatchObject({
      BEEP_FC_SEED: "8675309",
      NODE_OPTIONS: "--no-experimental-webstorage",
    });
  });

  it("keeps report-only coverage reserved for baseline regeneration and strips writer controls", () => {
    const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", undefined, () =>
        rootQualityStepsForTesting(
          "/repo",
          getInvocation(["coverage", "--", "--write-baseline", "--replace-all", "--concurrency=1", "--force"])
        )
      )
    );

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      label: "coverage:baseline",
      command: "bunx",
      args: localOnlyTurboCacheArgs(
        expectedTurboArgs("coverage", ["--concurrency=1", "--force", "--", "--fileParallelism=true", "--maxWorkers=2"])
      ),
      env: {
        BEEP_FC_SEED: "20260708",
        CI: "true",
        GITHUB_ACTIONS: "true",
        NODE_OPTIONS: "--no-experimental-webstorage",
        TERM_PROGRAM: undefined,
        TERM_PROGRAM_VERSION: undefined,
        TURBO_API: undefined,
        TURBO_CACHE: "local:rw",
        TURBO_TEAM: undefined,
        TURBO_TOKEN: undefined,
        VITEST_COVERAGE_RATCHET: "1",
        VITEST_COVERAGE_REPORT_ONLY: "1",
      },
    });
    expect(steps[0]?.args).not.toContain("--write-baseline");
    expect(steps[0]?.args).not.toContain("--replace-all");
  });

  it.effect(
    "rejects replace-all without baseline writing or with scoped baseline writing",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(validateCoverageTaskArgsForTesting("/repo", ["--replace-all"]));

      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        assert.include(Cause.pretty(exit.cause), "--replace-all requires --write-baseline");
      }

      for (const scopeArg of ["--filter=@beep/repo-cli", "--since=origin/main", "--affected"]) {
        const scopedExit = yield* Effect.exit(
          validateCoverageTaskArgsForTesting("/repo", ["--write-baseline", "--replace-all", scopeArg])
        );

        assert.isTrue(Exit.isFailure(scopedExit));
        if (Exit.isFailure(scopedExit)) {
          assert.include(
            Cause.pretty(scopedExit.cause),
            "--replace-all only applies to an unscoped --write-baseline run"
          );
        }
      }
    }, provideScopedLayer(PlatformLayer))
  );

  it("compares coverage snapshots with fail-on-drop and warning-only new package semantics", () => {
    const result = compareCoverageRegressionSnapshotsForTesting(
      coverageRegressionBaseline,
      [
        {
          packageName: "@beep/existing",
          baseline: CoveragePackageBaseline.make({
            path: "packages/existing",
            ...coveragePercentages(50),
            lines: Percentage.make(49.998),
            uncovered: coverageUncovered(1),
            files: {},
          }),
        },
        {
          packageName: "@beep/new",
          baseline: coveragePackageBaseline("packages/new"),
        },
      ],
      false
    );

    expect(result.comparedCount).toBe(1);
    expect(result.missingActuals).toEqual([]);
    expect(result.newPackages).toEqual([
      expect.objectContaining({
        packageName: "@beep/new",
        baseline: expect.objectContaining({ path: "packages/new" }),
      }),
    ]);
    expect(result.failures).toEqual([
      expect.objectContaining({
        packageName: "@beep/existing",
        metric: "lines",
        actual: 49.998,
        baseline: 50,
      }),
    ]);
  });

  it.effect(
    "decodes per-file summary entries into stable repo-relative baseline paths",
    Effect.fnUntraced(function* () {
      const baseline = yield* coveragePackageBaselineFromSummaryForTesting(
        "/repo",
        "/repo/packages/existing",
        encodeJson({
          total: vitestCoverageMetrics(20, 15, 75),
          "/repo/packages/existing/src/Absolute.ts": vitestCoverageMetrics(10, 10, 100),
          "src/Relative.ts": vitestCoverageMetrics(10, 5, 50),
        })
      ).pipe(provideScopedLayer(NodePath.layer));
      const files = baseline.files;

      assert.strictEqual(baseline.path, "packages/existing");
      assert.deepStrictEqual(R.keys(files), ["packages/existing/src/Absolute.ts", "packages/existing/src/Relative.ts"]);
      const relativeFile = files["packages/existing/src/Relative.ts"];
      assert.isDefined(relativeFile);
      assert.strictEqual(relativeFile.lines, Percentage.make(50));
      assert.strictEqual(relativeFile.uncovered.lines, NonNegativeInt.make(5));
    })
  );

  it.effect(
    "derives Istanbul-compatible percentages from trusted counts instead of the reported pct field",
    Effect.fnUntraced(function* () {
      const baseline = yield* coveragePackageBaselineFromSummaryForTesting(
        "/repo",
        "/repo/packages/existing",
        encodeJson({
          total: vitestCoverageMetrics(10, 0, 100),
          "src/Fractional.ts": vitestCoverageMetrics(134, 115, 100),
          "src/NoSubjects.ts": vitestCoverageMetrics(0, 0, "Unknown"),
        })
      ).pipe(provideScopedLayer(NodePath.layer));
      const fractional = baseline.files["packages/existing/src/Fractional.ts"];
      const noSubjects = baseline.files["packages/existing/src/NoSubjects.ts"];

      assert.strictEqual(baseline.lines, Percentage.make(0));
      assert.isDefined(fractional);
      assert.strictEqual(fractional.lines, Percentage.make(85.82));
      assert.isDefined(noSubjects);
      assert.strictEqual(noSubjects.lines, Percentage.make(100));
    })
  );

  it.effect(
    "rejects absolute and relative summary entries that normalize to the same repository path in either order",
    Effect.fnUntraced(function* () {
      const absolutePath = "/repo/packages/existing/src/Dupe.ts";
      const relativePath = "src/Dupe.ts";
      const orders = [
        [absolutePath, relativePath],
        [relativePath, absolutePath],
      ];
      const messages = yield* Effect.forEach(
        orders,
        Effect.fnUntraced(function* (rawPaths) {
          const error = yield* Effect.flip(
            coveragePackageBaselineFromSummaryForTesting(
              "/repo",
              "/repo/packages/existing",
              encodeJson({
                total: vitestCoverageMetrics(10, 10, 100),
                ...R.fromEntries(A.map(rawPaths, (rawPath) => [rawPath, vitestCoverageMetrics(10, 10, 100)])),
              })
            ).pipe(provideScopedLayer(NodePath.layer))
          );
          return error.message;
        })
      );

      assert.strictEqual(messages[0], messages[1]);
      assert.include(messages[0] ?? "", 'both normalize to "packages/existing/src/Dupe.ts"');
      assert.include(messages[0] ?? "", "Remove the duplicate absolute/relative entry");
    })
  );

  it.effect(
    "rejects control characters in raw summary paths without reflecting them into diagnostics",
    Effect.fnUntraced(function* () {
      yield* Effect.forEach(
        ["\u0000", "\u001B", "\u007F", "\u0085"],
        Effect.fnUntraced(function* (control) {
          const error = yield* Effect.flip(
            coveragePackageBaselineFromSummaryForTesting(
              "/repo",
              "/repo/packages/existing",
              encodeJson({
                total: vitestCoverageMetrics(10, 10, 100),
                [`src/Unsafe${control}Name.ts`]: vitestCoverageMetrics(10, 10, 100),
              })
            ).pipe(provideScopedLayer(NodePath.layer))
          );

          assert.include(error.message, "without control characters");
          assert.notMatch(error.message, /[\u0000-\u001F\u007F-\u009F]/u);
        }),
        { discard: true }
      );
    })
  );

  it.effect(
    "bounds coverage-summary decode diagnostics while retaining the typed parse cause",
    Effect.fnUntraced(function* () {
      const invalidPct = Str.repeat(20_000)("x");
      const error = yield* Effect.flip(
        coveragePackageBaselineFromSummaryForTesting(
          "/repo",
          "/repo/packages/existing",
          encodeJson({
            total: {
              ...vitestCoverageMetrics(10, 10, 100),
              lines: { total: 10, covered: 10, skipped: 0, pct: invalidPct },
            },
          })
        ).pipe(provideScopedLayer(NodePath.layer))
      );

      assert.isTrue(isDomainError(error));
      if (isDomainError(error)) {
        assert.include(error.message, "Failed to parse coverage summary fixture");
        assert.isAtMost(Str.length(error.message), 4_096);
        assert.isDefined(error.cause);
        assert.isAbove(Str.length(Inspectable.toStringUnknown(error.cause, 0)), 16_384);
      }
    })
  );

  it.effect(
    "rejects internally inconsistent Vitest coverage summary counts",
    Effect.fnUntraced(function* () {
      const valid = vitestCoverageMetrics(10, 8, 80);
      const invalidSummaries = [
        {
          label: "covered exceeds total",
          summary: { ...valid, lines: { ...valid.lines, covered: 11 } },
        },
        {
          label: "skipped exceeds total",
          summary: { ...valid, lines: { ...valid.lines, skipped: 11 } },
        },
      ];

      yield* Effect.forEach(
        invalidSummaries,
        Effect.fnUntraced(function* ({ label, summary }) {
          const decoded = yield* Effect.exit(
            coveragePackageBaselineFromSummaryForTesting(
              "/repo",
              "/repo/packages/existing",
              encodeJson({ total: valid, "src/Index.ts": summary })
            ).pipe(provideScopedLayer(NodePath.layer))
          );
          assert.isTrue(Exit.isFailure(decoded), `Expected ${label} to fail summary decoding`);
        }),
        { discard: true }
      );
    })
  );

  it.effect(
    "rejects current coverage baselines without per-file provenance",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(
        S.decodeUnknownEffect(CoverageRegressionBaseline)({
          schema_version: 2,
          generated_at: "2026-07-06T00:00:00.000Z",
          git_sha: "test-sha",
          command: "bun run coverage:baseline:write",
          epsilon: 0.001,
          packages: {
            "@beep/existing": {
              path: "packages/existing",
              lines: 50,
              statements: 50,
              branches: 50,
              functions: 50,
              uncovered: { lines: 5, statements: 5, branches: 5, functions: 5 },
            },
          },
        })
      );

      assert.isTrue(Exit.isFailure(decoded));
    })
  );

  it.effect(
    "rejects out-of-range v2 metrics, unsupported epsilon, and non-normalized file keys",
    Effect.fnUntraced(function* () {
      const validPackage = {
        path: "packages/existing",
        lines: 50,
        statements: 50,
        branches: 50,
        functions: 50,
        uncovered: { lines: 5, statements: 5, branches: 5, functions: 5 },
        files: {
          "packages/existing/src/Index.ts": {
            lines: 50,
            statements: 50,
            branches: 50,
            functions: 50,
            uncovered: { lines: 5, statements: 5, branches: 5, functions: 5 },
          },
        },
      };
      const document = (packageBaseline: unknown, epsilon = 0.001) => ({
        schema_version: 2,
        generated_at: "2026-07-06T00:00:00.000Z",
        git_sha: "test-sha",
        command: "bun run coverage:baseline:write",
        epsilon,
        packages: { "@beep/existing": packageBaseline },
      });
      const invalidDocuments = [
        { label: "negative package percentage", input: document({ ...validPackage, lines: -0.01 }) },
        { label: "package percentage above 100", input: document({ ...validPackage, lines: 100.01 }) },
        {
          label: "negative uncovered count",
          input: document({
            ...validPackage,
            uncovered: { ...validPackage.uncovered, lines: -1 },
          }),
        },
        { label: "unsupported epsilon", input: document(validPackage, 0.01) },
        ...A.map(
          [
            "/absolute.ts",
            "../escape.ts",
            "packages/existing/src/../escape.ts",
            "packages\\existing\\src\\Index.ts",
            "packages/existing//src/Index.ts",
            "packages/existing/src/Index.ts/",
            "packages/existing/src/Null\u0000.ts",
            "packages/existing/src/Escape\u001B.ts",
            "packages/existing/src/Delete\u007F.ts",
            "packages/existing/src/NextLine\u0085.ts",
          ],
          (filePath) => ({
            label: `non-normalized file key ${filePath}`,
            input: document({
              ...validPackage,
              files: { [filePath]: validPackage.files["packages/existing/src/Index.ts"] },
            }),
          })
        ),
      ];

      yield* Effect.forEach(
        invalidDocuments,
        Effect.fnUntraced(function* ({ input, label }) {
          const decoded = yield* Effect.exit(S.decodeUnknownEffect(CoverageRegressionBaseline)(input));
          assert.isTrue(Exit.isFailure(decoded), `Expected ${label} to fail baseline decoding`);
        }),
        { discard: true }
      );

      const unsafeFailure = yield* Effect.exit(
        S.decodeEffect(CoverageComparisonFailure)({
          _tag: "baseline-drop",
          actual: 0,
          baseline: 100,
          filePath: "packages/existing/src/Unsafe\u001B.ts",
          metric: "lines",
          packageName: "@beep/existing",
          packagePath: "packages/existing",
        })
      );
      assert.isTrue(Exit.isFailure(unsafeFailure));
    })
  );

  it.effect.skipIf(Bun.env.VITEST_COVERAGE_REPORT_ONLY === "1")(
    "keeps every committed coverage package on schema v2 with file provenance",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const content = yield* fs.readFileString(path.join(repoRoot, "standards/coverage.regression-baseline.jsonc"));
      const decoded = yield* decodeCoverageRegressionBaselineJsoncForTesting(content);

      assert.strictEqual(decoded.schema_version, 2);
      assert.isTrue(R.size(decoded.packages) > 0);
    }, provideScopedLayer(FileSystemLayer))
  );

  it.effect(
    "rejects legacy schema versions after the per-file migration",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(
        S.decodeUnknownEffect(CoverageRegressionBaseline)({
          schema_version: 1,
          generated_at: "2026-07-06T00:00:00.000Z",
          git_sha: "test-sha",
          command: "bun run coverage:baseline:write",
          epsilon: 0.001,
          packages: {
            "@beep/existing": {
              path: "packages/existing",
              lines: 50,
              statements: 50,
              branches: 50,
              functions: 50,
              uncovered: { lines: 5, statements: 5, branches: 5, functions: 5 },
              files: {},
            },
          },
        })
      );

      assert.isTrue(Exit.isFailure(decoded));
    })
  );

  it.effect(
    "refuses scoped v1 writes and migrates a full regeneration to schema v2",
    Effect.fnUntraced(function* () {
      yield* withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = process.cwd();
          const coverageDirectory = path.join(repoRoot, "coverage");
          const standardsDirectory = path.join(repoRoot, "standards");
          const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");

          yield* fs.makeDirectory(coverageDirectory, { recursive: true });
          yield* fs.makeDirectory(standardsDirectory, { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            encodeJson({ name: "@beep/existing", scripts: { coverage: "vitest" } })
          );
          yield* fs.writeFileString(
            path.join(coverageDirectory, "coverage-summary.json"),
            encodeJson({
              total: vitestCoverageMetrics(10, 8, 80),
              "src/Index.ts": vitestCoverageMetrics(10, 8, 80),
            })
          );
          yield* fs.writeFileString(
            baselinePath,
            encodeJson({
              schema_version: 1,
              generated_at: "2026-07-06T00:00:00.000Z",
              git_sha: "legacy-sha",
              command: "bun run coverage:baseline:write",
              epsilon: 0.001,
              packages: { "@beep/existing": { path: "." } },
            })
          );

          const scopedExit = yield* Effect.exit(writeCoverageRegressionBaseline(repoRoot, true));
          assert.isTrue(Exit.isFailure(scopedExit));
          if (Exit.isFailure(scopedExit)) {
            assert.include(Cause.pretty(scopedExit.cause), "schema version 1 requires a full");
          }

          yield* fs.writeFileString(
            baselinePath,
            encodeJson({
              schema_version: 1,
              generated_at: "2026-07-06T00:00:00.000Z",
              git_sha: "legacy-sha",
              command: "bun run coverage:baseline:write",
              epsilon: 0.001,
              minimum: { lines: 71, statements: 72, branches: 51, functions: 61 },
              exemptions: { "@beep/exempt": "Named migration exemption." },
              follow_ups: { "@beep/debt": "Named migration follow-up." },
              packages: { "@beep/existing": { path: "." } },
            })
          );

          yield* runGit(repoRoot, ["init"]);
          yield* runGit(repoRoot, ["config", "user.email", "coverage@example.invalid"]);
          yield* runGit(repoRoot, ["config", "user.name", "Coverage Test"]);
          yield* runGit(repoRoot, ["add", "package.json"]);
          yield* runGit(repoRoot, ["commit", "-m", "test: seed coverage fixture"]);
          yield* writeCoverageRegressionBaseline(repoRoot, false);

          const migrated = yield* decodeCoverageRegressionBaselineJsoncForTesting(
            yield* fs.readFileString(baselinePath)
          );
          assert.strictEqual(migrated.schema_version, 2);
          assert.strictEqual(migrated.minimum.lines, 71);
          assert.strictEqual(migrated.minimum.statements, 72);
          assert.strictEqual(migrated.minimum.branches, 51);
          assert.strictEqual(migrated.minimum.functions, 61);
          assert.deepStrictEqual(migrated.exemptions, { "@beep/exempt": "Named migration exemption." });
          assert.deepStrictEqual(migrated.follow_ups, { "@beep/debt": "Named migration follow-up." });
          const migratedPackage = R.get(migrated.packages, "@beep/existing");
          assert.isTrue(O.isSome(migratedPackage));
          if (O.isSome(migratedPackage)) {
            assert.deepStrictEqual(R.keys(migratedPackage.value.files), ["src/Index.ts"]);
          }
        })
      );
    })
  );

  it.effect(
    "holds an unchanged package without a comparison base and replaces it after a dirty package change",
    Effect.fnUntraced(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* fs.makeTempDirectory();
          yield* Effect.addFinalizer(() => fs.remove(repoRoot, { force: true, recursive: true }).pipe(Effect.orDie));
          const packageDir = path.join(repoRoot, "packages/existing");
          const sourcePath = path.join(packageDir, "src/Index.ts");
          const coverageDirectory = path.join(packageDir, "coverage");
          const standardsDirectory = path.join(repoRoot, "standards");
          const baselinePath = path.join(standardsDirectory, "coverage.regression-baseline.jsonc");
          const committedRow = CoveragePackageBaseline.make({
            path: "packages/existing",
            ...coveragePercentages(40),
            uncovered: coverageUncovered(6),
            files: {
              "packages/existing/src/Index.ts": coverageFileBaseline(40, 6),
            },
          });

          yield* fs.makeDirectory(path.dirname(sourcePath), { recursive: true });
          yield* fs.makeDirectory(coverageDirectory, { recursive: true });
          yield* fs.makeDirectory(standardsDirectory, { recursive: true });
          yield* fs.writeFileString(
            path.join(repoRoot, "package.json"),
            encodeJson({ name: "@beep/test-root", private: true, workspaces: ["packages/*"] })
          );
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({ name: "@beep/existing", private: true, scripts: { coverage: "vitest" } })
          );
          yield* fs.writeFileString(sourcePath, "export const value = 1;\n");
          yield* fs.writeFileString(
            path.join(coverageDirectory, "coverage-summary.json"),
            encodeJson({
              total: vitestCoverageMetrics(10, 9, 90),
              "src/Index.ts": vitestCoverageMetrics(10, 9, 90),
            })
          );
          yield* fs.writeFileString(
            baselinePath,
            encodeJson({
              schema_version: 2,
              generated_at: "2026-07-06T00:00:00.000Z",
              git_sha: "committed-sha",
              command: "bun run coverage:baseline:write",
              epsilon: 0.001,
              minimum: coveragePercentages(0),
              exemptions: {},
              follow_ups: {},
              packages: { "@beep/existing": committedRow },
            })
          );

          yield* runGit(repoRoot, ["init"]);
          yield* runGit(repoRoot, ["config", "user.email", "coverage@example.invalid"]);
          yield* runGit(repoRoot, ["config", "user.name", "Coverage Test"]);
          yield* runGit(repoRoot, ["add", "--all"]);
          yield* runGit(repoRoot, ["commit", "-m", "test: seed unchanged coverage fixture"]);

          expect(yield* planWorkspaceCoverageAffectedScope(repoRoot, [])).toMatchObject({ _tag: "noop" });
          expect(yield* planWorkspaceCoverageAffectedScope(repoRoot, ["package.json"])).toMatchObject({ _tag: "full" });

          yield* writeCoverageRegressionBaseline(repoRoot, false).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "origin/main" })
            )
          );
          const heldBaseline = yield* decodeCoverageRegressionBaselineJsoncForTesting(
            yield* fs.readFileString(baselinePath)
          );
          expect(heldBaseline.generated_at).toBe("2026-07-06T00:00:00.000Z");
          expect(heldBaseline.git_sha).toBe("committed-sha");
          expect(heldBaseline.packages["@beep/existing"]).toEqual(committedRow);
          expect(A.join(A.filter(yield* TestConsole.logLines, isString), "\n")).toContain(
            "replaced 0 changed package(s), added 0, held 1 unchanged package(s) at committed rows, pruned 0 (base: dirty worktree only)"
          );
          expect(A.join(A.filter(yield* TestConsole.logLines, isString), "\n")).toContain(
            "[coverage-ratchet] TURBO_SCM_BASE origin/main does not resolve here; falling back to origin/main merge-base or dirty-worktree files only"
          );

          yield* runGit(repoRoot, ["add", "--all"]);
          yield* runGit(repoRoot, ["commit", "-m", "test: commit held baseline"]);
          yield* fs.writeFileString(sourcePath, "export const value = 2;\n");

          yield* writeCoverageRegressionBaseline(repoRoot, false).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "origin/main" })
            )
          );
          const replacedBaseline = yield* decodeCoverageRegressionBaselineJsoncForTesting(
            yield* fs.readFileString(baselinePath)
          );
          expect(replacedBaseline.generated_at).not.toBe("2026-07-06T00:00:00.000Z");
          expect(replacedBaseline.git_sha).not.toBe("committed-sha");
          expect(replacedBaseline.packages["@beep/existing"]?.lines).toBe(90);
          expect(replacedBaseline.packages["@beep/existing"]?.uncovered).toEqual(coverageUncovered(1));
          expect(replacedBaseline.packages["@beep/existing"]?.files).toEqual({
            "packages/existing/src/Index.ts": coverageFileBaseline(90, 1),
          });
          expect(A.join(A.filter(yield* TestConsole.logLines, isString), "\n")).toContain(
            "replaced 1 changed package(s), added 0, held 0 unchanged package(s) at committed rows, pruned 0 (base: dirty worktree only)"
          );
        })
      ).pipe(provideScopedLayer(PlatformLayer));
    })
  );

  it("only fails missing baseline-package summaries for unscoped coverage runs", () => {
    expect(compareCoverageRegressionSnapshotsForTesting(coverageRegressionBaseline, [], false).missingActuals).toEqual([
      "@beep/existing",
    ]);
    expect(compareCoverageRegressionSnapshotsForTesting(coverageRegressionBaseline, [], true).missingActuals).toEqual(
      []
    );
  });

  it("excludes the coverage baseline artifact only from writer change-set planning", () => {
    expect(
      coverageBaselineWriterChangedFiles([
        "packages/example/src/Index.ts",
        "standards/coverage.regression-baseline.jsonc",
        "vitest.config.ts",
      ])
    ).toEqual(["packages/example/src/Index.ts", "vitest.config.ts"]);
  });

  it("keeps rendered coverage diagnostics free of terminal control characters", () => {
    const packageName = "@beep/existing\u001B[31m";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        [packageName]: CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(0),
          files: {},
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(49),
      uncovered: coverageUncovered(1),
      files: {},
    });
    const failures = compareCoverageRegressionSnapshotsForTesting(
      before,
      [{ packageName, baseline: actual }],
      false
    ).failures;
    const rendered = renderCoverageFailuresForTesting(failures);

    assert.isNotEmpty(rendered);
    A.forEach(rendered, (line) => assert.notMatch(line, /[\u0000-\u001F\u007F-\u009F]/u));
  });

  it("enforces tiered minimums independently while allowing named follow-up debt", () => {
    const policyBaseline = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      minimum: {
        lines: Percentage.make(70),
        statements: Percentage.make(70),
        branches: Percentage.make(50),
        functions: Percentage.make(60),
      },
      follow_ups: {
        "@beep/debt": "Dedicated follow-up.",
      },
      packages: {
        "@beep/debt": coveragePackageBaseline("packages/debt", 10),
        "@beep/existing": coveragePackageBaseline("packages/existing", 80),
      },
    });
    const result = compareCoverageRegressionSnapshotsForTesting(
      policyBaseline,
      [
        { packageName: "@beep/debt", baseline: coveragePackageBaseline("packages/debt", 10) },
        {
          packageName: "@beep/existing",
          baseline: CoveragePackageBaseline.make({
            path: "packages/existing",
            lines: Percentage.make(65),
            statements: Percentage.make(65),
            branches: Percentage.make(45),
            functions: Percentage.make(55),
            uncovered: coverageUncovered(0),
            files: {},
          }),
        },
      ],
      false
    );

    expect(
      A.sort(
        A.map(result.minimumFailures, (failure) => failure.metric),
        Order.String
      )
    ).toEqual(["branches", "functions", "lines", "statements"]);
    expect(A.map(result.followUpDebt, (entry) => entry.packageName)).toEqual(["@beep/debt"]);
  });

  it("requires every workspace package to have coverage or a named exemption", () => {
    expect(
      coverageDispositionGapsForTesting(
        ["@beep/covered", "@beep/exempt", "@beep/missing"],
        ["@beep/covered"],
        ["@beep/exempt"]
      )
    ).toEqual(["@beep/missing"]);
  });

  it("fails when an exact selected coverage owner omits its summary", () => {
    expect(
      compareCoverageRegressionSnapshotsForExpectedPackagesForTesting(
        coverageRegressionBaseline,
        [],
        ["@beep/existing", "@beep/new"]
      ).missingActuals
    ).toEqual(["@beep/existing", "@beep/new"]);
  });

  it("selects only directly changed coverage owners for an affected coverage run", () => {
    const owners = [
      CoverageScopeOwner.make({
        packageName: "@beep/a",
        packagePath: "packages/a",
        hasCoverage: true,
      }),
      CoverageScopeOwner.make({
        packageName: "@beep/b",
        packagePath: "packages/b",
        hasCoverage: true,
      }),
    ];

    expect(planCoverageAffectedScope(owners, ["packages/b/src/B.ts", "packages/a/test/A.test.ts"])).toEqual({
      _tag: "selected",
      packageNames: ["@beep/a", "@beep/b"],
      dependentPackageNames: [],
    });
  });

  describe("dependents in affected coverage scope", () => {
    const owner = (
      packageName: string,
      options: {
        readonly hasCoverage?: boolean;
        readonly dependsOn?: ReadonlyArray<string>;
        readonly path?: string;
      } = {}
    ) =>
      CoverageScopeOwner.make({
        packageName: `@beep/${packageName}`,
        packagePath: options.path ?? `packages/${packageName}`,
        hasCoverage: options.hasCoverage ?? true,
        workspaceDependencies: A.map(options.dependsOn ?? [], (name) => `@beep/${name}`),
      });

    // a <- b <- c, with d unrelated and e depending on c only through b.
    const chain = [
      owner("a"),
      owner("b", { dependsOn: ["a"] }),
      owner("c", { dependsOn: ["b"] }),
      owner("d"),
      owner("e", { dependsOn: ["c", "d"] }),
    ];

    it("selects every transitive coverage-bearing dependent of a changed owner's source", () => {
      expect(planCoverageAffectedScope(chain, ["packages/a/src/A.ts"])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/a", "@beep/b", "@beep/c", "@beep/e"],
        dependentPackageNames: ["@beep/b", "@beep/c", "@beep/e"],
      });
    });

    it("keeps a test-only change scoped to its own owner", () => {
      expect(planCoverageAffectedScope(chain, ["packages/a/test/A.test.ts"])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/a"],
        dependentPackageNames: [],
      });
    });

    it("reports a directly changed owner as direct even when it also depends on another changed owner", () => {
      expect(planCoverageAffectedScope(chain, ["packages/a/src/A.ts", "packages/c/src/C.ts"])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/a", "@beep/b", "@beep/c", "@beep/e"],
        dependentPackageNames: ["@beep/b", "@beep/e"],
      });
    });

    it("lets a package without a coverage task seed its coverage-bearing dependents", () => {
      const owners = [owner("types", { hasCoverage: false }), owner("schema", { dependsOn: ["types"] })];

      expect(planCoverageAffectedScope(owners, ["packages/types/src/index.ts"])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/schema"],
        dependentPackageNames: ["@beep/schema"],
      });
    });

    it("walks through lab and coverage-less dependents without selecting them, and never seeds from a lab", () => {
      const owners = [
        owner("core"),
        owner("no-coverage", { hasCoverage: false, dependsOn: ["core"] }),
        owner("demo", { path: "apps/labs/demo", dependsOn: ["core"] }),
        owner("product", { dependsOn: ["no-coverage"] }),
        owner("showcase", { dependsOn: ["demo"] }),
      ];

      expect(coverageDependentOwners(owners, ["@beep/core"])).toEqual(["@beep/product", "@beep/showcase"]);
      expect(planCoverageAffectedScope(owners, ["apps/labs/demo/src/App.tsx"])).toEqual({ _tag: "noop" });
    });

    it("does not seed dependents from a repository fixture owned by a package's tests", () => {
      const owners = [
        CoverageScopeOwner.make({
          packageName: "@beep/repo-cli",
          packagePath: "packages/tooling/tool/cli",
          hasCoverage: true,
        }),
        owner("docs-tool", { dependsOn: ["repo-cli"] }),
      ];

      expect(
        planCoverageAffectedScope(owners, ["goals/fallow-quality-enforcement/research/feature-matrix.jsonc"])
      ).toEqual({ _tag: "selected", packageNames: ["@beep/repo-cli"], dependentPackageNames: [] });
    });

    it("reads workspace edges from the live inventory and never lists the repository root as an owner", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const writePackage = (dir: string, manifest: Record<string, unknown>) =>
              fs
                .makeDirectory(path.join(repoRoot, dir), { recursive: true })
                .pipe(
                  Effect.andThen(fs.writeFileString(path.join(repoRoot, dir, "package.json"), encodeJson(manifest)))
                );

            // The root carries the aggregate `coverage` script and a workspace
            // dependency, exactly the shape that would otherwise make it a
            // dependent of nearly every package.
            yield* fs.writeFileString(
              path.join(repoRoot, "package.json"),
              encodeJson({
                name: "@beep/root",
                private: true,
                workspaces: ["packages/*"],
                scripts: { coverage: "beep-cli coverage" },
                devDependencies: { "@beep/a": "workspace:*" },
              })
            );
            yield* writePackage("packages/a", {
              name: "@beep/a",
              scripts: { coverage: "vitest" },
              dependencies: { "@beep/b": "workspace:*", effect: "*" },
              devDependencies: { "@beep/c": "workspace:*" },
              peerDependencies: { "@beep/a": "workspace:*" },
            });
            yield* writePackage("packages/b", { name: "@beep/b", scripts: { coverage: "vitest" } });
            yield* writePackage("packages/c", { name: "@beep/c", scripts: { test: "vitest" } });
            // A manifest with no `scripts` key at all is still an owner, just not a coverage owner.
            yield* writePackage("packages/d", { name: "@beep/d", dependencies: { "@beep/a": "workspace:*" } });

            const owners = yield* workspaceCoverageScopeOwners(repoRoot);
            expect(A.map(owners, (owner) => owner.packageName)).toEqual(["@beep/a", "@beep/b", "@beep/c", "@beep/d"]);
            expect(A.map(owners, (owner) => owner.hasCoverage)).toEqual([true, true, false, false]);
            expect(A.map(owners, (owner) => owner.workspaceDependencies)).toEqual([
              ["@beep/b", "@beep/c"],
              [],
              [],
              ["@beep/a"],
            ]);

            expect(yield* planWorkspaceCoverageAffectedScope(repoRoot, ["packages/b/src/B.ts"])).toEqual({
              _tag: "selected",
              packageNames: ["@beep/a", "@beep/b"],
              dependentPackageNames: ["@beep/a"],
            });
            expect(yield* planWorkspaceCoverageAffectedScope(repoRoot, ["packages/c/src/C.ts"])).toEqual({
              _tag: "selected",
              packageNames: ["@beep/a"],
              dependentPackageNames: ["@beep/a"],
            });
          })
        )
      ));

    it("falls back to a full run when a repository fixture's configured owner cannot measure coverage", () => {
      const owners = [
        CoverageScopeOwner.make({
          packageName: "@beep/repo-cli",
          packagePath: "packages/tooling/tool/cli",
          hasCoverage: false,
        }),
      ];

      expect(
        planCoverageAffectedScope(owners, ["goals/fallow-quality-enforcement/research/feature-matrix.jsonc"])
      ).toEqual({
        _tag: "full",
        reasons: [
          "goals/fallow-quality-enforcement/research/feature-matrix.jsonc: configured repository fixture coverage owner is unavailable",
        ],
      });
    });

    it("terminates on dependency cycles and excludes the seeds themselves", () => {
      const owners = [
        owner("x", { dependsOn: ["y"] }),
        owner("y", { dependsOn: ["x"] }),
        owner("z", { dependsOn: ["x"] }),
      ];

      expect(coverageDependentOwners(owners, ["@beep/x"])).toEqual(["@beep/y", "@beep/z"]);
      expect(coverageDependentOwners(owners, ["@beep/x", "@beep/y"])).toEqual(["@beep/z"]);
    });

    it("weighs a selection with the shard planner's per-package seconds, counting duplicates once", () => {
      expect(coverageScopeWeightSeconds(["@beep/repo-cli", "@beep/repo-cli"])).toBe(720.62);
      expect(coverageScopeWeightSeconds(["@beep/unknown-a", "@beep/unknown-b"])).toBe(30);
    });

    it("runs a narrow selection as one Turbo invocation on hosted runners", () => {
      const steps = coverageSelectedStepsForTesting("/repo", ["@beep/a", "@beep/b"], [], {
        hosted: true,
        writeBaseline: false,
      });

      expect(A.map(steps, (step) => step.label)).toEqual(["coverage:ratchet"]);
      expect(A.take(steps[0]?.args ?? [], 3)).toEqual(["turbo", "run", "coverage"]);
      expect(steps[0]?.args).toEqual(expect.arrayContaining(["--filter=@beep/a", "--filter=@beep/b"]));
      expect(steps[0]?.args).not.toContain("--only");
    });

    // CI=true here only fixes the prebuild's Turbo cache posture (turboRunArgs
    // reads it); the shard decision is the explicit `hosted` option.
    it("shards a wide selection like the full lane, prebuilding only the selected owners", () =>
      withEnvVar("CI", "true", () => {
        const packageNames = ["@beep/repo-cli", "@beep/a", "@beep/b"];
        const steps = coverageSelectedStepsForTesting("/repo", packageNames, ["--output-logs=errors-only"], {
          hosted: true,
          writeBaseline: false,
        });

        expect(A.map(steps, (step) => step.label)).toEqual([
          "coverage:prebuild",
          "coverage:shard-1",
          "coverage:shard-2",
          "coverage:shard-3",
        ]);
        expect(steps[0]?.args).toEqual([
          "turbo",
          "run",
          "build",
          "--concurrency=4",
          "--summarize",
          LABS_EXCLUDE_FILTER,
          "--filter=@beep/repo-cli",
          "--filter=@beep/a",
          "--filter=@beep/b",
          "--output-logs=errors-only",
        ]);
        const shardFilters = pipe(
          A.drop(steps, 1),
          A.flatMap((step) => A.filter(step.args, (arg) => Str.startsWith("--filter=@beep/")(arg))),
          A.sort(Order.String)
        );
        expect(shardFilters).toEqual(["--filter=@beep/a", "--filter=@beep/b", "--filter=@beep/repo-cli"]);
        expect(A.every(A.drop(steps, 1), (step) => A.contains(step.args, "--only"))).toBe(true);
        expect(A.every(A.drop(steps, 1), (step) => step.env?.VITEST_COVERAGE_REPORT_ONLY === undefined)).toBe(true);
      }));

    it("uses the same shard topology for wide local ratchets and baseline writes", () => {
      const packageNames = ["@beep/repo-cli", "@beep/a"];
      const localOptions = { hosted: false, writeBaseline: false };

      expect(
        A.map(coverageSelectedStepsForTesting("/repo", packageNames, [], localOptions), (step) => step.label)
      ).toEqual(["coverage:prebuild", "coverage:shard-1", "coverage:shard-2"]);
      const writeSteps = coverageSelectedStepsForTesting("/repo", packageNames, [], {
        hosted: false,
        writeBaseline: true,
      });
      expect(A.map(writeSteps, (step) => step.label)).toEqual([
        "coverage:prebuild",
        "coverage:shard-1",
        "coverage:shard-2",
      ]);
      expect(A.every(A.drop(writeSteps, 1), (step) => step.env?.VITEST_COVERAGE_REPORT_ONLY === "1")).toBe(true);
    });
  });

  describe("baseline row delta and scoped remediation", () => {
    const withRows = (packages: Record<string, CoveragePackageBaseline>) =>
      CoverageRegressionBaseline.make({ ...coverageRegressionBaseline, packages });

    it("names only the packages whose rows changed and ignores provenance", () => {
      const previous = withRows({
        "@beep/a": coveragePackageBaseline("packages/a", 50),
        "@beep/b": coveragePackageBaseline("packages/b", 50),
      });
      const provenanceOnly = CoverageRegressionBaseline.make({
        ...previous,
        generated_at: "2026-08-25T00:00:00.000Z",
        git_sha: "other-sha",
      });
      const oneRowChanged = withRows({
        "@beep/a": coveragePackageBaseline("packages/a", 60),
        "@beep/b": coveragePackageBaseline("packages/b", 50),
      });
      const rowAddedAndRemoved = withRows({
        "@beep/b": coveragePackageBaseline("packages/b", 50),
        "@beep/c": coveragePackageBaseline("packages/c", 50),
      });

      const delta = (present: ReadonlyArray<string>, removed: ReadonlyArray<string> = []) =>
        O.some(CoverageBaselineRowDelta.make({ present, removed }));

      expect(coverageBaselineRowDelta(previous, previous)).toEqual(delta([]));
      expect(coverageBaselineRowDelta(previous, provenanceOnly)).toEqual(delta([]));
      expect(coverageBaselineRowDelta(previous, oneRowChanged)).toEqual(delta(["@beep/a"]));
      expect(coverageBaselineRowDelta(previous, rowAddedAndRemoved)).toEqual(delta(["@beep/c"], ["@beep/a"]));
    });

    it("refuses to scope when a non-row field changed", () => {
      const previous = withRows({ "@beep/a": coveragePackageBaseline("packages/a") });

      expect(
        coverageBaselineRowDelta(
          previous,
          CoverageRegressionBaseline.make({ ...previous, minimum: coveragePercentages(1) })
        )
      ).toEqual(O.none());
      expect(
        coverageBaselineRowDelta(
          previous,
          CoverageRegressionBaseline.make({ ...previous, exemptions: { "@beep/x": "user-excluded" } })
        )
      ).toEqual(O.none());
      expect(
        coverageBaselineRowDelta(
          previous,
          CoverageRegressionBaseline.make({ ...previous, follow_ups: { "@beep/a": "needs tests" } })
        )
      ).toEqual(O.none());
    });

    it("diffs the committed base against the working copy through git", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              S.encodeEffect(CoverageRegressionBaseline)(document).pipe(
                Effect.flatMap((encoded) => fs.writeFileString(baselinePath, encodeJson(encoded)))
              );

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "coverage-delta@example.test"]);
            yield* runGit(repoRoot, ["config", "user.name", "Coverage Delta Test"]);

            // The base has no baseline at all: nothing can be diffed.
            yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# fixture\n");
            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "initial"]);
            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a") }));
            expect(yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD")).toEqual(O.none());

            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "baseline"]);
            const delta = (present: ReadonlyArray<string>) =>
              O.some(CoverageBaselineRowDelta.make({ present, removed: [] }));
            expect(yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD")).toEqual(delta([]));

            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a", 61) }));
            expect(yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD")).toEqual(delta(["@beep/a"]));

            yield* fs.writeFileString(baselinePath, "{ not jsonc");
            expect(yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD")).toEqual(O.none());

            // The diff anchors on the merge base, not the base ref's tip: rows
            // that `main` changed after the branch diverged are not attributed
            // to the branch.
            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a") }));
            yield* runGit(repoRoot, ["checkout", "-q", "-b", "trunk"]);
            yield* runGit(repoRoot, ["checkout", "-q", "-b", "feature"]);
            yield* runGit(repoRoot, ["checkout", "-q", "trunk"]);
            yield* writeBaseline(
              withRows({
                "@beep/a": coveragePackageBaseline("packages/a"),
                "@beep/z": coveragePackageBaseline("packages/z"),
              })
            );
            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "trunk adds z"]);
            yield* runGit(repoRoot, ["checkout", "-q", "feature"]);
            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a", 61) }));
            expect(yield* coverageBaselineRowDeltaFromBase(repoRoot, "trunk")).toEqual(delta(["@beep/a"]));
          })
        )
      ));

    it("pins comparison reads to TURBO_SCM_BASE instead of the branch baseline", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              S.encodeEffect(CoverageRegressionBaseline)(document).pipe(
                Effect.flatMap((encoded) => fs.writeFileString(baselinePath, encodeJson(encoded)))
              );

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "coverage-base@example.test"]);
            yield* runGit(repoRoot, ["config", "user.name", "Coverage Base Test"]);
            yield* writeBaseline(
              CoverageRegressionBaseline.make({
                ...coverageRegressionBaseline,
                generated_at: "base",
                packages: {
                  "@beep/a": CoveragePackageBaseline.make({
                    ...coveragePackageBaseline("packages/a", 80),
                    files: {
                      "packages/a/src/Deleted.ts": coverageFileBaseline(90, 1),
                      "packages/a/src/Existing.ts": coverageFileBaseline(80, 1),
                    },
                  }),
                },
              })
            );
            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "baseline"]);
            yield* writeBaseline(
              CoverageRegressionBaseline.make({
                ...coverageRegressionBaseline,
                generated_at: "branch-relaxation",
                packages: {
                  "@beep/a": CoveragePackageBaseline.make({
                    ...coveragePackageBaseline("packages/a", 40),
                    files: {
                      "packages/a/src/Existing.ts": coverageFileBaseline(40, 10),
                      "packages/a/src/New.ts": coverageFileBaseline(65, 3),
                    },
                  }),
                },
              })
            );

            const selected = yield* readCoverageComparisonBaselineForTesting(repoRoot).pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "HEAD" })
              )
            );
            expect(selected.generated_at).toBe("base");
            expect(selected.packages["@beep/a"]?.lines).toBe(80);
            expect(selected.packages["@beep/a"]?.files["packages/a/src/Deleted.ts"]).toBeUndefined();
            expect(selected.packages["@beep/a"]?.files["packages/a/src/Existing.ts"]?.lines).toBe(80);
            expect(selected.packages["@beep/a"]?.files["packages/a/src/New.ts"]?.lines).toBe(65);
          })
        )
      ));

    it("reads the workspace baseline when TURBO_SCM_BASE is absent", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* S.encodeEffect(CoverageRegressionBaseline)(
              CoverageRegressionBaseline.make({ ...coverageRegressionBaseline, generated_at: "workspace" })
            ).pipe(Effect.flatMap((encoded) => fs.writeFileString(baselinePath, encodeJson(encoded))));

            const selected = yield* readCoverageComparisonBaselineForTesting(repoRoot).pipe(
              Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
            );
            expect(selected.generated_at).toBe("workspace");
          })
        )
      ));

    it("fails clearly when the configured comparison baseline cannot be read", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* S.encodeEffect(CoverageRegressionBaseline)(coverageRegressionBaseline).pipe(
              Effect.flatMap((encoded) => fs.writeFileString(baselinePath, encodeJson(encoded)))
            );
            yield* runGit(repoRoot, ["init"]);

            const failure = yield* readCoverageComparisonBaselineForTesting(repoRoot).pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "refs/heads/missing" })
              ),
              Effect.flip
            );

            expect(failure.message).toContain("Failed to read the coverage comparison baseline");
          })
        )
      ));

    it("resolves an affected run from a dirty row-only baseline edit against the workspace", () =>
      Effect.runPromise(
        withTempRepo(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              S.encodeEffect(CoverageRegressionBaseline)(document).pipe(
                Effect.flatMap((encoded) => fs.writeFileString(baselinePath, encodeJson(encoded)))
              );

            yield* fs.makeDirectory(path.join(repoRoot, "packages/existing/src"), { recursive: true });
            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* fs.writeFileString(
              path.join(repoRoot, "package.json"),
              encodeJson({ name: "@beep/test-root", private: true, workspaces: ["packages/*"] })
            );
            yield* fs.writeFileString(
              path.join(repoRoot, "packages/existing/package.json"),
              encodeJson({ name: "@beep/existing", private: true, scripts: { coverage: "vitest" } })
            );
            yield* fs.writeFileString(path.join(repoRoot, "packages/existing/src/Index.ts"), "export const v = 1;\n");
            yield* writeBaseline(
              withRows({
                "@beep/existing": coveragePackageBaseline("packages/existing"),
                "@beep/gone": coveragePackageBaseline("packages/gone"),
              })
            );
            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "coverage-affected@example.test"]);
            yield* runGit(repoRoot, ["config", "user.name", "Coverage Affected Test"]);
            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "seed"]);

            // One present row changes and the vanished package's row is dropped:
            // the affected resolver must plan from those rows without a full run.
            yield* writeBaseline(withRows({ "@beep/existing": coveragePackageBaseline("packages/existing", 61) }));
            const exit = yield* Effect.exit(
              validateCoverageTaskArgsForTesting(repoRoot, ["--affected"]).pipe(
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "HEAD" })
                )
              )
            );
            expect(Exit.isSuccess(exit)).toBe(true);
          })
        )
      ));

    it("selects the packages named by a row-only baseline edit instead of the full workspace", () => {
      const owners = [
        CoverageScopeOwner.make({ packageName: "@beep/a", packagePath: "packages/a", hasCoverage: true }),
        CoverageScopeOwner.make({ packageName: "@beep/b", packagePath: "packages/b", hasCoverage: false }),
        CoverageScopeOwner.make({
          packageName: "@beep/c",
          packagePath: "packages/c",
          hasCoverage: true,
          workspaceDependencies: ["@beep/a"],
        }),
      ];
      const baseline = "standards/coverage.regression-baseline.jsonc";

      const delta = (present: ReadonlyArray<string>, removed: ReadonlyArray<string> = []) =>
        O.some(CoverageBaselineRowDelta.make({ present, removed }));

      expect(planCoverageAffectedScope(owners, [baseline])).toMatchObject({ _tag: "full" });
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], O.none())).toMatchObject({ _tag: "full" });
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta([]))).toEqual({ _tag: "noop" });
      // A row edit measures its package but does not widen to dependents: no code changed.
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta(["@beep/a"]))).toEqual({
        _tag: "selected",
        packageNames: ["@beep/a"],
        dependentPackageNames: [],
      });
      // A present row must name a measurable package: an unknown name is a typo
      // that main's unscoped run would otherwise fail as a missing summary.
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta(["@beep/typo"]))).toEqual({
        _tag: "full",
        reasons: [`${baseline}: row for @beep/typo names no workspace package`],
      });
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta(["@beep/b"]))).toEqual({
        _tag: "full",
        reasons: [`${baseline}: row for @beep/b names a package that cannot be measured`],
      });
      // A removed row for a package that left the workspace is pruned by the
      // writer; a removed row for a package that still exists is re-measured.
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta([], ["@beep/gone"]))).toEqual({
        _tag: "noop",
      });
      expect(planCoverageAffectedScopeWithBaseline(owners, [baseline], delta([], ["@beep/c"]))).toEqual({
        _tag: "selected",
        packageNames: ["@beep/c"],
        dependentPackageNames: [],
      });
      // Combined with a code change the usual rules still apply to the other paths.
      expect(
        planCoverageAffectedScopeWithBaseline(owners, [baseline, "packages/a/src/A.ts"], delta(["@beep/c"]))
      ).toEqual({ _tag: "selected", packageNames: ["@beep/a", "@beep/c"], dependentPackageNames: [] });
      expect(
        planCoverageAffectedScopeWithBaseline(owners, [baseline, "package.json"], delta(["@beep/a"]))
      ).toMatchObject({ _tag: "full" });
    });

    it("treats standards documentation as coverage-inert but keeps policy inputs global", () => {
      const owners = [
        CoverageScopeOwner.make({ packageName: "@beep/a", packagePath: "packages/a", hasCoverage: true }),
      ];

      expect(planCoverageAffectedScope(owners, ["standards/architecture/DECISIONS.md"])).toEqual({ _tag: "noop" });
      expect(planCoverageAffectedScope(owners, ["standards/ARCHITECTURE.md", "packages/a/src/A.ts"])).toEqual({
        _tag: "selected",
        packageNames: ["@beep/a"],
        dependentPackageNames: [],
      });
      expect(planCoverageAffectedScope(owners, ["standards/knip.regression-baseline.jsonc"])).toMatchObject({
        _tag: "full",
      });
    });

    it("prints the scoped regeneration command for exactly the regressed packages", () => {
      const baseline = withRows({
        "@beep/a": coveragePackageBaseline("packages/a", 50),
        "@beep/b": coveragePackageBaseline("packages/b", 50),
        "@beep/ok": coveragePackageBaseline("packages/ok", 50),
      });
      // A drop with more uncovered units is a regression; a drop with the same
      // uncovered count reads as deleted covered code and is not.
      const regressed = (path: string) =>
        CoveragePackageBaseline.make({ path, ...coveragePercentages(40), uncovered: coverageUncovered(6), files: {} });
      const result = compareCoverageRegressionSnapshotsForTesting(
        baseline,
        [
          { packageName: "@beep/b", baseline: regressed("packages/b") },
          { packageName: "@beep/a", baseline: regressed("packages/a") },
          { packageName: "@beep/ok", baseline: coveragePackageBaseline("packages/ok", 50) },
        ],
        false
      );

      expect(coverageScopedBaselineWriteCommand(["@beep/md", "@beep/pandoc-ast"])).toBe(
        "bun run coverage -- --filter=@beep/md --filter=@beep/pandoc-ast --write-baseline"
      );
      const lines = renderCoverageRemediation(result);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain("[coverage-ratchet] remediation:");
      expect(lines[1]).toBe("  bun run coverage -- --filter=@beep/a --filter=@beep/b --write-baseline");
      expect(lines[2]).toContain("never run bun run coverage:baseline:write for a per-package drop");

      // A tier-minimum breach is not a floor the writer can move: no write command.
      const tiered = CoverageRegressionBaseline.make({ ...baseline, minimum: coveragePercentages(60) });
      const belowTier = renderCoverageRemediation(
        compareCoverageRegressionSnapshotsForTesting(
          tiered,
          [{ packageName: "@beep/ok", baseline: coveragePackageBaseline("packages/ok", 50) }],
          false
        )
      );
      expect(belowTier).toHaveLength(1);
      expect(belowTier[0]).toContain("[coverage-minimum] remediation: @beep/ok sit below the repository tier");
      expect(belowTier[0]).not.toContain("--write-baseline");
      expect(
        renderCoverageRemediation(
          compareCoverageRegressionSnapshotsForTesting(
            baseline,
            [{ packageName: "@beep/ok", baseline: coveragePackageBaseline("packages/ok", 50) }],
            false
          )
        )
      ).toEqual([]);
    });
  });

  it("selects repo-cli for tracked goal artifacts consumed by its tests", () => {
    const owners = [
      CoverageScopeOwner.make({
        packageName: "@beep/repo-cli",
        packagePath: "packages/tooling/tool/cli",
        hasCoverage: true,
      }),
    ];

    expect(
      planCoverageAffectedScope(owners, [
        "goals/fallow-quality-enforcement/research/feature-matrix.jsonc",
        "goals/speed-loop/ops/runner-burst/main.tf",
      ])
    ).toEqual({ _tag: "selected", packageNames: ["@beep/repo-cli"], dependentPackageNames: [] });
  });

  it("collects both sides of a committed cross-package rename", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = process.cwd();
          const sourcePath = path.join(repoRoot, "packages/a/test/moved.test.ts");
          const destinationPath = path.join(repoRoot, "packages/b/test/moved.test.ts");

          yield* runGit(repoRoot, ["init"]);
          yield* runGit(repoRoot, ["config", "user.email", "coverage-scope@example.test"]);
          yield* runGit(repoRoot, ["config", "user.name", "Coverage Scope Test"]);
          yield* fs.makeDirectory(path.dirname(sourcePath), { recursive: true });
          yield* fs.writeFileString(sourcePath, "export const moved = true;\n");
          yield* runGit(repoRoot, ["add", "--all"]);
          yield* runGit(repoRoot, ["commit", "-m", "initial"]);
          yield* runGit(repoRoot, ["tag", "coverage-base"]);
          yield* fs.makeDirectory(path.dirname(destinationPath), { recursive: true });
          yield* fs.rename(sourcePath, destinationPath);
          yield* runGit(repoRoot, ["add", "--all"]);
          yield* runGit(repoRoot, ["commit", "-m", "move fixture"]);

          const changedFiles = yield* collectCoverageChangedFilesForTesting(repoRoot, "coverage-base", "HEAD");
          expect(changedFiles).toEqual(["packages/a/test/moved.test.ts", "packages/b/test/moved.test.ts"]);
        })
      )
    ));

  it("falls back to full coverage for global, unknown, manifest, or shared test-kit inputs", () => {
    const owners = [
      CoverageScopeOwner.make({
        packageName: "@beep/a",
        packagePath: "packages/a",
        hasCoverage: false,
      }),
      CoverageScopeOwner.make({
        packageName: "@beep/b",
        packagePath: "packages/b",
        hasCoverage: true,
      }),
    ];

    expect(planCoverageAffectedScope(owners, ["package.json"])).toMatchObject({ _tag: "full" });
    expect(
      planCoverageAffectedScope(owners, ["packages/tooling/tool/cli/src/commands/Quality/Tasks.ts"])
    ).toMatchObject({ _tag: "full" });
    expect(planCoverageAffectedScope(owners, ["scripts/coverage-helper.ts"])).toMatchObject({ _tag: "full" });
    expect(planCoverageAffectedScope(owners, ["packages/a/package.json"])).toMatchObject({ _tag: "full" });
    expect(planCoverageAffectedScope(owners, ["packages/b/package.json"])).toMatchObject({ _tag: "full" });
    expect(planCoverageAffectedScope(owners, ["packages/tooling/test-kit/test-utils/src/TestClock.ts"])).toMatchObject({
      _tag: "full",
    });
    expect(
      planCoverageAffectedScope(owners, [
        "packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts",
      ])
    ).toMatchObject({ _tag: "full" });
    expect(changedCoverageOwners(owners, ["package.json", "packages/b/package.json"])).toEqual(["@beep/b"]);
  });

  it("skips affected coverage for docs-only and packages without a coverage task", () => {
    const owners = [
      CoverageScopeOwner.make({
        packageName: "@beep/a",
        packagePath: "packages/a",
        hasCoverage: false,
      }),
    ];

    expect(planCoverageAffectedScope(owners, ["goals/demo/PLAN.md", "packages/a/src/A.ts"])).toEqual({
      _tag: "noop",
    });
  });

  it("assigns every full-run coverage owner to exactly one stable weighted shard", () => {
    const packageNames = [
      "@beep/repo-cli",
      "@beep/repo-utils",
      "@beep/lexical-schema",
      "@beep/professional-desktop",
      "@beep/a",
      "@beep/b",
    ];
    const shards = planCoverageFullShards(packageNames, 3);

    expect(A.length(shards)).toBe(3);
    expect(
      pipe(
        shards,
        A.flatMap((shard) => shard.packageNames),
        A.sort(Order.String)
      )
    ).toEqual(A.sort(packageNames, Order.String));
    expect(planCoverageFullShards(packageNames, 3)).toEqual(shards);
    expect(A.some(shards, (shard) => A.contains(shard.packageNames, "@beep/repo-cli"))).toBe(true);
  });

  it("isolates the two live long poles in the calibrated ten-shard plan", () => {
    const shards = planCoverageFullShards(
      [
        "@beep/db-admin",
        "@beep/dock",
        "@beep/documents-server",
        "@beep/editor",
        "@beep/epistemic-server",
        "@beep/epistemic-use-cases",
        "@beep/law-practice-server",
        "@beep/lexical-schema",
        "@beep/lint-rules",
        "@beep/nlp",
        "@beep/nlp-processing",
        "@beep/observability",
        "@beep/ontology-client",
        "@beep/professional-desktop",
        "@beep/repo-ai-metrics",
        "@beep/repo-cli",
        "@beep/repo-utils",
        "@beep/schema",
        "@beep/test-utils",
        "@beep/wink",
      ],
      10
    );

    expect(shards[0]?.packageNames).toEqual(["@beep/repo-cli"]);
    expect(shards[1]?.packageNames).toEqual(["@beep/repo-utils"]);
    expect(A.every(A.drop(shards, 2), (shard) => shard.weightSeconds < 300)).toBe(true);
  });

  it("preserves caller Turbo flags while overriding full-coverage shard controls", () =>
    withEnvVar("CI", "true", () => {
      const steps = coverageFullStepsForTesting(
        "/repo",
        [
          "@beep/repo-cli",
          "@beep/repo-utils",
          "@beep/a",
          "@beep/b",
          "@beep/c",
          "@beep/d",
          "@beep/e",
          "@beep/f",
          "@beep/g",
          "@beep/h",
        ],
        ["--concurrency", "9", "--force", "--remote-only", "--output-logs=errors-only", "--summarize"]
      );

      expect(A.map(steps, (step) => step.label)).toEqual([
        "coverage:prebuild",
        "coverage:shard-1",
        "coverage:shard-2",
        "coverage:shard-3",
        "coverage:shard-4",
        "coverage:shard-5",
        "coverage:shard-6",
        "coverage:shard-7",
        "coverage:shard-8",
        "coverage:shard-9",
        "coverage:shard-10",
      ]);
      expect(steps[0]?.args).toEqual([
        "turbo",
        "run",
        "build",
        "--concurrency=4",
        "--summarize",
        LABS_EXCLUDE_FILTER,
        "--force",
        "--remote-only",
        "--output-logs=errors-only",
      ]);
      const shardSteps = A.drop(steps, 1);
      for (const step of shardSteps) {
        expect(step.args).toContain("--concurrency=1");
        expect(step.args).toContain("--summarize");
        expect(step.args).toContain("--force");
        expect(step.args).toContain("--remote-only");
        expect(step.args).toContain("--output-logs=errors-only");
        expect(A.takeRight(step.args, 2)).toEqual([
          "--fileParallelism=true",
          A.some(step.args, (arg) => arg === "--filter=@beep/repo-cli") ? "--maxWorkers=2" : "--maxWorkers=1",
        ]);
        expect(step.args).not.toContain("--concurrency=4");
        expect(step.args).not.toContain("9");
      }
      expect(A.filter(shardSteps, (step) => A.contains(step.args, "--maxWorkers=2"))).toHaveLength(1);
      expect(A.filter(shardSteps, (step) => A.contains(step.args, "--maxWorkers=1"))).toHaveLength(9);
    }));

  it("uses the hosted shard worker shape for full baseline regeneration", () => {
    const steps = coverageFullStepsForTesting(
      "/repo",
      [
        "@beep/repo-cli",
        "@beep/repo-utils",
        "@beep/a",
        "@beep/b",
        "@beep/c",
        "@beep/d",
        "@beep/e",
        "@beep/f",
        "@beep/g",
      ],
      ["--write-baseline", "--force"]
    );
    const shardSteps = A.drop(steps, 1);

    expect(steps[0]).not.toHaveProperty("env.VITEST_COVERAGE_REPORT_ONLY");
    for (const step of shardSteps) {
      expect(step.args).not.toContain("--write-baseline");
      expect(step.env).toMatchObject({ VITEST_COVERAGE_REPORT_ONLY: "1" });
    }
    // Nine owners fill nine of the ten planned shards; the empty tenth is
    // dropped rather than dispatched as a filter-less workspace-wide run.
    expect(shardSteps).toHaveLength(9);
    expect(A.filter(shardSteps, (step) => A.contains(step.args, "--maxWorkers=2"))).toHaveLength(1);
    expect(A.filter(shardSteps, (step) => A.contains(step.args, "--maxWorkers=1"))).toHaveLength(8);
  });

  it("separates a percentage drop caused by deleting covered code from one caused by losing coverage", () => {
    // 50% as 50/100 covered, so 50 lines uncovered.
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(50),
          files: {},
        }),
      },
    });
    const compare = (actual: CoveragePackageBaseline) =>
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures;

    // Deleted 10 covered lines: 40/90 = 44.4%, a real drop, but the 50
    // uncovered lines are untouched. Nothing stopped being tested.
    expect(
      compare(
        CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(44.44),
          uncovered: coverageUncovered(50),
          files: {},
        })
      )
    ).toEqual([]);

    // Added 10 untested lines: 50/110 = 45.5%, and uncovered rose to 60.
    expect(
      compare(
        CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(45.45),
          uncovered: coverageUncovered(60),
          files: {},
        })
      )
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({ packageName: "@beep/existing", metric })
      )
    );
  });

  it("detects coverage lost in one file when deleting unrelated uncovered code offsets package totals", () => {
    const coveredFilePath = "packages/existing/src/Covered.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(66.67),
          uncovered: coverageUncovered(5),
          files: {
            [coveredFilePath]: coverageFileBaseline(100, 0),
            "packages/existing/src/Uncovered.ts": coverageFileBaseline(0, 5),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(50),
      uncovered: coverageUncovered(5),
      files: {
        [coveredFilePath]: coverageFileBaseline(50, 5),
      },
    });
    const failures = compareCoverageRegressionSnapshotsForTesting(
      before,
      [{ packageName: "@beep/existing", baseline: actual }],
      false
    ).failures;

    expect(failures).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({ packageName: "@beep/existing", filePath: O.some(coveredFilePath), metric })
      )
    );
  });

  it("allows a surviving file percentage drop caused by deleting covered code", () => {
    const filePath = "packages/existing/src/Offset.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(60),
          uncovered: coverageUncovered(4),
          files: { [filePath]: coverageFileBaseline(60, 4) },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(55.56),
      uncovered: coverageUncovered(4),
      files: { [filePath]: coverageFileBaseline(55.56, 4) },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual([]);
  });

  it("detects a surviving file's coverage loss when uncovered counts rise", () => {
    const filePath = "packages/existing/src/Surviving.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(50),
          files: { [filePath]: coverageFileBaseline(50, 50) },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(44.44),
      uncovered: coverageUncovered(51),
      files: { [filePath]: coverageFileBaseline(44.44, 51) },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({ packageName: "@beep/existing", filePath: O.some(filePath), metric })
      )
    );
  });

  it("fails closed when a rename or new path accompanies an offset package drop", () => {
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(60),
          uncovered: coverageUncovered(4),
          files: { "packages/existing/src/Before.ts": coverageFileBaseline(60, 4) },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(55.56),
      uncovered: coverageUncovered(4),
      files: { "packages/existing/src/After.ts": coverageFileBaseline(55.56, 4) },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({
          packageName: "@beep/existing",
          filePath: O.some("packages/existing/src/Before.ts"),
          metric,
        })
      )
    );
  });

  it("fails closed when a covered path disappears behind a flat-total new-path offset", () => {
    const disappearedPath = "packages/existing/src/A.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(10),
          files: {
            [disappearedPath]: coverageFileBaseline(100, 0),
            "packages/existing/src/B.ts": coverageFileBaseline(0, 10),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(50),
      uncovered: coverageUncovered(10),
      files: {
        "packages/existing/src/B.ts": coverageFileBaseline(0, 5),
        "packages/existing/src/C.ts": coverageFileBaseline(50, 5),
        "packages/existing/src/D.ts": coverageFileBaseline(100, 0),
      },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({ packageName: "@beep/existing", filePath: O.some(disappearedPath), metric })
      )
    );
  });

  it("fails closed when a new uncovered path is offset behind flat package totals", () => {
    const newPath = "packages/existing/src/NewUntested.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(10),
          files: {
            "packages/existing/src/Existing.ts": coverageFileBaseline(50, 10),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(50),
      uncovered: coverageUncovered(10),
      files: {
        "packages/existing/src/Existing.ts": coverageFileBaseline(100, 0),
        [newPath]: coverageFileBaseline(0, 10),
      },
    });

    const failures = compareCoverageRegressionSnapshotsForTesting(
      before,
      [{ packageName: "@beep/existing", baseline: actual }],
      false
    ).failures;

    expect(failures).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({
          _tag: "new-uncovered-file",
          packageName: "@beep/existing",
          filePath: O.some(newPath),
          metric,
          uncovered: 10,
        })
      )
    );
    A.forEach(failures, (failure) => assert.notProperty(failure, "baseline"));
    assert.include(A.join(renderCoverageFailuresForTesting(failures), "\n"), "no baseline file identity");
  });

  it("allows a fully covered file addition when existing files do not regress", () => {
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(10),
          files: {
            "packages/existing/src/Existing.ts": coverageFileBaseline(50, 10),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(75),
      uncovered: coverageUncovered(10),
      files: {
        "packages/existing/src/Existing.ts": coverageFileBaseline(50, 10),
        "packages/existing/src/NewCovered.ts": coverageFileBaseline(100, 0),
      },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual([]);
  });

  it("fails closed when a covered baseline path disappears despite improving package totals", () => {
    const disappearedPath = "packages/existing/src/Covered.ts";
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(10),
          files: {
            [disappearedPath]: coverageFileBaseline(100, 0),
            "packages/existing/src/Uncovered.ts": coverageFileBaseline(0, 10),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(75),
      uncovered: coverageUncovered(5),
      files: {
        "packages/existing/src/Replacement.ts": coverageFileBaseline(100, 0),
        "packages/existing/src/Uncovered.ts": coverageFileBaseline(0, 5),
      },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({ packageName: "@beep/existing", filePath: O.some(disappearedPath), metric })
      )
    );
  });

  it("fails closed when a removed path and package drop could hide offset coverage loss", () => {
    const before = CoverageRegressionBaseline.make({
      ...coverageRegressionBaseline,
      packages: {
        "@beep/existing": CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(10),
          files: {
            "packages/existing/src/Covered.ts": coverageFileBaseline(100, 0),
            "packages/existing/src/Uncovered.ts": coverageFileBaseline(0, 10),
          },
        }),
      },
    });
    const actual = CoveragePackageBaseline.make({
      path: "packages/existing",
      ...coveragePercentages(0),
      uncovered: coverageUncovered(10),
      files: {
        "packages/existing/src/Uncovered.ts": coverageFileBaseline(0, 10),
      },
    });

    expect(
      compareCoverageRegressionSnapshotsForTesting(before, [{ packageName: "@beep/existing", baseline: actual }], false)
        .failures
    ).toEqual(
      A.map(A.sort(["lines", "statements", "branches", "functions"], Order.String), (metric) =>
        expect.objectContaining({
          packageName: "@beep/existing",
          filePath: O.some("packages/existing/src/Covered.ts"),
          metric,
        })
      )
    );
  });

  it("keeps full-run reasons diagnostic while adopting only changed owners", () => {
    const committedHeld = CoveragePackageBaseline.make({
      path: "packages/held",
      ...coveragePercentages(61),
      uncovered: coverageUncovered(7),
      files: {
        "packages/held/src/Index.ts": coverageFileBaseline(61, 7),
      },
    });
    const measuredHeld = CoveragePackageBaseline.make({
      path: "packages/held",
      ...coveragePercentages(93),
      uncovered: coverageUncovered(1),
      files: {
        "packages/held/src/Index.ts": coverageFileBaseline(93, 1),
      },
    });
    const changeSet = CoverageBaselineChangeSet.make({
      baseDescription: "origin/main merge-base a1b2c3d",
      packageNames: ["@beep/changed"],
      fullReasons: ["vitest.config.ts: global coverage input changed"],
    });
    const plan = planCoverageBaselineWrite(
      {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/held": committedHeld,
      },
      [
        { packageName: "@beep/changed", baseline: coveragePackageBaseline("packages/changed", 80) },
        { packageName: "@beep/held", baseline: measuredHeld },
      ],
      changeSet,
      { replaceAll: false }
    );

    expect(plan.dispositions).toEqual({
      "@beep/changed": "replaced",
      "@beep/held": "held",
    });
    expect(plan.packages["@beep/changed"]?.lines).toBe(80);
    expect(plan.packages["@beep/held"]).toEqual(committedHeld);
    expect(plan.changeSet.fullReasons).toEqual(["vitest.config.ts: global coverage input changed"]);
    expect(coverageBaselineWriteSummary(plan, false)).toBe(
      "[coverage-ratchet] wrote standards/coverage.regression-baseline.jsonc: replaced 1 changed package(s), added 0, held 1 unchanged package(s) at committed rows, pruned 0 (base: origin/main merge-base a1b2c3d) — global coverage inputs changed (vitest.config.ts: global coverage input changed); pass --replace-all if every floor should be re-measured"
    );
  });

  it("splits selected baseline rows into replaced, held, added, and pruned dispositions", () => {
    const committedHeld = CoveragePackageBaseline.make({
      path: "packages/held",
      ...coveragePercentages(61),
      uncovered: coverageUncovered(7),
      files: {
        "packages/held/src/Index.ts": coverageFileBaseline(61, 7),
      },
    });
    const measuredHeld = CoveragePackageBaseline.make({
      path: "packages/held",
      ...coveragePercentages(93),
      uncovered: coverageUncovered(1),
      files: {
        "packages/held/src/Index.ts": coverageFileBaseline(93, 1),
        "packages/held/src/LocalOnly.ts": coverageFileBaseline(100, 0),
      },
    });
    const plan = planCoverageBaselineWrite(
      {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/held": committedHeld,
        "@beep/removed": coveragePackageBaseline("packages/removed", 70),
      },
      [
        { packageName: "@beep/changed", baseline: coveragePackageBaseline("packages/changed", 80) },
        { packageName: "@beep/held", baseline: measuredHeld },
        { packageName: "@beep/new", baseline: coveragePackageBaseline("packages/new", 90) },
      ],
      CoverageBaselineChangeSet.make({
        baseDescription: "origin/main merge-base a1b2c3d",
        packageNames: ["@beep/changed"],
        fullReasons: [],
      }),
      { replaceAll: false }
    );

    expect(plan.dispositions).toEqual({
      "@beep/changed": "replaced",
      "@beep/held": "held",
      "@beep/new": "added",
      "@beep/removed": "pruned",
    });
    expect(plan.packages["@beep/changed"]?.lines).toBe(80);
    expect(plan.packages["@beep/held"]).toEqual(committedHeld);
    expect(plan.packages["@beep/held"]?.uncovered).toEqual(coverageUncovered(7));
    expect(plan.packages["@beep/held"]?.files).toEqual(committedHeld.files);
    expect(plan.packages["@beep/new"]?.lines).toBe(90);
    expect(plan.packages).not.toHaveProperty("@beep/removed");
  });

  it("holds every existing measured row for a no-op baseline change set", () => {
    const plan = planCoverageBaselineWrite(
      {
        "@beep/a": coveragePackageBaseline("packages/a", 40),
        "@beep/b": coveragePackageBaseline("packages/b", 50),
      },
      [
        { packageName: "@beep/a", baseline: coveragePackageBaseline("packages/a", 80) },
        { packageName: "@beep/b", baseline: coveragePackageBaseline("packages/b", 90) },
      ],
      CoverageBaselineChangeSet.make({
        baseDescription: "dirty worktree only",
        packageNames: [],
        fullReasons: [],
      }),
      { replaceAll: false }
    );

    expect(plan.dispositions).toEqual({ "@beep/a": "held", "@beep/b": "held" });
    expect(plan.packages["@beep/a"]?.lines).toBe(40);
    expect(plan.packages["@beep/b"]?.lines).toBe(50);
  });

  it("replaces every measured row when replace-all overrides a no-op change set", () => {
    const plan = planCoverageBaselineWrite(
      { "@beep/existing": coveragePackageBaseline("packages/existing", 50) },
      [
        { packageName: "@beep/existing", baseline: coveragePackageBaseline("packages/existing", 80) },
        { packageName: "@beep/new", baseline: coveragePackageBaseline("packages/new", 90) },
      ],
      CoverageBaselineChangeSet.make({
        baseDescription: "dirty worktree only",
        packageNames: [],
        fullReasons: [],
      }),
      { replaceAll: true }
    );

    expect(plan.dispositions).toEqual({
      "@beep/existing": "replaced",
      "@beep/new": "replaced",
    });
    expect(plan.packages["@beep/existing"]?.lines).toBe(80);
    expect(plan.packages["@beep/new"]?.lines).toBe(90);
    expect(coverageBaselineWriteSummary(plan, true)).toBe(
      "[coverage-ratchet] wrote standards/coverage.regression-baseline.jsonc: replaced all 2 package(s), pruned 0 (--replace-all; base: dirty worktree only)"
    );
  });

  it("merges a scoped snapshot over the committed packages instead of replacing them", () => {
    const merged = mergeCoverageBaselinePackagesForTesting(
      {
        "@beep/existing": coveragePackageBaseline("packages/existing", 50),
        "@beep/untouched": coveragePackageBaseline("packages/untouched", 70),
      },
      [{ packageName: "@beep/existing", baseline: coveragePackageBaseline("packages/existing", 80) }]
    );

    expect(R.keys(merged).sort()).toEqual(["@beep/existing", "@beep/untouched"]);
    expect(merged["@beep/existing"]?.lines).toBe(80);
    expect(merged["@beep/untouched"]?.lines).toBe(70);
  });

  it("names the live baseline entries an unscoped replacement would delete", () => {
    const previous = ["@beep/a", "@beep/b", "@beep/c"];

    // Unmeasured but still in the workspace: replacing would delete them.
    expect(baselineEntriesLostByReplacement(previous, ["@beep/a"], previous)).toEqual(["@beep/b", "@beep/c"]);

    // A full run loses nothing.
    expect(baselineEntriesLostByReplacement(previous, previous, previous)).toEqual([]);

    // @beep/c was deleted from the workspace, so pruning its entry is the point
    // of an unscoped regeneration, not an accident.
    expect(baselineEntriesLostByReplacement(previous, ["@beep/a", "@beep/b"], ["@beep/a", "@beep/b"])).toEqual([]);

    // Equal counts are not equal sets: swapping one package for another measures
    // the same number while still deleting @beep/c's entry.
    expect(
      baselineEntriesLostByReplacement(previous, ["@beep/a", "@beep/b", "@beep/d"], [...previous, "@beep/d"])
    ).toEqual(["@beep/c"]);

    // First write, with nothing committed yet.
    expect(baselineEntriesLostByReplacement([], ["@beep/a"], ["@beep/a"])).toEqual([]);
  });

  it("builds the integration lane command with shared SQL environment", () => {
    const step = sqlIntegrationStepForTesting("/repo", ["--filter=@beep/test-utils", "--summarize"], {
      connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
    });

    expect(step).toMatchObject({
      label: "test:integration:serial",
      command: "bunx",
      args: expectedTurboArgs("test:integration:serial", [
        "--concurrency=1",
        "--filter=@beep/test-utils",
        "--summarize",
      ]),
      cwd: "/repo",
      env: {
        BEEP_TEST_DATABASE_DRIVER: "pg-external",
        BEEP_TEST_DATABASE_ISOLATION: "schema",
        BEEP_TEST_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
      },
    });
  });

  it("plans the bounded parallel integration pass before the serial SQL pass", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["test", "--integration", "--summarize"]));

    expect(A.map(steps, (step) => step.label)).toEqual(["test:integration:parallel", "test:integration:serial"]);
    expect(steps[0]?.args).toContain("test:integration:parallel");
    expect(steps[0]?.args).toContain("--summarize");
    expect(steps[1]?.args).toEqual(expectedTurboArgs("test:integration:serial", ["--concurrency=1", "--summarize"]));
  });

  it("drops caller concurrency flags from the serial SQL pass instead of duplicating turbo's", () => {
    const steps = rootQualityStepsForTesting(
      "/repo",
      getInvocation(["test", "--integration", "--concurrency=1", "--summarize"])
    );

    expect(steps[1]?.args).toEqual(expectedTurboArgs("test:integration:serial", ["--concurrency=1", "--summarize"]));
    expect(A.filter([...(steps[1]?.args ?? [])], (arg) => arg.startsWith("--concurrency"))).toHaveLength(1);
  });

  it("requires explicit test SQL URLs over generic application defaults", () => {
    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        BEEP_TEST_DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
        DATABASE_URL: "postgres://other:secret@127.0.0.1:5432/other",
      })
    ).toEqual(O.some("postgres://test:secret@127.0.0.1:5432/test"));

    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
      })
    ).toEqual(O.none());

    expect(
      sqlIntegrationConnectionUriFromEnvForTesting({
        BEEP_TEST_DATABASE_URL: "op://beep-dev-secrets/DATABASE_URL",
        DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
        DATABASE_URL_UNPOOLED: "postgres://test:secret@127.0.0.1:5432/test",
      })
    ).toEqual(O.none());
  });

  it("forwards shared SQL env vars to the integration child process", () =>
    Effect.runPromise(
      withTempRepo(
        runSqlIntegrationTestLaneForTesting({
          acquireResource: Effect.acquireRelease(
            Effect.succeed({
              connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
            }),
            () => Effect.void
          ),
          args: [],
          childCommand: {
            command: "bun",
            args: [
              "-e",
              "process.exit(Bun.env.BEEP_TEST_DATABASE_URL === 'postgres://postgres:postgres@127.0.0.1:5432/postgres' && Bun.env.BEEP_TEST_DATABASE_DRIVER === 'pg-external' ? 0 : 42)",
            ],
          },
          repoRoot: process.cwd(),
        })
      )
    ));

  it("fails nonzero integration children and releases the shared SQL resource", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          let released = false;
          const exit = yield* Effect.exit(
            runSqlIntegrationTestLaneForTesting({
              acquireResource: Effect.acquireRelease(
                Effect.succeed({
                  connectionUri: "postgres://postgres:postgres@127.0.0.1:5432/postgres",
                }),
                () =>
                  Effect.sync(() => {
                    released = true;
                  })
              ),
              args: [],
              childCommand: {
                command: "bun",
                args: ["-e", "process.exit(7)"],
              },
              repoRoot: process.cwd(),
            })
          );

          expect(released).toBe(true);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskFailed);
            if (isQualityTaskFailed(failure)) {
              expect(failure.exitCode).toBe(7);
            }
          }
        })
      )
    ));

  it("runs grouped quality steps with bounded concurrency and deterministic output", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep("test:slow", "await Bun.sleep(20); console.log('slow')"),
              bunScriptStep("test:fast", "console.log('fast')"),
            ],
            2
          );

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] test:group: running 2 step(s) with concurrency 2");
          expect(logText).toContain("[beep-cli] test:slow: bun -e await Bun.sleep(20); console.log('slow')");
          expect(logText).toContain("[beep-cli] test:fast: bun -e console.log('fast')");
          expectSubstringBefore(logText, "[beep-cli] test:slow output:\nslow", "[beep-cli] test:fast output:\nfast");
        })
      )
    ));

  it("truncates retained grouped quality step output", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep(
                "test:large-output",
                "process.stdout.write('x'.repeat(300000)); console.log('tail-marker')"
              ),
            ],
            1
          );

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] output truncated after 262144 characters");
          expect(Str.length(logText)).toBeLessThan(270_000);
        })
      )
    ));

  it("aggregates grouped quality step failures in configured step order", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            runQualityTaskStepGroupForTesting(
              "test:group",
              [
                bunScriptStep("test:first", "console.log('first failed'); process.exit(7)"),
                bunScriptStep("test:second", "console.log('second failed'); process.exit(3)"),
              ],
              2
            )
          );

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first", "test:second"]);
            }
          }

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expectSubstringBefore(
            logText,
            "[beep-cli] test:first output:\nfirst failed",
            "[beep-cli] test:second output:\nsecond failed"
          );

          const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:group: failed 2 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('first failed'); process.exit(7)");
          expect(errorText).toContain("[beep-cli]   test:second: exit 3");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('second failed'); process.exit(3)");
        })
      )
    ));

  it("streams grouped quality step failures and keeps running sibling steps", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const markerPath = path.join(process.cwd(), "second-ran.txt");
          const exit = yield* Effect.exit(
            runQualityTaskStreamingStepGroupForTesting("test:stream", [
              bunScriptStep("test:first", "process.exit(7)"),
              bunScriptStep("test:second", "await Bun.write('second-ran.txt', 'yes')"),
            ])
          );

          expect(yield* fs.exists(markerPath)).toBe(true);
          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first"]);
            }
          }

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain("[beep-cli] test:stream: running 2 streaming step(s)");
          expectSubstringBefore(logText, "[beep-cli] test:first:", "[beep-cli] test:second:");

          const errorText = A.join(A.filter(yield* TestConsole.errorLines, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:stream: failed 1 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e process.exit(7)");
        })
      )
    ));

  it("quarantines distinct TS2589 tasks exposed by resumed lane runs", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const statePath = path.join(process.cwd(), "quarantine-wave.txt");
          const source = A.join(
            [
              'const statePath = "quarantine-wave.txt";',
              "const stateFile = Bun.file(statePath);",
              "const invocation = (await stateFile.exists()) ? Number(await stateFile.text()) : 0;",
              "await Bun.write(statePath, String(invocation + 1));",
              'const filter = process.argv.find((arg) => arg.startsWith("--filter="));',
              "const failTs2589 = (packageName) => {",
              "  console.error(`${packageName}:build: error TS2589: Type instantiation is excessively deep and possibly infinite.`);",
              "  console.error(`Failed:    ${packageName}#build`);",
              "  process.exit(2);",
              "};",
              'if (invocation === 0 && filter === undefined) failTs2589("@beep/xai");',
              'if (invocation === 1 && filter === "--filter=@beep/xai") process.exit(0);',
              'if (invocation === 2 && filter === undefined) failTs2589("@beep/ui");',
              'if (invocation === 3 && filter === "--filter=@beep/ui") process.exit(0);',
              "if (invocation === 4 && filter === undefined) process.exit(0);",
              "process.exit(9);",
            ],
            "\n"
          );
          const step = QualityTaskStep.make({
            label: "test:quarantine-waves",
            command: "bun",
            args: ["-e", source],
            cwd: process.cwd(),
            flakeQuarantine: "ts2589-no-location",
          });

          yield* withEnvVarEffect("CI", "false", runQualityTaskStreamingStepGroupForTesting("test:stream", [step]));

          const artifactText = yield* fs.readFileString(
            path.join(process.cwd(), FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH)
          );
          const artifact = yield* FlakeQuarantineArtifactJson.decode(artifactText);
          expect(A.map(artifact.incidents, (incident) => incident.taskId)).toEqual([
            "@beep/xai#build",
            "@beep/ui#build",
          ]);
          expect(yield* fs.readFileString(statePath)).toBe("5");

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-waves: lane rerun failed with exit 2; checking for another quarantinable task"
          );
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-waves: quarantined 2 environment-only TS2589 flake incident(s); lane rerun green"
          );
        })
      )
    ));

  it("keeps a repeated TS2589 task hard after standalone recovery", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const statePath = path.join(process.cwd(), "quarantine-repeat.txt");
          const source = A.join(
            [
              'const statePath = "quarantine-repeat.txt";',
              "const stateFile = Bun.file(statePath);",
              "const invocation = (await stateFile.exists()) ? Number(await stateFile.text()) : 0;",
              "await Bun.write(statePath, String(invocation + 1));",
              'const filter = process.argv.find((arg) => arg.startsWith("--filter="));',
              "const failTs2589 = () => {",
              '  console.error("@beep/xai:build: error TS2589: Type instantiation is excessively deep and possibly infinite.");',
              '  console.error("Failed:    @beep/xai#build");',
              "  process.exit(2);",
              "};",
              "if (invocation === 0 && filter === undefined) failTs2589();",
              'if (invocation === 1 && filter === "--filter=@beep/xai") process.exit(0);',
              "if (invocation === 2 && filter === undefined) failTs2589();",
              "process.exit(9);",
            ],
            "\n"
          );
          const step = QualityTaskStep.make({
            label: "test:quarantine-repeat",
            command: "bun",
            args: ["-e", source],
            cwd: process.cwd(),
            flakeQuarantine: "ts2589-no-location",
          });

          const exit = yield* withEnvVarEffect(
            "CI",
            "false",
            Effect.exit(runQualityTaskStreamingStepGroupForTesting("test:stream", [step]))
          );

          expect(Exit.isFailure(exit)).toBe(true);
          expect(yield* fs.readFileString(statePath)).toBe("3");
          expect(yield* fs.exists(path.join(process.cwd(), FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH))).toBe(false);

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-repeat: lane rerun repeated the flake for @beep/xai#build; keeping failure hard"
          );
        })
      )
    ));

  it("keeps running repo-wide root lint policy checks after aggregate lint fails", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const binDir = path.join(tmpDir, "bin");
          const commandLogPath = path.join(tmpDir, "quality-commands.log");
          const fakeBunxPath = path.join(binDir, "bunx");
          const fakeBunPath = path.join(binDir, "bun");

          yield* fs.makeDirectory(binDir, { recursive: true });
          yield* fs.writeFileString(
            fakeBunxPath,
            [
              "#!/usr/bin/env sh",
              "printf 'bunx %s\\n' \"$*\" >> quality-commands.log",
              'if [ "$1" = "turbo" ] && [ "$2" = "run" ] && [ "$3" = "lint" ]; then',
              "  exit 7",
              "fi",
              "exit 0",
              "",
            ].join("\n")
          );
          yield* fs.writeFileString(
            fakeBunPath,
            ["#!/usr/bin/env sh", "printf 'bun %s\\n' \"$*\" >> quality-commands.log", "exit 0", ""].join("\n")
          );
          yield* fs.chmod(fakeBunxPath, 0o755);
          yield* fs.chmod(fakeBunPath, 0o755);

          const exit = yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.exit(runQualityTask(getInvocation(["lint"])))
          );

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["lint"]);
            }
          }

          const commandLog = yield* fs.readFileString(commandLogPath);
          // The aggregate lint step and the policy steps run grouped-concurrent
          // (LINT_POLICY_STEP_CONCURRENCY), so log order between them is not
          // guaranteed — the resilience property is that every policy check
          // still executes after the aggregate lint step fails.
          expect(commandLog).toContain("bunx turbo run lint");
          expect(commandLog).toContain("bun run packages/tooling/tool/cli/src/bin.ts -- laws effect-imports --check");
          expect(commandLog).toContain("bun run packages/tooling/tool/cli/src/bin.ts -- lint roadmap-refs");
          expect(commandLog).toContain("bunx typos");

          const logText = A.join(A.filter(yield* TestConsole.logLines, isString), "\n");
          // Derived from the same plan the runtime executes (aggregate lane plus
          // every policy step), so a lint step added on another branch does not
          // break this assertion when the two land together in a merge.
          const lintStepCount = A.length(rootQualityStepsForTesting(process.cwd(), getInvocation(["lint"])));
          expect(logText).toContain(`[beep-cli] lint: running ${lintStepCount} step(s) with concurrency 3`);
        })
      )
    ));

  it("leaves lint policy subcommands on the existing command tree", () => {
    expect(O.isNone(parseQualityTaskInvocation(["lint", "circular"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "deprecated-apis"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "package-test-imports"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "policy"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["lint", "schema-first"]))).toBe(true);
  });

  it("leaves root CLI help and metadata flags on the existing command tree", () => {
    expect(O.isNone(parseQualityTaskInvocation(["lint", "--help"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["check", "-h"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["build", "--version"]))).toBe(true);
    expect(O.isNone(parseQualityTaskInvocation(["test", "--log-level=debug"]))).toBe(true);
  });

  it("delegates affected root lint only to the affected aggregate repo lint lane", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--affected", "--summarize"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", ["--affected", "--summarize"]));
  });

  it("skips repo-wide lint policy checks for explicit package filters", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["lint", "--filter=@beep/schema"]));

    expect(steps).toHaveLength(1);
    expect(steps[0]?.args).toEqual(expectedRootTurboArgs("lint", ["--filter=@beep/schema"]));
  });

  it("limits root integration test filters to script-owning workspaces", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const plainPackageDir = path.join(tmpDir, "packages", "plain");
          const integrationPackageDir = path.join(tmpDir, "apps", "integration");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: {
                packages: ["packages/*", "apps/*"],
              },
            })
          );
          yield* fs.makeDirectory(plainPackageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(plainPackageDir, "package.json"),
            encodeJson({
              name: "@beep/plain",
              private: true,
              scripts: {
                test: "vitest",
              },
            })
          );
          yield* fs.makeDirectory(integrationPackageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(integrationPackageDir, "package.json"),
            encodeJson({
              name: "@beep/integration",
              private: true,
              scripts: {
                "test:integration": "vitest run test/integration",
              },
            })
          );

          const integrationFilters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          expect(integrationFilters).toEqual(["--filter=@beep/integration"]);
        })
      )
    ));

  it("treats unsupported package tasks as explicit no-ops", () =>
    Effect.runPromise(
      withTempRepo(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const packageDir = path.join(tmpDir, "packages", "empty");

          yield* fs.writeFileString(
            path.join(tmpDir, "package.json"),
            encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/*"],
            })
          );
          yield* fs.makeDirectory(packageDir, { recursive: true });
          yield* fs.writeFileString(
            path.join(packageDir, "package.json"),
            encodeJson({
              name: "@beep/empty",
              private: true,
              scripts: {
                lint: "beep-cli lint",
              },
            })
          );

          process.cwd = () => packageDir;
          yield* runQualityTask(getInvocation(["lint"]));

          const lines = yield* TestConsole.logLines;
          expect(lines).toEqual(["[beep-cli] @beep/empty lint: no-op"]);
          expect(process.exitCode ?? 0).toBe(0);
        })
      )
    ));
});

// lab-apps-lifecycle P2 (ratified row 9): the labs exclude filter is injected
// at the Tasks.ts turboRunArgs funnel AFTER owned-arg parsing, so it must
// appear in every excluded task's final argv without demoting repo-wide steps,
// flipping coverage into its scoped shape, or leaking past a `--` passthrough.
describe("labs turbo exclusion", () => {
  const argsOf = (step: QualityTaskStep | undefined): ReadonlyArray<string> => [...(step?.args ?? [])];

  const expectEndsWithLabsExclude = (step: QualityTaskStep | undefined): void => {
    expect(A.takeRight(argsOf(step), 1)).toEqual([LABS_EXCLUDE_FILTER]);
  };

  const argIndexOf = (args: ReadonlyArray<string>, target: string): number =>
    pipe(
      A.findFirstIndex(args, (arg) => arg === target),
      O.getOrElse(() => -1)
    );

  it("ends check argvs with the labs exclude while repo-wide tsgo steps survive", () => {
    for (const argv of [["check", "--affected", "--summarize"], ["check"]]) {
      const steps = rootQualityStepsForTesting("/repo", getInvocation(argv));
      expect(A.map(steps, (step) => step.label)).toEqual([
        "check",
        "check:tsgo:rules",
        "check:tsgo:tests",
        "check:tsgo:smoke",
      ]);
      expectEndsWithLabsExclude(steps[0]);
    }
  });

  it("ends lint, unit, integration, and scoped coverage argvs with the labs exclude", () => {
    expectEndsWithLabsExclude(
      rootQualityStepsForTesting("/repo", getInvocation(["lint", "--affected", "--summarize"]))[0]
    );
    expectEndsWithLabsExclude(rootQualityStepsForTesting("/repo", getInvocation(["lint"]))[0]);

    expectEndsWithLabsExclude(rootQualityStepsForTesting("/repo", getInvocation(["test", "--unit"]))[0]);

    const integration = rootQualityStepsForTesting("/repo", getInvocation(["test", "--integration"]));
    expect(A.map(integration, (step) => step.label)).toEqual(["test:integration:parallel", "test:integration:serial"]);
    expectEndsWithLabsExclude(integration[0]);
    expectEndsWithLabsExclude(integration[1]);

    const coverage = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", undefined, () => rootQualityStepsForTesting("/repo", getInvocation(["coverage"])))
    );
    expectEndsWithLabsExclude(coverage[0]);
  });

  it("composes an explicit user filter with the labs exclude while still dropping repo-wide steps", () => {
    const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--filter=@beep/schema"]));
    expect(steps).toHaveLength(1);
    expect(argsOf(steps[0])).toContain("--filter=@beep/schema");
    expectEndsWithLabsExclude(steps[0]);
  });

  it("keeps the labs exclude ahead of the coverage vitest passthrough and inside every shard", () => {
    const baseline = withEnvVar("BEEP_FC_SEED", undefined, () =>
      withEnvVar("NODE_OPTIONS", undefined, () =>
        rootQualityStepsForTesting("/repo", getInvocation(["coverage", "--", "--write-baseline", "--concurrency=1"]))
      )
    );
    const baselineArgs = argsOf(baseline[0]);
    const filterIndex = argIndexOf(baselineArgs, LABS_EXCLUDE_FILTER);
    const delimiterIndex = argIndexOf(baselineArgs, "--");
    expect(filterIndex).toBeGreaterThan(-1);
    expect(delimiterIndex).toBeGreaterThan(filterIndex);

    const fullSteps = coverageFullStepsForTesting(
      "/repo",
      [
        "@beep/repo-cli",
        "@beep/repo-utils",
        "@beep/a",
        "@beep/b",
        "@beep/c",
        "@beep/d",
        "@beep/e",
        "@beep/f",
        "@beep/g",
        "@beep/h",
      ],
      []
    );
    expect(argsOf(fullSteps[0])).toContain(LABS_EXCLUDE_FILTER);
    for (const step of A.drop(fullSteps, 1)) {
      const shardArgs = argsOf(step);
      const shardFilterIndex = argIndexOf(shardArgs, LABS_EXCLUDE_FILTER);
      const shardDelimiterIndex = argIndexOf(shardArgs, "--");
      expect(shardFilterIndex).toBeGreaterThan(-1);
      expect(shardDelimiterIndex).toBeGreaterThan(shardFilterIndex);
      expect(A.some(shardArgs, Str.startsWith("--filter=@beep/"))).toBe(true);
    }
  });

  it("keeps build and audit turbo graphs unfiltered (excluded-task boundary)", () => {
    const build = rootQualityStepsForTesting("/repo", getInvocation(["build"]));
    expect(argsOf(build[0])).not.toContain(LABS_EXCLUDE_FILTER);

    const audit = withEnvVar("CI", undefined, () =>
      rootQualityStepsForTesting("/repo", getInvocation(["audit", "--filter=@beep/schema"]))
    );
    expect(argsOf(audit[0])).not.toContain(LABS_EXCLUDE_FILTER);
  });
});

describe("unwrapped turbo steps drop an unusable remote cache posture", () => {
  const remoteStep = (overrides: Partial<{ env: Record<string, string | undefined> }>) =>
    QualityTaskStep.make({
      label: "check",
      command: "bunx",
      args: ["turbo", "run", "check", "--cache=local:rw,remote:r", "--concurrency=3"],
      cwd: "/repo",
      ...overrides,
    });

  it("opts a credential-free step into op run only when a session is needed", () => {
    expect(turboStepLocalEnvForTesting(undefined, true)).toEqual(O.some(true));
    expect(turboStepLocalEnvForTesting(undefined, false)).toEqual(O.none());
    expect(turboStepLocalEnvForTesting({ CI: "true" }, true)).toEqual(O.none());
  });

  it("wraps a Turbo step without loading the project env file or carrying unrelated references", () => {
    const wrapped = turboSecretSessionStepForTesting(remoteStep({}), {
      PATH: "/fixture/bin",
      TURBO_API: "op://fixture-vault/turbo/api",
      TURBO_TOKEN: "op://fixture-vault/turbo/token",
      TURBO_TEAM: "fixture-team",
      TURBO_CACHE: "local:rw,remote:r",
      UNRELATED_SECRET: "op://fixture-vault/unrelated/secret",
    });

    expect(wrapped.command).toBe("op");
    expect(wrapped.args).toEqual([
      "run",
      "--",
      "bunx",
      "turbo",
      "run",
      "check",
      "--cache=local:rw,remote:r",
      "--concurrency=3",
    ]);
    expect(wrapped.env).toStrictEqual({
      PATH: "/fixture/bin",
      TURBO_API: "op://fixture-vault/turbo/api",
      TURBO_TOKEN: "op://fixture-vault/turbo/token",
      TURBO_TEAM: "fixture-team",
      TURBO_CACHE: "local:rw,remote:r",
    });
  });

  it("rewrites the posture when the credentials still need an op run session", () => {
    expect(withoutUnusableRemoteCacheForTesting(remoteStep({}), true).args).toEqual([
      "turbo",
      "run",
      "check",
      "--cache=local:rw",
      "--concurrency=3",
    ]);
  });

  it("leaves the step untouched when the credentials are already resolved", () => {
    const step = remoteStep({});

    expect(withoutUnusableRemoteCacheForTesting(step, false)).toBe(step);
  });

  it("leaves a step carrying no remote posture untouched", () => {
    const step = QualityTaskStep.make({
      label: "check",
      command: "bunx",
      args: ["turbo", "run", "check", "--cache=local:rw"],
      cwd: "/repo",
    });

    expect(withoutUnusableRemoteCacheForTesting(step, true)).toBe(step);
  });

  it("carries the step environment and quarantine policy through a rewrite", () => {
    const step = QualityTaskStep.make({
      label: "coverage:ratchet",
      command: "bunx",
      args: ["turbo", "run", "coverage", "--cache=local:rw,remote:r"],
      cwd: "/repo",
      env: { CI: "true", BEEP_TEST_DATABASE_URL: "postgres://localhost/beep" },
      flakeQuarantine: "ts2589-no-location",
      captureTimeoutMillis: PosInt.make(900_000),
    });
    const rewritten = withoutUnusableRemoteCacheForTesting(step, true);

    expect(rewritten.args).toEqual(["turbo", "run", "coverage", "--cache=local:rw"]);
    expect(rewritten.env).toEqual(step.env);
    expect(rewritten.flakeQuarantine).toBe("ts2589-no-location");
    expect(rewritten.captureTimeoutMillis).toBe(900_000);
    expect(rewritten.label).toBe(step.label);
  });
});
