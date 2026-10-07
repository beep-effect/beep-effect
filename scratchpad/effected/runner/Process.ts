/**
 * Subprocess helpers: gate commands stream to the terminal and return an exit
 * code; helper commands capture stdout and fail typed on a non-zero exit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Stream from "effect/Stream";
import { CommandFailed } from "./Audit.errors.ts";

/**
 * How a gate or helper command is launched.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Launch {
  readonly command: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>> | undefined;
}

/**
 * The command line as a human would type it, for logs.
 *
 * **Example** (Render a launch)
 *
 * ```ts
 * import { renderLaunch } from "@beep/scratchpad/effected/runner/Process"
 *
 * console.log(renderLaunch({ command: "git", args: ["status", "--short"], cwd: "/repo" })) // "git status --short"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderLaunch = (launch: Launch): string => A.join([launch.command, ...launch.args], " ");

/**
 * Runs a command with inherited stdio and returns its exit code, printing the
 * command line first so a transcript shows what ran.
 *
 * **Example** (Run a gate command)
 *
 * ```ts
 * import { runInherited } from "@beep/scratchpad/effected/runner/Process"
 * import * as Effect from "effect/Effect"
 *
 * const program = runInherited({ command: "true", args: [], cwd: "." })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const runInherited = Effect.fn("Runner.runInherited")(function* (launch: Launch) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  yield* Console.log(`$ ${renderLaunch(launch)}`);
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(launch.command, launch.args, {
      cwd: launch.cwd,
      env: launch.env,
      extendEnv: true,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })
  );
  return Number(exitCode);
});

/**
 * Runs a command, captures its trimmed stdout, and fails with
 * {@link CommandFailed} when it exits non-zero.
 *
 * **Example** (Capture git output)
 *
 * ```ts
 * import { capture } from "@beep/scratchpad/effected/runner/Process"
 * import * as Effect from "effect/Effect"
 *
 * const program = capture({ command: "git", args: ["rev-parse", "HEAD"], cwd: "." })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const capture = Effect.fn("Runner.capture")(function* (launch: Launch) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(launch.command, launch.args, {
      cwd: launch.cwd,
      env: launch.env,
      extendEnv: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "inherit",
    })
  );
  const output = yield* handle.stdout.pipe(Stream.decodeText, Stream.mkString);
  const exitCode = Number(yield* handle.exitCode);
  if (exitCode !== 0) {
    return yield* CommandFailed.make({ command: renderLaunch(launch), exitCode });
  }
  return output.trim();
}, Effect.scoped);

/**
 * Runs a command and returns its exit code with stdout and stderr merged,
 * without failing on a non-zero exit; for gates that must read what a red
 * command reported.
 *
 * **Example** (Capture a red command)
 *
 * ```ts
 * import { captureExit } from "@beep/scratchpad/effected/runner/Process"
 * import * as Effect from "effect/Effect"
 *
 * const program = captureExit({ command: "false", args: [], cwd: "." })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category execution
 * @since 0.0.0
 */
export const captureExit = Effect.fn("Runner.captureExit")(function* (launch: Launch) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(launch.command, launch.args, {
      cwd: launch.cwd,
      env: launch.env,
      extendEnv: true,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    })
  );
  const output = yield* handle.all.pipe(Stream.decodeText, Stream.mkString);
  const exitCode = Number(yield* handle.exitCode);
  return { exitCode, output };
}, Effect.scoped);

/**
 * Prefixes a launch with the workstation admission wrapper, so heavy work
 * (tsgo, vitest, docgen, bun install) takes a shared slot before it starts.
 *
 * **Example** (Admit a heavy command)
 *
 * ```ts
 * import { heavy } from "@beep/scratchpad/effected/runner/Process"
 *
 * console.log(heavy({ command: "bun", args: ["install"], cwd: "/repo" }).command) // "beep-heavy"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const heavy = (launch: Launch): Launch => ({
  ...launch,
  command: "beep-heavy",
  args: [launch.command, ...launch.args],
});
