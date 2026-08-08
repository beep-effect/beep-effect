/**
 * Claim gate port: the typed contract through which a candidate claim is
 * admitted or rejected. The gate is a thin composition over the bounded SHACL
 * engine; the live layer that resolves {@link ShaclValidationService} is provided
 * in the epistemic server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type * as DomainCandidateClaim from "@beep/epistemic-domain/entities/CandidateClaim";
import type * as DomainEvidence from "@beep/epistemic-domain/entities/Evidence";
import type { ClaimGateResult } from "@beep/epistemic-domain/values";
import type { ShaclValidationService } from "@beep/semantic-web/services/shacl-validation";
import type { Effect, Layer } from "effect";

const $I = $EpistemicUseCasesId.create("ClaimGate/ClaimGate.ports");

/**
 * Service shape for the claim gate: evaluate a candidate claim plus its evidence
 * and return a typed admitted/rejected verdict. Rejection is a value
 * ({@link ClaimGateResult}), never an error.
 *
 * **Example** (Stub evaluate admitted shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import type { ClaimGateShape } from "@beep/epistemic-use-cases/ClaimGate"
 *
 * const shape: ClaimGateShape = {
 *   evaluate: () => Effect.succeed({ verdict: "admitted" })
 * }
 *
 * strictEqual(typeof shape.evaluate, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ClaimGateShape {
  readonly evaluate: (
    claim: DomainCandidateClaim.CandidateClaim,
    evidence: ReadonlyArray<DomainEvidence.Evidence>
  ) => Effect.Effect<ClaimGateResult>;
}

/**
 * Claim gate service tag.
 *
 * **Example** (Provide service and yield)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import { ClaimGate } from "@beep/epistemic-use-cases/ClaimGate"
 *
 * const hasEvaluate = Effect.runSync(
 *   Effect.gen(function* () {
 *     const gate = yield* ClaimGate
 *     return typeof gate.evaluate === "function"
 *   }).pipe(
 *     Effect.provideService(
 *       ClaimGate,
 *       ClaimGate.of({
 *         evaluate: () => Effect.succeed({ verdict: "admitted" })
 *       })
 *     )
 *   )
 * )
 *
 * strictEqual(hasEvaluate, true)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ClaimGate extends Context.Service<ClaimGate, ClaimGateShape>()($I`ClaimGate`) {}

/**
 * The gate's live layer type, declaring its dependency on the bounded SHACL
 * engine. The implementation that satisfies this dependency is provided in the
 * epistemic server tier.
 *
 * **Example** (Annotate layer type parameter)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { ClaimGateLayer } from "@beep/epistemic-use-cases/ClaimGate"
 *
 * const describesLayer = (_layer: ClaimGateLayer) => "requires-shacl-validation"
 *
 * strictEqual(describesLayer.length > 0, true)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export type ClaimGateLayer = Layer.Layer<ClaimGate, never, ShaclValidationService>;
