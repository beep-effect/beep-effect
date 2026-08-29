/**
 * Optional-key schema helper with decoded defaults.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { Effect, SchemaGetter } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

/**
 * Creates an optional encoded key that decodes to a required value.
 *
 * **Details**
 *
 * This is a v4 replacement for
 * `S.optionalWith(schema, { exact: true, default: () => value })`. Missing
 * keys decode to `defaultValue`, but encoding still requires a decoded value
 * because the encoded side uses `SchemaGetter.required()`.
 *
 * **Example** (Defaulting a missing optional key)
 *
 * ```ts import.meta.vitest name="Defaulting a missing optional key"
 * import * as S from "effect/Schema"
 * import { optionalKeyWithDefault } from "@beep/schema/SchemaUtils/optionalKeyWithDefaults"
 *
 * const Settings = S.Struct({ label: optionalKeyWithDefault(S.String, "draft") })
 * const settings = S.decodeUnknownSync(Settings)({})
 *
 * settings.label // => "draft"
 * ```
 *
 * @param schema - Schema for the required decoded value.
 * @param defaultValue - Decoded value used when the encoded key is absent.
 * @category utilities
 * @since 0.0.0
 */
export const optionalKeyWithDefault: {
  <S extends S.Top>(schema: S, defaultValue: S["Type"]): S.decodeTo<S.toType<S>, S.optionalKey<S>>;
  <S extends S.Top>(defaultValue: S["Type"]): (schema: S) => S.decodeTo<S.toType<S>, S.optionalKey<S>>;
} = dual(
  2,
  <S extends S.Top>(schema: S, defaultValue: S["Type"]): S.decodeTo<S.toType<S>, S.optionalKey<S>> =>
    S.optionalKey(schema).pipe(
      S.decodeTo(S.toType(schema), {
        decode: SchemaGetter.withDefault(Effect.succeed(defaultValue)),
        encode: SchemaGetter.required(),
      })
    )
);
