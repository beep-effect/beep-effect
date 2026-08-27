/**
 * Guest `Object` statics that inspect or copy data objects while rejecting
 * un-awaited promises and blocked keys.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { P, A, R } from "@beep/utils"
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
import { isCodeModeValue, CodeModePromise, makeEmptySafeObject } from "../Codemode.values.ts"
import { boundedData, coerceToString } from "./StdLib.value.ts"
import { preserveConsumerError, type SyncIteratorRunner } from "../interpreter/Interpreter.iterator.ts"
import { type ObjectStatic, objectStatics } from "../Codemode.method-names.ts"

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.object");

/**
 * Object statics that preserve the target's identity instead of allocating a
 * fresh data object (`assign`, `values`, `entries`, `fromEntries`).
 *
 * **Example** (Confirm assign is identity-preserving)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { objectMethodsPreservingIdentity } from "../../../codemode/stdlib/StdLib.object.ts"
 *
 * console.log(S.is(objectMethodsPreservingIdentity)("assign"))
 * console.log(S.is(objectMethodsPreservingIdentity)("keys"))
 * ```
 *
 * @see {@link invokeObjectMethod} for keys, assign, and other direct statics.
 * @see {@link invokeObjectFromEntries} for the fromEntries iterable adapter.
 * @category schemas
 * @since 0.0.0
 */
export const objectMethodsPreservingIdentity = LiteralKit(
  objectStatics.pickOptions(["assign", "values", "entries", "fromEntries"])
).pipe(
  $I.annoteSchema("objectMethodsPreservingIdentity", {
    description: "Object statics that keep the target object's identity.",
  })
)

/**
 * Decoded value produced by {@link objectMethodsPreservingIdentity}.
 *
 * @see {@link objectMethodsPreservingIdentity} for the runtime identity-preserving kit.
 * @category type-level
 * @since 0.0.0
 */
export type objectMethodsPreservingIdentity = typeof objectMethodsPreservingIdentity.Type;

export { objectStatics } from "../Codemode.method-names.ts"

const DirectObjectMethod = LiteralKit(
  objectStatics.omitOptions(["fromEntries", "groupBy"])
)
type DirectObjectMethod = Exclude<ObjectStatic, "fromEntries" | "groupBy">;

/**
 * Dispatches guest `Object` statics over data objects and arrays.
 *
 * **Gotchas**
 *
 * An un-awaited {@link CodeModePromise} throws `InvalidDataValue` ("await it
 * before inspecting"). Other CodeMode values become `{}`. Prototypes other than
 * `Object.prototype` are rejected. `assign` throws on {@link isBlockedMember}
 * keys such as `__proto__`. This is not host `Object.*`.
 *
 * **Example** (List keys of a data object)
 *
 * ```ts
 * import { invokeObjectMethod } from "../../../codemode/stdlib/StdLib.object.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeObjectMethod("keys", [{ a: 1, b: 2 }], node))
 * ```
 *
 * @see {@link invokeObjectFromEntries} for building an object from entries.
 * @see {@link objectMethodsPreservingIdentity} for the identity-preserving subset including fromEntries.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
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
    keys: () => R.keys(requireObject()),
    values: () => R.values(requireObject()),
    entries: () => A.map(R.toEntries(requireObject()), ([key, item]) => [key, item]),
    hasOwn: () =>
      R.has(
        requireObject() as Readonly<Record<string | symbol, unknown>>,
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
        for (const [key, item] of R.toEntries(source)) guardedSet(out, key, item)
        for (const symbol of IteratorSymbols) {
          if (P.hasProperty(source, symbol)) Reflect.set(out, symbol, Reflect.get(source, symbol))
        }
      }
      return out
    },
  })
}

/**
 * Builds a null-prototype object from a synchronous iterable of `[key, value]`
 * entries.
 *
 * **Gotchas**
 *
 * The source must be a synchronous iterable. Async iterables throw `TypeError`.
 * Blocked keys such as `__proto__` fail at the entry, not when later read.
 *
 * **Example** (Build an object from entries)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { invokeObjectFromEntries } from "../../../codemode/stdlib/StdLib.object.ts"
 *
 * const node = { type: "CallExpression" }
 * const runner = {
 *   syncIterator: (value: unknown) => {
 *     if (!Array.isArray(value)) return Effect.succeed(undefined)
 *     let index = 0
 *     return Effect.succeed({
 *       next: Effect.sync(() => {
 *         if (index >= value.length) return { done: true, value: undefined }
 *         const current = value[index]
 *         index += 1
 *         return { done: false, value: current }
 *       }),
 *       close: Effect.void,
 *     })
 *   },
 * }
 * const object = await Effect.runPromise(
 *   invokeObjectFromEntries(runner, [["a", 1]], node)
 * )
 * console.log(object)
 * ```
 *
 * @see {@link invokeObjectMethod} for Object.keys and the other direct statics.
 * @see {@link objectMethodsPreservingIdentity} for the identity-preserving subset that includes fromEntries.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest iterable, AST context, and callback runner are co-primary interpreter protocol inputs.
export const invokeObjectFromEntries = <R>(
  runner: SyncIteratorRunner<R>,
  source: unknown,
  node: AstNode,
): Effect.Effect<Record<string, unknown>, InterpreterFailure, R> => {
  const out: Record<string, unknown> = makeEmptySafeObject()
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
