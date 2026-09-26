# AI Sync and API Transport preparation

This wave uses the existing wave-six inventory from main `7980e5aaa1`.
It covers five recorded files and 41 existing rows. The source snapshot
contains 1,008 current lines, with three files changed since the frozen
census commit `662823dd960367046ba7d73dd8fd25d15782865a`.
No global reinventory is performed for this preparation.

## Before measurements

All four configured runtime runs exited zero with stable source, manifest
and lockfile hashes. Each run preserves load, CPU/memory/IO pressure, runtime
versions and process limits alongside its JSON report.

| Package | Node command | Bun command | Passing tests |
| --- | ---: | ---: | ---: |
| AI Sync | 6.809 s | 3.947 s | 16 |
| API Transport | 7.129 s | 4.140 s | 9 |

Reports are in the preparation/transport-sync timing directory and matching
context directory. Shared-workstation timings are evidence, not controlled
performance comparisons. Package configurations were not changed.

## Ordered review

Current-source review applies the existing resource, property, flake and
observability charters. AI Sync's mixed native and portable filesystem
fixtures need deliberate separation: repository artifact checks must retain
real checkout reads, while synthetic temporary config fixtures are candidates
for MemoryFileSystem. Historical findings already fixed upstream must retain
that attribution. API Transport's runtime boundaries and properties are
reviewed without weakening rate-limit, authorization or retry oracles.

Implementation proceeds in D12 order: scope, assertions, properties, flake,
then instrumentation. This preparation makes no remediation, hosted-readiness
or goal-completion claim. Production changes remain outside this wave.

## Scope and assertion checkpoint

API Transport requires no new scope layer. Commit `d967e29162` moves its codec
examples to native Effect tests and preserves all legacy Duration input cases.
Direct Option assertions retain the exact expected snapshot. Commit `0c056b1d53`
registers the two rate-limit properties natively with unchanged domains,
re-encoding/equivalence predicates and 50-run floors. Full package audit/docgen
passed after both phases. The Transport suite's six tests also passed with the
CI property floor of 400 and seed 20260708.

AI Sync scope commit `2332309552` separates three synthetic filesystem cases
into a bounded MemoryFileSystem and Path layer. Each test owns a unique scoped
temporary directory. Native generated-artifact, safety-policy and cache-input
checks retain real checkout reads under NodeServices. Full audit/docgen passed
after correcting formatting from the move. Assertion commit `47066dd655`
preserves the original Boolean predicates using native assertTrue helpers;
full audit/docgen passed again. Property and final observability work remain.

Three historical AI Sync detector findings are already fixed upstream: two
runtime boundaries in `b1aa7e320cde` and the explicit layer timeout in
`5201b02fe5`. Current baseline has 18 entries across these packages. The native
filesystem candidate needs a documented subject-specific exception for real
checkout assertions after synthetic fixtures move; it must not be erased as
though the package stopped testing the checkout.

## Property checkpoint

AI Sync commit `0f28b8f5ba` registers all 14 laws independently. Thirteen retain
Equal.equals on decoded values, while AiSyncError retains exact re-encoded
wire equality. The custom normalized-document arbitrary and 25-run floors
remain. Full package audit/docgen passed; the main suite's 28 registrations
also passed at the CI floor of 400 with seed 20260708. No generator narrowing,
production change, retry, skip or timeout increase was needed.

Both packages have completed scope, assertion and property phases. Final flake
review, instrumentation, dependency-generated artifacts, final runtime timing,
ledger reconciliation and PR gates remain. Native checkout reads require their
subject-specific filesystem exception rather than a fabricated memory copy.

## Final local instrumentation and inventory

Flake review found no new clock, retry or ordering change needed. Injected HTTP
responses, per-test counters, scoped unique directories and real-checkout
subjects remain. No flakyTest, skip or timeout increase was introduced.
Commit `82e287e0b3` adopts the instrumented test-runner across all five files.
Both full package audit/docgen proofs pass after instrumentation. Generated
TypeScript references and Fallow boundary configs pass their parity checks.

| Package | Node before / after | Bun before / after | Final pass / skip |
| --- | ---: | ---: | ---: |
| AI Sync | 6.809 / 7.961 s | 3.947 / 3.323 s | 29 / 0 |
| API Transport | 7.129 / 7.276 s | 4.140 / 3.739 s | 9 / 0 |

All four final runs exited zero with stable source, manifest and lockfile hashes.
AI Sync's registration count increases by 13 because one aggregate case now
contains 14 separately named laws. The Node timings increased on the shared
workstation; no controlled speedup is claimed. Raw reports and resource-pressure
contexts are retained under final/transport-sync and the matching context path.

The ledger contains 42 rows: 20 fixed, three explicit exceptions and 19
no-findings rows. One owned-source delta row records API Transport's three
Option comparisons missing from the frozen detector inventory. Strict validation
covers all five current files and every lens with zero missing coverage.
Fifteen baseline entries are removed; three reviewed entries remain: native
filesystem provenance for real-checkout subjects, and two canonical assertTrue
calls whose inner Option/Exit Boolean predicates still trigger judgment review.
These predicate-only oracles have no independent expected payload or Cause.
This checkpoint does not claim that the baseline is empty.

The runner dependencies add 19 reviewed cache edges with no removals and preserve
existing multiplicity. Cache audit reports zero blocking findings and 1,251
unassessed computations. Full hosted proof, review closure and operator merge
remain required.
