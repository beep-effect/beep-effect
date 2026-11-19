// The package gates and the task path against a throwaway repository: the
// check gate's probe and compiler paths, the test gate's fresh-record and
// fallback paths, the `gate run check` command, the root fold over a Turbo
// run summary, and `beep test` / `beep check` routing through the gates. The
// tools are small shell scripts, never a workspace package's own compiler.

import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { Item } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { Git } from "@beep/git/Git";
import {
  CapturedRun,
  gateCommand,
  recordRootRun,
  requirePackage,
  runCheckGate,
  runTestGate,
} from "@beep/repo-cli/commands/Gate";
import { parseQualityTaskInvocation, runQualityTask } from "@beep/repo-cli/commands/Quality/Tasks";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const agent = { audience: [], human: [], agent: [true], ci: [] };
const encodeRecord = S.encodeEffect(S.fromJsonString(GateRecord));

const PACKAGE_DIR = "packages/demo";

const greenReport = GateReport.make({
  gate: "test",
  subject: "@beep/demo",
  itemKind: "test",
  runId: "20261119T000000000Z-0001",
  startedAt: DateTime.makeUnsafe(0),
  durationMs: 12,
  inputFingerprint: "x",
  reason: "passed",
  outcome: "all-pass",
  units: [],
  items: A.map(["a", "b", "c"], (name) =>
    Item.make({
      key: ItemKey.cases.TestKey.make({ file: "test/a.test.ts", fullName: name }),
      unit: "test/a.test.ts",
      path: [],
      name,
      outcome: "passed",
    })
  ),
  totals: Totals.make({ collected: 3, passed: 3 }),
});

// A repository root (`turbo.json`, workspaces, `.git`) with one package whose
// scripts are the given shell lines.
const tempRepo = Effect.fn("GateTaskPathTest.tempRepo")(function* (scripts: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-task-path-" });
  const packageRoot = path.join(repoRoot, PACKAGE_DIR);
  yield* fs.makeDirectory(path.join(repoRoot, ".git"), { recursive: true });
  yield* fs.makeDirectory(packageRoot, { recursive: true });
  yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}");
  yield* fs.writeFileString(path.join(repoRoot, "package.json"), '{"name":"root","workspaces":["packages/*"]}');
  const manifest = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))({ name: "@beep/demo", scripts });
  yield* fs.writeFileString(path.join(packageRoot, "package.json"), manifest);
  yield* fs.writeFileString(path.join(packageRoot, "tsconfig.json"), "{}");
  return { repoRoot, packageRoot };
});

const writeRecordSource = Effect.fn("GateTaskPathTest.writeRecordSource")(function* (packageRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Generated far in the future, so it reads as written by the run that copies it.
  const text = yield* encodeRecord(
    GateRecord.make({ generatedAt: DateTime.makeUnsafe(4_102_444_800_000), report: greenReport })
  );
  yield* fs.writeFileString(path.join(packageRoot, "record.src.json"), text);
});

const COPY_RECORD = "mkdir -p .beep/gates/test && cp record.src.json .beep/gates/test/report.json";

// Pin the working directory the task path reads for the rest of the test.
const pinCwd = (dir: string) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const original = process.cwd;
      process.cwd = () => dir;
      return original;
    }),
    (original) =>
      Effect.sync(() => {
        process.cwd = original;
      })
  );

const logText = Effect.map(TestConsole.logLines, (lines) =>
  A.join(
    A.map(lines, (line) => `${line}`),
    "\n"
  )
);

const invocation = (argv: ReadonlyArray<string>) => O.getOrThrow(parseQualityTaskInvocation(argv));

describe("package gates", { concurrent: false }, () => {
  // The task path also reads git and digests, as the CLI runtime provides them.
  it.layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), {
    timeout: "60 seconds",
  })("on disk", (it) => {
    it.effect("folds an unbuilt reference to one cause line and exits 1 before any compiler", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { repoRoot, packageRoot } = yield* tempRepo({ "beep:check": "exit 9" });
        yield* fs.makeDirectory(path.join(repoRoot, "packages/upstream"), { recursive: true });
        yield* fs.writeFileString(path.join(repoRoot, "packages/upstream/tsconfig.json"), "{}");
        yield* fs.writeFileString(path.join(packageRoot, "tsconfig.json"), '{"references":[{"path":"../upstream"}]}');
        const failed = yield* Effect.flip(runCheckGate(packageRoot, agent));
        assert.strictEqual(failed._tag === "GateToolExit" ? failed.exitCode : failed._tag, 1);
        const text = yield* logText;
        assert.isTrue(Str.includes("TS6305 x1: upstream declarations are not built")(text));
        const record = yield* (yield* GateRecordStore.make(repoRoot)).readRecord(
          RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "check" })
        );
        assert.strictEqual(record.report.totals.failed, 1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("records the compiler's diagnostics and its exit code", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo({
          "beep:check": "printf \"src/a.ts(1,7): error TS2322: Type 'a' is not assignable to type 'b'.\\n\"; exit 2",
        });
        const failed = yield* Effect.flip(runCheckGate(packageRoot, agent));
        assert.strictEqual(failed._tag === "GateToolExit" ? failed.exitCode : failed._tag, 2);
        const text = yield* logText;
        assert.isTrue(Str.startsWith("check @beep/demo")(text));
        assert.isTrue(Str.includes("TS2322")(text));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("runs through the `gate run check` command", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo({ "beep:check": "exit 0" });
        yield* Command.runWith(gateCommand, { version: "0.0.0" })(["run", "check", "--dir", packageRoot]);
        const text = yield* logText;
        assert.isTrue(Str.includes("check @beep/demo")(text));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("renders the record the test run wrote", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo({ "beep:test": COPY_RECORD });
        yield* writeRecordSource(packageRoot);
        yield* runTestGate(packageRoot, "beep:test", [], agent);
        const text = yield* logText;
        assert.isTrue(Str.startsWith("test @beep/demo")(text) && Str.includes("PASSED, 3/3 passed (12ms)")(text), text);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("records the run itself, errored with the log excerpt, when no fresh record exists", () =>
      Effect.gen(function* () {
        const { repoRoot, packageRoot } = yield* tempRepo({ "beep:test": "printf 'vitest crashed\\n'; exit 1" });
        const failed = yield* Effect.flip(runTestGate(packageRoot, "beep:test", [], agent));
        assert.strictEqual(failed._tag === "GateToolExit" ? failed.exitCode : failed._tag, 1);
        const record = yield* (yield* GateRecordStore.make(repoRoot)).readRecord(
          RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "test" })
        );
        assert.strictEqual(record.report.reason, "errored");
        assert.isTrue(
          A.some(record.report.items, (item) =>
            O.exists(item.detail, (detail) => Str.includes("vitest crashed")(detail.message))
          )
        );
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a directory that is not a package of a repository", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "gate-bare-" });
        const failed = yield* Effect.flip(requirePackage(bare));
        assert.strictEqual(failed._tag, "GateNotAPackage");
      })
    );

    it.effect("routes `beep test` and `beep check` in a package directory through the gates", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* tempRepo({
          check: "beep-cli gate run check",
          "beep:check": "exit 0",
          "beep:test": COPY_RECORD,
          "beep:lint": "exit 0",
        });
        yield* writeRecordSource(packageRoot);
        yield* pinCwd(packageRoot);
        yield* runQualityTask(invocation(["test", "--agent"]));
        yield* runQualityTask(invocation(["check", "--agent"]));
        yield* runQualityTask(invocation(["lint"]));
        const text = yield* logText;
        assert.isTrue(Str.includes("PASSED, 3/3 passed (12ms)")(text), text);
        assert.isTrue(Str.includes("check @beep/demo: PASSED")(text), text);
        assert.isTrue(Str.includes("beep:lint")(text), text);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("folds the records of the packages a root run named into one console", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { repoRoot } = yield* tempRepo({});
        const store = yield* GateRecordStore.make(repoRoot);
        yield* store.writeRecord(
          RecordTarget.cases.PackageTarget.make({ packageDir: PACKAGE_DIR, gate: "test" }),
          GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report: greenReport })
        );
        const summary = path.join(repoRoot, ".turbo/runs/one.json");
        yield* fs.makeDirectory(path.dirname(summary), { recursive: true });
        // The hit's restored record counts; the miss left only an older record.
        yield* fs.writeFileString(
          summary,
          '{"tasks":[{"task":"test","package":"@beep/demo","directory":"packages/demo","cache":{"status":"HIT"},"execution":{"exitCode":0}},{"task":"test","package":"@beep/stale","directory":"packages/demo","cache":{"status":"MISS"},"execution":{"exitCode":0}},{"task":"transit","package":"@beep/demo","directory":"packages/demo"},{"task":"test","package":"//","directory":"","cache":{"status":"HIT"}}]}'
        );
        const report = yield* recordRootRun({
          repoRoot,
          gate: "test",
          startedAt: DateTime.makeUnsafe(1),
          captured: CapturedRun.make({ exitCode: 0, output: new TextEncoder().encode(`Summary: ${summary}\n`) }),
          flags: agent,
        });
        assert.strictEqual(report.subject, "workspace");
        assert.strictEqual(report.totals.passed, 3);
        assert.strictEqual(report.totals.skipped, 2);
        const runs = yield* store.listRuns("test");
        assert.strictEqual(runs.length, 1);
        const noSummary = yield* recordRootRun({
          repoRoot,
          gate: "test",
          startedAt: DateTime.makeUnsafe(1),
          captured: CapturedRun.make({ exitCode: 1, output: new TextEncoder().encode("Summary: /missing.json\n") }),
          flags: agent,
        });
        assert.strictEqual(noSummary.reason, "errored");
        const bare = yield* recordRootRun({
          repoRoot,
          gate: "check",
          startedAt: DateTime.makeUnsafe(1),
          captured: CapturedRun.make({ exitCode: 0, output: new Uint8Array() }),
          flags: agent,
        });
        assert.strictEqual(bare.totals.collected, 0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    // No Turbo answers in the throwaway repository, so the root run reports itself
    // errored with the tool's output, prints one console and fails with its code.
    it.effect("runs the root unit lane as one gate console and fails with Turbo's code", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* tempRepo({});
        yield* pinCwd(repoRoot);
        const failed = yield* Effect.flip(runQualityTask(invocation(["test", "--unit", "--agent"])));
        const text = yield* logText;
        assert.isTrue(Str.startsWith("test workspace: ERRORED")(text), `console: ${text}`);
        assert.strictEqual(failed._tag, "GateToolExit");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
