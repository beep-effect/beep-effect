# statutes-at-large-pincite-is-range

Native P2 proposal on HEAD `4509872869eb87071250c67717769260f850bcf5` / main `d68f1a11dd41579660a6c72f3d3e060d6b61352d`, prepared with gpt-6-astra / xhigh. Proposed correction of the existing D1 record; no canonical admission, independent P3 approval or implementation has occurred. Tier 2, wire exposure, stored state, tagged-union target. Paths below are relative to `packages/law-practice/domain/` unless qualified otherwise.

## Current shape

`src/values/StatutesAtLargeCitation/StatutesAtLargeCitation.model.ts:52-100` defines a real schema class. It spreads `CitationBase.fields` at 54, then owns a `statutesAtLarge` tag, `volume: NonNegativeInt | string`, required `page: NonNegativeInt`, optional numeric `pincite`, optional numeric `pinciteEndPage`, default-false `pinciteIsRange`, optional `year` and optional component spans. `pinciteEndPage` at 70-75 means the end page of a range; `pinciteIsRange` at 77-80 means that this pincite is a range. A non-range carrying a range endpoint contradicts those declared meanings.

The full owner also contains actual `inFootnote: Option<boolean>` from `CitationBase.model.ts:132-138`, so it enters the scanner's two-Boolean net. That inherited field has three values: None when detection was not populated, Some(false) for a detected non-footnote, and Some(true) for a detected footnote. It is independent of the range fact. Do not replace it with a two-valued flag, fold it into this correlated pair, or create a second qualification from the raw footnote pair.

No implementation producer or field reader exists outside the declaration and domain fixtures. This is a documented data invariant, not an existing E1/E2 branch. Explicit constructors at `test/LawPracticeDomain.test.ts:493-497,658-663` prove non-range/unknown-end and range/unknown-end respectively. The annotation at model 74 supplies the concrete supported known-end example `3755-58 -> 3758`; model 79 identifies the same text as a range. Generic schema-derived arbitrary round trips exercise structural codec acceptance, not semantic independence of contradictory fields.

## Cardinality gap

The complete correlated cluster is `[pinciteIsRange, pinciteEndPage]`: two Boolean values × two presence classes = **4 representable / 3 legal**. All values within `Some(NonNegativeInt)` remain payloads; presence counting does not turn the endpoint into a singleton.

| Range | End page | Disposition and proof |
| --- | --- | --- |
| false | None | Legal non-range, constructor 493-497 and false assertion 516; sparse decoder 553-558 materializes false on encoding at 579. |
| true | None | Legal range whose endpoint is not populated; constructor 658-663 and true assertion 693. Preserve it even though `pincite` is also omitted. |
| true | Some(n) | Legal known range endpoint; field descriptions 74/79 explicitly describe range `3755-58` and end `3758`. This positive evidence is a declaration contract, not an executed fixture. |
| false | Some(n) | Contradicts the endpoint's declared role and the range Boolean's meaning. No meaningful contrary fixture or production consumer was found. |

This is E4 implication evidence: endpoint presence implies range. It is not a claim that range implies endpoint presence. The existing D1 argument incorrectly uses the legitimate true/None tuple to infer independence. It does not refute the implication, just as the existing `ids-statement-presence-kind` design preserves a true/None observation while excluding false/Some.

The independent footnote axis would multiply this projection by three (12 representable / 9 legal), but is not an additional correlated member. Keep it outside the minimal inventory cluster and the new state. Required volume/page values and predicates over them are not Boolean axes. Do not infer new endpoint ordering, start-presence, year, group, footnote-number or text-normalization rules.

## Target schema

Keep the model and compatibility code in the existing `StatutesAtLargeCitation.model.ts`; no new service or package is needed. Reuse `CitationBase.fields`, `NonNegativeInt`, `SchemaUtils` defaults, component-span schemas and `$I` annotations. There is no current shared range-disposition implementation to reuse. The separately designed `PinciteInfo` locator has page/paragraph-start requirements and cannot replace this owner because the current true/None constructor must remain valid.

Use a `StatutesPinciteRangeKind` LiteralKit containing `not-range`, `range-unknown-end`, and `range-with-end`. Build its corresponding schema-derived tagged union, `StatutesPinciteRange`, with `kind` as discriminator. Only `range-with-end` carries `endPage: NonNegativeInt`. This is a mixed payload union; do not use a hand-written string/type union, an unvalidated object bag, a Boolean getter, or a stored auxiliary bit.

The decoded citation class owns one `pinciteRange` field with the constructor default `not-range`; all other fields and their constructor defaults are reused unchanged. Define that object as an annotated `S.Class`. Keep the public `StatutesAtLargeCitation` codec name on an explicit flat-wire-to-decoded-class schema, with a schema-derived same-name Type alias and the existing `.Encoded` namespace route. If an internal decoded class name is needed to assemble this public codec, keep it private. All known `.make` and decoded-type callers migrate atomically to the new `pinciteRange` input. Do not expose the private legacy struct as a second domain model or retain the old two-field decoded aliases.

Use a private annotated `S.Struct` only for the genuine legacy boundary exception. It reuses exactly the old field schemas and declaration order, including `BoolKeyDefaultFalse` and `OptionFromOptionalKey` with its None default. Attach the single coherence check at that boundary (or an equivalent schema union of the three legal flat patterns), using schema check metadata and a schema-derived valid-shape guard. The false/Some contradiction becomes a schema issue. Transform the accepted decoded legacy struct into the decoded class through current Effect v4 `S.decodeTo` and its paired `SchemaGetter` directions; the reverse projection exhaustively matches the three target cases and reuses all unchanged payloads. `S.toType` can keep already-decoded branded values, Options and class payloads on the transformation's intermediate side without inventing a second inner encoding. Do not manually JSON-parse, catch arbitrary exceptions, or attach an always-true declaration.

The locally inspected v4 API has `decodeTo` at `.repos/effect/packages/effect/src/Schema.ts:5320-5385`, `toType` at 2458-2492 and standard schema `make` at 193-218. The final implementation must verify its inferred constructor input and both codec directions against the installed Effect version; the external reference checkout is advisory and its exact bytes are captured in the audit. Schema declaration and constructor defaults must remain source-owned, not duplicated in a hand-written helper wall.

## Migration inventory

- `StatutesAtLargeCitation.model.ts:52-100`: reuse the complete base/common fields, introduce the range state and decoded class, and place the flat compatibility codec under the existing public schema value. Remove only the two correlated decoded fields. Keep the `type: "statutesAtLarge"` discriminator, every numeric/string payload, year, component spans, base metadata and field defaults.
- Same file 24-46: migrate the schema-construction example to the new decoded constructor input; omitted range state must still mean not-range. The current legacy wire example remains a valid decoder input.
- Same file 103-131: preserve the public `StatutesAtLargeCitation.Encoded` alias as the old flat wire type. Derive the decoded Type from the new schema; do not introduce a new hand-written object interface.
- `src/values/Citation/Citation.models.ts:1507-1536`: keep the public compatibility codec in `Citation`, at current member 1516. `Citation.Type` at 1581-1604 must name the new decoded type; `Citation.Encoded` at 1611-1634 keeps the same StatutesAtLarge flat wire member. `FullCitation` at 1656-1682 also uses the compatibility codec. The three short-form codecs and their unresolved provenance contracts remain unchanged.
- The recursive `ParentheticalCitations` suspension at `Citation.models.ts:74-83`, `Parenthetical.Type` at 172-177 and its Encoded interface at 193-198 retain their exact full arrays and recursive Citation contracts. Do not change the DocketCitation-only bounded nested arbitrary at 60-63 or introduce a cross-module circular initialization.
- `src/values/StatutesAtLargeCitation/index.ts:21`, `src/values/index.ts:815`, and `src/index.ts:16` retain the existing wildcard export route. Export the new range schema/type through this same value surface only if needed by public decoded construction; preserve public root and `/values` entrypoints in package.json:37-67. Do not add an unconfigured deep package-export path.
- `test/LawPracticeDomain.test.ts:82,117`: the schema codec imports keep their names. Constructor cases at 493-497 and 658-663 migrate to not-range and range-unknown-end; decoded assertions at 516 and 693 match the new disposition. Sparse flat decoder input at 553-558 and encoded false assertion at 579 stay flat and unchanged. Add targeted cases described below.
- The generic round-trip helper at test 129-139 and `Citation`/`FullCitation` arbitrary loop at 738-741 continue to derive from the final schemas. There is no actual parser, database converter, RPC handler or production range-field consumer to migrate in the current checkout. Do not invent a persistence surface from the unrelated PatentCitationEvent entity. Re-run the bounded owner/member/export search before applying to catch a newly added consumer.

The public schema value may cease to be a TypeScript class constructor while remaining the same encoded codec and exposing schema-derived construction. Every current use is `.make`, a schema codec operation, a derived type or union membership; no `new`, subclass, static method, `instanceof`, or `.fields` consumer was found for this owner. Preserve the ability to construct all legitimate old states through the new decoded input; no Boolean compatibility alias is required by a current caller.

## Guard-deletion accounting

Delete the decoded `pinciteIsRange` Boolean, the independent decoded endpoint Option, their duplicate default-bearing representation, and the comment-only coherence requirement that every domain consumer would otherwise need to enforce. The target state carries a numeric endpoint only in `range-with-end`.

There are **zero existing runtime coherence guards or precedence branches** reading this pair to delete. Do not invent an E1/E2 writer or claim branch savings. The compatibility codec adds one boundary coherence decision and owns all remaining flat-field reads/writes. The net effect is a closed decoded invariant with unchanged lawful encoding, not a claim of reduced total line count. Keep all `CitationBase` defaults, footnote detection, common scalar validation, recursive array/default handling and unrelated PinciteInfo checks. Delete no independent footnote guard and claim no credit for other designs' changes.

## Encoded-side impact

This is Tier 2 because a named exported codec and Encoded alias participate in public recursive Citation/FullCitation encoding. The package is private and no database or external transport adapter was found; do not overstate deployed persistence. The separate citation-extraction goal calls the donor models provisional, but this bounded campaign design follows the parent's stricter instruction to preserve the current encoded contract rather than silently rebuilding that other goal's surface.

Preserve the outer flat property names and type tag, `pinciteIsRange?: boolean`, `pinciteEndPage?: number`, all other optional keys and defaults, and every accepted legitimate numeric/string payload. Missing range flag still decodes false, and encoding still materializes `pinciteIsRange: false`, as explicitly asserted at test 579. Missing endpoint maps to None and re-encodes as a missing key; do not introduce null or tagged JSON. A present endpoint of 0 remains present. Preserve the current helpers' precise missing-key versus explicit-undefined/null acceptance; reuse those helpers rather than widen absence to nullish input. NonNegativeInt validation and full volume string/number alternatives remain unchanged.

| Internal case | Legacy encoded projection |
| --- | --- |
| not-range | `pinciteIsRange: false`; endpoint key absent |
| range-unknown-end | `pinciteIsRange: true`; endpoint key absent |
| range-with-end(n) | `pinciteIsRange: true`; same `pinciteEndPage: n` |

Do not silently normalize false/Some to either legal case or drop its endpoint; it contradicts the declared range contract and must fail typed schema decoding. No current specific fixture establishes that tuple as a legitimate observation. Generic arbitrary generation from the old weak schema is not such a fixture. There is no persisted data migration in this design; if a real consumer or stored diagnostic-artifact contract requiring contradictory raw values appears before application, pause and revise the boundary design before narrowing that contract.

## Test impact

When implemented, add an exhaustive four-tuple table with three legal decode/encode cases and one rejection. Use full valid base values and representative endpoints 0 and 3758. Preserve the explicit true/None fixture and add a known-range endpoint fixture derived from the field's documented example. Test sparse omitted flag/default materialization; existing helper acceptance for explicit undefined/null must remain exactly what the baseline codec supports. Test invalid scalar payloads without adding new range-ordering rules.

Cross each legal range case with `inFootnote` None, Some(false), and Some(true), retaining unrelated footnoteNumber payloads without inventing new correlations. This is new validation to implement; the existing repository has no six- or nine-tuple footnote fixture matrix. Retain independent pincite/volume/page/year/span/identity/grouping/warnings/signal values and arbitrary full payloads, including a range-unknown-end whose optional start is absent.

Derive target-state arbitraries from the schema. Keep direct and recursive Citation/FullCitation round trips, nested Parenthetical cases at test 744 onward, exact flat encoded object comparisons, and schema constructor/type checks. Explicitly compare old and new legal encoded outputs including key omission, materialized false and field order wherever a JSON rendering is asserted; the current source contains no custom persisted serializer to change. No browser QA applies. Implementation must run the focused law-practice-domain suite and the required package verification; no product tests ran during this P2 preparation.

## Risk

Land as one Tier 2 instance with its encoded-compatibility proof after independent P3. Shared recursive Citation files require serial edits coordinated with the already designed blank-page and PinciteInfo migrations; count only this instance's actual deletion. Do not merge the unresolved Id/Supra/ShortForm inheritance proposals into this PR.

The principal risks are losing range-with-unknown-end, introducing tagged wire output, changing sparse false materialization, narrowing legitimate full scalar/Option payloads, or treating footnote detection as two-valued. Preserve all current legal states and the original typed validation behavior for unrelated fields. A new runtime boundary gate is intentional; lack of existing branch deletion is disclosed for the independent reviewer. This is source-backed preparation, not permission to implement before the campaign's review gate.
