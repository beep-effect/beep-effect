/**
 * Machine-wide best-effort admission-transition journal at
 * `<admission root>/journal.ndjson`.
 *
 * The journal is ring-buffered for diagnostics. Scheduler correctness lives
 * exclusively in ticket and lease files; `bypassAdmission` on sub-envelope
 * machines mints neither file and journals no transition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Clock, Console, Effect, FileSystem, Path, pipe } from "effect";
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
const LOCK_STALE_MILLIS = 60_000;
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

const inspectStaleCompactionLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const nowMillis = yield* Clock.currentTimeMillis;
  const info = yield* fs.stat(lockPath).pipe(Effect.option);
  const stale = pipe(
    info,
    O.flatMap((fileInfo) => fileInfo.mtime),
    O.exists((mtime) => nowMillis - mtime.getTime() > LOCK_STALE_MILLIS)
  );
  if (stale) {
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.ignore);
  }
  return false;
});

const tryAcquireCompactionLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // Any create failure (typically AlreadyExists contention) skips this round;
  // the stale inspection reaps an abandoned lock so the next append compacts.
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs.open(lockPath, { flag: "wx" });
      yield* file.writeAll(textEncoder.encode(`${process.pid}\n`));
      return true;
    })
  ).pipe(Effect.catch(() => inspectStaleCompactionLock(lockPath)));
});

const compactLocked = Effect.fnUntraced(function* (
  journalPath: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to read admission journal "${journalPath}".`)));
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  const probed = yield* Effect.forEach(rawLines, (line) =>
    decodeAdmissionJournalEvent(line).pipe(Effect.option, Effect.map(O.map((event) => ({ event, line }))))
  );
  const records = A.getSomes(probed);
  const droppedCount = A.length(rawLines) - A.length(records);
  if (droppedCount > 0) {
    yield* Console.warn(`dropped ${droppedCount} undecodable admission journal record(s) from "${journalPath}"`);
  }
  const admittedIndexes = pipe(
    A.zip(
      A.map(records, ({ event }) => event),
      A.range(0, A.length(records) - 1)
    ),
    A.map(([event, index]) => (event._tag === "admission-admitted" ? O.some(index) : O.none())),
    A.getSomes
  );
  const firstRetainedIndex =
    A.length(admittedIndexes) <= RETAINED_ADMISSIONS
      ? 0
      : pipe(admittedIndexes, A.takeRight(RETAINED_ADMISSIONS), A.head, O.getOrElse(constant(0)));
  if (droppedCount === 0 && firstRetainedIndex === 0) {
    return;
  }
  yield* fs
    .writeFileString(
      journalPath,
      pipe(
        A.drop(records, firstRetainedIndex),
        A.map(({ line }) => `${line}\n`),
        A.join(Str.empty)
      )
    )
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to compact admission journal "${journalPath}".`)));
});

const compactAdmissionJournal = Effect.fnUntraced(function* (
  journalPath: string,
  lockPath: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const acquired = yield* tryAcquireCompactionLock(lockPath);
  if (!acquired) {
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.ensuring(compactLocked(journalPath), fs.remove(lockPath, { force: true }).pipe(Effect.ignore));
});

/**
 * Appends, syncs, self-heals, and bounds the machine-wide admission journal.
 *
 * Scheduler correctness does not depend on this operation; callers may handle
 * its typed failure as a best-effort diagnostic write.
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
 * @returns An effect that appends and compacts the admission journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionJournalEvent = Effect.fn("AdmissionJournal.append")(function* (
  root: string,
  event: AdmissionJournalEvent
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journalPath = yield* admissionJournalPath(root);
  const lockPath = path.join(root, LOCK_FILE_NAME);
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission journal event."))
  );
  yield* fs
    .makeDirectory(root, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(QualitySchedulerError.new("Failed to create admission journal directory.")));
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(journalPath, { flag: "a" })
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to open admission journal "${journalPath}".`)));
      yield* file
        .writeAll(textEncoder.encode(`${line}\n`))
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to append admission journal "${journalPath}".`)));
      yield* file.sync.pipe(
        Effect.mapError(QualitySchedulerError.new(`Failed to sync admission journal "${journalPath}".`))
      );
    })
  );
  yield* compactAdmissionJournal(journalPath, lockPath);
});
