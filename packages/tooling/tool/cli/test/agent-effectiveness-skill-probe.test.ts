import {
  AgentEffectivenessEvalScoreBreakdown,
  AgentEffectivenessEvalScoreReport,
  buildSkillProbeReport,
  codeLawsSection,
  estimateClusteredMean,
  estimateMean,
  PluginEvalResult,
  readSkillProbeRecords,
  SkillOptTaskManifest,
  SkillProbeFingerprint,
  SkillProbeOutcome,
  SkillProbeRunRecord,
  SkillProbeScoreOptions,
  SkillProbeVerdict,
  scoreSkillProbeRuns,
  skillProbeFamily,
  skillProbePrompt,
  tCritical975,
} from "@beep/repo-cli/test/AgentEffectiveness";
import { Sha256Hex } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TestLayer = Layer.mergeAll(NodeServices.layer, BunCrypto.layer);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeResult = S.decodeUnknownEffect(PluginEvalResult);

const fingerprint = SkillProbeFingerprint.make({
  modelId: "claude-opus-5-5",
  claudeVersion: "2.1.323",
  skillSha256: Sha256Hex.make(HASH_A),
  lawsSha256: Sha256Hex.make(HASH_B),
});

const report = (allLanes: boolean, score: number) =>
  AgentEffectivenessEvalScoreReport.make({
    taskId: "t",
    score,
    breakdown: AgentEffectivenessEvalScoreBreakdown.make({
      completion: allLanes ? 1 : 0.5,
      schemaFirst: 1,
      tsgo: 1,
      biome: 1,
    }),
    violations: [],
  });

const record = (
  taskId: string,
  family: string,
  cell: "A" | "B" | "C",
  allLanes: boolean,
  options: { readonly fired?: boolean; readonly excluded?: boolean; readonly turns?: number } = {}
) =>
  SkillProbeRunRecord.make({
    schemaVersion: "skill-probe-run/v1",
    taskId,
    family,
    cell,
    invocation: "test",
    runIndex: 0,
    keptDir: "claude-eval-test",
    fingerprint,
    fired: options.fired ?? cell === "C",
    anySkillFired: options.fired ?? cell === "C",
    turns: options.turns ?? 10,
    durationSeconds: 30,
    costUsd: 0.1,
    startedAt: "2026-11-13T00:00:00.000Z",
    outcome:
      options.excluded === true
        ? SkillProbeOutcome.cases.Excluded.make({ reason: "rate limit" })
        : SkillProbeOutcome.cases.Scored.make({
            report: report(allLanes, allLanes ? 1 : 0.5),
            allLanesPass: allLanes,
            laneFraction: allLanes ? 1 : 0.5,
          }),
  });

const FAMILIES = ["fn-schema", "getsomes-struct", "normalization", "null-return"];
const tasksOf = A.flatMap(FAMILIES, (family) =>
  A.map(["1", "2", "3"], (index) => ({ taskId: `${family}-${index}`, family }))
);

const overall = (probe: ReturnType<typeof buildSkillProbeReport>, contrast: string, measure: string) =>
  A.findFirst(
    probe.differences,
    (row) => row.level === "overall" && row.contrast === contrast && row.measure === measure
  );

describe("skill probe arithmetic", () => {
  it("uses Student t critical values and the normal value past thirty", () => {
    expect(tCritical975(3)).toBe(3.182);
    expect(tCritical975(1)).toBe(12.706);
    expect(tCritical975(30)).toBe(2.042);
    expect(tCritical975(31)).toBe(1.96);
    expect(tCritical975(0)).toBe(0);
  });

  it("estimates a mean with the sample standard error", () => {
    const estimate = estimateMean([1, 0, 1, 1, 0], 1.96);
    expect(estimate.n).toBe(5);
    expect(estimate.mean).toBe(0.6);
    expect(estimate.standardError).toBe(0.244949);
    expect(estimate.lower).toBe(0.1199);
    expect(estimate.upper).toBe(1.0801);
    expect(estimateMean([0.4], 1.96)).toMatchObject({ n: 1, mean: 0.4, standardError: 0, lower: 0.4, upper: 0.4 });
    expect(estimateMean([], 1.96)).toMatchObject({ n: 0, mean: 0 });
  });

  it("clusters the standard error by family", () => {
    const estimate = estimateClusteredMean([
      { cluster: "a", value: 0.3 },
      { cluster: "a", value: 0.1 },
      { cluster: "b", value: 0 },
      { cluster: "b", value: 0 },
    ]);
    // mean 0.1; cluster residual sums 0.2 and -0.2; SE = sqrt(2 * 0.08) / 4 = 0.1; t(1) = 12.706.
    expect(estimate).toMatchObject({ n: 4, mean: 0.1, standardError: 0.1, lower: -1.1706, upper: 1.3706 });
    expect(estimateClusteredMean([{ cluster: "a", value: 0.5 }]).standardError).toBe(0);
  });
});

describe("skill probe report", () => {
  it("returns an effect when C beats B on every task", () => {
    const records = A.flatMap(tasksOf, ({ taskId, family }) => [
      record(taskId, family, "A", false),
      record(taskId, family, "B", false),
      record(taskId, family, "C", true),
    ]);
    const probe = buildSkillProbeReport(records);
    expect(probe.verdict).toEqual(SkillProbeVerdict.cases.Effect.make({ difference: 1, lower: 1 }));
    expect(probe.firedRateGate).toBe(false);
    expect(probe.countedRuns).toBe(36);
    assertSome(
      O.map(overall(probe, "B-A", "all-lanes"), (row) => row.estimate.mean),
      0
    );
    expect(A.length(probe.cells)).toBe(36);
    expect(A.length(A.filter(probe.differences, (row) => row.level === "family"))).toBe(4 * 2 * 4);
  });

  it("returns a null when the clustered interval reaches zero", () => {
    const records = A.flatMap(tasksOf, ({ taskId, family }) => [
      record(taskId, family, "B", false),
      record(taskId, family, "C", family === "fn-schema"),
    ]);
    const probe = buildSkillProbeReport(records);
    expect(probe.verdict._tag).toBe("Null");
    assertSome(
      O.map(overall(probe, "C-B", "all-lanes"), (row) => row.estimate.mean),
      0.25
    );
    if (SkillProbeVerdict.guards.Null(probe.verdict)) {
      expect(probe.verdict.lower).toBeLessThanOrEqual(0);
      expect(probe.verdict.reason).toContain("does not exclude zero");
    } else expect.unreachable();
  });

  it("returns a null below the threshold and when no task pairs B with C", () => {
    const equal = buildSkillProbeReport(
      A.flatMap(tasksOf, ({ taskId, family }) => [record(taskId, family, "B", true), record(taskId, family, "C", true)])
    );
    expect(equal.verdict).toEqual(
      SkillProbeVerdict.cases.Null.make({ difference: 0, lower: 0, reason: "C-B all-lanes 0 is below 0.1." })
    );
    expect(buildSkillProbeReport([record("t", "f", "A", true)]).verdict._tag).toBe("Null");
  });

  it("counts excluded runs without scoring them and gates a low fired rate", () => {
    const records = [
      record("t-1", "f", "B", false),
      record("t-1", "f", "B", true, { excluded: true }),
      record("t-1", "f", "C", true, { fired: false }),
      record("t-1", "f", "C", true, { fired: true }),
    ];
    const probe = buildSkillProbeReport(records);
    expect(probe.countedRuns).toBe(3);
    expect(probe.excludedRuns).toBe(1);
    expect(probe.firedRate.mean).toBe(0.5);
    expect(probe.firedRateGate).toBe(true);
    const cellB = A.findFirst(probe.cells, (cell) => cell.cell === "B");
    assertSome(
      O.map(cellB, (cell) => [cell.counted, cell.excluded, cell.allLanes.mean] as const),
      [1, 1, 0] as const
    );
    assertSome(
      O.map(
        A.findFirst(probe.firedOnly, (row) => row.measure === "all-lanes"),
        (row) => row.estimate.mean
      ),
      1
    );
  });

  it("reports turns and wall seconds as secondary differences", () => {
    const probe = buildSkillProbeReport([
      record("t-1", "f", "B", false, { turns: 9 }),
      record("t-1", "f", "C", false, { turns: 12 }),
    ]);
    assertSome(
      O.map(overall(probe, "C-B", "turns"), (row) => row.estimate.mean),
      3
    );
    assertNone(overall(probe, "B-A", "turns"));
  });
});

describe("skill probe staging", () => {
  it("extracts the Code Laws section up to the next level-two heading", () => {
    assertSome(
      codeLawsSection("# Guide\n\n## Code Laws\n\n- One.\n\n## Autonomy\n\n- Two.\n"),
      "## Code Laws\n\n- One.\n"
    );
    assertNone(codeLawsSection("# Guide\n\n## Autonomy\n"));
  });

  it("builds bare and laws prompts and derives the family", () => {
    expect(skillProbePrompt("Do it.", "bare", "## Code Laws\n")).toBe("Do it.");
    expect(skillProbePrompt("Do it.", "laws", "## Code Laws\n")).toBe(
      "Do it.\n\nFollow the repository code laws below.\n\n## Code Laws\n"
    );
    expect(skillProbePrompt("laws", "## L\n")("P")).toBe("P\n\nFollow the repository code laws below.\n\n## L\n");
    const task = SkillOptTaskManifest.make({
      id: "sfv4-getsomes-struct-002",
      ruleIds: ["SFV4-getsomes-struct"],
      derivedFrom: [],
      prompt: "p",
      fixture: "f",
      entrypoint: "src/x.ts",
      completion: { requiredExports: [], requiredPatterns: [], forbiddenPatterns: [] },
    });
    expect(skillProbeFamily(task)).toBe("getsomes-struct");
    expect(skillProbeFamily(SkillOptTaskManifest.make({ ...task, ruleIds: [] }))).toBe("sfv4-getsomes-struct-002");
  });

  it.effect("decodes a harness result and ignores fields it does not read", () =>
    Effect.gen(function* () {
      const result = yield* decodeResult({
        schemaVersion: 1,
        claudeVersion: "2.1.323",
        suite: { ablation: "with-without", modelOverride: "claude-opus-5-5", concurrency: 2 },
        cases: [
          {
            name: "t-1",
            dir: "evals/t-1",
            arms: {
              with: [
                {
                  score: 0,
                  passed: false,
                  turns: 3,
                  costUsd: 0.1,
                  judgeCostUsd: 0,
                  durationSeconds: 5,
                  startedAt: "2026-11-13T00:00:00.000Z",
                  error: null,
                  tracePath: "/kept/claude-eval-x/out/trace.jsonl",
                  graders: [{ name: "skill-fired", passed: true, scored: true }],
                },
              ],
            },
          },
        ],
      });
      expect(result.cases[0]?.arms.with?.[0]?.graders[0]?.passed).toBe(true);
      expect(result.cases[0]?.arms.without).toBeUndefined();
    })
  );
});

it.layer(TestLayer, { timeout: "30 seconds" })("skill probe scoring", (it) => {
  it.effect("ties runs to cells and kept directories and excludes API failures without scoring", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "skill-probe-" });
      const write = Effect.fnUntraced(function* (file: string, value: unknown) {
        yield* fs.makeDirectory(path.dirname(file), { recursive: true });
        const text = typeof value === "string" ? value : yield* encodeJson(value);
        yield* fs.writeFileString(file, text);
      });
      const stagePath = path.join(root, "stage.json");
      yield* write(stagePath, {
        schemaVersion: "skill-probe-stage/v1",
        skillSha256: HASH_A,
        lawsSha256: HASH_B,
        tasks: [{ id: "t-1", family: "fam", fixture: "goals/fixtures/t-1", taskPath: "goals/tasks/t-1.json" }],
      });
      const traceApi = path.join(root, "claude-eval-api", "out", "trace.jsonl");
      yield* write(traceApi, '{"type":"result","is_error":true,"result":"API Error: 529 overloaded"}\n');
      const traceMissing = path.join(root, "claude-eval-gone", "out", "trace.jsonl");
      yield* write(traceMissing, '{"type":"result","is_error":false}\n');
      const run = (tracePath: string, error: string | null, fired: boolean) => ({
        turns: 4,
        costUsd: 0.2,
        durationSeconds: 20,
        startedAt: "2026-11-13T00:00:00.000Z",
        error,
        tracePath,
        graders: [
          { name: "skill-fired", passed: fired },
          { name: "any-skill", passed: fired },
        ],
      });
      const resultPath = path.join(root, "result.json");
      yield* write(resultPath, {
        claudeVersion: "2.1.323",
        suite: { ablation: "with-without", modelOverride: "claude-opus-5-5" },
        cases: [
          {
            name: "t-1",
            arms: {
              with: [run(traceApi, null, true), run("", "rate limit reached (429)", true)],
              without: [run(traceMissing, null, false), run("", "scaffold failed", false)],
            },
          },
          { name: "unstaged", arms: { with: [run(traceApi, null, true)] } },
        ],
      });
      const out = path.join(root, "runs.jsonl");
      const records = yield* scoreSkillProbeRuns(
        SkillProbeScoreOptions.make({
          archiveRoot: root,
          stagePath,
          resultPath,
          invocation: "unit",
          withCell: O.some("C"),
          withoutCell: O.some("B"),
          out,
        })
      );
      expect(A.map(records, (entry) => [entry.cell, entry.runIndex, entry.keptDir, entry.fired])).toEqual([
        ["C", 0, "claude-eval-api", true],
        ["C", 1, "none", true],
        ["B", 0, "claude-eval-gone", false],
        ["B", 1, "none", false],
      ]);
      const reasons = A.map(records, (entry) =>
        SkillProbeOutcome.guards.Excluded(entry.outcome) ? entry.outcome.reason : "scored"
      );
      expect(reasons).toEqual([
        "The trace's final result is an API error.",
        "Harness API error: rate limit reached (429)",
        "The fixture is missing.",
        "No kept directory: scaffold failed",
      ]);
      expect(records[0]?.fingerprint).toEqual(fingerprint);
      const reread = yield* readSkillProbeRecords([out]);
      expect(A.length(reread)).toBe(4);
      expect(buildSkillProbeReport(reread).excludedRuns).toBe(4);
    })
  );
});
