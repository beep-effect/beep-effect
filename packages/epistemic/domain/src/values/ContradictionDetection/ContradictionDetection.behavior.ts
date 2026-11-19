/**
 * Content-derived proposal identity for detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeDetectionProposalId } from "@beep/epistemics/ContradictionDetection";
import {
  BeliefVersionRef,
  ContradictionProposalContent,
  ContradictionProposalId as ProposalIdSchema,
} from "../Contradiction/index.ts";
import type * as Result from "effect/Result";
import type * as S from "effect/Schema";
import type { ContradictionProposalId } from "../Contradiction/index.ts";
/**
 * Hash the losing immutable ref and the complete replacement fact for one proposal.
 *
 * **Example** (detectionProposalId)
 *
 * ```ts import.meta.vitest name="detectionProposalId"
 * import { detectionProposalId } from "@beep/epistemic-domain/values/ContradictionDetection"
 * import { BeliefVersionRef } from "@beep/epistemic-domain/values/Contradiction"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import * as Str from "effect/String"
 * const ref = Result.getOrThrow(S.decodeResult(BeliefVersionRef)({ edgeVersionId: 1, logicalKey: Str.repeat(64)("a"), version: 1 }))
 * const id = Result.getOrThrow(detectionProposalId(ref, { subject: "example", predicate: "status", value: "A", polarity: "asserted" }))
 * Str.length(id) // => 64
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
