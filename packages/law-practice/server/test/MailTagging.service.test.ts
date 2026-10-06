/**
 * The assembled mail-tagging service end to end: the real use-cases, file
 * ledgers, practice-KG directory over a seeded DuckDB file, and the M365 and
 * Box adapters over stubs. Each run builds the service anew, as the entry
 * point does. Every message, matter, and byte is synthetic.
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  ContentSha256,
  DocumentFolderId,
  FilingIntent,
  FilingLedgerRecord,
  FilingLedgerRecordJsonLine,
  MailAttachmentId,
  MailMessageId,
  MatterKey,
  TaggingRunId,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  PracticeKgMatterDocketRow,
  PracticeKgMatterRow,
  PracticeKgMatterTables,
  writeMatterTables,
} from "@beep/law-practice-server";
import {
  MailTaggingServiceConfig,
  MailTaggingServiceLive,
  mailTaggingServiceConfigLayer,
} from "@beep/law-practice-server/MailTagging";
import {
  MailTaggingJob,
  MailTaggingUndo,
  RunMailTaggingRequest,
  UndoMailTaggingRequest,
} from "@beep/law-practice-use-cases/MailTagging";
import {
  GraphAttachment,
  GraphEmailAddress,
  GraphMessage,
  GraphRecipient,
  M365AttachmentCollection,
  M365AttachmentContent,
  M365EnsuredMasterCategories,
  M365MessageCollection,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  boxFiles,
  boxRejection,
  linesOf,
  mailboxUserId,
  makeBoxStub,
  makeM365Stub,
  oneRun,
  Platform,
  temporaryDirectory,
  wellKnownFolders,
  writeText,
} from "./MailTagging.adapters.fixture.ts";
import type { TaggingMode } from "@beep/law-practice-domain/values/MailTagging";
import type { BoxUploadBody } from "./MailTagging.adapters.fixture.ts";

const since = DateTime.makeUnsafe("2026-07-01T00:00:00.000Z");

const tables = PracticeKgMatterTables.make({
  matters: [
    PracticeKgMatterRow.make({
      attributionSource: "official-record",
      client: "1234",
      clientName: null,
      docketCount: 1,
      documentCount: 1,
      epistemicStatus: "derived-from-official-records",
      family: "10001",
      familyKey: "1234.10001",
    }),
  ],
  dockets: [
    PracticeKgMatterDocketRow.make({
      applicationNumbers: ["16123456"],
      docket: "10001US01",
      docketKey: "1234.10001US01",
      documentCount: 1,
      epistemicStatus: "derived-from-official-records",
      familyKey: "1234.10001",
      patentNumbers: [],
    }),
  ],
});

type Outlook = {
  readonly categories: ReadonlyArray<string>;
  readonly version: number;
};

const officeAction = (outlook: Outlook) =>
  GraphMessage.make({
    id: "msg-1",
    receivedDateTime: O.some("2026-07-02T09:00:00Z"),
    subject: O.some("Office action in 1234.10001US01"),
    from: O.some(
      GraphRecipient.make({ emailAddress: O.some(GraphEmailAddress.make({ address: O.some("notices@uspto.gov") })) })
    ),
    categories: O.some(outlook.categories),
    changeKey: O.some(`ck-${outlook.version}`),
    hasAttachments: O.some(true),
  });

// One stubbed mailbox with a single message, and one stubbed Box that counts uploads.
const makeProviders = Effect.fn("MailTaggingServiceTest.makeProviders")(function* (
  answer: (requestBody: BoxUploadBody) => Promise<unknown>
) {
  const outlook = yield* Ref.make<Outlook>({ categories: ["Personal"], version: 1 });
  // The SDK client is promise-based, so its call log is a plain array.
  const uploads: Array<string> = [];
  const message = Effect.map(Ref.get(outlook), officeAction);
  return {
    outlook,
    uploads,
    layer: Layer.merge(
      makeM365Stub({
        getMailFolder: wellKnownFolders,
        listMessages: () => Effect.map(message, (current) => M365MessageCollection.make({ value: [current] })),
        getMessage: () => message,
        updateMessageCategories: (request) =>
          Effect.andThen(
            Ref.update(outlook, (current) => ({ categories: request.categories, version: current.version + 1 })),
            message
          ),
        ensureMasterCategories: () => Effect.succeed(M365EnsuredMasterCategories.make({ created: [], existing: [] })),
        listMessageAttachments: () =>
          Effect.succeed(
            M365AttachmentCollection.make({
              value: [
                GraphAttachment.make({
                  id: "att-1",
                  "@odata.type": O.some("#microsoft.graph.fileAttachment"),
                  name: O.some("office-action.pdf"),
                  size: O.some(3),
                }),
              ],
            })
          ),
        downloadMessageAttachment: () => Effect.succeed(M365AttachmentContent.make({ bytes: Uint8Array.of(1, 2, 3) })),
      }),
      makeBoxStub((requestBody) => {
        uploads.push(`${requestBody.attributes.parent.id}/${requestBody.attributes.name}`);
        return answer(requestBody);
      })
    ),
  };
});

const makeWorkspace = Effect.gen(function* () {
  const path = yield* Path.Path;
  const directory = yield* temporaryDirectory;
  const databasePath = path.join(directory, "practice.duckdb");
  yield* writeMatterTables(databasePath)(tables);
  const folderMapPath = yield* writeText(
    directory,
    "matter-folders.json",
    '[{"familyKey":"1234.10001","usptoIncomingFolderId":"9001","fromClientFolderId":"9002"}]'
  );
  const knownDocumentsPath = yield* writeText(directory, "box-files.jsonl", "");
  const stateDirectory = path.join(directory, "state");
  const boxCallLedgerPath = path.join(directory, "box-api-calls.jsonl");
  return {
    databasePath,
    boxCallLedgerPath,
    tagLedgerPath: path.join(stateDirectory, "tag-ledger.jsonl"),
    filingLedgerPath: path.join(stateDirectory, "filing-ledger.jsonl"),
    checkpointPath: path.join(stateDirectory, "checkpoint.json"),
    config: (runLabel: string) =>
      MailTaggingServiceConfig.make({
        stateDirectory,
        mailboxUserId,
        folderMapPath,
        knownDocumentsPath,
        boxCallLedgerPath,
        runLabel,
      }),
  };
});

type Workspace = Effect.Success<typeof makeWorkspace>;
type Providers = Effect.Success<ReturnType<typeof makeProviders>>["layer"];

// A run builds the whole service in its own scope and releases it when it ends.
const serviceOver = (workspace: Workspace, providers: Providers) => (runLabel: string) =>
  Layer.build(
    MailTaggingServiceLive.pipe(
      Layer.provide(
        Layer.mergeAll(
          providers,
          mailTaggingServiceConfigLayer(workspace.config(runLabel)),
          DuckDb.makeNodeLayer(
            DuckDbConnectionOptions.make({
              databaseOptions: { access_mode: "READ_ONLY" },
              databasePath: workspace.databasePath,
            })
          )
        )
      )
    )
  );

const taggingOver = (workspace: Workspace, providers: Providers) => (mode: TaggingMode, runLabel: string) =>
  oneRun(
    Effect.flatMap(serviceOver(workspace, providers)(runLabel), (services) =>
      Context.get(services, MailTaggingJob).run(
        RunMailTaggingRequest.make({ mode, since, runId: TaggingRunId.make(runLabel) })
      )
    )
  );

const intendedName = "2026-07-02 office-action.pdf";
const encodeFilingRecord = S.encodeEffect(FilingLedgerRecordJsonLine);
const decodeFilingRecord = S.decodeEffect(FilingLedgerRecordJsonLine);

// The line an earlier run wrote before its upload; that run stopped before its completion line.
const interruptedIntent = FilingIntent.make({
  runId: TaggingRunId.make("run-0001"),
  contentSha256: ContentSha256.make("039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81"),
  matterKey: MatterKey.make("1234.10001"),
  destination: "uspto-incoming",
  folderId: DocumentFolderId.make("9001"),
  fileName: intendedName,
  messageId: MailMessageId.make("msg-1"),
  attachmentId: MailAttachmentId.make("att-1"),
  byteLength: 3,
  recordedAt: since,
});

const filingLine: (record: FilingLedgerRecord) => ReadonlyArray<string | boolean | null> = FilingLedgerRecord.match({
  FilingIntended: (intent) => ["FilingIntended", intent.fileName],
  FilingAbandoned: (abandoned) => ["FilingAbandoned", abandoned.fileName, abandoned.reason],
  FilingCompleted: (entry) => ["FilingCompleted", entry.fileName, entry.fileId, entry.reconciled],
});

describe("MailTagging assembled service", () => {
  it.layer(Platform, { timeout: "60 seconds" })("one mailbox, four runs", (it) => {
    it.effect(
      "writes nothing on a dry run, tags, files, and meters on apply, is idempotent on rerun, and undoes",
      Effect.fnUntraced(function* () {
        const workspace = yield* makeWorkspace;
        const providers = yield* makeProviders(() => Promise.resolve(boxFiles("7001")));
        const serviceFor = serviceOver(workspace, providers.layer);
        const tag = taggingOver(workspace, providers.layer);
        const files = Effect.all({
          tags: linesOf(workspace.tagLedgerPath),
          filings: linesOf(workspace.filingLedgerPath),
          checkpoint: linesOf(workspace.checkpointPath),
          boxCalls: linesOf(workspace.boxCallLedgerPath),
        });
        const lineCounts = Effect.map(files, (found) => [
          found.tags.length,
          found.filings.length,
          found.checkpoint.length,
          found.boxCalls.length,
        ]);

        const preview = yield* tag("dry-run", "run-0001");

        expect([preview.matched, preview.attachmentsFiled, preview.wrote]).toStrictEqual([1, 1, false]);
        expect(yield* lineCounts).toStrictEqual([0, 0, 0, 0]);
        expect([providers.uploads.length, (yield* Ref.get(providers.outlook)).version]).toStrictEqual([0, 1]);

        const applied = yield* tag("apply", "run-0002");

        expect([applied.matched, applied.attachmentsFiled, applied.wrote]).toStrictEqual([1, 1, true]);
        expect((yield* Ref.get(providers.outlook)).categories).toStrictEqual(["Personal", "M: 1234.10001", "P: USPTO"]);
        expect(yield* lineCounts).toStrictEqual([1, 2, 1, 1]);
        expect((yield* files).boxCalls).toStrictEqual([
          '{"workstream":"email-tagging","runLabel":"run-0002","calls":1,"at":"1970-01-01T00:00:00.000Z","exact":true}',
        ]);

        const again = yield* tag("apply", "run-0003");

        expect([again.alreadyTagged, again.attachmentsFiled, again.attachmentsDeduped]).toStrictEqual([1, 0, 0]);
        expect(yield* lineCounts).toStrictEqual([1, 2, 1, 1]);
        expect(providers.uploads).toStrictEqual(["9001/2026-07-02 office-action.pdf"]);

        const undone = yield* oneRun(
          Effect.flatMap(serviceFor("undo-0001"), (services) =>
            Context.get(services, MailTaggingUndo).run(
              UndoMailTaggingRequest.make({
                originalRunId: TaggingRunId.make("run-0002"),
                runId: TaggingRunId.make("undo-0001"),
                mode: "apply",
              })
            )
          )
        );

        expect([undone.entries, undone.categoriesRemoved]).toStrictEqual([1, 2]);
        expect((yield* Ref.get(providers.outlook)).categories).toStrictEqual(["Personal"]);
        expect(yield* lineCounts).toStrictEqual([2, 2, 1, 1]);
      })
    );
  });

  it.layer(Platform, { timeout: "60 seconds" })("rerun after an interrupted upload", (it) => {
    it.effect(
      "abandons the held name Box identifies by id only and files under the short-hash name, in two metered calls",
      Effect.fnUntraced(function* () {
        const workspace = yield* makeWorkspace;
        // The earlier upload landed: Box holds the intended name and reports the holder's id, nothing else.
        const providers = yield* makeProviders((requestBody) =>
          requestBody.attributes.name === intendedName
            ? Promise.reject(
                boxRejection({
                  statusCode: 409,
                  code: "item_name_in_use",
                  contextInfo: { conflicts: [{ id: "7001", type: "file", sha1: "never retained", size: 3 }] },
                })
              )
            : Promise.resolve(boxFiles("7002"))
        );
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.makeDirectory(path.dirname(workspace.filingLedgerPath), { recursive: true });
        yield* fs.writeFileString(workspace.filingLedgerPath, `${yield* encodeFilingRecord(interruptedIntent)}\n`);

        const report = yield* taggingOver(workspace, providers.layer)("apply", "run-0002");
        const records = yield* Effect.forEach(yield* linesOf(workspace.filingLedgerPath), (line) =>
          decodeFilingRecord(line)
        );

        expect([report.attachmentsFiled, report.attachmentsReconciled, report.attachmentsDeduped]).toStrictEqual([
          1, 0, 0,
        ]);
        expect(A.map(records, filingLine)).toStrictEqual([
          ["FilingIntended", intendedName],
          ["FilingAbandoned", intendedName, "holder-mismatch"],
          ["FilingIntended", "2026-07-02 office-action (039058c6).pdf"],
          ["FilingCompleted", "2026-07-02 office-action (039058c6).pdf", "7002", false],
        ]);
        expect(providers.uploads).toStrictEqual([
          `9001/${intendedName}`,
          "9001/2026-07-02 office-action (039058c6).pdf",
        ]);
        expect(yield* linesOf(workspace.boxCallLedgerPath)).toStrictEqual([
          '{"workstream":"email-tagging","runLabel":"run-0002","calls":2,"at":"1970-01-01T00:00:00.000Z","exact":true}',
        ]);
      })
    );
  });
});
