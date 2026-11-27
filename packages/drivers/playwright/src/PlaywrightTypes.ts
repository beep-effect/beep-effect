/**
 * Public type utilities used by page and locator evaluation APIs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { ElementHandle, JSHandle } from "playwright";

/**
 * A value representable in JSON.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

/**
 * The free-form accessibility tree returned by Playwright's JSON snapshot APIs.
 *
 * @category models
 * @since 0.0.0
 */
export type AriaSnapshotJSON = JsonValue;

/**
 * Recursively excludes Playwright handles from an argument shape.
 *
 * **Details**
 *
 * Adapted from Playwright's internal evaluation types.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NoHandles<Arg> = Arg extends JSHandle
  ? never
  : Arg extends (...args: infer T) => PromiseLike<infer U>
    ? (...args: T) => Promise<NoHandles<U>>
    : Arg extends (...args: infer T) => infer R
      ? (...args: T) => NoHandles<R>
      : Arg extends object
        ? { [Key in keyof Arg]: NoHandles<Arg[Key]> }
        : Arg;

/**
 * Converts Playwright handles to the values visible in the browser evaluation
 * context.
 *
 * @category type-level
 * @since 0.0.0
 */
export type Unboxed<Arg> =
  Arg extends ElementHandle<infer T>
    ? T
    : Arg extends JSHandle<infer T>
      ? T
      : Arg extends (...args: infer T) => PromiseLike<infer U>
        ? (...args: T) => Promise<Unboxed<U>>
        : Arg extends (...args: infer T) => infer R
          ? (...args: T) => Unboxed<R>
          : Arg extends NoHandles<Arg>
            ? Arg
            : Arg extends [infer A0]
              ? [Unboxed<A0>]
              : Arg extends [infer A0, infer A1]
                ? [Unboxed<A0>, Unboxed<A1>]
                : Arg extends [infer A0, infer A1, infer A2]
                  ? [Unboxed<A0>, Unboxed<A1>, Unboxed<A2>]
                  : Arg extends [infer A0, infer A1, infer A2, infer A3]
                    ? [Unboxed<A0>, Unboxed<A1>, Unboxed<A2>, Unboxed<A3>]
                    : Arg extends Array<infer T>
                      ? Array<Unboxed<T>>
                      : Arg extends object
                        ? { [Key in keyof Arg]: Unboxed<Arg[Key]> }
                        : Arg;

/**
 * A function or source string evaluated in a Playwright page context.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PageFunction<Arg, R> = string | ((arg: Unboxed<Arg>) => R | Promise<R>);
