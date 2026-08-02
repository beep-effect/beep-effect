/**
 * Contradiction-triage application service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import type { Effect } from "effect";
import type { GetContradictionCandidate, ReviewContradictionCandidate } from "./ContradictionTriage.commands.ts";
import type { ContradictionCandidatePage } from "./ContradictionTriage.ports.ts";
import type {
  ContradictionActionError,
  ContradictionCandidateDetailView,
  ContradictionListPayload,
  EvidenceSourcePage,
  EvidenceSourcePagePayload,
} from "./ContradictionTriage.rpc.ts";

const $I = $EpistemicUseCasesId.create("ContradictionTriage/ContradictionTriage.service");

/**
 * Server-only application facade consumed by contradiction RPC handlers.
 *
 * Port failures are translated to {@link ContradictionActionError} before they
 * leave this boundary.
 *
 * @example
 * ```ts
 * import { ContradictionTriage } from "@beep/epistemic-use-cases/server"
 *
 * console.log(ContradictionTriage.ContradictionTriageService.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ContradictionTriageService extends Context.Service<
  ContradictionTriageService,
  {
    readonly getCandidate: (
      query: GetContradictionCandidate
    ) => Effect.Effect<ContradictionCandidateDetailView, ContradictionActionError>;
    readonly getEvidenceSourcePage: (
      payload: EvidenceSourcePagePayload
    ) => Effect.Effect<EvidenceSourcePage, ContradictionActionError>;
    readonly listCandidates: (
      payload: ContradictionListPayload
    ) => Effect.Effect<ContradictionCandidatePage, ContradictionActionError>;
    readonly reviewCandidate: (
      command: ReviewContradictionCandidate
    ) => Effect.Effect<ContradictionDisposition, ContradictionActionError>;
  }
>()($I`ContradictionTriageService`) {}
