import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  DailySummariesResponse,
  DailySummaryActionItem,
  DailySummaryActionItemWire,
  DailySummaryDayStats,
  DailySummaryDecisionMade,
  DailySummaryKnowledgeNugget,
  DailySummaryLocationPin,
  DailySummaryLocationPinWire,
  DailySummaryResponse,
  DailySummaryTopicHighlight,
  DailySummaryUnresolvedQuestion,
  LearnedMemoryRef,
  decodeDailySummaryResponse,
  flattenDailySummaryRest,
} from "../../beep/DailySummary.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("DailySummary", () => {
  it("decodes present, null, and missing action-item fields", () => {
    const present = decode(DailySummaryActionItemWire, {
      description: "Ship",
      priority: "high",
      source_conversation_id: "c1",
      completed: false,
    });
    assert.strictEqual(O.getOrElse(present.description, () => ""), "Ship");
    assert.strictEqual(O.getOrElse(present.completed, () => true), false);
    const nulled = decode(DailySummaryActionItemWire, { priority: null, completed: null });
    assert.strictEqual(O.isNone(nulled.priority), true);
    assert.strictEqual(O.isNone(nulled.completed), true);
    const missing = decode(DailySummaryActionItemWire, {});
    assert.strictEqual(O.isNone(missing.description), true);
    assert.strictEqual(O.isNone(missing.sourceConversationId), true);
  });

  it("admits non-finite pin coordinates and decodes null as None", () => {
    const nonFinite = decode(DailySummaryLocationPinWire, {
      latitude: Number.NaN,
      longitude: Number.NEGATIVE_INFINITY,
    });
    assert.isNaN(O.getOrThrow(nonFinite.latitude));
    assert.strictEqual(O.getOrThrow(nonFinite.longitude), Number.NEGATIVE_INFINITY);
    const nulled = decode(DailySummaryLocationPinWire, { latitude: null });
    assert.strictEqual(O.isNone(nulled.latitude), true);
    assert.strictEqual(O.isNone(nulled.longitude), true);
  });

  it("keeps unknown response keys and lifts them back", () => {
    const decoded = Effect.runSync(decodeDailySummaryResponse({ memories_learned: [], bonus: "kept", headline: null }));
    assert.strictEqual(O.isNone(decoded.headline), true);
    assert.strictEqual(decoded.rest.bonus, "kept");
    const wire = Effect.runSync(flattenDailySummaryRest(decoded));
    const flat: { readonly [key: string]: unknown } = wire;
    assert.strictEqual(flat.bonus, "kept");
    assert.strictEqual("rest" in wire, false);
  });

  it("constructs an empty summaries page and a memory ref default", () => {
    assert.strictEqual(DailySummariesResponse.make({}).summaries.length, 0);
    assert.strictEqual(LearnedMemoryRef.make({ memoryId: "m1", content: "Ada" }).category, "");
    const memory = decode(S.Unknown, null);
    assert.strictEqual(memory, null);
  });

  it("derives an arbitrary for each model", () => {
    const schemas = [
      DailySummaryActionItem,
      DailySummaryTopicHighlight,
      DailySummaryUnresolvedQuestion,
      DailySummaryDecisionMade,
      DailySummaryKnowledgeNugget,
      DailySummaryDayStats,
      DailySummaryLocationPin,
      LearnedMemoryRef,
      DailySummaryResponse,
      DailySummariesResponse,
    ];
    for (const schema of schemas) {
      assert.strictEqual(schema.pipe(Arbitrary.schema, Arbitrary.isArbitrary), true);
    }
  });
});
