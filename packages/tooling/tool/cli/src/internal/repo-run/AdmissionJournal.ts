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
import { SchemaUtils } from "@beep/schema";
import { Console, Duration, Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
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
  },
  $I.annote("AdmissionJournalReleased", {
    description: "Durable transition recorded when an active admission lease is released.",
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
export const AdmissionJournalEvent = S.Union([AdmissionJournalAdmitted, AdmissionJournalReleased]).pipe(
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

const lockOwnerPid = (content: string): O.Option<number> => pipe(content, Str.split(":"), A.head, O.flatMap(N.parse));

// A lock replaced between the ownership read and the remove can be reaped
// fresh; the window is one syscall pair and the cost is one competing
// serialized writer, so the telemetry-grade journal accepts it.
const reapAbandonedJournalLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  // An unreadable or unparseable lock counts as abandoned; a live owner keeps it.
  const abandoned = pipe(
    content,
    O.flatMap(lockOwnerPid),
    O.match({ onNone: constant(true), onSome: (pid) => !pidIsAlive(pid) })
  );
  if (abandoned) {
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.ignore);
  }
});

const tryAcquireJournalLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // Any create failure (typically AlreadyExists contention) fails this
  // attempt; reaping a dead owner's lock lets a later attempt acquire it.
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(lockPath, { flag: "wx" });
      yield* file.writeAll(textEncoder.encode(token));
      return true;
    })
  ).pipe(Effect.catch(() => reapAbandonedJournalLock(lockPath).pipe(Effect.as(false))));
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
 * The writer takes `journal.lock` with a bounded wait, stamping it with its
 * `pid:uuid` generation token: a lock whose owning pid is dead (or whose
 * content is unreadable) is reaped, and release removes only the generation
 * this writer stamped. The rewrite drops undecodable records, ring-trims to
 * the newest admitted transitions, and publishes atomically via temp-file
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
