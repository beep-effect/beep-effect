import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import {
  ClaimInspectionWithLexicalEvidenceLive,
  claimInspectionWithTokenizationLayer,
} from "@beep/law-practice-server/ClaimInspection";
import { ClaimInspection, UsptoClaimInputs, UsptoClaimsError } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { WinkEngineError } from "@beep/wink";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";

const live = ClaimInspectionWithLexicalEvidenceLive.pipe(
  Layer.provide(
    Layer.succeed(UsptoClaimInputs, {
      inputs: Effect.fn("LexicalRuntime.noAcquisition")(() =>
        Effect.fail(UsptoClaimsError.make({ reason: "unavailable", message: "Supplied-source test only." }))
      ),
    })
  )
);
const inspect = Effect.fn("LexicalInspectionTest.inspect")(function* (texts: A.NonEmptyReadonlyArray<string>) {
  const input = ClaimInputCollection.make({
    sourceKey: "synthetic-source-role",
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
const heads = (report: ClaimInputInspectionReport) =>
  A.map(report.records, ({ decomposition }) =>
    decomposition.status === "decomposed"
      ? A.flatMap(decomposition.tree.elements, (element) => A.map(element.terms, ({ head }) => head))
      : []
  );

it.layer(live, { timeout: "30 seconds" })("fixed lexical inspection runtime", (it) => {
  it.effect(
    "covers many independent plural objects without charging unused alias comparisons",
    Effect.fnUntraced(function* () {
      const text = "A fixture comprising sensors.";
      const report = yield* inspect(A.prepend(A.replicate(text, 199), text));
      assert.strictEqual(report.records.length, 200);
      assert.isTrue(A.every(report.records, (record) => record.status === "complete"));
      assert.isTrue(A.every(report.records, (record) => record.status !== "unchecked" && record.findings.length === 0));
    })
  );
  it.effect(
    "preserves complete possessive source nominals and consumes full auxiliary chains",
    Effect.fnUntraced(function* () {
      for (const apostrophe of ["'", "’"]) {
        const report = yield* inspect([`A fixture comprising a nut; the nut${apostrophe}s shaft has a surface.`]);
        assert.deepStrictEqual(heads(report), [["fixture", "nut", `nut${apostrophe}s shaft`, "surface"]]);
        const row = O.getOrThrow(A.head(report.records));
        assert.notStrictEqual(row.status, "unchecked");
        if (row.status === "unchecked") return;
        assert.isTrue(
          A.some(row.decomposition.tree.elements, (element) =>
            A.some(element.terms, (term) => term.anchor.quote === `the nut${apostrophe}s shaft`)
          )
        );
      }
      const chain = yield* inspect([
        "A system comprising a controller that can efficiently process data and does not transmit signals.",
      ]);
      assert.deepStrictEqual(heads(chain), [["system", "controller", "data", "signals"]]);
      const functional = yield* inspect(["A system comprising a controller can efficiently process data."]);
      const functionalRow = O.getOrThrow(A.head(functional.records));
      if (functionalRow.status === "unchecked") return;
      assert.isTrue(
        A.some(functionalRow.decomposition.tree.elements, (element) => element.kind === "functional-relation")
      );
      assert.isTrue(A.some(functionalRow.decomposition.tree.edges, (edge) => edge.kind === "functional"));
    })
  );
  it.effect(
    "distinguishes auxiliary operators, property clauses and lexical functional relations",
    Effect.fnUntraced(function* () {
      const report = yield* inspect(['A system comprising a "HAS" label; a vessel has a surface.']);
      assert.deepStrictEqual(heads(report), [["system", '"has" label', "vessel", "surface"]]);
      const row = O.getOrThrow(A.head(report.records));
      assert.strictEqual(row.status, "complete");
      if (row.status === "unchecked") return;
      const vessel = O.getOrThrow(A.get(row.decomposition.tree.elements, 2));
      assert.strictEqual(vessel.kind, "limitation");
      assert.isFalse(
        A.some(row.decomposition.tree.edges, (edge) => edge.kind === "functional" && edge.element === vessel.path)
      );
    })
  );
  it.effect(
    "cooperates across passive, predicative and clausal complement frames",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a welded joint is welded to a frame; a helper is present at the first location; a module to process data and to determine when a robot is tipping away.",
      ]);
      assert.deepStrictEqual(heads(report), [
        ["system", "welded joint", "frame", "helper", "first location", "module", "data", "robot"],
      ]);
    })
  );
  it.effect(
    "preserves ambiguous process compounds, prepositional complements and quoted names",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        'A system comprising a data communications system; assembling mating connectors; a link to a cover plate; a "configured to cover" unit.',
      ]);
      assert.deepStrictEqual(heads(report), [
        [
          "system",
          "data communications system",
          "assembling mating connectors",
          "link",
          "cover plate",
          '"configured to cover" unit',
        ],
      ]);
    })
  );
  it.effect(
    "binds a source-explicit prefix alias and preserves the finite object's missing basis",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising an ETE cyclic redundancy check (CRC) flit; the ETE CRC flit covers the packet.",
      ]);
      assert.deepStrictEqual(heads(report), [
        ["system", "ete cyclic redundancy check (crc) flit", "ete crc flit", "packet"],
      ]);
      const record = O.getOrThrow(A.head(report.records));
      assert.notStrictEqual(record.status, "unchecked");
      if (record.status === "unchecked") return;
      assert.isFalse(A.some(record.findings, (finding) => finding.referring.anchor.quote === "the ETE CRC flit"));
      assert.isTrue(
        A.some(
          record.findings,
          (finding) => finding.kind === "missing-antecedent" && finding.referring.anchor.quote === "the packet"
        )
      );
    })
  );
  it.effect(
    "separates a source plural introduction from demonstrative number disagreement",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising brackets; the brackets are mounted; a sensor; these sensors.",
      ]);
      const record = O.getOrThrow(A.head(report.records));
      assert.notStrictEqual(record.status, "unchecked");
      if (record.status === "unchecked") return;
      assert.isFalse(A.some(record.findings, (finding) => finding.referring.anchor.quote === "brackets"));
      assert.isFalse(A.some(record.findings, (finding) => finding.referring.anchor.quote === "the brackets"));
      assert.isTrue(
        A.some(
          record.findings,
          (finding) => finding.kind === "number-mismatch" && finding.referring.anchor.quote === "these sensors"
        )
      );
    })
  );
  it.effect(
    "covers explicit proper-name enumerations while retaining unknown material roles",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising algorithms that are GZip, Zip, RLE; a material that is calcium carbonate.",
      ]);
      const record = O.getOrThrow(A.head(report.records));
      assert.notStrictEqual(record.status, "unchecked");
      if (record.status === "unchecked") return;
      assert.isFalse(
        A.some(record.findings, (finding) => A.contains(["GZip", "Zip", "RLE"], finding.referring.anchor.quote))
      );
      assert.isTrue(
        A.some(
          record.findings,
          (finding) =>
            finding.rule === "unsupported-determiner" && finding.referring.anchor.quote === "calcium carbonate"
        )
      );
    })
  );
  it.effect(
    "protects quantity/function slots and plural compounds from false verbal roles",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a mechanism configured to half a wavelength; a link to a cover plate; a data communications system.",
      ]);
      assert.deepStrictEqual(heads(report), [
        ["system", "mechanism", "half", "wavelength", "link", "cover plate", "data communications system"],
      ]);
    })
  );
  it.effect(
    "keeps a compatible unresolved bare basis adverse instead of asserting absence",
    Effect.fnUntraced(function* () {
      const report = yield* inspect(["A system comprising sensor; the sensor; the missing panel."]);
      const row = O.getOrThrow(A.head(report.records));
      assert.strictEqual(row.status, "partial");
      if (row.status === "unchecked") return;
      assert.isTrue(
        A.some(
          row.findings,
          (finding) => finding.rule === "source-role-unresolved" && finding.referring.anchor.quote === "the sensor"
        )
      );
      assert.isFalse(
        A.some(
          row.findings,
          (finding) => finding.kind === "missing-antecedent" && finding.referring.anchor.quote === "the sensor"
        )
      );
      assert.isTrue(
        A.some(
          row.findings,
          (finding) => finding.kind === "missing-antecedent" && finding.referring.anchor.quote === "the missing panel"
        )
      );
    })
  );
  it.effect(
    "limits unresolved-basis uncertainty to the actual alternative chain",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising sensor.",
        "A system comprising a sensor.",
        "The system of claims 1 or 2 wherein the sensor detects a signal.",
      ]);
      const row = O.getOrThrow(A.get(report.records, 2));
      assert.strictEqual(row.status, "partial");
      if (row.status === "unchecked") return;
      const uncertain = A.filter(row.findings, (finding) => finding.rule === "source-role-unresolved");
      assert.strictEqual(uncertain.length, 1);
      assert.isTrue(A.every(uncertain, (finding) => finding.kind === "pattern-not-covered"));
      const supported = yield* inspect([
        "A system comprising sensor.",
        "A system comprising a sensor.",
        "The system of claim 2 wherein the sensor detects a signal.",
      ]);
      const supportedRow = O.getOrThrow(A.get(supported.records, 2));
      assert.isTrue(
        supportedRow.status !== "unchecked" &&
          !A.some(supportedRow.findings, (finding) => finding.rule === "source-role-unresolved")
      );
    })
  );
  it.effect(
    "returns explicit partial coverage when the fixed engine cannot initialize",
    Effect.fnUntraced(function* () {
      const text = "A system comprising a sensor; the missing panel.";
      const input = ClaimInputCollection.make({
        sourceKey: "initialization-unavailable",
        records: [
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: 1,
            numberText: O.some("1"),
            sourceText: text,
            canonicalText: text,
          }),
        ],
      });
      const initializationFailure = WinkEngineError.fromCause("initialize")("synthetic initialization refusal");
      const failed = initializationFailure.pipe(
        Effect.fail,
        Layer.effectContext,
        claimInspectionWithTokenizationLayer,
        Layer.provide(
          Layer.succeed(UsptoClaimInputs, {
            inputs: Effect.fn("LexicalRuntime.noFailedAcquisition")(() =>
              Effect.fail(UsptoClaimsError.make({ reason: "unavailable", message: "No acquisition." }))
            ),
          })
        )
      );
      const report = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(failed);
          const known = yield* ClaimInspection.use((service) => service.inspect(input)).pipe(
            Effect.provideContext(context)
          );
          const bareText = "A system comprising sensor; the sensor.";
          const bareInput = ClaimInputCollection.make({
            sourceKey: "unavailable-unknown-basis",
            records: [
              ClaimInputRecord.cases.text.make({
                sourceOrdinal: 1,
                numberText: O.some("1"),
                sourceText: bareText,
                canonicalText: bareText,
              }),
            ],
          });
          const unknown = yield* ClaimInspection.use((service) => service.inspect(bareInput)).pipe(
            Effect.provideContext(context)
          );
          const unknownRow = O.getOrThrow(A.head(unknown.records));
          assert.strictEqual(unknownRow.status, "partial");
          assert.isTrue(
            unknownRow.status === "partial" &&
              A.some(unknownRow.findings, (finding) => finding.rule === "source-role-unresolved")
          );
          assert.isFalse(
            unknownRow.status !== "unchecked" &&
              A.some(unknownRow.findings, (finding) => finding.kind === "missing-antecedent")
          );
          return known;
        })
      );
      const record = O.getOrThrow(A.head(report.records));
      assert.strictEqual(record.status, "partial");
      if (record.status !== "partial") return;
      assert.isTrue(A.some(record.coverage, (issue) => issue.kind === "policy-uncovered"));
      assert.isTrue(A.some(record.findings, (finding) => finding.kind === "missing-antecedent"));
      assert.deepStrictEqual(heads(report), [["system", "sensor", "missing panel"]]);
      assert.deepStrictEqual(report.input, input);
    })
  );

  it.effect(
    "uses finite, passive and infinitive roles with complete object nominals",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a sensor that detects a signal; a controller configured to process signals.",
      ]);
      assert.deepStrictEqual(heads(report), [["system", "sensor", "signal", "controller", "signals"]]);
    })
  );
  it.effect(
    "preserves prenominal participles and explicit missing references",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a mounting sequence; a rotating shaft connected to the absent panel.",
      ]);
      assert.deepStrictEqual(heads(report), [["system", "mounting sequence", "rotating shaft", "absent panel"]]);
      assert.isTrue(
        A.some(
          report.records,
          (row) =>
            row.status !== "unchecked" && A.some(row.findings, (finding) => finding.kind === "missing-antecedent")
        )
      );
    })
  );
  it.effect(
    "keeps unproved material and possessive roles uncovered",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a conduit transporting air; its valve; its sensors; their actuators; the sensors.",
      ]);
      assert.isTrue(
        A.some(
          report.records,
          (row) =>
            row.status === "partial" && A.some(row.findings, (finding) => finding.rule === "unsupported-determiner")
        )
      );
      const row = O.getOrThrow(A.head(report.records));
      if (row.status === "unchecked") return;
      for (const possessive of ["its sensors", "their actuators"])
        assert.isTrue(
          A.some(
            row.findings,
            (finding) => finding.rule === "unsupported-determiner" && finding.referring.anchor.quote === possessive
          )
        );
      assert.isTrue(
        A.some(
          row.findings,
          (finding) => finding.rule === "source-role-unresolved" && finding.referring.anchor.quote === "the sensors"
        )
      );
    })
  );
  it.effect(
    "uses the same prepared source roles in reconstructed ancestors",
    Effect.fnUntraced(function* () {
      const report = yield* inspect([
        "A system comprising a controller that processes signals; a panel.",
        "The system of claim 1 wherein the controller controls the panel.",
      ]);
      assert.deepStrictEqual(heads(report), [
        ["system", "controller", "signals", "panel"],
        ["system", "controller", "panel"],
      ]);
      assert.isFalse(
        A.some(
          report.records,
          (row) =>
            row.status !== "unchecked" && A.some(row.findings, (finding) => finding.kind === "missing-antecedent")
        )
      );
    })
  );
});
