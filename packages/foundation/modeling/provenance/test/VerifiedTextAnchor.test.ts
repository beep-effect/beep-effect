import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifiedTextAnchor,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, it } from "@effect/vitest";
import { Effect, flow, Layer, Result } from "effect";
import * as Crypto from "effect/Crypto";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const emptyDigest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const alternateDigest = SourceTextDigest.make(
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
);
const factDigest = SourceTextDigest.make("sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca");
const surrogateDigest = SourceTextDigest.make(
  "sha256:aacfb6637bd0df2238641c5b15898d1a61df3157b1d0b4099f590fc0b0b6fbbd"
);
const extractor = SourceTextExtractor.make({ name: "utf8", version: "1" });
const decodeTextAnchor = flow(S.decodeUnknownResult(TextAnchor), Result.getOrThrow);
const provideBunCrypto = provideScopedLayer(BunCrypto.layer);

const identity = (overrides: Partial<SourceTextIdentity> = {}): SourceTextIdentity =>
  SourceTextIdentity.make({
    extractor,
    locator: PosixPath.make("documents/source.txt"),
    normalizationVersion: "1",
    scopeRef: "matter:example",
    sourceDigest: emptyDigest,
    sourceRef: "source:example",
    textDigest: emptyDigest,
    ...overrides,
  });

describe("@beep/provenance VerifiedTextAnchor", () => {
  it.effect(
    "binds an exact raw UTF-16 slice to its source identity",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: surrogateDigest });
      const verified = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 3, quote: "😀", startChar: 1 }),
          expectedSource: source,
          source,
          sourceText: "A😀B",
        })
      );

      expect(verified.anchor.quote).toBe("😀");
      expect(verified.source).toEqual(source);
      expect(S.is(VerifiedTextAnchor)(verified)).toBe(true);
    }, provideBunCrypto)
  );

  it.effect(
    "fails cross-scope identities before considering them stale",
    Effect.fnUntraced(function* () {
      const expectedSource = identity();
      const failure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          expectedSource,
          source: identity({ scopeRef: "matter:other" }),
          sourceText: "fact",
        })
      ).pipe(Effect.flip);

      expect(failure.reason).toBe("cross-scope");
    }, provideBunCrypto)
  );

  it.effect(
    "fails digest and extractor-version drift without rewriting the expected identity",
    Effect.fnUntraced(function* () {
      const expectedSource = identity();
      const digestFailure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          expectedSource,
          source: identity({ textDigest: alternateDigest }),
          sourceText: "fact",
        })
      ).pipe(Effect.flip);
      const versionFailure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          expectedSource,
          source: identity({ extractor: SourceTextExtractor.make({ name: "utf8", version: "2" }) }),
          sourceText: "fact",
        })
      ).pipe(Effect.flip);

      expect(digestFailure.reason).toBe("stale-source");
      expect(versionFailure.reason).toBe("stale-source");
      expect(expectedSource.textDigest).toBe(emptyDigest);
      expect(expectedSource.extractor.version).toBe("1");
    }, provideBunCrypto)
  );

  it.effect(
    "rejects raw source text whose digest differs from the resolved identity",
    Effect.fnUntraced(function* () {
      const source = identity();
      const failure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          expectedSource: source,
          source,
          sourceText: "fact",
        })
      ).pipe(Effect.flip);

      expect(failure.reason).toBe("stale-source");
      expect(failure.message).not.toContain("fact");
      expect(failure.message).not.toContain(emptyDigest);
    }, provideBunCrypto)
  );

  it.effect(
    "sanitizes source-text digest failures",
    Effect.fnUntraced(
      function* () {
        const source = identity({ textDigest: factDigest });
        const failure = yield* verifyTextAnchor(
          VerifyTextAnchorInput.make({
            anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
            expectedSource: source,
            source,
            sourceText: "fact",
          })
        ).pipe(Effect.flip);

        expect(failure.reason).toBe("stale-source");
        expect(failure.message).toBe("Verified text anchor rejected: stale-source.");
      },
      provideScopedLayer(
        Layer.succeed(
          Crypto.Crypto,
          Crypto.make({
            digest: () =>
              Effect.fail(
                PlatformError.systemError({
                  _tag: "Unknown",
                  method: "digest",
                  module: "VerifiedTextAnchorTest",
                })
              ),
            randomBytes: (size) => new Uint8Array(size),
          })
        )
      )
    )
  );

  it.effect(
    "rejects offsets that split a surrogate pair",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: surrogateDigest });
      const failure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 2, quote: "\ud83d", startChar: 1 }),
          expectedSource: source,
          source,
          sourceText: "A😀B",
        })
      ).pipe(Effect.flip);

      expect(failure.reason).toBe("invalid-anchor");
    }, provideBunCrypto)
  );

  it.effect(
    "rejects a quote that differs from the exact raw slice",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });
      const failure = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fake", startChar: 0 }),
          expectedSource: source,
          source,
          sourceText: "fact",
        })
      ).pipe(Effect.flip);

      expect(failure.reason).toBe("quote-mismatch");
    }, provideBunCrypto)
  );

  it.effect(
    "converts runtime proof to a round-trippable receipt without granting proof on decode",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });
      const verified = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          expectedSource: source,
          source,
          sourceText: "fact",
        })
      );
      const receipt = toTextAnchorVerificationReceipt(verified);
      const encoded = yield* S.encodeUnknownEffect(TextAnchorVerificationReceipt)(receipt);
      const decodedReceipt = yield* S.decodeUnknownEffect(TextAnchorVerificationReceipt)(encoded);
      const verificationFailure = yield* S.decodeUnknownEffect(VerifiedTextAnchor)(encoded).pipe(Effect.flip);
      const receiptIsNotVerified: TextAnchorVerificationReceipt extends VerifiedTextAnchor ? false : true = true;

      expect(encoded).toEqual({ anchor: verified.anchor, source: verified.source });
      expect(S.toEquivalence(TextAnchorVerificationReceipt)(decodedReceipt, receipt)).toBe(true);
      expect(S.is(VerifiedTextAnchor)(decodedReceipt)).toBe(false);
      expect(receiptIsNotVerified).toBe(true);
      expect(verificationFailure.message).toContain("VerifiedTextAnchor");
    }, provideBunCrypto)
  );

  it("derives constructive arbitrary source identities from the schema", () =>
    fc.assert(
      fc.property(S.toArbitrary(SourceTextIdentity), (source) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(SourceTextIdentity)(source));
        const decoded = Result.getOrThrow(S.decodeUnknownResult(SourceTextIdentity)(encoded));

        expect(S.toEquivalence(SourceTextIdentity)(decoded, source)).toBe(true);
      }),
      fcRuns(25)
    ));
});
