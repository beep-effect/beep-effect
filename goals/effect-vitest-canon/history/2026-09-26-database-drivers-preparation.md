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
