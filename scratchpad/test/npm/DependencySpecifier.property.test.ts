import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { InvalidDependencySpecifierError, DependencyProtocol, CatalogSpecifier, WorkspaceSpecifier, RangeSpecifier, DistTagSpecifier, RawSpecifier, DependencySpecifier } from "../../effected/npm/DependencySpecifier.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, generation: S.Schema<T> = schema): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(`${name}: decoding an encoded value succeeds and preserves it`, [Arbitrary.schema(generation)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

// The classified codec's public models permit hand-built raw/range/name pairs.
// Generate its round-trip domain by parsing wire strings, rather than inventing
// inconsistent pairs. Each of the models is also tested independently below.
const SpecifierText = S.String.check(S.isPattern(/^(?:catalog:|workspace:|file:|link:|portal:|npm:|https:\/\/|git\+https:\/\/)[a-zA-Z0-9._@/~^*:-]*$/));
const ClassifiedDomain = S.declare(S.is(DependencySpecifier.FromString), {
  toCodecArbitrary: () => S.link<typeof DependencySpecifier.FromString.Type>()(SpecifierText,
    SchemaTransformation.transformEffect({
      decode: (value) => S.decodeEffect(DependencySpecifier.FromString)(value).pipe(Effect.mapError((error) => error.issue)),
      encode: (value) => S.encodeEffect(DependencySpecifier.FromString)(value).pipe(Effect.mapError((error) => error.issue)),
    })),
});
const GeneratableSpecifier = DependencySpecifier.check(S.isPattern(/^(?:catalog:|workspace:|file:|link:|portal:|npm:|https:\/\/|git\+https:\/\/)[a-zA-Z0-9._@/~^*:-]*$/));

describe("DependencySpecifier property floor", () => {
  roundTrips("InvalidDependencySpecifierError", InvalidDependencySpecifierError);
  roundTrips("DependencyProtocol", DependencyProtocol);
  roundTrips("CatalogSpecifier", CatalogSpecifier);
  roundTrips("WorkspaceSpecifier", WorkspaceSpecifier);
  roundTrips("RangeSpecifier", RangeSpecifier);
  roundTrips("DistTagSpecifier", DistTagSpecifier);
  roundTrips("RawSpecifier", RawSpecifier);
  roundTrips("DependencySpecifier", DependencySpecifier, GeneratableSpecifier);
  roundTrips("DependencySpecifier.FromString", DependencySpecifier.FromString, ClassifiedDomain);
});

it.effect.prop("classification preserves the original spelling and parse/stringify/parse is faithful",
  [Arbitrary.schema(SpecifierText)], ([text]) => Effect.gen(function* () {
    const parsed = yield* S.decodeEffect(DependencySpecifier.FromString)(text);
    assert.strictEqual(parsed.raw, text);
    assert.strictEqual(yield* DependencySpecifier.decode(text), text);
    const formatted = yield* S.encodeEffect(DependencySpecifier.FromString)(parsed);
    assert.strictEqual(formatted, text);
    const reparsed = yield* S.decodeEffect(DependencySpecifier.FromString)(formatted);
    assertTrue(S.toEquivalence(DependencySpecifier.FromString)(parsed, reparsed));
    assert.strictEqual(yield* S.encodeEffect(DependencySpecifier.FromString)(reparsed), formatted);
  }), runs);

const RangeText = S.String.check(S.isPattern(/^[~^]?(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})$/));
it.effect.prop("parseRange preserves the range through canonical formatting and formatting is idempotent",
  [Arbitrary.schema(RangeText)], ([text]) => Effect.gen(function* () {
    const parsed = yield* Effect.fromOption(DependencySpecifier.parseRange(text));
    const formatted = parsed.toString();
    const reparsed = yield* Effect.fromOption(DependencySpecifier.parseRange(formatted));
    assert.deepStrictEqual(reparsed.sets, parsed.sets);
    assert.strictEqual(reparsed.toString(), formatted);
  }), runs);

it.effect.prop("workspace projection agrees with the instance formatter and is stable after publication",
  [Arbitrary.schema(S.Literals(["*", "", "~", "^", "^1.0.0", "pkg@*", "@scope/pkg@~"])), Arbitrary.schema(S.String.check(S.isPattern(/^(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})\.(?:0|[1-9][0-9]{0,2})$/)))],
  ([modifier, version]) => Effect.gen(function* () {
    const text = `workspace:${modifier}`;
    const parsed = yield* S.decodeEffect(DependencySpecifier.FromString)(text);
    assert.strictEqual(parsed._tag, "workspace");
    if (parsed._tag === "workspace") {
      const formatted = parsed.resolve(version);
      const projection = DependencySpecifier.resolveWorkspace(text, version);
      assert.strictEqual(formatted, projection);
      // Published ranges and npm aliases no longer need workspace resolution.
      assertTrue(DependencySpecifier.isValid(formatted));
      const published = yield* S.decodeEffect(DependencySpecifier.FromString)(formatted);
      assert.strictEqual(yield* S.encodeEffect(DependencySpecifier.FromString)(published), formatted);
      assert.strictEqual(DependencySpecifier.resolveWorkspace(formatted, version), formatted);
    }
  }), runs);
