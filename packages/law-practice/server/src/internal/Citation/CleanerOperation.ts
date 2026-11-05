/** Cleaner operation integration with shared engine admission.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { CitationOperationAdmission } from "./Admission.ts";
import { makeCitationCleanerPipeline } from "./CleanerPipeline.ts";

/** Capture the shared admission owner and the owned cleaner runtime. A composed
 * engine supplies one admission instance to every operation adapter; nested plans
 * retain the pipeline's existing work ledger and do not acquire another permit.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationCleanerOperation = Effect.fn("Citation.makeCleanerOperation")(function* (policy: unknown) {
  const admission = yield* CitationOperationAdmission;
  const pipeline = yield* makeCitationCleanerPipeline(policy);
  return {
    run: Effect.fn("Citation.runAdmittedCleaner")((input: unknown) => admission.run("clean", pipeline.run(input))),
  };
});
