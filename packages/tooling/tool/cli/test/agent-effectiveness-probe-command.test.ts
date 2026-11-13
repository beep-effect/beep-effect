import * as NodeProcess from "node:process";
import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { agentEffectivenessCommand } from "@beep/repo-cli/commands/AgentEffectiveness";
import { SkillProbePrimarySelection, SkillProbeReport, SkillProbeStage } from "@beep/repo-cli/test/AgentEffectiveness";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const runCommand = Command.runWith(agentEffectivenessCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeStage = S.decodeUnknownEffect(S.fromJsonString(SkillProbeStage));
const decodeSelection = S.decodeUnknownEffect(S.fromJsonString(SkillProbePrimarySelection));
const encodeSelection = S.encodeEffect(S.fromJsonString(SkillProbePrimarySelection));
const SelectionArbitrary = Arbitrary.schema(SkillProbePrimarySelection);
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(SkillProbeReport));
const HASH = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const TestLayer = Git.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, MemoryFileSystem.layer))
);

const writeText = Effect.fnUntraced(function* (file: string, value: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  const text = typeof value === "string" ? value : yield* encodeJson(value);
  yield* fs.writeFileString(file, text);
});

const logged = Effect.fnUntraced(function* () {
  const lines = yield* TestConsole.logLines;
  return A.map(lines, String);
});

const lastLogged = Effect.fnUntraced(function* () {
  const lines = yield* logged();
  return O.getOrElse(A.last(lines), () => "");
});

const run = runCommand;
const withTestConsole = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));
// Virtual paths outside the repository root, which staging refuses to overlap.
const VIRTUAL_ROOT = "/skill-probe-command-test";

const task = {
  id: "sfv4-normalization-003",
  ruleIds: ["SFV4-normalization"],
  derivedFrom: [],
  prompt: "Refactor src/HtmlText.ts through the schema path.",
  fixture: "goals/skillopt-training-pilot/corpus/fixtures/sfv4-normalization-003",
  entrypoint: "src/HtmlText.ts",
  completion: { requiredExports: ["HtmlInnerText"], requiredPatterns: [], forbiddenPatterns: [] },
};

const record = (cell: "B" | "C", allLanesPass: boolean, runIndex: number) => ({
  schemaVersion: "skill-probe-run/v1",
  taskId: task.id,
  family: "normalization",
  cell,
  invocation: "pilot",
  runIndex,
  slot: `${task.id}#${cell}#${runIndex}`,
  attempt: 1,
  keptDir: `claude-eval-${cell}${runIndex}`,
  scorerProfile: "skill-probe-scorer/v3",
  fingerprint: { modelId: "claude-opus-5-5", claudeVersion: "2.1.323", skillSha256: HASH, lawsSha256: HASH },
  fired: cell === "C",
  anySkillFired: cell === "C",
  turns: 9,
  durationSeconds: 30,
  costUsd: 0.1,
  startedAt: "2026-11-13T00:00:00.000Z",
  outcome: {
    _tag: "Scored",
    report: {
      taskId: task.id,
      score: allLanesPass ? 1 : 0.5,
      breakdown: { completion: allLanesPass ? 1 : 0.5, schemaFirst: 1, tsgo: 1, biome: 1 },
      violations: [],
      status: "scored",
      lanes: [],
    },
    allLanesPass,
    laneFraction: allLanesPass ? 1 : 0.5,
  },
});

it.layer(TestLayer, { concurrent: false, timeout: "20 seconds" })("agent-effectiveness evals probe command", (it) => {
  it.effect.prop(
    "round-trips schema-derived primary selections through the JSON the select command prints",
    [SelectionArbitrary],
    ([selection]) =>
      Effect.gen(function* () {
        const encoded = yield* encodeSelection(selection);
        const decoded = yield* decodeSelection(encoded);
        const reencoded = yield* encodeSelection(decoded);
        expect(reencoded).toBe(encoded);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("lists the probe subcommands", () =>
    Effect.gen(function* () {
      yield* run(["evals", "probe"]);
      const lines = yield* logged();
      expect(lines).toContain("- select");
      expect(lines).toContain("- report");
    }).pipe(withTestConsole)
  );

  it.effect("stages the two plugins from the archive, the laws and the skill", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = NodeProcess.cwd();
      yield* writeText(path.join(root, "bun.lock"), "");
      yield* writeText(path.join(root, "AGENTS.md"), "# Guide\n\n## Code Laws\n\n- Schema first.\n\n## Autonomy\n");
      yield* writeText(
        path.join(root, ".claude/skills/schema-first-development/SKILL.md"),
        "---\nname: schema-first-development\n---\n"
      );
      const archive = path.join(VIRTUAL_ROOT, "archive");
      yield* writeText(path.join(archive, "goals/skillopt-training-pilot/corpus/tasks", `${task.id}.json`), task);
      const out = path.join(VIRTUAL_ROOT, "suite");
      yield* run(["evals", "probe", "stage", "--archive", archive, "--out", out, "--runs", "1"]);
      const stagedLine = yield* lastLogged();
      expect(stagedLine).toMatch(/^staged 1 tasks; skill [0-9a-f]{64}; laws [0-9a-f]{64}$/u);
      const stageText = yield* fs.readFileString(path.join(out, "stage.json"));
      const stage = yield* decodeStage(stageText);
      expect(A.map(stage.tasks, (staged) => [staged.id, staged.family])).toEqual([[task.id, "normalization"]]);
      const skillCopied = yield* fs.exists(path.join(out, "sep-skill/skills/schema-first-development/SKILL.md"));
      expect(skillCopied).toBe(true);
      const caseYaml = yield* fs.readFileString(path.join(out, "sep-empty/evals", task.id, "case.yaml"));
      expect(caseYaml).toContain('"runs": 1');
    }).pipe(withTestConsole)
  );

  it.effect("preflights a stage with no tasks and scores excluded runs without a kept directory", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const root = path.join(VIRTUAL_ROOT, "flow");
      const stagePath = path.join(root, "stage.json");
      yield* writeText(stagePath, {
        schemaVersion: "skill-probe-stage/v1",
        skillSha256: HASH,
        lawsSha256: HASH,
        tasks: [],
      });
      const knownGood = path.join(root, "known-good");
      yield* writeText(path.join(knownGood, ".keep"), "");
      yield* run([
        "evals",
        "probe",
        "preflight",
        "--archive",
        root,
        "--known-good",
        knownGood,
        "--stage",
        stagePath,
        "--out",
        path.join(root, "preflight-empty.json"),
      ]);

      const taskStage = path.join(root, "task-stage.json");
      yield* writeText(taskStage, {
        schemaVersion: "skill-probe-stage/v1",
        skillSha256: HASH,
        lawsSha256: HASH,
        tasks: [{ id: task.id, family: "normalization", fixture: task.fixture, taskPath: "tasks/t.json" }],
      });
      const resultPath = path.join(root, "result.json");
      yield* writeText(resultPath, {
        claudeVersion: "2.1.323",
        suite: { ablation: "none", modelOverride: "claude-opus-5-5" },
        cases: [
          {
            name: task.id,
            arms: {
              with: [
                {
                  turns: 0,
                  costUsd: 0,
                  durationSeconds: 0,
                  startedAt: "2026-11-13T00:00:00.000Z",
                  error: "exit 1: You've hit your weekly limit",
                  tracePath: "",
                  graders: [],
                },
              ],
            },
          },
        ],
      });
      yield* run([
        "evals",
        "probe",
        "score",
        "--archive",
        root,
        "--stage",
        taskStage,
        "--result",
        resultPath,
        "--invocation",
        "cell-a",
        "--with-cell",
        "A",
        "--out",
        path.join(root, "runs.jsonl"),
      ]);
      const scoredLine = yield* lastLogged();
      expect(scoredLine).toBe("scored 1 runs");
    }).pipe(withTestConsole)
  );

  it.effect("selects a primary and reports the verdict it reads", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const root = path.join(VIRTUAL_ROOT, "report");
      const preflight = path.join(root, "preflight.json");
      yield* writeText(preflight, { schemaVersion: "skill-probe-preflight/v1", rows: [], dropped: [] });
      const records = path.join(root, "records.jsonl");
      const lines = yield* Effect.forEach([record("B", false, 0), record("C", true, 0)], (entry) => encodeJson(entry));
      yield* writeText(records, `${A.join(lines, "\n")}\n`);

      yield* run(["evals", "probe", "select", "--records", records, "--preflight", preflight]);
      const selectionText = yield* lastLogged();
      const selection = yield* decodeSelection(selectionText);
      expect(A.map(selection.candidates, (candidate) => candidate.tasks)).toEqual([[task.id], [task.id]]);
      expect(O.isNone(selection.selected)).toBe(true);

      yield* run(["evals", "probe", "report", "--records", records, "--preflight", preflight, "--primary", "law-pass"]);
      const reportText = yield* lastLogged();
      const report = yield* decodeReport(reportText);
      expect(report.primary).toBe("law-pass");
      expect(report.countedRuns).toBe(2);
      assertSome(
        O.map(A.head(report.laneCensus), (row) => row.taskId),
        task.id
      );
    }).pipe(withTestConsole)
  );
});
