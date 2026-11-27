/**
 * Question queue values: an answer as the attorney submits it, and the
 * selection the daily digest is drawn from.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { AnswerRow, AnswerState, ReviewItem } from "@beep/law-practice-domain";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

const $I = $LawPracticeUseCasesId.create("QuestionQueue/QuestionQueue.schemas");

/**
 * The `question` member of `ReviewItem`, the only kind the question queue answers.
 *
 * @category models
 * @since 0.0.0
 */
export type QuestionReviewItem = (typeof ReviewItem.cases)["question"]["Type"];

const submittedFields = <Fields extends Readonly<Record<"state" | "revision" | "recordedAt", unknown>>>(
  fields: Fields
) => Struct.omit(fields, ["state", "revision", "recordedAt"]);

/**
 * The attorney's answer to one question, as submitted to the queue, discriminated on `state`.
 *
 * **Details**
 *
 * The same cases and fields as `AnswerRow` without `revision` and
 * `recordedAt`, which the queue assigns: `decided` carries the chosen
 * `optionId` and `pending-on-client` carries `resurfaceOn`. `note` decodes
 * from an optional key and defaults to `Option.none()` on construction.
 *
 * **Example** (Decode a decided answer)
 *
 * ```ts
 * import { RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const answer = Effect.runSync(
 *   S.decodeUnknownEffect(RecordAnswerInput)({ state: "decided", itemId: "question:1", optionId: "keep-date" })
 * )
 *
 * console.log(RecordAnswerInput.guards.decided(answer)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RecordAnswerInput = AnswerState.toTaggedUnion("state")({
  decided: submittedFields(AnswerRow.cases.decided.fields),
  "pending-on-client": submittedFields(AnswerRow.cases["pending-on-client"].fields),
  "keep-reminding": submittedFields(AnswerRow.cases["keep-reminding"].fields),
  withdrawn: submittedFields(AnswerRow.cases.withdrawn.fields),
}).pipe(
  $I.annoteSchema("RecordAnswerInput", {
    description: "The attorney's answer to one question, before the queue assigns its revision and timestamp.",
  }),
  S.toTaggedUnion("state")
);

/**
 * @see {@link RecordAnswerInput} for the tagged-union schema.
 * @category models
 * @since 0.0.0
 */
export type RecordAnswerInput = typeof RecordAnswerInput.Type;

/**
 * **Example** (Type an encoded answer state)
 *
 * ```ts
 * import type { RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * const state: RecordAnswerInput.Encoded["state"] = "keep-reminding"
 * console.log(state) // "keep-reminding"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RecordAnswerInput {
  /**
   * Wire-encoded representation of a decoded {@link RecordAnswerInput}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue"
   *
   * type Wire = RecordAnswerInput.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RecordAnswerInput.Encoded;
}

/**
 * **Example** (Build an empty selection)
 *
 * ```ts
 * import { DigestSelection } from "@beep/law-practice-use-cases/QuestionQueue"
 * import { LocalDate } from "@beep/schema/LocalDate"
 *
 * const selection = DigestSelection.make({ today: LocalDate.make({ year: 2026, month: 11, day: 2 }), items: [] })
 *
 * console.log(selection.today.toISOString()) // "2026-11-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DigestSelection extends S.Opaque<DigestSelection, { readonly brand: unique symbol }>()(
  S.Struct({
    today: LocalDateFromString.annotateKey({
      description: "Day the digest is drawn for; a pending-on-client answer resurfaces on or after it.",
    }),
    items: S.Array(ReviewItem.cases.question).annotateKey({
      description: "Question items to select from, in the order the digest keeps.",
    }),
  }).pipe(
    $I.annoteSchema("DigestSelection", {
      description: "The question items the daily digest is drawn from, and the day it is drawn for.",
    })
  )
) {}

/**
 * **Example** (Type an encoded digest day)
 *
 * ```ts
 * import type { DigestSelection } from "@beep/law-practice-use-cases/QuestionQueue"
 *
 * const today: DigestSelection.Encoded["today"] = "2026-11-02"
 * console.log(today) // "2026-11-02"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DigestSelection {
  /**
   * Wire-encoded representation of a decoded {@link DigestSelection}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { DigestSelection } from "@beep/law-practice-use-cases/QuestionQueue"
   *
   * type Wire = DigestSelection.Encoded
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DigestSelection.Encoded;
}
