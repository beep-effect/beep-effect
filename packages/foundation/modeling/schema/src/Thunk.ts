/**
 * Thunk-oriented schema helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { Brand } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Thunk");

/**
 * Unique brand identifier tag for {@link ThunkUnknown} values.
 *
 * **Example** (TypeId brand equality)
 *
 * ```ts import.meta.vitest name="TypeId brand equality"
 * import { TypeId, nominal } from "@beep/schema/Thunk"
 *
 * const typeId: typeof TypeId = TypeId
 * const thunk = nominal(() => "ready")
 * typeId === TypeId && thunk() === "ready" // => true
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export const TypeId = $I`ThunkUnknown`;

/**
 * Type for {@link TypeId}.
 *
 * **Example** (TypeId type satisfaction)
 *
 * ```ts import.meta.vitest name="TypeId type satisfaction"
 * import { TypeId, type TypeId as TypeIdType } from "@beep/schema/Thunk"
 *
 * const typeId = TypeId satisfies TypeIdType
 * typeId === TypeId // => true
 * ```
 *
 * @category type-ids
 * @since 0.0.0
 */
export type TypeId = typeof TypeId;

/**
 * Branded thunk type -- a zero-argument function returning `A`, branded with
 * {@link TypeId}.
 *
 * **Example** (Satisfy ThunkUnknown type)
 *
 * ```ts
 * import { nominal, type ThunkUnknown } from "@beep/schema/Thunk"
 *
 * const thunk = nominal(() => "ready") satisfies ThunkUnknown
 * console.log(thunk())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ThunkUnknown<A = unknown> = Brand.Branded<() => A, TypeId>;

const isThunkUnknownValue = (u: unknown): u is () => unknown => P.isFunction(u);

/**
 * Brand constructor that validates and brands a value as {@link ThunkUnknown}.
 *
 * **Example** (Brand zero-arg function)
 *
 * ```ts
 * import { nominal } from "@beep/schema/Thunk"
 *
 * const thunk = nominal(() => 42)
 * console.log(thunk)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const nominal = Brand.make<ThunkUnknown>(isThunkUnknownValue);

/**
 * Schema that validates a value is a zero-argument function and brands it with
 * {@link TypeId}. Provides a `.generic` helper for creating typed thunk schemas.
 *
 * **Example** (Decode unknown as thunk)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ThunkUnknown } from "@beep/schema/Thunk"
 *
 * const thunk = S.decodeUnknownSync(ThunkUnknown)(() => "hello")
 * console.log(thunk)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const ThunkUnknown = S.declare<() => unknown>(isThunkUnknownValue).pipe(
  S.fromBrand(TypeId, nominal),
  $I.annoteSchema("ThunkUnknown", {
    description: "A schema for a function that returns a value.",
  }),
  SchemaUtils.withCodecStatics(["is"]),
  SchemaUtils.withStatics(() => ({
    generic: <A = never>(guard: (u: unknown) => u is () => A) => S.declare<() => A>(guard),
  }))
);

/**
 * Type guard that checks whether a value satisfies the {@link ThunkUnknown}
 * schema.
 *
 * **Example** (Guard function and string)
 *
 * ```ts import.meta.vitest name="Guard function and string"
 * import { isThunkUnknown } from "@beep/schema/Thunk"
 *
 * isThunkUnknown(() => 1) // => true
 * isThunkUnknown("hello") // => false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isThunkUnknown = ThunkUnknown.is;

type ThunkGuard<TSchema extends S.Top> = (u: unknown) => u is () => S.Schema.Type<TSchema>;

type ThunkSchema<TSchema extends S.Top> = S.declare<() => S.Schema.Type<TSchema>>;

/**
 * Builds a typed thunk schema from a type guard and a return-type schema
 * witness. The return schema is type-level only; validating it would require
 * invoking the thunk. Supports both data-first and data-last calling
 * conventions.
 *
 * **Example** (Make string thunk schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as P from "effect/Predicate"
 * import { make } from "@beep/schema/Thunk"
 *
 * const isStringThunk = (u: unknown): u is () => string =>
 *   P.isFunction(u) && P.isString(u())
 *
 * const StringThunk = make(isStringThunk, S.String)
 * console.log(StringThunk)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const make: {
  <TSchema extends S.Top>(returnSchema: TSchema): (guard: ThunkGuard<TSchema>) => ThunkSchema<TSchema>;
  <TSchema extends S.Top>(guard: ThunkGuard<TSchema>, returnSchema: TSchema): ThunkSchema<TSchema>;
} = dual(
  2,
  <TSchema extends S.Top>(guard: ThunkGuard<TSchema>, _returnSchema: TSchema): ThunkSchema<TSchema> =>
    S.declare<() => S.Schema.Type<TSchema>>(guard)
);

/**
 * Schema instance returned by {@link make} for a specific return schema.
 *
 * **Example** (Typed Instance from make)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import * as S from "effect/Schema"
 * import { make, type Instance } from "@beep/schema/Thunk"
 *
 * type StringThunk = Instance<typeof S.String>
 * const schema: StringThunk = make(
 *   (u: unknown): u is () => string => P.isFunction(u) && P.isString(u()),
 *   S.String
 * )
 * console.log(schema)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Instance<TSchema extends S.Top> = S.declare<() => S.Schema.Type<TSchema>>;
