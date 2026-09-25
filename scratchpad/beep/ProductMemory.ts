/**
 * Product Memories record: one store, layer-tagged.
 *
 * **Details**
 *
 * `tier` is the stored product field. Canonical vocabulary calls that axis
 * layer. `category` is not a layer, and Workflow is not a memory.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import * as Crypto from "effect/Crypto";
import { dual } from "effect/Function";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import { Model, NonNegativeInt, optionalNull, pg, Table, textBoundsCheck } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/ProductMemory");

const awareInstant =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

const emptyStrings: ReadonlyArray<string> = [];

/**
 * Short-term adjudication window in hours.
 *
 * **Details**
 *
 * Short-term TTL is an adjudication deadline, not a visibility switch. Reaching
 * it never hides an unadjudicated active item.
 *
 * **Example** (Read the window)
 *
 * ```ts
 * import { DEFAULT_SHORT_TERM_TTL_HOURS } from "./ProductMemory.ts"
 *
 * console.log(DEFAULT_SHORT_TERM_TTL_HOURS) // 48
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SHORT_TERM_TTL_HOURS = 48;

/**
 * Short-term adjudication window in days.
 *
 * **Example** (Read the window)
 *
 * ```ts
 * import { DEFAULT_SHORT_TERM_TTL_DAYS } from "./ProductMemory.ts"
 *
 * console.log(DEFAULT_SHORT_TERM_TTL_DAYS) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_SHORT_TERM_TTL_DAYS = 2;

/**
 * Maximum content length, in characters, that `normalizeMemoryItem` accepts for a `knowledge_ledger.v1` row.
 *
 * **Example** (Check a draft against the content limit)
 *
 * ```ts
 * import { MAX_LEDGER_CONTENT_CHARACTERS } from "./ProductMemory.ts"
 *
 * const draft = "Prefers aisle seats on long flights."
 *
 * console.log(draft.length <= MAX_LEDGER_CONTENT_CHARACTERS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_CONTENT_CHARACTERS = 4000;
/**
 * Maximum body length, in characters, for a `knowledge_ledger.v1` document row.
 *
 * **Example** (Reject an oversized playbook body)
 *
 * ```ts
 * import { MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS } from "./ProductMemory.ts"
 *
 * const body = "x".repeat(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS + 1)
 *
 * console.log(body.length > MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS = 24000;
/**
 * Maximum slot name length, in characters, for a `knowledge_ledger.v1` fact row.
 *
 * **Example** (Check a slot name)
 *
 * ```ts
 * import { MAX_LEDGER_SLOT_CHARACTERS } from "./ProductMemory.ts"
 *
 * console.log("home_city".length <= MAX_LEDGER_SLOT_CHARACTERS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_SLOT_CHARACTERS = 64;
/**
 * Maximum number of top-level keys a `knowledge_ledger.v1` trigger condition may carry.
 *
 * **Example** (Count trigger condition keys)
 *
 * ```ts
 * import { MAX_LEDGER_TRIGGER_CONDITION_KEYS } from "./ProductMemory.ts"
 *
 * const condition = { weekday: "monday", place: "office" }
 *
 * console.log(Object.keys(condition).length <= MAX_LEDGER_TRIGGER_CONDITION_KEYS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_TRIGGER_CONDITION_KEYS = 13;
/**
 * Maximum length, in characters, of a ledger trigger condition once serialized to JSON.
 *
 * **Example** (Measure a serialized trigger condition)
 *
 * ```ts
 * import { MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS } from "./ProductMemory.ts"
 *
 * const serialized = JSON.stringify({ weekday: "monday" })
 *
 * console.log(serialized.length <= MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS = 8000;
/**
 * Byte budget for the serialized ledger `arguments` JSON object on a memory item.
 *
 * **Example** (Measure encoded argument bytes)
 *
 * ```ts
 * import { MAX_MEMORY_ARGUMENTS_JSON_BYTES } from "./ProductMemory.ts"
 *
 * const bytes = new TextEncoder().encode(JSON.stringify({ city: "Lisbon" })).length
 *
 * console.log(bytes <= MAX_MEMORY_ARGUMENTS_JSON_BYTES) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_MEMORY_ARGUMENTS_JSON_BYTES = 8 * 1024;

/**
 * Sensitivity labels that block default and archive reads.
 *
 * **Example** (Recognize a health label)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { restrictedSensitivityLabels } from "./ProductMemory.ts"
 *
 * console.log(HashSet.has(restrictedSensitivityLabels, "health")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const restrictedSensitivityLabels = HashSet.make(
  "credential",
  "secret",
  "financial",
  "health",
  "intimate",
  "minor",
  "minors",
  "workplace_confidential",
  "identity_authentication",
);

const knownVisibility = HashSet.make("private", "public", "shared");
const grantConsumers = HashSet.make("third_party", "developer_api", "mcp");

/**
 * Product lifecycle layer stored as `tier`.
 *
 * **Details**
 *
 * Short-term is broad new intake. Long-term is a durable fact admitted by an
 * atomic promote. Archive is aged-out long-term kept for explicit recall.
 * `context_only` is not a layer.
 *
 * **Example** (Read the short-term wire value)
 *
 * ```ts
 * import { MemoryLayer } from "./ProductMemory.ts"
 *
 * console.log(MemoryLayer.literals.includes("short_term")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryLayer = LiteralKit(["short_term", "long_term", "archive"]).pipe(
  $I.annoteSchema("MemoryLayer", {
    description: "Product lifecycle layer. The stored field name remains tier.",
  }),
);

/**
 * Decoded type of {@link MemoryLayer}.
 *
 * @see {@link MemoryLayer} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryLayer = typeof MemoryLayer.Type;
/**
 * Encoded shape of {@link MemoryLayer}.
 *
 * @see {@link MemoryLayer} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryLayer {
  /** Encoded form of {@link MemoryLayer}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryLayer>;
}

/**
 * Legacy name for {@link MemoryLayer}. The wire values are unchanged.
 *
 * **Gotchas**
 *
 * `MemoryTier` is an alias of the layer enum. It is not a second axis.
 *
 * **Example** (Share the layer members)
 *
 * ```ts
 * import { MemoryLayer, MemoryTier } from "./ProductMemory.ts"
 *
 * console.log(MemoryTier === MemoryLayer) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryTier = MemoryLayer;

/**
 * Alias of {@link MemoryLayer}.
 *
 * @see {@link MemoryLayer} for the aliased type.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryTier = MemoryLayer;

/**
 * Ledger kind. It is not the lifecycle authority.
 *
 * **Example** (Read the fact kind)
 *
 * ```ts
 * import { MemoryKind } from "./ProductMemory.ts"
 *
 * console.log(MemoryKind.literals.includes("fact")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryKind = LiteralKit(["fact", "document", "trigger"]).pipe(
  $I.annoteSchema("MemoryKind", { description: "Semantic ledger kind. Tier remains the storage layer." }),
);
/**
 * Decoded type of {@link MemoryKind}.
 *
 * @see {@link MemoryKind} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryKind = typeof MemoryKind.Type;

/**
 * Who the memory is about.
 *
 * **Example** (Read the primary-user scope)
 *
 * ```ts
 * import { MemorySubjectScope } from "./ProductMemory.ts"
 *
 * console.log(MemorySubjectScope.literals.includes("primary_user")) // true
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
]).pipe($I.annoteSchema("MemorySubjectScope", { description: "Subject the memory is about." }));
/**
 * Decoded type of {@link MemorySubjectScope}.
 *
 * @see {@link MemorySubjectScope} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemorySubjectScope = typeof MemorySubjectScope.Type;

/**
 * Why a knowledge-ledger row was written.
 *
 * **Example** (Read legacy migration)
 *
 * ```ts
 * import { LedgerWriteReason } from "./ProductMemory.ts"
 *
 * console.log(LedgerWriteReason.literals.includes("legacy_migration")) // true
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
]).pipe($I.annoteSchema("LedgerWriteReason", { description: "Why a knowledge-ledger row was written." }));
/**
 * Decoded type of {@link LedgerWriteReason}.
 *
 * @see {@link LedgerWriteReason} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type LedgerWriteReason = typeof LedgerWriteReason.Type;

/**
 * Record lifecycle. Distinct from layer and processing state.
 *
 * **Gotchas**
 *
 * `hidden` stays the stored value. This model does not rewrite it to
 * `tombstoned`. Non-active statuses, including both, are excluded from default reads.
 *
 * **Example** (Read tombstoned)
 *
 * ```ts
 * import { MemoryItemStatus } from "./ProductMemory.ts"
 *
 * console.log(MemoryItemStatus.literals.includes("tombstoned")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryItemStatus = LiteralKit(["active", "superseded", "hidden", "tombstoned"]).pipe(
  $I.annoteSchema("MemoryItemStatus", { description: "Record lifecycle, distinct from layer and processing state." }),
);
/**
 * Decoded type of {@link MemoryItemStatus}.
 *
 * @see {@link MemoryItemStatus} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryItemStatus = typeof MemoryItemStatus.Type;

/**
 * Internal pipeline state. Never a product layer.
 *
 * **Example** (Read processed)
 *
 * ```ts
 * import { ProcessingState } from "./ProductMemory.ts"
 *
 * console.log(ProcessingState.literals.includes("processed")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProcessingState = LiteralKit(["pending", "processed", "blocked"]).pipe(
  $I.annoteSchema("ProcessingState", { description: "Internal pipeline state. Not a product layer." }),
);
/**
 * Decoded type of {@link ProcessingState}.
 *
 * @see {@link ProcessingState} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ProcessingState = typeof ProcessingState.Type;

/**
 * Reader that is asking for a memory.
 *
 * **Example** (Read chat)
 *
 * ```ts
 * import { MemoryConsumer } from "./ProductMemory.ts"
 *
 * console.log(MemoryConsumer.literals.includes("omi_chat")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryConsumer = LiteralKit([
  "omi_chat",
  "agent",
  "third_party",
  "developer_api",
  "mcp",
  "admin_debug",
  "eval",
  "unknown",
]).pipe($I.annoteSchema("MemoryConsumer", { description: "Reader asking for a memory." }));
/**
 * Decoded type of {@link MemoryConsumer}.
 *
 * @see {@link MemoryConsumer} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryConsumer = typeof MemoryConsumer.Type;

const isMemoryConsumer = S.is(MemoryConsumer);

/**
 * Evidence source lifecycle embedded on a product memory.
 *
 * **Example** (Read active)
 *
 * ```ts
 * import { SourceState } from "./ProductMemory.ts"
 *
 * console.log(SourceState.literals.includes("active")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceState = LiteralKit(["active", "missing", "tombstoned", "purged"]).pipe(
  $I.annoteSchema("SourceState", { description: "Evidence source lifecycle embedded on a product memory." }),
);
/**
 * Decoded type of {@link SourceState}.
 *
 * @see {@link SourceState} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type SourceState = typeof SourceState.Type;

const AwareUtcTimestamp = S.String.check(S.isPattern(awareInstant)).pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: SchemaGetter.transform((input: string) => DateTime.toUtc(DateTime.makeUnsafe(input))),
    encode: SchemaGetter.transform(DateTime.formatIso),
  }),
);

const awareColumn = (column: string, description: string) =>
  AwareUtcTimestamp.annotateKey({ description }).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

const optionalAware = (column: string, description: string) =>
  optionalNull(AwareUtcTimestamp).annotateKey({ description }).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

const nonBlank = S.makeFilter((value: string) => (Str.isEmpty(Str.trim(value)) ? "required fields must not be blank" : undefined));

const triggerJson = S.fromJsonString(S.JsonObject);

const triggerWithinLimit = S.makeFilter((value: typeof triggerJson.Type) =>
  Str.length(S.encodeSync(triggerJson)(value)) > MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS
    ? "ledger trigger condition exceeds the serialized limit"
    : undefined,
);

/**
 * Product memory failed an invariant.
 *
 * **Example** (Name a blank id)
 *
 * ```ts
 * import { MemoryItemRejected } from "./ProductMemory.ts"
 *
 * console.log(MemoryItemRejected.make({ reason: "active memory requires content" }).reason) // "active memory requires content"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryItemRejected extends S.TaggedError<MemoryItemRejected>()(
  "MemoryItemRejected",
  { reason: S.String },
  $I.annoteError<MemoryItemRejected>("MemoryItemRejected", {
    description: "A product memory item failed a lifecycle or ledger invariant.",
  }),
) {}

/**
 * Encoded shape of {@link MemoryItemRejected}.
 *
 * @see {@link MemoryItemRejected} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryItemRejected {
  /** Encoded form of {@link MemoryItemRejected}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryItemRejected>;
}

/**
 * Evidence identities this product row reads. The full evidence record lives in memory evidence.
 *
 * **Gotchas**
 *
 * Device id is not an input to the normalized content key. Absent source ids are unknown, not proof
 * that the user authored the capture.
 *
 * **Example** (Link a conversation)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryEvidenceLink } from "./ProductMemory.ts"
 *
 * const link = MemoryEvidenceLink.make({ conversationId: O.some("conversation-1") })
 * console.log(link.sourceState) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryEvidenceLink extends Model<MemoryEvidenceLink>("MemoryEvidenceLink")(
  {
    sourceId: optionalNull(S.String)
      .annotateKey({ description: "Evidence source id. Empty is ignored by sourceIds." })
      .pipe(pg.text(), pg.columnName("source_id")),
    conversationId: optionalNull(S.String)
      .annotateKey({ description: "Upstream conversation id. A conversation is not a memory." })
      .pipe(pg.text(), pg.columnName("conversation_id")),
    sourceState: SourceState.annotateKey({ description: "Evidence source lifecycle." }).pipe(
      S.withConstructorDefault(Effect.succeed<SourceState>("active")),
      pg.text(),
      pg.columnName("source_state"),
    ),
  },
  $I.annote("MemoryEvidenceLink", {
    description: "Evidence identities a product memory reads when projecting source ids.",
  }),
) {}

/**
 * Encoded shape of {@link MemoryEvidenceLink}.
 *
 * @see {@link MemoryEvidenceLink} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryEvidenceLink {
  /** Encoded form of {@link MemoryEvidenceLink}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryEvidenceLink>;
}

/**
 * Allow or deny a memory read, with an open reason code.
 *
 * **Example** (Allow a default read)
 *
 * ```ts
 * import { AccessDecision } from "./ProductMemory.ts"
 *
 * console.log(AccessDecision.make({ allowed: true, reason: "default_memory_allowed" }).allowed) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccessDecision extends Model<AccessDecision>("AccessDecision")(
  {
    allowed: S.Boolean.annotateKey({ description: "Whether the read may proceed." }).pipe(
      pg.boolean(),
      pg.columnName("allowed"),
    ),
    reason: S.String.annotateKey({ description: "Open reason code." }).pipe(pg.text(), pg.columnName("reason")),
  },
  $I.annote("AccessDecision", { description: "Allow or deny a memory read." }),
) {}

/**
 * Encoded shape of {@link AccessDecision}.
 *
 * @see {@link AccessDecision} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AccessDecision {
  /** Encoded form of {@link AccessDecision}. */
  export type Encoded = S.Codec.Encoded<typeof AccessDecision>;
}

/**
 * Who is reading, and which grants they hold.
 *
 * **Details**
 *
 * `rawProvenanceCapability` is stored and is not read by the helpers in this module.
 *
 * **Example** (Grant chat archive access)
 *
 * ```ts
 * import { memoryAccessPolicyForOmiChat } from "./ProductMemory.ts"
 *
 * console.log(memoryAccessPolicyForOmiChat(true).archiveCapability) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryAccessPolicy extends Model<MemoryAccessPolicy>("MemoryAccessPolicy")(
  {
    consumer: MemoryConsumer.annotateKey({ description: "Reader asking for the memory." }).pipe(
      pg.text(),
      pg.columnName("consumer"),
    ),
    appHasDefaultMemoryGrant: S.Boolean.annotateKey({ description: "Third-party default-memory grant." }).pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("app_has_default_memory_grant"),
    ),
    archiveCapability: S.Boolean.annotateKey({ description: "Explicit archive recall capability." }).pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("archive_capability"),
    ),
    rawProvenanceCapability: S.Boolean.annotateKey({
      description: "Raw provenance capability. Not read by the access helpers.",
    }).pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("raw_provenance_capability")),
  },
  $I.annote("MemoryAccessPolicy", { description: "Reader and the memory grants they hold." }),
) {}

/**
 * Encoded shape of {@link MemoryAccessPolicy}.
 *
 * @see {@link MemoryAccessPolicy} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryAccessPolicy {
  /** Encoded form of {@link MemoryAccessPolicy}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryAccessPolicy>;
}

/**
 * Chat policy with the default memory grant.
 *
 * **Example** (Omit archive)
 *
 * ```ts
 * import { memoryAccessPolicyForOmiChat } from "./ProductMemory.ts"
 *
 * console.log(memoryAccessPolicyForOmiChat().consumer) // "omi_chat"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const memoryAccessPolicyForOmiChat = (archiveCapability = false): MemoryAccessPolicy =>
  MemoryAccessPolicy.make({
    consumer: "omi_chat",
    appHasDefaultMemoryGrant: true,
    archiveCapability,
    rawProvenanceCapability: false,
  });

/**
 * Third-party policy. The default grant is off unless the caller sets it.
 *
 * **Example** (Require a grant)
 *
 * ```ts
 * import { memoryAccessPolicyForThirdParty } from "./ProductMemory.ts"
 *
 * console.log(memoryAccessPolicyForThirdParty().appHasDefaultMemoryGrant) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const memoryAccessPolicyForThirdParty = (input?: {
  readonly appHasDefaultMemoryGrant?: boolean;
  readonly archiveCapability?: boolean;
}): MemoryAccessPolicy =>
  MemoryAccessPolicy.make({
    consumer: "third_party",
    appHasDefaultMemoryGrant: input?.appHasDefaultMemoryGrant ?? false,
    archiveCapability: input?.archiveCapability ?? false,
    rawProvenanceCapability: false,
  });

/**
 * Alias from an old memory id to a canonical id.
 *
 * **Example** (Point at a different id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { MemoryItemAlias } from "./ProductMemory.ts"
 *
 * const alias = MemoryItemAlias.make({
 *   oldMemoryId: "mem-old",
 *   canonicalMemoryId: "mem-new",
 *   uid: "user-1",
 *   reason: "merge",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(alias.canonicalMemoryId) // "mem-new"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryItemAlias extends Model<MemoryItemAlias>("MemoryItemAlias")(
  {
    oldMemoryId: S.String.annotateKey({ description: "Previous memory id." }).pipe(pg.text(), pg.columnName("old_memory_id")),
    canonicalMemoryId: S.String.annotateKey({ description: "Canonical memory id. Must differ from the old id." }).pipe(
      pg.text(),
      pg.columnName("canonical_memory_id"),
    ),
    uid: S.String.annotateKey({ description: "Account uid." }).pipe(pg.text(), pg.columnName("uid")),
    reason: S.String.annotateKey({ description: "Open alias reason." }).pipe(pg.text(), pg.columnName("reason")),
    createdAt: awareColumn("created_at", "Aware alias creation instant."),
  },
  $I.annote("MemoryItemAlias", { description: "Alias from an old memory id to a canonical id." }),
) {}

/**
 * Encoded shape of {@link MemoryItemAlias}.
 *
 * @see {@link MemoryItemAlias} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryItemAlias {
  /** Encoded form of {@link MemoryItemAlias}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryItemAlias>;
}

/**
 * Reject an alias that points at itself.
 *
 * **Example** (Reject a self alias)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 * import { MemoryItemAlias, assertMemoryItemAlias } from "./ProductMemory.ts"
 *
 * const alias = MemoryItemAlias.make({
 *   oldMemoryId: "mem-1",
 *   canonicalMemoryId: "mem-1",
 *   uid: "user-1",
 *   reason: "merge",
 *   createdAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * console.log(Exit.isFailure(Effect.runSyncExit(assertMemoryItemAlias(alias)))) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const assertMemoryItemAlias = Effect.fn("MemoryItemAlias.assertMemoryItemAlias")(function* (alias: MemoryItemAlias) {
  if (alias.oldMemoryId === alias.canonicalMemoryId) {
    return yield* MemoryItemRejected.make({ reason: "alias cannot point to self" });
  }
  return alias;
});

const boolDefault = (column: string, value: boolean, description: string) =>
  S.Boolean.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed(value)),
    pg.boolean(),
    pg.columnName(column),
  );

const intDefault = (column: string, value: number, description: string) =>
  S.Int.annotateKey({ description }).pipe(
    S.withConstructorDefault(Effect.succeed(value)),
    pg.integer(),
    pg.columnName(column),
  );

const nullableText = (column: string, description: string) =>
  optionalNull(S.String).annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

/**
 * One product memory in the unified Memories store.
 *
 * **Details**
 *
 * Layer, status, and processing state are three axes. Short-term, long-term,
 * and archive are the only product layers. Active long-term rows require a
 * ledger commit, a ledger sequence, and `processing_state=processed`. Archive
 * is the only product meaning of archive; pipeline archive artifacts are not
 * this layer. Short-term `expiresAt` is an adjudication deadline. The content
 * key is required and may be null. `normalizedContentKey` is derived.
 *
 * **Gotchas**
 *
 * The stored field is `tier`, not `layer`. `hidden` is not rewritten to
 * `tombstoned`. Expired short-term rows stay default-readable with reason
 * `short_term_expired_pending_adjudication`. `context_only` is not a tier.
 * Device ids on the capture fields are not inputs to the content key.
 * This validator is the product-item invariant. The full legal
 * layer/status/processing matrix, including archive requiring processed and
 * archive never being superseded, is owned by the memory-domain record.
 *
 * **Example** (Decode null content as None)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MemoryItem } from "./ProductMemory.ts"
 *
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "short_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.none(),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   expiresAt: O.some(DateTime.makeUnsafe("2020-01-04T03:04:05.000Z")),
 * })
 * const wire = S.encodeSync(MemoryItem)(item)
 * const decoded = S.decodeUnknownSync(MemoryItem)(wire)
 *
 * console.log(wire.content) // null
 * console.log(O.isNone(decoded.content)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryItem extends Model<MemoryItem>("MemoryItem")(
  {
    memoryId: S.String.check(S.isMinLength(1), nonBlank)
      .annotateKey({ description: "Stable canonical record id." })
      .pipe(pg.text(), pg.columnName("memory_id")),
    uid: S.String.check(S.isMinLength(1), nonBlank)
      .annotateKey({ description: "Account uid." })
      .pipe(pg.text(), pg.columnName("uid")),
    canonicalMemoryId: nullableText("canonical_memory_id", "Canonical id when this row is an alias target."),
    version: S.Int.check(S.isGreaterThanOrEqualTo(1))
      .annotateKey({ description: "Positive item version." })
      .pipe(pg.integer(), pg.columnName("version")),
    tier: MemoryLayer.annotateKey({ description: "Product layer. Wire values stay short_term, long_term, and archive." }).pipe(
      pg.text(),
      pg.columnName("tier"),
    ),
    status: MemoryItemStatus.annotateKey({ description: "Record lifecycle." }).pipe(pg.text(), pg.columnName("status")),
    processingState: ProcessingState.annotateKey({ description: "Internal pipeline state." }).pipe(
      pg.text(),
      pg.columnName("processing_state"),
    ),
    content: S.OptionFromNullOr(S.String)
      .annotateKey({ description: "Memory content. The key is required and the value may be null." })
      .pipe(pg.text(), pg.columnName("content")),
    normalizedContentKey: nullableText("normalized_content_key", "NFKC casefolded content hash. Derived, not caller authority."),
    evidence: S.Array(MemoryEvidenceLink)
      .annotateKey({ description: "Embedded evidence identities." })
      .pipe(S.withConstructorDefault(Effect.succeed(A.empty<MemoryEvidenceLink>())), pg.jsonb(), pg.columnName("evidence")),
    sourceState: SourceState.annotateKey({ description: "Aggregate source lifecycle." }).pipe(
      pg.text(),
      pg.columnName("source_state"),
    ),
    sensitivityLabels: S.Array(S.String)
      .annotateKey({ description: "Lowercased unique sensitivity labels." })
      .pipe(pg.jsonb(), pg.columnName("sensitivity_labels")),
    visibility: S.String.check(S.isMinLength(1), nonBlank)
      .annotateKey({ description: "Open visibility. Policy allows private, public, and shared." })
      .pipe(pg.text(), pg.columnName("visibility")),
    userAsserted: S.Boolean.annotateKey({ description: "Whether the user asserted the memory directly." }).pipe(
      pg.boolean(),
      pg.columnName("user_asserted"),
    ),
    capturedAt: awareColumn("captured_at", "Aware capture instant."),
    updatedAt: awareColumn("updated_at", "Aware update instant. Must be at least capturedAt."),
    expiresAt: optionalAware("expires_at", "Short-term adjudication deadline. Null on long-term and archive."),
    ledgerCommitId: nullableText("ledger_commit_id", "Ledger commit required for active long-term rows."),
    ledgerSequence: optionalNull(S.Int)
      .annotateKey({ description: "Ledger sequence required for active long-term rows." })
      .pipe(pg.integer(), pg.columnName("ledger_sequence")),
    itemRevision: intDefault("item_revision", 1, "Item revision. Construction defaults to 1."),
    sourceCommitId: nullableText("source_commit_id", "Source commit id."),
    sourceCommitSequence: optionalNull(S.Int)
      .annotateKey({ description: "Source commit sequence." })
      .pipe(pg.integer(), pg.columnName("source_commit_sequence")),
    contentHash: nullableText("content_hash", "Content hash."),
    accountGeneration: NonNegativeInt.annotateKey({ description: "Account generation. Construction defaults to 0." }).pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      pg.integer(),
      pg.columnName("account_generation"),
    ),
    promotion: optionalNull(S.JsonObject)
      .annotateKey({ description: "Promotion receipt document. Presence is legacy lifecycle metadata." })
      .pipe(pg.jsonb(), pg.columnName("promotion")),
    captureDeviceIds: S.Array(S.String)
      .annotateKey({ description: "Optional capture devices. Not an input to the content key." })
      .pipe(S.withConstructorDefault(Effect.succeed(emptyStrings)), pg.jsonb(), pg.columnName("capture_device_ids")),
    primaryCaptureDevice: nullableText("primary_capture_device", "Primary capture device. Unknown when absent."),
    corroborationCount: intDefault("corroboration_count", 0, "Corroboration count."),
    lastCorroboratedAt: optionalAware("last_corroborated_at", "Last corroboration instant."),
    halfLifeDays: optionalNull(S.Finite)
      .annotateKey({ description: "Optional half life in days." })
      .pipe(pg.doublePrecision(), pg.columnName("half_life_days")),
    beliefClass: nullableText("belief_class", "Optional belief class."),
    confidence: optionalNull(S.Finite)
      .annotateKey({ description: "Optional confidence. This field has no unit-interval constraint." })
      .pipe(pg.doublePrecision(), pg.columnName("confidence")),
    supersededBy: nullableText("superseded_by", "Successor memory id."),
    subjectEntityId: nullableText("subject_entity_id", "Subject entity id."),
    predicate: nullableText("predicate", "Ledger predicate."),
    arguments: S.JsonObject.annotateKey({ description: "Ledger arguments." }).pipe(
      S.withConstructorDefault(Effect.succeed({})),
      pg.jsonb(),
      pg.columnName("arguments"),
    ),
    kgExtracted: boolDefault("kg_extracted", false, "Whether knowledge-graph extraction has run."),
    graphReady: boolDefault("graph_ready", false, "Whether an atomic graph assertion is ready."),
    graphAssertionId: nullableText("graph_assertion_id", "Graph assertion id required after admission."),
    graphPlanHash: nullableText("graph_plan_hash", "Graph plan hash required after admission."),
    ledgerSchemaVersion: nullableText("ledger_schema_version", "Ledger schema version. knowledge_ledger.v1 is capped."),
    kind: MemoryKind.annotateKey({ description: "Ledger kind. Construction defaults to fact." }).pipe(
      S.withConstructorDefault(Effect.succeed<MemoryKind>("fact")),
      pg.text(),
      pg.columnName("kind"),
    ),
    subjectScope: MemorySubjectScope.annotateKey({ description: "Subject scope. Construction defaults to primary_user." }).pipe(
      S.withConstructorDefault(Effect.succeed<MemorySubjectScope>("primary_user")),
      pg.text(),
      pg.columnName("subject_scope"),
    ),
    slot: nullableText("slot", "Fact slot. Illegal on document and trigger rows."),
    body: nullableText("body", "Document body. Illegal on non-document ledger rows."),
    validFrom: optionalAware("valid_from", "Validity start."),
    validTo: optionalAware("valid_to", "Validity end. Must be at least validFrom or capturedAt."),
    curationWeight: S.Int.check(S.isBetween({ minimum: -100, maximum: 100 }))
      .annotateKey({ description: "Curation weight from -100 through 100. Construction defaults to 0." })
      .pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName("curation_weight")),
    triggerCondition: S.JsonObject.check(triggerWithinLimit)
      .annotateKey({ description: "Trigger condition. Required for trigger rows and illegal otherwise." })
      .pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName("trigger_condition")),
    intentBacked: boolDefault("intent_backed", false, "Whether the ledger write is intent-backed."),
    writeReason: optionalNull(LedgerWriteReason)
      .annotateKey({ description: "Ledger write reason. Legacy migration may omit intent backing." })
      .pipe(pg.text(), pg.columnName("write_reason")),
  },
  $I.annote("MemoryItem", {
    description: "One product memory in the unified Memories store.",
  }),
  (columns) => [
    textBoundsCheck("memory_id", { minLength: 1 })(columns.memoryId),
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    textBoundsCheck("visibility", { minLength: 1 })(columns.visibility),
    Table.check("memory_id_nonblank")(sql<boolean>`char_length(btrim(${columns.memoryId})) >= 1`),
    Table.check("uid_nonblank")(sql<boolean>`char_length(btrim(${columns.uid})) >= 1`),
    Table.check("visibility_nonblank")(sql<boolean>`char_length(btrim(${columns.visibility})) >= 1`),
    Table.check("version_ge")(sql<boolean>`${columns.version} >= 1`),
    Table.check("curation_weight_range")(sql<boolean>`${columns.curationWeight} >= -100 and ${columns.curationWeight} <= 100`),
    Table.check("account_generation_nn")(sql<boolean>`${columns.accountGeneration} >= 0`),
  ],
) {}

/**
 * Encoded shape of {@link MemoryItem}.
 *
 * @see {@link MemoryItem} for the runtime schema and decoded type.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryItem {
  /** Encoded form of {@link MemoryItem}. */
  export type Encoded = S.Codec.Encoded<typeof MemoryItem>;
}

const decodeUnknownEffectMemoryItem = S.decodeUnknownEffect(MemoryItem);
const isMemoryItem = S.is(MemoryItem);

const normalizeSensitivity = (labels: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(A.dedupe(A.filter(A.map(labels, (label) => Str.toLowerCase(Str.trim(label))), Str.isNonEmpty)), Order.String);

const normalizeSlot = (slot: O.Option<string>): O.Option<string> =>
  O.flatMap(slot, (value) => {
    const joined = A.join(A.filter(Str.split(Str.replaceAll("-", "_")(Str.toLowerCase(Str.trim(value))), /\s+/u), Str.isNonEmpty), "_");
    return Str.isEmpty(joined) ? O.none() : O.some(joined);
  });

const sha256Hex = Effect.fn("ProductMemory.sha256Hex")(function* (payload: string) {
  const digest = yield* Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)));
  return A.join(
    A.map(A.fromIterable(new Uint8Array(digest)), (byte) => {
      const text = byte.toString(16);
      return Str.length(text) === 1 ? `0${text}` : text;
    }),
    "",
  );
});

/**
 * Stable casefolded content identity used by authority-safe dedupe.
 *
 * **Details**
 *
 * Null and whitespace-only content have no key. Other content is NFKC
 * normalized, lowercased, collapsed to single spaces, and hashed with SHA-256.
 *
 * **Example** (Hash collapsed text)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { normalizedMemoryContentKey } from "./ProductMemory.ts"
 *
 * const keys = Effect.all([
 *   normalizedMemoryContentKey(O.some("Hello   World")),
 *   normalizedMemoryContentKey(O.some("hello world")),
 *   normalizedMemoryContentKey(O.some("   ")),
 * ])
 *
 * void Effect.runPromise(keys).then(([spaced, plain, blank]) => {
 *   console.log(O.getOrNull(spaced) === O.getOrNull(plain)) // true
 *   console.log(O.isNone(blank)) // true
 * })
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const normalizedMemoryContentKey = Effect.fn("normalizedMemoryContentKey")(function* (content: O.Option<string>) {
  if (O.isNone(content)) return O.none();
  const collapsed = A.join(A.filter(Str.split(Str.toLowerCase(content.value.normalize("NFKC")), /\s+/u), Str.isNonEmpty), " ");
  if (Str.isEmpty(collapsed)) return O.none();
  return O.some(yield* sha256Hex(collapsed));
});

const reject = (reason: string) => MemoryItemRejected.make({ reason });

/**
 * Apply derived fields and the product-item invariants.
 *
 * **Details**
 *
 * Sensitivity labels are trimmed, lowercased, and deduped. Slots are
 * lowercased with hyphens and whitespace folded to underscores. The content
 * key is overwritten from content. Active long-term rows need ledger identity
 * and processed state. An admission receipt also needs graph readiness.
 *
 * **Example** (Reject active memory without content)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { MemoryItem, normalizeMemoryItem } from "./ProductMemory.ts"
 *
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "long_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.none(),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 * })
 * const outcome = Effect.match(normalizeMemoryItem(item), {
 *   onFailure: (error) => error.reason,
 *   onSuccess: () => "ok",
 * })
 *
 * void Effect.runPromise(outcome).then((reason) => console.log(reason)) // "active memory requires content"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const normalizeMemoryItem = Effect.fn("MemoryItem.normalizeMemoryItem")(function* (item: MemoryItem) {
  const next = MemoryItem.make({
    ...item,
    sensitivityLabels: normalizeSensitivity(item.sensitivityLabels),
    slot: normalizeSlot(item.slot),
    normalizedContentKey: yield* normalizedMemoryContentKey(item.content),
  });
  if (DateTime.toEpochMillis(next.updatedAt) < DateTime.toEpochMillis(next.capturedAt)) {
    return yield* reject("updated_at must be >= captured_at");
  }
  if (next.status === "active" && next.content.pipe(O.getOrElse(() => ""), Str.trim, Str.isEmpty)) {
    return yield* reject("active memory requires content");
  }
  if (next.tier === "short_term") {
    if (O.isNone(next.expiresAt)) return yield* reject("short_term memory requires expires_at");
    if (DateTime.toEpochMillis(next.expiresAt.value) <= DateTime.toEpochMillis(next.capturedAt)) {
      return yield* reject("short_term expires_at must be after captured_at");
    }
  }
  if (next.tier === "long_term" && next.status === "active") {
    if (O.isNone(next.ledgerCommitId) || Str.isEmpty(Str.trim(next.ledgerCommitId.value))) {
      return yield* reject("active long_term memory requires ledger_commit_id");
    }
    if (O.isNone(next.ledgerSequence)) return yield* reject("active long_term memory requires ledger_sequence");
    if (next.processingState !== "processed") return yield* reject("active long_term memory requires processing_state=processed");
    if (
      O.isSome(
        next.promotion.pipe(
          O.flatMap((record) => {
            const value = record.admission_receipt;
            return value === undefined || value === null ? O.none() : O.some(value);
          }),
        ),
      ) &&
      (!next.graphReady || O.isNone(next.graphAssertionId) || O.isNone(next.graphPlanHash))
    ) {
      return yield* reject("admitted long_term memory requires an atomic graph assertion");
    }
  }
  if (next.sourceState === "active" && !next.userAsserted && !A.some(next.evidence, (evidence) => evidence.sourceState === "active")) {
    return yield* reject("active source memory requires at least one active evidence record");
  }
  if (O.isSome(next.validTo)) {
    const lower = O.getOrElse(next.validFrom, () => next.capturedAt);
    if (DateTime.toEpochMillis(next.validTo.value) < DateTime.toEpochMillis(lower)) {
      return yield* reject("valid_to must be >= valid_from");
    }
  }
  if (next.kind !== "fact" && O.isSome(next.slot)) return yield* reject("only fact ledger rows may define a slot");
  if (next.kind === "trigger" && Rec.isEmptyRecord(next.triggerCondition)) {
    return yield* reject("trigger ledger rows require trigger_condition");
  }
  if (next.kind !== "trigger" && !Rec.isEmptyRecord(next.triggerCondition)) {
    return yield* reject("trigger_condition is only valid for trigger ledger rows");
  }
  if (O.isSome(next.ledgerSchemaVersion) && next.ledgerSchemaVersion.value === "knowledge_ledger.v1") {
    if (Str.length(next.content.pipe(O.getOrElse(() => ""))) > MAX_LEDGER_CONTENT_CHARACTERS) {
      return yield* reject("knowledge ledger content exceeds the ledger limit");
    }
    if (Str.length(O.getOrElse(next.slot, () => "")) > MAX_LEDGER_SLOT_CHARACTERS) {
      return yield* reject("knowledge ledger slot exceeds the ledger limit");
    }
    if (next.kind === "document") {
      const body = O.getOrElse(next.body, () => "");
      if (Str.isEmpty(Str.trim(body))) return yield* reject("ledger documents require a non-empty body");
      if (Str.length(body) > MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS) return yield* reject("ledger document body exceeds the ledger limit");
    } else if (O.isSome(next.body)) {
      return yield* reject("ledger body is only valid for document rows");
    }
    if (Rec.keys(next.triggerCondition).length > MAX_LEDGER_TRIGGER_CONDITION_KEYS) {
      return yield* reject("ledger trigger condition exceeds the ledger key limit");
    }
    if (O.isNone(next.writeReason) || (!next.intentBacked && next.writeReason.value !== "legacy_migration")) {
      return yield* reject("knowledge ledger rows require an intent-backed write reason");
    }
  }
  return next;
});

/**
 * Decode a product memory and apply its derived fields.
 *
 * **Example** (Normalize sensitivity labels)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { decodeMemoryItem, MemoryItem } from "./ProductMemory.ts"
 *
 * const wire = S.encodeSync(MemoryItem)(
 *   MemoryItem.make({
 *     memoryId: "mem-1",
 *     uid: "user-1",
 *     version: 1,
 *     tier: "long_term",
 *     status: "superseded",
 *     processingState: "processed",
 *     content: O.some("Hello"),
 *     sourceState: "missing",
 *     sensitivityLabels: [" Health "],
 *     visibility: "private",
 *     userAsserted: true,
 *     capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *     updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   }),
 * )
 *
 * void Effect.runPromise(decodeMemoryItem(wire)).then((item) => {
 *   console.log(item.sensitivityLabels) // ["health"]
 *   console.log(O.isSome(item.normalizedContentKey)) // true
 * })
 * ```
 *
 * @see {@link normalizeMemoryItem} for the invariant list.
 * @category decoding
 * @since 0.0.0
 */
export const decodeMemoryItem = Effect.fn("MemoryItem.decodeMemoryItem")(function* (input: unknown) {
  return yield* normalizeMemoryItem(yield* decodeUnknownEffectMemoryItem(input));
});

/**
 * Exact query projection of the current embedded evidence identities.
 *
 * **Example** (Collect both ids)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { MemoryEvidenceLink, MemoryItem, sourceIds } from "./ProductMemory.ts"
 *
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "long_term",
 *   status: "superseded",
 *   processingState: "processed",
 *   content: O.some("Hello"),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   evidence: [MemoryEvidenceLink.make({ sourceId: O.some("source-1"), conversationId: O.some("conversation-1") })],
 * })
 * console.log(sourceIds(item).length) // 2
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const sourceIds = (item: MemoryItem): ReadonlyArray<string> =>
  A.sort(
    A.dedupe(
      A.flatMap(item.evidence, (evidence) =>
        A.getSomes([O.filter(evidence.sourceId, Str.isNonEmpty), O.filter(evidence.conversationId, Str.isNonEmpty)]),
      ),
    ),
    Order.String,
  );

/**
 * Report whether a row still carries legacy lifecycle audit metadata.
 *
 * **Example** (Treat an empty promotion document as present)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { MemoryItem, memoryItemHasLifecycleMetadata } from "./ProductMemory.ts"
 *
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "long_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.some("Prefers tea over coffee"),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   promotion: O.some({}),
 * })
 *
 * console.log(memoryItemHasLifecycleMetadata(item)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const memoryItemHasLifecycleMetadata = (item: MemoryItem): boolean => O.isSome(item.promotion);

const memoryIds = Crypto.make({
  randomBytes: (size) => {
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  },
  digest: (_algorithm, data) => Effect.succeed(data),
});

/**
 * Mint a fresh `mem_`-prefixed memory id from a random UUIDv4 with the dashes removed.
 *
 * **Example** (Prefix the id)
 *
 * ```ts
 * import { newMemoryId } from "./ProductMemory.ts"
 *
 * const id = newMemoryId()
 *
 * console.log(id.startsWith("mem_")) // true
 * console.log(id.length) // 36
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const newMemoryId = (): string =>
  `mem_${memoryIds.randomUUIDv4.pipe(Effect.runSync, Str.replaceAll("-", ""))}`;

/**
 * Add the 48-hour short-term policy window to a capture instant.
 *
 * **Example** (Add two days)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { defaultShortTermExpiry } from "./ProductMemory.ts"
 *
 * const expiry = defaultShortTermExpiry(DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"))
 * console.log(DateTime.formatIso(expiry)) // "2020-01-04T03:04:05.000Z"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const defaultShortTermExpiry = (capturedAt: DateTime.Utc): DateTime.Utc =>
  DateTime.add(capturedAt, { hours: DEFAULT_SHORT_TERM_TTL_HOURS });

/**
 * Return the sooner of the stored expiry and the current 48-hour policy.
 *
 * **Details**
 *
 * Already-written short-term rows may still carry a 30-day `expiresAt`.
 * Reads, promotion, and TTL decisions use this so those rows cannot linger
 * past the live policy window. A missing expiry uses the policy instant.
 *
 * **Example** (Clamp a far expiry)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { effectiveShortTermExpiry } from "./ProductMemory.ts"
 *
 * const capturedAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const expiry = effectiveShortTermExpiry({
 *   capturedAt,
 *   expiresAt: O.some(DateTime.add(capturedAt, { hours: 24 * 30 })),
 * })
 * console.log(DateTime.formatIso(expiry)) // "2020-01-04T03:04:05.000Z"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const effectiveShortTermExpiry = (item: Pick<MemoryItem, "capturedAt" | "expiresAt">): DateTime.Utc => {
  const policy = defaultShortTermExpiry(item.capturedAt);
  const stored = O.getOrElse(item.expiresAt, () => policy);
  return DateTime.toEpochMillis(stored) <= DateTime.toEpochMillis(policy) ? stored : policy;
};

const decision = (allowed: boolean, reason: string): AccessDecision => AccessDecision.make({ allowed, reason });

const basePolicyChecks = (item: MemoryItem, policy: MemoryAccessPolicy): O.Option<AccessDecision> => {
  if (item.status !== "active") return O.some(decision(false, "not_active"));
  if (item.processingState === "blocked") return O.some(decision(false, "processing_blocked"));
  if (item.sourceState === "tombstoned" || item.sourceState === "purged") return O.some(decision(false, "source_not_active"));
  if (policy.consumer === "unknown") return O.some(decision(false, "unknown_consumer"));
  if (A.some(item.sensitivityLabels, (label) => HashSet.has(restrictedSensitivityLabels, label))) {
    return O.some(decision(false, "restricted_sensitivity"));
  }
  if (!HashSet.has(knownVisibility, item.visibility)) return O.some(decision(false, "unknown_visibility"));
  return O.none();
};

/**
 * Decide whether a memory is eligible for a default read.
 *
 * **Gotchas**
 *
 * An expired active short-term row remains readable until canonical apply
 * promotes, archives, reviews, or rejects it. The reason is
 * `short_term_expired_pending_adjudication`. Archive rows are not default-visible.
 *
 * **Example** (Keep an expired short-term row readable)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { MemoryItem, isDefaultAccessEligible, memoryAccessPolicyForOmiChat } from "./ProductMemory.ts"
 *
 * const capturedAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "short_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.some("Hello"),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt,
 *   updatedAt: capturedAt,
 *   expiresAt: O.some(capturedAt),
 * })
 * console.log(isDefaultAccessEligible(item, memoryAccessPolicyForOmiChat(), DateTime.add(capturedAt, { hours: 1 })).reason) // "short_term_expired_pending_adjudication"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const isDefaultAccessEligible: {
  (policy: MemoryAccessPolicy, now?: DateTime.Utc): (item: MemoryItem) => AccessDecision;
  (item: MemoryItem, policy: MemoryAccessPolicy, now?: DateTime.Utc): AccessDecision;
} = dual(
  (args) => isMemoryItem(args[0]),
  (item: MemoryItem, policy: MemoryAccessPolicy, now?: DateTime.Utc): AccessDecision => {
    const current = now ?? DateTime.toUtc(DateTime.nowUnsafe());
    const base = basePolicyChecks(item, policy);
    if (O.isSome(base)) return base.value;
    if (item.tier === "archive") return decision(false, "archive_requires_explicit_query");
    if (HashSet.has(grantConsumers, policy.consumer) && !policy.appHasDefaultMemoryGrant) {
      return decision(false, "missing_default_memory_grant");
    }
    if (item.tier === "short_term" && DateTime.toEpochMillis(effectiveShortTermExpiry(item)) <= DateTime.toEpochMillis(current)) {
      return decision(true, "short_term_expired_pending_adjudication");
    }
    if (item.tier === "short_term" || item.tier === "long_term") return decision(true, "default_memory_allowed");
    return decision(false, "unsupported_tier");
  },
);

/**
 * Decide whether a memory is eligible for an explicit archive read.
 *
 * **Details**
 *
 * Product `layer=archive` is the only archive this helper understands.
 *
 * **Example** (Refuse a long-term row)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { MemoryItem, isArchiveAccessEligible, memoryAccessPolicyForOmiChat } from "./ProductMemory.ts"
 *
 * const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "long_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.some("Prefers tea"),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: at,
 *   updatedAt: at,
 * })
 * const decision = isArchiveAccessEligible(item, memoryAccessPolicyForOmiChat(true))
 *
 * console.log(decision.allowed) // false
 * console.log(decision.reason) // "not_archive"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const isArchiveAccessEligible: {
  (policy: MemoryAccessPolicy, now?: DateTime.Utc): (item: MemoryItem) => AccessDecision;
  (item: MemoryItem, policy: MemoryAccessPolicy, now?: DateTime.Utc): AccessDecision;
} = dual(
  (args) => isMemoryItem(args[0]),
  (item: MemoryItem, policy: MemoryAccessPolicy, now?: DateTime.Utc): AccessDecision => {
    void now;
    const base = basePolicyChecks(item, policy);
    if (O.isSome(base)) return base.value;
    if (item.tier !== "archive") return decision(false, "not_archive");
    if (!policy.archiveCapability) return decision(false, "missing_archive_capability");
    return decision(true, "archive_explicit_allowed");
  },
);

/**
 * Derive default-read allowance for a consumer name.
 *
 * **Details**
 *
 * A known consumer receives the default memory grant. An unknown name becomes
 * the `unknown` consumer with the grant left off, which is denied.
 *
 * **Example** (Deny an unknown consumer)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import { derivedDefaultAccessAllowed, MemoryItem } from "./ProductMemory.ts"
 *
 * const at = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const item = MemoryItem.make({
 *   memoryId: "mem-1",
 *   uid: "user-1",
 *   version: 1,
 *   tier: "long_term",
 *   status: "active",
 *   processingState: "processed",
 *   content: O.some("Prefers tea"),
 *   sourceState: "active",
 *   sensitivityLabels: [],
 *   visibility: "private",
 *   userAsserted: true,
 *   capturedAt: at,
 *   updatedAt: at,
 * })
 *
 * console.log(derivedDefaultAccessAllowed(item, "omi_chat")) // true
 * console.log(derivedDefaultAccessAllowed(item, "mystery_bot")) // false
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const derivedDefaultAccessAllowed: {
  (consumer: string): (item: MemoryItem) => boolean;
  (item: MemoryItem, consumer: string): boolean;
} = dual(2, (item: MemoryItem, consumer: string): boolean => {
  const policy = isMemoryConsumer(consumer)
    ? MemoryAccessPolicy.make({
        consumer,
        appHasDefaultMemoryGrant: true,
        archiveCapability: false,
        rawProvenanceCapability: false,
      })
    : MemoryAccessPolicy.make({ consumer: "unknown" });
  return isDefaultAccessEligible(item, policy).allowed;
});
