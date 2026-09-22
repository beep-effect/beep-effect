# Instance

- id: `pincite-range-endpoints`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/law-practice/domain/src/values/PinciteInfo/PinciteInfo.model.ts:187`
- symbol: `PinciteInfo`
- members: `isRange`, `page`, `endPage`, `paragraph`, `endParagraph`
- evidence: E3 at `PinciteInfo.model.ts:115-122,158-210` declares page and
  paragraph mutually exclusive, calls the end fields range endpoints, and
  defines `isRange` as page-or-paragraph range; E1 at lines 134-151 constructs
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

- `PinciteInfo.model.ts:14-109` — update the hand-written recursive
  `PinciteInfo.Type` to own `locator`, but retain the existing flat
  `PinciteInfo.Encoded` fields and the self-recursive `AdditionalPincites`
  codec/default/arbitrary boundary.
- `PinciteInfo.model.ts:111-223` — introduce the named locator union, replace
  the five decoded fields in `PinciteInfo`, and wrap the model with the flat
  compatibility codec. Keep footnote, footnoteEnd, starPage, raw, and
  additionalPincites unchanged.
- `Citation.models.ts:242-269,633-740` — FullCaseCitation embeds optional
  PinciteInfo and names `PinciteInfo.Encoded`; retain that recursive wire
  boundary.
- `Citation.models.ts:1507-1536,1578-1618` — the exported Citation union
  recursively carries FullCaseCitation and its PinciteInfo codec; no union
  discriminator or outer encoding changes.
- `NeutralCitation.model.ts:87-100` — retain its independent numeric pincite
  field and optional structured PinciteInfo embedding.
- `PinciteInfo/index.ts:21`, `values/index.ts:607-618`, and the package root
  expose PinciteInfo. Export the locator owner through the same public value
  surface and add the required changeset.
- `LawPracticeDomain.test.ts:417-537,539-648,683-686` — migrate decoded
  constructors and retain defaults, nondefault recursive additional pincites,
  flat encoding, and recursive Citation arbitrary round trips.
- Whole-repository search found no production parser/reader beyond these
  schema embeddings, but `PinciteInfo.Type`, `PinciteInfo.Encoded`, the value
  barrels, and recursive codecs are explicit public wire exposure.

# Guard-deletion accounting

Delete decoded `isRange` and all four locator Options, their five constructor
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
the locator and PinciteInfo while retaining the recursive arbitrary override
that bounds additionalPincites. Preserve starPage-only, footnote-only,
footnote-range, and nested additional-pincite fixtures to prove those facts
remain independent. Run focused domain tests and full package verification.

# Risk and sequencing

Land alone as Tier 2. Recursive codec construction is the main topology risk:
keep the hand-written Type/Encoded boundary and suspended AdditionalPincites
without circular class initialization. Do not combine star pagination or
footnote ranges with locator range state, and do not infer endpoint ordering
from raw text.
