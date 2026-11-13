/** Fresh cleaner operation ownership for source replay fixtures.
 * @internal @packageDocumentation @since 0.0.0
 */
import { makeCitationOperationAdmission } from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationCleanerPipeline } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationCleaner } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import type { CitationCleanerObject, CitationEngineLimits } from "@beep/law-practice-use-cases/server";

/** Allocate a new admission owner and capture the exact replay runtime.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationReplayCleanerOperation = Effect.fn("CleanerReplayTest.makeOperation")(function* (
  limits: CitationEngineLimits,
  runtime: CitationCleaner["Service"]
) {
  const admission = yield* makeCitationOperationAdmission(limits);
  const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestScaffoldBinding(limits, "clean").pipe(
        Effect.map((bind) => ({ ...stage, run: bind(stage.run), runOwned: bind(stage.runOwned) }))
      )
    ),
    Effect.provideService(CitationCleaner, runtime)
  );
  // Original private failure categories remain observable in the source replay.
  // CitationPortFailure.test.ts separately verifies the public redaction boundary.
  const operation = {
    run: Effect.fn("CleanerReplayTest.run")((input: unknown) => admission.run("clean", pipeline.run(input))),
  };
  return { operation, admission };
});

/** Capture the actual issued source object after the runtime creates it.
 * @internal @category testing @since 0.0.0
 */
export const captureCitationReplaySource = Effect.fn("CleanerReplayTest.captureSource")(function* <E>(
  body: Effect.Effect<CitationCleanerObject, E>,
  retain: (value: CitationCleanerObject) => void
) {
  return yield* body.pipe(Effect.tap((value) => Effect.sync(() => retain(value))));
});
