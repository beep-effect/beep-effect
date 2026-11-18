// MEAS-06 (goals/certainty-scorecard, PLAN slice 13): the Test Unit timing projection. Each test builds a
// scratch workspace with Vitest JSON reports where the CI coverage producer writes them, plus the sealed
// manifest a passing shard leaves, and checks that every executed package gets a row and that executed files
// equal the selection per event.

import {
  ciUnitTimingsCommand,
  projectUnitTimings,
  UnitTimingOptions,
  UnitTimingPackage,
  UnitTimingProjection,
  UnitTimingShard,
  unitTimingCensus,
  writeUnitTimings,
} from "@beep/repo-cli/commands/Ci";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";

const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeProjection = S.decodeUnknownEffect(S.fromJsonString(UnitTimingProjection));

type FileResult = { readonly file: string; readonly start: number; readonly end: number; readonly tests: number };

const report = (root: string, success: boolean, files: ReadonlyArray<FileResult>) => ({
  success,
  numFailedTests: success ? 0 : 1,
  testResults: A.map(files, (file) => ({
    name: `${root}/${file.file}`,
    status: success ? "passed" : "failed",
    message: "",
    startTime: file.start,
    endTime: file.end,
    assertionResults: A.makeBy(file.tests, () => ({ status: "passed" })),
  })),
});

const selection = (
  packageName: string,
  packagePath: string,
  expectedTestFiles: ReadonlyArray<string>,
  invocationId = "0",
  shard?: { readonly index: number; readonly total: number }
) => ({
  selection: {
    packageName,
    packagePath,
    expectedTestFiles,
    testReportPath:
      invocationId === "0" ? "coverage/unit-results.json" : `coverage/invocation-${invocationId}/unit-results.json`,
    invocationId,
    ...(shard === undefined ? {} : { shard }),
  },
});

const workspace = Effect.fnUntraced(function* (packages: ReadonlyArray<readonly [string, string]>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-unit-timings-" });
  const real = yield* fs.realPath(root);
  const rootManifest = yield* encode({ name: "fixture", private: true, workspaces: A.map(packages, ([, dir]) => dir) });
  yield* fs.writeFileString(path.join(real, "package.json"), rootManifest);
  for (const [name, dir] of packages) {
    yield* fs.makeDirectory(path.join(real, dir), { recursive: true });
    const manifest = yield* encode({ name, version: "0.0.0" });
    yield* fs.writeFileString(path.join(real, dir, "package.json"), manifest);
  }
  const write = Effect.fnUntraced(function* (file: string, value: unknown) {
    yield* fs.makeDirectory(path.dirname(path.join(real, file)), { recursive: true });
    const text = typeof value === "string" ? value : yield* encode(value);
    yield* fs.writeFileString(path.join(real, file), text);
  });
  return { root: real, write };
});

const options = (partition: string, event = "push") =>
  UnitTimingOptions.make({
    partition,
    coverageOutput: `.beep/ci-coverage/${partition}`,
    event,
    runId: O.some(7),
    runAttempt: O.some(1),
    sha: O.some(Str.repeat(40)("a")),
  });

it.layer(NodeServices.layer, { timeout: "30 seconds" })("ci unit-timings", (it) => {
  it.effect("a sealed shard gives a row per executed invocation with its selection count", () =>
    Effect.gen(function* () {
      const { root, write } = yield* workspace([
        ["@beep/a", "packages/a"],
        ["@beep/b", "packages/b"],
        ["@beep/idle", "packages/idle"],
      ]);
      yield* write(
        "packages/a/coverage/unit-results.json",
        report(root, true, [
          { file: "packages/a/test/two.test.ts", start: 1_100, end: 1_400, tests: 2 },
          { file: "packages/a/test/one.test.ts", start: 1_000, end: 1_200, tests: 3 },
        ])
      );
      yield* write(
        "packages/b/coverage/invocation-1/unit-results.json",
        report(root, true, [{ file: "packages/b/test/node.test.ts", start: 5_000, end: 5_050, tests: 1 }])
      );
      yield* write(
        "packages/b/coverage/unit-results.json",
        report(root, true, [{ file: "packages/b/test/bun.test.ts", start: 4_000, end: 4_090, tests: 1 }])
      );
      yield* write(".beep/ci-coverage/unit-a/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [
          selection("@beep/a", "packages/a", ["packages/a/test/one.test.ts", "packages/a/test/two.test.ts"]),
          selection("@beep/b", "packages/b", ["packages/b/test/bun.test.ts"]),
          selection("@beep/b", "packages/b", ["packages/b/test/node.test.ts"], "1"),
        ],
      });
      const projection = yield* projectUnitTimings(root, options("unit-a"));
      strictEqual(projection.sealed, true);
      deepStrictEqual(
        A.map(projection.packages, (row) => [row.reportPath, row.invocationId, row.outcome, row.executedTestFiles]),
        [
          ["packages/a/coverage/unit-results.json", "0", "passed", 2],
          ["packages/b/coverage/invocation-1/unit-results.json", "1", "passed", 1],
          ["packages/b/coverage/unit-results.json", "0", "passed", 1],
        ]
      );
      const a = yield* Effect.fromOption(A.head(projection.packages));
      assertSome(a.expectedTestFiles, 2);
      strictEqual(a.wallMs, 400);
      strictEqual(a.fileMs, 500);
      deepStrictEqual(
        A.map(a.files, (file) => [file.path, file.durationMs, file.tests]),
        [
          ["packages/a/test/one.test.ts", 200, 3],
          ["packages/a/test/two.test.ts", 300, 2],
        ]
      );
      const push = yield* Effect.fromOption(A.head(unitTimingCensus([projection])));
      deepStrictEqual(
        [push.event, push.packages, push.executedTestFiles, push.expectedTestFiles, push.unmatched, push.unsealed],
        ["push", 3, 4, 4, [], []]
      );
    })
  );

  it.effect("a red shard still reports what it executed, unsealed, with unreadable reports kept", () =>
    Effect.gen(function* () {
      const { root, write } = yield* workspace([
        ["@beep/a", "packages/a"],
        ["@beep/b", "packages/b"],
      ]);
      yield* write(
        "packages/a/coverage/unit-results.json",
        report(root, false, [{ file: "packages/a/test/one.test.ts", start: 0, end: 10, tests: 1 }])
      );
      yield* write("packages/b/coverage/unit-results.json", "{ truncated");
      const projection = yield* projectUnitTimings(root, options("unit-a", "pull_request"));
      strictEqual(projection.sealed, false);
      deepStrictEqual(
        A.map(projection.packages, (row) => [row.packageName, row.outcome, row.executedTestFiles]),
        [
          ["@beep/a", "failed", 1],
          ["@beep/b", "unreadable", 0],
        ]
      );
      const first = yield* Effect.fromOption(A.head(projection.packages));
      assertNone(first.expectedTestFiles);
      const pr = yield* Effect.fromOption(A.head(unitTimingCensus([projection])));
      deepStrictEqual(
        [pr.event, pr.executedTestFiles, pr.unmatched, pr.unsealed],
        ["pull_request", 1, [], ["7:@beep/a:0", "7:@beep/b:0"]]
      );
    })
  );

  it.effect("a selected invocation with no report is a missing row and an unmatched census entry", () =>
    Effect.gen(function* () {
      const { root, write } = yield* workspace([["@beep/a", "packages/a"]]);
      yield* write(".beep/ci-coverage/unit-a/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [selection("@beep/a", "packages/a", ["packages/a/test/one.test.ts"])],
      });
      const projection = yield* projectUnitTimings(root, options("unit-a"));
      deepStrictEqual(
        A.map(projection.packages, (row) => [row.packageName, row.outcome, row.executedTestFiles]),
        [["@beep/a", "missing", 0]]
      );
      const push = yield* Effect.fromOption(A.head(unitTimingCensus([projection])));
      deepStrictEqual([push.expectedTestFiles, push.unmatched], [1, ["7:@beep/a:0"]]);
    })
  );

  it.effect("a report last written before this job's setup started is not this attempt's row", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, write } = yield* workspace([
        ["@beep/a", "packages/a"],
        ["@beep/b", "packages/b"],
      ]);
      yield* write(
        "packages/a/coverage/unit-results.json",
        report(root, true, [{ file: "packages/a/test/one.test.ts", start: 0, end: 10, tests: 1 }])
      );
      yield* write(
        "packages/b/coverage/unit-results.json",
        report(root, true, [{ file: "packages/b/test/one.test.ts", start: 0, end: 10, tests: 1 }])
      );
      // A kept self-hosted workspace: package b's report predates this job.
      const setupStartedAt = 1_800_000_000;
      yield* fs.utimes(
        path.join(root, "packages/a/coverage/unit-results.json"),
        DateTime.toDateUtc(DateTime.makeUnsafe(setupStartedAt * 1000)),
        DateTime.toDateUtc(DateTime.makeUnsafe((setupStartedAt + 60) * 1000))
      );
      yield* fs.utimes(
        path.join(root, "packages/b/coverage/unit-results.json"),
        DateTime.toDateUtc(DateTime.makeUnsafe(setupStartedAt * 1000)),
        DateTime.toDateUtc(DateTime.makeUnsafe((setupStartedAt - 3600) * 1000))
      );
      const projection = yield* projectUnitTimings(
        root,
        UnitTimingOptions.make({ ...options("unit-a"), writtenSince: O.some(setupStartedAt) })
      );
      deepStrictEqual(
        A.map(projection.packages, (row) => row.packageName),
        ["@beep/a"]
      );
      // When this attempt's manifest selects b, its stale report is not read back as a result: it is `missing`.
      yield* write(".beep/ci-coverage/unit-a/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [
          selection("@beep/a", "packages/a", ["packages/a/test/one.test.ts"]),
          selection("@beep/b", "packages/b", ["packages/b/test/one.test.ts"]),
        ],
      });
      const sealed = yield* projectUnitTimings(
        root,
        UnitTimingOptions.make({ ...options("unit-a"), writtenSince: O.some(setupStartedAt) })
      );
      deepStrictEqual(
        A.map(sealed.packages, (row) => [row.packageName, row.outcome, row.executedTestFiles]),
        [
          ["@beep/a", "passed", 1],
          ["@beep/b", "missing", 0],
        ]
      );
    })
  );

  it.effect("a manifest an earlier attempt left in the workspace does not seal this attempt", () =>
    Effect.gen(function* () {
      const { root, write } = yield* workspace([["@beep/a", "packages/a"]]);
      yield* write(
        "packages/a/coverage/unit-results.json",
        report(root, false, [{ file: "packages/a/test/one.test.ts", start: 0, end: 10, tests: 1 }])
      );
      yield* write(".beep/ci-coverage/unit-a/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [selection("@beep/a", "packages/a", ["packages/a/test/one.test.ts"])],
      });
      const projection = yield* projectUnitTimings(
        root,
        UnitTimingOptions.make({ ...options("unit-a"), runAttempt: O.some(2) })
      );
      strictEqual(projection.sealed, false);
      const row = yield* Effect.fromOption(A.head(projection.packages));
      deepStrictEqual([row.outcome, row.executedTestFiles], ["failed", 1]);
      assertNone(row.expectedTestFiles);
    })
  );

  it.effect("a sharded package's partitions add up to its selection across a re-run, and events stay apart", () =>
    Effect.sync(() => {
      const shard = (event: string, runId: number, index: number, executed: number, attempt = 1) =>
        UnitTimingProjection.make({
          schemaVersion: "unit-timings/v1",
          partition: `repo-cli-${index}`,
          event,
          runId: O.some(runId),
          runAttempt: O.some(attempt),
          sha: O.none(),
          sealed: true,
          packages: [
            UnitTimingPackage.make({
              packageName: "@beep/repo-cli",
              packagePath: "packages/tooling/tool/cli",
              invocationId: "0",
              reportPath: "packages/tooling/tool/cli/coverage/unit-results.json",
              outcome: "passed",
              wallMs: 1,
              fileMs: 1,
              executedTestFiles: executed,
              expectedTestFiles: O.some(10),
              shard: O.some(UnitTimingShard.make({ index, total: 2 })),
              files: [],
            }),
          ],
        });
      const census = unitTimingCensus([
        shard("push", 1, 1, 6),
        shard("push", 1, 2, 4),
        shard("pull_request", 2, 1, 6),
        shard("pull_request", 2, 2, 3),
        // "Re-run failed jobs": shard 2 failed on attempt 1 and passed on attempt 2; shard 1 stays on attempt 1.
        shard("merge_group", 3, 1, 6),
        shard("merge_group", 3, 2, 4, 2),
        shard("merge_group", 3, 2, 1),
        // A local projection carries no run identity; both shards ran in it.
        UnitTimingProjection.make({ ...shard("local", 0, 1, 6), runId: O.none(), runAttempt: O.none() }),
        UnitTimingProjection.make({ ...shard("local", 0, 2, 4), runId: O.none(), runAttempt: O.none() }),
        UnitTimingProjection.make({ ...shard("local", 0, 2, 4), runId: O.none(), runAttempt: O.none() }),
      ]);
      deepStrictEqual(
        A.map(census, (row) => [
          row.event,
          row.projections,
          row.packages,
          row.executedTestFiles,
          row.expectedTestFiles,
          row.unmatched,
        ]),
        [
          ["local", 2, 1, 10, 10, []],
          ["merge_group", 2, 1, 10, 10, []],
          ["pull_request", 2, 1, 9, 10, ["2:@beep/repo-cli:0"]],
          ["push", 2, 1, 10, 10, []],
        ]
      );
    })
  );

  it.effect("reads invocation-only, empty and relative-path reports and a sharded selection", () =>
    Effect.gen(function* () {
      const { root, write } = yield* workspace([
        ["@beep/c", "packages/c"],
        ["@beep/d", "packages/d"],
      ]);
      // Package c ran only its second invocation, and its report names files relative to the checkout.
      yield* write("packages/c/coverage/invocation-1/unit-results.json", {
        success: true,
        testResults: [
          { name: "packages/c/test/one.test.ts", status: "passed", startTime: 0, endTime: 4, assertionResults: [] },
        ],
      });
      // Package d ran no test file.
      yield* write("packages/d/coverage/unit-results.json", report(root, true, []));
      yield* write(".beep/ci-coverage/repo-cli-1/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [
          selection("@beep/c", "packages/c", ["packages/c/test/one.test.ts", "packages/c/test/two.test.ts"], "1", {
            index: 1,
            total: 2,
          }),
        ],
      });
      const projection = yield* projectUnitTimings(root, options("repo-cli-1"));
      deepStrictEqual(
        A.map(projection.packages, (row) => [
          row.reportPath,
          row.executedTestFiles,
          row.wallMs,
          O.getOrNull(O.map(row.shard, (shard) => `${shard.index}/${shard.total}`)),
          A.map(row.files, (file) => file.path),
        ]),
        [
          ["packages/c/coverage/invocation-1/unit-results.json", 1, 4, "1/2", ["packages/c/test/one.test.ts"]],
          ["packages/d/coverage/unit-results.json", 0, 0, null, []],
        ]
      );
    })
  );

  it.effect("the command writes a projection stamped with the Actions run identity", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, write } = yield* workspace([["@beep/a", "packages/a"]]);
      yield* write(
        "packages/a/coverage/unit-results.json",
        report(root, true, [{ file: "packages/a/test/one.test.ts", start: 0, end: 5, tests: 1 }])
      );
      const out = ".beep/ci-unit-timings/unit-a.json";
      yield* writeUnitTimings(root, "unit-a", ".beep/ci-coverage/unit-a", out).pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnvRecord({
            GITHUB_EVENT_NAME: "merge_group",
            GITHUB_RUN_ID: "99",
            GITHUB_RUN_ATTEMPT: "2",
            GITHUB_SHA: Str.repeat(40)("b"),
          })
        )
      );
      const writtenText = yield* fs.readFileString(path.join(root, out));
      const written = yield* decodeProjection(writtenText);
      deepStrictEqual(
        [written.event, written.runId, written.runAttempt, written.sealed, A.length(written.packages)],
        ["merge_group", O.some(99), O.some(2), false, 1]
      );
      // Outside Actions the event is `local` and no attempt filters the manifest, so the shard seals.
      yield* write(".beep/ci-coverage/unit-a/manifest.json", {
        schemaVersion: "coverage-producer/v1",
        identity: { runId: "7", runAttempt: 1 },
        packages: [selection("@beep/a", "packages/a", ["packages/a/test/one.test.ts"])],
      });
      const local = yield* writeUnitTimings(root, "unit-a", ".beep/ci-coverage/unit-a", out).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({}))
      );
      deepStrictEqual([local.event, local.sealed, local.runId], ["local", true, O.none()]);
    })
  );
});

// The command resolves the checkout it runs in, so it projects this repository's own workspaces (whatever
// reports they hold) and writes only to the scratch path it is given.
const CommandLayer = Layer.mergeAll(
  NodeServices.layer,
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
  ),
  TestConsole.layer
);
const runUnitTimingsCommand = Command.runWith(ciUnitTimingsCommand, { version: "0.0.0" });

it.layer(CommandLayer, { timeout: "60 seconds" })("ci unit-timings command", (it) => {
  it.effect("writes a decodable projection for the checkout it runs in", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-unit-timings-command-" });
      const out = path.join(temp, "out", "unit-a.json");
      yield* runUnitTimingsCommand([
        "--partition",
        "unit-a",
        "--coverage-output",
        path.join(temp, "no-coverage"),
        "--out",
        out,
      ]);
      const text = yield* fs.readFileString(out);
      const written = yield* decodeProjection(text);
      deepStrictEqual([written.partition, written.sealed], ["unit-a", false]);
    })
  );
});
