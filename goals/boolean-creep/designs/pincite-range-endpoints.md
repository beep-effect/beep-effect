# Instance

- id: `pincite-range-endpoints`
- exact source SHA: `cecfb9f8e9a5f20d768666c65f89425349f7f9e6`
- corpus source SHA: `cecfb9f8e9a5f20d768666c65f89425349f7f9e6`
- file:line: `packages/law-practice/domain/src/values/PinciteInfo/PinciteInfo.model.ts:148`
- symbol: `PinciteInfo`
- members: `isRange`, `page`, `endPage`, `paragraph`, `endParagraph`
- evidence: E3 at `PinciteInfo.model.ts:112-117,150-201` declares page and
  paragraph mutually exclusive, calls the end fields range endpoints, and
  defines `isRange` as page-or-paragraph range; E1 at lines 126-137 constructs
  a page range with its start/end and a discrete page without an end.

# Current shape

The exported recursive PinciteInfo codec stores one range boolean and four
optional page/paragraph locator fields independently. The corrected three-field
candidate catches end-kind exclusivity but misses two further contracts: page
and paragraph starts are mutually exclusive, and a range endpoint belongs to a
matching present start locator.

# Cardinality gap

Across the range bit and four presence bits, 32 structural combinations are
representable and five are legal: no structured locator, page single, page
range, paragraph single, and paragraph range. The preliminary 8/3 count covers
only `isRange` plus the endpoint Options and is therefore incomplete.
`starPage`, `footnote`, `footnoteEnd`, `raw`, and `additionalPincites` remain
independent of this cluster.

# Target schema

Define a `PinciteLocatorKind` LiteralKit and tagged union with `none`,
`page({ page })`, `page-range({ page, endPage })`,
`paragraph({ paragraph })`, and
`paragraph-range({ paragraph, endParagraph })`. Replace the five decoded
members with one `locator`. Keep the exported legacy flat encoding through an
`S.decodeTo` codec: classify only those five patterns and reject all others;
encode each member back to the current `isRange`, `page`, `endPage`,
`paragraph`, and `endParagraph` fields. Do not impose numeric ordering or
abbreviation normalization that the current schema does not promise.

# Migration inventory

- `PinciteInfo.model.ts:35-105` — update the hand-written recursive
  `PinciteInfo.Type` to own `locator`, but retain the existing flat
  `PinciteInfo.Encoded` fields and the self-recursive `AdditionalPincites`
  codec/default boundary. Main removed `additionalPincitesToArbitrary` and its
  annotation; do not restore the old constant-empty-array override.
- `PinciteInfo.model.ts:108-211` — introduce the named locator union, replace
  the five decoded fields in `PinciteInfo`, and wrap the model with the flat
  compatibility codec. Keep footnote, footnoteEnd, starPage, raw, and
  additionalPincites unchanged.
- `Citation.models.ts:233-266,624-752` — FullCaseCitation embeds optional
  PinciteInfo and names `PinciteInfo.Encoded`; retain that recursive wire
  boundary.
- `Citation.models.ts:792-909,951-993` — IdCitation embeds optional PinciteInfo
  and exposes it through its recursive Type/Encoded companion.
- `Citation.models.ts:1032-1105,1147-1177` — SupraCitation carries the same
  optional structured pincite; update its decoded companion atomically.
- `Citation.models.ts:1219-1371,1413-1475` — ShortFormCaseCitation also embeds
  PinciteInfo; retain its flat optional encoded field. The separate unresolved
  inherited-pincite provenance cluster is not part of this migration.
- The exported Citation union in `Citation.models.ts:1572-1625` — its recursive
  Type/Encoded companions carry all four case-citation embeddings; no union
  discriminator or outer encoding changes.
- `NeutralCitation.model.ts:87-100` — retain its independent numeric pincite
  field and optional structured PinciteInfo embedding.
- `PinciteInfo/index.ts:21`, `values/index.ts:607-618`, and the package root
  expose PinciteInfo. Export the locator owner through the same public value
  surface and add the required changeset.
- `LawPracticeDomain.test.ts:501-527,562-586,618-623,666-671` — migrate decoded
  constructors and retain defaults, nondefault recursive additional pincites,
  and flat encoding fixtures. Retain the package's recursive Citation
  arbitrary-round-trip coverage when migrating the schema.
- Whole-repository search found no production parser/reader beyond these
  schema embeddings, but `PinciteInfo.Type`, `PinciteInfo.Encoded`, the value
  barrels, and recursive codecs are explicit public wire exposure.

# Guard-deletion accounting

Delete decoded `isRange` and all four locator Options, their four constructor
defaults, and any page/paragraph/range coherence guards. Only the compatibility
codec handles those flat fields. Keep the recursive-array guard/default and
all star-page and footnote fields because they encode separate facts.

# Encoded-side impact

This is Tier 2 wire-adjacent. Preserve the explicit recursive Encoded interface,
property names, optional-key omission, numeric values, required `isRange`,
defaults for starPage/additionalPincites, and nested additional-pincite arrays.
Every legal old value encodes identically. The 27 contradictory presence
patterns become decode errors. No stored database boundary was found for
PinciteInfo, but public callers can use its codec directly or through Citation
and NeutralCitation.

# Test impact

Add table tests for all five legal flat projections and representative failures:
range without end, end without matching start, page plus paragraph, both end
kinds, and non-range with an end. Add schema-derived arbitrary round trips for
the locator and PinciteInfo with the current recursive-array schema derivation;
do not reinstate the removed constant-empty arbitrary override. Preserve
starPage-only, footnote-only, footnote-range, and nested additional-pincite
fixtures to prove those facts
remain independent. Run focused domain tests and full package verification.

# Risk and sequencing

Land alone as Tier 2. Recursive codec construction is the main topology risk:
keep the hand-written Type/Encoded boundary and suspended AdditionalPincites
without circular class initialization. Do not combine star pagination or
footnote ranges with locator range state, and do not infer endpoint ordering
from raw text.
