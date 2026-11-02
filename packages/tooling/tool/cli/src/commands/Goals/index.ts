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
export * from "./Completion.ts";
/**
 * Merge-time completion evidence request and result schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./CompletionEvidence.schemas.ts";
/**
 * Completion GitHub port and merge-time evidence provider contracts.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./CompletionEvidence.service.ts";
/**
 * Merge-time completion evidence provider and pure verdict.
 *
 * @category queries
 * @since 0.0.0
 */
export * from "./CompletionEvidence.ts";
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
 * Mermaid capability-graph section for goals/INDEX.md.
 *
 * @category formatting
 * @since 0.0.0
 */
export * from "./Graph.mermaid.ts";
/**
 * Pure capability projection compiler, reference evaluator, and reports.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Graph.projection.ts";
/**
 * Capability-graph projection, answer, and report schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Graph.schemas.ts";
/**
 * In-memory bun:sqlite capability-graph engine.
 *
 * @category engines
 * @since 0.0.0
 */
export * from "./Graph.sqlite.ts";
/**
 * Read-only capability-graph commands and census loader.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Graph.ts";
/**
 * Packet inventory scan and README/manifest text helpers.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./Inventory.ts";
/**
 * Materialization executor: replay reviewed bootstrap and adoption plans.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Materialize.ts";
/**
 * Goal-fleet graph lint (duplicate ids, dependency cycles, dangling references).
 *
 * @category cli-commands
 * @since 0.0.0
 */
export * from "./Migration/ManifestTranslation.ts";
/**
 * Goal-fleet lint finding schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Migration/Migration.schemas.ts";
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
