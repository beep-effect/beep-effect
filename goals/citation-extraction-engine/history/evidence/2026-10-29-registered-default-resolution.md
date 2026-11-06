# Registered default resolution and explicit null-page identities

Date: 2026-10-29. One private captured resolver now runs verified input,
registered default callbacks and issued document production. The public raw-text
engine and production identity allocator remain unfinished.

## Operation identity boundary

Pinned FullCaseCitation hashes an explicit null page using the citation object's
identity integer. Its reporter and edition fields are not eagerly required on
that branch. Resource hashing then hashes that citation hash. Publication
null-page behavior remains its separate source behavior.

CitationMissingPageIdentityFactory is an optional trusted server service. It
builds an independent identity reader for each runtime owner; callable request
fields cannot select it. The runtime requests an identity only when a case hash
actually encounters an explicit null page. It validates the returned integer
and memoizes it by owned semantic reference for that operation. Different
Resource wrappers around one citation share its identity; the resource wrapper
slot, citation content and final dictionary insertion entry are not substitutes.
The adapter receives a copied semantic reference, not the registry's mutable
reference object. Adapter failures are sanitized.

Canonical origin snapshots now retain any identity integer actually acquired
during dispatch. Sealed descriptor production uses that captured value, never
calls the live identity reader again and does not allocate a replacement. An
unused null-page resource without acquired identity still fails if explicitly
described. A missing identity service fails closed. This is an integration port,
not an implementation or parity claim for a general native identity allocator.

## Captured default resolver

RegisteredResolver captures Crypto, authenticated frozen editions and the
runtime factory, including optional trusted identity adapters. Its resolve
method has R = never, checked by assignment in the integration test. Each call
verifies its input, allocates independent work and callback ownership, executes
registered default dispatch, constructs sealed canonical descriptors, and
produces the document, receipt and exact resource bindings. Callers no longer
manually wire the runtime, callbacks and document producer for this path.
The same operation work counter covers dispatch, matching and canonical
post-dispatch descriptor hashing. A measured control gives dispatch exactly
its required allowance, then proves the complete resolver rejects the extra
descriptor work rather than resetting the budget. A subsequent ordinary call
succeeds. Descriptor limit-exceeded failures retain that closed reason through
the document projector while unrelated descriptor errors remain sanitized as
identity-failed. Mismatched descriptor counter ceilings reject. Standalone descriptor
construction retains a bounded local counter when no operation counter exists.
The prepared default runner also closes ownership if callback construction
fails, as well as after dispatch.

The legacy resolver remains for comparison and still needs retirement. This
private method consumes already verified semantic occurrences; it does not
extract citations from raw text. Detailed None/ambiguity diagnostics remain
separate work. The generic callback-unresolved result is not promoted into a
more specific explanation without branch evidence.

## Source observations and integration evidence

The unchanged case-hash corpus has SHA-256
b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4.
Four rows explicitly use the existing controlled source-id hook: null-page,
null-page-same-identity, null-page-other-identity and null-page-lazy-edition.
The integrated test supplies those exact source integers through the new port.
Source-observed Resource hashes determine descriptor expectations independently
of the target hash helper. Equal controlled identities share one group; the
other identity has a separate group. All four rows traverse default dispatch
and sealed projection. Extra Resource wrappers for each semantic reference
compare equal without causing additional identity reads. Four reads occur in
dispatch and no additional read occurs during projection.

The unchanged focused default corpus has SHA-256
89d86c6aefecc02a30e6d719af9277050d8023949d4fba69912e2b9295d20e05.
Its 46 contexts contain 116 mentions, 41 successful outcomes and five source
exceptions. Fresh pinned-source replay matches every decoded fixture field;
JSON formatting differs, so this is not a byte-identical replay claim. The
integration test now checks the corpus's complete byte hash before decoding.

All 46 focused contexts plus all 30 committed default operation observations
run through RegisteredResolver. The latter retain the existing operation
corpus hash ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1
and 94 mentions. All 71 successful contexts preserve exact ordered group
memberships and restore their documents using generated receipts and bindings.
The five source exceptions produce closed sanitized failures. Exact Python
exception kinds are not equated to the server's failure tags.

These 76-context tests use an explicit controlled identity adapter, including
the two successful null-page contexts. They prove integration with that adapter;
they do not qualify its sequential test integers as production native identities.
Independent concurrent calls reproduce receipts and bindings. Exhausting one
operation's work budget does not poison the next call. Omitting the adapter
rejects the successful source null-page case with identity-failed, preserving
the known production gap rather than silently deriving an identity from text.

Production native identity allocation, general host normalization, reentrancy
and finalizers, richer default diagnostics, legacy retirement, authenticated
runtime asset loading and the live Layer, parsing/extraction, regex safety,
Bluebook laws, exhaustive target accounting and the final one-PR lifecycle
remain required. No completion row or semantic waiver is promoted.

## Validation

The complete server package gate passes build, source/test type checks, tests,
lint and documentation generation (audit 33.8 seconds; docgen 11.4 seconds).
The final focused run passes fourteen tests in the default callback, canonical
descriptor and host-resource files. Fresh source execution reproduces all 24
case-hash rows and their eight corruption controls. The focused default replay
matches all decoded fields as described above. Goal doctor reports no new
blocking findings and the goal index check passes. The new note and README
pass Markdown lint. Completion remains unproved; source and donor target rows,
normalization laws and runtime safety must still close independently.
