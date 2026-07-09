/**
 * Integer schemas and refinements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { isNegative, isNonPositive, isPositive, isPostgresSerialInt } from "./Number.ts";

const $I = $SchemaId.create("Int");

/**
 * Branded schema for finite integers.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Int } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(Int)(42)
 * console.log(value) // 42
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const Int = S.Int.pipe(S.brand("Int"))
  .check(
    S.isFinite({
      message: "Expected a finite integer",
      description: "A finite integer",
    })
  )
  .pipe(
    $I.annoteSchema("Int", {
      description: "A an integer value",
    })
  );

/**
 * Type for {@link Int}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Int } from "@beep/schema/Int"
 *
 * const value: Int = S.decodeUnknownSync(Int)(42)
 * console.log(value + 1) // 43
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Int = typeof Int.Type;

/**
 * Branded schema for positive integers (greater than zero).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(PosInt)(5)
 * console.log(value) // 5
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const PosInt = Int.pipe(S.brand("PosInt"))
  .check(
    isPositive.annotate({
      message: "Expected a positive integer",
      description: "A positive integer",
    })
  )
  .pipe(
    $I.annoteSchema("PosInt", {
      description: "A positive integer",
    })
  );

/**
 * Type for {@link PosInt}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const count: PosInt = S.decodeUnknownSync(PosInt)(1)
 * console.log(count > 0) // true
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PosInt = typeof PosInt.Type;

/**
 * Branded schema for PostgreSQL `serial` column values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PostgresSerialInt } from "@beep/schema/Int"
 *
 * const id = S.decodeUnknownSync(PostgresSerialInt)(1)
 * console.log(id)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const PostgresSerialInt = Int.pipe(S.brand("PostgresSerialInt"))
  .check(isPostgresSerialInt)
  .pipe(
    $I.annoteSchema("PostgresSerialInt", {
      description: "A positive integer in the PostgreSQL serial int4 range.",
    })
  );

/**
 * Type for {@link PostgresSerialInt}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { PostgresSerialInt } from "@beep/schema/Int"
 *
 * const id: PostgresSerialInt = S.decodeUnknownSync(PostgresSerialInt)(1)
 * console.log(id) // 1
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PostgresSerialInt = typeof PostgresSerialInt.Type;

/**
 * Branded schema for negative integers (less than zero).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NegInt } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(NegInt)(-3)
 * console.log(value) // -3
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const NegInt = Int.pipe(S.brand("NegInt"))
  .check(
    isNegative.annotate({
      message: "Expected a negative integer",
      description: "A negative integer",
    })
  )
  .pipe(
    $I.annoteSchema("NegInt", {
      description: "A negative integer",
    })
  );

/**
 * Type for {@link NegInt}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NegInt } from "@beep/schema/Int"
 *
 * const debt: NegInt = S.decodeUnknownSync(NegInt)(-10)
 * console.log(debt < 0) // true
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type NegInt = typeof NegInt.Type;

/**
 * Branded schema for non-positive integers (zero or less).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonPositiveInt } from "@beep/schema/Int"
 *
 * console.log(S.decodeUnknownSync(NonPositiveInt)(0)) // 0
 * console.log(S.decodeUnknownSync(NonPositiveInt)(-5)) // -5
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const NonPositiveInt = Int.pipe(S.brand("NonPositiveInt"))
  .check(
    isNonPositive.annotate({
      message: "Expected a non-positive integer",
      description: "A non-positive integer",
    })
  )
  .pipe(
    $I.annoteSchema("NonPositiveInt", {
      description: "A non-positive integer",
    })
  );

/**
 * Type for {@link NonPositiveInt}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonPositiveInt } from "@beep/schema/Int"
 *
 * const offset: NonPositiveInt = S.decodeUnknownSync(NonPositiveInt)(0)
 * console.log(offset <= 0) // true
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type NonPositiveInt = typeof NonPositiveInt.Type;

/**
 * @since 0.0.0
 * @category validation
 */
export * from "./Int64.ts";
/**
 * Branded schema for non-negative integers (zero or greater).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema/Int"
 *
 * console.log(S.decodeUnknownSync(NonNegativeInt)(0)) // 0
 * console.log(S.decodeUnknownSync(NonNegativeInt)(100)) // 100
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export { NonNegativeInt } from "./Number.ts";
