import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  CanonicalGraphNodeType,
  GraphEdgeRecord,
  GraphNodeRecord,
  GraphRecords,
  GraphRelationEndpoint,
  MemoryGraphAssertion,
  MemoryGraphAssertionV1,
  MemoryGraphAssertionV2,
  PROMOTION_ADMISSION_VERSION,
  PROMOTION_GRAPH_ARGUMENT_MAX_COUNT,
  PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES,
  PROMOTION_GRAPH_ASSERTION_V2_VERSION,
  PROMOTION_GRAPH_ASSERTION_VERSION,
  PROMOTION_GRAPH_PLAN_V2_VERSION,
  PROMOTION_GRAPH_PLAN_VERSION,
  PROMOTION_PLANNER_ID,
  PROMOTION_PLANNER_VERSION,
  PromotionAdmissionReceipt,
  PromotionGraphArguments,
  PromotionGraphPlan,
  PromotionGraphPlanV1,
  PromotionGraphPlanV2,
  buildMemoryGraphAssertion,
  buildPromotionAdmissionReceipt,
  canonicalGraphEntityId,
  deriveMemoryGraphAssertion,
  derivePromotionAdmissionReceipt,
  derivePromotionGraphPlan,
  graphRecords,
  normalizeGraphRelationEndpoint,
  normalizePromotionGraphArguments,
  promotionAdmissionIdentityPayload,
  promotionGraphPlanHashPayload,
  validPromotionAdmission,
} from "../../beep/MemoryPromotion.ts";

const decode = <A extends S.Top & S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const encode = <A extends S.Top & S.Codec<unknown, unknown, never, never>>(schema: A, value: A["Type"]): A["Encoded"] =>
  Effect.runSync(S.encodeEffect(schema)(value));

const ok = <A, E>(result: Result.Result<A, E>): A => Result.getOrThrow(result);

const failed = <A, E>(result: Result.Result<A, E>): boolean => Result.isFailure(result);

// Reference vectors computed with the Python module on 2026-09-22.
const SEATTLE_ID = "ent_b7854c4454b1b18451cd";
const P1_HASH = "ca4bdd9b8fe1b42a6a215e5310728fd2f3aba2925a6439bf3a685e21604b7972";
const P2_HASH = "9784ae86049ad8e8bbc0fc3679bd7f355cafe98e30d0fb62c83905393a57e001";
const RECEIPT_ID = "padm_22dbd8ee5ee37162d34a9df95dc53651";
const A1_ID = "mga_70d98ab7de04976ad257ced173c78800";
const A2_ID = "mga_b38126b34e55bf32821fb60647f04e58";

const createdAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");

const v1Plan = () =>
  PromotionGraphPlanV1.make({
    subjectEntityId: "user",
    predicate: "lives_in",
    arguments: { " place ": "Seattle", since: 2020 },
  });

const v2Plan = () =>
  PromotionGraphPlanV2.make({
    subjectEntityId: "user",
    predicate: "lives_in",
    subject: GraphRelationEndpoint.make({ label: " User ", nodeType: "person" }),
    object: GraphRelationEndpoint.make({ label: "Seattle", nodeType: "place" }),
    qualifiers: { since: 2020 },
  });

const receipt = () =>
  PromotionAdmissionReceipt.make({
    memoryId: "mem-1",
    sourceItemRevision: 3,
    outputContentHash: "hash-1",
    evidenceIds: ["ev-2", " ev-1 ", "ev-2"],
    graphPlanHash: P1_HASH,
    supersedes: [" old ", ""],
  });

const v1AssertionWire = {
  schemaVersion: PROMOTION_GRAPH_ASSERTION_VERSION,
  assertionId: "mga_1",
  uid: "user-1",
  memoryId: "mem-1",
  itemRevision: 1,
  contentHash: "hash-1",
  evidenceIds: ["ev-1"],
  subjectEntityId: "user",
  predicate: "lives_in",
  arguments: { place: "Seattle" },
  qualifiers: {},
  graphPlanHash: "plan-1",
  commitId: "commit-1",
  commitSequence: 1,
  status: "active",
  createdAt: "2020-01-02T03:04:05.000Z",
};

describe("MemoryPromotion constants", () => {
  it("freezes the wire strings", () => {
    assert.strictEqual(PROMOTION_ADMISSION_VERSION, "canonical_memory_promotion_admission.v1");
    assert.strictEqual(PROMOTION_GRAPH_PLAN_VERSION, "canonical_memory_graph_plan.v1");
    assert.strictEqual(PROMOTION_GRAPH_PLAN_V2_VERSION, "canonical_memory_graph_plan.v2");
    assert.strictEqual(PROMOTION_GRAPH_ASSERTION_VERSION, "canonical_memory_graph_assertion.v1");
    assert.strictEqual(PROMOTION_GRAPH_ASSERTION_V2_VERSION, "canonical_memory_graph_assertion.v2");
    assert.strictEqual(PROMOTION_PLANNER_ID, "canonical_batched_promotion");
    assert.strictEqual(PROMOTION_PLANNER_VERSION, "v2");
    assert.strictEqual(PROMOTION_GRAPH_ARGUMENTS_MAX_JSON_BYTES, 8192);
  });
});

describe("CanonicalGraphNodeType", () => {
  it("accepts the five types and rejects everything else", () => {
    assert.strictEqual(decode(CanonicalGraphNodeType, "organization"), "organization");
    assert.strictEqual(decodeFails(CanonicalGraphNodeType, "entity"), true);
    assert.strictEqual(decodeFails(CanonicalGraphNodeType, "Person"), true);
  });
});

describe("canonicalGraphEntityId", () => {
  it("keeps user and ent_ ids and hashes other labels", () => {
    assert.strictEqual(ok(canonicalGraphEntityId("  User ")), "user");
    assert.strictEqual(ok(canonicalGraphEntityId("ENT_Custom")), "ent_custom");
    assert.strictEqual(ok(canonicalGraphEntityId("Seattle")), SEATTLE_ID);
    assert.strictEqual(ok(canonicalGraphEntityId(" sea\tttle ")), ok(canonicalGraphEntityId("sea ttle")));
  });

  it("rejects a blank label", () => {
    assert.strictEqual(failed(canonicalGraphEntityId("   ")), true);
  });
});

describe("normalizePromotionGraphArguments", () => {
  it("trims and sorts top-level keys", () => {
    assert.deepStrictEqual(ok(normalizePromotionGraphArguments({ " b ": 1, a: "x" })), { a: "x", b: 1 });
  });

  it("rejects each bound", () => {
    assert.strictEqual(failed(normalizePromotionGraphArguments({})), true);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ " ": 1 })), true);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ a: 1, " a": 2 })), true);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ [`${"k".repeat(65)}`]: 1 })), true);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ a: { [`${"k".repeat(65)}`]: 1 } })), true);
    const tooMany = Object.fromEntries(
      Array.from({ length: PROMOTION_GRAPH_ARGUMENT_MAX_COUNT + 1 }, (_, index) => [`k${index}`, index]),
    );
    assert.strictEqual(failed(normalizePromotionGraphArguments(tooMany)), true);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ big: "x".repeat(8200) })), true);
    const nested = (depth: number): S.Json => (depth === 0 ? "leaf" : [nested(depth - 1)]);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ a: nested(8) })), false);
    assert.strictEqual(failed(normalizePromotionGraphArguments({ a: nested(9) })), true);
  });
});

describe("PromotionGraphArguments", () => {
  it("allows an empty object and rejects blank keys", () => {
    assert.deepStrictEqual(decode(PromotionGraphArguments, {}), {});
    assert.strictEqual(decodeFails(PromotionGraphArguments, { " ": 1 }), true);
    assert.strictEqual(decodeFails(PromotionGraphArguments, ["a"]), true);
  });
});

describe("GraphRelationEndpoint", () => {
  it("decodes present values and defaults the id at construction", () => {
    const decoded = decode(GraphRelationEndpoint, { entityId: "user", label: "User", nodeType: "person" });
    assert.strictEqual(decoded.entityId, "user");
    assert.strictEqual(GraphRelationEndpoint.make({ label: "Seattle", nodeType: "place" }).entityId, "");
    assert.strictEqual(decodeFails(GraphRelationEndpoint, { label: "   ", nodeType: "place" }), true);
    assert.strictEqual(decodeFails(GraphRelationEndpoint, { label: "x".repeat(201), nodeType: "place" }), true);
    assert.strictEqual(decodeFails(GraphRelationEndpoint, { label: "Seattle", nodeType: "entity" }), true);
  });

  it("normalizes the label and derives or checks the id", () => {
    const derived = ok(normalizeGraphRelationEndpoint(GraphRelationEndpoint.make({ label: " The  City ", nodeType: "place" })));
    assert.strictEqual(derived.label, "The City");
    assert.strictEqual(derived.entityId, ok(canonicalGraphEntityId("the city")));
    assert.strictEqual(
      failed(normalizeGraphRelationEndpoint(GraphRelationEndpoint.make({ entityId: "user", label: "Seattle", nodeType: "place" }))),
      true,
    );
    assert.strictEqual(
      ok(normalizeGraphRelationEndpoint(GraphRelationEndpoint.make({ entityId: SEATTLE_ID, label: "Seattle", nodeType: "place" })))
        .entityId,
      SEATTLE_ID,
    );
  });
});

describe("PromotionGraphPlan", () => {
  it("decodes the v1 member with missing and null endpoints", () => {
    const missing = decode(PromotionGraphPlan, {
      schemaVersion: PROMOTION_GRAPH_PLAN_VERSION,
      subjectEntityId: "user",
      predicate: "lives_in",
      arguments: { place: "Seattle" },
      qualifiers: {},
      planHash: "",
    });
    if (missing.schemaVersion !== PROMOTION_GRAPH_PLAN_VERSION) assert.fail("expected a v1 plan");
    assert.strictEqual(O.isNone(missing.subject), true);
    const nulled = decode(PromotionGraphPlanV1, {
      schemaVersion: PROMOTION_GRAPH_PLAN_VERSION,
      subjectEntityId: "user",
      predicate: "lives_in",
      arguments: { place: "Seattle" },
      subject: null,
      object: null,
      qualifiers: {},
      planHash: "",
    });
    assert.strictEqual(O.isNone(nulled.object), true);
    assert.strictEqual(encode(PromotionGraphPlanV1, nulled).subject, null);
  });

  it("decodes the v2 member and rejects an unknown version", () => {
    const decoded = decode(PromotionGraphPlan, {
      schemaVersion: PROMOTION_GRAPH_PLAN_V2_VERSION,
      subjectEntityId: "user",
      predicate: "lives_in",
      arguments: {},
      subject: { entityId: "user", label: "User", nodeType: "person" },
      object: { entityId: SEATTLE_ID, label: "Seattle", nodeType: "place" },
      qualifiers: { since: 2020 },
      planHash: "",
    });
    assert.strictEqual(decoded.schemaVersion, PROMOTION_GRAPH_PLAN_V2_VERSION);
    assert.strictEqual(decodeFails(PromotionGraphPlan, { schemaVersion: "v3", subjectEntityId: "user", predicate: "p" }), true);
    assert.strictEqual(decodeFails(PromotionGraphPlanV1, { schemaVersion: PROMOTION_GRAPH_PLAN_VERSION, subjectEntityId: " ", predicate: "p", arguments: {}, qualifiers: {}, planHash: "" }), true);
    assert.strictEqual(decodeFails(PromotionGraphPlanV1, { schemaVersion: PROMOTION_GRAPH_PLAN_VERSION, subjectEntityId: "user", predicate: "p".repeat(65), arguments: {}, qualifiers: {}, planHash: "" }), true);
  });

  it("derives the Python v1 hash and normalizes the arguments", () => {
    const derived = ok(derivePromotionGraphPlan(v1Plan()));
    assert.strictEqual(derived.planHash, P1_HASH);
    assert.deepStrictEqual(derived.arguments, { place: "Seattle", since: 2020 });
    assert.strictEqual(ok(derivePromotionGraphPlan(derived)).planHash, P1_HASH);
    assert.strictEqual(Object.keys(promotionGraphPlanHashPayload(derived)).length, 4);
  });

  it("derives the Python v2 hash, normalizes endpoints, and mirrors qualifiers", () => {
    const derived = ok(derivePromotionGraphPlan(v2Plan()));
    assert.strictEqual(derived.planHash, P2_HASH);
    assert.deepStrictEqual(derived.arguments, { since: 2020 });
    if (derived.schemaVersion !== PROMOTION_GRAPH_PLAN_V2_VERSION) assert.fail("expected a v2 plan");
    assert.strictEqual(derived.subject.entityId, "user");
    assert.strictEqual(derived.subject.label, "User");
    assert.strictEqual(derived.object.entityId, SEATTLE_ID);
    assert.strictEqual(Object.keys(promotionGraphPlanHashPayload(derived)).length, 7);
  });

  it("rejects each version rule", () => {
    assert.strictEqual(failed(derivePromotionGraphPlan(PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "p" }))), true);
    assert.strictEqual(failed(derivePromotionGraphPlan(PromotionGraphPlanV1.make({ ...v1Plan(), planHash: "stale" }))), true);
    const mismatch = PromotionGraphPlanV2.make({
      ...v2Plan(),
      subjectEntityId: "someone",
    });
    assert.strictEqual(failed(derivePromotionGraphPlan(mismatch)), true);
    const loop = PromotionGraphPlanV2.make({
      ...v2Plan(),
      object: GraphRelationEndpoint.make({ label: "User", nodeType: "person" }),
    });
    assert.strictEqual(failed(derivePromotionGraphPlan(loop)), true);
    const skew = PromotionGraphPlanV2.make({ ...v2Plan(), arguments: { since: 2021 } });
    assert.strictEqual(failed(derivePromotionGraphPlan(skew)), true);
    const aligned = PromotionGraphPlanV2.make({ ...v2Plan(), arguments: { since: 2020 } });
    assert.strictEqual(ok(derivePromotionGraphPlan(aligned)).planHash, P2_HASH);
  });
});

describe("PromotionAdmissionReceipt", () => {
  it("decodes and fills the singleton literals at construction", () => {
    const made = receipt();
    assert.strictEqual(made.receiptVersion, PROMOTION_ADMISSION_VERSION);
    assert.strictEqual(made.plannerId, PROMOTION_PLANNER_ID);
    assert.strictEqual(made.decision, "durable");
    assert.strictEqual(made.receiptId, "");
    const decoded = decode(PromotionAdmissionReceipt, encode(PromotionAdmissionReceipt, made));
    assert.strictEqual(decoded.sourceItemRevision, 3);
    assert.strictEqual(decodeFails(PromotionAdmissionReceipt, { ...encode(PromotionAdmissionReceipt, made), sourceItemRevision: 0 }), true);
    assert.strictEqual(decodeFails(PromotionAdmissionReceipt, { ...encode(PromotionAdmissionReceipt, made), evidenceIds: [" "] }), true);
    assert.strictEqual(decodeFails(PromotionAdmissionReceipt, { ...encode(PromotionAdmissionReceipt, made), memoryId: " " }), true);
    assert.strictEqual(decodeFails(PromotionAdmissionReceipt, { ...encode(PromotionAdmissionReceipt, made), decision: "review" }), true);
  });

  it("derives the Python receipt id and normalizes the id lists", () => {
    const derived = ok(derivePromotionAdmissionReceipt(receipt()));
    assert.strictEqual(derived.receiptId, RECEIPT_ID);
    assert.deepStrictEqual(derived.evidenceIds, ["ev-1", "ev-2"]);
    assert.deepStrictEqual(derived.supersedes, ["old"]);
    assert.strictEqual(Object.keys(promotionAdmissionIdentityPayload(derived)).length, 10);
    assert.strictEqual(ok(derivePromotionAdmissionReceipt(derived)).receiptId, RECEIPT_ID);
    assert.strictEqual(failed(derivePromotionAdmissionReceipt(PromotionAdmissionReceipt.make({ ...receipt(), receiptId: "padm_other" }))), true);
  });

  it("builds a receipt from a plan", () => {
    const built = ok(
      buildPromotionAdmissionReceipt({
        memoryId: "mem-1",
        sourceItemRevision: 3,
        outputContentHash: "hash-1",
        evidenceIds: ["ev-2", " ev-1 ", "ev-2"],
        graphPlan: v1Plan(),
        supersedes: [" old ", ""],
      }),
    );
    assert.strictEqual(built.receiptId, RECEIPT_ID);
    assert.strictEqual(built.graphPlanHash, P1_HASH);
    assert.strictEqual(
      failed(
        buildPromotionAdmissionReceipt({
          memoryId: "mem-1",
          sourceItemRevision: 3,
          outputContentHash: "hash-1",
          evidenceIds: [],
          graphPlan: v1Plan(),
          supersedes: [],
        }),
      ),
      true,
    );
  });
});

describe("MemoryGraphAssertion", () => {
  it("decodes both members and rejects bad counters", () => {
    const v1 = decode(MemoryGraphAssertion, v1AssertionWire);
    if (v1.schemaVersion !== PROMOTION_GRAPH_ASSERTION_VERSION) assert.fail("expected a v1 assertion");
    assert.strictEqual(O.isNone(v1.subject), true);
    assert.strictEqual(DateTime.formatIso(v1.createdAt), "2020-01-02T03:04:05.000Z");
    const v2 = decode(MemoryGraphAssertion, {
      ...v1AssertionWire,
      schemaVersion: PROMOTION_GRAPH_ASSERTION_V2_VERSION,
      arguments: {},
      subject: { entityId: "user", label: "User", nodeType: "person" },
      object: { entityId: SEATTLE_ID, label: "Seattle", nodeType: "place" },
    });
    assert.strictEqual(v2.schemaVersion, PROMOTION_GRAPH_ASSERTION_V2_VERSION);
    assert.strictEqual(decodeFails(MemoryGraphAssertion, { ...v1AssertionWire, commitSequence: 0 }), true);
    assert.strictEqual(decodeFails(MemoryGraphAssertion, { ...v1AssertionWire, status: "retired" }), true);
    assert.strictEqual(decodeFails(MemoryGraphAssertion, { ...v1AssertionWire, evidenceIds: [] }), true);
    assert.strictEqual(decodeFails(MemoryGraphAssertion, { ...v1AssertionWire, schemaVersion: PROMOTION_GRAPH_ASSERTION_V2_VERSION }), true);
  });

  it("builds the Python v1 assertion and re-validates its plan hash", () => {
    const built = ok(
      buildMemoryGraphAssertion({
        uid: "user-1",
        memoryId: "mem-1",
        itemRevision: 1,
        contentHash: "hash-1",
        evidenceIds: ["ev-1"],
        graphPlan: v1Plan(),
        commitId: "commit-1",
        commitSequence: 1,
        createdAt,
      }),
    );
    assert.strictEqual(built.assertionId, A1_ID);
    assert.strictEqual(built.schemaVersion, PROMOTION_GRAPH_ASSERTION_VERSION);
    assert.strictEqual(built.graphPlanHash, P1_HASH);
    assert.deepStrictEqual(built.arguments, { place: "Seattle", since: 2020 });
    assert.strictEqual(ok(deriveMemoryGraphAssertion(built)).assertionId, A1_ID);
    assert.strictEqual(failed(deriveMemoryGraphAssertion(decode(MemoryGraphAssertion, v1AssertionWire))), true);
  });

  it("builds the Python v2 assertion", () => {
    const built = ok(
      buildMemoryGraphAssertion({
        uid: "user-1",
        memoryId: "mem-1",
        itemRevision: 1,
        contentHash: "hash-1",
        evidenceIds: ["ev-1"],
        graphPlan: v2Plan(),
        commitId: "commit-1",
        commitSequence: 1,
        createdAt,
      }),
    );
    assert.strictEqual(built.assertionId, A2_ID);
    assert.strictEqual(built.schemaVersion, PROMOTION_GRAPH_ASSERTION_V2_VERSION);
    assert.strictEqual(built.graphPlanHash, P2_HASH);
  });
});

describe("graphRecords", () => {
  const build = (plan: PromotionGraphPlan) =>
    ok(
      buildMemoryGraphAssertion({
        uid: "user-1",
        memoryId: "mem-1",
        itemRevision: 1,
        contentHash: "hash-1",
        evidenceIds: ["ev-1"],
        graphPlan: plan,
        commitId: "commit-1",
        commitSequence: 1,
        createdAt,
      }),
    );

  it("projects a multi-slot v1 assertion like Python", () => {
    const records = ok(graphRecords(build(v1Plan())));
    assert.deepStrictEqual(
      records.nodes.map((node) => [node.id, node.label, node.nodeType]),
      [
        ["user", "user", "entity"],
        [SEATTLE_ID, "Seattle", "entity"],
        ["ent_c4e384460edf613d6166", "2020", "entity"],
      ],
    );
    assert.deepStrictEqual(
      records.edges.map((edge) => [edge.id, edge.label, edge.targetId]),
      [
        ["edge_b915f1ae1f1df5ede70bf6e2", "lives_in:place", SEATTLE_ID],
        ["edge_9c2d80bb3e10f300da7a4611", "lives_in:since", "ent_c4e384460edf613d6166"],
      ],
    );
    assert.deepStrictEqual(records.nodes[0]?.memoryIds, ["mem-1"]);
  });

  it("labels a single-slot v1 edge with the predicate alone and dedupes nodes", () => {
    const single = ok(
      graphRecords(build(PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "lives_in", arguments: { place: "Seattle" } }))),
    );
    assert.strictEqual(single.edges[0]?.label, "lives_in");
    const duplicate = ok(
      graphRecords(
        build(PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "knows", arguments: { a: "User", b: "User" } })),
      ),
    );
    assert.strictEqual(duplicate.nodes.length, 1);
    assert.strictEqual(duplicate.edges.length, 2);
  });

  it("reads object slots the Python way", () => {
    const records = ok(
      graphRecords(
        build(
          PromotionGraphPlanV1.make({
            subjectEntityId: "user",
            predicate: "knows",
            arguments: { who: { label: "Ada", entity_id: "ent_ada" }, x: { value: 0, label: "" } },
          }),
        ),
      ),
    );
    assert.deepStrictEqual(
      records.nodes.map((node) => [node.id, node.label]),
      [
        ["user", "user"],
        ["ent_ada", "Ada"],
        ["ent_78dd3e0acc9b1ffb29c2", "x"],
      ],
    );
    assert.deepStrictEqual(
      records.edges.map((edge) => edge.id),
      ["edge_263e986fedb36372bd994ed6", "edge_4ca3e86f0586da7e5f2fee38"],
    );
    assert.strictEqual(
      failed(graphRecords(build(PromotionGraphPlanV1.make({ subjectEntityId: "user", predicate: "knows", arguments: { who: "   " } })))),
      true,
    );
  });

  it("projects a v2 assertion with typed nodes and one edge", () => {
    const records = ok(graphRecords(build(v2Plan())));
    assert.deepStrictEqual(
      records.nodes.map((node) => [node.id, node.label, node.nodeType]),
      [
        ["user", "User", "person"],
        [SEATTLE_ID, "Seattle", "place"],
      ],
    );
    assert.deepStrictEqual(
      records.edges.map((edge) => [edge.id, edge.label, edge.sourceId, edge.targetId]),
      [["edge_794277db8a3e5422e694db5a", "lives_in", "user", SEATTLE_ID]],
    );
  });
});

describe("validPromotionAdmission", () => {
  const plan = ok(derivePromotionGraphPlan(v1Plan()));
  const admitted = ok(derivePromotionAdmissionReceipt(receipt()));
  const promotion = () => ({
    graphPlan: encode(PromotionGraphPlan, plan),
    admissionReceipt: encode(PromotionAdmissionReceipt, admitted),
  });
  const base = () => ({
    memoryId: "mem-1",
    sourceItemRevision: 3,
    outputContentHash: "hash-1",
    evidenceIds: ["ev-2", "ev-1"],
    subjectEntityId: O.some("user"),
    predicate: O.some("lives_in"),
    arguments: { place: "Seattle", since: 2020 },
    supersedes: ["old"],
    promotion: promotion(),
  });

  it("accepts the bound proof", () => {
    assert.strictEqual(validPromotionAdmission(base()), true);
  });

  it("rejects each broken clause", () => {
    assert.strictEqual(validPromotionAdmission({ ...base(), promotion: {} }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), promotion: { ...promotion(), graphPlan: "nope" } }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), memoryId: "mem-2" }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), sourceItemRevision: 4 }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), outputContentHash: "hash-2" }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), evidenceIds: ["ev-1"] }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), subjectEntityId: O.none() }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), predicate: O.some("knows") }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), arguments: { place: "Seattle" } }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), arguments: {} }), false);
    assert.strictEqual(validPromotionAdmission({ ...base(), supersedes: [] }), false);
    const stale = { ...encode(PromotionGraphPlan, plan), planHash: "stale" };
    assert.strictEqual(validPromotionAdmission({ ...base(), promotion: { ...promotion(), graphPlan: stale } }), false);
    const selfSupersede = ok(derivePromotionAdmissionReceipt(PromotionAdmissionReceipt.make({ ...receipt(), supersedes: ["mem-1"] })));
    assert.strictEqual(
      validPromotionAdmission({
        ...base(),
        supersedes: ["mem-1"],
        promotion: { ...promotion(), admissionReceipt: encode(PromotionAdmissionReceipt, selfSupersede) },
      }),
      false,
    );
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      CanonicalGraphNodeType,
      PromotionGraphArguments,
      GraphRelationEndpoint,
      PromotionGraphPlanV1,
      PromotionGraphPlanV2,
      PromotionGraphPlan,
      PromotionAdmissionReceipt,
      MemoryGraphAssertionV1,
      MemoryGraphAssertionV2,
      MemoryGraphAssertion,
      GraphNodeRecord,
      GraphEdgeRecord,
      GraphRecords,
    ]) {
      assert.notStrictEqual(Arbitrary.schema(schema), undefined);
    }
  });
});
