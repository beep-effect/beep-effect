/** Original span_with_pincite workflows from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
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

const prefix = "tests.test_AnnotateTest.AnnotateTest.test_span_with_pincite::tests/test_AnnotateTest.py:";
const Word = S.Struct({ kind: S.tag("value"), value: S.String });
const Criterion = S.Struct({
  keywordArguments: S.Struct({ msg: S.tag("Failed to extract pin cite span") }),
  context: S.Struct({
    values: S.Struct({
      source_text: S.String,
      plain_text: S.String,
      citation: S.JsonObject,
      start: S.Int,
      end: S.Int,
      pin_cite_span: S.String,
    }),
  }),
  operands: S.Tuple([Word, Word]),
  passed: S.tag(true),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
}).pipe(S.fromJsonString);
const DefaultInput = S.Struct({
  tokenizer: S.Struct({ tokenizer: S.tag("AhocorasickTokenizer") }),
  markup_text: S.tag(""),
  clean_steps: S.Null,
  remove_ambiguous: S.tag(false),
});

const readRows = Effect.fn("CanonicalPinSpanTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const byId = HashMap.fromIterable(A.map(operations.cases, (row) => Tuple.make(row.id, row)));
  const calls = A.filter(
    operations.cases,
    (row) => row.operation === "get_citations" && Str.startsWith(prefix)(row.id)
  );
  expect(calls).toHaveLength(5);
  let offset = 0;
  return yield* Effect.forEach(
    calls,
    Effect.fnUntraced(function* (row, index) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original pin-span parser call");
      expect(row.ordinal).toBe(index + 1);
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original parser success");
      yield* S.decodeUnknownEffect(DefaultInput)(body.input);
      const models = yield* S.decodeEffect(OriginalModels)(body.outcome.value);
      const cleaner = yield* Effect.fromOption(HashMap.get(byId, `${prefix}336:25:clean_text::${row.ordinal}`));
      if (cleaner.operation !== "clean_text") return yield* Effect.die("Expected original preceding cleaner call");
      const clean = cleaner.payload.value;
      if (clean.outcome.kind !== "success") return yield* Effect.die("Expected original cleaner success");
      const steps = yield* S.decodeUnknownEffect(OriginalCleanerSteps)(clean.input.steps);
      expect(steps).toEqual(["all_whitespace", "html"]);
      expect(clean.outcome.value, row.id).toBe(body.input.plain_text);
      const targets = yield* Effect.forEach(
        models,
        Effect.fnUntraced(function* (model) {
          offset++;
          const id = `${prefix}341:16:caseDeclaration::${offset}`;
          const captured = yield* Effect.fromOption(HashMap.get(assertions, id));
          const expected = yield* S.decodeEffect(Criterion)(captured.payload);
          const context = expected.context.values;
          expect(context.source_text, id).toBe(clean.input.text);
          expect(context.plain_text, id).toBe(body.input.plain_text);
          expect(context.citation, id).toEqual(model);
          expect(expected.operands[0].value, id).toBe(expected.operands[1].value);
          expect(context.pin_cite_span, id).toBe(expected.operands[1].value);
          return { id, context, expected: expected.operands[1].value };
        })
      );
      return { id: row.id, raw: clean.input.text, plain: body.input.plain_text, steps, models, targets };
    })
  ).pipe(Effect.tap(() => Effect.sync(() => expect(offset).toBe(9))));
});

/** Recompute original pure builtin cleaning and all nine verified pin-span substrings.
 * The raw-input extraction pipeline runs the same ordered cleaners before parsing;
 * no retained callback or document-protocol equivalence is inferred.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalPinSpan = Effect.fn("CanonicalPinSpanTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const rows = yield* readRows();
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  for (const row of rows) {
    const actual = yield* replay.extract(row.raw, "plain", row.models, row.id, row.steps);
    const text = actual.source.source.sourceText;
    expect(text, row.id).toBe(row.plain);
    for (const [index, target] of row.targets.entries()) {
      const mention = A.getUnsafe(actual.document.mentions, index);
      const component = yield* Effect.fromOption(
        A.findFirst(mention.components, (value) => value.name === "spanWithPincite")
      );
      const anchor = component.anchor.anchor;
      const start = A.fromIterable(Str.slice(0, anchor.startChar)(text)).length;
      const end = A.fromIterable(Str.slice(0, anchor.endChar)(text)).length;
      expect([start, end], target.id).toEqual([target.context.start, target.context.end]);
      expect(Str.slice(anchor.startChar, anchor.endChar)(text), target.id).toBe(target.expected);
    }
  }
  yield* replay.assertRetired;
});

const OriginalModels = S.Array(S.JsonObject);
const OriginalCleanerSteps = S.Array(CitationBuiltinCleanerName);
