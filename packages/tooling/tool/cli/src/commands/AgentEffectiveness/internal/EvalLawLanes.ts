/**
 * Law-lane subprocess evaluation for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { Effect, FileSystem, flow, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { formatCommandLine, runCapturedStreams } from "../../../internal/process/index.ts";
import { decodeSchemaFirstPolicyFindingLine } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import { AgentEffectivenessEvalLaneReport, AgentEffectivenessEvalViolation } from "../AgentEffectiveness.schemas.ts";
import { LawEvaluation, sortViolations } from "./EvalScoring.ts";
import type { Scope } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { SchemaFirstPolicyFinding } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import type { AgentEffectivenessEvalLawLane } from "../AgentEffectiveness.schemas.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalLawLanes");
const LAW_SANDBOX_FIXTURE_DIR = "packages/fixture";
const LAW_SANDBOX_FIXTURE_PREFIX = `${LAW_SANDBOX_FIXTURE_DIR}/`;
const TSGO_CONFIG_FILE = "tsconfig.scorer.json";
const BIOME_CONFIG_FILE = "biome.json";
const REPO_TSCONFIG_BASE_FILE = "tsconfig.base.json";
const REPO_BIOME_CONFIG_FILE = "biome.jsonc";
const ENVIRONMENT_EXCERPT_LENGTH = 2000;
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeJsonObjectOption = S.decodeUnknownOption(S.JsonObject);
const decodeJsonArrayOption = S.decodeUnknownOption(S.Array(S.Json));
const decodeRepoBiomeConfig = decodeJsoncTextAs(S.JsonObject);
const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));
const excerpt: (value: string) => string = Str.slice(0, ENVIRONMENT_EXCERPT_LENGTH);

class SubprocessResult extends S.Class<SubprocessResult>($I`SubprocessResult`)(
  {
    command: S.String,
    stdout: S.String,
    stderr: S.String,
    exitCode: S.Finite,
  },
  $I.annote("SubprocessResult", {
    description: "Result of a subprocess with stdout and stderr kept apart.",
  })
) {
  get output(): string {
    return pipe([this.stdout, this.stderr], A.filter(Str.isNonEmpty), A.join("\n"));
  }
}

class LawSandbox extends S.Class<LawSandbox>($I`LawSandbox`)(
  {
    root: S.String,
    fixtureRoot: S.String,
  },
  $I.annote("LawSandbox", {
    description: "Scorer-owned staging directory holding only a fixture's source files and the lane configuration.",
  })
) {}

class LawLaneOutcome extends S.Class<LawLaneOutcome>($I`LawLaneOutcome`)(
  {
    violations: S.Array(AgentEffectivenessEvalViolation),
    report: AgentEffectivenessEvalLaneReport,
  },
  $I.annote("LawLaneOutcome", {
    description: "Agent-attributable violations and run evidence from one law lane.",
  })
) {}

class BiomeJsonSummary extends S.Class<BiomeJsonSummary>($I`BiomeJsonSummary`)(
  {
    changed: S.Finite,
    unchanged: S.Finite,
  },
  $I.annote("BiomeJsonSummary", {
    description: "File counts from Biome's JSON reporter summary.",
  })
) {}

class BiomeJsonReport extends S.Class<BiomeJsonReport>($I`BiomeJsonReport`)(
  {
    summary: BiomeJsonSummary,
    diagnostics: S.Array(S.Unknown),
  },
  $I.annote("BiomeJsonReport", {
    description: "Subset of Biome's JSON reporter output the scorer reads.",
  })
) {}

const decodeBiomeJsonReportOption = S.decodeUnknownOption(S.fromJsonString(BiomeJsonReport));

const laneOutcome = (
  lane: AgentEffectivenessEvalLawLane,
  filesProcessed: number,
  violations: ReadonlyArray<AgentEffectivenessEvalViolation>,
  environmentDiagnostics: ReadonlyArray<string>
): LawLaneOutcome => {
  const diagnostics =
    filesProcessed === 0 ? A.append(environmentDiagnostics, `${lane} processed no files.`) : environmentDiagnostics;
  return LawLaneOutcome.make({
    violations: sortViolations(violations),
    report: AgentEffectivenessEvalLaneReport.make({
      lane,
      status: A.isReadonlyArrayNonEmpty(diagnostics) ? "environment-failure" : "measured",
      filesProcessed: NonNegativeInt.make(filesProcessed),
      environmentDiagnostics: diagnostics,
    }),
  });
};

const unrunnableLane = (lane: AgentEffectivenessEvalLawLane, reason: string): LawLaneOutcome =>
  laneOutcome(lane, 0, A.empty(), [reason]);

const runSubprocess = Effect.fn("AgentEffectivenessEvalScorer.runSubprocess")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<
  SubprocessResult,
  AgentEffectivenessEvalScorerError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const commandText = formatCommandLine(command, args);
  const result = yield* runCapturedStreams({
    command,
    args,
    cwd,
    extendEnv: true,
    trim: true,
  }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Failed to run subprocess: ${commandText}.`, {
        command: commandText,
      })
    )
  );
  return SubprocessResult.make({
    command: commandText,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  });
});

const runLaneSubprocess = (
  lane: AgentEffectivenessEvalLawLane,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  measure: (result: SubprocessResult) => LawLaneOutcome
): Effect.Effect<LawLaneOutcome, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
  runSubprocess(command, args, cwd).pipe(
    Effect.result,
    Effect.map(
      Result.match({
        onFailure: (error) => unrunnableLane(lane, `${lane} could not start: ${error.message}`),
        onSuccess: measure,
      })
    )
  );

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

const stageSourceFile = Effect.fn("AgentEffectivenessEvalScorer.stageSourceFile")(function* (
  from: string,
  to: string
): Effect.fn.Return<void, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(to), { recursive: true })
    .pipe(
      Effect.andThen(fs.copyFile(from, to)),
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError(`Failed to stage source file ${from}.`, { file: from })
      )
    );
});

const tsgoCompilerConfig = (repoRoot: string, sourceFiles: ReadonlyArray<string>) => ({
  extends: `${normalizePathSeparators(repoRoot)}/${REPO_TSCONFIG_BASE_FILE}`,
  compilerOptions: {
    noEmit: true,
    incremental: false,
    composite: false,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    skipLibCheck: true,
    rootDir: `./${LAW_SANDBOX_FIXTURE_DIR}`,
    target: "ES2025",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    lib: ["ESNext", "ESNext.Disposable"],
    types: ["node"],
  },
  files: A.map(sourceFiles, (file) => `${LAW_SANDBOX_FIXTURE_PREFIX}${file}`),
});

/**
 * Stage a fixture's source files in a scorer-owned sandbox.
 *
 * Only the `.ts`/`.tsx` source files are copied, so fixture-local tool
 * configuration (`tsconfig.json`, `biome.json`, `package.json`) never reaches a
 * lane. The sandbox links the repository's `node_modules` so package imports
 * resolve wherever the fixture copy lives, and carries the schema-first
 * wrapper `tsconfig.json` plus the scorer's own tsgo configuration.
 */
const prepareLawSandbox = Effect.fn("AgentEffectivenessEvalScorer.prepareLawSandbox")(function* (
  fixtureDir: string,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<LawSandbox, AgentEffectivenessEvalScorerError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs
    .makeTempDirectoryScoped({ prefix: "agent-effectiveness-law-" })
    .pipe(Effect.mapError(AgentEffectivenessEvalScorerError.mapError("Failed to create the law-lane sandbox.")));
  const fixtureRoot = path.join(root, LAW_SANDBOX_FIXTURE_DIR);
  yield* fs.makeDirectory(fixtureRoot, { recursive: true }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError("Failed to create the law-lane sandbox fixture directory.", {
        file: fixtureRoot,
      })
    )
  );
  yield* Effect.forEach(
    sourceFiles,
    (file) => stageSourceFile(path.join(fixtureDir, file), path.join(fixtureRoot, file)),
    { concurrency: 8, discard: true }
  );
  yield* fs
    .symlink(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"))
    .pipe(
      Effect.mapError(
        AgentEffectivenessEvalScorerError.mapError("Failed to link repository node_modules into the law-lane sandbox.")
      )
    );
  yield* writeJsonFile(path.join(root, "package.json"), {
    name: "@beep/agent-effectiveness-law-sandbox",
    private: true,
    type: "module",
  });
  yield* writeJsonFile(path.join(root, "tsconfig.json"), {
    compilerOptions: {},
    include: ["packages/**/*"],
  });
  yield* writeJsonFile(path.join(root, TSGO_CONFIG_FILE), tsgoCompilerConfig(repoRoot, sourceFiles));
  return LawSandbox.make({ root, fixtureRoot });
});

const fixtureRelativeFile = (file: string): string =>
  pipe(
    normalizeRelativePath(file),
    O.liftPredicate(Str.startsWith(LAW_SANDBOX_FIXTURE_PREFIX)),
    O.map(Str.slice(LAW_SANDBOX_FIXTURE_PREFIX.length)),
    O.getOrElse(() => normalizeRelativePath(file))
  );

const schemaFirstIssueToViolation = (issue: SchemaFirstPolicyFinding): AgentEffectivenessEvalViolation =>
  AgentEffectivenessEvalViolation.make({
    source: "schema-first",
    ruleId: issue.ruleId,
    file: fixtureRelativeFile(issue.file),
    line: issue.line ?? 1,
    message: issue.message,
  });

const parseSchemaFirstViolations: (output: string) => ReadonlyArray<AgentEffectivenessEvalViolation> = flow(
  Str.split("\n"),
  A.filter(Str.isNonEmpty),
  A.map(decodeSchemaFirstPolicyFindingLine),
  A.getSomes,
  A.map(schemaFirstIssueToViolation)
);

const measureSchemaFirst =
  (sourceFiles: ReadonlyArray<string>) =>
  (result: SubprocessResult): LawLaneOutcome => {
    const violations = parseSchemaFirstViolations(result.output);
    const unstructuredFailure = result.exitCode !== 0 && A.isReadonlyArrayEmpty(violations);
    return laneOutcome(
      "schema-first",
      A.length(sourceFiles),
      violations,
      unstructuredFailure
        ? [`schema-first lint exited ${result.exitCode} without structured findings: ${excerpt(result.output)}`]
        : A.empty()
    );
  };

const evaluateSchemaFirst = Effect.fn("AgentEffectivenessEvalScorer.evaluateSchemaFirst")(function* (
  sandbox: LawSandbox,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<LawLaneOutcome, never, Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const path = yield* Path.Path;
  const cliEntrypoint = path.join(repoRoot, "packages", "tooling", "tool", "cli", "src", "bin.ts");
  return yield* runLaneSubprocess(
    "schema-first",
    "bun",
    ["run", cliEntrypoint, "lint", "schema-first"],
    sandbox.root,
    measureSchemaFirst(sourceFiles)
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

const tsgoDiagnosticFile = (line: string): O.Option<string> =>
  pipe(
    /^(.+?)\(\d+,\d+\):/u.exec(line) ?? /^(.+?):\d+:\d+ - /u.exec(line),
    O.fromNullishOr,
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.map(normalizeRelativePath)
  );

const sanitizeDiagnosticLine = (line: string, sandbox: LawSandbox): string =>
  pipe(
    line,
    normalizePathSeparators,
    Str.replaceAll(normalizePathSeparators(sandbox.fixtureRoot), "."),
    Str.replaceAll(normalizePathSeparators(sandbox.root), "<sandbox>")
  );

const isTsgoDiagnosticLine = (line: string): boolean => /\b(?:error|warning)\s+TS\d+\b/u.test(line);

const measureTsgo =
  (sandbox: LawSandbox, sourceFiles: ReadonlyArray<string>) =>
  (result: SubprocessResult): LawLaneOutcome => {
    const diagnosticLines = pipe(result.output, Str.split("\n"), A.map(Str.trim), A.filter(isTsgoDiagnosticLine));
    const [environmentDiagnostics, violations] = A.partition(diagnosticLines, (line) =>
      pipe(
        tsgoDiagnosticFile(line),
        O.filter((file) => A.contains(sourceFiles, file)),
        O.match({
          onNone: () => Result.fail(sanitizeDiagnosticLine(line, sandbox)),
          onSome: (file) =>
            Result.succeed(
              AgentEffectivenessEvalViolation.make({
                source: "tsgo",
                ruleId: diagnosticRuleId(line, "tsgo"),
                file,
                line: lineNumberFromDiagnostic(line),
                message: sanitizeDiagnosticLine(line, sandbox),
              })
            ),
        })
      )
    );
    const silentFailure = result.exitCode !== 0 && A.isReadonlyArrayEmpty(diagnosticLines);
    return laneOutcome(
      "tsgo",
      A.length(sourceFiles),
      violations,
      silentFailure
        ? A.append(
            environmentDiagnostics,
            `tsgo exited ${result.exitCode} without diagnostics: ${excerpt(sanitizeDiagnosticLine(result.output, sandbox))}`
          )
        : environmentDiagnostics
    );
  };

const evaluateTsgo = Effect.fn("AgentEffectivenessEvalScorer.evaluateTsgo")(function* (
  sandbox: LawSandbox,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<LawLaneOutcome, never, Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const path = yield* Path.Path;
  const tsgoPath = path.join(repoRoot, "node_modules", ".bin", "tsgo");
  return yield* runLaneSubprocess(
    "tsgo",
    tsgoPath,
    ["-p", path.join(sandbox.root, TSGO_CONFIG_FILE), "--pretty", "false", "--noEmit"],
    sandbox.fixtureRoot,
    measureTsgo(sandbox, sourceFiles)
  );
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

const biomeDiagnosticFile = (diagnostic: unknown): O.Option<string> =>
  pipe(
    unknownProperty(diagnostic, "location"),
    O.flatMap((location) => unknownProperty(location, "path")),
    O.flatMap((pathValue) =>
      pipe(
        stringProperty(pathValue, "file"),
        O.orElse(() => O.liftPredicate(pathValue, P.isString))
      )
    ),
    O.map(fixtureRelativeFile)
  );

const biomeDiagnosticOutcome =
  (sourceFiles: ReadonlyArray<string>) =>
  (diagnostic: unknown): Result.Result<AgentEffectivenessEvalViolation, string> =>
    pipe(
      biomeDiagnosticFile(diagnostic),
      O.filter((file) => A.contains(sourceFiles, file)),
      O.match({
        onNone: () => Result.fail(`${biomeDiagnosticCategory(diagnostic)}: ${biomeDiagnosticMessage(diagnostic)}`),
        onSome: (file) =>
          Result.succeed(
            AgentEffectivenessEvalViolation.make({
              source: "biome",
              ruleId: biomeDiagnosticCategory(diagnostic),
              file,
              line: 1,
              message: biomeDiagnosticMessage(diagnostic),
            })
          ),
      })
    );

const measureBiome =
  (sourceFiles: ReadonlyArray<string>) =>
  (result: SubprocessResult): LawLaneOutcome =>
    O.match(decodeBiomeJsonReportOption(result.stdout), {
      onNone: () =>
        unrunnableLane("biome", `Biome exited ${result.exitCode} without a JSON report: ${excerpt(result.output)}`),
      onSome: (report) => {
        const [environmentDiagnostics, violations] = A.partition(
          report.diagnostics,
          biomeDiagnosticOutcome(sourceFiles)
        );
        const filesProcessed = report.summary.changed + report.summary.unchanged;
        return laneOutcome(
          "biome",
          filesProcessed,
          violations,
          filesProcessed === 0 && Str.isNonEmpty(result.stderr)
            ? A.append(environmentDiagnostics, excerpt(result.stderr))
            : environmentDiagnostics
        );
      },
    });

const withAbsolutePlugins =
  (resolvePlugin: (plugin: string) => string) =>
  (config: S.JsonObject): S.JsonObject =>
    pipe(
      unknownProperty(config, "plugins"),
      O.flatMap(decodeJsonArrayOption),
      O.match({
        onNone: () => config,
        onSome: (plugins) => ({
          ...config,
          plugins: A.map(plugins, (plugin) => (P.isString(plugin) ? resolvePlugin(plugin) : plugin)),
        }),
      })
    );

const withAbsoluteOverridePlugins =
  (resolvePlugin: (plugin: string) => string) =>
  (config: S.JsonObject): S.JsonObject =>
    pipe(
      unknownProperty(config, "overrides"),
      O.flatMap(decodeJsonArrayOption),
      O.map(
        A.map((override) =>
          pipe(
            decodeJsonObjectOption(override),
            O.map(withAbsolutePlugins(resolvePlugin)),
            O.getOrElse(() => override)
          )
        )
      ),
      O.match({
        onNone: () => config,
        onSome: (overrides) => ({ ...config, overrides }),
      })
    );

/**
 * Derive the sandbox Biome configuration from the repository's.
 *
 * The repository rules, formatter, and assists carry over unchanged. Plugin
 * paths become absolute (Biome resolves them against the config directory),
 * VCS integration is off (the sandbox is not a checkout), and `files.includes`
 * names only the staged fixture directory.
 *
 * @param repoConfig - Parsed repository Biome configuration.
 * @param resolvePlugin - Resolves a repository-relative plugin path to an absolute path.
 * @returns Biome configuration for the law-lane sandbox.
 */
const sandboxBiomeConfig = (repoConfig: S.JsonObject, resolvePlugin: (plugin: string) => string): S.JsonObject => ({
  ...pipe(repoConfig, withAbsolutePlugins(resolvePlugin), withAbsoluteOverridePlugins(resolvePlugin)),
  root: true,
  vcs: { enabled: false },
  files: { includes: [`${LAW_SANDBOX_FIXTURE_PREFIX}**`] },
});

const writeSandboxBiomeConfig = Effect.fn("AgentEffectivenessEvalScorer.writeSandboxBiomeConfig")(function* (
  sandbox: LawSandbox,
  repoRoot: string
): Effect.fn.Return<Result.Result<string, string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoConfigPath = path.join(repoRoot, REPO_BIOME_CONFIG_FILE);
  const configPath = path.join(sandbox.root, BIOME_CONFIG_FILE);
  return yield* fs.readFileString(repoConfigPath).pipe(
    Effect.mapError(AgentEffectivenessEvalScorerError.mapError(`Failed to read ${repoConfigPath}.`)),
    Effect.flatMap((text) =>
      decodeRepoBiomeConfig(text).pipe(
        Effect.mapError(AgentEffectivenessEvalScorerError.mapError(`Failed to parse ${repoConfigPath}.`))
      )
    ),
    Effect.map((repoConfig) => sandboxBiomeConfig(repoConfig, (plugin) => path.resolve(repoRoot, plugin))),
    Effect.flatMap((config) => writeJsonFile(configPath, config)),
    Effect.as(configPath),
    Effect.result,
    Effect.map(Result.mapError((error) => `Biome configuration unusable: ${error.message}`))
  );
});

const evaluateBiome = Effect.fn("AgentEffectivenessEvalScorer.evaluateBiome")(function* (
  sandbox: LawSandbox,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<
  LawLaneOutcome,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const biomePath = path.join(repoRoot, "node_modules", ".bin", "biome");
  const configPath = yield* writeSandboxBiomeConfig(sandbox, repoRoot);
  return yield* Result.match(configPath, {
    onFailure: (reason) => Effect.succeed(unrunnableLane("biome", reason)),
    onSuccess: (config) =>
      runLaneSubprocess(
        "biome",
        biomePath,
        ["check", LAW_SANDBOX_FIXTURE_DIR, "--reporter=json", `--config-path=${config}`],
        sandbox.root,
        measureBiome(sourceFiles)
      ),
  });
});

/**
 * Run the schema-first, tsgo, and biome law lanes over a fixture's source
 * files and collect their violations and run evidence.
 *
 * **Details**
 *
 * The lanes never read the fixture directory itself. The scorer stages only
 * the listed source files into a scoped sandbox that links the repository's
 * `node_modules`, then runs every lane under configuration it owns: tsgo under
 * a generated config extending the repository `tsconfig.base.json` with
 * explicit libs, node types, and NodeNext resolution; Biome under the
 * repository rules with plugin paths made absolute and the file set pinned to
 * the staged sources. Fixture-local `tsconfig.json` or Biome configuration
 * therefore cannot change a lane result, and a fixture copied anywhere scores
 * the same.
 *
 * A diagnostic located in a staged source file is a law violation. Anything
 * else (a tool that did not start, a config that did not load, zero files
 * processed, a diagnostic outside the staged sources) is recorded as an
 * environment failure in that lane's report instead.
 *
 * Schema-first and Biome run concurrently, followed by tsgo.
 *
 * **Example** (Evaluate fixture law lanes)
 *
 * ```ts
 * import { evaluateLaw } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalLawLanes"
 *
 * const evaluation = evaluateLaw("/tmp/fixture", "/repo", ["src/a.ts"])
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const evaluateLaw = Effect.fn("AgentEffectivenessEvalScorer.evaluateLaw")(function* (
  fixtureDir: string,
  repoRoot: string,
  sourceFiles: ReadonlyArray<string>
): Effect.fn.Return<
  LawEvaluation,
  AgentEffectivenessEvalScorerError,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const sandbox = yield* prepareLawSandbox(fixtureDir, repoRoot, sourceFiles);
      const readOnlyLanes = yield* Effect.all(
        {
          schemaFirst: evaluateSchemaFirst(sandbox, repoRoot, sourceFiles),
          biome: evaluateBiome(sandbox, repoRoot, sourceFiles),
        },
        { concurrency: 2 }
      );
      const tsgo = yield* evaluateTsgo(sandbox, repoRoot, sourceFiles);
      return LawEvaluation.make({
        schemaFirst: readOnlyLanes.schemaFirst.violations,
        tsgo: tsgo.violations,
        biome: readOnlyLanes.biome.violations,
        lanes: [readOnlyLanes.schemaFirst.report, tsgo.report, readOnlyLanes.biome.report],
      });
    })
  );
});
