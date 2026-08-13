# ci-lane-economics — friction and opportunity ledger

Record receipts at the moment friction happens (what you were doing, the
evidence, what would have prevented it). Redact for the public repo.

## Seed context (2026-08-13, from the split)

- Pre-cache hosted p50s: Lint ~43.6m, Test Unit ~23m, Property Laws ~22.4m.
- The ~9-minute type-graph import inside vitest re-pays per heavy-import
  suite; caching cannot fix it — per-slice sharding is the lever.
- Fleet Docgen/Lint hangs from the runMain success-exit class are FIXED
  (#673); do not let historical hang data pollute the census.
