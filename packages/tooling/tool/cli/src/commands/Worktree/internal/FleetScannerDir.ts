/**
 * Where the fleet scanner's bare clone lives: an explicit directory, else
 * `beep/fleet-scanner` beneath the XDG cache home, else `.beep-fleet-scanner`
 * under the fleet root.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { O, pipe } from "@beep/utils";
import { XdgBase } from "@beep/xdg/XdgBase";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { configStringOptionSync } from "../../../internal/cli/EnvConfig.ts";

/**
 * The cache root the fleet scanner clone lives beneath (`beep/fleet-scanner` under it).
 *
 * **Details**
 *
 * `@beep/xdg` `XdgBase.resolve("cache")`: `$XDG_CACHE_HOME` when it is
 * absolute, else `.cache` under an absolute home directory. `None` (nothing
 * absolute to resolve) sends the scanner to `.beep-fleet-scanner` under the
 * fleet root instead.
 *
 * **Example** (Fall back to the home cache)
 *
 * ```ts
 * import { fleetScannerCacheRoot } from "@beep/repo-cli/test/Worktree"
 * import * as O from "effect/Option"
 *
 * const root = fleetScannerCacheRoot({ xdgCacheHome: O.none(), homeDir: O.some("/home/dev") })
 * console.log(O.getOrNull(root)) // /home/dev/.cache
 * ```
 *
 * @param input - The `XDG_CACHE_HOME` value and the home directory, each when known.
 * @returns The cache root, when one resolves.
 * @category utilities
 * @since 0.0.0
 */
export const fleetScannerCacheRoot = (input: {
  readonly xdgCacheHome: O.Option<string>;
  readonly homeDir: O.Option<string>;
}): O.Option<string> =>
  XdgBase.resolve("cache", { value: O.getOrUndefined(input.xdgCacheHome), home: O.getOrUndefined(input.homeDir) });

/**
 * Select the scanner directory the way `fleet` does, reading `XDG_CACHE_HOME` from the live environment.
 *
 * **Details**
 *
 * `scannerDir` wins; then `beep/fleet-scanner` beneath
 * {@link fleetScannerCacheRoot} of `XDG_CACHE_HOME` (read at call time through
 * `configStringOptionSync`) and `homeDir`; then `.beep-fleet-scanner` under
 * `fleetRoot`.
 *
 * **Example** (Pass an explicit scanner directory)
 *
 * ```ts
 * import { selectFleetScannerDir } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Path from "effect/Path"
 *
 * const dir = selectFleetScannerDir({ scannerDir: O.some("/s"), homeDir: O.none(), fleetRoot: "/f" })
 * console.log(Effect.runSync(Effect.provide(dir, Path.layer))) // /s
 * ```
 *
 * @param input - The explicit scanner directory and home directory, when known, and the fleet root.
 * @returns The scanner directory.
 * @category utilities
 * @since 0.0.0
 */
export const selectFleetScannerDir = (input: {
  readonly scannerDir: O.Option<string>;
  readonly homeDir: O.Option<string>;
  readonly fleetRoot: string;
}): Effect.Effect<string, never, Path.Path> =>
  Effect.map(Path.Path, (path) =>
    pipe(
      input.scannerDir,
      O.orElse(() =>
        O.map(
          fleetScannerCacheRoot({ xdgCacheHome: configStringOptionSync("XDG_CACHE_HOME"), homeDir: input.homeDir }),
          (cache) => path.join(cache, "beep", "fleet-scanner")
        )
      ),
      O.getOrElse(() => path.join(input.fleetRoot, ".beep-fleet-scanner"))
    )
  );
