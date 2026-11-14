/**
 * Branch-scoped append-only Yeet attempt journal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeOS from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { UUID } from "@beep/repo-cli-kit/schema/Uuid";
import { SchemaUtils } from "@beep/schema";
import * as Config from "effect/Config";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HostLabel, hostLabelOf } from "../../../internal/github/GithubLedger.schemas.ts";
import {
  appendEncodedAttemptJournalEvent,
  attemptJournalPathForCheckout,
  YeetAttemptJournalCompacted,
  YeetAttemptTerminationReason,
} from "../../../internal/repo-run/AttemptTerminationJournal.ts";
import { attemptInputFactFields } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import { PrProvenanceHarness } from "./Provenance.ts";
import { TurboForceReceipt } from "./TurboForce.ts";
import { YeetVerdict } from "./Verdict.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type * as SchemaAST from "effect/SchemaAST";
import type { RepoRunContext } from "../../../internal/repo-run/RepoRun.models.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournal");
const JOURNAL_FILE_NAME = "attempts.ndjson";

export { YeetAttemptJournalCompacted, YeetAttemptTerminationReason };

/**
 * A durable marker written immediately before a Yeet attempt executes.
 *
 * **Details**
 *
 * `host` and `seat` (PERIL-11 slice 3) name where the attempt ran: the
 * writer's short host label ({@link hostLabelOf}) and the agent harness whose
 * shell started it, in the PR provenance footer's vocabulary
 * ({@link PrProvenanceHarness}). Both are optional keys, so rows written before
 * they existed decode with them absent, and readers that predate them ignore
 * them as excess keys.
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
export class YeetAttemptStarted extends S.Opaque<YeetAttemptStarted, { readonly brand: unique symbol }>()(
  S.TaggedStruct("attempt-started", {
    schemaVersion: S.tag("yeet-attempt-journal/v1"),

    attemptId: UUID,
    runId: S.String,
    branch: S.String,
    base: S.String,
    head: S.String,
    mode: S.String,
    startedAt: S.String,
    ownerPid: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ownerProcStart: S.String.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ...attemptInputFactFields,
    // Set only when `--force-local` kept a worker-profile publish local.
    forceLocal: S.Boolean.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    // Set on repair, verify and publish attempts: why Turbo was forced, and the TURB-05 shadow.
    // Rows written before the field existed decode with it absent.
    turboForce: TurboForceReceipt.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    // PERIL-11 slice 3: the writer's host label and agent seat; absent on older rows.
    host: HostLabel.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    seat: PrProvenanceHarness.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetAttemptStarted", {
      description: "A durable marker written immediately before a Yeet attempt executes.",
    })
  )
) {}

/**
 * Normal terminal marker embedding the exact verdict written for an attempt.
 *
 * **Details**
 *
 * Successful and failed command completions use this stable event. Abnormal
 * ends without a complete verdict use {@link YeetAttemptTerminated} instead.
 *
 * A `yeet final-check` attempt (verdict mode `final-check`) that wrote its
 * head receipt also carries that exact receipt in `finalCheckReceipt`. The
 * per-head receipt file is overwritten by every run on the head, so these rows
 * are the per-run receipt history; `yeet ready` still reads only the head file.
 * Rows written before the field existed decode with it absent.
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
export class YeetAttemptFinished extends S.Opaque<YeetAttemptFinished, { readonly brand: unique symbol }>()(
  S.TaggedStruct("attempt-finished", {
    schemaVersion: S.tag("yeet-attempt-journal/v1"),

    attemptId: UUID,
    recordedAt: S.String,
    verdict: YeetVerdict,
    ...attemptInputFactFields,
    finalCheckReceipt: FinalCheckReceipt.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("YeetAttemptFinished", {
      description: "Normal terminal marker embedding the exact verdict written for a completed attempt.",
    })
  )
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
export class YeetAttemptTerminated extends S.Opaque<YeetAttemptTerminated, { readonly brand: unique symbol }>()(
  S.TaggedStruct("attempt-terminated", {
    schemaVersion: S.tag("yeet-attempt-journal/v1"),

    attemptId: UUID,
    recordedAt: S.String,
    reason: YeetAttemptTerminationReason,
    verdict: YeetVerdict.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    ...attemptInputFactFields,
  }).pipe(
    $I.annoteSchema("YeetAttemptTerminated", {
      description: "Abnormal terminal marker for an attempt that could not retain an ordinary finished row.",
    })
  )
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
export const attemptJournalPath = (
  context: RepoRunContext
): Effect.Effect<string, YeetCommandError, Path.Path | Digest.Digest> =>
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
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | Digest.Digest
> {
  const line = yield* encodeJournalLine(event);
  const journalPath = yield* attemptJournalPath(context);
  yield* appendJournalLine(journalPath, line, event);
});

const encodeJournalLine = (event: YeetAttemptJournalEvent) =>
  encodeEvent(event).pipe(Effect.mapError(YeetCommandError.new("Failed to encode Yeet attempt journal event.")));

const appendJournalLine = (journalPath: string, line: string, event: YeetAttemptJournalEvent) =>
  appendEncodedAttemptJournalEvent(journalPath, line, event._tag).pipe(
    Effect.mapError(YeetCommandError.new("Failed to append Yeet attempt journal event."))
  );

/**
 * Append an attempt event to a checkout's branch journal without a repo-run context.
 *
 * **Details**
 *
 * Commands that run outside a Yeet plan, such as `yeet final-check`, write to
 * the same `.beep/yeet/runs/<runId>/attempts.ndjson` file the scheduler and
 * proof jobs address through `attemptJournalPathForCheckout`, under the same
 * lock, torn-tail repair, owner reconciliation and bounded retention.
 *
 * **Example** (Append a final-check start row)
 *
 * ```ts
 * import { appendYeetAttemptJournalEventForCheckout, YeetAttemptStarted } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const started = YeetAttemptStarted.make({
 *   schemaVersion: "yeet-attempt-journal/v1",
 *   _tag: "attempt-started",
 *   attemptId: "550e8400-e29b-41d4-a716-446655440000",
 *   runId: "feature-0123456789ab",
 *   branch: "feature",
 *   base: "origin/main",
 *   head: "a".repeat(40),
 *   mode: "final-check",
 *   startedAt: "2026-11-12T00:00:00.000Z",
 * })
 * console.log(Effect.isEffect(appendYeetAttemptJournalEventForCheckout("/repo", "feature", started))) // true
 * ```
 *
 * @param checkoutRoot - Checkout that owns the attempt journal.
 * @param branch - Branch whose run directory holds the journal.
 * @param event - The journal event to append.
 * @returns An effect that appends and compacts the branch journal.
 * @category utilities
 * @since 0.0.0
 */
export const appendYeetAttemptJournalEventForCheckout = Effect.fn("YeetAttemptJournal.appendForCheckout")(function* (
  checkoutRoot: string,
  branch: string,
  event: YeetAttemptJournalEvent
): Effect.fn.Return<
  void,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | Digest.Digest
> {
  const line = yield* encodeJournalLine(event);
  const journalPath = yield* attemptJournalPathForCheckout(checkoutRoot, branch).pipe(
    Effect.mapError(YeetCommandError.new("Failed to resolve the Yeet attempt journal path."))
  );
  yield* appendJournalLine(journalPath, line, event);
});

const decodeAttemptId = S.decodeEffect(UUID);

/**
 * Generate a fresh attempt id for a journaled Yeet attempt.
 *
 * **Example** (Generate an attempt id)
 *
 * ```ts
 * import { generateYeetAttemptId } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(generateYeetAttemptId())) // true
 * ```
 *
 * @returns A random UUID v4 attempt id.
 * @category utilities
 * @since 0.0.0
 */
export const generateYeetAttemptId = Effect.fn("Yeet.generateAttemptId")(function* (): Effect.fn.Return<
  UUID,
  YeetCommandError,
  SecureRandom.SecureRandom
> {
  const crypto = yield* SecureRandom.SecureRandom;
  return yield* crypto
    .uuidV4()
    .pipe(
      Effect.flatMap(decodeAttemptId),
      Effect.mapError(YeetCommandError.new("Failed to generate Yeet attempt id."))
    );
});

const optionalConfigString = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>));

/**
 * The `host` and `seat` a new attempt-started row carries.
 *
 * **Details**
 *
 * `host` is this machine's short host label (`unknown-host` when the
 * hostname is not a valid label). `seat` follows the PR provenance footer's
 * fallback order: `codex` when `CODEX_THREAD_ID` is set (a Codex shell, even
 * one a Claude Code session launched), else `claude-code` when
 * `CLAUDE_CODE_SESSION_ID` is set, else `unknown`. Session ids are read only
 * to tell the harness apart and are never stored.
 *
 * **Example** (Stamp a start row)
 *
 * ```ts
 * import { currentYeetAttemptOrigin } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(currentYeetAttemptOrigin)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const currentYeetAttemptOrigin: Effect.Effect<{
  readonly host: O.Option<HostLabel>;
  readonly seat: O.Option<PrProvenanceHarness>;
}> = Effect.gen(function* () {
  const codex = yield* optionalConfigString("CODEX_THREAD_ID");
  const claude = yield* optionalConfigString("CLAUDE_CODE_SESSION_ID");
  const seat: PrProvenanceHarness = pipe(
    O.as(codex, PrProvenanceHarness.Enum.codex),
    O.orElse(() => O.as(claude, PrProvenanceHarness.Enum["claude-code"])),
    O.getOrElse(() => PrProvenanceHarness.Enum.unknown)
  );
  return { host: O.some(hostLabelOf(NodeOS.hostname())), seat: O.some(seat) };
});
