import { Git } from "@beep/git/Git";
import { agentEffectivenessCommand } from "@beep/repo-cli/commands/AgentEffectiveness";
import {
  AgentEffectivenessEvalScoreBreakdown,
  AgentEffectivenessEvalScoreReport,
  buildSkillLaneProbeReport,
  decideSkillLaneProbe,
  estimateClusteredMean,
  fixedTaskInterval,
  holmAdjust,
  runSkillLaneProbeReport,
  SkillLaneProbeReport,
  SkillLaneProbeVerdict,
  SkillProbeFingerprint,
  SkillProbeOutcome,
  SkillProbePreflight,
  SkillProbeRunRecord,
  skillLanePermutationTest,
} from "@beep/repo-cli/test/AgentEffectiveness";
import { Sha256Hex } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { privacySafeSystemTempRoot } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import type { SkillLaneTaskValues } from "@beep/repo-cli/test/AgentEffectiveness";

const fingerprint = SkillProbeFingerprint.make({
  modelId: "claude-opus-5-5",
  claudeVersion: "2.1.323",
  skillSha256: Sha256Hex.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
  lawsSha256: Sha256Hex.make("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
});

const scored = (laneFraction: number) =>
  SkillProbeOutcome.cases.Scored.make({
    report: AgentEffectivenessEvalScoreReport.make({
      taskId: "t",
      score: laneFraction,
      breakdown: AgentEffectivenessEvalScoreBreakdown.make({
        completion: laneFraction,
        schemaFirst: 1,
        tsgo: 1,
        biome: 1,
      }),
      violations: [],
    }),
    allLanesPass: laneFraction === 1,
    laneFraction,
  });

const run = (
  taskId: string,
  family: string,
  cell: "B" | "C",
  runIndex: number,
  laneFraction: O.Option<number>,
  attempt = 1
) =>
  SkillProbeRunRecord.make({
    schemaVersion: "skill-probe-run/v1",
    taskId,
    family,
    cell,
    invocation: "test",
    runIndex: runIndex + (attempt - 1) * 100,
    slot: `${taskId}#${cell}#${runIndex}`,
    attempt,
    keptDir: "none",
    scorerProfile: "skill-probe-scorer/v3",
    fingerprint,
    fired: cell === "C",
    anySkillFired: cell === "C",
    turns: 10,
    durationSeconds: 30,
    costUsd: 0.1,
    startedAt: "2026-11-13T00:00:00.000Z",
    outcome: O.match(laneFraction, {
      onNone: () => SkillProbeOutcome.cases.Excluded.make({ reason: "rate limit" }),
      onSome: scored,
    }),
  });

const cellRuns = (taskId: string, family: string, cell: "B" | "C", values: ReadonlyArray<number>) =>
  A.map(values, (value, index) => run(taskId, family, cell, index, O.some(value)));

const FAMILIES = ["fn-schema", "getsomes-struct", "normalization", "null-return"];
const TASKS = A.flatMap(FAMILIES, (family) =>
  A.map(["1", "2", "3"], (index) => ({ taskId: `${family}-${index}`, family }))
);

// Two tasks in two families, small enough to enumerate every relabeling.
const HAND: ReadonlyArray<SkillLaneTaskValues> = [
  { taskId: "t1", family: "f1", valuesB: [0.2, 0.4], valuesC: [0.6, 0.8] },
  { taskId: "t2", family: "f2", valuesB: [0.5, 0.5, 0.5], valuesC: [0.5, 0.7] },
];

const subsets = (size: number, choose: number): ReadonlyArray<ReadonlyArray<number>> =>
  choose === 0
    ? [[]]
    : size < choose
      ? []
      : A.appendAll(
          A.map(subsets(size - 1, choose - 1), (subset) => A.append(subset, size - 1)),
          subsets(size - 1, choose)
        );

const relabeledDifferences = (task: SkillLaneTaskValues): ReadonlyArray<number> => {
  const pooled = A.appendAll(task.valuesC, task.valuesB);
  const nC = A.length(task.valuesC);
  return A.map(subsets(A.length(pooled), nC), (chosen) => {
    const inC = A.map(chosen, (index) => pooled[index] ?? 0);
    const inB = A.filter(pooled, (_value, index) => !A.contains(chosen, index));
    const sum = (values: ReadonlyArray<number>) => A.reduce(values, 0, (total, value) => total + value);
    return sum(inC) / nC - sum(inB) / A.length(inB);
  });
};

// Pinned under seed 20261113: the same draws on Node and Bun.
const GOLDEN_HAND_P = 0.065347;

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

describe("skill lane probe arithmetic", () => {
  it("matches a hand-computed D and fixed-task interval", () => {
    const interval = fixedTaskInterval(HAND);
    // D = (0.4 + 0.1) / 2; SE = sqrt(0.01 + 0.01 + 0 + 0.01) / 2.
    expect(interval).toEqual(
      expect.objectContaining({ n: 2, mean: 0.25, standardError: 0.086603, lower: 0.080259, upper: 0.419741 })
    );
    expect(fixedTaskInterval([]).n).toBe(0);
  });

  it("adjusts four family p-values by Holm's step-down rule", () => {
    expect(holmAdjust([0.01, 0.04, 0.03, 0.005])).toEqual([0.03, 0.06, 0.06, 0.02]);
    expect(holmAdjust([0.6, 0.5])).toEqual([1, 1]);
    expect(holmAdjust([0.02, 0.5])).toEqual([0.04, 0.5]);
    expect(holmAdjust([])).toEqual([]);
  });

  it.effect("approximates the exact permutation p-value and repeats it for one seed", () =>
    Effect.gen(function* () {
      const [first, second] = A.map(HAND, relabeledDifferences);
      const observed = round6((0.4 + 0.1) / 2);
      const joint = A.flatMap(first ?? [], (left) => A.map(second ?? [], (right) => round6((left + right) / 2)));
      const exact = A.length(A.filter(joint, (value) => Math.abs(value) >= observed)) / A.length(joint);
      const test = skillLanePermutationTest(HAND, 20000).pipe(Random.withSeed(20261113));
      const once = yield* test;
      const twice = yield* test;
      expect(twice).toEqual(once);
      expect(once.pValue).toBe(GOLDEN_HAND_P);
      expect(Math.abs(once.pValue - exact)).toBeLessThan(0.01);
      expect(R.keys(once.familyPValues)).toEqual(["f1", "f2"]);
      const other = yield* skillLanePermutationTest(HAND, 20000).pipe(Random.withSeed(7));
      expect(other.pValue).not.toBe(once.pValue);
    })
  );

  it.effect("detects one strong family that the family-clustered interval cannot", () =>
    Effect.gen(function* () {
      const tasks: ReadonlyArray<SkillLaneTaskValues> = A.map(TASKS, ({ taskId, family }) =>
        family === "fn-schema"
          ? { taskId, family, valuesB: [0.2, 0.25, 0.3, 0.25, 0.25], valuesC: [0.7, 0.75, 0.8, 0.75, 0.75] }
          : { taskId, family, valuesB: [0.5, 0.45, 0.55, 0.5, 0.5], valuesC: [0.5, 0.55, 0.45, 0.5, 0.5] }
      );
      const clustered = estimateClusteredMean(
        A.map(tasks, (task) => ({
          cluster: task.family,
          value:
            A.reduce(task.valuesC, 0, (sum, value) => sum + value) / 5 -
            A.reduce(task.valuesB, 0, (sum, value) => sum + value) / 5,
        }))
      );
      expect(clustered.lower).toBeLessThan(0);
      const result = yield* skillLanePermutationTest(tasks, 2000).pipe(Random.withSeed(20261113));
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.familyPValues["fn-schema"]).toBeLessThan(0.05);
      expect(result.familyPValues.normalization).toBeGreaterThan(0.05);
    })
  );
});

describe("skill lane probe outcomes", () => {
  const base = { completeTasks: 12, missing: [] as ReadonlyArray<string> };

  it("checks Incomplete first, then Effect, Small effect and Null", () => {
    expect(
      decideSkillLaneProbe({ completeTasks: 9, missing: ["x", "y", "z"], difference: 0.5, pValue: 0.0001 })
    ).toEqual(
      SkillLaneProbeVerdict.cases.Incomplete.make({ completeTasks: 9, required: 10, missing: ["x", "y", "z"] })
    );
    expect(decideSkillLaneProbe({ ...base, difference: 0.1, pValue: 0.01 })._tag).toBe("Effect");
    expect(decideSkillLaneProbe({ ...base, difference: 0.0999999, pValue: 0.01 })._tag).toBe("Effect");
    expect(decideSkillLaneProbe({ ...base, difference: 0.0999, pValue: 0.01 })._tag).toBe("SmallEffect");
    expect(decideSkillLaneProbe({ ...base, difference: 0.3, pValue: 0.05 })).toEqual(
      SkillLaneProbeVerdict.cases.Null.make({ difference: 0.3, pValue: 0.05, harm: false })
    );
    expect(decideSkillLaneProbe({ ...base, difference: 0, pValue: 0.001 })).toEqual(
      SkillLaneProbeVerdict.cases.Null.make({ difference: 0, pValue: 0.001, harm: false })
    );
    expect(decideSkillLaneProbe({ ...base, difference: -0.04, pValue: 0.001 })).toEqual(
      SkillLaneProbeVerdict.cases.Null.make({ difference: -0.04, pValue: 0.001, harm: true })
    );
    expect(decideSkillLaneProbe({ ...base, completeTasks: 10, difference: -0.04, pValue: 0.5 })).toEqual(
      SkillLaneProbeVerdict.cases.Null.make({ difference: -0.04, pValue: 0.5, harm: false })
    );
  });
});

const fullRecords = (effectFamily: string, shift: number) =>
  A.flatMap(TASKS, ({ taskId, family }) =>
    A.appendAll(
      cellRuns(taskId, family, "B", [0.4, 0.45, 0.5, 0.45, 0.45]),
      cellRuns(
        taskId,
        family,
        "C",
        A.map([0.4, 0.45, 0.5, 0.45, 0.45], (value) => value + (family === effectFamily ? shift : 0))
      )
    )
  );

describe("skill lane probe report", () => {
  it.effect("returns Effect with a keep flag on the family that carries it", () =>
    Effect.gen(function* () {
      const report = yield* buildSkillLaneProbeReport(fullRecords("fn-schema", 0.5), {
        data: "scored",
        seed: 20261113,
        relabelings: 2000,
      });
      expect(report.difference.mean).toBe(0.125);
      expect(report.completeTasks).toBe(12);
      expect(report.attempts).toBe(120);
      assertSome(
        O.map(report.verdict, (verdict) => verdict._tag),
        "Effect"
      );
      expect(A.map(report.families, (family) => family.keep)).toEqual([true, false, false, false]);
      expect(A.length(report.tasks)).toBe(12);
      expect(report.firedRate.mean).toBe(1);
      expect(report.firedRateGate).toBe(false);
      expect(A.every(report.secondary, (row) => row.contrast === "C-B" && row.level === "overall")).toBe(true);
    })
  );

  it.effect("keeps cell sizes after an exclusion and reports the missing task as Incomplete", () =>
    Effect.gen(function* () {
      const [dropped, ...rest] = fullRecords("none", 0);
      const records = A.appendAll(
        rest,
        dropped === undefined ? [] : [run(dropped.taskId, dropped.family, "B", 0, O.none(), 1)]
      );
      const report = yield* buildSkillLaneProbeReport(records, { data: "scored", seed: 20261113, relabelings: 500 });
      expect(report.excludedRuns).toBe(1);
      expect(report.completeTasks).toBe(11);
      const short = A.findFirst(report.tasks, (task) => task.countedB === 4);
      assertSome(
        O.map(short, (task) => [task.taskId, task.countedC] as const),
        ["fn-schema-1", 5] as const
      );
      // Eleven complete tasks clear the floor of ten; nothing moves, so the verdict is Null.
      assertSome(
        O.map(report.verdict, (verdict) => verdict._tag),
        "Null"
      );
      const sparse = yield* buildSkillLaneProbeReport(
        A.filter(records, (record) => record.family === "fn-schema"),
        { data: "scored", seed: 20261113, relabelings: 100 }
      );
      assertSome(
        O.map(sparse.verdict, (verdict) => (verdict._tag === "Incomplete" ? verdict.missing : [])),
        ["fn-schema-1"]
      );
    })
  );

  it.effect("labels pilot data and writes no verdict", () =>
    Effect.gen(function* () {
      const report = yield* buildSkillLaneProbeReport(fullRecords("fn-schema", 0.5), {
        data: "pilot",
        seed: 20261113,
        relabelings: 200,
      });
      expect(report.data).toBe("pilot");
      expect(report.note).toContain("Pilot data");
      assertNone(report.verdict);
    })
  );
});

const encodeJsonLines = S.encodeEffect(S.fromJsonString(SkillProbeRunRecord));
const encodePreflight = S.encodeEffect(S.fromJsonString(SkillProbePreflight));
const decodeLaneReport = S.decodeUnknownEffect(S.fromJsonString(SkillLaneProbeReport));
const runCommand = Command.runWith(agentEffectivenessCommand, { version: "0.0.0" });

const writeFixture = Effect.fn("SkillLaneProbeTest.writeFixture")(function* (
  records: ReadonlyArray<SkillProbeRunRecord>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ directory: privacySafeSystemTempRoot(), prefix: "beep-lane-probe-" });
  const lines = yield* Effect.forEach(records, (record) => encodeJsonLines(record));
  const recordsPath = path.join(dir, "runs.jsonl");
  const preflightPath = path.join(dir, "preflight.json");
  yield* fs.writeFileString(recordsPath, `${A.join(lines, "\n")}\n`);
  const preflight = yield* encodePreflight(
    SkillProbePreflight.make({ schemaVersion: "skill-probe-preflight/v1", rows: [], dropped: [] })
  );
  yield* fs.writeFileString(preflightPath, preflight);
  return { recordsPath, preflightPath };
});

const CommandTestLayer = Git.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

it.layer(CommandTestLayer, { timeout: "30 seconds" })("skill lane probe command", (it) => {
  it.effect("routes --primary lane-fraction to the lane report and repeats its p-value", () =>
    Effect.gen(function* () {
      const { recordsPath, preflightPath } = yield* writeFixture(fullRecords("fn-schema", 0.5));
      const args = [
        "evals",
        "probe",
        "report",
        "--records",
        recordsPath,
        "--preflight",
        preflightPath,
        "--primary",
        "lane-fraction",
        "--relabelings",
        "300",
      ];
      yield* runCommand(args);
      const lines = yield* TestConsole.logLines;
      const first = yield* decodeLaneReport(String(A.join(A.map(lines, String), "")));
      expect(first.data).toBe("scored");
      expect(first.test.seed).toBe(20261113);
      expect(first.test.relabelings).toBe(300);
      const again = yield* runSkillLaneProbeReport([recordsPath], preflightPath, {
        data: "pilot",
        seed: 20261113,
        relabelings: 300,
      });
      expect(again.test.pValue).toBe(first.test.pValue);
      assertNone(again.verdict);
    }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
  );

  it.effect("refuses more than 144 attempts", () =>
    Effect.gen(function* () {
      const extra = A.map(A.range(0, 29), (index) => run("fn-schema-1", "fn-schema", "B", 10 + index, O.some(0.5)));
      const { recordsPath, preflightPath } = yield* writeFixture(A.appendAll(fullRecords("none", 0), extra));
      const error = yield* Effect.flip(
        runSkillLaneProbeReport([recordsPath], preflightPath, { data: "scored", seed: 1, relabelings: 10 })
      );
      expect(String(error.message)).toContain("cap of 144");
    })
  );
});
