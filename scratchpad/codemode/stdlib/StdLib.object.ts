import { LiteralKit } from "@beep/schema";
import { P, A } from "@beep/utils"
import { Effect } from "effect"
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
import { type ObjectStatic, objectStatics } from "../Codemode.method-names.ts"

export const objectMethodsPreservingIdentity = LiteralKit(
  objectStatics.pickOptions(["assign", "values", "entries", "fromEntries"])
)

export { objectStatics } from "../Codemode.method-names.ts"

const DirectObjectMethod = LiteralKit(
  objectStatics.omitOptions(["fromEntries", "groupBy"])
)
type DirectObjectMethod = Exclude<ObjectStatic, "fromEntries" | "groupBy">;

export const invokeObjectMethod = (name: DirectObjectMethod, args: Array<unknown>, node: AstNode): unknown => {
  const requireObject = (): object => {
    const input = args[0]
    if (A.isArray(input)) return input
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
    return input
  }
  const guardedSet = (out: object, key: string, item: unknown): void => {
    if (isBlockedMember(key)) throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, node)
    Reflect.set(out, key, item)
  }
  return DirectObjectMethod.$match(name, {
    keys: () => Object.keys(requireObject()),
    values: () => Object.values(requireObject()),
    entries: () => A.map(Object.entries(requireObject()), ([key, item]) => [key, item]),
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
      const out = target
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
          const entryKey = Reflect.get(step.value, "0");
          const entryValue = Reflect.get(step.value, "1");
          boundedData(entryKey, "Object.fromEntries key")
          boundedData(entryValue, "Object.fromEntries value")
          const key = coerceToString(entryKey)
          if (isBlockedMember(key)) throw InterpreterRuntimeError.new(`Property '${key}' is not available.`, node)
          out[key] = entryValue
        }),
      )
    }
  })
}
