# CLI Option.none comparison migration

## Preserved behavior

This batch selects 22 files from the existing open CLI EV006 inventory and
replaces 97 comparisons against `O.none()` with public `assertNone` calls.
The installed rc.118 implementation uses `deepStrictEqual(option, Option.none())`:
52 strict comparisons retain strict comparison, and 45 `toEqual` comparisons
adopt the canonical strict helper. Each original subject is evaluated once.
No test registration, timeout, property setting, native boundary or test body
outside the assertion changes is removed.

Nine subjects have an optional indexed type. Each is bound once in a local
block, checked with public `assertDefined`, then passed to `assertNone`.
An undefined subject still fails as it did in the original comparison; no cast
or fallback converts it into an Option. Two nested terminal-state calls use
pipe syntax to satisfy Effect diagnostics while retaining their call sequence.

Preparation checks namespace and assertion import provenance, shadowing,
unique imports and syntax. A structural statement comparison verifies the
original 97 edits; a second comparison verifies only the eleven diagnostic
repairs. Formatting changes are accounted for without ignoring operators,
identifiers or literal values.

## Detector and ledger evidence

The actual final-source detector comparison removes exactly 97 EV006 findings.
All other groups preserve multiplicity and traversal order. Twenty-seven
changed enclosing-statement anchors are narrowly reconciled by occurrence and
evidence only, preserving every other baseline field and status. No new debt
or exception is added to the baseline.

Ninety-three removals match unique existing open ledger rows. Four assertions
have no historical match by file, rule and evidence: the median pickup result,
the coverage selector, and malformed lockfile version reads for turbo and Biome.
Their captured findings will receive separate fixed records after the source
commit is saved. Existing identities remain intact.

## Verification

The before cohort passes 1,182 tests on Node in 137.586844776 seconds and Bun
in 90.026601271 seconds, with zero failures/skips and stable source hashes.
The initial after cohort also passes all 1,182 tests on both runtimes, but its
source precedes the eleven TypeScript diagnostic repairs; those timings do
not stand in for final-source proof.

The final generated package-test-typecheck artifact reports exit zero with
empty diagnostics. The reconciled ratchet passes with 4,079 findings, zero introduced and 938
resolved baseline findings, scanning 1,217 files in 10.34 seconds. Final-source
Node/Bun comparison and full CLI package audit/docgen are running; their
results are not yet claimed.
Runtime versions, limits, load and CPU/memory/I/O pressure are recorded with
each timed run. Concurrent workstation work prevents a causal performance
claim from these samples.

Private receipts use `cli-option-none-equality-*`: source proposal, draft
validation, diagnostic plan, both statement checks, detector comparison,
narrow reconciliation, ledger plan, timing reports and actual typecheck result.
The broader goal remains open until the full inventory and baseline close.
