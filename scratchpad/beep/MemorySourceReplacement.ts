/**
 * Committed receipt for one idempotent conversation-source replacement.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, pg, Table, textBoundsCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemorySourceReplacement");

const awareInstant =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

const nonBlank = S.makeFilter((value: string) =>
  Str.isEmpty(Str.trim(value)) ? "source replacement identifiers must not be blank" : undefined,
);

/**
 * Timezone-aware instant coerced to UTC on decode.
 *
 * **Details**
 *
 * Naive strings are rejected. An offset is converted to the same UTC instant,
 * matching `astimezone(timezone.utc)`.
 *
 * **Example** (Shift a +01 instant to UTC)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AwareUtcTimestamp } from "./MemorySourceReplacement.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(AwareUtcTimestamp)("2020-01-02T04:04:05+01:00"))
 * console.log(DateTime.formatIso(decoded)) // "2020-01-02T03:04:05.000Z"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AwareUtcTimestamp = S.String.check(S.isPattern(awareInstant)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.transform((input: string) => DateTime.toUtc(DateTime.makeUnsafe(input))),
    encode: SchemaGetter.transform(DateTime.formatIso),
  }),
  $I.annoteSchema("AwareUtcTimestamp", {
    description: "Timezone-aware instant stored as UTC.",
  }),
);

/**
 * Decoded aware UTC instant.
 *
 * @see {@link AwareUtcTimestamp} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type AwareUtcTimestamp = typeof AwareUtcTimestamp.Type;

const nonBlankText = (column: string, description: string) =>
  S.String.check(S.isMinLength(1), nonBlank)
    .annotateKey({ description })
    .pipe(pg.text(), pg.columnName(column));

const stringList = (column: string, description: string) =>
  S.Array(S.String)
    .annotateKey({ description })
    .pipe(S.withConstructorDefault(Effect.succeed(AEmpty)), pg.jsonb(), pg.columnName(column));

const AEmpty: ReadonlyArray<string> = [];

/**
 * Receipt committed after one idempotent conversation-source replacement.
 *
 * **Details**
 *
 * `controlState` stores the memory-apply control document. That module owns
 * writer mode, watermarks, and backfill fields; this receipt keeps the
 * document intact. Identifier strings must contain a non-whitespace character.
 * `committedAt` defaults to the current UTC instant at construction and is
 * coerced to UTC when decoded.
 *
 * **Example** (Construct a receipt)
 *
 * ```ts
 * import { ConversationSourceReplacementReceipt } from "./MemorySourceReplacement.ts"
 *
 * const receipt = ConversationSourceReplacementReceipt.make({
 *   replacementId: "rep-1",
 *   replacementDigest: "digest-1",
 *   uid: "user-1",
 *   conversationId: "conversation-1",
 *   operationId: "op-1",
 *   controlState: { uid: "user-1", headCommitId: "commit-1" },
 * })
 * console.log(receipt.replacementId) // "rep-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConversationSourceReplacementReceipt extends Model<ConversationSourceReplacementReceipt>(
  "ConversationSourceReplacementReceipt",
)(
  {
    replacementId: nonBlankText("replacement_id", "Idempotency id for this source replacement."),
    replacementDigest: nonBlankText("replacement_digest", "Digest of the replacement payload."),
    uid: nonBlankText("uid", "Account uid that owns the conversation."),
    conversationId: nonBlankText("conversation_id", "Conversation whose source memories were replaced."),
    operationId: nonBlankText("operation_id", "Canonical apply operation id."),
    controlState: S.JsonObject.annotateKey({
      description: "Memory control-state document captured with the receipt. Invariants live in memory apply.",
    }).pipe(pg.jsonb(), pg.columnName("control_state")),
    retractedMemoryIds: stringList("retracted_memory_ids", "Memory ids retracted by the replacement."),
    committedMemoryIds: stringList("committed_memory_ids", "Memory ids committed by the replacement."),
    reactivatedMemoryIds: stringList("reactivated_memory_ids", "Memory ids reactivated by the replacement."),
    tombstonedEvidenceIds: stringList("tombstoned_evidence_ids", "Evidence ids tombstoned with the source."),
    committedAt: AwareUtcTimestamp.annotateKey({
      description: "Aware commit instant, coerced to UTC. Construction defaults to now.",
    }).pipe(
      S.withConstructorDefault(Effect.sync(() => DateTime.nowUnsafe())),
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("committed_at"),
    ),
  },
  $I.annote("ConversationSourceReplacementReceipt", {
    description: "Committed receipt for one idempotent conversation-source replacement.",
  }),
  (columns) => [
    textBoundsCheck("replacement_id", { minLength: 1 })(columns.replacementId),
    textBoundsCheck("replacement_digest", { minLength: 1 })(columns.replacementDigest),
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    textBoundsCheck("conversation_id", { minLength: 1 })(columns.conversationId),
    textBoundsCheck("operation_id", { minLength: 1 })(columns.operationId),
    Table.check("replacement_id_nonblank")(sql<boolean>`char_length(btrim(${columns.replacementId})) >= 1`),
    Table.check("replacement_digest_nonblank")(sql<boolean>`char_length(btrim(${columns.replacementDigest})) >= 1`),
    Table.check("uid_nonblank")(sql<boolean>`char_length(btrim(${columns.uid})) >= 1`),
    Table.check("conversation_id_nonblank")(sql<boolean>`char_length(btrim(${columns.conversationId})) >= 1`),
    Table.check("operation_id_nonblank")(sql<boolean>`char_length(btrim(${columns.operationId})) >= 1`),
  ],
) {}

/**
 * Encoded form of {@link ConversationSourceReplacementReceipt}.
 *
 * @see {@link ConversationSourceReplacementReceipt} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConversationSourceReplacementReceipt {
  export type Encoded = S.Codec.Encoded<typeof ConversationSourceReplacementReceipt>;
}
