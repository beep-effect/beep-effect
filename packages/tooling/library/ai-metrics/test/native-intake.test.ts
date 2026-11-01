import { makeNativeIntakeJournal } from "@beep/repo-ai-metrics/native-intake";
import {
  NativeTraceBatch,
  NativeTraceMetadata,
  NativeTraceRequest,
  projectNativeTraceRequest,
} from "@beep/repo-ai-metrics/native-trace";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const salt = "synthetic-native-intake-salt";
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const fixture = Effect.fn("NativeIntakeTest.fixture")(function* (maxPages = 16) {
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages,
    maxPayloadBytes: 1_048_576,
    maxDatabasePages: 256,
  });
  const batch = Effect.fn("NativeIntakeTest.batch")(function* (tokenCount = 2, suffix = "", invalid = false) {
    const span = {
      traceId: Str.repeat(32)("1"),
      spanId: Str.repeat(16)("2"),
      attributes: [
        { key: "input_tokens", value: { intValue: tokenCount } },
        { key: "input.value", value: { stringValue: `private-prompt${suffix}` } },
      ],
    };
    const body = yield* encodeJsonValue({
      resourceSpans: [
        { scopeSpans: [{ spans: invalid === true ? [span, { traceId: "private-invalid-id" }] : [span] }] },
      ],
    });
    return yield* projectNativeTraceRequest(
      NativeTraceRequest.make({
        routeId: Sha256Hex.make(Str.repeat(64)("b")),
        hashSalt: Redacted.make(salt),
        contentType: "application/json",
        body: new TextEncoder().encode(body),
        approvedModels: [],
        usageConvention: "claude-code",
      })
    );
  });
  return { config, batch, journal: yield* makeNativeIntakeJournal(config) };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("deduplicates occurrences inside one batch and excludes conflicts from canonical export candidates", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const first = yield* batch();
      const metadata = first.spans[0];
      expect(metadata).toBeDefined();
      if (metadata === undefined) return;
      const conflict = NativeTraceMetadata.make({ ...metadata, usage: { ...metadata.usage, input: O.some(999) } });
      const accepted = yield* journal.acceptBatch(
        NativeTraceBatch.make({ ...first, spans: [metadata, metadata, conflict] })
      );
      expect(accepted).toMatchObject({ accepted: 2, rejected: 1, newEvents: 1, duplicates: 1, conflictIndices: [2] });
      assertSome(yield* journal.readNewEvents(accepted.page.receiptId), [metadata]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses altered stored payloads before returning native export candidates", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const accepted = yield* journal.acceptBatch(yield* batch());
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_intake_pages SET payload = payload || ' ' WHERE receipt_id=${accepted.page.receiptId}`;
      expect((yield* journal.readBatch(accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* journal.readNewEvents(accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
      assertSome(yield* journal.receipt(accepted.page.receiptId), accepted);
      expect((yield* journal.acceptBatch(yield* batch()).pipe(Effect.flip)).reason).toBe("storage");
      yield* sql`UPDATE observation_native_receipts SET payload = payload || ' ' WHERE receipt_id=${accepted.page.receiptId}`;
      expect((yield* journal.receipt(accepted.page.receiptId).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* journal.acceptBatch(yield* batch()).pipe(Effect.flip)).reason).toBe("storage");
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("commits a sanitized native batch, unique identity and receipt atomically and replays exactly", () =>
    Effect.gen(function* () {
      const { config, batch, journal } = yield* fixture();
      const projected = yield* batch();
      const receipt = yield* journal.acceptBatch(projected);
      expect(receipt).toMatchObject({
        accepted: 1,
        rejected: 0,
        newEvents: 1,
        duplicates: 0,
        page: { sequence: 1, frames: 1 },
      });
      expect(yield* journal.acceptBatch(projected)).toEqual(receipt);
      assertSome(yield* journal.readBatch(receipt.page.receiptId), projected);
      assertSome(yield* journal.readNewEvents(receipt.page.receiptId), projected.spans);
      const reopened = yield* makeNativeIntakeJournal(config);
      assertSome(yield* reopened.receipt(receipt.page.receiptId), receipt);
      const sql = yield* SqlClient.SqlClient;
      const stored =
        yield* sql`SELECT payload FROM observation_intake_pages UNION ALL SELECT payload FROM observation_native_receipts`;
      const encoded = yield* encodeJsonValue(stored);
      expect(encoded).not.toContain("private-");
      expect(encoded).not.toContain(salt);
      expect((yield* journal.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("records duplicates separately from identity conflicts without replacing canonical metadata", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const firstBatch = yield* batch();
      const first = yield* journal.acceptBatch(firstBatch);
      const duplicate = yield* journal.acceptBatch(yield* batch(2, "changed-uncollected-content"));
      expect(duplicate).toMatchObject({ accepted: 1, newEvents: 0, duplicates: 1, rejected: 0 });
      const conflict = yield* journal.acceptBatch(yield* batch(3));
      expect(conflict).toMatchObject({ accepted: 0, rejected: 1, newEvents: 0, duplicates: 0, conflictIndices: [0] });
      assertSome(yield* journal.readBatch(first.page.receiptId), firstBatch);
      assertSome(yield* journal.readNewEvents(first.page.receiptId), firstBatch.spans);
      assertSome(yield* journal.readNewEvents(duplicate.page.receiptId), []);
      assertSome(yield* journal.readNewEvents(conflict.page.receiptId), []);
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT COUNT(*) AS count FROM observation_native_events`).toEqual([{ count: 1 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("durably records malformed-span rejection counts beside valid native metadata", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const projected = yield* batch(2, "", true);
      const accepted = yield* journal.acceptBatch(projected);
      expect(accepted).toMatchObject({ accepted: 1, rejected: 1, newEvents: 1 });
      assertSome(yield* journal.readBatch(accepted.page.receiptId), projected);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back native index and page if the durable receipt write fails", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER native_receipt_failure BEFORE INSERT ON observation_native_receipts BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`;
      const projected = yield* batch();
      expect((yield* journal.acceptBatch(projected).pipe(Effect.flip)).reason).toBe("storage");
      expect((yield* journal.stats).pages).toBe(0);
      expect(yield* sql`SELECT COUNT(*) AS count FROM observation_native_events`).toEqual([{ count: 0 }]);
      yield* sql`DROP TRIGGER native_receipt_failure`;
      expect(yield* journal.acceptBatch(projected)).toMatchObject({ newEvents: 1, page: { sequence: 1 } });
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("shares capacity with transcript pages and still acknowledges exact native replays at capacity", () =>
    Effect.gen(function* () {
      const { config, batch, journal } = yield* fixture(1);
      const projected = yield* batch();
      const accepted = yield* journal.acceptBatch(projected);
      expect((yield* journal.acceptBatch(yield* batch(3)).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* journal.acceptBatch(projected)).toEqual(accepted);
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();
      const path = `${dir}/events`;
      yield* fs.writeFileString(path, '{"type":"response_item","payload":{"type":"message"}}\n');
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({
          path,
          source: "codex",
          hashSalt: Redacted.make(salt),
          cursor: O.none(),
          maxBytes: 512,
          maxLineBytes: 256,
          maxFrames: 1,
        })
      );
      const transcripts = yield* makeTranscriptIntakeJournal(config);
      expect((yield* transcripts.acceptPage(page, O.none()).pipe(Effect.flip)).reason).toBe("capacity");
      assertNone(yield* transcripts.readCursor("codex", page.cursor.pathHash));
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("reads earlier receipt encoding without expiry indices and preserves exact replay", () =>
    Effect.gen(function* () {
      const { batch, journal } = yield* fixture();
      const projected = yield* batch();
      const accepted = yield* journal.acceptBatch(projected);
      const payload = yield* encodeJsonValue({
        version: accepted.version,
        page: {
          receiptId: accepted.page.receiptId,
          sequence: accepted.page.sequence,
          acceptedAt: accepted.page.acceptedAt,
          payloadBytes: accepted.page.payloadBytes,
          frames: accepted.page.frames,
        },
        accepted: accepted.accepted,
        rejected: accepted.rejected,
        newEvents: accepted.newEvents,
        duplicates: accepted.duplicates,
        conflictIndices: accepted.conflictIndices,
      });
      const digest = yield* hashPublicTextSha256(payload);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE observation_native_receipts SET payload=${payload},payload_hash=${digest} WHERE receipt_id=${accepted.page.receiptId}`;
      assertSome(yield* journal.receipt(accepted.page.receiptId), accepted);
      expect(yield* journal.acceptBatch(projected)).toEqual(accepted);
    })
  )
);
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ file: S.String })]));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("adds epoch zero to an earlier owned page table without changing its receipt or payload", () =>
    Effect.gen(function* () {
      const { config, batch, journal } = yield* fixture();
      const projected = yield* batch();
      const original = yield* journal.acceptBatch(projected);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`ALTER TABLE observation_intake_pages DROP COLUMN evidence_epoch`;
      const files = yield* sql`SELECT file FROM pragma_database_list WHERE name='main'`.pipe(
        Effect.flatMap(decodeArguments)
      );
      // DROP COLUMN creates a temporary SQLite schema on the fixture connection.
      // A real service restart opens a fresh connection to the earlier file.
      yield* Effect.gen(function* () {
        const reopened = yield* makeNativeIntakeJournal(config);
        const reopenedSql = yield* SqlClient.SqlClient;
        expect(yield* reopened.acceptBatch(projected)).toEqual(original);
        assertSome(yield* reopened.readBatch(original.page.receiptId), projected);
        expect(yield* reopenedSql`SELECT evidence_epoch FROM observation_intake_pages`).toEqual([
          { evidence_epoch: 0 },
        ]);
        expect(yield* reopenedSql`PRAGMA integrity_check`).toEqual([{ integrity_check: "ok" }]);
      }).pipe(
        provideScopedLayer(SqliteClient.layer({ filename: files[0].file }).pipe(Layer.provide(Reactivity.layer)))
      );
    })
  )
);
