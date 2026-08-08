/**
 * Reusable schema constructors for array-like data.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("ArrayOf");

/**
 * Schema for `ReadonlyArray<string>`.
 *
 * **Example** (Decode string array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(ArrayOfStrings)(["a", "b", "c"])
 * console.log(decoded.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ArrayOfStrings = S.Array(S.String).pipe(
  $I.annoteSchema("ArrayOfStrings", {
    description: "An array of strings",
  })
);

/**
 * Type for {@link ArrayOfStrings}.
 *
 * **Example** (Typed decoded string array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded: ArrayOfStrings = S.decodeUnknownSync(ArrayOfStrings)(["a", "b"])
 * console.log(decoded.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayOfStrings = S.Schema.Type<typeof ArrayOfStrings>;

/**
 * Schema for non-empty arrays of strings.
 *
 * **Example** (Decode non-empty strings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(NonEmptyArrayOfStrings)(["hello"])
 * console.log(decoded[0])
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyArrayOfStrings = S.NonEmptyArray(S.String).pipe(
  $I.annoteSchema("NonEmptyArrayOfStrings", {
    description: "An array of non-empty strings",
  })
);

/**
 * Type for {@link NonEmptyArrayOfStrings}.
 *
 * **Example** (Typed non-empty string array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded: NonEmptyArrayOfStrings = S.decodeUnknownSync(NonEmptyArrayOfStrings)(["hello"])
 * console.log(decoded[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyArrayOfStrings = S.Schema.Type<typeof NonEmptyArrayOfStrings>;

/**
 * Schema for arrays of `NonEmptyString` values.
 *
 * **Example** (Decode non-empty string items)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfNonEmptyStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(ArrayOfNonEmptyStrings)(["hello", "world"])
 * console.log(decoded.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ArrayOfNonEmptyStrings = S.Array(S.NonEmptyString).pipe(
  $I.annoteSchema("ArrayOfNonEmptyStrings", {
    description: "An array of non-empty strings",
  })
);

/**
 * Type for {@link ArrayOfNonEmptyStrings}.
 *
 * **Example** (Typed non-empty string items)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfNonEmptyStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded: ArrayOfNonEmptyStrings = S.decodeUnknownSync(ArrayOfNonEmptyStrings)(["hello", "world"])
 * console.log(decoded.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayOfNonEmptyStrings = S.Schema.Type<typeof ArrayOfNonEmptyStrings>;

/**
 * Schema for non-empty arrays of `NonEmptyString` values.
 *
 * **Example** (Decode non-empty non-empty strings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfNonEmptyStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(NonEmptyArrayOfNonEmptyStrings)(["hello"])
 * console.log(decoded[0])
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyArrayOfNonEmptyStrings = S.NonEmptyArray(S.NonEmptyString).pipe(
  $I.annoteSchema("NonEmptyArrayOfNonEmptyStrings", {
    description: "An array of non-empty non-empty strings",
  })
);

/**
 * Type for {@link NonEmptyArrayOfNonEmptyStrings}.
 *
 * **Example** (Typed non-empty non-empty strings)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfNonEmptyStrings } from "@beep/schema/ArrayOf"
 *
 * const decoded: NonEmptyArrayOfNonEmptyStrings = S.decodeUnknownSync(NonEmptyArrayOfNonEmptyStrings)(["hello"])
 * console.log(decoded[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyArrayOfNonEmptyStrings = S.Schema.Type<typeof NonEmptyArrayOfNonEmptyStrings>;

/**
 * Schema for arrays of numbers.
 *
 * **Example** (Decode number array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfNumbers } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(ArrayOfNumbers)([1, 2, 3])
 * console.log(decoded.length)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ArrayOfNumbers = S.Array(S.Finite).pipe(
  $I.annoteSchema("ArrayOfNumbers", {
    description: "An array of numbers",
  })
);

/**
 * Type for {@link ArrayOfNumbers}.
 *
 * **Example** (Typed decoded number array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfNumbers } from "@beep/schema/ArrayOf"
 *
 * const decoded: ArrayOfNumbers = S.decodeUnknownSync(ArrayOfNumbers)([1, 2, 3])
 * console.log(decoded.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayOfNumbers = S.Schema.Type<typeof ArrayOfNumbers>;

/**
 * Schema for non-empty arrays of numbers.
 *
 * **Example** (Decode non-empty numbers)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfNumbers } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(NonEmptyArrayOfNumbers)([42])
 * console.log(decoded[0])
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyArrayOfNumbers = S.NonEmptyArray(S.Finite).pipe(
  $I.annoteSchema("NonEmptyArrayOfNumbers", {
    description: "An array of non-empty numbers",
  })
);

/**
 * Type for {@link NonEmptyArrayOfNumbers}.
 *
 * **Example** (Typed non-empty number array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfNumbers } from "@beep/schema/ArrayOf"
 *
 * const decoded: NonEmptyArrayOfNumbers = S.decodeUnknownSync(NonEmptyArrayOfNumbers)([42])
 * console.log(decoded[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyArrayOfNumbers = S.Schema.Type<typeof NonEmptyArrayOfNumbers>;

/**
 * Schema for arrays of integers.
 *
 * **Example** (Decode integer array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfInts } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(ArrayOfInts)([1, 2, 3])
 * console.log(decoded.every(Number.isInteger))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ArrayOfInts = S.Array(S.Int).pipe(
  $I.annoteSchema("ArrayOfInts", {
    description: "An array of integers",
  })
);

/**
 * Type for {@link ArrayOfInts}.
 *
 * **Example** (Typed decoded integer array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ArrayOfInts } from "@beep/schema/ArrayOf"
 *
 * const decoded: ArrayOfInts = S.decodeUnknownSync(ArrayOfInts)([1, 2, 3])
 * console.log(decoded.every(Number.isInteger))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArrayOfInts = S.Schema.Type<typeof ArrayOfInts>;

/**
 * Schema for non-empty arrays of integers.
 *
 * **Example** (Decode non-empty integers)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfInts } from "@beep/schema/ArrayOf"
 *
 * const decoded = S.decodeUnknownSync(NonEmptyArrayOfInts)([1])
 * console.log(decoded[0])
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonEmptyArrayOfInts = S.NonEmptyArray(S.Int).pipe(
  $I.annoteSchema("NonEmptyArrayOfInts", {
    description: "An array of non-empty integers",
  })
);

/**
 * Type for {@link NonEmptyArrayOfInts}.
 *
 * **Example** (Typed non-empty integer array)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonEmptyArrayOfInts } from "@beep/schema/ArrayOf"
 *
 * const decoded: NonEmptyArrayOfInts = S.decodeUnknownSync(NonEmptyArrayOfInts)([1])
 * console.log(decoded[0])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NonEmptyArrayOfInts = S.Schema.Type<typeof NonEmptyArrayOfInts>;
