/**
 * Machine-wide best-effort admission-transition journal at
 * `<admission root>/journal.ndjson`.
 *
 * Every write serializes under `<admission root>/journal.lock`: the writer
 * reads the journal, drops undecodable records, appends its event, ring-trims
 * to the newest admitted transitions, and publishes the result with an atomic
 * temp-file rename. Scheduler correctness lives exclusively in ticket and
 * lease files; `bypassAdmission` on sub-envelope machines mints neither file
 * and journals no transition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Clock, Console, Duration, Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant, dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AdmissionPriority, AdmissionWorkKind, QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $RepoCliId.create("internal/repo-run/AdmissionJournal");
const JOURNAL_FILE_NAME = "journal.ndjson";
const LOCK_FILE_NAME = "journal.lock";
const RETAINED_ADMISSIONS = 200;
const LOCK_RETRY_ATTEMPTS = 8;
const LOCK_RETRY_DELAY_MILLIS = 25;
// No legitimate writer holds the lock beyond one rewrite (milliseconds); the
// backstop clears locks stranded by pid reuse or tampering without ever
// racing a live hold.
const LOCK_REUSE_BACKSTOP_MILLIS = 300_000;
const textEncoder = new TextEncoder();

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
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
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

// A lock replaced between the ownership read and the remove can be reaped
// fresh; the window is one syscall pair and the cost is one competing
// serialized writer, so the telemetry-grade journal accepts it.
const reapAbandonedJournalLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  const info = yield* fs.stat(lockPath).pipe(Effect.option);
  const nowMillis = yield* Clock.currentTimeMillis;
  // A parseable owner that died abandons its lock immediately; anything else
  // (pid reuse, unreadable content) clears through the age backstop so a
  // just-published generation is never misread as abandoned.
  const ownerDead = pipe(
    content,
    O.flatMap(lockOwnerPid),
    O.exists((pid) => !pidIsAlive(pid))
  );
  const outlivedBackstop = pipe(
    info,
    O.flatMap((fileInfo) => fileInfo.mtime),
    O.exists((mtime) => nowMillis - mtime.getTime() > LOCK_REUSE_BACKSTOP_MILLIS)
  );
  if (ownerDead || outlivedBackstop) {
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.ignore);
  }
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

const acquireJournalLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  for (let attempt = 0; attempt < LOCK_RETRY_ATTEMPTS; attempt++) {
    if (yield* tryAcquireJournalLock(lockPath, token)) {
      return true;
    }
    yield* Effect.sleep(Duration.millis(LOCK_RETRY_DELAY_MILLIS));
  }
  return false;
});

const releaseJournalLock = Effect.fnUntraced(function* (
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
export const releaseAdmissionJournalLockForTesting = releaseJournalLock;

const publishJournalAtomic = Effect.fnUntraced(function* (
  journalPath: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const stagingPath = `${journalPath}.tmp-${process.pid}-${randomUUID()}`;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(stagingPath, { flag: "w" });
      yield* file.writeAll(textEncoder.encode(content));
      yield* file.sync;
    })
  ).pipe(Effect.mapError(QualitySchedulerError.new(`Failed to stage admission journal "${journalPath}".`)));
  yield* fs
    .rename(stagingPath, journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to publish admission journal "${journalPath}".`)));
});

const rewriteJournalLocked = Effect.fnUntraced(function* (
  journalPath: string,
  event: AdmissionJournalEvent,
  line: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
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
  const probed = yield* Effect.forEach(rawLines, (raw) =>
    decodeAdmissionJournalEvent(raw).pipe(
      Effect.option,
      Effect.map(O.map((decoded) => ({ event: decoded, line: raw })))
    )
  );
  const retained = A.getSomes(probed);
  const droppedCount = A.length(rawLines) - A.length(retained);
  if (droppedCount > 0) {
    yield* Console.warn(`dropped ${droppedCount} undecodable admission journal record(s) from "${journalPath}"`);
  }
  const records = A.append(retained, { event, line });
  const admittedIndexes = pipe(
    A.zip(
      A.map(records, (record) => record.event),
      A.range(0, A.length(records) - 1)
    ),
    A.map(([recorded, index]) => (recorded._tag === "admission-admitted" ? O.some(index) : O.none())),
    A.getSomes
  );
  const firstRetainedIndex =
    A.length(admittedIndexes) <= RETAINED_ADMISSIONS
      ? 0
      : pipe(admittedIndexes, A.takeRight(RETAINED_ADMISSIONS), A.head, O.getOrElse(constant(0)));
  yield* publishJournalAtomic(
    journalPath,
    pipe(
      A.drop(records, firstRetainedIndex),
      A.map((record) => `${record.line}\n`),
      A.join(Str.empty)
    )
  );
});

/**
 * Appends one admission transition through a serialized journal rewrite.
 *
 * The writer takes `journal.lock` with a bounded wait, publishing its
 * `pid:uuid` generation token by hard link so the lock never exists without
 * an owner. A lock whose parseable owner pid is dead — or which outlived the
 * reuse backstop — is reaped, and release removes only the generation this
 * writer stamped. The rewrite drops undecodable records, ring-trims to the
 * newest admitted transitions, and publishes atomically via temp-file
 * rename. A lock that stays busy fails the append with a typed error;
 * scheduler correctness never depends on this operation, so callers treat
 * that failure as a best-effort diagnostic write.
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
 * @param event - Admission transition to append.
 * @returns An effect that appends to the serialized admission journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionJournalEvent = Effect.fn("AdmissionJournal.append")(function* (
  root: string,
  event: AdmissionJournalEvent
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journalPath = path.join(root, JOURNAL_FILE_NAME);
  const lockPath = path.join(root, LOCK_FILE_NAME);
  const token = `${process.pid}:${randomUUID()}`;
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission journal event."))
  );
  yield* fs
    .makeDirectory(root, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(QualitySchedulerError.new("Failed to create admission journal directory.")));
  if (!(yield* acquireJournalLock(lockPath, token))) {
    return yield* QualitySchedulerError.make({
      message: `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`,
    });
  }
  yield* Effect.ensuring(rewriteJournalLocked(journalPath, event, line), releaseJournalLock(lockPath, token));
});
