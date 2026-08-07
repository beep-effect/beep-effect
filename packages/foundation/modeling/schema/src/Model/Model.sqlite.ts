/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import { Field } from "./Model.variants.ts";
import type * as VariantSchema from "../VariantSchema/index.ts";
/**
 * Interface for an SQLite boolean field using `0 | 1` in the database and `boolean` in JSON.
 *
 * **Example** (Type BooleanSqlite field)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.BooleanSqlite = Model.BooleanSqlite
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface BooleanSqlite
  extends VariantSchema.Field<{
    readonly select: S.BooleanFromBit;
    readonly insert: S.BooleanFromBit;
    readonly update: S.BooleanFromBit;
    readonly json: S.Boolean;
    readonly jsonCreate: S.Boolean;
    readonly jsonUpdate: S.Boolean;
  }> {}

/**
 * A schema for sqlite booleans that are represented as `0 | 1` in database
 * variants and `boolean` in JSON variants.
 *
 * **Example** (BooleanSqlite in model class)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Task extends Model.Class<Task>("Task")({
 *   done: Model.BooleanSqlite
 * }) {}
 *
 * console.log(Task.fields.done)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BooleanSqlite: BooleanSqlite = Field({
  select: S.BooleanFromBit,
  insert: S.BooleanFromBit,
  update: S.BooleanFromBit,
  json: S.Boolean,
  jsonCreate: S.Boolean,
  jsonUpdate: S.Boolean,
});
