/**
 * Constructor-only default combinators.
 *
 * Unlike {@link withKeyDefaults} (which also makes the encoded key optional and
 * supplies a decoding default), these helpers attach a default that is applied
 * **only** during `make`/`makeEffect`. The encoded/wire contract is left
 * untouched, so a field that is always present on the wire can still be omitted
 * at construction time without widening its decoded shape.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

/**
 * Attach an `Option.none()` constructor default to an `Option`-typed schema
 * field, so the field can be omitted when constructing a value.
 *
 * **Details**
 *
 * The decode behaviour is unchanged: schemas such as `Schema.OptionFromOptional`
 * and `Schema.OptionFromNullOr` already decode a missing/`null` value to `None`.
 * This only removes the obligation to pass `Option.none()` explicitly at every
 * `make` call site (the `*Defaults` spread-object smell).
 *
 * **Example** (Omitting Option at construction)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { withNoneDefault } from "@beep/schema/SchemaUtils/withConstructorDefaults"
 *
 * const Node = S.Struct({
 *   label: S.OptionFromOptionalKey(S.String).pipe(withNoneDefault)
 * })
 *
 * console.log(O.isNone(Node.make({}).label)) // true
 * ```
 *
 * @typeParam A - Element type carried by the field's `Option`.
 * @param self - `Option`-typed schema field receiving the `none` constructor default.
 * @returns The schema with an `Option.none()` constructor default applied.
 * @category constructors
 * @since 0.0.0
 */
export const withNoneDefault = <
  A,
  const TSchema extends S.Top & S.WithoutConstructorDefault & { readonly "~type.make.in": O.Option<A> },
>(
  self: TSchema
): S.withConstructorDefault<TSchema> => self.pipe(S.withConstructorDefault(Effect.succeed<O.Option<A>>(O.none())));

/**
 * Attach a constant constructor default to a schema field, so the field can be
 * omitted when constructing a value while its encoded/wire contract is left
 * unchanged.
 *
 * **Details**
 *
 * Use this for fields that are always present on the wire but carry a single
 * canonical value at construction time (e.g. a serialized node `version: 1` or
 * an alignment `format: ""`), to delete the per-call default boilerplate.
 *
 * **Example** (Constant constructor default)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { withConstantDefault } from "@beep/schema/SchemaUtils/withConstructorDefaults"
 *
 * const Node = S.Struct({
 *   version: S.Literal(1).pipe(withConstantDefault(1))
 * })
 *
 * console.log(Node.make({}).version) // 1
 * ```
 *
 * @typeParam A - Default value type, which must satisfy the field's make input.
 * @param defaultValue - Constant value used when the field is omitted at construction time.
 * @returns A schema helper that applies the constant constructor default.
 * @category constructors
 * @since 0.0.0
 */
export const withConstantDefault =
  <const A>(defaultValue: A) =>
  <const TSchema extends S.Top & S.WithoutConstructorDefault & { readonly "~type.make.in": A }>(
    self: TSchema
  ): S.withConstructorDefault<TSchema> =>
    self.pipe(S.withConstructorDefault(Effect.succeed<A>(defaultValue)));
