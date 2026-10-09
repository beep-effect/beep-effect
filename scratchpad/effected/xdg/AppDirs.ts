import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { NativeDirs } from "./NativeDirs.ts";
import type { XdgPaths, XdgPlatform } from "./Xdg.ts";
import { CurrentPlatform, Xdg } from "./Xdg.ts";

const $I = $ScratchpadId.create("effected/xdg/AppDirs");

/**
 * Indicates that an application namespace is not a single non-empty path component.
 *
 * **Details**
 *
 * Invalid namespaces remain defects during layer construction.
 *
 * **Example** (Describe an invalid namespace)
 *
 * ```ts
 * import { AppDirsNamespaceError } from "./AppDirs.ts";
 *
 * const error = AppDirsNamespaceError.make({ message: "AppDirs.layer: `namespace` must not be empty" });
 * console.log(error.message);
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class AppDirsNamespaceError extends S.TaggedError<AppDirsNamespaceError>($I`AppDirsNamespaceError`)(
	"AppDirsNamespaceError",
	{ message: S.String },
	$I.annote("AppDirsNamespaceError", { description: "An invalid application directory namespace." }),
) {}

/**
 * The four directory kinds XDG separates, plus the runtime directory.
 *
 * @public
 */
export const AppDirKind = S.Literals(["config", "data", "cache", "state", "runtime"]).pipe($I.annoteSchema("AppDirKind", { description: "The four directory kinds XDG separates, plus the runtime directory." }));

/**
 * The decoded form of {@link (AppDirKind:variable)}.
 *
 * @public
 */
export type AppDirKind = typeof AppDirKind.Type;

/**
 * Indicates that an application directory could not be created.
 *
 * @remarks
 * The only way `AppDirs` fails. Resolution cannot fail — it happens once, at
 * layer construction, from an environment that is already resolved — so this
 * error means exactly one thing: the `mkdir -p` did not work. `directory` says
 * which kind, `path` says where, and `cause` carries the underlying
 * `PlatformError` structurally.
 *
 * @public
 */
export class AppDirsError extends S.TaggedError<AppDirsError>($I`AppDirsError`)("AppDirsError", {
	/** Which directory kind failed. */
	directory: AppDirKind.annotateKey({ description: "Which directory kind failed." }),
	/** The path that could not be created. */
	path: S.String.annotateKey({ description: "The path that could not be created." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("AppDirsError", { description: "Indicates that an application directory could not be created." })) {
	override get message(): string {
		return `Failed to create the ${this.directory} directory at "${this.path}"`;
	}
}

/**
 * The fully resolved, app-namespaced directories.
 *
 * @public
 */
export class ResolvedAppDirs extends S.Class<ResolvedAppDirs>($I`ResolvedAppDirs`)({
	/** The app's configuration directory. */
	config: S.String.annotateKey({ description: "The app's configuration directory." }),
	/** The app's data directory. */
	data: S.String.annotateKey({ description: "The app's data directory." }),
	/** The app's cache directory. */
	cache: S.String.annotateKey({ description: "The app's cache directory." }),
	/** The app's state directory. */
	state: S.String.annotateKey({ description: "The app's state directory." }),
	/**
	 * The app's runtime directory.
	 *
	 * @remarks
	 * Absent unless `$XDG_RUNTIME_DIR` is set or `dirs.runtime` overrides it.
	 * There is no defensible fallback for a runtime directory — it must be
	 * user-owned, mode 0700 and cleaned on logout — so inventing one would be a
	 * lie, and the key is simply absent.
	 */
	runtime: S.optionalKey(S.String).annotateKey({ description: "The app's runtime directory." }),
	/**
	 * Where to **look** for configuration, in priority order.
	 *
	 * @remarks
	 * The app's own config directory, then each `$XDG_CONFIG_DIRS` entry
	 * namespaced. It is what makes {@link XdgConfig.resolver} a real search
	 * rather than a single stat.
	 */
	configSearchPath: S.Array(S.String).annotateKey({ description: "Where to **look** for configuration, in priority order." }),
	/** Where to look for data files, in priority order. */
	dataSearchPath: S.Array(S.String).annotateKey({ description: "Where to look for data files, in priority order." }),
}, $I.annote("ResolvedAppDirs", { description: "The fully resolved, app-namespaced directories." })) {}

/**
 * Per-kind absolute directory overrides. Each wins outright over every other rung.
 *
 * @public
 */
export interface AppDirOverrides {
	/** An absolute path for the config directory. */
	readonly config?: string;
	/** An absolute path for the data directory. */
	readonly data?: string;
	/** An absolute path for the cache directory. */
	readonly cache?: string;
	/** An absolute path for the state directory. */
	readonly state?: string;
	/** An absolute path for the runtime directory. */
	readonly runtime?: string;
}

/**
 * Options for {@link AppDirs.layer}.
 *
 * @remarks
 * Plain optional fields, not `Option`s: `Option` is an internal
 * representation, not an input format, so write `fallbackDir: ".myapp"` and
 * omit `dirs` when unused.
 *
 * @public
 */
export interface AppDirsOptions {
	/**
	 * The application namespace — one path component.
	 *
	 * @remarks
	 * Must be non-empty and free of path separators. A namespace containing `..`
	 * or `/` would resolve the app's directories outside `$HOME` entirely, so it
	 * is rejected as a **defect** at layer construction: it can only come from
	 * code, never from user input.
	 */
	readonly namespace: string;
	/**
	 * Use the OS-native directories where the platform has them. Defaults to `false`.
	 *
	 * @remarks
	 * Only consulted when no XDG variable and no explicit override applies, and
	 * only on darwin and win32 — on Linux there is nothing to override.
	 */
	readonly native?: boolean;
	/**
	 * A single dot-directory under `$HOME` that all four kinds collapse to.
	 *
	 * @remarks
	 * Relative to `$HOME`: `fallbackDir: ".myapp"` gives `$HOME/.myapp`.
	 */
	readonly fallbackDir?: string;
	/** Absolute per-kind overrides. */
	readonly dirs?: AppDirOverrides;
}

/**
 * App-namespaced directory resolution and on-demand creation.
 *
 * @remarks
 * `dirs` is a **value**, not an `Effect`: the environment is fixed when the
 * layer is built, so resolution happens there, exactly once. Reading a path
 * cannot fail and cannot be observed to do IO. Only the `ensure*` operations
 * touch the filesystem, and they are the only fallible members.
 *
 * @public
 */
export interface AppDirsShape {
	/** The namespace these directories were resolved for. */
	readonly namespace: string;
	/** The resolved directories. Reading them cannot fail. */
	readonly dirs: ResolvedAppDirs;
	/** Create the config directory if it does not exist, and return it. */
	readonly ensureConfig: Effect.Effect<string, AppDirsError>;
	/** Create the data directory if it does not exist, and return it. */
	readonly ensureData: Effect.Effect<string, AppDirsError>;
	/** Create the cache directory if it does not exist, and return it. */
	readonly ensureCache: Effect.Effect<string, AppDirsError>;
	/** Create the state directory if it does not exist, and return it. */
	readonly ensureState: Effect.Effect<string, AppDirsError>;
	/**
	 * Create the runtime directory if there is one, and return it.
	 *
	 * @remarks
	 * `Option.none()` when no runtime directory is configured — nothing is created
	 * and nothing fails.
	 */
	readonly ensureRuntime: Effect.Effect<O.Option<string>, AppDirsError>;
	/** Create every directory that exists in the resolution, and return them all. */
	readonly ensure: Effect.Effect<ResolvedAppDirs, AppDirsError>;
}

/**
 * Resolve one directory kind through the five-level precedence.
 *
 * 1. an explicit `dirs.<kind>` override;
 * 2. the XDG environment variable, namespaced (`$XDG_CONFIG_HOME/<ns>`);
 * 3. the native directory, when `native: true` and the platform has one;
 * 4. `$HOME/<fallbackDir>` — all four kinds collapse to the one directory;
 * 5. `$HOME/.<namespace>`.
 *
 * Rungs 4 and 5 are deliberately **not** the XDG spec's per-kind defaults
 * (`~/.config`, `~/.local/share`, …): a CLI wanting spec defaults passes them as
 * `dirs` overrides.
 */
const resolveDir = (input: {
	readonly override: string | undefined;
	readonly xdgHome: string | undefined;
	readonly native: O.Option<string>;
	readonly options: AppDirsOptions;
	readonly home: string;
	readonly path: Path.Path;
}): string => {
	const { override, xdgHome, native, options, home, path } = input;
	if (override !== undefined) return override;
	if (xdgHome !== undefined) return path.join(xdgHome, options.namespace);
	if (O.isSome(native)) return native.value;
	if (options.fallbackDir !== undefined) return path.join(home, options.fallbackDir);
	return path.join(home, `.${options.namespace}`);
};

/** The app's own directory, then each system directory, namespaced. Nearest first. */
const searchPath = (own: string, systemDirs: ReadonlyArray<string>, namespace: string, path: Path.Path) => [
	own,
	...systemDirs.map((dir) => path.join(dir, namespace)),
];

const resolveAll = (options: AppDirsOptions, paths: XdgPaths, platform: XdgPlatform, path: Path.Path) => {
	const native = options.native === true
		? NativeDirs.resolve({ platform, namespace: options.namespace, paths, path })
		: O.none<NativeDirs>();

	const forKind = (xdgHome: string | undefined, nativeDir: (n: NativeDirs) => string, override: string | undefined) =>
		resolveDir({
			override,
			xdgHome,
			native: O.map(native, nativeDir),
			options,
			home: paths.home,
			path,
		});

	const config = forKind(paths.configHome, (n) => n.config, options.dirs?.config);
	const data = forKind(paths.dataHome, (n) => n.data, options.dirs?.data);
	const cache = forKind(paths.cacheHome, (n) => n.cache, options.dirs?.cache);
	const state = forKind(paths.stateHome, (n) => n.state, options.dirs?.state);

	// The runtime directory has no fallback ladder: an override, or `$XDG_RUNTIME_DIR`
	// namespaced, or nothing at all.
	const runtime =
		options.dirs?.runtime ??
		(paths.runtimeDir !== undefined ? path.join(paths.runtimeDir, options.namespace) : undefined);

	return ResolvedAppDirs.make({
		config,
		data,
		cache,
		state,
		// A present key holding `undefined` is not an absent key — v4 constructors validate.
		...(runtime !== undefined && { runtime }),
		configSearchPath: searchPath(config, paths.configDirs, options.namespace, path),
		dataSearchPath: searchPath(data, paths.dataDirs, options.namespace, path),
	});
};

/**
 * A namespace is a single path component. Anything else escapes the app's own
 * directories, so it **dies** rather than resolving somewhere surprising. This
 * is wiring, not input: only code supplies a namespace, so a bad one is a
 * programmer error and belongs on the defect channel, not in `E`.
 */
const badNamespace = (namespace: string): AppDirsNamespaceError | undefined => {
	if (namespace.length === 0) {
		return AppDirsNamespaceError.make({ message: "AppDirs.layer: `namespace` must not be empty" });
	}
	if (/[/\\]/.test(namespace) || namespace === "." || namespace === "..") {
		return AppDirsNamespaceError.make({
			message: `AppDirs.layer: \`namespace\` must be a single path component, received ${JSON.stringify(namespace)}`,
		});
	}
	return undefined;
};

/**
 * App-namespaced XDG directories, with on-demand creation.
 *
 * @remarks
 * `AppDirs.layer` is a layer-**returning function**: calling it twice builds two
 * independent services. Bind its result to a const and provide that const, per
 * the layer memoization discipline.
 *
 * @example
 * ```ts
 * import { AppDirs, Xdg } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 *
 * // Bound once to a const, with the ambient `Xdg` environment provided and kept.
 * const AppDirsLive = Layer.provideMerge(AppDirs.layer({ namespace: "myapp", native: true }), Xdg.layer);
 *
 * const program = Effect.gen(function* () {
 * 	const appDirs = yield* AppDirs;
 * 	const configDir = yield* appDirs.ensureConfig;
 * 	console.log(configDir);
 * });
 * // Requires `FileSystem` and `Path` from the platform layer.
 * ```
 *
 * @public
 */
export class AppDirs extends Context.Service<AppDirs, AppDirsShape>()($I`AppDirs`) {
	/**
	 * Resolve the namespace's directories against the ambient {@link Xdg}
	 * environment and platform.
	 *
	 * @remarks
	 * The error channel is `never`. The one failure that could happen during
	 * resolution — an unset `HOME` — surfaces on {@link Xdg.layer} as an
	 * `XdgEnvError`, before an `AppDirs` exists at all.
	 */
	static layer(options: AppDirsOptions): Layer.Layer<AppDirs, never, Xdg | FileSystem.FileSystem | Path.Path> {
		return Layer.effect(
			AppDirs,
			Effect.gen(function* () {
				const invalid = badNamespace(options.namespace);
				if (invalid !== undefined) return yield* Effect.die(invalid);

				const paths = yield* Xdg;
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const platform = yield* CurrentPlatform;

				const dirs = resolveAll(options, paths, platform, path);

				const makeDir = (kind: AppDirKind, target: string): Effect.Effect<string, AppDirsError> =>
					fs.makeDirectory(target, { recursive: true }).pipe(
						Effect.mapError((cause) => AppDirsError.make({ directory: kind, path: target, cause })),
						Effect.as(target),
					);

				const runtimeDir = dirs.runtime;
				const ensureRuntime: Effect.Effect<O.Option<string>, AppDirsError> = (
					runtimeDir === undefined
						? Effect.succeed(O.none<string>())
						: Effect.asSome(makeDir("runtime", runtimeDir))
				).pipe(Effect.withSpan("AppDirs.ensureRuntime"));

				return {
					namespace: options.namespace,
					dirs,
					ensureConfig: makeDir("config", dirs.config).pipe(Effect.withSpan("AppDirs.ensureConfig")),
					ensureData: makeDir("data", dirs.data).pipe(Effect.withSpan("AppDirs.ensureData")),
					ensureCache: makeDir("cache", dirs.cache).pipe(Effect.withSpan("AppDirs.ensureCache")),
					ensureState: makeDir("state", dirs.state).pipe(Effect.withSpan("AppDirs.ensureState")),
					ensureRuntime,
					ensure: Effect.gen(function* () {
						yield* makeDir("config", dirs.config);
						yield* makeDir("data", dirs.data);
						yield* makeDir("cache", dirs.cache);
						yield* makeDir("state", dirs.state);
						if (dirs.runtime !== undefined) yield* makeDir("runtime", dirs.runtime);
						return dirs;
					}).pipe(Effect.withSpan("AppDirs.ensure")),
				} satisfies AppDirsShape;
			}),
		);
	}
}
