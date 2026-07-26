import {
  formatSql,
  getPgErrorAliases,
  getPgErrorName,
  makeDrizzle,
  makeDrizzleLayer,
  migrate,
  migrateBundle,
  NativePgClient,
  PgErrorCode,
  PostgresClient,
  PostgresError,
  PostgresErrorContext,
} from "@beep/postgres";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  EffectDrizzlePgConfig,
  EffectPgDatabase,
  MigrationBundleEntry,
  PgErrorCode as PgErrorCodeType,
  PgErrorName as PgErrorNameType,
  PostgresClientValue,
  PostgresDrizzle,
  PostgresDrizzleDatabase,
} from "@beep/postgres";
import type { Effect, Layer } from "effect";

declare const client: PostgresClientValue;
declare const db: PostgresDrizzleDatabase;
declare const bundleEntries: ReadonlyArray<MigrationBundleEntry>;

describe("@beep/postgres", () => {
  it("exports SQLSTATE models", () => {
    expect<PgErrorCodeType>().type.toBe<"23505" | PgErrorCodeType>();
    expect<PgErrorNameType>().type.toBe<"UNIQUE_VIOLATION" | PgErrorNameType>();
    expect(PgErrorCode).type.not.toBe<never>();
    expect(getPgErrorName("23505")).type.toBe<O.Option<PgErrorNameType>>();
    expect(getPgErrorAliases("23505")).type.toBeAssignableTo<O.Option<ReadonlyArray<PgErrorNameType>>>();
  });

  it("exports Postgres errors and formatting helpers", () => {
    expect(
      PostgresErrorContext.make({ query: O.some("select 1"), sqlStateName: O.some("UNIQUE_VIOLATION") })
    ).type.toBe<PostgresErrorContext>();
    expect(PostgresError.fromUnknown("query", new Error("boom"))).type.toBe<PostgresError>();
    expect(
      PostgresError.fromUnknown(
        "query",
        new Error("boom"),
        PostgresErrorContext.make({ query: O.some("select 1"), sqlStateName: O.some("UNIQUE_VIOLATION") })
      )
    ).type.toBe<PostgresError>();
    expect(formatSql("select 1")).type.toBe<string>();

    // @ts-expect-error!
    PostgresError.fromUnknown("query", new Error("boom"), { sqlStateName: "NOT_A_SQLSTATE_NAME" });
  });

  it("exports client and Drizzle layer helpers", () => {
    expect(PostgresClient.fromPgClient(client)).type.not.toBe<never>();
    expect(makeDrizzle()).type.toBe<Effect.Effect<PostgresDrizzleDatabase, PostgresError, PostgresClientValue>>();
    expect(makeDrizzleLayer()).type.toBe<Layer.Layer<PostgresDrizzle, PostgresError, PostgresClientValue>>();
    expect(migrate(db, { migrationsFolder: "./drizzle" })).type.toBe<Effect.Effect<undefined, PostgresError>>();
    expect(migrateBundle(db, { migrations: bundleEntries })).type.toBe<Effect.Effect<undefined, PostgresError>>();
    expect(migrateBundle({ migrations: bundleEntries, migrationsSchema: "drizzle" })(db)).type.toBe<
      Effect.Effect<undefined, PostgresError>
    >();
  });

  it("exports native interop namespaces", () => {
    expect(NativePgClient.PgClient).type.not.toBe<never>();
    expect<EffectDrizzlePgConfig>().type.not.toBe<never>();
    expect<EffectPgDatabase>().type.not.toBe<never>();
  });
});
