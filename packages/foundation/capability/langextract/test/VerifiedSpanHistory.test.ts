import { GroundedExtraction } from "@beep/langextract/Extraction";
import {
  BeginVerifiedSpanHistoryInput,
  beginVerifiedSpanHistory,
  ContinueVerifiedSpanHistoryInput,
  reanchorVerifiedSpanHistory,
  VerifiedSpanAttemptFailure,
  VerifiedSpanAttemptId,
  VerifiedSpanAttemptOutcome,
  VerifiedSpanEngine,
  VerifiedSpanHistory,
  verifyCurrentSpanHistory,
} from "@beep/langextract/VerifiedSpan";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import { ISOStr } from "@beep/schema/Timestamp";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const utf8Encoder = new TextEncoder();
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const historyEquivalence = S.toEquivalence(VerifiedSpanHistory);
const HistoryJson = S.fromJsonString(VerifiedSpanHistory);
const engine = VerifiedSpanEngine.make({ name: "fixture-extractor", version: "1" });

const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.tryPromise({
        catch: (cause) =>
          PlatformError.systemError({
            _tag: "Unknown",
            cause,
            description: "Could not compute fixture digest",
            method: "digest",
            module: "VerifiedSpanHistoryTest",
          }),
        try: () =>
          globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data)).then((buffer) => new Uint8Array(buffer)),
      }),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  })
);
const provideTestCrypto = provideScopedLayer(TestCrypto);

const digestText = Effect.fnUntraced(function* (sourceText: string) {
  const digest = yield* decodeSha256HexFromBytes(Uint8Array.from(utf8Encoder.encode(sourceText)));
  return SourceTextDigest.make(`sha256:${digest}`);
});

const sourceIdentity = Effect.fnUntraced(function* (
  sourceText: string,
  scopeRef = "matter:verified-span",
  normalizationVersion = "1"
) {
  const digest = yield* digestText(sourceText);
  return SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({ name: "fixture-text", version: "1" }),
    locator: PosixPath.make("sources/fixture.txt"),
    normalizationVersion,
    scopeRef,
    sourceDigest: digest,
    sourceRef: "source:verified-span-fixture",
    textDigest: digest,
  });
});

const candidate = (text: string): GroundedExtraction =>
  GroundedExtraction.cases.unaligned.make({
    label: "quotation",
    text,
  });

const attemptId = (ordinal: number): VerifiedSpanAttemptId => VerifiedSpanAttemptId.make(`attempt-${ordinal}`);
const attemptedAt = (ordinal: number): ISOStr => ISOStr.make(`2026-08-27T00:00:0${ordinal}.000Z`);

const beginInput = (
  ordinal: number,
  candidates: ReadonlyArray<GroundedExtraction>,
  expectedSource: SourceTextIdentity,
  source: SourceTextIdentity,
  sourceText: string,
  matterRef = "matter:verified-span"
): BeginVerifiedSpanHistoryInput =>
  BeginVerifiedSpanHistoryInput.make({
    attemptId: attemptId(ordinal),
    attemptedAt: attemptedAt(ordinal),
    candidates,
    engine,
    expectedSource,
    matterRef,
    source,
    sourceText,
  });

const continuationInput = (
  ordinal: number,
  candidates: ReadonlyArray<GroundedExtraction>,
  source: SourceTextIdentity,
  sourceText: string
): ContinueVerifiedSpanHistoryInput =>
  ContinueVerifiedSpanHistoryInput.make({
    attemptId: attemptId(ordinal),
    attemptedAt: attemptedAt(ordinal),
    candidates,
    engine,
    source,
    sourceText,
  });

const historyAttemptAt = Effect.fnUntraced(function* (history: VerifiedSpanHistory, index: number) {
  return yield* Effect.fromOption(A.get(history.attempts, index), () => `Missing history attempt ${index}.`);
});

const persistAndReload = Effect.fnUntraced(function* (history: VerifiedSpanHistory) {
  const persisted = yield* S.encodeEffect(HistoryJson)(history);
  return yield* S.decodeEffect(HistoryJson)(persisted);
});

describe("verified-span persistence and re-anchor history", () => {
  it("round-trips schema-derived persisted failures", () =>
    fc.assert(
      fc.property(S.toArbitrary(VerifiedSpanAttemptFailure)(fc), (failure) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(VerifiedSpanAttemptFailure)(failure));
        const decoded = Result.getOrThrow(S.decodeResult(VerifiedSpanAttemptFailure)(encoded));

        expect(S.toEquivalence(VerifiedSpanAttemptFailure)(decoded, failure)).toBe(true);
      }),
      fcRuns(25)
    ));

  it.effect(
    "persists exact raw anchors, raw candidates, source identity, and pinned versions across restart",
    Effect.fnUntraced(function* () {
      const sourceText = "The court wrote “ofﬁce  record.”";
      const source = yield* sourceIdentity(sourceText);
      const history = yield* beginVerifiedSpanHistory(
        beginInput(1, [candidate('"office record."')], source, source, sourceText)
      );
      const attempt = history.attempts[0];
      const restarted = yield* persistAndReload(history);

      expect(attempt.matterRef).toBe("matter:verified-span");
      expect(attempt.source).toEqual(source);
      expect(attempt.expectedSource).toEqual(source);
      expect(attempt.candidates).toEqual([candidate('"office record."')]);
      expect(attempt.engine).toEqual(engine);
      expect(attempt.normalizationVersion).toBe("1");
      expect(attempt.outcome.status).toBe("verified");
      expect(historyEquivalence(restarted, history)).toBe(true);
      if (VerifiedSpanAttemptOutcome.guards.verified(attempt.outcome)) {
        const receipt = attempt.outcome.anchors[0];
        expect(receipt.anchor.quote).toBe("“ofﬁce  record.”");
        expect(Str.slice(receipt.anchor.startChar, receipt.anchor.endChar)(sourceText)).toBe(receipt.anchor.quote);
        expect(receipt.source).toEqual(source);
      }
    }, provideTestCrypto)
  );

  it.effect(
    "retains source drift before explicitly re-anchoring to a newly proven raw slice",
    Effect.fnUntraced(function* () {
      const locator = '"Affirmed."';
      const originalText = "The court wrote “Affirmed.”";
      const revisedText = "Preface. The court wrote “Affirmed.”";
      const originalSource = yield* sourceIdentity(originalText);
      const revisedSource = yield* sourceIdentity(revisedText);
      const initial = yield* beginVerifiedSpanHistory(
        beginInput(1, [candidate(locator)], originalSource, originalSource, originalText)
      );
      const prematureReanchor = yield* reanchorVerifiedSpanHistory(
        initial,
        continuationInput(2, [candidate(locator)], revisedSource, revisedText)
      ).pipe(Effect.flip);
      const duplicateAttempt = yield* verifyCurrentSpanHistory(
        initial,
        continuationInput(1, [candidate(locator)], originalSource, originalText)
      ).pipe(Effect.flip);
      const drifted = yield* verifyCurrentSpanHistory(
        initial,
        continuationInput(2, [candidate(locator)], revisedSource, revisedText)
      );
      const reanchored = yield* reanchorVerifiedSpanHistory(
        drifted,
        continuationInput(3, [candidate(locator)], revisedSource, revisedText)
      );
      const first = reanchored.attempts[0];
      const second = yield* historyAttemptAt(reanchored, 1);
      const third = yield* historyAttemptAt(reanchored, 2);
      const restarted = yield* persistAndReload(reanchored);

      expect(prematureReanchor.reason).toBe("invalid-history");
      expect(duplicateAttempt.reason).toBe("invalid-history");
      expect(reanchored.attempts[0]).toEqual(initial.attempts[0]);
      expect(second.kind).toBe("verification");
      expect(second.previousAttemptId).toEqual(O.some(first.attemptId));
      expect(second.outcome.status).toBe("failed");
      expect(third.kind).toBe("re-anchor");
      expect(third.previousAttemptId).toEqual(O.some(second.attemptId));
      expect(third.outcome.status).toBe("verified");
      expect(historyEquivalence(restarted, reanchored)).toBe(true);
      if (VerifiedSpanAttemptOutcome.guards.failed(second.outcome)) {
        expect(second.outcome.failure).toMatchObject({ reason: "stale-source", stage: "source" });
        expect("anchors" in second.outcome).toBe(false);
      }
      if (
        VerifiedSpanAttemptOutcome.guards.verified(first.outcome) &&
        VerifiedSpanAttemptOutcome.guards.verified(third.outcome)
      ) {
        const originalAnchor = first.outcome.anchors[0].anchor;
        const revisedAnchor = third.outcome.anchors[0].anchor;

        expect(originalAnchor.startChar).not.toBe(revisedAnchor.startChar);
        expect(Str.slice(originalAnchor.startChar, originalAnchor.endChar)(originalText)).toBe(originalAnchor.quote);
        expect(Str.slice(revisedAnchor.startChar, revisedAnchor.endChar)(revisedText)).toBe(revisedAnchor.quote);
      }
    }, provideTestCrypto)
  );

  it.effect(
    "persists a verified-source negative extraction attempt without an anchor or citation entity",
    Effect.fnUntraced(function* () {
      const sourceText = "The engine emitted no candidates.";
      const source = yield* sourceIdentity(sourceText);
      const history = yield* beginVerifiedSpanHistory(beginInput(1, [], source, source, sourceText));
      const encoded = yield* S.encodeEffect(VerifiedSpanHistory)(history);
      const restarted = yield* persistAndReload(history);
      const driftedSource = yield* sourceIdentity("Different source text.");
      const staleNegative = yield* beginVerifiedSpanHistory(
        beginInput(2, [], source, driftedSource, "Different source text.")
      );

      expect(history.attempts[0].outcome.status).toBe("no-candidates");
      expect(encoded.attempts[0].candidates).toEqual([]);
      expect("anchors" in encoded.attempts[0].outcome).toBe(false);
      expect("citationEntity" in encoded.attempts[0]).toBe(false);
      expect(historyEquivalence(restarted, history)).toBe(true);
      expect(staleNegative.attempts[0].outcome.status).toBe("failed");
      if (VerifiedSpanAttemptOutcome.guards.failed(staleNegative.attempts[0].outcome)) {
        expect(staleNegative.attempts[0].outcome.failure.reason).toBe("stale-source");
      }
    }, provideTestCrypto)
  );

  it.effect(
    "persists typed cross-matter, ambiguity, and normalization-version failures with no anchor",
    Effect.fnUntraced(function* () {
      const duplicateText = "same text; same text";
      const duplicateSource = yield* sourceIdentity(duplicateText);
      const crossMatterSource = yield* sourceIdentity(duplicateText, "matter:other");
      const unsupportedSource = yield* sourceIdentity(duplicateText, "matter:verified-span", "2");
      const crossMatter = yield* beginVerifiedSpanHistory(
        beginInput(1, [candidate("same text")], duplicateSource, crossMatterSource, duplicateText)
      );
      const ambiguous = yield* beginVerifiedSpanHistory(
        beginInput(2, [candidate("same text")], duplicateSource, duplicateSource, duplicateText)
      );
      const unsupported = yield* beginVerifiedSpanHistory(
        beginInput(3, [candidate("same text")], unsupportedSource, unsupportedSource, duplicateText)
      );

      expect(crossMatter.attempts[0].outcome.status).toBe("failed");
      expect(ambiguous.attempts[0].outcome.status).toBe("failed");
      expect(unsupported.attempts[0].outcome.status).toBe("failed");
      if (VerifiedSpanAttemptOutcome.guards.failed(crossMatter.attempts[0].outcome)) {
        expect(crossMatter.attempts[0].outcome.failure).toMatchObject({ reason: "cross-scope", stage: "source" });
      }
      if (VerifiedSpanAttemptOutcome.guards.failed(ambiguous.attempts[0].outcome)) {
        expect(ambiguous.attempts[0].outcome.failure).toMatchObject({ reason: "ambiguous", stage: "location" });
        expect(ambiguous.attempts[0].outcome.failure.candidateIndex).toEqual(O.some(0));
      }
      if (VerifiedSpanAttemptOutcome.guards.failed(unsupported.attempts[0].outcome)) {
        expect(unsupported.attempts[0].outcome.failure).toMatchObject({
          reason: "normalization-version-mismatch",
          stage: "source",
        });
      }
      expect("anchors" in crossMatter.attempts[0].outcome).toBe(false);
      expect("anchors" in ambiguous.attempts[0].outcome).toBe(false);
      expect("anchors" in unsupported.attempts[0].outcome).toBe(false);
    }, provideTestCrypto)
  );

  it.effect(
    "rejects tampered predecessor links and contradictory no-candidate outcomes on decode",
    Effect.fnUntraced(function* () {
      const locator = '"Affirmed."';
      const originalText = "The court wrote “Affirmed.”";
      const revisedText = "Preface. The court wrote “Affirmed.”";
      const originalSource = yield* sourceIdentity(originalText);
      const revisedSource = yield* sourceIdentity(revisedText);
      const initial = yield* beginVerifiedSpanHistory(
        beginInput(1, [candidate(locator)], originalSource, originalSource, originalText)
      );
      const drifted = yield* verifyCurrentSpanHistory(
        initial,
        continuationInput(2, [candidate(locator)], revisedSource, revisedText)
      );
      const reanchored = yield* reanchorVerifiedSpanHistory(
        drifted,
        continuationInput(3, [candidate(locator)], revisedSource, revisedText)
      );
      const encoded = yield* S.encodeEffect(VerifiedSpanHistory)(reanchored);
      const second = yield* Effect.fromOption(A.get(encoded.attempts, 1), () => "Missing encoded drift attempt.");
      const third = yield* Effect.fromOption(A.get(encoded.attempts, 2), () => "Missing encoded re-anchor attempt.");
      const tamperedLink: unknown = {
        attempts: [
          encoded.attempts[0],
          second,
          {
            ...third,
            previousAttemptId: encoded.attempts[0].attemptId,
          },
        ],
      };
      const contradictoryNegative: unknown = {
        attempts: [
          {
            ...encoded.attempts[0],
            outcome: { status: "no-candidates" },
          },
        ],
      };
      const reanchorWithoutDrift: unknown = {
        attempts: [
          encoded.attempts[0],
          {
            ...second,
            outcome: {
              status: "failed",
              failure: {
                reason: "quote-mismatch",
                stage: "anchor",
              },
            },
          },
          third,
        ],
      };
      const reanchorWithMismatchedExpectation: unknown = {
        attempts: [
          encoded.attempts[0],
          second,
          {
            ...third,
            expectedSource: encoded.attempts[0].source,
          },
        ],
      };

      expect(Result.isFailure(S.decodeUnknownResult(VerifiedSpanHistory)(tamperedLink))).toBe(true);
      expect(Result.isFailure(S.decodeUnknownResult(VerifiedSpanHistory)(contradictoryNegative))).toBe(true);
      expect(Result.isFailure(S.decodeUnknownResult(VerifiedSpanHistory)(reanchorWithoutDrift))).toBe(true);
      expect(Result.isFailure(S.decodeUnknownResult(VerifiedSpanHistory)(reanchorWithMismatchedExpectation))).toBe(
        true
      );
    }, provideTestCrypto)
  );
});
