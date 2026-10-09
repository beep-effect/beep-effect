import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effected/xdg/Xdg");

/**
 * The operating system the path decisions are taken against.
 *
 * **Details**
 *
 * The members are Node's `process.platform` values, modeled as a schema rather
 * than borrowed from the ambient `NodeJS.Platform` type so the package's public
 * surface names nothing it does not own.
 *
 * @public
 */
export const XdgPlatform = LiteralKit([
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
]).annotate($I.annote("XdgPlatform", { description: "The operating system the path decisions are taken against." }));

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
	return S.is(XdgPlatform)(platform) ? platform : "linux";
};

/**
 * The platform every native-directory decision is taken against.
 *
 * **Details**
 *
 * A `Context.Reference`, not a global read. It
 * defaults to `process.platform`, so production behaviour is what you expect;
 * a test pins macOS or Windows semantics with
 * `Layer.succeed(CurrentPlatform, "win32")` and exercises the whole native-path
 * matrix without touching a real filesystem or the real platform.
 *
 * @public
 */
export const CurrentPlatform: Context.Reference<XdgPlatform> = Context.Reference<XdgPlatform>(
	$I`CurrentPlatform`,
	{ defaultValue: detectPlatform },
);

/**
 * Indicates that the environment cannot satisfy XDG directory resolution.
 *
 * **Details**
 *
 * Raised only for `HOME`: every other XDG variable is optional by construction,
 * and its absence is a resolved default rather than a failure. `cause` carries
 * the underlying `ConfigError` structurally.
 *
 * @public
 */
export class XdgEnvError extends S.TaggedError<XdgEnvError>($I`XdgEnvError`)("XdgEnvError", {
	/** The environment variable that was required and not found. */
	variable: S.String.annotateKey({ description: "The environment variable that was required and not found." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect({ includeStack: true }).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("XdgEnvError", { description: "Indicates that the environment cannot satisfy XDG directory resolution." })) {
	override get message(): string {
		return `The ${this.variable} environment variable is not set`;
	}
}

/**
 * The XDG Base Directory environment, resolved.
 *
 * **Details**
 *
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
export class XdgPaths extends S.Class<XdgPaths>($I`XdgPaths`)({
	/** `$HOME`. The one variable that must be set. */
	home: S.String.annotateKey({ description: "`$HOME`. The one variable that must be set." }),
	/** `$XDG_CONFIG_HOME`. */
	configHome: S.optionalKey(S.String).annotateKey({ description: "`$XDG_CONFIG_HOME`." }),
	/** `$XDG_DATA_HOME`. */
	dataHome: S.optionalKey(S.String).annotateKey({ description: "`$XDG_DATA_HOME`." }),
	/** `$XDG_CACHE_HOME`. */
	cacheHome: S.optionalKey(S.String).annotateKey({ description: "`$XDG_CACHE_HOME`." }),
	/** `$XDG_STATE_HOME`. */
	stateHome: S.optionalKey(S.String).annotateKey({ description: "`$XDG_STATE_HOME`." }),
	/** `$XDG_RUNTIME_DIR`. Absent on most non-Linux systems. */
	runtimeDir: S.optionalKey(S.String).annotateKey({ description: "`$XDG_RUNTIME_DIR`. Absent on most non-Linux systems." }),
	/** `%APPDATA%`, on Windows. */
	appData: S.optionalKey(S.String).annotateKey({ description: "`%APPDATA%`, on Windows." }),
	/** `%LOCALAPPDATA%`, on Windows. */
	localAppData: S.optionalKey(S.String).annotateKey({ description: "`%LOCALAPPDATA%`, on Windows." }),
	/** `$XDG_CONFIG_DIRS`, split on `:`. Defaults to `["/etc/xdg"]`. */
	configDirs: S.Array(S.String).annotateKey({ description: "`$XDG_CONFIG_DIRS`, split on `:`. Defaults to `[\"/etc/xdg\"]`." }),
	/** `$XDG_DATA_DIRS`, split on `:`. Defaults to `["/usr/local/share", "/usr/share"]`. */
	dataDirs: S.Array(S.String).annotateKey({ description: "`$XDG_DATA_DIRS`, split on `:`. Defaults to `[\"/usr/local/share\", \"/usr/share\"]`." }),
}, $I.annote("XdgPaths", { description: "The XDG Base Directory environment, resolved." })) {}

/**
 * Split a `PATH`-style variable, dropping empty entries.
 *
 * **Gotchas**
 *
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
 * **Details**
 *
 * The service's shape **is** {@link XdgPaths}: the environment is read once, at
 * layer construction, and the service is the resolved value. `yield* Xdg` gives
 * you a record of strings, and the only failure — an unset `HOME` — happens
 * once, where the layer is built.
 *
 * @public
 */
export class Xdg extends Context.Service<Xdg, XdgPaths>()($I`Xdg`) {
	/**
  * Read the XDG environment through Effect's `Config`.
  *
  * **Details**
  *
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
				Effect.catchTag(config, "ConfigError", (cause) => Effect.fail(XdgEnvError.make({ variable: name, cause })));

			const home = yield* asEnvError("HOME", Config.NonEmptyString("HOME"));

			/**
			 * An unset variable is `Option.none()`, not a failure. The residual
			 * `ConfigError` a `Config.option` can still raise is a *provider* failure
			 * (a `ConfigProvider` backed by a directory or a `.env` file that cannot be
			 * read), not a missing key — so it is mapped rather than swallowed.
			 */
			const read = (name: string): Effect.Effect<string | undefined, XdgEnvError> =>
				Effect.map(
					asEnvError(name, Config.option(Config.String(name))),
					(option) => O.getOrUndefined(O.filter(option, Str.isNonEmpty)),
				);

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
  * **Details**
  *
  * The test layer, and the escape hatch for an application that resolves its
  * environment some other way. It needs no filesystem.
  *
  * **Example** (Provide fixed XDG paths for tests)
  *
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
