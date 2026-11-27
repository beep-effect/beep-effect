import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { ActionEnvironment } from "../ActionEnvironment.ts";
import { isWindowsRunner } from "./runner.ts";

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
 * **Gotchas**
 *
 * Resolve platform and runner services once when constructing archive-backed layers, so every archive service member has R = never. Keep the HTTP backend, scratch filesystem/path, spawner and runner environment together, including the shared Windows fact.
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
