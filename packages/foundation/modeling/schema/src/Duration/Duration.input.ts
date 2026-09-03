/**
 * Reusable schemas for decoding duration values from Effect-compatible inputs.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Duration as D, Effect, pipe, SchemaGetter, SchemaIssue } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("Duration");

const hasDurationObjectValue = (value: {
  readonly weeks?: number | undefined;
  readonly days?: number | undefined;
  readonly hours?: number | undefined;
  readonly minutes?: number | undefined;
  readonly seconds?: number | undefined;
  readonly milliseconds?: number | undefined;
  readonly microseconds?: number | undefined;
  readonly nanoseconds?: number | undefined;
}): boolean =>
  pipe(
    [
      value.weeks,
      value.days,
      value.hours,
      value.minutes,
      value.seconds,
      value.milliseconds,
      value.microseconds,
      value.nanoseconds,
    ],
    A.some(P.isNotUndefined)
  );

const DurationObjectHasValue = S.makeFilter(hasDurationObjectValue, {
  identifier: $I`DurationObjectHasValue`,
  title: "Duration Object Has Value",
  description: "A duration object with at least one populated unit field.",
  message: "Duration object must include at least one populated unit field.",
});

/**
 * Literal union of duration unit labels accepted by {@link DurationInput}.
 *
 * **Example** (Decode a duration unit)
 *
 * ```ts import.meta.vitest name="Decode a duration unit"
 * import * as S from "effect/Schema"
 * import { DurationUnit } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationUnit)
 *
 * const unit = decode("hours")
 * unit // => "hours"
 * ```
 *
 * @see {@link DurationInput} for the input schema that consumes these labels.
 * @category schemas
 * @since 0.0.0
 */
export const DurationUnit = LiteralKit([
  "nano",
  "nanos",
  "micro",
  "micros",
  "milli",
  "millis",
  "second",
  "seconds",
  "minute",
  "minutes",
  "hour",
  "hours",
  "day",
  "days",
  "week",
  "weeks",
]).pipe(
  $I.annoteSchema("DurationUnit", {
    description: "A unit of time measurement accepted by duration input schemas.",
  })
);

/**
 * Duration unit string type extracted from {@link DurationUnit}.
 *
 * **Example** (Annotate a duration unit)
 *
 * ```ts
 * import type { DurationUnit } from "@beep/schema/Duration"
 *
 * const unit: DurationUnit = "hours"
 * console.log(unit)
 * ```
 *
 * @see {@link DurationUnit} for the runtime schema and accepted labels.
 * @category type-level
 * @since 0.0.0
 */
export type DurationUnit = typeof DurationUnit.Type;

/**
 * Backwards-compatible alias for {@link DurationUnit}.
 *
 * **Example** (Use the compatibility unit alias)
 *
 * ```ts
 * import type { Unit } from "@beep/schema/Duration"
 *
 * const unit: Unit = "seconds"
 * console.log(unit)
 * ```
 *
 * @see {@link DurationUnit} for the canonical type name.
 * @category type-level
 * @since 0.0.0
 */
export type Unit = DurationUnit;

/**
 * Represents structured duration input with additive unit fields.
 *
 * **When to use**
 *
 * Use when a duration is clearer as named units than as a scalar or tuple.
 *
 * **Details**
 *
 * Each populated field contributes to the total duration, and at least one
 * field must be present for validation to pass.
 *
 * **Gotchas**
 *
 * Unit values must be non-negative integers.
 *
 * **Example** (Decode additive duration fields)
 *
 * ```ts import.meta.vitest name="Decode additive duration fields"
 * import * as S from "effect/Schema"
 * import { DurationObject } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationObject)
 *
 * const d = decode({ hours: 1, minutes: 30 })
 * d.hours // => 1
 * d.minutes // => 30
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DurationObject extends S.Class<DurationObject>($I`DurationObject`)(
  {
    weeks: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    days: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    hours: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    minutes: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    seconds: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    milliseconds: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    microseconds: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
    nanoseconds: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.optionalKey),
  },
  $I.annote("DurationObject", {
    description: "A structured duration input whose populated unit fields are added together.",
  })
) {}

const NonEmptyDurationObject = DurationObject.check(DurationObjectHasValue);

/**
 * Accepts every duration input shape normalized by {@link DurationFromInput}.
 *
 * **When to use**
 *
 * Use when validating transport input before converting it to an Effect
 * `Duration`.
 *
 * **Details**
 *
 * Accepted values include an existing `Duration`, a non-negative integer or
 * bigint, a `[seconds, nanos]` tuple, a string such as `"5 hours"`, or a
 * {@link DurationObject} with additive unit fields.
 *
 * **Example** (Decode supported input shapes)
 *
 * ```ts import.meta.vitest name="Decode supported input shapes"
 * import * as S from "effect/Schema"
 * import { DurationInput } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationInput)
 *
 * const fromString = decode("5 hours")
 * const fromNumber = decode(1000)
 * const decodedObject = decode({ minutes: 30 })
 * const decodedCount = [fromString, fromNumber, decodedObject].length // => 3
 * ```
 *
 * @see {@link DurationFromInput} for normalization into an Effect `Duration`.
 * @category schemas
 * @since 0.0.0
 */
export const DurationInput = S.Union([
  S.Duration,
  S.Int.check(S.isGreaterThanOrEqualTo(0)),
  S.BigInt.check(S.isGreaterThanOrEqualToBigInt(BigInt(0))),
  S.Tuple([S.Finite.pipe(S.brand("seconds")), S.Finite.pipe(S.brand("nanos"))]),
  S.TemplateLiteral([S.Finite, " ", DurationUnit]),
  NonEmptyDurationObject,
]).pipe(
  $I.annoteSchema("DurationInput", {
    description:
      "Duration input accepted as an existing Duration, numeric transport, duration string, or additive object.",
  })
);

/**
 * Duration input type extracted from {@link DurationInput}.
 *
 * **Example** (Annotate decoded duration input)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DurationInput } from "@beep/schema/Duration"
 *
 * const fromString: DurationInput = S.decodeUnknownSync(DurationInput)("5 hours")
 * console.log(fromString)
 * ```
 *
 * @see {@link DurationInput} for the runtime schema and supported input forms.
 * @category type-level
 * @since 0.0.0
 */
export type DurationInput = typeof DurationInput.Type;

const decodeDurationInput = (input: DurationInput): Effect.Effect<D.Duration, SchemaIssue.Issue> => {
  const duration = D.fromInput(input);

  return pipe(
    duration,
    Effect.fromOption(
      () =>
        new SchemaIssue.InvalidValue({
          message: "Expected a valid duration input.",
        })
    )
  );
};

/**
 * Normalizes {@link DurationInput} into an Effect `Duration`.
 *
 * **When to use**
 *
 * Use when heterogeneous duration input should become one runtime duration
 * representation.
 *
 * **Details**
 *
 * Decoding accepts the complete {@link DurationInput} union and produces the
 * same duration representation used by Effect.
 *
 * **Gotchas**
 *
 * Encoding is forbidden because normalized durations cannot recover an
 * original scalar, tuple, string, or additive-object representation.
 *
 * **Example** (Normalize a duration string)
 *
 * ```ts import.meta.vitest name="Normalize a duration string"
 * import { Duration, Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { DurationFromInput } from "@beep/schema/Duration"
 *
 * const program = S.decodeUnknownEffect(DurationFromInput)("2 hours")
 * const duration = await Effect.runPromise(program)
 * Duration.toMillis(duration) // => 7200000
 * ```
 *
 * @see {@link DurationInput} for the accepted encoded representations.
 * @category schemas
 * @since 0.0.0
 */
export const DurationFromInput = DurationInput.pipe(
  S.decodeTo(S.Duration, {
    decode: SchemaGetter.transformOrFail(decodeDurationInput),
    encode: SchemaGetter.forbidden(
      () => "Encoding DurationFromInput results back to the original duration input is not supported"
    ),
  }),
  $I.annoteSchema("DurationFromInput", {
    description: "A one-way schema that normalizes supported duration inputs into an Effect Duration value.",
  })
);

/**
 * Decoded duration type extracted from {@link DurationFromInput}.
 *
 * **Example** (Annotate a normalized duration)
 *
 * ```ts import.meta.vitest name="Annotate a normalized duration"
 * import { Duration, Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { DurationFromInput } from "@beep/schema/Duration"
 *
 * const program = S.decodeUnknownEffect(DurationFromInput)("2 hours")
 * const duration: Duration.Duration = await Effect.runPromise(program)
 * Duration.toMillis(duration) // => 7200000
 * ```
 *
 * @see {@link DurationFromInput} for the runtime transformation schema.
 * @category type-level
 * @since 0.0.0
 */
export type DurationFromInput = typeof DurationFromInput.Type;

/**
 * Compatibility schema alias for {@link DurationInput}.
 *
 * **Example** (Decode through the input alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Input } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(Input)
 * console.log(decode("5 hours"))
 * ```
 *
 * @see {@link DurationInput} for the canonical schema name.
 * @category schemas
 * @since 0.0.0
 */
export const Input = DurationInput;

/**
 * Decoded input type exposed under the compatibility name {@link Input}.
 *
 * **Example** (Annotate input through the alias)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Input } from "@beep/schema/Duration"
 *
 * const fromString: Input = S.decodeUnknownSync(Input)("5 hours")
 * console.log(fromString)
 * ```
 *
 * @see {@link DurationInput} for the canonical decoded type.
 * @category type-level
 * @since 0.0.0
 */
export type Input = DurationInput;

/**
 * Re-exports {@link DurationObject} under the compatibility name `Object`.
 *
 * @see {@link DurationObject} for the owning class and construction example.
 * @category models
 * @since 0.0.0
 */
export { DurationObject as Object };
