/**
 * Creates dialect-bound modeling kits with invariant entity defaults.
 *
 * The root dispatcher is a convenience for configuration-driven dialect
 * selection. Bundle-sensitive consumers can import `make` from the PostgreSQL
 * or SQLite subpath so the sibling dialect never enters the module graph.
 *
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { ModelInvariantError } from "./core/model.ts";
import { make as makePgKit } from "./pg/kit.ts";
import { make as makeSqliteKit } from "./sqlite/kit.ts";
import type { PgKit, PgKitConfig, PgToolkit } from "./pg/kit.ts";
import type { FieldsInput as PgFieldsInput } from "./pg/model.ts";
import type { SqliteKit, SqliteKitConfig, SqliteToolkit } from "./sqlite/kit.ts";
import type { FieldsInput as SqliteFieldsInput } from "./sqlite/model.ts";

/** PostgreSQL kit configuration and result types.
 * @category type-level
 * @since 0.0.0
 */
export type {
  EntityFactory,
  PgKit,
  PgKitConfig,
  PgKitExtension,
  PgToolkit,
  ValidateCollision,
  ValidateMergedFields,
} from "./pg/kit.ts";
/** SQLite kit configuration and result types.
 * @category type-level
 * @since 0.0.0
 */
export type {
  SqliteEntityFactory,
  SqliteKit,
  SqliteKitConfig,
  SqliteKitExtension,
  SqliteToolkit,
} from "./sqlite/kit.ts";

/**
 * Names the SQL dialect selected by the root kit dispatcher.
 *
 * **When to use**
 *
 * Use when configuration can select either public dialect subpath.
 *
 * **Details**
 *
 * Bundle-sensitive code should import the dialect-local `make` constructor
 * instead of dispatching on this union at runtime.
 *
 * **Example** (Select the PostgreSQL dialect)
 *
 * ```ts
 * import type { Dialect } from "@beep/effect-drizzle"
 *
 * type PostgreSQL = Extract<Dialect, "pg"> // => "pg"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Dialect = "pg" | "sqlite";

type DialectFields<D extends Dialect> = D extends "pg" ? PgFieldsInput : SqliteFieldsInput;
type DialectToolkit<D extends Dialect> = D extends "pg" ? PgToolkit : SqliteToolkit;
type DialectConfig<D extends Dialect, Defaults extends DialectFields<D>> = D extends "pg"
  ? Defaults extends PgFieldsInput
    ? PgKitConfig<Defaults>
    : never
  : Defaults extends SqliteFieldsInput
    ? SqliteKitConfig<Defaults>
    : never;
type DialectKit<D extends Dialect, Defaults extends DialectFields<D>> = D extends "pg"
  ? Defaults extends PgFieldsInput
    ? PgKit<Defaults>
    : never
  : Defaults extends SqliteFieldsInput
    ? SqliteKit<Defaults>
    : never;

/**
 * Creates a dialect kit whose entity defaults and extras are fixed once.
 *
 * **When to use**
 *
 * Use when runtime configuration selects PostgreSQL or SQLite from one root
 * API; import the dialect subpath constructor when bundle isolation matters.
 *
 * **Details**
 *
 * The dialect is the first argument and the whole configuration lives in one
 * closure receiving the dialect toolkit (column combinators plus the `Table`
 * extras namespace). The returned kit contains the toolkit, bare `Model`,
 * defaults-injected `Entity`, `Table`, repository factory, schema assembler,
 * table projector, and `extend`. Default extras execute before entity-local
 * extras. Literal dialects retain their exact kit type; a `Dialect` union input
 * receives and returns the corresponding toolkit and kit unions.
 *
 * **Gotchas**
 *
 * This convenience dispatcher imports both dialect implementations. Import
 * `make` from `@beep/effect-drizzle/pg` or `/sqlite` to exclude the sibling.
 *
 * **Example** (Create a PostgreSQL kit)
 *
 * ```ts
 * import { Int } from "effect/Schema"
 * import { make } from "@beep/effect-drizzle"
 *
 * const kit = make("pg", (pg) => ({
 *   defaultColumns: { version: Int.pipe(pg.integer(), pg.default(1)) },
 *   defaultExtras: () => []
 * }))
 *
 * kit.pg.integer // => PostgreSQL integer combinator
 * ```
 *
 * @see {@link PgKitConfig} for PostgreSQL defaults and extras.
 * @see {@link SqliteKitConfig} for SQLite defaults and extras.
 * @category factories
 * @since 0.0.0
 */
export const make: {
  <const Defaults extends PgFieldsInput>(
    build: (pg: PgToolkit) => PgKitConfig<Defaults>
  ): (dialect: "pg") => PgKit<Defaults>;
  <const Defaults extends SqliteFieldsInput>(
    build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>
  ): (dialect: "sqlite") => SqliteKit<Defaults>;
  <const D extends Dialect, const Defaults extends DialectFields<D>>(
    build: (toolkit: DialectToolkit<D>) => DialectConfig<D, Defaults>
  ): (dialect: D) => DialectKit<D, Defaults>;
  <const Defaults extends PgFieldsInput>(
    dialect: "pg",
    build: (pg: PgToolkit) => PgKitConfig<Defaults>
  ): PgKit<Defaults>;
  <const Defaults extends SqliteFieldsInput>(
    dialect: "sqlite",
    build: (sqlite: SqliteToolkit) => SqliteKitConfig<Defaults>
  ): SqliteKit<Defaults>;
  <const D extends Dialect, const Defaults extends DialectFields<D>>(
    dialect: D,
    build: (toolkit: DialectToolkit<D>) => DialectConfig<D, Defaults>
  ): DialectKit<D, Defaults>;
} = dual(2, (dialect: Dialect, build: unknown): unknown => {
  if (dialect === "pg") return makePgKit(build as (pg: PgToolkit) => PgKitConfig<PgFieldsInput>);
  if (dialect === "sqlite")
    return makeSqliteKit(build as (sqlite: SqliteToolkit) => SqliteKitConfig<SqliteFieldsInput>);
  throw ModelInvariantError.make({
    message: "Unsupported @beep/effect-drizzle kit dialect.",
    fieldName: "(dialect)",
  });
});
