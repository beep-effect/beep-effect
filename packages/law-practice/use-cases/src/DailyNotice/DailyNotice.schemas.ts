/**
 * Daily notice values: the message that tells the attorney questions are
 * waiting, and what the daily run did.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { LocalDateFromString } from "@beep/schema/LocalDate";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("DailyNotice/DailyNotice.schemas");

/**
 * **Details**
 *
 * It carries no question text and no client data: it only says how many
 * questions are waiting, so it is safe in any inbox preview. A mailbox adapter
 * may wrap the body in HTML with a link that opens the review queue, but adds
 * no question text.
 *
 * **Example** (Build a notice)
 *
 * ```ts
 * import { NoticeMessage } from "@beep/law-practice-use-cases/DailyNotice"
 *
 * const notice = NoticeMessage.make({ subject: "Claude: 2 questions waiting", body: "2 questions are waiting in Claude." })
 * console.log(notice.subject) // "Claude: 2 questions waiting"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoticeMessage extends S.Opaque<NoticeMessage, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: S.NonEmptyString.annotateKey({ description: "Subject line; the count only." }),
    body: S.NonEmptyString.annotateKey({ description: "Plain-text body; the count only, never question text." }),
  }).pipe(
    $I.annoteSchema("NoticeMessage", {
      description: "The notice email: a subject and plain body that give only the number of waiting questions.",
    })
  )
) {}

const DailyNoticeStatus = LiteralKit(["sent", "nothing-waiting", "already-sent"]).pipe(
  $I.annoteSchema("DailyNoticeStatus", {
    description: "What one daily notice run did: sent the notice, found nothing waiting, or found it already sent.",
  })
);

/**
 * **Details**
 *
 * - `sent`: the notice went out on `sentOn`;
 * - `nothing-waiting`: the digest was empty, so nothing was sent;
 * - `already-sent`: another run already claimed `sentOn`, today, for its notice.
 *
 * **Example** (Guard a skipped run)
 *
 * ```ts
 * import { DailyNoticeOutcome } from "@beep/law-practice-use-cases/DailyNotice"
 *
 * const outcome = DailyNoticeOutcome.cases["nothing-waiting"].make({})
 * console.log(DailyNoticeOutcome.guards["nothing-waiting"](outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DailyNoticeOutcome = DailyNoticeStatus.toTaggedUnion("status")({
  sent: {
    message: NoticeMessage.annotateKey({ description: "The notice that was sent." }),
    sentOn: LocalDateFromString.annotateKey({ description: "Day the notice was sent." }),
  },
  "nothing-waiting": {},
  "already-sent": {
    sentOn: LocalDateFromString.annotateKey({ description: "Day another run already claimed for its notice." }),
  },
}).pipe(
  $I.annoteSchema("DailyNoticeOutcome", {
    description: "What one daily notice run did, discriminated on its status.",
  }),
  S.toTaggedUnion("status")
);

/**
 * @see {@link DailyNoticeOutcome} for the statuses.
 * @category models
 * @since 0.0.0
 */
export type DailyNoticeOutcome = typeof DailyNoticeOutcome.Type;
