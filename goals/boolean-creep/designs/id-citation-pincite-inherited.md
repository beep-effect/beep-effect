# id-citation-pincite-inherited

P2 at source `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
This replaces the withdrawn D1 interpretation, not an implemented migration.
The September 22 stable-ID decision resolves the prior owner hold. Independent
replacement P3 and GATE 2 still precede implementation.

## Current shape

`packages/law-practice/domain/src/values/Citation/Citation.models.ts:792-909`
defines IdCitation by extending CitationBase. The complete owned cluster is
`pinciteInherited` (Boolean, default false), `pinciteInheritedFrom`
(Option<NonNegativeInt>, default None), and `pinciteInheritedFromId`
(Option<CitationId>, default None), at809-831. Both optional values are full
payloads; a present index retains its complete nonnegative-integer domain and
CitationId remains an opaque branded string. Never derive identity from index.

The explicit annotation at820 permits an index only when inheritance occurred.
The annotation at828 calls the ID the stable identity of that same predecessor
citation, surviving filter/sort/map. The ID is therefore inheritance provenance,
not an independently observed arbitrary citation link. Reading these annotations
together establishes that either provenance payload implies inheritance. This
second implication is a semantic reading of the documented referent, not an
existing runtime guard or a consequence of producer absence. Benjamin's decision
adds that the ID need not require a retained index; it does not turn that ID into
an unrelated citation reference when inheritance is false.

`LawPracticeDomain.test.ts:638,689` explicitly preserves inherited=true with
both provenance Options absent. The old D1 rationale used that one legitimate
state to discard a one-way implication; it does not prove independence.
CitationBase.inFootnote at132 remains an independent Option<Boolean> inherited
by this owner. All other base and own citation payloads remain independent of
this migration unless an existing schema already constrains them.

## Cardinality gap

Order: inherited flag, index presence, stable-ID presence.

| Flag | Index | Stable ID | Legal |
| --- | --- | --- | --- |
| false | None | None | yes: no inheritance |
| false | None | Some | no: predecessor identity without inheritance |
| false | Some | None | no: predecessor index without inheritance |
| false | Some | Some | no: predecessor provenance without inheritance |
| true | None | None | yes: inheritance known, provenance unavailable |
| true | None | Some | yes: stable ID survives loss of positional index |
| true | Some | None | yes: positional provenance only |
| true | Some | Some | yes: both provenance values retained |

The complete cluster is **8 representable / 5 legal**. Multiplying by the three
independent inFootnote states gives 24/15 for that larger finite owner projection;
inFootnote is not merged into the provenance domain or counted as another
constraint. Other payload presence/value domains are unchanged. This design
must not shrink to the index-only 4/3 pair, force true to require provenance,
or restrict the two inherited provenance Options to all-or-nothing pairing.

## Target schema

Keep all CitationBase fields and every unrelated IdCitation own field. Replace
only these three decoded fields with a required `pinciteInheritance` value:

- NotInherited: no predecessor payload fields.
- Inherited: `from: Option<NonNegativeInt>` and
  `fromId: Option<CitationId>`, independently optional and defaulting to None.

Use a private LiteralKit for the two semantic cases, named annotated class
schemas, and schema-derived tagged-union guards/match. Keep the kit base intact
until mapping members; annotate the union before `S.toTaggedUnion` so generated
statics remain available. Default the citation's provenance field to the
NotInherited case using existing constructor/default helpers. Do not store a
second inherited Boolean or add compatibility getters to the decoded domain.
Five legal presence strata do not require five redundant top-level tags: the
two Options are genuinely independent inside Inherited.

Preserve the public IdCitation codec's legacy flat encoded shape. Use a private
raw flat schema and a private canonical citation class, connected by an explicit
bidirectional Effect v4 schema transformation. The canonical class contains the
provenance union; the exported IdCitation value is the compatibility codec with
schema-derived Type/Encoded and construction behavior. Migrate decoded .make
inputs to provenance; omitted provenance still constructs NotInherited. Do not
pass an arbitrary decodeTo codec to CitationBase.extend: local Effect extend
accepts a field map or Struct. Build the canonical class using those supported
inputs, and compose its codec separately. Use the local decodeTo contract:
transformation decode consumes the source Type and produces target Encoded;
encode reverses that mapping. When constructing canonical class instances in
the transformation, target the class's type-side schema rather than pretending
its encoded optional fields are already runtime Options. Validate constructor
and outer-union behavior with a compile/runtime fixture before implementation
handoff. Do not patch statics with assertions or keep a duplicate flat domain.

The raw boundary schema preserves existing Boolean defaults and optional-key
codecs. It rejects false with either provenance present before any projection
can erase those fields. Case schemas/derived guards establish that relation;
no silently setting inherited=true and no dropping provenance. Encoding matches
the union and reconstructs all three original flat fields, including false for
NotInherited and each independent Option for Inherited. Preserve all unrelated
fields through the complete conversion, including recursive parentheticals.

## Migration inventory

1. `Citation.models.ts:792-909`: separate flat encoded schema from canonical
   IdCitation class and provenance union; retain type="id", pincite, pinciteInfo,
   sectionPincite, parenthetical, parentheticalNode, caseName, plaintiff,
   defendant, normalized party names, proceduralPrefix and spans. Preserve
   all base fields via the existing CitationBase schema, with every default,
   annotation, value domain and ordering behavior required by the encoder.
2. `Citation.models.ts:926-993`: migrate the decoded namespace Type's three
   fields to the provenance value; retain the legacy Encoded members984-986.
   Respect the existing explicit recursive interface boundary for
   Parenthetical.Type rather than causing circular class-base inference.
   Do not broadly rewrite all other recursive citation interfaces.
3. `Citation.models.ts:65-77,1519,1572-1625,1710`: wire the public compatibility
   codec into Citation and ShortFormCitation; update their Type/Encoded paths
   and the suspended ParentheticalCitations edge together. The outer citation
   discriminant remains type="id". Verify schema-derived outer guards/cases,
   nested decode/encode and recursive parenthetical citations; a private codec
   unused by these public unions would not complete the migration.
4. `values/Citation/index.ts`, `values/index.ts`, package root barrels: retain
   existing public IdCitation/Citation/ShortFormCitation exports, with their
   migrated decoded typing and unchanged legitimate encoded fields. Do not
   introduce a second flat decoded alias or export private transport schema.
5. `LawPracticeDomain.test.ts:75,103,481,512,539,575,638,689`: migrate direct
   constructors and assertions, default/round-trip tests and true-with-None
   fixture. Add both index-only and stable-ID-only fixtures. Existing decode/
   encode helper entry points consume the public compatibility codec. Update
   the IdCitation documentation examples and namespace examples accordingly.
6. Graft found the direct IdCitation references and cluster-property reads in
   this model module and LawPracticeDomain.test.ts; no app consumer was found.
   No production in-repo resolver writing provenance was found. Public API
   legitimacy derives from the documented contract and Benjamin's ruling, not
   a claim that these tests exhaust all external consumers. Recheck callers
   and wildcard barrels when implementing after main moves.

This is one Tier 2 owner. Supra and ShortFormCase are separate owners awaiting
their own complete audits; coordinate shared Citation.models.ts edits, but do
not claim their migration or combine distinct Tier 2 records by convenience.
Assess release policy for the decoded public API migration; no unconditional
patch/version-bump claim follows merely from an exported symbol.

## Guard-deletion accounting

No runtime coherence guard currently enforces this owner relation, and none is
claimed deleted. Remove three independently stored decoded fields and their
manual decoded-Type counterparts; the union makes false-with-provenance
unrepresentable. Replace the comment-only “set only when inherited is true”
invariant with the case structure. Retain explanatory provenance documentation,
but do not leave a flat domain bag whose coherence still depends on that prose.

Boundary decoding is the single enforcement wall for legacy input. No repeated
post-decode Boolean/Option reconciliation and no public flat compatibility
getters remain. Existing NonNegativeInt, CitationId, base-field and recursive
payload validation remains; it is not Boolean-creep deletion credit.

## Encoded-side impact

Tier 2, wire/persisted-adjacent exported citation schema. Keep `type: "id"`,
`pinciteInherited`, `pinciteInheritedFrom`, `pinciteInheritedFromId`, all unrelated
encoded keys and nested payloads. An omitted inherited flag still defaults to
false; encoding the default still emits false as the existing fixture575 proves.
Absent optional provenance still encodes as absent keys. Index zero and opaque
stable IDs remain valid; do not normalize IDs or cross-check array bounds here.
Both provenance values can remain present independently under inheritance.

Preserve existing encoded normalization, not invented byte-for-byte identity
between arbitrary raw inputs and re-encoding: the current default already turns
an omitted Boolean into encoded false. Compare each legitimate decoded value's
old/new encoded output, including property order where existing serializers use
it. The three false-with-provenance tuples currently admitted by the permissive
schema become decode failures; they are contrary to the documented implication,
not supported cases to preserve. Add no unrelated pincite-presence requirement.

## Test impact

Before application acceptance, exercise all eight projections through the public
IdCitation codec and all five legal strata through decode/encode and construction.
Repeat across inFootnote None/Some(false)/Some(true) to prove independence. Check
false defaults, omission behavior, true with both None, ID-only, index-only,
both present, index zero and nontrivial opaque IDs. Malformed false/provenance
inputs fail without data loss or implicit promotion.

Compare complete encoded outputs against the existing schema for the five legal
strata, populated base/own payloads and recursive parenthetical citations.
Preserve Citation and ShortFormCitation dispatch, discriminants, type inference,
constructor defaults, namespace compatibility and public barrel imports. Map
schema failures through existing boundary conventions; do not introduce sync
throwing helpers just because legacy tests currently use them.

Run focused LawPracticeDomain tests and
`bun run beep quality package-verify @beep/law-practice-domain` after code edits,
then the campaign and Yeet gates. This P2 audit performs finite arithmetic and
source inspection only; no runtime implementation, package proof or P3 claimed.

## Risk

The main semantic risk is incorrectly treating true-with-None as independence,
or interpreting stable-ID-only permission as permission for provenance when
inheritance is false. The explicit table and documented predecessor referent
prevent both. Public codec/class construction and recursive outer unions are the
main implementation risks; prove their real Effect v4 behavior with focused
fixtures rather than asserting unsupported Class.extend transformations.
No all-corpus or dry-round completion follows from settling this one owner.
