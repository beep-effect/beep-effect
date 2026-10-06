/**
 * Pure read models over the append-only tag and filing ledgers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FilingLedgerRecord, TagLedgerRecord } from "@beep/law-practice-domain/values/MailTagging";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import type {
  FilingIntent,
  FilingLedgerEntry,
  MailCategoryName,
  MailConversationId,
  MailMessageId,
  MatterKey,
  TaggingRunId,
  TagLedgerEntry,
} from "@beep/law-practice-domain/values/MailTagging";

// Run and message ids are whitespace-free tokens, so a space cannot collide.
const undoKey = (runId: TaggingRunId, messageId: MailMessageId): string => `${runId} ${messageId}`;

const undoneKeys = (records: ReadonlyArray<TagLedgerRecord>): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.map(A.filter(records, TagLedgerRecord.guards.TagUndone), (undo) => undoKey(undo.originalRunId, undo.messageId))
  );

const conversationMatter = (entry: TagLedgerEntry): O.Option<readonly [MailConversationId, MatterKey]> =>
  O.all([entry.conversationId, entry.decision.matterKey]);

/**
 * Lists the tag-ledger entries that are applied and not undone, in append
 * order.
 *
 * **Details**
 *
 * An undo line retires the entry of its `originalRunId` for the same message.
 * Run ids are unique per run, so a message tagged again by a later run stays
 * active under the later run.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { activeTagEntries } from "@beep/law-practice-use-cases/MailTagging"
 *
 * console.log(activeTagEntries([]).length) // 0
 * ```
 *
 * @param records - Every tag-ledger line in append order.
 * @returns The applied entries no undo line retires.
 * @category read-models
 * @since 0.0.0
 */
export const activeTagEntries = (records: ReadonlyArray<TagLedgerRecord>): ReadonlyArray<TagLedgerEntry> => {
  const undone = undoneKeys(records);
  return A.filter(
    A.filter(records, TagLedgerRecord.guards.TagApplied),
    (entry) => !HashSet.has(undone, undoKey(entry.runId, entry.messageId))
  );
};

const withLedgered = (
  ledgered: HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>>,
  entry: TagLedgerEntry
): HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>> =>
  HashMap.set(
    ledgered,
    entry.messageId,
    A.union(
      O.getOrElse(HashMap.get(ledgered, entry.messageId), (): ReadonlyArray<MailCategoryName> => []),
      entry.addedCategories
    )
  );

/**
 * Maps each message the tag ledger currently covers to the categories its
 * active entries say were added.
 *
 * **Details**
 *
 * The ledger line is written before the category write, so an entry alone
 * does not prove the message carries its categories. A caller compares this
 * list with the message's current categories: all present means tagged, some
 * missing means an interrupted write to complete.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { ledgeredCategoriesOf } from "@beep/law-practice-use-cases/MailTagging"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.size(ledgeredCategoriesOf([]))) // 0
 * ```
 *
 * @param records - Every tag-ledger line in append order.
 * @returns The ledgered categories of every message with an active entry.
 * @category read-models
 * @since 0.0.0
 */
export const ledgeredCategoriesOf = (
  records: ReadonlyArray<TagLedgerRecord>
): HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>> =>
  A.reduce(activeTagEntries(records), HashMap.empty<MailMessageId, ReadonlyArray<MailCategoryName>>(), withLedgered);

/**
 * Maps each tagged conversation to the matter its messages were matched to.
 *
 * **Details**
 *
 * Only active entries that carry both a conversation id and a matched matter
 * contribute. A later entry replaces an earlier one for the same conversation.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { conversationMattersOf } from "@beep/law-practice-use-cases/MailTagging"
 * import * as HashMap from "effect/HashMap"
 *
 * console.log(HashMap.size(conversationMattersOf([]))) // 0
 * ```
 *
 * @param records - Every tag-ledger line in append order.
 * @returns The conversation-to-matter carryover map.
 * @category read-models
 * @since 0.0.0
 */
export const conversationMattersOf = (
  records: ReadonlyArray<TagLedgerRecord>
): HashMap.HashMap<MailConversationId, MatterKey> =>
  HashMap.fromIterable(A.getSomes(A.map(activeTagEntries(records), conversationMatter)));

/**
 * Lists the active tag-ledger entries of one run, in append order.
 *
 * **Example** (Look for a run in an empty ledger)
 *
 * ```ts
 * import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging"
 * import { activeTagEntriesOfRun } from "@beep/law-practice-use-cases/MailTagging"
 *
 * console.log(activeTagEntriesOfRun([], TaggingRunId.make("run-0001")).length) // 0
 * ```
 *
 * @param records - Every tag-ledger line in append order.
 * @param runId - Run whose entries are wanted.
 * @returns The run's applied entries no undo line retires.
 * @category read-models
 * @since 0.0.0
 */
export const activeTagEntriesOfRun: {
  (records: ReadonlyArray<TagLedgerRecord>, runId: TaggingRunId): ReadonlyArray<TagLedgerEntry>;
  (runId: TaggingRunId): (records: ReadonlyArray<TagLedgerRecord>) => ReadonlyArray<TagLedgerEntry>;
} = dual(
  2,
  (records: ReadonlyArray<TagLedgerRecord>, runId: TaggingRunId): ReadonlyArray<TagLedgerEntry> =>
    A.filter(activeTagEntries(records), (entry) => entry.runId === runId)
);

/**
 * Collects the ids of the messages any undo line names.
 *
 * **Details**
 *
 * An undone message is settled: the tagging job never decides it again on
 * its own, whether or not a later run tagged it deliberately.
 *
 * **Example** (Read an empty ledger)
 *
 * ```ts
 * import { undoneMessageIds } from "@beep/law-practice-use-cases/MailTagging"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.size(undoneMessageIds([]))) // 0
 * ```
 *
 * @param records - Every tag-ledger line in append order.
 * @returns The message ids with at least one `TagUndone` line.
 * @category read-models
 * @since 0.0.0
 */
export const undoneMessageIds = (records: ReadonlyArray<TagLedgerRecord>): HashSet.HashSet<MailMessageId> =>
  HashSet.fromIterable(A.map(A.filter(records, TagLedgerRecord.guards.TagUndone), (undo) => undo.messageId));

/**
 * Lists the completion lines of the filing ledger, in append order.
 *
 * **Details**
 *
 * A completion is what makes content filed: the dedupe key
 * `(contentSha256, matterKey)` is looked up among these lines only, never
 * among intents.
 *
 * **Example** (Read an empty filing ledger)
 *
 * ```ts
 * import { completedFilings } from "@beep/law-practice-use-cases/MailTagging"
 *
 * console.log(completedFilings([]).length) // 0
 * ```
 *
 * @param records - Every filing-ledger line in append order.
 * @returns The `FilingCompleted` lines.
 * @category read-models
 * @since 0.0.0
 */
export const completedFilings = (records: ReadonlyArray<FilingLedgerRecord>): ReadonlyArray<FilingLedgerEntry> =>
  A.filter(records, FilingLedgerRecord.guards.FilingCompleted);

type FilingAttempt = Pick<FilingIntent, "contentSha256" | "matterKey" | "folderId" | "fileName">;

const isSameAttempt = (line: FilingAttempt, intent: FilingIntent): boolean =>
  A.every(
    [
      line.contentSha256 === intent.contentSha256,
      line.matterKey === intent.matterKey,
      line.folderId === intent.folderId,
      line.fileName === intent.fileName,
    ],
    Boolean
  );

const settledBy = (pending: ReadonlyArray<FilingIntent>, line: FilingAttempt): ReadonlyArray<FilingIntent> =>
  A.filter(pending, (intent) => !isSameAttempt(line, intent));

const withFilingRecord: (
  pending: ReadonlyArray<FilingIntent>,
  record: FilingLedgerRecord
) => ReadonlyArray<FilingIntent> = (pending, record) =>
  FilingLedgerRecord.match(record, {
    FilingIntended: (intent) => A.append(pending, intent),
    FilingCompleted: (entry) => settledBy(pending, entry),
    FilingAbandoned: (abandoned) => settledBy(pending, abandoned),
  });

/**
 * Lists the filing intents no later completion or abandonment line settles,
 * in append order.
 *
 * **Details**
 *
 * An intent is settled by a later completion or abandonment for the same
 * content, matter, folder, and file name. A pending intent means an upload
 * was started and its outcome was never recorded: either it never ran, or it
 * ran and the process stopped before the completion line. An upload that
 * found its name taken is abandoned, so it is never pending.
 *
 * **Example** (Read an empty filing ledger)
 *
 * ```ts
 * import { pendingFilingIntents } from "@beep/law-practice-use-cases/MailTagging"
 *
 * console.log(pendingFilingIntents([]).length) // 0
 * ```
 *
 * @param records - Every filing-ledger line in append order.
 * @returns The `FilingIntended` lines without a later matching completion or abandonment.
 * @category read-models
 * @since 0.0.0
 */
export const pendingFilingIntents = (records: ReadonlyArray<FilingLedgerRecord>): ReadonlyArray<FilingIntent> =>
  A.reduce(records, A.empty<FilingIntent>(), withFilingRecord);
