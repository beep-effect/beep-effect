/**
 * Typed contradiction-detection boundary failure.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ContradictionDetection/ContradictionDetection.errors");
/**
 * Rejects a snapshot or generated content that fails its schema.
 *
 * **Example** (Inspect the error tag)
 *
 * ```ts import.meta.vitest name="Inspect the error tag"
 * import { ContradictionDetectionError } from "@beep/epistemic-use-cases/server"
 * console.log(ContradictionDetectionError.make({ cause: "invalid snapshot" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionDetectionError extends S.TaggedError<ContradictionDetectionError>(
  $I`ContradictionDetectionError`
)(
  "ContradictionDetectionError",
  { cause: S.Defect({ includeStack: true }) },
  $I.annote("ContradictionDetectionError", {
    description: "Schema failure at the pure detection boundary; no partial output is returned.",
  })
) {}
