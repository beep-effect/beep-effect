/**
 * Question write values: calendar writes proposed from decided answers, the
 * operator's approval, and the applied writes the journal keeps for undo.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { OptionWrite, QuestionOptionId, ReviewItemId } from "@beep/law-practice-domain";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("QuestionWrites/QuestionWrites.schemas");

/**
 * **Example** (Decode a proposed calendar write)
 *
 * ```ts
 * import { ProposedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const proposal = Effect.runSync(
 *   S.decodeUnknownEffect(ProposedWrite)({
 *     itemId: "question:1",
 *     optionId: "move-date",
 *     write: { kind: "calendar-date", title: "Response due", dueOn: "2026-11-02" },
 *     answeredAt: 1_760_400_000_000,
 *   })
 * )
 *
 * console.log(proposal.write.dueOn.toISOString()) // "2026-11-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProposedWrite extends S.Opaque<ProposedWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    itemId: ReviewItemId.annotateKey({
      description: "Question whose decided answer implies the write.",
    }),
    optionId: QuestionOptionId.annotateKey({
      description: "Option the attorney decided on; it names the write.",
    }),
    write: OptionWrite.annotateKey({
      description: "The write the option implies.",
    }),
    answeredAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "recordedAt of the deciding answer row, encoded as epoch milliseconds.",
    }),
  }).pipe(
    $I.annoteSchema("ProposedWrite", {
      description: "One write a decided answer implies, waiting for the operator's approval.",
    })
  )
) {}

/**
 * **Example** (Type an encoded answer time)
 *
 * ```ts
 * import type { ProposedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const answeredAt: ProposedWrite.Encoded["answeredAt"] = 1_760_400_000_000
 * console.log(answeredAt) // 1760400000000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ProposedWrite {
  /**
   * Wire-encoded representation of a decoded {@link ProposedWrite}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { ProposedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = ProposedWrite.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ProposedWrite.Encoded;
}

/**
 * **Example** (Reject an empty batch)
 *
 * ```ts
 * import { ProposedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownExit(ProposedWriteBatch)({ batchId: "writes-1", proposals: [] })._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProposedWriteBatch extends S.Opaque<ProposedWriteBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    batchId: S.NonEmptyString.annotateKey({
      description: "Identifier of the batch the operator approves; the journal keys applied writes on it.",
    }),
    proposals: S.NonEmptyArray(ProposedWrite).annotateKey({
      description: "The proposed writes, in the order they apply.",
    }),
  }).pipe(
    $I.annoteSchema("ProposedWriteBatch", {
      description: "The proposed writes the operator approves or declines as one batch.",
    })
  )
) {}

/**
 * **Example** (Type an encoded batch id)
 *
 * ```ts
 * import type { ProposedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const batchId: ProposedWriteBatch.Encoded["batchId"] = "writes-1"
 * console.log(batchId) // "writes-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ProposedWriteBatch {
  /**
   * Wire-encoded representation of a decoded {@link ProposedWriteBatch}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { ProposedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = ProposedWriteBatch.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ProposedWriteBatch.Encoded;
}

/**
 * The operator's approval of one proposed batch; nothing applies without one.
 *
 * **Example** (Build a system approval)
 *
 * ```ts
 * import { OperatorApproval } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as DateTime from "effect/DateTime"
 *
 * const approval = OperatorApproval.make({
 *   approvedBy: { kind: "System", component: "Runtime" },
 *   approvedAt: DateTime.makeUnsafe(1_760_400_000_000),
 * })
 *
 * console.log(approval.approvedBy.kind) // "System"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OperatorApproval extends S.Opaque<OperatorApproval, { readonly brand: unique symbol }>()(
  S.Struct({
    approvedBy: Principal.annotateKey({
      description: "Principal who approved the batch.",
    }),
    approvedAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "When the batch was approved, encoded as epoch milliseconds.",
    }),
  }).pipe(
    $I.annoteSchema("OperatorApproval", {
      description: "The operator's approval of one proposed write batch.",
    })
  )
) {}

/**
 * **Example** (Type an encoded approval time)
 *
 * ```ts
 * import type { OperatorApproval } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const approvedAt: OperatorApproval.Encoded["approvedAt"] = 1_760_400_000_000
 * console.log(approvedAt) // 1760400000000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace OperatorApproval {
  /**
   * Wire-encoded representation of a decoded {@link OperatorApproval}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { OperatorApproval } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = OperatorApproval.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof OperatorApproval.Encoded;
}

/**
 * **Example** (Decode a prior event state)
 *
 * ```ts
 * import { CalendarPrior } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const prior = Effect.runSync(
 *   S.decodeUnknownEffect(CalendarPrior)({ date: "2026-10-02", title: "Response due", category: "Docket - unverified" })
 * )
 *
 * console.log(prior.date.toISOString()) // "2026-10-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CalendarPrior extends S.Opaque<CalendarPrior, { readonly brand: unique symbol }>()(
  S.Struct({
    date: LocalDateFromString.annotateKey({
      description: "The event's day before the write, encoded as YYYY-MM-DD.",
    }),
    title: S.NonEmptyString.annotateKey({
      description: "The event's title before the write.",
    }),
    category: DocketCategory.annotateKey({
      description: "The event's docket category before the write.",
    }),
  }).pipe(
    $I.annoteSchema("CalendarPrior", {
      description: "A calendar event as it was before a question write updated it, enough to restore it.",
    })
  )
) {}

/**
 * **Example** (Type an encoded prior date)
 *
 * ```ts
 * import type { CalendarPrior } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const date: CalendarPrior.Encoded["date"] = "2026-10-02"
 * console.log(date) // "2026-10-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CalendarPrior {
  /**
   * Wire-encoded representation of a decoded {@link CalendarPrior}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { CalendarPrior } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = CalendarPrior.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CalendarPrior.Encoded;
}

/**
 * One proposed write as applied: the calendar event it touched and, for an
 * update, the event's state before it.
 *
 * **Details**
 *
 * `prior` is absent when the write created the event; undo then deletes it.
 * With `prior`, undo puts the event's date, title and category back.
 *
 * **Example** (Decode a write that created its event)
 *
 * ```ts
 * import { AppliedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const applied = Effect.runSync(
 *   S.decodeUnknownEffect(AppliedWrite)({
 *     proposal: {
 *       itemId: "question:1",
 *       optionId: "move-date",
 *       write: { kind: "calendar-date", title: "Response due", dueOn: "2026-11-02" },
 *       answeredAt: 1_760_400_000_000,
 *     },
 *     eventId: "evt-0001",
 *   })
 * )
 *
 * console.log(O.isNone(applied.prior)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedWrite extends S.Opaque<AppliedWrite, { readonly brand: unique symbol }>()(
  S.Struct({
    proposal: ProposedWrite.annotateKey({
      description: "The proposed write that was applied.",
    }),
    eventId: S.NonEmptyString.annotateKey({
      description: "Calendar event the write created or updated.",
    }),
    prior: CalendarPrior.pipe(
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone),
      S.annotateKey({
        description: "The event before the write; absent when the write created the event.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AppliedWrite", {
      description: "One proposed write as applied, with the event it touched and its prior state for undo.",
    })
  )
) {}

/**
 * **Example** (Type an encoded event id)
 *
 * ```ts
 * import type { AppliedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const eventId: AppliedWrite.Encoded["eventId"] = "evt-0001"
 * console.log(eventId) // "evt-0001"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AppliedWrite {
  /**
   * Wire-encoded representation of a decoded {@link AppliedWrite}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { AppliedWrite } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = AppliedWrite.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AppliedWrite.Encoded;
}

/**
 * **Example** (Read an applied batch's fields)
 *
 * ```ts
 * import { AppliedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * console.log(Object.keys(AppliedWriteBatch.fields)) // ["batchId", "approval", "applied"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppliedWriteBatch extends S.Opaque<AppliedWriteBatch, { readonly brand: unique symbol }>()(
  S.Struct({
    batchId: S.NonEmptyString.annotateKey({
      description: "Identifier of the approved batch.",
    }),
    approval: OperatorApproval.annotateKey({
      description: "The operator's approval the batch was applied under.",
    }),
    applied: S.NonEmptyArray(AppliedWrite).annotateKey({
      description: "The applied writes, in the order they were applied; undo walks them in reverse.",
    }),
  }).pipe(
    $I.annoteSchema("AppliedWriteBatch", {
      description: "An approved write batch as applied, the journal entry its undo reads.",
    })
  )
) {}

/**
 * **Example** (Type an encoded batch id)
 *
 * ```ts
 * import type { AppliedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
 *
 * const batchId: AppliedWriteBatch.Encoded["batchId"] = "writes-1"
 * console.log(batchId) // "writes-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AppliedWriteBatch {
  /**
   * Wire-encoded representation of a decoded {@link AppliedWriteBatch}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { AppliedWriteBatch } from "@beep/law-practice-use-cases/QuestionWrites"
   *
   * type Wire = AppliedWriteBatch.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AppliedWriteBatch.Encoded;
}
