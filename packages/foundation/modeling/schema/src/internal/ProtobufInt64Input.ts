/**
 * Shared protobuf 64-bit scalar input helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, SchemaGetter, SchemaIssue } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

/**
 * Protobufjs-compatible `Long` object shape for 64-bit integer fields.
 *
 * @remarks
 * Protobufjs commonly exposes decoded 64-bit scalar fields as `long.js`
 * values. The stable runtime shape has 32-bit `low` and `high` words, an
 * `unsigned` flag, and a decimal `toString()` representation.
 *
 * @example
 * ```ts
 * import type { ProtobufInt64Input } from "@beep/schema/internal/ProtobufInt64Input"
 *
 * const value: ProtobufInt64Input = {
 *   high: 0,
 *   low: 42,
 *   unsigned: true,
 *   toString: () => "42",
 * }
 *
 * console.log(value.toString())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
interface ProtobufLongLike {
  readonly high: number;
  readonly low: number;
  toString(): string;
  readonly unsigned?: boolean;
}

/**
 * Input values protobufjs accepts or can expose for 64-bit integer fields.
 *
 * @example
 * ```ts
 * import type { ProtobufInt64Input } from "@beep/schema/internal/ProtobufInt64Input"
 *
 * const value: ProtobufInt64Input = "9223372036854775807"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProtobufInt64Input = bigint | number | string | ProtobufLongLike;

const decimalIntegerPattern = /^-?(?:0|[1-9]\d*)$/;

const invalidProtobufInt64Input = (input: unknown, message: string) =>
  new SchemaIssue.InvalidValue(O.some(input), { message });

const isProtobufLongLike = (input: unknown): input is ProtobufLongLike => {
  if (
    !P.isObject(input) ||
    !P.hasProperty(input, "high") ||
    !P.hasProperty(input, "low") ||
    !P.hasProperty(input, "toString")
  ) {
    return false;
  }

  return (
    globalThis.Number.isInteger(input.high) &&
    globalThis.Number.isInteger(input.low) &&
    (!P.hasProperty(input, "unsigned") || P.isBoolean(input.unsigned)) &&
    P.isFunction(input.toString)
  );
};

const isProtobufInt64Input = (input: unknown): input is ProtobufInt64Input =>
  P.isBigInt(input) ||
  P.isString(input) ||
  (P.isNumber(input) && globalThis.Number.isFinite(input) && globalThis.Number.isInteger(input)) ||
  isProtobufLongLike(input);

const parseDecimalBigInt = (input: unknown, decimal: string) => {
  if (!decimalIntegerPattern.test(decimal)) {
    throw invalidProtobufInt64Input(input, "Expected a protobuf 64-bit integer decimal string");
  }

  return BigInt(decimal);
};

const decodeProtobufInt64Input = (input: ProtobufInt64Input) =>
  Effect.try({
    try: () => {
      if (P.isBigInt(input)) {
        return input;
      }

      if (P.isNumber(input)) {
        return BigInt(input);
      }

      return parseDecimalBigInt(input, P.isString(input) ? input : input.toString());
    },
    catch: (cause) =>
      SchemaIssue.isIssue(cause) ? cause : invalidProtobufInt64Input(input, "Expected a protobuf 64-bit integer value"),
  });

/**
 * Schema for protobufjs 64-bit integer input values.
 *
 * @remarks
 * This schema accepts decimal strings, JavaScript integer numbers, `bigint`,
 * and protobufjs `Long`-like objects. Downstream scalar schemas decode these
 * inputs into branded `bigint` values before applying signed or unsigned range
 * checks.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProtobufInt64Input } from "@beep/schema/internal/ProtobufInt64Input"
 *
 * console.log(S.is(ProtobufInt64Input)("42"))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const ProtobufInt64Input = S.declare<ProtobufInt64Input>(isProtobufInt64Input, {
  description: "A protobufjs-compatible 64-bit integer input value.",
  identifier: "ProtobufInt64Input",
  title: "Protobuf 64-bit Integer Input",
});

/**
 * Codec transformation for protobufjs 64-bit integer input values.
 *
 * @example
 * ```ts
 * import { decodeProtobufInt64InputTransformation } from "@beep/schema/internal/ProtobufInt64Input"
 *
 * console.log(decodeProtobufInt64InputTransformation)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeProtobufInt64InputTransformation = {
  decode: SchemaGetter.transformOrFail(decodeProtobufInt64Input),
  encode: SchemaGetter.transform((value: bigint): ProtobufInt64Input => value),
};
