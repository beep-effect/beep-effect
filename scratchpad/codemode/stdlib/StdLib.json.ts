import { DateTime, Effect, MutableHashSet } from "effect"
import type { CallbackRunner } from "../interpreter/Interpreter.methods.ts"
import { applyCollectionCallback } from "../interpreter/Interpreter.methods.ts"
import {
  type AstNode,
  type InterpreterFailure,
  InterpreterRuntimeError,
  JsonMethodName as JsonMethodNameSchema,
  JsonMethodReference,
} from "../interpreter/Interpreter.model.ts"
import { typeofValue } from "../interpreter/Interpreter.references.ts"
import { copyIn, copyOut } from "../Codemode.tool-runtime.ts"
import { SafeObject } from "@beep/schema";
import { P, A } from "@beep/utils";
import {
  CodeModeDate,
  CodeModeMap,
  CodeModeRegExp,
  CodeModeSet,
  CodeModeURL,
  CodeModeURLSearchParams,
} from "../Codemode.values.ts"

export const jsonStatics = JsonMethodNameSchema
export type JsonMethodName = typeof jsonStatics.Type

/**
 * Guest ECMAScript JSON adapter.
 *
 * Native JSON parsing/stringification is deliberate in this file: schema JSON
 * codecs cannot preserve guest reviver/replacer call order, sparse-array
 * omission semantics, or native error behavior. Host and protocol JSON uses
 * Effect Schema codecs elsewhere in CodeMode.
 */
export const invokeJsonMethod = <R>(
  runner: CallbackRunner<R>,
  ref: JsonMethodReference | JsonMethodName,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const reference = P.isString(ref)
    ? JsonMethodReference.new(ref)
    : ref

  return JsonMethodReference.match(reference, {
    parse: () => parse(runner, args, node),
    stringify: () => stringify(runner, args, node),
  })
}

const parse = <R>(
  runner: CallbackRunner<R>,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const text = args[0]
  if (typeof text !== "string") throw InterpreterRuntimeError.new("JSON.parse expects a string.", node)

  const parsed = (() => {
    try {
      return copyIn(JSON.parse(text), "JSON.parse result")
    } catch (error) {
      throw InterpreterRuntimeError.new(
        `JSON.parse received invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        node,
      ).as("SyntaxError")
    }
  })()
  if (typeofValue(args[1]) !== "function") return Effect.succeed(parsed)

  const apply = applyCollectionCallback(runner, args[1], "JSON.parse", node)
  const root: SafeObject = Object.create(null) as SafeObject
  Reflect.set(root, "", parsed)
  const visit = (
    holder: SafeObject | Array<unknown>,
    key: string
  ): Effect.Effect<unknown, InterpreterFailure, R> =>
    Effect.gen(function* () {
      const value = holder[key as keyof typeof holder]
      if (Array.isArray(value)) {
        const length = value.length
        for (let index = 0; index < length; index += 1) {
          const revived = yield* visit(value, String(index))
          if (revived === undefined) Reflect.deleteProperty(value, index)
          else value[index] = revived
        }
      } else if (isPlainObject(value)) {
        for (const name of Object.keys(value)) {
          const revived = yield* visit(value, name)
          if (revived === undefined) Reflect.deleteProperty(value, name)
          else Reflect.set(value, name, revived)
        }
      }
      return yield* apply([key, value])
    })
  return visit(root, "")
}

const stringify = <R>(
  runner: CallbackRunner<R>,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const space = args[2]
  const indent = typeof space === "number" || typeof space === "string" ? space : undefined
  const replacer = args[1]
  const callable = typeofValue(replacer) === "function"
  const checked = copyIn(args[0], "JSON.stringify value", callable)
  const input = callable ? args[0] : checked

  if (Array.isArray(replacer)) {
    const properties = replacer
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map(String)
    return Effect.succeed(JSON.stringify(copyOut(input, "json"), properties, indent))
  }
  if (!callable) {
    return Effect.succeed(JSON.stringify(copyOut(input, "json"), null, indent))
  }

  const apply = applyCollectionCallback(runner, replacer, "JSON.stringify", node)
  const root: SafeObject = Object.create(null) as SafeObject
  Reflect.set(root, "", input)
  const stack = MutableHashSet.empty<object>()
  const visit = (
    holder: SafeObject | Array<unknown>,
    key: string
  ): Effect.Effect<unknown, InterpreterFailure, R> =>
    Effect.gen(function* () {
      const value = yield* apply([key, toJSONValue(holder[key as keyof typeof holder])])
      if (value === undefined || typeofValue(value) === "function") return undefined
      copyIn(value, "JSON.stringify replacer result", true)
      if (typeof value === "number") return Number.isFinite(value) ? value : null
      if (value === null || typeof value === "string" || typeof value === "boolean") return value
      if (Array.isArray(value)) {
        if (MutableHashSet.has(stack, value))
          throw InterpreterRuntimeError.new("Converting circular structure to JSON.", node).as("TypeError")
        MutableHashSet.add(stack, value)
        const result = A.empty<unknown>();
        for (let index = 0; index < value.length; index += 1) {
          result.push((yield* visit(value, String(index))) ?? null)
        }
        MutableHashSet.remove(stack, value)
        return result
      }
      if (!isPlainObject(value)) return {}
      if (MutableHashSet.has(stack, value))
        throw InterpreterRuntimeError.new("Converting circular structure to JSON.", node).as("TypeError")
      MutableHashSet.add(stack, value)
      const result: SafeObject = Object.create(null) as SafeObject
      for (const name of Object.keys(value)) {
        const item = yield* visit(value, name)
        if (item !== undefined) Reflect.set(result, name, item)
      }
      MutableHashSet.remove(stack, value)
      return result
    })

  return Effect.map(visit(root, ""), (value) => JSON.stringify(value, null, indent))
}

const toJSONValue = (value: unknown): unknown => {
  if (value instanceof CodeModeDate) {
    return Number.isFinite(value.time)
      ? DateTime.makeUnsafe(value.time).pipe(DateTime.formatIso)
      : null
  }
  if (value instanceof CodeModeURL) return value.url.href
  return value
}

const isPlainObject = (value: unknown): value is SafeObject =>
  P.isNotNull(value) &&
  P.isObjectKeyword(value) &&
  !(value instanceof CodeModeDate) &&
  !(value instanceof CodeModeRegExp) &&
  !(value instanceof CodeModeMap) &&
  !(value instanceof CodeModeSet) &&
  !(value instanceof CodeModeURL) &&
  !(value instanceof CodeModeURLSearchParams)
