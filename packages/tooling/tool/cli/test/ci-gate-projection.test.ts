import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import {
  AnnotationTally,
  appendGateReports,
  CiGateProjection,
  CiProjectionRequest,
  CiRunnerOutputsLive,
  ciAppendGateReportsCommand,
  ciProjectionLimits,
  JobGateRecord,
  renderCiProjection,
} from "@beep/repo-cli/commands/Ci";
import { renderStoredRecord } from "@beep/repo-cli/commands/Gate";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";
import type { CiProjection } from "@beep/repo-cli/commands/Ci";

const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);
const PACKAGE = "packages/foundation/primitive/glob";

type ItemSpec = {
  readonly file: string;
  readonly name: string;
  readonly outcome?: Item["outcome"];
  readonly message?: string;
  readonly located?: boolean;
  readonly code?: string;
};

const item = (spec: ItemSpec): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: spec.file, fullName: `suite > ${spec.name}` }),
    unit: spec.file,
    path: spec.name === "" ? [] : ["suite"],
    name: spec.name,
    outcome: spec.outcome ?? "failed",
    location: spec.located === false ? O.none() : Location.makeOption({ file: spec.file, line: 12, column: 5 }),
    detail: pipe(
      O.fromUndefinedOr(spec.message),
      O.map((message) => ItemDetail.make({ message: `${message}\nsecond line` }))
    ),
    code: O.fromUndefinedOr(spec.code),
  });

const report = (overrides: Partial<Parameters<typeof GateReport.make>[0]>): GateReport =>
  GateReport.make({
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    runId: "20261122T100000000Z-0001",
    startedAt: DateTime.makeUnsafe(0),
    durationMs: 1200,
    inputFingerprint: "fingerprint",
    reason: "failed",
    outcome: "some-fail",
    units: [],
    items: [],
    totals: Totals.make({ collected: 3, passed: 1, failed: 2 }),
    ...overrides,
  });

const packageTarget = (gate = "test", packageDir = PACKAGE) =>
  RecordTarget.cases.PackageTarget.make({ packageDir, gate });

const found = (gateReport: GateReport, target: RecordTarget = packageTarget(), logBytes = O.some(2048)) =>
  JobGateRecord.make({ target, report: gateReport, logBytes });

const request = (records: ReadonlyArray<JobGateRecord>, annotationsUsed = 0) =>
  CiProjectionRequest.make({ records, artifact: "task-outcomes-1-1-test-unit-shard-unit-a", annotationsUsed });

const fencedBlocks = (summary: string): ReadonlyArray<ReadonlyArray<string>> =>
  A.reduce(
    Str.split(summary, "\n"),
    { blocks: A.empty<ReadonlyArray<string>>(), open: O.none<ReadonlyArray<string>>() },
    (state, line) =>
      O.match(state.open, {
        onNone: () => (Str.startsWith("```")(line) ? { ...state, open: O.some(A.empty<string>()) } : state),
        onSome: (lines) =>
          Str.startsWith("```")(line)
            ? { blocks: A.append(state.blocks, lines), open: O.none() }
            : { ...state, open: O.some(A.append(lines, line)) },
      })
  ).blocks;

const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

const offRunner = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));
const onRunner = (summaryFile: string) =>
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromUnknown({ GITHUB_STEP_SUMMARY: summaryFile })
  );
const withOutputs = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(provideScopedLayer(Layer.merge(CiGateProjection.layer, CiRunnerOutputsLive)));

const CommandSupport = Layer.mergeAll(
  Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("unused"),
      readInput: Effect.die("unused"),
      readLine: Effect.die("unused"),
      display: () => Effect.void,
    })
  )
);
const runAppendCommand = Command.runWith(ciAppendGateReportsCommand, { version: "0.0.0" });

const logLines = (projection: CiProjection) => Str.split(projection.log, "\n");

const runnerReadsAsWorkflowCommand = (line: string): boolean => /^\s*::/u.test(line);

it.layer(Layer.merge(NodeServices.layer, CommandSupport), { timeout: "60 seconds" })(
  "ci gate projection on disk",
  (it) => {
    it.effect("AC 2: the summary's verdict and failure lines are the local agent console's, in order", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-gate-projection-" });
        const repoRoot = yield* fs.realPath(temp);
        const red = report({
          items: [
            item({ file: "src/a.test.ts", name: "adds", message: "expected 2 to be 3" }),
            item({ file: "src/b.test.ts", name: "splits", message: "expected [] to have length 1" }),
            item({ file: "src/a.test.ts", name: "subtracts", message: "expected 1 to be 0", code: "E1" }),
            item({ file: "src/a.test.ts", name: "passes", outcome: "passed" }),
          ],
        });
        const target = packageTarget();
        const store = yield* GateRecordStore.make(repoRoot);
        yield* store.writeLog(target, Stream.make(new TextEncoder().encode("raw tool output\n")));
        yield* store.writeRecord(target, GateRecord.make({ generatedAt: DateTime.makeUnsafe(0), report: red }));
        const local = yield* renderStoredRecord(repoRoot, target, ConsoleSettings.make({ audience: "agent" })).pipe(
          Effect.andThen(TestConsole.logLines),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );
        const agentLines = Str.split(A.join(A.map(local, String), "\n"), "\n");
        const printed = yield* appendGateReports(repoRoot, "task-outcomes-1-1-test-unit-shard-unit-a", 0).pipe(
          withOutputs,
          offRunner,
          Effect.andThen((projection) => Effect.map(TestConsole.logLines, (lines) => ({ projection, lines }))),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );
        const summary = O.match(printed.projection, { onNone: () => "", onSome: (projection) => projection.summary });
        deepStrictEqual(A.map(printed.lines, String).slice(-1), [summary]);
        const [block] = fencedBlocks(summary);
        deepStrictEqual(block, agentLines);
        strictEqual(
          A.head(agentLines).pipe(O.getOrElse(() => "")),
          "test @beep/glob: FAILED, 1/3 passed, 2 failed (1.2s)"
        );
        deepStrictEqual(A.filter(agentLines, Str.startsWith("- ")), [
          "- src/a.test.ts:12:5 > suite > adds",
          "- src/b.test.ts:12:5 > suite > splits",
          "- src/a.test.ts:12:5 E1 > suite > subtracts",
        ]);
        assertTrue(Str.includes("Records: artifact `task-outcomes-1-1-test-unit-shard-unit-a`")(summary));
      })
    );

    it.effect("a checkout with no gate record appends nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-gate-projection-empty-" });
        const result = yield* appendGateReports(temp, "artifact", 0).pipe(
          withOutputs,
          offRunner,
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );
        assertNone(result);
      })
    );

    it.effect("appends the summary to GITHUB_STEP_SUMMARY and refuses a negative annotation count", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-gate-projection-summary-" });
        const repoRoot = yield* fs.realPath(temp);
        const store = yield* GateRecordStore.make(repoRoot);
        yield* store.writeRecord(
          packageTarget(),
          GateRecord.make({
            generatedAt: DateTime.makeUnsafe(0),
            report: report({ items: [item({ file: "src/a.test.ts", name: "adds", message: "boom" })] }),
          })
        );
        const summaryFile = path.join(repoRoot, "summary.md");
        yield* fs.writeFileString(summaryFile, "");
        yield* appendGateReports(repoRoot, "artifact-a", 0).pipe(
          withOutputs,
          onRunner(summaryFile),
          Effect.provideServiceEffect(Console.Console, TestConsole.make)
        );
        const written = yield* fs.readFileString(summaryFile);
        assertTrue(Str.startsWith("### Gate reports")(written));
        const refused = yield* appendGateReports(repoRoot, "artifact-a", -1).pipe(
          withOutputs,
          onRunner(summaryFile),
          Effect.provideServiceEffect(Console.Console, TestConsole.make),
          Effect.flip
        );
        strictEqual(refused.message, "The artifact name must be non-empty and --annotations-used at least 0.");
      })
    );

    it.effect("the command refuses a negative annotation count before it searches the checkout", () =>
      Effect.gen(function* () {
        const exit = yield* runAppendCommand(["--artifact", "task-outcomes-1-1-labs", "--annotations-used", "-1"]).pipe(
          Effect.exit
        );
        strictEqual(exit._tag, "Failure");
        const errors = yield* TestConsole.errorLines;
        deepStrictEqual(A.map(errors, String), [
          "[ci] The artifact name must be non-empty and --annotations-used at least 0.",
        ]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  }
);

it.effect("AC 3: 200 failing items give 10 error annotations, a cap line and a summary under 64 KiB", () =>
  Effect.sync(() => {
    const items = A.makeBy(200, (index) =>
      item({
        file: `src/unit-${index % 7}.test.ts`,
        name: `case ${index}`,
        message: `${index === 0 ? "::error::injected " : ""}${Str.repeat(20)("expected value differs ")}`,
      })
    );
    const projection = renderCiProjection(
      request([found(report({ items, totals: Totals.make({ collected: 200, failed: 200 }) }))])
    );
    const lines = logLines(projection);
    const errors = A.filter(lines, Str.startsWith("::error "));
    strictEqual(errors.length, ciProjectionLimits.annotationsPerLevelPerStep);
    deepStrictEqual(projection.tally, AnnotationTally.make({ errors: 10, warnings: 0, unannotated: 190 }));
    assertTrue(utf8Length(projection.summary) < ciProjectionLimits.summaryBudgetBytes);
    assertTrue(A.some(Str.split(projection.summary, "\n"), (line) => /^\.\.\. \d+ more in the record$/u.test(line)));
    assertTrue(Str.includes("190 failing items were not annotated")(projection.summary));
    strictEqual(
      A.head(errors).pipe(O.getOrElse(() => "")),
      `::error title=test @beep/glob,file=${PACKAGE}/src/unit-0.test.ts,line=12,col=5::suite > case 0: ::error::injected ${Str.repeat(20)("expected value differs ")}`
    );
    assertTrue(
      A.every(A.filter(lines, runnerReadsAsWorkflowCommand), (line) =>
        /^::(error |warning |group::|endgroup::)/u.test(line)
      )
    );
    assertTrue(A.some(lines, Str.startsWith(`${ZERO_WIDTH_SPACE}  ::error::injected expected value differs`)));
    deepStrictEqual(
      A.map(A.filter(lines, Str.startsWith("::group::")), (line) =>
        Str.slice("::group::test @beep/glob: ".length)(line)
      ),
      A.makeBy(7, (index) => `src/unit-${index}.test.ts`)
    );
    strictEqual(A.last(lines).pipe(O.getOrElse(() => "")), "test @beep/glob: FAILED, 0/200 passed, 200 failed (1.2s)");
    strictEqual(
      A.last(lines).pipe(O.getOrElse(() => "")),
      A.head(A.getUnsafe(fencedBlocks(projection.summary), 0)).pipe(O.getOrElse(() => ""))
    );
  })
);

it.effect(
  "with 48 annotations used the job cap leaves two, for the first record's error and the next warning; unlocated and absolute items carry no position",
  () =>
    Effect.sync(() => {
      const warned = report({
        gate: "lint",
        reason: "passed",
        outcome: "warnings-only",
        totals: Totals.make({ collected: 2, passed: 1, warned: 1 }),
        items: [
          item({ file: "src/w.ts", name: "", outcome: "warned", code: "W1" }),
          item({ file: "/abs/x.ts", name: "absolute", outcome: "warned", message: "outside" }),
          item({ file: "src/y.ts", name: "", outcome: "warned", located: false, message: "only a message" }),
          item({ file: "src/s.ts", name: "skipped", outcome: "skipped" }),
        ],
      });
      const root = found(
        report({ items: [item({ file: "src/r.test.ts", name: "root" })] }),
        RecordTarget.cases.RootTarget.make({ gate: "test", runId: "20261122T100000000Z-0002" }),
        O.none()
      );
      const projection = renderCiProjection(request([root, found(warned, packageTarget("lint"))], 48));
      const lines = logLines(projection);
      deepStrictEqual(projection.tally, AnnotationTally.make({ errors: 1, warnings: 1, unannotated: 2 }));
      deepStrictEqual(
        A.filter(lines, (line) => /^::(error|warning) /u.test(line)),
        [
          "::error title=test @beep/glob,file=src/r.test.ts,line=12,col=5::suite > root",
          `::warning title=lint @beep/glob,file=${PACKAGE}/src/w.ts,line=12,col=5::W1`,
        ]
      );
      const unlimited = renderCiProjection(request([found(warned, packageTarget("lint"))]));
      deepStrictEqual(A.filter(logLines(unlimited), Str.startsWith("::warning")), [
        `::warning title=lint @beep/glob,file=${PACKAGE}/src/w.ts,line=12,col=5::W1`,
        "::warning title=lint @beep/glob::suite > absolute: outside",
        "::warning title=lint @beep/glob::only a message",
      ]);
      assertTrue(
        Str.includes("Annotated 0 errors and 3 warnings; 0 failing items were not annotated")(unlimited.summary)
      );
    })
);

it.effect(
  "green reports render their verdict alone, red reports come first, and an empty run's note prints outside any group",
  () =>
    Effect.sync(() => {
      const green = report({
        reason: "passed",
        outcome: "all-pass",
        totals: Totals.make({ collected: 1, passed: 1 }),
      });
      const projection = renderCiProjection(request([found(green)]));
      deepStrictEqual(fencedBlocks(projection.summary), [["test @beep/glob: PASSED, 1/1 passed (1.2s)"]]);
      strictEqual(projection.log, "test @beep/glob: PASSED, 1/1 passed (1.2s)");
      assertTrue(!Str.includes("Annotated")(projection.summary));
      const mixed = renderCiProjection(
        request([found(green), found(report({ items: [item({ file: "src/a.ts", name: "x" })] }))])
      );
      deepStrictEqual(
        A.map(fencedBlocks(mixed.summary), (block) => A.head(block).pipe(O.getOrElse(() => ""))),
        [
          "test @beep/glob > suite > x: FAILED, 1/3 passed, 2 failed (1.2s)",
          "test @beep/glob: PASSED, 1/1 passed (1.2s)",
        ]
      );
      const empty = renderCiProjection(request([found(report({ totals: Totals.make({ collected: 0 }), items: [] }))]));
      const lines = logLines(empty);
      deepStrictEqual(A.filter(lines, Str.startsWith("::group::")), []);
      assertTrue(Str.startsWith("Nothing collected.")(lines[0] ?? ""));
      strictEqual(A.last(lines).pipe(O.getOrElse(() => "")), "test @beep/glob: FAILED, 0 tests collected (1.2s)");
    })
);

it.effect("a summary too large for the budget leaves the last reports to the record artifact", () =>
  Effect.sync(() => {
    const records = A.makeBy(40, (index) =>
      found(
        report({
          subject: `@beep/package-${index}`,
          items: A.makeBy(30, (case_) =>
            item({ file: `src/p${index}.test.ts`, name: `case ${case_}`, message: Str.repeat(10)("long message ") })
          ),
        }),
        packageTarget("test", `packages/p${index}`)
      )
    );
    const projection = renderCiProjection(request(records));
    assertTrue(utf8Length(projection.summary) < ciProjectionLimits.summaryBudgetBytes);
    const shown = fencedBlocks(projection.summary).length;
    assertTrue(shown < 40);
    assertTrue(Str.includes(`${40 - shown} more reports are in the record artifact only.`)(projection.summary));
    assertSome(
      A.findFirst(Str.split(projection.summary, "\n"), Str.startsWith("Records: artifact")),
      "Records: artifact `task-outcomes-1-1-test-unit-shard-unit-a`"
    );
  })
);
