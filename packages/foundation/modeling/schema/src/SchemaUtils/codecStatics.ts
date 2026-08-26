/**
 * Attach a runner-specific Effect Schema codec group to a schema value, along
 * with the shared `asserts`, `is`, and `equivalence` statics.
 *
 * **Details**
 *
 * Each combinator binds one decode/encode interpreter — Effect, Result,
 * Option, Exit, Promise, or Sync — for both direct values and JSON strings, so
 * consuming modules call `MySchema.decodeUnknownEffect(raw)` or
 * `MySchema.decodeUnknownEffectFromJsonString(raw)` instead of accumulating
 * free-floating codec helpers.
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
import type { SchemaAST } from "effect";
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

type JsonStringCodec<Sch extends S.Constraint> = S.fromJsonString<Sch>;

/**
 * Per-call options for JSON-string codec statics.
 *
 * **Details**
 *
 * JSON parsing and stringification options configure `S.fromJsonString`, while
 * parse options configure the selected decode or encode runner. Supplying one
 * object applies both sets of options to the same invocation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JsonStringCodecOptions = SchemaAST.ParseOptions & NonNullable<Parameters<typeof S.fromJsonString>[1]>;

type ConfigurableJsonStringRunner<Runner> = Runner extends (
  input: infer Input,
  options?: SchemaAST.ParseOptions
) => infer Output
  ? (input: Input, options?: JsonStringCodecOptions) => Output
  : never;

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
 * Shared statics plus synchronous codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withSyncCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface SyncCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeSync: ReturnType<typeof S.decodeSync<Sch>>;
  readonly decodeSyncFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeSync<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownSync: ReturnType<typeof S.decodeUnknownSync<Sch>>;
  readonly decodeUnknownSyncFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownSync<JsonStringCodec<Sch>>>
  >;
  readonly encodeSync: ReturnType<typeof S.encodeSync<Sch>>;
  readonly encodeSyncFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeSync<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownSync: ReturnType<typeof S.encodeUnknownSync<Sch>>;
  readonly encodeUnknownSyncFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownSync<JsonStringCodec<Sch>>>
  >;
}

/**
 * Shared statics plus Promise codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withPromiseCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface PromiseCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodePromise: ReturnType<typeof S.decodePromise<Sch>>;
  readonly decodePromiseFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodePromise<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownPromise: ReturnType<typeof S.decodeUnknownPromise<Sch>>;
  readonly decodeUnknownPromiseFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownPromise<JsonStringCodec<Sch>>>
  >;
  readonly encodePromise: ReturnType<typeof S.encodePromise<Sch>>;
  readonly encodePromiseFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodePromise<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownPromise: ReturnType<typeof S.encodeUnknownPromise<Sch>>;
  readonly encodeUnknownPromiseFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownPromise<JsonStringCodec<Sch>>>
  >;
}

/**
 * Shared statics plus Effect codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Schema the statics interpret, including service-requiring codecs.
 * @see {@link withEffectCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface EffectCodecStatics<Sch extends EffectCapableCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeEffect: ReturnType<typeof S.decodeEffect<Sch>>;
  readonly decodeEffectFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeEffect<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownEffect: ReturnType<typeof S.decodeUnknownEffect<Sch>>;
  readonly decodeUnknownEffectFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownEffect<JsonStringCodec<Sch>>>
  >;
  readonly encodeEffect: ReturnType<typeof S.encodeEffect<Sch>>;
  readonly encodeEffectFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeEffect<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownEffect: ReturnType<typeof S.encodeUnknownEffect<Sch>>;
  readonly encodeUnknownEffectFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownEffect<JsonStringCodec<Sch>>>
  >;
}

/**
 * Shared statics plus Exit codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withExitCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface ExitCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeExit: ReturnType<typeof S.decodeExit<Sch>>;
  readonly decodeExitFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeExit<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownExit: ReturnType<typeof S.decodeUnknownExit<Sch>>;
  readonly decodeUnknownExitFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownExit<JsonStringCodec<Sch>>>
  >;
  readonly encodeExit: ReturnType<typeof S.encodeExit<Sch>>;
  readonly encodeExitFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeExit<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownExit: ReturnType<typeof S.encodeUnknownExit<Sch>>;
  readonly encodeUnknownExitFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownExit<JsonStringCodec<Sch>>>
  >;
}

/**
 * Shared statics plus Option codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withOptionCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface OptionCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeOption: ReturnType<typeof S.decodeOption<Sch>>;
  readonly decodeOptionFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeOption<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownOption: ReturnType<typeof S.decodeUnknownOption<Sch>>;
  readonly decodeUnknownOptionFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownOption<JsonStringCodec<Sch>>>
  >;
  readonly encodeOption: ReturnType<typeof S.encodeOption<Sch>>;
  readonly encodeOptionFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeOption<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownOption: ReturnType<typeof S.encodeUnknownOption<Sch>>;
  readonly encodeUnknownOptionFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownOption<JsonStringCodec<Sch>>>
  >;
}

/**
 * Shared statics plus Result codecs for direct and JSON-string boundaries.
 *
 * @typeParam Sch - Service-free schema the statics interpret.
 * @see {@link withResultCodecStatics} for the combinator that attaches these statics.
 * @category models
 * @since 0.0.0
 */
export interface ResultCodecStatics<Sch extends ServiceFreeCodec<Sch>> extends SharedCodecStatics<Sch> {
  readonly decodeResult: ReturnType<typeof S.decodeResult<Sch>>;
  readonly decodeResultFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeResult<JsonStringCodec<Sch>>>
  >;
  readonly decodeUnknownResult: ReturnType<typeof S.decodeUnknownResult<Sch>>;
  readonly decodeUnknownResultFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.decodeUnknownResult<JsonStringCodec<Sch>>>
  >;
  readonly encodeResult: ReturnType<typeof S.encodeResult<Sch>>;
  readonly encodeResultFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeResult<JsonStringCodec<Sch>>>
  >;
  readonly encodeUnknownResult: ReturnType<typeof S.encodeUnknownResult<Sch>>;
  readonly encodeUnknownResultFromJsonString: ConfigurableJsonStringRunner<
    ReturnType<typeof S.encodeUnknownResult<JsonStringCodec<Sch>>>
  >;
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

const makeFromJsonString =
  <Sch extends S.Constraint>(schema: Sch) =>
  (options?: JsonStringCodecOptions) =>
    S.fromJsonString(schema, options);

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
 * ```ts import.meta.vitest name="Attach sync codec statics via pipe"
 * import * as S from "effect/Schema"
 * import { withSyncCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withSyncCodecStatics)
 *
 * Count.is(42) // => true
 * Count.decodeUnknownSync("42") // => 42
 * Count.encodeSync(42) // => "42"
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the sync codec statics.
 * @param self - The schema receiving the sync codec statics.
 * @returns The schema with shared statics plus direct and JSON-string sync codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @see {@link withEffectCodecStatics} for the Effect-returning group preferred in library code.
 * @category combinators
 * @since 0.0.0
 */
export const withSyncCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & SyncCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodeSync: S.decodeSync(schema),
      decodeSyncFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodeSync(fromJsonString(options))(input, options),
      decodeUnknownSync: S.decodeUnknownSync(schema),
      decodeUnknownSyncFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownSync(fromJsonString(options))(input, options),
      encodeSync: S.encodeSync(schema),
      encodeSyncFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodeSync(fromJsonString(options))(input, options),
      encodeUnknownSync: S.encodeUnknownSync(schema),
      encodeUnknownSyncFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownSync(fromJsonString(options))(input, options),
    };
  })(self);

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
 * ```ts import.meta.vitest name="Attach Promise codec statics via pipe"
 * import * as S from "effect/Schema"
 * import { withPromiseCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withPromiseCodecStatics)
 *
 * Count.is(42) // => true
 * await Count.decodeUnknownPromise("42") // => 42
 * await Count.encodePromise(42) // => "42"
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Promise codec statics.
 * @param self - The schema receiving the Promise codec statics.
 * @returns The schema with shared statics plus direct and JSON-string Promise codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withPromiseCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & PromiseCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodePromise: S.decodePromise(schema),
      decodePromiseFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodePromise(fromJsonString(options))(input, options),
      decodeUnknownPromise: S.decodeUnknownPromise(schema),
      decodeUnknownPromiseFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownPromise(fromJsonString(options))(input, options),
      encodePromise: S.encodePromise(schema),
      encodePromiseFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodePromise(fromJsonString(options))(input, options),
      encodeUnknownPromise: S.encodeUnknownPromise(schema),
      encodeUnknownPromiseFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownPromise(fromJsonString(options))(input, options),
    };
  })(self);

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
 * ```ts import.meta.vitest name="Attach Effect codec statics via pipe"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { withEffectCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withEffectCodecStatics)
 *
 * Count.is(42) // => true
 * await Effect.runPromise(Count.decodeUnknownEffect("42")) // => 42
 * await Effect.runPromise(Count.encodeEffect(42)) // => "42"
 * ```
 *
 * @typeParam Sch - Schema receiving the Effect codec statics.
 * @param self - The schema receiving the Effect codec statics.
 * @returns The schema with shared statics plus direct and JSON-string Effect codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withEffectCodecStatics = <Sch extends EffectCapableCodec<Sch>>(self: Sch): Sch & EffectCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodeEffect: S.decodeEffect(schema),
      decodeEffectFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodeEffect(fromJsonString(options))(input, options),
      decodeUnknownEffect: S.decodeUnknownEffect(schema),
      decodeUnknownEffectFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownEffect(fromJsonString(options))(input, options),
      encodeEffect: S.encodeEffect(schema),
      encodeEffectFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodeEffect(fromJsonString(options))(input, options),
      encodeUnknownEffect: S.encodeUnknownEffect(schema),
      encodeUnknownEffectFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownEffect(fromJsonString(options))(input, options),
    };
  })(self);

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
 * ```ts import.meta.vitest name="Attach Exit codec statics via pipe"
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { withExitCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withExitCodecStatics)
 *
 * Count.is(42) // => true
 * Exit.isSuccess(Count.decodeUnknownExit("42")) // => true
 * Exit.isSuccess(Count.encodeExit(42)) // => true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Exit codec statics.
 * @param self - The schema receiving the Exit codec statics.
 * @returns The schema with shared statics plus direct and JSON-string Exit codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withExitCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & ExitCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodeExit: S.decodeExit(schema),
      decodeExitFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodeExit(fromJsonString(options))(input, options),
      decodeUnknownExit: S.decodeUnknownExit(schema),
      decodeUnknownExitFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownExit(fromJsonString(options))(input, options),
      encodeExit: S.encodeExit(schema),
      encodeExitFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodeExit(fromJsonString(options))(input, options),
      encodeUnknownExit: S.encodeUnknownExit(schema),
      encodeUnknownExitFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownExit(fromJsonString(options))(input, options),
    };
  })(self);

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
 * ```ts import.meta.vitest name="Attach Option codec statics via pipe"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { withOptionCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withOptionCodecStatics)
 *
 * Count.is(42) // => true
 * O.isSome(Count.decodeUnknownOption("42")) // => true
 * O.isNone(Count.decodeUnknownOption(null)) // => true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Option codec statics.
 * @param self - The schema receiving the Option codec statics.
 * @returns The schema with shared statics plus direct and JSON-string Option codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withOptionCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & OptionCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodeOption: S.decodeOption(schema),
      decodeOptionFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodeOption(fromJsonString(options))(input, options),
      decodeUnknownOption: S.decodeUnknownOption(schema),
      decodeUnknownOptionFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownOption(fromJsonString(options))(input, options),
      encodeOption: S.encodeOption(schema),
      encodeOptionFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodeOption(fromJsonString(options))(input, options),
      encodeUnknownOption: S.encodeUnknownOption(schema),
      encodeUnknownOptionFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownOption(fromJsonString(options))(input, options),
    };
  })(self);

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
 * ```ts import.meta.vitest name="Attach Result codec statics via pipe"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { withResultCodecStatics } from "@beep/schema/SchemaUtils/codecStatics"
 *
 * const Count = S.NumberFromString.pipe(withResultCodecStatics)
 *
 * Count.is(42) // => true
 * Result.isSuccess(Count.decodeUnknownResult("42")) // => true
 * Result.isFailure(Count.decodeUnknownResult(null)) // => true
 * ```
 *
 * @typeParam Sch - Service-free schema receiving the Result codec statics.
 * @param self - The schema receiving the Result codec statics.
 * @returns The schema with shared statics plus direct and JSON-string Result codecs.
 * @see {@link SharedCodecStatics} for the `asserts`, `is`, and `equivalence` statics included in every group.
 * @category combinators
 * @since 0.0.0
 */
export const withResultCodecStatics = <Sch extends ServiceFreeCodec<Sch>>(self: Sch): Sch & ResultCodecStatics<Sch> =>
  attachCodecStatics((schema: Sch) => {
    const fromJsonString = makeFromJsonString(schema);
    return {
      decodeResult: S.decodeResult(schema),
      decodeResultFromJsonString: (input: string, options?: JsonStringCodecOptions) =>
        S.decodeResult(fromJsonString(options))(input, options),
      decodeUnknownResult: S.decodeUnknownResult(schema),
      decodeUnknownResultFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.decodeUnknownResult(fromJsonString(options))(input, options),
      encodeResult: S.encodeResult(schema),
      encodeResultFromJsonString: (input: Sch["Type"], options?: JsonStringCodecOptions) =>
        S.encodeResult(fromJsonString(options))(input, options),
      encodeUnknownResult: S.encodeUnknownResult(schema),
      encodeUnknownResultFromJsonString: (input: unknown, options?: JsonStringCodecOptions) =>
        S.encodeUnknownResult(fromJsonString(options))(input, options),
    };
  })(self);
