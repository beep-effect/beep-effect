/**
 * Legacy memory rows, capture context, and evidence.
 *
 * Conversation is upstream of memory and is not a memory. Category is
 * metadata, not a layer. `memoryTier` is the product layer axis
 * (`short_term`, `long_term`, `archive`). `context_only` is not a tier.
 * Short-term TTL is an adjudication deadline, not a visibility switch, and
 * this legacy row does not hide an active item just because it is old.
 *
 * @since 0.0.0
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Rec from "effect/Record";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Model,
  optionalBoundedText,
  optionalNull,
  optionalText,
  optionalTimestamp,
  pg,
  text,
  textBoundsCheck,
  timestamp,
  timestampDefaultNow,
  userId,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Memories");

const optionMissingDefault = <Schema extends S.Top>(schema: Schema, missing: Schema["Type"]) =>
  schema.pipe(
    S.NullOr,
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        O.some(
          O.match(present, {
            onNone: () => O.some(missing),
            onSome: (value) => (value === null ? O.none() : O.some(value)),
          }),
        ),
      ),
      encode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.flatten,
          O.match({ onNone: () => null, onSome: (value) => value }),
          O.some,
        ),
      ),
    }),
    S.withConstructorDefault(Effect.succeedSome(missing)),
  );

const jsonObject = () =>
  S.Record(S.String, S.Json).pipe(S.withConstructorDefault(Effect.succeed(Rec.empty<string, S.Json>())));

const stringList = (column: string) =>
  S.String.pipe(
    S.Array,
    S.withConstructorDefault(Effect.succeed(A.empty<string>())),
    pg.array(S.String.pipe(pg.text())),
    pg.columnName(column),
  );

/**
 * Primary and legacy memory categories.
 *
 * **Details**
 *
 * Primary members are `interesting`, `system`, `manual`, and `workflow`.
 * Legacy members (`core`, `hobbies`, `lifestyle`, `interests`, `habits`,
 * `work`, `skills`, `learnings`, `other`, `auto`) stay in the vocabulary.
 * Category is metadata, not a product layer.
 *
 * **Gotchas**
 *
 * A wire string `"core"` is mapped to `system` by {@link mapLegacyCategories}.
 * The legacy member and the wire string are the same characters, so decode
 * follows the string before-validator and does not preserve `core`.
 *
 * **Example** (Decode a primary category)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryCategory } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryCategory)("workflow"))
 * console.log(decoded) // "workflow"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryCategory = LiteralKit([
  "interesting",
  "system",
  "manual",
  "workflow",
  "core",
  "hobbies",
  "lifestyle",
  "interests",
  "habits",
  "work",
  "skills",
  "learnings",
  "other",
  "auto",
]).pipe(
  $I.annoteSchema("MemoryCategory", {
    description: "Memory category metadata. Primary and legacy members are not product layers.",
  }),
);

/**
 * Decoded memory category, including legacy members.
 *
 * @see {@link MemoryCategory} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryCategory = typeof MemoryCategory.Type;

const MemoryCategoryPrimary = LiteralKit(["interesting", "system", "manual", "workflow"]);
const interestingCategory: typeof MemoryCategoryPrimary.Type = "interesting";

/**
 * How a memory subject was attributed.
 *
 * **Example** (Decode user attribution)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SubjectAttribution } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(SubjectAttribution)("user"))
 * console.log(decoded) // "user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SubjectAttribution = LiteralKit(["user", "third_party", "unknown", "legacy_assumed"]).pipe(
  $I.annoteSchema("SubjectAttribution", {
    description: "How the memory subject was attributed.",
  }),
);

/**
 * Decoded subject attribution.
 *
 * @see {@link SubjectAttribution} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type SubjectAttribution = typeof SubjectAttribution.Type;

const unknownAttribution: SubjectAttribution = "unknown";

/**
 * Caution reasons. The stored field is a list of strings, not this closed set.
 *
 * **Details**
 *
 * `contradicted_by` and `stale` are vocabulary that
 * {@link uncertaintyReasonsFor} never produces.
 *
 * **Example** (Decode a produced reason)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UncertaintyReason } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UncertaintyReason)("single_source"))
 * console.log(decoded) // "single_source"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UncertaintyReason = LiteralKit([
  "single_source",
  "low_capture_signal",
  "contradicted_by",
  "stale",
  "third_party_subject",
]).pipe(
  $I.annoteSchema("UncertaintyReason", {
    description: "Caution vocabulary. The memory field stores strings and does not require this set.",
  }),
);

/**
 * Decoded uncertainty reason.
 *
 * @see {@link UncertaintyReason} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type UncertaintyReason = typeof UncertaintyReason.Type;

/**
 * Product memory layer stored as `memoryTier` on legacy rows.
 *
 * **Details**
 *
 * The wire values are `short_term`, `long_term`, and `archive`. Archive is the
 * only product meaning of archive. `context_only` is not a member.
 *
 * **Example** (Decode long-term)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryTier } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryTier)("long_term"))
 * console.log(decoded) // "long_term"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryTier = LiteralKit(["short_term", "long_term", "archive"]).pipe(
  $I.annoteSchema("MemoryTier", {
    description: "Product memory layer. short_term, long_term, and archive are the only members.",
  }),
);

/**
 * Decoded product memory layer.
 *
 * @see {@link MemoryTier} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryTier = typeof MemoryTier.Type;

const shortTermTier: MemoryTier = "short_term";
const longTermTier: MemoryTier = "long_term";

/**
 * Ledger kind. It does not change which other memory fields are required.
 *
 * **Example** (Decode a fact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryKind } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryKind)("fact"))
 * console.log(decoded) // "fact"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryKind = LiteralKit(["fact", "document", "trigger"]).pipe(
  $I.annoteSchema("MemoryKind", {
    description: "Knowledge-ledger kind. fact, document, and trigger share one memory shape here.",
  }),
);

/**
 * Decoded ledger kind.
 *
 * @see {@link MemoryKind} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryKind = typeof MemoryKind.Type;

/**
 * Who a fact is about.
 *
 * **Example** (Decode the primary user)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemorySubjectScope } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemorySubjectScope)("primary_user"))
 * console.log(decoded) // "primary_user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemorySubjectScope = LiteralKit([
  "primary_user",
  "user_owned_project",
  "user_relationship",
  "third_party",
]).pipe(
  $I.annoteSchema("MemorySubjectScope", {
    description: "Subject scope of a memory. It is not a product layer.",
  }),
);

/**
 * Decoded subject scope.
 *
 * @see {@link MemorySubjectScope} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type MemorySubjectScope = typeof MemorySubjectScope.Type;

/**
 * Physical ledger status stored for portability. It is not the legacy current-memory flag.
 *
 * **Gotchas**
 *
 * Physical `hidden` stays the stored value. Canonical validation treats it as
 * tombstoned. This legacy field does not perform that mapping.
 *
 * **Example** (Decode hidden)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryItemStatus } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryItemStatus)("hidden"))
 * console.log(decoded) // "hidden"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryItemStatus = LiteralKit(["active", "superseded", "hidden", "tombstoned"]).pipe(
  $I.annoteSchema("MemoryItemStatus", {
    description: "Physical ledger status. hidden remains stored and is not renamed to tombstoned here.",
  }),
);

/**
 * Decoded physical ledger status.
 *
 * @see {@link MemoryItemStatus} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryItemStatus = typeof MemoryItemStatus.Type;

/**
 * Why a ledger row was written.
 *
 * **Example** (Decode a user statement)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LedgerWriteReason } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LedgerWriteReason)("direct_user_statement"))
 * console.log(decoded) // "direct_user_statement"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LedgerWriteReason = LiteralKit([
  "direct_user_statement",
  "explicit_remember",
  "agent_reusable_conclusion",
  "recurring_workflow",
  "standing_trigger",
  "onboarding",
  "daily_reconciliation",
  "legacy_migration",
]).pipe(
  $I.annoteSchema("LedgerWriteReason", {
    description: "Ledger write reason. Higher authority reasons outrank curation.",
  }),
);

/**
 * Decoded ledger write reason.
 *
 * @see {@link LedgerWriteReason} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type LedgerWriteReason = typeof LedgerWriteReason.Type;

const CaptureAttribution = LiteralKit([
  "unknown",
  "assistant",
  "inferred",
  "third_party",
  "screen",
  "user_spoken",
  "user_written",
]);

/**
 * Maps a category input onto a primary category.
 *
 * **Details**
 *
 * Primary strings stay themselves. Legacy strings become `system`. Unknown
 * strings and non-strings become `interesting`.
 *
 * **Example** (Map a legacy string)
 *
 * ```ts
 * import { mapLegacyCategories } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(mapLegacyCategories("core")) // "system"
 * console.log(mapLegacyCategories(1)) // "interesting"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const mapLegacyCategories = (value: unknown): typeof MemoryCategoryPrimary.Type => {
  if (typeof value !== "string") return interestingCategory;
  if (value === "interesting" || value === "system" || value === "manual" || value === "workflow") return value;
  if (
    value === "core" ||
    value === "hobbies" ||
    value === "lifestyle" ||
    value === "interests" ||
    value === "habits" ||
    value === "work" ||
    value === "skills" ||
    value === "learnings" ||
    value === "other" ||
    value === "auto"
  ) {
    return "system";
  }
  return interestingCategory;
};

const categoryField = S.String.pipe(
  S.decodeTo(MemoryCategoryPrimary, {
    decode: SchemaGetter.transform(mapLegacyCategories),
    encode: SchemaGetter.transform((value: typeof MemoryCategoryPrimary.Type) => value),
  }),
  S.withConstructorDefault(Effect.succeed(interestingCategory)),
  pg.text(),
  pg.columnName("category"),
);

/**
 * Chooses the birth layer.
 *
 * **Details**
 *
 * Manually added facts and durability `long_term` (case-insensitive) start
 * Long-term. Everything else starts Short-term. Archive is not a birth layer.
 *
 * **Example** (Keep an ordinary fact short-term)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { decideInitialMemoryTier } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(decideInitialMemoryTier({ manuallyAdded: false, durability: O.none() })) // "short_term"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const decideInitialMemoryTier = (input: {
  readonly manuallyAdded: boolean;
  readonly durability: O.Option<string>;
}): MemoryTier => {
  if (input.manuallyAdded) return longTermTier;
  const durability = O.getOrElse(input.durability, () => "");
  return Str.toLowerCase(durability) === "long_term" ? longTermTier : shortTermTier;
};

const quoteItem = S.Record(S.String, S.Json);
const quoteRefs = quoteItem.pipe(
  S.Array,
  S.check(S.isMaxLength(5)),
  S.withConstructorDefault(Effect.succeed(A.empty<typeof quoteItem.Type>())),
);

/**
 * Original capture metadata, separate from API transport and device.
 *
 * **Details**
 *
 * `quoteRefs` holds at most five untyped quote objects. Attribution is a
 * closed seven-way literal. Device identity is not part of this capture
 * context; when a device id exists on evidence it is not an input to the
 * evidence id hash.
 *
 * **Example** (Decode a conversation capture)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryCaptureContext } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryCaptureContext)({ sourceType: "conversation" }),
 * )
 * console.log(decoded.sourceType) // "conversation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MemoryCaptureContext extends Model<MemoryCaptureContext>("MemoryCaptureContext")(
  {
    sourceType: S.String.check(S.isMaxLength(64)).pipe(pg.text(), pg.columnName("source_type")),
    capturedAt: optionalTimestamp("captured_at"),
    sourceId: optionalBoundedText("source_id", { maxLength: 512 }),
    sourceVersion: optionalBoundedText("source_version", { maxLength: 128 }),
    sourceSignal: optionalBoundedText("source_signal", { maxLength: 64 }),
    independenceGroup: optionalBoundedText("independence_group", { maxLength: 512 }),
    lineageId: optionalBoundedText("lineage_id", { maxLength: 512 }),
    attribution: optionalNull(CaptureAttribution).pipe(pg.text(), pg.columnName("attribution")),
    quoteRefs: quoteRefs.pipe(pg.jsonb(), pg.columnName("quote_refs")),
  },
  $I.annote("MemoryCaptureContext", {
    description: "Original capture metadata, separate from API transport and device.",
  }),
  (columns) => [
    textBoundsCheck("source_type", { maxLength: 64 })(columns.sourceType),
    textBoundsCheck("source_id", { maxLength: 512 })(columns.sourceId),
    textBoundsCheck("source_version", { maxLength: 128 })(columns.sourceVersion),
    textBoundsCheck("source_signal", { maxLength: 64 })(columns.sourceSignal),
    textBoundsCheck("independence_group", { maxLength: 512 })(columns.independenceGroup),
    textBoundsCheck("lineage_id", { maxLength: 512 })(columns.lineageId),
    pg.Table.check("quote_refs_len")(sql<boolean>`jsonb_array_length(${columns.quoteRefs}) <= 5`),
  ],
) {}

/**
 * Encoded capture context.
 *
 * @see {@link MemoryCaptureContext} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryCaptureContext {
  export type Encoded = S.Codec.Encoded<typeof MemoryCaptureContext>;
}

const privateVisibility = "private";
const publicVisibility = "public";

const memoryFields = () => ({
  content: text("content"),
  category: categoryField,
  visibility: optionMissingDefault(S.String, privateVisibility).pipe(pg.text(), pg.columnName("visibility")),
  tags: stringList("tags"),
  headline: optionalText("headline"),
  predicate: optionalText("predicate"),
  arguments: jsonObject().pipe(pg.jsonb(), pg.columnName("arguments")),
  subjectEntityId: optionalText("subject_entity_id"),
  subjectAttribution: SubjectAttribution.pipe(
    S.withConstructorDefault(Effect.succeed(unknownAttribution)),
    pg.text(),
    pg.columnName("subject_attribution"),
  ),
  objectEntityIds: stringList("object_entity_ids"),
  qualifiers: jsonObject().pipe(pg.jsonb(), pg.columnName("qualifiers")),
  captureConfidence: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("capture_confidence")),
  veracity: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("veracity")),
  uncertaintyReasons: stringList("uncertainty_reasons"),
  durability: optionalText("durability"),
  subjectScope: optionalNull(MemorySubjectScope).pipe(pg.text(), pg.columnName("subject_scope")),
  beliefClass: optionalText("belief_class"),
  halfLifeDays: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("half_life_days")),
  validTo: optionalTimestamp("valid_to"),
  captureContext: optionalNull(MemoryCaptureContext).pipe(pg.jsonb(), pg.columnName("capture_context")),
});

/**
 * Legacy memory content before it is stored.
 *
 * **Details**
 *
 * Visibility is optional with a missing-key default of `private`. A present
 * null stays `None`. Category strings are mapped by {@link mapLegacyCategories}.
 * This class is not a product memory item and it does not store a layer.
 *
 * **Gotchas**
 *
 * `context_only` is not a tier and is not a field here. Conversation id points
 * at an upstream conversation; the conversation is not a memory.
 *
 * **Example** (Construct a private memory)
 *
 * ```ts
 * import { Memory } from "@beep/scratchpad/beep/Memories"
 *
 * const memory = Memory.make({ content: "Lives in Seattle" })
 * console.log(memory.category) // "interesting"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Memory extends Model<Memory>("Memory")(
  memoryFields(),
  $I.annote("Memory", {
    description: "Legacy memory content. Category is metadata and visibility defaults to private when omitted.",
  }),
) {}

/**
 * Encoded legacy memory.
 *
 * @see {@link Memory} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Memory {
  export type Encoded = S.Codec.Encoded<typeof Memory>;
}

const half = S.Finite.pipe(S.withConstructorDefault(Effect.succeed(0.5)));

/**
 * One capture of a memory.
 *
 * **Details**
 *
 * The evidence id is a document id over the source, signal, extractor, and
 * sorted artifact reference. `clientDeviceId` is stored and is not part of
 * that hash. `redactionStatus` defaults to `active`. Tombstoned or redacted
 * rows are excluded from veracity.
 *
 * **Gotchas**
 *
 * A device id is not an input to the evidence id. Do not add it to the seed.
 *
 * **Example** (Construct evidence)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { Evidence } from "@beep/scratchpad/beep/Memories"
 *
 * const evidence = Evidence.make({
 *   evidenceId: "ev-1",
 *   sourceType: "conversation",
 *   sourceSignal: "manual",
 *   extractorId: "memory_extractor",
 *   extractorVersion: "v1",
 *   independenceGroup: "src",
 *   capturedAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(evidence.redactionStatus) // "active"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Evidence extends Model<Evidence>("Evidence")(
  {
    evidenceId: text("evidence_id"),
    sourceId: optionalText("source_id"),
    sourceType: text("source_type"),
    sourceVersion: optionalText("source_version"),
    sourceSignal: text("source_signal"),
    extractorId: text("extractor_id"),
    extractorVersion: text("extractor_version"),
    artifactRef: jsonObject().pipe(pg.jsonb(), pg.columnName("artifact_ref")),
    captureConfidence: half.pipe(pg.doublePrecision(), pg.columnName("capture_confidence")),
    independenceGroup: text("independence_group"),
    lineageId: optionalText("lineage_id"),
    attribution: optionalNull(CaptureAttribution).pipe(pg.text(), pg.columnName("attribution")),
    quoteRefs: quoteItem.pipe(
      S.Array,
      S.withConstructorDefault(Effect.succeed(A.empty<typeof quoteItem.Type>())),
      pg.jsonb(),
      pg.columnName("quote_refs"),
    ),
    capturedAt: timestamp("captured_at"),
    redactionStatus: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("active")),
      pg.text(),
      pg.columnName("redaction_status"),
    ),
    clientDeviceId: optionalText("client_device_id"),
  },
  $I.annote("Evidence", {
    description: "One capture of a memory. The device id is stored and is not part of the evidence id hash.",
  }),
) {}

/**
 * Encoded evidence row.
 *
 * @see {@link Evidence} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Evidence {
  export type Encoded = S.Codec.Encoded<typeof Evidence>;
}

const memoryDbOnly = () => ({
  id: text("id"),
  uid: userId("uid"),
  memoryId: optionalText("memory_id"),
  createdAt: timestampDefaultNow("created_at"),
  updatedAt: timestampDefaultNow("updated_at"),
  validAt: optionalTimestamp("valid_at"),
  invalidAt: optionalTimestamp("invalid_at"),
  conversationId: optionalText("conversation_id"),
  manuallyAdded: S.Boolean.pipe(
    S.withConstructorDefault(Effect.succeed(false)),
    pg.boolean(),
    pg.columnName("manually_added"),
  ),
  reviewed: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("reviewed")),
  userReview: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("user_review")),
  scoring: optionalText("scoring"),
  evidence: S.Array(Evidence).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<Evidence>())),
    pg.jsonb(),
    pg.columnName("evidence"),
  ),
  memoryTier: optionalNull(MemoryTier).pipe(pg.text(), pg.columnName("memory_tier")),
  kind: optionalNull(MemoryKind).pipe(pg.text(), pg.columnName("kind")),
  status: optionalNull(MemoryItemStatus).pipe(pg.text(), pg.columnName("status")),
  writeReason: optionalNull(LedgerWriteReason).pipe(pg.text(), pg.columnName("write_reason")),
  ledgerSchemaVersion: optionalText("ledger_schema_version"),
  curationWeight: S.Int.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName("curation_weight")),
});

/**
 * Stored legacy memory row.
 *
 * **Details**
 *
 * `memoryId` is rewritten to `id` by {@link decodeMemoryDb}. A wire
 * `memoryId` that still holds a conversation id is not trusted. Visibility
 * defaults to `public` when the key is missing, unlike {@link Memory}.
 * `memoryTier` is the product layer. {@link memoryLayer} is that value and
 * is not stored separately.
 *
 * **Gotchas**
 *
 * A missing `invalidAt` means the row is active. Expiry does not hide it.
 * Physical `hidden` is stored as `hidden` and is not rewritten to tombstoned.
 * Category is not a layer. Archive is a real tier, not a synonym for hidden.
 *
 * **Example** (Align the memory id with the row id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMemoryDb } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(
 *   decodeMemoryDb({
 *     id: "mem-1",
 *     uid: "user-1",
 *     memoryId: "conversation-1",
 *     content: "Ada",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.memoryId._tag === "Some" && decoded.memoryId.value === "mem-1") // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const memoryDbFields = () => ({
  ...memoryFields(),
  visibility: optionMissingDefault(S.String, publicVisibility).pipe(pg.text(), pg.columnName("visibility")),
  ...memoryDbOnly(),
});

export class MemoryDB extends Model<MemoryDB>("MemoryDB")(
  memoryDbFields(),
  $I.annote("MemoryDB", {
    description: "Stored legacy memory. memoryId is aligned to id, and memoryTier is the product layer.",
  }),
) {}

/**
 * Encoded stored memory.
 *
 * @see {@link MemoryDB} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryDB {
  export type Encoded = S.Codec.Encoded<typeof MemoryDB>;
}

/**
 * Legacy short-term shadow row.
 *
 * **Details**
 *
 * This is the old short-term collection shape, not the product `memoryTier`
 * field. Durable promotion is a separate row. `status` defaults to
 * `pending_consolidation`.
 *
 * **Example** (Construct a pending short-term row)
 *
 * ```ts
 * import { ShortTermMemory } from "@beep/scratchpad/beep/Memories"
 *
 * const row = ShortTermMemory.make({ id: "st-1", uid: "user-1", content: "Ada" })
 * console.log(row.status) // "pending_consolidation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ShortTermMemory extends Model<ShortTermMemory>("ShortTermMemory")(
  {
    id: text("id"),
    uid: userId("uid"),
    content: text("content"),
    category: categoryField,
    tags: stringList("tags"),
    visibility: optionMissingDefault(S.String, privateVisibility).pipe(pg.text(), pg.columnName("visibility")),
    headline: optionalText("headline"),
    sourceId: optionalText("source_id"),
    sourceType: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("conversation")),
      pg.text(),
      pg.columnName("source_type"),
    ),
    sourceSignal: optionalText("source_signal"),
    scope: S.String.pipe(S.withConstructorDefault(Effect.succeed("global")), pg.text(), pg.columnName("scope")),
    extractorId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("memory_extractor")),
      pg.text(),
      pg.columnName("extractor_id"),
    ),
    extractorVersion: S.String.pipe(S.withConstructorDefault(Effect.succeed("v1")), pg.text(), pg.columnName("extractor_version")),
    status: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("pending_consolidation")),
      pg.text(),
      pg.columnName("status"),
    ),
    predicate: optionalText("predicate"),
    arguments: jsonObject().pipe(pg.jsonb(), pg.columnName("arguments")),
    subjectEntityId: optionalText("subject_entity_id"),
    subjectAttribution: SubjectAttribution.pipe(
      S.withConstructorDefault(Effect.succeed(unknownAttribution)),
      pg.text(),
      pg.columnName("subject_attribution"),
    ),
    objectEntityIds: stringList("object_entity_ids"),
    qualifiers: jsonObject().pipe(pg.jsonb(), pg.columnName("qualifiers")),
    captureConfidence: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("capture_confidence")),
    veracity: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("veracity")),
    uncertaintyReasons: stringList("uncertainty_reasons"),
    durability: optionalText("durability"),
    evidence: S.Array(Evidence).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<Evidence>())),
      pg.jsonb(),
      pg.columnName("evidence"),
    ),
    createdAt: timestampDefaultNow("created_at"),
    updatedAt: timestampDefaultNow("updated_at"),
    consolidatedAt: optionalTimestamp("consolidated_at"),
    consolidatedMemoryId: optionalText("consolidated_memory_id"),
    allowedUses: stringList("allowed_uses"),
  },
  $I.annote("ShortTermMemory", {
    description: "Legacy short-term shadow row. It is not the product memoryTier field.",
  }),
) {}

/**
 * Encoded short-term shadow row.
 *
 * @see {@link ShortTermMemory} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShortTermMemory {
  export type Encoded = S.Codec.Encoded<typeof ShortTermMemory>;
}

const sha256 = (value: string): Uint8Array => new Uint8Array(createHash("sha256").update(value, "utf8").digest());

/**
 * Stable document id for a natural-key seed.
 *
 * **Details**
 *
 * SHA-256 the UTF-8 seed and format the first 16 bytes as a UUIDv4, setting
 * the version and variant bits the way Python's `uuid.UUID(bytes, version=4)`
 * does.
 *
 * **Example** (Hash a seed)
 *
 * ```ts
 * import { documentIdFromSeed } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(documentIdFromSeed("hello")) // "2cf24dba-5fb0-430e-a6e8-3b2ac5b9e29e"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const documentIdFromSeed = (seed: string): string => {
  const bytes = sha256(seed).slice(0, 16);
  const sixth = bytes[6] ?? 0;
  const eighth = bytes[8] ?? 0;
  bytes[6] = (sixth & 0x0f) | 0x40;
  bytes[8] = (eighth & 0x3f) | 0x80;
  const hex = A.join("")(A.map(A.fromIterable(bytes), (byte) => byte.toString(16).padStart(2, "0")));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const pyLiteral = (value: unknown): string => {
  if (typeof value === "string") return `'${Str.replaceAll("'", "\\'")(value)}'`;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "True" : "False";
  if (value === null || value === undefined) return "None";
  if (A.isArray(value)) return `[${A.join(", ")(A.map(value, pyLiteral))}]`;
  if (typeof value === "object") {
    const entries = A.sort(Rec.toEntries(value), (left: readonly [string, unknown], right: readonly [string, unknown]) =>
      left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0,
    );
    return `[${A.join(", ")(A.map(entries, ([key, item]) => `(${pyLiteral(key)}, ${pyLiteral(item)})`))}]`;
  }
  return "None";
};

const capturePrior = (signal: string): number => {
  if (signal === "typed" || signal === "manual") return 0.95;
  if (signal === "push_to_talk") return 0.9;
  if (signal === "integration") return 0.8;
  if (signal === "transcription") return 0.65;
  if (signal === "background_transcription") return 0.55;
  if (signal === "ocr") return 0.45;
  if (signal === "legacy") return 0.6;
  return 0.5;
};

/**
 * Capture confidence for a source signal, defaulting to the unknown prior.
 *
 * **Example** (Read the manual prior)
 *
 * ```ts
 * import { captureConfidenceForSourceSignal } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(captureConfidenceForSourceSignal("manual")) // 0.95
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const captureConfidenceForSourceSignal = (sourceSignal: string): number => capturePrior(sourceSignal);

/**
 * Band name for a confidence value.
 *
 * **Example** (Band a high value)
 *
 * ```ts
 * import { confidenceBand } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(confidenceBand(0.9)) // "certain"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const confidenceBand = (value: number): "low" | "medium" | "high" | "certain" => {
  if (value >= 0.9) return "certain";
  if (value >= 0.75) return "high";
  if (value >= 0.5) return "medium";
  return "low";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !A.isArray(value) && !DateTime.isDateTime(value);

const readField = (row: object, key: string): unknown => (key in row ? Reflect.get(row, key) : undefined);

/**
 * Builds evidence from a source.
 *
 * **Details**
 *
 * The id seed is `evidence`, source id or empty, source type, signal,
 * extractor id, extractor version, and the Python `str(sorted(ref.items()))`
 * form. The device id is stored and omitted from that seed. Capture
 * confidence falls back to {@link captureConfidenceForSourceSignal}. The
 * independence group falls back to the source id, then `{sourceType}:unknown`.
 *
 * **Gotchas**
 *
 * Do not fold `clientDeviceId` into the evidence id. Legacy dedup stays the
 * same when the device is absent.
 *
 * **Example** (Mint a stable evidence id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { evidenceFromSource } from "@beep/scratchpad/beep/Memories"
 *
 * const evidence = evidenceFromSource({
 *   sourceId: O.some("src"),
 *   sourceType: "conversation",
 *   sourceSignal: "manual",
 *   extractorId: "memory_extractor",
 *   extractorVersion: "v1",
 *   artifactRef: O.none(),
 *   captureConfidence: O.none(),
 *   independenceGroup: O.none(),
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   clientDeviceId: O.none(),
 * })
 * console.log(evidence.evidenceId) // "d02cdbee-985f-41b4-a7b1-a212c0271f9a"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const evidenceFromSource = (input: {
  readonly sourceId: O.Option<string>;
  readonly sourceType: string;
  readonly sourceSignal: string;
  readonly extractorId: string;
  readonly extractorVersion: string;
  readonly artifactRef: O.Option<Record<string, S.Json>>;
  readonly captureConfidence: O.Option<number>;
  readonly independenceGroup: O.Option<string>;
  readonly createdAt: DateTime.Utc;
  readonly clientDeviceId: O.Option<string>;
}): Evidence => {
  const sourceId = O.getOrElse(input.sourceId, () => "");
  const ref = O.getOrElse(input.artifactRef, () => Rec.empty<string, S.Json>());
  const seed = A.join("|")([
    "evidence",
    sourceId,
    input.sourceType,
    input.sourceSignal,
    input.extractorId,
    input.extractorVersion,
    pyLiteral(ref),
  ]);
  const group = O.getOrElse(input.independenceGroup, () => (sourceId.length > 0 ? sourceId : `${input.sourceType}:unknown`));
  return Evidence.make({
    evidenceId: documentIdFromSeed(seed),
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    sourceSignal: input.sourceSignal,
    extractorId: input.extractorId,
    extractorVersion: input.extractorVersion,
    artifactRef: ref,
    captureConfidence: O.getOrElse(input.captureConfidence, () => capturePrior(input.sourceSignal)),
    independenceGroup: group,
    capturedAt: input.createdAt,
    clientDeviceId: input.clientDeviceId,
  });
};

const numberOf = (value: unknown): O.Option<number> =>
  typeof value === "number" && Number.isFinite(value) ? O.some(value) : O.none();

const evidenceView = (item: object): Record<string, unknown> =>
  S.is(Evidence)(item)
    ? {
        evidenceId: item.evidenceId,
        redactionStatus: item.redactionStatus,
        independenceGroup: item.independenceGroup,
        sourceId: O.getOrNull(item.sourceId),
        captureConfidence: item.captureConfidence,
      }
    : A.reduce(Rec.toEntries(isRecord(item) ? item : {}), Rec.empty<string, unknown>(), (acc, [key, value]) =>
        Rec.set(acc, key, value),
      );

const activeEvidence = (items: ReadonlyArray<object>): ReadonlyArray<Record<string, unknown>> =>
  A.reduce(items, A.empty<Record<string, unknown>>(), (acc, item) => {
    const view = evidenceView(item);
    return view.redactionStatus === "tombstoned" ? acc : A.append(acc, view);
  });

/**
 * Veracity for an evidence set.
 *
 * **Details**
 *
 * Tombstoned evidence is ignored. Independent groups come from
 * `independenceGroup` or `sourceId`. No groups yield the base prior 0.35.
 * One group starts at 0.45, each extra group adds 0.22, a capture at least
 * 0.85 adds 0.08, a capture below 0.5 subtracts 0.12, and third-party
 * attribution subtracts 0.08. The result is clamped to 0 through 0.98.
 *
 * **Example** (Use the base prior)
 *
 * ```ts
 * import { computeVeracity } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(computeVeracity({ evidence: [], subjectAttribution: "unknown" })) // 0.35
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const computeVeracity = (input: {
  readonly evidence: ReadonlyArray<object>;
  readonly subjectAttribution: string;
}): number => {
  const items = activeEvidence(input.evidence);
  const groups = A.reduce(items, HashSet.empty<string>(), (acc, item) => {
    const group = item.independenceGroup ?? item.sourceId;
    return typeof group === "string" && group.length > 0 ? HashSet.add(acc, group) : acc;
  });
  if (HashSet.size(groups) === 0) return 0.35;
  const maxCapture = O.getOrElse(
    A.reduce(items, O.none<number>(), (acc, item) => {
      const value = numberOf(item.captureConfidence);
      if (O.isNone(value)) return acc;
      if (O.isNone(acc) || value.value > acc.value) return value;
      return acc;
    }),
    () => 0.5,
  );
  const extra = HashSet.size(groups) - 1;
  const score =
    0.45 +
    extra * 0.22 +
    (maxCapture >= 0.85 ? 0.08 : 0) -
    (maxCapture < 0.5 ? 0.12 : 0) -
    (input.subjectAttribution === "third_party" ? 0.08 : 0);
  return Math.min(0.98, Math.max(0, score));
};

/**
 * Caution strings for an evidence set.
 *
 * **Details**
 *
 * Adds `single_source` when there is at most one independent group,
 * `low_capture_signal` when any capture is below 0.5, and
 * `third_party_subject` for third-party attribution. `contradicted_by` and
 * `stale` are never produced.
 *
 * **Example** (Flag a single source)
 *
 * ```ts
 * import { uncertaintyReasonsFor } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(uncertaintyReasonsFor({ evidence: [], subjectAttribution: "unknown" })[0]) // "single_source"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const uncertaintyReasonsFor = (input: {
  readonly evidence: ReadonlyArray<object>;
  readonly subjectAttribution: string;
}): ReadonlyArray<string> => {
  const items = activeEvidence(input.evidence);
  const groups = A.reduce(items, HashSet.empty<string>(), (acc, item) => {
    const group = item.independenceGroup ?? item.sourceId;
    return typeof group === "string" && group.length > 0 ? HashSet.add(acc, group) : acc;
  });
  const reasons = A.empty<string>();
  const withSingle = HashSet.size(groups) <= 1 ? A.append(reasons, "single_source") : reasons;
  const withLow = A.some(items, (item) => O.match(numberOf(item.captureConfidence), { onNone: () => false, onSome: (value) => value < 0.5 }))
    ? A.append(withSingle, "low_capture_signal")
    : withSingle;
  return input.subjectAttribution === "third_party" ? A.append(withLow, "third_party_subject") : withLow;
};

/**
 * Capture confidence, veracity, and uncertainty for one evidence set.
 *
 * **Example** (Fill the unknown prior)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { confidenceFieldsForEvidence } from "@beep/scratchpad/beep/Memories"
 *
 * const fields = confidenceFieldsForEvidence({ evidence: [], subjectAttribution: "unknown", existingCaptureConfidence: O.none() })
 * console.log(fields.captureConfidence) // 0.5
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const confidenceFieldsForEvidence = (input: {
  readonly evidence: ReadonlyArray<object>;
  readonly subjectAttribution: string;
  readonly existingCaptureConfidence: O.Option<number>;
}): {
  readonly captureConfidence: number;
  readonly veracity: number;
  readonly uncertaintyReasons: ReadonlyArray<string>;
} => {
  const first = A.head(input.evidence);
  const fromEvidence = O.flatMap(first, (item) => numberOf(evidenceView(item).captureConfidence));
  const captureConfidence = O.getOrElse(O.orElse(input.existingCaptureConfidence, () => fromEvidence), () => 0.5);
  return {
    captureConfidence,
    veracity: computeVeracity(input),
    uncertaintyReasons: uncertaintyReasonsFor(input),
  };
};

/**
 * Merges evidence, keeping the first copy of an id unless it is tombstoned.
 *
 * **Example** (Replace a tombstone)
 *
 * ```ts
 * import { mergeEvidenceSets } from "@beep/scratchpad/beep/Memories"
 *
 * const merged = mergeEvidenceSets({
 *   existing: [{ evidenceId: "ev", redactionStatus: "tombstoned" }],
 *   incoming: [{ evidenceId: "ev", redactionStatus: "active" }],
 * })
 * console.log(merged[0]?.redactionStatus) // "active"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const mergeEvidenceSets = (input: {
  readonly existing: ReadonlyArray<object>;
  readonly incoming: ReadonlyArray<object>;
}): ReadonlyArray<Record<string, unknown>> => {
  const seen = A.reduce([...input.existing, ...input.incoming], { rows: A.empty<Record<string, unknown>>(), index: HashMap.empty<string, number>() }, (state, item) => {
    const view = evidenceView(item);
    const evidenceId = view.evidenceId;
    if (typeof evidenceId !== "string") return { ...state, rows: A.append(state.rows, view) };
    const current = HashMap.get(state.index, evidenceId);
    if (O.isNone(current)) {
      return { rows: A.append(state.rows, view), index: HashMap.set(state.index, evidenceId, state.rows.length) };
    }
    const previous = state.rows[current.value];
    if (previous?.redactionStatus === "tombstoned" && view.redactionStatus !== "tombstoned") {
      const rows = A.map(state.rows, (row, index) => (index === current.value ? view : row));
      return { rows, index: state.index };
    }
    return state;
  });
  return seen.rows;
};

const cleanArgument = (value: string): string => Str.trim(Str.replace(/^\.+|\.+$/g, "")(Str.trim(value)));

const defaultSubject = (category: O.Option<string>): O.Option<string> =>
  O.flatMap(category, (value) => (value === "system" || value === "manual" || value === "workflow" ? O.some("user") : O.none()));

/**
 * Parses a small set of English fact shapes.
 *
 * **Details**
 *
 * Recognizes lives/resides, moved, works at, likes/prefers, has/owns, and age.
 * Anything else has no predicate. System, manual, and workflow categories
 * default the subject to `user`.
 *
 * **Example** (Parse a home)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { propositionize } from "@beep/scratchpad/beep/Memories"
 *
 * const proposition = propositionize({ content: "Lives in Seattle", category: O.none() })
 * console.log(O.getOrNull(proposition.predicate)) // "resides_in"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const propositionize = (input: {
  readonly content: string;
  readonly category: O.Option<string>;
}): {
  readonly predicate: O.Option<string>;
  readonly arguments: Record<string, string | number>;
  readonly subjectEntityId: O.Option<string>;
} => {
  const textValue = cleanArgument(input.content);
  const lower = Str.toLowerCase(textValue);
  const patterns: ReadonlyArray<readonly [RegExp, string, string]> = [
    [/^(?:the user |user |they |he |she |i )?(?:currently )?(?:lives|live|resides|reside) in (?<location>.+)$/u, "resides_in", "location"],
    [/^(?:the user |user |they |he |she |i )?(?:moved|relocated) to (?<location>.+)$/u, "resides_in", "location"],
    [/^(?:the user |user |they |he |she |i )?(?:works|work) at (?<organization>.+)$/u, "works_at", "organization"],
    [/^(?:the user |user |they |he |she |i )?(?:likes|like|loves|love|enjoys|enjoy|prefers|prefer) (?<thing>.+)$/u, "prefers", "thing"],
    [/^(?:the user |user |they |he |she |i )?(?:has|have|owns|own) (?<object>.+)$/u, "has", "object"],
    [/^(?:the user |user |they |he |she |i )?(?:is|am|are) (?<years>[0-9]{1,3}) years old$/u, "age_years", "years"],
  ];
  const matched = A.findFirst(patterns, ([pattern]) => pattern.test(lower));
  if (O.isNone(matched)) return { predicate: O.none(), arguments: {}, subjectEntityId: defaultSubject(input.category) };
  const [pattern, predicate, slot] = matched.value;
  const groups = pattern.exec(lower)?.groups;
  const raw = groups?.[slot] ?? "";
  const value = slot === "years" ? Number.parseInt(raw, 10) : textValue.slice(textValue.length - raw.length);
  return { predicate: O.some(predicate), arguments: { [slot]: value }, subjectEntityId: defaultSubject(input.category) };
};

/**
 * Renders a memory from its proposition, or returns the content.
 *
 * **Example** (Render a home)
 *
 * ```ts
 * import { renderMemory } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(renderMemory({ content: "Lives in Seattle" })) // "Lives in Seattle"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderMemory = (memory: object): string => {
  const contentValue = readField(memory, "content");
  const content = typeof contentValue === "string" ? contentValue : "";
  const predicateValue = readField(memory, "predicate");
  const predicate =
    typeof predicateValue === "string"
      ? predicateValue
      : O.isOption(predicateValue) && O.isSome(predicateValue) && typeof predicateValue.value === "string"
        ? predicateValue.value
        : "";
  const categoryValue = readField(memory, "category");
  const category = typeof categoryValue === "string" ? O.some(categoryValue) : O.none();
  const parsed = predicate.length === 0 ? propositionize({ content, category }) : null;
  const parsedName = parsed === null ? null : O.getOrNull(parsed.predicate);
  const name = predicate.length > 0 ? predicate : typeof parsedName === "string" ? parsedName : null;
  const argsValue = readField(memory, "arguments");
  const args = isRecord(argsValue) ? argsValue : parsed?.arguments ?? {};
  if (name === null) return content;
  if (name === "resides_in" && typeof args.location === "string") return `Lives in ${args.location}`;
  if (name === "works_at" && typeof args.organization === "string") {
    return typeof args.role === "string" ? `Works at ${args.organization} as ${args.role}` : `Works at ${args.organization}`;
  }
  if (name === "prefers" && typeof args.thing === "string") return `Prefers ${args.thing}`;
  if (name === "has" && typeof args.object === "string") return `Has ${args.object}`;
  if (name === "age_years" && args.years !== undefined) return `Is ${String(args.years)} years old`;
  return content;
};

/**
 * Two facts conflict when they share a predicate and disagree on a slot.
 *
 * **Example** (Conflict on location)
 *
 * ```ts
 * import { structurallyConflicts } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(structurallyConflicts({ left: { content: "Lives in Seattle" }, right: { content: "Lives in Portland" } })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const structurallyConflicts = (input: { readonly left: object; readonly right: object }): boolean => {
  const leftContent = readField(input.left, "content");
  const rightContent = readField(input.right, "content");
  const leftCategory = readField(input.left, "category");
  const rightCategory = readField(input.right, "category");
  const left = propositionize({
    content: typeof leftContent === "string" ? leftContent : "",
    category: typeof leftCategory === "string" ? O.some(leftCategory) : O.none(),
  });
  const right = propositionize({
    content: typeof rightContent === "string" ? rightContent : "",
    category: typeof rightCategory === "string" ? O.some(rightCategory) : O.none(),
  });
  if (O.isNone(left.predicate) || O.isNone(right.predicate) || left.predicate.value !== right.predicate.value) return false;
  const leftSubject = O.getOrNull(left.subjectEntityId);
  const rightSubject = O.getOrNull(right.subjectEntityId);
  if (leftSubject !== null && rightSubject !== null && leftSubject !== rightSubject) return false;
  return A.some(Rec.keys(left.arguments), (slot) => slot in right.arguments && !Equal.equals(left.arguments[slot], right.arguments[slot]));
};

const categoryBoost = (category: string): O.Option<number> => {
  if (
    category === "interesting" ||
    category === "core" ||
    category === "hobbies" ||
    category === "lifestyle" ||
    category === "interests" ||
    category === "work" ||
    category === "skills" ||
    category === "learnings"
  ) {
    return O.some(1);
  }
  if (category === "system" || category === "manual" || category === "workflow" || category === "habits" || category === "other" || category === "auto") {
    return O.some(0);
  }
  return O.none();
};

/**
 * Sort key for a stored memory.
 *
 * **Details**
 *
 * Manual memories sort as `01`. The category component is `999 - boost`, or
 * `000` when the category has no boost. The clock is unix seconds, zero-padded
 * to 10 digits.
 *
 * **Example** (Score an interesting manual memory)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { calculateScore } from "@beep/scratchpad/beep/Memories"
 *
 * const score = calculateScore({
 *   category: "interesting",
 *   manuallyAdded: true,
 *   createdAt: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(score.startsWith("01_998_")) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const calculateScore = (memory: {
  readonly category: string;
  readonly manuallyAdded: boolean;
  readonly createdAt: DateTime.Utc;
}): string => {
  const boost = categoryBoost(memory.category);
  const categoryPart = O.match(boost, { onNone: () => 0, onSome: (value) => 999 - value });
  const manual = memory.manuallyAdded ? 1 : 0;
  const seconds = Math.trunc(DateTime.toEpochMillis(memory.createdAt) / 1000);
  return `${Str.padStart(2, "0")(String(manual))}_${Str.padStart(2, "0")(String(categoryPart))}_${Str.padStart(10, "0")(String(seconds))}`;
};

/**
 * Product layer derived from `memoryTier`.
 *
 * **Details**
 *
 * The values are `short_term`, `long_term`, and `archive`. None means the
 * legacy row has no tier. That is not an implicit Long-term memory.
 *
 * **Example** (Read a missing tier)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { memoryLayer } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(O.isNone(memoryLayer({ memoryTier: O.none() }))) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const memoryLayer = (memory: { readonly memoryTier: O.Option<MemoryTier> }): O.Option<MemoryTier> => memory.memoryTier;

/**
 * A stored memory is active until `invalidAt` is set.
 *
 * **Example** (Read an open row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { isActive } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(isActive({ invalidAt: O.none() })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isActive = (memory: { readonly invalidAt: O.Option<DateTime.Utc> }): boolean => O.isNone(memory.invalidAt);

/**
 * Decodes a stored memory and forces `memoryId` to equal `id`.
 *
 * **Details**
 *
 * Older documents stored the conversation id in `memoryId`. Serving that
 * value breaks clients, so decode discards it.
 *
 * **Example** (Replace a stale memory id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeMemoryDb } from "@beep/scratchpad/beep/Memories"
 *
 * const decoded = Effect.runSync(
 *   decodeMemoryDb({
 *     id: "mem-1",
 *     uid: "user-1",
 *     memoryId: "conversation-1",
 *     content: "Ada",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(O.getOrNull(decoded.memoryId)) // "mem-1"
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeMemoryDb = Effect.fn("MemoryDB.decode")(function* (input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(MemoryDB)(input);
  return MemoryDB.make({ ...decoded, memoryId: O.some(decoded.id) });
});

/**
 * Formats memories as a prompt list.
 *
 * **Example** (Format one line)
 *
 * ```ts
 * import { getMemoriesAsStr } from "@beep/scratchpad/beep/Memories"
 *
 * console.log(getMemoriesAsStr([{ content: "Ada" }])) // "- Ada\n"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
const resolveSubject = (input: {
  readonly memory: Memory;
  readonly subjectEntityId: O.Option<string>;
  readonly subjectAttribution: O.Option<SubjectAttribution>;
}): { readonly subject: O.Option<string>; readonly attribution: SubjectAttribution } => {
  const proposition = propositionize({ content: input.memory.content, category: O.some(input.memory.category) });
  const subject = O.orElse(input.subjectEntityId, () => proposition.subjectEntityId);
  const attribution = O.getOrElse(input.subjectAttribution, () => input.memory.subjectAttribution);
  return {
    subject,
    attribution: O.getOrNull(subject) === "user" && attribution === "unknown" ? "user" : attribution,
  };
};

/**
 * Stores a memory as a durable row.
 *
 * **Details**
 *
 * The row id is the document id of the content. `memoryId` is that same id.
 * Evidence is one source capture. Confidence fields are calculated after the
 * evidence exists. `now` is the clock reading Python took from UTC now.
 * Manual memories are reviewed and user-reviewed true, and they start
 * Long-term.
 *
 * **Example** (Store one fact)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { Memory, memoryDbFromMemory } from "@beep/scratchpad/beep/Memories"
 *
 * const stored = memoryDbFromMemory({
 *   memory: Memory.make({ content: "hello world" }),
 *   uid: "user-1",
 *   now: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   sourceId: O.none(),
 *   sourceType: O.none(),
 *   sourceSignal: O.none(),
 *   conversationId: O.none(),
 *   subjectEntityId: O.none(),
 *   subjectAttribution: O.none(),
 *   sourceCapturedAt: O.none(),
 *   clientDeviceId: O.none(),
 * })
 * console.log(stored.id) // "b94d27b9-934d-4e08-a52e-52d7da7dabfa"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const memoryDbFromMemory = (input: {
  readonly memory: Memory;
  readonly manuallyAdded: boolean;
  readonly uid: string;
  readonly now: DateTime.Utc;
  readonly sourceId: O.Option<string>;
  readonly sourceType: O.Option<string>;
  readonly sourceSignal: O.Option<string>;
  readonly conversationId: O.Option<string>;
  readonly subjectEntityId: O.Option<string>;
  readonly subjectAttribution: O.Option<SubjectAttribution>;
  readonly sourceCapturedAt: O.Option<DateTime.Utc>;
  readonly clientDeviceId: O.Option<string>;
}): MemoryDB => {
  const resolved = resolveSubject(input);
  const memoryId = documentIdFromSeed(input.memory.content);
  const sourceId = O.orElse(input.sourceId, () => O.orElse(input.conversationId, () => O.some(`external:${memoryId}`)));
  const sourceType = O.getOrElse(input.sourceType, () => (O.isSome(input.conversationId) ? "conversation" : "developer_api"));
  const sourceSignal = O.getOrElse(input.sourceSignal, () => (input.manuallyAdded ? "manual" : "transcription"));
  const context = input.memory.captureContext;
  const evidence = evidenceFromSource({
    sourceId: O.isSome(context) ? context.value.sourceId : sourceId,
    sourceType,
    sourceSignal: O.isSome(context) ? O.getOrElse(context.value.sourceSignal, () => sourceSignal) : sourceSignal,
    extractorId: "memory_extractor",
    extractorVersion: "v1",
    artifactRef: O.none(),
    captureConfidence: input.memory.captureConfidence,
    independenceGroup: O.isSome(context)
      ? O.orElse(context.value.independenceGroup, () => O.orElse(context.value.lineageId, () => O.some("unknown")))
      : sourceId,
    createdAt: input.now,
    clientDeviceId: input.clientDeviceId,
  });
  const captured = Evidence.make({
    ...evidence,
    capturedAt: O.isSome(context)
      ? O.getOrElse(context.value.capturedAt, () => O.getOrElse(input.sourceCapturedAt, () => input.now))
      : O.getOrElse(input.sourceCapturedAt, () => input.now),
    sourceVersion: O.isSome(context) ? context.value.sourceVersion : evidence.sourceVersion,
    lineageId: O.isSome(context) ? context.value.lineageId : evidence.lineageId,
    attribution: O.isSome(context) ? context.value.attribution : evidence.attribution,
    quoteRefs: O.isSome(context) ? context.value.quoteRefs : evidence.quoteRefs,
  });
  const confidence = confidenceFieldsForEvidence({
    evidence: [captured],
    subjectAttribution: resolved.attribution,
    existingCaptureConfidence: input.memory.captureConfidence,
  });
  const tier = decideInitialMemoryTier({ manuallyAdded: input.manuallyAdded, durability: input.memory.durability });
  return MemoryDB.make({
    id: memoryId,
    uid: input.uid,
    memoryId: O.some(memoryId),
    content: input.memory.content,
    category: input.memory.category,
    tags: input.memory.tags,
    createdAt: input.now,
    updatedAt: input.now,
    validAt: O.some(input.now),
    conversationId: input.conversationId,
    manuallyAdded: input.manuallyAdded,
    userReview: input.manuallyAdded ? O.some(true) : O.none(),
    reviewed: true,
    visibility: input.memory.visibility,
    predicate: input.memory.predicate,
    arguments: input.memory.arguments,
    subjectEntityId: resolved.subject,
    subjectAttribution: resolved.attribution,
    objectEntityIds: input.memory.objectEntityIds,
    qualifiers: input.memory.qualifiers,
    evidence: [captured],
    captureConfidence: O.some(confidence.captureConfidence),
    veracity: O.some(confidence.veracity),
    uncertaintyReasons: A.fromIterable(confidence.uncertaintyReasons),
    durability: input.memory.durability,
    memoryTier: O.some(tier),
    subjectScope: input.memory.subjectScope,
    beliefClass: input.memory.beliefClass,
    halfLifeDays: input.memory.halfLifeDays,
    invalidAt: input.memory.validTo,
    scoring: O.some(
      calculateScore({ category: input.memory.category, manuallyAdded: input.manuallyAdded, createdAt: input.now }),
    ),
  });
};

/**
 * Stores a memory as a legacy short-term shadow row.
 *
 * **Details**
 *
 * The id seed is `short-term|{uid}|{sourceId}|{content}`. A missing source id
 * is the text `None`, matching a Python f-string. Qualifiers gain `valid_from`
 * when it is absent, and an importance value when one is supplied.
 *
 * **Example** (Store a short-term fact)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { Memory, shortTermFromMemory } from "@beep/scratchpad/beep/Memories"
 *
 * const stored = shortTermFromMemory({
 *   memory: Memory.make({ content: "Ada" }),
 *   uid: "user-1",
 *   sourceId: O.some("src"),
 *   now: DateTime.unsafeMake("2020-01-02T03:04:05.000Z"),
 *   sourceType: O.none(),
 *   sourceSignal: O.none(),
 *   scope: O.none(),
 *   importance: O.none(),
 *   subjectEntityId: O.none(),
 *   subjectAttribution: O.none(),
 *   clientDeviceId: O.none(),
 * })
 * console.log(stored.status) // "pending_consolidation"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const shortTermFromMemory = (input: {
  readonly memory: Memory;
  readonly manuallyAdded: boolean;
  readonly uid: string;
  readonly sourceId: O.Option<string>;
  readonly now: DateTime.Utc;
  readonly sourceType: O.Option<string>;
  readonly sourceSignal: O.Option<string>;
  readonly scope: O.Option<string>;
  readonly importance: O.Option<number>;
  readonly subjectEntityId: O.Option<string>;
  readonly subjectAttribution: O.Option<SubjectAttribution>;
  readonly clientDeviceId: O.Option<string>;
}): ShortTermMemory => {
  const resolved = resolveSubject(input);
  const sourceIdText = O.getOrElse(input.sourceId, () => "None");
  const sourceType = O.getOrElse(input.sourceType, () => "conversation");
  const sourceSignal = O.getOrElse(input.sourceSignal, () => (input.manuallyAdded ? "manual" : "transcription"));
  const evidence = evidenceFromSource({
    sourceId: input.sourceId,
    sourceType,
    sourceSignal,
    extractorId: "memory_extractor",
    extractorVersion: "v1",
    artifactRef: O.none(),
    captureConfidence: input.memory.captureConfidence,
    independenceGroup: input.sourceId,
    createdAt: input.now,
    clientDeviceId: input.clientDeviceId,
  });
  const qualifiers = O.isSome(input.importance)
    ? Rec.set(input.memory.qualifiers, "importance", input.importance.value)
    : input.memory.qualifiers;
  const withValidFrom = Rec.has(qualifiers, "valid_from") ? qualifiers : Rec.set(qualifiers, "valid_from", DateTime.formatIso(input.now));
  const confidence = confidenceFieldsForEvidence({
    evidence: [evidence],
    subjectAttribution: resolved.attribution,
    existingCaptureConfidence: input.memory.captureConfidence,
  });
  return ShortTermMemory.make({
    id: documentIdFromSeed(`short-term|${input.uid}|${sourceIdText}|${input.memory.content}`),
    uid: input.uid,
    content: input.memory.content,
    category: input.memory.category,
    tags: input.memory.tags,
    visibility: input.memory.visibility,
    headline: input.memory.headline,
    sourceId: input.sourceId,
    sourceType,
    sourceSignal: O.some(sourceSignal),
    scope: O.getOrElse(input.scope, () => "global"),
    status: "pending_consolidation",
    predicate: input.memory.predicate,
    arguments: input.memory.arguments,
    subjectEntityId: resolved.subject,
    subjectAttribution: resolved.attribution,
    objectEntityIds: input.memory.objectEntityIds,
    qualifiers: withValidFrom,
    captureConfidence: O.some(confidence.captureConfidence),
    veracity: O.some(confidence.veracity),
    uncertaintyReasons: A.fromIterable(confidence.uncertaintyReasons),
    durability: input.memory.durability,
    evidence: [evidence],
    createdAt: input.now,
    updatedAt: input.now,
  });
};

export const getMemoriesAsStr = (memories: ReadonlyArray<object>): string =>
  A.join("")(
    A.map(memories, (memory) => {
      const content = typeof readField(memory, "content") === "string" ? readField(memory, "content") : "";
      const stamp = readField(memory, "asOf");
      const created = readField(memory, "createdAt");
      const when = DateTime.isDateTime(stamp) ? stamp : DateTime.isDateTime(created) ? created : undefined;
      if (when === undefined) return `- ${content}\n`;
      const iso = DateTime.formatIso(when);
      return `- ${content} (${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC)\n`;
    }),
  );
