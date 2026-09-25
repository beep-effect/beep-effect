/**
 * Memory operation journal.
 *
 * **Details**
 *
 * Operation ids ignore the observed head and the model output index. Account
 * and source generations are part of the id so a purge starts a new space.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Model, NonNegativeInt, optionalNull, pg, timestampDefaultNow } from "./Kit.ts";
import { deterministicContractId } from "./MemoryContracts.ts";

const $I = $ScratchpadId.create("beep/MemoryOperations");

const described = <A extends S.Top>(schema: A, description: string) => schema.annotateKey({ description });

const stringOrder = Order.make<string>((self, that) => {
  if (self < that) return -1;
  if (that < self) return 1;
  return 0;
});

const nonBlank = S.String.check(
  S.makeFilter((value: string) => !Str.isEmpty(Str.trim(value)), {
    identifier: "NonBlankOperationText",
    title: "Non-blank operation text",
    message: "operation text must not be whitespace",
  }),
);

const nn = (column: string) => NonNegativeInt.pipe(pg.integer(), pg.columnName(column));

const nnDefault = (column: string) =>
  NonNegativeInt.pipe(S.withConstructorDefault(Effect.succeed(0)), pg.integer(), pg.columnName(column));

const nnCheck = (column: ExtraConfigColumn, name: string) =>
  pg.Table.check(name)(sql<boolean>`${column} >= ${sql.raw("0")}`);

const stringList = (column: string) =>
  S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName(column));

const jsonDefault = (column: string) =>
  S.JsonObject.pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName(column));

const closed = <const L extends readonly [string, ...ReadonlyArray<string>]>(
  literals: L,
  name: string,
  description: string,
) => LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

const hasText = (value: O.Option<string>): boolean => O.isSome(value) && !Str.isEmpty(Str.trim(value.value));

/**
 * Kind of journaled memory operation.
 *
 * **Example** (Decode a synthesis)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryOperationType } from "./MemoryOperations.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryOperationType)("synthesis"))
 * console.log(decoded) // "synthesis"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryOperationType = closed(
  [
    "source_candidate",
    "source_replacement",
    "synthesis",
    "long_term_apply",
    "user_mutation",
    "archive_transition",
    "projection_sync",
    "vector_sync",
    "graph_enrichment",
    "deletion",
    "ledger_mutation",
  ],
  "MemoryOperationType",
  "Journaled memory operation type.",
);

/**
 * Decoded operation type.
 *
 * @see {@link MemoryOperationType} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryOperationType = typeof MemoryOperationType.Type;

const isMemoryOperationType = S.is(MemoryOperationType);

/**
 * Journal status. Committed, skipped, permanent failure, and stale are terminal.
 *
 * **Example** (Decode pending)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryOperationStatus } from "./MemoryOperations.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryOperationStatus)("pending"))
 * console.log(decoded) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryOperationStatus = closed(
  ["pending", "committed", "skipped_idempotent", "retryable_failure", "permanent_failure", "stale_generation"],
  "MemoryOperationStatus",
  "Operation journal status. Four of the six values are terminal.",
);

/**
 * Decoded operation status.
 *
 * @see {@link MemoryOperationStatus} for which values are terminal.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryOperationStatus = typeof MemoryOperationStatus.Type;

const terminalStatuses = HashSet.make("committed", "skipped_idempotent", "permanent_failure", "stale_generation");

/**
 * Whether a status can no longer transition.
 *
 * **Example** (Committed is terminal)
 *
 * ```ts
 * import { isTerminalOperationStatus } from "./MemoryOperations.ts"
 *
 * console.log(isTerminalOperationStatus("committed")) // true
 * console.log(isTerminalOperationStatus("retryable_failure")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isTerminalOperationStatus = (status: MemoryOperationStatus): boolean => HashSet.has(terminalStatuses, status);

/**
 * Operation journal failure.
 *
 * **Example** (Build an integrity error)
 *
 * ```ts
 * import { MemoryOperationError } from "./MemoryOperations.ts"
 *
 * console.log(MemoryOperationError.make({ message: "terminal" }).message) // "terminal"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryOperationError extends S.TaggedError<MemoryOperationError>()(
  "MemoryOperationError",
  { message: S.String },
  $I.annoteError<MemoryOperationError>("MemoryOperationError", {
    description: "An operation id, digest, or transition was rejected.",
  }),
) {}

/**
 * Encoded form of {@link MemoryOperationError}.
 *
 * @see {@link MemoryOperationError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryOperationError {
  export type Encoded = S.Codec.Encoded<typeof MemoryOperationError>;
}

/**
 * Receipt that a closed ledger source reopened onto one tail.
 *
 * **Details**
 *
 * This is journal metadata, not a second memory authority. One receipt is keyed
 * by the closed source memory id.
 *
 * **Example** (Reject a blank uid)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryLedgerReopenReceipt } from "./MemoryOperations.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(MemoryLedgerReopenReceipt)({
 *     uid: " ",
 *     sourceMemoryId: "src",
 *     replacementMemoryId: "next",
 *     operationId: "op",
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     sourceItemRevision: 1,
 *     sourceContentHash: "hash",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryLedgerReopenReceipt extends Model<MemoryLedgerReopenReceipt>("MemoryLedgerReopenReceipt")(
  {
    schemaVersion: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("memory_ledger_reopen_receipt.v1")),
      pg.text(),
      pg.columnName("schema_version"),
    ),
    uid: nonBlank.pipe(pg.text(), pg.columnName("uid")),
    sourceMemoryId: nonBlank.pipe(pg.text(), pg.columnName("source_memory_id")),
    replacementMemoryId: nonBlank.pipe(pg.text(), pg.columnName("replacement_memory_id")),
    operationId: nonBlank.pipe(pg.text(), pg.columnName("operation_id")),
    accountGeneration: nn("account_generation"),
    sourceGeneration: nn("source_generation"),
    sourceItemRevision: nn("source_item_revision"),
    sourceContentHash: nonBlank.pipe(pg.text(), pg.columnName("source_content_hash")),
    committedAt: timestampDefaultNow("committed_at"),
  },
  $I.annote("MemoryLedgerReopenReceipt", {
    description: "Journal receipt for reopening one closed ledger source onto one tail.",
  }),
  (columns) => [
    nnCheck(columns.accountGeneration, "account_generation_nn"),
    nnCheck(columns.sourceGeneration, "source_generation_nn"),
    nnCheck(columns.sourceItemRevision, "source_item_revision_nn"),
  ],
) {}

/**
 * Encoded form of {@link MemoryLedgerReopenReceipt}.
 *
 * @see {@link MemoryLedgerReopenReceipt} for the runtime receipt.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryLedgerReopenReceipt {
  export type Encoded = S.Codec.Encoded<typeof MemoryLedgerReopenReceipt>;
}

/**
 * Logical payload hashed into an operation id.
 *
 * **Details**
 *
 * Unknown keys are not stored on the model. {@link coerceLogicalPayload} parks
 * them in `metadata`. `canonicalLogicalPayload` drops absent option fields.
 *
 * **Example** (Omit a null memory text)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { OperationLogicalPayload, canonicalLogicalPayload } from "./MemoryOperations.ts"
 *
 * const payload = OperationLogicalPayload.make({ decision: "add", memoryText: O.none() })
 * console.log(Rec.has(canonicalLogicalPayload(payload), "memory_text"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OperationLogicalPayload extends Model<OperationLogicalPayload>("OperationLogicalPayload")(
  {
    decision: described(S.String, "Operation decision.").pipe(pg.text(), pg.columnName("decision")),
    memoryText: optionalNull(S.String).pipe(pg.text(), pg.columnName("memory_text")),
    targetMemoryId: optionalNull(S.String).pipe(pg.text(), pg.columnName("target_memory_id")),
    resultStatus: optionalNull(S.String).pipe(pg.text(), pg.columnName("result_status")),
    supersedes: stringList("supersedes"),
    subjectEntityId: optionalNull(S.String).pipe(pg.text(), pg.columnName("subject_entity_id")),
    predicate: optionalNull(S.String).pipe(pg.text(), pg.columnName("predicate")),
    arguments: jsonDefault("arguments"),
    targetTier: optionalNull(S.String).pipe(pg.text(), pg.columnName("target_tier")),
    targetVisibility: optionalNull(S.String).pipe(pg.text(), pg.columnName("target_visibility")),
    targetUserAsserted: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("target_user_asserted")),
    clearGraphAssertion: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("clear_graph_assertion")),
    mutationMetadata: optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName("mutation_metadata")),
    metadata: jsonDefault("metadata"),
  },
  $I.annote("OperationLogicalPayload", {
    description: "Logical operation payload. Extra wire keys belong in metadata.",
  }),
) {}

/**
 * Encoded form of {@link OperationLogicalPayload}.
 *
 * @see {@link OperationLogicalPayload} for the runtime payload.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace OperationLogicalPayload {
  export type Encoded = S.Codec.Encoded<typeof OperationLogicalPayload>;
}

const isOperationLogicalPayload = S.is(OperationLogicalPayload);
const decodeOperationLogicalPayload = S.decodeUnknownEffect(OperationLogicalPayload);

/**
 * Snake-case payload with absent options removed.
 *
 * **Example** (Keep an empty supersedes list)
 *
 * ```ts
 * import { OperationLogicalPayload, canonicalLogicalPayload } from "./MemoryOperations.ts"
 *
 * const encoded = canonicalLogicalPayload(OperationLogicalPayload.make({ decision: "add" }))
 * console.log(A.isArray(encoded.supersedes)) // true
 * ```
 *
 * @see {@link logicalPayloadDigest} for the hash of this object.
 * @category utilities
 * @since 0.0.0
 */
export const canonicalLogicalPayload = (payload: OperationLogicalPayload): S.JsonObject => {
  const encoded: { [key: string]: S.Json } = {
    decision: payload.decision,
    supersedes: payload.supersedes,
    arguments: payload.arguments,
    metadata: payload.metadata,
  };
  if (O.isSome(payload.memoryText)) encoded.memory_text = payload.memoryText.value;
  if (O.isSome(payload.targetMemoryId)) encoded.target_memory_id = payload.targetMemoryId.value;
  if (O.isSome(payload.resultStatus)) encoded.result_status = payload.resultStatus.value;
  if (O.isSome(payload.subjectEntityId)) encoded.subject_entity_id = payload.subjectEntityId.value;
  if (O.isSome(payload.predicate)) encoded.predicate = payload.predicate.value;
  if (O.isSome(payload.targetTier)) encoded.target_tier = payload.targetTier.value;
  if (O.isSome(payload.targetVisibility)) encoded.target_visibility = payload.targetVisibility.value;
  if (O.isSome(payload.targetUserAsserted)) encoded.target_user_asserted = payload.targetUserAsserted.value;
  if (O.isSome(payload.clearGraphAssertion)) encoded.clear_graph_assertion = payload.clearGraphAssertion.value;
  if (O.isSome(payload.mutationMetadata)) encoded.mutation_metadata = payload.mutationMetadata.value;
  return encoded;
};

const snakeToCamel: Rec.ReadonlyRecord<string, string> = {
  decision: "decision",
  memory_text: "memoryText",
  target_memory_id: "targetMemoryId",
  result_status: "resultStatus",
  supersedes: "supersedes",
  subject_entity_id: "subjectEntityId",
  predicate: "predicate",
  arguments: "arguments",
  target_tier: "targetTier",
  target_visibility: "targetVisibility",
  target_user_asserted: "targetUserAsserted",
  clear_graph_assertion: "clearGraphAssertion",
  mutation_metadata: "mutationMetadata",
};

const camelKnown = HashSet.fromIterable([
  "decision",
  "memoryText",
  "targetMemoryId",
  "resultStatus",
  "supersedes",
  "subjectEntityId",
  "predicate",
  "arguments",
  "targetTier",
  "targetVisibility",
  "targetUserAsserted",
  "clearGraphAssertion",
  "mutationMetadata",
]);

/**
 * Keep known logical-payload keys and park every other key in metadata.
 *
 * **Details**
 *
 * A payload that is already a model is returned unchanged. Wire objects may use
 * snake_case or camelCase known keys. An explicit `metadata` key is itself an
 * extra and is nested under metadata, matching the Python coerce helper.
 *
 * **Example** (Park an unknown key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { coerceLogicalPayload } from "./MemoryOperations.ts"
 *
 * const payload = Effect.runSync(coerceLogicalPayload({ decision: "add", extra: 1 }))
 * console.log(payload.metadata.extra) // 1
 * ```
 *
 * @see {@link OperationLogicalPayload} for the known keys.
 * @category constructors
 * @since 0.0.0
 */
export const coerceLogicalPayload = Effect.fn("MemoryOperations.coerceLogicalPayload")(function* (
  value: OperationLogicalPayload | S.JsonObject,
) {
  if (isOperationLogicalPayload(value)) return value;
  const known: { [key: string]: S.Json } = {};
  const metadata: { [key: string]: S.Json } = {};
  A.forEach(Rec.toEntries(value), ([key, item]) => {
    const camel = O.getOrElse(Rec.get(snakeToCamel, key), () => key);
    if (HashSet.has(camelKnown, camel)) known[camel] = item;
    else metadata[key] = item;
  });
  if (!Rec.has(known, "supersedes")) known.supersedes = [];
  if (!Rec.has(known, "arguments")) known.arguments = {};
  known.metadata = metadata;
  return yield* decodeOperationLogicalPayload(known);
});

/**
 * Server-owned operation id. Observed head and output index are ignored.
 *
 * **Example** (Ignore the observed head)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { buildOperationId } from "./MemoryOperations.ts"
 *
 * const left = Effect.runSync(
 *   buildOperationId({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: ["b", "a"],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 1,
 *     sourceGeneration: 2,
 *     observedHeadCommitId: "head-a",
 *   }),
 * )
 * const right = Effect.runSync(
 *   buildOperationId({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: ["a", "b"],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 1,
 *     sourceGeneration: 2,
 *     observedHeadCommitId: "head-b",
 *   }),
 * )
 * console.log(left.length) // 35
 * ```
 *
 * @see {@link logicalPayloadDigest} for the payload half of the same identity.
 * @category utilities
 * @since 0.0.0
 */
export const buildOperationId = Effect.fn("MemoryOperations.buildOperationId")(function* (input: {
  readonly uid: string;
  readonly operationType: MemoryOperationType | string;
  readonly sourcePacketId?: string | null;
  readonly targetMemoryId?: string | null;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly logicalPayload: OperationLogicalPayload | S.JsonObject;
  readonly accountGeneration: number;
  readonly sourceGeneration: number;
  readonly observedHeadCommitId?: string | null;
  readonly outputIndex?: number | null;
}) {
  const payload = yield* coerceLogicalPayload(input.logicalPayload);
  const operationType = isMemoryOperationType(input.operationType) ? input.operationType : input.operationType;
  const digest = deterministicContractId("memory-operation", {
    uid: input.uid,
    operation_type: operationType,
    source_packet_id: input.sourcePacketId ?? null,
    target_memory_id: input.targetMemoryId ?? null,
    evidence_ids: A.sort(input.evidenceIds, stringOrder),
    logical_payload: canonicalLogicalPayload(payload),
    account_generation: input.accountGeneration,
    source_generation: input.sourceGeneration,
  });
  return `op_${Str.takeLeft(32)(digest)}`;
});

/**
 * Digest of a logical payload, including its metadata object.
 *
 * **Example** (Digest an add)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { logicalPayloadDigest } from "./MemoryOperations.ts"
 *
 * const digest = Effect.runSync(logicalPayloadDigest({ decision: "add" }))
 * console.log(digest.length) // 64
 * ```
 *
 * @see {@link canonicalLogicalPayload} for the object that is hashed.
 * @category utilities
 * @since 0.0.0
 */
export const logicalPayloadDigest = Effect.fn("MemoryOperations.logicalPayloadDigest")(function* (
  value: OperationLogicalPayload | S.JsonObject,
) {
  const payload = yield* coerceLogicalPayload(value);
  return deterministicContractId("memory-operation-logical-payload", canonicalLogicalPayload(payload));
});

/**
 * One journaled memory operation.
 *
 * **Details**
 *
 * `operationId` must equal {@link buildOperationId}. The digest must equal
 * {@link logicalPayloadDigest}. Committed rows need a head and sequence.
 * Retryable and permanent failures need an error code. `updatedAt` cannot
 * precede `createdAt`.
 *
 * **Gotchas**
 *
 * The observed head is stored and is not part of the id. Timestamps may be
 * naive; they are read as UTC.
 *
 * **Example** (Reject a mismatched id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryOperation, OperationLogicalPayload } from "./MemoryOperations.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(CheckedMemoryOperation)({
 *     operationId: "op_not_the_real_id",
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     status: "pending",
 *     logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *     logicalPayloadDigest: "0".repeat(64),
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemoryOperation extends Model<MemoryOperation>("MemoryOperation")(
  {
    operationId: nonBlank.pipe(pg.text(), pg.columnName("operation_id")),
    uid: nonBlank.pipe(pg.text(), pg.columnName("uid")),
    operationType: MemoryOperationType.pipe(pg.text(), pg.columnName("operation_type")),
    status: MemoryOperationStatus.pipe(pg.text(), pg.columnName("status")),
    sourcePacketId: optionalNull(S.String).pipe(pg.text(), pg.columnName("source_packet_id")),
    targetMemoryId: optionalNull(S.String).pipe(pg.text(), pg.columnName("target_memory_id")),
    evidenceIds: stringList("evidence_ids"),
    logicalPayload: OperationLogicalPayload.pipe(pg.jsonb(), pg.columnName("logical_payload")),
    logicalPayloadDigest: S.String.pipe(pg.text(), pg.columnName("logical_payload_digest")),
    accountGeneration: nn("account_generation"),
    sourceGeneration: nn("source_generation"),
    observedHeadCommitId: optionalNull(S.String).pipe(pg.text(), pg.columnName("observed_head_commit_id")),
    committedHeadCommitId: optionalNull(nonBlank).pipe(pg.text(), pg.columnName("committed_head_commit_id")),
    committedSequence: optionalNull(NonNegativeInt).pipe(pg.integer(), pg.columnName("committed_sequence")),
    committedMemoryItemIds: stringList("committed_memory_item_ids"),
    committedOutboxEventIds: stringList("committed_outbox_event_ids"),
    attemptCount: nnDefault("attempt_count"),
    errorCode: optionalNull(nonBlank).pipe(pg.text(), pg.columnName("error_code")),
    untrustedProposedOperationId: optionalNull(S.String).pipe(pg.text(), pg.columnName("untrusted_proposed_operation_id")),
    createdAt: timestampDefaultNow("created_at"),
    updatedAt: timestampDefaultNow("updated_at"),
  },
  $I.annote("MemoryOperation", {
    description: "Journaled memory operation. The id and digest are server-owned.",
  }),
  (columns) => [
    nnCheck(columns.accountGeneration, "account_generation_nn"),
    nnCheck(columns.sourceGeneration, "source_generation_nn"),
    nnCheck(columns.attemptCount, "attempt_count_nn"),
  ],
) {}

/**
 * Encoded form of {@link MemoryOperation}.
 *
 * @see {@link MemoryOperation} for the integrity rules.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryOperation {
  export type Encoded = S.Codec.Encoded<typeof MemoryOperation>;
}

/**
 * Explain why an operation fails its journal integrity rules.
 *
 * **Example** (Flag a committed row with no head)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { MemoryOperation, OperationLogicalPayload, operationIntegrityIssue } from "./MemoryOperations.ts"
 *
 * const issue = operationIntegrityIssue(
 *   MemoryOperation.make({
 *     operationId: "op_x",
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     status: "committed",
 *     logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *     logicalPayloadDigest: "digest",
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     committedHeadCommitId: O.none(),
 *     committedSequence: O.none(),
 *   }),
 * )
 * console.log(Predicate.isString(issue)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const operationIntegrityIssue = (operation: MemoryOperation): string | undefined => {
  if (DateTime.isLessThan(operation.updatedAt, operation.createdAt)) return "updated_at must be >= created_at";
  if (Equal.equals(operation.status, "committed") && !hasText(operation.committedHeadCommitId)) {
    return "committed operations require committed_head_commit_id";
  }
  if (Equal.equals(operation.status, "committed") && O.isNone(operation.committedSequence)) {
    return "committed operations require committed_sequence";
  }
  if (
    (Equal.equals(operation.status, "retryable_failure") || Equal.equals(operation.status, "permanent_failure")) &&
    !hasText(operation.errorCode)
  ) {
    return "failure operations require error_code";
  }
  return undefined;
};

/**
 * {@link MemoryOperation} decoder that checks status requirements.
 *
 * **Details**
 *
 * The id and digest are checked by {@link assertOperationIdentity}, not by this
 * filter, so a stored row can be decoded before the caller recomputes the id.
 *
 * **Example** (Reject a failure without an error code)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedMemoryOperation, OperationLogicalPayload } from "./MemoryOperations.ts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(CheckedMemoryOperation)({
 *     operationId: "op_x",
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     status: "permanent_failure",
 *     logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *     logicalPayloadDigest: "digest",
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     createdAt: "2020-01-02T03:04:05.000Z",
 *     updatedAt: "2020-01-02T03:04:05.000Z",
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @see {@link operationIntegrityIssue} for the predicate.
 * @category schemas
 * @since 0.0.0
 */
export const CheckedMemoryOperation = MemoryOperation.check(
  S.makeFilter((operation: MemoryOperation) => operationIntegrityIssue(operation), {
    identifier: "MemoryOperationIntegrity",
    title: "Memory operation integrity",
    message: "memory operation is illegal",
  }),
);

/**
 * Decoded operation that satisfies status requirements.
 *
 * @see {@link CheckedMemoryOperation} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedMemoryOperation = typeof CheckedMemoryOperation.Type;

/**
 * Fail when the stored id or digest does not match the logical payload.
 *
 * **Example** (Accept a freshly built id)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { assertOperationIdentity, memoryOperationNew } from "./MemoryOperations.ts"
 * import * as DateTime from "effect/DateTime"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = Effect.runSync(
 *   memoryOperationNew({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: [],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     now,
 *   }),
 * )
 * console.log(Effect.runSyncExit(assertOperationIdentity(operation))._tag) // "Success"
 * ```
 *
 * @see {@link buildOperationId} for the id formula.
 * @category assertions
 * @since 0.0.0
 */
export const assertOperationIdentity = Effect.fn("MemoryOperations.assertOperationIdentity")(function* (
  operation: MemoryOperation,
) {
  const structural = operationIntegrityIssue(operation);
  if (Predicate.isString(structural)) return yield* MemoryOperationError.make({ message: structural });
  const expected = yield* buildOperationId({
    uid: operation.uid,
    operationType: operation.operationType,
    sourcePacketId: O.getOrNull(operation.sourcePacketId),
    targetMemoryId: O.getOrNull(operation.targetMemoryId),
    evidenceIds: operation.evidenceIds,
    logicalPayload: operation.logicalPayload,
    accountGeneration: operation.accountGeneration,
    sourceGeneration: operation.sourceGeneration,
    observedHeadCommitId: O.getOrNull(operation.observedHeadCommitId),
  });
  if (!Equal.equals(operation.operationId, expected)) {
    return yield* MemoryOperationError.make({
      message: "operation_id does not match server-computed logical identity",
    });
  }
  const digest = yield* logicalPayloadDigest(operation.logicalPayload);
  if (!Equal.equals(operation.logicalPayloadDigest, digest)) {
    return yield* MemoryOperationError.make({
      message: "logical_payload_digest does not match canonical logical payload",
    });
  }
});

/**
 * Build a pending operation with a server id and digest.
 *
 * **Example** (Sort evidence into the id)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { memoryOperationNew } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = Effect.runSync(
 *   memoryOperationNew({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: ["b", "a"],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     proposedOperationId: "   ",
 *     now,
 *   }),
 * )
 * console.log(operation.status) // "pending"
 * console.log(operation.untrustedProposedOperationId._tag) // "None"
 * ```
 *
 * @see {@link buildOperationId} for the id.
 * @category constructors
 * @since 0.0.0
 */
export const memoryOperationNew = Effect.fn("MemoryOperations.memoryOperationNew")(function* (input: {
  readonly uid: string;
  readonly operationType: MemoryOperationType;
  readonly sourcePacketId?: string | null;
  readonly targetMemoryId?: string | null;
  readonly evidenceIds: ReadonlyArray<string>;
  readonly logicalPayload: OperationLogicalPayload | S.JsonObject;
  readonly accountGeneration: number;
  readonly sourceGeneration: number;
  readonly observedHeadCommitId?: string | null;
  readonly proposedOperationId?: string | null;
  readonly now: DateTime.Utc;
}) {
  const logicalPayload = yield* coerceLogicalPayload(input.logicalPayload);
  const operationId = yield* buildOperationId({ ...input, logicalPayload });
  const logicalPayloadDigestValue = yield* logicalPayloadDigest(logicalPayload);
  const proposed = input.proposedOperationId ?? null;
  return MemoryOperation.make({
    operationId,
    uid: input.uid,
    operationType: input.operationType,
    status: "pending",
    sourcePacketId: O.fromNullishOr(input.sourcePacketId ?? null),
    targetMemoryId: O.fromNullishOr(input.targetMemoryId ?? null),
    evidenceIds: input.evidenceIds,
    logicalPayload,
    logicalPayloadDigest: logicalPayloadDigestValue,
    accountGeneration: input.accountGeneration,
    sourceGeneration: input.sourceGeneration,
    observedHeadCommitId: O.fromNullishOr(input.observedHeadCommitId ?? null),
    untrustedProposedOperationId: Predicate.isString(proposed) && !Str.isEmpty(Str.trim(proposed)) ? O.some(proposed) : O.none(),
    createdAt: input.now,
    updatedAt: input.now,
  });
});

/**
 * Move a non-terminal operation to a new status.
 *
 * **Example** (Reject a committed transition)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { MemoryOperation, OperationLogicalPayload, transitionOperation } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = MemoryOperation.make({
 *   operationId: "op_x",
 *   uid: "user-1",
 *   operationType: "synthesis",
 *   status: "committed",
 *   logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *   logicalPayloadDigest: "digest",
 *   accountGeneration: 0,
 *   sourceGeneration: 0,
 *   committedHeadCommitId: O.some("head"),
 *   committedSequence: O.some(1),
 *   createdAt: now,
 *   updatedAt: now,
 * })
 * console.log(Effect.runSyncExit(transitionOperation(operation, "pending", {}, now))._tag) // "Failure"
 * ```
 *
 * @see {@link isTerminalOperationStatus} for the statuses that cannot move.
 * @category utilities
 * @since 0.0.0
 */
export const transitionOperation = Effect.fn("MemoryOperations.transitionOperation")(function* (
  operation: MemoryOperation,
  status: MemoryOperationStatus,
  updates: Partial<{
    readonly attemptCount: number;
    readonly errorCode: O.Option<string>;
    readonly committedHeadCommitId: O.Option<string>;
    readonly committedSequence: O.Option<number>;
    readonly committedMemoryItemIds: ReadonlyArray<string>;
    readonly committedOutboxEventIds: ReadonlyArray<string>;
    readonly observedHeadCommitId: O.Option<string>;
  }>,
  now: DateTime.Utc,
) {
  if (isTerminalOperationStatus(operation.status)) {
    return yield* MemoryOperationError.make({
      message: `cannot transition terminal operation from ${operation.status}`,
    });
  }
  return MemoryOperation.make({ ...operation, ...updates, status, updatedAt: now });
});

/**
 * Record a retryable failure and increment the attempt count.
 *
 * **Example** (Increment the attempt)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { markOperationRetryable, memoryOperationNew } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const later = DateTime.makeUnsafe("2020-01-02T04:04:05.000Z")
 * const operation = Effect.runSync(
 *   memoryOperationNew({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: [],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     now,
 *   }),
 * )
 * const retried = Effect.runSync(markOperationRetryable(operation, "boom", later))
 * console.log(retried.attemptCount) // 1
 * ```
 *
 * @see {@link transitionOperation} for the terminal guard.
 * @category utilities
 * @since 0.0.0
 */
export const markOperationRetryable = Effect.fn("MemoryOperations.markOperationRetryable")(function* (
  operation: MemoryOperation,
  errorCode: string,
  now: DateTime.Utc,
) {
  return yield* transitionOperation(
    operation,
    "retryable_failure",
    { attemptCount: operation.attemptCount + 1, errorCode: O.some(errorCode) },
    now,
  );
});

/**
 * Mark an operation committed and clear its error code.
 *
 * **Example** (Clear the error)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { markOperationCommitted, memoryOperationNew } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = Effect.runSync(
 *   memoryOperationNew({
 *     uid: "user-1",
 *     operationType: "synthesis",
 *     evidenceIds: [],
 *     logicalPayload: { decision: "add" },
 *     accountGeneration: 0,
 *     sourceGeneration: 0,
 *     now,
 *   }),
 * )
 * const committed = Effect.runSync(markOperationCommitted(operation, "head", 1, now))
 * console.log(O.isNone(committed.errorCode)) // true
 * ```
 *
 * @see {@link markOperationRetryable} for the failure transition.
 * @category utilities
 * @since 0.0.0
 */
export const markOperationCommitted = Effect.fn("MemoryOperations.markOperationCommitted")(function* (
  operation: MemoryOperation,
  committedHeadCommitId: string,
  committedSequence: number,
  now: DateTime.Utc,
  committedMemoryItemIds: ReadonlyArray<string> = [],
  committedOutboxEventIds: ReadonlyArray<string> = [],
) {
  return yield* transitionOperation(
    operation,
    "committed",
    {
      committedHeadCommitId: O.some(committedHeadCommitId),
      committedSequence: O.some(committedSequence),
      committedMemoryItemIds,
      committedOutboxEventIds,
      errorCode: O.none(),
    },
    now,
  );
});

/**
 * Report whether the operation's generations differ from the control generations.
 *
 * **Example** (Detect a source generation change)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { MemoryOperation, OperationLogicalPayload, operationIsStale } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = MemoryOperation.make({
 *   operationId: "op_x",
 *   uid: "user-1",
 *   operationType: "synthesis",
 *   status: "pending",
 *   logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *   logicalPayloadDigest: "digest",
 *   accountGeneration: 1,
 *   sourceGeneration: 2,
 *   createdAt: now,
 *   updatedAt: now,
 * })
 * console.log(operationIsStale(operation, 1, 3)) // true
 * ```
 *
 * **Example** (Check staleness in a pipeline)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { pipe } from "effect/Function"
 * import { MemoryOperation, OperationLogicalPayload, operationIsStale } from "./MemoryOperations.ts"
 *
 * const now = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const operation = MemoryOperation.make({
 *   operationId: "op_x",
 *   uid: "user-1",
 *   operationType: "synthesis",
 *   status: "pending",
 *   logicalPayload: OperationLogicalPayload.make({ decision: "add" }),
 *   logicalPayloadDigest: "digest",
 *   accountGeneration: 1,
 *   sourceGeneration: 2,
 *   createdAt: now,
 *   updatedAt: now,
 * })
 * console.log(pipe(operation, operationIsStale(1, 2))) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const operationIsStale: {
  (accountGeneration: number, sourceGeneration: number): (operation: MemoryOperation) => boolean;
  (operation: MemoryOperation, accountGeneration: number, sourceGeneration: number): boolean;
} = dual(
  3,
  (operation: MemoryOperation, accountGeneration: number, sourceGeneration: number): boolean =>
    !Equal.equals(accountGeneration, operation.accountGeneration) ||
    !Equal.equals(sourceGeneration, operation.sourceGeneration),
);
