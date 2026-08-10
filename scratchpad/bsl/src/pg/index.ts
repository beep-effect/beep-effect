/** Public PostgreSQL subpath surface for `@beep/effect-drizzle/pg`. */
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
