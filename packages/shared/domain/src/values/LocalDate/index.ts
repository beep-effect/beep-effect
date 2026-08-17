/**
 * The LocalDate value object module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * LocalDate behavior helpers and constructors.
 *
 * **Example** (Logging today's ISO date)
 *
 * ```ts
 * import { today } from "@beep/shared-domain/values/LocalDate"
 *
 * console.log(today().toISOString())
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./LocalDate.behavior.ts";
/**
 * LocalDate model schema.
 *
 * **Example** (Inspecting Model schema)
 *
 * ```ts
 * import { Model } from "@beep/shared-domain/values/LocalDate"
 *
 * console.log(Model)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./LocalDate.model.ts";
