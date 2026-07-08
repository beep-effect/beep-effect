import {
  DuckDb,
  DuckDbConnectionOptions,
  DuckDbError,
  DuckDbErrorFromUnknownOptions,
  DuckDbOperation,
  DuckDbParquetExport,
  DuckDbRow,
  DuckDbRows,
} from "@beep/duckdb";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const encodeSchema = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): Schema["Encoded"] =>
  Effect.runSync(S.encodeEffect(schema)(value));

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(
  schema: Schema,
  options?: { readonly numRuns?: number }
): void => {
  const arbitrary = S.toArbitrary(schema);
  const encode = S.encodeEffect(schema);
  const decode = S.decodeUnknownEffect(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Effect.runSync(encode(value));
      const decoded = Effect.runSync(decode(encoded));
      return Equal.equals(decoded, value);
    }),
    fcRuns(options?.numRuns ?? 20)
  );
};

describe("@beep/duckdb", () => {
  it("preserves encoded schema wire shapes", () => {
    expect(
      JSON.stringify(encodeSchema(DuckDbConnectionOptions, DuckDbConnectionOptions.make({ databasePath: ":memory:" })))
    ).toBe(JSON.stringify({ databasePath: ":memory:" }));
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbConnectionOptions,
          DuckDbConnectionOptions.make({
            databaseOptions: { access_mode: "READ_ONLY" },
            databasePath: "metrics.duckdb",
          })
        )
      )
    ).toBe(JSON.stringify({ databaseOptions: { access_mode: "READ_ONLY" }, databasePath: "metrics.duckdb" }));
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbParquetExport,
          DuckDbParquetExport.make({ filePath: "exports/events.parquet", tableName: "events" })
        )
      )
    ).toBe(JSON.stringify({ filePath: "exports/events.parquet", tableName: "events" }));
    expect(
      JSON.stringify(encodeSchema(DuckDbRow, DuckDbRow.fromUnknown({ empty: null, id: "run-1", ok: true, value: 42 })))
    ).toBe(JSON.stringify({ empty: null, id: "run-1", ok: true, value: 42 }));
    expect(JSON.stringify(encodeSchema(DuckDbRows, DuckDbRows.fromUnknown([{ id: "run-1", value: 42 }])))).toBe(
      JSON.stringify([{ id: "run-1", value: 42 }])
    );
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbErrorFromUnknownOptions,
          DuckDbErrorFromUnknownOptions.make({
            databasePath: O.some("metrics.duckdb"),
            message: "Custom DuckDB failure.",
            statement: O.some("SELECT broken"),
          })
        )
      )
    ).toBe(
      JSON.stringify({
        databasePath: "metrics.duckdb",
        message: "Custom DuckDB failure.",
        statement: "SELECT broken",
      })
    );
    expect(
      JSON.stringify(
        encodeSchema(
          DuckDbError,
          DuckDbError.make({
            databasePath: O.some("metrics.duckdb"),
            message: "Custom DuckDB failure.",
            operation: "query",
            statement: O.some("SELECT broken"),
          })
        )
      )
    ).toBe(
      JSON.stringify({
        _tag: "DuckDbError",
        databasePath: "metrics.duckdb",
        message: "Custom DuckDB failure.",
        operation: "query",
        statement: "SELECT broken",
      })
    );
  });

  it("round-trips schema-derived DuckDB models", () => {
    assertSchemaArbitraryRoundTrips(DuckDbConnectionOptions);
    assertSchemaArbitraryRoundTrips(DuckDbParquetExport);
    assertSchemaArbitraryRoundTrips(DuckDbOperation);
    assertSchemaArbitraryRoundTrips(DuckDbRow);
    assertSchemaArbitraryRoundTrips(DuckDbRows);
    assertSchemaArbitraryRoundTrips(DuckDbErrorFromUnknownOptions);
    assertSchemaArbitraryRoundTrips(DuckDbError);
  });

  it("normalizes unknown failures into typed DuckDB errors", () => {
    const cause = new Error("native failed");
    const error = DuckDbError.fromUnknown("query", cause, {
      databasePath: "metrics.duckdb",
      message: "Custom DuckDB failure.",
      statement: "SELECT broken",
    });

    expect(error).toBeInstanceOf(DuckDbError);
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.getOrThrow(error.databasePath)).toBe("metrics.duckdb");
    expect(error.message).toBe("Custom DuckDB failure.");
    expect(error.operation).toBe("query");
    expect(O.getOrThrow(error.statement)).toBe("SELECT broken");
  });

  it("preserves existing DuckDB errors and supports the data-last normalizer form", () => {
    const existing = DuckDbError.make({
      message: "Already normalized.",
      operation: "run",
    });

    expect(DuckDbError.fromUnknown("query", existing)).toBe(existing);

    const normalizeRunFailure = DuckDbError.fromUnknown("plain failure");
    const normalized = normalizeRunFailure("run");

    expect(normalized).toBeInstanceOf(DuckDbError);
    expect(normalized.message).toBe("DuckDB operation failed.");
    expect(normalized.operation).toBe("run");
  });

  it.effect(
    "runs statements, queries rows, and exports parquet",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const fs = yield* FileSystem.FileSystem;
          const databasePath = path.join(tmpDir, "metrics.duckdb");
          const parquetPath = path.join(tmpDir, "exports", "events.parquet");
          yield* fs.makeDirectory(path.dirname(parquetPath), { recursive: true });

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.withTransaction(
              Effect.fnUntraced(function* (transaction) {
                yield* transaction.run("CREATE TABLE events (id VARCHAR, value INTEGER)");
                yield* transaction.run("INSERT INTO events VALUES ($id, $value)", { id: "run-1", value: 42 });
              })
            );

            const rows = yield* duckdb.query("SELECT id, value FROM events ORDER BY id");
            expect(rows).toEqual([{ id: "run-1", value: 42 }]);

            yield* duckdb.copyTableToParquet(
              DuckDbParquetExport.make({
                filePath: parquetPath,
                tableName: "events",
              })
            );
            expect(yield* fs.exists(parquetPath)).toBe(true);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );

  it.effect(
    "preserves in-memory state across client operations",
    Effect.fnUntraced(function* () {
      yield* Effect.gen(function* () {
        const duckdb = yield* DuckDb;
        yield* duckdb.run("CREATE TABLE memory_events (id VARCHAR, value INTEGER)");
        yield* duckdb.run("INSERT INTO memory_events VALUES ($id, $value)", { id: "memory-1", value: 7 });

        const rows = yield* duckdb.query("SELECT id, value FROM memory_events ORDER BY id");
        expect(rows).toEqual([{ id: "memory-1", value: 7 }]);
      }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: ":memory:" }))));
    })
  );

  it.effect(
    "rolls back failed nested transactions on the same connection",
    Effect.fnUntraced(function* () {
      yield* withTempDirectory(
        Effect.fnUntraced(function* (tmpDir) {
          const path = yield* Path.Path;
          const databasePath = path.join(tmpDir, "metrics.duckdb");

          yield* Effect.gen(function* () {
            const duckdb = yield* DuckDb;
            yield* duckdb.run("CREATE TABLE tx_events (id VARCHAR)");

            const exit = yield* Effect.exit(
              duckdb.withTransaction(
                Effect.fnUntraced(function* (transaction) {
                  yield* transaction.run("INSERT INTO tx_events VALUES ('outer')");
                  yield* transaction.withTransaction((nested) => nested.run("INSERT INTO tx_events VALUES ('inner')"));
                  return yield* DuckDbError.make({
                    message: "force rollback",
                    operation: "withTransaction",
                  });
                })
              )
            );

            expect(Exit.isFailure(exit)).toBe(true);
            const rows = yield* duckdb.query("SELECT count(*) AS count FROM tx_events");
            expect(rows).toEqual([{ count: "0" }]);
          }).pipe(provideScopedLayer(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath }))));
        })
      ).pipe(provideScopedLayer(NodeServices.layer));
    })
  );
});
