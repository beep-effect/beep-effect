import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizeClaimInput, normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const textRecord = (sourceOrdinal: number, numberText: O.Option<string>) =>
  ClaimInputRecord.cases.text.make({
    sourceOrdinal,
    numberText,
    sourceText: "<claim>A fixture comprising a panel.</claim>",
    canonicalText: "A fixture comprising a panel.",
  });

describe("claim inspection source identity", () => {
  it.effect("preserves duplicate and missing literal numbers through the actual JSON codec", () =>
    Effect.gen(function* () {
      const input = ClaimInputCollection.make({
        sourceKey: "public-source",
        records: [textRecord(1, O.some("01")), textRecord(2, O.some("01")), textRecord(3, O.none())],
      });
      const codec = S.fromJsonString(ClaimInputCollection);
      const encoded = yield* S.encodeEffect(codec)(input);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      assert.deepStrictEqual(decoded, input);
      assert.deepStrictEqual(
        A.map(decoded.records, (record) => record.sourceOrdinal),
        [1, 2, 3]
      );
      assert.isTrue(O.isNone(O.getOrThrow(A.last(decoded.records)).numberText));
    })
  );

  it.effect("keeps an unavailable record alongside valid text without inventing a claim", () =>
    Effect.gen(function* () {
      const failed = ClaimInputRecord.cases.unavailable.make({
        sourceOrdinal: 2,
        numberText: O.some("not-a-number"),
        sourceText: "<claim>&broken;</claim>",
        reason: "invalid-text",
      });
      const input = ClaimInputCollection.make({
        sourceKey: "public-source",
        records: [textRecord(1, O.some("1")), failed, textRecord(3, O.some("3"))],
      });
      const actual = yield* S.decodeEffect(S.toType(ClaimInputCollection))(input);
      assert.deepStrictEqual(actual.records[1], failed);
      assert.strictEqual(actual.records.length, 3);
      assert.strictEqual(failed.sourceText, "<claim>&broken;</claim>");
    })
  );

  it.effect("rejects empty input and missing, repeated or reordered source positions", () =>
    Effect.gen(function* () {
      for (const records of [
        [],
        [textRecord(1, O.some("1")), textRecord(3, O.some("3"))],
        [textRecord(1, O.some("1")), textRecord(1, O.some("2"))],
        [textRecord(2, O.some("1")), textRecord(1, O.some("2"))],
      ]) {
        const failure = yield* Effect.flip(
          S.decodeUnknownEffect(S.toType(ClaimInputCollection))({ sourceKey: "public-source", records })
        );
        assert.strictEqual(failure._tag, "SchemaError");
      }
    })
  );
});

describe("independent source-record normalization", () => {
  it.effect("retains every source record when a malformed sibling fails normalization", () =>
    Effect.gen(function* () {
      const texts = [
        ["1", "A fixture comprising a panel."],
        ["2", "Unsupported fragment without transition."],
        ["3", "A fixture comprising a sensor."],
        ["4", "The fixture of claim 2 wherein the panel is metallic."],
      ] as const;
      const input = ClaimInputCollection.make({
        sourceKey: "immutable-document-version",
        records: A.map(texts, ([numberText, canonicalText], index) =>
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: index + 1,
            numberText: O.some(numberText),
            sourceText: canonicalText,
            canonicalText,
          })
        ),
      });
      const results = yield* normalizeClaimInput(input);
      assert.deepStrictEqual(
        A.map(results, ({ status }) => status),
        ["normalized", "normalization-failed", "normalized", "normalized"]
      );
      assert.deepStrictEqual(
        A.map(results, ({ record }) => record),
        A.fromIterable(input.records)
      );
      // Parsing a reference is not a claim that its failed ancestor is available.
      const strictFailure = yield* Effect.flip(normalizePatentClaims(texts));
      assert.strictEqual(strictFailure.reason, "invalid-claim");
    })
  );

  it.effect("retains invalid number text, missing numbers and unavailable text even when no claim normalizes", () =>
    Effect.gen(function* () {
      const input = ClaimInputCollection.make({
        sourceKey: "failed-version",
        records: [
          textRecord(1, O.some("0")),
          textRecord(2, O.some("not-a-number")),
          textRecord(3, O.none()),
          ClaimInputRecord.cases.unavailable.make({
            sourceOrdinal: 4,
            numberText: O.some("4"),
            sourceText: "",
            reason: "empty-text",
          }),
        ],
      });
      const results = yield* normalizeClaimInput(input);
      assert.deepStrictEqual(
        A.map(results, ({ status }) => status),
        ["normalization-failed", "normalization-failed", "normalization-failed", "extraction-failed"]
      );
      assert.deepStrictEqual(
        A.map(results, ({ record }) => record),
        A.fromIterable(input.records)
      );
    })
  );

  it.effect("uses exactly the strict claim parser for wholly valid records", () =>
    Effect.gen(function* () {
      const texts = [
        ["1", "A fixture comprising a panel."],
        ["2", "The fixture of claim 1 wherein the panel is metallic."],
      ] as const;
      const input = ClaimInputCollection.make({
        sourceKey: "valid-version",
        records: A.map(texts, ([numberText, canonicalText], index) =>
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: index + 1,
            numberText: O.some(numberText),
            sourceText: canonicalText,
            canonicalText,
          })
        ),
      });
      const outcomes = yield* normalizeClaimInput(input);
      const actual = A.getSomes(
        A.map(outcomes, (outcome) => (outcome.status === "normalized" ? O.some(outcome.claim) : O.none()))
      );
      const expected = yield* normalizePatentClaims(texts);
      assert.deepStrictEqual(actual, A.fromIterable(expected));
    })
  );
});
