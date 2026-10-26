// Run a command ONCE and collect its interleaved output alongside its exit
// code — the shape every archiver call in this package needs.
//
// **One spawn, not two — load-bearing.** The spawner's convenience members
// each spawn independently: `string` collects output without inspecting the
// exit code, and `exitCode` runs the command AGAIN (core's

// `ChildProcessSpawner.make` derives both from `spawn`). Calling them
// back-to-back double-executes every archive operation — harmless for
// idempotent `tar`/`unzip -o`, but .NET's `ZipFile.ExtractToDirectory`
// refuses to overwrite, so the second run fails on Windows while the
// captured "complaint" is the FIRST run's silent success. Output
// and exit code must come from the same `spawn` handle, and this is the one
// place that discipline is spelled.
//
// Output is drained BEFORE the exit code is awaited, so a chatty command
// cannot deadlock on a full pipe; the stream ends at exit. The caller applies
// its own exit-code policy (the cache tolerates `tar -k`'s exit 1) and maps
// the `PlatformError` into its own error class.
import { $GithubActionsId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as Function from "effect/Function";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import type * as PlatformError from "effect/PlatformError";
import type * as ChildProcess from "effect/process/ChildProcess";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $GithubActionsId.create("internal/spawn");

/**
 * What one run produced: stdout and stderr interleaved, and the exit code.
 * **Example** (Validate SpawnOnceResult input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { SpawnOnceResult } from "@beep/github-actions/internal/spawn";
 *
 * const input = { output: "installed", code: 0 };
 * Effect.runSync(Console.log(S.is(SpawnOnceResult)(input))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpawnOnceResult extends S.Opaque<SpawnOnceResult, { readonly brand: unique symbol }>()(
  S.Struct({
    output: S.String.pipe(
      $I.annoteKey("SpawnOnceResult.output", { description: "The interleaved stdout and stderr from one spawn." })
    ),
    code: S.Finite.pipe(
      $I.annoteKey("SpawnOnceResult.code", {
        description: "The same spawn's finite exit code, without applying caller policy.",
      })
    ),
  }).pipe(
    $I.annoteSchema("SpawnOnceResult", {
      description: "The plain-object output and exit code collected from one spawn handle.",
    })
  )
) {}

/**
 * The plain-object result accepted by {@link SpawnOnceResult}.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SpawnOnceResult {
  /**
   * The plain object a {@link SpawnOnceResult} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SpawnOnceResult.Encoded;
}

/**
 * Spawn `command` once, drain `stdout`+`stderr`, then read the exit code from
 * the same handle. Never fails on a non-zero exit — that is the caller's
 * policy.
 *
 * **Example** (Construct a single-spawn program)
 *
 * ```ts
 * import { spawnOnce } from "@beep/github-actions/internal/spawn"
 * import * as Effect from "effect/Effect"
 * import * as ChildProcess from "effect/process/ChildProcess";
 * import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
 * const program = Effect.flatMap(ChildProcessSpawner.ChildProcessSpawner, (spawner) =>
 *   spawnOnce(spawner, ChildProcess.make("tar", ["--version"]))
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const spawnOnce: {
  (
    spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
    command: ChildProcess.Command
  ): Effect.Effect<SpawnOnceResult, PlatformError.PlatformError>;
  (
    command: ChildProcess.Command
  ): (
    spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]
  ) => Effect.Effect<SpawnOnceResult, PlatformError.PlatformError>;
} = Function.dual(
  2,
  (
    spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
    command: ChildProcess.Command
  ): Effect.Effect<SpawnOnceResult, PlatformError.PlatformError> =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(command);
        const output = yield* handle.all.pipe(Stream.decodeText, Stream.mkString);
        const code = yield* handle.exitCode;
        return SpawnOnceResult.make({ output, code });
      })
    )
);
