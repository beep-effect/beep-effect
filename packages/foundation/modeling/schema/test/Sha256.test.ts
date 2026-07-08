import { Sha256Hex, Sha256HexFromBytes, Sha256HexFromHexBytes } from "@beep/schema/Sha256";
import { Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const knownDigest = "d01b7ce9154ef0264ce71e457ea81903b87a58d6cf2cd6be474886fdbc6f61d9";
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const provideBunCrypto = provideScopedLayer(BunCrypto.layer);

describe("Sha256Hex", () => {
  const decode = S.decodeUnknownSync(Sha256Hex);
  const arbitrary = S.toArbitrary(Sha256Hex);

  it("accepts canonical lowercase digests", () => {
    expect(decode(knownDigest)).toBe(knownDigest);
  });

  it("derives canonical digest examples from the source schema", () => {
    fc.assert(
      fc.property(arbitrary, (digest) => {
        expect(decode(digest)).toBe(digest);
        expect(digest).toHaveLength(64);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 25 }
    );
  });

  it("rejects uppercase digests", () => {
    expect(() => decode(Str.toUpperCase(knownDigest))).toThrow(
      "SHA-256 digest must contain only lowercase hexadecimal characters"
    );
  });

  it("rejects digests with the wrong length", () => {
    expect(() => decode("abc123")).toThrow("SHA-256 digest must be exactly 64 characters long");
  });

  it("rejects 64-character strings with non-hex characters", () => {
    expect(() => decode(`${Str.repeat("g", 63)}z`)).toThrow(
      "SHA-256 digest must contain only lowercase hexadecimal characters"
    );
  });
});

describe("Sha256HexFromBytes", () => {
  const decode = S.decodeUnknownEffect(Sha256HexFromBytes);
  const encode = S.encodeEffect(Sha256HexFromBytes);

  it("decodes bytes into a canonical lowercase SHA-256 hex digest", () =>
    Effect.gen(function* () {
      const input = new TextEncoder().encode("beep");

      expect(yield* decode(input)).toBe(knownDigest);
    }).pipe(provideBunCrypto));

  it("hashes empty bytes to the canonical empty SHA-256 digest", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(Effect.runPromise(decode(new Uint8Array()).pipe(provideBunCrypto))).resolves.toBe(emptyDigest)
      )
    ));

  it("forbids encoding the digest back to source bytes", () =>
    Effect.gen(function* () {
      const digest = yield* S.decodeUnknownEffect(Sha256Hex)(knownDigest);

      expect((yield* Effect.exit(encode(digest)))._tag).toBe("Failure");
    }));
});

describe("Sha256HexFromHexBytes", () => {
  const decode = S.decodeUnknownEffect(Sha256HexFromHexBytes);
  const encode = S.encodeEffect(Sha256HexFromHexBytes);

  it("decodes hex-encoded bytes into a canonical lowercase SHA-256 hex digest", () =>
    Effect.promise(() =>
      Promise.resolve(expect(Effect.runPromise(decode("62656570").pipe(provideBunCrypto))).resolves.toBe(knownDigest))
    ));

  it("preserves hex transport validation errors", () =>
    Effect.promise(() =>
      Promise.resolve(
        expect(Effect.runPromise(decode("0").pipe(provideBunCrypto))).rejects.toThrow(
          "Length must be a multiple of 2, but is 1"
        )
      )
    ));

  it("forbids encoding the digest back to source hex bytes", () =>
    Effect.gen(function* () {
      const digest = yield* S.decodeUnknownEffect(Sha256Hex)(knownDigest);

      expect((yield* Effect.exit(encode(digest)))._tag).toBe("Failure");
    }));
});
