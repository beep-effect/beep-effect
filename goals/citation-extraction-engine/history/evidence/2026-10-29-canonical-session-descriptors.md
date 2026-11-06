# Canonical descriptors from issued session origins

Date: 2026-10-29. This implements the private default descriptor path for
registered canonical resources with available semantic hash inputs. Production
Layer integration and exhaustive resolver completion remain open.

## Owned origins and immutable models

The runtime registry records a Canonical or Host origin for every registered
resource. Canonical origins retain the resource object's owned semantic
reference, obtained after creation rather than reread from caller data. The
session seals these origins with its issued snapshot before closing its owner.
Its schema requires unique origin identities and origin coverage for every
registered decision, assignment, group, prior-full and last-resource reference.
Unused objects remain valid registry entries without forcing a hash operation.

SessionDescriptors reads that issued snapshot and captures authenticated frozen
edition data and Crypto. Its returned describe method has R = never. Canonical
hashes use final sealed semantics, including detached citations, through the
existing exact case/publication hash implementations. No dispatch host hash,
truth or equality operation runs during descriptor production. Caching applies
only after sealing; it cannot change live dictionary or candidate-set behavior.

The versioned External scope hashes the JSON tuple containing
citation-canonical-resource-descriptor/v1, eyecite/2.7.6 and the pinned source
commit. The key hashes the tuple containing eyecite-resource-current-hash/v1
and the decimal current Resource hash. These label the pinned canonical
Resource equality domain. They do not replace native runtime lookup, insertion
entry IDs or member-list IDs. Publication payload order remains significant.

A Host origin requires the explicit optional host descriptor service regardless
of its presentation. A host object presenting a valid default-looking mention
is still a host object. Missing ports and unknown registry references fail
closed. Native null-page identity inputs remain unavailable; explicit
canonical description requiring them fails rather than inventing an identity.
An unused null-page object does not prevent describing an unrelated resource.

## Source evidence and target controls

The case hash corpus remains unchanged at SHA-256
b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4.
The publication corpus remains unchanged at SHA-256
57962d12465617aca8f4f483329ac1c0ef94b2f2c866e7f836edc0a29a7e8599.
Their existing source manifests and verifiers retain provenance. The target
test verifies complete fixture bytes before selecting three successful case
rows and the real frozen law and journal rows. Expected descriptor keys are
computed directly from source-observed decimal hashes, independently of the
target canonical hash helper. Synthetic publication edition payload controls
are not substituted for authenticated frozen editions.

Distinct canonical resource objects for the same semantic reference produce
the same descriptor. The unused null-page control fails only when described.
A deceptive host presentation rejects without its explicit port and succeeds
with that port; its native hook trace remains unchanged. All three actual
mutable-key source scenes now use the canonical descriptor factory and restore
the automatically produced document. Independent owners have different random
scopes but reproduce identical receipts and bindings.

This is private canonical descriptor coverage, not a general Python built-in
normalizer, native identity allocator, finalizer/reentrancy implementation or
production CitationEngine Layer. Detailed default diagnostics, extraction,
regex safety, Bluebook laws and exhaustive source/donor target accounting
remain required. No completion row or semantic waiver is promoted.

## Validation

The complete server package gate passes build, source/test type checks, tests,
lint and documentation generation (audit 32.1 seconds; docgen 13.7 seconds).
The focused descriptor/host/registry run passes all eight tests in three files.
Fresh pinned-oracle replay reproduces all 24 case hashes, 22 publication hashes
and 11 model-mutation scenes, with eight corruption controls for each artifact.
The ten-component evidence audit passes while target parity remains pending.
All 37 divergence corruption controls pass, including rejection of incomplete
proof in strict mode. Goal doctor reports no new blocking findings and the goal
index check passes. The new evidence note and README pass Markdown lint.
