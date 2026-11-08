/** Original full raw-input annotation workflows from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { failCitationAnnotationUnicode } from "@beep/law-practice-server/internal/Citation/AnnotationBudget";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackFailure,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import {
  concatCitationPythonRanges,
  makeCitationPythonUnicode,
} from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationBuiltinCleanerName } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const Mode = S.Literals(["unchecked", "skip", "wrap"]);
const Parts = S.Tuple([S.Tuple([S.Int, S.Int]), S.String, S.String]);
const StringOperand = S.Struct({ kind: S.tag("value"), value: S.String });
const Criterion = S.fromJsonString(
  S.Struct({
    passed: S.tag(true),
    operands: S.Tuple([StringOperand, StringOperand]),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    context: S.Struct({
      values: S.Struct({
        source_text: S.String,
        document: S.Struct({ fields: S.Struct({ plain_text: S.String }) }),
        cites: S.Array(S.JsonObject),
        get_citations_args: S.Struct({ plain_text: S.optionalKey(S.String), markup_text: S.optionalKey(S.String) }),
        annotations: S.Array(Parts),
        annotate_kwargs: S.Struct({
          unbalanced_tags: S.optionalKey(Mode),
          annotator: S.optionalKey(
            S.Struct({
              callable: S.tag("tests.test_AnnotateTest.AnnotateTest.test_annotate.<locals>.lower_annotator"),
              line: S.tag(15),
              path: S.tag("tests/test_AnnotateTest.py"),
              sourceSha256: S.tag("f9d2f4d06e154a10d33952c07152348c9105bdb32b1eae2f84b1c9cbd5f31aec"),
            })
          ),
        }),
      }),
    }),
  })
);
const Steps = CitationBuiltinCleanerName.pipe(S.Array, S.NullOr);
const Ascii = S.String.check(S.isPattern(/^[\x00-\x7f]*$/u));
const invalid = () => CitationAnnotationCallbackFailure.make({ reason: "invalid-result" });
const lowerAnnotator = (limits: CitationEngineLimits) =>
  CitationAnnotationAnnotator.of({
    annotate: Effect.fn("CanonicalWorkflowTest.lower")(function* (before, span, after, work) {
      const unicode = yield* makeCitationPythonUnicode(limits, "annotate").pipe(Effect.mapError(invalid));
      const borrowed = yield* unicode
        .fromStorageReserved(span, work.reserve)
        .pipe(
          Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
            failCitationAnnotationUnicode(limits, invalid, error)
          )
        );
      const ascii = yield* S.decodeEffect(Ascii)(borrowed.text).pipe(Effect.mapError(invalid));
      yield* work.reserve(Str.length(ascii));
      const lowered = yield* unicode
        .fromText(Str.toLowerCase(ascii))
        .pipe(
          Effect.catchTag("CitationPythonUnicodeFailure", (error) =>
            failCitationAnnotationUnicode(limits, invalid, error)
          )
        );
      const ranges = A.map([before, lowered.storage, after], (source) => ({
        source,
        start: 0,
        end: source.bytes.length / source.width,
      }));
      const text = yield* concatCitationPythonRanges(ranges, (layout) => work.reserve(layout.utf16Units));
      return CitationAnnotationCallbackResult.cases.Text.make({ text });
    }),
  });
const readRows = Effect.fn("CanonicalWorkflowTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const selected = A.filter(
    operations.cases,
    (row) => row.operation === "get_citations" && row.sourceSiteId === "tests/test_AnnotateTest.py:241:24:get_citations"
  );
  expect(selected).toHaveLength(23);
  const regular = A.filter(selected, (row) => row.ordinal !== 16);
  expect(regular).toHaveLength(22);
  return yield* Effect.forEach(
    regular,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original extraction");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected successful original extraction");
      const id = Str.replace(
        "tests/test_AnnotateTest.py:241:24:get_citations",
        "tests/test_AnnotateTest.py:261:16:caseDeclaration"
      )(row.id);
      const assertion = yield* Effect.fromOption(HashMap.get(assertions, id));
      const criterion = yield* S.decodeEffect(Criterion)(assertion.payload);
      const context = criterion.context.values;
      expect(criterion.operands[0].value, id).toBe(criterion.operands[1].value);
      const steps = yield* S.decodeUnknownEffect(Steps)(body.input.clean_steps);
      expect(body.input.tokenizer.tokenizer, id).toBe("AhocorasickTokenizer");
      expect(body.input.remove_ambiguous, id).toBe(false);
      const models = yield* S.decodeEffect(S.Array(S.JsonObject))(body.outcome.value);
      expect(models, id).toEqual(context.cites);
      expect(body.stages.document.plainText, id).toBe(context.document.fields.plain_text);
      const mode: "plain" | "html" = context.get_citations_args.markup_text === undefined ? "plain" : "html";
      const raw = mode === "plain" ? body.input.plain_text : body.input.markup_text;
      expect(raw, id).toBe(context.source_text);
      expect(context.get_citations_args.plain_text ?? "", id).toBe(body.input.plain_text);
      expect(context.get_citations_args.markup_text ?? "", id).toBe(body.input.markup_text);
      return { id, ordinal: row.ordinal, raw, mode, steps, models, context, expected: criterion.operands[1].value };
    })
  );
});
/** Recompute cleaning, parsing, verified ranges and final original annotations.
 * Only before/after parts are caller inputs; all positions come from actual
 * verified mentions. The separately qualified custom-cleaner case stays in its
 * own host cohort. The original lowercase callback is captured server behavior.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalAnnotationWorkflows = Effect.fn("CanonicalWorkflowTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  shard: number,
  size: number,
  entriesOnly?: boolean
) {
  const rows = yield* readRows();
  const selected =
    entriesOnly === true
      ? A.filter(rows, (row) => A.contains([1, 10, 11, 12, 14, 17, 18], row.ordinal))
      : A.take(A.drop(rows, shard * size), size);
  expect(selected).toHaveLength(entriesOnly === true ? 7 : Math.min(size, rows.length - shard * size));
  const ordinary = yield* makeCitationCanonicalExtractionReplay(kind);
  const lower = A.some(selected, (row) => row.context.annotate_kwargs.annotator !== undefined)
    ? yield* makeCitationCanonicalExtractionReplay(kind, lowerAnnotator)
    : ordinary;
  for (const row of selected) {
    const replay = row.context.annotate_kwargs.annotator === undefined ? ordinary : lower;
    const extracted = yield* replay.extract(row.raw, row.mode, row.models, row.id, row.steps);
    expect(extracted.source.source.sourceText, row.id).toBe(row.context.document.fields.plain_text);
    const parts = A.map(row.context.annotations, (tuple) => Tuple.make(tuple[1], tuple[2]));
    const annotated = yield* replay.annotate(
      extracted,
      parts,
      row.context.annotate_kwargs.unbalanced_tags ?? "unchecked"
    );
    expect(annotated.tuples, row.id).toEqual(row.context.annotations);
    const unicode = yield* makeCitationPythonUnicode(replay.limits, "annotate");
    const expected = yield* unicode.fromText(row.expected);
    expect(annotated.result.text, row.id).toEqual(expected.storage);
  }
  yield* ordinary.assertRetired;
  yield* lower.assertRetired;
});
