# Mixed live resources and independent edition selection

Date: 2026-10-29. Full-citation resource/table composition proof; final callback
owner dictionary and document projection remain open.

## Source and attribution

The producer executes actual Resource objects and one Python dictionary under
clean eyecite 2.7.6 at commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`.
Runtime is CPython 3.11.15, 64-bit hashes and hash seed zero, with the frozen
2026-10-28 clock and reporters/courts versions 3.2.53/0.10.22. Source,
producer, normalizer, lock and license digests are retained in the fixture.
BSD-2-Clause attribution remains in the module and existing root notice.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/live-resources.json`.
SHA-256:
`92a6dd9e59d5808536a4a83b92f3a099713f690cca781dcd5cde1439e75e8b1f`.

Six histories contain eighty-nine events:

- Mixed case, U.S.C. law and Harvard Law Review resources sharing one table;
  live field edits, retained insertion entries, deletion and clear/reuse.
- Distinct but equal resource objects for all three families, preserving first
  key-object presentation while replacing values.
- Actual frozen Georgia law editions with tied abbreviations; reversing their
  relative order changes the hash and can create another insertion entry.
- Actual frozen Rutgers journal editions with tied abbreviations, mixed with
  a C.F.R. law resource, including reversal and empty-candidate states.
- A case whose candidate list is cleared and restored while its selected
  edition remains unchanged; resource hashes and lookups remain unchanged.
- Controlled null-page identity, shared citation aliases and an unregistered
  selected edition that must not be looked up on the null-page branch.

Every event records result, ordered key-object/value entries, exact equality
calls and raw candidate/selected-edition snapshots for every source citation.
Resource equality is wrapped only to log calls to the original method.
The null-page identity uses the earlier controlled source-id hook, without
emitting process addresses or claiming a production identity allocator.

## Source-driven schema correction

Actual source candidate mutations retain edition_guess independently of
all_editions. This occurs in case, law and journal histories. The previous
semantic membership filters rejected these observable states. An initial
hash-only test cleared selectedEdition to fit those filters; that adaptation
was removed before accepting this checkpoint. The target now retains and
compares the actual selected identity after every event.

CitationPublication and CitationCasePublication remain their own structured
codecs, but now represent independent candidate and selection state. The
selected reference remains typed and optional. Empty candidate lists, replaced
lists, order and multiplicity are preserved without dropping the selection.
Domain tests round-trip these states, and the mixed source test compares all
candidate/selection snapshots. Public vocabulary IDs, verified mention
anchors, mention IDs and the shared persisted CitationId are unaffected.
This is correction of provisional citation schemas, not a semantic waiver or
proof that an asserted selection is authenticated parser output.

The actual Georgia and Rutgers pairs strengthen the earlier controlled-edition
counterexample: abbreviation ties are present in the frozen production data.
Sorting candidate bags by artifact identity before hashing is not faithful.
The existing representation laws remain in audit with added source evidence.

## Generalized resource owner

ResourceObjects replaces the case-only registry. The captured semantic service
returns a current FullCitation plus an explicit missing-page identity input.
The registry snapshots that data, resolves case selection or ordered law/journal
candidates through the authenticated frozen edition service, then uses the
exact source hash producers. No caller-supplied edition payload is accepted by
this owner. Case null pages skip edition lookup, and absent pages fail before
lookup. The table retains stored insertion hashes and checks object identity
before calling current equality.

Fresh object allocation, handle ownership, closure, shared work, allocation
ceilings and serialization remain the same implementation for all families.
Existing thirty-eight case-only source events and ownership/work/concurrency
controls remain regression checks. Their no-selection adapter guard fails any
unexpected artifact lookup; mixed histories use the real complete frozen
adapter. The common corpus loader remains test-only.

## Scope and remaining work

This is component composition through the real callback semantic owner's
read/write methods, not final callback dispatch. The callback owner's existing
dictionary/default resources still need one unified table, stable resource
registration, host-key adaptation and per-entry/list projection. The three
mutable default-key callback engine scenes remain open.

The new proofs preserve raw candidate order and stale selection, but do not
restore raw order discarded in earlier normalized evidence. Production asset
loading, live null-page identity allocation, arbitrary host/model behavior,
reentrant comparisons and final error mapping remain open. Full parser safety,
Bluebook, exhaustive accounting, reflection and one-PR closeout remain required.
No canonical, donor, divergence or safety completion row is promoted.

## Verification

All eighty-nine mixed events and thirty-eight case-only regression events pass.
Eight corruption controls and fresh pinned-source replay pass. Package gates
pass for domain (audit 7.2 seconds, docgen 8.6 seconds), use-cases (8.4/8.7)
and server (33.3/12.0), including builds, source/test type checks, full package
tests, lint and documentation. New evidence/README and added source/specification
sections pass Markdown checks; legacy full-file line-width findings remain
outside this change. Git whitespace checks pass. Final target parity remains
pending and the goal active.
