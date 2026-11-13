/**
 * Skill effect probe workflow: stage the `claude plugin eval` suite, preflight
 * the fixtures, score kept run directories into run records, and report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { Sha256Hex } from "@beep/schema/Sha256";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import {
  AgentEffectivenessEvalReportStatus,
  AgentEffectivenessEvalViolation,
  decodeTaskManifestJson,
  SkillOptTaskManifest,
} from "../AgentEffectiveness.schemas.ts";
import { buildAgentEffectivenessEvalScoreReport, evaluateTaskFixture } from "./EvalScorer.ts";
import { LawEvaluation } from "./EvalScoring.ts";
import { SkillLaneProbeReport } from "./SkillLaneProbeSchemas.ts";
import { buildSkillLaneProbeReport, SKILL_LANE_PROBE_MAX_ATTEMPTS } from "./SkillLaneProbeStats.ts";
import {
  PluginEvalResult,
  SkillProbeFingerprint,
  SkillProbeOutcome,
  SkillProbePreflight,
  SkillProbePreflightRow,
  SkillProbePrimarySelection,
  SkillProbeReport,
  SkillProbeRunRecord,
  SkillProbeStage,
} from "./SkillProbeSchemas.ts";
import { buildSkillProbeReport, selectSkillProbePrimary, validateSkillProbeRecords } from "./SkillProbeStats.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { AgentEffectivenessEvalScoreReport } from "../AgentEffectiveness.schemas.ts";
import type { SkillLaneProbeOptions } from "./SkillLaneProbeSchemas.ts";
import type { PluginEvalRun, SkillProbeCell, SkillProbePrimary } from "./SkillProbeSchemas.ts";

const SKILL_NAME = "schema-first-development";
const SKILL_DIR = `.claude/skills/${SKILL_NAME}`;
const CORPUS_DIR = "goals/skillopt-training-pilot/corpus";
const EMPTY_PLUGIN = "sep-empty";
const SKILL_PLUGIN = "sep-skill";
const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Skill"];
// Matched against error text only, never against serialized metadata.
const API_ERROR_PATTERN =
  /api[ _-]?error|rate[ _-]?limit|overload|\b429\b|(?:status|code|error)[ :]+5\d\d\b|authentication|authenticate|unauthori[sz]ed|server error|credit balance|hit your (?:weekly|daily|monthly|session|usage) limit|usage limit|weekly limit/iu;

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/SkillProbe");

const TraceEntry = S.Struct({
  type: S.String,
  subtype: S.optionalKey(S.String),
  is_error: S.optionalKey(S.Boolean),
  result: S.optionalKey(S.Unknown),
  rate_limit_info: S.optionalKey(S.Struct({ status: S.optionalKey(S.String) })),
}).pipe(
  $I.annoteSchema("SkillProbeTraceEntry", {
    description: "The fields of a claude plugin eval trace line that classify how a run ended.",
  })
);
const decodeTraceEntry = S.decodeUnknownOption(S.fromJsonString(TraceEntry));

type ProbeEnv = FileSystem.FileSystem | Path.Path;

/**
 * Scorer profile every run record carries: the shared law scorer plus the
 * drift repairs named in `goals/skill-effect-probe/research/2026-11-13-analysis-rule-amendment.md`
 * and the Biome repair of `2026-11-13-analysis-rule-amendment-2.md`.
 *
 * **Example** (Read the profile)
 *
 * ```ts
 * import { SKILL_PROBE_SCORER_PROFILE } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(SKILL_PROBE_SCORER_PROFILE) // "skill-probe-scorer/v3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SKILL_PROBE_SCORER_PROFILE = "skill-probe-scorer/v3";

// Completion patterns the archived corpus wrote before the current idiom; each
// repair accepts the old spelling and the one the live skill teaches.
const PATTERN_REPAIRS: ReadonlyArray<readonly [string, string]> = [
  ["extends\\s+S\\.Class\\b", "extends\\s+S\\.(?:Class|Opaque)\\b"],
  ["S\\.decode\\s*\\(", "S\\.decode(?:To)?\\s*\\("],
];
// tsgo rules enabled after the corpus was written and stated by none of the
// prompt, the Code Laws or the skill.
const IGNORED_TSGO_RULES: ReadonlyArray<string> = ["missingPipeableSignature"];

const repairPattern = (pattern: string): string =>
  A.reduce(PATTERN_REPAIRS, pattern, (current, [from, to]) => Str.replaceAll(from, to)(current));

/**
 * Apply the probe's completion-pattern repairs to a task manifest; prompts,
 * exports and forbidden patterns are unchanged.
 *
 * **Example** (Accept the Opaque idiom)
 *
 * ```ts
 * import { SkillOptTaskManifest, repairSkillProbeTask } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * const task = SkillOptTaskManifest.make({
 *   id: "t",
 *   ruleIds: [],
 *   derivedFrom: [],
 *   prompt: "p",
 *   fixture: "f",
 *   entrypoint: "src/x.ts",
 *   completion: { requiredExports: [], requiredPatterns: ["extends\\s+S\\.Class\\b"], forbiddenPatterns: [] }
 * })
 * console.log(repairSkillProbeTask(task).completion.requiredPatterns[0]) // "extends\\s+S\\.(?:Class|Opaque)\\b"
 * ```
 *
 * @param task - Archived task manifest.
 * @returns The manifest the probe scores against.
 * @category models
 * @since 0.0.0
 */
export const repairSkillProbeTask = (task: SkillOptTaskManifest): SkillOptTaskManifest =>
  SkillOptTaskManifest.make({
    ...task,
    completion: SkillOptTaskManifest.fields.completion.make({
      ...task.completion,
      requiredPatterns: A.map(task.completion.requiredPatterns, repairPattern),
    }),
  });

/**
 * Whether a Biome finding is one only a formatter satisfies (`format`,
 * `assist/source/*`); scorer profile v3 ignores these in every cell.
 *
 * **Example** (Formatter-only findings)
 *
 * ```ts
 * import { isSkillProbeFormatterFinding } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(isSkillProbeFormatterFinding("assist/source/organizeImports")) // true
 * console.log(isSkillProbeFormatterFinding("lint/suspicious/noExplicitAny")) // false
 * ```
 *
 * @param ruleId - Biome diagnostic category.
 * @returns True for findings the probe does not score.
 * @category models
 * @since 0.0.0
 */
export const isSkillProbeFormatterFinding = (ruleId: string): boolean =>
  ruleId === "format" || Str.startsWith("assist/source/")(ruleId);

const isIgnoredBiomeViolation = isSkillProbeFormatterFinding;

/**
 * Replace the repository root in a scorer diagnostic with `<repo>`, so run
 * records committed to a public repository carry no absolute paths.
 *
 * **Example** (Redact a type-import path)
 *
 * ```ts
 * import { redactSkillProbePath } from "@beep/repo-cli/test/AgentEffectiveness"
 *
 * console.log(redactSkillProbePath("/work/repo")('import("/work/repo/node_modules/effect")'))
 * // import("<repo>/node_modules/effect")
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns A function that redacts that root in a message.
 * @category models
 * @since 0.0.0
 */
export const redactSkillProbePath =
  (repoRoot: string) =>
  (message: string): string =>
    Str.replaceAll(repoRoot, "<repo>")(message);

const isIgnoredTsgoViolation = (message: string): boolean =>
  A.some(IGNORED_TSGO_RULES, (rule) => Str.includes(`effect(${rule})`)(message));
type ScoreEnv = ProbeEnv | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

const decodeStage = S.decodeUnknownEffect(S.fromJsonString(SkillProbeStage));
const encodeStage = S.encodeEffect(S.fromJsonString(SkillProbeStage));
const decodeResult = S.decodeUnknownEffect(S.fromJsonString(PluginEvalResult));
const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(SkillProbeRunRecord));
const encodeRecord = S.encodeEffect(S.fromJsonString(SkillProbeRunRecord));
const encodePreflight = S.encodeEffect(S.fromJsonString(SkillProbePreflight));
const decodePreflight = S.decodeUnknownEffect(S.fromJsonString(SkillProbePreflight));
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

const pathExists = Effect.fn("SkillProbe.pathExists")(function* (target: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(target).pipe(Effect.mapError(mapFail(`Cannot check whether ${target} exists.`, target)));
});

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
  }).pipe(
    $I.annoteSchema("SkillProbeStageOptions", {
      description: "Archive root, output directory, runs per case and agent budgets for staging the probe suite.",
    })
  )
) {}

const isWithin = (parent: string, child: string, separator: string): boolean =>
  child === parent || Str.startsWith(Str.endsWith(separator)(parent) ? parent : `${parent}${separator}`)(child);

// Staging replaces its output directory, so it refuses one that holds or sits
// inside an input, and one that exists with content but is not a prior stage.
const guardStageOutDir = Effect.fn("SkillProbe.guardStageOutDir")(function* (
  outDir: string,
  inputs: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const clash = A.findFirst(inputs, (input) => isWithin(outDir, input, path.sep) || isWithin(input, outDir, path.sep));
  if (O.isSome(clash)) {
    return yield* fail(`Refusing to stage into ${outDir}: it overlaps ${clash.value}.`, outDir);
  }
  const exists = yield* pathExists(outDir);
  if (!exists) return;
  const entries = yield* fs.readDirectory(outDir).pipe(Effect.mapError(mapFail(`Cannot list ${outDir}.`, outDir)));
  const priorStage = yield* pathExists(path.join(outDir, "stage.json"));
  if (A.isReadonlyArrayNonEmpty(entries) && !priorStage) {
    return yield* fail(`Refusing to replace ${outDir}: it is not empty and holds no prior stage.json.`, outDir);
  }
});

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
 * records the skill and laws hashes every run record carries. The output
 * directory is replaced, so staging refuses one that overlaps the repository,
 * the archive or the skill, or that holds content but no prior `stage.json`.
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
  yield* guardStageOutDir(outDir, [repoRoot, archiveRoot, skillRoot]);
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

const scoreProbeFixture = Effect.fn("SkillProbe.scoreFixture")(function* (dir: string, taskPath: string) {
  const path = yield* Path.Path;
  const task = yield* readText(taskPath).pipe(
    Effect.flatMap(decodeTaskManifestJson),
    Effect.mapError(mapFail(`Task manifest is not valid: ${taskPath}.`, taskPath))
  );
  const repaired = repairSkillProbeTask(task);
  const { completion, law, repoRoot } = yield* evaluateTaskFixture(repaired, path.resolve(dir));
  const redactMessage = redactSkillProbePath(repoRoot);
  const redact = (violation: AgentEffectivenessEvalViolation): AgentEffectivenessEvalViolation =>
    AgentEffectivenessEvalViolation.make({ ...violation, message: redactMessage(violation.message) });
  return buildAgentEffectivenessEvalScoreReport(
    repaired,
    completion,
    LawEvaluation.make({
      ...law,
      schemaFirst: A.map(law.schemaFirst, redact),
      tsgo: pipe(
        law.tsgo,
        A.filter((violation) => !isIgnoredTsgoViolation(violation.message)),
        A.map(redact)
      ),
      biome: pipe(
        law.biome,
        A.filter((violation) => !isIgnoredBiomeViolation(violation.ruleId)),
        A.map(redact)
      ),
    })
  );
});

const isAllLanesPass = (report: AgentEffectivenessEvalScoreReport): boolean =>
  AgentEffectivenessEvalReportStatus.is.scored(report.status) &&
  report.breakdown.completion === 1 &&
  report.breakdown.schemaFirst === 1 &&
  report.breakdown.tsgo === 1 &&
  report.breakdown.biome === 1 &&
  A.isReadonlyArrayEmpty(report.violations);

const preflightVerdict = (
  fixture: AgentEffectivenessEvalScoreReport,
  knownGood: O.Option<AgentEffectivenessEvalScoreReport>
): { readonly passed: boolean; readonly reason: string } => {
  if (isAllLanesPass(fixture) || fixture.breakdown.completion >= 1) {
    return { passed: false, reason: "The untouched fixture already meets its completion contract." };
  }
  return O.match(knownGood, {
    onNone: () => ({ passed: false, reason: "No known-good solution." }),
    onSome: (report) =>
      isAllLanesPass(report)
        ? { passed: true, reason: "ok" }
        : { passed: false, reason: "The known-good solution does not pass every lane." },
  });
};

/**
 * Options for preflighting the staged tasks.
 *
 * @category models
 * @since 0.0.0
 */
export class SkillProbePreflightOptions extends S.Opaque<
  SkillProbePreflightOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({ archiveRoot: S.String, knownGoodRoot: S.String, stagePath: S.String, out: S.String }).pipe(
    $I.annoteSchema("SkillProbePreflightOptions", {
      description: "Archive, known-good solutions, stage receipt and output path for the probe preflight.",
    })
  )
) {}

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
  const path = yield* Path.Path;
  const stage = yield* readText(options.stagePath).pipe(Effect.flatMap(decodeStage));
  const rows = yield* Effect.forEach(
    stage.tasks,
    Effect.fnUntraced(function* (task) {
      const taskPath = path.join(options.archiveRoot, task.taskPath);
      const fixture = yield* scoreProbeFixture(path.join(options.archiveRoot, task.fixture), taskPath);
      const knownGoodDir = path.join(options.knownGoodRoot, task.id);
      const hasKnownGood = yield* pathExists(knownGoodDir);
      const knownGood = hasKnownGood
        ? yield* Effect.asSome(scoreProbeFixture(knownGoodDir, taskPath))
        : O.none<AgentEffectivenessEvalScoreReport>();
      const knownGoodFiles = hasKnownGood ? yield* fileDigests(knownGoodDir) : A.empty();
      const { passed, reason } = preflightVerdict(fixture, knownGood);
      return SkillProbePreflightRow.make({
        taskId: task.id,
        family: task.family,
        fixture,
        knownGood,
        knownGoodFiles,
        passed,
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
    priorPaths: S.Array(S.String),
    out: S.String,
  }).pipe(
    $I.annoteSchema("SkillProbeScoreOptions", {
      description:
        "Harness result, cell per arm, earlier records for a rerun invocation and the output path for scoring kept runs.",
    })
  )
) {}

const decodeCell = S.decodeUnknownEffect(S.Literals(["A", "B", "C"]));

const resultText = (result: unknown): string => (P.isString(result) ? result : "");

/**
 * Why a trace shows that a run ended on an API or plan-limit failure, read
 * from decoded entries: a rejected rate-limit event, or a terminal error
 * result (other than running out of turns) whose text names such a failure.
 *
 * **Example** (A rejected plan limit)
 *
 * ```ts
 * import { traceExclusionReason } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as O from "effect/Option"
 *
 * const reason = traceExclusionReason('{"type":"rate_limit_event","rate_limit_info":{"status":"rejected"}}')
 * console.log(O.isSome(reason)) // true
 * ```
 *
 * @param trace - The trace's JSON Lines text.
 * @returns The exclusion reason, or none when the run is counted.
 * @category models
 * @since 0.0.0
 */
export const traceExclusionReason = (trace: string): O.Option<string> => {
  const entries = pipe(
    trace,
    Str.split("\n"),
    A.filter(Str.isNonEmpty),
    A.map((line) => decodeTraceEntry(line)),
    A.getSomes
  );
  const rejected = A.some(
    entries,
    (entry) => entry.type === "rate_limit_event" && entry.rate_limit_info?.status === "rejected"
  );
  if (rejected) return O.some("The trace carries a rejected rate-limit event.");
  return pipe(
    A.findLast(entries, (entry) => entry.type === "result"),
    O.filter(
      (entry) =>
        entry.is_error === true &&
        entry.subtype !== "error_max_turns" &&
        API_ERROR_PATTERN.test(resultText(entry.result))
    ),
    O.map((entry) => `The trace's final result is an API error: ${Str.slice(0, 200)(resultText(entry.result))}`)
  );
};

const traceApiError = Effect.fn("SkillProbe.traceApiError")(function* (tracePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(tracePath).pipe(Effect.orElseSucceed(() => ""));
  return traceExclusionReason(text);
});

// Exclusions decided before any kept directory is read, in rule order.
const runExclusionReason = (run: PluginEvalRun, traceError: O.Option<string>, keptDir: string): O.Option<string> => {
  if (run.error !== null && API_ERROR_PATTERN.test(run.error)) return O.some(`Harness API error: ${run.error}`);
  if (O.isSome(traceError)) return traceError;
  return Str.isEmpty(keptDir) ? O.some(`No kept directory: ${run.error ?? "the harness started no agent"}`) : O.none();
};

const scoreKeptDir = Effect.fn("SkillProbe.scoreKeptDir")(function* (
  keptDir: string,
  archiveRoot: string,
  task: SkillProbeStage["tasks"][number]
): Effect.fn.Return<SkillProbeOutcome, AgentEffectivenessEvalScorerError, ScoreEnv> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.chmod(keptDir, 0o700).pipe(Effect.ignore);
  yield* fs.chmod(path.join(keptDir, "sealed"), 0o700).pipe(Effect.ignore);
  const fixtureDir = path.join(keptDir, "sealed", "home", "cwd", task.fixture);
  const exists = yield* pathExists(fixtureDir);
  if (!exists) return SkillProbeOutcome.cases.Excluded.make({ reason: "The fixture is missing." });
  const attempt = scoreProbeFixture(fixtureDir, path.join(archiveRoot, task.taskPath));
  const first = yield* attempt;
  const report = AgentEffectivenessEvalReportStatus.is["environment-failure"](first.status) ? yield* attempt : first;
  return AgentEffectivenessEvalReportStatus.is["environment-failure"](report.status)
    ? SkillProbeOutcome.cases.Excluded.make({ reason: "Scorer environment failure after a rescore." })
    : SkillProbeOutcome.cases.Scored.make({ report, allLanesPass: isAllLanesPass(report), laneFraction: report.score });
});

const scoreRun = Effect.fn("SkillProbe.scoreRun")(function* (
  run: PluginEvalRun,
  context: {
    readonly archiveRoot: string;
    readonly task: SkillProbeStage["tasks"][number];
    readonly cell: SkillProbeCell;
    readonly invocation: string;
    readonly runIndex: number;
    readonly slot: string;
    readonly attempt: number;
    readonly fingerprint: SkillProbeFingerprint;
  }
): Effect.fn.Return<SkillProbeRunRecord, AgentEffectivenessEvalScorerError, ScoreEnv> {
  const path = yield* Path.Path;
  const keptDir = Str.isEmpty(run.tracePath) ? "" : path.dirname(path.dirname(run.tracePath));
  const passed = (name: string) => A.some(run.graders, (grader) => grader.name === name && grader.passed);
  const traceError = Str.isEmpty(run.tracePath) ? O.none<string>() : yield* traceApiError(run.tracePath);
  const reason = runExclusionReason(run, traceError, keptDir);
  const outcome = O.isSome(reason)
    ? SkillProbeOutcome.cases.Excluded.make({ reason: reason.value })
    : yield* scoreKeptDir(keptDir, context.archiveRoot, context.task);
  return SkillProbeRunRecord.make({
    schemaVersion: "skill-probe-run/v1",
    taskId: context.task.id,
    family: context.task.family,
    cell: context.cell,
    invocation: context.invocation,
    runIndex: context.runIndex,
    slot: context.slot,
    attempt: context.attempt,
    keptDir: Str.isEmpty(keptDir) ? "none" : path.basename(keptDir),
    scorerProfile: SKILL_PROBE_SCORER_PROFILE,
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

const slotOf = (taskId: string, cell: SkillProbeCell, index: number): string => `${taskId}#${cell}#${index}`;

type SlotJob = {
  readonly run: PluginEvalRun;
  readonly task: SkillProbeStage["tasks"][number];
  readonly cell: SkillProbeCell;
  readonly runIndex: number;
};

const assignSlots = (
  jobs: ReadonlyArray<SlotJob>,
  priors: ReadonlyArray<SkillProbeRunRecord>
): Effect.Effect<
  ReadonlyArray<SlotJob & { readonly slot: string; readonly attempt: number }>,
  AgentEffectivenessEvalScorerError
> => {
  if (A.isReadonlyArrayEmpty(priors)) {
    return Effect.succeed(
      A.map(jobs, (job) => ({ ...job, slot: slotOf(job.task.id, job.cell, job.runIndex), attempt: 1 }))
    );
  }
  const latest = pipe(
    A.groupBy(priors, (record): string => record.slot),
    R.values,
    A.map(flow(A.sort(Order.mapInput(Order.Number, (record: SkillProbeRunRecord) => record.attempt)), A.lastNonEmpty))
  );
  const openSlots = (taskId: string, cell: SkillProbeCell) =>
    pipe(
      latest,
      A.filter(
        (record) =>
          record.taskId === taskId && record.cell === cell && SkillProbeOutcome.guards.Excluded(record.outcome)
      ),
      A.sort(Order.mapInput(Order.String, (record: SkillProbeRunRecord) => record.slot))
    );
  const groups = R.values(A.groupBy(jobs, (job): string => `${job.task.id}#${job.cell}`));
  return Effect.forEach(groups, (group) => {
    const first = A.headNonEmpty(group);
    const slots = openSlots(first.task.id, first.cell);
    if (A.length(group) > A.length(slots)) {
      return fail(
        `Rerun has ${A.length(group)} runs for ${first.task.id} cell ${first.cell} but only ${A.length(slots)} excluded slots.`
      );
    }
    return Effect.forEach(A.zip(group, slots), ([job, slot]) =>
      slot.attempt + 1 > 3
        ? fail(`Slot ${slot.slot} would reach attempt ${slot.attempt + 1}; at most two reruns are allowed.`)
        : Effect.succeed({ ...job, slot: slot.slot, attempt: slot.attempt + 1 })
    );
  }).pipe(Effect.map(A.flatten));
};

/**
 * Score every run of one `claude plugin eval --json` result into run records.
 *
 * **Details**
 *
 * `withCell` and `withoutCell` name the cell each harness arm measures. Each
 * run's kept directory is the grandparent of its `tracePath`; the scorer
 * reads the fixture copy under `sealed/home/cwd`. API and rate-limit failures
 * are recorded as excluded, never scored. Every populated arm needs a cell,
 * every case must be staged, and an existing output file is never
 * overwritten. With `priorPaths` the invocation is a rerun: its runs fill the
 * excluded slots of those records, in slot order, as the next attempt.
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
 *     priorPaths: [],
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
  const outExists = yield* pathExists(options.out);
  if (outExists) {
    return yield* fail(
      `Refusing to overwrite ${options.out}; write each invocation to its own records file.`,
      options.out
    );
  }
  const withCell = yield* Effect.transposeOption(O.map(options.withCell, decodeCell));
  const withoutCell = yield* Effect.transposeOption(O.map(options.withoutCell, decodeCell));
  const unstaged = pipe(
    result.cases,
    A.filter((evalCase) => !A.some(stage.tasks, (staged) => staged.id === evalCase.name)),
    A.map((evalCase) => evalCase.name)
  );
  if (A.isReadonlyArrayNonEmpty(unstaged)) {
    return yield* fail(`Cases not in the stage: ${A.join(unstaged, ", ")}.`, options.resultPath);
  }
  const populated = (runs: (evalCase: PluginEvalResult["cases"][number]) => ReadonlyArray<PluginEvalRun> | undefined) =>
    A.some(result.cases, (evalCase) => A.isReadonlyArrayNonEmpty(runs(evalCase) ?? A.empty()));
  const unmapped = A.getSomes([
    populated((evalCase) => evalCase.arms.with) && O.isNone(withCell) ? O.some("with") : O.none(),
    populated((evalCase) => evalCase.arms.without) && O.isNone(withoutCell) ? O.some("without") : O.none(),
  ]);
  if (A.isReadonlyArrayNonEmpty(unmapped)) {
    return yield* fail(`Populated arms without a cell mapping: ${A.join(unmapped, ", ")}.`, options.resultPath);
  }
  const priors = yield* readSkillProbeRecords(options.priorPaths);
  const jobs = A.flatMap(result.cases, (evalCase) => {
    const task = A.findFirst(stage.tasks, (staged) => staged.id === evalCase.name);
    const arm = (runs: ReadonlyArray<PluginEvalRun> | undefined, cell: O.Option<SkillProbeCell>) =>
      O.isSome(task) && O.isSome(cell)
        ? A.map(runs ?? A.empty(), (run, runIndex) => ({ run, task: task.value, cell: cell.value, runIndex }))
        : A.empty();
    return A.appendAll(arm(evalCase.arms.with, withCell), arm(evalCase.arms.without, withoutCell));
  });
  const assigned = yield* assignSlots(jobs, priors);
  const records = yield* Effect.forEach(
    assigned,
    ({ run, task, cell, runIndex, slot, attempt }) =>
      scoreRun(run, {
        archiveRoot: options.archiveRoot,
        task,
        cell,
        invocation: options.invocation,
        runIndex,
        slot,
        attempt,
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

// Records the rule lets a report or a selection pool, or a failure naming every problem.
const readPoolableRecords = Effect.fn("SkillProbe.readPoolableRecords")(function* (
  files: ReadonlyArray<string>,
  preflightPath: string
) {
  const preflight = yield* readText(preflightPath).pipe(Effect.flatMap(decodePreflight));
  const records = yield* readSkillProbeRecords(files);
  const problems = validateSkillProbeRecords(records, preflight.dropped);
  if (A.isReadonlyArrayNonEmpty(problems)) {
    return yield* fail(`Run records cannot be pooled:\n- ${A.join(problems, "\n- ")}`);
  }
  return records;
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
 * console.log(Effect.isEffect(runSkillProbeReport(["runs.jsonl"], "preflight.json", "all-lanes"))) // true
 * ```
 *
 * @param files - JSON Lines files of `SkillProbeRunRecord`.
 * @param preflightPath - Preflight receipt; records of its dropped tasks are refused.
 * @param primary - Primary measure the verdict reads.
 * @returns Cell summaries, paired differences, fired rate and verdict for the records.
 * @category commands
 * @since 0.0.0
 */
export const runSkillProbeReport = Effect.fn("SkillProbe.report")(function* (
  files: ReadonlyArray<string>,
  preflightPath: string,
  primary: SkillProbePrimary
): Effect.fn.Return<SkillProbeReport, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv> {
  const records = yield* readPoolableRecords(files, preflightPath);
  const report = buildSkillProbeReport(records, primary);
  yield* encodeReport(report).pipe(Effect.flatMap(Console.log));
  return report;
});

const encodeSelection = S.encodeEffect(S.fromJsonString(SkillProbePrimarySelection));

/**
 * Validate pilot records and print the primary selection as JSON.
 *
 * **Example** (Select from pilot records)
 *
 * ```ts
 * import { runSkillProbeSelect } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runSkillProbeSelect(["pilot.jsonl"], "preflight.json"))) // true
 * ```
 *
 * @param files - Pilot run record files.
 * @param preflightPath - Preflight receipt; records of its dropped tasks are refused.
 * @returns Each candidate's qualifying tasks and families and the selected primary.
 * @category commands
 * @since 0.0.0
 */
export const runSkillProbeSelect = Effect.fn("SkillProbe.select")(function* (
  files: ReadonlyArray<string>,
  preflightPath: string
): Effect.fn.Return<SkillProbePrimarySelection, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv> {
  const records = yield* readPoolableRecords(files, preflightPath);
  const selection = selectSkillProbePrimary(records);
  yield* encodeSelection(selection).pipe(Effect.flatMap(Console.log));
  return selection;
});

const encodeLaneReport = S.encodeEffect(S.fromJsonString(SkillLaneProbeReport));

/**
 * Build the lane probe report from run record files and print it as JSON.
 *
 * **Details**
 *
 * Refuses records the first probe's pooling checks reject and more than 144
 * attempts. A pilot report is labelled as such and carries no verdict.
 *
 * **Example** (Report pilot records)
 *
 * ```ts
 * import { runSkillLaneProbeReport, SkillLaneProbeOptions } from "@beep/repo-cli/test/AgentEffectiveness"
 * import * as Effect from "effect/Effect"
 *
 * const program = runSkillLaneProbeReport(
 *   ["runs.jsonl"],
 *   "preflight.json",
 *   SkillLaneProbeOptions.make({ data: "pilot", seed: 20261113, relabelings: 100000 })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param files - JSON Lines files of `SkillProbeRunRecord`.
 * @param preflightPath - Preflight receipt; records of its dropped tasks are refused.
 * @param options - Data label, seed and relabeling count.
 * @returns The report that was printed, with its verdict on scored data.
 * @category commands
 * @since 0.0.0
 */
export const runSkillLaneProbeReport = Effect.fn("SkillProbe.laneReport")(function* (
  files: ReadonlyArray<string>,
  preflightPath: string,
  options: SkillLaneProbeOptions
): Effect.fn.Return<SkillLaneProbeReport, AgentEffectivenessEvalScorerError | S.SchemaError, ProbeEnv> {
  const records = yield* readPoolableRecords(files, preflightPath);
  if (A.length(records) > SKILL_LANE_PROBE_MAX_ATTEMPTS) {
    return yield* fail(`${A.length(records)} attempts exceed the cap of ${SKILL_LANE_PROBE_MAX_ATTEMPTS}.`);
  }
  const report = yield* buildSkillLaneProbeReport(records, options);
  yield* encodeLaneReport(report).pipe(Effect.flatMap(Console.log));
  return report;
});
