/**
 * Yeet command orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Console, DateTime, Duration, Effect, FileSystem, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printCommandJson } from "../../../internal/cli/Json.ts";
import { RepoRunContext, sortedUniquePaths } from "../../../internal/repo-run/index.ts";
import {
  FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH,
  FlakeQuarantineArtifactJson,
} from "../../Quality/internal/FlakeQuarantine.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  artifactDirForContext,
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
} from "./ArtifactPaths.ts";
import { PrCloseoutOptions, runPrCloseout } from "./Closeout.ts";
import {
  collectStagedPublishPaths,
  collectUnstagedTrackedPaths,
  collectUntrackedPaths,
  currentCommitSha,
  currentYeetBranch,
  lockfileChangedSinceBase,
  refreshBaseRef,
} from "./GitExec.ts";
import {
  validateCommitMessage,
  validateMonitorGuards,
  validateRequiredMessage,
  validateStartPrEarlyPrGuard,
} from "./Guards.ts";
import { HEAD_INSTALL_PREFLIGHT_STEP_ID } from "./HeadInstallPreflight.ts";
import {
  emptyPlanResult,
  executeStepWithArtifacts,
  failWithIssueArtifacts,
  publishResult,
  renderJson,
  writeIssueArtifacts,
  writeTextFile,
} from "./IssueArtifacts.ts";
import {
  buildYeetRunPlanWithMode,
  emptyTurboPlanSnapshot,
  YeetProofTier,
  YeetRunMode,
  YeetRunPlanModeOptions,
} from "./Planner.ts";
import {
  acquireFullProofLock,
  assertReusableVerifiedState,
  releaseProofLock,
  writeVerifiedState,
} from "./ProofState.ts";
import {
  collectPublishIntent,
  enforceBaseFreshness,
  failPublishScopeWithPacket,
  formatPublishPaths,
  postCommitProofChangedAfterEarlyPushMessage,
  prePushLocalShasFromStdin,
  prePushShaMismatches,
  restoreStashedWorktree,
  stageReviewedPublishIntent,
  stashUnstagedWorktree,
  validatePostCommitProofDidNotChangeWorktree,
  validatePublishBranch,
  warnOnMismatchedPublishUpstream,
} from "./PublishScope.ts";
import { ensurePullRequest } from "./PullRequest.ts";
import { buildQualityIssueIndex } from "./QualityIssueIndex.ts";
import { collectYeetStatus, renderYeetStatusSummary, writeYeetStatusSnapshot } from "./Status.ts";
import { collectTurboPlanSnapshot } from "./TurboQuery.ts";
import { buildYeetVerdict, YeetExecutedStep } from "./Verdict.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunPlan, RepoStepRunResult } from "../../../internal/repo-run/index.ts";
import type { FlakeQuarantineIncident } from "../../Quality/internal/FlakeQuarantine.ts";
import type { YeetRunOptions, YeetRunResult } from "../Yeet.schemas.ts";
import type { YeetBaseFreshness, YeetStashState } from "./Verdict.ts";

export { defaultYeetRunOptions } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Handler");

/**
 * Hydrate a shared yeet run context from repository state.
 *
 * @param options - Runtime options.
 * @returns Shared run context.
 * @example
 * ```ts
 * import { defaultYeetRunOptions, hydrateYeetRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = hydrateYeetRunContext(defaultYeetRunOptions({ plan: true }))
 * console.log(context) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const hydrateYeetRunContext = Effect.fn("Yeet.hydrateYeetRunContext")(function* (
  options: YeetRunOptions
): Effect.fn.Return<
  RepoRunContext,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const branch = yield* currentYeetBranch(repoRoot);
  if (options.mode === "pre-push-hook") {
    return RepoRunContext.make({
      repoRoot,
      cwd: process.cwd(),
      base: options.base,
      head: options.head,
      branch,
      packetDir: options.packetDir,
      originalArgv: [],
      turbo: emptyTurboPlanSnapshot([]),
    });
  }

  if (options.mode === "status") {
    if (options.remote) {
      yield* refreshBaseRef(repoRoot, options.base);
    }
    return RepoRunContext.make({
      repoRoot,
      cwd: process.cwd(),
      base: options.base,
      head: options.head,
      branch,
      packetDir: options.packetDir,
      originalArgv: [],
      turbo: emptyTurboPlanSnapshot([]),
    });
  }

  yield* refreshBaseRef(repoRoot, options.base);
  const turbo = yield* collectTurboPlanSnapshot(repoRoot, options);

  return RepoRunContext.make({
    repoRoot,
    cwd: process.cwd(),
    base: options.base,
    head: options.head,
    branch,
    packetDir: options.packetDir,
    originalArgv: [],
    turbo,
  });
});

const runProofPhase = Effect.fn("Yeet.runProofPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  tier: YeetProofTier,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (tier !== "full") {
    return yield* runPhase(context, steps, recorder);
  }

  return yield* Effect.acquireUseRelease(
    acquireFullProofLock(context, steps),
    () => runPhase(context, steps, recorder),
    releaseProofLock
  );
});

const runPhase = Effect.fn("Yeet.runPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.forEach(
    steps,
    (step) =>
      executeStepWithArtifacts(context, step).pipe(
        Effect.timed,
        Effect.tap(([duration, result]) =>
          Ref.update(
            recorder,
            A.append(YeetExecutedStep.make({ durationMs: Duration.toMillis(duration), result, step }))
          )
        ),
        Effect.map(([, result]) => result)
      ),
    { concurrency: 1 }
  );
});

const runVerifyMode = Effect.fn("Yeet.runVerifyMode")(function* (
  context: RepoRunContext,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  tier: YeetProofTier,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const verifyResults = yield* runProofPhase(context, fullSteps, tier, recorder);
  if (A.some(verifyResults, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, fullSteps, verifyResults, "yeet verification proof failed.");
  }
  yield* writeVerifiedState(context, tier, fullSteps);
  return yield* emptyPlanResult(context);
});

const runRequiredPhase = Effect.fn("Yeet.runRequiredPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const results = yield* runPhase(context, steps, recorder);
  if (A.some(results, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, steps, results, failureMessage);
  }
});

const shouldSkipCommitForReusablePublish = Effect.fn("Yeet.shouldSkipCommitForReusablePublish")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  boolean,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!options.reuseVerified || (!options.pushOnly && (!options.amend || !options.noEdit))) {
    return false;
  }

  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  if (!A.isReadonlyArrayEmpty(stagedPaths)) {
    if (options.pushOnly) {
      return yield* failPublishScopeWithPacket(context, {
        message:
          "yeet publish --push-only --reuse-verified refuses staged changes. Commit or unstage these files before pushing an already-verified commit.",
        paths: stagedPaths,
        remediation: "Commit the staged files through a normal publish, or unstage them, then retry --push-only.",
        subCategory: "reuse-staged",
      });
    }
    return false;
  }

  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  const changedPaths = sortedUniquePaths([...unstagedPaths, ...untrackedPaths]);
  if (!A.isReadonlyArrayEmpty(changedPaths)) {
    return yield* failPublishScopeWithPacket(context, {
      message: options.pushOnly
        ? "yeet publish --push-only --reuse-verified found uncommitted changes."
        : "yeet publish --reuse-verified found uncommitted changes but no staged amend intent.",
      paths: changedPaths,
      remediation:
        "Commit, stash, or remove the uncommitted changes so the worktree exactly matches the verified commit, then retry.",
      subCategory: "reuse-dirty",
    });
  }

  return true;
});

/**
 * Decide whether a reusable publish should skip the commit phase.
 *
 * @category testing
 * @since 0.0.0
 */
export const shouldSkipCommitForReusablePublishForTesting = shouldSkipCommitForReusablePublish;

const runPublishMode = Effect.fn("Yeet.runPublishMode")(function* (
  plan: RepoRunPlan,
  message: O.Option<string>,
  options: YeetRunOptions,
  commitSteps: ReadonlyArray<RepoPlanStep>,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  earlyPublishSteps: ReadonlyArray<RepoPlanStep>,
  publishSteps: ReadonlyArray<RepoPlanStep>,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const skipCommit = yield* shouldSkipCommitForReusablePublish(plan.context, options);
  if (options.reuseVerified) {
    yield* assertReusableVerifiedState(plan.context);
  }

  const freshness = yield* enforceBaseFreshness(plan.context, options);
  yield* Ref.update(extras, (state) => ({ ...state, baseFreshness: O.some(freshness) }));

  let stash: O.Option<YeetStashState> = O.none();
  if (skipCommit) {
    yield* Console.log("[yeet] skipped commit; exact reusable proof state matches the current clean commit");
  } else {
    const publishIntent = yield* collectPublishIntent(plan.context, options.stagedOnly);
    if (O.isSome(message)) {
      yield* validateCommitMessage(plan.context, message.value);
    }
    yield* stageReviewedPublishIntent(plan.context, publishIntent, options.stagedOnly);

    // Park unstaged/untracked residue (keeping the reviewed index) BEFORE the
    // commit, so a commit hook that broadly stages files cannot capture residue
    // outside the reviewed intent into the published commit.
    if (options.stagedOnly) {
      stash = yield* stashUnstagedWorktree(plan.context);
      yield* Ref.update(extras, (state) => ({ ...state, stash }));
    }

    const commitResults = yield* runPhase(plan.context, commitSteps, recorder);
    if (A.some(commitResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, commitSteps, commitResults, "yeet commit phase failed.");
    }
  }

  const runPostCommitPhases = Effect.gen(function* () {
    if (options.startPrEarly) {
      yield* Console.log(
        "[yeet] start-pr-early: pushing before local proof; full proof and hosted monitor remain required"
      );
      const preflightSteps = A.filter(earlyPublishSteps, (step) => step.id === HEAD_INSTALL_PREFLIGHT_STEP_ID);
      yield* runRequiredPhase(
        plan.context,
        preflightSteps,
        recorder,
        "yeet clean-HEAD install preflight failed before the early push."
      );
      yield* warnOnMismatchedPublishUpstream(plan.context);
      const earlyPushSteps = A.filter(
        earlyPublishSteps,
        (step) => step.id !== "publish:02-pr-create" && step.id !== HEAD_INSTALL_PREFLIGHT_STEP_ID
      );
      const earlyPublishResults = yield* runPhase(plan.context, earlyPushSteps, recorder);
      if (A.some(earlyPublishResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          earlyPushSteps,
          earlyPublishResults,
          "yeet start-pr-early push phase failed."
        );
      }

      if (options.pr) {
        yield* ensurePullRequest(
          plan.context,
          recorder,
          A.findFirst(plan.steps, (step) => step.id === "publish:02-pr-create")
        );
      }

      const fullResults = yield* runProofPhase(plan.context, fullSteps, "full", recorder);
      if (A.some(fullResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          fullSteps,
          fullResults,
          "yeet publish --start-pr-early proof failed after pushing the commit. Fix the issue in a follow-up commit and publish again."
        );
      }
      yield* writeVerifiedState(plan.context, "full", fullSteps);
      yield* validatePostCommitProofDidNotChangeWorktree(plan.context, postCommitProofChangedAfterEarlyPushMessage);

      return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, options, skipCommit);
    }

    if (!options.reuseVerified) {
      const fullResults = yield* runProofPhase(plan.context, fullSteps, "full", recorder);
      if (A.some(fullResults, (result) => result.exitCode !== 0)) {
        return yield* failWithIssueArtifacts(
          plan.context,
          fullSteps,
          fullResults,
          "yeet publish proof failed after creating the local commit. Fix the issue, then amend or reset the commit that has not yet been pushed before retrying."
        );
      }
      yield* writeVerifiedState(plan.context, "full", fullSteps);
    } else {
      yield* Console.log("[yeet] skipped local full proof after exact reusable proof-state match");
    }
    yield* validatePostCommitProofDidNotChangeWorktree(plan.context);

    const preflightSteps = A.filter(publishSteps, (step) => step.id === HEAD_INSTALL_PREFLIGHT_STEP_ID);
    yield* runRequiredPhase(
      plan.context,
      preflightSteps,
      recorder,
      "yeet clean-HEAD install preflight failed before push."
    );
    yield* warnOnMismatchedPublishUpstream(plan.context);
    const pushSteps = A.filter(
      publishSteps,
      (step) => step.id !== "publish:02-pr-create" && step.id !== HEAD_INSTALL_PREFLIGHT_STEP_ID
    );
    const publishResults = yield* runPhase(plan.context, pushSteps, recorder);
    if (A.some(publishResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, pushSteps, publishResults, "yeet publish phase failed.");
    }

    if (options.pr) {
      yield* ensurePullRequest(
        plan.context,
        recorder,
        A.findFirst(plan.steps, (step) => step.id === "publish:02-pr-create")
      );
    }

    return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, options, skipCommit);
  });

  return yield* pipe(
    stash,
    O.match({
      onNone: () => runPostCommitPhases,
      onSome: (state) => runPostCommitPhases.pipe(Effect.ensuring(restoreStashedWorktree(plan.context, state))),
    })
  );
});

const readPrePushHookStdin = Effect.fn("Yeet.readPrePushHookStdin")(function* (): Effect.fn.Return<
  string,
  YeetCommandError
> {
  if (process.stdin.isTTY) {
    return "";
  }

  return yield* Effect.tryPromise({
    try: () => Bun.stdin.text(),
    catch: (cause) =>
      YeetCommandError.make({
        message: `Failed to read git pre-push stdin: ${cause instanceof Error ? cause.message : String(cause)}`,
        exitCode: 1,
      }),
  });
});

const runPrePushHookMode = Effect.fn("Yeet.runPrePushHookMode")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const currentSha = yield* currentCommitSha(context);
  const stdinText = yield* readPrePushHookStdin();
  const pushedLocalShas = prePushLocalShasFromStdin(stdinText);
  const localShas = A.isReadonlyArrayEmpty(pushedLocalShas) ? [currentSha] : pushedLocalShas;
  const mismatchedShas = prePushShaMismatches(localShas, currentSha);

  if (!A.isReadonlyArrayEmpty(mismatchedShas)) {
    return yield* YeetCommandError.make({
      message: `yeet pre-push-hook cannot reuse proof for pushed SHA(s) outside current HEAD:\n${formatPublishPaths(
        mismatchedShas
      )}`,
      command: "git push",
      exitCode: 1,
    });
  }

  yield* assertReusableVerifiedState(context);
  yield* Console.log(`[yeet] pre-push hook reused full proof for ${Str.slice(0, 12)(currentSha)}`);
  return yield* emptyPlanResult(context);
});

const runMonitorMode = Effect.fn("Yeet.runMonitorMode")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet monitor failed.");
  if (options.summary) {
    yield* printOperatorStatusSummary(context, true);
  }
  return yield* emptyPlanResult(context);
});

const printOperatorStatusSummary = Effect.fn("Yeet.printOperatorStatusSummary")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, remote);
  yield* writeYeetStatusSnapshot(snapshot);
  yield* Console.log(renderYeetStatusSummary(snapshot));
});

const runMonitorPhase = Effect.fn("Yeet.runMonitorPhase")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runRequiredPhase(context, monitorSteps, recorder, failureMessage);
});

const runPublishMonitorAndResult = Effect.fn("Yeet.runPublishMonitorAndResult")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  options: YeetRunOptions,
  skipCommit: boolean
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet publish monitor phase failed.");
  if (options.summary && !A.isReadonlyArrayEmpty(monitorSteps)) {
    yield* printOperatorStatusSummary(context, true);
  }
  return yield* publishResult(context, !skipCommit);
});

const runStatusMode = Effect.fn("Yeet.runStatusMode")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, options.remote);
  yield* writeYeetStatusSnapshot(snapshot);
  if (options.json) {
    yield* printCommandJson(snapshot).pipe(Effect.mapError(YeetCommandError.new("Failed to print yeet status JSON.")));
  } else {
    yield* Console.log(renderYeetStatusSummary(snapshot));
  }
  return yield* emptyPlanResult(context);
});

const runCloseoutMode = Effect.fn("Yeet.runCloseoutMode")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const report = yield* runPrCloseout(
    context,
    PrCloseoutOptions.make({
      bots: options.bots,
      requireGreptileIssues: options.requireGreptileIssues,
      requireGreptileScore: options.requireGreptileScore,
      requireReviewComments: options.requireReviewComments,
      retriggerGreptile: options.retriggerGreptile,
      replyBody: options.replyBody,
      replyThread: options.replyThread,
      resolveThreads: options.resolveThreads,
    })
  );
  const reportPath = yield* runOutputPathForContext(context, "pr-closeout.json");
  yield* writeTextFile(reportPath, `${yield* renderJson(report)}\n`);
  yield* Console.log(`[yeet] PR closeout report written to ${reportPath}`);
  if (options.summary) {
    yield* printOperatorStatusSummary(context, true);
  }

  if (A.isReadonlyArrayEmpty(report.issues)) {
    return yield* emptyPlanResult(context);
  }

  const index = buildQualityIssueIndex(report.issues);
  const artifacts = yield* writeIssueArtifacts(context, index);
  yield* Console.error(
    `yeet PR closeout failed with ${report.issueCount} issue(s).\nYeet quality packets written to ${artifacts.artifactDir}`
  );
  for (const packetPath of artifacts.packetPaths) {
    yield* Console.error(`  - ${packetPath}`);
  }
  return yield* YeetCommandError.make({
    message: `yeet PR closeout failed with ${report.issueCount} issue(s).`,
    command: "bun run beep yeet closeout",
    exitCode: 1,
  });
});

type YeetVerdictExtras = {
  readonly baseFreshness: O.Option<YeetBaseFreshness>;
  readonly stash: O.Option<YeetStashState>;
};

// The quality lane runner deletes this artifact before every policy-carrying
// lane group and writes it only when it quarantined incidents, so reading it
// right after a run that executed a full-phase proof step cannot pick up a
// previous run's incidents.
const readFlakeQuarantineIncidents = Effect.fn("Yeet.readFlakeQuarantineIncidents")(function* (
  repoRoot: string
): Effect.fn.Return<ReadonlyArray<FlakeQuarantineIncident>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifactPath = path.join(repoRoot, FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH);
  return yield* fs.readFileString(artifactPath).pipe(
    Effect.flatMap(FlakeQuarantineArtifactJson.decode),
    Effect.map((artifact) => artifact.incidents),
    Effect.orElseSucceed(A.empty<FlakeQuarantineIncident>)
  );
});

const writeRunVerdict = Effect.fn("Yeet.writeRunVerdict")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  outcome: "success" | "failure",
  message: string,
  artifacts: O.Option<YeetRunResult>
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const executed = yield* Ref.get(recorder);
  const extraState = yield* Ref.get(extras);
  const createdAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const artifactDir = yield* artifactDirForContext(plan.context);
  const fallbackIndexPath = path.join(artifactDir, "quality-issue-index.json");
  const indexPath = yield* pipe(
    artifacts,
    O.flatMap((result) => O.fromUndefinedOr(result.indexPath)),
    O.match({
      onNone: () =>
        fs.exists(fallbackIndexPath).pipe(
          Effect.orElseSucceed(() => false),
          Effect.map((exists) => (exists ? O.some(fallbackIndexPath) : O.none<string>()))
        ),
      onSome: (value) => Effect.succeed(O.some(value)),
    })
  );

  const ranFullPhase = A.some(executed, (entry) => entry.step.phase === "full");
  const flakeQuarantine = ranFullPhase
    ? yield* readFlakeQuarantineIncidents(plan.context.repoRoot)
    : A.empty<FlakeQuarantineIncident>();
  if (!A.isReadonlyArrayEmpty(flakeQuarantine)) {
    yield* Console.log(
      `[yeet] recorded ${A.length(flakeQuarantine)} environment-only flake quarantine incident(s) in the verdict`
    );
  }

  const verdict = buildYeetVerdict({
    base: plan.context.base,
    baseFreshness: O.getOrUndefined(extraState.baseFreshness),
    branch: plan.context.branch,
    createdAt,
    executed,
    flakeQuarantine,
    head: plan.context.head,
    indexPath: O.getOrUndefined(indexPath),
    message,
    mode: options.mode,
    outcome,
    packetPaths: pipe(
      artifacts,
      O.map((result) => result.packetPaths),
      O.getOrElse(A.empty<string>)
    ),
    planned: plan.steps,
    runId: runIdForContext(plan.context),
    stash: O.getOrUndefined(extraState.stash),
  });
  const verdictPath = yield* runOutputPathForContext(plan.context, "verdict.json");
  yield* writeTextFile(verdictPath, `${yield* renderJson(verdict)}\n`);
  yield* Console.log(`[yeet] verdict written to ${verdictPath}`);
});

const runPlanExecution = Effect.fn("Yeet.runPlanExecution")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  message: O.Option<string>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const prepareSteps = A.filter(plan.steps, (step) => step.phase === "prepare");
  const feedbackSteps = A.filter(plan.steps, (step) => step.phase === "feedback");
  const commitSteps = A.filter(plan.steps, (step) => step.phase === "commit");
  const earlyPublishSteps = A.filter(plan.steps, (step) => step.phase === "early-publish");
  const fullSteps = A.filter(plan.steps, (step) => step.phase === "full");
  const publishSteps = A.filter(plan.steps, (step) => step.phase === "publish");
  const monitorSteps = A.filter(plan.steps, (step) => step.phase === "monitor");

  const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
  const extras = yield* Ref.make<YeetVerdictExtras>({ baseFreshness: O.none(), stash: O.none() });

  const execution = Effect.gen(function* () {
    const prepareResults = yield* runPhase(plan.context, prepareSteps, recorder);
    if (A.some(prepareResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, prepareSteps, prepareResults, "yeet prepare phase failed.");
    }

    const feedbackResults = yield* runPhase(plan.context, feedbackSteps, recorder);
    if (A.some(feedbackResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, feedbackSteps, feedbackResults, "yeet feedback phase failed.");
    }

    return yield* YeetRunMode.$match(options.mode, {
      repair: () => emptyPlanResult(plan.context),
      verify: () => runVerifyMode(plan.context, fullSteps, options.tier, recorder),
      publish: () =>
        runPublishMode(
          plan,
          message,
          options,
          commitSteps,
          fullSteps,
          earlyPublishSteps,
          publishSteps,
          monitorSteps,
          recorder,
          extras
        ),
      monitor: () => runMonitorMode(plan.context, monitorSteps, recorder, options),
      closeout: () => runCloseoutMode(plan.context, options),
      status: () => runStatusMode(plan.context, options),
      "pre-push-hook": () => runPrePushHookMode(plan.context),
    });
  });

  return yield* execution.pipe(
    Effect.tapError((error) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(plan, options, recorder, extras, "failure", error.message, O.none()).pipe(Effect.ignore)
    ),
    Effect.tap((result) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(
            plan,
            options,
            recorder,
            extras,
            "success",
            `yeet ${options.mode} succeeded.`,
            O.some(result)
          ).pipe(Effect.ignore)
    )
  );
});

const renderPlan = Effect.fn("Yeet.renderPlan")(function* (
  plan: RepoRunPlan,
  json: boolean
): Effect.fn.Return<void, YeetCommandError> {
  if (json) {
    yield* printCommandJson(plan).pipe(Effect.mapError(YeetCommandError.new("Failed to print yeet plan JSON.")));
    return;
  }
  yield* Console.log("yeet plan");
  yield* Console.log(`- branch: ${plan.context.branch}`);
  yield* Console.log(`- base/head: ${plan.context.base}...${plan.context.head}`);
  yield* Console.log(`- artifacts: ${plan.context.packetDir}`);
  for (const step of plan.steps) {
    yield* Console.log(`- ${step.phase}: ${step.label} -> ${step.command} ${A.join(step.args, " ")}`);
  }
});

/**
 * Run yeet with the provided options.
 *
 * @param options - Yeet runtime options.
 * @returns Yeet run result when execution succeeds.
 * @example
 * ```ts
 * import { defaultYeetRunOptions, runYeet } from "@beep/repo-cli/test/Yeet"
 *
 * const result = runYeet(defaultYeetRunOptions({ plan: true }))
 * console.log(result) // example value
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runYeet = Effect.fn("Yeet.runYeet")(function* (
  options: YeetRunOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const message = yield* validateRequiredMessage(options);
  yield* validateStartPrEarlyPrGuard(options);
  const context = yield* hydrateYeetRunContext(options);
  yield* validatePublishBranch(context, options);
  yield* validateMonitorGuards(context, options);
  const forceTurbo =
    options.mode === "repair" || options.mode === "verify" || options.mode === "publish"
      ? yield* lockfileChangedSinceBase(context)
      : false;
  if (forceTurbo) {
    yield* Console.log(
      `[yeet] bun.lock changed since ${context.base}; forcing dependency-sensitive lanes (TURBO_FORCE=true)`
    );
  }
  const plan = buildYeetRunPlanWithMode(
    context,
    message,
    YeetRunPlanModeOptions.make({
      amend: options.amend,
      fast: options.fast,
      forceTurbo,
      mode: options.mode,
      monitor: options.monitor,
      noEdit: options.noEdit,
      pr: options.pr,
      pushOnly: options.pushOnly,
      remote: options.remote,
      startPrEarly: options.startPrEarly,
      tier: options.tier,
    })
  );
  if (options.plan) {
    yield* renderPlan(plan, options.json);
    return yield* emptyPlanResult(context);
  }

  return yield* runPlanExecution(plan, options, message);
});

/**
 * Test-only inputs for building a Yeet run plan without reading repository state.
 *
 * @category testing
 * @since 0.0.0
 */
export class BuildYeetRunPlanTestOptions extends S.Class<BuildYeetRunPlanTestOptions>($I`BuildYeetRunPlanTestOptions`)(
  {
    amend: S.optionalKey(S.Boolean),
    context: RepoRunContext,
    fast: S.optionalKey(S.Boolean),
    forceTurbo: S.optionalKey(S.Boolean),
    message: S.Option(S.String),
    mode: S.optionalKey(YeetRunMode),
    monitor: S.optionalKey(S.Boolean),
    noEdit: S.optionalKey(S.Boolean),
    pr: S.optionalKey(S.Boolean),
    pushOnly: S.optionalKey(S.Boolean),
    remote: S.optionalKey(S.Boolean),
    startPrEarly: S.optionalKey(S.Boolean),
    tier: S.optionalKey(YeetProofTier),
  },
  $I.annote("BuildYeetRunPlanTestOptions", {
    description: "Hydrated test context, optional message, and optional mode for building a Yeet run plan.",
  })
) {}

/**
 * Build a plan for tests without reading repository state.
 *
 * @param options - Hydrated test context, optional message, and optional mode.
 * @returns Ordered Yeet run plan.
 * @category testing
 * @since 0.0.0
 */
export const buildYeetRunPlanForTesting = (options: BuildYeetRunPlanTestOptions): RepoRunPlan =>
  buildYeetRunPlanWithMode(
    options.context,
    options.message,
    YeetRunPlanModeOptions.make({
      amend: options.amend ?? false,
      fast: options.fast ?? false,
      forceTurbo: options.forceTurbo ?? false,
      mode: options.mode ?? "publish",
      monitor: options.monitor ?? false,
      noEdit: options.noEdit ?? false,
      pr: options.pr ?? false,
      pushOnly: options.pushOnly ?? false,
      remote: options.remote ?? false,
      startPrEarly: options.startPrEarly ?? false,
      tier: options.tier ?? "full",
    })
  );
