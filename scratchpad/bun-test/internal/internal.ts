/**
 * Implements scoped Effect execution and completion hooks for the experimental Bun adapter.
 *
 * @since 0.0.0
 */

import { afterAll, beforeAll, describe, setDefaultTimeout as bunSetDefaultTimeout, test } from "bun:test";
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { dual, pipe } from "effect/Function";
import * as Inspectable from "effect/Inspectable";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Tuple from "effect/Tuple";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import * as Arbitrary from "effect/Arbitrary";
import type * as BunTest from "../index.ts";

// ----------------------------------------------------------------------------
// `bun:test` shape helpers
// ----------------------------------------------------------------------------

type BunTestFn = (ctx?: never) => void | Promise<void>;

interface BunRegistrar {
  (name: string, fn: BunTestFn, options?: number | { timeout?: number; retry?: number }): void;
}

interface BunTestApi extends BunRegistrar {
  skip: BunRegistrar;
  only: BunRegistrar;
  todo: BunRegistrar;
  failing: BunRegistrar;
  if: (condition: unknown) => BunRegistrar;
  skipIf: (condition: unknown) => BunRegistrar;
  todoIf: (condition: unknown) => BunRegistrar;
  each: <T>(
    cases: ReadonlyArray<T>
  ) => (
    name: string,
    fn: (value: T) => void | Promise<void>,
    options?: number | { timeout?: number; retry?: number }
  ) => void;
}

const bunTest = test as unknown as BunTestApi;

/**
 * `bun:test`'s `%s`-style title interpolation, reimplemented for the chained
 * registrars (`skip.each`) that Bun does not expose natively.
 */
const formatEachName = (name: string, value: unknown, index: number): string => {
  const values = A.isArray(value) ? value : [value];
  let i = 0;
  return name.replace(/%[sidfo#%]/g, (token) => {
    if (token === "%%") return "%";
    if (token === "%#") return String(index);
    const current = i < values.length ? values[i++] : undefined;
    return Inspectable.toStringUnknown(current, 0);
  });
};

// ----------------------------------------------------------------------------
// TestContext
// ----------------------------------------------------------------------------

interface ContextState {
  readonly controller: AbortController;
  readonly finished: Array<() => void | Promise<void>>;
  readonly failed: Array<() => void | Promise<void>>;
}

// Weak identity keys avoid retaining abandoned test contexts; Effect maps hold strong keys.
const contextState = new WeakMap<BunTest.TestContext, ContextState>();
let defaultTimeoutMillis = 5_000;
const $I = $ScratchpadId.create("bun-test/internal");

class CompletionFailure extends S.TaggedError<CompletionFailure>($I`CompletionFailure`)(
  "CompletionFailure",
  { causes: S.Array(S.Defect({ includeStack: true })) },
  $I.annote("CompletionFailure", { description: "Test body and completion hook failures retained during cleanup." })
) {}

/** Preserve the formatted property failure while exposing a typed adapter error. */
class PropertyCheckFailure extends S.TaggedError<PropertyCheckFailure>($I`PropertyCheckFailure`)(
  "PropertyCheckFailure",
  { message: S.String },
  $I.annote("PropertyCheckFailure", { description: "Formatted counterexample from a failed property check." })
) {
  override readonly name = "Error";
}

/** Preserve the existing AbortSignal reason text and displayed native error name. */
class TestTimeout extends S.TaggedError<TestTimeout>($I`TestTimeout`)(
  "TestTimeout",
  { message: S.String },
  $I.annote("TestTimeout", { description: "The adapter's configured test deadline elapsed." })
) {
  override readonly name = "Error";
}

/**
 * Configure Bun and the adapter's interruptible default before collecting tests.
 *
 * **Example** (Use setDefaultTimeout in a test)
 *
 * ```ts
 * import { setDefaultTimeout, effect } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Effect from "effect/Effect"
 *
 * setDefaultTimeout(30_000)
 * effect("uses the configured deadline", () => Effect.succeed(42))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const setDefaultTimeout = (millis: number): void => {
  bunSetDefaultTimeout(millis);
  defaultTimeoutMillis = millis;
};

/** @internal */
const makeContext = (): BunTest.TestContext => {
  const state: ContextState = {
    controller: new AbortController(),
    finished: [],
    failed: [],
  };
  const ctx: BunTest.TestContext = {
    signal: state.controller.signal,
    onTestFinished(fn) {
      state.finished.push(fn);
    },
    onTestFailed(fn) {
      state.failed.push(fn);
    },
  };
  contextState.set(ctx, state);
  return ctx;
};

const flush = Effect.fnUntraced(function* (ctx: BunTest.TestContext, failed: boolean) {
  const state = contextState.get(ctx);
  if (state === undefined) return;
  contextState.delete(ctx);
  const callbacks = failed ? A.appendAll(state.failed, state.finished) : state.finished;
  yield* Effect.validate(
    callbacks,
    (callback) =>
      Effect.tryPromise({
        try: () => Promise.resolve().then(callback),
        catch: (cause) => CompletionFailure.make({ causes: [cause] }),
      }),
    { concurrency: 1 }
  );
}, Effect.runPromise);

const finish = <A>(ctx: BunTest.TestContext, promise: Promise<A>): Promise<A> =>
  promise.then(
    (value) => flush(ctx, false).then(() => value),
    (body) =>
      flush(ctx, true).then(
        () => Promise.reject(body),
        (completion) => Promise.reject(CompletionFailure.make({ causes: [body, completion] }))
      )
  );

// ----------------------------------------------------------------------------
// Default API
// ----------------------------------------------------------------------------

const timeoutMillis = (opts?: number | BunTest.TestOptions): number | undefined =>
  P.isNumber(opts) ? opts : opts?.timeout;

const toBunOptions = (opts?: number | BunTest.TestOptions) => {
  if (opts === undefined) return undefined;
  if (P.isNumber(opts)) return { timeout: opts };
  const out: { timeout?: number; retry?: number; repeats?: number } = {};
  if (opts.timeout !== undefined) out.timeout = opts.timeout;
  if (opts.retry !== undefined) out.retry = opts.retry;
  if (opts.repeats !== undefined) out.repeats = opts.repeats;
  return out;
};

type AnyTestFn = (ctx: BunTest.TestContext) => unknown | Promise<unknown>;

const splitArgs = (
  second: BunTest.TestOptions | AnyTestFn,
  third?: AnyTestFn | number | BunTest.TestOptions
): [opts: number | BunTest.TestOptions | undefined, fn: AnyTestFn] =>
  P.isFunction(second) ? [third as number | BunTest.TestOptions | undefined, second] : [second, third as AnyTestFn];

const withContext =
  (fn: AnyTestFn): BunTestFn =>
  () => {
    const ctx = makeContext();
    return finish(
      ctx,
      Promise.resolve().then(() => fn(ctx))
    ).then(() => undefined);
  };

const registerWith = (registrar: BunRegistrar): BunTest.API =>
  dual(
    (args) => P.isString(args[0]),
    (name: string, second: BunTest.TestOptions | AnyTestFn, third?: AnyTestFn | number | BunTest.TestOptions): void => {
      const [opts, fn] = splitArgs(second, third);
      registrar(name, withContext(fn), toBunOptions(opts));
    }
  );

const baseCollector: BunTest.API = dual(
  (args) => P.isString(args[0]),
  (name: string, second: BunTest.TestOptions | AnyTestFn, third?: AnyTestFn | number | BunTest.TestOptions): void => {
    const [opts, fn] = splitArgs(second, third);
    const o = P.isObject(opts) ? (opts as BunTest.TestOptions) : undefined;
    const registrar =
      o?.todo === true
        ? bunTest.todo
        : o?.fails === true
          ? bunTest.failing
          : o?.only === true
            ? bunTest.only
            : o?.skip === true
              ? bunTest.skip
              : bunTest;
    registrar(name, withContext(fn), toBunOptions(opts));
  }
);

// These assignments retain callability and enumerable own methods; Struct.assign returns a plain object.
const skipCollector = Object.assign(registerWith(bunTest.skip) as BunTest.API, {
  each:
    <T>(cases: ReadonlyArray<T>) =>
    (
      name: string,
      fn: (value: T, ctx: BunTest.TestContext) => unknown | Promise<unknown>,
      options?: number | BunTest.TestOptions
    ) => {
      cases.forEach((value, index) => {
        bunTest.skip(
          formatEachName(name, value, index),
          withContext((ctx) => fn(value, ctx)),
          toBunOptions(options)
        );
      });
    },
});

/**
 * Register plain Bun tests with synthetic completion and failure callbacks.
 *
 * **Example** (Register a plain test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { defaultApi } from "@beep/scratchpad/bun-test/internal/internal"
 *
 * defaultApi("plain assertion", () => expect(2 + 2).toBe(4))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const defaultApi: BunTest.Collector = Object.assign(baseCollector, {
  skip: skipCollector,
  only: registerWith(bunTest.only) as BunTest.API,
  todo: (name: string) => bunTest.todo(name, () => {}),
  skipIf: (condition: unknown) => registerWith(bunTest.skipIf(condition)) as BunTest.API,
  runIf: (condition: unknown) => registerWith(bunTest.if(condition)) as BunTest.API,
  fails: registerWith(bunTest.failing) as BunTest.API,
  each:
    <T>(cases: ReadonlyArray<T>) =>
    (
      name: string,
      fn: (value: T, ctx: BunTest.TestContext) => unknown | Promise<unknown>,
      options?: number | BunTest.TestOptions
    ) => {
      A.forEach(cases, (value, index) => {
        bunTest(
          formatEachName(name, value, index),
          withContext((ctx) => fn(value, ctx)),
          toBunOptions(options)
        );
      });
    },
  describe,
});

// ----------------------------------------------------------------------------
// Effect runner
// ----------------------------------------------------------------------------

const runPromise: <E, A>(_: Effect.Effect<A, E, never>, ctx?: BunTest.TestContext | undefined) => Promise<A> =
  Effect.fnUntraced(
    function* <E, A>(effect: Effect.Effect<A, E>, _ctx?: BunTest.TestContext) {
      const exit = yield* Effect.exit(effect);
      if (Exit.isFailure(exit)) {
        const errors = Cause.prettyErrors(exit.cause);
        for (let i = 0; i < errors.length; i++) {
          yield* Effect.logError(errors[i]);
        }
      }
      return yield* exit;
    },
    (effect, _, ctx) =>
      ctx === undefined ? Effect.runPromise(effect) : finish(ctx, Effect.runPromise(effect, { signal: ctx.signal }))
  );

/** @internal */
const runTest =
  (ctx?: BunTest.TestContext) =>
  <E, A>(effect: Effect.Effect<A, E>) =>
    runPromise(effect, ctx);

/**
 * Test clock and console services supplied to scoped Effect test callbacks.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type TestContext = TestConsole.TestConsole | TestClock.TestClock;

const TestEnv = Layer.mergeAll(TestConsole.layer, TestClock.layer());

/**
 * Keep the upstream setup entrypoint available without registering custom equality testers.
 *
 * **Example** (Use addEqualityTesters in a test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { addEqualityTesters } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Equal from "effect/Equal"
 * import * as O from "effect/Option"
 *
 * addEqualityTesters()
 * expect(Equal.equals(O.some(1), O.some(1))).toBe(true)
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const addEqualityTesters = () => {
  // No-op: `bun:test`'s `expect` does not currently expose
  // `addEqualityTesters`. Use `Equal.equals` directly (or the helpers in
  // `@effect/bun-test/utils`) to compare values that implement the
  // `Equal` trait.
};

// ----------------------------------------------------------------------------
// Property testing (effect/Arbitrary)
// ----------------------------------------------------------------------------

type PropertyTimeout =
  | number
  | (BunTest.TestOptions & {
      readonly arbitrary?: Arbitrary.CheckOptions | undefined;
    });

type ArbitraryInput = S.Schema<any> | Arbitrary.Arbitrary<unknown>;

type Arbitraries = Array<ArbitraryInput> | { [K in string]: ArbitraryInput };

const checkOptions = (timeout: PropertyTimeout | undefined): Arbitrary.CheckOptions | undefined =>
  P.isNumber(timeout) ? undefined : timeout?.arbitrary;

const compileArbitraryInput = (input: ArbitraryInput): Arbitrary.Arbitrary<any> =>
  Arbitrary.isArbitrary(input) ? input : Arbitrary.schema(input);

const makeArbitrary = (arbitraries: Arbitraries): Arbitrary.Arbitrary<any> =>
  Arbitrary.all(
    A.isArray(arbitraries)
      ? A.map(arbitraries, compileArbitraryInput)
      : R.fromEntries(A.map(R.toEntries(arbitraries), ([key, input]) => Tuple.make(key, compileArbitraryInput(input))))
  );

const normalizeProperty = <A, E, R>(
  property: (value: A) => boolean | Effect.Effect<boolean, E, R>,
  value: A
): Effect.Effect<boolean, E | Cause.Cause<E>, R> =>
  Effect.catchCauseIf(
    Effect.suspend(() => {
      const output = property(value);
      return Effect.isEffect(output) ? output : Effect.succeed(output);
    }),
    P.not(Cause.hasInterrupts),
    Effect.fail
  );

const runCheck = <A, E>(
  ctx: BunTest.TestContext,
  arbitrary: Arbitrary.Arbitrary<A>,
  property: (value: A) => boolean | Effect.Effect<boolean, E>,
  options: Arbitrary.CheckOptions | undefined
): Promise<void> =>
  runTest(ctx)(
    Effect.flatMapEager(
      Arbitrary.checkEffect(arbitrary, (value) => normalizeProperty(property, value), options),
      (result) => {
        const failure = Arbitrary.formatCheckFailure(result);
        return failure === undefined ? Effect.void : Effect.die(PropertyCheckFailure.make({ message: failure }));
      }
    )
  );

// ----------------------------------------------------------------------------
// Testers
// ----------------------------------------------------------------------------

/**
 * Bun's timeout fails the test but cannot interrupt the Effect fiber behind
 * it, so finalizers would never run. The wrapper owns the timeout instead:
 * it aborts the context's signal (interrupting the fiber and running its
 * finalizers), while Bun keeps a slightly larger timeout as a backstop.
 */
const makeTestContext = (timeout?: number | BunTest.TestOptions): BunTest.TestContext => {
  const ctx = makeContext();
  const millis = timeoutMillis(timeout) ?? defaultTimeoutMillis;
  const state = contextState.get(ctx);
  if (state !== undefined) {
    // The runner owns this live-clock fiber; the test's TestClock must not control its deadline.
    const timer = Effect.sleep(Duration.millis(millis)).pipe(
      Effect.andThen(
        Effect.sync(() => state.controller.abort(TestTimeout.make({ message: `Test timed out after ${millis}ms` })))
      ),
      Effect.runFork
    );
    ctx.onTestFinished(() => Fiber.interrupt(timer).pipe(Effect.runPromise));
  }
  return ctx;
};

const withBackstopTimeout = (
  timeout: number | BunTest.TestOptions | undefined
): number | BunTest.TestOptions | undefined => {
  const millis = timeoutMillis(timeout) ?? defaultTimeoutMillis;
  const backstop = millis + 1_000;
  return P.isNumber(timeout) ? { timeout: backstop } : { ...timeout, timeout: backstop };
};

/**
 * Extends a test collector without mutating it: `makeMethods` and `layer`
 * would otherwise clobber the shared `defaultApi` (and each other) when
 * attaching their own `effect`/`live` testers.
 */
const extendApi = <M extends object>(it: BunTest.Collector, overrides: M): BunTest.Collector & M => {
  const f = ((...args: ReadonlyArray<never>) => (it as (...args: ReadonlyArray<never>) => void)(...args)) as any;
  return Object.assign(f, it, overrides);
};

/** @internal */
const makeTester = <R>(
  mapEffect: <A, E>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, never>,
  it: BunTest.Collector = defaultApi
): BunTest.BunTest.Tester<R> => {
  const run = <A, E, TestArgs extends Array<unknown>>(
    ctx: BunTest.TestContext,
    args: TestArgs,
    self: BunTest.BunTest.TestFunction<A, E, R, TestArgs>
  ) =>
    pipe(
      Effect.suspend(() => self(...args)),
      mapEffect,
      runTest(ctx)
    );

  const testBody =
    <A, E>(
      self: BunTest.BunTest.TestFunction<A, E, R, [BunTest.TestContext]>,
      timeout?: number | BunTest.TestOptions
    ) =>
    () => {
      const ctx = makeTestContext(timeout);
      return run(ctx, [ctx], self);
    };

  const register = (registrar: BunTest.API): BunTest.BunTest.Test<R> =>
    dual(
      (args) => P.isString(args[0]),
      <A, E>(
        name: string,
        self: BunTest.BunTest.TestFunction<A, E, R, [BunTest.TestContext]>,
        timeout?: number | BunTest.TestOptions
      ) => registrar(name, testBody(self, timeout), withBackstopTimeout(timeout))
    );

  const f = register(it);
  const skip = register(it.skip);
  const skipIf: BunTest.BunTest.Tester<R>["skipIf"] = (condition) => register(it.skipIf(condition));
  const runIf: BunTest.BunTest.Tester<R>["runIf"] = (condition) => register(it.runIf(condition));
  const only = register(it.only);

  const each: BunTest.BunTest.Tester<R>["each"] = (cases) => (name, self, timeout) =>
    it.each(cases)(
      name,
      (value) => {
        const ctx = makeTestContext(timeout);
        return run(ctx, [value] as any, self as any);
      },
      withBackstopTimeout(timeout)
    );

  const fails = register(it.fails);

  const prop: BunTest.BunTest.Tester<R>["prop"] = (name, arbitraries, self, timeout) => {
    const arbitrary = makeArbitrary(arbitraries);
    return it(
      name,
      () => {
        const ctx = makeTestContext(timeout);
        return runCheck(
          ctx,
          arbitrary,
          (values) =>
            Effect.mapEager(
              mapEffect(Effect.suspend(() => self(values as any, ctx))),
              (value) => (value as unknown) !== false
            ),
          checkOptions(timeout)
        );
      },
      withBackstopTimeout(timeout)
    );
  };

  return Object.assign(f, { skip, skipIf, runIf, only, each, fails, prop });
};

/**
 * Check a synchronous property with schema-derived inputs and explicit run options.
 *
 * **Example** (Use prop in a test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { prop } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as S from "effect/Schema"
 *
 * prop("generates integers", [S.Int], ([value]) => {
 *   expect(Number.isInteger(value)).toBe(true)
 * }, { arbitrary: { runs: 5, seed: 42 } })
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const prop: BunTest.BunTest.Methods["prop"] = dual(
  (args) => P.isString(args[0]),
  (...[name, arbitraries, self, timeout]: Parameters<BunTest.BunTest.Methods["prop"]>) => {
    const arbitrary = makeArbitrary(arbitraries);
    return defaultApi(
      name,
      () => {
        const ctx = makeTestContext(timeout);
        return runCheck(
          ctx,
          arbitrary,
          (values) => (self(values as any, ctx) as unknown) !== false,
          checkOptions(timeout)
        );
      },
      withBackstopTimeout(timeout)
    );
  }
);

// ----------------------------------------------------------------------------
// layer
// ----------------------------------------------------------------------------

type LayerOptions = Parameters<BunTest.BunTest.Methods["layer"]>[1];

type LayerBlock<R> = {
  (f: (it: BunTest.BunTest.MethodsNonLive<R>) => void): void;
  (name: string, f: (it: BunTest.BunTest.MethodsNonLive<R>) => void): void;
};

/**
 * Share a Layer across tests in a block, closing its resources when the block finishes.
 *
 * **Example** (Use layer in a test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { layer } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * layer(Layer.empty)("shared layer", (tests) => {
 *   tests.effect("runs in scope", () => Effect.sync(() => expect(true).toBe(true)))
 * })
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const layer: {
  (options?: LayerOptions): <R, E>(layer_: Layer.Layer<R, E>) => LayerBlock<R>;
  <R, E>(layer_: Layer.Layer<R, E>, options?: LayerOptions): LayerBlock<R>;
} = dual(
  (args) => Layer.isLayer(args[0]),
  <R, E>(layer_: Layer.Layer<R, E>, options?: LayerOptions): LayerBlock<R> =>
    (
      ...args:
        | [name: string, f: (it: BunTest.BunTest.MethodsNonLive<R>) => void]
        | [f: (it: BunTest.BunTest.MethodsNonLive<R>) => void]
    ) => {
      const excludeTestServices = options?.excludeTestServices ?? false;
      const withTestEnv = excludeTestServices ? (layer_ as Layer.Layer<R, E>) : Layer.provideMerge(layer_, TestEnv);
      const memoMap = options?.memoMap ?? Layer.makeMemoMapUnsafe();
      const scope = Scope.makeUnsafe();
      const contextEffect = Layer.buildWithMemoMap(withTestEnv, memoMap, scope).pipe(
        Effect.orDie,
        Effect.cached,
        Effect.runSync
      );
      let closed = false;
      const closeScope = () => {
        if (closed) {
          return Promise.resolve();
        }
        closed = true;
        return runPromise(Scope.close(scope, Exit.void)) as Promise<void>;
      };

      const makeIt = (it: BunTest.Collector): BunTest.BunTest.MethodsNonLive<R> =>
        extendApi(it, {
          effect: makeTester<R | Scope.Scope>(
            (effect) => Effect.flatMap(contextEffect, (context) => effect.pipe(Effect.scoped, Effect.provide(context))),
            it
          ),
          prop,
          flakyTest,
          layer<R2, E2>(
            nestedLayer: Layer.Layer<R2, E2, R>,
            options?: {
              readonly timeout?: Duration.Input;
            }
          ) {
            return layer(Layer.provideMerge(nestedLayer, withTestEnv), {
              ...options,
              memoMap: Layer.forkMemoMapUnsafe(memoMap),
              excludeTestServices,
            });
          },
        }) as BunTest.BunTest.MethodsNonLive<R>;

      const timeoutMs =
        options?.timeout !== undefined ? Duration.toMillis(Duration.fromInputUnsafe(options.timeout)) : undefined;

      const registerHooks = () => {
        beforeAll(() => contextEffect.pipe(Effect.asVoid, runPromise), timeoutMs);
        afterAll(closeScope, timeoutMs);
      };

      if (args.length === 1) {
        return describe("", () => {
          registerHooks();
          return args[0](makeIt(defaultApi));
        });
      }

      return describe(args[0], () => {
        registerHooks();
        return args[1](makeIt(defaultApi));
      });
    }
);

/**
 * Retry a scoped Effect failure within the helper's bounded retry policy.
 *
 * **Example** (Use flakyTest in a test)
 *
 * ```ts
 * import { flakyTest, effect } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Effect from "effect/Effect"
 *
 * effect("retries transient work", () => flakyTest(Effect.succeed(42)))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const flakyTest: {
  (timeout?: Duration.Input): <A, E, R>(self: Effect.Effect<A, E, R | Scope.Scope>) => Effect.Effect<A, never, R>;
  <A, E, R>(self: Effect.Effect<A, E, R | Scope.Scope>, timeout?: Duration.Input): Effect.Effect<A, never, R>;
} = dual(
  (args) => Effect.isEffect(args[0]),
  <A, E, R>(self: Effect.Effect<A, E, R | Scope.Scope>, timeout: Duration.Input = Duration.seconds(30)) =>
    pipe(
      self,
      Effect.scoped,
      Effect.sandbox,
      Effect.retry(
        pipe(
          Schedule.recurs(10),
          Schedule.while((_) =>
            Effect.succeed(
              Duration.isLessThanOrEqualTo(Duration.fromInputUnsafe(_.elapsed), Duration.fromInputUnsafe(timeout))
            )
          )
        )
      ),
      Effect.orDie
    )
);

/**
 * Extend a compatible collector with scoped Effect and property-test methods.
 *
 * **Example** (Use makeMethods in a test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { makeMethods, defaultApi } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Effect from "effect/Effect"
 *
 * const tests = makeMethods(defaultApi)
 * tests.effect("uses an extended collector", () => Effect.sync(() => expect(true).toBe(true)))
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const makeMethods = (it: BunTest.Collector): BunTest.BunTest.Methods =>
  extendApi(it, {
    effect: makeTester<Scope.Scope>(
      Effect.fnUntraced(function* <A, E>(self: Effect.Effect<A, E, Scope.Scope>) {
        const context = yield* Layer.build(TestEnv);
        return yield* self.pipe(Effect.scoped, Effect.provide(context));
      }, Effect.scoped),
      it
    ),
    live: makeTester<Scope.Scope>(Effect.scoped, it),
    flakyTest,
    layer,
    prop,
  }) as BunTest.BunTest.Methods;

/** @internal */
export const {
  /**
   * Register a scoped Effect test with TestClock and TestConsole services.
   *
   * **Example** (Use effect in a test)
   *
   * ```ts
   * import { expect } from "bun:test"
   * import { effect } from "@beep/scratchpad/bun-test/internal/internal"
   * import * as Effect from "effect/Effect"
   *
   * effect("asserts inside an Effect", () => Effect.sync(() => expect(2 + 2).toBe(4)))
   * ```
   *
   * @internal
   * @category testing
   * @since 0.0.0
   */
  effect,
  /**
   * Register a scoped Effect test using the live runtime clock.
   *
   * **Example** (Use live in a test)
   *
   * ```ts
   * import { live } from "@beep/scratchpad/bun-test/internal/internal"
   * import * as Effect from "effect/Effect"
   *
   * live("waits on the live clock", () => Effect.sleep("1 millis"))
   * ```
   *
   * @internal
   * @category testing
   * @since 0.0.0
   */
  live,
} = makeMethods(defaultApi);

/**
 * Create a named suite whose callback receives the Effect-aware collector.
 *
 * **Example** (Use describeWrapped in a test)
 *
 * ```ts
 * import { expect } from "bun:test"
 * import { describeWrapped } from "@beep/scratchpad/bun-test/internal/internal"
 * import * as Effect from "effect/Effect"
 *
 * describeWrapped("Effect examples", (tests) => {
 *   tests.effect("asserts a result", () => Effect.sync(() => expect(1).toBe(1)))
 * })
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const describeWrapped: {
  (f: (it: BunTest.BunTest.Methods) => void): (name: string) => void;
  (name: string, f: (it: BunTest.BunTest.Methods) => void): void;
} = dual(2, (name: string, f: (it: BunTest.BunTest.Methods) => void): void => {
  describe(name, () => {
    f(makeMethods(defaultApi));
  });
});
