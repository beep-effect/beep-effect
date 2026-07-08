/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { Brand } from "effect/Brand";
/**
 * Marks a value as an explicit override for an overridable schema field.
 *
 * @example
 * ```ts
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 *
 * const value = VariantSchema.Override("custom")
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Override = <A>(value: A): A & Brand<"Override"> => value as A & Brand<"Override">;

/**
 * Schema type for fields that receive an Effect-backed constructor default but
 * can still be supplied explicitly as overrides.
 *
 * @example
 * ```ts
 * import type { Overridable } from "@beep/schema/VariantSchema"
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const field: Overridable<typeof S.String> = VariantSchema.Overridable(S.String, {
 *   defaultValue: Effect.succeed("generated")
 * })
 * console.log(S.isSchema(field))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export interface Overridable<S extends S.Top & S.WithoutConstructorDefault>
  extends S.Bottom<
    S["Type"] & Brand<"Override">,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    Overridable<S>,
    S["~type.make.in"],
    (S["Type"] & Brand<"Override">) | undefined,
    S["~type.parameters"],
    (S["Type"] & Brand<"Override">) | undefined,
    S["~type.mutability"],
    "required",
    "with-default",
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  > {}

/**
 * Adds an Effect-backed constructor default while preserving explicit override
 * values.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 *
 * const field = VariantSchema.Overridable(S.String, {
 *   defaultValue: Effect.succeed("generated")
 * })
 *
 * console.log(S.isSchema(field))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Overridable: {
  <S extends S.Top & S.WithoutConstructorDefault>(options: {
    readonly defaultValue: Effect.Effect<S["~type.make.in"]>;
  }): (schema: S) => Overridable<S>;
  <S extends S.Top & S.WithoutConstructorDefault>(
    schema: S,
    options: {
      readonly defaultValue: Effect.Effect<S["~type.make.in"]>;
    }
  ): Overridable<S>;
} = dual(
  2,
  <S extends S.Top & S.WithoutConstructorDefault>(
    schema: S,
    options: {
      readonly defaultValue: Effect.Effect<S["~type.make.in"]>;
    }
  ): Overridable<S> =>
    schema.pipe(
      S.decodeTo(S.toType(schema).pipe(S.brand("Override"))),
      S.withConstructorDefault(Effect.map(options.defaultValue, Override))
    ) as Overridable<S>
);

/**
 * Upstream-compatible alias for {@link Overridable}.
 *
 * @example
 * ```ts
 * import type { Overrideable } from "@beep/schema/VariantSchema"
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const field: Overrideable<typeof S.String> = VariantSchema.Overrideable(S.String, {
 *   defaultValue: Effect.succeed("generated")
 * })
 * console.log(S.isSchema(field))
 * ```
 *
 * @example
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 *
 * const field = VariantSchema.Overrideable(S.String, {
 *   defaultValue: Effect.succeed("generated")
 * })
 *
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export interface Overrideable<S extends S.Top & S.WithoutConstructorDefault>
  extends S.Bottom<
    S["Type"] & Brand<"Override">,
    S["Encoded"],
    S["DecodingServices"],
    S["EncodingServices"],
    S["ast"],
    Overridable<S>,
    S["~type.make.in"],
    (S["Type"] & Brand<"Override">) | undefined,
    S["~type.parameters"],
    (S["Type"] & Brand<"Override">) | undefined,
    S["~type.mutability"],
    "required",
    "with-default",
    S["~encoded.mutability"],
    S["~encoded.optionality"]
  > {}

/**
 * Upstream-compatible alias for {@link Overridable}.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import * as VariantSchema from "@beep/schema/VariantSchema"
 *
 * const field = VariantSchema.Overrideable(S.String, {
 *   defaultValue: Effect.succeed("generated")
 * })
 *
 * console.log(S.isSchema(field))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Overrideable: typeof Overridable = Overridable;
