import {
  AttachmentFiler,
  FileAttachmentsRequest,
  MailTaggingPortError,
} from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { Effect, Ref } from "effect";
import * as A from "effect/Array";
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
};

const file = Effect.fn("MailTaggingFilerTest.file")(function* (filing: Filing) {
  const filer = yield* AttachmentFiler;
  return yield* filer.file(
    FileAttachmentsRequest.make({
      envelope: filing.message,
      matter: filing.matter ?? acmeEntry,
      taxonomy,
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
        const entries = yield* Ref.get(state.filingEntries);
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
        expect(A.map(yield* Ref.get(state.filingEntries), (entry) => entry.destination)).toStrictEqual(["from-client"]);
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
        expect(yield* Ref.get(state.filingEntries)).toStrictEqual([]);
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
