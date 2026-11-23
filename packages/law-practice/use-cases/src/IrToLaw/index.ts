/**
 * Package entrypoint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Check error export key)
 *
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
 * **Example** (Check service export key)
 *
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
 * **Example** (Check makeIrToLaw export)
 *
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
