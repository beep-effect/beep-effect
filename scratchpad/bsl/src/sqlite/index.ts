/**
 * Provides SQLite storage policy, table constraints, and schema assembly.
 *
 * This subpath models SQLite's storage classes directly, including generated
 * enum checks and the absence of PostgreSQL-style array columns.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export * from "./combinators.ts";
export { default_ as default } from "./combinators.ts";
export * as Table from "./extras.ts";
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Model,
  Variant,
  VariantField,
} from "./model.ts";
export type {
  AnyModel,
  ColumnsOf,
  EffectiveSchema,
  FieldsInput,
  ModelClass,
  Statics,
  ValidateFields,
} from "./model.ts";
export { SchemaAssemblyError, schema } from "./schema.ts";
export type { Assembly, ModelRecord, RelationsConfig, TablesOf, ValidateSchema } from "./schema.ts";
export { toSqliteTable } from "./table.ts";
export type { AdditionalExtras, BuilderFor, BuildersOf, TableOf } from "./table.ts";
