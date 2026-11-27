import { expect, it } from "tstyche";
import type { migrate as migratePostgres } from "drizzle-orm/effect-postgres/migrator";
import type { EffectPgQueryEffectHKT } from "drizzle-orm/effect-postgres/session";
import type { migrate as migratePgSession } from "drizzle-orm/pg-core/effect";
import type { Error } from "effect/Effect";
import type { SqlError } from "effect/sql/SqlError";

type PostgresMigrateError = Error<ReturnType<typeof migratePostgres>>;
type PgSessionMigrateError = Error<ReturnType<typeof migratePgSession<EffectPgQueryEffectHKT>>>;

it("keeps the Effect Postgres migrator's SqlError as Effect's SqlError, not the any skipLibCheck yields", () => {
  expect<Extract<PostgresMigrateError, SqlError>>().type.toBe<SqlError>();
});

it("keeps the pg-core Effect session migrator's SqlError as Effect's SqlError, not the any skipLibCheck yields", () => {
  expect<Extract<PgSessionMigrateError, SqlError>>().type.toBe<SqlError>();
});
