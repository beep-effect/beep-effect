import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as R from "effect/Record";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { ManifestDecodeError, UnresolvedDependencyError, Manifest } from "../../effected/npm/Manifest.ts";

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

const ManifestWire = S.Struct({
  dependencies: S.optionalKey(S.Record(S.String, S.String)),
  devDependencies: S.optionalKey(S.Record(S.String, S.String)),
  peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
  optionalDependencies: S.optionalKey(S.Record(S.String, S.String)),
  name: S.optionalKey(S.Json),
  metadata: S.optionalKey(S.Json),
});
// Generate decoded wire values. Hand-built models may omit `rest` or put
// dependency keys into it; the wire codec canonicalizes those representations.
const WireDomain = S.declare(S.is(Manifest), {
  toCodecArbitrary: () => S.link<Manifest>()(ManifestWire,
    SchemaTransformation.transformEffect({
      decode: (value: typeof ManifestWire.Type) => S.decodeEffect(Manifest.schema)(value).pipe(Effect.mapError((error) => error.issue)),
      encode: (value) => S.encodeEffect(Manifest.schema)(value).pipe(Effect.flatMap(S.decodeUnknownEffect(ManifestWire)), Effect.mapError((error) => error.issue)),
    })),
});

describe("Manifest property floor", () => {
  roundTrips("ManifestDecodeError", ManifestDecodeError);
  roundTrips("UnresolvedDependencyError", UnresolvedDependencyError);
  roundTrips("Manifest", Manifest);
  roundTrips("Manifest.schema", Manifest.schema, WireDomain);
});

it.effect.prop("manifest wire parsing preserves dependency maps and unknown JSON fields verbatim",
  [Arbitrary.schema(ManifestWire)], ([wire]) => Effect.gen(function* () {
    const parsed = yield* Manifest.decode(wire);
    const formatted = parsed.toRecord();
    assert.deepStrictEqual(formatted, wire);
    const reparsed = yield* Manifest.decode(formatted);
    assertTrue(S.toEquivalence(Manifest)(reparsed, parsed));
    assert.deepStrictEqual(reparsed.toRecord(), formatted);
  }), runs);

it.effect.prop("the manifest wire codec retains an own __proto__ field and arbitrary unknown JSON values",
  [Arbitrary.schema(S.Json), Arbitrary.schema(S.Json), Arbitrary.schema(S.Record(S.String, S.String))],
  ([prototypeValue, metadata, dependencies]) => Effect.gen(function* () {
    const wire = R.fromEntries([["__proto__", prototypeValue], ["metadata", metadata], ["dependencies", dependencies]]);
    const parsed = yield* Manifest.decode(wire);
    const formatted = parsed.toRecord();
    assert.deepStrictEqual(formatted, wire);
    assert.strictEqual(R.has(formatted, "__proto__"), true);
    assert.deepStrictEqual(formatted["__proto__"], prototypeValue);
    const reparsed = yield* Manifest.decode(formatted);
    assertTrue(S.toEquivalence(Manifest)(reparsed, parsed));
    assert.deepStrictEqual(reparsed.toRecord(), formatted);
  }), runs);
