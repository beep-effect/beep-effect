/**
 * Leaf storage for scheduler-owned Yeet attempt-termination facts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { UUID as UUIDSchema } from "@beep/schema/String";
import { Console, DateTime, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { acquireJournalFileLock, releaseJournalFileLock } from "./AdmissionJournal.ts";
import { QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import { repoRunArtifactId } from "./RepoRunArtifacts.ts";
import type { UUID } from "@beep/schema/String";

const $I = $RepoCliId.create("internal/repo-run/AttemptTerminationJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";
const RETAINED_ROWS = 50;
const LOCK_RETRY_ATTEMPTS = 400;
const textEncoder = new TextEncoder();

/**
 * Terminal reason retained for every interrupted Yeet attempt.
 *
 * **Details**
 *
 * Current writers use abnormal reasons only. `success` and `failure` remain
 * decode-compatible with rows written by the first A5 implementation.
 *
 * **Example** (Recognize an interruption)
 *
 * ```ts
 * import { YeetAttemptTerminationReason } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(YeetAttemptTerminationReason.is.interrupted("interrupted")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetAttemptTerminationReason = LiteralKit([
  "success",
  "failure",
  "interrupted",
  "signal",
  "queued-submitter-death",
  "lease-eviction",
  "terminal-row-missing",
  "unrecorded-failure",
]).pipe(
  $I.annoteSchema("YeetAttemptTerminationReason", {
    description: "Abnormal reason a Yeet attempt ended without an ordinary finished row.",
  })
);

/**
 * Abnormal reason a Yeet attempt ended without an ordinary finished row.
 *
 * **Example** (Name a terminal reason)
 *
 * ```ts
 * import type { YeetAttemptTerminationReason } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * const reason: YeetAttemptTerminationReason = "interrupted"
 * console.log(reason) // "interrupted"
 * ```
 *
 * @see {@link YeetAttemptTerminationReason} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type YeetAttemptTerminationReason = typeof YeetAttemptTerminationReason.Type;

/**
 * Receipt proving that bounded journal retention evicted older rows.
 *
 * **Example** (Reference a compaction receipt)
 *
 * ```ts
 * import { YeetAttemptJournalCompacted } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof YeetAttemptJournalCompacted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class YeetAttemptJournalCompacted extends S.Class<YeetAttemptJournalCompacted>($I`YeetAttemptJournalCompacted`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("journal-compacted"),
    recordedAt: S.String,
    evictedCount: NonNegativeInt,
    oldestEvictedRecordedAt: S.String,
  },
  $I.annote("YeetAttemptJournalCompacted", {
    description: "Receipt proving that bounded Yeet attempt-journal retention evicted older rows.",
  })
) {}

const AttemptJournalRetentionEvent = S.Union([
  S.TaggedStruct("attempt-started", {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    startedAt: S.String,
  }),
  S.TaggedStruct("attempt-finished", {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    recordedAt: S.String,
  }),
  S.TaggedStruct("attempt-terminated", {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    recordedAt: S.String,
  }),
  YeetAttemptJournalCompacted,
]).pipe(S.toTaggedUnion("_tag"));

type AttemptJournalRetentionEvent = typeof AttemptJournalRetentionEvent.Type;

const SchedulerAttemptTerminated = S.TaggedStruct("attempt-terminated", {
  schemaVersion: S.Literal("yeet-attempt-journal/v1"),
  attemptId: UUIDSchema,
  recordedAt: S.String,
  reason: YeetAttemptTerminationReason,
});

const decodeRetentionEvent = S.decodeUnknownEffect(S.fromJsonString(AttemptJournalRetentionEvent));
const encodeCompactionReceipt = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalCompacted));
const encodeSchedulerTermination = S.encodeUnknownEffect(S.fromJsonString(SchedulerAttemptTerminated));

/**
 * Resolve the branch-scoped attempt journal path.
 *
 * **Example** (Resolve a scheduler-owned attempt journal)
 *
 * ```ts
 * import { attemptJournalPathForCheckout } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof attemptJournalPathForCheckout) // "function"
 * ```
 *
 * @param checkoutRoot - Checkout that owns the attempt journal.
 * @param branch - Branch used to derive the stable run directory.
 * @returns The journal file path effect.
 * @category utilities
 * @since 0.0.0
 */
export const attemptJournalPathForCheckout = Effect.fn("AttemptTerminationJournal.pathForCheckout")(function* (
  checkoutRoot: string,
  branch: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(checkoutRoot, ".beep", "yeet", "runs", repoRunArtifactId(branch), JOURNAL_FILE_NAME);
});

const hasTornTrailingRecord = (lines: ReadonlyArray<string>): Effect.Effect<boolean> =>
  pipe(
    A.last(lines),
    O.match({
      onNone: constant(Effect.succeed(false)),
      onSome: (line) =>
        decodeRetentionEvent(line).pipe(
          Effect.as(false),
          Effect.orElseSucceed(() => true)
        ),
    })
  );

const eventRecordedAt = (event: AttemptJournalRetentionEvent): string =>
  AttemptJournalRetentionEvent.match(event, {
    "attempt-started": (started) => started.startedAt,
    "attempt-finished": (finished) => finished.recordedAt,
    "attempt-terminated": (terminated) => terminated.recordedAt,
    "journal-compacted": (compacted) => compacted.recordedAt,
  });

const retainedJournalLines = Effect.fn("AttemptTerminationJournal.retainedLines")(function* (
  events: ReadonlyArray<AttemptJournalRetentionEvent>,
  lines: ReadonlyArray<string>
) {
  if (A.length(events) <= RETAINED_ROWS) return lines;
  const attemptRows = pipe(
    A.zip(events, lines),
    A.filter(([event]) => event._tag !== "journal-compacted")
  );
  const retainedRows = A.takeRight(attemptRows, RETAINED_ROWS - 1);
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const receipt = yield* encodeCompactionReceipt(
    YeetAttemptJournalCompacted.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "journal-compacted",
      recordedAt,
      evictedCount: NonNegativeInt.make(A.length(events) - A.length(retainedRows)),
      oldestEvictedRecordedAt: pipe(
        A.appendAll(
          A.filter(events, AttemptJournalRetentionEvent.guards["journal-compacted"]),
          A.dropRight(
            A.filter(events, (event) => event._tag !== "journal-compacted"),
            RETAINED_ROWS - 1
          )
        ),
        A.sortWith(eventRecordedAt, Order.String),
        A.head,
        O.map(eventRecordedAt),
        O.getOrElse(constant(recordedAt))
      ),
    })
  ).pipe(Effect.mapError(QualitySchedulerError.new("Failed to encode Yeet attempt journal compaction receipt.")));
  return A.append(
    A.map(retainedRows, ([, line]) => line),
    receipt
  );
});

const compactJournal = Effect.fn("AttemptTerminationJournal.compact")(function* (
  journalPath: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  // A host that dies mid-append leaves a torn final record; dropping it keeps the
  // journal usable instead of failing every later attempt on the same bad line.
  const torn = yield* hasTornTrailingRecord(rawLines);
  if (torn) {
    yield* Console.warn(`[yeet] dropped a torn trailing record from the Yeet attempt journal "${journalPath}"`);
  }
  const lines = torn ? A.dropRight(rawLines, 1) : rawLines;
  const events = yield* Effect.forEach(lines, (line) =>
    decodeRetentionEvent(line).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to decode Yeet attempt journal "${journalPath}".`))
    )
  );
  if (!torn && A.length(events) <= RETAINED_ROWS) {
    return;
  }
  const retainedLines = yield* retainedJournalLines(events, lines);
  yield* fs
    .writeFileString(
      journalPath,
      pipe(
        retainedLines,
        A.map((line) => `${line}\n`),
        A.join(Str.empty)
      )
    )
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to compact Yeet attempt journal "${journalPath}".`)));
});

/**
 * Append an encoded attempt event under the journal lock and enforce retention.
 *
 * **Details**
 *
 * Callers schema-encode the event before this storage boundary. The storage
 * layer validates the stable event envelope needed for torn-write recovery and
 * compaction without importing the high-level verdict or proof schemas.
 *
 * **Example** (Reference the encoded writer)
 *
 * ```ts
 * import { appendEncodedAttemptJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendEncodedAttemptJournalEvent) // "function"
 * ```
 *
 * @param journalPath - Absolute path of the branch-scoped attempt journal.
 * @param line - A schema-encoded event without a trailing newline.
 * @param eventTag - Event tag used in a lock-contention diagnostic.
 * @param retryAttempts - Maximum journal-lock acquisition attempts.
 * @returns An effect that appends, syncs, and compacts the journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendEncodedAttemptJournalEvent = Effect.fn("AttemptTerminationJournal.appendEncoded")(function* (
  journalPath: string,
  line: string,
  eventTag: AttemptJournalRetentionEvent["_tag"],
  retryAttempts = LOCK_RETRY_ATTEMPTS
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lockPath = `${journalPath}.lock`;
  const lockToken = `${process.pid}:${randomUUID()}`;
  yield* fs
    .makeDirectory(path.dirname(journalPath), { recursive: true })
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to create Yeet attempt journal directory.`)));
  if (!(yield* acquireJournalFileLock(lockPath, lockToken, retryAttempts))) {
    return yield* QualitySchedulerError.make({
      message: `Yeet attempt journal lock "${lockPath}" stayed busy; could not append ${eventTag}.`,
    });
  }
  const appendLocked = Effect.gen(function* () {
    const journalExists = yield* fs.exists(journalPath).pipe(Effect.orElseSucceed(constant(false)));
    yield* journalExists ? compactJournal(journalPath) : Effect.void;
    yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* fs
          .open(journalPath, { flag: "a" })
          .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to open Yeet attempt journal "${journalPath}".`)));
        yield* file
          .writeAll(textEncoder.encode(`${line}\n`))
          .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to append Yeet attempt journal "${journalPath}".`)));
        yield* file.sync.pipe(
          Effect.mapError(QualitySchedulerError.new(`Failed to sync Yeet attempt journal "${journalPath}".`))
        );
      })
    );
    yield* compactJournal(journalPath);
  });
  yield* Effect.ensuring(appendLocked, releaseJournalFileLock(lockPath, lockToken));
});

/**
 * Append the minimal abnormal terminal row emitted by the admission reaper.
 *
 * **Details**
 *
 * This boundary deliberately depends only on the stable attempt envelope. It
 * lets the low-level admission scheduler retain death facts without importing
 * the verdict, planning, or proof schema graph.
 *
 * **Example** (Reference the scheduler terminal writer)
 *
 * ```ts
 * import { appendSchedulerAttemptTerminated } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendSchedulerAttemptTerminated) // "function"
 * ```
 *
 * @param checkoutRoot - Checkout whose branch-scoped journal owns the attempt.
 * @param branch - Branch used to derive the stable run-artifact directory.
 * @param attemptId - Stable attempt identifier shared with the admission row.
 * @param reason - Admission death reason that ended the attempt abnormally.
 * @returns An effect that durably appends the terminal row.
 * @category utilities
 * @since 0.0.0
 */
export const appendSchedulerAttemptTerminated = Effect.fn("AttemptTerminationJournal.appendSchedulerTerminated")(
  function* (
    checkoutRoot: string,
    branch: string,
    attemptId: UUID,
    reason: "lease-eviction" | "queued-submitter-death"
  ): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
    const journalPath = yield* attemptJournalPathForCheckout(checkoutRoot, branch);
    const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const line = yield* encodeSchedulerTermination({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-terminated",
      attemptId,
      recordedAt,
      reason,
    }).pipe(Effect.mapError(QualitySchedulerError.new("Failed to encode scheduler attempt terminal event.")));
    yield* appendEncodedAttemptJournalEvent(journalPath, line, "attempt-terminated");
  }
);
