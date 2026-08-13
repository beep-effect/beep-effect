/**
 * Cross-slice candidate-promotion gate port.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { $SharedUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { PromotionGateVerdict, PromotionSubjectRef } from "./PromotionGate.schema.ts";

const $I = $SharedUseCasesId.create("PromotionGate/PromotionGate.service");

/**
 * Minimal promotion-gate service shape.
 *
 * **Details**
 *
 * Refusal is a value and the error/requirement channels are closed. Vertical
 * adapters must capture their dependencies and convert resolution or policy
 * failures to a blocked verdict, preserving fail-closed behavior.
 *
 * @category services
 * @since 0.0.0
 */
export interface PromotionGateShape {
  readonly evaluate: (subject: PromotionSubjectRef) => Effect.Effect<PromotionGateVerdict>;
}

/**
 * Service tag consulted immediately before candidate output acceptance.
 *
 * **Example** (Provide an always-clear proof gate)
 *
 * ```ts
 * import { PromotionGate, PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
 * import { Effect } from "effect"
 *
 * const program = PromotionGate.pipe(
 *   Effect.flatMap((gate) => gate.evaluate({ id: "subject-1", kind: "example" })),
 *   Effect.provideService(PromotionGate, PromotionGate.of({
 *     evaluate: () => Effect.succeed(PromotionGateVerdict.cases.clear.make({}))
 *   }))
 * )
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PromotionGate extends Context.Service<PromotionGate, PromotionGateShape>()($I`PromotionGate`) {}
