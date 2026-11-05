/** Fresh cleaner operation ownership for source replay fixtures.
 * @internal @packageDocumentation @since 0.0.0
 */
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationCleanerOperation } from "@beep/law-practice-server/internal/Citation/CleanerOperation";
import { CitationCleanerRuntime } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import * as Effect from "effect/Effect";
import type { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

/** Allocate a new admission owner and capture the exact replay runtime.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationReplayCleanerOperation = Effect.fn("CleanerReplayTest.makeOperation")(function* (
  limits: CitationEngineLimits,
  runtime: CitationCleanerRuntime["Service"]
) {
  const admission = yield* makeCitationOperationAdmission(limits);
  const operation = yield* makeCitationCleanerOperation(limits).pipe(
    Effect.provideService(CitationOperationAdmission, admission),
    Effect.provideService(CitationCleanerRuntime, runtime)
  );
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
