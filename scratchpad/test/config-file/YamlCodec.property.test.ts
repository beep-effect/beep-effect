import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { YamlCodec } from "../../effected/config-file/YamlCodec.ts";

const runs = { arbitrary: fcRuns(100) };
// The YAML engine decodes integer literals outside the safe range as bigint.
// This recursive JSON domain retains fractions, strings, nulls, booleans,
// arbitrary keys and nesting while keeping numbers representable as numbers.
const NumberValue = S.Finite.check(S.isBetween({ minimum: -9_007_199_254_740_991, maximum: 9_007_199_254_740_991 }));
const Document: S.Codec<S.Json> = S.suspend(() => S.Union([
  S.Null, S.Boolean, S.String, NumberValue, S.Array(Document), S.Record(S.String, Document),
]));
const equivalent = S.toEquivalence(Document);

describe("YamlCodec property floor", () => {
  it.effect.prop("decodes encoded representable JSON values without failure and recovers the value", [Arbitrary.schema(Document)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* YamlCodec.stringify(value);
      const decoded = yield* S.decodeUnknownEffect(Document)(yield* YamlCodec.parse(encoded));
      assert.isTrue(equivalent(decoded, value));
    }), runs);

  it.effect.prop("parse/stringify fidelity and normalization idempotence hold with YAML comments", [Arbitrary.schema(Document)], ([value]) =>
    Effect.gen(function* () {
      const input = `# leading comment\n${yield* YamlCodec.stringify(value)}\n# trailing comment\n`;
      const parsed = yield* YamlCodec.parse(input);
      const formatted = yield* YamlCodec.stringify(parsed);
      const reparsed = yield* YamlCodec.parse(formatted);
      assert.deepStrictEqual(reparsed, parsed);
      assert.strictEqual(yield* YamlCodec.stringify(reparsed), formatted);
      assert.isTrue(equivalent(yield* S.decodeUnknownEffect(Document)(reparsed), value));
    }), runs);
});
