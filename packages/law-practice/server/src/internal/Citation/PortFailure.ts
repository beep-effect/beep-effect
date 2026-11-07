/** Closed cleaner/resolver method failures, separate from installation errors.
 * @internal @packageDocumentation @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCleanerFailure,
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { CitationAdmissionFailure } from "./Admission.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";
import type { CitationCallbackFailure } from "./CallbackResource.ts";

const $I = $LawPracticeServerId.create("internal/Citation/PortFailure");
const CleanerFailure = S.Union([CitationCleanerFailure, CitationAdmissionFailure, CitationSafetyLimitExceeded]).pipe(
  $I.annoteSchema("CleanerFailure", {
    description: "Exact admitted-cleaner failure set before public method translation.",
  })
);
/** Translate the admitted cleaner's exact typed failure set. A driver or port
 * refusal is never substituted with an unsupported requested mode. Fresh public
 * failures exclude incidental private payloads and preserve exact safety limits.
 * @internal @category operations @since 0.0.0
 */
export const failCitationCleanerBoundary = Effect.fn("Citation.failCleanerBoundary")(function* (
  error: typeof CleanerFailure.Type
): Effect.fn.Return<never, CitationEngineFailure> {
  yield* Effect.logDebug("Citation cleaner boundary refused").pipe(
    Effect.annotateLogs({ operation: "clean", failureClass: error._tag })
  );
  return yield* Match.value(error).pipe(
    Match.tagsExhaustive({
      CitationCleanerFailure: () => Effect.fail(CitationInputError.make({ operation: "clean" })),
      CitationAdmissionFailure: () => Effect.fail(CitationInputError.make({ operation: "clean" })),
      CitationSafetyLimitExceeded: (failure) =>
        Effect.fail(CitationSafetyLimitExceeded.make({ operation: "clean", limit: failure.limit })),
    })
  );
});
/** Preserve known resolver resource categories and canonical evidence refusal.
 * Unhashable/custom port failures remain input refusal; absent resource metadata
 * never invents a budget name. Interruption/defects bypass typed translation.
 * @internal @category operations @since 0.0.0
 */
export const failCitationResolverBoundary = Effect.fn("Citation.failResolverBoundary")(function* (
  error: CitationCallbackFailure
): Effect.fn.Return<never, CitationEngineFailure> {
  yield* Effect.logDebug("Citation resolver boundary refused").pipe(
    Effect.annotateLogs({ operation: "resolve", failureClass: error._tag })
  );
  if (error.reason === "evidence-failed")
    return yield* CitationPrerequisiteError.make({ operation: "resolve", dependency: "source-evidence" });
  if (error.reason === "limit-exceeded" && error.limit !== undefined)
    return yield* CitationSafetyLimitExceeded.make({ operation: "resolve", limit: error.limit });
  return yield* CitationInputError.make({ operation: "resolve" });
});
