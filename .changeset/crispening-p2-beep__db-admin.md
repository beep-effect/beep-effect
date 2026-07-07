---
"@beep/db-admin": patch
---

Crispen `@beep/db-admin` for the P2 repo-crispening wave: tighten db-admin migration target names, PostgreSQL schema names, and table-name metadata with schema-owned precision and key annotations, keep imported Drizzle schema objects as an opaque migration-generation boundary, and add encoded-shape plus `S.toArbitrary` parity laws for `DbAdminMigrationTarget`. Public encoded target shapes remain unchanged.
