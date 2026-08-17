/**
 * Workspace message entity exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Message model exports.
 *
 * **Example** (Import Message module)
 *
 * ```ts
 * import * as Message from "@beep/workspace-domain/entities/Message"
 *
 * console.log(Message.Message.sql.tableName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Message.model.ts";
/**
 * Message subsidiary value schema exports.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Message.values.ts";
