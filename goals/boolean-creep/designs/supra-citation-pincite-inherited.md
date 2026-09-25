# supra-citation-pincite-inherited

P2 at source `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Benjamin's stable-ID-only decision resolves this owner's contract hold. This
is a proposed admission, with replacement independent P3 and GATE 2 pending.

## Current shape

SupraCitation extends CitationBase in
`packages/law-practice/domain/src/values/Citation/Citation.models.ts:1032-1105`.
Its complete provenance cluster is pinciteInherited (Boolean default false),
pinciteInheritedFrom (Option<NonNegativeInt> default None), and
pinciteInheritedFromId (Option<CitationId> default None), at1056-1078.
The index annotation1067 explicitly permits an index only under inheritance.
The ID annotation1075 identifies the same inherited predecessor by stable
identity, surviving filter/sort/map. Either provenance field therefore implies
inheritance. The ID implication is a semantic reading of this documented
referent, not an existing guard or a deduction from absent producers.

The user permits stable ID without index when inherited=true. The fixture at
LawPracticeDomain.test.ts639 permits true with neither provenance value.
Neither permission permits provenance when inheritance is false. CitationBase's
inFootnote at132 is an independent Option<Boolean>; its footnote location and
detector population meaning does not depend on inheritance. Index payloads
remain full nonnegative integers, including zero, and CitationId stays opaque.

## Cardinality gap

Order: inherited flag, index presence, stable-ID presence.

| Flag | Index | Stable ID | Legal |
| --- | --- | --- | --- |
| false | None | None | yes |
| false | None | Some | no |
| false | Some | None | no |
| false | Some | Some | no |
| true | None | None | yes: provenance unavailable |
| true | None | Some | yes: stable identity only |
| true | Some | None | yes: positional provenance only |
| true | Some | Some | yes: both retained |

The complete cluster is **8 representable / 5 legal**. The independent three
footnote states produce24/15 when included in the finite projection. Do not
reduce this to the index-only4/3 pair, require either provenance for true, or
couple the two Options all-or-nothing. Other citation payloads are unchanged.

## Target schema

Replace the three decoded fields by required pinciteInheritance:
NotInherited with no provenance payload, or Inherited with independent
from:Option<NonNegativeInt> and fromId:Option<CitationId>, each default None.
Default the enclosing field to NotInherited. Use private LiteralKit cases,
annotated named class schemas and schema-derived guards/match; map the intact
kit before annotation, annotate the union before toTaggedUnion. There is no
second Boolean and no decoded flat compatibility getters. Five legal presence
strata need only two cases because the two Options are independent in Inherited.

Keep the public SupraCitation's legacy encoded shape through a private flat
boundary schema and an explicit bidirectional codec to a private canonical
citation class. Preserve supported public construction behavior with canonical
inputs and defaults, schema-derived Type/Encoded and the existing recursive
namespace interface boundary. The class extends CitationBase using fields or
Struct, not an arbitrary decodeTo codec; compose the codec separately. Effect
v4 decodeTo maps source Type to target Encoded. If constructing canonical class
instances inside that transformation, target its type-side schema. Prove real
constructor/statics and outer union behavior with a compile/runtime fixture;
do not cast unsupported statics onto a codec.

The raw boundary rejects false with either provenance present before projection.
Use case schemas/derived guards, without silently promoting false to true or
dropping an offending payload. Encoding matches the provenance union and restores
all three flat fields. Preserve every unrelated field through the conversion.
A shared private provenance schema with Id or ShortFormCase may be reused after
all owner audits agree; each remains a separate Tier2 migration/review owner.

## Migration inventory

1. Citation.models.ts1032-1105: preserve type="supra", partyName, pincite,
   pinciteInfo, parenthetical, recursive parentheticalNode and SupraComponentSpan
   spans. Keep all CitationBase fields/defaults/annotations: id, text, span,
   confidence, matchedText, processTimeMs, patternsChecked, warnings, signal,
   stringCitationGroupId/index/size/group, inFootnote and footnoteNumber.
2. Namespace Type1147-1158 replaces only its three decoded provenance members;
   Encoded1166-1177 retains all legacy fields, particularly1172-1174. Preserve
   Parenthetical.Type/Encoded recursion through explicit interfaces. Do not
   broadly rewrite sibling recursive citation types.
3. ParentheticalCitations65-77, Citation union1520 and Type/Encoded1594/1624,
   and ShortFormCitation1710 must use the public codec. Test nested round-trips
   and outer type discrimination. A private codec not installed at these
   public surfaces does not complete the migration.
4. Preserve wildcard exports through values/Citation/index.ts, values/index.ts
   and package root. Keep public SupraCitation, Citation and ShortFormCitation
   imports; do not expose the private raw flat schema as another decoded domain.
5. LawPracticeDomain.test.ts84/119 codec helpers, constructors482/639,
   decoder540 and encoded-default assertion576 need migration/additions. Update
   Supra documentation example1012 and namespace documentation. Retain standalone
   supra with absent partyName, sparse fields and true-with-None behavior.
6. Scoped Graft found Supra references only in the model and domain test files;
   provenance member references are in the model. This is not proof about all
   external callers or public input legitimacy. Recheck exhaustive callers and
   barrels during implementation after main advances.

## Guard-deletion accounting

No existing runtime coherence guard is claimed deleted. Remove the three flat
stored decoded fields and corresponding manually declared Type fields. Move the
comment-only implication into the variant structure; retain useful provenance
explanation. Enforce legacy input once at decoding, not in repeated downstream
Boolean/Option reconciliations. Retain scalar, base and recursive validation;
those checks are not deletion credit for this owner.

## Encoded-side impact

Tier2 exported wire-adjacent schema: retain type="supra", all flat encoded
provenance keys and all own/base/nested payloads. Omitted inherited still defaults
false and encodes false (existing assertion576); absent optional provenance
encodes as omitted keys. Preserve ID-only, index-only and neither under true.
Do not derive IDs from positions, impose bounds against an unavailable citation
array, require pincite presence, or restrict parentheticals.

The three false-with-provenance projections become decode failures because they
violate the documented implication. Legitimate encoded normalization stays the
same; do not promise raw-input byte identity when existing defaults already add
false. Compare full old/new encoded outputs including order where serializers
observe it. Assess release policy for the public decoded API change at application;
exported status alone does not decide the version bump.

## Test impact

Exercise all eight projections through the public codec, reject the three invalid
ones without erasure, and round-trip/construct all five legal strata. Cross with
inFootnote None/Some(false)/Some(true) to prove independence. Include index0,
nontrivial opaque ID, default false, omitted keys, true-with-neither, and populated
partyName/pincite/pinciteInfo/spans plus all base payloads. Include recursive
parenthetical children, outer Citation and ShortFormCitation dispatch, namespace
Type/Encoded and barrel imports. Preserve standalone supra without partyName.

Run focused LawPracticeDomain tests and
`bun run beep quality package-verify @beep/law-practice-domain` after source edits,
then campaign and Yeet gates. Use supported Effect boundary error conventions,
not new throwing sync helpers. This audit is source and finite-table evidence;
it does not claim an implementation, runtime migration proof or independent P3.

## Risk

The main semantic risks are losing stable-ID-only provenance, treating true with
no provenance as proof of independence, and accidentally correlating footnote
location or partyName with inheritance. The full table prevents these errors.
The implementation risks are codec/class construction and recursive union typing;
validate those rather than relying on assertions. Coordinate edits to the shared
model file with other owners without merging their review credit. No corpus
closure or dry-round credit follows from this single design.
