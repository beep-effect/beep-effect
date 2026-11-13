import {
  AgentEffectivenessEvalScoreBreakdown,
  AgentEffectivenessEvalScoreReport,
  buildSkillProbeReport,
  codeLawsSection,
  estimateClusteredMean,
  estimateMean,
  PluginEvalResult,
  readSkillProbeRecords,
  repairSkillProbeTask,
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
  traceExclusionReason,
  validateSkillProbeRecords,
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
import * as Str from "effect/String";

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
  options: {
    readonly fired?: boolean;
    readonly excluded?: boolean;
    readonly turns?: number;
    readonly invocation?: string;
    readonly runIndex?: number;
    readonly slot?: string;
    readonly attempt?: number;
    readonly keptDir?: string;
    readonly scorerProfile?: string;
  } = {}
) =>
  SkillProbeRunRecord.make({
    schemaVersion: "skill-probe-run/v1",
    taskId,
    family,
    cell,
    invocation: options.invocation ?? "test",
    runIndex: options.runIndex ?? 0,
    slot: options.slot ?? `${taskId}#${cell}#${options.runIndex ?? 0}`,
    attempt: options.attempt ?? 1,
    keptDir: options.keptDir ?? "none",
    scorerProfile: options.scorerProfile ?? "skill-probe-scorer/v2",
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

  it("clusters four families of unequal size", () => {
    const estimate = estimateClusteredMean([
      { cluster: "a", value: 0.4 },
      { cluster: "a", value: 0.2 },
      { cluster: "b", value: 0 },
      { cluster: "c", value: 0.1 },
      { cluster: "c", value: 0.1 },
      { cluster: "c", value: 0.1 },
      { cluster: "d", value: 0.6 },
    ]);
    expect(estimate).toMatchObject({
      n: 7,
      mean: 0.214286,
      standardError: 0.096416,
      lower: -0.092511,
      upper: 0.521083,
    });
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
    const passesInC = (taskId: string) => Str.startsWith("fn-schema")(taskId) || taskId === "getsomes-struct-1";
    const records = A.flatMap(tasksOf, ({ taskId, family }) => [
      record(taskId, family, "B", false),
      record(taskId, family, "C", passesInC(taskId)),
    ]);
    const probe = buildSkillProbeReport(records);
    assertSome(
      O.map(overall(probe, "C-B", "all-lanes"), (row) => [row.estimate.mean, row.estimate.lower < 0] as const),
      [0.333333, true] as const
    );
    if (SkillProbeVerdict.guards.Null(probe.verdict)) {
      expect(probe.verdict.harm).toBe(false);
      expect(probe.verdict.reason).toContain("does not exclude zero");
    } else expect.unreachable();
  });

  it("flags harm when C-B lies wholly below zero", () => {
    const probe = buildSkillProbeReport(
      A.flatMap(tasksOf, ({ taskId, family }) => [
        record(taskId, family, "B", true),
        record(taskId, family, "C", false),
      ])
    );
    expect(probe.verdict).toEqual(
      SkillProbeVerdict.cases.Null.make({
        difference: -1,
        lower: -1,
        harm: true,
        reason: "C-B all-lanes -1 is below 0.1.",
      })
    );
  });

  it("checks insensitive before effect: three families that would pass the effect test", () => {
    const records = A.flatMap(["fn-schema", "normalization", "null-return"], (family) => [
      record(`${family}-1`, family, "B", false),
      record(`${family}-1`, family, "C", true),
    ]);
    expect(buildSkillProbeReport(records).verdict._tag).toBe("Insensitive");
    const withFourth = buildSkillProbeReport([
      ...records,
      record("getsomes-struct-1", "getsomes-struct", "B", false),
      record("getsomes-struct-1", "getsomes-struct", "C", true),
    ]);
    expect(withFourth.verdict).toEqual(SkillProbeVerdict.cases.Effect.make({ difference: 1, lower: 1 }));
  });

  it("returns a null when only one family contributes paired differences", () => {
    const probe = buildSkillProbeReport([
      ...A.flatMap(["1", "2", "3"], (index) => [
        record(`fn-schema-${index}`, "fn-schema", "B", false),
        record(`fn-schema-${index}`, "fn-schema", "C", true),
      ]),
      record("null-return-1", "null-return", "B", true),
    ]);
    assertSome(
      O.map(overall(probe, "C-B", "all-lanes"), (row) => row.families),
      1
    );
    if (SkillProbeVerdict.guards.Null(probe.verdict)) {
      expect(probe.verdict.reason).toContain("clustered interval is undefined");
    } else expect.unreachable();
  });

  it("returns insensitive before effect or null when fewer than four tasks ever pass in B or C", () => {
    const records = A.flatMap(tasksOf, ({ taskId, family }) => [
      record(taskId, family, "A", true),
      record(taskId, family, "B", false),
      record(taskId, family, "C", family === "fn-schema"),
    ]);
    expect(buildSkillProbeReport(records).verdict).toEqual(
      SkillProbeVerdict.cases.Insensitive.make({
        sensitiveTasks: 3,
        reason: "3 counted tasks have an all-lanes pass among their B and C runs; the floor is 4.",
      })
    );
  });

  it("reports the lane census per task and cell", () => {
    const probe = buildSkillProbeReport([
      record("t-1", "f", "B", true),
      record("t-1", "f", "B", false),
      record("t-1", "f", "B", false, { excluded: true }),
    ]);
    expect(probe.laneCensus).toHaveLength(1);
    expect(probe.laneCensus[0]).toMatchObject({
      cell: "B",
      counted: 2,
      completion: 0.5,
      schemaFirst: 1,
      tsgo: 1,
      biome: 1,
      allLanes: 0.5,
    });
  });

  it("returns a null below the threshold, and insensitive when no task passes in B or C", () => {
    const equal = buildSkillProbeReport(
      A.flatMap(tasksOf, ({ taskId, family }) => [record(taskId, family, "B", true), record(taskId, family, "C", true)])
    );
    expect(equal.verdict).toEqual(
      SkillProbeVerdict.cases.Null.make({
        difference: 0,
        lower: 0,
        harm: false,
        reason: "C-B all-lanes 0 is below 0.1.",
      })
    );
    expect(buildSkillProbeReport([record("t", "f", "A", true)]).verdict._tag).toBe("Insensitive");
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

  it("repairs only the drifted completion patterns", () => {
    const task = SkillOptTaskManifest.make({
      id: "t",
      ruleIds: [],
      derivedFrom: [],
      prompt: "p",
      fixture: "f",
      entrypoint: "src/x.ts",
      completion: {
        requiredExports: ["X"],
        requiredPatterns: [
          "export\\s+class\\s+X\\s+extends\\s+S\\.Class\\b",
          "S\\.decode\\s*\\(",
          "S\\.decodeUnknownOption\\s*\\(\\s*X\\s*\\)",
        ],
        forbiddenPatterns: ["S\\.decode\\s*\\("],
      },
    });
    const repaired = repairSkillProbeTask(task);
    expect(repaired.prompt).toBe("p");
    expect(repaired.completion.forbiddenPatterns).toEqual(task.completion.forbiddenPatterns);
    const [opaque, decode, decodeOption] = A.map(
      repaired.completion.requiredPatterns,
      (source) => new RegExp(source, "u")
    );
    expect(opaque?.test("export class X extends S.Opaque<X, B>()")).toBe(true);
    expect(opaque?.test("export class X extends S.Class<X>()")).toBe(true);
    expect(decode?.test("S.decodeTo(S.String, SchemaTransformation.trim())")).toBe(true);
    expect(decode?.test("S.decode(SchemaTransformation.trim())")).toBe(true);
    expect(decode?.test("S.decodeUnknownSync(X)")).toBe(false);
    expect(decodeOption?.source).toBe(task.completion.requiredPatterns[2]);
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

describe("skill probe exclusion", () => {
  const attemptOneTrace = A.join(
    [
      '{"type":"system","subtype":"init","model":"claude-opus-5-5"}',
      '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"seven_day","utilization":null}}',
      '{"type":"result","subtype":"success","is_error":true,"duration_ms":512,"result":"You\'ve hit your weekly limit · resets Nov 15, 11pm (America/Chicago)"}',
    ],
    "\n"
  );

  it("excludes the plan-limit trace of the first P2 attempt", () => {
    assertSome(traceExclusionReason(attemptOneTrace), "The trace carries a rejected rate-limit event.");
  });

  it("counts a max-turns failure whatever numbers its metadata carries", () => {
    assertNone(
      traceExclusionReason(
        '{"type":"result","is_error":true,"subtype":"error_max_turns","duration_ms":500,"num_turns":512,"result":"Reached max turns (40)"}'
      )
    );
    assertNone(traceExclusionReason('{"type":"result","is_error":false,"duration_ms":529,"total_cost_usd":0.529}'));
  });

  it("reads a pretty-printed error result and ignores lines that are not JSON", () => {
    assertSome(
      traceExclusionReason('not json\n{ "type": "result", "is_error": true, "result": "API Error: 529 overloaded" }'),
      "The trace's final result is an API error: API Error: 529 overloaded"
    );
    assertSome(
      traceExclusionReason('{"type":"result","is_error":true,"result":"You have reached your usage limit."}'),
      "The trace's final result is an API error: You have reached your usage limit."
    );
  });
});

describe("skill probe record validation", () => {
  it("accepts a clean set and refuses duplicates, mixtures and dropped tasks", () => {
    const clean = [
      record("t-1", "f", "B", false, { keptDir: "claude-eval-1" }),
      record("t-1", "f", "C", true, { keptDir: "claude-eval-2" }),
    ];
    expect(validateSkillProbeRecords(clean, [])).toEqual([]);
    expect(validateSkillProbeRecords([...clean, ...clean], [])).toEqual([
      "Duplicate run identity test/t-1/B/0.",
      "Duplicate run identity test/t-1/C/0.",
      "Kept directory claude-eval-1 is assigned to more than one record.",
      "Kept directory claude-eval-2 is assigned to more than one record.",
      "Duplicate slot attempt t-1#B#0@1.",
      "Duplicate slot attempt t-1#C#0@1.",
      "Slot t-1#B#0 has attempts 1,1, not 1..n.",
      "Slot t-1#B#0 was rerun after a scored attempt.",
      "Slot t-1#C#0 has attempts 1,1, not 1..n.",
      "Slot t-1#C#0 was rerun after a scored attempt.",
    ]);
    expect(
      validateSkillProbeRecords(
        [...clean, record("t-2", "f", "B", false, { scorerProfile: "skill-probe-scorer/v1" })],
        ["t-2"]
      )
    ).toEqual([
      "Records mix scorer profiles: skill-probe-scorer/v1, skill-probe-scorer/v2.",
      "Task t-2 was dropped by preflight but has records.",
    ]);
  });

  it("enforces the rerun cap per slot and the total attempt cap", () => {
    const attempts = (count: number) =>
      A.map(A.range(1, count), (attempt) =>
        record("t-1", "f", "B", false, {
          invocation: `rerun-${attempt}`,
          slot: "t-1#B#0",
          attempt,
          excluded: attempt < count,
        })
      );
    expect(validateSkillProbeRecords(attempts(3), [])).toEqual([]);
    expect(validateSkillProbeRecords(attempts(4), [])).toEqual(["Slot t-1#B#0 has 4 attempts; the cap is 3."]);
    expect(validateSkillProbeRecords([record("t-1", "f", "B", false, { slot: "t-1#B#0", attempt: 2 })], [])).toEqual([
      "Slot t-1#B#0 has attempts 2, not 1..n.",
    ]);
    const many = A.map(A.range(0, 216), (index) => record(`t-${index}`, "f", "B", false, { runIndex: index }));
    expect(validateSkillProbeRecords(many, [])).toEqual(["217 attempts exceed the cap of 216."]);
  });
});

it.layer(TestLayer, { timeout: "30 seconds" })("skill probe scoring", (it) => {
  const setup = Effect.fnUntraced(function* () {
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
    const trace = Effect.fnUntraced(function* (name: string, text: string) {
      const tracePath = path.join(root, name, "out", "trace.jsonl");
      yield* write(tracePath, text);
      return tracePath;
    });
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
    const result = Effect.fnUntraced(function* (
      name: string,
      cases: ReadonlyArray<{ readonly name: string; readonly arms: unknown }>
    ) {
      const resultPath = path.join(root, `${name}.json`);
      yield* write(resultPath, {
        claudeVersion: "2.1.323",
        suite: { ablation: "with-without", modelOverride: "claude-opus-5-5" },
        cases,
      });
      return resultPath;
    });
    const score = (
      resultPath: string,
      out: string,
      cells: { readonly with?: string; readonly without?: string },
      priorPaths: ReadonlyArray<string> = []
    ) =>
      scoreSkillProbeRuns(
        SkillProbeScoreOptions.make({
          archiveRoot: root,
          stagePath,
          resultPath,
          invocation: path.basename(out, ".jsonl"),
          withCell: O.fromNullishOr(cells.with),
          withoutCell: O.fromNullishOr(cells.without),
          priorPaths,
          out: path.join(root, out),
        })
      );
    return { root, path, trace, run, result, score };
  });

  it.effect("ties runs to cells and kept directories and excludes API and plan-limit failures", () =>
    Effect.gen(function* () {
      const { trace, run, result, score, root, path } = yield* setup();
      const api = yield* trace(
        "claude-eval-api",
        '{ "type": "result", "is_error": true, "result": "API Error: 529 overloaded" }\n'
      );
      const limit = yield* trace(
        "claude-eval-limit",
        '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected"}}\n{"type":"result","is_error":true,"result":"You\'ve hit your weekly limit"}\n'
      );
      const maxTurns = yield* trace(
        "claude-eval-turns",
        '{"type":"result","is_error":true,"subtype":"error_max_turns","duration_ms":500}\n'
      );
      const resultPath = yield* result("laws", [
        {
          name: "t-1",
          arms: {
            with: [run(api, null, true), run(limit, "exit 1: You've hit your weekly limit · resets Nov 15", true)],
            without: [run(maxTurns, null, false), run("", "scaffold failed", false)],
          },
        },
      ]);
      const records = yield* score(resultPath, "laws.jsonl", { with: "C", without: "B" });
      expect(A.map(records, (entry) => [entry.cell, entry.runIndex, entry.slot, entry.attempt, entry.keptDir])).toEqual(
        [
          ["C", 0, "t-1#C#0", 1, "claude-eval-api"],
          ["C", 1, "t-1#C#1", 1, "claude-eval-limit"],
          ["B", 0, "t-1#B#0", 1, "claude-eval-turns"],
          ["B", 1, "t-1#B#1", 1, "none"],
        ]
      );
      expect(
        A.map(records, (entry) => (SkillProbeOutcome.guards.Excluded(entry.outcome) ? entry.outcome.reason : "scored"))
      ).toEqual([
        "The trace's final result is an API error: API Error: 529 overloaded",
        "Harness API error: exit 1: You've hit your weekly limit · resets Nov 15",
        "The fixture is missing.",
        "No kept directory: scaffold failed",
      ]);
      expect(records[0]?.fingerprint).toEqual(fingerprint);
      const reread = yield* readSkillProbeRecords([path.join(root, "laws.jsonl")]);
      expect(A.length(reread)).toBe(4);
      expect(validateSkillProbeRecords(reread, [])).toEqual([]);

      const rerunTrace = yield* trace("claude-eval-rerun", '{"type":"result","is_error":false}\n');
      const rerunPath = yield* result("rerun", [{ name: "t-1", arms: { with: [run(rerunTrace, null, true)] } }]);
      const rerun = yield* score(rerunPath, "rerun.jsonl", { with: "C" }, [path.join(root, "laws.jsonl")]);
      expect(A.map(rerun, (entry) => [entry.slot, entry.attempt])).toEqual([["t-1#C#0", 2]]);
      const tooMany = yield* result("too-many", [
        {
          name: "t-1",
          arms: { with: [run(rerunTrace, null, true), run(rerunTrace, null, true), run(rerunTrace, null, true)] },
        },
      ]);
      const refused = yield* Effect.flip(
        score(tooMany, "too-many.jsonl", { with: "C" }, [path.join(root, "laws.jsonl")])
      );
      expect(refused.message).toBe("Rerun has 3 runs for t-1 cell C but only 2 excluded slots.");
    })
  );

  it.effect("refuses unmapped arms, unstaged cases and an existing output file", () =>
    Effect.gen(function* () {
      const { trace, run, result, score } = yield* setup();
      const ok = yield* trace("claude-eval-ok", '{"type":"result","is_error":false}\n');
      const both = yield* result("both", [
        { name: "t-1", arms: { with: [run(ok, null, true)], without: [run(ok, null, false)] } },
      ]);
      const unmapped = yield* Effect.flip(score(both, "unmapped.jsonl", { with: "C" }));
      expect(unmapped.message).toBe("Populated arms without a cell mapping: without.");
      const unstaged = yield* result("unstaged", [{ name: "t-9", arms: { with: [run(ok, null, true)] } }]);
      const missing = yield* Effect.flip(score(unstaged, "unstaged.jsonl", { with: "A" }));
      expect(missing.message).toBe("Cases not in the stage: t-9.");
      const empty = yield* result("empty", [{ name: "t-1", arms: {} }]);
      yield* score(empty, "first.jsonl", {});
      const overwrite = yield* Effect.flip(score(empty, "first.jsonl", {}));
      expect(overwrite.message).toContain("Refusing to overwrite");
    })
  );
});
