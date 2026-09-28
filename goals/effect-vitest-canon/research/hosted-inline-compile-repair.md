# Hosted inline schema compilation repair

PR #1307's Heavy / Lint Policy job reported eight new inline schema compilations
relative to main. The repair hoists six compiled functions without changing any
schema, input, expected value, property domain, deadline or native process flow:

- Two `JsonReportError` predicate uses in lint-rules share one compiled guard.
- OpenClaw's native timeout assertion uses one module-scoped timeout-error guard.
- Five DuckDB encoder/JSON-decoder uses share four compiled codec functions.

Inlining the new bindings and removing their declarations reconstructs each
original source file exactly. Full package audit and docgen pass for DuckDB,
OpenClaw and lint-rules. Root `bun run lint:oxlint` passes. The canonical
Effect-Vitest ratchet also passes.

The 12 existing detector exceptions retain their reviewed dispositions; only
source coordinates and corresponding line-derived IDs changed. Nine new IDs
join the ledger. Two IDs already owned by the resource ledger remain there,
without duplicate detector entries. Strict root/ledger schemas and uniqueness
pass, and unrelated root, ledger and census rows remain unchanged. Hosted
verification at the new head is still required.
