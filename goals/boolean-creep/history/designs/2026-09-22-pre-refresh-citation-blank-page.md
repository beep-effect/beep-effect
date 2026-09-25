# Instance

- id: `citation-blank-page`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/law-practice/domain/src/values/Citation/Citation.models.ts:470`
- symbol: `FullCaseCitation`
- members: `hasBlankPage`, `page`
- evidence: E3 at `Citation.models.ts:470-474` declares that blank-placeholder
  true requires page absence; E2 at lines 560-568 gives blank precedence over
  page; E1 at `LawPracticeDomain.test.ts:626-635,705-729` constructs blank/None
  and numbered/Some separately.

# Current shape

The exported `FullCaseCitation` codec stores a default-false blank-page bit
beside an optional reporter page. False/None is a legitimate citation with no
page recorded. True/Some contradicts the documented model and silently causes
`toBlueBook` to ignore the number.

# Cardinality gap

Four boolean/presence combinations are representable and three are legal:
`absent`, `numbered-page({ page })`, and `blank-placeholder`. Only true/Some is
forbidden. `unpublished` is an independently inventoried field and is not part
of this classification.

# Target schema

Define a `CasePageDisposition` LiteralKit and tagged union for `absent`,
`numbered-page` with `NonNegativeInt`, and `blank-placeholder`. The decoded
`FullCaseCitation` owns one page disposition. Preserve the existing flat public
wire shape with an explicit boundary codec using the Effect v4 `S.decodeTo`
transformation pattern: omitted/false plus absent page decodes to absent,
false plus a page to numbered-page, true plus no page to blank-placeholder,
and true plus a page fails. Encode to the old `hasBlankPage` and `page`
properties and materialize the existing false default.

# Migration inventory

- `Citation.models.ts:242-525` — replace the two decoded fields in the full
  case model with the page disposition while retaining all other fields,
  defaults, annotations, and the `type: "case"` discriminator.
- `Citation.models.ts:560-590` — match the disposition in `toBlueBook`:
  absent contributes no page, numbered-page contributes the same leading-space
  number, and blank-placeholder contributes the exact `" ___"` text. Preserve
  reporter, case name, pincite, court/year formatting, and ordering.
- `Citation.models.ts:608-744` — update the hand-written recursive decoded
  `FullCaseCitation.Type`; keep `FullCaseCitation.Encoded` flat with optional
  `hasBlankPage?: boolean` and `page?: number` exactly as today.
- `Citation.models.ts:1507-1536,1578-1618` — keep FullCaseCitation inside the
  exported recursive Citation codec and its decoded/encoded union aliases.
- `values/Citation/index.ts:21`, `values/index.ts`, and the package root already
  expose FullCaseCitation. Export the new page-disposition owner through the
  same value surface and add the required changeset.
- `LawPracticeDomain.test.ts:472-592,594-703,705-730,738-741` — migrate decoded
  constructors/readers, retain sparse/default encoding and recursive arbitrary
  round trips, and retain exact Bluebook strings.
- Whole-repository search found no parser or persistence adapter constructing
  or reading this pair outside the domain model/tests, but its exported codec,
  `Type`, `Encoded`, and recursive Citation membership make it a real wire API.

# Guard-deletion accounting

Delete decoded `hasBlankPage`, the decoded page Option, their correlation, and
the precedence ternary in `toBlueBook`. Only the boundary codec handles the old
flat fields. Keep unrelated optional pincite, normalized reporter, court/year,
unpublished, parenthetical, and history guards.

# Encoded-side impact

This is Tier 2 wire-adjacent, not internal Tier 1. Legal encodings remain:
absent emits `hasBlankPage: false` with no page, numbered emits false plus the
same page number, and blank emits true with no page. Sparse input may continue
omitting the false flag. The existing explicit `FullCaseCitation.Encoded`
shape and every containing Citation encoded union remain stable. The
contradictory true/page input becomes a schema error rather than losing its
page during formatting.

# Test impact

Test all three decode/encode projections, omitted-default behavior, rejection
of true plus page, constructor types, and exact `toBlueBook` output. Keep
schema-derived arbitrary tests for `FullCaseCitation`, `Citation`,
`FullCitation`, and nested parentheticals so the compatibility codec is covered
recursively. Retain false/None as an explicit fixture. Run the focused domain
suite and full `@beep/law-practice-domain` package verification.

# Risk and sequencing

Land alone as Tier 2 because FullCaseCitation is a public recursive codec. The
main risks are flattening the wire incorrectly, losing the encoded false
default, or changing formatting order. Keep `unpublished` and all other
citation optional fields outside this union.
