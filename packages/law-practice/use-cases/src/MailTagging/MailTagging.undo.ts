/**
 * The ledger-driven undo: removes exactly the categories one tagging run
 * added, where they are still present.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TaggingMode, TaggingUndoReport, TagUndoEntry } from "@beep/law-practice-domain/values/MailTagging";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import { activeTagEntriesOfRun } from "./MailTagging.ledger.ts";
import { Mailbox, MailTaggingUndoShape, TagLedger } from "./MailTagging.ports.ts";
import { SetCategoriesRequest } from "./MailTagging.values.ts";
import type { MailCategoryName, MailEnvelope, TagLedgerEntry } from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingPortError, MailTaggingStateError } from "./MailTagging.errors.ts";
import type { UndoMailTaggingRequest } from "./MailTagging.values.ts";

type UndoError = MailTaggingPortError | MailTaggingStateError;

type Restoration = {
  readonly entry: TagLedgerEntry;
  readonly envelope: O.Option<MailEnvelope>;
  readonly removed: ReadonlyArray<MailCategoryName>;
};

const stillPresent = (entry: TagLedgerEntry, envelope: MailEnvelope): ReadonlyArray<MailCategoryName> =>
  A.filter(entry.addedCategories, (category) => A.contains(envelope.categories, category));

const restorationOf = (entry: TagLedgerEntry, envelope: O.Option<MailEnvelope>): Restoration => ({
  entry,
  envelope,
  removed: O.match(envelope, { onNone: () => [], onSome: (found) => stillPresent(entry, found) }),
});

const remaining = (envelope: MailEnvelope, removed: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(envelope.categories, (category) => !A.contains(removed, category));

const emptyUndoReport = (request: UndoMailTaggingRequest, entries: number): TaggingUndoReport =>
  TaggingUndoReport.make({
    mode: request.mode,
    runId: request.runId,
    originalRunId: request.originalRunId,
    entries,
    messagesRestored: 0,
    messagesMissing: 0,
    categoriesRemoved: 0,
    wrote: TaggingMode.is.apply(request.mode) && entries > 0,
  });

const count = (condition: boolean): number => (condition ? 1 : 0);

const counted = (report: TaggingUndoReport, restoration: Restoration): TaggingUndoReport =>
  TaggingUndoReport.make({
    ...report,
    messagesRestored: report.messagesRestored + count(A.isReadonlyArrayNonEmpty(restoration.removed)),
    messagesMissing: report.messagesMissing + O.match(restoration.envelope, { onNone: () => 1, onSome: () => 0 }),
    categoriesRemoved: report.categoriesRemoved + restoration.removed.length,
  });

/**
 * Builds the undo of one tagging run over the mailbox and the tag ledger.
 *
 * **Details**
 *
 * For every active tag-ledger entry of the original run the undo reads the
 * message's current envelope and removes only that entry's `addedCategories`
 * that are still present. Every other category stays where it is: foreign
 * ones, ones another run added, and ones a person added after the run. The
 * write carries the envelope's `changeKey`.
 *
 * `apply` writes the reduced category list when something is removed and
 * always appends a `TagUndone` line, which retires the entry: a second undo of
 * the same run finds nothing. A message the mailbox no longer has is counted
 * as missing and retired with an empty removal. `dry-run` counts and writes
 * nothing.
 *
 * **Example** (Reference the undo constructor)
 *
 * ```ts
 * import { makeMailTaggingUndo } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeMailTaggingUndo)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeMailTaggingUndo: Effect.Effect<MailTaggingUndoShape, never, Mailbox | TagLedger> = Effect.gen(
  function* () {
    const mailbox = yield* Mailbox;
    const tagLedger = yield* TagLedger;

    const removeCategories = (restoration: Restoration): Effect.Effect<void, UndoError> =>
      O.match(
        O.filter(restoration.envelope, () => A.isReadonlyArrayNonEmpty(restoration.removed)),
        {
          onNone: () => Effect.void,
          onSome: (envelope) =>
            mailbox.setCategories(
              SetCategoriesRequest.make({
                messageId: envelope.messageId,
                categories: remaining(envelope, restoration.removed),
                changeKey: envelope.changeKey,
              })
            ),
        }
      );

    const restore = Effect.fn("MailTaggingUndo.restore")(function* (
      request: UndoMailTaggingRequest,
      restoration: Restoration
    ): Effect.fn.Return<void, UndoError> {
      yield* removeCategories(restoration);
      const recordedAt = yield* DateTime.now;
      yield* tagLedger.append(
        TagUndoEntry.make({
          runId: request.runId,
          originalRunId: request.originalRunId,
          messageId: restoration.entry.messageId,
          removedCategories: restoration.removed,
          recordedAt,
        })
      );
    });

    const undoEntry = (request: UndoMailTaggingRequest) =>
      Effect.fn("MailTaggingUndo.undoEntry")(function* (
        report: TaggingUndoReport,
        entry: TagLedgerEntry
      ): Effect.fn.Return<TaggingUndoReport, UndoError> {
        const restoration = restorationOf(entry, yield* mailbox.getEnvelope(entry.messageId));
        if (TaggingMode.is.apply(request.mode)) {
          yield* restore(request, restoration);
        }
        return counted(report, restoration);
      });

    return MailTaggingUndoShape.make({
      run: Effect.fn("MailTaggingUndo.run")(function* (request: UndoMailTaggingRequest) {
        const entries = activeTagEntriesOfRun(yield* tagLedger.records, request.originalRunId);
        return yield* Effect.reduce(entries, () => emptyUndoReport(request, entries.length), undoEntry(request));
      }),
    });
  }
);
