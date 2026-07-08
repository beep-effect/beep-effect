/**
 * Common types for CSV parsing
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { pipe } from "effect";
import * as S from "effect/Schema";
import { Fn } from "../Fn/index.ts";

const $I = $SchemaId.create("ParserOptions");

/**
 * An array containing possibly nullish strings.
 *
 * @example
 * ```ts
 * import { HeaderArray } from "../../src/ParserOptions/ParserOptions.types.ts"
 * import * as S from "effect/Schema"
 *
 * const headers = S.decodeUnknownSync(HeaderArray)(["name", null])
 * console.log(headers.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HeaderArray = pipe(
  S.String,
  S.NullishOr,
  S.Array,
  $I.annoteSchema("HeaderArray", {
    description: "An array containing possibly nullish strings.",
  })
);

/**
 * {@inheritDoc HeaderArray}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { HeaderArray } from "../../src/ParserOptions/ParserOptions.types.ts"
 *
 * const headers: HeaderArray = S.decodeUnknownSync(HeaderArray)(["name", null])
 * console.log(headers.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HeaderArray = typeof HeaderArray.Type;

/**
 * An identity function taking an array containing possibly nullish strings
 * and returning it.
 *
 * @example
 * ```ts
 * import { HeaderTransformFunction } from "../../src/ParserOptions/ParserOptions.types.ts"
 *
 * const transform = HeaderTransformFunction.implementSync((headers) => headers)
 * console.log(transform(["name"]).length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HeaderTransformFunction = Fn({
  input: HeaderArray,
  output: HeaderArray,
}).pipe(
  $I.annoteSchema("HeaderTransformFunction", {
    description: "An identity function taking an array containing possibly nullish strings\nand returning it.",
  })
);

/**
 * {@inheritDoc HeaderTransformFunction}
 *
 * @example
 * ```ts
 * import { HeaderTransformFunction } from "../../src/ParserOptions/ParserOptions.types.ts"
 *
 * const transform: HeaderTransformFunction = HeaderTransformFunction.implementSync((headers) => headers)
 * console.log(transform(["name"]).length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HeaderTransformFunction = typeof HeaderTransformFunction.Type;
