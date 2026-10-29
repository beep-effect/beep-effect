# Exact case/resource hash production

Date: 2026-10-29. Private hash helper proof; callback owner integration and
live missing-page object identities remain open.

## Source and attribution

The producer executes actual FullCaseCitation and Resource hash methods from
clean eyecite 2.7.6 at commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`.
Python is CPython 3.11.15, with 64-bit hashes and hash seed zero.
Frozen dependencies remain reporters-db 3.2.53 and courts-db 0.10.22.
The artifact records exact models.py/utils.py, lockfile, license and producer
hashes. Attribution remains Free Law Project, BSD-2-Clause, under the existing
root notice.

Artifact:
`packages/law-practice/use-cases/test/fixtures/eyecite/case-resource-hashes.json`.
SHA-256:
`b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4`.

## Observed and implemented behavior

Twenty-four cases cover known pages 1/2/20, changed volume, absent versus null
volume, null versus empty reporter, corrected reporter and absent raw reporter,
ignored extra groups and metadata, BMP and astral text, quotes/backslashes,
controls/DEL and lone high/low surrogates. Source field-access failures are
captured for missing page and missing uncorrected reporter.

The private helper builds the source's sorted-key JSON with its exact spaces
and ASCII escapes, hashes UTF-8 with the captured Crypto service, and reduces
positive SHA integers under the frozen CPython integer-hash modulus. Resource
JSON embeds the citation hash as an unquoted decimal integer. The complete
preimage is captured before the first asynchronous digest. Repeated calls on
the same changed input observe current fields rather than a cached result.

Four explicit-null-page cases use a maintainer-only module-global id hook with
controlled positive identity values. They execute the actual source hash
methods without recording process addresses. Same/different identities and
lazy reporter/edition access are proved conditionally. The target requires an
explicit identity input on this branch and skips lookup coherence there.
This is not evidence for a production identity allocator.

The test runner's static JSON importer rejects isolated surrogate escapes.
Runtime file reading plus the Schema JSON codec preserves these valid source
fixtures. A test asserts the artifact's exact byte digest before decoding.

## Verification and limits

All twenty-four target comparisons pass. Eight corruption controls reject
missing/duplicate cases, changed license/runtime, wrong hash, changed identity
mode and wrong field-access outcomes. Fresh frozen-source replay reproduces
all decoded artifact values.

The server package gate passes: audit 36.7 seconds and docgen 11.8 seconds,
including build, source/test type checks, full package tests, lint and docs.
The ten-component evidence audit passes with the final target comparator still
pending. Goals doctor reports no new blocking findings. New evidence/README
and the added source-ledger section pass Markdown checks; the existing ledger
line-width findings remain outside this change. Git whitespace checks pass.

The helper is not yet connected to the callback owner or the runtime dictionary.
The three mutable default-key engine scenes remain open. Law/journal edition
hashing, host-key normalization, live identity allocation, per-entry group
projection, shared work limits and final engine error mapping also remain open.
No canonical, donor, divergence or safety row is promoted. Full engine parity,
Bluebook, exhaustive proof and one-PR delivery remain required.
