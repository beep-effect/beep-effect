/**
 * Typed failures raised while evaluating the candor gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("CandorPolicy/CandorPolicy.errors");
const CandorRecordReadReasonBase = LiteralKit(["snapshot-unavailable"]);

/**
 * Machine-readable reason the recorded candor material could not be read.
 *
 * **Example** (Narrow a read failure reason)
 *
 * ```ts
 * import { CandorRecordReadReason } from "@beep/law-practice-use-cases/CandorPolicy"
 *
 * console.log(CandorRecordReadReason.is["snapshot-unavailable"]("snapshot-unavailable")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CandorRecordReadReason = CandorRecordReadReasonBase.pipe(
  $I.annoteSchema("CandorRecordReadReason", {
    description: "Machine-readable reason the protected candor-record snapshot could not be read.",
  }),
  SchemaUtils.withLiteralKitStatics(CandorRecordReadReasonBase)
);

/**
 * Runtime type for {@link CandorRecordReadReason}.
 *
 * @see {@link CandorRecordReadReason} for the runtime schema and member meanings.
 * @category errors
 * @since 0.0.0
 */
export type CandorRecordReadReason = typeof CandorRecordReadReason.Type;

/**
 * The recorded events or dispositions for a filing could not be read.
 *
 * **When to use**
 *
 * Use when the record store cannot answer. This is deliberately a failure
 * rather than an empty result: a gate that cannot read its own record has not
 * proven anything, and reporting "not blocked" from an unreadable store would
 * be the exact fail-open behaviour the gate exists to prevent.
 *
 * **Example** (Fail closed when the record cannot be read)
 *
 * ```ts
 * import { CandorRecordReadError } from "@beep/law-practice-use-cases/CandorPolicy"
 *
 * const error = CandorRecordReadError.fromReason(
 *   "snapshot-unavailable",
 *   "Candor record store did not answer."
 * )
 * console.log(error.reason) // "snapshot-unavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CandorRecordReadError extends S.TaggedError<CandorRecordReadError>($I`CandorRecordReadError`)(
  "CandorRecordReadError",
  {
    message: S.String,
    reason: CandorRecordReadReason,
  },
  $I.annoteError<CandorRecordReadError>("CandorRecordReadError", {
    description: "Failure raised when recorded candor events or dispositions cannot be read for a filing.",
  })
) {
  /**
   * Construct a read failure from its machine-readable reason.
   *
   * @param reason - Machine-readable read-failure reason.
   * @param message - Operator-facing detail.
   * @returns A candor record read failure.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromReason = (reason: CandorRecordReadReason, message: string): CandorRecordReadError =>
    CandorRecordReadError.make({ message, reason });
}
