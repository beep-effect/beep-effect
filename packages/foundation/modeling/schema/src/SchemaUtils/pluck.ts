/**
 * Manual Effect v4 replacement for the removed v3 `Schema.pluck` helper.
 *
 * The returned helper narrows a struct schema down to a single property on the
 * encoded side, then transforms that one-property struct into the selected
 * field's decoded value.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Struct } from "@beep/utils";
import { SchemaGetter } from "effect";
import * as S from "effect/Schema";
import type { TUnsafe } from "@beep/types";

/**
 * Project a struct schema down to one field and expose that field as the
 * decoded value.
 *
 * **Details**
 *
 * This helper follows the manual v4 migration pattern described in the Effect
 * Schema migration guide. It is not the old v3 `Schema.pluck` API. Instead, it
 * is a local utility that:
 *
 * 1. Keeps only the selected key in the struct schema with `mapFields`.
 * 2. Decodes `{ readonly [key]: EncodedField }` into `DecodedField`.
 * 3. Encodes `DecodedField` back into `{ readonly [key]: EncodedField }`.
 *
 * The source schema must be an `S.Struct` that contains the requested key. The
 * returned schema no longer describes the whole original struct, only the
 * selected field and its one-property encoded representation.
 *
 * **Example** (Plucking one struct field)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { pluck } from "@beep/schema/SchemaUtils/pluck";
 *
 * const MyTable = S.Struct({
 *   column1: S.FiniteFromString
 * });
 *
 * const Column1 = MyTable.pipe(pluck("column1"));
 * const decodeColumn1 = S.decodeUnknownSync(Column1);
 * const encodeColumn1 = S.encodeSync(Column1);
 *
 * console.log(decodeColumn1({ column1: "1" })); // 1
 * console.log(encodeColumn1(2)); // { column1: "2" }
 * ```
 *
 * @typeParam P - Property key to extract from the struct schema.
 * @param key - Struct field to keep on the encoded side and expose on the
 * decoded side.
 * @returns A schema that decodes a one-property struct into the selected field
 * value and encodes that field value back into a one-property struct.
 * @category utilities
 * @since 0.0.0
 */
export function pluck<P extends PropertyKey>(key: P) {
  return <FieldSchema extends S.Top>(
    schema: S.Struct<{ [K in P]: FieldSchema }>
  ): S.decodeTo<S.toType<FieldSchema>, S.Struct<{ [K in P]: FieldSchema }>> =>
    schema.mapFields(Struct.pick([key])).pipe(
      S.decodeTo(S.toType(schema.fields[key]), {
        decode: SchemaGetter.transform((whole: TUnsafe.Any) => whole[key]),
        encode: SchemaGetter.transform((value) => ({ [key]: value }) as TUnsafe.Any),
      })
    );
}
