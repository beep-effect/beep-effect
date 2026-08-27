/**
 * Guest Math constants and numeric methods, with `random` and `sumPrecise`
 * dispatched outside the direct method table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, P } from "@beep/utils";
import { Effect } from "effect";
import { type MathMethod, mathMethods } from "../Codemode.method-names.ts";
import { preserveConsumerError, type SyncIteratorRunner } from "../interpreter/Interpreter.iterator.ts";
import { type AstNode, type InterpreterFailure, InterpreterRuntimeError } from "../interpreter/Interpreter.model.ts";

export { mathMethods } from "../Codemode.method-names.ts";

const $I = $ScratchpadId.create("codemode/stdlib/StdLib.math");
// Bun exposes ES2026 Math.sumPrecise before TypeScript's standard library types.
declare global {
  interface Math {
    sumPrecise(values: Iterable<number>): number;
  }
}

/**
 * Closed kit of guest-visible `Math` numeric constants.
 *
 * **Example** (Confirm PI membership)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { mathConstants } from "../../../codemode/stdlib/StdLib.math.ts"
 *
 * console.log(S.is(mathConstants)("PI"))
 * console.log(S.is(mathConstants)("random"))
 * ```
 *
 * @see {@link invokeMathMethod} for numeric methods that are not constants.
 * @category constants
 * @since 0.0.0
 */
export const mathConstants = LiteralKit(["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2"]).pipe(
  $I.annoteSchema("mathConstants", {
    description: "Guest-visible Math numeric constant names.",
  })
);

/**
 * Decoded value produced by {@link mathConstants}.
 *
 * @see {@link mathConstants} for the runtime kit of Math constant names.
 * @category type-level
 * @since 0.0.0
 */
export type mathConstants = typeof mathConstants.Type;

const DirectMathMethod = LiteralKit(mathMethods.omitOptions(["random", "sumPrecise"]));
type DirectMathMethod = Exclude<MathMethod, "random" | "sumPrecise">;

/**
 * Dispatches guest Math methods that consume numbers and return a number.
 *
 * **Gotchas**
 *
 * Extra arguments are ignored so built-ins still work as `(element, index,
 * array)` callbacks. Missing consumed arguments become `NaN`. `"random"` and
 * `"sumPrecise"` are omitted from this dispatcher: `Math.random` is sourced
 * elsewhere (Clock/random, like `Date.now`), and precise summation uses
 * {@link invokeMathSumPrecise}.
 *
 * **Example** (Take the absolute value of a number)
 *
 * ```ts
 * import { invokeMathMethod } from "../../../codemode/stdlib/StdLib.math.ts"
 *
 * const node = { type: "CallExpression" }
 * console.log(invokeMathMethod("abs", [-3], node))
 * ```
 *
 * @see {@link invokeMathSumPrecise} for `Math.sumPrecise` over a sync iterable.
 * @see {@link mathConstants} for PI and related constant names.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest intrinsic dispatch uses co-primary receiver/name/arguments/AST context; a data-last overload would misstate the protocol.
export const invokeMathMethod = (name: DirectMathMethod, args: Array<unknown>, node: AstNode): number => {
  // Validate only the arguments the method consumes; like JS, extras are ignored
  // (so built-ins work as callbacks receiving (element, index, array)).
  const num = (index: number): number => {
    if (index >= args.length) return Number.NaN;
    const arg = args[index];
    if (!P.isNumber(arg)) throw InterpreterRuntimeError.new(`Math.${name} expects number arguments.`, node);
    return arg;
  };
  const nums = () =>
    args.map((arg) => {
      if (!P.isNumber(arg)) throw InterpreterRuntimeError.new(`Math.${name} expects number arguments.`, node);
      return arg;
    });
  const a = num(0);
  const b = () => num(1);
  return DirectMathMethod.$match(name, {
    max: () => Math.max(...nums()),
    min: () => Math.min(...nums()),
    abs: () => Math.abs(a),
    acos: () => Math.acos(a),
    acosh: () => Math.acosh(a),
    asin: () => Math.asin(a),
    asinh: () => Math.asinh(a),
    atan: () => Math.atan(a),
    atan2: () => Math.atan2(a, b()),
    atanh: () => Math.atanh(a),
    floor: () => Math.floor(a),
    ceil: () => Math.ceil(a),
    round: () => Math.round(a),
    trunc: () => Math.trunc(a),
    sign: () => Math.sign(a),
    sqrt: () => Math.sqrt(a),
    cbrt: () => Math.cbrt(a),
    pow: () => a ** b(),
    hypot: () => Math.hypot(...nums()),
    cos: () => Math.cos(a),
    cosh: () => Math.cosh(a),
    sin: () => Math.sin(a),
    sinh: () => Math.sinh(a),
    tan: () => Math.tan(a),
    tanh: () => Math.tanh(a),
    log: () => Math.log(a),
    log2: () => Math.log2(a),
    log10: () => Math.log10(a),
    log1p: () => Math.log1p(a),
    exp: () => Math.exp(a),
    expm1: () => Math.expm1(a),
    f16round: () => Math.f16round(a),
    fround: () => Math.fround(a),
    clz32: () => Math.clz32(a),
    imul: () => Math.imul(a, b()),
  });
};

/**
 * Sums a synchronous iterable of numbers using host `Math.sumPrecise`.
 *
 * **Gotchas**
 *
 * The source must be a synchronous iterable of numbers. Async iterables and
 * non-number items throw `TypeError`. Do not pass `"sumPrecise"` to
 * {@link invokeMathMethod}; that table omits it.
 *
 * **Example** (Sum a synchronous array of numbers)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { invokeMathSumPrecise } from "../../../codemode/stdlib/StdLib.math.ts"
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
 * const total = await Effect.runPromise(invokeMathSumPrecise(runner, [1, 2, 3], node))
 * console.log(total)
 * ```
 *
 * @see {@link invokeMathMethod} for the other numeric Math methods.
 * @category interop
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Guest iterable, AST context, and callback runner are co-primary interpreter protocol inputs.
export const invokeMathSumPrecise = <R>(
  runner: SyncIteratorRunner<R>,
  source: unknown,
  node: AstNode
): Effect.Effect<number, InterpreterFailure, R> =>
  Effect.gen(function* () {
    const cursor = yield* runner.syncIterator(source, node);
    if (P.isUndefined(cursor)) {
      throw InterpreterRuntimeError.new("Math.sumPrecise expects a synchronous iterable.", node).as("TypeError");
    }
    const numbers = A.empty<number>();
    while (true) {
      const step = yield* cursor.next;
      if (step.done) return Math.sumPrecise(numbers);
      yield* preserveConsumerError(
        cursor,
        Effect.sync(() => {
          if (!P.isNumber(step.value)) {
            throw InterpreterRuntimeError.new("Math.sumPrecise expects an iterable of numbers.", node).as("TypeError");
          }
          numbers.push(step.value);
        })
      );
    }
  });
