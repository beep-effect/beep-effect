/** Original eyecite HTML reference ordering and overlap assertions, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationCanonicalExtractionReplay } from "./CitationCanonicalExtractionRuntime.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Span = S.Tuple([S.Int, S.Int]);
const Model = S.Struct({
  citationType: S.Literals(["FullCaseCitation", "ShortCaseCitation", "SupraCitation", "ReferenceCitation"]),
  fields: S.JsonObject,
  span: Span,
  fullSpan: Span,
  spanWithPincite: Span,
});
const Header = S.fromJsonString(
  S.Struct({
    passed: S.tag(true),
    context: S.Struct({ values: S.Struct({ markup_text: S.String, citations: S.Array(Model) }) }),
  })
);
const Ordered = S.fromJsonString(
  S.Struct({
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    operands: S.Tuple([
      S.Struct({ kind: S.tag("value"), value: S.Array(S.String) }),
      S.Struct({ kind: S.tag("value"), value: S.Array(S.String) }),
    ]),
  })
);
const Filtered = S.fromJsonString(
  S.Struct({
    relation: S.Struct({ kind: S.tag("truth"), truth: S.tag(false) }),
    operands: S.Tuple([S.Struct({ kind: S.tag("value"), value: S.tag(false) })]),
  })
);
const Capture = S.fromJsonString(
  S.Struct({ events: S.Array(S.Struct({ id: S.String, test: S.String, payload: S.String })) })
);
const methods = { references: "test_reference_extraction_from_markup", filtering: "test_reference_filtering" };
const readRows = Effect.fn("CanonicalReferenceMarkupTest.read")(function* (family: keyof typeof methods) {
  const capture = yield* readCitationOracleFixture(
    "assertion-cases",
    "c7ea12ec5ba0d66257affc4c6e54e8b2fa2ffdd0d79f41c1b701000e0edaf33f"
  ).pipe(Effect.flatMap(S.decodeEffect(Capture)));
  const selected = A.filter(capture.events, (row) => row.test === `tests.test_FindTest.FindTest.${methods[family]}`);
  expect(selected).toHaveLength(family === "references" ? 1 : 3);
  return yield* Effect.forEach(
    selected,
    Effect.fnUntraced(function* (row) {
      const header = yield* S.decodeEffect(Header)(row.payload);
      if (family === "references") {
        const criterion = yield* S.decodeEffect(Ordered)(row.payload);
        expect(criterion.operands[0].value, row.id).toEqual(criterion.operands[1].value);
        return { id: row.id, input: header.context.values, references: criterion.operands[1].value };
      }
      yield* S.decodeEffect(Filtered)(row.payload);
      return { id: row.id, input: header.context.values, references: A.empty<string>() };
    })
  );
});
/** Run original HTML/reference criteria and complete source-observed models.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalReferenceMarkup = Effect.fn("CanonicalReferenceMarkupTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  family: keyof typeof methods,
  firstOnly?: boolean
) {
  const rows = yield* readRows(family);
  const replay = yield* makeCitationCanonicalExtractionReplay(kind);
  for (const row of firstOnly === true ? A.take(rows, 1) : rows) {
    const result = yield* replay.extract(row.input.markup_text, "html", row.input.citations, row.id);
    const names = A.empty<string>();
    for (const index of row.input.citations.keys()) {
      const citation = A.getUnsafe(result.citations, index);
      const mention = A.getUnsafe(result.document.mentions, index);
      if (citation.type === "reference") names.push(Str.replace(/^[,.]+|[,.]+$/g, "")(mention.anchor.anchor.quote));
    }
    expect(names, row.id).toEqual(row.references);
  }
  yield* replay.assertRetired;
});
