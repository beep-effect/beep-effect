/** Narrow typed translation for established extraction-boundary failures.
 * Other private/native translators remain separate required integration work.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { CitationCanonicalSourceFailure } from "./CanonicalSource.ts";
import { CitationExtractionEntryFailure } from "./ExtractionEntry.ts";
import { CitationSemanticVocabularyFailure } from "./SemanticVocabulary.ts";
import { CitationVerifiedExtractionFailure } from "./VerifiedExtraction.ts";
import type { CitationEngineFailure, CitationEngineOperation } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("internal/Citation/EngineFailure");
const Failure = S.Union([
  CitationExtractionEntryFailure,
  CitationVerifiedExtractionFailure,
  CitationCanonicalSourceFailure,
  CitationSemanticVocabularyFailure,
  CitationSafetyLimitExceeded,
]).pipe(
  $I.annoteSchema("Failure", {
    description: "Only established request/source/vocabulary/safety boundaries; not an arbitrary-error fallback.",
  })
);
const translate = (operation: CitationEngineOperation, error: typeof Failure.Type): CitationEngineFailure =>
  Match.value(error).pipe(
    Match.tagsExhaustive({
      CitationExtractionEntryFailure: () => CitationInputError.make({ operation }),
      CitationVerifiedExtractionFailure: () => CitationInputError.make({ operation }),
      CitationCanonicalSourceFailure: () =>
        CitationPrerequisiteError.make({ operation, dependency: "source-evidence" }),
      CitationSemanticVocabularyFailure: () =>
        CitationPrerequisiteError.make({ operation, dependency: "court-reporter-vocabulary" }),
      CitationSafetyLimitExceeded: (failure) =>
        CitationSafetyLimitExceeded.make({ operation: failure.operation, limit: failure.limit }),
    })
  );
/** Translate only the typed established boundaries. Construct fresh failures
 * with declared fields, dropping incidental properties and nested source causes.
 * Debug metadata contains only closed operation/class labels. Missing canonical
 * capabilities and arbitrary native failures cannot become unsupported modes.
 * @internal @category operations @since 0.0.0
 */
export const failCitationExtractionBoundary = Effect.fn("Citation.failExtractionBoundary")(function* (
  operation: CitationEngineOperation,
  error: typeof Failure.Type
) {
  yield* Effect.logDebug("Citation extraction boundary refused").pipe(
    Effect.annotateLogs({ operation, failureClass: error._tag })
  );
  return yield* translate(operation, error);
});
