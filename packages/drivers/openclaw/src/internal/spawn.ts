/**
 * Shared child-process spawn scaffold for the OpenClaw driver runners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { O } from "@beep/utils";
import { Duration, Effect, Stream } from "effect";
import * as A from "effect/Array";
import { ChildProcess } from "effect/unstable/process";
import { OpenclawCommandSpawnError } from "../Openclaw.errors.ts";
import { OpenclawProcessResult } from "../Openclaw.models.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { OpenclawProcessRequest } from "../Openclaw.models.ts";

const forceKillGrace = Duration.seconds(2);

/**
 * Spawn the requested process, collect stdout/stderr/exit code, and map any
 * spawn or stream failure to a redacted `OpenclawCommandSpawnError`.
 *
 * **Example** (Usage)
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
  const stdinText = O.getOrUndefined(request.stdinText);
  const command = ChildProcess.make(request.executable, A.fromIterable(request.args), {
    ...O.getSomesStruct({
      forceKillAfter: O.as(request.timeoutMs, forceKillGrace),
    }),
    env: request.env,
    extendEnv,
    // fallow-ignore-next-line code-duplication -- The approved process-hardening spec keeps output ownership inside each driver boundary.
    stdin: stdinText === undefined ? "ignore" : "pipe",
    stderr: "pipe",
    stdout: "pipe",
  });

  return Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(command);
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          stdinText === undefined
            ? Effect.void
            : Stream.make(new TextEncoder().encode(stdinText)).pipe(Stream.run(handle.stdin)),
          handle.stdout.pipe(Stream.decodeText(), Stream.mkString),
          handle.stderr.pipe(Stream.decodeText(), Stream.mkString),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      ).pipe(Effect.map(([, stdout, stderr, exitCode]) => [stdout, stderr, exitCode] as const));

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
