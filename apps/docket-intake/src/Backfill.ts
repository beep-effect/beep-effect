/**
 * The `backfill-questions` program: make every docket intake question the
 * review hub stored before questions said which email they are about name
 * its email, read back from the mailbox.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { ReviewItem } from "@beep/law-practice-domain";
import {
  DocketJournalKind,
  docketQuestionEmailOf,
  readDocketJournal,
  readDocketStateFile,
} from "@beep/law-practice-server/DocketIntake";
import {
  DocketIntakeError,
  DocketIntakeOutcome,
  DocketQuestionItemId,
  docketQuestionDigest,
  docketQuestionNamesEmail,
  withDocketQuestionEmail,
} from "@beep/law-practice-use-cases/DocketIntake";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import { M365, M365GetMessageRequest } from "@beep/m365";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type { DocketJournalEntry } from "@beep/law-practice-server/DocketIntake";
import type { DocketIntakeState, DocketQuestionEmail } from "@beep/law-practice-use-cases/DocketIntake";
import type { QuestionReviewItem } from "@beep/law-practice-use-cases/QuestionQueue";
import type { M365Error } from "@beep/m365";
import type { DocketIntakeAppConfig } from "./Config.ts";

const $I = $DocketIntakeId.create("Backfill");

// Only what names the email; the body is never downloaded.
const MESSAGE_FIELDS = "subject,from,receivedDateTime,webLink";
const NOT_FOUND = 404;

/**
 * Counts of one `backfill-questions` run. It carries no message content.
 *
 * **Details**
 *
 * `found` is every docket intake question in the hub that does not say
 * which email it is about. Each of them is counted once more, in exactly one
 * of `enriched`, `inLedger`, `unmatched` and `unreadable`.
 *
 * **Example** (Read the report fields)
 *
 * ```ts
 * import { DocketBackfillReport } from "../../src/Backfill.ts"
 *
 * console.log(Object.keys(DocketBackfillReport.fields))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketBackfillReport extends S.Opaque<DocketBackfillReport, { readonly brand: unique symbol }>()(
  S.Struct({
    applied: S.Boolean.annotateKey({
      description: "Whether the questions were written; false on a dry run, which writes nothing.",
    }),
    found: S.Natural.annotateKey({
      description: "Docket intake questions in the hub that do not say which email they are about.",
    }),
    enriched: S.Natural.annotateKey({
      description: "Of those, questions that name their email now, or would on a dry run.",
    }),
    inLedger: S.Natural.annotateKey({
      description:
        "Of those, questions whose message is still in the ledger: the service republishes them every cycle, so they wait for a later run.",
    }),
    unmatched: S.Natural.annotateKey({
      description: "Of those, questions no message id in the write journal digests to.",
    }),
    unreadable: S.Natural.annotateKey({
      description:
        "Of those, questions whose message the mailbox no longer returns, or returns without anything that names it.",
    }),
  }).pipe(
    $I.annoteSchema("DocketBackfillReport", {
      description: "Counts of one backfill of the emails docket intake questions are about.",
    })
  )
) {}

const decodeItemId = S.decodeUnknownOption(DocketQuestionItemId);

type Unnamed = { readonly digest: string; readonly question: QuestionReviewItem };

// A docket intake question that does not name its email yet, with the message digest its id carries.
const unnamedOf = (item: ReviewItem): O.Option<Unnamed> =>
  pipe(
    O.liftPredicate(item, ReviewItem.guards.question),
    O.filter((question) => !docketQuestionNamesEmail(question)),
    O.flatMap((question) => O.map(decodeItemId(question.itemId), ([, , , digest]) => ({ digest, question })))
  );

const isMarked = (line: DocketJournalEntry): boolean => DocketJournalKind.is["message-marked"](line.kind);

// Every message the service marked, so every message it wrote a needs-review entry for.
const markedMessageIds = (journal: ReadonlyArray<DocketJournalEntry>): ReadonlyArray<string> =>
  A.dedupe(A.getSomes(A.map(A.filter(journal, isMarked), (line) => line.messageId)));

// The needs-review messages still in the ledger: the service raises their questions every cycle.
const publishedMessageIds = (state: DocketIntakeState): ReadonlyArray<string> =>
  A.getSomes(
    A.map(R.values(state.ledger), ({ outcome }) =>
      O.map(
        O.liftPredicate(outcome, DocketIntakeOutcome.guards.DocketNeedsReview),
        (needsReview) => needsReview.messageId
      )
    )
  );

const digestPairs = (messageIds: ReadonlyArray<string>) =>
  Effect.forEach(messageIds, (messageId) =>
    Effect.map(docketQuestionDigest(messageId), (digest) => [digest, messageId] as const)
  );

/**
 * Name the email of every stored docket intake question that does not say
 * which email it is about.
 *
 * **Details**
 *
 * A question's item id carries the first 32 hex digits of its message id's
 * SHA-256, never the id itself, so the message id is found by digesting
 * every message the write journal marked. Questions whose message is still a
 * needs-review record in the ledger are left alone: the service raises them
 * again every cycle, from the record, and would put back whatever the
 * backfill wrote. Each other question is read from the mailbox with
 * `describe`, and its email facts and question text are added by
 * `withDocketQuestionEmail`, keeping its id, options and other facts. With
 * `apply` the changed questions are upserted in one write; without it
 * nothing is written. A question that names its email is never found again,
 * so a second run changes nothing. Logs carry the counts only.
 *
 * **Example** (Reference the backfill)
 *
 * ```ts
 * import { backfillQuestions } from "../../src/Backfill.ts"
 *
 * console.log(backfillQuestions)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const backfillQuestions = Effect.fn("DocketIntakeApp.backfillQuestions")(function* (input: {
  readonly apply: boolean;
  readonly describe: (messageId: string) => Effect.Effect<O.Option<DocketQuestionEmail>, DocketIntakeError>;
  readonly journal: ReadonlyArray<DocketJournalEntry>;
  readonly state: DocketIntakeState;
}) {
  const store = yield* ReviewItemStore;
  const list1 = yield* store.list;
  const found = A.getSomes(A.map(list1, unnamedOf));
  const digestPairs2 = yield* digestPairs(publishedMessageIds(input.state));
  const published = HashSet.fromIterable(A.map(digestPairs2, ([digest]) => digest));
  const digestPairs3 = yield* digestPairs(markedMessageIds(input.journal));
  const journaled = HashMap.fromIterable(digestPairs3);
  const pending = A.filter(found, ({ digest }) => !HashSet.has(published, digest));
  const matched = A.getSomes(
    A.map(pending, ({ digest, question }) =>
      O.map(HashMap.get(journaled, digest), (messageId) => ({ messageId, question }))
    )
  );
  const described = yield* Effect.forEach(matched, ({ messageId, question }) =>
    Effect.map(
      input.describe(messageId),
      O.map((email) => withDocketQuestionEmail(question, email))
    )
  );
  const enriched = A.filter(A.getSomes(described), docketQuestionNamesEmail);
  if (input.apply && A.isReadonlyArrayNonEmpty(enriched)) {
    yield* store.upsert(enriched);
  }
  const report = DocketBackfillReport.make({
    applied: input.apply,
    enriched: A.length(enriched),
    found: A.length(found),
    inLedger: A.length(found) - A.length(pending),
    unmatched: A.length(pending) - A.length(matched),
    unreadable: A.length(matched) - A.length(enriched),
  });
  yield* Effect.logInfo("docket intake questions backfilled", {
    applied: report.applied,
    enriched: report.enriched,
    found: report.found,
    inLedger: report.inLedger,
    unmatched: report.unmatched,
    unreadable: report.unreadable,
  });
  return report;
});

const isGone = (error: M365Error): boolean => error.reason === "response status" && O.contains(error.status, NOT_FOUND);

/**
 * Read what names one message from the mailbox: its subject, sender, day of
 * receipt in the practice time zone, and Outlook link.
 *
 * **Details**
 *
 * Graph is asked for those four fields only, never the body, and they are
 * read by `docketQuestionEmailOf`, as the mailbox port reads a message the
 * service processes. A message the mailbox no longer has (Graph answers 404,
 * as it does for a message moved to another folder) reads as none. Any other
 * Graph failure fails at stage `mailbox`, with cause `throttled` when Graph
 * throttled the read.
 *
 * **Example** (Reference the reader)
 *
 * ```ts
 * import { describeDocketMessage } from "../../src/Backfill.ts"
 *
 * console.log(describeDocketMessage)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const describeDocketMessage = (config: DocketIntakeAppConfig) =>
  Effect.fnUntraced(function* (messageId: string) {
    const m365 = yield* M365;
    return yield* m365
      .getMessage(
        M365GetMessageRequest.make({ messageId, select: O.some(MESSAGE_FIELDS), userId: O.some(config.mailbox) })
      )
      .pipe(
        Effect.map((message): O.Option<DocketQuestionEmail> => O.some(docketQuestionEmailOf(message, config.timeZone))),
        Effect.catchIf(isGone, () => Effect.succeedNone),
        Effect.mapError((error) => DocketIntakeError.make({ cause: error.reason, stage: "mailbox" }))
      );
  });

/**
 * The backfill over the configured state directory and mailbox: the write
 * journal and the ledger are read without taking the state lock, so it runs
 * while the service runs.
 *
 * **Example** (Reference the mailbox backfill)
 *
 * ```ts
 * import { backfillFromMailbox } from "../../src/Backfill.ts"
 *
 * console.log(backfillFromMailbox)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const backfillFromMailbox = Effect.fnUntraced(function* (config: DocketIntakeAppConfig, apply: boolean) {
  const m365 = yield* M365;
  return yield* backfillQuestions({
    apply,
    describe: flow(describeDocketMessage(config), Effect.provideService(M365, m365)),
    journal: yield* readDocketJournal(config.stateDirectory),
    state: yield* readDocketStateFile(config.stateDirectory),
  });
});
