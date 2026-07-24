/**
 * Fixture inspection for agent-effectiveness eval scoring.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, FileSystem, flow, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Project } from "ts-morph";
import { AgentEffectivenessEvalScorerError } from "../AgentEffectiveness.errors.ts";
import { AgentEffectivenessEvalViolation } from "../AgentEffectiveness.schemas.ts";
import { firstRuleId, roundScore, sortViolations } from "./EvalScoring.ts";
import type { SkillOptTaskManifest } from "../AgentEffectiveness.schemas.ts";
import type { CompletionResult } from "./EvalScoring.ts";

const $I = $RepoCliId.create("commands/AgentEffectiveness/internal/EvalFixture");

const normalizePathSeparators = Str.replaceAll("\\", "/");
const normalizeRelativePath: (value: string) => string = flow(normalizePathSeparators, Str.replace(/^\.\//, ""));

const SourceFileExtension = LiteralKit([".ts", ".tsx"]).pipe(
  $I.annoteSchema("AgentEffectivenessEvalSourceFileExtension", {
    description: "TypeScript source file extensions included in SkillOpt fixture source text.",
  })
);

class SourceFileSnapshot extends S.Class<SourceFileSnapshot>($I`SourceFileSnapshot`)(
  {
    absolutePath: S.String,
    relativePath: S.String,
    text: S.String,
  },
  $I.annote("SourceFileSnapshot", {
    description: "Snapshot of a source file.",
  })
) {}

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

/**
 * Read every source-file snapshot under a fixture directory, sorted by path.
 *
 * @example
 * ```ts
 * import { readSourceSnapshots } from "@beep/repo-cli/commands/AgentEffectiveness/internal/EvalFixture"
 *
 * const snapshots = readSourceSnapshots("/tmp/fixture")
 * ```
 * @category services
 * @since 0.0.0
 */
export const readSourceSnapshots = Effect.fn("AgentEffectivenessEvalScorer.readSourceSnapshots")(function* (
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
