import type { ConfigResolver } from "../config-file/index.ts";
import { Walker } from "../walker/index.ts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { AppDirs } from "./AppDirs.ts";
import { NativeDirs } from "./NativeDirs.ts";
import { CurrentPlatform, Xdg } from "./Xdg.ts";

// Implementation of XdgConfig.resolver; the public contract lives on the static.
const resolver = (options: {
	readonly filename: string;
}): ConfigResolver<AppDirs | FileSystem.FileSystem | Path.Path> => ({
	name: "xdg",
	resolve: Effect.gen(function* () {
		const appDirs = yield* AppDirs;
		const path = yield* Path.Path;
		const fs = yield* FileSystem.FileSystem;
		const candidates = appDirs.dirs.configSearchPath.map((dir) => path.join(dir, options.filename));
		return yield* Walker.firstMatch(candidates, (candidate) => fs.exists(candidate));
	}),
});

// Implementation of XdgConfig.nativeResolver; the public contract lives on the static.
const nativeResolver = (options: {
	readonly namespace: string;
	readonly filename: string;
}): ConfigResolver<Xdg | FileSystem.FileSystem | Path.Path> => ({
	name: "native",
	resolve: Effect.gen(function* () {
		const paths = yield* Xdg;
		const platform = yield* CurrentPlatform;
		const path = yield* Path.Path;
		const fs = yield* FileSystem.FileSystem;

		const native = NativeDirs.resolve({ platform, namespace: options.namespace, paths, path });
		if (O.isNone(native)) return O.none();

		// One candidate, but still through `firstMatch`: the absorption contract is
		// what `ConfigResolver` requires, and it lives in exactly one place.
		return yield* Walker.firstMatch([path.join(native.value.config, options.filename)], (candidate) =>
			fs.exists(candidate),
		);
	}),
});

// Implementation of XdgConfig.savePath; the public contract lives on the static.
const savePath = (filename: string): Effect.Effect<string, never, AppDirs | Path.Path> =>
	Effect.gen(function* () {
		const appDirs = yield* AppDirs;
		const path = yield* Path.Path;
		return path.join(appDirs.dirs.config, filename);
	});

/**
 * The bridge from XDG directories into `@effected/config-file`.
 *
 * @public
 */
export class XdgConfig {
	private constructor() {}

	/**
	 * Search the app's XDG config search path for `filename`.
	 *
	 * @remarks
	 * Probes the app's own config directory first, then each `$XDG_CONFIG_DIRS`
	 * entry namespaced — `~/.config/myapp/rc`, then `/etc/xdg/myapp/rc`.
	 *
	 * The scan runs through `Walker.firstMatch`, so a failure on one candidate means
	 * "this candidate did not match" and the search continues to the next: an unreadable
	 * `/etc/xdg` never hides a readable `~/.config`. Not-found and cannot-look stay
	 * indistinguishable to the caller, which is the resolver contract —
	 * `resolve`'s error channel is `never`.
	 *
	 * Place it **before** {@link XdgConfig.nativeResolver} in a chain, so an
	 * existing `~/.config/<app>` still wins over the OS-native directory.
	 */
	static readonly resolver = resolver;

	/**
	 * Probe the OS-native config directory for `filename`.
	 *
	 * @remarks
	 * Resolves the native config directory for `namespace`
	 * (`~/Library/Application Support/<ns>` on macOS, `%APPDATA%\<ns>` on Windows)
	 * and checks whether `filename` is there. On Linux and everywhere else
	 * {@link NativeDirs.resolve} yields `Option.none()`, so this resolver returns
	 * `Option.none()` without probing at all — the XDG resolver already owns
	 * `~/.config` there.
	 *
	 * Takes `namespace` rather than reading it off {@link AppDirs}: the native
	 * directory is a property of the OS convention, not of however the app happened
	 * to configure its XDG directories, and a caller may well probe a *different*
	 * namespace than the one their `AppDirs` was built for.
	 */
	static readonly nativeResolver = nativeResolver;

	/**
	 * The default save target for a config file: `<app config dir>/<filename>`.
	 *
	 * @remarks
	 * Drops straight into `ConfigFileOptions.defaultPath`, whose slot is typed
	 * `Effect<string, never, RR>`. That infallible channel is the whole reason
	 * {@link AppDirs} resolves at layer-construction time, so no `orDie` is needed
	 * to fit the slot.
	 *
	 * It does **not** create the directory — `ConfigFile.save` already `mkdir -p`s
	 * the parent of whatever path it is given.
	 *
	 * @example
	 * ```ts
	 * import { XdgConfig } from "./index.ts";
	 * import { ConfigFile, JsonCodec, MergeStrategy } from "../config-file/index.ts";
	 *
	 * const layer = ConfigFile.layer(AppConfig, {
	 * 	schema: AppShape,
	 * 	codec: JsonCodec,
	 * 	strategy: MergeStrategy.firstMatch<AppShape>(),
	 * 	resolvers: [XdgConfig.resolver({ filename: "config.json" })],
	 * 	defaultPath: XdgConfig.savePath("config.json"),
	 * });
	 * ```
	 */
	static readonly savePath = savePath;
}
