import {
  antecedentPolicy,
  ClaimInputCollection,
  ClaimInputInspectionReport,
  ClaimInputRecord,
  decomposeClaim,
  inspectClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const inputOf = (...texts: readonly [readonly [string, string], ...ReadonlyArray<readonly [string, string]>]) =>
  ClaimInputCollection.make({
    sourceKey: "synthetic-policy-source",
    records: A.map(texts, ([number, text], index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(number),
        sourceText: text,
        canonicalText: text,
      })
    ),
  });
const findingsOf = (report: ClaimInputInspectionReport) =>
  A.flatMap(report.records, (record) => (record.status === "unchecked" ? [] : record.findings));

describe("failure-preserving source inspection policy", () => {
  it.effect("checks usable siblings, preserves failures, and never treats incomplete global coverage as clean", () =>
    Effect.gen(function* () {
      const input = inputOf(
        ["1", "A fixture comprising a panel."],
        ["2", "A fragment without a transition."],
        ["3", "A fixture comprising the sensor."],
        ["4", "Fixture of claim 2 wherein a relay."]
      );
      const report = yield* inspectClaimInput(input);
      assert.strictEqual(report.indexStatus, "incomplete");
      assert.deepStrictEqual(
        A.map(report.records, ({ status }) => status),
        ["partial", "unchecked", "partial", "unchecked"]
      );
      assert.deepStrictEqual(
        A.map(report.records, ({ decomposition }) => decomposition.qualification.record),
        input.records
      );
      assert.deepStrictEqual(report.input, input);
      assert.isTrue(A.every(findingsOf(report), (finding) => finding.kind === "pattern-not-covered"));
      assert.isTrue(A.some(findingsOf(report), (finding) => finding.rule === "source-index-incomplete"));
      const first = O.getOrThrow(A.head(report.records));
      if (first.status === "partial") {
        assert.strictEqual(first.findings.length, 0);
        assert.deepStrictEqual(first.coverage, [{ kind: "global-index-incomplete" }]);
      }
    })
  );

  it.effect("propagates decomposition failure through every alternative and descendants without referring terms", () =>
    Effect.gen(function* () {
      const report = yield* inspectClaimInput(
        inputOf(
          ["1", ", comprising a sensor."],
          ["2", "A fixture comprising a panel."],
          ["3", "Fixture of claims 1 or 2 wherein a relay."],
          ["4", "Fixture of claim 3 wherein a switch."]
        )
      );
      assert.deepStrictEqual(
        A.map(report.records, ({ status }) => status),
        ["unchecked", "partial", "unchecked", "unchecked"]
      );
      const failed = O.getOrThrow(A.head(report.records));
      assert.strictEqual(failed.decomposition.status, "decomposition-failed");
      for (const { index, parentClaimNumber } of [
        { index: 2, parentClaimNumber: 1 },
        { index: 3, parentClaimNumber: 3 },
      ]) {
        const record = O.getOrThrow(A.get(report.records, index));
        assert.strictEqual(record.decomposition.status, "decomposed");
        if (record.status === "unchecked")
          assert.deepStrictEqual(record.coverage, [{ kind: "ancestor-unavailable", parentClaimNumber }]);
      }
      const codec = S.fromJsonString(ClaimInputInspectionReport);
      const encoded = yield* S.encodeEffect(codec)(report);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      assert.isTrue(S.toEquivalence(ClaimInputInspectionReport)(decoded, report));
    })
  );

  it.effect(
    "turns outside-chain accusations into explicit uncovered findings when the global index is incomplete",
    () =>
      Effect.gen(function* () {
        const report = yield* inspectClaimInput(
          inputOf(
            ["1", "A fixture comprising a sensor."],
            ["2", "A fixture comprising the sensor."],
            ["3", "Unsupported source fragment."]
          )
        );
        const findings = findingsOf(report);
        assert.isTrue(A.some(findings, (finding) => finding.rule === "source-index-incomplete"));
        assert.isFalse(
          A.some(
            findings,
            (finding) => finding.kind === "antecedent-outside-chain" || finding.kind === "missing-antecedent"
          )
        );
      })
  );

  it.effect("retains supported in-chain ambiguity and grammatical-number mismatch despite an unavailable sibling", () =>
    Effect.gen(function* () {
      const report = yield* inspectClaimInput(
        inputOf(
          ["1", "A fixture comprising a panel; a panel; the panel is rigid."],
          ["2", "A fixture comprising a sensor; the sensors are active."],
          ["3", "Unsupported source fragment."]
        )
      );
      assert.isTrue(A.some(findingsOf(report), (finding) => finding.kind === "ambiguous-antecedent"));
      assert.isTrue(A.some(findingsOf(report), (finding) => finding.kind === "number-mismatch"));
      assert.isTrue(A.every(A.take(report.records, 2), (record) => record.status === "partial"));
    })
  );

  it.effect("matches strict policy findings and complete coverage for wholly valid supported input", () =>
    Effect.gen(function* () {
      const input = inputOf(
        ["1", "A fixture comprising a panel."],
        ["2", "The fixture of claim 1 wherein the panel includes a liner."],
        ["3", "A fixture comprising the switch."]
      );
      const strict = yield* normalizePatentClaims(
        A.map(input.records, (record): readonly [string, string] => [
          O.getOrThrow(record.numberText),
          record.kind === "text" ? record.canonicalText : "",
        ])
      );
      const trees = yield* Effect.forEach(strict, (claim) => decomposeClaim(claim, strict));
      const report = yield* inspectClaimInput(input);
      assert.strictEqual(report.indexStatus, "complete");
      assert.isTrue(A.every(report.records, (record) => record.status === "complete"));
      assert.deepStrictEqual(findingsOf(report), antecedentPolicy(trees, strict));
      const codec = S.fromJsonString(ClaimInputInspectionReport);
      const encoded = yield* S.encodeEffect(codec)(report);
      const decoded = yield* S.decodeEffect(codec)(encoded);
      assert.deepStrictEqual(decoded, report);
    })
  );

  it.effect("returns every unusable source record as explicitly unchecked", () =>
    Effect.gen(function* () {
      const input = ClaimInputCollection.make({
        sourceKey: "all-unavailable",
        records: [
          ClaimInputRecord.cases.unavailable.make({
            sourceOrdinal: 1,
            numberText: O.none(),
            sourceText: "&broken;",
            reason: "invalid-text",
          }),
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: 2,
            numberText: O.some("2"),
            sourceText: "Unsupported fragment.",
            canonicalText: "Unsupported fragment.",
          }),
        ],
      });
      const report = yield* inspectClaimInput(input);
      assert.strictEqual(report.indexStatus, "incomplete");
      assert.deepStrictEqual(
        A.map(report.records, ({ status }) => status),
        ["unchecked", "unchecked"]
      );
      assert.deepStrictEqual(
        A.map(report.records, ({ decomposition }) => decomposition.qualification.record),
        input.records
      );
    })
  );

  it.effect("reports policy abstentions as partial even when every source record decomposes", () =>
    Effect.gen(function* () {
      const report = yield* inspectClaimInput(inputOf(["1", "A fixture comprising a housing; its forward part."]));
      assert.strictEqual(report.indexStatus, "complete");
      const record = O.getOrThrow(A.head(report.records));
      assert.strictEqual(record.status, "partial");
      if (record.status === "partial") assert.deepStrictEqual(record.coverage, [{ kind: "policy-uncovered" }]);
    })
  );

  it.effect("rejects a dropped source row or a complete label on an incomplete inspection ledger", () =>
    Effect.gen(function* () {
      const report = yield* inspectClaimInput(
        inputOf(["1", "A fixture comprising a sensor."], ["2", "Unsupported fragment."])
      );
      const decode = S.decodeUnknownEffect(S.toType(ClaimInputInspectionReport));
      const omitted = yield* Effect.flip(decode({ ...report, records: A.take(report.records, 1) }));
      assert.strictEqual(omitted._tag, "SchemaError");
      const mislabeled = yield* Effect.flip(decode({ ...report, indexStatus: "complete" }));
      assert.strictEqual(mislabeled._tag, "SchemaError");
    })
  );
});
