import {
  Citation,
  CitationAmbiguous,
  CitationAuthority,
  CitationAuthorityId,
  CitationDocument,
  CitationDocumentReceipt,
  CitationMention,
  CitationMentionId,
  CitationMentionReceipt,
  CitationOverlapWarning,
  CitationResolved,
  CitationUnresolved,
  citationAuthorityMembers,
} from "@beep/law-practice-domain/values";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixtureSource, TestCrypto } from "./officeActionFixtures.ts";
import type { CitationResolution } from "@beep/law-practice-domain/values";

const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const a = CitationAuthorityId.make(`ca1:${Str.repeat(64)("a")}`);
const b = CitationAuthorityId.make(`ca1:${Str.repeat(64)("b")}`);
const missingAuthority = CitationAuthorityId.make(`ca1:${Str.repeat(64)("c")}`);
const missingMention = CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`);
const text = "1 U.S. 1; 2 U.S. 2; Id.; § 2";
const full = (volume: string) => ({
  type: "case",
  components: { volume, reporter: "U.S.", page: volume },
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
const fixture = Effect.gen(function* () {
  const { source, verifiedSource } = yield* fixtureSource(text);
  // Format-only IDs isolate graph tests from the private digest producers.
  const mentions = yield* Effect.forEach(
    [
      { start: 0, end: 8, seed: "0", citation: full("1") },
      { start: 10, end: 18, seed: "1", citation: full("2") },
      {
        start: 20,
        end: 23,
        seed: "2",
        citation: { type: "id", components: {}, metadata: { pinCite: null, parenthetical: null } },
      },
      {
        start: 25,
        end: 28,
        seed: "3",
        citation: { type: "unknown", components: {}, metadata: { pinCite: null, parenthetical: null } },
      },
    ],
    (row) =>
      Effect.gen(function* () {
        const citation = yield* S.decodeUnknownEffect(Citation)(row.citation);
        const anchor = yield* verifyTextAnchorAgainstVerifiedSource(
          VerifyTextAnchorAgainstVerifiedSourceInput.make({
            verifiedSource,
            anchor: TextAnchor.make({
              startChar: row.start,
              endChar: row.end,
              quote: Str.slice(row.start, row.end)(text),
            }),
          })
        );
        return CitationMention.make({
          id: CitationMentionId.make(`cm1:${Str.repeat(64)(row.seed)}`),
          citation,
          engineArtifact: artifact,
          anchor,
          components: [],
          footnote: O.none(),
          signal: O.none(),
          warnings: [],
          evidenceConfidence: O.none(),
        });
      })
  );
  const first = A.getUnsafe(mentions, 0);
  const second = A.getUnsafe(mentions, 1);
  const third = A.getUnsafe(mentions, 2);
  const fourth = A.getUnsafe(mentions, 3);
  const authorities = [
    CitationAuthority.make({ id: a, representativeMentionId: first.id }),
    CitationAuthority.make({ id: b, representativeMentionId: second.id }),
  ];
  const resolutions = [
    CitationResolved.make({ mentionId: first.id, authorityId: a, confidence: O.none() }),
    CitationResolved.make({ mentionId: second.id, authorityId: b, confidence: O.none() }),
    CitationAmbiguous.make({ mentionId: third.id, candidateAuthorityIds: [a, b], confidence: O.none() }),
    CitationUnresolved.make({ mentionId: fourth.id, reason: "unsupported-citation" }),
  ];
  const document = CitationDocument.make({ source, engineArtifact: artifact, mentions, authorities, resolutions });
  const receipt = CitationDocumentReceipt.make({
    ...document,
    schemaVersion: "citation-document-receipt/v1",
    mentions: A.map(mentions, (mention) =>
      CitationMentionReceipt.make({
        ...mention,
        schemaVersion: "citation-mention-receipt/v1",
        anchor: toTextAnchorVerificationReceipt(mention.anchor),
        components: [],
        footnote: O.none(),
      })
    ),
  });
  return { document, receipt, first, second, third, fourth };
}).pipe(Effect.withSpan("CitationDocumentTest.fixture"));
const isDocument = S.is(CitationDocument);
const isReceipt = S.is(CitationDocumentReceipt);
const ReceiptJson = S.fromJsonString(CitationDocumentReceipt);

it.layer(TestCrypto)("citation document relationships", (it) => {
  it.effect("round-trips structural relationships without converting receipts into runtime proof", () =>
    Effect.gen(function* () {
      const { document, receipt, first } = yield* fixture;
      const json = yield* S.encodeEffect(ReceiptJson)(receipt);
      const restored = yield* S.decodeEffect(ReceiptJson)(json);
      expect(yield* S.encodeEffect(ReceiptJson)(restored)).toBe(json);
      expect(isDocument(document)).toBe(true);
      expect(isDocument(receipt)).toBe(false);
      expect(citationAuthorityMembers(document, a)).toEqual([first.id]);
      expect(citationAuthorityMembers(a)(restored)).toEqual([first.id]);
      expect(citationAuthorityMembers(document, missingAuthority)).toEqual([]);
      expect("members" in A.getUnsafe(receipt.authorities, 0)).toBe(false);
      expect("authorityId" in first).toBe(false);
    })
  );

  it.effect("derives members in mention order and keeps ambiguous candidates outside membership", () =>
    Effect.gen(function* () {
      const { document, first, third } = yield* fixture;
      const resolutions = A.map(document.resolutions, (resolution) =>
        resolution.mentionId === third.id
          ? CitationResolved.make({ mentionId: third.id, authorityId: a, confidence: O.none() })
          : resolution
      );
      const changed = CitationDocument.make({ ...document, resolutions: A.reverse(resolutions) });
      expect(citationAuthorityMembers(changed, a)).toEqual([first.id, third.id]);
      const reordered = CitationDocument.make({ ...changed, mentions: A.reverse(changed.mentions) });
      expect(citationAuthorityMembers(reordered, a)).toEqual([third.id, first.id]);
    })
  );

  it.effect("rejects duplicate mention, authority and resolution identities and missing outcomes", () =>
    Effect.gen(function* () {
      const { document, receipt, first } = yield* fixture;
      expect(isDocument({ ...document, mentions: A.append(document.mentions, first) })).toBe(false);
      expect(
        isDocument({ ...document, authorities: A.append(document.authorities, A.getUnsafe(document.authorities, 0)) })
      ).toBe(false);
      expect(
        isDocument({ ...document, resolutions: A.append(document.resolutions, A.getUnsafe(document.resolutions, 0)) })
      ).toBe(false);
      expect(isDocument({ ...document, resolutions: A.drop(document.resolutions, 1) })).toBe(false);
      expect(isReceipt({ ...receipt, mentions: A.append(receipt.mentions, A.getUnsafe(receipt.mentions, 0)) })).toBe(
        false
      );
    })
  );

  it.effect("rejects dangling mention, chosen-authority and candidate references", () =>
    Effect.gen(function* () {
      const { document, third, fourth } = yield* fixture;
      const replace = (replacement: CitationResolution) => ({
        ...document,
        resolutions: A.map(document.resolutions, (resolution) =>
          resolution.mentionId === fourth.id ? replacement : resolution
        ),
      });
      expect(
        isDocument(replace(CitationUnresolved.make({ mentionId: missingMention, reason: "no-matching-authority" })))
      ).toBe(false);
      expect(
        isDocument(
          replace(CitationResolved.make({ mentionId: fourth.id, authorityId: missingAuthority, confidence: O.none() }))
        )
      ).toBe(false);
      expect(
        isDocument({
          ...document,
          resolutions: A.map(document.resolutions, (resolution) =>
            resolution.mentionId === third.id
              ? CitationAmbiguous.make({
                  mentionId: third.id,
                  candidateAuthorityIds: [a, missingAuthority],
                  confidence: O.none(),
                })
              : resolution
          ),
        })
      ).toBe(false);
    })
  );

  it.effect("requires a present representative resolved to its own authority", () =>
    Effect.gen(function* () {
      const { document, third, first } = yield* fixture;
      const withRepresentative = (id: CitationMentionId) => ({
        ...document,
        authorities: [
          CitationAuthority.make({ id: a, representativeMentionId: id }),
          A.getUnsafe(document.authorities, 1),
        ],
      });
      expect(isDocument(withRepresentative(missingMention))).toBe(false);
      expect(isDocument(withRepresentative(third.id))).toBe(false);
      expect(
        isDocument({
          ...document,
          resolutions: A.map(document.resolutions, (resolution) =>
            resolution.mentionId === first.id
              ? CitationResolved.make({ mentionId: first.id, authorityId: b, confidence: O.none() })
              : resolution
          ),
        })
      ).toBe(false);
    })
  );

  it.effect("represents resources introduced by each non-full callback family without fabricating a full mention", () =>
    Effect.gen(function* () {
      const { document, receipt, third, fourth } = yield* fixture;
      const base = full("1");
      const meanings = [
        { ...base, type: "shortFormCase" },
        {
          type: "supra",
          components: {},
          metadata: { pinCite: null, parenthetical: null, antecedentGuess: null, volume: null },
        },
        { type: "reference", components: {}, metadata: base.metadata },
        { type: "id", components: {}, metadata: { pinCite: null, parenthetical: null } },
      ];
      for (const meaning of meanings) {
        const citation = yield* S.decodeUnknownEffect(Citation)(meaning);
        // Graph tests deliberately use format-only occurrence/resource IDs.
        // Semantic classification and private digest production are separate.
        const mentions = [CitationMention.make({ ...third, citation }), CitationMention.make({ ...fourth, citation })];
        const authorities = [CitationAuthority.make({ id: a, representativeMentionId: third.id })];
        const resolutions = A.map(mentions, (mention) =>
          CitationResolved.make({ mentionId: mention.id, authorityId: a, confidence: O.none() })
        );
        const graph = CitationDocument.make({ ...document, mentions, authorities, resolutions });
        const structural = CitationDocumentReceipt.make({
          ...receipt,
          authorities,
          resolutions,
          mentions: A.map(A.takeRight(receipt.mentions, 2), (mention) => ({ ...mention, citation })),
        });
        const restored = yield* S.decodeEffect(ReceiptJson)(yield* S.encodeEffect(ReceiptJson)(structural));
        expect(isDocument(graph)).toBe(true);
        expect(isReceipt(restored)).toBe(true);
        expect(citationAuthorityMembers(restored, a)).toEqual([third.id, fourth.id]);
        expect(A.getUnsafe(restored.authorities, 0).representativeMentionId).toBe(third.id);
        expect(A.every(restored.mentions, (mention) => mention.citation.type === citation.type)).toBe(true);
      }
    })
  );

  it.effect("rejects cross-source/artifact documents and dangling or self-referencing warnings", () =>
    Effect.gen(function* () {
      const { document, first } = yield* fixture;
      const changed = yield* fixtureSource(`${text} changed`);
      expect(isDocument({ ...document, source: changed.source })).toBe(false);
      expect(isDocument({ ...document, engineArtifact: Str.repeat(64)("b") })).toBe(false);
      const withWarning = (id: CitationMentionId) => ({
        ...document,
        mentions: A.map(document.mentions, (mention) =>
          mention.id === first.id
            ? CitationMention.make({ ...mention, warnings: [CitationOverlapWarning.make({ previousMentionId: id })] })
            : mention
        ),
      });
      expect(isDocument(withWarning(missingMention))).toBe(false);
      expect(isDocument(withWarning(first.id))).toBe(false);
    })
  );

  it.effect("retains empty documents and explicit unresolved outcomes without inventing groups", () =>
    Effect.gen(function* () {
      const { document } = yield* fixture;
      const empty = CitationDocument.make({ ...document, mentions: [], authorities: [], resolutions: [] });
      expect(isDocument(empty)).toBe(true);
      expect(citationAuthorityMembers(empty, a)).toEqual([]);
    })
  );

  it.effect("rejects singleton/duplicate ambiguity and confidence outside the unit interval", () =>
    Effect.gen(function* () {
      const { third } = yield* fixture;
      expect(
        S.is(CitationAmbiguous)({
          status: "Ambiguous",
          mentionId: third.id,
          candidateAuthorityIds: [a],
          confidence: O.none(),
        })
      ).toBe(false);
      expect(
        S.is(CitationAmbiguous)({
          status: "Ambiguous",
          mentionId: third.id,
          candidateAuthorityIds: [a, a],
          confidence: O.none(),
        })
      ).toBe(false);
      expect(
        S.is(CitationResolved)({ status: "Resolved", mentionId: third.id, authorityId: a, confidence: O.some(2) })
      ).toBe(false);
    })
  );

  it.effect.prop(
    "round-trips schema-generated bounded resolution assertions",
    {
      confidence: UnitInterval.pipe(S.OptionFromNullOr, Arbitrary.schema),
    },
    ({ confidence }) =>
      Effect.gen(function* () {
        const { receipt, first } = yield* fixture;
        const changed = CitationDocumentReceipt.make({
          ...receipt,
          resolutions: A.map(receipt.resolutions, (resolution) =>
            resolution.mentionId === first.id
              ? CitationResolved.make({ mentionId: first.id, authorityId: a, confidence })
              : resolution
          ),
        });
        const json = yield* S.encodeEffect(ReceiptJson)(changed);
        expect(yield* S.encodeEffect(ReceiptJson)(yield* S.decodeEffect(ReceiptJson)(json))).toBe(json);
      }),
    { arbitrary: fcRuns(25) }
  );
});
