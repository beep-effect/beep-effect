/** Public root surface for the experimental `@beep/effect-drizzle` package. */
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
