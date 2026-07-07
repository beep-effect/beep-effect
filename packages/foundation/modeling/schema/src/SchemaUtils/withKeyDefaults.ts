/**
 * Attach the same default value for constructor creation and missing-key
 * decoding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("SchemaUtils/withKeyDefaults");

/**
 * Applies a shared default value to a schema field for both constructor-time
 * defaults and decoding-time missing keys.
 *
 * This helper combines `Schema.withConstructorDefault` and
 * `Schema.withDecodingDefaultTypeKey` using the same decoded value, so the
 * provided default must be valid as both the schema's runtime `Type` and
 * constructor input.
 *
 * Supports both call styles:
 * - Data-last: `pipe(S.String, withKeyDefaults("draft"))`
 * - Data-first: `withKeyDefaults(S.String, "draft")`
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { withKeyDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Status = withKeyDefaults(S.String, "draft")
 * const Settings = S.Struct({ status: Status })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).status) // "draft"
 * ```
 *
 * @typeParam TSchema - Schema receiving the shared default value.
 * @param self - Schema receiving the shared default value.
 * @param defaultValue - Value used for missing keys and constructor defaults.
 * @returns A schema helper when data-last, or the schema with defaults applied
 * when data-first.
 * @category utilities
 * @since 0.0.0
 */
export const withKeyDefaults: {
  <const TSchema extends S.Top & S.WithoutConstructorDefault>(
    defaultValue: TSchema["~type.make.in"] & TSchema["Type"]
  ): (self: TSchema) => S.withDecodingDefaultTypeKey<S.withConstructorDefault<TSchema>>;
  <const TSchema extends S.Top & S.WithoutConstructorDefault>(
    self: TSchema,
    defaultValue: TSchema["~type.make.in"] & TSchema["Type"]
  ): S.withDecodingDefaultTypeKey<S.withConstructorDefault<TSchema>>;
} = dual(
  2,
  <const TSchema extends S.Top & S.WithoutConstructorDefault>(
    self: TSchema,
    defaultValue: TSchema["~type.make.in"] & TSchema["Type"]
  ): S.withDecodingDefaultTypeKey<S.withConstructorDefault<TSchema>> =>
    pipe(
      self,
      S.withConstructorDefault(Effect.succeed(defaultValue)),
      S.withDecodingDefaultTypeKey(Effect.succeed(defaultValue))
    )
);

const applyEmptyArrayDefaults = <
  TValue,
  const TSchema extends S.$Array<S.Schema<TValue>> & S.WithoutConstructorDefault,
>(
  self: TSchema
): S.withDecodingDefaultType<S.withConstructorDefault<TSchema>> => {
  const defaultValue = A.empty<TValue>();
  const withConstructorDefault = S.withConstructorDefault(Effect.succeed(defaultValue))(
    self
  ) as S.withConstructorDefault<TSchema>;
  return S.withDecodingDefaultType(Effect.succeed(defaultValue))(withConstructorDefault) as S.withDecodingDefaultType<
    S.withConstructorDefault<TSchema>
  >;
};

/**
 * Apply empty readonly-array defaults for constructor creation and missing
 * value decoding.
 *
 * This helper is intended for array fields whose default should be
 * `A.empty<TValue>()`. It keeps the element schema inference from the provided
 * array schema while avoiding repeated default wiring at each call site.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 * import * as S from "effect/Schema"
 * import { withEmptyArrayDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Tags = S.Array(S.String).pipe(withEmptyArrayDefaults<string>())
 * const Settings = S.Struct({ tags: Tags })
 * const settings = S.decodeUnknownSync(Settings)({})
 *
 * console.log(A.isReadonlyArrayEmpty(settings.tags)) // true
 * ```
 *
 * @typeParam TValue - Element value type used for the empty array default.
 * @param self - Array schema receiving empty constructor and decoding defaults.
 * @returns A schema helper when data-last, or the array schema with empty
 * defaults applied when data-first.
 * @category constructors
 * @since 0.0.0
 */
export function withEmptyArrayDefaults<TValue>(): <
  const TSchema extends S.$Array<S.Schema<TValue>> & S.WithoutConstructorDefault,
>(
  self: TSchema
) => S.withDecodingDefaultType<S.withConstructorDefault<TSchema>>;
/**
 * Apply empty readonly-array defaults directly to an array schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { withEmptyArrayDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Tags = withEmptyArrayDefaults<string>(S.Array(S.String))
 * const Settings = S.Struct({ tags: Tags })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).tags.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export function withEmptyArrayDefaults<
  TValue,
  const TSchema extends S.$Array<S.Schema<TValue>> & S.WithoutConstructorDefault = S.$Array<S.Schema<TValue>> &
    S.WithoutConstructorDefault,
>(self: TSchema): S.withDecodingDefaultType<S.withConstructorDefault<TSchema>>;
/**
 * Apply empty readonly-array defaults in data-first or data-last form.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { withEmptyArrayDefaults } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Tags = S.Array(S.String).pipe(withEmptyArrayDefaults<string>())
 * const Settings = S.Struct({ tags: Tags })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).tags.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export function withEmptyArrayDefaults<
  TValue,
  const TSchema extends S.$Array<S.Schema<TValue>> & S.WithoutConstructorDefault,
>(self?: TSchema) {
  return P.isUndefined(self)
    ? applyEmptyArrayDefaults<TValue, TSchema>
    : applyEmptyArrayDefaults<TValue, TSchema>(self);
}

/**
 * Create a boolean schema field with a shared constructor and missing-key
 * default.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { boolKeyWithDefault } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Enabled = boolKeyWithDefault(true)
 * const Settings = S.Struct({ enabled: Enabled })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).enabled) // true
 * ```
 *
 * @param defaultValue - Boolean value used when constructing or decoding a
 * missing key.
 * @returns A boolean schema with constructor and decoding defaults applied.
 * @category constructors
 * @since 0.0.0
 */
export const boolKeyWithDefault = (defaultValue: boolean) => withKeyDefaults(S.Boolean, defaultValue);

/**
 * Boolean schema field that defaults constructor input and missing keys to
 * `false`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoolKeyDefaultFalse } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Settings = S.Struct({ visible: BoolKeyDefaultFalse })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).visible) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolKeyDefaultFalse = boolKeyWithDefault(false).pipe(
  $I.annoteSchema("BoolKeyDefaultFalse", {
    description: "Boolean schema field that defaults constructor input and missing keys to false.",
  })
);

/**
 * {@inheritDoc BoolKeyDefaultFalse}
 *
 * @example
 * ```ts
 * import type { BoolKeyDefaultFalse } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const visible: BoolKeyDefaultFalse = false
 * console.log(visible)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoolKeyDefaultFalse = typeof BoolKeyDefaultFalse.Type;

/**
 * Boolean schema field that defaults constructor input and missing keys to
 * `true`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoolKeyDefaultTrue } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const Settings = S.Struct({ enabled: BoolKeyDefaultTrue })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).enabled) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolKeyDefaultTrue = boolKeyWithDefault(true).pipe(
  $I.annoteSchema("BoolKeyDefaultTrue", {
    description: "Boolean schema field that defaults constructor input and missing keys to true.",
  })
);

/**
 * {@inheritDoc BoolKeyDefaultTrue}
 *
 * @example
 * ```ts
 * import type { BoolKeyDefaultTrue } from "@beep/schema/SchemaUtils/withKeyDefaults"
 *
 * const enabled: BoolKeyDefaultTrue = true
 * console.log(enabled)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BoolKeyDefaultTrue = typeof BoolKeyDefaultTrue.Type;
