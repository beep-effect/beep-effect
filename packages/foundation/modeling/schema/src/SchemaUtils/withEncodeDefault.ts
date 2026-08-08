/**
 * Decoding-default helpers for optional encoded keys.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { Effect, pipe, SchemaGetter } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $SchemaId.create("SchemaUtils/withEncodeDefault");

/**
 * Apply a decoding default to an optional encoded key.
 *
 * **Details**
 *
 * This helper makes the encoded key optional and fills in a decoded value when
 * the key is missing. Encoding remains strict and still requires the decoded
 * value to be present.
 *
 * This is the decoded-value counterpart to Effect's
 * `Schema.withDecodingDefaultKey`: the default thunk returns the schema's
 * decoded `Type`, not its encoded representation.
 *
 * **Example** (Default for missing encoded key)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { withEncodeDefault } from "@beep/schema/SchemaUtils/withEncodeDefault"
 *
 * const Status = withEncodeDefault(S.String, () => "draft")
 * const Settings = S.Struct({ status: Status })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).status) // "draft"
 * ```
 *
 * @typeParam TSchema - Schema receiving the decoding default.
 * @param self - Schema receiving the decoding default.
 * @param defaultValue - Lazy default value used when the encoded key is missing.
 * @returns A schema helper when data-last, or the schema with the decoding
 * default applied when data-first.
 * @category utilities
 * @since 0.0.0
 */
export const withEncodeDefault: {
  <const TSchema extends S.Top>(
    self: TSchema,
    defaultValue: () => TSchema["Type"]
  ): S.decodeTo<S.toType<TSchema>, S.optionalKey<TSchema>>;
  <const TSchema extends S.Top>(
    defaultValue: () => TSchema["Type"]
  ): (self: TSchema) => S.decodeTo<S.toType<TSchema>, S.optionalKey<TSchema>>;
} = dual(
  2,
  <const TSchema extends S.Top>(
    self: TSchema,
    defaultValue: () => TSchema["Type"]
  ): S.decodeTo<S.toType<TSchema>, S.optionalKey<TSchema>> =>
    pipe(
      self,
      S.optionalKey,
      S.decodeTo(S.toType(self), {
        decode: SchemaGetter.withDefault(Effect.sync(defaultValue)),
        encode: SchemaGetter.required(),
      })
    )
);

/**
 * Create a boolean schema field with a lazy decoding default.
 *
 * **Example** (Boolean field with default)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { boolWithDefault } from "@beep/schema/SchemaUtils/withEncodeDefault"
 *
 * const Enabled = boolWithDefault(true)
 * const Settings = S.Struct({ enabled: Enabled })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).enabled) // true
 * ```
 *
 * @param defaultValue - Boolean value returned when the encoded key is missing.
 * @returns A boolean schema with a decoding default applied.
 * @category constructors
 * @since 0.0.0
 */
export const boolWithDefault = (defaultValue: boolean) => withEncodeDefault(S.Boolean, () => defaultValue);

/**
 * Boolean schema field that decodes missing keys as `false`.
 *
 * **Example** (Missing key decodes false)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoolDefaultFalse } from "@beep/schema/SchemaUtils/withEncodeDefault"
 *
 * const Settings = S.Struct({ visible: BoolDefaultFalse })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).visible) // false
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolDefaultFalse = boolWithDefault(false).pipe(
  $I.annoteSchema("BoolDefaultFalse", {
    description: "Boolean schema field that decodes missing keys as false.",
  })
);

/**
 * {@inheritDoc BoolDefaultFalse}
 * @category models
 * @since 0.0.0
 */
export type BoolDefaultFalse = typeof BoolDefaultFalse.Type;

/**
 * Boolean schema field that decodes missing keys as `true`.
 *
 * **Example** (Missing key decodes true)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BoolDefaultTrue } from "@beep/schema/SchemaUtils/withEncodeDefault"
 *
 * const Settings = S.Struct({ enabled: BoolDefaultTrue })
 *
 * console.log(S.decodeUnknownSync(Settings)({}).enabled) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BoolDefaultTrue = boolWithDefault(true).pipe(
  $I.annoteSchema("BoolDefaultTrue", {
    description: "Boolean schema field that decodes missing keys as true.",
  })
);

/**
 * {@inheritDoc BoolDefaultTrue}
 * @category models
 * @since 0.0.0
 */
export type BoolDefaultTrue = typeof BoolDefaultTrue.Type;
