/** Original full_span assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Span = S.Tuple([S.Int, S.Int]);
const Operand = S.Struct({ kind: S.tag("value"), value: S.Union([S.Int, Span, S.String]) });
const Equality = S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) });
const Criterion = S.Struct({
  context: S.Struct({ values: S.JsonObject }),
  operands: S.Tuple([Operand, Operand, Operand]),
  relation: Equality,
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const OriginalInput = S.Struct({
  clean_steps: S.Null,
  markup_text: S.tag(""),
  remove_ambiguous: S.tag(false),
  tokenizer: S.Struct({ tokenizer: S.tag("AhocorasickTokenizer") }),
});
const Combined = S.Struct({ combined_example: S.String, cit_idx: S.Int, extracted: S.Array(S.JsonObject) });
const Single = S.Struct({ example: S.String, extracted: S.JsonObject });
const Stopword = S.Struct({ sentence: S.String, extracted: S.JsonObject });
const prefix = "tests.test_FindTest.FindTest.test_citation_fullspan::tests/test_FindTest.py:";

const checkOriginalContext = Effect.fn("CanonicalFullSpanTest.context")(function* (
  values: unknown,
  combined: boolean,
  simple: boolean,
  raw: string,
  models: ReadonlyArray<unknown>,
  index: number,
  id: string
) {
  if (combined) {
    const context = yield* S.decodeUnknownEffect(Combined)(values);
    expect(context.combined_example, id).toBe(raw);
    expect(context.cit_idx, id).toBe(index);
    expect(context.extracted, id).toEqual(models);
  } else if (simple) {
    const context = yield* S.decodeUnknownEffect(Single)(values);
    expect(context.example, id).toBe(raw);
    expect(context.extracted, id).toEqual(A.getUnsafe(models, 0));
  } else {
    const context = yield* S.decodeUnknownEffect(Stopword)(values);
    expect(context.sentence, id).toBe(raw);
    expect(context.extracted, id).toEqual(A.getUnsafe(models, 0));
  }
});

const readCalls = Effect.fn("CanonicalFullSpanTest.calls")(function* (
  operations: Effect.Success<ReturnType<typeof readCitationCanonicalCaptures>>["operations"]
) {
  const rows = A.filter(operations.cases, (row) => Str.startsWith(prefix)(row.id));
  expect(rows).toHaveLength(citationCanonicalFullSpanCalls);
  const calls = yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original full-span extraction");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original extraction success");
      yield* S.decodeUnknownEffect(OriginalInput)(body.input);
      const models = yield* S.decodeEffect(OriginalModels)(body.outcome.value);
      const combined = row.sourceSiteId === "tests/test_FindTest.py:1161:20:get_citations";
      const simple = row.sourceSiteId === "tests/test_FindTest.py:1187:24:get_citations";
      const stopword = row.sourceSiteId === "tests/test_FindTest.py:1198:24:get_citations";
      expect(combined || simple || stopword, row.id).toBe(true);
      const targets = combined
        ? A.flatMap([1, 2], (ordinal) =>
            A.map([1165, 1170], (line) => ({
              id: `${prefix}${line}:12:caseDeclaration::${ordinal}`,
              index: ordinal - 1,
            }))
          )
        : [{ id: `${prefix}${simple ? 1189 : 1200}:12:caseDeclaration::${row.ordinal}`, index: 0 }];
      return { row, body, models, combined, simple, targets };
    })
  );
  expect(A.reduce(calls, 0, (total, call) => total + call.targets.length)).toBe(13);
  return calls;
});

const observeFullSpan = (range: readonly [number, number], combined: boolean, id: string) => {
  if (!combined) return range;
  return Str.includes(":1165:")(id) ? range[0] : range[1];
};

/** Original parser calls in the full-span cohort; together they carry all thirteen equalities. */
export const citationCanonicalFullSpanCalls = 10;
/** Read the pinned captures and their ten parser calls once, and install one default replay engine.
 *
 * **Details**
 *
 * Every original call is a full production extraction (a fresh one-job regex worker per pattern
 * evaluation plus the per-request stage installation), so one call costs seconds of real work.
 * Preparing once lets each call run as its own test against the same installed engine instead of
 * serializing the whole cohort under one watchdog.
 *
 * **Example** (Preparing the Bun cohort)
 * ```ts
 * import { prepareCitationCanonicalFullSpanReplay } from "./CitationCanonicalFullSpan.fixtures.ts";
 * const prepared = prepareCitationCanonicalFullSpanReplay("bun");
 * ```
 * @internal @category testing @since 0.0.0
 */
export const prepareCitationCanonicalFullSpanReplay = Effect.fn("CanonicalFullSpanTest.prepare")(function* (
  kind: CitationNativeRuntimeKind
) {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const calls = yield* readCalls(operations);
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  return { kind, calls, assertions, replay };
});
/** One prepared full-span cohort shared by the per-call tests of a runtime.
 * @internal @category testing @since 0.0.0
 */
export class CitationCanonicalFullSpanReplay extends Context.Service<
  CitationCanonicalFullSpanReplay,
  Effect.Success<ReturnType<typeof prepareCitationCanonicalFullSpanReplay>>
>()("@beep/law-practice-server/test/CitationCanonicalFullSpan.fixtures/CitationCanonicalFullSpanReplay") {}
/** Build one prepared cohort for a runtime; its engine and native runtimes live for the layer's scope.
 *
 * **Example** (Sharing the Bun cohort across per-call tests)
 * ```ts
 * import { citationCanonicalFullSpanReplayLayer } from "./CitationCanonicalFullSpan.fixtures.ts";
 * const layer = citationCanonicalFullSpanReplayLayer("bun");
 * ```
 * @internal @category testing @since 0.0.0
 */
export const citationCanonicalFullSpanReplayLayer = (kind: CitationNativeRuntimeKind) =>
  Layer.effect(CitationCanonicalFullSpanReplay, prepareCitationCanonicalFullSpanReplay(kind));
/** Recompute one original parser call and its independent full-span equalities.
 * Covering every index from 0 below `citationCanonicalFullSpanCalls` checks all thirteen.
 *
 * **Example** (Replaying the first call)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import {
 *   prepareCitationCanonicalFullSpanReplay,
 *   replayCitationCanonicalFullSpanCall,
 * } from "./CitationCanonicalFullSpan.fixtures.ts";
 * const first = prepareCitationCanonicalFullSpanReplay("node").pipe(
 *   Effect.flatMap((prepared) => replayCitationCanonicalFullSpanCall(prepared, 0))
 * );
 * ```
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalFullSpanCall = Effect.fn("CanonicalFullSpanTest.replayCall")(function* (
  prepared: CitationCanonicalFullSpanReplay["Service"],
  index: number
) {
  const { kind, calls, assertions, replay } = prepared;
  const { row, body, models, combined, simple, targets } = yield* Effect.fromOption(A.get(calls, index)).pipe(
    Effect.orDie
  );
  const extraction = replay.extract(body.input.plain_text, "plain", models, row.id, null);
  const actual = yield* extraction.pipe(
    Effect.tapError((error) =>
      Effect.logWarning("Original full-span extraction refused").pipe(
        Effect.annotateLogs({
          runtime: kind,
          caseId: row.id,
          failure: error._tag,
          limit: error._tag === "CitationSafetyLimitExceeded" ? error.limit : "none",
        })
      )
    )
  );
  expect(actual.source.source.sourceText, row.id).toBe(body.stages.document.plainText);
  let checked = 0;
  for (const target of targets) {
    const captured = yield* Effect.fromOption(HashMap.get(assertions, target.id));
    const expected = yield* S.decodeEffect(Criterion)(captured.payload);
    expect(expected.operands[0].value, target.id).toEqual(expected.operands[1].value);
    yield* checkOriginalContext(
      expected.context.values,
      combined,
      simple,
      body.input.plain_text,
      models,
      target.index,
      target.id
    );
    const mention = A.getUnsafe(actual.document.mentions, target.index);
    const component = yield* Effect.fromOption(A.findFirst(mention.components, (value) => value.name === "fullSpan"));
    const anchor = component.anchor.anchor;
    const text = actual.source.source.sourceText;
    const range = Tuple.make(
      A.fromIterable(Str.slice(0, anchor.startChar)(text)).length,
      A.fromIterable(Str.slice(0, anchor.endChar)(text)).length
    );
    const observation = observeFullSpan(range, combined, target.id);
    expect(observation, target.id).toEqual(expected.operands[1].value);
    checked++;
  }
  expect(checked).toBe(targets.length);
  yield* replay.assertRetired;
});

const OriginalModels = S.Array(S.JsonObject);
