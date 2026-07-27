/**
 * Shared runtime utilities for beep.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Core `effect/Function` combinators for data flow and argument-order adaptation.
 *
 * @category utilities
 * @since 0.0.0
 */
export { dual, flow, identity, pipe } from "effect/Function";
/**
 * Array utilities extending `effect/Array` with non-empty variants.
 *
 * @example
 * ```ts
 * import { A } from "@beep/utils"
 *
 * const values = A.makeReadonly("beep")
 * console.log(values)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as A from "./Array.ts";
/**
 * Boolean utilities re-exported from `effect/Boolean`.
 *
 * @example
 * ```ts
 * import { Bool } from "@beep/utils"
 *
 * console.log(Bool)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Bool from "./Bool.ts";
/**
 * DateTime utilities extending `effect/DateTime`.
 *
 * @example
 * ```ts
 * import { DateTime } from "@beep/utils"
 *
 * console.log(DateTime)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as DateTime from "./DateTime.ts";
/**
 * DrainableWorker - A queue-based worker that exposes a `drain()` effect.
 *
 * Wraps the common `Queue.unbounded` + `Effect.forever` pattern and adds
 * a signal that resolves when the queue is empty **and** the current item
 * has finished processing. This lets tests replace timing-sensitive
 * `Effect.sleep` calls with deterministic `drain()`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./DrainableWorker.ts";
/**
 * Equality utilities extending `effect/Equal`.
 *
 * @example
 * ```ts
 * import { Eq } from "@beep/utils"
 *
 * const equals = Eq.equals(42)(42)
 * console.log(equals)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Eq from "./Equal.ts";
/**
 * Error combinators for dual `Effect.mapError` wrappers.
 *
 * @example
 * ```ts
 * import { Err } from "@beep/utils"
 * import { Effect } from "effect"
 *
 * class MyError {
 *   readonly message: string
 *
 *   constructor(message: string) {
 *     this.message = message
 *   }
 * }
 *
 * const mapMyError = Err.mapToError((message: string) => new MyError(message))
 * const error = Effect.runSync(Effect.flip(mapMyError(Effect.fail("raw"), "Mapped failure.")))
 *
 * console.log(error.message)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Err from "./Errors.ts";
/**
 * File-system helpers: synchronous, layer-free `Effect` wrappers over
 * `node:fs` (`appendFileSync`, `existsSync`, `rmSync`, `renameSync`,
 * `readdirSync`, `statSync`) plus the async watch helper `makeWaitForFile`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FileSystem } from "@beep/utils"
 *
 * console.log(Effect.runSync(FileSystem.existsSync(".")))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as FileSystem from "./FileSystem.ts";
/**
 * Global singleton value helper.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./GlobalValue.ts";
/**
 * HTML escaping helpers.
 *
 * @example
 * ```ts
 * import { Html } from "@beep/utils"
 *
 * const escaped = Html.escapeHtml("<strong>beep</strong>")
 * console.log(escaped)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Html from "./Html.ts";
/**
 * Number utilities extending `effect/Number`.
 *
 * @example
 * ```ts
 * import { N } from "@beep/utils"
 *
 * const whole = N.isInteger(42)
 * console.log(whole)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as N from "./Number.ts";
/**
 * Option utilities extending `effect/Option`.
 *
 * @example
 * ```ts
 * import { O } from "@beep/utils"
 *
 * const value = O.some("beep")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as O from "./Option.ts";
/**
 * Path utilities wrapping `node:path`, mirroring effect's `Path` service.
 *
 * @example
 * ```ts
 * import { Path } from "@beep/utils"
 *
 * console.log(Path.join("a", "b"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Path from "./Path.ts";
/**
 * Predicate utilities extending `effect/Predicate`.
 *
 * @example
 * ```ts
 * import { P } from "@beep/utils"
 *
 * const object = P.isObject({ ok: true })
 * console.log(object)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as P from "./Predicate.ts";
/**
 * Random value service helpers.
 *
 * @example
 * ```ts
 * import { RandomValues } from "@beep/utils"
 *
 * console.log(RandomValues.Default)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Random.ts";
/**
 * Record utilities extending `effect/Record` with dot-path access.
 *
 * @example
 * ```ts
 * import { R } from "@beep/utils"
 *
 * const entries = R.toEntries({ id: 1, name: "Ada" })
 * console.log(entries)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as R from "./Record.ts";
/**
 * String utilities extending `effect/String` with typed case conversions.
 *
 * @example
 * ```ts
 * import { Str } from "@beep/utils"
 *
 * const slug = Str.toSlug("Hello, Beep Effect!")
 * console.log(slug)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Str from "./Str.ts";
/**
 * Stream utilities extending `effect/Stream`.
 *
 * @example
 * ```ts
 * import { Stream } from "@beep/utils"
 *
 * console.log(Stream)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Stream from "./Stream.ts";
/**
 * Struct utilities extending `effect/Struct` with dot-path access.
 *
 * @example
 * ```ts
 * import { Struct } from "@beep/utils"
 *
 * const keys = Struct.keys({ id: 1, name: "Ada" })
 * console.log(keys)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Struct from "./Struct.ts";
/**
 * Plain-text formatting helpers.
 *
 * @example
 * ```ts
 * import { Text } from "@beep/utils"
 *
 * const text = Text.joinLines(["alpha", "beta"])
 * console.log(text)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Text from "./Text.ts";
/**
 * thunk constants (`thunkTrue`, `thunkNull`, etc.).
 *
 * @example
 * ```ts
 * import { thunkTrue } from "@beep/utils"
 *
 * const value = thunkTrue()
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./thunk.ts";
/**
 * Miscellaneous runtime utilities re-exported from `effect/Utils`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Utils from "./Utils.ts";
