import { Config, Context, Effect, Layer, Option, Schema } from "effect";

/**
 * The operating system the path decisions are taken against.
 *
 * @remarks
 * The members are Node's `process.platform` values, modeled as a schema rather
 * than borrowed from the ambient `NodeJS.Platform` type so the package's public
 * surface names nothing it does not own.
 *
 * @public
 */
export const XdgPlatform = Schema.Literals([
	"aix",
	"android",
	"darwin",
	"freebsd",
	"haiku",
	"linux",
	"openbsd",
	"sunos",
	"win32",
	"cygwin",
	"netbsd",
]);

/**
 * The decoded form of {@link (XdgPlatform:variable)}.
 *
 * @public
 */
export type XdgPlatform = typeof XdgPlatform.Type;

const detectPlatform = (): XdgPlatform => {
	const platform = globalThis.process?.platform;
	// A platform Node does not report — or no `process` at all, as in a browser
	// or a worker — behaves as Linux: XDG is the convention, no native override.
	return Schema.is(XdgPlatform)(platform) ? platform : "linux";
};

/**
 * The platform every native-directory decision is taken against.
 *
 * @remarks
 * A `Context.Reference`, not a global read. It
 * defaults to `process.platform`, so production behaviour is what you expect;
 * a test pins macOS or Windows semantics with
 * `Layer.succeed(CurrentPlatform, "win32")` and exercises the whole native-path
 * matrix without touching a real filesystem or the real platform.
 *
 * @public
 */
export const CurrentPlatform: Context.Reference<XdgPlatform> = Context.Reference<XdgPlatform>(
	"@effected/xdg/CurrentPlatform",
	{ defaultValue: detectPlatform },
);

/**
 * Indicates that the environment cannot satisfy XDG directory resolution.
 *
 * @remarks
 * Raised only for `HOME`: every other XDG variable is optional by construction,
 * and its absence is a resolved default rather than a failure. `cause` carries
 * the underlying `ConfigError` structurally.
 *
 * @public
 */
export class XdgEnvError extends Schema.TaggedError<XdgEnvError>()("XdgEnvError", {
	/** The environment variable that was required and not found. */
	variable: Schema.String,
	/** The underlying failure, preserved structurally. */
	cause: Schema.Defect(),
}) {
	override get message(): string {
		return `The ${this.variable} environment variable is not set`;
	}
}

/**
 * The XDG Base Directory environment, resolved.
 *
 * @remarks
 * Every field but `home` is optional because the corresponding variable is:
 * `Schema.optionalKey`, so an unset variable is an **absent key** and the read
 * is `paths.configHome ?? fallback`.
 *
 * `configDirs` and `dataDirs` are the colon-separated system search paths, split
 * and defaulted per the spec (`/etc/xdg` and `/usr/local/share:/usr/share`).
 * They are what make a config lookup a genuine ordered search rather than a
 * single stat.
 *
 * @public
 */
export class XdgPaths extends Schema.Class<XdgPaths>("XdgPaths")({
	/** `$HOME`. The one variable that must be set. */
	home: Schema.String,
	/** `$XDG_CONFIG_HOME`. */
	configHome: Schema.optionalKey(Schema.String),
	/** `$XDG_DATA_HOME`. */
	dataHome: Schema.optionalKey(Schema.String),
	/** `$XDG_CACHE_HOME`. */
	cacheHome: Schema.optionalKey(Schema.String),
	/** `$XDG_STATE_HOME`. */
	stateHome: Schema.optionalKey(Schema.String),
	/** `$XDG_RUNTIME_DIR`. Absent on most non-Linux systems. */
	runtimeDir: Schema.optionalKey(Schema.String),
	/** `%APPDATA%`, on Windows. */
	appData: Schema.optionalKey(Schema.String),
	/** `%LOCALAPPDATA%`, on Windows. */
	localAppData: Schema.optionalKey(Schema.String),
	/** `$XDG_CONFIG_DIRS`, split on `:`. Defaults to `["/etc/xdg"]`. */
	configDirs: Schema.Array(Schema.String),
	/** `$XDG_DATA_DIRS`, split on `:`. Defaults to `["/usr/local/share", "/usr/share"]`. */
	dataDirs: Schema.Array(Schema.String),
}) {}

/**
 * Split a `PATH`-style variable, dropping empty entries.
 *
 * @remarks
 * Per the XDG spec, an unset **or empty** variable takes the default — so
 * `XDG_CONFIG_DIRS=""` is not "no system directories", it is `/etc/xdg`.
 */
const splitDirs = (raw: string | undefined, fallback: ReadonlyArray<string>): ReadonlyArray<string> => {
	if (raw === undefined) return fallback;
	const parts = raw.split(":").filter((entry) => entry.length > 0);
	return parts.length === 0 ? fallback : parts;
};

/**
 * XDG Base Directory environment resolution.
 *
 * @remarks
 * The service's shape **is** {@link XdgPaths}: the environment is read once, at
 * layer construction, and the service is the resolved value. `yield* Xdg` gives
 * you a record of strings, and the only failure — an unset `HOME` — happens
 * once, where the layer is built.
 *
 * @public
 */
export class Xdg extends Context.Service<Xdg, XdgPaths>()("@effected/xdg/Xdg") {
	/**
	 * Read the XDG environment through Effect's `Config`.
	 *
	 * @remarks
	 * Reads from the ambient `ConfigProvider`, which defaults to `process.env`.
	 * A test drives it with `ConfigProvider.layer(ConfigProvider.fromUnknown({…}))`
	 * and never mutates the real environment.
	 */
	static readonly layer: Layer.Layer<Xdg, XdgEnvError> = Layer.effect(
		Xdg,
		Effect.gen(function* () {
			/**
			 * `Config<T>` IS an `Effect<T, ConfigError>` in v4, so it pipes directly.
			 * Every `ConfigError` becomes an `XdgEnvError` naming the variable it came from.
			 */
			const asEnvError = <A>(name: string, config: Config.Config<A>): Effect.Effect<A, XdgEnvError> =>
				Effect.catchTag(config, "ConfigError", (cause) => Effect.fail(new XdgEnvError({ variable: name, cause })));

			const home = yield* asEnvError("HOME", Config.String("HOME"));

			/**
			 * An unset variable is `Option.none()`, not a failure. The residual
			 * `ConfigError` a `Config.option` can still raise is a *provider* failure
			 * (a `ConfigProvider` backed by a directory or a `.env` file that cannot be
			 * read), not a missing key — so it is mapped rather than swallowed.
			 */
			const read = (name: string): Effect.Effect<string | undefined, XdgEnvError> =>
				Effect.map(asEnvError(name, Config.option(Config.String(name))), Option.getOrUndefined<string>);

			const configHome = yield* read("XDG_CONFIG_HOME");
			const dataHome = yield* read("XDG_DATA_HOME");
			const cacheHome = yield* read("XDG_CACHE_HOME");
			const stateHome = yield* read("XDG_STATE_HOME");
			const runtimeDir = yield* read("XDG_RUNTIME_DIR");
			const appData = yield* read("APPDATA");
			const localAppData = yield* read("LOCALAPPDATA");
			const configDirs = yield* read("XDG_CONFIG_DIRS");
			const dataDirs = yield* read("XDG_DATA_DIRS");

			// A *present* key holding `undefined` is not the same as an absent key —
			// v4 constructors validate — so every optional field is conditionally spread.
			return XdgPaths.make({
				home,
				...(configHome !== undefined && { configHome }),
				...(dataHome !== undefined && { dataHome }),
				...(cacheHome !== undefined && { cacheHome }),
				...(stateHome !== undefined && { stateHome }),
				...(runtimeDir !== undefined && { runtimeDir }),
				...(appData !== undefined && { appData }),
				...(localAppData !== undefined && { localAppData }),
				configDirs: splitDirs(configDirs, ["/etc/xdg"]),
				dataDirs: splitDirs(dataDirs, ["/usr/local/share", "/usr/share"]),
			});
		}),
	);

	/**
	 * Serve fixed paths instead of reading the environment.
	 *
	 * @remarks
	 * The test layer, and the escape hatch for an application that resolves its
	 * environment some other way. It needs no filesystem.
	 *
	 * @example
	 * ```ts
	 * import { Xdg, XdgPaths } from "./index.ts";
	 *
	 * const TestXdg = Xdg.layerFrom(
	 * 	XdgPaths.make({
	 * 		home: "/home/test",
	 * 		configHome: "/home/test/.config",
	 * 		configDirs: ["/etc/xdg"],
	 * 		dataDirs: ["/usr/local/share", "/usr/share"],
	 * 	}),
	 * );
	 * ```
	 */
	static layerFrom(paths: XdgPaths): Layer.Layer<Xdg> {
		return Layer.succeed(Xdg, paths);
	}
}
