import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import { ConfigDependencySpec, InvalidConfigDependencySpecError } from "../../effected/workspaces/ConfigDependencySpec.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("ConfigDependencySpec property floor", () => {
  roundTrips("ConfigDependencySpec", ConfigDependencySpec);
  // The codec's instanceOf declaration has no native arbitrary. Supply its
  // existing class model as generation metadata without changing the codec.
  const schema = ConfigDependencySpec.FromString.annotate({
    toCodecArbitrary: () => S.link<ConfigDependencySpec>()(ConfigDependencySpec, { decode: SchemaGetter.passthrough(), encode: SchemaGetter.passthrough() }),
  });
  it.effect.prop("FromString: decode(encode(x)) equals x and never fails", [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(ConfigDependencySpec.FromString)(value);
      const decoded = yield* S.decodeEffect(ConfigDependencySpec.FromString)(encoded);
      assert.isTrue(S.toEquivalence(ConfigDependencySpec)(decoded, value));
      assert.strictEqual(yield* S.encodeEffect(ConfigDependencySpec.FromString)(decoded), encoded);
    }), runs);
  roundTrips("InvalidConfigDependencySpecError", InvalidConfigDependencySpecError);
});

it.effect.prop("parse/stringify fidelity, formatting idempotence and byte-identical spelling", [Arbitrary.schema(ConfigDependencySpec)], ([value]) =>
  Effect.gen(function* () {
    const text = value.toString();
    const parsed = yield* ConfigDependencySpec.parse(text);
    const reparsed = yield* ConfigDependencySpec.parse(parsed.toString());
    assert.isTrue(S.toEquivalence(ConfigDependencySpec)(parsed, value));
    assert.isTrue(S.toEquivalence(ConfigDependencySpec)(reparsed, parsed));
    assert.strictEqual(parsed.toString(), text);
    assert.strictEqual(reparsed.toString(), parsed.toString());
    const bare = yield* ConfigDependencySpec.parse(parsed.bare);
    assert.strictEqual(bare.bare, parsed.bare);
    assert.isFalse(bare.hasIntegrity);
  }), runs);
