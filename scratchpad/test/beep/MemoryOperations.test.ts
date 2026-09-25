import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CheckedMemoryOperation,
  MemoryLedgerReopenReceipt,
  MemoryOperation,
  MemoryOperationError,
  MemoryOperationStatus,
  MemoryOperationType,
  OperationLogicalPayload,
  assertOperationIdentity,
  buildOperationId,
  canonicalLogicalPayload,
  coerceLogicalPayload,
  isTerminalOperationStatus,
  logicalPayloadDigest,
  markOperationCommitted,
  markOperationRetryable,
  memoryOperationNew,
  operationIntegrityIssue,
  operationIsStale,
  transitionOperation,
} from "../../beep/MemoryOperations.ts";

const encodeOperationLogicalPayload = S.encodeEffect(OperationLogicalPayload);
const encodeMemoryOperation = S.encodeEffect(MemoryOperation);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failsWith = <A, E extends { readonly message: string }>(effect: Effect.Effect<A, E>): string => {
  const exit = effect.pipe(Effect.flip, Effect.runSyncExit);
  return exit._tag === "Success" ? exit.value.message : "did not fail";
};

const iso = "2026-01-02T03:04:05.000Z";
const later = "2026-01-02T04:00:00.000Z";
const now = decode(S.DateTimeUtcFromString, iso);
const nowLater = decode(S.DateTimeUtcFromString, later);

const operationTypes: ReadonlyArray<string> = [
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
];
const statuses: ReadonlyArray<MemoryOperationStatus> = [
  "pending",
  "committed",
  "skipped_idempotent",
  "retryable_failure",
  "permanent_failure",
  "stale_generation",
];

const payloadWire = {
  decision: "add",
  memoryText: "Ada lives in Seattle",
  targetMemoryId: "mem-1",
  resultStatus: "active",
  supersedes: ["mem-0"],
  subjectEntityId: "ent-1",
  predicate: "lives_in",
  arguments: { city: "Seattle" },
  targetTier: "long_term",
  targetVisibility: "private",
  targetUserAsserted: true,
  clearGraphAssertion: false,
  mutationMetadata: { reason: "test" },
  metadata: { extra: 1 },
};

const newInput = {
  uid: "user-1",
  operationType: "synthesis",
  sourcePacketId: "packet-1",
  targetMemoryId: "mem-1",
  evidenceIds: ["ev-2", "ev-1"],
  logicalPayload: { decision: "add", memory_text: "text", unknown_key: "kept" },
  accountGeneration: 3,
  sourceGeneration: 2,
  observedHeadCommitId: "head-1",
  proposedOperationId: "  op_client  ",
  now,
} as const;

const freshOperation = () => Effect.runSync(memoryOperationNew(newInput));

describe("MemoryOperations literals", () => {
  it("accept every member and reject strangers", () => {
    for (const value of operationTypes) assert.strictEqual(decode(MemoryOperationType, value), value);
    for (const value of statuses) assert.strictEqual(decode(MemoryOperationStatus, value), value);
    assert.strictEqual(decodeFails(MemoryOperationType, "apply"), true);
    assert.strictEqual(decodeFails(MemoryOperationStatus, "failed"), true);
  });

  it("isTerminalOperationStatus marks four of six statuses terminal", () => {
    assert.strictEqual(isTerminalOperationStatus("pending"), false);
    assert.strictEqual(isTerminalOperationStatus("retryable_failure"), false);
    assert.strictEqual(isTerminalOperationStatus("committed"), true);
    assert.strictEqual(isTerminalOperationStatus("skipped_idempotent"), true);
    assert.strictEqual(isTerminalOperationStatus("permanent_failure"), true);
    assert.strictEqual(isTerminalOperationStatus("stale_generation"), true);
  });
});

describe("MemoryLedgerReopenReceipt", () => {
  const receipt = {
    schemaVersion: "memory_ledger_reopen_receipt.v1",
    uid: "user-1",
    sourceMemoryId: "mem-1",
    replacementMemoryId: "mem-2",
    operationId: "op_1",
    accountGeneration: 1,
    sourceGeneration: 2,
    sourceItemRevision: 3,
    sourceContentHash: "hash",
    committedAt: iso,
  };

  it("decodes present values and defaults the version and committedAt", () => {
    const decoded = decode(MemoryLedgerReopenReceipt, receipt);
    assert.strictEqual(decoded.replacementMemoryId, "mem-2");
    assert.strictEqual(decoded.sourceItemRevision, 3);
    assert.strictEqual(DateTime.formatIso(decoded.committedAt), iso);
    const made = MemoryLedgerReopenReceipt.make({
      uid: "user-1",
      sourceMemoryId: "mem-1",
      replacementMemoryId: "mem-2",
      operationId: "op_1",
      accountGeneration: 0,
      sourceGeneration: 0,
      sourceItemRevision: 0,
      sourceContentHash: "hash",
    });
    assert.strictEqual(made.schemaVersion, "memory_ledger_reopen_receipt.v1");
    assert.strictEqual(DateTime.isDateTime(made.committedAt), true);
  });

  it("rejects blank text and negative generations", () => {
    assert.strictEqual(decodeFails(MemoryLedgerReopenReceipt, { ...receipt, uid: " " }), true);
    assert.strictEqual(decodeFails(MemoryLedgerReopenReceipt, { ...receipt, accountGeneration: -1 }), true);
    assert.strictEqual(decodeFails(MemoryLedgerReopenReceipt, { ...receipt, sourceItemRevision: 1.5 }), true);
  });
});

describe("OperationLogicalPayload", () => {
  it("decodes present values", () => {
    const payload = decode(OperationLogicalPayload, payloadWire);
    assert.strictEqual(payload.decision, "add");
    assert.strictEqual(O.getOrNull(payload.memoryText), "Ada lives in Seattle");
    assert.strictEqual(O.getOrNull(payload.targetUserAsserted), true);
    assert.strictEqual(O.getOrNull(payload.clearGraphAssertion), false);
    assert.deepStrictEqual(O.getOrNull(payload.mutationMetadata), { reason: "test" });
    assert.deepStrictEqual(payload.supersedes, ["mem-0"]);
  });

  it("decodes null and missing Option fields to None and encodes None as null", () => {
    const nulled = decode(OperationLogicalPayload, {
      decision: "skip",
      memoryText: null,
      targetMemoryId: null,
      resultStatus: null,
      supersedes: [],
      subjectEntityId: null,
      predicate: null,
      arguments: {},
      targetTier: null,
      targetVisibility: null,
      targetUserAsserted: null,
      clearGraphAssertion: null,
      mutationMetadata: null,
      metadata: {},
    });
    assert.strictEqual(O.isNone(nulled.memoryText), true);
    assert.strictEqual(O.isNone(nulled.targetUserAsserted), true);
    assert.strictEqual(O.isNone(nulled.mutationMetadata), true);
    const missing = decode(OperationLogicalPayload, { decision: "skip", supersedes: [], arguments: {}, metadata: {} });
    assert.strictEqual(O.isNone(missing.targetMemoryId), true);
    assert.strictEqual(O.isNone(missing.predicate), true);
    assert.strictEqual(O.isNone(missing.clearGraphAssertion), true);
    const encoded = Effect.runSync(encodeOperationLogicalPayload(missing));
    assert.strictEqual(encoded.memoryText, null);
    assert.strictEqual(encoded.targetTier, null);
    assert.strictEqual(encoded.mutationMetadata, null);
    const made = OperationLogicalPayload.make({ decision: "skip" });
    assert.deepStrictEqual(made.supersedes, []);
    assert.deepStrictEqual(made.arguments, {});
    assert.deepStrictEqual(made.metadata, {});
  });

  it("canonicalLogicalPayload writes snake_case keys and omits None", () => {
    const full = canonicalLogicalPayload(decode(OperationLogicalPayload, payloadWire));
    assert.deepStrictEqual(full, {
      decision: "add",
      supersedes: ["mem-0"],
      arguments: { city: "Seattle" },
      metadata: { extra: 1 },
      memory_text: "Ada lives in Seattle",
      target_memory_id: "mem-1",
      result_status: "active",
      subject_entity_id: "ent-1",
      predicate: "lives_in",
      target_tier: "long_term",
      target_visibility: "private",
      target_user_asserted: true,
      clear_graph_assertion: false,
      mutation_metadata: { reason: "test" },
    });
    const sparse = canonicalLogicalPayload(OperationLogicalPayload.make({ decision: "skip" }));
    assert.deepStrictEqual(sparse, { decision: "skip", supersedes: [], arguments: {}, metadata: {} });
  });

  it("coerceLogicalPayload passes a payload through and folds unknown wire keys into metadata", () => {
    const payload = OperationLogicalPayload.make({ decision: "skip" });
    assert.strictEqual(Effect.runSync(coerceLogicalPayload(payload)), payload);
    const coerced = Effect.runSync(
      coerceLogicalPayload({ decision: "add", memory_text: "text", targetTier: "archive", unknown_key: "kept" }),
    );
    assert.strictEqual(coerced.decision, "add");
    assert.strictEqual(O.getOrNull(coerced.memoryText), "text");
    assert.strictEqual(O.getOrNull(coerced.targetTier), "archive");
    assert.deepStrictEqual(coerced.metadata, { unknown_key: "kept" });
    assert.strictEqual(Effect.runSyncExit(coerceLogicalPayload({ memory_text: "no decision" }))._tag, "Failure");
  });
});

describe("buildOperationId and logicalPayloadDigest", () => {
  it("are deterministic, prefixed, and insensitive to evidence order and payload key spelling", () => {
    const base = {
      uid: "user-1",
      operationType: "synthesis",
      evidenceIds: ["ev-2", "ev-1"],
      logicalPayload: { decision: "add", memory_text: "text" },
      accountGeneration: 1,
      sourceGeneration: 1,
    };
    const first = Effect.runSync(buildOperationId(base));
    assert.strictEqual(Str.startsWith("op_")(first), true);
    assert.strictEqual(first.length, 35);
    assert.strictEqual(Effect.runSync(buildOperationId({ ...base, evidenceIds: ["ev-1", "ev-2"] })), first);
    assert.strictEqual(
      Effect.runSync(buildOperationId({ ...base, logicalPayload: { decision: "add", memoryText: "text" } })),
      first,
    );
    assert.notStrictEqual(Effect.runSync(buildOperationId({ ...base, accountGeneration: 2 })), first);
    assert.notStrictEqual(Effect.runSync(buildOperationId({ ...base, targetMemoryId: "mem-1" })), first);
    assert.notStrictEqual(Effect.runSync(buildOperationId({ ...base, sourcePacketId: "p" })), first);
    assert.strictEqual(Effect.runSync(buildOperationId({ ...base, observedHeadCommitId: "head" })), first);
    const digest = Effect.runSync(logicalPayloadDigest({ decision: "add", memory_text: "text" }));
    assert.strictEqual(digest.length, 64);
    assert.strictEqual(Effect.runSync(logicalPayloadDigest({ memoryText: "text", decision: "add" })), digest);
    assert.notStrictEqual(Effect.runSync(logicalPayloadDigest({ decision: "update" })), digest);
  });
});

describe("memoryOperationNew", () => {
  it("builds a pending operation with server-owned id and digest", () => {
    const operation = freshOperation();
    assert.strictEqual(operation.status, "pending");
    assert.strictEqual(operation.uid, "user-1");
    assert.strictEqual(Str.startsWith("op_")(operation.operationId), true);
    assert.strictEqual(O.getOrNull(operation.sourcePacketId), "packet-1");
    assert.strictEqual(O.getOrNull(operation.targetMemoryId), "mem-1");
    assert.strictEqual(O.getOrNull(operation.observedHeadCommitId), "head-1");
    assert.strictEqual(O.getOrNull(operation.untrustedProposedOperationId), "  op_client  ");
    assert.deepStrictEqual(operation.logicalPayload.metadata, { unknown_key: "kept" });
    assert.strictEqual(operation.attemptCount, 0);
    assert.strictEqual(O.isNone(operation.committedSequence), true);
    assert.strictEqual(O.isNone(operation.errorCode), true);
    assert.strictEqual(
      operation.logicalPayloadDigest,
      Effect.runSync(logicalPayloadDigest(operation.logicalPayload)),
    );
    assert.strictEqual(DateTime.formatIso(operation.createdAt), iso);
  });

  it("drops a blank proposed id and absent optionals", () => {
    const operation = Effect.runSync(
      memoryOperationNew({
        uid: "user-1",
        operationType: "deletion",
        evidenceIds: [],
        logicalPayload: { decision: "delete" },
        accountGeneration: 0,
        sourceGeneration: 0,
        proposedOperationId: "   ",
        now,
      }),
    );
    assert.strictEqual(O.isNone(operation.untrustedProposedOperationId), true);
    assert.strictEqual(O.isNone(operation.sourcePacketId), true);
    assert.strictEqual(O.isNone(operation.targetMemoryId), true);
    assert.strictEqual(O.isNone(operation.observedHeadCommitId), true);
  });
});

describe("MemoryOperation decode", () => {
  const wire = () => Effect.runSync(encodeMemoryOperation(freshOperation()));

  it("round-trips through the encoded form with None as null", () => {
    const encoded = wire();
    assert.strictEqual(encoded.status, "pending");
    assert.strictEqual(encoded.committedHeadCommitId, null);
    assert.strictEqual(encoded.committedSequence, null);
    assert.strictEqual(encoded.errorCode, null);
    assert.strictEqual(encoded.createdAt, iso);
    const decoded = decode(MemoryOperation, encoded);
    assert.strictEqual(decoded.operationId, freshOperation().operationId);
    assert.strictEqual(O.isNone(decoded.committedSequence), true);
    const {
      sourcePacketId: _sourcePacketId,
      targetMemoryId: _targetMemoryId,
      observedHeadCommitId: _observedHeadCommitId,
      committedHeadCommitId: _committedHeadCommitId,
      committedSequence: _committedSequence,
      errorCode: _errorCode,
      untrustedProposedOperationId: _untrustedProposedOperationId,
      ...required
    } = encoded;
    const withoutOptionals = decode(MemoryOperation, required);
    assert.strictEqual(O.isNone(withoutOptionals.sourcePacketId), true);
    assert.strictEqual(O.isNone(withoutOptionals.errorCode), true);
  });

  it("rejects blank ids, a stranger type, and negative counters", () => {
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), operationId: " " }), true);
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), operationType: "apply" }), true);
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), attemptCount: -1 }), true);
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), committedSequence: -1 }), true);
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), errorCode: " " }), true);
  });

  it("CheckedMemoryOperation enforces the integrity rules", () => {
    assert.strictEqual(decodeFails(CheckedMemoryOperation, wire()), false);
    assert.strictEqual(decodeFails(CheckedMemoryOperation, { ...wire(), status: "committed" }), true);
    assert.strictEqual(decodeFails(MemoryOperation, { ...wire(), status: "committed" }), false);
    assert.strictEqual(decodeFails(CheckedMemoryOperation, { ...wire(), status: "permanent_failure" }), true);
    assert.strictEqual(
      decodeFails(CheckedMemoryOperation, { ...wire(), status: "permanent_failure", errorCode: "boom" }),
      false,
    );
    assert.strictEqual(decodeFails(CheckedMemoryOperation, { ...wire(), createdAt: later }), true);
  });
});

describe("operationIntegrityIssue", () => {
  it("names each broken clause", () => {
    const operation = freshOperation();
    assert.strictEqual(operationIntegrityIssue(operation), undefined);
    assert.strictEqual(
      operationIntegrityIssue(MemoryOperation.make({ ...operation, createdAt: nowLater })),
      "updated_at must be >= created_at",
    );
    assert.strictEqual(
      operationIntegrityIssue(MemoryOperation.make({ ...operation, status: "committed" })),
      "committed operations require committed_head_commit_id",
    );
    assert.strictEqual(
      operationIntegrityIssue(
        MemoryOperation.make({ ...operation, status: "committed", committedHeadCommitId: O.some("head") }),
      ),
      "committed operations require committed_sequence",
    );
    assert.strictEqual(
      operationIntegrityIssue(
        MemoryOperation.make({
          ...operation,
          status: "committed",
          committedHeadCommitId: O.some("head"),
          committedSequence: O.some(1),
        }),
      ),
      undefined,
    );
    assert.strictEqual(
      operationIntegrityIssue(MemoryOperation.make({ ...operation, status: "retryable_failure" })),
      "failure operations require error_code",
    );
    assert.strictEqual(
      operationIntegrityIssue(MemoryOperation.make({ ...operation, status: "permanent_failure", errorCode: O.none() })),
      "failure operations require error_code",
    );
    assert.strictEqual(
      operationIntegrityIssue(MemoryOperation.make({ ...operation, status: "permanent_failure", errorCode: O.some("boom") })),
      undefined,
    );
  });
});

describe("assertOperationIdentity", () => {
  it("accepts a server-built operation and rejects a tampered id, digest, or structure", () => {
    const operation = freshOperation();
    assert.strictEqual(Effect.runSyncExit(assertOperationIdentity(operation))._tag, "Success");
    assert.strictEqual(
      failsWith(assertOperationIdentity(MemoryOperation.make({ ...operation, operationId: "op_forged" }))),
      "operation_id does not match server-computed logical identity",
    );
    assert.strictEqual(
      failsWith(assertOperationIdentity(MemoryOperation.make({ ...operation, logicalPayloadDigest: "forged" }))),
      "logical_payload_digest does not match canonical logical payload",
    );
    assert.strictEqual(
      failsWith(assertOperationIdentity(MemoryOperation.make({ ...operation, status: "committed" }))),
      "committed operations require committed_head_commit_id",
    );
    assert.strictEqual(
      failsWith(assertOperationIdentity(MemoryOperation.make({ ...operation, accountGeneration: 9 }))),
      "operation_id does not match server-computed logical identity",
    );
  });
});

describe("transitions", () => {
  it("transitionOperation applies updates and refuses terminal sources", () => {
    const operation = freshOperation();
    const moved = Effect.runSync(
      transitionOperation(operation, "stale_generation", { observedHeadCommitId: O.some("head-2") }, nowLater),
    );
    assert.strictEqual(moved.status, "stale_generation");
    assert.strictEqual(O.getOrNull(moved.observedHeadCommitId), "head-2");
    assert.strictEqual(DateTime.formatIso(moved.updatedAt), later);
    assert.strictEqual(DateTime.formatIso(moved.createdAt), iso);
    assert.strictEqual(
      failsWith(transitionOperation(moved, "pending", {}, nowLater)),
      "cannot transition terminal operation from stale_generation",
    );
  });

  it("markOperationRetryable bumps the attempt and records the error, and can repeat", () => {
    const first = Effect.runSync(markOperationRetryable(freshOperation(), "timeout", nowLater));
    assert.strictEqual(first.status, "retryable_failure");
    assert.strictEqual(first.attemptCount, 1);
    assert.strictEqual(O.getOrNull(first.errorCode), "timeout");
    const second = Effect.runSync(markOperationRetryable(first, "again", nowLater));
    assert.strictEqual(second.attemptCount, 2);
    assert.strictEqual(O.getOrNull(second.errorCode), "again");
  });

  it("markOperationCommitted binds the head, sequence, and ids, clears the error, and refuses to repeat", () => {
    const retried = Effect.runSync(markOperationRetryable(freshOperation(), "timeout", nowLater));
    const committed = Effect.runSync(markOperationCommitted(retried, "head-9", 42, nowLater, ["item-1"], ["out-1"]));
    assert.strictEqual(committed.status, "committed");
    assert.strictEqual(O.getOrNull(committed.committedHeadCommitId), "head-9");
    assert.strictEqual(O.getOrNull(committed.committedSequence), 42);
    assert.deepStrictEqual(committed.committedMemoryItemIds, ["item-1"]);
    assert.deepStrictEqual(committed.committedOutboxEventIds, ["out-1"]);
    assert.strictEqual(O.isNone(committed.errorCode), true);
    assert.strictEqual(committed.attemptCount, 1);
    assert.strictEqual(operationIntegrityIssue(committed), undefined);
    const bare = Effect.runSync(markOperationCommitted(freshOperation(), "head-9", 1, nowLater));
    assert.deepStrictEqual(bare.committedMemoryItemIds, []);
    assert.deepStrictEqual(bare.committedOutboxEventIds, []);
    assert.strictEqual(
      failsWith(markOperationCommitted(committed, "head-10", 43, nowLater)),
      "cannot transition terminal operation from committed",
    );
  });

  it("operationIsStale compares both generations", () => {
    const operation = freshOperation();
    assert.strictEqual(operationIsStale(operation, 3, 2), false);
    assert.strictEqual(operationIsStale(operation, 4, 2), true);
    assert.strictEqual(operationIsStale(operation, 3, 1), true);
    assert.strictEqual(operationIsStale(3, 2)(operation), false);
    assert.strictEqual(operationIsStale(4, 2)(operation), true);
    assert.strictEqual(operationIsStale(3, 1)(operation), true);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      MemoryOperationType,
      MemoryOperationStatus,
      MemoryOperationError,
      MemoryLedgerReopenReceipt,
      OperationLogicalPayload,
      MemoryOperation,
      CheckedMemoryOperation,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
