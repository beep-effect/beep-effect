/**
 * Yeet artifact writers and step-result packet helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Console, Effect, FileSystem, Path, pipe, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { encodeCommandJson } from "../../../internal/cli/Json.js";
import { executeRepoPlanStepStreaming } from "../../../internal/repo-run/index.js";
import { YeetCommandError } from "../Yeet.errors.js";
import { renderPackageQualityPacketMarkdown } from "../Yeet.render.js";
import { YeetRunResult } from "../Yeet.schemas.js";
import { artifactDirForContext, safeArtifactName } from "./ArtifactPaths.js";
import { buildQualityIssueIndex, qualityIssuesFromStepResult } from "./QualityIssueIndex.js";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep, RepoRunContext, RepoStepRunResult } from "../../../internal/repo-run/index.js";
import type { PackageQualityReport, QualityIssue, QualityIssueIndex } from "../Yeet.schemas.js";

const commandFailure = (result: RepoStepRunResult, message: string): YeetCommandError =>
  YeetCommandError.make({
    message,
    command: result.commandText,
    exitCode: result.exitCode === 0 ? 1 : result.exitCode,
  });

/**
 * Encode a Yeet payload as formatted JSON for CLI output or artifact files.
 *
 * @param value - JSON-serializable payload to encode with command output
 * formatting.
 * @returns An Effect that yields encoded JSON text or a Yeet command error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { renderJson } from "@beep/repo-cli/test/Yeet"
 *
 * const encodedLength = renderJson({ schemaVersion: "yeet-quality-issue-index/v1" }).pipe(
 *   Effect.map((json) => json.length)
 * )
 * ```
 * @category serialization
 * @since 0.0.0
 */
export const renderJson = Effect.fn("Yeet.renderJson")(function* (
  value: unknown
): Effect.fn.Return<string, YeetCommandError> {
  return yield* encodeCommandJson(value).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode yeet JSON output."))
  );
});

/**
 * Build the log artifact path for a planned Yeet step.
 *
 * @param context - Repo context that determines the Yeet artifact directory.
 * @param step - Planned step whose id becomes the log file name.
 * @returns An Effect yielding the safe step log path under the run artifact
 * tree.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { rawOutputPathForStep, RepoPlanStep, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: ".",
 *   id: "full:check",
 *   label: "full check",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "fingerprint-match",
 *   scope: "repo"
 * })
 *
 * const logFile = rawOutputPathForStep(context, step).pipe(Effect.map((path) => path.endsWith(".log")))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const rawOutputPathForStep = Effect.fn("Yeet.rawOutputPathForStep")(function* (
  context: RepoRunContext,
  step: RepoPlanStep
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "logs", `${safeArtifactName(step.id)}.log`);
});

/**
 * Execute a planned repo step while streaming output into its Yeet log artifact.
 *
 * @param context - Repo context used to choose the run artifact directory.
 * @param step - Planned command to execute and capture.
 * @returns The captured step result with output metadata attached by the
 * repo-run executor.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { executeStepWithArtifacts, RepoPlanStep, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: ".",
 *   id: "full:check",
 *   label: "full check",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "fingerprint-match",
 *   scope: "repo"
 * })
 *
 * const exitCode = executeStepWithArtifacts(context, step).pipe(Effect.map((result) => result.exitCode))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const executeStepWithArtifacts = Effect.fn("Yeet.executeStepWithArtifacts")(function* (
  context: RepoRunContext,
  step: RepoPlanStep
): Effect.fn.Return<
  RepoStepRunResult,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const rawOutputPath = yield* rawOutputPathForStep(context, step);
  return yield* executeRepoPlanStepStreaming(step, O.some(rawOutputPath)).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to execute ${step.label}.`))
  );
});

/**
 * Write text to a Yeet artifact path, creating parent directories first.
 *
 * @param filePath - Absolute or repo-relative file path to write.
 * @param content - Complete file contents, including any desired trailing
 * newline.
 * @returns An Effect that completes after the file is written.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { writeTextFile } from "@beep/repo-cli/test/Yeet"
 *
 * const writePacket = writeTextFile(".beep/yeet/runs/example/summary.txt", "ok\n").pipe(
 *   Effect.as("packet written")
 * )
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const writeTextFile = Effect.fn("Yeet.writeTextFile")(function* (
  filePath: string,
  content: string
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(filePath), { recursive: true })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create directory for "${filePath}".`)));
  yield* fs
    .writeFileString(filePath, content)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to write "${filePath}".`)));
});

/**
 * Persist a quality issue index and package markdown packets for a Yeet run.
 *
 * @param context - Repo context that determines the artifact directory.
 * @param index - Normalized issue index to serialize and render into packets.
 * @returns Yeet run result pointing at the written issue index and packet
 * paths.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { QualityIssueIndex, RepoRunContext, writeIssueArtifacts } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const index = QualityIssueIndex.make({
 *   issues: [],
 *   packages: [],
 *   rawOutputRefs: [],
 *   schemaVersion: "yeet-quality-issue-index/v1"
 * })
 *
 * const packetCount = writeIssueArtifacts(context, index).pipe(Effect.map((result) => result.packetPaths.length))
 * ```
 * @category diagnostics
 * @since 0.0.0
 */
export const writeIssueArtifacts = Effect.fn("Yeet.writeIssueArtifacts")(function* (
  context: RepoRunContext,
  index: QualityIssueIndex
): Effect.fn.Return<YeetRunResult, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  const indexPath = path.join(artifactDir, "quality-issue-index.json");
  yield* writeTextFile(indexPath, `${yield* renderJson(index)}\n`);

  const writePackagePacket = Effect.fnUntraced(function* (
    report: PackageQualityReport
  ): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem | Path.Path> {
    const markdown = yield* pipe(
      renderPackageQualityPacketMarkdown(report),
      Result.match({
        onFailure: (error) => Effect.fail(YeetCommandError.make({ message: error.message })),
        onSuccess: Effect.succeed,
      })
    );
    const packetPath = path.join(artifactDir, "packets", `${safeArtifactName(report.packageName)}.md`);
    yield* writeTextFile(packetPath, markdown);
    return packetPath;
  });

  const packetPaths = yield* Effect.forEach(index.packages, writePackagePacket);

  return YeetRunResult.make({
    artifactDir,
    committed: false,
    pushed: false,
    packetPaths,
    indexPath,
  });
});

const issuesFromResults = (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  results: ReadonlyArray<RepoStepRunResult>
): ReadonlyArray<QualityIssue> =>
  pipe(
    results,
    A.flatMap((result) =>
      pipe(
        A.findFirst(steps, (step) => step.id === result.stepId),
        O.map((step) => qualityIssuesFromStepResult(context, step, result)),
        O.getOrElse(A.empty<QualityIssue>)
      )
    )
  );

/**
 * Build the successful publish result for a Yeet run.
 *
 * @param context - Repo context whose artifact directory is reported.
 * @param committed - Whether publish created or amended a local commit before
 * pushing.
 * @returns A Yeet run result marked as pushed with no failure packet paths.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { publishResult, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const pushed = publishResult(context, true).pipe(Effect.map((result) => result.pushed))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const publishResult = Effect.fn("Yeet.publishResult")(function* (
  context: RepoRunContext,
  committed: boolean
): Effect.fn.Return<YeetRunResult, never, Path.Path> {
  const artifactDir = yield* artifactDirForContext(context);
  return YeetRunResult.make({
    artifactDir,
    committed,
    pushed: true,
    packetPaths: [],
  });
});

/**
 * Build the commit-message artifact path for a Yeet run.
 *
 * @param context - Repo context whose run artifact directory owns the commit
 * message file.
 * @returns An Effect yielding the path used for commitlint's `--edit` input.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { commitMessagePathForContext, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const messagePath = commitMessagePathForContext(context).pipe(Effect.map((path) => path.endsWith(".txt")))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const commitMessagePathForContext = Effect.fn("Yeet.commitMessagePathForContext")(function* (
  context: RepoRunContext
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  const artifactDir = yield* artifactDirForContext(context);
  return path.join(artifactDir, "commit-message.txt");
});

/**
 * Build an empty plan-mode result without writing quality packets.
 *
 * @param context - Repo context whose artifact directory is reported.
 * @returns A non-committed, non-pushed Yeet result with no packet paths.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { emptyPlanResult, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 *
 * const planned = emptyPlanResult(context).pipe(Effect.map((result) => result.committed === false))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const emptyPlanResult = Effect.fn("Yeet.emptyPlanResult")(function* (
  context: RepoRunContext
): Effect.fn.Return<YeetRunResult, never, Path.Path> {
  const artifactDir = yield* artifactDirForContext(context);
  return YeetRunResult.make({
    artifactDir,
    committed: false,
    pushed: false,
    packetPaths: [],
  });
});

/**
 * Write failure packets for failed steps, print their paths, and fail the Yeet
 * command.
 *
 * @param context - Repo context that determines artifact paths and issue
 * metadata.
 * @param steps - Planned steps used to classify each step result.
 * @param results - Executed results to normalize into quality issues.
 * @param message - User-facing failure summary printed before packet paths.
 * @returns A failing Effect carrying the first command failure or a synthetic
 * Yeet command error.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { failWithIssueArtifacts, RepoPlanStep, RepoRunContext, RepoStepRunResult } from "@beep/repo-cli/test/Yeet"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/closeout",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const step = RepoPlanStep.make({
 *   args: ["run", "check"],
 *   command: "bun",
 *   cwd: ".",
 *   id: "full:check",
 *   label: "full check",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "fingerprint-match",
 *   scope: "repo"
 * })
 * const result = RepoStepRunResult.make({ commandText: "bun run check", exitCode: 1, stepId: step.id })
 *
 * const failure = failWithIssueArtifacts(context, [step], [result], "Yeet proof failed").pipe(Effect.either)
 * ```
 * @category error-handling
 * @since 0.0.0
 */
export const failWithIssueArtifacts = Effect.fn("Yeet.failWithIssueArtifacts")(function* (
  context: RepoRunContext,
  steps: ReadonlyArray<RepoPlanStep>,
  results: ReadonlyArray<RepoStepRunResult>,
  message: string
): Effect.fn.Return<never, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const index = buildQualityIssueIndex(issuesFromResults(context, steps, results));
  const artifacts = yield* writeIssueArtifacts(context, index);
  yield* Console.error(`${message}\nYeet quality packets written to ${artifacts.artifactDir}`);
  for (const packetPath of artifacts.packetPaths) {
    yield* Console.error(`  - ${packetPath}`);
  }
  const firstFailure = A.findFirst(results, (result) => result.exitCode !== 0);
  return yield* pipe(
    firstFailure,
    O.map((result) => commandFailure(result, message)),
    O.getOrElse(() => YeetCommandError.make({ message }))
  );
});
