/**
 * Persistent cache root resolution shared by the beep janitors and installers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Str from "effect/String";

/**
 * Resolve the cache root used for persistent beep temporary installations.
 *
 * `XDG_CACHE_HOME` wins when non-empty; otherwise the root is `$HOME/.cache`.
 * An explicit override bypasses ambient configuration for tests and callers
 * that already resolved policy.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { resolveBeepCacheRoot } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(resolveBeepCacheRoot())) // true
 * ```
 *
 * @param override - Explicit cache root, primarily for fixture isolation.
 * @returns The absolute cache root.
 * @category configuration
 * @since 0.0.0
 */
export const resolveBeepCacheRoot = Effect.fn("BeepCacheRoot.resolveBeepCacheRoot")(function* (override?: string) {
  const pathService = yield* Path.Path;
  const explicit = O.fromUndefinedOr(override);
  if (O.isSome(explicit)) {
    return pathService.resolve(explicit.value);
  }
  const configured = yield* Config.option(Config.String("XDG_CACHE_HOME"));
  const cacheRoot = O.filter(configured, Str.isNonEmpty);
  if (O.isSome(cacheRoot)) {
    return pathService.resolve(cacheRoot.value);
  }
  const home = O.filter(yield* Config.option(Config.String("HOME")), Str.isNonEmpty);
  if (O.isSome(home)) {
    return pathService.join(pathService.resolve(home.value), ".cache");
  }
  const tmpFallback = yield* Config.String("TMPDIR").pipe(Config.withDefault("/tmp"));
  return pathService.resolve(tmpFallback);
});

/**
 * Read one environment variable as an optional non-empty string.
 *
 * **Example** (Build the lookup effect)
 *
 * ```ts
 * import { configuredPath } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(configuredPath("TMPDIR"))) // true
 * ```
 *
 * @param name - Environment variable name.
 * @returns `None` when the variable is unset, empty, or unreadable.
 * @category configuration
 * @since 0.0.0
 */
export const configuredPath = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none<string>), Effect.map(O.filter(Str.isNonEmpty)));
