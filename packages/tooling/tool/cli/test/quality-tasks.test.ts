import * as NodeOS from "node:os";
import * as NodeURL from "node:url";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { Jsonc } from "@beep/jsonc/Jsonc";
import {
  CiLaneRunOptions,
  CiLocalStepPlan,
  ciLaneStepsForTesting,
  ciLocalStepsForTesting,
} from "@beep/repo-cli/commands/Ci";
import {
  LintPolicySweeps,
  QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
  QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
  QualityAdmissionLoad,
  QualityConcurrencyPlan,
  QualityProfileDetectionInput,
} from "@beep/repo-cli/commands/Quality";
import {
  collectAuditDiffInputForTesting,
  fallowAuditDiffFallbackArgsForTesting,
  fallowAuditNeedsDiffFallbackForTesting,
  fallowCiUploadDiagnosticsForTesting,
} from "@beep/repo-cli/commands/Quality/FallowQuality.command";
import { ensureOriginMainForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import { selectOsvPackageOverrideIdsForAudit } from "@beep/repo-cli/commands/Quality/Quality.osv-ignore";
import {
  collectCoverageChangedFilesForTesting,
  collectGithubCheckLaneWavesForTesting,
  collectQualityTaskLaneRunsForTesting,
  coverageProducerEnvironment,
  parseTestLaneSelectionForTesting,
  readLintPolicySweeps,
  resolveCiCoverageArtifactPlan,
  resolveCoverageSelector,
  runQualityTaskBufferedStepGroup,
  runQualityTaskGithubCheckLaneWaves,
  runQualityTaskStreamingLaneGroup,
} from "@beep/repo-cli/commands/Quality/Tasks";
import { runCapturedStreams } from "@beep/repo-cli/test/Process";
import {
  baselineEntriesLostByReplacement,
  CoverageBaselineChangeSet,
  CoverageBaselineRowDelta,
  CoverageBaselineWriteOptions,
  CoverageComparisonBaselines,
  CoverageComparisonFailure,
  CoverageFileBaseline,
  CoveragePackageBaseline,
  CoverageRegressionBaseline,
  CoverageScopeOwner,
  CoverageSelfJudgeScope,
  CoverageSnapshotEntry,
  CoverageUncoveredCounts,
  changedCoverageOwners,
  cleanCoverageRegressionOutputs,
  collectEffectTsgoDiagnosticLines,
  compareCoverageRegressionSnapshotsForExpectedPackagesForTesting,
  compareCoverageRegressionSnapshotsForTesting,
  compareCoverageRegressionSnapshotsWithProposedForTesting,
  compareJSDocTotalsForTesting,
  completeCounterlessCoverageFilesForTesting,
  coverageBaselineChangeSetFromChangedFiles,
  coverageBaselineRowDelta,
  coverageBaselineRowDeltaFromBase,
  coverageBaselineWriteReport,
  coverageBaselineWriterChangedFiles,
  coverageBaselineWriteSummary,
  coverageDependentOwners,
  coverageDispositionGapsForTesting,
  coverageFullStepsForTesting,
  coveragePackageBaselineFromSummaryForTesting,
  coverageScopedBaselineWriteCommand,
  coverageScopeWeightSeconds,
  coverageSelectedStepsForTesting,
  coverageStepForTesting,
  coverageVitestTopologyArgs,
  detectQualityProfileForTesting,
  devQualityStepsForTesting,
  FallowReportFinding,
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifactJson,
  foldTurboLaneDigests,
  GateOrderSeed,
  GateOrderSeedRow,
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
  githubCheckPrePushLanes,
  githubCheckPromotedFallowLaneDiagnosticsForTesting,
  githubCheckQualityLanesForTesting,
  githubCheckRepoSanityLanesForTesting,
  githubCheckTierConcurrency,
  githubCheckWaveSegments,
  LaneProofSession,
  lintFixChangedStepForTesting,
  localQualityConcurrencyPlan,
  missingTestTsgoTaskMessageForTesting,
  parseQualityTaskInvocation,
  persistLaneProofs,
  pinnedLaneProofBaseSha,
  planCoverageAffectedScope,
  planCoverageAffectedScopeWithBaseline,
  planCoverageBaselineWrite,
  planCoverageFileIdentityAdditions,
  planCoverageFullShards,
  planCoverageSelfJudgeScope,
  planWorkspaceCoverageAffectedScope,
  prepareLaneProofSession,
  promotedFallowGithubCheckLaneIdsForTesting,
  provideQualityConcurrency,
  QUALITY_TASK_LANE_RUN_REPORT_PREFIX,
  QualityConcurrency,
  QualityTaskFailed,
  QualityTaskGroupFailed,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
  QualityTaskStep,
  qualityAdmissionLoadOf,
  qualityCommandPrimitiveHelpersForTesting,
  qualityConcurrencyPlan,
  qualityProfileConfigForTesting,
  readCoverageComparisonBaselineForTesting,
  readTurboLaneLedger,
  renderCoverageFailuresForTesting,
  renderCoverageLoweredFloors,
  renderCoverageMeasuredRowProposals,
  renderCoverageRemediation,
  resolveLaneInputDigestForTesting,
  resolveLiveQualityConcurrencyPlan,
  resolveQualityConcurrencyPlan,
  reviewFixDocgenLocalArgsForTesting,
  rootDocsCacheKey,
  rootLintPolicyStepsForTesting,
  rootQualityStepsForTesting,
  runBunAudit,
  runGithubChecks,
  runJSDocModuleTagsCheck,
  runQualityTask,
  runQualityTaskStepGroupForTesting,
  runQualityTaskStreamingStepGroupForTesting,
  runRootLintPolicyTask,
  runSqlIntegrationTestLaneForTesting,
  scaleQualityWidthByAdmission,
  sqlIntegrationConnectionUriFromEnvForTesting,
  sqlIntegrationStepForTesting,
  TURBO_LANE_LEDGER_ENV,
  TurboLaneDigest,
  TurboLaneLedgerRow,
  TurboRunSummary,
  testTsgoPlanningForTesting,
  turboLaneDigestFromSummary,
  turboSecretSessionStepForTesting,
  turboStepLocalEnvForTesting,
  validateCoverageTaskArgsForTesting,
  withoutUnusableRemoteCacheForTesting,
  workspaceCoverageScopeOwners,
  workspaceTaskFiltersForTesting,
  writeCoverageRegressionBaseline,
} from "@beep/repo-cli/test/Quality";
import { MemoryStats, provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun";
import {
  clearTurboCacheSecretSessionVerdictsForTesting,
  hasRemoteTurboCacheArgs,
  isCiSync,
  localOnlyTurboCacheArgs,
  readTurboCacheEnvironmentSync,
  resolveTurboCachePlan,
  turboCachePlanArgs,
} from "@beep/repo-cli/test/SharedInternals";
import { DEFAULT_GATE_ORDER_SEED, WaveOrder } from "@beep/repo-cli/test/Yeet";
import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { Percentage } from "@beep/schema/Percentage";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe, expect, vi } from "@effect/vitest";
import { assertDefined, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, flow, identity, pipe } from "effect/Function";
import * as HM from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { CiLaneId } from "@beep/repo-cli/commands/Ci";
import type { PolicySweepProgram } from "@beep/repo-cli/commands/Quality";
import type { GateOrderLaneClass, GithubCheckLaneWave, QualityTaskInvocation } from "@beep/repo-cli/test/Quality";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const decodeQualityTaskLaneRun = S.decodeEffect(QualityTaskLaneRun);
const decodeQualityTaskLaneRunReportJson = S.decodeEffect(S.fromJsonString(QualityTaskLaneRunReport));
const encodeQualityTaskLaneRunReport = S.encodeEffect(QualityTaskLaneRunReport);
const encodeQualityTaskLaneRunReportJson = S.encodeEffect(S.fromJsonString(QualityTaskLaneRunReport));

const decodeCoverageComparisonFailure = S.decodeEffect(CoverageComparisonFailure);
const decodeGithubCheckFailurePolicy = S.decodeEffect(GithubCheckFailurePolicy);
const decodeGithubCheckRunReport = S.decodeEffect(GithubCheckRunReport);
const decodeGithubCheckRunReportEffect = S.decodeEffect(GithubCheckRunReport);
const decodeUnknownCoverageRegressionBaseline = S.decodeUnknownEffect(CoverageRegressionBaseline);
const encodeCoverageFileBaselineJson = S.encodeEffect(S.fromJsonString(CoverageFileBaseline));
const encodeCoverageSelfJudgeScopeEffect = S.encodeEffect(CoverageSelfJudgeScope);
const decodeCoverageFileBaselineJson = S.decodeUnknownEffect(S.fromJsonString(CoverageFileBaseline));
const encodeCoverageRegressionBaseline = S.encodeEffect(CoverageRegressionBaseline);
const encodeGithubCheckRunReportEffect = S.encodeEffect(GithubCheckRunReport);
const decodeTurboLaneLedgerRow = S.decodeUnknownEffect(S.fromJsonString(TurboLaneLedgerRow));
const encodeTurboRunSummary = S.encodeEffect(S.fromJsonString(TurboRunSummary));

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer);
const PlatformLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(FileSystemLayer, NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer)))
);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeGithubChecksFallowFeatureMatrixJsoncForTesting = Jsonc.bind(GithubChecksFallowFeatureMatrix).decode;
const decodeCoverageRegressionBaselineJsoncForTesting = Jsonc.bind(CoverageRegressionBaseline).decode;
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
  const handle = yield* ChildProcess.make("git", ["-c", "commit.gpgSign=false", ...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode1 = yield* handle.exitCode;
  assert.strictEqual(exitCode1, 0);
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
// The carried-unmeasured notice is one line among the disposition and raise
// lines, so absence is asserted by filtering rather than by a whole-report match.
const carriedUnmeasuredNotices = (report: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(report, (line) => Str.includes("were not measured by this scoped run")(line));
const coverageUncovered = (count: number): CoverageUncoveredCounts => {
  const decoded = S.Natural.make(count);
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

const temporaryRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repositoryPath = yield* fs.makeTempDirectoryScoped();
  yield* Effect.acquireRelease(
    Effect.sync(() => {
      const originalCwd = process.cwd;
      process.cwd = () => repositoryPath;
      return originalCwd;
    }),
    (originalCwd) =>
      Effect.sync(() => {
        process.cwd = originalCwd;
      })
  );
  yield* fs.makeDirectory(path.join(repositoryPath, ".git"), { recursive: true });
  return repositoryPath;
});

// A root declaring `workspaces`, plus one `test:integration`-owning package per
// directory, named `@beep/<dir with "/" as "-">`.
const writeIntegrationWorkspace = Effect.fnUntraced(function* (
  repositoryPath: string,
  workspaces: ReadonlyArray<string>,
  packageDirs: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const argument1 = path.join(repositoryPath, "package.json");
  const encodedJson1 = yield* encodeJson({ name: "@beep/test-root", private: true, workspaces });
  yield* fs.writeFileString(argument1, encodedJson1);
  yield* Effect.forEach(
    packageDirs,
    Effect.fnUntraced(function* (packageDir) {
      const absoluteDir = path.join(repositoryPath, packageDir);
      yield* fs.makeDirectory(absoluteDir, { recursive: true });
      const argument2 = path.join(absoluteDir, "package.json");
      const encodedJson2 = yield* encodeJson({
        name: `@beep/${Str.replaceAll("/", "-")(packageDir)}`,
        private: true,
        scripts: { "test:integration": "vitest run test/integration" },
      });
      yield* fs.writeFileString(argument2, encodedJson2);
    }),
    { discard: true }
  );
});

// The single coverage invocation for a `bun run coverage <argv>` shape; root
// coverage itself plans at run time, so this is the unit the runtime composes.
const coverageStepOf = (argv: ReadonlyArray<string>): QualityTaskStep =>
  coverageStepForTesting("/repo", getInvocation(["coverage", ...argv]).args ?? A.empty<string>());

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

// A local run clears every signal the one CI rule reads (`RuntimeEnv.ci`): a
// hosted runner sets GITHUB_ACTIONS beside CI, so clearing CI alone still
// classifies the process as CI there.
const withoutCi = <Out>(use: () => Out): Out =>
  withEnvVar("CI", undefined, () =>
    withEnvVar("GITHUB_ACTIONS", undefined, () => withEnvVar("CONTINUOUS_INTEGRATION", undefined, use))
  );

const withoutCiEffect = <Out, E, R>(use: Effect.Effect<Out, E, R>): Effect.Effect<Out, E, R> =>
  withEnvVarEffect(
    "CI",
    undefined,
    withEnvVarEffect("GITHUB_ACTIONS", undefined, withEnvVarEffect("CONTINUOUS_INTEGRATION", undefined, use))
  );

const withEnvVarsEffect = <Out, E, Req>(
  values: Readonly<Record<string, string | undefined>>,
  use: Effect.Effect<Out, E, Req>
): Effect.Effect<Out, E, Req> =>
  A.reduce(R.toEntries(values), use, (inner, [name, value]) => withEnvVarEffect(name, value, inner));

const isTurboConcurrencyArg = (arg: string): boolean =>
  arg === "--concurrency" || Str.startsWith("--concurrency=")(arg);

// The retired exclusion must never return to root task command plans.
const LABS_EXCLUDE_FILTER = "--filter=!./apps/labs/**";

const hostDetectionInput = QualityProfileDetectionInput.make({
  ci: false,
  cpuCount: NodeOS.cpus().length,
  totalMemoryBytes: NodeOS.totalmem(),
});
const ciDetection = detectQualityProfileForTesting(
  QualityProfileDetectionInput.make({ ci: true, cpuCount: 64, totalMemoryBytes: 128 * 1024 * 1024 * 1024 })
);
const currentDetection = detectQualityProfileForTesting(
  QualityProfileDetectionInput.make({ ci: false, cpuCount: 8, totalMemoryBytes: 16 * 1024 * 1024 * 1024 })
);
const workstationDetection = detectQualityProfileForTesting(
  QualityProfileDetectionInput.make({ ci: false, cpuCount: 64, totalMemoryBytes: 128 * 1024 * 1024 * 1024 })
);

const policyTurboStep = (
  label: string,
  base?: string,
  deprecatedApis: PolicySweepProgram = "oxlint"
): QualityTaskStep =>
  O.getOrThrow(
    A.findFirst(
      rootLintPolicyStepsForTesting(
        "/repo",
        undefined,
        base,
        LintPolicySweeps.make({ schemaVersion: "lint-policy-sweeps/v1", deprecatedApis })
      ),
      (entry) => entry.label === label
    )
  );
const expectSweepConfigurationFailure = Effect.fnUntraced(function* (root: string) {
  const error = yield* readLintPolicySweeps(root).pipe(Effect.flip);
  expect(error._tag).toBe("QualityTaskConfigurationError");
  expect(error.message).toContain(`${root}/standards/lint-policy.sweeps.jsonc`);
});
const policyTurboScmBase = (step: QualityTaskStep): string | undefined => step.env?.TURBO_SCM_BASE;
// The cache posture itself is proven in `turbo-cache.test.ts`; these step
// assertions prove that whatever the resolver decides is what reaches turbo.
// Deriving it keeps them green on a checkout configured for remote reads
// instead of pinning the local-only fallback into every expectation.
const expectedTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironmentSync(), { args, ci: isCiSync() }));
const expectedTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> => [
  "turbo",
  "run",
  task,
  ...expectedTurboCacheArgs(args),
  ...args,
];
// The root graphs take `--concurrency` from the live concurrency plan: the `ci`
// profile under CI, the detected local profile (`current` or `workstation`)
// otherwise, so the expectation is derived the same way the planner derives it.
const expectedRootTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  expectedTurboArgs(
    task,
    A.some(args, isTurboConcurrencyArg) ? args : [`--concurrency=${localQualityConcurrencyPlan().rootTurbo}`, ...args]
  );
// Coverage keeps its fixed caps (the shard worker topology is the ratchet's
// baseline shape): the fleet cap under CI, three locally.
const expectedCoverageTurboArgs = (task: string, args: ReadonlyArray<string>): ReadonlyArray<string> =>
  expectedTurboArgs(
    task,
    A.some(args, isTurboConcurrencyArg)
      ? args
      : isCiSync()
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

const githubCheckTestLane = (
  id: string,
  wave: GithubCheckLaneWave,
  source: string,
  orderEstimate: O.Option<GateOrderSeedRow> = O.none()
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    blockedBy: [],
    id,
    orderEstimate,
    stage: "repo-quality",
    step: bunScriptStep(id, source),
    tier: "pre-push",
    wave,
  });

const githubCheckTestEstimate = (
  laneId: string,
  costP50Seconds: number,
  precision: "precise" | "imprecise" = "precise",
  laneClass: GateOrderLaneClass = "policy-preflight"
): GateOrderSeedRow =>
  GateOrderSeedRow.make({
    laneId,
    laneClass,
    laneClassBasis: "Test fixture partition.",
    costP50Seconds,
    durationBasis: "Test fixture duration.",
    durationPointer: "/test/duration",
    redProbability: 0,
    firstRedBasis: "Test fixture probability.",
    firstRedPointer: "/test/redProbability",
    precision,
    precisionBasis: "Test fixture precision.",
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
  yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
  yield* runGit(repoRoot, ["add", "."]);
  yield* runGit(repoRoot, ["commit", "-m", "baseline"]);
  yield* runGit(repoRoot, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
});

// Prepends a `git` shim to PATH: the shim runs `prelude` (which may exit to
// fail the call) and then the real git, so a test can count or break the
// lane-proof virtual-tree calls without touching the lanes themselves.
const withGitShim = Effect.fnUntraced(function* <Out, E, R>(
  root: string,
  prelude: string,
  use: Effect.Effect<Out, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const shimDirectory = path.join(root, ".beep", "git-shim");
  yield* fs.makeDirectory(shimDirectory, { recursive: true });
  // Dropping the shim's own PATH entry lets the final exec resolve the real git.
  yield* fs.writeFileString(
    path.join(shimDirectory, "git"),
    `#!/bin/sh\n${prelude}\nPATH="\${PATH#*:}" exec git "$@"\n`
  );
  yield* fs.chmod(path.join(shimDirectory, "git"), 0o755);
  return yield* withEnvVarEffect("PATH", `${shimDirectory}:${Bun.env.PATH ?? ""}`, use);
});

const laneProofTestLane = (
  repoRoot: string,
  id: string,
  wave: GithubCheckLaneWave,
  source: string,
  useLocalEnv = false,
  env?: Readonly<Record<string, string>>
): GithubCheckLaneSpec =>
  GithubCheckLaneSpec.make({
    id,
    tier: "pre-push",
    stage: "repo-quality",
    wave,
    blockedBy: [],
    step: QualityTaskStep.make({
      label: id,
      command: "bash",
      args: ["-c", source],
      cwd: repoRoot,
      ...(P.isUndefined(env) ? {} : { env }),
      useLocalEnv,
    }),
  });

const spawnedLines = (spawner: ScriptedSpawner): ReadonlyArray<string> =>
  A.map(spawner.spawns, (spawn) => A.join([spawn.command, ...spawn.args], " "));

// The runtime may wrap a Turbo step in a secret session (`op run … --`) and rewrite its
// `--cache=` posture (and, under CI, a leading `--force`) from the ambient environment; policy
// tests compare commands by this key so those environment-only differences never decide a test.
const policyCommandKey = (text: string): string =>
  pipe(
    Str.split(text, " "),
    A.dropWhile((word) => word !== "bunx" && word !== "bun" && word !== "git"),
    A.filter((word) => !Str.startsWith("--cache=")(word) && word !== "--force"),
    A.join(" ")
  );

// A live 1Password session suffixes the resolved step label with " (op run)".
const policyLabelKey = Str.replace(" (op run)", "");

const policyStepCommand = (step: QualityTaskStep) => {
  const expected =
    step.command === "bunx" && step.args[0] === "turbo" && step.args[1] === "run"
      ? [
          "bun",
          "--no-env-file",
          NodeURL.fileURLToPath(new URL("../src/bin.ts", import.meta.url)),
          "cache",
          "execute",
          "--",
          ...A.drop(step.args, 1),
        ]
      : [step.command, ...step.args];
  return A.join(expected, " ");
};

// A red policy run fails as one group whose failures name exactly the red planned label.
const expectPolicyGroupFailure = (exit: Exit.Exit<unknown, unknown>, failedLabel: string): void => {
  assertTrue(exit._tag === "Failure");
  if (Exit.isFailure(exit)) {
    const failure = Cause.squash(exit.cause);
    expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
    if (isQualityTaskGroupFailed(failure)) {
      expect(A.map(failure.failures, (step) => policyLabelKey(step.label))).toEqual([failedLabel]);
    }
  }
};

// Local runs stop after a red cheap phase; hosted runs collect every phase. The JSDoc
// ratchet compare is a Turbo dependent of the inventory task, so a red inventory phase
// skips it inside Turbo rather than in the plan runner.
const expectedPolicyRun = (
  plan: ReadonlyArray<QualityTaskStep>,
  full: boolean,
  failedLabel: string
): ReadonlyArray<QualityTaskStep> => (!full && failedLabel === "lint:policy:cheap" ? A.take(plan, 1) : plan);

// Session probes (`op …`) and git reads are spawned around the plan; only commands with a
// step launcher token are plan steps.
const spawnedPolicyCommands = (spawner: ScriptedSpawner): ReadonlyArray<string> =>
  pipe(
    spawnedLines(spawner),
    A.map(policyCommandKey),
    A.filter((key) => key !== "" && !Str.startsWith("git ")(key))
  );

// The git probes the runner makes around the plan, answered by their first matching argv flag.
const cheapGatesGitReplies: ReadonlyArray<readonly [flag: string, stdout: string]> = [
  ["--is-shallow-repository", "false"],
  ["--show-current", "feature/cheap-gates"],
];

const isTargetProbe = Str.includes("--dry=json");

// The changed scope probes Turbo once before planning; the fake spawner's empty stdout is no
// plan, so the per-package Turbo tasks stay. Steps inside a stage run abreast, so the spawned
// plan commands are compared as a set.
const expectPolicySpawns = (
  spawner: ScriptedSpawner,
  expected: ReadonlyArray<QualityTaskStep>,
  full: boolean
): void => {
  const commands = spawnedPolicyCommands(spawner);
  // A full-scope run never probes.
  expect(A.length(A.filter(commands, isTargetProbe))).toBe(full ? 0 : 1);
  expect(A.sort(A.filter(commands, P.not(isTargetProbe)), Order.String)).toEqual(
    A.sort(
      A.map(expected, (step) => policyCommandKey(policyStepCommand(step))),
      Order.String
    )
  );
};

const cheapGatesSpawner = (failedCommands: ReadonlyArray<string>, key: (text: string) => string = identity) =>
  ScriptedSpawner.make((command, args) => ({
    stdout: A.findFirst(cheapGatesGitReplies, ([flag]) => A.contains(args, flag)).pipe(
      O.map(([, stdout]) => stdout),
      O.getOrElse(() => "")
    ),
    exit: A.contains(A.map(failedCommands, key), key(A.join([command, ...args], " "))) ? 1 : 0,
  }));

// The SAST lane's spawns: the changed-file listing answers with `changedOutput`, every other command prints nothing.
const sastSpawner = (changedOutput: string) =>
  ScriptedSpawner.make((_command, args) => ({ stdout: A.contains(args, "--name-only") ? changedOutput : "" }));

const spawnedArgv = (spawner: ScriptedSpawner): ReadonlyArray<ReadonlyArray<string>> =>
  A.map(spawner.spawns, (spawn) => [spawn.command, ...spawn.args]);

type FallowFeatureMatrixRowTuple = readonly [
  featureFamily: GithubChecksFallowFeatureMatrix["features"][number]["featureFamily"],
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
    "unpromoted Fallow GitHub check lane is wired: fallow:health",
  ]);
};

const expectSubstringBefore = (text: string, before: string, after: string): void => {
  const beforeIndex = Str.indexOf(before)(text);
  const afterIndex = Str.indexOf(after)(text);

  beforeIndex.pipe(O.isSome, assertTrue);
  afterIndex.pipe(O.isSome, assertTrue);

  if (O.isSome(beforeIndex) && O.isSome(afterIndex)) {
    expect(beforeIndex.value).toBeLessThan(afterIndex.value);
  }
};

const coverageArtifactPlanRepository = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-plan-" });
  const argument3 = path.join(root, "package.json");
  const encodedJson3 = yield* encodeJson({
    name: "@beep/plan-root",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* fs.writeFileString(argument3, encodedJson3);
  yield* Effect.forEach(
    ["covered", "bare"],
    Effect.fnUntraced(function* (name) {
      const dir = path.join(root, "packages", name);
      yield* fs.makeDirectory(dir, { recursive: true });
      const argument4 = path.join(dir, "package.json");
      const encodedJson4 = yield* encodeJson({
        name: `@beep/${name}`,
        private: true,
        scripts: name === "covered" ? { coverage: "vitest run --coverage" } : { test: "vitest run" },
      });
      yield* fs.writeFileString(argument4, encodedJson4);
    })
  );
  yield* runGit(root, ["init"]);
  yield* runGit(root, ["config", "user.name", "Coverage Plan Fixture"]);
  yield* runGit(root, ["config", "user.email", "coverage-plan@example.invalid"]);
  yield* runGit(root, ["add", "--all"]);
  yield* runGit(root, ["commit", "-m", "test: coverage plan fixture"]);
  return root;
});
const artifactPlanConfiguration = ConfigProvider.fromUnknown({
  BEEP_COVERAGE_RUN_ID: "123",
  BEEP_COVERAGE_RUN_ATTEMPT: "2",
  TURBO_SCM_BASE: "HEAD",
});

it.layer(PlatformLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("counterless coverage geometry and additive file identities", () => {
    it.effect("restores only existing parsed external re-exports without changing package counters", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-counterless-" });
        const sourceRoot = path.join(root, "packages/existing/src");
        yield* fs.makeDirectory(sourceRoot, { recursive: true });
        const cases: ReadonlyArray<readonly [string, string, boolean]> = [
          ["Star.ts", "export * from './Body.ts';", true],
          ["Named.ts", "export { value as renamed } from './Body.ts';", true],
          ["Namespace.ts", "export * as Body from './Body.ts';", true],
          ["Types.ts", "export type { Value } from './Body.ts';", true],
          ["Runtime.ts", "export const value = 1;", false],
          ["SideEffect.ts", "import './Body.ts'; export * from './Body.ts';", false],
          ["Local.ts", "export { value };", false],
          ["Invalid.ts", "export { from './Body.ts';", false],
          ["Empty.ts", "// no exports", false],
        ];
        const files = R.empty<string, CoverageFileBaseline>();
        for (const [name, text] of cases) {
          yield* fs.writeFileString(path.join(sourceRoot, name), text);
          R.assignProperty(files, `packages/existing/src/${name}`, coverageFileBaseline(100, 0));
        }
        R.assignProperty(files, "packages/existing/src/Deleted.ts", coverageFileBaseline(100, 0));
        yield* fs.writeFileString(path.join(root, "Outside.ts"), "export * from './Other.ts';");
        yield* fs.symlink(path.join(root, "Outside.ts"), path.join(sourceRoot, "Escaped.ts"));
        R.assignProperty(files, "packages/existing/src/Escaped.ts", coverageFileBaseline(100, 0));
        yield* fs.writeFileString(path.join(sourceRoot, "NotBaselined.ts"), "export * from './Body.ts';");
        yield* fs.writeFileString(path.join(sourceRoot, "Reported.ts"), "export * from './Body.ts';");
        R.assignProperty(files, "packages/existing/src/Reported.ts", coverageFileBaseline(100, 0));
        const base = CoverageRegressionBaseline.make({
          ...coverageRegressionBaseline,
          packages: {
            "@beep/existing": CoveragePackageBaseline.make({
              path: "packages/existing",
              ...coveragePercentages(50),
              uncovered: coverageUncovered(2),
              files,
            }),
          },
        });
        const baselineRow = yield* Effect.fromOption(R.get(base.packages, "@beep/existing"));
        const measured = CoveragePackageBaseline.make({
          ...baselineRow,
          files: { "packages/existing/src/Reported.ts": coverageFileBaseline(50, 1) },
        });
        const entries = yield* completeCounterlessCoverageFilesForTesting(root, base, [
          CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: measured }),
        ]);
        const completed = A.getUnsafe(entries, 0).baseline;
        for (const [name, , counterless] of cases)
          expect(R.has(completed.files, `packages/existing/src/${name}`)).toBe(counterless);
        expect(R.has(completed.files, "packages/existing/src/Deleted.ts")).toBe(false);
        expect(R.has(completed.files, "packages/existing/src/Escaped.ts")).toBe(false);
        expect(R.has(completed.files, "packages/existing/src/NotBaselined.ts")).toBe(false);
        expect(completed.files["packages/existing/src/Reported.ts"]).toEqual(
          measured.files["packages/existing/src/Reported.ts"]
        );
        expect(completed.uncovered).toEqual(measured.uncovered);
        expect({ ...completed, files: measured.files }).toEqual(measured);
        const failures = compareCoverageRegressionSnapshotsForTesting(base, entries, true).failures;
        expect(failures).toHaveLength(32);
        expect(
          A.some(failures, (failure) => O.exists(failure.filePath, (file) => Str.endsWith("Deleted.ts")(file)))
        ).toBe(true);
      })
    );
    it.effect("canonicalizes checkout aliases and refuses file or package escapes and unresolved roots", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-counterless-alias-" });
        const root = path.join(temporary, "checkout");
        const alias = path.join(temporary, "checkout-alias");
        const sourceRoot = path.join(root, "packages/existing/src");
        const externalPackage = path.join(temporary, "external-package");
        yield* fs.makeDirectory(sourceRoot, { recursive: true });
        yield* fs.makeDirectory(path.join(externalPackage, "src"), { recursive: true });
        yield* fs.writeFileString(path.join(sourceRoot, "index.ts"), "export * from './Body.ts';");
        yield* fs.writeFileString(path.join(root, "Outside.ts"), "export * from './Other.ts';");
        yield* fs.writeFileString(path.join(externalPackage, "src/index.ts"), "export * from './Body.ts';");
        yield* fs.symlink(root, alias);
        yield* fs.symlink(path.join(root, "Outside.ts"), path.join(sourceRoot, "Escaped.ts"));
        yield* fs.symlink(externalPackage, path.join(root, "packages/escaped"));
        const packages = {
          "@beep/existing": CoveragePackageBaseline.make({
            path: "packages/existing",
            ...coveragePercentages(100),
            uncovered: coverageUncovered(0),
            files: {
              "packages/existing/src/index.ts": coverageFileBaseline(100, 0),
              "packages/existing/src/Escaped.ts": coverageFileBaseline(100, 0),
            },
          }),
          "@beep/escaped": CoveragePackageBaseline.make({
            path: "packages/escaped",
            ...coveragePercentages(100),
            uncovered: coverageUncovered(0),
            files: { "packages/escaped/src/index.ts": coverageFileBaseline(100, 0) },
          }),
        };
        const baseline = CoverageRegressionBaseline.make({ ...coverageRegressionBaseline, packages });
        const measured = A.map(R.toEntries(packages), ([packageName, row]) =>
          CoverageSnapshotEntry.make({
            packageName,
            baseline: CoveragePackageBaseline.make({ ...row, files: {} }),
          })
        );
        for (const checkout of [root, alias]) {
          const completed = yield* completeCounterlessCoverageFilesForTesting(checkout, baseline, measured);
          const existing = A.getUnsafe(completed, 0).baseline;
          const escaped = A.getUnsafe(completed, 1).baseline;
          expect(R.keys(existing.files)).toEqual(["packages/existing/src/index.ts"]);
          expect(escaped.files).toEqual({});
          expect({ ...existing, files: {} }).toEqual(A.getUnsafe(measured, 0).baseline);
          expect(escaped).toEqual(A.getUnsafe(measured, 1).baseline);
        }
        const unavailable = path.join(temporary, "unavailable-checkout");
        yield* fs.symlink(path.join(temporary, "missing-target"), unavailable);
        const unresolved = yield* completeCounterlessCoverageFilesForTesting(unavailable, baseline, measured);
        expect(unresolved).toEqual(measured);
      })
    );
    it.effect("completes root-package re-exports through physical and aliased checkout roots", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-counterless-root-" });
        const root = path.join(temporary, "checkout");
        const alias = path.join(temporary, "checkout-alias");
        const sourceRoot = path.join(root, "src");
        yield* fs.makeDirectory(sourceRoot, { recursive: true });
        yield* fs.writeFileString(path.join(sourceRoot, "index.ts"), "export * from './Body.ts';");
        yield* fs.writeFileString(path.join(sourceRoot, "Runtime.ts"), "export const value = 1;");
        const outside = path.join(temporary, "Outside.ts");
        yield* fs.writeFileString(outside, "export * from './Other.ts';");
        yield* fs.symlink(outside, path.join(sourceRoot, "Escaped.ts"));
        yield* fs.symlink(root, alias);
        const row = CoveragePackageBaseline.make({
          path: ".",
          ...coveragePercentages(50),
          uncovered: coverageUncovered(2),
          files: {
            "src/index.ts": coverageFileBaseline(100, 0),
            "src/Runtime.ts": coverageFileBaseline(100, 0),
            "src/Escaped.ts": coverageFileBaseline(100, 0),
          },
        });
        const baseline = CoverageRegressionBaseline.make({
          ...coverageRegressionBaseline,
          packages: { "@beep/root": row },
        });
        const measured = CoverageSnapshotEntry.make({
          packageName: "@beep/root",
          baseline: CoveragePackageBaseline.make({ ...row, files: {} }),
        });
        for (const checkout of [root, alias]) {
          const completed = yield* completeCounterlessCoverageFilesForTesting(checkout, baseline, [measured]);
          const actual = A.getUnsafe(completed, 0).baseline;
          expect(actual.files).toEqual({ "src/index.ts": coverageFileBaseline(100, 0) });
          expect({ ...actual, files: {} }).toEqual(measured.baseline);
        }
      })
    );
    it.effect("adds only new measured identities while preserving every committed floor and unrelated owner", () =>
      Effect.gen(function* () {
        const existing = "packages/existing/src/Existing.ts";
        const added = "packages/existing/src/Added.ts";
        const previous = CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(90),
          uncovered: coverageUncovered(2),
          files: { [existing]: coverageFileBaseline(100, 0) },
        });
        const unchanged = coveragePackageBaseline("packages/unchanged", 95);
        const actual = CoveragePackageBaseline.make({
          path: "packages/existing",
          ...coveragePercentages(10),
          uncovered: coverageUncovered(200),
          files: { [existing]: coverageFileBaseline(0, 20), [added]: coverageFileBaseline(75, 1) },
        });
        const entry = CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual });
        const plan = yield* planCoverageFileIdentityAdditions(
          { "@beep/existing": previous, "@beep/unchanged": unchanged },
          [entry],
          ["@beep/existing"]
        );
        expect(plan.packages["@beep/existing"]).toEqual({
          ...previous,
          files: { ...previous.files, [added]: actual.files[added] },
        });
        expect(plan.packages["@beep/unchanged"]).toEqual(unchanged);
        for (const invalid of [
          planCoverageFileIdentityAdditions({ "@beep/existing": previous }, [entry], []),
          planCoverageFileIdentityAdditions({}, [entry], ["@beep/existing"]),
          planCoverageFileIdentityAdditions({ "@beep/existing": previous }, [entry], ["@beep/other"]),
          planCoverageFileIdentityAdditions({ "@beep/existing": previous }, [], ["@beep/existing"]),
          planCoverageFileIdentityAdditions(
            { "@beep/existing": previous },
            [
              CoverageSnapshotEntry.make({
                ...entry,
                baseline: CoveragePackageBaseline.make({
                  ...actual,
                  files: { "packages/foreign/src/Code.ts": coverageFileBaseline(100, 0) },
                }),
              }),
            ],
            ["@beep/existing"]
          ),
        ]) {
          const failed = yield* invalid.pipe(Effect.flip);
          expect(failed._tag).toBe("QualityTaskConfigurationError");
        }
      })
    );
    it.effect("writes additive identities while retaining every existing package and file floor", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "coverage-additive-writer-" });
        yield* fs.makeDirectory(path.join(root, "packages/existing/coverage"), { recursive: true });
        yield* fs.makeDirectory(path.join(root, "standards"), { recursive: true });
        const rootManifest = yield* encodeJson({ name: "@beep/root", private: true, workspaces: ["packages/*"] });
        yield* fs.writeFileString(path.join(root, "package.json"), rootManifest);
        const packageManifest = yield* encodeJson({
          name: "@beep/existing",
          scripts: { coverage: "vitest run --coverage" },
        });
        yield* fs.writeFileString(path.join(root, "packages/existing/package.json"), packageManifest);
        const previous = CoverageRegressionBaseline.make({
          ...coverageRegressionBaseline,
          packages: {
            "@beep/existing": CoveragePackageBaseline.make({
              path: "packages/existing",
              ...coveragePercentages(95),
              uncovered: coverageUncovered(2),
              files: { "packages/existing/src/Existing.ts": coverageFileBaseline(100, 0) },
            }),
          },
        });
        const baselinePath = path.join(root, "standards/coverage.regression-baseline.jsonc");
        const original = yield* encodeCoverageRegressionBaseline(previous).pipe(Effect.flatMap(encodeJson));
        yield* fs.writeFileString(baselinePath, original);
        const measuredSummary = yield* encodeJson({
          total: vitestCoverageMetrics(10, 1, 10),
          "src/Existing.ts": vitestCoverageMetrics(10, 0, 0),
          "src/Added.ts": vitestCoverageMetrics(4, 3, 75),
        });
        yield* fs.writeFileString(path.join(root, "packages/existing/coverage/coverage-summary.json"), measuredSummary);
        const legacy = yield* encodeJson({
          schema_version: 1,
          generated_at: "2026-07-06T00:00:00.000Z",
          git_sha: "legacy-fixture",
          command: "bun run coverage:baseline:write",
          epsilon: 0.001,
          packages: { "@beep/existing": { path: "packages/existing" } },
        });
        yield* fs.writeFileString(baselinePath, legacy);
        const unsupported = yield* writeCoverageRegressionBaseline(root, true, ["@beep/existing"], {
          addMissingFilesOnly: true,
        }).pipe(Effect.flip);
        expect(unsupported._tag).toBe("QualityTaskConfigurationError");
        expect(unsupported.message).toContain("schema-v2 baseline write");
        const retainedLegacy = yield* fs.readFileString(baselinePath);
        expect(retainedLegacy).toBe(legacy);
        yield* fs.remove(baselinePath);
        const absent = yield* writeCoverageRegressionBaseline(root, true, ["@beep/existing"], {
          addMissingFilesOnly: true,
        }).pipe(Effect.flip);
        expect(absent._tag).toBe("QualityTaskConfigurationError");
        expect(absent.message).toContain("schema-v2 baseline write");
        const created = yield* fs.exists(baselinePath);
        expect(created).toBe(false);
        yield* fs.writeFileString(baselinePath, original);
        for (const rejected of [
          writeCoverageRegressionBaseline(root, false, ["@beep/existing"], { addMissingFilesOnly: true }),
          writeCoverageRegressionBaseline(root, true, ["@beep/existing"], {
            addMissingFilesOnly: true,
            replaceAll: true,
          }),
          writeCoverageRegressionBaseline(root, true, [], { addMissingFilesOnly: true }),
        ]) {
          const failed = yield* rejected.pipe(Effect.flip);
          expect(failed._tag).toBe("QualityTaskConfigurationError");
          const retained = yield* fs.readFileString(baselinePath);
          expect(retained).toBe(original);
        }
        yield* runGit(root, ["init"]);
        yield* runGit(root, ["config", "user.name", "Coverage Identity Fixture"]);
        yield* runGit(root, ["config", "user.email", "coverage@example.invalid"]);
        yield* runGit(root, ["add", "package.json"]);
        yield* runGit(root, ["commit", "-m", "test: seed additive coverage fixture"]);
        const git = yield* Git;
        const measuredHead = yield* git.revParse(root, "HEAD");
        const writeTimestamp = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
        yield* writeCoverageRegressionBaseline(root, true, ["@beep/existing"], { addMissingFilesOnly: true });
        const written = yield* fs
          .readFileString(baselinePath)
          .pipe(Effect.flatMap(decodeCoverageRegressionBaselineJsoncForTesting));
        const originalRow = yield* Effect.fromOption(R.get(previous.packages, "@beep/existing"));
        expect(written).toEqual({
          ...previous,
          generated_at: writeTimestamp,
          git_sha: measuredHead,
          command: "bun run coverage -- --filter=@beep/existing --write-baseline --add-missing-files-only",
          packages: {
            "@beep/existing": {
              ...originalRow,
              files: { ...originalRow.files, "packages/existing/src/Added.ts": coverageFileBaseline(75, 1) },
            },
          },
        });
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
    it.effect("requires exact scoped selectors for additive file writes and strips the control flag", () =>
      Effect.gen(function* () {
        const repoRoot = yield* findRepoRoot();
        for (const args of [
          ["--add-missing-files-only"],
          ["--write-baseline", "--add-missing-files-only"],
          ["--write-baseline", "--add-missing-files-only", "--replace-all", "--filter=@beep/repo-cli"],
          ["--write-baseline", "--add-missing-files-only", "--affected"],
          ["--write-baseline", "--add-missing-files-only", "--filter=...@beep/repo-cli"],
        ]) {
          const failure = yield* validateCoverageTaskArgsForTesting(repoRoot, args).pipe(Effect.flip);
          expect(failure._tag).toBe("QualityTaskConfigurationError");
        }
        const options = yield* validateCoverageTaskArgsForTesting(repoRoot, [
          "--write-baseline",
          "--add-missing-files-only",
          "--filter=@beep/repo-cli",
        ]);
        expect(options.addMissingFilesOnly).toBe(true);
        expect(options.expectedPackageNames).toEqual(["@beep/repo-cli"]);
        expect(options.args).not.toContain("--add-missing-files-only");
      })
    );
  });
  describe("CI coverage artifact planning", () => {
    it("keeps ordinary tests enabled while supplying deterministic coverage inputs", () => {
      const env = coverageProducerEnvironment();
      expect(env.CI).toBe("true");
      expect(env.GITHUB_ACTIONS).toBe("true");
      expect(env.VITEST_COVERAGE_RATCHET).toBeUndefined();
      expect(env.TERM_PROGRAM).toBeUndefined();
      expect(env.BEEP_FC_SEED).toEqual(expect.any(String));
      for (const name of ["TERM_PROGRAM", "TERM_PROGRAM_VERSION", "TURBO_API", "TURBO_TOKEN", "TURBO_TEAM"]) {
        expect(R.has(env, name)).toBe(true);
        expect(env[name]).toBeUndefined();
      }
      expect(R.has(env, "VITEST_COVERAGE_RATCHET")).toBe(true);
      expect(env.TURBO_CACHE).toBe("local:rw");
    });
    it.effect("plans full coverage owners and binds the configured workflow attempt", () =>
      Effect.gen(function* () {
        const root = yield* coverageArtifactPlanRepository();
        const plan = yield* resolveCiCoverageArtifactPlan(root, []).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, artifactPlanConfiguration)
        );
        expect(plan.scoped).toBe(false);
        expect(A.map(plan.owners, (owner) => owner.packageName)).toEqual(["@beep/covered"]);
        expect(plan.identity.runId).toBe("123");
        expect(plan.identity.runAttempt).toBe(2);
        expect(plan.identity.baseSha).toBe(plan.identity.executionSha);
      })
    );
    it.effect("honors explicit comparison base and exact scoped package selection", () =>
      Effect.gen(function* () {
        const root = yield* coverageArtifactPlanRepository();
        const plan = yield* resolveCiCoverageArtifactPlan(
          root,
          ["--write-baseline", "--filter=@beep/covered"],
          "HEAD"
        ).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_COVERAGE_RUN_ID: "123",
              BEEP_COVERAGE_RUN_ATTEMPT: "2",
              TURBO_SCM_BASE: "nonexistent-base",
            })
          )
        );
        expect(plan.scoped).toBe(true);
        expect(A.map(plan.owners, (owner) => owner.packageName)).toEqual(["@beep/covered"]);
        expect(plan.identity.baseSha).toBe(plan.identity.executionSha);
      })
    );
    it.effect("uses the canonical origin/main base when no override is configured", () =>
      Effect.gen(function* () {
        const root = yield* coverageArtifactPlanRepository();
        yield* runGit(root, ["branch", "origin/main", "HEAD"]);
        const plan = yield* resolveCiCoverageArtifactPlan(root, []).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              BEEP_COVERAGE_RUN_ID: "123",
              BEEP_COVERAGE_RUN_ATTEMPT: "2",
            })
          )
        );
        expect(plan.identity.baseSha).toBe(plan.identity.executionSha);
        expect(A.map(plan.owners, (owner) => owner.packageName)).toEqual(["@beep/covered"]);
      })
    );
    it.effect("emits an explicit empty plan for an unchanged affected checkout", () =>
      Effect.gen(function* () {
        const root = yield* coverageArtifactPlanRepository();
        const plan = yield* resolveCiCoverageArtifactPlan(root, ["--affected"], "HEAD").pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, artifactPlanConfiguration)
        );
        expect(plan.scoped).toBe(true);
        expect(plan.owners).toEqual([]);
      })
    );
  });

  describe("quality task adapter", () => {
    it.effect(
      "runs Bun audit with active OSV ignores and reports dropped entries",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "quality-bun-audit-" });
            yield* fs.writeFileString(
              path.join(repoRoot, "osv-scanner.toml"),
              A.join(
                [
                  "[[IgnoredVulns]]",
                  'id = "GHSA-active"',
                  "",
                  "[[IgnoredVulns]]",
                  'id = "GHSA-expired"',
                  "ignoreUntil = definitely-not-a-date",
                  "",
                  "[[PackageOverrides]]",
                  'name = "braces"',
                  'version = "3.0.3"',
                  'ecosystem = "npm"',
                  "ignore = true",
                  "effectiveUntil = 2999-01-01T00:00:00Z",
                  'reason = "GHSA-vfj7-8cjw-p6xm is reviewed for this exact package version."',
                  "",
                ],
                "\n"
              )
            );
            yield* fs.writeFileString(path.join(repoRoot, "bun.lock"), '{"packages":{"braces":["braces@3.0.3"]}}');

            const spawner = cheapGatesSpawner(A.empty());
            yield* runBunAudit(repoRoot).pipe(Effect.provideServiceEffect(Git, Git.make), provideSpawner(spawner));

            expect(spawnedLines(spawner)).toEqual([
              "bun audit --audit-level=high --ignore=GHSA-active --ignore=GHSA-vfj7-8cjw-p6xm",
            ]);
            const logLines2 = yield* TestConsole.logLines;
            expect(A.join(A.filter(logLines2, isString), "\n")).toContain("GHSA-expired");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("mirrors exact package overrides only for their sole unexpired lockfile version", () => {
      const config = A.join(
        [
          "[[PackageOverrides]]",
          'name = "braces"',
          'version = "3.0.3"',
          'ecosystem = "npm"',
          "ignore = true",
          "effectiveUntil = 2026-10-16T00:00:00Z",
          'reason = "GHSA-vfj7-8cjw-p6xm reviewed."',
        ],
        "\n"
      );
      const now = DateTime.makeUnsafe("2026-10-02T00:00:00Z");
      const select = (lock: string, at = now) => selectOsvPackageOverrideIdsForAudit(config, lock, at);

      expect(select('{"packages":{"braces":["braces@3.0.3"]}}')).toEqual(["GHSA-vfj7-8cjw-p6xm"]);
      expect(
        selectOsvPackageOverrideIdsForAudit(
          Str.replace('ecosystem = "npm"', 'ecosystem = "Go"')(config),
          '{"packages":{"braces":["braces@3.0.3"]}}',
          now
        )
      ).toEqual([]);
      expect(
        selectOsvPackageOverrideIdsForAudit(
          Str.replace("ignore = true", "ignore = false")(config),
          '{"packages":{"braces":["braces@3.0.3"]}}',
          now
        )
      ).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.4"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"braces@other":["braces@3.0.4"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"parent/braces":["braces@3.0.2"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"parent/braces@3.0.2":["braces@3.0.2"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"braces-legacy":["braces@3.0.2"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"parent/braces-legacy":["braces@3.0.2"]}}')).toEqual([]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"braces-legacy":["braces@3.0.3"]}}')).toEqual([
        "GHSA-vfj7-8cjw-p6xm",
      ]);
      expect(select('{"packages":{"braces":["braces@3.0.3"],"parent/braces":["braces@3.0.3"]}}')).toEqual([
        "GHSA-vfj7-8cjw-p6xm",
      ]);
      expect(select('{"packages":{"braces":["braces@3.0.3"]}}', DateTime.makeUnsafe("2026-10-17T00:00:00Z"))).toEqual(
        []
      );
      expect(select('{"packages":{"braces":["braces@3.0.3"]}')).toEqual([]);
    });

    it.effect("scans changed ignored paths through root discovery instead of explicit targets", () =>
      Effect.gen(function* () {
        const ignored = "goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts";
        const changed = "packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts";
        const spawner = sastSpawner(`${ignored}\0${changed}\0`);
        yield* runGithubChecks("sast").pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        );
        const scan = A.findFirst(spawnedArgv(spawner), (args) => A.contains(args, "scan"));
        scan.pipe(O.isSome, assertTrue);
        if (O.isSome(scan)) {
          expect(A.takeRight(scan.value, 5)).toEqual(["--include", `/${ignored}`, "--include", `/${changed}`, "."]);
        }
        const fs = yield* FileSystem.FileSystem;
        const ignoreRules = yield* fs.readFileString(
          NodeURL.fileURLToPath(new URL("../../../../../.semgrepignore", import.meta.url))
        );
        expect(ignoreRules).toContain("goals/**/history/outputs/");
      })
    );

    it.effect("bounds Semgrep include batches and propagates a later batch failure", () =>
      Effect.gen(function* () {
        const changed = A.makeBy(129, (index) => `packages/example/src/file-${index}.ts`);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        let scanCount = 0;
        const spawner = ScriptedSpawner.make((_command, args) => {
          if (A.contains(args, "scan")) {
            scanCount++;
            return { exit: scanCount === 2 ? 2 : 0 };
          }
          return { stdout: A.contains(args, "--name-only") ? `${A.join(changed, "\0")}\0` : "" };
        });
        const failure = yield* runGithubChecks("sast").pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner),
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            exists: () => Effect.succeed(true),
            realPath: (file) => Effect.succeed(path.resolve(file)),
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive,
          Effect.flip
        );
        expect(failure.message).toContain("exit code 2");
        const scans = A.filter(spawnedArgv(spawner), (args) => A.contains(args, "scan"));
        expect(A.map(scans, (args) => A.length(A.filter(args, (arg) => arg === "--include")))).toEqual([128, 1]);
        expect(A.flatMap(scans, (args) => A.filter(args, Str.startsWith("/packages/example/")))).toEqual(
          A.map(changed, (file) => `/${file}`)
        );
        expect(A.map(scans, (args) => A.last(args).pipe(O.getOrNull))).toEqual([".", "."]);
      })
    );

    it.effect("runs the first-party Semgrep rule tests before the changed-file filter", () =>
      Effect.gen(function* () {
        const spawner = sastSpawner("");
        yield* runGithubChecks("sast").pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        );
        const commands = spawnedArgv(spawner);
        const ruleTests = A.findFirst(commands, (args) => A.contains(args, "--test"));
        assertSome(O.map(ruleTests, A.takeRight(3)), [
          "--config",
          "/src/.semgrep/first-party.yml",
          "/src/goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts",
        ]);
        // No changed JavaScript/TypeScript files: the scan is skipped, the rule tests are not.
        expect(A.filter(commands, (args) => A.contains(args, "scan"))).toEqual([]);
      })
    );

    it.effect("pairs every first-party Semgrep rule with ruleid and ok fixture cases", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const read = (relative: string) =>
          fs.readFileString(NodeURL.fileURLToPath(new URL(`../../../../../${relative}`, import.meta.url)));
        const rules = yield* read(".semgrep/first-party.yml");
        const fixture = yield* read(
          "goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts"
        );
        const ruleIds = pipe(
          Str.split(rules, "\n"),
          A.map(Str.trim),
          A.filter(Str.startsWith("- id: ")),
          A.map(Str.slice(6))
        );
        expect(ruleIds).toContain("beep-no-eval");
        const unpaired = A.filter(
          ruleIds,
          (id) => !Str.includes(`// ruleid: ${id}\n`)(fixture) || !Str.includes(`// ok: ${id}\n`)(fixture)
        );
        expect(unpaired).toEqual([]);
      })
    );

    it.effect("escapes and anchors literal changed paths in Semgrep include patterns", () =>
      Effect.gen(function* () {
        const changed = ["apps/todox/src/app/[id]/page.tsx", "!route.ts", "#route.ts", "src/a*b?c\\d.ts"];
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = sastSpawner(`${A.join(changed, "\0")}\0`);
        yield* runGithubChecks("sast").pipe(
          Effect.provideServiceEffect(Git, Git.make),
          provideSpawner(spawner),
          Effect.provideService(FileSystem.FileSystem, {
            ...fs,
            exists: () => Effect.succeed(true),
            realPath: (file) => Effect.succeed(path.resolve(file)),
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        );
        const scan = A.findFirst(spawnedArgv(spawner), (args) => A.contains(args, "scan"));
        scan.pipe(O.isSome, assertTrue);
        if (O.isSome(scan)) {
          expect(A.takeRight(scan.value, 9)).toEqual([
            "--include",
            "/apps/todox/src/app/\\[id\\]/page.tsx",
            "--include",
            "/\\!route.ts",
            "--include",
            "/\\#route.ts",
            "--include",
            "/src/a\\*b\\?c\\\\d.ts",
            ".",
          ]);
        }
      })
    );

    it.effect(
      "runs the review-fix command sequence with its default range",
      flow(
        Effect.fnUntraced(
          function* () {
            const spawner = cheapGatesSpawner(A.empty());
            yield* runGithubChecks("review-fix").pipe(
              Effect.provideServiceEffect(Git, Git.make),
              provideSpawner(spawner)
            );

            expect(spawnedLines(spawner)).toContain("bun run build -- --affected --summarize");
            expect(spawnedLines(spawner)).toContain(
              A.join(["bun", "run", ...reviewFixDocgenLocalArgsForTesting("origin/main", "HEAD")], " ")
            );
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

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

    it("composes the package audit from the cached build, check and lint graphs", () =>
      withoutCi(() => {
        const steps = rootQualityStepsForTesting(
          "/repo",
          getInvocation(["audit", "--filter=@beep/schema", "--summarize"])
        );

        expect(A.map(steps, (step) => step.label)).toEqual(["build", "check", "lint"]);
        for (const [index, task] of ["build", "check", "lint"].entries()) {
          expect(steps[index]).toMatchObject({
            label: task,
            command: "bunx",
            args: expectedRootTurboArgs(task, ["--filter=@beep/schema", "--summarize"]),
            cwd: "/repo",
          });
        }
      }));

    it("adds the repo-wide check and lint policy steps to an unscoped package audit", () =>
      withoutCi(() => {
        const labels = A.map(
          rootQualityStepsForTesting("/repo", getInvocation(["audit", "packages"])),
          (step) => step.label
        );

        expect(A.take(labels, 2)).toEqual(["build", "check"]);
        expect(labels).toContain("quality:test-tsgo");
        expect(labels).toContain("lint");
        expect(labels).toContain("lint:policy:cheap");
      }));

    it("keeps package audit cacheable by default for local runs", () =>
      withoutCi(() => {
        const steps = rootQualityStepsForTesting("/repo", getInvocation(["audit", "--filter=@beep/schema"]));

        expect(steps).toHaveLength(3);
        expect(steps[0]?.args).toEqual(expectedRootTurboArgs("build", ["--filter=@beep/schema"]));
      }));

    it("forces every package audit graph in CI unless cache behavior is explicit", () =>
      withEnvVar("CI", "true", () => {
        const steps = rootQualityStepsForTesting(
          "/repo",
          getInvocation(["audit", "--filter=@beep/schema", "--dry=json"])
        );

        expect(steps).toHaveLength(3);
        for (const [index, task] of ["build", "check", "lint"].entries()) {
          expect(steps[index]?.args).toEqual([
            "turbo",
            "run",
            task,
            "--concurrency=4",
            "--force",
            "--filter=@beep/schema",
            "--dry=json",
          ]);
        }
      }));

    it("honors explicit audit cache-control args in CI", () =>
      withEnvVar("CI", "true", () => {
        const steps = rootQualityStepsForTesting(
          "/repo",
          getInvocation(["audit", "--cache=local:rw", "--filter=@beep/schema"])
        );

        expect(steps).toHaveLength(3);
        expect(steps[0]?.args).toEqual([
          "turbo",
          "run",
          "build",
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

    it("covers the primitive quality-command adapters without spawning commands", () => {
      const helpers = qualityCommandPrimitiveHelpersForTesting;

      expect(helpers.normalizeExtraArgs(undefined)).toEqual([]);
      expect(helpers.normalizeExtraArgs("--watch")).toEqual(["--watch"]);
      expect(helpers.normalizeExtraArgs(new Set<unknown>(["--run", 1]))).toEqual(["--run"]);
      expect(helpers.normalizeExtraArgs(42)).toEqual([]);
      expect(helpers.withExitCode("quality:test", "bun", ["run", "test"], 2)).toMatchObject({
        command: "bun run test",
        exitCode: 2,
        message: "quality:test failed with exit code 2.",
      });
      expect(Effect.isEffect(helpers.runBun("/repo", "quality:test", ["test"]))).toBe(true);
      expect(Effect.isEffect(helpers.runBunWithEnv("/repo", "quality:test", ["test"], { CI: "true" }))).toBe(true);
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
        "quality:jsdoc-ratchet",
        "quality:docgen",
        "quality:doctest",
        "quality:coverage",
        "quality:codegen",
        "quality:commitlint",
        "quality:desktop-ipc",
        "quality:test-unit",
        "quality:test-integration",
        "quality:storybook",
      ]);
      expect(A.every(lanes, (lane) => lane.stage === "repo-quality")).toBe(true);
      expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
      expect(qualityLaneArgs(lanes, "quality:build")).toEqual([
        "run",
        "beep",
        "ci",
        "lane",
        "build",
        "--affected",
        "--base",
        "origin/main",
        "--summarize",
      ]);
      // The Shadcn Lint context is replayed by the `lint:shadcn` state task inside
      // `quality:lint-policy`; no separate pre-push lane runs the same oxlint walk again.
      expect(A.some(lanes, (lane) => lane.id === "quality:shadcn-lint")).toBe(false);
      expect(A.some(lanes, (lane) => A.contains(lane.step.args, "shadcn-lint"))).toBe(false);
      expect(qualityLaneArgs(lanes, "quality:jsdoc-ratchet")).toEqual(["run", "beep", "ci", "lane", "jsdoc-ratchet"]);
      // `quality test-tsgo` has one owner, the lint-policy plan inside `quality:lint-policy`;
      // the smoke canary rides inside root `bun run check`. No lane runs either again.
      expect(A.some(lanes, (lane) => A.contains(lane.step.args, "test-tsgo"))).toBe(false);
      expect(A.some(lanes, (lane) => A.contains(lane.step.args, "tsgo-smoke"))).toBe(false);
      expect(A.map(githubCheckLanePlan.githubCheckLaneWaves(lanes), (wave) => wave.wave)).toEqual([
        "preflight",
        "heavy",
        "test",
        "documentation",
      ]);
    });

    it("plans parallel cheap preflight followed by an isolated schema catalog wave", () => {
      const lanes = githubCheckCheapGateLanes("/repo");

      expect(A.map(lanes, (lane) => lane.id)).toEqual([
        "version-sync:check-runtime",
        "quality:cache-policy",
        "goals:index-check",
        "explore:atlas-check",
        "observability:catalog-check",
        "quality:catalog-usage",
        "repo-sanity:tsconfig-sync",
        "lint:effect-imports",
        "lint:effect-imports-markdown",
        "lint:markdown-fences",
        "lint:retired-effect-paths",
        "lint:retired-iri-authorities",
        "lint:schema-tag-idioms",
        "lint:holds",
        "lint:schema-first",
        "lint:effect-vitest",
        "lint:allowlist",
        "goals:doctor",
        "lint:schema-catalog",
        "lint:oxlint",
        "quality:jsdoc-ratchet:regenerated",
        "quality:jsdoc-ratchet:committed",
        "fallow:audit",
        "fallow:dead-code",
        "fallow:health",
      ]);
      expect(qualityLaneArgs(lanes, "version-sync:check-runtime")).toEqual([
        "run",
        "beep",
        "version-sync",
        "--check-runtime",
      ]);
      expect(A.every(lanes, (lane) => lane.wave === (lane.id === "lint:schema-catalog" ? "heavy" : "preflight"))).toBe(
        true
      );
      expect(A.map(githubCheckLanePlan.githubCheckLaneWaves(lanes), (wave) => wave.wave)).toEqual([
        "preflight",
        "heavy",
      ]);
      expect(qualityLaneArgs(lanes, "repo-sanity:tsconfig-sync")).toEqual(
        expectedTurboArgs("config-sync:check", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:effect-imports")).toEqual(
        expectedTurboArgs("lint:effect-imports", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:effect-imports-markdown")).toEqual(
        expectedTurboArgs("lint:effect-imports-markdown", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:markdown-fences")).toEqual(
        expectedTurboArgs("lint:markdown-fences", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:retired-effect-paths")).toEqual(
        expectedTurboArgs("lint:retired-effect-paths", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:retired-iri-authorities")).toEqual(
        expectedTurboArgs("lint:retired-iri-authorities", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:schema-tag-idioms")).toEqual(
        expectedTurboArgs("lint:schema-tag-idioms", ["--summarize"])
      );
      // The scan rides the cached root Turbo task (the same one Lint Policy runs), not a direct CLI lane.
      expect(qualityLaneArgs(lanes, "lint:effect-vitest")).toEqual(
        expectedTurboArgs("lint:effect-vitest", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "quality:catalog-usage")).toEqual(["run", "beep", "quality", "catalog-usage"]);
      expect(qualityLaneArgs(lanes, "lint:schema-catalog")).toEqual(
        expectedTurboArgs("lint:schema-catalog", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "lint:oxlint")).toEqual(["run", "lint:oxlint"]);
      // The regenerated ratchet rides the cached root chain
      // (`//#jsdoc:inventory:check` -> `//#jsdoc:ratchet:check`), not an in-process scan.
      expect(qualityLaneArgs(lanes, "quality:jsdoc-ratchet:regenerated")).toEqual(
        expectedTurboArgs("jsdoc:ratchet:check", ["--summarize"])
      );
      expect(qualityLaneArgs(lanes, "quality:jsdoc-ratchet:committed")).toEqual([
        "run",
        "beep",
        "quality",
        "jsdoc-ratchet",
      ]);
      expect(A.map(githubCheckLanesForModeForTesting("/repo", "cheap-gates"), (lane) => lane.id)).toEqual(
        A.map(lanes, (lane) => lane.id)
      );
    });

    it("hands the cheap tier's JSDoc inventory to the pre-push ratchet through the Turbo content hash", () => {
      const cheap = githubCheckLanesForModeForTesting("/repo", "cheap-gates");
      const prePush = githubCheckLanesForModeForTesting("/repo", "pre-push");
      // Cheap tier: one Turbo run of the ratchet task, whose dependency produces the inventory.
      expect(qualityLaneArgs(cheap, "quality:jsdoc-ratchet:regenerated")).toEqual(
        expectedTurboArgs("jsdoc:ratchet:check", ["--summarize"])
      );
      // Pre-push: the hosted lane body without `--inventory`, so it re-enters the same
      // producer task. A same-tree run restores the cheap tier's inventory from cache; a
      // different head or tree misses and rescans. A bare file path would skip that check.
      expect(qualityLaneArgs(prePush, "quality:jsdoc-ratchet")).toEqual(["run", "beep", "ci", "lane", "jsdoc-ratchet"]);
      const body = ciLaneStepsForTesting(
        "/repo",
        "jsdoc-ratchet",
        CiLaneRunOptions.make({
          affected: false,
          base: "origin/main",
          head: "HEAD",
          summarize: false,
          mode: "affected",
          to: "HEAD",
          last: false,
          changesetStatus: false,
          validateEnvelopes: false,
        })
      );
      expect(A.map(body, (step) => step.label)).toEqual(["ci:jsdoc-ratchet:inventory", "ci:jsdoc-ratchet:ratchet"]);
      expect(body[0]?.args).toEqual(expectedTurboArgs("jsdoc:inventory:check", ["--summarize"]));
      expect(body[1]?.args).toEqual([
        "run",
        "beep",
        "quality",
        "jsdoc-ratchet",
        "--inventory",
        ".beep/ci/jsdoc-documentation.inventory.jsonc",
      ]);
      // No lane in either tier still regenerates in-process.
      expect(A.some([...cheap, ...prePush], (lane) => A.contains(lane.step.args, "--regenerate"))).toBe(false);
    });

    // TTC ruling 28: a lane id names the command it runs and doubles as the step
    // label (the `[beep-cli] <label>` log prefix); the tier is metadata, so one
    // command keeps one id whichever tier schedules it.
    it("names every registered lane after its command with the label as its log prefix", () => {
      const cheapGateLanes = githubCheckLanesForModeForTesting("/repo", "cheap-gates");
      const prePushLanes = githubCheckLanesForModeForTesting("/repo", "pre-push");
      const registered = [githubCheckChangesetStatusLane("/repo"), ...cheapGateLanes, ...prePushLanes];
      const commandOf = (lane: GithubCheckLaneSpec): string => A.join([lane.step.command, ...lane.step.args], " ");
      const idsByCommand = A.reduce(registered, HM.empty<string, ReadonlyArray<string>>(), (acc, lane) =>
        HM.modifyAt(acc, commandOf(lane), (ids) =>
          O.some(A.dedupe(A.append(O.getOrElse(ids, A.empty<string>), lane.id)))
        )
      );

      expect(A.filter(registered, (lane) => lane.step.label !== lane.id)).toEqual([]);
      expect(
        A.filter(registered, (lane) => Str.startsWith("cheap-gates:")(lane.id) || Str.startsWith("pre-push:")(lane.id))
      ).toEqual([]);
      expect(A.filter(HM.toEntries(idsByCommand), ([, ids]) => A.length(ids) > 1)).toEqual([]);
      expect(A.every(cheapGateLanes, (lane) => lane.tier === "cheap-gates")).toBe(true);
      expect(A.every(prePushLanes, (lane) => lane.tier === "pre-push")).toBe(true);
      // D9: the cheap tier runs four abreast and heavy pre-push lanes stay serial on
      // the `current` and `ci` profiles; the workstation profile widens both.
      const profile = withEnvVar("BEEP_QUALITY_CHEAP_GATE_CONCURRENCY", undefined, localQualityConcurrencyPlan);
      expect(githubCheckTierConcurrency("cheap-gates", profile)).toBe(profile.cheapGates);
      expect(githubCheckTierConcurrency("pre-push", profile)).toBe(profile.prePushLanes);
      expect(
        githubCheckTierConcurrency("cheap-gates", resolveQualityConcurrencyPlan(currentDetection, {}, O.none()))
      ).toBe(4);
      expect(
        githubCheckTierConcurrency("pre-push", resolveQualityConcurrencyPlan(currentDetection, {}, O.none()))
      ).toBe(1);
    });

    it("keeps cheap gates within the configured worker budget and warns on malformed settings", () => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        const profileDefault = withoutCi(() =>
          withEnvVar("BEEP_QUALITY_CHEAP_GATE_CONCURRENCY", undefined, () => localQualityConcurrencyPlan().cheapGates)
        );
        for (const [value, expected, malformed] of [
          [undefined, profileDefault, false],
          ["1", 1, false],
          ["2", 2, false],
          ["3", 3, false],
          ["4", 4, false],
          ["5", 5, false],
          ["16", 16, false],
          ["0", 1, true],
          ["17", 1, true],
          ["2.5", 1, true],
          ["01", 1, true],
          ["serial", 1, true],
          ["", 1, true],
        ] as const) {
          warning.mockClear();
          withoutCi(() =>
            withEnvVar("BEEP_QUALITY_CHEAP_GATE_CONCURRENCY", value, () => {
              const plan = localQualityConcurrencyPlan();
              expect(githubCheckTierConcurrency("cheap-gates", plan)).toBe(expected);
              expect(warning).toHaveBeenCalledTimes(malformed ? 1 : 0);
              if (malformed) {
                expect(warning).toHaveBeenCalledWith(
                  "[quality] Invalid BEEP_QUALITY_CHEAP_GATE_CONCURRENCY; expected an integer from 1 to 16. Using 1 lane."
                );
              }
              expect(githubCheckTierConcurrency("pre-push", plan)).toBe(plan.prePushLanes);
            })
          );
        }
        // Hosted-shaped environments keep the pre-profile domain.
        warning.mockClear();
        withEnvVar("CI", "true", () =>
          withEnvVar("BEEP_QUALITY_CHEAP_GATE_CONCURRENCY", "5", () => {
            expect(localQualityConcurrencyPlan().cheapGates).toBe(1);
            expect(warning).toHaveBeenCalledWith(
              "[quality] Invalid BEEP_QUALITY_CHEAP_GATE_CONCURRENCY; expected 1, 2, 3 or 4. Using 1 lane."
            );
          })
        );
      } finally {
        warning.mockRestore();
      }
    });

    it("runs shared lanes abreast and exclusive lanes alone inside one wave", () => {
      const lane = (id: string, exclusive = false, blockedBy: ReadonlyArray<string> = []) => {
        const spec = githubCheckLanePlan.githubCheckLane(
          id,
          "pre-push",
          "repo-quality",
          "test",
          githubCheckLanePlan.bunRunLane("/repo", id, ["run", id]),
          blockedBy
        );
        return exclusive ? githubCheckLanePlan.exclusiveGithubCheckLane(spec) : spec;
      };
      const ids = (segments: ReadonlyArray<ReadonlyArray<readonly [number, GithubCheckLaneSpec]>>) =>
        A.map(segments, (segment) => A.map(segment, ([index, entry]) => `${index}:${entry.id}`));

      const lanes = [lane("a"), lane("b"), lane("c", true), lane("d"), lane("e"), lane("f"), lane("g", false, ["e"])];
      // Only an exclusive lane splits the wave; `g` shares the pool with its
      // blocker `e` and waits on it at run time instead.
      expect(ids(githubCheckWaveSegments(lanes))).toEqual([["0:a", "1:b"], ["2:c"], ["3:d", "4:e", "5:f", "6:g"]]);
      expect(ids(githubCheckWaveSegments([lane("x", true), lane("y", true)]))).toEqual([["0:x"], ["1:y"]]);
      expect(githubCheckWaveSegments([])).toEqual([]);
      // Every declared exclusive pre-push lane owns shared state no neighbour may touch.
      expect(
        pipe(
          githubCheckPrePushLanes("/repo", [githubCheckChangesetStatusLane("/repo")]),
          A.filter((entry) => entry.isolation === "exclusive"),
          A.map((entry) => entry.id)
        )
      ).toEqual([
        "quality:build",
        "quality:lint",
        "quality:lint-policy",
        "quality:check",
        "quality:coverage",
        "quality:codegen",
        "quality:test-integration",
      ]);
      expect(A.every(githubCheckCheapGateLanes("/repo"), (entry) => entry.isolation === "shared")).toBe(true);
    });

    it("folds consecutive same-wave lanes of an evidence order into one wave", () => {
      const lane = (id: string, wave: "preflight" | "heavy" | "test") =>
        githubCheckLanePlan.githubCheckLane(
          id,
          "pre-push",
          "repo-quality",
          wave,
          githubCheckLanePlan.bunRunLane("/repo", id, ["run", id])
        );
      const waves = githubCheckLanePlan.githubCheckOrderedLaneWaves([
        lane("a", "preflight"),
        lane("b", "preflight"),
        lane("c", "heavy"),
        lane("d", "preflight"),
        lane("e", "test"),
        lane("f", "test"),
      ]);
      expect(A.map(waves, (wave) => [wave.wave, A.map(wave.lanes, (entry) => entry.id)])).toEqual([
        ["preflight", ["a", "b"]],
        ["heavy", ["c"]],
        ["preflight", ["d"]],
        ["test", ["e", "f"]],
      ]);
      expect(githubCheckLanePlan.githubCheckOrderedLaneWaves([])).toEqual([]);
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
      expect(qualityLaneArgs(lanes, "quality:storybook")).toEqual(hostedArgs("storybook"));

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
      withoutCi(() =>
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
        "repo-sanity:config-typecheck",
        "repo-sanity:goals-ops-typecheck",
        "repo-sanity:bun-audit",
      ]);
      expect(A.every(lanes, (lane) => lane.stage === "repo-sanity")).toBe(true);
      expect(lanes[0]?.step.args).toEqual(["run", "beep", "quality", "changeset-graph"]);
      expect(lanes[2]?.step.args).toEqual(expectedTurboArgs("fallow:boundaries:config-check", ["--summarize"]));
      expect(lanes[6]?.step.args).toEqual(["run", "check:configs"]);
      expect(lanes[7]?.step).toMatchObject({
        command: "bunx",
        args: ["tsrs", "-p", "goals/tsconfig.ops.json", "--noEmit", "--pretty", "false"],
      });
      expect(lanes[8]?.step.args).toEqual(["run", "beep", "quality", "bun-audit"]);
      // `quality:cache-policy` is owned by the cheap-gates tier alone; the pre-push
      // copy made a full verify pay the dry plan twice.
      expect(
        qualityLaneArgs(githubCheckLanesForModeForTesting("/repo", "cheap-gates"), "quality:cache-policy")
      ).toEqual(["run", "beep", "quality", "cache-policy"]);
      for (const mode of ["repo-sanity", "quality", "pre-push"] as const) {
        expect(
          A.some(githubCheckLanesForModeForTesting("/repo", mode), (lane) => lane.id === "quality:cache-policy")
        ).toBe(false);
      }
    });

    it("maps pre-push external gates after repo diagnostics", () => {
      const lanes = githubCheckPrePushExternalLanesForTesting("/repo");

      expect(A.map(lanes, (lane) => lane.id)).toEqual([
        "quality:secrets",
        "quality:security",
        "quality:sast",
        "quality:nix",
      ]);
      expect(A.map(lanes, (lane) => lane.stage)).toEqual([
        "diff-security",
        "diff-security",
        "diff-security",
        "environment",
      ]);
      expect(A.every(lanes, (lane) => lane.blockedBy.length === 0)).toBe(true);
    });

    it.effect("decodes the failure policy and wave report schemas", () =>
      Effect.gen(function* () {
        const decodedGithubCheckFailurePolicy = yield* decodeGithubCheckFailurePolicy("fail-fast");
        expect(decodedGithubCheckFailurePolicy).toBe("fail-fast");
        const report = yield* decodeGithubCheckRunReport({
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
        assertNone(report.firstRed);
        expect(report.skippedAfterRed).toBe(0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("decodes legacy lane rows and encodes unknown input digests as null", () =>
      Effect.gen(function* () {
        const legacy = yield* decodeQualityTaskLaneRun({
          id: "check",
          label: "ci:check",
          status: "passed",
        });
        assertNone(legacy.startedAt);
        assertNone(legacy.endedAt);
        assertNone(legacy.durationMs);
        assertNone(legacy.exitCode);
        assertNone(legacy.inputDigest);
        assertNone(legacy.redSchedulingDecision);
        // TTC ruling 68: `inputPackages` arrived after `quality-task-lane-run/v1`
        // shipped, so a report written before it still decodes, with an empty scope.
        expect(legacy.inputPackages).toStrictEqual([]);

        const legacyReport = yield* decodeQualityTaskLaneRunReportJson(
          '{"schemaVersion":"quality-task-lane-run/v1","lanes":[{"id":"check","label":"ci:check","status":"passed"}]}'
        );
        expect(legacyReport.lanes[0]?.inputPackages).toStrictEqual([]);

        const encoded = yield* encodeQualityTaskLaneRunReport(
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            lanes: [legacy],
          })
        );
        expect(encoded.lanes[0]?.inputDigest).toBeNull();
        expect(encoded.lanes[0]?.inputPackages).toStrictEqual([]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("records timings, exits, and only executor-provided lane digests", () =>
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
          deepStrictEqual(
            A.map(report.lanes, (lane) => lane.exitCode),
            [O.some(0), O.some(7)]
          );
          {
            const optionUnderTest = report.lanes[0]?.inputDigest;
            const expectedOptionValue = "turbo-task-hash";
            assertDefined(optionUnderTest);
            assertSome(optionUnderTest, expectedOptionValue);
          }
          {
            const optionUnderTest = report.lanes[1]?.inputDigest;
            assertDefined(optionUnderTest);
            assertNone(optionUnderTest);
          }
          expect(A.every(report.lanes, (lane) => O.exists(lane.startedAt, Str.isNonEmpty))).toBe(true);
          expect(A.every(report.lanes, (lane) => O.exists(lane.endedAt, Str.isNonEmpty))).toBe(true);
          expect(A.every(report.lanes, (lane) => O.exists(lane.durationMs, (duration) => duration >= 0))).toBe(true);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("tolerates an outcome whose mutable lane source disappears while the step runs", () =>
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
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("emits machine-readable lane reports from both wrapper writers", () =>
      Effect.gen(function* () {
        yield* runQualityTaskGithubCheckLaneWaves("pre-push", [], "fail-fast");
        yield* runQualityTaskStreamingLaneGroup("ci:local", []);
        const logLines3 = yield* TestConsole.logLines;
        const reportLines = pipe(
          logLines3,
          A.filter(isString),
          A.filter(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX))
        );
        expect(reportLines).toHaveLength(2);
        yield* Effect.forEach(
          reportLines,
          (line) => decodeQualityTaskLaneRunReportJson(Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(line)),
          { discard: true }
        );
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("hands a wrapper lane a ledger and records the digest its child declared", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        // The fixture stands in for `beep ci lane`: it declares one digest to the ledger the parent named.
        const manifest =
          "{\"name\": \"wrapper-lane-fixture\", \"private\": true, \"scripts\": {\"beep\": \"bun -e \\\"const fs = require('node:fs'); const path = require('node:path'); const ledger = process.env.BEEP_TURBO_LANE_LEDGER; fs.mkdirSync(path.dirname(ledger), { recursive: true }); fs.appendFileSync(ledger, JSON.stringify({ _tag: 'declared', digest: { digest: 'declared', summaryIds: ['run-1'], tasks: [{ taskId: '//#lint:typos', hash: 'h1', cacheStatus: 'HIT' }] } }) + '\\\\\\\\n'); fs.appendFileSync(ledger, JSON.stringify({ _tag: 'closed', attempted: 1 }) + '\\\\\\\\n');\\\"\"}}";
        yield* fs.writeFileString(path.join(tempDir, "package.json"), manifest);
        const wrapper = QualityTaskStep.make({
          label: "quality:lint",
          command: "bun",
          args: ["run", "beep", "ci", "lane", "lint"],
          cwd: tempDir,
        });
        yield* runQualityTaskStreamingLaneGroup("ci:local", [["lint", wrapper, O.none()]]);
        const logLines4 = yield* TestConsole.logLines;
        const report = yield* pipe(
          logLines4,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow,
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length),
          decodeQualityTaskLaneRunReportJson
        );
        const expected = yield* foldTurboLaneDigests([
          TurboLaneDigest.make({
            digest: "declared",
            summaryIds: ["run-1"],
            tasks: [{ taskId: "//#lint:typos", hash: "h1", cacheStatus: "HIT" }],
          }),
        ]);
        expect(report.lanes[0]?.status).toBe("passed");
        deepStrictEqual(
          report.lanes[0]?.inputDigest,
          O.map(expected, (digest) => digest.digest)
        );
        // The parent consumes the ledger once read.
        const leftovers = yield* fs
          .readDirectory(path.join(tempDir, ".beep", "quality", "lane-ledgers"))
          .pipe(Effect.orElseSucceed(() => A.empty<string>()));
        expect(leftovers).toEqual([]);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("closes the ledger a parent named with zero attempts when no direct Turbo step ran", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const ledger = path.join(tempDir, "lane", "ledger.jsonl");
        yield* withEnvVarEffect(
          TURBO_LANE_LEDGER_ENV,
          ledger,
          runQualityTaskStreamingLaneGroup("ci:local", [
            ["check", bunScriptStep("ci:check", "process.exit(0)"), O.none()],
          ])
        );
        const readFileString5 = yield* fs.readFileString(ledger);
        const rows = yield* pipe(
          readFileString5,
          Str.split("\n"),
          A.filter(Str.isNonEmpty),
          Effect.forEach((line) => decodeTurboLaneLedgerRow(line))
        );
        expect(rows).toEqual([{ _tag: "closed", attempted: 0 }]);
        // A closed ledger with nothing declared folds to no digest rather than an empty one.
        const readTurboLaneLedger6 = yield* readTurboLaneLedger(ledger);
        assertNone(readTurboLaneLedger6);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("declares a direct Turbo step's digest to the ledger the parent named", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const bin = path.join(tempDir, "bin");
        yield* fs.makeDirectory(bin, { recursive: true });
        // A stand-in Cache launcher leaves the summary its governed Turbo child would write.
        // The summary starts far enough in the future to count as this attempt's own.
        const summary = TurboRunSummary.make({
          id: "fixture",
          execution: { startTime: 4_102_444_800_000, endTime: 4_102_444_800_010, exitCode: 0 },
          tasks: [
            {
              taskId: "//#lint:typos",
              task: "lint:typos",
              hash: "h1",
              cache: { status: "MISS" },
              execution: { exitCode: 0 },
            },
          ],
        });
        const argument5 = path.join(bin, "summary.json");
        const encodedTurboRunSummary = yield* encodeTurboRunSummary(summary);
        yield* fs.writeFileString(argument5, encodedTurboRunSummary);
        const fakeBunx = path.join(bin, "bun");
        yield* fs.writeFileString(
          fakeBunx,
          A.join(
            ["#!/bin/sh", "mkdir -p .turbo/runs", 'cp "$(dirname "$0")/summary.json" .turbo/runs/fixture.json'],
            "\n"
          )
        );
        yield* fs.chmod(fakeBunx, 0o755);
        const ambientPath = O.getOrElse(O.fromUndefinedOr(Bun.env.PATH), () => "");
        const direct = QualityTaskStep.make({
          label: "ci:lint",
          command: "bunx",
          args: ["turbo", "run", "lint:typos", "--summarize"],
          cwd: tempDir,
          // The stand-in is a POSIX shell script, so the PATH separator is fixed.
          env: { PATH: `${bin}:${ambientPath}` },
        });
        const ledger = path.join(tempDir, "lane", "ledger.jsonl");
        yield* withEnvVarEffect(
          TURBO_LANE_LEDGER_ENV,
          ledger,
          runQualityTaskStreamingLaneGroup("ci:local", [["lint", direct, O.none()]])
        );
        const turboLaneDigestFromSummary7 = yield* turboLaneDigestFromSummary(summary, ["lint:typos"]);
        const expected = yield* Effect.fromOption(turboLaneDigestFromSummary7);
        // The child declared the step's digest and closed the ledger with that one attempt.
        const readTurboLaneLedger8 = yield* readTurboLaneLedger(ledger);
        assertSome(
          O.map(readTurboLaneLedger8, (digest) => digest.digest),
          expected.digest
        );
        const logLines9 = yield* TestConsole.logLines;
        const report = yield* pipe(
          logLines9,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow,
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length),
          decodeQualityTaskLaneRunReportJson
        );
        const lane = yield* Effect.fromOption(A.head(report.lanes));
        expect(lane.status).toBe("passed");
        assertSome(lane.inputDigest, expected.digest);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    // TTC ruling 72, review follow-up on #1321: the fixtures elsewhere close a lane ledger by hand, so
    // this case drives the production attempt counter itself. A red direct Turbo step run by the
    // streaming collector under a named ledger must still declare its digest and count as an attempt.
    it.layer(PlatformLayer, { timeout: "30 seconds" })("red direct Turbo step under a named ledger", (it) => {
      it.effect(
        "declares the red step's digest, counts it in the close record, and resolves it for the failed lane",
        flow(
          Effect.fnUntraced(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "turbo-lane-red-counter-" });
            const bin = path.join(tempDir, "bin");
            yield* fs.makeDirectory(bin, { recursive: true });
            // The summary starts far enough in the future to count as this attempt's own, and its task failed.
            const summary = TurboRunSummary.make({
              id: "red",
              execution: { startTime: 4_102_444_800_000, endTime: 4_102_444_800_010, exitCode: 1 },
              tasks: [
                {
                  taskId: "@beep/x#check",
                  task: "check",
                  hash: "hx1",
                  cache: { status: "MISS" },
                  execution: { exitCode: 1 },
                },
              ],
            });
            const argument6 = path.join(bin, "summary.json");
            const encodedTurboRunSummary5 = yield* encodeTurboRunSummary(summary);
            yield* fs.writeFileString(argument6, encodedTurboRunSummary5);
            // A stand-in Cache launcher leaves the summary its governed Turbo child would write, then fails.
            const fakeBun = path.join(bin, "bun");
            yield* fs.writeFileString(
              fakeBun,
              A.join(
                [
                  "#!/bin/sh",
                  "mkdir -p .turbo/runs",
                  'cp "$(dirname "$0")/summary.json" .turbo/runs/red.json',
                  "exit 1",
                ],
                "\n"
              )
            );
            yield* fs.chmod(fakeBun, 0o755);
            const ambientPath = O.getOrElse(O.fromUndefinedOr(Bun.env.PATH), () => "");
            const direct = QualityTaskStep.make({
              label: "ci:check",
              command: "bunx",
              args: ["turbo", "run", "check", "--summarize"],
              cwd: tempDir,
              // The stand-in is a POSIX shell script, so the PATH separator is fixed.
              env: { PATH: `${bin}:${ambientPath}` },
            });
            const ledger = path.join(tempDir, "lane", "ledger.jsonl");
            // The collector stamps each step's start from the live clock, as the fresh-summary filter expects.
            const failure = yield* withEnvVarEffect(
              TURBO_LANE_LEDGER_ENV,
              ledger,
              runQualityTaskStreamingLaneGroup("ci:local", [["check", direct, O.none()]])
            ).pipe(Effect.flip, TestClock.withLive);
            expect(failure._tag).toBe("QualityTaskGroupFailed");
            const turboLaneDigestFromSummary10 = yield* turboLaneDigestFromSummary(summary, ["check"]);
            const expected = yield* Effect.fromOption(turboLaneDigestFromSummary10);

            // The child wrote the red step's declared row, then closed the ledger with that attempt counted.
            const readFileString11 = yield* fs.readFileString(ledger);
            const rows = yield* pipe(
              readFileString11,
              Str.split("\n"),
              A.filter(Str.isNonEmpty),
              Effect.forEach((line) => decodeTurboLaneLedgerRow(line))
            );
            expect(
              A.map(
                rows,
                Match.valueTags({
                  declared: (row) => `declared=${row.digest.digest}`,
                  closed: (row) => `closed=${row.attempted}`,
                })
              )
            ).toEqual([`declared=${expected.digest}`, "closed=1"]);

            const logLines12 = yield* TestConsole.logLines;
            const report = yield* pipe(
              logLines12,
              A.filter(isString),
              A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
              O.getOrThrow,
              Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length),
              decodeQualityTaskLaneRunReportJson
            );
            const lane = yield* Effect.fromOption(A.head(report.lanes));
            expect(lane.status).toBe("failed");

            // The parent resolves the failed wrapper lane to the key the child declared.
            const wrapper = QualityTaskStep.make({
              label: "quality:check",
              command: "bun",
              args: ["run", "beep", "ci", "lane", "check"],
              cwd: tempDir,
              env: { [TURBO_LANE_LEDGER_ENV]: ledger },
            });
            const resolved = yield* resolveLaneInputDigestForTesting(
              {
                durationMs: 1,
                startedAt: "2026-09-28T04:00:00.000Z",
                endedAt: "2026-09-28T04:00:05.000Z",
                failure: O.some(
                  QualityTaskFailed.make({ label: "quality:check", command: "bun run beep ci lane check", exitCode: 1 })
                ),
                step: wrapper,
              },
              O.none()
            );
            assertSome(resolved.inputDigest, expected.digest);
            expect(resolved.inputPackages).toStrictEqual(["@beep/x"]);
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );
    });

    it.effect("appends schema-versioned lane rows and ignores malformed side-channel rows", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
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
        const readFileString13 = yield* fs.readFileString(artifactPath);
        const lines = pipe(readFileString13, Str.split("\n"), A.filter(Str.isNonEmpty));
        expect(lines).toHaveLength(2);
        const report = yield* pipe(A.get(lines, 1), O.getOrThrow, decodeQualityTaskLaneRunReportJson);
        expect(report.schemaVersion).toBe("quality-task-lane-run/v1");
        assertSome(report.parentLaneId, "full:02-ci-parity");
        expect(A.map(report.lanes, (lane) => lane.id)).toEqual(["check"]);
        const logLines14 = yield* TestConsole.logLines;
        const emitted = pipe(
          logLines14,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow
        );
        const emittedReport = yield* decodeQualityTaskLaneRunReportJson(
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(emitted)
        );
        expect(A.map(emittedReport.lanes, (lane) => lane.id)).toEqual(["check"]);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("rebuilds an unscoped lane report from an unscoped artifact", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const artifactPath = path.join(tempDir, "unscoped-inner-lanes.ndjson");
        const durableReport = yield* encodeQualityTaskLaneRunReportJson(
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

        const logLines15 = yield* TestConsole.logLines;
        const emitted = pipe(
          logLines15,
          A.filter(isString),
          A.findFirst(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX)),
          O.getOrThrow
        );
        const emittedReport = yield* decodeQualityTaskLaneRunReportJson(
          Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(emitted)
        );
        assertNone(emittedReport.parentLaneId);
        expect(A.map(emittedReport.lanes, (lane) => lane.id)).toEqual(["check"]);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("falls back when a lane artifact is missing or belongs to another parent", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const missingPath = path.join(tempDir, "missing.ndjson");
        const foreignPath = path.join(tempDir, "foreign.ndjson");
        const foreignReport = yield* encodeQualityTaskLaneRunReportJson(
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

        const logLines16 = yield* TestConsole.logLines;
        const reportLines = pipe(
          logLines16,
          A.filter(isString),
          A.filter(Str.startsWith(QUALITY_TASK_LANE_RUN_REPORT_PREFIX))
        );
        expect(reportLines).toHaveLength(2);
        const reports = yield* Effect.forEach(reportLines, (line) =>
          decodeQualityTaskLaneRunReportJson(Str.slice(QUALITY_TASK_LANE_RUN_REPORT_PREFIX.length)(line))
        );
        expect(A.every(reports, (report) => A.isReadonlyArrayEmpty(report.lanes))).toBe(true);
        pipe(
          reports,
          A.every((report) => O.contains(report.parentLaneId, "full:current-parent")),
          assertTrue
        );
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("retains each completed inner lane when its wrapper is interrupted", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
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
              const lines = yield* fs.readFileString(artifactPath).pipe(
                Effect.orElseSucceed(() => Str.empty),
                Effect.map(flow(Str.split("\n"), A.filter(Str.isNonEmpty))),
                Effect.repeat({
                  schedule: Schedule.spaced("10 millis"),
                  until: (read) => A.length(read) >= 2,
                  times: 200,
                })
              );
              yield* Fiber.interrupt(wrapper);
              expect(lines).toHaveLength(2);
              const reports = yield* Effect.forEach(lines, (line) => decodeQualityTaskLaneRunReportJson(line));
              expect(A.flatMap(reports, (report) => A.map(report.lanes, (lane) => lane.id))).toEqual([
                "first",
                "second",
              ]);
            })
          )
        );
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("retains completed streaming lanes before the group returns", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
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
              const lines = yield* fs.readFileString(artifactPath).pipe(
                Effect.orElseSucceed(() => Str.empty),
                Effect.map(flow(Str.split("\n"), A.filter(Str.isNonEmpty))),
                Effect.repeat({
                  schedule: Schedule.spaced("10 millis"),
                  until: (read) => A.length(read) >= 2,
                  times: 200,
                })
              );
              yield* Fiber.interrupt(wrapper);
              expect(lines).toHaveLength(2);
              const reports = yield* Effect.forEach(lines, (line) => decodeQualityTaskLaneRunReportJson(line));
              expect(A.flatMap(reports, (report) => A.map(report.lanes, (lane) => lane.id))).toEqual([
                "first",
                "second",
              ]);
            })
          )
        );
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    {
      const ReportArbitrary = Arbitrary.schema(GithubCheckRunReport);
      it.effect.prop(
        "property: the wave report schema round-trips arbitrary reports",
        [ReportArbitrary],
        flow(
          Effect.fnUntraced(function* ([report]) {
            const encodedGithubCheckRunReportEffect = yield* encodeGithubCheckRunReportEffect(report);
            const decoded = yield* decodeGithubCheckRunReportEffect(encodedGithubCheckRunReportEffect);
            expect(decoded.schemaVersion).toBe("github-check-run/v1");
            expect(decoded.failurePolicy).toBe(report.failurePolicy);
            expect(A.map(decoded.lanes, (lane) => lane.id)).toEqual(A.map(report.lanes, (lane) => lane.id));
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        { arbitrary: fcRuns(32) }
      );
    }

    it.effect(
      "must-fail fixture: changing the seed changes order and unknown lanes retain declaration order",
      flow(
        Effect.fnUntraced(function* () {
          const lanes = [
            githubCheckTestLane("seed:a", "preflight", "process.exit(0)"),
            githubCheckTestLane("unknown:z", "preflight", "process.exit(0)"),
            githubCheckTestLane("seed:b", "preflight", "process.exit(0)"),
            githubCheckTestLane("unknown:y", "preflight", "process.exit(0)"),
          ];
          const seed = (aCost: number, bCost: number) =>
            GateOrderSeed.make({
              ...DEFAULT_GATE_ORDER_SEED,
              lanes: [githubCheckTestEstimate("seed:a", aCost), githubCheckTestEstimate("seed:b", bCost)],
            });
          const original = yield* WaveOrder.make(seed(1, 2));
          const changed = yield* WaveOrder.make(seed(2, 1));

          expect(A.map(original.order(lanes), (lane) => lane.id)).toEqual([
            "seed:a",
            "seed:b",
            "unknown:z",
            "unknown:y",
          ]);
          expect(A.map(changed.order(lanes), (lane) => lane.id)).toEqual([
            "seed:b",
            "seed:a",
            "unknown:z",
            "unknown:y",
          ]);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "keeps policy and preflight gates ahead of cheaper heavy work",
      flow(
        Effect.fnUntraced(function* () {
          const lanes = [
            githubCheckTestLane("heavy:cheap", "heavy", "process.exit(0)"),
            githubCheckTestLane("policy:expensive", "preflight", "process.exit(0)"),
          ];
          const seed = GateOrderSeed.make({
            ...DEFAULT_GATE_ORDER_SEED,
            lanes: [
              githubCheckTestEstimate("heavy:cheap", 1, "precise", "heavy"),
              githubCheckTestEstimate("policy:expensive", 100),
            ],
          });
          const waveOrder = yield* WaveOrder.make(seed);

          expect(A.map(waveOrder.order(lanes), (lane) => lane.id)).toEqual(["policy:expensive", "heavy:cheap"]);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "orders a precise gate before an imprecise gate when their evidence ties",
      flow(
        Effect.fnUntraced(function* () {
          const lanes = [
            githubCheckTestLane("policy:imprecise", "preflight", "process.exit(0)"),
            githubCheckTestLane("policy:precise", "preflight", "process.exit(0)"),
          ];
          const seed = GateOrderSeed.make({
            ...DEFAULT_GATE_ORDER_SEED,
            lanes: [
              githubCheckTestEstimate("policy:imprecise", 1, "imprecise"),
              githubCheckTestEstimate("policy:precise", 1),
            ],
          });
          const waveOrder = yield* WaveOrder.make(seed);

          expect(A.map(waveOrder.order(lanes), (lane) => lane.id)).toEqual(["policy:precise", "policy:imprecise"]);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("stops after a precise red and marks the unlaunched tail", () =>
      collectGithubCheckLaneWavesForTesting(
        "pre-push",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane(
                "preflight:a",
                "preflight",
                "process.exit(2)",
                O.some(githubCheckTestEstimate("preflight:a", 1))
              ),
              githubCheckTestLane(
                "preflight:b",
                "preflight",
                "process.exit(3)",
                O.some(githubCheckTestEstimate("preflight:b", 2))
              ),
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
          expect(A.map(failures, (failure) => failure.label)).toEqual(["preflight:a"]);
          expect(A.map(report.lanes, (lane) => [lane.id, lane.status])).toEqual([
            ["preflight:a", "failed"],
            ["preflight:b", "not-run-early-stop"],
            ["heavy:check", "not-run-early-stop"],
          ]);
          expect(A.map(laneReport.lanes, (lane) => [lane.id, lane.status])).toEqual([
            ["preflight:a", "failed"],
            ["preflight:b", "not-run-early-stop"],
            ["heavy:check", "not-run-early-stop"],
          ]);
          assertSome(report.firstRed, "preflight:a");
          expect(report.skippedAfterRed).toBe(2);
          (laneReport.lanes[0]?.startedAt ?? O.none()).pipe(O.isSome, assertTrue);
          {
            const optionUnderTest = laneReport.lanes[0]?.redSchedulingDecision;
            const expectedOptionValue = "stop-after-red";
            assertDefined(optionUnderTest);
            assertSome(optionUnderTest, expectedOptionValue);
          }
          {
            const optionUnderTest = laneReport.lanes[1]?.inputDigest;
            assertDefined(optionUnderTest);
            assertNone(optionUnderTest);
          }
          {
            const optionUnderTest = laneReport.lanes[2]?.inputDigest;
            assertDefined(optionUnderTest);
            assertNone(optionUnderTest);
          }
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect(
      "starts a waiting lane as soon as a pool slot frees and folds results in declaration order",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "github-check-pool-" });
            const doneMarker = `"${path.join(tempRoot, "late.done")}"`;
            const { laneReport, report } = yield* collectGithubCheckLaneWavesForTesting(
              "pool",
              [
                GithubCheckLaneWaveSpec.make({
                  wave: "preflight",
                  lanes: [
                    // Passes only if the third lane finished while it slept, which a
                    // chunked runner (third lane waits for this chunk) never allows.
                    githubCheckTestLane(
                      "pool:slow",
                      "preflight",
                      `await Bun.sleep(3000); process.exit((await Bun.file(${doneMarker}).exists()) ? 0 : 7)`
                    ),
                    githubCheckTestLane("pool:fast", "preflight", "process.exit(0)"),
                    githubCheckTestLane("pool:late", "preflight", `await Bun.write(${doneMarker}, "done")`),
                  ],
                }),
              ],
              "fail-fast",
              undefined,
              2
            );
            expect(A.map(report.lanes, (lane) => [lane.id, lane.status])).toEqual([
              ["pool:slow", "passed"],
              ["pool:fast", "passed"],
              ["pool:late", "passed"],
            ]);
            expect(A.map(laneReport.lanes, (lane) => lane.id)).toEqual(["pool:slow", "pool:fast", "pool:late"]);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        TestClock.withLive
      )
    );

    it.effect(
      "stops a pooled wave at lane granularity while running lanes finish",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "github-check-pool-fail-fast-" });
            const tailMarker = path.join(tempRoot, "tail.ran");
            const { failures, report } = yield* collectGithubCheckLaneWavesForTesting(
              "pool-fail-fast",
              [
                GithubCheckLaneWaveSpec.make({
                  wave: "preflight",
                  lanes: [
                    githubCheckTestLane("pool:slow", "preflight", "await Bun.sleep(3000)"),
                    githubCheckTestLane("pool:fast", "preflight", "process.exit(0)"),
                    githubCheckTestLane(
                      "pool:red",
                      "preflight",
                      "process.exit(2)",
                      O.some(githubCheckTestEstimate("pool:red", 1))
                    ),
                    githubCheckTestLane("pool:tail", "preflight", `await Bun.write("${tailMarker}", "ran")`),
                  ],
                }),
              ],
              "fail-fast",
              undefined,
              2
            );
            // Chunks of two would have launched the tail beside the red; the pool
            // reads the stop before launching it, and the slow lane still finishes.
            expect(A.map(report.lanes, (lane) => [lane.id, lane.status])).toEqual([
              ["pool:slow", "passed"],
              ["pool:fast", "passed"],
              ["pool:red", "failed"],
              ["pool:tail", "not-run-early-stop"],
            ]);
            expect(A.map(failures, (failure) => failure.label)).toEqual(["pool:red"]);
            const exists17 = yield* fs.exists(tailMarker);
            expect(exists17).toBe(false);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        TestClock.withLive
      )
    );

    it.effect(
      "holds a blocked lane until its blocker finishes and runs an exclusive lane alone",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "github-check-pool-blocked-" });
            const marker = (name: string) => `"${path.join(tempRoot, name)}"`;
            const blocked = GithubCheckLaneSpec.make({
              ...githubCheckTestLane(
                "pool:blocked",
                "preflight",
                `process.exit((await Bun.file(${marker("blocker.done")}).exists()) ? 0 : 7)`
              ),
              blockedBy: ["pool:blocker"],
            });
            const exclusive = GithubCheckLaneSpec.make({
              ...githubCheckTestLane(
                "pool:exclusive",
                "preflight",
                // Fails if the shared lane before it is still running or the one after it already started.
                `process.exit((await Bun.file(${marker("before.done")}).exists()) && !(await Bun.file(${marker("after.started")}).exists()) ? 0 : 8)`
              ),
              isolation: "exclusive",
            });
            const { report } = yield* collectGithubCheckLaneWavesForTesting(
              "pool-blocked",
              [
                GithubCheckLaneWaveSpec.make({
                  wave: "preflight",
                  lanes: [
                    githubCheckTestLane(
                      "pool:blocker",
                      "preflight",
                      `await Bun.sleep(800); await Bun.write(${marker("blocker.done")}, "done")`
                    ),
                    blocked,
                    githubCheckTestLane(
                      "pool:before",
                      "preflight",
                      `await Bun.sleep(400); await Bun.write(${marker("before.done")}, "done")`
                    ),
                    exclusive,
                    githubCheckTestLane("pool:after", "preflight", `await Bun.write(${marker("after.started")}, "x")`),
                  ],
                }),
              ],
              "fail-fast",
              undefined,
              4
            );
            expect(A.map(report.lanes, (lane) => lane.status)).toEqual(A.replicate("passed", 5));
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        TestClock.withLive
      )
    );

    it.effect("continues after an imprecise red under fail-fast", () =>
      collectGithubCheckLaneWavesForTesting(
        "pre-push",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane(
                "preflight:imprecise",
                "preflight",
                "process.exit(1)",
                O.some(githubCheckTestEstimate("preflight:imprecise", 1, "imprecise"))
              ),
              githubCheckTestLane(
                "preflight:precise",
                "preflight",
                "process.exit(0)",
                O.some(githubCheckTestEstimate("preflight:precise", 2))
              ),
            ],
          }),
        ],
        "fail-fast"
      ).pipe(
        Effect.map(({ laneReport, report }) => {
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["failed", "passed"]);
          assertSome(report.firstRed, "preflight:imprecise");
          expect(report.skippedAfterRed).toBe(0);
          {
            const optionUnderTest = laneReport.lanes[0]?.redSchedulingDecision;
            const expectedOptionValue = "continue-after-imprecise-red";
            assertDefined(optionUnderTest);
            assertSome(optionUnderTest, expectedOptionValue);
          }
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("stops later quality-mode waves after an estimate-less red", () =>
      collectGithubCheckLaneWavesForTesting(
        "quality",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [githubCheckTestLane("preflight:unclassified", "preflight", "process.exit(1)")],
          }),
          GithubCheckLaneWaveSpec.make({
            wave: "heavy",
            lanes: [githubCheckTestLane("heavy:unlaunched", "heavy", "process.exit(0)")],
          }),
        ],
        "fail-fast"
      ).pipe(
        Effect.map(({ laneReport, report }) => {
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["failed", "not-run-early-stop"]);
          assertSome(report.firstRed, "preflight:unclassified");
          expect(report.skippedAfterRed).toBe(1);
          {
            const optionUnderTest = laneReport.lanes[0]?.redSchedulingDecision;
            const expectedOptionValue = "stop-after-red";
            assertDefined(optionUnderTest);
            assertSome(optionUnderTest, expectedOptionValue);
          }
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("runs later waves under collect-all", () =>
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
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect(
      "reuses only exact lane proofs and invalidates them when the virtual tree changes",
      flow(
        Effect.fnUntraced(
          function* () {
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
            const readFileString18 = yield* fs.readFileString(markerPath);
            expect(readFileString18).toBe("run\nrun\n");

            yield* fs.writeFileString(path.join(tempRoot, "README.md"), "# changed\n");
            const invalidated = yield* runWithLaneProof;
            expect(A.map(invalidated.report.lanes, (result) => result.status)).toEqual(["passed"]);
            const readFileString19 = yield* fs.readFileString(markerPath);
            expect(readFileString19).toBe("run\nrun\nrun\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "isolates lane-proof defaults and persistence guards from the parent process environment",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-defaults-" });
            yield* initializeLaneProofRepository(tempRoot);

            const lane = laneProofTestLane(tempRoot, "proof:defaults", "preflight", "process.exit(0)", true);
            const disabled = yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              undefined,
              prepareLaneProofSession([lane])
            );
            const invalid = yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              "invalid",
              prepareLaneProofSession([lane])
            );
            const withDefaultBase = yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              "active",
              withEnvVarEffect("BEEP_YEET_PROOF_BASE", undefined, prepareLaneProofSession([lane]))
            );

            disabled.pipe(assertNone);
            invalid.pipe(assertNone);
            withDefaultBase.pipe(O.isSome, assertTrue);

            const emptySession = LaneProofSession.make({
              mode: "active",
              path: path.join(tempRoot, ".beep", "yeet", "lane-proofs.json"),
              records: [],
              identities: [],
            });
            yield* persistLaneProofs(emptySession, []);
            yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              undefined,
              persistLaneProofs(emptySession, [[lane, 1]])
            );
            yield* persistLaneProofs(emptySession, [
              [lane, 1],
              [laneProofTestLane(path.join(tempRoot, "other"), "proof:other", "preflight", "process.exit(0)"), 1],
            ]);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "disables lane-proof reuse when the virtual tree cannot be created",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-tree-failure-" });
            yield* initializeLaneProofRepository(tempRoot);

            const lane = laneProofTestLane(tempRoot, "proof:tree-failure", "preflight", "process.exit(0)");
            const session = yield* withGitShim(
              tempRoot,
              'if [ "$1" = write-tree ]; then echo "simulated write-tree failure" >&2; exit 1; fi',
              prepareLaneProofSession([lane], "active")
            );
            session.pipe(assertNone);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "disables lane-proof reuse when git cannot be spawned",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-no-git-" });
            yield* initializeLaneProofRepository(tempRoot);
            const emptyPath = path.join(tempRoot, ".beep", "empty-path");
            yield* fs.makeDirectory(emptyPath, { recursive: true });

            const lane = laneProofTestLane(tempRoot, "proof:no-git", "preflight", "process.exit(0)");
            const session = yield* withEnvVarEffect("PATH", emptyPath, prepareLaneProofSession([lane], "active"));
            session.pipe(assertNone);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "hashes the virtual tree once up front and once per wave, never per lane",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-single-hash-" });
            const hashLog = path.join(tempRoot, ".beep", "write-tree.log");
            yield* initializeLaneProofRepository(tempRoot);
            yield* fs.makeDirectory(path.dirname(hashLog), { recursive: true });

            const lanes = (wave: GithubCheckLaneWave) =>
              A.map(["a", "b", "c"], (suffix) =>
                laneProofTestLane(tempRoot, `proof:${wave}:${suffix}`, wave, `echo ${suffix} >> .beep/${wave}.txt`)
              );
            const run = collectGithubCheckLaneWavesForTesting(
              "proof-single-hash",
              [
                GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: lanes("preflight") }),
                GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: lanes("heavy") }),
              ],
              "fail-fast",
              "active",
              3
            );
            const counted = withGitShim(tempRoot, `if [ "$1" = write-tree ]; then echo hash >> '${hashLog}'; fi`, run);

            const first = yield* counted;
            expect(A.map(first.report.lanes, (result) => result.status)).toEqual(A.replicate("passed", 6));
            // One hash before the first wave plus one fence per wave: 3, where
            // the per-lane start and persist hashes cost 12.
            const readFileString20 = yield* fs.readFileString(hashLog);
            expect(Str.split(Str.trim(readFileString20), "\n")).toHaveLength(3);

            const second = yield* counted;
            expect(A.map(second.report.lanes, (result) => result.status)).toEqual(A.replicate("reused", 6));
            // All reused: the up-front hash plus the preflight refresh the heavy
            // wave reads; the last wave persists nothing and skips its fence.
            const readFileString21 = yield* fs.readFileString(hashLog);
            expect(Str.split(Str.trim(readFileString21), "\n")).toHaveLength(5);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "never hashes the tree for a battery of non-reusable lanes",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-non-reusable-hash-" });
            const hashLog = path.join(tempRoot, ".beep", "write-tree.log");
            yield* initializeLaneProofRepository(tempRoot);
            yield* fs.makeDirectory(path.dirname(hashLog), { recursive: true });

            const run = collectGithubCheckLaneWavesForTesting(
              "proof-non-reusable-hash",
              [
                GithubCheckLaneWaveSpec.make({
                  wave: "preflight",
                  lanes: [
                    laneProofTestLane(tempRoot, "quality:security", "preflight", "true"),
                    laneProofTestLane(tempRoot, "repo-sanity:bun-audit", "preflight", "true"),
                  ],
                }),
              ],
              "fail-fast",
              "active",
              2
            );
            const result = yield* withGitShim(
              tempRoot,
              `if [ "$1" = write-tree ]; then echo hash >> '${hashLog}'; fi`,
              run
            );

            expect(A.map(result.report.lanes, (lane) => lane.status)).toEqual(["passed", "passed"]);
            const exists22 = yield* fs.exists(hashLog);
            expect(exists22).toBe(false);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "fences a concurrent wave when any of its lanes moves the tree",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-concurrent-mutation-" });
            yield* initializeLaneProofRepository(tempRoot);

            const run = collectGithubCheckLaneWavesForTesting(
              "proof-concurrent-mutation",
              [
                GithubCheckLaneWaveSpec.make({
                  wave: "preflight",
                  lanes: [
                    laneProofTestLane(tempRoot, "proof:quiet", "preflight", "echo quiet >> .beep/quiet.txt"),
                    laneProofTestLane(
                      tempRoot,
                      "proof:mutator",
                      "preflight",
                      'echo run >> .beep/mutator.txt; echo "# moved $(cat .beep/mutator.txt | wc -l)" > README.md'
                    ),
                  ],
                }),
              ],
              "fail-fast",
              "active",
              2
            );

            const first = yield* run;
            const second = yield* run;
            expect(A.map(first.report.lanes, (lane) => lane.status)).toEqual(["passed", "passed"]);
            // The mutator moved the tree inside the wave, so the quiet lane's
            // proof is fenced out too, and nothing is reused on the rerun.
            expect(A.map(second.report.lanes, (lane) => lane.status)).toEqual(["passed", "passed"]);
            const readFileString23 = yield* fs.readFileString(path.join(tempRoot, ".beep", "quiet.txt"));
            expect(readFileString23).toBe("quiet\nquiet\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "invalidates a lane proof when the property-test run floor increases",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-fc-runs-" });
            const markerPath = path.join(tempRoot, ".beep", "property-marker.txt");
            yield* initializeLaneProofRepository(tempRoot);

            const atRuns = (runs: string) => {
              const lane = laneProofTestLane(
                tempRoot,
                "quality:test-unit",
                "heavy",
                "echo run >> .beep/property-marker.txt",
                false,
                { BEEP_FC_NUM_RUNS: runs }
              );
              const waves = [GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: [lane] })];
              return collectGithubCheckLaneWavesForTesting("proof-fc-runs", waves, "fail-fast", "active");
            };

            expect(A.map((yield* atRuns("100")).report.lanes, (result) => result.status)).toEqual(["passed"]);
            expect(A.map((yield* atRuns("100")).report.lanes, (result) => result.status)).toEqual(["reused"]);
            expect(A.map((yield* atRuns("400")).report.lanes, (result) => result.status)).toEqual(["passed"]);
            const readFileString24 = yield* fs.readFileString(markerPath);
            expect(readFileString24).toBe("run\nrun\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "invalidates ordinary lane proofs when inherited execution settings change",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* Effect.forEach(
              [
                { name: "BEEP_FC_NUM_RUNS", before: "100", after: "400" },
                { name: "GITHUB_ACTIONS", before: "false", after: "true" },
                { name: "TURBO_FORCE", before: "false", after: "true" },
              ],
              Effect.fnUntraced(function* ({ name, before, after }) {
                const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-ambient-" });
                yield* initializeLaneProofRepository(tempRoot);
                const lane = GithubCheckLaneSpec.make({
                  id: "quality:test-unit",
                  tier: "pre-push",
                  stage: "repo-quality",
                  wave: "heavy",
                  blockedBy: [],
                  step: QualityTaskStep.make({
                    label: "ambient execution settings",
                    command: "bun",
                    args: [
                      "-e",
                      `require("node:fs").appendFileSync(".beep/ambient-marker.txt", Bun.env.${name} + "\\n")`,
                    ],
                    cwd: tempRoot,
                  }),
                });
                const run = collectGithubCheckLaneWavesForTesting(
                  "proof-ambient",
                  [GithubCheckLaneWaveSpec.make({ wave: "heavy", lanes: [lane] })],
                  "fail-fast",
                  "active"
                );
                const initial = yield* withEnvVarEffect(name, before, run);
                const repeated = yield* withEnvVarEffect(name, before, run);
                const changed = yield* withEnvVarEffect(name, after, run);
                expect(A.map(initial.report.lanes, (result) => result.status)).toEqual(["passed"]);
                expect(A.map(repeated.report.lanes, (result) => result.status)).toEqual(["reused"]);
                expect(A.map(changed.report.lanes, (result) => result.status)).toEqual(["passed"]);
                const readFileString25 = yield* fs.readFileString(path.join(tempRoot, ".beep", "ambient-marker.txt"));
                expect(readFileString25).toBe(`${before}\n${after}\n`);
              }),
              { concurrency: 1, discard: true }
            );
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "invalidates a lane proof when an inherited ambient input changes",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-ambient-env-" });
            const markerPath = path.join(tempRoot, ".beep", "ambient-marker.txt");
            yield* initializeLaneProofRepository(tempRoot);

            const lane = laneProofTestLane(
              tempRoot,
              "proof:ambient-env",
              "preflight",
              "echo run >> .beep/ambient-marker.txt"
            );
            const run = collectGithubCheckLaneWavesForTesting(
              "proof-ambient-env",
              [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
              "fail-fast",
              "active"
            );
            const withGoldenMode = (mode: string) => withEnvVarEffect("REGEN_GOLDENS", mode, run);

            expect(A.map((yield* withGoldenMode("0")).report.lanes, (result) => result.status)).toEqual(["passed"]);
            expect(A.map((yield* withGoldenMode("0")).report.lanes, (result) => result.status)).toEqual(["reused"]);
            expect(A.map((yield* withGoldenMode("1")).report.lanes, (result) => result.status)).toEqual(["passed"]);
            const readFileString26 = yield* fs.readFileString(markerPath);
            expect(readFileString26).toBe("run\nrun\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "includes the complete ambient environment for local-env lanes with an isolated spawn",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-local-env-" });
            yield* initializeLaneProofRepository(tempRoot);

            const lane = GithubCheckLaneSpec.make({
              id: "proof:local-env",
              tier: "pre-push",
              stage: "repo-quality",
              wave: "preflight",
              blockedBy: [],
              step: QualityTaskStep.make({
                label: "proof:local-env",
                command: "op",
                args: ["run", "--", "bunx", "turbo", "run", "check"],
                cwd: tempRoot,
                useLocalEnv: true,
              }),
            });
            const hashAtConcurrency = (concurrency: string) =>
              withEnvVarEffect(
                "BEEP_QUALITY_CHECK_CONCURRENCY",
                concurrency,
                prepareLaneProofSession([lane], "active")
              ).pipe(
                Effect.map((session) =>
                  pipe(
                    session,
                    O.flatMap((session) => A.head(session.identities)),
                    O.map((identity) => identity.envProfileHash),
                    O.getOrThrow
                  )
                )
              );

            const hashAtConcurrency27 = yield* hashAtConcurrency("2");
            const expectation1 = expect(hashAtConcurrency27);
            const hashAtConcurrency6 = yield* hashAtConcurrency("2");
            expectation1.toBe(hashAtConcurrency6);
            const hashAtConcurrency28 = yield* hashAtConcurrency("2");
            const argument7 = expect(hashAtConcurrency28).not;
            const hashAtConcurrency7 = yield* hashAtConcurrency("3");
            argument7.toBe(hashAtConcurrency7);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "omits ambient inputs from proof identity when the lane spawn is isolated",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-isolated-env-" });
            yield* initializeLaneProofRepository(tempRoot);

            const lane = GithubCheckLaneSpec.make({
              id: "proof:isolated-env",
              tier: "pre-push",
              stage: "repo-quality",
              wave: "preflight",
              blockedBy: [],
              step: QualityTaskStep.make({
                label: "proof:isolated-env",
                command: "op",
                args: ["run", "--", "bunx", "turbo", "run", "check"],
                cwd: tempRoot,
                env: { PATH: "/usr/bin" },
              }),
            });
            const hashAtGoldenMode = (mode: string) =>
              withEnvVarEffect("REGEN_GOLDENS", mode, prepareLaneProofSession([lane], "active")).pipe(
                Effect.map((session) =>
                  pipe(
                    session,
                    O.flatMap((session) => A.head(session.identities)),
                    O.map((identity) => identity.envProfileHash),
                    O.getOrThrow
                  )
                )
              );

            const hashAtGoldenMode29 = yield* hashAtGoldenMode("0");
            const expectation2 = expect(hashAtGoldenMode29);
            const hashAtGoldenMode8 = yield* hashAtGoldenMode("1");
            expectation2.toBe(hashAtGoldenMode8);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "runs the lane when the configured proof base cannot be resolved",
      flow(
        Effect.fnUntraced(
          function* () {
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
            const readFileString30 = yield* fs.readFileString(markerPath);
            expect(readFileString30).toBe("run\nrun\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "merges successful lane proofs across waves",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-waves-" });
            yield* initializeLaneProofRepository(tempRoot);

            const waves = [
              GithubCheckLaneWaveSpec.make({
                wave: "preflight",
                lanes: [
                  laneProofTestLane(tempRoot, "proof:preflight", "preflight", "echo preflight >> .beep/lanes.txt"),
                ],
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
            const readFileString31 = yield* fs.readFileString(path.join(tempRoot, ".beep", "lanes.txt"));
            expect(readFileString31).toBe("preflight\nheavy\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "invalidates history-sensitive proofs after a same-tree history rewrite",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-history-rewrite-" });
            yield* initializeLaneProofRepository(tempRoot);

            const secretsLane = laneProofTestLane(
              tempRoot,
              "quality:secrets",
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

            const readTree = runCapturedStreams({
              command: "git",
              args: ["rev-parse", "HEAD^{tree}"],
              cwd: tempRoot,
              stdin: "ignore",
            });
            const originalTree = yield* readTree;
            expect(originalTree.exitCode).toBe(0);
            expect(originalTree.stdout).toMatch(/^(?:[0-9a-f]{40}|[0-9a-f]{64})\r?\n$/u);
            yield* runGit(tempRoot, ["commit", "--amend", "-m", "same tree, rewritten history"]);
            const rewrittenTree = yield* readTree;
            expect(rewrittenTree.exitCode).toBe(0);
            expect(rewrittenTree.stdout).toBe(originalTree.stdout);

            const rewritten = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
            expect(A.map(rewritten.report.lanes, (result) => result.status)).toEqual(["passed", "passed"]);
            const readFileString32 = yield* fs.readFileString(path.join(tempRoot, ".beep", "secrets-history.txt"));
            expect(readFileString32).toBe("secrets\nsecrets\n");
            const readFileString33 = yield* fs.readFileString(path.join(tempRoot, ".beep", "commitlint-history.txt"));
            expect(readFileString33).toBe("commitlint\ncommitlint\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rechecks a later-wave proof after an earlier wave changes the tree",
      flow(
        Effect.fnUntraced(
          function* () {
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
            const readFileString34 = yield* fs.readFileString(path.join(tempRoot, ".beep", "heavy-after-mutation.txt"));
            expect(readFileString34).toBe("heavy\nheavy\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "never reuses volatile OSV security proofs",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-security-" });
            yield* initializeLaneProofRepository(tempRoot);

            const lane = laneProofTestLane(
              tempRoot,
              "quality:security",
              "preflight",
              "mkdir -p .beep && echo security >> .beep/security.txt"
            );
            const run = collectGithubCheckLaneWavesForTesting(
              "proof-security",
              [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
              "fail-fast"
            );

            const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
            const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
            expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
            expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["passed"]);
            const readFileString35 = yield* fs.readFileString(path.join(tempRoot, ".beep", "security.txt"));
            expect(readFileString35).toBe("security\nsecurity\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "refuses to persist a proof when the lane changes the virtual tree",
      flow(
        Effect.fnUntraced(
          function* () {
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
            const readFileString36 = yield* fs.readFileString(path.join(tempRoot, ".beep", "mutation.txt"));
            expect(readFileString36).toBe("run\nrun\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "uses a temporary proof index from a linked worktree git path",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const parent = yield* fs.makeTempDirectoryScoped({ prefix: "lane-proof-worktree-" });
            const primaryRoot = path.join(parent, "primary");
            const worktreeRoot = path.join(parent, "linked");
            yield* fs.makeDirectory(primaryRoot);
            yield* initializeLaneProofRepository(primaryRoot);
            yield* runGit(primaryRoot, ["worktree", "add", "-b", "lane-proof-linked", worktreeRoot, "HEAD"]);

            const lane = laneProofTestLane(
              worktreeRoot,
              "proof:worktree",
              "preflight",
              "echo run >> .beep/worktree.txt"
            );
            const run = collectGithubCheckLaneWavesForTesting(
              "proof-worktree",
              [GithubCheckLaneWaveSpec.make({ wave: "preflight", lanes: [lane] })],
              "fail-fast"
            );

            const first = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
            const second = yield* withEnvVarEffect("BEEP_YEET_LANE_PROOF_MODE", "active", run);
            expect(A.map(first.report.lanes, (result) => result.status)).toEqual(["passed"]);
            expect(A.map(second.report.lanes, (result) => result.status)).toEqual(["reused"]);
            const readFileString37 = yield* fs.readFileString(path.join(worktreeRoot, ".beep", "worktree.txt"));
            expect(readFileString37).toBe("run\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "does not persist a proof for an injected lane failure",
      flow(
        Effect.fnUntraced(
          function* () {
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
            const readFileString38 = yield* fs.readFileString(path.join(tempRoot, ".beep", "failure.txt"));
            expect(readFileString38).toBe("run\n");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("collects multiple cheap-gate findings in one schema-valid run", () =>
      collectGithubCheckLaneWavesForTesting(
        "cheap-gates",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane("repo-sanity:tsconfig-sync", "preflight", "process.exit(2)"),
              githubCheckTestLane("lint:effect-imports", "preflight", "process.exit(3)"),
            ],
          }),
        ],
        "collect-all"
      ).pipe(
        Effect.map(({ failures, report }) => {
          expect(report.schemaVersion).toBe("github-check-run/v1");
          expect(report.failurePolicy).toBe("collect-all");
          expect(A.map(failures, (failure) => failure.label)).toEqual([
            "repo-sanity:tsconfig-sync",
            "lint:effect-imports",
          ]);
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual(["failed", "failed"]);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    // D9: the cheap tier runs lanes abreast, but the first red, the run report,
    // and the journal artifact all keep wave order whatever the completion order.
    it.effect("keeps wave-order attribution and journaling when cheap gates run concurrently", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped();
        const artifactPath = path.join(tempDir, "cheap-gates.ndjson");
        const laneIds = ["goals:index-check", "lint:schema-first", "lint:allowlist", "goals:doctor"];
        const result = yield* withEnvVarEffect(
          QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
          artifactPath,
          collectGithubCheckLaneWavesForTesting(
            "cheap-gates",
            [
              GithubCheckLaneWaveSpec.make({
                wave: "preflight",
                lanes: [
                  // The first-declared red finishes last; a later red and a
                  // later green finish first.
                  githubCheckTestLane("goals:index-check", "preflight", "setTimeout(() => process.exit(2), 400)"),
                  githubCheckTestLane("lint:schema-first", "preflight", "setTimeout(() => process.exit(0), 200)"),
                  githubCheckTestLane("lint:allowlist", "preflight", "process.exit(3)"),
                  githubCheckTestLane("goals:doctor", "preflight", "process.exit(0)"),
                ],
              }),
            ],
            "collect-all",
            undefined,
            // Four abreast, the cheap tier's `current` width.
            githubCheckTierConcurrency("cheap-gates", resolveQualityConcurrencyPlan(currentDetection, {}, O.none()))
          )
        );
        const runOf = (id: string) => O.getOrThrow(A.findFirst(result.laneReport.lanes, (lane) => lane.id === id));

        expect(A.map(result.failures, (failure) => failure.label)).toEqual(["goals:index-check", "lint:allowlist"]);
        assertSome(result.report.firstRed, "goals:index-check");
        expect(result.report.skippedAfterRed).toBe(0);
        expect(A.map(result.report.lanes, (lane) => [lane.id, lane.status])).toEqual([
          ["goals:index-check", "failed"],
          ["lint:schema-first", "passed"],
          ["lint:allowlist", "failed"],
          ["goals:doctor", "passed"],
        ]);
        expect(A.map(result.laneReport.lanes, (lane) => lane.id)).toEqual(laneIds);
        // Proof that the lanes overlapped: the instant red started before the slow red ended.
        expect(O.getOrThrow(runOf("lint:allowlist").startedAt) < O.getOrThrow(runOf("goals:index-check").endedAt)).toBe(
          true
        );
        const readFileString39 = yield* fs.readFileString(artifactPath);
        const journaled = yield* Effect.forEach(
          pipe(readFileString39, Str.split("\n"), A.filter(Str.isNonEmpty)),
          (line) => decodeQualityTaskLaneRunReportJson(line)
        );
        expect(A.flatMap(journaled, (report) => A.map(report.lanes, (lane) => lane.id))).toEqual(laneIds);
      }).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    // The lane beside the red sleeps so the red always lands while it still holds
    // its slot: every later lane then reads the stop before it can start.
    it.effect("stops fail-fast scheduling at the next pool slot when lanes run abreast", () =>
      collectGithubCheckLaneWavesForTesting(
        "pre-push",
        [
          GithubCheckLaneWaveSpec.make({
            wave: "preflight",
            lanes: [
              githubCheckTestLane("quality:secrets", "preflight", "process.exit(1)"),
              githubCheckTestLane("quality:security", "preflight", "await Bun.sleep(1500)"),
              githubCheckTestLane("quality:sast", "preflight", "process.exit(0)"),
              githubCheckTestLane("quality:nix", "preflight", "process.exit(0)"),
              githubCheckTestLane("quality:commitlint", "preflight", "process.exit(0)"),
            ],
          }),
        ],
        "fail-fast",
        undefined,
        2
      ).pipe(
        Effect.map(({ failures, report }) => {
          expect(A.map(failures, (failure) => failure.label)).toEqual(["quality:secrets"]);
          assertSome(report.firstRed, "quality:secrets");
          expect(A.map(report.lanes, (lane) => lane.status)).toEqual([
            "failed",
            "passed",
            "not-run-early-stop",
            "not-run-early-stop",
            "not-run-early-stop",
          ]);
          expect(report.skippedAfterRed).toBe(3);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.layer(FileSystemLayer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "runs every cheap gate through the collected runner when all lanes pass",
        flow(
          Effect.fnUntraced(function* () {
            const testConsole = yield* TestConsole.make;
            const spawner = cheapGatesSpawner(A.empty(), policyCommandKey);
            const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
            const changesetStatusLane = githubCheckChangesetStatusLane(process.cwd());
            const changesetStatusCommand = A.join(
              [changesetStatusLane.step.command, ...changesetStatusLane.step.args],
              " "
            );

            yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              undefined,
              runGithubChecks("cheap-gates").pipe(
                TestClock.withLive,
                Effect.tap(
                  Effect.fnUntraced(function* () {
                    const logLines40 = yield* testConsole.logLines;
                    const logText = A.join(A.filter(logLines40, isString), "\n");
                    expect(logText).toContain(GITHUB_CHECK_RUN_REPORT_PREFIX);
                    expect(logText).toContain('"failurePolicy":"collect-all"');
                    expect(logText).toContain('"status":"passed"');
                    expect(spawnedPolicyCommands(spawner)).toContain(policyCommandKey(changesetStatusCommand));
                    expect(
                      A.filter(
                        cheapGateLanes,
                        (lane) =>
                          !A.contains(spawnedPolicyCommands(spawner), policyCommandKey(policyStepCommand(lane.step)))
                      )
                    ).toEqual([]);
                  })
                ),
                Effect.provideService(Console.Console, testConsole),
                Effect.provideServiceEffect(Git, Git.make),
                provideSpawner(spawner),
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown({
                    GITHUB_EVENT_NAME: "pull_request",
                    GITHUB_REF_NAME: "feature/cheap-gates",
                  })
                )
              )
            );
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );

      it.effect(
        "skips changeset status on a main push while running every cheap gate",
        flow(
          Effect.fnUntraced(function* () {
            const testConsole = yield* TestConsole.make;
            const spawner = cheapGatesSpawner(A.empty(), policyCommandKey);
            const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
            const changesetStatusLane = githubCheckChangesetStatusLane(process.cwd());
            const changesetStatusCommand = A.join(
              [changesetStatusLane.step.command, ...changesetStatusLane.step.args],
              " "
            );

            yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              "off",
              runGithubChecks("cheap-gates").pipe(
                TestClock.withLive,
                Effect.tap(
                  Effect.fnUntraced(function* () {
                    const logLines41 = yield* testConsole.logLines;
                    const logText = A.join(A.filter(logLines41, isString), "\n");
                    expect(logText).toContain("[github-checks] quality: skipped changeset status on main push");
                    expect(spawnedPolicyCommands(spawner)).not.toContain(policyCommandKey(changesetStatusCommand));
                    expect(
                      A.filter(
                        cheapGateLanes,
                        (lane) =>
                          !A.contains(spawnedPolicyCommands(spawner), policyCommandKey(policyStepCommand(lane.step)))
                      )
                    ).toEqual([]);
                  })
                ),
                Effect.provideService(Console.Console, testConsole),
                Effect.provideServiceEffect(Git, Git.make),
                provideSpawner(spawner),
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown({ GITHUB_EVENT_NAME: "push", GITHUB_REF_NAME: "main" })
                )
              )
            );
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );

      it.effect(
        "collects multiple failures through the cheap-gates runner without stopping later lanes",
        flow(
          Effect.fnUntraced(function* () {
            const testConsole = yield* TestConsole.make;
            const cheapGateLanes = githubCheckCheapGateLanes(process.cwd());
            const failedCommands = A.map(
              A.filter(cheapGateLanes, (lane) =>
                A.contains(["repo-sanity:tsconfig-sync", "lint:effect-imports"], lane.id)
              ),
              (lane) => policyStepCommand(lane.step)
            );
            const lastLane = O.getOrThrow(A.last(cheapGateLanes));
            const lastCommand = policyStepCommand(lastLane.step);
            const spawner = cheapGatesSpawner(failedCommands, policyCommandKey);

            yield* withEnvVarEffect(
              "BEEP_YEET_LANE_PROOF_MODE",
              "off",
              Effect.gen(function* () {
                const exit = yield* Effect.exit(runGithubChecks("cheap-gates").pipe(TestClock.withLive));

                assertTrue(Exit.isFailure(exit), "Expected cheap gates to report both configured failures");
                if (Exit.isFailure(exit)) {
                  const failure = Cause.squash(exit.cause);
                  expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
                  if (isQualityTaskGroupFailed(failure)) {
                    expect(A.map(failure.failures, (step) => step.label)).toEqual([
                      "repo-sanity:tsconfig-sync",
                      "lint:effect-imports",
                    ]);
                  }
                }

                expect(spawnedPolicyCommands(spawner)).toContain(policyCommandKey(lastCommand));
                const logLines42 = yield* testConsole.logLines;
                const logText = A.join(A.filter(logLines42, isString), "\n");
                expect(logText).toContain(GITHUB_CHECK_RUN_REPORT_PREFIX);
                expect(logText).toContain('"failurePolicy":"collect-all"');
                expect(logText).toContain('"id":"repo-sanity:tsconfig-sync","stage":"repo-sanity","status":"failed"');
                expect(logText).toContain('"id":"lint:effect-imports","stage":"repo-quality","status":"failed"');
                expect(logText).toContain('"status":"passed"');
              })
            ).pipe(
              Effect.provideService(Console.Console, testConsole),
              Effect.provideServiceEffect(Git, Git.make),
              provideSpawner(spawner),
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({
                  GITHUB_EVENT_NAME: "pull_request",
                  GITHUB_REF_NAME: "feature/cheap-gates",
                })
              )
            );
          }),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        )
      );
    });

    it("accepts the current packet state with audit, dead-code, and health as promoted pre-push lanes", () => {
      const matrix = fallowFeatureMatrix([
        ["audit", "blocking-check", "blocking"],
        ["dead-code", "blocking-check", "blocking"],
        ["health", "blocking-check", "blocking"],
      ]);

      expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual([
        "fallow:audit",
        "fallow:dead-code",
        "fallow:health",
      ]);
      expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([]);
    });

    it.effect("falls back to diff-scoped audit when Fallow cannot create the base worktree", () =>
      Effect.gen(function* () {
        const worktreeError = yield* encodeJson({
          error: true,
          message: "could not create a temporary worktree for base ref 'origin/main'",
          exit_code: 2,
        });
        expect(
          fallowAuditNeedsDiffFallbackForTesting({
            exitCode: 2,
            stdout: worktreeError,
          })
        ).toBe(true);
        expect(
          fallowAuditNeedsDiffFallbackForTesting({
            exitCode: 2,
            stdout: "",
            stderr: worktreeError,
          })
        ).toBe(true);
        expect(fallowAuditNeedsDiffFallbackForTesting({ exitCode: 2, stdout: '{"error":true}' })).toBe(false);
        expect(
          fallowAuditDiffFallbackArgsForTesting({ diffPath: "/tmp/audit.diff", quiet: true })("origin/main")
        ).toEqual([
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
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("preserves renames and includes untracked files in the diff-scoped audit input", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped();

        yield* runGit(repoRoot, ["init"]);
        yield* runGit(repoRoot, ["config", "user.email", "quality-test@example.com"]);
        yield* runGit(repoRoot, ["config", "user.name", "Quality Test"]);
        yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
        yield* fs.writeFileString(path.join(repoRoot, "tracked.ts"), "export const tracked = 1;\n");
        yield* runGit(repoRoot, ["add", "tracked.ts"]);
        yield* runGit(repoRoot, ["commit", "-m", "init"]);
        yield* runGit(repoRoot, ["mv", "tracked.ts", "renamed.ts"]);
        yield* fs.writeFileString(path.join(repoRoot, "untracked.ts"), "export const untracked = true;\n");

        const result = yield* collectAuditDiffInputForTesting(repoRoot, "HEAD");

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("tracked.ts");
        expect(result.stdout).toContain("untracked.ts");
        expect(result.stdout).toContain("new file mode");
        expect(result.stdout).toContain("rename from tracked.ts");
        expect(result.stdout).toContain("rename to renamed.ts");

        const codemodResult = yield* collectAuditDiffInputForTesting(repoRoot, "HEAD", 0, true);
        expect(codemodResult.exitCode).toBe(0);
        expect(codemodResult.stdout).not.toContain("rename from");
        expect(codemodResult.stdout).toContain("deleted file mode");
        expect(codemodResult.stdout).toContain("+export const tracked = 1;");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("keeps wired pre-push Fallow lanes in parity with authoritative promoted matrix lanes", () =>
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
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

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

    it.effect("keeps CI Fallow blocking failures deferred until advisory envelopes are written", () =>
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
        const dispatchIndex = O.getOrElse(constant(-1))(
          Str.indexOf('bun run beep ci lane fallow --base "${{ steps.base.outputs.base_ref }}"')(workflowText)
        );
        const validateStep = / {6}- name: Validate Fallow envelopes/g;
        validateStep.lastIndex = Math.max(0, dispatchIndex);
        const validateStepIndex = validateStep.exec(workflowText)?.index ?? -1;
        const uploadStep = / {6}- name: Upload Fallow envelopes/g;
        uploadStep.lastIndex = Math.max(0, validateStepIndex);
        const uploadStepIndex = uploadStep.exec(workflowText)?.index ?? -1;

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
        expect(A.take(labels, 3)).toEqual(["ci:fallow:audit", "ci:fallow:dead-code", "ci:fallow:health"]);
        expect(labels).toContain("ci:fallow:envelope-check:health");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it("rejects a promoted Fallow matrix row that is not wired into pre-push", () => {
      // The promoted boundaries lane is intentionally absent from the static pre-push lane set.
      const matrix = fallowFeatureMatrix([
        ["audit", "blocking-check", "blocking"],
        ["dead-code", "blocking-check", "blocking"],
        ["health", "blocking-check", "blocking"],
        ["boundaries", "blocking-check", "blocking"],
      ]);

      expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
        "missing promoted Fallow GitHub check lane fallow:boundaries",
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
      // health=candidate-blocking counts as promoted; audit and dead-code stay wired but unpromoted.
      const matrix = fallowFeatureMatrix([
        ["health", "advisory-artifact", "candidate-blocking"],
        ["audit", "advisory-artifact", "research"],
        ["dead-code", "advisory-artifact", "research"],
      ]);
      expect(promotedFallowGithubCheckLaneIdsForTesting(matrix)).toEqual(["fallow:health"]);
      expect(githubCheckPromotedFallowLaneDiagnosticsForTesting("/repo", "pre-push", matrix)).toEqual([
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
        detectQualityProfileForTesting(
          QualityProfileDetectionInput.make({
            ci: true,
            cpuCount: 64,
            totalMemoryBytes: 128 * 1024 * 1024 * 1024,
          })
        )
      ).toMatchObject({
        profile: "ci",
        config: { fullProofSlots: 1, reviewFixSlots: 1 },
      });
      expect(
        detectQualityProfileForTesting(
          QualityProfileDetectionInput.make({
            ci: false,
            cpuCount: 64,
            totalMemoryBytes: 128 * 1024 * 1024 * 1024,
          })
        )
      ).toMatchObject({
        profile: "workstation",
        config: { docgenParallel: 6, reviewFixSlots: 3 },
      });
      expect(
        detectQualityProfileForTesting(
          QualityProfileDetectionInput.make({
            ci: false,
            cpuCount: 8,
            totalMemoryBytes: 16 * 1024 * 1024 * 1024,
          })
        )
      ).toMatchObject({
        profile: "current",
        config: { docgenParallel: 3, reviewFixSlots: 1 },
      });
      expect(qualityProfileConfigForTesting("workstation")).toMatchObject({
        fullProofSlots: 1,
        turboConcurrency: 8,
        policyLintConcurrency: 8,
        cheapGateConcurrency: 8,
        prePushLaneConcurrency: 4,
        oxlintThreads: 16,
      });
      // `ci` carries the hosted values verbatim; `current` keeps the pre-profile local values.
      expect(qualityProfileConfigForTesting("ci")).toMatchObject({
        turboConcurrency: 4,
        policyLintConcurrency: 4,
        cheapGateConcurrency: 4,
        prePushLaneConcurrency: 1,
        oxlintThreads: 4,
      });
      expect(qualityProfileConfigForTesting("current")).toMatchObject({
        turboConcurrency: 3,
        policyLintConcurrency: 4,
        cheapGateConcurrency: 4,
        prePushLaneConcurrency: 1,
        oxlintThreads: 4,
      });
    });

    it("resolves the concurrency plan from the profile, the overrides and the admission load", () => {
      const idle = O.none<QualityAdmissionLoad>();
      const ciPlan = resolveQualityConcurrencyPlan(ciDetection, {}, idle);
      expect(ciPlan).toMatchObject({
        profile: "ci",
        rootTurbo: 4,
        policyLint: 4,
        cheapGates: 4,
        prePushLanes: 1,
        oxlintThreads: 4,
        notes: [],
      });
      assertNone(ciPlan.admission);
      expect(resolveQualityConcurrencyPlan(currentDetection, {}, idle)).toMatchObject({
        profile: "current",
        rootTurbo: 3,
        policyLint: 4,
        cheapGates: 4,
        prePushLanes: 1,
        oxlintThreads: 4,
      });
      expect(resolveQualityConcurrencyPlan(workstationDetection, {}, idle)).toMatchObject({
        profile: "workstation",
        rootTurbo: 8,
        policyLint: 8,
        cheapGates: 8,
        prePushLanes: 4,
        oxlintThreads: 16,
      });

      // Overrides: the policy lint width honours BEEP_QUALITY_CHECK_CONCURRENCY over the
      // local one-to-sixteen domain, the hosted profile keeps its 2/3/4 domain.
      expect(
        resolveQualityConcurrencyPlan(workstationDetection, { BEEP_QUALITY_CHECK_CONCURRENCY: "12" }, idle)
      ).toMatchObject({
        policyLint: 12,
        rootTurbo: 8,
      });
      expect(resolveQualityConcurrencyPlan(ciDetection, { BEEP_QUALITY_CHECK_CONCURRENCY: "12" }, idle)).toMatchObject({
        policyLint: 4,
        notes: ["[quality] Invalid BEEP_QUALITY_CHECK_CONCURRENCY; expected 2, 3 or 4. Using the profile width."],
      });
      expect(resolveQualityConcurrencyPlan(ciDetection, { BEEP_QUALITY_CHECK_CONCURRENCY: "2" }, idle)).toMatchObject({
        policyLint: 2,
      });
      expect(
        resolveQualityConcurrencyPlan(workstationDetection, { BEEP_QUALITY_CHEAP_GATE_CONCURRENCY: "3" }, idle)
      ).toMatchObject({ cheapGates: 3 });

      // Admission: other runs' tokens scale every width an override did not pin; `ci` never scales.
      const half = O.some(QualityAdmissionLoad.make({ activeTokens: 4, capacityTokens: 8 }));
      expect(resolveQualityConcurrencyPlan(workstationDetection, {}, half)).toMatchObject({
        rootTurbo: 4,
        policyLint: 4,
        cheapGates: 4,
        prePushLanes: 2,
        oxlintThreads: 8,
        admission: half,
        notes: ["[quality] admission: 4/8 tokens held by other runs; local widths scaled."],
      });
      expect(
        resolveQualityConcurrencyPlan(workstationDetection, { BEEP_QUALITY_CHECK_CONCURRENCY: "8" }, half)
      ).toMatchObject({ policyLint: 8, rootTurbo: 4 });
      const ciPlanUnderLoad = resolveQualityConcurrencyPlan(ciDetection, {}, half);
      expect(ciPlanUnderLoad).toMatchObject({ rootTurbo: 4, notes: [] });
      assertNone(ciPlanUnderLoad.admission);
      // A saturated host degrades to the `current` widths, never below them.
      const saturated = O.some(QualityAdmissionLoad.make({ activeTokens: 9, capacityTokens: 9 }));
      expect(resolveQualityConcurrencyPlan(workstationDetection, {}, saturated)).toMatchObject({
        rootTurbo: 3,
        policyLint: 4,
        cheapGates: 4,
        prePushLanes: 1,
        oxlintThreads: 4,
      });
      expect(resolveQualityConcurrencyPlan(currentDetection, {}, saturated)).toMatchObject({
        rootTurbo: 3,
        policyLint: 4,
        cheapGates: 4,
        prePushLanes: 1,
        oxlintThreads: 4,
      });
      expect(
        resolveQualityConcurrencyPlan(
          workstationDetection,
          {},
          O.some(QualityAdmissionLoad.make({ activeTokens: 0, capacityTokens: 8 }))
        )
      ).toMatchObject({ rootTurbo: 8, notes: [] });

      expect(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 0, capacityTokens: 8 }))).toBe(
        8
      );
      expect(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 3, capacityTokens: 8 }))).toBe(
        5
      );
      expect(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 8, capacityTokens: 8 }))).toBe(
        1
      );
      expect(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 9, capacityTokens: 8 }))).toBe(
        1
      );
      // Hard floor engaged: capacity zero runs serially.
      expect(scaleQualityWidthByAdmission(8, QualityAdmissionLoad.make({ activeTokens: 0, capacityTokens: 0 }))).toBe(
        1
      );
      expect(scaleQualityWidthByAdmission(1, QualityAdmissionLoad.make({ activeTokens: 7, capacityTokens: 8 }))).toBe(
        1
      );
    });

    it("bounds the root Turbo graphs by the detected profile", () => {
      const rootArgs = (steps: ReadonlyArray<QualityTaskStep>) => O.getOrThrow(A.head(steps)).args;
      withEnvVar("CI", "true", () => {
        expect(rootArgs(rootQualityStepsForTesting("/repo", getInvocation(["check"])))).toContain("--concurrency=4");
      });
      withoutCi(() => {
        const plan = localQualityConcurrencyPlan();
        expect(plan.profile).toBe(detectQualityProfileForTesting(hostDetectionInput).profile);
        expect(rootArgs(rootQualityStepsForTesting("/repo", getInvocation(["check"])))).toContain(
          `--concurrency=${plan.rootTurbo}`
        );
        expect(rootArgs(rootQualityStepsForTesting("/repo", getInvocation(["build"])))).toContain(
          `--concurrency=${plan.rootTurbo}`
        );
        expect(rootArgs(rootQualityStepsForTesting("/repo", getInvocation(["lint"])))).toContain(
          `--concurrency=${plan.rootTurbo}`
        );
        // An explicit caller width always wins.
        expect(rootArgs(rootQualityStepsForTesting("/repo", getInvocation(["check", "--concurrency=1"])))).toContain(
          "--concurrency=1"
        );
      });
    });

    it("includes the repo-level tsgo smoke canary for affected root check lanes", () => {
      const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--affected", "--summarize"]));

      expect(steps).toHaveLength(2);
      expect(steps[0]).toMatchObject({
        label: "check",
        command: "bunx",
        cwd: "/repo",
      });
      expect(steps[0]?.args).toEqual(expectedRootTurboArgs("check", ["--affected", "--summarize"]));
      // tsgo-rules (`lint:tsgo-rules`) and the test-file typecheck (`quality:test-tsgo`)
      // are owned by lint-policy alone; check carries no copy of either.
      expect(A.some(steps, (step) => step.label === "quality:test-tsgo")).toBe(false);
      expect(A.slice(steps, { start: 1 })).toEqual([
        expect.objectContaining({
          label: "quality:tsgo-smoke",
          command: "bun",
          args: repoCliEntryArgs("quality", "tsgo-smoke"),
        }),
      ]);
    });

    it("collects Effect tsgo warnings from successful package results", () => {
      const diagnostics = collectEffectTsgoDiagnosticLines([
        {
          output: A.join(
            [
              "src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage",
              "src/example.test.ts:2:1 - warning TS99999: unrelated diagnostic",
            ],
            "\n"
          ),
        },
      ]);

      expect(diagnostics).toEqual(["src/example.test.ts:1:1 - warning TS90001: unsafe effect(service) usage"]);
    });

    it("names packages missing the required test tsgo Turbo script", () => {
      assertSome(
        missingTestTsgoTaskMessageForTesting([
          { packageName: "@beep/ready", hasTaskScript: true },
          { packageName: "@beep/zulu", hasTaskScript: false },
          { packageName: "@beep/alpha", hasTaskScript: false },
        ]),
        '[quality:test-tsgo] missing required "package-test-typecheck" package script for @beep/alpha, ' +
          '@beep/zulu. Add "package-test-typecheck": "beep-cli quality test-tsgo-package" to each named package.json.'
      );
      assertNone(missingTestTsgoTaskMessageForTesting([{ packageName: "@beep/ready", hasTaskScript: true }]));
    });

    it("plans package-owned tsgo tasks without filesystem-dependent coverage", () => {
      const group = {
        packageName: "@beep/example",
        packageDir: "/repo/packages/example",
        tsconfigPath: "/repo/packages/example/tsconfig.test.json",
        files: ["/repo/packages/example/test/example.test.ts"],
        scripts: {},
        hasTaskScript: true,
      };

      expect(testTsgoPlanningForTesting.isTestFile(group.files[0] ?? "", "example.test.ts")).toBe(true);
      expect(testTsgoPlanningForTesting.isTestFile("/repo/packages/example/src/example.ts", "example.ts")).toBe(false);
      expect(
        testTsgoPlanningForTesting.isTestFile("/repo/packages/example/test/fixtures/example.test.ts", "example.test.ts")
      ).toBe(false);
      expect(testTsgoPlanningForTesting.isTestFile("/repo/packages/example/test/example.js", "example.js")).toBe(false);
      expect(
        testTsgoPlanningForTesting.isIgnoredDirectory("/repo/packages/example/node_modules/", "node_modules")
      ).toBe(true);
      expect(testTsgoPlanningForTesting.isIgnoredDirectory("/repo/packages/example/test/fixtures/", "fixtures")).toBe(
        true
      );
      expect(testTsgoPlanningForTesting.isIgnoredDirectory("/repo/packages/example/src/", "src")).toBe(false);
      expect(testTsgoPlanningForTesting.packageLabel("/repo", "/repo/packages/@beep/example")).toBe(
        "packages-beep-example"
      );

      expect(testTsgoPlanningForTesting.turboArgs([group], [])).toEqual([
        "run",
        "package-test-typecheck",
        "--concurrency=1",
        "--continue=always",
        "--output-logs=none",
        "--summarize",
        "--filter=@beep/example",
      ]);
      expect(testTsgoPlanningForTesting.turboArgs([group], ["--explain"])).toEqual([
        "run",
        "package-test-typecheck",
        "--concurrency=1",
        "--continue=always",
        "--output-logs=none",
        "--summarize",
        "--filter=@beep/example",
        "--",
        "--explain",
      ]);
      assertSome(
        testTsgoPlanningForTesting.turboSummaryPath("ok\nSummary: .turbo/runs/example.json\n"),
        ".turbo/runs/example.json"
      );
      assertNone(testTsgoPlanningForTesting.turboSummaryPath("no summary"));
      assertNone(testTsgoPlanningForTesting.turboSummaryPath("Summary:   "));
    });

    it.effect("places package-owned tsgo results in the package Turbo directory", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;

        expect(testTsgoPlanningForTesting.packageResultPath(path, "/repo/packages/example")).toBe(
          "/repo/packages/example/.turbo/package-test-typecheck-result.json"
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

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

    // quality-lane audit 2026-09-09 (E1): the test and coverage runners plan at
    // run time, so no static root plan may claim to describe them.
    it("leaves test and coverage without a static root plan", () => {
      expect(rootQualityStepsForTesting("/repo", getInvocation(["test", "--integration"]))).toEqual([]);
      expect(rootQualityStepsForTesting("/repo", getInvocation(["coverage"]))).toEqual([]);
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

    it("plans ordered D10 policy runs with bare affected selectors and unfiltered state checks", () => {
      const local = rootLintPolicyStepsForTesting("/repo", ["README.md"], "review-base", undefined, true);
      expect(A.map(local, (step) => step.label)).toEqual([
        "lint:policy:cheap",
        "lint:policy:medium",
        "lint:policy:state",
        "knowledge:doctor",
        "lint:deprecated-apis",
        "quality:test-tsgo",
      ]);
      const taskNames = (step: QualityTaskStep) =>
        A.takeWhile(A.drop(step.args, 2), (arg) => !Str.startsWith("--")(arg));
      expect(taskNames(O.getOrThrow(A.get(local, 0)))).toEqual([
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
      ]);
      expect(taskNames(O.getOrThrow(A.get(local, 1)))).toEqual([
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
        "lint:jsdoc",
        "lint:jsdoc:root",
        "lint:jsdoc-module-tags",
        "jsdoc:inventory:check",
        "jsdoc:ratchet:check",
      ]);
      // D2 git-delta/clock checks and the uncertified binary walkers stay unfiltered.
      expect(taskNames(O.getOrThrow(A.get(local, 2)))).toEqual([
        "knowledge:semantic-delta",
        "knowledge:refs-check",
        "goals:doctor",
        "lint:oxlint",
        "lint:shadcn",
        "lint:typos",
      ]);
      for (const index of [0, 1, 4]) {
        const step = O.getOrThrow(A.get(local, index));
        expect(step.args).toContain("--affected");
        expect(policyTurboScmBase(step)).toBe("review-base");
        expect(A.some(step.args, Str.startsWith("//#"))).toBe(false);
      }
      expect(local[2]?.args).not.toContain("--affected");
      expect(policyTurboScmBase(O.getOrThrow(A.get(local, 2)))).toBeUndefined();
      expect(O.getOrThrow(A.get(local, 3)).args).toEqual(
        repoCliEntryArgs("knowledge", "doctor", "ci", "--base", "review-base")
      );
      for (const step of A.filter(A.take(local, 5), (planned) => planned.label !== "knowledge:doctor")) {
        expect(step.args).toContain("--summarize");
        expect(step.args).toContain("--continue=dependencies-successful");
        expect(step.args).not.toContain(LABS_EXCLUDE_FILTER);
      }
      {
        const optionUnderTest = A.last(local);
        const expectedOptionValue = expect.objectContaining({
          args: repoCliEntryArgs("quality", "test-tsgo"),
        });
        optionUnderTest.pipe(O.isSome, assertTrue);
        expect(O.getOrThrow(optionUnderTest)).toEqual(expectedOptionValue);
      }
      const full = rootLintPolicyStepsForTesting("/repo", undefined, undefined, undefined, true);
      expect(O.getOrThrow(A.get(full, 2)).args).toEqual(repoCliEntryArgs("knowledge", "doctor", "ci"));
      expect(A.map(full, (step) => step.label)).toEqual([
        "lint:policy:cheap",
        "lint:policy:medium",
        "knowledge:doctor",
        "lint:jsdoc",
        "lint:deprecated-apis",
        "quality:test-tsgo",
      ]);
      expect(taskNames(O.getOrThrow(A.get(full, 1)))).toEqual([
        ...pipe(A.get(local, 1), O.getOrThrow, taskNames, A.take(16)),
        "knowledge:semantic-delta",
        "knowledge:refs-check",
        "lint:jsdoc-module-tags",
        "goals:doctor",
        "lint:oxlint",
        "lint:shadcn",
        "lint:typos",
        "jsdoc:inventory:check",
        "jsdoc:ratchet:check",
      ]);
      // A local full-scope plan (no review base) leaves the two git-delta knowledge checks and the
      // knowledge doctor (report-only until the first seal) to the hosted plan; the changed-scope
      // plan still carries them.
      const localFull = rootLintPolicyStepsForTesting("/repo", undefined, undefined, undefined, false);
      expect(A.map(localFull, (step) => step.label)).toEqual(
        A.filter(
          A.map(full, (step) => step.label),
          (label) => label !== "knowledge:doctor"
        )
      );
      expect(pipe(A.get(localFull, 1), O.getOrThrow, taskNames)).toEqual(
        pipe(
          A.get(full, 1),
          O.getOrThrow,
          taskNames,
          A.filter((task) => task !== "knowledge:semantic-delta" && task !== "knowledge:refs-check")
        )
      );
      expect(A.every(full, (step) => !A.contains(step.args, "--affected"))).toBe(true);
      expect(policyTurboStep("lint:jsdoc").args).toEqual([
        "oxlint",
        ".",
        "--config",
        ".oxlintrc.docs.json",
        "--max-warnings=0",
      ]);
      expect(rootLintPolicyStepsForTesting("/repo", undefined, undefined, undefined, true, "abc123")).toContainEqual(
        expect.objectContaining({ label: "lint:jsdoc", args: expect.arrayContaining([".oxlintrc.docs.json"]) })
      );
      expect(policyTurboStep("lint:deprecated-apis").args).toEqual(
        repoCliEntryArgs("lint", "deprecated-apis", "--full")
      );
      expect(policyTurboStep("lint:deprecated-apis", undefined, "turbo").args).toContain("turbo");
      expect(policyTurboStep("lint:deprecated-apis", "review-base", "turbo")).toEqual(
        policyTurboStep("lint:deprecated-apis", "review-base", "oxlint")
      );
      expect(rootQualityStepsForTesting("/repo", getInvocation(["lint"]))).toEqual([
        expect.objectContaining({ label: "lint", args: expectedRootTurboArgs("lint", []) }),
        ...rootLintPolicyStepsForTesting("/repo"),
      ]);
    });

    it("preserves every pre-D policy check as a task or aggregate with explicit additions", () => {
      const before = [
        "lint:deprecated-apis",
        "knowledge:semantic-delta",
        "knowledge:refs-check",
        "lint:schema-first",
        "lint:laws",
        "lint:jsdoc",
        "lint:identity-registry",
        "lint:circular",
        "lint:effect-imports",
        "lint:effect-imports-markdown",
        "lint:package-test-typecheck",
        "lint:tsconfig-overlay",
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
        "lint:package-scripts",
        "lint:policy-fingerprint",
        "lint:typos",
      ];
      expect(before).toHaveLength(25);
      for (const base of [undefined, "review-base"]) {
        const steps = rootLintPolicyStepsForTesting("/repo", undefined, base, undefined, true);
        const after = pipe(
          steps,
          A.flatMap((step) =>
            step.args[0] === "turbo"
              ? A.takeWhile(A.drop(step.args, 2), (arg) => !Str.startsWith("--")(arg))
              : [step.label]
          ),
          A.dedupe
        );
        // Residual tasks expand the existing laws/JSDoc checks; the other three
        // checks are the new aggregate contract, not hidden losses or aliases.
        const additions = [
          "lint:deprecated-imports",
          "lint:native-runtime:roots",
          "lint:jsdoc:root",
          "jsdoc:inventory:check",
          "jsdoc:ratchet:check",
          "lint:shadcn",
          "lint:effect-vitest",
          "lint:opaque-roundtrips",
          "lint:markdown-fences",
          "lint:retired-effect-paths",
          "lint:retired-iri-authorities",
          "lint:schema-tag-idioms",
          "lint:holds",
          "quality:test-tsgo",
          "knowledge:doctor",
        ];
        expect(
          A.sort(
            A.filter(after, (name) => !A.contains(additions, name)),
            Order.String
          )
        ).toEqual(A.sort(before, Order.String));
        expect(A.every(after, (name) => A.contains(before, name) || A.contains(additions, name))).toBe(true);
      }
    });

    it.effect(
      "decodes sweep JSONC and rejects missing or malformed sweep files",
      flow(
        Effect.fnUntraced(
          function* () {
            const fs = yield* FileSystem.FileSystem;
            const root = yield* fs.makeTempDirectoryScoped();
            const file = `${root}/standards/lint-policy.sweeps.jsonc`;
            yield* expectSweepConfigurationFailure(root);
            yield* fs.makeDirectory(`${root}/standards`);
            for (const content of [
              "{",
              "{}",
              '{"schemaVersion":"old","deprecatedApis":"turbo"}',
              '{"schemaVersion":"lint-policy-sweeps/v1","deprecatedApis":"invalid"}',
            ]) {
              yield* fs.writeFileString(file, content);
              yield* expectSweepConfigurationFailure(root);
            }
            yield* fs.writeFileString(
              file,
              '{ /* measured */ "schemaVersion":"lint-policy-sweeps/v1","deprecatedApis":"turbo", }'
            );
            expect((yield* readLintPolicySweeps(root)).deprecatedApis).toBe("turbo");
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("bounds policy Turbo concurrency using Check overrides over the profile's budget", () => {
      // Hosted: Check's 2/3 overrides plus the four-worker budget, nothing wider.
      withEnvVar("CI", "true", () => {
        for (const value of [undefined, "2", "3", "4", "8", "invalid", ""]) {
          withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", value, () => {
            const expected = value === "2" || value === "3" ? value : "4";
            expect(policyTurboStep("lint:deprecated-apis", "origin/main").args).toContain(`--concurrency=${expected}`);
          });
        }
      });
      // Local: any width from one to sixteen, else the detected profile's budget.
      withoutCi(() => {
        const budget = withEnvVar(
          "BEEP_QUALITY_CHECK_CONCURRENCY",
          undefined,
          () => localQualityConcurrencyPlan().policyLint
        );
        for (const [value, expected] of [
          [undefined, budget],
          ["2", 2],
          ["8", 8],
          ["16", 16],
          ["17", budget],
          ["invalid", budget],
          ["", budget],
        ] as const) {
          withEnvVar("BEEP_QUALITY_CHECK_CONCURRENCY", value, () => {
            expect(policyTurboStep("lint:deprecated-apis", "origin/main").args).toContain(`--concurrency=${expected}`);
          });
        }
      });
    });

    it("leaves changed-file selection to Turbo rather than manufacturing include arguments", () => {
      expect(rootLintPolicyStepsForTesting("/repo", ["docs/README.md"], "base")).toEqual(
        rootLintPolicyStepsForTesting("/repo", ["packages/demo/src/index.ts"], "base")
      );
    });

    it.effect("runs repo-wide root lint policy in D10 sequence", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const binDir = path.join(tmpDir, "bin");
          const fakeBunxPath = path.join(binDir, "bunx");
          const fakeBunPath = path.join(binDir, "bun");

          yield* fs.makeDirectory(path.join(tmpDir, "standards"), { recursive: true });
          yield* fs.writeFileString(
            path.join(tmpDir, "standards/lint-policy.sweeps.jsonc"),
            '{"schemaVersion":"lint-policy-sweeps/v1","deprecatedApis":"oxlint"}'
          );
          yield* fs.makeDirectory(binDir, { recursive: true });
          yield* fs.writeFileString(fakeBunxPath, A.join(["#!/usr/bin/env sh", "exit 0", ""], "\n"));
          yield* fs.writeFileString(fakeBunPath, A.join(["#!/usr/bin/env sh", "exit 0", ""], "\n"));
          yield* fs.chmod(fakeBunxPath, 0o755);
          yield* fs.chmod(fakeBunPath, 0o755);

          const exit = yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.exit(runRootLintPolicyTask(true))
          );

          exit.pipe(Exit.isSuccess, assertTrue);

          const logLines43 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines43, isString), "\n");
          // Derived from the same plan the runtime executes: a lint policy step
          // added on another branch must not break this assertion when the two
          // land together in a merge.
          const policyStepCount = A.length(rootLintPolicyStepsForTesting(tmpDir));
          expect(logText).toContain(`[beep-cli] lint:policy: running ${policyStepCount} ordered step(s)`);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("fails fast on local cheap reds, collects hosted reds, and refuses stale inventory comparisons", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = process.cwd();
          yield* fs.makeDirectory(`${root}/standards`, { recursive: true });
          yield* fs.writeFileString(
            `${root}/standards/lint-policy.sweeps.jsonc`,
            '{"schemaVersion":"lint-policy-sweeps/v1","deprecatedApis":"oxlint"}'
          );
          // A readable seal keeps the empty change set changed-scope instead of escalating it.
          yield* fs.writeFileString(
            `${root}/standards/policy-tools.fingerprint.json`,
            '{"schemaVersion":"policy-tools-fingerprint/v2","shared":[],"sharedTasks":[],"check":[],"entries":[]}'
          );
          yield* withoutCiEffect(
            withEnvVarEffect(
              "TURBO_CACHE",
              "local:rw",
              Effect.gen(function* () {
                for (const full of [false, true]) {
                  for (const failedLabel of ["lint:policy:cheap", full ? "lint:policy:medium" : "lint:policy:state"]) {
                    const plan = rootLintPolicyStepsForTesting(root, undefined, full ? undefined : "review-base");
                    const failed = pipe(
                      plan,
                      A.findFirst((step) => step.label === failedLabel),
                      O.getOrThrow
                    );
                    const spawner = cheapGatesSpawner([policyStepCommand(failed)], policyCommandKey);
                    const exit = yield* runRootLintPolicyTask(full, "review-base").pipe(
                      Effect.provideServiceEffect(Git, Git.make),
                      provideSpawner(spawner),
                      Effect.exit
                    );
                    expectPolicyGroupFailure(exit, failedLabel);
                    expectPolicySpawns(spawner, expectedPolicyRun(plan, full, failedLabel), full);
                  }
                }
              })
            )
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    // A hosted pull request runs changed-scope; it must still report every phase, not stop after cheap.
    it.effect("collects every phase of a hosted changed-scope run after a red cheap phase", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const root = process.cwd();
          yield* fs.makeDirectory(`${root}/standards`, { recursive: true });
          yield* fs.writeFileString(
            `${root}/standards/lint-policy.sweeps.jsonc`,
            '{"schemaVersion":"lint-policy-sweeps/v1","deprecatedApis":"oxlint"}'
          );
          yield* fs.writeFileString(
            `${root}/standards/policy-tools.fingerprint.json`,
            '{"schemaVersion":"policy-tools-fingerprint/v2","shared":[],"sharedTasks":[],"check":[],"entries":[]}'
          );
          yield* withEnvVarEffect(
            "CI",
            "true",
            withEnvVarEffect(
              "TURBO_CACHE",
              "local:rw",
              Effect.gen(function* () {
                const plan = rootLintPolicyStepsForTesting(root, undefined, "review-base", undefined, true);
                const cheap = O.getOrThrow(A.findFirst(plan, (step) => step.label === "lint:policy:cheap"));
                const spawner = cheapGatesSpawner([policyStepCommand(cheap)], policyCommandKey);
                const exit = yield* runRootLintPolicyTask(false, "review-base").pipe(
                  Effect.provideServiceEffect(Git, Git.make),
                  provideSpawner(spawner),
                  Effect.exit
                );
                expectPolicyGroupFailure(exit, "lint:policy:cheap");
                expectPolicySpawns(spawner, plan, false);
              })
            )
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

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

    it("resolves Turbo selector sets and their matching worker topology", () => {
      const owners = [
        CoverageScopeOwner.make({ packageName: "A", packagePath: "packages/a", hasCoverage: false }),
        CoverageScopeOwner.make({
          packageName: "B",
          packagePath: "packages/b",
          hasCoverage: true,
          workspaceDependencies: ["A"],
        }),
        CoverageScopeOwner.make({
          packageName: "C",
          packagePath: "packages/c",
          hasCoverage: true,
          workspaceDependencies: ["B"],
        }),
        CoverageScopeOwner.make({
          packageName: "@beep/repo-cli",
          packagePath: "packages/cli",
          hasCoverage: true,
          workspaceDependencies: ["B"],
        }),
      ];
      const cases: ReadonlyArray<readonly [string, ReadonlyArray<string>, number]> = [
        ["B", ["B"], 1],
        ["B...", ["A", "B"], 1],
        ["...B", ["@beep/repo-cli", "B", "C"], 2],
        ["...B...", ["@beep/repo-cli", "A", "B", "C"], 2],
        ["B^...", ["A"], 1],
        ["...^B", ["@beep/repo-cli", "C"], 2],
        ["...^B...", ["@beep/repo-cli", "A", "C"], 2],
        ["./packages/b", ["B"], 1],
        ["./packages/b...", ["A", "B"], 1],
        ["{./packages/b}", ["B"], 1],
        ["...{./packages/b}", ["@beep/repo-cli", "B", "C"], 2],
        ["...^{./packages/b}...", ["@beep/repo-cli", "A", "C"], 2],
        ["{./packages/*}", ["@beep/repo-cli", "A", "B", "C"], 2],
        ["@beep/repo-*", ["@beep/repo-cli"], 2],
        ["...^@beep/repo-cli", [], 1],
        ["C...", ["A", "B", "C"], 1],
        ["...A", ["@beep/repo-cli", "A", "B", "C"], 2],
      ];
      for (const [selector, names, workers] of cases) {
        assertSome(resolveCoverageSelector(owners, selector), names);
        expect(A.takeRight(coverageStepForTesting("/repo", [`--filter=${selector}`], owners).args, 3)).toEqual([
          "--",
          "--fileParallelism=true",
          `--maxWorkers=${workers}`,
        ]);
      }
      // The last selector passes the selector grammar but trips the glob compiler's pattern-length guard.
      for (const selector of ["missing[selector]", "missing", "!B", pipe("a", Str.repeat(65_537))]) {
        assertNone(resolveCoverageSelector(owners, selector));
        expect(A.takeRight(coverageStepForTesting("/repo", [`--filter=${selector}`], owners).args, 1)).toEqual([
          "--maxWorkers=2",
        ]);
      }
    });

    it("ends every coverage producer's argv with one Vitest topology", () => {
      const longPole = ["@beep/repo-cli", "@beep/schema"];
      const mixed = ["@beep/schema", "@beep/types"];
      const topologyOf = (step: QualityTaskStep | undefined): ReadonlyArray<string> =>
        A.takeRight(step?.args ?? A.empty<string>(), 3);
      const filtersOf = (step: QualityTaskStep): ReadonlyArray<string> =>
        pipe(
          step.args,
          A.filter((arg) => Str.startsWith("--filter=")(arg)),
          A.map((arg) => Str.slice(9)(arg))
        );

      expect(coverageVitestTopologyArgs(longPole)).toEqual(["--", "--fileParallelism=true", "--maxWorkers=2"]);
      expect(coverageVitestTopologyArgs(mixed)).toEqual(["--", "--fileParallelism=true", "--maxWorkers=1"]);

      // The narrow ratchet invocation reads its owners from the turbo filters it
      // carries, so a direct long-pole run measures like the shard that judges it.
      expect(topologyOf(coverageStepForTesting("/repo", ["--filter=@beep/repo-cli"]))).toEqual(
        coverageVitestTopologyArgs(longPole)
      );
      expect(topologyOf(coverageStepForTesting("/repo", ["--filter=@beep/schema"]))).toEqual(
        coverageVitestTopologyArgs(mixed)
      );
      expect(topologyOf(coverageStepForTesting("/repo", ["--write-baseline", "--filter=@beep/repo-cli"]))).toEqual(
        coverageVitestTopologyArgs(longPole)
      );
      expect(topologyOf(coverageStepForTesting("/repo", ["--write-baseline", "--filter=@beep/schema"]))).toEqual(
        coverageVitestTopologyArgs(mixed)
      );

      for (const packageNames of [longPole, mixed]) {
        const shards = A.drop(coverageFullStepsForTesting("/repo", packageNames, []), 1);
        const writeShards = A.drop(
          coverageSelectedStepsForTesting("/repo", packageNames, [], { hosted: true, writeBaseline: true }),
          1
        );
        expect(A.isReadonlyArrayNonEmpty(shards)).toBe(true);
        expect(A.isReadonlyArrayNonEmpty(writeShards)).toBe(true);
        for (const shard of A.appendAll(shards, writeShards)) {
          expect(topologyOf(shard)).toEqual(coverageVitestTopologyArgs(filtersOf(shard)));
        }
      }
    });

    it("builds the coverage invocation as the ratchet gate by default", () => {
      const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
        withEnvVar("NODE_OPTIONS", undefined, () => [coverageStepOf([])])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        label: "coverage:ratchet",
        command: "bunx",
        // The ratchet invocation carries the same Vitest topology the writer and
        // the full shards use, so all three measure the same rows.
        args: localOnlyTurboCacheArgs(
          expectedCoverageTurboArgs("coverage", ["--", "--fileParallelism=true", "--maxWorkers=1"])
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
        },
      });
      expect(steps[0]?.env).not.toHaveProperty("VITEST_COVERAGE_REPORT_ONLY");
    });

    it("reduces coverage children to the pull-request Turbo posture whatever the host carries", () => {
      const steps = withEnvVar("TURBO_API", "https://cache.example.test", () =>
        withEnvVar("TURBO_TOKEN", "op://fixture-vault/turbo/token", () =>
          withEnvVar("TURBO_TEAM", "team_fixture", () =>
            withEnvVar("TURBO_CACHE", "local:rw,remote:r", () => [coverageStepOf([])])
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
      const coverage = [coverageStepOf([])];
      const fullSteps = coverageFullStepsForTesting("/repo", ["@beep/schema"], []);
      const callerOwned = coverageFullStepsForTesting("/repo", ["@beep/schema"], ["--remote-only"]);

      expect(A.every(coverage, (step) => !hasRemoteTurboCacheArgs(step.args))).toBe(true);
      expect(A.every(A.drop(fullSteps, 1), (step) => !hasRemoteTurboCacheArgs(step.args))).toBe(true);
      expect(
        A.every(
          coverage,
          (step) => A.isReadonlyArrayEmpty(ambientPlanArgs) || A.contains(step.args, "--cache=local:rw")
        )
      ).toBe(true);
      // The prebuild is a plain build invocation and keeps the ambient plan.
      expect(fullSteps[0]?.args).toEqual(expect.arrayContaining([...ambientPlanArgs]));
      expect(A.every(A.drop(callerOwned, 1), (step) => A.contains(step.args, "--remote-only"))).toBe(true);
    });

    it("preserves existing Node options when disabling experimental Web Storage for coverage", () => {
      const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
        withEnvVar("NODE_OPTIONS", "--max-old-space-size=4096", () => [coverageStepOf([])])
      );

      expect(steps[0]?.env).toMatchObject({
        BEEP_FC_SEED: "20260708",
        NODE_OPTIONS: "--max-old-space-size=4096 --no-experimental-webstorage",
      });
    });

    it("honors an explicit fast-check seed for exploratory coverage runs", () => {
      const steps = withEnvVar("NODE_OPTIONS", undefined, () =>
        withEnvVar("BEEP_FC_SEED", "8675309", () => [coverageStepOf([])])
      );

      expect(steps[0]?.env).toMatchObject({
        BEEP_FC_SEED: "8675309",
        NODE_OPTIONS: "--no-experimental-webstorage",
      });
    });

    it("keeps report-only coverage reserved for baseline regeneration and strips writer controls", () => {
      const steps = withEnvVar("BEEP_FC_SEED", undefined, () =>
        withEnvVar("NODE_OPTIONS", undefined, () => [
          coverageStepOf(["--", "--write-baseline", "--replace-all", "--concurrency=1", "--force"]),
        ])
      );

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        label: "coverage:baseline",
        command: "bunx",
        args: localOnlyTurboCacheArgs(
          expectedTurboArgs("coverage", [
            "--concurrency=1",
            "--force",
            "--",
            "--fileParallelism=true",
            "--maxWorkers=1",
          ])
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
      "rejects replace-all without baseline writing and accepts it on a scoped write",
      flow(
        Effect.fnUntraced(
          function* () {
            const exit = yield* Effect.exit(validateCoverageTaskArgsForTesting("/repo", ["--replace-all"]));

            assertTrue(exit._tag === "Failure");
            if (Exit.isFailure(exit)) {
              assert.include(Cause.pretty(exit.cause), "--replace-all requires --write-baseline");
            }

            // A scoped `--replace-all` is the deliberate re-measure path, so the only
            // refusals left are the ones that were already there for scoped writes.
            const repoRoot = yield* findRepoRoot();
            const scoped = yield* validateCoverageTaskArgsForTesting(repoRoot, [
              "--write-baseline",
              "--replace-all",
              "--filter=@beep/repo-cli",
            ]);
            expect(scoped.replaceAll).toBe(true);
            expect(scoped.scoped).toBe(true);
            expect(scoped.expectedPackageNames).toEqual(["@beep/repo-cli"]);

            const rangeExit = yield* Effect.exit(
              validateCoverageTaskArgsForTesting(repoRoot, ["--write-baseline", "--replace-all", "--since=origin/main"])
            );
            rangeExit.pipe(Exit.isFailure, assertTrue);
            if (Exit.isFailure(rangeExit)) {
              assert.include(Cause.pretty(rangeExit.cause), "require exact --filter=<workspace-package> selectors");
            }
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "resolves exact explicit baseline filters into verifier-equivalent shard owners",
      flow(
        Effect.fnUntraced(
          function* () {
            const repoRoot = yield* findRepoRoot();
            const options = yield* validateCoverageTaskArgsForTesting(repoRoot, [
              "--write-baseline",
              "--filter=@beep/repo-cli",
              "--filter",
              "@beep/ui",
              "--filter=@beep/repo-cli",
            ]);

            expect(options.expectedPackageNames).toEqual(["@beep/repo-cli", "@beep/ui"]);
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects scoped baseline selectors that are not exact coverage owners",
      flow(
        Effect.fnUntraced(
          function* () {
            const repoRoot = yield* findRepoRoot();
            const exit = yield* Effect.exit(
              validateCoverageTaskArgsForTesting(repoRoot, ["--write-baseline", "--filter=...@beep/repo-cli"])
            );

            assertTrue(exit._tag === "Failure");
            if (Exit.isFailure(exit)) {
              assert.include(Cause.pretty(exit.cause), "must name exact workspace packages that define coverage");
            }
          },
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        ),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("compares coverage snapshots with fail-on-drop and warning-only new package semantics", () => {
      const result = compareCoverageRegressionSnapshotsForTesting(
        coverageRegressionBaseline,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/existing",
            baseline: CoveragePackageBaseline.make({
              path: "packages/existing",
              ...coveragePercentages(50),
              lines: Percentage.make(49.998),
              uncovered: coverageUncovered(1),
              files: {},
            }),
          }),
          CoverageSnapshotEntry.make({
            packageName: "@beep/new",
            baseline: coveragePackageBaseline("packages/new"),
          }),
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
      flow(
        Effect.fnUntraced(function* () {
          const encodedJson = yield* encodeJson({
            total: vitestCoverageMetrics(20, 15, 75),
            "/repo/packages/existing/src/Absolute.ts": vitestCoverageMetrics(10, 10, 100),
            "src/Relative.ts": vitestCoverageMetrics(10, 5, 50),
          });
          const baseline = yield* coveragePackageBaselineFromSummaryForTesting(
            "/repo",
            "/repo/packages/existing",
            encodedJson
          );
          const files = baseline.files;

          assert.strictEqual(baseline.path, "packages/existing");
          assert.deepStrictEqual(R.keys(files), [
            "packages/existing/src/Absolute.ts",
            "packages/existing/src/Relative.ts",
          ]);
          const relativeFile = files["packages/existing/src/Relative.ts"];
          assert.isDefined(relativeFile);
          assert.strictEqual(relativeFile.lines, Percentage.make(50));
          assert.strictEqual(relativeFile.uncovered.lines, S.Natural.make(5));
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "derives Istanbul-compatible percentages from trusted counts instead of the reported pct field",
      flow(
        Effect.fnUntraced(function* () {
          const encodedJson44 = yield* encodeJson({
            total: vitestCoverageMetrics(10, 0, 100),
            "src/Fractional.ts": vitestCoverageMetrics(134, 115, 100),
            "src/NoSubjects.ts": vitestCoverageMetrics(0, 0, "Unknown"),
          });
          const baseline = yield* coveragePackageBaselineFromSummaryForTesting(
            "/repo",
            "/repo/packages/existing",
            encodedJson44
          );
          const fractional = baseline.files["packages/existing/src/Fractional.ts"];
          const noSubjects = baseline.files["packages/existing/src/NoSubjects.ts"];

          assert.strictEqual(baseline.lines, Percentage.make(0));
          assert.isDefined(fractional);
          assert.strictEqual(fractional.lines, Percentage.make(85.82));
          assert.isDefined(noSubjects);
          assert.strictEqual(noSubjects.lines, Percentage.make(100));
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects absolute and relative summary entries that normalize to the same repository path in either order",
      flow(
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
              const encodedJson45 = yield* encodeJson({
                total: vitestCoverageMetrics(10, 10, 100),
                ...R.fromEntries(A.map(rawPaths, (rawPath) => [rawPath, vitestCoverageMetrics(10, 10, 100)])),
              });
              const error = yield* Effect.flip(
                coveragePackageBaselineFromSummaryForTesting("/repo", "/repo/packages/existing", encodedJson45)
              );
              return error.message;
            })
          );

          assert.strictEqual(messages[0], messages[1]);
          assert.include(messages[0] ?? "", 'both normalize to "packages/existing/src/Dupe.ts"');
          assert.include(messages[0] ?? "", "Remove the duplicate absolute/relative entry");
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects control characters in raw summary paths without reflecting them into diagnostics",
      flow(
        Effect.fnUntraced(function* () {
          yield* Effect.forEach(
            ["\u0000", "\u001B", "\u007F", "\u0085"],
            Effect.fnUntraced(function* (control) {
              const encodedJson46 = yield* encodeJson({
                total: vitestCoverageMetrics(10, 10, 100),
                [`src/Unsafe${control}Name.ts`]: vitestCoverageMetrics(10, 10, 100),
              });
              const error = yield* Effect.flip(
                coveragePackageBaselineFromSummaryForTesting("/repo", "/repo/packages/existing", encodedJson46)
              );

              assert.include(error.message, "without control characters");
              assert.notMatch(error.message, /[\u0000-\u001F\u007F-\u009F]/u);
            }),
            { discard: true }
          );
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "bounds coverage-summary decode diagnostics while retaining the typed parse cause",
      flow(
        Effect.fnUntraced(function* () {
          const invalidPct = Str.repeat(20_000)("x");
          const encodedJson47 = yield* encodeJson({
            total: {
              ...vitestCoverageMetrics(10, 10, 100),
              lines: { total: 10, covered: 10, skipped: 0, pct: invalidPct },
            },
          });
          const error = yield* Effect.flip(
            coveragePackageBaselineFromSummaryForTesting("/repo", "/repo/packages/existing", encodedJson47)
          );

          assert.isTrue(isDomainError(error));
          if (isDomainError(error)) {
            assert.include(error.message, "Failed to parse coverage summary fixture");
            assert.isAtMost(Str.length(error.message), 4_096);
            assert.isDefined(error.cause);
            // Effect 4.0.4 abbreviates the offending value when it renders a SchemaError, so
            // assert the typed cause is kept rather than the length of its rendering.
            assert.isTrue(S.isSchemaError(error.cause));
          }
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects internally inconsistent Vitest coverage summary counts",
      flow(
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
              const encodedJson48 = yield* encodeJson({ total: valid, "src/Index.ts": summary });
              const decoded = yield* Effect.exit(
                coveragePackageBaselineFromSummaryForTesting("/repo", "/repo/packages/existing", encodedJson48)
              );
              assertTrue(Exit.isFailure(decoded), `Expected ${label} to fail summary decoding`);
            }),
            { discard: true }
          );
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects current coverage baselines without per-file provenance",
      flow(
        Effect.fnUntraced(function* () {
          const decoded = yield* Effect.exit(
            decodeUnknownCoverageRegressionBaseline({
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

          decoded.pipe(Exit.isFailure, assertTrue);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects out-of-range v2 metrics, unsupported epsilon, and non-normalized file keys",
      flow(
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
              const decoded = yield* Effect.exit(decodeUnknownCoverageRegressionBaseline(input));
              assertTrue(Exit.isFailure(decoded), `Expected ${label} to fail baseline decoding`);
            }),
            { discard: true }
          );

          const unsafeFailure = yield* Effect.exit(
            decodeCoverageComparisonFailure({
              _tag: "baseline-drop",
              actual: 0,
              baseline: 100,
              filePath: "packages/existing/src/Unsafe\u001B.ts",
              metric: "lines",
              packageName: "@beep/existing",
              packagePath: "packages/existing",
            })
          );
          unsafeFailure.pipe(Exit.isFailure, assertTrue);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "keeps every committed coverage package on schema v2 with file provenance",
      flow(
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const content = yield* fs.readFileString(path.join(repoRoot, "standards/coverage.regression-baseline.jsonc"));
          const decoded = yield* decodeCoverageRegressionBaselineJsoncForTesting(content);

          assert.strictEqual(decoded.schema_version, 2);
          assert.isTrue(R.size(decoded.packages) > 0);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "rejects legacy schema versions after the per-file migration",
      flow(
        Effect.fnUntraced(function* () {
          const decoded = yield* Effect.exit(
            decodeUnknownCoverageRegressionBaseline({
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

          decoded.pipe(Exit.isFailure, assertTrue);
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "refuses scoped v1 writes and migrates a full regeneration to schema v2",
      flow(
        Effect.fnUntraced(function* () {
          yield* Effect.andThen(
            temporaryRepository,
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const repoRoot = process.cwd();
              const coverageDirectory = path.join(repoRoot, "coverage");
              const standardsDirectory = path.join(repoRoot, "standards");
              const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");

              yield* fs.makeDirectory(coverageDirectory, { recursive: true });
              yield* fs.makeDirectory(standardsDirectory, { recursive: true });
              const argument8 = path.join(repoRoot, "package.json");
              const encodedJson9 = yield* encodeJson({ name: "@beep/existing", scripts: { coverage: "vitest" } });
              yield* fs.writeFileString(argument8, encodedJson9);
              const argument9 = path.join(coverageDirectory, "coverage-summary.json");
              const encodedJson10 = yield* encodeJson({
                total: vitestCoverageMetrics(10, 8, 80),
                "src/Index.ts": vitestCoverageMetrics(10, 8, 80),
              });
              yield* fs.writeFileString(argument9, encodedJson10);
              const encodedJson49 = yield* encodeJson({
                schema_version: 1,
                generated_at: "2026-07-06T00:00:00.000Z",
                git_sha: "legacy-sha",
                command: "bun run coverage:baseline:write",
                epsilon: 0.001,
                packages: { "@beep/existing": { path: "." } },
              });
              yield* fs.writeFileString(baselinePath, encodedJson49);

              const scopedExit = yield* Effect.exit(writeCoverageRegressionBaseline(repoRoot, true));
              scopedExit.pipe(Exit.isFailure, assertTrue);
              if (Exit.isFailure(scopedExit)) {
                assert.include(Cause.pretty(scopedExit.cause), "schema version 1 requires a full");
              }

              const encodedJson50 = yield* encodeJson({
                schema_version: 1,
                generated_at: "2026-07-06T00:00:00.000Z",
                git_sha: "legacy-sha",
                command: "bun run coverage:baseline:write",
                epsilon: 0.001,
                minimum: { lines: 71, statements: 72, branches: 51, functions: 61 },
                exemptions: { "@beep/exempt": "Named migration exemption." },
                follow_ups: { "@beep/debt": "Named migration follow-up." },
                packages: { "@beep/existing": { path: "." } },
              });
              yield* fs.writeFileString(baselinePath, encodedJson50);

              yield* runGit(repoRoot, ["init"]);
              yield* runGit(repoRoot, ["config", "user.email", "coverage@example.invalid"]);
              yield* runGit(repoRoot, ["config", "user.name", "Coverage Test"]);
              yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
              yield* runGit(repoRoot, ["add", "package.json"]);
              yield* runGit(repoRoot, ["commit", "-m", "test: seed coverage fixture"]);
              yield* writeCoverageRegressionBaseline(repoRoot, false);

              const readFileString51 = yield* fs.readFileString(baselinePath);
              const migrated = yield* decodeCoverageRegressionBaselineJsoncForTesting(readFileString51);
              assert.strictEqual(migrated.schema_version, 2);
              assert.strictEqual(migrated.minimum.lines, 71);
              assert.strictEqual(migrated.minimum.statements, 72);
              assert.strictEqual(migrated.minimum.branches, 51);
              assert.strictEqual(migrated.minimum.functions, 61);
              assert.deepStrictEqual(migrated.exemptions, { "@beep/exempt": "Named migration exemption." });
              assert.deepStrictEqual(migrated.follow_ups, { "@beep/debt": "Named migration follow-up." });
              const migratedPackage = R.get(migrated.packages, "@beep/existing");
              migratedPackage.pipe(O.isSome, assertTrue);
              if (O.isSome(migratedPackage)) {
                assert.deepStrictEqual(R.keys(migratedPackage.value.files), ["src/Index.ts"]);
              }
            })
          ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect(
      "holds an unchanged package without a comparison base and replaces it after a dirty package change",
      flow(
        Effect.fnUntraced(function* () {
          yield* Effect.scoped(
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const repoRoot = yield* fs.makeTempDirectoryScoped();
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
              const argument10 = path.join(repoRoot, "package.json");
              const encodedJson11 = yield* encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/*"],
              });
              yield* fs.writeFileString(argument10, encodedJson11);
              const argument11 = path.join(packageDir, "package.json");
              const encodedJson12 = yield* encodeJson({
                name: "@beep/existing",
                private: true,
                scripts: { coverage: "vitest" },
              });
              yield* fs.writeFileString(argument11, encodedJson12);
              yield* fs.writeFileString(sourcePath, "export const value = 1;\n");
              const argument12 = path.join(coverageDirectory, "coverage-summary.json");
              const encodedJson13 = yield* encodeJson({
                total: vitestCoverageMetrics(10, 9, 90),
                "src/Index.ts": vitestCoverageMetrics(10, 9, 90),
              });
              yield* fs.writeFileString(argument12, encodedJson13);
              const encodedJson52 = yield* encodeJson({
                schema_version: 2,
                generated_at: "2026-07-06T00:00:00.000Z",
                git_sha: "committed-sha",
                command: "bun run coverage:baseline:write",
                epsilon: 0.001,
                minimum: coveragePercentages(0),
                exemptions: {},
                follow_ups: {},
                packages: { "@beep/existing": committedRow },
              });
              yield* fs.writeFileString(baselinePath, encodedJson52);

              yield* runGit(repoRoot, ["init"]);
              yield* runGit(repoRoot, ["config", "user.email", "coverage@example.invalid"]);
              yield* runGit(repoRoot, ["config", "user.name", "Coverage Test"]);
              yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
              yield* runGit(repoRoot, ["add", "--all"]);
              yield* runGit(repoRoot, ["commit", "-m", "test: seed unchanged coverage fixture"]);

              const planWorkspaceCoverageAffectedScope53 = yield* planWorkspaceCoverageAffectedScope(repoRoot, []);
              expect(planWorkspaceCoverageAffectedScope53).toMatchObject({ _tag: "noop" });
              const planWorkspaceCoverageAffectedScope54 = yield* planWorkspaceCoverageAffectedScope(repoRoot, [
                "package.json",
              ]);
              expect(planWorkspaceCoverageAffectedScope54).toMatchObject({
                _tag: "full",
              });

              yield* writeCoverageRegressionBaseline(repoRoot, false).pipe(
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "origin/main" })
                )
              );
              const readFileString55 = yield* fs.readFileString(baselinePath);
              const heldBaseline = yield* decodeCoverageRegressionBaselineJsoncForTesting(readFileString55);
              expect(heldBaseline.generated_at).toBe("2026-07-06T00:00:00.000Z");
              expect(heldBaseline.git_sha).toBe("committed-sha");
              expect(heldBaseline.packages["@beep/existing"]).toEqual(committedRow);
              const logLines56 = yield* TestConsole.logLines;
              expect(A.join(A.filter(logLines56, isString), "\n")).toContain(
                "replaced 0 changed package(s), added 0, held 1 unchanged package(s) at committed rows, pruned 0 (base: dirty worktree only)"
              );
              const logLines57 = yield* TestConsole.logLines;
              expect(A.join(A.filter(logLines57, isString), "\n")).toContain(
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
              const readFileString58 = yield* fs.readFileString(baselinePath);
              const replacedBaseline = yield* decodeCoverageRegressionBaselineJsoncForTesting(readFileString58);
              expect(replacedBaseline.generated_at).not.toBe("2026-07-06T00:00:00.000Z");
              expect(replacedBaseline.git_sha).not.toBe("committed-sha");
              expect(replacedBaseline.packages["@beep/existing"]?.lines).toBe(90);
              expect(replacedBaseline.packages["@beep/existing"]?.uncovered).toEqual(coverageUncovered(1));
              expect(replacedBaseline.packages["@beep/existing"]?.files).toEqual({
                "packages/existing/src/Index.ts": coverageFileBaseline(90, 1),
              });
              const logLines59 = yield* TestConsole.logLines;
              expect(A.join(A.filter(logLines59, isString), "\n")).toContain(
                "replaced 1 changed package(s), added 0, held 0 unchanged package(s) at committed rows, pruned 0 (base: dirty worktree only)"
              );
            })
          ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
        }),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("only fails missing baseline-package summaries for unscoped coverage runs", () => {
      expect(
        compareCoverageRegressionSnapshotsForTesting(coverageRegressionBaseline, [], false).missingActuals
      ).toEqual(["@beep/existing"]);
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
        [CoverageSnapshotEntry.make({ packageName, baseline: actual })],
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
          CoverageSnapshotEntry.make({
            packageName: "@beep/debt",
            baseline: coveragePackageBaseline("packages/debt", 10),
          }),
          CoverageSnapshotEntry.make({
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
          }),
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

    it("enforces committed coverage floors for labs above the repository minimum", () => {
      const packageName = "@beep/lab";
      const packagePath = "apps/labs/lab";
      const baseline = CoverageRegressionBaseline.make({
        ...coverageRegressionBaseline,
        packages: { [packageName]: coveragePackageBaseline(packagePath, 90) },
      });
      const result = compareCoverageRegressionSnapshotsForTesting(
        baseline,
        [
          CoverageSnapshotEntry.make({
            packageName,
            baseline: CoveragePackageBaseline.make({
              ...coveragePackageBaseline(packagePath, 80),
              uncovered: coverageUncovered(1),
            }),
          }),
        ],
        false
      );

      expect(result.minimumFailures).toEqual([]);
      expect(A.map(result.failures, (failure) => failure._tag)).toEqual(A.makeBy(4, () => "baseline-drop"));
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

      it("includes labs while walking through coverage-less dependents", () => {
        const owners = [
          owner("core"),
          owner("no-coverage", { hasCoverage: false, dependsOn: ["core"] }),
          owner("demo", { path: "apps/labs/demo", dependsOn: ["core"] }),
          owner("product", { dependsOn: ["no-coverage"] }),
          owner("showcase", { dependsOn: ["demo"] }),
        ];

        expect(coverageDependentOwners(owners, ["@beep/core"])).toEqual([
          "@beep/demo",
          "@beep/product",
          "@beep/showcase",
        ]);
        expect(planCoverageAffectedScope(owners, ["apps/labs/demo/src/App.tsx"])).toEqual({
          _tag: "selected",
          packageNames: ["@beep/demo", "@beep/showcase"],
          dependentPackageNames: ["@beep/showcase"],
        });
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

      it("routes generated governance metadata to tooling consumers and fails closed on unknown inputs", () => {
        const owners = [owner("repo-cli"), owner("repo-cli-kit"), owner("unrelated")];
        const inventory = "standards/effect-vitest.inventory.jsonc";
        const catalog = "standards/schema-catalog/@beep/schema.generated.jsonc";
        expect(planCoverageAffectedScope(owners, [inventory])).toEqual({
          _tag: "selected",
          packageNames: ["@beep/repo-cli"],
          dependentPackageNames: [],
        });
        expect(planCoverageAffectedScope(owners, [catalog])).toEqual({
          _tag: "selected",
          packageNames: ["@beep/repo-cli", "@beep/repo-cli-kit"],
          dependentPackageNames: [],
        });
        expect(planCoverageAffectedScope(owners, [inventory, "standards/unknown.jsonc"])._tag).toBe("full");
        expect(planCoverageAffectedScope([], [inventory])._tag).toBe("full");
        expect(planCoverageAffectedScope([owner("repo-cli")], [catalog])._tag).toBe("full");
        expect(
          planCoverageAffectedScope(owners, [
            "packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts",
          ])._tag
        ).toBe("full");
      });

      it.effect("reads workspace edges from the live inventory and never lists the repository root as an owner", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const writePackage = Effect.fnUntraced(function* (dir: string, manifest: Record<string, unknown>) {
              const argument13 = fs.makeDirectory(path.join(repoRoot, dir), { recursive: true });
              const argument14 = path.join(repoRoot, dir, "package.json");
              const encodedJson14 = yield* encodeJson(manifest);
              return yield* argument13.pipe(Effect.andThen(fs.writeFileString(argument14, encodedJson14)));
            });

            // The root carries the aggregate `coverage` script and a workspace
            // dependency, exactly the shape that would otherwise make it a
            // dependent of nearly every package.
            const argument15 = path.join(repoRoot, "package.json");
            const encodedJson15 = yield* encodeJson({
              name: "@beep/root",
              private: true,
              workspaces: ["packages/*"],
              scripts: { coverage: "beep-cli coverage" },
              devDependencies: { "@beep/a": "workspace:*" },
            });
            yield* fs.writeFileString(argument15, encodedJson15);
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

            const planWorkspaceCoverageAffectedScope60 = yield* planWorkspaceCoverageAffectedScope(repoRoot, [
              "packages/b/src/B.ts",
            ]);
            expect(planWorkspaceCoverageAffectedScope60).toEqual({
              _tag: "selected",
              packageNames: ["@beep/a", "@beep/b"],
              dependentPackageNames: ["@beep/a"],
            });
            yield* writePackage("packages/editor", { name: "@beep/editor", scripts: { coverage: "vitest" } });
            const atlasPath = "goals/lexical-playground-capability-atlas/research/capability-atlas.json";
            const atlasOwners = yield* workspaceCoverageScopeOwners(repoRoot);
            expect(planCoverageSelfJudgeScope(atlasOwners, [atlasPath]).packageExclusions["@beep/editor"]).toEqual({
              _tag: "owns-changed-file",
              filePath: atlasPath,
            });
            const atlasChangeSet = yield* coverageBaselineChangeSetFromChangedFiles(repoRoot, [atlasPath], "test");
            expect(atlasChangeSet.packageNames).toEqual(["@beep/editor"]);
            for (const globalInput of ["vitest.shared.ts", "packages/b/package.json"]) {
              const changeSet = yield* coverageBaselineChangeSetFromChangedFiles(
                repoRoot,
                ["packages/b/src/B.ts", globalInput],
                "test"
              );
              expect(changeSet.dependentPackageNames).toEqual(["@beep/a"]);
              expect(A.isReadonlyArrayNonEmpty(changeSet.fullReasons)).toBe(true);
              const previous = {
                "@beep/a": coveragePackageBaseline("packages/a", 80),
                "@beep/b": coveragePackageBaseline("packages/b", 80),
              };
              const measured = A.map(["a", "b"], (name) =>
                CoverageSnapshotEntry.make({
                  packageName: `@beep/${name}`,
                  baseline: coveragePackageBaseline(`packages/${name}`, 60),
                })
              );
              expect(
                planCoverageBaselineWrite(
                  previous,
                  measured,
                  changeSet,
                  CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
                ).dispositions
              ).toEqual({ "@beep/a": "replaced", "@beep/b": "replaced" });
            }

            const planWorkspaceCoverageAffectedScope61 = yield* planWorkspaceCoverageAffectedScope(repoRoot, [
              "packages/c/src/C.ts",
            ]);
            expect(planWorkspaceCoverageAffectedScope61).toEqual({
              _tag: "selected",
              packageNames: ["@beep/a"],
              dependentPackageNames: ["@beep/a"],
            });
          })
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

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

      it("treats the ciops extraction tree as coverage-inert", () => {
        const owners = [
          CoverageScopeOwner.make({
            packageName: "@beep/ciops",
            packagePath: "apps/labs/ciops",
            hasCoverage: false,
          }),
        ];
        expect(
          planCoverageAffectedScope(owners, [
            "explorations/beep-ci-operational-ontology/ontology/extraction/s6/output.json",
          ])._tag
        ).toBe("noop");
      });

      it("selects a registered fixture consumer in labs with a coverage script", () => {
        const owners = [
          CoverageScopeOwner.make({
            packageName: "@beep/repo-cli",
            packagePath: "apps/labs/cli",
            hasCoverage: true,
          }),
        ];
        const files = ["goals/fallow-quality-enforcement/research/feature-matrix.jsonc"];
        expect(planCoverageAffectedScope(owners, files)).toEqual({
          _tag: "selected",
          packageNames: ["@beep/repo-cli"],
          dependentPackageNames: [],
        });
        expect(changedCoverageOwners(owners, files)).toEqual(["@beep/repo-cli"]);
      });

      it("registers only coverage-executed drizzle fixture consumers", () => {
        const owners = A.map(
          [
            "epistemic-server",
            "workspace-server",
            "documents-server",
            "architecture-lab-server",
            "law-practice-server",
            "repo-cli",
          ],
          (name) =>
            CoverageScopeOwner.make({
              packageName: `@beep/${name}`,
              packagePath: `packages/${name}`,
              hasCoverage: true,
            })
        );
        expect(changedCoverageOwners(owners, ["packages/_internal/db-admin/drizzle/0001.sql"])).toEqual([
          "@beep/epistemic-server",
          "@beep/law-practice-server",
          "@beep/repo-cli",
        ]);
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

      it.effect("names one changed file per package and every dependent in package-name order", () =>
        Effect.gen(function* () {
          const owners = [owner("x"), owner("y", { dependsOn: ["x"] }), owner("z", { dependsOn: ["x"] }), owner("w")];
          // Two changed files in @beep/x: the first path in sorted order is the one
          // the witness names, so the diagnostic is stable across runs.
          const scope = planCoverageSelfJudgeScope(owners, [
            "packages/x/src/Index.ts",
            "packages/x/src/Alpha.ts",
            "packages/w/src/Index.ts",
          ]);

          // Dependents are assigned first, in package-name order, then direct
          // ownership overwrites any dependency witness for the same package.
          expect(R.keys(scope.packageExclusions)).toEqual(["@beep/y", "@beep/z", "@beep/w", "@beep/x"]);
          expect((yield* encodeCoverageSelfJudgeScopeEffect(scope)).packageExclusions).toEqual({
            "@beep/y": { _tag: "dependent-of-changed-package", packageName: "@beep/x" },
            "@beep/z": { _tag: "dependent-of-changed-package", packageName: "@beep/x" },
            "@beep/x": { _tag: "owns-changed-file", filePath: "packages/x/src/Alpha.ts" },
            "@beep/w": { _tag: "owns-changed-file", filePath: "packages/w/src/Index.ts" },
          });
          scope.globalExclusion.pipe(assertNone);
        }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
      );

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

      it("uses verifier-equivalent shards for narrow baseline writes", () => {
        const steps = coverageSelectedStepsForTesting("/repo", ["@beep/a", "@beep/b"], [], {
          hosted: false,
          writeBaseline: true,
        });

        expect(A.map(steps, (step) => step.label)).toEqual([
          "coverage:prebuild",
          "coverage:shard-1",
          "coverage:shard-2",
        ]);
        for (const step of A.drop(steps, 1)) {
          expect(step.args).toContain("--maxWorkers=1");
          expect(step.env).toMatchObject({ VITEST_COVERAGE_REPORT_ONLY: "1" });
        }
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

        assertNone(
          coverageBaselineRowDelta(
            previous,
            CoverageRegressionBaseline.make({ ...previous, minimum: coveragePercentages(1) })
          )
        );
        assertNone(
          coverageBaselineRowDelta(
            previous,
            CoverageRegressionBaseline.make({ ...previous, exemptions: { "@beep/x": "user-excluded" } })
          )
        );
        assertNone(
          coverageBaselineRowDelta(
            previous,
            CoverageRegressionBaseline.make({ ...previous, follow_ups: { "@beep/a": "needs tests" } })
          )
        );
      });

      it.effect("diffs the committed base against the working copy through git", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              encodeCoverageRegressionBaseline(document).pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (encoded) {
                    const encodedJson62 = yield* encodeJson(encoded);
                    return yield* fs.writeFileString(baselinePath, encodedJson62);
                  })
                )
              );

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "coverage-delta@example.test"]);
            yield* runGit(repoRoot, ["config", "user.name", "Coverage Delta Test"]);
            yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);

            // The base has no baseline at all: nothing can be diffed.
            yield* fs.writeFileString(path.join(repoRoot, "README.md"), "# fixture\n");
            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "initial"]);
            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a") }));
            const coverageBaselineRowDeltaFromBase63 = yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD");
            assertNone(coverageBaselineRowDeltaFromBase63);

            yield* runGit(repoRoot, ["add", "--all"]);
            yield* runGit(repoRoot, ["commit", "-m", "baseline"]);
            const delta = (present: ReadonlyArray<string>) =>
              O.some(CoverageBaselineRowDelta.make({ present, removed: [] }));
            const coverageBaselineRowDeltaFromBase64 = yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD");
            expect(coverageBaselineRowDeltaFromBase64).toEqual(delta([]));

            yield* writeBaseline(withRows({ "@beep/a": coveragePackageBaseline("packages/a", 61) }));
            const coverageBaselineRowDeltaFromBase65 = yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD");
            expect(coverageBaselineRowDeltaFromBase65).toEqual(delta(["@beep/a"]));

            yield* fs.writeFileString(baselinePath, "{ not jsonc");
            const coverageBaselineRowDeltaFromBase66 = yield* coverageBaselineRowDeltaFromBase(repoRoot, "HEAD");
            assertNone(coverageBaselineRowDeltaFromBase66);

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
            const coverageBaselineRowDeltaFromBase67 = yield* coverageBaselineRowDeltaFromBase(repoRoot, "trunk");
            expect(coverageBaselineRowDeltaFromBase67).toEqual(delta(["@beep/a"]));
          })
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

      it.effect("pins comparison reads to TURBO_SCM_BASE instead of the branch baseline", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              encodeCoverageRegressionBaseline(document).pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (encoded) {
                    const encodedJson68 = yield* encodeJson(encoded);
                    return yield* fs.writeFileString(baselinePath, encodedJson68);
                  })
                )
              );

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* runGit(repoRoot, ["init"]);
            yield* runGit(repoRoot, ["config", "user.email", "coverage-base@example.test"]);
            yield* runGit(repoRoot, ["config", "user.name", "Coverage Base Test"]);
            yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
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
            expect(selected.baseline.generated_at).toBe("base");
            expect(selected.baseline.packages["@beep/a"]?.lines).toBe(80);
            expect(selected.baseline.packages["@beep/a"]?.files["packages/a/src/Deleted.ts"]).toBeUndefined();
            expect(selected.baseline.packages["@beep/a"]?.files["packages/a/src/Existing.ts"]?.lines).toBe(80);
            expect(selected.baseline.packages["@beep/a"]?.files["packages/a/src/New.ts"]?.lines).toBe(65);
            // The branch's own document rides along so rows it raised can be judged against it.
            assertSome(
              O.map(selected.proposed, (proposed) => proposed.generated_at),
              "branch-relaxation"
            );
          })
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

      it.effect("reads the workspace baseline when TURBO_SCM_BASE is absent", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");

            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* encodeCoverageRegressionBaseline(
              CoverageRegressionBaseline.make({ ...coverageRegressionBaseline, generated_at: "workspace" })
            ).pipe(
              Effect.flatMap(
                Effect.fnUntraced(function* (encoded) {
                  const encodedJson69 = yield* encodeJson(encoded);
                  return yield* fs.writeFileString(baselinePath, encodedJson69);
                })
              )
            );

            const selected = yield* readCoverageComparisonBaselineForTesting(repoRoot).pipe(
              Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
            );
            expect(selected.baseline.generated_at).toBe("workspace");
            assertNone(selected.proposed);
          })
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

      it.effect("fails clearly when the configured comparison baseline cannot be read", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            yield* encodeCoverageRegressionBaseline(coverageRegressionBaseline).pipe(
              Effect.flatMap(
                Effect.fnUntraced(function* (encoded) {
                  const encodedJson70 = yield* encodeJson(encoded);
                  return yield* fs.writeFileString(baselinePath, encodedJson70);
                })
              )
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
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

      describe("a package the branch deleted is retired, not missing", () => {
        const baseFloors = withRows({
          "@beep/deleted": coveragePackageBaseline("packages/deleted", 80),
          "@beep/existing": coveragePackageBaseline("packages/existing", 80),
        });
        const measured = [
          CoverageSnapshotEntry.make({
            packageName: "@beep/existing",
            baseline: coveragePackageBaseline("packages/existing", 80),
          }),
        ];
        const compare = (proposed: O.Option<CoverageRegressionBaseline>) =>
          compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({ baseline: baseFloors, proposed }),
            measured,
            false
          );

        it("drops the missing summary when the branch's own baseline removed the row", () => {
          const result = compare(
            O.some(withRows({ "@beep/existing": coveragePackageBaseline("packages/existing", 80) }))
          );
          expect(result.missingActuals).toEqual([]);
        });

        it("still requires the summary while the branch keeps the row", () => {
          expect(compare(O.some(baseFloors)).missingActuals).toEqual(["@beep/deleted"]);
        });

        it("still requires the summary on an unpinned run", () => {
          expect(compare(O.none()).missingActuals).toEqual(["@beep/deleted"]);
        });
      });

      describe("rows a pull request raised are judged against its own values", () => {
        const filePath = "packages/existing/src/Index.ts";
        const packageRow = (
          metric: number,
          uncovered: number,
          files: Record<string, CoverageFileBaseline>
        ): CoveragePackageBaseline =>
          CoveragePackageBaseline.make({
            ...coveragePackageBaseline("packages/existing", metric),
            uncovered: coverageUncovered(uncovered),
            files,
          });
        const baseFloors = withRows({
          "@beep/existing": packageRow(80, 20, { [filePath]: coverageFileBaseline(80, 20) }),
        });
        const proposing = (row: CoveragePackageBaseline) => O.some(withRows({ "@beep/existing": row }));
        const compare = (proposed: O.Option<CoverageRegressionBaseline>, actual: CoveragePackageBaseline) =>
          compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({ baseline: baseFloors, proposed }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
            false
          );
        const allMetrics = ["branches", "functions", "lines", "statements"];

        it("fails a raised file row the lane does not reach and names both numbers", () => {
          const result = compare(
            proposing(packageRow(80, 20, { [filePath]: coverageFileBaseline(90, 10) })),
            packageRow(80, 20, { [filePath]: coverageFileBaseline(85, 15) })
          );

          // The base floor (80) is met, so the existing comparison stays green.
          expect(result.failures).toEqual([]);
          expect(result.raisedRowsJudged).toBe(4);
          expect(A.map(result.raisedRowFailures, (failure) => failure._tag)).toEqual(
            A.makeBy(4, () => "row-raised-beyond-reach")
          );
          expect(A.map(result.raisedRowFailures, (failure) => failure.metric)).toEqual(allMetrics);
          expect(renderCoverageFailuresForTesting(result.raisedRowFailures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: row raised beyond hosted reach: this pull request raised the row from 80 (20 uncovered) to 90 (10 uncovered) but the lane measured 85 (15 uncovered)`
          );
          const remediation = A.join(renderCoverageRemediation(result), "\n");
          expect(remediation).toContain(
            "@beep/existing carry row(s) this pull request raised above what the hosted lane measures"
          );
          expect(remediation).not.toContain("--write-baseline");
        });

        it("passes a raised row the lane reaches", () => {
          const result = compare(
            proposing(packageRow(80, 20, { [filePath]: coverageFileBaseline(90, 10) })),
            packageRow(80, 20, { [filePath]: coverageFileBaseline(90, 10) })
          );

          expect(result.raisedRowsJudged).toBe(4);
          expect(result.raisedRowFailures).toEqual([]);
          expect(result.failures).toEqual([]);
          expect(renderCoverageRemediation(result)).toEqual([]);
        });

        it("leaves lowered rows to the base floors when no merge base or change set is available", () => {
          const result = compare(
            proposing(packageRow(80, 20, { [filePath]: coverageFileBaseline(70, 30) })),
            packageRow(80, 20, { [filePath]: coverageFileBaseline(75, 25) })
          );

          expect(result.raisedRowsJudged).toBe(0);
          expect(result.raisedRowFailures).toEqual([]);
          expect(result.loweredFloors).toEqual([]);
          // Fail closed: without the merge-base document nothing is attributed to
          // this pull request, so 75 < 80 with more uncovered units is a drop.
          expect(A.map(result.failures, (failure) => failure._tag)).toEqual(A.makeBy(4, () => "baseline-drop"));
        });

        it("treats fewer uncovered units at an equal percentage as a raised row", () => {
          const result = compare(
            proposing(packageRow(80, 20, { [filePath]: coverageFileBaseline(80, 18) })),
            packageRow(80, 20, { [filePath]: coverageFileBaseline(79.5, 19) })
          );

          // Against the base floor 19 uncovered is not more than 20, so no drop is seen.
          expect(result.failures).toEqual([]);
          // Against the proposed row (18 uncovered) main would fail on its first push.
          expect(result.raisedRowsJudged).toBe(4);
          expect(A.map(result.raisedRowFailures, (failure) => failure.metric)).toEqual(allMetrics);
          // The counts name the stricter floor that actually failed, not just equal percentages.
          expect(renderCoverageFailuresForTesting(result.raisedRowFailures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: row raised beyond hosted reach: this pull request raised the row from 80 (20 uncovered) to 80 (18 uncovered) but the lane measured 79.5 (19 uncovered)`
          );
        });

        it("fails raised rows whose file the lane did not measure", () => {
          const vanished = compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: withRows({
                "@beep/existing": packageRow(80, 20, { [filePath]: coverageFileBaseline(0, 5) }),
              }),
              proposed: proposing(packageRow(80, 20, { [filePath]: coverageFileBaseline(50, 2) })),
            }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: packageRow(80, 20, {}) })],
            false
          );

          // The base row is 0%, so the vanished-path rule in the base comparison stays silent.
          expect(vanished.failures).toEqual([]);
          expect(vanished.raisedRowsJudged).toBe(4);
          expect(A.map(vanished.raisedRowFailures, (failure) => failure.actual)).toEqual([0, 0, 0, 0]);
          expect(renderCoverageFailuresForTesting(vanished.raisedRowFailures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: row raised beyond hosted reach: this pull request raised the row from 0 (5 uncovered) to 50 (2 uncovered) but the lane measured 0 (0 uncovered)`
          );
        });

        it("judges raised package totals with the package-level rule", () => {
          const result = compare(
            proposing(packageRow(90, 10, { [filePath]: coverageFileBaseline(80, 20) })),
            packageRow(85, 15, { [filePath]: coverageFileBaseline(80, 20) })
          );

          expect(result.failures).toEqual([]);
          expect(result.raisedRowsJudged).toBe(4);
          expect(A.map(result.raisedRowFailures, (failure) => O.isNone(failure.filePath))).toEqual([
            true,
            true,
            true,
            true,
          ]);
          expect(renderCoverageFailuresForTesting(result.raisedRowFailures)[0]).toBe(
            "  - @beep/existing (packages/existing) branches: row raised beyond hosted reach: this pull request raised the row from 80 (20 uncovered) to 90 (10 uncovered) but the lane measured 85 (15 uncovered)"
          );
        });

        it("passes a raised package total the lane reaches", () => {
          const result = compare(
            proposing(packageRow(90, 10, { [filePath]: coverageFileBaseline(80, 20) })),
            packageRow(90, 10, { [filePath]: coverageFileBaseline(80, 20) })
          );

          expect(result.raisedRowsJudged).toBe(4);
          expect(result.raisedRowFailures).toEqual([]);
          expect(result.failures).toEqual([]);
        });

        it("does not fail a vanished file whose raised metric proposes zero percent", () => {
          const newFile = "packages/existing/src/New.ts";
          const zeroRaise = compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: withRows({
                "@beep/existing": packageRow(80, 20, { [filePath]: coverageFileBaseline(0, 5) }),
              }),
              // Stricter by count only, still 0%: main's vanished-path rule needs a
              // positive percentage, so nothing fails. The file unknown to the base
              // document is not a candidate at all.
              proposed: proposing(
                packageRow(80, 20, {
                  [filePath]: coverageFileBaseline(0, 2),
                  [newFile]: coverageFileBaseline(50, 1),
                })
              ),
            }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: packageRow(80, 20, {}) })],
            false
          );

          expect(zeroRaise.raisedRowsJudged).toBe(4);
          expect(zeroRaise.raisedRowFailures).toEqual([]);
        });

        it("judges nothing without a pinned base or without a measured package", () => {
          const actual = packageRow(85, 15, { [filePath]: coverageFileBaseline(85, 15) });

          const unpinned = compare(O.none(), actual);
          expect(unpinned.raisedRowsJudged).toBe(0);
          expect(unpinned.raisedRowFailures).toEqual([]);

          const unmeasured = compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: baseFloors,
              proposed: O.some(
                withRows({
                  "@beep/existing": packageRow(90, 10, { [filePath]: coverageFileBaseline(90, 10) }),
                  "@beep/new": coveragePackageBaseline("packages/new", 90),
                })
              ),
            }),
            [],
            true
          );
          expect(unmeasured.raisedRowsJudged).toBe(0);
          expect(unmeasured.raisedRowFailures).toEqual([]);
        });
      });

      describe("rows a pull request lowered are judged by whether it could have moved them", () => {
        const filePath = "packages/existing/src/Index.ts";
        const packageRow = (
          metric: number,
          uncovered: number,
          files: Record<string, CoverageFileBaseline>
        ): CoveragePackageBaseline =>
          CoveragePackageBaseline.make({
            ...coveragePackageBaseline("packages/existing", metric),
            uncovered: coverageUncovered(uncovered),
            files,
          });
        const owners = [
          CoverageScopeOwner.make({ packageName: "@beep/dep", packagePath: "packages/dep", hasCoverage: true }),
          CoverageScopeOwner.make({
            packageName: "@beep/existing",
            packagePath: "packages/existing",
            hasCoverage: true,
            workspaceDependencies: ["@beep/dep"],
          }),
        ];
        const rows = (row: CoveragePackageBaseline) => withRows({ "@beep/existing": row });
        const allMetrics = ["branches", "functions", "lines", "statements"];
        const judge = (
          base: CoveragePackageBaseline,
          mergeBase: CoveragePackageBaseline,
          proposed: CoveragePackageBaseline,
          actual: CoveragePackageBaseline,
          changedFiles: ReadonlyArray<string> = []
        ) =>
          compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: rows(base),
              proposed: O.some(rows(proposed)),
              mergeBase: O.some(rows(mergeBase)),
              selfJudge: O.some(planCoverageSelfJudgeScope(owners, changedFiles)),
            }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
            false
          );
        const base = packageRow(80, 20, { [filePath]: coverageFileBaseline(80, 20) });
        const lowered = packageRow(70, 30, { [filePath]: coverageFileBaseline(70, 30) });

        it("judges a lowered row at its own value on a package the pull request could not have moved", () => {
          const result = judge(base, base, lowered, lowered);

          expect(result.failures).toEqual([]);
          expect(result.selfJudgeEligiblePackageNames).toEqual(["@beep/existing"]);
          // Four file metrics plus four package metrics.
          expect(A.length(result.loweredFloors)).toBe(8);
          expect(A.map(result.loweredFloors, (floor) => floor.metric)).toEqual([...allMetrics, ...allMetrics]);
          expect(renderCoverageLoweredFloors(result)[0]).toBe(
            "[coverage-ratchet] 8 floor(s) lowered by this pull request on packages it could not have moved (judged at the lowered value):"
          );
          expect(renderCoverageLoweredFloors(result)[1]).toBe(
            `  - @beep/existing (${filePath}) branches: 80 -> 70; lane measured 70`
          );
          expect(renderCoverageLoweredFloors(result)[5]).toBe(
            "  - @beep/existing (packages/existing) branches: 80 -> 70; lane measured 70"
          );
        });

        it("adds a tighten advisory when the lane measures above the lowered floor", () => {
          const result = judge(base, base, lowered, packageRow(71, 29, { [filePath]: coverageFileBaseline(71, 29) }));

          expect(result.failures).toEqual([]);
          expect(A.every(result.loweredFloors, (floor) => floor.tighten)).toBe(true);
          expect(renderCoverageLoweredFloors(result)[1]).toBe(
            `  - @beep/existing (${filePath}) branches: 80 -> 70; lane measured 71 (tighten: adopt the measured row)`
          );
        });

        it("keeps the base floor when the package owns a changed file", () => {
          const result = judge(base, base, lowered, lowered, [filePath]);

          expect(result.loweredFloors).toEqual([]);
          expect(result.selfJudgeEligiblePackageNames).toEqual([]);
          expect(A.map(result.failures, (failure) => failure._tag)).toEqual(A.makeBy(4, () => "baseline-drop"));
          expect(renderCoverageFailuresForTesting(result.failures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: 70 < 80 [row lowered by this pull request to 70; judged at the base floor because package owns changed file ${filePath}]`
          );
        });

        it("keeps the base floor when the package is a dependent of a changed package", () => {
          const result = judge(base, base, lowered, lowered, ["packages/dep/src/Index.ts"]);

          expect(result.loweredFloors).toEqual([]);
          expect(renderCoverageFailuresForTesting(result.failures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: 70 < 80 [row lowered by this pull request to 70; judged at the base floor because dependent of @beep/dep]`
          );
        });

        it("keeps the base floor when a global coverage input changed", () => {
          const result = judge(base, base, lowered, lowered, ["vitest.shared.ts"]);

          expect(result.loweredFloors).toEqual([]);
          expect(renderCoverageFailuresForTesting(result.failures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: 70 < 80 [row lowered by this pull request to 70; judged at the base floor because global input vitest.shared.ts changed]`
          );
        });

        it("does not attribute a row main raised after the branch diverged to the pull request", () => {
          // The base tip is stricter than the merge base because main raised the
          // row while this branch was open; the branch itself proposes the merge
          // base's value, so nothing here was lowered by it.
          const result = judge(
            packageRow(80, 20, { [filePath]: coverageFileBaseline(80, 20) }),
            lowered,
            lowered,
            packageRow(75, 25, { [filePath]: coverageFileBaseline(75, 25) })
          );

          expect(result.loweredFloors).toEqual([]);
          expect(
            A.map(
              result.failures,
              CoverageComparisonFailure.matchOrElse({ "baseline-drop": (drop) => drop.baseline }, (other) => other._tag)
            )
          ).toEqual([80, 80, 80, 80]);
          expect(renderCoverageFailuresForTesting(result.failures)[0]).toBe(
            `  - @beep/existing (${filePath}) branches: 75 < 80`
          );
        });

        it.effect("passes the #1076 shape when the package total is lowered with its file rows", () =>
          Effect.gen(function* () {
            const firstFile = "packages/existing/src/code-block-node.tsx";
            const secondFile = "packages/existing/src/mermaid-node.tsx";
            const withEditorFiles = (metric: number, uncovered: number, fileMetric: number, fileUncovered: number) =>
              packageRow(metric, uncovered, {
                [firstFile]: coverageFileBaseline(fileMetric, fileUncovered),
                [secondFile]: coverageFileBaseline(fileMetric, fileUncovered),
              });
            const editorBase = withEditorFiles(80, 20, 27.27, 8);
            const editorLowered = withEditorFiles(60, 30, 0, 11);

            const adopted = judge(editorBase, editorBase, editorLowered, editorLowered);
            expect(adopted.failures).toEqual([]);
            expect(A.length(adopted.loweredFloors)).toBe(12);

            // The file rows are lowered but the package total is left at the base
            // floor, so the package comparison still fails.
            const packageStillHigh = judge(
              editorBase,
              editorBase,
              withEditorFiles(80, 20, 0, 11),
              withEditorFiles(60, 30, 0, 11)
            );
            expect(A.map(packageStillHigh.failures, (failure) => failure._tag)).toEqual(
              A.makeBy(4, () => "baseline-drop")
            );
            pipe(
              packageStillHigh.failures,
              A.every((failure) => O.isNone(failure.filePath)),
              assertTrue
            );
            expect(renderCoverageMeasuredRowProposals(packageStillHigh)[1]).toBe(
              `  "@beep/existing" totals: ${yield* encodeCoverageFileBaselineJson(coverageFileBaseline(60, 30))}`
            );
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
        );

        it("passes the #1090 shape where every lowered row equals the hosted value", () => {
          const paths = A.makeBy(6, (index) => `packages/existing/src/Row${index}.ts`);
          const files = (metric: number, uncovered: number) =>
            R.fromEntries(A.map(paths, (path) => [path, coverageFileBaseline(metric, uncovered)] as const));
          const restoredBase = packageRow(80, 20, files(80, 20));
          const restored = packageRow(78, 24, files(78, 24));

          const result = judge(restoredBase, restoredBase, restored, restored);
          expect(result.failures).toEqual([]);
          expect(A.length(result.loweredFloors)).toBe(28);
        });

        it("sources policy fields from the base document, not the pull request's", () => {
          const measured = packageRow(50, 0, {});
          const strictBase = CoverageRegressionBaseline.make({
            ...rows(measured),
            minimum: coveragePercentages(60),
          });
          const laxProposed = CoverageRegressionBaseline.make({
            ...rows(measured),
            minimum: coveragePercentages(0),
            exemptions: { "@beep/existing": "user-excluded" },
            follow_ups: { "@beep/existing": "tracked debt" },
          });
          const result = compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: strictBase,
              proposed: O.some(laxProposed),
              mergeBase: O.some(strictBase),
              selfJudge: O.some(planCoverageSelfJudgeScope(owners, [])),
            }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: measured })],
            false
          );

          expect(A.map(result.minimumFailures, (failure) => failure.metric)).toEqual(allMetrics);
        });

        it("fails when the pull request removes a row for a package the lane still measures", () => {
          const result = compareCoverageRegressionSnapshotsWithProposedForTesting(
            CoverageComparisonBaselines.make({
              baseline: rows(base),
              proposed: O.some(CoverageRegressionBaseline.make({ ...coverageRegressionBaseline, packages: {} })),
              mergeBase: O.some(rows(base)),
              selfJudge: O.some(planCoverageSelfJudgeScope(owners, [])),
            }),
            [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: base })],
            false
          );

          expect(A.map(result.packageRowRemovals, (removal) => removal.packageName)).toEqual(["@beep/existing"]);
          expect(A.map(result.packageRowRemovals, (removal) => removal.packagePath)).toEqual(["packages/existing"]);
        });

        it.effect("proposes the measured row for every reported path and round-trips it", () =>
          Effect.gen(function* () {
            const result = judge(base, base, lowered, lowered, [filePath]);
            const lines = renderCoverageMeasuredRowProposals(result);

            expect(lines[0]).toBe(
              "[coverage-ratchet] measured rows for the reported paths (hosted evidence; paste into standards/coverage.regression-baseline.jsonc):"
            );
            expect(lines[1]).toBe(
              `  "@beep/existing" totals: ${yield* encodeCoverageFileBaselineJson(coverageFileBaseline(70, 30))}`
            );
            expect(lines[2]).toBe(
              `  "@beep/existing" files["${filePath}"]: ${yield* encodeCoverageFileBaselineJson(coverageFileBaseline(70, 30))}`
            );
            const decoded = yield* Effect.forEach(
              A.drop(lines, 1),
              Effect.fnUntraced(function* (line) {
                return yield* decodeCoverageFileBaselineJson(O.getOrElse(A.last(Str.split(": ")(line)), () => ""));
              })
            );
            expect(A.map(decoded, (row) => row.lines)).toEqual([70, 70]);
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
        );

        it("names the writer only for a new file, never for a drop on an existing row", () => {
          const droppedRemediation = A.join(
            renderCoverageRemediation(judge(base, base, lowered, lowered, [filePath])),
            "\n"
          );
          expect(droppedRemediation).not.toContain("--write-baseline");
          expect(droppedRemediation).toContain("lowering such a row in this pull request does not pass");

          const untouchedDrop = judge(
            base,
            base,
            base,
            packageRow(70, 30, { [filePath]: coverageFileBaseline(70, 30) })
          );
          const untouchedRemediation = A.join(renderCoverageRemediation(untouchedDrop), "\n");
          expect(untouchedRemediation).not.toContain("--write-baseline");
          expect(untouchedRemediation).toContain(`this pull request changed nothing that runs under ${filePath}`);

          const newFile = "packages/existing/src/New.ts";
          const newFileRemediation = A.join(
            renderCoverageRemediation(
              judge(
                base,
                base,
                base,
                packageRow(80, 20, {
                  [filePath]: coverageFileBaseline(80, 20),
                  [newFile]: coverageFileBaseline(50, 3),
                })
              )
            ),
            "\n"
          );
          expect(newFileRemediation).toContain("bun run coverage -- --filter=@beep/existing --write-baseline");
          expect(newFileRemediation).toContain("packages that own no changed file are held");
        });

        it.effect("reads the merge base and the change set from a pinned base in a real repository", () =>
          Effect.andThen(
            temporaryRepository,
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const repoRoot = process.cwd();
              const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
              const writeBaseline = (document: CoverageRegressionBaseline) =>
                encodeCoverageRegressionBaseline(document).pipe(
                  Effect.flatMap(
                    Effect.fnUntraced(function* (encoded) {
                      const encodedJson71 = yield* encodeJson(encoded);
                      return yield* fs.writeFileString(baselinePath, encodedJson71);
                    })
                  )
                );
              const workspaceRow = (packageName: string, metric: number, uncovered: number) =>
                CoveragePackageBaseline.make({
                  ...coveragePackageBaseline(`packages/${packageName}`, metric),
                  uncovered: coverageUncovered(uncovered),
                  files: {},
                });

              yield* fs.makeDirectory(path.join(repoRoot, "packages/touched/src"), { recursive: true });
              yield* fs.makeDirectory(path.join(repoRoot, "packages/untouched/src"), { recursive: true });
              yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
              const argument16 = path.join(repoRoot, "package.json");
              const encodedJson16 = yield* encodeJson({
                name: "@beep/test-root",
                private: true,
                workspaces: ["packages/*"],
              });
              yield* fs.writeFileString(argument16, encodedJson16);
              yield* Effect.forEach(
                ["touched", "untouched"],
                Effect.fnUntraced(function* (name) {
                  const argument17 = path.join(repoRoot, `packages/${name}/package.json`);
                  const encodedJson17 = yield* encodeJson({
                    name: `@beep/${name}`,
                    private: true,
                    scripts: { coverage: "vitest" },
                  });
                  return yield* Effect.all([
                    fs.writeFileString(argument17, encodedJson17),
                    fs.writeFileString(path.join(repoRoot, `packages/${name}/src/Index.ts`), "export const v = 1;\n"),
                  ]);
                })
              );
              yield* writeBaseline(
                withRows({
                  "@beep/touched": workspaceRow("touched", 80, 20),
                  "@beep/untouched": workspaceRow("untouched", 80, 20),
                })
              );
              yield* runGit(repoRoot, ["init"]);
              yield* runGit(repoRoot, ["config", "user.email", "coverage-lowered@example.test"]);
              yield* runGit(repoRoot, ["config", "user.name", "Coverage Lowered Test"]);
              yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
              yield* runGit(repoRoot, ["add", "--all"]);
              yield* runGit(repoRoot, ["commit", "-m", "seed"]);

              // The branch lowers both rows but only touches one package.
              yield* writeBaseline(
                withRows({
                  "@beep/touched": workspaceRow("touched", 70, 30),
                  "@beep/untouched": workspaceRow("untouched", 70, 30),
                })
              );
              yield* fs.writeFileString(path.join(repoRoot, "packages/touched/src/Index.ts"), "export const v = 2;\n");

              const baselines = yield* readCoverageComparisonBaselineForTesting(repoRoot).pipe(
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown({ TURBO_SCM_BASE: "HEAD" })
                )
              );
              assertSome(
                O.map(baselines.mergeBase, (document) => document.packages["@beep/touched"]?.lines),
                Percentage.make(80)
              );
              assertSome(
                O.map(baselines.selfJudge, (scope) => scope.packageExclusions["@beep/touched"]?._tag),
                "owns-changed-file"
              );
              expect(
                O.getOrElse(
                  O.map(baselines.selfJudge, (scope) => R.has(scope.packageExclusions, "@beep/untouched")),
                  () => true
                )
              ).toBe(false);

              const result = compareCoverageRegressionSnapshotsWithProposedForTesting(
                baselines,
                [
                  CoverageSnapshotEntry.make({
                    packageName: "@beep/touched",
                    baseline: workspaceRow("touched", 70, 30),
                  }),
                  CoverageSnapshotEntry.make({
                    packageName: "@beep/untouched",
                    baseline: workspaceRow("untouched", 70, 30),
                  }),
                ],
                false
              );

              expect(A.map(result.failures, (failure) => failure.packageName)).toEqual(
                A.makeBy(4, () => "@beep/touched")
              );
              expect(A.map(result.loweredFloors, (floor) => floor.packageName)).toEqual(
                A.makeBy(4, () => "@beep/untouched")
              );
            })
          ).pipe(
            Effect.provideServiceEffect(Console.Console, TestConsole.make),
            Effect.provideServiceEffect(Console.Console, TestConsole.make),
            TestClock.withLive
          )
        );
      });

      it.effect("resolves an affected run from a dirty row-only baseline edit against the workspace", () =>
        Effect.andThen(
          temporaryRepository,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repoRoot = process.cwd();
            const baselinePath = path.join(repoRoot, "standards/coverage.regression-baseline.jsonc");
            const writeBaseline = (document: CoverageRegressionBaseline) =>
              encodeCoverageRegressionBaseline(document).pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (encoded) {
                    const encodedJson72 = yield* encodeJson(encoded);
                    return yield* fs.writeFileString(baselinePath, encodedJson72);
                  })
                )
              );

            yield* fs.makeDirectory(path.join(repoRoot, "packages/existing/src"), { recursive: true });
            yield* fs.makeDirectory(path.dirname(baselinePath), { recursive: true });
            const argument18 = path.join(repoRoot, "package.json");
            const encodedJson18 = yield* encodeJson({
              name: "@beep/test-root",
              private: true,
              workspaces: ["packages/*"],
            });
            yield* fs.writeFileString(argument18, encodedJson18);
            const argument19 = path.join(repoRoot, "packages/existing/package.json");
            const encodedJson19 = yield* encodeJson({
              name: "@beep/existing",
              private: true,
              scripts: { coverage: "vitest" },
            });
            yield* fs.writeFileString(argument19, encodedJson19);
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
            yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
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
            exit.pipe(Exit.isSuccess, assertTrue);
          })
        ).pipe(
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          TestClock.withLive
        )
      );

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
        expect(planCoverageAffectedScope(owners, ["standards/jsdoc-totals.regression-baseline.jsonc"])).toMatchObject({
          _tag: "full",
        });
      });

      it("never offers the writer for a drop on an existing row", () => {
        const baseline = withRows({
          "@beep/a": coveragePackageBaseline("packages/a", 50),
          "@beep/b": coveragePackageBaseline("packages/b", 50),
          "@beep/ok": coveragePackageBaseline("packages/ok", 50),
        });
        // A drop with more uncovered units is a regression; a drop with the same
        // uncovered count reads as deleted covered code and is not.
        const regressed = (path: string) =>
          CoveragePackageBaseline.make({
            path,
            ...coveragePercentages(40),
            uncovered: coverageUncovered(6),
            files: {},
          });
        const result = compareCoverageRegressionSnapshotsForTesting(
          baseline,
          [
            CoverageSnapshotEntry.make({ packageName: "@beep/b", baseline: regressed("packages/b") }),
            CoverageSnapshotEntry.make({ packageName: "@beep/a", baseline: regressed("packages/a") }),
            CoverageSnapshotEntry.make({
              packageName: "@beep/ok",
              baseline: coveragePackageBaseline("packages/ok", 50),
            }),
          ],
          false
        );

        expect(coverageScopedBaselineWriteCommand(["@beep/md", "@beep/pandoc-ast"])).toBe(
          "bun run coverage -- --filter=@beep/md --filter=@beep/pandoc-ast --write-baseline"
        );
        const lines = renderCoverageRemediation(result);
        // The writer cannot move a floor the run is judged against, so a drop on
        // an existing row states the two real outcomes and names no command. This
        // run has no pinned base, so it is also the main-push wording: it points
        // at a restore pull request instead of framing the push as one.
        expect(result.basePinned).toBe(false);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(
          "[coverage-ratchet] remediation: @beep/a, @beep/b lost coverage on rows judged at the committed floors"
        );
        expect(lines[0]).toContain("open a pull request that lowers only those rows to the values printed above");
        expect(lines[0]).not.toContain("this pull request");
        expect(lines[0]).not.toContain("--write-baseline");
        expect(result.measuredProposals).toEqual([]);

        // A tier-minimum breach is not a floor the writer can move: no write command.
        const tiered = CoverageRegressionBaseline.make({ ...baseline, minimum: coveragePercentages(60) });
        const belowTier = renderCoverageRemediation(
          compareCoverageRegressionSnapshotsForTesting(
            tiered,
            [
              CoverageSnapshotEntry.make({
                packageName: "@beep/ok",
                baseline: coveragePackageBaseline("packages/ok", 50),
              }),
            ],
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
              [
                CoverageSnapshotEntry.make({
                  packageName: "@beep/ok",
                  baseline: coveragePackageBaseline("packages/ok", 50),
                }),
              ],
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

    it.effect("collects both sides of a committed cross-package rename", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = process.cwd();
          const sourcePath = path.join(repoRoot, "packages/a/test/moved.test.ts");
          const destinationPath = path.join(repoRoot, "packages/b/test/moved.test.ts");

          yield* runGit(repoRoot, ["init"]);
          yield* runGit(repoRoot, ["config", "user.email", "coverage-scope@example.test"]);
          yield* runGit(repoRoot, ["config", "user.name", "Coverage Scope Test"]);
          yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
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
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

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
      expect(
        planCoverageAffectedScope(owners, ["packages/tooling/test-kit/test-utils/src/TestClock.ts"])
      ).toMatchObject({
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
          "--filter=@beep/repo-cli",
          "--filter=@beep/repo-utils",
          "--filter=@beep/a",
          "--filter=@beep/b",
          "--filter=@beep/c",
          "--filter=@beep/d",
          "--filter=@beep/e",
          "--filter=@beep/f",
          "--filter=@beep/g",
          "--filter=@beep/h",
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

    it("filters the full-coverage prebuild to the coverage owners", () => {
      // Quality audit A2 (2026-11-02): an unfiltered `turbo run build` prebuild also
      // built @beep/storybook, which owns no coverage task and is in no owner's
      // build closure. The prebuild now carries one positive filter per owner, as
      // the selected-coverage path already did; turbo adds each owner's `^build`.
      const packageNames = ["@beep/schema", "@beep/repo-cli", "@beep/utils"];
      const [prebuild, ...shards] = coverageFullStepsForTesting("/repo", packageNames, ["--summarize"]);
      const prebuildFilters = A.filter(prebuild.args, Str.startsWith("--filter="));
      expect(prebuildFilters).toEqual(A.map(packageNames, (name) => `--filter=${name}`));
      expect(prebuild.args).not.toContain("--only");
      expect(prebuild.args).not.toContain("--filter=@beep/storybook");
      const selected = coverageSelectedStepsForTesting("/repo", packageNames, ["--summarize"], {
        hosted: true,
        writeBaseline: false,
      });
      expect(prebuildFilters).toEqual(A.filter(selected[0].args, Str.startsWith("--filter=")));
      // Every owner still lands in exactly one shard behind the filtered prebuild.
      const shardFilters = pipe(
        shards,
        A.flatMap((step) => A.filter(step.args, Str.startsWith("--filter=@beep/"))),
        A.sort(Order.String)
      );
      expect(shardFilters).toEqual(
        A.sort(
          A.map(packageNames, (name) => `--filter=${name}`),
          Order.String
        )
      );
    });

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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures;

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
        [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
        compareCoverageRegressionSnapshotsForTesting(
          before,
          [CoverageSnapshotEntry.make({ packageName: "@beep/existing", baseline: actual })],
          false
        ).failures
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
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
          CoverageSnapshotEntry.make({ packageName: "@beep/held", baseline: measuredHeld }),
        ],
        changeSet,
        CoverageBaselineWriteOptions.make({ replaceAll: false })
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
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
          CoverageSnapshotEntry.make({ packageName: "@beep/held", baseline: measuredHeld }),
          CoverageSnapshotEntry.make({
            packageName: "@beep/new",
            baseline: coveragePackageBaseline("packages/new", 90),
          }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "origin/main merge-base a1b2c3d",
          packageNames: ["@beep/changed"],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: false })
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
          CoverageSnapshotEntry.make({ packageName: "@beep/a", baseline: coveragePackageBaseline("packages/a", 80) }),
          CoverageSnapshotEntry.make({ packageName: "@beep/b", baseline: coveragePackageBaseline("packages/b", 90) }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "dirty worktree only",
          packageNames: [],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: false })
      );

      expect(plan.dispositions).toEqual({ "@beep/a": "held", "@beep/b": "held" });
      expect(plan.packages["@beep/a"]?.lines).toBe(40);
      expect(plan.packages["@beep/b"]?.lines).toBe(50);
    });

    it("replaces every measured row when replace-all overrides a no-op change set", () => {
      const plan = planCoverageBaselineWrite(
        { "@beep/existing": coveragePackageBaseline("packages/existing", 50) },
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/existing",
            baseline: coveragePackageBaseline("packages/existing", 80),
          }),
          CoverageSnapshotEntry.make({
            packageName: "@beep/new",
            baseline: coveragePackageBaseline("packages/new", 90),
          }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "dirty worktree only",
          packageNames: [],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: true })
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

    it.effect("fails the module-tags lint on a tracked @module fileoverview and passes once it is replaced", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = process.cwd();
          const filePath = path.join(repoRoot, "packages/example/src/Index.ts");
          const fileWith = (tag: string) =>
            A.join(["/**", " * Fixture module.", " *", ` * @${tag} example`, " */", "export const v = 1;", ""], "\n");

          yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
          yield* fs.writeFileString(filePath, fileWith("module"));
          yield* runGit(repoRoot, ["init"]);
          yield* runGit(repoRoot, ["add", "--all"]);

          const failure = yield* Effect.flip(runJSDocModuleTagsCheck());
          expect(failure.message).toBe("JSDoc module tag violations were found.");

          yield* fs.writeFileString(filePath, fileWith("packageDocumentation"));
          yield* runJSDocModuleTagsCheck();

          const logLines73 = yield* TestConsole.logLines;
          expect(A.join(A.filter(logLines73, isString), "\n")).toContain(
            "[check:jsdoc-module-tags] verified tracked fileoverview comments do not use @module"
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it.effect("removes the coverage output directory of every workspace package that declares a coverage script", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = process.cwd();
          const coveredCoverage = path.join(repoRoot, "packages/covered/coverage");
          const bareCoverage = path.join(repoRoot, "packages/bare/coverage");

          yield* fs.makeDirectory(coveredCoverage, { recursive: true });
          yield* fs.makeDirectory(bareCoverage, { recursive: true });
          const argument20 = path.join(repoRoot, "package.json");
          const encodedJson20 = yield* encodeJson({
            name: "@beep/clean-root",
            private: true,
            workspaces: ["packages/*"],
          });
          yield* fs.writeFileString(argument20, encodedJson20);
          const argument21 = path.join(repoRoot, "packages/covered/package.json");
          const encodedJson21 = yield* encodeJson({
            name: "@beep/covered",
            private: true,
            scripts: { coverage: "vitest" },
          });
          yield* fs.writeFileString(argument21, encodedJson21);
          const argument22 = path.join(repoRoot, "packages/bare/package.json");
          const encodedJson22 = yield* encodeJson({ name: "@beep/bare", private: true });
          yield* fs.writeFileString(argument22, encodedJson22);
          yield* fs.writeFileString(path.join(coveredCoverage, "coverage-summary.json"), "{}\n");
          yield* fs.writeFileString(path.join(bareCoverage, "coverage-summary.json"), "{}\n");

          yield* cleanCoverageRegressionOutputs(repoRoot);

          const exists74 = yield* fs.exists(coveredCoverage);
          expect(exists74).toBe(false);
          // A package without a coverage script owns no coverage output the
          // ratchet reads, so the cleaner leaves it alone.
          const exists75 = yield* fs.exists(bareCoverage);
          expect(exists75).toBe(true);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make)
      )
    );

    it("reports a measured package with no committed row as added rather than held", () => {
      const previous = { "@beep/changed": coveragePackageBaseline("packages/changed", 50) };
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
          CoverageSnapshotEntry.make({
            packageName: "@beep/fresh",
            baseline: coveragePackageBaseline("packages/fresh", 88),
          }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "dirty worktree only",
          packageNames: ["@beep/changed"],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
      );

      expect(plan.dispositions).toEqual({ "@beep/changed": "replaced", "@beep/fresh": "added" });
      expect(coverageBaselineWriteReport(plan, previous)).toContain(
        "[coverage-ratchet] @beep/fresh: added (no committed row)"
      );
    });

    it("holds a measured package a scoped write never changed and carries every unmeasured row", () => {
      const committedHeld = CoveragePackageBaseline.make({
        path: "packages/held",
        ...coveragePercentages(61),
        uncovered: coverageUncovered(7),
        files: { "packages/held/src/Index.ts": coverageFileBaseline(61, 7) },
      });
      const measuredHeld = CoveragePackageBaseline.make({
        ...committedHeld,
        ...coveragePercentages(93),
        uncovered: coverageUncovered(1),
        files: { "packages/held/src/Index.ts": coverageFileBaseline(93, 1) },
      });
      const previous = {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/held": committedHeld,
        "@beep/unmeasured": coveragePackageBaseline("packages/unmeasured", 70),
      };
      const entries = [
        CoverageSnapshotEntry.make({
          packageName: "@beep/changed",
          baseline: coveragePackageBaseline("packages/changed", 80),
        }),
        CoverageSnapshotEntry.make({ packageName: "@beep/held", baseline: measuredHeld }),
      ];
      const changeSet = CoverageBaselineChangeSet.make({
        baseDescription: "dirty worktree only",
        packageNames: ["@beep/changed"],
        fullReasons: [],
      });

      const plan = planCoverageBaselineWrite(
        previous,
        entries,
        changeSet,
        CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
      );

      // The package the change set named is adopted whole; the other measured
      // package keeps its committed row, and the unmeasured row is carried.
      expect(plan.dispositions).toEqual({ "@beep/changed": "replaced", "@beep/held": "held" });
      expect(R.keys(plan.packages)).toEqual(["@beep/changed", "@beep/held", "@beep/unmeasured"]);
      expect(plan.packages["@beep/changed"]?.lines).toBe(80);
      expect(plan.packages["@beep/held"]).toEqual(committedHeld);
      expect(plan.packages["@beep/unmeasured"]?.lines).toBe(70);

      const report = coverageBaselineWriteReport(plan, previous);
      expect(report).toContain("[coverage-ratchet] @beep/changed: adopted");
      expect(report).toContain(
        "[coverage-ratchet] @beep/held: held (owns no changed file; pass --replace-all to re-measure it)"
      );
      expect(report).toContain(
        "[coverage-ratchet] value(s) this write raised above the committed rows (the hosted pull-request run judges each one):"
      );
      expect(report).toContain("  - @beep/changed totals branches: 50 -> 80 (0 -> 0 uncovered)");
    });

    it("adopts dependents on a scoped write only, keeping the unscoped writer on direct owners", () => {
      const previous = {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/dependent": coveragePackageBaseline("packages/dependent", 61),
      };
      const entries = [
        CoverageSnapshotEntry.make({
          packageName: "@beep/changed",
          baseline: coveragePackageBaseline("packages/changed", 80),
        }),
        CoverageSnapshotEntry.make({
          packageName: "@beep/dependent",
          baseline: coveragePackageBaseline("packages/dependent", 93),
        }),
      ];
      const changeSet = CoverageBaselineChangeSet.make({
        baseDescription: "dirty worktree only",
        packageNames: ["@beep/changed"],
        dependentPackageNames: ["@beep/dependent"],
        fullReasons: [],
      });

      // A scoped write measured the dependent on purpose, so holding its row would
      // commit a floor the next hosted run cannot reach.
      expect(
        planCoverageBaselineWrite(
          previous,
          entries,
          changeSet,
          CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
        ).dispositions
      ).toEqual({ "@beep/changed": "replaced", "@beep/dependent": "replaced" });

      // An unscoped regeneration keeps the 2026-08-24 direct-owners rule: one
      // foundation edit closes over most of the workspace.
      expect(
        planCoverageBaselineWrite(
          previous,
          entries,
          changeSet,
          CoverageBaselineWriteOptions.make({ replaceAll: false })
        ).dispositions
      ).toEqual({
        "@beep/changed": "replaced",
        "@beep/dependent": "held",
      });
    });

    it("names the adopted packages a scoped filter run never measured", () => {
      const previous = {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/dependent": coveragePackageBaseline("packages/dependent", 61),
      };
      const changeSet = CoverageBaselineChangeSet.make({
        baseDescription: "origin/main merge-base a1b2c3d",
        packageNames: ["@beep/changed"],
        dependentPackageNames: ["@beep/dependent"],
        fullReasons: [],
      });

      // --filter=@beep/changed narrows measurement without narrowing adoption, so
      // the dependent keeps its committed row instead of being adopted at a floor
      // this run never measured.
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
        ],
        changeSet,
        CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
      );

      expect(plan.carriedUnmeasured).toEqual(["@beep/dependent"]);
      expect(plan.dispositions).toEqual({ "@beep/changed": "replaced" });
      expect(plan.packages["@beep/dependent"]?.lines).toBe(61);
      expect(coverageBaselineWriteReport(plan, previous)).toContain(
        "[coverage-ratchet] 1 package(s) in this change set were not measured by this scoped run and keep their committed rows: @beep/dependent. The hosted pull-request run still judges them at the base floors; pass --filter=<package> for each one, or run --affected, to re-measure them."
      );
    });

    it("carries nothing on an unscoped write, which prunes unmeasured rows instead", () => {
      const previous = {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/dependent": coveragePackageBaseline("packages/dependent", 61),
      };
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "origin/main merge-base a1b2c3d",
          packageNames: ["@beep/changed"],
          dependentPackageNames: ["@beep/dependent"],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: false })
      );

      expect(plan.carriedUnmeasured).toEqual([]);
      expect(plan.dispositions["@beep/dependent"]).toBe("pruned");
      expect(carriedUnmeasuredNotices(coverageBaselineWriteReport(plan, previous))).toEqual([]);
    });

    it("stays quiet when a scoped write measured every package it adopts", () => {
      const previous = {
        "@beep/changed": coveragePackageBaseline("packages/changed", 50),
        "@beep/dependent": coveragePackageBaseline("packages/dependent", 61),
        "@beep/unrelated": coveragePackageBaseline("packages/unrelated", 70),
      };
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/changed",
            baseline: coveragePackageBaseline("packages/changed", 80),
          }),
          CoverageSnapshotEntry.make({
            packageName: "@beep/dependent",
            baseline: coveragePackageBaseline("packages/dependent", 93),
          }),
        ],
        CoverageBaselineChangeSet.make({
          baseDescription: "origin/main merge-base a1b2c3d",
          packageNames: ["@beep/changed"],
          dependentPackageNames: ["@beep/dependent"],
          fullReasons: [],
        }),
        CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
      );

      // @beep/unrelated is carried too, but it was never in the adoption set, so
      // naming it would drown the packages whose floors this write left behind.
      expect(plan.carriedUnmeasured).toEqual([]);
      expect(plan.packages["@beep/unrelated"]?.lines).toBe(70);
      expect(carriedUnmeasuredNotices(coverageBaselineWriteReport(plan, previous))).toEqual([]);
    });

    it("adopts every measured package when a scoped write passes replace-all", () => {
      const previous = {
        "@beep/held": coveragePackageBaseline("packages/held", 61),
        "@beep/unmeasured": coveragePackageBaseline("packages/unmeasured", 70),
      };
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/held",
            baseline: coveragePackageBaseline("packages/held", 93),
          }),
        ],
        CoverageBaselineChangeSet.make({ baseDescription: "dirty worktree only", packageNames: [], fullReasons: [] }),
        CoverageBaselineWriteOptions.make({ replaceAll: true, carryUnmeasured: true })
      );

      expect(plan.dispositions).toEqual({ "@beep/held": "replaced" });
      expect(plan.packages["@beep/held"]?.lines).toBe(93);
      expect(plan.packages["@beep/unmeasured"]?.lines).toBe(70);
    });

    it("says so loudly when a scoped write held every package it measured", () => {
      const previous = { "@beep/held": coveragePackageBaseline("packages/held", 61) };
      const plan = planCoverageBaselineWrite(
        previous,
        [
          CoverageSnapshotEntry.make({
            packageName: "@beep/held",
            baseline: coveragePackageBaseline("packages/held", 93),
          }),
        ],
        CoverageBaselineChangeSet.make({ baseDescription: "dirty worktree only", packageNames: [], fullReasons: [] }),
        CoverageBaselineWriteOptions.make({ replaceAll: false, carryUnmeasured: true })
      );
      const report = coverageBaselineWriteReport(plan, previous);

      expect(report).toEqual([
        "[coverage-ratchet] @beep/held: held (owns no changed file; pass --replace-all to re-measure it)",
        "[coverage-ratchet] every measured package was held; this run changed no row. Pass --replace-all to re-measure them.",
      ]);
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

    it("requires explicit test SQL URLs over generic application defaults", () => {
      assertSome(
        sqlIntegrationConnectionUriFromEnvForTesting({
          BEEP_TEST_DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
          DATABASE_URL: "postgres://other:secret@127.0.0.1:5432/other",
        }),
        "postgres://test:secret@127.0.0.1:5432/test"
      );

      assertNone(
        sqlIntegrationConnectionUriFromEnvForTesting({
          DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
        })
      );

      assertNone(
        sqlIntegrationConnectionUriFromEnvForTesting({
          BEEP_TEST_DATABASE_URL: "op://beep-dev-secrets/DATABASE_URL",
          DATABASE_URL: "postgres://test:secret@127.0.0.1:5432/test",
          DATABASE_URL_UNPOOLED: "postgres://test:secret@127.0.0.1:5432/test",
        })
      );
    });

    it.effect("forwards shared SQL env vars to the integration child process", () =>
      Effect.andThen(
        temporaryRepository,
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
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("fails nonzero integration children and releases the shared SQL resource", () =>
      Effect.andThen(
        temporaryRepository,
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
          assertTrue(exit._tag === "Failure");
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskFailed);
            if (isQualityTaskFailed(failure)) {
              expect(failure.exitCode).toBe(7);
            }
          }
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("runs grouped quality steps with bounded concurrency and deterministic output", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep("test:slow", "await Bun.sleep(20); console.log('slow')"),
              bunScriptStep("test:fast", "console.log('fast')"),
            ],
            2
          );

          const logLines76 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines76, isString), "\n");
          expect(logText).toContain("[beep-cli] test:group: running 2 step(s) with concurrency 2");
          expect(logText).toContain("[beep-cli] test:slow: bun -e await Bun.sleep(20); console.log('slow')");
          expect(logText).toContain("[beep-cli] test:fast: bun -e console.log('fast')");
          expectSubstringBefore(logText, "[beep-cli] test:slow output:\nslow", "[beep-cli] test:fast output:\nfast");
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("truncates retained grouped quality step output", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          yield* runQualityTaskStepGroupForTesting(
            "test:group",
            [
              bunScriptStep(
                "test:large-output",
                "process.stdout.write('x'.repeat(9 * 1024 * 1024)); console.log('tail-marker')"
              ),
            ],
            1
          );

          const logLines77 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines77, isString), "\n");
          expect(logText).toContain(`[beep-cli] output truncated after ${8 * 1024 * 1024} characters`);
          expect(Str.length(logText)).toBeLessThan(8 * 1024 * 1024 + 8_192);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("aggregates grouped quality step failures in configured step order", () =>
      Effect.andThen(
        temporaryRepository,
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

          assertTrue(exit._tag === "Failure");
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first", "test:second"]);
            }
          }

          const logLines78 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines78, isString), "\n");
          expectSubstringBefore(
            logText,
            "[beep-cli] test:first output:\nfirst failed",
            "[beep-cli] test:second output:\nsecond failed"
          );

          const errorLines79 = yield* TestConsole.errorLines;
          const errorText = A.join(A.filter(errorLines79, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:group: failed 2 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('first failed'); process.exit(7)");
          expect(errorText).toContain("[beep-cli]   test:second: exit 3");
          expect(errorText).toContain("[beep-cli]     command: bun -e console.log('second failed'); process.exit(3)");
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("buffers a step's output and replays it whole after the step ends", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const exit = yield* Effect.exit(
            runQualityTaskBufferedStepGroup("test:buffered", [
              bunScriptStep("test:quiet", "process.exit(0)"),
              bunScriptStep("test:loud", "console.log('buffered line one'); console.error('buffered line two')"),
              bunScriptStep("test:broken", "console.log('buffered failure'); process.exit(5)"),
            ])
          );

          const logLines80 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines80, isString), "\n");
          // Captured stdout and stderr are replayed together, after the command line and before the outcome line.
          const commandAt = O.getOrThrow(Str.indexOf("[beep-cli] test:loud: bun -e")(logText));
          const outputAt = O.getOrThrow(Str.indexOf("buffered line one")(logText));
          const outcomeAt = O.getOrThrow(Str.indexOf("[beep-cli] test:loud: ok in")(logText));
          expect(outputAt).toBeGreaterThan(commandAt);
          expect(outcomeAt).toBeGreaterThan(outputAt);
          expect(logText).toContain("buffered line two");
          // A step with no output replays nothing but still reports its outcome.
          expect(logText).toContain("[beep-cli] test:quiet: ok in");
          expect(logText).toContain("buffered failure");
          expect(logText).toContain("[beep-cli] test:broken: failed in");

          assertTrue(exit._tag === "Failure");
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(5);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:broken"]);
            }
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("streams grouped quality step failures and keeps running sibling steps", () =>
      Effect.andThen(
        temporaryRepository,
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

          const exists81 = yield* fs.exists(markerPath);
          expect(exists81).toBe(true);
          assertTrue(exit._tag === "Failure");
          if (Exit.isFailure(exit)) {
            const failure = Cause.squash(exit.cause);
            expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
            if (isQualityTaskGroupFailed(failure)) {
              expect(failure.exitCode).toBe(7);
              expect(A.map(failure.failures, (step) => step.label)).toEqual(["test:first"]);
            }
          }

          const logLines82 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines82, isString), "\n");
          expect(logText).toContain("[beep-cli] test:stream: running 2 streaming step(s)");
          expectSubstringBefore(logText, "[beep-cli] test:first:", "[beep-cli] test:second:");

          const errorLines83 = yield* TestConsole.errorLines;
          const errorText = A.join(A.filter(errorLines83, isString), "\n");
          expect(errorText).toContain("[beep-cli] test:stream: failed 1 step(s)");
          expect(errorText).toContain("[beep-cli]   test:first: exit 7");
          expect(errorText).toContain("[beep-cli]     command: bun -e process.exit(7)");
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("quarantines distinct TS2589 tasks exposed by resumed lane runs", () =>
      Effect.andThen(
        temporaryRepository,
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
              'if (invocation === 0 && filter === undefined) failTs2589("@beep/quarantine-fixture");',
              'if (invocation === 1 && filter === "--filter=@beep/quarantine-fixture") process.exit(0);',
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

          yield* withoutCiEffect(runQualityTaskStreamingStepGroupForTesting("test:stream", [step]));

          const artifactText = yield* fs.readFileString(
            path.join(process.cwd(), FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH)
          );
          const artifact = yield* FlakeQuarantineArtifactJson.decode(artifactText);
          expect(A.map(artifact.incidents, (incident) => incident.taskId)).toEqual([
            "@beep/quarantine-fixture#build",
            "@beep/ui#build",
          ]);
          const readFileString84 = yield* fs.readFileString(statePath);
          expect(readFileString84).toBe("5");

          const logLines85 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines85, isString), "\n");
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-waves: lane rerun failed with exit 2; checking for another quarantinable task"
          );
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-waves: quarantined 2 environment-only TS2589 flake incident(s); lane rerun green"
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("keeps a repeated TS2589 task hard after standalone recovery", () =>
      Effect.andThen(
        temporaryRepository,
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
              '  console.error("@beep/quarantine-fixture:build: error TS2589: Type instantiation is excessively deep and possibly infinite.");',
              '  console.error("Failed:    @beep/quarantine-fixture#build");',
              "  process.exit(2);",
              "};",
              "if (invocation === 0 && filter === undefined) failTs2589();",
              'if (invocation === 1 && filter === "--filter=@beep/quarantine-fixture") process.exit(0);',
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

          const exit = yield* runQualityTaskStreamingStepGroupForTesting("test:stream", [step]).pipe(
            Effect.exit,
            withoutCiEffect
          );

          assertTrue(exit._tag === "Failure");
          const readFileString86 = yield* fs.readFileString(statePath);
          expect(readFileString86).toBe("3");
          const exists87 = yield* fs.exists(path.join(process.cwd(), FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH));
          expect(exists87).toBe(false);

          const logLines88 = yield* TestConsole.logLines;
          const logText = A.join(A.filter(logLines88, isString), "\n");
          expect(logText).toContain(
            "[flake-quarantine] test:quarantine-repeat: lane rerun repeated the flake for @beep/quarantine-fixture#build; keeping failure hard"
          );
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    // The aggregate lint lane opens a remote-cache secret session whenever the
    // Turbo credentials are 1Password references, and the session verdict comes
    // from spawning `op run -- true`. Each case pins the reference-backed
    // posture, clears the cached verdicts and puts its own `op` first on PATH,
    // so neither the host `op` nor the host's TURBO_* values decide the label.
    const aggregateLintFailureWithOp = Effect.fnUntraced(function* (opScript: ReadonlyArray<string>) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = process.cwd();
      const binDir = path.join(tmpDir, "bin");
      const commandLogPath = path.join(tmpDir, "quality-commands.log");
      const fakeBunxPath = path.join(binDir, "bunx");
      const fakeBunPath = path.join(binDir, "bun");
      const fakeOpPath = path.join(binDir, "op");

      yield* fs.makeDirectory(binDir, { recursive: true });
      yield* fs.writeFileString(
        fakeBunxPath,
        A.join(
          [
            "#!/usr/bin/env sh",
            "printf 'bunx %s\\n' \"$*\" >> quality-commands.log",
            'if [ "$1" = "turbo" ] && [ "$2" = "run" ] && [ "$3" = "lint" ]; then',
            "  exit 7",
            "fi",
            "exit 0",
            "",
          ],
          "\n"
        )
      );
      yield* fs.writeFileString(
        fakeBunPath,
        A.join(
          [
            "#!/usr/bin/env sh",
            "printf 'bun %s\\n' \"$*\" >> quality-commands.log",
            'case " $* " in *" cache execute -- run lint "*) exit 7 ;; esac',
            "exit 0",
            "",
          ],
          "\n"
        )
      );
      yield* fs.writeFileString(fakeOpPath, A.join(opScript, "\n"));
      yield* fs.chmod(fakeBunxPath, 0o755);
      yield* fs.chmod(fakeBunPath, 0o755);
      yield* fs.chmod(fakeOpPath, 0o755);
      yield* Effect.sync(clearTurboCacheSecretSessionVerdictsForTesting);

      const [exit, lintStepCount] = yield* withEnvVarsEffect(
        {
          PATH: `${binDir}:${Bun.env.PATH ?? ""}`,
          TURBO_API: "http://127.0.0.1:9427",
          TURBO_TOKEN: "op://fixture-vault/turbo/token",
          TURBO_TEAM: "fixture-team",
          TURBO_CACHE: "local:rw,remote:r",
          BEEP_TURBO_TRUSTED_WRITER: undefined,
        },
        // The default ConfigProvider snapshots the environment on first use, so a
        // worker started under CI=true would keep `isCi` true and skip the probe;
        // a provider built inside the pinned scope reads the cleared CI signals.
        // The step count is derived inside the same scope from the plan the
        // runtime executes (aggregate lane plus every policy step), so a lint
        // step added on another branch, or a CI-only step, never skews it.
        withoutCiEffect(
          runQualityTask(getInvocation(["lint"])).pipe(
            Effect.exit,
            Effect.zip(Effect.sync(() => A.length(rootQualityStepsForTesting(process.cwd(), getInvocation(["lint"]))))),
            Effect.provideServiceEffect(
              ConfigProvider.ConfigProvider,
              Effect.sync(() => ConfigProvider.fromEnv())
            )
          )
        )
      );

      assertTrue(exit._tag === "Failure");
      const failure = Cause.squash(exit.cause);
      expect(failure).toBeInstanceOf(QualityTaskGroupFailed);
      assertTrue(isQualityTaskGroupFailed(failure));
      expect(failure.exitCode).toBe(7);

      const commandLog = yield* fs.readFileString(commandLogPath);
      // The session probe reached the fixture `op`, never the host binary.
      expect(commandLog).toContain("op run -- true");
      // The aggregate fails first; ordered policy diagnostics still execute.
      expect(commandLog).toContain("cache execute -- run lint");
      expect(commandLog).toContain("lint:effect-imports");
      expect(commandLog).toContain("lint:roadmap-refs");
      expect(commandLog).toContain("lint:typos");

      const logLines89 = yield* TestConsole.logLines;
      const logText = A.join(A.filter(logLines89, isString), "\n");
      expect(logText).toContain(`[beep-cli] lint:policy: running ${lintStepCount} ordered step(s)`);

      return {
        failedLabels: A.map(failure.failures, (step) => step.label),
        wrappedAggregate: pipe(commandLog, Str.includes("op run -- bun ")),
      };
    });

    it.effect("keeps running repo-wide root lint policy checks after aggregate lint fails", () =>
      Effect.andThen(
        temporaryRepository,
        // A missing, expired or denied 1Password session degrades the aggregate
        // to an unwrapped local-only run, so its label carries no session suffix.
        aggregateLintFailureWithOp([
          "#!/usr/bin/env sh",
          "printf 'op %s\\n' \"$*\" >> quality-commands.log",
          "exit 78",
          "",
        ]).pipe(
          Effect.map(({ failedLabels, wrappedAggregate }) => {
            expect(failedLabels).toEqual(["lint"]);
            expect(wrappedAggregate).toBe(false);
          })
        )
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("labels the failed aggregate lint with its op run session when 1Password is usable", () =>
      Effect.andThen(
        temporaryRepository,
        // A usable session wraps the aggregate in `op run --` and, by design
        // (`turboSecretSessionStep`), suffixes its label with " (op run)".
        aggregateLintFailureWithOp([
          "#!/usr/bin/env sh",
          "printf 'op %s\\n' \"$*\" >> quality-commands.log",
          '[ "$1" = "run" ] || exit 0',
          "shift",
          'while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do shift; done',
          '[ "$#" -gt 0 ] && shift',
          'exec "$@"',
          "",
        ]).pipe(
          Effect.map(({ failedLabels, wrappedAggregate }) => {
            expect(failedLabels).toEqual(["lint (op run)"]);
            expect(wrappedAggregate).toBe(true);
          })
        )
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it("leaves lint policy subcommands on the existing command tree", () => {
      parseQualityTaskInvocation(["lint", "circular"]).pipe(assertNone);
      parseQualityTaskInvocation(["lint", "deprecated-apis"]).pipe(assertNone);
      assertNone(parseQualityTaskInvocation(["lint", "effect-vitest"]));
      parseQualityTaskInvocation(["lint", "package-test-imports"]).pipe(assertNone);
      parseQualityTaskInvocation(["lint", "policy"]).pipe(assertNone);
      parseQualityTaskInvocation(["lint", "schema-first"]).pipe(assertNone);
    });

    it("leaves root CLI help and metadata flags on the existing command tree", () => {
      parseQualityTaskInvocation(["lint", "--help"]).pipe(assertNone);
      parseQualityTaskInvocation(["check", "-h"]).pipe(assertNone);
      parseQualityTaskInvocation(["build", "--version"]).pipe(assertNone);
      parseQualityTaskInvocation(["test", "--log-level=debug"]).pipe(assertNone);
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

    it.effect("limits root integration test filters to script-owning workspaces", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const plainPackageDir = path.join(tmpDir, "packages", "plain");
          const integrationPackageDir = path.join(tmpDir, "apps", "integration");

          const argument23 = path.join(tmpDir, "package.json");
          const encodedJson23 = yield* encodeJson({
            name: "@beep/test-root",
            private: true,
            workspaces: {
              packages: ["packages/*", "apps/*"],
            },
          });
          yield* fs.writeFileString(argument23, encodedJson23);
          yield* fs.makeDirectory(plainPackageDir, { recursive: true });
          const argument24 = path.join(plainPackageDir, "package.json");
          const encodedJson24 = yield* encodeJson({
            name: "@beep/plain",
            private: true,
            scripts: {
              test: "vitest",
            },
          });
          yield* fs.writeFileString(argument24, encodedJson24);
          yield* fs.makeDirectory(integrationPackageDir, { recursive: true });
          const argument25 = path.join(integrationPackageDir, "package.json");
          const encodedJson25 = yield* encodeJson({
            name: "@beep/integration",
            private: true,
            scripts: {
              "test:integration": "vitest run test/integration",
            },
          });
          yield* fs.writeFileString(argument25, encodedJson25);

          const integrationFilters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          expect(integrationFilters).toEqual(["--filter=@beep/integration"]);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );

    it.effect("reads an object-form workspaces declaration without packages as no workspaces", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();

          // The object form's `packages` is optional (a Bun root may carry only
          // `catalog`); the retired projection required it and failed the read.
          const argument26 = path.join(tmpDir, "package.json");
          const encodedJson26 = yield* encodeJson({
            name: "@beep/test-root",
            private: true,
            workspaces: { catalog: { effect: "4.0.0" } },
          });
          yield* fs.writeFileString(argument26, encodedJson26);

          const filters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          deepStrictEqual(filters, []);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    // pnpm `packages:` lists reach the owner scan through `WorkspacePatterns`, so
    // a pattern other than a trailing `/*` must expand as a glob, not a literal.
    it.effect("expands a recursive workspace pattern below its base", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const tmpDir = process.cwd();
          yield* writeIntegrationWorkspace(tmpDir, ["packages/**"], ["packages/top", "packages/group/nested"]);

          const filters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          deepStrictEqual(filters, ["--filter=@beep/packages-group-nested", "--filter=@beep/packages-top"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("expands a mid-path workspace wildcard to the matching directories only", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const tmpDir = process.cwd();
          yield* writeIntegrationWorkspace(tmpDir, ["apps/*/web"], ["apps/one/web", "apps/two/web", "apps/two/api"]);

          const filters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          deepStrictEqual(filters, ["--filter=@beep/apps-one-web", "--filter=@beep/apps-two-web"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    // A brace list without wildcards has no glob magic yet names several paths,
    // so it walks through the enumerator rather than a literal `{api,web}` join.
    it.effect("expands a brace workspace pattern without wildcards to each alternative", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const tmpDir = process.cwd();
          yield* writeIntegrationWorkspace(
            tmpDir,
            ["packages/{api,web}"],
            ["packages/api", "packages/web", "packages/other"]
          );

          const filters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          deepStrictEqual(filters, ["--filter=@beep/packages-api", "--filter=@beep/packages-web"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("drops workspace candidates a negated pattern excludes", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const tmpDir = process.cwd();
          yield* writeIntegrationWorkspace(
            tmpDir,
            ["packages/*", "libs/**", "!packages/private-*", "!libs/**/internal"],
            ["packages/public", "packages/private-a", "libs/core", "libs/core/internal"]
          );

          const filters = yield* workspaceTaskFiltersForTesting(tmpDir, "test:integration");

          deepStrictEqual(filters, ["--filter=@beep/libs-core", "--filter=@beep/packages-public"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("treats unsupported package tasks as explicit no-ops", () =>
      Effect.andThen(
        temporaryRepository,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = process.cwd();
          const packageDir = path.join(tmpDir, "packages", "empty");

          const argument27 = path.join(tmpDir, "package.json");
          const encodedJson27 = yield* encodeJson({
            name: "@beep/test-root",
            private: true,
            workspaces: ["packages/*"],
          });
          yield* fs.writeFileString(argument27, encodedJson27);
          yield* fs.makeDirectory(packageDir, { recursive: true });
          const argument28 = path.join(packageDir, "package.json");
          const encodedJson28 = yield* encodeJson({
            name: "@beep/empty",
            private: true,
            scripts: {
              lint: "beep-cli lint",
            },
          });
          yield* fs.writeFileString(argument28, encodedJson28);

          process.cwd = () => packageDir;
          yield* runQualityTask(getInvocation(["lint"]));

          const lines = yield* TestConsole.logLines;
          expect(lines).toEqual(["[beep-cli] @beep/empty lint: no-op"]);
          expect(process.exitCode ?? 0).toBe(0);
        })
      ).pipe(
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        Effect.provideServiceEffect(Console.Console, TestConsole.make),
        TestClock.withLive
      )
    );
  });

  describe("labs in root quality tasks", () => {
    const argsOf = (step: QualityTaskStep | undefined): ReadonlyArray<string> => [...(step?.args ?? [])];

    const argIndexOf = (args: ReadonlyArray<string>, target: string): number =>
      pipe(
        A.findFirstIndex(args, (arg) => arg === target),
        O.getOrElse(() => -1)
      );

    it("includes labs in check while the repo-wide smoke canary survives", () => {
      // `quality:test-tsgo` has one owner (the lint-policy plan); check keeps only the canary.
      for (const argv of [["check", "--affected", "--summarize"], ["check"]]) {
        const steps = rootQualityStepsForTesting("/repo", getInvocation(argv));
        expect(A.map(steps, (step) => step.label)).toEqual(["check", "quality:tsgo-smoke"]);
        expect(argsOf(steps[0])).not.toContain(LABS_EXCLUDE_FILTER);
      }
    });

    it("includes labs in check, lint and lint:fix, including explicit labs selections", () => {
      for (const argv of [["check"], ["lint"], ["lint", "--fix"]]) {
        for (const options of [[], ["--affected", "--summarize"], ["--filter=./apps/labs/**"]]) {
          const steps = rootQualityStepsForTesting("/repo", getInvocation([...argv, ...options]));
          const args = argsOf(steps[0]);
          expect(args).not.toContain(LABS_EXCLUDE_FILTER);
          for (const option of options) {
            expect(args).toContain(option);
          }
        }
      }
    });

    it("includes labs in scoped coverage argvs", () => {
      const coverage = withEnvVar("BEEP_FC_SEED", undefined, () =>
        withEnvVar("NODE_OPTIONS", undefined, () => [coverageStepOf([])])
      );
      const coverageArgs = argsOf(coverage[0]);
      expect(coverageArgs).not.toContain(LABS_EXCLUDE_FILTER);
      expect(argIndexOf(coverageArgs, "--")).toBeGreaterThan(-1);
    });

    it("preserves an explicit check filter while still dropping repo-wide steps", () => {
      const steps = rootQualityStepsForTesting("/repo", getInvocation(["check", "--filter=@beep/schema"]));
      expect(steps).toHaveLength(1);
      expect(argsOf(steps[0])).toContain("--filter=@beep/schema");
      expect(argsOf(steps[0])).not.toContain(LABS_EXCLUDE_FILTER);
    });

    it("includes labs in coverage prebuilds and every shard", () => {
      const baseline = withEnvVar("BEEP_FC_SEED", undefined, () =>
        withEnvVar("NODE_OPTIONS", undefined, () => [coverageStepOf(["--", "--write-baseline", "--concurrency=1"])])
      );
      const baselineArgs = argsOf(baseline[0]);
      const delimiterIndex = argIndexOf(baselineArgs, "--");
      expect(baselineArgs).not.toContain(LABS_EXCLUDE_FILTER);
      expect(delimiterIndex).toBeGreaterThan(-1);

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
      expect(argsOf(fullSteps[0])).not.toContain(LABS_EXCLUDE_FILTER);
      for (const step of A.drop(fullSteps, 1)) {
        const shardArgs = argsOf(step);
        const shardDelimiterIndex = argIndexOf(shardArgs, "--");
        expect(shardArgs).not.toContain(LABS_EXCLUDE_FILTER);
        expect(shardDelimiterIndex).toBeGreaterThan(-1);
        expect(A.some(shardArgs, Str.startsWith("--filter=@beep/"))).toBe(true);
      }
    });

    it("keeps golden regeneration fresh in isolated native command plans", () => {
      // ConfigProvider's default environment trie is process-scoped. Exercise
      // both modes in fresh runtimes, as separate CLI invocations actually run.
      for (const mode of ["0", "1"]) {
        const script = `
        import { rootQualityStepsForTesting } from "@beep/repo-cli/test/Quality";
        const invocation = {
          task: "check",
          args: ["--filter=@beep/schema", "--cache=local:r", "--force=false", "--", "--force=false"]
        };
        for (let attempt = 0; attempt < 2; attempt++) {
          const [step] = rootQualityStepsForTesting("/repo", invocation);
          console.log(step.args.join("\\n"));
        }
      `;
        const child = Bun.spawnSync(["bun", "--eval", script], {
          env: {
            ...Bun.env,
            CI: "false",
            GITHUB_ACTIONS: "false",
            CONTINUOUS_INTEGRATION: "false",
            REGEN_GOLDENS: mode,
          },
          stdout: "pipe",
          stderr: "pipe",
        });
        expect(child.exitCode, child.stderr.toString()).toBe(0);
        const lines = Str.split(child.stdout.toString(), "\n");
        expect(A.filter(lines, (line) => line === "--force")).toHaveLength(mode === "1" ? 2 : 0);
        expect(A.filter(lines, (line) => line === "--force=false")).toHaveLength(mode === "1" ? 2 : 4);
        expect(child.stdout.toString()).toContain("--\n--force=false");
      }
    });

    it("keeps build and audit turbo graphs unfiltered (excluded-task boundary)", () => {
      const build = rootQualityStepsForTesting("/repo", getInvocation(["build"]));
      expect(argsOf(build[0])).not.toContain(LABS_EXCLUDE_FILTER);

      const audit = withoutCi(() =>
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
      assertSome(turboStepLocalEnvForTesting(undefined, true), true);
      assertNone(turboStepLocalEnvForTesting(undefined, false));
      assertNone(turboStepLocalEnvForTesting({ CI: "true" }, true));
    });

    it("wraps a Turbo step without loading the project env file or carrying unrelated references", () => {
      const wrapped = turboSecretSessionStepForTesting(QualityTaskStep.make({ ...remoteStep({}), useLocalEnv: true }), {
        PATH: "/fixture/bin",
        TURBO_API: "op://fixture-vault/turbo/api",
        TURBO_TOKEN: "op://fixture-vault/turbo/token",
        TURBO_TEAM: "fixture-team",
        TURBO_CACHE: "local:rw,remote:r",
        UNRELATED_SECRET: "op://fixture-vault/unrelated/secret",
      });

      expect(wrapped.command).toBe("op");
      expect(wrapped).not.toHaveProperty("useLocalEnv");
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

  describe("parseTestLaneSelection", () => {
    it("selects the flagged lanes and keeps the remaining arguments in order", () => {
      const both = parseTestLaneSelectionForTesting([
        "--",
        "--unit",
        "--concurrency=2",
        "--integration",
        "--summarize",
      ]);
      expect(both).toStrictEqual({ unit: true, integration: true, args: ["--concurrency=2", "--summarize"] });
      const unitOnly = parseTestLaneSelectionForTesting(["--unit"]);
      expect(unitOnly).toStrictEqual({ unit: true, integration: false, args: [] });
      const integrationOnly = parseTestLaneSelectionForTesting(["--integration", "--affected"]);
      expect(integrationOnly).toStrictEqual({ unit: false, integration: true, args: ["--affected"] });
    });

    it("runs both lanes when no lane flag is present", () => {
      expect(parseTestLaneSelectionForTesting([])).toStrictEqual({ unit: true, integration: true, args: [] });
      expect(parseTestLaneSelectionForTesting(["--concurrency=2"])).toStrictEqual({
        unit: true,
        integration: true,
        args: ["--concurrency=2"],
      });
    });
  });
});

describe("documentation input digest", () => {
  it.layer(FileSystemLayer, { timeout: "30 seconds" })((it) => {
    it.effect("invalidates config, plugin source and dependency changes while keeping unrelated edits stable", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const source = "packages/tooling/policy-pack/lint-rules";
        yield* fs.makeDirectory(`${root}/${source}/src/rules`, { recursive: true });
        const fixtures: ReadonlyArray<readonly [string, string]> = [
          [".oxlintrc.docs.json", "{}"],
          ["tsdoc.json", "{}"],
          ["bun.lock", "lock"],
          [`${source}/package.json`, "{}"],
          [`${source}/src/rules/docs.ts`, "export {}"],
        ];
        for (const [file, content] of fixtures) {
          yield* fs.writeFileString(`${root}/${file}`, content);
        }
        const initial = yield* rootDocsCacheKey(root);
        expect(initial).toMatch(/^[0-9a-f]{16}$/);
        const rootDocsCacheKey90 = yield* rootDocsCacheKey(root);
        expect(rootDocsCacheKey90).toBe(initial);
        yield* fs.writeFileString(`${root}/unrelated.ts`, "export {}");
        const rootDocsCacheKey91 = yield* rootDocsCacheKey(root);
        expect(rootDocsCacheKey91).toBe(initial);
        for (const file of [".oxlintrc.docs.json", "tsdoc.json", "bun.lock", `${source}/src/rules/docs.ts`]) {
          const before = yield* rootDocsCacheKey(root);
          yield* fs.writeFileString(`${root}/${file}`, "changed");
          const rootDocsCacheKey92 = yield* rootDocsCacheKey(root);
          expect(rootDocsCacheKey92).not.toBe(before);
        }
        const madeTempDirectoryScoped109 = yield* fs.makeTempDirectoryScoped();
        const rootDocsCacheKey93 = yield* rootDocsCacheKey(madeTempDirectoryScoped109);
        expect(rootDocsCacheKey93).toBe("unkeyed");
      })
    );
  });
});

it.layer(PlatformLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("quality concurrency plan service", () => {
    const fixedPlan = QualityConcurrencyPlan.make({
      profile: "current",
      rootTurbo: 2,
      policyLint: 2,
      cheapGates: 2,
      prePushLanes: 1,
      oxlintThreads: 2,
      notes: [],
    });
    const idleStats = MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) });

    it("folds an admission snapshot into the tokens other runs hold", () => {
      const snapshot = {
        capacityTokens: 8,
        leases: [
          { pid: 10, weightTokens: 3 },
          { pid: 20, weightTokens: 3 },
          { pid: 30, weightTokens: 2 },
        ],
      };
      const load = qualityAdmissionLoadOf(snapshot, HashSet.make(10));
      expect(load.activeTokens).toBe(5);
      expect(load.capacityTokens).toBe(8);
      expect(qualityAdmissionLoadOf(HashSet.empty<number>())(snapshot).activeTokens).toBe(8);
    });

    it.effect("reads the provided plan, else resolves the unscaled local plan", () =>
      Effect.gen(function* () {
        const provided = yield* qualityConcurrencyPlan.pipe(
          Effect.provideServiceEffect(QualityConcurrency, QualityConcurrency.make(fixedPlan))
        );
        expect(provided.rootTurbo).toBe(2);
        const local = yield* withoutCiEffect(qualityConcurrencyPlan);
        expect(local.rootTurbo).toBe(withoutCi(localQualityConcurrencyPlan).rootTurbo);
        const live = yield* qualityConcurrencyPlan.pipe(provideQualityConcurrency, withoutCiEffect);
        expect(live.rootTurbo).toBe(local.rootTurbo);
      })
    );

    it.effect("keeps the hosted plan unscaled and skips admission under CI", () =>
      Effect.gen(function* () {
        const plan = yield* withEnvVarEffect(
          "CI",
          "true",
          resolveLiveQualityConcurrencyPlan().pipe(Effect.provideService(MemoryStats, idleStats))
        );
        expect(plan.profile).toBe("ci");
        expect(plan.rootTurbo).toBe(4);
        assertNone(plan.admission);
      })
    );

    it.effect("scales by the live admission snapshot when MemoryStats is provided", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "quality-plan-admission-" });
        const root = path.join(madeTempDirectoryScoped, "runtime");
        const plan = yield* withoutCiEffect(
          resolveLiveQualityConcurrencyPlan().pipe(
            Effect.provideService(MemoryStats, idleStats),
            provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root }))
          )
        );
        const load = O.getOrThrow(plan.admission);
        expect(load.activeTokens).toBe(0);
        expect(load.capacityTokens).toBe(8);
        expect(plan.rootTurbo).toBe(withoutCi(localQualityConcurrencyPlan).rootTurbo);
      })
    );

    it.effect("falls back to the unscaled plan when the admission snapshot cannot be read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const madeTempDirectoryScoped94 = yield* fs.makeTempDirectoryScoped({ prefix: "quality-plan-blocked-" });
        const blocker = path.join(madeTempDirectoryScoped94, "runtime");
        yield* fs.writeFileString(blocker, "not a directory");
        const plan = yield* withoutCiEffect(
          resolveLiveQualityConcurrencyPlan().pipe(
            Effect.provideService(MemoryStats, idleStats),
            provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: blocker }))
          )
        );
        assertNone(plan.admission);
        expect(plan.rootTurbo).toBe(withoutCi(localQualityConcurrencyPlan).rootTurbo);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});

// Perf audit M11: the cheap-gates and pre-push tiers of one Yeet run share the
// lane-proof store. Their batteries differ only in Yeet's per-step bookkeeping
// env and, when another checkout fetches, in where `origin/main` points.
it.layer(PlatformLayer, { timeout: "60 seconds" })("lane-proof reuse across Yeet tiers", (it) => {
  const gitOutput = (repoRoot: string, args: ReadonlyArray<string>) =>
    runCapturedStreams({ command: "git", args, cwd: repoRoot, stdin: "ignore" }).pipe(
      Effect.map((result) => Str.trim(result.stdout))
    );
  const tierWaves = (repoRoot: string) => [
    GithubCheckLaneWaveSpec.make({
      wave: "preflight",
      lanes: [
        laneProofTestLane(
          repoRoot,
          "fallow:health",
          "preflight",
          "mkdir -p .beep && echo run >> .beep/health-runs.txt"
        ),
      ],
    }),
  ];
  const runTier = (repoRoot: string, tier: string, base: string) =>
    withEnvVarEffect(
      "BEEP_YEET_PROOF_BASE",
      base,
      withEnvVarEffect(
        "BEEP_YEET_INNER_LANE_PARENT_ID",
        `full:${tier}`,
        collectGithubCheckLaneWavesForTesting(tier, tierWaves(repoRoot), "fail-fast", "active")
      )
    ).pipe(Effect.map(({ report }) => A.map(report.lanes, (lane) => lane.status)));
  // A sibling of the base commit with the same tree: `origin/main` moves, HEAD does not.
  const moveOriginMain = Effect.fnUntraced(function* (repoRoot: string, base: string) {
    const tree = yield* gitOutput(repoRoot, ["rev-parse", "HEAD^{tree}"]);
    const moved = yield* gitOutput(repoRoot, [
      "-c",
      "user.email=lane-proof@example.test",
      "-c",
      "user.name=Lane Proof Test",
      "commit-tree",
      tree,
      "-p",
      base,
      "-m",
      "moved base",
    ]);
    yield* runGit(repoRoot, ["update-ref", "refs/remotes/origin/main", moved]);
    return moved;
  });
  const fixture = Effect.fnUntraced(function* (prefix: string) {
    const fs = yield* FileSystem.FileSystem;
    const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix });
    yield* initializeLaneProofRepository(repoRoot);
    return { repoRoot, base: yield* gitOutput(repoRoot, ["rev-parse", "HEAD"]) };
  });
  const logged = Effect.map(TestConsole.logLines, (lines) => A.join(A.filter(lines, Str.isString), "\n"));

  it.effect("reads only a full SHA as a pinned base", () =>
    Effect.gen(function* () {
      const withEnvVarEffect95 = yield* withEnvVarEffect(
        "BEEP_YEET_PROOF_BASE",
        Str.repeat(40)("a"),
        Effect.sync(pinnedLaneProofBaseSha)
      );
      assertSome(withEnvVarEffect95, Str.repeat(40)("a"));
      const withEnvVarEffect96 = yield* withEnvVarEffect(
        "BEEP_YEET_PROOF_BASE",
        "origin/main",
        Effect.sync(pinnedLaneProofBaseSha)
      );
      assertNone(withEnvVarEffect96);
    })
  );

  it.effect("reuses the cheap-gates proof in the pre-push tier despite the per-tier parent id", () =>
    Effect.gen(function* () {
      const { repoRoot, base } = yield* fixture("lane-proof-cross-tier-");
      const resultTier = yield* runTier(repoRoot, "cheap-gates", base);
      expect(resultTier).toEqual(["passed"]);
      const resultTier97 = yield* runTier(repoRoot, "pre-push", base);
      expect(resultTier97).toEqual(["reused"]);
      const logged98 = yield* logged;
      expect(logged98).toContain("[lane-proof] reusing exact lane proof: fallow:health");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("refuses, and says why, when the environment changed", () =>
    Effect.gen(function* () {
      const { repoRoot, base } = yield* fixture("lane-proof-env-changed-");
      const run = (marker: string) =>
        withEnvVarEffect("LANE_PROOF_TEST_MARKER", marker, runTier(repoRoot, "pre-push", base));
      const result99 = yield* run("one");
      expect(result99).toEqual(["passed"]);
      const result100 = yield* run("two");
      expect(result100).toEqual(["passed"]);
      const logged101 = yield* logged;
      expect(logged101).toContain("[lane-proof] not reusing fallow:health: environment changed");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("refuses a proof recorded against another pinned base", () =>
    Effect.gen(function* () {
      const { repoRoot, base } = yield* fixture("lane-proof-base-moved-");
      const resultTier102 = yield* runTier(repoRoot, "cheap-gates", base);
      expect(resultTier102).toEqual(["passed"]);
      const moved = yield* moveOriginMain(repoRoot, base);
      const resultTier103 = yield* runTier(repoRoot, "pre-push", moved);
      expect(resultTier103).toEqual(["passed"]);
      const logged104 = yield* logged;
      expect(logged104).toContain(
        `[lane-proof] not reusing fallow:health: base moved (${Str.takeLeft(base, 12)} -> ${Str.takeLeft(moved, 12)})`
      );
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("disables reuse when origin/main moved off the run's pinned base", () =>
    Effect.gen(function* () {
      const { repoRoot, base } = yield* fixture("lane-proof-pin-moved-");
      const moved = yield* moveOriginMain(repoRoot, base);
      const resultTier105 = yield* runTier(repoRoot, "pre-push", base);
      expect(resultTier105).toEqual(["passed"]);
      const logged106 = yield* logged;
      expect(logged106).toContain(
        `[lane-proof] reuse disabled: origin/main moved from the run's pinned base ${Str.takeLeft(base, 12)} to ${Str.takeLeft(moved, 12)}`
      );
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("skips the origin/main refetch while the parent run's pin still matches", () =>
    Effect.gen(function* () {
      // The fixture has no `origin` remote, so a fetch would fail.
      const { repoRoot, base } = yield* fixture("lane-proof-pinned-fetch-");
      yield* withEnvVarEffect("BEEP_YEET_PROOF_BASE", base, ensureOriginMainForTesting(repoRoot));
      const logged107 = yield* logged;
      expect(logged107).toContain(`[github-checks] origin/main pinned at ${Str.takeLeft(base, 12)}`);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("refetches when the pin no longer matches origin/main", () =>
    Effect.gen(function* () {
      const { repoRoot } = yield* fixture("lane-proof-stale-pin-");
      const failure = yield* withEnvVarEffect(
        "BEEP_YEET_PROOF_BASE",
        Str.repeat(40)("0"),
        ensureOriginMainForTesting(repoRoot)
      ).pipe(Effect.flip);
      expect(failure.message).not.toBe("");
      const logged108 = yield* logged;
      expect(logged108).toContain("not the parent run's pinned base 000000000000; refreshing");
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});
