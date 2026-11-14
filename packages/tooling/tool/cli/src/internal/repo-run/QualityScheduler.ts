/**
 * Machine-wide weighted admission scheduler for heavyweight repository work
 * (ship-velocity D1).
 *
 * Contenders enqueue a durable ticket under the per-user runtime directory,
 * wait with visible progress, and are admitted strictly in priority + FIFO
 * order whenever their token weight fits the live memory-derived capacity.
 * Admitted work holds a heartbeated lease; leases are reaped only when the
 * owner pid is dead or its `/proc` start time no longer matches (pid reuse),
 * and malformed state is quarantined visibly instead of blocking forever.
 *
 * Current-version proofs use this scheduler as their sole weighted admission
 * authority. The caller-supplied {@link AdmissionOriginGate} retires the old
 * per-origin lock only after prior-version owners drain and retains a distinct
 * exclusive fallback for hosts below the scheduler memory envelope.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as OptionUtils from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, identity, pipe } from "effect/Function";
import * as HS from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  AdmissionEvictionEmission,
  AdmissionJournalAdmitted,
  AdmissionJournalEnqueued,
  AdmissionJournalLeaseEvictedV3,
  AdmissionJournalReleasedV3,
  AdmissionJournalRouted,
  AdmissionJournalTicketEvictedV3,
  AdmissionJournalWithdrawn,
  AdmissionProtocol,
  AdmissionUnitEmission,
  acquireJournalFileLock,
  appendAdmissionEvictionJournalEvent,
  appendAdmissionJournalEvent,
  appendAdmissionJournalEventOnce,
  pruneAgedAdmissionJournalArchive,
  readAdmissionJournalArchive,
  readAdmissionJournalHistory,
  readAdmissionProtocol,
  releaseJournalFileLock,
  writeAdmissionProtocol,
} from "./AdmissionJournal.ts";
import { appendSchedulerAttemptTerminated } from "./AttemptTerminationJournal.ts";
import { computeEnvelopeGib, resolveComputeProfileForCeiling } from "./ComputeProfile.ts";
import { gateRouteFor } from "./GateRoute.schemas.ts";
import { admissionCapacityTokensFor, MemoryStats, parseMeminfoFieldGib } from "./MemoryStats.service.ts";
import { isProcessIdentityAlive, processStartIdentityForPid } from "./ProcessIdentity.ts";
import {
  AdmissionClaimSinkState,
  AdmissionConfig,
  AdmissionCoordinationProtocol,
  AdmissionLeaseReapClaim,
  AdmissionOwner,
  AdmissionPromotionPhase,
  AdmissionPromotionTransition,
  AdmissionReapClaim,
  AdmissionRequest,
  AdmissionRoute,
  AdmissionSnapshot,
  AdmissionTicketReapClaim,
  ComputeProfileRefusal,
  DeadLeaseScopePlan,
  QualitySchedulerError,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "./QualityScheduler.schemas.ts";
import {
  isProofJobUnitName,
  RunScopeRecord,
  RunScopeStopOutcome,
  RunScopeSupport,
  RunScopeTelemetry,
} from "./RunScope.schemas.ts";
import {
  enterRunScope,
  readPlannedRunScopeCgroup,
  readRunScopeTelemetry,
  runScopeUnitName,
  stopRunScopeForReap,
} from "./RunScope.ts";
import { admissionRootFor, perUserRuntimeRoot } from "./RuntimeRoot.ts";
import type { UUID } from "@beep/repo-cli-kit/schema/Uuid";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { AdmissionJournalLeaseEvicted, AdmissionJournalTicketEvicted } from "./AdmissionJournal.ts";

const $I = $RepoCliId.create("internal/repo-run/QualityScheduler");

const warnAdmissionJournalError = (error: QualitySchedulerError) =>
  Console.warn(`[yeet] admission journal append failed: ${error.message}`);

const appendAbnormalAttemptEnd = Effect.fn("QualityScheduler.appendAbnormalAttemptEnd")(function* (
  owner: YeetAdmissionLease | YeetAdmissionTicket,
  reason: "lease-eviction" | "queued-submitter-death",
  attemptId: UUID
) {
  yield* appendSchedulerAttemptTerminated(owner, attemptId, reason);
});

/**
 * Service contract for idempotent scheduler-owned attempt termination.
 *
 * Implementations acknowledge an already-published terminal row for the same
 * attempt instead of appending a second outcome. The admission reaper can then
 * safely replay a pending outbox after a crash between publication and local
 * acknowledgement.
 *
 * @category services
 * @since 0.0.0
 */
export interface AdmissionAttemptTerminationJournalShape {
  /** Publish or acknowledge one abnormal terminal outcome by attempt identity. */
  readonly appendOnce: (
    owner: YeetAdmissionLease | YeetAdmissionTicket,
    reason: "lease-eviction" | "queued-submitter-death",
    attemptId: UUID
  ) => Effect.Effect<
    void,
    QualitySchedulerError,
    Digest.Digest | SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
  >;
}

/**
 * Idempotent attempt-terminal sink used by admission claim recovery.
 *
 * **Example** (Provide a test implementation)
 *
 * ```ts
 * import { AdmissionAttemptTerminationJournal } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const layer = Layer.succeed(
 *   AdmissionAttemptTerminationJournal,
 *   AdmissionAttemptTerminationJournal.of({ appendOnce: () => Effect.void })
 * )
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AdmissionAttemptTerminationJournal extends Context.Service<
  AdmissionAttemptTerminationJournal,
  AdmissionAttemptTerminationJournalShape
>()($I`AdmissionAttemptTerminationJournal`) {}

/**
 * Service contract for idempotent, protocol-gated admission eviction events.
 *
 * A `true` result acknowledges that the eviction event was admitted or was
 * already present. A `false` result leaves the durable reap claim pending
 * because the mixed-checkout protocol still disables eviction emission.
 *
 * @category services
 * @since 0.0.0
 */
export interface AdmissionEvictionJournalShape {
  /** Publish or acknowledge one eviction event when the admission protocol permits it. */
  readonly appendOnce: (
    root: string,
    event:
      | AdmissionJournalLeaseEvicted
      | AdmissionJournalTicketEvicted
      | AdmissionJournalLeaseEvictedV3
      | AdmissionJournalTicketEvictedV3
  ) => Effect.Effect<
    boolean,
    QualitySchedulerError,
    Digest.Digest | SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
  >;
}

/**
 * Protocol-gated admission-eviction sink used by reap-claim recovery.
 *
 * **Example** (Provide an acknowledging test sink)
 *
 * ```ts
 * import { AdmissionEvictionJournal } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * const layer = Layer.succeed(
 *   AdmissionEvictionJournal,
 *   AdmissionEvictionJournal.of({ appendOnce: () => Effect.succeed(true) })
 * )
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AdmissionEvictionJournal extends Context.Service<
  AdmissionEvictionJournal,
  AdmissionEvictionJournalShape
>()($I`AdmissionEvictionJournal`) {}

const defaultAttemptTerminationJournal = AdmissionAttemptTerminationJournal.of({
  appendOnce: appendAbnormalAttemptEnd,
});

const defaultAdmissionEvictionJournal = AdmissionEvictionJournal.of({
  appendOnce: appendAdmissionEvictionJournalEvent,
});

const journalAbnormalAttemptEnd = Effect.fn("QualityScheduler.journalAbnormalAttemptEnd")(function* (
  journal: AdmissionAttemptTerminationJournalShape,
  owner: YeetAdmissionLease | YeetAdmissionTicket,
  reason: "lease-eviction" | "queued-submitter-death"
) {
  yield* O.match(owner.attemptId, {
    onNone: () => Effect.void,
    onSome: (attemptId) => journal.appendOnce(owner, reason, attemptId),
  });
});

const decodeLease = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const encodeLease = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const decodeTicket = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const encodeTicket = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const decodeReapClaim = S.decodeUnknownEffect(S.fromJsonString(AdmissionReapClaim));
const encodeReapClaim = S.encodeUnknownEffect(S.fromJsonString(AdmissionReapClaim));
const decodePromotionTransition = S.decodeUnknownEffect(S.fromJsonString(AdmissionPromotionTransition));
const encodePromotionTransition = S.encodeUnknownEffect(S.fromJsonString(AdmissionPromotionTransition));

const recoveryRecordSettlementWindow = Duration.seconds(5);
const recoveryRecordSettlementPollInterval = Duration.millis(25);
const textEncoder = new TextEncoder();

// Preserve the scheduler's existing import surface while the memory service
// has a cohesive private owner; there is one Context token and implementation.
export {
  admissionCapacityTokensFor,
  MemoryStats,
  MemoryStatsLive,
  memoryStatsLayerFor,
} from "./MemoryStats.service.ts";
export type { MemoryStatsShape } from "./MemoryStats.service.ts";

interface AdmissionDirectories {
  readonly claims: string;
  readonly leases: string;
  readonly promotions: string;
  readonly quarantine: string;
  readonly queue: string;
  readonly root: string;
}

const admissionDirectoriesFor = (path: Path.Path, root: string): AdmissionDirectories => ({
  root,
  claims: path.join(root, "claims"),
  leases: path.join(root, "leases"),
  promotions: path.join(root, "promotions"),
  queue: path.join(root, "queue"),
  quarantine: path.join(root, "quarantine"),
});

/**
 * Effective uid of the current process, when the platform exposes one.
 *
 * **Example** (Read the effective uid option)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { currentEffectiveUserIdOption } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(O.isOption(currentEffectiveUserIdOption())) // true
 * ```
 *
 * @returns The effective uid, or `None` where `process.geteuid` is absent.
 * @category liveness
 * @since 0.0.0
 */
export const currentEffectiveUserIdOption = (): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(process.geteuid),
    O.map((getEffectiveUserId) => getEffectiveUserId())
  );

/**
 * Options for {@link validatePrivateCoordinationDirectory}.
 *
 * @category coordination
 * @since 0.0.0
 */
export interface PrivateCoordinationDirectoryOptions<DirectoryError> {
  /** Effective uid to require as owner; `None` skips the ownership check. */
  readonly effectiveUserId: O.Option<number>;
  /** Human label used verbatim in refusal messages, e.g. `Admission directory`. */
  readonly label: string;
  /** Build the failure for an unreadable directory. */
  readonly onStatError: (cause: unknown) => DirectoryError;
  /** Build the failure for one violated invariant message. */
  readonly onViolation: (message: string) => DirectoryError;
}

/**
 * Fail-closed validation for a private (0700, self-owned) coordination
 * directory, shared by the admission scheduler and the proof coordinator.
 *
 * **Example** (Reference the validator)
 *
 * ```ts
 * import { validatePrivateCoordinationDirectory } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof validatePrivateCoordinationDirectory) // "function"
 * ```
 *
 * @param directory - Directory whose safety invariants are checked.
 * @param options - Label, required owner, and error constructors.
 * @returns An Effect that fails when the directory is unsafe to coordinate in.
 * @category coordination
 * @since 0.0.0
 */
export const validatePrivateCoordinationDirectory = Effect.fnUntraced(function* <DirectoryError>(
  directory: string,
  options: PrivateCoordinationDirectoryOptions<DirectoryError>
): Effect.fn.Return<void, DirectoryError, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const require = (satisfied: boolean, message: string) =>
    satisfied ? Effect.void : Effect.fail(options.onViolation(message));
  const symbolicLinkTarget = yield* fs.readLink(directory).pipe(Effect.option);
  const info = yield* fs.stat(directory).pipe(Effect.mapError(options.onStatError));
  yield* require(O.isNone(symbolicLinkTarget), `${options.label} ${directory} is a symbolic link. Refusing to use it.`);
  yield* require(info.type === "Directory", `${options.label} ${directory} is not a directory. Refusing to use it.`);
  const mode = info.mode & 0o777;
  yield* require(mode ===
    0o700, `${options.label} ${directory} has mode ${mode.toString(8)}; expected 0700. Refusing to use it.`);
  const reportedOwner = O.match(info.uid, {
    onNone: () => "no owner",
    onSome: (owner) => `uid ${owner}`,
  });
  yield* O.match(options.effectiveUserId, {
    onNone: () => Effect.void,
    onSome: (userId) =>
      require(O.exists(
        info.uid,
        (owner) => owner === userId
      ), `${options.label} ${directory} reported ${reportedOwner}; expected effective uid ${userId}. Refusing to use it.`),
  });
});

const validateAdmissionDirectory = (directory: string) =>
  validatePrivateCoordinationDirectory(directory, {
    label: "Admission directory",
    effectiveUserId: currentEffectiveUserIdOption(),
    onViolation: (message) => QualitySchedulerError.make({ message }),
    onStatError: QualitySchedulerError.new(`Failed to inspect Admission directory ${directory}.`),
  });

const ensureAdmissionDirectories = Effect.fnUntraced(function* (): Effect.fn.Return<
  AdmissionDirectories,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // The base root is shared with the proof-lock coordinator (RuntimeRoot.ts),
  // so every session on the machine coordinates under one tree.
  const choice = yield* perUserRuntimeRoot();
  const directories = admissionDirectoriesFor(path, admissionRootFor(path, choice));
  yield* Effect.forEach(
    [
      directories.root,
      directories.claims,
      directories.leases,
      directories.promotions,
      directories.queue,
      directories.quarantine,
    ],
    (directory) =>
      fs
        .makeDirectory(directory, { recursive: true, mode: 0o700 })
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to create admission directory ${directory}.`))),
    { discard: true }
  );
  yield* validateAdmissionDirectory(directories.root);
  return directories;
});

/**
 * Read the machine-wide admission protocol marker.
 *
 * **Example** (Inspect eviction emission)
 *
 * ```ts
 * import { admissionProtocolStatus } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(admissionProtocolStatus())) // true
 * ```
 *
 * @returns The current protocol, defaulting eviction emission to off.
 * @category utilities
 * @since 0.0.0
 */
export const admissionProtocolStatus = Effect.fn("QualityScheduler.admissionProtocolStatus")(function* () {
  const directories = yield* ensureAdmissionDirectories();
  return yield* readAdmissionProtocol(directories.root);
});

/**
 * List the machine-wide admission-journal archive's day segments.
 *
 * **Example** (Inspect the archive listing)
 *
 * ```ts
 * import { admissionJournalArchiveStatus } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(admissionJournalArchiveStatus())) // true
 * ```
 *
 * @returns The archive directory under the admission root and its segment names, oldest first.
 * @category utilities
 * @since 0.0.0
 */
export const admissionJournalArchiveStatus = Effect.fn("QualityScheduler.admissionJournalArchiveStatus")(function* () {
  const directories = yield* ensureAdmissionDirectories();
  return yield* readAdmissionJournalArchive(directories.root);
});

/**
 * Fold the machine-wide admission history: archived rows plus the live journal.
 *
 * **Example** (Read the admission history)
 *
 * ```ts
 * import { admissionJournalHistory } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(admissionJournalHistory())) // true
 * ```
 *
 * @returns The deduplicated admission history with its row counts.
 * @category utilities
 * @since 0.0.0
 */
export const admissionJournalHistory = Effect.fn("QualityScheduler.admissionJournalHistory")(function* () {
  const directories = yield* ensureAdmissionDirectories();
  return yield* readAdmissionJournalHistory(directories.root);
});

/**
 * Atomically change admission-journal eviction emission.
 *
 * **Example** (Reference the protocol writer)
 *
 * ```ts
 * import { setAdmissionEvictionProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof setAdmissionEvictionProtocol) // "function"
 * ```
 *
 * @param eviction - Desired v3 eviction-event emission state under the protocol v2 fence.
 * @returns The protocol marker that was published.
 * @category utilities
 * @since 0.0.0
 */
export const setAdmissionEvictionProtocol = Effect.fn("QualityScheduler.setAdmissionEvictionProtocol")(function* (
  eviction: AdmissionEvictionEmission
) {
  const directories = yield* ensureAdmissionDirectories();
  return yield* writeAdmissionProtocol(directories.root, (current) => AdmissionProtocol.make({ ...current, eviction }));
});

/**
 * Atomically change whether writers record admission-unit fields (SCHE-08).
 *
 * **Details**
 *
 * Turn it on only once every live checkout runs a revision that reads the unit,
 * weight source and owner keys. The eviction gate keeps its state.
 *
 * **Example** (Reference the unit-gate writer)
 *
 * ```ts
 * import { setAdmissionUnitProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof setAdmissionUnitProtocol) // "function"
 * ```
 *
 * @param units - Desired admission-unit field emission state.
 * @returns The protocol marker that was published.
 * @category utilities
 * @since 0.0.0
 */
export const setAdmissionUnitProtocol = Effect.fn("QualityScheduler.setAdmissionUnitProtocol")(function* (
  units: AdmissionUnitEmission
) {
  const directories = yield* ensureAdmissionDirectories();
  return yield* writeAdmissionProtocol(directories.root, (current) => AdmissionProtocol.make({ ...current, units }));
});

// Staging siblings are named `<target>.tmp-<pid>[-<start identity>]-<uuid>`.
// The writer's process start identity rides along hex-encoded (a `ps`-sourced
// identity contains spaces) so the repair scan classifies an orphan with the
// same pid-reuse fence leases use, instead of trusting a bare pid.
const stagingTemporaryPath = Effect.fnUntraced(function* (filePath: string, procStart: O.Option<string>) {
  const crypto = yield* SecureRandom.SecureRandom;
  const token = yield* crypto.uuidV4();
  return `${filePath}.tmp-${process.pid}${O.match(procStart, {
    onNone: () => "",
    onSome: (identity) => `-${Hex.encode(identity)}`,
  })}-${token}`;
});

const stagingFileNamePattern =
  /\.tmp-(\d+)(?:-([0-9a-f]+))?-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface StagingFileOwner {
  readonly pid: number;
  readonly procStart: string;
}

// A name without an identity segment (written before identities were recorded)
// classifies by pid liveness alone, exactly like a legacy lease.
const stagingFileIdentity = (segment: string | undefined): string =>
  pipe(
    O.fromUndefinedOr(segment),
    O.map(flow(Hex.decodeString, Result.getOrElse(constant(Str.empty)))),
    O.getOrElse(constant(Str.empty))
  );

const stagingFileOwner = (name: string): O.Option<StagingFileOwner> =>
  pipe(
    O.fromNullishOr(stagingFileNamePattern.exec(name)),
    O.flatMap((match) =>
      pipe(
        O.fromUndefinedOr(match[1]),
        O.flatMap(Num.parse),
        O.map((pid) => ({ pid, procStart: stagingFileIdentity(match[2]) }))
      )
    )
  );

// `force` turns an already-consumed temporary into a no-op; any other refusal
// leaves an orphan behind, so it is reported rather than swallowed.
const removeStagingFile = Effect.fnUntraced(function* (
  temporary: string
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(temporary, { force: true }).pipe(
    Effect.tapError((error) =>
      Console.error(`[yeet] failed to remove admission staging file ${temporary}: ${error.message}`)
    ),
    Effect.ignore
  );
});

// Stage the complete content in a sibling temp file so publication (rename or
// hard link) is atomic and a concurrent repair scan can never observe (and
// quarantine) a partial write.
const stageTemporaryFile = Effect.fnUntraced(function* (
  temporary: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(temporary, { flag: "w" });
      yield* file.writeAll(textEncoder.encode(content));
      yield* file.sync;
    })
  ).pipe(Effect.mapError(QualitySchedulerError.new(`Failed to stage admission state at ${temporary}.`)));
});

// Stage, then publish. The staged temporary is removed once the pair settles,
// however it settles: a successful rename already consumed it (the forced
// remove is a no-op), a hard link or any failure leaves it behind, and an
// interrupt can land mid-write or between the two steps because every lease
// release interrupts the heartbeat fiber. `Effect.ensuring` runs its finalizer
// uninterruptibly, so no exit path can strand a `.tmp-` sibling.
const withStagedTemporaryFile = Effect.fnUntraced(function* <A>(
  filePath: string,
  content: string,
  publish: (
    temporary: string
  ) => Effect.Effect<A, QualitySchedulerError, Digest.Digest | SecureRandom.SecureRandom | FileSystem.FileSystem>
): Effect.fn.Return<A, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  const procStart = yield* processStartIdentityForPid(process.pid);
  const temporary = yield* stagingTemporaryPath(filePath, O.filter(procStart, Str.isNonEmpty));
  return yield* stageTemporaryFile(temporary, content).pipe(
    Effect.andThen(publish(temporary)),
    Effect.ensuring(removeStagingFile(temporary))
  );
});

const writeFileAtomic = Effect.fnUntraced(function* (
  filePath: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  yield* withStagedTemporaryFile(filePath, content, (temporary) =>
    fs
      .rename(temporary, filePath)
      .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to publish admission state at ${filePath}.`)))
  );
});

const tryCreateExclusive = Effect.fnUntraced(function* (
  filePath: string,
  content: string
): Effect.fn.Return<boolean, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  return yield* withStagedTemporaryFile(filePath, content, (temporary) =>
    fs.link(temporary, filePath).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "AlreadyExists"
          ? Effect.succeed(false)
          : Effect.fail(QualitySchedulerError.new(`Failed to atomically create ${filePath}.`)(error))
      )
    )
  );
});

/**
 * Exercise the atomic stage-and-rename write without entering the scheduler.
 *
 * **Example** (Build an atomic write effect)
 *
 * ```ts
 * import { writeFileAtomicForTesting } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * const publication = writeFileAtomicForTesting("/repo/state.json", "{}")
 * console.log(Effect.isEffect(publication)) // true
 * ```
 *
 * @param filePath - Destination replaced atomically once the content is staged.
 * @param content - Content staged in a sibling temporary before the rename.
 * @returns An Effect that completes once the destination is published.
 * @category testing
 * @since 0.0.0
 */
export const writeFileAtomicForTesting = writeFileAtomic;

/**
 * Exercise exclusive-publication collisions without entering the scheduler.
 *
 * **Example** (Build an exclusive publication effect)
 *
 * ```ts
 * import { tryCreateExclusiveForTesting } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * const publication = tryCreateExclusiveForTesting("/repo/existing", "replacement")
 * console.log(Effect.isEffect(publication)) // true
 * ```
 *
 * @param filePath - Destination that must not already exist.
 * @param content - Content staged before the exclusive link attempt.
 * @returns An Effect yielding whether the destination was created.
 * @category testing
 * @since 0.0.0
 */
export const tryCreateExclusiveForTesting = tryCreateExclusive;

// Orphaned staging siblings never settle into `.json` state, so the entry scan
// cannot see them. Collect the ones whose writer is dead by the lease liveness
// rules (pid gone, or pid reused by a process with a different start identity)
// so a dry run previews exactly what repair removes; a live or unverifiable
// writer is an in-flight publication and is never listed.
const collectStaleStagingFiles = Effect.fnUntraced(function* (
  directories: AdmissionDirectories
): Effect.fn.Return<
  ReadonlyArray<string>,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const forEach1 = yield* Effect.forEach(
    [directories.claims, directories.leases, directories.promotions, directories.queue],
    Effect.fnUntraced(function* (directory: string) {
      const names = yield* fs
        .readDirectory(directory)
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to list admission state in ${directory}.`)));
      const forEach10 = yield* Effect.forEach(
        A.getSomes(A.map(names, (name) => O.map(stagingFileOwner(name), (owner) => ({ name, owner })))),
        ({ name, owner }) =>
          Effect.map(isProcessIdentityAlive(owner), (alive) =>
            alive ? O.none<string>() : O.some(path.join(directory, name))
          )
      );
      return A.getSomes(forEach10);
    })
  );
  return A.flatten(forEach1);
});

interface LiveAdmissionState {
  readonly dead: ReadonlyArray<string>;
  readonly deadLeases: ReadonlyArray<{ readonly path: string; readonly lease: YeetAdmissionLease }>;
  readonly deadTickets: ReadonlyArray<{ readonly path: string; readonly ticket: YeetAdmissionTicket }>;
  readonly leases: ReadonlyArray<{ readonly path: string; readonly lease: YeetAdmissionLease }>;
  readonly quarantined: ReadonlyArray<string>;
  readonly tickets: ReadonlyArray<{ readonly path: string; readonly ticket: YeetAdmissionTicket }>;
}

const quarantineEntry = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  entryPath: string,
  reason: string
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const destination = path.join(directories.quarantine, `${path.basename(entryPath)}.${nowMillis}`);
  yield* Console.error(`[yeet] quarantined malformed admission state ${entryPath} (${reason}) -> ${destination}`);
  yield* fs.rename(entryPath, destination).pipe(Effect.ignore);
});

/**
 * Directory name, under the admission root, that holds archived quarantine entries.
 *
 * **Details**
 *
 * The reap pass moves quarantine entries older than
 * {@link QUARANTINE_ARCHIVE_MIN_AGE_MILLIS} here instead of deleting them.
 * Nothing scans this directory, so archived entries are never re-read.
 *
 * **Gotchas**
 *
 * Restoring an entry means moving it into its live directory (`leases/` for
 * `*.lease.json`, `queue/` for `*.ticket.json`) under its original name, with
 * the `.<nowMillis>` quarantine suffix stripped. Moving it back into
 * `quarantine/` does not restore it: the name keeps its aged suffix, so the
 * next reap pass archives it again.
 *
 * **Example** (Name the archive directory)
 *
 * ```ts
 * import { QUARANTINE_ARCHIVE_DIRECTORY_NAME } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(QUARANTINE_ARCHIVE_DIRECTORY_NAME) // "quarantine-archive"
 * ```
 *
 * @category admission
 * @since 0.0.0
 */
export const QUARANTINE_ARCHIVE_DIRECTORY_NAME = "quarantine-archive";

/**
 * Minimum age before the reap pass archives a quarantine entry (seven days).
 *
 * **Example** (Read the archive age gate)
 *
 * ```ts
 * import { QUARANTINE_ARCHIVE_MIN_AGE_MILLIS } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(QUARANTINE_ARCHIVE_MIN_AGE_MILLIS) // 604800000
 * ```
 *
 * @category admission
 * @since 0.0.0
 */
export const QUARANTINE_ARCHIVE_MIN_AGE_MILLIS = Duration.toMillis(Duration.days(7));

/**
 * Instant a quarantine entry was quarantined, read from its `.<nowMillis>` suffix.
 *
 * **Details**
 *
 * `quarantineEntry` appends the quarantine instant to the original file name.
 * A path without that suffix (a malformed entry still in place) has no instant.
 *
 * **Example** (Read the quarantine instant)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { quarantinedAtMillisOf } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(O.getOrNull(quarantinedAtMillisOf("garbage.lease.json.1700000000000"))) // 1700000000000
 * console.log(O.isNone(quarantinedAtMillisOf("garbage.lease.json"))) // true
 * ```
 *
 * @param entryPath - Quarantine file name or path.
 * @returns The quarantine instant in epoch milliseconds, when the suffix is present.
 * @category admission
 * @since 0.0.0
 */
export const quarantinedAtMillisOf = (entryPath: string): O.Option<number> =>
  pipe(
    entryPath,
    Str.match(/\.(\d{10,})$/u),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.map(Number),
    O.filter(Number.isSafeInteger)
  );

/**
 * Whether a quarantine entry is old enough for the reap pass to archive it.
 *
 * **Details**
 *
 * An entry is aged once its quarantine instant is at least
 * {@link QUARANTINE_ARCHIVE_MIN_AGE_MILLIS} old. The reap pass and the dry-run
 * preview share this predicate, so `quality scheduler reap` without `--apply`
 * reports exactly the entries that `--apply` would move. An entry without a
 * quarantine suffix is never aged.
 *
 * **Example** (Check the archive age gate)
 *
 * ```ts
 * import { isAgedQuarantineEntry, QUARANTINE_ARCHIVE_MIN_AGE_MILLIS } from "@beep/repo-cli/test/RepoRun"
 *
 * const now = 1_700_000_000_000 + QUARANTINE_ARCHIVE_MIN_AGE_MILLIS
 * console.log(isAgedQuarantineEntry("garbage.lease.json.1700000000000", now)) // true
 * console.log(isAgedQuarantineEntry(now)("garbage.lease.json")) // false
 * ```
 *
 * @category admission
 * @since 0.0.0
 */
export const isAgedQuarantineEntry: {
  /**
   * @param nowMillis - Current instant in epoch milliseconds.
   * @returns A predicate over quarantine file names or paths.
   */
  (nowMillis: number): (entryPath: string) => boolean;
  /**
   * @param entryPath - Quarantine file name or path.
   * @param nowMillis - Current instant in epoch milliseconds.
   * @returns `true` when the entry carries a quarantine instant at least the archive age gate old.
   */
  (entryPath: string, nowMillis: number): boolean;
} = dual(2, (entryPath: string, nowMillis: number): boolean =>
  O.exists(
    quarantinedAtMillisOf(entryPath),
    (quarantinedAt) => nowMillis - quarantinedAt >= QUARANTINE_ARCHIVE_MIN_AGE_MILLIS
  )
);

const QUARANTINE_ARCHIVE_LOCK_NAME = "quarantine-archive.lock";

// Archive, never delete: aged quarantine entries move under the admission
// root's archive directory, from where a needed lease or ticket is restored
// into its live directory with the quarantine suffix stripped. Runs only in
// the reap pass (never in the status snapshot) and under an exclusive lock in
// claims/ so concurrent reapers do not interleave. Leases, tickets and reap
// claims are never touched; the lock is the archive's only write in claims/.
const archiveAgedQuarantine = Effect.fnUntraced(function* (
  directories: AdmissionDirectories
): Effect.fn.Return<number, never, SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const names = yield* fs.readDirectory(directories.quarantine).pipe(Effect.orElseSucceed(A.empty<string>));
  const aged = A.filter(names, isAgedQuarantineEntry(nowMillis));
  if (A.isReadonlyArrayEmpty(aged)) {
    return 0;
  }
  const lockPath = path.join(directories.claims, QUARANTINE_ARCHIVE_LOCK_NAME);
  const lockToken = yield* schedulerLockToken();
  if (!(yield* acquireJournalFileLock(lockPath, lockToken))) {
    return 0;
  }
  const archiveDirectory = path.join(directories.root, QUARANTINE_ARCHIVE_DIRECTORY_NAME);
  return yield* Effect.ensuring(
    Effect.gen(function* () {
      const ready = yield* fs
        .makeDirectory(archiveDirectory, { recursive: true, mode: 0o700 })
        .pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
      if (!ready) {
        yield* Console.error(`[yeet] could not create quarantine archive ${archiveDirectory}; nothing archived.`);
        return 0;
      }
      const moved = yield* Effect.forEach(
        aged,
        Effect.fnUntraced(function* (name: string) {
          const destination = path.join(archiveDirectory, name);
          // Never overwrite an archived entry: a collision keeps both copies.
          if (yield* fs.exists(destination).pipe(Effect.orElseSucceed(constant(true)))) {
            return false;
          }
          return yield* fs
            .rename(path.join(directories.quarantine, name), destination)
            .pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
        })
      );
      const count = A.length(A.filter(moved, identity));
      yield* count > 0
        ? Console.error(
            `[yeet] archived ${count} aged quarantine entr${count === 1 ? "y" : "ies"} -> ${archiveDirectory}`
          )
        : Effect.void;
      return count;
    }),
    releaseJournalFileLock(lockPath, lockToken)
  );
});

interface AdmissionEntryCodec<Entry, DecodeError> {
  readonly decode: (text: string) => Effect.Effect<Entry, DecodeError>;
  readonly ownerOf: (entry: Entry) => { readonly pid: number; readonly procStart: string };
}

type AdmissionEntryClass<Entry> =
  | { readonly kind: "skip" }
  | { readonly kind: "malformed" }
  | { readonly kind: "dead"; readonly entry: Entry }
  | { readonly kind: "live"; readonly entry: Entry };

const classifyAdmissionEntry = Effect.fnUntraced(function* <Entry, DecodeError>(
  entryPath: string,
  codec: AdmissionEntryCodec<Entry, DecodeError>
): Effect.fn.Return<AdmissionEntryClass<Entry>, never, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(entryPath).pipe(Effect.orElseSucceed(() => ""));
  if (Str.isEmpty(text)) {
    return { kind: "skip" };
  }
  const decoded = yield* codec.decode(text).pipe(Effect.asSome, Effect.orElseSucceed(O.none<Entry>));
  if (O.isNone(decoded)) {
    return { kind: "malformed" };
  }
  const alive = yield* isProcessIdentityAlive(codec.ownerOf(decoded.value));
  return alive ? { kind: "live", entry: decoded.value } : { kind: "dead", entry: decoded.value };
});

const collectAdmissionEntries = Effect.fnUntraced(function* <Entry, DecodeError>(
  directories: AdmissionDirectories,
  directory: string,
  codec: AdmissionEntryCodec<Entry, DecodeError>,
  repair: boolean
): Effect.fn.Return<
  {
    readonly live: ReadonlyArray<{ readonly path: string; readonly entry: Entry }>;
    readonly dead: ReadonlyArray<{ readonly path: string; readonly entry: Entry }>;
    readonly quarantined: ReadonlyArray<string>;
  },
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Fail closed: an unlistable coordination directory must never masquerade
  // as an empty one, or every active lease would vanish from capacity math.
  const names = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to list admission state in ${directory}.`)));
  const classified = yield* Effect.forEach(A.filter(names, Str.endsWith(".json")), (name) => {
    const entryPath = path.join(directory, name);
    return Effect.map(classifyAdmissionEntry(entryPath, codec), (outcome) => ({ entryPath, outcome }));
  });
  yield* repair
    ? Effect.forEach(
        classified,
        ({ entryPath, outcome }) =>
          outcome.kind === "malformed" ? quarantineEntry(directories, entryPath, "undecodable") : Effect.void,
        { discard: true }
      )
    : Effect.void;
  return {
    live: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) =>
        outcome.kind === "live" ? O.some({ path: entryPath, entry: outcome.entry }) : O.none()
      )
    ),
    dead: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) =>
        outcome.kind === "dead" ? O.some({ path: entryPath, entry: outcome.entry }) : O.none()
      )
    ),
    quarantined: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) => (outcome.kind === "malformed" ? O.some(entryPath) : O.none()))
    ),
  };
});

const readReapClaims = Effect.fnUntraced(function* (
  directories: AdmissionDirectories
): Effect.fn.Return<
  ReadonlyArray<{ readonly claimPath: string; readonly claim: AdmissionReapClaim }>,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs
    .readDirectory(directories.claims)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to list admission claims in ${directories.claims}.`)));
  const forEach2 = yield* Effect.forEach(
    A.filter(
      names,
      (name) => Str.endsWith(".reap.json")(name) || Str.endsWith(".reap.pending-protocol-off.json")(name)
    ),
    Effect.fnUntraced(function* (name: string) {
      const claimPath = path.join(directories.claims, name);
      const text = yield* fs.readFileString(claimPath).pipe(Effect.option);
      if (O.isNone(text)) {
        return O.none<{ readonly claimPath: string; readonly claim: AdmissionReapClaim }>();
      }
      const claim = yield* decodeReapClaim(text.value).pipe(Effect.option);
      if (O.isNone(claim)) {
        yield* quarantineEntry(directories, claimPath, "undecodable reap claim");
        return O.none<{ readonly claimPath: string; readonly claim: AdmissionReapClaim }>();
      }
      return O.some({ claimPath, claim: claim.value });
    })
  );
  return A.getSomes(forEach2);
});

const REAP_CLAIM_SUFFIX = ".reap.json";
const PROTOCOL_DEFERRED_REAP_CLAIM_SUFFIX = ".reap.pending-protocol-off.json";

const protocolDeferredReapClaimPath = Str.replace(/\.reap\.json$/u, PROTOCOL_DEFERRED_REAP_CLAIM_SUFFIX);

const reapClaimLockPath = (claimPath: string): string =>
  `${Str.replace(/\.reap\.pending-protocol-off\.json$/u, REAP_CLAIM_SUFFIX)(claimPath)}.lock`;

const reapClaimPath = Effect.fnUntraced(function* (
  path: Path.Path,
  directories: AdmissionDirectories,
  claim: AdmissionReapClaim
) {
  const crypto = yield* Digest.Digest;
  const bytes = yield* crypto.digest(
    Digest.sha256,
    new TextEncoder().encode(`${claim._tag}:${claim.nonce}:${claim.sourcePath}`)
  );
  const digest = Hex.encode(bytes);
  const suffix = AdmissionClaimSinkState.is["pending-protocol-off"](claim.admissionJournal)
    ? PROTOCOL_DEFERRED_REAP_CLAIM_SUFFIX
    : REAP_CLAIM_SUFFIX;
  return path.join(directories.claims, `${digest}${suffix}`);
});

const updateReapClaim = (
  claim: AdmissionReapClaim,
  update: {
    readonly admissionJournal?: AdmissionClaimSinkState;
    readonly attemptJournal?: AdmissionClaimSinkState;
  }
): AdmissionReapClaim =>
  AdmissionReapClaim.match(claim, {
    lease: (current) => AdmissionLeaseReapClaim.make({ ...current, ...update }),
    ticket: (current) => AdmissionTicketReapClaim.make({ ...current, ...update }),
  });

const ownerForReapClaim = (claim: AdmissionReapClaim): YeetAdmissionLease | YeetAdmissionTicket =>
  AdmissionReapClaim.match(claim, {
    lease: (current) => current.lease,
    ticket: (current) => current.ticket,
  });

const reasonForReapClaim = (claim: AdmissionReapClaim): "lease-eviction" | "queued-submitter-death" =>
  AdmissionReapClaim.match(claim, {
    lease: constant("lease-eviction" as const),
    ticket: constant("queued-submitter-death" as const),
  });

const admissionEventForReapClaim = (claim: AdmissionReapClaim) =>
  AdmissionReapClaim.match(claim, {
    lease: ({ lease, claimedAtMillis }) =>
      AdmissionJournalLeaseEvictedV3.make({
        schemaVersion: "yeet-admission-journal/v3",
        _tag: "admission-lease-evicted",
        nonce: lease.nonce,
        pid: lease.pid,
        attemptId: lease.attemptId,
        checkoutRoot: lease.checkoutRoot,
        branch: lease.branch,
        lastHeartbeatAtMillis: lease.heartbeatAtMillis,
        evictedAtMillis: claimedAtMillis,
        reason: "owner-dead-or-reused",
      }),
    ticket: ({ ticket, claimedAtMillis }) =>
      AdmissionJournalTicketEvictedV3.make({
        schemaVersion: "yeet-admission-journal/v3",
        _tag: "admission-ticket-evicted",
        nonce: ticket.nonce,
        pid: ticket.pid,
        attemptId: ticket.attemptId,
        checkoutRoot: ticket.checkoutRoot,
        branch: ticket.branch,
        evictedAtMillis: claimedAtMillis,
        reason: "queued-submitter-death",
      }),
  });

const persistReapClaim = Effect.fnUntraced(function* (
  claimPath: string,
  claim: AdmissionReapClaim
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  yield* writeFileAtomic(
    claimPath,
    `${yield* encodeReapClaim(claim).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to encode admission reap claim ${claimPath}.`))
    )}\n`
  );
});

const moveReapClaimBehindProtocolFence = Effect.fnUntraced(function* (
  claimPath: string
): Effect.fn.Return<string, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const deferredPath = protocolDeferredReapClaimPath(claimPath);
  if (Str.Equivalence(claimPath, deferredPath)) {
    return claimPath;
  }
  yield* fs
    .rename(claimPath, deferredPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to defer admission reap claim ${claimPath}.`)));
  return deferredPath;
});

const markReapClaimProtocolDeferred = Effect.fnUntraced(function* (
  claimPath: string,
  claim: AdmissionReapClaim
): Effect.fn.Return<
  readonly [string, AdmissionReapClaim],
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest
> {
  const deferredPath = yield* moveReapClaimBehindProtocolFence(claimPath);
  const deferred = updateReapClaim(claim, { admissionJournal: "pending-protocol-off" });
  yield* persistReapClaim(deferredPath, deferred);
  return [deferredPath, deferred];
});

const shieldReapClaimFromLegacyReaders = Effect.fnUntraced(function* (
  root: string,
  claimPath: string,
  claim: AdmissionReapClaim
): Effect.fn.Return<
  readonly [string, AdmissionReapClaim],
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  if (
    AdmissionClaimSinkState.is.complete(claim.admissionJournal) ||
    AdmissionClaimSinkState.is["pending-protocol-off"](claim.admissionJournal)
  ) {
    return [claimPath, claim];
  }
  return AdmissionEvictionEmission.is.off((yield* readAdmissionProtocol(root)).eviction)
    ? yield* markReapClaimProtocolDeferred(claimPath, claim)
    : [claimPath, claim];
});

const reapClaimSinksComplete = (claim: AdmissionReapClaim): boolean =>
  AdmissionClaimSinkState.is.complete(claim.attemptJournal) &&
  AdmissionClaimSinkState.is.complete(claim.admissionJournal);

const recoveryRecordRemainsAfterSettlement = Effect.fnUntraced(function* (
  recoveryPath: string
): Effect.fn.Return<boolean, never, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // A healthy owner may need several seconds to finish its sinks on a loaded runner.
  return yield* Effect.repeat(fs.exists(recoveryPath).pipe(Effect.orElseSucceed(constant(true))), {
    until: Bool.not,
    schedule: Schedule.spaced(recoveryRecordSettlementPollInterval),
  }).pipe(Effect.timeout(recoveryRecordSettlementWindow), Effect.orElseSucceed(constant(true)));
});

const processAttemptJournalSink = Effect.fnUntraced(function* (
  claimPath: string,
  claim: AdmissionReapClaim,
  journal: AdmissionAttemptTerminationJournalShape
): Effect.fn.Return<
  AdmissionReapClaim,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  if (AdmissionClaimSinkState.is.complete(claim.attemptJournal)) {
    return claim;
  }
  yield* journalAbnormalAttemptEnd(journal, ownerForReapClaim(claim), reasonForReapClaim(claim));
  const acknowledged = updateReapClaim(claim, { attemptJournal: "complete" });
  yield* persistReapClaim(claimPath, acknowledged);
  return acknowledged;
});

const processAdmissionJournalSink = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  claimPath: string,
  claim: AdmissionReapClaim,
  journal: AdmissionEvictionJournalShape
): Effect.fn.Return<
  O.Option<AdmissionReapClaim>,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  if (AdmissionClaimSinkState.is.complete(claim.admissionJournal)) {
    return O.some(claim);
  }
  const written = yield* journal.appendOnce(directories.root, admissionEventForReapClaim(claim));
  if (!written) {
    yield* markReapClaimProtocolDeferred(claimPath, claim);
    return O.none();
  }
  const acknowledged = updateReapClaim(claim, { admissionJournal: "complete" });
  yield* persistReapClaim(claimPath, acknowledged);
  return O.some(acknowledged);
});

const schedulerLockToken = Effect.fnUntraced(function* () {
  const crypto = yield* SecureRandom.SecureRandom;
  const token = yield* crypto.uuidV4();
  return `${process.pid}:${token}`;
});

const acquireSchedulerSettlementLock = Effect.fnUntraced(function* (
  lockPath: string,
  settlementPath: string,
  busyMessage: string
) {
  const lockToken = yield* schedulerLockToken();
  if (yield* acquireJournalFileLock(lockPath, lockToken)) {
    return O.some(lockToken);
  }
  if (yield* recoveryRecordRemainsAfterSettlement(settlementPath)) {
    return yield* QualitySchedulerError.make({ message: busyMessage });
  }
  return O.none();
});

const processReapClaim = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  claimPath: string,
  observedClaim: AdmissionReapClaim
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const lockPath = reapClaimLockPath(claimPath);
  const acquired = yield* acquireSchedulerSettlementLock(
    lockPath,
    claimPath,
    `Admission reap claim ${claimPath} stayed busy; its outputs remain pending.`
  );
  if (O.isNone(acquired)) {
    return;
  }
  const lockToken = acquired.value;
  yield* Effect.ensuring(
    Effect.gen(function* () {
      const currentText = yield* fs.readFileString(claimPath).pipe(Effect.option);
      if (O.isNone(currentText)) {
        return;
      }
      const claim = yield* decodeReapClaim(currentText.value).pipe(
        Effect.mapError(QualitySchedulerError.new(`Failed to decode admission reap claim ${claimPath}.`))
      );
      if (claim.nonce !== observedClaim.nonce || claim._tag !== observedClaim._tag) {
        return yield* QualitySchedulerError.make({
          message: `Admission reap claim ${claimPath} changed lifecycle identity while awaiting its lock.`,
        });
      }
      const [pendingClaimPath, pendingClaim] = yield* shieldReapClaimFromLegacyReaders(
        directories.root,
        claimPath,
        claim
      );
      yield* fs
        .remove(pendingClaim.sourcePath, { force: true })
        .pipe(
          Effect.mapError(
            QualitySchedulerError.new(`Failed to remove claimed admission state ${pendingClaim.sourcePath}.`)
          )
        );
      const serviceOption3 = yield* Effect.serviceOption(AdmissionAttemptTerminationJournal);
      const attemptJournal = O.getOrElse(serviceOption3, constant(defaultAttemptTerminationJournal));
      const serviceOption4 = yield* Effect.serviceOption(AdmissionEvictionJournal);
      const admissionJournal = O.getOrElse(serviceOption4, constant(defaultAdmissionEvictionJournal));
      const attemptPending = yield* processAttemptJournalSink(pendingClaimPath, pendingClaim, attemptJournal);
      const admissionPending = yield* processAdmissionJournalSink(
        directories,
        pendingClaimPath,
        attemptPending,
        admissionJournal
      );
      if (O.isNone(admissionPending) || !reapClaimSinksComplete(admissionPending.value)) {
        return;
      }
      yield* fs
        .remove(pendingClaimPath, { force: true })
        .pipe(
          Effect.mapError(QualitySchedulerError.new(`Failed to acknowledge admission reap claim ${pendingClaimPath}.`))
        );
    }),
    releaseJournalFileLock(lockPath, lockToken)
  );
});

const createReapClaim = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  claim: AdmissionReapClaim
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const path = yield* Path.Path;
  const pending = AdmissionEvictionEmission.is.off((yield* readAdmissionProtocol(directories.root)).eviction)
    ? updateReapClaim(claim, { admissionJournal: "pending-protocol-off" })
    : claim;
  const claimPath = yield* reapClaimPath(path, directories, pending);
  yield* tryCreateExclusive(
    claimPath,
    `${yield* encodeReapClaim(pending).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to encode admission reap claim ${claimPath}.`))
    )}\n`
  );
});

const claimDeadLease = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  sourcePath: string,
  lease: YeetAdmissionLease
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  yield* createReapClaim(
    directories,
    AdmissionLeaseReapClaim.make({
      schemaVersion: "yeet-admission-reap-claim/v1",
      _tag: "lease",
      sourcePath,
      nonce: lease.nonce,
      claimedAtMillis: yield* Clock.currentTimeMillis,
      attemptJournal: "pending",
      admissionJournal: "pending",
      lease,
    })
  );
});

const claimDeadTicket = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  sourcePath: string,
  ticket: YeetAdmissionTicket
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  yield* createReapClaim(
    directories,
    AdmissionTicketReapClaim.make({
      schemaVersion: "yeet-admission-reap-claim/v1",
      _tag: "ticket",
      sourcePath,
      nonce: ticket.nonce,
      claimedAtMillis: yield* Clock.currentTimeMillis,
      attemptJournal: "pending",
      admissionJournal: "pending",
      ticket,
    })
  );
});

const coalesceOverlappingAdmissionState = Effect.fnUntraced(function* (
  state: LiveAdmissionState
): Effect.fn.Return<LiveAdmissionState, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const leasedNonces = pipe(
    A.appendAll(state.leases, state.deadLeases),
    A.map(({ lease }) => lease.nonce),
    A.filter(Str.isNonEmpty),
    HS.fromIterable
  );
  const duplicateTickets = A.filter(A.appendAll(state.tickets, state.deadTickets), ({ ticket }) =>
    HS.has(leasedNonces, ticket.nonce)
  );
  yield* Effect.forEach(
    duplicateTickets,
    ({ path: ticketPath }) =>
      fs
        .remove(ticketPath, { force: true })
        .pipe(
          Effect.mapError(
            QualitySchedulerError.new(`Failed to coalesce promoted admission ticket ${ticketPath} with its lease.`)
          )
        ),
    { discard: true }
  );
  const duplicatePaths = pipe(
    duplicateTickets,
    A.map(({ path: ticketPath }) => ticketPath),
    HS.fromIterable
  );
  return {
    ...state,
    dead: A.filter(state.dead, (entryPath) => !HS.has(duplicatePaths, entryPath)),
    deadTickets: A.filter(state.deadTickets, ({ path: ticketPath }) => !HS.has(duplicatePaths, ticketPath)),
    tickets: A.filter(state.tickets, ({ path: ticketPath }) => !HS.has(duplicatePaths, ticketPath)),
  };
});

const repairDeadAdmissionState = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  state: LiveAdmissionState,
  retainedDeadLeasePaths: ReadonlyArray<string>
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const coalesced = yield* coalesceOverlappingAdmissionState(state);
  yield* Effect.forEach(
    A.filter(coalesced.deadLeases, ({ path }) => !A.contains(retainedDeadLeasePaths, path)),
    ({ lease, path: sourcePath }) => claimDeadLease(directories, sourcePath, lease),
    { discard: true }
  );
  yield* Effect.forEach(
    coalesced.deadTickets,
    ({ ticket, path: sourcePath }) => claimDeadTicket(directories, sourcePath, ticket),
    { discard: true }
  );
  const readReapClaims5 = yield* readReapClaims(directories);
  yield* Effect.forEach(readReapClaims5, ({ claimPath, claim }) => processReapClaim(directories, claimPath, claim), {
    discard: true,
  });
  yield* archiveAgedQuarantine(directories);
  yield* pruneAgedAdmissionJournalArchive(directories.root);
});

const promotionTransitionPath = (path: Path.Path, directories: AdmissionDirectories, nonce: string): string =>
  path.join(directories.promotions, `${nonce}.promotion.json`);

const persistPromotionTransition = Effect.fnUntraced(function* (
  transitionPath: string,
  transition: AdmissionPromotionTransition
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  const text = yield* encodePromotionTransition(transition).pipe(
    Effect.mapError(QualitySchedulerError.new(`Failed to encode admission promotion ${transitionPath}.`))
  );
  yield* writeFileAtomic(transitionPath, `${text}\n`);
});

const promotionAdmissionEvent = (transition: AdmissionPromotionTransition): AdmissionJournalAdmitted =>
  AdmissionJournalAdmitted.make({
    schemaVersion: "yeet-admission-journal/v1",
    _tag: "admission-admitted",
    nonce: transition.nonce,
    pid: transition.ticket.pid,
    procStart: transition.ticket.procStart,
    kind: transition.ticket.kind,
    weightTokens: transition.ticket.weightTokens,
    priority: transition.ticket.priority,
    originKey: transition.ticket.originKey,
    enqueuedAtMillis: transition.ticket.enqueuedAtMillis,
    admittedAtMillis: transition.lease.admittedAtMillis,
    attemptId: transition.ticket.attemptId,
    unit: transition.ticket.unit,
    weightSource: transition.ticket.weightSource,
    owner: transition.ticket.owner,
  });

const readPromotionLease = Effect.fnUntraced(function* (
  transition: AdmissionPromotionTransition
): Effect.fn.Return<O.Option<YeetAdmissionLease>, never, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(transition.leasePath).pipe(Effect.option);
  if (O.isNone(text)) {
    return O.none();
  }
  const pipe6 = yield* decodeLease(text.value).pipe(Effect.option);
  return pipe(
    pipe6,
    O.filter((lease) => lease.nonce === transition.nonce && lease.pid === transition.ticket.pid)
  );
});

const discardLeaseLessPreparedPromotion = Effect.fnUntraced(function* (
  transitionPath: string
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(transitionPath, { force: true })
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to discard lease-less promotion ${transitionPath}.`)));
});

const completePublishedPromotion = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  transitionPath: string,
  initial: AdmissionPromotionTransition,
  lease: YeetAdmissionLease
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  let transition = AdmissionPromotionTransition.make({ ...initial, lease });
  yield* fs
    .remove(transition.ticketPath, { force: true })
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to remove promoted ticket ${transition.ticketPath}.`)));
  if (
    AdmissionPromotionPhase.is.prepared(transition.phase) ||
    AdmissionPromotionPhase.is["lease-published"](transition.phase)
  ) {
    transition = AdmissionPromotionTransition.make({ ...transition, phase: "ticket-removed" });
    yield* persistPromotionTransition(transitionPath, transition);
  }
  if (!AdmissionPromotionPhase.is["admission-journaled"](transition.phase)) {
    const journaled = yield* appendAdmissionJournalEventOnce(
      directories.root,
      promotionAdmissionEvent(transition)
    ).pipe(
      Effect.as(true),
      Effect.catch((error) => warnAdmissionJournalError(error).pipe(Effect.as(false)))
    );
    if (!journaled) {
      return;
    }
    transition = AdmissionPromotionTransition.make({ ...transition, phase: "admission-journaled" });
    yield* persistPromotionTransition(transitionPath, transition);
  }
  yield* fs
    .remove(transitionPath, { force: true })
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to acknowledge admission promotion ${transitionPath}.`)));
});

const processPromotionTransition = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  transitionPath: string,
  observedNonce: string
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const lockPath = `${transitionPath}.lock`;
  const acquired = yield* acquireSchedulerSettlementLock(
    lockPath,
    transitionPath,
    `Admission promotion ${transitionPath} stayed busy; recovery remains pending.`
  );
  if (O.isNone(acquired)) {
    return;
  }
  const lockToken = acquired.value;
  yield* Effect.ensuring(
    Effect.gen(function* () {
      const currentText = yield* fs.readFileString(transitionPath).pipe(Effect.option);
      if (O.isNone(currentText)) {
        return;
      }
      const transition = yield* decodePromotionTransition(currentText.value).pipe(
        Effect.mapError(QualitySchedulerError.new(`Failed to decode admission promotion ${transitionPath}.`))
      );
      if (transition.nonce !== observedNonce) {
        return yield* QualitySchedulerError.make({
          message: `Admission promotion ${transitionPath} changed nonce while awaiting its lock.`,
        });
      }
      const lease = yield* readPromotionLease(transition);
      if (AdmissionPromotionPhase.is.prepared(transition.phase)) {
        if (O.isSome(lease)) {
          yield* completePublishedPromotion(
            directories,
            transitionPath,
            AdmissionPromotionTransition.make({ ...transition, phase: "lease-published" }),
            lease.value
          );
          return;
        }
        if (yield* isProcessIdentityAlive(transition.ticket)) {
          return;
        }
        yield* discardLeaseLessPreparedPromotion(transitionPath);
        return;
      }
      if (O.isNone(lease)) {
        yield* completePublishedPromotion(directories, transitionPath, transition, transition.lease);
        return;
      }
      yield* completePublishedPromotion(directories, transitionPath, transition, lease.value);
    }),
    releaseJournalFileLock(lockPath, lockToken)
  );
});

const recoverPromotionTransitions = Effect.fnUntraced(function* (
  directories: AdmissionDirectories
): Effect.fn.Return<
  void,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs
    .readDirectory(directories.promotions)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to list promotions in ${directories.promotions}.`)));
  yield* Effect.forEach(
    A.filter(names, Str.endsWith(".promotion.json")),
    Effect.fnUntraced(function* (name) {
      const transitionPath = path.join(directories.promotions, name);
      const text = yield* fs.readFileString(transitionPath).pipe(Effect.option);
      if (O.isNone(text)) {
        return;
      }
      const transition = yield* decodePromotionTransition(text.value).pipe(Effect.option);
      if (O.isNone(transition)) {
        yield* quarantineEntry(directories, transitionPath, "undecodable promotion transition");
        return;
      }
      yield* processPromotionTransition(directories, transitionPath, transition.value.nonce);
    }),
    { discard: true }
  );
});

const scanAdmissionState = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  repair: boolean,
  retainedDeadLeasePaths: ReadonlyArray<string> = A.empty()
): Effect.fn.Return<
  LiveAdmissionState,
  QualitySchedulerError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  yield* repair ? recoverPromotionTransitions(directories) : Effect.void;
  const staleStaging = yield* collectStaleStagingFiles(directories);
  yield* repair ? Effect.forEach(staleStaging, removeStagingFile, { discard: true }) : Effect.void;
  const leases = yield* collectAdmissionEntries(
    directories,
    directories.leases,
    {
      decode: decodeLease,
      ownerOf: (lease: YeetAdmissionLease) => lease,
    },
    repair
  );
  const tickets = yield* collectAdmissionEntries(
    directories,
    directories.queue,
    {
      decode: decodeTicket,
      ownerOf: (ticket: YeetAdmissionTicket) => ticket,
    },
    repair
  );
  const state: LiveAdmissionState = {
    leases: A.map(leases.live, ({ entry, path: entryPath }) => ({ path: entryPath, lease: entry })),
    tickets: A.map(tickets.live, ({ entry, path: entryPath }) => ({ path: entryPath, ticket: entry })),
    dead: A.appendAll(
      A.appendAll(
        A.map(leases.dead, ({ path: entryPath }) => entryPath),
        A.map(tickets.dead, ({ path: entryPath }) => entryPath)
      ),
      staleStaging
    ),
    deadLeases: A.map(leases.dead, ({ entry, path: entryPath }) => ({ path: entryPath, lease: entry })),
    deadTickets: A.map(tickets.dead, ({ entry, path: entryPath }) => ({ path: entryPath, ticket: entry })),
    quarantined: A.appendAll(leases.quarantined, tickets.quarantined),
  };
  yield* repair ? repairDeadAdmissionState(directories, state, retainedDeadLeasePaths) : Effect.void;
  return state;
});

const effectivePriorityRank = (ticket: YeetAdmissionTicket, nowMillis: number, config: AdmissionConfig): number =>
  ticket.priority === "publish" || nowMillis - ticket.enqueuedAtMillis >= config.publishAgingSeconds * 1000 ? 0 : 1;

const ticketOrder = (nowMillis: number, config: AdmissionConfig): Order.Order<YeetAdmissionTicket> =>
  pipe(
    Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => effectivePriorityRank(ticket, nowMillis, config)),
    Order.combine(Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => ticket.enqueuedAtMillis)),
    Order.combine(Order.mapInput(Order.String, (ticket: YeetAdmissionTicket) => ticket.nonce))
  );

/**
 * Orders admission tickets by effective rank, enqueue instant, and nonce.
 *
 * The nonce is the durable lifecycle identity and supplies a stable final
 * tie-break when separate writers enqueue within the same clock tick.
 *
 * **Example** (Reference the admission ticket order)
 *
 * ```ts
 * import { orderAdmissionTicketsForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof orderAdmissionTicketsForTesting) // "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const orderAdmissionTicketsForTesting: {
  (
    nowMillis: number,
    config: AdmissionConfig
  ): (tickets: ReadonlyArray<YeetAdmissionTicket>) => ReadonlyArray<YeetAdmissionTicket>;
  (
    tickets: ReadonlyArray<YeetAdmissionTicket>,
    nowMillis: number,
    config: AdmissionConfig
  ): ReadonlyArray<YeetAdmissionTicket>;
} = dual(3, (tickets, nowMillis, config) => A.sort(tickets, ticketOrder(nowMillis, config)));

const activeTokenTotal = (state: LiveAdmissionState): number =>
  A.reduce(state.leases, 0, (total, { lease }) => total + lease.weightTokens);

const hasLegacySameOriginLease = (state: LiveAdmissionState, ticket: YeetAdmissionTicket): boolean =>
  A.some(
    state.leases,
    ({ lease }) =>
      lease.originKey === ticket.originKey &&
      AdmissionCoordinationProtocol.is["legacy-origin-lock/v1"](lease.coordinationProtocol)
  );

const hasLegacySameOriginTicket = (state: LiveAdmissionState, ticket: YeetAdmissionTicket): boolean =>
  A.some(
    state.tickets,
    ({ ticket: queued }) =>
      queued.nonce !== ticket.nonce &&
      queued.originKey === ticket.originKey &&
      AdmissionCoordinationProtocol.is["legacy-origin-lock/v1"](queued.coordinationProtocol)
  );

const hasLegacySameOriginOwner = (state: LiveAdmissionState, ticket: YeetAdmissionTicket): boolean =>
  AdmissionCoordinationProtocol.is["scheduler-origin-concurrency/v1"](ticket.coordinationProtocol) &&
  Str.isNonEmpty(ticket.originKey) &&
  (hasLegacySameOriginLease(state, ticket) || hasLegacySameOriginTicket(state, ticket));

const hasSameCheckoutLease = (state: LiveAdmissionState, ticket: YeetAdmissionTicket): boolean =>
  A.some(state.leases, ({ lease }) => lease.checkoutRoot === ticket.checkoutRoot);

// A ticket is skippable (stays queued without blocking later tickets) when it
// targets a checkout that already has admitted work, recently reported its
// origin migration gate busy (held by a process on the previous Yeet release),
// or the review-fix class cap is saturated. Current-version same-origin proofs
// in distinct checkouts are capacity peers. Stamps expire so a crashed holder
// cannot leave a permanent skip.
const isTicketSkippable = (
  state: LiveAdmissionState,
  ticket: YeetAdmissionTicket,
  nowMillis: number,
  config: AdmissionConfig,
  ignoreOriginStamp: boolean
): boolean => {
  if (hasSameCheckoutLease(state, ticket) || hasLegacySameOriginOwner(state, ticket)) {
    return true;
  }
  const stampFresh =
    ticket.blockedOnOriginAtMillis > 0 &&
    nowMillis - ticket.blockedOnOriginAtMillis <= 3 * config.heartbeatSeconds * 1000;
  if (!ignoreOriginStamp && stampFresh) {
    return true;
  }
  if (ticket.kind === "review-fix") {
    const activeReviewFix = A.length(A.filter(state.leases, ({ lease }) => lease.kind === "review-fix"));
    return activeReviewFix >= config.reviewFixClassCap;
  }
  return false;
};

// Deterministic self-selection: a contender attempts promotion only when no
// earlier live ticket is unblocked (head-of-line waiting for capacity stays
// chartered FIFO). A ticket blocked on its origin keeps retrying — its own
// stamp is ignored for itself — while later origins may proceed; concurrent
// attempts are resolved by the overshoot rollback in tryAdmitSelf.
const selfMayAttempt = (
  state: LiveAdmissionState,
  capacityTokens: number,
  nowMillis: number,
  config: AdmissionConfig,
  self: YeetAdmissionTicket
): boolean => {
  const ordered = A.sort(
    A.map(state.tickets, ({ ticket }) => ticket),
    ticketOrder(nowMillis, config)
  );
  for (const ticket of ordered) {
    if (ticket.pid === self.pid && ticket.nonce === self.nonce) {
      return (
        !isTicketSkippable(state, ticket, nowMillis, config, true) &&
        activeTokenTotal(state) + ticket.weightTokens <= capacityTokens
      );
    }
    if (!isTicketSkippable(state, ticket, nowMillis, config, false)) {
      return false;
    }
  }
  return false;
};

/**
 * Gate coordinating origin-lock migration and the below-envelope fallback
 * underneath machine-wide admission.
 *
 * `tryAcquire` succeeds with `None` while a prior-version origin owner drains;
 * the contender then stays queued instead of failing. `tryAcquireFallback`
 * acquires the exclusive below-envelope resource. Corruption states keep
 * failing through the error channel.
 *
 * @category admission
 * @since 0.0.0
 */
export interface AdmissionOriginGate<OriginLease, GateError, GateRequirements> {
  readonly release: (lease: OriginLease) => Effect.Effect<void, never, GateRequirements>;
  readonly tryAcquire: Effect.Effect<O.Option<OriginLease>, GateError, GateRequirements>;
  readonly tryAcquireFallback: Effect.Effect<O.Option<OriginLease>, GateError, GateRequirements>;
}

/**
 * Origin gate for admission kinds that take no origin-scoped resource.
 *
 * **Example** (Reference the no-op gate)
 *
 * ```ts
 * import { noAdmissionOriginGate } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof noAdmissionOriginGate.release) // "function"
 * ```
 *
 * @category admission
 * @since 0.0.0
 */
export const noAdmissionOriginGate: AdmissionOriginGate<Record<string, never>, never, never> = {
  tryAcquire: Effect.succeedSome({}),
  tryAcquireFallback: Effect.succeedSome({}),
  release: () => Effect.void,
};

interface AdmittedState<OriginLease> {
  readonly lease: YeetAdmissionLease;
  readonly leasePath: string;
  readonly originLease: OriginLease;
  readonly promotionPath: string;
}

const admissionProgressReport = Effect.fnUntraced(function* (
  request: AdmissionRequest,
  state: LiveAdmissionState,
  capacityTokens: number,
  availableGib: number,
  position: number,
  waitedMillis: number,
  nowMillis: number,
  config: AdmissionConfig
): Effect.fn.Return<void> {
  const owners = A.join(
    A.map(state.leases, ({ lease }) => {
      const suspect =
        nowMillis - lease.heartbeatAtMillis > config.suspectAfterSeconds * 1000 ? " [suspect: heartbeat stale]" : "";
      return `pid ${lease.pid} ${lease.kind}(${lease.weightTokens}) ${lease.checkoutRoot} @ ${lease.branch}${suspect}`;
    }),
    "; "
  );
  const waitedSeconds = Math.round(waitedMillis / 1000);
  yield* Console.log(
    `[yeet] admission: waiting ${waitedSeconds}s for ${request.kind}(${request.weightTokens}) — position ${position}, tokens ${activeTokenTotal(state)}/${capacityTokens}, MemAvailable ${availableGib.toFixed(1)} GiB${Str.isNonEmpty(owners) ? `, holders: ${owners}` : ""}`
  );
});

const admissionEscalation = (waitedMillis: number, alreadyEscalated: number): O.Option<string> =>
  waitedMillis >= 600_000 && alreadyEscalated < 2
    ? O.some(
        "[yeet] admission: waited 10 minutes; inspect holders with `bun run beep quality scheduler status` and reap dead state with `bun run beep quality scheduler reap`"
      )
    : waitedMillis >= 120_000 && alreadyEscalated < 1
      ? O.some(
          "[yeet] admission: waited 2 minutes; heavy work is holding the machine budget (this is backpressure, not a failure)"
        )
      : O.none();

const escalationLevelFor = (waitedMillis: number): number =>
  waitedMillis >= 600_000 ? 2 : waitedMillis >= 120_000 ? 1 : 0;

/**
 * Deterministic scheduler helpers exposed to the source test kit.
 *
 * **Example** (Resolve a two-minute escalation)
 *
 * ```ts
 * import { qualitySchedulerForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(qualitySchedulerForTesting.escalationLevel(120_000)) // 1
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const qualitySchedulerForTesting = {
  escalationLevel: escalationLevelFor,
  parseMeminfoFieldGib,
};

const refreshHeartbeat = Effect.fnUntraced(function* (
  entryPath: string,
  encoded: string
): Effect.fn.Return<void, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  yield* writeFileAtomic(entryPath, `${encoded}\n`);
});

const encodeTicketText = Effect.fnUntraced(function* (
  ticket: YeetAdmissionTicket
): Effect.fn.Return<string, QualitySchedulerError> {
  return yield* encodeTicket(ticket).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission ticket state."))
  );
});

const encodeLeaseText = Effect.fnUntraced(function* (
  lease: YeetAdmissionLease
): Effect.fn.Return<string, QualitySchedulerError> {
  return yield* encodeLease(lease).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission lease state."))
  );
});

// Roll back an admission that overshot capacity because two observers promoted
// in the same tick. The deterministic loser is the lease with the newest
// immutable admission instant (never the heartbeat, which established leases
// refresh continuously); rollback happens before `use` starts, so running
// work is never preempted.
const admissionInstantOrder: Order.Order<YeetAdmissionLease> = pipe(
  Order.mapInput(Order.Number, (lease: YeetAdmissionLease) => lease.admittedAtMillis),
  Order.combine(Order.mapInput(Order.Number, (lease: YeetAdmissionLease) => lease.pid)),
  Order.combine(Order.mapInput(Order.String, (lease: YeetAdmissionLease) => lease.startedAt))
);

const isOvershootLoser = (state: LiveAdmissionState, capacityTokens: number, own: YeetAdmissionLease): boolean => {
  const ordered = A.sort(
    A.map(state.leases, ({ lease }) => lease),
    admissionInstantOrder
  );
  let cumulative = 0;
  for (const lease of ordered) {
    cumulative = cumulative + lease.weightTokens;
    if (lease.pid === own.pid && lease.startedAt === own.startedAt) {
      return cumulative > capacityTokens;
    }
  }
  return false;
};

/**
 * Whether one lease sits outside the capacity-fitting admission prefix.
 *
 * Leases are ordered by their immutable admission instant; every racing
 * contender whose cumulative weight exceeds capacity rolls itself back, so a
 * three-way over-admission cannot leave two excess proofs running.
 *
 * **Example** (Reference the overshoot predicate)
 *
 * ```ts
 * import { isOvershootLoserForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof isOvershootLoserForTesting) // "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const isOvershootLoserForTesting: {
  (capacityTokens: number, own: YeetAdmissionLease): (state: LiveAdmissionState) => boolean;
  (state: LiveAdmissionState, capacityTokens: number, own: YeetAdmissionLease): boolean;
} = dual(3, isOvershootLoser);

interface AdmissionAttempt<OriginLease> {
  readonly admitted: O.Option<AdmittedState<OriginLease>>;
  readonly originBusy: boolean;
  readonly scopeUnavailable: boolean;
}

const tryAdmitSelf = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig
): Effect.fn.Return<
  AdmissionAttempt<OriginLease>,
  QualitySchedulerError | GateError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | GateRequirements
  | Digest.Digest
> {
  const originLease = yield* gate.tryAcquire;
  if (O.isNone(originLease)) {
    return { admitted: O.none(), originBusy: true, scopeUnavailable: false };
  }
  // From here the origin lease is owned: any failure before ownership hands
  // over to the admitted-state finalizer must release it (both review bots
  // flagged the leak on encode/stage/link failures); the overshoot rollback
  // success path releases it explicitly below.
  const selfLease = yield* stageSelfLease(directories, request, ticket, config).pipe(
    Effect.onError(() => gate.release(originLease.value).pipe(Effect.ignore))
  );
  if (O.isNone(selfLease[0])) {
    yield* gate.release(originLease.value);
    return { admitted: O.none(), originBusy: false, scopeUnavailable: selfLease[1] };
  }
  return {
    admitted: O.some({
      leasePath: selfLease[0].value.leasePath,
      lease: selfLease[0].value.lease,
      originLease: originLease.value,
      promotionPath: selfLease[0].value.promotionPath,
    }),
    originBusy: false,
    scopeUnavailable: selfLease[1],
  };
});

const stageSelfLease = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  config: AdmissionConfig
): Effect.fn.Return<
  readonly [
    O.Option<{ readonly lease: YeetAdmissionLease; readonly leasePath: string; readonly promotionPath: string }>,
    boolean,
  ],
  QualitySchedulerError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const lease = YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: ticket.pid,
    procStart: ticket.procStart,
    kind: ticket.kind,
    weightTokens: ticket.weightTokens,
    priority: ticket.priority,
    originKey: ticket.originKey,
    checkoutRoot: ticket.checkoutRoot,
    branch: ticket.branch,
    coordinationProtocol: ticket.coordinationProtocol,
    command: request.command,
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    admittedAtMillis: nowMillis,
    heartbeatAtMillis: nowMillis,
    enqueuedAtMillis: ticket.enqueuedAtMillis,
    nonce: ticket.nonce,
    attemptId: ticket.attemptId,
    resolvedHeadSha: ticket.resolvedHeadSha,
    diffFingerprint: ticket.diffFingerprint,
    proofTier: ticket.proofTier,
    envProfile: ticket.envProfile,
    computeProfile: ticket.computeProfile,
    stage: ticket.stage,
    forceLocal: ticket.forceLocal,
    unit: ticket.unit,
    weightSource: ticket.weightSource,
    owner: ticket.owner,
  });
  const leasePath = path.join(directories.leases, `${ticket.nonce}-${ticket.pid}.lease.json`);
  const promotionPath = promotionTransitionPath(path, directories, ticket.nonce);
  const prepared = AdmissionPromotionTransition.make({
    schemaVersion: "yeet-admission-promotion/v1",
    nonce: ticket.nonce,
    ticketPath: path.join(directories.queue, `${ticket.nonce}-${ticket.pid}.ticket.json`),
    leasePath,
    ticket,
    lease,
    phase: "prepared",
    createdAtMillis: nowMillis,
  });
  const transitionCreated = yield* tryCreateExclusive(
    promotionPath,
    `${yield* encodePromotionTransition(prepared).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to encode admission promotion ${promotionPath}.`))
    )}\n`
  );
  if (!transitionCreated) {
    return yield* QualitySchedulerError.make({
      message: `Admission promotion ${promotionPath} already exists for this ticket; recover it before retrying.`,
    });
  }
  const created = yield* tryCreateExclusive(leasePath, `${yield* encodeLeaseText(lease)}\n`);
  if (!created) {
    return yield* QualitySchedulerError.make({
      message: `Admission lease ${leasePath} already exists for this ticket; remove it and retry.`,
    });
  }
  const scopedLease = YeetAdmissionLease.make({
    ...lease,
    runScope: yield* enterRunScope(ticket.nonce, directories.root),
  });
  const scopeUnavailable = !RunScopeSupport.is.active(scopedLease.runScope?.support ?? "failed");
  const rescanned = yield* scanAdmissionState(directories, false);
  const stats = yield* MemoryStats;
  const availableGib7 = yield* stats.availableGib;
  const capacityNow = admissionCapacityTokensFor(availableGib7, config);
  const prefix = A.filter(
    A.map(rescanned.leases, ({ lease }) => lease),
    (candidate) => admissionInstantOrder(candidate, lease) < 0
  );
  const scopedCapacity =
    stats.reservationCapacity === undefined ? capacityNow : yield* stats.reservationCapacity(prefix, config);
  if (A.reduce(prefix, lease.weightTokens, (total, candidate) => total + candidate.weightTokens) > scopedCapacity) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(leasePath, { force: true }).pipe(Effect.ignore);
    yield* fs.remove(promotionPath, { force: true }).pipe(Effect.ignore);
    return [O.none(), scopeUnavailable];
  }
  const encodedLeaseText = yield* encodeLeaseText(scopedLease);
  yield* refreshHeartbeat(leasePath, encodedLeaseText);
  yield* persistPromotionTransition(
    promotionPath,
    AdmissionPromotionTransition.make({ ...prepared, lease: scopedLease, phase: "lease-published" })
  );
  return [O.some({ lease: scopedLease, leasePath, promotionPath }), scopeUnavailable];
});

const heartbeatLoop = Effect.fnUntraced(function* (
  leasePath: string,
  lease: YeetAdmissionLease,
  config: AdmissionConfig
): Effect.fn.Return<never, QualitySchedulerError, SecureRandom.SecureRandom | FileSystem.FileSystem | Digest.Digest> {
  let current = lease;
  while (true) {
    yield* Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000));
    const nowMillis = yield* Clock.currentTimeMillis;
    current = YeetAdmissionLease.make({ ...current, heartbeatAtMillis: nowMillis });
    const encodedLeaseText8 = yield* encodeLeaseText(current);
    yield* refreshHeartbeat(leasePath, encodedLeaseText8);
  }
});

// One promotion attempt: admit self when first in the shared order and the
// weight fits live capacity; the ticket is removed only after admission.
interface PromotionTickInfo {
  readonly availableGib: number;
  readonly capacityTokens: number;
  readonly nowMillis: number;
  readonly state: LiveAdmissionState;
}

interface PromotionTick<OriginLease> {
  readonly admitted: O.Option<AdmittedState<OriginLease>>;
  readonly info: PromotionTickInfo;
  readonly originBusy: boolean;
  readonly scopeUnavailable: boolean;
}

const tryPromoteTicket = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig,
  destination: O.Option<string>
): Effect.fn.Return<
  PromotionTick<OriginLease>,
  QualitySchedulerError | GateError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | GateRequirements
  | Digest.Digest
> {
  // Rank contenders at the start of the attempt. Recovery may perform durable
  // journal I/O, but that housekeeping must not age a ticket across a priority
  // boundary before this selection pass compares the queue.
  const nowMillis = yield* Clock.currentTimeMillis;
  const state = yield* scanAdmissionState(directories, true);
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  const capacityTokens =
    stats.reservationCapacity === undefined
      ? admissionCapacityTokensFor(availableGib, config)
      : yield* stats.reservationCapacity(
          A.map(state.leases, ({ lease }) => lease),
          config,
          destination
        );
  const info: PromotionTickInfo = { availableGib, capacityTokens, nowMillis, state };
  if (!selfMayAttempt(state, capacityTokens, nowMillis, config, ticket)) {
    return { admitted: O.none(), info, originBusy: hasLegacySameOriginOwner(state, ticket), scopeUnavailable: false };
  }
  const attempt = yield* tryAdmitSelf(directories, request, ticket, gate, config);
  if (O.isNone(attempt.admitted)) {
    return { admitted: O.none(), info, originBusy: attempt.originBusy, scopeUnavailable: attempt.scopeUnavailable };
  }
  const admitted = attempt.admitted.value;
  yield* processPromotionTransition(directories, admitted.promotionPath, ticket.nonce).pipe(
    Effect.onError(() => gate.release(admitted.originLease).pipe(Effect.ignore))
  );
  return { admitted: attempt.admitted, info, originBusy: false, scopeUnavailable: attempt.scopeUnavailable };
});

interface AdmissionWaitProgress {
  readonly escalated: number;
  readonly lastProgressMillis: number;
}

const noteAdmissionWait = Effect.fnUntraced(function* (
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  startMillis: number,
  progress: AdmissionWaitProgress,
  config: AdmissionConfig,
  info: PromotionTickInfo
): Effect.fn.Return<AdmissionWaitProgress, never> {
  const waitedMillis = info.nowMillis - startMillis;
  let next = progress;
  if (info.nowMillis - progress.lastProgressMillis >= config.progressSeconds * 1000) {
    const ordered = A.sort(
      A.map(info.state.tickets, ({ ticket: queued }) => queued),
      ticketOrder(info.nowMillis, config)
    );
    const position =
      1 +
      O.getOrElse(
        A.findFirstIndex(ordered, (queued) => queued.nonce === ticket.nonce),
        () => 0
      );
    yield* admissionProgressReport(
      request,
      info.state,
      info.capacityTokens,
      info.availableGib,
      position,
      waitedMillis,
      info.nowMillis,
      config
    );
    next = { ...next, lastProgressMillis: info.nowMillis };
  }
  const escalation = admissionEscalation(waitedMillis, next.escalated);
  yield* O.match(escalation, {
    onNone: () => Effect.void,
    onSome: (message) => Console.log(message),
  });
  return O.isSome(escalation) ? { ...next, escalated: escalationLevelFor(waitedMillis) } : next;
});

/**
 * Exposes one admission wait-progress step for deterministic scheduler tests.
 *
 * **Example** (Reference the wait-progress test seam)
 *
 * ```ts import.meta.vitest name="Reference the wait-progress test seam"
 * import { noteAdmissionWaitForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * typeof noteAdmissionWaitForTesting // => "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const noteAdmissionWaitForTesting = noteAdmissionWait;

// Interruption is masked around promotion (so a scheduler lease and any
// fallback origin lease can never be created without their release installed)
// and restored across the sleep, which is where a Ctrl-C lands and unwinds to
// the ticket finalizer.
const waitForAdmission = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticketPath: string,
  initialTicket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig,
  restore: <RestoredA, RestoredE, RestoredR>(
    effect: Effect.Effect<RestoredA, RestoredE, RestoredR>
  ) => Effect.Effect<RestoredA, RestoredE, RestoredR>
): Effect.fn.Return<
  AdmittedState<OriginLease>,
  QualitySchedulerError | GateError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | GateRequirements
  | Digest.Digest
> {
  let destination = yield* readPlannedRunScopeCgroup;
  const startMillis = yield* Clock.currentTimeMillis;
  let ticket = initialTicket;
  // Back-dated so the first loop iteration prints the queue position immediately.
  let progress: AdmissionWaitProgress = {
    lastProgressMillis: startMillis - config.progressSeconds * 1000,
    escalated: 0,
  };
  while (true) {
    const tick = yield* tryPromoteTicket(directories, request, ticket, gate, config, destination);
    if (tick.scopeUnavailable) destination = O.none();
    if (O.isSome(tick.admitted)) {
      return tick.admitted.value;
    }
    progress = yield* noteAdmissionWait(request, ticket, startMillis, progress, config, tick.info);
    yield* restore(Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000)));
    const refreshedMillis = yield* Clock.currentTimeMillis;
    ticket = YeetAdmissionTicket.make({
      ...ticket,
      heartbeatAtMillis: refreshedMillis,
      blockedOnOriginAtMillis: tick.originBusy ? refreshedMillis : ticket.blockedOnOriginAtMillis,
    });
    const encodedTicketText = yield* encodeTicketText(ticket);
    yield* refreshHeartbeat(ticketPath, encodedTicketText);
  }
});

const matchActiveRunScope = <Success, Requirements>(
  lease: YeetAdmissionLease,
  options: {
    readonly onNone: () => Effect.Effect<Success, never, Requirements>;
    readonly onSome: (scope: RunScopeRecord) => Effect.Effect<Success, never, Requirements>;
  }
): Effect.Effect<Success, never, Requirements> =>
  pipe(
    O.fromUndefinedOr(lease.runScope),
    O.filter((scope) => RunScopeSupport.is.active(scope.support)),
    O.match(options)
  );

const readLeaseRunScopeTelemetry = (
  lease: YeetAdmissionLease
): Effect.Effect<RunScopeTelemetry, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> =>
  matchActiveRunScope(lease, {
    onNone: () => Effect.succeed(RunScopeTelemetry.make({})),
    onSome: (scope) => readRunScopeTelemetry(scope.unitName),
  });

const runAdmitted = Effect.fnUntraced(function* <Success, UseError, UseRequirements, OriginLease, GateRequirements>(
  directories: AdmissionDirectories,
  admitted: AdmittedState<OriginLease>,
  releaseOrigin: (lease: OriginLease) => Effect.Effect<void, never, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config: AdmissionConfig,
  restore: <RestoredA, RestoredE, RestoredR>(
    effect: Effect.Effect<RestoredA, RestoredE, RestoredR>
  ) => Effect.Effect<RestoredA, RestoredE, RestoredR>
): Effect.fn.Return<
  Success,
  UseError | QualitySchedulerError,
  | UseRequirements
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | GateRequirements
  | Digest.Digest
> {
  return yield* Effect.acquireUseRelease(
    Effect.forkChild(heartbeatLoop(admitted.leasePath, admitted.lease, config)),
    () => restore(use),
    Effect.fnUntraced(function* (heartbeat) {
      yield* Fiber.interrupt(heartbeat);
      yield* processPromotionTransition(directories, admitted.promotionPath, admitted.lease.nonce).pipe(
        Effect.catch(warnAdmissionJournalError)
      );
      const releasedAtMillis = yield* Clock.currentTimeMillis;
      const telemetry = yield* readLeaseRunScopeTelemetry(admitted.lease);
      yield* appendAdmissionJournalEvent(
        directories.root,
        AdmissionJournalReleasedV3.make({
          schemaVersion: "yeet-admission-journal/v3",
          _tag: "admission-released",
          nonce: admitted.lease.nonce,
          pid: admitted.lease.pid,
          releasedAtMillis,
          attemptId: admitted.lease.attemptId,
          checkoutRoot: admitted.lease.checkoutRoot,
          branch: admitted.lease.branch,
          unit: admitted.lease.unit,
          weightSource: admitted.lease.weightSource,
          owner: admitted.lease.owner,
          ...OptionUtils.getSomesStruct({
            memoryPeakBytes: O.fromUndefinedOr(telemetry.memoryPeakBytes),
          }),
        })
      ).pipe(Effect.catch(warnAdmissionJournalError));
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(admitted.leasePath, { force: true }).pipe(Effect.ignore);
      yield* releaseOrigin(admitted.originLease);
    })
  );
});

const finalizeAdmissionTicket = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  ticketPath: string,
  ticket: YeetAdmissionTicket
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // A promotion may have published its lease before failing to remove the
  // ticket. That durable grant belongs to promotion/reap recovery, not withdrawal.
  const leaseExists = yield* fs
    .exists(path.join(directories.leases, `${ticket.nonce}-${ticket.pid}.lease.json`))
    .pipe(Effect.orElseSucceed(constant(true)));
  // A completed promotion already removed the ticket. Only acknowledge a
  // withdrawal when this finalizer actually removes a still-queued request.
  const removed = yield* fs.remove(ticketPath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
  if (!removed || leaseExists) {
    return;
  }
  yield* appendAdmissionJournalEvent(
    directories.root,
    AdmissionJournalWithdrawn.make({
      ...ticket,
      schemaVersion: "yeet-admission-journal/v3",
      _tag: "admission-withdrawn",
      withdrawnAtMillis: yield* Clock.currentTimeMillis,
    })
  ).pipe(Effect.catch(warnAdmissionJournalError));
});

// On a worker host a hosted-only gate is refused unless the caller forced a
// local run or the request carries the hosted posture (hosted runners are
// posture `hosted`, never refused, D5). Pure, so the admission entry stays flat.
const workerProfileRefusal = (
  request: AdmissionRequest,
  ceilingGib: number,
  envelopeGib: number
): O.Option<ComputeProfileRefusal> => {
  const hostedPosture = O.exists(request.envProfile, (profile) => profile === "hosted");
  if (request.forceLocal || hostedPosture) return O.none();
  return O.filter(request.gateRoute, (gate) => gateRouteFor(gate, "worker") === "hosted-only").pipe(
    O.map((gate) =>
      ComputeProfileRefusal.make({
        gate,
        ceilingGib,
        envelopeGib,
        message: `[yeet] admission: ${gate} is hosted-only on compute-profile=worker (ceiling ${Num.round(ceilingGib, 1)} GiB < envelope ${envelopeGib} GiB). Push first and let hosted CI prove it: bun run beep yeet open --body-file <md>. Pass --force-local to run it here anyway.`,
      })
    )
  );
};

// The admission-unit fields a new ticket carries (SCHE-08). They are recorded
// only while the protocol's units gate is on; with it off every ticket, lease
// and journal row keeps the pre-unit bytes. The lease and rows copy the ticket.
const admissionUnitFieldsFor = (units: AdmissionUnitEmission, request: AdmissionRequest, owner: AdmissionOwner) =>
  AdmissionUnitEmission.match(units, {
    off: () => ({ unit: O.none(), weightSource: O.none(), owner: O.none() }),
    on: () => ({ unit: O.some(request.unit), weightSource: O.some(request.weightSource), owner: O.some(owner) }),
  });

const workerBypassLine = (request: AdmissionRequest): string =>
  `[yeet] admission: compute-profile=worker${request.forceLocal ? " force-local=true" : ""}; coordinating ${request.kind} through the origin gate only`;

/**
 * Append one worker routing decision to the admission journal, best effort.
 *
 * **Details**
 *
 * A `worker` host never enqueues a ticket, so without this row its runs leave
 * no admission fact. The row ({@link AdmissionJournalRouted}) goes through the
 * same locked rewrite as every transition, so it trims to the archive and
 * folds into the history like the others. A journal that cannot be written is
 * a warning: the decision, the run and its exit never depend on it, and the
 * caller never waits on a queue.
 *
 * **Example** (Record a refused check)
 *
 * ```ts
 * import { AdmissionRoute, recordAdmissionRoute } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const route = AdmissionRoute.make({
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet final-check",
 *   computeProfile: "worker",
 *   gateRoute: O.some("check"),
 *   outcome: "refusal"
 * })
 * console.log(Effect.isEffect(recordAdmissionRoute(route))) // true
 * ```
 *
 * @param route - The routing decision to record.
 * @returns An effect that appends the row or warns that it could not.
 * @category admission
 * @since 0.0.0
 */
export const recordAdmissionRoute = Effect.fn("QualityScheduler.recordAdmissionRoute")(function* (
  route: AdmissionRoute
): Effect.fn.Return<void, never, SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const path = yield* Path.Path;
  const runtimeRoot = yield* perUserRuntimeRoot();
  const procStart = yield* processStartIdentityForPid(process.pid);
  const nonce = yield* SecureRandom.SecureRandom.use((crypto) => crypto.uuidV4());
  const routedAtMillis = yield* Clock.currentTimeMillis;
  const event = AdmissionJournalRouted.make({
    ...route,
    schemaVersion: "yeet-admission-journal/v3",
    _tag: "admission-routed",
    nonce,
    pid: process.pid,
    procStart: O.getOrElse(procStart, constant("")),
    routedAtMillis,
  });
  yield* appendAdmissionJournalEvent(admissionRootFor(path, runtimeRoot), event).pipe(
    Effect.catch(warnAdmissionJournalError)
  );
});

const recordWorkerRequestRoute = (request: AdmissionRequest, outcome: AdmissionRoute["outcome"]) =>
  recordAdmissionRoute(
    AdmissionRoute.make({
      checkoutRoot: request.checkoutRoot,
      branch: request.branch,
      command: request.command,
      attemptId: request.attemptId,
      envProfile: request.envProfile,
      computeProfile: "worker",
      forceLocal: request.forceLocal,
      gateRoute: request.gateRoute,
      outcome,
    })
  );

/**
 * Run one unit of heavy repository work under machine-wide weighted admission.
 *
 * Enqueues a durable ticket, waits (with visible progress) until the request
 * is first in priority/FIFO order and its token weight fits live capacity,
 * acquires the caller's migration gate, then runs `use` while heartbeating the
 * lease. Ticket, lease, and any fallback origin lease are all released on
 * success, failure, and interruption — `Ctrl-C` removes the ticket.
 *
 * **Example** (Reference the admission bracket)
 *
 * ```ts
 * import { withQualityAdmission } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof withQualityAdmission) // "function"
 * ```
 *
 * @param request - Kind, weight, priority, and provenance of the work.
 * @param gate - Migration observation used by normal admission and exclusive fallback acquisition
 * used only below the scheduler memory envelope.
 * @param use - The admitted work.
 * @param config - Optional policy override; defaults to chartered D1 values.
 * @returns The result of `use`, guarded by ticket/lease/gate lifecycles.
 * @category admission
 * @since 0.0.0
 */
export const withQualityAdmission = Effect.fn("QualityScheduler.withQualityAdmission")(function* <
  Success,
  UseError,
  UseRequirements,
  OriginLease,
  GateError,
  GateRequirements,
>(
  request: AdmissionRequest,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config?: AdmissionConfig
): Effect.fn.Return<
  Success,
  UseError | GateError | QualitySchedulerError,
  | UseRequirements
  | GateRequirements
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const resolved = config ?? AdmissionConfig.make({});
  const path = yield* Path.Path;
  const stats = yield* MemoryStats;
  // Machines whose memory ceiling can never reach the requested weight must
  // not wait forever: clamp the weight to the machine ceiling, or fall back to
  // origin-gate-only coordination (the pre-scheduler behavior) when even one
  // token can never be admitted. A cgroup ceiling below MemTotal (a 7 GiB
  // slice on a 15 GiB host) is what the work can actually use.
  const totalGib = yield* stats.totalGib;
  const ceilingGib = yield* stats.ceilingGib;
  const schedulableGib = Math.min(totalGib, ceilingGib);
  const machineCeiling = admissionCapacityTokensFor(
    schedulableGib,
    AdmissionConfig.make({ ...resolved, hardFloorGib: 0 })
  );
  // A host must be able to hold the hard floor PLUS one slot of available
  // memory; kernel and resident overhead keep MemAvailable well below the
  // installed total, so a total near the floor can never admit anything.
  const envelopeGib = computeEnvelopeGib(resolved);
  const floorAttainable = schedulableGib >= envelopeGib;
  // The profile is derived from the same ceiling MemoryStats reports, so the
  // refusal and the capacity view can never disagree.
  const computeProfile = yield* resolveComputeProfileForCeiling(O.some(schedulableGib), envelopeGib).pipe(
    Effect.mapError((cause) => QualitySchedulerError.make({ message: cause.message, cause }))
  );
  if (computeProfile.profile === "worker") {
    const refusal = workerProfileRefusal(
      request,
      O.getOrElse(computeProfile.ceilingGib, () => schedulableGib),
      envelopeGib
    );
    if (O.isSome(refusal)) {
      yield* recordWorkerRequestRoute(request, "refusal");
      return yield* QualitySchedulerError.make({
        message: refusal.value.message,
        reason: "compute-profile-refusal",
        refusal: refusal.value,
      });
    }
    yield* Console.log(workerBypassLine(request));
    yield* recordWorkerRequestRoute(request, "bypass");
    return yield* bypassAdmission(gate, use, resolved);
  }
  // Defensive fallback: a workstation profile below the envelope is impossible
  // unless the probe and MemoryStats disagree; keep the pre-profile bypass.
  if (machineCeiling <= 0 || !floorAttainable) {
    yield* Console.log(
      `[yeet] admission: installed memory is below the scheduling envelope; coordinating ${request.kind} through the origin gate only`
    );
    return yield* bypassAdmission(gate, use, resolved);
  }
  const weightTokens = Math.min(request.weightTokens, machineCeiling);
  if (weightTokens < request.weightTokens) {
    yield* Console.log(
      `[yeet] admission: clamping ${request.kind} weight ${request.weightTokens} -> ${weightTokens} (machine ceiling)`
    );
  }
  const admittedRequest = AdmissionRequest.make({ ...request, weightTokens });
  const directories = yield* ensureAdmissionDirectories();
  const nowMillis = yield* Clock.currentTimeMillis;
  const processStartIdentityForPid9 = yield* processStartIdentityForPid(process.pid);
  const procStart = O.getOrElse(processStartIdentityForPid9, () => "");
  const nonce = yield* SecureRandom.SecureRandom.use((crypto) => crypto.uuidV4());
  const protocol = yield* readAdmissionProtocol(directories.root);
  const owner = AdmissionOwner.make({
    proofNonce: nonce,
    pid: process.pid,
    procStart,
    attemptId: admittedRequest.attemptId,
    originKey: admittedRequest.originKey,
    checkoutRoot: admittedRequest.checkoutRoot,
    branch: admittedRequest.branch,
    command: admittedRequest.command,
  });
  const ticket = YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: process.pid,
    procStart,
    kind: admittedRequest.kind,
    weightTokens: admittedRequest.weightTokens,
    priority: admittedRequest.priority,
    originKey: admittedRequest.originKey,
    checkoutRoot: admittedRequest.checkoutRoot,
    branch: admittedRequest.branch,
    coordinationProtocol: AdmissionCoordinationProtocol.Enum["scheduler-origin-concurrency/v1"],
    enqueuedAtMillis: nowMillis,
    heartbeatAtMillis: nowMillis,
    nonce,
    attemptId: admittedRequest.attemptId,
    resolvedHeadSha: admittedRequest.resolvedHeadSha,
    diffFingerprint: admittedRequest.diffFingerprint,
    proofTier: admittedRequest.proofTier,
    envProfile: admittedRequest.envProfile,
    computeProfile: O.some(computeProfile.profile),
    stage: admittedRequest.stage,
    forceLocal: admittedRequest.forceLocal,
    ...admissionUnitFieldsFor(protocol.units, admittedRequest, owner),
  });
  const ticketPath = path.join(directories.queue, `${ticket.nonce}-${ticket.pid}.ticket.json`);
  return yield* Effect.uninterruptibleMask((restore) =>
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const created = yield* tryCreateExclusive(ticketPath, `${yield* encodeTicketText(ticket)}\n`);
        if (!created) {
          return yield* QualitySchedulerError.make({
            message: `Admission ticket ${ticketPath} already exists; remove it and retry.`,
          });
        }
        yield* appendAdmissionJournalEvent(
          directories.root,
          AdmissionJournalEnqueued.make({
            ...ticket,
            schemaVersion: "yeet-admission-journal/v3",
            _tag: "admission-enqueued",
          })
        ).pipe(Effect.catch(warnAdmissionJournalError));
        return ticket;
      }),
      Effect.fnUntraced(function* (enqueued) {
        const admitted = yield* waitForAdmission(
          directories,
          admittedRequest,
          ticketPath,
          enqueued,
          gate,
          resolved,
          restore
        );
        return yield* runAdmitted(directories, admitted, gate.release, use, resolved, restore);
      }),
      (enqueued) => finalizeAdmissionTicket(directories, ticketPath, enqueued)
    )
  );
});

// Origin-gate-only fallback for machines below the scheduling envelope:
// poll the gate until it grants, then run with a guaranteed release.
const bypassAdmission = Effect.fnUntraced(function* <
  Success,
  UseError,
  UseRequirements,
  OriginLease,
  GateError,
  GateRequirements,
>(
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config: AdmissionConfig
): Effect.fn.Return<Success, UseError | GateError | QualitySchedulerError, UseRequirements | GateRequirements> {
  return yield* Effect.uninterruptibleMask(
    Effect.fnUntraced(function* (restore) {
      let origin = yield* gate.tryAcquireFallback;
      while (O.isNone(origin)) {
        yield* restore(Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000)));
        origin = yield* gate.tryAcquireFallback;
      }
      return yield* Effect.acquireUseRelease(
        Effect.succeed(origin.value),
        () => restore(use),
        (lease) => gate.release(lease)
      );
    })
  );
});

/**
 * Read the current machine-wide admission state without mutating it.
 *
 * **Example** (Reference the status reader)
 *
 * ```ts
 * import { admissionStatus } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionStatus) // "function"
 * ```
 *
 * @param config - Optional policy override; defaults to chartered D1 values.
 * @returns A point-in-time capacity/lease/queue snapshot.
 * @category admission
 * @since 0.0.0
 */
export const admissionStatus = Effect.fn("QualityScheduler.admissionStatus")(function* (
  config?: AdmissionConfig
): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const resolved = config ?? AdmissionConfig.make({});
  const directories = yield* ensureAdmissionDirectories();
  return yield* snapshotAdmissionState(directories, resolved, false);
});

const enrichLeaseRunScopeTelemetry = (
  lease: YeetAdmissionLease
): Effect.Effect<YeetAdmissionLease, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> =>
  matchActiveRunScope(lease, {
    onNone: () => Effect.succeed(lease),
    onSome: (scope) =>
      readRunScopeTelemetry(scope.unitName).pipe(
        Effect.map((telemetry) =>
          YeetAdmissionLease.make({
            ...lease,
            runScope: RunScopeRecord.make({
              ...scope,
              ...OptionUtils.getSomesStruct({
                memoryPeakBytes: O.fromUndefinedOr(telemetry.memoryPeakBytes),
                tasksCurrent: O.fromUndefinedOr(telemetry.tasksCurrent),
              }),
            }),
          })
        )
      ),
  });

const snapshotAdmissionState = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  config: AdmissionConfig,
  repair: boolean,
  retainedDeadLeasePaths: ReadonlyArray<string> = A.empty()
): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const state = yield* scanAdmissionState(directories, repair, retainedDeadLeasePaths);
  const leases = yield* Effect.forEach(state.leases, ({ lease }) => enrichLeaseRunScopeTelemetry(lease), {
    concurrency: 4,
  });
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  // Files already moved into quarantine stay on the operator's inspection
  // surface until they are removed by hand.
  const persistedQuarantine = yield* fs
    .readDirectory(directories.quarantine)
    .pipe(Effect.map(A.map((name) => path.join(directories.quarantine, name))), Effect.orElseSucceed(A.empty<string>));
  const capacityTokens =
    stats.reservationCapacity === undefined
      ? admissionCapacityTokensFor(availableGib, config)
      : yield* stats.reservationCapacity(
          A.map(state.leases, ({ lease }) => lease),
          config
        );
  return AdmissionSnapshot.make({
    capacityTokens,
    activeTokens: activeTokenTotal(state),
    memAvailableGib: availableGib,
    hardFloorEngaged: availableGib < config.hardFloorGib,
    leases,
    tickets: A.map(state.tickets, ({ ticket }) => ticket),
    dead: state.dead,
    quarantined: A.appendAll(state.quarantined, persistedQuarantine),
  });
});

const runScopeUnitNamesForLease = (lease: YeetAdmissionLease): ReadonlyArray<string> =>
  A.dedupe(
    A.appendAll(
      Str.isNonEmpty(lease.nonce) ? [runScopeUnitName(lease.nonce)] : A.empty<string>(),
      pipe(O.fromUndefinedOr(lease.runScope), O.match({ onNone: A.empty<string>, onSome: (scope) => [scope.unitName] }))
    )
  );

const isRetainedDeadLeaseScopePlan = DeadLeaseScopePlan.guards.retain;
const isStoppedDeadLeaseScopePlan = DeadLeaseScopePlan.guards.stop;

const deadLeaseScopePlan = (
  liveUnitNames: ReadonlyArray<string>,
  { lease, path }: LiveAdmissionState["deadLeases"][number]
): DeadLeaseScopePlan => {
  const recorded = O.fromUndefinedOr(lease.runScope);
  const unitName = pipe(
    recorded,
    O.map((scope) => scope.unitName),
    O.filter(isProofJobUnitName),
    O.getOrElse(() => runScopeUnitName(lease.nonce))
  );
  if (Str.isEmpty(lease.nonce) && !isProofJobUnitName(unitName)) {
    return O.isSome(recorded)
      ? { _tag: "retain", leasePath: path, reason: "legacy-nonce-missing" }
      : { _tag: "reap", leasePath: path };
  }
  if (O.exists(recorded, (scope) => !Str.Equivalence(scope.unitName, unitName))) {
    return { _tag: "retain", leasePath: path, reason: "recorded-unit-mismatch" };
  }
  if (A.contains(liveUnitNames, unitName)) {
    return { _tag: "retain", leasePath: path, reason: "live-unit-conflict" };
  }
  return O.exists(
    recorded,
    (scope) =>
      !isProofJobUnitName(scope.unitName) &&
      (RunScopeSupport.is.disabled(scope.support) || RunScopeSupport.is.unsupported(scope.support))
  )
    ? { _tag: "reap", leasePath: path }
    : { _tag: "stop", leasePath: path, unitName };
};

const stopLeakedRunScopes = Effect.fnUntraced(function* (
  state: LiveAdmissionState
): Effect.fn.Return<ReadonlyArray<string>, never, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  // Only a dead lease is coordinated proof that its scope is no longer live.
  // A loaded unit absent from this scan may belong to an admission racing with
  // the reaper, so absence is never authority to stop it.
  const liveUnitNames = A.dedupe(A.flatMap(state.leases, ({ lease }) => runScopeUnitNamesForLease(lease)));
  const plans = A.map(state.deadLeases, (lease) => deadLeaseScopePlan(liveUnitNames, lease));
  const retained = A.filter(plans, isRetainedDeadLeaseScopePlan);
  yield* Effect.forEach(
    retained,
    (plan) =>
      Console.error(`[yeet] retaining dead admission lease ${plan.leasePath}: run-scope authority ${plan.reason}.`),
    { discard: true }
  );
  const stopGroups = pipe(
    A.filter(plans, isStoppedDeadLeaseScopePlan),
    A.groupBy((plan) => plan.unitName),
    R.values
  );
  const outcomes = yield* Effect.forEach(
    stopGroups,
    Effect.fnUntraced(function* (group) {
      const first = A.head(group);
      if (O.isNone(first)) {
        return A.empty<string>();
      }
      const outcome = yield* stopRunScopeForReap(first.value.unitName);
      if (RunScopeStopOutcome.is.stopped(outcome) || RunScopeStopOutcome.is.absent(outcome)) {
        return A.empty<string>();
      }
      yield* Console.error(
        `[yeet] retaining ${A.length(group)} dead admission lease(s): ${first.value.unitName} stop ${outcome}.`
      );
      return A.map(group, (plan) => plan.leasePath);
    }),
    { concurrency: 4 }
  );
  return A.appendAll(
    A.map(retained, (plan) => plan.leasePath),
    A.flatten(outcomes)
  );
});
/**
 * Reap dead admission state (dead pid or `/proc` start-time mismatch).
 *
 * Dry-run by default: reports what would be removed without touching state.
 *
 * **Example** (Reference the reaper)
 *
 * ```ts
 * import { reapAdmissionState } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof reapAdmissionState) // "function"
 * ```
 *
 * @param options - Pass `apply: true` to actually remove dead state.
 * @returns The post-scan snapshot (after removal when applied).
 * @category admission
 * @since 0.0.0
 */
export const reapAdmissionState = Effect.fn("QualityScheduler.reapAdmissionState")(function* (options: {
  readonly apply: boolean;
}): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  | SecureRandom.SecureRandom
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const directories = yield* ensureAdmissionDirectories();
  const retainedDeadLeasePaths = options.apply
    ? yield* yield* Effect.map(scanAdmissionState(directories, false), stopLeakedRunScopes)
    : A.empty<string>();
  return yield* snapshotAdmissionState(directories, AdmissionConfig.make({}), options.apply, retainedDeadLeasePaths);
});
