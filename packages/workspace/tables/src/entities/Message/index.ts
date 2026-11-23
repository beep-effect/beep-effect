/**
 * Workspace Message table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
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
 * **Example** (Import Message converter error)
 *
 * ```ts
 * import * as Message from "@beep/workspace-tables/entities/Message"
 *
 * console.log(Message.MessageConverterError._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Message.errors.ts";
/**
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
