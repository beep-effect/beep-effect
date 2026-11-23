/**
 * The per-manager default-cache-directory facts table.
 *
 * **Details**
 *
 * "Where does manager X cache on platform Y by default" is a set of documented
 * facts, not policy, and it belongs low in the graph: a pure function of
 * (manager, platform, home) that a CI action, a workspace tool or a doctor
 * command can all read without a runner, a filesystem or a subprocess. Asking
 * the manager (`npm config get cache` / `pnpm store path`) would cost a
 * subprocess for a value that, on any freshly provisioned machine, is always
 * the default.
 *
 * Every row is verified against the manager's own authority (cited on the
 * member), not lifted from folklore (pnpm's macOS store is NOT the Linux XDG
 * path, and yarn Classic's cache is not `~/.yarn/cache`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NpmSpecId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as S from "effect/Schema";

const $I = $NpmSpecId.create("PackageManagerCache");

/**
 * The package managers the default-cache table has a row for.
 *
 * **Details**
 *
 * yarn is **two** rows — `yarn-classic` (v1) and `yarn-berry` (v2+) — because
 * the two lines document different cache locations and nothing about a bare
 * manager name says which major is in play. This is deliberately not
 * `PackageManagerPinName`'s four-literal provisioning vocabulary: a corepack
 * pin spells `yarn` and resolves the major from the version; a cache lookup
 * has no version to ask.
 *
 * **Example** (Read the cache-manager vocabulary)
 *
 * ```ts
 * import { CachingPackageManager } from "@beep/npm-spec/PackageManagerCache";
 *
 * console.log(CachingPackageManager.literals.join(",")) // npm,pnpm,yarn-classic,yarn-berry,bun
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CachingPackageManager = LiteralKit(["npm", "pnpm", "yarn-classic", "yarn-berry", "bun"]).pipe(
  $I.annoteSchema("CachingPackageManager", {
    description: "The package managers the default-cache table has a row for.",
  })
);

/**
 * The union of managers the default-cache table covers.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CachingPackageManager = typeof CachingPackageManager.Type;

/**
 * What {@link PackageManagerCache.defaultDirectory} derives the answer from.
 *
 * **Details**
 *
 * Plain objects retain the upstream boundary shape. Both strings are required;
 * platform names outside Windows and macOS select the Linux/XDG family.
 *
 * **Example** (Construct cache-directory inputs)
 *
 * ```ts
 * import { DefaultCacheDirectoryOptions, PackageManagerCache } from "@beep/npm-spec/PackageManagerCache";
 *
 * const options = DefaultCacheDirectoryOptions.make({ platform: "darwin", home: "/Users/ci" });
 * console.log(PackageManagerCache.defaultDirectory("pnpm", options)) // /Users/ci/Library/pnpm/store
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class DefaultCacheDirectoryOptions extends S.Opaque<
  DefaultCacheDirectoryOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    /**
     * The platform the manager runs on, `process.platform`-shaped: `win32` is
     * the Windows family, `darwin` the macOS family, and anything else falls to
     * the Linux/XDG family — so a BSD caller gets the XDG answer rather than a
     * refusal.
     */
    platform: S.String.pipe(
      $I.annoteKey("DefaultCacheDirectoryOptions.platform", {
        description:
          "The process.platform-shaped platform; win32 is Windows, darwin is macOS, and anything else uses Linux/XDG defaults.",
      })
    ),
    /** The user's home directory, e.g. `os.homedir()` or `$HOME`. */
    home: S.String.pipe(
      $I.annoteKey("DefaultCacheDirectoryOptions.home", {
        description: "The user's home directory, e.g. os.homedir() or $HOME.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DefaultCacheDirectoryOptions", {
      description: "The platform and home directory used to derive a package manager's default cache directory.",
    })
  )
) {}

/**
 * Companion types for {@link DefaultCacheDirectoryOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DefaultCacheDirectoryOptions {
  /**
   * The plain, unbranded options shape accepted by `PackageManagerCache.defaultCacheDirectory`, so a caller can pass an object literal.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DefaultCacheDirectoryOptions.Encoded;
}

const joinUnderHomeWithoutNodePath = (home: string, windows: boolean, ...parts: ReadonlyArray<string>): string =>
  A.join([home, ...parts], windows ? "\\" : "/");

/**
 * Where each package manager caches by default — a facts table, one
 * documented authority per row.
 *
 * **Gotchas**
 *
 * **Defaults only, deliberately.** Each manager also honours overrides this
 * table does not model — pnpm's `$PNPM_HOME`/`$XDG_DATA_HOME`, yarn Berry's
 * `globalFolder`, bun's `$BUN_INSTALL_CACHE_DIR`, npm's `--cache`, and
 * XDG variables generally. A consumer that must respect a customized machine
 * asks the manager itself; this table answers for the fresh-install case a CI
 * runner is.
 *
 * **Example** (Find the default pnpm cache directory on macOS)
 *
 * ```ts
 * import { PackageManagerCache } from "@beep/npm-spec/PackageManagerCache";
 *
 * console.log(PackageManagerCache.defaultDirectory("pnpm", { platform: "darwin", home: "/Users/ci" })) // /Users/ci/Library/pnpm/store
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export abstract class PackageManagerCache {
  /**
   * The literal schema of managers the table covers.
   *
   * **Example** (Inspect supported cache managers)
   *
   * ```ts
   * import { PackageManagerCache } from "@beep/npm-spec/PackageManagerCache";
   *
   * console.log(PackageManagerCache.Manager.literals.includes("pnpm")) // true
   * ```
   *
   * @category schemas
   * @since 0.0.0
   */
  static readonly Manager = CachingPackageManager;

  /**
   * The default cache directory for a manager on a platform.
   *
   * **Details**
   *
   * Row authorities, each the manager's own documentation or source
   * (verified 2026-08-02):
   *
   * - **npm** — the `cache` config default (docs.npmjs.com, cli v11):
   *   `%LocalAppData%\npm-cache` on Windows, `~/.npm` on Posix. The content-
   *   addressable store lives in `_cacache` beneath it.
   * - **pnpm** — the `storeDir` default chain (pnpm.io/settings/store), with
   *   no `$PNPM_HOME`/`$XDG_DATA_HOME` set: `~/AppData/Local/pnpm/store` on
   *   Windows, `~/Library/pnpm/store` on macOS, `~/.local/share/pnpm/store`
   *   on Linux. pnpm reports a **versioned subdirectory** of this (`…/v10`)
   *   from `pnpm store path`.
   * - **yarn-classic** — v1's `getCacheDir` (`src/util/user-dirs.js`):
   *   `%LocalAppData%\Yarn\Cache` on Windows, `~/Library/Caches/Yarn` on
   *   macOS, `~/.cache/yarn` on Linux (sans `$XDG_CACHE_HOME`). Classic
   *   writes into a versioned subdirectory (`…/v6`).
   * - **yarn-berry** — `getDefaultGlobalFolder` (`@yarnpkg/core`
   *   `folderUtils.ts`) plus the `cacheFolder` default `<globalFolder>/cache`:
   *   `%LocalAppData%\Yarn\Berry\cache` on Windows, `~/.yarn/berry/cache`
   *   elsewhere (sans `$XDG_DATA_HOME`). The **global** cache is the default
   *   since Berry v4 (`enableGlobalCache: true`); a v3 project defaulted to
   *   its per-project `.yarn/cache` instead.
   * - **bun** — the global install cache (bun.com/docs, `install.cache`):
   *   `~/.bun/install/cache` on **every** platform — bun documents no Windows
   *   divergence, so the Windows answer is under the user profile, not
   *   `AppData`.
   *
   * **Example** (Find the Linux npm cache directory)
   *
   * ```ts
   * import { PackageManagerCache } from "@beep/npm-spec/PackageManagerCache";
   *
   * console.log(PackageManagerCache.defaultDirectory("npm", { platform: "linux", home: "/home/ci" })) // /home/ci/.npm
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly defaultDirectory: {
    (manager: CachingPackageManager, options: DefaultCacheDirectoryOptions.Encoded): string;
    (options: DefaultCacheDirectoryOptions.Encoded): (manager: CachingPackageManager) => string;
  } = dual(2, (manager: CachingPackageManager, options: DefaultCacheDirectoryOptions.Encoded): string => {
    const windows = options.platform === "win32";
    const darwin = options.platform === "darwin";
    return Match.value(manager).pipe(
      Match.when("npm", () =>
        windows
          ? joinUnderHomeWithoutNodePath(options.home, windows, "AppData", "Local", "npm-cache")
          : joinUnderHomeWithoutNodePath(options.home, windows, ".npm")
      ),
      Match.when("pnpm", () =>
        windows
          ? joinUnderHomeWithoutNodePath(options.home, windows, "AppData", "Local", "pnpm", "store")
          : darwin
            ? joinUnderHomeWithoutNodePath(options.home, windows, "Library", "pnpm", "store")
            : joinUnderHomeWithoutNodePath(options.home, windows, ".local", "share", "pnpm", "store")
      ),
      Match.when("yarn-classic", () =>
        windows
          ? joinUnderHomeWithoutNodePath(options.home, windows, "AppData", "Local", "Yarn", "Cache")
          : darwin
            ? joinUnderHomeWithoutNodePath(options.home, windows, "Library", "Caches", "Yarn")
            : joinUnderHomeWithoutNodePath(options.home, windows, ".cache", "yarn")
      ),
      Match.when("yarn-berry", () =>
        windows
          ? joinUnderHomeWithoutNodePath(options.home, windows, "AppData", "Local", "Yarn", "Berry", "cache")
          : joinUnderHomeWithoutNodePath(options.home, windows, ".yarn", "berry", "cache")
      ),
      Match.when("bun", () => joinUnderHomeWithoutNodePath(options.home, windows, ".bun", "install", "cache")),
      Match.exhaustive
    );
  });
}
