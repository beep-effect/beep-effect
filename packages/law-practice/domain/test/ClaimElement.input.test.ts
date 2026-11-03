import {
  ClaimInputCollection,
  ClaimInputRecord,
  decomposeClaim,
  decomposeClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import {
  normalizeClaimInput,
  normalizePatentClaims,
  qualifyClaimInput,
} from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const claimInputType = S.toType(ClaimInputCollection);
const claimInputJson = S.fromJsonString(ClaimInputCollection);
const claimRecordJson = S.fromJsonString(ClaimInputRecord);
const claimRecordEquivalence = S.toEquivalence(ClaimInputRecord);

const textRecord = (sourceOrdinal: number, numberText: O.Option<string>) =>
  ClaimInputRecord.cases.text.make({
    sourceOrdinal,
    numberText,
    sourceText: "<claim>A fixture comprising a panel.</claim>",
    canonicalText: "A fixture comprising a panel.",
  });

describe("claim inspection source identity", () => {
  it.effect.prop(
    "roundtrips arbitrary source records without changing literal numbers or source fragments",
    [ClaimInputRecord],
    ([record]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(claimRecordJson)(record);
        const decoded = yield* S.decodeEffect(claimRecordJson)(encoded);
        assert.strictEqual(claimRecordEquivalence(decoded, record), true);
      }),
    { arbitrary: { seed: "claim-input-preservation-v1", runs: 100 } }
  );

  it.effect("preserves duplicate and missing literal numbers through the actual JSON codec", () =>
    Effect.gen(function* () {
      const input = ClaimInputCollection.make({
        sourceKey: "public-source",
        records: [textRecord(1, O.some("01")), textRecord(2, O.some("01")), textRecord(3, O.none())],
      });
      const encoded = yield* S.encodeEffect(claimInputJson)(input);
      const decoded = yield* S.decodeEffect(claimInputJson)(encoded);
      assert.deepStrictEqual(decoded, input);
      assert.deepStrictEqual(
        A.map(decoded.records, (record) => record.sourceOrdinal),
        [1, 2, 3]
      );
      assertNone(O.getOrThrow(A.last(decoded.records)).numberText);
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
      const actual = yield* S.decodeEffect(claimInputType)(input);
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
          S.decodeUnknownEffect(claimInputType)({ sourceKey: "public-source", records })
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
      const qualified = yield* qualifyClaimInput(input);
      assert.deepStrictEqual(
        A.map(qualified, ({ status }) => status),
        ["normalization-failed", "normalization-failed", "normalization-failed", "extraction-failed"]
      );
      assert.deepStrictEqual(
        A.map(qualified, ({ record }) => record),
        A.fromIterable(input.records)
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

const numberedInput = (texts: readonly [readonly [string, string], ...ReadonlyArray<readonly [string, string]>]) =>
  ClaimInputCollection.make({
    sourceKey: "qualified-document-version",
    records: A.map(texts, ([numberText, canonicalText], index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(numberText),
        sourceText: canonicalText,
        canonicalText,
      })
    ),
  });

describe("source dependency qualification", () => {
  it.effect("keeps independent siblings ready and propagates unavailable ancestry through every alternative", () =>
    Effect.gen(function* () {
      const input = numberedInput([
        ["1", "A fixture comprising a panel."],
        ["2", "A fragment without a transition."],
        ["3", "A fixture comprising a sensor."],
        ["4", "The fixture of claim 2 wherein the panel is metallic."],
        ["5", "The fixture of claim 4 wherein the panel is coated."],
        ["6", "The fixture of claims 1 or 5 wherein the panel is curved."],
        ["7", "The fixture of claim 3 wherein the sensor is optical."],
      ]);
      const result = yield* qualifyClaimInput(input);
      assert.deepStrictEqual(
        A.map(result, ({ status }) => status),
        [
          "context-ready",
          "normalization-failed",
          "context-ready",
          "context-unavailable",
          "context-unavailable",
          "context-unavailable",
          "context-ready",
        ]
      );
      assert.deepStrictEqual(
        A.map(result, ({ record }) => record),
        A.fromIterable(input.records)
      );
      const unknown = A.getSomes(
        A.map(result, (record) => (record.status === "context-unavailable" ? O.some(record.issues) : O.none()))
      );
      assert.deepStrictEqual(
        A.map(unknown, (issues) => A.map(issues, ({ kind }) => kind)),
        [["unnormalized-parent"], ["affected-ancestor"], ["affected-ancestor"]]
      );
    })
  );

  it.effect("blocks both duplicate identities even when only one can normalize", () =>
    Effect.gen(function* () {
      const result = yield* qualifyClaimInput(
        numberedInput([
          ["1", "A fixture comprising a panel."],
          ["01", "A fragment without a transition."],
          ["2", "The fixture of claim 1 wherein the panel is metallic."],
          ["3", "A fixture comprising a sensor."],
        ])
      );
      assert.deepStrictEqual(
        A.map(result, ({ status }) => status),
        ["context-unavailable", "normalization-failed", "context-unavailable", "context-ready"]
      );
      const first = O.getOrThrow(A.head(result));
      assert.strictEqual(first.status, "context-unavailable");
      if (first.status === "context-unavailable") assert.strictEqual(first.issues[0].kind, "duplicate-number");
    })
  );

  it.effect("does not infer a missing ancestor from record position", () =>
    Effect.gen(function* () {
      const result = yield* qualifyClaimInput(
        numberedInput([
          ["3", "A fixture comprising a panel."],
          ["4", "The fixture of claim 1 wherein the panel is metallic."],
        ])
      );
      assert.deepStrictEqual(
        A.map(result, ({ status }) => status),
        ["context-ready", "context-unavailable"]
      );
      const last = O.getOrThrow(A.last(result));
      if (last.status === "context-unavailable")
        assert.deepStrictEqual(last.issues, [{ kind: "missing-parent", parentClaimNumber: 1 }]);
    })
  );
});

describe("partial source structural decomposition", () => {
  it.effect("preserves a typed decomposition failure without rejecting a usable sibling", () =>
    Effect.gen(function* () {
      const input = numberedInput([
        ["1", ", comprising a sensor."],
        ["2", "A fixture comprising a panel."],
      ]);
      const outcomes = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(
        A.map(outcomes, ({ status }) => status),
        ["decomposition-failed", "decomposed"]
      );
      assert.deepStrictEqual(
        A.map(outcomes, ({ qualification }) => qualification.record),
        A.fromIterable(input.records)
      );
      const failed = O.getOrThrow(A.head(outcomes));
      if (failed.status === "decomposition-failed") assert.strictEqual(failed.cause.reason, "incoherent-tree");
    })
  );

  it.effect("actually decomposes independent siblings while preserving failed and affected records", () =>
    Effect.gen(function* () {
      const input = numberedInput([
        ["1", "A fixture comprising a panel."],
        ["2", "A fragment without a transition."],
        ["3", "A fixture comprising a sensor."],
        ["4", "The fixture of claim 2 wherein the panel is metallic."],
      ]);
      const outcomes = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(
        A.map(outcomes, ({ status }) => status),
        ["decomposed", "unchecked", "decomposed", "unchecked"]
      );
      assert.deepStrictEqual(
        A.map(outcomes, ({ qualification }) => qualification.record),
        A.fromIterable(input.records)
      );
      const trees = A.getSomes(
        A.map(outcomes, (outcome) => (outcome.status === "decomposed" ? O.some(outcome.tree) : O.none()))
      );
      assert.deepStrictEqual(
        A.map(trees, ({ claimNumber }) => claimNumber),
        [1, 3]
      );
      assert.isTrue(A.every(trees, ({ elements }) => A.isReadonlyArrayNonEmpty(elements)));
    })
  );

  it.effect("retains an all-unchecked source rather than returning an empty successful report", () =>
    Effect.gen(function* () {
      const input = numberedInput([
        ["1", "A fragment without a transition."],
        ["2", "The fixture of claim 1 wherein the panel is metallic."],
      ]);
      const outcomes = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(
        A.map(outcomes, ({ status }) => status),
        ["unchecked", "unchecked"]
      );
      assert.deepStrictEqual(
        A.map(outcomes, ({ qualification }) => qualification.record),
        A.fromIterable(input.records)
      );
    })
  );

  it.effect("produces byte-equivalent tree values through strict and input paths on wholly valid input", () =>
    Effect.gen(function* () {
      const texts = [
        ["1", "A fixture comprising a panel."],
        ["2", "The fixture of claim 1 wherein the panel is metallic."],
      ] as const;
      const claims = yield* normalizePatentClaims(texts);
      const strict = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      const outcomes = yield* decomposeClaimInput(numberedInput(texts));
      const actual = A.getSomes(
        A.map(outcomes, (outcome) => (outcome.status === "decomposed" ? O.some(outcome.tree) : O.none()))
      );
      assert.deepStrictEqual(actual, strict);
    })
  );
});
