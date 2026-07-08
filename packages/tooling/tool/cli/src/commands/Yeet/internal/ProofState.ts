/**
 * Durable proof-state and full-proof lock machinery for Yeet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { Console, DateTime, Effect, FileSystem, flow, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { commandTextForStep } from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import {
  artifactDirForContext,
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
  runStatePathForContext,
  safeArtifactName,
} from "./ArtifactPaths.js";
import { currentCommitSha, runGitOutput } from "./GitExec.js";
import { renderJson, writeTextFile } from "./IssueArtifacts.js";
import { YeetProofTier } from "./Planner.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.js";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofState");

class YeetLaneProofState extends S.Class<YeetLaneProofState>($I`YeetLaneProofState`)(
  {
    commandHash: S.String,
    commandText: S.String,
    diffFingerprint: S.String,
    stepId: S.String,
    label: S.String,
    verifiedAt: S.String,
  },
  $I.annote("YeetLaneProofState", {
    description: "One durable per-lane proof record keyed by command and tree fingerprint.",
  })
) {}

class YeetRunState extends S.Class<YeetRunState>($I`YeetRunState`)(
  {
    schemaVersion: S.Literal("yeet-run-state/v1"),
    artifactDir: S.String,
    base: S.String,
    branch: S.String,
    commitSha: S.String,
    diffFingerprint: S.String,
    head: S.String,
    proofCommand: S.String,
    proofTier: YeetProofTier,
    runId: S.String,
    verifiedAt: S.String,
    laneProofs: S.Array(YeetLaneProofState).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<YeetLaneProofState>())),
      S.withDecodingDefault(Effect.succeed(A.empty<YeetLaneProofState>()))
    ),
  },
  $I.annote("YeetRunState", {
    description: "Durable exact-match proof state for Yeet retry and closeout loops.",
  })
) {}

/**
 * Best-effort lock metadata for serializing heavyweight full-proof runs.
 *
 * @category models
 * @since 0.0.0
 */
class YeetProofLockState extends S.Class<YeetProofLockState>($I`YeetProofLockState`)(
  {
    schemaVersion: S.Literal("yeet-proof-lock/v1"),
    branch: S.String,
    command: S.String,
    pid: S.Finite,
    proofTier: YeetProofTier,
    startedAt: S.String,
  },
  $I.annote("YeetProofLockState", {
    description: "Best-effort local lock metadata for heavyweight Yeet proof scheduling.",
  })
) {}

const decodeYeetRunState = S.decodeUnknownEffect(S.fromJsonString(YeetRunState));

/**
 * Build the full-proof lock path for a Yeet run context.
 *
 * @param context - Repo context whose artifact directory owns the lock file.
 * @returns An Effect yielding the `quality-lock` path under the run artifacts.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { proofLockPathForContext, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const lockPath = proofLockPathForContext(context).pipe(Effect.map((path) => path.endsWith("quality-lock")))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const proofLockPathForContext = Effect.fn("Yeet.proofLockPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "quality-lock");
});

const readFingerprintFileBytes = Effect.fn("Yeet.readFingerprintFileBytes")(function* (
  filePath: string
): Effect.fn.Return<Uint8Array, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFile(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read Yeet fingerprint artifact ${filePath}.`)));
});

/**
 * Capture a binary Git diff artifact and return its bytes for fingerprinting.
 *
 * @param context - Repo context that supplies the working tree and artifact
 * root.
 * @param args - Git diff arguments appended after `git diff --binary`.
 * @param fileName - Safe suffix used for the temporary fingerprint artifact.
 * @returns The bytes written by Git before the temporary artifact is removed.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectGitDiffBytes, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const byteCount = collectGitDiffBytes(context, ["--cached"], "index").pipe(
 *   Effect.map((bytes) => bytes.byteLength)
 * )
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const collectGitDiffBytes = Effect.fn("Yeet.collectGitDiffBytes")(function* (
  context: RepoRunContext,
  args: ReadonlyArray<string>,
  fileName: string
): Effect.fn.Return<
  Uint8Array,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const requestedPath = yield* runOutputPathForContext(context, `fingerprint-${process.pid}-${fileName}.patch`);
  yield* fs
    .makeDirectory(path.dirname(requestedPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet fingerprint directory for ${requestedPath}.`)));

  // Fail closed if the fingerprint target (or a symlink at that path) resolves
  // outside the Yeet artifact tree, so `git diff --output` cannot be redirected
  // through a symlink to clobber a file outside the run directory.
  const diffPath = yield* resolvePathWithinRoot({ root: artifactDir, candidate: requestedPath }).pipe(
    Effect.mapError(YeetCommandError.new(`Refused unsafe Yeet fingerprint artifact path ${requestedPath}.`))
  );

  return yield* Effect.gen(function* () {
    yield* runGitOutput(context.repoRoot, ["diff", "--binary", `--output=${diffPath}`, ...args]);
    return yield* readFingerprintFileBytes(diffPath);
  }).pipe(Effect.ensuring(fs.remove(diffPath).pipe(Effect.ignore)));
});

/**
 * Hash the current Git status, unstaged diff, and staged diff for proof reuse.
 *
 * @param context - Repo context whose worktree is fingerprinted.
 * @returns A SHA-256 fingerprint for the exact current worktree state.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectDiffFingerprint, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const fingerprintLength = collectDiffFingerprint(context).pipe(Effect.map((fingerprint) => fingerprint.length))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const collectDiffFingerprint = Effect.fn("Yeet.collectDiffFingerprint")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const status = yield* runGitOutput(context.repoRoot, ["status", "--short"]);
  const unstagedDiff = yield* collectGitDiffBytes(context, ["HEAD"], "worktree");
  const stagedDiff = yield* collectGitDiffBytes(context, ["--cached"], "index");
  return createHash("sha256")
    .update(status)
    .update("\0")
    .update(unstagedDiff)
    .update("\0")
    .update(stagedDiff)
    .digest("hex");
});

/**
 * Collect the reusable-proof fingerprint for the current Git worktree.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { collectDiffFingerprintForTesting, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const fingerprint = collectDiffFingerprintForTesting(context).pipe(Effect.map((value) => value.slice(0, 12)))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const collectDiffFingerprintForTesting = collectDiffFingerprint;

const proofCommandForSteps: (steps: ReadonlyArray<RepoPlanStep>) => string = flow(
  A.map(commandTextForStep),
  A.join(" && ")
);

const hashText = (text: string): string => createHash("sha256").update(text).digest("hex");

const laneProofStateForStep = (step: RepoPlanStep, diffFingerprint: string, verifiedAt: string): YeetLaneProofState => {
  const commandText = commandTextForStep(step);
  return YeetLaneProofState.make({
    commandHash: hashText(commandText),
    commandText,
    diffFingerprint,
    label: step.label,
    stepId: step.id,
    verifiedAt,
  });
};

/**
 * Proof-lock state schema exposed for lock-disposition tests.
 *
 * @example
 * ```ts
 * import { YeetProofLockStateForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const state = YeetProofLockStateForTesting.make({
 *   branch: "feature/closeout",
 *   command: "bun run beep yeet verify",
 *   pid: 12345,
 *   proofTier: "full",
 *   schemaVersion: "yeet-proof-lock/v1",
 *   startedAt: "2026-07-08T00:00:00.000Z"
 * })
 * console.log(state.branch)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const YeetProofLockStateForTesting = YeetProofLockState;

const decodeProofLockState = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockState));

const isPidAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  });

const proofLockDisposition = (
  state: O.Option<YeetProofLockState>,
  ownerAlive: boolean
): "replace-stale" | "refuse-active" | "refuse-unreadable" =>
  O.isNone(state) ? "refuse-unreadable" : ownerAlive ? "refuse-active" : "replace-stale";

/**
 * Decide whether an existing proof lock is stale, active, or unreadable.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { proofLockDispositionForTesting, YeetProofLockStateForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const state = YeetProofLockStateForTesting.make({
 *   branch: "feature/closeout",
 *   command: "bun run beep yeet verify",
 *   pid: 12345,
 *   proofTier: "full",
 *   schemaVersion: "yeet-proof-lock/v1",
 *   startedAt: "2026-07-08T00:00:00.000Z"
 * })
 *
 * strictEqual(proofLockDispositionForTesting(O.some(state), false), "replace-stale")
 * ```
 * @category testing
 * @since 0.0.0
 */
export const proofLockDispositionForTesting = proofLockDisposition;

// Atomic exclusive create: succeeds only when this process is the one that
// created the lock. `flag: "wx"` maps to O_CREAT | O_EXCL so two concurrent
// proofs cannot both observe the lock as absent and enter the critical section.
const tryClaimProofLockExclusive = Effect.fn("Yeet.tryClaimProofLockExclusive")(function* (
  lockPath: string,
  lockText: string
): Effect.fn.Return<boolean, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.writeFileString(lockPath, lockText, { flag: "wx" }).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "AlreadyExists"
        ? Effect.succeed(false)
        : Effect.fail(YeetCommandError.new(`Failed to atomically create Yeet proof lock at ${lockPath}.`)(error))
    )
  );
});

/**
 * Atomically acquire the full-proof lock for heavyweight Yeet verification.
 *
 * @param context - Repo context whose artifact directory owns the lock.
 * @param proofSteps - Full-proof steps used to record the owner command.
 * @returns The lock path when this process successfully owns the lock.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { acquireFullProofLock, RepoPlanStep, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: ".",
 *   id: "full:check",
 *   label: "full check",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "fingerprint-match",
 *   scope: "repo"
 * })
 *
 * const acquired = acquireFullProofLock(context, [step]).pipe(Effect.map((path) => path.includes("quality-lock")))
 * ```
 * @category resource-management
 * @since 0.0.0
 */
export const acquireFullProofLock = Effect.fn("Yeet.acquireFullProofLock")(function* (
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = yield* proofLockPathForContext(context);
  yield* fs
    .makeDirectory(path.dirname(lockPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet proof lock directory for ${lockPath}.`)));
  const lockState = YeetProofLockState.make({
    schemaVersion: "yeet-proof-lock/v1",
    branch: context.branch,
    command: proofCommandForSteps(proofSteps),
    pid: process.pid,
    proofTier: "full",
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
  });
  const lockText = `${yield* renderJson(lockState)}\n`;

  if (yield* tryClaimProofLockExclusive(lockPath, lockText)) {
    return lockPath;
  }

  const existingText = yield* fs.readFileString(lockPath).pipe(Effect.orElseSucceed(() => ""));
  const existingState = yield* decodeProofLockState(existingText).pipe(
    Effect.map(O.some),
    Effect.orElseSucceed(O.none<YeetProofLockState>)
  );
  const ownerAlive = yield* pipe(
    existingState,
    O.match({
      onNone: () => Effect.succeed(false),
      onSome: (state) => isPidAlive(state.pid),
    })
  );

  if (proofLockDisposition(existingState, ownerAlive) === "replace-stale" && O.isSome(existingState)) {
    yield* Console.error(
      `[yeet] removing stale full-proof lock (pid ${existingState.value.pid} is not running, started ${existingState.value.startedAt})`
    );
    yield* fs.remove(lockPath).pipe(Effect.ignore);
    // Re-claim atomically; if another contender won the race after we removed
    // the stale lock, fail closed rather than overwrite an active lock.
    if (yield* tryClaimProofLockExclusive(lockPath, lockText)) {
      return lockPath;
    }
  }

  const ownerDetail = pipe(
    existingState,
    O.match({
      onNone: () => "",
      onSome: (state) => ` Owner pid ${state.pid} started ${state.startedAt}.`,
    })
  );
  return yield* YeetCommandError.make({
    message: `Another Yeet full proof appears active at ${lockPath}.${ownerDetail}\n${existingText}\nRun review-fix lanes or remove the stale lock after confirming no full proof is running.`,
    command: "bun run beep yeet verify",
    exitCode: 1,
  });
});

/**
 * Remove a previously acquired full-proof lock path.
 *
 * @param lockPath - Path returned by {@link acquireFullProofLock}.
 * @returns An Effect that ignores missing lock files during cleanup.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { releaseProofLock } from "@beep/repo-cli/test/Yeet"
 *
 * const released = releaseProofLock(".beep/yeet/runs/example/quality-lock").pipe(Effect.as("released"))
 * ```
 * @category resource-management
 * @since 0.0.0
 */
export const releaseProofLock = Effect.fn("releaseProofLock")(function* (lockPath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(lockPath).pipe(Effect.ignore);
});

/**
 * Write exact-match proof state after Yeet verification succeeds.
 *
 * @param context - Repo context whose branch, base, head, and artifact paths
 * are recorded.
 * @param tier - Proof tier that produced the reusable state.
 * @param proofSteps - Proof steps whose command hashes are persisted.
 * @returns An Effect that completes after the state file is written.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { RepoPlanStep, RepoRunContext, writeVerifiedState } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: ".",
 *   id: "full:check",
 *   label: "full check",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "fingerprint-match",
 *   scope: "repo"
 * })
 *
 * const writeState = writeVerifiedState(context, "full", [step]).pipe(Effect.as("state written"))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const writeVerifiedState = Effect.fn("Yeet.writeVerifiedState")(function* (
  context: RepoRunContext,
  tier: YeetProofTier,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const artifactDir = yield* artifactDirForContext(context);
  const statePath = yield* runStatePathForContext(context);
  const diffFingerprint = yield* collectDiffFingerprint(context);
  const verifiedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const state = YeetRunState.make({
    schemaVersion: "yeet-run-state/v1",
    artifactDir,
    base: context.base,
    branch: context.branch,
    commitSha: yield* currentCommitSha(context),
    diffFingerprint,
    head: context.head,
    laneProofs: A.map(proofSteps, (step) => laneProofStateForStep(step, diffFingerprint, verifiedAt)),
    proofCommand: proofCommandForSteps(proofSteps),
    proofTier: tier,
    runId: runIdForContext(context),
    verifiedAt,
  });
  yield* writeTextFile(statePath, `${yield* renderJson(state)}\n`);
});

/**
 * Build the pre-run-id proof state path used by older Yeet versions.
 *
 * @param context - Repo context whose branch and artifact directory determine
 * the legacy path.
 * @returns An Effect yielding the legacy `state.json` location.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { legacyRunStatePathForContext, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const legacyPath = legacyRunStatePathForContext(context).pipe(Effect.map((path) => path.endsWith("state.json")))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const legacyRunStatePathForContext = Effect.fn("Yeet.legacyRunStatePathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "runs", safeArtifactName(context.branch), "state.json");
});

const verifiedStateArtifactForPath =
  (path: string) =>
  (text: string): Readonly<{ readonly path: string; readonly text: string }> => ({ path, text });

/**
 * Load reusable Yeet proof state from the current or legacy artifact path.
 *
 * @param context - Repo context whose artifact paths are inspected.
 * @returns The decoded durable proof state for the current branch.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { loadVerifiedState, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const proofTier = loadVerifiedState(context).pipe(Effect.map((state) => state.proofTier))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const loadVerifiedState = Effect.fn("Yeet.loadVerifiedState")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetRunState, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const statePath = yield* runStatePathForContext(context);
  const legacyStatePath = yield* legacyRunStatePathForContext(context);
  const readState = (path: string) =>
    fs
      .readFileString(path)
      .pipe(
        Effect.map(verifiedStateArtifactForPath(path)),
        Effect.map(O.some),
        Effect.orElseSucceed(O.none<{ readonly path: string; readonly text: string }>)
      );
  const primary = yield* readState(statePath);
  const selected = O.isSome(primary) ? primary : yield* readState(legacyStatePath);
  if (O.isNone(selected)) {
    const fallbackDetail = legacyStatePath === statePath ? "" : ` or legacy path ${legacyStatePath}`;
    return yield* YeetCommandError.make({
      message: `No reusable Yeet proof state found at ${statePath}${fallbackDetail}.`,
      exitCode: 1,
    });
  }
  return yield* decodeYeetRunState(selected.value.text).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode reusable Yeet proof state at ${selected.value.path}.`))
  );
});

/**
 * Expose proof-state loading for upgrade compatibility tests.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { loadVerifiedStateForTesting, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const verifiedAt = loadVerifiedStateForTesting(context).pipe(Effect.map((state) => state.verifiedAt))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const loadVerifiedStateForTesting = loadVerifiedState;

/**
 * Assert that the saved full-proof state still matches the current worktree.
 *
 * @param context - Repo context whose branch, base, head, commit, and diff are
 * compared with the saved proof state.
 * @returns An Effect that completes only when the saved full proof is reusable.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { assertReusableVerifiedState, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const reusable = assertReusableVerifiedState(context).pipe(Effect.as("proof state matches"))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const assertReusableVerifiedState = Effect.fn("Yeet.assertReusableVerifiedState")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const state = yield* loadVerifiedState(context);
  const expectedCommitSha = yield* currentCommitSha(context);
  const expectedFingerprint = yield* collectDiffFingerprint(context);
  const mismatch = [
    ...(state.branch === context.branch ? [] : [`branch ${state.branch} != ${context.branch}`]),
    ...(state.base === context.base ? [] : [`base ${state.base} != ${context.base}`]),
    ...(state.head === context.head ? [] : [`head ${state.head} != ${context.head}`]),
    ...(state.commitSha === expectedCommitSha ? [] : [`commit ${state.commitSha} != ${expectedCommitSha}`]),
    ...(state.diffFingerprint === expectedFingerprint ? [] : ["diff fingerprint changed"]),
    ...(state.proofTier === "full" ? [] : [`proof tier ${state.proofTier} is not full`]),
  ];

  if (A.isReadonlyArrayEmpty(mismatch)) {
    yield* Console.log(`[yeet] reusing full proof state from ${state.verifiedAt}`);
    return;
  }

  return yield* YeetCommandError.make({
    message: `yeet publish --reuse-verified found stale proof state:\n${A.join(
      A.map(mismatch, (line) => `  - ${line}`),
      "\n"
    )}\nRun \`bun run beep yeet verify\` against the exact current worktree before retrying.`,
    exitCode: 1,
  });
});
