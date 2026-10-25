/**
 * DuckDB adapter for the shared Effect SQL migration runner.
 *
 * **Details**
 *
 * Re-exports the `effect/sql/Migrator` loaders and error types and binds
 * `run`/`layer` to the current `SqlClient`. With the `"sqlite"` dialect the
 * Migrator creates `effect_sql_migrations` through its fallback DDL, which
 * DuckDB accepts. Since effect 4.0.6 a failing migration is a typed
 * `MigrationError` failure (4.0.5 raised it as a defect), and the whole batch of that run (earlier
 * migrations of the same run included) is rolled back. `run`/`layer` read the
 * generic `SqlClient`: under `DuckDbClient.layerClient` provide it explicitly
 * (`Effect.provideServiceEffect(SqlClient.SqlClient, Effect.service(DuckDbClient.DuckDbClient))`).
 * Concurrent runs against one file are not lock-coordinated on DuckDB: the
 * history insert does not conflict at insert time. Schema dumps read the current
 * catalog in creation OID order; FileSystem and Path supply the output artifact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DuckdbId } from "@beep/identity/packages";
import { quotedIdentifier, quotedString } from "@duckdb/node-api";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Migrator from "effect/sql/Migrator";
import * as SqlClient from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

const $I = $DuckdbId.create("DuckDbMigrator.service");
const CatalogStatement = S.Struct({ oid: S.Int, schema_name: S.String, sql: S.String }).pipe(
  $I.annoteSchema("CatalogStatement", { description: "DuckDB catalog DDL and creation OID." })
);
const CatalogMacro = S.Struct({
  oid: S.Int,
  schema_name: S.String,
  function_name: S.String,
  function_type: S.String,
  parameters: S.Array(S.String),
  parameter_types: S.String.pipe(S.NullOr, S.Array),
  macro_definition: S.String,
}).pipe($I.annoteSchema("CatalogMacro", { description: "User macro catalog definition." }));
const CatalogEnum = S.Struct({
  oid: S.Int,
  schema_name: S.String,
  type_name: S.String,
  labels: S.Array(S.String),
}).pipe($I.annoteSchema("CatalogEnum", { description: "User enum catalog labels." }));
const MigrationRow = S.Struct({ migration_id: S.Int, name: S.String, created_at: S.String }).pipe(
  $I.annoteSchema("MigrationRow", { description: "SQL migration history to include in a schema dump." })
);
const qualifiedName = (schema: string, name: string) => `${quotedIdentifier(schema)}.${quotedIdentifier(name)}`;
const dumpSchema = Effect.fn("DuckDbMigrator.dumpSchema")(
  function* (file: string, migrationsTable: string) {
    const sql = yield* SqlClient.SqlClient;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const statements = yield* sql<typeof CatalogStatement.Type>`
    SELECT table_oid AS oid, schema_name, sql FROM duckdb_tables()
      WHERE database_name = current_database() AND NOT internal AND NOT temporary
    UNION ALL SELECT view_oid AS oid, schema_name, sql FROM duckdb_views()
      WHERE database_name = current_database() AND NOT internal AND NOT temporary
    UNION ALL SELECT sequence_oid AS oid, schema_name, sql FROM duckdb_sequences()
      WHERE database_name = current_database() AND NOT temporary`.withoutTransform;
    const macros = yield* sql<typeof CatalogMacro.Type>`SELECT function_oid AS oid, schema_name, function_name,
      function_type, parameters, parameter_types, macro_definition FROM duckdb_functions()
      WHERE database_name = current_database() AND NOT internal AND function_type IN ('macro', 'table_macro')`
      .withoutTransform;
    const enums = yield* sql<typeof CatalogEnum.Type>`SELECT type_oid AS oid, schema_name, type_name, labels
      FROM duckdb_types() WHERE database_name = current_database() AND NOT internal AND logical_type = 'ENUM'`
      .withoutTransform;
    const objects = A.sort(
      [
        ...statements,
        ...A.map(
          R.values(A.groupBy(macros, (m) => `${m.oid}:${qualifiedName(m.schema_name, m.function_name)}`)),
          ([m, ...overloads]) => ({
            oid: m.oid,
            schema_name: m.schema_name,
            sql: `CREATE MACRO ${qualifiedName(m.schema_name, m.function_name)}${A.join(
              A.map(
                [m, ...overloads],
                (overload) =>
                  `(${A.join(
                    A.map(overload.parameters, (parameter, index) =>
                      O.fromNullishOr(overload.parameter_types[index]).pipe(
                        O.map((type) => `${quotedIdentifier(parameter)} ${type}`),
                        O.getOrElse(() => quotedIdentifier(parameter))
                      )
                    ),
                    ", "
                  )}) AS ${overload.function_type === "table_macro" ? `TABLE (${overload.macro_definition})` : overload.macro_definition}`
              ),
              ", "
            )};`,
          })
        ),
        ...A.map(enums, (e) => ({
          oid: e.oid,
          schema_name: e.schema_name,
          sql: `CREATE TYPE ${qualifiedName(e.schema_name, e.type_name)} AS ENUM (${A.join(A.map(e.labels, quotedString), ", ")});`,
        })),
      ],
      Order.mapInput(Order.Number, (row: typeof CatalogStatement.Type) => row.oid)
    );
    const indexes = yield* sql<{
      readonly sql: string;
      readonly schema_name: string;
    }>`SELECT sql, schema_name FROM duckdb_indexes()
      WHERE database_name = current_database() ORDER BY index_oid`.withoutTransform;
    const history = yield* sql<
      typeof MigrationRow.Type
    >`SELECT migration_id, name, CAST(created_at AS VARCHAR) AS created_at
      FROM ${sql(migrationsTable)} ORDER BY migration_id`.withoutTransform;
    const schemas = A.dedupe(A.map(objects, (row) => row.schema_name));
    const text = A.join(
      [
        ...A.map(schemas, (schema) => `CREATE SCHEMA IF NOT EXISTS ${quotedIdentifier(schema)};`),
        ...A.map([...objects, ...indexes], (row) => `SET schema = ${quotedString(row.schema_name)};\n${row.sql}`),
        "SET schema = 'main';",
        ...A.map(
          history,
          (row) =>
            `INSERT INTO ${quotedIdentifier(migrationsTable)} (migration_id, name, created_at) VALUES (${row.migration_id}, ${quotedString(row.name)}, ${quotedString(row.created_at)});`
        ),
        "",
      ],
      "\n"
    );
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, text);
  },
  Effect.mapError(
    (cause) => new Migrator.MigrationError({ kind: "Failed", message: "Could not dump DuckDB schema", cause })
  )
);

/**
 * The `effect/sql/Migrator` loaders (`fromRecord`, `fromGlob`, `fromBabelGlob`,
 * `fromFileSystem`), `make`, and `MigrationError`.
 *
 * **Example** (Build a record loader)
 *
 * ```ts
 * import { DuckDbMigrator } from "@beep/duckdb"
 * import * as Effect from "effect/Effect"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const loader = DuckDbMigrator.fromRecord({
 *   "1_create_events": Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table events (id integer)`)
 * })
 *
 * Effect.runPromise(loader).then((migrations) =>
 *   console.log(migrations.map(([id, name]) => [id, name]))
 * ) // [[1, "create_events"]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "effect/sql/Migrator";

/**
 * Run the pending migrations of a loader against the current `SqlClient`.
 *
 * **Details**
 *
 * Returns the `[id, name]` pairs applied by this run, in order.
 *
 * **Example** (Run record migrations)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMigrator } from "@beep/duckdb"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const program = DuckDbMigrator.run({
 *   loader: DuckDbMigrator.fromRecord({
 *     "1_create": Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table t (id integer primary key)`)
 *   })
 * }).pipe(Effect.provide(DuckDbClient.layer({ databasePath: ":memory:" })), Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((applied) => console.log(applied)) // [[1, "create"]]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const run: <R2 = never>(
  options: Migrator.MigratorOptions<R2>
) => Effect.Effect<
  ReadonlyArray<readonly [id: number, name: string]>,
  Migrator.MigrationError | SqlError,
  SqlClient.SqlClient | FileSystem.FileSystem | Path.Path | R2
> = Migrator.make({ dumpSchema });

/**
 * Layer that runs the pending migrations of a loader when it is built.
 *
 * **Example** (Migrate on layer build)
 *
 * ```ts
 * import { DuckDbClient, DuckDbMigrator } from "@beep/duckdb"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 * import * as SqlClient from "effect/sql/SqlClient"
 *
 * const MigrationsLive = DuckDbMigrator.layer({
 *   loader: DuckDbMigrator.fromRecord({
 *     "1_create": Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table t (id integer)`)
 *   })
 * }).pipe(Layer.provideMerge(DuckDbClient.layer({ databasePath: ":memory:" })))
 *
 * const program = Effect.flatMap(
 *   SqlClient.SqlClient,
 *   (sql) => sql`select table_name from information_schema.tables where table_name = 't'`
 * ).pipe(Effect.provide(MigrationsLive), Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program).then((rows) => console.log(rows)) // [{ table_name: "t" }]
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = <R>(
  options: Migrator.MigratorOptions<R>
): Layer.Layer<
  never,
  Migrator.MigrationError | SqlError,
  SqlClient.SqlClient | FileSystem.FileSystem | Path.Path | R
> => Layer.effectDiscard(run(options));
