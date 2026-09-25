# short-form-case-citation-pincite-inherited

P2 at source `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
The owner decision permits stable predecessor ID without a numeric index.
This is a design proposal; replacement independent P3 and GATE 2 precede application.

## Current shape

`packages/law-practice/domain/src/values/Citation/Citation.models.ts:1219-1371`
extends CitationBase for ShortFormCaseCitation. The owned cluster at1249-1271
contains default-false `pinciteInherited`, default-None
`pinciteInheritedFrom: Option<NonNegativeInt>`, and default-None
`pinciteInheritedFromId: Option<CitationId>`. The index annotation1260 explicitly
permits a value only when inheritance is true. The stable ID annotation1268
identifies that same predecessor, surviving filter/sort/map. Its implication to
inheritance is a reading of that documented referent, not an existing runtime
guard. Benjamin permits retention of the ID without the index.

`LawPracticeDomain.test.ts:640-645,691` preserves true with both provenance
Options absent. Defaults are exercised at483-487,514 and541-546,577.
CitationBase.inFootnote132 is independent Option<Boolean>; it is not provenance.
Required volume admits NonNegativeInt or string, and reporter remains required.
The model has substantial other payload; none can be dropped by this migration.

## Cardinality gap

Order is inherited Boolean / index presence / stable-ID presence.

| Tuple | Legal | Meaning |
| --- | --- | --- |
| 000 | yes | no inheritance |
| 001 | no | predecessor identity without inheritance |
| 010 | no | predecessor index without inheritance |
| 011 | no | predecessor provenance without inheritance |
| 100 | yes | inheritance with unavailable provenance |
| 101 | yes | stable ID retained without index |
| 110 | yes | index retained without ID |
| 111 | yes | both retained |

Complete provenance projection: **8 representable / 5 legal**. With independent
three-state inFootnote the projection is24/15; do not claim another footnote
constraint. Present payloads retain their full value domains. No requirement is
added that inheritance must have pincite, page, inferred name, or provenance.
Do not collapse to the incomplete index-only4/3 subcluster.

## Target schema

Replace the three decoded fields with `pinciteInheritance`:
NotInherited has no predecessor payload; Inherited has independent default-None
`from: Option<NonNegativeInt>` and `fromId: Option<CitationId>`. Default omitted
provenance to NotInherited. A private LiteralKit defines the case vocabulary;
map the intact kit into annotated case schemas, annotate the union before
S.toTaggedUnion, and use generated guards/match. Two tags suffice because the
Options are independent inside Inherited. Retain no parallel Boolean or flat
compatibility getters on decoded instances.

Keep public ShortFormCaseCitation as the complete legacy-wire compatibility
codec around a private canonical citation class. Build the class through
CitationBase.extend with supported fields/Struct, then compose an explicit
bidirectional Effect v4 decodeTo transformation separately. Local Schema.ts
14423-14445 does not admit an arbitrary transformation as Class.extend input.
A transform returning already-created class instances must target the class
Type projection; decodeTo ordinarily maps source Type to target Encoded.
Prove constructor defaults, exported .make behavior, Type/Encoded namespaces,
and outer recursive unions in a compile/runtime fixture before handoff. Do not
assert/cast class statics onto a codec or retain a second flat decoded model.

The private raw codec retains flat defaults and OptionFromOptionalKey fields.
Reject false plus either present provenance value at this boundary before
projection can erase it, using schema case structure/derived guards. Never
silently promote false or drop provenance. Encoding matches the canonical union
and reconstructs the three legacy keys, preserving independent Options. Existing
base and every own payload pass through the complete conversion. The other two
citation owners may reuse a private provenance domain if their independently
approved designs agree; their inventory ownership and migration credit stay
separate.

## Migration inventory

1. Citation.models.ts1219-1371: retain type=shortFormCase, required volume and
   reporter; retain page, pincite, pinciteInfo, inferredCaseName,
   inferredPlaintiff, inferredDefendant, inferredCaseNameSpan, spans, partyName,
   partyNameNormalized, groupId, parallelGroup, parallelCitations, parenthetical,
   parentheticalNode. Parallel copies retain numeric-or-string volume, reporter,
   numeric page and order. No inferred-name or parallel-group normalization.
2. Retain the complete CitationBase fields/defaults: id, text, span, confidence,
   matchedText, processTimeMs, patternsChecked, warnings, signal,
   stringCitationGroupId/index/size/group, inFootnote and footnoteNumber.
3. Citation.models.ts1413-1441 decoded namespace replaces only provenance
   members1434-1436. Encoded interface1449-1475 retains flat members1468-1470.
   Preserve the explicit recursive Parenthetical.Type interface boundary;
   avoid circular class-base inference rather than broadly rewriting interfaces.
4. Public Citation member1521, Type1595, Encoded1625 and ShortFormCitation1710
   must reference the compatibility codec. ParentheticalCitations68 suspends
   Citation.Type/Encoded; preserve this recursive wiring. Outer discriminant
   remains shortFormCase and generated cases/guards retain correct typing.
5. values/Citation/index.ts, values/index.ts, root index.ts wildcard chain keeps
   the current public exports. Do not export raw transport schema or introduce
   a public alternative flat model.
6. LawPracticeDomain.test.ts81/116 codec helpers,483/514 constructors/defaults,
   541/577 wire defaults,640-645/691 inherited fixture and documentation examples
   migrate to the union. Add index-only and ID-only coverage. Graft exhaustive
   property and symbol search found model/test references, no production resolver
   writer in this checkout. This is not a claim about all external consumers;
   the documented public contract and user decision determine legitimacy.

One Tier2 owner; coordinate shared-file edits with Id/Supra implementations.
Apply actual release policy for the public decoded change, not an automatic
patch-version rule based merely on export visibility.

## Guard-deletion accounting

No runtime coherence guard exists here to delete. Remove the three independent
stored decoded fields and manual decoded namespace counterparts. Their comment-
only coherence becomes case structure; keep explanatory provenance meaning.
The legacy boundary is the one enforcement point. No repeated post-decode
Boolean/Option checks remain. Ordinary payload, brand, recursion and base
validation is retained and earns no Boolean-creep deletion credit.

## Encoded-side impact

Tier2 exported wire/persisted-adjacent schema. Preserve all legacy keys including
pinciteInherited, pinciteInheritedFrom and pinciteInheritedFromId. Omitted flag
still defaults false; encode emits false (existing test577). Absent Options
encode as absent keys. Index zero and opaque stable IDs survive unchanged;
never derive an ID from an index or validate array position bounds here.
The three false-with-provenance tuples become decode failures as violations of
the documented implication. All five legitimate strata retain encoded output,
including defaults and complete recursive payload. Preserve current normalization
rather than promise raw-byte identity for omitted flags that already re-encode
as false. Check output property ordering where consumers serialize it.

## Test impact

Enumerate all eight input projections through public ShortFormCaseCitation;
five legal states must round-trip and construct. Cross all with inFootnote
None/Some(false)/Some(true). Exercise defaults, true-with-neither, ID-only,
index-only, both, zero index, opaque ID and both volume forms. Reject false with
provenance without silently discarding it. Populate every own/base field in
old-versus-new encoded comparisons, including ordered parallel copies/groups,
inferred names/spans and parenthetical child citations nested recursively.
Test public Citation and ShortFormCitation decode/encode dispatch, barrel imports,
Type/Encoded inference, .make defaults and recursive namespace compatibility.
Use existing boundary error conventions and current effectful/nonthrowing codec
APIs; existing synchronous test wrappers do not justify adding new throwing APIs.

After implementation run focused LawPracticeDomain tests and
`bun run beep quality package-verify @beep/law-practice-domain`, then campaign
and Yeet requirements. This P2 inspection claims no implementation/package proof.

## Risk

The main semantic traps are forcing true to require an index, coupling ID to
index despite the ruling, or allowing provenance under false by calling all
currently decodable inputs legitimate. Loss of parallel or inferred-name
payload and broken recursive codecs are implementation risks specific to this
owner. The table and complete migration inventory constrain them. Independent
P3, census and gate completion remain outstanding.
