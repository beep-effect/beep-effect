/**
 * Public entrypoint for `@beep/chalk`.
 *
 * **Details**
 *
 * Re-exports all symbols from the `./Chalk.ts` module, including the
 * default shared `chalk` instance, the `Chalk` constructor, schema-backed
 * color models, and compatibility arrays.
 *
 * **Example** (Shared and isolated chalk)
 *
 * ```ts
 * import chalk, { Chalk, ColorSupportLevel } from "@beep/chalk"
 * import * as S from "effect/Schema"
 *
 * // Shared instance
 * console.log(chalk.red.bold("Error"))
 *
 * // Isolated instance
 * const c = new Chalk({ level: 3 })
 * console.log(c.hex("#FF8800")("orange"))
 *
 * // Schema decode
 * console.log(S.decodeUnknownSync(ColorSupportLevel)(2))
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * @since 0.0.0
 * @category utilities
 */
export * from "./Chalk.ts";
/**
 * @since 0.0.0
 * @category utilities
 */
export { default } from "./Chalk.ts";
