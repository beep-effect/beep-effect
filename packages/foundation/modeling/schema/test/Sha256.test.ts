import { fcRuns } from "@beep/fc-runs";
import { Sha256Hex, Sha256HexFromBytes, Sha256HexFromHexBytes } from "@beep/schema/Sha256";
import { Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeSha256Hex = S.decodeEffect(Sha256Hex);
const decodeUnknownSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeUnknownSha256HexFromHexBytes = S.decodeUnknownEffect(Sha256HexFromHexBytes);
const decodeUnknownSha256HexSync = S.decodeUnknownSync(Sha256Hex);
const encodeSha256HexFromBytes = S.encodeEffect(Sha256HexFromBytes);
const encodeSha256HexFromHexBytes = S.encodeEffect(Sha256HexFromHexBytes);

const knownDigest = "d01b7ce9154ef0264ce71e457ea81903b87a58d6cf2cd6be474886fdbc6f61d9";
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);

describe("Sha256Hex", () => {
  const arbitrary = S.toArbitrary(Sha256Hex)(fc);

  it("accepts canonical lowercase digests", () => {
    expect(decodeUnknownSha256HexSync(knownDigest)).toBe(knownDigest);
  });

  it("derives canonical digest examples from the source schema", () => {
    fc.assert(
      fc.property(arbitrary, (digest) => {
        expect(decodeUnknownSha256HexSync(digest)).toBe(digest);
        expect(digest).toHaveLength(64);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
      }),
      fcRuns(25)
    );
  });

  it("rejects uppercase digests", () => {
    expect(() => decodeUnknownSha256HexSync(Str.toUpperCase(knownDigest))).toThrow(
      "SHA-256 digest must contain only lowercase hexadecimal characters"
    );
  });

  it("rejects digests with the wrong length", () => {
    expect(() => decodeUnknownSha256HexSync("abc123")).toThrow("SHA-256 digest must be exactly 64 characters long");
  });

  it("rejects 64-character strings with non-hex characters", () => {
    expect(() => decodeUnknownSha256HexSync(`${Str.repeat("g", 63)}z`)).toThrow(
      "SHA-256 digest must contain only lowercase hexadecimal characters"
    );
  });
});

describe("Sha256HexFromBytes", () => {
  it.effect("decodes bytes into a canonical lowercase SHA-256 hex digest", () =>
    Effect.gen(function* () {
      const input = new TextEncoder().encode("beep");

      expect(yield* decodeUnknownSha256HexFromBytes(input)).toBe(knownDigest);
    }).pipe(provideBunCrypto)
  );

  it.effect("hashes empty bytes to the canonical empty SHA-256 digest", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(
          Effect.runPromise(decodeUnknownSha256HexFromBytes(new Uint8Array()).pipe(provideBunCrypto))
        ).resolves.toBe(emptyDigest)
      )
    )
  );

  it.effect("forbids encoding the digest back to source bytes", () =>
    Effect.gen(function* () {
      const digest = yield* decodeSha256Hex(knownDigest);

      expect((yield* Effect.exit(encodeSha256HexFromBytes(digest)))._tag).toBe("Failure");
    })
  );
});

describe("Sha256HexFromHexBytes", () => {
  it.effect("decodes hex-encoded bytes into a canonical lowercase SHA-256 hex digest", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(Effect.runPromise(decodeUnknownSha256HexFromHexBytes("62656570").pipe(provideBunCrypto))).resolves.toBe(
          knownDigest
        )
      )
    )
  );

  it.effect("preserves hex transport validation errors", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(Effect.runPromise(decodeUnknownSha256HexFromHexBytes("0").pipe(provideBunCrypto))).rejects.toThrow(
          "Expected a valid hexadecimal string"
        )
      )
    )
  );

  it.effect("forbids encoding the digest back to source hex bytes", () =>
    Effect.gen(function* () {
      const digest = yield* decodeSha256Hex(knownDigest);

      expect((yield* Effect.exit(encodeSha256HexFromHexBytes(digest)))._tag).toBe("Failure");
    })
  );
});
