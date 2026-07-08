/**
 * Reusable schemas for decoding duration values from Effect-compatible inputs.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { A } from "@beep/utils";
import { Duration as D, Effect, Option, pipe, SchemaGetter, SchemaIssue } from "effect";
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
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DurationUnit } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationUnit)
 *
 * const unit = decode("hours")
 * console.log(unit) // "hours"
 * ```
 *
 * @since 0.0.0
 * @category constructors
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
 * @example
 * ```ts
 * import type { DurationUnit } from "@beep/schema/Duration"
 *
 * const unit: DurationUnit = "hours"
 * console.log(unit)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DurationUnit = typeof DurationUnit.Type;

/**
 * Backwards-compatible alias for {@link DurationUnit}.
 *
 * @example
 * ```ts
 * import type { Unit } from "@beep/schema/Duration"
 *
 * const unit: Unit = "seconds"
 * console.log(unit)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Unit = DurationUnit;

/**
 * Structured duration input with additive unit fields.
 *
 * Each populated field contributes to the total duration.
 * At least one field must be set for validation to pass.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DurationObject } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationObject)
 *
 * const d = decode({ hours: 1, minutes: 30 })
 * console.log(d.hours) // 1
 * console.log(d.minutes) // 30
 * ```
 *
 * @since 0.0.0
 * @category constructors
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
 * Union schema for all duration input shapes accepted by {@link DurationFromInput}.
 *
 * Accepts an existing `Duration`, a non-negative integer, a non-negative bigint,
 * a `[seconds, nanos]` tuple, a template literal like `"5 hours"`, or a
 * {@link DurationObject} with additive unit fields.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DurationInput } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(DurationInput)
 *
 * const fromString = decode("5 hours")
 * const fromNumber = decode(1000)
 * const fromObject = decode({ minutes: 30 })
 * ```
 *
 * @since 0.0.0
 * @category constructors
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
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DurationInput } from "@beep/schema/Duration"
 *
 * const fromString: DurationInput = S.decodeUnknownSync(DurationInput)("5 hours")
 * console.log(fromString)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DurationInput = typeof DurationInput.Type;

const invalidDurationInputIssue = (input: DurationInput) =>
  new SchemaIssue.InvalidValue(Option.some(input), {
    message: "Expected a valid duration input.",
  });

const decodeDurationInput = (input: DurationInput): Effect.Effect<D.Duration, SchemaIssue.Issue> => {
  const duration = D.fromInput(input);

  return pipe(
    duration,
    Option.match({
      onNone: () => Effect.fail(invalidDurationInputIssue(input)),
      onSome: Effect.succeed,
    })
  );
};

/**
 * One-way schema that decodes {@link DurationInput} into an Effect `Duration`.
 *
 * Encoding back to the original input is intentionally forbidden because the
 * additive object form and normalized duration values are not invertible.
 *
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { DurationFromInput } from "@beep/schema/Duration"
 *
 * const program = S.decodeUnknownEffect(DurationFromInput)("2 hours")
 * const duration = await Effect.runPromise(program)
 * console.log(Duration.toMillis(duration)) // 7200000
 * ```
 *
 * @since 0.0.0
 * @category constructors
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
 * @example
 * ```ts
 * import { Duration, Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { DurationFromInput } from "@beep/schema/Duration"
 *
 * const program = S.decodeUnknownEffect(DurationFromInput)("2 hours")
 * const duration: Duration.Duration = await Effect.runPromise(program)
 * console.log(Duration.toMillis(duration)) // 7200000
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DurationFromInput = typeof DurationFromInput.Type;

/**
 * {@inheritDoc DurationInput}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Input } from "@beep/schema/Duration"
 *
 * const decode = S.decodeUnknownSync(Input)
 * console.log(decode("5 hours"))
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Input = DurationInput;

/**
 * {@inheritDoc DurationInput}
 *
 * @category models
 * @since 0.0.0
 */
export type Input = DurationInput;

/**
 * Backwards-compatible alias for {@link DurationObject}.
 *
 * @category constructors
 * @since 0.0.0
 */
export { DurationObject as Object };
