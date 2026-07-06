/**
 * SkillOpt eval scorer for `agent-effectiveness evals score`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import { $RepoCliId } from "@beep/identity/packages";
import {
  AiMetricsBenchmarkCaseInput,
  AiMetricsBenchmarkRunInput,
  AiMetricsQualityGateStatus,
  hashPublicTextSha256,
  recordAiMetricsBenchmarkRun,
  upsertAiMetricsBenchmarkCase,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { A } from "@beep/utils";
import { Clock, Console, Effect, FileSystem, flow, Layer, Order, Path, pipe, Stream } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { Project } from "ts-morph";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalScorer");

const SCHEMA_FIRST_ISSUE_PREFIX = "[schema-first:issue] ";
const SCHEMA_FIRST_FIXTURE_PACKAGE_PREFIX = "packages/fixture/";
const DEFAULT_AGENT_EFFECTIVENESS_DATA_ROOT = ".beep/ai-metrics";
const SCORE_FORMAT_DIGITS = 6;

const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const decodeUnknownJsonOption = S.decodeUnknownOption(S.UnknownFromJsonString);
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));

const SourceFileExtension = LiteralKit([".ts", ".tsx"]).pipe(
  $I.annoteSchema("AgentEffectivenessEvalSourceFileExtension", {
    description: "TypeScript source file extensions included in SkillOpt fixture source text.",
  })
);

/**
 * Source of a scorer violation.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 *
 * console.log(AgentEffectivenessEvalViolationSource.is.tsgo("tsgo"))
 * ```
 * @category models
 * @since 0.0.0
 */
export const AgentEffectivenessEvalViolationSource = LiteralKit(["schema-first", "tsgo", "biome", "completion"]).pipe(
  $I.annoteSchema("AgentEffectivenessEvalViolationSource", {
    description: "Bounded sources emitted in SkillOpt eval scorer violations.",
  })
);

/**
 * Source of a scorer violation.
 *
 * @example
 * ```ts
 * import type { AgentEffectivenessEvalViolationSource } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 *
 * const source: AgentEffectivenessEvalViolationSource = "completion"
 * console.log(source)
 * ```
 * @category type-level
 * @since 0.0.0
 */
export type AgentEffectivenessEvalViolationSource = typeof AgentEffectivenessEvalViolationSource.Type;

/**
 * Declarative checks a rollout must satisfy: required exported symbol names
 * plus required/forbidden source regexes from the task manifest.
 *
 * @category models
 * @since 0.0.0
 */
class SkillOptTaskCompletionCriteria extends S.Class<SkillOptTaskCompletionCriteria>(
  $I`SkillOptTaskCompletionCriteria`
)(
  {
    requiredExports: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    requiredPatterns: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    forbiddenPatterns: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("SkillOptTaskCompletionCriteria", {
    description: "Declarative deterministic completion checks from a SkillOpt task manifest.",
  })
) {}

/**
 * SkillOpt task weighting block retained from the manifest contract.
 *
 * @category models
 * @since 0.0.0
 */
class SkillOptTaskWeights extends S.Class<SkillOptTaskWeights>($I`SkillOptTaskWeights`)(
  {
    completion: S.Finite,
    law: S.Finite,
  },
  $I.annote("SkillOptTaskWeights", {
    description: "Manifest weighting metadata retained for compatibility; scorer formula remains contract-fixed.",
  })
) {}

/**
 * SkillOpt task manifest consumed by the scorer.
 *
 * @example
 * ```ts
 * import type { SkillOptTaskManifest } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 *
 * declare const task: SkillOptTaskManifest
 * console.log(task.id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SkillOptTaskManifest extends S.Class<SkillOptTaskManifest>($I`SkillOptTaskManifest`)(
  {
    id: S.String,
    ruleIds: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    derivedFrom: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    prompt: S.String,
    fixture: S.String,
    entrypoint: S.String,
    completion: SkillOptTaskCompletionCriteria,
    weights: S.optionalKey(SkillOptTaskWeights),
  },
  $I.annote("SkillOptTaskManifest", {
    description: "SkillOpt eval task manifest with deterministic completion criteria.",
  })
) {}

/**
 * One scorer violation in the fixed P2/P3 contract shape.
 *
 * @example
 * ```ts
 * import { AgentEffectivenessEvalViolation } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 *
 * const violation = AgentEffectivenessEvalViolation.make({
 *   source: "completion",
 *   ruleId: "completion",
 *   file: "src/Contact.ts",
 *   line: 1,
 *   message: "Missing export Contact"
 * })
 * console.log(violation.source)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalViolation extends S.Class<AgentEffectivenessEvalViolation>(
  $I`AgentEffectivenessEvalViolation`
)(
  {
    source: AgentEffectivenessEvalViolationSource,
    ruleId: S.String,
    file: S.String,
    line: S.Finite,
    message: S.String,
  },
  $I.annote("AgentEffectivenessEvalViolation", {
    description: "Normalized SkillOpt eval scorer violation.",
  })
) {}

/**
 * Fixed scorer output breakdown.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScoreBreakdown extends S.Class<AgentEffectivenessEvalScoreBreakdown>(
  $I`AgentEffectivenessEvalScoreBreakdown`
)(
  {
    completion: S.Finite,
    schemaFirst: S.Finite,
    tsgo: S.Finite,
    biome: S.Finite,
  },
  $I.annote("AgentEffectivenessEvalScoreBreakdown", {
    description: "Scorer component fractions in the fixed contract output.",
  })
) {}

/**
 * Fixed scorer JSON report.
 *
 * @example
 * ```ts
 * import type { AgentEffectivenessEvalScoreReport } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalScorer"
 *
 * declare const report: AgentEffectivenessEvalScoreReport
 * console.log(report.score)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScoreReport extends S.Class<AgentEffectivenessEvalScoreReport>(
  $I`AgentEffectivenessEvalScoreReport`
)(
  {
    taskId: S.String,
    score: S.Finite,
    breakdown: AgentEffectivenessEvalScoreBreakdown,
    violations: S.Array(AgentEffectivenessEvalViolation),
  },
  $I.annote("AgentEffectivenessEvalScoreReport", {
    description: "Machine-readable SkillOpt eval score report emitted by agent-effectiveness evals score.",
  })
) {}

/**
 * Result of recording a scorer report in ai-metrics.
 *
 * @category models
 * @since 0.0.0
 */
export class AgentEffectivenessEvalRecordResult extends S.Class<AgentEffectivenessEvalRecordResult>(
  $I`AgentEffectivenessEvalRecordResult`
)(
  {
    benchmarkRunId: S.String,
    benchmarkCaseId: S.String,
  },
  $I.annote("AgentEffectivenessEvalRecordResult", {
    description: "Identifiers written by --record after a SkillOpt eval scorer run.",
  })
) {}

/**
 * Operational scorer failure.
 *
 * @category errors
 * @since 0.0.0
 */
export class AgentEffectivenessEvalScorerError extends TaggedErrorClass<AgentEffectivenessEvalScorerError>(
  $I`AgentEffectivenessEvalScorerError`
)(
  "AgentEffectivenessEvalScorerError",
  {
    message: S.String,
    file: S.optionalKey(S.String),
    command: S.optionalKey(S.String),
    exitCode: S.optionalKey(S.Finite),
    cause: S.optionalKey(S.Defect({ includeStack: true })),
  },
  $I.annote("AgentEffectivenessEvalScorerError", {
    description: "Operational scorer failure; law and completion findings stay in score reports instead.",
  })
) {
  static readonly new = (message: string, options: AgentEffectivenessEvalScorerError.Options = {}) =>
    AgentEffectivenessEvalScorerError.make({ message, ...options });

  static readonly mapError =
    (message: string, options: AgentEffectivenessEvalScorerError.Options = {}) =>
    (cause: unknown): AgentEffectivenessEvalScorerError =>
      AgentEffectivenessEvalScorerError.make({ cause, message, ...options });
}

export declare namespace AgentEffectivenessEvalScorerError {
  /**
   * Optional context for a scorer operational failure.
   *
   * @category errors
   * @since 0.0.0
   */
  export type Options = {
    readonly file?: string;
    readonly command?: string;
    readonly exitCode?: number;
  };
}

class SchemaFirstPolicyIssue extends S.Class<SchemaFirstPolicyIssue>($I`SchemaFirstPolicyIssue`)(
  {
    category: S.Literal("schema-first-policy"),
    ruleId: S.String,
    severity: S.optionalKey(S.String),
    file: S.String,
    line: S.optionalKey(S.Finite),
    symbol: S.optionalKey(S.String),
    message: S.String,
    remediation: S.optionalKey(S.String),
  },
  $I.annote("SchemaFirstPolicyIssue", {
    description: "Structured policy issue line emitted by `beep lint schema-first`.",
  })
) {}

const decodeTaskManifestJson = S.decodeUnknownEffect(S.fromJsonString(SkillOptTaskManifest));
const decodeSchemaFirstIssueJson = S.decodeUnknownOption(S.fromJsonString(SchemaFirstPolicyIssue));

type SourceFileSnapshot = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly text: string;
};

type SubprocessResult = {
  readonly command: string;
  readonly output: string;
  readonly exitCode: number;
};

type CompletionResult = {
  readonly fraction: number;
  readonly violations: ReadonlyArray<AgentEffectivenessEvalViolation>;
};

type LawEvaluation = {
  readonly schemaFirst: ReadonlyArray<AgentEffectivenessEvalViolation>;
  readonly tsgo: ReadonlyArray<AgentEffectivenessEvalViolation>;
  readonly biome: ReadonlyArray<AgentEffectivenessEvalViolation>;
};

/**
 * Encode a score report as the fixed compact JSON output.
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeAgentEffectivenessEvalScoreReportJson: (
  report: AgentEffectivenessEvalScoreReport
) => Effect.Effect<string, S.SchemaError> = S.encodeUnknownEffect(S.fromJsonString(AgentEffectivenessEvalScoreReport));

const formatCommand = (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " ");

const normalizePathSeparators = Str.replaceAll("\\", "/");

const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));

const firstRuleId = (task: SkillOptTaskManifest): string =>
  pipe(
    task.ruleIds,
    A.head,
    O.getOrElse(() => "completion")
  );

const roundScore = (value: number): number => globalThis.Number(value.toFixed(SCORE_FORMAT_DIGITS));

const scoreOrder = Order.combine(
  Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.source),
  Order.combine(
    Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.file),
    Order.combine(
      Order.mapInput(Order.Number, (violation: AgentEffectivenessEvalViolation) => violation.line),
      Order.combine(
        Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.ruleId),
        Order.mapInput(Order.String, (violation: AgentEffectivenessEvalViolation) => violation.message)
      )
    )
  )
);

const violationKey = (violation: AgentEffectivenessEvalViolation): string =>
  `${violation.source}\u0000${violation.ruleId}\u0000${violation.file}\u0000${violation.line}\u0000${violation.message}`;

const sortViolations: (
  violations: ReadonlyArray<AgentEffectivenessEvalViolation>
) => ReadonlyArray<AgentEffectivenessEvalViolation> = flow(
  A.dedupeWith((left, right) => violationKey(left) === violationKey(right)),
  A.sort(scoreOrder)
);

const lineForOffset = (content: string, offset: number): number =>
  pipe(content, Str.slice(0, offset), Str.split("\n"), A.length);

const sourceFileLineForPattern = (
  snapshots: ReadonlyArray<SourceFileSnapshot>,
  pattern: RegExp
): O.Option<readonly [SourceFileSnapshot, number]> =>
  pipe(
    snapshots,
    A.findFirst((snapshot) => pattern.exec(snapshot.text) !== null),
    O.map((snapshot) => {
      const match = pattern.exec(snapshot.text);
      return [snapshot, lineForOffset(snapshot.text, match?.index ?? 0)] as const;
    })
  );

const sourceFileMatchesPattern = (snapshots: ReadonlyArray<SourceFileSnapshot>, pattern: RegExp): boolean =>
  O.isSome(sourceFileLineForPattern(snapshots, pattern));

const compileCompletionPattern = (pattern: string): Effect.Effect<RegExp, AgentEffectivenessEvalScorerError> =>
  Effect.try({
    try: () => new RegExp(pattern, "u"),
    catch: AgentEffectivenessEvalScorerError.mapError(`Invalid completion regex: ${pattern}`),
  });

const isSourceFileName = (entry: string): boolean =>
  A.some(SourceFileExtension.Options, (extension) => Str.endsWith(extension)(entry));

const listSourceFiles = Effect.fn("AgentEffectivenessEvalScorer.listSourceFiles")(function* (
  root: string
): Effect.fn.Return<ReadonlyArray<string>, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walk = Effect.fn("AgentEffectivenessEvalScorer.listSourceFiles.walk")(function* (
    current: string
  ): Effect.fn.Return<ReadonlyArray<string>, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path> {
    const entries = yield* fs
      .readDirectory(current)
      .pipe(
        Effect.mapError(AgentEffectivenessEvalScorerError.mapError(`Failed to read ${current}.`, { file: current }))
      );
    let files = A.empty<string>();

    for (const entry of A.sort(entries, Order.String)) {
      const absolutePath = path.join(current, entry);
      const stat = yield* fs
        .stat(absolutePath)
        .pipe(
          Effect.mapError(
            AgentEffectivenessEvalScorerError.mapError(`Failed to stat ${absolutePath}.`, { file: absolutePath })
          )
        );

      if (stat.type === "Directory") {
        if (entry === "node_modules" || entry === "dist" || entry === "build" || entry === ".turbo") {
          continue;
        }
        files = A.appendAll(files, yield* walk(absolutePath));
        continue;
      }

      if (stat.type === "File" && isSourceFileName(entry)) {
        files = A.append(files, absolutePath);
      }
    }

    return files;
  });

  return A.sort(yield* walk(root), Order.String);
});

const readSourceSnapshots = Effect.fn("AgentEffectivenessEvalScorer.readSourceSnapshots")(function* (
  fixtureDir: string
): Effect.fn.Return<
  ReadonlyArray<SourceFileSnapshot>,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceFiles = yield* listSourceFiles(fixtureDir);
  return yield* Effect.forEach(
    sourceFiles,
    Effect.fn(function* (absolutePath) {
      const text = yield* fs.readFileString(absolutePath).pipe(
        Effect.mapError(
          AgentEffectivenessEvalScorerError.mapError(`Failed to read source file ${absolutePath}.`, {
            file: absolutePath,
          })
        )
      );
      return {
        absolutePath,
        relativePath: normalizeRelativePath(path.relative(fixtureDir, absolutePath)),
        text,
      };
    }),
    { concurrency: 8 }
  );
});

const parseExportedSymbols = Effect.fn("AgentEffectivenessEvalScorer.parseExportedSymbols")(function* (
  entrypointPath: string
): Effect.fn.Return<ReadonlyArray<string>, AgentEffectivenessEvalScorerError> {
  return yield* Effect.sync(() => {
    const project = new Project({ skipAddingFilesFromTsConfig: true });
    const sourceFile = project.addSourceFileAtPath(entrypointPath);
    return pipe(A.fromIterable(sourceFile.getExportedDeclarations().keys()), A.sort(Order.String));
  }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Failed to parse exported symbols from ${entrypointPath}.`, {
        file: entrypointPath,
      })
    )
  );
});

/**
 * Evaluate deterministic completion criteria from a SkillOpt task manifest.
 *
 * Export names are parsed from the manifest entrypoint with ts-morph. Pattern
 * checks use JavaScript regular expressions over fixture TypeScript source
 * files; this intentionally follows the contract's regex surface and does not
 * attempt semantic matching.
 *
 * @category services
 * @since 0.0.0
 */
export const evaluateSkillOptCompletion = Effect.fn("AgentEffectivenessEvalScorer.evaluateCompletion")(function* (
  task: SkillOptTaskManifest,
  fixtureDir: string
): Effect.fn.Return<CompletionResult, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const snapshots = yield* readSourceSnapshots(fixtureDir);
  const entrypointRelative = normalizeRelativePath(task.entrypoint);
  const entrypointPath = path.join(fixtureDir, entrypointRelative);
  const exportedSymbols = yield* parseExportedSymbols(entrypointPath);
  const ruleId = firstRuleId(task);
  const violations = A.empty<AgentEffectivenessEvalViolation>();
  let passed = 0;
  let total = 0;

  for (const requiredExport of task.completion.requiredExports) {
    total += 1;
    if (A.contains(exportedSymbols, requiredExport)) {
      passed += 1;
      continue;
    }
    A.appendInPlace(
      violations,
      AgentEffectivenessEvalViolation.make({
        source: "completion",
        ruleId,
        file: entrypointRelative,
        line: 1,
        message: `Missing required export "${requiredExport}".`,
      })
    );
  }

  for (const pattern of task.completion.requiredPatterns) {
    total += 1;
    const regex = yield* compileCompletionPattern(pattern);
    if (sourceFileMatchesPattern(snapshots, regex)) {
      passed += 1;
      continue;
    }
    A.appendInPlace(
      violations,
      AgentEffectivenessEvalViolation.make({
        source: "completion",
        ruleId,
        file: entrypointRelative,
        line: 1,
        message: `Missing required pattern /${pattern}/.`,
      })
    );
  }

  for (const pattern of task.completion.forbiddenPatterns) {
    total += 1;
    const regex = yield* compileCompletionPattern(pattern);
    const match = sourceFileLineForPattern(snapshots, regex);
    if (O.isNone(match)) {
      passed += 1;
      continue;
    }
    const [snapshot, line] = match.value;
    A.appendInPlace(
      violations,
      AgentEffectivenessEvalViolation.make({
        source: "completion",
        ruleId,
        file: snapshot.relativePath,
        line,
        message: `Forbidden pattern /${pattern}/ matched.`,
      })
    );
  }

  return {
    fraction: total === 0 ? 1 : roundScore(passed / total),
    violations: sortViolations(violations),
  };
});

/**
 * Map a component's violation count to a deterministic [0, 1] law score.
 *
 * The scorer uses monotone reciprocal decay: `1 / (1 + violations)`.
 * One finding maps to `0.5`, two findings to `0.333333`, and zero findings to
 * `1`. The mapping is deterministic, bounded, and gives every additional
 * violation diminishing but nonzero penalty.
 *
 * @param violationCount - Number of violations the component reported.
 * @returns Component score in `[0, 1]`.
 * @category scoring
 * @since 0.0.0
 */
export const lawComponentScore = (violationCount: number): number => roundScore(1 / (1 + violationCount));

/**
 * Aggregate law components by arithmetic mean.
 *
 * Schema-first lint, tsgo diagnostics, and biome diagnostics each first use
 * {@link lawComponentScore}; `law_frac` is the deterministic arithmetic mean
 * of those three component scores.
 *
 * @param schemaFirst - Schema-first lint component score.
 * @param tsgo - tsgo diagnostics component score.
 * @param biome - Biome diagnostics component score.
 * @returns Mean law fraction in `[0, 1]`.
 * @category scoring
 * @since 0.0.0
 */
export const aggregateLawFraction = (schemaFirst: number, tsgo: number, biome: number): number =>
  roundScore((schemaFirst + tsgo + biome) / 3);

const runSubprocess = Effect.fn("AgentEffectivenessEvalScorer.runSubprocess")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<SubprocessResult, AgentEffectivenessEvalScorerError, ChildProcessSpawner.ChildProcessSpawner> {
  const commandText = formatCommand(command, args);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(command, [...args], {
        cwd,
        extendEnv: true,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* handle.all.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc, chunk) => `${acc}${chunk}`
        )
      );
      const exitCode = yield* handle.exitCode;
      return {
        command: commandText,
        output: Str.trim(output),
        exitCode,
      };
    })
  ).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Failed to run subprocess: ${commandText}.`, {
        command: commandText,
      })
    )
  );
});

const writeJsonFile = Effect.fn("AgentEffectivenessEvalScorer.writeJsonFile")(function* (
  filePath: string,
  value: unknown
): Effect.fn.Return<void, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(filePath), { recursive: true })
    .pipe(
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError(`Failed to create directory for ${filePath}.`, { file: filePath })
      )
    );
  const content = yield* encodeJson(value).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError(`Failed to encode ${filePath}.`, { file: filePath }))
  );
  yield* fs
    .writeFileString(filePath, `${content}\n`)
    .pipe(
      Effect.mapError(AgentEffectivenessEvalScorerError.mapError(`Failed to write ${filePath}.`, { file: filePath }))
    );
});

const prepareSchemaFirstWrapper = Effect.fn("AgentEffectivenessEvalScorer.prepareSchemaFirstWrapper")(function* (
  fixtureDir: string
): Effect.fn.Return<string, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const wrapperDir = yield* fs
    .makeTempDirectoryScoped({ prefix: "agent-effectiveness-schema-first-" })
    .pipe(
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError("Failed to create temporary schema-first wrapper directory.")
      )
    );
  const wrapperFixtureDir = path.join(wrapperDir, "packages", "fixture");
  yield* fs.makeDirectory(path.dirname(wrapperFixtureDir), { recursive: true }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to create temporary schema-first package directory.", {
        file: wrapperFixtureDir,
      })
    )
  );
  yield* fs.copy(fixtureDir, wrapperFixtureDir).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to copy fixture into schema-first wrapper.", {
        file: fixtureDir,
      })
    )
  );
  yield* writeJsonFile(path.join(wrapperDir, "tsconfig.json"), {
    compilerOptions: {},
    include: ["packages/**/*"],
  });
  yield* writeJsonFile(path.join(wrapperDir, "package.json"), {
    name: "@beep/agent-effectiveness-schema-first-wrapper",
    private: true,
    type: "module",
  });

  return wrapperDir;
});

const schemaFirstFixtureFile = (file: string): string =>
  pipe(
    normalizeRelativePath(file),
    O.liftPredicate(Str.startsWith(SCHEMA_FIRST_FIXTURE_PACKAGE_PREFIX)),
    O.map(Str.slice(SCHEMA_FIRST_FIXTURE_PACKAGE_PREFIX.length)),
    O.getOrElse(() => normalizeRelativePath(file))
  );

const schemaFirstIssueToViolation = (issue: SchemaFirstPolicyIssue): AgentEffectivenessEvalViolation =>
  AgentEffectivenessEvalViolation.make({
    source: "schema-first",
    ruleId: issue.ruleId,
    file: schemaFirstFixtureFile(issue.file),
    line: issue.line ?? 1,
    message: issue.message,
  });

const schemaFirstIssueFromLine = (line: string): O.Option<SchemaFirstPolicyIssue> =>
  pipe(
    O.some(line),
    O.filter(Str.startsWith(SCHEMA_FIRST_ISSUE_PREFIX)),
    O.map(Str.slice(SCHEMA_FIRST_ISSUE_PREFIX.length)),
    O.flatMap(decodeSchemaFirstIssueJson)
  );

const parseSchemaFirstViolations: (output: string) => ReadonlyArray<AgentEffectivenessEvalViolation> = flow(
  Str.split("\n"),
  A.filter(Str.isNonEmpty),
  A.map(schemaFirstIssueFromLine),
  A.getSomes,
  A.map(schemaFirstIssueToViolation),
  sortViolations
);

const evaluateSchemaFirst = Effect.fn("AgentEffectivenessEvalScorer.evaluateSchemaFirst")(function* (
  fixtureDir: string,
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<AgentEffectivenessEvalViolation>,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const wrapperDir = yield* prepareSchemaFirstWrapper(fixtureDir);
      const cliEntrypoint = path.join(repoRoot, "packages", "tooling", "tool", "cli", "src", "bin.ts");
      const result = yield* runSubprocess("bun", ["run", cliEntrypoint, "lint", "schema-first"], wrapperDir);
      const violations = parseSchemaFirstViolations(result.output);

      if (result.exitCode !== 0 && A.length(violations) === 0) {
        return yield* AgentEffectivenessEvalScorerError.new(
          "schema-first lint failed without structured issue output.",
          {
            command: result.command,
            exitCode: result.exitCode,
          }
        );
      }

      return violations;
    })
  );
});

const lineNumberFromDiagnostic = (line: string): number =>
  pipe(
    /^.+\((\d+),\d+\):/u.exec(line) ?? /^.+:(\d+):\d+ - /u.exec(line),
    O.fromNullishOr,
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.flatMap((value) =>
      pipe(
        globalThis.Number.parseInt(value, 10),
        O.liftPredicate((parsed) => globalThis.Number.isFinite(parsed) && parsed > 0)
      )
    ),
    O.getOrElse(() => 1)
  );

const diagnosticRuleId = (line: string, fallback: string): string =>
  pipe(
    /\b(TS\d+)\b/u.exec(line),
    O.fromNullishOr,
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.getOrElse(() => fallback)
  );

const sourceFileForLine = (sourceFiles: ReadonlyArray<string>, line: string): string =>
  pipe(
    sourceFiles,
    A.findFirst((file) => Str.includes(file)(normalizePathSeparators(line))),
    O.getOrElse(() => ".")
  );

const sanitizeDiagnosticLine = (line: string, fixtureDir: string): string =>
  pipe(line, normalizePathSeparators, Str.replaceAll(normalizePathSeparators(fixtureDir), "."));

const parseTsgoViolations = (
  result: SubprocessResult,
  fixtureDir: string,
  sourceFiles: ReadonlyArray<string>
): ReadonlyArray<AgentEffectivenessEvalViolation> =>
  pipe(
    result.output,
    Str.split("\n"),
    A.map(Str.trim),
    A.filter((line) => /\b(?:error|warning)\s+TS\d+\b/u.test(line)),
    A.map((line) => {
      const message = sanitizeDiagnosticLine(line, fixtureDir);
      return AgentEffectivenessEvalViolation.make({
        source: "tsgo",
        ruleId: diagnosticRuleId(line, "tsgo"),
        file: sourceFileForLine(sourceFiles, line),
        line: lineNumberFromDiagnostic(line),
        message,
      });
    }),
    sortViolations
  );

const evaluateTsgo = Effect.fn("AgentEffectivenessEvalScorer.evaluateTsgo")(function* (
  fixtureDir: string,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<AgentEffectivenessEvalViolation>,
  AgentEffectivenessEvalScorerError,
  Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const tsgoPath = path.join(repoRoot, "node_modules", ".bin", "tsgo");
  const result = yield* runSubprocess(tsgoPath, ["-p", "tsconfig.json", "--pretty", "false", "--noEmit"], fixtureDir);
  const violations = parseTsgoViolations(result, fixtureDir, sourceFiles);

  if (result.exitCode !== 0 && A.length(violations) === 0 && Str.isEmpty(result.output)) {
    return yield* AgentEffectivenessEvalScorerError.new("tsgo failed without diagnostic output.", {
      command: result.command,
      exitCode: result.exitCode,
    });
  }

  if (result.exitCode !== 0 && A.length(violations) === 0) {
    return [
      AgentEffectivenessEvalViolation.make({
        source: "tsgo",
        ruleId: "tsgo",
        file: ".",
        line: 1,
        message: sanitizeDiagnosticLine(result.output, fixtureDir),
      }),
    ];
  }

  return violations;
});

const stringProperty = (value: unknown, key: string): O.Option<string> =>
  pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => R.get(record, key)),
    O.filter(P.isString)
  );

const unknownProperty = (value: unknown, key: string): O.Option<unknown> =>
  pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => R.get(record, key))
  );

const biomeDiagnosticCategory = (diagnostic: unknown): string =>
  pipe(
    stringProperty(diagnostic, "category"),
    O.getOrElse(() => "biome")
  );

const biomeDiagnosticMessage = (diagnostic: unknown): string =>
  pipe(
    stringProperty(diagnostic, "description"),
    O.orElse(() => stringProperty(diagnostic, "message")),
    O.getOrElse(() => "Biome diagnostic.")
  );

const biomeDiagnosticFile = (diagnostic: unknown): string =>
  pipe(
    unknownProperty(diagnostic, "location"),
    O.flatMap((location) => unknownProperty(location, "path")),
    O.flatMap((pathValue) => stringProperty(pathValue, "file")),
    O.map(normalizeRelativePath),
    O.getOrElse(() => ".")
  );

const parseBiomeJsonViolations: (output: string) => O.Option<ReadonlyArray<AgentEffectivenessEvalViolation>> = flow(
  decodeUnknownJsonOption,
  O.flatMap((document) => unknownProperty(document, "diagnostics")),
  O.flatMap(decodeUnknownArrayOption),
  O.map(
    flow(
      A.map((diagnostic: unknown) =>
        AgentEffectivenessEvalViolation.make({
          source: "biome",
          ruleId: biomeDiagnosticCategory(diagnostic),
          file: biomeDiagnosticFile(diagnostic),
          line: 1,
          message: biomeDiagnosticMessage(diagnostic),
        })
      ),
      sortViolations
    )
  )
);

const parseBiomeViolations = (result: SubprocessResult): ReadonlyArray<AgentEffectivenessEvalViolation> =>
  pipe(
    parseBiomeJsonViolations(result.output),
    O.getOrElse(() =>
      result.exitCode === 0
        ? A.empty<AgentEffectivenessEvalViolation>()
        : [
            AgentEffectivenessEvalViolation.make({
              source: "biome",
              ruleId: "biome",
              file: ".",
              line: 1,
              message: Str.isEmpty(result.output) ? "Biome failed without reporter output." : result.output,
            }),
          ]
    )
  );

const evaluateBiome = Effect.fn("AgentEffectivenessEvalScorer.evaluateBiome")(function* (
  fixtureDir: string,
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<AgentEffectivenessEvalViolation>,
  AgentEffectivenessEvalScorerError,
  Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const biomePath = path.join(repoRoot, "node_modules", ".bin", "biome");
  const result = yield* runSubprocess(biomePath, ["check", ".", "--reporter=json"], fixtureDir);
  const violations = parseBiomeViolations(result);

  if (result.exitCode !== 0 && A.length(violations) === 0 && Str.isEmpty(result.output)) {
    return yield* AgentEffectivenessEvalScorerError.new("biome failed without reporter output.", {
      command: result.command,
      exitCode: result.exitCode,
    });
  }

  return violations;
});

const evaluateLaw = Effect.fn("AgentEffectivenessEvalScorer.evaluateLaw")(function* (
  fixtureDir: string,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<
  LawEvaluation,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const schemaFirst = yield* evaluateSchemaFirst(fixtureDir, repoRoot);
  const tsgo = yield* evaluateTsgo(fixtureDir, repoRoot, sourceFiles);
  const biome = yield* evaluateBiome(fixtureDir, repoRoot);
  return { schemaFirst, tsgo, biome };
});

/**
 * Build the final score report from completion and law evaluations.
 *
 * The contract formula is fixed as `score = completion_frac * law_frac`.
 * `law_frac` is the arithmetic mean of schema-first, tsgo, and biome
 * component scores, where each component is `1 / (1 + violations)`.
 *
 * @param task - Task manifest the fixture was scored against.
 * @param completion - Completion-check outcome for the fixture.
 * @param law - Law-component violation sets for the fixture.
 * @returns Deterministic score report with breakdown and sorted violations.
 * @category scoring
 * @since 0.0.0
 */
export const buildAgentEffectivenessEvalScoreReport = (
  task: SkillOptTaskManifest,
  completion: CompletionResult,
  law: LawEvaluation
): AgentEffectivenessEvalScoreReport => {
  const schemaFirst = lawComponentScore(A.length(law.schemaFirst));
  const tsgo = lawComponentScore(A.length(law.tsgo));
  const biome = lawComponentScore(A.length(law.biome));
  const lawFraction = aggregateLawFraction(schemaFirst, tsgo, biome);
  const violations = sortViolations([...completion.violations, ...law.schemaFirst, ...law.tsgo, ...law.biome]);
  return AgentEffectivenessEvalScoreReport.make({
    taskId: task.id,
    score: roundScore(completion.fraction * lawFraction),
    breakdown: AgentEffectivenessEvalScoreBreakdown.make({
      completion: completion.fraction,
      schemaFirst,
      tsgo,
      biome,
    }),
    violations,
  });
};

/**
 * Score one SkillOpt eval fixture directory.
 *
 * @category services
 * @since 0.0.0
 */
export const scoreAgentEffectivenessEval = Effect.fn("AgentEffectivenessEvalScorer.score")(function* ({
  dir,
  taskPath,
}: {
  readonly dir: string;
  readonly taskPath: string;
}): Effect.fn.Return<
  AgentEffectivenessEvalScoreReport,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const fixtureDir = path.resolve(dir);
  const manifestPath = path.resolve(taskPath);
  const fixtureStat = yield* fs.stat(fixtureDir).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Fixture directory is not readable: ${fixtureDir}.`, {
        file: fixtureDir,
      })
    )
  );
  if (fixtureStat.type !== "Directory") {
    return yield* AgentEffectivenessEvalScorerError.new(`Fixture path is not a directory: ${fixtureDir}.`, {
      file: fixtureDir,
    });
  }

  const taskText = yield* fs.readFileString(manifestPath).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not readable: ${manifestPath}.`, {
        file: manifestPath,
      })
    )
  );
  const task = yield* decodeTaskManifestJson(taskText).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not valid scorer input: ${manifestPath}.`, {
        file: manifestPath,
      })
    )
  );
  const snapshots = yield* readSourceSnapshots(fixtureDir);
  const sourceFiles = pipe(
    snapshots,
    A.map((snapshot) => snapshot.relativePath),
    A.sort(Order.String)
  );
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to locate repository root."))
  );
  const completion = yield* evaluateSkillOptCompletion(task, fixtureDir);
  const law = yield* evaluateLaw(fixtureDir, repoRoot, sourceFiles);
  return buildAgentEffectivenessEvalScoreReport(task, completion, law);
});

const recordNote = (report: AgentEffectivenessEvalScoreReport): string =>
  `skillopt scorer score=${report.score} completion=${report.breakdown.completion} schemaFirst=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`;

/**
 * Record a score report as an ai-metrics BenchmarkRun row.
 *
 * The task prompt body is never persisted; it is represented only by
 * `hashPublicTextSha256(task.prompt)` and the manifest path is retained as
 * `promptRef`.
 *
 * @category services
 * @since 0.0.0
 */
export const recordAgentEffectivenessEvalScore = Effect.fn("AgentEffectivenessEvalScorer.record")(function* ({
  dataRoot = DEFAULT_AGENT_EFFECTIVENESS_DATA_ROOT,
  report,
  task,
  taskPath,
}: {
  readonly dataRoot?: string;
  readonly report: AgentEffectivenessEvalScoreReport;
  readonly task: SkillOptTaskManifest;
  readonly taskPath: string;
}): Effect.fn.Return<
  AgentEffectivenessEvalRecordResult,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to locate repository root."))
  );
  const duckDbPath = path.resolve(repoRoot, dataRoot, "derived", "ai-metrics.duckdb");
  yield* fs.makeDirectory(path.dirname(duckDbPath), { recursive: true }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to prepare ai-metrics derived data root.", {
        file: path.dirname(duckDbPath),
      })
    )
  );
  const promptHash = yield* hashPublicTextSha256(task.prompt).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash SkillOpt task prompt."))
  );
  const configSnapshotPayload = yield* encodeJson({
    scorer: "agent-effectiveness-evals-score/v1",
    breakdown: report.breakdown,
  }).pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to encode scorer config snapshot.")));
  const configSnapshotDigest = yield* hashPublicTextSha256(configSnapshotPayload).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to hash scorer config snapshot."))
  );
  const recordedAtEpochMillis = yield* Clock.currentTimeMillis;

  const run = yield* Effect.scoped(
    Layer.build(DuckDb.makeNodeLayer(DuckDbConnectionOptions.make({ databasePath: duckDbPath }))).pipe(
      Effect.flatMap((context) =>
        pipe(
          upsertAiMetricsBenchmarkCase(
            AiMetricsBenchmarkCaseInput.make({
              benchmarkCaseId: task.id,
              expectedChecks: [
                "bun run beep lint schema-first",
                `tsgo -p ${task.fixture}/tsconfig.json --pretty false --noEmit`,
                `biome check ${task.fixture} --reporter=json`,
              ],
              promptHash,
              promptRef: normalizeRelativePath(taskPath),
              title: task.id,
            })
          ),
          Effect.flatMap(() =>
            recordAiMetricsBenchmarkRun(
              AiMetricsBenchmarkRunInput.make({
                benchmarkCaseId: task.id,
                configSnapshotId: `skillopt-scorer-${configSnapshotDigest}`,
                elapsedMs: 0,
                note: recordNote(report),
                passed: report.score >= 0.999,
                qualityGate:
                  report.score >= 0.999
                    ? AiMetricsQualityGateStatus.Enum.passed
                    : AiMetricsQualityGateStatus.Enum.failed,
                recordedAtEpochMillis,
              })
            )
          ),
          Effect.provide(context)
        )
      )
    )
  ).pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to record ai-metrics BenchmarkRun.")));

  return AgentEffectivenessEvalRecordResult.make({
    benchmarkRunId: run.benchmarkRunId,
    benchmarkCaseId: run.benchmarkCaseId,
  });
});

/**
 * Render one scorer report to stdout and optionally record it.
 *
 * @category command-adapters
 * @since 0.0.0
 */
export const runAgentEffectivenessEvalScoreCommand = Effect.fn("AgentEffectivenessEvalScorer.runCommand")(function* ({
  dataRoot = DEFAULT_AGENT_EFFECTIVENESS_DATA_ROOT,
  dir,
  json,
  record,
  taskPath,
}: {
  readonly dataRoot?: string;
  readonly dir: string;
  readonly json: boolean;
  readonly record: boolean;
  readonly taskPath: string;
}): Effect.fn.Return<
  void,
  AgentEffectivenessEvalScorerError | S.SchemaError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const taskText = yield* fs
    .readFileString(taskPath)
    .pipe(
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError(`Task manifest is not readable: ${taskPath}.`, { file: taskPath })
      )
    );
  const task = yield* decodeTaskManifestJson(taskText).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Task manifest is not valid scorer input: ${taskPath}.`, {
        file: taskPath,
      })
    )
  );
  const report = yield* scoreAgentEffectivenessEval({ dir, taskPath });

  if (json) {
    yield* Console.log(yield* encodeAgentEffectivenessEvalScoreReportJson(report));
  } else {
    yield* Console.log(
      `agent-effectiveness eval score: task=${report.taskId} score=${report.score} completion=${report.breakdown.completion} schema-first=${report.breakdown.schemaFirst} tsgo=${report.breakdown.tsgo} biome=${report.breakdown.biome}`
    );
  }

  if (record) {
    yield* recordAgentEffectivenessEvalScore({
      dataRoot,
      report,
      task,
      taskPath,
    });
  }
});
