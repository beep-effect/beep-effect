/**
 * Mirrors every decode literal in the ledger model's JSDoc examples. Docgen
 * typechecks those examples but does not run them, so this is what proves
 * they decode against the schemas they document.
 */

import {
  BackfillCheckpoint,
  BackfillCheckpointJson,
  FilingAbandoned,
  FilingAbandonReason,
  FilingIntent,
  FilingLedgerEntry,
  FilingLedgerRecord,
  FilingLedgerRecordJsonLine,
  TagDecisionSummary,
  TagLedgerRecordJsonLine,
} from "@beep/law-practice-domain/values/MailTagging";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const decodeSummary = S.decodeEffect(TagDecisionSummary);
const decodeTagLine = S.decodeEffect(TagLedgerRecordJsonLine);
const decodeIntent = S.decodeEffect(FilingIntent);
const decodeCompletion = S.decodeEffect(FilingLedgerEntry);
const decodeFilingRecord = S.decodeEffect(FilingLedgerRecord);
const decodeFilingLine = S.decodeEffect(FilingLedgerRecordJsonLine);
const encodeFilingLine = S.encodeEffect(FilingLedgerRecordJsonLine);
const decodeCheckpoint = S.decodeEffect(BackfillCheckpoint);
const decodeCheckpointJson = S.decodeEffect(BackfillCheckpointJson);
const encodeCheckpointJson = S.encodeEffect(BackfillCheckpointJson);
const decodeAbandoned = S.decodeEffect(FilingAbandoned);
const sameFilingRecord = S.toEquivalence(FilingLedgerRecord);

describe("MailTagging ledger model examples", () => {
  it.effect(
    "decodes the tag-ledger examples",
    Effect.fnUntraced(function* () {
      const summary = yield* decodeSummary({ outcome: "MatterUnmatched", reason: "ambiguous" });
      const record = yield* decodeTagLine(
        '{"_tag":"TagUndone","runId":"undo-0003","originalRunId":"run-0003","messageId":"msg-0003","removedCategories":["P: Admin"],"recordedAt":"2026-07-02T12:00:00.000Z"}'
      );

      expect(summary.outcome).toBe("MatterUnmatched");
      expect(record._tag).toBe("TagUndone");
    })
  );

  it.effect(
    "decodes the filing intent, completion, and record examples",
    Effect.fnUntraced(function* () {
      const intent = yield* decodeIntent({
        _tag: "FilingIntended",
        runId: "run-0001",
        contentSha256: emptyDigest,
        matterKey: "acme.10001",
        destination: "uspto-incoming",
        folderId: "100001",
        fileName: "2026-07-01 office-action.pdf",
        messageId: "msg-0001",
        attachmentId: "att-0001",
        byteLength: 1024,
        recordedAt: "2026-07-01T12:00:00.000Z",
      });
      const entry = yield* decodeCompletion({
        _tag: "FilingCompleted",
        runId: "run-0001",
        contentSha256: emptyDigest,
        matterKey: "acme.10001",
        destination: "uspto-incoming",
        folderId: "100001",
        fileId: "200001",
        fileName: "office-action.pdf",
        messageId: "msg-0001",
        attachmentId: "att-0001",
        byteLength: 1024,
        recordedAt: "2026-07-01T12:00:00.000Z",
      });
      const record = yield* decodeFilingRecord({
        _tag: "FilingIntended",
        runId: "run-0001",
        contentSha256: emptyDigest,
        matterKey: "acme.10001",
        destination: "from-client",
        folderId: "100002",
        fileName: "2026-07-01 declaration.pdf",
        messageId: "msg-0003",
        attachmentId: "att-0003",
        byteLength: 512,
        recordedAt: "2026-07-01T12:00:00.000Z",
      });

      expect(intent.fileName).toBe("2026-07-01 office-action.pdf");
      expect([entry.fileName, entry.reconciled]).toStrictEqual(["office-action.pdf", false]);
      expect(
        FilingLedgerRecord.match(record, {
          FilingIntended: () => "intended",
          FilingCompleted: () => "completed",
          FilingAbandoned: () => "abandoned",
        })
      ).toBe("intended");
    })
  );

  it.effect(
    "round-trips both filing-ledger record kinds through one JSONL line",
    Effect.fnUntraced(function* () {
      const completed = yield* decodeFilingLine(
        '{"_tag":"FilingCompleted","runId":"run-0001","contentSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","matterKey":"acme.10001","destination":"uspto-incoming","folderId":"100001","fileId":"200002","fileName":"response.pdf","messageId":"msg-0002","attachmentId":"att-0002","byteLength":2048,"reconciled":true,"recordedAt":"2026-07-01T12:00:00.000Z"}'
      );
      const intended = yield* decodeFilingLine(
        '{"_tag":"FilingIntended","runId":"run-0001","contentSha256":"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","matterKey":"acme.10001","destination":"from-client","folderId":"100002","fileName":"2026-07-01 declaration.pdf","messageId":"msg-0003","attachmentId":"att-0003","byteLength":512,"recordedAt":"2026-07-01T12:00:00.000Z"}'
      );

      expect(completed._tag).toBe("FilingCompleted");
      expect(FilingLedgerRecord.guards.FilingCompleted(completed) && completed.reconciled).toBe(true);
      expect(intended._tag).toBe("FilingIntended");
      expect(sameFilingRecord(yield* decodeFilingLine(yield* encodeFilingLine(completed)), completed)).toBe(true);
      expect(sameFilingRecord(yield* decodeFilingLine(yield* encodeFilingLine(intended)), intended)).toBe(true);
      expect(sameFilingRecord(completed, intended)).toBe(false);

      const abandoned = yield* decodeAbandoned({
        _tag: "FilingAbandoned",
        runId: "run-0001",
        contentSha256: emptyDigest,
        matterKey: "acme.10001",
        folderId: "100001",
        fileName: "2026-07-01 office-action.pdf",
        reason: "name-taken",
        recordedAt: "2026-07-01T12:00:00.000Z",
      });
      const abandonedLine = yield* encodeFilingLine(abandoned);

      expect(abandoned.reason).toBe("name-taken");
      expect(S.is(FilingAbandonReason)("timeout")).toBe(false);
      expect(sameFilingRecord(yield* decodeFilingLine(abandonedLine), abandoned)).toBe(true);
    })
  );

  it.effect(
    "decodes the checkpoint examples",
    Effect.fnUntraced(function* () {
      const fresh = yield* decodeCheckpoint({ since: "2026-07-01T00:00:00.000Z" });
      const saved = yield* decodeCheckpointJson(
        '{"since":"2026-07-01T00:00:00.000Z","lastReceivedAt":null,"lastMessageId":null,"processed":12}'
      );

      expect([fresh.processed, saved.processed]).toStrictEqual([0, 12]);
      expect([fresh.coveredAtBoundary, saved.coveredAtBoundary]).toStrictEqual([[], []]);

      const tied = yield* decodeCheckpointJson(
        '{"since":"2026-07-01T00:00:00.000Z","lastReceivedAt":"2026-07-02T09:00:00.000Z","lastMessageId":"msg-0002","coveredAtBoundary":["msg-0001","msg-0002"],"processed":2}'
      );

      expect(tied.coveredAtBoundary).toStrictEqual(["msg-0001", "msg-0002"]);
      expect(yield* decodeCheckpointJson(yield* encodeCheckpointJson(tied))).toStrictEqual(tied);
    })
  );
});
