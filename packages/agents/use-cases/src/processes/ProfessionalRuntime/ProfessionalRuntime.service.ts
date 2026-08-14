/**
 * Public SDK facade contract for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Effect } from "effect";
import type { ProposeCandidateOutputSet } from "./ProfessionalRuntime.commands.ts";
import type { CandidateOutputSet, SdkContextPacket } from "./ProfessionalRuntime.contracts.ts";
import type {
  ProfessionalRuntimePromotionBlocked,
  ProfessionalRuntimeValidationError,
} from "./ProfessionalRuntime.errors.ts";
import type { GetContextPacket } from "./ProfessionalRuntime.queries.ts";

/**
 * SDK facade shape exposed to clients and adapters.
 *
 * **Example** (In-memory SDK instantiation)
 *
 * ```ts
 * import { makeInMemoryProfessionalRuntimeSdk } from "@beep/agents-use-cases/proof"
 * import { PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
 * import type { ProfessionalRuntimeSdk } from "@beep/agents-use-cases/public"
 * import { Effect } from "effect"
 *
 * const sdk: ProfessionalRuntimeSdk = makeInMemoryProfessionalRuntimeSdk({
 *   fixtures: [],
 *   promotionGate: { evaluate: () => Effect.succeed(PromotionGateVerdict.cases.clear.make({})) }
 * })
 * console.log(typeof sdk.getContextPacket) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ProfessionalRuntimeSdk {
  /**
   * Resolve the evidence-bounded context packet for a scenario artifact.
   *
   * @since 0.0.0
   */
  readonly getContextPacket: (
    query: GetContextPacket
  ) => Effect.Effect<SdkContextPacket, ProfessionalRuntimeValidationError>;
  /**
   * Validate and accept a candidate output set proposal for deterministic proof flows.
   *
   * @since 0.0.0
   */
  readonly proposeCandidateOutputSet: (
    command: ProposeCandidateOutputSet
  ) => Effect.Effect<CandidateOutputSet, ProfessionalRuntimePromotionBlocked | ProfessionalRuntimeValidationError>;
}
