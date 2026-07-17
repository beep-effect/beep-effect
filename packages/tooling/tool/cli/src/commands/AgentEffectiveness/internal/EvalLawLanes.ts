/**
 * Law-lane subprocess evaluation for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, FileSystem, flow, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { formatCommandLine, runCaptured } from "../../../internal/process/index.ts";
import { decodeSchemaFirstPolicyFindingLine } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import { AgentEffectivenessEvalViolation } from "../AgentEffectiveness.schemas.ts";
import { sortViolations } from "./EvalScoring.ts";
import type { Scope } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { SchemaFirstPolicyFinding } from "../../../internal/quality/SchemaFirstPolicyFinding.ts";
import type { LawEvaluation } from "./EvalScoring.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalLawLanes");
const SCHEMA_FIRST_FIXTURE_PACKAGE_PREFIX = "packages/fixture/";
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const decodeUnknownJsonOption = S.decodeUnknownOption(S.UnknownFromJsonString);
const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));
const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));

class SubprocessResult extends S.Class<SubprocessResult>($I`SubprocessResult`)(
  {
    command: S.String,
    output: S.String,
    exitCode: S.Finite,
  },
  $I.annote("SubprocessResult", {
    description: "Result of a subprocess.",
  })
) {}

const runSubprocess = Effect.fn("AgentEffectivenessEvalScorer.runSubprocess")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<SubprocessResult, AgentEffectivenessEvalScorerError, ChildProcessSpawner.ChildProcessSpawner> {
  const commandText = formatCommandLine(command, args);
  const result = yield* runCaptured({
    command,
    args,
    cwd,
    extendEnv: true,
    source: "all",
    trim: true,
  }).pipe(
    Effect.mapError(
      AgentEffectivenessEvalScorerError.mapError(`Failed to run subprocess: ${commandText}.`, {
        command: commandText,
      })
    )
  );
  return SubprocessResult.make({ command: commandText, output: result.output, exitCode: result.exitCode });
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

const schemaFirstIssueToViolation = (issue: SchemaFirstPolicyFinding): AgentEffectivenessEvalViolation =>
  AgentEffectivenessEvalViolation.make({
    source: "schema-first",
    ruleId: issue.ruleId,
    file: schemaFirstFixtureFile(issue.file),
    line: issue.line ?? 1,
    message: issue.message,
  });

const parseSchemaFirstViolations: (output: string) => ReadonlyArray<AgentEffectivenessEvalViolation> = flow(
  Str.split("\n"),
  A.filter(Str.isNonEmpty),
  A.map(decodeSchemaFirstPolicyFindingLine),
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

/**
 * Run the schema-first, tsgo, and biome law lanes over a fixture's source
 * files and collect their violations.
 *
 * @example
 * ```ts
 * import { evaluateLaw } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalLawLanes"
 *
 * const evaluation = evaluateLaw("/tmp/fixture", "/repo", ["src/a.ts"])
 * ```
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
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const schemaFirst = yield* evaluateSchemaFirst(fixtureDir, repoRoot);
  const tsgo = yield* evaluateTsgo(fixtureDir, repoRoot, sourceFiles);
  const biome = yield* evaluateBiome(fixtureDir, repoRoot);
  return { schemaFirst, tsgo, biome };
});
