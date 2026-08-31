/**
 * Dispatch surface for guest intrinsics, globals, and collection callbacks.
 *
 * **Details**
 *
 * {@link invokeGlobalMethod} is synchronous and hard-rejects helpers that live
 * on Effect adapters such as {@link invokeArrayFrom} and {@link invokeGroupBy}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LiteralKit, SafeObject } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A, O, P, pipe, R } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import {
  type ArrayMethod,
  type ArrayStatic,
  arrayMethods,
  arrayStatics,
  type MapMethod,
  mapMethods,
  type SetMethod,
  type StringMethod,
  setMethods,
  stringMethods,
  UrlSearchParamsMethod,
} from "../Codemode.method-names.ts";
import { isBlockedMember } from "../Codemode.tool-runtime.ts";
import {
  CodeModeMap,
  CodeModePromise,
  CodeModeRegExp,
  CodeModeSet,
  type CodeModeURLSearchParams,
  isCodeModeValue,
} from "../Codemode.values.ts";
import { dateSetterArgumentCount, invokeDateMethod, invokeDateStatic } from "../stdlib/StdLib.date.ts";
import { invokeMathMethod } from "../stdlib/StdLib.math.ts";
import { invokeNumberMethod, invokeNumberStatic } from "../stdlib/StdLib.number.ts";
import { invokeObjectMethod } from "../stdlib/StdLib.object.ts";
import { invokeRegExpMethod, invokeRegExpStatic, matchToValue, toHostRegex } from "../stdlib/StdLib.regexp.ts";
import { invokeStringStatic } from "../stdlib/StdLib.string.ts";
import { invokeURLMethod, invokeURLStatic, uriArgument } from "../stdlib/StdLib.url.ts";
import { boundedData, coerceToNumber, coerceToString, errorBrandName } from "../stdlib/StdLib.value.ts";
import { preserveConsumerError, type SyncIteratorRunner } from "./Interpreter.iterator.ts";
import {
  type AstNode,
  type CodeModeFunction,
  CodeModeGenerator,
  type CoercionFunction,
  type ErrorConstructorReference,
  GlobalMethod,
  type GlobalMethodReference,
  type GlobalNamespace,
  type InterpreterFailure,
  InterpreterRuntimeError,
  IntrinsicMethod,
  type IntrinsicReference,
  type JsonMethodReference,
  type PromiseCapabilityFunction,
  type PromiseNamespace,
  RuntimeReference,
  tryInterpreter,
  type UriFunction,
} from "./Interpreter.model.ts";
import {
  containsOpaqueReference,
  isRuntimeReference,
  rejectCircularInsertion,
  typeofValue,
} from "./Interpreter.references.ts";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

/**
 * Capability used to invoke guest functions and settle guest promises.
 *
 * **Details**
 *
 * Collection adapters, string replacers, and promise reactions all go through
 * this runner rather than calling host functions directly.
 *
 * @see {@link SupportedCallback} for the closed set of callables this runner admits.
 * @see {@link applyCollectionCallback} for the adapter that wraps `invokeCallable`.
 * @category type-level
 * @since 0.0.0
 */
export type CallbackRunner<R> = {
  readonly invokeFunction: (
    fn: CodeModeFunction,
    args: Array<unknown>
  ) => Effect.Effect<unknown, InterpreterFailure, R>;
  readonly invokeCallable: (
    callable: unknown,
    args: Array<unknown>,
    node: AstNode
  ) => Effect.Effect<unknown, InterpreterFailure, R>;
  readonly settlePromise: (promise: CodeModePromise) => Effect.Effect<unknown, InterpreterFailure>;
};

/**
 * Closed set of callables admitted as collection, sort, replacer, or reaction callbacks.
 *
 * **Details**
 *
 * Admission means dispatchable, not necessarily invocable: new-requiring
 * constructors pass this gate and throw a TypeError on call, like JavaScript.
 *
 * @see {@link isSupportedCallback} for the runtime guard over this union.
 * @see {@link CallbackRunner} for the invocation capability those callbacks use.
 * @category type-level
 * @since 0.0.0
 */
export type SupportedCallback =
  | CodeModeFunction
  | CoercionFunction
  | UriFunction
  | PromiseCapabilityFunction
  | GlobalMethodReference
  | JsonMethodReference
  | IntrinsicReference
  | ErrorConstructorReference
  | GlobalNamespace
  | PromiseNamespace;

const isSupportedRuntimeCallback = RuntimeReference.isAnyOf([
  "CodeModeFunction",
  "CoercionFunction",
  "UriFunction",
  "PromiseCapabilityFunction",
  "GlobalMethodReference",
  "JsonMethodReference",
  "IntrinsicReference",
  "ErrorConstructorReference",
  "GlobalNamespace",
  "PromiseNamespace",
]);

/**
 * Guards whether a value is an admitted collection or reaction callback.
 *
 * **Gotchas**
 *
 * Admission is not call-safe. `Map` / `Set` / `URL` pass because they are
 * functions, then throw TypeError when called without `new`. Math, JSON, and
 * console stay non-callable (`typeof` `"object"`). Passing this guard does not
 * mean {@link invokeGlobalMethod} can run the value.
 *
 * **Example** (Array is admitted, Math is not)
 *
 * ```ts
 * import { GlobalNamespace } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { isSupportedCallback } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * console.log(isSupportedCallback(GlobalNamespace.new("Array")))
 * // true
 * console.log(isSupportedCallback(GlobalNamespace.new("Map")))
 * // true
 * console.log(isSupportedCallback(GlobalNamespace.new("Math")))
 * // false
 * ```
 *
 * @see {@link SupportedCallback} for the closed union this guard narrows to.
 * @see {@link applyCollectionCallback} for the call-site that still TypeErrors on host functions.
 * @category guards
 * @since 0.0.0
 */
export const isSupportedCallback = (value: unknown): value is SupportedCallback =>
  RuntimeReference.is(value) &&
  isSupportedRuntimeCallback(value) &&
  // Callable namespaces dispatch like JS: Array/Object/Date/RegExp construct,
  // new-requiring constructors throw a TypeError. Math/JSON/console stay non-callable.
  (!RuntimeReference.guards.GlobalNamespace(value) || typeofValue(value) === "function");

/**
 * Dispatches a bound intrinsic method on a guest receiver.
 *
 * **Gotchas**
 *
 * Date setters snapshot `receiver.time` before coercing arguments whose
 * callbacks may mutate the Date, matching native JS. String `replace` /
 * `replaceAll` callbacks must be {@link SupportedCallback} values; wrap host
 * callables in an arrow. Array/Map/Set/URLSearchParams methods that take
 * callbacks go through {@link applyCollectionCallback}.
 *
 * **Example** (Uppercase a string receiver)
 *
 * ```ts
 * import { Effect } from "effect"
 * import {
 *   IntrinsicMethod,
 *   IntrinsicReference,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { invokeIntrinsic } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 * }
 * const ref = IntrinsicReference.new(
 *   IntrinsicMethod.cases.String.make({ receiver: "Ada", name: "toUpperCase" }),
 * )
 * console.log(
 *   await Effect.runPromise(invokeIntrinsic(runner, ref, [], { type: "CallExpression" })),
 * )
 * // ADA
 * ```
 *
 * @see {@link applyCollectionCallback} for callback admission on collection methods.
 * @see {@link isSupportedCallback} for the replace-callback gate.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const invokeIntrinsic = <R>(
  runner: CallbackRunner<R>,
  ref: IntrinsicReference,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> =>
  IntrinsicMethod.match(ref.method, {
    String: ({ receiver, name }) => {
      if (name === "replace" || name === "replaceAll") {
        if (isSupportedCallback(args[1])) return invokeStringReplacer(runner, receiver, name, args, node);
        if (typeofValue(args[1]) === "function") {
          return Effect.fail(
            InterpreterRuntimeError.new(
              `String.${name} cannot use this callable as a replacer; wrap it in an arrow function, e.g. (match) => tools.ns.tool(match).`,
              node
            )
          );
        }
      }
      return Effect.fromResult(tryInterpreter(() => invokeStringMethod(receiver, name, args, node), node));
    },
    Number: ({ receiver, name }) =>
      Effect.fromResult(tryInterpreter(() => invokeNumberMethod(receiver, name, args, node), node)),
    Array: ({ receiver, name }) => invokeArrayMethod(runner, receiver, name, args, node),
    Date: ({ receiver, name }) => {
      const argumentCount = dateSetterArgumentCount(name);
      if (O.isNone(argumentCount)) {
        return Effect.fromResult(tryInterpreter(() => invokeDateMethod(receiver, name, [], node), node));
      }
      // Native setters read the current time before argument coercion, whose callbacks may mutate the Date.
      const initialTime = receiver.time;
      return Effect.flatMap(
        Effect.forEach(args.slice(0, argumentCount.value), (arg) => coerceNumericArgument(runner, arg, node), {
          concurrency: 1,
        }),
        (values) =>
          Effect.fromResult(tryInterpreter(() => invokeDateMethod(receiver, name, values, node, initialTime), node))
      );
    },
    RegExp: ({ receiver, name }) =>
      Effect.fromResult(tryInterpreter(() => invokeRegExpMethod(receiver, name, args, node), node)),
    Map: ({ receiver, name }) => invokeMapMethod(runner, receiver, name, args, node),
    Set: ({ receiver, name }) => invokeSetMethod(runner, receiver, name, args, node),
    URL: ({ receiver, name }) => Effect.fromResult(tryInterpreter(() => invokeURLMethod(receiver, name, node), node)),
    URLSearchParams: ({ receiver, name }) => invokeURLSearchParamsMethod(runner, receiver, name, args, node),
  });

const coerceNumericArgument = <R>(
  runner: CallbackRunner<R>,
  value: unknown,
  node: AstNode
): Effect.Effect<number, InterpreterFailure, R> => {
  if (!P.isObjectKeyword(value) || A.isArray(value) || isCodeModeValue(value)) {
    return Effect.succeed(coerceToNumber(value));
  }
  return Effect.gen(function* () {
    const valueOfMethod = Reflect.get(value, "valueOf");
    if (R.has(value as Readonly<Record<string, unknown>>, "valueOf") && typeofValue(valueOfMethod) === "function") {
      const result = yield* runner.invokeCallable(valueOfMethod, [], node);
      if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) {
        return coerceToNumber(result);
      }
    }
    if (!R.has(value as Readonly<Record<string, unknown>>, "toString")) return coerceToNumber(value);
    const toStringMethod = Reflect.get(value, "toString");
    if (typeofValue(toStringMethod) === "function") {
      const result = yield* runner.invokeCallable(toStringMethod, [], node);
      if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) {
        return coerceToNumber(result);
      }
    }
    throw InterpreterRuntimeError.new("Cannot convert object to primitive value.", node).as("TypeError");
  });
};

/**
 * Synchronously dispatches a static method on a guest global namespace.
 *
 * **Gotchas**
 *
 * This helper throws rather than returning `Effect`. It hard-rejects
 * `Object.fromEntries`, `Object.groupBy`, `Math.random`, `Math.sumPrecise`,
 * `Array.from`, `Date.now`, every `console.*`, and every `Map.*` with
 * `"is not available."`. Those live on {@link invokeArrayFrom} /
 * {@link invokeGroupBy} (Effect) or are intentionally blocked. Mixing this
 * sync helper with the Effect intrinsic adapters will not typecheck the same way.
 *
 * **Example** (Call Math.abs and see Array.from blocked)
 *
 * ```ts
 * import {
 *   GlobalMethod,
 *   GlobalMethodReference,
 *   InterpreterFailure,
 * } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { invokeGlobalMethod } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(
 *   invokeGlobalMethod(
 *     GlobalMethodReference.new(GlobalMethod.cases.Math.make({ name: "abs" })),
 *     [-3],
 *     node,
 *   ),
 * )
 * // 3
 *
 * try {
 *   invokeGlobalMethod(
 *     GlobalMethodReference.new(GlobalMethod.cases.Array.make({ name: "from" })),
 *     [[1, 2]],
 *     node,
 *   )
 * } catch (error) {
 *   console.log(
 *     InterpreterFailure.guards.InterpreterRuntimeError(error) ? error.message : error,
 *   )
 * }
 * // Array.from is not available.
 * ```
 *
 * @see {@link invokeArrayFrom} for the Effect `Array.from` adapter.
 * @see {@link invokeGroupBy} for the Effect `Object.groupBy` / `Map.groupBy` adapter.
 * @throws InterpreterRuntimeError when the method is blocked or the stdlib adapter throws TypeError/RangeError.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Interpreter dispatch uses co-primary reference/arguments/AST/runtime inputs; a data-last overload would misstate the protocol.
export const invokeGlobalMethod = (ref: GlobalMethodReference, args: Array<unknown>, node: AstNode): unknown => {
  const unavailable = (namespace: string, name: string): never => {
    throw InterpreterRuntimeError.new(`${namespace}.${name} is not available.`, node);
  };

  return GlobalMethod.match(ref.method, {
    Object: ({ name }) =>
      name === "fromEntries" || name === "groupBy" ? unavailable("Object", name) : invokeObjectMethod(name, args, node),
    Math: ({ name }) =>
      name === "random" || name === "sumPrecise" ? unavailable("Math", name) : invokeMathMethod(name, args, node),
    Array: ({ name }) => (name === "from" ? unavailable("Array", name) : invokeArrayStatic(name, args, node)),
    Number: ({ name }) => invokeNumberStatic(name, args, node),
    String: ({ name }) => invokeStringStatic(name, args, node),
    URL: ({ name }) => invokeURLStatic(name, args, node),
    Date: ({ name }) => (name === "now" ? unavailable("Date", name) : invokeDateStatic(name, args, node)),
    RegExp: ({ name }) => invokeRegExpStatic(name, args, node),
    console: ({ name }) => unavailable("console", name),
    Map: ({ name }) => unavailable("Map", name),
  });
};

const requireDataArgument = (name: StringMethod, index: number, arg: unknown, node: AstNode): unknown => {
  if (containsOpaqueReference(arg)) {
    throw InterpreterRuntimeError.new(
      `String.${name} expects argument ${index + 1} to be a data value.`,
      node,
      "InvalidDataValue"
    );
  }
  return arg;
};

const DirectStringMethod = LiteralKit(stringMethods.omitOptions(["match", "matchAll"]));
type DirectStringMethod = Exclude<StringMethod, "match" | "matchAll">;
const CallbackArrayMethodOptions = [
  "map",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "some",
  "every",
  "reduce",
  "reduceRight",
  "flatMap",
  "forEach",
] as const;
const CallbackArrayMethod = LiteralKit(arrayMethods.pickOptions(CallbackArrayMethodOptions));
const DirectArrayMethod = LiteralKit(arrayMethods.omitOptions(CallbackArrayMethodOptions));
type DirectArrayStatic = Exclude<ArrayStatic, "from">;

const invokeStringMethod = (value: string, name: StringMethod, args: Array<unknown>, node: AstNode): unknown => {
  // Coerce arguments like native JS; opaque runtime references still reject.
  const str = (index: number): string => coerceToString(requireDataArgument(name, index, args[index], node));
  const num = (index: number): number => coerceToNumber(requireDataArgument(name, index, args[index], node));
  const optNum = (index: number): number | undefined => (args[index] === undefined ? undefined : num(index));
  const optStr = (index: number): string | undefined => (args[index] === undefined ? undefined : str(index));
  const rejectRegex = (): void => {
    if (CodeModeRegExp.is(args[0])) {
      throw InterpreterRuntimeError.new(
        `String.${name} cannot take a regular expression; use regex.test(string) or String.search instead.`,
        node
      ).as("TypeError");
    }
  };

  if (name === "match") {
    const pattern = toHostRegex(args[0], name, node);
    const matched = value.match(pattern);
    if (matched === null) return null;
    // Preserve the own `index` and `groups` properties on non-global matches.
    if (pattern.global) return boundedData(matched, "String.match result");
    return matchToValue(matched);
  }
  if (name === "matchAll") {
    const pattern = toHostRegex(args[0], name, node, "g");
    if (!pattern.global) {
      throw InterpreterRuntimeError.new(
        `String.matchAll requires a regular expression with the global (g) flag: write /${pattern.source}/${pattern.flags}g, or use String.match for a single match.`,
        node
      );
    }
    return pipe(value.matchAll(pattern), A.fromIterable, A.map(matchToValue));
  }
  const normalize = (): string => {
    const form = optStr(0);
    try {
      return value.normalize(form);
    } catch {
      throw InterpreterRuntimeError.new(
        `String.normalize expects the form "NFC", "NFD", "NFKC", or "NFKD" (got ${encodeJson(form)}).`,
        node
      ).as("RangeError");
    }
  };
  const split = (): Array<string> => {
    // Native: an undefined separator returns the whole string, not a split on "undefined",
    // unless the limit truncates to zero.
    if (args[0] === undefined) {
      const requestedLimit = optNum(1);
      return requestedLimit !== undefined && requestedLimit >>> 0 === 0 ? [] : [value];
    }
    if (CodeModeRegExp.is(args[0])) {
      return value.split(args[0].regex, optNum(1));
    }
    const requestedLimit = optNum(1);
    return value.split(str(0), requestedLimit === undefined ? undefined : requestedLimit >>> 0);
  };
  const includes = (): boolean => {
    rejectRegex();
    return value.includes(str(0), optNum(1));
  };
  const startsWith = (): boolean => {
    rejectRegex();
    return value.startsWith(str(0), optNum(1));
  };
  const endsWith = (): boolean => {
    rejectRegex();
    return value.endsWith(str(0), optNum(1));
  };
  const replace = (all: boolean): string => {
    if (CodeModeRegExp.is(args[0])) {
      const pattern = args[0].regex;
      const replacement = str(1);
      if (all && !pattern.global) {
        throw InterpreterRuntimeError.new(
          `String.replaceAll requires a regular expression with the global (g) flag: write /${pattern.source}/${pattern.flags}g, or use String.replace to replace only the first match.`,
          node
        );
      }
      return all ? value.replaceAll(pattern, replacement) : value.replace(pattern, replacement);
    }
    return all ? value.replaceAll(str(0), str(1)) : value.replace(str(0), str(1));
  };
  const repeat = (): string => {
    const count = num(0);
    if (!Number.isFinite(count) || count < 0)
      throw InterpreterRuntimeError.new("String.repeat expects a finite non-negative count.", node).as("RangeError");
    return value.repeat(count);
  };
  const result = DirectStringMethod.$match(name, {
    toLowerCase: () => value.toLowerCase(),
    toUpperCase: () => value.toUpperCase(),
    trim: () => value.trim(),
    trimStart: () => value.trimStart(),
    trimEnd: () => value.trimEnd(),
    split,
    slice: () => value.slice(optNum(0), optNum(1)),
    substring: () => value.substring(optNum(0) ?? 0, optNum(1)),
    includes,
    startsWith,
    endsWith,
    indexOf: () => value.indexOf(str(0), optNum(1)),
    lastIndexOf: () => value.lastIndexOf(str(0), optNum(1)),
    replace: () => replace(false),
    replaceAll: () => replace(true),
    repeat,
    padStart: () => value.padStart(num(0), optStr(1)),
    padEnd: () => value.padEnd(num(0), optStr(1)),
    charAt: () => value.charAt(optNum(0) ?? 0),
    charCodeAt: () => value.charCodeAt(optNum(0) ?? 0),
    codePointAt: () => value.codePointAt(optNum(0) ?? 0),
    at: () => value.at(optNum(0) ?? 0),
    concat: () => value.concat(...args.map((_, index) => str(index))),
    toString: () => value,
    search: () => value.search(toHostRegex(args[0], name, node)),
    localeCompare: () => value.localeCompare(str(0)),
    normalize,
  });
  return boundedData(result, `String.${name} result`);
};

export { arrayStatics } from "../Codemode.method-names.ts";

const DirectArrayStatic = LiteralKit(arrayStatics.omitOptions(["from"]));

const invokeArrayStatic = (name: DirectArrayStatic, args: Array<unknown>, _node: AstNode): unknown =>
  DirectArrayStatic.$match(name, {
    isArray: () => A.isArray(args[0]),
    of: () => [...args],
  });

const arrayLikeSource = (
  source: unknown,
  node: AstNode
): {
  readonly length: number;
  readonly source: object;
} => {
  if (CodeModePromise.is(source)) {
    throw InterpreterRuntimeError.new(
      "Array.from received an un-awaited Promise; await it before creating the array.",
      node,
      "InvalidDataValue"
    );
  }
  if (
    P.isObjectKeyword(source) &&
    (Object.getPrototypeOf(source) === Object.prototype || Object.getPrototypeOf(source) === null)
  ) {
    const length = Reflect.get(source, "length");
    if (!P.isNumber(length)) {
      throw InterpreterRuntimeError.new(
        "Array.from expects an array, string, Map, Set, or array-like value.",
        node,
        "InvalidDataValue"
      );
    }
    const normalized = Number.isNaN(length) || length <= 0 ? 0 : Math.trunc(length);
    if (normalized > 4_294_967_295) {
      throw InterpreterRuntimeError.new("Invalid array length.", node).as("RangeError");
    }
    return { length: normalized, source };
  }
  throw InterpreterRuntimeError.new(
    "Array.from expects an array, string, Map, Set, or array-like value.",
    node,
    "InvalidDataValue"
  );
};

/**
 * Effect adapter for guest `Array.from` over iterables and array-likes.
 *
 * **Example** (Materialize an array-like source)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { invokeArrayFrom } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 *   syncIterator: () => Effect.succeed(undefined),
 * }
 *
 * const values = await Effect.runPromise(
 *   invokeArrayFrom(
 *     runner,
 *     [{ 0: "a", 1: "b", length: 2 }],
 *     { type: "CallExpression" },
 *   ),
 * )
 * console.log(values)
 * // [ "a", "b" ]
 * ```
 *
 * @see {@link invokeGlobalMethod} which hard-rejects `Array.from` so callers reach this helper.
 * @see {@link preserveConsumerError} for mapper-failure cleanup on iterable sources.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest iterable, mapper, AST context, and callback runner are co-primary interpreter protocol inputs.
export const invokeArrayFrom = <R>(
  runner: CallbackRunner<R> & SyncIteratorRunner<R>,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const source = args[0];
  const apply =
    args.length < 2 || args[1] === undefined ? undefined : applyCollectionCallback(runner, args[1], "Array.from", node);
  return Effect.gen(function* () {
    const cursor = yield* runner.syncIterator(source, node);
    if (P.isUndefined(cursor)) {
      if (CodeModeGenerator.is(source)) {
        throw InterpreterRuntimeError.new("Array.from expects a synchronous iterable or array-like value.", node).as(
          "TypeError"
        );
      }
      const arrayLike = arrayLikeSource(source, node);
      const values = A.empty<unknown>();
      for (let index = 0; index < arrayLike.length; index += 1) {
        const item = Reflect.get(arrayLike.source, index);
        values.push(apply === undefined ? item : yield* apply([item, index]));
      }
      return values;
    }
    const values = A.empty<unknown>();
    let index = 0;
    while (true) {
      const step = yield* cursor.next;
      if (step.done) return values;
      values.push(apply === undefined ? step.value : yield* preserveConsumerError(cursor, apply([step.value, index])));
      index += 1;
    }
  });
};

/**
 * Effect adapter for guest `Object.groupBy` and `Map.groupBy`.
 *
 * **Example** (Group an array through a callback that echoes the item)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { CoercionFunction } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { invokeGroupBy } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: (_callable: unknown, args: Array<unknown>) => Effect.succeed(args[0]),
 *   settlePromise: () => Effect.succeed(undefined),
 *   syncIterator: (value: unknown) => {
 *     if (!Array.isArray(value)) return Effect.succeed(undefined)
 *     let index = 0
 *     const items = value
 *     return Effect.succeed({
 *       next: Effect.sync(() => {
 *         if (index >= items.length) return { done: true, value: undefined }
 *         const current = items[index]
 *         index += 1
 *         return { done: false, value: current }
 *       }),
 *       close: Effect.void,
 *     })
 *   },
 * }
 *
 * const grouped = await Effect.runPromise(
 *   invokeGroupBy(
 *     runner,
 *     "Object",
 *     [[1, 1, 2], CoercionFunction.new("String")],
 *     { type: "CallExpression" },
 *   ),
 * )
 * console.log(Reflect.get(Object(grouped), "1"), Reflect.get(Object(grouped), "2"))
 * // [ 1, 1 ] [ 2 ]
 * ```
 *
 * @see {@link invokeGlobalMethod} which hard-rejects `Object.groupBy`.
 * @see {@link applyCollectionCallback} for callback admission.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Collection selector, source, AST context, and callback runner are co-primary interpreter protocol inputs.
export const invokeGroupBy = <R>(
  runner: CallbackRunner<R> & SyncIteratorRunner<R>,
  namespace: "Map" | "Object",
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const source = args[0];
  if (source === null || source === undefined) {
    throw InterpreterRuntimeError.new(`${namespace}.groupBy expects an iterable collection.`, node).as("TypeError");
  }
  const apply = applyCollectionCallback(runner, args[1], `${namespace}.groupBy`, node);
  return Effect.gen(function* () {
    const cursor = yield* runner.syncIterator(source, node);
    if (P.isUndefined(cursor)) {
      throw InterpreterRuntimeError.new(`${namespace}.groupBy expects an iterable collection.`, node).as("TypeError");
    }
    if (namespace === "Map") {
      const result = CodeModeMap.new();
      let index = 0;
      while (true) {
        const step = yield* cursor.next;
        if (step.done) return result;
        const item = step.value;
        const key = yield* preserveConsumerError(cursor, apply([item, index]));
        const group = result.map.get(key);
        if (group === undefined) result.map.set(key, [item]);
        else if (A.isArray(group)) group.push(item);
        else
          return yield* Effect.die(
            InterpreterRuntimeError.new("CodeMode Map.groupBy stored a non-array group.", node, "InvalidDataValue")
          );
        index += 1;
      }
    }

    const result = SafeObject.make(R.empty<string, unknown>());
    let index = 0;
    while (true) {
      const step = yield* cursor.next;
      if (step.done) return result;
      const item = step.value;
      const key = yield* preserveConsumerError(
        cursor,
        Effect.flatMap(apply([item, index]), (value) => coerceGroupByPropertyKey(runner, value, node))
      );
      if (isBlockedMember(key)) {
        return yield* preserveConsumerError(
          cursor,
          Effect.fail(InterpreterRuntimeError.new(`Property '${key}' is not available.`, node))
        );
      }
      const group = result[key];
      if (group === undefined) Reflect.set(result, key, [item]);
      else if (A.isArray(group)) group.push(item);
      else
        return yield* Effect.die(
          InterpreterRuntimeError.new("CodeMode Object.groupBy stored a non-array group.", node, "InvalidDataValue")
        );
      index += 1;
    }
  });
};

const coerceGroupByPropertyKey = <R>(
  runner: CallbackRunner<R>,
  value: unknown,
  node: AstNode
): Effect.Effect<string, InterpreterFailure, R> => {
  if (!P.isObjectKeyword(value) || A.isArray(value) || isCodeModeValue(value)) {
    return Effect.succeed(coerceToString(value));
  }
  if (CodeModePromise.is(value)) return Effect.succeed("[object Promise]");
  if (isRuntimeReference(value)) {
    throw InterpreterRuntimeError.new("Object.groupBy callback must return a data value.", node, "InvalidDataValue");
  }
  if (!R.has(value as Readonly<Record<string, unknown>>, "toString")) return Effect.succeed(coerceToString(value));
  return Effect.gen(function* () {
    const toStringMethod = Reflect.get(value, "toString");
    if (typeofValue(toStringMethod) === "function") {
      const result = yield* runner.invokeCallable(toStringMethod, [], node);
      if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) {
        return coerceToString(result);
      }
    }
    const valueOfMethod = Reflect.get(value, "valueOf");
    if (R.has(value as Readonly<Record<string, unknown>>, "valueOf") && typeofValue(valueOfMethod) === "function") {
      const result = yield* runner.invokeCallable(valueOfMethod, [], node);
      if (P.isNull(result) || (!P.isObjectKeyword(result) && !P.isFunction(result))) {
        return coerceToString(result);
      }
    }
    throw InterpreterRuntimeError.new("Cannot convert object to primitive value.", node).as("TypeError");
  });
};

const invokeStringReplacer = <R>(
  runner: CallbackRunner<R>,
  value: string,
  name: "replace" | "replaceAll",
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const apply = applyCollectionCallback(runner, args[1], `String.${name}`, node);
  const matches: Array<{
    readonly match: string;
    readonly offset: number;
    readonly args: Array<unknown>;
  }> = [];
  const collect = (...callbackArgs: Array<unknown>): string => {
    const match = callbackArgs[0];
    const groups = callbackArgs[callbackArgs.length - 1];
    const hasGroups = P.isObjectKeyword(groups);
    const offset = callbackArgs[callbackArgs.length - (hasGroups ? 3 : 2)];
    if (!P.isString(match) || !P.isNumber(offset)) {
      throw InterpreterRuntimeError.new(`String.${name} produced an invalid replacement match.`, node);
    }
    if (hasGroups) {
      const safeGroups = SafeObject.make(R.empty<string, unknown>());
      for (const [key, group] of R.toEntries(groups)) {
        if (!isBlockedMember(key)) Reflect.set(safeGroups, key, group);
      }
      callbackArgs[callbackArgs.length - 1] = safeGroups;
    }
    matches.push({ match, offset, args: callbackArgs });
    return match;
  };

  const pattern = args[0];
  if (CodeModeRegExp.is(pattern)) {
    if (name === "replaceAll" && !pattern.regex.global) {
      throw InterpreterRuntimeError.new(
        `String.replaceAll requires a regular expression with the global (g) flag: write /${pattern.regex.source}/${pattern.regex.flags}g, or use String.replace to replace only the first match.`,
        node
      );
    }
    if (name === "replace") value.replace(pattern.regex, collect);
    else value.replaceAll(pattern.regex, collect);
  } else {
    const search = coerceToString(requireDataArgument(name, 0, pattern, node));
    if (name === "replace") value.replace(search, collect);
    else value.replaceAll(search, collect);
  }

  return Effect.gen(function* () {
    const output: Array<string> = [];
    let end = 0;
    for (const match of matches) {
      const replacement = yield* apply(match.args);
      // Error values are branded plain objects; boundedData would strip the brand before coercion.
      output.push(
        value.slice(end, match.offset),
        CodeModePromise.is(replacement)
          ? "[object Promise]"
          : P.isNotUndefined(errorBrandName(replacement))
            ? coerceToString(replacement)
            : coerceToString(boundedData(replacement, `String.${name} replacer result`))
      );
      end = match.offset + match.match.length;
    }
    output.push(value.slice(end));
    return boundedData(output.join(""), `String.${name} result`);
  });
};

/**
 * Admits a collection callback and returns an Effect-returning applicator.
 *
 * **Gotchas**
 *
 * Throws immediately — before returning the function — when the callback is not
 * a {@link SupportedCallback}. Host functions that look callable must be wrapped
 * in an arrow {@link CodeModeFunction}. The returned applicator delegates to
 * {@link CallbackRunner.invokeCallable}.
 *
 * **Example** (Reject a non-function callback)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { InterpreterFailure } from "../../../codemode/interpreter/Interpreter.model.ts"
 * import { applyCollectionCallback } from "../../../codemode/interpreter/Interpreter.methods.ts"
 *
 * const runner = {
 *   invokeFunction: () => Effect.succeed(undefined),
 *   invokeCallable: () => Effect.succeed(undefined),
 *   settlePromise: () => Effect.succeed(undefined),
 * }
 *
 * try {
 *   applyCollectionCallback(runner, 1, "Array.map", { type: "CallExpression" })
 * } catch (error) {
 *   console.log(
 *     InterpreterFailure.guards.InterpreterRuntimeError(error) ? error.message : error,
 *   )
 * }
 * // Array.map expects a function callback.
 * ```
 *
 * @see {@link isSupportedCallback} for the admission guard used before throw.
 * @see {@link invokeIntrinsic} for collection methods that call this helper.
 * @throws InterpreterRuntimeError TypeError when `callback` is missing, or a wrap-in-arrow error when it is a non-supported function.
 * @category combinators
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Collection, callback, index, and runtime runner are co-primary interpreter protocol inputs.
export const applyCollectionCallback = <R>(
  runner: CallbackRunner<R>,
  callback: unknown,
  name: string,
  node: AstNode
): ((args: Array<unknown>) => Effect.Effect<unknown, InterpreterFailure, R>) => {
  if (!isSupportedCallback(callback)) {
    if (typeofValue(callback) === "function") {
      throw InterpreterRuntimeError.new(
        `${name} cannot use this callable as a callback; wrap it in an arrow function, e.g. (value) => tools.ns.tool(value).`,
        node
      );
    }
    throw InterpreterRuntimeError.new(`${name} expects a function callback.`, node).as("TypeError");
  }
  return (callbackArgs) => runner.invokeCallable(callback, callbackArgs, node);
};

const invokeMapMethod = <R>(
  runner: CallbackRunner<R>,
  target: CodeModeMap,
  name: MapMethod,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> =>
  mapMethods.$match(name, {
    get: () => Effect.succeed(target.map.get(args[0])),
    has: () => Effect.succeed(target.map.has(args[0])),
    set: () =>
      Effect.sync(() => {
        target.map.set(args[0], args[1]);
        return target;
      }),
    delete: () => Effect.sync(() => target.map.delete(args[0])),
    clear: () =>
      Effect.sync(() => {
        target.map.clear();
        return undefined;
      }),
    keys: () => Effect.sync(() => A.fromIterable(target.map.keys())),
    values: () => Effect.sync(() => A.fromIterable(target.map.values())),
    entries: () =>
      Effect.sync(() =>
        pipe(
          target.map.entries(),
          A.fromIterable,
          A.map(([key, item]): Array<unknown> => [key, item])
        )
      ),
    forEach: () => {
      const apply = applyCollectionCallback(runner, args[0], "Map.forEach", node);
      return Effect.gen(function* () {
        for (const [key, item] of target.map.entries()) yield* apply([item, key, target]);
        return undefined;
      });
    },
  });

const invokeSetMethod = <R>(
  runner: CallbackRunner<R>,
  target: CodeModeSet,
  name: SetMethod,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const operation = (operationName: SetOperationMethod) =>
    invokeSetOperation(runner, target, operationName, args[0], node);
  return setMethods.$match(name, {
    has: () => Effect.succeed(target.set.has(args[0])),
    add: () =>
      Effect.sync(() => {
        target.set.add(args[0]);
        return target;
      }),
    delete: () => Effect.sync(() => target.set.delete(args[0])),
    clear: () =>
      Effect.sync(() => {
        target.set.clear();
        return undefined;
      }),
    keys: () => Effect.sync(() => A.fromIterable(target.set.values())),
    values: () => Effect.sync(() => A.fromIterable(target.set.values())),
    entries: () =>
      Effect.sync(() =>
        pipe(
          target.set.values(),
          A.fromIterable,
          A.map((item): Array<unknown> => [item, item])
        )
      ),
    forEach: () => {
      const apply = applyCollectionCallback(runner, args[0], "Set.forEach", node);
      return Effect.gen(function* () {
        for (const item of target.set.values()) yield* apply([item, item, target]);
        return undefined;
      });
    },
    union: () => operation("union"),
    intersection: () => operation("intersection"),
    difference: () => operation("difference"),
    symmetricDifference: () => operation("symmetricDifference"),
    isSubsetOf: () => operation("isSubsetOf"),
    isSupersetOf: () => operation("isSupersetOf"),
    isDisjointFrom: () => operation("isDisjointFrom"),
  });
};

const SetOperationMethod = LiteralKit(
  setMethods.pickOptions([
    "union",
    "intersection",
    "difference",
    "symmetricDifference",
    "isSubsetOf",
    "isSupersetOf",
    "isDisjointFrom",
  ])
);
type SetOperationMethod = typeof SetOperationMethod.Type;

const invokeSetOperation = <R>(
  runner: CallbackRunner<R>,
  target: CodeModeSet,
  name: SetOperationMethod,
  source: unknown,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const other = yield* loadSetRecord(runner, source, name, node);
    return yield* SetOperationMethod.$match(name, {
      union: Effect.fnUntraced(function* () {
        const result = copySet(target);
        for (const item of yield* other.keys()) result.set.add(item);
        return result;
      }),
      intersection: Effect.fnUntraced(function* () {
        const result = CodeModeSet.new();
        if (target.set.size <= other.size) {
          for (const item of target.set.values()) {
            if (yield* other.has(item)) result.set.add(item);
          }
          return result;
        }
        for (const item of yield* other.keys()) {
          if (target.set.has(item)) result.set.add(item);
        }
        return result;
      }),
      difference: Effect.fnUntraced(function* () {
        const result = copySet(target);
        if (target.set.size <= other.size) {
          for (const item of result.set.values()) {
            if (yield* other.has(item)) result.set.delete(item);
          }
          return result;
        }
        for (const item of yield* other.keys()) result.set.delete(item);
        return result;
      }),
      symmetricDifference: Effect.fnUntraced(function* () {
        const result = copySet(target);
        for (const item of yield* other.keys()) {
          if (target.set.has(item)) result.set.delete(item);
          else result.set.add(item);
        }
        return result;
      }),
      isSubsetOf: Effect.fnUntraced(function* () {
        if (target.set.size > other.size) return false;
        for (const item of target.set.values()) {
          if (!(yield* other.has(item))) return false;
        }
        return true;
      }),
      isSupersetOf: Effect.fnUntraced(function* () {
        if (target.set.size < other.size) return false;
        for (const item of yield* other.keys()) {
          if (!target.set.has(item)) return false;
        }
        return true;
      }),
      isDisjointFrom: Effect.fnUntraced(function* () {
        if (target.set.size <= other.size) {
          for (const item of target.set.values()) {
            if (yield* other.has(item)) return false;
          }
          return true;
        }
        for (const item of yield* other.keys()) {
          if (target.set.has(item)) return false;
        }
        return true;
      }),
    });
  });

const copySet = (source: CodeModeSet): CodeModeSet => {
  const result = CodeModeSet.new();
  for (const item of source.set.values()) result.set.add(item);
  return result;
};

const loadSetRecord = <R>(runner: CallbackRunner<R>, source: unknown, name: SetOperationMethod, node: AstNode) => {
  if (CodeModeSet.is(source)) {
    return Effect.succeed({
      size: source.set.size,
      has: (item: unknown) => Effect.succeed(source.set.has(item)),
      keys: () => Effect.succeed(source.set.values()),
    });
  }
  if (CodeModeMap.is(source)) {
    return Effect.succeed({
      size: source.map.size,
      has: (item: unknown) => Effect.succeed(source.map.has(item)),
      keys: () => Effect.succeed(source.map.keys()),
    });
  }
  if (!P.isObjectKeyword(source) || isCodeModeValue(source)) {
    throw InterpreterRuntimeError.new(`Set.${name} expects a Set-like object.`, node).as("TypeError");
  }
  return Effect.gen(function* () {
    const size = yield* coerceNumericArgument(runner, Reflect.get(source, "size"), node);
    if (Number.isNaN(size)) {
      throw InterpreterRuntimeError.new(`Set.${name} received a Set-like object with an invalid size.`, node).as(
        "TypeError"
      );
    }
    const has = Reflect.get(source, "has");
    const keys = Reflect.get(source, "keys");
    if (!isSupportedCallback(has) || !isSupportedCallback(keys)) {
      throw InterpreterRuntimeError.new(`Set.${name} expects callable 'has' and 'keys' methods.`, node).as("TypeError");
    }
    return {
      size: Math.max(Math.trunc(size), 0),
      has: (item: unknown) => Effect.map(runner.invokeCallable(has, [item], node), Boolean),
      keys: () =>
        Effect.flatMap(runner.invokeCallable(keys, [], node), (result) => {
          if (A.isArray(result)) return Effect.succeed(result);
          throw InterpreterRuntimeError.new(`Set.${name} expected 'keys' to return an iterator.`, node).as("TypeError");
        }),
    };
  });
};

const invokeURLSearchParamsMethod = <R>(
  runner: CallbackRunner<R>,
  target: CodeModeURLSearchParams,
  name: UrlSearchParamsMethod,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const arg = (index: number): string => uriArgument(args[index], `URLSearchParams.${name} argument ${index + 1}`);
  const requireArgs = (count: number): void => {
    if (args.length < count) {
      throw InterpreterRuntimeError.new(
        `URLSearchParams.${name} requires ${count} argument${count === 1 ? "" : "s"}.`,
        node
      ).as("TypeError");
    }
  };
  return UrlSearchParamsMethod.$match(name, {
    append: () => {
      requireArgs(2);
      return Effect.sync(() => {
        target.params.append(arg(0), arg(1));
        return undefined;
      });
    },
    delete: () => {
      requireArgs(1);
      return Effect.sync(() => {
        if (args[1] !== undefined) target.params.delete(arg(0), arg(1));
        else target.params.delete(arg(0));
        return undefined;
      });
    },
    get: () => {
      requireArgs(1);
      return Effect.sync(() => target.params.get(arg(0)));
    },
    getAll: () => {
      requireArgs(1);
      return Effect.sync(() => target.params.getAll(arg(0)));
    },
    has: () => {
      requireArgs(1);
      return Effect.sync(() => (args[1] !== undefined ? target.params.has(arg(0), arg(1)) : target.params.has(arg(0))));
    },
    set: () => {
      requireArgs(2);
      return Effect.sync(() => {
        target.params.set(arg(0), arg(1));
        return undefined;
      });
    },
    sort: () =>
      Effect.sync(() => {
        target.params.sort();
        return undefined;
      }),
    keys: () => Effect.sync(() => A.fromIterable(target.params.keys())),
    values: () => Effect.sync(() => A.fromIterable(target.params.values())),
    entries: () =>
      Effect.sync(() =>
        pipe(
          target.params.entries(),
          A.fromIterable,
          A.map(([key, value]): Array<unknown> => [key, value])
        )
      ),
    toString: () => Effect.sync(() => target.params.toString()),
    forEach: () => {
      requireArgs(1);
      const apply = applyCollectionCallback(runner, args[0], "URLSearchParams.forEach", node);
      return Effect.gen(function* () {
        for (const [key, value] of target.params.entries()) yield* apply([value, key, target]);
        return undefined;
      });
    },
  });
};

const invokeArrayMethod = <R>(
  runner: CallbackRunner<R>,
  target: Array<unknown>,
  name: ArrayMethod,
  args: Array<unknown>,
  node: AstNode
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const optNumber = (value: unknown, label: string): number | undefined => {
    if (value === undefined) return undefined;
    if (!P.isNumber(value)) throw InterpreterRuntimeError.new(`Array.${name} expects ${label} to be a number.`, node);
    return value;
  };
  if (S.is(DirectArrayMethod)(name)) {
    const join = (): Effect.Effect<string> => {
      const separator = args.length === 0 ? undefined : args[0];
      if (args.length > 1 || (!P.isUndefined(separator) && !P.isString(separator))) {
        throw InterpreterRuntimeError.new("Array.join expects zero arguments or one string separator.", node);
      }
      boundedData(target, "Array.join input");
      return Effect.succeed(
        target.map((item) => coerceToString(item ?? "")).join(P.isUndefined(separator) ? "," : separator)
      );
    };
    const includes = (): Effect.Effect<boolean> => {
      if (args.length === 0 || args.length > 2)
        throw InterpreterRuntimeError.new("Array.includes expects a value and optional start index.", node);
      return Effect.succeed(target.includes(args[0], optNumber(args[1], "start index")));
    };
    const sort = (): Effect.Effect<Array<unknown>, InterpreterFailure, R> => {
      const length = target.length;
      const holeCount = pipe(
        A.makeBy(length, (index) => R.has(target as unknown as Readonly<Record<string, unknown>>, String(index))),
        A.filter((own) => !own),
        A.length
      );
      const itemCount = length - holeCount;
      return Effect.map(sortArray(runner, target, args[0], "Array.sort", node), (sorted) => {
        sorted.slice(0, itemCount).forEach((item, index) => {
          target[index] = item;
        });
        A.forEach(
          A.makeBy(holeCount, (index) => itemCount + index),
          (index) => {
            Reflect.deleteProperty(target, index);
          }
        );
        return target;
      });
    };
    const replaceAt = (): Effect.Effect<Array<unknown>> => {
      const index = optNumber(args[0], "index") ?? 0;
      const resolved = index < 0 ? target.length + index : index;
      if (resolved < 0 || resolved >= target.length) {
        throw InterpreterRuntimeError.new("Array.with index is out of range.", node);
      }
      const copied = [...target];
      copied[resolved] = args[1];
      return Effect.succeed(copied);
    };
    const push = (): Effect.Effect<number> => {
      // Validate all insertions before mutating to avoid partial cyclic updates.
      for (const item of args) rejectCircularInsertion(target, item, "Array.push result", node);
      target.push(...args);
      return Effect.succeed(target.length);
    };
    const unshift = (): Effect.Effect<number> => {
      for (const item of args) rejectCircularInsertion(target, item, "Array.unshift result", node);
      target.unshift(...args);
      return Effect.succeed(target.length);
    };
    const splice = (): Effect.Effect<Array<unknown>> => {
      if (args.length === 0) return Effect.succeed(target.splice(0, 0));
      const start = optNumber(args[0], "start") ?? 0;
      if (args.length === 1) return Effect.succeed(target.splice(start));
      const deleteCount = optNumber(args[1], "delete count") ?? 0;
      const inserted = args.slice(2);
      for (const item of inserted) rejectCircularInsertion(target, item, "Array.splice result", node);
      return Effect.succeed(target.splice(start, deleteCount, ...inserted));
    };
    const toSpliced = (): Effect.Effect<Array<unknown>> => {
      if (args.length === 0) return Effect.succeed([...target]);
      const start = optNumber(args[0], "start") ?? 0;
      if (args.length === 1) {
        const copied = [...target];
        copied.splice(start);
        return Effect.succeed(copied);
      }
      const deleteCount = optNumber(args[1], "delete count") ?? 0;
      const copied = [...target];
      copied.splice(start, deleteCount, ...args.slice(2));
      return Effect.succeed(copied);
    };
    const fill = (): Effect.Effect<Array<unknown>> => {
      rejectCircularInsertion(target, args[0], "Array.fill result", node);
      return Effect.succeed(target.fill(args[0], optNumber(args[1], "start"), optNumber(args[2], "end")));
    };
    return DirectArrayMethod.$match(name, {
      join,
      includes,
      indexOf: () => Effect.succeed(target.indexOf(args[0], optNumber(args[1], "start index"))),
      lastIndexOf: () =>
        Effect.succeed(
          args[1] === undefined
            ? target.lastIndexOf(args[0])
            : target.lastIndexOf(args[0], optNumber(args[1], "start index"))
        ),
      at: () => Effect.succeed(target.at(optNumber(args[0], "index") ?? 0)),
      slice: () => Effect.succeed(target.slice(optNumber(args[0], "start"), optNumber(args[1], "end"))),
      concat: () => Effect.succeed(target.concat(...args)),
      flat: () => Effect.succeed(target.flat(optNumber(args[0], "depth") ?? 1)),
      reverse: () => Effect.succeed(target.reverse()),
      sort,
      toSorted: () => sortArray(runner, target, args[0], "Array.toSorted", node),
      toReversed: () => Effect.succeed([...target].reverse()),
      with: replaceAt,
      push,
      unshift,
      pop: () => Effect.succeed(target.pop()),
      shift: () => Effect.succeed(target.shift()),
      splice,
      toSpliced,
      fill,
      copyWithin: () =>
        Effect.succeed(
          target.copyWithin(
            optNumber(args[0], "target index") ?? 0,
            optNumber(args[1], "start") ?? 0,
            optNumber(args[2], "end")
          )
        ),
      keys: () => Effect.succeed(A.fromIterable(target.keys())),
      values: () => Effect.succeed([...target]),
      entries: () =>
        Effect.succeed(
          pipe(
            target.entries(),
            A.fromIterable,
            A.map(([index, item]): Array<unknown> => [index, item])
          )
        ),
    });
  }

  const apply = applyCollectionCallback(runner, args[0], `Array.${name}`, node);
  // Fix iteration length while reading existing elements live.
  const length = target.length;
  return CallbackArrayMethod.$match(name, {
    map: Effect.fnUntraced(function* () {
      const values = A.empty<unknown>();
      values.length = length;
      for (let index = 0; index < length; index += 1) {
        if (!(index in target)) continue;
        values[index] = yield* apply([target[index], index, target]);
      }
      return values;
    }),
    flatMap: Effect.fnUntraced(function* () {
      const values = A.empty<unknown>();
      for (let index = 0; index < length; index += 1) {
        if (!(index in target)) continue;
        const mapped = yield* apply([target[index], index, target]);
        if (A.isArray(mapped)) values.push(...mapped);
        else values.push(mapped);
      }
      return values;
    }),
    filter: Effect.fnUntraced(function* () {
      const values = A.empty<unknown>();
      for (let index = 0; index < length; index += 1) {
        if (!(index in target)) continue;
        const item = target[index];
        if (P.isTruthy(yield* apply([item, index, target]))) values.push(item);
      }
      return values;
    }),
    find: Effect.fnUntraced(function* () {
      for (let index = 0; index < length; index += 1) {
        const item = target[index];
        if (P.isTruthy(yield* apply([item, index, target]))) return item;
      }
      return undefined;
    }),
    findIndex: Effect.fnUntraced(function* () {
      for (let index = 0; index < length; index += 1) {
        if (P.isTruthy(yield* apply([target[index], index, target]))) return index;
      }
      return -1;
    }),
    some: Effect.fnUntraced(function* () {
      for (let index = 0; index < length; index += 1) {
        if (!(index in target)) continue;
        if (P.isTruthy(yield* apply([target[index], index, target]))) return true;
      }
      return false;
    }),
    every: Effect.fnUntraced(function* () {
      for (let index = 0; index < length; index += 1) {
        if (!(index in target)) continue;
        if (!P.isTruthy(yield* apply([target[index], index, target]))) return false;
      }
      return true;
    }),
    forEach: Effect.fnUntraced(function* () {
      for (let index = 0; index < length; index += 1) {
        if (index in target) yield* apply([target[index], index, target]);
      }
      return undefined;
    }),
    reduce: Effect.fnUntraced(function* () {
      let start = 0;
      let accumulator = args[1];
      if (args.length < 2) {
        while (start < length && !(start in target)) start += 1;
        if (start === length)
          throw InterpreterRuntimeError.new("Array.reduce of an empty array with no initial value.", node).as(
            "TypeError"
          );
        accumulator = target[start];
        start += 1;
      }
      for (let index = start; index < length; index += 1) {
        if (!(index in target)) continue;
        accumulator = yield* apply([accumulator, target[index], index, target]);
      }
      return accumulator;
    }),
    reduceRight: Effect.fnUntraced(function* () {
      let start = length - 1;
      let accumulator = args[1];
      if (args.length < 2) {
        while (start >= 0 && !(start in target)) start -= 1;
        if (start < 0)
          throw InterpreterRuntimeError.new("Array.reduceRight of an empty array with no initial value.", node).as(
            "TypeError"
          );
        accumulator = target[start];
        start -= 1;
      }
      for (let index = start; index >= 0; index -= 1) {
        if (!(index in target)) continue;
        accumulator = yield* apply([accumulator, target[index], index, target]);
      }
      return accumulator;
    }),
    findLast: Effect.fnUntraced(function* () {
      for (let index = length - 1; index >= 0; index -= 1) {
        const item = target[index];
        if (P.isTruthy(yield* apply([item, index, target]))) return item;
      }
      return undefined;
    }),
    findLastIndex: Effect.fnUntraced(function* () {
      for (let index = length - 1; index >= 0; index -= 1) {
        if (P.isTruthy(yield* apply([target[index], index, target]))) return index;
      }
      return -1;
    }),
  });
};

const sortArray = <R>(
  runner: CallbackRunner<R>,
  target: Array<unknown>,
  comparator: unknown,
  name: string,
  node: AstNode
): Effect.Effect<Array<unknown>, InterpreterFailure, R> => {
  if (comparator === undefined) {
    return Effect.sync(() =>
      [...target].sort((a, b) => {
        const left = coerceToString(a);
        const right = coerceToString(b);
        return left < right ? -1 : left > right ? 1 : 0;
      })
    );
  }
  const apply = applyCollectionCallback(runner, comparator, name, node);
  const mergeSort = (items: Array<unknown>): Effect.Effect<Array<unknown>, InterpreterFailure, R> => {
    if (items.length <= 1) return Effect.succeed(items);
    const midpoint = Math.floor(items.length / 2);
    return Effect.gen(function* () {
      const left = yield* mergeSort(items.slice(0, midpoint));
      const right = yield* mergeSort(items.slice(midpoint));
      const merged = A.empty<unknown>();
      let leftIndex = 0;
      let rightIndex = 0;
      while (leftIndex < left.length && rightIndex < right.length) {
        // Treat a NaN comparator result as equal to preserve stable ordering.
        const order = coerceToNumber(yield* apply([left[leftIndex], right[rightIndex]]));
        if (Number.isNaN(order) || order <= 0) merged.push(left[leftIndex++]);
        else merged.push(right[rightIndex++]);
      }
      return [...merged, ...left.slice(leftIndex), ...right.slice(rightIndex)];
    });
  };
  const defined = target.filter((item) => item !== undefined);
  const undefinedCount = target.length - defined.length;
  return Effect.map(mergeSort(defined), (items) => [...items, ...Array(undefinedCount).fill(undefined)]);
};
