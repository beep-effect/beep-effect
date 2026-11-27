import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { RecordTarget, recordLocation } from "@beep/repo-gate-record/GatePaths";
import { GateRecordReadError, GateRecordWriteError, recordProvenance } from "@beep/repo-gate-record/GateRecordFile";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ROOT_RUNS_KEPT } from "@beep/repo-gate-record/RunId";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type { Vitest } from "@effect/vitest";

const encoder = new TextEncoder();

const record = (runId: string) =>
  GateRecord.make({
    generatedAt: DateTime.makeUnsafe(1000),
    report: GateReport.make({
      gate: "test",
      subject: "@beep/glob",
      itemKind: "test",
      runId,
      startedAt: DateTime.makeUnsafe(0),
      durationMs: 12,
      inputFingerprint: "fingerprint",
      reason: "passed",
      outcome: "all-pass",
      units: [],
      items: [],
      totals: Totals.make({ collected: 1, passed: 1 }),
    }),
  });

const isolatedPackageTarget = (name: string) =>
  RecordTarget.cases.PackageTarget.make({ packageDir: `packages/${name}`, gate: "test" });
const rootTarget = (runId: string) => RecordTarget.cases.RootTarget.make({ gate: "test", runId });
const runIds = (count: number) => A.makeBy(count, (index) => `run-${index + 10}`);

const LOG_TEXT = "line one\nline two ✓\n";
const logStream = Stream.make(encoder.encode("line one\n"), encoder.encode("line two ✓\n"));

const drawsInTurnThenRepeatsLast = (values: A.NonEmptyReadonlyArray<number>): Random.Random => {
  let drawn = 0;
  return {
    nextDoubleUnsafe: () => A.getUnsafe(values, Math.min(drawn++, values.length - 1)),
    nextIntUnsafe: () => drawn,
  };
};

const sameRecord = S.toEquivalence(GateRecord);

const storeRules = (it: Vitest.MethodsNonLive<GateRecordStore>) => {
  it.effect("writes the whole raw stream and counts its bytes", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      const written = yield* store.writeLog(isolatedPackageTarget("log"), logStream);
      assert.strictEqual(written.path, "packages/log/.beep/gates/test/report.log");
      assert.strictEqual(written.bytes, encoder.encode(LOG_TEXT).length);
    })
  );

  it.effect("reads back the record it wrote, with its original run id", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      const written = yield* store.writeRecord(isolatedPackageTarget("read"), record("r1"));
      const read = yield* store.readRecord(isolatedPackageTarget("read"));
      assert.strictEqual(written.path, recordLocation(isolatedPackageTarget("read")).record);
      assert.isTrue(sameRecord(read, record("r1")));
      assert.strictEqual(recordProvenance(read, "r2"), "replay");
      assert.strictEqual(recordProvenance("r1")(read), "fresh");
    })
  );

  it.effect("overwrites a package record on the next run", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      yield* store.writeRecord(isolatedPackageTarget("again"), record("r1"));
      yield* store.writeRecord(isolatedPackageTarget("again"), record("r2"));
      const read = yield* store.readRecord(isolatedPackageTarget("again"));
      assert.strictEqual(read.report.runId, "r2");
    })
  );

  it.effect("keeps the newest twenty root runs of a gate, record and log", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      yield* Effect.forEach(
        runIds(ROOT_RUNS_KEPT + 2),
        (runId) =>
          Effect.andThen(
            store.writeLog(rootTarget(runId), logStream),
            store.writeRecord(rootTarget(runId), record(runId))
          ),
        { concurrency: 1 }
      );
      const kept = yield* store.listRuns("test");
      const expired = yield* Effect.flip(store.readRecord(rootTarget("run-11")));
      assert.strictEqual(kept.length, ROOT_RUNS_KEPT);
      assert.strictEqual(kept[0], "run-31");
      assert.isFalse(A.contains(kept, "run-10"));
      assert.strictEqual(expired.reason, "missing");
    })
  );

  it.effect("reports a missing record and lists no runs for an unused gate", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      const missing = yield* Effect.flip(store.readRecord(isolatedPackageTarget("missing")));
      const runs = yield* store.listRuns("check");
      assert.strictEqual(missing.reason, "missing");
      assert.deepStrictEqual(runs, []);
    })
  );

  it.effect("returns a stream failure as it is", () =>
    Effect.gen(function* () {
      const store = yield* GateRecordStore;
      const failure = yield* Effect.flip(store.writeLog(isolatedPackageTarget("stream"), Stream.fail("tool crashed")));
      assert.strictEqual(failure, "tool crashed");
    })
  );
};

const memoryPlatformWithPosixErrors = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

const liveStore = GateRecordStore.layer("/repo").pipe(Layer.provideMerge(memoryPlatformWithPosixErrors));

describe("GateRecordStore", () => {
  it.layer(GateRecordStore.layerMemory, { timeout: "30 seconds" })("in memory", storeRules);

  it.layer(liveStore, { timeout: "30 seconds" })("on the file system", storeRules);

  it.layer(memoryPlatformWithPosixErrors, { timeout: "30 seconds" })("on a file system that refuses", (it) => {
    it.effect("a taken temporary name is redrawn: both writes complete and leave the holder's file alone", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* GateRecordStore.make("/repo-collide");
        const dir = "/repo-collide/packages/glob/.beep/gates/test";
        const taken = yield* Random.nextIntBetween(0, 0x7fffffff).pipe(
          Effect.provideService(Random.Random, drawsInTurnThenRepeatsLast([0.5]))
        );
        const holder = `${dir}/report.json.${taken.toString(36)}.tmp`;
        yield* fs.makeDirectory(dir, { recursive: true });
        yield* fs.writeFileString(holder, "a writer's unfinished contents");
        yield* store
          .writeRecord(isolatedPackageTarget("glob"), record("r1"))
          .pipe(Effect.provideService(Random.Random, drawsInTurnThenRepeatsLast([0.5, 0.5, 0.25])));
        const first = yield* store.readRecord(isolatedPackageTarget("glob"));
        yield* store
          .writeRecord(isolatedPackageTarget("glob"), record("r2"))
          .pipe(Effect.provideService(Random.Random, drawsInTurnThenRepeatsLast([0.5, 0.75])));
        const second = yield* store.readRecord(isolatedPackageTarget("glob"));
        const exhausted = yield* Effect.flip(
          store
            .writeRecord(isolatedPackageTarget("glob"), record("r3"))
            .pipe(Effect.provideService(Random.Random, drawsInTurnThenRepeatsLast([0.5])))
        );
        const held = yield* fs.readFileString(holder);
        const names = yield* fs.readDirectory(dir);
        assert.strictEqual(first.report.runId, "r1");
        assert.strictEqual(second.report.runId, "r2");
        assert.strictEqual(held, "a writer's unfinished contents", "the holder's file is left alone");
        assert.instanceOf(exhausted, GateRecordWriteError);
        assert.include(
          exhausted.message,
          "AlreadyExists",
          "a name source that only ever draws the taken name runs out of attempts"
        );
        assert.deepStrictEqual(
          A.sort(names, Order.String),
          A.sort(["report.json", `report.json.${taken.toString(36)}.tmp`], Order.String)
        );
      })
    );
    it.effect("overlapping writes of one record each publish whole contents and leave no temporary file", () =>
      Effect.gen(function* () {
        const store = yield* GateRecordStore.make("/repo-overlap");
        const target = isolatedPackageTarget("glob");
        const written = yield* Effect.all(
          A.map(["r1", "r2", "r3"], (runId) => store.writeRecord(target, record(runId))),
          { concurrency: "unbounded" }
        );
        const read = yield* store.readRecord(target);
        const fs = yield* FileSystem.FileSystem;
        const names = yield* fs.readDirectory("/repo-overlap/packages/glob/.beep/gates/test");
        assert.strictEqual(written.length, 3);
        assert.isTrue(A.contains(["r1", "r2", "r3"], read.report.runId));
        assert.deepStrictEqual(names, ["report.json"]);
      })
    );

    it.effect("a write that cannot be renamed into place removes its temporary file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* GateRecordStore.make("/repo-blocked");
        const dir = "/repo-blocked/packages/glob/.beep/gates/test";
        yield* fs.makeDirectory(`${dir}/report.json/held`, { recursive: true });
        const failure = yield* Effect.flip(store.writeRecord(isolatedPackageTarget("glob"), record("r1")));
        const names = yield* fs.readDirectory(dir);
        assert.instanceOf(failure, GateRecordWriteError);
        assert.deepStrictEqual(names, ["report.json"]);
      })
    );

    it.effect("a run whose log cannot be removed keeps its record, so the next prune retries it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = "/repo-retry";
        const store = yield* GateRecordStore.make(root);
        yield* store.writeRecord(rootTarget("run-00"), record("run-00"));
        yield* fs.makeDirectory(`${root}/.beep/gates/test/run-00.log/held`, { recursive: true });
        yield* Effect.forEach(runIds(ROOT_RUNS_KEPT), (runId) => store.writeRecord(rootTarget(runId), record(runId)), {
          concurrency: 1,
        });
        const blocked = yield* store.listRuns("test");
        yield* fs.remove(`${root}/.beep/gates/test/run-00.log`, { recursive: true });
        yield* store.writeRecord(rootTarget("run-30"), record("run-30"));
        const retried = yield* store.listRuns("test");
        assert.isTrue(A.contains(blocked, "run-00"));
        assert.isFalse(A.contains(retried, "run-00"));
      })
    );
    it.effect("tells an unreadable record from a missing or invalid one", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/repo-unreadable";
        const store = yield* GateRecordStore.make(root);
        const target = isolatedPackageTarget("glob");
        const recordPath = path.join(root, recordLocation(target).record);
        yield* fs.makeDirectory(recordPath, { recursive: true });
        const unreadable = yield* Effect.flip(store.readRecord(target));
        yield* fs.remove(recordPath, { recursive: true });
        yield* fs.writeFileString(recordPath, '{"version":"gate-report/v0"}');
        const invalid = yield* Effect.flip(store.readRecord(target));
        assert.strictEqual(unreadable.reason, "unreadable");
        assert.strictEqual(invalid.reason, "invalid");
      })
    );

    it.effect("fails a listing it cannot read, and a retention it cannot carry out keeps the record written", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/repo-refusing";
        const store = yield* GateRecordStore.make(root);
        yield* fs.makeDirectory(path.join(root, ".beep/gates/test/run-00.json/held"), { recursive: true });
        yield* fs.writeFileString(path.join(root, ".beep/gates/check"), "not a directory");
        const listing = yield* Effect.flip(store.listRuns("check"));
        const written = yield* Effect.forEach(
          runIds(ROOT_RUNS_KEPT),
          (runId) => store.writeRecord(rootTarget(runId), record(runId)),
          { concurrency: 1 }
        );
        const last = yield* store.readRecord(rootTarget("run-29"));
        const kept = yield* store.listRuns("test");
        assert.instanceOf(listing, GateRecordReadError);
        assert.strictEqual(listing.reason, "unreadable");
        assert.strictEqual(written.length, ROOT_RUNS_KEPT);
        assert.strictEqual(last.report.runId, "run-29");
        assert.isTrue(A.contains(kept, "run-00"));
      })
    );
  });

  it.layer(GateRecordStore.layerFailingWrites("disk full"), { timeout: "30 seconds" })("with failing writes", (it) => {
    it.effect("fails every write with a write error and keeps nothing", () =>
      Effect.gen(function* () {
        const store = yield* GateRecordStore;
        const log = yield* Effect.flip(store.writeLog(isolatedPackageTarget("glob"), logStream));
        const written = yield* Effect.flip(store.writeRecord(isolatedPackageTarget("glob"), record("r1")));
        const read = yield* Effect.flip(store.readRecord(isolatedPackageTarget("glob")));
        assert.instanceOf(log, GateRecordWriteError);
        assert.instanceOf(written, GateRecordWriteError);
        assert.strictEqual(read.reason, "missing");
      })
    );
  });

  it.layer(GateRecordStore.layerMemory, { timeout: "30 seconds" })("round trip", (it) => {
    it.effect.prop(
      "any record reads back equal through the store",
      [Arbitrary.schema(GateRecord)],
      ([generated]) =>
        Effect.gen(function* () {
          const store = yield* GateRecordStore;
          yield* store.writeRecord(isolatedPackageTarget("prop"), generated);
          const read = yield* store.readRecord(isolatedPackageTarget("prop"));
          assert.isTrue(sameRecord(read, generated));
        }),
      { arbitrary: fcRuns(50) }
    );
  });
});
