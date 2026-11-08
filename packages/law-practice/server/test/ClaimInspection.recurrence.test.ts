import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import { ClaimInspectionWithLexicalEvidenceLive } from "@beep/law-practice-server/ClaimInspection";
import { ClaimInspection, UsptoClaimInputs, UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { ClaimInputInspection } from "@beep/law-practice-domain/values/ClaimElement";

const live = ClaimInspectionWithLexicalEvidenceLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("RecurrenceInspection.noAcquisition")(() =>
        Effect.fail(
          UsptoClaimsError.make({
            reason: "unavailable",
            message: "Source-led supplied-input control; no published acquisition.",
          })
        )
      ),
    })
  )
);
const inspect = Effect.fn("RecurrenceInspection.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const input = ClaimInputCollection.make({
    sourceKey: "recurrence-real-provider",
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
const rowHeads = (row: ClaimInputInspection): ReadonlyArray<string> =>
  row.decomposition.status === "decomposed"
    ? A.flatMap(row.decomposition.tree.elements, (element) => A.map(element.terms, (term) => term.head))
    : [];
const first = Effect.fn("RecurrenceInspection.first")(function* (text: string) {
  const report = yield* inspect([text]);
  return O.getOrThrow(A.head(report.records));
});

it.layer(live, { timeout: "30 seconds" })("recurrence grammar through actual preparation and fixed Wink", (it) => {
  it.effect("owns plural finite PP arguments across labels and licensed adjuncts", () =>
    Effect.gen(function* () {
      const positive = yield* first("A system comprising the sensors (4) reliably extend into the housing.");
      assert.strictEqual(positive.status, "complete");
      assert.deepStrictEqual(rowHeads(positive), ["system", "sensors", "housing"]);
      const singular = yield* first("A system comprising the sensor (4) reliably extend into the housing.");
      assert.strictEqual(singular.status, "partial");
    })
  );
  it.effect("keeps reduced NP modifiers separate from competing finite and nested owners", () =>
    Effect.gen(function* () {
      const positive = yield* first("A system comprising a plate depressed in the housing.");
      assert.strictEqual(positive.status, "complete");
      assert.deepStrictEqual(rowHeads(positive), ["system", "plate", "housing"]);
      for (const text of [
        "A system comprising the unit detects a plate depressed in the housing.",
        "A system comprising a plate near a cover depressed in the housing.",
      ]) {
        const row = yield* first(text);
        assert.strictEqual(row.status, "partial");
      }
    })
  );
  it.effect("distinguishes scalar auxiliary text from a complete quantified nominal", () =>
    Effect.gen(function* () {
      const scalar = yield* first("A system comprising the plate is at least partly formed from a panel.");
      assert.strictEqual(scalar.status, "complete");
      assert.deepStrictEqual(rowHeads(scalar), ["system", "plate", "panel"]);
      const quantity = yield* first("A system comprising at least one partly formed panel.");
      assert.strictEqual(quantity.status, "complete");
      assert.deepStrictEqual(rowHeads(quantity), ["system", "partly formed panel"]);
      const incomplete = yield* first("A system comprising the plate is at least partly formed from.");
      assert.strictEqual(incomplete.status, "partial");
    })
  );
  it.effect("requires complete shared alternatives and leaves singleton branches unproved", () =>
    Effect.gen(function* () {
      const exact = yield* first(
        "A system comprising an optical sensor or electrical sensor; said optical sensor or electrical sensor is mounted."
      );
      assert.strictEqual(exact.status, "complete");
      assert.deepStrictEqual(rowHeads(exact), [
        "system",
        "optical sensor or electrical sensor",
        "optical sensor or electrical sensor",
      ]);
      const branch = yield* first(
        "A system comprising an optical sensor or electrical sensor; the optical sensor is mounted."
      );
      assert.strictEqual(branch.status, "partial");
      if (branch.status !== "unchecked")
        assert.strictEqual(
          A.some(branch.findings, (finding) => finding.rule === "source-role-unresolved"),
          true
        );
      const selector = yield* first("A system comprising one side.");
      assert.strictEqual(selector.status, "partial");
      assert.deepStrictEqual(rowHeads(selector), ["system", "one side"]);
    })
  );
  it.effect("projects declarations and action coordination while keeping nominal action words", () =>
    Effect.gen(function* () {
      const declaration = yield* first("A method comprising the steps of: identifying a signal; storing a record.");
      assert.strictEqual(declaration.status, "complete");
      assert.deepStrictEqual(rowHeads(declaration), ["method", "signal", "record"]);
      if (declaration.decomposition.status === "decomposed")
        assert.deepStrictEqual(
          A.map(declaration.decomposition.tree.elements, (element) => element.kind),
          ["preamble-subject", "functional-relation", "functional-relation"]
        );
      const coordinated = yield* first("A system comprising identifying a signal and validating the signal.");
      assert.strictEqual(coordinated.status, "complete");
      assert.deepStrictEqual(rowHeads(coordinated), ["system", "signal", "signal"]);
      const nominal = yield* first("A system comprising an identifying mark and a validating surface.");
      assert.strictEqual(nominal.status, "complete");
      assert.deepStrictEqual(rowHeads(nominal), ["system", "identifying mark", "validating surface"]);
    })
  );
  it.effect("keeps alternative-branch uncertainty local to earlier terms and each actual route", () =>
    Effect.gen(function* () {
      const group = "A system comprising an optical sensor or electrical sensor.";
      const child = "The system of claim 1 wherein the optical sensor is mounted.";
      const controls: ReadonlyArray<readonly [A.NonEmptyReadonlyArray<string>, string, string]> = [
        [[group, child], "partial", "source-role-unresolved"],
        [["A system comprising a cover.", group, child], "complete", "definite-without-introduction"],
        [
          ["A system comprising the optical sensor is mounted; an optical sensor or electrical sensor."],
          "complete",
          "definite-without-introduction",
        ],
        [
          [group, "A system comprising a cover.", "The system of claims 1 or 2 wherein the optical sensor is mounted."],
          "partial",
          "source-role-unresolved",
        ],
      ];
      for (const [texts, status, rule] of controls) {
        const report = yield* inspect(texts);
        const row = O.getOrThrow(A.last(report.records));
        assert.strictEqual(row.status, status);
        if (row.status !== "unchecked")
          assert.strictEqual(
            A.some(
              row.findings,
              (finding) => finding.rule === rule && finding.referring.anchor.quote === "the optical sensor"
            ),
            true
          );
      }
    })
  );
  it.effect("declines boundary and mixed-group sources safely through the actual service", () =>
    Effect.gen(function* () {
      for (const text of [
        "In plate depressed in a housing, a system comprising a cover.",
        "In a plate depressed in a housing, a system comprising a cover.",
        "A system comprising an optical sensor or electrical sensor and acoustic sensor.",
        "A system comprising an optical sensor or electrical sensor, and acoustic sensor.",
      ]) {
        const row = yield* first(text);
        assert.strictEqual(row.status, "partial");
        if (row.status === "partial")
          assert.strictEqual(
            A.some(row.coverage, (issue) => issue.kind === "policy-uncovered"),
            true
          );
      }
    })
  );
  it.effect("retains unproved NUM prefixes without introducing them as generic plurals", () =>
    Effect.gen(function* () {
      for (const prefix of ["one", "zero", "eleven"]) {
        const row = yield* first(`A system comprising ${prefix} sensors.`);
        assert.strictEqual(row.status, "partial");
        assert.deepStrictEqual(rowHeads(row), ["system", `${prefix} sensors`]);
        if (row.status !== "unchecked")
          assert.strictEqual(
            A.some(
              row.findings,
              (finding) =>
                finding.rule === "unsupported-determiner" && finding.referring.anchor.quote === `${prefix} sensors`
            ),
            true
          );
      }
      for (const body of ["sensors", "two sensors", "at least one sensor", "one or more sensors"]) {
        const row = yield* first(`A system comprising ${body}.`);
        assert.strictEqual(row.status, "complete");
      }
    })
  );
  it.effect("keeps unsupported lexical witnesses adverse instead of inventing first-action or nominal proof", () =>
    Effect.gen(function* () {
      // These exact real-provider failures remain beside the injected normative
      // positives: neither a NOUN tag nor a competing split compound proves V.
      for (const text of [
        "A method comprising the steps of: detecting a signal; storing a record.",
        "A system comprising a plate or plate-like cover; said plate or plate-like cover is radial.",
      ]) {
        const row = yield* first(text);
        assert.strictEqual(row.status, "partial");
        if (row.status === "partial")
          assert.strictEqual(
            A.some(row.coverage, (issue) => issue.kind === "policy-uncovered"),
            true
          );
      }
    })
  );
  it.effect("preserves collective mismatch and outside findings separately on natural routes", () =>
    Effect.gen(function* () {
      const controls: ReadonlyArray<readonly [string, string]> = [
        ["A system comprising a pin.", "number-mismatch"],
        ["A system comprising a cover.", "antecedent-outside-chain"],
      ];
      for (const [ancestor, expected] of controls) {
        const report = yield* inspect([
          ancestor,
          "A system comprising a plurality of pins.",
          "The system of claim 1 wherein said plurality of pins are bowed.",
        ]);
        const row = O.getOrThrow(A.last(report.records));
        assert.strictEqual(row.status, "complete");
        if (row.status !== "unchecked")
          assert.strictEqual(
            A.some(
              row.findings,
              (finding) => finding.kind === expected && finding.referring.anchor.quote === "said plurality of pins"
            ),
            true
          );
      }
      const alternatives = yield* inspect([
        "A system comprising a plurality of pins.",
        "A system comprising a cover.",
        "The system of claims 1 or 2 wherein said plurality of pins are bowed.",
      ]);
      const row = O.getOrThrow(A.last(alternatives.records));
      assert.strictEqual(row.status, "complete");
      if (row.status !== "unchecked")
        assert.strictEqual(
          A.filter(
            row.findings,
            (finding) =>
              finding.kind === "antecedent-outside-chain" && finding.referring.anchor.quote === "said plurality of pins"
          ).length,
          1
        );
    })
  );
});
