/**
 * Contradiction-triage RPC handlers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContradictionRpcs } from "@beep/epistemic-use-cases/public";
import { ContradictionTriageService } from "@beep/epistemic-use-cases/server";
import { Effect } from "effect";

/**
 * RPC handlers delegated to the contradiction-triage application service.
 *
 * **Example** (Verify Layer instance)
 *
 * ```ts
 * import { ContradictionHandlersLive } from "@beep/epistemic-server/layer"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ContradictionHandlersLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionHandlersLive = ContradictionRpcs.toLayer(
  Effect.map(ContradictionTriageService, (service) =>
    ContradictionRpcs.of({
      GetContradictionCandidate: service.getCandidate,
      GetEvidenceSourcePage: service.getEvidenceSourcePage,
      ListContradictionCandidates: service.listCandidates,
      ReviewContradictionCandidate: service.reviewCandidate,
    })
  )
);
