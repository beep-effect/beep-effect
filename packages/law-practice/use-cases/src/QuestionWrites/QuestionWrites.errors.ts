/**
 * Typed failures of question writes and their calendar port.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ReviewItemId } from "@beep/law-practice-domain";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DefectCause } from "../internal/DefectCause.ts";

const $I = $LawPracticeUseCasesId.create("QuestionWrites/QuestionWrites.errors");

const QuestionWriteReasonBase = LiteralKit([
  "calendar-unavailable",
  "event-not-found",
  "event-verified",
  "restore-failed",
]);

/**
 * **Details**
 *
 * - `calendar-unavailable`: the calendar could not be reached or answered
 *   with an error;
 * - `event-not-found`: the event a write updates or an undo restores no
 *   longer exists;
 * - `event-verified`: the attorney has verified the event a write would
 *   change (its docket category is no longer provisional), so the write is
 *   refused and the event left as it is;
 * - `restore-failed`: the calendar refused to put an event back, or a failed
 *   apply could not take back every write it had made.
 *
 * **Example** (Guard a write failure reason)
 *
 * ```ts
 * import { QuestionWriteReason } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * console.log(QuestionWriteReason.is["event-not-found"]("event-not-found")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const QuestionWriteReason = QuestionWriteReasonBase.pipe(
  $I.annoteSchema("QuestionWriteReason", {
    description:
      "Why a question write or its undo failed: calendar unavailable, event not found, event verified, or restore failed.",
  }),
  SchemaUtils.withLiteralKitStatics(QuestionWriteReasonBase)
);

/**
 * @see {@link QuestionWriteReason} for the reasons.
 * @category errors
 * @since 0.0.0
 */
export type QuestionWriteReason = typeof QuestionWriteReason.Type;

/**
 * **Details**
 *
 * `itemId` names the question whose write failed when the failure belongs to
 * one. When a failed apply could not take back every write it had made, the
 * reason is `restore-failed`, `cause` is the error that stopped the apply, and
 * `pendingItemIds` names the questions whose writes may still be on the
 * calendar; the message names them too. The cause is kept for diagnostics.
 *
 * **Example** (Report a missing event)
 *
 * ```ts
 * import { QuestionWriteError } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as O from "effect/Option"
 *
 * const error = QuestionWriteError.make({ reason: "event-not-found", itemId: O.some("question:1") })
 * console.log(error.reason) // "event-not-found"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QuestionWriteError extends S.TaggedError<QuestionWriteError, { readonly brand: unique symbol }>(
  $I`QuestionWriteError`
)(
  "QuestionWriteError",
  {
    cause: DefectCause.annotateKey({
      description: "Optional underlying calendar defect.",
    }),
    itemId: ReviewItemId.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "Question whose write failed, when the failure belongs to one.",
      })
    ),
    pendingItemIds: S.Array(ReviewItemId).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.annotateKey({
        description: "Questions whose writes may still be applied after a failed rollback; empty otherwise.",
      }),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    reason: QuestionWriteReason.annotateKey({
      description: "Closed failure category suitable for exhaustive handling.",
    }),
  },
  $I.annoteError<QuestionWriteError>("QuestionWriteError", {
    title: "Question write failed",
    description: "A question write, or the undo of one, failed at the calendar.",
  })
) {
  // fallow-ignore-next-line unused-class-member -- QuestionWriteError.message: Error.toString / Effect Cause.pretty reads this Error override.
  override get message(): string {
    return A.isReadonlyArrayEmpty(this.pendingItemIds)
      ? `The question write failed: ${this.reason}.`
      : `A failed apply could not take back every write; these questions may still be applied: ${A.join(this.pendingItemIds, ", ")}.`;
  }
}
