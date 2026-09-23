import { fcRuns } from "@beep/fc-runs";
import { Sha256Hex, Sha256HexFromBytes, Sha256HexFromHexBytes } from "@beep/schema/Sha256";
import { Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeSha256Hex = S.decodeEffect(Sha256Hex);
const decodeUnknownSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeUnknownSha256HexFromHexBytes = S.decodeUnknownEffect(Sha256HexFromHexBytes);
const decodeUnknownSha256HexEffect = S.decodeUnknownEffect(Sha256Hex);
const encodeSha256HexFromBytes = S.encodeEffect(Sha256HexFromBytes);
const encodeSha256HexFromHexBytes = S.encodeEffect(Sha256HexFromHexBytes);

const knownDigest = "d01b7ce9154ef0264ce71e457ea81903b87a58d6cf2cd6be474886fdbc6f61d9";
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("Sha256Hex", () => {
  const arbitrary = Arbitrary.schema(Sha256Hex);

  it.effect(
    "accepts canonical lowercase digests",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownSha256HexEffect(knownDigest)).toBe(knownDigest);
    })
  );

  it.effect.prop(
    "derives canonical digest examples from the source schema",
    [arbitrary],
    Effect.fnUntraced(function* ([digest]) {
      expect(yield* decodeUnknownSha256HexEffect(digest)).toBe(digest);
      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "rejects uppercase digests",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.result(decodeUnknownSha256HexEffect(Str.toUpperCase(knownDigest)));
      expect(Result.isFailure(failure1)).toBe(true);
      if (Result.isFailure(failure1)) {
        expect(failure1.failure.message).toContain("SHA-256 digest must contain only lowercase hexadecimal characters");
      }
    })
  );

  it.effect(
    "rejects digests with the wrong length",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.result(decodeUnknownSha256HexEffect("abc123"));
      expect(Result.isFailure(failure2)).toBe(true);
      if (Result.isFailure(failure2)) {
        expect(failure2.failure.message).toContain("SHA-256 digest must be exactly 64 characters long");
      }
    })
  );

  it.effect(
    "rejects 64-character strings with non-hex characters",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.result(decodeUnknownSha256HexEffect(`${Str.repeat("g", 63)}z`));
      expect(Result.isFailure(failure3)).toBe(true);
      if (Result.isFailure(failure3)) {
        expect(failure3.failure.message).toContain("SHA-256 digest must contain only lowercase hexadecimal characters");
      }
    })
  );
});

it.layer(BunCrypto.layer)("Sha256HexFromBytes", (it) => {
  it.effect(
    "decodes bytes into a canonical lowercase SHA-256 hex digest",
    Effect.fnUntraced(function* () {
      const input = new TextEncoder().encode("beep");

      expect(yield* decodeUnknownSha256HexFromBytes(input)).toBe(knownDigest);
    })
  );

  it.effect(
    "hashes empty bytes to the canonical empty SHA-256 digest",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownSha256HexFromBytes(new Uint8Array())).toBe(emptyDigest);
    })
  );

  it.effect(
    "forbids encoding the digest back to source bytes",
    Effect.fnUntraced(function* () {
      const digest = yield* decodeSha256Hex(knownDigest);

      expect((yield* Effect.exit(encodeSha256HexFromBytes(digest)))._tag).toBe("Failure");
    })
  );
});

it.layer(BunCrypto.layer)("Sha256HexFromHexBytes", (it) => {
  it.effect(
    "decodes hex-encoded bytes into a canonical lowercase SHA-256 hex digest",
    Effect.fnUntraced(function* () {
      expect(yield* decodeUnknownSha256HexFromHexBytes("62656570")).toBe(knownDigest);
    })
  );

  it.effect(
    "preserves hex transport validation errors",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.result(decodeUnknownSha256HexFromHexBytes("0"));
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.message).toContain("Expected a valid hexadecimal string");
      }
    })
  );

  it.effect(
    "forbids encoding the digest back to source hex bytes",
    Effect.fnUntraced(function* () {
      const digest = yield* decodeSha256Hex(knownDigest);

      expect((yield* Effect.exit(encodeSha256HexFromHexBytes(digest)))._tag).toBe("Failure");
    })
  );
});
