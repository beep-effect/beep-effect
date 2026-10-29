# Separate insertion-entry identity in citation document receipts

Date: 2026-10-29. Receipt graph and trusted persistence contract correction.
Automatic final callback-session projection and production Layer integration
remain open; this is not a complete engine or authority-key proof.

## Source requirement

The previously pinned model-mutation source fixture is unchanged:
`model-mutation-observations.json`, SHA-256
`dca8b55d551d50c6ca0a2917ebce372b20894d4001b7a9738053c7d96d3cf841`.
All three mutable-key scenes already execute through actual default callbacks,
authenticated editions and the general-key runtime dictionary. A post-insertion
page mutation can leave two dictionary entries referencing resource object zero,
with lists [0] and [1, 2]. The other two scenes retain one entry. Collapsing
entries by resource/authority identity would lose an observable source result.

Receipt v2 imposed a unique authority ID on listed groups. That restriction is
incompatible with the source counterexample. The correction preserves authority
identity and list identity, and gives insertion entries their own identity.

## Schema and projections

CitationResourceGroupId is a public schema-owned cg1 digest token, brand-separated
from authority, mention, detached-object and member-list identities. A listed
CitationResourceGroup now owns this ID and references its authority and list.
Document coherence requires unique entry IDs; several entries may reference the
same authority or shared list. Exact entry order, repeated members, empty entry
presence and list alias relationships remain explicit.

The receipt version advances to citation-document-receipt/v3. Version two is
rejected; silently inventing missing insertion identities is not a lawful
roundtrip. The private original resolver emits deterministic single-entry IDs
using the existing authority digest under the distinct cg1 prefix. This default
producer is not a general mutable-resource identity allocator.

citationGroupMembers reads exactly one insertion entry. citationAuthorityMembers
concatenates every entry for that authority in dictionary order, preserving
repetitions and shared-list aliases. citationAuthorityMentionIds derives the
physical occurrence view from that sequence. The old first-entry-only projection
would silently drop later entries and has been removed.

## Trusted persistence expectations

A resource binding now carries its decision set plus an array of exact expected
entries: document position, insertion ID and complete member-list node. Each
position is checked against the whole ordered group sequence. Binding coverage,
entry identity, authority ownership, list ID and ordered list contents must all
match. This preserves ordering even when entries for different authorities are
interleaved. Bindings remain out-of-band trusted adapter inputs; receipt data
cannot supply them or authorize a canonical-key override.

Unbound default resources still require exactly the single deterministic entry
and ordered decision-derived list. Additional entries require trusted binding
coverage. Every persisted list must remain attached to a verified or bound entry.
The new independent entry count is included in hard graph ceilings; bounded
binding entry counts prevent empty shared lists from bypassing the entry limit.

## Target evidence

Domain controls preserve two entries for one authority, shared lists and both
aggregate and per-entry getters. They reject duplicate entry identities and the
old receipt version. Server controls roundtrip two bound entries for one resource
and reject changed insertion IDs, positions, coverage and final entry ordering.
Existing empty/absent, order/multiplicity, detached and shared-list controls are
migrated to the new explicit entry contract.

The registered callback runtime test now takes each of the three actual
mutable-key source executions through document projection, receipt codec and
verified-source restoration. It compares complete ordered entries and member
lists after restore. The two-entry case retains one bound authority and two
distinct insertion IDs; its member sequences remain [0] and [1, 2].

That test supplies an explicitly controlled external identity descriptor and
exact out-of-band entry expectations. It does not claim that the production
engine can yet derive those descriptors automatically, nor that structural
restoration proves callback decisions or canonical resource hashing. The real
callback events/final groups are separately checked against the unchanged source
fixture before this persistence step. Genuine mention IDs and anchors remain
unchanged through restoration.

The full domain, server and use-cases package gates pass, including build,
source/test type checks, tests, lint and documentation. Final domain audit/docs
times are 7.5/9.3 seconds; server 33.4/11.3 seconds; use-cases 8.7/8.6 seconds.
Fresh replay passes all eleven model-mutation source scenes and eight corruption
controls. Goal doctor has zero blocking findings and the generated index passes.

Automatic per-mention callback decision capture, final session identity/binding
production, native value normalization, reentrant comparison, legacy adapter
removal, production assets/Layer, complete parser safety, Bluebook laws,
exhaustive target accounting, reflection, hosted proof and one-PR lifecycle
closeout remain required. No accounting row or semantic waiver is promoted.
