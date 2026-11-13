import { fcRuns } from "@beep/fc-runs";
import {
  Sha256Hex,
  Sha256HexFromBytes,
  Sha256HexFromHexBytes,
  Sha256PrefixedDigest,
  Sha256PrefixedDigestFromHex,
} from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as S from "effect/Schema";

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
      const decodedUnknownSha256HexEffect = yield* decodeUnknownSha256HexEffect(knownDigest);
      expect(decodedUnknownSha256HexEffect).toBe(knownDigest);
    })
  );

  it.effect.prop(
    "derives canonical digest examples from the source schema",
    [arbitrary],
    Effect.fnUntraced(function* ([digest]) {
      const decodedUnknownSha256HexEffect1 = yield* decodeUnknownSha256HexEffect(digest);
      expect(decodedUnknownSha256HexEffect1).toBe(digest);
      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "rejects uppercase digests",
    Effect.fnUntraced(function* () {
      const failure1 = yield* Effect.exit(decodeUnknownSha256HexEffect(Str.toUpperCase(knownDigest)));
      pipe(failure1, Exit.hasFails, assertTrue);
      if (Exit.isFailure(failure1) && Exit.hasFails(failure1)) {
        expect(pipe(failure1.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "SHA-256 digest must contain only lowercase hexadecimal characters"
        );
      }
    })
  );

  it.effect(
    "rejects digests with the wrong length",
    Effect.fnUntraced(function* () {
      const failure2 = yield* Effect.exit(decodeUnknownSha256HexEffect("abc123"));
      pipe(failure2, Exit.hasFails, assertTrue);
      if (Exit.isFailure(failure2) && Exit.hasFails(failure2)) {
        expect(pipe(failure2.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "SHA-256 digest must be exactly 64 characters long"
        );
      }
    })
  );

  it.effect(
    "rejects 64-character strings with non-hex characters",
    Effect.fnUntraced(function* () {
      const failure3 = yield* Effect.exit(decodeUnknownSha256HexEffect(`${Str.repeat("g", 63)}z`));
      pipe(failure3, Exit.hasFails, assertTrue);
      if (Exit.isFailure(failure3) && Exit.hasFails(failure3)) {
        expect(pipe(failure3.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "SHA-256 digest must contain only lowercase hexadecimal characters"
        );
      }
    })
  );
});

it.layer(BunCrypto.layer, { timeout: "5 seconds" })("Sha256HexFromBytes", (it) => {
  it.effect(
    "decodes bytes into a canonical lowercase SHA-256 hex digest",
    Effect.fnUntraced(function* () {
      const input = new TextEncoder().encode("beep");

      const decodedUnknownSha256HexFromBytes = yield* decodeUnknownSha256HexFromBytes(input);
      expect(decodedUnknownSha256HexFromBytes).toBe(knownDigest);
    })
  );

  it.effect(
    "hashes empty bytes to the canonical empty SHA-256 digest",
    Effect.fnUntraced(function* () {
      const decodedUnknownSha256HexFromBytes2 = yield* decodeUnknownSha256HexFromBytes(new Uint8Array());
      expect(decodedUnknownSha256HexFromBytes2).toBe(emptyDigest);
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

it.layer(BunCrypto.layer, { timeout: "5 seconds" })("Sha256HexFromHexBytes", (it) => {
  it.effect(
    "decodes hex-encoded bytes into a canonical lowercase SHA-256 hex digest",
    Effect.fnUntraced(function* () {
      const decodedUnknownSha256HexFromHexBytes = yield* decodeUnknownSha256HexFromHexBytes("62656570");
      expect(decodedUnknownSha256HexFromHexBytes).toBe(knownDigest);
    })
  );

  it.effect(
    "preserves hex transport validation errors",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(decodeUnknownSha256HexFromHexBytes("0"));
      pipe(result, Exit.hasFails, assertTrue);
      if (Exit.isFailure(result) && Exit.hasFails(result)) {
        expect(pipe(result.cause, Cause.findErrorOption, Option.getOrThrow).message).toContain(
          "Expected a valid hexadecimal string"
        );
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

describe("Sha256PrefixedDigest", () => {
  const arbitrary = Arbitrary.schema(Sha256PrefixedDigest);
  const decodeUnknownSha256PrefixedDigestEffect = S.decodeUnknownEffect(Sha256PrefixedDigest);
  const isSha256PrefixedDigest = S.is(Sha256PrefixedDigest);

  it.effect(
    "accepts the sha256: prefix followed by a canonical lowercase digest",
    Effect.fnUntraced(function* () {
      const digest = yield* decodeUnknownSha256PrefixedDigestEffect(`sha256:${knownDigest}`);
      expect(digest).toBe(`sha256:${knownDigest}`);
    })
  );

  it.effect.prop(
    "derives examples that match the one grammar",
    [arbitrary],
    Effect.fnUntraced(function* ([digest]) {
      const decoded = yield* decodeUnknownSha256PrefixedDigestEffect(digest);
      expect(decoded).toBe(digest);
      expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/);

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );

  it("rejects everything outside the grammar", () => {
    expect(
      A.filter(
        [
          knownDigest,
          `sha256:${Str.toUpperCase(knownDigest)}`,
          `SHA256:${knownDigest}`,
          `sha512:${knownDigest}`,
          `sha256:${Str.slice(0, 63)(knownDigest)}`,
          `sha256:${knownDigest}0`,
          `sha256:${knownDigest}\n`,
          ` sha256:${knownDigest}`,
          `sha256:v1:${knownDigest}`,
          "sha256:",
        ],
        isSha256PrefixedDigest
      )
    ).toEqual([]);
  });

  it.effect(
    "keeps a domain brand's encoded form and makes it a Sha256PrefixedDigest",
    Effect.fnUntraced(function* () {
      const ReceiptDigest = Sha256PrefixedDigest.pipe(S.brand("ReceiptDigest"));
      const receipt = yield* S.decodeEffect(ReceiptDigest)(`sha256:${emptyDigest}`);
      const general: Sha256PrefixedDigest = receipt;
      const encoded = yield* S.encodeEffect(ReceiptDigest)(receipt);

      expect(encoded).toBe(`sha256:${emptyDigest}`);
      expect(isSha256PrefixedDigest(general)).toBe(true);
      expect(S.is(ReceiptDigest)(knownDigest)).toBe(false);
    })
  );
});

describe("Sha256PrefixedDigestFromHex", () => {
  const decodeUnknownSha256PrefixedDigestFromHex = S.decodeUnknownEffect(Sha256PrefixedDigestFromHex);
  const encodeSha256PrefixedDigestFromHex = S.encodeEffect(Sha256PrefixedDigestFromHex);

  it.effect(
    "adds the prefix on decode and removes it on encode",
    Effect.fnUntraced(function* () {
      const digest = yield* decodeUnknownSha256PrefixedDigestFromHex(knownDigest);
      expect(digest).toBe(`sha256:${knownDigest}`);
      const encoded = yield* encodeSha256PrefixedDigestFromHex(digest);
      expect(encoded).toBe(knownDigest);
    })
  );

  it.effect.prop(
    "round-trips every bare digest",
    [Arbitrary.schema(Sha256Hex)],
    Effect.fnUntraced(function* ([hex]) {
      const digest = yield* decodeUnknownSha256PrefixedDigestFromHex(hex);
      expect(digest).toBe(`sha256:${hex}`);
      const encoded = yield* encodeSha256PrefixedDigestFromHex(digest);
      expect(encoded).toBe(hex);

      return true;
    }),
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "rejects an already prefixed digest and a malformed hex digest",
    Effect.fnUntraced(function* () {
      expect((yield* Effect.exit(decodeUnknownSha256PrefixedDigestFromHex(`sha256:${knownDigest}`)))._tag).toBe(
        "Failure"
      );
      expect((yield* Effect.exit(decodeUnknownSha256PrefixedDigestFromHex(Str.toUpperCase(knownDigest))))._tag).toBe(
        "Failure"
      );
    })
  );
});
