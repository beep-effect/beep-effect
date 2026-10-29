import { hashPrivateIdentifier } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver });
const line = '{"type":"response_item","payload":{"type":"message","content":"private-synthetic-prompt"}}\n';
const fixture = Effect.fn("TranscriptIntakeTest.fixture")(function* (maxPages = 16, maxPayloadBytes = 1_048_576) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped();
  const path = `${dir}/events.jsonl`;
  yield* fs.writeFileString(path, line);
  const salt = "synthetic-intake-salt";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages,
    maxPayloadBytes,
    maxDatabasePages: 256,
  });
  const input = TranscriptPageInput.make({
    path,
    source: "codex",
    hashSalt: Redacted.make(salt),
    cursor: O.none(),
    maxBytes: 512,
    maxLineBytes: 128,
    maxFrames: 1,
  });
  const page = yield* readTranscriptPage(input);
  const journal = yield* makeTranscriptIntakeJournal(config);
  return { fs, path, config, input, page, journal };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("commits a sanitized page and its cursor together, then returns the original receipt on replay", () =>
    Effect.gen(function* () {
      const { journal, page, config, path } = yield* fixture();
      const receipt = yield* journal.acceptPage(page, O.none());
      expect(receipt.sequence).toBe(1);
      expect(receipt.frames).toBe(1);
      expect(yield* journal.readCursor(page.cursor.source, page.cursor.pathHash)).toEqual(O.some(page.cursor));
      expect(yield* journal.acceptPage(page, O.none())).toEqual(receipt);
      expect(yield* journal.stats).toMatchObject({ pages: 1, frames: 1 });
      const reinitialized = yield* makeTranscriptIntakeJournal(config);
      expect(yield* reinitialized.readCursor(page.cursor.source, page.cursor.pathHash)).toEqual(O.some(page.cursor));
      expect(yield* reinitialized.acceptPage(page, O.none())).toEqual(receipt);
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql`SELECT payload FROM observation_intake_pages`;
      const text = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(rows);
      expect(text).not.toContain("private-synthetic-prompt");
      expect(text).not.toContain("synthetic-intake-salt");
      expect(text).not.toContain(path);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back page acceptance if the cursor write fails", () =>
    Effect.gen(function* () {
      const { journal, page } = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER synthetic_cursor_failure BEFORE INSERT ON observation_source_cursors BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`;
      expect((yield* journal.acceptPage(page, O.none()).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* journal.stats).toEqual({ pages: 0, payloadBytes: 0, frames: 0 });
      expect(yield* journal.readCursor(page.cursor.source, page.cursor.pathHash)).toEqual(O.none());
      yield* sql`DROP TRIGGER synthetic_cursor_failure`;
      expect((yield* journal.acceptPage(page, O.none())).sequence).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("refuses queue exhaustion without advancing the cursor and still permits exact retries", () =>
    Effect.gen(function* () {
      const { fs, path, journal, page, input } = yield* fixture(1);
      const first = yield* journal.acceptPage(page, O.none());
      yield* fs.writeFileString(path, line, { flag: "a" });
      const next = yield* readTranscriptPage(TranscriptPageInput.make({ ...input, cursor: O.some(page.cursor) }));
      expect((yield* journal.acceptPage(next, O.some(page.cursor)).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* journal.readCursor(page.cursor.source, page.cursor.pathHash)).toEqual(O.some(page.cursor));
      expect(yield* journal.acceptPage(page, O.none())).toEqual(first);
      expect((yield* journal.stats).pages).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rejects stale or foreign source cursors before inserting another page", () =>
    Effect.gen(function* () {
      const { fs, path, journal, page, input } = yield* fixture();
      yield* journal.acceptPage(page, O.none());
      yield* fs.writeFileString(path, line, { flag: "a" });
      const next = yield* readTranscriptPage(TranscriptPageInput.make({ ...input, cursor: O.some(page.cursor) }));
      expect((yield* journal.acceptPage(next, O.none()).pipe(Effect.flip)).reason).toBe("stale-cursor");
      expect((yield* journal.stats).pages).toBe(1);
      expect((yield* journal.acceptPage(next, O.some(page.cursor))).sequence).toBe(2);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("verifies durability mode and database page bounds and refuses silent ownership changes", () =>
    Effect.gen(function* () {
      const { config } = yield* fixture();
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`PRAGMA synchronous`).toEqual([{ synchronous: 3 }]);
      expect(yield* sql`PRAGMA journal_mode`).toEqual([{ journal_mode: "delete" }]);
      expect(yield* sql`PRAGMA max_page_count`).toEqual([{ max_page_count: 256 }]);
      const changed = TranscriptIntakeConfig.make({ ...config, hostId: Sha256Hex.make(Str.repeat(64)("b")) });
      expect((yield* makeTranscriptIntakeJournal(changed).pipe(Effect.flip)).reason).toBe("configuration");
      yield* sql`CREATE TABLE unrelated_work (id INTEGER)`;
      expect((yield* makeTranscriptIntakeJournal(config).pipe(Effect.flip)).reason).toBe("not-owned");
      expect(yield* sql`SELECT COUNT(*) AS count FROM unrelated_work`).toEqual([{ count: 0 }]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds" })((it) =>
  it.effect("rolls back a physical database-capacity failure without acknowledging or moving the source cursor", () =>
    Effect.gen(function* () {
      const { fs, path, input, journal } = yield* fixture(16, 4_194_304);
      const record = '{"type":"response_item","timestamp":"2020-01-02T08:00:00Z","payload":{"type":"message"}}\n';
      yield* fs.writeFileString(path, Str.repeat(4096)(record));
      const page = yield* readTranscriptPage(
        TranscriptPageInput.make({ ...input, maxBytes: 1_048_576, maxFrames: 4096 })
      );
      expect(page.frames).toHaveLength(4096);
      expect((yield* journal.acceptPage(page, O.none()).pipe(Effect.flip)).reason).toBe("storage");
      expect(yield* journal.stats).toEqual({ pages: 0, payloadBytes: 0, frames: 0 });
      expect(yield* journal.readCursor(page.cursor.source, page.cursor.pathHash)).toEqual(O.none());
    })
  )
);
