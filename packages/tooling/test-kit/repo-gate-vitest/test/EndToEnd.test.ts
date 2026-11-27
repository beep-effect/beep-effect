import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const runFixture = Effect.fn("RepoGateVitestTest.runFixture")(function* (
  name: string,
  files: Readonly<Record<string, string>>,
  script: O.Option<string> = O.none()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  const reporter = path.resolve(import.meta.dirname, "../src/Vitest.reporter.ts");
  const vitestEntry = yield* encodeJson(path.join(repoRoot, "node_modules/vitest/dist/index.js"));
  yield* fs.makeDirectory(path.join(repoRoot, ".beep"), { recursive: true });
  const root = yield* fs.makeTempDirectoryScoped({ directory: path.join(repoRoot, ".beep"), prefix: `${name}-` });
  const manifest = yield* encodeJson({
    name: `@fixture/${name}`,
    type: "module",
    scripts: O.match(script, { onNone: () => ({}), onSome: (test) => ({ test }) }),
  });
  yield* fs.writeFileString(path.join(root, "package.json"), manifest);
  const config = yield* encodeJson({
    test: { include: ["*.test.ts"], reporters: ["default", reporter], maxWorkers: 1, passWithNoTests: true },
  });
  yield* fs.writeFileString(path.join(root, "vitest.config.ts"), `export default ${config};\n`);
  yield* Effect.forEach(
    R.toEntries(files),
    ([file, source]) => fs.writeFileString(path.join(root, file), Str.replaceAll("VITEST", vitestEntry)(source)),
    { concurrency: 1 }
  );
  const command = O.match(script, {
    onNone: () => ["x", "--bun", "vitest", "run"],
    onSome: () => ["run", "test"],
  });
  const exitCode = yield* spawner.exitCode(ChildProcess.make("bun", command, { cwd: root, extendEnv: true }));
  const store = yield* GateRecordStore.make(repoRoot);
  const record = yield* store.readRecord(
    RecordTarget.cases.PackageTarget.make({ packageDir: path.relative(repoRoot, root), gate: "test" })
  );
  return { exitCode, report: record.report };
});

it.layer(NodeServices.layer, { timeout: "120 seconds" })("a real Vitest run", (it) => {
  it.effect("records a green run with every test passed", () =>
    Effect.gen(function* () {
      const { exitCode, report } = yield* runFixture("green", {
        "a.test.ts": 'import { expect, test } from VITEST;\ntest("adds", () => { expect(1 + 1).toBe(2); });\n',
      });
      assert.strictEqual(exitCode, 0);
      assert.strictEqual(report.reason, "passed");
      assert.strictEqual(report.outcome, "all-pass");
      assert.strictEqual(report.totals.passed, 1);
      assert.isTrue(Str.startsWith("@fixture/green")(report.subject));
    })
  );

  it.effect("records an assertion diff, a timeout and a module that failed to load", () =>
    Effect.gen(function* () {
      const { exitCode, report } = yield* runFixture("red", {
        "diff.test.ts":
          'import { expect, test } from VITEST;\ntest("compares", () => { expect({ a: 1 }).toEqual({ a: 2 }); });\n',
        "slow.test.ts":
          'import { test } from VITEST;\ntest("waits", () => new Promise((resolve) => setTimeout(resolve, 3000)), 100);\n',
        "load.test.ts": 'import "./missing-module.js";\n',
      });
      assert.notStrictEqual(exitCode, 0);
      assert.strictEqual(report.reason, "failed");
      assert.strictEqual(report.outcome, "some-fail");
      assert.strictEqual(report.totals.failed, 1);
      assert.strictEqual(report.totals.timedOut, 1);
      assert.strictEqual(report.totals.loadFailed, 1);
      const compares = A.findFirst(report.items, (item) => item.name === "compares");
      assert.isTrue(
        O.exists(
          pipe(
            compares,
            O.flatMap((item) => item.detail),
            O.flatMap((detail) => detail.diff)
          ),
          Str.isNonEmpty
        )
      );
      assert.isTrue(
        O.exists(
          pipe(
            compares,
            O.flatMap((item) => item.location)
          ),
          (location) => location.file === "diff.test.ts" && location.line === 2
        )
      );
    })
  );

  it.effect("records the two Vitest runs one script chains, Bun then Node, as one run", () =>
    Effect.gen(function* () {
      const { exitCode, report } = yield* runFixture(
        "chained",
        {
          "a.test.ts":
            'import { expect, test } from VITEST;\ntest("bun one", () => { expect(1).toBe(1); });\ntest("bun two", () => { expect(2).toBe(2); });\n',
          "node.test.ts": 'import { expect, test } from VITEST;\ntest("node", () => { expect(2).toBe(2); });\n',
        },
        O.some("bunx --bun vitest run --exclude=node.test.ts && BEEP_GATE_CONTINUES=1 bunx vitest run node.test.ts")
      );
      assert.strictEqual(exitCode, 0);
      assert.strictEqual(report.reason, "passed");
      assert.strictEqual(report.totals.passed, 3);
      assert.strictEqual(report.totals.collected, 3);
      assert.deepStrictEqual(
        A.sort(
          A.map(report.items, (item) => item.name),
          Str.Order
        ),
        ["bun one", "bun two", "node"]
      );
    })
  );

  it.effect("records an empty run as errored while Vitest exits 0", () =>
    Effect.gen(function* () {
      const { exitCode, report } = yield* runFixture("empty", {});
      assert.strictEqual(exitCode, 0);
      assert.strictEqual(report.reason, "errored");
      assert.strictEqual(report.totals.collected, 0);
    })
  );
});
