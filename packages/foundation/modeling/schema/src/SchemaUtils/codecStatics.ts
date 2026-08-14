/**
 * Attach a runner-specific Effect Schema codec group to a schema value, along
 * with the shared `asserts`, `is`, and `equivalence` statics.
 *
 * Each combinator binds one decode/encode interpreter — Effect, Result,
 * Option, Exit, Promise, or Sync — so consuming modules call
 * `MySchema.decodeUnknownEffect(raw)` instead of accumulating free-floating
 * `const decodeX = S.decodeUnknownEffect(X)` helpers.
 *
 * Intended for branded, refined, and union const schemas. `Schema.Class` and
 * `Schema.TaggedClass` lose their constructor identity when piped, so concrete
 * classes should attach the same statics in-body.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import { toEquivalence } from "./toEquivalence.ts";
import { withStatics } from "./withStatics.ts";
import type { DualEquivalence } from "./toEquivalence.ts";

/**
 * Schema that can be both decoded and encoded without Effect services.
 *
 * Sync, Exit, Option, Result, and Promise runners require this bound.
 */
type ServiceFreeCodec<Sch extends S.Constraint> = S.Schema<Sch["Type"]> &
  S.ConstraintDecoder<unknown> &
  S.ConstraintEncoder<unknown>;

/**
 * Schema that can be decoded and encoded, including those that require
 * Effect services.
 */
type EffectCapableCodec<Sch extends S.Constraint> = S.Schema<Sch["Type"]> & S.Constraint;

/**
 * Guard, assertion, and dual equivalence statics attached by every codec group.
 *
 * **Details**
 *
 * `S.asserts` is data-first and uncurried, so `asserts` is a schema-bound
 * wrapper with the same call shape as `is`. `equivalence` is the dual helper
 * from {@link toEquivalence}, not `S.toEquivalence`.
 *
 * @typeParam Sch - Schema the statics guard, assert, and compare.
 * @see {@link toEquivalence} for the dual equivalence attached as `equivalence`.
 * @category models
 * @since 0.0.0
 */
export interface SharedCodecStatics<Sch extends S.Constraint> {
  /**
   * Assert that an unknown value is a decoded `Sch["Type"]`, throwing on
   * failure.
   *
   * @since 0.0.0
   */
  asserts(input: unknown): asserts input is Sch["Type"];
  /**
   * Dual equivalence for decoded values of `Sch`.
   *
   * @since 0.0.0
   */
  readonly equivalence: DualEquivalence<Sch["Type"]>;
  /**
   * Type guard for decoded values of `Sch`.
   *
   * @since 0.0.0
   */
  readonly is: ReturnType<typeof S.is<Sch>>;
}

/**
 * Shared statics plus the throwing synchronous decode/encode quartet.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withSyncCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface SyncCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeSync: ReturnType<typeof S.decodeSync<Sch>>;
  readonly decodeUnknownSync: ReturnType<typeof S.decodeUnknownSync<Sch>>;
  readonly encodeSync: ReturnType<typeof S.encodeSync<Sch>>;
  readonly encodeUnknownSync: ReturnType<typeof S.encodeUnknownSync<Sch>>;
}

/**
 * Shared statics plus the Promise decode/encode quartet.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withPromiseCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface PromiseCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodePromise: ReturnType<typeof S.decodePromise<Sch>>;
  readonly decodeUnknownPromise: ReturnType<typeof S.decodeUnknownPromise<Sch>>;
  readonly encodePromise: ReturnType<typeof S.encodePromise<Sch>>;
  readonly encodeUnknownPromise: ReturnType<typeof S.encodeUnknownPromise<Sch>>;
}

/**
 * Shared statics plus the Effect decode/encode quartet.
 *
 * @typeParam Sch - Schema the statics interpret, including service-requiring codecs.
 * @see {@link withEffectCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface EffectCodecStatics<Sch extends EffectCapableCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeEffect: ReturnType<typeof S.decodeEffect<Sch>>;
  readonly decodeUnknownEffect: ReturnType<typeof S.decodeUnknownEffect<Sch>>;
  readonly encodeEffect: ReturnType<typeof S.encodeEffect<Sch>>;
  readonly encodeUnknownEffect: ReturnType<typeof S.encodeUnknownEffect<Sch>>;
}

/**
 * Shared statics plus the Exit decode/encode quartet.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withExitCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface ExitCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeExit: ReturnType<typeof S.decodeExit<Sch>>;
  readonly decodeUnknownExit: ReturnType<typeof S.decodeUnknownExit<Sch>>;
  readonly encodeExit: ReturnType<typeof S.encodeExit<Sch>>;
  readonly encodeUnknownExit: ReturnType<typeof S.encodeUnknownExit<Sch>>;
}

/**
 * Shared statics plus the Option decode/encode quartet.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withOptionCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface OptionCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeOption: ReturnType<typeof S.decodeOption<Sch>>;
  readonly decodeUnknownOption: ReturnType<typeof S.decodeUnknownOption<Sch>>;
  readonly encodeOption: ReturnType<typeof S.encodeOption<Sch>>;
  readonly encodeUnknownOption: ReturnType<typeof S.encodeUnknownOption<Sch>>;
}

/**
 * Shared statics plus the Result decode/encode quartet.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withResultCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface ResultCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeResult: ReturnType<typeof S.decodeResult<Sch>>;
  readonly decodeUnknownResult: ReturnType<typeof S.decodeUnknownResult<Sch>>;
  readonly encodeResult: ReturnType<typeof S.encodeResult<Sch>>;
  readonly encodeUnknownResult: ReturnType<typeof S.encodeUnknownResult<Sch>>;
}

const makeSharedCodecStatics = <Sch extends S.Schema<Sch["Type"]> & S.Constraint>(
  schema: Sch
): SharedCodecStatics<Sch> => {
  function asserts(input: unknown): asserts input is Sch["Type"] {
    S.asserts(schema, input);
  }

  return {
    asserts,
    equivalence: toEquivalence(schema),
    is: S.is(schema),
  };
};

const attachCodecStatics =
  <Sch extends S.Schema<Sch["Type"]> & S.Constraint, Extra extends Record<string, unknown>>(
    extra: (schema: Sch) => Extra
  ) =>
  (self: Sch): Sch & SharedCodecStatics<Sch> & Extra =>
    withStatics((schema: Sch) => ({
      ...makeSharedCodecStatics(schema),
      ...extra(schema),
    }))(self);

/**
 * Attach {@link SyncCodecStatics} to a schema value. Designed to be used with
 * `.pipe()` (it is unary, so `schema.pipe(withSyncCodecStatics)` and
 * `withSyncCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when a trusted synchronous boundary should throw `SchemaError` and the
 * decode/encode pair should live on the schema instead of as free helpers.
 *
 * **Gotchas**
 *
 * Prefer {@link withEffectCodecStatics} in library code. This group throws on
 * schema mismatches and only accepts service-free schemas. Distinct from
 * {@link withCodecStatics}, which attaches `is`, `fromUnknown`, and
 * `decodeOption` only.
 *
 * **Example** (Attach sync codec statics via pipe)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { withSyncCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withSyncCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(Count.decodeUnknownSync("42")) // 42
 * console.log(Count.encodeSync(42)) // "42"
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the sync codec statics.
 * @param self - The schema receiving the sync codec statics.
 * @returns The schema with shared statics plus the sync decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @see {@link withEffectCodecStatics} for the Effect-returning group preferred in library code.
 * @category combinators
 * @since 0.0.0
 */
export const withSyncCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & SyncCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodeSync: S.decodeSync(schema),
    decodeUnknownSync: S.decodeUnknownSync(schema),
    encodeSync: S.encodeSync(schema),
    encodeUnknownSync: S.encodeUnknownSync(schema),
  }))(self);

/**
 * Attach {@link PromiseCodecStatics} to a schema value. Designed to be used
 * with `.pipe()` (it is unary, so `schema.pipe(withPromiseCodecStatics)` and
 * `withPromiseCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when a JavaScript `Promise` boundary needs schema-bound decode/encode
 * functions that reject with `SchemaError`.
 *
 * **Gotchas**
 *
 * Prefer {@link withEffectCodecStatics} in library code. Promise runners reject
 * on schema mismatches and only accept service-free schemas.
 *
 * **Example** (Attach Promise codec statics via pipe)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { withPromiseCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withPromiseCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(await Count.decodeUnknownPromise("42")) // 42
 * console.log(await Count.encodePromise(42)) // "42"
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Promise codec statics.
 * @param self - The schema receiving the Promise codec statics.
 * @returns The schema with shared statics plus the Promise decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withPromiseCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & PromiseCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodePromise: S.decodePromise(schema),
    decodeUnknownPromise: S.decodeUnknownPromise(schema),
    encodePromise: S.encodePromise(schema),
    encodeUnknownPromise: S.encodeUnknownPromise(schema),
  }))(self);

/**
 * Attach {@link EffectCodecStatics} to a schema value. Designed to be used
 * with `.pipe()` (it is unary, so `schema.pipe(withEffectCodecStatics)` and
 * `withEffectCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when library or application code should decode and encode through
 * `Effect`, including schemas that require decoding or encoding services.
 *
 * **Example** (Attach Effect codec statics via pipe)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { withEffectCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withEffectCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(await Effect.runPromise(Count.decodeUnknownEffect("42"))) // 42
 * console.log(await Effect.runPromise(Count.encodeEffect(42))) // "42"
 * ```
 *
 * @typeParam Sch - Schema receiving the Effect codec statics.
 * @param self - The schema receiving the Effect codec statics.
 * @returns The schema with shared statics plus the Effect decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withEffectCodecStatics = <Sch extends EffectCapableCodec<Sch>>(self: Sch): Sch & EffectCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodeEffect: S.decodeEffect(schema),
    decodeUnknownEffect: S.decodeUnknownEffect(schema),
    encodeEffect: S.encodeEffect(schema),
    encodeUnknownEffect: S.encodeUnknownEffect(schema),
  }))(self);

/**
 * Attach {@link ExitCodecStatics} to a schema value. Designed to be used with
 * `.pipe()` (it is unary, so `schema.pipe(withExitCodecStatics)` and
 * `withExitCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when a synchronous boundary should capture success or failure as
 * `Exit` without throwing.
 *
 * **Gotchas**
 *
 * Only service-free schemas can be interpreted as `Exit`. Schema mismatches
 * become a failed `Exit` whose cause contains `SchemaError`.
 *
 * **Example** (Attach Exit codec statics via pipe)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { withExitCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withExitCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(Exit.isSuccess(Count.decodeUnknownExit("42"))) // true
 * console.log(Exit.isSuccess(Count.encodeExit(42))) // true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Exit codec statics.
 * @param self - The schema receiving the Exit codec statics.
 * @returns The schema with shared statics plus the Exit decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withExitCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & ExitCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodeExit: S.decodeExit(schema),
    decodeUnknownExit: S.decodeUnknownExit(schema),
    encodeExit: S.encodeExit(schema),
    encodeUnknownExit: S.encodeUnknownExit(schema),
  }))(self);

/**
 * Attach {@link OptionCodecStatics} to a schema value. Designed to be used
 * with `.pipe()` (it is unary, so `schema.pipe(withOptionCodecStatics)` and
 * `withOptionCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when a soft boundary should treat schema mismatches as `None` and the
 * decode/encode pair should live on the schema.
 *
 * **Gotchas**
 *
 * Only service-free schemas can be interpreted as `Option`. Causes that
 * contain defects or interruptions throw instead of becoming `None`.
 *
 * **Example** (Attach Option codec statics via pipe)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { withOptionCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withOptionCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(O.isSome(Count.decodeUnknownOption("42"))) // true
 * console.log(O.isNone(Count.decodeUnknownOption(null))) // true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Option codec statics.
 * @param self - The schema receiving the Option codec statics.
 * @returns The schema with shared statics plus the Option decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withOptionCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & OptionCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodeOption: S.decodeOption(schema),
    decodeUnknownOption: S.decodeUnknownOption(schema),
    encodeOption: S.encodeOption(schema),
    encodeUnknownOption: S.encodeUnknownOption(schema),
  }))(self);

/**
 * Attach {@link ResultCodecStatics} to a schema value. Designed to be used
 * with `.pipe()` (it is unary, so `schema.pipe(withResultCodecStatics)` and
 * `withResultCodecStatics(schema)` are equivalent).
 *
 * **When to use**
 *
 * Use when a synchronous boundary should return `Result` with `SchemaError`
 * instead of throwing, and the decode/encode pair should live on the schema.
 *
 * **Gotchas**
 *
 * Only service-free schemas can be interpreted as `Result`. Causes that
 * contain defects or interruptions throw instead of becoming `Result.fail`.
 *
 * **Example** (Attach Result codec statics via pipe)
 *
 * ```ts
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { withResultCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withResultCodecStatics)
 *
 * console.log(Count.is(42)) // true
 * console.log(Result.isSuccess(Count.decodeUnknownResult("42"))) // true
 * console.log(Result.isFailure(Count.decodeUnknownResult(null))) // true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Result codec statics.
 * @param self - The schema receiving the Result codec statics.
 * @returns The schema with shared statics plus the Result decode/encode quartet.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withResultCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & ResultCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => ({
    decodeResult: S.decodeResult(schema),
    decodeUnknownResult: S.decodeUnknownResult(schema),
    encodeResult: S.encodeResult(schema),
    encodeUnknownResult: S.encodeUnknownResult(schema),
  }))(self);
