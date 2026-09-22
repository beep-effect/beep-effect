import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  Trend,
  TrendEnum,
  TrendType,
  aiProductOptions,
  ceoOptions,
  companyOptions,
  hardwareProductOptions,
  softwareProductOptions,
  validItems,
} from "../../beep/Trend.ts";

const decode = <A extends S.Top>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Top, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Trend", () => {
  it("decodes a trend whose topic is outside the vocabulary", () => {
    const decoded = decode(toWire(Trend), {
      category: "company",
      type: "worst",
      topics: ["not-a-listed-topic"],
    });
    assert.strictEqual(decoded.category, "company");
    assert.strictEqual(decoded.type, "worst");
    assert.strictEqual(decoded.topics[0], "not-a-listed-topic");
    assert.strictEqual(fails(toWire(Trend), { category: "person", type: "best", topics: [] }), true);
    assert.strictEqual(fails(toWire(Trend), { category: "ceo", type: "middle", topics: [] }), true);
  });

  it("keeps the vocabularies as data, including names shared across categories", () => {
    assert.strictEqual(ceoOptions.length, 39);
    assert.strictEqual(companyOptions.length, 40);
    assert.strictEqual(softwareProductOptions.length, 39);
    assert.strictEqual(hardwareProductOptions.length, 20);
    assert.strictEqual(aiProductOptions.length, 40);
    assert.strictEqual(HashSet.has(validItems, "Zoom"), true);
    assert.strictEqual(HashSet.has(validItems, "Microsoft Copilot"), true);
    assert.strictEqual(HashSet.has(validItems, "not-a-topic"), false);
    assert.strictEqual(HashSet.has(validItems, "Stéphane Bancel"), true);
    assert.strictEqual(HashSet.has(validItems, "Nestlé"), true);
  });

  it("derives an arbitrary for every exported schema", () => {
    for (const schema of [TrendEnum, TrendType, Trend]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
