import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type { ReasoningFailed } from "@/schema/Errors";
import type { RdfStatement, ReasoningResult } from "@/schema/Reasoning";

const $I = $SemanticaId.create("services/Reasoner");

interface ReasonerShape {
  readonly close: (asserted: ReadonlyArray<RdfStatement>) => Effect.Effect<ReasoningResult, ReasoningFailed>;
  readonly validate: (result: ReasoningResult) => Effect.Effect<void, ReasoningFailed>;
}

/**
 * Lab-local rho-df fixpoint and per-inference proof validator.
 *
 * **Example** (Access the closure operation)
 *
 * ```ts
 * import { Reasoner } from "@/services/Reasoner"
 * import { Effect } from "effect"
 *
 * const program = Reasoner.pipe(Effect.map((service) => typeof service.close))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Reasoner extends Context.Service<Reasoner, ReasonerShape>()($I`Reasoner`) {}
