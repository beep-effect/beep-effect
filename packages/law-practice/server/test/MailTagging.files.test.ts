/**
 * File-backed mail-tagging state over a scoped temporary directory. Every
 * record is synthetic.
 */

import {
  BackfillCheckpoint,
  ContentSha256,
  DocumentFileId,
  DocumentFolderId,
  FilingLedgerEntry,
  MailAttachmentId,
  MailConversationId,
  MailMessageId,
  MatterKey,
  MatterUnmatched,
  summarizeDecision,
  TaggingRunId,
  TagLedgerEntry,
  TagLedgerRecord,
  TagUndoEntry,
} from "@beep/law-practice-domain/values/MailTagging";
import {
  MailTaggingStateConfig,
  MailTaggingStateFile,
  MailTaggingStateLocation,
} from "@beep/law-practice-server/MailTagging";
import {
  BackfillCheckpointStore,
  FilingLedger,
  MailTaggingStateError,
  TagLedger,
} from "@beep/law-practice-use-cases/MailTagging";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const recordedAt = DateTime.makeUnsafe("2026-07-01T12:00:00.000Z");
const runId = TaggingRunId.make("run-0001");
const messageId = MailMessageId.make("msg-0001");
const acme = MatterKey.make("acme.10001");

const applied = TagLedgerEntry.make({
  runId,
  messageId,
  conversationId: O.some(MailConversationId.make("conv-0001")),
  addedCategories: ["P: USPTO"],
  decision: summarizeDecision(MatterUnmatched.make({ reason: "no-signal", practiceCategories: ["P: USPTO"] })),
  recordedAt,
});
const undone = TagUndoEntry.make({
  runId: TaggingRunId.make("undo-0001"),
  originalRunId: runId,
  messageId,
  removedCategories: ["P: USPTO"],
  recordedAt,
});
const filing = FilingLedgerEntry.make({
  contentSha256: ContentSha256.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  matterKey: acme,
  destination: "uspto-incoming",
  folderId: DocumentFolderId.make("folder-acme-10001"),
  fileId: DocumentFileId.make("file-1"),
  fileName: "2026-07-01 office-action.pdf",
  messageId,
  attachmentId: MailAttachmentId.make("att-1"),
  byteLength: 4,
  recordedAt,
});
const checkpoint = (processed: number) =>
  BackfillCheckpoint.make({
    since: DateTime.makeUnsafe("2026-07-01T00:00:00.000Z"),
    lastReceivedAt: O.some(recordedAt),
    lastMessageId: O.some(messageId),
    processed,
  });

const Platform = Layer.mergeAll(BunFileSystem.layer, BunPath.layer);

const TemporaryLocation = Layer.effect(
  MailTaggingStateLocation,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "mail-tagging-state-" });
    return MailTaggingStateConfig.make({ stateDirectory: path.join(root, "nested", "state") });
  })
);

const state = () =>
  Layer.fresh(MailTaggingStateFile.pipe(Layer.provideMerge(TemporaryLocation), Layer.provideMerge(Platform)));

const stateFile = Effect.fn("MailTaggingFilesTest.stateFile")(function* (name: string) {
  const path = yield* Path.Path;
  const location = yield* MailTaggingStateLocation;
  return path.join(location.stateDirectory, name);
});

const sameRecords = S.toEquivalence(S.Array(TagLedgerRecord));
const sameFilings = S.toEquivalence(S.Array(FilingLedgerEntry));
const sameCheckpoint = S.toEquivalence(BackfillCheckpoint);

describe("MailTagging file-backed state", () => {
  it.layer(state(), { timeout: "30 seconds" })("tag ledger", (it) => {
    it.effect(
      "reads an empty ledger before the first append and round-trips appended lines in order",
      Effect.fnUntraced(function* () {
        const ledger = yield* TagLedger;
        const fs = yield* FileSystem.FileSystem;

        expect(yield* ledger.records).toStrictEqual([]);

        yield* ledger.append(applied);
        yield* ledger.append(undone);
        const text = yield* fs.readFileString(yield* stateFile("tag-ledger.jsonl"));

        expect(sameRecords(yield* ledger.records, [applied, undone])).toBe(true);
        expect(A.filter(Str.split(text, "\n"), Str.isNonEmpty)).toHaveLength(2);
        expect(Str.endsWith("\n")(text)).toBe(true);
      })
    );
  });

  it.layer(state(), { timeout: "30 seconds" })("filing ledger", (it) => {
    it.effect(
      "round-trips filing entries through filing-ledger.jsonl",
      Effect.fnUntraced(function* () {
        const ledger = yield* FilingLedger;
        const fs = yield* FileSystem.FileSystem;

        yield* ledger.append(filing);
        yield* ledger.append(filing);

        expect(sameFilings(yield* ledger.entries, [filing, filing])).toBe(true);
        expect(yield* fs.exists(yield* stateFile("filing-ledger.jsonl"))).toBe(true);
      })
    );
  });

  it.layer(state(), { timeout: "30 seconds" })("corrupt line", (it) => {
    it.effect(
      "fails closed naming the file and line, never the content",
      Effect.fnUntraced(function* () {
        const ledger = yield* TagLedger;
        const fs = yield* FileSystem.FileSystem;
        yield* ledger.append(applied);
        yield* fs.writeFileString(yield* stateFile("tag-ledger.jsonl"), '{"secret":"do-not-echo"}\n', { flag: "a" });
        yield* ledger.append(undone);
        const error = yield* Effect.flip(ledger.records);

        expect(error).toBeInstanceOf(MailTaggingStateError);
        expect(error.failure).toBe("corrupt");
        expect(error.store).toBe("tag-ledger");
        expect(error.file).toBe("tag-ledger.jsonl");
        assertSome(error.line, 2);
        expect(error.message).toBe("tag-ledger.jsonl line 2 did not decode");
        assertNone(error.cause);
      })
    );
  });

  it.layer(state(), { timeout: "30 seconds" })("checkpoint", (it) => {
    it.effect(
      "loads none before the first save and replaces the document on every save",
      Effect.fnUntraced(function* () {
        const store = yield* BackfillCheckpointStore;
        const fs = yield* FileSystem.FileSystem;
        const target = yield* stateFile("checkpoint.json");

        assertNone(yield* store.load);

        yield* store.save(checkpoint(2));
        yield* store.save(checkpoint(5));
        const loaded = yield* store.load;

        expect(A.map(O.toArray(loaded), (saved) => sameCheckpoint(saved, checkpoint(5)))).toStrictEqual([true]);
        expect(yield* fs.exists(`${target}.tmp`)).toBe(false);

        yield* fs.writeFileString(target, "{not json");
        const error = yield* Effect.flip(store.load);

        expect(error.failure).toBe("corrupt");
        expect(error.file).toBe("checkpoint.json");
        assertNone(error.line);
      })
    );
  });
});
