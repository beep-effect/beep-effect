# Agent Guide

`@beep/postgres` is the Postgres driver runtime: native Effect `PgClient`
layers, Drizzle Effect composition (`makeDrizzle`, `migrate`), typed SQLSTATE
diagnostics (`PostgresError`, `PgErrorCode`), and terminal SQL/error rendering.
It owns technical Postgres failures and query logging helpers, not product
repositories.

For docker-free tests, `@beep/test-utils` composes upstream
`@effect/sql-pglite` under the same `PgClient` tag, so repositories built on
this package run unchanged against the embedded database.
