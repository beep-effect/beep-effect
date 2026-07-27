/**
 * Shared child-process spawn scaffold for the OpenClaw driver runners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { collectProcessOutput } from "@beep/utils/Stream";
import { Effect } from "effect";
import * as A from "effect/Array";
import { ChildProcess } from "effect/unstable/process";
import { OpenclawCommandSpawnError } from "../Openclaw.errors.ts";
import { OpenclawProcessResult } from "../Openclaw.models.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { OpenclawProcessRequest } from "../Openclaw.models.ts";

/**
 * Spawn the requested process, collect stdout/stderr/exit code, and map any
 * spawn or stream failure to a redacted `OpenclawCommandSpawnError`.
 *
 * @example
 * ```ts
 * import { spawnProcessResult } from "@beep/openclaw/internal/spawn"
 *
 * console.log(typeof spawnProcessResult) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const spawnProcessResult = (input: {
  readonly extendEnv: boolean;
  readonly request: OpenclawProcessRequest;
  readonly spawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly subcommand: string;
}): Effect.Effect<OpenclawProcessResult, OpenclawCommandSpawnError> => {
  const { extendEnv, request, spawner, subcommand } = input;
  const command = ChildProcess.make(request.executable, A.fromIterable(request.args), {
    env: request.env,
    extendEnv,
    stdin: "ignore",
    stderr: "pipe",
    stdout: "pipe",
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* collectProcessOutput(handle);

      return OpenclawProcessResult.make({ exitCode, stderr, stdout });
    })
  ).pipe(
    Effect.mapError((cause) =>
      OpenclawCommandSpawnError.make({
        argumentCount: A.length(request.args),
        cause,
        executable: request.executable,
        subcommand,
      })
    )
  );
};
