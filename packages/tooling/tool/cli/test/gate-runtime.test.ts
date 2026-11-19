// The gate module's shared pieces and the root fold, against throwaway
// repositories on disk: audience flags, console settings, capture, rendering
// a stored record, the tool exit, the summary path and the workspace events.

import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { Item, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { reduceEvents } from "@beep/gate-report/Reducer";
import {
  CapturedRun,
  captureRun,
  consoleSettings,
  exitWithTool,
  GateToolExit,
  PackageRun,
  renderStoredRecord,
  splitAudienceArgs,
  summaryPathOf,
  TurboSummaryTask,
  WorkspaceFold,
  workspaceEvents,
} from "@beep/repo-cli/commands/Gate";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const noFlags = { audience: [], human: [], agent: [], ci: [] };

const report = (input: {
  readonly subject: string;
  readonly reason?: "passed" | "failed" | "errored";
  readonly durationMs?: number;
  readonly items?: ReadonlyArray<Item>;
}) =>
  GateReport.make({
    gate: "test",
    subject: input.subject,
    itemKind: "test",
    runId: "r1",
    startedAt: DateTime.makeUnsafe(0),
    durationMs: input.durationMs ?? 10,
    inputFingerprint: "x",
    reason: input.reason ?? "passed",
    outcome: input.reason === "failed" ? "some-fail" : "all-pass",
    units: [
      Unit.make({ id: input.subject, kind: "package" }),
      Unit.make({ id: "test/a.test.ts", kind: "file", parent: O.some(input.subject) }),
    ],
    items: input.items ?? [],
    totals: Totals.make({ collected: A.length(input.items ?? []) || 1, passed: 1 }),
  });

const failedItem = Item.make({
  key: ItemKey.cases.TestKey.make({ file: "test/a.test.ts", fullName: "adds" }),
  unit: "test/a.test.ts",
  path: [],
  name: "adds",
  outcome: "failed",
  failureKind: O.some("assertion"),
  location: Location.makeOption({ file: "test/a.test.ts", line: 3, column: 1 }),
});

describe("splitAudienceArgs", () => {
  it("takes the audience flags out and keeps everything else for the tool", () => {
    const split = splitAudienceArgs(["--agent", "--bail=1", "--audience=ci", "--audience=bogus", "--human", "--ci"]);
    assert.deepStrictEqual(split.flags, { audience: ["ci"], human: [true], agent: [true], ci: [true] });
    assert.deepStrictEqual(split.rest, ["--bail=1"]);
  });
});

describe("exitWithTool", () => {
  it.effect("passes a zero exit and fails with the tool's code otherwise", () =>
    Effect.gen(function* () {
      yield* exitWithTool(GateToolExit.make({ gate: "check", subject: "@beep/a", exitCode: 0 }));
      const failing = GateToolExit.make({ gate: "check", subject: "@beep/a", exitCode: 2 });
      const failed = yield* exitWithTool(failing).pipe(Effect.flip);
      assert.strictEqual(failed.exitCode, 2);
      const error = GateToolExit.make({ gate: "check", subject: "@beep/a", exitCode: 2 });
      assert.strictEqual(Runtime.getErrorExitCode(error), 2);
      assert.isFalse(error[Runtime.errorReported]);
    })
  );
});

describe("consoleSettings", () => {
  it.effect("is plain when there is no standard output to ask", () =>
    Effect.gen(function* () {
      const settings = yield* consoleSettings({ ...noFlags, agent: [true] });
      assert.strictEqual(settings.color, "none");
    })
  );
});

describe("summaryPathOf", () => {
  it("finds the summary file Turbo named, through colour codes", () => {
    assertSome(
      summaryPathOf("x\n\u001b[1mSummary:\u001b[0m    /repo/.turbo/runs/abc.json\n"),
      "/repo/.turbo/runs/abc.json"
    );
    assertNone(summaryPathOf("no summary here"));
  });
});

const fold = (input: Parameters<typeof WorkspaceFold.make>[0]) => workspaceEvents(WorkspaceFold.make(input));

describe("workspaceEvents", () => {
  const settle = (events: ReturnType<typeof fold>) => Result.getOrThrowWith(reduceEvents(events), (error) => error);

  it("folds package reports under their directories with summed counts and durations", () => {
    const folded = settle(
      fold({
        gate: "test",
        runId: "root",
        startedAt: DateTime.makeUnsafe(0),
        inputFingerprint: "x",
        exitCode: 1,
        runs: [
          PackageRun.make({
            task: TurboSummaryTask.make({ task: "test", package: "@beep/a", directory: "packages/a" }),
            report: O.some(report({ subject: "@beep/a", reason: "failed", durationMs: 7, items: [failedItem] })),
          }),
          PackageRun.make({
            task: TurboSummaryTask.make({ task: "test", package: "@beep/b", directory: "packages/b" }),
            report: O.some(report({ subject: "@beep/b", durationMs: 5 })),
          }),
        ],
      })
    );
    assert.strictEqual(folded.subject, "workspace");
    assert.strictEqual(folded.durationMs, 12);
    assert.strictEqual(folded.reason, "failed");
    assert.strictEqual(folded.totals.collected, 2);
    const item = O.getOrThrow(A.head(folded.items));
    assert.deepStrictEqual(
      item.key,
      ItemKey.cases.TestKey.make({ file: "packages/a/test/a.test.ts", fullName: "adds" })
    );
    assertSome(
      O.map(item.location, (location) => location.file),
      "packages/a/test/a.test.ts"
    );
    assert.deepStrictEqual(
      A.map(folded.units, (unit) => unit.id),
      ["@beep/a", "packages/a/test/a.test.ts", "@beep/b", "packages/b/test/a.test.ts"]
    );
  });

  it("names a package that left no record: skipped after a clean exit, failed after a failed one", () => {
    const events = (exitCode: number) =>
      fold({
        gate: "check",
        runId: "root",
        startedAt: DateTime.makeUnsafe(0),
        inputFingerprint: "x",
        exitCode,
        runs: [
          PackageRun.make({
            task: TurboSummaryTask.make({
              task: "check",
              package: "@beep/c",
              directory: "packages/c",
              execution: { exitCode },
            }),
            report: O.none(),
          }),
        ],
      });
    const clean = settle(events(0));
    assert.strictEqual(clean.itemKind, "diagnostic");
    assert.strictEqual(clean.totals.skipped, 1);
    const failed = settle(events(2));
    assert.strictEqual(failed.totals.unhandled, 1);
    assert.strictEqual(failed.reason, "failed");
    const unknown = settle(
      fold({
        gate: "test",
        runId: "root",
        startedAt: DateTime.makeUnsafe(0),
        inputFingerprint: "x",
        exitCode: 0,
        runs: [
          PackageRun.make({
            task: TurboSummaryTask.make({ task: "test", package: "@beep/d", directory: "packages/d" }),
            report: O.none(),
          }),
        ],
      })
    );
    assert.strictEqual(unknown.itemKind, "test");
  });

  it("keeps a fault item on its package and a diagnostic under its directory", () => {
    const fault = Item.make({
      key: ItemKey.cases.FaultKey.make({ unit: "@beep/a", kind: "unhandled", name: "errored" }),
      unit: "@beep/a",
      path: [],
      name: "errored",
      outcome: "failed",
    });
    const diagnostic = Item.make({
      key: ItemKey.cases.DiagnosticKey.make({ file: "src/a.ts", code: "TS2322", shape: "nope" }),
      unit: "src/a.ts",
      path: [],
      name: "nope",
      outcome: "failed",
    });
    const folded = settle(
      fold({
        gate: "check",
        runId: "root",
        startedAt: DateTime.makeUnsafe(0),
        inputFingerprint: "x",
        exitCode: 1,
        runs: [
          PackageRun.make({
            task: TurboSummaryTask.make({ task: "check", package: "@beep/a", directory: "packages/a" }),
            report: O.some(report({ subject: "@beep/a", reason: "errored", items: [fault, diagnostic] })),
          }),
        ],
      })
    );
    assert.deepStrictEqual(
      A.map(folded.items, (item) => item.unit),
      ["@beep/a", "packages/a/src/a.ts"]
    );
    assert.strictEqual(folded.reason, "errored");
  });
});

it.layer(NodeServices.layer)("on disk", (it) => {
  it.effect("captures a tool's whole output and exit code without printing", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const captured = yield* captureRun({
        command: "sh",
        args: ["-c", 'printf "out\\n"; printf "err\\n" 1>&2; exit 3'],
        cwd: path.resolve("."),
        env: { GATE_PROBE: "1" },
      });
      assert.strictEqual(captured.exitCode, 3);
      const text = new TextDecoder().decode(captured.output);
      assert.isTrue(Str.includes("out")(text) && Str.includes("err")(text));
    })
  );

  it.effect("resolves the flagged audience over the detected one", () =>
    Effect.gen(function* () {
      const settings = yield* consoleSettings({ ...noFlags, agent: [true] });
      assert.strictEqual(settings.audience, "agent");
      const human = yield* consoleSettings({ ...noFlags, human: [true] });
      assert.strictEqual(human.audience, "human");
    })
  );

  it.effect("renders a stored record with its paths and the log's size", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-render-" });
      const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "test" });
      const store = yield* GateRecordStore.make(repoRoot);
      yield* store.writeRecord(
        target,
        GateRecord.make({
          generatedAt: DateTime.makeUnsafe(0),
          report: report({ subject: "@beep/a", reason: "failed", items: [failedItem] }),
        })
      );
      yield* fs.writeFileString(path.join(repoRoot, "packages/a/.beep/gates/test/report.log"), "four");
      yield* renderStoredRecord(repoRoot, target, ConsoleSettings.make({ audience: "agent" }));
      const lines = yield* TestConsole.logLines;
      const text = A.join(
        A.map(lines, (line) => `${line}`),
        "\n"
      );
      assert.isTrue(Str.includes("packages/a/.beep/gates/test/report.log (4 B)")(text));
      assert.isTrue(Str.startsWith("test @beep/a")(text));
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("renders a record whose log is missing without a path line", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-render-" });
      const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/a", gate: "test" });
      const store = yield* GateRecordStore.make(repoRoot);
      yield* store.writeRecord(
        target,
        GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report: report({ subject: "@beep/a" }) })
      );
      const record = yield* renderStoredRecord(repoRoot, target, ConsoleSettings.make({ audience: "agent" }));
      assert.strictEqual(record.report.subject, "@beep/a");
      assert.isTrue(CapturedRun.make({ exitCode: 0, output: new Uint8Array() }).exitCode === 0);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );
});
