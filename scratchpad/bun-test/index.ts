/**
 * Effect testing helpers for Bun's native `bun:test` runner.
 *
 * The experimental API follows `@effect/vitest` (`it.effect`, `it.live`,
 * `layer`, `it.prop`, `flakyTest`, …). See PILOT-RESULTS.md
 * for known unsupported contracts before attempting migration.
 *
 * @since 0.0.0
 */
import type * as Duration from "effect/Duration"
import type * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type * as S from "effect/Schema"
import type * as Scope from "effect/Scope"
import type * as Arbitrary from "effect/unstable/arbitrary/Arbitrary"
import * as internal from "./internal/internal.ts"
import * as utils from "./utils.ts"

import * as bt from "bun:test"
import { assert as chaiAssert } from "chai"

/**
 * Register cleanup after all tests in the current suite finish.
 *
 * **Example** (Use afterAll in a test)
 *
 * ```ts
 * import { afterAll, expect, it } from "@beep/scratchpad/bun-test/index"
 *
 * let calls = 0
 * afterAll(() => expect(calls).toBe(1))
 * it("counts a call", () => { calls += 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const afterAll = bt.afterAll
/**
 * Register cleanup after each test in the current suite.
 *
 * **Example** (Use afterEach in a test)
 *
 * ```ts
 * import { afterEach, expect, it } from "@beep/scratchpad/bun-test/index"
 *
 * let value = 0
 * afterEach(() => { value = 0 })
 * it("changes a value", () => { value = 1; expect(value).toBe(1) })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const afterEach = bt.afterEach
/**
 * Initialize shared state before the current suite runs.
 *
 * **Example** (Use beforeAll in a test)
 *
 * ```ts
 * import { beforeAll, expect, it } from "@beep/scratchpad/bun-test/index"
 *
 * let ready = false
 * beforeAll(() => { ready = true })
 * it("sees initialized state", () => expect(ready).toBe(true))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const beforeAll = bt.beforeAll
/**
 * Initialize fresh state before each test in the current suite.
 *
 * **Example** (Use beforeEach in a test)
 *
 * ```ts
 * import { beforeEach, expect, it } from "@beep/scratchpad/bun-test/index"
 *
 * let value = 0
 * beforeEach(() => { value = 1 })
 * it("sees fresh state", () => expect(value).toBe(1))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const beforeEach = bt.beforeEach
/**
 * Group native Bun tests under a suite name.
 *
 * **Example** (Use describe in a test)
 *
 * ```ts
 * import { describe, expect, it } from "@beep/scratchpad/bun-test/index"
 *
 * describe("arithmetic", () => {
 *   it("adds", () => expect(1 + 1).toBe(2))
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const describe = bt.describe
/**
 * Assert runtime values with Bun's native matchers.
 *
 * **Example** (Use expect in a test)
 *
 * ```ts
 * import { expect } from "@beep/scratchpad/bun-test/index"
 *
 * expect({ count: 2 }).toEqual({ count: 2 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const expect = bt.expect
/**
 * Express type-level expectations using the installed Bun testing API.
 *
 * **Example** (Use expectTypeOf in a test)
 *
 * ```ts
 * import { expectTypeOf } from "@beep/scratchpad/bun-test/index"
 *
 * expectTypeOf<number>().toEqualTypeOf<number>()
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const expectTypeOf: typeof bt.expectTypeOf = bt.expectTypeOf
/**
 * Expose Bun's available Vitest-style mock utilities; unsupported Vitest methods remain unavailable.
 *
 * **Example** (Use vi in a test)
 *
 * ```ts
 * import { vi, expect } from "@beep/scratchpad/bun-test/index"
 *
 * const read = vi.fn(() => 42)
 * expect(read()).toBe(42)
 * expect(read).toHaveBeenCalledTimes(1)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const vi = bt.vi
/**
 * Expose Bun's Jest-style mock and timer utilities.
 *
 * **Example** (Use jest in a test)
 *
 * ```ts
 * import { jest, expect } from "@beep/scratchpad/bun-test/index"
 *
 * const read = jest.fn(() => "ready")
 * expect(read()).toBe("ready")
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const jest = bt.jest
/**
 * Create native Bun mock functions with observable call histories.
 *
 * **Example** (Use mock in a test)
 *
 * ```ts
 * import { mock, expect } from "@beep/scratchpad/bun-test/index"
 *
 * const read = mock(() => 42)
 * expect(read()).toBe(42)
 * expect(read).toHaveBeenCalledTimes(1)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const mock = bt.mock
/**
 * Override the native clock for deterministic date assertions.
 *
 * **Example** (Use setSystemTime in a test)
 *
 * ```ts
 * import { setSystemTime, expect } from "@beep/scratchpad/bun-test/index"
 *
 * setSystemTime(new Date("2020-01-01T00:00:00Z"))
 * expect(new Date().getUTCFullYear()).toBe(2020)
 * setSystemTime()
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const setSystemTime = bt.setSystemTime
/**
 * Configure Bun and the adapter's interruptible default before collecting tests.
 *
 * **Example** (Use setDefaultTimeout in a test)
 *
 * ```ts
 * import { setDefaultTimeout, it } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * setDefaultTimeout(30_000)
 * it.effect("uses the configured deadline", () => Effect.succeed(42))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const setDefaultTimeout = internal.setDefaultTimeout
/**
 * Observe a method with a native Bun spy and restore it after the assertion.
 *
 * **Example** (Use spyOn in a test)
 *
 * ```ts
 * import { spyOn, expect } from "@beep/scratchpad/bun-test/index"
 *
 * const source = { read: () => 42 }
 * const spy = spyOn(source, "read")
 * expect(source.read()).toBe(42)
 * expect(spy).toHaveBeenCalledTimes(1)
 * spy.mockRestore()
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const spyOn = bt.spyOn
/**
 * Register a native Bun test without the adapter's Effect helpers.
 *
 * **Example** (Use test in a test)
 *
 * ```ts
 * import { test, expect } from "@beep/scratchpad/bun-test/index"
 *
 * test("adds two numbers", () => expect(1 + 1).toBe(2))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const test = bt.test

/**
 * Provide basic assertion helpers plus Chai deep-inclusion checks for shared test helpers.
 *
 * **Example** (Use assert in a test)
 *
 * ```ts
 * import { assert } from "@beep/scratchpad/bun-test/index"
 *
 * assert.strictEqual(2 + 2, 4)
 * assert.deepInclude({ status: "ready", count: 1 }, { status: "ready" })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const assert: {
  readonly fail: (message: string) => void
  readonly strictEqual: <A>(actual: A, expected: A, message?: string) => void
  readonly deepStrictEqual: <A>(actual: A, expected: A, message?: string) => void
  readonly deepInclude: typeof chaiAssert.deepInclude
  readonly notDeepStrictEqual: <A>(actual: A, expected: A, message?: string) => void
  readonly isTrue: (self: unknown, message?: string) => void
  readonly isFalse: (self: boolean, message?: string) => void
  readonly include: (actual: string | ReadonlyArray<unknown> | undefined, expected: unknown) => void
  readonly match: (actual: string, regExp: RegExp) => void
  readonly instanceOf: (value: unknown, constructor: abstract new(...args: any) => any, message?: string) => void
  readonly isDefined: <A>(a: A | undefined) => void
  readonly isUndefined: <A>(a: A | undefined) => void
  readonly throws: (thunk: () => void, error?: Error | ((u: unknown) => undefined)) => void
  readonly doesNotThrow: (thunk: () => void, message?: string) => void
  readonly ok: (self: unknown, message?: string) => void
} = {
  fail: utils.fail,
  strictEqual: utils.strictEqual,
  deepStrictEqual: utils.deepStrictEqual,
  deepInclude: chaiAssert.deepInclude,
  notDeepStrictEqual: utils.notDeepStrictEqual,
  isTrue: utils.assertTrue,
  isFalse: utils.assertFalse,
  include: utils.assertInclude,
  match: utils.assertMatch,
  instanceOf: utils.assertInstanceOf,
  isDefined: utils.assertDefined,
  isUndefined: utils.assertUndefined,
  throws: utils.throws,
  doesNotThrow: utils.doesNotThrow,
  ok: utils.assertTrue
}

/**
 * A stand-in for Vitest's `TestContext`. Bun's test runner doesn't pass a
 * context object to the test function, so the test wrapper synthesises one.
 *
 * The `signal` aborts when the wrapper-managed timeout fires, interrupting the
 * test's Effect fiber so its finalizers run — something Bun's own timeout
 * cannot do.
 *
 * @category models
 * @since 0.0.0
 */
export interface TestContext {
  readonly signal: AbortSignal
  onTestFinished(fn: () => void | Promise<void>): void
  onTestFailed(fn: () => void | Promise<void>): void
}

/**
 * Options accepted by every test registrar in this package.
 *
 * @category models
 * @since 0.0.0
 */
export interface TestOptions {
  readonly timeout?: number
  readonly retry?: number
  readonly repeats?: number
  readonly skip?: boolean
  readonly only?: boolean
  readonly todo?: boolean
  readonly fails?: boolean
}

/**
 * Callable registration surface shared by plain test collectors.
 *
 * @category models
 * @since 0.0.0
 */
export type API = TestCollectorCallable

/**
 * Register a test with either callback-first or options-first arguments.
 *
 * @category models
 * @since 0.0.0
 */
export interface TestCollectorCallable {
  (
    name: string,
    fn: (ctx: TestContext) => unknown | Promise<unknown>,
    options?: number | TestOptions
  ): void
  (
    name: string,
    options: TestOptions,
    fn: (ctx: TestContext) => unknown | Promise<unknown>
  ): void
}

/**
 * A parameterized test registrar, mirroring `test.each`.
 *
 * @category models
 * @since 0.0.0
 */
export interface TestEach {
  <T>(cases: ReadonlyArray<T>): (
    name: string,
    fn: (value: T, ctx: TestContext) => unknown | Promise<unknown>,
    options?: number | TestOptions
  ) => void
}

/**
 * The full test collector surface: the callable registrar plus the chained
 * helpers (`skip`, `only`, `each`, `describe`, ...).
 *
 * @category models
 * @since 0.0.0
 */
export interface Collector extends TestCollectorCallable {
  readonly skip: TestCollectorCallable & { readonly each: TestEach }
  readonly only: TestCollectorCallable
  readonly todo: (name: string) => void
  readonly skipIf: (condition: unknown) => TestCollectorCallable
  readonly runIf: (condition: unknown) => TestCollectorCallable
  readonly fails: TestCollectorCallable
  readonly each: TestEach
  readonly describe: typeof bt.describe
}

/**
 * Type contracts for scoped Effect, live-clock, and property-test collectors.
 *
 * @category models
 * @since 0.0.0
 */
export namespace BunTest {
  /**
   * Effect-producing test callback parameterized by its arguments and required services.
   *
   * @category models
   * @since 0.0.0
   */
  export interface TestFunction<A, E, R, TestArgs extends Array<any>> {
    (...args: TestArgs): Effect.Effect<A, E, R>
  }

  /**
   * Register an Effect-producing callback with a name and optional execution settings.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Test<R> {
    <A, E>(
      name: string,
      self: TestFunction<A, E, R, [TestContext]>,
      timeout?: number | TestOptions
    ): void
  }

  /**
   * Tuple or record of schemas and native arbitraries used to generate property inputs.
   *
   * @category models
   * @since 0.0.0
   */
  export type Arbitraries =
    | Array<S.Schema<any> | Arbitrary.Arbitrary<any>>
    | { [K in string]: S.Schema<any> | Arbitrary.Arbitrary<any> }

  type ArbitraryValue<A> = A extends S.Schema<infer T> ? T
    : A extends Arbitrary.Arbitrary<infer T> ? T
    : never

  /**
   * Effect test registrar with conditional, parameterized, and property-test variants.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Tester<R> extends BunTest.Test<R> {
    skip: BunTest.Test<R>
    skipIf: (condition: unknown) => BunTest.Test<R>
    runIf: (condition: unknown) => BunTest.Test<R>
    only: BunTest.Test<R>
    each: <T>(
      cases: ReadonlyArray<T>
    ) => <A, E>(name: string, self: TestFunction<A, E, R, Array<T>>, timeout?: number | TestOptions) => void
    fails: BunTest.Test<R>

    /**
     * Runs an Effectful property test using Schema or Arbitrary inputs.
     *
     * **Details**
     *
     * Returning `false` or completing with any non-interruption failure falsifies the property and triggers shrinking.
     * This includes typed Effect failures, thrown exceptions, and defects such as failed assertions. Effect
     * interruption continues to interrupt the test.
     *
     * The wrapper-managed timeout interrupts the Effect fiber running generation, property evaluation, and shrinking.
     * Effect finalizers run during that interruption.
     *
     * **Gotchas**
     *
     * A timeout cannot preempt a synchronous JavaScript callback that does not return.
     *
     * @since 0.0.0
     */
    prop: <const Arbs extends Arbitraries, A, E>(
      name: string,
      arbitraries: Arbs,
      self: TestFunction<
        A,
        E,
        R,
        [
          {
            [K in keyof Arbs]: ArbitraryValue<Arbs[K]>
          },
          TestContext
        ]
      >,
      timeout?:
        | number
        | TestOptions & {
          arbitrary?: Arbitrary.CheckOptions
        }
    ) => void
  }

  /**
   * Collector methods available inside a shared Layer block, with its services in scope.
   *
   * @category models
   * @since 0.0.0
   */
  export interface MethodsNonLive<R = never> extends Collector {
    readonly effect: BunTest.Tester<R | Scope.Scope>
    readonly flakyTest: <A, E, R2>(
      self: Effect.Effect<A, E, R2 | Scope.Scope>,
      timeout?: Duration.Input
    ) => Effect.Effect<A, never, R2>
    readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
      readonly timeout?: Duration.Input
    }) => {
      (f: (it: BunTest.MethodsNonLive<R | R2>) => void): void
      (
        name: string,
        f: (it: BunTest.MethodsNonLive<R | R2>) => void
      ): void
    }

    /**
     * Runs a synchronous property test using Schema or Arbitrary inputs.
     *
     * **Details**
     *
     * Returning `false` or throwing falsifies the property and triggers shrinking. A callback that returns normally
     * without returning `false` passes for that generated input.
     *
     * @since 0.0.0
     */
    readonly prop: <const Arbs extends Arbitraries>(
      name: string,
      arbitraries: Arbs,
      self: (
        properties: {
          [K in keyof Arbs]: ArbitraryValue<Arbs[K]>
        },
        ctx: TestContext
      ) => void,
      timeout?:
        | number
        | TestOptions & {
          arbitrary?: Arbitrary.CheckOptions
        }
    ) => void
  }

  /**
   * Top-level collector including live-clock tests and shared Layer construction.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Methods<R = never> extends MethodsNonLive<R> {
    readonly live: BunTest.Tester<Scope.Scope | R>
    readonly layer: <R2, E>(layer: Layer.Layer<R2, E, R>, options?: {
      readonly memoMap?: Layer.MemoMap
      readonly timeout?: Duration.Input
      readonly excludeTestServices?: boolean
    }) => {
      (f: (it: BunTest.MethodsNonLive<R | R2>) => void): void
      (
        name: string,
        f: (it: BunTest.MethodsNonLive<R | R2>) => void
      ): void
    }
  }
}

/**
 * Keep the upstream setup entrypoint available without registering custom equality testers.
 *
 * **Example** (Use addEqualityTesters in a test)
 *
 * ```ts
 * import { addEqualityTesters, expect } from "@beep/scratchpad/bun-test/index"
 * import * as Equal from "effect/Equal"
 * import * as O from "effect/Option"
 *
 * addEqualityTesters()
 * expect(Equal.equals(O.some(1), O.some(1))).toBe(true)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const addEqualityTesters: () => void = internal.addEqualityTesters

/**
 * Register a scoped Effect test with TestClock and TestConsole services.
 *
 * **Example** (Use effect in a test)
 *
 * ```ts
 * import { effect, expect } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * effect("asserts inside an Effect", () => Effect.sync(() => expect(2 + 2).toBe(4)))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const effect: BunTest.Tester<Scope.Scope> = internal.effect

/**
 * Register a scoped Effect test using the live runtime clock.
 *
 * **Example** (Use live in a test)
 *
 * ```ts
 * import { live } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * live("waits on the live clock", () => Effect.sleep("1 millis"))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const live: BunTest.Tester<Scope.Scope> = internal.live

/**
 * Share a Layer across tests in a block, closing its resources when the block finishes.
 *
 * **Example** (Use layer in a test)
 *
 * ```ts
 * import { layer, expect } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 * import * as Layer from "effect/Layer"
 *
 * layer(Layer.empty)("shared layer", (tests) => {
 *   tests.effect("runs in scope", () => Effect.sync(() => expect(true).toBe(true)))
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const layer: <R, E>(
  layer_: Layer.Layer<R, E>,
  options?: {
    readonly memoMap?: Layer.MemoMap
    readonly timeout?: Duration.Input
    readonly excludeTestServices?: boolean
  }
) => {
  (f: (it: BunTest.MethodsNonLive<R>) => void): void
  (name: string, f: (it: BunTest.MethodsNonLive<R>) => void): void
} = internal.layer

/**
 * Retry a scoped Effect failure within the helper's bounded retry policy.
 *
 * **Example** (Use flakyTest in a test)
 *
 * ```ts
 * import { flakyTest, effect } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * effect("retries transient work", () => flakyTest(Effect.succeed(42)))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const flakyTest: <A, E, R>(
  self: Effect.Effect<A, E, R | Scope.Scope>,
  timeout?: Duration.Input
) => Effect.Effect<A, never, R> = internal.flakyTest

/**
 * Check a synchronous property with schema-derived inputs and explicit run options.
 *
 * **Example** (Use prop in a test)
 *
 * ```ts
 * import { prop, expect } from "@beep/scratchpad/bun-test/index"
 * import * as S from "effect/Schema"
 *
 * prop("generates integers", [S.Int], ([value]) => {
 *   expect(Number.isInteger(value)).toBe(true)
 * }, { arbitrary: { runs: 5, seed: 42 } })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const prop: BunTest.Methods["prop"] = internal.prop

/**
 * Register plain, scoped Effect, live-clock, and property tests through one collector.
 *
 * **Example** (Use it in a test)
 *
 * ```ts
 * import { it, expect } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * it.effect("checks a value", () => Effect.sync(() => expect(42).toBe(42)))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const it: BunTest.Methods = internal.makeMethods(internal.defaultApi)

/**
 * Extend a compatible collector with scoped Effect and property-test methods.
 *
 * **Example** (Use makeMethods in a test)
 *
 * ```ts
 * import { makeMethods, expect, it } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * const tests = makeMethods(it)
 * tests.effect("uses an extended collector", () => Effect.sync(() => expect(true).toBe(true)))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeMethods: (it: Collector) => BunTest.Methods = internal.makeMethods

/**
 * Create a named suite whose callback receives the Effect-aware collector.
 *
 * **Example** (Use describeWrapped in a test)
 *
 * ```ts
 * import { describeWrapped, expect } from "@beep/scratchpad/bun-test/index"
 * import { Effect } from "effect"
 *
 * describeWrapped("Effect examples", (tests) => {
 *   tests.effect("asserts a result", () => Effect.sync(() => expect(1).toBe(1)))
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const describeWrapped: (name: string, f: (it: BunTest.Methods) => void) => void = internal.describeWrapped
