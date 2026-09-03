/**
 * Branch-scoped append-only Yeet attempt journal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Console, DateTime, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { YeetProofTier } from "./Planner.ts";
import { YeetVerdict } from "./Verdict.ts";
import type * as SchemaAST from "effect/SchemaAST";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";
const RETAINED_ROWS = 50;
const textEncoder = new TextEncoder();

const attemptInputFactFields = {
  resolvedHeadSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  diffFingerprint: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  proofTier: YeetProofTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
};

/**
 * A durable marker written immediately before a Yeet attempt executes.
 *
 * **Example** (Use YeetAttemptStarted)
 *
 * ```ts
 * import { YeetAttemptStarted } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof YeetAttemptStarted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAttemptStarted extends S.Class<YeetAttemptStarted>($I`YeetAttemptStarted`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("attempt-started"),
    attemptId: UUID,
    runId: S.String,
    branch: S.String,
    base: S.String,
    head: S.String,
    mode: S.String,
    startedAt: S.String,
    ...attemptInputFactFields,
  },
  $I.annote("YeetAttemptStarted", {
    description: "A durable marker written immediately before a Yeet attempt executes.",
  })
) {}

/**
 * Legacy terminal marker embedding the exact verdict written for an attempt.
 *
 * **Details**
 *
 * Current writers emit {@link YeetAttemptTerminated}; this variant remains in
 * the union so journals written before guaranteed interruption handling decode.
 *
 * **Example** (Use YeetAttemptFinished)
 *
 * ```ts
 * import { YeetAttemptFinished } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof YeetAttemptFinished)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAttemptFinished extends S.Class<YeetAttemptFinished>($I`YeetAttemptFinished`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("attempt-finished"),
    attemptId: UUID,
    recordedAt: S.String,
    verdict: YeetVerdict,
    ...attemptInputFactFields,
  },
  $I.annote("YeetAttemptFinished", {
    description: "Legacy terminal marker retained for decoding compatibility with prior attempt journals.",
  })
) {}

/**
 * Terminal reason retained for every completed or interrupted Yeet attempt.
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
export const YeetAttemptTerminationReason = LiteralKit(["success", "failure", "interrupted"]).pipe(
  $I.annoteSchema("YeetAttemptTerminationReason", {
    description: "Terminal reason retained for a completed or interrupted Yeet attempt.",
  })
);

/**
 * Terminal reason retained for a completed or interrupted Yeet attempt.
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
 * Guaranteed terminal marker for a Yeet attempt, including interrupts.
 *
 * **Details**
 *
 * Successful and failed attempts carry their verdict; an interruption can
 * terminate before a complete verdict exists and therefore leaves it absent.
 *
 * **Example** (Reference a terminal attempt row)
 *
 * ```ts
 * import { YeetAttemptTerminated } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof YeetAttemptTerminated) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class YeetAttemptTerminated extends S.Class<YeetAttemptTerminated>($I`YeetAttemptTerminated`)(
  {
    schemaVersion: S.Literal("yeet-attempt-journal/v1"),
    _tag: S.Literal("attempt-terminated"),
    attemptId: UUID,
    recordedAt: S.String,
    reason: YeetAttemptTerminationReason,
    verdict: YeetVerdict.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ...attemptInputFactFields,
  },
  $I.annote("YeetAttemptTerminated", {
    description: "Guaranteed terminal marker for a Yeet attempt, including process interruption.",
  })
) {}

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

/**
 * Schema-decoded event stored in a branch-scoped Yeet attempt journal.
 *
 * **Example** (Use YeetAttemptJournalEvent)
 *
 * ```ts
 * import { YeetAttemptJournalEvent } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof YeetAttemptJournalEvent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetAttemptJournalEvent = S.Union([
  YeetAttemptStarted,
  YeetAttemptFinished,
  YeetAttemptTerminated,
  YeetAttemptJournalCompacted,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("YeetAttemptJournalEvent", {
    description: "Schema-decoded event stored in a branch-scoped Yeet attempt journal.",
  })
);

/**
 * Decoded type of {@link YeetAttemptJournalEvent}.
 *
 * **Example** (Use YeetAttemptJournalEvent)
 *
 * ```ts
 * import type { YeetAttemptJournalEvent } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * const dump = (event: YeetAttemptJournalEvent) => event._tag
 * console.log(typeof dump)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type YeetAttemptJournalEvent = typeof YeetAttemptJournalEvent.Type;

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));
/**
 * Decode one journal line into a {@link YeetAttemptJournalEvent}.
 *
 * **Example** (Use decodeYeetAttemptJournalEvent)
 *
 * ```ts
 * import { decodeYeetAttemptJournalEvent } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof decodeYeetAttemptJournalEvent)
 * ```
 *
 * @param u - One raw NDJSON journal line.
 * @returns The decoded journal event effect.
 * @category decoding
 * @since 0.0.0
 */
export const decodeYeetAttemptJournalEvent: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<YeetAttemptJournalEvent, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<YeetAttemptJournalEvent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent)));

/**
 * Resolve the branch-scoped attempt journal path.
 *
 * **Example** (Use attemptJournalPath)
 *
 * ```ts
 * import { attemptJournalPath } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof attemptJournalPath)
 * ```
 *
 * @param context - The active repo-run context.
 * @returns The journal file path effect.
 * @category utilities
 * @since 0.0.0
 */
export const attemptJournalPath = (context: RepoRunContext): Effect.Effect<string, never, Path.Path> =>
  runArtifactPathForContext(context, JOURNAL_FILE_NAME);

const hasTornTrailingRecord = (lines: ReadonlyArray<string>): Effect.Effect<boolean> =>
  pipe(
    A.last(lines),
    O.match({
      onNone: constant(Effect.succeed(false)),
      onSome: (line) =>
        decodeYeetAttemptJournalEvent(line).pipe(
          Effect.as(false),
          Effect.orElseSucceed(() => true)
        ),
    })
  );

const eventRecordedAt = (event: YeetAttemptJournalEvent): string =>
  YeetAttemptJournalEvent.match(event, {
    "attempt-started": (started) => started.startedAt,
    "attempt-finished": (finished) => finished.recordedAt,
    "attempt-terminated": (terminated) => terminated.recordedAt,
    "journal-compacted": (compacted) => compacted.recordedAt,
  });

const compactJournal = Effect.fn("YeetAttemptJournal.compact")(function* (
  journalPath: string
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  // A host that dies mid-append leaves a torn final record; dropping it keeps the
  // journal usable instead of failing every later attempt on the same bad line.
  const torn = yield* hasTornTrailingRecord(rawLines);
  if (torn) {
    yield* Console.warn(`[yeet] dropped a torn trailing record from the Yeet attempt journal "${journalPath}"`);
  }
  const lines = torn ? A.dropRight(rawLines, 1) : rawLines;
  const events = yield* Effect.forEach(lines, (line) =>
    decodeYeetAttemptJournalEvent(line).pipe(
      Effect.mapError(YeetCommandError.new(`Failed to decode Yeet attempt journal "${journalPath}".`))
    )
  );
  if (!torn && A.length(events) <= RETAINED_ROWS) {
    return;
  }
  const requiresReceipt = A.length(events) > RETAINED_ROWS;
  const attemptRows = pipe(
    A.zip(events, lines),
    A.filter(([event]) => event._tag !== "journal-compacted")
  );
  const retainedRows = requiresReceipt ? A.takeRight(attemptRows, RETAINED_ROWS - 1) : attemptRows;
  const retainedLines = requiresReceipt ? A.map(retainedRows, ([, line]) => line) : lines;
  const evictedCount = requiresReceipt ? A.length(events) - A.length(retainedRows) : 0;
  const recordedAt = requiresReceipt ? yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)) : Str.empty;
  const receiptLines = requiresReceipt
    ? A.of(
        yield* encodeEvent(
          YeetAttemptJournalCompacted.make({
            schemaVersion: "yeet-attempt-journal/v1",
            _tag: "journal-compacted",
            recordedAt,
            evictedCount: NonNegativeInt.make(evictedCount),
            oldestEvictedRecordedAt: pipe(
              A.appendAll(
                A.filter(events, YeetAttemptJournalEvent.guards["journal-compacted"]),
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
        ).pipe(Effect.mapError(YeetCommandError.new("Failed to encode Yeet attempt journal compaction receipt.")))
      )
    : A.empty<string>();
  yield* fs
    .writeFileString(
      journalPath,
      pipe(
        A.appendAll(retainedLines, receiptLines),
        A.map((line) => `${line}\n`),
        A.join(Str.empty)
      )
    )
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to compact Yeet attempt journal "${journalPath}".`)));
});

/**
 * Append, sync, validate, and retain the newest bounded set of attempt events.
 *
 * **Example** (Use appendYeetAttemptJournalEvent)
 *
 * ```ts
 * import { appendYeetAttemptJournalEvent } from "@beep/repo-cli/commands/Yeet/internal/AttemptJournal"
 *
 * console.log(typeof appendYeetAttemptJournalEvent)
 * ```
 *
 * @param context - The active repo-run context.
 * @param event - The journal event to append.
 * @returns An effect that appends and compacts the branch journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendYeetAttemptJournalEvent = Effect.fn("YeetAttemptJournal.append")(function* (
  context: RepoRunContext,
  event: YeetAttemptJournalEvent
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journalPath = yield* attemptJournalPath(context);
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode Yeet attempt journal event."))
  );
  yield* fs
    .makeDirectory(path.dirname(journalPath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create Yeet attempt journal directory.`)));
  const journalExists = yield* fs.exists(journalPath).pipe(Effect.orElseSucceed(constant(false)));
  yield* journalExists ? compactJournal(journalPath) : Effect.void;
  yield* Effect.scoped(
    Effect.gen(function* () {
      const file = yield* fs
        .open(journalPath, { flag: "a" })
        .pipe(Effect.mapError(YeetCommandError.new(`Failed to open Yeet attempt journal "${journalPath}".`)));
      yield* file
        .writeAll(textEncoder.encode(`${line}\n`))
        .pipe(Effect.mapError(YeetCommandError.new(`Failed to append Yeet attempt journal "${journalPath}".`)));
      yield* file.sync.pipe(
        Effect.mapError(YeetCommandError.new(`Failed to sync Yeet attempt journal "${journalPath}".`))
      );
    })
  );
  yield* compactJournal(journalPath);
});
