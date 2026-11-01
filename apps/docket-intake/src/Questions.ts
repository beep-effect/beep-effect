/**
 * Needs-review questions for the review hub: each needs-review message in the
 * ledger, raised as a question for the attorney and stored where the hub
 * reads it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocketIntakeId } from "@beep/identity/packages";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import {
  DocketIntakeOutcome,
  DocketQuestionInput,
  DocketQuestions,
  DocketQuestionsLive,
} from "@beep/law-practice-use-cases/DocketIntake";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type { DocketIntakeState, DocketLedgerRecord } from "@beep/law-practice-use-cases/DocketIntake";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";

const $I = $DocketIntakeId.create("Questions");

/**
 * Publishes the questions of the needs-review messages in the ledger.
 *
 * **Details**
 *
 * Present only when the review hub is configured; the poll cycle skips the
 * step when no publisher is provided. `publish` never fails: a question that
 * could not be raised or stored is logged and published again next cycle.
 *
 * **Example** (Reference the publisher service)
 *
 * ```ts
 * import { DocketQuestionPublisher } from "../../src/Questions.ts"
 *
 * console.log(DocketQuestionPublisher.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocketQuestionPublisher extends Context.Service<
  DocketQuestionPublisher,
  { readonly publish: (state: DocketIntakeState) => Effect.Effect<void> }
>()($I`DocketQuestionPublisher`) {}

/**
 * The question input of one ledger record.
 *
 * **Details**
 *
 * A needs-review record carries what it recorded about the email (subject,
 * sender, day received and Outlook link), its thread, the matter, the docket,
 * the candidate dates and the item's title, which a chosen date writes to the
 * calendar; the link to its needs-review calendar entry comes from the entry
 * itself. A record written before those keys existed carries none of them,
 * and its question says less. Every other outcome is passed on alone: it
 * raises no question.
 *
 * **Example** (Map a record that raises no question)
 *
 * ```ts
 * import { DocketLedgerRecord, NotDocketItem } from "@beep/law-practice-use-cases/DocketIntake"
 * import { LocalDate } from "@beep/schema/LocalDate"
 * import { questionInput } from "../../src/Questions.ts"
 *
 * const record = DocketLedgerRecord.make({
 *   attempts: 1,
 *   outcome: NotDocketItem.make({ messageId: "message-1" }),
 *   processedOn: LocalDate.make({ year: 2030, month: 1, day: 9 }),
 *   receivedAt: "2030-01-09T09:00:00.000Z"
 * })
 * console.log(questionInput(record).outcome._tag) // "NotDocketItem"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const questionInput = ({ outcome }: DocketLedgerRecord): DocketQuestionInput =>
  O.match(O.liftPredicate(outcome, DocketIntakeOutcome.guards.DocketNeedsReview), {
    onNone: () => DocketQuestionInput.make({ outcome }),
    onSome: (needsReview) =>
      DocketQuestionInput.make({
        outcome,
        candidateDates: needsReview.candidateDates,
        conversationId: needsReview.conversationId,
        docket: needsReview.docket,
        entryLink: O.filter(needsReview.entry.webLink, Str.isNonEmpty),
        matter: needsReview.matter,
        messageLink: needsReview.messageLink,
        receivedDate: needsReview.receivedDate,
        sender: needsReview.sender,
        subject: needsReview.subject,
        title: needsReview.title,
      }),
  });

/**
 * The publisher over the review hub's item store in `directory`.
 *
 * **Details**
 *
 * Every cycle raises a question for every needs-review record in the ledger,
 * from {@link questionInput}, and upserts them all. The store writes only
 * questions that changed, and a question's id is stable per message and
 * reason, so repeating a cycle adds nothing. A record pruned from the ledger
 * leaves its last stored question as it was; `backfill-questions` names the
 * email of such questions stored before they carried it.
 *
 * **Example** (Make the publisher layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { makeDocketQuestionPublisherLayer } from "../../src/Questions.ts"
 *
 * console.log(Layer.isLayer(makeDocketQuestionPublisherLayer("/var/lib/practice-review-hub"))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketQuestionPublisherLayer = (
  directory: string
): Layer.Layer<
  DocketQuestionPublisher,
  never,
  Digest.Digest | FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom
> =>
  Layer.effect(
    DocketQuestionPublisher,
    Effect.gen(function* () {
      const questions = yield* DocketQuestions;
      const store = yield* ReviewItemStore;
      return DocketQuestionPublisher.of({
        publish: Effect.fn("DocketIntakeApp.publishQuestions")(
          function* (state: DocketIntakeState) {
            const raised = yield* Effect.forEach(R.values(state.ledger), flow(questionInput, questions.raise));
            yield* store.upsert(A.getSomes(raised));
          },
          Effect.catchTags({
            DocketIntakeError: ({ stage }) => Effect.logError("docket intake questions were not raised", { stage }),
            ReviewItemStoreError: ({ operation, reason }) =>
              Effect.logError("docket intake questions were not stored", { operation, reason }),
          })
        ),
      });
    })
  ).pipe(
    Layer.provide(
      Layer.merge(DocketQuestionsLive, makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory: directory })))
    )
  );
