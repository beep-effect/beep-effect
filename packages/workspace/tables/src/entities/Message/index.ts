/**
 * Workspace Message table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Message row converter exports.
 *
 * **Example** (Import Message converter exports)
 *
 * ```ts
 * import * as Message from "@beep/workspace-tables/entities/Message"
 *
 * console.log(Message.toMessageInsert)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Message.converters.ts";
/**
 * Message table exports.
 *
 * **Example** (Log Message entity type)
 *
 * ```ts
 * import * as Message from "@beep/workspace-tables/entities/Message"
 *
 * console.log(Message.TABLE_NAME)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export * from "./Message.table.ts";
