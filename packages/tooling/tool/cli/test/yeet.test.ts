import { createHash } from "node:crypto";
import {
  FallowReportFinding,
  FallowReportOk,
  FallowReportPayload,
  FindingAttributionSummary,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
} from "@beep/repo-cli/test/Quality";
import {
  acquireJournalFileLock,
  appendEncodedAttemptJournalEvent,
  processStartIdentityForPid,
  provideRuntimeRootForTesting,
  RuntimeRootChoice,
  reconcileAttemptJournal,
  reconcileAttemptJournalsForCheckout,
  releaseJournalFileLock,
} from "@beep/repo-cli/test/RepoRun";
import {
  acquireFullProofFallbackLockOrObserveAtPath,
  acquireFullProofFallbackLockOrObserveAtPathForTesting,
  acquireLegacyFullProofLockForTesting,
  acquireLegacyFullProofLockOrObserveAtPathForTesting,
  appendYeetAttemptJournalEvent,
  assessBaseFreshnessForTesting,
  attemptEnvProfileForTesting,
  attemptJournalPath,
  attemptStageForTesting,
  BuildYeetVerdictInput,
  buildQualityIssueIndex,
  buildYeetRunPlanForTesting,
  buildYeetVerdictForTesting,
  closeoutGateStatesForTesting,
  closeoutWritePlanForTesting,
  collectDiffFingerprintForTesting,
  collectPublishIntent,
  commandTextForStep,
  decodeTurboPlanTasksFromQueryJsonForTesting,
  decodeYeetAttemptJournalEvent,
  defaultYeetRunOptions,
  emptyTurboPlanSnapshot,
  executeStepWithArtifacts,
  FallowFeedbackAllowedRoot,
  findOpenPullRequest,
  GhActor,
  GhRestIssueComment,
  GhRestReviewComment,
  GreptileSummary,
  gitPathListFromNulOutputForTesting,
  greptileIssueLimitExceededForTesting,
  greptileRetriggerCommentForTesting,
  inferGreptileIssueCountForTesting,
  isYeetMonitorCommentAfter,
  jsonObjectTextFromMixedOutputForTesting,
  knownSubLaneRemediationFromOutput,
  latestGreptileSummaryForTesting,
  loadVerifiedStateForTesting,
  normalizeYeetMonitorIssueCommentForTesting,
  normalizeYeetMonitorReviewCommentForTesting,
  overlappingBasePathsForTesting,
  PrCloseoutOptions,
  PrCloseoutReport,
  partiallyStagedPathsForTesting,
  prePushLocalShasFromStdinForTesting,
  prePushShaMismatchesForTesting,
  proofCoordinatorLockPath,
  proofLockDispositionForTesting,
  proofLockPathForContext,
  publishPathsOutsideIntentForTesting,
  publishRestagePathsForTesting,
  publishUpstreamMismatchWarningForTesting,
  QualityIssueIndex,
  qualityIssuesFromStepResult,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  releaseProofLock,
  renderPackageQualityPacketMarkdown,
  renderYeetMonitorComment,
  renderYeetStatusSummary,
  repoProofStepDefinition,
  restorePublishStashOnFailure,
  restoreStashedWorktreeForTesting,
  retireFullProofLockOrObserveAtPath,
  runGhPullRequestView,
  runYeetFallowFeedbackForTesting,
  safeOriginBranchFromBaseForTesting,
  shouldSkipCommitForReusablePublishForTesting,
  stageReviewedPublishIntent,
  stashUnstagedWorktreeForTesting,
  summarizePublishPathsForTesting,
  TurboPlanSnapshot,
  TurboPlanTask,
  TurboWorkspacePackage,
  tryReclaimStaleProofLockForTesting,
  tryRecoverObservedProofLockReapClaimForTesting,
  unverifiableProofLockRefusalForTesting,
  validateMonitorGuards,
  validateOpenPullRequest,
  validateProofCoordinatorDirectoryForTesting,
  validatePublishBranchForTesting,
  validatePublishCommitMessageForTesting,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetAttemptTerminated,
  YeetCommandError,
  YeetExecutedStep,
  YeetExistingCommitPublishIntent,
  YeetMonitorCommentCursor,
  YeetMonitorIssueComment,
  YeetMonitorReviewComment,
  YeetProofLockStateForTesting,
  YeetPublishIntent,
  YeetStagedPublishIntent,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetVerdict,
  yeetRerunDecisionText,
  yeetRerunJobListingCommand,
  yeetStatusNextCommandForTesting,
} from "@beep/repo-cli/test/Yeet";
import { findRepoRoot } from "@beep/repo-utils";
import { NonNegativeInt } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Deferred, Effect, Fiber, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer))
);
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const attemptUuid = S.decodeUnknownSync(UUID);
const DEAD_PID = 2_147_483_647;
const proofLockReapClaimPath = (lockPath: string, observedText: string): string =>
  `${lockPath}.reap-${createHash("sha256").update(observedText).digest("hex")}.claim`;
const proofLockReapClaimTombstonePath = (claimPath: string, observedText: string): string =>
  `${claimPath}.reap-${createHash("sha256").update(observedText).digest("hex")}.claim`;

const encodeProofLockReapClaim = Effect.fn("test.encodeProofLockReapClaim")(function* (
  pid: number,
  startedAt = "2026-08-26T00:00:00.000Z"
) {
  return yield* encodeJson({
    schemaVersion: "yeet-proof-lock-reap-claim/v1",
    pid,
    startedAt,
  });
});

const spawnGit = (cwd: string, args: ReadonlyArray<string>) =>
  Effect.sync(() => {
    const command: Array<string> = ["git", ...args];
    const result = Bun.spawnSync(command, {
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    });

    if (result.exitCode !== 0) {
      throw new Error(`${A.join(command, " ")} failed: ${result.stderr.toString()}`);
    }
    return result.stdout.toString();
  });

const runGit = (cwd: string, args: ReadonlyArray<string>) => spawnGit(cwd, args).pipe(Effect.asVoid);

const runGitCapture = spawnGit;

const runGitStatus = (cwd: string) => runGitCapture(cwd, ["status", "--porcelain"]).pipe(Effect.map(Str.trim));

const runGitOutputLines = (cwd: string, args: ReadonlyArray<string>) =>
  runGitCapture(cwd, args).pipe(Effect.map((output) => Str.split(/\r?\n/u)(Str.trim(output))));

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { force: true, recursive: true });
      })
  ).pipe(provideScopedLayer(PlatformLayer));

const withEnvVar = <Out>(name: string, value: string | undefined, use: () => Out): Out => {
  const previous = Bun.env[name];
  if (value === undefined) delete Bun.env[name];
  else Bun.env[name] = value;
  try {
    return use();
  } finally {
    if (previous === undefined) delete Bun.env[name];
    else Bun.env[name] = previous;
  }
};

const withEnvVarEffect = <Out, Error, Requirements>(
  name: string,
  value: string | undefined,
  use: Effect.Effect<Out, Error, Requirements>
): Effect.Effect<Out, Error, Requirements> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = Bun.env[name];
      if (value === undefined) delete Bun.env[name];
      else Bun.env[name] = value;
      return previous;
    }),
    () => use,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) delete Bun.env[name];
        else Bun.env[name] = previous;
      })
  );

type TempTrackedFileRepo = {
  readonly filePath: string;
  readonly tempContext: RepoRunContext;
  readonly tmpDir: string;
};

const initTrackedFileRepo = Effect.fn("initTrackedFileRepo")(function* (tmpDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(tmpDir, "tracked.txt");
  const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });

  yield* runGit(tmpDir, ["init"]);
  yield* runGit(tmpDir, ["config", "user.email", "yeet@example.test"]);
  yield* runGit(tmpDir, ["config", "user.name", "Yeet Test"]);
  yield* fs.writeFileString(filePath, "base\n");
  yield* runGit(tmpDir, ["add", "tracked.txt"]);
  yield* runGit(tmpDir, ["commit", "-m", "init"]);

  return { filePath, tempContext } as const;
});

const withTrackedFileRepo = <Result, Error, Requirements>(
  use: (repo: TempTrackedFileRepo) => Effect.Effect<Result, Error, Requirements>
) =>
  withTempDirectory((tmpDir) =>
    Effect.gen(function* () {
      const repo = yield* initTrackedFileRepo(tmpDir);
      return yield* use({ ...repo, tmpDir });
    })
  );

type TempProofCoordinatorRepo = TempTrackedFileRepo & {
  readonly lockPath: string;
};

const withProofCoordinatorRepo = <Result, Error, Requirements>(
  use: (repo: TempProofCoordinatorRepo) => Effect.Effect<Result, Error, Requirements>
) =>
  withTrackedFileRepo((repo) =>
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repositoryIdentity = `https://example.test/${path.basename(repo.tmpDir)}.git`;
        yield* runGit(repo.tmpDir, ["remote", "add", "origin", repositoryIdentity]);
        const lockPath = yield* proofLockPathForContext(repo.tempContext);
        const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");
        yield* Effect.all([fs.remove(lockPath, { force: true }), fs.remove(fallbackPath, { force: true })], {
          discard: true,
        });
        return { ...repo, lockPath } as const;
      }),
      use,
      ({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const coordinatorDirectory = path.dirname(lockPath);
          const coordinatorPrefix = path.basename(lockPath);
          const fallbackPath = path.join(coordinatorDirectory, "scheduler-fallback.lock");
          yield* Effect.all([fs.remove(lockPath, { force: true }), fs.remove(fallbackPath, { force: true })], {
            discard: true,
          });
          const entries = yield* fs.readDirectory(coordinatorDirectory).pipe(Effect.orElseSucceed(A.empty<string>));
          yield* Effect.forEach(
            A.filter(entries, Str.startsWith(coordinatorPrefix)),
            (entry) => fs.remove(path.join(coordinatorDirectory, entry), { force: true }).pipe(Effect.ignore),
            { discard: true }
          );
        })
    )
  );

const turboTask = (
  task: string,
  packageName = "@beep/repo-cli",
  packagePath = "packages/tooling/tool/cli"
): TurboPlanTask =>
  TurboPlanTask.make({
    taskId: `${packageName}#${task}`,
    packageName,
    packagePath,
    task,
  });

const turboPackage = (name: string, path: string): TurboWorkspacePackage =>
  TurboWorkspacePackage.make({
    name,
    path,
  });

const turboPackageFromTask = (task: TurboPlanTask): O.Option<TurboWorkspacePackage> =>
  task.packageName !== undefined && task.packagePath !== undefined
    ? O.some(turboPackage(task.packageName, task.packagePath))
    : O.none();

const turboPackagesFromTasks = (tasks: ReadonlyArray<TurboPlanTask>): ReadonlyArray<TurboWorkspacePackage> =>
  pipe(
    tasks,
    A.map(turboPackageFromTask),
    A.getSomes,
    A.dedupeWith((left, right) => left.name === right.name && left.path === right.path)
  );

const turboSnapshot = (
  tasks: ReadonlyArray<TurboPlanTask>,
  packages: ReadonlyArray<TurboWorkspacePackage> = turboPackagesFromTasks(tasks)
): TurboPlanSnapshot =>
  TurboPlanSnapshot.make({
    graphHealthStatus: "ok",
    graphHealthWarnings: [],
    turboVersion: "2.9.16",
    packages,
    tasks,
  });

const contextWithTasks = (
  tasks: ReadonlyArray<TurboPlanTask>,
  packages: ReadonlyArray<TurboWorkspacePackage> = turboPackagesFromTasks(tasks)
): RepoRunContext =>
  RepoRunContext.make({
    repoRoot: "/repo",
    cwd: "/repo",
    base: "origin/main",
    head: "feature/head",
    branch: "repo-cli-yeet",
    packetDir: ".beep/yeet",
    originalArgv: [],
    turbo: turboSnapshot(tasks, packages),
  });

const context = contextWithTasks([turboTask("build"), turboTask("check"), turboTask("lint"), turboTask("test")]);

const feedbackStep = (label: string, task: string): RepoPlanStep =>
  RepoPlanStep.make({
    id: `feedback:test-${task}`,
    label,
    phase: "feedback",
    command: "bun",
    args: ["run", task],
    cwd: "/repo",
    scope: "package",
    mutability: "readonly",
    resume: "fingerprint-match",
    packageName: "@beep/repo-cli",
    packagePath: "packages/tooling/tool/cli",
    task,
  });

const prePushStep = RepoPlanStep.make({
  id: "full:pre-push",
  label: "full:pre-push",
  phase: "full",
  command: "bun",
  args: ["run", "beep", "quality", "github-checks", "pre-push"],
  cwd: "/repo",
  scope: "repo",
  mutability: "readonly",
  resume: "never",
});

const prePushFailureIssues = (runContext: RepoRunContext, output: string) =>
  qualityIssuesFromStepResult(
    runContext,
    prePushStep,
    RepoStepRunResult.make({
      stepId: prePushStep.id,
      commandText: "bun run beep quality github-checks pre-push",
      exitCode: 1,
      output,
    })
  );

const fallowOkEnvelope = (options: {
  readonly advisory: boolean;
  readonly blocking: boolean;
  readonly feature: "audit" | "health";
  readonly findingId: string;
}): FallowReportOk => {
  const attribution = options.blocking ? "introduced" : "inherited-adjacent";
  const finding = FallowReportFinding.make({
    attribution,
    blocking: options.blocking,
    featureFamily: options.feature,
    id: options.findingId,
    parser: `fallow/${options.feature}/v1`,
    sourceRef: `packages/example/src/${options.feature}.ts`,
    subCategory: `fallow:${options.feature}:fixture`,
  });

  return FallowReportOk.make({
    schemaVersion: "fallow-report-envelope/v1",
    toolVersion: "fallow-test",
    command: `beep quality fallow ${options.feature}`,
    subcommand: options.feature,
    baseRef: "origin/main",
    generatedAt: "2026-06-15T00:00:00.000Z",
    advisory: options.advisory,
    dirtyWorktree: false,
    reportPath: `.beep/fallow/${options.feature}.json`,
    rawOutputRef: `.beep/fallow/raw/${options.feature}.json`,
    attributionKinds: [attribution],
    findingAttributionSummary: FindingAttributionSummary.make({
      introduced: NonNegativeInt.make(options.blocking ? 1 : 0),
      inheritedAdjacent: NonNegativeInt.make(options.blocking ? 0 : 1),
      notApplicable: NonNegativeInt.make(0),
    }),
    status: "ok",
    exitStatus: NonNegativeInt.make(options.blocking ? 1 : 0),
    report: FallowReportPayload.make({
      findingCount: NonNegativeInt.make(1),
      findings: [finding],
    }),
  });
};

const repoScopedFeedbackStep = (label: string, task: string, filters: ReadonlyArray<string>): RepoPlanStep =>
  RepoPlanStep.make({
    id: `feedback:test-${task}`,
    label,
    phase: "feedback",
    command: "bun",
    args: ["run", task, "--", ...filters],
    cwd: "/repo",
    scope: "repo",
    mutability: "readonly",
    resume: "never",
    task,
  });

const findStep = (steps: ReadonlyArray<RepoPlanStep>, label: string): RepoPlanStep =>
  pipe(
    steps,
    A.findFirst((step) => step.label === label),
    O.getOrThrow
  );

describe("yeet pull request lifecycle", () => {
  it("reads, finds, and validates the current branch pull request", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const binDir = path.join(tmpDir, "bin");
          const ghPath = path.join(binDir, "gh");
          yield* fs.makeDirectory(binDir);
          yield* fs.writeFileString(
            ghPath,
            `#!/bin/sh
printf '%s\\n' '{"number":874,"headRefName":"repo-cli-yeet","state":"OPEN"}'
`
          );
          yield* fs.chmod(ghPath, 0o755);

          yield* withEnvVarEffect(
            "PATH",
            `${binDir}:${Bun.env.PATH ?? ""}`,
            Effect.gen(function* () {
              const current = yield* runGhPullRequestView(tempContext);
              const found = yield* findOpenPullRequest(tempContext);
              yield* validateOpenPullRequest(tempContext);

              expect(current.number).toBe(874);
              expect(current.headRefName).toBe(tempContext.branch);
              expect(O.map(found, (view) => view.number)).toEqual(O.some(874));
            })
          );
        })
      )
    ));
});

describe("yeet planner", () => {
  it("shares ProofFact stage and environment vocabularies with attempt facts", () => {
    expect(attemptStageForTesting(defaultYeetRunOptions({ mode: "repair" }))).toBe("repair-loop");
    expect(attemptStageForTesting(defaultYeetRunOptions())).toBe("pre-push");
    expect(attemptStageForTesting(defaultYeetRunOptions({ merged: true }))).toBe("merged-preview");
    expect(attemptEnvProfileForTesting(defaultYeetRunOptions())).toBe("local");
    expect(attemptEnvProfileForTesting(defaultYeetRunOptions({ merged: true }))).toBe("pr-posture");
  });

  it("keeps yeet command error optional context at the command boundary", () => {
    const emptyError = YeetCommandError.new(new Error("cause"), "failed");
    expect(emptyError.command).toBeUndefined();
    expect(emptyError.exitCode).toBeUndefined();
    expect(emptyError.file).toBeUndefined();

    const detailedError = YeetCommandError.new(new Error("cause"), "failed", {
      command: "git push",
      exitCode: 1,
      file: ".beep/yeet/status.json",
    });
    expect(detailedError.command).toBe("git push");
    expect(detailedError.exitCode).toBe(1);
    expect(detailedError.file).toBe(".beep/yeet/status.json");
  });

  it("builds publish as advisory feedback, commit, pre-push proof, then push", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.some("feat(repo-cli): add yeet") });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "full:cheap-gates",
      "full:pre-push",
      "full:ci-parity",
      "publish:head-install-preflight",
      "publish:git:push",
    ]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.phase),
        A.dedupe
      )
    ).toEqual(["feedback", "commit", "full", "publish"]);

    const commit = findStep(plan.steps, "commit:git:commit");
    const proof = findStep(plan.steps, "full:pre-push");
    const push = findStep(plan.steps, "publish:git:push");

    expect(commit.args).toEqual(["commit", "-m", "feat(repo-cli): add yeet"]);
    expect(proof.args).toEqual(["run", "beep", "quality", "github-checks", "pre-push"]);
    expect(proof.mutability).toBe("readonly");
    expect(push.args).toEqual(["push", "-u", "origin", "HEAD"]);
    expect(push.env).toMatchObject({ BEEP_YEET_REUSE_PRE_PUSH_PROOF: "1" });
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.args)
      )
    ).not.toContainEqual(["add", "-A"]);
  });

  it("builds verify as advisory feedback plus the canonical pre-push proof", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["publish:head-install-preflight", "fallow-advisory-feedback", "full:cheap-gates", "full:pre-push"]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.mutability),
        A.dedupe
      )
    ).toEqual(["readonly", "write"]);
    expect(findStep(plan.steps, "full:pre-push").waves).toEqual([
      expect.objectContaining({ id: "preflight" }),
      expect.objectContaining({
        id: "heavy",
        laneIds: [
          "quality:build",
          "quality:lint",
          "quality:lint-policy",
          "quality:check",
          "quality:check:tsgo-tests",
          "quality:check:tsgo-smoke",
        ],
      }),
      expect.objectContaining({
        id: "test",
        laneIds: ["quality:coverage", "quality:desktop-ipc", "quality:test-unit", "quality:test-integration"],
      }),
      expect.objectContaining({ id: "documentation", laneIds: ["quality:jsdoc-ratchet", "quality:docgen"] }),
    ]);
    expect(findStep(plan.steps, "full:cheap-gates").waves).toEqual([
      expect.objectContaining({
        id: "preflight",
        laneIds: expect.arrayContaining(["cheap-gates:config-sync", "cheap-gates:effect-imports"]),
      }),
    ]);
  });

  it("plans collect-all as an explicit override of fail-fast wave scheduling", () => {
    const plan = withEnvVar("BEEP_YEET_LANE_PROOF_MODE", undefined, () =>
      buildYeetRunPlanForTesting({ collectAll: true, context, message: O.none(), mode: "verify" })
    );

    expect(findStep(plan.steps, "full:pre-push").args).toEqual([
      "run",
      "beep",
      "quality",
      "github-checks",
      "pre-push",
      "--collect-all",
    ]);
    expect(findStep(plan.steps, "full:pre-push").env?.BEEP_YEET_LANE_PROOF_MODE).toBe("active");
  });

  it("builds explicit CI parity as the installed merge-preview CI battery", () => {
    const plan = buildYeetRunPlanForTesting({ ciParity: true, context, message: O.none(), mode: "verify" });

    expect(A.map(plan.steps, (step) => step.label)).toEqual(["fallow-advisory-feedback", "full:ci-parity"]);
    const parity = findStep(plan.steps, "full:ci-parity");
    expect(parity.args).toEqual(["run", "beep", "ci", "local", "--affected", "--base", "origin/main"]);
    expect(parity.verification).toBe("installed-merge-preview-pr-posture");
    expect(parity.env).toMatchObject({
      BEEP_TEST_DATABASE_DRIVER: undefined,
      BEEP_TEST_DATABASE_URL: undefined,
      CI: "true",
      DATABASE_URL: undefined,
      GITHUB_ACTIONS: "true",
      TURBO_CACHE: "local:rw",
    });
  });

  it("builds review-fix verify as the targeted review proof", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify", tier: "review-fix" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["fallow-advisory-feedback", "full:review-fix"]);
    expect(findStep(plan.steps, "full:review-fix").args).toEqual([
      "run",
      "beep",
      "quality",
      "github-checks",
      "review-fix",
      "--base",
      "origin/main",
      "--head",
      "feature/head",
    ]);
  });

  it("builds cheap-gates verify without any heavyweight proof lane", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify", tier: "cheap-gates" });

    expect(A.map(plan.steps, (step) => step.label)).toEqual(["fallow-advisory-feedback", "full:cheap-gates"]);
    expect(findStep(plan.steps, "full:cheap-gates").args).toEqual([
      "run",
      "beep",
      "quality",
      "github-checks",
      "cheap-gates",
      "--collect-all",
    ]);
    expect(A.some(plan.steps, (step) => step.label === "full:pre-push")).toBe(false);
  });

  it("builds closeout as PR context plus review gates", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "closeout" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["closeout:pr-context", "closeout:review-gates"]);
    expect(findStep(plan.steps, "closeout:pr-context").args).toEqual([
      "pr",
      "view",
      "--json",
      "number,headRefName,state,url,headRefOid,isDraft",
    ]);
  });

  it("builds pre-push-hook as a lightweight proof-state check", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "pre-push-hook" });

    expect(plan.steps).toEqual([]);
  });

  it("uses a Greptile retrigger body that requests review explicitly", () => {
    expect(greptileRetriggerCommentForTesting).toBe("@greptileai review");
  });

  it("builds amend no-edit publish without requiring a new message", () => {
    const plan = buildYeetRunPlanForTesting({
      amend: true,
      context,
      message: O.none(),
      mode: "publish",
      noEdit: true,
    });

    expect(findStep(plan.steps, "commit:git:commit:amend").args).toEqual(["commit", "--amend", "--no-edit"]);
  });

  it("builds amend publish with an explicit message without dropping --amend", () => {
    const plan = buildYeetRunPlanForTesting({
      amend: true,
      context,
      message: O.some("fix(repo-cli): update yeet"),
      mode: "publish",
    });

    expect(findStep(plan.steps, "commit:git:commit:amend").args).toEqual([
      "commit",
      "--amend",
      "-m",
      "fix(repo-cli): update yeet",
    ]);
  });

  it("builds monitor as current branch PR context plus check watching", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "monitor" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["monitor:pr-context", "monitor:pr-checks:watch"]);
    expect(findStep(plan.steps, "monitor:pr-context").args).toEqual([
      "pr",
      "view",
      "--json",
      "number,headRefName,state",
    ]);
    expect(findStep(plan.steps, "monitor:pr-checks:watch").args).toEqual(["pr", "checks", "--watch", "--fail-fast"]);
  });

  it("builds status as local-only by default and adds remote PR reads on request", () => {
    const localPlan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "status" });
    const remotePlan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "status", remote: true });

    expect(
      pipe(
        localPlan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["status:local"]);
    expect(
      pipe(
        remotePlan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["status:local", "status:remote-pr", "status:remote-checks"]);
    expect(findStep(remotePlan.steps, "status:remote-pr").args).toEqual([
      "pr",
      "view",
      "--json",
      "number,url,state,mergeable,mergeStateStatus,isDraft,reviewDecision",
    ]);
    expect(findStep(remotePlan.steps, "status:remote-checks").args).toEqual([
      "pr",
      "checks",
      "--json",
      "name,state,bucket",
    ]);
  });

  it("builds fast-plus-monitor publish without the local full proof", () => {
    const plan = buildYeetRunPlanForTesting({
      context,
      fast: true,
      message: O.some("feat(repo-cli): add yeet"),
      monitor: true,
    });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "publish:head-install-preflight",
      "publish:git:push",
      "monitor:pr-context",
      "monitor:pr-checks:watch",
    ]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).not.toContain("full:pre-push");
  });

  it("builds start-pr-early publish as commit, preflight, early push, full proof, then monitor", () => {
    const plan = buildYeetRunPlanForTesting({
      context,
      message: O.some("feat(repo-cli): add yeet"),
      monitor: true,
      startPrEarly: true,
    });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "publish:head-install-preflight",
      "early-publish:git:push",
      "full:cheap-gates",
      "full:pre-push",
      "full:ci-parity",
      "monitor:pr-context",
      "monitor:pr-checks:watch",
    ]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.phase),
        A.dedupe
      )
    ).toEqual(["feedback", "commit", "early-publish", "full", "monitor"]);

    const commit = findStep(plan.steps, "commit:git:commit");
    const earlyPush = findStep(plan.steps, "early-publish:git:push");

    // start-pr-early must keep local pre-commit/pre-push hooks active so secret
    // scanning and SAST gates cannot be bypassed before the remote publish.
    expect(commit.args).toEqual(["commit", "-m", "feat(repo-cli): add yeet"]);
    expect(commit.args).not.toContain("--no-verify");
    expect(earlyPush.args).toEqual(["push", "-u", "origin", "HEAD"]);
    expect(earlyPush.args).not.toContain("--no-verify");
    expect(earlyPush.env).toBeUndefined();
  });

  it("targets the original PR branch when a recovery worktree supplies a push refspec", () => {
    const plan = withEnvVar("BEEP_YEET_PUSH_REFSPEC", "HEAD:refs/heads/feature/original-pr", () =>
      buildYeetRunPlanForTesting({
        context,
        message: O.some("fix(repo-cli): recover published branch"),
        monitor: true,
        startPrEarly: true,
      })
    );
    expect(findStep(plan.steps, "early-publish:git:push").args).toEqual([
      "push",
      "-u",
      "origin",
      "HEAD:refs/heads/feature/original-pr",
    ]);
    const invalid = withEnvVar("BEEP_YEET_PUSH_REFSPEC", "refs/heads/not-a-head-refspec", () =>
      buildYeetRunPlanForTesting({ context, message: O.some("fix(repo-cli): reject invalid recovery refspec") })
    );
    expect(findStep(invalid.steps, "publish:git:push").args).toEqual(["push", "-u", "origin", "HEAD"]);
  });

  it("builds push-only reuse publish as only push plus optional monitor", () => {
    const plan = buildYeetRunPlanForTesting({
      context,
      message: O.none(),
      mode: "publish",
      monitor: true,
      pushOnly: true,
    });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual(["publish:head-install-preflight", "publish:git:push", "monitor:pr-context", "monitor:pr-checks:watch"]);
    expect(findStep(plan.steps, "publish:git:push").args).toEqual(["push", "-u", "origin", "HEAD"]);
  });

  it("plans the opposite optional publish branches explicitly", () => {
    const pushOnlyPr = buildYeetRunPlanForTesting({
      context,
      message: O.none(),
      mode: "publish",
      pr: true,
      pushOnly: true,
    });
    expect(A.map(pushOnlyPr.steps, (step) => step.label)).toEqual([
      "publish:head-install-preflight",
      "publish:git:push",
      "publish:pr-create",
    ]);

    const earlyWithoutMonitor = buildYeetRunPlanForTesting({
      context,
      message: O.some("feat(repo-cli): add yeet"),
      startPrEarly: true,
    });
    expect(A.some(earlyWithoutMonitor.steps, (step) => step.phase === "monitor")).toBe(false);
  });

  it("plans proof defaults independently of ambient Yeet variables", () => {
    const plan = withEnvVar("BEEP_YEET_LANE_PROOF_MODE", undefined, () =>
      buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify" })
    );

    expect(findStep(plan.steps, "full:pre-push").env).toMatchObject({
      BEEP_YEET_LANE_PROOF_MODE: "active",
      BEEP_YEET_PROOF_BASE: "origin/main",
    });
  });

  it("covers warning and main-branch plan variants", () => {
    expect(emptyTurboPlanSnapshot(["cycle detected"]).graphHealthStatus).toBe("warning");
    const mainContext = RepoRunContext.make({ ...context, branch: "main" });
    const plan = buildYeetRunPlanForTesting({ context: mainContext, message: O.none(), mode: "verify" });
    expect(findStep(plan.steps, "full:pre-push").waves?.[0]?.laneIds).not.toContain("quality:changeset-status");
  });

  it("requires a publish message unless the run is an amend that keeps the existing subject", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ tempContext }) =>
        Effect.gen(function* () {
          yield* validatePublishCommitMessageForTesting(
            tempContext,
            O.none(),
            defaultYeetRunOptions({ amend: true, noEdit: true })
          );

          const error = yield* Effect.flip(
            validatePublishCommitMessageForTesting(tempContext, O.none(), defaultYeetRunOptions())
          );

          expect(error.message).toContain("yeet publish requires --message with a conventional commit message");
        })
      )
    ));

  it("rejects push-only reuse when staged changes are present", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(filePath, "changed\n");
          yield* runGit(tmpDir, ["add", "tracked.txt"]);

          const error = yield* Effect.flip(
            shouldSkipCommitForReusablePublishForTesting(
              tempContext,
              defaultYeetRunOptions({ pushOnly: true, reuseVerified: true })
            )
          );

          expect(error.message).toContain("yeet publish --push-only --reuse-verified refuses staged changes.");
          expect(error.message).toContain("  - tracked.txt");
        })
      )
    ));

  it("fingerprints large dirty diffs without command capture truncation", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          yield* fs.writeFileString(filePath, `${"first\n".repeat(110_000)}`);
          const first = yield* collectDiffFingerprintForTesting(tempContext);
          yield* fs.writeFileString(filePath, `${"second\n".repeat(110_000)}`);
          const second = yield* collectDiffFingerprintForTesting(tempContext);

          expect(first).toMatch(/^[a-f0-9]{64}$/u);
          expect(second).toMatch(/^[a-f0-9]{64}$/u);
          expect(second).not.toBe(first);
        })
      )
    ));

  it("loads reusable proof state from the legacy sanitized run directory", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const legacyStatePath = path.join(tmpDir, ".beep/yeet/runs/repo-cli-yeet/state.json");
          yield* fs.makeDirectory(path.dirname(legacyStatePath), { recursive: true });
          const legacyStateJson = yield* encodeJson({
            schemaVersion: "yeet-run-state/v1",
            artifactDir: path.join(tmpDir, ".beep/yeet"),
            base: tempContext.base,
            branch: tempContext.branch,
            commitSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            diffFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            head: tempContext.head,
            proofCommand: "bun run beep quality github-checks pre-push",
            proofTier: "full",
            runId: "repo-cli-yeet",
            verifiedAt: "2026-06-12T00:00:00.000Z",
            laneProofs: [],
          });
          yield* fs.writeFileString(legacyStatePath, `${legacyStateJson}\n`);

          const state = yield* loadVerifiedStateForTesting(tempContext);

          expect(state.runId).toBe("repo-cli-yeet");
          expect(state.branch).toBe(tempContext.branch);
        })
      )
    ));

  it("keeps publish monitor on the full local proof unless fast is explicit", () => {
    const plan = buildYeetRunPlanForTesting({
      context,
      message: O.some("feat(repo-cli): add yeet"),
      monitor: true,
    });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "full:cheap-gates",
      "full:pre-push",
      "full:ci-parity",
      "publish:head-install-preflight",
      "publish:git:push",
      "monitor:pr-context",
      "monitor:pr-checks:watch",
    ]);
  });

  it("exposes the review-fix repo proof surface", () => {
    expect(repoProofStepDefinition("review-fix")).toMatchObject({
      args: ["quality", "github-checks", "review-fix"],
      label: "full:review-fix",
      surface: "review-fix",
    });
  });

  it("exposes the collected cheap-gates repo proof surface", () => {
    expect(repoProofStepDefinition("cheap-gates")).toMatchObject({
      args: ["quality", "github-checks", "cheap-gates", "--collect-all"],
      label: "full:cheap-gates",
      surface: "cheap-gates",
    });
  });

  it("builds repair as deterministic generators plus affected feedback", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "repair" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "prepare:laws:effect-imports",
      "prepare:laws:terse-effect",
      "prepare:config-sync",
      "feedback:cheap-gates",
      "feedback:lint:fix",
      "feedback:docgen",
      "feedback:build",
      "feedback:check",
      "feedback:lint",
      "feedback:test",
    ]);
    expect(findStep(plan.steps, "prepare:laws:effect-imports").args).toEqual([
      "run",
      "beep",
      "laws",
      "effect-imports",
      "--write",
    ]);
    expect(findStep(plan.steps, "feedback:cheap-gates").args).toEqual([
      "run",
      "beep",
      "quality",
      "github-checks",
      "cheap-gates",
      "--collect-all",
    ]);
    expect(findStep(plan.steps, "feedback:docgen").args).toEqual(["run", "docgen"]);
  });

  it("uses the shared pre-push proof definition for Yeet parity", () => {
    const proof = repoProofStepDefinition("pre-push");

    expect(proof.args).toEqual(["quality", "github-checks", "pre-push"]);
    expect(proof.label).toBe("full:pre-push");
  });

  it("threads task-aware affected filters into repair feedback runs", () => {
    const scopedContext = contextWithTasks([
      turboTask("build"),
      turboTask("check"),
      turboTask("check", "@beep/schema", "packages/foundation/modeling/schema"),
      turboTask("lint"),
      turboTask("test"),
    ]);
    const plan = buildYeetRunPlanForTesting({
      context: scopedContext,
      message: O.some("feat(repo-cli): add yeet"),
      mode: "repair",
    });

    expect(findStep(plan.steps, "feedback:check").args).toEqual([
      "run",
      "check",
      "--",
      "--filter=@beep/repo-cli",
      "--filter=@beep/schema",
      "--concurrency=3",
      "--continue=dependencies-successful",
      "--summarize",
      "--ui=stream",
    ]);
    expect(findStep(plan.steps, "feedback:check").args).not.toContain("--affected");
    expect(findStep(plan.steps, "feedback:check").scope).toBe("repo");
    expect(findStep(plan.steps, "feedback:test").args).toEqual([
      "run",
      "test",
      "--",
      "--unit",
      "--filter=@beep/repo-cli",
      "--concurrency=3",
      "--continue=dependencies-successful",
      "--summarize",
      "--ui=stream",
    ]);
  });

  it("uses changed-file lint fix for write-mode repair", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "repair" });
    const step = findStep(plan.steps, "feedback:lint:fix");

    expect(step.args).toEqual(["run", "lint:fix"]);
    expect(step.env).toBeUndefined();
  });

  it("omits repair feedback steps whose task has no affected packages", () => {
    const plan = buildYeetRunPlanForTesting({
      context: contextWithTasks([turboTask("build"), turboTask("lint")]),
      message: O.some("feat(repo-cli): add yeet"),
      mode: "repair",
    });

    expect(
      pipe(
        plan.steps,
        A.filter((step) => step.phase === "feedback"),
        A.map((step) => step.label)
      )
    ).toEqual(["feedback:cheap-gates", "feedback:lint:fix", "feedback:docgen", "feedback:build", "feedback:lint"]);
  });

  it("keeps repair feedback as a no-op instead of falling back to all packages", () => {
    const plan = buildYeetRunPlanForTesting({
      context: contextWithTasks([]),
      message: O.some("feat(repo-cli): add yeet"),
      mode: "repair",
    });

    expect(
      pipe(
        plan.steps,
        A.filter((step) => step.phase === "feedback")
      )
    ).toEqual([
      expect.objectContaining({ label: "feedback:cheap-gates" }),
      expect.objectContaining({ label: "feedback:lint:fix" }),
      expect.objectContaining({ label: "feedback:docgen" }),
    ]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "prepare:laws:effect-imports",
      "prepare:laws:terse-effect",
      "prepare:config-sync",
      "feedback:cheap-gates",
      "feedback:lint:fix",
      "feedback:docgen",
    ]);
  });

  it("filters publish paths against the reviewed staged intent", () => {
    expect(gitPathListFromNulOutputForTesting("src/z.ts\0src/a.ts\0src/a.ts\0")).toEqual(["src/a.ts", "src/z.ts"]);
    expect(publishPathsOutsideIntentForTesting(["src/a.ts", "src/z.ts"], ["src/a.ts", "secrets/local.env"])).toEqual([
      "secrets/local.env",
    ]);
  });

  it("omits reviewed deletion paths from publish restaging", () => {
    expect(
      publishRestagePathsForTesting(
        ["scripts/removed.ts", "src/changed.ts", "src/new.ts"],
        ["src/changed.ts", "src/new.ts"]
      )
    ).toEqual(["src/changed.ts", "src/new.ts"]);
  });

  it("forces only reviewed ignored paths when restaging the index", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const regularPath = path.join(tmpDir, "regular.txt");

          yield* fs.writeFileString(regularPath, "original\n");
          yield* fs.writeFileString(path.join(tmpDir, ".gitignore"), "tracked.txt\n");
          yield* runGit(tmpDir, ["add", ".gitignore", "regular.txt"]);
          yield* runGit(tmpDir, ["commit", "-m", "ignore tracked file"]);
          yield* fs.writeFileString(filePath, "updated\n");
          yield* fs.writeFileString(regularPath, "updated\n");
          yield* runGit(tmpDir, ["add", "--force", "tracked.txt"]);
          yield* runGit(tmpDir, ["add", "regular.txt"]);

          yield* stageReviewedPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["regular.txt", "tracked.txt"] }),
            false
          );

          expect(yield* runGitStatus(tmpDir)).toBe("M  regular.txt\nM  tracked.txt");
        })
      )
    ));

  it("decodes Turbo affected query JSON into plan task metadata", () => {
    const tasks = Effect.runSync(
      decodeTurboPlanTasksFromQueryJsonForTesting(
        `{
          "data": {
            "affectedTasks": {
              "items": [
                {
                  "name": "check",
                  "fullName": "@beep/repo-cli#check",
                  "package": { "name": "@beep/repo-cli" },
                  "reason": { "__typename": "TaskFileChanged" }
                },
                {
                  "name": "lint",
                  "fullName": "@beep/schema#lint",
                  "package": { "name": "@beep/schema" },
                  "reason": { "__typename": "TaskDependencyChanged" }
                }
              ],
              "length": 2
            }
          }
        }`,
        `{
          "packageManager": "bun",
          "packages": {
            "count": 2,
            "items": [
              { "name": "@beep/repo-cli", "path": "packages/tooling/tool/cli" },
              { "name": "@beep/schema", "path": "packages/foundation/modeling/schema" }
            ]
          }
        }`
      )
    );

    expect(tasks).toEqual([
      expect.objectContaining({
        taskId: "@beep/repo-cli#check",
        packageName: "@beep/repo-cli",
        packagePath: "packages/tooling/tool/cli",
        task: "check",
      }),
      expect.objectContaining({
        taskId: "@beep/schema#lint",
        packageName: "@beep/schema",
        packagePath: "packages/foundation/modeling/schema",
        task: "lint",
      }),
    ]);
  });

  it("extracts the last decodable Turbo JSON object from mixed output", () => {
    const payload = `{"data":{"affectedTasks":{"items":[],"length":0},"message":"keeps } inside strings"}}`;
    const extracted = jsonObjectTextFromMixedOutputForTesting(
      `turbo warning {not-json}\n{"ignored":true}\n${payload}\ntrailing warning {still-not-json}`
    );

    expect(O.getOrThrow(extracted)).toBe(payload);
  });

  it("returns no object and stays bounded on pathological unmatched-brace output", () => {
    // Regression for the quadratic JSON extractor: 256 KiB of unmatched closing
    // braces previously triggered O(n^2) backward scanning and hung the CLI.
    const hostile = Str.repeat(256 * 1024)("}");
    const startedAt = globalThis.performance.now();
    const extracted = jsonObjectTextFromMixedOutputForTesting(hostile);
    const elapsedMs = globalThis.performance.now() - startedAt;

    expect(O.isNone(extracted)).toBe(true);
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("still finds a trailing JSON object after pathological leading braces", () => {
    const payload = `{"data":{"affectedTasks":{"items":[],"length":0}}}`;
    const extracted = jsonObjectTextFromMixedOutputForTesting(`${Str.repeat(100_000)("}")}\n${payload}`);

    expect(O.getOrThrow(extracted)).toBe(payload);
  });

  it("does not enable fingerprint resume until runtime skip execution exists", () => {
    const repairPlan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "repair" });
    const publishPlan = buildYeetRunPlanForTesting({ context, message: O.some("feat(repo-cli): add yeet") });

    expect(findStep(repairPlan.steps, "feedback:check").resume).toBe("never");
    expect(findStep(publishPlan.steps, "full:pre-push").resume).toBe("never");
    expect(findStep(publishPlan.steps, "commit:git:commit").resume).toBe("never");
  });

  it("quotes command text without changing argv", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.some("feat(repo-cli): add yeet") });
    const commit = findStep(plan.steps, "commit:git:commit");

    expect(commit.args).toEqual(["commit", "-m", "feat(repo-cli): add yeet"]);
    expect(commandTextForStep(commit)).toBe("git commit -m 'feat(repo-cli): add yeet'");
  });

  it("parses pre-push stdin SHAs for proof reuse", () => {
    const currentSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const otherSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const deleteSha = "0000000000000000000000000000000000000000";
    const shas = prePushLocalShasFromStdinForTesting(
      `refs/heads/feature ${currentSha} refs/heads/feature 1111111111111111111111111111111111111111\n` +
        `refs/heads/old ${deleteSha} refs/heads/old 2222222222222222222222222222222222222222\n` +
        `refs/heads/other ${otherSha} refs/heads/other 3333333333333333333333333333333333333333\n`
    );

    expect(shas).toEqual([currentSha, otherSha]);
    expect(prePushShaMismatchesForTesting(shas, currentSha)).toEqual([otherSha]);
  });

  it("warns when publish push target differs from upstream tracking", () => {
    expect(publishUpstreamMismatchWarningForTesting("feat/yeet", "origin/main")).toEqual(
      O.some('[yeet] warning: branch "feat/yeet" tracks "origin/main"; publish will push HEAD to origin/feat/yeet.')
    );
    expect(publishUpstreamMismatchWarningForTesting("feat/yeet", "origin/feat/yeet")).toEqual(O.none());
  });

  it("keeps human comments that mention Greptile from replacing the bot summary", () => {
    const summary = latestGreptileSummaryForTesting([
      {
        authorLogin: "greptile-apps",
        body: "Confidence Score: 5/5\n0 issues",
        url: "https://github.test/pr#greptile",
      },
      {
        authorLogin: "elpresidank",
        body: "fixed per greptile feedback",
        url: "https://github.test/pr#human",
      },
      {
        authorLogin: "greptile-apps",
        body: "Inline finding without a summary score",
        url: "https://github.test/pr#inline",
      },
      {
        authorLogin: "greptile-apps",
        body: "`issueCount` and score/issue gates can fire spuriously. Fix prompt: %60issueCount%60",
        url: "https://github.test/pr#inline-noise",
      },
    ]);

    expect(summary).toMatchObject({
      issueCount: 0,
      score: "5/5",
      url: "https://github.test/pr#greptile",
    });
  });

  it("parses only summary-shaped Greptile issue counts", () => {
    expect(
      latestGreptileSummaryForTesting([
        {
          authorLogin: "greptile-apps",
          body: "Issues: 0",
          url: "https://github.test/pr#labeled",
        },
      ])
    ).toMatchObject({ issueCount: 0 });
    expect(
      latestGreptileSummaryForTesting([
        {
          authorLogin: "greptile-apps",
          body: "No open issues",
          url: "https://github.test/pr#none",
        },
      ])
    ).toMatchObject({ issueCount: 0 });
    expect(
      latestGreptileSummaryForTesting([
        {
          authorLogin: "greptile-apps",
          body: "Potential issue: score/issue gates can parse prompt links like %60issueCount%60.",
          url: "https://github.test/pr#inline",
        },
      ])
    ).toMatchObject({});
  });

  it("parses only labeled Greptile summary scores", () => {
    expect(
      latestGreptileSummaryForTesting([
        {
          authorLogin: "greptile-apps",
          body: "<h3>Confidence Score: 5/5</h3>\nReviewed 12 of 52 captures.",
          url: "https://github.test/pr#confidence",
        },
      ])
    ).toMatchObject({ score: "5/5" });
    expect(
      latestGreptileSummaryForTesting([
        {
          authorLogin: "greptile-apps",
          body: "Reviewed 12/5 candidate notes without a labeled score.",
          url: "https://github.test/pr#noise",
        },
      ])
    ).toMatchObject({});
  });

  it("infers missing Greptile issue counts from active Greptile threads", () => {
    // CSF-030: a missing Greptile review (no parsed summary and no active
    // Greptile-authored threads) must NOT be treated as a confident zero issues.
    // The issue count is left undefined so the closeout gate stays fail-closed
    // instead of granting a free pass when Greptile never ran.
    expect(inferGreptileIssueCountForTesting(latestGreptileSummaryForTesting([]), 0).issueCount).toBeUndefined();
    // With positive Greptile evidence (active threads) but no parsed summary
    // count, the active thread count is inferred as the issue count.
    expect(inferGreptileIssueCountForTesting(latestGreptileSummaryForTesting([]), 3)).toMatchObject({
      issueCount: 3,
    });
    expect(
      inferGreptileIssueCountForTesting(
        latestGreptileSummaryForTesting([
          {
            authorLogin: "greptile-apps",
            body: "Issues: 2",
            url: "https://github.test/pr#summary",
          },
        ]),
        0
      )
    ).toMatchObject({ issueCount: 2 });
  });

  it("treats Greptile issue requirements as an upper bound", () => {
    expect(greptileIssueLimitExceededForTesting(undefined, -1)).toBe(false);
    expect(greptileIssueLimitExceededForTesting(undefined, 0)).toBe(true);
    expect(greptileIssueLimitExceededForTesting(0, 2)).toBe(false);
    expect(greptileIssueLimitExceededForTesting(2, 2)).toBe(false);
    expect(greptileIssueLimitExceededForTesting(3, 2)).toBe(true);
  });

  it("builds durable closeout gate states for bot and review gates", () => {
    const states = closeoutGateStatesForTesting({
      options: PrCloseoutOptions.make({
        bots: "coderabbit,chatgpt,greptile",
        requireGreptileIssues: 0,
        requireGreptileScore: "5/5",
        requireReviewComments: 0,
        retriggerGreptile: false,
      }),
      actionableReviewThreadCount: 0,
      greptile: GreptileSummary.make({
        issueCount: 0,
        score: "5/5",
        url: "https://github.test/pr#greptile",
      }),
      botComments: [
        {
          authorLogin: "coderabbitai",
          body: "Review completed",
          url: "https://github.test/pr#coderabbit",
        },
      ],
    });

    expect(states).toEqual([
      expect.objectContaining({ name: "review-threads", status: "passed", count: 0 }),
      expect.objectContaining({ name: "greptile", status: "passed", count: 0 }),
      expect.objectContaining({ name: "coderabbit", status: "passed", count: 0 }),
      expect.objectContaining({ name: "chatgpt", status: "unknown", count: 0 }),
      expect.objectContaining({ name: "hosted-checks", status: "unknown" }),
    ]);
  });
});

describe("yeet quality issue index", () => {
  it("ignores strict Fallow envelopes when advisory feedback reads a mixed output directory", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fromDir = path.join(tmpDir, ".beep", "fallow");
          const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
          const auditText = yield* encodeJson(
            fallowOkEnvelope({
              advisory: false,
              blocking: true,
              feature: "audit",
              findingId: "audit-promoted",
            })
          );
          const healthText = yield* encodeJson(
            fallowOkEnvelope({
              advisory: true,
              blocking: false,
              feature: "health",
              findingId: "health-advisory",
            })
          );

          yield* fs.makeDirectory(fromDir, { recursive: true });
          yield* fs.writeFileString(path.join(fromDir, "audit.check.json"), `${auditText}\n`);
          yield* fs.writeFileString(path.join(fromDir, "health.advisory.json"), `${healthText}\n`);
          // CSF-011: the Fallow feedback reader/writer is constrained to its
          // configured allowed root. Point the guard at this temp dir so the
          // mixed-output directory is exercised under the symlink/traversal
          // protection without hardcoding the repository root.
          yield* runYeetFallowFeedbackForTesting({ advisory: true, emit: emitPath, from: fromDir }).pipe(
            Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir))
          );

          const emittedText = yield* fs.readFileString(emitPath);
          const index = yield* S.decodeEffect(S.fromJsonString(QualityIssueIndex))(emittedText);

          expect(index.issues).toHaveLength(1);
          expect(index.issues[0]).toMatchObject({
            id: "fallow:health:health-advisory",
            blocking: false,
            subCategory: "fallow:health:fixture",
            tool: "fallow",
          });
          expect(index.packages).toEqual([
            expect.objectContaining({
              blockingCount: 0,
              issueCount: 1,
              packageName: "@beep/root",
            }),
          ]);
        })
      )
    ));

  // Ledger #55 / decision 25: advisory Fallow envelopes older than the Yeet run
  // start are gitignored leftovers, so the phase purges them and skips instead of
  // failing the publish. Behavioral detail lives in yeet-fallow-self-heal.test.ts.
  it("purges advisory Fallow envelopes older than the Yeet run start", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fromDir = path.join(tmpDir, ".beep", "fallow");
          const emitPath = path.join(tmpDir, ".beep", "yeet", "fallow-quality-issues.json");
          const envelopePath = path.join(fromDir, "health.advisory.json");
          const healthText = yield* encodeJson(
            fallowOkEnvelope({
              advisory: true,
              blocking: false,
              feature: "health",
              findingId: "health-stale",
            })
          );
          yield* fs.makeDirectory(fromDir, { recursive: true });
          yield* fs.writeFileString(envelopePath, `${healthText}\n`);
          yield* runYeetFallowFeedbackForTesting({
            advisory: true,
            emit: emitPath,
            from: fromDir,
            runStartedAt: "2026-06-16T00:00:00.000Z",
          }).pipe(Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir)));

          expect(yield* fs.exists(envelopePath)).toBe(false);

          const emittedText = yield* fs.readFileString(emitPath);
          const index = yield* S.decodeEffect(S.fromJsonString(QualityIssueIndex))(emittedText);
          expect(index.issues).toEqual([]);
        })
      )
    ));

  it("parses known TypeScript diagnostics and falls back to raw command failures", () => {
    const checkStep = feedbackStep("feedback:check", "check");
    const testStep = feedbackStep("feedback:test", "test");
    const structuredIssues = qualityIssuesFromStepResult(
      context,
      checkStep,
      RepoStepRunResult.make({
        stepId: checkStep.id,
        commandText: "bun run check",
        exitCode: 1,
        output: "packages/tooling/tool/cli/src/example.ts:12:8 - error TS90001: unsafe effect(service) usage",
        rawOutputRef: ".beep/yeet/logs/check.log",
      })
    );
    const rawIssues = qualityIssuesFromStepResult(
      context,
      testStep,
      RepoStepRunResult.make({
        stepId: testStep.id,
        commandText: "bun run test",
        exitCode: 1,
        output: "FAIL packages/tooling/tool/cli/test/yeet.test.ts",
        rawOutputRef: ".beep/yeet/logs/test.log",
      })
    );

    expect(structuredIssues).toHaveLength(1);
    expect(structuredIssues[0]).toMatchObject({
      category: "effect-tsgo-policy",
      confidence: "structured",
      file: "packages/tooling/tool/cli/src/example.ts",
      line: 12,
      column: 8,
      packageName: "@beep/repo-cli",
    });
    expect(rawIssues).toHaveLength(1);
    expect(rawIssues[0]).toMatchObject({
      category: "test",
      confidence: "raw",
      packageName: "@beep/repo-cli",
    });

    const index = buildQualityIssueIndex([...rawIssues, ...structuredIssues]);

    expect(index.rawOutputRefs).toEqual([".beep/yeet/logs/check.log", ".beep/yeet/logs/test.log"]);
    expect(index.packages).toHaveLength(1);
    expect(index.packages[0]).toMatchObject({
      packageName: "@beep/repo-cli",
      packagePath: "packages/tooling/tool/cli",
      issueCount: 2,
      blockingCount: 2,
    });
  });

  it("parses structured schema-first policy findings", () => {
    const lintStep = feedbackStep("feedback:lint", "lint");
    const output =
      '[schema-first:issue] {"category":"schema-first-policy","ruleId":"literal-kit-const-assertion",' +
      '"severity":"error","file":"packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts","line":42,' +
      '"symbol":"LiteralKit","message":"Inline LiteralKit array arguments do not need as const.",' +
      '"remediation":"Remove the redundant as const assertion; LiteralKit already uses const type parameters."}';
    const issues = qualityIssuesFromStepResult(
      context,
      lintStep,
      RepoStepRunResult.make({
        stepId: lintStep.id,
        commandText: "bun run beep lint schema-first",
        exitCode: 1,
        output,
        rawOutputRef: ".beep/yeet/logs/lint-schema-first.log",
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "schema-first-policy",
      subCategory: "literal-kit-const-assertion",
      confidence: "structured",
      file: "packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts",
      line: 42,
      symbol: "LiteralKit",
      remediation: "Remove the redundant as const assertion; LiteralKit already uses const type parameters.",
      packageName: "@beep/repo-cli",
      packagePath: "packages/tooling/tool/cli",
    });
    expect(issues[0]?.routing).toContainEqual(
      expect.objectContaining({
        skill: "schema-first-development",
        reason: "Schema-first policy finding",
      })
    );
  });

  it("renders deterministic per-package Markdown packets", () => {
    const checkStep = feedbackStep("feedback:check", "check");
    const lintStep = feedbackStep("feedback:lint", "lint");
    const firstIssues = qualityIssuesFromStepResult(
      context,
      checkStep,
      RepoStepRunResult.make({
        stepId: checkStep.id,
        commandText: "bun run check",
        exitCode: 1,
        output: "packages/tooling/tool/cli/src/example.ts:12:8 - error TS90001: unsafe effect(service) usage",
      })
    );
    const secondIssues = qualityIssuesFromStepResult(
      context,
      lintStep,
      RepoStepRunResult.make({
        stepId: lintStep.id,
        commandText: "bun run lint",
        exitCode: 1,
        output: "lint failed",
      })
    );
    const report = O.getOrThrow(A.head(buildQualityIssueIndex([...firstIssues, ...secondIssues]).packages));
    const reversedReport = O.getOrThrow(A.head(buildQualityIssueIndex([...secondIssues, ...firstIssues]).packages));
    const markdown = Result.getOrThrow(renderPackageQualityPacketMarkdown(report));
    const reversedMarkdown = Result.getOrThrow(renderPackageQualityPacketMarkdown(reversedReport));

    expect(markdown).toBe(reversedMarkdown);
    expect(markdown).toContain("# Yeet Quality Packet: @beep/repo\\-cli");
    expect(markdown).toContain("Effect tsgo diagnostic");
    expect(markdown).toContain("bun run check");
    expect(markdown).toContain("bun run lint");
  });

  it("keeps repo-scoped filtered raw failures attached to filtered packages", () => {
    const scopedContext = contextWithTasks([
      turboTask("test"),
      turboTask("test", "@beep/schema", "packages/foundation/modeling/schema"),
    ]);
    const step = repoScopedFeedbackStep("feedback:test", "test", ["--filter=@beep/repo-cli", "--filter=@beep/schema"]);
    const issues = qualityIssuesFromStepResult(
      scopedContext,
      step,
      RepoStepRunResult.make({
        stepId: step.id,
        commandText: "bun run test -- --filter=@beep/repo-cli --filter=@beep/schema",
        exitCode: 1,
        output: "FAIL unknown test output without a diagnostic path",
      })
    );
    const index = buildQualityIssueIndex(issues);

    expect(
      pipe(
        index.packages,
        A.map((report) => report.packageName)
      )
    ).toEqual(["@beep/repo-cli", "@beep/schema"]);
    expect(index.packages).toEqual([
      expect.objectContaining({
        packageName: "@beep/repo-cli",
        packagePath: "packages/tooling/tool/cli",
        issueCount: 1,
      }),
      expect.objectContaining({
        packageName: "@beep/schema",
        packagePath: "packages/foundation/modeling/schema",
        issueCount: 1,
      }),
    ]);
    expect(
      new Set(
        pipe(
          index.issues,
          A.map((issue) => issue.id)
        )
      ).size
    ).toBe(2);
    expect(
      pipe(
        index.issues,
        A.map((issue) => issue.id)
      )
    ).toEqual([
      "feedback:test-test::test::package:@beep/repo-cli::0::feedback:test failed with exit code 1.",
      "feedback:test-test::test::package:@beep/schema::0::feedback:test failed with exit code 1.",
    ]);
  });

  it("extracts known sub-lane hints from broad proof failures", () => {
    const issues = prePushFailureIssues(context, "[beep-cli] lint:typos: typos\nerror: misspelling found");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "lint-tool",
      message: "full:pre-push failed in typos with exit code 1.",
      remediation:
        "Run the typos checker on the flagged files and fix the spelling, or whitelist intentional terms in `_typos.toml`.",
      subCategory: "typos",
    });
  });

  it("routes cheap-gate failures to the focused repair command", () => {
    const remediation = knownSubLaneRemediationFromOutput("[beep-cli] cheap-gates:effect-imports: failed in 1200ms");

    expect(O.getOrThrow(remediation)).toContain("bun run beep laws effect-imports --write");
    expect(O.getOrThrow(remediation)).toContain("cheap-gates tier");
  });

  it("prefers the failing tail when broad proof output mentions earlier successful lanes", () => {
    const step = RepoPlanStep.make({
      id: "full:review-fix",
      label: "full:review-fix",
      phase: "full",
      command: "bun",
      args: ["run", "beep", "quality", "github-checks", "review-fix"],
      cwd: "/repo",
      scope: "repo",
      mutability: "readonly",
      resume: "never",
    });
    const issues = qualityIssuesFromStepResult(
      context,
      step,
      RepoStepRunResult.make({
        stepId: step.id,
        commandText: "bun run beep quality github-checks review-fix",
        exitCode: 1,
        output:
          "[beep-cli] lint:terse-effect: bun run beep laws terse-effect --check\n" +
          "terse-effect: OK\n" +
          "[github-checks] review-fix: local docgen\n" +
          'docgen:local: full docgen proof required; re-run with "--full" to execute it.\n' +
          "review-fix:docgen-local failed with exit code 1.",
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "docgen-jsdoc-quality",
      message: "full:review-fix failed in docgen with exit code 1.",
      remediation: "Run `bun run docgen:local` for edit loops or `bun run docgen` for the full proof.",
      subCategory: "docgen",
    });
  });

  it("uses the workspace package catalog for full-proof diagnostic package attribution", () => {
    const fullContext = contextWithTasks(
      [turboTask("check")],
      [
        turboPackage("@beep/repo-cli", "packages/tooling/tool/cli"),
        turboPackage("@beep/schema", "packages/foundation/modeling/schema"),
      ]
    );
    const issues = prePushFailureIssues(
      fullContext,
      "packages/foundation/modeling/schema/src/example.ts:3:1 - error TS2322: nope"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      file: "packages/foundation/modeling/schema/src/example.ts",
      packageName: "@beep/schema",
      packagePath: "packages/foundation/modeling/schema",
    });
  });

  it("does not replace an unclassified failure with a later unrelated tail needle", () => {
    const issues = prePushFailureIssues(
      context,
      "test-utils test/integration/SqlTest.pglite.test.ts timed out after 60000ms\n" +
        "full:pre-push failed with exit code 1.\n" +
        "security:nix completed successfully"
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "command-failure",
      message: "full:pre-push failed with exit code 1.",
    });
    expect(issues[0]?.subCategory).not.toBe("nix");
    expect(issues[0]?.remediation).toBeUndefined();
  });

  it("extracts a sub-lane hint from the failure prefix before unrelated success tail", () => {
    const remediation = knownSubLaneRemediationFromOutput(
      "lint:typos failed: operator\n" +
        pipe(
          A.makeBy(16, (index) => `context line ${index}`),
          A.join("\n")
        ) +
        "\nfull:pre-push failed with exit code 1.\nsecurity:nix completed successfully"
    );

    expect(O.isSome(remediation)).toBe(true);
    expect(O.getOrUndefined(remediation)).toContain("typos");
  });

  it("extracts the changeset sub-lane hint with the package patch remedy", () => {
    const issues = prePushFailureIssues(
      context,
      "[beep-cli] quality:changeset-status: bun run changeset:status:since-main\nSome packages have been changed but no changesets were found."
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "changeset-policy",
      subCategory: "changeset-status",
    });
    expect(issues[0]?.remediation).toContain("each changed package with `patch`");
  });

  it("extracts the typos sub-lane hint from hook-style failures", () => {
    const step = RepoPlanStep.make({
      id: "commit:git:commit",
      label: "commit:git:commit",
      phase: "commit",
      command: "git",
      args: ["commit", "-m", "feat: example"],
      cwd: "/repo",
      scope: "repo",
      mutability: "publish",
      resume: "never",
    });
    const issues = qualityIssuesFromStepResult(
      context,
      step,
      RepoStepRunResult.make({
        stepId: step.id,
        commandText: "git commit -m 'feat: example'",
        exitCode: 1,
        output: "🥊 typos\nerror: `flagged-word` should be `corrected-word`\n  --> ./generated/report.html:1242:37",
      })
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "lint-tool",
      subCategory: "typos",
    });
    expect(issues[0]?.remediation).toContain("_typos.toml");
  });
});

describe("yeet monitor comments", () => {
  it("normalizes nullable GitHub payload fields before rendering", () => {
    const review = normalizeYeetMonitorReviewCommentForTesting(
      GhRestReviewComment.make({
        body: null,
        created_at: "2026-08-04T12:00:01.000Z",
        html_url: "https://github.com/o/r/pull/1#discussion_r43",
        id: 43,
        line: null,
        original_line: null,
        path: "src/Monitor.ts",
        user: null,
      })
    );
    const issue = normalizeYeetMonitorIssueCommentForTesting(
      GhRestIssueComment.make({
        body: "Ready for review.",
        created_at: "2026-08-04T12:00:02.000Z",
        html_url: "https://github.com/o/r/pull/1#issuecomment-44",
        id: 44,
        user: GhActor.make({ login: "octocat" }),
      })
    );

    expect(renderYeetMonitorComment(review)).toContain("unknown @ src/Monitor.ts:?");
    expect(renderYeetMonitorComment(issue)).toContain("new PR issue comment: octocat");
    expect(issue.body).toBe("Ready for review.");
  });

  it("uses timestamp and id as the in-memory comment watermark", () => {
    const cursor = YeetMonitorCommentCursor.make({ createdAt: "2026-08-04T12:00:01.000Z", id: 44 });
    const seen = YeetMonitorIssueComment.make({
      author: "octocat",
      body: "Already seen.",
      createdAt: "2026-08-04T12:00:01.000Z",
      id: 44,
      url: "https://github.com/o/r/pull/1#issuecomment-44",
    });
    const next = YeetMonitorIssueComment.make({
      author: "greptile-apps[bot]",
      body: "New comment.",
      createdAt: "2026-08-04T12:00:01.000Z",
      id: 45,
      url: "https://github.com/o/r/pull/1#issuecomment-45",
    });

    expect(isYeetMonitorCommentAfter(cursor, seen)).toBe(false);
    expect(isYeetMonitorCommentAfter(cursor, next)).toBe(true);
  });

  it("renders review location, compact body, author, and URL", () => {
    const output = renderYeetMonitorComment(
      YeetMonitorReviewComment.make({
        author: "greptile-apps[bot]",
        body: "Please preserve\n  the existing polling interval.",
        createdAt: "2026-08-04T12:00:01.000Z",
        id: 43,
        line: O.some(88),
        path: "src/Monitor.ts",
        url: "https://github.com/o/r/pull/1#discussion_r43",
      })
    );

    expect(output).toContain("[yeet] new PR review comment: greptile-apps[bot] @ src/Monitor.ts:88");
    expect(output).toContain("Please preserve the existing polling interval.");
    expect(output).toContain("https://github.com/o/r/pull/1#discussion_r43");
  });

  it("strips terminal control sequences from every remote comment field", () => {
    const output = renderYeetMonitorComment(
      YeetMonitorReviewComment.make({
        author: "greptile\u001b[31m-apps",
        body: "keep \u001b[32mvisible\u001b[0m \u001b]52;c;clipboard-canary\u0007 text\u009b31m",
        createdAt: "2026-08-04T12:00:01.000Z",
        id: 43,
        line: O.some(88),
        path: "src/Monitor\u001b]8;;https://malicious.example\u0007.ts",
        url: "https://github.com/o/r/pull/1\u0007#discussion_r43",
      })
    );

    expect(output).toContain("greptile-apps @ src/Monitor.ts:88");
    expect(output).toContain("keep visible text31m");
    expect(output).toContain("https://github.com/o/r/pull/1#discussion_r43");
    expect(output).not.toContain("clipboard-canary");
    expect(output).not.toContain("malicious.example");
    expect(output).not.toMatch(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u);
  });

  it("strips terminal control sequences from issue comments", () => {
    const output = renderYeetMonitorComment(
      YeetMonitorIssueComment.make({
        author: "reviewer\u001b[31m",
        body: "safe\u001b]52;c;clipboard-canary\u0007 body",
        createdAt: "2026-08-04T12:00:02.000Z",
        id: 44,
        url: "https://github.com/o/r/pull/1\u0007#issuecomment-44",
      })
    );

    expect(output).toContain("[yeet] new PR issue comment: reviewer");
    expect(output).toContain("safe body");
    expect(output).toContain("https://github.com/o/r/pull/1#issuecomment-44");
    expect(output).not.toContain("clipboard-canary");
  });
});

describe("yeet status helpers", () => {
  it("schema-decodes remote review-thread and rerun guidance", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const remote = YeetStatusRemote.make({
          available: true,
          checked: true,
          detail: "PR #42 OPEN",
          rerunFailedCommand: yeetRerunJobListingCommand(123),
          rerunFailedDecision: "same-SHA red candidate",
          unresolvedReviewThreadCount: 1,
          unresolvedReviewThreads: ["PRRT_1 (src/example.ts)"],
        });
        const encoded = yield* S.encodeEffect(YeetStatusRemote)(remote);
        const decoded = yield* S.decodeEffect(YeetStatusRemote)(encoded);

        expect(decoded.unresolvedReviewThreadCount).toBe(1);
        expect(decoded.rerunFailedCommand).toBe(yeetRerunJobListingCommand(123));
      })
    ));

  it("renders compact local status and suggests repair commands from verdict artifacts", () => {
    const verdict = YeetStatusArtifact.make({
      detail: "publish failure: proof failed",
      mode: "publish",
      outcome: "failure",
      path: ".beep/yeet/runs/feature/verdict.json",
      repairCommand: "Run `bun run docgen:local`.",
      schemaVersion: "yeet-verdict/v2",
      state: "present",
    });
    const closeout = YeetStatusArtifact.make({
      detail: "no closeout artifact found for this branch",
      path: ".beep/yeet/runs/feature/pr-closeout.json",
      state: "missing",
    });
    const remote = YeetStatusRemote.make({
      available: false,
      checked: false,
      detail: "pass --remote to include live GitHub PR data",
    });
    const worktree = YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 });
    const nextCommand = yeetStatusNextCommandForTesting(worktree, verdict, closeout, remote);
    const snapshot = YeetStatusSnapshot.make({
      base: "origin/main",
      branch: "feature",
      closeout,
      createdAt: "2026-06-11T00:00:00.000Z",
      head: "HEAD",
      nextCommand,
      remote,
      runId: "feature",
      schemaVersion: "yeet-status/v1",
      statusPath: ".beep/yeet/runs/feature/status.json",
      verdict,
      worktree,
    });

    expect(nextCommand).toBe("Run `bun run docgen:local`.");
    expect(renderYeetStatusSummary(snapshot)).toContain("- worktree: clean (0 staged, 0 unstaged, 0 untracked)");
    expect(renderYeetStatusSummary(snapshot)).toContain("- next: Run `bun run docgen:local`.");
  });

  it("suggests staged-only publish when local status sees a dirty worktree", () => {
    const command = yeetStatusNextCommandForTesting(
      YeetStatusWorktree.make({ clean: false, staged: 1, unstaged: 2, untracked: 3 }),
      YeetStatusArtifact.make({ detail: "missing", path: "verdict.json", state: "missing" }),
      YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" }),
      YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
    );

    expect(command).toContain("publish --staged-only --pr --monitor");
  });

  it("names unresolved threads and records the same-SHA rerun-failed decision", () => {
    const remote = YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "PR #42 OPEN",
      rerunFailedCommand: yeetRerunJobListingCommand(123),
      rerunFailedDecision: yeetRerunDecisionText("check"),
      unresolvedReviewThreadCount: 1,
      unresolvedReviewThreads: ["PRRT_1 (src/example.ts)"],
    });
    const command = yeetStatusNextCommandForTesting(
      YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
      YeetStatusArtifact.make({ detail: "success", outcome: "success", path: "verdict.json", state: "present" }),
      YeetStatusArtifact.make({ detail: "closed", issueCount: 0, path: "pr-closeout.json", state: "present" }),
      remote
    );

    expect(command).toContain(yeetRerunJobListingCommand(123));
    expect(command).not.toContain("merge the PR");
  });

  it("teaches only the job-scoped rerun form, never --failed", () => {
    const listing = yeetRerunJobListingCommand(123);
    expect(listing).toContain("gh run view 123 --json jobs");
    expect(listing).not.toContain("--failed");
    const decision = yeetRerunDecisionText("check");
    expect(decision).toContain("gh run rerun --job <databaseId>");
    expect(decision).toContain("never");
  });
});

describe("yeet attempt journal", () => {
  it("schema-decodes repository step timing fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* S.decodeEffect(RepoStepRunResult)({
          stepId: "feedback:check",
          commandText: "bun run check",
          exitCode: 0,
          startedAt: "2026-08-04T00:00:00.000Z",
          endedAt: "2026-08-04T00:00:01.000Z",
          elapsedMs: 1000,
        });

        expect(result.elapsedMs).toBe(1000);
      })
    ));

  it("reports an exhausted attempt-journal lock without appending", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const journalPath = path.join(tmpDir, "attempts.ndjson");
          yield* fs.writeFileString(`${journalPath}.lock`, `${process.pid}:live-holder`);

          const failure = yield* appendEncodedAttemptJournalEvent(journalPath, "{}", "attempt-started", 1).pipe(
            Effect.flip
          );

          expect(failure.message).toContain("stayed busy");
        })
      )
    ));

  it("schema-decodes events, retains 50 rows, and receipts every eviction", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          yield* Effect.forEach(
            A.makeBy(60, (index) => index),
            (index) =>
              appendYeetAttemptJournalEvent(
                tempContext,
                YeetAttemptStarted.make({
                  schemaVersion: "yeet-attempt-journal/v1",
                  _tag: "attempt-started",
                  attemptId: attemptUuid(`00000000-0000-4000-8000-${Str.padStart(12, "0")(`${index}`)}`),
                  runId: "repo-cli-yeet",
                  branch: "repo-cli-yeet",
                  base: "origin/main",
                  head: "HEAD",
                  mode: "verify",
                  startedAt: "2026-08-04T00:00:00.000Z",
                })
              ),
            { discard: true, concurrency: 1 }
          );
          const journalPath = yield* attemptJournalPath(tempContext);
          const lines = pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty));
          const events = yield* Effect.forEach(lines, (line) => decodeYeetAttemptJournalEvent(line));

          expect(events).toHaveLength(50);
          const starts = A.filter(events, YeetAttemptJournalEvent.guards["attempt-started"]);
          const receipts = A.filter(events, YeetAttemptJournalEvent.guards["journal-compacted"]);
          expect(starts).toHaveLength(49);
          expect(starts[0]?.attemptId).toBe("00000000-0000-4000-8000-000000000011");
          expect(starts[48]?.attemptId).toBe("00000000-0000-4000-8000-000000000059");
          expect(receipts).toHaveLength(1);
          expect(receipts[0]).toMatchObject({
            evictedCount: 2,
            oldestEvictedRecordedAt: "2026-08-04T00:00:00.000Z",
          });
        })
      )
    ));

  it("compacts mixed legacy and current event shapes through the same bounded journal", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const journalPath = yield* attemptJournalPath(tempContext);
          const fixtureRoot = path.join(repoRoot, "packages/tooling/tool/cli/test/fixtures");
          const fixtureLines = pipe(
            yield* Effect.forEach(
              ["yeet-attempt-journal-legacy.ndjson", "yeet-attempt-journal-current.ndjson"],
              (name) =>
                fs
                  .readFileString(path.join(fixtureRoot, name))
                  .pipe(Effect.map((text) => pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty))))
            ),
            A.flatten
          );
          const seededLines = pipe(
            A.makeBy(15, () => fixtureLines),
            A.flatten
          );
          yield* fs.makeDirectory(path.dirname(journalPath), { recursive: true });
          yield* fs.writeFileString(journalPath, `${A.join(seededLines, "\n")}\n`);

          yield* appendYeetAttemptJournalEvent(
            tempContext,
            YeetAttemptStarted.make({
              schemaVersion: "yeet-attempt-journal/v1",
              _tag: "attempt-started",
              attemptId: attemptUuid("00000000-0000-4000-8000-000000000099"),
              runId: "post-compaction",
              branch: "post-compaction",
              base: "origin/main",
              head: "HEAD",
              mode: "verify",
              startedAt: "2026-09-03T00:00:03.000Z",
            })
          );

          const events = yield* Effect.forEach(
            pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty)),
            (line) => decodeYeetAttemptJournalEvent(line)
          );
          expect(events.length).toBeLessThanOrEqual(50);
          expect(A.filter(events, YeetAttemptJournalEvent.guards["journal-compacted"])).toHaveLength(1);
          expect(A.some(events, YeetAttemptJournalEvent.guards["attempt-terminated"])).toBe(true);
        })
      )
    ));

  it("compacts complete start and terminal pairs as one retention unit", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          yield* Effect.forEach(
            A.makeBy(30, (index) => index),
            (index) => {
              const attemptId = attemptUuid(`00000000-0000-4000-8001-${Str.padStart(12, "0")(`${index}`)}`);
              return Effect.all(
                [
                  appendYeetAttemptJournalEvent(
                    tempContext,
                    YeetAttemptStarted.make({
                      schemaVersion: "yeet-attempt-journal/v1",
                      _tag: "attempt-started",
                      attemptId,
                      runId: `paired-${index}`,
                      branch: "paired-compaction",
                      base: "origin/main",
                      head: "HEAD",
                      mode: "verify",
                      startedAt: "2026-09-03T00:00:00.000Z",
                    })
                  ),
                  appendYeetAttemptJournalEvent(
                    tempContext,
                    YeetAttemptTerminated.make({
                      schemaVersion: "yeet-attempt-journal/v1",
                      _tag: "attempt-terminated",
                      attemptId,
                      recordedAt: "2026-09-03T00:00:01.000Z",
                      reason: "interrupted",
                    })
                  ),
                ],
                { concurrency: 1, discard: true }
              );
            },
            { concurrency: 1, discard: true }
          );

          const text = yield* fs.readFileString(yield* attemptJournalPath(tempContext));
          const events = yield* Effect.forEach(pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty)), (line) =>
            decodeYeetAttemptJournalEvent(line)
          );
          const starts = A.filter(events, YeetAttemptJournalEvent.guards["attempt-started"]);
          const terminals = A.filter(events, YeetAttemptJournalEvent.guards["attempt-terminated"]);
          expect(events.length).toBeLessThanOrEqual(50);
          expect(starts).toHaveLength(terminals.length);
          expect(
            A.every(starts, (start) => A.some(terminals, (terminal) => terminal.attemptId === start.attemptId))
          ).toBe(true);
          expect(
            A.every(terminals, (terminal) => A.some(starts, (start) => start.attemptId === terminal.attemptId))
          ).toBe(true);
        })
      )
    ));

  it("reconciles dead attempt owners without closing a live pid and start-time identity", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const journalPath = yield* attemptJournalPath(tempContext);
          const ownerProcStart = pipe(yield* processStartIdentityForPid(process.pid), O.getOrThrow);
          const deadAttemptId = attemptUuid("00000000-0000-4000-8002-000000000001");
          const liveAttemptId = attemptUuid("00000000-0000-4000-8002-000000000002");
          const started = (attemptId: UUID, ownerPid: number, procStart: string) =>
            YeetAttemptStarted.make({
              schemaVersion: "yeet-attempt-journal/v1",
              _tag: "attempt-started",
              attemptId,
              runId: `owner-${ownerPid}`,
              branch: "owner-reconciliation",
              base: "origin/main",
              head: "HEAD",
              mode: "repair",
              startedAt: "2026-09-03T00:00:00.000Z",
              ownerPid: O.some(ownerPid),
              ownerProcStart: O.some(procStart),
              resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
              diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
              proofTier: O.some("cheap-gates"),
              envProfile: O.some("local"),
              stage: O.some("repair-loop"),
            });
          const encodeStarted = S.encodeEffect(S.fromJsonString(YeetAttemptStarted));
          const lines = yield* Effect.forEach(
            [started(deadAttemptId, DEAD_PID, "fake-dead-owner"), started(liveAttemptId, process.pid, ownerProcStart)],
            (event) => encodeStarted(event)
          );
          yield* fs.makeDirectory(path.dirname(journalPath), { recursive: true });
          yield* fs.writeFileString(journalPath, `${A.join(lines, "\n")}\n`);
          yield* fs.writeFileString(path.join(tmpDir, ".beep", "yeet", "runs", "ignored.txt"), "ignored\n");

          expect(yield* reconcileAttemptJournalsForCheckout(tmpDir)).toBe(1);
          expect(yield* reconcileAttemptJournalsForCheckout(tmpDir)).toBe(0);
          const events = yield* Effect.forEach(
            pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty)),
            (line) => decodeYeetAttemptJournalEvent(line)
          );
          const terminals = A.filter(events, YeetAttemptJournalEvent.guards["attempt-terminated"]);
          expect(terminals).toHaveLength(1);
          expect(terminals[0]).toMatchObject({
            attemptId: deadAttemptId,
            reason: "owner-dead",
            resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
            diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
            proofTier: O.some("cheap-gates"),
            envProfile: O.some("local"),
            stage: O.some("repair-loop"),
          });
          expect(A.some(terminals, (terminal) => terminal.attemptId === liveAttemptId)).toBe(false);
        })
      )
    ));

  it("returns zero for a missing journal and refuses a live lock generation", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const journalPath = path.join(tmpDir, "attempts.ndjson");
          expect(yield* reconcileAttemptJournal(journalPath)).toBe(0);

          yield* fs.writeFileString(journalPath, "");
          const lockPath = `${journalPath}.lock`;
          const lockToken = `${process.pid}:00000000-0000-4000-8000-000000000123`;
          expect(yield* acquireJournalFileLock(lockPath, lockToken, 1)).toBe(true);
          const error = yield* reconcileAttemptJournal(journalPath).pipe(
            Effect.flip,
            Effect.ensuring(releaseJournalFileLock(lockPath, lockToken))
          );
          expect(error.message).toContain("stayed busy; could not reconcile owners");
        })
      )
    ));

  it("reconciles an old dead start before explicit and append-time compaction", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const journalPath = yield* attemptJournalPath(tempContext);
          const deadAttemptId = attemptUuid("00000000-0000-4000-8003-000000000000");
          const encodeStarted = S.encodeEffect(S.fromJsonString(YeetAttemptStarted));
          const starts = yield* Effect.forEach(
            A.makeBy(55, (index) => index),
            (index) =>
              encodeStarted(
                YeetAttemptStarted.make({
                  schemaVersion: "yeet-attempt-journal/v1",
                  _tag: "attempt-started",
                  attemptId: attemptUuid(`00000000-0000-4000-8003-${Str.padStart(12, "0")(`${index}`)}`),
                  runId: `over-limit-${index}`,
                  branch: "over-limit-reconciliation",
                  base: "origin/main",
                  head: "HEAD",
                  mode: "repair",
                  startedAt: `2026-09-03T00:00:${Str.padStart(2, "0")(`${index}`)}.000Z`,
                  ownerPid: index === 0 ? O.some(DEAD_PID) : O.none(),
                  ownerProcStart: index === 0 ? O.some("dead-before-compaction") : O.none(),
                  resolvedHeadSha: index === 0 ? O.some("0123456789abcdef0123456789abcdef01234567") : O.none(),
                  diffFingerprint:
                    index === 0 ? O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd") : O.none(),
                  proofTier: index === 0 ? O.some("cheap-gates") : O.none(),
                  envProfile: index === 0 ? O.some("local") : O.none(),
                  stage: index === 0 ? O.some("repair-loop") : O.none(),
                })
              )
          );
          yield* fs.makeDirectory(path.dirname(journalPath), { recursive: true });
          const writeOverLimitJournal = fs.writeFileString(journalPath, `${A.join(starts, "\n")}\n`);
          const readDeadPair = Effect.gen(function* () {
            const events = yield* Effect.forEach(
              pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty)),
              (line) => decodeYeetAttemptJournalEvent(line)
            );
            expect(events.length).toBeLessThanOrEqual(50);
            expect(
              A.some(
                events,
                (event) => YeetAttemptJournalEvent.guards["attempt-started"](event) && event.attemptId === deadAttemptId
              )
            ).toBe(true);
            const terminal = pipe(
              events,
              A.findFirst(
                (event) =>
                  YeetAttemptJournalEvent.guards["attempt-terminated"](event) && event.attemptId === deadAttemptId
              ),
              O.getOrThrow
            );
            expect(terminal).toMatchObject({ reason: "owner-dead" });
          });

          yield* writeOverLimitJournal;
          expect(yield* reconcileAttemptJournal(journalPath)).toBe(1);
          yield* readDeadPair;

          yield* writeOverLimitJournal;
          yield* appendYeetAttemptJournalEvent(
            tempContext,
            YeetAttemptStarted.make({
              schemaVersion: "yeet-attempt-journal/v1",
              _tag: "attempt-started",
              attemptId: attemptUuid("00000000-0000-4000-8003-000000000099"),
              runId: "append-trigger",
              branch: "over-limit-reconciliation",
              base: "origin/main",
              head: "HEAD",
              mode: "repair",
              startedAt: "2026-09-03T00:01:00.000Z",
            })
          );
          yield* readDeadPair;
        })
      )
    ));

  it("serializes concurrent appenders while compacting the bounded journal", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const attemptStarted = (index: number) =>
            YeetAttemptStarted.make({
              schemaVersion: "yeet-attempt-journal/v1",
              _tag: "attempt-started",
              attemptId: attemptUuid(`00000000-0000-4000-8000-${Str.padStart(12, "0")(`${index}`)}`),
              runId: "repo-cli-yeet",
              branch: "repo-cli-yeet",
              base: "origin/main",
              head: "HEAD",
              mode: "verify",
              startedAt: "2026-09-03T00:00:00.000Z",
            });
          yield* Effect.forEach(
            A.makeBy(50, attemptStarted),
            (event) => appendYeetAttemptJournalEvent(tempContext, event),
            {
              discard: true,
              concurrency: 1,
            }
          );
          const concurrent = A.makeBy(10, (offset) => attemptStarted(100 + offset));
          yield* Effect.forEach(concurrent, (event) => appendYeetAttemptJournalEvent(tempContext, event), {
            discard: true,
            concurrency: "unbounded",
          });

          const journalPath = yield* attemptJournalPath(tempContext);
          const lines = pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty));
          const events = yield* Effect.forEach(lines, (line) => decodeYeetAttemptJournalEvent(line));
          const starts = A.filter(events, YeetAttemptJournalEvent.guards["attempt-started"]);
          const retainedIds = A.map(starts, (event) => event.attemptId);

          expect(events).toHaveLength(50);
          expect(starts).toHaveLength(49);
          expect(A.length(A.dedupe(retainedIds))).toBe(49);
          expect(A.every(concurrent, (event) => A.contains(retainedIds, event.attemptId))).toBe(true);
          expect(yield* fs.exists(`${journalPath}.lock`)).toBe(false);
        })
      )
    ));

  it("recovers from a torn trailing record instead of bricking later attempts", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
          const journalPath = yield* attemptJournalPath(tempContext);
          const attemptStarted = (index: number) =>
            YeetAttemptStarted.make({
              schemaVersion: "yeet-attempt-journal/v1",
              _tag: "attempt-started",
              attemptId: attemptUuid(`00000000-0000-4000-8000-${Str.padStart(12, "0")(`${index}`)}`),
              runId: "repo-cli-yeet",
              branch: "repo-cli-yeet",
              base: "origin/main",
              head: "HEAD",
              mode: "verify",
              startedAt: "2026-08-04T00:00:00.000Z",
            });

          yield* appendYeetAttemptJournalEvent(tempContext, attemptStarted(1));
          const intact = yield* fs.readFileString(journalPath);
          yield* fs.writeFileString(journalPath, `${intact}{"schemaVersion":"yeet-attempt-jour`);

          yield* appendYeetAttemptJournalEvent(tempContext, attemptStarted(2));

          const lines = pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty));
          const events = yield* Effect.forEach(lines, (line) => decodeYeetAttemptJournalEvent(line));

          expect(events).toHaveLength(2);
          const starts = A.filter(events, YeetAttemptJournalEvent.guards["attempt-started"]);
          expect(starts[0]?.attemptId).toBe("00000000-0000-4000-8000-000000000001");
          expect(starts[1]?.attemptId).toBe("00000000-0000-4000-8000-000000000002");
        })
      )
    ));

  it("decodes every fixture row and every live worktree attempt row", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const fixtureRoot = path.join(repoRoot, "packages/tooling/tool/cli/test/fixtures");
        const fixturePaths = pipe(
          yield* fs.readDirectory(fixtureRoot),
          A.filter((name) => Str.startsWith("yeet-attempt-journal-")(name) && Str.endsWith(".ndjson")(name)),
          A.map((name) => path.join(fixtureRoot, name))
        );
        const liveRoot = path.join(repoRoot, ".beep/yeet/runs");
        const livePaths = (yield* fs.exists(liveRoot))
          ? pipe(
              yield* fs.readDirectory(liveRoot, { recursive: true }),
              A.filter(Str.endsWith("attempts.ndjson")),
              A.map((name) => path.join(liveRoot, name))
            )
          : A.empty<string>();
        const journalPaths = A.appendAll(fixturePaths, livePaths);
        expect(A.length(fixturePaths)).toBeGreaterThanOrEqual(2);
        const decoded = yield* Effect.forEach(
          journalPaths,
          Effect.fnUntraced(function* (journalPath) {
            const lines = pipe(yield* fs.readFileString(journalPath), Str.split("\n"), A.filter(Str.isNonEmpty));
            return yield* Effect.forEach(lines, (line) => decodeYeetAttemptJournalEvent(line));
          })
        );
        const events = A.flatten(decoded);
        const starts = A.filter(events, YeetAttemptJournalEvent.guards["attempt-started"]);
        const legacy = pipe(
          starts,
          A.findFirst((event) => event.runId === "legacy-run"),
          O.getOrThrow
        );
        const current = pipe(
          starts,
          A.findFirst((event) => event.runId === "current-run"),
          O.getOrThrow
        );
        expect(legacy.resolvedHeadSha).toStrictEqual(O.none());
        expect(legacy.diffFingerprint).toStrictEqual(O.none());
        expect(legacy.proofTier).toStrictEqual(O.none());
        expect(current.resolvedHeadSha).toStrictEqual(O.some("0123456789abcdef0123456789abcdef01234567"));
        expect(current.proofTier).toStrictEqual(O.some("full"));
      }).pipe(provideScopedLayer(PlatformLayer))
    ));
});

describe("yeet publish scope helpers", () => {
  it.effect("refuses publish on main before any publish plan can push", () =>
    Effect.gen(function* () {
      const mainContext = RepoRunContext.make({ ...context, branch: "main" });
      const error = yield* validatePublishBranchForTesting(
        mainContext,
        defaultYeetRunOptions({ message: "ci(trunk): guard main publish" })
      ).pipe(Effect.flip);

      expect(error.message).toContain('yeet publish is PR-branch-only; refusing to publish directly from "main"');
      expect(error.command).toBe("git switch -c <feature-branch> origin/main");
    })
  );

  it("summarizes refused paths with counts, top-level entries, and capped examples", () => {
    const paths = pipe(
      A.makeBy(14, (index) => `generated/wiki/page-${Str.padStart(2, "0")(`${index}`)}.md`),
      A.appendAll(["notes.txt", "docs/guide.md"])
    );
    const summary = summarizePublishPathsForTesting(paths);

    expect(summary).toContain("16 path(s) across 3 top-level entries: docs, generated, notes.txt");
    expect(summary).toContain("  - docs/guide.md");
    expect(summary).toContain("(+6 more; full list in the failure packet)");
    expect(Str.split("\n")(summary).length).toBeLessThanOrEqual(12);
  });

  it("summarizes a single path without an overflow marker", () => {
    const summary = summarizePublishPathsForTesting(["src/index.ts"]);

    expect(summary).toContain("1 path(s) across 1 top-level entry: src");
    expect(summary).toContain("  - src/index.ts");
    expect(summary).not.toContain("more; full list");
  });

  it("returns staged paths that also carry unstaged modifications", () => {
    expect(partiallyStagedPathsForTesting(["a.ts", "b.ts", "c.ts"], ["b.ts", "d.ts"])).toEqual(["b.ts"]);
    expect(partiallyStagedPathsForTesting(["a.ts"], [])).toEqual([]);
    expect(partiallyStagedPathsForTesting([], ["a.ts"])).toEqual([]);
  });

  it("decodes both publish intent states", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const staged = yield* S.decodeEffect(YeetPublishIntent)({ kind: "staged", paths: ["src/a.ts"] });
        const existing = yield* S.decodeEffect(YeetPublishIntent)({
          commitSha: "abc123",
          kind: "existing-commit",
          paths: ["src/a.ts"],
        });

        expect(staged).toBeInstanceOf(YeetStagedPublishIntent);
        expect(existing).toBeInstanceOf(YeetExistingCommitPublishIntent);
      })
    ));

  it("accepts a clean local commit ahead of the publish remote/base", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* runGit(tmpDir, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
          yield* fs.writeFileString(filePath, "committed ahead\n");
          yield* runGit(tmpDir, ["add", "tracked.txt"]);
          yield* runGit(tmpDir, ["commit", "-m", "test: committed ahead"]);

          const intent = yield* collectPublishIntent(tempContext, false);

          expect(intent).toBeInstanceOf(YeetExistingCommitPublishIntent);
          if (intent.kind === "existing-commit") {
            expect(intent.paths).toEqual(["tracked.txt"]);
            expect(intent.commitSha).toBe(Str.trim(yield* runGitCapture(tmpDir, ["rev-parse", "HEAD"])));
          }
        })
      )
    ));

  it("rejects dirty, contained, and no-ahead clean trees as existing-commit intent", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* runGit(tmpDir, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

          const noAhead = yield* collectPublishIntent(tempContext, false).pipe(Effect.flip);
          expect(noAhead.message).toContain("requires reviewed staged changes or a clean local commit ahead");

          yield* fs.writeFileString(filePath, "dirty\n");
          const dirty = yield* collectPublishIntent(tempContext, false).pipe(Effect.flip);
          expect(dirty.message).toContain("requires reviewed staged changes or a clean local commit ahead");

          yield* runGit(tmpDir, ["add", "tracked.txt"]);
          yield* runGit(tmpDir, ["commit", "-m", "test: committed ahead"]);
          yield* runGit(tmpDir, ["update-ref", "refs/remotes/origin/repo-cli-yeet", "HEAD"]);
          const contained = yield* collectPublishIntent(tempContext, false).pipe(Effect.flip);
          expect(contained.message).toContain("requires reviewed staged changes or a clean local commit ahead");
        })
      )
    ));

  it("returns branch paths that were also changed on the base since merge-base", () => {
    expect(overlappingBasePathsForTesting(["src/a.ts", "src/b.ts"], ["src/b.ts", "src/c.ts"])).toEqual(["src/b.ts"]);
    expect(overlappingBasePathsForTesting(["src/a.ts"], ["src/c.ts"])).toEqual([]);
    expect(overlappingBasePathsForTesting([], ["src/c.ts"])).toEqual([]);
  });

  it("plans publish --pr with the create step after the push", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.some("feat(repo-cli): add yeet"), pr: true });
    const labels = pipe(
      plan.steps,
      A.map((step) => step.label)
    );
    expect(labels).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "full:cheap-gates",
      "full:pre-push",
      "full:ci-parity",
      "publish:head-install-preflight",
      "publish:git:push",
      "publish:pr-create",
    ]);
    expect(findStep(plan.steps, "publish:pr-create").command).toBe("gh");
  });

  it("plans start-pr-early --pr with the create step after the early push", () => {
    const plan = buildYeetRunPlanForTesting({
      context,
      message: O.some("feat(repo-cli): add yeet"),
      monitor: true,
      pr: true,
      startPrEarly: true,
    });
    const labels = pipe(
      plan.steps,
      A.map((step) => step.label)
    );
    expect(labels).toEqual([
      "fallow-advisory-feedback",
      "commit:git:commit",
      "publish:head-install-preflight",
      "early-publish:git:push",
      "publish:pr-create",
      "full:cheap-gates",
      "full:pre-push",
      "full:ci-parity",
      "monitor:pr-context",
      "monitor:pr-checks:watch",
    ]);
  });

  it.effect("requires explicit --pr before start-pr-early can reach commit or push", () =>
    Effect.gen(function* () {
      const error = yield* validateMonitorGuards(
        context,
        defaultYeetRunOptions({
          message: "test(repo-cli): probe early publish",
          monitor: true,
          startPrEarly: true,
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("requires --pr");
      expect(error.message).toContain("Add `--pr` and retry");

      yield* validateMonitorGuards(
        context,
        defaultYeetRunOptions({
          message: "test(repo-cli): probe early publish",
          monitor: true,
          pr: true,
          startPrEarly: true,
        })
      );
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("surfaces the clean-HEAD frozen-install repair hint and removes its temp worktree", () =>
    withTempDirectory((tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* runGit(tmpDir, ["init"]);
        yield* runGit(tmpDir, ["config", "user.email", "yeet@example.test"]);
        yield* runGit(tmpDir, ["config", "user.name", "Yeet Test"]);
        yield* fs.writeFileString(path.join(tmpDir, "package.json"), '{"name":"head-install-probe","private":true}\n');
        yield* fs.writeFileString(path.join(tmpDir, "bun.lock"), "not a bun lockfile\n");
        yield* runGit(tmpDir, ["add", "package.json", "bun.lock"]);
        yield* runGit(tmpDir, ["commit", "-m", "test: invalid committed lockfile"]);

        const tempContext = RepoRunContext.make({ ...context, cwd: tmpDir, repoRoot: tmpDir });
        const plan = buildYeetRunPlanForTesting({ context: tempContext, message: O.none(), mode: "verify" });
        const step = findStep(plan.steps, "publish:head-install-preflight");
        const result = yield* executeStepWithArtifacts(tempContext, step).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ XDG_CACHE_HOME: path.join(tmpDir, "cache") })
          )
        );

        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain("Frozen-lockfile clean-HEAD install preflight failed");
        expect(knownSubLaneRemediationFromOutput(result.output)).toEqual(
          O.some(
            "Commit or restage the required lockfile and manifest changes; if needed, run `bun install` and restage `bun.lock`."
          )
        );
        expect(yield* runGitCapture(tmpDir, ["worktree", "list", "--porcelain"])).not.toContain(
          "beep-yeet-head-install-"
        );
      })
    )
  );

  it("builds a verdict with hint-derived repair commands and not-run lanes", () => {
    const proofStep = RepoPlanStep.make({
      id: "full:pre-push",
      label: "full:pre-push",
      phase: "full",
      command: "bun",
      args: ["run", "beep", "quality", "github-checks", "pre-push"],
      cwd: "/repo",
      scope: "repo",
      mutability: "readonly",
      resume: "never",
    });
    const pushStep = RepoPlanStep.make({
      id: "publish:01-git-push",
      label: "publish:git:push",
      phase: "publish",
      command: "git",
      args: ["push", "-u", "origin", "HEAD"],
      cwd: "/repo",
      scope: "git",
      mutability: "publish",
      resume: "never",
    });
    const verdict = buildYeetVerdictForTesting(
      BuildYeetVerdictInput.make({
        attemptId: O.some(attemptUuid("550e8400-e29b-41d4-a716-446655440000")),
        base: "origin/main",
        branch: "feature",
        createdAt: "2026-06-11T00:00:00.000Z",
        startedAt: O.some("2026-06-11T00:00:00.000Z"),
        endedAt: O.some("2026-06-11T00:00:00.012Z"),
        elapsedMs: O.some(12),
        executed: [
          YeetExecutedStep.make({
            durationMs: 12,
            result: RepoStepRunResult.make({
              stepId: proofStep.id,
              commandText: "bun run beep quality github-checks pre-push",
              exitCode: 1,
              output: "[beep-cli] lint:typos: typos\nerror: misspelling found",
            }),
            step: proofStep,
          }),
        ],
        innerLaneReports: [
          QualityTaskLaneRunReport.make({
            schemaVersion: "quality-task-lane-run/v1",
            parentLaneId: O.some(proofStep.id),
            lanes: [
              QualityTaskLaneRun.make({
                id: "quality:lint",
                label: "quality:lint",
                status: "failed",
                inputDigest: O.none(),
              }),
              QualityTaskLaneRun.make({
                id: "quality:docgen",
                label: "quality:docgen",
                status: "not-run-early-stop",
                inputDigest: O.none(),
              }),
            ],
          }),
        ],
        head: "HEAD",
        message: "yeet publish proof failed after creating the local commit.",
        mode: "publish",
        outcome: "failure",
        failedStepId: proofStep.id,
        failureKind: "step-exit",
        packetPaths: [],
        planned: [proofStep, pushStep],
        runId: "feature",
      })
    );

    expect(verdict.outcome).toBe("failure");
    expect(verdict.committed).toBe(false);
    expect(verdict.pushed).toBe(false);
    expect(verdict.failurePolicy).toBe("fail-fast");
    expect(verdict.failedStepId).toBe(proofStep.id);
    expect(verdict.failureKind).toBe("step-exit");
    expect(verdict.lanes).toHaveLength(4);
    expect(verdict.lanes[0]).toMatchObject({
      id: "full:pre-push",
      durationMs: 12,
      repairCommand:
        "Run the typos checker on the flagged files and fix the spelling, or whitelist intentional terms in `_typos.toml`.",
      status: "failed",
    });
    expect(verdict.lanes[1]).toMatchObject({ id: "quality:lint", status: "failed" });
    expect(verdict.lanes[2]).toMatchObject({ id: "quality:docgen", status: "not-run-early-stop" });
    expect(verdict.lanes[3]).toMatchObject({ id: "publish:01-git-push", status: "not-run" });
  });

  it("round-trips the verdict schema and marks executed push lanes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const pushStep = RepoPlanStep.make({
          id: "publish:01-git-push",
          label: "publish:git:push",
          phase: "publish",
          command: "git",
          args: ["push", "-u", "origin", "HEAD"],
          cwd: "/repo",
          scope: "git",
          mutability: "publish",
          resume: "never",
        });
        const verdict = buildYeetVerdictForTesting(
          BuildYeetVerdictInput.make({
            attemptId: O.some(attemptUuid("550e8400-e29b-41d4-a716-446655440001")),
            base: "origin/main",
            branch: "feature",
            createdAt: "2026-06-11T00:00:00.000Z",
            startedAt: O.some("2026-06-11T00:00:00.000Z"),
            endedAt: O.some("2026-06-11T00:00:00.010Z"),
            elapsedMs: O.some(10),
            executed: [
              YeetExecutedStep.make({
                result: RepoStepRunResult.make({
                  stepId: pushStep.id,
                  commandText: "git push -u origin HEAD",
                  exitCode: 0,
                  output: "",
                }),
                step: pushStep,
              }),
            ],
            head: "HEAD",
            message: "yeet publish succeeded.",
            mode: "publish",
            outcome: "success",
            packetPaths: [],
            planned: [pushStep],
            runId: "feature",
          })
        );

        expect(verdict.pushed).toBe(true);
        const encoded = yield* S.encodeEffect(YeetVerdict)(verdict);
        const decoded = yield* S.decodeEffect(YeetVerdict)(encoded);
        expect(decoded.lanes[0]?.status).toBe("passed");
        expect(decoded.schemaVersion).toBe("yeet-verdict/v2");
      })
    ));

  it("projects durable wrapper lane facts without parsing bounded output or guessing a digest", () => {
    const wrapper = RepoPlanStep.make({
      id: "full:ci-parity",
      label: "full:ci-parity",
      phase: "full",
      command: "bun",
      args: ["run", "beep", "ci", "local"],
      cwd: "/repo",
      scope: "repo",
      mutability: "readonly",
      resume: "never",
    });
    const report = QualityTaskLaneRunReport.make({
      schemaVersion: "quality-task-lane-run/v1",
      parentLaneId: O.some(wrapper.id),
      lanes: [
        QualityTaskLaneRun.make({
          id: "check",
          label: "ci:check",
          status: "passed",
          startedAt: O.some("2026-09-03T00:00:00.000Z"),
          endedAt: O.some("2026-09-03T00:00:01.000Z"),
          durationMs: O.some(1000),
          exitCode: O.some(0),
          inputDigest: O.none(),
        }),
      ],
    });
    const verdict = buildYeetVerdictForTesting(
      BuildYeetVerdictInput.make({
        base: "origin/main",
        branch: "feature",
        createdAt: "2026-09-03T00:00:01.000Z",
        executed: [
          YeetExecutedStep.make({
            result: RepoStepRunResult.make({
              stepId: wrapper.id,
              commandText: "bun run beep ci local",
              exitCode: 0,
              output: "[beep-quality-task-lane-run] {truncated",
            }),
            step: wrapper,
          }),
        ],
        innerLaneReports: [report],
        head: "0123456789abcdef0123456789abcdef01234567",
        message: "yeet verify succeeded.",
        mode: "verify",
        outcome: "success",
        packetPaths: [],
        planned: [wrapper],
        proofTier: O.some("full"),
        runId: "feature",
      })
    );

    expect(verdict.lanes[1]).toMatchObject({
      id: "check",
      label: "ci:check",
      phase: "full",
      status: "passed",
      durationMs: 1000,
      exitCode: 0,
    });
    expect(verdict.lanes[1]?.tier).toStrictEqual(O.some("full"));
    expect(verdict.lanes[1]?.startedAt).toStrictEqual(O.some("2026-09-03T00:00:00.000Z"));
    expect(verdict.lanes[1]?.endedAt).toStrictEqual(O.some("2026-09-03T00:00:01.000Z"));
    expect(verdict.lanes[1]?.inputDigest).toStrictEqual(O.none());
  });

  it("keeps pushed false when only the publish-phase install preflight succeeded", () => {
    const preflightStep = RepoPlanStep.make({
      id: "publish:00-head-install-preflight",
      label: "publish:head-install-preflight",
      phase: "publish",
      command: "bun",
      args: ["install", "--frozen-lockfile"],
      cwd: "/repo",
      scope: "repo",
      mutability: "readonly",
      resume: "never",
    });
    const verdict = buildYeetVerdictForTesting(
      BuildYeetVerdictInput.make({
        base: "origin/main",
        branch: "feature",
        createdAt: "2026-06-11T00:00:00.000Z",
        executed: [
          YeetExecutedStep.make({
            result: RepoStepRunResult.make({
              stepId: preflightStep.id,
              commandText: "bun install --frozen-lockfile",
              exitCode: 0,
              output: "",
            }),
            step: preflightStep,
          }),
        ],
        head: "HEAD",
        message: "yeet publish proof failed.",
        mode: "publish",
        outcome: "failure",
        packetPaths: [],
        planned: [preflightStep],
        runId: "feature",
      })
    );

    expect(verdict.pushed).toBe(false);
    expect(O.isNone(verdict.attemptId)).toBe(true);
  });

  it("property: verdict schema round-trips arbitrary verdicts", () => {
    const VerdictArbitrary = S.toArbitrary(YeetVerdict)(fc);
    fc.assert(
      fc.property(VerdictArbitrary, (verdict) => {
        const encoded = S.encodeSync(YeetVerdict)(verdict);
        const decoded = S.decodeSync(YeetVerdict)(encoded);
        expect(decoded.schemaVersion).toBe("yeet-verdict/v2");
        expect(decoded.lanes.length).toBe(verdict.lanes.length);
        expect(decoded.outcome).toBe(verdict.outcome);
      }),
      fcRuns(32)
    );
  });

  it("parks and restores staged-only residue through a marked stash", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          yield* fs.writeFileString(filePath, "residue\n");
          yield* fs.writeFileString(path.join(tmpDir, "untracked.txt"), "wip\n");

          const stash = yield* stashUnstagedWorktreeForTesting(tempContext);
          expect(O.isSome(stash)).toBe(true);

          const cleanStatus = yield* runGitStatus(tmpDir);
          expect(cleanStatus).toBe("");

          if (O.isSome(stash)) {
            expect(stash.value.marker).toContain("yeet-staged-only/");
            yield* restoreStashedWorktreeForTesting(tempContext, stash.value);
          }

          const restored = yield* fs.readFileString(path.join(tmpDir, "tracked.txt"));
          const untrackedExists = yield* fs.exists(path.join(tmpDir, "untracked.txt"));
          expect(restored).toBe("residue\n");
          expect(untrackedExists).toBe(true);
        })
      )
    ));

  it("keeps the stash and reports instead of failing when the pop conflicts", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          yield* fs.writeFileString(filePath, "residue\n");
          const stash = yield* stashUnstagedWorktreeForTesting(tempContext);
          expect(O.isSome(stash)).toBe(true);

          yield* fs.writeFileString(filePath, "conflicting\n");
          yield* runGit(tmpDir, ["add", "tracked.txt"]);
          yield* runGit(tmpDir, ["commit", "-m", "conflicting change"]);

          if (O.isSome(stash)) {
            yield* restoreStashedWorktreeForTesting(tempContext, stash.value);
          }

          const stashList = yield* runGitOutputLines(tmpDir, ["stash", "list"]);
          expect(stashList.join("\n")).toContain("yeet-staged-only/");
        })
      )
    ));

  it("restores parked residue when a step in the pre-commit window fails", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          yield* fs.writeFileString(filePath, "residue\n");
          const stash = yield* stashUnstagedWorktreeForTesting(tempContext);
          expect(O.isSome(stash)).toBe(true);
          const parkedStatus = yield* runGitStatus(tmpDir);
          expect(parkedStatus).toBe("");

          const refusal = yield* Effect.fail(
            YeetCommandError.make({ exitCode: 1, message: "publish refused the staged index" })
          ).pipe(restorePublishStashOnFailure({ context: tempContext, stash }), Effect.flip);

          expect(refusal.message).toContain("publish refused the staged index");
          const restored = yield* fs.readFileString(filePath);
          expect(restored).toBe("residue\n");
        })
      )
    ));

  it("leaves the stash parked when the guarded pre-commit window succeeds", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ filePath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          yield* fs.writeFileString(filePath, "residue\n");
          const stash = yield* stashUnstagedWorktreeForTesting(tempContext);
          expect(O.isSome(stash)).toBe(true);

          const committed = yield* Effect.succeed("committed").pipe(
            restorePublishStashOnFailure({ context: tempContext, stash })
          );

          expect(committed).toBe("committed");
          const stillParked = yield* runGitStatus(tmpDir);
          expect(stillParked).toBe("");
          const stashList = yield* runGitOutputLines(tmpDir, ["stash", "list"]);
          expect(stashList.join("\n")).toContain("yeet-staged-only/");
        })
      )
    ));

  it("passes a publish that parked nothing straight through", () =>
    Effect.runPromise(
      withTrackedFileRepo(({ tempContext }) =>
        Effect.gen(function* () {
          const refusal = yield* Effect.fail(
            YeetCommandError.make({ exitCode: 1, message: "publish refused the staged index" })
          ).pipe(restorePublishStashOnFailure({ context: tempContext, stash: O.none() }), Effect.flip);

          expect(refusal.message).toContain("publish refused the staged index");
        })
      )
    ));

  it("forces dependency-sensitive lanes when forceTurbo is set", () => {
    const forced = buildYeetRunPlanForTesting({
      context,
      forceTurbo: true,
      message: O.some("feat(repo-cli): add yeet"),
    });
    const proof = findStep(forced.steps, "full:pre-push");
    expect(proof.env).toMatchObject({ TURBO_FORCE: "true" });
    const advisory = findStep(forced.steps, "fallow-advisory-feedback");
    expect(advisory.env?.TURBO_FORCE).toBeUndefined();

    const unforced = buildYeetRunPlanForTesting({ context, message: O.some("feat(repo-cli): add yeet") });
    expect(findStep(unforced.steps, "full:pre-push").env?.TURBO_FORCE).toBeUndefined();
  });

  it("classifies proof lock disposition by readability and owner liveness", () => {
    const state = O.some(
      YeetProofLockStateForTesting.make({
        schemaVersion: "yeet-proof-lock/v3",
        branch: "feature",
        checkoutRoot: "/repo/checkout-a",
        command: "bun run beep quality github-checks pre-push",
        pid: 12345,
        proofTier: "full",
        startedAt: "2026-06-11T00:00:00.000Z",
      })
    );
    expect(proofLockDispositionForTesting(O.none(), "dead", false)).toBe("refuse-unreadable");
    expect(proofLockDispositionForTesting(O.none(), "alive", false)).toBe("refuse-unreadable");
    expect(proofLockDispositionForTesting(state, "alive", false)).toBe("refuse-active");
    expect(proofLockDispositionForTesting(state, "dead", false)).toBe("replace-stale");
    expect(proofLockDispositionForTesting(state, "unknown", false)).toBe("refuse-unverifiable");
    expect(proofLockDispositionForTesting(O.none(), "dead", true)).toBe("refuse-legacy");
  });

  it("reports an unverifiable proof-lock owner without dropping its identity", () => {
    const owner = YeetProofLockStateForTesting.make({
      schemaVersion: "yeet-proof-lock/v3",
      branch: "feature/unverifiable-owner",
      checkoutRoot: "/repo/unverifiable-owner",
      command: "bun run beep yeet verify",
      pid: 12345,
      procStart: "ps:unavailable",
      proofTier: "full",
      startedAt: "2026-08-31T00:00:00.000Z",
    });

    const refusal = unverifiableProofLockRefusalForTesting("/runtime/proof.lock", owner);

    expect(refusal.message).toContain("Cannot verify the process identity");
    expect(refusal.message).toContain("/repo/unverifiable-owner on feature/unverifiable-owner, pid 12345");
    expect(refusal.file).toBe("/runtime/proof.lock");
  });

  it("derives one opaque machine-local proof coordinator per repository identity", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* proofCoordinatorLockPath("git@github.com:acme/repo.git");
        const sibling = yield* proofCoordinatorLockPath("git@github.com:acme/repo.git");
        const other = yield* proofCoordinatorLockPath("git@github.com:acme/other.git");

        expect(first).toBe(sibling);
        expect(other).not.toBe(first);
        expect(first).not.toContain("github.com");
        expect(first).toMatch(/beep-yeet-proof-locks-[a-f0-9]{12}-uid-[0-9]+\/[a-f0-9]{12}\.lock$/u);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("ignores launcher XDG variants and supports an isolated test root", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const configuredRoot = "/beep-yeet-xdg-runtime-root";
        const withRuntimeConfig = (env: Record<string, string>) =>
          pipe(
            proofCoordinatorLockPath("git@github.com:acme/repo.git"),
            provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
          );

        const configured = yield* withRuntimeConfig({ XDG_RUNTIME_DIR: configuredRoot });
        const relative = yield* withRuntimeConfig({ XDG_RUNTIME_DIR: "relative/runtime-root" });
        const empty = yield* withRuntimeConfig({ XDG_RUNTIME_DIR: "" });
        const absent = yield* withRuntimeConfig({});
        const overridden = yield* proofCoordinatorLockPath("git@github.com:acme/repo.git").pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: configuredRoot }))
        );

        expect(configured).toMatch(/beep-yeet-proof-locks-[a-f0-9]{12}-uid-[0-9]+\/[a-f0-9]{12}\.lock$/u);
        expect(configured).toBe(absent);
        expect(relative).toBe(absent);
        expect(empty).toBe(absent);
        expect(path.dirname(path.dirname(overridden))).toBe(configuredRoot);
        expect(overridden).not.toBe(absent);
      }).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("accepts symlinked ancestors and rejects unsafe proof coordinator directories", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const target = path.join(tmpDir, "target");
          const symlink = path.join(tmpDir, "symlink");
          const nestedCoordinator = path.join(symlink, "coordinator");
          const overPermissive = path.join(tmpDir, "over-permissive");

          yield* fs.makeDirectory(target, { mode: 0o700 });
          yield* fs.symlink(target, symlink);
          const symlinkRefusal = yield* validateProofCoordinatorDirectoryForTesting(symlink).pipe(Effect.flip);
          expect(symlinkRefusal.message).toContain("is a symbolic link");

          yield* fs.makeDirectory(nestedCoordinator, { mode: 0o700 });
          yield* validateProofCoordinatorDirectoryForTesting(nestedCoordinator);

          const targetInfo = yield* fs.stat(target);
          const ownerRefusal = yield* validateProofCoordinatorDirectoryForTesting(
            target,
            O.some(O.getOrThrow(targetInfo.uid) + 1)
          ).pipe(Effect.flip);
          expect(ownerRefusal.message).toContain("expected effective uid");

          yield* fs.makeDirectory(overPermissive, { mode: 0o700 });
          yield* fs.chmod(overPermissive, 0o755);
          const modeRefusal = yield* validateProofCoordinatorDirectoryForTesting(overPermissive, O.none()).pipe(
            Effect.flip
          );
          expect(modeRefusal.message).toContain("has mode 755; expected 0700");
        })
      )
    ));

  it("acquires an absent proof coordinator and releases present and missing locks", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          expect(yield* fs.exists(lockPath)).toBe(false);
          const lease = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]);
          expect(lease.lockPath).toBe(lockPath);
          expect(yield* fs.exists(lockPath)).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v3"');
          expect((yield* fs.stat(path.dirname(lockPath))).mode & 0o777).toBe(0o700);

          yield* releaseProofLock(lease);
          expect(yield* fs.exists(lockPath)).toBe(false);
          yield* releaseProofLock(lease);
          expect(yield* fs.exists(lockPath)).toBe(false);
        })
      )
    ));

  it("observes an absent proof coordinator as an acquired lease", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const lease = yield* acquireLegacyFullProofLockOrObserveAtPathForTesting(lockPath, tempContext, [
            prePushStep,
          ]);

          expect(O.isSome(lease)).toBe(true);
          if (O.isSome(lease)) {
            expect(lease.value.lockPath).toBe(lockPath);
            yield* releaseProofLock(lease.value);
          }
        })
      )
    ));

  it("fails promptly when an existing proof coordinator cannot be read", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");
          const unreadableText = "unreadable coordinator\n";
          yield* fs.writeFileString(lockPath, unreadableText);
          yield* fs.writeFileString(fallbackPath, unreadableText);
          yield* fs.chmod(lockPath, 0);
          yield* fs.chmod(fallbackPath, 0);

          yield* Effect.gen(function* () {
            const retirementError = yield* retireFullProofLockOrObserveAtPath(lockPath).pipe(Effect.flip);
            expect(retirementError.message).toContain(`Failed to inspect Yeet proof lock at ${lockPath}.`);
            expect(retirementError.cause).toBeDefined();

            const fallbackError = yield* acquireFullProofFallbackLockOrObserveAtPath(
              lockPath,
              tempContext,
              "bun run beep yeet verify"
            ).pipe(Effect.flip);
            expect(fallbackError.message).toContain(`Failed to inspect Yeet proof lock at ${fallbackPath}.`);
            expect(fallbackError.cause).toBeDefined();
          }).pipe(
            Effect.ensuring(
              Effect.all([fs.chmod(lockPath, 0o600), fs.chmod(fallbackPath, 0o600)], { discard: true }).pipe(
                Effect.ignore
              )
            )
          );

          expect(yield* fs.readFileString(lockPath)).toBe(unreadableText);
          expect(yield* fs.readFileString(fallbackPath)).toBe(unreadableText);
        })
      )
    ));

  it("retires the origin coordinator idempotently and keeps the legacy acquisition fail closed", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          const retired = yield* retireFullProofLockOrObserveAtPath(lockPath);
          expect(O.isSome(retired)).toBe(true);
          const markerText = yield* fs.readFileString(lockPath);
          expect(markerText).toContain('"schemaVersion":"yeet-proof-lock/v4"');
          expect(markerText).toContain('"coordination":"quality-scheduler/v1"');

          expect(O.isSome(yield* retireFullProofLockOrObserveAtPath(lockPath))).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toBe(markerText);

          const legacyPathRefusal = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]).pipe(
            Effect.flip
          );
          expect(legacyPathRefusal.message).toContain("Another Yeet full proof for this repository is active.");
          expect(yield* fs.readFileString(lockPath)).toBe(markerText);
        })
      )
    ));

  it("waits for a live v3 owner before installing the retirement marker", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const lease = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]);

          expect(O.isNone(yield* retireFullProofLockOrObserveAtPath(lockPath))).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v3"');

          yield* releaseProofLock(lease);
          expect(O.isSome(yield* retireFullProofLockOrObserveAtPath(lockPath))).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toContain('"schemaVersion":"yeet-proof-lock/v4"');
        })
      )
    ));

  it("replaces a stale v3 owner with the retirement marker", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          yield* fs.writeFileString(lockPath, staleText);

          expect(O.isSome(yield* retireFullProofLockOrObserveAtPath(lockPath))).toBe(true);
          const markerText = yield* fs.readFileString(lockPath);
          expect(markerText).toContain('"schemaVersion":"yeet-proof-lock/v4"');
          expect(markerText).not.toBe(staleText);
        })
      )
    ));

  it("honors a competing retirement marker after losing stale-owner reclamation", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const competingMarker = `${yield* encodeJson({
            schemaVersion: "yeet-proof-lock/v4",
            coordination: "quality-scheduler/v1",
            retiredAt: "2026-08-31T00:00:00.000Z",
          })}\n`;
          let replaceOnObservationClaim = true;
          const racingFileSystem = FileSystem.FileSystem.of({
            ...fs,
            writeFileString: Effect.fn("YeetTest.installCompetingRetirementMarker")(
              function* (target, contents, options) {
                yield* fs.writeFileString(target, contents, options);
                if (
                  replaceOnObservationClaim &&
                  options?.flag === "wx" &&
                  Str.startsWith(`${lockPath}.reap-`)(target) &&
                  Str.endsWith(".claim")(target)
                ) {
                  replaceOnObservationClaim = false;
                  yield* fs.remove(lockPath, { force: true });
                  yield* fs.writeFileString(lockPath, competingMarker);
                }
              }
            ),
          });
          yield* fs.writeFileString(lockPath, staleText);

          const retired = yield* retireFullProofLockOrObserveAtPath(lockPath).pipe(
            Effect.provideService(FileSystem.FileSystem, racingFileSystem)
          );

          expect(O.isSome(retired)).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toBe(competingMarker);
        })
      )
    ));

  it("serializes cross-origin below-envelope proofs through one scheduler fallback lock", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const path = yield* Path.Path;
          const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");
          const otherOriginLockPath = path.join(path.dirname(lockPath), "other-origin.lock");
          expect(O.isSome(yield* retireFullProofLockOrObserveAtPath(lockPath))).toBe(true);
          const first = yield* acquireFullProofFallbackLockOrObserveAtPath(
            lockPath,
            tempContext,
            "bun run beep yeet verify"
          );
          expect(O.isSome(first)).toBe(true);
          if (O.isSome(first)) {
            expect(first.value.lockPath).toBe(fallbackPath);
          }
          expect(
            O.isNone(
              yield* acquireFullProofFallbackLockOrObserveAtPath(
                otherOriginLockPath,
                tempContext,
                "bun run beep yeet verify"
              )
            )
          ).toBe(true);

          if (O.isSome(first)) {
            yield* releaseProofLock(first.value);
          }
          const next = yield* acquireFullProofFallbackLockOrObserveAtPath(
            otherOriginLockPath,
            tempContext,
            "bun run beep yeet verify"
          );
          expect(O.isSome(next)).toBe(true);
          if (O.isSome(next)) {
            expect(next.value.lockPath).toBe(fallbackPath);
            yield* releaseProofLock(next.value);
          }
        })
      )
    ));

  it("reclaims a scheduler fallback lock whose PID was recycled", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");
          const recycledOwnerText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/recycled-owner",
              checkoutRoot: "/repo/recycled-owner",
              command: "bun run beep yeet verify",
              pid: process.pid,
              procStart: "not-the-current-process-start-time",
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          yield* fs.writeFileString(fallbackPath, recycledOwnerText);

          const replacement = yield* acquireFullProofFallbackLockOrObserveAtPath(
            lockPath,
            tempContext,
            "bun run beep yeet verify"
          );

          expect(O.isSome(replacement)).toBe(true);
          expect(yield* fs.readFileString(fallbackPath)).not.toBe(recycledOwnerText);
          if (O.isSome(replacement)) {
            yield* releaseProofLock(replacement.value);
          }
        })
      )
    ));

  it("refuses to create a scheduler fallback lock without a process start identity", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");

          const refusal = yield* acquireFullProofFallbackLockOrObserveAtPathForTesting(
            lockPath,
            tempContext,
            "bun run beep yeet verify",
            O.none()
          ).pipe(Effect.flip);

          expect(refusal.message).toContain("current process start identity is unavailable");
          expect(refusal.message).toContain("PID reuse could strand the lock");
          expect(refusal.file).toBe(fallbackPath);
          expect(yield* fs.exists(fallbackPath)).toBe(false);
        })
      )
    ));

  it("accepts a portable process start identity for the scheduler fallback lock", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");

          const acquired = yield* acquireFullProofFallbackLockOrObserveAtPathForTesting(
            lockPath,
            tempContext,
            "bun run beep yeet verify",
            O.some("ps:Sun Aug 31 00:00:00 2026")
          );

          expect(O.isSome(acquired)).toBe(true);
          expect(yield* fs.readFileString(fallbackPath)).toContain('"procStart":"ps:Sun Aug 31 00:00:00 2026"');
          if (O.isSome(acquired)) {
            yield* releaseProofLock(acquired.value);
          }
        })
      )
    ));

  it("refuses an active proof coordinator and preserves its owner metadata", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const activeText = yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/active-owner",
              checkoutRoot: "/repo/active-owner",
              command: "bun run beep yeet verify",
              pid: process.pid,
              proofTier: "full",
              startedAt: "2026-08-26T00:00:00.000Z",
            })
          );
          yield* fs.writeFileString(lockPath, `${activeText}\n`);

          const refusal = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]).pipe(Effect.flip);

          expect(refusal.message).toContain("Another Yeet full proof for this repository is active.");
          expect(refusal.message).toContain("Owner checkout /repo/active-owner on feature/active-owner");
          expect(yield* fs.readFileString(lockPath)).toBe(`${activeText}\n`);
        })
      )
    ));

  it("replaces a stale proof coordinator and records the new owner", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          );
          yield* fs.writeFileString(lockPath, `${staleText}\n`);

          const lease = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]);
          expect(lease.lockPath).toBe(lockPath);
          const replacementText = yield* fs.readFileString(lockPath);
          expect(replacementText).not.toBe(`${staleText}\n`);
          expect(replacementText).toContain('"schemaVersion":"yeet-proof-lock/v3"');
          expect(replacementText).toContain(`"pid":${process.pid}`);
          expect(replacementText).toContain(`"branch":"${tempContext.branch}"`);
        })
      )
    ));

  it("recovers a dead-owner observation claim and reclaims the stale v3 lock", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const claimPath = proofLockReapClaimPath(lockPath, staleText);
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const replacementText = "replacement-from-dead-claim-recovery\n";
          yield* fs.writeFileString(lockPath, staleText);
          yield* fs.writeFileString(claimPath, deadClaimText);

          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, replacementText)).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toBe(replacementText);
          expect(yield* fs.exists(claimPath)).toBe(false);
        })
      )
    ));

  it("does not let a stale dead-claim observation delete a fresh claim or enter the lock move", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const claimPath = proofLockReapClaimPath(lockPath, staleText);
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const delayedClaimText = `${yield* encodeProofLockReapClaim(process.pid, "2026-08-26T00:00:00.002Z")}\n`;
          const tombstonePath = proofLockReapClaimTombstonePath(claimPath, deadClaimText);
          const tombstoneCleaned = yield* Deferred.make<void>();
          const releaseWinner = yield* Deferred.make<void>();
          let pauseFirstTombstoneCleanup = true;
          const racingFileSystem = FileSystem.FileSystem.of({
            ...fs,
            remove: Effect.fn("YeetTest.pauseRecoveredClaimOwner")(function* (target, options) {
              yield* fs.remove(target, options);
              if (pauseFirstTombstoneCleanup && Str.Equivalence(target, tombstonePath)) {
                pauseFirstTombstoneCleanup = false;
                yield* Deferred.succeed(tombstoneCleaned, undefined);
                yield* Deferred.await(releaseWinner);
              }
            }),
          });
          yield* fs.writeFileString(lockPath, staleText);
          yield* fs.writeFileString(claimPath, deadClaimText);

          const winner = yield* Effect.forkChild(
            tryReclaimStaleProofLockForTesting(lockPath, staleText, "winner-a\n").pipe(
              Effect.provideService(FileSystem.FileSystem, racingFileSystem)
            )
          );
          yield* Deferred.await(tombstoneCleaned);
          const freshClaimText = yield* fs.readFileString(claimPath);
          expect(freshClaimText).not.toBe(deadClaimText);
          expect(yield* fs.exists(tombstonePath)).toBe(false);

          expect(
            yield* tryRecoverObservedProofLockReapClaimForTesting(claimPath, delayedClaimText, deadClaimText).pipe(
              Effect.provideService(FileSystem.FileSystem, racingFileSystem)
            )
          ).toBe(false);
          expect(yield* fs.readFileString(claimPath)).toBe(freshClaimText);
          expect(yield* fs.exists(tombstonePath)).toBe(false);

          expect(
            yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, "delayed-winner\n").pipe(
              Effect.provideService(FileSystem.FileSystem, racingFileSystem)
            )
          ).toBe(false);
          expect(yield* fs.readFileString(lockPath)).toBe(staleText);
          expect(yield* fs.readFileString(claimPath)).toBe(freshClaimText);

          yield* Deferred.succeed(releaseWinner, undefined);
          expect(yield* Fiber.join(winner)).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toBe("winner-a\n");
          expect(yield* fs.exists(claimPath)).toBe(false);
          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, "winner-b\n")).toBe(false);
          expect(yield* fs.readFileString(lockPath)).toBe("winner-a\n");
        })
      )
    ));

  it("refuses a live-owner dead-claim tombstone without changing either marker", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const claimPath = proofLockReapClaimPath(lockPath, "stale-lock-observation\n");
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const tombstonePath = proofLockReapClaimTombstonePath(claimPath, deadClaimText);
          const liveTombstoneText = `${yield* encodeProofLockReapClaim(process.pid)}\n`;
          yield* fs.writeFileString(claimPath, deadClaimText);
          yield* fs.writeFileString(tombstonePath, liveTombstoneText);

          expect(
            yield* tryRecoverObservedProofLockReapClaimForTesting(
              claimPath,
              `${yield* encodeProofLockReapClaim(process.pid)}\n`,
              deadClaimText
            )
          ).toBe(false);
          expect(yield* fs.readFileString(claimPath)).toBe(deadClaimText);
          expect(yield* fs.readFileString(tombstonePath)).toBe(liveTombstoneText);
        })
      )
    ));

  it("fails closed on a dead-owner dead-claim tombstone and names its exact path", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const claimPath = proofLockReapClaimPath(lockPath, "stale-lock-observation\n");
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const tombstonePath = proofLockReapClaimTombstonePath(claimPath, deadClaimText);
          const deadTombstoneText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          yield* fs.writeFileString(claimPath, deadClaimText);
          yield* fs.writeFileString(tombstonePath, deadTombstoneText);

          const refusal = yield* tryRecoverObservedProofLockReapClaimForTesting(
            claimPath,
            `${yield* encodeProofLockReapClaim(process.pid)}\n`,
            deadClaimText
          ).pipe(Effect.flip);
          expect(refusal.message).toContain("dead-owner proof-lock reclamation tombstone");
          expect(refusal.message).toContain(tombstonePath);
          expect(refusal.message).toContain("depth-2 tombstones are never auto-reclaimed");
          expect(refusal.message).toContain("confirming every sibling checkout is idle");
          expect(yield* fs.readFileString(claimPath)).toBe(deadClaimText);
          expect(yield* fs.readFileString(tombstonePath)).toBe(deadTombstoneText);
        })
      )
    ));

  it("fails closed on an unreadable dead-claim tombstone and names its exact path", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const claimPath = proofLockReapClaimPath(lockPath, "stale-lock-observation\n");
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const tombstonePath = proofLockReapClaimTombstonePath(claimPath, deadClaimText);
          const unreadableTombstoneText = "not-json\n";
          yield* fs.writeFileString(claimPath, deadClaimText);
          yield* fs.writeFileString(tombstonePath, unreadableTombstoneText);

          const refusal = yield* tryRecoverObservedProofLockReapClaimForTesting(
            claimPath,
            `${yield* encodeProofLockReapClaim(process.pid)}\n`,
            deadClaimText
          ).pipe(Effect.flip);
          expect(refusal.message).toContain("unreadable proof-lock reclamation tombstone");
          expect(refusal.message).toContain(tombstonePath);
          expect(refusal.message).toContain("depth-2 tombstones are never auto-reclaimed");
          expect(refusal.message).toContain("confirming every sibling checkout is idle");
          expect(yield* fs.readFileString(claimPath)).toBe(deadClaimText);
          expect(yield* fs.readFileString(tombstonePath)).toBe(unreadableTombstoneText);
        })
      )
    ));

  it("refuses a live-owner observation claim and leaves the stale v3 lock untouched", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const claimPath = proofLockReapClaimPath(lockPath, staleText);
          const liveClaimText = `${yield* encodeProofLockReapClaim(process.pid)}\n`;
          yield* fs.writeFileString(lockPath, staleText);
          yield* fs.writeFileString(claimPath, liveClaimText);

          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, "replacement\n")).toBe(false);
          expect(yield* fs.readFileString(lockPath)).toBe(staleText);
          expect(yield* fs.readFileString(claimPath)).toBe(liveClaimText);
        })
      )
    ));

  it("fails closed with the manual-remediation path for an unreadable observation claim", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const claimPath = proofLockReapClaimPath(lockPath, staleText);
          yield* fs.writeFileString(lockPath, staleText);
          yield* fs.writeFileString(claimPath, "not-json\n");

          const refusal = yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, "replacement\n").pipe(
            Effect.flip
          );
          expect(refusal.message).toContain("unreadable proof-lock reclamation claim");
          expect(refusal.message).toContain(claimPath);
          expect(refusal.message).toContain("Remove");
          expect(yield* fs.readFileString(lockPath)).toBe(staleText);
          expect(yield* fs.readFileString(claimPath)).toBe("not-json\n");
        })
      )
    ));

  it("allows exactly one interleaved dead-claim recoverer to win the tombstone and lease", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const claimPath = proofLockReapClaimPath(lockPath, staleText);
          const deadClaimText = `${yield* encodeProofLockReapClaim(2_147_483_647)}\n`;
          const tombstonePath = proofLockReapClaimTombstonePath(claimPath, deadClaimText);
          const winnerText = "winner-a\n";
          const loserText = "winner-b\n";
          yield* fs.writeFileString(lockPath, staleText);
          yield* fs.writeFileString(claimPath, deadClaimText);

          const tombstoneCreated = yield* Deferred.make<void>();
          const releaseWinner = yield* Deferred.make<void>();
          const racingFileSystem = FileSystem.FileSystem.of({
            ...fs,
            writeFileString: Effect.fn("YeetTest.pauseTombstoneWinner")(function* (target, contents, options) {
              if (!Str.Equivalence(target, tombstonePath) || options?.flag !== "wx") {
                return yield* fs.writeFileString(target, contents, options);
              }
              yield* fs.writeFileString(target, contents, options);
              yield* Deferred.succeed(tombstoneCreated, undefined);
              yield* Deferred.await(releaseWinner);
            }),
          });

          const winner = yield* Effect.forkChild(
            tryReclaimStaleProofLockForTesting(lockPath, staleText, winnerText).pipe(
              Effect.provideService(FileSystem.FileSystem, racingFileSystem)
            )
          );
          yield* Deferred.await(tombstoneCreated);
          const tombstoneText = yield* fs.readFileString(tombstonePath);
          expect(yield* fs.readFileString(claimPath)).toBe(deadClaimText);

          expect(
            yield* tryRecoverObservedProofLockReapClaimForTesting(
              claimPath,
              `${yield* encodeProofLockReapClaim(process.pid, "2026-08-26T00:00:00.003Z")}\n`,
              deadClaimText
            ).pipe(Effect.provideService(FileSystem.FileSystem, racingFileSystem))
          ).toBe(false);
          expect(yield* fs.readFileString(claimPath)).toBe(deadClaimText);
          expect(yield* fs.readFileString(tombstonePath)).toBe(tombstoneText);

          yield* Deferred.succeed(releaseWinner, undefined);
          expect(yield* Fiber.join(winner)).toBe(true);
          expect(yield* fs.readFileString(lockPath)).toBe(winnerText);
          expect(yield* fs.exists(claimPath)).toBe(false);
          expect(yield* fs.exists(tombstonePath)).toBe(false);
          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, loserText)).toBe(false);
          expect(yield* fs.readFileString(lockPath)).toBe(winnerText);
        })
      )
    ));

  it("refuses a dead-owner v2 legacy lock without changing its bytes", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const legacyText = `${yield* encodeJson({
            schemaVersion: "yeet-proof-lock/v2",
            branch: "feature/legacy-owner",
            checkoutRoot: "/repo/legacy-owner",
            command: "bun run beep yeet verify",
            pid: 2_147_483_647,
            proofTier: "full",
            startedAt: "2026-08-25T00:00:00.000Z",
          })}\n`;
          yield* fs.writeFileString(lockPath, legacyText);

          const refusal = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]).pipe(Effect.flip);

          expect(refusal.message).toContain("legacy v2 full-proof coordinator");
          expect(refusal.message).toContain(lockPath);
          expect(refusal.message).toContain("will not reclaim it automatically");
          expect(refusal.message).toContain("confirming every sibling checkout is idle");
          expect(yield* fs.readFileString(lockPath)).toBe(legacyText);

          const retirementRefusal = yield* retireFullProofLockOrObserveAtPath(lockPath).pipe(Effect.flip);
          expect(retirementRefusal.message).toContain("legacy v2 full-proof coordinator");
          expect(yield* fs.readFileString(lockPath)).toBe(legacyText);
        })
      )
    ));

  it("does not let a delayed stale contender reap the winner's fresh lock", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const staleText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/stale-owner",
              checkoutRoot: "/repo/stale-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-25T00:00:00.000Z",
            })
          )}\n`;
          const winnerText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/winner",
              checkoutRoot: "/repo/winner",
              command: "bun run beep yeet verify",
              pid: process.pid,
              proofTier: "full",
              startedAt: "2026-08-26T00:00:00.000Z",
            })
          )}\n`;
          const loserText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/loser",
              checkoutRoot: "/repo/loser",
              command: "bun run beep yeet verify",
              pid: process.pid,
              proofTier: "full",
              startedAt: "2026-08-26T00:00:01.000Z",
            })
          )}\n`;
          yield* fs.writeFileString(lockPath, staleText);

          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, winnerText)).toBe(true);
          expect(yield* tryReclaimStaleProofLockForTesting(lockPath, staleText, loserText)).toBe(false);
          expect(yield* fs.readFileString(lockPath)).toBe(winnerText);

          const refusal = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]).pipe(Effect.flip);
          expect(refusal.message).toContain("Owner checkout /repo/winner on feature/winner");
          const coordinatorEntries = yield* fs.readDirectory(path.dirname(lockPath));
          expect(A.filter(coordinatorEntries, Str.includes(".reap-"))).toEqual([]);
        })
      )
    ));

  it("does not release a foreign lock generation", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const lease = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]);
          const foreignText = `${yield* encodeJson(
            YeetProofLockStateForTesting.make({
              schemaVersion: "yeet-proof-lock/v3",
              branch: "feature/foreign-owner",
              checkoutRoot: "/repo/foreign-owner",
              command: "bun run beep yeet verify",
              pid: 2_147_483_647,
              proofTier: "full",
              startedAt: "2026-08-26T00:00:02.000Z",
            })
          )}\n`;
          yield* fs.writeFileString(lockPath, foreignText);

          yield* releaseProofLock(lease);

          expect(yield* fs.readFileString(lockPath)).toBe(foreignText);
        })
      )
    ));

  it("refuses a corrupt proof coordinator without deleting it", () =>
    Effect.runPromise(
      withProofCoordinatorRepo(({ lockPath, tempContext }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(lockPath, "not-json\n");

          const refusal = yield* acquireLegacyFullProofLockForTesting(tempContext, [prePushStep]).pipe(Effect.flip);

          expect(refusal.message).toContain("Another Yeet full proof for this repository is active.");
          expect(refusal.message).not.toContain("Owner checkout");
          expect(yield* fs.readFileString(lockPath)).toBe("not-json\n");
        })
      )
    ));

  it("plans closeout write actions only for known thread ids with a paired body", () => {
    const known = ["PRRT_a", "PRRT_b"];
    const ok = closeoutWritePlanForTesting({
      knownThreadIds: known,
      replyBody: "Fixed in abc123.",
      replyThread: "PRRT_a",
      resolveThreads: "PRRT_a,PRRT_b",
    });
    expect(O.isNone(ok.error)).toBe(true);
    expect(ok.intents.map((intent) => `${intent.kind}:${intent.threadId}`)).toEqual([
      "reply:PRRT_a",
      "resolve:PRRT_a",
      "resolve:PRRT_b",
    ]);

    const unknown = closeoutWritePlanForTesting({
      knownThreadIds: known,
      replyBody: "",
      replyThread: "",
      resolveThreads: "PRRT_missing",
    });
    expect(O.isSome(unknown.error)).toBe(true);
    if (O.isSome(unknown.error)) {
      expect(unknown.error.value).toContain("PRRT_missing");
    }

    const unpaired = closeoutWritePlanForTesting({
      knownThreadIds: known,
      replyBody: "",
      replyThread: "PRRT_a",
      resolveThreads: "",
    });
    expect(O.isSome(unpaired.error)).toBe(true);

    const orphanBody = closeoutWritePlanForTesting({
      knownThreadIds: known,
      replyBody: "orphan body without a thread",
      replyThread: "",
      resolveThreads: "",
    });
    expect(O.isSome(orphanBody.error)).toBe(true);

    const oversized = closeoutWritePlanForTesting({
      knownThreadIds: known,
      replyBody: "x".repeat(17 * 1024),
      replyThread: "PRRT_a",
      resolveThreads: "",
    });
    expect(O.isSome(oversized.error)).toBe(true);
  });

  it("decodes closeout reports without writeActions for backwards compatibility", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* S.decodeEffect(PrCloseoutReport)({
          actionableReviewThreadCount: 0,
          botCommentCount: 0,
          greptile: {},
          issueCount: 0,
          issues: [],
          prNumber: 1,
          prUrl: "https://example.test/pr/1",
          retriggeredGreptile: false,
          schemaVersion: "yeet-pr-closeout/v1",
        });
        expect(decoded.writeActions).toEqual([]);
        expect(decoded.states).toEqual([]);
      })
    ));

  it("warns on behind-only divergence and reports overlap paths for refusal", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;

          yield* runGit(tmpDir, ["init", "-b", "main"]);
          yield* runGit(tmpDir, ["config", "user.email", "yeet@example.test"]);
          yield* runGit(tmpDir, ["config", "user.name", "Yeet Test"]);
          yield* fs.writeFileString(path.join(tmpDir, "shared.txt"), "base\n");
          yield* fs.writeFileString(path.join(tmpDir, "other.txt"), "base\n");
          yield* runGit(tmpDir, ["add", "."]);
          yield* runGit(tmpDir, ["commit", "-m", "init"]);

          yield* runGit(tmpDir, ["checkout", "-b", "feature"]);
          yield* fs.writeFileString(path.join(tmpDir, "shared.txt"), "feature\n");
          yield* runGit(tmpDir, ["commit", "-am", "feature touches shared"]);

          yield* runGit(tmpDir, ["checkout", "main"]);
          yield* fs.writeFileString(path.join(tmpDir, "shared.txt"), "main moved\n");
          yield* runGit(tmpDir, ["commit", "-am", "main touches shared"]);
          yield* runGit(tmpDir, ["checkout", "feature"]);

          const overlapContext = RepoRunContext.make({
            ...context,
            base: "main",
            cwd: tmpDir,
            repoRoot: tmpDir,
          });
          const overlapping = yield* assessBaseFreshnessForTesting(overlapContext);
          expect(overlapping.behindCount).toBe(1);
          expect(overlapping.overlappingPaths).toEqual(["shared.txt"]);

          yield* runGit(tmpDir, ["checkout", "main"]);
          yield* fs.writeFileString(path.join(tmpDir, "other.txt"), "main only\n");
          yield* runGit(tmpDir, ["commit", "-am", "main touches other"]);
          yield* runGit(tmpDir, ["checkout", "feature"]);

          const stillOverlapping = yield* assessBaseFreshnessForTesting(overlapContext);
          expect(stillOverlapping.behindCount).toBe(2);
          expect(stillOverlapping.overlappingPaths).toEqual(["shared.txt"]);

          yield* fs.writeFileString(path.join(tmpDir, "other.txt"), "staged before commit\n");
          yield* runGit(tmpDir, ["add", "other.txt"]);
          const withStaged = yield* assessBaseFreshnessForTesting(overlapContext);
          expect(withStaged.overlappingPaths).toEqual(["other.txt", "shared.txt"]);
        })
      )
    ));
});

describe("yeet base ref safety", () => {
  it("accepts ordinary origin branch names including dashes and slashes", () => {
    expect(O.getOrThrow(safeOriginBranchFromBaseForTesting("origin/main"))).toBe("main");
    expect(O.getOrThrow(safeOriginBranchFromBaseForTesting("origin/feature/6-17-2026"))).toBe("feature/6-17-2026");
  });

  it("refuses option-like and refspec-injecting base refs", () => {
    // Regression for the git fetch option injection: the stripped branch must not
    // be reparsable as a fetch option (--upload-pack=...) or a second refspec.
    expect(O.isNone(safeOriginBranchFromBaseForTesting("origin/--upload-pack=sh -c 'id' #"))).toBe(true);
    expect(O.isNone(safeOriginBranchFromBaseForTesting("origin/-rf"))).toBe(true);
    expect(O.isNone(safeOriginBranchFromBaseForTesting("origin/main:refs/heads/evil"))).toBe(true);
    expect(O.isNone(safeOriginBranchFromBaseForTesting("origin/has space"))).toBe(true);
    expect(O.isNone(safeOriginBranchFromBaseForTesting("origin/..evil"))).toBe(true);
  });

  it("ignores non-origin base refs so they fall back to rev-parse", () => {
    expect(O.isNone(safeOriginBranchFromBaseForTesting("main"))).toBe(true);
    expect(O.isNone(safeOriginBranchFromBaseForTesting("HEAD~1"))).toBe(true);
  });
});
