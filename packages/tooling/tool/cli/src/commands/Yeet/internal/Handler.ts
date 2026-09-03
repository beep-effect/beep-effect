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
import { Clock, Console, Crypto, DateTime, Duration, Effect, FileSystem, flow, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { printCommandJson } from "../../../internal/cli/Json.ts";
import { GhPrView } from "../../../internal/github/index.ts";
import {
  AdmissionRequest,
  admissionTokenWeight,
  commandTextForStep,
  noAdmissionOriginGate,
  QualitySchedulerError,
  RepoPlanStep,
  RepoRunContext,
  RepoStepRunResult,
  repoProofStepDefinition,
  sortedUniquePaths,
  withQualityAdmission,
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
  safeArtifactName,
} from "./ArtifactPaths.ts";
import { appendYeetAttemptJournalEvent, YeetAttemptFinished, YeetAttemptStarted } from "./AttemptJournal.ts";
import { PrCloseoutOptions, PrCloseoutReportJson, runPrCloseout } from "./Closeout.ts";
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
  writeIssueArtifacts,
  writeTextFile,
} from "./IssueArtifacts.ts";
import { recordYeetLocalShardOutcome, YeetLocalShardOutcome } from "./LocalShardPoison.ts";
import { installYeetMergePreview, withYeetMergePreview, yeetMergedPreviewContext } from "./MergedPreview.ts";
import {
  awaitYeetCheckRegistration,
  isAwaitingYeetCheckRegistration,
  renderYeetCheckRegistrationExhausted,
  YEET_CHECK_REGISTRATION_BACKOFF,
} from "./MonitorChecks.ts";
import { runYeetPullRequestCommentMonitor } from "./MonitorComments.ts";
import {
  buildYeetRunPlanWithMode,
  CI_PARITY_STEP_ID,
  emptyTurboPlanSnapshot,
  YeetProofTier,
  YeetRunMode,
  YeetRunPlanModeOptions,
} from "./Planner.ts";
import { enforcePortfolioIndexPublishIntent } from "./PortfolioIndexGuard.ts";
import {
  acquireFullProofFallbackLockOrObserveAtPath,
  assertReusableVerifiedState,
  proofLockPathForContext,
  releaseProofLock,
  retireFullProofLockOrObserveAtPath,
  writeVerifiedState,
} from "./ProofState.ts";
import { recordMonitoredPrSession } from "./ProvenanceFooter.ts";
import {
  collectPublishIntent,
  enforceBaseFreshness,
  failPublishScopeWithPacket,
  formatPublishPaths,
  postCommitProofChangedAfterEarlyPushMessage,
  prePushLocalShasFromStdin,
  prePushShaMismatches,
  restorePublishStashOnFailure,
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
import type { AdmissionOriginGate, MemoryStats, RepoRunPlan } from "../../../internal/repo-run/index.ts";
import type { FlakeQuarantineIncident } from "../../Quality/internal/FlakeQuarantine.ts";
import type { YeetPublishIntent, YeetRunOptions, YeetRunResult } from "../Yeet.schemas.ts";
import type { PrCloseoutReport } from "./Closeout.ts";
import type { YeetStatusSnapshot } from "./Status.ts";
import type { YeetBaseFreshness, YeetMergeReady, YeetStashState } from "./Verdict.ts";

export { defaultYeetRunOptions } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Handler");

const isNamedLocalProofShard = (step: RepoPlanStep): boolean =>
  step.mutability === "readonly" && (step.phase === "feedback" || step.phase === "full");

const recordLocalShardOutcome = Effect.fn("Yeet.recordLocalShardOutcome")(function* (
  context: RepoRunContext,
  step: RepoPlanStep,
  result: RepoStepRunResult
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!isNamedLocalProofShard(step)) {
    return;
  }

  yield* recordYeetLocalShardOutcome(
    context.repoRoot,
    YeetLocalShardOutcome.make({
      command: result.commandText,
      exitCode: result.exitCode,
      headSha: yield* currentCommitSha(context),
      shard: step.id,
    })
  );
});

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

const executeMeasuredStep = Effect.fn("Yeet.executeMeasuredStep")(function* (
  context: RepoRunContext,
  step: RepoPlanStep
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!(yield* fs.exists("/usr/bin/time").pipe(Effect.orElseSucceed(() => false)))) {
    return yield* executeStepWithArtifacts(context, step);
  }
  const artifactDir = yield* artifactDirForContext(context);
  const rssDir = path.join(artifactDir, "rss");
  const rssPath = path.join(rssDir, `${safeArtifactName(step.id)}-${randomUUID()}.txt`);
  yield* fs.makeDirectory(rssDir, { recursive: true });
  const measuredStep = RepoPlanStep.make({
    ...step,
    command: "/usr/bin/time",
    args: ["-f", "%M", "-o", rssPath, "--", step.command, ...step.args],
  });
  const result = yield* executeStepWithArtifacts(context, measuredStep);
  const peakRssKb = yield* fs.readFileString(rssPath).pipe(
    Effect.map(Str.trim),
    Effect.map((value) => globalThis.Number.parseInt(value, 10)),
    Effect.option,
    Effect.map(O.filter(globalThis.Number.isFinite))
  );
  yield* fs.remove(rssPath).pipe(Effect.ignore);
  return RepoStepRunResult.make({
    ...result,
    commandText: commandTextForStep(step),
    ...O.getSomesStruct({ peakRssKb }),
  });
});

const runPhaseStep = Effect.fn("Yeet.runPhaseStep")(function* (
  context: RepoRunContext,
  step: RepoPlanStep,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
) {
  const fallbackStartedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const [duration, result] = yield* executeMeasuredStep(context, step).pipe(
    Effect.mapError(YeetCommandError.new(`RSS-instrumented ${step.id} failed.`)),
    Effect.timed
  );
  const fallbackEndedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const elapsedMs = result.elapsedMs ?? Duration.toMillis(duration);
  const timedResult = RepoStepRunResult.make({
    ...result,
    startedAt: result.startedAt ?? fallbackStartedAt,
    endedAt: result.endedAt ?? fallbackEndedAt,
    elapsedMs,
  });
  yield* Ref.update(recorder, A.append(YeetExecutedStep.make({ durationMs: elapsedMs, result: timedResult, step })));
  yield* recordLocalShardOutcome(context, step, timedResult).pipe(
    Effect.catch((error) =>
      Console.error(`[yeet] failed to update the local-shard inbox for ${step.id}: ${error.message}`)
    )
  );
  return timedResult;
});

const runCiParityStep = Effect.fn("Yeet.runCiParityStep")(function* (
  context: RepoRunContext,
  step: RepoPlanStep,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
) {
  return yield* withYeetMergePreview(
    context,
    Effect.fnUntraced(function* (preview) {
      yield* Console.log(
        `[yeet] CI parity on merge preview ${Str.takeLeft(12)(preview.commitSha)} against ${Str.takeLeft(12)(preview.baseSha)}`
      );
      yield* installYeetMergePreview(context, preview.worktreePath);
      const previewStep = RepoPlanStep.make({ ...step, cwd: preview.worktreePath });
      return yield* runPhaseStep(context, previewStep, recorder);
    })
  );
});

const runProofPhase = Effect.fn("Yeet.runProofPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  let results = A.empty<RepoStepRunResult>();
  for (const step of steps) {
    const result = yield* step.id === CI_PARITY_STEP_ID
      ? runCiParityStep(context, step, recorder)
      : runPhaseStep(context, step, recorder);
    results = A.append(results, result);
    if (result.exitCode !== 0) {
      return results;
    }
  }
  return results;
});

interface FullProofAdmissionIntent {
  readonly priority: "publish" | "verify";
}

const defaultFullProofAdmissionIntent: FullProofAdmissionIntent = { priority: "verify" };

const isQualitySchedulerError = S.is(QualitySchedulerError);

const schedulerErrorToYeetError = <Success, Error, Requirements>(
  effect: Effect.Effect<Success, Error | QualitySchedulerError, Requirements>
): Effect.Effect<Success, Error | YeetCommandError, Requirements> =>
  Effect.mapError(effect, (error) =>
    isQualitySchedulerError(error)
      ? YeetCommandError.make({ message: error.message, command: "bun run beep yeet verify", exitCode: 1 })
      : error
  );

type FullProofAdmissionOriginLease = O.Option<Parameters<typeof releaseProofLock>[0]>;

const retiredProofLockLease = O.none<Parameters<typeof releaseProofLock>[0]>();

const fullProofAdmissionOriginGate = (
  lockPath: string,
  context: RepoRunContext,
  command: string
): AdmissionOriginGate<
  FullProofAdmissionOriginLease,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
> => ({
  tryAcquire: retireFullProofLockOrObserveAtPath(lockPath).pipe(Effect.map(O.as(retiredProofLockLease))),
  tryAcquireFallback: retireFullProofLockOrObserveAtPath(lockPath).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.succeed(O.none<FullProofAdmissionOriginLease>()),
        onSome: () =>
          acquireFullProofFallbackLockOrObserveAtPath(lockPath, context, command).pipe(Effect.map(O.map(O.some))),
      })
    )
  ),
  release: flow(
    O.match({
      onNone: () => Effect.void,
      onSome: releaseProofLock,
    })
  ),
});

// Machine-wide weighted admission (ship-velocity D1) becomes the sole
// current-version concurrency authority after the fail-closed legacy origin
// lock is retired. Hosts below the scheduler envelope retain an exclusive
// fallback lock through the gate's fallback acquisition.
const runWithFullProofCoordinator = Effect.fn("Yeet.runWithFullProofCoordinator")(function* <
  Success,
  Error,
  Requirements,
>(
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>,
  use: Effect.Effect<Success, Error, Requirements>,
  intent?: FullProofAdmissionIntent
) {
  const resolved = intent ?? defaultFullProofAdmissionIntent;
  const path = yield* Path.Path;
  const lockPath = yield* proofLockPathForContext(context);
  const kind = A.some(proofSteps, (step) => step.id === CI_PARITY_STEP_ID) ? "merged-preview" : "full-proof";
  const request = AdmissionRequest.make({
    kind,
    weightTokens: admissionTokenWeight(kind),
    priority: resolved.priority,
    originKey: path.basename(lockPath, ".lock"),
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    command: A.join(A.map(proofSteps, commandTextForStep), " && "),
  });
  const originGate = fullProofAdmissionOriginGate(lockPath, context, request.command);
  return yield* schedulerErrorToYeetError(withQualityAdmission(request, originGate, use));
});

const runWithMergedPreviewAdmission = Effect.fn("Yeet.runWithMergedPreviewAdmission")(function* <
  Success,
  Error,
  Requirements,
>(context: RepoRunContext, use: Effect.Effect<Success, Error, Requirements>) {
  const path = yield* Path.Path;
  const lockPath = yield* proofLockPathForContext(context);
  const request = AdmissionRequest.make({
    kind: "merged-preview",
    weightTokens: admissionTokenWeight("merged-preview"),
    priority: "verify",
    originKey: path.basename(lockPath, ".lock"),
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    command: "bun run beep yeet verify --merged",
  });
  const originGate = fullProofAdmissionOriginGate(lockPath, context, request.command);
  return yield* schedulerErrorToYeetError(withQualityAdmission(request, originGate, use));
});

// Review-fix loops take one admission token (class-capped at three concurrent
// leases) but never the per-origin proof lock, preserving the cheaper loop
// lane while a sibling full proof runs.
const runWithReviewFixAdmission = Effect.fn("Yeet.runWithReviewFixAdmission")(function* <Success, Error, Requirements>(
  context: RepoRunContext,
  use: Effect.Effect<Success, Error, Requirements>
) {
  const request = AdmissionRequest.make({
    kind: "review-fix",
    weightTokens: admissionTokenWeight("review-fix"),
    priority: "verify",
    originKey: "",
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    command: "bun run beep yeet verify --tier review-fix",
  });
  return yield* schedulerErrorToYeetError(withQualityAdmission(request, noAdmissionOriginGate, use));
});

/**
 * Run proof steps with fail-fast behavior between top-level proof steps.
 *
 * **Example** (Reference the proof-phase test helper)
 *
 * ```ts
 * import { runProofPhaseForTesting } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const helper = Effect.succeed(runProofPhaseForTesting)
 * console.log(Effect.isEffect(helper)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runProofPhaseForTesting = runProofPhase;

/**
 * Run an effect while holding the cross-checkout full-proof coordinator.
 *
 * **Example** (Reference the coordinator-scope test helper)
 *
 * ```ts
 * import { runWithFullProofCoordinatorForTesting } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const helper = Effect.succeed(runWithFullProofCoordinatorForTesting)
 * console.log(Effect.isEffect(helper)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runWithFullProofCoordinatorForTesting = runWithFullProofCoordinator;

const runPhase = Effect.fn("Yeet.runPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  ReadonlyArray<RepoStepRunResult>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.forEach(steps, (step) => runPhaseStep(context, step, recorder), { concurrency: 1 });
});

const runVerifyMode = Effect.fn("Yeet.runVerifyMode")(function* (
  context: RepoRunContext,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  tier: YeetProofTier,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const verifyResults = yield* runProofPhase(context, fullSteps, recorder);
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

const runRequiredProofPhase = Effect.fn("Yeet.runRequiredProofPhase")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string
) {
  const results = yield* runProofPhase(context, steps, recorder);
  if (A.some(results, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(context, steps, results, failureMessage);
  }
  yield* writeVerifiedState(context, "full", steps);
});

const ensureRequestedPullRequest = Effect.fn("Yeet.ensureRequestedPullRequest")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>
) {
  yield* ensurePullRequest(
    context,
    recorder,
    A.findFirst(steps, (step) => step.id === "publish:02-pr-create"),
    A.findFirst(steps, (step) => step.id === "publish:03-pr-provenance-stamp")
  );
});

const reusablePublishMaySkipCommit = (options: YeetRunOptions): boolean =>
  options.reuseVerified && (options.pushOnly || (options.amend && options.noEdit));

const reusablePublishStagingIsClean = Effect.fn("Yeet.reusablePublishStagingIsClean")(function* (
  context: RepoRunContext,
  options: YeetRunOptions,
  stagedPaths: ReadonlyArray<string>
): Effect.fn.Return<
  boolean,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (A.isReadonlyArrayEmpty(stagedPaths)) return true;
  if (!options.pushOnly) return false;
  return yield* failPublishScopeWithPacket(context, {
    message:
      "yeet publish --push-only --reuse-verified refuses staged changes. Commit or unstage these files before pushing an already-verified commit.",
    paths: stagedPaths,
    remediation: "Commit the staged files through a normal publish, or unstage them, then retry --push-only.",
    subCategory: "reuse-staged",
  });
});

const requireCleanReusablePublishWorktree = Effect.fn("Yeet.requireCleanReusablePublishWorktree")(function* (
  context: RepoRunContext,
  options: YeetRunOptions,
  changedPaths: ReadonlyArray<string>
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (A.isReadonlyArrayEmpty(changedPaths)) return;
  return yield* failPublishScopeWithPacket(context, {
    message: options.pushOnly
      ? "yeet publish --push-only --reuse-verified found uncommitted changes."
      : "yeet publish --reuse-verified found uncommitted changes but no staged amend intent.",
    paths: changedPaths,
    remediation:
      "Commit, stash, or remove the uncommitted changes so the worktree exactly matches the verified commit, then retry.",
    subCategory: "reuse-dirty",
  });
});

const shouldSkipCommitForReusablePublish = Effect.fn("Yeet.shouldSkipCommitForReusablePublish")(function* (
  context: RepoRunContext,
  options: YeetRunOptions
): Effect.fn.Return<
  boolean,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!reusablePublishMaySkipCommit(options)) return false;

  const stagedPaths = yield* collectStagedPublishPaths(context.repoRoot);
  if (!(yield* reusablePublishStagingIsClean(context, options, stagedPaths))) return false;

  const unstagedPaths = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untrackedPaths = yield* collectUntrackedPaths(context.repoRoot);
  const changedPaths = sortedUniquePaths([...unstagedPaths, ...untrackedPaths]);
  yield* requireCleanReusablePublishWorktree(context, options, changedPaths);

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

type PreparedPublishCommit = readonly [skipCommit: boolean, stash: O.Option<YeetStashState>];

const stageAndCommitPublishIntent = Effect.fn("Yeet.stageAndCommitPublishIntent")(function* (
  plan: RepoRunPlan,
  message: O.Option<string>,
  options: YeetRunOptions,
  commitSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  publishIntent: YeetPublishIntent
): Effect.fn.Return<
  PreparedPublishCommit,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (publishIntent.kind === "existing-commit") {
    yield* Console.log(
      `[yeet] skipped commit; clean local HEAD ${Str.takeLeft(12)(publishIntent.commitSha)} is ahead of the publish remote/base`
    );
    return [true, O.none()];
  }
  yield* validatePublishCommitMessage(plan.context, message, options);
  yield* stageReviewedPublishIntent(plan.context, publishIntent, options.stagedOnly);
  const stash = options.stagedOnly ? yield* stashUnstagedWorktree(plan.context) : O.none<YeetStashState>();
  if (O.isSome(stash)) yield* Ref.update(extras, (state) => ({ ...state, stash }));
  yield* Effect.gen(function* () {
    yield* enforcePortfolioIndexPublishIntent(plan.context, publishIntent);
    const commitResults = yield* runPhase(plan.context, commitSteps, recorder);
    if (A.some(commitResults, (result) => result.exitCode !== 0)) {
      return yield* failWithIssueArtifacts(plan.context, commitSteps, commitResults, "yeet commit phase failed.");
    }
  }).pipe(restorePublishStashOnFailure({ context: plan.context, stash }));
  return [false, stash];
});

const preparePublishCommit = Effect.fn("Yeet.preparePublishCommit")(function* (
  plan: RepoRunPlan,
  message: O.Option<string>,
  options: YeetRunOptions,
  commitSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  skipCommit: boolean
): Effect.fn.Return<
  PreparedPublishCommit,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (skipCommit) {
    yield* Console.log("[yeet] skipped commit; exact reusable proof state matches the current clean commit");
    return [true, O.none()];
  }
  const publishIntent = yield* collectPublishIntent(plan.context, options.stagedOnly);
  return yield* stageAndCommitPublishIntent(plan, message, options, commitSteps, recorder, extras, publishIntent);
});

const runStartPrEarlyPublishPhases = Effect.fn("Yeet.runStartPrEarlyPublishPhases")(function* (
  plan: RepoRunPlan,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  earlyPublishSteps: ReadonlyArray<RepoPlanStep>,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  skipCommit: boolean
) {
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
    (step) =>
      step.id !== "publish:02-pr-create" &&
      step.id !== "publish:03-pr-provenance-stamp" &&
      step.id !== HEAD_INSTALL_PREFLIGHT_STEP_ID
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
  yield* ensureRequestedPullRequest(plan.context, plan.steps, recorder);
  yield* runWithFullProofCoordinator(
    plan.context,
    fullSteps,
    Effect.gen(function* () {
      yield* runRequiredProofPhase(
        plan.context,
        fullSteps,
        recorder,
        "yeet publish --start-pr-early proof failed after pushing the commit. Fix the issue in a follow-up commit and publish again."
      );
      yield* validatePostCommitProofDidNotChangeWorktree(plan.context, postCommitProofChangedAfterEarlyPushMessage);
    }),
    { priority: "publish" }
  );
  return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, extras, skipCommit);
});

const runStandardPublishPhases = Effect.fn("Yeet.runStandardPublishPhases")(function* (
  plan: RepoRunPlan,
  options: YeetRunOptions,
  fullSteps: ReadonlyArray<RepoPlanStep>,
  publishSteps: ReadonlyArray<RepoPlanStep>,
  monitorSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  extras: Ref.Ref<YeetVerdictExtras>,
  skipCommit: boolean
) {
  yield* runWithFullProofCoordinator(
    plan.context,
    fullSteps,
    Effect.gen(function* () {
      const preflightSteps = A.filter(publishSteps, (step) => step.id === HEAD_INSTALL_PREFLIGHT_STEP_ID);
      yield* runRequiredPhase(
        plan.context,
        preflightSteps,
        recorder,
        "yeet clean-HEAD install preflight failed before proof and push."
      );
      if (options.reuseVerified) {
        yield* Console.log("[yeet] skipped local full proof after exact reusable proof-state match");
      } else {
        const fullResults = yield* runProofPhase(plan.context, fullSteps, recorder);
        if (A.some(fullResults, (result) => result.exitCode !== 0)) {
          return yield* failWithIssueArtifacts(
            plan.context,
            fullSteps,
            fullResults,
            "yeet publish proof failed after creating the local commit. Fix the issue, then amend or reset the commit that has not yet been pushed before retrying."
          );
        }
        yield* writeVerifiedState(plan.context, "full", fullSteps);
      }
      yield* validatePostCommitProofDidNotChangeWorktree(plan.context);
    }),
    { priority: "publish" }
  );

  yield* warnOnMismatchedPublishUpstream(plan.context);
  const pushSteps = A.filter(
    publishSteps,
    (step) =>
      step.id !== "publish:02-pr-create" &&
      step.id !== "publish:03-pr-provenance-stamp" &&
      step.id !== HEAD_INSTALL_PREFLIGHT_STEP_ID
  );
  const publishResults = yield* runPhase(plan.context, pushSteps, recorder);
  if (A.some(publishResults, (result) => result.exitCode !== 0)) {
    return yield* failWithIssueArtifacts(plan.context, pushSteps, publishResults, "yeet publish phase failed.");
  }
  if (options.pr) {
    yield* ensureRequestedPullRequest(plan.context, plan.steps, recorder);
  }
  return yield* runPublishMonitorAndResult(plan.context, monitorSteps, recorder, extras, skipCommit);
});

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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | MemoryStats
> {
  const reusableSkipCommit = yield* shouldSkipCommitForReusablePublish(plan.context, options);
  if (options.reuseVerified) yield* assertReusableVerifiedState(plan.context);

  const freshness = yield* enforceBaseFreshness(plan.context, options);
  yield* Ref.update(extras, (state) => ({ ...state, baseFreshness: O.some(freshness) }));
  const [skipCommit, stash] = yield* preparePublishCommit(
    plan,
    message,
    options,
    commitSteps,
    recorder,
    extras,
    reusableSkipCommit
  );

  const runPostCommitPhases = options.startPrEarly
    ? runStartPrEarlyPublishPhases(plan, fullSteps, earlyPublishSteps, monitorSteps, recorder, extras, skipCommit)
    : runStandardPublishPhases(plan, options, fullSteps, publishSteps, monitorSteps, recorder, extras, skipCommit);

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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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

// A pushed head whose checks have not registered yet is not a head with
// nothing to watch. The watch re-attempts on a bounded backoff, and only an
// exhausted backoff lets the empty answer stand — as a failure naming that
// condition, never as a pass.
const runMonitorCheckWatch = Effect.fn("Yeet.runMonitorCheckWatch")(function* (
  context: RepoRunContext,
  checkSteps: ReadonlyArray<RepoPlanStep>,
  recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>,
  failureMessage: string,
  delays: ReadonlyArray<Duration.Duration> = YEET_CHECK_REGISTRATION_BACKOFF
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  // `runPhase` appends to the recorder, and the recorder is what the verdict,
  // the PR body, and `yeet status` all read. A retried attempt must therefore
  // REPLACE the previous attempt's record rather than add to it: otherwise one
  // step id carries both a failed entry (no checks registered yet) and a passed
  // one, and every downstream surface reports the same lane as both — the
  // misattributed-hint class this packet already has receipts for. Rewinding to
  // the pre-attempt snapshot before each try makes the last attempt the only
  // one that survives.
  const beforeAttempts = yield* Ref.get(recorder);
  const results = yield* Ref.set(recorder, beforeAttempts).pipe(
    Effect.andThen(runPhase(context, checkSteps, recorder)),
    awaitYeetCheckRegistration(delays)
  );
  if (A.every(results, (result) => result.exitCode === 0)) {
    return;
  }
  return yield* failWithIssueArtifacts(
    context,
    checkSteps,
    results,
    isAwaitingYeetCheckRegistration(results)
      ? `${failureMessage} ${renderYeetCheckRegistrationExhausted(delays)}`
      : failureMessage
  );
});

/**
 * Run the monitor check watch in isolation, with an injectable backoff.
 *
 * @category testing
 * @since 0.0.0
 */
export const runMonitorCheckWatchForTesting = runMonitorCheckWatch;

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
  yield* recordMonitoredPrSession(context, pullRequestNumber);
  yield* Effect.raceFirst(
    runMonitorCheckWatch(context, checkSteps, recorder, failureMessage),
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

// Encoded through the artifact schema so Option fields (reviewedHeadSha) land
// in the optional-key form `yeet status` decodes, not as raw Option objects.
const writePrCloseoutReport = Effect.fn("Yeet.writePrCloseoutReport")(function* (
  context: RepoRunContext,
  report: PrCloseoutReport
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const reportPath = yield* runOutputPathForContext(context, "pr-closeout.json");
  const json = yield* PrCloseoutReportJson.encode(report).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode yeet PR closeout report."))
  );
  yield* writeTextFile(reportPath, `${json}\n`);
  return reportPath;
});

/**
 * Expose the closeout artifact writer to focused tests.
 *
 * **Example** (Reference the closeout artifact writer)
 *
 * ```ts
 * import { writePrCloseoutReportForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof writePrCloseoutReportForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const writePrCloseoutReportForTesting = writePrCloseoutReport;

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
  const reportPath = yield* writePrCloseoutReport(context, report);
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
      onSome: (value) => Effect.succeedSome(value),
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
    branch: plan.context.branch,
    createdAt: endedAt,
    startedAt: O.some(attempt.startedAt),
    endedAt: O.some(endedAt),
    elapsedMs: O.some(endedAtEpochMillis - startedAtEpochMillis),
    executed,
    failurePolicy: options.collectAll ? "collect-all" : "fail-fast",
    flakeQuarantine,
    head: plan.context.head,
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
    // Only the publish/monitor paths observe a live status snapshot, so runs
    // that never read the pull request omit the key rather than asserting an
    // unknown merge readiness.
    ...O.getSomesStruct({
      baseFreshness: extraState.baseFreshness,
      indexPath,
      mergeReady: extraState.mergeReady,
      stash: extraState.stash,
      failedStepId,
    }),
    ...(outcome === "failure" ? { failureKind: O.isSome(failedExecution) ? "step-exit" : "handler-error" } : {}),
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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | MemoryStats
> {
  if (options.mode === "status") {
    return yield* runStatusMode(plan.context, options);
  }
  const startedAtEpochMillis = yield* Clock.currentTimeMillis;
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const crypto = yield* Crypto.Crypto;
  const attemptId = yield* crypto.randomUUIDv4.pipe(
    Effect.flatMap(S.decodeEffect(UUID)),
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

  const coordinatedExecution =
    options.mode === "verify" && options.tier === "full"
      ? options.merged
        ? execution
        : runWithFullProofCoordinator(plan.context, fullSteps, execution, { priority: "verify" })
      : options.mode === "verify" && options.tier === "review-fix"
        ? runWithReviewFixAdmission(plan.context, execution)
        : execution;

  return yield* coordinatedExecution.pipe(
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

/**
 * Prove the merge preview instead of the branch tree.
 *
 * Hosted lanes check out `refs/pull/N/merge`, so a branch-tree proof answers a
 * question hosted CI never asks whenever the base has moved. This materializes
 * the same merge in a throwaway worktree, installs the *merged* lockfile there,
 * and runs the ordinary full proof against it — the plan is rebuilt from the
 * preview's context so every step's `cwd` and every affected-lane diff range
 * follow the merged tree rather than the operator's.
 *
 * Artifacts still land in the primary worktree's packet directory, because the
 * preview is removed the moment the proof finishes and a failing merged proof's
 * whole value is the issue artifacts it leaves behind.
 *
 * The preview merges the *committed* HEAD, which is the only thing hosted CI
 * can ever see. Uncommitted work is therefore excluded, and excluded silently
 * would be this tier's own false green — so a dirty worktree is named before
 * the proof starts, with the paths the run is about to ignore.
 */
/**
 * Name the uncommitted work a merged proof is about to leave out.
 *
 * `git merge-tree` merges the committed HEAD, which is the only thing hosted CI
 * can ever check out. Excluding uncommitted edits is therefore correct — and
 * excluding them silently would make this tier's own green mean less than it
 * appears to, which is the failure class the tier exists to close.
 */
const warnMergedVerifyIgnoresUncommittedWork = Effect.fn("Yeet.warnMergedVerifyIgnoresUncommittedWork")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const staged = yield* collectStagedPublishPaths(context.repoRoot);
  const unstaged = yield* collectUnstagedTrackedPaths(context.repoRoot);
  const untracked = yield* collectUntrackedPaths(context.repoRoot);
  const uncommitted = sortedUniquePaths([...staged, ...unstaged, ...untracked]);
  if (A.isReadonlyArrayEmpty(uncommitted)) {
    return;
  }
  yield* Console.error(
    `[yeet] warning: --merged proves the merge of committed HEAD, so ${A.length(uncommitted)} uncommitted path(s) are NOT in this proof:\n${A.join(
      A.map(uncommitted, (path) => `  - ${path}`),
      "\n"
    )}\n[yeet] commit them first if you want them covered; hosted CI will never see them otherwise.`
  );
});

const runMergedVerify = Effect.fn("Yeet.runMergedVerify")(function* (
  context: RepoRunContext,
  options: YeetRunOptions,
  message: O.Option<string>,
  modeOptions: YeetRunPlanModeOptions
): Effect.fn.Return<
  YeetRunResult,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | MemoryStats
> {
  const artifactDir = yield* artifactDirForContext(context);
  yield* warnMergedVerifyIgnoresUncommittedWork(context);
  return yield* withYeetMergePreview(
    context,
    Effect.fnUntraced(function* (preview) {
      yield* Console.log(
        `[yeet] proving the merge preview ${pipe(preview.commitSha, Str.takeLeft(12))} (${context.branch} merged with ${context.base} at ${pipe(preview.baseSha, Str.takeLeft(12))})`
      );
      yield* installYeetMergePreview(context, preview.worktreePath);
      const previewContext = yeetMergedPreviewContext(context, preview, artifactDir);
      return yield* runPlanExecution(buildYeetRunPlanWithMode(previewContext, message, modeOptions), options, message);
    })
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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | MemoryStats
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
  const modeOptions = YeetRunPlanModeOptions.make({
    amend: options.amend,
    ciParity: options.ciParity,
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
  });
  const plan = buildYeetRunPlanWithMode(context, message, modeOptions);
  if (options.plan) {
    yield* renderPlan(plan, options.json);
    return yield* emptyPlanResult(context);
  }
  if (options.merged) {
    const merged = runMergedVerify(context, options, message, modeOptions);
    return yield* options.mode === "verify" && options.tier === "full"
      ? runWithMergedPreviewAdmission(context, merged)
      : merged;
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
    amend: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    ciParity: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    collectAll: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    context: RepoRunContext,
    fast: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    forceTurbo: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    message: S.Option(S.String),
    mode: YeetRunMode.pipe(S.withConstructorDefault(Effect.succeed("publish"))),
    monitor: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    noEdit: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    pr: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    pushOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    remote: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    startPrEarly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    tier: YeetProofTier.pipe(S.withConstructorDefault(Effect.succeed("full"))),
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
export const buildYeetRunPlanForTesting = (
  options: Parameters<typeof BuildYeetRunPlanTestOptions.make>[0]
): RepoRunPlan => {
  const normalized = BuildYeetRunPlanTestOptions.make(options);
  return buildYeetRunPlanWithMode(
    normalized.context,
    normalized.message,
    YeetRunPlanModeOptions.make({
      amend: normalized.amend,
      ciParity: normalized.ciParity,
      collectAll: normalized.collectAll,
      fast: normalized.fast,
      forceTurbo: normalized.forceTurbo,
      mode: normalized.mode,
      monitor: normalized.monitor,
      noEdit: normalized.noEdit,
      pr: normalized.pr,
      pushOnly: normalized.pushOnly,
      remote: normalized.remote,
      startPrEarly: normalized.startPrEarly,
      tier: normalized.tier,
    })
  );
};
