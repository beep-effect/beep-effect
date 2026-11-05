# Detached callback objects and semantic references

Date: 2026-10-29. Focused private execution proof; exhaustive parity and final
engine integration remain open.

## Provenance and scope

The canonical source remains eyecite 2.7.6 at the recorded clean commit/tree.
The sixteen-scene mutation artifact is unchanged at SHA-256
`26e81eae9bfcd03ef2370be5d22f7241d96eea18591df602cced8dbc12540a63`.
Its source/license/exporter pins and replay are recorded in the earlier
mutation-shapes evidence. No oracle or donor runtime dependency was added.

The target now executes every scene: 16 scenes, 38 input occurrences and 38
callback events. It compares complete before/after events, resources, ordered
members, list slots, retained dictionary identity and final groups. Detached
semantic fields and object-slot references are compared separately. The
remaining three scenes from the prior checkpoint now execute:

- A callback inserts a detached citation as a returned member.
- A supra callback appends a detached full citation and invokes the real
  default supra helper, followed by the real default Id. helper.
- A supra callback replaces prior-full context with a detached full citation,
  then invokes those same production defaults.

The semantic witness construction explicitly sets the source scene's Detached
antecedent before verified preparation. Original-source extraction/span parity
is still separate from these semantic callback witnesses.

## Ownership and identity

Prior-context entries and group members now use CitationGroupMember, the
existing domain mention/detached tagged reference. Detached objects reuse
Citation. No second semantic hierarchy, fake anchor or physical occurrence ID
was introduced. Live state remains server-owned; no service or function is
placed into an engine request, and captured methods have R = never.

The operation owner registers detached semantic objects. Re-registering the
same object reuses its token; two objects with equal semantic values get
separate tokens. A WeakMap tracks registration identity independently of
semantic equality. Stored semantic values are snapshotted before hashing and
returned through fresh data views. Allocation order is preserved explicitly,
independently of hash-map iteration order.

The private cd1 protocol hashes a schema-encoded tuple of citation-detached/v1,
captured source identity, engine artifact and registration ordinal. The scope
is captured before asynchronous work. This is a document-local object token,
not an attestation of classification or source origin; it has no global
cross-operation ownership/equality claim. A copied reference may name a
registered semantic node, but an unknown reference is rejected. Semantic
assertions are not promoted into verified source capabilities.

Known mention references read the already prepared semantic assertion.
Detached references read the registered assertion. Production defaults capture
the same owner and resolve both through that service. Reference metadata lookup
uses the existing Citation union, matching the source helper's metadata loop;
case-specific short/supra filtering remains case-specific.

## Controls and remaining work

Focused controls prove same-object reuse, equal-object distinction, stable
registration order, snapshot-before-hash behavior, snapshot mutation isolation,
unknown-reference rejection and closure after release. Detached nodes consume
the shared mention/object ceiling; a failed extra registration leaves the
catalog unchanged. Repeated detached group references remain explicit without
increasing the physical mention list.

The prior dictionary owner/alias/concurrency/budget/failure/interruption tests,
18 custom callback traces, 76 default contexts and all sixteen structural codec
snapshots retain their prior scopes. No canonical/donor/safety/divergence row
is promoted by these focused tests.

Prior-full state still uses explicit array transitions. Retained prior-full
list identity, later full callbacks mutating that retained list, general host
normalization and arbitrary mutable model behavior require further source
observations and faithful target handling. Registration currently owns semantic
snapshots; this checkpoint does not claim arbitrary Python model mutation.
Final diagnostics/document projection, document identity integration, public
ports, live artifacts, Bluebook and the bounded parser remain open.

## Verification

Final server package gate: audit 36.0 seconds, docgen 11.5 seconds, including
build, source/test type checks, all tests, lint and documentation. Verification
logs use the detached prefix in the existing citation engine cache. The ten
source-evidence audit components and all sixteen mutation source controls pass.
Goals doctor reports no new blocking findings; the goals index, new-note/README
Markdown checks and Git whitespace checks pass. The exhaustive target comparator
remains pending and the goal remains active. No partial PR is published.
