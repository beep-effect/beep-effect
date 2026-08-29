import {
  type AstNode,
  InterpreterRuntimeError
} from "../interpreter/Interpreter.model.ts";
import {LiteralKit} from "@beep/schema";
import * as S from "effect/Schema";
import {boundedData, coerceToString} from "./StdLib.value.ts";
import {P, N} from "@beep/utils";
import {
  type NumberMethod,
  type NumberStatic,
  numberMethods,
  numberStatics,
} from "../Codemode.method-names.ts";

export {
  numberMethods,
  numberStatics,
} from "../Codemode.method-names.ts";

export const numberConstants = LiteralKit([
  "MAX_SAFE_INTEGER",
  "MIN_SAFE_INTEGER",
  "MAX_VALUE",
  "MIN_VALUE",
  "EPSILON",
  "NaN",
  "POSITIVE_INFINITY",
  "NEGATIVE_INFINITY",
]);

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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
