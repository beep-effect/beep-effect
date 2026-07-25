import { LiteralKit } from "@beep/schema";
import { P, A, R } from "@beep/utils"
import { Effect } from "effect"
import * as S from "effect/Schema"
import {
  type AstNode,
  AsyncIteratorSymbol,
  type InterpreterFailure,
  InterpreterRuntimeError,
  IteratorSymbol,
  IteratorSymbols,
} from "../interpreter/Interpreter.model.ts"
import { containsOpaqueReference } from "../interpreter/Interpreter.references.ts"
import { isBlockedMember } from "../Codemode.tool-runtime.ts"
import { isCodeModeValue, CodeModePromise } from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"
import { preserveConsumerError, type SyncIteratorRunner } from "../interpreter/Interpreter.iterator.ts"

export const objectMethodsPreservingIdentity = LiteralKit(["assign", "values", "entries", "fromEntries"])

export const objectStatics = LiteralKit(["keys", "values", "entries", "hasOwn", "is", "assign", "fromEntries", "groupBy"])

const DirectObjectMethod = LiteralKit(["keys", "values", "entries", "hasOwn", "is", "assign"])

export const invokeObjectMethod = (name: string, args: Array<unknown>, node: AstNode): unknown => {
  const requireObject = (): Record<string, unknown> => {
    const input = args[0]
    if (A.isArray(input)) return input as unknown as Record<string, unknown>
    if (isCodeModeValue(input)) return {}
    if (CodeModePromise.is(input)) {
      throw InterpreterRuntimeError.new(
        `Object.${name} received an un-awaited Promise; await it before inspecting the result.`,
        node,
        "InvalidDataValue",
      )
    }
    if (P.isNull(input) || !P.isObjectKeyword(input)) {
      throw InterpreterRuntimeError.new(`Object.${name} expects a data object or array.`, node, "InvalidDataValue")
    }
    const prototype = Object.getPrototypeOf(input)
    if (P.isNotNull(prototype) && prototype !== Object.prototype) {
      throw InterpreterRuntimeError.new(`Object.${name} expects a data object or array.`, node, "InvalidDataValue")
    }
    return input as Record<string, unknown>
  }
  const guardedSet = (out: Record<string, unknown>, key: string, item: unknown): void => {
    if (isBlockedMember(key)) throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, node)
    out[key] = item
  }
  if (!S.is(DirectObjectMethod)(name)) {
    throw InterpreterRuntimeError.new(`Object.${name} is not available.`, node)
  }
  return DirectObjectMethod.$match(name, {
    keys: () => R.keys(requireObject()),
    values: () => R.values(requireObject()),
    entries: () => A.map(R.toEntries(requireObject()), ([key, item]) => [key, item]),
    hasOwn: () =>
      P.hasProperty(
        requireObject(),
        args[1] === AsyncIteratorSymbol || args[1] === IteratorSymbol ? args[1] : String(args[1]),
      ),
    is: () => {
      if (containsOpaqueReference(args[0]) || containsOpaqueReference(args[1])) {
        throw InterpreterRuntimeError.new("Object.is requires data values.", node, "InvalidDataValue")
      }
      return Object.is(args[0], args[1])
    },
    assign: () => {
      const target = args[0]
      if (P.isNull(target) || !P.isObjectKeyword(target) || A.isArray(target) || isCodeModeValue(target)) {
        throw InterpreterRuntimeError.new("Object.assign expects a data object target.", node)
      }
      const out = target as Record<string, unknown>
      for (const source of args.slice(1)) {
        if (P.isNull(source) || P.isUndefined(source) || isCodeModeValue(source)) continue
        if (!P.isObjectKeyword(source) || A.isArray(source)) {
          throw InterpreterRuntimeError.new("Object.assign expects data objects.", node)
        }
        for (const [key, item] of Object.entries(source)) guardedSet(out, key, item)
        for (const symbol of IteratorSymbols) {
          if (P.hasProperty(source, symbol)) Reflect.set(out, symbol, Reflect.get(source, symbol))
        }
      }
      return out
    },
  })
}

export const invokeObjectFromEntries = <R>(
  runner: SyncIteratorRunner<R>,
  source: unknown,
  node: AstNode,
): Effect.Effect<Record<string, unknown>, InterpreterFailure, R> => {
  const out: Record<string, unknown> = Object.create(null)
  return Effect.gen(function* () {
    const cursor = yield* runner.syncIterator(source, node)
    if (P.isUndefined(cursor)) {
      throw InterpreterRuntimeError.new("Object.fromEntries expects a synchronous iterable of entries.", node).as(
        "TypeError",
      )
    }
    while (true) {
      const step = yield* cursor.next
      if (step.done) return out
      yield* preserveConsumerError(
        cursor,
        Effect.sync(() => {
          if (
            P.isNull(step.value) ||
            !P.isObjectKeyword(step.value) ||
            isCodeModeValue(step.value) ||
            containsOpaqueReference(step.value)
          ) {
            throw InterpreterRuntimeError.new("Object.fromEntries expects [key, value] entry objects.", node).as(
              "TypeError",
            )
          }
          const entry = step.value as Record<string, unknown>
          boundedData(entry[0], "Object.fromEntries key")
          boundedData(entry[1], "Object.fromEntries value")
          const key = coerceToString(entry[0])
          if (isBlockedMember(key)) throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, node)
          out[key] = entry[1]
        }),
      )
    }
  })
}
