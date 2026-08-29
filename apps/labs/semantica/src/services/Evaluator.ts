import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Crypto, Effect } from "effect";
import type { GoldUnavailable, ReportInvalid } from "@/schema/Errors";
import type { EvalReport, EvalRun } from "@/schema/Eval";
import type { ExtractOutcome } from "@/schema/Evidence";
import type { LedgerSnapshot } from "@/schema/Ledger";

const $I = $SemanticaId.create("services/Evaluator");

/**
 * C0 report scoring contract.
 *
 * @category services
 * @since 0.0.0
 */
interface EvaluatorShape {
  readonly score: (
    run: EvalRun,
    snapshot: LedgerSnapshot,
    outcomes: ReadonlyArray<ExtractOutcome>
  ) => Effect.Effect<EvalReport, GoldUnavailable | ReportInvalid, Crypto.Crypto>;
}

/**
 * App-local correctness evaluator.
 *
 * **Example** (Access the evaluator)
 *
 * ```ts
 * import { Evaluator } from "@/services/Evaluator"
 * import { Effect } from "effect"
 *
 * const program = Evaluator.pipe(Effect.map((service) => typeof service.score))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Evaluator extends Context.Service<Evaluator, EvaluatorShape>()($I`Evaluator`) {}
