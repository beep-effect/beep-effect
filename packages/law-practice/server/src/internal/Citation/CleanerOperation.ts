/** Cleaner operation integration with shared engine admission.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { makeCitationCleanerPipeline } from "./CleanerPipeline.ts";
import { failCitationCleanerBoundary } from "./PortFailure.ts";

/** Capture the shared admission owner and the owned cleaner runtime. A composed
 * engine supplies one admission instance to every operation adapter; nested plans
 * retain the pipeline's existing work ledger and do not acquire another permit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCleanerOperation = Effect.fn("Citation.makeCleanerOperation")(function* (policy: unknown) {
  const pipeline = yield* makeCitationCleanerPipeline(policy);
  return {
    run: Effect.fn("Citation.runAdmittedCleaner")((input: unknown) =>
      pipeline.run(input).pipe(Effect.catch(failCitationCleanerBoundary))
    ),
    runOwned: Effect.fn("Citation.runAdmittedOwnedCleaner")((input: unknown) =>
      pipeline.runOwned(input).pipe(Effect.catch(failCitationCleanerBoundary))
    ),
  };
});
