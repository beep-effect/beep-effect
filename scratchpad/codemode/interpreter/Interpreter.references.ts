/**
 * Identity-bearing guest values and walks that detect them before copy-out.
 *
 * {@link containsRuntimeReference} treats CodeMode dates/maps as references.
 * {@link containsOpaqueReference} treats those same values as data. Use the
 * latter at copy-out and throw rendering so branded guest collections survive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { A, P, R } from "@beep/utils";
import { MutableHashSet } from "effect";
import * as S from "effect/Schema";
import { ToolReference } from "../Codemode.tool-runtime.ts";
import {
  CodeModePromise,
  CodeModeValue,
  isCodeModeValue,
} from "../Codemode.values.ts";
import {
  type AstNode,
  GlobalNamespaceName,
  InterpreterRuntimeError,
  RuntimeReference,
} from "./Interpreter.model.ts";

const $I = $ScratchpadId.create("codemode/interpreter/Interpreter.references");

/**
 * Union of every identity-bearing value retained by the CodeMode runtime.
 *
 * Includes schema-owned {@link RuntimeReference}s, tool handles, promises, and
 * mutable CodeMode collections. Decode or guard with the attached codec statics.
 *
 * **Example** (Guard a GlobalNamespace as a runtime reference)
 *
 * ```ts
 * import { GlobalNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { RuntimeReferenceValue } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * console.log(RuntimeReferenceValue.is(GlobalNamespace.new("JSON")))
 * // true
 * console.log(RuntimeReferenceValue.is({ kind: "plain" }))
 * // false
 * ```
 *
 * @see {@link isRuntimeReference} for the attached type guard.
 * @category schemas
 * @since 0.0.0
 */
export const RuntimeReferenceValue = S.Union([
  RuntimeReference,
  ToolReference,
  CodeModePromise,
  CodeModeValue,
]).pipe(
  $I.annoteSchema("RuntimeReferenceValue", {
    description: "Every schema-owned runtime reference and mutable guest value.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Decoded identity-bearing value produced by {@link RuntimeReferenceValue}.
 *
 * @see {@link RuntimeReferenceValue} for the runtime schema and decoded representation.
 * @category type-level
 * @since 0.0.0
 */
export type RuntimeReferenceValue = typeof RuntimeReferenceValue.Type;

/**
 * Type guard for {@link RuntimeReferenceValue}, including CodeMode collections.
 *
 * **Example** (Distinguish a branded date from a plain object)
 *
 * ```ts
 * import { CodeModeDate } from "../../../codemode/Codemode.values.ts"
 * import { isRuntimeReference } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * console.log(isRuntimeReference(CodeModeDate.new(0)))
 * // true
 * console.log(isRuntimeReference({ time: 0 }))
 * // false
 * ```
 *
 * @see {@link containsOpaqueReference} when CodeMode collections should count as data.
 * @category guards
 * @since 0.0.0
 */
export const isRuntimeReference = RuntimeReferenceValue.is;

const isFunctionRuntimeReference = RuntimeReference.isAnyOf([
  "CodeModeFunction",
  "GeneratorMethodReference",
  "CoercionFunction",
  "IntrinsicReference",
  "GlobalMethodReference",
  "JsonMethodReference",
  "PromiseMethodReference",
  "PromiseInstanceMethodReference",
  "PromiseNamespace",
  "PromiseCapabilityFunction",
  "ErrorConstructorReference",
  "SymbolNamespace",
  "UriFunction",
  "SearchFunction",
])

function* childValues(value: object): Generator<unknown> {
  if (A.isArray(value)) {
    const length = A.length(value)
    for (let index = 0; index < length; index++) yield value[index]
    return
  }
  yield* R.values(value)
}

/**
 * Returns whether `value` or any nested child is a {@link RuntimeReferenceValue}.
 *
 * **Gotchas**
 *
 * CodeMode dates, maps, sets, and similar collections are members of the union,
 * so this walk treats them as illegal for copy-out. Use
 * {@link containsOpaqueReference} when those values should remain data.
 *
 * **Example** (Detect a nested GlobalNamespace)
 *
 * ```ts
 * import { GlobalNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { containsRuntimeReference } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * console.log(containsRuntimeReference({ helper: GlobalNamespace.new("Math") }))
 * // true
 * console.log(containsRuntimeReference({ helper: 1 }))
 * // false
 * ```
 *
 * @see {@link containsOpaqueReference} for the walk that skips CodeMode collections.
 * @category predicates
 * @since 0.0.0
 */
export const containsRuntimeReference = (value: unknown): boolean => {
  const pending: Array<Iterator<unknown>> = [[value].values()]
  const seen = MutableHashSet.empty<object>()
  while (pending.length > 0) {
    const iterator = pending.at(-1)
    if (P.isUndefined(iterator)) break
    const next = iterator.next()
    if (next.done === true) {
      pending.pop()
      continue
    }
    const current = next.value
    if (isRuntimeReference(current)) return true
    if (P.isNull(current) || !P.isObject(current) || MutableHashSet.has(seen, current)) continue
    MutableHashSet.add(seen, current)
    pending.push(childValues(current))
  }
  return false
}

/**
 * Returns whether `value` contains an opaque interpreter reference, skipping
 * CodeMode collections.
 *
 * **Gotchas**
 *
 * CodeMode values are data here, not opaque interpreter references. A
 * `CodeModeDate` nested in a result is allowed; a {@link GlobalNamespace} or
 * function handle is not. Using {@link containsRuntimeReference} at copy-out
 * incorrectly rejects branded guest collections.
 *
 * **Example** (Allow a CodeModeDate while rejecting a namespace)
 *
 * ```ts
 * import { CodeModeDate } from "../../../codemode/Codemode.values.ts"
 * import { GlobalNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import {
 *   containsOpaqueReference,
 *   containsRuntimeReference,
 * } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * const date = CodeModeDate.new(0)
 * console.log(containsRuntimeReference(date), containsOpaqueReference(date))
 * // true false
 * console.log(containsOpaqueReference(GlobalNamespace.new("Math")))
 * // true
 * ```
 *
 * @see {@link containsRuntimeReference} for the walk that also flags CodeMode collections.
 * @see {@link typeofValue} for guest `typeof` of namespaces and function handles.
 * @category predicates
 * @since 0.0.0
 */
export const containsOpaqueReference = (value: unknown): boolean => {
  const pending: Array<Iterator<unknown>> = [[value].values()]
  const seen = MutableHashSet.empty<object>()
  while (pending.length > 0) {
    const iterator = pending.at(-1)
    if (P.isUndefined(iterator)) break
    const next = iterator.next()
    if (next.done === true) {
      pending.pop()
      continue
    }
    const current = next.value
    if (isCodeModeValue(current)) continue
    if (isRuntimeReference(current)) return true
    if (P.isNull(current) || !P.isObject(current) || MutableHashSet.has(seen, current)) continue
    MutableHashSet.add(seen, current)
    pending.push(childValues(current))
  }
  return false
}

/**
 * Throws if inserting `value` into `container` would create a cycle.
 *
 * **Gotchas**
 *
 * Cycles are rejected before mutation so later JSON and copy-out walks stay
 * safe. Runtime references are skipped while walking so a function handle
 * stored on an object is not treated as a nested graph. Detecting a cycle after
 * insertion makes JSON and copy-out diverge.
 *
 * **Example** (Reject an array that already contains itself)
 *
 * ```ts
 * import { InterpreterFailure } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { rejectCircularInsertion } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * const container: Array<unknown> = []
 * container.push(container)
 * try {
 *   rejectCircularInsertion(container, container, "array", { type: "ArrayExpression" })
 * } catch (error) {
 *   console.log(
 *     InterpreterFailure.guards.InterpreterRuntimeError(error) ? error.message : error,
 *   )
 * }
 * // array contains a circular value.
 * ```
 *
 * @see {@link containsOpaqueReference} for the post-mutation copy-out walk this keeps safe.
 * @throws InterpreterRuntimeError with kind `InvalidDataValue` when `value` transitively contains `container`.
 * @category assertions
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const rejectCircularInsertion = (container: object, value: unknown, label: string, node: AstNode): void => {
  const pending: Array<Iterator<unknown>> = [[value].values()]
  const seen = MutableHashSet.empty<object>()
  while (pending.length > 0) {
    const iterator = pending.at(-1)
    if (P.isUndefined(iterator)) break
    const next = iterator.next()
    if (next.done === true) {
      pending.pop()
      continue
    }
    const current = next.value
    if (current === container)
      throw InterpreterRuntimeError.new(`${label} contains a circular value.`, node, "InvalidDataValue")
    if (
      P.isNull(current) ||
      !P.isObject(current) ||
      isRuntimeReference(current) ||
      MutableHashSet.has(seen, current)
    ) continue
    MutableHashSet.add(seen, current)
    pending.push(A.isArray(current) ? current[Symbol.iterator]() : childValues(current))
  }
}

/**
 * Guest `typeof` that lies like JavaScript for namespaces and function handles.
 *
 * **Gotchas**
 *
 * Function-like {@link RuntimeReference}s and non-empty tool paths report
 * `"function"`. {@link GlobalNamespace} constructors (`Array`, `Date`, `Map`,
 * ...) report `"function"`; `Math`, `JSON`, and `console` report `"object"`.
 * Host `typeof` on a namespace object reports `"object"` for everything and
 * must not be used.
 *
 * **Example** (Constructor vs Math namespace)
 *
 * ```ts
 * import {
 *   CoercionFunction,
 *   GlobalNamespace,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { typeofValue } from "../../../codemode/interpreter/Interpreter.references.ts"
 *
 * console.log(typeofValue(GlobalNamespace.new("Array")))
 * // function
 * console.log(typeofValue(GlobalNamespace.new("Math")))
 * // object
 * console.log(typeofValue(CoercionFunction.new("Number")))
 * // function
 * ```
 *
 * @see {@link containsOpaqueReference} for copy-out classification of the same values.
 * @see {@link isSupportedCallback} for the admission gate that uses this typeof.
 * @category getters
 * @since 0.0.0
 */
export const typeofValue = (value: unknown): string => {
  if (RuntimeReference.is(value) && isFunctionRuntimeReference(value)) return "function"
  if (ToolReference.is(value)) return A.isReadonlyArrayNonEmpty(value.path) ? "function" : "object"
  if (RuntimeReference.guards.GlobalNamespace(value)) {
    return GlobalNamespaceName.$match(value.name, {
      Object: () => "function",
      Array: () => "function",
      Date: () => "function",
      RegExp: () => "function",
      Map: () => "function",
      Set: () => "function",
      URL: () => "function",
      URLSearchParams: () => "function",
      Math: () => "object",
      JSON: () => "object",
      console: () => "object",
    })
  }
  return typeof value
}
