import * as NodeURL from "node:url";
import {
  ObservationBackupPolicy,
  ObservationBackupReceipt,
  restoreObservationBackup,
} from "@beep/repo-ai-metrics/observation-backup";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/observation-backup-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const layer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, Reactivity.layer);
const run = Effect.fn("ObservationBackupCrashTest.run")(function* (
  mode: "capture-before" | "capture-after" | "restore-before" | "restore-after"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Config.String("PATH");
  const directory = yield* fs.makeTempDirectoryScoped();
  yield* fs.chmod(directory, 0o700);
  const child = yield* ChildProcess.make("bun", ["--no-env-file", fixture, mode, directory], {
    cwd,
    env: { PATH: path },
    extendEnv: false,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
    killSignal: "SIGKILL",
  });
  while (!(yield* fs.exists(`${directory}/boundary`))) {
    const isRunning1 = yield* child.isRunning;
    expect(isRunning1).toBe(true);
    yield* Effect.sleep("10 millis");
  }
  const readFileString2 = yield* fs.readFileString(`${directory}/boundary`);
  expect(readFileString2).toBe(mode);
  yield* child.kill({ killSignal: "SIGKILL" });
  const exit3 = yield* Effect.exit(child.exitCode);
  expect(Exit.isFailure(exit3)).toBe(true);
  const isRunning4 = yield* child.isRunning;
  expect(isRunning4).toBe(false);
  return { fs, directory };
});
const inspect = Effect.fn("ObservationBackupCrashTest.inspect")(function* (file: string) {
  const sql = yield* SqliteClient.make({ filename: file });
  const value = yield* sql`PRAGMA integrity_check`;
  expect(value).toEqual([{ integrity_check: "ok" }]);
  const value5 = yield* sql`SELECT count(*) AS n FROM observation_intake_pages`;
  expect(value5).toEqual([{ n: 1 }]);
  const value6 = yield* sql`SELECT count(*) AS n FROM observation_source_cursors`;
  expect(value6).toEqual([{ n: 1 }]);
});
it.layer(layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("does not publish a snapshot killed before manifest publication and retains the source", () =>
    Effect.gen(function* () {
      const f = yield* run("capture-before");
      const exists7 = yield* f.fs.exists(`${f.directory}/backup/manifest.json`);
      expect(exists7).toBe(false);
      const exists8 = yield* f.fs.exists(`${f.directory}/backup/manifest.partial`);
      expect(exists8).toBe(true);
      yield* inspect(`${f.directory}/source.sqlite`);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
const decodeObservationBackupReceiptJson = S.decodeEffect(S.fromJsonString(ObservationBackupReceipt));

it.layer(layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("restores a completed snapshot after process death with its independently retained receipt", () =>
    Effect.gen(function* () {
      const f = yield* run("capture-after");
      const receipt = yield* f.fs
        .readFileString(`${f.directory}/receipt.json`)
        .pipe(Effect.flatMap(decodeObservationBackupReceiptJson));
      const verifier = yield* SqliteClient.make({ filename: ":memory:" });
      yield* restoreObservationBackup(
        ObservationBackupPolicy.make({ maxBytes: 1048576 }),
        `${f.directory}/backup`,
        `${f.directory}/restored`,
        receipt
      ).pipe(Effect.provideService(SqlClient.SqlClient, verifier));
      yield* inspect(`${f.directory}/restored/journal.sqlite`);
      yield* inspect(`${f.directory}/source.sqlite`);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("retains the backup and refuses to present an interrupted restoration as complete", () =>
    Effect.gen(function* () {
      const f = yield* run("restore-before");
      const exists9 = yield* f.fs.exists(`${f.directory}/restored/restore.json`);
      expect(exists9).toBe(false);
      const exists10 = yield* f.fs.exists(`${f.directory}/restored/restore.partial`);
      expect(exists10).toBe(true);
      yield* inspect(`${f.directory}/backup/journal.sqlite`);
      const readFileString11 = yield* f.fs.readFileString(`${f.directory}/source.sqlite`);
      expect(readFileString11).toBe("synthetic database corruption");
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reopens a completed restoration after process death despite an unusable original database", () =>
    Effect.gen(function* () {
      const f = yield* run("restore-after");
      const exists12 = yield* f.fs.exists(`${f.directory}/restored/restore.json`);
      expect(exists12).toBe(true);
      yield* inspect(`${f.directory}/restored/journal.sqlite`);
      const readFileString13 = yield* f.fs.readFileString(`${f.directory}/source.sqlite`);
      expect(readFileString13).toBe("synthetic database corruption");
    }).pipe(Effect.timeout("20 seconds"))
  )
);
