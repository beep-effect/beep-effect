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
  knowledgeDoctorCommand,
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
  guardKnowledgeCloneAttributes,
  KnowledgeService,
  KnowledgeServiceLive,
  knowledgeCommandWords,
  knowledgeFindingsFromCandidates,
  makeKnowledgeFindingId,
  makeKnowledgeTreeOracle,
  materializeKnowledgeTree,
  readKnowledgeGitRefNames,
  resolveKnowledgeProbePolicy,
  rewriteKnowledgeReferences,
  scanKnowledgePair,
} from "./Knowledge.service.ts";
/**
 * Stage-2 knowledge-doctor schemas: span classes, resolution witnesses, outcomes, and the report.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./KnowledgeDoctor.schemas.ts";
/**
 * Stage-2 knowledge doctor: extraction, classification, evaluators, overlay, and service.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./KnowledgeDoctor.service.ts";
/**
 * Paired-archive scanner service contracts.
 *
 * @category services
 * @since 0.0.0
 */
export type {
  KnowledgeArchiveOracle,
  KnowledgeMaterializedTree,
  KnowledgePairedOracleInput,
  KnowledgeServiceShape,
  KnowledgeTreeOracle,
} from "./Knowledge.service.ts";
