/**
 * Manual Effect v4 replacement for the removed v3 `Schema.split` helper.
 *
 * The returned helper keeps the encoded surface as a string, then transforms
 * that string into a decoded `ReadonlyArray<string>` by splitting on the
 * provided separator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, Str } from "@beep/utils";
import { SchemaTransformation } from "effect";
import * as S from "effect/Schema";

/**
 * Build a schema that decodes delimited text into a readonly string array.
 *
 * **Details**
 *
 * This helper follows the manual v4 migration pattern described in the Effect
 * Schema migration guide. It is not the old v3 `Schema.split` API. Instead, it
 * is a local utility that:
 *
 * 1. Accepts a string boundary on the encoded side.
 * 2. Decodes that string into `ReadonlyArray<string>` with `effect/String`.
 * 3. Encodes the readonly array back into a string with `effect/Array`.
 *
 * The transformation preserves ordinary split and join semantics. It does not
 * trim entries, drop empty segments, or normalize whitespace.
 *
 * **Example** (Splitting delimited text)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { split } from "@beep/schema/SchemaUtils/split";
 *
 * const CsvCells = split(",");
 * const decodeCsvCells = S.decodeSync(CsvCells);
 * const encodeCsvCells = S.encodeSync(CsvCells);
 *
 * console.log(decodeCsvCells("red,green,blue")); // ["red", "green", "blue"]
 * console.log(encodeCsvCells(["red", "green", "blue"])); // "red,green,blue"
 * ```
 *
 * @param separator - Delimiter used for both decoding and encoding.
 * @returns A schema that decodes delimited strings into readonly string arrays
 * and encodes readonly string arrays back into delimited strings.
 * @category utilities
 * @since 0.0.0
 */
export function split(separator: string) {
  return S.String.pipe(
    S.decodeTo(
      S.Array(S.String),
      SchemaTransformation.transform({
        decode: (value): ReadonlyArray<string> => Str.split(separator)(value),
        encode: (values: ReadonlyArray<string>) => A.join(values, separator),
      })
    )
  );
}
