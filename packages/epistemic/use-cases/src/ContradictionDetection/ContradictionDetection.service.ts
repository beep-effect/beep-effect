/**
 * Pure snapshot detection service contract.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type {
  ContradictionDetectionSnapshot,
  DetectedContradiction,
} from "@beep/epistemic-domain/values/ContradictionDetection";
import type * as Effect from "effect/Effect";
import type { ContradictionDetectionError } from "./ContradictionDetection.errors.ts";

const $I = $EpistemicUseCasesId.create("ContradictionDetection/ContradictionDetection.service");
/**
 * Proposes contradictions from one complete view without external services.
 *
 * **Example** (Inspect the service key)
 *
 * ```ts import.meta.vitest name="Inspect the service key"
 * import { ContradictionDetectionService } from "@beep/epistemic-use-cases/server"
 * console.log(ContradictionDetectionService.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ContradictionDetectionService extends Context.Service<
  ContradictionDetectionService,
  {
    readonly detect: (
      snapshot: ContradictionDetectionSnapshot
    ) => Effect.Effect<ReadonlyArray<DetectedContradiction>, ContradictionDetectionError>;
  }
>()($I`ContradictionDetectionService`) {}
