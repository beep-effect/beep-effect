/**
 * Client-safe contradiction-triage query, review, and read-model exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Client-safe contradiction command schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  ContradictionCandidatePageLimit,
  ContradictionDispositionFilter,
  ContradictionReviewDecision,
  GetContradictionCandidate,
  ReviewContradictionCandidate,
} from "./ContradictionTriage.commands.ts";
/**
 * Client-safe contradiction read models.
 *
 * @category read-models
 * @since 0.0.0
 */
export {
  ContradictionCandidatePage,
  ContradictionCandidateSummary,
  ContradictionCandidateView,
} from "./ContradictionTriage.ports.ts";
/**
 * Client-safe contradiction RPC declarations and expanded read models.
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./ContradictionTriage.rpc.ts";
