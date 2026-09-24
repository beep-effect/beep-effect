# sql-pg native `PgClient` call-site census

Inherited from the retired S0 stage of `explorations/effect-mcp-2026-07-28`
(`research/sizing.md`), recorded here as part of PR 1 so the goal train does
not carry it. Method: `rg -n "PgClient\b" packages apps --glob '*.ts'`
(node_modules and dist excluded) on 2026-09-22, at `main` `0be1f13d62`.

| File | Mentions | Kind |
| --- | --- | --- |
| `packages/drivers/postgres/src/PostgresClient.service.ts` | 8 | driver: the one production `PgClient` construction site |
| `packages/drivers/postgres/src/PostgresDrizzle.service.ts` | 5 | driver: Drizzle adapter over the same client |
| `packages/drivers/postgres/src/PostgresInterop.models.ts` | 4 | driver: interop models naming the client type |
| `packages/drivers/pglite/src/PgliteClient.service.ts` | 9 | driver: PGlite twin of the client service |
| `packages/drivers/pglite/src/Pglite.test-layer.ts` | 3 | driver test layer |
| `packages/drivers/pglite/src/index.ts` | 1 | barrel |
| `packages/tooling/test-kit/test-utils/src/SqlTest.ts` | 14 | shared SQL test kit |
| `apps/professional-desktop/src/runtime/Pglite.ts` | 1 | app runtime wiring |
| `packages/drivers/postgres/test/Postgres.errors.test.ts` | 6 | tests |
| `packages/drivers/postgres/test/integration/Postgres.pglite.test.ts` | 4 | tests |
| `packages/drivers/pglite/test/PgliteClient.test.ts` | 4 | tests |
| `packages/drivers/pglite/test/integration/PgliteClient.persistent.test.ts` | 1 | tests |
| `packages/documents/server/test/integration/SyncRepositoriesDrizzle.pglite.test.ts` | 2 | tests |
| `packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts` | 3 | tests |
| `packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts` | 3 | tests |

Reading: every production construction of the native client sits inside the
two driver packages (`@beep/postgres`, `@beep/pglite`) plus the shared SQL
test kit; slices and apps reach it only through those services. No MCP host
in this goal's scope touches `PgClient` directly, so the sql-pg patch re-key
that #1173 carried has no host-side call site to migrate in this train.
