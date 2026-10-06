import { DocumentFileId, FilingLedgerEntry, FilingLedgerRecord } from "@beep/law-practice-domain/values/MailTagging";
import {
  AttachmentFiler,
  completedFilings,
  FileAttachmentsRequest,
  MailTaggingPortError,
  MailTaggingStateError,
  pendingFilingIntents,
} from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { Effect, Ref } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import {
  acmeEntry,
  attachment,
  envelope,
  globexEntry,
  runId,
  scenario,
  taxonomy,
  World,
} from "./MailTagging.fixture.ts";
import type { MailEnvelope, MatterIndexEntry, TaggingMode } from "@beep/law-practice-domain/values/MailTagging";

const usptoMail = envelope({ at: 1, sender: "notices@uspto.gov", hasAttachments: true });
const clientMail = envelope({ at: 2, sender: "counsel@acme.example.test", hasAttachments: true });
const strangerMail = envelope({ at: 3, sender: "someone@vendor.example.test", hasAttachments: true });
const pdf = [37, 80, 68, 70];
const pdfSha256 = "315d429b7714cedb6ad04ac31240145257692630457f3c88253c5beceac76027";

type Filing = {
  readonly mode: TaggingMode;
  readonly message: MailEnvelope;
  readonly matter?: MatterIndexEntry;
  /** Whether the job found the sender to be a contact of this matter alone; derived from the matter when absent. */
  readonly exclusive?: boolean;
};

const isContactOf = (matter: MatterIndexEntry, message: MailEnvelope): boolean =>
  A.some(O.toArray(message.senderAddress), (address) => A.contains(matter.contactAddresses, address));

const file = Effect.fn("MailTaggingFilerTest.file")(function* (filing: Filing) {
  const filer = yield* AttachmentFiler;
  const matter = filing.matter ?? acmeEntry;
  return yield* filer.file(
    FileAttachmentsRequest.make({
      envelope: filing.message,
      matter,
      taxonomy,
      senderIsExclusiveContact: filing.exclusive ?? isContactOf(matter, filing.message),
      mode: filing.mode,
      runId,
    })
  );
});

const repeatedPdf = () =>
  scenario({
    envelopes: [usptoMail, clientMail],
    attachments: [
      [usptoMail.messageId, [attachment({ id: "att-1", name: "office-action.pdf", bytes: pdf })]],
      [clientMail.messageId, [attachment({ id: "att-2", name: "FW office-action.pdf", bytes: pdf })]],
    ],
  });

describe("MailTagging attachment filer", () => {
  it.layer(repeatedPdf(), { timeout: "30 seconds" })("content dedupe", (it) => {
    it.effect(
      "uploads the same bytes once for a matter, whichever destination the repeat is routed to",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const reports = [
          yield* file({ mode: "apply", message: usptoMail }),
          yield* file({ mode: "apply", message: clientMail }),
        ];
        const entries = completedFilings(yield* Ref.get(state.filingRecords));
        const uploads = yield* Ref.get(state.uploads);

        expect(A.map(reports, (report) => report.attachmentsFiled)).toStrictEqual([1, 0]);
        expect(A.map(reports, (report) => report.attachmentsDeduped)).toStrictEqual([0, 1]);
        expect(A.map(reports, (report) => report.wrote)).toStrictEqual([true, false]);
        expect(yield* state.writesOf("upload:")).toStrictEqual(["upload:2026-07-01 office-action.pdf"]);
        expect(A.map(uploads, (upload) => upload.folderId)).toStrictEqual(["folder-acme-uspto-incoming"]);
        expect(A.map(entries, (entry) => [entry.contentSha256, entry.destination, entry.byteLength])).toStrictEqual([
          [pdfSha256, "uspto-incoming", 4],
        ]);
        expect(yield* Ref.get(state.folderRequests)).toStrictEqual([
          "acme.10001:uspto-incoming",
          "acme.10001:from-client",
        ]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("client mail", (it) => {
    it.effect(
      "files a matter contact's attachment under from-client",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* file({ mode: "apply", message: clientMail });

        expect(report.attachmentsFiled).toBe(1);
        expect(A.map(yield* Ref.get(state.uploads), (upload) => upload.folderId)).toStrictEqual([
          "folder-acme-from-client",
        ]);
        expect(
          A.map(completedFilings(yield* Ref.get(state.filingRecords)), (entry) => entry.destination)
        ).toStrictEqual(["from-client"]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("shared contact", (it) => {
    it.effect(
      "does not route a contact address that another matter also lists",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* file({ mode: "apply", message: clientMail, exclusive: false });

        expect(report.attachmentsSkipped["sender-not-routable"]).toBe(1);
        expect(report.attachmentsFiled).toBe(0);
        expect(yield* Ref.get(state.downloads)).toBe(0);
        expect(yield* Ref.get(state.writes)).toStrictEqual([]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("known documents", (it) => {
    it.effect(
      "counts content the document system already holds for the matter as deduplicated and uploads nothing",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.knownDocuments, [`${pdfSha256} acme.10001`]);
        const applied = yield* file({ mode: "apply", message: usptoMail });
        const preview = yield* file({ mode: "dry-run", message: clientMail });

        expect([applied.attachmentsDeduped, applied.attachmentsFiled, applied.wrote]).toStrictEqual([1, 0, false]);
        expect([preview.attachmentsDeduped, preview.attachmentsFiled]).toStrictEqual([1, 0]);
        expect(yield* Ref.get(state.writes)).toStrictEqual([]);
        expect(yield* Ref.get(state.filingRecords)).toStrictEqual([]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("known documents of another matter", (it) => {
    it.effect(
      "still files content the index holds only for another matter",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.knownDocuments, [`${pdfSha256} globex.20002`]);
        const report = yield* file({ mode: "apply", message: usptoMail });

        expect([report.attachmentsDeduped, report.attachmentsFiled]).toStrictEqual([0, 1]);
        expect(yield* state.writesOf("upload:")).toStrictEqual(["upload:2026-07-01 office-action.pdf"]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("dry run", (it) => {
    it.effect(
      "counts the way apply would and uploads nothing",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const reports = [
          yield* file({ mode: "dry-run", message: usptoMail }),
          yield* file({ mode: "dry-run", message: clientMail }),
        ];

        expect(A.map(reports, (report) => report.attachmentsFiled)).toStrictEqual([1, 0]);
        expect(A.map(reports, (report) => report.attachmentsDeduped)).toStrictEqual([0, 1]);
        expect(A.map(reports, (report) => report.wrote)).toStrictEqual([false, false]);
        expect(yield* Ref.get(state.writes)).toStrictEqual([]);
        expect(yield* Ref.get(state.filingRecords)).toStrictEqual([]);
      })
    );
  });

  it.layer(
    scenario({
      envelopes: [usptoMail],
      attachments: [
        [
          usptoMail.messageId,
          [
            attachment({ id: "att-1", name: "claims: draft?.pdf", bytes: [1, 2, 3] }),
            attachment({ id: "att-2", name: "claims: draft?.pdf", bytes: [4, 5, 6] }),
          ],
        ],
      ],
    }),
    { timeout: "30 seconds" }
  )("name collision", (it) => {
    it.effect(
      "gives a same-named attachment with different bytes a short-hash suffix",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* file({ mode: "apply", message: usptoMail });
        const uploads = yield* Ref.get(state.uploads);

        expect(report.attachmentsFiled).toBe(2);
        expect(A.map(uploads, (upload) => upload.fileName)).toStrictEqual([
          "2026-07-01 claims_ draft_.pdf",
          "2026-07-01 claims_ draft_ (787c798e).pdf",
        ]);
        expect(A.map(uploads, (upload) => A.fromIterable(upload.bytes))).toStrictEqual([
          [1, 2, 3],
          [4, 5, 6],
        ]);
      })
    );
  });

  it.layer(
    scenario({
      envelopes: [usptoMail],
      attachments: [
        [
          usptoMail.messageId,
          [
            attachment({ id: "att-1", name: "README", bytes: [1] }),
            attachment({ id: "att-2", name: "README", bytes: [2] }),
            attachment({ id: "att-3", name: "   ", bytes: [3] }),
          ],
        ],
      ],
    }),
    { timeout: "30 seconds" }
  )("unusual names", (it) => {
    it.effect(
      "appends the short hash to a name without an extension and names a blank attachment",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* file({ mode: "apply", message: usptoMail });

        expect(report.attachmentsFiled).toBe(3);
        expect(A.map(yield* Ref.get(state.uploads), (upload) => upload.fileName)).toStrictEqual([
          "2026-07-01 README",
          "2026-07-01 README (dbc1b4c9)",
          "2026-07-01 attachment",
        ]);
      })
    );
  });

  it.layer(
    scenario({
      envelopes: [usptoMail],
      attachments: [[usptoMail.messageId, [attachment({ id: "att-1", name: "notice.pdf", bytes: pdf })]]],
      digestFails: true,
    }),
    { timeout: "30 seconds" }
  )("hash failure", (it) => {
    it.effect(
      "fails with a typed content-hasher error and files nothing",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const error = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(error, MailTaggingPortError);
        expect([error.port, error.operation]).toStrictEqual(["ContentHasher", "sha256"]);
        assertNone(error.cause);
        expect(yield* Ref.get(state.writes)).toStrictEqual([]);
      })
    );
  });

  it.layer(
    scenario({
      envelopes: [usptoMail, strangerMail],
      attachments: [
        [
          usptoMail.messageId,
          [
            attachment({ id: "att-1", name: "logo.png", bytes: [1], isInline: true }),
            attachment({ id: "att-2", name: "meeting", bytes: [1], isFile: false }),
            attachment({ id: "att-3", name: "empty.txt", bytes: [] }),
            attachment({ id: "att-4", name: "scan.pdf", bytes: [1], byteLength: 52_428_801 }),
            attachment({ id: "att-5", name: "notice.pdf", bytes: [9] }),
          ],
        ],
        [
          strangerMail.messageId,
          [
            attachment({ id: "att-6", name: "brochure.pdf", bytes: [7] }),
            attachment({ id: "att-7", name: "terms.pdf", bytes: [8] }),
          ],
        ],
      ],
    }),
    { timeout: "30 seconds" }
  )("skips", (it) => {
    it.effect(
      "skips inline, non-file, empty, and oversized parts and files the rest",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const report = yield* file({ mode: "apply", message: usptoMail });

        expect(report.attachmentsSkipped).toStrictEqual({
          inline: 1,
          "not-a-file": 1,
          empty: 1,
          "too-large": 1,
          "no-folder": 0,
          "sender-not-routable": 0,
        });
        expect(report.attachmentsFiled).toBe(1);
        expect(yield* Ref.get(state.downloads)).toBe(1);
        expect(yield* state.writesOf("upload:")).toStrictEqual(["upload:2026-07-01 notice.pdf"]);
      })
    );

    it.effect(
      "skips every attachment of a destination without a folder",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const writesBefore = yield* Ref.get(state.writes);
        const report = yield* file({ mode: "apply", message: usptoMail, matter: globexEntry });

        expect(report.attachmentsSkipped["no-folder"]).toBe(5);
        expect(report.attachmentsFiled).toBe(0);
        expect(report.wrote).toBe(false);
        expect(yield* Ref.get(state.writes)).toStrictEqual(writesBefore);
      })
    );

    it.effect(
      "files nothing and downloads nothing from a sender that is neither the USPTO nor a contact of the matter",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        const before = {
          downloads: yield* Ref.get(state.downloads),
          folderRequests: yield* Ref.get(state.folderRequests),
          writes: yield* Ref.get(state.writes),
        };
        const stranger = yield* file({ mode: "apply", message: strangerMail });
        const otherMatterContact = yield* file({
          mode: "apply",
          message: envelope({ at: 3, sender: "counsel@acme.example.test", hasAttachments: true }),
          matter: globexEntry,
        });

        expect(stranger.attachmentsSkipped["sender-not-routable"]).toBe(2);
        expect(otherMatterContact.attachmentsSkipped["sender-not-routable"]).toBe(2);
        expect([stranger.attachmentsFiled, stranger.wrote]).toStrictEqual([0, false]);
        expect({
          downloads: yield* Ref.get(state.downloads),
          folderRequests: yield* Ref.get(state.folderRequests),
          writes: yield* Ref.get(state.writes),
        }).toStrictEqual(before);
      })
    );
  });
});

const sameNameTwice = () =>
  scenario({
    envelopes: [usptoMail, clientMail],
    attachments: [
      [usptoMail.messageId, [attachment({ id: "att-1", name: "office-action.pdf", bytes: pdf })]],
      [clientMail.messageId, [attachment({ id: "att-2", name: "office-action.pdf", bytes: [9, 9] })]],
    ],
  });

const ledgerShape = Effect.fn("MailTaggingFilerTest.ledgerShape")(function* () {
  const state = yield* World;
  const records = yield* Ref.get(state.filingRecords);
  return {
    lines: A.map(records, (record) => record._tag),
    pending: A.map(pendingFilingIntents(records), (intent) => intent.fileName),
    completed: A.map(completedFilings(records), (entry) => [entry.fileName, entry.fileId, entry.reconciled]),
    uploads: A.map(yield* Ref.get(state.uploads), (upload) => `${upload.folderId}/${upload.fileName}`),
    uploadCalls: yield* Ref.get(state.uploadCalls),
  };
});

describe("MailTagging two-phase filing", () => {
  it.layer(repeatedPdf(), { timeout: "30 seconds" })("completion lost after the upload", (it) => {
    it.effect(
      "reconciles the stored file on the rerun instead of uploading it again, then deduplicates",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingFilingAppend, O.some(2));
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(failure, MailTaggingStateError);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended"],
          pending: ["2026-07-01 office-action.pdf"],
          completed: [],
          uploads: ["folder-acme-uspto-incoming/2026-07-01 office-action.pdf"],
          uploadCalls: 1,
        });

        const writesBefore = yield* Ref.get(state.writes);
        const preview = yield* file({ mode: "dry-run", message: usptoMail });

        expect([preview.attachmentsReconciled, preview.attachmentsFiled, preview.wrote]).toStrictEqual([1, 0, false]);
        expect(yield* Ref.get(state.writes)).toStrictEqual(writesBefore);
        expect(yield* Ref.get(state.uploadCalls)).toBe(1);

        const rerun = yield* file({ mode: "apply", message: clientMail });

        expect([
          rerun.attachmentsReconciled,
          rerun.attachmentsFiled,
          rerun.attachmentsDeduped,
          rerun.wrote,
        ]).toStrictEqual([1, 0, 0, true]);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended", "FilingCompleted"],
          pending: [],
          completed: [["2026-07-01 office-action.pdf", "file-1", true]],
          uploads: ["folder-acme-uspto-incoming/2026-07-01 office-action.pdf"],
          uploadCalls: 2,
        });

        const third = yield* file({ mode: "apply", message: usptoMail });

        expect([third.attachmentsDeduped, third.attachmentsReconciled, third.attachmentsFiled]).toStrictEqual([
          1, 0, 0,
        ]);
        expect(yield* Ref.get(state.uploadCalls)).toBe(2);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("pending intent the index already lists", (it) => {
    it.effect(
      "resumes a pending intent instead of deduplicating it against the known-documents index",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingFilingAppend, O.some(2));
        yield* Effect.flip(file({ mode: "apply", message: usptoMail }));
        // The index was regenerated and now lists the file the interrupted upload created.
        yield* Ref.set(state.knownDocuments, [`${pdfSha256} acme.10001`]);
        const rerun = yield* file({ mode: "apply", message: usptoMail });

        expect([rerun.attachmentsReconciled, rerun.attachmentsDeduped]).toStrictEqual([1, 0]);
        expect((yield* ledgerShape()).lines).toStrictEqual(["FilingIntended", "FilingCompleted"]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("unidentified file on the reconcile path", (it) => {
    it.effect(
      "fails with a typed document-store error and records no completion",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingFilingAppend, O.some(2));
        yield* Effect.flip(file({ mode: "apply", message: usptoMail }));
        yield* Ref.set(state.anonymousStore, true);
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(failure, MailTaggingPortError);
        expect([failure.port, failure.operation]).toStrictEqual(["DocumentStore", "upload"]);
        expect((yield* ledgerShape()).lines).toStrictEqual(["FilingIntended"]);
      })
    );
  });

  it.layer(sameNameTwice(), { timeout: "30 seconds" })("upload lost after the intent", (it) => {
    it.effect(
      "uploads once on the rerun under the intent's own folder and name",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingUpload, O.some(1));
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(failure, MailTaggingPortError);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended"],
          pending: ["2026-07-01 office-action.pdf"],
          completed: [],
          uploads: [],
          uploadCalls: 1,
        });

        const other = yield* file({ mode: "apply", message: clientMail });
        const rerun = yield* file({ mode: "apply", message: usptoMail });

        expect([other.attachmentsFiled, rerun.attachmentsFiled, rerun.attachmentsReconciled]).toStrictEqual([1, 1, 0]);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended", "FilingIntended", "FilingCompleted", "FilingCompleted"],
          pending: [],
          completed: [
            ["2026-07-01 office-action (31609426).pdf", "file-1", false],
            ["2026-07-01 office-action.pdf", "file-2", false],
          ],
          uploads: [
            "folder-acme-from-client/2026-07-01 office-action (31609426).pdf",
            "folder-acme-uspto-incoming/2026-07-01 office-action.pdf",
          ],
          uploadCalls: 3,
        });
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("intent append failure", (it) => {
    it.effect(
      "never calls the document store",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.failingFilingAppend, O.some(1));
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(failure, MailTaggingStateError);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: [],
          pending: [],
          completed: [],
          uploads: [],
          uploadCalls: 0,
        });
      })
    );
  });

  it.layer(sameNameTwice(), { timeout: "30 seconds" })("foreign file holding a new name", (it) => {
    it.effect(
      "abandons the intent, files under the short-hash name, and does not treat the abandoned name as its own",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.update(
          state.storedFiles,
          HashMap.set("folder-acme-uspto-incoming/2026-07-01 office-action.pdf", DocumentFileId.make("foreign-1"))
        );
        const report = yield* file({ mode: "apply", message: usptoMail });

        expect([report.attachmentsFiled, report.attachmentsReconciled, report.wrote]).toStrictEqual([1, 0, true]);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended", "FilingAbandoned", "FilingIntended", "FilingCompleted"],
          pending: [],
          completed: [["2026-07-01 office-action (315d429b).pdf", "file-1", false]],
          uploads: ["folder-acme-uspto-incoming/2026-07-01 office-action (315d429b).pdf"],
          uploadCalls: 2,
        });

        const other = yield* file({ mode: "apply", message: clientMail });

        expect(other.attachmentsFiled).toBe(1);
        expect(A.map(yield* Ref.get(state.uploads), (upload) => `${upload.folderId}/${upload.fileName}`)).toStrictEqual(
          [
            "folder-acme-uspto-incoming/2026-07-01 office-action (315d429b).pdf",
            "folder-acme-from-client/2026-07-01 office-action.pdf",
          ]
        );
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("foreign files holding both names", (it) => {
    it.effect(
      "abandons both intents, fails with a typed error, and leaves nothing pending for the next run",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.update(state.storedFiles, (stored) =>
          HashMap.set(
            HashMap.set(
              stored,
              "folder-acme-uspto-incoming/2026-07-01 office-action.pdf",
              DocumentFileId.make("foreign-1")
            ),
            "folder-acme-uspto-incoming/2026-07-01 office-action (315d429b).pdf",
            DocumentFileId.make("foreign-2")
          )
        );
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));
        const abandoned = A.filter(yield* Ref.get(state.filingRecords), FilingLedgerRecord.guards.FilingAbandoned);

        assertInstanceOf(failure, MailTaggingPortError);
        expect([failure.port, failure.operation]).toStrictEqual(["DocumentStore", "upload"]);
        expect(A.map(abandoned, (line) => [line.fileName, line.reason])).toStrictEqual([
          ["2026-07-01 office-action.pdf", "name-taken"],
          ["2026-07-01 office-action (315d429b).pdf", "name-taken"],
        ]);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended", "FilingAbandoned", "FilingIntended", "FilingAbandoned"],
          pending: [],
          completed: [],
          uploads: [],
          uploadCalls: 2,
        });

        const preview = yield* file({ mode: "dry-run", message: usptoMail });
        const again = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        expect([preview.attachmentsFiled, preview.attachmentsReconciled]).toStrictEqual([1, 0]);
        assertInstanceOf(again, MailTaggingPortError);
        expect((yield* ledgerShape()).lines).toHaveLength(8);
        expect((yield* ledgerShape()).completed).toStrictEqual([]);
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("store keeps the upload and reports failure", (it) => {
    it.effect(
      "reconciles exactly once on the next run and is never wedged",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* Ref.set(state.lyingUpload, O.some(1));
        const failure = yield* Effect.flip(file({ mode: "apply", message: usptoMail }));

        assertInstanceOf(failure, MailTaggingPortError);
        expect((yield* ledgerShape()).lines).toStrictEqual(["FilingIntended"]);

        const rerun = yield* file({ mode: "apply", message: usptoMail });
        const third = yield* file({ mode: "apply", message: usptoMail });

        expect([rerun.attachmentsReconciled, rerun.attachmentsFiled]).toStrictEqual([1, 0]);
        expect([third.attachmentsDeduped, third.attachmentsReconciled]).toStrictEqual([1, 0]);
        expect(yield* ledgerShape()).toStrictEqual({
          lines: ["FilingIntended", "FilingCompleted"],
          pending: [],
          completed: [["2026-07-01 office-action.pdf", "file-1", true]],
          uploads: ["folder-acme-uspto-incoming/2026-07-01 office-action.pdf"],
          uploadCalls: 2,
        });
      })
    );
  });

  it.layer(repeatedPdf(), { timeout: "30 seconds" })("ledger read models", (it) => {
    it.effect(
      "settle an intent only by a later completion for the same content, matter, folder, and name",
      Effect.fnUntraced(function* () {
        const state = yield* World;
        yield* file({ mode: "apply", message: usptoMail });
        const records = yield* Ref.get(state.filingRecords);
        const intents = A.filter(records, FilingLedgerRecord.guards.FilingIntended);
        const completions = completedFilings(records);
        const renamed = A.map(completions, (entry) => FilingLedgerEntry.make({ ...entry, fileName: "elsewhere.pdf" }));

        expect(A.map(records, (record) => record._tag)).toStrictEqual(["FilingIntended", "FilingCompleted"]);
        expect(pendingFilingIntents(records)).toStrictEqual([]);
        expect(pendingFilingIntents(intents)).toStrictEqual(intents);
        expect(pendingFilingIntents(A.appendAll(completions, intents))).toStrictEqual(intents);
        expect(pendingFilingIntents(A.appendAll(intents, renamed))).toStrictEqual(intents);
        expect(completedFilings(intents)).toStrictEqual([]);
      })
    );
  });
});
