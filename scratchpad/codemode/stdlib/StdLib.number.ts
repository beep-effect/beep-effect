import {
  type AstNode,
  InterpreterRuntimeError
} from "../interpreter/Interpreter.model.ts";
import {LiteralKit} from "@beep/schema";
import * as S from "effect/Schema";
import {boundedData, coerceToString} from "./StdLib.value.ts";
import {P} from "@beep/utils";

export const numberMethods = LiteralKit(["toFixed", "toPrecision", "toExponential", "toString", "valueOf"]);

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

export const numberStatics = LiteralKit(["isInteger", "isFinite", "isNaN", "isSafeInteger", "parseInt", "parseFloat"]);

export const invokeNumberMethod = (value: number, name: string, args: Array<unknown>, node: AstNode): unknown => {
  const optNum = (index: number): number | undefined => {
    const arg = args[index];
    if (P.isUndefined(arg)) return undefined;
    if (!P.isNumber(arg)) throw InterpreterRuntimeError.new(`Number.${name} expects a number argument.`, node);
    return arg;
  };
  if (!S.is(numberMethods)(name)) {
    throw InterpreterRuntimeError.new(`Number method '${name}' is not available.`, node);
  }
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

export const invokeNumberStatic = (name: string, args: Array<unknown>, node: AstNode): unknown => {
  const value = args[0];
  if (!S.is(numberStatics)(name)) {
    throw InterpreterRuntimeError.new(`Number.${name} is not available.`, node);
  }
  return numberStatics.$match(name, {
    isInteger: () => Number.isInteger(value),
    isFinite: () => Number.isFinite(value),
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
