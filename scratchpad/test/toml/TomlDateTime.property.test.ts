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
import * as D from "../../effected/toml/TomlDateTime.ts";
import { Toml } from "../../effected/toml/Toml.ts";
const dateLaws = <T extends { toString(): string }, E>(name: string, schema: S.Codec<T, E>): void => {
  roundTrips(`${name} schema identity`, schema);
  it.effect.prop(`${name} textual fidelity and canonical idempotence`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const source = `value = ${value.toString()}\n`;
    const parsed = yield* S.decodeUnknownEffect(S.Struct({ value: schema }))(yield* Toml.parse(source));
    assertTrue(S.toEquivalence(schema)(parsed.value, value));
    assert.strictEqual(parsed.value.toString(), value.toString());
    const canonical = yield* Toml.stringify(parsed);
    assert.strictEqual(yield* Toml.stringify(yield* Toml.parse(canonical)), canonical);
    assert.deepStrictEqual(yield* Toml.parse(canonical), parsed);
  }), runs);
};
describe("calendar and clock laws", () => {
  dateLaws("local date", D.TomlLocalDate);
  dateLaws("local time", D.TomlLocalTime);
  dateLaws("local date-time", D.TomlLocalDateTime);
  dateLaws("offset date-time", D.TomlOffsetDateTime);
});
