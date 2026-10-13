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
import { Bugs, Repository } from "../../effected/package-json/Repository.ts";
const RepositoryWire = S.Union([S.String, S.Struct({ url: S.String, type: S.optionalKey(S.String), directory: S.optionalKey(S.String), extra: S.Json })]);
const BugsWire = S.Union([S.String, S.Struct({ url: S.optionalKey(S.String), email: S.optionalKey(S.String), extra: S.Json })]);
const repositoryCodec = Repository.FromValue.annotate({ toCodecArbitrary: () => S.link<Repository>()(RepositoryWire, ST.transformEffect<Repository, typeof RepositoryWire.Type>({ decode: (wire) => S.decodeEffect(Repository.FromValue)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) });
const bugsCodec = Bugs.FromValue.annotate({ toCodecArbitrary: () => S.link<Bugs>()(BugsWire, ST.transformEffect<Bugs, typeof BugsWire.Type>({ decode: (wire) => S.decodeEffect(Bugs.FromValue)(wire).pipe(Effect.orDie), encode: () => Effect.die("generation-only representation") })) });
describe("repository property floor", () => {
  roundTrips("Repository class", Repository);
  roundTrips("Bugs class", Bugs);
  roundTrips("Repository.FromValue", repositoryCodec);
  roundTrips("Bugs.FromValue", bugsCodec);
  it.effect.prop("repository original spelling and unknown fields survive exactly", [Arbitrary.schema(RepositoryWire)], ([wire]) => Effect.gen(function* () {
    const value = yield* S.decodeEffect(Repository.FromValue)(wire);
    assert.deepStrictEqual(yield* S.encodeEffect(Repository.FromValue)(value), wire);
  }), runs);
  it.effect.prop("bugs original spelling and unknown fields survive exactly", [Arbitrary.schema(BugsWire)], ([wire]) => Effect.gen(function* () {
    const value = yield* S.decodeEffect(Bugs.FromValue)(wire);
    assert.deepStrictEqual(yield* S.encodeEffect(Bugs.FromValue)(value), wire);
  }), runs);
});
