/**
 * Creates dialect-bound modeling kits with invariant entity defaults.
 *
 * The root dispatcher is a convenience for configuration-driven dialect
 * selection. Bundle-sensitive consumers can import `make` from the PostgreSQL
 * or SQLite subpath so the sibling dialect never enters the module graph.
 *
 * @since 0.0.0
 */
import { ModelInvariantError } from "./core/model.ts";
import { make as makePgKit } from "./pg/kit.ts";
import type { PgKit, PgKitConfig } from "./pg/kit.ts";
import type { FieldsInput as PgFieldsInput } from "./pg/model.ts";
import { make as makeSqliteKit } from "./sqlite/kit.ts";
import type { SqliteKit, SqliteKitConfig } from "./sqlite/kit.ts";
import type { FieldsInput as SqliteFieldsInput } from "./sqlite/model.ts";

export type {
  EntityFactory,
  PgKit,
  PgKitConfig,
} from "./pg/kit.ts";
export type {
  SqliteEntityFactory,
  SqliteKit,
  SqliteKitConfig,
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
 * The returned kit contains the selected dialect namespace, bare `Model`,
 * defaults-injected `Entity`, `Table`, repository factory, schema assembler,
 * and table projector. Default extras execute before entity-local extras.
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
 * const kit = make({
 *   dialect: "pg",
 *   defaultColumns: (pg) => ({ version: Int.pipe(pg.integer(), pg.default(1)) }),
 *   defaultExtras: () => []
 * })
 *
 * kit.pg.integer // => PostgreSQL integer combinator
 * ```
 *
 * @see {@link PgKitConfig} for PostgreSQL defaults and extras.
 * @see {@link SqliteKitConfig} for SQLite defaults and extras.
 * @category factories
 * @since 0.0.0
 */
export function make<const Defaults extends PgFieldsInput>(
  config: PgKitConfig<Defaults>,
): PgKit<Defaults>;
export function make<const Defaults extends SqliteFieldsInput>(
  config: SqliteKitConfig<Defaults>,
): SqliteKit<Defaults>;
export function make(
  config: PgKitConfig<PgFieldsInput> | SqliteKitConfig<SqliteFieldsInput>,
): unknown {
  if (config.dialect === "pg") return makePgKit(config);
  if (config.dialect === "sqlite") return makeSqliteKit(config);
  throw ModelInvariantError.make({
    message: "Unsupported @beep/effect-drizzle kit dialect.",
    fieldName: "(dialect)",
  });
}
