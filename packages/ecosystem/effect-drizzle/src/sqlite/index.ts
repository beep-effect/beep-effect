/**
 * Provides SQLite storage policy, table constraints, and schema assembly.
 *
 * This subpath models SQLite's storage classes directly, including generated
 * enum checks and the absence of PostgreSQL-style array columns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/** SQLite storage-class combinators and SQL modifiers.
 * @category combinators
 * @since 0.0.0
 */
export * from "./combinators.ts";
/** Default SQLite column metadata combinator.
 * @category combinators
 * @since 0.0.0
 */
export { default_ as default } from "./combinators.ts";
/** SQLite table-extra constructors and guards.
 * @category tables
 * @since 0.0.0
 */
export * as Table from "./extras.ts";
/** Creates a SQLite-bound effect-drizzle kit.
 * @category factories
 * @since 0.0.0
 */
export { make } from "./kit.ts";
/** Shared model constructors and variant helpers for SQLite models.
 * @category models
 * @since 0.0.0
 */
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Model,
  Variant,
  VariantField,
} from "./model.ts";
/** SQLite schema assembly constructor and error.
 * @category projections
 * @since 0.0.0
 */
export { SchemaAssemblyError, schema } from "./schema.ts";
/** Projects one effect-drizzle model into a SQLite Drizzle table.
 * @category projections
 * @since 0.0.0
 */
export { toSqliteTable } from "./table.ts";
/** SQLite kit configuration and result types.
 * @category type-level
 * @since 0.0.0
 */
export type { SqliteEntityFactory, SqliteKit, SqliteKitConfig } from "./kit.ts";
/** SQLite model inference types.
 * @category type-level
 * @since 0.0.0
 */
export type {
  AnyModel,
  ColumnsOf,
  EffectiveSchema,
  FieldsInput,
  ModelClass,
  Statics,
  ValidateFields,
} from "./model.ts";
/** SQLite schema assembly inference types.
 * @category type-level
 * @since 0.0.0
 */
export type { Assembly, ModelRecord, RelationsConfig, TablesOf, ValidateSchema } from "./schema.ts";
/** SQLite table projection inference types.
 * @category type-level
 * @since 0.0.0
 */
export type { AdditionalExtras, BuilderFor, BuildersOf, TableOf } from "./table.ts";
