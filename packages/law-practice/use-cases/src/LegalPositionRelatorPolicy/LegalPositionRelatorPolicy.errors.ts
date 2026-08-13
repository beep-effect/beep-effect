/**
 * Typed failures raised while admitting a legal position relator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.errors");

/**
 * A candidate record was not admitted as a stored legal position relation.
 *
 * **When to use**
 *
 * Use as the only failure a caller has to handle when offering a record for
 * admission. Every rejection arrives as this one tagged failure, so a caller
 * never has to reach into schema internals to learn that a record was refused.
 *
 * **Details**
 *
 * Admission refuses two families of record, and both are schema facts rather
 * than legal judgments. A record missing any required field is refused because
 * a relation cannot be read without it — which position, held by whom against
 * whom, about what act, under which norm, from which lineage, within which
 * scope, and on whose reading. A record whose `positionKind` is burden-side is
 * refused because only the advantage side is ever stored, and its burden-side
 * readings are derived views.
 *
 * `message` carries the underlying schema failure, whose text names the exact
 * key path that was refused. That is what makes a rejection actionable without
 * this package having to re-describe the relator's own required-field set.
 *
 * **Gotchas**
 *
 * A refusal says the record is not readable as a relation. It never says the
 * relation does not obtain in law, and nothing here computes that.
 *
 * **Example** (Report a refused record)
 *
 * ```ts
 * import { LegalPositionRelatorAdmissionError } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 *
 * const error = LegalPositionRelatorAdmissionError.make({
 *   message: 'Missing key\n  at ["scope"]',
 * })
 * console.log(error._tag) // "LegalPositionRelatorAdmissionError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class LegalPositionRelatorAdmissionError extends S.TaggedError<LegalPositionRelatorAdmissionError>(
  $I`LegalPositionRelatorAdmissionError`
)(
  "LegalPositionRelatorAdmissionError",
  {
    message: S.String,
  },
  $I.annote("LegalPositionRelatorAdmissionError", {
    description: "Failure raised when a candidate record is not admissible as a stored legal position relation.",
  })
) {
  /**
   * Construct an admission failure from the schema failure that refused the
   * record.
   *
   * **Details**
   *
   * The schema failure is rendered rather than carried, so the typed error stays
   * a law-practice value and callers never depend on the shape of an issue tree.
   *
   * **Example** (Adapt a decode failure at the admission boundary)
   *
   * ```ts
   * import { LegalPositionRelatorAdmissionError } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
   * import { LegalPositionRelator } from "@beep/law-practice-domain"
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   *
   * const admitted = S.decodeUnknownEffect(LegalPositionRelator)({}).pipe(
   *   Effect.mapError(LegalPositionRelatorAdmissionError.fromSchemaError)
   * )
   * console.log(Effect.isEffect(admitted)) // true
   * ```
   *
   * @param error - The schema failure that refused the record.
   * @returns A relator admission failure carrying the rendered schema failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromSchemaError = (error: S.SchemaError): LegalPositionRelatorAdmissionError =>
    LegalPositionRelatorAdmissionError.make({ message: String(error) });
}
