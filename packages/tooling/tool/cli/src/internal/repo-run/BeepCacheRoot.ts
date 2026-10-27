/**
 * Persistent cache root resolution shared by the beep janitors and installers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "@beep/utils/Option";
import { isAbsoluteWin32 } from "@beep/xdg/Absolute";
import { XdgBase } from "@beep/xdg/XdgBase";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as Str from "effect/String";

/**
 * Resolve the cache root used for persistent beep temporary installations.
 *
 * The XDG cache home (`@beep/xdg` `XdgBase.resolve("cache")`): `XDG_CACHE_HOME`
 * when it is absolute, otherwise `.cache` under an absolute `$HOME`; failing
 * both, `TMPDIR` (default `/tmp`). A relative `XDG_CACHE_HOME` or `HOME` is
 * ignored rather than resolved against the working directory. An explicit
 * override bypasses ambient configuration for tests and callers that already
 * resolved policy.
 *
 * `XdgBase` is POSIX-only, so Windows roots keep their old rungs beside it: a
 * drive or UNC `XDG_CACHE_HOME` is still used as is, and a drive or UNC `HOME`
 * still yields its `.cache` before the `TMPDIR` fallback. A Windows root is
 * what `@beep/xdg/Absolute` `isAbsoluteWin32` accepts: a drive root, or any two
 * leading separators.
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
  const [xdgCacheHome, home] = yield* Effect.all([configuredPath("XDG_CACHE_HOME"), configuredPath("HOME")]);
  const windowsCache = O.filter(xdgCacheHome, isAbsoluteWin32);
  if (O.isSome(windowsCache)) {
    return pathService.normalize(windowsCache.value);
  }
  const cacheRoot = XdgBase.resolve("cache", { value: O.getOrUndefined(xdgCacheHome), home: O.getOrUndefined(home) });
  if (O.isSome(cacheRoot)) {
    return pathService.resolve(cacheRoot.value);
  }
  const windowsHome = O.filter(home, isAbsoluteWin32);
  if (O.isSome(windowsHome)) {
    return pathService.join(windowsHome.value, ".cache");
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
