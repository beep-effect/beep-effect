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
import { Clock, Console, DateTime, Duration, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { acquireJournalFileLock, releaseJournalFileLock } from "./AdmissionJournal.ts";
import { publishJournalTextAtomically } from "./JournalFile.ts";
import { ProcessIdentityStatus, processIdentityStatus } from "./ProcessIdentity.ts";
import { attemptInputFactFields, QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import { repoRunArtifactId } from "./RepoRunArtifacts.ts";
import type { UUID } from "@beep/schema/String";
import type { YeetAdmissionLease, YeetAdmissionTicket } from "./QualityScheduler.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/AttemptTerminationJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";
const RETAINED_ATTEMPTS = 50;
const LOCK_RETRY_ATTEMPTS = 400;
const PID_ONLY_OWNER_MAX_AGE = Duration.hours(24);
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
  "legacy-unowned-start",
  "stale-unverifiable-owner",
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
    evictedAttemptIds: S.Array(UUIDSchema).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<UUID>())),
      S.withDecodingDefault(Effect.succeed(A.empty<UUID>()))
    ),
    oldestEvictedRecordedAt: S.String,
    terminalEvictionCutoffRecordedAt: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
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
const decodeJsonRecord = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
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

const hasTornTrailingRecord = (text: string, lines: ReadonlyArray<string>): Effect.Effect<boolean> =>
  Str.endsWith("\n")(text)
    ? Effect.succeed(false)
    : pipe(
        A.last(lines),
        O.match({
          onNone: constant(Effect.succeed(false)),
          onSome: (line) =>
            decodeJsonRecord(line).pipe(
              Effect.as(false),
              Effect.orElseSucceed(() => true)
            ),
        })
      );

interface JournalLine {
  readonly event: O.Option<AttemptJournalRetentionEvent>;
  readonly line: string;
}

const decodeJournalLines = (lines: ReadonlyArray<string>) =>
  Effect.forEach(lines, (line) =>
    decodeRetentionEvent(line).pipe(
      Effect.option,
      Effect.map((event): JournalLine => ({ event, line }))
    )
  );

const knownJournalEvents = (rows: ReadonlyArray<JournalLine>): ReadonlyArray<AttemptJournalRetentionEvent> =>
  A.getSomes(A.map(rows, ({ event }) => event));

const terminalAttemptIds: (events: ReadonlyArray<AttemptJournalRetentionEvent>) => ReadonlyArray<UUID> = flow(
  A.filter(AttemptJournalRetentionEvent.isAnyOf(["attempt-finished", "attempt-terminated"])),
  A.map((event) => event.attemptId),
  A.dedupe
);

const eventRecordedAt = (event: AttemptJournalRetentionEvent): string =>
  event._tag === "attempt-started" ? event.startedAt : event.recordedAt;

const retainedJournalLines = Effect.fn("AttemptTerminationJournal.retainedLines")(function* (
  rows: ReadonlyArray<JournalLine>,
  protectedAttemptIds: ReadonlyArray<UUID>
) {
  const events = knownJournalEvents(rows);
  const attemptRows = A.getSomes(
    A.map(rows, ({ event, line }) =>
      pipe(
        event,
        O.filter((known) => !AttemptJournalRetentionEvent.guards["journal-compacted"](known)),
        O.map((known) => ({ event: known, line }))
      )
    )
  );
  const terminals = terminalAttemptIds(events);
  const oldestRecordedAtForAttempt = (attemptId: UUID) =>
    pipe(
      attemptRows,
      A.filter(({ event }) => event.attemptId === attemptId),
      A.map(({ event }) => eventRecordedAt(event)),
      A.sort(Order.String),
      A.head,
      O.getOrElse(constant(Str.empty))
    );
  const oldestFirst = (attemptIds: ReadonlyArray<UUID>) =>
    A.sortWith(attemptIds, oldestRecordedAtForAttempt, Order.String);
  const protectedTerminalAttemptIds = A.filter(terminals, (attemptId) => A.contains(protectedAttemptIds, attemptId));
  if (A.length(protectedTerminalAttemptIds) > RETAINED_ATTEMPTS) {
    return A.map(rows, ({ line }) => line);
  }
  const evictableTerminalAttemptIds = oldestFirst(
    A.filter(terminals, (attemptId) => !A.contains(protectedTerminalAttemptIds, attemptId))
  );
  const unprotectedCapacity = RETAINED_ATTEMPTS - A.length(protectedTerminalAttemptIds);
  const evictedAttemptIds = A.take(
    evictableTerminalAttemptIds,
    A.length(evictableTerminalAttemptIds) - unprotectedCapacity
  );
  const previousReceipts = A.filter(events, AttemptJournalRetentionEvent.guards["journal-compacted"]);
  const retainedLines = A.getSomes(
    A.map(rows, ({ event, line }) =>
      pipe(
        event,
        O.match({
          onNone: () => O.some(line),
          onSome: (known) =>
            AttemptJournalRetentionEvent.guards["journal-compacted"](known) ||
            A.contains(evictedAttemptIds, known.attemptId)
              ? O.none()
              : O.some(line),
        })
      )
    )
  );
  const evictedEvents = A.map(
    A.filter(attemptRows, ({ event }) => A.contains(evictedAttemptIds, event.attemptId)),
    ({ event }) => event
  );
  const evictedTerminalEvents = A.filter(
    evictedEvents,
    AttemptJournalRetentionEvent.isAnyOf(["attempt-finished", "attempt-terminated"])
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const previousCutoffs = A.map(previousReceipts, (receipt) =>
    O.getOrElse(receipt.terminalEvictionCutoffRecordedAt, () => receipt.oldestEvictedRecordedAt)
  );
  const cutoff = pipe(
    A.appendAll(previousCutoffs, A.map(evictedTerminalEvents, eventRecordedAt)),
    A.sort(Order.String),
    A.last,
    O.getOrElse(constant(recordedAt))
  );
  const receipt = yield* encodeCompactionReceipt(
    YeetAttemptJournalCompacted.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "journal-compacted",
      recordedAt,
      evictedCount: NonNegativeInt.make(
        A.reduce(previousReceipts, A.length(evictedEvents), (total, previous) => total + previous.evictedCount)
      ),
      evictedAttemptIds: A.dedupe(
        A.appendAll(
          A.flatMap(previousReceipts, (previous) => previous.evictedAttemptIds),
          evictedAttemptIds
        )
      ),
      oldestEvictedRecordedAt: pipe(
        A.appendAll(
          A.map(previousReceipts, (previous) => previous.oldestEvictedRecordedAt),
          A.map(evictedEvents, eventRecordedAt)
        ),
        A.sort(Order.String),
        A.head,
        O.getOrElse(constant(recordedAt))
      ),
      terminalEvictionCutoffRecordedAt: O.some(cutoff),
    })
  ).pipe(Effect.mapError(QualitySchedulerError.new("Failed to encode Yeet attempt journal compaction receipt.")));
  return A.append(retainedLines, receipt);
});

interface ClassifiedJournalLines {
  readonly lines: ReadonlyArray<string>;
  readonly needsTrailingNewline: boolean;
  readonly rows: ReadonlyArray<JournalLine>;
  readonly torn: boolean;
}

const classifyJournalLines = Effect.fn("AttemptTerminationJournal.classifyLines")(function* (
  journalPath: string,
  text: string
): Effect.fn.Return<ClassifiedJournalLines> {
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  // Only invalid JSON at an unterminated EOF is torn. Complete unknown or
  // corrupt records remain opaque rows and survive every rewrite verbatim.
  const torn = yield* hasTornTrailingRecord(text, rawLines);
  yield* Effect.when(
    Console.warn(`[yeet] dropped a torn trailing record from the Yeet attempt journal "${journalPath}"`),
    Effect.succeed(torn)
  );
  const lines = torn ? A.dropRight(rawLines, 1) : rawLines;
  return {
    lines,
    needsTrailingNewline: Str.isNonEmpty(text) && !Str.endsWith("\n")(text),
    rows: yield* decodeJournalLines(lines),
    torn,
  };
});

const retainedLinesForNormalization = Effect.fn("AttemptTerminationJournal.retainedSet")(function* (
  classified: ClassifiedJournalLines,
  retainRows: boolean,
  protectedAttemptIds: ReadonlyArray<UUID>
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, QualitySchedulerError> {
  const exceedsRetention = A.length(terminalAttemptIds(knownJournalEvents(classified.rows))) > RETAINED_ATTEMPTS;
  if (!classified.torn && !classified.needsTrailingNewline && (!retainRows || !exceedsRetention)) {
    return O.none();
  }
  if (retainRows && exceedsRetention) {
    return O.some(yield* retainedJournalLines(classified.rows, protectedAttemptIds));
  }
  return O.some(classified.lines);
});

const normalizeJournal = Effect.fn("AttemptTerminationJournal.normalize")(function* (
  journalPath: string,
  retainRows: boolean,
  protectedAttemptIds: ReadonlyArray<UUID> = A.empty()
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const classified = yield* classifyJournalLines(journalPath, text);
  const retainedLines = yield* retainedLinesForNormalization(classified, retainRows, protectedAttemptIds);
  yield* O.match(retainedLines, {
    onNone: () => Effect.void,
    onSome: (lines) =>
      publishJournalTextAtomically(
        journalPath,
        pipe(
          lines,
          A.map((line) => `${line}\n`),
          A.join(Str.empty)
        ),
        "Yeet attempt journal"
      ),
  });
});

const repairTornJournal = (journalPath: string) => normalizeJournal(journalPath, false);

const compactJournal = (journalPath: string, protectedAttemptIds: ReadonlyArray<UUID> = A.empty()) =>
  normalizeJournal(journalPath, true, protectedAttemptIds);

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

interface AttemptOwnerFacts {
  readonly ownerPid: O.Option<number>;
  readonly ownerProcStart: O.Option<string>;
  readonly startedAt: string;
}

const unfinishedStartTerminationReason = Effect.fnUntraced(function* (
  started: AttemptOwnerFacts
): Effect.fn.Return<O.Option<YeetAttemptTerminationReason>, never, FileSystem.FileSystem> {
  if (O.isNone(started.ownerPid)) {
    return O.some("legacy-unowned-start");
  }
  const ownerStatus = yield* processIdentityStatus({
    pid: started.ownerPid.value,
    procStart: O.getOrElse(started.ownerProcStart, constant(Str.empty)),
  });
  if (ProcessIdentityStatus.is.dead(ownerStatus)) {
    return O.some("owner-dead");
  }
  if (O.isSome(started.ownerProcStart)) {
    return O.none();
  }
  const nowMillis = yield* Clock.currentTimeMillis;
  return pipe(
    DateTime.make(started.startedAt),
    O.filter((startedAt) => nowMillis - DateTime.toEpochMillis(startedAt) >= Duration.toMillis(PID_ONLY_OWNER_MAX_AGE)),
    O.map(constant<YeetAttemptTerminationReason>("stale-unverifiable-owner"))
  );
});

const reconcileJournalLocked = Effect.fn("AttemptTerminationJournal.reconcileLocked")(function* (
  journalPath: string
): Effect.fn.Return<ReadonlyArray<UUID>, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const lines = pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
  const events = knownJournalEvents(yield* decodeJournalLines(lines));
  const terminalIds = terminalAttemptIds(events);
  const unfinishedStarts = A.filter(
    A.filter(events, AttemptJournalRetentionEvent.guards["attempt-started"]),
    (event) => !A.contains(terminalIds, event.attemptId)
  );
  const recordedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const terminalRows = A.getSomes(
    yield* Effect.forEach(unfinishedStarts, (started) =>
      pipe(
        unfinishedStartTerminationReason(started),
        Effect.flatMap(
          O.match({
            onNone: () => Effect.succeedNone,
            onSome: (reason) =>
              encodeSchedulerTermination({
                schemaVersion: "yeet-attempt-journal/v1",
                _tag: "attempt-terminated",
                attemptId: started.attemptId,
                recordedAt,
                reason,
                resolvedHeadSha: started.resolvedHeadSha,
                diffFingerprint: started.diffFingerprint,
                proofTier: started.proofTier,
                envProfile: started.envProfile,
                stage: started.stage,
              }).pipe(
                Effect.mapError(QualitySchedulerError.new("Failed to encode reconciled attempt terminal event.")),
                Effect.map((line) => O.some({ attemptId: started.attemptId, line }))
              ),
          })
        )
      )
    )
  );
  yield* appendLinesLocked(
    journalPath,
    A.map(terminalRows, ({ line }) => line)
  );
  return A.map(terminalRows, ({ attemptId }) => attemptId);
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
): Effect.fn.Return<number, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
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
      const reconciledAttemptIds = yield* reconcileJournalLocked(journalPath);
      yield* compactJournal(journalPath, reconciledAttemptIds);
      return A.length(reconciledAttemptIds);
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
    const appendedEvent = yield* decodeRetentionEvent(line).pipe(
      Effect.mapError(QualitySchedulerError.new(`Failed to decode appended Yeet attempt ${eventTag} event.`))
    );
    const currentEvents = journalExists
      ? knownJournalEvents(
          yield* fs
            .readFileString(journalPath)
            .pipe(
              Effect.mapError(QualitySchedulerError.new(`Failed to read Yeet attempt journal "${journalPath}".`)),
              Effect.map(flow(Str.split("\n"), A.filter(Str.isNonEmpty))),
              Effect.flatMap(decodeJournalLines)
            )
        )
      : A.empty<AttemptJournalRetentionEvent>();
    const appendedTerminal = AttemptJournalRetentionEvent.isAnyOf(["attempt-finished", "attempt-terminated"])(
      appendedEvent
    );
    const terminalAlreadyExists =
      appendedTerminal && A.contains(terminalAttemptIds(currentEvents), appendedEvent.attemptId);
    yield* terminalAlreadyExists ? Effect.void : appendLinesLocked(journalPath, [line]);
    const reconciledAttemptIds = yield* reconcileJournalLocked(journalPath);
    const appendedAttemptIds =
      terminalAlreadyExists || AttemptJournalRetentionEvent.guards["journal-compacted"](appendedEvent)
        ? A.empty<UUID>()
        : [appendedEvent.attemptId];
    yield* compactJournal(journalPath, A.appendAll(reconciledAttemptIds, appendedAttemptIds));
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
