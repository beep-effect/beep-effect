/**
 * Docket question values: a docket intake outcome with the context needed to
 * turn a needs-review item into a question for the attorney.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CalendarDate, SourceRef } from "@beep/law-practice-domain";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { DocketCandidateDate, DocketIntakeOutcome, DocketNeedsReviewReason } from "./DocketIntake.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketQuestions.schemas");

const OptionalText = S.NonEmptyString.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

const OptionalDate = CalendarDate.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone));

/**
 * **Details**
 *
 * Every field is optional: a question shows the parts it has and leaves the
 * others out. The subject and the sender are never logged.
 *
 * **Example** (Name an email by its subject)
 *
 * ```ts
 * import { DocketQuestionEmail } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as O from "effect/Option"
 *
 * const email = DocketQuestionEmail.make({ subject: O.some("Office action response") })
 * console.log(O.isSome(email.subject)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketQuestionEmail extends S.Opaque<DocketQuestionEmail, { readonly brand: unique symbol }>()(
  S.Struct({
    messageLink: OptionalText.annotateKey({ description: "Link that opens the email in Outlook." }),
    receivedDate: OptionalDate.annotateKey({
      description: "Calendar day the email was received on, in the practice time zone.",
    }),
    sender: OptionalText.annotateKey({ description: "Sender address of the email (never logged)." }),
    subject: OptionalText.annotateKey({ description: "Subject line of the email (never logged)." }),
  }).pipe(
    $I.annoteSchema("DocketQuestionEmail", {
      description: "What tells the attorney which email a docket question is about.",
    })
  )
) {}

/**
 * **Details**
 *
 * Only a `DocketNeedsReview` outcome becomes a question; the context fields
 * are optional because the pipeline knows them only for some messages.
 * `subject`, `sender`, `receivedDate` and `messageLink` say which email it
 * is, `entryLink` opens its needs-review calendar entry, and `matter` is the
 * matter lookup's one-line answer. `candidateDates` become one calendar
 * option each, and `sourceRefs` are the filed documents the dates were read
 * from.
 *
 * **Example** (Read the input fields)
 *
 * ```ts
 * import { DocketQuestionInput } from "@beep/law-practice-use-cases/DocketIntake"
 *
 * console.log(Object.keys(DocketQuestionInput.fields).includes("outcome")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketQuestionInput extends S.Opaque<DocketQuestionInput, { readonly brand: unique symbol }>()(
  S.Struct({
    outcome: DocketIntakeOutcome.annotateKey({ description: "Outcome of processing one message." }),
    candidateDates: S.Array(DocketCandidateDate)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "Dates the deadline could be, from the message, the review, or the docket sheet." }),
    conversationId: OptionalText.annotateKey({ description: "Mail thread (Graph conversationId) of the message." }),
    docket: OptionalText.annotateKey({ description: "Docket number of the matched matter." }),
    entryLink: OptionalText.annotateKey({ description: "Link that opens the needs-review calendar entry in Outlook." }),
    matter: OptionalText.annotateKey({
      description: "One-line summary of what the matter lookup found (never logged).",
    }),
    ...DocketQuestionEmail.fields,
    sourceRefs: S.Array(SourceRef)
      .pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))
      .annotateKey({ description: "Filed documents the candidate dates were read from." }),
    title: OptionalText.annotateKey({ description: "Calendar title the docket entry would carry." }),
  }).pipe(
    $I.annoteSchema("DocketQuestionInput", {
      description: "A docket intake outcome, with what the pipeline knows about it, to raise as a question.",
    })
  )
) {}

/**
 * The part of a docket question's item id that identifies the message: the
 * first 32 hex digits of the SHA-256 of its provider id.
 *
 * **Example** (Check a message digest)
 *
 * ```ts
 * import { DocketMessageDigest } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DocketMessageDigest)("0123456789abcdef0123456789abcdef")) // true
 * console.log(S.is(DocketMessageDigest)("message-1")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketMessageDigest = S.String.check(S.isPattern(/^[0-9a-f]{32}$/)).pipe(
  $I.annoteSchema("DocketMessageDigest", {
    description: "First 32 hex digits of the SHA-256 of a message's provider id.",
  })
);

/**
 * **Details**
 *
 * The decoded value is the tuple `["docket-intake:", reason, ":", digest]`.
 * The id names the needs-review reason and the message digest, never the
 * message id itself.
 *
 * **Example** (Parse a docket question id)
 *
 * ```ts
 * import { DocketQuestionItemId } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const parts = S.decodeUnknownOption(DocketQuestionItemId)(
 *   "docket-intake:agents-disagree:0123456789abcdef0123456789abcdef"
 * )
 * console.log(O.map(parts, ([, reason]) => reason)) // Some("agents-disagree")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketQuestionItemId = S.TemplateLiteralParser([
  "docket-intake:",
  DocketNeedsReviewReason,
  ":",
  DocketMessageDigest,
]).pipe(
  $I.annoteSchema("DocketQuestionItemId", {
    description: "Item id of a docket intake question: `docket-intake:<reason>:<digest>`.",
  })
);
