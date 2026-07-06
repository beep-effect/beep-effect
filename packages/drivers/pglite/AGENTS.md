# Agent Guide

`@beep/pglite` is the driver-level in-process PGlite (embedded PostgreSQL)
runtime via `@effect/sql-pglite`. It aliases the PGlite client under the
`@effect/sql-pg` `PgClient` tag (tag-shim) so `drizzle-orm/effect-postgres` /
`@beep/postgres` repositories run unchanged against the in-process database —
no PGlite-socket bridge.

It owns technical PGlite failures (`PgliteError`) and the docker-free in-memory
test layer (`PgliteTestLayer`), not product repositories.
