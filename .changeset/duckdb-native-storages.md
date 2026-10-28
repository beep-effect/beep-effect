---
"@beep/duckdb": minor
---

Add DuckDB-native storages for the effect modules whose SQLite branch fails on DuckDB:
`DuckDbEventJournal`, `DuckDbPersistence`, `DuckDbPersistedQueue`, `DuckDbMessageStorage`,
`DuckDbRunnerStorage` and `DuckDbEventLogServerEncrypted`. Each is a subpath module and a root
namespace export, tested against the vendored effect 4.0.6 suites. The cluster storages support
single-process deployments only.
