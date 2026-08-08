/**
 * Yeet command orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { UUID } from "@beep/schema/String";
import * as O from "@beep/utils/Option";
import { Clock, Console, DateTime, Duration, Effect, FileSystem, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printCommandJson } from "../../../internal/cli/Json.ts";
import { GhPrView } from "../../../internal/github/index.ts";
import {
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  repoProofStepDefinition,
  sortedUniquePaths,
} from "../../../internal/repo-run/index.ts";
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
import { appendYeetAttemptJournalEvent, YeetAttemptFinished, YeetAttemptStarted } from "./AttemptJournal.ts";
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
import { runYeetPullRequestCommentMonitor } from "./MonitorComments.ts";
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
import { buildYeetVerdict, YeetExecutedStep, YeetVerdictJson } from "./Verdict.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunPlan } from "../../../internal/repo-run/index.ts";
import type { FlakeQuarantineIncident } from "../../Quality/internal/FlakeQuarantine.ts";
import type { YeetRunOptions, YeetRunResult } from "../Yeet.schemas.ts";
import type { YeetStatusSnapshot } from "./Status.ts";
import type { YeetBaseFreshness, YeetMergeReady, YeetStashState } from "./Verdict.ts";

export { defaultYeetRunOptions } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Handler");

/**
 * The three repository coordinates every yeet run context needs before any
 * turbo work is planned. Structural on purpose: each caller passes its own
 * parsed flag bag rather than importing a shared option type.
 */
interface YeetContextCoordinates {
  readonly base: string;
  readonly head: string;
  readonly packetDir: string;
}

const readOnlyRunContext = (repoRoot: string, branch: string, options: YeetContextCoordinates): RepoRunContext =>
  RepoRunContext.make({
    repoRoot,
    cwd: process.cwd(),
    base: options.base,
    head: options.head,
    branch,
    packetDir: options.packetDir,
    originalArgv: [],
    turbo: emptyTurboPlanSnapshot([]),
  });

/**
 * Hydrate a run context for commands that read the clone instead of planning
 * turbo work.
 *
 * **Details**
 *
 * The porcelain subcommands — sweep, merge, reply, and the merge loop — need the
 * repo root, the checked-out branch, and the packet directory, and nothing else.
 * Skipping {@link collectTurboPlanSnapshot} keeps them off the `turbo run --dry`
 * critical path, which is the whole reason they feel instant next to a publish.
 *
 * **Example** (Hydrate a read-only context)
 *
 * ```ts
 * import { hydrateYeetReadOnlyContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.succeed(hydrateYeetReadOnlyContext)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Base ref, head ref, and packet directory for the run.
 * @returns Run context carrying an empty turbo snapshot.
 * @category utilities
 * @since 0.0.0
 */
export const hydrateYeetReadOnlyContext = Effect.fn("Yeet.hydrateYeetReadOnlyContext")(function* (
  options: YeetContextCoordinates
): Effect.fn.Return<
  RepoRunContext,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const branch = yield* currentYeetBranch(repoRoot);
  return readOnlyRunContext(repoRoot, branch, options);
});

/**
 * Hydrate a shared yeet run context from repository state.
 *
 * **Example** (Hydrate a plan-mode run context)
 *
 * ```ts
 * import { defaultYeetRunOptions, hydrateYeetRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = hydrateYeetRunContext(defaultYeetRunOptions({ plan: true }))
 * console.log(context) // example value
 * ```
 *
 * @param options - Runtime options.
 * @returns Shared run context.
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
    return readOnlyRunContext(repoRoot, branch, options);
  }

  if (options.mode === "status") {
    if (options.remote) {
      yield* refreshBaseRef(repoRoot, options.base);
    }
    return readOnlyRunContext(repoRoot, branch, options);
  }

  if (!options.plan) {
    yield* refreshBaseRef(repoRoot, options.base);
  }
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
    Effect.fnUntraced(function* (step: RepoPlanStep) {
      const fallbackStartedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const [duration, result] = yield* executeStepWithArtifacts(context, step).pipe(Effect.timed);
      const fallbackEndedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
      const elapsedMs = result.elapsedMs ?? Duration.toMillis(duration);
      const timedResult = RepoStepRunResult.make({
        ...result,
        startedAt: result.startedAt ?? fallbackStartedAt,
        endedAt: result.endedAt ?? fallbackEndedAt,
        elapsedMs,
      });
      yield* Ref.update(
        recorder,
        A.append(YeetExecutedStep.make({ durationMs: elapsedMs, result: timedResult, step }))
      );
      return timedResult;
    }),
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

// `--amend --no-edit` reuses the subject of the commit it rewrites, so a
// staged-fix retry legitimately carries no `--message`; every other publish that
// creates or rewrites a commit subject must supply one.
const validatePublishCommitMessage = Effect.fn("Yeet.validatePublishCommitMessage")(function* (
  context: RepoRunContext,
  message: O.Option<string>,
  options: YeetRunOptions
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (O.isSome(message)) {
    return yield* validateCommitMessage(context, message.value);
  }
  if (options.amend && options.noEdit) {
    return;
  }
  return yield* YeetCommandError.make({
    message: "yeet publish requires --message with a conventional commit message for reviewed staged changes.",
    exitCode: 1,
  });
});

/**
 * Decide whether a publish run may proceed without an explicit commit message.
 *
 * @category testing
 * @since 0.0.0
 */
export const validatePublishCommitMessageForTesting = validatePublishCommitMessage;

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
  let skipCommit = yield* shouldSkipCommitForReusablePublish(plan.context, options);
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
    if (publishIntent.kind === "existing-commit") {
      skipCommit = true;
      yield* Console.log(
        `[yeet] skipped commit; clean local HEAD ${Str.takeLeft(12)(publishIntent.commitSha)} is ahead of the publish remote/base`
      );
    } else {
      yield* validatePublishCommitMessage(plan.context, message, options);
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

      return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, extras, skipCommit);
    }

    const preflightSteps = A.filter(publishSteps, (step) => step.id === HEAD_INSTALL_PREFLIGHT_STEP_ID);
    yield* runRequiredPhase(
      plan.context,
      preflightSteps,
      recorder,
      "yeet clean-HEAD install preflight failed before proof and push."
    );

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

    return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, extras, skipCommit);
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
  extras: Ref.Ref<YeetVerdictExtras>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet monitor failed.").pipe(
    Effect.catch((error) => failWithRerunGuidance(context, error))
  );
  const snapshot = yield* printOperatorStatusSummary(context, true);
  yield* Ref.update(extras, (state) => ({ ...state, mergeReady: snapshot.mergeReady }));
  yield* assertNoUnresolvedReviewThreads(snapshot);
  return yield* emptyPlanResult(context);
});

const printOperatorStatusSummary = Effect.fn("Yeet.printOperatorStatusSummary")(function* (
  context: RepoRunContext,
  remote: boolean
): Effect.fn.Return<
  YeetStatusSnapshot,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* collectYeetStatus(context, remote);
  yield* writeYeetStatusSnapshot(snapshot);
  yield* Console.log(renderYeetStatusSummary(snapshot));
  return snapshot;
});

const rerunGuidanceSuffix = (snapshot: YeetStatusSnapshot): string =>
  snapshot.remote.rerunFailedCommand === undefined
    ? Str.empty
    : `\nSame-SHA rerun decision: ${snapshot.remote.rerunFailedDecision ?? "rerun failed jobs"}.\nRun: ${snapshot.remote.rerunFailedCommand}`;

const failWithRerunGuidance = Effect.fn("Yeet.failWithRerunGuidance")(function* (
  context: RepoRunContext,
  error: YeetCommandError
): Effect.fn.Return<
  never,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const snapshot = yield* printOperatorStatusSummary(context, true);
  return yield* YeetCommandError.make({
    message: `${error.message}${rerunGuidanceSuffix(snapshot)}`,
    ...O.getSomesStruct({
      command: O.fromUndefinedOr(error.command),
      exitCode: O.fromUndefinedOr(error.exitCode),
    }),
  });
});

const assertNoUnresolvedReviewThreads = Effect.fn("Yeet.assertNoUnresolvedReviewThreads")(function* (
  snapshot: YeetStatusSnapshot
): Effect.fn.Return<void, YeetCommandError> {
  const unresolved = snapshot.remote.unresolvedReviewThreads ?? A.empty<string>();
  if (A.isReadonlyArrayEmpty(unresolved)) {
    return;
  }
  return yield* YeetCommandError.make({
    message: `Yeet merge readiness requires zero unresolved review threads; found ${A.length(unresolved)}: ${A.join(unresolved, ", ")}`,
    command: "bun run beep yeet closeout --summary",
    exitCode: 1,
  });
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
  // The planner emits monitor steps only under `--monitor`, so every other
  // publish arrives here with an empty list. Falling through decoded the absent
  // PR context and failed the whole run with "Failed to decode pull request
  // number for yeet monitor" *after* a full success; an empty monitor phase is
  // a no-op by contract.
  if (A.isReadonlyArrayEmpty(monitorSteps)) {
    return;
  }
  const contextSteps = A.filter(monitorSteps, (step) => step.id === "monitor:01-pr-context");
  const checkSteps = A.filter(monitorSteps, (step) => step.id === "monitor:02-pr-checks-watch");
  const contextResults = yield* runPhase(context, contextSteps, recorder);
  if (A.some(contextResults, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, contextSteps, contextResults, failureMessage);
  }
  const contextOutput = pipe(
    contextResults,
    A.head,
    O.flatMap((result) => O.fromUndefinedOr(result.output)),
    O.getOrElse(() => Str.empty)
  );
  const pullRequestNumber = yield* S.decodeEffect(S.fromJsonString(GhPrView))(contextOutput).pipe(
    Effect.map((pullRequest) => pullRequest.number),
    Effect.mapError(YeetCommandError.new("Failed to decode pull request number for yeet monitor."))
  );
  yield* Effect.raceFirst(
    runRequiredPhase(context, checkSteps, recorder, failureMessage),
    runYeetPullRequestCommentMonitor(context, pullRequestNumber)
  );
});

const runPublishMonitorAndResult = Effect.fn("Yeet.runPublishMonitorAndResult")(function* (
  context: RepoRunContext,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  skipCommit: boolean
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  yield* runMonitorPhase(context, monitorSteps, recorder, "yeet publish monitor phase failed.").pipe(
    Effect.catch((error) => failWithRerunGuidance(context, error))
  );
  if (!A.isReadonlyArrayEmpty(monitorSteps)) {
    const snapshot = yield* printOperatorStatusSummary(context, true);
    yield* Ref.update(extras, (state) => ({ ...state, mergeReady: snapshot.mergeReady }));
    yield* assertNoUnresolvedReviewThreads(snapshot);
  }
  return yield* publishResult(context, !skipCommit);
});

/**
 * Run the monitor phase in isolation.
 *
 * @category testing
 * @since 0.0.0
 */
export const runMonitorPhaseForTesting = runMonitorPhase;

/**
 * Run the publish tail — monitor phase, operator summary, and run result.
 *
 * @category testing
 * @since 0.0.0
 */
export const runPublishMonitorAndResultForTesting = runPublishMonitorAndResult;

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
  readonly mergeReady: O.Option<YeetMergeReady>;
  readonly stash: O.Option<YeetStashState>;
};

// Only the pre-push proof runs the quality lane group that deletes this
// artifact at group start and rewrites it on quarantine. Other full-phase
// steps (review-fix proof, head-install preflight) never touch it, so a
// verdict may read it only after a successful pre-push proof step in the same
// run — anything else could attach a previous run's incidents.
const PRE_PUSH_PROOF_STEP_ID = repoProofStepDefinition("pre-push").id;

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
  attempt: YeetAttemptStarted,
  startedAtEpochMillis: number,
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
  const endedAtEpochMillis = yield* Clock.currentTimeMillis;
  const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
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

  const ranPrePushProof = A.some(
    executed,
    (entry) => entry.step.id === PRE_PUSH_PROOF_STEP_ID && entry.result.exitCode === 0
  );
  const flakeQuarantine = ranPrePushProof
    ? yield* readFlakeQuarantineIncidents(plan.context.repoRoot)
    : A.empty<FlakeQuarantineIncident>();
  if (!A.isReadonlyArrayEmpty(flakeQuarantine)) {
    yield* Console.log(
      `[yeet] recorded ${A.length(flakeQuarantine)} environment-only flake quarantine incident(s) in the verdict`
    );
  }

  const failedExecution = A.findFirst(executed, (entry) => entry.result.exitCode !== 0);
  const executedIds = A.map(executed, (entry) => entry.step.id);
  const failedStepId = pipe(
    failedExecution,
    O.map((entry) => entry.step.id),
    O.orElse(() =>
      outcome === "failure"
        ? pipe(
            plan.steps,
            A.findFirst((step) => !A.contains(executedIds, step.id)),
            O.map((step) => step.id)
          )
        : O.none()
    )
  );

  const verdict = buildYeetVerdict({
    attemptId: O.some(attempt.attemptId),
    base: plan.context.base,
    baseFreshness: O.getOrUndefined(extraState.baseFreshness),
    branch: plan.context.branch,
    createdAt: endedAt,
    startedAt: O.some(attempt.startedAt),
    endedAt: O.some(endedAt),
    elapsedMs: O.some(endedAtEpochMillis - startedAtEpochMillis),
    executed,
    failurePolicy: options.collectAll ? "collect-all" : "fail-fast",
    flakeQuarantine,
    head: plan.context.head,
    indexPath: O.getOrUndefined(indexPath),
    message,
    mode: options.mode,
    // Only the publish/monitor paths observe a live status snapshot, so runs
    // that never read the pull request omit the key rather than asserting an
    // unknown merge readiness.
    mergeReady: O.getOrUndefined(extraState.mergeReady),
    outcome,
    packetPaths: pipe(
      artifacts,
      O.map((result) => result.packetPaths),
      O.getOrElse(A.empty<string>)
    ),
    planned: plan.steps,
    runId: runIdForContext(plan.context),
    stash: O.getOrUndefined(extraState.stash),
    failedStepId: O.getOrUndefined(failedStepId),
    failureKind: outcome === "failure" ? (O.isSome(failedExecution) ? "step-exit" : "handler-error") : undefined,
  });
  const verdictPath = yield* runOutputPathForContext(plan.context, "verdict.json");
  // Encode through the verdict's own schema codec: a generic JSON render of the
  // decoded instance writes Option fields as `{"_id":"Option",...}`, which the
  // status reader then rejects as "verdict artifact could not be decoded".
  const verdictJson = yield* YeetVerdictJson.encode(verdict).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode the yeet verdict artifact."))
  );
  yield* writeTextFile(verdictPath, `${verdictJson}\n`);
  yield* appendYeetAttemptJournalEvent(
    plan.context,
    YeetAttemptFinished.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-finished",
      attemptId: attempt.attemptId,
      recordedAt: endedAt,
      verdict,
    })
  );
  yield* Console.log(`[yeet] verdict written to ${verdictPath}`);
});

/**
 * Verdict facts collected outside the step recorder during one run.
 *
 * @category testing
 * @since 0.0.0
 */
export type YeetVerdictExtrasForTesting = YeetVerdictExtras;

/**
 * Write the run verdict artifact and append its attempt-journal record.
 *
 * @category testing
 * @since 0.0.0
 */
export const writeRunVerdictForTesting = writeRunVerdict;

const runPlanExecution = Effect.fn("Yeet.runPlanExecution")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  message: O.Option<string>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (options.mode === "status") {
    return yield* runStatusMode(plan.context, options);
  }
  const startedAtEpochMillis = yield* Clock.currentTimeMillis;
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const attemptId = yield* S.decodeEffect(UUID)(randomUUID()).pipe(
    Effect.mapError(YeetCommandError.new("Failed to generate Yeet attempt id."))
  );
  const attempt = YeetAttemptStarted.make({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId,
    runId: runIdForContext(plan.context),
    branch: plan.context.branch,
    base: plan.context.base,
    head: plan.context.head,
    mode: options.mode,
    startedAt,
  });
  yield* appendYeetAttemptJournalEvent(plan.context, attempt);
  const executionSteps = A.map(plan.steps, (step) =>
    step.id === "advisory:01-fallow-feedback"
      ? RepoPlanStep.make({ ...step, args: [...step.args, "--run-started-at", startedAt] })
      : step
  );
  const prepareSteps = A.filter(executionSteps, (step) => step.phase === "prepare");
  const feedbackSteps = A.filter(executionSteps, (step) => step.phase === "feedback");
  const commitSteps = A.filter(executionSteps, (step) => step.phase === "commit");
  const earlyPublishSteps = A.filter(executionSteps, (step) => step.phase === "early-publish");
  const fullSteps = A.filter(executionSteps, (step) => step.phase === "full");
  const publishSteps = A.filter(executionSteps, (step) => step.phase === "publish");
  const monitorSteps = A.filter(executionSteps, (step) => step.phase === "monitor");

  const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());
  const extras = yield* Ref.make<YeetVerdictExtras>({
    baseFreshness: O.none(),
    mergeReady: O.none(),
    stash: O.none(),
  });

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
      monitor: () => runMonitorMode(plan.context, monitorSteps, recorder, extras),
      closeout: () => runCloseoutMode(plan.context, options),
      status: () => runStatusMode(plan.context, options),
      "pre-push-hook": () => runPrePushHookMode(plan.context),
    });
  });

  return yield* execution.pipe(
    Effect.tapError((error) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(
            plan,
            options,
            attempt,
            startedAtEpochMillis,
            recorder,
            extras,
            "failure",
            error.message,
            O.none()
          ).pipe(
            Effect.tapError((journalError) =>
              Console.error(`[yeet] failed to write terminal verdict/journal: ${journalError.message}`)
            ),
            Effect.ignore
          )
    ),
    Effect.tap((result) =>
      options.mode === "status"
        ? Effect.void
        : writeRunVerdict(
            plan,
            options,
            attempt,
            startedAtEpochMillis,
            recorder,
            extras,
            "success",
            `yeet ${options.mode} succeeded.`,
            O.some(result)
          )
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
 * **Example** (Run the yeet workflow)
 *
 * ```ts
 * import { defaultYeetRunOptions, runYeet } from "@beep/repo-cli/test/Yeet"
 *
 * const result = runYeet(defaultYeetRunOptions({ plan: true }))
 * console.log(result) // example value
 * ```
 *
 * @param options - Yeet runtime options.
 * @returns Yeet run result when execution succeeds.
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
      collectAll: options.collectAll,
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
    collectAll: S.optionalKey(S.Boolean),
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
      collectAll: options.collectAll ?? false,
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
