/**
 * Guest Number constants plus instance and static method dispatch for the
 * CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { N, P } from "@beep/utils";
import * as S from "effect/Schema";
import { type NumberMethod, type NumberStatic, numberMethods, numberStatics } from "../Codemode.method-names.ts";
import { type AstNode, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts";
import { boundedData, coerceToString } from "./StdLib.value.ts";

export {
  numberMethods,
  numberStatics,
} from "../Codemode.method-names.ts";

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.number");

/**
 * Closed kit of guest-visible `Number` constants including NaN and infinities.
 *
 * **Example** (Confirm MAX_SAFE_INTEGER membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { numberConstants } from "../../../codemode/stdlib/StdLib.number.ts"
 *
 * console.log(S.is(numberConstants)("MAX_SAFE_INTEGER"))
 * console.log(S.is(numberConstants)("parseInt"))
 * ```
 *
 * @see {@link invokeNumberStatic} for Number.parseInt and related statics.
 * @category constants
 * @since 0.0.0
 */
export const numberConstants = LiteralKit([
  "MAX_SAFE_INTEGER",
  "MIN_SAFE_INTEGER",
  "MAX_VALUE",
  "MIN_VALUE",
  "EPSILON",
  "NaN",
  "POSITIVE_INFINITY",
  "NEGATIVE_INFINITY",
]).pipe(
  $I.annoteSchema("numberConstants", {
    description: "Guest-visible Number constant names.",
  })
);

/**
 * Decoded value produced by {@link numberConstants}.
 *
 * @see {@link numberConstants} for the runtime kit of Number constant names.
 * @category type-level
 * @since 0.0.0
 */
export type numberConstants = typeof numberConstants.Type;

/**
 * Dispatches guest Number instance methods and bounds the rendered result.
 *
 * **Example** (Format with toFixed and a binary toString)
 *
 * ```ts
 * import { invokeNumberMethod } from "../../../codemode/stdlib/StdLib.number.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeNumberMethod(1.25, "toFixed", [1], node))
 * console.log(invokeNumberMethod(2, "toString", [2], node))
 * ```
 *
 * @see {@link invokeNumberStatic} for Number.isFinite and parseInt.
 * @see {@link boundedData} for the copy applied to every result.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeNumberMethod = (value: number, name: NumberMethod, args: Array<unknown>, node: AstNode): unknown => {
  const optNum = (index: number): number | undefined => {
    const arg = args[index];
    if (P.isUndefined(arg)) return undefined;
    if (!P.isNumber(arg)) throw InterpreterRuntimeError.new(`Number.${name} expects a number argument.`, node);
    return arg;
  };
  const result = numberMethods.$match(name, {
    toFixed: () => value.toFixed(optNum(0)),
    toExponential: () => value.toExponential(optNum(0)),
    toPrecision: () => {
      const digits = optNum(0);
      return P.isUndefined(digits) ? value.toString() : value.toPrecision(digits);
    },
    toString: () => {
      const radix = optNum(0);
      if (P.isNotUndefined(radix) && (radix < 2 || radix > 36)) {
        throw InterpreterRuntimeError.new("Number.toString radix must be between 2 and 36.", node);
      }
      return value.toString(radix);
    },
    valueOf: () => value,
  });
  return boundedData(result, `Number.${name} result`);
};

/**
 * Dispatches guest Number statics such as `isFinite` and `parseInt`.
 *
 * **Example** (Guard finiteness and parse a decimal string)
 *
 * ```ts
 * import { invokeNumberStatic } from "../../../codemode/stdlib/StdLib.number.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeNumberStatic("isFinite", [1], node))
 * console.log(invokeNumberStatic("parseInt", ["10", 10], node))
 * ```
 *
 * @see {@link invokeNumberMethod} for instance formatting such as toFixed.
 * @see {@link numberConstants} for MAX_SAFE_INTEGER and related names.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeNumberStatic = (name: NumberStatic, args: Array<unknown>, node: AstNode): unknown => {
  const value = args[0];
  return numberStatics.$match(name, {
    isInteger: () => N.isInteger(value),
    isFinite: () => S.is(S.Finite)(value),
    isNaN: () => Number.isNaN(value),
    isSafeInteger: () => Number.isSafeInteger(value),
    parseInt: () => {
      const radix = args[1];
      if (P.isNotUndefined(radix) && !P.isNumber(radix)) {
        throw InterpreterRuntimeError.new("Number.parseInt expects a numeric radix.", node);
      }
      return parseInt(coerceToString(value), radix);
    },
    parseFloat: () => parseFloat(coerceToString(value)),
  });
};
