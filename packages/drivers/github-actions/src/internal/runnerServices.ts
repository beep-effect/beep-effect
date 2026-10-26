import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { ActionEnvironment } from "../ActionEnvironment.ts";
import { isWindowsRunner } from "./runner.ts";

// The platform services the archive-backed protocols (`ActionCache` and
// `Artifact`) resolve once, at layer construction, so every member's `R` is
// `never`: HTTP for the results backend, the filesystem and path dialect for
// the scratch archive, the spawner for `tar`, and the runner environment with
// the one host fact both read from it.

/**
 * What an archive-backed service needs from its layer.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type RunnerServiceRequirements =
  | ActionEnvironment
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner;

/**
 * Resolve the archive-backed services' platform once.
 *
 * **Example** (Reference the resolver)
 *
 * ```ts
 * import { runnerServices } from "@beep/github-actions/internal/runnerServices";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.isEffect(runnerServices)) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const runnerServices = Effect.gen(function* () {
  const env = yield* ActionEnvironment;
  return {
    env,
    fs: yield* FileSystem.FileSystem,
    http: yield* HttpClient.HttpClient,
    path: yield* Path.Path,
    spawner: yield* ChildProcessSpawner.ChildProcessSpawner,
    windows: yield* isWindowsRunner(env),
  };
});
