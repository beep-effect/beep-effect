/**
 * Frozen pre-W7 Git runners for `ops/yeet-differential-w7.ts`: the Yeet `runGitOutput` and `runGitPathList` wrappers
 * (`packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts`) over the shared
 * `runGitOutput` and `runGitPathList` (`packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`),
 * from the lane base 8602b24203 (origin/main e4f5395ff4 plus the W7 kit).
 *
 * The shared runners are deleted by the W7 runner retirement, so their bodies are inlined here over the StepExec
 * captures that survive it (`runCaptured`, `runCapturedStreams`): the merged, trimmed, 512 KiB capture of
 * `runGitOutput`, and the stdout-only, NUL-split, sorted-unique path list under its 8 MiB stdout bound. The streamed
 * fold survives as the Y33 KEEP, so frozen bodies call the shipped `runGitFoldedStdout`. `failFromOutcome` and
 * Yeet's adapter wording are verbatim.
 *
 * Import repoint only: StepExec/Bytes moved to `@beep/repo-cli-kit` (#2669, beep-cli-composition W3).
 */

import {
  formatCommandLine,
  OutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
} from "@beep/repo-cli-kit/process/StepExec";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { yeetGitOutputErrorAdapter } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitErrorAdapter.ts";
import { gitPathListFromNulOutput } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

type OldGitServices = SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

type GitCaptureOutcome = {
  readonly exitCode: number;
  readonly parsed: string;
  readonly failureOutput: string;
  readonly truncated: boolean;
};

// repo-run GitExec.failFromOutcome, verbatim.
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

/** The pre-W7 shared `runGitOutput`: stdout and stderr merged, trimmed, under the 512 KiB repo-run bound. */
export const oldRunGitOutputWith = <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E, OldGitServices> => {
  const commandLine = formatCommandLine("git", args);
  return runCaptured({
    command: "git",
    args,
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  }).pipe(
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

/** The pre-W7 Yeet `runGitOutput`: the shared runner over Yeet's adapter. */
export const oldRunGitOutput = (
  cwd: string,
  args: ReadonlyArray<string>
): Effect.Effect<string, YeetCommandError, OldGitServices> => oldRunGitOutputWith(cwd, args, yeetGitOutputErrorAdapter);

const gitPathOutputBound = OutputBound.make({
  maxChars: 8 * 1024 * 1024,
  truncatedNotice: "\n[repo-run] Git filename inventory exceeded 8 MiB",
});

/** The pre-W7 Yeet `runGitPathList`: stdout only, NUL-split, sorted and unique, under an 8 MiB stdout bound. */
export const oldRunGitPathList = (
  cwd: string,
  args: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<string>, YeetCommandError, OldGitServices> => {
  const commandLine = formatCommandLine("git", args);
  return runCapturedStreams({
    command: "git",
    args,
    cwd,
    extendEnv: true,
    stdin: "inherit",
    bound: repoRunOutputBound,
    trim: true,
    stdoutBound: gitPathOutputBound,
  }).pipe(
    Effect.mapError(yeetGitOutputErrorAdapter.onSpawnFailure(commandLine)),
    Effect.flatMap((captured) =>
      failFromOutcome(
        {
          exitCode: captured.exitCode,
          parsed: captured.stdout,
          failureOutput: `${captured.stdout}${captured.stderr}`,
          truncated: captured.truncated,
        },
        commandLine,
        yeetGitOutputErrorAdapter
      )
    ),
    Effect.map(gitPathListFromNulOutput)
  );
};
