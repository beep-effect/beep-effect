/**
 * Defines schema-first SQL models, dialect kits, and optimistic repositories.
 *
 * The root entrypoint owns dialect-neutral modeling decisions. Dialect-specific
 * column and table operators live in the PostgreSQL and SQLite subpaths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export { make } from "./kit.ts";
export type {
  Dialect,
  EntityFactory,
  PgKit,
  PgKitConfig,
  SqliteEntityFactory,
  SqliteKit,
  SqliteKitConfig,
} from "./kit.ts";
export {
  FieldExcept,
  FieldOnly,
  Model,
  VariantField,
  extract,
  fieldEvolve,
} from "./pg/model.ts";
export type {
  AnyModel,
  ColumnsOf,
  EffectiveSchema,
  FieldsInput,
  ModelClass,
  Statics,
  ValidateFields,
  Variant,
} from "./pg/model.ts";
export { ModelInvariantError } from "./core/model.ts";
export { makeRepository, VersionConflictError } from "./core/repository.ts";
export type { Repository, VersionKey } from "./core/repository.ts";
