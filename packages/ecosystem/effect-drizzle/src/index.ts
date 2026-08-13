/**
 * Defines schema-first SQL models, dialect kits, and optimistic repositories.
 *
 * The root entrypoint owns dialect-neutral modeling decisions. Dialect-specific
 * column and table operators live in the PostgreSQL and SQLite subpaths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/** Runtime error raised when a model violates a construction invariant.
 * @category errors
 * @since 0.0.0
 */
export { ModelInvariantError } from "./core/model.ts";
/** Optimistic repository constructor and conflict error.
 * @category repositories
 * @since 0.0.0
 */
export { makeRepository, VersionConflictError } from "./core/repository.ts";
/** Kit constructor deriving dialect-bound model, entity, and table builders.
 * @category constructors
 * @since 0.0.0
 */
export { make } from "./kit.ts";
/** Shared model constructors and variant helpers exposed by the root entrypoint.
 * @category models
 * @since 0.0.0
 */
export {
  extract,
  FieldExcept,
  FieldOnly,
  fieldEvolve,
  Model,
  VariantField,
} from "./pg/model.ts";
/** Repository result and version-column types.
 * @category type-level
 * @since 0.0.0
 */
export type { Repository, VersionKey } from "./core/repository.ts";
/** Public kit configuration and result types for both supported SQL dialects.
 * @category models
 * @since 0.0.0
 */
export type {
  Dialect,
  EntityFactory,
  PgKit,
  PgKitConfig,
  SqliteEntityFactory,
  SqliteKit,
  SqliteKitConfig,
} from "./kit.ts";
/** Shared model inference types exposed by the root entrypoint.
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
  Variant,
} from "./pg/model.ts";
