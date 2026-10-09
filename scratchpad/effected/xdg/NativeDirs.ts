import type * as Path from "effect/Path";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { XdgPaths, XdgPlatform } from "./Xdg.ts";

/**
 * The OS-native application directories for one namespace.
 *
 * @remarks
 * On platforms without OS-level separation of these concerns, `config`, `data`
 * and `state` collapse to the same directory — `~/Library/Application Support/<ns>`
 * on macOS — while `cache` stays distinct.
 *
 * @public
 */
export class NativeDirs extends S.Class<NativeDirs>("NativeDirs")({
	/** Where configuration lives. */
	config: S.String,
	/** Where application data lives. */
	data: S.String,
	/** Where discardable cached data lives. */
	cache: S.String,
	/** Where persistent-but-regenerable state lives. */
	state: S.String,
}) {
	/**
	 * Map a platform and an environment onto the native directories for a namespace.
	 *
	 * @remarks
	 * **Pure**: no filesystem, no environment, no `process.platform`. Every input
	 * is a parameter, which is what makes the whole platform matrix testable
	 * without any platform IO. Paths are joined through the supplied `Path`, so a
	 * win32 `Path` layer yields win32 separators.
	 *
	 * - **darwin** — `config`/`data`/`state` under `~/Library/Application Support/<ns>`;
	 *   `cache` under `~/Library/Caches/<ns>`.
	 * - **win32** — `config`/`data` under `%APPDATA%/<ns>`; `cache` under
	 *   `%LOCALAPPDATA%/<ns>/Cache`; `state` under `%LOCALAPPDATA%/<ns>`. When the
	 *   variables are unset, `%APPDATA%` falls back to `<home>/AppData/Roaming` and
	 *   `%LOCALAPPDATA%` to `<home>/AppData/Local`.
	 * - **everything else** — `Option.none()`. On Linux, XDG *is* the native
	 *   convention, so there is no override to apply; returning `none` rather than
	 *   a duplicate of the XDG answer is what lets a precedence ladder skip the
	 *   rung cleanly instead of shadowing the rung below it.
	 */
	static resolve(input: {
		readonly platform: XdgPlatform;
		readonly namespace: string;
		readonly paths: XdgPaths;
		readonly path: Path.Path;
	}): O.Option<NativeDirs> {
		const { platform, namespace, paths, path } = input;

		if (platform === "darwin") {
			const appSupport = path.join(paths.home, "Library", "Application Support", namespace);
			return O.some(
				NativeDirs.make({
					config: appSupport,
					data: appSupport,
					cache: path.join(paths.home, "Library", "Caches", namespace),
					state: appSupport,
				}),
			);
		}

		if (platform === "win32") {
			const roaming = paths.appData ?? path.join(paths.home, "AppData", "Roaming");
			const local = paths.localAppData ?? path.join(paths.home, "AppData", "Local");
			return O.some(
				NativeDirs.make({
					config: path.join(roaming, namespace),
					data: path.join(roaming, namespace),
					cache: path.join(local, namespace, "Cache"),
					state: path.join(local, namespace),
				}),
			);
		}

		return O.none();
	}
}
