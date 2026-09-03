/**
 * Durable proof-state and full-proof lock machinery for Yeet.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolvePathWithinRoot } from "@beep/file-processing/PathSafety";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Console, Crypto, DateTime, Effect, Encoding, FileSystem, flow, Path, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { concatBytes } from "../../../internal/cli/Bytes.ts";
import {
  commandTextForStep,
  currentEffectiveUserIdOption,
  isProcessPidAlive,
  ProcessIdentityStatus,
  processIdentityStatus,
  processStartIdentityForPid,
  validatePrivateCoordinationDirectory,
} from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  artifactDirForContext,
  proofCoordinatorLockPath,
  runIdForContext,
  runArtifactPathForContext as runOutputPathForContext,
  runStatePathForContext,
  safeArtifactName,
} from "./ArtifactPaths.ts";
import { currentCommitSha, runGitOutput } from "./GitExec.ts";
import { renderJson, writeTextFile } from "./IssueArtifacts.ts";
import { YeetProofTier } from "./Planner.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofState");
const textEncoder = new TextEncoder();
const fingerprintSeparator = new Uint8Array([0]);

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

const proofLockOwnerFields = {
  branch: S.String,
  checkoutRoot: S.String,
  command: S.String,
  pid: S.Finite,
  procStart: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
  proofTier: YeetProofTier,
  startedAt: S.String,
};

class YeetProofLockStateV2 extends S.Class<YeetProofLockStateV2>($I`YeetProofLockStateV2`)(
  {
    schemaVersion: S.Literal("yeet-proof-lock/v2"),
    ...proofLockOwnerFields,
  },
  $I.annote("YeetProofLockStateV2", {
    description: "Legacy proof-lock metadata retained only for fail-closed mixed-version coordination.",
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
    schemaVersion: S.Literal("yeet-proof-lock/v3"),
    ...proofLockOwnerFields,
  },
  $I.annote("YeetProofLockState", {
    description: "Machine-local repository coordinator metadata for heavyweight Yeet proof scheduling.",
  })
) {}

class YeetProofLockRetirementState extends S.Class<YeetProofLockRetirementState>($I`YeetProofLockRetirementState`)(
  {
    schemaVersion: S.Literal("yeet-proof-lock/v4"),
    coordination: S.Literal("quality-scheduler/v1"),
    retiredAt: S.String,
  },
  $I.annote("YeetProofLockRetirementState", {
    description:
      "Persistent marker retiring the exclusive origin lock after the weighted quality scheduler becomes authoritative.",
  })
) {}

class YeetProofLockReapClaim extends S.Class<YeetProofLockReapClaim>($I`YeetProofLockReapClaim`)(
  {
    schemaVersion: S.Literal("yeet-proof-lock-reap-claim/v1"),
    pid: S.Finite,
    startedAt: S.String,
  },
  $I.annote("YeetProofLockReapClaim", {
    description: "Process identity owning one observation-bound proof-lock reclamation claim.",
  })
) {}

const ProofLockDisposition = LiteralKit([
  "replace-stale",
  "refuse-active",
  "refuse-legacy",
  "refuse-unreadable",
  "refuse-unverifiable",
]).pipe(
  $I.annoteSchema("ProofLockDisposition", {
    description: "Fail-closed action selected for one observed proof-lock generation.",
  })
);
type ProofLockDisposition = typeof ProofLockDisposition.Type;

class YeetProofLockLease extends S.Class<YeetProofLockLease>($I`YeetProofLockLease`)(
  {
    lockPath: S.String,
    lockText: S.String,
  },
  $I.annote("YeetProofLockLease", {
    description: "Exact proof-lock generation owned by one heavyweight Yeet proof scope.",
  })
) {}

const decodeYeetRunState = S.decodeUnknownEffect(S.fromJsonString(YeetRunState));

/**
 * Build the cross-checkout full-proof lock path for a Yeet run context.
 *
 * **Example** (Build quality-lock path)
 *
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
 * const lockPath = proofLockPathForContext(context).pipe(Effect.map((path) => path.endsWith(".lock")))
 * ```
 *
 * @param context - Repo context whose origin identifies sibling checkouts.
 * @returns An Effect yielding the machine-local repository coordinator path.
 * @category utilities
 * @since 0.0.0
 */
export const proofLockPathForContext = Effect.fn("Yeet.proofLockPathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repositoryIdentity = yield* runGitOutput(context.repoRoot, ["config", "--get", "remote.origin.url"]);
  return yield* proofCoordinatorLockPath(repositoryIdentity);
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
 * **Example** (Capture staged binary diff)
 *
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
 *
 * @param context - Repo context that supplies the working tree and artifact
 * root.
 * @param args - Git diff arguments appended after `git diff --binary`.
 * @param fileName - Safe suffix used for the temporary fingerprint artifact.
 * @returns The bytes written by Git before the temporary artifact is removed.
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
 * **Example** (Hash worktree fingerprint)
 *
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
 *
 * @param context - Repo context whose worktree is fingerprinted.
 * @returns A SHA-256 fingerprint for the exact current worktree state.
 * @category diagnostics
 * @since 0.0.0
 */
export const collectDiffFingerprint = Effect.fn("Yeet.collectDiffFingerprint")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  string,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const status = yield* runGitOutput(context.repoRoot, ["status", "--short"]);
  const unstagedDiff = yield* collectGitDiffBytes(context, ["HEAD"], "worktree");
  const stagedDiff = yield* collectGitDiffBytes(context, ["--cached"], "index");
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest(
      "SHA-256",
      concatBytes([textEncoder.encode(status), fingerprintSeparator, unstagedDiff, fingerprintSeparator, stagedDiff])
    )
    .pipe(YeetCommandError.mapError("Failed to hash Yeet worktree fingerprint."));
  return Encoding.encodeHex(digest);
});

/**
 * Collect the reusable-proof fingerprint for the current Git worktree.
 *
 * **Example** (Fingerprint for testing)
 *
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
 *
 * @category testing
 * @since 0.0.0
 */
export const collectDiffFingerprintForTesting = collectDiffFingerprint;

const proofCommandForSteps: (steps: ReadonlyArray<RepoPlanStep>) => string = flow(
  A.map(commandTextForStep),
  A.join(" && ")
);

const hashText = Effect.fn("Yeet.hashText")(function* (
  value: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", textEncoder.encode(value))
    .pipe(YeetCommandError.mapError("Failed to hash Yeet proof command."));
  return Encoding.encodeHex(digest);
});

// The directory invariants live in the shared coordination validator; the
// label and error constructors keep every refusal message byte-identical.
const validateProofCoordinatorDirectory = (directory: string, effectiveUserId: O.Option<number>) =>
  validatePrivateCoordinationDirectory(directory, {
    label: "Yeet proof lock directory",
    effectiveUserId,
    onViolation: (message) => YeetCommandError.make({ message }),
    onStatError: YeetCommandError.new(`Failed to inspect Yeet proof lock directory ${directory}.`),
  });

/**
 * Validate a proof coordinator directory through the production filesystem boundary.
 *
 * **Example** (Build a directory validation Effect)
 *
 * ```ts
 * import { validateProofCoordinatorDirectoryForTesting } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(validateProofCoordinatorDirectoryForTesting("/tmp/example"))) // true
 * ```
 *
 * @internal
 * @param directory - Existing directory to validate without creating a lock file.
 * @param effectiveUserIdOverride - Optional effective UID state used by security-focused tests.
 * @returns An Effect that fails when the directory is unsafe for coordination.
 * @category testing
 * @since 0.0.0
 */
export const validateProofCoordinatorDirectoryForTesting = Effect.fn(
  "Yeet.validateProofCoordinatorDirectoryForTesting"
)(function* (directory: string, effectiveUserIdOverride?: O.Option<number>) {
  yield* validateProofCoordinatorDirectory(
    directory,
    pipe(O.fromUndefinedOr(effectiveUserIdOverride), O.getOrElse(currentEffectiveUserIdOption))
  );
});

const ensureProofCoordinatorDirectory = Effect.fn("Yeet.ensureProofCoordinatorDirectory")(function* (
  directory: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .makeDirectory(directory, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet proof lock directory ${directory}.`)));
  yield* validateProofCoordinatorDirectory(directory, currentEffectiveUserIdOption());
});

const laneProofStateForStep = Effect.fn("Yeet.laneProofStateForStep")(function* (
  step: RepoPlanStep,
  diffFingerprint: string,
  verifiedAt: string
) {
  const commandText = commandTextForStep(step);
  return YeetLaneProofState.make({
    commandHash: yield* hashText(commandText),
    commandText,
    diffFingerprint,
    label: step.label,
    stepId: step.id,
    verifiedAt,
  });
});

/**
 * Proof-lock state schema exposed for lock-disposition tests.
 *
 * **Example** (Make lock state schema)
 *
 * ```ts
 * import { YeetProofLockStateForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const state = YeetProofLockStateForTesting.make({
 *   branch: "feature/closeout",
 *   checkoutRoot: "/repo",
 *   command: "bun run beep yeet verify",
 *   pid: 12345,
 *   proofTier: "full",
 *   schemaVersion: "yeet-proof-lock/v3",
 *   startedAt: "2026-07-08T00:00:00.000Z"
 * })
 * console.log(state.branch)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const YeetProofLockStateForTesting = YeetProofLockState;

const decodeProofLockState = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockState));
const decodeProofLockStateV2 = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockStateV2));
const decodeProofLockRetirementState = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockRetirementState));
const decodeProofLockReapClaim = S.decodeUnknownEffect(S.fromJsonString(YeetProofLockReapClaim));

const proofLockDisposition = (
  state: O.Option<YeetProofLockState>,
  ownerStatus: ProcessIdentityStatus,
  legacyState: boolean
): ProofLockDisposition =>
  legacyState
    ? ProofLockDisposition.Enum["refuse-legacy"]
    : O.isNone(state)
      ? ProofLockDisposition.Enum["refuse-unreadable"]
      : ProcessIdentityStatus.$match(ownerStatus, {
          alive: () => ProofLockDisposition.Enum["refuse-active"],
          dead: () => ProofLockDisposition.Enum["replace-stale"],
          unknown: () => ProofLockDisposition.Enum["refuse-unverifiable"],
        });

/**
 * Decide whether an existing proof lock is stale, active, legacy, or unreadable.
 *
 * **Example** (Detect replace-stale lock)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as O from "effect/Option"
 * import { proofLockDispositionForTesting, YeetProofLockStateForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const state = YeetProofLockStateForTesting.make({
 *   branch: "feature/closeout",
 *   checkoutRoot: "/repo",
 *   command: "bun run beep yeet verify",
 *   pid: 12345,
 *   proofTier: "full",
 *   schemaVersion: "yeet-proof-lock/v3",
 *   startedAt: "2026-07-08T00:00:00.000Z"
 * })
 *
 * strictEqual(proofLockDispositionForTesting(O.some(state), "dead", false), "replace-stale")
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const proofLockDispositionForTesting: {
  (
    ownerStatus: ProcessIdentityStatus,
    legacyState: boolean
  ): (state: O.Option<YeetProofLockState>) => ProofLockDisposition;
  (state: O.Option<YeetProofLockState>, ownerStatus: ProcessIdentityStatus, legacyState: boolean): ProofLockDisposition;
} = dual(3, proofLockDisposition);

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

const proofLockReapClaimPath = Effect.fn("Yeet.proofLockReapClaimPath")(function* (
  lockPath: string,
  observedText: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  return `${lockPath}.reap-${yield* hashText(observedText)}.claim`;
});

const proofLockReapClaimTombstonePath = Effect.fn("Yeet.proofLockReapClaimTombstonePath")(function* (
  claimPath: string,
  observedText: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  return `${claimPath}.reap-${yield* hashText(observedText)}.claim`;
});

const proofLockReapPath = Effect.fn("Yeet.proofLockReapPath")(function* (
  lockPath: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const uuid = yield* crypto.randomUUIDv4.pipe(
    YeetCommandError.mapError("Failed to generate Yeet proof-lock reap identifier.")
  );
  return `${lockPath}.reap-${process.pid}-${uuid}`;
});

const legacyProofLockRefusal = (lockPath: string, state: YeetProofLockStateV2): YeetCommandError =>
  YeetCommandError.make({
    message: `Yeet found a legacy v2 full-proof coordinator at ${lockPath}. Owner checkout ${state.checkoutRoot} on ${state.branch}, pid ${state.pid}, started ${state.startedAt}. The v3 coordinator will not reclaim it automatically. Remove ${lockPath} only after confirming every sibling checkout is idle and running the new Yeet version.`,
    command: "bun run beep yeet verify",
    exitCode: 1,
  });

const readProofCoordinationFile = Effect.fn("Yeet.readProofCoordinationFile")(function* (
  filePath: string,
  failureMessage: string
): Effect.fn.Return<O.Option<string>, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(O.none<string>())
        : Effect.fail(YeetCommandError.new(failureMessage)(error))
    )
  );
});

const tryRecoverObservedProofLockReapClaim = Effect.fn("Yeet.tryRecoverObservedProofLockReapClaim")(function* (
  claimPath: string,
  claimText: string,
  observedClaimText: string
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const tombstonePath = yield* proofLockReapClaimTombstonePath(claimPath, observedClaimText);
  if (!(yield* tryClaimProofLockExclusive(tombstonePath, claimText))) {
    const tombstoneText = yield* readProofCoordinationFile(
      tombstonePath,
      `Failed to inspect Yeet proof-lock reclamation tombstone at ${tombstonePath}. Remove ${tombstonePath} only after confirming every sibling checkout is idle.`
    );
    if (O.isNone(tombstoneText)) {
      return false;
    }

    const tombstoneClaim = yield* decodeProofLockReapClaim(tombstoneText.value).pipe(
      Effect.asSome,
      Effect.orElseSucceed(O.none<YeetProofLockReapClaim>)
    );
    if (O.isNone(tombstoneClaim)) {
      return yield* YeetCommandError.make({
        message: `Yeet found an unreadable proof-lock reclamation tombstone at ${tombstonePath}. Reclamation failed closed because depth-2 tombstones are never auto-reclaimed. Remove ${tombstonePath} only after confirming every sibling checkout is idle.`,
        command: "bun run beep yeet verify",
        exitCode: 1,
      });
    }
    if (yield* isProcessPidAlive(tombstoneClaim.value.pid)) {
      return false;
    }
    return yield* YeetCommandError.make({
      message: `Yeet found a dead-owner proof-lock reclamation tombstone at ${tombstonePath}. Reclamation failed closed because depth-2 tombstones are never auto-reclaimed. Remove ${tombstonePath} only after confirming every sibling checkout is idle.`,
      command: "bun run beep yeet verify",
      exitCode: 1,
    });
  }

  return yield* Effect.gen(function* () {
    const currentClaimText = yield* readProofCoordinationFile(
      claimPath,
      `Failed to revalidate dead Yeet proof-lock reclamation claim at ${claimPath}. Remove ${claimPath} only after confirming every sibling checkout is idle.`
    );
    if (O.isNone(currentClaimText) || !Str.Equivalence(currentClaimText.value, observedClaimText)) {
      return false;
    }

    const removedDeadClaim = yield* fs.remove(claimPath).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(false)
          : Effect.fail(
              YeetCommandError.new(
                `Failed to remove dead Yeet proof-lock reclamation claim at ${claimPath}. Remove ${claimPath} only after confirming every sibling checkout is idle.`
              )(error)
            )
      )
    );
    return removedDeadClaim ? yield* tryClaimProofLockExclusive(claimPath, claimText) : false;
  }).pipe(Effect.ensuring(fs.remove(tombstonePath).pipe(Effect.ignore)));
});

/**
 * Recover a dead proof-lock claim only while its exact observed bytes remain current.
 *
 * **Details**
 *
 * Recovery is serialized by an observation-bound depth-2 tombstone. A dead or
 * unreadable tombstone fails closed and names the exact path that an idle fleet
 * may remove manually.
 *
 * **Example** (Build an explicit-observation recovery attempt)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { tryRecoverObservedProofLockReapClaimForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const attempted = tryRecoverObservedProofLockReapClaimForTesting(
 *   "/tmp/proof.lock.reap-observation.claim",
 *   "replacement claim",
 *   "observed dead claim"
 * )
 * console.log(Effect.isEffect(attempted)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const tryRecoverObservedProofLockReapClaimForTesting = tryRecoverObservedProofLockReapClaim;

const tryClaimProofLockReapClaim = Effect.fn("Yeet.tryClaimProofLockReapClaim")(function* (
  claimPath: string,
  claimText: string
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  if (yield* tryClaimProofLockExclusive(claimPath, claimText)) {
    return true;
  }

  const observedClaimText = yield* readProofCoordinationFile(
    claimPath,
    `Failed to inspect Yeet proof-lock reclamation claim at ${claimPath}. Remove ${claimPath} only after confirming every sibling checkout is idle.`
  );
  if (O.isNone(observedClaimText)) {
    return yield* tryClaimProofLockExclusive(claimPath, claimText);
  }

  const observedClaim = yield* decodeProofLockReapClaim(observedClaimText.value).pipe(
    Effect.asSome,
    Effect.orElseSucceed(O.none<YeetProofLockReapClaim>)
  );
  if (O.isNone(observedClaim)) {
    return yield* YeetCommandError.make({
      message: `Yeet found an unreadable proof-lock reclamation claim at ${claimPath}. Reclamation failed closed. Remove ${claimPath} only after confirming every sibling checkout is idle.`,
      command: "bun run beep yeet verify",
      exitCode: 1,
    });
  }
  if (yield* isProcessPidAlive(observedClaim.value.pid)) {
    return false;
  }
  return yield* tryRecoverObservedProofLockReapClaim(claimPath, claimText, observedClaimText.value);
});

// A rename is atomic, but it does not by itself bind a delayed contender to the
// lock generation it previously read. The per-observation exclusive claim
// serializes contenders that read the same generation; re-reading under that
// claim ensures the shared path still contains those exact bytes before rename.
const tryMoveObservedProofLock = Effect.fn("Yeet.tryMoveObservedProofLock")(function* (
  lockPath: string,
  observedText: string
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const claimPath = yield* proofLockReapClaimPath(lockPath, observedText);
  const claimText = `${yield* renderJson(
    YeetProofLockReapClaim.make({
      schemaVersion: "yeet-proof-lock-reap-claim/v1",
      pid: process.pid,
      startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    })
  )}\n`;
  if (!(yield* tryClaimProofLockReapClaim(claimPath, claimText))) {
    return false;
  }

  return yield* Effect.gen(function* () {
    const currentText = yield* readProofCoordinationFile(
      lockPath,
      `Failed to revalidate Yeet proof lock at ${lockPath} before atomic movement.`
    );
    if (O.isNone(currentText) || !Str.Equivalence(currentText.value, observedText)) {
      return false;
    }

    const reapPath = yield* proofLockReapPath(lockPath);
    const renamed = yield* fs.rename(lockPath, reapPath).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(false)
          : Effect.fail(YeetCommandError.new(`Failed to atomically reap Yeet proof lock at ${lockPath}.`)(error))
      )
    );
    if (!renamed) {
      return false;
    }

    yield* fs.remove(reapPath).pipe(Effect.ignore);
    return true;
  }).pipe(Effect.ensuring(fs.remove(claimPath).pipe(Effect.ignore)));
});

const tryReclaimStaleProofLock = Effect.fn("Yeet.tryReclaimStaleProofLock")(function* (
  lockPath: string,
  observedText: string,
  replacementText: string
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  if (!(yield* tryMoveObservedProofLock(lockPath, observedText))) {
    return false;
  }
  return yield* tryClaimProofLockExclusive(lockPath, replacementText);
});

/**
 * Attempt to replace the exact stale proof-lock generation observed by a contender.
 *
 * **Example** (Reject a changed lock generation)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { tryReclaimStaleProofLockForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const attempted = tryReclaimStaleProofLockForTesting("/tmp/proof.lock", "stale", "replacement")
 * console.log(Effect.isEffect(attempted)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const tryReclaimStaleProofLockForTesting = tryReclaimStaleProofLock;

interface ObservedProofLockState {
  readonly legacyState: O.Option<YeetProofLockStateV2>;
  readonly ownerStatus: ProcessIdentityStatus;
  readonly retirementState: O.Option<YeetProofLockRetirementState>;
  readonly state: O.Option<YeetProofLockState>;
  readonly text: string;
}

// Classify the shared lock: try the v3 decoder first, then the legacy v2
// decoder purely so decodable v2 locks can be refused instead of reclaimed.
const observeProofLockState = Effect.fn("Yeet.observeProofLockState")(function* (
  lockPath: string
): Effect.fn.Return<ObservedProofLockState, YeetCommandError, FileSystem.FileSystem> {
  const text = O.getOrElse(
    yield* readProofCoordinationFile(lockPath, `Failed to inspect Yeet proof lock at ${lockPath}.`),
    () => ""
  );
  const state = yield* decodeProofLockState(text).pipe(Effect.asSome, Effect.orElseSucceed(O.none<YeetProofLockState>));
  const legacyState = O.isNone(state)
    ? yield* decodeProofLockStateV2(text).pipe(Effect.asSome, Effect.orElseSucceed(O.none<YeetProofLockStateV2>))
    : O.none<YeetProofLockStateV2>();
  const retirementState =
    O.isNone(state) && O.isNone(legacyState)
      ? yield* decodeProofLockRetirementState(text).pipe(
          Effect.asSome,
          Effect.orElseSucceed(O.none<YeetProofLockRetirementState>)
        )
      : O.none<YeetProofLockRetirementState>();
  const ownerStatus = yield* pipe(
    state,
    O.match({
      onNone: () => Effect.succeed(ProcessIdentityStatus.Enum.dead),
      onSome: processIdentityStatus,
    })
  );
  return { text, state, legacyState, retirementState, ownerStatus };
});

const tryReplaceStaleProofLock = Effect.fn("Yeet.tryReplaceStaleProofLock")(function* (
  lockPath: string,
  staleText: string,
  lockText: string
): Effect.fn.Return<boolean, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  if (yield* tryReclaimStaleProofLock(lockPath, staleText, lockText)) {
    return true;
  }
  // A competing reaper may have atomically moved the stale generation. Claim
  // only if the shared path is still absent; otherwise the caller re-observes
  // and fails closed against the generation now present.
  return yield* tryClaimProofLockExclusive(lockPath, lockText);
});

const activeProofLockRefusal = (lockPath: string, state: O.Option<YeetProofLockState>): YeetCommandError => {
  const ownerDetail = pipe(
    state,
    O.match({
      onNone: () => "",
      onSome: (owner) =>
        ` Owner checkout ${owner.checkoutRoot} on ${owner.branch}, pid ${owner.pid}, started ${owner.startedAt}.`,
    })
  );
  return YeetCommandError.make({
    message: `Another Yeet full proof for this repository is active.${ownerDetail}\nThe machine-local coordinator prevents sibling checkouts from overlapping Docker, Bun-cache, and Turbo work. Wait for it to finish, run the cheap/review-fix tier, or remove ${lockPath} only after confirming its owner is gone.`,
    command: "bun run beep yeet verify",
    exitCode: 1,
  });
};

const unverifiableProofLockRefusal = (lockPath: string, owner: YeetProofLockState): YeetCommandError =>
  YeetCommandError.make({
    message:
      `Cannot verify the process identity recorded by the Yeet proof lock at ${lockPath}. ` +
      `Owner checkout ${owner.checkoutRoot} on ${owner.branch}, pid ${owner.pid}, started ${owner.startedAt}.\n` +
      "The coordinator refuses both unsafe reclamation and indefinite queueing behind an unverifiable PID. " +
      "Retry after process identity inspection is available, or remove the lock only after independently confirming its owner is gone.",
    command: "bun run beep yeet verify",
    exitCode: 1,
    file: lockPath,
  });

/**
 * Build the fail-closed refusal used for a live PID whose process identity cannot be inspected.
 *
 * **Example** (Inspect an unverifiable-owner refusal)
 *
 * ```ts
 * import { unverifiableProofLockRefusalForTesting, YeetProofLockStateForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * const owner = YeetProofLockStateForTesting.make({
 *   branch: "feature/closeout",
 *   checkoutRoot: "/repo",
 *   command: "bun run beep yeet verify",
 *   pid: 12345,
 *   procStart: "ps:unavailable",
 *   proofTier: "full",
 *   schemaVersion: "yeet-proof-lock/v3",
 *   startedAt: "2026-08-31T00:00:00.000Z"
 * })
 *
 * console.log(unverifiableProofLockRefusalForTesting("/runtime/proof.lock", owner).exitCode) // 1
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const unverifiableProofLockRefusalForTesting: {
  (owner: YeetProofLockState): (lockPath: string) => YeetCommandError;
  (lockPath: string, owner: YeetProofLockState): YeetCommandError;
} = dual(2, unverifiableProofLockRefusal);

interface FullProofLockContention {
  readonly lease: O.Option<YeetProofLockLease>;
  readonly observed: ObservedProofLockState;
}

const noFullProofLockLease = (observed: ObservedProofLockState): FullProofLockContention => ({
  lease: O.none(),
  observed,
});

const refuseLegacyProofLockContention = Effect.fn("Yeet.refuseLegacyProofLockContention")(function* (
  lockPath: string,
  legacyState: YeetProofLockStateV2
): Effect.fn.Return<FullProofLockContention, YeetCommandError> {
  return yield* legacyProofLockRefusal(lockPath, legacyState);
});

const refuseUnverifiableProofLockContention = Effect.fn("Yeet.refuseUnverifiableProofLockContention")(function* (
  lockPath: string,
  owner: YeetProofLockState
): Effect.fn.Return<FullProofLockContention, YeetCommandError> {
  return yield* unverifiableProofLockRefusal(lockPath, owner);
});

const replaceStaleProofLockContention = Effect.fn("Yeet.replaceStaleProofLockContention")(function* (
  lockPath: string,
  lockText: string,
  lease: YeetProofLockLease,
  observed: ObservedProofLockState,
  owner: YeetProofLockState
): Effect.fn.Return<FullProofLockContention, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  yield* Console.error(
    `[yeet] reaping stale full-proof lock (pid ${owner.pid}, started ${owner.startedAt}, is no longer the recorded process identity)`
  );
  if (yield* tryReplaceStaleProofLock(lockPath, observed.text, lockText)) {
    return { lease: O.some(lease), observed };
  }
  const current = yield* observeProofLockState(lockPath);
  return yield* O.match(current.legacyState, {
    onNone: () => Effect.succeed(noFullProofLockLease(current)),
    onSome: (legacyState) => refuseLegacyProofLockContention(lockPath, legacyState),
  });
});

// The single contention ladder shared by the fail-fast and queue-style
// acquisition paths: refuse legacy, reap a decodable-dead owner, and report
// the final observation when the lock stays held.
const contendForFullProofLockCore = Effect.fn("Yeet.contendForFullProofLockCore")(function* (
  lockPath: string,
  lockText: string,
  lease: YeetProofLockLease
): Effect.fn.Return<FullProofLockContention, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const observed = yield* observeProofLockState(lockPath);
  const disposition = proofLockDisposition(observed.state, observed.ownerStatus, O.isSome(observed.legacyState));
  return yield* ProofLockDisposition.$match(disposition, {
    "refuse-active": () => Effect.succeed(noFullProofLockLease(observed)),
    "refuse-legacy": () => refuseLegacyProofLockContention(lockPath, O.getOrThrow(observed.legacyState)),
    "refuse-unreadable": () => Effect.succeed(noFullProofLockLease(observed)),
    "refuse-unverifiable": () => refuseUnverifiableProofLockContention(lockPath, O.getOrThrow(observed.state)),
    "replace-stale": () =>
      replaceStaleProofLockContention(lockPath, lockText, lease, observed, O.getOrThrow(observed.state)),
  });
});

const contendForFullProofLock = Effect.fn("Yeet.contendForFullProofLock")(function* (
  lockPath: string,
  lockText: string,
  lease: YeetProofLockLease
): Effect.fn.Return<YeetProofLockLease, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const contention = yield* contendForFullProofLockCore(lockPath, lockText, lease);
  return yield* O.match(contention.lease, {
    onNone: () => activeProofLockRefusal(lockPath, contention.observed.state),
    onSome: Effect.succeed,
  });
});

/**
 * Acquire the legacy v3 full-proof lock for compatibility and migration tests.
 *
 * **Example** (Acquire full-proof lock)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { acquireLegacyFullProofLockForTesting, RepoPlanStep, RepoRunContext } from "@beep/repo-cli/test/Yeet"
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
 * const acquired = acquireLegacyFullProofLockForTesting(context, [step]).pipe(
 *   Effect.map((lease) => lease.lockPath.endsWith(".lock"))
 * )
 * ```
 *
 * @param context - Repo context whose origin identifies sibling checkouts.
 * @param proofSteps - Full-proof steps used to record the owner command.
 * @returns The exact lock generation owned by this process.
 * @category resource-management
 * @since 0.0.0
 */
const acquireFullProofLock = Effect.fn("Yeet.acquireFullProofLock")(function* (
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<
  YeetProofLockLease,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const prepared = yield* prepareFullProofLockLease(context, proofSteps);
  if (yield* tryClaimProofLockExclusive(prepared.lockPath, prepared.lockText)) {
    return prepared.lease;
  }
  return yield* contendForFullProofLock(prepared.lockPath, prepared.lockText, prepared.lease);
});

/**
 * Compatibility alias exposing legacy v3 fail-closed acquisition to tests.
 *
 * **Example** (Reference the legacy test seam)
 *
 * ```ts
 * import { acquireLegacyFullProofLockForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof acquireLegacyFullProofLockForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const acquireLegacyFullProofLockForTesting = acquireFullProofLock;

interface PreparedFullProofLockLease {
  readonly lease: YeetProofLockLease;
  readonly lockPath: string;
  readonly lockText: string;
}

const prepareFullProofLockLease = Effect.fn("Yeet.prepareFullProofLockLease")(function* (
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<
  PreparedFullProofLockLease,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const lockPath = yield* proofLockPathForContext(context);
  return yield* prepareFullProofLockLeaseAt(lockPath, context, proofSteps);
});

const prepareFullProofLockLeaseAt = Effect.fn("Yeet.prepareFullProofLockLeaseAt")(function* (
  lockPath: string,
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<PreparedFullProofLockLease, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  return yield* prepareFullProofLockLeaseForCommandAt(
    lockPath,
    context,
    proofCommandForSteps(proofSteps),
    O.getOrElse(yield* processStartIdentityForPid(process.pid), () => "")
  );
});

const prepareFullProofLockLeaseForCommandAt = Effect.fn("Yeet.prepareFullProofLockLeaseForCommandAt")(function* (
  lockPath: string,
  context: RepoRunContext,
  command: string,
  procStart: string
): Effect.fn.Return<PreparedFullProofLockLease, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  yield* ensureProofCoordinatorDirectory(path.dirname(lockPath));
  const lockState = YeetProofLockState.make({
    schemaVersion: "yeet-proof-lock/v3",
    branch: context.branch,
    checkoutRoot: context.repoRoot,
    command,
    pid: process.pid,
    procStart,
    proofTier: "full",
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
  });
  const lockText = `${yield* renderJson(lockState)}\n`;
  return { lockPath, lockText, lease: YeetProofLockLease.make({ lockPath, lockText }) };
});

// Same disposition ladder as contendForFullProofLock, except an actively held
// lock yields `None` for queue-style callers instead of failing.
// Legacy and unreadable locks keep failing closed with the v3 messages.
// Queue-style variant of the ladder: a garbage lock file still fails closed,
// while a held or vanished lock reports `None` so the contender keeps waiting.
const contendOrObserveFullProofLock = Effect.fn("Yeet.contendOrObserveFullProofLock")(function* (
  lockPath: string,
  lockText: string,
  lease: YeetProofLockLease
): Effect.fn.Return<O.Option<YeetProofLockLease>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  const contention = yield* contendForFullProofLockCore(lockPath, lockText, lease);
  const unreadable =
    O.isNone(contention.lease) && O.isNone(contention.observed.state) && Str.isNonEmpty(contention.observed.text);
  if (unreadable) {
    return yield* activeProofLockRefusal(lockPath, contention.observed.state);
  }
  return contention.lease;
});

const tryAcquirePreparedFullProofLock = Effect.fn("Yeet.tryAcquirePreparedFullProofLock")(function* (
  prepared: PreparedFullProofLockLease
): Effect.fn.Return<O.Option<YeetProofLockLease>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  if (yield* tryClaimProofLockExclusive(prepared.lockPath, prepared.lockText)) {
    return O.some(prepared.lease);
  }
  return yield* contendOrObserveFullProofLock(prepared.lockPath, prepared.lockText, prepared.lease);
});

/**
 * Attempt one non-blocking acquisition of the legacy v3 full-proof coordinator.
 *
 * Succeeds with `None` while a live sibling owns the lock, so queue-style
 * callers (the machine-wide admission scheduler) can keep waiting with
 * visible progress instead of failing. Legacy v2 and unreadable lock files
 * still fail closed exactly like {@link acquireFullProofLock}.
 *
 * **Example** (Attempt an acquisition without blocking)
 *
 * ```ts
 * import { acquireLegacyFullProofLockOrObserveForTesting, RepoPlanStep, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
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
 * const attempt = acquireLegacyFullProofLockOrObserveForTesting(context, [step]).pipe(
 *   Effect.map((acquisition) => O.isOption(acquisition))
 * )
 * console.log(Effect.isEffect(attempt)) // true
 * ```
 *
 * @param context - Repo context whose origin identifies sibling checkouts.
 * @param proofSteps - Full-proof steps used to record the owner command.
 * @returns The acquired lease, or `None` while a live sibling owns the lock.
 * @category resource-management
 * @since 0.0.0
 */
const acquireFullProofLockOrObserve = Effect.fn("Yeet.acquireFullProofLockOrObserve")(function* (
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<
  O.Option<YeetProofLockLease>,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const lockPath = yield* proofLockPathForContext(context);
  return yield* acquireFullProofLockOrObserveAtPath(lockPath, context, proofSteps);
});

/**
 * Compatibility alias exposing legacy v3 queue-style acquisition to tests.
 *
 * **Example** (Reference the legacy queue test seam)
 *
 * ```ts
 * import { acquireLegacyFullProofLockOrObserveForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof acquireLegacyFullProofLockOrObserveForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const acquireLegacyFullProofLockOrObserveForTesting = acquireFullProofLockOrObserve;

/**
 * The legacy queue-style acquisition against an already-resolved lock path.
 *
 * Queue-style callers resolve the git origin identity once per run and retry
 * acquisition every scheduler tick without re-spawning git.
 *
 * **Example** (Reference the resolved-path acquisition)
 *
 * ```ts
 * import { acquireLegacyFullProofLockOrObserveAtPathForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof acquireLegacyFullProofLockOrObserveAtPathForTesting) // "function"
 * ```
 *
 * @param lockPath - Resolved coordinator lock path for this origin.
 * @param context - Repo context recorded as the prospective owner.
 * @param proofSteps - Full-proof steps used to record the owner command.
 * @returns The acquired lease, or `None` while a live sibling owns the lock.
 * @category resource-management
 * @since 0.0.0
 */
const acquireFullProofLockOrObserveAtPath = Effect.fn("Yeet.acquireFullProofLockOrObserveAtPath")(function* (
  lockPath: string,
  context: RepoRunContext,
  proofSteps: ReadonlyArray<RepoPlanStep>
): Effect.fn.Return<O.Option<YeetProofLockLease>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const prepared = yield* prepareFullProofLockLeaseAt(lockPath, context, proofSteps);
  return yield* tryAcquirePreparedFullProofLock(prepared);
});

/**
 * Compatibility alias exposing resolved-path legacy v3 acquisition to tests.
 *
 * **Example** (Reference the resolved-path legacy test seam)
 *
 * ```ts
 * import { acquireLegacyFullProofLockOrObserveAtPathForTesting } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof acquireLegacyFullProofLockOrObserveAtPathForTesting) // "function"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const acquireLegacyFullProofLockOrObserveAtPathForTesting = acquireFullProofLockOrObserveAtPath;

const observeProofLockRetirementReplacement = Effect.fn("Yeet.observeProofLockRetirementReplacement")(function* (
  lockPath: string
): Effect.fn.Return<O.Option<boolean>, YeetCommandError, FileSystem.FileSystem> {
  const replacement = yield* observeProofLockState(lockPath);
  if (O.isSome(replacement.retirementState)) {
    return O.some(true);
  }
  if (O.isSome(replacement.legacyState)) {
    return yield* legacyProofLockRefusal(lockPath, replacement.legacyState.value);
  }
  if (O.isSome(replacement.state) || Str.isEmpty(replacement.text)) {
    return O.none();
  }
  return yield* activeProofLockRefusal(lockPath, replacement.state);
});

const replaceStaleProofLockWithRetirement = Effect.fn("Yeet.replaceStaleProofLockWithRetirement")(function* (
  lockPath: string,
  retirementText: string,
  owner: YeetProofLockState,
  observed: ObservedProofLockState
): Effect.fn.Return<O.Option<boolean>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  yield* Console.error(
    `[yeet] retiring stale v3 full-proof lock (pid ${owner.pid}, started ${owner.startedAt}, is no longer the recorded process identity)`
  );
  if (yield* tryReplaceStaleProofLock(lockPath, observed.text, retirementText)) {
    return O.some(true);
  }
  return yield* observeProofLockRetirementReplacement(lockPath);
});

const retireObservedProofLock = Effect.fn("Yeet.retireObservedProofLock")(function* (
  lockPath: string,
  retirementText: string,
  observed: ObservedProofLockState
): Effect.fn.Return<O.Option<boolean>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem> {
  if (O.isSome(observed.retirementState)) {
    return O.some(true);
  }
  if (O.isSome(observed.legacyState)) {
    return yield* legacyProofLockRefusal(lockPath, observed.legacyState.value);
  }
  return yield* pipe(
    observed.state,
    O.match({
      onNone: () =>
        Str.isEmpty(observed.text)
          ? tryClaimProofLockExclusive(lockPath, retirementText).pipe(
              Effect.map((claimed) => (claimed ? O.some(true) : O.none()))
            )
          : Effect.fail(activeProofLockRefusal(lockPath, observed.state)),
      onSome: (owner) =>
        ProcessIdentityStatus.$match(observed.ownerStatus, {
          alive: () => Effect.succeed(O.none<boolean>()),
          dead: () => replaceStaleProofLockWithRetirement(lockPath, retirementText, owner, observed),
          unknown: () => Effect.fail(unverifiableProofLockRefusal(lockPath, owner)),
        }),
    })
  );
});

/**
 * Retire the exclusive origin lock once every prior-version owner has drained.
 *
 * **Details**
 *
 * The persistent v4 marker makes the weighted scheduler the sole current-version
 * admission authority. Older v3 clients cannot decode the marker and therefore
 * fail closed instead of racing a current proof. A live v3 owner yields `None`;
 * a stale v3 owner is replaced through the existing observation-bound CAS path.
 *
 * **Example** (Reference the lock-retirement operation)
 *
 * ```ts
 * import { retireFullProofLockOrObserveAtPath } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof retireFullProofLockOrObserveAtPath) // "function"
 * ```
 *
 * @param lockPath - Existing per-origin coordinator path being retired.
 * @returns `Some(true)` when the retirement marker is installed, otherwise
 * `None` while a live v3 owner is still draining.
 * @category resource-management
 * @since 0.0.0
 */
export const retireFullProofLockOrObserveAtPath = Effect.fn("Yeet.retireFullProofLockOrObserveAtPath")(function* (
  lockPath: string
): Effect.fn.Return<O.Option<boolean>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  yield* ensureProofCoordinatorDirectory(path.dirname(lockPath));
  const retirementText = `${yield* renderJson(
    YeetProofLockRetirementState.make({
      schemaVersion: "yeet-proof-lock/v4",
      coordination: "quality-scheduler/v1",
      retiredAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    })
  )}\n`;
  if (yield* tryClaimProofLockExclusive(lockPath, retirementText)) {
    return O.some(true);
  }
  return yield* retireObservedProofLock(lockPath, retirementText, yield* observeProofLockState(lockPath));
});

const acquireFullProofFallbackLockOrObserveAtPathWithProcessStart = Effect.fn(
  "Yeet.acquireFullProofFallbackLockOrObserveAtPathWithProcessStart"
)(function* (
  lockPath: string,
  context: RepoRunContext,
  command: string,
  processStart: O.Option<string>
): Effect.fn.Return<O.Option<YeetProofLockLease>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const fallbackPath = path.join(path.dirname(lockPath), "scheduler-fallback.lock");
  const procStart = yield* pipe(
    processStart,
    Effect.fromOption(() =>
      YeetCommandError.make({
        message:
          `Cannot acquire the machine-wide Yeet proof fallback lock at ${fallbackPath} because the current ` +
          "process start identity is unavailable. Refusing PID-only ownership because PID reuse could strand the lock.",
        command,
        exitCode: 1,
        file: fallbackPath,
      })
    )
  );
  const prepared = yield* prepareFullProofLockLeaseForCommandAt(fallbackPath, context, command, procStart);
  return yield* tryAcquirePreparedFullProofLock(prepared);
});

/**
 * Attempt the exclusive fallback lock used below the scheduler memory envelope.
 *
 * **Details**
 *
 * The fallback has one fixed path in the machine-wide proof-coordinator
 * directory because each original origin path remains a persistent v4
 * retirement marker. Every repository origin therefore contends for the same
 * lock on machines that cannot safely create a weighted admission slot.
 *
 * **Example** (Reference the fallback acquisition)
 *
 * ```ts
 * import { acquireFullProofFallbackLockOrObserveAtPath } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof acquireFullProofFallbackLockOrObserveAtPath) // "function"
 * ```
 *
 * @param lockPath - Retired per-origin path whose parent is the machine-wide
 * proof-coordinator directory.
 * @param context - Repo context recorded as the prospective fallback owner.
 * @param command - Full proof command recorded in fallback lock metadata.
 * @returns The acquired fallback lease, or `None` while another current proof owns it.
 * @category resource-management
 * @since 0.0.0
 */
export const acquireFullProofFallbackLockOrObserveAtPath = Effect.fn(
  "Yeet.acquireFullProofFallbackLockOrObserveAtPath"
)(function* (
  lockPath: string,
  context: RepoRunContext,
  command: string
): Effect.fn.Return<O.Option<YeetProofLockLease>, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  return yield* acquireFullProofFallbackLockOrObserveAtPathWithProcessStart(
    lockPath,
    context,
    command,
    yield* processStartIdentityForPid(process.pid)
  );
});

/**
 * Exercise machine-wide fallback acquisition with an explicit process identity.
 *
 * **Example** (Model an unavailable process identity)
 *
 * ```ts
 * import { acquireFullProofFallbackLockOrObserveAtPathForTesting, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Option } from "effect"
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
 * const guarded = acquireFullProofFallbackLockOrObserveAtPathForTesting(
 *   ".beep/yeet/proof.lock",
 *   context,
 *   "bun run beep yeet verify",
 *   Option.none()
 * )
 * void guarded
 * ```
 *
 * @param lockPath - Retired per-origin path used to locate the fallback lock.
 * @param context - Repo context recorded as the prospective fallback owner.
 * @param command - Full proof command recorded in fallback lock metadata.
 * @param processStart - Explicit process-start identity used by the test.
 * @returns The guarded fallback acquisition effect.
 * @category testing
 * @since 0.0.0
 */
export const acquireFullProofFallbackLockOrObserveAtPathForTesting =
  acquireFullProofFallbackLockOrObserveAtPathWithProcessStart;

/**
 * Remove a previously acquired full-proof lock path.
 *
 * **Example** (Release quality-lock path)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   acquireLegacyFullProofLockForTesting,
 *   releaseProofLock,
 *   RepoPlanStep,
 *   RepoRunContext
 * } from "@beep/repo-cli/test/Yeet"
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
 * const guarded = Effect.acquireUseRelease(
 *   acquireLegacyFullProofLockForTesting(context, [step]),
 *   (lease) => Effect.succeed(lease.lockPath),
 *   releaseProofLock
 * )
 * console.log(Effect.isEffect(guarded)) // true
 * ```
 *
 * @param lease - Exact lock generation returned by the legacy acquisition test seam.
 * @returns An Effect that removes only the generation owned by the lease.
 * @category resource-management
 * @since 0.0.0
 */
export const releaseProofLock = Effect.fn("releaseProofLock")(function* (lease: YeetProofLockLease) {
  yield* tryMoveObservedProofLock(lease.lockPath, lease.lockText).pipe(Effect.ignore);
});

/**
 * Write exact-match proof state after Yeet verification succeeds.
 *
 * **Example** (Write full verified state)
 *
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
 *
 * @param context - Repo context whose branch, base, head, and artifact paths
 * are recorded.
 * @param tier - Proof tier that produced the reusable state.
 * @param proofSteps - Proof steps whose command hashes are persisted.
 * @returns An Effect that completes after the state file is written.
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
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const artifactDir = yield* artifactDirForContext(context);
  const statePath = yield* runStatePathForContext(context);
  const diffFingerprint = yield* collectDiffFingerprint(context);
  const verifiedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const laneProofs = yield* Effect.forEach(
    proofSteps,
    (step) => laneProofStateForStep(step, diffFingerprint, verifiedAt),
    { concurrency: "unbounded" }
  );
  const state = YeetRunState.make({
    schemaVersion: "yeet-run-state/v1",
    artifactDir,
    base: context.base,
    branch: context.branch,
    commitSha: yield* currentCommitSha(context),
    diffFingerprint,
    head: context.head,
    laneProofs,
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
 * **Example** (Build legacy state path)
 *
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
 *
 * @param context - Repo context whose branch and artifact directory determine
 * the legacy path.
 * @returns An Effect yielding the legacy `state.json` location.
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
 * **Example** (Load proof tier state)
 *
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
 *
 * @param context - Repo context whose artifact paths are inspected.
 * @returns The decoded durable proof state for the current branch.
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
        Effect.asSome,
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
 * **Example** (Load verifiedAt for tests)
 *
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
 *
 * @category testing
 * @since 0.0.0
 */
export const loadVerifiedStateForTesting = loadVerifiedState;

/**
 * Assert that the saved full-proof state still matches the current worktree.
 *
 * **Example** (Assert matching proof state)
 *
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
 *
 * @param context - Repo context whose branch, base, head, commit, and diff are
 * compared with the saved proof state.
 * @returns An Effect that completes only when the saved full proof is reusable.
 * @category diagnostics
 * @since 0.0.0
 */
export const assertReusableVerifiedState = Effect.fn("Yeet.assertReusableVerifiedState")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  void,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
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
