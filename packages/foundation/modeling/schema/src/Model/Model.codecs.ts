/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { Field } from "./Model.variants.ts";
import type { TUnsafe } from "@beep/types";
import type * as VariantSchema from "../VariantSchema/index.ts";
/**
 * Interface for a field stored as a JSON text column in the database.
 *
 * **Example** (JsonFromString field creation)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const field = Model.JsonFromString(S.Struct({ a: S.String }))
 *
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface JsonFromString<S extends S.Top>
  extends VariantSchema.Field<{
    readonly select: S.fromJsonString<S>;
    readonly insert: S.fromJsonString<S>;
    readonly update: S.fromJsonString<S>;
    readonly json: S;
    readonly jsonCreate: S;
    readonly jsonUpdate: S;
  }> {}

/**
 * A field that represents a JSON value stored as text in the database.
 *
 * **Details**
 *
 * The "json" variants will use the object schema directly.
 *
 * **Example** (JsonFromString in Model.Class)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * class Record extends Model.Class<Record>("Record")({
 *   payload: Model.JsonFromString(S.Struct({ a: S.String }))
 * }) {}
 *
 * console.log(Record)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const JsonFromString = <S extends S.Top>(schema: S): JsonFromString<S> => {
  const parsed = schema.pipe(S.toCodecJson, S.fromJsonString) as TUnsafe.Any;
  return Field({
    select: parsed,
    insert: parsed,
    update: parsed,
    json: schema,
    jsonCreate: schema,
    jsonUpdate: schema,
  });
};
