/** Original corrected-full-citation assertions from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationRenderingInput, makeCitationRendering } from "@beep/law-practice-server/internal/Citation/Rendering";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import {
  installCitationParsedResourceReplay,
  prepareCitationParsedResource,
} from "./CitationParsedResource.fixtures.ts";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";
import type { Citation } from "@beep/law-practice-domain/values";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const prefix =
  "tests.test_ModelsTest.ModelsTest.test_corrected_full_citation_includes_closing_parenthesis::tests/test_ModelsTest.py:";
const Word = S.Struct({ kind: S.tag("value"), value: S.String });
const Criterion = S.Struct({
  operands: S.Tuple([Word, Word]),
  relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
  context: S.Struct({ values: S.JsonObject }),
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const Nullable = S.NullOr(S.String);
const Common = S.Struct({ pinCite: Nullable, parenthetical: Nullable, year: Nullable });
const Case = S.Struct({
  ...Common.fields,
  plaintiff: Nullable,
  defendant: Nullable,
  additionalText: Nullable,
  court: Nullable,
});
const readRows = Effect.fn("CanonicalFullRenderingTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const rows = A.filter(operations.cases, (row) => Str.startsWith(prefix)(row.id));
  expect(rows).toHaveLength(2);
  return yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      if (row.operation !== "get_citations") return yield* Effect.die("Expected original corrected-full parser call");
      const body = row.payload.value;
      if (body.outcome.kind !== "success") return yield* Effect.die("Expected original parser success");
      expect(
        {
          steps: body.input.clean_steps,
          markup: body.input.markup_text,
          ambiguous: body.input.remove_ambiguous,
          tokenizer: body.input.tokenizer.tokenizer,
        },
        row.id
      ).toEqual({ steps: null, markup: "", ambiguous: false, tokenizer: "AhocorasickTokenizer" });
      const models = yield* S.decodeEffect(S.Array(S.JsonObject))(body.outcome.value);
      expect(models, row.id).toHaveLength(1);
      const journal = row.sourceSiteId === "tests/test_ModelsTest.py:209:27:get_citations";
      expect(journal || row.sourceSiteId === "tests/test_ModelsTest.py:217:29:get_citations", row.id).toBe(true);
      const id = `${prefix}${journal ? 212 : 220}:8:caseDeclaration::1`;
      const assertion = yield* Effect.fromOption(HashMap.get(assertions, id));
      const criterion = yield* S.decodeEffect(Criterion)(assertion.payload);
      expect(criterion.operands[0].value, id).toBe(criterion.operands[1].value);
      expect(criterion.context.values[journal ? "journal_citation" : "full_case_citation"], id).toEqual(
        A.getUnsafe(models, 0)
      );
      return { id, raw: body.input.plain_text, models, expected: criterion.operands[1].value };
    })
  );
});
const renderingMetadata = Effect.fn("CanonicalFullRenderingTest.metadata")(function* (citation: Citation) {
  const raw = yield* projectCitationSemanticMetadata(citation);
  if (citation.type !== "case" && citation.type !== "journal")
    return yield* Effect.die("Expected original case or journal");
  if (citation.type === "journal") return { mode: citation.type, fields: yield* S.decodeUnknownEffect(Common)(raw) };
  const fields = yield* S.decodeUnknownEffect(Case)(raw);
  return {
    mode: citation.type,
    fields: {
      pinCite: fields.pinCite,
      parenthetical: fields.parenthetical,
      year: fields.year,
      plaintiff: fields.plaintiff,
      defendant: fields.defendant,
      extra: fields.additionalText,
      court: fields.court,
    },
  };
});

/** Parse raw input before rendering from actual groups, edition and metadata.
 * This proves two original finite presentations; general formatting laws stay open.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalFullRendering = Effect.fn("CanonicalFullRenderingTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const rows = yield* readRows();
  const {
    replay,
    unicode,
    service: renderer,
  } = yield* installCitationParsedResourceReplay(kind, makeCitationRendering);
  for (const row of rows) {
    const actual = yield* replay.extract(row.raw, "plain", row.models, row.id, null);
    const resource = yield* prepareCitationParsedResource(unicode, actual);
    const values = yield* renderingMetadata(A.getUnsafe(actual.citations, 0));
    const fields = yield* S.decodeEffect(S.Record(S.String, Nullable))(values.fields);
    const pairs = yield* Effect.forEach(
      R.toEntries(fields),
      Effect.fnUntraced(function* ([key, value]) {
        const text = value === null ? null : (yield* unicode.fromText(value)).storage;
        return Tuple.make(key, text);
      })
    );
    const input = yield* S.decodeUnknownEffect(S.toType(CitationRenderingInput))({
      ...resource,
      mode: values.mode,
      metadata: R.fromEntries(pairs),
    });
    const result = yield* renderer.render(input);
    const rendered = yield* unicode.fromStorage(result);
    expect(rendered.text, row.id).toBe(row.expected);
  }
  yield* replay.assertRetired;
});
