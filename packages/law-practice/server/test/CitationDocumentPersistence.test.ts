import {
  Citation,
  CitationAuthority,
  CitationAuthorityId,
  CitationComponentAnchor,
  CitationDocument,
  CitationDocumentReceipt,
  CitationFootnoteZone,
  CitationMention,
  CitationMentionId,
  CitationResolved,
} from "@beep/law-practice-domain/values";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorInput,
  verifySourceTextIdentity,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import cases from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };
import { CitationAuthorityIdentityInput, makeCitationAuthorityId } from "../src/internal/Citation/AuthorityIdentity.ts";
import { projectCitationDocumentReceipt, restoreCitationDocument } from "../src/internal/Citation/Document.ts";
import { makeCitationMention, restoreCitationMentionAgainstVerifiedSource } from "../src/internal/Citation/Mention.ts";

const text = "😀 1 U.S. 1; 1 U.S. 1; Id.";
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const staleAuthority = CitationAuthorityId.make(`ca1:${Str.repeat(64)("f")}`);
const staleMention = CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`);
const Json = S.fromJsonString(CitationDocumentReceipt);
const fixture = Effect.gen(function* () {
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
  const digest = SourceTextDigest.make(`sha256:${hash}`);
  const source = SourceTextIdentity.make({
    scopeRef: "matter:fixture",
    sourceRef: "source:fixture",
    locator: PosixPath.make("source.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const model = yield* S.decodeUnknownEffect(CitationAuthorityIdentityInput)(A.getUnsafe(cases.cases, 0).input);
  const idCitation = yield* S.decodeEffect(Citation)({
    type: "id",
    components: {},
    metadata: { pinCite: null, parenthetical: null },
  });
  const zone = yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      source,
      expectedSource: source,
      sourceText: text,
      anchor: TextAnchor.make({ startChar: 0, endChar: Str.length(text), quote: text }),
    })
  );
  const mentions = yield* Effect.forEach(
    [
      { start: 3, end: 11, citation: model.citation },
      { start: 13, end: 21, citation: model.citation },
      { start: 23, end: 26, citation: idCitation },
    ],
    (row) =>
      Effect.gen(function* () {
        const anchor = yield* verifyTextAnchor(
          VerifyTextAnchorInput.make({
            source,
            expectedSource: source,
            sourceText: text,
            anchor: TextAnchor.make({
              startChar: row.start,
              endChar: row.end,
              quote: Str.slice(row.start, row.end)(text),
            }),
          })
        );
        return yield* makeCitationMention({
          citation: row.citation,
          anchor,
          engineArtifact: artifact,
          components: row.start === 3 ? [CitationComponentAnchor.make({ name: "fullSpan", anchor: zone })] : [],
          footnote:
            row.start === 3 ? O.some(CitationFootnoteZone.make({ label: O.some("1"), anchor: zone })) : O.none(),
          signal: O.none(),
          warnings: [],
          evidenceConfidence: O.none(),
        });
      })
  );
  const first = A.getUnsafe(mentions, 0);
  const authorityId = yield* makeCitationAuthorityId({
    citation: first.citation,
    mentionId: first.id,
    selectedEdition: model.selectedEdition,
  });
  const document = CitationDocument.make({
    source,
    engineArtifact: artifact,
    mentions,
    authorities: [CitationAuthority.make({ id: authorityId, fullMentionId: first.id })],
    resolutions: A.map(mentions, (mention) =>
      CitationResolved.make({ mentionId: mention.id, authorityId, confidence: O.none() })
    ),
  });
  const editions = O.isSome(model.selectedEdition) ? [model.selectedEdition.value] : [];
  const receipt = yield* projectCitationDocumentReceipt({ document, editions });
  const restore = { receipt, editions, expectedSource: source, expectedEngineArtifact: artifact, sourceText: text };
  return { document, editions, receipt, restore };
}).pipe(Effect.withSpan("DocumentPersistenceTest.fixture"));

it.layer(BunCrypto.layer)("whole citation document persistence", (it) => {
  it.effect("round-trips the whole graph with fresh anchor proofs and stable IDs", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const wire = yield* S.encodeEffect(Json)(data.receipt);
      const receipt = yield* S.decodeEffect(Json)(wire);
      const restored = yield* restoreCitationDocument({ ...data.restore, receipt });
      expect(A.map(restored.mentions, (mention) => mention.id)).toEqual(
        A.map(data.document.mentions, (mention) => mention.id)
      );
      expect(A.getUnsafe(restored.mentions, 0).anchor).not.toBe(A.getUnsafe(data.document.mentions, 0).anchor);
      expect(
        yield* S.encodeEffect(Json)(
          yield* projectCitationDocumentReceipt({ document: restored, editions: data.editions })
        )
      ).toBe(wire);
      expect(
        (yield* Effect.flip(projectCitationDocumentReceipt({ document: receipt, editions: data.editions }))).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("hashes the raw source once across the whole document and snapshots receipt data", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const captured = yield* S.encodeEffect(Json)(data.receipt);
      const restored = yield* restoreCitationDocument(data.restore).pipe(
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                if (hashes === 1) Reflect.set(A.getUnsafe(data.receipt.resolutions, 0), "authorityId", staleAuthority);
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      expect(hashes).toBe(6); // One source, three mentions, two resolved full keys.
      expect(
        yield* S.encodeEffect(Json)(
          yield* projectCitationDocumentReceipt({ document: restored, editions: data.editions })
        )
      ).toBe(captured);
    })
  );

  it.effect("snapshots runtime graph data before projection starts hashing", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const expected = yield* S.encodeEffect(Json)(data.receipt);
      const crypto = yield* Crypto.Crypto;
      let hashes = 0;
      const receipt = yield* projectCitationDocumentReceipt({ document: data.document, editions: data.editions }).pipe(
        Effect.provideService(
          Crypto.Crypto,
          Crypto.make({
            randomBytes: (size) => new Uint8Array(size),
            digest: (algorithm, bytes) =>
              Effect.suspend(() => {
                hashes += 1;
                if (hashes === 1) Reflect.set(A.getUnsafe(data.document.resolutions, 0), "authorityId", staleAuthority);
                return crypto.digest(algorithm, bytes);
              }),
          })
        )
      );
      expect(yield* S.encodeEffect(Json)(receipt)).toBe(expected);
    })
  );

  it.effect("rejects coherent graph rewrites with stale occurrence or authority tokens", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const last = A.getUnsafe(data.receipt.mentions, 2);
      const stale = CitationDocumentReceipt.make({
        ...data.receipt,
        mentions: A.map(data.receipt.mentions, (mention) =>
          mention.id === last.id ? { ...mention, id: staleMention } : mention
        ),
        resolutions: A.map(data.receipt.resolutions, (resolution) =>
          resolution.mentionId === last.id ? { ...resolution, mentionId: staleMention } : resolution
        ),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt: stale }))).reason).toBe(
        "stale-mention"
      );
      const rewritten = CitationDocumentReceipt.make({
        ...data.receipt,
        authorities: A.map(data.receipt.authorities, (authority) => ({ ...authority, id: staleAuthority })),
        resolutions: A.map(data.receipt.resolutions, (resolution) => ({ ...resolution, authorityId: staleAuthority })),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt: rewritten }))).reason).toBe(
        "stale-authority"
      );
    })
  );

  it.effect("checks every resolved full citation, including non-representative members", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const second = A.getUnsafe(data.document.mentions, 1);
      const wire = yield* S.encodeEffect(Citation)(second.citation);
      const changed = yield* S.decodeEffect(Citation)({ ...wire, components: { ...wire.components, volume: "2" } });
      const document = CitationDocument.make({
        ...data.document,
        mentions: A.map(data.document.mentions, (mention) =>
          mention.id === second.id ? CitationMention.make({ ...mention, citation: changed }) : mention
        ),
      });
      expect((yield* Effect.flip(projectCitationDocumentReceipt({ document, editions: data.editions }))).reason).toBe(
        "stale-authority"
      );
    })
  );

  it.effect("rejects raw quote/engine drift and missing or duplicate edition descriptors", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, sourceText: `${text}!` }))).reason).toBe(
        "unverifiable-evidence"
      );
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, expectedEngineArtifact: Sha256Hex.make(Str.repeat(64)("b")) })
        )).reason
      ).toBe("stale-engine");
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, editions: [] }))).reason).toBe(
        "identity-failed"
      );
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, editions: A.appendAll(data.editions, data.editions) })
        )).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("rejects tampered raw anchor quotes even when document references remain coherent", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const first = A.getUnsafe(data.receipt.mentions, 0);
      const anchor = TextAnchorVerificationReceipt.make({
        source: first.anchor.source,
        anchor: TextAnchor.make({ ...first.anchor.anchor, quote: "2 U.S. 2" }),
      });
      const receipt = CitationDocumentReceipt.make({
        ...data.receipt,
        mentions: A.map(data.receipt.mentions, (mention) =>
          mention.id === first.id ? { ...mention, anchor } : mention
        ),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt }))).reason).toBe(
        "unverifiable-evidence"
      );
    })
  );

  it.effect("rejects a genuine source capability for a different source identity", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const source = SourceTextIdentity.make({ ...data.document.source, scopeRef: "matter:other" });
      const proof = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ source, expectedSource: source, sourceText: text })
      );
      const receipt = A.getUnsafe(data.receipt.mentions, 0);
      expect((yield* Effect.flip(restoreCitationMentionAgainstVerifiedSource(proof, artifact)(receipt))).reason).toBe(
        "unverifiable-evidence"
      );
    })
  );

  it.effect("restores empty documents with source verification and enforces the UTF-16 source ceiling", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const receipt = CitationDocumentReceipt.make({ ...data.receipt, mentions: [], authorities: [], resolutions: [] });
      expect((yield* restoreCitationDocument({ ...data.restore, receipt, editions: [] })).mentions).toEqual([]);
      expect(
        (yield* Effect.flip(restoreCitationDocument({ ...data.restore, sourceText: Str.repeat(500_001)("😀") }))).reason
      ).toBe("invalid-input");
    })
  );
});
