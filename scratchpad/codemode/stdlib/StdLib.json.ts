/**
 * Guest `JSON.parse` and `JSON.stringify` with native reviver and replacer
 * semantics for the CodeMode interpreter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {DateTime, Effect, MutableHashSet, Result} from "effect";
import type {CallbackRunner} from "../interpreter/Interpreter.methods.ts";
import {applyCollectionCallback} from "../interpreter/Interpreter.methods.ts";
import {
  type AstNode,
  type InterpreterFailure,
  InterpreterRuntimeError,
  JsonMethodName,
  JsonMethodReference,
} from "../interpreter/Interpreter.model.ts";
import {typeofValue} from "../interpreter/Interpreter.references.ts";
import {
  copyIn,
  copyOut,
  ToolRuntimeError,
} from "../Codemode.tool-runtime.ts";
import {SafeObject} from "@beep/schema";
import {P, A, R, pipe} from "@beep/utils";
import * as S from "effect/Schema";
import {
  CodeModeDate,
  CodeModeURL,
  makeEmptySafeObject,
  isCodeModeValue,
} from "../Codemode.values.ts";

/**
 * Guest JSON.parse/stringify adapter with reviver and replacer callbacks.
 *
 * **Details**
 *
 * Native `JSON.parse` and `JSON.stringify` are used deliberately: schema JSON
 * codecs cannot preserve guest reviver/replacer call order, sparse-array
 * omission, or native error objects. Host and protocol JSON uses Effect Schema
 * codecs elsewhere in CodeMode.
 *
 * **Gotchas**
 *
 * Circular structures throw `TypeError` during stringify. {@link CodeModeDate}
 * and {@link CodeModeURL} contribute via `toJSON` (ISO or `null` for invalid
 * dates; `href` for URLs). Values are copied in and out through {@link copyIn}
 * and {@link copyOut} so guest objects do not leak host identity.
 *
 * **Example** (Parse then stringify an object)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { invokeJsonMethod } from "../../../codemode/stdlib/StdLib.json.ts"
 *
 * const node = { type: "CallExpression" }
 * const runner = {
 *   invokeFunction: () => Effect.die("unused"),
 *   invokeCallable: () => Effect.die("unused"),
 *   settlePromise: () => Effect.die("unused"),
 * }
 * const parsed = await Effect.runPromise(
 *   invokeJsonMethod(runner, "parse", ['{"ok":true}'], node)
 * )
 * const text = await Effect.runPromise(
 *   invokeJsonMethod(runner, "stringify", [parsed], node)
 * )
 * console.log(parsed)
 * console.log(text)
 * ```
 *
 * @see {@link copyIn} for the inbound guest-data copy used by parse.
 * @see {@link copyOut} for the outbound copy used by stringify without a replacer.
 * @category serialization
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeJsonMethod = <R>(
  runner: CallbackRunner<R>,
  ref: JsonMethodReference | JsonMethodName,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> => {
  const reference = P.isString(ref)
    ? JsonMethodReference.new(ref)
    : ref;

  return JsonMethodName.$match(reference.name, {
    parse: () => parse(runner, args, node),
    stringify: () => stringify(runner, args, node),
  });
};

const parse = <R>(
  runner: CallbackRunner<R>,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const text = args[0];
    if (!P.isString(text)) {
      return yield* InterpreterRuntimeError.new("JSON.parse expects a string.", node);
    }

    const parsed = yield* Effect.fromResult(
      Result.try({
        try: () => JSON.parse(text),
        catch: (error) =>
          InterpreterRuntimeError.new(
            `JSON.parse received invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            node,
          ).as("SyntaxError"),
      })
    );
    const copied = yield* copyFromBoundary(parsed, "JSON.parse result");
    if (typeofValue(args[1]) !== "function") return copied;

    const apply = applyCollectionCallback(runner, args[1], "JSON.parse", node);
    const root = makeEmptySafeObject();
    Reflect.set(root, "", copied);
    const visit = (
      holder: SafeObject | Array<unknown>,
      key: string
    ): Effect.Effect<unknown, InterpreterFailure, R> =>
      Effect.gen(function* () {
        const value = Reflect.get(holder, key);
        if (A.isArray(value)) {
          const length = value.length;
          for (let index = 0; index < length; index += 1) {
            const revived = yield* visit(value, String(index));
            if (P.isUndefined(revived)) Reflect.deleteProperty(value, index);
            else value[index] = revived;
          }
        } else if (isPlainObject(value)) {
          for (const name of R.keys(value)) {
            const revived = yield* visit(value, name);
            if (P.isUndefined(revived)) Reflect.deleteProperty(value, name);
            else Reflect.set(value, name, revived);
          }
        }
        return yield* apply([key, value]);
      });
    return yield* visit(root, "");
  });

const stringify = <R>(
  runner: CallbackRunner<R>,
  args: Array<unknown>,
  node: AstNode,
): Effect.Effect<unknown, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const space = args[2];
    const indent = P.isNumber(space) || P.isString(space) ? space : undefined;
    const replacer = args[1];
    const callable = typeofValue(replacer) === "function";
    const checked = yield* copyFromBoundary(args[0], "JSON.stringify value", callable);
    const input = callable ? args[0] : checked;

    if (A.isArray(replacer)) {
      const properties = pipe(
        replacer,
        A.filter((item): item is string | number => P.or(P.isString, P.isNumber)(item)),
        A.map(String)
      );
      const output = yield* copyToBoundary(input);
      return yield* stringifyResult(output, properties, indent, node);
    }
    if (!callable) {
      const output = yield* copyToBoundary(input);
      return yield* stringifyResult(output, null, indent, node);
    }

    const apply = applyCollectionCallback(runner, replacer, "JSON.stringify", node);
    const root = makeEmptySafeObject();
    Reflect.set(root, "", input);
    const stack = MutableHashSet.empty<object>();
    const visit = (
      holder: SafeObject | Array<unknown>,
      key: string
    ): Effect.Effect<unknown, InterpreterFailure, R> =>
      Effect.gen(function* () {
        const value = yield* apply([key, toJSONValue(Reflect.get(holder, key))]);
        if (P.isUndefined(value) || typeofValue(value) === "function") return undefined;
        yield* copyFromBoundary(value, "JSON.stringify replacer result", true);
        if (P.isNumber(value)) return Number.isFinite(value) ? value : null;
        if (P.isNull(value) || P.isString(value) || P.isBoolean(value)) return value;
        if (A.isArray(value)) {
          if (MutableHashSet.has(stack, value)) {
            return yield* InterpreterRuntimeError.new(
              "Converting circular structure to JSON.",
              node
            ).as("TypeError");
          }
          MutableHashSet.add(stack, value);
          const result = A.empty<unknown>();
          for (let index = 0; index < value.length; index += 1) {
            result.push((yield* visit(value, String(index))) ?? null);
          }
          MutableHashSet.remove(stack, value);
          return result;
        }
        if (!isPlainObject(value)) return {};
        if (MutableHashSet.has(stack, value)) {
          return yield* InterpreterRuntimeError.new(
            "Converting circular structure to JSON.",
            node
          ).as("TypeError");
        }
        MutableHashSet.add(stack, value);
        const result = makeEmptySafeObject();
        for (const name of R.keys(value)) {
          const item = yield* visit(value, name);
          if (P.isNotUndefined(item)) Reflect.set(result, name, item);
        }
        MutableHashSet.remove(stack, value);
        return result;
      });

    const value = yield* visit(root, "");
    return yield* stringifyResult(value, null, indent, node);
  });

const copyFromBoundary = (
  value: unknown,
  label: string,
  preserveCodeModeValues = false
): Effect.Effect<unknown, ToolRuntimeError> =>
  Effect.fromResult(
    Result.try({
      try: () => copyIn(value, label, preserveCodeModeValues),
      catch: (error) =>
        ToolRuntimeError.is(error)
          ? error
          : ToolRuntimeError.new(
              "InvalidDataValue",
              `${label} could not be copied into CodeMode.`
            ),
    })
  );

const copyToBoundary = (
  value: unknown
): Effect.Effect<unknown, ToolRuntimeError> =>
  Effect.fromResult(
    Result.try({
      try: () => copyOut(value, "json"),
      catch: (error) =>
        ToolRuntimeError.is(error)
          ? error
          : ToolRuntimeError.new(
              "InvalidDataValue",
              "JSON.stringify value could not be copied out of CodeMode."
            ),
    })
  );

const stringifyResult = (
  value: unknown,
  replacer: ReadonlyArray<string | number> | null,
  indent: string | number | undefined,
  node: AstNode
): Effect.Effect<string | undefined, InterpreterRuntimeError> =>
  Effect.fromResult(
    Result.try({
      try: () => JSON.stringify(value, P.isNull(replacer) ? null : A.copy(replacer), indent),
      catch: (error) =>
        InterpreterRuntimeError.new(
          `JSON.stringify failed: ${error instanceof Error ? error.message : String(error)}`,
          node,
        ).as("TypeError"),
    })
  );

const toJSONValue = (value: unknown): unknown => {
  if (CodeModeDate.is(value)) {
    return S.is(S.Finite)(value.time)
      ? DateTime.makeUnsafe(value.time).pipe(DateTime.formatIso)
      : null;
  }
  if (CodeModeURL.is(value)) return value.url.href;
  return value;
};

const isPlainObject = (value: unknown): value is SafeObject => P.isNotNull(value) &&
  P.isObjectKeyword(value) &&
  !isCodeModeValue(value);
