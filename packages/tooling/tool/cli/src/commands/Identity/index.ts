/**
 * `beep identity` facade: the identity registry generator and its shard edits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public identity command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Identity.command.ts";
/**
 * Public `beep identity registry` command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Registry.command.ts";
/**
 * Public identity registry generator.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Registry.ts";
/**
 * Public reader of a base ref's term snapshot.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./RegistryBase.ts";
/**
 * Public identity registry shard edits: rebind and deprecate.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./ShardEdit.ts";
