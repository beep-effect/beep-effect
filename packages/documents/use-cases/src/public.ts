/**
 * Documents public use-case exports.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * @category errors
 * @since 0.0.0
 */
export * from "./aggregates/Document/Document.errors.ts";
/**
 * @category protocols
 * @since 0.0.0
 */
export * from "./aggregates/Document/Document.rpc.ts";
/**
 * Document intake service contract exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./aggregates/Document/DocumentIntake.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export * as Document from "./aggregates/Document/index.ts";
/**
 * Client-safe mirror disconnect reason export.
 *
 * @category use-cases
 * @since 0.0.0
 */
export { DmsMirrorDisconnectReason } from "./aggregates/Sync/DmsMirror.ts";
/**
 * Vault sync use-case namespace exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as Sync from "./aggregates/Sync/index.ts";
/**
 * Client-safe vault sync action error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { VaultSyncActionError } from "./aggregates/Sync/Sync.errors.ts";
/**
 * @category protocols
 * @since 0.0.0
 */
export * from "./aggregates/Sync/Sync.rpc.ts";
/**
 * @category use-cases
 * @since 0.0.0
 */
export { VaultSyncStatus } from "./aggregates/Sync/VaultSyncEngine.ts";
