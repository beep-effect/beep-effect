import {
  BuildVitestShardPlanOptions,
  buildVitestShardPlan,
  CI_LANE_PARTITIONS,
  CiLanePartition,
  CiLanePartitionShard,
  CiPartitionFileTiming,
  CiPartitionPackageTiming,
  CiPartitionRunTimings,
  CiPartitionTimingSource,
  checkCiPartitions,
  lptAssign,
  parseHostedTestUnitLog,
  pruneCiPartitionPlans,
  rebalanceCiPartitions,
  renderCiPartitionReport,
  testUnitJobPartition,
  VitestShardPlan,
  worstCaseRunTimings,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const esc = "\u001b";

describe("hosted Test Unit log parsing", () => {
  it("reads file and package timings from the raw REST log with ANSI colours", () => {
    const text = A.join(
      [
        `2026-11-09T04:10:04.2142655Z  ${esc}[32m✓${esc}[39m ${esc}[30m${esc}[42m shared ${esc}[49m${esc}[39m test/ci-runner-security.test.ts ${esc}[2m(${esc}[22m${esc}[2m57 tests${esc}[22m${esc}[2m)${esc}[22m${esc}[33m 46041${esc}[2mms${esc}[22m${esc}[39m`,
        `2026-11-09T04:10:04.3341000Z    ${esc}[32m✓${esc}[39m CI runner security ${esc}[2m(57)${esc}[22m`,
        `2026-11-09T04:10:05.0000000Z  ✓ test/plain.test.ts (3 tests | 1 skipped) 120ms`,
        `2026-11-09T04:10:06.0000000Z ${esc}[2m   Duration ${esc}[22m 252.72s${esc}[2m (tests 96%, transform 3%, import 1%)${esc}[22m`,
        `2026-11-09T04:10:06.1000000Z `,
        `2026-11-09T04:10:06.2000000Z JSON report written to /home/runner/work/beep-effect/beep-effect/packages/law-practice/domain/coverage/unit-results.json`,
      ],
      "\n"
    );
    const parsed = parseHostedTestUnitLog("repo-cli-4", text);
    expect(parsed.files).toEqual([
      CiPartitionFileTiming.make({
        partitionId: "repo-cli-4",
        file: "test/ci-runner-security.test.ts",
        milliseconds: 46041,
      }),
      CiPartitionFileTiming.make({ partitionId: "repo-cli-4", file: "test/plain.test.ts", milliseconds: 120 }),
    ]);
    expect(parsed.packages).toEqual([
      { partitionId: "repo-cli-4", packagePath: "packages/law-practice/domain", seconds: 252.72 },
    ]);
  });

  it("accepts the `gh run view --log` prefix and GitHub's literal escape renderings", () => {
    const text = A.join(
      [
        "Test Unit (unit-c)\tUNKNOWN STEP\t2026-11-09T04:08:48.1022797Z ^[[2m   Duration ^[[22m 89.76s^[[2m (tests 95%)^[[22m",
        "Test Unit (unit-c)\tUNKNOWN STEP\t2026-11-09T04:08:48.1023689Z JSON report written to /home/runner/work/beep-effect/beep-effect/packages/drivers/duckdb/coverage/invocation-1/unit-results.json",
        "Test Unit (unit-c)\tUNKNOWN STEP\t2026-11-09T04:08:49.0000000Z  ^[[32m✓^[[39m ^[[30m^[[42m replay ^[[49m^[[39m test/CitationExtractionLoop.test.ts ^[[2m(^[[22m^[[2m4 tests^[[22m^[[2m)^[[22m^[[33m 315700^[[2mms^[[22m^[[39m",
      ],
      "\n"
    );
    const parsed = parseHostedTestUnitLog("unit-c", text);
    expect(A.map(parsed.packages, (entry) => [entry.packagePath, entry.seconds])).toEqual([
      ["packages/drivers/duckdb", 89.76],
    ]);
    expect(A.map(parsed.files, (entry) => [entry.file, entry.milliseconds])).toEqual([
      ["test/CitationExtractionLoop.test.ts", 315700],
    ]);
  });

  it("maps shard job names onto table partitions and ignores other jobs", () => {
    assertSome(testUnitJobPartition("Test Unit (law-practice-12)"), "law-practice-12");
    assertNone(testUnitJobPartition("Test Unit"));
    assertNone(testUnitJobPartition("Lint (lint-a)"));
    assertNone(testUnitJobPartition("Test Unit (law-practice-13)"));
  });
});

describe("LPT packing", () => {
  it("assigns heaviest first to the lightest bin with stable tie-breaks", () => {
    const bins = lptAssign(
      [
        { key: "d", weight: 1, value: "d" },
        { key: "b", weight: 3, value: "b" },
        { key: "c", weight: 3, value: "c" },
        { key: "a", weight: 4, value: "a" },
      ],
      2
    );
    expect(bins).toEqual([
      { load: 5, items: ["a", "d"] },
      { load: 6, items: ["b", "c"] },
    ]);
    expect(lptAssign([], 3)).toEqual([
      { load: 0, items: [] },
      { load: 0, items: [] },
      { load: 0, items: [] },
    ]);
  });

  it("builds a plan that keeps a file's largest measurement and sorts shard members", () => {
    const timing = (partitionId: "repo-cli-1" | "repo-cli-2", file: string, milliseconds: number) =>
      CiPartitionFileTiming.make({ partitionId, file, milliseconds });
    const plan = buildVitestShardPlan(
      BuildVitestShardPlanOptions.make({
        files: [
          timing("repo-cli-1", "test/z.test.ts", 900),
          timing("repo-cli-2", "test/z.test.ts", 1100),
          timing("repo-cli-1", "test/a.test.ts", 1000),
          timing("repo-cli-2", "test/m.test.ts", 100),
        ],
        total: 2,
        sourceRun: 42554761567,
        sourceCommit: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
      })
    );
    expect(plan.sourceRun).toBe(42554761567);
    expect(plan.shards).toEqual([["test/z.test.ts"], ["test/a.test.ts", "test/m.test.ts"]]);
    expect(plan.estimatedMilliseconds).toEqual([1100, 1100]);
    expect(plan.fileMilliseconds).toEqual({ "test/a.test.ts": 1000, "test/m.test.ts": 100, "test/z.test.ts": 1100 });
  });
});

it.layer(NodeServices.layer)("committed partition plans", (it) => {
  it.effect("keep every Test Unit partition within budget and every sharded weight equal to its plan", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const report = yield* checkCiPartitions(repoRoot);
      const testUnit = A.filter(CI_LANE_PARTITIONS, (partition) => partition.lane === "test-unit");
      deepStrictEqual(
        A.map(report.rows, (row) => row.partitionId),
        A.map(testUnit, (partition) => partition.id)
      );
      deepStrictEqual(
        A.filter(report.rows, (row) => row.status !== "within"),
        []
      );
      // Plan files that no longer exist are advisory, never a failure: the plan is refreshed from a
      // later green run once the deletion has landed.
      expect(A.every(report.warnings, (warning) => Str.includes("no longer in")(warning))).toBe(true);
      const rendered = renderCiPartitionReport(report);
      expect(rendered[0]).toContain("partition");
      strictEqual(A.length(rendered), 1 + A.length(report.rows) + A.length(report.warnings));
    })
  );
});

describe("partition table shape", () => {
  it("covers every sharded partition id of the table exactly once", () => {
    const sharded = A.filter(CI_LANE_PARTITIONS, (partition) => P.isNotUndefined(partition.shard));
    const ids = HashSet.fromIterable(A.map(sharded, (partition) => partition.id));
    expect(HashSet.size(ids)).toBe(A.length(sharded));
    // The Test Unit families own the `vitest.shards.json` plans; the Test Integration family shares
    // law-practice-server's package but runs the separate `vitest.integration.shards.json` plan.
    const unit = A.filter(sharded, (partition) => partition.lane === "test-unit");
    expect(A.length(A.filter(unit, (partition) => A.contains(partition.packages, "@beep/repo-cli")))).toBe(11);
    expect(A.length(A.filter(unit, (partition) => A.contains(partition.packages, "@beep/law-practice-server")))).toBe(
      12
    );
    expect(A.length(A.filter(sharded, (partition) => partition.lane === "test-integration"))).toBe(19);
    assertSome(
      O.map(
        A.findFirst(CI_LANE_PARTITIONS, (partition) => partition.id === "unit-g"),
        (partition) => partition.id
      ),
      "unit-g"
    );
  });
});

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodePlan = S.decodeUnknownEffect(S.fromJsonString(VitestShardPlan));

const fixturePackages: ReadonlyArray<readonly [string, string]> = [
  ["@beep/repo-cli", "packages/tooling/tool/cli"],
  ["@beep/law-practice-server", "packages/law-practice/server"],
  ["@beep/glob", "packages/foundation/modeling/glob"],
  ["@beep/yaml", "packages/foundation/modeling/yaml"],
];

const shard = (
  id: "repo-cli-1" | "repo-cli-2" | "law-practice-1" | "law-practice-2",
  packageName: string,
  index: number
) =>
  CiLanePartition.make({
    id,
    lane: "test-unit",
    weightSeconds: 0,
    packages: [packageName],
    shard: CiLanePartitionShard.make({ index, total: 2 }),
  });

const fixtureTable: ReadonlyArray<CiLanePartition> = [
  shard("repo-cli-1", "@beep/repo-cli", 1),
  shard("repo-cli-2", "@beep/repo-cli", 2),
  shard("law-practice-1", "@beep/law-practice-server", 1),
  shard("law-practice-2", "@beep/law-practice-server", 2),
  CiLanePartition.make({ id: "unit-a", lane: "test-unit", weightSeconds: 0, packages: ["@beep/glob"] }),
  CiLanePartition.make({ id: "unit-b", lane: "test-unit", weightSeconds: 0, packages: ["@beep/yaml"] }),
];

const file = (
  partitionId: "repo-cli-1" | "repo-cli-2" | "law-practice-1" | "law-practice-2",
  name: string,
  ms: number
) => CiPartitionFileTiming.make({ partitionId, file: name, milliseconds: ms });

const fixtureTimings = CiPartitionRunTimings.make({
  runId: 7,
  headSha: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
  files: [
    file("repo-cli-1", "test/a.test.ts", 3000),
    file("repo-cli-2", "test/b.test.ts", 1000),
    file("repo-cli-1", "test/c.test.ts", 1000),
    file("law-practice-1", "test/x.test.ts", 2000),
    file("law-practice-2", "test/y.test.ts", 2000),
  ],
  packages: [
    CiPartitionPackageTiming.make({
      partitionId: "unit-a",
      packagePath: "packages/foundation/modeling/glob",
      seconds: 30,
    }),
    CiPartitionPackageTiming.make({
      partitionId: "unit-b",
      packagePath: "packages/foundation/modeling/yaml",
      seconds: 10,
    }),
  ],
});

describe("worst-case fold over runs", () => {
  it("keeps every measurement and the newest run's provenance", () => {
    const older = CiPartitionRunTimings.make({
      runId: 7,
      headSha: "older",
      files: [file("repo-cli-1", "test/a.test.ts", 3000)],
      packages: [],
    });
    const newer = CiPartitionRunTimings.make({
      runId: 9,
      headSha: "newer",
      files: [file("repo-cli-2", "test/a.test.ts", 1000), file("repo-cli-2", "test/b.test.ts", 500)],
      packages: [],
    });
    const folded = worstCaseRunTimings([newer, older]);
    strictEqual(folded.runId, 9);
    strictEqual(folded.headSha, "newer");
    const plan = buildVitestShardPlan(
      BuildVitestShardPlanOptions.make({
        files: folded.files,
        total: 1,
        sourceRun: folded.runId,
        sourceCommit: folded.headSha,
      })
    );
    deepStrictEqual(plan.fileMilliseconds, { "test/a.test.ts": 3000, "test/b.test.ts": 500 });
  });
});

const timingSource = (timings: CiPartitionRunTimings) =>
  CiPartitionTimingSource.of({
    collect: Effect.fn("CiPartitionsTest.collect")(() => Effect.succeed(timings)),
  });

/** A bare workspace checkout: a root manifest naming the packages and one manifest per package. */
const fixtureRepo = Effect.fn("CiPartitionsTest.fixtureRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-partitions-" });
  const rootManifest = yield* encodeJson({
    name: "fixture",
    private: true,
    workspaces: A.map(fixturePackages, ([, packagePath]) => packagePath),
  });
  yield* fs.writeFileString(path.join(root, "package.json"), rootManifest);
  yield* Effect.forEach(fixturePackages, ([name, packagePath]) =>
    Effect.gen(function* () {
      yield* fs.makeDirectory(path.join(root, packagePath), { recursive: true });
      const manifest = yield* encodeJson({ name, version: "0.0.0" });
      yield* fs.writeFileString(path.join(root, packagePath, "package.json"), manifest);
    })
  );
  return root;
});

it.layer(Layer.merge(NodeServices.layer, NodeCrypto.layer))("rebalance from a measured run", (it) => {
  it.effect("repacks both sharded families into the table's shard counts and proposes the bins", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fixtureRepo();
      const lines = yield* rebalanceCiPartitions(root, [7], fixtureTable).pipe(
        Effect.provideService(CiPartitionTimingSource, timingSource(fixtureTimings))
      );
      const repoPlan = yield* fs
        .readFileString(path.join(root, "packages/tooling/tool/cli/vitest.shards.json"))
        .pipe(Effect.flatMap(decodePlan));
      deepStrictEqual(repoPlan.shards, [["test/a.test.ts"], ["test/b.test.ts", "test/c.test.ts"]]);
      deepStrictEqual(repoPlan.estimatedMilliseconds, [3000, 2000]);
      strictEqual(repoPlan.sourceRun, 7);
      const lawPlan = yield* fs
        .readFileString(path.join(root, "packages/law-practice/server/vitest.shards.json"))
        .pipe(Effect.flatMap(decodePlan));
      deepStrictEqual(lawPlan.estimatedMilliseconds, [2000, 2000]);
      assertTrue(A.some(lines, Str.includes("repo-cli-1: 3.0 s planned; table weightSeconds 0 -> set 3")));
      assertTrue(A.some(lines, Str.includes("bin proposal: 2 measured packages over 2 bins")));
      // LPT puts the heavier package (@beep/glob, 30 s) in the first bin and the lighter one in the second.
      const proposal = A.dropWhile(lines, (line) => !Str.startsWith("bin proposal")(line));
      deepStrictEqual(
        A.filter(proposal, (line) => Str.startsWith("  unit-")(line) || Str.startsWith('    "@beep/')(line)),
        [
          "  unit-a: weightSeconds 30 (table 0)",
          '    "@beep/glob",',
          "  unit-b: weightSeconds 10 (table 0)",
          '    "@beep/yaml",',
        ]
      );
    })
  );

  it.effect("refuses a run that carries no timings for a sharded family", () =>
    Effect.gen(function* () {
      const root = yield* fixtureRepo();
      const timings = CiPartitionRunTimings.make({
        ...fixtureTimings,
        files: A.filter(fixtureTimings.files, (timing) => !Str.startsWith("law-practice-")(timing.partitionId)),
      });
      const error = yield* rebalanceCiPartitions(root, [7], fixtureTable).pipe(
        Effect.provideService(CiPartitionTimingSource, timingSource(timings)),
        Effect.flip
      );
      assertTrue(Str.includes("has no law-practice file timings")(error.message));
    })
  );
});

it.layer(Layer.merge(NodeServices.layer, NodeCrypto.layer))("prune committed plans", (it) => {
  it.effect("drops files that no longer exist and re-packs the survivors from their own measurements", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fixtureRepo();
      for (const [, packagePath] of A.take(fixturePackages, 2)) {
        yield* fs.makeDirectory(path.join(root, packagePath, "test"), { recursive: true });
        yield* fs.writeFileString(path.join(root, packagePath, "test/a.test.ts"), "");
        yield* fs.writeFileString(path.join(root, packagePath, "test/b.test.ts"), "");
      }
      const committed = yield* encodeJson({
        sourceRun: 11,
        sourceCommit: "b80e11050714191c6d0ff58e8371e9d4c3f17880",
        estimatedMilliseconds: [5000, 3000],
        shards: [["test/a.test.ts", "test/gone.test.ts"], ["test/b.test.ts"]],
        fileMilliseconds: { "test/a.test.ts": 1000, "test/b.test.ts": 3000, "test/gone.test.ts": 4000 },
      });
      yield* fs.writeFileString(path.join(root, "packages/tooling/tool/cli/vitest.shards.json"), committed);
      yield* fs.writeFileString(path.join(root, "packages/law-practice/server/vitest.shards.json"), committed);
      const lines = yield* pruneCiPartitionPlans(root, fixtureTable);
      const plan = yield* fs
        .readFileString(path.join(root, "packages/tooling/tool/cli/vitest.shards.json"))
        .pipe(Effect.flatMap(decodePlan));
      deepStrictEqual(plan.shards, [["test/b.test.ts"], ["test/a.test.ts"]]);
      deepStrictEqual(plan.estimatedMilliseconds, [3000, 1000]);
      strictEqual(plan.sourceRun, 11);
      assertTrue(A.some(lines, Str.includes("(1 removed file(s) dropped)")));
      assertTrue(A.some(lines, Str.includes("repo-cli-1: 3.0 s planned; table weightSeconds 0 -> set 3")));
    })
  );
});
