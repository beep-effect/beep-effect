/**
 * Workspace Turn table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Turn row converter exports.
 *
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
 * Turn table exports.
 *
 * **Example** (Log table entity type)
 *
 * ```ts
 * import * as Turn from "@beep/workspace-tables/entities/Turn"
 *
 * console.log(Turn.Table.definition.entityId.entityType)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Turn.table.ts";
