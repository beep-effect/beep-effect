import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import {
  ApplyResult,
  ApplyStatus,
  CheckedMemoryControlState,
  CoercedUtcTimestamp,
  MemoryApplyError,
  MemoryControlState,
  MemoryOutboxEvent,
  MemoryOutboxEventType,
  MemoryOutboxStatus,
  MemoryWriterClass,
  WriterAdmissionError,
  WriterMode,
  advanceHead,
  advanceProjectionWatermark,
  applyLongTermPatchTransaction,
  barrierOutboxEvents,
  buildPatchMutationIdentity,
  coerceIsoTimestamp,
  controlStateIssue,
  memoryContentHash,
  nextCommitId,
  outboxEventId,
  processingStateForPromotion,
  requireWriterAdmitted,
  validGraphEnrichmentReceipt,
} from "../../beep/MemoryApply.ts";
import { MemoryOperation, OperationLogicalPayload, logicalPayloadDigest } from "../../beep/MemoryOperations.ts";
import { MemoryItem } from "../../beep/ProductMemory.ts";

const isWriterAdmissionError = S.is(WriterAdmissionError);
const isMemoryApplyError = S.is(MemoryApplyError);
const isString = S.is(S.String);
const isStringArray = S.is(S.Array(S.String));
const decodeUnknownSyncJsonObject = S.decodeUnknownSync(S.JsonObject);

const decode = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  S.decodeUnknownSync(schema)(input);

const decodeFails = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, input: unknown): boolean =>
  S.decodeUnknownExit(schema)(input)._tag === "Failure";

const flipTag = <A, E extends { readonly _tag: string }>(effect: Effect.Effect<A, E>): string =>
  effect.pipe(Effect.flip, Effect.runSync)._tag;

const at = <T>(items: ReadonlyArray<T>, index: number): T => O.getOrThrow(A.get(items, index));

const controlInput = {
  uid: "user-1",
  headCommitId: "commit_root",
  accountGeneration: 1,
  sourceGeneration: 2,
};

const control = MemoryControlState.make(controlInput);

/** Wire-side keys the port requires on decode: non-null Python defaults are construction-only here. */
const controlWire = {
  ...controlInput,
  writerMode: "compatibility",
  writerEpoch: 0,
  ledgerMigrationMigratedCount: 0,
  ledgerMigrationAdjudicatedCount: 0,
  commitSequence: 0,
  projectionWatermarkSequence: 0,
  legacyBackfillProcessedCount: 0,
  updatedAt: "2020-01-02T03:04:05Z",
};

const outboxInput: Parameters<typeof MemoryOutboxEvent.make>[0] = {
  eventId: "evt_1",
  uid: "user-1",
  eventType: "projection_sync",
  commitId: "commit_1",
  parentCommitId: "commit_root",
  commitSequence: 1,
  operationId: "op_1",
  accountGeneration: 1,
  sourceGeneration: 2,
};

const outboxWire = {
  ...outboxInput,
  status: "pending",
  payload: {},
  availableAt: "2020-01-02T03:04:05Z",
  attemptCount: 0,
};

describe("MemoryApply literal kits", () => {
  it("decode their members and reject strangers", () => {
    assert.strictEqual(decode(ApplyStatus, "committed"), "committed");
    assert.strictEqual(decode(WriterMode, "transitioning_to_ledger"), "transitioning_to_ledger");
    assert.strictEqual(decode(MemoryWriterClass, "user"), "user");
    assert.strictEqual(decode(MemoryOutboxEventType, "delete_sync"), "delete_sync");
    assert.strictEqual(decode(MemoryOutboxStatus, "dead_letter"), "dead_letter");
    assert.strictEqual(decodeFails(ApplyStatus, "rolled_back"), true);
    assert.strictEqual(decodeFails(WriterMode, "legacy"), true);
  });
});

describe("CoercedUtcTimestamp", () => {
  it("stamps a naive value as UTC and converts an offset", () => {
    assert.strictEqual(DateTime.formatIso(decode(CoercedUtcTimestamp, "2020-01-02T03:04:05")), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(
      DateTime.formatIso(decode(CoercedUtcTimestamp, "2020-01-02T03:04:05+02:00")),
      "2020-01-02T01:04:05.000Z",
    );
    assert.strictEqual(decodeFails(CoercedUtcTimestamp, "yesterday"), true);
  });
});

describe("MemoryControlState", () => {
  it("decodes present values", () => {
    const decoded = decode(MemoryControlState, {
      ...controlWire,
      writerMode: "transitioning_to_ledger",
      writerEpoch: 3,
      writerTransitionOwner: "migrator",
      commitSequence: 7,
      projectionWatermarkCommitId: "commit_6",
      lastPromotionRunAt: "2020-01-02T03:04:05",
      updatedAt: "2020-01-02T03:04:05Z",
    });
    assert.strictEqual(decoded.writerEpoch, 3);
    assert.strictEqual(O.getOrNull(decoded.writerTransitionOwner), "migrator");
    assert.strictEqual(O.getOrNull(decoded.projectionWatermarkCommitId), "commit_6");
    assert.strictEqual(O.map(decoded.lastPromotionRunAt, DateTime.formatIso).pipe(O.getOrNull), "2020-01-02T03:04:05.000Z");
  });

  it("reads null and missing optionals as None and applies defaults", () => {
    const decoded = decode(MemoryControlState, {
      ...controlWire,
      writerTransitionOwner: null,
      vectorWatermarkCommitId: null,
      lastConsolidationRunAt: null,
    });
    assert.strictEqual(O.isNone(decoded.writerTransitionOwner), true);
    assert.strictEqual(O.isNone(decoded.vectorWatermarkCommitId), true);
    assert.strictEqual(O.isNone(decoded.lastConsolidationRunAt), true);
    assert.strictEqual(O.isNone(decoded.legacyBackfillCompletedAt), true);
    assert.strictEqual(decoded.writerMode, "compatibility");
    assert.strictEqual(decoded.commitSequence, 0);
    assert.strictEqual(control.writerEpoch, 0);
    assert.strictEqual(O.isNone(control.projectionWatermarkCommitId), true);
  });

  it("rejects blank ids, negative counters, and boolean epochs", () => {
    assert.strictEqual(decodeFails(MemoryControlState, { ...controlWire, uid: "  " }), true);
    assert.strictEqual(decodeFails(MemoryControlState, { ...controlWire, commitSequence: -1 }), true);
    assert.strictEqual(decodeFails(MemoryControlState, { ...controlWire, writerEpoch: true }), true);
    assert.strictEqual(decodeFails(MemoryControlState, { ...controlWire, writerEpoch: "1" }), true);
    assert.strictEqual(decodeFails(MemoryControlState, { ...controlWire, writerEpoch: 1.5 }), true);
  });

  it("enforces the transition owner rule", () => {
    assert.strictEqual(controlStateIssue(control), undefined);
    assert.strictEqual(
      controlStateIssue(MemoryControlState.make({ ...controlInput, writerMode: "transitioning_to_compatibility" })),
      "transitioning writer mode requires an owner",
    );
    assert.strictEqual(
      controlStateIssue(MemoryControlState.make({ ...controlInput, writerTransitionOwner: O.some("owner") })),
      "stable writer mode cannot retain a transition owner",
    );
    assert.strictEqual(
      controlStateIssue(
        MemoryControlState.make({ ...controlInput, writerMode: "transitioning_to_ledger", writerTransitionOwner: O.some(" owner ") }),
      ),
      "writer transition owner must not contain surrounding whitespace",
    );
    assert.strictEqual(decodeFails(CheckedMemoryControlState, { ...controlWire, writerMode: "transitioning_to_ledger" }), true);
    const checked = decode(CheckedMemoryControlState, {
      ...controlWire,
      writerMode: "transitioning_to_ledger",
      writerTransitionOwner: "migrator",
    });
    assert.strictEqual(checked.writerMode, "transitioning_to_ledger");
  });
});

describe("requireWriterAdmitted", () => {
  const withMode = (writerMode: WriterMode, owner?: string) =>
    MemoryControlState.make({ ...controlInput, writerMode, writerTransitionOwner: O.fromNullishOr(owner) });
  const admitted = (state: MemoryControlState, writerClass: string, allowLedgerMigration = false): boolean =>
    requireWriterAdmitted(state, writerClass, allowLedgerMigration).pipe(Effect.runSyncExit, Exit.isSuccess);

  it("admits user writes only in stable modes", () => {
    assert.strictEqual(admitted(withMode("compatibility"), "user"), true);
    assert.strictEqual(admitted(withMode("ledger"), "user"), true);
    assert.strictEqual(admitted(withMode("transitioning_to_ledger", "owner"), "user"), false);
    assert.strictEqual(admitted(withMode("transitioning_to_compatibility", "owner"), "user"), false);
  });

  it("routes compatibility and ledger writers by mode and migration seam", () => {
    assert.strictEqual(admitted(withMode("compatibility"), "compatibility"), true);
    assert.strictEqual(admitted(withMode("compatibility"), "ledger"), false);
    assert.strictEqual(admitted(withMode("compatibility"), "ledger", true), true);
    assert.strictEqual(admitted(withMode("ledger"), "ledger"), true);
    assert.strictEqual(admitted(withMode("ledger"), "compatibility"), false);
    assert.strictEqual(admitted(withMode("transitioning_to_ledger", "owner"), "ledger"), false);
    assert.strictEqual(admitted(withMode("transitioning_to_ledger", "owner"), "ledger", true), true);
    assert.strictEqual(admitted(withMode("transitioning_to_compatibility", "owner"), "ledger", true), false);
  });

  it("fails with WriterAdmissionError, naming an unknown class first", () => {
    assert.strictEqual(flipTag(requireWriterAdmitted(control, "robot")), "WriterAdmissionError");
    const error = requireWriterAdmitted(withMode("ledger"), "compatibility").pipe(Effect.flip, Effect.runSync);
    assert.strictEqual(isWriterAdmissionError(error), true);
    assert.strictEqual(error.message, "compatibility writer is not admitted while writer mode is ledger");
  });
});

describe("control head transitions", () => {
  it("derives the next commit id from the head and sequence", () => {
    const first = nextCommitId(control, "op_1");
    assert.strictEqual(first.startsWith("commit_"), true);
    assert.strictEqual(first.length, "commit_".length + 32);
    assert.strictEqual(nextCommitId("op_1")(control), first);
    assert.notStrictEqual(nextCommitId(control, "op_2"), first);
    assert.notStrictEqual(nextCommitId(MemoryControlState.make({ ...controlInput, commitSequence: 1 }), "op_1"), first);
  });

  it("advances the head and rejects a blank commit", () => {
    const next = Effect.runSync(advanceHead(control, "commit_next"));
    assert.strictEqual(next.headCommitId, "commit_next");
    assert.strictEqual(next.commitSequence, 1);
    assert.strictEqual(DateTime.isGreaterThanOrEqualTo(next.updatedAt, control.updatedAt), true);
    assert.strictEqual(flipTag(advanceHead(control, "  ")), "MemoryApplyError");
  });

  it("advances the projection watermark by exactly one event", () => {
    const event = MemoryOutboxEvent.make({ ...outboxInput, eventType: "projection_sync" });
    const advanced = Effect.runSync(advanceProjectionWatermark(control, event));
    assert.strictEqual(O.getOrNull(advanced.projectionWatermarkCommitId), "commit_1");
    assert.strictEqual(advanced.projectionWatermarkSequence, 1);
    const chained = Effect.runSync(
      advanceProjectionWatermark(advanced, MemoryOutboxEvent.make({ ...outboxInput, commitId: "commit_2", parentCommitId: "commit_1", commitSequence: 2 })),
    );
    assert.strictEqual(chained.projectionWatermarkSequence, 2);
    const error = (state: MemoryControlState, patch: Partial<typeof outboxInput>) =>
      advanceProjectionWatermark(state, MemoryOutboxEvent.make({ ...outboxInput, ...patch })).pipe(Effect.flip, Effect.runSync);
    assert.strictEqual(error(control, { accountGeneration: 9 }).message, "projection watermark account_generation mismatch");
    assert.strictEqual(error(control, { commitSequence: 2 }).message, "projection watermark cannot skip commits or move backwards");
    assert.strictEqual(
      error(advanced, { commitId: "commit_2", parentCommitId: "commit_0", commitSequence: 2 }).message,
      "projection watermark parent chain mismatch",
    );
    assert.strictEqual(isMemoryApplyError(error(control, { accountGeneration: 9 })), true);
  });
});

describe("MemoryOutboxEvent", () => {
  it("decodes present values and applies defaults", () => {
    const decoded = decode(MemoryOutboxEvent, {
      ...outboxWire,
      status: "processing",
      memoryId: "mem-1",
      payload: { action: "upsert" },
      availableAt: "2020-01-02T03:04:05",
      attemptCount: 2,
    });
    assert.strictEqual(decoded.status, "processing");
    assert.strictEqual(O.getOrNull(decoded.memoryId), "mem-1");
    assert.strictEqual(decoded.attemptCount, 2);
    assert.strictEqual(DateTime.formatIso(decoded.availableAt), "2020-01-02T03:04:05.000Z");
    const bare = decode(MemoryOutboxEvent, { ...outboxWire, memoryId: null });
    assert.strictEqual(bare.status, "pending");
    assert.strictEqual(O.isNone(bare.memoryId), true);
    assert.deepStrictEqual(bare.payload, {});
    assert.strictEqual(bare.attemptCount, 0);
    assert.strictEqual(O.isNone(MemoryOutboxEvent.make(outboxInput).memoryId), true);
  });

  it("rejects blank identifiers but not a blank parent", () => {
    assert.strictEqual(decodeFails(MemoryOutboxEvent, { ...outboxWire, eventId: " " }), true);
    assert.strictEqual(decodeFails(MemoryOutboxEvent, { ...outboxWire, operationId: "" }), true);
    assert.strictEqual(decode(MemoryOutboxEvent, { ...outboxWire, parentCommitId: "" }).parentCommitId, "");
  });

  it("derives deterministic event ids and barrier events", () => {
    const barrier = outboxEventId({ eventType: "projection_sync", commitId: "commit_1", memoryId: O.none(), operationId: "op_1" });
    assert.strictEqual(barrier.startsWith("evt_"), true);
    assert.notStrictEqual(barrier, outboxEventId({ eventType: "vector_sync", commitId: "commit_1", memoryId: O.none(), operationId: "op_1" }));
    assert.notStrictEqual(barrier, outboxEventId({ eventType: "projection_sync", commitId: "commit_1", memoryId: O.some("mem-1"), operationId: "op_1" }));
    const events = barrierOutboxEvents({ operation: baseOperation, controlState: control, commitId: "commit_1", sequence: 1 });
    assert.deepStrictEqual(A.map(events, (event) => event.eventType), ["projection_sync", "vector_sync"]);
    assert.deepStrictEqual(A.map(events, (event) => event.payload), [{ action: "barrier" }, { action: "barrier" }]);
    assert.strictEqual(at(events, 0).parentCommitId, "commit_root");
    assert.strictEqual(O.isNone(at(events, 0).memoryId), true);
  });
});

describe("pure helpers", () => {
  it("builds the mutation identity from the non-excluded keys", () => {
    assert.deepStrictEqual(
      buildPatchMutationIdentity({ decision: "add", memoryText: "x", patch_id: "p", halfLifeDays: 30, nested: { a: [1] } }),
      { halfLifeDays: 30, nested: { a: [1] } },
    );
  });

  it("hashes content with evidence ids, untruncated, in both call orders", () => {
    const hash = memoryContentHash(O.some("Ada"), ["ev-1"]);
    assert.strictEqual(hash.length, 64);
    assert.strictEqual(memoryContentHash(["ev-1"])(O.some("Ada")), hash);
    assert.notStrictEqual(memoryContentHash(O.none(), ["ev-1"]), hash);
    assert.notStrictEqual(memoryContentHash(O.some("Ada"), ["ev-2"]), hash);
  });

  it("maps promotion processing status onto the product state", () => {
    assert.strictEqual(processingStateForPromotion(O.some({ processingStatus: "pending_processing" }), "processed"), "pending");
    assert.strictEqual(processingStateForPromotion(O.some({ processing_status: "processing_failed_retryable" }), "processed"), "pending");
    assert.strictEqual(processingStateForPromotion(O.some({ processingStatus: "pending_admission" }), "processed"), "pending");
    assert.strictEqual(processingStateForPromotion(O.some({ processingStatus: "processing_blocked" }), "processed"), "blocked");
    assert.strictEqual(processingStateForPromotion(O.some({ processingStatus: "processed" }), "pending"), "processed");
    assert.strictEqual(processingStateForPromotion(O.some({ processingStatus: "weird" }), "blocked"), "blocked");
    assert.strictEqual(processingStateForPromotion(O.none(), "pending"), "pending");
    assert.strictEqual(processingStateForPromotion("processed")(O.none()), "processed");
  });

  it("coerces ISO timestamps and drops malformed ones", () => {
    const parsed = Effect.runSync(coerceIsoTimestamp("2020-01-02T03:04:05Z", "captured_at"));
    assert.strictEqual(O.map(parsed, DateTime.formatIso).pipe(O.getOrNull), "2020-01-02T03:04:05.000Z");
    const naive = Effect.runSync(coerceIsoTimestamp("2020-01-02T03:04:05", "captured_at"));
    assert.strictEqual(O.map(naive, DateTime.formatIso).pipe(O.getOrNull), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(coerceIsoTimestamp("yesterday", "captured_at").pipe(Effect.runSync, O.isNone), true);
  });

  it("rejects malformed graph enrichment receipts", () => {
    const context = { operation: baseOperation, existingItem: MemoryItem.make(itemMake), existingEvidenceIds: ["ev-1"], controlState: control, graphPlan: O.none() };
    assert.strictEqual(validGraphEnrichmentReceipt("nope", context), false);
    assert.strictEqual(validGraphEnrichmentReceipt(context)({ schemaVersion: "canonical_memory_graph_enrichment_receipt.v1" }), false);
  });
});

const digestFor = (patch: Record<string, unknown>) =>
  Effect.runSync(
    logicalPayloadDigest({
      decision: isString(patch.decision) ? patch.decision : "add",
      memory_text: isString(patch.memoryText) ? patch.memoryText : null,
      target_memory_id: isString(patch.targetMemoryId) ? patch.targetMemoryId : null,
      result_status: isString(patch.resultStatus) ? patch.resultStatus : "active",
      supersedes: isStringArray(patch.supersedes) ? patch.supersedes : [],
      arguments: {},
    }),
  );

const basePatch = {
  patchId: "patch-1",
  packetId: "packet-1",
  runId: "run-1",
  idempotencyKey: "key-1",
  decision: "add",
  resultStatus: "active",
  observedHeadCommitId: null,
  memoryText: "Ada lives in Seattle",
  evidenceIds: ["ev-1"],
  initialTier: "short_term",
};

const operationFor = (patch: Record<string, unknown>, overrides: Partial<Parameters<typeof MemoryOperation.make>[0]> = {}) =>
  MemoryOperation.make({
    operationId: "op_1",
    uid: "user-1",
    operationType: "synthesis",
    status: "pending",
    evidenceIds: isStringArray(patch.evidenceIds) ? patch.evidenceIds : [],
    logicalPayload: OperationLogicalPayload.make({ decision: isString(patch.decision) ? patch.decision : "add" }),
    logicalPayloadDigest: digestFor(patch),
    accountGeneration: 1,
    sourceGeneration: 2,
    ...overrides,
  });

const baseOperation = operationFor(basePatch);

const itemMake: Parameters<typeof MemoryItem.make>[0] = {
  memoryId: "mem-1",
  uid: "user-1",
  version: 1,
  tier: "short_term",
  status: "active",
  processingState: "processed",
  content: O.some("Ada lives in Seattle"),
  sourceState: "active",
  sensitivityLabels: [],
  visibility: "private",
  userAsserted: false,
  capturedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
  updatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
};

const itemJson = {
  memoryId: "mem-1",
  uid: "user-1",
  version: 1,
  tier: "short_term",
  status: "active",
  processingState: "processed",
  content: "Ada lives in Seattle",
  sourceState: "active",
  sensitivityLabels: [],
  visibility: "private",
  userAsserted: false,
  capturedAt: "2020-01-02T03:04:05.000Z",
  updatedAt: "2020-01-02T03:04:05.000Z",
  expiresAt: "2020-01-04T03:04:05.000Z",
  contentHash: "hash-1",
};

const apply = (
  patchPayload: Record<string, unknown>,
  overrides: { controlState?: MemoryControlState; operation?: MemoryOperation; allowTriggerFeedbackArguments?: boolean } = {},
) => {
  const payload = decodeUnknownSyncJsonObject(patchPayload);
  return applyLongTermPatchTransaction({
      controlState: overrides.controlState ?? control,
      operation: overrides.operation ?? operationFor(patchPayload),
      patchPayload: payload,
      ...(overrides.allowTriggerFeedbackArguments === undefined ? {} : { allowTriggerFeedbackArguments: overrides.allowTriggerFeedbackArguments }),
  });
};

describe("applyLongTermPatchTransaction rejections", () => {
  it.effect("returns invalid_patch with the error tag when the patch does not decode", () =>
    Effect.gen(function* () {
    const { memoryText: _dropped, ...noText } = basePatch;
    const result = yield* apply(noText);
    assert.strictEqual(result.status, "invalid_patch");
    assert.strictEqual(O.getOrNull(result.reason), "SchemaError");
    assert.strictEqual(result.controlState.commitSequence, 0);
    }));

  it.effect("returns payload_mismatch when evidence ids or the digest differ", () =>
    Effect.gen(function* () {
    const evidence = yield* apply(basePatch, { operation: operationFor({ ...basePatch, evidenceIds: [] }) });
    assert.strictEqual(evidence.status, "payload_mismatch");
    assert.strictEqual(O.getOrNull(evidence.reason), "patch evidence_ids do not match operation evidence_ids");
    const digest = yield* apply(basePatch, { operation: operationFor({ ...basePatch, memoryText: "other" }) });
    assert.strictEqual(digest.status, "payload_mismatch");
    assert.strictEqual(O.getOrNull(digest.reason), "patch digest does not match operation logical payload digest");
    }));

  it.effect("requires ledger authority for knowledge ledger writes", () =>
    Effect.gen(function* () {
    const result = yield* apply({
      ...basePatch,
      ledgerSchemaVersion: "knowledge_ledger.v1",
      initialTier: "long_term",
      kind: "fact",
      slot: "city",
      writeReason: "explicit_remember",
      intentBacked: true,
    });
    assert.strictEqual(result.status, "invalid_patch");
    assert.strictEqual(O.getOrNull(result.reason), "knowledge ledger writes require ledger_mutation authority");
    }));

  it.effect("skips an already committed operation", () =>
    Effect.gen(function* () {
    const result = yield* apply(basePatch, {
      operation: operationFor(basePatch, { status: "committed", committedHeadCommitId: O.some("commit_x"), committedSequence: O.some(1) }),
    });
    assert.strictEqual(result.status, "idempotent_skip");
    assert.strictEqual(O.isNone(result.reason), true);
    assert.strictEqual(result.memoryItems.length, 0);
    }));

  it.effect("marks a stale generation and returns generation_mismatch", () =>
    Effect.gen(function* () {
    const result = yield* apply(basePatch, { operation: operationFor(basePatch, { sourceGeneration: 9 }) });
    assert.strictEqual(result.status, "generation_mismatch");
    assert.strictEqual(result.operation.status, "stale_generation");
    assert.strictEqual(result.controlState.headCommitId, "commit_root");
    }));

  it.effect("rebases the operation on a head mismatch", () =>
    Effect.gen(function* () {
    const result = yield* apply(basePatch, { operation: operationFor(basePatch, { observedHeadCommitId: O.some("commit_old") }) });
    assert.strictEqual(result.status, "retryable_head_mismatch");
    assert.strictEqual(O.getOrNull(result.operation.observedHeadCommitId), "commit_root");
    assert.strictEqual(result.operation.attemptCount, 1);
    }));

  it.effect("requires an update decision for graph enrichment", () =>
    Effect.gen(function* () {
    const result = yield* apply(basePatch, { operation: operationFor(basePatch, { operationType: "graph_enrichment" }) });
    assert.strictEqual(result.status, "invalid_patch");
    assert.strictEqual(O.getOrNull(result.reason), "graph enrichment requires an update decision");
    }));

  it.effect("refuses evidence that is not active", () =>
    Effect.gen(function* () {
    const result = yield* apply({
      ...basePatch,
      evidence: [{ evidenceId: "ev-1", sourceType: "conversation", artifactPreservation: "preserved", sourceState: "missing" }],
    });
    assert.strictEqual(result.status, "source_not_active");
    }));

  it.effect("requires an existing item and a matching target for updates", () =>
    Effect.gen(function* () {
    const update = { ...basePatch, decision: "update", targetMemoryId: "mem-1" };
    assert.strictEqual(O.getOrNull((yield* apply(update)).reason), "update patch requires authoritative existing_item");
    assert.strictEqual(
      O.getOrNull((yield* apply({ ...update, existingItem: { ...itemJson, memoryId: "mem-2" } })).reason),
      "update patch target_memory_id mismatch",
    );
    assert.strictEqual(
      O.getOrNull((yield* apply({ ...update, existingItem: itemJson, expectedItemRevision: 5 })).reason),
      "update patch expected_item_revision mismatch",
    );
    assert.strictEqual(
      O.getOrNull((yield* apply({ ...update, existingItem: itemJson, expectedContentHash: "other" })).reason),
      "update patch expected_content_hash mismatch",
    );
    }));

  it.effect("keeps active long-term semantics immutable unless allowed", () =>
    Effect.gen(function* () {
    const longTerm = { ...itemJson, tier: "long_term", ledgerCommitId: "commit_0", ledgerSequence: 0, expiresAt: null };
    const update = { ...basePatch, decision: "update", targetMemoryId: "mem-1", memoryText: "Ada moved to Portland", existingItem: longTerm, existingEvidenceIds: ["ev-1"] };
    const result = yield* apply(update);
    assert.strictEqual(result.status, "invalid_patch");
    assert.strictEqual(
      O.getOrNull(result.reason),
      "Long-term semantics are immutable; promote a new Short-term item and supersede this one",
    );
    const allowed = yield* apply(update, { allowTriggerFeedbackArguments: true });
    assert.strictEqual(allowed.status, "committed");
    assert.strictEqual(O.getOrNull(at(allowed.memoryItems, 0).content), "Ada moved to Portland");
    }));

  it.effect("requires a promotion admission for a short-term to long-term transition", () =>
    Effect.gen(function* () {
    const result = yield* apply({ ...basePatch, decision: "update", targetMemoryId: "mem-1", targetTier: "long_term", existingItem: itemJson, existingEvidenceIds: ["ev-1"] });
    assert.strictEqual(result.status, "invalid_patch");
    assert.strictEqual(
      O.getOrNull(result.reason),
      "Short-term to Long-term transition requires a current promotion admission and graph plan",
    );
    }));

  it.effect("validates superseded items", () =>
    Effect.gen(function* () {
    const superseding = { ...basePatch, supersedes: ["mem-9"] };
    assert.strictEqual(O.getOrNull((yield* apply(superseding)).reason), "superseding promotion requires authoritative superseded_items");
    assert.strictEqual(
      O.getOrNull((yield* apply({ ...superseding, supersededItems: [{ ...itemJson, memoryId: "mem-8" }] })).reason),
      "superseded_items do not match patch supersedes",
    );
    const inactive = yield* apply({ ...superseding, supersededItems: [{ ...itemJson, memoryId: "mem-9", status: "superseded" }] });
    assert.strictEqual(inactive.status, "target_not_active");
    assert.strictEqual(O.getOrNull(inactive.reason), "superseded target is not active: mem-9");
    }));
});

describe("applyLongTermPatchTransaction commits", () => {
  it.effect("materializes a short-term item with two upsert outbox events", () =>
    Effect.gen(function* () {
    const result = yield* apply(basePatch);
    assert.strictEqual(result.status, "committed");
    assert.strictEqual(result.controlState.commitSequence, 1);
    assert.strictEqual(result.controlState.headCommitId.startsWith("commit_"), true);
    assert.strictEqual(result.operation.status, "committed");
    assert.strictEqual(result.memoryItems.length, 1);
    const item = at(result.memoryItems, 0);
    assert.strictEqual(item.tier, "short_term");
    assert.strictEqual(item.status, "active");
    assert.strictEqual(item.processingState, "processed");
    assert.strictEqual(O.isSome(item.expiresAt), true);
    assert.strictEqual(O.getOrNull(item.ledgerCommitId), result.controlState.headCommitId);
    assert.strictEqual(O.getOrNull(item.contentHash), memoryContentHash(O.some("Ada lives in Seattle"), ["ev-1"]));
    assert.strictEqual(item.evidence.length, 1);
    assert.strictEqual(O.getOrNull(at(item.evidence, 0).sourceId), "source_for_ev-1");
    assert.deepStrictEqual(A.map(result.outboxEvents, (event) => event.payload.action), ["upsert", "upsert"]);
    assert.strictEqual(O.getOrNull(at(result.outboxEvents, 0).memoryId), item.memoryId);
    assert.deepStrictEqual(result.operation.committedMemoryItemIds, [item.memoryId]);
    assert.strictEqual(result.operation.committedOutboxEventIds.length, 2);
    assert.strictEqual(result.graphAssertions.length, 0);
    }));

  it.effect("commits a skip_duplicate as barrier events only", () =>
    Effect.gen(function* () {
    const skip = { ...basePatch, decision: "skip_duplicate", targetMemoryId: "mem-1", memoryText: null };
    const result = yield* apply(skip);
    assert.strictEqual(result.status, "committed");
    assert.strictEqual(result.memoryItems.length, 0);
    assert.deepStrictEqual(A.map(result.outboxEvents, (event) => event.payload), [{ action: "barrier" }, { action: "barrier" }]);
    assert.deepStrictEqual(result.operation.committedMemoryItemIds, []);
    }));

  it.effect("overlays extra item updates and drops malformed ones", () =>
    Effect.gen(function* () {
    const result = yield* apply({ ...basePatch, halfLifeDays: 30, capturedAt: "yesterday", confidence: "high", corroborationCount: 2 });
    assert.strictEqual(result.status, "committed");
    const item = at(result.memoryItems, 0);
    assert.strictEqual(O.getOrNull(item.halfLifeDays), 30);
    assert.strictEqual(item.corroborationCount, 2);
    assert.strictEqual(O.isNone(item.confidence), true);
    }));

  it.effect("applies an update, bumps revision, and preserves blank text", () =>
    Effect.gen(function* () {
    const update = { ...basePatch, decision: "update", targetMemoryId: "mem-1", memoryText: "  ", existingItem: itemJson, existingEvidenceIds: ["ev-1"] };
    const result = yield* apply(update);
    assert.strictEqual(result.status, "committed");
    const item = at(result.memoryItems, 0);
    assert.strictEqual(item.version, 2);
    assert.strictEqual(item.itemRevision, 2);
    assert.strictEqual(O.getOrNull(item.content), "Ada lives in Seattle");
    assert.strictEqual(O.getOrNull(item.contentHash), "hash-1");
    assert.strictEqual(O.map(item.expiresAt, DateTime.formatIso).pipe(O.getOrNull), "2020-01-04T03:04:05.000Z");
    }));

  it.effect("hides on a rejected result status and emits delete events", () =>
    Effect.gen(function* () {
    const update = { ...basePatch, decision: "update", targetMemoryId: "mem-1", resultStatus: "rejected", existingItem: itemJson, existingEvidenceIds: ["ev-1"] };
    const result = yield* apply(update);
    assert.strictEqual(result.status, "committed");
    assert.strictEqual(at(result.memoryItems, 0).status, "hidden");
    assert.deepStrictEqual(A.map(result.outboxEvents, (event) => event.payload.action), ["delete", "delete"]);
    }));

  it.effect("clears graph fields on an explicit short-term demotion", () =>
    Effect.gen(function* () {
    const longTerm = { ...itemJson, tier: "long_term", ledgerCommitId: "commit_0", ledgerSequence: 0, expiresAt: null, graphReady: true, graphAssertionId: "mga_1", graphPlanHash: "plan", kgExtracted: true, predicate: "lives_in" };
    const update = { ...basePatch, decision: "update", targetMemoryId: "mem-1", targetTier: "short_term", clearGraphAssertion: true, memoryText: null, existingItem: longTerm, existingEvidenceIds: ["ev-1"] };
    const result = yield* apply(update);
    assert.strictEqual(result.status, "committed");
    const item = at(result.memoryItems, 0);
    assert.strictEqual(item.tier, "short_term");
    assert.strictEqual(item.graphReady, false);
    assert.strictEqual(O.isNone(item.graphAssertionId), true);
    assert.strictEqual(O.isNone(item.predicate), true);
    assert.strictEqual(O.isSome(item.expiresAt), true);
    }));

  it.effect("supersedes authoritative targets", () =>
    Effect.gen(function* () {
    const result = yield* apply({ ...basePatch, supersedes: ["mem-9"], supersededItems: [{ ...itemJson, memoryId: "mem-9" }] });
    assert.strictEqual(result.status, "committed");
    assert.strictEqual(result.memoryItems.length, 2);
    const superseded = at(result.memoryItems, 1);
    assert.strictEqual(superseded.status, "superseded");
    assert.strictEqual(O.getOrNull(superseded.supersededBy), at(result.memoryItems, 0).memoryId);
    assert.strictEqual(O.getOrNull(superseded.canonicalMemoryId), at(result.memoryItems, 0).memoryId);
    assert.strictEqual(superseded.version, 2);
    assert.strictEqual(superseded.graphReady, false);
    assert.strictEqual(O.isNone(superseded.validTo), true);
    assert.deepStrictEqual(A.map(result.outboxEvents, (event) => event.payload.action), ["upsert", "upsert", "delete", "delete"]);
    assert.strictEqual(result.operation.committedMemoryItemIds.length, 2);
    }));
});

describe("Arbitrary", () => {
  it("derives generators for every exported schema", () => {
    for (const schema of [
      ApplyStatus,
      WriterMode,
      MemoryWriterClass,
      MemoryOutboxEventType,
      MemoryOutboxStatus,
      CoercedUtcTimestamp,
      MemoryControlState,
      CheckedMemoryControlState,
      MemoryOutboxEvent,
      ApplyResult,
      WriterAdmissionError,
      MemoryApplyError,
    ]) {
      assert.strictEqual(typeof Arbitrary.schema(schema), "object");
    }
  });
});
