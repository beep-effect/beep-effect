/**
 * Evaluation-scope ownership of the same complete local lexical provider as production.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  ClaimInspectionLexicalRuntimeLive,
  claimInspectionWithLexicalRuntimeLayer,
} from "@beep/law-practice-server/ClaimInspection";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * Build both lexical services once in the caller's outer scope, then reuse that
 * exact context while each family supplies its own acquisition layer and scope.
 * Typed initialization failure is replayed through the shared production factory;
 * defects and cancellation escape, and activation refusals remain hard failures.
 * @category testing
 * @since 0.0.0
 */
export const makeEvaluationInspectionRuntime = Effect.fn("InspectionEvaluation.lexicalRuntime")(function* (
  runtime: typeof ClaimInspectionLexicalRuntimeLive = ClaimInspectionLexicalRuntimeLive
) {
  const built = yield* runtime.pipe(Layer.build, Effect.result);
  const fixed =
    built._tag === "Success"
      ? Layer.succeedContext(built.success)
      : Effect.fail(built.failure).pipe(Layer.effectContext);
  return claimInspectionWithLexicalRuntimeLayer(fixed);
});
