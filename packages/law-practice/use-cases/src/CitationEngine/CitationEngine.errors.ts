/** Closed server-only citation failures; no client or protocol surface.
 * @packageDocumentation @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationEngineOperation } from "./CitationEngine.operations.ts";
import { CitationSafetyLimitExceeded } from "./CitationEngine.safety.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.errors");
const Dependency = LiteralKit(["source-evidence", "court-reporter-vocabulary"]).pipe(
  $I.annoteSchema("Dependency", {
    description: "Published prerequisite whose availability or compatibility prevents completion.",
  })
);
/** Request or schema boundary refusal without source values or nested causes.
 * **Example** (Refuse malformed extraction input)
 * ```ts
 * import { CitationInputError } from "@beep/law-practice-use-cases/server"
 * console.log(CitationInputError.make({ operation: "extract" })._tag) // "CitationInputError"
 * ```
 * @category errors @since 0.0.0
 */
export class CitationInputError extends S.TaggedError<CitationInputError, { readonly brand: unique symbol }>(
  $I`CitationInputError`
)(
  "CitationInputError",
  { operation: CitationEngineOperation },
  $I.annoteError<CitationInputError>("CitationInputError", {
    description: "Server schema/request failure with no input text, path, native frame or schema cause.",
  })
) {}
/** Missing, incompatible or invalid prerequisite evidence/vocabulary.
 * **Example** (Refuse unverifiable source evidence)
 * ```ts
 * import { CitationPrerequisiteError } from "@beep/law-practice-use-cases/server"
 * console.log(CitationPrerequisiteError.make({ operation: "extract", dependency: "source-evidence" }).dependency)
 * // "source-evidence"
 * ```
 * @category errors @since 0.0.0
 */
export class CitationPrerequisiteError extends S.TaggedError<
  CitationPrerequisiteError,
  { readonly brand: unique symbol }
>($I`CitationPrerequisiteError`)(
  "CitationPrerequisiteError",
  { operation: CitationEngineOperation, dependency: Dependency },
  $I.annoteError<CitationPrerequisiteError>("CitationPrerequisiteError", {
    description: "Prerequisite refusal without evidence payloads, publication text or underlying causes.",
  })
) {}
/** Invalid replacement, markup or annotation operation; never partial output.
 * **Example** (Refuse invalid markup)
 * ```ts
 * import { CitationAnnotationError } from "@beep/law-practice-use-cases/server"
 * console.log(CitationAnnotationError.make({}).operation) // "annotate"
 * ```
 * @category errors @since 0.0.0
 */
export class CitationAnnotationError extends S.TaggedError<CitationAnnotationError, { readonly brand: unique symbol }>(
  $I`CitationAnnotationError`
)(
  "CitationAnnotationError",
  { operation: S.tag("annotate") },
  $I.annoteError<CitationAnnotationError>("CitationAnnotationError", {
    description: "Invalid annotation without replacement/markup/source contents or partial rendered output.",
  })
) {}
/** Explicitly unsupported requested mode. Never substitute this for a missing
 * canonical capability, an unknown citation meaning or an unresolved authority.
 * **Example** (Name the affected operation without echoing an arbitrary mode)
 * ```ts
 * import { CitationOperationUnsupported } from "@beep/law-practice-use-cases/server"
 * console.log(CitationOperationUnsupported.make({ operation: "annotate" })._tag) // "CitationOperationUnsupported"
 * ```
 * @category errors @since 0.0.0
 */
export class CitationOperationUnsupported extends S.TaggedError<
  CitationOperationUnsupported,
  { readonly brand: unique symbol }
>($I`CitationOperationUnsupported`)(
  "CitationOperationUnsupported",
  { operation: CitationEngineOperation },
  $I.annoteError<CitationOperationUnsupported>("CitationOperationUnsupported", {
    description:
      "Explicit mode refusal without leaking a caller-controlled label or disguising missing canonical work.",
  })
) {}
/** Exactly the five specified server failures. Ambiguous/unresolved/unknown
 * citation meanings remain domain outcomes, not members of this error union.
 * **Example** (Recognize a boundary failure)
 * ```ts
 * import { CitationEngineFailure, CitationInputError } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationEngineFailure)(CitationInputError.make({ operation: "extract" }))) // true
 * ```
 * @category errors @since 0.0.0
 */
export const CitationEngineFailure = S.Union([
  CitationInputError,
  CitationPrerequisiteError,
  CitationSafetyLimitExceeded,
  CitationAnnotationError,
  CitationOperationUnsupported,
]).pipe(
  $I.annoteSchema("CitationEngineFailure", {
    description: "Closed source-free server failure union; never a client action failure.",
  })
);
/** Schema-derived server failure type.
 * **Example** (Type a server failure)
 * ```ts
 * import { CitationInputError, type CitationEngineFailure } from "@beep/law-practice-use-cases/server"
 * const failure: CitationEngineFailure = CitationInputError.make({ operation: "extract" })
 * console.log(failure.operation) // "extract"
 * ```
 * @category errors @since 0.0.0
 */
export type CitationEngineFailure = typeof CitationEngineFailure.Type;
