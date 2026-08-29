import {LiteralKit} from "@beep/schema";
import {Effect} from "effect";
import {A, P} from "@beep/utils";
import {
  preserveConsumerError,
  type SyncIteratorRunner
} from "../interpreter/Interpreter.iterator.ts";
import {
  type AstNode,
  type InterpreterFailure,
  InterpreterRuntimeError,
} from "../interpreter/Interpreter.model.ts";
import { type MathMethod, mathMethods } from "../Codemode.method-names.ts";

export { mathMethods } from "../Codemode.method-names.ts";
// Bun exposes ES2026 Math.sumPrecise before TypeScript's standard library types.
declare global {
  interface Math {
    sumPrecise(values: Iterable<number>): number;
  }
}

export const mathConstants = LiteralKit(["PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT2", "SQRT1_2"]);

const DirectMathMethod = LiteralKit(
  mathMethods.omitOptions(["random", "sumPrecise"])
);
type DirectMathMethod = Exclude<MathMethod, "random" | "sumPrecise">;

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
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
    pow: () => Math.pow(a, b()),
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

// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const invokeMathSumPrecise = <R>(
  runner: SyncIteratorRunner<R>,
  source: unknown,
  node: AstNode,
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
        }),
      );
    }
  });
