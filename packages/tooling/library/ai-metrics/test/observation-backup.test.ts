import {
  captureObservationBackup,
  ObservationBackupError,
  ObservationBackupManifest,
  ObservationBackupPolicy,
  ObservationBackupReceipt,
  restoreObservationBackup,
} from "@beep/repo-ai-metrics/observation-backup";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { makeTranscriptIntakeJournal, TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { readTranscriptPage, TranscriptPageInput } from "@beep/repo-ai-metrics/transcript-page";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const policy = ObservationBackupPolicy.make({ maxBytes: 1048576 });
const fixture = Effect.fn("ObservationBackupTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped();
  yield* fs.chmod(directory, 0o700);
  const sql = yield* SqliteClient.make({ filename: `${directory}/source.sqlite` });
  const salt = "synthetic-independent-backup";
  const config = TranscriptIntakeConfig.make({
    hostId: Sha256Hex.make(Str.repeat(64)("a")),
    namespaceId: yield* hashPrivateIdentifier("ai-metrics-hash-salt-namespace/v1", O.some(salt)),
    maxPages: 16,
    maxPayloadBytes: 1048576,
    maxDatabasePages: 512,
  });
  const journal = yield* makeTranscriptIntakeJournal(config).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  const source = `${directory}/events.jsonl`;
  const line = '{"type":"response_item","payload":{"type":"message","content":"synthetic-private-backup-prompt"}}\n';
  yield* fs.writeFileString(source, line);
  const input = TranscriptPageInput.make({
    path: source,
    source: "codex",
    hashSalt: Redacted.make(salt),
    cursor: O.none(),
    maxBytes: 512,
    maxLineBytes: 256,
    maxFrames: 1,
  });
  const page = yield* readTranscriptPage(input);
  const accepted = yield* journal.acceptPage(page, O.none());
  const capture = (target: string) =>
    captureObservationBackup(config, policy, target).pipe(Effect.provideService(SqlClient.SqlClient, sql));
  return { fs, directory, sql, config, journal, source, line, input, page, accepted, capture };
});
const layers = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, Reactivity.layer);
const encodeObservationBackupManifestJson = S.encodeEffect(S.fromJsonString(ObservationBackupManifest));

it.layer(layers, { timeout: "30 seconds", excludeTestServices: true })("Independent observation backups", (it) => {
  it.effect(
    "restores original receipts and cursors into a distinct database without rewinding later source observations",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const before = yield* f.fs.readFile(`${f.directory}/source.sqlite`);
        const receipt = yield* f.capture(`${f.directory}/backup`);
        expect(yield* f.fs.readFile(`${f.directory}/source.sqlite`)).toEqual(before);
        expect(receipt.manifest.bytes).toBeLessThanOrEqual(policy.maxBytes);
        yield* f.fs.writeFileString(f.source, f.line, { flag: "a" });
        const second = yield* readTranscriptPage(
          TranscriptPageInput.make({ ...f.input, cursor: O.some(f.page.cursor) })
        );
        yield* f.journal.acceptPage(second, O.some(f.page.cursor));
        const verifier = yield* SqliteClient.make({ filename: ":memory:" });
        expect(
          yield* restoreObservationBackup(policy, `${f.directory}/backup`, `${f.directory}/restored`, receipt).pipe(
            Effect.provideService(SqlClient.SqlClient, verifier)
          )
        ).toEqual(receipt);
        expect((yield* f.journal.stats).pages).toBe(2);
        const reopened = yield* SqliteClient.make({ filename: `${f.directory}/restored/journal.sqlite` });
        const recovered = yield* makeTranscriptIntakeJournal(f.config).pipe(
          Effect.provideService(SqlClient.SqlClient, reopened)
        );
        expect((yield* recovered.stats).pages).toBe(1);
        expect(yield* recovered.acceptPage(f.page, O.none())).toEqual(f.accepted);
        assertSome(yield* recovered.readCursor(f.page.cursor.source, f.page.cursor.pathHash), f.page.cursor);
        expect(new TextDecoder().decode(yield* f.fs.readFile(`${f.directory}/backup/journal.sqlite`))).not.toContain(
          "synthetic-private-backup-prompt"
        );
        expect(yield* verifier`PRAGMA database_list`).toEqual([{ seq: 0, name: "main", file: "" }]);
        expect(yield* f.fs.exists(`${f.directory}/restored/restore.json`)).toBe(true);
      })
  );
  it.effect("refuses existing destinations, exposed parents and foreign journal tables without modifying them", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.fs.makeDirectory(`${f.directory}/existing`);
      yield* f.fs.writeFileString(`${f.directory}/existing/keep`, "preserve");
      expect((yield* f.capture(`${f.directory}/existing`).pipe(Effect.flip)).reason).toBe("destination");
      expect(yield* f.fs.readFileString(`${f.directory}/existing/keep`)).toBe("preserve");
      yield* f.fs.makeDirectory(`${f.directory}/exposed`, { mode: 0o755 });
      // Make the hostile fixture explicit even under a private service umask.
      yield* f.fs.chmod(`${f.directory}/exposed`, 0o755);
      expect((yield* f.capture(`${f.directory}/exposed/backup`).pipe(Effect.flip)).reason).toBe("destination");
      yield* f.sql`CREATE TABLE foreign_data (payload TEXT)`;
      expect((yield* f.capture(`${f.directory}/foreign`).pipe(Effect.flip)).reason).toBe("configuration");
      expect(yield* f.fs.exists(`${f.directory}/foreign`)).toBe(false);
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  );
  it.effect(
    "detects modified backup bytes and a substituted caller receipt before creating a restore destination",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const receipt = yield* f.capture(`${f.directory}/backup`);
        const verifier = yield* SqliteClient.make({ filename: ":memory:" });
        const restore = (value: ObservationBackupReceipt) =>
          restoreObservationBackup(policy, `${f.directory}/backup`, `${f.directory}/restored`, value).pipe(
            Effect.provideService(SqlClient.SqlClient, verifier)
          );
        const substituted = ObservationBackupReceipt.make({
          ...receipt,
          manifestDigest: Sha256Hex.make(Str.repeat(64)("b")),
        });
        expect((yield* restore(substituted).pipe(Effect.flip)).reason).toBe("integrity");
        const bytes = yield* f.fs.readFile(`${f.directory}/backup/journal.sqlite`);
        bytes[100] = (bytes[100] ?? 0) ^ 1;
        yield* f.fs.writeFile(`${f.directory}/backup/journal.sqlite`, bytes);
        expect((yield* restore(receipt).pipe(Effect.flip)).reason).toBe("integrity");
        expect(yield* f.fs.exists(`${f.directory}/restored`)).toBe(false);
        expect((yield* f.journal.stats).pages).toBe(1);
      })
  );
  it.effect("refuses a digest-valid older snapshot containing an unexpected table before publishing restoration", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const original = yield* f.capture(`${f.directory}/backup`);
      const originalSource = yield* f.fs.readFile(`${f.directory}/source.sqlite`);
      // Model a correctly checksummed receipt created by an older permissive
      // capture implementation, rather than an untrusted receipt substitution.
      yield* Effect.gen(function* () {
        const client = yield* SqliteClient.make({ filename: `${f.directory}/backup/journal.sqlite` });
        yield* client`CREATE TABLE unexpected_historical_table (value TEXT)`;
      }).pipe(Effect.scoped);
      const bytes = yield* f.fs.readFile(`${f.directory}/backup/journal.sqlite`);
      const manifest = ObservationBackupManifest.make({
        ...original.manifest,
        snapshotDigest: yield* S.decodeEffect(Sha256HexFromBytes)(bytes),
        bytes: bytes.length,
      });
      const encoded = yield* encodeObservationBackupManifestJson(manifest);
      yield* f.fs.writeFileString(`${f.directory}/backup/manifest.json`, encoded);
      const receipt = ObservationBackupReceipt.make({ manifest, manifestDigest: yield* hashPublicTextSha256(encoded) });
      const verifier = yield* SqliteClient.make({ filename: ":memory:" });
      expect(
        yield* restoreObservationBackup(policy, `${f.directory}/backup`, `${f.directory}/refused`, receipt).pipe(
          Effect.provideService(SqlClient.SqlClient, verifier),
          Effect.isFailure
        )
      ).toBe(true);
      expect(yield* f.fs.exists(`${f.directory}/refused/restore.json`)).toBe(false);
      expect(yield* f.fs.readFile(`${f.directory}/source.sqlite`)).toEqual(originalSource);
      expect(yield* f.fs.readFile(`${f.directory}/backup/journal.sqlite`)).toEqual(bytes);
    })
  );
  it.effect("refuses a source beyond the snapshot ceiling while preserving the preceding generation", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.capture(`${f.directory}/first`);
      const first = yield* f.fs.readFile(`${f.directory}/first/journal.sqlite`);
      yield* f.sql`INSERT INTO observation_page_dispositions(receipt_id,payload,digest) VALUES('synthetic-capacity',zeroblob(1200000),'synthetic')`;
      expect((yield* f.capture(`${f.directory}/too-large`).pipe(Effect.flip)).reason).toBe("capacity");
      expect(yield* f.fs.exists(`${f.directory}/too-large`)).toBe(false);
      expect(yield* f.fs.readFile(`${f.directory}/first/journal.sqlite`)).toEqual(first);
      expect((yield* f.journal.stats).pages).toBe(1);
    })
  );
  it.effect("recovers through an independent client after the original database is closed and damaged", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const original = `${f.directory}/damaged.sqlite`;
      const recovery = yield* Effect.gen(function* () {
        const client = yield* SqliteClient.make({ filename: original });
        const journal = yield* makeTranscriptIntakeJournal(f.config).pipe(
          Effect.provideService(SqlClient.SqlClient, client)
        );
        const accepted = yield* journal.acceptPage(f.page, O.none());
        const receipt = yield* captureObservationBackup(f.config, policy, `${f.directory}/independent`).pipe(
          Effect.provideService(SqlClient.SqlClient, client)
        );
        return { accepted, receipt };
      }).pipe(Effect.scoped);
      yield* f.fs.writeFileString(original, "synthetic database corruption");
      const verifier = yield* SqliteClient.make({ filename: ":memory:" });
      yield* restoreObservationBackup(
        policy,
        `${f.directory}/independent`,
        `${f.directory}/recovered`,
        recovery.receipt
      ).pipe(Effect.provideService(SqlClient.SqlClient, verifier));
      const client = yield* SqliteClient.make({ filename: `${f.directory}/recovered/journal.sqlite` });
      const journal = yield* makeTranscriptIntakeJournal(f.config).pipe(
        Effect.provideService(SqlClient.SqlClient, client)
      );
      expect(yield* journal.acceptPage(f.page, O.none())).toEqual(recovery.accepted);
      assertSome(yield* journal.readCursor(f.page.cursor.source, f.page.cursor.pathHash), f.page.cursor);
      expect(yield* f.fs.readFileString(original)).toBe("synthetic database corruption");
    })
  );
  it.effect(
    "leaves no published manifest after an injected publication failure and preserves the prior generation",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.capture(`${f.directory}/first`);
        const prior = yield* f.fs.readFile(`${f.directory}/first/journal.sqlite`);
        const failing = new Proxy(f.fs, {
          get(target, key, receiver) {
            if (key === "rename") return () => ObservationBackupError.make({ reason: "storage" }).pipe(Effect.fail);
            return Reflect.get(target, key, receiver);
          },
        });
        expect(
          (yield* f
            .capture(`${f.directory}/failed`)
            .pipe(Effect.provideService(FileSystem.FileSystem, failing), Effect.flip)).reason
        ).toBe("storage");
        expect(yield* f.fs.exists(`${f.directory}/failed/manifest.json`)).toBe(false);
        expect(yield* f.fs.exists(`${f.directory}/failed/manifest.partial`)).toBe(true);
        expect(yield* f.fs.readFile(`${f.directory}/first/journal.sqlite`)).toEqual(prior);
        expect((yield* f.journal.stats).pages).toBe(1);
      })
  );
});
