import {
  type AstNode,
  CoercionFunction,
  CoercionFunctionName,
  ErrorConstructorName,
  GlobalNamespaceName,
  InterpreterRuntimeError,
} from "../interpreter/Interpreter.model.ts"
import { copyIn } from "../Codemode.tool-runtime.ts"
import { LiteralKit, MappedLiteralKit, SafeObject } from "@beep/schema"
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
import * as S from "effect/Schema";
import { A, P } from "@beep/utils";

export const valueConstructors = LiteralKit(
  GlobalNamespaceName.pickOptions([
    "Date",
    "RegExp",
    "Map",
    "Set",
    "URL",
    "URLSearchParams",
  ])
)

export const BinaryOperator = LiteralKit([
  "+",
  "-",
  "*",
  "/",
  "%",
  "**",
  "==",
  "!=",
  "===",
  "!==",
  "<",
  "<=",
  ">",
  ">=",
  "&",
  "|",
  "^",
  "<<",
  ">>",
  ">>>",
  "in",
  "instanceof",
])

export type BinaryOperator = typeof BinaryOperator.Type

export const AppliedBinaryOperator = LiteralKit(
  BinaryOperator.omitOptions(["instanceof"])
)

export type AppliedBinaryOperator = typeof AppliedBinaryOperator.Type

export const CompoundOperator = MappedLiteralKit([
  ["+=", "+"],
  ["-=", "-"],
  ["*=", "*"],
  ["/=", "/"],
  ["%=", "%"],
  ["**=", "**"],
  ["&=", "&"],
  ["|=", "|"],
  ["^=", "^"],
  ["<<=", "<<"],
  [">>=", ">>"],
  [">>>=", ">>>"],
])

export type CompoundAssignmentOperator = typeof CompoundOperator.Encoded;

export const LogicalOperator = LiteralKit(["&&", "||", "??"]);
export type LogicalOperator = typeof LogicalOperator.Type;

export const UnaryOperator = LiteralKit(["delete", "typeof", "!", "void", "+", "-", "~"]);
export type UnaryOperator = typeof UnaryOperator.Type;

export const LogicalAssignmentOperator = LiteralKit(["??=", "||=", "&&="]);
export type LogicalAssignmentOperator = typeof LogicalAssignmentOperator.Type;

export const AssignmentOperator = LiteralKit([
  "=",
  ...CompoundOperator.Options,
  ...LogicalAssignmentOperator.Options,
]);
export type AssignmentOperator = typeof AssignmentOperator.Type;

export const UpdateOperator = MappedLiteralKit([
  ["++", 1],
  ["--", -1],
]);
export type UpdateOperator = typeof UpdateOperator.Encoded;

const ErrorBrand: unique symbol = Symbol("codemode.error")

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const createErrorValue = (name: ErrorConstructorName, message: string): SafeObject => {
  const value = Object.assign(SafeObject.make(Object.create(null)), { name, message })
  Object.defineProperty(value, ErrorBrand, { value: name })
  return value
}

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const createAggregateErrorValue = (errors: Array<unknown>, message: string): SafeObject =>
  Object.assign(createErrorValue("AggregateError", message), { errors })

export const errorBrandName = (value: unknown): ErrorConstructorName | undefined => {
  if (P.isNull(value) || !P.isObjectKeyword(value)) return undefined;
  const name = Reflect.get(value, ErrorBrand);
  return S.is(ErrorConstructorName)(name) ? name : undefined;
};

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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
  if (P.isNotUndefined(errorBrandName(value)) && P.isNotNull(value) && P.isObjectKeyword(value)) {
    // Match Error.prototype.toString: "name: message", or just one when the other is empty.
    const rawName = Reflect.get(value, "name");
    const rawMessage = Reflect.get(value, "message");
    const name = P.isString(rawName) ? rawName : "Error"
    const message = P.isString(rawMessage) ? rawMessage : ""
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

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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
