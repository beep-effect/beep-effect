/**
 * Provides PostgreSQL column policy, table constraints, and schema assembly.
 *
 * This subpath turns encoded Effect schemas into PostgreSQL-aware field
 * metadata and projects complete models onto real Drizzle tables.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export * from "./combinators.ts";
export { default_ as default } from "./combinators.ts";
export * as Table from "./extras.ts";
export { SchemaAssemblyError, schema } from "./schema.ts";
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
