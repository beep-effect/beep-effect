import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeWire } from "../../../effected/package-json/internal/wire.ts";

const runs = { arbitrary: fcRuns(100) };

// Rest keys are disjoint from typed fields: collisions deliberately normalize
// to the typed member and therefore are not in the codec's identity domain.
const Extras = S.Record(
  S.String.check(S.isPattern(/^(?:x-[a-z]+|__proto__|constructor|rest)$/)),
  S.Json,
);

class Manifest extends S.Class<Manifest>("WirePropertyManifest")({
  name: S.String,
  size: S.BigIntFromString,
  rest: Extras,
}) {}

class ExtendedManifest extends Manifest.extend<ExtendedManifest>("WirePropertyExtendedManifest")({
  enabled: S.Boolean,
}) {}

class CollidingManifest extends S.Class<CollidingManifest>("WireCollisionManifest")({
  name: S.String,
  size: S.BigIntFromString,
  enabled: S.Boolean,
  rest: S.Record(S.String, S.Json),
}) {}

const manifestWire = makeWire(Manifest);
const extendedWire = makeWire(ExtendedManifest);
const collisionWire = makeWire(CollidingManifest);

describe("makeWire property floor", () => {
  it.effect.prop(
    "base codec decodes every encoding to an equivalent class value",
    [Arbitrary.schema(manifestWire)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(manifestWire)(value);
      const decoded = yield* S.decodeEffect(manifestWire)(encoded);
      assertTrue(S.toEquivalence(Manifest)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(manifestWire)(decoded), encoded);
    }),
    runs,
  );

  it.effect.prop(
    "extended codec decodes every encoding including subclass fields",
    [Arbitrary.schema(extendedWire)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(extendedWire)(value);
      const decoded = yield* S.decodeEffect(extendedWire)(encoded);
      assertTrue(S.toEquivalence(ExtendedManifest)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(extendedWire)(decoded), encoded);
    }),
    runs,
  );

  it.effect.prop(
    "unknown JSON keys survive decode, a typed-field edit and re-encoding",
    [Arbitrary.schema(extendedWire), Arbitrary.schema(S.String)],
    ([value, name]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(extendedWire)(value);
      const decoded = yield* S.decodeEffect(extendedWire)(encoded);
      const edited = ExtendedManifest.make({ ...decoded, name });
      const written = yield* S.encodeEffect(extendedWire)(edited);
      assert.deepStrictEqual(written, { ...encoded, name });
      const reread = yield* S.decodeEffect(extendedWire)(written);
      assert.deepStrictEqual(reread.rest, decoded.rest);
      assert.strictEqual(reread.name, name);
    }),
    runs,
  );

  it.effect.prop(
    "typed base and subclass members win over colliding rest values",
    [Arbitrary.schema(extendedWire), Arbitrary.schema(S.Json)],
    ([value, collision]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(extendedWire)(value);
      // Feed collisions through a broad rest schema to test the factory's
      // precedence independently of the identity-domain key restriction.
      const colliding = CollidingManifest.make({
        name: value.name,
        size: value.size,
        enabled: value.enabled,
        rest: { ...value.rest, name: collision, size: collision, enabled: collision },
      });
      assert.deepStrictEqual(yield* S.encodeEffect(collisionWire)(colliding), encoded);
    }),
    runs,
  );

  it.effect.prop(
    "an own __proto__ JSON key survives partitioning and flattening as data",
    [Arbitrary.schema(extendedWire), Arbitrary.schema(S.Json)],
    ([value, extra]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(extendedWire)(value);
      const raw = { ...encoded, ["__proto__"]: extra };
      const decoded = yield* S.decodeEffect(extendedWire)(raw);
      assert.deepStrictEqual(decoded.rest["__proto__"], extra);
      assert.deepStrictEqual(yield* S.encodeEffect(extendedWire)(decoded), raw);
    }),
    runs,
  );
});
