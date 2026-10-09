// The per-manager default-cache-directory facts table.
//
// "Where does manager X cache on platform Y by default" is a set of documented
// facts, not policy, and it belongs low in the graph: a pure function of
// (manager, platform, home) that a CI action, a workspace tool or a doctor
// command can all read without a runner, a filesystem or a subprocess. Asking
// the manager (`npm config get cache` / `pnpm store path`) would cost a
// subprocess for a value that, on any freshly provisioned machine, is always
// the default.
//
// Every row is verified against the manager's own authority (cited on the
// member), not lifted from folklore (pnpm's macOS store is NOT the Linux XDG
// path, and yarn Classic's cache is not `~/.yarn/cache`).

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/npm/PackageManagerCache");

/**
 * The package managers the default-cache table has a row for.
 *
 * @remarks
 * yarn is **two** rows — `yarn-classic` (v1) and `yarn-berry` (v2+) — because
 * the two lines document different cache locations and nothing about a bare
 * manager name says which major is in play. This is deliberately not
 * `PackageManagerPinName`'s four-literal provisioning vocabulary: a corepack
 * pin spells `yarn` and resolves the major from the version; a cache lookup
 * has no version to ask.
 *
 * @public
 */
export const CachingPackageManager = S.Literals(["npm", "pnpm", "yarn-classic", "yarn-berry", "bun"]).pipe($I.annoteSchema("CachingPackageManager", { description: "The package managers the default-cache table has a row for." }));

/**
 * The union of managers the default-cache table covers.
 *
 * @public
 */
export type CachingPackageManager = typeof CachingPackageManager.Type;

/**
 * What {@link PackageManagerCache.defaultDirectory} derives the answer from.
 *
 * @public
 */
export interface DefaultCacheDirectoryOptions {
	/**
	 * The platform the manager runs on, `process.platform`-shaped: `win32` is
	 * the Windows family, `darwin` the macOS family, and anything else falls to
	 * the Linux/XDG family — so a BSD caller gets the XDG answer rather than a
	 * refusal.
	 */
	readonly platform: string;
	/** The user's home directory, e.g. `os.homedir()` or `$HOME`. */
	readonly home: string;
}

/** Join under `home` with the platform family's separator — no IO, no `node:path`. */
const under = (home: string, windows: boolean, ...parts: ReadonlyArray<string>): string =>
	[home, ...parts].join(windows ? "\\" : "/");

/**
 * Where each package manager caches by default — a facts table, one
 * documented authority per row.
 *
 * @remarks
 * **Defaults only, deliberately.** Each manager also honours overrides this
 * table does not model — pnpm's `$PNPM_HOME`/`$XDG_DATA_HOME`, yarn Berry's
 * `globalFolder`, bun's `$BUN_INSTALL_CACHE_DIR`, npm's `--cache`, and
 * XDG variables generally. A consumer that must respect a customized machine
 * asks the manager itself; this table answers for the fresh-install case a CI
 * runner is.
 *
 * @example
 * ```ts
 * import { PackageManagerCache } from "./index.ts";
 *
 * PackageManagerCache.defaultDirectory("pnpm", { platform: "darwin", home: "/Users/ci" });
 * // => "/Users/ci/Library/pnpm/store"
 * ```
 *
 * @public
 */
export class PackageManagerCache {
	private constructor() {}

	/** The literal schema of managers the table covers. */
	static readonly Manager = CachingPackageManager;

	/**
	 * The default cache directory for a manager on a platform.
	 *
	 * @remarks
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
	 */
	static defaultDirectory(manager: CachingPackageManager, options: DefaultCacheDirectoryOptions): string {
		const windows = options.platform === "win32";
		const darwin = options.platform === "darwin";
		switch (manager) {
			case "npm":
				return windows
					? under(options.home, windows, "AppData", "Local", "npm-cache")
					: under(options.home, windows, ".npm");
			case "pnpm":
				return windows
					? under(options.home, windows, "AppData", "Local", "pnpm", "store")
					: darwin
						? under(options.home, windows, "Library", "pnpm", "store")
						: under(options.home, windows, ".local", "share", "pnpm", "store");
			case "yarn-classic":
				return windows
					? under(options.home, windows, "AppData", "Local", "Yarn", "Cache")
					: darwin
						? under(options.home, windows, "Library", "Caches", "Yarn")
						: under(options.home, windows, ".cache", "yarn");
			case "yarn-berry":
				return windows
					? under(options.home, windows, "AppData", "Local", "Yarn", "Berry", "cache")
					: under(options.home, windows, ".yarn", "berry", "cache");
			case "bun":
				return under(options.home, windows, ".bun", "install", "cache");
		}
	}
}
