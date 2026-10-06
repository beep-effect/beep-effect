/**
 * The assembled mail-tagging service end to end: the real use-cases, file
 * ledgers, practice-KG directory over a seeded DuckDB file, and the M365 and
 * Box adapters over stubs. Each run builds the service anew, as the entry
 * point does. Every message, matter, and byte is synthetic.
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { TaggingRunId } from "@beep/law-practice-domain/values/MailTagging";
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
import { Context, Effect, Layer, Path, Ref } from "effect";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import {
  boxFiles,
  linesOf,
  mailboxUserId,
  makeBoxStub,
  makeM365Stub,
  oneRun,
  Platform,
  temporaryDirectory,
  writeText,
} from "./MailTagging.adapters.fixture.ts";
import type { TaggingMode } from "@beep/law-practice-domain/values/MailTagging";

const since = DateTime.makeUnsafe("2026-07-01T00:00:00.000Z");

const tables = PracticeKgMatterTables.make({
  matters: [
    PracticeKgMatterRow.make({
      attributionSource: "official-record",
      client: "1234",
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
const makeProviders = Effect.gen(function* () {
  const outlook = yield* Ref.make<Outlook>({ categories: ["Personal"], version: 1 });
  // The SDK client is promise-based, so its call log is a plain array.
  const uploads: Array<string> = [];
  const message = Effect.map(Ref.get(outlook), officeAction);
  return {
    outlook,
    uploads,
    layer: Layer.merge(
      makeM365Stub({
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
        return Promise.resolve(boxFiles("7001"));
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

describe("MailTagging assembled service", () => {
  it.layer(Platform, { timeout: "60 seconds" })("one mailbox, four runs", (it) => {
    it.effect(
      "writes nothing on a dry run, tags, files, and meters on apply, is idempotent on rerun, and undoes",
      Effect.fnUntraced(function* () {
        const workspace = yield* makeWorkspace;
        const providers = yield* makeProviders;
        // A run builds the whole service in its own scope and releases it when it ends.
        const serviceFor = (runLabel: string) =>
          Layer.build(
            MailTaggingServiceLive.pipe(
              Layer.provide(
                Layer.mergeAll(
                  providers.layer,
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
        const tag = (mode: TaggingMode, runLabel: string) =>
          oneRun(
            Effect.flatMap(serviceFor(runLabel), (services) =>
              Context.get(services, MailTaggingJob).run(
                RunMailTaggingRequest.make({ mode, since, runId: TaggingRunId.make(runLabel) })
              )
            )
          );
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
        expect(yield* lineCounts).toStrictEqual([1, 1, 1, 1]);
        expect((yield* files).boxCalls).toStrictEqual([
          '{"workstream":"email-tagging","runLabel":"run-0002","calls":1,"at":"1970-01-01T00:00:00.000Z","exact":true}',
        ]);

        const again = yield* tag("apply", "run-0003");

        expect([again.alreadyTagged, again.attachmentsFiled, again.attachmentsDeduped]).toStrictEqual([1, 0, 0]);
        expect(yield* lineCounts).toStrictEqual([1, 1, 1, 1]);
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
        expect(yield* lineCounts).toStrictEqual([2, 1, 1, 1]);
      })
    );
  });
});
