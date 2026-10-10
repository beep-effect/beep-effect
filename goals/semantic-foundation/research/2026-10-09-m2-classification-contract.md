# M2 pinned classification contract

Ready M2 runtime contract. Run-8 synthetic suite, package audit/docgen and full
IPC/CPC/Nice artifact proof pass. The append-only handoff records the pinned
archive hashes, concept counts, lookups and M1 same-manifest regression.

## Admission and identity

Load `ClassificationRegistry.load(manifestPath, vendorRoot, pin)` with an explicit
`ClassificationPin` containing `kind` and `edition`. The pinned editions are
IPC `2026.01`, CPC `2026.08` and Nice `13-2026`. Unknown, empty and unsupported
pins fail closed; there is no latest alias. Full master data stays in ignored
vendor files. The tracked fixtures contain synthetic titles.

Scheme IRIs are minted through `$SemanticFoundationId` as
`https://ns.beep.sh/ontology/semantic-foundation/classification/<kind>/<edition>`.
Concept IRIs append `/concept/<notation>`, with a patent notation's slash
replaced by a hyphen. IPC `A01B1/02` and CPC `A01B1/02` therefore have different
identities. Nice classes use `1` through `45`; a basic identifier is its
zero-padded two-digit class followed by the four-digit source basic number.

## Caller operations

The loader returns an immutable `ClassificationSnapshot` with scheme identity,
authority, edition and concepts. Every concept exposes notation, label, its
immediate broader IRI and hierarchy depth. `resolve(snapshot, pin, notation)`
returns one concept. `broader(snapshot, pin, notation)` returns nearest parent
first through the section or Nice class. `narrower(snapshot, pin, notation)`
returns immediate children. Every lookup checks the caller's authority and
edition; shared strings never fold identities.

`ClassificationError` has a stable reason domain: symbol-not-found,
scheme-mismatch, edition-unpinned, source-parse, manifest-invalid, unvetted,
path-escape and hierarchy-invalid. The shared vendor row decoder rejects
unknown load kinds. Both runtime loaders use the same canonical realpath
containment boundary, including symlink checks. Reversed broader links,
missing parents, duplicate identities and mismatched scheme identities fail.

## Data limits

CPC retains only symbols, hierarchy and title text under R2. Definitions,
notes, references and warnings are discarded at the XML boundary and never
enter a concept or snapshot. IPC and Nice are admitted under WIPO CC BY 4.0;
see the packet's licence ledger for evidence and attribution. Nice joins
structure and English titles by source identifiers, never by labels. This
contract asserts no external exactMatch or closeMatch without an explicit
VETTED mapping row.

IRI changes require a new versioned contract: deprecate existing identities,
never delete or re-point them. Locarno and Vienna remain deferred.
