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
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { CaptureSource } from "../process/StepExec.ts";
import type { RepoPlanStep } from "./RepoRun.models.ts";

type RepoCommandOutput = {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
};

// How a capture reads a child's streams. The default fuses stderr into stdout
// and trims the whole buffer, which suits a human-facing command log; a reader
// parsing a machine format needs neither.
type RepoCommandCaptureShape = {
  readonly source: CaptureSource;
  readonly trim: boolean;
};

const mergedTrimmedCapture: RepoCommandCaptureShape = { source: "merge", trim: true };

const runRepoCommand = (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  env: Record<string, string | undefined> | undefined,
  tee: boolean,
  shape: RepoCommandCaptureShape
): Effect.Effect<RepoCommandOutput, DomainError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandText = A.join([command, ...args], " ");
  return runCaptured({
    command,
    args,
    cwd,
    env,
    extendEnv: true,
    stdin: "inherit",
    source: shape.source,
    bound: repoRunOutputBound,
    trim: shape.trim,
    ...(tee ? { tee: true } : {}),
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn ${commandText}.`)));
};

const makeRepoCommandCapture = (
  identifier: string,
  tee: boolean,
  shape: RepoCommandCaptureShape = mergedTrimmedCapture
) =>
  Effect.fn(identifier)(function* (
    command: string,
    args: ReadonlyArray<string>,
    cwd: string,
    env: Record<string, string | undefined> | undefined = undefined
  ): Effect.fn.Return<RepoCommandOutput, DomainError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
    return yield* runRepoCommand(command, args, cwd, env, tee, shape);
  });

/**
 * Execute a command and capture combined output.
 *
 * Non-zero exit codes are represented in the returned value. Spawn failures
 * remain typed operational errors.
 *
 * **Example** (Run a repo command capture)
 *
 * ```ts
 * import { runRepoCommandCapture } from "@beep/repo-cli/internal/repo-run"
 *
 * const capture = runRepoCommandCapture("git", ["status", "--short"], process.cwd())
 * console.log(capture)
 * ```
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Optional environment overrides.
 * @returns Captured output and exit code.
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
 * **Example** (Run a repo command streaming capture)
 *
 * ```ts
 * import { runRepoCommandStreamingCapture } from "@beep/repo-cli/internal/repo-run"
 *
 * const capture = runRepoCommandStreamingCapture("bun", ["--version"], process.cwd())
 * console.log(capture)
 * ```
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Optional environment overrides.
 * @returns Captured output and exit code.
 * @category execution
 * @since 0.0.0
 */
export const runRepoCommandStreamingCapture = makeRepoCommandCapture("RepoRun.runRepoCommandStreamingCapture", true);

/**
 * Execute a command and capture its stdout byte for byte.
 *
 * Non-zero exit codes are represented in the returned value. Spawn failures
 * remain typed operational errors.
 *
 * **Details**
 *
 * The counterpart of {@link runRepoCommandCapture} for a reader that parses a
 * machine format rather than showing output to a person. Two differences carry
 * the whole point:
 *
 * `trim` is off. The default capture runs `String.trim` over the entire buffer,
 * and a NUL is not whitespace, so a `-z` record set beginning with a space —
 * which is exactly how `git status --porcelain=v1 -z` spells an unstaged-only
 * change, ` M path` — loses that space and the record stops parsing as a status
 * entry at all.
 *
 * `source` is stdout alone. The default merges stderr in, and a stderr fragment
 * carries no NUL, so under `-z` it fuses with whatever record is adjacent and
 * silently corrupts one path.
 *
 * **Example** (Read a NUL-separated status)
 *
 * ```ts
 * import { runRepoCommandCaptureRaw } from "@beep/repo-cli/internal/repo-run"
 *
 * const capture = runRepoCommandCaptureRaw("git", ["status", "--porcelain=v1", "-z"], process.cwd())
 * console.log(capture)
 * ```
 *
 * @param command - Executable name or path.
 * @param args - Command arguments.
 * @param cwd - Working directory.
 * @param env - Optional environment overrides.
 * @returns Captured stdout and exit code, untrimmed.
 * @category execution
 * @since 0.0.0
 */
export const runRepoCommandCaptureRaw = makeRepoCommandCapture("RepoRun.runRepoCommandCaptureRaw", false, {
  source: "stdout",
  trim: false,
});

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

const makeRepoPlanStepExecutor = (identifier: string, capture: typeof runRepoCommandCapture) =>
  Effect.fn(identifier)(function* (
    step: RepoPlanStep,
    rawOutputPath: O.Option<string> = O.none()
  ): Effect.fn.Return<
    RepoStepRunResult,
    DomainError,
    FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
  > {
    const commandText = commandTextForStep(step);
    yield* Console.log(`[repo-run] ${step.label}: ${commandText}`);
    const startedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
    const [elapsed, result] = yield* capture(step.command, step.args, step.cwd, step.env).pipe(Effect.timed);
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
 * Execute a planned repository step and optionally persist its raw output.
 *
 * **Example** (Execute a repo plan step)
 *
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
 *
 * @param step - Planned step to execute.
 * @param rawOutputPath - Optional path for captured command output.
 * @returns Captured step result.
 * @category execution
 * @since 0.0.0
 */
export const executeRepoPlanStep = makeRepoPlanStepExecutor("RepoRun.executeRepoPlanStep", runRepoCommandCapture);

/**
 * Execute a planned repository step, stream output live, and optionally persist
 * its raw output.
 *
 * **Example** (Execute a repo plan step streaming)
 *
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
 *
 * @param step - Planned step to execute.
 * @param rawOutputPath - Optional path for captured command output.
 * @returns Captured step result.
 * @category execution
 * @since 0.0.0
 */
export const executeRepoPlanStepStreaming = makeRepoPlanStepExecutor(
  "RepoRun.executeRepoPlanStepStreaming",
  runRepoCommandStreamingCapture
);

/**
 * Resolve a local node_modules binary when present.
 *
 * **Example** (Resolve a local repo binary)
 *
 * ```ts
 * import { resolveLocalRepoBinary } from "@beep/repo-cli/internal/repo-run"
 *
 * const turbo = resolveLocalRepoBinary(process.cwd(), "turbo")
 * console.log(turbo)
 * ```
 *
 * @param repoRoot - Repository root.
 * @param binary - Binary name.
 * @returns Absolute binary path when installed, otherwise the binary name.
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
