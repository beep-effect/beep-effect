import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as ST from "effect/SchemaTransformation";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, codec: S.Codec<T, E>, schema: S.Codec<T, unknown> = codec): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(codec)(value);
    const decoded = yield* S.decodeEffect(codec)(encoded);
    assertTrue(S.toEquivalence(codec)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(codec)(decoded), encoded);
  }), runs);
};
import { PackageManagerRange, InvalidPackageManagerRangeError } from "../../effected/package-json/PackageManagerRange.ts";
const Wire = S.Struct({ name: S.Literals(["pnpm", "npm", "yarn", "custom"]), range: S.Literals(["1.2.3", "^10.0.0", "~0.1.0", ">=1 <3", "*"]), integrity: S.Boolean });
const codec = PackageManagerRange.FromString.annotate({
  toCodecArbitrary: () => S.link<PackageManagerRange>()(Wire, ST.transformEffect<PackageManagerRange, typeof Wire.Type>({
    decode: (wire) => S.decodeEffect(PackageManagerRange.FromString)(`${wire.name}@${wire.range}${wire.integrity ? "+sha512.abcdef" : ""}`).pipe(Effect.orDie),
    encode: () => Effect.die("generation-only representation"),
  })),
});
describe("PackageManagerRange property floor", () => {
  roundTrips("PackageManagerRange class", PackageManagerRange, codec);
  roundTrips("PackageManagerRange.FromString", codec);
  roundTrips("InvalidPackageManagerRangeError", InvalidPackageManagerRangeError);
  it.effect.prop("parse/stringify fidelity and canonical spelling idempotence", [Arbitrary.schema(codec)], ([value]) => Effect.gen(function* () {
    const first = yield* S.decodeEffect(PackageManagerRange.FromString)(yield* S.encodeEffect(PackageManagerRange.FromString)(value));
    const text = yield* S.encodeEffect(PackageManagerRange.FromString)(first);
    const second = yield* S.decodeEffect(PackageManagerRange.FromString)(text);
    assert.strictEqual(yield* S.encodeEffect(PackageManagerRange.FromString)(second), text);
    assert.deepStrictEqual(second, first);
  }), runs);
});
