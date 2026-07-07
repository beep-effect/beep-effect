---
"@beep/duckdb": patch
---

Crispen `@beep/duckdb` for the P2 repo-crispening wave: move optional error context and the default DuckDB failure message into schemas, colocate row codec/effect decoder statics, tighten row JSON compatibility, operation names, and Parquet table identifiers, add field-level schema annotations, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded wire shapes remain unchanged.
