import { fcRuns } from "@beep/fc-runs";
import { Cuid, CuidSeed, CuidState, cuid, sha512 } from "@beep/schema/Cuid";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Encoding, Layer } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const beepSha512Digest =
  "e6d9beb966c28eeb50c7162bbe1329b4ab3334ee1b2d3df4bd44334430347c0db4cbf8202a414e795cdc2facd37b3eb4ee8d8550969441dfecf8df4cdf582e03";
const CuidTestLayer = CuidState.Default.pipe(Layer.provideMerge(BunCrypto.layer));

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("Cuid", () => {
  it.effect("computes SHA-512 with the platform Crypto service", () =>
    Effect.gen(function* () {
      const digest = yield* sha512(new TextEncoder().encode("beep"));
      expect(Encoding.encodeHex(digest)).toBe(beepSha512Digest);
    }).pipe(provideScopedLayer(BunCrypto.layer))
  );

  it.effect("generates CUID values with explicit platform crypto", () =>
    Effect.gen(function* () {
      const id = yield* cuid;
      expect(S.is(Cuid)(id)).toBe(true);
    }).pipe(provideScopedLayer(CuidTestLayer))
  );

  it("derives valid CUIDs from the schema arbitrary", () => {
    const arbitrary = S.toArbitrary(Cuid)(fc);

    fc.assert(
      fc.property(arbitrary, (id) => {
        expect(Cuid.is(id)).toBe(true);
        expect(S.encodeSync(Cuid)(id)).toBe(id);
      }),
      fcRuns(25)
    );
  });

  it("keeps CuidSeed encoded shape byte-identical", () => {
    const random = new Uint8Array([1, 2, 3, 4]);
    const seed = CuidSeed.make({
      timestamp: 1,
      counter: 0,
      random,
      fingerprint: "beep",
    });

    expect(S.encodeSync(CuidSeed)(seed)).toEqual({
      timestamp: 1,
      counter: 0,
      random,
      fingerprint: "beep",
    });
  });
});
