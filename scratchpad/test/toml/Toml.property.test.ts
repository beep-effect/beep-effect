import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(value, decoded));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { Toml, TomlParseError, TomlStringifyError, TomlStringifyOptions } from "../../effected/toml/Toml.ts";
// The plain-value codec is partial over Unknown: TOML excludes null and root scalars.
// Exercise its representable domain, including nested tables, arrays and bigint integers.
const Value = S.Struct({ title: S.String, enabled: S.Boolean, numbers: S.Array(S.Int.check(S.isBetween({ minimum: -1000000, maximum: 1000000 }))), table: S.Struct({ text: S.String }), large: S.BigInt.check(S.isBetweenBigInt({ minimum: 9007199254740992n, maximum: 9223372036854775807n })) });
const fresh = Toml.fromString().pipe(S.decodeTo(Value));
const shared = Toml.TomlFromString.pipe(S.decodeTo(Value));
const composed = Toml.schema(Value);
const bound = Toml.bind(Value);
describe("facade schemas and canonical value laws", () => {
  roundTrips("stringify options", TomlStringifyOptions);
  roundTrips("parse error", TomlParseError);
  roundTrips("stringify error", TomlStringifyError);
  roundTrips("fresh fromString codec on TOML values", fresh);
  roundTrips("shared TomlFromString codec on TOML values", shared);
  roundTrips("schema factory", composed);
  roundTrips("bound schema", bound.schema);
  it.effect.prop("canonical stringify is idempotent and parse/stringify is faithful", [Arbitrary.schema(Value), Arbitrary.schema(TomlStringifyOptions)], ([value, options]) => Effect.gen(function* () {
    const text = yield* Toml.stringify(value, options);
    const parsed = yield* Toml.parse(text);
    assert.deepStrictEqual(parsed, value);
    assert.strictEqual(yield* Toml.stringify(parsed, options), text);
    assert.deepStrictEqual(yield* Toml.parse(yield* Toml.stringify(parsed)), parsed);
    assert.deepStrictEqual(yield* bound.decode(yield* bound.encode(value)), value);
  }), runs);
});
