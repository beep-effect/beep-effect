/**
 * Guest operator kits, error-branded objects, and JavaScript coercions used by
 * the CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
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

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.value");

/**
 * Guest constructor names the interpreter may allocate as CodeMode values
 * (`Date`, `RegExp`, `Map`, `Set`, `URL`, `URLSearchParams`).
 *
 * **Example** (Confirm Date is a value constructor)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { valueConstructors } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(valueConstructors)("Date"))
 * console.log(S.is(valueConstructors)("Object"))
 * ```
 *
 * @see {@link createErrorValue} for Error constructors, which are branded objects rather than this kit.
 * @category schemas
 * @since 0.0.0
 */
export const valueConstructors = LiteralKit(
  GlobalNamespaceName.pickOptions([
    "Date",
    "RegExp",
    "Map",
    "Set",
    "URL",
    "URLSearchParams",
  ])
).pipe(
  $I.annoteSchema("valueConstructors", {
    description: "Guest constructor names allocated as CodeMode values.",
  })
)

/**
 * Decoded value produced by {@link valueConstructors}.
 *
 * @see {@link valueConstructors} for the runtime constructor-name kit.
 * @category type-level
 * @since 0.0.0
 */
export type valueConstructors = typeof valueConstructors.Type;

/**
 * Binary operators the interpreter can apply to guest values, including
 * `in` and `instanceof`.
 *
 * **Example** (Confirm addition is a binary operator)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BinaryOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(BinaryOperator)("+"))
 * console.log(S.is(BinaryOperator)("&&"))
 * ```
 *
 * @see {@link AppliedBinaryOperator} for the subset applied after `instanceof` is excluded.
 * @category schemas
 * @since 0.0.0
 */
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
]).pipe(
  $I.annoteSchema("BinaryOperator", {
    description: "Guest binary operators including in and instanceof.",
  })
)

/**
 * Decoded value produced by {@link BinaryOperator}.
 *
 * @see {@link BinaryOperator} for the runtime operator kit.
 * @category type-level
 * @since 0.0.0
 */
export type BinaryOperator = typeof BinaryOperator.Type

/**
 * Binary operators applied after the interpreter has already resolved
 * `instanceof` specially.
 *
 * **Example** (instanceof is excluded from applied operators)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AppliedBinaryOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(AppliedBinaryOperator)("+"))
 * console.log(S.is(AppliedBinaryOperator)("instanceof"))
 * ```
 *
 * @see {@link BinaryOperator} for the full binary operator kit including instanceof.
 * @category schemas
 * @since 0.0.0
 */
export const AppliedBinaryOperator = LiteralKit(
  BinaryOperator.omitOptions(["instanceof"])
).pipe(
  $I.annoteSchema("AppliedBinaryOperator", {
    description: "Binary operators applied after instanceof is handled separately.",
  })
)

/**
 * Decoded value produced by {@link AppliedBinaryOperator}.
 *
 * @see {@link AppliedBinaryOperator} for the runtime applied-operator kit.
 * @category type-level
 * @since 0.0.0
 */
export type AppliedBinaryOperator = typeof AppliedBinaryOperator.Type

/**
 * Compound assignment operators mapped to the binary operator they apply.
 *
 * **Example** (Decode += to addition)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CompoundOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.decodeUnknownSync(CompoundOperator)("+="))
 * console.log(S.is(CompoundOperator)("+"))
 * ```
 *
 * @see {@link CompoundAssignmentOperator} for the encoded `+=` spelling.
 * @see {@link AssignmentOperator} for the union that includes these operators.
 * @category schemas
 * @since 0.0.0
 */
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
]).pipe(
  $I.annoteSchema("CompoundOperator", {
    description: "Compound assignment operators decoded to the binary operator they apply.",
  })
)

/**
 * Decoded value produced by {@link CompoundOperator}.
 *
 * @see {@link CompoundOperator} for the runtime mapped kit.
 * @see {@link CompoundAssignmentOperator} for the encoded assignment spelling.
 * @category type-level
 * @since 0.0.0
 */
export type CompoundOperator = typeof CompoundOperator.Type;

/**
 * Encoded assignment spelling accepted by {@link CompoundOperator} (`+=`,
 * `-=`, ...).
 *
 * @see {@link CompoundOperator} for the decoded binary operator.
 * @category type-level
 * @since 0.0.0
 */
export type CompoundAssignmentOperator = typeof CompoundOperator.Encoded;

/**
 * Short-circuiting logical operators `&&`, `||`, and `??`.
 *
 * **Example** (Confirm nullish coalescing membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LogicalOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(LogicalOperator)("??"))
 * console.log(S.is(LogicalOperator)("+"))
 * ```
 *
 * @see {@link LogicalAssignmentOperator} for ??= and related assignment forms.
 * @category schemas
 * @since 0.0.0
 */
export const LogicalOperator = LiteralKit(["&&", "||", "??"]).pipe(
  $I.annoteSchema("LogicalOperator", {
    description: "Guest short-circuiting logical operators.",
  })
);
/**
 * Decoded value produced by {@link LogicalOperator}.
 *
 * @see {@link LogicalOperator} for the runtime logical-operator kit.
 * @category type-level
 * @since 0.0.0
 */
export type LogicalOperator = typeof LogicalOperator.Type;

/**
 * Unary operators including `delete`, `typeof`, `void`, and numeric prefixes.
 *
 * **Example** (Confirm typeof membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnaryOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(UnaryOperator)("typeof"))
 * console.log(S.is(UnaryOperator)("++"))
 * ```
 *
 * @see {@link UpdateOperator} for ++ and --, which are not unary prefix operators here.
 * @category schemas
 * @since 0.0.0
 */
export const UnaryOperator = LiteralKit(["delete", "typeof", "!", "void", "+", "-", "~"]).pipe(
  $I.annoteSchema("UnaryOperator", {
    description: "Guest unary operators including delete, typeof, and void.",
  })
);
/**
 * Decoded value produced by {@link UnaryOperator}.
 *
 * @see {@link UnaryOperator} for the runtime unary-operator kit.
 * @category type-level
 * @since 0.0.0
 */
export type UnaryOperator = typeof UnaryOperator.Type;

/**
 * Logical assignment operators `??=`, `||=`, and `&&=`.
 *
 * **Example** (Confirm ??= membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { LogicalAssignmentOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(LogicalAssignmentOperator)("??="))
 * console.log(S.is(LogicalAssignmentOperator)("??"))
 * ```
 *
 * @see {@link AssignmentOperator} for the union of `=` with compound and logical assignment.
 * @see {@link LogicalOperator} for the non-assignment && / || / ?? forms.
 * @category schemas
 * @since 0.0.0
 */
export const LogicalAssignmentOperator = LiteralKit(["??=", "||=", "&&="]).pipe(
  $I.annoteSchema("LogicalAssignmentOperator", {
    description: "Guest logical assignment operators.",
  })
);
/**
 * Decoded value produced by {@link LogicalAssignmentOperator}.
 *
 * @see {@link LogicalAssignmentOperator} for the runtime logical-assignment kit.
 * @category type-level
 * @since 0.0.0
 */
export type LogicalAssignmentOperator = typeof LogicalAssignmentOperator.Type;

/**
 * Assignment operators: `=` plus every compound and logical assignment.
 *
 * **Example** (Confirm = and += membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { AssignmentOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.is(AssignmentOperator)("="))
 * console.log(S.is(AssignmentOperator)("+="))
 * ```
 *
 * @see {@link CompoundOperator} for the mapped compound subset.
 * @see {@link LogicalAssignmentOperator} for ??= / ||= / &&=.
 * @category schemas
 * @since 0.0.0
 */
export const AssignmentOperator = LiteralKit([
  "=",
  ...CompoundOperator.Options,
  ...LogicalAssignmentOperator.Options,
]).pipe(
  $I.annoteSchema("AssignmentOperator", {
    description: "Guest assignment operators including compound and logical assignment.",
  })
);
/**
 * Decoded value produced by {@link AssignmentOperator}.
 *
 * @see {@link AssignmentOperator} for the runtime assignment-operator kit.
 * @category type-level
 * @since 0.0.0
 */
export type AssignmentOperator = typeof AssignmentOperator.Type;

/**
 * Increment and decrement operators decoded to the numeric step they apply.
 *
 * **Example** (Decode ++ to the step 1)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UpdateOperator } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(S.decodeUnknownSync(UpdateOperator)("++"))
 * console.log(S.decodeUnknownSync(UpdateOperator)("--"))
 * ```
 *
 * @see {@link UpdateOperatorEncoded} for the encoded `++` / `--` spelling.
 * @see {@link UnaryOperator} for prefix + / - which are not update operators.
 * @category schemas
 * @since 0.0.0
 */
export const UpdateOperator = MappedLiteralKit([
  ["++", 1],
  ["--", -1],
]).pipe(
  $I.annoteSchema("UpdateOperator", {
    description: "Increment and decrement operators decoded to a numeric step.",
  })
);
/**
 * Decoded numeric step produced by {@link UpdateOperator}.
 *
 * @see {@link UpdateOperator} for the runtime mapped kit.
 * @see {@link UpdateOperatorEncoded} for the encoded ++ / -- spelling.
 * @category type-level
 * @since 0.0.0
 */
export type UpdateOperator = typeof UpdateOperator.Type;

/**
 * Encoded increment/decrement spelling accepted by {@link UpdateOperator}.
 *
 * @see {@link UpdateOperator} for the decoded numeric step.
 * @category type-level
 * @since 0.0.0
 */
export type UpdateOperatorEncoded = typeof UpdateOperator.Encoded;

const ErrorBrand: unique symbol = Symbol("codemode.error")

/**
 * Allocates a guest Error as a branded SafeObject with `name` and `message`.
 *
 * **Gotchas**
 *
 * The brand is a unique symbol. {@link boundedData} / {@link copyIn} strip it,
 * so {@link coerceToString} and {@link invokeCoercion} (`String`) must see the
 * branded object, not a copied one, or they print `[object Object]`.
 *
 * **Example** (Stringify a branded TypeError)
 *
 * ```ts
 * import { coerceToString, createErrorValue } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * const error = createErrorValue("TypeError", "x")
 * console.log(coerceToString(error))
 * ```
 *
 * @see {@link errorBrandName} for reading the brand.
 * @see {@link coerceToString} for Error.prototype.toString formatting.
 * @see {@link invokeCoercion} for String() which preserves the brand.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const createErrorValue = (name: ErrorConstructorName, message: string): SafeObject => {
  const value = Object.assign(SafeObject.make(Object.create(null)), { name, message })
  Object.defineProperty(value, ErrorBrand, { value: name })
  return value
}

/**
 * Allocates a guest AggregateError as a branded error with an `errors` array.
 *
 * **Example** (Stringify an AggregateError)
 *
 * ```ts
 * import { coerceToString, createAggregateErrorValue } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * const error = createAggregateErrorValue(["boom"], "all failed")
 * console.log(coerceToString(error))
 * ```
 *
 * @see {@link createErrorValue} for the branded Error used as the prototype shape.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const createAggregateErrorValue = (errors: Array<unknown>, message: string): SafeObject =>
  Object.assign(createErrorValue("AggregateError", message), { errors })

/**
 * Reads the guest Error constructor name stored on an error brand, if present.
 *
 * **Example** (Round-trip a TypeError brand)
 *
 * ```ts
 * import { createErrorValue, errorBrandName } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * const error = createErrorValue("TypeError", "x")
 * console.log(errorBrandName(error))
 * console.log(errorBrandName({ name: "TypeError", message: "x" }))
 * ```
 *
 * @see {@link createErrorValue} for the constructor that writes the brand.
 * @see {@link coerceToString} for formatting that depends on this brand.
 * @category getters
 * @since 0.0.0
 */
export const errorBrandName = (value: unknown): ErrorConstructorName | undefined => {
  if (P.isNull(value) || !P.isObjectKeyword(value)) return undefined;
  const name = Reflect.get(value, ErrorBrand);
  return S.is(ErrorConstructorName)(name) ? name : undefined;
};

/**
 * Copies a value into CodeMode's bounded data representation, preserving
 * CodeMode values.
 *
 * **Example** (Copy a plain object through the data boundary)
 *
 * ```ts
 * import { boundedData } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * const copied = boundedData({ ok: true }, "example")
 * console.log(copied)
 * ```
 *
 * @see {@link copyIn} for the underlying copy with an optional preserve flag.
 * @see {@link invokeCoercion} for String() which must not boundedData error brands.
 * @category utilities
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const boundedData = (value: unknown, label: string): unknown => copyIn(value, label, true)

/**
 * Coerces a guest value to a string using CodeMode Date/RegExp/URL and Error
 * branding rather than host `ToPrimitive`.
 *
 * **Gotchas**
 *
 * Error-branded SafeObjects follow `Error.prototype.toString`: `"name: message"`,
 * or just one side when the other is empty. Arrays join via this function, not
 * host `Array.prototype.toString`. Do not {@link boundedData} an error value
 * first or the brand is stripped and the result becomes `"[object Object]"`.
 *
 * **Example** (Stringify null, an error, and an array)
 *
 * ```ts
 * import { coerceToString, createErrorValue } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(coerceToString(null))
 * console.log(coerceToString(createErrorValue("TypeError", "x")))
 * console.log(coerceToString([1, 2]))
 * ```
 *
 * @see {@link coerceToNumber} for numeric coercion of the same values.
 * @see {@link invokeCoercion} for the String() entry that preserves error brands.
 * @see {@link createErrorValue} for the branded object this formats.
 * @category utilities
 * @since 0.0.0
 */
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

/**
 * Coerces a guest value to a number using CodeMode Date time and string
 * coercion for arrays.
 *
 * **Gotchas**
 *
 * Arrays coerce via {@link coerceToString} because host `Number(array)` hits
 * null-prototype `ToPrimitive` and throws on interpreter objects. Other
 * CodeMode values become `NaN`. Plain objects become `NaN`.
 *
 * **Example** (Coerce a Date, an array, and undefined)
 *
 * ```ts
 * import { CodeModeDate } from "../../../codemode/Codemode.values.ts"
 * import { coerceToNumber } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * console.log(coerceToNumber(CodeModeDate.new(1_000)))
 * console.log(coerceToNumber(["1"]))
 * console.log(Number.isNaN(coerceToNumber({})))
 * ```
 *
 * @see {@link coerceToString} for the string path arrays use first.
 * @see {@link invokeCoercion} for Number() which treats no-args as 0.
 * @category utilities
 * @since 0.0.0
 */
export const coerceToNumber = (value: unknown): number => {
  if (CodeModeDate.is(value)) return value.time
  if (isCodeModeValue(value)) return Number.NaN
  // Arrays coerce through our own string coercion: host Number(array) joins with host
  // ToPrimitive, which throws on the null-prototype objects the interpreter produces.
  if (Array.isArray(value)) return Number(coerceToString(value))
  return P.isNotNull(value) && P.isObjectKeyword(value) ? Number.NaN : Number(value)
}

/**
 * Dispatches guest `Boolean`, `Number`, `String`, `isFinite`, `isNaN`,
 * `parseInt`, and `parseFloat`.
 *
 * **Gotchas**
 *
 * `Number()` with no arguments is `0`, unlike `Number(undefined)` which is
 * `NaN`. `String()` must not {@link boundedData} error-branded SafeObjects or
 * {@link errorBrandName} is stripped and the result becomes `"[object Object]"`.
 *
 * **Example** (Number with no args is 0)
 *
 * ```ts
 * import { CoercionFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { invokeCoercion } from "../../../codemode/stdlib/StdLib.value.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeCoercion(CoercionFunction.new("Number"), [], node))
 * console.log(invokeCoercion(CoercionFunction.new("Number"), [undefined], node))
 * console.log(invokeCoercion(CoercionFunction.new("String"), [], node))
 * ```
 *
 * @see {@link coerceToNumber} for the numeric conversion Number() uses.
 * @see {@link coerceToString} for the string conversion String() uses.
 * @see {@link createErrorValue} for branded errors String() must not copy first.
 * @see {@link errorBrandName} for detecting those branded errors.
 * @category interop
 * @since 0.0.0
 */
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
