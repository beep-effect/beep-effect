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

/** Every identity-bearing value retained by the CodeMode runtime. */
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

/** Runtime type for {@link RuntimeReferenceValue}. */
export type RuntimeReferenceValue = typeof RuntimeReferenceValue.Type;

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

// CodeMode values are data here, not opaque interpreter references.
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

// Reject cycles before mutation so later boundary walks remain safe.
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
