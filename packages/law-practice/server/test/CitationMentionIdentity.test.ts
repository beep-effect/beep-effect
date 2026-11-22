import { CitationMentionId } from "@beep/law-practice-domain/values";
import { makeCaseOccurrenceAuthorityId } from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import {
  CitationMentionIdentityInput,
  CitationMentionPreimage,
  makeCitationMentionId,
} from "@beep/law-practice-server/internal/Citation/MentionIdentity";
import {
  caseOccurrenceKeyV1,
  citationMentionIdV1,
} from "@beep/law-practice-server/internal/Citation/MentionIdentityV1";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/text/VerifiedTextAnchor";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";

const TextAnchorVerificationReceiptJson = S.fromJsonString(TextAnchorVerificationReceipt);

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
  it.effect("matches the citation-mention/v2 golden and ignores input property order", () =>
    Effect.gen(function* () {
      yield* CitationMentionPreimage.verifyGolden();
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const first = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" });
      const reordered = yield* makeCitationMentionId({ semanticKind: "case", engineArtifact: artifact, anchor });
      expect(first).toBe("cm2:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44");
      expect(reordered).toBe(first);
      expect(S.is(CitationMentionId)(first)).toBe(true);
    })
  );

  it.effect("keeps the pinned cm1 vector reproducible beside the v2 id over the same anchor", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const receipt = toTextAnchorVerificationReceipt(anchor);
      const v1 = yield* citationMentionIdV1(receipt, artifact, "case");
      const v2 = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" });
      expect(v1).toBe("cm1:dc70e426b0b9aa61caf21a5e6e0c7274720c7e674ff2b06a8cdfd82ee0346ae9");
      expect(v2).toBe("cm2:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44");
      const keyV1 = yield* caseOccurrenceKeyV1(v1);
      const keyV2 = yield* makeCaseOccurrenceAuthorityId(v2);
      expect(keyV1).toBe("ca1:7f43ae8777fd804f01172cce2e73b1762c712f9f7e4c8d08bffdb58a49341bf6");
      expect(keyV2).toBe("ca1:4d2adc3d142ce1c3a4b028bde50b9f27253a829404d1f7d773442e6d6ab5ee13");
    })
  );

  it.effect("refuses an invalid semantic kind and a failed digest in the pinned v1 encoder", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const receipt = toTextAnchorVerificationReceipt(anchor);
      const invalid = yield* citationMentionIdV1(receipt, artifact, Str.repeat(129)("a")).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationMentionIdentityFailure", reason: "invalid-input" });
      const failedCrypto = makeTestCitationDigest(() =>
        Effect.die(PlatformError.systemError({ _tag: "Unknown", module: "CitationIdentityTest", method: "digest" }))
      );
      const failed = yield* citationMentionIdV1(receipt, artifact, "case").pipe(
        Effect.provideService(Digest.Digest, failedCrypto),
        Effect.flip
      );
      expect(failed).toMatchObject({ _tag: "CitationMentionIdentityFailure", reason: "digest-failed" });
      const malformed = yield* citationMentionIdV1(receipt, artifact, "case").pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest(() => Effect.succeed(new Uint8Array(1)))
        ),
        Effect.flip
      );
      expect(malformed).toMatchObject({ _tag: "CitationMentionIdentityFailure", reason: "digest-failed" });
    })
  );

  it.effect("keeps identities stable under replay and consumer ordering while separating repeated quotes", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchors = yield* Effect.forEach([3, 13], (start) => verifiedAnchor(sourceText, start, source), {
        concurrency: 1,
      });
      const inputs = A.map(anchors, (anchor) =>
        CitationMentionIdentityInput.make({ anchor, engineArtifact: artifact, semanticKind: "case" })
      );
      const forward = yield* Effect.forEach(inputs, makeCitationMentionId, { concurrency: 1 });
      const reverse = yield* Effect.forEach(A.reverse(inputs), makeCitationMentionId, { concurrency: 1 });
      expect(reverse).toEqual(A.reverse(forward));
      expect(A.dedupe(forward).length).toBe(2);
      const citationResult1 = yield* Effect.forEach(inputs, makeCitationMentionId, { concurrency: 1 });
      expect(citationResult1).toEqual(forward);
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
      const changedSources = yield* Effect.forEach(
        overrides,
        (override) =>
          Effect.gen(function* () {
            const changed = yield* sourceIdentity(sourceText, override);
            const proof = yield* verifiedAnchor(sourceText, 3, changed);
            return yield* makeCitationMentionId({ anchor: proof, engineArtifact: artifact, semanticKind: "case" });
          }),
        { concurrency: 1 }
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
      const wire = yield* S.encodeEffect(TextAnchorVerificationReceiptJson)(receipt);
      const restored = yield* S.decodeEffect(TextAnchorVerificationReceiptJson)(wire);
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
      const citationResult2 = yield* makeCitationMentionId({
        anchor: reverified,
        engineArtifact: artifact,
        semanticKind: "case",
      });
      const citationResult3 = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" });
      expect(citationResult2).toBe(citationResult3);
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
      const crypto = yield* Digest.Digest;
      const mutatingCrypto = makeTestCitationDigest((algorithm, bytes) =>
        Effect.sync(() => {
          input.anchor = secondAnchor;
          input.engineArtifact = otherArtifact;
          input.semanticKind = "id";
        }).pipe(Effect.andThen(crypto.digest(algorithm, bytes)))
      );
      const inFlight = yield* makeCitationMentionId(input).pipe(Effect.provideService(Digest.Digest, mutatingCrypto));
      expect(inFlight).toBe(baseline);
      const citationResult4 = yield* makeCitationMentionId(input);
      expect(citationResult4).not.toBe(baseline);
    })
  );

  it.effect("maps crypto failures to a sanitized typed error", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const failedCrypto = makeTestCitationDigest(() =>
        Effect.die(
          PlatformError.systemError({
            _tag: "Unknown",
            module: "CitationIdentityTest",
            method: "digest",
            description: "sensitive input from a failed adapter",
          })
        )
      );
      const failure = yield* makeCitationMentionId({ anchor, engineArtifact: artifact, semanticKind: "case" }).pipe(
        Effect.provideService(Digest.Digest, failedCrypto),
        Effect.flip
      );
      expect(failure.reason).toBe("digest-failed");
      expect("cause" in failure).toBe(false);
      expect(failure.message).not.toContain("sensitive");
    })
  );
  it.effect("rejects malformed digest bytes without returning a partial occurrence token", () =>
    Effect.gen(function* () {
      const source = yield* sourceIdentity(sourceText);
      const anchor = yield* verifiedAnchor(sourceText, 3, source);
      const input = CitationMentionIdentityInput.make({ anchor, engineArtifact: artifact, semanticKind: "case" });
      for (const length of [0, 1, 31, 33]) {
        let calls = 0;
        const digest = makeTestCitationDigest(() =>
          Effect.sync(() => {
            calls++;
            return new Uint8Array(length);
          })
        );
        const failure = yield* makeCitationMentionId(input).pipe(
          Effect.provideService(Digest.Digest, digest),
          Effect.flip
        );
        expect(calls).toBe(1);
        expect(failure).toMatchObject({ _tag: "CitationMentionIdentityFailure", reason: "digest-failed" });
        expect("cause" in failure).toBe(false);
        expect(failure.message).not.toContain("1 U.S.");
      }
      // The occurrence id digest succeeds and the mention id digest is malformed: both digests ran, no token.
      let second = 0;
      const lateFailure = yield* makeCitationMentionId(input).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest(() =>
            Effect.sync(() => {
              second++;
              return new Uint8Array(second === 1 ? 32 : 1);
            })
          )
        ),
        Effect.flip
      );
      expect(second).toBe(2);
      expect(lateFailure).toMatchObject({ _tag: "CitationMentionIdentityFailure", reason: "digest-failed" });
      const recovered = yield* makeCitationMentionId(input);
      expect(recovered).toBe("cm2:7ece8d5655b197d8063442248a8f630cd05fee535fe5ae550f2b15754425cd44");
    })
  );
});
