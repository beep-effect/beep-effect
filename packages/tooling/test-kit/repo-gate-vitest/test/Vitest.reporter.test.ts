import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import GateVitestReporter from "@beep/repo-gate-vitest/Vitest.reporter";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { PACKAGE_DIR, tempRepo } from "./support/repo.ts";
import { makeModule, makeTestCase } from "./support/vitest.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const target = RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "test" });

describe("GateVitestReporter on synthetic Vitest objects, one case at a time since the cases spy on the error console", {
  concurrent: false,
}, () => {
  it.layer(NodeServices.layer)("on disk", (it) => {
    it.effect("writes the package record at the end of a run, printing nothing", () =>
      Effect.gen(function* () {
        const { repoRoot, packageRoot } = yield* tempRepo();
        const writes = vi.spyOn(console, "error");
        const reporter = new GateVitestReporter();
        reporter.onInit({ config: { root: packageRoot }, logger: {} });
        yield* Effect.promise(() => reporter.onTestRunStart());
        yield* Effect.promise(() => reporter.onUserConsoleLog({ content: "hello", type: "stdout" }));
        yield* Effect.promise(() =>
          reporter.onTestRunEnd(
            [makeModule({ tests: [makeTestCase({ name: "a" }), makeTestCase({ name: "b" })] })],
            [],
            "passed"
          )
        );
        const store = yield* GateRecordStore.make(repoRoot);
        const record = yield* store.readRecord(target);
        assert.strictEqual(record.report.totals.passed, 2);
        assert.strictEqual(record.report.reason, "passed");
        assert.strictEqual(writes.mock.calls.length, 0);
      })
    );

    it.effect("does nothing before Vitest starts it", () =>
      Effect.gen(function* () {
        const reporter = new GateVitestReporter();
        yield* Effect.promise(() => reporter.onTestRunStart());
        yield* Effect.promise(() => reporter.onUserConsoleLog({ content: "x", type: "stderr" }));
        yield* Effect.promise(() => reporter.onTestRunEnd([], [], "passed"));
      })
    );

    it.effect("switches itself off with one stderr line when it cannot start", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo();
        const writes = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const reporter = new GateVitestReporter();
        reporter.onInit({
          get config(): { readonly root: string } {
            throw new TypeError("no resolved config\nsecond line");
          },
          logger: {},
        });
        yield* Effect.promise(() => reporter.onTestRunEnd([makeModule({ tests: [makeTestCase()] })], [], "passed"));
        assert.deepStrictEqual(
          A.map(writes.mock.calls, (call) => call[0]),
          ["[@beep/repo-gate-vitest] off for this run: no resolved config"]
        );
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const written = yield* fs.exists(path.join(packageRoot, ".beep"));
        assert.isFalse(written);
      })
    );

    it.effect("prints one stderr line when the record cannot be written", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo();
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.writeFileString(path.join(packageRoot, ".beep"), "not a directory");
        const writes = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const reporter = new GateVitestReporter();
        reporter.onInit({ config: { root: packageRoot }, logger: {} });
        yield* Effect.promise(() => reporter.onTestRunEnd([makeModule({ tests: [makeTestCase()] })], [], "passed"));
        assert.strictEqual(writes.mock.calls.length, 1);
        assert.isTrue(A.some(writes.mock.calls, (call) => pipe(`${call[0]}`, Str.includes("gate record not written"))));
      })
    );

    it.effect("reports a thrown value that is not an error by its text", () =>
      Effect.gen(function* () {
        const writes = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const reporter = new GateVitestReporter();
        reporter.onInit({
          get config(): { readonly root: string } {
            throw "plain refusal";
          },
          logger: {},
        });
        yield* Effect.promise(() => reporter.onTestRunStart());
        assert.isTrue(
          A.some(writes.mock.calls, (call) => pipe(`${call[0]}`, Str.includes("off for this run: plain refusal")))
        );
      })
    );
  });
});
