/**
 * The SQLite history store: the shared store contract, migrations, error
 * translation and degrade causes, and the AC-H9 twelve-writer test. The suite
 * runs under Bun only (the driver imports `bun:sqlite`).
 */
import { HistoryConfig } from "@beep/gate-report/History";
import { HistoryRunsQuery } from "@beep/repo-gate-run/GateHistoryRecord";
import {
  GateHistorySqliteOptions,
  layerSqlite,
  SCHEMA_VERSION,
  translateStoreError,
} from "@beep/repo-gate-run/GateHistorySqlite";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlError from "effect/sql/SqlError";
import * as TestClock from "effect/testing/TestClock";
import { answerFor, historyContract, ingestAll, keyOf, laneA, reportOf, testItem } from "./support/historyContract.ts";
import { historyWriterPath } from "./support/historyWriter.ts";

const isBunRuntime = P.isNotUndefined(process.versions.bun);

const sqliteLayer = (filename: string, config: HistoryConfig = HistoryConfig.make({}), busyTimeoutMs = 5000) =>
  layerSqlite(GateHistorySqliteOptions.make({ filename, config, busyTimeoutMs }));

const tempDir = Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectoryScoped({ prefix: "gate-history-" }));

const withStoreAt = <A, E>(layer: Layer.Layer<GateHistoryStore>, effect: Effect.Effect<A, E, GateHistoryStore>) =>
  layer.pipe(
    Layer.build,
    Effect.flatMap((context) => Effect.provideContext(effect, context))
  );

const fastRetry = HistoryConfig.make({ retryAttempts: 2, retryBaseMs: 5 });

describe.skipIf(!isBunRuntime)("GateHistorySqlite (Bun runtime)", () => {
  historyContract({ name: "SQLite", layerFor: (config) => sqliteLayer(":memory:", config) });

  it.layer(NodeServices.layer, { timeout: "60 seconds" })("on a store file", (it) => {
    it.effect("migrates once: a reopened store keeps its runs and its schema version", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const dir = yield* tempDir;
        const file = path.join(dir, "store.sqlite");
        yield* withStoreAt(
          sqliteLayer(file),
          ingestAll([{ runId: "r1", at: 1000, items: [testItem({ name: "adds", outcome: "failed" })] }])
        );
        const runs = yield* withStoreAt(
          sqliteLayer(file),
          Effect.flatMap(GateHistoryStore, (store) =>
            store.runs(HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob" }))
          )
        );
        assert.deepStrictEqual(
          A.map(runs, (run) => run.runId),
          ["r1"]
        );
        const { Database } = yield* Effect.promise(() => import("bun:sqlite"));
        const version = yield* Effect.sync(() => {
          const db = new Database(file, { readonly: true });
          const row = db.query("PRAGMA user_version").get() as { readonly user_version: number };
          db.close();
          return row.user_version;
        });
        assert.strictEqual(version, SCHEMA_VERSION);
      })
    );

    it.effect("a missing directory fails the use with open-failed, not the layer", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const dir = yield* tempDir;
        const file = path.join(dir, "missing", "store.sqlite");
        const error = yield* withStoreAt(
          sqliteLayer(file),
          Effect.flip(answerFor({ runId: "r1", at: 1000, items: [] }))
        );
        assert.strictEqual(error.reason, "open-failed");
      })
    );

    it.effect("a file that is not a database fails with a typed reason", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const dir = yield* tempDir;
        const file = path.join(dir, "store.sqlite");
        yield* fs.writeFileString(file, Str.repeat(20)("this is not a database file, it is plain text padding "));
        const error = yield* withStoreAt(
          sqliteLayer(file, fastRetry),
          Effect.flip(answerFor({ runId: "r1", at: 1000, items: [] }))
        );
        assert.include(["open-failed", "migrate-failed"], error.reason);
      })
    );

    it.effect("a store an exclusive holder keeps from readers fails with open-busy after the bounded retries", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const dir = yield* tempDir;
        const file = path.join(dir, "store.sqlite");
        const { Database } = yield* Effect.promise(() => import("bun:sqlite"));
        const holder = new Database(file);
        holder.run("PRAGMA journal_mode = WAL");
        holder.run("PRAGMA locking_mode = EXCLUSIVE");
        holder.run("BEGIN EXCLUSIVE");
        holder.run("CREATE TABLE lock_holder (x)");
        // The retry schedule sleeps on the real clock.
        const error = yield* withStoreAt(
          sqliteLayer(file, HistoryConfig.make({ retryAttempts: 2, retryBaseMs: 5, deadlineMs: 20 })),
          Effect.flip(answerFor({ runId: "r2", at: 2000, items: [] }))
        ).pipe(TestClock.withLive, Effect.ensuring(Effect.sync(() => holder.close())));
        assert.strictEqual(error.reason, "open-busy");
      })
    );

    it.effect("a migrated store still answers while another connection writes, and a write waits then fails busy", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const dir = yield* tempDir;
        const file = path.join(dir, "store.sqlite");
        const failing = { runId: "r1", at: 1000, items: [testItem({ name: "adds", outcome: "failed" })] };
        const { Database } = yield* Effect.promise(() => import("bun:sqlite"));
        const outcome = yield* withStoreAt(
          sqliteLayer(file, HistoryConfig.make({}), 10),
          Effect.gen(function* () {
            yield* ingestAll([failing]);
            const holder = new Database(file);
            holder.run("BEGIN IMMEDIATE");
            holder.run("CREATE TABLE writer_holder (x)");
            const answer = yield* answerFor({ ...failing, runId: "r2", at: 2000 });
            const store = yield* GateHistoryStore;
            const write = yield* Effect.flip(store.ingest(reportOf({ ...failing, runId: "r2", at: 2000 }), laneA));
            holder.close();
            return { answer, write };
          })
        );
        assert.strictEqual(R.get(outcome.answer.labels, keyOf("adds")).pipe(O.getOrNull), "persistent");
        assert.strictEqual(outcome.write.reason, "open-busy");
      })
    );

    it.effect("AC-H9: twelve writers open a missing store at once and record 25 runs each", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const dir = yield* tempDir;
        const file = path.join(dir, "store.sqlite");
        const writer = historyWriterPath;
        const exits = yield* Effect.forEach(
          A.range(1, 12),
          (index) =>
            Effect.gen(function* () {
              const handle = yield* spawner.spawn(
                ChildProcess.make(process.execPath, [writer, file, `${index}`], { extendEnv: true })
              );
              const output = yield* handle.all.pipe(Stream.decodeText, Stream.mkString);
              const exitCode = yield* handle.exitCode;
              return { exitCode, output };
            }),
          { concurrency: "unbounded" }
        );
        assert.deepStrictEqual(
          A.map(exits, (exit) => exit.exitCode),
          A.replicate(0, 12),
          A.join(
            A.map(exits, (exit) => exit.output),
            "\n"
          )
        );
        const runs = yield* withStoreAt(
          sqliteLayer(file),
          Effect.flatMap(GateHistoryStore, (store) =>
            store.runs(HistoryRunsQuery.make({ gate: "test", subject: "@beep/glob" }))
          )
        );
        assert.strictEqual(A.length(runs), 300);
        assert.isTrue(A.every(runs, (run) => run.observations === 3));
      })
    );
  });
});

describe("store error translation", () => {
  const busy = SqlError.SqlError.make({
    reason: SqlError.LockTimeoutError.make({ cause: new Error("database is locked"), message: "database is locked" }),
  });

  it("names contention open-busy, directly or as a driver error's cause, and keeps other reasons", () => {
    assert.strictEqual(translateStoreError("write-failed")(busy).reason, "open-busy");
    assert.strictEqual(translateStoreError("open-failed")({ cause: busy, message: "connect" }).reason, "open-busy");
    assert.strictEqual(translateStoreError("open-failed")({ cause: "native" }).reason, "open-failed");
    assert.strictEqual(translateStoreError("migrate-failed")("plain text").message, "plain text");
    assert.strictEqual(translateStoreError("write-failed")(new Error("disk I/O error")).message, "disk I/O error");
  });

  it("defaults the options to the history defaults and the driver's busy timeout", () => {
    const options = GateHistorySqliteOptions.make({ filename: ":memory:" });
    assert.deepStrictEqual([options.config.window, options.busyTimeoutMs], [10, 5000]);
  });
});
