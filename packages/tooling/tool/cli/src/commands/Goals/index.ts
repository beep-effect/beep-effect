/**
 * Goals command group barrel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Read-only adoption snapshot, pure adoption compiler, and adopt command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Adopt.ts";
/**
 * Materialization-plan schema surface.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Bootstrap.schemas.ts";
/**
 * Pure bootstrap plan compiler and bootstrap command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Bootstrap.ts";
/**
 * Doctor command and baseline-ratchet exports.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Doctor.ts";
/**
 * Goals command group root.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Goals.command.ts";
/**
 * Goals tagged errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Goals.errors.ts";
/**
 * GoalManifest v2 schema surface.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Goals.schemas.ts";
/**
 * Packet inventory scan and README/manifest text helpers.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Inventory.ts";
/**
 * Packet-convention migration command and model surfaces.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Migration/ManifestTranslation.ts";
/**
 * Packet-convention CLI command surfaces.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Migration/Migration.command.ts";
/**
 * Packet-convention migration schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Migration/Migration.schemas.ts";
/**
 * Packet fork-repair and genesis mutation services.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Migration/PacketMutation.ts";
/**
 * Mechanical status-migration engine.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Migration.ts";
/**
 * Generated goals index command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./PortfolioIndex.ts";
/**
 * Operator risk-tier override command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./SetRiskTier.ts";
/**
 * Single-writer set-status command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./SetStatus.ts";
