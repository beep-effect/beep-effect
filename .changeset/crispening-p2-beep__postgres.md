---
"@beep/postgres": patch
---

Crispen `@beep/postgres` for the P2 repo-crispening wave: derive SQLSTATE type and lookup surfaces from the canonical error-code table, move diagnostic context absence into `Option` schema fields with constructor defaults, colocate Postgres error guards, add field annotations, and add encoded-shape plus `S.toArbitrary` parity laws while preserving raw optional helper input at `PostgresError.fromUnknown`.
