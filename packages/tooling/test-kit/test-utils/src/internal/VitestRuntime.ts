import { it } from "@effect/vitest";
import { Predicate as P } from "effect";
import { instrumentMethods } from "./VitestInstrumentation.ts";
import type { TestFunction, TestOptions, Vitest } from "@effect/vitest";
import type { Clock } from "effect";

type TestCollectorOptions = Omit<TestOptions, "shuffle">;

const makeInstrumentedIt = <R>(methods: Vitest.Methods<R>) => {
  function callable<ExtraContext extends {}>(
    name: string | Function,
    fn?: TestFunction<ExtraContext>,
    options?: number
  ): void;
  function callable<ExtraContext extends {}>(
    name: string | Function,
    options?: TestCollectorOptions,
    fn?: TestFunction<ExtraContext>
  ): void;
  function callable<ExtraContext extends {}>(
    fn?: TestFunction<ExtraContext>,
    options?: number
  ): (name: string | Function) => void;
  function callable<ExtraContext extends {}>(
    options?: TestCollectorOptions,
    fn?: TestFunction<ExtraContext>
  ): (name: string | Function) => void;
  function callable(...args: ReadonlyArray<unknown>): unknown {
    if ((P.isFunction(args[0]) || P.isUndefined(args[0])) && P.isNumber(args[1])) {
      const [fn, options] = args;
      return (name: string | Function) => Reflect.apply(methods, undefined, [name, fn, options]);
    }
    if ((P.isUndefined(args[0]) || P.isObject(args[0])) && (args[1] === undefined || P.isFunction(args[1]))) {
      const [options, fn] = args;
      return (name: string | Function) => Reflect.apply(methods, undefined, [name, options, fn]);
    }
    return Reflect.apply(methods, undefined, args);
  }

  const target = Object.assign(callable, methods);
  return new Proxy(target, {
    get(_target, property, receiver) {
      return Reflect.get(methods, property, receiver);
    },
  });
};

/** @internal */
export const makeVitestRuntime = (clock?: Clock.Clock) => ({
  it: makeInstrumentedIt(instrumentMethods(it, clock)),
});

/** @internal */
export const InstrumentedVitestRuntime = makeVitestRuntime();
