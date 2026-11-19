// The adapter's implementation against a throwaway repository on disk: where
// a run's record goes, what the record and the raw log hold, and that a
// failure becomes one stderr line instead of a rejected promise.
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import {
  ADAPTER_PREFIX,
  failureLine,
  gateOf,
  makeGateVitestRun,
  writeRunRecord,
} from "@beep/repo-gate-vitest/internal/GateVitestRun";
import { makeConsoleLogBuffer, runLogText } from "@beep/repo-gate-vitest/internal/RunLog";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
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
      // Turbo's task hash when the suite itself runs under Turbo, unique to the run otherwise.
      assert.match(record.report.inputFingerprint, /^(local|turbo):/u);
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
      // A file where the gates directory belongs makes every write fail.
      yield* fs.writeFileString(path.join(packageRoot, ".beep"), "not a directory");
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
    // Would still fit, but a line after a dropped one is dropped too, so the log keeps an unbroken start.
    buffer.add({ content: "", type: "stdout" });
    assert.strictEqual(
      buffer.text(),
      "[stdout] abc\n[stdout] def\n[gate] not recorded past the 36-character bound: 2 console lines, 23 characters\n"
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
