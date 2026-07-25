import {
  type AstNode,
  CoercionFunction,
  CoercionFunctionName,
  ErrorConstructorName,
  InterpreterRuntimeError,
} from "../interpreter/Interpreter.model.ts"
import { copyIn, type SafeObject } from "../Codemode.tool-runtime.ts"
import { LiteralKit } from "@beep/schema"
import {
  isCodeModeValue,
  CodeModeDate,
  CodeModeMap,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts"
import { DateTime } from "effect";
import { A, P } from "@beep/utils";

export const errorConstructors = ErrorConstructorName

export const valueConstructors = LiteralKit(["Date", "RegExp", "Map", "Set", "URL", "URLSearchParams"])

export const compoundOperators = LiteralKit(["+=", "-=", "*=", "/=", "%=", "**=", "&=", "|=", "^=", "<<=", ">>=", ">>>="])

const ErrorBrand: unique symbol = Symbol("codemode.error")

export const createErrorValue = (name: string, message: string): SafeObject => {
  const value = Object.assign(Object.create(null) as SafeObject, { name, message })
  Object.defineProperty(value, ErrorBrand, { value: name })
  return value
}

export const createAggregateErrorValue = (errors: Array<unknown>, message: string): SafeObject =>
  Object.assign(createErrorValue("AggregateError", message), { errors })

export const errorBrandName = (value: unknown): string | undefined =>
  P.isNotNull(value) && P.isObjectKeyword(value)
    ? ((value as Record<PropertyKey, unknown>)[ErrorBrand] as string | undefined)
    : undefined

export const boundedData = (value: unknown, label: string): unknown => copyIn(value, label, true)

export const coerceToString = (value: unknown): string => {
  if (P.isNull(value)) return "null"
  if (P.isUndefined(value)) return "undefined"
  if (CodeModeDate.is(value))
    return Number.isFinite(value.time) ? DateTime.makeUnsafe(value.time).pipe(DateTime.toDate, (d) => d.toISOString()) : "Invalid Date"
  if (CodeModeRegExp.is(value)) return `/${value.regex.source}/${value.regex.flags}`
  if (CodeModeMap.is(value)) return "[object Map]"
  if (CodeModeSet.is(value)) return "[object Set]"
  if (CodeModeURL.is(value)) return value.url.href
  if (CodeModeURLSearchParams.is(value)) return value.params.toString()
  if (errorBrandName(value) !== undefined) {
    // Match Error.prototype.toString: "name: message", or just one when the other is empty.
    const error = value as { name?: unknown; message?: unknown }
    const name = typeof error.name === "string" ? error.name : "Error"
    const message = typeof error.message === "string" ? error.message : ""
    if (message === "") return name
    if (name === "") return message
    return `${name}: ${message}`
  }
  if (P.isObjectKeyword(value)) {
    return Array.isArray(value)
      ? value.map((item) => (item === null || item === undefined ? "" : coerceToString(item))).join(",")
      : "[object Object]"
  }
  return String(value)
}

export const coerceToNumber = (value: unknown): number => {
  if (CodeModeDate.is(value)) return value.time
  if (isCodeModeValue(value)) return Number.NaN
  // Arrays coerce through our own string coercion: host Number(array) joins with host
  // ToPrimitive, which throws on the null-prototype objects the interpreter produces.
  if (Array.isArray(value)) return Number(coerceToString(value))
  return P.isNotNull(value) && P.isObjectKeyword(value) ? Number.NaN : Number(value)
}

export const invokeCoercion = (ref: CoercionFunction, args: Array<unknown>, node: AstNode): unknown => {
  const withoutArguments = A.isArrayEmpty(args)
  const raw = args[0]

  const value = (): unknown =>
    isCodeModeValue(raw)
      ? raw
      : boundedData(raw, `${ref.name} input`)

  return CoercionFunctionName.$match(ref.name, {
    Boolean: () => P.isTruthy(value()),
    // Native Number() is 0, unlike Number(undefined).
    Number: () => withoutArguments ? 0 : coerceToNumber(value()),
    // Error values are plain SafeObjects; boundedData would strip their guest brand.
    String: () =>
      withoutArguments
        ? ""
        : coerceToString(P.isNotUndefined(errorBrandName(raw)) ? raw : value()),
    isFinite: () => Number.isFinite(coerceToNumber(value())),
    isNaN: () => Number.isNaN(coerceToNumber(value())),
    parseInt: () => {
      const radix = args[1]
      if (P.isNotUndefined(radix) && !P.isNumber(radix)) {
        throw InterpreterRuntimeError.new("parseInt expects a numeric radix.", node)
      }
      return parseInt(coerceToString(value()), radix)
    },
    parseFloat: () => parseFloat(coerceToString(value())),
  })
}
