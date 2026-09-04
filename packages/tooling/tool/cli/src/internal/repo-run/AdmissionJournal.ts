/**
 * Machine-wide best-effort admission-transition journal at
 * `<admission root>/journal.ndjson`.
 *
 * Every write serializes under `<admission root>/journal.lock`: the writer
 * reads the journal, preserves undecodable records byte-for-byte, appends its event, ring-trims
 * to the newest admitted transitions, and publishes the result with an atomic
 * temp-file rename. Scheduler correctness lives exclusively in ticket and
 * lease files; `bypassAdmission` on sub-envelope machines mints neither file
 * and journals no transition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash, randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Clock, Duration, Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant, dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { publishJournalTextAtomically } from "./JournalFile.ts";
import { AdmissionPriority, AdmissionWorkKind, QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $RepoCliId.create("internal/repo-run/AdmissionJournal");
const JOURNAL_FILE_NAME = "journal.ndjson";
const PROTOCOL_FILE_NAME = "protocol.json";
const LOCK_FILE_NAME = "journal.lock";
const RETAINED_ADMISSIONS = 200;
const LOCK_RETRY_ATTEMPTS = 8;
const LOCK_RETRY_DELAY_MILLIS = 25;
// No legitimate writer publishes an unparseable token. The age backstop
// therefore applies only to malformed generations, never a parseable live
// owner whose lock could still be released concurrently.
const LOCK_REUSE_BACKSTOP_MILLIS = 300_000;

/**
 * Whether v2 eviction events may be emitted into the shared admission journal.
 *
 * **Example** (Recognize the rollout-safe default)
 *
 * ```ts
 * import { AdmissionEvictionEmission } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionEvictionEmission.is.off("off")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionEvictionEmission = LiteralKit(["off", "on"]).pipe(
  $I.annoteSchema("AdmissionEvictionEmission", {
    description: "Whether current scheduler writers may emit v2 admission eviction events.",
  })
);

/**
 * Whether current scheduler writers may emit v2 admission eviction events.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionEvictionEmission = typeof AdmissionEvictionEmission.Type;

/**
 * Versioned mixed-checkout protocol marker stored in the admission root.
 *
 * **Example** (Construct the disabled protocol)
 *
 * ```ts
 * import { AdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * const protocol = AdmissionProtocol.make({
 *   schemaVersion: "yeet-admission-protocol/v1",
 *   eviction: "off",
 * })
 * console.log(protocol.eviction) // "off"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionProtocol extends S.Class<AdmissionProtocol>($I`AdmissionProtocol`)(
  {
    schemaVersion: S.Literal("yeet-admission-protocol/v1"),
    eviction: AdmissionEvictionEmission,
  },
  $I.annote("AdmissionProtocol", {
    description: "Versioned rollout marker controlling admission-journal eviction event emission.",
  })
) {}

const disabledAdmissionProtocol = AdmissionProtocol.make({
  schemaVersion: "yeet-admission-protocol/v1",
  eviction: AdmissionEvictionEmission.Enum.off,
});
const decodeAdmissionProtocol = S.decodeUnknownOption(S.fromJsonString(AdmissionProtocol));
const encodeAdmissionProtocol = S.encodeUnknownEffect(S.fromJsonString(AdmissionProtocol));

/**
 * Durable transition recorded when a queued ticket becomes an active lease.
 *
 * **Example** (Reference an admitted transition)
 *
 * ```ts
 * import { AdmissionJournalAdmitted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalAdmitted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalAdmitted extends S.Class<AdmissionJournalAdmitted>($I`AdmissionJournalAdmitted`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.Literal("admission-admitted"),
    nonce: S.String,
    pid: S.Finite,
    procStart: S.String,
    kind: AdmissionWorkKind,
    weightTokens: S.Finite,
    priority: AdmissionPriority,
    originKey: S.String,
    enqueuedAtMillis: S.Finite,
    admittedAtMillis: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AdmissionJournalAdmitted", {
    description: "Durable transition recorded when a queued ticket becomes an active admission lease.",
  })
) {}

/**
 * Durable transition recorded when an active admission lease is released.
 *
 * **Example** (Reference a released transition)
 *
 * ```ts
 * import { AdmissionJournalReleased } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalReleased) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalReleased extends S.Class<AdmissionJournalReleased>($I`AdmissionJournalReleased`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.Literal("admission-released"),
    nonce: S.String,
    pid: S.Finite,
    releasedAtMillis: S.Finite,
    memoryPeakBytes: S.optionalKey(S.Finite),
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AdmissionJournalReleased", {
    description: "Durable transition recorded when an active admission lease is released.",
  })
) {}

/**
 * Why a dead scheduler lease was evicted from capacity accounting.
 *
 * **Example** (Recognize an owner death)
 *
 * ```ts
 * import { AdmissionLeaseEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionLeaseEvictionReason.is["owner-dead-or-reused"]("owner-dead-or-reused")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionLeaseEvictionReason = LiteralKit(["owner-dead-or-reused"]).pipe(
  $I.annoteSchema("AdmissionLeaseEvictionReason", {
    description: "Reason a dead admission lease was evicted from scheduler capacity accounting.",
  })
);

/**
 * Reason a dead admission lease was evicted from scheduler capacity accounting.
 *
 * **Example** (Name an eviction reason)
 *
 * ```ts
 * import type { AdmissionLeaseEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * const reason: AdmissionLeaseEvictionReason = "owner-dead-or-reused"
 * console.log(reason) // "owner-dead-or-reused"
 * ```
 *
 * @see {@link AdmissionLeaseEvictionReason} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionLeaseEvictionReason = typeof AdmissionLeaseEvictionReason.Type;

/**
 * Durable transition recorded after the scheduler reaps a verified dead lease.
 *
 * **Example** (Reference an eviction transition)
 *
 * ```ts
 * import { AdmissionJournalLeaseEvicted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalLeaseEvicted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalLeaseEvicted extends S.Class<AdmissionJournalLeaseEvicted>(
  $I`AdmissionJournalLeaseEvicted`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.Literal("admission-lease-evicted"),
    nonce: S.String,
    pid: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    evictedAtMillis: S.Finite,
    reason: AdmissionLeaseEvictionReason,
  },
  $I.annote("AdmissionJournalLeaseEvicted", {
    description: "Durable transition recorded after the scheduler reaps a verified dead admission lease.",
  })
) {}

/**
 * Why a dead scheduler ticket was evicted from the admission queue.
 *
 * **Example** (Recognize a queued submitter death)
 *
 * ```ts
 * import { AdmissionTicketEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionTicketEvictionReason.is["queued-submitter-death"]("queued-submitter-death")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionTicketEvictionReason = LiteralKit(["queued-submitter-death"]).pipe(
  $I.annoteSchema("AdmissionTicketEvictionReason", {
    description: "Reason a dead admission ticket was evicted from the scheduler queue.",
  })
);

/**
 * Reason a dead admission ticket was evicted from the scheduler queue.
 *
 * **Example** (Name a queued submitter death)
 *
 * ```ts
 * import type { AdmissionTicketEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * const reason: AdmissionTicketEvictionReason = "queued-submitter-death"
 * console.log(reason) // "queued-submitter-death"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionTicketEvictionReason = typeof AdmissionTicketEvictionReason.Type;

/**
 * Durable transition recorded after the scheduler claims a dead queue ticket.
 *
 * **Example** (Reference a ticket eviction transition)
 *
 * ```ts
 * import { AdmissionJournalTicketEvicted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalTicketEvicted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalTicketEvicted extends S.Class<AdmissionJournalTicketEvicted>(
  $I`AdmissionJournalTicketEvicted`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.Literal("admission-ticket-evicted"),
    nonce: S.String,
    pid: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    evictedAtMillis: S.Finite,
    reason: AdmissionTicketEvictionReason,
  },
  $I.annote("AdmissionJournalTicketEvicted", {
    description: "Durable transition recorded after the scheduler atomically claims a dead queue ticket.",
  })
) {}

/**
 * Schema-decoded transition stored in the machine-wide admission journal.
 *
 * **Example** (Reference the admission event schema)
 *
 * ```ts
 * import { AdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalEvent) // "object"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionJournalEvent = S.Union([
  AdmissionJournalAdmitted,
  AdmissionJournalReleased,
  AdmissionJournalLeaseEvicted,
  AdmissionJournalTicketEvicted,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AdmissionJournalEvent", {
    description: "Schema-decoded transition stored in the machine-wide admission journal.",
  })
);

/**
 * Decoded admission-transition event retained by {@link AdmissionJournalEvent}.
 *
 * **Example** (Read an admission event tag)
 *
 * ```ts
 * import type { AdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * const tagOf = (event: AdmissionJournalEvent) => event._tag
 * console.log(typeof tagOf) // "function"
 * ```
 *
 * @see {@link AdmissionJournalEvent} for the runtime schema and decoding behavior.
 * @category models
 * @since 0.0.0
 */
export type AdmissionJournalEvent = typeof AdmissionJournalEvent.Type;

type AdmissionJournalV1Event = AdmissionJournalAdmitted | AdmissionJournalReleased;

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(AdmissionJournalEvent));

/**
 * Decodes one NDJSON record into an admission-transition event.
 *
 * **Example** (Reference the journal decoder)
 *
 * ```ts
 * import { decodeAdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof decodeAdmissionJournalEvent) // "function"
 * ```
 *
 * @param input - One raw admission-journal line.
 * @returns The decoded admission-transition event effect.
 * @category decoding
 * @since 0.0.0
 */
export const decodeAdmissionJournalEvent: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<AdmissionJournalEvent, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<AdmissionJournalEvent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(AdmissionJournalEvent)));

/**
 * Resolves the machine-wide admission journal path beneath a scheduler root.
 *
 * **Example** (Reference the path resolver)
 *
 * ```ts
 * import { admissionJournalPath } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionJournalPath) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The admission journal path effect.
 * @category utilities
 * @since 0.0.0
 */
export const admissionJournalPath = Effect.fn("AdmissionJournal.path")(function* (
  root: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(root, JOURNAL_FILE_NAME);
});

/**
 * Resolve the admission protocol marker path beneath a scheduler root.
 *
 * **Example** (Reference the protocol path resolver)
 *
 * ```ts
 * import { admissionProtocolPath } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionProtocolPath) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The protocol marker path effect.
 * @category utilities
 * @since 0.0.0
 */
export const admissionProtocolPath = Effect.fn("AdmissionJournal.protocolPath")(function* (
  root: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(root, PROTOCOL_FILE_NAME);
});

/**
 * Read the admission protocol, failing closed to eviction emission off.
 *
 * **Details**
 *
 * A missing, unreadable, or undecodable marker means the mixed-checkout
 * preservation rollout is not proven, so v2 eviction rows remain disabled.
 *
 * **Example** (Read a protocol marker)
 *
 * ```ts
 * import { readAdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readAdmissionProtocol("/tmp/admission"))) // true
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The decoded protocol or the disabled default.
 * @category utilities
 * @since 0.0.0
 */
export const readAdmissionProtocol = Effect.fn("AdmissionJournal.readProtocol")(function* (
  root: string
): Effect.fn.Return<AdmissionProtocol, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const protocolPath = yield* admissionProtocolPath(root);
  const text = yield* fs.readFileString(protocolPath).pipe(Effect.option);
  return pipe(
    text,
    O.flatMap(decodeAdmissionProtocol),
    O.getOrElse(() => disabledAdmissionProtocol)
  );
});

// EPERM cannot masquerade as liveness here: the admission root is 0o700 and
// uid-validated, so every lock writer shares the probing user.
const pidIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const lockOwnerPid = flow(Str.split(":"), A.head, O.flatMap(N.parse));

const journalLockReapClaimPath = (lockPath: string, observedToken: string): string =>
  `${lockPath}.reap-${createHash("sha256").update(observedToken).digest("hex")}`;

// A generation-specific hard link is both the reaper claim and an immutable
// snapshot of the inode it observed. Only one contender can claim a given
// generation; a delayed contender therefore cannot unlink its replacement.
const reapAbandonedJournalLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  const info = yield* fs.stat(lockPath).pipe(Effect.option);
  const nowMillis = yield* Clock.currentTimeMillis;
  // A parseable owner that died abandons its lock immediately. Only malformed
  // content clears through the age backstop, so a just-published or live
  // generation is never misread as abandoned.
  const ownerPid = O.flatMap(content, lockOwnerPid);
  const ownerDead = O.exists(ownerPid, (pid) => !pidIsAlive(pid));
  const outlivedBackstop = pipe(
    info,
    O.flatMap((fileInfo) => fileInfo.mtime),
    O.exists((mtime) => nowMillis - mtime.getTime() > LOCK_REUSE_BACKSTOP_MILLIS)
  );
  const observedToken = O.filter(content, () => ownerDead || (O.isNone(ownerPid) && outlivedBackstop));
  if (O.isNone(observedToken)) {
    return;
  }
  const claimPath = journalLockReapClaimPath(lockPath, observedToken.value);
  const claimed = yield* fs.link(lockPath, claimPath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
  if (!claimed) {
    return;
  }
  const claimedToken = yield* fs.readFileString(claimPath).pipe(Effect.option);
  yield* O.exists(claimedToken, (token) => token === observedToken.value)
    ? fs.remove(lockPath, { force: false }).pipe(Effect.ignore)
    : Effect.void;
  yield* fs.remove(claimPath, { force: true }).pipe(Effect.ignore);
});

const tryAcquireJournalLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // Publish the lock via hard link so it never exists without its token: a
  // contender reading a just-created lock always sees a full generation.
  const stagingPath = `${lockPath}.stage-${process.pid}-${randomUUID()}`;
  const acquired = yield* fs
    .writeFileString(stagingPath, token)
    .pipe(Effect.andThen(fs.link(stagingPath, lockPath)), Effect.as(true), Effect.orElseSucceed(constant(false)));
  yield* fs.remove(stagingPath, { force: true }).pipe(Effect.ignore);
  // Contention fails this attempt; reaping an abandoned lock lets a later
  // attempt acquire it.
  if (!acquired) {
    yield* reapAbandonedJournalLock(lockPath);
  }
  return acquired;
});

/**
 * Acquire an owned-generation lock for a serialized journal rewrite.
 *
 * **Details**
 *
 * A hard link publishes the complete owner token atomically. Contenders retry
 * briefly and reclaim a dead owner's exact observed generation. An unparseable
 * generation can age through the corruption backstop, while a parseable live
 * owner is never reaped by age alone.
 *
 * **Example** (Acquire a journal lock)
 *
 * ```ts
 * import { acquireJournalFileLock } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof acquireJournalFileLock) // "function"
 * ```
 *
 * @param lockPath - Exclusive lock path adjacent to the serialized journal.
 * @param token - Unique `pid:uuid` generation owned by the caller.
 * @param retryAttempts - Maximum atomic-acquisition attempts before returning false.
 * @returns Whether the caller acquired the lock within the retry window.
 * @category utilities
 * @since 0.0.0
 */
export const acquireJournalFileLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string,
  retryAttempts = LOCK_RETRY_ATTEMPTS
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    if (yield* tryAcquireJournalLock(lockPath, token)) {
      return true;
    }
    yield* Effect.sleep(Duration.millis(LOCK_RETRY_DELAY_MILLIS));
  }
  return false;
});

/**
 * Release a serialized journal lock only while its generation is still owned.
 *
 * **Example** (Release a journal lock)
 *
 * ```ts
 * import { releaseJournalFileLock } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof releaseJournalFileLock) // "function"
 * ```
 *
 * @param lockPath - Exclusive lock path adjacent to the serialized journal.
 * @param token - Unique `pid:uuid` generation previously acquired by the caller.
 * @returns An effect that removes only the caller's lock generation.
 * @category utilities
 * @since 0.0.0
 */
export const releaseJournalFileLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  // Remove only the generation this writer created; a lock reaped and
  // replaced mid-write belongs to its new owner and stays.
  if (O.exists(content, (current) => current === token)) {
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.ignore);
  }
});

/**
 * Test-only handle for the owned-generation journal lock release.
 *
 * **Example** (Reference the test-only release)
 *
 * ```ts
 * import { releaseAdmissionJournalLockForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof releaseAdmissionJournalLockForTesting) // "function"
 * ```
 *
 * @param lockPath - Journal lock path.
 * @param token - The owning writer's `pid:uuid` lock token.
 * @returns An effect that removes the lock only while the token still owns it.
 * @category utilities
 * @since 0.0.0
 */
export const releaseAdmissionJournalLockForTesting = releaseJournalFileLock;

const withAdmissionJournalLock = Effect.fnUntraced(function* <Success, Error, Requirements>(
  root: string,
  busyMessage: (lockPath: string) => string,
  use: (journalPath: string) => Effect.Effect<Success, Error, Requirements>
): Effect.fn.Return<Success, Error | QualitySchedulerError, Requirements | FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journalPath = path.join(root, JOURNAL_FILE_NAME);
  const lockPath = path.join(root, LOCK_FILE_NAME);
  const token = `${process.pid}:${randomUUID()}`;
  yield* fs
    .makeDirectory(root, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(QualitySchedulerError.new("Failed to create admission journal directory.")));
  if (!(yield* acquireJournalFileLock(lockPath, token))) {
    return yield* QualitySchedulerError.make({ message: busyMessage(lockPath) });
  }
  return yield* Effect.ensuring(use(journalPath), releaseJournalFileLock(lockPath, token));
});

/**
 * Atomically write the admission protocol marker.
 *
 * **Example** (Enable eviction emission)
 *
 * ```ts
 * import { writeAdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(writeAdmissionProtocol("/tmp/admission", "on"))) // true
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param eviction - Desired eviction-event emission state.
 * @returns The protocol that was durably published.
 * @category utilities
 * @since 0.0.0
 */
export const writeAdmissionProtocol = Effect.fn("AdmissionJournal.writeProtocol")(function* (
  root: string,
  eviction: AdmissionEvictionEmission
): Effect.fn.Return<AdmissionProtocol, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const protocol = AdmissionProtocol.make({ schemaVersion: "yeet-admission-protocol/v1", eviction });
  const content = yield* encodeAdmissionProtocol(protocol).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode the admission protocol marker."))
  );
  return yield* withAdmissionJournalLock(
    root,
    (lockPath) => `Admission journal lock "${lockPath}" stayed busy; could not change the protocol marker.`,
    Effect.fnUntraced(function* () {
      yield* publishJournalTextAtomically(
        yield* admissionProtocolPath(root),
        `${content}\n`,
        "admission protocol marker"
      );
      return protocol;
    })
  );
});

const rewriteJournalLocked = Effect.fnUntraced(function* (
  journalPath: string,
  event: AdmissionJournalEvent,
  line: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(Str.empty)
          : Effect.fail(QualitySchedulerError.new(`Failed to read admission journal "${journalPath}".`)(error))
      )
    );
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  // Mixed fleet revisions share this journal. Preserve rows this revision does
  // not understand byte-for-byte so an older locked rewrite cannot erase a
  // newer protocol event before all checkouts have rolled forward.
  const retained = yield* Effect.forEach(rawLines, (raw) =>
    decodeAdmissionJournalEvent(raw).pipe(
      Effect.option,
      Effect.map((decoded) => ({ event: decoded, line: raw }))
    )
  );
  const records = A.append(retained, { event: O.some(event), line });
  const admittedIndexes = pipe(
    A.zip(
      A.map(records, (record) => record.event),
      A.range(0, A.length(records) - 1)
    ),
    A.map(([recorded, index]) =>
      O.exists(recorded, AdmissionJournalEvent.guards["admission-admitted"]) ? O.some(index) : O.none()
    ),
    A.getSomes
  );
  const firstRetainedIndex =
    A.length(admittedIndexes) <= RETAINED_ADMISSIONS
      ? 0
      : pipe(admittedIndexes, A.takeRight(RETAINED_ADMISSIONS), A.head, O.getOrElse(constant(0)));
  const retainedRecords = A.filter(records, (record, index) => index >= firstRetainedIndex || O.isNone(record.event));
  yield* publishJournalTextAtomically(
    journalPath,
    pipe(
      retainedRecords,
      A.map((record) => `${record.line}\n`),
      A.join(Str.empty)
    ),
    "admission journal"
  );
});

/**
 * Appends one admission transition through a serialized journal rewrite.
 *
 * The writer takes `journal.lock` with a bounded wait, publishing its
 * `pid:uuid` generation token by hard link so the lock never exists without
 * an owner. A lock whose parseable owner pid is dead — or which outlived the
 * reuse backstop — is reaped, and release removes only the generation this
 * writer stamped. The rewrite preserves undecodable records, ring-trims to the
 * newest admitted transitions, and publishes atomically via temp-file
 * rename. A lock that stays busy fails the append with a typed error;
 * scheduler correctness never depends on this operation, so callers treat
 * that failure as a best-effort diagnostic write. Unknown journal rows remain
 * byte-identical across rewrites so older fleet writers cannot erase newer
 * protocol variants during a rolling upgrade.
 *
 * **Example** (Reference the journal append entry point)
 *
 * ```ts
 * import { appendAdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendAdmissionJournalEvent) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param event - Ungated v1 admission or release transition to append.
 * @returns An effect that appends to the serialized admission journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionJournalEvent = Effect.fn("AdmissionJournal.append")(function* (
  root: string,
  event: AdmissionJournalV1Event
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission journal event."))
  );
  yield* withAdmissionJournalLock(
    root,
    (lockPath) => `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`,
    (journalPath) => rewriteJournalLocked(journalPath, event, line)
  );
});

/**
 * Append one eviction event only while the serialized protocol gate is on.
 *
 * **Details**
 *
 * The protocol read and admission-journal rewrite share `journal.lock` with
 * protocol updates. After disablement returns, no emitter that observed the
 * prior enabled generation can append a delayed v2 eviction row.
 *
 * **Example** (Reference the gated eviction writer)
 *
 * ```ts
 * import { appendAdmissionEvictionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendAdmissionEvictionJournalEvent) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param event - Version-two lease or ticket eviction event.
 * @returns Whether the enabled protocol admitted the event.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionEvictionJournalEvent = Effect.fn("AdmissionJournal.appendEviction")(function* (
  root: string,
  event: AdmissionJournalLeaseEvicted | AdmissionJournalTicketEvicted
): Effect.fn.Return<boolean, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission eviction journal event."))
  );
  return yield* withAdmissionJournalLock(
    root,
    (lockPath) => `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`,
    Effect.fnUntraced(function* (journalPath) {
      const protocol = yield* readAdmissionProtocol(root);
      if (AdmissionEvictionEmission.is.off(protocol.eviction)) {
        return false;
      }
      yield* rewriteJournalLocked(journalPath, event, line);
      return true;
    })
  );
});
