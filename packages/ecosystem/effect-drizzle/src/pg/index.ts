/**
 * Provides PostgreSQL column policy, table constraints, and schema assembly.
 *
 * This subpath turns encoded Effect schemas into PostgreSQL-aware field
 * metadata and projects complete models onto real Drizzle tables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/** PostgreSQL column combinators and SQL modifiers.
 * @category combinators
 * @since 0.0.0
 */
export * from "./combinators.ts";
/** Default PostgreSQL column metadata combinator.
 * @category combinators
 * @since 0.0.0
 */
export { default_ as default } from "./combinators.ts";
/** PostgreSQL table-extra constructors and guards.
 * @category tables
 * @since 0.0.0
 */
export * as Table from "./extras.ts";
/** Creates a PostgreSQL-bound effect-drizzle kit.
 * @category factories
 * @since 0.0.0
 */
export { make } from "./kit.ts";
/** PostgreSQL schema assembly constructor and error.
 * @category projections
 * @since 0.0.0
 */
export { SchemaAssemblyError, schema } from "./schema.ts";
/** Projects one effect-drizzle model into a PostgreSQL Drizzle table.
 * @category projections
 * @since 0.0.0
 */
export { toPgTable } from "./table.ts";
/**
 * PostgreSQL column metadata types retained by downstream declaration emit.
 *
 * @category type-level
 * @since 0.0.0
 */
export type { Bigint, Custom, Integer, Jsonb, Numeric, Serial, Text, Timestamp, Varchar } from "./Column.ts";
/** PostgreSQL kit configuration and result types.
 * @category type-level
 * @since 0.0.0
 */
export type { EntityFactory, PgKit, PgKitConfig } from "./kit.ts";
/** PostgreSQL schema assembly inference types.
 * @category type-level
 * @since 0.0.0
 */
export type {
  Assembly,
  ModelRecord,
  RelationsConfig,
  TablesOf,
  ValidateSchema,
} from "./schema.ts";
/** PostgreSQL table projection inference types.
 * @category type-level
 * @since 0.0.0
 */
export type {
  AdditionalExtras,
  BuilderFor,
  BuildersOf,
  TableOf,
} from "./table.ts";
