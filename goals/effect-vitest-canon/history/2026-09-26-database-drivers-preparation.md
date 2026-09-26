# Database driver wave preparation

This wave consumes 130 existing inventory rows across eight test files in
DuckDB, Drizzle and Postgres. Five files changed since the frozen census;
current membership remains eight files. Preparation reviewed every current
file against the existing findings and preserved the native resource subjects.

All six configured baseline commands passed with stable source hashes.
Explicit empty BEEP_TEST_DATABASE_URL and pglite-inprocess driver selection
keep SQL tests on the local in-process engine: a nonempty URL would otherwise
take precedence. DuckDB uses native local databases and scoped files.
No external database or container is selected by these runs.

- duckdb node: 29 passed, 0 skipped; 11.848 seconds
- duckdb bun: 29 passed, 0 skipped; 13.902 seconds
- drizzle node: 26 passed, 0 skipped; 11.867 seconds
- drizzle bun: 26 passed, 0 skipped; 10.492 seconds
- postgres node: 43 passed, 0 skipped; 24.022 seconds
- postgres bun: 43 passed, 0 skipped; 17.996 seconds

Drizzle's current 26 registrations include a rejection case added upstream;
the frozen 25-test receipt remains historical. These single samples are
accompanied by load/pressure context and establish no performance improvement.

D12 work preserves native SQL, Parquet, filesystem migration and transaction
subjects. Scope comes first: independently owned native acquisitions,
failure-safe controlled promises, harness ownership for pure fixtures, and
an interruption-safe Drizzle transaction fixture. Property predicates,
expected values, run floors, cancellation results and client identities must
remain explicit. No production repair is authorized by this preparation.

## Scope checkpoints

Postgres commit `e36df8c4fb` replaces its two pure provider wrappers with
single-case harness layers. Every assertion, all three client service-alias
identities and the native missing-migration fixture remain unchanged. Full
package audit/docgen passed (12.5 / 2.9 seconds) with in-process PGlite gates.

Drizzle commit `251dd312f2` moves five pure client fixtures under isolated
harness layers. The native integration fixture delegates transaction ownership
to SqlClient.withTransaction with the existing error-normalization boundary.
An independently provisioned interruption probe verifies rollback of an armed
insert and a successful subsequent commit. Original result arrays, property
predicates and timeout budgets remain intact. Full package audit/docgen passed
(10.8 / 3.5 seconds) with in-process PGlite gates. No production code changed.

Main's merged HTML checkpoint was then merged into this branch without
conflicts. The subsequent checkpoints below continue the required per-package order.


DuckDB scope commit `abcc797422` moves ordinary providers to isolated harness
layers and keeps native directories for file-backed databases and Parquet.
Instance and connection fixtures have independent finalizers; coordinator
cleanup releases native promises before structured child joins. All 83 prior
assertion expressions and property definitions were preserved. Deliberate
short production scopes remain where close-count assertions run after teardown.
Full package audit/docgen passed (8.1 / 2.7 seconds).

## Assertions, properties and deterministic paths

Postgres assertion commit `999d118b04` preserves seven absence predicates through
assertNone (audit/docgen 11.8 / 2.8 seconds). Property commit `24b52b1c78`
registers four separate native laws with the same domains and fcRuns(25).
The normalized error generator still excludes cause and params, and each law
still checks re-encoding equality plus Equal.equals or schema equivalence.
The fixed migration-bundle fixture remains separate. Audit/docgen passed
(10.5 / 2.8 seconds); all four named laws passed with 400 runs and seed 20260708.
Flake commit `0d378ed030` owns a scoped native temporary parent and supplies
an uncreated child to the real migrator, preserving the typed error, operation
and ENOENT assertions (audit/docgen 10.7 / 2.8 seconds).

Drizzle assertion commit `0e0402ef7f` preserves absence, expected cause and
unknown Exit failure predicates, including strict cause identity. Its initial
introduced missedPipeableOpportunity diagnostic was corrected without changing
the predicate (final audit/docgen 10.2 / 2.8 seconds). Three native laws retain
the Result codec paths, original arbitraries and all five error predicates,
including comparison of both cause-presence booleans. Each keeps fcRuns(50).
All three named laws passed with 400 runs and seed 20260708; full package
audit/docgen passed (8.9 / 2.6 seconds). Separate root/transaction execution
counters now distinguish client routing while retaining the original SQL and
result-array oracles. The prior scoped interruption probe covers the identified
transaction ownership defect; no additional flake repair was established.

DuckDB assertion commit `bda048be32` uses expected string payloads for two
assertSome checks and retains nine exact Exit failure predicates through
assertTrue. Strict original cause identity remains unchanged (audit/docgen
8.4 / 2.7 seconds). DuckDB properties, cancellation timing, final instrumentation,
final timings and eight-file inventory reconciliation remain outstanding.

These are per-phase proofs, not final wave or goal acceptance. Native SQL tests
still explicitly select in-process PGlite with an empty external URL.
