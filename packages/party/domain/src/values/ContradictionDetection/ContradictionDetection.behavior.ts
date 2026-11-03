/**
 * Content-derived proposal identity and canonical JSON reuse for detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  canonicalDetectionJson as canonicalJson,
  makeDetectionProposalId,
} from "@beep/epistemics/ContradictionDetection";
import {
  BeliefVersionRef,
  ContradictionProposalContent,
  ContradictionProposalId as ProposalIdSchema,
} from "../Contradiction/index.ts";
import type * as Result from "effect/Result";
import type * as S from "effect/Schema";
import type { ContradictionProposalId } from "../Contradiction/index.ts";
/**
 * Encode JSON values with the same canonicalizer used by shipped contradiction seals.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { canonicalDetectionJson } from "@beep/party-domain/ContradictionDetection"
 * const binding = canonicalDetectionJson
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalDetectionJson: (value: unknown) => string = canonicalJson;
/**
 * Hash the losing immutable ref and the complete replacement fact for one proposal.
 *
 * **Example** (Use the party binding)
 *
 * ```ts
 * import { detectionProposalId } from "@beep/party-domain/ContradictionDetection"
 * const binding = detectionProposalId
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const detectionProposalId: {
  (
    losingBelief: BeliefVersionRef,
    fact: typeof ContradictionProposalContent.fields.fact.Type
  ): Result.Result<ContradictionProposalId, S.SchemaError>;
  (
    fact: typeof ContradictionProposalContent.fields.fact.Type
  ): (losingBelief: BeliefVersionRef) => Result.Result<ContradictionProposalId, S.SchemaError>;
} = makeDetectionProposalId({
  contradiction: { ContradictionProposalId: ProposalIdSchema },
  BeliefVersionRef,
  ContradictionProposalContent,
}).detectionProposalId;
