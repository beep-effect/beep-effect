/**
 * Frozen pre-W7 generic git runners, from `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts` at the W7b
 * lane base 8602b24203, replayed by `ops/groups-differential-w7.ts`.
 *
 * The runner retirement deletes `runGitOutput`, `runGitPathList`, `runGitLines`, `runGitRawOutput` and their private
 * helpers from `GitExec.ts`, so they are inlined here verbatim (only the doc comments and the `Effect.fn` span names
 * dropped); they import only `StepExec.ts`, which survives the retirement, and the adapter type, which stays.
 *
 * Import repoint only: StepExec/JsonCodec moved to `@beep/repo-cli-kit` (#2669, beep-cli-composition W3).
 */

import {
  formatCommandLine,
  OutputBound,
  repoRunOutputBound,
  runCaptured,
  runCapturedStreams,
} from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import type { RunCapturedOptions, RunCapturedStreamsOptions } from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitCommandErrorAdapter } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts";

type Requirements = SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner;

export const sortedUniquePaths: (paths: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupe,
  A.sort(Order.String)
);

export const gitPathListFromNulOutput: (output: string) => ReadonlyArray<string> = flow(
  Str.split("\0"),
  sortedUniquePaths
);

export const gitLinesFromOutput = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(output), A.map(Str.trim), A.filter(Str.isNonEmpty));

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
): Effect.Effect<string, E, Requirements> => {
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
): Effect.Effect<string, E, Requirements> => {
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

const structuredCapture = (cwd: string): Omit<RunCapturedStreamsOptions, "command" | "args"> => ({
  cwd,
  extendEnv: true,
  stdin: "inherit",
  bound: repoRunOutputBound,
  trim: true,
});

const gitPathOutputBound = OutputBound.make({
  maxChars: 8 * 1024 * 1024,
  truncatedNotice: "\n[repo-run] Git filename inventory exceeded 8 MiB",
});

export const runGitOutput = <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E, Requirements> =>
  runGitCaptured(args, adapter, {
    cwd,
    extendEnv: true,
    stdin: "inherit",
    source: "merge",
    bound: repoRunOutputBound,
    trim: true,
  });

export const runGitPathList = <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<ReadonlyArray<string>, E, Requirements> =>
  runGitStructured(args, adapter, { ...structuredCapture(cwd), stdoutBound: gitPathOutputBound }).pipe(
    Effect.map(gitPathListFromNulOutput)
  );

export const runGitLines = <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<ReadonlyArray<string>, E, Requirements> =>
  runGitCaptured(args, adapter, { cwd, source: "stdout" }).pipe(Effect.map(gitLinesFromOutput));

export const runGitRawOutput = <E>(
  cwd: string,
  args: ReadonlyArray<string>,
  adapter: GitCommandErrorAdapter<E>
): Effect.Effect<string, E, Requirements> => runGitStructured(args, adapter, { cwd, stdin: "ignore" });
