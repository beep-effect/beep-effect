/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * IR-to-law extraction error exports.
 *
 * @example
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/IrToLaw"
 *
 * console.log(Object.keys(Module).includes("IrToLawExtractionError")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./IrToLaw.errors.ts";
/**
 * IR-to-law port exports.
 *
 * @example
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/IrToLaw"
 *
 * console.log(Object.keys(Module).includes("IrToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./IrToLaw.ports.ts";
/**
 * IR-to-law implementation exports.
 *
 * @example
 * ```ts
 * import * as Module from "@beep/law-practice-use-cases/IrToLaw"
 *
 * console.log(Object.keys(Module).includes("makeIrToLaw")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./IrToLaw.service.ts";
