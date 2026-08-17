/**
 * Knowledge-surface verification command suite.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Knowledge command group root and the semantic-delta subcommand.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  applyKnowledgeRefsCheck,
  knowledgeCommand,
  knowledgeRefsCheckFailure,
  knowledgeRefsCommand,
  knowledgeSemanticDeltaCommand,
  knowledgeSemanticDeltaFailure,
} from "./Knowledge.command.ts";
/**
 * Knowledge semantic-delta tagged errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Knowledge.errors.ts";
/**
 * Reference census schemas, shared scanning machinery, classifier, and tree evaluator.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Knowledge.refs.ts";
/**
 * Versioned Stage-1 finding and delta-report schema surface.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Knowledge.schemas.ts";
/**
 * Paired-archive scanner service, live layer, and identity helpers.
 *
 * @category services
 * @since 0.0.0
 */
export {
  KnowledgeService,
  KnowledgeServiceLive,
  makeKnowledgeFindingId,
  makeKnowledgeTreeOracle,
  resolveKnowledgeProbePolicy,
  scanKnowledgePair,
} from "./Knowledge.service.ts";
/**
 * Paired-archive scanner service contracts.
 *
 * @category services
 * @since 0.0.0
 */
export type {
  KnowledgeArchiveOracle,
  KnowledgePairedOracleInput,
  KnowledgeServiceShape,
  KnowledgeTreeOracle,
} from "./Knowledge.service.ts";
