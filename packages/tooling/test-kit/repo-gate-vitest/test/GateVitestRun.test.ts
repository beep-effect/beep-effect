import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import {
  ADAPTER_PREFIX,
  clearSession,
  failureLine,
  GATE_CONTINUES_ENV,
  gateOf,
  makeGateVitestRun,
  SESSION_FILE,
  writeRunRecord,
} from "@beep/repo-gate-vitest/internal/GateVitestRun";
import { makeConsoleLogBuffer, runLogText } from "@beep/repo-gate-vitest/internal/RunLog";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { PACKAGE_DIR, tempRepo } from "./support/repo.ts";
import { makeModule, makeTestCase } from "./support/vitest.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const target = RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "test" });

const failingModule = makeModule({
  file: "test/math.test.ts",
  tests: [
    makeTestCase({ name: "adds", state: "failed", errors: [{ message: "expected 1 to be 2", diff: "- 2\n+ 1" }] }),
    makeTestCase({ name: "subtracts" }),
  ],
});

describe("gateOf", () => {
  it("records integration runs under their own gate", () => {
    assert.strictEqual(gateOf(["bun", "vitest", "run"]), "test");
    assert.strictEqual(gateOf(["bun", "vitest", "run", "test/integration", "--passWithNoTests"]), "test-integration");
  });
});

it.layer(NodeServices.layer)("on disk", (it) => {
  it.effect("writes the record and a raw log holding console lines and failures in full", () =>
    Effect.gen(function* () {
      const { repoRoot, packageRoot } = yield* tempRepo();
      yield* writeRunRecord({
        root: packageRoot,
        argv: [],
        startedAt: O.none(),
        consoleText: "[stdout] hello\n",
        modules: [failingModule],
        unhandledErrors: [],
        reason: "failed",
        logger: undefined,
      });
      const store = yield* GateRecordStore.make(repoRoot);
      const record = yield* store.readRecord(target);
      assert.strictEqual(record.report.subject, "@beep/demo");
      assert.strictEqual(record.report.reason, "failed");
      assert.match(
        record.report.inputFingerprint,
        /^(local|turbo):/u,
        "Turbo's task hash when the suite runs under Turbo, unique to the run otherwise"
      );
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const log = yield* fs.readFileString(path.join(packageRoot, ".beep/gates/test/report.log"));
      assert.strictEqual(log, runLogText(record.report, "[stdout] hello\n"));
      assert.isTrue(pipe(log, Str.includes("[stdout] hello\n")));
      assert.isTrue(pipe(log, Str.includes("FAIL test/math.test.ts > adds\nexpected 1 to be 2\n- 2\n+ 1\n")));
    })
  );

  it.effect("writes nothing for a Vitest root that is not a package", () =>
    Effect.gen(function* () {
      const { repoRoot } = yield* tempRepo();
      yield* writeRunRecord({
        root: repoRoot,
        argv: [],
        startedAt: O.none(),
        consoleText: "",
        modules: [],
        unhandledErrors: [],
        reason: "passed",
        logger: undefined,
      });
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const written = yield* fs.exists(path.join(repoRoot, ".beep"));
      assert.isFalse(written);
    })
  );

  it.effect("drives a session through start, console lines and finish", () =>
    Effect.gen(function* () {
      const { repoRoot, packageRoot } = yield* tempRepo();
      const session = makeGateVitestRun({ root: packageRoot, argv: [] });
      session.console({ content: "from an earlier run", type: "stdout" });
      session.start();
      session.console({ content: "kept\n", type: "stderr" });
      yield* Effect.promise(() =>
        session.finish({ modules: [failingModule], unhandledErrors: [], reason: "failed", logger: undefined })
      );
      const store = yield* GateRecordStore.make(repoRoot);
      const record = yield* store.readRecord(target);
      assert.strictEqual(record.report.totals.failed, 1);
      assert.strictEqual(record.report.totals.passed, 1);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const log = yield* fs.readFileString(path.join(packageRoot, ".beep/gates/test/report.log"));
      assert.isTrue(Str.startsWith("[stderr] kept\n")(log));
      assert.isFalse(pipe(log, Str.includes("earlier run")));
    })
  );

  it.effect("prints one stderr line and resolves when the record cannot be written", () =>
    Effect.gen(function* () {
      const { packageRoot } = yield* tempRepo();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fileWhereGatesDirBelongs = path.join(packageRoot, ".beep");
      yield* fs.writeFileString(fileWhereGatesDirBelongs, "not a directory");
      const lines: Array<string> = [];
      const session = makeGateVitestRun({ root: packageRoot, argv: [], printLine: (line) => lines.push(line) });
      yield* Effect.promise(() =>
        session.finish({ modules: [failingModule], unhandledErrors: [], reason: "failed", logger: undefined })
      );
      assert.strictEqual(lines.length, 1);
      assert.isTrue(A.every(lines, Str.startsWith(`${ADAPTER_PREFIX} gate record not written: `)));
    })
  );
});

describe("failureLine", () => {
  it("names the first line of the cause", () => {
    const line = failureLine(Cause.fail("disk full"));
    assert.isTrue(Str.startsWith(`${ADAPTER_PREFIX} gate record not written: `)(line));
    assert.isTrue(pipe(line, Str.includes("disk full")));
    assert.isFalse(pipe(line, Str.includes("\n")));
  });
});

describe("makeConsoleLogBuffer", () => {
  it("keeps whole lines in order up to the bound, then counts every later line", () => {
    const buffer = makeConsoleLogBuffer(36);
    buffer.add({ content: "abc", type: "stdout" });
    buffer.add({ content: "def\n", type: "stdout" });
    buffer.add({ content: "ghi", type: "stderr" });
    buffer.add({ content: "", type: "stdout" });
    assert.strictEqual(
      buffer.text(),
      "[stdout] abc\n[stdout] def\n[gate] not recorded past the 36-character bound: 2 console lines, 23 characters\n",
      "the last line would still fit, but a line after a dropped one is dropped too, so the log keeps an unbroken start"
    );
  });

  it("holds nothing after a reset", () => {
    const buffer = makeConsoleLogBuffer(8);
    buffer.add({ content: "too long for the bound", type: "stdout" });
    buffer.reset();
    assert.strictEqual(buffer.text(), "");
    buffer.add({ content: "", type: "stdout" });
    assert.strictEqual(
      buffer.text(),
      "[gate] not recorded past the 8-character bound: 1 console line, 10 characters\n"
    );
  });
});

const asRun = (continuing: boolean) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown(continuing ? { [GATE_CONTINUES_ENV]: "1" } : {})
  );

const nodeModule = makeModule({ file: "test/node.test.ts", tests: [makeTestCase({ name: "boundary" })] });

const runAs = (
  continuing: boolean,
  input: {
    readonly packageRoot: string;
    readonly module: typeof nodeModule;
    readonly line: string;
    readonly reason: string;
  }
) =>
  writeRunRecord({
    root: input.packageRoot,
    argv: [],
    startedAt: O.none(),
    consoleText: `[stdout] ${input.line}\n`,
    modules: [input.module],
    unhandledErrors: [],
    reason: input.reason,
    logger: undefined,
  }).pipe(asRun(continuing));

const itemNames = Effect.fnUntraced(function* (repoRoot: string) {
  const store = yield* GateRecordStore.make(repoRoot);
  const record = yield* store.readRecord(target);
  return A.map(record.report.items, (item) => item.name);
});

it.layer(NodeServices.layer)("one script, several Vitest runs", (it) => {
  it.effect("folds a continuing run into the record its chain's first run wrote, and appends its log", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repoRoot, packageRoot } = yield* tempRepo();
      yield* runAs(false, { packageRoot, module: failingModule, line: "bun run", reason: "failed" });
      yield* runAs(true, { packageRoot, module: nodeModule, line: "node run", reason: "passed" });
      const store = yield* GateRecordStore.make(repoRoot);
      const report = (yield* store.readRecord(target)).report;
      assert.deepStrictEqual(
        A.map(report.items, (item) => item.name),
        ["adds", "subtracts", "boundary"]
      );
      assert.deepStrictEqual(
        [report.totals.collected, report.totals.passed, report.totals.failed, report.reason],
        [3, 2, 1, "failed"]
      );
      const gateDir = path.join(packageRoot, ".beep/gates/test");
      const log = yield* fs.readFileString(path.join(gateDir, "report.log"));
      assert.isTrue(Str.startsWith("[stdout] bun run\n")(log), log);
      assert.isTrue(pipe(log, Str.includes("FAIL test/math.test.ts > adds\n")), log);
      assert.isTrue(Str.endsWith("[stdout] node run\n")(log), log);
      const named = yield* fs.readFileString(path.join(gateDir, SESSION_FILE));
      assert.strictEqual(named, report.runId);
    })
  );

  it.effect("replaces the record on a run that does not continue, whatever the sidecar names", () =>
    Effect.gen(function* () {
      const { repoRoot, packageRoot } = yield* tempRepo();
      yield* runAs(false, { packageRoot, module: failingModule, line: "first", reason: "failed" });
      yield* runAs(false, { packageRoot, module: nodeModule, line: "second", reason: "passed" });
      const names = yield* itemNames(repoRoot);
      assert.deepStrictEqual(names, ["boundary"]);
    })
  );

  it.effect("never folds into a restored record once a new chain has started", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repoRoot, packageRoot } = yield* tempRepo();
      yield* runAs(false, { packageRoot, module: failingModule, line: "restored", reason: "failed" });
      const sidecar = path.join(packageRoot, ".beep/gates/test", SESSION_FILE);
      const restored = yield* fs.exists(sidecar);
      assert.isTrue(restored);
      const first = makeGateVitestRun({ root: packageRoot, argv: [] });
      yield* Effect.promise(() => first.start());
      const cleared = yield* fs.exists(sidecar);
      assert.isFalse(cleared, "the next invocation's first run clears the cache-restored sidecar as it starts");
      yield* runAs(true, { packageRoot, module: nodeModule, line: "node run", reason: "passed" });
      {
        const names = yield* itemNames(repoRoot);
        assert.deepStrictEqual(
          names,
          ["boundary"],
          "so the chain's continuing run cannot fold into the restored record"
        );
      }
    })
  );

  it.effect("keeps the sidecar when a continuing run starts, and starts afresh on a missing record or log", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { repoRoot, packageRoot } = yield* tempRepo();
      const gateDir = path.join(packageRoot, ".beep/gates/test");
      yield* runAs(false, { packageRoot, module: failingModule, line: "first", reason: "failed" });
      yield* clearSession(packageRoot, []).pipe(asRun(true));
      const kept = yield* fs.exists(path.join(gateDir, SESSION_FILE));
      assert.isTrue(kept);
      yield* fs.remove(path.join(gateDir, "report.json"));
      yield* runAs(true, { packageRoot, module: nodeModule, line: "second", reason: "passed" });
      {
        const names = yield* itemNames(repoRoot);
        assert.deepStrictEqual(names, ["boundary"], "a continuing run whose chain's record is gone replaces it");
      }
      yield* fs.remove(path.join(gateDir, "report.log"));
      yield* runAs(true, { packageRoot, module: failingModule, line: "third", reason: "failed" });
      {
        const folded = yield* itemNames(repoRoot);
        assert.deepStrictEqual(
          folded,
          ["boundary", "adds", "subtracts"],
          "a continuing run whose chain's log is gone still folds the record"
        );
      }
      const log = yield* fs.readFileString(path.join(gateDir, "report.log"));
      assert.isTrue(Str.startsWith("[stdout] third\n")(log), log);
    })
  );
});
