/**
 * Integer schemas and refinements.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { isNegative, isNonPositive, isPositive, isPostgresSerialInt } from "./Number.ts";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Int");

/**
 * Branded schema for finite integers.
 *
 * **Example** (Decode finite integer)
 *
 * ```ts import.meta.vitest name="Decode finite integer"
 * import * as S from "effect/Schema"
 * import { Int } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(Int)(42)
 * value // => 42
 * ```
 *
 * @category validation
 * @since 0.0.0
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
 * **Example** (Typed integer value)
 *
 * ```ts import.meta.vitest name="Typed integer value"
 * import * as S from "effect/Schema"
 * import { Int } from "@beep/schema/Int"
 *
 * const value: Int = S.decodeUnknownSync(Int)(42)
 * value + 1 // => 43
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Int = typeof Int.Type;

/**
 * Branded schema for positive integers (greater than zero).
 *
 * **Example** (Decode positive integer)
 *
 * ```ts import.meta.vitest name="Decode positive integer"
 * import * as S from "effect/Schema"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(PosInt)(5)
 * value // => 5
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PosInt = Int.pipe(
  S.check(
    isPositive.annotate({
      message: "Expected a positive integer",
      description: "A positive integer",
    })
  ),
  S.brand("PosInt"),
  $I.annoteSchema("PosInt", {
    description: "A positive integer",
  }),
  SchemaUtils.withCodecStatics(["decodeEffect"])
);

/**
 * Type for {@link PosInt}.
 *
 * **Example** (Typed positive integer)
 *
 * ```ts import.meta.vitest name="Typed positive integer"
 * import * as S from "effect/Schema"
 * import { PosInt } from "@beep/schema/Int"
 *
 * const count: PosInt = S.decodeUnknownSync(PosInt)(1)
 * count > 0 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PosInt = typeof PosInt.Type;

/**
 * Branded schema for PostgreSQL `serial` column values.
 *
 * **Example** (Decode serial identifier)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PostgresSerialInt } from "@beep/schema/Int"
 *
 * const id = S.decodeUnknownSync(PostgresSerialInt)(1)
 * console.log(id)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PostgresSerialInt = Int.pipe(
  S.check(isPostgresSerialInt),
  S.brand("PostgresSerialInt"),
  $I.annoteSchema("PostgresSerialInt", {
    description: "A positive integer in the PostgreSQL serial int4 range.",
  })
);

/**
 * Type for {@link PostgresSerialInt}.
 *
 * **Example** (Typed serial identifier)
 *
 * ```ts import.meta.vitest name="Typed serial identifier"
 * import * as S from "effect/Schema"
 * import { PostgresSerialInt } from "@beep/schema/Int"
 *
 * const id: PostgresSerialInt = S.decodeUnknownSync(PostgresSerialInt)(1)
 * id // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PostgresSerialInt = typeof PostgresSerialInt.Type;

/**
 * Branded schema for negative integers (less than zero).
 *
 * **Example** (Decode negative integer)
 *
 * ```ts import.meta.vitest name="Decode negative integer"
 * import * as S from "effect/Schema"
 * import { NegInt } from "@beep/schema/Int"
 *
 * const value = S.decodeUnknownSync(NegInt)(-3)
 * value // => -3
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NegInt = Int.pipe(
  S.check(
    isNegative.annotate({
      message: "Expected a negative integer",
      description: "A negative integer",
    })
  ),
  S.brand("NegInt"),
  $I.annoteSchema("NegInt", {
    description: "A negative integer",
  })
);

/**
 * Type for {@link NegInt}.
 *
 * **Example** (Typed negative integer)
 *
 * ```ts import.meta.vitest name="Typed negative integer"
 * import * as S from "effect/Schema"
 * import { NegInt } from "@beep/schema/Int"
 *
 * const debt: NegInt = S.decodeUnknownSync(NegInt)(-10)
 * debt < 0 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NegInt = typeof NegInt.Type;

/**
 * Branded schema for non-positive integers (zero or less).
 *
 * **Example** (Decode non-positive values)
 *
 * ```ts import.meta.vitest name="Decode non-positive values"
 * import * as S from "effect/Schema"
 * import { NonPositiveInt } from "@beep/schema/Int"
 *
 * S.decodeUnknownSync(NonPositiveInt)(0) // => 0
 * S.decodeUnknownSync(NonPositiveInt)(-5) // => -5
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const NonPositiveInt = Int.pipe(
  S.check(
    isNonPositive.annotate({
      message: "Expected a non-positive integer",
      description: "A non-positive integer",
    })
  ),
  S.brand("NonPositiveInt"),
  $I.annoteSchema("NonPositiveInt", {
    description: "A non-positive integer",
  })
);

/**
 * Type for {@link NonPositiveInt}.
 *
 * **Example** (Typed non-positive integer)
 *
 * ```ts import.meta.vitest name="Typed non-positive integer"
 * import * as S from "effect/Schema"
 * import { NonPositiveInt } from "@beep/schema/Int"
 *
 * const offset: NonPositiveInt = S.decodeUnknownSync(NonPositiveInt)(0)
 * offset <= 0 // => true
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Example** (Decode non-negative values)
 *
 * ```ts import.meta.vitest name="Decode non-negative values"
 * import * as S from "effect/Schema"
 * import { NonNegativeInt } from "@beep/schema/Int"
 *
 * S.decodeUnknownSync(NonNegativeInt)(0) // => 0
 * S.decodeUnknownSync(NonNegativeInt)(100) // => 100
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export { NonNegativeInt } from "./Number.ts";
