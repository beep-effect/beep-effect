import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  LegalMemoryDomainRecord,
  MemoryDomainError,
  MemoryDomainRecord,
  MemoryLayer,
  MemoryProcessingState,
  MemoryRecordStatus,
  PhysicalMemoryStatus,
  ProductMemoryTier,
  assertLegalState,
  canonicalRecordStatus,
  isLegalStateCombination,
  layerToTier,
  physicalStatusToRecordStatus,
  tierToLayer,
} from "../../beep/MemoryDomain.ts";

const isMemoryDomainError = S.is(MemoryDomainError);
const encodeMemoryDomainRecord = S.encodeEffect(MemoryDomainRecord);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const fails = <A, E>(effect: Effect.Effect<A, E>): boolean => Effect.runSyncExit(effect)._tag === "Failure";

const layers: ReadonlyArray<MemoryLayer> = ["short_term", "long_term", "archive"];
const statuses: ReadonlyArray<MemoryRecordStatus> = ["active", "superseded", "tombstoned"];
const states: ReadonlyArray<MemoryProcessingState> = ["pending", "processed", "blocked"];

const baseRecord = {
  id: "mem-1",
  content: "Ada lives in Seattle",
  layer: "short_term",
  status: "active",
  processingState: "pending",
  category: "core",
  evidence: [{ source_id: "conv-1", conversation_id: "conv-1" }],
  sourceIds: ["conv-1"],
  canonicalMemoryId: "mem-0",
  promotion: { receipt_version: "v1" },
  ledgerCommitId: "commit-1",
  ledgerSequence: 7,
  graphReady: true,
  graphAssertionId: "assert-1",
  graphPlanHash: "hash-1",
  expiresAt: "2026-01-02T03:04:05.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MemoryDomain literals", () => {
  it("accept the frozen wire values and reject strangers", () => {
    for (const layer of layers) assert.strictEqual(decode(MemoryLayer, layer), layer);
    for (const layer of layers) assert.strictEqual(decode(ProductMemoryTier, layer), layer);
    for (const status of statuses) assert.strictEqual(decode(MemoryRecordStatus, status), status);
    for (const state of states) assert.strictEqual(decode(MemoryProcessingState, state), state);
    assert.strictEqual(decode(PhysicalMemoryStatus, "hidden"), "hidden");
    assert.strictEqual(decodeFails(MemoryRecordStatus, "hidden"), true);
    assert.strictEqual(decodeFails(MemoryLayer, "context_only"), true);
    assert.strictEqual(decodeFails(MemoryLayer, "working"), true);
    assert.strictEqual(decodeFails(MemoryProcessingState, "done"), true);
  });
});

describe("physical status mapping", () => {
  it("keeps active and superseded and folds hidden into tombstoned", () => {
    assert.strictEqual(canonicalRecordStatus("active"), "active");
    assert.strictEqual(canonicalRecordStatus("superseded"), "superseded");
    assert.strictEqual(canonicalRecordStatus("tombstoned"), "tombstoned");
    assert.strictEqual(canonicalRecordStatus("hidden"), "tombstoned");
  });

  it("maps a physical string and fails on an unknown one", () => {
    assert.strictEqual(Effect.runSync(physicalStatusToRecordStatus("hidden")), "tombstoned");
    assert.strictEqual(Effect.runSync(physicalStatusToRecordStatus("active")), "active");
    const exit = Effect.runSyncExit(physicalStatusToRecordStatus("archived"));
    assert.strictEqual(exit._tag, "Failure");
    const error = physicalStatusToRecordStatus("archived").pipe(Effect.flip, Effect.runSync);
    assert.strictEqual(isMemoryDomainError(error), true);
    assert.strictEqual(error.message, "unknown physical memory status: 'archived'");
  });
});

describe("§1.3 legal state matrix", () => {
  it("short_term admits every status and processing state", () => {
    for (const status of statuses) {
      for (const state of states) {
        assert.strictEqual(isLegalStateCombination("short_term", status, state), true);
      }
    }
  });

  it("long_term requires processed and admits every status", () => {
    for (const status of statuses) {
      assert.strictEqual(isLegalStateCombination("long_term", status, "processed"), true);
      assert.strictEqual(isLegalStateCombination("long_term", status, "pending"), false);
      assert.strictEqual(isLegalStateCombination("long_term", status, "blocked"), false);
    }
  });

  it("archive requires processed and is never superseded", () => {
    assert.strictEqual(isLegalStateCombination("archive", "active", "processed"), true);
    assert.strictEqual(isLegalStateCombination("archive", "tombstoned", "processed"), true);
    assert.strictEqual(isLegalStateCombination("archive", "superseded", "processed"), false);
    assert.strictEqual(isLegalStateCombination("archive", "active", "pending"), false);
    assert.strictEqual(isLegalStateCombination("archive", "active", "blocked"), false);
  });

  it("assertLegalState succeeds on a legal triple and fails with the Python message", () => {
    assert.strictEqual(fails(assertLegalState("long_term", "active", "processed")), false);
    const error = assertLegalState("archive", "superseded", "processed").pipe(Effect.flip, Effect.runSync);
    assert.strictEqual(isMemoryDomainError(error), true);
    assert.strictEqual(
      error.message,
      "illegal memory state combination: layer=archive, status=superseded, processing_state=processed",
    );
  });
});

describe("tier and layer aliases", () => {
  it("round-trip every value", () => {
    for (const layer of layers) {
      assert.strictEqual(tierToLayer(layer), layer);
      assert.strictEqual(layerToTier(layer), layer);
      assert.strictEqual(layerToTier(tierToLayer(layer)), layer);
    }
  });
});

describe("MemoryDomainRecord", () => {
  it("decodes present values", () => {
    const record = decode(MemoryDomainRecord, baseRecord);
    assert.strictEqual(record.id, "mem-1");
    assert.strictEqual(record.layer, "short_term");
    assert.strictEqual(record.status, "active");
    assert.strictEqual(record.processingState, "pending");
    assert.strictEqual(O.getOrNull(record.category), "core");
    assert.deepStrictEqual(record.sourceIds, ["conv-1"]);
    assert.strictEqual(O.getOrNull(record.canonicalMemoryId), "mem-0");
    assert.deepStrictEqual(O.getOrNull(record.promotion), { receipt_version: "v1" });
    assert.strictEqual(O.getOrNull(record.ledgerCommitId), "commit-1");
    assert.strictEqual(O.getOrNull(record.ledgerSequence), 7);
    assert.strictEqual(record.graphReady, true);
    assert.strictEqual(O.getOrNull(record.graphAssertionId), "assert-1");
    assert.strictEqual(O.getOrNull(record.graphPlanHash), "hash-1");
    assert.strictEqual(O.isSome(record.expiresAt), true);
  });

  it("decodes null and missing Option fields to None and encodes None as null", () => {
    const nulled = decode(MemoryDomainRecord, {
      ...baseRecord,
      category: null,
      canonicalMemoryId: null,
      promotion: null,
      ledgerCommitId: null,
      ledgerSequence: null,
      graphAssertionId: null,
      graphPlanHash: null,
      expiresAt: null,
    });
    assert.strictEqual(O.isNone(nulled.category), true);
    assert.strictEqual(O.isNone(nulled.promotion), true);
    assert.strictEqual(O.isNone(nulled.ledgerSequence), true);
    assert.strictEqual(O.isNone(nulled.expiresAt), true);

    const missing = decode(MemoryDomainRecord, {
      id: "mem-2",
      content: "text",
      layer: "long_term",
      status: "hidden",
      processingState: "processed",
      sourceIds: [],
      evidence: [],
      graphReady: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.strictEqual(O.isNone(missing.category), true);
    assert.strictEqual(O.isNone(missing.canonicalMemoryId), true);
    assert.strictEqual(O.isNone(missing.promotion), true);
    assert.strictEqual(O.isNone(missing.ledgerCommitId), true);
    assert.strictEqual(O.isNone(missing.ledgerSequence), true);
    assert.strictEqual(O.isNone(missing.graphAssertionId), true);
    assert.strictEqual(O.isNone(missing.graphPlanHash), true);
    assert.strictEqual(O.isNone(missing.expiresAt), true);
    assert.strictEqual(missing.status, "hidden");

    const encoded = Effect.runSync(encodeMemoryDomainRecord(missing));
    assert.strictEqual(encoded.category, null);
    assert.strictEqual(encoded.canonicalMemoryId, null);
    assert.strictEqual(encoded.promotion, null);
    assert.strictEqual(encoded.ledgerCommitId, null);
    assert.strictEqual(encoded.ledgerSequence, null);
    assert.strictEqual(encoded.graphAssertionId, null);
    assert.strictEqual(encoded.graphPlanHash, null);
    assert.strictEqual(encoded.expiresAt, null);
    assert.strictEqual(encoded.status, "hidden");
  });

  it("applies constructor defaults for evidence, sourceIds, and graphReady", () => {
    const made = MemoryDomainRecord.make({
      id: "mem-3",
      content: "text",
      layer: "short_term",
      status: "active",
      processingState: "pending",
      createdAt: decode(MemoryDomainRecord, baseRecord).createdAt,
      updatedAt: decode(MemoryDomainRecord, baseRecord).updatedAt,
    });
    assert.deepStrictEqual(made.evidence, []);
    assert.deepStrictEqual(made.sourceIds, []);
    assert.strictEqual(made.graphReady, false);
    assert.strictEqual(O.isNone(made.category), true);
  });

  it("rejects an unknown layer, status, or processing state", () => {
    assert.strictEqual(decodeFails(MemoryDomainRecord, { ...baseRecord, layer: "context_only" }), true);
    assert.strictEqual(decodeFails(MemoryDomainRecord, { ...baseRecord, status: "archived" }), true);
    assert.strictEqual(decodeFails(MemoryDomainRecord, { ...baseRecord, processingState: "done" }), true);
    assert.strictEqual(decodeFails(MemoryDomainRecord, { ...baseRecord, ledgerSequence: 1.5 }), true);
  });
});

describe("LegalMemoryDomainRecord", () => {
  const legal = (layer: string, status: string, processingState: string) =>
    decodeFails(LegalMemoryDomainRecord, { ...baseRecord, layer, status, processingState }) === false;

  it("accepts every legal triple, treating physical hidden as tombstoned", () => {
    assert.strictEqual(legal("short_term", "superseded", "blocked"), true);
    assert.strictEqual(legal("long_term", "superseded", "processed"), true);
    assert.strictEqual(legal("archive", "tombstoned", "processed"), true);
    assert.strictEqual(legal("archive", "hidden", "processed"), true);
    assert.strictEqual(legal("long_term", "hidden", "processed"), true);
  });

  it("rejects each illegal triple", () => {
    assert.strictEqual(legal("long_term", "active", "pending"), false);
    assert.strictEqual(legal("archive", "active", "blocked"), false);
    assert.strictEqual(legal("archive", "superseded", "processed"), false);
    assert.strictEqual(legal("archive", "hidden", "pending"), false);
  });

  it("the unchecked record still decodes an illegal triple", () => {
    assert.strictEqual(decodeFails(MemoryDomainRecord, { ...baseRecord, layer: "archive", status: "superseded", processingState: "processed" }), false);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      MemoryLayer,
      ProductMemoryTier,
      MemoryRecordStatus,
      PhysicalMemoryStatus,
      MemoryProcessingState,
      MemoryDomainError,
      MemoryDomainRecord,
      LegalMemoryDomainRecord,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
