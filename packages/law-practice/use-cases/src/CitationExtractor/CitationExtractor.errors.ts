/**
 * Closed failures for the server-only six-form extractor.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationInputError, CitationPrerequisiteError } from "../CitationEngine/CitationEngine.errors.ts";
import { CitationSafetyLimitExceeded } from "../CitationEngine/CitationEngine.safety.ts";

const $I = $LawPracticeUseCasesId.create("CitationExtractor/CitationExtractor.errors");
const Reason = LiteralKit(["parser-failed", "transport-failed", "invalid-observation"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Finite recognition refusals without source, process paths, diagnostics or nested causes.",
  })
);

/**
 * Source-free parser, process transport or semantic observation refusal.
 * An unsupported token or ambiguous link remains a result outcome.
 *
 * **Example** (Refuse an invalid parser observation)
 * ```ts
 * import { CitationRecognitionError } from "@beep/law-practice-use-cases/server"
 * console.log(CitationRecognitionError.make({ reason: "invalid-observation" }).reason) // "invalid-observation"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CitationRecognitionError extends S.TaggedError<
  CitationRecognitionError,
  { readonly brand: unique symbol }
>($I`CitationRecognitionError`)(
  "CitationRecognitionError",
  { reason: Reason },
  $I.annoteError<CitationRecognitionError>("CitationRecognitionError", {
    description: "Recognition refusal containing only a finite reason and no private parser or process details.",
  })
) {}

/**
 * Exactly the input, prerequisite, safety and recognition failures of the
 * six-form extractor. The legacy engine failure union remains unchanged.
 *
 * **Example** (Recognize a closed extractor failure)
 * ```ts
 * import { CitationExtractorFailure, CitationRecognitionError } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationExtractorFailure)(CitationRecognitionError.make({ reason: "parser-failed" }))) // true
 * ```
 * @category errors
 * @since 0.0.0
 */
export const CitationExtractorFailure = S.Union([
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
  CitationRecognitionError,
]).pipe(
  $I.annoteSchema("CitationExtractorFailure", {
    description: "Closed six-form server failures, separate from ambiguous or unresolved citation meanings.",
  })
);

/**
 * Schema-derived closed six-form extraction failure.
 * @category errors
 * @since 0.0.0
 */
export type CitationExtractorFailure = typeof CitationExtractorFailure.Type;
