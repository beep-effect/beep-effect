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
import { PackageManager } from "../../effected/package-json/PackageManager.ts";
const Wire = S.Struct({ name: S.Literals(["pnpm", "npm", "yarn", "custom"]), version: S.Literals(["1.2.3", "10.0.0-rc.1", "0.0.0"]), integrity: S.Boolean });
const codec = PackageManager.FromString.annotate({
  toCodecArbitrary: () => S.link<PackageManager>()(Wire, ST.transformEffect<PackageManager, typeof Wire.Type>({
    decode: (wire) => S.decodeEffect(PackageManager.FromString)(`${wire.name}@${wire.version}${wire.integrity ? "+sha512.abcdef" : ""}`).pipe(Effect.orDie),
    encode: () => Effect.die("generation-only representation"),
  })),
});
describe("PackageManager property floor", () => {
  roundTrips("PackageManager class", PackageManager, codec);
  roundTrips("PackageManager.FromString", codec);
  
  it.effect.prop("parse/stringify fidelity and canonical spelling idempotence", [Arbitrary.schema(codec)], ([value]) => Effect.gen(function* () {
    const first = yield* S.decodeEffect(PackageManager.FromString)(yield* S.encodeEffect(PackageManager.FromString)(value));
    const text = yield* S.encodeEffect(PackageManager.FromString)(first);
    const second = yield* S.decodeEffect(PackageManager.FromString)(text);
    assert.strictEqual(yield* S.encodeEffect(PackageManager.FromString)(second), text);
    assert.deepStrictEqual(second, first);
  }), runs);
});
