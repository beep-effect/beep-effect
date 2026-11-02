import { CitationMentionId } from "@beep/law-practice-domain/values";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationMentionIdentityInput, makeCitationMentionId } from "../src/internal/Citation/MentionIdentity.ts";

const sourceText = "😀 1 U.S. 1; 1 U.S. 1";
const artifact = Sha256Hex.make("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const otherArtifact = Sha256Hex.make("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
const artifactDigest = SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`);
const encoder = new TextEncoder();
const sourceIdentity = Effect.fn("CitationIdentityTest.source")(function* (
  text: string,
  overrides: Partial<SourceTextIdentity> = {}
) {
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(text));
  return SourceTextIdentity.make({
    scopeRef: "matter:example",
    sourceRef: "source:example",
    locator: PosixPath.make("documents/source.txt"),
    sourceDigest: artifactDigest,
    textDigest: SourceTextDigest.make(`sha256:${digest}`),
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
    ...overrides,
  });
});
const verifiedAnchor = Effect.fn("CitationIdentityTest.anchor")(function* (
  text: string,
  startChar: number,
  source: SourceTextIdentity
) {
  return yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      source,
      expectedSource: source,
      sourceText: text,
      anchor: TextAnchor.make({ startChar, endChar: startChar + 8, quote: "1 U.S. 1" }),
    })
  );
});

it.layer(BunCrypto.layer)("citation occurrence identity production", (it) => {
  it.effect("matches the independently computed cm1 protocol vector and ignores input property order", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const first = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" });
      const reordered = yield* makeCitationMentionId({ semanticKind: "case", engineArtifact: artifact, anchor });
      expect(first).toBe("cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9");
      expect(reordered).toBe(first);
      expect(S.is(CitationMentionId)(first)).toBe(true);
    })
  );

  it.effect("keeps identities stable under replay and consumer ordering while separating repeated quotes", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchors = yield* Effect.forEach([3, 13], (start) => verifiedAnchor(sourceText, start, source));
      const inputs = A.map(anchors, (anchor) =>
        CitationMentionIdentityInput.make({ anchor, engineArtifact: artifact, semanticKind: "case" })
      );
      const forward = yield* Effect.forEach(inputs, makeCitationMentionId);
      const reverse = yield* Effect.forEach(A.reverse(inputs), makeCitationMentionId);
      expect(reverse).toEqual(A.reverse(forward));
      expect(A.dedupe(forward).length).toBe(2);
      expect(yield* Effect.forEach(inputs, makeCitationMentionId)).toEqual(forward);
    })
  );

  it.effect("binds every source-identity field, engine artifact, semantic kind and exact quote", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const baseline = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" });
      const overrides: ReadonlyArray<Partial<SourceTextIdentity>> = [
        { scopeRef: "matter:other" },
        { sourceRef: "source:other" },
        { locator: PosixPath.make("documents/other.txt") },
        { sourceDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("b")}`) },
        { extractor: SourceTextExtractor.make({ name: "other", version: "1" }) },
        { extractor: SourceTextExtractor.make({ name: "utf8", version: "2" }) },
        { normalizationVersion: "2" },
      ];
      const changedSources = yield* Effect.forEach(overrides, (override) =>
        Effect.gen(function* () {
          const changed = yield* sourceIdentity(sourceText, override);
          const proof = yield* verifiedAnchor(sourceText, 3, changed);
          return yield* makeCitationMentionId({ anchor: proof, engineArtifact: artifact, semanticKind: "case" });
        })
      );
      const changedText = `${sourceText}!`;
      const changedTextSource = yield* sourceIdentity(changedText);
      const changedAnchor = yield* verifiedAnchor(changedText, 3, changedTextSource);
      const variants = [
        ...changedSources,
        yield* makeCitationMentionId({ anchor: changedAnchor, engineArtifact: artifact, semanticKind: "case" }),
        yield* makeCitationMentionId({ anchor, engineArtifact: otherArtifact, semanticKind: "case" }),
        yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "id" }),
      ];
      expect(A.every(variants, (value) => value !== baseline)).toBe(true);
      expect(A.dedupe(variants).length).toBe(variants.length);
    })
  );

  it.effect("rejects structural receipts and malformed input without retaining source or schema issues", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const receipt = toTextAnchorVerificationReceipt(anchor);
      const wire = yield* S.encodeEffect(S.fromJsonString(TextAnchorVerificationReceipt))(receipt);
      const restored = yield* S.decodeEffect(S.fromJsonString(TextAnchorVerificationReceipt))(wire);
      for (const input of [
        { anchor: receipt, engineArtifact: artifact, semanticKind: "case" },
        { anchor: restored, engineArtifact: artifact, semanticKind: "case" },
        { anchor: { ...receipt }, engineArtifact: artifact, semanticKind: "case" },
        { anchor, engineArtifact: "unversioned", semanticKind: "case" },
        { anchor, engineArtifact: artifact, semanticKind: "" },
        { anchor, engineArtifact: artifact, semanticKind: Str.repeat(129)("a") },
      ]) {
        const failure = yield* makeCitationMentionId(input).pipe(Effect.flip);
        expect(failure.reason).toBe("invalid-input");
        expect("cause" in failure).toBe(false);
        expect(failure.message).not.toContain("1 U.S.");
      }
      const reverified = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({ ...restored, expectedSource: source, sourceText })
      );
      expect(yield* makeCitationMentionId({ anchor: reverified, engineArtifact: artifact, semanticKind: "case" })).toBe(
        yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" })
      );
    })
  );

  it.effect("separates delimiter-bearing identity fields and snapshots before asynchronous hashing", () =>
    Effect.gen(function* () {
      const firstSource = yield* sourceIdentity(sourceText, { scopeRef: "matter:a|b", sourceRef: "c" });
      const secondSource = yield* sourceIdentity(sourceText, { scopeRef: "matter:a", sourceRef: "b|c" });
      const firstAnchor = yield* verifiedAnchor(sourceText, 3, firstSource);
      const secondAnchor = yield* verifiedAnchor(sourceText, 3, secondSource);
      const input = { anchor: firstAnchor, engineArtifact: artifact, semanticKind: "case" };
      const baseline = yield* makeCitationMentionId(input);
      const other = yield* makeCitationMentionId({
        anchor: secondAnchor,
        engineArtifact: artifact,
        semanticKind: "case",
      });
      expect(other).not.toBe(baseline);
      const crypto = yield* Crypto.Crypto;
      const mutatingCrypto = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (algorithm, bytes) =>
          Effect.sync(() => {
            input.anchor = secondAnchor;
            input.engineArtifact = otherArtifact;
            input.semanticKind = "id";
          }).pipe(Effect.andThen(crypto.digest(algorithm, bytes))),
      });
      const inFlight = yield* makeCitationMentionId(input).pipe(Effect.provideService(Crypto.Crypto, mutatingCrypto));
      expect(inFlight).toBe(baseline);
      expect(yield* makeCitationMentionId(input)).not.toBe(baseline);
    })
  );

  it.effect("maps crypto failures to a sanitized typed error", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const failedCrypto = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "Unknown",
              module: "CitationIdentityTest",
              method: "digest",
              description: "sensitive input from a failed adapter",
            })
          ),
      });
      const failure = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" }).pipe(
        Effect.provideService(Crypto.Crypto, failedCrypto),
        Effect.flip
      );
      expect(failure.reason).toBe("digest-failed");
      expect("cause" in failure).toBe(false);
      expect(failure.message).not.toContain("sensitive");
    })
  );
});
