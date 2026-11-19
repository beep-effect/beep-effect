// `beep gate show` and `beep gate item` against a throwaway repository: which
// record a query reads, what it prints, and the AC-L9 check that every pointer
// line of every console cell resolves in the repo CLI's real command tree.
import { FoldResult } from "@beep/gate-report/CauseFold";
import { CellContext, ConsoleInput, dispatchTable } from "@beep/gate-report/Dispatch";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals, Unit } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { RunOutcome, RunShape } from "@beep/gate-report/Vocabulary";
import {
  gateCommand,
  itemSelectorOf,
  QueryWhere,
  renderStoredRecord,
  resolveRunQuery,
  showItemLines,
  showRunLines,
} from "@beep/repo-cli/commands/Gate";
import { rootCommand } from "@beep/repo-cli/commands/Root";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import {
  commandText,
  repoCommands,
  repoGateCommandsFor,
  repoPointerTableFor,
  verifyPointerLine,
} from "@beep/repo-gate-run/RepoPointers";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const nowhere = QueryWhere.make({ dir: O.none(), run: O.none() });

const failed = Item.make({
  key: ItemKey.cases.TestKey.make({ file: "test/a.test.ts", fullName: "math > adds" }),
  unit: "test/a.test.ts",
  path: ["math"],
  name: "adds",
  outcome: "failed",
  failureKind: O.some("assertion"),
  location: Location.makeOption({ file: "test/a.test.ts", line: 3, column: 5 }),
  detail: ItemDetail.makeOption({ message: "expected 1 to be 2", diff: O.some("- 2\n+ 1") }),
});

const skipped = Item.make({
  key: ItemKey.cases.TestKey.make({ file: "test/a.test.ts", fullName: "math > later" }),
  unit: "test/a.test.ts",
  path: ["math"],
  name: "later",
  outcome: "skipped",
});

const passed = Item.make({
  key: ItemKey.cases.TestKey.make({ file: "test/a.test.ts", fullName: "math > subtracts" }),
  unit: "test/a.test.ts",
  path: ["math"],
  name: "subtracts",
  outcome: "passed",
});

const report = (subject: string, runId: string) =>
  GateReport.make({
    gate: "test",
    subject,
    itemKind: "test",
    runId,
    startedAt: DateTime.makeUnsafe(0),
    durationMs: 40,
    inputFingerprint: "x",
    reason: "failed",
    outcome: "some-fail",
    units: [
      Unit.make({ id: subject, kind: "package" }),
      Unit.make({ id: "test/a.test.ts", kind: "file", parent: O.some(subject) }),
      Unit.make({ id: "@beep/empty", kind: "package" }),
    ],
    items: [failed, skipped, passed],
    totals: Totals.make({ collected: 3, passed: 1, failed: 1, skipped: 1 }),
  });

// A repository root with one package record and two root runs of `test`.
const queryRepo = Effect.fn("GateQueryTest.queryRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "gate-query-" });
  const packageRoot = path.join(repoRoot, "packages/demo");
  yield* fs.makeDirectory(packageRoot, { recursive: true });
  yield* fs.writeFileString(path.join(repoRoot, "turbo.json"), "{}");
  yield* fs.writeFileString(path.join(packageRoot, "package.json"), '{"name":"@beep/demo"}');
  const store = yield* GateRecordStore.make(repoRoot);
  const write = (target: RecordTarget, subject: string, runId: string) =>
    store.writeRecord(target, GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report: report(subject, runId) }));
  yield* write(
    RecordTarget.cases.PackageTarget.make({ packageDir: "packages/demo", gate: "test" }),
    "@beep/demo",
    "p1"
  );
  yield* write(
    RecordTarget.cases.RootTarget.make({ gate: "test", runId: "20261119T000000000Z-0001" }),
    "workspace",
    "old"
  );
  yield* write(
    RecordTarget.cases.RootTarget.make({ gate: "test", runId: "20261119T000001000Z-0001" }),
    "workspace",
    "new"
  );
  return { repoRoot, packageRoot };
});

// Pin the working directory a query resolves against for the rest of the test.
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

describe("gate queries", { concurrent: false }, () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("on disk", (it) => {
    it.effect("shows a package record: verdict, units, numbered listed items and paths", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* queryRepo();
        const lines = yield* showRunLines("test", QueryWhere.make({ dir: O.some(packageRoot), run: O.none() }));
        assert.deepStrictEqual(lines, [
          "test @beep/demo: FAILED, 1/3 passed, 1 failed, 1 skipped (40ms)",
          "run: p1",
          "units: 2",
          "  @beep/demo (package, 1 files)",
          "  @beep/empty (package)",
          "listed items: 2",
          "  1. test/a.test.ts > math > adds [failed, assertion]",
          "  2. test/a.test.ts > math > later [skipped]",
          "record: packages/demo/.beep/gates/test/report.json",
          "log: packages/demo/.beep/gates/test/report.log",
        ]);
      })
    );

    it.effect("shows one item in full, by position or by text", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* queryRepo();
        const where = QueryWhere.make({ dir: O.some(packageRoot), run: O.none() });
        const byPosition = yield* showItemLines("test", "1", where);
        const byText = yield* showItemLines("test", "adds", where);
        assert.deepStrictEqual(byPosition, byText);
        assert.strictEqual(
          A.get(byPosition, 0).pipe(O.getOrUndefined),
          "run: p1 (record: packages/demo/.beep/gates/test/report.json)"
        );
        const text = A.join(byPosition, "\n");
        assert.isTrue(Str.includes("location: test/a.test.ts:3:5")(text));
        assert.isTrue(Str.includes("diff:\n  - 2\n  + 1")(text));
      })
    );

    it.effect("shows the newest root run from the repository root, or the one --run names", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* queryRepo();
        yield* pinCwd(repoRoot);
        const newest = yield* showRunLines("test", nowhere);
        const older = yield* showRunLines(
          "test",
          QueryWhere.make({ dir: O.none(), run: O.some("20261119T000000000Z-0001") })
        );
        assert.strictEqual(A.get(newest, 1).pipe(O.getOrUndefined), "run: new");
        assert.strictEqual(A.get(older, 1).pipe(O.getOrUndefined), "run: old");
      })
    );

    it.effect("reads the working directory's package record when no flag is given", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* queryRepo();
        yield* pinCwd(packageRoot);
        const resolved = yield* resolveRunQuery("test", nowhere);
        assert.strictEqual(resolved.query.scope._tag, "PackageRun");
      })
    );

    it.effect("refuses a directory outside any repository and a gate name that is not one", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "gate-query-bare-" });
        yield* pinCwd(bare);
        const outside = yield* Effect.flip(
          resolveRunQuery("test", QueryWhere.make({ dir: O.some("packages/demo"), run: O.none() }))
        );
        assert.strictEqual(outside._tag, "GateNotAPackage");
        const noRoot = yield* Effect.flip(resolveRunQuery("test", nowhere));
        assert.strictEqual(noRoot._tag, "GateNotAPackage");
        const badName = yield* Effect.flip(resolveRunQuery("Not A Gate", nowhere));
        assert.strictEqual(badName._tag, "SchemaError");
      })
    );

    it.effect("prints through the `gate show` and `gate item` commands", () =>
      Effect.gen(function* () {
        const { packageRoot } = yield* queryRepo();
        const run = Command.runWith(gateCommand, { version: "0.0.0" });
        yield* run(["show", "test", "--dir", packageRoot]);
        yield* run(["item", "test", "1", "--dir", packageRoot]);
        const text = yield* logText;
        assert.isTrue(Str.startsWith("test @beep/demo: FAILED")(text));
        assert.isTrue(Str.includes("message:\n  expected 1 to be 2")(text));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  it("reads a whole number as a position and anything else as text", () => {
    assert.strictEqual(itemSelectorOf("3")._tag, "ByPosition");
    assert.strictEqual(itemSelectorOf("0")._tag, "ByText");
    assert.strictEqual(itemSelectorOf("math > adds")._tag, "ByText");
  });
});

// AC-L9: render every cell of the dispatch table for both gates, with the
// pointers pinned to a package record and to a root run, and resolve every
// command of every pointer line in the repo CLI's real command tree.
const GATES = ["test", "check"] as const;

const targetsOf = (gate: (typeof GATES)[number]) => [
  RecordTarget.cases.PackageTarget.make({ packageDir: "packages/foundation/modeling/glob", gate }),
  RecordTarget.cases.RootTarget.make({ gate, runId: "20261119T000000000Z-0001" }),
];

const pointerLineOf = (input: ConsoleInput, shape: RunShape, outcome: RunOutcome): O.Option<string> =>
  O.map(
    dispatchTable[shape][outcome](
      CellContext.make({ input, fold: FoldResult.make({ folds: [], rest: input.report.items }) })
    ).pointer,
    (pointer) => `next: ${A.join(pointer.commands, "; ")}`
  );

const pinnedLines = A.flatMap(GATES, (gate) =>
  A.flatMap(targetsOf(gate), (target) =>
    A.flatMap(RunShape.literals, (shape) =>
      A.flatMap(RunOutcome.literals, (outcome) => {
        const cellReport = GateReport.make({
          ...report("@beep/glob", "r1"),
          gate,
          itemKind: gate === "check" ? "diagnostic" : "test",
          outcome,
        });
        const input = ConsoleInput.make({ report: cellReport, pointers: repoPointerTableFor(target) });
        return A.map(O.toArray(pointerLineOf(input, shape, outcome)), (line) => ({ line, target }));
      })
    )
  )
);

const pinnedCommands = A.flatMap(GATES, (gate) =>
  A.flatMap(targetsOf(gate), (target) => {
    const commands = repoGateCommandsFor(target);
    return [commands.showRun, commands.showItem];
  })
);

type AnyCommand = Command.Command.Any;

const childNamed = (command: AnyCommand, name: string): O.Option<AnyCommand> =>
  A.findFirst(
    A.flatMap(command.subcommands, (group) => group.commands),
    (child) => child.name === name
  );

// Walk the words down the tree while they name subcommands; the leaf command
// takes the rest (the gate, a selector, `--dir` or `--run`) as its input.
const resolveWords = (words: ReadonlyArray<string>): O.Option<AnyCommand> =>
  A.reduce(words, O.some<AnyCommand>(rootCommand), (current, word) =>
    O.flatMap(current, (command) =>
      A.isReadonlyArrayEmpty(command.subcommands) ? O.some(command) : childNamed(command, word)
    )
  );

describe("AC-L9 against the real command tree", () => {
  it("renders a pinned pointer line for every red cell of both gates and both record kinds", () => {
    assert.strictEqual(pinnedLines.length % 4, 0);
    assert.isTrue(A.isReadonlyArrayNonEmpty(pinnedLines));
  });

  it("every pointer line names only its record's live commands, never an MCP tool, a bare tool or a document", () => {
    for (const { line, target } of pinnedLines) {
      const commands = repoGateCommandsFor(target);
      assertSuccess(
        Result.map(verifyPointerLine(line, [commands.showRun, commands.showItem]), A.map(commandText)),
        Str.split(Str.slice("next: ".length)(line), "; ")
      );
      assert.isAtMost(line.length, 240);
    }
  });

  it("every pointer command, pinned or not, resolves to a leaf command of the repo CLI", () => {
    for (const command of [...repoCommands, ...pinnedCommands]) {
      assert.strictEqual(command.status, "live");
      assertSuccess(
        Result.fromOption(
          O.map(resolveWords(command.words), (found) => found.name),
          () => commandText(command)
        ),
        A.getUnsafe(command.words, 1)
      );
    }
  });

  it("does not resolve a command the tree lacks", () => {
    assertNone(resolveWords(["gate", "nonesuch", "test"]));
  });

  it("keeps a pointer for a deep package directory whole, inside the line limit", () => {
    const deep = `packages/${Str.repeat(15)("nested/")}package`;
    const line = commandText(
      repoGateCommandsFor(RecordTarget.cases.PackageTarget.make({ packageDir: deep, gate: "check" })).showRun
    );
    assert.isTrue(Str.endsWith(deep)(line));
    assert.isAtMost(`next: ${line}`.length, 240);
  });
});

// The next step works as printed: render a stored record's console, take the
// pointer line it printed, run that exact query, and get that record back.
const pointerOf = (text: string): ReadonlyArray<string> =>
  pipe(
    A.findFirst(Str.split(text, "\n"), Str.startsWith("next: bun run beep gate ")),
    O.map(flow(Str.slice("next: bun run beep gate ".length), Str.split(" "))),
    O.getOrElse((): ReadonlyArray<string> => [])
  );

describe("printed pointers", { concurrent: false }, () => {
  it.layer(NodeServices.layer, { timeout: "60 seconds" })("lead back to their record", (it) => {
    it.effect("a failing package run's pointer shows that package's record", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* queryRepo();
        yield* pinCwd(repoRoot);
        const target = RecordTarget.cases.PackageTarget.make({ packageDir: "packages/demo", gate: "test" });
        yield* renderStoredRecord(repoRoot, target, ConsoleSettings.make({ audience: "agent" }));
        const printed = yield* logText;
        const query = pointerOf(printed);
        assert.deepStrictEqual(query, ["show", "test", "--dir", "packages/demo"]);
        yield* Command.runWith(gateCommand, { version: "0.0.0" })(query);
        const shown = yield* logText;
        assert.isTrue(Str.includes("run: p1\n")(shown));
        assert.isTrue(Str.includes("record: packages/demo/.beep/gates/test/report.json")(shown));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("an older root run's pointer still shows that run after a newer one", () =>
      Effect.gen(function* () {
        const { repoRoot } = yield* queryRepo();
        yield* pinCwd(repoRoot);
        const older = RecordTarget.cases.RootTarget.make({ gate: "test", runId: "20261119T000000000Z-0001" });
        yield* renderStoredRecord(repoRoot, older, ConsoleSettings.make({ audience: "agent" }));
        const printed = yield* logText;
        const query = pointerOf(printed);
        assert.deepStrictEqual(query, ["show", "test", "--run", "20261119T000000000Z-0001"]);
        const lines = yield* showRunLines(
          A.getUnsafe(query, 1),
          QueryWhere.make({ dir: O.none(), run: O.some(A.getUnsafe(query, 3)) })
        );
        assert.strictEqual(A.get(lines, 1).pipe(O.getOrUndefined), "run: old");
        const newest = yield* showRunLines("test", nowhere);
        assert.strictEqual(A.get(newest, 1).pipe(O.getOrUndefined), "run: new");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
