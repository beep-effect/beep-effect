import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ArchiveProductMemorySearchResponse,
  MemoryGlobalReadGateObservability,
  MemorySearchPolicyPayload,
  ProductMemorySearchItem,
  ProductMemorySearchResponse,
  ProductRolloutObservability,
  VectorMemorySearchResponse,
  absorbProductMemorySearchItemRest,
  decodeProductMemorySearchItem,
  flattenProductMemorySearchItemRest,
} from "../../beep/MemoryProduct.ts";

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const encode = <Sch extends S.Codec<unknown, unknown, never, never>>(schema: Sch, value: Sch["Type"]): Sch["Encoded"] =>
  Effect.runSync(S.encodeEffect(schema)(value));

const item = {
  memoryId: "mem-1",
  memoryLayer: "product_memory",
  tier: "long_term",
  content: "Ada lives in Seattle",
  lifecycleStatus: "active",
  processingState: "processed",
  visibilitySource: "policy",
  date: "2020-01-02T03:04:05Z",
  evidence: [{ conversationId: "conv-1" }],
  agentUse: "context",
  accessReason: "default_grant",
  rest: {},
};

const policy = {
  consumer: "omi_chat",
  appHasDefaultMemoryGrant: true,
  archiveCapability: false,
  rawProvenanceCapability: false,
};

const gate = {
  sourcePath: "memory_control/global",
  readDecision: "USE_MEMORY",
  reason: "enabled",
};

const rollout = {
  consumer: "omi_chat",
  enabled: true,
  reason: "enabled",
  readDecision: "USE_MEMORY",
  mode: "default_on",
  memoryReadsEnabled: true,
  legacyReadsAuthoritative: false,
  defaultMemoryGrant: true,
  archiveDefaultVisible: false,
  archiveCapability: false,
  capabilities: {
    legacyOnly: false,
    shadowArtifactsEnabled: false,
    memoryWritesEnabled: true,
    memoryReadsEnabled: true,
    legacyReadsAuthoritative: false,
  },
  surface: "product_default_search",
  archiveCapabilityRequired: false,
  archiveCapabilityGranted: false,
  explicitArchiveRequest: false,
  appContext: { appId: "app-1" },
};

const searchResponse = {
  uid: "user-1",
  query: "seattle",
  items: [item],
  totalCount: 1,
  returnedCount: 1,
  limit: 20,
  offset: 0,
  archiveDefaultVisible: false,
  policy,
  globalReadGate: gate,
  rollout,
};

const memoryItem = {
  memoryId: "mem-1",
  uid: "user-1",
  version: 1,
  tier: "long_term",
  status: "active",
  processingState: "processed",
  content: "Ada lives in Seattle",
  sourceState: "active",
  intentBacked: false,
  sensitivityLabels: [],
  visibility: "private",
  userAsserted: false,
  capturedAt: "2020-01-02T03:04:05+00:00",
  updatedAt: "2020-01-02T03:04:05+00:00",
  ledgerCommitId: "commit-1",
  ledgerSequence: 1,
  itemRevision: 1,
  accountGeneration: 0,
  captureDeviceIds: [],
  corroborationCount: 0,
  arguments: {},
  kgExtracted: false,
  graphReady: false,
  kind: "fact",
  subjectScope: "primary_user",
  curationWeight: 0,
  triggerCondition: {},
  evidence: [],
};

const vectorResponse = {
  uid: "user-1",
  query: "seattle",
  items: [],
  scoresByMemoryId: { "mem-1": 0.9 },
  projectionCommitIdsByMemoryId: { "mem-1": "commit-1" },
  decisions: { "mem-1": "admit" },
  totalCount: 1,
  returnedCount: 1,
  limit: 20,
  overfetchFactor: 3,
  candidateBudget: 60,
  maxVectorQueries: 2,
  maxCandidateHydrationReads: 60,
  candidateRequestLimit: 60,
  candidateBudgetExhausted: false,
  vectorQueryBudgetExhausted: false,
  hydrationReadBudgetExhausted: false,
  timeoutExhausted: false,
  searchStatus: "ok",
  legacyFallbackUsed: false,
  vectorQueryCount: 1,
  queriedCandidateCount: 1,
  hydratedCandidateCount: 1,
  candidateHydrationReadCount: 1,
  hydrationRejectedMissingCount: 0,
  hydrationRejectedStaleProjectionCount: 0,
  hydrationRejectedStaleVectorCount: 0,
  hydrationRejectedAccessDeniedCount: 0,
  vectorRejectedCount: 0,
  repairPurgeCandidateCount: 0,
  repairPurgeCandidates: [],
  repairPurgeOutboxRecordCount: 0,
  repairPurgeOutboxRecords: [],
  archiveDefaultVisible: false,
  telemetry: { emitted: true },
  policy,
  globalReadGate: gate,
  rollout,
};

describe("ProductMemorySearchItem", () => {
  it("decodes present values", () => {
    const decoded = decode(ProductMemorySearchItem, {
      ...item,
      confidence: 0.75,
      visibility: "private",
      source: "conv-1",
      supersededBy: "mem-2",
    });
    assert.strictEqual(decoded.tier, "long_term");
    assert.strictEqual(O.getOrNull(decoded.confidence), 0.75);
    assert.strictEqual(O.getOrNull(decoded.visibility), "private");
    assert.strictEqual(O.getOrNull(decoded.source), "conv-1");
    assert.strictEqual(O.getOrNull(decoded.supersededBy), "mem-2");
    assert.deepStrictEqual(decoded.evidence, [{ conversationId: "conv-1" }]);
  });

  it("decodes null and missing optional fields to None and encodes None as null", () => {
    const missing = decode(ProductMemorySearchItem, item);
    assert.strictEqual(O.isNone(missing.confidence), true);
    assert.strictEqual(O.isNone(missing.visibility), true);
    assert.strictEqual(O.isNone(missing.source), true);
    assert.strictEqual(O.isNone(missing.supersededBy), true);
    const nulls = decode(ProductMemorySearchItem, {
      ...item,
      confidence: null,
      visibility: null,
      source: null,
      supersededBy: null,
    });
    assert.strictEqual(O.isNone(nulls.confidence), true);
    assert.strictEqual(O.isNone(nulls.visibility), true);
    const encoded = encode(ProductMemorySearchItem, nulls);
    assert.strictEqual(encoded.confidence, null);
    assert.strictEqual(encoded.visibility, null);
    assert.strictEqual(encoded.source, null);
    assert.strictEqual(encoded.supersededBy, null);
  });

  it("constructs evidence and rest defaults and rejects a missing required field", () => {
    const { evidence: _evidence, rest: _rest, ...required } = item;
    const made = ProductMemorySearchItem.make(required);
    assert.deepStrictEqual(made.evidence, []);
    assert.deepStrictEqual(made.rest, {});
    assert.strictEqual(decodeFails(ProductMemorySearchItem, { ...item, memoryId: undefined }), true);
    assert.strictEqual(decodeFails(ProductMemorySearchItem, { ...item, confidence: "high" }), true);
  });

  it("absorbs unknown keys into rest and flattens them back", () => {
    const { rest: _rest, ...wire } = item;
    const absorbed = absorbProductMemorySearchItemRest({ ...wire, salience: 0.5, rest: { kept: true } });
    assert.deepStrictEqual(decode(S.Record(S.String, S.Unknown), absorbed).rest, { kept: true, salience: 0.5 });
    assert.strictEqual(absorbProductMemorySearchItemRest("nope"), "nope");
    assert.deepStrictEqual(absorbProductMemorySearchItemRest({ ...wire, rest: 1 }), { ...wire, rest: 1 });
    const decoded = Effect.runSync(decodeProductMemorySearchItem({ ...wire, salience: 0.5 }));
    assert.deepStrictEqual(decoded.rest, { salience: 0.5 });
    const plain = Effect.runSync(decodeProductMemorySearchItem(wire));
    assert.deepStrictEqual(plain.rest, {});
    assert.strictEqual(Effect.runSyncExit(decodeProductMemorySearchItem("nope"))._tag, "Failure");
    assert.deepStrictEqual(flattenProductMemorySearchItemRest({ memoryId: "mem-1", rest: { bonus: 1, memoryId: "x" } }), {
      bonus: 1,
      memoryId: "mem-1",
    });
    assert.deepStrictEqual(flattenProductMemorySearchItemRest({ memoryId: "mem-1" }), { memoryId: "mem-1" });
    assert.deepStrictEqual(flattenProductMemorySearchItemRest({ memoryId: "mem-1", rest: 3 }), { memoryId: "mem-1" });
  });
});

describe("MemorySearchPolicyPayload and MemoryGlobalReadGateObservability", () => {
  it("decode present values", () => {
    const decodedPolicy = decode(MemorySearchPolicyPayload, policy);
    assert.strictEqual(decodedPolicy.appHasDefaultMemoryGrant, true);
    const decodedGate = decode(MemoryGlobalReadGateObservability, { ...gate, fallbackReason: "kill_switch" });
    assert.strictEqual(O.getOrNull(decodedGate.fallbackReason), "kill_switch");
  });

  it("treat a missing or null fallback reason as None", () => {
    assert.strictEqual(O.isNone(decode(MemoryGlobalReadGateObservability, gate).fallbackReason), true);
    assert.strictEqual(
      O.isNone(decode(MemoryGlobalReadGateObservability, { ...gate, fallbackReason: null }).fallbackReason),
      true,
    );
    assert.strictEqual(decodeFails(MemorySearchPolicyPayload, { ...policy, archiveCapability: "no" }), true);
  });
});

describe("ProductRolloutObservability", () => {
  it("decodes the inherited consumer fields and the route fields", () => {
    const decoded = decode(ProductRolloutObservability, { ...rollout, vectorRepairOutboxEnabled: true });
    assert.strictEqual(decoded.consumer, "omi_chat");
    assert.strictEqual(decoded.capabilities.memoryReadsEnabled, true);
    assert.strictEqual(decoded.surface, "product_default_search");
    assert.deepStrictEqual(decoded.appContext, { appId: "app-1" });
    assert.strictEqual(O.getOrNull(decoded.vectorRepairOutboxEnabled), true);
  });

  it("treats a missing or null vector repair flag as None", () => {
    assert.strictEqual(O.isNone(decode(ProductRolloutObservability, rollout).vectorRepairOutboxEnabled), true);
    const nulled = decode(ProductRolloutObservability, { ...rollout, vectorRepairOutboxEnabled: null });
    assert.strictEqual(O.isNone(nulled.vectorRepairOutboxEnabled), true);
    assert.strictEqual(encode(ProductRolloutObservability, nulled).vectorRepairOutboxEnabled, null);
    assert.strictEqual(decodeFails(ProductRolloutObservability, { ...rollout, appContext: "ctx" }), true);
  });
});

describe("search responses", () => {
  it("decodes the default and archive search responses", () => {
    const decoded = decode(ProductMemorySearchResponse, searchResponse);
    assert.strictEqual(decoded.items.length, 1);
    assert.strictEqual(decoded.items[0]?.memoryId, "mem-1");
    assert.strictEqual(decoded.rollout.surface, "product_default_search");
    const archive = decode(ArchiveProductMemorySearchResponse, {
      ...searchResponse,
      archiveCapabilityRequired: true,
      archiveCapabilityGranted: true,
    });
    assert.strictEqual(archive.archiveCapabilityRequired, true);
    assert.strictEqual(decodeFails(ArchiveProductMemorySearchResponse, searchResponse), true);
    assert.strictEqual(decodeFails(ProductMemorySearchResponse, { ...searchResponse, totalCount: 1.5 }), true);
  });

  it("decodes the vector search response with authoritative items", () => {
    const decoded = decode(VectorMemorySearchResponse, { ...vectorResponse, items: [memoryItem], timeoutSeconds: 2.5 });
    assert.strictEqual(decoded.items[0]?.memoryId, "mem-1");
    assert.strictEqual(decoded.scoresByMemoryId["mem-1"], 0.9);
    assert.strictEqual(decoded.decisions["mem-1"], "admit");
    assert.strictEqual(O.getOrNull(decoded.timeoutSeconds), 2.5);
    assert.strictEqual(O.isNone(decode(VectorMemorySearchResponse, vectorResponse).timeoutSeconds), true);
    assert.strictEqual(
      O.isNone(decode(VectorMemorySearchResponse, { ...vectorResponse, timeoutSeconds: null }).timeoutSeconds),
      true,
    );
    assert.strictEqual(decodeFails(VectorMemorySearchResponse, { ...vectorResponse, decisions: { "mem-1": 1 } }), true);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      ProductMemorySearchItem,
      MemorySearchPolicyPayload,
      MemoryGlobalReadGateObservability,
      ProductRolloutObservability,
      ProductMemorySearchResponse,
      ArchiveProductMemorySearchResponse,
      VectorMemorySearchResponse,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
