import { MatterIndex, MatterIndexEntry, TaggingRunId } from "@beep/law-practice-domain/values/MailTagging";
import {
  activeTagEntries,
  completedFilings,
  MailTaggingJob,
  MailTaggingPortError,
  MailTaggingUndo,
  RunMailTaggingRequest,
  SetCategoriesRequest,
  UndoMailTaggingRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { Effect, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import {
  acme,
  acmeEntry,
  attachment,
  envelope,
  globexEntry,
  index,
  runId,
  scenario,
  since,
  World,
} from "./MailTagging.fixture.ts";
import type { MailEnvelope, TaggingMode, TaggingRunReport } from "@beep/law-practice-domain/values/MailTagging";

const officeAction = envelope({
  at: 1,
  subject: "Office action for 16/123,456",
  sender: "notices@uspto.gov",
  conversation: "conv-1",
  categories: ["Docket - unverified", "Personal"],
  hasAttachments: true,
});

const mailbox: ReadonlyArray<MailEnvelope> = [
  officeAction,
  envelope({ at: 2, subject: "Re: thanks", conversation: "conv-1", categories: ["Personal"] }),
  envelope({ at: 3, sender: "paralegal@acme.example.test" }),
  envelope({ at: 4, subject: "Lunch on Friday?" }),
  envelope({ at: 5, subject: "Status of 16/123,456 and 17/654,321" }),
];

const world = () =>
  scenario({
    envelopes: mailbox,
    attachments: [[officeAction.messageId, [attachment({ id: "att-1", name: "office-action.pdf", bytes: [1, 2, 3] })]]],
  });

const clientReply = envelope({
  at: 6,
  subject: "Re: 16/123,456 signed declaration",
  sender: "counsel@acme.example.test",
  categories: ["Personal"],
  hasAttachments: true,
});

// The same contact address listed under a second matter.
const sharedContactIndex = MatterIndex.make({
  builtAt: since,
  entries: [acmeEntry, MatterIndexEntry.make({ ...globexEntry, contactAddresses: acmeEntry.contactAddresses })],
});

const clientWorld = (matters: MatterIndex) =>
  scenario({
    envelopes: [clientReply],
    attachments: [[clientReply.messageId, [attachment({ id: "att-9", name: "declaration.pdf", bytes: [9] })]]],
    index: matters,
  });

const tiedLater = envelope({ at: 2, id: "msg-2b", subject: "Third notice for 16/123,456" });

/** Two messages share an instant across a page break: msg-2 ends page 1, msg-2b opens page 2. */
const tiedMailbox = () =>
  scenario({
    envelopes: [
      envelope({ at: 1, subject: "Notice for 16/123,456" }),
      envelope({ at: 2, subject: "Second notice for 16/123,456" }),
      tiedLater,
    ],
  });

const run = Effect.fn("MailTaggingJobTest.run")(function* (mode: TaggingMode, id: string) {
  const job = yield* MailTaggingJob;
  return yield* job.run(RunMailTaggingRequest.make({ mode, since, runId: TaggingRunId.make(id) }));
});

const undo = Effect.fn("MailTaggingJobTest.undo")(function* (mode: TaggingMode, id: string) {
  const service = yield* MailTaggingUndo;
  return yield* service.run(UndoMailTaggingRequest.make({ originalRunId: runId, runId: TaggingRunId.make(id), mode }));
});

const counts = (report: TaggingRunReport) => ({
  scanned: report.scanned,
  matched: report.matched,
  unmatched: report.unmatched,
  alreadyTagged: report.alreadyTagged,
  undoneSkipped: report.undoneSkipped,
  repaired: report.repaired,
  categoryAdds: A.map(report.categoryAdds, (item) => [item.category, item.count]),
  attachmentsFiled: report.attachmentsFiled,
  attachmentsDeduped: report.attachmentsDeduped,
  attachmentsReconciled: report.attachmentsReconciled,
});

const firstRunCounts = {
  scanned: 5,
  matched: 2,
  unmatched: { "no-signal": 1, "below-threshold": 1, ambiguous: 1, "needs-attorney": 0 },
  alreadyTagged: 0,
  undoneSkipped: 0,
  repaired: 0,
  categoryAdds: [
    ["M: acme.10001", 2],
    ["P: USPTO", 1],
    ["P: Unmatched - review", 2],
  ],
  attachmentsFiled: 1,
  attachmentsDeduped: 0,
  attachmentsReconciled: 0,
};

describe("MailTagging job", () => {
  it.layer(world(), { timeout: "30 seconds" })("dry run", (it) => {
    it.effect(
      "reports the counts without invoking a single write",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* run("dry-run", runId);

        expect(counts(report)).toStrictEqual(firstRunCounts);
        expect(report.wrote).toBe(false);
        expect(report.mode).toBe("dry-run");
        expect(yield* Ref.get(state.writes)).toStrictEqual([]);
        expect(yield* Ref.get(state.messages)).toStrictEqual(mailbox);
        assertNone(yield* Ref.get(state.checkpoint));
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("apply", (it) => {
    it.effect(
      "appends owned categories after the foreign ones and records the ledger",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* run("apply", runId);
        const entries = activeTagEntries(yield* Ref.get(state.tagRecords));

        expect(counts(report)).toStrictEqual(firstRunCounts);
        expect(report.wrote).toBe(true);
        expect(yield* state.categoriesOf(1)).toStrictEqual([
          "Docket - unverified",
          "Personal",
          "M: acme.10001",
          "P: USPTO",
        ]);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Personal", "M: acme.10001"]);
        expect(yield* state.categoriesOf(3)).toStrictEqual(["P: Unmatched - review"]);
        expect(yield* state.categoriesOf(4)).toStrictEqual([]);
        expect(A.map(entries, (entry) => entry.messageId)).toStrictEqual(["msg-1", "msg-2", "msg-3", "msg-5"]);
        expect(A.map(entries, (entry) => O.getOrNull(entry.decision.matterKey))).toStrictEqual([
          acme,
          acme,
          null,
          null,
        ]);
        expect(A.map(entries, (entry) => O.getOrNull(entry.conversationId))).toStrictEqual([
          "conv-1",
          "conv-1",
          null,
          null,
        ]);
        expect(A.take(yield* Ref.get(state.writes), 10)).toStrictEqual([
          "ensureMasterCategories:P: USPTO|P: Client|P: Opposing counsel|P: Billing|P: Admin|P: Unmatched - review",
          "filingLedger.append:FilingIntended",
          "upload:2026-07-01 office-action.pdf",
          "filingLedger.append:FilingCompleted",
          "ensureMasterCategories:M: acme.10001",
          "tagLedger.append",
          "setCategories:msg-1",
          "tagLedger.append",
          "setCategories:msg-2",
          "checkpoint.save",
        ]);
        expect(yield* state.writesOf("ensureMasterCategories")).toHaveLength(2);
        expect(A.map(yield* Ref.get(state.categoryWrites), (write) => O.getOrNull(write.changeKey))).toStrictEqual([
          "ck-1",
          "ck-2",
          "ck-3",
          "ck-5",
        ]);
        expect(
          A.map(completedFilings(yield* Ref.get(state.filingRecords)), (entry) => entry.destination)
        ).toStrictEqual(["uspto-incoming"]);
        expect(yield* state.writesOf("checkpoint.save")).toHaveLength(3);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("second run", (it) => {
    it.effect(
      "writes no category over an already tagged mailbox",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        const before = yield* Ref.get(state.messages);
        const categoryWrites = yield* state.writesOf("setCategories:");
        const second = yield* run("apply", "run-0002");

        expect(yield* state.writesOf("setCategories:")).toStrictEqual(categoryWrites);
        expect(yield* state.writesOf("upload:")).toHaveLength(1);
        expect(yield* Ref.get(state.messages)).toStrictEqual(before);
        expect(second.alreadyTagged).toBe(1);
        expect(second.categoryAdds).toStrictEqual([]);
        expect(second.attachmentsFiled).toBe(0);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("resume", (it) => {
    it.effect(
      "continues from the checkpoint after a failed page without tagging twice",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingListCall, O.some(2));
        const failure = yield* Effect.flip(run("apply", runId));
        const interrupted = yield* Ref.get(state.checkpoint);

        expect(failure).toBeInstanceOf(MailTaggingPortError);
        expect(O.getOrNull(O.flatMap(interrupted, (saved) => saved.lastMessageId))).toBe("msg-2");
        expect(yield* state.writesOf("setCategories:")).toStrictEqual(["setCategories:msg-1", "setCategories:msg-2"]);

        const resumed = yield* run("apply", "run-0002");
        const completed = yield* Ref.get(state.checkpoint);

        expect(resumed.alreadyTagged).toBe(1);
        expect(resumed.scanned).toBe(4);
        expect(yield* state.writesOf("setCategories:")).toStrictEqual([
          "setCategories:msg-1",
          "setCategories:msg-2",
          "setCategories:msg-3",
          "setCategories:msg-5",
        ]);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Personal", "M: acme.10001"]);
        expect(O.getOrNull(O.flatMap(completed, (saved) => saved.lastMessageId))).toBe("msg-5");
        expect(O.getOrNull(O.map(completed, (saved) => saved.processed))).toBe(6);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("interrupted category write", (it) => {
    it.effect(
      "repairs the message on the rerun without a second ledger entry, and undo restores it",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingCategoryWrite, O.some(2));
        const failure = yield* Effect.flip(run("apply", runId));

        expect(failure).toBeInstanceOf(MailTaggingPortError);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Personal"]);
        expect(A.map(activeTagEntries(yield* Ref.get(state.tagRecords)), (entry) => entry.messageId)).toStrictEqual([
          "msg-1",
          "msg-2",
        ]);

        const preview = yield* run("dry-run", "run-0002");
        const rerun = yield* run("apply", "run-0003");
        const entries = activeTagEntries(yield* Ref.get(state.tagRecords));

        expect([preview.repaired, preview.wrote]).toStrictEqual([1, false]);
        expect([rerun.alreadyTagged, rerun.repaired, rerun.scanned]).toStrictEqual([1, 1, 5]);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Personal", "M: acme.10001"]);
        expect(A.map(entries, (entry) => [entry.messageId, entry.runId])).toStrictEqual([
          ["msg-1", "run-0001"],
          ["msg-2", "run-0001"],
          ["msg-3", "run-0003"],
          ["msg-5", "run-0003"],
        ]);
        expect(yield* state.writesOf("upload:")).toHaveLength(1);

        yield* undo("apply", "undo-0001");

        expect(yield* state.categoriesOf(1)).toStrictEqual(["Docket - unverified", "Personal"]);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Personal"]);
        expect(yield* state.categoriesOf(3)).toStrictEqual(["P: Unmatched - review"]);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("human correction", (it) => {
    it.effect(
      "leaves a category the attorney removed from a checkpointed message removed",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        yield* state.mailbox.setCategories(
          SetCategoriesRequest.make({ messageId: envelope({ at: 5 }).messageId, expected: [], categories: [] })
        );
        const categoryWrites = yield* state.writesOf("setCategories:");
        const ledgerLines = yield* Ref.get(state.tagRecords);
        const preview = yield* run("dry-run", "run-0002");
        const rerun = yield* run("apply", "run-0003");

        expect([preview.alreadyTagged, preview.repaired]).toStrictEqual([1, 0]);
        expect([rerun.scanned, rerun.alreadyTagged, rerun.repaired]).toStrictEqual([1, 1, 0]);
        expect(rerun.categoryAdds).toStrictEqual([]);
        expect(yield* state.writesOf("setCategories:")).toStrictEqual(categoryWrites);
        expect(yield* state.categoriesOf(5)).toStrictEqual([]);
        expect(yield* Ref.get(state.tagRecords)).toStrictEqual(ledgerLines);
      })
    );
  });

  it.layer(tiedMailbox(), { timeout: "30 seconds" })("interrupted write tied with the checkpoint instant", (it) => {
    it.effect(
      "repairs the tied message the checkpoint does not list, then leaves a covered tie alone",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingCategoryWrite, O.some(3));
        const failure = yield* Effect.flip(run("apply", runId));
        const interrupted = yield* Ref.get(state.checkpoint);

        assertInstanceOf(failure, MailTaggingPortError);
        expect(A.flatMap(O.toArray(interrupted), (saved) => saved.coveredAtBoundary)).toStrictEqual(["msg-2"]);
        expect(yield* state.categoriesById("msg-2b")).toStrictEqual([]);
        expect(A.map(activeTagEntries(yield* Ref.get(state.tagRecords)), (entry) => entry.messageId)).toStrictEqual([
          "msg-1",
          "msg-2",
          "msg-2b",
        ]);

        const rerun = yield* run("apply", "run-0002");
        const completed = yield* Ref.get(state.checkpoint);

        expect([rerun.scanned, rerun.alreadyTagged, rerun.repaired]).toStrictEqual([2, 1, 1]);
        expect(yield* state.categoriesById("msg-2b")).toStrictEqual(["M: acme.10001"]);
        expect(activeTagEntries(yield* Ref.get(state.tagRecords))).toHaveLength(3);
        expect(A.flatMap(O.toArray(completed), (saved) => saved.coveredAtBoundary)).toStrictEqual(["msg-2", "msg-2b"]);

        yield* state.mailbox.setCategories(
          SetCategoriesRequest.make({ messageId: tiedLater.messageId, expected: [], categories: [] })
        );
        const categoryWrites = yield* state.writesOf("setCategories:");
        const third = yield* run("apply", "run-0003");

        expect([third.alreadyTagged, third.repaired]).toStrictEqual([2, 0]);
        expect(yield* state.writesOf("setCategories:")).toStrictEqual(categoryWrites);
        expect(yield* state.categoriesById("msg-2b")).toStrictEqual([]);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("store keeps the upload and reports failure", (it) => {
    it.effect(
      "completes on the next run with the attachment reconciled once",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.lyingUpload, O.some(1));
        const failure = yield* Effect.flip(run("apply", runId));

        assertInstanceOf(failure, MailTaggingPortError);
        expect(yield* state.writesOf("setCategories:")).toStrictEqual([]);

        const rerun = yield* run("apply", "run-0002");

        expect([rerun.scanned, rerun.matched, rerun.attachmentsReconciled, rerun.attachmentsFiled]).toStrictEqual([
          5, 2, 1, 0,
        ]);
        expect(yield* state.categoriesOf(1)).toStrictEqual([
          "Docket - unverified",
          "Personal",
          "M: acme.10001",
          "P: USPTO",
        ]);
        expect(yield* Ref.get(state.uploads)).toHaveLength(1);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("page bound", (it) => {
    it.effect(
      "stops after the requested number of pages",
      Effect.fnUntraced(function* () {
        const job = yield* MailTaggingJob;
        const report = yield* job.run(
          RunMailTaggingRequest.make({ mode: "dry-run", since, runId, maxPages: O.some(1) })
        );

        expect(report.scanned).toBe(2);
      })
    );
  });
});

describe("MailTagging job client filing", () => {
  it.layer(clientWorld(index), { timeout: "30 seconds" })("exclusive contact", (it) => {
    it.effect(
      "files a matched message from a contact of that matter alone under from-client",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* run("apply", runId);
        const undone = yield* undo("apply", "undo-0001");
        const categoryWrites = yield* Ref.get(state.categoryWrites);

        expect([report.matched, report.attachmentsFiled]).toStrictEqual([1, 1]);
        expect(
          A.map(completedFilings(yield* Ref.get(state.filingRecords)), (entry) => entry.destination)
        ).toStrictEqual(["from-client"]);
        expect(undone.categoriesRemoved).toBe(2);
        expect(A.map(categoryWrites, (write) => [write.expected, write.categories])).toStrictEqual([
          [["Personal"], ["Personal", "M: acme.10001", "P: Client"]],
          [["Personal", "M: acme.10001", "P: Client"], ["Personal"]],
        ]);
      })
    );
  });

  it.layer(clientWorld(sharedContactIndex), { timeout: "30 seconds" })("shared contact", (it) => {
    it.effect(
      "tags the message and files nothing when another matter lists the same contact address",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* run("apply", runId);

        expect([report.matched, report.attachmentsFiled]).toStrictEqual([1, 0]);
        expect(report.attachmentsSkipped["sender-not-routable"]).toBe(1);
        expect(yield* state.writesOf("upload:")).toStrictEqual([]);
        expect(yield* state.categoriesOf(6)).toStrictEqual(["Personal", "M: acme.10001", "P: Client"]);
      })
    );
  });
});

describe("MailTagging undo", () => {
  it.layer(world(), { timeout: "30 seconds" })("after another actor's edit", (it) => {
    it.effect(
      "restores the pre-run categories and keeps what someone else added",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        const tagged = yield* state.categoriesOf(2);
        yield* state.mailbox.setCategories(
          SetCategoriesRequest.make({
            messageId: envelope({ at: 2 }).messageId,
            expected: tagged,
            categories: ["Follow up", ...tagged],
          })
        );
        const writesBefore = yield* Ref.get(state.writes);
        const planned = yield* undo("dry-run", "undo-0000");

        expect({ ...planned }).toMatchObject({ entries: 4, messagesRestored: 4, categoriesRemoved: 5, wrote: false });
        expect(yield* Ref.get(state.writes)).toStrictEqual(writesBefore);

        const report = yield* undo("apply", "undo-0001");

        expect({ ...report }).toMatchObject({
          entries: 4,
          messagesRestored: 4,
          messagesMissing: 0,
          categoriesRemoved: 5,
          wrote: true,
        });
        expect(yield* state.categoriesOf(1)).toStrictEqual(["Docket - unverified", "Personal"]);
        expect(yield* state.categoriesOf(2)).toStrictEqual(["Follow up", "Personal"]);
        expect(yield* state.categoriesOf(3)).toStrictEqual([]);
        expect(yield* state.categoriesOf(5)).toStrictEqual([]);
        expect(activeTagEntries(yield* Ref.get(state.tagRecords))).toStrictEqual([]);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("deleted and already corrected messages", (it) => {
    it.effect(
      "counts a deleted message as missing and writes nothing to a message that lost its tags already",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        yield* Ref.update(
          state.messages,
          A.filter((message) => message.messageId !== "msg-3")
        );
        yield* state.mailbox.setCategories(
          SetCategoriesRequest.make({
            messageId: envelope({ at: 5 }).messageId,
            expected: [],
            categories: ["Follow up"],
          })
        );
        const categoryWrites = yield* state.writesOf("setCategories:");
        const report = yield* undo("apply", "undo-0001");

        expect({ ...report }).toMatchObject({
          entries: 4,
          messagesRestored: 2,
          messagesMissing: 1,
          categoriesRemoved: 3,
          wrote: true,
        });
        expect(yield* state.writesOf("setCategories:")).toStrictEqual([
          ...categoryWrites,
          "setCategories:msg-1",
          "setCategories:msg-2",
        ]);
        expect(yield* state.categoriesOf(5)).toStrictEqual(["Follow up"]);
        expect(activeTagEntries(yield* Ref.get(state.tagRecords))).toStrictEqual([]);
        expect((yield* undo("apply", "undo-0002")).entries).toBe(0);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("polling after an undo", (it) => {
    it.effect(
      "never re-tags an undone message, and still tags a message that arrives afterwards",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        yield* undo("apply", "undo-0001");
        const categoryWrites = yield* state.writesOf("setCategories:");
        const ledgerLines = yield* Ref.get(state.tagRecords);
        const poll = yield* run("apply", "run-0002");

        expect([poll.scanned, poll.undoneSkipped, poll.alreadyTagged]).toStrictEqual([1, 1, 0]);
        expect(poll.categoryAdds).toStrictEqual([]);

        yield* Ref.set(state.checkpoint, O.none());
        const fromStart = yield* run("apply", "run-0003");

        expect([
          fromStart.scanned,
          fromStart.undoneSkipped,
          fromStart.matched,
          fromStart.attachmentsFiled,
        ]).toStrictEqual([5, 4, 0, 0]);
        expect(fromStart.unmatched["no-signal"]).toBe(1);
        expect(yield* state.writesOf("setCategories:")).toStrictEqual(categoryWrites);
        expect(yield* Ref.get(state.tagRecords)).toStrictEqual(ledgerLines);
        expect(yield* state.categoriesOf(1)).toStrictEqual(["Docket - unverified", "Personal"]);
        expect(yield* state.categoriesOf(5)).toStrictEqual([]);

        yield* Ref.update(state.messages, A.append(envelope({ at: 6, subject: "Notice for 16/123,456" })));
        const later = yield* run("apply", "run-0004");

        expect([later.undoneSkipped, later.matched]).toStrictEqual([1, 1]);
        expect(yield* state.categoriesOf(6)).toStrictEqual(["M: acme.10001"]);
      })
    );
  });

  it.layer(world(), { timeout: "30 seconds" })("second undo", (it) => {
    it.effect(
      "does nothing when the run is undone again",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* run("apply", runId);
        yield* undo("apply", "undo-0001");
        const writesBefore = yield* Ref.get(state.writes);
        const second = yield* undo("apply", "undo-0002");

        expect({ ...second }).toMatchObject({ entries: 0, messagesRestored: 0, categoriesRemoved: 0, wrote: false });
        expect(yield* Ref.get(state.writes)).toStrictEqual(writesBefore);
      })
    );
  });
});
