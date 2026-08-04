/**
 * Branch-scoped append-only Yeet attempt journal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { UUID } from "@beep/schema/String";
import { Effect, FileSystem, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { YeetVerdict } from "./Verdict.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";
const RETAINED_ATTEMPTS = 50;
const textEncoder = new TextEncoder();

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
  },
  $I.annote("YeetAttemptStarted", {
    description: "A durable marker written immediately before a Yeet attempt executes.",
  })
) {}

/**
 * A durable terminal marker embedding the exact verdict written for an attempt.
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
  },
  $I.annote("YeetAttemptFinished", {
    description: "A durable terminal marker embedding the exact verdict written for an attempt.",
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
export const YeetAttemptJournalEvent = S.Union([YeetAttemptStarted, YeetAttemptFinished]).pipe(
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
export const decodeYeetAttemptJournalEvent = S.decodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));

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

const compactJournal = Effect.fn("YeetAttemptJournal.compact")(function* (
  journalPath: string
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read Yeet attempt journal "${journalPath}".`)));
  const lines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  const events = yield* Effect.forEach(lines, (line) =>
    decodeYeetAttemptJournalEvent(line).pipe(
      Effect.mapError(YeetCommandError.new(`Failed to decode Yeet attempt journal "${journalPath}".`))
    )
  );
  const startIndexes = pipe(
    A.zip(events, A.range(0, A.length(events) - 1)),
    A.map(([event, index]) => (event._tag === "attempt-started" ? O.some(index) : O.none())),
    A.getSomes
  );
  if (A.length(startIndexes) <= RETAINED_ATTEMPTS) {
    return;
  }
  const firstRetainedIndex = pipe(
    startIndexes,
    A.takeRight(RETAINED_ATTEMPTS),
    A.head,
    O.getOrElse(() => 0)
  );
  yield* fs
    .writeFileString(journalPath, `${A.join(A.drop(lines, firstRetainedIndex), "\n")}\n`)
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
