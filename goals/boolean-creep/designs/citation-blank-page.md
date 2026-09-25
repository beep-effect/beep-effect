# citation-blank-page

P2 refreshed at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,2026-09-22.
Stored wire owner4/3 remains designed, pending independent replacement P3.

## Current shape

The exported `FullCaseCitation` codec stores a default-false blank-page bit
beside an optional reporter page. False/None is a legitimate citation with no
page recorded. True/Some contradicts the documented model and silently causes
`toBlueBook` to ignore the number.

## Cardinality gap

Four boolean/presence combinations are representable and three are legal:
`absent`, `numbered-page({ page })`, and `blank-placeholder`. Only true/Some is
forbidden. `unpublished` and inherited inFootnote remain independent; crossing their two and three states yields24/18 for that expanded finite projection. No page-number value collapse is implied by the presence abstraction. False/None is supported by the sparse constructor476-480 as well as the optional field/default contract.

Annotation464 also describes producer confidence reduction to0.8. This migration must not impose that as a new global constructor constraint: the explicit blank fixture628-637 uses citationBaseInput151-158 with confidence1. Preserve confidence as existing S.Finite. That fixture demonstrates supported blank+confidence1; the phase-oriented annotation does not justify dropping it.

## Target schema

Define a private `CasePageDisposition` LiteralKit and annotated named cases forming a tagged union for `absent`,
`numbered-page` with `NonNegativeInt`, and `blank-placeholder`. The decoded
`FullCaseCitation` owns one page disposition. Preserve the existing flat public
wire shape with an explicit boundary codec using the Effect v4 `S.decodeTo`
transformation pattern: omitted/false plus absent page decodes to absent,
false plus a page to numbered-page, true plus no page to blank-placeholder,
and true plus a page fails. Encode to the old `hasBlankPage` and `page`
properties and materialize the existing false default. Preserve page0 and the complete NonNegativeInt domain. Annotate before toTaggedUnion to retain match/case statics. Keep the raw schema private and reject contradictory values before projection, without dropping the page or changing the flag.

Build the canonical citation class from supported fields/Struct, then compose the public codec separately. Effect v4 Class.extend14423 does not accept arbitrary transformed codecs; decodeTo5388 transforms source Type to target Encoded. Target the canonical type-side schema when constructing class instances inside the transform. Preserve FullCaseCitation.make and its public static toBlueBook through a proven schema/namespace construction, not assertions that fabricate codec statics. Prove construction, formatter, recursive interfaces and union dispatch in a focused fixture at implementation. Keep explicit recursive namespace boundaries where needed.

## Migration inventory

- `Citation.models.ts:233-582` — replace the two decoded fields in the full
  case model with the page disposition while retaining all other fields,
  defaults, annotations, and the `type: "case"` discriminator. Retain full
  CitationBase fields including id/span/confidence/timing/warnings/group/footnote
  metadata; volume number|string, reporter, optional pincite/pinciteInfo,
  court/year/normalized variants, unpublished, groupId/parallelGroup and full
  parallelCitations payloads; recursive parentheticals, subsequentHistoryEntries,
  historyChain/subsequentHistoryOf including optional priorId; full date/parsed
  month/day, possibleInterpretations with their own page/confidence/reason,
  fullSpan, party names/normalized names, proceduralPrefix, nominative volume/
  reporter, disposition/justices/scope/adminParenthetical/inferredCourt/spans.
  Those nested page fields are distinct owners and remain untouched.
- `Citation.models.ts:551-580` — match the disposition in `toBlueBook`:
  absent contributes no page, numbered-page contributes the same leading-space
  number, and blank-placeholder contributes the exact `" ___"` text. Preserve
  reporter, case name, pincite, court/year formatting, and ordering.
- `Citation.models.ts:624-752` — update the hand-written recursive decoded
  `FullCaseCitation.Type`; keep `FullCaseCitation.Encoded` flat with optional
  `hasBlankPage?: boolean` and `page?: number` exactly as today.
- `Citation.models.ts:1499,1573,1603,1648` — keep FullCaseCitation inside the
  exported recursive Citation codec and its decoded/encoded union aliases.
- `values/Citation/index.ts:21`, `values/index.ts`, and the package root already
  expose FullCaseCitation. Export the new page-disposition owner through the
  same value surface when needed by decoded constructors. Assess actual release policy for the public decoded API migration; no automatic changeset follows solely from export status.
- `LawPracticeDomain.test.ts:472-592,594-703,705-730,738-741` — migrate decoded
  constructors/readers, retain sparse/default encoding and recursive arbitrary
  round trips, and retain exact Bluebook strings.
- CaseGroup.model.ts58 embeds FullCaseCitation directly, and its example31 constructs it. Preserve primaryCitation nested codec, mentions Citation array and parallel strings. The old audit omitted this direct consumer.
- Law-package and app search found no parser or persistence adapter constructing
  or reading this pair outside the domain model/tests, but its exported codec,
  `Type`, `Encoded`, and recursive Citation membership make it a real wire API.

## Guard-deletion accounting

No existing runtime coherence rejection is claimed deleted. Delete decoded `hasBlankPage`, the decoded page Option, their correlation, and
the precedence ternary in `toBlueBook`. Only the boundary codec handles the old
flat fields. Keep unrelated optional pincite, normalized reporter, court/year,
unpublished, parenthetical, and history guards.

## Encoded-side impact

This is Tier 2 wire-adjacent, not internal Tier 1. Legal encodings remain:
absent emits `hasBlankPage: false` with no page, numbered emits false plus the
same page number, and blank emits true with no page. Sparse input may continue
omitting the false flag. The existing explicit `FullCaseCitation.Encoded`
shape and every containing Citation encoded union remain stable. The
contradictory true/page input becomes a schema error rather than losing its
page during formatting.

## Test impact

Test all four raw tuples (three legal) through the public codec, all three decode/encode projections, omitted-default behavior, rejection
of true plus page, constructor types, and exact `toBlueBook` output. Keep
schema-derived arbitrary tests for `FullCaseCitation`, `Citation`,
`FullCitation`, CaseGroup primaryCitation, and nested parentheticals so the compatibility codec is covered
recursively. Retain false/None as an explicit fixture. Run the focused domain
suite and `bun run beep quality package-verify @beep/law-practice-domain`, then campaign and Yeet gates. This P2 audit performs finite arithmetic and source inspection only, with no runtime codec/formatter execution or independent P3 credit.

## Risk and sequencing

Land alone as Tier 2 because FullCaseCitation is a public recursive codec. The
main risks are flattening the wire incorrectly, losing the encoded false
default, or changing formatting order. Keep `unpublished` and all other
citation optional fields outside this union.
