/** Original tag-balancing assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationStyleTagBalancer } from "@beep/law-practice-server/internal/Citation/AnnotationStyle";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";

const Utility = S.Struct({
  callable: S.tag("eyecite.utils.maybe_balance_style_tags"),
  path: S.tag("eyecite/utils.py"),
  line: S.tag(256),
  sourceSha256: S.tag("8e27eb1207f6c0fdb695530e3677a3e9f039986b2baf68461ba680ee2bff902e"),
});
const Value = S.Struct({ kind: S.tag("value"), value: S.Json });
const Truth = S.Struct({ kind: S.tag("truth"), truth: S.tag(true) });
const Equal = S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) });
const Criterion = S.Struct({
  context: S.Struct({
    values: S.Struct({
      full_string: S.String,
      span: S.optionalKey(S.String),
      span_text: S.String,
      start: S.Int,
      end: S.Int,
      balanced: S.String,
      maybe_balance_style_tags: Utility,
    }),
  }),
  operands: S.Tuple([Value, Value]),
  relation: S.Union([Truth, Equal]),
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const PrefixMatch = S.Struct({
  regexMatch: S.Struct({
    source: S.String,
    pattern: S.tag("^<(i|em)>"),
    match: S.Literals(["<i>", "<em>"]),
  }),
});

const assertOriginalPredicate = Effect.fn("CanonicalStyleTest.predicate")(function* (
  criterion: typeof Criterion.Type,
  text: string,
  id: string
) {
  if (criterion.relation.kind === "truth") {
    const match = yield* S.decodeUnknownEffect(PrefixMatch)(criterion.operands[0].value);
    expect(match.regexMatch.source, id).toBe(criterion.context.values.balanced);
    expect(Str.startsWith(match.regexMatch.match)(text), id).toBe(true);
    expect(Str.startsWith("<i>")(text) || Str.startsWith("<em>")(text), id).toBe(true);
  } else {
    const expected = yield* S.decodeUnknownEffect(S.String)(criterion.operands[1].value);
    expect(criterion.operands[0].value, id).toBe(expected);
    expect(text, id).toBe(expected);
  }
});

/** Recompute original caller spans by literal search, then execute the existing utility.
 * This is literal style proximity proof, independent of XML well-formedness.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalStyle = Effect.fn("CanonicalStyleTest.replay")(function* () {
  const { assertions } = yield* readCitationCanonicalCaptures();
  const rows = assertions.pipe(
    HashMap.values,
    A.fromIterable,
    A.filter((row) => Str.startsWith("tests.test_AnnotateTest.AnnotateTest.test_tag_balancing::")(row.id))
  );
  expect(rows).toHaveLength(6);
  const { limits } = yield* defaultCitationEnginePolicy;
  const budget = yield* makeCitationTextBudget(limits);
  const unicode = yield* makeCitationPythonUnicode(limits, "annotate");
  const balancer = yield* makeCitationStyleTagBalancer().pipe(Effect.provideService(CitationTextBudget, budget));
  for (const row of rows) {
    const criterion = yield* S.decodeEffect(Criterion)(row.payload);
    const context = criterion.context.values;
    const span = yield* S.decodeUnknownEffect(S.String)(
      criterion.relation.kind === "truth" ? context.span_text : context.span
    );
    const utf16Start = yield* Effect.fromOption(Str.indexOf(span)(context.full_string));
    const start = A.fromIterable(Str.slice(0, utf16Start)(context.full_string)).length;
    const end = start + A.fromIterable(span).length;
    expect([start, end], row.id).toEqual([context.start, context.end]);
    const source = yield* unicode.fromText(context.full_string);
    const result = yield* balancer.balance(source, start, end);
    const output = yield* unicode.fromStorage(result.text);
    expect(output.text, row.id).toBe(context.balanced);
    yield* assertOriginalPredicate(criterion, output.text, row.id);
  }
});
