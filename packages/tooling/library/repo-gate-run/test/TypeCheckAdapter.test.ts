import { RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { fingerprint, ItemKey } from "@beep/gate-report/ItemKey";
import { reduceEvents } from "@beep/gate-report/Reducer";
import { excerptBound } from "@beep/repo-gate-run/Excerpt";
import { ConsoleRequest } from "@beep/repo-gate-run/GateConsole";
import { applyLabels } from "@beep/repo-gate-run/GateHistory";
import {
  parseDiagnosticLine,
  parsePrettyDiagnostic,
  TsDiagnostic,
  tsDiagnosticPattern,
} from "@beep/repo-gate-run/TsDiagnostic";
import {
  CheckRun,
  CompilerRun,
  compilerEvents,
  UnbuiltProbe,
  UnbuiltReference,
  unbuiltReferenceEvents,
} from "@beep/repo-gate-run/TypeCheckAdapter";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { agentConsole, checkRun, epoch, linesOf } from "./support/fixtures.ts";
import type { GateReport } from "@beep/gate-report/GateReport";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const compilerOptions = {
  composite: true,
  declaration: true,
  outDir: "dist",
  rootDir: "src",
  strict: true,
  module: "nodenext",
  target: "es2022",
  skipLibCheck: true,
  types: [],
};

type FixtureProject = {
  readonly references: ReadonlyArray<string>;
  readonly sources: Readonly<Record<string, string>>;
};

const writeProject = Effect.fnUntraced(function* (dir: string, project: FixtureProject) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(dir, "src"), { recursive: true });
  const tsconfig = yield* encodeJson({
    compilerOptions,
    include: ["src"],
    references: A.map(project.references, (reference) => ({ path: reference })),
  });
  yield* fs.writeFileString(path.join(dir, "tsconfig.json"), tsconfig);
  yield* Effect.forEach(
    R.toEntries(project.sources),
    ([name, text]) => fs.writeFileString(path.join(dir, "src", name), text),
    { concurrency: 1 }
  );
});

const runCompilerFixture = Effect.fnUntraced(function* (
  projects: Readonly<Record<string, FixtureProject>>,
  checked: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const nonPackageTempRoot = yield* path.fromFileUrl(new URL("../../../../../node_modules/.tmp/", import.meta.url));
  const compiler = yield* path.fromFileUrl(new URL("../../../../../node_modules/.bin/tsrs", import.meta.url));
  yield* fs.makeDirectory(nonPackageTempRoot, { recursive: true });
  const dir = yield* fs.makeTempDirectoryScoped({ directory: nonPackageTempRoot, prefix: "gate-check-" });
  yield* Effect.forEach(R.toEntries(projects), ([name, project]) => writeProject(path.join(dir, name), project), {
    concurrency: 1,
  });
  const handle = yield* spawner.spawn(
    ChildProcess.make(compiler, ["-p", "tsconfig.json", "--noEmit", "--pretty", "false"], {
      cwd: path.join(dir, checked),
    })
  );
  const output = yield* handle.all.pipe(Stream.decodeText, Stream.mkString);
  const exitCode = yield* handle.exitCode;
  return { output, exitCode };
});

const reportOf = (events: ReadonlyArray<GateEvent>): GateReport =>
  Result.getOrThrowWith(reduceEvents(events), (error) => error);

const fixtureRun = CheckRun.make({
  runId: "r1",
  subject: "@fixture/consumer",
  startedAt: epoch,
  durationMs: 50,
  inputFingerprint: "x",
});

const paths = RecordPaths.make({
  record: "packages/fixture/consumer/.beep/gates/check/report.json",
  log: "packages/fixture/consumer/.beep/gates/check/report.log",
  logBytes: 900,
});

const render = (report: GateReport) =>
  linesOf(agentConsole.render(ConsoleRequest.make({ report, paths: O.some(paths) })).text);

const TS6305_FOLD =
  "TS6305 x6: upstream declarations are not built. Fix: bun x turbo run build --filter=@fixture/consumer^...";

describe("parsing compiler output", () => {
  it("reads the pretty form, the plain form and a diagnostic with no location", () => {
    assertSome(
      parsePrettyDiagnostic("src/a.ts:3:7 - error TS2322: nope"),
      TsDiagnostic.make({
        file: O.some("src/a.ts"),
        line: 3,
        column: 7,
        severity: "error",
        code: "TS2322",
        message: "nope",
      })
    );
    assertSome(
      parseDiagnosticLine("src/a.ts(3,7): warning TS6133: unused"),
      TsDiagnostic.make({
        file: O.some("src/a.ts"),
        line: 3,
        column: 7,
        severity: "warning",
        code: "TS6133",
        message: "unused",
      })
    );
    assertSome(
      parseDiagnosticLine("error TS6053: File 'x.ts' not found."),
      TsDiagnostic.make({
        file: O.none(),
        line: 0,
        column: 0,
        severity: "error",
        code: "TS6053",
        message: "File 'x.ts' not found.",
      })
    );
    assertNone(parseDiagnosticLine("Found 2 errors in 1 file."));
    assertNone(parsePrettyDiagnostic("src/a.ts(3,7): error TS2322: nope"));
    assert.strictEqual(tsDiagnosticPattern.exec("src/a.ts:3:7 error TS2322: nope")?.groups?.message, "nope");
  });

  it("keeps two diagnostics of one shape in one file as two items", () => {
    const report = reportOf(
      compilerEvents(
        CompilerRun.make({
          run: checkRun,
          exitCode: 2,
          output:
            "\u001b[96msrc/a.ts\u001b[0m:1:7 - error TS2322: Type 'string' is not assignable to type 'number'.\nsrc/a.ts(2,7): error TS2322: Type 'number' is not assignable to type 'string'.\n",
        })
      )
    );
    assert.strictEqual(report.items.length, 2);
    assert.strictEqual(report.totals.failed, 2);
    assert.strictEqual(A.dedupe(A.map(report.items, (item) => fingerprint(item.key))).length, 2);
  });

  it("reads a plain diagnostic whose file path holds parentheses", () => {
    assertSome(
      O.map(parseDiagnosticLine("src/a(b).ts(3,7): error TS2322: nope"), (diagnostic) => [
        O.getOrNull(diagnostic.file),
        diagnostic.line,
        diagnostic.column,
      ]),
      ["src/a(b).ts", 3, 7]
    );
  });

  it("an unexplained compiler failure carries a bounded excerpt of its output", () => {
    const excerptOf = (exitCode: number, output: string) =>
      O.flatMap(
        A.findFirst(
          compilerEvents(CompilerRun.make({ run: checkRun, exitCode, output })),
          GateEvent.guards.RunFinished
        ),
        (finish) => finish.logExcerpt
      );
    assertSome(excerptOf(1, "panic: boom"), "panic: boom");
    assertNone(excerptOf(1, ""));
    assertNone(excerptOf(0, "all good"));
    assertNone(excerptOf(2, "src/a.ts(1,1): error TS2322: x"));
    const long = O.getOrThrow(excerptOf(1, `HEAD${Str.repeat(20_000)("x")}TAIL`));
    assert.isAtMost(long.length, excerptBound.maxChars + excerptBound.truncatedNotice.length);
    assert.isTrue(Str.startsWith("HEAD")(long) && Str.endsWith("TAIL")(long));
  });

  it("keeps three location-less diagnostics of one shape apart by their messages", () => {
    const report = reportOf(
      compilerEvents(
        CompilerRun.make({
          run: checkRun,
          exitCode: 2,
          output: A.join(
            A.map(["a.ts", "b.ts", "c.ts", "a.ts"], (name) => `error TS6053: File '${name}' not found.`),
            "\n"
          ),
        })
      )
    );
    assert.strictEqual(report.totals.failed, 3);
  });

  it("history labels a repeated diagnostic by the key the reducer recorded, ordinal included", () => {
    const report = reportOf(
      compilerEvents(
        CompilerRun.make({
          run: checkRun,
          exitCode: 2,
          output:
            "src/a.ts(1,7): error TS2322: Type 'a' is not assignable to type 'b'.\nsrc/a.ts(2,7): error TS2322: Type 'c' is not assignable to type 'd'.\n",
        })
      )
    );
    const second = O.getOrThrow(A.get(report.items, 1));
    assertSome(
      O.flatMap(O.liftPredicate(second.key, ItemKey.guards.DiagnosticKey), (key) => key.occurrence),
      2
    );
    const labelled = applyLabels(report, { [fingerprint(second.key)]: "flaky" });
    assert.deepStrictEqual(
      A.map(labelled.items, (item) => O.getOrNull(item.label)),
      [null, "flaky"]
    );
  });

  it("a nonzero exit with no diagnostic is an errored run, a warning alone warns", () => {
    const crashed = reportOf(compilerEvents(CompilerRun.make({ run: checkRun, exitCode: 1, output: "panic: boom\n" })));
    const warned = reportOf(
      compilerEvents(
        CompilerRun.make({ run: checkRun, exitCode: 0, output: "src/a.ts(1,1): warning TS6133: x is unused.\n" })
      )
    );
    const clean = reportOf(compilerEvents(CompilerRun.make({ run: checkRun, exitCode: 0, output: "" })));
    const unlocated = reportOf(
      compilerEvents(CompilerRun.make({ run: checkRun, exitCode: 1, output: "error TS6053: File 'x.ts' not found.\n" }))
    );
    assert.deepStrictEqual(
      A.map(unlocated.items, (item) => item.unit),
      ["tsconfig.json"]
    );
    assert.strictEqual(crashed.reason, "errored");
    assert.strictEqual(warned.outcome, "warnings-only");
    assert.strictEqual(clean.reason, "passed");
    assert.deepStrictEqual(render(clean), ["check @beep/glob: PASSED, 0 errors, 0 warnings, 1 unit checked (900ms)"]);
  });

  it("the unbuilt-reference probe's finding folds to the TS6305 cause line", () => {
    const probe = UnbuiltProbe.make({
      run: fixtureRun,
      missing: A.makeBy(6, (index) =>
        UnbuiltReference.make({
          reference: `../upstream-${index}`,
          declarationFile: `../upstream-${index}/dist/index.d.ts`,
        })
      ),
    });
    const lines = render(reportOf(unbuiltReferenceEvents(probe)));
    assert.isAtMost(lines.length, 5);
    assert.include(lines, TS6305_FOLD);
    assert.strictEqual(
      lines[0],
      "check @fixture/consumer tsconfig.json: FAILED, 6 errors, 0 warnings, 1 unit checked (50ms)"
    );
  });
});

const upstreamModules = R.fromEntries(A.makeBy(6, (index) => [`m${index}.ts`, `export const m${index} = ${index};\n`]));

const consumerImports = A.join(
  A.makeBy(
    6,
    (index) => `import { m${index} } from "../../upstream/src/m${index}.ts";\nexport const c${index} = m${index};\n`
  ),
  ""
);

it.layer(NodeServices.layer, { timeout: "60 seconds" })("the real compiler", (it) => {
  it.effect("a check run with two diagnostics renders two entries through the check gate", () =>
    Effect.gen(function* () {
      const run = yield* runCompilerFixture(
        {
          consumer: {
            references: [],
            sources: { "index.ts": 'export const a: number = "x";\nexport const b: string = 1;\n' },
          },
        },
        "consumer"
      );
      const report = reportOf(
        compilerEvents(CompilerRun.make({ run: fixtureRun, exitCode: run.exitCode, output: run.output }))
      );
      const lines = render(report);
      assert.notStrictEqual(run.exitCode, 0);
      assert.strictEqual(report.totals.failed, 2);
      assert.strictEqual(A.filter(lines, Str.startsWith("- src/index.ts:")).length, 2);
      assert.strictEqual(
        lines[0],
        "check @fixture/consumer src/index.ts: FAILED, 2 errors, 0 warnings, 1 unit checked (50ms)"
      );
    })
  );

  it.effect("AC-L7: the TS6305 cascade of one unbuilt reference folds to at most five lines", () =>
    Effect.gen(function* () {
      const run = yield* runCompilerFixture(
        {
          upstream: { references: [], sources: upstreamModules },
          consumer: { references: ["../upstream"], sources: { "index.ts": consumerImports } },
        },
        "consumer"
      );
      const report = reportOf(
        compilerEvents(CompilerRun.make({ run: fixtureRun, exitCode: run.exitCode, output: run.output }))
      );
      const lines = render(report);
      assert.strictEqual(A.filter(linesOf(run.output), Str.includes("error TS6305")).length, 6);
      assert.strictEqual(report.totals.failed, 6);
      assert.isAtMost(lines.length, 5);
      assert.include(lines, TS6305_FOLD);
      assert.strictEqual(lines[0], A.lastNonEmpty(lines));
    })
  );
});
