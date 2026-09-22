import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CaptureSource,
  Geolocation,
  GeolocationInput,
  GeolocationInputWire,
  GeolocationWire,
  geolocationFromPrivateHeader,
  validatedGeolocationOrNone,
} from "../../beep/Geolocation.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Geolocation", () => {
  it("bounds a server coordinate and accepts an unbounded input", () => {
    const point = decode(GeolocationWire, { latitude: 47.6, longitude: -122.3, accuracy: null, google_place_id: null });
    assert.strictEqual(point.latitude, 47.6);
    assert.strictEqual(O.isNone(point.accuracy), true);
    assert.strictEqual(O.isNone(point.googlePlaceId), true);
    const missing = decode(GeolocationWire, { latitude: 1, longitude: 2 });
    assert.strictEqual(O.isNone(missing.address), true);
    assert.strictEqual(fails(GeolocationWire, { latitude: 91, longitude: 0 }), true);
    const wide = decode(GeolocationInputWire, { latitude: 1000, longitude: 0, altitude: null });
    assert.strictEqual(wide.latitude, 1000);
    assert.strictEqual(O.isNone(wide.altitude), true);
  });

  it("drops invalid points and headers without logging them", () => {
    const wide = decode(GeolocationInputWire, { latitude: 1000, longitude: 0 });
    assert.strictEqual(O.isNone(validatedGeolocationOrNone(O.none())), true);
    assert.strictEqual(O.isNone(validatedGeolocationOrNone(O.some(wide))), true);
    const kept = decode(GeolocationInputWire, { latitude: 1, longitude: 2 });
    assert.strictEqual(O.isSome(validatedGeolocationOrNone(O.some(kept))), true);
    assert.strictEqual(O.isSome(Effect.runSync(geolocationFromPrivateHeader('{"latitude":1,"longitude":2}'))), true);
    assert.strictEqual(O.isNone(Effect.runSync(geolocationFromPrivateHeader(""))), true);
    assert.strictEqual(O.isNone(Effect.runSync(geolocationFromPrivateHeader(1))), true);
    assert.strictEqual(O.isNone(Effect.runSync(geolocationFromPrivateHeader("{"))), true);
    assert.strictEqual(O.isNone(Effect.runSync(geolocationFromPrivateHeader('{"latitude":1000,"longitude":0}'))), true);
    assert.strictEqual(O.isNone(Effect.runSync(geolocationFromPrivateHeader("x".repeat(4097)))), true);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [CaptureSource, Geolocation, GeolocationInput]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
