/**
 * Frozen pre-W7 git runners for `ops/worktree-differential-w7.ts`: `runGitOutput` and `runGitRawOutput` from
 * `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`, verbatim from the lane base 8602b24203 (the W7 kit
 * head) together with the private `runGitCaptured`, `runGitStructured` and `failFromOutcome` they share.
 *
 * Inlined because the runner retirement step deletes them from `GitExec.ts`; the frozen copies import only
 * `StepExec` (which survives) and the adapter type, which the retirement keeps.
 *
 * Import repoint only: `StepExec` moved to `@beep/repo-cli-kit/process/StepExec` (#2669, beep-cli-composition W3).
 */

import {
  formatCommandLine,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
} from "@beep/repo-cli-kit/process/StepExec";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import type { RunCapturedOptions, RunCapturedStreamsOptions } from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

type GitCaptureOutcome = {
  readonly exitCode: number;
  readonly parsed: string;
  readonly failureOutput: string;
  readonly truncated: boolean;
};

const failFromOutcome = <E>(
  outcome: GitCaptureOutcome,
  commandLine: string,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E> => {
  if (outcome.exitCode !== 0) {
    return Effect.fail(
      adapter.onNonZeroExit({ commandLine, exitCode: outcome.exitCode, output: outcome.failureOutput })
    );
  }
  return O.match(adapter.onTruncated, {
    onNone: () => Effect.succeed(outcome.parsed),
    onSome: (toError) => (outcome.truncated ? Effect.fail(toError(commandLine)) : Effect.succeed(outcome.parsed)),
  });
};

const runGitCaptured = <E>(
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  capture: Omit<RunCapturedOptions, "command" | "args">
): Effect.Effect<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandLine = formatCommandLine("git", args);
  return runCaptured({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.output,
          failureOutput: captured.output,
          truncated: captured.truncated,
        },
        commandLine,
        adapter
      )
    )
  );
};

const runGitStructured = <E>(
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>,
  capture: Omit<RunCapturedStreamsOptions, "command" | "args">
): Effect.Effect<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> => {
  const commandLine = formatCommandLine("git", args);
  return runCapturedStreams({ command: "git", args, ...capture }).pipe(
    Effect.mapError(adapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.stdout,
          failureOutput: `${captured.stdout}${captured.stderr}`,
          truncated: captured.truncated,
        },
        commandLine,
        adapter
      )
    )
  );
};

/** Pre-W7 `runGitOutput`: merged, trimmed output under the 512 KiB repo-run bound. */
export const runGitOutput = Effect.fn("GitExec.runGitOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitCaptured(args, adapter, {
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  });
});

/** Pre-W7 `runGitRawOutput`: unbounded, untrimmed stdout, stderr kept out of the parsed text. */
export const runGitRawOutput = Effect.fn("GitExec.runGitRawOutput")(function* <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.fn.Return<string, E, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  return yield* runGitStructured(args, adapter, { cwd, stdin: "ignore" });
});
