import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as ST from "effect/SchemaTransformation";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { Person } from "../../effected/package-json/Person.ts";
const ObjectWire = S.Struct({ name: S.String, email: S.optionalKey(S.String), url: S.optionalKey(S.String), extra: S.Json });
const ValueWire = S.Union([S.String, ObjectWire]);
const stringCodec = Person.FromString.annotate({ toCodecArbitrary: () => S.link<Person>()(S.String, ST.transformEffect<Person, string>({ decode: (wire) => S.decodeEffect(Person.FromString)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) });
const objectCodec = Person.schema.annotate({ toCodecArbitrary: () => S.link<Person>()(ObjectWire, ST.transformEffect<Person, typeof ObjectWire.Type>({ decode: (wire) => S.decodeEffect(Person.schema)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) });
const valueCodec = Person.FromValue.annotate({ toCodecArbitrary: () => S.link<Person>()(ValueWire, ST.transformEffect<Person, typeof ValueWire.Type>({ decode: (wire) => S.decodeEffect(Person.FromValue)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) });
describe("person property floor", () => {
  roundTrips("Person class", Person);
  roundTrips("Person.schema", objectCodec);
  roundTrips("Person.FromString", stringCodec);
  roundTrips("Person.FromValue", valueCodec);
  it.effect.prop("person wire spelling and unknown fields survive exactly", [Arbitrary.schema(ValueWire)], ([wire]) => Effect.gen(function* () {
    const person = yield* S.decodeEffect(Person.FromValue)(wire);
    assert.deepStrictEqual(yield* S.encodeEffect(Person.FromValue)(person), wire);
  }), runs);
  it.effect.prop("person shorthand parsing and formatting are idempotent and faithful", [Arbitrary.schema(stringCodec)], ([person]) => Effect.gen(function* () {
    const text = yield* S.encodeEffect(Person.FromString)(person);
    const parsed = yield* S.decodeEffect(Person.FromString)(text);
    const twice = yield* S.decodeEffect(Person.FromString)(yield* S.encodeEffect(Person.FromString)(parsed));
    assert.deepStrictEqual(twice, parsed);
    assert.strictEqual(yield* S.encodeEffect(Person.FromString)(twice), text);
  }), runs);
});
