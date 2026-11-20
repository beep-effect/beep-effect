/**
 * Gate run history on the repo CLI's task path: labels and the delta in the
 * console, ingest after the console (AC-H10 replay), the degrade causes
 * (AC-H8), the history queries (AC-H13), the flake-quarantine reconciliation
 * (AC-H11) and resolving where the store lives. The main suites run under
 * Node and Bun on an in-memory store provided through `HistoryStoreBackend`;
 * only a locked and an unreadable SQLite file need Bun (`bun:sqlite`).
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateHistoryError, HistoryConfig } from "@beep/gate-report/History";
import { Item } from "@beep/gate-report/Item";
import { fingerprint, ItemKey } from "@beep/gate-report/ItemKey";
import {
  EventRun,
  GateHistoryTarget,
  GateServicesConfig,
  gateCommand,
  HistorySetting,
  HistoryStoreBackend,
  HistoryWhere,
  historyRunLines,
  historyStoreLayer,
  itemSeriesLines,
  listHistoryLines,
  recordEventRun,
  resolveHistoryTarget,
  showSeriesLines,
} from "@beep/repo-cli/commands/Gate";
import { FlakeQuarantineIncident, quarantineHistoryReport, recordQuarantineHistory } from "@beep/repo-cli/test/Quality";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import { HistoryItemQuery, HistoryItemSeries, HistoryScope } from "@beep/repo-gate-run/GateHistoryRecord";
import { GateHistoryStore, makeGateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
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
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { GateHistoryStoreShape } from "@beep/repo-gate-run/GateHistoryStore";

const isBunRuntime = P.isNotUndefined(process.versions.bun);

const E = GateEvent.cases;
const FILE = "src/math.test.ts";
const SUBJECT = "@beep/gate-report";
const PACKAGE_DIR = "packages/foundation/modeling/gate-report";
const STORE_FILE = "/home/alice/.local/state/beep/gate-history/history.sqlite";

const testItem = (name: string, failed: boolean): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: FILE, fullName: `math > ${name}` }),
    unit: FILE,
    path: ["math"],
    name,
    outcome: failed ? "failed" : "passed",
  });

const run = (runId: string, at: number, failing: ReadonlyArray<string>): EventRun =>
  EventRun.make({
    target: RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "test" }),
    events: [
      E.RunStarted.make({
        runId,
        gate: "test",
        subject: SUBJECT,
        itemKind: "test",
        startedAt: DateTime.makeUnsafe(at),
        inputFingerprint: `input-${runId}`,
      }),
      E.UnitCollected.make({ unit: FILE, items: 2 }),
      ...A.map(["adds", "subtracts"], (name) =>
        E.ItemFinished.make({ item: testItem(name, A.contains(failing, name)) })
      ),
      E.RunFinished.make({ durationMs: 20, reason: A.isReadonlyArrayEmpty(failing) ? "passed" : "failed" }),
    ],
    exitCode: A.isReadonlyArrayEmpty(failing) ? 0 : 1,
    output: new TextEncoder().encode("vitest output\n"),
    subject: O.some(SUBJECT),
  });

const scope = HistoryScope.make({ branch: "feature/a", head: O.some("abc123") });

const historyAt = (filename: string = STORE_FILE, config: HistoryConfig = HistoryConfig.make({})) =>
  HistorySetting.cases.HistoryAt.make({ filename, config, scope: O.some(scope) });

const servicesFor = (repoRoot: string, history: HistorySetting) =>
  GateServicesConfig.make({ repoRoot, settings: ConsoleSettings.make({ audience: "agent" }), history });

const linesOf = (text: string) => Str.split(text, "\n");

const verdictFirstAndLast = (text: string) => {
  const lines = linesOf(text);
  assert.strictEqual(lines[0], lines[lines.length - 1]);
  assert.isTrue(Str.includes(": FAILED,")(lines[0] ?? ""), text);
};

const workspace = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-history-cli-" });
  return { repoRoot, file: path.join(repoRoot, "history.sqlite") };
});

// One in-memory store that every run of a test shares, so history persists between runs.
const memoryStore = Effect.map(makeGateHistoryStore(HistoryConfig.make({})), GateHistoryStore.of);

const backedBy =
  (store: GateHistoryStoreShape) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, HistoryStoreBackend, () =>
      Layer.succeed(GateHistoryStore, GateHistoryStore.of(store))
    );

const failingStore = GateHistoryStore.of({
  ingest: Effect.fn("GateHistoryStore.ingest")(function* () {
    return yield* GateHistoryError.make({ reason: "write-failed", message: "disk full" });
  }),
  answer: Effect.fn("GateHistoryStore.answer")(function* () {
    return yield* GateHistoryError.make({ reason: "open-busy", message: "database is locked" });
  }),
  runs: Effect.fn("GateHistoryStore.runs")(function* () {
    return yield* GateHistoryError.make({ reason: "open-failed", message: "unreadable" });
  }),
  series: Effect.fn("GateHistoryStore.series")(function* () {
    return yield* GateHistoryError.make({ reason: "open-failed", message: "unreadable" });
  }),
});

const dyingStore = GateHistoryStore.of({
  ingest: Effect.fn("GateHistoryStore.ingest")(function* () {
    return yield* Effect.die(new Error("store vanished\nsecond line"));
  }),
  answer: Effect.fn("GateHistoryStore.answer")(function* () {
    return yield* Effect.die(new Error("store vanished"));
  }),
  runs: Effect.fn("GateHistoryStore.runs")(function* () {
    return yield* Effect.die("unused");
  }),
  series: Effect.fn("GateHistoryStore.series")(function* () {
    return yield* Effect.die("unused");
  }),
});

const incidentAt = (detectedAt: string) =>
  FlakeQuarantineIncident.make({
    policy: "ts2589-no-location",
    laneLabel: "quality:check",
    taskId: "@beep/gate-report#check",
    packageName: SUBJECT,
    task: "check",
    standaloneCommand: "bun run check -- --filter=@beep/gate-report",
    detectedAt,
    standaloneDurationMs: 4000,
    laneRerunDurationMs: 3000,
  });

const git = Effect.fnUntraced(function* (dir: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(
      "git",
      ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=alice", "-c", "user.email=alice@example.com", ...args],
      { extendEnv: true }
    )
  );
  const output = yield* handle.stdout.pipe(Stream.decodeText, Stream.mkString);
  yield* handle.exitCode;
  return Str.trim(output);
});

const gitRepo = Effect.fnUntraced(function* (origin: O.Option<string>) {
  const fs = yield* FileSystem.FileSystem;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "gate-history-git-" });
  yield* git(dir, ["init", "-q", "-b", "feature/a"]);
  yield* git(dir, ["commit", "--allow-empty", "-q", "-m", "init"]);
  yield* Effect.forEach(O.toArray(origin), (url) => git(dir, ["remote", "add", "origin", url]), { concurrency: 1 });
  return dir;
});

const withEnv =
  (env: Record<string, string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(env));

const auto = HistorySetting.cases.HistoryAuto.make({});

describe("gate run history on the task path", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("over a shared in-memory store", (it) => {
    it.effect("labels, the delta and one missing-baseline line; a replayed record answers the same (AC-H10)", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const store = yield* memoryStore;
        const record = recordEventRun(servicesFor(repoRoot, historyAt()));
        const second = yield* Effect.gen(function* () {
          yield* record(run("r1", 1000, ["adds"]));
          return yield* record(run("r2", 2000, ["adds", "subtracts"]));
        }).pipe(backedBy(store));
        const lines = linesOf(second.output.text);
        assert.isTrue(A.some(lines, Str.includes("adds [persistent]")), second.output.text);
        assert.include(lines, "since last run: 0 fixed, 1 still failing, 1 new");
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("no main baseline: "))), 1);
        verdictFirstAndLast(second.output.text);
        const replay = yield* record(run("r2", 2000, ["adds", "subtracts"])).pipe(backedBy(store));
        assert.strictEqual(replay.output.text, second.output.text);
        assert.strictEqual(replay.exitCode, second.exitCode);
        const listed = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ dir: O.some(PACKAGE_DIR), history: historyAt() })
        ).pipe(backedBy(store));
        assert.strictEqual(A.length(listed), 2);
        assert.isTrue(Str.startsWith("r2 feature/a local ")(listed[0] ?? ""), A.join(listed, "\n"));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("a run with history off renders as before and records nothing", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const result = yield* recordEventRun(servicesFor(repoRoot, HistorySetting.cases.HistoryOff.make({})))(
          run("r1", 1000, ["adds"])
        );
        const lines = linesOf(result.output.text);
        assert.isFalse(A.some(lines, Str.startsWith("no main baseline")), result.output.text);
        assert.isFalse(A.some(lines, Str.includes("[")), result.output.text);
        assert.strictEqual(result.exitCode, 1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H8: a store that fails renders without labels, names the cause once, and keeps the exit code", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const result = yield* recordEventRun(servicesFor(repoRoot, historyAt()))(run("r1", 1000, ["adds"])).pipe(
          backedBy(failingStore)
        );
        const lines = linesOf(result.output.text);
        assert.deepStrictEqual(A.filter(lines, Str.startsWith("history not read: ")), [
          "history not read: open-busy: database is locked",
        ]);
        assert.isFalse(A.some(lines, Str.includes("[")), result.output.text);
        verdictFirstAndLast(result.output.text);
        assert.strictEqual(result.exitCode, 1);
        const errors = yield* TestConsole.errorLines;
        assert.deepStrictEqual(
          A.map(errors, (line) => `${line}`),
          ["gate history: run not recorded: write-failed: disk full"]
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H8: a store that dies renders without labels and reports the write in one stderr line", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const result = yield* recordEventRun(servicesFor(repoRoot, historyAt()))(run("r1", 1000, ["adds"])).pipe(
          backedBy(dyingStore)
        );
        const lines = linesOf(result.output.text);
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("history not read: "))), 1, result.output.text);
        verdictFirstAndLast(result.output.text);
        assert.strictEqual(result.exitCode, 1);
        const errors = yield* TestConsole.errorLines;
        assert.deepStrictEqual(
          A.map(errors, (line) => `${line}`),
          ["gate history: run not recorded: Error: store vanished"]
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H13: lists a subject's history and shows one item's series by branch", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const store = yield* memoryStore;
        const record = recordEventRun(servicesFor(repoRoot, historyAt()));
        const where = HistoryWhere.make({
          dir: O.some(PACKAGE_DIR),
          branch: O.some("feature/a"),
          history: historyAt(),
        });
        const { listed, series, none } = yield* Effect.gen(function* () {
          yield* record(run("r1", 1000, ["adds"]));
          yield* record(run("r2", 2000, []));
          return {
            listed: yield* listHistoryLines("test", where),
            series: yield* showSeriesLines("test", "adds", where),
            none: yield* showSeriesLines("test", "nothing-matches", where),
          };
        }).pipe(backedBy(store));
        assert.deepStrictEqual(
          A.map(listed, (line) => A.headNonEmpty(Str.split(line, " "))),
          ["r2", "r1"]
        );
        assert.strictEqual(series[0], `${FILE} > math > adds on feature/a (local)`);
        assert.isTrue(Str.endsWith("attempt 0: passed; input input-r2")(series[1] ?? ""), A.join(series, "\n"));
        assert.isTrue(Str.endsWith("attempt 0: failed; input input-r1")(series[2] ?? ""), A.join(series, "\n"));
        assert.deepStrictEqual(none, itemSeriesLines([]));
        const off = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ history: HistorySetting.cases.HistoryOff.make({}) })
        );
        assert.deepStrictEqual(off, ["no history store for this checkout"]);
        assert.deepStrictEqual(historyRunLines([]), ["no recorded runs"]);
        const flaky = itemSeriesLines([
          HistoryItemSeries.make({
            fingerprint: "k",
            title: "adds",
            branch: "feature/a",
            origin: "local",
            flaky: true,
            observations: [],
          }),
        ]);
        assert.isTrue(Str.endsWith(" [flaky]")(flaky[0] ?? ""));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("prints through the `gate history` and `gate series` commands", () =>
      Effect.gen(function* () {
        const command = Command.runWith(gateCommand, { version: "0.0.0" });
        yield* command(["history", "test", "--dir", PACKAGE_DIR, "--branch", "feature/a"]);
        yield* command(["series", "test", "adds", "--dir", PACKAGE_DIR]);
        const printed = yield* TestConsole.logLines;
        // Inside Vitest the automatic setting resolves no store.
        assert.deepStrictEqual(
          A.map(printed, (line) => `${line}`),
          ["no history store for this checkout", "no history store for this checkout"]
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H11: a quarantine incident is recorded flaky and the quarantine's verdict is untouched", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* workspace();
        const store = yield* memoryStore;
        const incident = incidentAt("2026-11-20T00:00:00.000Z");
        const incidents = [incident];
        const verdict = yield* recordQuarantineHistory(repoRoot, incidents, historyAt()).pipe(backedBy(store));
        assert.isUndefined(verdict);
        assert.deepStrictEqual(incidents, [incident]);
        const report = quarantineHistoryReport(incident);
        const key = fingerprint(A.headNonEmpty(report.items as A.NonEmptyReadonlyArray<Item>).key);
        const series = yield* store.series(HistoryItemQuery.make({ gate: "check", subject: SUBJECT, selector: key }));
        assert.deepStrictEqual(
          A.map(series, (entry) => [entry.flaky, A.length(entry.observations)] as const),
          [[true, 2]]
        );
        const answer = yield* store.answer(report, scope);
        assertSome(R.get(answer.labels, key), "flaky");
        yield* recordQuarantineHistory(repoRoot, [], historyAt()).pipe(backedBy(failingStore));
        yield* recordQuarantineHistory(repoRoot, incidents, HistorySetting.cases.HistoryOff.make({}));
        // An incident with an unreadable time is still recorded, at the epoch.
        assert.strictEqual(DateTime.toEpochMillis(quarantineHistoryReport(incidentAt("not a date")).startedAt), 0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("backs history with the SQLite store by default, opened only on first use", () =>
      Effect.gen(function* () {
        const target = GateHistoryTarget.make({ filename: ":memory:", config: HistoryConfig.make({}), scope });
        const context = yield* Layer.build(historyStoreLayer(target));
        assert.isTrue(P.isNotUndefined(context));
      })
    );
  });

  it.layer(NodeServices.layer, { timeout: "60 seconds" })("resolving the store in a git checkout", (it) => {
    it.effect("keys the store by the origin under the beep state directory, on the checkout's branch", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* gitRepo(O.some("git@github.com:Acme/App.git"));
        const state = yield* fs.makeTempDirectoryScoped({ prefix: "gate-history-state-" });
        const target = yield* resolveHistoryTarget(repo, auto).pipe(
          withEnv({ HOME: "/home/alice", XDG_STATE_HOME: state })
        );
        const found = O.getOrThrow(target);
        assert.strictEqual(found.filename, path.join(state, "beep", "gate-history", "github.com__acme__app.sqlite"));
        assert.strictEqual(found.scope.branch, "feature/a");
        assert.match(O.getOrThrow(found.scope.head), /^[0-9a-f]{40}$/u);
        const created = yield* fs.exists(path.join(state, "beep", "gate-history"));
        assert.isTrue(created);
      })
    );

    it.effect("keys a repository with no origin by its git directory, and a detached head by its commit", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* gitRepo(O.none());
        const state = yield* fs.makeTempDirectoryScoped({ prefix: "gate-history-state-" });
        const head = yield* git(repo, ["rev-parse", "HEAD"]);
        yield* git(repo, ["checkout", "-q", "--detach"]);
        const resolved = yield* resolveHistoryTarget(repo, auto).pipe(
          withEnv({ HOME: "/home/alice", XDG_STATE_HOME: state })
        );
        const target = O.getOrThrow(resolved);
        assert.match(target.filename, /\/local__[0-9a-f]{16}\.sqlite$/u);
        assert.strictEqual(target.scope.branch, `detached@${head}`);
      })
    );

    it.effect("takes a named file, turns off on request or inside Vitest, and asks git for a named file's scope", () =>
      Effect.gen(function* () {
        const repo = yield* gitRepo(O.none());
        const named = yield* resolveHistoryTarget(repo, auto).pipe(
          withEnv({ BEEP_GATE_HISTORY_FILE: "/home/alice/h.sqlite" })
        );
        assert.strictEqual(O.getOrThrow(named).filename, "/home/alice/h.sqlite");
        const switchedOff = yield* resolveHistoryTarget(repo, auto).pipe(withEnv({ BEEP_GATE_HISTORY: "Off" }));
        assertNone(switchedOff);
        const inVitest = yield* resolveHistoryTarget(repo, auto).pipe(withEnv({ VITEST: "true" }));
        assertNone(inVitest);
        const at = yield* resolveHistoryTarget(
          repo,
          HistorySetting.cases.HistoryAt.make({ filename: "/home/alice/h.sqlite", config: HistoryConfig.make({}) })
        );
        assert.strictEqual(O.getOrThrow(at).scope.branch, "feature/a");
      })
    );

    it.effect("resolves nothing outside a git checkout, and reads workspace runs outside a package", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const plain = yield* fs.makeTempDirectoryScoped({ prefix: "gate-history-plain-" });
        const outside = yield* resolveHistoryTarget(plain, auto).pipe(
          withEnv({ HOME: "/home/alice", XDG_STATE_HOME: plain })
        );
        assertNone(outside);
        const unscoped = yield* resolveHistoryTarget(
          plain,
          HistorySetting.cases.HistoryAt.make({ filename: STORE_FILE, config: HistoryConfig.make({}) })
        );
        assertNone(unscoped);
        const store = yield* memoryStore;
        const lines = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ dir: O.some("."), history: historyAt() })
        ).pipe(backedBy(store));
        assert.deepStrictEqual(lines, ["no recorded runs"]);
        assert.strictEqual(HistoryWhere.make({}).history._tag, "HistoryAuto");
        const defaults = GateServicesConfig.make({
          repoRoot: plain,
          settings: ConsoleSettings.make({ audience: "agent" }),
        });
        assert.strictEqual(defaults.history._tag, "HistoryAuto");
        yield* recordQuarantineHistory(plain, [incidentAt("2026-11-20T00:00:00.000Z")]);
      })
    );
  });
});

describe.skipIf(!isBunRuntime)("gate run history over a real SQLite file (Bun runtime)", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("over a store file", (it) => {
    it.effect("AC-H8: an unreadable store renders without labels, names the cause once, and keeps the exit code", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { repoRoot, file } = yield* workspace();
        yield* fs.writeFileString(file, Str.repeat(40)("not a database "));
        const result = yield* recordEventRun(servicesFor(repoRoot, historyAt(file)))(run("r1", 1000, ["adds"]));
        const lines = linesOf(result.output.text);
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("history not read: "))), 1, result.output.text);
        assert.isFalse(A.some(lines, Str.includes("[")), result.output.text);
        verdictFirstAndLast(result.output.text);
        assert.strictEqual(result.exitCode, 1);
        const errors = yield* TestConsole.errorLines;
        assert.strictEqual(A.length(errors), 1);
        assert.isTrue(Str.startsWith("gate history: run not recorded: ")(`${errors[0]}`));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H8: a store an exclusive holder locks renders without labels and names the cause once", () =>
      Effect.gen(function* () {
        const { repoRoot, file } = yield* workspace();
        const record = recordEventRun(
          servicesFor(repoRoot, historyAt(file, HistoryConfig.make({ deadlineMs: 100, retryAttempts: 1 })))
        );
        yield* record(run("r1", 1000, ["adds"]));
        const { Database } = yield* Effect.promise(() => import("bun:sqlite"));
        const holder = new Database(file);
        holder.run("PRAGMA locking_mode = EXCLUSIVE");
        holder.run("BEGIN EXCLUSIVE");
        holder.run("CREATE TABLE lock_holder (x)");
        const result = yield* record(run("r2", 2000, ["adds"])).pipe(
          TestClock.withLive,
          Effect.ensuring(Effect.sync(() => holder.close()))
        );
        const lines = linesOf(result.output.text);
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("history not read: "))), 1, result.output.text);
        assert.isFalse(A.some(lines, Str.includes("[persistent]")), result.output.text);
        const errors = yield* TestConsole.errorLines;
        assert.strictEqual(A.length(errors), 1);
        verdictFirstAndLast(result.output.text);
        assert.strictEqual(result.exitCode, 1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
