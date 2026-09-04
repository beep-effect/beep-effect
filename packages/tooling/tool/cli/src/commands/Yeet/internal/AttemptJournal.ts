/**
 * Branch-scoped append-only Yeet attempt journal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  appendEncodedAttemptJournalEvent,
  YeetAttemptJournalCompacted,
  YeetAttemptTerminationReason,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { attemptInputFactFields } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { YeetVerdict } from "./Verdict.ts";
import type { FileSystem, Path } from "effect";
import type * as SchemaAST from "effect/SchemaAST";
import type { RepoRunContext } from "../../../internal/repo-run/RepoRun.models.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";

export { YeetAttemptJournalCompacted, YeetAttemptTerminationReason };

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
    ownerPid: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ownerProcStart: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ...attemptInputFactFields,
  },
  $I.annote("YeetAttemptStarted", {
    description: "A durable marker written immediately before a Yeet attempt executes.",
  })
) {}

/**
 * Normal terminal marker embedding the exact verdict written for an attempt.
 *
 * **Details**
 *
 * Successful and failed command completions use this stable event. Abnormal
 * ends without a complete verdict use {@link YeetAttemptTerminated} instead.
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
    description: "Normal terminal marker embedding the exact verdict written for a completed attempt.",
  })
) {}

/**
 * Abnormal terminal marker for a Yeet attempt, including interrupts.
 *
 * **Details**
 *
 * Normal success and failure completions use {@link YeetAttemptFinished}. This
 * marker records interruption, signal, queued-submitter death, lease eviction,
 * or another path that ended before the normal verdict could be retained.
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
    description: "Abnormal terminal marker for an attempt that could not retain an ordinary finished row.",
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
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode Yeet attempt journal event."))
  );
  const journalPath = yield* attemptJournalPath(context);
  yield* appendEncodedAttemptJournalEvent(journalPath, line, event._tag).pipe(
    Effect.mapError(YeetCommandError.new("Failed to append Yeet attempt journal event."))
  );
});
