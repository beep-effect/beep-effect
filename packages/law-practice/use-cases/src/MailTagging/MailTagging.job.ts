/**
 * The resumable mail-tagging job: pages the mailbox ascending, decides each
 * message, files matched attachments, records the tag ledger, and then writes
 * owned categories.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  BackfillCheckpoint,
  CategoryAddCount,
  combineTaggingRunReports,
  decisionCategories,
  defaultMailTaxonomy,
  emptyTaggingRunReport,
  MailTaxonomy,
  masterCategories,
  matterCategoryName,
  summarizeDecision,
  TaggingDecision,
  TaggingMode,
  TaggingRunReport,
  TagLedgerEntry,
} from "@beep/law-practice-domain/values/MailTagging";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { conversationMattersOf, ledgeredCategoriesOf, undoneMessageIds } from "./MailTagging.ledger.ts";
import {
  AttachmentFiler,
  BackfillCheckpointStore,
  Mailbox,
  MailTaggingJobShape,
  MatterDirectory,
  TagLedger,
} from "./MailTagging.ports.ts";
import { decideMatterTagging } from "./MailTagging.tagger.ts";
import {
  FileAttachmentsRequest,
  ListMessagesSinceRequest,
  MatterTaggerContext,
  SetCategoriesRequest,
} from "./MailTagging.values.ts";
import type {
  MailCategoryName,
  MailConversationId,
  MailEnvelope,
  MailMessageId,
  MatterIndex,
  MatterIndexEntry,
  MatterKey,
} from "@beep/law-practice-domain/values/MailTagging";
import type { MailTaggingPortError, MailTaggingStateError } from "./MailTagging.errors.ts";
import type { MailPage, MailPageCursor, RunMailTaggingRequest } from "./MailTagging.values.ts";

type JobError = MailTaggingPortError | MailTaggingStateError;

type JobScope = {
  readonly request: RunMailTaggingRequest;
  readonly index: MatterIndex;
  readonly taxonomy: MailTaxonomy;
  readonly resumeFrom: DateTime.Utc;
  readonly checkpointAt: O.Option<DateTime.Utc>;
  readonly coveredAtBoundary: HashSet.HashSet<MailMessageId>;
  readonly undone: HashSet.HashSet<MailMessageId>;
  readonly empty: TaggingRunReport;
};

type Boundary = {
  readonly at: DateTime.Utc;
  readonly ids: ReadonlyArray<MailMessageId>;
};

type JobState = {
  readonly report: TaggingRunReport;
  readonly ledgered: HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>>;
  readonly conversations: HashMap.HashMap<MailConversationId, MatterKey>;
  readonly ensured: HashSet.HashSet<MatterKey>;
  readonly boundary: O.Option<Boundary>;
  readonly processed: number;
};

type Verdict = {
  readonly envelope: MailEnvelope;
  readonly decision: TaggingDecision;
  readonly adds: ReadonlyArray<MailCategoryName>;
};

const practiceMasterCategories = masterCategories(defaultMailTaxonomy([]));

const matterMasterCategories = (matterKey: MatterKey) =>
  masterCategories(MailTaxonomy.make({ practiceCategories: [], matterKeys: [matterKey] }));

const matchedMatter = (decision: TaggingDecision): O.Option<MatterKey> =>
  O.map(O.liftPredicate(decision, TaggingDecision.guards.MatterMatched), (matched) => matched.matterKey);

const outcomeCounts = (empty: TaggingRunReport): ((decision: TaggingDecision) => Partial<TaggingRunReport>) =>
  TaggingDecision.match({
    MatterMatched: () => ({ matched: 1 }),
    MatterUnmatched: (decision) => ({ unmatched: { ...empty.unmatched, [decision.reason]: 1 } }),
  });

const verdictReport = (empty: TaggingRunReport, verdict: Verdict, wrote: boolean): TaggingRunReport =>
  TaggingRunReport.make({
    ...empty,
    ...outcomeCounts(empty)(verdict.decision),
    scanned: 1,
    categoryAdds: A.map(verdict.adds, (category) => CategoryAddCount.make({ category, count: 1 })),
    wrote,
  });

const counted = (scope: JobScope, state: JobState, counts: Partial<TaggingRunReport>): JobState => ({
  ...state,
  report: combineTaggingRunReports(state.report, TaggingRunReport.make({ ...scope.empty, scanned: 1, ...counts })),
});

const missingFrom = (
  envelope: MailEnvelope,
  categories: ReadonlyArray<MailCategoryName>
): ReadonlyArray<MailCategoryName> => A.filter(categories, (category) => !A.contains(envelope.categories, category));

// The starting checkpoint covers a message received before its instant, and one
// received exactly at it only when the checkpoint lists the message's id.
const isCovered = (scope: JobScope, envelope: MailEnvelope): boolean =>
  O.exists(
    scope.checkpointAt,
    (checkpointAt) =>
      DateTime.isLessThan(envelope.receivedAt, checkpointAt) ||
      (DateTime.Equivalence(envelope.receivedAt, checkpointAt) &&
        HashSet.has(scope.coveredAtBoundary, envelope.messageId))
  );

const tiedIds = (page: MailPage, last: MailEnvelope): ReadonlyArray<MailMessageId> =>
  A.map(
    A.filter(page.envelopes, (envelope) => DateTime.Equivalence(envelope.receivedAt, last.receivedAt)),
    (envelope) => envelope.messageId
  );

// Ids at the page's last instant; an earlier save at that same instant keeps its ids.
const boundaryAfter = (previous: O.Option<Boundary>, page: MailPage, last: MailEnvelope): Boundary => ({
  at: last.receivedAt,
  ids: A.union(
    O.match(
      O.filter(previous, (boundary) => DateTime.Equivalence(boundary.at, last.receivedAt)),
      { onNone: (): ReadonlyArray<MailMessageId> => [], onSome: (boundary) => boundary.ids }
    ),
    tiedIds(page, last)
  ),
});

const pendingRepair = (
  scope: JobScope,
  envelope: MailEnvelope,
  ledgered: ReadonlyArray<MailCategoryName>
): ReadonlyArray<MailCategoryName> => (isCovered(scope, envelope) ? [] : missingFrom(envelope, ledgered));

const withConversation = (
  conversations: HashMap.HashMap<MailConversationId, MatterKey>,
  verdict: Verdict
): HashMap.HashMap<MailConversationId, MatterKey> =>
  O.match(O.all([verdict.envelope.conversationId, matchedMatter(verdict.decision)]), {
    onNone: () => conversations,
    onSome: ([conversationId, matterKey]) => HashMap.set(conversations, conversationId, matterKey),
  });

const withLedgered = (
  ledgered: HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>>,
  verdict: Verdict,
  wrote: boolean
): HashMap.HashMap<MailMessageId, ReadonlyArray<MailCategoryName>> =>
  wrote ? HashMap.set(ledgered, verdict.envelope.messageId, verdict.adds) : ledgered;

const verdictOf = (scope: JobScope, state: JobState, envelope: MailEnvelope): Verdict => {
  const decision = decideMatterTagging(
    MatterTaggerContext.make(
      {
        index: scope.index,
        taxonomy: scope.taxonomy,
        policy: scope.request.policy,
        conversationMatters: state.conversations,
      },
      { disableChecks: true }
    ),
    envelope
  );
  return { envelope, decision, adds: missingFrom(envelope, decisionCategories(decision)) };
};

const matterToFile = (scope: JobScope, verdict: Verdict): O.Option<MatterIndexEntry> =>
  O.flatMap(
    O.filter(matchedMatter(verdict.decision), () => verdict.envelope.hasAttachments),
    (matterKey) => A.findFirst(scope.index.entries, (entry) => entry.matterKey === matterKey)
  );

const isContactOf = (entry: MatterIndexEntry, envelope: MailEnvelope): boolean =>
  A.some(O.toArray(envelope.senderAddress), (address) => A.contains(entry.contactAddresses, address));

// A sender listed under more than one matter says nothing about which matter a file belongs to.
const isExclusiveContact = (index: MatterIndex, matter: MatterIndexEntry, envelope: MailEnvelope): boolean =>
  isContactOf(matter, envelope) &&
  !A.some(index.entries, (entry) => entry.matterKey !== matter.matterKey && isContactOf(entry, envelope));

const unensuredMatter = (ensured: HashSet.HashSet<MatterKey>, verdict: Verdict): O.Option<MatterKey> =>
  O.filter(
    matchedMatter(verdict.decision),
    (matterKey) => !HashSet.has(ensured, matterKey) && A.contains(verdict.adds, matterCategoryName(matterKey))
  );

const hasPagesLeft = (pagesLeft: O.Option<number>): boolean =>
  O.match(pagesLeft, { onNone: () => true, onSome: (count) => count > 0 });

/**
 * Builds the mail-tagging job over the mailbox, the matter directory, the tag
 * ledger, the checkpoint store, and the attachment filer.
 *
 * **Details**
 *
 * The run reads one matter-index snapshot and derives the default taxonomy
 * from its matter keys. In `apply` it ensures the practice master categories
 * once at the start; a matter's master category is ensured the first time the
 * run is about to add it to a message, once per matter. The run resumes from
 * the checkpoint's `lastReceivedAt` when one exists, otherwise from the
 * request's `since`, and pages ascending until the mailbox has no next page or
 * `maxPages` is reached.
 *
 * A message with an active tag-ledger entry is not decided again. When every
 * ledgered category is on the message it counts as `alreadyTagged`. When some
 * are missing and the starting checkpoint does not cover the message, a
 * category write was interrupted after its ledger line: the run writes the
 * existing categories followed by the missing ones, appends no second ledger
 * line, and counts the message as `repaired`.
 *
 * The starting checkpoint covers a message received before its
 * `lastReceivedAt`, and a message received exactly at that instant only when
 * `coveredAtBoundary` lists its id. A checkpoint is saved after a whole page
 * was written and lists the ids it processed at its last instant, so a
 * message that shares the instant but sat on a later page is not covered and
 * its interrupted write is repaired. A covered message is always
 * `alreadyTagged` and is never written, whatever categories it carries now: a
 * category the attorney removed by hand stays removed, even though every poll
 * rescans the newest processed messages.
 *
 * A message with no active entry that an undo has touched is settled: it is
 * skipped with no decision, no write, and no filing, and counted as
 * `undoneSkipped`. An operator undo is a human correction, so the next poll
 * does not tag the message again; re-tagging an undone run is a deliberate
 * later operation, never an automatic one.
 *
 * Any other message is decided; the categories to add are the decision's
 * categories the message does not carry yet. For a matched message with
 * attachments the filer runs first; the job tells it whether the sender is a
 * contact address of the matched matter and of no other matter in the index. Then, in `apply` with at least one
 * category to add, the job appends the ledger entry and only afterwards writes
 * the existing categories followed by the additions, so foreign categories and
 * their order survive. A match updates the in-memory conversation map, so
 * later replies in the same run carry the matter over.
 *
 * `apply` saves the checkpoint after every non-empty page. `dry-run` performs
 * every read, decision, and hash and invokes no write on any port.
 *
 * A port failure aborts the run with the typed error. The last saved
 * checkpoint is the previous page; on the rerun the tag ledger makes that page
 * idempotent, the filing ledger deduplicates attachments filed before the
 * failure, and a ledger line whose category write never landed is repaired.
 *
 * **Gotchas**
 *
 * `runId` must be unique per run: the ledger and undo are keyed by it. `wrote`
 * is true when any port write happened, including a checkpoint save. Category
 * writes carry the envelope's `changeKey`; a stale-token retry is the mailbox
 * adapter's concern.
 *
 * **Example** (Reference the job constructor)
 *
 * ```ts
 * import { makeMailTaggingJob } from "@beep/law-practice-use-cases/MailTagging"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeMailTaggingJob)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeMailTaggingJob: Effect.Effect<
  MailTaggingJobShape,
  never,
  Mailbox | MatterDirectory | TagLedger | BackfillCheckpointStore | AttachmentFiler
> = Effect.gen(function* () {
  const mailbox = yield* Mailbox;
  const directory = yield* MatterDirectory;
  const tagLedger = yield* TagLedger;
  const checkpoints = yield* BackfillCheckpointStore;
  const filer = yield* AttachmentFiler;

  const fileAttachments = (scope: JobScope, verdict: Verdict): Effect.Effect<TaggingRunReport, JobError> =>
    O.match(matterToFile(scope, verdict), {
      onNone: () => Effect.succeed(scope.empty),
      onSome: (matter) =>
        filer.file(
          FileAttachmentsRequest.make({
            envelope: verdict.envelope,
            matter,
            taxonomy: scope.taxonomy,
            senderIsExclusiveContact: isExclusiveContact(scope.index, matter, verdict.envelope),
            mode: scope.request.mode,
            runId: scope.request.runId,
            policy: scope.request.policy,
          })
        ),
    });

  const writeCategories = (envelope: MailEnvelope, adds: ReadonlyArray<MailCategoryName>) =>
    mailbox.setCategories(
      SetCategoriesRequest.make({
        messageId: envelope.messageId,
        expected: envelope.categories,
        categories: A.appendAll(envelope.categories, adds),
        changeKey: envelope.changeKey,
      })
    );

  const ensureMatterCategory = (
    ensured: HashSet.HashSet<MatterKey>,
    verdict: Verdict
  ): Effect.Effect<HashSet.HashSet<MatterKey>, JobError> =>
    O.match(unensuredMatter(ensured, verdict), {
      onNone: () => Effect.succeed(ensured),
      onSome: (matterKey) =>
        Effect.as(mailbox.ensureMasterCategories(matterMasterCategories(matterKey)), HashSet.add(ensured, matterKey)),
    });

  const applyTags = Effect.fn("MailTaggingJob.applyTags")(function* (
    scope: JobScope,
    ensured: HashSet.HashSet<MatterKey>,
    verdict: Verdict
  ): Effect.fn.Return<HashSet.HashSet<MatterKey>, JobError> {
    const { envelope, adds } = verdict;
    const nextEnsured = yield* ensureMatterCategory(ensured, verdict);
    const recordedAt = yield* DateTime.now;
    yield* tagLedger.append(
      TagLedgerEntry.make({
        runId: scope.request.runId,
        messageId: envelope.messageId,
        internetMessageId: envelope.internetMessageId,
        conversationId: envelope.conversationId,
        addedCategories: adds,
        decision: summarizeDecision(verdict.decision),
        recordedAt,
      })
    );
    yield* writeCategories(envelope, adds);
    return nextEnsured;
  });

  const tagEnvelope = Effect.fn("MailTaggingJob.tagEnvelope")(function* (
    scope: JobScope,
    state: JobState,
    envelope: MailEnvelope
  ): Effect.fn.Return<JobState, JobError> {
    const verdict = verdictOf(scope, state, envelope);
    const filing = yield* fileAttachments(scope, verdict);
    const writes = TaggingMode.is.apply(scope.request.mode) && A.isReadonlyArrayNonEmpty(verdict.adds);
    const ensured = writes ? yield* applyTags(scope, state.ensured, verdict) : state.ensured;
    return {
      report: combineTaggingRunReports(
        state.report,
        combineTaggingRunReports(verdictReport(scope.empty, verdict, writes), filing)
      ),
      ledgered: withLedgered(state.ledgered, verdict, writes),
      conversations: withConversation(state.conversations, verdict),
      ensured,
      boundary: state.boundary,
      processed: state.processed,
    };
  });

  const repair = Effect.fn("MailTaggingJob.repair")(function* (
    scope: JobScope,
    state: JobState,
    envelope: MailEnvelope,
    missing: ReadonlyArray<MailCategoryName>
  ): Effect.fn.Return<JobState, JobError> {
    const writes = TaggingMode.is.apply(scope.request.mode);
    if (writes) {
      yield* writeCategories(envelope, missing);
    }
    return counted(scope, state, { repaired: 1, wrote: writes });
  });

  const settleLedgered = (
    scope: JobScope,
    state: JobState,
    envelope: MailEnvelope,
    ledgered: ReadonlyArray<MailCategoryName>
  ): Effect.Effect<JobState, JobError> =>
    A.match(pendingRepair(scope, envelope, ledgered), {
      onEmpty: () => Effect.succeed(counted(scope, state, { alreadyTagged: 1 })),
      onNonEmpty: (missing) => repair(scope, state, envelope, missing),
    });

  const tagUnlessUndone = (
    scope: JobScope,
    state: JobState,
    envelope: MailEnvelope
  ): Effect.Effect<JobState, JobError> =>
    HashSet.has(scope.undone, envelope.messageId)
      ? Effect.succeed(counted(scope, state, { undoneSkipped: 1 }))
      : tagEnvelope(scope, state, envelope);

  const processEnvelope =
    (scope: JobScope) =>
    (state: JobState, envelope: MailEnvelope): Effect.Effect<JobState, JobError> =>
      O.match(HashMap.get(state.ledgered, envelope.messageId), {
        onNone: () => tagUnlessUndone(scope, state, envelope),
        onSome: (ledgered) => settleLedgered(scope, state, envelope, ledgered),
      });

  const saveCheckpoint = (scope: JobScope, state: JobState, page: MailPage): Effect.Effect<JobState, JobError> =>
    O.match(
      O.filter(A.last(page.envelopes), () => TaggingMode.is.apply(scope.request.mode)),
      {
        onNone: () => Effect.succeed(state),
        onSome: (last) => {
          const boundary = boundaryAfter(state.boundary, page, last);
          return Effect.as(
            checkpoints.save(
              BackfillCheckpoint.make({
                since: scope.request.since,
                lastReceivedAt: O.some(last.receivedAt),
                lastMessageId: O.some(last.messageId),
                coveredAtBoundary: boundary.ids,
                processed: state.processed,
              })
            ),
            {
              ...state,
              boundary: O.some(boundary),
              report: TaggingRunReport.make({ ...state.report, wrote: true }),
            }
          );
        },
      }
    );

  const runPages: (
    scope: JobScope,
    state: JobState,
    cursor: O.Option<MailPageCursor>,
    pagesLeft: O.Option<number>
  ) => Effect.Effect<JobState, JobError> = Effect.fn("MailTaggingJob.runPages")(
    function* (scope, state, cursor, pagesLeft) {
      const page = yield* mailbox.listMessagesSince(ListMessagesSinceRequest.make({ since: scope.resumeFrom, cursor }));
      const scanned = yield* Effect.reduce(page.envelopes, () => state, processEnvelope(scope));
      const saved = yield* saveCheckpoint(
        scope,
        { ...scanned, processed: scanned.processed + page.envelopes.length },
        page
      );
      yield* Effect.logDebug("Mail-tagging page processed").pipe(
        Effect.annotateLogs({ runId: scope.request.runId, messages: page.envelopes.length, processed: saved.processed })
      );
      const remaining = O.map(pagesLeft, (count) => count - 1);
      return yield* O.match(
        O.filter(page.next, () => hasPagesLeft(remaining)),
        {
          onNone: () => Effect.succeed(saved),
          onSome: (next) => runPages(scope, saved, O.some(next), remaining),
        }
      );
    }
  );

  const ensurePracticeCategories = (request: RunMailTaggingRequest) =>
    TaggingMode.is.apply(request.mode) ? mailbox.ensureMasterCategories(practiceMasterCategories) : Effect.succeed(0);

  return MailTaggingJobShape.make({
    run: Effect.fn("MailTaggingJob.run")(function* (request: RunMailTaggingRequest) {
      const index = yield* directory.snapshot;
      const created = yield* ensurePracticeCategories(request);
      const records = yield* tagLedger.records;
      const checkpoint = yield* checkpoints.load;
      const empty = emptyTaggingRunReport(request.mode, request.runId);
      const checkpointAt = O.flatMap(checkpoint, (saved) => saved.lastReceivedAt);
      const covered = O.match(checkpoint, {
        onNone: (): ReadonlyArray<MailMessageId> => [],
        onSome: (saved) => saved.coveredAtBoundary,
      });
      const state = yield* runPages(
        {
          request,
          index,
          taxonomy: defaultMailTaxonomy(A.map(index.entries, (entry) => entry.matterKey)),
          empty,
          checkpointAt,
          coveredAtBoundary: HashSet.fromIterable(covered),
          undone: undoneMessageIds(records),
          resumeFrom: O.getOrElse(checkpointAt, () => request.since),
        },
        {
          report: TaggingRunReport.make({ ...empty, wrote: created > 0 }),
          ledgered: ledgeredCategoriesOf(records),
          conversations: conversationMattersOf(records),
          ensured: HashSet.empty(),
          boundary: O.map(checkpointAt, (at) => ({ at, ids: covered })),
          processed: O.match(checkpoint, { onNone: () => 0, onSome: (saved) => saved.processed }),
        },
        O.none(),
        request.maxPages
      );
      return state.report;
    }),
  });
});
