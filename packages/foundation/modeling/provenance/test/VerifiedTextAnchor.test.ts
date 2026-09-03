import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifiedSourceText,
  VerifiedTextAnchor,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  VerifyTextAnchorInput,
  verifySourceTextIdentity,
  verifyTextAnchor,
  verifyTextAnchorAgainstVerifiedSource,
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
const replacementCharacterDigest = SourceTextDigest.make(
  "sha256:83d544ccc223c057d2bf80d3f2a32982c32c3c0db8e2674820da5064783fb097"
);
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
    "verifies a source manifestation independently of any anchor",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });

      const verifiedSource = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: source,
          source,
          sourceText: "fact",
        })
      );

      expect(S.is(VerifiedSourceText)(verifiedSource)).toBe(true);
      expect(verifiedSource.source).toEqual(source);
      expect(verifiedSource.sourceText).toBe("fact");
    }, provideBunCrypto)
  );

  it.effect(
    "snapshots source authority before the asynchronous digest boundary",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });
      const MutatingCrypto = Layer.succeed(
        Crypto.Crypto,
        Crypto.make({
          digest: (algorithm, data) =>
            Effect.sync(() => Reflect.set(source, "scopeRef", "matter:mutated")).pipe(
              Effect.andThen(
                Effect.tryPromise({
                  catch: (cause) =>
                    PlatformError.systemError({
                      _tag: "Unknown",
                      cause,
                      description: "Could not compute mutating fixture digest",
                      method: "digest",
                      module: "VerifiedTextAnchorTest",
                    }),
                  try: () =>
                    globalThis.crypto.subtle
                      .digest(algorithm, new Uint8Array(data))
                      .then((buffer) => new Uint8Array(buffer)),
                })
              )
            ),
          randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
        })
      );
      const verified = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText: "fact" })
      ).pipe(provideScopedLayer(MutatingCrypto));

      expect(source.scopeRef).toBe("matter:mutated");
      expect(verified.source.scopeRef).toBe("matter:example");
      expect(verified.sourceText).toBe("fact");
    })
  );

  it.effect(
    "reuses one verified source proof across exact anchors",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });
      const verifiedSource = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText: "fact" })
      );
      const verified = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          verifiedSource,
        })
      );
      const failure = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fake", startChar: 0 }),
          verifiedSource,
        })
      ).pipe(Effect.flip);

      expect(verified.anchor.quote).toBe("fact");
      expect(verified.source).toEqual(source);
      expect(failure.reason).toBe("quote-mismatch");
      expect(Reflect.set(verifiedSource, "sourceText", "fake")).toBe(false);
      expect(() => globalThis.Object.defineProperty(verifiedSource, "sourceText", { value: "fake" })).toThrow();
      expect(() =>
        globalThis.Object.defineProperty(globalThis.Object.getPrototypeOf(verifiedSource), "sourceText", {
          value: "fake",
        })
      ).toThrow();
      expect(Reflect.set(verifiedSource.source, "sourceRef", "source:mutated")).toBe(true);
      expect(Reflect.set(verifiedSource.source.extractor, "version", "2")).toBe(true);
      expect(Reflect.set(verified.anchor, "quote", "fake")).toBe(true);
      expect(Reflect.set(verified.source, "sourceRef", "source:mutated")).toBe(true);
      expect(S.is(VerifiedSourceText)(verifiedSource)).toBe(true);
      expect(S.is(VerifiedTextAnchor)(verified)).toBe(true);
      expect(verifiedSource.sourceText).toBe("fact");
      expect(verified.anchor.quote).toBe("fact");
      expect(verified.source.sourceRef).toBe("source:example");
    }, provideBunCrypto)
  );

  it.effect(
    "rejects proofs constructed through recovered constructors",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: factDigest });
      const verifiedSource = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText: "fact" })
      );
      const verified = yield* verifyTextAnchorAgainstVerifiedSource(
        VerifyTextAnchorAgainstVerifiedSourceInput.make({
          anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
          verifiedSource,
        })
      );
      const counterfeitSource = Reflect.construct(verifiedSource.constructor, []);
      const counterfeitAnchor = Reflect.construct(verified.constructor, []);
      const forgedInput = VerifyTextAnchorAgainstVerifiedSourceInput.make({
        anchor: decodeTextAnchor({ endChar: 4, quote: "fact", startChar: 0 }),
        verifiedSource,
      });

      expect(S.is(VerifiedSourceText)(counterfeitSource)).toBe(false);
      expect(S.is(VerifiedTextAnchor)(counterfeitAnchor)).toBe(false);
      expect(() => Reflect.get(counterfeitSource, "source")).toThrow();
      expect(() => Reflect.get(counterfeitSource, "sourceText")).toThrow();
      expect(() => Reflect.get(counterfeitAnchor, "anchor")).toThrow();
      expect(() => Reflect.get(counterfeitAnchor, "source")).toThrow();
      expect(() => Reflect.apply(toTextAnchorVerificationReceipt, undefined, [counterfeitAnchor])).toThrow();
      expect(Reflect.set(forgedInput, "verifiedSource", counterfeitSource)).toBe(true);
      const forgedInputFailure = yield* verifyTextAnchorAgainstVerifiedSource(forgedInput).pipe(Effect.flip);
      expect(forgedInputFailure.reason).toBe("stale-source");
      expect(() => globalThis.Object.getOwnPropertyDescriptor(verifiedSource, "sourceText")).not.toThrow();
      expect(() => globalThis.Object.defineProperty(verified, "anchor", { value: verified.anchor })).toThrow();
      expect(() =>
        globalThis.Object.defineProperty(globalThis.Object.getPrototypeOf(verified), "anchor", {
          value: verified.anchor,
        })
      ).toThrow();
    }, provideBunCrypto)
  );

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
    "rejects lone UTF-16 surrogates without conflating them with the replacement character",
    Effect.fnUntraced(function* () {
      const source = identity({ textDigest: replacementCharacterDigest });
      const failures = yield* Effect.forEach(["\ud800", "\udc00"], (sourceText) =>
        verifySourceTextIdentity(
          VerifySourceTextIdentityInput.make({
            expectedSource: source,
            source,
            sourceText,
          })
        ).pipe(Effect.flip)
      );
      const replacement = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({
          expectedSource: source,
          source,
          sourceText: "\ufffd",
        })
      );

      expect(failures.map(({ reason }) => reason)).toEqual(["stale-source", "stale-source"]);
      expect(replacement.sourceText).toBe("\ufffd");
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
      const decodedReceipt = yield* S.decodeEffect(TextAnchorVerificationReceipt)(encoded);
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
      fc.property(S.toArbitrary(SourceTextIdentity)(fc), (source) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(SourceTextIdentity)(source));
        const decoded = Result.getOrThrow(S.decodeResult(SourceTextIdentity)(encoded));

        expect(S.toEquivalence(SourceTextIdentity)(decoded, source)).toBe(true);
      }),
      fcRuns(25)
    ));
});
