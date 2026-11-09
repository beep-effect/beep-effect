import {
  BuildVitestShardPlanOptions,
  buildVitestShardPlan,
  CI_LANE_PARTITIONS,
  CiPartitionFileTiming,
  checkCiPartitions,
  lptAssign,
  parseHostedTestUnitLog,
  renderCiPartitionReport,
  testUnitJobPartition,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
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
    expect(A.length(A.filter(sharded, (partition) => A.contains(partition.packages, "@beep/repo-cli")))).toBe(9);
    expect(
      A.length(A.filter(sharded, (partition) => A.contains(partition.packages, "@beep/law-practice-server")))
    ).toBe(12);
    assertSome(
      O.map(
        A.findFirst(CI_LANE_PARTITIONS, (partition) => partition.id === "unit-g"),
        (partition) => partition.id
      ),
      "unit-g"
    );
  });
});
