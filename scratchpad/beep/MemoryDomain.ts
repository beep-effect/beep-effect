/**
 * Canonical memory-domain vocabulary.
 *
 * **Details**
 *
 * Short-term, Long-term, and Archive are the only product layers. Conversation
 * and capture session stay upstream of memory. Action items and goals are
 * Workflow, not layers.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { Model, UtcTimestamp, optionalNull, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryDomain");

const described = <Sch extends S.Top>(schema: Sch, description: string) => schema.annotateKey({ description });

const stringList = (column: string, description: string) =>
  described(S.String.pipe(S.Array), description).pipe(
    S.withConstructorDefault(Effect.succeed([])),
    pg.jsonb(),
    pg.columnName(column),
  );

const optionalString = (column: string, description: string) =>
  described(optionalNull(S.String), description).pipe(pg.text(), pg.columnName(column));

const optionalInstantSchema = S.NullOr(S.String).pipe(
  S.optionalKey,
  S.decodeTo(S.Option(UtcTimestamp), {
    decode: SchemaGetter.transformOptional((present) =>
      present.pipe(
        O.flatMap((value) => (Predicate.isNull(value) ? O.none() : O.some(value))),
        O.some,
      ),
    ),
    encode: SchemaGetter.transformOptional((present) =>
      present.pipe(
        O.flatten,
        O.match({
          onNone: () => null,
          onSome: (value) => value,
        }),
        O.some,
      ),
    ),
  }),
  SchemaUtils.withNoneDefault,
);

const optionalInstant = (column: string, description: string) =>
  described(optionalInstantSchema, description).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

const requiredInstant = (column: string, description: string) =>
  described(UtcTimestamp, description).pipe(
    pg.timestamp({ mode: "string", withTimezone: true }),
    pg.columnName(column),
  );

/**
 * Product lifecycle layer on a Memories record.
 *
 * **Details**
 *
 * Short-term is broad new intake. Its TTL is an adjudication deadline, not a
 * visibility switch. Long-term is a durable fact and is entered only by an
 * atomic promote route. Archive is aged-out Long-term, kept for recall and
 * hidden unless the caller opts in. `context_only` is not a layer. Conversation
 * is the upstream session record, and Workflow (action items and goals) is a
 * separate store.
 *
 * **Gotchas**
 *
 * `product_memory.MemoryLayer` is a lowercase alias of the legacy tier enum with
 * the same wire values. This kit is the canonical validation vocabulary. Do not
 * treat `LifecycleState.working` as a stored layer; it is in-flight extraction.
 *
 * **Example** (Decode a product layer)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryLayer } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryLayer)("long_term"))
 * console.log(decoded) // "long_term"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryLayer = LiteralKit(["short_term", "long_term", "archive"]).pipe(
  $I.annoteSchema("MemoryLayer", {
    description: "Product lifecycle layer: short_term, long_term, or archive.",
  }),
);

/**
 * Decoded product lifecycle layer.
 *
 * @see {@link MemoryLayer} for the runtime kit and the three product meanings.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryLayer = typeof MemoryLayer.Type;

/**
 * Legacy product `tier` wire, identical in value to {@link MemoryLayer}.
 *
 * **Details**
 *
 * `models.product_memory.MemoryTier` aliases that module's lowercase
 * `MemoryLayer`. The values match this module's canonical layer. The rename
 * from `tier` to `layer` is the product field change; the wire strings stay.
 *
 * **Example** (Decode a legacy tier)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ProductMemoryTier } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ProductMemoryTier)("archive"))
 * console.log(decoded) // "archive"
 * ```
 *
 * @see {@link tierToLayer} for the canonical mapping.
 * @category schemas
 * @since 0.0.0
 */
export const ProductMemoryTier = LiteralKit(["short_term", "long_term", "archive"]).pipe(
  $I.annoteSchema("ProductMemoryTier", {
    description: "Legacy MemoryTier wire. Same strings as the canonical memory layer.",
  }),
);

/**
 * Decoded legacy tier wire.
 *
 * @see {@link ProductMemoryTier} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ProductMemoryTier = typeof ProductMemoryTier.Type;

/**
 * Record lifecycle status. Distinct from {@link MemoryLayer}.
 *
 * **Details**
 *
 * `active`, `superseded`, and `tombstoned` are the §1.3 axis. Non-active rows
 * leave normal reads. Tombstoned is hidden at every layer.
 *
 * **Gotchas**
 *
 * Archive is never `superseded`. Physical storage may still say `hidden`; that
 * string is not a member of this axis. {@link physicalStatusToRecordStatus}
 * maps it to `tombstoned` while the stored value stays `hidden`.
 *
 * **Example** (Decode a record status)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryRecordStatus } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryRecordStatus)("tombstoned"))
 * console.log(decoded) // "tombstoned"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryRecordStatus = LiteralKit(["active", "superseded", "tombstoned"]).pipe(
  $I.annoteSchema("MemoryRecordStatus", {
    description: "Record lifecycle status, distinct from the product layer.",
  }),
);

/**
 * Decoded record lifecycle status.
 *
 * @see {@link MemoryRecordStatus} for the axis and the archive exception.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryRecordStatus = typeof MemoryRecordStatus.Type;

/**
 * Physical memory status, including stored `hidden`.
 *
 * **Details**
 *
 * `hidden` is the canonical pipeline outcome for secret or rejected items. It
 * has no §1.3 axis value. Validation treats it as tombstoned. Persisted rows
 * keep the string `hidden`.
 *
 * **Example** (Accept stored hidden)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { PhysicalMemoryStatus } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(PhysicalMemoryStatus)("hidden"))
 * console.log(decoded) // "hidden"
 * ```
 *
 * @see {@link canonicalRecordStatus} for the axis mapping.
 * @category schemas
 * @since 0.0.0
 */
export const PhysicalMemoryStatus = LiteralKit(["active", "superseded", "tombstoned", "hidden"]).pipe(
  $I.annoteSchema("PhysicalMemoryStatus", {
    description: "Stored memory status. hidden remains stored and validates as tombstoned.",
  }),
);

/**
 * Decoded physical memory status.
 *
 * @see {@link PhysicalMemoryStatus} for why hidden is not an axis value.
 * @category type-level
 * @since 0.0.0
 */
export type PhysicalMemoryStatus = typeof PhysicalMemoryStatus.Type;

const isPhysicalMemoryStatus = S.is(PhysicalMemoryStatus);

/**
 * Internal pipeline processing state. Never surfaced to clients.
 *
 * **Details**
 *
 * Short-term may be `pending`, `processed`, or `blocked`. Long-term and Archive
 * require `processed`. A pending or blocked item never reaches Long-term.
 *
 * **Example** (Decode a processing state)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryProcessingState } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryProcessingState)("processed"))
 * console.log(decoded) // "processed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryProcessingState = LiteralKit(["pending", "processed", "blocked"]).pipe(
  $I.annoteSchema("MemoryProcessingState", {
    description: "Internal pipeline state. Clients do not see this axis.",
  }),
);

/**
 * Decoded processing state.
 *
 * @see {@link MemoryProcessingState} for which layers may still be pending.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryProcessingState = typeof MemoryProcessingState.Type;

/**
 * Rejected memory-domain state.
 *
 * **Example** (Build an illegal-combination error)
 *
 * ```ts
 * import { MemoryDomainError } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const error = MemoryDomainError.make({ message: "illegal memory state combination" })
 * console.log(error.message) // "illegal memory state combination"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryDomainError extends S.TaggedError<MemoryDomainError>()(
  "MemoryDomainError",
  {
    message: S.String,
  },
  $I.annoteError<MemoryDomainError>("MemoryDomainError", {
    description: "A memory layer, status, or physical status failed the domain matrix.",
  }),
) {}

/**
 * Encoded form of {@link MemoryDomainError}.
 *
 * @see {@link MemoryDomainError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryDomainError {
  export type Encoded = S.Codec.Encoded<typeof MemoryDomainError>;
}

/**
 * Map a stored status onto the §1.3 axis.
 *
 * **Details**
 *
 * `hidden` becomes `tombstoned`. The other three strings map to themselves.
 * This does not rewrite the stored row.
 *
 * **Example** (Map hidden)
 *
 * ```ts
 * import { canonicalRecordStatus } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(canonicalRecordStatus("hidden")) // "tombstoned"
 * ```
 *
 * @see {@link physicalStatusToRecordStatus} for the effect that rejects unknown strings.
 * @category mapping
 * @since 0.0.0
 */
export const canonicalRecordStatus = (physicalStatus: PhysicalMemoryStatus): MemoryRecordStatus => {
  if (Equal.equals(physicalStatus, "active")) return "active";
  if (Equal.equals(physicalStatus, "superseded")) return "superseded";
  return "tombstoned";
};

/**
 * Map a physical status string, failing when it is not a known stored value.
 *
 * **Example** (Reject an unknown status)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { physicalStatusToRecordStatus } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(Effect.runSync(physicalStatusToRecordStatus("active"))) // "active"
 * console.log(Effect.runSyncExit(physicalStatusToRecordStatus("context_only"))._tag) // "Failure"
 * ```
 *
 * @see {@link canonicalRecordStatus} for the total mapping of known strings.
 * @category mapping
 * @since 0.0.0
 */
export const physicalStatusToRecordStatus = Effect.fn("MemoryDomain.physicalStatusToRecordStatus")(function* (
  physicalStatus: string,
) {
  if (!isPhysicalMemoryStatus(physicalStatus)) {
    return yield* MemoryDomainError.make({
      message: `unknown physical memory status: '${physicalStatus}'`,
    });
  }
  return canonicalRecordStatus(physicalStatus);
});

/**
 * Report whether a layer, status, and processing state are a legal §1.3 triple.
 *
 * **Details**
 *
 * Short-term allows every status and every processing state. Long-term allows
 * every status and only `processed`. Archive allows `active` and `tombstoned`,
 * never `superseded`, and only `processed`.
 *
 * **Gotchas**
 *
 * Pass the canonical status. Physical `hidden` must be mapped with
 * {@link canonicalRecordStatus} first, or a stored hidden row looks illegal.
 *
 * **Example** (Reject archive superseded)
 *
 * ```ts
 * import { isLegalStateCombination } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(isLegalStateCombination("archive", "superseded", "processed")) // false
 * console.log(isLegalStateCombination("short_term", "active", "pending")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Layer, status, and processing state are co-primary inputs.
export const isLegalStateCombination = (
  layer: MemoryLayer,
  status: MemoryRecordStatus,
  processingState: MemoryProcessingState,
): boolean => {
  if (Equal.equals(layer, "short_term")) return true;
  if (Equal.equals(layer, "long_term")) return Equal.equals(processingState, "processed");
  return !Equal.equals(status, "superseded") && Equal.equals(processingState, "processed");
};

/**
 * Fail when the §1.3 triple is illegal.
 *
 * **Details**
 *
 * Legal combinations are short-term with any status and any processing state,
 * long-term with any status and `processed`, and archive with `active` or
 * `tombstoned` and `processed`.
 *
 * **Gotchas**
 *
 * Illegal combinations include long-term or archive with `pending` or `blocked`,
 * archive with `superseded`, and any triple whose layer is not one of the three
 * product layers. Tombstoned is excluded from default reads at every legal layer.
 *
 * **Example** (Reject a pending long-term row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { assertLegalState } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(Effect.runSyncExit(assertLegalState("long_term", "active", "pending"))._tag) // "Failure"
 * ```
 *
 * @see {@link isLegalStateCombination} for the boolean form.
 * @category assertions
 * @since 0.0.0
 */
export const assertLegalState = Effect.fn("MemoryDomain.assertLegalState")(function* (
  layer: MemoryLayer,
  status: MemoryRecordStatus,
  processingState: MemoryProcessingState,
) {
  if (!isLegalStateCombination(layer, status, processingState)) {
    return yield* MemoryDomainError.make({
      message: `illegal memory state combination: layer=${layer}, status=${status}, processing_state=${processingState}`,
    });
  }
});

/**
 * Map a legacy tier onto the canonical layer.
 *
 * **Details**
 *
 * The wire value is unchanged. This is not a promotion and it does not invent
 * a Long-term receipt.
 *
 * **Example** (Map short-term)
 *
 * ```ts
 * import { tierToLayer } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(tierToLayer("short_term")) // "short_term"
 * ```
 *
 * @see {@link layerToTier} for the inverse.
 * @category mapping
 * @since 0.0.0
 */
export const tierToLayer = (tier: ProductMemoryTier): MemoryLayer => {
  if (Equal.equals(tier, "long_term")) return "long_term";
  if (Equal.equals(tier, "archive")) return "archive";
  return "short_term";
};

/**
 * Map a canonical layer onto the legacy tier wire.
 *
 * **Example** (Map archive)
 *
 * ```ts
 * import { layerToTier } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * console.log(layerToTier("archive")) // "archive"
 * ```
 *
 * @see {@link tierToLayer} for the inverse.
 * @category mapping
 * @since 0.0.0
 */
export const layerToTier = (layer: MemoryLayer): ProductMemoryTier => {
  if (Equal.equals(layer, "long_term")) return "long_term";
  if (Equal.equals(layer, "archive")) return "archive";
  return "short_term";
};

/**
 * Canonical Memories record: one store, three axes.
 *
 * **Details**
 *
 * `layer`, `status`, and `processingState` are independent axes, not synonyms.
 * `category` is legacy taxonomy metadata, not a layer. `canonicalMemoryId` is
 * the alias target default reads dedupe on. `promotion` is the Short-term to
 * Long-term admission receipt and graph plan, server-authored and
 * revision-fenced. Ledger commit id and sequence are the atomic commit fence.
 * Graph-ready fields are the per-memory graph admission. `expiresAt` is the
 * Short-term TTL, an adjudication deadline: reaching it does not hide an
 * unadjudicated active item. Null for Long-term and Archive.
 *
 * **Gotchas**
 *
 * Legal triples are short-term with any status and any processing state,
 * long-term with any status and `processed`, and archive with `active` or
 * `tombstoned` and `processed`. Illegal triples include long-term or archive
 * still `pending` or `blocked`, and archive `superseded`. Physical `hidden`
 * stays stored and is checked as `tombstoned`. `L1MemoryArchiveItem` is a
 * pipeline artifact, not this Archive layer. Conversation, ChatSession, focus
 * session, and auth session are different things; Conversation is not a memory.
 *
 * **Example** (Reject a superseded archive row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LegalMemoryDomainRecord } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const input = {
 *   id: "mem-1",
 *   content: "Lives in Seattle",
 *   layer: "archive",
 *   status: "superseded",
 *   processingState: "processed",
 *   createdAt: "2020-01-02T03:04:05.000Z",
 *   updatedAt: "2020-01-02T03:04:05.000Z",
 * }
 * console.log(Effect.runSyncExit(S.decodeUnknownEffect(LegalMemoryDomainRecord)(input))._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryDomainRecord extends Model<MemoryDomainRecord>("MemoryDomainRecord")(
  {
    id: described(S.String, "Stable canonical record id. Provider projections derive a separate user-scoped id.").pipe(
      pg.text(),
      pg.columnName("id"),
    ),
    content: described(S.String, "The fact or observation text.").pipe(pg.text(), pg.columnName("content")),
    layer: described(MemoryLayer, "Product lifecycle layer. The only axis users and clients see.").pipe(
      pg.text(),
      pg.columnName("layer"),
    ),
    status: described(
      PhysicalMemoryStatus,
      "Record lifecycle. Physical hidden stays stored and validates as tombstoned.",
    ).pipe(pg.text(), pg.columnName("status")),
    processingState: described(
      MemoryProcessingState,
      "Internal pipeline state. Never surfaced to clients. Not a synonym of layer or status.",
    ).pipe(pg.text(), pg.columnName("processing_state")),
    category: optionalString("category", "Legacy taxonomy metadata such as core or hobbies. Not a layer."),
    evidence: described(
      S.Array(S.JsonObject),
      "Provenance objects. For voice, source_id is the upstream Conversation id. Evidence drives cascade tombstone on Conversation delete.",
    ).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName("evidence")),
    sourceIds: stringList(
      "source_ids",
      "Exact projection of evidence source_id and conversation_id values. array_contains drives bounded source replacement.",
    ),
    canonicalMemoryId: optionalString(
      "canonical_memory_id",
      "Alias or lineage target for a consolidated logical memory. Default reads dedupe on it.",
    ),
    promotion: described(
      optionalNull(S.JsonObject),
      "Route audit, admission receipt, and graph plan. Null when the row was not promoted.",
    ).pipe(pg.jsonb(), pg.columnName("promotion")),
    ledgerCommitId: optionalString(
      "ledger_commit_id",
      "Atomic canonical commit fence. Required for active Long-term.",
    ),
    ledgerSequence: described(
      optionalNull(S.Int),
      "Atomic canonical commit sequence. Required for active Long-term.",
    ).pipe(pg.integer(), pg.columnName("ledger_sequence")),
    graphReady: described(
      S.Boolean,
      "Version-fenced per-memory graph admission. Required for newly admitted active Long-term.",
    ).pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("graph_ready")),
    graphAssertionId: optionalString(
      "graph_assertion_id",
      "Per-memory graph assertion id committed with Long-term admission.",
    ),
    graphPlanHash: optionalString("graph_plan_hash", "Hash of the graph plan bound into the promotion receipt."),
    expiresAt: optionalInstant(
      "expires_at",
      "Short-term TTL. An adjudication deadline, not a visibility switch. Null for long-term and archive.",
    ),
    createdAt: requiredInstant("created_at", "When the canonical record was created."),
    updatedAt: requiredInstant("updated_at", "When the canonical record was last updated."),
  },
  $I.annote("MemoryDomainRecord", {
    description:
      "Canonical Memories record. Layer, status, and processing state are three axes constrained by the §1.3 matrix.",
  }),
) {}

/**
 * Encoded form of {@link MemoryDomainRecord}.
 *
 * @see {@link MemoryDomainRecord} for the runtime record and the state matrix.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryDomainRecord {
  export type Encoded = S.Codec.Encoded<typeof MemoryDomainRecord>;
}

const legalMemoryState = S.makeFilter(
  (record: MemoryDomainRecord) =>
    isLegalStateCombination(record.layer, canonicalRecordStatus(record.status), record.processingState),
  {
    identifier: "LegalMemoryState",
    title: "Legal memory state",
    message: "illegal memory state combination",
    description:
      "layer, status, and processingState must be a legal §1.3 triple. Physical hidden counts as tombstoned.",
  },
);

/**
 * {@link MemoryDomainRecord} decoder that rejects illegal §1.3 triples.
 *
 * **Details**
 *
 * The stored `status` may be `hidden`. The check maps that to `tombstoned`
 * before applying the matrix. Archive plus `superseded`, and Long-term or
 * Archive with `pending` or `blocked`, fail.
 *
 * **Example** (Accept hidden short-term as tombstoned)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LegalMemoryDomainRecord } from "@beep/scratchpad/beep/MemoryDomain.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(LegalMemoryDomainRecord)({
 *     id: "mem-1",
 *     content: "A secret was rejected",
 *     layer: "short_term",
 *     status: "hidden",
 *     processingState: "processed",
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(decoded.status) // "hidden"
 * ```
 *
 * @see {@link MemoryDomainRecord} for the unchecked row shape.
 * @category schemas
 * @since 0.0.0
 */
export const LegalMemoryDomainRecord = MemoryDomainRecord.check(legalMemoryState);

/**
 * Decoded legal memory-domain record.
 *
 * @see {@link LegalMemoryDomainRecord} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type LegalMemoryDomainRecord = typeof LegalMemoryDomainRecord.Type;
