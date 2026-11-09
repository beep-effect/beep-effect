---
title: "SQLite access through a new driver packages/drivers/sqlite (@beep/sqlite)"
date: 2026-11-09
lane: "goals/agent-memory-store-p0"
reversal: "Retire @beep/sqlite per standards/architecture/11 and import @effect/sql-sqlite-bun in the store directly, by decision file"
---

External engines and SDK wrappers route to drivers (07, step 2); @beep/pglite already wraps @effect/sql-pglite with SqliteClient-style roles (client service, errors, test-layer), so the consistent route is a second create-package --family drivers named sqlite wrapping @effect/sql-sqlite-bun 4.1.2 (catalog). The driver owns connection options, FTS5 availability and sqlite-vec extension loading through SqliteClient.loadExtension; the store's domain modules never import it. Drift recorded, not fixed here: @beep/repo-cli, @beep/repo-ai-metrics and @beep/test-utils import @effect/sql-sqlite-bun bare (cleanup-on-touch). Rejected: reusing @beep/duckdb (changes the substrate S7 and S10 measured on, forcing AC-6 and AC-7 re-measurement).
