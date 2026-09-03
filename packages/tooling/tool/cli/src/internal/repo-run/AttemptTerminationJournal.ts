/**
 * Leaf storage for scheduler-owned Yeet attempt-termination facts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UUID as UUIDSchema } from "@beep/schema/String";
import { Console, DateTime, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { acquireJournalFileLock, releaseJournalFileLock } from "./AdmissionJournal.ts";
import { ProcessIdentityStatus, processIdentityStatus } from "./ProcessIdentity.ts";
import { attemptInputFactFields, QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import { repoRunArtifactId } from "./RepoRunArtifacts.ts";
import type { UUID } from "@beep/schema/String";
import type { YeetAdmissionLease, YeetAdmissionTicket } from "./QualityScheduler.schemas.ts";

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
  "owner-dead",
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
    attemptId: UUIDSchema,
    startedAt: S.String,
    ownerPid: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ownerProcStart: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ...attemptInputFactFields,
  }),
  S.TaggedStruct("attempt-finished", {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    attemptId: UUIDSchema,
    recordedAt: S.String,
  }),
  S.TaggedStruct("attempt-terminated", {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    attemptId: UUIDSchema,
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
  ...attemptInputFactFields,
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
  const attemptRows = A.getSomes(
    A.map(A.zip(events, lines), ([event, line]) =>
      AttemptJournalRetentionEvent.guards["journal-compacted"](event) ? O.none() : O.some({ event, line })
    )
  );
  const newestAttemptIds = A.reduceRight(attemptRows, A.empty<UUID>(), (attemptIds, { event }) =>
    A.contains(attemptIds, event.attemptId) ? attemptIds : A.append(attemptIds, event.attemptId)
  );
  let retainedCount = 0;
  let retainedAttemptIds = A.empty<UUID>();
  for (const attemptId of newestAttemptIds) {
    const attemptRowCount = A.length(A.filter(attemptRows, ({ event }) => event.attemptId === attemptId));
    if (retainedCount + attemptRowCount <= RETAINED_ROWS - 1) {
      retainedAttemptIds = A.append(retainedAttemptIds, attemptId);
      retainedCount = retainedCount + attemptRowCount;
    }
  }
  const retainedRows = A.filter(attemptRows, ({ event }) => A.contains(retainedAttemptIds, event.attemptId));
  const evictedEvents = A.map(
    A.filter(attemptRows, ({ event }) => !A.contains(retainedAttemptIds, event.attemptId)),
    ({ event }) => event
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const receipt = yield* encodeCompactionReceipt(
    YeetAttemptJournalCompacted.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "journal-compacted",
      recordedAt,
      evictedCount: NonNegativeInt.make(A.length(events) - A.length(retainedRows)),
      oldestEvictedRecordedAt: pipe(
        A.appendAll(A.filter(events, AttemptJournalRetentionEvent.guards["journal-compacted"]), evictedEvents),
        A.sortWith(eventRecordedAt, Order.String),
        A.head,
        O.map(eventRecordedAt),
        O.getOrElse(constant(recordedAt))
      ),
    })
  ).pipe(Effect.mapError(QualitySchedulerError.new("Failed to encode Yeet attempt journal compaction receipt.")));
  return A.append(
    A.map(retainedRows, ({ line }) => line),
    receipt
  );
});

const normalizeJournal = Effect.fn("AttemptTerminationJournal.normalize")(function* (
  journalPath: string,
  retainRows: boolean
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
  if (!torn && (!retainRows || A.length(events) <= RETAINED_ROWS)) {
    return;
  }
  const retainedLines = retainRows ? yield* retainedJournalLines(events, lines) : lines;
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

const repairTornJournal = (journalPath: string) => normalizeJournal(journalPath, false);

const compactJournal = (journalPath: string) => normalizeJournal(journalPath, true);

const appendLinesLocked = Effect.fnUntraced(function* (
  journalPath: string,
  lines: ReadonlyArray<string>
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  if (A.isReadonlyArrayEmpty(lines)) {
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(journalPath, { flag: "a" })
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to open Yeet attempt journal "${journalPath}".`)));
      yield* file
        .writeAll(
          textEncoder.encode(
            pipe(
              lines,
              A.map((line) => `${line}\n`),
              A.join(Str.empty)
            )
          )
        )
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to append Yeet attempt journal "${journalPath}".`)));
      yield* file.sync.pipe(
        Effect.mapError(QualitySchedulerError.new(`Failed to sync Yeet attempt journal "${journalPath}".`))
      );
    })
  );
});

const reconcileJournalLocked = Effect.fn("AttemptTerminationJournal.reconcileLocked")(function* (
  journalPath: string
): Effect.fn.Return<number, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const lines = pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
  const events = yield* Effect.forEach(lines, (line) =>
    decodeRetentionEvent(line).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to decode Yeet attempt journal "${journalPath}".`))
    )
  );
  const terminalAttemptIds = A.map(
    A.filter(events, AttemptJournalRetentionEvent.isAnyOf(["attempt-finished", "attempt-terminated"])),
    (event) => event.attemptId
  );
  const unfinishedStarts = A.filter(
    A.filter(events, AttemptJournalRetentionEvent.guards["attempt-started"]),
    (event) => !A.contains(terminalAttemptIds, event.attemptId)
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const terminalLines = A.getSomes(
    yield* Effect.forEach(unfinishedStarts, (started) =>
      pipe(
        O.all({ pid: started.ownerPid, procStart: started.ownerProcStart }),
        O.match({
          onNone: () => Effect.succeedNone,
          onSome: (owner) =>
            processIdentityStatus(owner).pipe(
              Effect.flatMap((status) =>
                ProcessIdentityStatus.is.dead(status)
                  ? encodeSchedulerTermination({
                      schemaVersion: "yeet-attempt-journal/v1",
                      _tag: "attempt-terminated",
                      attemptId: started.attemptId,
                      recordedAt,
                      reason: "owner-dead",
                      resolvedHeadSha: started.resolvedHeadSha,
                      diffFingerprint: started.diffFingerprint,
                      proofTier: started.proofTier,
                      envProfile: started.envProfile,
                      stage: started.stage,
                    }).pipe(
                      Effect.mapError(QualitySchedulerError.new("Failed to encode reconciled attempt terminal event.")),
                      Effect.asSome
                    )
                  : Effect.succeedNone
              )
            ),
        })
      )
    )
  );
  yield* appendLinesLocked(journalPath, terminalLines);
  return A.length(terminalLines);
});

/**
 * Close unfinished attempt starts whose PID/start-time owner is proven dead.
 *
 * **Details**
 *
 * Live and temporarily unverifiable owners remain open. The operation takes
 * the same owned-generation lock used by appenders, so concurrent opens cannot
 * record the same `owner-dead` terminal twice.
 *
 * **Example** (Reference the reconciler)
 *
 * ```ts
 * import { reconcileAttemptJournal } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof reconcileAttemptJournal) // "function"
 * ```
 *
 * @param journalPath - Absolute branch-scoped attempt journal path.
 * @returns The number of `owner-dead` terminal rows appended.
 * @category utilities
 * @since 0.0.0
 */
export const reconcileAttemptJournal = Effect.fn("AttemptTerminationJournal.reconcile")(function* (
  journalPath: string
): Effect.fn.Return<number, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(journalPath).pipe(Effect.orElseSucceed(constant(false))))) {
    return 0;
  }
  const lockPath = `${journalPath}.lock`;
  const lockToken = `${process.pid}:${randomUUID()}`;
  if (!(yield* acquireJournalFileLock(lockPath, lockToken, LOCK_RETRY_ATTEMPTS))) {
    return yield* QualitySchedulerError.make({
      message: `Yeet attempt journal lock "${lockPath}" stayed busy; could not reconcile owners.`,
    });
  }
  return yield* Effect.ensuring(
    Effect.gen(function* () {
      yield* repairTornJournal(journalPath);
      const reconciled = yield* reconcileJournalLocked(journalPath);
      yield* compactJournal(journalPath);
      return reconciled;
    }),
    releaseJournalFileLock(lockPath, lockToken)
  );
});

/**
 * Reconcile every branch attempt journal beneath one checkout.
 *
 * **Example** (Reference checkout reconciliation)
 *
 * ```ts
 * import { reconcileAttemptJournalsForCheckout } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof reconcileAttemptJournalsForCheckout) // "function"
 * ```
 *
 * @param checkoutRoot - Checkout whose `.beep/yeet/runs` journals are scanned.
 * @returns The total number of `owner-dead` terminal rows appended.
 * @category utilities
 * @since 0.0.0
 */
export const reconcileAttemptJournalsForCheckout = Effect.fn("AttemptTerminationJournal.reconcileCheckout")(function* (
  checkoutRoot: string
): Effect.fn.Return<number, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsRoot = path.join(checkoutRoot, ".beep", "yeet", "runs");
  if (!(yield* fs.exists(runsRoot).pipe(Effect.orElseSucceed(constant(false))))) {
    return 0;
  }
  const journalPaths = pipe(
    yield* fs
      .readDirectory(runsRoot, { recursive: true })
      .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to scan Yeet attempt journals in "${runsRoot}".`))),
    A.filter(Str.endsWith(JOURNAL_FILE_NAME)),
    A.map((entry) => path.join(runsRoot, entry))
  );
  return A.reduce(
    yield* Effect.forEach(journalPaths, reconcileAttemptJournal, { concurrency: 1 }),
    0,
    (total, reconciled) => total + reconciled
  );
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
    yield* journalExists ? repairTornJournal(journalPath) : Effect.void;
    yield* appendLinesLocked(journalPath, [line]);
    yield* reconcileJournalLocked(journalPath);
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
 * @param owner - Ticket or lease carrying the immutable attempt facts.
 * @param attemptId - Stable attempt identifier shared with the admission row.
 * @param reason - Admission death reason that ended the attempt abnormally.
 * @returns An effect that durably appends the terminal row.
 * @category utilities
 * @since 0.0.0
 */
export const appendSchedulerAttemptTerminated = Effect.fn("AttemptTerminationJournal.appendSchedulerTerminated")(
  function* (
    owner: YeetAdmissionLease | YeetAdmissionTicket,
    attemptId: UUID,
    reason: "lease-eviction" | "queued-submitter-death"
  ): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
    const journalPath = yield* attemptJournalPathForCheckout(owner.checkoutRoot, owner.branch);
    const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const line = yield* encodeSchedulerTermination({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-terminated",
      attemptId,
      recordedAt,
      reason,
      resolvedHeadSha: owner.resolvedHeadSha,
      diffFingerprint: owner.diffFingerprint,
      proofTier: owner.proofTier,
      envProfile: owner.envProfile,
      stage: owner.stage,
    }).pipe(Effect.mapError(QualitySchedulerError.new("Failed to encode scheduler attempt terminal event.")));
    yield* appendEncodedAttemptJournalEvent(journalPath, line, "attempt-terminated");
  }
);
