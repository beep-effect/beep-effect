/** Original parsed page-correction assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationResourceCorrection } from "@beep/law-practice-server/internal/Citation/ResourceCorrection";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import {
  installCitationParsedResourceReplay,
  prepareCitationParsedResource,
} from "./CitationParsedResource.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const prefix = "tests.test_ModelsTest.ModelsTest.test_page_correction::tests/test_ModelsTest.py:";
const Value = S.Struct({ kind: S.tag("value"), value: S.NullOr(S.String) });
const Context = S.Struct({
  citation: S.String,
  cite: S.JsonObject,
  corrected_citation: S.String,
  corrected_page: S.NullOr(S.String),
});
const Criterion = S.Struct({
  context: S.Struct({ values: Context }),
  operands: S.Tuple([Value, Value, Value]),
  passed: S.tag(true),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
}).pipe(S.fromJsonString);
const OriginalInput = S.Struct({
  remove_ambiguous: S.tag(false),
  clean_steps: S.Null,
  tokenizer: S.Struct({ tokenizer: S.tag("AhocorasickTokenizer") }),
  markup_text: S.tag(""),
});
const readRows = Effect.fn("CanonicalPageCorrectionTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const rows = A.filter(operations.cases, (row) => Str.startsWith(prefix)(row.id));
  expect(rows).toHaveLength(6);
  return yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original page-correction parser call");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original parser success");
      yield* S.decodeUnknownEffect(OriginalInput)(body.input);
      const models = yield* S.decodeEffect(OriginalModels)(body.outcome.value);
      expect(models, row.id).toHaveLength(1);
      const targets = yield* Effect.forEach(
        [246, 251],
        Effect.fnUntraced(function* (line) {
          const id = `${prefix}${line}:12:caseDeclaration::${row.ordinal}`;
          const event = yield* Effect.fromOption(HashMap.get(assertions, id));
          const criterion = yield* S.decodeEffect(Criterion)(event.payload);
          const context = criterion.context.values;
          expect(context.citation, id).toBe(body.input.plain_text);
          expect(context.cite, id).toEqual(A.getUnsafe(models, 0));
          expect(criterion.operands[0].value, id).toBe(criterion.operands[1].value);
          expect(criterion.operands[1].value, id).toBe(
            line === 246 ? context.corrected_citation : context.corrected_page
          );
          return { id, line, expected: criterion.operands[1].value };
        })
      );
      return { id: row.id, raw: body.input.plain_text, models, targets };
    })
  );
});

/** Recompute parsing and the original correction methods with actual model data.
 * Frozen edition lookup consumes the actual selected reference; no observed
 * corrected string or normalized original model is supplied as correction input.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalPageCorrection = Effect.fn("CanonicalPageCorrectionTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const rows = yield* readRows();
  const {
    replay,
    unicode,
    service: correction,
  } = yield* installCitationParsedResourceReplay(kind, makeCitationResourceCorrection);
  for (const row of rows) {
    const actual = yield* replay.extract(row.raw, "plain", row.models, row.id, null);
    const input = yield* prepareCitationParsedResource(unicode, actual);
    const corrected = yield* correction.citation(input);
    const correctedText = yield* unicode.fromStorage(corrected);
    const correctedPage = yield* correction.page(input);
    const pageText = correctedPage === null ? null : (yield* unicode.fromStorage(correctedPage)).text;
    for (const target of row.targets)
      expect(target.line === 246 ? correctedText.text : pageText, target.id).toBe(target.expected);
  }
  yield* replay.assertRetired;
});

const OriginalModels = S.Array(S.JsonObject);
