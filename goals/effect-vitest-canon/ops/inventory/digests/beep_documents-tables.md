# @beep/documents-tables four-lens digest

Four files explicitly inspect metadata without executing a live database. They check schema-first columns/index hints, nullable converters, serial-id omission, barrel identities and full generated round trips at fcRuns(50). SyncCursor is a domain cursor value, not a database handle. File paths, digest values and upload operation types are data. No provider, process, database or native filesystem is acquired, and no layer build cost was measured. These tests do not establish database uniqueness, queue transactionality or upsert isolation; their current subject is metadata/conversion. Keep all Some/None payloads and index columns. No additional human review item is needed beyond open EV006 assertion candidates.

| Lens | Rows |
| --- | ---: |
| resource | 4 |
| flake | 4 |
| property | 4 |
| observability | 4 |

Severity: 16 info. 0 review items and 16 coverage-only rows.

Retained accepted Node baseline: 17 cases across 4 test files; reporter span 4519.718017578125 ms; whole command 4.873837051999999 seconds. Every assigned test file is represented. Node22.22.3/Bun1.4.2/Vitest4.1.11. No timing was rerun or accepted by this lane. A pass does not prove absence of races, coverage or full package proof.

## Top ten files by row count

- packages/documents/tables/test/SyncConflictTable.test.ts: 4 rows; 0 review items.
- packages/documents/tables/test/SyncCursorTable.test.ts: 4 rows; 0 review items.
- packages/documents/tables/test/SyncItemTable.test.ts: 4 rows; 0 review items.
- packages/documents/tables/test/SyncOperationTable.test.ts: 4 rows; 0 review items.

## Top ten files by retained reporter duration

- packages/documents/tables/test/SyncConflictTable.test.ts: 31.311279296875 ms; 4 tests.
- packages/documents/tables/test/SyncOperationTable.test.ts: 24.176513671875 ms; 4 tests.
- packages/documents/tables/test/SyncItemTable.test.ts: 23.718017578125 ms; 5 tests.
- packages/documents/tables/test/SyncCursorTable.test.ts: 22.1708984375 ms; 4 tests.

## Review items

No additional human review items. File-specific no-findings rows qualify the source-only scope; existing scanner candidates remain open.

Hosted history: 0 mapped observations across 0 jobs, categories {}. Zero mapped observations is not proof of zero historical failures. Global 527 failed runs include 21 unavailable logs and one unresolved cause; observations are not unique flakes. Full retained context/config, source-bound report provenance and slowest cases are retained in the public timing context and hosted history summary. Shared config reports forks/isolate, file parallelism and sequence concurrent; fresh mutable fixtures must remain case-local. Durations overlap and do not measure layer rebuild costs.

After separate P2 authorization: Preserve exact metadata/converter columns, Some/None payloads, serial-id omission and 50-run laws. No database handle or actual SQL enforcement is exercised. Preserve all original operands, assertions and replay options; no timeout increase or generic MemoryFS replacement is justified.

Root-reviewed P1 inventory; P2 remains gated.

Recovery provenance: original supervisor exit 143 remains preserved. A separate recovery obtained fresh successful validation and outer exit 0; the original result was not relabeled.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
