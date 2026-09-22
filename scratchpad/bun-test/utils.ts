/**
 * Provides assertion helpers for the experimental native Bun test adapter.
 *
 * **Details**
 *
 * This module defines small assertion functions built on Node's `assert` and
 * Effect's equality support. The helpers cover basic equality, thrown errors,
 * defined and undefined values, strings, regular expressions, class instances,
 * `Option`, `Result`, and `Exit`. Most helpers are synchronous; `throwsAsync`
 * handles rejected promises.
 *
 * @since 0.0.0
 */
import * as A from "effect/Array";
import type * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as assert from "node:assert";

// ----------------------------
// Primitives
// ----------------------------

/**
 * Fails the current test with the provided error message.
 *
 * **Example** (Reject an invalid result)
 *
 * ```ts
 * import { fail, throws } from "@beep/scratchpad/bun-test/utils"
 *
 * throws(() => fail("invalid result"))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function fail(message: string) {
  assert.fail(message);
}

/**
 * Asserts that `actual` is deeply strictly equal to `expected` using Node's `assert.deepStrictEqual`.
 *
 * **Example** (Compare object values)
 *
 * ```ts
 * import { deepStrictEqual } from "@beep/scratchpad/bun-test/utils"
 *
 * deepStrictEqual({ count: 1 }, { count: 1 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function deepStrictEqual<A>(actual: A, expected: A, message?: string, ..._: Array<never>) {
  assert.deepStrictEqual(actual, expected, message as string);
}

/**
 * Asserts that `actual` is not deeply strictly equal to `expected` using Node's `assert.notDeepStrictEqual`.
 *
 * **Example** (Distinguish object values)
 *
 * ```ts
 * import { notDeepStrictEqual } from "@beep/scratchpad/bun-test/utils"
 *
 * notDeepStrictEqual({ count: 1 }, { count: 2 })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function notDeepStrictEqual<A>(actual: A, expected: A, message?: string, ..._: Array<never>) {
  assert.notDeepStrictEqual(actual, expected, message as string);
}

/**
 * Asserts that `actual` is strictly equal to `expected` using Node's `assert.strictEqual`.
 *
 * **Example** (Compare primitive values)
 *
 * ```ts
 * import { strictEqual } from "@beep/scratchpad/bun-test/utils"
 *
 * strictEqual(2 + 2, 4)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function strictEqual<A>(actual: A, expected: A, message?: string, ..._: Array<never>) {
  if (message !== undefined) {
    assert.strictEqual(actual, expected, message);
  } else {
    assert.strictEqual(actual, expected);
  }
}

/**
 * Asserts that `actual` is equal to `expected` using the `Equal.equals` trait.
 *
 * **Example** (Compare Effect values)
 *
 * ```ts
 * import { assertEquals } from "@beep/scratchpad/bun-test/utils"
 * import * as O from "effect/Option"
 *
 * assertEquals(O.some(1), O.some(1))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertEquals<A>(actual: A, expected: A, message?: string, ..._: Array<never>) {
  if (!Equal.equals(actual, expected)) {
    deepStrictEqual(actual, expected, message); // show diff
    fail(message ?? "Expected values to be Equal.equals");
  }
}

/**
 * Asserts that `thunk` does not throw an error.
 *
 * **Example** (Accept a successful assertion)
 *
 * ```ts
 * import { doesNotThrow, strictEqual } from "@beep/scratchpad/bun-test/utils"
 *
 * doesNotThrow(() => strictEqual(2 + 2, 4))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function doesNotThrow(thunk: () => void, message?: string, ..._: Array<never>) {
  assert.doesNotThrow(thunk, message);
}

// ----------------------------
// Derived
// ----------------------------

/**
 * Asserts that `value` is an instance of `constructor`.
 *
 * **Example** (Check a built-in instance)
 *
 * ```ts
 * import { assertInstanceOf } from "@beep/scratchpad/bun-test/utils"
 *
 * assertInstanceOf(new Date(0), Date)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertInstanceOf<C extends abstract new (...args: any) => any>(
  value: unknown,
  constructor: C,
  message?: string,
  ..._: Array<never>
): asserts value is InstanceType<C> {
  if (!(value instanceof constructor)) {
    fail(message ?? `Expected value to be an instance of ${constructor.name}`);
  }
}

/**
 * Asserts that `self` is `true`.
 *
 * **Example** (Require true)
 *
 * ```ts
 * import { assertTrue } from "@beep/scratchpad/bun-test/utils"
 *
 * assertTrue(2 + 2 === 4)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertTrue(self: unknown, message?: string, ..._: Array<never>): asserts self {
  strictEqual(self, true, message);
}

/**
 * Asserts that `self` is `false`.
 *
 * **Example** (Require false)
 *
 * ```ts
 * import { assertFalse } from "@beep/scratchpad/bun-test/utils"
 *
 * assertFalse(Number.isNaN(42))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertFalse(self: boolean, message?: string, ..._: Array<never>) {
  strictEqual(self, false, message);
}

/**
 * Asserts that `actual` includes `expected` (substring or array element).
 *
 * **Example** (Check a substring)
 *
 * ```ts
 * import { assertInclude } from "@beep/scratchpad/bun-test/utils"
 *
 * assertInclude("hello world", "world")
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertInclude(
  actual: string | ReadonlyArray<unknown> | undefined,
  expected: unknown,
  ..._: Array<never>
) {
  if (P.isString(actual)) {
    if (!P.isString(expected) || !actual.includes(expected)) {
      fail(`Expected\n\n${actual}\n\nto include\n\n${expected}`);
    }
    return;
  }
  if (A.isArray(actual)) {
    if (!actual.includes(expected)) {
      fail(`Expected\n\n${JSON.stringify(actual)}\n\nto include\n\n${JSON.stringify(expected)}`);
    }
    return;
  }
  fail(`Expected\n\n${actual}\n\nto include\n\n${expected}`);
}

/**
 * Asserts that `actual` matches `regExp`.
 *
 * **Example** (Check a text pattern)
 *
 * ```ts
 * import { assertMatch } from "@beep/scratchpad/bun-test/utils"
 *
 * assertMatch("item-42", /^item-\d+$/)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertMatch(actual: string, regExp: RegExp, ..._: Array<never>) {
  if (!regExp.test(actual)) {
    fail(`Expected\n\n${actual}\n\nto match\n\n${regExp}`);
  }
}

/**
 * Asserts that `thunk` throws, optionally checking the thrown value against an expected `Error` or validation function.
 *
 * **Example** (Check an assertion failure)
 *
 * ```ts
 * import { throws, strictEqual } from "@beep/scratchpad/bun-test/utils"
 *
 * throws(() => strictEqual(1, 2))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function throws(thunk: () => void, error?: Error | ((u: unknown) => undefined), ..._: Array<never>) {
  try {
    thunk();
  } catch (e) {
    if (error !== undefined) {
      if (P.isFunction(error)) {
        error(e);
      } else {
        deepStrictEqual(e, error);
      }
    }
    return;
  }
  fail("Expected to throw an error");
}

/**
 * Asserts that `thunk` throws or returns a rejected promise, optionally checking the failure value against an expected `Error` or validation function.
 *
 * **Example** (Check a rejected promise)
 *
 * ```ts
 * import { throwsAsync } from "@beep/scratchpad/bun-test/utils"
 *
 * await throwsAsync(() => Promise.reject("expected rejection"))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function throwsAsync(
  thunk: () => Promise<void>,
  error?: Error | ((u: unknown) => undefined),
  ..._: Array<never>
): Promise<void> {
  return Effect.tryPromise(thunk).pipe(
    Effect.match({
      onFailure: ({ cause: e }) => {
        if (error !== undefined) {
          if (P.isFunction(error)) {
            error(e);
          } else {
            deepStrictEqual(e, error);
          }
        }
      },
      onSuccess: () => fail("Expected to throw an error"),
    }),
    Effect.runPromise
  );
}

// ----------------------------
// Option
// ----------------------------

/**
 * Asserts that `option` is `None`.
 *
 * **Example** (Check an absent value)
 *
 * ```ts
 * import { assertNone } from "@beep/scratchpad/bun-test/utils"
 * import * as O from "effect/Option"
 *
 * assertNone(O.none())
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertNone<A>(option: O.Option<A>, ..._: Array<never>): asserts option is O.None<never> {
  deepStrictEqual(option, O.none());
}

/**
 * Asserts that `a` is not `undefined`.
 *
 * **Example** (Check a present value)
 *
 * ```ts
 * import { assertDefined } from "@beep/scratchpad/bun-test/utils"
 *
 * assertDefined("ready")
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertDefined<A>(a: A | undefined, ..._: Array<never>): asserts a is Exclude<A, undefined> {
  if (a === undefined) {
    fail("Expected value to be defined");
  }
}

/**
 * Asserts that `a` is `undefined`.
 *
 * **Example** (Check a missing value)
 *
 * ```ts
 * import { assertUndefined } from "@beep/scratchpad/bun-test/utils"
 *
 * assertUndefined(undefined)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertUndefined<A>(a: A | undefined, ..._: Array<never>): asserts a is undefined {
  if (a !== undefined) {
    fail("Expected value to be undefined");
  }
}

/**
 * Asserts that `option` is `Some` and contains a value equal to `expected`.
 *
 * **Example** (Check an optional payload)
 *
 * ```ts
 * import { assertSome } from "@beep/scratchpad/bun-test/utils"
 * import * as O from "effect/Option"
 *
 * assertSome(O.some(42), 42)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertSome<A>(option: O.Option<A>, expected: A, ..._: Array<never>): asserts option is O.Some<A> {
  deepStrictEqual(option, O.some(expected));
}

// ----------------------------
// Result
// ----------------------------

/**
 * Asserts that `result` is `Success` and contains a value equal to `expected`.
 *
 * **Example** (Check a successful result)
 *
 * ```ts
 * import { assertSuccess } from "@beep/scratchpad/bun-test/utils"
 * import * as Result from "effect/Result"
 *
 * assertSuccess(Result.succeed(42), 42)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertSuccess<A, E>(
  result: Result.Result<A, E>,
  expected: A,
  ..._: Array<never>
): asserts result is Result.Success<A, never> {
  deepStrictEqual(result, Result.succeed(expected));
}

/**
 * Asserts that `result` is `Failure` and contains an error equal to `expected`.
 *
 * **Example** (Check a failed result)
 *
 * ```ts
 * import { assertFailure } from "@beep/scratchpad/bun-test/utils"
 * import * as Result from "effect/Result"
 *
 * assertFailure(Result.fail("invalid"), "invalid")
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertFailure<A, E>(
  result: Result.Result<A, E>,
  expected: E,
  ..._: Array<never>
): asserts result is Result.Failure<never, E> {
  deepStrictEqual(result, Result.fail(expected));
}

// ----------------------------
// Exit
// ----------------------------

/**
 * Asserts that `exit` is a failure with a cause equal to `expected`.
 *
 * **Example** (Check an Effect failure cause)
 *
 * ```ts
 * import { assertExitFailure } from "@beep/scratchpad/bun-test/utils"
 * import * as Cause from "effect/Cause"
 * import * as Exit from "effect/Exit"
 *
 * const cause = Cause.fail("invalid")
 * assertExitFailure(Exit.failCause(cause), cause)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertExitFailure<A, E>(
  exit: Exit.Exit<A, E>,
  expected: Cause.Cause<E>,
  ..._: Array<never>
): asserts exit is Exit.Failure<never, E> {
  deepStrictEqual(exit, Exit.failCause(expected));
}

/**
 * Asserts that `exit` is a success with a value equal to `expected`.
 *
 * **Example** (Check an Effect success)
 *
 * ```ts
 * import { assertExitSuccess } from "@beep/scratchpad/bun-test/utils"
 * import * as Exit from "effect/Exit"
 *
 * assertExitSuccess(Exit.succeed(42), 42)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export function assertExitSuccess<A, E>(
  exit: Exit.Exit<A, E>,
  expected: A,
  ..._: Array<never>
): asserts exit is Exit.Success<A, never> {
  deepStrictEqual(exit, Exit.succeed(expected));
}
