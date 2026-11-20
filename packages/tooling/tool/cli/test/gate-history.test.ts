/**
 * Gate run history on the repo CLI's task path: labels and the delta in the
 * console, ingest after the console (AC-H10 replay), the degrade causes
 * (AC-H8), the history queries (AC-H13) and the flake-quarantine
 * reconciliation (AC-H11). The suite runs under Bun only (the store's driver
 * imports `bun:sqlite`).
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { HistoryConfig, isFlaky } from "@beep/gate-report/History";
import { Item } from "@beep/gate-report/Item";
import { fingerprint, ItemKey } from "@beep/gate-report/ItemKey";
import {
  EventRun,
  GateHistoryTarget,
  GateServicesConfig,
  HistorySetting,
  HistoryWhere,
  historyRunLines,
  ingestAfterConsole,
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
import { GateHistorySqliteOptions, layerSqlite } from "@beep/repo-gate-run/GateHistorySqlite";
import { GateHistoryStore } from "@beep/repo-gate-run/GateHistoryStore";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

const isBunRuntime = P.isNotUndefined(process.versions.bun);

const E = GateEvent.cases;
const FILE = "src/math.test.ts";
const SUBJECT = "@beep/gate-report";

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
    target: RecordTarget.cases.PackageTarget.make({
      packageDir: "packages/foundation/modeling/gate-report",
      gate: "test",
    }),
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

const historyAt = (filename: string, config: HistoryConfig = HistoryConfig.make({})) =>
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

describe.skipIf(!isBunRuntime)("gate run history on the task path (Bun runtime)", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("over a store file", (it) => {
    it.effect("labels, the delta and one missing-baseline line; a replayed record answers the same (AC-H10)", () =>
      Effect.gen(function* () {
        const { repoRoot, file } = yield* workspace();
        const record = recordEventRun(servicesFor(repoRoot, historyAt(file)));
        yield* record(run("r1", 1000, ["adds"]));
        const second = yield* record(run("r2", 2000, ["adds", "subtracts"]));
        const lines = linesOf(second.output.text);
        assert.isTrue(A.some(lines, Str.includes("adds [persistent]")), second.output.text);
        assert.include(lines, "since last run: 0 fixed, 1 still failing, 1 new");
        assert.strictEqual(A.length(A.filter(lines, Str.startsWith("no main baseline: "))), 1);
        verdictFirstAndLast(second.output.text);
        const replay = yield* record(run("r2", 2000, ["adds", "subtracts"]));
        assert.strictEqual(replay.output.text, second.output.text);
        assert.strictEqual(replay.exitCode, second.exitCode);
        const listed = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ dir: O.some("packages/foundation/modeling/gate-report"), history: historyAt(file) })
        );
        assert.strictEqual(A.length(listed), 2);
        assert.isTrue(Str.startsWith("r2 feature/a local ")(listed[0] ?? ""), A.join(listed, "\n"));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

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

    it.effect("AC-H13: lists a subject's history and shows one item's series by branch", () =>
      Effect.gen(function* () {
        const { repoRoot, file } = yield* workspace();
        const record = recordEventRun(servicesFor(repoRoot, historyAt(file)));
        yield* record(run("r1", 1000, ["adds"]));
        yield* record(run("r2", 2000, []));
        const where = HistoryWhere.make({
          dir: O.some("packages/foundation/modeling/gate-report"),
          branch: O.some("feature/a"),
          history: historyAt(file),
        });
        const listed = yield* listHistoryLines("test", where);
        assert.deepStrictEqual(
          A.map(listed, (line) => A.headNonEmpty(Str.split(line, " "))),
          ["r2", "r1"]
        );
        const series = yield* showSeriesLines("test", "adds", where);
        assert.strictEqual(series[0], `${FILE} > math > adds on feature/a (local)`);
        assert.isTrue(Str.endsWith("attempt 0: passed; input input-r2")(series[1] ?? ""), A.join(series, "\n"));
        assert.isTrue(Str.endsWith("attempt 0: failed; input input-r1")(series[2] ?? ""), A.join(series, "\n"));
        const none = yield* showSeriesLines("test", "nothing-matches", where);
        assert.deepStrictEqual(none, itemSeriesLines([]));
        const off = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ history: HistorySetting.cases.HistoryOff.make({}) })
        );
        assert.deepStrictEqual(off, ["no history store for this checkout"]);
        assert.deepStrictEqual(historyRunLines([]), ["no recorded runs"]);
        assert.isTrue(
          Str.endsWith(" [flaky]")(
            itemSeriesLines([
              HistoryItemSeries.make({
                fingerprint: "k",
                title: "adds",
                branch: "feature/a",
                origin: "local",
                flaky: true,
                observations: [],
              }),
            ])[0] ?? ""
          )
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("AC-H11: a quarantine incident is recorded flaky and the quarantine's verdict is untouched", () =>
      Effect.gen(function* () {
        const { repoRoot, file } = yield* workspace();
        const incident = FlakeQuarantineIncident.make({
          policy: "ts2589-no-location",
          laneLabel: "quality:check",
          taskId: "@beep/gate-report#check",
          packageName: SUBJECT,
          task: "check",
          standaloneCommand: "bun run check -- --filter=@beep/gate-report",
          detectedAt: "2026-11-20T00:00:00.000Z",
          standaloneDurationMs: 4000,
          laneRerunDurationMs: 3000,
        });
        const incidents = [incident];
        const verdict = yield* recordQuarantineHistory(repoRoot, incidents, historyAt(file));
        assert.isUndefined(verdict);
        assert.deepStrictEqual(incidents, [incident]);
        const key = fingerprint(
          A.headNonEmpty(quarantineHistoryReport(incident).items as A.NonEmptyReadonlyArray<Item>).key
        );
        const store = layerSqlite(GateHistorySqliteOptions.make({ filename: file }));
        const series = yield* store.pipe(
          Layer.build,
          Effect.flatMap((context) =>
            Effect.provideContext(
              Effect.flatMap(GateHistoryStore, (history) =>
                history.series(HistoryItemQuery.make({ gate: "check", subject: SUBJECT, selector: key }))
              ),
              context
            )
          )
        );
        assert.deepStrictEqual(
          A.map(series, (entry) => [entry.flaky, A.length(entry.observations)] as const),
          [[true, 2]]
        );
        assert.isTrue(A.every(series, (entry) => isFlaky(entry.observations)));
        const answer = yield* store.pipe(
          Layer.build,
          Effect.flatMap((context) =>
            Effect.provideContext(
              Effect.flatMap(GateHistoryStore, (history) => history.answer(quarantineHistoryReport(incident), scope)),
              context
            )
          )
        );
        assert.deepStrictEqual(answer.labels[key], "flaky");
        yield* recordQuarantineHistory(repoRoot, [], historyAt(file));
        yield* recordQuarantineHistory(repoRoot, incidents, HistorySetting.cases.HistoryOff.make({}));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("resolves no history inside Vitest by default and outside a git checkout", () =>
      Effect.gen(function* () {
        const { repoRoot, file } = yield* workspace();
        const none1 = yield* resolveHistoryTarget(repoRoot, HistorySetting.cases.HistoryAuto.make({}));
        assertNone(none1);
        const none2 = yield* resolveHistoryTarget(
          repoRoot,
          HistorySetting.cases.HistoryAt.make({ filename: file, config: HistoryConfig.make({}) })
        );
        assertNone(none2);
      })
    );
  });
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

const quarantineReportIncident = FlakeQuarantineIncident.make({
  policy: "ts2589-no-location",
  laneLabel: "quality:check",
  taskId: "@beep/gate-report#check",
  packageName: SUBJECT,
  task: "check",
  standaloneCommand: "bun run check",
  detectedAt: "not a date",
  standaloneDurationMs: 1,
  laneRerunDurationMs: 1,
});

const quarantineReportFixture = quarantineHistoryReport(quarantineReportIncident);

describe.skipIf(!isBunRuntime)("resolving the history store (Bun runtime)", () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("in a git checkout", (it) => {
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
        assert.match(
          O.getOrElse(found.scope.head, () => ""),
          /^[0-9a-f]{40}$/u
        );
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
        const none3 = yield* resolveHistoryTarget(repo, auto).pipe(withEnv({ BEEP_GATE_HISTORY: "Off" }));
        assertNone(none3);
        const none4 = yield* resolveHistoryTarget(repo, auto).pipe(withEnv({ VITEST: "true" }));
        assertNone(none4);
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
        const none5 = yield* resolveHistoryTarget(plain, auto).pipe(
          withEnv({ HOME: "/home/alice", XDG_STATE_HOME: plain })
        );
        assertNone(none5);
        const lines = yield* listHistoryLines(
          "test",
          HistoryWhere.make({ dir: O.some("."), history: historyAt(`${plain}/h.sqlite`) })
        );
        assert.deepStrictEqual(lines, ["no recorded runs"]);
        assert.strictEqual(HistoryWhere.make({}).history._tag, "HistoryAuto");
        yield* recordQuarantineHistory(plain, [quarantineReportIncident]);
      })
    );

    it.effect("a write that dies, not a store error, is still one stderr line", () =>
      Effect.gen(function* () {
        const target = GateHistoryTarget.make({ filename: ":memory:", config: HistoryConfig.make({}), scope });
        yield* ingestAfterConsole(target)(quarantineReportFixture).pipe(
          Effect.provideService(
            GateHistoryStore,
            GateHistoryStore.of({
              ingest: Effect.fn("GateHistoryStore.ingest")(function* () {
                return yield* Effect.die(new Error("store vanished\nsecond line"));
              }),
              answer: Effect.fn("GateHistoryStore.answer")(function* () {
                return yield* Effect.die("unused");
              }),
              runs: Effect.fn("GateHistoryStore.runs")(function* () {
                return yield* Effect.die("unused");
              }),
              series: Effect.fn("GateHistoryStore.series")(function* () {
                return yield* Effect.die("unused");
              }),
            })
          )
        );
        const errors = yield* TestConsole.errorLines;
        assert.deepStrictEqual(
          A.map(errors, (line) => `${line}`),
          ["gate history: run not recorded: Error: store vanished"]
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
