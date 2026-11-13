/**
 * Skill effect probe workflow: stage the `claude plugin eval` suite, preflight
 * the fixtures, score kept run directories into run records, and report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { Sha256Hex } from "@beep/schema/Sha256";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import { AgentEffectivenessEvalReportStatus, decodeTaskManifestJson } from "../AgentEffectiveness.schemas.ts";
import { scoreAgentEffectivenessEval } from "./EvalScorer.ts";
import {
  PluginEvalResult,
  SkillProbeFingerprint,
  SkillProbeOutcome,
  SkillProbePreflight,
  SkillProbePreflightRow,
  SkillProbeReport,
  SkillProbeRunRecord,
  SkillProbeStage,
} from "./SkillProbeSchemas.ts";
import { buildSkillProbeReport } from "./SkillProbeStats.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { AgentEffectivenessEvalScoreReport, SkillOptTaskManifest } from "../AgentEffectiveness.schemas.ts";
import type { PluginEvalRun, SkillProbeCell } from "./SkillProbeSchemas.ts";

const SKILL_NAME = "schema-first-development";
const SKILL_DIR = `.claude/skills/${SKILL_NAME}`;
const CORPUS_DIR = "goals/skillopt-training-pilot/corpus";
const EMPTY_PLUGIN = "sep-empty";
const SKILL_PLUGIN = "sep-skill";
const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Skill"];
const API_ERROR_PATTERN =
  /api[ _-]?error|rate[ _-]?limit|overload|\b429\b|\b5\d\d\b|authentication|authenticate|unauthori[sz]ed|server error|credit balance/iu;

type ProbeEnv = FileSystem.FileSystem | Path.Path;
type ScoreEnv = ProbeEnv | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

const decodeStage = S.decodeUnknownEffect(S.fromJsonString(SkillProbeStage));
const encodeStage = S.encodeEffect(S.fromJsonString(SkillProbeStage));
const decodeResult = S.decodeUnknownEffect(S.fromJsonString(PluginEvalResult));
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(SkillProbeRunRecord));
const encodeRecord = S.encodeEffect(S.fromJsonString(SkillProbeRunRecord));
const encodePreflight = S.encodeEffect(S.fromJsonString(SkillProbePreflight));
const encodeReport = S.encodeEffect(S.fromJsonString(SkillProbeReport));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown, { space: 2 }));

const fail = (message: string, file?: string) =>
  AgentEffectivenessEvalScorerError.new(message, file === undefined ? {} : { file });
const mapFail = (message: string, file?: string) =>
  AgentEffectivenessEvalScorerError.mapError(message, file === undefined ? {} : { file });

/**
 * Task family from a SkillOpt task's first rule id (`SFV4-normalization` → `normalization`).
 *
 * **Example** (Family of a task)
 *
 * ```ts
 * import { SkillOptTaskManifest, skillProbeFamily } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const task = SkillOptTaskManifest.make({
 *   id: "sfv4-null-return-001",
 *   ruleIds: ["SFV4-null-return"],
 *   derivedFrom: [],
 *   prompt: "p",
 *   fixture: "f",
 *   entrypoint: "src/x.ts",
 *   completion: { requiredExports: [], requiredPatterns: [], forbiddenPatterns: [] }
 * })
 * console.log(skillProbeFamily(task)) // "null-return"
 * ```
 *
 * @param task - Task manifest.
 * @returns The lower-case rule class, or the task id when the task has no rule id.
 * @category models
 * @since 0.0.0
 */
export const skillProbeFamily = (task: SkillOptTaskManifest): string =>
  pipe(
    A.head(task.ruleIds),
    O.map(Str.replace(/^SFV4-/u, "")),
    O.map(Str.toLowerCase),
    O.getOrElse(() => task.id)
  );

/**
 * The `## Code Laws` section of `AGENTS.md`, heading included, up to the next level-two heading.
 *
 * **Example** (Extract the laws)
 *
 * ```ts
 * import { codeLawsSection } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as O from "effect/Option"
 *
 * const laws = codeLawsSection("# Guide\n\n## Code Laws\n\n- One.\n\n## Autonomy\n")
 * console.log(O.getOrElse(laws, () => "")) // "## Code Laws\n\n- One.\n"
 * ```
 *
 * @param agents - `AGENTS.md` text.
 * @returns The section, or none when the heading is absent.
 * @category models
 * @since 0.0.0
 */
export const codeLawsSection = (agents: string): O.Option<string> =>
  pipe(
    O.fromNullishOr(/^## Code Laws\n[\s\S]*?(?=^## )/mu.exec(agents)),
    O.map((match) => `${Str.trimEnd(match[0])}\n`)
  );

/**
 * The prompt a cell sends: the archived prompt for A, the prompt plus the Code Laws for B and C.
 *
 * **Example** (Laws prompt)
 *
 * ```ts
 * import { skillProbePrompt } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(skillProbePrompt("Do it.", "laws", "## Code Laws\n").startsWith("Do it.")) // true
 * ```
 *
 * @param prompt - Archived task prompt.
 * @param variant - `bare` for cell A, `laws` for cells B and C.
 * @param laws - Code Laws section text.
 * @returns The prompt text.
 * @category models
 * @since 0.0.0
 */
export const skillProbePrompt: {
  (variant: "bare" | "laws", laws: string): (prompt: string) => string;
  (prompt: string, variant: "bare" | "laws", laws: string): string;
} = dual(3, (prompt: string, variant: "bare" | "laws", laws: string): string =>
  variant === "bare" ? prompt : `${prompt}\n\nFollow the repository code laws below.\n\n${laws}`
);

const shellQuote = (value: string): string => `'${Str.replaceAll("'", "'\\''")(value)}'`;

const readText = Effect.fn("SkillProbe.readText")(function* (file: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(file).pipe(Effect.mapError(mapFail(`Cannot read ${file}.`, file)));
});

const writeText = Effect.fn("SkillProbe.writeText")(function* (file: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(file), { recursive: true })
    .pipe(Effect.mapError(mapFail(`Cannot create the directory for ${file}.`, file)));
  yield* fs.writeFileString(file, text).pipe(Effect.mapError(mapFail(`Cannot write ${file}.`, file)));
});

const filesUnder = Effect.fn("SkillProbe.filesUnder")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(root, { recursive: true })
    .pipe(Effect.mapError(mapFail(`Cannot list ${root}.`, root)));
  const files = yield* Effect.filter(entries, (entry) =>
    fs
      .stat(path.join(root, entry))
      .pipe(
        Effect.mapBoth({ onFailure: mapFail(`Cannot stat ${entry}.`, root), onSuccess: (info) => info.type === "File" })
      )
  );
  return A.sort(files, Order.String);
});

const fileDigests = Effect.fn("SkillProbe.fileDigests")(function* (root: string) {
  const path = yield* Path.Path;
  const files = yield* filesUnder(root);
  return yield* Effect.forEach(files, (file) =>
    readText(path.join(root, file)).pipe(
      Effect.flatMap(sha256Hex),
      Effect.map((sha256) => ({ path: file, sha256: Sha256Hex.make(sha256) }))
    )
  );
});

const directoryDigest = Effect.fn("SkillProbe.directoryDigest")(function* (root: string) {
  const digests = yield* fileDigests(root);
  const digest = yield* sha256Hex(
    pipe(
      digests,
      A.map(({ path, sha256 }) => `${path}\n${sha256}\n`),
      A.join("")
    )
  );
  return Sha256Hex.make(digest);
});

const readTasks = Effect.fn("SkillProbe.readTasks")(function* (archiveRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tasksDir = path.join(archiveRoot, CORPUS_DIR, "tasks");
  const entries = yield* fs
    .readDirectory(tasksDir)
    .pipe(Effect.mapError(mapFail(`Cannot list ${tasksDir}.`, tasksDir)));
  const files = pipe(entries, A.filter(Str.endsWith(".json")), A.sort(Order.String));
  return yield* Effect.forEach(files, (file) => {
    const taskPath = path.join(CORPUS_DIR, "tasks", file);
    return readText(path.join(archiveRoot, taskPath)).pipe(
      Effect.flatMap(decodeTaskManifestJson),
      Effect.mapBoth({
        onFailure: mapFail(`Task manifest is not valid: ${taskPath}.`, taskPath),
        onSuccess: (task) => ({ task, taskPath }),
      })
    );
  });
});

/**
 * Options for staging the probe suite.
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeStageOptions extends S.Opaque<SkillProbeStageOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    archiveRoot: S.String,
    outDir: S.String,
    runs: S.Int,
    maxTurns: S.Int,
    timeoutSeconds: S.Int,
  })
) {}

/**
 * Stage two plugins for `claude plugin eval`: `sep-empty` (no skills, archived
 * prompts; cell A under `--ablation none`) and `sep-skill` (the live skill,
 * laws prompts; cells B and C as the without and with arms).
 *
 * **Details**
 *
 * Each case's scaffold copies the archived fixture into the run workspace at
 * the path the prompt names. The archive path is written into the scaffold
 * because the harness passes no `EVAL_*` variables to it. `stage.json`
 * records the skill and laws hashes every run record carries.
 *
 * **Example** (Stage a suite)
 *
 * ```ts
 * import { SkillProbeStageOptions, stageSkillProbe } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * const program = stageSkillProbe(
 *   SkillProbeStageOptions.make({ archiveRoot: "archive", outDir: "suite", runs: 5, maxTurns: 40, timeoutSeconds: 900 })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const stageSkillProbe = Effect.fn("SkillProbe.stage")(function* (
  options: SkillProbeStageOptions
): Effect.fn.Return<SkillProbeStage, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(mapFail("Cannot locate the repository root.")));
  const archiveRoot = path.resolve(options.archiveRoot);
  const outDir = path.resolve(options.outDir);
  const agents = yield* readText(path.join(repoRoot, "AGENTS.md"));
  const laws = yield* O.match(codeLawsSection(agents), {
    onNone: () => fail("AGENTS.md has no ## Code Laws section."),
    onSome: Effect.succeed,
  });
  const skillRoot = path.join(repoRoot, SKILL_DIR);
  const skillSha256 = yield* directoryDigest(skillRoot);
  const lawsDigest = yield* sha256Hex(laws);
  const lawsSha256 = Sha256Hex.make(lawsDigest);
  const tasks = yield* readTasks(archiveRoot);

  yield* fs.remove(outDir, { recursive: true }).pipe(Effect.ignore);
  for (const [plugin, variant] of [
    [EMPTY_PLUGIN, "bare"],
    [SKILL_PLUGIN, "laws"],
  ] as const) {
    const pluginRoot = path.join(outDir, plugin);
    const manifest = yield* encodeJson({ name: plugin, version: "0.0.0" });
    yield* writeText(path.join(pluginRoot, ".claude-plugin", "plugin.json"), `${manifest}\n`);
    if (variant === "laws") {
      const skillTarget = path.join(pluginRoot, "skills", SKILL_NAME);
      yield* fs.makeDirectory(path.dirname(skillTarget), { recursive: true }).pipe(Effect.mapError(mapFail("mkdir")));
      yield* fs.copy(skillRoot, skillTarget).pipe(Effect.mapError(mapFail(`Cannot copy ${SKILL_DIR}.`, skillRoot)));
    }
    for (const { task } of tasks) {
      const caseDir = path.join(pluginRoot, "evals", task.id);
      const fixtureSource = path.join(archiveRoot, task.fixture);
      yield* writeText(
        path.join(caseDir, "scaffold.sh"),
        A.join(
          [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            `mkdir -p ${shellQuote(task.fixture)}`,
            `cp -R ${shellQuote(`${fixtureSource}/.`)} ${shellQuote(`${task.fixture}/`)}`,
            "",
          ],
          "\n"
        )
      );
      yield* fs
        .chmod(path.join(caseDir, "scaffold.sh"), 0o755)
        .pipe(Effect.mapError(mapFail("Cannot mark the scaffold executable.", caseDir)));
      const caseYaml = yield* encodeJson({
        schema_version: "1.1",
        name: task.id,
        runs: options.runs,
        context: { scaffold_script: "scaffold.sh" },
        execution: {
          prompt: skillProbePrompt(task.prompt, variant, laws),
          max_turns: options.maxTurns,
          timeout_seconds: options.timeoutSeconds,
          allowed_tools: ALLOWED_TOOLS,
        },
        graders: [
          {
            type: "tool_used",
            name: "skill-fired",
            tool: "Skill",
            input_match: `"skill"\\s*:\\s*"(?:[\\w-]+:)?${SKILL_NAME}"`,
            arm: "both",
          },
          { type: "tool_used", name: "any-skill", tool: "Skill", arm: "both" },
        ],
      });
      yield* writeText(path.join(caseDir, "case.yaml"), `${caseYaml}\n`);
    }
  }

  const stage = SkillProbeStage.make({
    schemaVersion: "skill-probe-stage/v1",
    skillSha256,
    lawsSha256,
    tasks: A.map(tasks, ({ task, taskPath }) => ({
      id: task.id,
      family: skillProbeFamily(task),
      fixture: task.fixture,
      taskPath,
    })),
  });
  const stageJson = yield* encodeStage(stage);
  yield* writeText(path.join(outDir, "stage.json"), `${stageJson}\n`);
  return stage;
});

const isAllLanesPass = (report: AgentEffectivenessEvalScoreReport): boolean =>
  AgentEffectivenessEvalReportStatus.is.scored(report.status) &&
  report.breakdown.completion === 1 &&
  report.breakdown.schemaFirst === 1 &&
  report.breakdown.tsgo === 1 &&
  report.breakdown.biome === 1 &&
  A.isReadonlyArrayEmpty(report.violations);

/**
 * Options for preflighting the staged tasks.
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbePreflightOptions extends S.Opaque<
  SkillProbePreflightOptions,
  { readonly brand: unique symbol }
>()(S.Struct({ archiveRoot: S.String, knownGoodRoot: S.String, stagePath: S.String, out: S.String })) {}

/**
 * Score every staged task's untouched fixture and its known-good solution and write the preflight receipt.
 *
 * **Example** (Preflight a stage)
 *
 * ```ts
 * import { SkillProbePreflightOptions, preflightSkillProbe } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * const program = preflightSkillProbe(
 *   SkillProbePreflightOptions.make({ archiveRoot: "a", knownGoodRoot: "k", stagePath: "s.json", out: "p.json" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const preflightSkillProbe = Effect.fn("SkillProbe.preflight")(function* (
  options: SkillProbePreflightOptions
): Effect.fn.Return<SkillProbePreflight, AgentEffectivenessEvalScorerError | S.SchemaError, ScoreEnv | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stage = yield* readText(options.stagePath).pipe(Effect.flatMap(decodeStage));
  const rows = yield* Effect.forEach(stage.tasks, (task) =>
    Effect.gen(function* () {
      const taskPath = path.join(options.archiveRoot, task.taskPath);
      const fixture = yield* scoreAgentEffectivenessEval({
        dir: path.join(options.archiveRoot, task.fixture),
        taskPath,
      });
      const knownGoodDir = path.join(options.knownGoodRoot, task.id);
      const hasKnownGood = yield* fs.exists(knownGoodDir).pipe(Effect.orElseSucceed(() => false));
      const knownGood = hasKnownGood
        ? yield* Effect.asSome(scoreAgentEffectivenessEval({ dir: knownGoodDir, taskPath }))
        : O.none<AgentEffectivenessEvalScoreReport>();
      const knownGoodFiles = hasKnownGood ? yield* fileDigests(knownGoodDir) : A.empty();
      const fixtureFailsTask = !isAllLanesPass(fixture) && fixture.breakdown.completion < 1;
      const knownGoodPasses = O.exists(knownGood, isAllLanesPass);
      const reason = !fixtureFailsTask
        ? "The untouched fixture already meets its completion contract."
        : !hasKnownGood
          ? "No known-good solution."
          : knownGoodPasses
            ? "ok"
            : "The known-good solution does not pass every lane.";
      return SkillProbePreflightRow.make({
        taskId: task.id,
        family: task.family,
        fixture,
        knownGood,
        knownGoodFiles,
        passed: fixtureFailsTask && knownGoodPasses,
        reason,
      });
    })
  );
  const preflight = SkillProbePreflight.make({
    schemaVersion: "skill-probe-preflight/v1",
    rows,
    dropped: pipe(
      rows,
      A.filter((row) => !row.passed),
      A.map((row) => row.taskId)
    ),
  });
  const json = yield* encodePreflight(preflight);
  yield* writeText(options.out, `${json}\n`);
  return preflight;
});

/**
 * Options for scoring one harness invocation into run records.
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbeScoreOptions extends S.Opaque<SkillProbeScoreOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    archiveRoot: S.String,
    stagePath: S.String,
    resultPath: S.String,
    invocation: S.NonEmptyString,
    withCell: S.Option(S.String),
    withoutCell: S.Option(S.String),
    out: S.String,
  })
) {}

const decodeCell = S.decodeUnknownEffect(S.Literals(["A", "B", "C"]));

const traceApiError = Effect.fn("SkillProbe.traceApiError")(function* (tracePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(tracePath).pipe(Effect.orElseSucceed(() => ""));
  return pipe(
    text,
    Str.split("\n"),
    A.filter((line) => Str.includes('"type":"result"')(line) && Str.includes('"is_error":true')(line)),
    A.findFirst((line) => API_ERROR_PATTERN.test(line)),
    O.map(() => "The trace's final result is an API error.")
  );
});

const scoreRun = Effect.fn("SkillProbe.scoreRun")(function* (
  run: PluginEvalRun,
  context: {
    readonly archiveRoot: string;
    readonly task: SkillProbeStage["tasks"][number];
    readonly cell: SkillProbeCell;
    readonly invocation: string;
    readonly runIndex: number;
    readonly fingerprint: SkillProbeFingerprint;
  }
): Effect.fn.Return<SkillProbeRunRecord, AgentEffectivenessEvalScorerError, ScoreEnv> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const keptDir = Str.isEmpty(run.tracePath) ? "" : path.dirname(path.dirname(run.tracePath));
  const passed = (name: string) => A.some(run.graders, (grader) => grader.name === name && grader.passed);
  const excluded = (reason: string) => Effect.succeed(SkillProbeOutcome.cases.Excluded.make({ reason }));
  const traceError = Str.isEmpty(run.tracePath) ? O.none<string>() : yield* traceApiError(run.tracePath);
  const outcome = yield* run.error !== null && API_ERROR_PATTERN.test(run.error)
    ? excluded(`Harness API error: ${run.error}`)
    : O.isSome(traceError)
      ? excluded(traceError.value)
      : Str.isEmpty(keptDir)
        ? excluded(`No kept directory: ${run.error ?? "the harness started no agent"}`)
        : Effect.gen(function* () {
            yield* fs.chmod(keptDir, 0o700).pipe(Effect.ignore);
            yield* fs.chmod(path.join(keptDir, "sealed"), 0o700).pipe(Effect.ignore);
            const fixtureDir = path.join(keptDir, "sealed", "home", "cwd", context.task.fixture);
            const exists = yield* fs.exists(fixtureDir).pipe(Effect.orElseSucceed(() => false));
            if (!exists) return SkillProbeOutcome.cases.Excluded.make({ reason: "The fixture is missing." });
            const taskPath = path.join(context.archiveRoot, context.task.taskPath);
            const attempt = scoreAgentEffectivenessEval({ dir: fixtureDir, taskPath });
            const first = yield* attempt;
            const report = AgentEffectivenessEvalReportStatus.is["environment-failure"](first.status)
              ? yield* attempt
              : first;
            return AgentEffectivenessEvalReportStatus.is["environment-failure"](report.status)
              ? SkillProbeOutcome.cases.Excluded.make({ reason: "Scorer environment failure after a rescore." })
              : SkillProbeOutcome.cases.Scored.make({
                  report,
                  allLanesPass: isAllLanesPass(report),
                  laneFraction: report.score,
                });
          });
  return SkillProbeRunRecord.make({
    schemaVersion: "skill-probe-run/v1",
    taskId: context.task.id,
    family: context.task.family,
    cell: context.cell,
    invocation: context.invocation,
    runIndex: context.runIndex,
    keptDir: Str.isEmpty(keptDir) ? "none" : path.basename(keptDir),
    fingerprint: context.fingerprint,
    fired: passed("skill-fired"),
    anySkillFired: passed("any-skill"),
    turns: run.turns,
    durationSeconds: run.durationSeconds,
    costUsd: run.costUsd,
    startedAt: run.startedAt,
    outcome,
  });
});

/**
 * Score every run of one `claude plugin eval --json` result into run records.
 *
 * **Details**
 *
 * `withCell` and `withoutCell` name the cell each harness arm measures. Each
 * run's kept directory is the grandparent of its `tracePath`; the scorer
 * reads the fixture copy under `sealed/home/cwd`. API and rate-limit failures
 * are recorded as excluded, never scored.
 *
 * **Example** (Score an invocation)
 *
 * ```ts
 * import { SkillProbeScoreOptions, scoreSkillProbeRuns } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = scoreSkillProbeRuns(
 *   SkillProbeScoreOptions.make({
 *     archiveRoot: "a",
 *     stagePath: "s.json",
 *     resultPath: "r.json",
 *     invocation: "p2-laws-1",
 *     withCell: O.some("C"),
 *     withoutCell: O.some("B"),
 *     out: "runs.jsonl"
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const scoreSkillProbeRuns = Effect.fn("SkillProbe.score")(function* (
  options: SkillProbeScoreOptions
): Effect.fn.Return<ReadonlyArray<SkillProbeRunRecord>, AgentEffectivenessEvalScorerError | S.SchemaError, ScoreEnv> {
  const stage = yield* readText(options.stagePath).pipe(Effect.flatMap(decodeStage));
  const result = yield* readText(options.resultPath).pipe(Effect.flatMap(decodeResult));
  const modelId = yield* O.match(O.fromNullishOr(result.suite.modelOverride), {
    onNone: () => fail("The harness result names no --model override.", options.resultPath),
    onSome: Effect.succeed,
  });
  const fingerprint = SkillProbeFingerprint.make({
    modelId,
    claudeVersion: result.claudeVersion,
    skillSha256: stage.skillSha256,
    lawsSha256: stage.lawsSha256,
  });
  const withCell = yield* Effect.transposeOption(O.map(options.withCell, decodeCell));
  const withoutCell = yield* Effect.transposeOption(O.map(options.withoutCell, decodeCell));
  const jobs = A.flatMap(result.cases, (evalCase) => {
    const task = A.findFirst(stage.tasks, (staged) => staged.id === evalCase.name);
    const arm = (runs: ReadonlyArray<PluginEvalRun> | undefined, cell: O.Option<SkillProbeCell>) =>
      O.isSome(task) && O.isSome(cell)
        ? A.map(runs ?? A.empty(), (run, runIndex) => ({ run, task: task.value, cell: cell.value, runIndex }))
        : A.empty();
    return A.appendAll(arm(evalCase.arms.with, withCell), arm(evalCase.arms.without, withoutCell));
  });
  const records = yield* Effect.forEach(
    jobs,
    ({ run, task, cell, runIndex }) =>
      scoreRun(run, {
        archiveRoot: options.archiveRoot,
        task,
        cell,
        invocation: options.invocation,
        runIndex,
        fingerprint,
      }),
    { concurrency: 2 }
  );
  const lines = yield* Effect.forEach(records, (record) => encodeRecord(record));
  yield* writeText(
    options.out,
    pipe(
      lines,
      A.map((line) => `${line}\n`),
      A.join("")
    )
  );
  return records;
});

/**
 * Read run records from JSON Lines files.
 *
 * **Example** (Read records)
 *
 * ```ts
 * import { readSkillProbeRecords } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readSkillProbeRecords(["runs.jsonl"]))) // true
 * ```
 *
 * @param files - JSON Lines files of `SkillProbeRunRecord`.
 * @returns Every record in file order.
 * @category commands
 * @since 0.0.0
 */
export const readSkillProbeRecords = Effect.fn("SkillProbe.readRecords")(function* (
  files: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<SkillProbeRunRecord>, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv> {
  const perFile = yield* Effect.forEach(files, (file) =>
    readText(file).pipe(
      Effect.flatMap((text) =>
        Effect.forEach(pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty)), (line) => decodeRecord(line))
      )
    )
  );
  return A.flatten(perFile);
});

/**
 * Build the probe report from run record files and print it as JSON.
 *
 * **Example** (Report records)
 *
 * ```ts
 * import { runSkillProbeReport } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runSkillProbeReport(["runs.jsonl"]))) // true
 * ```
 *
 * @param files - JSON Lines files of `SkillProbeRunRecord`.
 * @returns Cell summaries, paired differences, fired rate and verdict for the records.
 * @category commands
 * @since 0.0.0
 */
export const runSkillProbeReport = Effect.fn("SkillProbe.report")(function* (
  files: ReadonlyArray<string>
): Effect.fn.Return<SkillProbeReport, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv> {
  const records = yield* readSkillProbeRecords(files);
  const report = buildSkillProbeReport(records);
  yield* encodeReport(report).pipe(Effect.flatMap(Console.log));
  return report;
});
