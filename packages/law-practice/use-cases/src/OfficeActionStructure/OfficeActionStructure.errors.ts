/**
 * Office-action persistence boundary failures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("OfficeActionStructure/OfficeActionStructure.errors");
/**
 * Reports sanitized persistence and append-only history integrity failures.
 *
 * **Example** (Inspect OfficeActionStructureStorageError)
 *
 * ```ts
 * import { OfficeActionStructureStorageError } from "@beep/law-practice-use-cases/OfficeActionStructure"
 * const error = OfficeActionStructureStorageError.make({ message: "Attempt log unavailable." })
 * console.log(error._tag) // "OfficeActionStructureStorageError"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OfficeActionStructureStorageError extends S.TaggedError<OfficeActionStructureStorageError>(
  $I`OfficeActionStructureStorageError`
)(
  "OfficeActionStructureStorageError",
  { message: S.NonEmptyString },
  $I.annote("OfficeActionStructureStorageError", {
    description: "Sanitized persistence, replay-integrity or append-only history rejection.",
  })
) {}
