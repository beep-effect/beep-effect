/**
 * Answer-row value objects: one append-only entry in the attorney's answer
 * log for a `question` review item.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { CalendarDate } from "../CalendarDate/index.ts";
import { QuestionOptionId } from "../Question/index.ts";
import { ReviewItemId } from "../ReviewItem/index.ts";

const $I = $LawPracticeDomainId.create("values/AnswerRow/AnswerRow.model");

/**
 * **Details**
 *
 * - `decided`: the attorney chose an option;
 * - `pending-on-client`: the answer waits on the client until `resurfaceOn`;
 * - `keep-reminding`: no answer yet, keep the question in the daily digest;
 * - `withdrawn`: the question no longer needs an answer.
 *
 * Only a `decided` answer whose option names a write can lead to a write.
 *
 * **Example** (Guard an answer state)
 *
 * ```ts
 * import { AnswerState } from "@beep/law-practice-domain"
 *
 * console.log(AnswerState.is["pending-on-client"]("pending-on-client")) // true
 * console.log(AnswerState.literals.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AnswerState = LiteralKit(["decided", "pending-on-client", "keep-reminding", "withdrawn"]).pipe(
  $I.annoteSchema("AnswerState", {
    description: "Where the attorney left a question: decided, pending on the client, keep reminding, or withdrawn.",
  })
);

/**
 * @see {@link AnswerState} for the literal domain.
 * @category models
 * @since 0.0.0
 */
export type AnswerState = typeof AnswerState.Type;

const AnswerRowFields = {
  itemId: ReviewItemId.annotateKey({
    description: "Question review item this row answers.",
  }),
  revision: PosInt.annotateKey({
    description: "One-based revision for this item; each later answer row counts one higher.",
  }),
  recordedAt: S.DateTimeUtcFromMillis.annotateKey({
    description: "When the answer was recorded, encoded as epoch milliseconds.",
  }),
  note: S.NonEmptyString.pipe(
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone),
    S.annotateKey({
      description: "Optional note the attorney typed with the answer; a note never writes.",
    })
  ),
};

const AnswerRowDefinition = AnswerState.toTaggedUnion("state")({
  decided: {
    ...AnswerRowFields,
    optionId: QuestionOptionId.annotateKey({
      description: "Option of the question the attorney chose.",
    }),
  },
  "pending-on-client": {
    ...AnswerRowFields,
    resurfaceOn: CalendarDate.annotateKey({
      description: "Day the question returns to the daily digest, encoded as YYYY-MM-DD.",
    }),
  },
  "keep-reminding": AnswerRowFields,
  withdrawn: AnswerRowFields,
});

/**
 * **Details**
 *
 * Rows are never edited or deleted, and none is ever locked. The current
 * answer is the item's row with the greatest `recordedAt`; only a tie on
 * `recordedAt` goes to the row appended last, the same recency rule as
 * `VerdictRow`. A row appended later with an earlier `recordedAt` does not
 * revise the answer. `decided` requires the chosen `optionId` and
 * `pending-on-client` requires `resurfaceOn`. That the `optionId` names an
 * option of the item is checked against the item, not by this schema.
 * Timestamps encode as epoch milliseconds.
 *
 * **Example** (Decode a pending-on-client answer)
 *
 * ```ts
 * import { AnswerRow } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const row = Effect.runSync(
 *   S.decodeUnknownEffect(AnswerRow)({
 *     state: "pending-on-client",
 *     itemId: "question:1",
 *     revision: 1,
 *     recordedAt: 1_760_400_000_000,
 *     resurfaceOn: "2026-11-02",
 *     note: "Waiting on the client's instructions.",
 *   })
 * )
 *
 * console.log(AnswerRow.guards["pending-on-client"](row)) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const AnswerRow = AnswerRowDefinition.pipe(
  $I.annoteSchema("AnswerRow", {
    description: "One append-only entry in the attorney's answer log for a question, discriminated on its state.",
  }),
  S.toTaggedUnion("state")
);

/**
 * @see {@link AnswerRow} for the tagged-union schema and its states.
 * @category value-objects
 * @since 0.0.0
 */
export type AnswerRow = typeof AnswerRow.Type;

/**
 * **Example** (Type an encoded answer state)
 *
 * ```ts
 * import type { AnswerRow } from "@beep/law-practice-domain"
 *
 * const state: AnswerRow.Encoded["state"] = "keep-reminding"
 * console.log(state) // "keep-reminding"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export declare namespace AnswerRow {
  /**
   * Wire-encoded representation of a decoded {@link AnswerRow}.
   *
   * **Example** (Alias the encoded type)
   *
   * ```ts
   * import type { AnswerRow } from "@beep/law-practice-domain"
   *
   * type Wire = AnswerRow.Encoded
   * ```
   *
   * @category value-objects
   * @since 0.0.0
   */
  export type Encoded = typeof AnswerRow.Encoded;
}
