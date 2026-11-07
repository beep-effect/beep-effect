/** Original eyecite HTML reference ordering and overlap assertions, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationEngineSourcePairInput } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectCitationCanonicalExpectedMetadata } from "./CitationCanonicalAttributes.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationMentionRanges, citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const Fields = S.Record(S.String, S.NullOr(S.String));
const Span = S.Tuple([S.Int, S.Int]);
const Model = S.Struct({
  citationType: S.Literals(["FullCaseCitation", "ShortCaseCitation", "SupraCitation", "ReferenceCitation"]),
  fields: S.Struct({
    groups: Fields,
    metadata: S.Struct({ fields: S.Record(S.String, S.Union([S.Null, S.String, S.Int])) }),
  }),
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
const kinds = {
  FullCaseCitation: "case",
  ShortCaseCitation: "shortFormCase",
  SupraCitation: "supra",
  ReferenceCitation: "reference",
};
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
const compareModel = Effect.fn("CanonicalReferenceMarkupTest.model")(function* (
  actual: Citation,
  original: typeof Model.Type,
  id: string
) {
  const encoded = yield* S.encodeEffect(Citation)(actual);
  expect(encoded.type, id).toBe(kinds[original.citationType]);
  expect(encoded.components, id).toEqual(original.fields.groups);
  const fields = R.filter(
    original.fields.metadata.fields,
    (_, key) => key !== "pin_cite_span_start" && key !== "pin_cite_span_end"
  );
  const metadata = yield* S.decodeUnknownEffect(Fields)(fields);
  const actualMetadata = yield* projectCitationSemanticMetadata(actual);
  expect(actualMetadata, id).toEqual(projectCitationCanonicalExpectedMetadata(metadata));
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
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  let proof = yield* citationFixtureSourceProof("initial");
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CanonicalReferenceMarkupTest.resolve")(() =>
      Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText }))
    ),
  });
  const { engine } = yield* buildCitationDefaultEngineFixture(installed, resolver);
  for (const row of firstOnly === true ? A.take(rows, 1) : rows) {
    proof = yield* citationFixtureSourceProof(row.input.markup_text);
    const result = yield* engine.extract(
      CitationEngineSourcePairInput.make({
        plain: null,
        markup: { source: proof.source, sourceText: proof.sourceText },
        cleanSteps: ["html", "all_whitespace"],
        removeAmbiguous: false,
        container: "list",
      })
    );
    expect(result.citations, row.id).toHaveLength(row.input.citations.length);
    expect(result.document.mentions, row.id).toHaveLength(row.input.citations.length);
    const names = A.empty<string>();
    for (const [index, original] of row.input.citations.entries()) {
      const citation = A.getUnsafe(result.citations, index);
      const mention = A.getUnsafe(result.document.mentions, index);
      yield* compareModel(citation, original, row.id);
      yield* assertCitationMentionRanges(result.source.source.sourceText, mention, original);
      if (citation.type === "reference") names.push(Str.replace(/^[,.]+|[,.]+$/g, "")(mention.anchor.anchor.quote));
    }
    expect(names, row.id).toEqual(row.references);
    expect(result.diagnostics.unverified, row.id).toEqual([]);
    expect(result.diagnostics.unverifiedComponents, row.id).toEqual([]);
  }
  const counts = yield* installed.setup.observed.snapshot;
  expect(counts.confirmed).toBe(counts.spawned);
});
