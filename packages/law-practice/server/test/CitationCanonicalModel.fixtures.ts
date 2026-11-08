/** Source-observed semantic citation comparison from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { Citation } from "@beep/law-practice-domain/values";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { projectCitationCanonicalExpectedMetadata } from "./CitationCanonicalAttributes.fixtures.ts";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";

const Fields = S.Record(S.String, S.NullOr(S.String));
const Model = S.Struct({
  citationType: S.Literals([
    "FullCaseCitation",
    "ShortCaseCitation",
    "FullLawCitation",
    "FullJournalCitation",
    "IdCitation",
    "SupraCitation",
    "ReferenceCitation",
    "UnknownCitation",
  ]),
  fields: S.JsonObject,
});
const SemanticFields = S.Struct({
  groups: Fields,
  metadata: S.Struct({ fields: S.Record(S.String, S.Union([S.Null, S.String, S.Int])) }),
});
const Edition = S.Struct({ artifactSha256: S.String });
const Publication = S.Struct({ all_editions: S.Array(Edition), edition_guess: S.NullOr(Edition) });
const kinds = {
  FullCaseCitation: "case",
  ShortCaseCitation: "shortFormCase",
  FullLawCitation: "law",
  FullJournalCitation: "journal",
  IdCitation: "id",
  SupraCitation: "supra",
  ReferenceCitation: "reference",
  UnknownCitation: "unknown",
};
/** Compare kind, components, metadata and ordered edition identities.
 * Callers separately prove native ranges; reporter mappings and vocabulary
 * version laws retain their independent proof obligations.
 * @internal @category testing @since 0.0.0
 */
export const compareCitationCanonicalModel = Effect.fn("CanonicalModelTest.compare")(function* (
  actual: Citation,
  raw: unknown,
  id: string
) {
  const original = yield* S.decodeUnknownEffect(Model)(raw);
  const encoded = yield* S.encodeEffect(Citation)(actual);
  expect(encoded.type, id).toBe(kinds[original.citationType]);
  const semantic = yield* S.decodeUnknownEffect(SemanticFields)(original.fields);
  expect(encoded.components, id).toEqual(semantic.groups);
  const fields = R.filter(
    semantic.metadata.fields,
    (_, key) => key !== "pin_cite_span_start" && key !== "pin_cite_span_end"
  );
  const metadata = yield* S.decodeUnknownEffect(Fields)(fields);
  const actualMetadata = yield* projectCitationSemanticMetadata(actual);
  expect(actualMetadata, id).toEqual(projectCitationCanonicalExpectedMetadata(metadata));
  if ("publication" in actual) {
    const publication = yield* S.decodeUnknownEffect(Publication)(original.fields);
    const candidates =
      actual.type === "case" || actual.type === "shortFormCase"
        ? A.map(actual.publication.editions, (candidate) => candidate.edition)
        : actual.publication.editions;
    expect(candidates, id).toEqual(A.map(publication.all_editions, (edition) => edition.artifactSha256));
    expect(O.getOrNull(actual.publication.selectedEdition), id).toBe(publication.edition_guess?.artifactSha256 ?? null);
  }
});
