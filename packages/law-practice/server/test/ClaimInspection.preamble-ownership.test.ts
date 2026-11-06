import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import { ClaimInspectionWithLexicalEvidenceLive } from "@beep/law-practice-server/ClaimInspection";
import { ClaimInspection, UsptoClaimInputs, UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";

const live = ClaimInspectionWithLexicalEvidenceLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("PreambleOwnership.noAcquisition")(() =>
        Effect.fail(
          UsptoClaimsError.make({
            reason: "unavailable",
            message: "Source-only supplied-input ownership control; no published acquisition.",
          })
        )
      ),
    })
  )
);
const inspect = Effect.fn("PreambleOwnership.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const input = ClaimInputCollection.make({
    sourceKey: "source-preamble-ownership-control",
    records: A.map(texts, (text, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: text,
        canonicalText: text,
      })
    ),
  });
  return yield* ClaimInspection.use((service) => service.inspect(input));
});
const treeAt = (report: ClaimInputInspectionReport, index: number) => {
  const row = O.getOrThrow(A.get(report.records, index));
  assert.strictEqual(row.decomposition.status, "decomposed");
  if (row.decomposition.status !== "decomposed") throw new Error("Source control must decompose.");
  return row.decomposition.tree;
};
const parent = "A cap with a strip, wherein the cap is mounted.";
it.layer(live, { timeout: "30 seconds" })("fixed-provider preamble ownership routes", (it) => {
  it.effect("retains an actual preamble PP introduction for its dependent reference", () =>
    Effect.gen(function* () {
      const report = yield* inspect([parent, "The cap of claim 1, wherein the strip is mounted."]);
      const root = O.getOrThrow(A.head(treeAt(report, 0).elements));
      assert.deepStrictEqual(
        A.map(root.terms, (term) => term.anchor.quote),
        ["A cap", "a strip"]
      );
      const child = treeAt(report, 1);
      const edge = A.findFirst(
        child.edges,
        (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the strip"
      );
      assert.strictEqual(O.isSome(edge), true);
      if (O.isSome(edge) && edge.value.kind === "antecedent") {
        assert.strictEqual(edge.value.introducing.path, "1");
        assert.strictEqual(edge.value.introducing.anchor.quote, "a strip");
      }
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.head(child.elements)).terms, (term) => term.anchor.quote),
        ["The cap"]
      );
    })
  );
  it.effect("preserves a whole quoted core without an interior strip donor", () =>
    Effect.gen(function* () {
      const report = yield* inspect([
        'A "strip" sensor, wherein the sensor is mounted.',
        "The sensor of claim 1, wherein the strip is mounted.",
      ]);
      const root = O.getOrThrow(A.head(treeAt(report, 0).elements));
      assert.deepStrictEqual(
        A.map(root.terms, (term) => term.anchor.quote),
        ['A "strip" sensor']
      );
      const child = treeAt(report, 1);
      assert.strictEqual(
        A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the strip"),
        false
      );
    })
  );
  it.effect("keeps sibling introductions outside the actual ancestor route", () =>
    Effect.gen(function* () {
      const report = yield* inspect([
        parent,
        "A cover, wherein the cover is mounted.",
        "The cover of claim 2, wherein the strip is mounted.",
      ]);
      const child = treeAt(report, 2);
      assert.strictEqual(
        A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the strip"),
        false
      );
      const record = O.getOrThrow(A.get(report.records, 2));
      if (record.status !== "unchecked")
        assert.strictEqual(
          A.some(
            record.findings,
            (finding) => finding.rule === "outside-chain" && finding.referring.anchor.quote === "the strip"
          ),
          true
        );
    })
  );
});

it.layer(live, { timeout: "30 seconds" })("fixed-provider dependency introducers", (it) => {
  it.effect("excludes complete dependency syntax while preserving a technical accordance noun", () =>
    Effect.gen(function* () {
      const report = yield* inspect([
        "An accordance sensor, wherein the sensor is mounted.",
        "The sensor in accordance with claim 1, wherein the sensor is mounted.",
      ]);
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.head(treeAt(report, 0).elements)).terms, (t) => t.anchor.quote),
        ["An accordance sensor"]
      );
      const child = treeAt(report, 1);
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.head(child.elements)).terms, (t) => t.anchor.quote),
        ["The sensor"]
      );
      assert.strictEqual(
        A.some(child.edges, (e) => e.kind === "antecedent" && e.referring.anchor.quote === "accordance"),
        false
      );
    })
  );
  it.effect("retains an ordinary calibration-signal NP outside the exact citation introducer", () =>
    Effect.gen(function* () {
      const report = yield* inspect([
        "A sensor, wherein the sensor is mounted.",
        "The sensor in accordance with a calibration signal of claim 1, wherein the sensor is mounted.",
      ]);
      const root = O.getOrThrow(A.head(treeAt(report, 1).elements));
      assert.strictEqual(
        A.some(root.terms, (t) => t.anchor.quote === "a calibration signal"),
        true
      );
    })
  );
});
