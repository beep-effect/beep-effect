import {
  FallowReportFinding,
  FallowReportOk,
  FallowReportPayload,
  FindingAttributionSummary,
} from "@beep/repo-cli/test/Quality";
import {
  assessBaseFreshnessForTesting,
  buildQualityIssueIndex,
  buildYeetRunPlanForTesting,
  buildYeetVerdictForTesting,
  closeoutGateStatesForTesting,
  closeoutWritePlanForTesting,
  collectDiffFingerprintForTesting,
  commandTextForStep,
  decodeTurboPlanTasksFromQueryJsonForTesting,
  defaultYeetRunOptions,
  executeStepWithArtifacts,
  FallowFeedbackAllowedRoot,
  GreptileSummary,
  gitPathListFromNulOutputForTesting,
  greptileIssueLimitExceededForTesting,
  greptileRetriggerCommentForTesting,
  inferGreptileIssueCountForTesting,
  jsonObjectTextFromMixedOutputForTesting,
  knownSubLaneRemediationFromOutput,
  latestGreptileSummaryForTesting,
  loadVerifiedStateForTesting,
  overlappingBasePathsForTesting,
  PrCloseoutOptions,
  PrCloseoutReport,
  partiallyStagedPathsForTesting,
  prePushLocalShasFromStdinForTesting,
  prePushShaMismatchesForTesting,
  proofLockDispositionForTesting,
  publishPathsOutsideIntentForTesting,
  publishRestagePathsForTesting,
  publishUpstreamMismatchWarningForTesting,
  QualityIssueIndex,
  qualityIssuesFromStepResult,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  renderPackageQualityPacketMarkdown,
  renderYeetStatusSummary,
  repoProofStepDefinition,
  restoreStashedWorktreeForTesting,
  runYeetFallowFeedbackForTesting,
  safeOriginBranchFromBaseForTesting,
  shouldSkipCommitForReusablePublishForTesting,
  stashUnstagedWorktreeForTesting,
  summarizePublishPathsForTesting,
  TurboPlanSnapshot,
  TurboPlanTask,
  TurboWorkspacePackage,
  validateMonitorGuards,
  validatePublishBranchForTesting,
  YeetCommandError,
  YeetExecutedStep,
  YeetProofLockStateForTesting,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusSnapshot,
  YeetStatusWorktree,
  YeetVerdict,
  yeetStatusNextCommandForTesting,
} from "@beep/repo-cli/test/Yeet";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

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
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(PlatformLayer));

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

describe("yeet planner", () => {
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
      "full:pre-push",
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
    ).toEqual(["fallow-advisory-feedback", "full:pre-push", "publish:head-install-preflight"]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.mutability),
        A.dedupe
      )
    ).toEqual(["write", "readonly"]);
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
    expect(findStep(plan.steps, "monitor:pr-checks:watch").args).toEqual(["pr", "checks", "--watch"]);
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
      "full:pre-push",
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
      "full:pre-push",
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

  it("builds repair as deterministic generators plus affected feedback", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "repair" });

    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "prepare:laws:effect-imports",
      "prepare:laws:dual-arity",
      "prepare:config-sync",
      "prepare:lint:fix",
      "prepare:docgen",
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
    expect(findStep(plan.steps, "prepare:docgen").args).toEqual(["run", "docgen"]);
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
      "--types",
      "--filter=@beep/repo-cli",
      "--concurrency=3",
      "--continue=dependencies-successful",
      "--summarize",
      "--ui=stream",
    ]);
  });

  it("uses changed-file lint fix for write-mode repair", () => {
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "repair" });
    const step = findStep(plan.steps, "prepare:lint:fix");

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
    ).toEqual(["feedback:build", "feedback:lint"]);
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
    ).toEqual([]);
    expect(
      pipe(
        plan.steps,
        A.map((step) => step.label)
      )
    ).toEqual([
      "prepare:laws:effect-imports",
      "prepare:laws:dual-arity",
      "prepare:config-sync",
      "prepare:lint:fix",
      "prepare:docgen",
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
          yield* fs.writeFileString(path.join(fromDir, "audit.json"), `${auditText}\n`);
          yield* fs.writeFileString(path.join(fromDir, "health.json"), `${healthText}\n`);
          // CSF-011: the Fallow feedback reader/writer is constrained to its
          // configured allowed root. Point the guard at this temp dir so the
          // mixed-output directory is exercised under the symlink/traversal
          // protection without hardcoding the repository root.
          yield* runYeetFallowFeedbackForTesting({ advisory: true, emit: emitPath, from: fromDir }).pipe(
            Effect.provideService(FallowFeedbackAllowedRoot, O.some(tmpDir))
          );

          const emittedText = yield* fs.readFileString(emitPath);
          const index = yield* S.decodeUnknownEffect(S.fromJsonString(QualityIssueIndex))(emittedText);

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
    const issues = prePushFailureIssues(context, "[beep-cli] lint:cspell: cspell .\nUnknown word found");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "lint-tool",
      message: "full:pre-push failed in cspell with exit code 1.",
      remediation: "Run `bun run cspell` or update the spelling dictionary for intentional terms.",
      subCategory: "cspell",
    });
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
      "Unknown word found: operator\n" +
        pipe(
          A.makeBy(16, (index) => `context line ${index}`),
          A.join("\n")
        ) +
        "\nfull:pre-push failed with exit code 1.\nsecurity:nix completed successfully"
    );

    expect(O.isSome(remediation)).toBe(true);
    expect(O.getOrUndefined(remediation)).toContain("cspell");
  });

  it("extracts the changeset sub-lane hint with the empty-changeset remedy", () => {
    const issues = prePushFailureIssues(
      context,
      "[beep-cli] quality:changeset-status: bun run changeset:status:since-main\nSome packages have been changed but no changesets were found."
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      category: "changeset-policy",
      subCategory: "changeset-status",
    });
    expect(issues[0]?.remediation).toContain("changeset add --empty");
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

describe("yeet status helpers", () => {
  it("renders compact local status and suggests repair commands from verdict artifacts", () => {
    const verdict = YeetStatusArtifact.make({
      detail: "publish failure: proof failed",
      mode: "publish",
      outcome: "failure",
      path: ".beep/yeet/runs/feature/verdict.json",
      repairCommand: "Run `bun run docgen:local`.",
      schemaVersion: "yeet-verdict/v1",
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
});

describe("yeet publish scope helpers", () => {
  it("refuses publish on main before any publish plan can push", () =>
    Effect.gen(function* () {
      const mainContext = RepoRunContext.make({ ...context, branch: "main" });
      const error = yield* validatePublishBranchForTesting(
        mainContext,
        defaultYeetRunOptions({ message: "ci(trunk): guard main publish" })
      ).pipe(Effect.flip);

      expect(error.message).toContain('yeet publish is PR-branch-only; refusing to publish directly from "main"');
      expect(error.command).toBe("git switch -c <feature-branch> origin/main");
    }));

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
      "full:pre-push",
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
      "full:pre-push",
      "monitor:pr-context",
      "monitor:pr-checks:watch",
    ]);
  });

  it("requires explicit --pr before start-pr-early can reach commit or push", () =>
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
    }));

  it("surfaces the clean-HEAD frozen-install repair hint and removes its temp worktree", () =>
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
        const result = yield* executeStepWithArtifacts(tempContext, step);

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
    ));

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
    const verdict = buildYeetVerdictForTesting({
      base: "origin/main",
      branch: "feature",
      createdAt: "2026-06-11T00:00:00.000Z",
      executed: [
        YeetExecutedStep.make({
          durationMs: 12,
          result: RepoStepRunResult.make({
            stepId: proofStep.id,
            commandText: "bun run beep quality github-checks pre-push",
            exitCode: 1,
            output: "[beep-cli] lint:cspell: cspell .\nUnknown word found",
          }),
          step: proofStep,
        }),
      ],
      head: "HEAD",
      message: "yeet publish proof failed after creating the local commit.",
      mode: "publish",
      outcome: "failure",
      packetPaths: [],
      planned: [proofStep, pushStep],
      runId: "feature",
    });

    expect(verdict.outcome).toBe("failure");
    expect(verdict.committed).toBe(false);
    expect(verdict.pushed).toBe(false);
    expect(verdict.lanes).toHaveLength(2);
    expect(verdict.lanes[0]).toMatchObject({
      id: "full:pre-push",
      durationMs: 12,
      repairCommand: "Run `bun run cspell` or update the spelling dictionary for intentional terms.",
      status: "failed",
    });
    expect(verdict.lanes[1]).toMatchObject({ id: "publish:01-git-push", status: "not-run" });
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
        const verdict = buildYeetVerdictForTesting({
          base: "origin/main",
          branch: "feature",
          createdAt: "2026-06-11T00:00:00.000Z",
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
        });

        expect(verdict.pushed).toBe(true);
        const encoded = yield* S.encodeEffect(YeetVerdict)(verdict);
        const decoded = yield* S.decodeUnknownEffect(YeetVerdict)(encoded);
        expect(decoded.lanes[0]?.status).toBe("passed");
        expect(decoded.schemaVersion).toBe("yeet-verdict/v1");
      })
    ));

  it("property: verdict schema round-trips arbitrary verdicts", () => {
    const VerdictArbitrary = S.toArbitrary(YeetVerdict);
    fc.assert(
      fc.property(VerdictArbitrary, (verdict) => {
        const encoded = S.encodeSync(YeetVerdict)(verdict);
        const decoded = S.decodeUnknownSync(YeetVerdict)(encoded);
        expect(decoded.schemaVersion).toBe("yeet-verdict/v1");
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
        schemaVersion: "yeet-proof-lock/v1",
        branch: "feature",
        command: "bun run beep quality github-checks pre-push",
        pid: 12345,
        proofTier: "full",
        startedAt: "2026-06-11T00:00:00.000Z",
      })
    );
    expect(proofLockDispositionForTesting(O.none(), false)).toBe("refuse-unreadable");
    expect(proofLockDispositionForTesting(O.none(), true)).toBe("refuse-unreadable");
    expect(proofLockDispositionForTesting(state, true)).toBe("refuse-active");
    expect(proofLockDispositionForTesting(state, false)).toBe("replace-stale");
  });

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
        const decoded = yield* S.decodeUnknownEffect(PrCloseoutReport)({
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
