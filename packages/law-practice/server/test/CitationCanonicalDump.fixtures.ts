/** Original dump_citations workflow, eyecite 2.7.6 BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationBuiltinDump } from "@beep/law-practice-server/internal/Citation/BuiltinDump";
import { copyCitationCleanerUnicode } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { CitationDumpFailure, makeCitationDump } from "@beep/law-practice-server/internal/Citation/Dump";
import { CitationGeneratedReference } from "@beep/law-practice-server/internal/Citation/GeneratedReferences";
import { makeCitationOccurrenceProjection } from "@beep/law-practice-server/internal/Citation/OccurrenceProjection";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationSemanticExtraction } from "@beep/law-practice-server/internal/Citation/SemanticExtraction";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { readCitationCanonicalPlainExtraction } from "./CitationCanonicalCriteria.fixtures.ts";
import { compareCitationCanonicalModel } from "./CitationCanonicalModel.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationNativeRenderingAsset } from "./CitationNativeRendering.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const prefix = "tests.test_UtilsTest.UtilsTest.test_dump_citations::tests/test_UtilsTest.py:";
const StringValue = S.Struct({ kind: S.tag("value"), value: S.String });
const Criterion = S.Struct({
  passed: S.tag(true),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
  operands: S.Tuple([StringValue, StringValue]),
  context: S.Struct({ values: S.Struct({ text: S.String, cites: S.Array(S.JsonObject) }) }),
}).pipe(S.fromJsonString);
const Span = S.Tuple([S.Int, S.Int]);
const Ranges = S.Struct({ span: Span, fullSpan: Span, spanWithPincite: Span });
/** Recompute the actual original parser models and their complete ordered dump.
 * Native coordinate slots are read directly; no expected fields configure output.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalDump = Effect.fn("CanonicalDumpTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const event = yield* Effect.fromOption(HashMap.get(assertions, `${prefix}57:8:caseDeclaration::1`));
  const criterion = yield* S.decodeEffect(Criterion)(event.payload);
  expect(criterion.operands[0].value).toBe(criterion.operands[1].value);
  const call = yield* readCitationCanonicalPlainExtraction(
    operations,
    `${prefix}37:16:get_citations::1`,
    criterion.context.values.text
  );
  const modelsExpected = call.models;
  expect(modelsExpected).toEqual(criterion.context.values.cites);
  const { setup, defaultConfiguration, provided, values, engineArtifact } =
    yield* installCitationDefaultConfigurationFixture(kind);
  const stage = yield* makeCitationSemanticExtraction(setup.limits, setup.runtime, defaultConfiguration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(provided),
    DateTime.withCurrentZoneOffset(0)
  );
  const actual = yield* stage.extract({
    plain: call.input.plain_text,
    markup: null,
    cleanSteps: call.input.clean_steps,
    removeAmbiguous: false,
  });
  expect(actual.citations).toHaveLength(modelsExpected.length);
  yield* Effect.forEach(actual.citations, (citation, i) =>
    compareCitationCanonicalModel(citation, A.getUnsafe(modelsExpected, i), call.id)
  );
  if (actual.raw.outcome._tag !== "Document") return yield* Effect.die("Expected real original Document branch");
  const models = A.map(actual.raw.outcome.result.extraction.extraction.citations, (entry) => entry.model);
  const ownedPlain = yield* copyCitationCleanerUnicode(values, actual.raw.outcome.result.document.plain, () =>
    CitationDumpFailure.make({ reason: "invalid-input" })
  ).pipe(Effect.provideService(CitationTextBudget, setup.budget));
  const unicode = yield* makeCitationPythonUnicode(setup.limits, "extract");
  const sourceView = yield* unicode.fromStorage(ownedPlain.storage);
  expect(ownedPlain.storage).toEqual(actual.raw.outcome.result.extraction.tokenizer.source);
  const source = yield* citationFixtureSourceProof(sourceView.text);
  const projection = yield* makeCitationOccurrenceProjection(setup.limits, setup.runtime, { engineArtifact }).pipe(
    Effect.provideContext(provided)
  );
  const occurrences = yield* projection.project({ source, result: actual });
  expect(occurrences.unverified).toEqual([]);
  expect(occurrences.unverifiedComponents).toEqual([]);
  expect(occurrences.unboundWarnings).toEqual([]);
  expect(occurrences.mentions).toHaveLength(models.length);
  const profile = yield* readCitationNativeRenderingAsset("builtin-dump-profile");
  const utilityBudget = yield* makeCitationTextBudget(setup.limits);
  const adapter = yield* makeCitationBuiltinDump(setup.limits, profile).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, project: bind(stage.project) }))
      )
    ),
    Effect.provideService(CitationTextBudget, utilityBudget)
  );
  const rows = yield* Effect.forEach(models, adapter.project);
  // References carry no year field, a generated reference has no constructor outcome, and a citation
  // with no parsed year still reports the field as None.
  const references = yield* stage.extract({
    plain: "See Roe v. Wade, 410 U.S. 113 (1973). Id. at 114. Roe, at 115. See supra.",
    markup: null,
    cleanSteps: [],
    removeAmbiguous: false,
  });
  if (references.raw.outcome._tag !== "Document") return yield* Effect.die("Expected real original Document branch");
  const referenceModels = A.map(references.raw.outcome.result.extraction.extraction.citations, (entry) => entry.model);
  const referenceRows = yield* Effect.forEach(referenceModels, adapter.project);
  expect(A.map(referenceRows, (row) => row.kind)).toContain("IdCitation");
  const dated = A.findFirst(referenceModels, (model) => "outcome" in model && "year" in model.outcome);
  if (dated._tag === "None" || !("outcome" in dated.value)) return yield* Effect.die("Expected a dated citation");
  const generated = yield* adapter.project(
    CitationGeneratedReference.make({
      _tag: "ReferenceCitation",
      index: 0,
      documentAttached: false,
      token: dated.value.token,
      spanStart: 0,
      spanEnd: 1,
      fullSpanStart: 0,
      fullSpanEnd: 1,
      metadata: {
        pinCite: null,
        parenthetical: null,
        pinCiteSpanStart: null,
        pinCiteSpanEnd: null,
        plaintiff: null,
        defendant: null,
        resolvedCaseNameShort: null,
        resolvedCaseName: null,
      },
    })
  );
  expect(generated.kind).toBe("ReferenceCitation");
  expect(A.map(generated.fields, (field) => field.name)).toEqual(["groups", "metadata"]);
  const undated = yield* adapter.project({ ...dated.value, outcome: { ...dated.value.outcome, year: null } });
  expect(A.last(undated.fields)).toMatchObject({
    _tag: "Some",
    value: { _tag: "Scalar", name: "year", value: { _tag: "None" } },
  });
  yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row, i) {
      const expected = yield* S.decodeEffect(Ranges)(A.getUnsafe(modelsExpected, i));
      expect(row.span).toEqual(expected.span);
      yield* assertCitationMentionRanges(source.sourceText, A.getUnsafe(occurrences.mentions, i), expected);
    })
  );
  const printability = yield* readCitationNativeRenderingAsset("python-printability");
  const dump = yield* makeCitationDump(setup.limits, printability).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, render: bind(stage.render) }))
      )
    ),
    Effect.provideService(CitationTextBudget, utilityBudget)
  );
  const rendered = yield* dump.render({ text: ownedPlain.storage, citations: rows });
  const output = yield* unicode.fromStorage(rendered);
  // The original assertion strips these formatter colors and then trims its
  // finite ASCII result. General re.sub behavior is not claimed by this view.
  const plain = pipe(
    output.text,
    Str.replaceAll("\x1b[32m", ""),
    Str.replaceAll("\x1b[94m", ""),
    Str.replaceAll("\x1b[1m", ""),
    Str.replaceAll("\x1b[0m", ""),
    Str.trim
  );
  expect(plain).toBe(criterion.operands[1].value);
  yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
});
