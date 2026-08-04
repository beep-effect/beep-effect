/**
 * Shared subprocess execution helpers for repository run plans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError } from "@beep/repo-utils";
import { Console, DateTime, Duration, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { repoRunOutputBound, runCaptured } from "../process/StepExec.ts";
import { commandTextForStep, RepoStepRunResult } from "./RepoRun.models.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoPlanStep } from "./RepoRun.models.ts";

type RepoCommandOutput = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
};

const runRepoCommand = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: Record<string, string | undefined> | undefined,
  tee: boolean
): Effect.Effect<RepoCommandOutput, DomainError, ChildProcessSpawner.ChildProcessSpawner> => {
  const commandText = A.join([command, ...args], " ");
  return runCaptured({
    command,
    args,
    cwd,
    env,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
    ...(tee ? { tee: true } : {}),
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn ${commandText}.`)));
};

const makeRepoCommandCapture = (identifier: string, tee: boolean) =>
  Effect.fn(identifier)(function* (
    command: string,
    args: ReadonlyArray<string>,
    cwd: string,
    env: Record<string, string | undefined> | undefined = undefined
  ): Effect.fn.Return<RepoCommandOutput, DomainError, ChildProcessSpawner.ChildProcessSpawner> {
    return yield* runRepoCommand(command, args, cwd, env, tee);
  });

/**
 * Execute a command and capture combined output.
 *
 * Non-zero exit codes are represented in the returned value. Spawn failures
 * remain typed operational errors.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Optional environment overrides.
 * @returns Captured output and exit code.
 * @example
 * ```ts
 * import { runRepoCommandCapture } from "@beep/repo-cli/internal/repo-run"
 *
 * const capture = runRepoCommandCapture("git", ["status", "--short"], process.cwd())
 * console.log(capture)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runRepoCommandCapture = makeRepoCommandCapture("RepoRun.runRepoCommandCapture", false);

/**
 * Execute a command, stream combined output live, and retain bounded output.
 *
 * Non-zero exit codes are represented in the returned value. Spawn failures
 * remain typed operational errors.
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Optional environment overrides.
 * @returns Captured output and exit code.
 * @example
 * ```ts
 * import { runRepoCommandStreamingCapture } from "@beep/repo-cli/internal/repo-run"
 *
 * const capture = runRepoCommandStreamingCapture("bun", ["--version"], process.cwd())
 * console.log(capture)
 * ```
 * @category execution
 * @since 0.0.0
 */
export const runRepoCommandStreamingCapture = makeRepoCommandCapture("RepoRun.runRepoCommandStreamingCapture", true);

const writeRawOutput = Effect.fn("RepoRun.writeRawOutput")(function* (
  filePath: string,
  output: string
): Effect.fn.Return<void, DomainError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(path.dirname(filePath), { recursive: true })
    .pipe(Effect.mapError(DomainError.newCause(`Failed to create output directory for "${filePath}".`)));
  yield* fs
    .writeFileString(filePath, output)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write raw output "${filePath}".`)));
});

/**
 * Execute a planned repository step and optionally persist its raw output.
 *
 * @param step - Planned step to execute.
 * @param rawOutputPath - Optional path for captured command output.
 * @returns Captured step result.
 * @example
 * ```ts
 * import { executeRepoPlanStep, RepoPlanStep } from "@beep/repo-cli/internal/repo-run"
 *
 * const step = RepoPlanStep.make({
 *   args: ["status", "--short"],
 *   command: "git",
 *   cwd: process.cwd(),
 *   id: "git-status",
 *   label: "git status",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "never",
 *   scope: "git"
 * })
 * console.log(executeRepoPlanStep(step))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const executeRepoPlanStep = Effect.fn("RepoRun.executeRepoPlanStep")(function* (
  step: RepoPlanStep,
  rawOutputPath: O.Option<string> = O.none()
): Effect.fn.Return<
  RepoStepRunResult,
  DomainError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const commandText = commandTextForStep(step);
  yield* Console.log(`[repo-run] ${step.label}: ${commandText}`);
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const [elapsed, result] = yield* runRepoCommandCapture(step.command, step.args, step.cwd, step.env).pipe(
    Effect.timed
  );
  const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  if (O.isSome(rawOutputPath)) {
    yield* writeRawOutput(rawOutputPath.value, result.output);
  }

  return RepoStepRunResult.make({
    stepId: step.id,
    commandText,
    exitCode: result.exitCode,
    startedAt,
    endedAt,
    elapsedMs: Duration.toMillis(elapsed),
    output: result.output,
    truncated: result.truncated,
    ...(O.isSome(rawOutputPath) ? { rawOutputRef: rawOutputPath.value } : {}),
  });
});

/**
 * Execute a planned repository step, stream output live, and optionally persist
 * its raw output.
 *
 * @param step - Planned step to execute.
 * @param rawOutputPath - Optional path for captured command output.
 * @returns Captured step result.
 * @example
 * ```ts
 * import { executeRepoPlanStepStreaming, RepoPlanStep } from "@beep/repo-cli/internal/repo-run"
 *
 * const step = RepoPlanStep.make({
 *   args: ["--version"],
 *   command: "bun",
 *   cwd: process.cwd(),
 *   id: "bun-version",
 *   label: "bun version",
 *   mutability: "readonly",
 *   phase: "feedback",
 *   resume: "never",
 *   scope: "repo"
 * })
 * console.log(executeRepoPlanStepStreaming(step))
 * ```
 * @category execution
 * @since 0.0.0
 */
export const executeRepoPlanStepStreaming = Effect.fn("RepoRun.executeRepoPlanStepStreaming")(function* (
  step: RepoPlanStep,
  rawOutputPath: O.Option<string> = O.none()
): Effect.fn.Return<
  RepoStepRunResult,
  DomainError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const commandText = commandTextForStep(step);
  yield* Console.log(`[repo-run] ${step.label}: ${commandText}`);
  const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const [elapsed, result] = yield* runRepoCommandStreamingCapture(step.command, step.args, step.cwd, step.env).pipe(
    Effect.timed
  );
  const endedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  if (O.isSome(rawOutputPath)) {
    yield* writeRawOutput(rawOutputPath.value, result.output);
  }

  return RepoStepRunResult.make({
    stepId: step.id,
    commandText,
    exitCode: result.exitCode,
    startedAt,
    endedAt,
    elapsedMs: Duration.toMillis(elapsed),
    output: result.output,
    truncated: result.truncated,
    ...(O.isSome(rawOutputPath) ? { rawOutputRef: rawOutputPath.value } : {}),
  });
});

/**
 * Resolve a local node_modules binary when present.
 *
 * @param repoRoot - Repository root.
 * @param binary - Binary name.
 * @returns Absolute binary path when installed, otherwise the binary name.
 * @example
 * ```ts
 * import { resolveLocalRepoBinary } from "@beep/repo-cli/internal/repo-run"
 *
 * const turbo = resolveLocalRepoBinary(process.cwd(), "turbo")
 * console.log(turbo)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const resolveLocalRepoBinary = Effect.fn("RepoRun.resolveLocalRepoBinary")(function* (
  repoRoot: string,
  binary: string
): Effect.fn.Return<string, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidate = path.join(repoRoot, "node_modules", ".bin", binary);
  const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(() => false));
  return exists ? candidate : binary;
});
