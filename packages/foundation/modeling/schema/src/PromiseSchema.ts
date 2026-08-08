/**
 * Schema helpers for validating native JavaScript `Promise` values.
 *
 * This module intentionally avoids `instanceof Promise` so values created in
 * other realms can still validate. The runtime guard checks the standard
 * `then`, `catch`, and `finally` methods alongside the built-in promise
 * object tag to reject plain thenable objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("PromiseSchema");
const promiseObjectTag = "[object Promise]";
const promiseAnnotations = {
  typeConstructor: {
    _tag: "@beep/schema/PromiseSchema",
  },
  generation: {
    runtime: "PromiseSchema",
    Type: "PromiseSchema",
    importDeclaration: 'import { PromiseSchema } from "@beep/schema/PromiseSchema"',
  },
  expected: "Promise",
  description: "Schema for native JavaScript Promise values.",
  toEquivalence:
    () =>
    <A extends globalThis.Promise<unknown>>(self: A, that: A): boolean =>
      self === that,
  toFormatter: () => (): string => "[Promise]",
};

/**
 * Type guard that checks whether a value is a native JavaScript `Promise`.
 *
 * **Details**
 *
 * This guard is cross-realm aware and rejects plain thenable objects by
 * requiring the built-in promise tag in addition to the standard promise
 * instance methods.
 *
 * **Example** (Native promise versus thenable)
 *
 * ```ts
 * import { isPromise } from "@beep/schema/PromiseSchema"
 *
 * const nativePromise = globalThis.Promise.resolve(1)
 * const thenable = {
 *   then: () => undefined,
 *   catch: () => undefined,
 *   finally: () => undefined,
 * }
 *
 * console.log(isPromise(nativePromise)) // true
 * console.log(isPromise(thenable)) // false
 * ```
 *
 * @param u - The value to test.
 * @returns Whether the value is a native JavaScript `Promise`.
 * @category validation
 * @since 0.0.0
 */
export const isPromise = (u: unknown): u is globalThis.Promise<unknown> =>
  P.isObject(u) &&
  "then" in u &&
  P.isFunction(u.then) &&
  "catch" in u &&
  P.isFunction(u.catch) &&
  "finally" in u &&
  P.isFunction(u.finally) &&
  Object.prototype.toString.call(u) === promiseObjectTag;

/**
 * Declared schema for native JavaScript `Promise` values.
 *
 * **Example** (Decoding a native promise)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PromiseSchema } from "@beep/schema/PromiseSchema"
 *
 * const task = globalThis.Promise.resolve("done")
 * const decoded = S.decodeUnknownSync(PromiseSchema)(task)
 *
 * console.log(decoded === task)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PromiseSchema = S.declare<globalThis.Promise<unknown>>(isPromise, promiseAnnotations).pipe(
  $I.annoteSchema("PromiseSchema", {
    description: "A schema that validates native JavaScript Promise values.",
  })
);

/**
 * {@inheritDoc PromiseSchema}
 * @category models
 * @since 0.0.0
 */
export type PromiseSchema = typeof PromiseSchema.Type;
