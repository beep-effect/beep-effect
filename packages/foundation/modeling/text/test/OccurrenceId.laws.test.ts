import { fcRuns } from "@beep/fc-runs";
import { mintContentHashResult } from "@beep/jsonc/Mint";
import { it } from "@beep/test-runner";
import { Anchored, mintOccurrenceId, OccurrencePreimage } from "@beep/text/Occurrence";
import { mintQuoteKey } from "@beep/text/QuoteKey";
import { SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  anchoredCase,
  anchoredOn,
  sha256,
  sourceFor,
  textDigestOf,
  wellFormedText,
  wellFormedTextWith,
} from "./support/generators.ts";
import {
  citationQuoteKey,
  firstCitation,
  firstCitationId,
  memoryNote,
  memoryNoteId,
  secondCitation,
  secondCitationId,
} from "./support/goldens.ts";

const runs = { arbitrary: fcRuns(100) };

const AnchoredJson = S.fromJsonString(Anchored);
const mintSync = OccurrencePreimage.mintResult(sha256);

const idsOf = (rows: ReadonlyArray<Anchored>) => Effect.forEach(rows, mintOccurrenceId, { concurrency: 1 });
const keysOf = (rows: ReadonlyArray<Anchored>) =>
  Effect.forEach(rows, (row) => mintQuoteKey(Anchored.quote(row), "nfkc-dehyphenate/v1"), { concurrency: 1 });

const boilerplateThriceWithFillerCase = Arbitrary.flatMap(
  Arbitrary.all({
    passage: wellFormedText,
    first: wellFormedTextWith({ minLength: 0, maxLength: 20 }),
    second: wellFormedTextWith({ minLength: 0, maxLength: 20 }),
  }),
  ({ passage, first, second }) => {
    const q = passage.text;
    const text = `${q}${first.text}${q}${second.text}${q}`;
    const starts = [0, Str.length(q) + Str.length(first.text), text.length - Str.length(q)];
    return Arbitrary.map(sourceFor(text), (source) => ({
      quote: q,
      rows: A.map(starts, (start) => anchoredOn(source, text, { start, end: start + Str.length(q) })),
    }));
  }
);

const withSource = (anchored: Anchored, change: (source: SourceTextIdentity) => SourceTextIdentity): Anchored =>
  Anchored.make({
    receipt: TextAnchorVerificationReceipt.make({
      anchor: anchored.receipt.anchor,
      source: change(anchored.receipt.source),
    }),
  });

const withFields = (
  anchored: Anchored,
  fields: Partial<{ -readonly [K in keyof SourceTextIdentity]: SourceTextIdentity[K] }>
): Anchored => withSource(anchored, (source) => SourceTextIdentity.make({ ...source, ...fields }));

const withExtractor = (anchored: Anchored, extractor: { readonly name: string; readonly version: string }) =>
  withFields(anchored, { extractor: SourceTextExtractor.make(extractor) });

const singleFieldChangesUnderNonEmptySalt: ReadonlyArray<
  readonly [string, (anchored: Anchored, salt: string) => Anchored]
> = [
  ["scopeRef", (a, salt) => withFields(a, { scopeRef: `${a.receipt.source.scopeRef}${salt}` })],
  ["sourceRef", (a, salt) => withFields(a, { sourceRef: `${a.receipt.source.sourceRef}${salt}` })],
  [
    "locator",
    (a, salt) =>
      withFields(a, {
        locator: SourceTextLocator.make(`${a.receipt.source.locator}/${Str.replaceAll("\\", "/")(salt)}`),
      }),
  ],
  [
    "sourceDigest",
    (a, salt) => withFields(a, { sourceDigest: textDigestOf(`${a.receipt.source.sourceDigest}${salt}`) }),
  ],
  ["textDigest", (a, salt) => withFields(a, { textDigest: textDigestOf(`${a.receipt.source.textDigest}${salt}`) })],
  [
    "extractor name",
    (a, salt) => withExtractor(a, { ...a.receipt.source.extractor, name: `${a.receipt.source.extractor.name}${salt}` }),
  ],
  [
    "extractor version",
    (a, salt) =>
      withExtractor(a, { ...a.receipt.source.extractor, version: `${a.receipt.source.extractor.version}${salt}` }),
  ],
  [
    "normalizationVersion",
    (a, salt) => withFields(a, { normalizationVersion: `${a.receipt.source.normalizationVersion}${salt}` }),
  ],
  [
    "quote",
    (a) => {
      const { startChar, endChar, quote } = a.receipt.anchor;
      const xs = Str.repeat(Str.length(quote))("x");
      return Anchored.make({
        receipt: TextAnchorVerificationReceipt.make({
          anchor: TextAnchor.make({
            startChar,
            endChar,
            quote: xs === quote ? Str.repeat(Str.length(quote))("y") : xs,
          }),
          source: a.receipt.source,
        }),
      });
    },
  ],
  [
    "range",
    (a, salt) => {
      const { startChar, endChar, quote } = a.receipt.anchor;
      const shift = Str.length(salt);
      return Anchored.make({
        receipt: TextAnchorVerificationReceipt.make({
          anchor: TextAnchor.make({ startChar: startChar + shift, endChar: endChar + shift, quote }),
          source: a.receipt.source,
        }),
      });
    },
  ],
];

const nonEmptySaltArbitrary = Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 6 }), ({ text }) => text);

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("@beep/text OccurrenceId laws", (it) => {
  it.effect.prop(
    "L1-4 occurrence ids differ across repeated boilerplate and survive serialization",
    [boilerplateThriceWithFillerCase],
    ([{ quote, rows }]) =>
      Effect.gen(function* () {
        const ids = yield* idsOf(rows);
        expect(HashSet.size(HashSet.fromIterable(ids))).toBe(3);
        const keys = yield* keysOf(rows);
        expect(HashSet.size(HashSet.fromIterable(keys))).toBe(1);
        expect(A.map(rows, Anchored.quote)).toEqual([quote, quote, quote]);
        for (const [row, id] of A.zip(rows, ids)) {
          const reread = yield* S.encodeEffect(AnchoredJson)(row).pipe(Effect.flatMap(S.decodeEffect(AnchoredJson)));
          const rereadId = yield* mintOccurrenceId(reread);
          expect(rereadId).toBe(id);
          assertSuccess(mintSync(reread), id);
        }
      }),
    runs
  );

  it.effect.prop(
    "L1-4 changing any one preimage field changes the id",
    [anchoredCase, nonEmptySaltArbitrary],
    ([{ anchored }, salt]) =>
      Effect.gen(function* () {
        const id = yield* mintOccurrenceId(anchored);
        for (const [field, change] of singleFieldChangesUnderNonEmptySalt) {
          const changed = yield* mintOccurrenceId(change(anchored, salt));
          expect(changed, field).not.toBe(id);
        }
      }),
    runs
  );

  it.prop(
    "L1-4 the encoded preimage hashes every slot, start and end included",
    [anchoredCase],
    ([{ anchored }]) => {
      const encoded = Result.getOrThrow(S.encodeResult(OccurrencePreimage.schema)(anchored));
      const id = Result.getOrThrow(mintSync(anchored));
      const mint = mintContentHashResult(sha256);
      assertSuccess(mint(OccurrencePreimage.domainTag, encoded), id);
      for (const slot of [9, 10]) {
        const shifted = O.getOrThrow(A.modify(encoded, slot, (value) => Number(value) + 1));
        expect(
          Result.getOrThrow(mint(OccurrencePreimage.domainTag, shifted)),
          `range slot ${slot} shifted in the encoded preimage (a valid row binds it to the quote width)`
        ).not.toBe(id);
      }
    },
    runs
  );

  it.effect(
    "L1-4 the occurrence and quote-key goldens, through the Digest service and the sync twin",
    Effect.fnUntraced(function* () {
      for (const [row, golden] of [
        [firstCitation, firstCitationId],
        [secondCitation, secondCitationId],
        [memoryNote, memoryNoteId],
      ] as const) {
        const id = yield* mintOccurrenceId(row);
        expect(id).toBe(golden);
        assertSuccess(mintSync(row), golden);
      }
      const keys = yield* keysOf([firstCitation, secondCitation]);
      expect(keys).toEqual([citationQuoteKey, citationQuoteKey]);
    })
  );

  it.effect(
    "L1-4 examiner boilerplate repeated three times is three occurrences and one quote key",
    Effect.fnUntraced(function* () {
      const boilerplate = "The examiner maintains the rejection.";
      const brokenAcrossALine = "The exam-\niner maintains the rejection.";
      const copies = [boilerplate, boilerplate, brokenAcrossALine];
      const text = A.join(copies, " Claim. ");
      const source = withFields(firstCitation, { textDigest: textDigestOf(text) }).receipt.source;
      const starts = A.scan(A.dropRight(copies, 1), 0, (start, copy) => start + Str.length(copy) + 8);
      const rows = A.map(A.zip(starts, copies), ([start, copy]) =>
        anchoredOn(source, text, { start, end: start + Str.length(copy) })
      );
      expect(A.map(rows, Anchored.quote)).toEqual(copies);
      const ids = yield* idsOf(rows);
      expect(HashSet.size(HashSet.fromIterable(ids))).toBe(3);
      const keys = yield* keysOf(rows);
      expect(
        HashSet.size(HashSet.fromIterable(keys)),
        "the copy broken across a line shares the quote key through normalization, not equal bytes"
      ).toBe(1);
    })
  );
});
