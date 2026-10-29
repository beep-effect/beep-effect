import {
  Citation,
  CitationComponentAnchor,
  CitationFootnoteZone,
  CitationMention,
  CitationMentionId,
  CitationMentionReceipt,
  CitationOverlapWarning,
} from "@beep/law-practice-domain/values";
import {
  makeCitationMention,
  projectCitationMentionReceipt,
  restoreCitationMention,
} from "@beep/law-practice-server/_test/Citation/Mention";
import { makeCitationMentionId } from "@beep/law-practice-server/_test/Citation/MentionIdentity";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { VerifiedTextAnchor, VerifyTextAnchorInput, verifyTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const text = "1. 😀 1 U.S. 1; 1 U.S. 1\r\n";
const artifact = Sha256Hex.make("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const otherArtifact = Sha256Hex.make("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
const encoder = new TextEncoder();
const ReceiptJson = S.fromJsonString(CitationMentionReceipt);
const identity = Effect.fn("MentionTest.identity")(function* (scopeRef = "matter:example", rawText = text) {
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(rawText));
  const digest = SourceTextDigest.make(`sha256:${hash}`);
  return SourceTextIdentity.make({
    scopeRef,
    sourceRef: "source:example",
    locator: PosixPath.make("source.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
});
const anchorAt = Effect.fn("MentionTest.anchor")(function* (
  source: SourceTextIdentity,
  startChar: number,
  endChar: number,
  rawText = text
) {
  return yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      source,
      expectedSource: source,
      sourceText: rawText,
      anchor: TextAnchor.make({ startChar, endChar, quote: Str.slice(startChar, endChar)(rawText) }),
    })
  );
});
const fixture = Effect.gen(function* () {
  const source = yield* identity();
  const anchor = yield* anchorAt(source, 6, 14);
  const zone = yield* anchorAt(source, 0, Str.length(text));
  const citation = yield* S.decodeEffect(Citation)({
    type: "case",
    components: { volume: "1", reporter: "U.S.", page: "1" },
    publication: { vocabularyVersion: "crv1:f353e51400a5:fad63b383b92", editions: [], selectedEdition: null },
    metadata: {
      pinCite: null,
      parenthetical: null,
      year: null,
      month: null,
      day: null,
      court: null,
      plaintiff: null,
      defendant: null,
      additionalText: null,
      antecedentGuess: null,
      shortCaseName: null,
      caseName: null,
    },
  });
  const input = {
    citation,
    engineArtifact: artifact,
    anchor,
    components: [CitationComponentAnchor.make({ name: "fullSpan", anchor: zone })],
    footnote: O.some(CitationFootnoteZone.make({ label: O.some("1"), anchor: zone })),
    signal: O.none(),
    warnings: [],
    evidenceConfidence: O.none(),
  };
  const mention = yield* makeCitationMention(input);
  const receipt = yield* projectCitationMentionReceipt(mention);
  return { source, input, mention, receipt };
}).pipe(Effect.withSpan("MentionTest.fixture"));

it.layer(BunCrypto.layer)("verified citation mention composition", (it) => {
  it.effect("round-trips receipts through JSON and restores fresh proofs with the same deterministic ID", () =>
    Effect.gen(function* () {
      const { source, mention, receipt } = yield* fixture;
      const wire = yield* S.encodeEffect(ReceiptJson)(receipt);
      const decoded = yield* S.decodeEffect(ReceiptJson)(wire);
      expect(S.is(CitationMention)(decoded)).toBe(false);
      expect(S.is(VerifiedTextAnchor)(decoded.anchor)).toBe(false);
      const restored = yield* restoreCitationMention({
        receipt: decoded,
        expectedSource: source,
        expectedEngineArtifact: artifact,
        sourceText: text,
      });
      expect(S.is(CitationMention)(restored)).toBe(true);
      expect(S.is(VerifiedTextAnchor)(restored.anchor)).toBe(true);
      expect(restored.id).toBe(mention.id);
      expect(restored.anchor).not.toBe(mention.anchor);
      expect(restored.anchor.anchor).toEqual({ startChar: 6, endChar: 14, quote: "1 U.S. 1" });
      expect(yield* S.encodeEffect(ReceiptJson)(yield* projectCitationMentionReceipt(restored))).toBe(wire);
    })
  );

  it.effect("rejects primary/component structural imitations and unbounded confidence assertions", () =>
    Effect.gen(function* () {
      const { input, receipt } = yield* fixture;
      for (const invalid of [
        { ...input, anchor: receipt.anchor },
        { ...input, anchor: { ...receipt.anchor } },
        { ...input, components: [{ name: "fullSpan", anchor: receipt.components[0]?.anchor }] },
        { ...input, evidenceConfidence: O.some(2) },
      ]) {
        expect((yield* makeCitationMention(invalid).pipe(Effect.flip)).reason).toBe("invalid-input");
      }
    })
  );

  it.effect("rejects cross-source components and footnote zones that do not contain the occurrence", () =>
    Effect.gen(function* () {
      const { source, input } = yield* fixture;
      const otherSource = yield* identity("matter:other");
      const other = yield* anchorAt(otherSource, 6, 14);
      expect(
        (yield* makeCitationMention({
          ...input,
          components: [CitationComponentAnchor.make({ name: "other", anchor: other })],
        }).pipe(Effect.flip)).reason
      ).toBe("invalid-input");
      const outside = yield* anchorAt(source, 16, 24);
      expect(
        (yield* makeCitationMention({
          ...input,
          footnote: O.some(CitationFootnoteZone.make({ label: O.none(), anchor: outside })),
        }).pipe(Effect.flip)).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("rejects cross-source structural receipts before restoring proofs", () =>
    Effect.gen(function* () {
      const { receipt } = yield* fixture;
      const wire = yield* S.encodeEffect(CitationMentionReceipt)(receipt);
      const altered = {
        ...wire,
        components: [
          { name: "other", anchor: { ...wire.anchor, source: { ...wire.anchor.source, scopeRef: "matter:other" } } },
        ],
      };
      expect(Result.isFailure(S.decodeResult(CitationMentionReceipt)(altered))).toBe(true);
    })
  );

  it.effect("rejects source text, identity and quote drift with sanitized failures", () =>
    Effect.gen(function* () {
      const { source, receipt } = yield* fixture;
      const alteredScope = SourceTextIdentity.make({ ...source, scopeRef: "matter:other" });
      const alteredVersion = SourceTextIdentity.make({ ...source, normalizationVersion: "2" });
      const wire = yield* S.encodeEffect(CitationMentionReceipt)(receipt);
      const alteredQuote = yield* S.decodeEffect(CitationMentionReceipt)({
        ...wire,
        anchor: { ...wire.anchor, anchor: { ...wire.anchor.anchor, quote: "2 U.S. 1" } },
      });
      for (const input of [
        { receipt, expectedSource: source, expectedEngineArtifact: artifact, sourceText: `${text}!` },
        { receipt, expectedSource: alteredScope, expectedEngineArtifact: artifact, sourceText: text },
        { receipt, expectedSource: alteredVersion, expectedEngineArtifact: artifact, sourceText: text },
        { receipt: alteredQuote, expectedSource: source, expectedEngineArtifact: artifact, sourceText: text },
      ]) {
        const failure = yield* restoreCitationMention(input).pipe(Effect.flip);
        expect(failure.reason).toBe("unverifiable-evidence");
        expect("cause" in failure).toBe(false);
        expect(failure.message).not.toContain("U.S.");
      }
    })
  );

  it.effect("rejects stale engine artifacts, IDs and semantic-kind identity inputs", () =>
    Effect.gen(function* () {
      const { source, receipt } = yield* fixture;
      const wire = yield* S.encodeEffect(CitationMentionReceipt)(receipt);
      const changedId = yield* S.decodeEffect(CitationMentionReceipt)({ ...wire, id: `cm1:${otherArtifact}` });
      const changedKind = yield* S.decodeEffect(CitationMentionReceipt)({
        ...wire,
        citation: { type: "id", components: {}, metadata: { pinCite: null, parenthetical: null } },
      });
      const stale = yield* restoreCitationMention({
        receipt,
        expectedSource: source,
        expectedEngineArtifact: otherArtifact,
        sourceText: text,
      }).pipe(Effect.flip);
      expect(stale.reason).toBe("stale-engine");
      for (const changed of [changedId, changedKind]) {
        expect(
          (yield* restoreCitationMention({
            receipt: changed,
            expectedSource: source,
            expectedEngineArtifact: artifact,
            sourceText: text,
          }).pipe(Effect.flip)).reason
        ).toBe("stale-identity");
      }
    })
  );

  it.effect("checks ID coherence before projecting caller-constructed runtime data", () =>
    Effect.gen(function* () {
      const { mention } = yield* fixture;
      const altered = CitationMention.make({ ...mention, id: CitationMentionId.make(`cm1:${otherArtifact}`) });
      expect((yield* projectCitationMentionReceipt(altered).pipe(Effect.flip)).reason).toBe("stale-identity");
    })
  );

  it.effect("preserves explicit optional assertions and typed warning references through receipts", () =>
    Effect.gen(function* () {
      const { source, input } = yield* fixture;
      const second = yield* anchorAt(source, 16, 24);
      const previousMentionId = yield* makeCitationMentionId({
        anchor: second,
        engineArtifact: artifact,
        semanticKind: "case",
      });
      const mention = yield* makeCitationMention({
        ...input,
        signal: O.some("see"),
        evidenceConfidence: O.some(UnitInterval.make(0.5)),
        warnings: [CitationOverlapWarning.make({ previousMentionId })],
      });
      const receipt = yield* projectCitationMentionReceipt(mention);
      const restored = yield* restoreCitationMention({
        receipt,
        expectedSource: source,
        expectedEngineArtifact: artifact,
        sourceText: text,
      });
      expect(restored.signal).toEqual(O.some("see"));
      expect(restored.evidenceConfidence).toEqual(O.some(0.5));
      expect(restored.warnings).toEqual([{ kind: "unexpected-overlap", previousMentionId }]);
      expect(restored.footnote).toMatchObject({ _tag: "Some", value: { label: O.some("1") } });
    })
  );

  it.effect("hashes the source once for all anchors and snapshots caller data before asynchronous verification", () =>
    Effect.gen(function* () {
      const { source, receipt, mention } = yield* fixture;
      const crypto = yield* Crypto.Crypto;
      let calls = 0;
      const mutating = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (algorithm, bytes) =>
          Effect.sync(() => {
            calls += 1;
            if (calls === 1) {
              Reflect.set(receipt.anchor.anchor, "quote", "2 U.S. 1");
              Reflect.set(receipt.anchor.source, "scopeRef", "matter:tampered");
            }
          }).pipe(Effect.andThen(crypto.digest(algorithm, bytes))),
      });
      const restored = yield* restoreCitationMention({
        receipt,
        expectedSource: source,
        expectedEngineArtifact: artifact,
        sourceText: text,
      }).pipe(Effect.provideService(Crypto.Crypto, mutating));
      expect(calls).toBe(2); // raw source digest + occurrence identity digest
      expect(restored.id).toBe(mention.id);
      expect(restored.anchor.anchor.quote).toBe("1 U.S. 1");
      expect(restored.anchor.source.scopeRef).toBe("matter:example");
    })
  );

  it.effect("snapshots semantic kind and engine metadata before occurrence hashing", () =>
    Effect.gen(function* () {
      const { input, mention } = yield* fixture;
      const crypto = yield* Crypto.Crypto;
      const mutating = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (algorithm, bytes) =>
          Effect.sync(() => {
            Reflect.set(input.citation, "type", "id");
            Reflect.set(input, "engineArtifact", otherArtifact);
          }).pipe(Effect.andThen(crypto.digest(algorithm, bytes))),
      });
      const created = yield* makeCitationMention(input).pipe(Effect.provideService(Crypto.Crypto, mutating));
      expect(created.citation.type).toBe("case");
      expect(created.engineArtifact).toBe(artifact);
      expect(created.id).toBe(mention.id);
    })
  );

  it.effect("enforces the hard UTF-16 source ceiling before hashing", () =>
    Effect.gen(function* () {
      const { source, receipt } = yield* fixture;
      const crypto = yield* Crypto.Crypto;
      let calls = 0;
      const counting = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: (algorithm, bytes) =>
          Effect.sync(() => {
            calls += 1;
          }).pipe(Effect.andThen(crypto.digest(algorithm, bytes))),
      });
      const failure = yield* restoreCitationMention({
        receipt,
        expectedSource: source,
        expectedEngineArtifact: artifact,
        sourceText: Str.repeat(500_001)("😀"),
      }).pipe(Effect.provideService(Crypto.Crypto, counting), Effect.flip);
      expect(failure.reason).toBe("invalid-input");
      expect(calls).toBe(0);
    })
  );

  it.effect("discards sensitive adapter causes in private typed failures", () =>
    Effect.gen(function* () {
      const { input } = yield* fixture;
      const broken = Crypto.make({
        randomBytes: (size) => new Uint8Array(size),
        digest: () =>
          Effect.fail(
            PlatformError.systemError({
              _tag: "Unknown",
              module: "MentionTest",
              method: "digest",
              description: "sensitive source payload",
            })
          ),
      });
      const failure = yield* makeCitationMention(input).pipe(Effect.provideService(Crypto.Crypto, broken), Effect.flip);
      expect(failure.reason).toBe("identity-failed");
      expect("cause" in failure).toBe(false);
      expect(failure.message).not.toContain("sensitive");
    })
  );

  it.effect.prop(
    "preserves verified UTF-16 evidence through receipts across generated Unicode prefixes",
    { prefix: Arbitrary.schema(S.Array(S.Literals(["😀", "é", "\r\n", " "])).check(S.isMaxLength(6))) },
    ({ prefix }) =>
      Effect.gen(function* () {
        const { input } = yield* fixture;
        const before = A.join(prefix, "");
        const rawText = `${before}1 U.S. 1\r\n`;
        const source = yield* identity("matter:generated", rawText);
        const start = Str.length(before);
        const proof = yield* anchorAt(source, start, start + 8, rawText);
        const mention = yield* makeCitationMention({ ...input, anchor: proof, components: [], footnote: O.none() });
        const receipt = yield* projectCitationMentionReceipt(mention);
        const wire = yield* S.encodeEffect(ReceiptJson)(receipt);
        const restoredReceipt = yield* S.decodeEffect(ReceiptJson)(wire);
        const restored = yield* restoreCitationMention({
          receipt: restoredReceipt,
          expectedSource: source,
          expectedEngineArtifact: artifact,
          sourceText: rawText,
        });
        expect(restored.id).toBe(mention.id);
        expect(restored.anchor.anchor).toEqual({ startChar: start, endChar: start + 8, quote: "1 U.S. 1" });
        expect(yield* S.encodeEffect(ReceiptJson)(yield* projectCitationMentionReceipt(restored))).toBe(wire);
      }),
    { arbitrary: fcRuns(25) }
  );
});
