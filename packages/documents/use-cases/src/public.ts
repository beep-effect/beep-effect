/**
 * Documents public use-case exports.
 *
 * @packageDocumentation
 * @category use-cases
 * @since 0.0.0
 */

/**
 * Document intake error exports.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./aggregates/Document/Document.errors.js";
/**
 * Document intake RPC exports.
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./aggregates/Document/Document.rpc.js";
/**
 * Document intake service contract exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./aggregates/Document/DocumentIntake.js";
/**
 * Document use-case namespace exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as Document from "./aggregates/Document/index.js";
/**
 * Vault sync use-case namespace exports.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * as Sync from "./aggregates/Sync/index.js";
/**
 * Client-safe vault sync action error export.
 *
 * @category errors
 * @since 0.0.0
 */
export { VaultSyncActionError } from "./aggregates/Sync/Sync.errors.js";
/**
 * Vault sync RPC exports.
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./aggregates/Sync/Sync.rpc.js";
/**
 * Vault sync status read model export.
 *
 * @category use-cases
 * @since 0.0.0
 */
export { VaultSyncStatus } from "./aggregates/Sync/VaultSyncEngine.js";
