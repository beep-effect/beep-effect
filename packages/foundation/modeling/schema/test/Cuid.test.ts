import { fcRuns } from "@beep/fc-runs";
import { Cuid, CuidSeed, CuidState, cuid, sha512 } from "@beep/schema/Cuid";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { Effect, Encoding, Layer } from "effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const encodeCuidEffect = S.encodeEffect(Cuid);
const encodeCuidSeedEffect = S.encodeEffect(CuidSeed);
const isCuid = S.is(Cuid);

const beepSha512Digest =
  "e6d9beb966c28eeb50c7162bbe1329b4ab3334ee1b2d3df4bd44334430347c0db4cbf8202a414e795cdc2facd37b3eb4ee8d8550969441dfecf8df4cdf582e03";
const CuidTestLayer = CuidState.Default.pipe(Layer.provideMerge(BunCrypto.layer));

describe("Cuid", () => {
  it.layer(CuidTestLayer, { timeout: "5 seconds" })((it) => {
    it.effect(
      "computes SHA-512 with the platform Crypto service",
      Effect.fnUntraced(function* () {
        const digest = yield* sha512(new TextEncoder().encode("beep"));
        expect(Encoding.encodeHex(digest)).toBe(beepSha512Digest);
      })
    );

    it.effect(
      "generates CUID values with explicit platform crypto",
      Effect.fnUntraced(function* () {
        const id = yield* cuid;
        expect(isCuid(id)).toBe(true);
      })
    );
  });

  {
    const arbitrary = Arbitrary.schema(Cuid);
    it.effect.prop(
      "derives valid CUIDs from the schema arbitrary",
      [arbitrary],
      Effect.fnUntraced(function* ([id]) {
        expect(Cuid.is(id)).toBe(true);
        expect(yield* encodeCuidEffect(id)).toBe(id);

        return true;
      }),
      { arbitrary: fcRuns(25) }
    );
  }

  it.effect(
    "keeps CuidSeed encoded shape byte-identical",
    Effect.fnUntraced(function* () {
      const random = new Uint8Array([1, 2, 3, 4]);
      const seed = CuidSeed.make({
        timestamp: 1,
        counter: 0,
        random,
        fingerprint: "beep",
      });

      expect(yield* encodeCuidSeedEffect(seed)).toEqual({
        timestamp: 1,
        counter: 0,
        random,
        fingerprint: "beep",
      });
    })
  );
});
