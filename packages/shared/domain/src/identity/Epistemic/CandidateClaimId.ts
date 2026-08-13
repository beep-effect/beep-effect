/**
 * CandidateClaimId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $EpistemicDomainId.create("identity/Epistemic");
const make = EntityId.factory("epistemic", $I);

/**
 * Candidate claim entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.CandidateClaimId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateClaimId = make("candidate_claim", {
  description: "Identifier for a candidate claim entity.",
});

/**
 * Runtime type for {@link CandidateClaimId}.
 *
 * **Example** (Decode CandidateClaimId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.CandidateClaimId = yield* S.decodeUnknownEffect(Epistemic.CandidateClaimId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateClaimId = typeof CandidateClaimId.Type;
