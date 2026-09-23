/**
 * Memory product response models.
 *
 * **Details**
 *
 * Wire shapes for `/memory/*` product search routes. Source of truth for the
 * product memory search response schema; routers and utils construct dicts
 * matching these fields. Every model here is a read projection over the
 * canonical Memories record: `tier` carries the product layer wire values
 * (`short_term`, `long_term`, `archive`) and `lifecycle_status` and
 * `processing_state` are the other two axes, but on this projection all three
 * are open strings because the producer emits them from several read seams.
 * Product `layer=archive` is the only product meaning of Archive, and Archive
 * is never default-visible: `archiveDefaultVisible` is always false in the
 * producer.
 *
 * **Gotchas**
 *
 * No model in this file carries a numeric bound or a closed literal, so there
 * are no schema checks and no matching SQL checks. Effect strips unknown keys
 * unless decode uses `{ onExcessProperty: "error" }`; only
 * {@link ProductMemorySearchItem} is declared `extra='allow'`, and it keeps
 * those keys on `rest` through {@link decodeProductMemorySearchItem}.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Model, pg } from "./Kit.ts";
import { optionalNull } from "./Port.ts";
import { ReadRolloutConsumerObservability } from "./MemoryAdmin.ts";
import { MemoryItem } from "./ProductMemory.ts";

const $I = $ScratchpadId.create("beep/MemoryProduct");

const describedText = (column: string, description: string) =>
  S.String.annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

const describedBool = (column: string, description: string) =>
  S.Boolean.annotateKey({ description }).pipe(pg.boolean(), pg.columnName(column));

const describedInt = (column: string, description: string) =>
  S.Int.annotateKey({ description }).pipe(pg.integer(), pg.columnName(column));

const nullableText = (column: string, description: string) =>
  optionalNull(S.String).annotateKey({ description }).pipe(pg.text(), pg.columnName(column));

const nullableBool = (column: string, description: string) =>
  optionalNull(S.Boolean).annotateKey({ description }).pipe(pg.boolean(), pg.columnName(column));

const describedOptionalFinite = (column: string, description: string) =>
  optionalNull(S.Finite).annotateKey({ description }).pipe(pg.doublePrecision(), pg.columnName(column));

const JsonObjectList = S.Array(S.JsonObject);

const noJsonObjects = (): ReadonlyArray<S.JsonObject> => [];

const noJsonRecord = (): { readonly [key: string]: S.Json } => ({});

const jsonObjectList = (column: string, description: string) =>
  JsonObjectList.annotateKey({ description }).pipe(pg.jsonb(), pg.columnName(column));

const jsonObject = (column: string, description: string) =>
  S.JsonObject.annotateKey({ description }).pipe(pg.jsonb(), pg.columnName(column));

/**
 * One product memory search result row.
 *
 * **Details**
 *
 * This is the projection the read seam emits (`_product_memory_result` in
 * `utils.memory.memory_read_api` and the equivalent universal projection in
 * `MemoryService.default_product_search`), not a raw `MemoryItem`. Unknown
 * keys are preserved so a projection gaining a field does not silently drop
 * it from the wire: {@link decodeProductMemorySearchItem} parks them on
 * `rest`, and {@link flattenProductMemorySearchItemRest} spreads them back.
 * `tier` is the product layer wire value (Short-term, Long-term, Archive);
 * `memoryLayer` is the read layer that produced the row and is always
 * `product_memory` here.
 *
 * **Gotchas**
 *
 * `tier`, `lifecycleStatus`, and `processingState` are open strings on this
 * projection, not the `MemoryLayer`, `MemoryItemStatus`, and
 * `ProcessingState` literal kits. `evidence` has no wire default: an empty
 * list is only a constructor default.
 *
 * **Example** (Decode a row with a null confidence)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ProductMemorySearchItem } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ProductMemorySearchItem)({
 *     memoryId: "mem-1",
 *     memoryLayer: "product_memory",
 *     tier: "long_term",
 *     content: "Ada lives in Seattle",
 *     lifecycleStatus: "active",
 *     processingState: "processed",
 *     confidence: null,
 *     visibilitySource: "policy",
 *     date: "2020-01-02T03:04:05Z",
 *     evidence: [],
 *     agentUse: "context",
 *     accessReason: "default_grant",
 *     rest: {},
 *   }),
 * )
 * console.log(O.isNone(decoded.confidence)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProductMemorySearchItem extends Model<ProductMemorySearchItem>("ProductMemorySearchItem")(
  {
    memoryId: describedText("memory_id", "Logical memory id."),
    memoryLayer: describedText("memory_layer", "Read layer that produced the row (always product_memory here)."),
    tier: describedText("tier", "Memory tier value (short_term, long_term, archive)."),
    content: describedText("content", "Memory content text."),
    lifecycleStatus: describedText("lifecycle_status", "Lifecycle status of the underlying item."),
    processingState: describedText("processing_state", "Processing state of the underlying item."),
    confidence: describedOptionalFinite("confidence", "Confidence score when the layer emits one."),
    visibility: nullableText("visibility", "Visibility of the memory."),
    visibilitySource: describedText("visibility_source", "Which read seam decided the visibility value."),
    source: nullableText("source", "Primary evidence source id, when present."),
    date: describedText("date", "ISO-8601 timestamp of the last update."),
    evidence: JsonObjectList.annotateKey({ description: "Evidence payloads for the row." }).pipe(
      S.withConstructorDefault(Effect.sync(noJsonObjects)),
      pg.jsonb(),
      pg.columnName("evidence"),
    ),
    agentUse: describedText("agent_use", "How an agent may use this row."),
    accessReason: describedText("access_reason", "Why this row was admitted by the access policy."),
    supersededBy: nullableText("superseded_by", "Memory id that supersedes this row, if any."),
    rest: S.Record(S.String, S.Json)
      .annotateKey({ description: "Unknown wire keys preserved by the extra='allow' projection." })
      .pipe(S.withConstructorDefault(Effect.sync(noJsonRecord)), pg.jsonb(), pg.columnName("rest")),
  },
  $I.annote("ProductMemorySearchItem", {
    description: "One product memory search result row. Unknown keys survive on rest.",
  }),
) {}

/**
 * Encoded form of {@link ProductMemorySearchItem}.
 *
 * @see {@link ProductMemorySearchItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProductMemorySearchItem {
  export type Encoded = S.Codec.Encoded<typeof ProductMemorySearchItem>;
}

const knownProductMemorySearchItemKeys = HashSet.fromIterable(R.keys(ProductMemorySearchItem.fields));

const UnknownRecord = S.Record(S.String, S.Unknown);

const recordOf = (value: unknown): O.Option<{ readonly [key: string]: unknown }> =>
  S.decodeUnknownOption(UnknownRecord)(value);

/**
 * Moves unknown product search item keys into `rest` before decoding.
 *
 * **Details**
 *
 * Known field keys stay on the object. Any other own key is copied into
 * `rest`. An existing object `rest` is kept, and unknown keys fill holes
 * without replacing keys already in that object. Non-objects pass through
 * unchanged so the schema reports the real decode failure.
 *
 * **Example** (Park a bonus key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { absorbProductMemorySearchItemRest } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const prepared = absorbProductMemorySearchItemRest({ memoryId: "mem-1", bonus: 1 })
 * const decoded = Effect.runSync(S.decodeUnknownEffect(S.Record(S.String, S.Unknown))(prepared))
 * console.log("bonus" in decoded) // false
 * console.log(decoded.rest) // { bonus: 1 }
 * ```
 *
 * @see {@link flattenProductMemorySearchItemRest} for the reverse wire step.
 * @category decoding
 * @since 0.0.0
 */
export const absorbProductMemorySearchItemRest = (input: unknown): unknown => {
  const record = recordOf(input);
  if (O.isNone(record)) return input;
  const entries = R.toEntries(record.value);
  const extra = A.filter(entries, ([key]) => !HashSet.has(knownProductMemorySearchItemKeys, key));
  const known = A.filter(entries, ([key]) => HashSet.has(knownProductMemorySearchItemKeys, key));
  const body = R.fromEntries(known);
  if (extra.length === 0) return body;
  const current = R.get(body, "rest");
  const base = O.flatMap(current, (value) => (P.isObject(value) && !A.isArray(value) ? recordOf(value) : O.none()));
  const merged = R.fromEntries(
    O.match(base, { onNone: () => extra, onSome: (value) => [...R.toEntries(value), ...extra] }),
  );
  return R.set("rest", merged)(body);
};

/**
 * Decodes a product search item and keeps unknown keys.
 *
 * **Details**
 *
 * This is the `extra='allow'` entry point. Unknown keys land on `rest`, and
 * null or missing optional fields still become `None`. A missing `rest` is
 * filled with an empty object so the row decodes without a wire `rest` key.
 *
 * **Example** (Keep an unknown projection field)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeProductMemorySearchItem } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const decoded = Effect.runSync(
 *   decodeProductMemorySearchItem({
 *     memoryId: "mem-1",
 *     memoryLayer: "product_memory",
 *     tier: "short_term",
 *     content: "Ada lives in Seattle",
 *     lifecycleStatus: "active",
 *     processingState: "processed",
 *     visibilitySource: "policy",
 *     date: "2020-01-02T03:04:05Z",
 *     evidence: [],
 *     agentUse: "context",
 *     accessReason: "default_grant",
 *     salience: 0.5,
 *   }),
 * )
 * console.log(decoded.rest.salience) // 0.5
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeProductMemorySearchItem = Effect.fn("ProductMemorySearchItem.decode")(function* (input: unknown) {
  const absorbed = absorbProductMemorySearchItemRest(input);
  const record = recordOf(absorbed);
  const prepared = O.match(record, {
    onNone: () => absorbed,
    onSome: (value) => (O.isSome(R.get(value, "rest")) ? value : R.set("rest", {})(value)),
  });
  return yield* S.decodeUnknownEffect(ProductMemorySearchItem)(prepared);
});

/**
 * Spreads `rest` back onto an encoded product search item.
 *
 * **Details**
 *
 * The wire form has no `rest` key: unknown keys sit beside the declared
 * fields. Declared keys win over a `rest` entry with the same name.
 *
 * **Example** (Flatten one bonus key)
 *
 * ```ts
 * import { flattenProductMemorySearchItemRest } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const flat = flattenProductMemorySearchItemRest({ memoryId: "mem-1", rest: { bonus: 1 } })
 * console.log(flat) // { bonus: 1, memoryId: "mem-1" }
 * ```
 *
 * @see {@link absorbProductMemorySearchItemRest} for the decode step.
 * @category encoding
 * @since 0.0.0
 */
export const flattenProductMemorySearchItemRest = (encoded: {
  readonly [key: string]: unknown;
}): { readonly [key: string]: unknown } => {
  const rest = O.flatMap(R.get(encoded, "rest"), recordOf);
  const body = R.remove(encoded, "rest");
  return O.match(rest, { onNone: () => body, onSome: (value) => ({ ...value, ...body }) });
};

/**
 * Access-policy snapshot attached to product memory search responses.
 *
 * **Example** (Decode a default-grant policy)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemorySearchPolicyPayload } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemorySearchPolicyPayload)({
 *     consumer: "omi_chat",
 *     appHasDefaultMemoryGrant: true,
 *     archiveCapability: false,
 *     rawProvenanceCapability: false,
 *   }),
 * )
 * console.log(decoded.consumer) // "omi_chat"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemorySearchPolicyPayload extends Model<MemorySearchPolicyPayload>("MemorySearchPolicyPayload")(
  {
    consumer: describedText("consumer", "Memory consumer value (e.g. omi_chat)."),
    appHasDefaultMemoryGrant: describedBool(
      "app_has_default_memory_grant",
      "Whether the caller holds the default-memory grant.",
    ),
    archiveCapability: describedBool("archive_capability", "Whether the policy grants Archive access."),
    rawProvenanceCapability: describedBool(
      "raw_provenance_capability",
      "Whether raw provenance access is granted.",
    ),
  },
  $I.annote("MemorySearchPolicyPayload", {
    description: "Access-policy snapshot attached to product memory search responses.",
  }),
) {}

/**
 * Encoded form of {@link MemorySearchPolicyPayload}.
 *
 * @see {@link MemorySearchPolicyPayload} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemorySearchPolicyPayload {
  export type Encoded = S.Codec.Encoded<typeof MemorySearchPolicyPayload>;
}

/**
 * Global memory read kill-switch observability attached to search responses.
 *
 * **Details**
 *
 * `reason` is the effective reason: `fallbackReason` when present, else the
 * gate reason. `readDecision` is the server read decision value,
 * `USE_MEMORY` or `DENY_MEMORY`, kept as an open string.
 *
 * **Example** (Decode an open gate)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { MemoryGlobalReadGateObservability } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(MemoryGlobalReadGateObservability)({
 *     sourcePath: "memory_control/global",
 *     readDecision: "USE_MEMORY",
 *     reason: "enabled",
 *   }),
 * )
 * console.log(O.isNone(decoded.fallbackReason)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryGlobalReadGateObservability extends Model<MemoryGlobalReadGateObservability>(
  "MemoryGlobalReadGateObservability",
)(
  {
    sourcePath: describedText("source_path", "Firestore source path of the global read gate."),
    readDecision: describedText("read_decision", "Server read decision value (USE_MEMORY or DENY_MEMORY)."),
    fallbackReason: nullableText("fallback_reason", "Fallback reason when reads are disabled."),
    reason: describedText("reason", "Effective reason (fallback_reason when present, else the gate reason)."),
  },
  $I.annote("MemoryGlobalReadGateObservability", {
    description: "Global memory read kill-switch observability attached to search responses.",
  }),
) {}

/**
 * Encoded form of {@link MemoryGlobalReadGateObservability}.
 *
 * @see {@link MemoryGlobalReadGateObservability} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryGlobalReadGateObservability {
  export type Encoded = S.Codec.Encoded<typeof MemoryGlobalReadGateObservability>;
}

/**
 * Per-route default-read rollout observability for product memory routes.
 *
 * **Details**
 *
 * Extends the base per-consumer observability
 * ({@link ReadRolloutConsumerObservability}) with the product-route context
 * fields added by the shared authorization seam.
 *
 * **Gotchas**
 *
 * `vectorRepairOutboxEnabled` is present only on the vector search route.
 * Missing and null both decode to `None`, and `None` encodes as `null`.
 *
 * **Example** (Decode the search surface)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ProductRolloutObservability } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ProductRolloutObservability)({
 *     consumer: "omi_chat",
 *     enabled: true,
 *     reason: "enabled",
 *     readDecision: "USE_MEMORY",
 *     mode: "default_on",
 *     memoryReadsEnabled: true,
 *     legacyReadsAuthoritative: false,
 *     defaultMemoryGrant: true,
 *     archiveDefaultVisible: false,
 *     archiveCapability: false,
 *     capabilities: { memoryReadsEnabled: true, legacyReadsAuthoritative: false },
 *     surface: "product_default_search",
 *     archiveCapabilityRequired: false,
 *     archiveCapabilityGranted: false,
 *     explicitArchiveRequest: false,
 *     appContext: { appId: "app-1" },
 *   }),
 * )
 * console.log(O.isNone(decoded.vectorRepairOutboxEnabled)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProductRolloutObservability extends Model<ProductRolloutObservability>("ProductRolloutObservability")(
  {
    ...ReadRolloutConsumerObservability.fields,
    surface: describedText("surface", "Product surface that requested the read (e.g. product_default_search)."),
    archiveCapabilityRequired: describedBool(
      "archive_capability_required",
      "Whether the route requires Archive capability.",
    ),
    archiveCapabilityGranted: describedBool(
      "archive_capability_granted",
      "Whether Archive capability was granted for this request.",
    ),
    explicitArchiveRequest: describedBool(
      "explicit_archive_request",
      "Whether the caller explicitly requested Archive access.",
    ),
    appContext: jsonObject("app_context", "Caller app/key/scope context payload."),
    vectorRepairOutboxEnabled: nullableBool("vector_repair_outbox_enabled", "Present only on the vector search route."),
  },
  $I.annote("ProductRolloutObservability", {
    description: "Per-route default-read rollout observability for product memory routes.",
  }),
) {}

/**
 * Encoded form of {@link ProductRolloutObservability}.
 *
 * @see {@link ProductRolloutObservability} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProductRolloutObservability {
  export type Encoded = S.Codec.Encoded<typeof ProductRolloutObservability>;
}

const searchPageFields = {
  uid: describedText("uid", "Authenticated user id."),
  query: describedText("query", "Search query string."),
} as const;

const searchPolicyFields = {
  policy: MemorySearchPolicyPayload.annotateKey({ description: "Access-policy snapshot used for this read." }).pipe(
    pg.jsonb(),
    pg.columnName("policy"),
  ),
  globalReadGate: MemoryGlobalReadGateObservability.annotateKey({
    description: "Global read kill-switch observability.",
  }).pipe(pg.jsonb(), pg.columnName("global_read_gate")),
  rollout: ProductRolloutObservability.annotateKey({
    description: "Per-route default-read rollout observability.",
  }).pipe(pg.jsonb(), pg.columnName("rollout")),
} as const;

/**
 * Default-visible product memory search response.
 *
 * **Details**
 *
 * Returned by `GET /memory/search`. Rows are the Short-term and Long-term
 * product layers that the access policy admits; Archive is never
 * default-visible, so `archiveDefaultVisible` is always false in the producer.
 *
 * **Gotchas**
 *
 * No field is optional. The schema still accepts `archiveDefaultVisible: true`
 * because the Python model does not check it.
 *
 * **Example** (Read the page counts)
 *
 * ```ts
 * import { ProductMemorySearchResponse } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * console.log(ProductMemorySearchResponse.fields.totalCount !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProductMemorySearchResponse extends Model<ProductMemorySearchResponse>("ProductMemorySearchResponse")(
  {
    ...searchPageFields,
    items: S.Array(ProductMemorySearchItem)
      .annotateKey({ description: "Default-visible memory rows for the current page." })
      .pipe(pg.jsonb(), pg.columnName("items")),
    totalCount: describedInt("total_count", "Total default-visible items matching the query."),
    returnedCount: describedInt("returned_count", "Number of items returned in this page."),
    limit: describedInt("limit", "Bounded page size used for this response."),
    offset: describedInt("offset", "Offset into the result set for this page."),
    archiveDefaultVisible: describedBool(
      "archive_default_visible",
      "Always false; Archive is never default-visible.",
    ),
    ...searchPolicyFields,
  },
  $I.annote("ProductMemorySearchResponse", {
    description: "Default-visible product memory search response returned by GET /memory/search.",
  }),
) {}

/**
 * Encoded form of {@link ProductMemorySearchResponse}.
 *
 * @see {@link ProductMemorySearchResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProductMemorySearchResponse {
  export type Encoded = S.Codec.Encoded<typeof ProductMemorySearchResponse>;
}

/**
 * Explicit Archive product memory search response.
 *
 * **Details**
 *
 * Returned by `GET /memory/archive/search`. Adds the Archive capability
 * accounting fields on top of the default search response. This is the one
 * product route that reads the Archive layer, and only on an explicit request
 * with the Archive capability granted.
 *
 * **Gotchas**
 *
 * `archiveCapabilityRequired` is always true for the archive search route,
 * and `archiveDefaultVisible` stays false even here. Neither is checked.
 *
 * **Example** (Read the archive fields)
 *
 * ```ts
 * import { ArchiveProductMemorySearchResponse } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * console.log(ArchiveProductMemorySearchResponse.fields.archiveCapabilityRequired !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ArchiveProductMemorySearchResponse extends Model<ArchiveProductMemorySearchResponse>(
  "ArchiveProductMemorySearchResponse",
)(
  {
    ...ProductMemorySearchResponse.fields,
    archiveCapabilityRequired: describedBool(
      "archive_capability_required",
      "Always true for the archive search route.",
    ),
    archiveCapabilityGranted: describedBool(
      "archive_capability_granted",
      "Whether Archive capability was granted to the policy.",
    ),
  },
  $I.annote("ArchiveProductMemorySearchResponse", {
    description: "Explicit Archive product memory search response returned by GET /memory/archive/search.",
  }),
) {}

/**
 * Encoded form of {@link ArchiveProductMemorySearchResponse}.
 *
 * @see {@link ArchiveProductMemorySearchResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ArchiveProductMemorySearchResponse {
  export type Encoded = S.Codec.Encoded<typeof ArchiveProductMemorySearchResponse>;
}

/**
 * Default-visible vector memory search response.
 *
 * **Details**
 *
 * Returned by `GET /memory/vector/search`. Vector hits are hydrated through
 * authoritative `memory_items` before returning; the budget, exhaustion, and
 * repair-purge fields describe that hydration process. `items` are the
 * authoritative {@link MemoryItem} records, not the product projection.
 *
 * **Gotchas**
 *
 * `decisions` is a string record, not a `SearchDecision` record.
 * `legacyFallbackUsed` and `archiveDefaultVisible` are always false in the
 * producer and unchecked here. `timeoutSeconds` is the only optional field.
 *
 * **Example** (Read the budget fields)
 *
 * ```ts
 * import { VectorMemorySearchResponse } from "@beep/scratchpad/beep/MemoryProduct"
 *
 * console.log(VectorMemorySearchResponse.fields.candidateBudget !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VectorMemorySearchResponse extends Model<VectorMemorySearchResponse>("VectorMemorySearchResponse")(
  {
    ...searchPageFields,
    items: S.Array(MemoryItem)
      .annotateKey({ description: "Hydrated, default-visible memory items for the current page." })
      .pipe(pg.jsonb(), pg.columnName("items")),
    scoresByMemoryId: S.Record(S.String, S.Finite)
      .annotateKey({ description: "Vector similarity score keyed by memory id." })
      .pipe(pg.jsonb(), pg.columnName("scores_by_memory_id")),
    projectionCommitIdsByMemoryId: S.Record(S.String, S.String)
      .annotateKey({ description: "Projection commit id keyed by memory id." })
      .pipe(pg.jsonb(), pg.columnName("projection_commit_ids_by_memory_id")),
    decisions: S.Record(S.String, S.String)
      .annotateKey({ description: "Per-candidate gateway decision value keyed by memory id." })
      .pipe(pg.jsonb(), pg.columnName("decisions")),
    totalCount: describedInt("total_count", "Total hydrated results before pagination."),
    returnedCount: describedInt("returned_count", "Number of items returned in this page."),
    limit: describedInt("limit", "Bounded page size used for this response."),
    overfetchFactor: describedInt("overfetch_factor", "Overfetch multiplier applied to the limit."),
    candidateBudget: describedInt("candidate_budget", "Hard cap on vector candidates considered."),
    maxVectorQueries: describedInt("max_vector_queries", "Maximum number of vector queries allowed."),
    maxCandidateHydrationReads: describedInt(
      "max_candidate_hydration_reads",
      "Maximum authoritative hydration reads allowed.",
    ),
    timeoutSeconds: describedOptionalFinite("timeout_seconds", "Optional deadline in seconds, if set."),
    candidateRequestLimit: describedInt("candidate_request_limit", "Effective per-query candidate request limit."),
    candidateBudgetExhausted: describedBool(
      "candidate_budget_exhausted",
      "Whether the candidate budget was exhausted.",
    ),
    vectorQueryBudgetExhausted: describedBool(
      "vector_query_budget_exhausted",
      "Whether the vector query budget was exhausted.",
    ),
    hydrationReadBudgetExhausted: describedBool(
      "hydration_read_budget_exhausted",
      "Whether the hydration read budget was exhausted.",
    ),
    timeoutExhausted: describedBool("timeout_exhausted", "Whether the deadline was reached."),
    searchStatus: describedText("search_status", "Coarse search status label (e.g. ok, partial)."),
    legacyFallbackUsed: describedBool(
      "legacy_fallback_used",
      "Always false; legacy fallback is never used by this route.",
    ),
    vectorQueryCount: describedInt("vector_query_count", "Number of vector queries actually issued."),
    queriedCandidateCount: describedInt("queried_candidate_count", "Number of vector candidates queried."),
    hydratedCandidateCount: describedInt(
      "hydrated_candidate_count",
      "Number of candidates hydrated from authoritative items.",
    ),
    candidateHydrationReadCount: describedInt(
      "candidate_hydration_read_count",
      "Number of authoritative hydration reads performed.",
    ),
    hydrationRejectedMissingCount: describedInt(
      "hydration_rejected_missing_count",
      "Candidates rejected as missing authoritative items.",
    ),
    hydrationRejectedStaleProjectionCount: describedInt(
      "hydration_rejected_stale_projection_count",
      "Candidates rejected for stale projection.",
    ),
    hydrationRejectedStaleVectorCount: describedInt(
      "hydration_rejected_stale_vector_count",
      "Candidates rejected for stale vector data.",
    ),
    hydrationRejectedAccessDeniedCount: describedInt(
      "hydration_rejected_access_denied_count",
      "Candidates rejected by access policy.",
    ),
    vectorRejectedCount: describedInt(
      "vector_rejected_count",
      "Candidates rejected before hydration by the vector layer.",
    ),
    repairPurgeCandidateCount: describedInt(
      "repair_purge_candidate_count",
      "Number of repair-purge candidates identified.",
    ),
    repairPurgeCandidates: jsonObjectList("repair_purge_candidates", "Repair-purge candidate payloads."),
    repairPurgeOutboxRecordCount: describedInt(
      "repair_purge_outbox_record_count",
      "Number of repair-purge outbox records written.",
    ),
    repairPurgeOutboxRecords: jsonObjectList("repair_purge_outbox_records", "Repair-purge outbox record payloads."),
    archiveDefaultVisible: describedBool(
      "archive_default_visible",
      "Always false; Archive is never default-visible.",
    ),
    telemetry: jsonObject("telemetry", "Vector search telemetry emission summary."),
    ...searchPolicyFields,
  },
  $I.annote("VectorMemorySearchResponse", {
    description: "Default-visible vector memory search response returned by GET /memory/vector/search.",
  }),
) {}

/**
 * Encoded form of {@link VectorMemorySearchResponse}.
 *
 * @see {@link VectorMemorySearchResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VectorMemorySearchResponse {
  export type Encoded = S.Codec.Encoded<typeof VectorMemorySearchResponse>;
}
