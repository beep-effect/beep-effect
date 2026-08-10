/**
 * BSL — Beep Specific Language.
 *
 * Experimental Effect v4 + drizzle rc SQL DSL: schema fields carry
 * statically-typed SQL metadata through a pipeable `Field<S, Meta>` node,
 * models are VariantSchema-aware classes, and tables project to fully-typed
 * drizzle `pgTable`s. See `research/` for the design inputs.
 */
export * as Field from "./Field.ts";
export * as Meta from "./Meta.ts";
export * as PgColumn from "./PgColumn.ts";
export * as Table from "./TableExtras.ts";
export * as Derive from "./derive.ts";
export * as pg from "./pg.ts";
export { make } from "./kit.ts";
export type { Dialect, EntityFactory, PgKit, PgKitConfig } from "./kit.ts";
export {
  Model,
  VariantField,
  FieldOnly,
  FieldExcept,
  fieldEvolve,
  extract,
  ModelInvariantError,
} from "./factory.ts";
export type {
  AnyModel,
  ColumnsOf,
  EffectiveSchema,
  FieldsInput,
  ModelClass,
  Statics,
  ValidateFields,
  Variant,
} from "./factory.ts";
export { schema, SchemaAssemblyError } from "./schema.ts";
export type {
  Assembly,
  ModelRecord,
  RelationsConfig,
  TablesOf,
  ValidateSchema,
} from "./schema.ts";
export { toPgTable } from "./table.ts";
export type {
  AdditionalExtras,
  BuilderFor,
  BuildersOf,
  TableOf,
} from "./table.ts";
