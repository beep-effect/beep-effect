/**
 * Docket intake as the first producer of attorney questions: a needs-review
 * item becomes a `question` review item with the facts the pipeline checked
 * and the answers the attorney can give.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { OptionWrite, QuestionFact, QuestionOption, ReviewItem } from "@beep/law-practice-domain";
import { equals, Order as LocalDateOrder } from "@beep/schema/LocalDate";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  DocketCandidateDateSource,
  DocketEntryFlag,
  DocketIntakeOutcome,
  DocketNeedsReviewReason,
} from "./DocketIntake.schemas.ts";
import { DocketQuestionEmail, DocketQuestionItemId } from "./DocketQuestions.schemas.ts";
import type { ReviewItemId } from "@beep/law-practice-domain";
import type { LocalDate } from "@beep/schema/LocalDate";
import type { QuestionReviewItem } from "../QuestionQueue/QuestionQueue.schemas.ts";
import type { DocketIntakeError } from "./DocketIntake.ports.ts";
import type { DocketCandidateDate, DocketNeedsReview } from "./DocketIntake.schemas.ts";
import type { DocketQuestionInput } from "./DocketQuestions.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketQuestions.service");

const MAX_OPTIONS = 5;
const ID_HEX_LENGTH = 32;
const DEFAULT_TITLE = "Docket deadline";
const textEncoder = new TextEncoder();

const decodeItemId = S.decodeUnknownOption(DocketQuestionItemId);

// The message part of a question's item id; see `docketQuestionDigest`.
const digestWith = (crypto: Digest.Digest["Service"], messageId: string): Effect.Effect<string> =>
  crypto
    .digest(Digest.sha256, textEncoder.encode(messageId))
    .pipe(Effect.map((digest) => Str.slice(0, ID_HEX_LENGTH)(Hex.encode(digest))));

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const longDate = (date: LocalDate): string =>
  O.getOrElse(
    O.map(A.get(MONTHS, date.month - 1), (month) => `${month} ${date.day}, ${date.year}`),
    () => date.toISOString()
  );

// Subjects and senders are shown on one line, whatever whitespace the mail carried.
const oneLine = (text: string): string => Str.trim(Str.replace(/\s+/gu, " ")(text));

// A text a question shows: on one line, and none when nothing is left of it.
const shown = (text: O.Option<string>): O.Option<string> => O.filter(O.map(text, oneLine), Str.isNonEmpty);

const quoted = (subject: string): string => `"${subject}"`;

// The question names the email by its subject when it is known, and says "a message" otherwise.
const questionText = (reason: DocketNeedsReview["reason"], subject: O.Option<string>): string => {
  const named = (plain: string, withEmail: (email: string) => string): string =>
    O.match(subject, { onNone: () => plain, onSome: (value) => withEmail(`the email ${quoted(value)}`) });
  return DocketNeedsReviewReason.match(reason, {
    "no-usable-date": () =>
      named(
        "Docket intake found no date it could use in a message. What is the deadline?",
        (email) => `Docket intake found no date it could use in ${email}. What is the deadline?`
      ),
    "due-date-past": () =>
      named(
        "The due date docket intake found for a message has already passed. What should the calendar show?",
        (email) => `The due date docket intake found for ${email} has already passed. What should the calendar show?`
      ),
    "agents-disagree": () =>
      named(
        "The two readers of a docket message found different deadlines. Which date is right?",
        (email) => `The two readers of ${email} found different deadlines. Which date is right?`
      ),
    "processing-failed": () =>
      named(
        "Docket intake could not finish reading a message. Is it a deadline, and when is it due?",
        (email) => `Docket intake could not finish reading ${email}. Is it a deadline, and when is it due?`
      ),
    "flagged-low-confidence": () =>
      named(
        "Docket intake is not confident about a message's deadline. Which date is right?",
        (email) => `Docket intake is not confident about the deadline in ${email}. Which date is right?`
      ),
    "flagged-max-rounds": () =>
      named(
        "The docket review ran out of rounds before its readers agreed on a deadline. Which date is right?",
        (email) =>
          `The docket review ran out of rounds before its readers agreed on a deadline for ${email}. Which date is right?`
      ),
    "deterministic-failure": () =>
      named(
        "The text docket intake quoted from a message does not match the message. Which date is right?",
        (email) => `The text docket intake quoted from ${email} does not match the email. Which date is right?`
      ),
  });
};

const notADeadline = QuestionOption.make({ optionId: "not-a-deadline", label: "Not a deadline" });
const handleMyself = (label: string) => QuestionOption.make({ optionId: "handle-myself", label });

// The answers that write nothing; every question offers at least one.
const nonWritingOptions = (reason: DocketNeedsReview["reason"]): ReadonlyArray<QuestionOption> =>
  DocketNeedsReviewReason.match(reason, {
    "no-usable-date": () => [handleMyself("I'll find the date and enter it"), notADeadline],
    "due-date-past": () => [
      handleMyself("I'll handle the missed date"),
      QuestionOption.make({ optionId: "already-handled", label: "Already handled" }),
    ],
    "agents-disagree": () => [handleMyself("Neither date; I'll enter it"), notADeadline],
    "processing-failed": () => [handleMyself("I'll read the message and enter it"), notADeadline],
    "flagged-low-confidence": () => [handleMyself("I'll check it and enter it"), notADeadline],
    "flagged-max-rounds": () => [handleMyself("I'll check it and enter it"), notADeadline],
    "deterministic-failure": () => [handleMyself("I'll check the message and enter it"), notADeadline],
  });

const flagFact = (flag: DocketEntryFlag): string =>
  DocketEntryFlag.match(flag, {
    "dates-differ": () => "The date the message states and the date computed from it differ.",
    "matter-ambiguous": () => "The message matches more than one matter.",
    "matter-suggested": () => "The matter was suggested, not matched exactly.",
    "matter-not-found": () => "No matter matches the message.",
    "matter-unverified": () => "The matter could not be verified.",
    "matter-lookup-failed": () => "The matter lookup failed.",
    "ladder-truncated": () => "Some reminders would fall before today and were not set.",
    "source-document-missing": () => "The source document was not attached to the message.",
    "due-date-past": () => "The due date is already past.",
    "junk-folder": () => "The message was found in Junk Email.",
    "deleted-folder": () => "The message was found in Deleted Items.",
    "tracked-date-differs": () => "The docket sheet tracks a different date for this matter.",
    "tracked-dates-unavailable": () => "The docket sheet could not be read.",
  });

const sourcePhrase = (source: DocketCandidateDate["source"]): string =>
  DocketCandidateDateSource.match(source, {
    stated: () => "the date the message states",
    computed: () => "computed from the mailing date",
    extractor: () => "the first reader's date",
    reviewer: () => "the second reader's date",
    tracked: () => "the date on the docket sheet",
  });

const candidateFact = ({ date, source }: DocketCandidateDate): string =>
  DocketCandidateDateSource.match(source, {
    stated: () => `The message states ${longDate(date)}.`,
    computed: () => `Computed from the mailing date: ${longDate(date)}.`,
    extractor: () => `The first reader found ${longDate(date)}.`,
    reviewer: () => `The second reader found ${longDate(date)}.`,
    tracked: () => `The docket sheet tracks ${longDate(date)}.`,
  });

const byDate = Order.mapInput(LocalDateOrder, ({ date }: DocketCandidateDate) => date);

// One option per distinct candidate date, earliest first, within the room the non-writing options leave.
const dateOptions = (
  input: DocketQuestionInput,
  needsReview: DocketNeedsReview,
  room: number
): ReadonlyArray<QuestionOption> =>
  pipe(
    A.dedupeWith(input.candidateDates, (self, that) => equals(self.date, that.date)),
    A.sort(byDate),
    A.take(room),
    A.map((candidate) =>
      QuestionOption.make({
        optionId: `use-${candidate.date.toISOString()}`,
        label: Str.capitalize(`use ${longDate(candidate.date)}, ${sourcePhrase(candidate.source)}`),
        write: O.some(
          OptionWrite.cases["calendar-date"].make({
            title: O.getOrElse(input.title, () => DEFAULT_TITLE),
            dueOn: candidate.date,
            eventId: O.some(needsReview.entry.eventId),
          })
        ),
      })
    )
  );

const plainFact = (text: string): QuestionFact => QuestionFact.make({ text, sourceRefs: [] });

const EMAIL_IS = "The email is ";
const EMAIL_WAS = "The email was ";
const OPEN_EMAIL = "Open the email in Outlook: ";
const NEEDS_REVIEW_ENTRY = "The message is on the calendar as a needs-review entry.";

// What a question shows of an email: its texts on one line, without the ones that are blank, so a
// subject of only spaces reads as no subject.
const shownEmail = (email: DocketQuestionEmail): DocketQuestionEmail =>
  DocketQuestionEmail.make({
    messageLink: shown(email.messageLink),
    receivedDate: email.receivedDate,
    sender: shown(email.sender),
    subject: shown(email.subject),
  });

// "The email is "<subject>" from <sender>, received <date>.", leaving out the parts that are missing.
// It takes an email `shownEmail` made.
const emailSentence = (email: DocketQuestionEmail): O.Option<string> => {
  const received = O.map(email.receivedDate, (date) => `received ${longDate(date)}`);
  const named = A.join(
    A.getSomes([O.map(email.subject, quoted), O.map(email.sender, (sender) => `from ${sender}`)]),
    " "
  );
  return Str.isNonEmpty(named)
    ? O.some(`${EMAIL_IS}${A.join([named, ...O.toArray(received)], ", ")}.`)
    : O.map(received, (when) => `${EMAIL_WAS}${when}.`);
};

// The facts that say which email a question is about and open it.
const emailFacts = (email: DocketQuestionEmail): ReadonlyArray<QuestionFact> =>
  A.map(A.getSomes([emailSentence(email), O.map(email.messageLink, (link) => `${OPEN_EMAIL}${link}`)]), plainFact);

const emailOf = (input: DocketQuestionInput): DocketQuestionEmail =>
  shownEmail(
    DocketQuestionEmail.make({
      messageLink: input.messageLink,
      receivedDate: input.receivedDate,
      sender: input.sender,
      subject: input.subject,
    })
  );

const questionFacts = (
  email: DocketQuestionEmail,
  input: DocketQuestionInput,
  needsReview: DocketNeedsReview
): ReadonlyArray<QuestionFact> => [
  ...emailFacts(email),
  plainFact(
    O.match(input.entryLink, {
      onNone: () => NEEDS_REVIEW_ENTRY,
      onSome: (link) => `Its needs-review calendar entry: ${link}`,
    })
  ),
  ...A.map(O.toArray(input.matter), (matter) => plainFact(`Matter: ${matter}`)),
  ...A.map(needsReview.flags, (flag) => plainFact(flagFact(flag))),
  ...A.map(A.sort(input.candidateDates, byDate), (candidate) =>
    QuestionFact.make({ text: candidateFact(candidate), sourceRefs: input.sourceRefs })
  ),
  ...O.toArray(
    O.map(needsReview.review, ({ maxRounds, rounds }) =>
      plainFact(`The automated review ran ${rounds} of ${maxRounds} rounds.`)
    )
  ),
];

const questionFor = (
  input: DocketQuestionInput,
  needsReview: DocketNeedsReview,
  itemId: ReviewItemId
): QuestionReviewItem => {
  const nonWriting = nonWritingOptions(needsReview.reason);
  const email = emailOf(input);
  return ReviewItem.cases.question.make({
    itemId,
    text: questionText(needsReview.reason, email.subject),
    label: O.some("Docket intake"),
    sourceRefs: input.sourceRefs,
    facts: questionFacts(email, input, needsReview),
    options: [...dateOptions(input, needsReview, MAX_OPTIONS - A.length(nonWriting)), ...nonWriting],
    docket: input.docket,
    conversationId: input.conversationId,
  });
};

/**
 * The question a docket intake outcome raises, if any.
 *
 * **Details**
 *
 * Records come first: only a `DocketNeedsReview` outcome becomes a question;
 * entered, non-docket and failed outcomes give none. The question asks the
 * reason's plain-language question, naming the email by its subject when the
 * input has one. Its facts are, in order: which email it is (subject, sender
 * and day received, each on one line, leaving out what is missing or blank),
 * the link that opens the email in Outlook, the link to its needs-review
 * calendar entry (or a plain mention of the entry without one), the matter,
 * each flag, each candidate date (with the input's source documents) and the
 * review rounds. Links live in the fact text because a source reference
 * names Box files only. Its options are one calendar write per distinct
 * candidate date, earliest first, each moving the needs-review entry to that
 * date under the input's title, followed by the reason's answers that write
 * nothing; there are two to five in all.
 *
 * **Example** (Raise no question for a non-docket message)
 *
 * ```ts
 * import { DocketQuestionInput, NotDocketItem, docketQuestion } from "@beep/law-practice-use-cases/DocketIntake"
 *
 * const input = DocketQuestionInput.make({ outcome: NotDocketItem.make({ messageId: "message-1" }) })
 * console.log(docketQuestion(input, "docket-intake:example")._tag) // "None"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const docketQuestion: {
  (itemId: ReviewItemId): (input: DocketQuestionInput) => O.Option<QuestionReviewItem>;
  (input: DocketQuestionInput, itemId: ReviewItemId): O.Option<QuestionReviewItem>;
} = dual(
  2,
  (input: DocketQuestionInput, itemId: ReviewItemId): O.Option<QuestionReviewItem> =>
    O.map(O.liftPredicate(input.outcome, DocketIntakeOutcome.guards.DocketNeedsReview), (needsReview) =>
      questionFor(input, needsReview, itemId)
    )
);

/**
 * Whether a docket question already says which email it is about.
 *
 * **Details**
 *
 * True when one of its facts is the sentence naming the email
 * (`The email is …` or `The email was …`) or the link that opens it in
 * Outlook. Every question raised from an outcome that carries the day of
 * receipt has one; older questions do not.
 *
 * **Example** (Check a question raised without the email)
 *
 * ```ts
 * import {
 *   DocketNeedsReview,
 *   DocketQuestionInput,
 *   DocketWrittenEntry,
 *   docketQuestion,
 *   docketQuestionNamesEmail
 * } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as O from "effect/Option"
 *
 * const outcome = DocketNeedsReview.make({
 *   entry: DocketWrittenEntry.make({ eventId: "event-1" }),
 *   flags: [],
 *   messageId: "message-1",
 *   reason: "no-usable-date"
 * })
 * const question = docketQuestion(DocketQuestionInput.make({ outcome }), "docket-intake:example")
 * console.log(O.map(question, docketQuestionNamesEmail)) // Some(false)
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const docketQuestionNamesEmail = (item: QuestionReviewItem): boolean =>
  A.some(
    item.facts,
    ({ text }) => Str.startsWith(EMAIL_IS)(text) || Str.startsWith(EMAIL_WAS)(text) || Str.startsWith(OPEN_EMAIL)(text)
  );

// A stored question with the facts naming its email first, asked again naming it by its subject.
const namedQuestion = (item: QuestionReviewItem, email: DocketQuestionEmail): QuestionReviewItem =>
  ReviewItem.cases.question.make({
    itemId: item.itemId,
    text: O.match(decodeItemId(item.itemId), {
      onNone: () => item.text,
      onSome: ([, reason]) => questionText(reason, email.subject),
    }),
    label: item.label,
    sourceRefs: item.sourceRefs,
    facts: [...emailFacts(email), ...item.facts],
    options: item.options,
    docket: item.docket,
    conversationId: item.conversationId,
  });

/**
 * A stored docket question rewritten to say which email it is about.
 *
 * **Details**
 *
 * The facts naming the email and its Outlook link are put before the
 * question's other facts, and the question text is asked again for the
 * reason in the item id, naming the email by its subject. The item id, the
 * options, the other facts, the source references, the docket and the
 * thread are kept, so an answer recorded against the question still
 * matches. A question that already names its email comes back unchanged,
 * and one whose id is not a docket question id keeps its text.
 *
 * **Example** (Name the email of a stored question)
 *
 * ```ts
 * import { QuestionOption, ReviewItem } from "@beep/law-practice-domain"
 * import { DocketQuestionEmail, withDocketQuestionEmail } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as O from "effect/Option"
 *
 * const stored = ReviewItem.cases.question.make({
 *   itemId: "docket-intake:no-usable-date:0123456789abcdef0123456789abcdef",
 *   text: "Docket intake found no date it could use in a message. What is the deadline?",
 *   sourceRefs: [],
 *   facts: [],
 *   options: [
 *     QuestionOption.make({ optionId: "handle-myself", label: "I'll find the date and enter it" }),
 *     QuestionOption.make({ optionId: "not-a-deadline", label: "Not a deadline" })
 *   ]
 * })
 * const named = withDocketQuestionEmail(stored, DocketQuestionEmail.make({ subject: O.some("Office action response") }))
 * console.log(named.text)
 * // Docket intake found no date it could use in the email "Office action response". What is the deadline?
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const withDocketQuestionEmail: {
  (email: DocketQuestionEmail): (item: QuestionReviewItem) => QuestionReviewItem;
  (item: QuestionReviewItem, email: DocketQuestionEmail): QuestionReviewItem;
} = dual(
  2,
  (item: QuestionReviewItem, email: DocketQuestionEmail): QuestionReviewItem =>
    docketQuestionNamesEmail(item) ? item : namedQuestion(item, shownEmail(email))
);

/**
 * The digest a docket question's item id carries for a message: the first 32
 * hex digits of the SHA-256 of its provider id.
 *
 * **Details**
 *
 * The same message always gives the same digest, so a message id from the
 * write journal can be matched to the question raised for it. Digesting
 * cannot fail.
 *
 * **Example** (Digest a message id)
 *
 * ```ts
 * import { docketQuestionDigest } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const program = docketQuestionDigest("message-1").pipe(Effect.provide(Digest.layerWebCrypto))
 * Effect.runPromise(program).then(console.log) // "9deb880b43bdf6f465a0afb130aed71b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const docketQuestionDigest = (messageId: string): Effect.Effect<string, never, Digest.Digest> =>
  Effect.flatMap(Digest.Digest, (crypto) => digestWith(crypto, messageId));

/**
 * Service shape of the docket question producer.
 *
 * **Example** (Name the producer method)
 *
 * ```ts
 * import type { DocketQuestionsShape } from "@beep/law-practice-use-cases/DocketIntake"
 *
 * const method: keyof DocketQuestionsShape = "raise"
 * console.log(method) // "raise"
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface DocketQuestionsShape {
  /**
   * The question a docket intake outcome raises, with a stable item id:
   * `docket-intake:<reason>:<digest>`, where the digest is the first 32 hex
   * digits of the message id's SHA-256. None unless the outcome needs review.
   */
  readonly raise: (input: DocketQuestionInput) => Effect.Effect<O.Option<QuestionReviewItem>, DocketIntakeError>;
}

/**
 * Service: docket intake's producer of attorney questions.
 *
 * **Example** (Reference the producer)
 *
 * ```ts
 * import { DocketQuestions } from "@beep/law-practice-use-cases/DocketIntake"
 *
 * console.log(DocketQuestions.key)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class DocketQuestions extends Context.Service<DocketQuestions, DocketQuestionsShape>()($I`DocketQuestions`) {}

/**
 * Layer providing the docket question producer over the `Digest` service.
 *
 * **Details**
 *
 * The item id digests the message id, so the same message and reason always
 * give the same question, and the id stays short and calendar-safe whatever
 * the provider's message id looks like.
 *
 * **Example** (Provide the producer)
 *
 * ```ts
 * import { DocketQuestionsLive } from "@beep/law-practice-use-cases/DocketIntake"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(DocketQuestionsLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocketQuestionsLive: Layer.Layer<DocketQuestions, never, Digest.Digest> = Layer.effect(
  DocketQuestions,
  Effect.map(Digest.Digest, (crypto) =>
    DocketQuestions.of({
      raise: Effect.fn("DocketQuestions.raise")(function* (input: DocketQuestionInput) {
        if (!DocketIntakeOutcome.guards.DocketNeedsReview(input.outcome)) {
          return O.none<QuestionReviewItem>();
        }
        const { messageId, reason } = input.outcome;
        const digest = yield* digestWith(crypto, messageId);
        return docketQuestion(input, `docket-intake:${reason}:${digest}`);
      }),
    })
  )
);
