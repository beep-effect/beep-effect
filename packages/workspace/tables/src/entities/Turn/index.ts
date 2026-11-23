/**
 * Workspace Turn table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * **Example** (Log toTurnInsert export)
 *
 * ```ts
 * import * as Turn from "@beep/workspace-tables/entities/Turn"
 *
 * console.log(Turn.toTurnInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Turn.converters.ts";
/**
 * **Example** (Import Turn converter error)
 *
 * ```ts
 * import * as Turn from "@beep/workspace-tables/entities/Turn"
 *
 * console.log(Turn.TurnConverterError._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Turn.errors.ts";
/**
 * **Example** (Log table entity type)
 *
 * ```ts
 * import * as Turn from "@beep/workspace-tables/entities/Turn"
 *
 * console.log(Turn.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Turn.table.ts";
