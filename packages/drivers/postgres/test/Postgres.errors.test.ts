import { createColors } from "@beep/colors";
import {
  extractPostgresDiagnostics,
  formatPostgresErrorWith,
  formatSql,
  getPgErrorAliases,
  getPgErrorName,
  MigrationBundleConfig,
  MigrationBundleEntry,
  migrate,
  migrateBundle,
  NativePgClient,
  PgErrorCanonicalNameByCode,
  PgErrorCode,
  PgErrorName,
  PostgresClient,
  PostgresError,
  PostgresErrorContext,
} from "@beep/postgres";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Equal, Layer, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { PostgresClientValue, PostgresDrizzleDatabase } from "@beep/postgres";

const NativeDate = globalThis.Date;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const makeHostileProxy = (): unknown =>
  new Proxy(
    {},
    {
      get() {
        throw new Error("hostile get");
      },
      getOwnPropertyDescriptor() {
        throw new Error("hostile descriptor");
      },
      getPrototypeOf() {
        throw new Error("hostile prototype");
      },
      ownKeys() {
        throw new Error("hostile keys");
      },
    }
  );

class HostileDate extends Date {
  override toJSON(): string {
    throw new Error("hostile json");
  }

  override toString(): string {
    throw new Error("hostile string");
  }
}

const makeCauseWithThrowingReasons = (): Cause.Cause<unknown> =>
  new Proxy(Cause.fail(new Error("driver failed")), {
    get(target, property, receiver) {
      if (property === "reasons") {
        throw new Error("reasons failed");
      }
      return Reflect.get(target, property, receiver);
    },
  });

const makeCauseWithHostileReason = (): Cause.Cause<unknown> => {
  const hostileReason = new Proxy(
    {},
    {
      get() {
        throw new Error("reason get");
      },
    }
  );

  return new Proxy(Cause.fail("driver failed"), {
    get(target, property, receiver) {
      if (property === "reasons") {
        return [hostileReason];
      }
      return Reflect.get(target, property, receiver);
    },
  });
};

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const assertSchemaRoundTrip = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  arbitrary = S.toArbitrary(schema)
): void => {
  fc.assert(
    fc.property(arbitrary, (value) => {
      expectRoundTrip(schema, value);
    }),
    fcRuns(25)
  );
};

describe("PostgresError", () => {
  it("extracts SQLSTATE diagnostics from pg-like failures", () => {
    const cause = {
      code: "23505",
      constraint: "users_email_key",
      detail: "Key (email) already exists.",
      message: "duplicate key value violates unique constraint",
      severity: "ERROR",
      table: "users",
    };
    const error = PostgresError.fromUnknown("query", cause, {
      query: "select * from users where email = $1",
      params: ["a@example.com"],
    });

    expect(error._tag).toBe("PostgresError");
    expect(error.operation).toBe("query");
    expect(O.getOrThrow(error.sqlState)).toBe("23505");
    expect(O.getOrThrow(error.sqlStateName)).toBe("UNIQUE_VIOLATION");
    expect(O.getOrThrow(error.constraintName)).toBe("users_email_key");
    expect(O.getOrThrow(error.query)).toBe("select * from users where email = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
  });

  it("keeps duplicate SQLSTATE aliases without losing the canonical name", () => {
    const aliases = O.getOrThrow(getPgErrorAliases("22008"));

    expect(PgErrorCanonicalNameByCode["22008"]).toBe("DATETIME_FIELD_OVERFLOW");
    expect(A.contains(aliases, "DATETIME_FIELD_OVERFLOW")).toBe(true);
    expect(A.contains(aliases, "DATETIME_VALUE_OUT_OF_RANGE")).toBe(true);
    expect(O.getOrThrow(getPgErrorName("23505"))).toBe("UNIQUE_VIOLATION");
  });

  it("extracts Drizzle failed query messages", () => {
    const cause = new Error("Failed query: select 1 where id = $1\nparams: 1");
    const diagnostics = extractPostgresDiagnostics(cause);

    expect(O.getOrThrow(diagnostics.query)).toBe("select 1 where id = $1");
    expect(O.getOrThrow(diagnostics.params)).toEqual(["<redacted>"]);
  });

  it("constructs schema-owned diagnostic context", () => {
    const context = PostgresErrorContext.make({
      query: O.some("select 1"),
      sqlStateName: O.some("UNIQUE_VIOLATION"),
    });

    expect(O.getOrThrow(context.query)).toBe("select 1");
    expect(O.getOrThrow(context.sqlStateName)).toBe("UNIQUE_VIOLATION");
  });

  it("keeps diagnostic context and error encoded shapes at the raw optional boundary", () => {
    const context = PostgresErrorContext.make({
      query: O.some("select 1"),
      sqlStateName: O.some("UNIQUE_VIOLATION"),
    });
    const emptyContext = PostgresErrorContext.make({});
    const error = PostgresError.make({
      operation: "query",
      sqlState: O.some("23505"),
      sqlStateName: O.some("UNIQUE_VIOLATION"),
    });
    const minimalError = PostgresError.make({ operation: "query" });

    expect(encode(PostgresErrorContext, context)).toEqual({
      query: "select 1",
      sqlStateName: "UNIQUE_VIOLATION",
    });
    expect(encode(PostgresErrorContext, emptyContext)).toEqual({});
    expect(encode(PostgresError, error)).toEqual({
      _tag: "PostgresError",
      operation: "query",
      sqlState: "23505",
      sqlStateName: "UNIQUE_VIOLATION",
    });
    expect(encode(PostgresError, minimalError)).toEqual({
      _tag: "PostgresError",
      operation: "query",
    });
  });

  it("round-trips schema-derived SQLSTATE and Postgres error values", () => {
    const postgresErrorArbitrary = S.toArbitrary(PostgresError).map((error) =>
      PostgresError.make({
        operation: error.operation,
        cause: O.none(),
        message: error.message,
        sqlState: error.sqlState,
        sqlStateName: error.sqlStateName,
        severity: error.severity,
        detail: error.detail,
        hint: error.hint,
        where: error.where,
        schemaName: error.schemaName,
        tableName: error.tableName,
        columnName: error.columnName,
        constraintName: error.constraintName,
        query: error.query,
        params: O.none(),
        sourceLocation: error.sourceLocation,
      })
    );

    assertSchemaRoundTrip(PgErrorCode);
    assertSchemaRoundTrip(PgErrorName);
    assertSchemaRoundTrip(PostgresErrorContext);
    assertSchemaRoundTrip(PostgresError, postgresErrorArbitrary);
  });

  it("keeps fallback Drizzle message params opaque when they contain commas", () => {
    const cause = new Error('Failed query: select 1 where payload = $1\nparams: {"label":"a,b"}, opaque');
    const diagnostics = extractPostgresDiagnostics(cause);

    expect(O.getOrThrow(diagnostics.query)).toBe("select 1 where payload = $1");
    expect(O.getOrThrow(diagnostics.params)).toEqual(["<redacted>"]);
  });

  it("falls back to reason when cause is missing or undefined", () => {
    const reason = {
      code: "23505",
      constraint: "users_email_key",
      message: "duplicate key",
    };

    const missingCause = extractPostgresDiagnostics({ reason });
    const undefinedCause = extractPostgresDiagnostics({ cause: undefined, reason });

    expect(O.getOrThrow(missingCause.sqlState)).toBe("23505");
    expect(O.getOrThrow(missingCause.constraintName)).toBe("users_email_key");
    expect(O.getOrThrow(undefinedCause.sqlState)).toBe("23505");
    expect(O.getOrThrow(undefinedCause.constraintName)).toBe("users_email_key");
  });

  it("is idempotent for already-normalized PostgresError values", () => {
    const error = PostgresError.fromUnknown(
      "query",
      {
        code: "23505",
        message: "duplicate key",
      },
      {
        query: "select * from users where email = $1",
        params: ["a@example.com"],
      }
    );

    expect(PostgresError.fromUnknown("diagnostics", error)).toBe(error);
    expect(extractPostgresDiagnostics(error)).toBe(error);
    expect(formatPostgresErrorWith(createColors(false))(error)).toContain("23505");
  });

  it("unwraps Cause.fail pg-like failures", () => {
    const diagnostics = extractPostgresDiagnostics(
      Cause.fail({
        code: "23505",
        constraint: "users_email_key",
        message: "duplicate key",
      })
    );

    expect(O.getOrThrow(diagnostics.sqlState)).toBe("23505");
    expect(O.getOrThrow(diagnostics.sqlStateName)).toBe("UNIQUE_VIOLATION");
    expect(O.getOrThrow(diagnostics.constraintName)).toBe("users_email_key");
  });

  it("unwraps Cause.die native Drizzle query failures", () => {
    const diagnostics = PostgresError.fromUnknown(
      "query",
      Cause.die({
        _tag: "EffectDrizzleQueryError",
        cause: new Error("driver failed"),
        params: ["a@example.com"],
        query: "select * from users where email = $1",
      })
    );

    expect(O.getOrThrow(diagnostics.query)).toBe("select * from users where email = $1");
    expect(O.getOrThrow(diagnostics.params)).toEqual(["<redacted>"]);
  });

  it("unwraps Cause.fail existing PostgresError values", () => {
    const error = PostgresError.fromUnknown(
      "query",
      {
        code: "23505",
        message: "duplicate key",
      },
      {
        params: ["a@example.com"],
        query: "select * from users where email = $1",
      }
    );

    expect(PostgresError.fromUnknown("format", Cause.fail(error))).toBe(error);
    expect(extractPostgresDiagnostics(Cause.fail(error))).toBe(error);
  });

  it("normalizes hostile proxy inputs without throwing", () => {
    const diagnostics = extractPostgresDiagnostics(makeHostileProxy());

    expect(diagnostics.operation).toBe("diagnostics");
    expect(O.isNone(diagnostics.cause)).toBe(true);
    expect(O.isNone(diagnostics.sqlState)).toBe(true);
  });

  it("does not retain proxied Cause values with throwing reasons getters", () => {
    const diagnostics = extractPostgresDiagnostics(makeCauseWithThrowingReasons());

    expect(diagnostics.operation).toBe("diagnostics");
    expect(O.isNone(diagnostics.cause)).toBe(true);
    expect(O.isNone(diagnostics.sqlState)).toBe(true);
  });

  it("ignores hostile Cause reason entries without throwing", () => {
    const diagnostics = extractPostgresDiagnostics(makeCauseWithHostileReason());

    expect(diagnostics.operation).toBe("diagnostics");
    expect(O.isNone(diagnostics.cause)).toBe(true);
    expect(O.isNone(diagnostics.sqlState)).toBe(true);
  });

  it("ignores hostile Error.stack getters", () => {
    const cause = new Error("driver failed");
    Object.defineProperty(cause, "stack", {
      get() {
        throw new Error("stack failed");
      },
    });

    const diagnostics = extractPostgresDiagnostics(cause);

    expect(diagnostics.operation).toBe("diagnostics");
    expect(O.isNone(diagnostics.sourceLocation)).toBe(true);
  });

  it("follows reason fallbacks when sibling getters throw", () => {
    const cause = {};
    Object.defineProperty(cause, "message", {
      get() {
        throw new Error("message failed");
      },
    });
    Object.defineProperty(cause, "reason", {
      value: {
        code: "23505",
        constraint: "users_email_key",
        message: "duplicate key",
      },
    });

    const diagnostics = extractPostgresDiagnostics(cause);

    expect(O.getOrThrow(diagnostics.sqlState)).toBe("23505");
    expect(O.getOrThrow(diagnostics.constraintName)).toBe("users_email_key");
  });
});

describe("Postgres formatting", () => {
  it("formats SQL and parameters with a disabled color palette", () => {
    const rendered = formatSql("select * from users where id = $1", [1], createColors(false));

    expect(rendered).toContain("select");
    expect(rendered).toContain("from");
    expect(rendered).toContain("$1=1");
  });

  it("formats Postgres errors", () => {
    const rendered = formatPostgresErrorWith(createColors(false))(
      PostgresError.fromUnknown("query", {
        code: "23505",
        message: "duplicate key",
      })
    );

    expect(rendered).toContain("POSTGRES ERROR");
    expect(rendered).toContain("23505");
    expect(rendered).toContain("UNIQUE_VIOLATION");
  });

  it("falls back to raw SQL when the formatter rejects invalid SQL", () => {
    const rendered = formatSql("select '", ["still, opaque"], createColors(false));

    expect(rendered).toContain("select '");
    expect(rendered).toContain('$1="still, opaque"');
  });

  it("formats invalid Date params without throwing", () => {
    const invalidDate = Reflect.construct(NativeDate, ["invalid"]) as Date;
    const rendered = formatSql("select $1", [invalidDate], createColors(false));

    expect(rendered).toContain("Invalid Date");
  });

  it("formats Postgres errors with invalid SQL without throwing", () => {
    const rendered = formatPostgresErrorWith(createColors(false))(
      PostgresError.fromUnknown("query", new Error("syntax failed"), {
        query: "select '",
        params: ["still, opaque"],
      })
    );

    expect(rendered).toContain("POSTGRES ERROR");
    expect(rendered).toContain("select '");
    expect(rendered).toContain('$1="<redacted>"');
  });

  it("formats Postgres errors with invalid Date params without throwing", () => {
    const rendered = formatPostgresErrorWith(createColors(false))(
      PostgresError.fromUnknown("query", new Error("syntax failed"), {
        query: "select $1",
        params: [Reflect.construct(NativeDate, ["invalid"]) as Date],
      })
    );

    expect(rendered).toContain("POSTGRES ERROR");
    expect(rendered).toContain('$1="<redacted>"');
  });

  it("formats array params with throwing string coercion without throwing", () => {
    const unprintable = {
      toString() {
        throw new Error("cannot format");
      },
    };
    const rendered = formatSql("select $1", [[unprintable]], createColors(false));

    expect(rendered).toContain("<unprintable>");
  });

  it("formats Postgres errors with array params that throw during string coercion", () => {
    const unprintable = {
      toString() {
        throw new Error("cannot format");
      },
    };
    const rendered = formatPostgresErrorWith(createColors(false))(
      PostgresError.fromUnknown("query", new Error("syntax failed"), {
        params: [[unprintable]],
        query: "select $1",
      })
    );

    expect(rendered).toContain("POSTGRES ERROR");
    expect(rendered).toContain('$1="<redacted>"');
  });

  it("formats hostile proxy and Date subclass params without throwing", () => {
    const rendered = formatSql("select $1, $2", [makeHostileProxy(), new HostileDate()], createColors(false));

    expect(rendered).toContain("$1=[Object]");
    expect(rendered).toContain("$2=<unprintable>");
  });

  it("formats Postgres errors with hostile proxy and Date subclass params without throwing", () => {
    const rendered = formatPostgresErrorWith(createColors(false))(
      PostgresError.fromUnknown("query", new Error("syntax failed"), {
        query: "select $1, $2",
        params: [makeHostileProxy(), new HostileDate()],
      })
    );

    expect(rendered).toContain("POSTGRES ERROR");
    expect(rendered).toContain('$1="<redacted>"');
    expect(rendered).toContain('$2="<redacted>"');
  });

  it("formats hostile proxy errors without throwing", () => {
    const rendered = formatPostgresErrorWith(createColors(false))(makeHostileProxy());

    expect(rendered).toContain("POSTGRES ERROR");
  });

  it("formats Cause values with hostile reason boundaries without throwing", () => {
    const renderPlain = formatPostgresErrorWith(createColors(false));
    const hostileReasonRendered = renderPlain(makeCauseWithHostileReason());
    const throwingReasonsRendered = renderPlain(makeCauseWithThrowingReasons());

    expect(hostileReasonRendered).toContain("POSTGRES ERROR");
    expect(throwingReasonsRendered).toContain("POSTGRES ERROR");
  });

  it("preserves embedded PostgresError diagnostics from Cause.fail", () => {
    const causeError = PostgresError.fromUnknown(
      "query",
      {
        code: "23505",
        detail: "Key (email) already exists.",
        message: "duplicate key",
        table: "users",
      },
      {
        query: "select * from users where email = $1",
        params: ["a@example.com"],
      }
    );
    const rendered = formatPostgresErrorWith(createColors(false))(Cause.fail(causeError));

    expect(rendered).toContain("operation query");
    expect(rendered).toContain("23505");
    expect(rendered).toContain("UNIQUE_VIOLATION");
    expect(rendered).toContain("users");
    expect(rendered).toContain("select");
    expect(rendered).toContain('$1="<redacted>"');
  });
});

describe("Postgres interop", () => {
  it("exports native PgClient interop", () => {
    expect(NativePgClient.PgClient).toBeDefined();
  });
});

describe("Postgres Drizzle migrations", () => {
  it.effect(
    "normalizes synchronous native migrator setup failures",
    Effect.fnUntraced(function* () {
      const error = yield* migrate({} as PostgresDrizzleDatabase, {
        migrationsFolder: "/tmp/beep-effect2-postgres-missing-migrations-folder/child",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(PostgresError);
      expect(error.operation).toBe("migrate");
      expect(O.getOrThrow(error.message)).toContain("ENOENT");
    })
  );

  it.effect(
    "validates and prepares in-memory migration bundles before native execution",
    Effect.fnUntraced(function* () {
      const config = MigrationBundleConfig.make({
        migrations: [
          MigrationBundleEntry.make({
            name: "20260512000000_create_example",
            sql: "CREATE TABLE example (id TEXT PRIMARY KEY);\n",
          }),
        ],
        migrationsSchema: "drizzle",
        migrationsTable: "__drizzle_migrations",
      });
      const execute = () => Effect.void;
      const session = {
        execute,
        objects: () => Effect.succeed([]),
        transaction: (run: (tx: { readonly execute: typeof execute }) => Effect.Effect<unknown>) => run({ execute }),
      };
      const result = yield* migrateBundle({ session } as unknown as PostgresDrizzleDatabase, config);

      expectRoundTrip(MigrationBundleConfig, config);
      expect(result).toBeUndefined();
    })
  );
});

describe("Postgres client", () => {
  it.effect("provides all client service keys from an existing PgClient", () => {
    const client = { fixture: "pg-client" } as unknown as PostgresClientValue;
    const program = Effect.gen(function* () {
      const beepClient = yield* PostgresClient;
      const nativeClient = yield* NativePgClient.PgClient;
      const sqlClient = yield* SqlClient.SqlClient;

      assert.strictEqual(beepClient, client);
      assert.strictEqual(nativeClient, client);
      assert.strictEqual(sqlClient, client);
    });

    return program.pipe(provideScopedLayer(PostgresClient.fromPgClient(client)));
  });
});
