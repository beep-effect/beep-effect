import { YamlCodec } from "@beep/config-file/YamlCodec";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const NumberValue = S.Finite.check(S.isBetween({ minimum: -9_007_199_254_740_991, maximum: 9_007_199_254_740_991 }));
const JsonWithSafeNumbers: S.Codec<S.Json> = S.suspend(() =>
  S.Union([
    S.Null,
    S.Boolean,
    S.String,
    NumberValue,
    S.Array(JsonWithSafeNumbers),
    S.Record(S.String, JsonWithSafeNumbers),
  ])
);
const equivalent = S.toEquivalence(JsonWithSafeNumbers);

describe("YamlCodec property floor", () => {
  it.effect.prop(
    "decodes encoded representable JSON values without failure and recovers the value",
    [Arbitrary.schema(JsonWithSafeNumbers)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* YamlCodec.stringify(value);
        const argument = S.decodeUnknownEffect(JsonWithSafeNumbers);
        const parsed1 = yield* YamlCodec.parse(encoded);
        const decoded = yield* argument(parsed1);
        assert.isTrue(
          equivalent(decoded, value),
          "the YAML engine decodes integers beyond the safe range as bigint, so numbers stay in it"
        );
      }),
    runs
  );

  it.effect.prop(
    "parse/stringify fidelity and normalization idempotence hold with YAML comments",
    [Arbitrary.schema(JsonWithSafeNumbers)],
    ([value]) =>
      Effect.gen(function* () {
        const input = `# leading comment\n${yield* YamlCodec.stringify(value)}\n# trailing comment\n`;
        const parsed = yield* YamlCodec.parse(input);
        const formatted = yield* YamlCodec.stringify(parsed);
        const reparsed = yield* YamlCodec.parse(formatted);
        assert.deepStrictEqual(reparsed, parsed);
        const stringify1 = yield* YamlCodec.stringify(reparsed);
        assert.strictEqual(stringify1, formatted);
        const value2 = yield* S.decodeUnknownEffect(JsonWithSafeNumbers)(reparsed);
        assert.isTrue(equivalent(value2, value));
      }),
    runs
  );
});
