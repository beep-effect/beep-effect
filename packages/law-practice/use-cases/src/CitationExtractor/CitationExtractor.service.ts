/**
 * Captured server-only six-form extraction service.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { CitationExtractorFailure } from "./CitationExtractor.errors.ts";
import type { CitationExtractorInput, CitationExtractorResult } from "./CitationExtractor.models.ts";

const $I = $LawPracticeUseCasesId.create("CitationExtractor/CitationExtractor.service");

/**
 * Extract verified plain-text occurrences and local links under the installed
 * six-form profile. All dependencies and policy are captured by the server Layer;
 * callers supply no services, callbacks or runtime selection.
 *
 * **Details**
 * Input, prerequisite, safety and recognition failures are closed. Ambiguous and unresolved
 * links remain document outcomes. Failed or interrupted work publishes no partial
 * result; physical worker retirement remains the implementation's responsibility.
 *
 * **Example** (Access the captured extractor)
 * ```ts
 * import { CitationExtractor } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () { return yield* CitationExtractor })
 * console.log(typeof program) // "object"
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationExtractor extends Context.Service<
  CitationExtractor,
  {
    readonly extract: (
      input: CitationExtractorInput
    ) => Effect.Effect<CitationExtractorResult, CitationExtractorFailure>;
  }
>()($I`CitationExtractor`) {}
