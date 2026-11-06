# Authenticated frozen edition adapter

Date: 2026-10-29. Complete immutable reporter/edition payload proof; final
engine artifact loading, raw candidate order and callback integration remain open.

## Complete source binding

The source producer traverses the actual EDITIONS_LOOKUP from clean eyecite
2.7.6 at commit `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`.
It normalizes every actual immutable Edition and Reporter through the existing
operation-corpus normalizer, then compares every original canonical payload
and content identity with the committed operation corpus. The sets match
exactly: 2,430 reporter records and 2,533 editions. There are 1,362 case, 373 law
and 798 journal editions. No guessed public ReporterId or current-vintage
metadata replaces the frozen parser data.

Runtime and dependencies remain CPython 3.11.15, hash seed zero, reporters-db
3.2.53 and courts-db 0.10.22. Source, producer, normalizer, lock and license
hashes are recorded. Attribution remains Free Law Project, BSD-2-Clause,
covered by the existing root notice and module header. Python and donor code
are not runtime dependencies.

Evidence artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/frozen-editions.json`.
SHA-256:
`0c23ff189ec5c381303af14c79f630a4d7910a11374308f9c7400ca3f79faf0d`.

The artifact contains each edition's source family, spelling and independently
captured SHA-256 of its complete sorted-key runtime dataclass JSON, including
reporter fields and Python datetime strings. The operation corpus remains the
single retained source of original immutable payload bytes; this fixture does
not duplicate those payloads.

## Adapter validation

FrozenEditions accepts the original reporter/edition payload rows as private
construction data. It verifies a hard-coded reviewed manifest digest:
`b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e`.
That digest binds the sorted identity lists for both complete collections.
It then checks every original payload SHA-256, decodes its source dataclass
shape, resolves reporter closure and builds private immutable lookup data.
No lookup service is returned before the entire validation succeeds.

A caller cannot authenticate replacement data by supplying a new content hash:
that replacement identity fails the reviewed manifest. Source kind is checked
on lookup. Schema bounds enforce exact collection sizes, bounded original
payload lengths and bounded lookup-list length. Construction snapshots rows
before its first digest and yields between bounded digest operations.

Lookup methods have R = never. They return fresh schema-decoded copies and
preserve request order and repeated references. Only known immutable vocabulary
payloads are retained; mutable citation-bearing resources are not memoized.
Date conversion changes the authenticated ISO separator to the source's exact
Python string separator. All 2,533 resulting runtime payload digests are checked
against actual source dataclasses, including complete reporter fields.

## Verification and remaining work

The server package gate passes: audit 34.0 seconds and docgen 11.6 seconds,
including build, source/test type checks, the full test suite, lint and docs.
The ten-component evidence audit passes with the final target comparator still
pending. Goals doctor reports no new blocking findings, goals index passes,
and new evidence/README/source-ledger-section Markdown checks pass. Existing
source-ledger line-width findings are unchanged. Git whitespace checks pass.

Fresh source replay and eight corruption controls pass. The portable checker
also reconstructs every runtime payload from the separately retained original
artifacts and checks complete identity sets, source kinds and all payload
hashes. Target controls reject missing/duplicate identities, edited original
reporter/edition bytes and self-consistent replacement identities. Lookups
reject wrong kinds and unknown references. Returned-data and input-row mutation
do not alter the retained adapter. Digest failures are redacted.

This factory does not load test fixtures or access files. The tests supply
reviewed corpus data; the final engine Layer still needs its production asset
loading and lifecycle integration. Successful content validation does not
recover raw edition-candidate order discarded by earlier representation
normalization. Callers must preserve occurrence order at the hash boundary,
especially for tied edition abbreviations.

The general live resource registry, unified callback-owner dictionary, three
mutable-key callback engine scenes, null-page identities, host-key normalization
and per-entry/list projection remain open. Final parser safety, Bluebook,
exhaustive parity/accounting and one-PR closeout remain required. No canonical,
donor, divergence or safety completion row is promoted.
