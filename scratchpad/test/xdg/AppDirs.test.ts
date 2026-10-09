import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertNone } from "@effect/vitest/utils";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { AppDirOverrides, AppDirsNamespaceError, AppDirsOptions } from "../../effected/xdg/AppDirs.ts";
import type { XdgPlatform } from "../../effected/xdg/index.ts";
import { AppDirKind, AppDirs, AppDirsError, CurrentPlatform, Xdg, XdgPaths } from "../../effected/xdg/index.ts";

/** Build the fixture graph in a scope that owns its acquired resources. */
const provideLayer = <ROut, E, RIn>(layer: Layer.Layer<ROut, E, RIn>) =>
	<A, E2, R>(self: Effect.Effect<A, E2, R>) =>
		Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(self, context)),
		);

const xdgPaths = (overrides: Partial<Omit<XdgPaths, "configDirs" | "dataDirs">> = {}) =>
	XdgPaths.make({
		home: "/home/ada",
		configDirs: ["/etc/xdg"],
		dataDirs: ["/usr/share"],
		...overrides,
	});

/**
 * Records every `makeDirectory` call, in order, over a real in-memory volume.
 *
 * A fault handler runs when the method is CALLED, not when the layer is built,
 * which is the property that matters here: `AppDirs` constructs its `ensure*`
 * effects once at layer construction, so anything recording eagerly would count
 * four directories that were never created and every assertion would be
 * measuring construction rather than execution.
 *
 * Returning `undefined` delegates, so the directory is genuinely created rather
 * than merely observed — and unlike `layerNoop`, every method this fixture does
 * not name still works instead of failing as unimplemented.
 */
const recordingFs = (made: Array<string>, failOn?: string) =>
	MemoryFileSystem.layerWith(
		{},
		{
			faults: {
				makeDirectory: (dir) => {
					if (failOn !== undefined && dir === failOn) {
						return Effect.fail(
							PlatformError.systemError({
								_tag: "PermissionDenied",
								module: "FileSystem",
								method: "makeDirectory",
								pathOrDescriptor: dir,
							}),
						);
					}
					made.push(dir);
					return undefined; // delegate: the volume really creates it
				},
			},
		},
	);

const base = Layer.mergeAll(Path.layer, recordingFs([]));

/** Resolve `AppDirs` against fixed paths and a fixed platform. No IO. */
const resolved = (options: AppDirsOptions, paths: XdgPaths, platform: XdgPlatform = "linux") =>
	Effect.gen(function* () {
		const appDirs = yield* AppDirs;
		return appDirs.dirs;
	}).pipe(
		provideLayer(
			AppDirs.layer(options).pipe(
				Layer.provide(Xdg.layerFrom(paths)),
				Layer.provide(base),
			),
		),
		Effect.provideService(CurrentPlatform, platform),
	);

describe("AppDirs", () => {
	it.effect("keeps the annotated AppDirKind literal kit surface", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(AppDirKind.literals, ["config", "data", "cache", "state", "runtime"]);
			for (const kind of AppDirKind.literals) {
				assert.strictEqual(AppDirKind.Enum[kind], kind);
				assert.isTrue(AppDirKind.is[kind](kind));
				assert.isTrue(S.is(AppDirKind)(kind));
			}
			assert.isFalse(AppDirKind.is.config("cache"));
			assert.isFalse(S.is(AppDirKind)("other"));
			assert.deepStrictEqual(AppDirKind.pick(["config", "runtime"]).literals, ["config", "runtime"]);
			assert.strictEqual(AppDirKind.mapMembers((members) => members).members.length, 5);
			assert.strictEqual(AppDirKind.$match("cache", {
				config: () => "config", data: () => "data", cache: () => "selected",
				state: () => "state", runtime: () => "runtime",
			}), "selected");
			const DirectoryEvent = AppDirKind.toTaggedUnion("kind")({
				config: {}, data: {}, cache: {}, state: {}, runtime: {},
			});
			assert.isTrue(S.is(DirectoryEvent)({ kind: "config" }));
			assert.isFalse(S.is(DirectoryEvent)({ kind: "other" }));
			assert.strictEqual(yield* S.decodeEffect(AppDirKind)("cache"), "cache");
		}),
	);

	describe("input schemas", () => {
		it.effect("preserves absent optional keys and accepts plain object options", () =>
			Effect.gen(function* () {
				const overrides = yield* S.decodeEffect(AppDirOverrides)({});
				assert.deepStrictEqual(overrides, {});
				for (const kind of AppDirKind.literals) assert.isFalse(kind in overrides);
				const options = yield* S.decodeEffect(AppDirsOptions)({ namespace: "myapp" });
				assert.deepStrictEqual(options, { namespace: "myapp" });
				assert.isFalse("native" in options);
				assert.isFalse("fallbackDir" in options);
				assert.isFalse("dirs" in options);
				const dirs = yield* resolved(options, xdgPaths());
				assert.strictEqual(dirs.config, "/home/ada/.myapp");
			}),
		);

		it.effect("decodes every optional input field without changing its value", () =>
			Effect.gen(function* () {
				const input = {
					namespace: "myapp", native: true, fallbackDir: ".fallback",
					dirs: { config: "/c", data: "/d", cache: "/ca", state: "/s", runtime: "/r" },
				};
				assert.deepStrictEqual(yield* S.decodeEffect(AppDirsOptions)(input), input);
				assert.deepStrictEqual(yield* S.decodeEffect(AppDirOverrides)(input.dirs), input.dirs);
			}),
		);

		it.effect("owns field types while namespace rejection stays at layer construction", () =>
			Effect.gen(function* () {
				assert.isFalse(S.is(AppDirsOptions)({}));
				assert.isFalse(S.is(AppDirsOptions)({ namespace: 1 }));
				assert.isFalse(S.is(AppDirsOptions)({ namespace: "myapp", native: "true" }));
				assert.isFalse(S.is(AppDirsOptions)({ namespace: "myapp", fallbackDir: 1 }));
				assert.isFalse(S.is(AppDirsOptions)({ namespace: "myapp", dirs: { config: 1 } }));
				assert.isFalse(S.is(AppDirsOptions)({ namespace: "myapp", native: undefined }));
				for (const kind of AppDirKind.literals) {
					assert.isFalse(S.is(AppDirOverrides)({ [kind]: 1 }));
					assert.isFalse(S.is(AppDirOverrides)({ [kind]: undefined }));
				}
				assert.isTrue(S.is(AppDirsOptions)({ namespace: "" }));
				assert.isTrue(S.is(AppDirsOptions)({ namespace: "my/app" }));
				assert.isTrue(S.is(AppDirsOptions)({ namespace: "myapp", native: false }));
			}),
		);
	});

	it.effect("empty environment bases follow the absent-key ladder without relative directories", () =>
		Effect.gen(function* () {
			const environment = Layer.provide(Xdg.layer, ConfigProvider.layer(ConfigProvider.fromUnknown({
				HOME: "/home/ada", XDG_CONFIG_HOME: "", XDG_DATA_HOME: "", XDG_CACHE_HOME: "",
				XDG_STATE_HOME: "", XDG_RUNTIME_DIR: "", APPDATA: "", LOCALAPPDATA: "",
			})));
			const appLayer = Layer.provide(AppDirs.layer({ namespace: "myapp" }), Layer.mergeAll(environment, base));
			const dirs = yield* Effect.map(AppDirs, (app) => app.dirs).pipe(provideLayer(appLayer));
			assert.strictEqual(dirs.config, "/home/ada/.myapp");
			assert.strictEqual(dirs.data, "/home/ada/.myapp");
			assert.strictEqual(dirs.cache, "/home/ada/.myapp");
			assert.strictEqual(dirs.state, "/home/ada/.myapp");
			assert.isFalse("runtime" in dirs);
			assert.deepStrictEqual(dirs.configSearchPath, ["/home/ada/.myapp", "/etc/xdg/myapp"]);
			assert.deepStrictEqual(dirs.dataSearchPath, ["/home/ada/.myapp", "/usr/local/share/myapp", "/usr/share/myapp"]);
			const nativeLayer = Layer.provide(AppDirs.layer({ namespace: "myapp", native: true }), Layer.mergeAll(environment, base));
			const nativeDirs = yield* Effect.map(AppDirs, (app) => app.dirs).pipe(
				provideLayer(nativeLayer), Effect.provideService(CurrentPlatform, "darwin"),
			);
			assert.strictEqual(nativeDirs.config, "/home/ada/Library/Application Support/myapp");
			assert.strictEqual(nativeDirs.cache, "/home/ada/Library/Caches/myapp");
			assert.isFalse("runtime" in nativeDirs);
		}),
	);

	it.effect("preserves the AppDirsError cause stack across encoding and decoding", () =>
		Effect.gen(function* () {
			const cause = new Error("mkdir denied");
			cause.stack = "Error: mkdir denied\n    at mkdir (app-dirs-fixture.ts:24:5)";
			const error = AppDirsError.make({ directory: "cache", path: "/denied", cause });
			assert.strictEqual(error.cause, cause);
			const encoded = yield* S.encodeEffect(AppDirsError)(error);
			assert(P.hasProperty(encoded.cause, "stack"));
			assert.strictEqual(encoded.cause.stack, cause.stack);
			assert.strictEqual(encoded._tag, "AppDirsError");
			const decoded = yield* S.decodeEffect(AppDirsError)(encoded);
			assert.instanceOf(decoded, AppDirsError);
			assert.strictEqual(decoded._tag, error._tag);
			assert.strictEqual(decoded.directory, error.directory);
			assert.strictEqual(decoded.path, error.path);
			assert.strictEqual(decoded.message, error.message);
			assert.instanceOf(decoded.cause, Error);
			assert(P.hasProperty(decoded.cause, "stack"));
			assert.strictEqual(decoded.cause.stack, cause.stack);
			assert(P.hasProperty(decoded.cause, "message"));
			assert.strictEqual(decoded.cause.message, cause.message);
		}),
	);

	describe("the five-level precedence", () => {
		// Each rung is tested with every HIGHER rung absent and every LOWER rung
		// PRESENT, so a rung that silently stopped doing anything would be caught by
		// the value falling through to the rung below it.

		it.effect("1. an explicit override beats everything below it", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved(
					{
						namespace: "myapp",
						native: true,
						fallbackDir: ".myapp",
						dirs: { config: "/explicit" },
					},
					xdgPaths({ configHome: "/xdg", dataHome: "/xdg-data" }),
					"darwin",
				);
				assert.strictEqual(dirs.config, "/explicit");
				// Only `config` was overridden; `data` still falls through the ladder to
				// its own XDG variable. An override that leaked across kinds fails here.
				assert.strictEqual(dirs.data, "/xdg-data/myapp");
			}),
		);

		it.effect("2. the XDG variable beats the native dir, the fallback and the dot-dir", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved(
					{ namespace: "myapp", native: true, fallbackDir: ".myapp" },
					xdgPaths({ configHome: "/xdg" }),
					"darwin",
				);
				assert.strictEqual(dirs.config, "/xdg/myapp");
			}),
		);

		it.effect("3. the native dir beats the fallback and the dot-dir", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp", native: true, fallbackDir: ".myapp" }, xdgPaths(), "darwin");
				assert.strictEqual(dirs.config, "/home/ada/Library/Application Support/myapp");
				assert.strictEqual(dirs.cache, "/home/ada/Library/Caches/myapp");
			}),
		);

		it.effect("3b. native: false skips the native rung even on darwin", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp", fallbackDir: ".myapp" }, xdgPaths(), "darwin");
				assert.strictEqual(dirs.config, "/home/ada/.myapp");
			}),
		);

		it.effect("3c. native: true on linux skips the rung rather than shadowing the one below", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp", native: true, fallbackDir: ".myapp" }, xdgPaths(), "linux");
				assert.strictEqual(dirs.config, "/home/ada/.myapp");
			}),
		);

		it.effect("4. the fallback dir beats the dot-dir, and all four kinds collapse to it", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp", fallbackDir: ".myapp" }, xdgPaths());
				assert.strictEqual(dirs.config, "/home/ada/.myapp");
				assert.strictEqual(dirs.data, "/home/ada/.myapp");
				assert.strictEqual(dirs.cache, "/home/ada/.myapp");
				assert.strictEqual(dirs.state, "/home/ada/.myapp");
			}),
		);

		it.effect("5. $HOME/.<namespace> is the floor", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp" }, xdgPaths());
				assert.strictEqual(dirs.config, "/home/ada/.myapp");
				assert.strictEqual(dirs.state, "/home/ada/.myapp");
			}),
		);

		it.effect("resolves each kind from its OWN xdg variable, not a shared one", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved(
					{ namespace: "myapp" },
					xdgPaths({
						configHome: "/c",
						dataHome: "/d",
						cacheHome: "/ca",
						stateHome: "/s",
					}),
				);
				assert.strictEqual(dirs.config, "/c/myapp");
				assert.strictEqual(dirs.data, "/d/myapp");
				assert.strictEqual(dirs.cache, "/ca/myapp");
				assert.strictEqual(dirs.state, "/s/myapp");
			}),
		);
	});

	describe("the runtime directory", () => {
		it.effect("is absent when XDG_RUNTIME_DIR is unset — there is no fallback", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp", fallbackDir: ".myapp" }, xdgPaths());
				assert.isUndefined(dirs.runtime);
			}),
		);

		it.effect("is namespaced under XDG_RUNTIME_DIR when set", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp" }, xdgPaths({ runtimeDir: "/run/user/1000" }));
				assert.strictEqual(dirs.runtime, "/run/user/1000/myapp");
			}),
		);

		it.effect("takes an explicit override over the environment", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved(
					{ namespace: "myapp", dirs: { runtime: "/tmp/rt" } },
					xdgPaths({ runtimeDir: "/run/user/1000" }),
				);
				assert.strictEqual(dirs.runtime, "/tmp/rt");
			}),
		);
	});

	describe("the search paths", () => {
		it.effect("puts the app's own directory first, then each system dir namespaced", () =>
			Effect.gen(function* () {
				const paths = XdgPaths.make({
					home: "/home/ada",
					configHome: "/home/ada/.config",
					configDirs: ["/a", "/b"],
					dataDirs: ["/da", "/db"],
				});
				const dirs = yield* resolved({ namespace: "myapp" }, paths);
				assert.deepStrictEqual([...dirs.configSearchPath], ["/home/ada/.config/myapp", "/a/myapp", "/b/myapp"]);
				// `data` has no XDG_DATA_HOME here, so it falls to the dot-dir floor —
				// and the search path still leads with it, then the system data dirs.
				assert.deepStrictEqual([...dirs.dataSearchPath], ["/home/ada/.myapp", "/da/myapp", "/db/myapp"]);
			}),
		);

		it.effect("preserves the ORDER of XDG_CONFIG_DIRS — earlier entries win", () =>
			Effect.gen(function* () {
				const dirs = yield* resolved({ namespace: "myapp" }, xdgPaths({ configHome: "/c" }));
				assert.strictEqual(dirs.configSearchPath[0], "/c/myapp");
				assert.strictEqual(dirs.configSearchPath[1], "/etc/xdg/myapp");
			}),
		);
	});

	describe("ensure", () => {
		it.effect("creates the config directory and returns it", () =>
			Effect.gen(function* () {
				const made: Array<string> = [];
				const created = yield* Effect.gen(function* () {
					const appDirs = yield* AppDirs;
					return yield* appDirs.ensureConfig;
				}).pipe(
					provideLayer(
						AppDirs.layer({ namespace: "myapp" }).pipe(
							Layer.provide(Xdg.layerFrom(xdgPaths())),
							Layer.provide(Layer.mergeAll(Path.layer, recordingFs(made))),
						),
					),
				);
				assert.strictEqual(created, "/home/ada/.myapp");
				assert.deepStrictEqual(made, ["/home/ada/.myapp"]);
			}),
		);

		it.effect("ensure creates every resolved directory, and skips the absent runtime dir", () =>
			Effect.gen(function* () {
				const made: Array<string> = [];
				const dirs = yield* Effect.gen(function* () {
					const appDirs = yield* AppDirs;
					return yield* appDirs.ensure;
				}).pipe(
					provideLayer(
						AppDirs.layer({
							namespace: "myapp",
							dirs: { config: "/c", data: "/d", cache: "/ca", state: "/s" },
						}).pipe(
							Layer.provide(Xdg.layerFrom(xdgPaths())),
							Layer.provide(Layer.mergeAll(Path.layer, recordingFs(made))),
						),
					),
				);
				assert.deepStrictEqual(made, ["/c", "/d", "/ca", "/s"]);
				assert.strictEqual(dirs.config, "/c");
			}),
		);

		it.effect("ensure creates the runtime directory when there IS one", () =>
			Effect.gen(function* () {
				const made: Array<string> = [];
				yield* Effect.gen(function* () {
					const appDirs = yield* AppDirs;
					return yield* appDirs.ensure;
				}).pipe(
					provideLayer(
						AppDirs.layer({ namespace: "myapp" }).pipe(
							Layer.provide(Xdg.layerFrom(xdgPaths({ runtimeDir: "/run" }))),
							Layer.provide(Layer.mergeAll(Path.layer, recordingFs(made))),
						),
					),
				);
				assert.include(made, "/run/myapp");
			}),
		);

		it.effect("ensureRuntime is None — and creates nothing — when there is no runtime dir", () =>
			Effect.gen(function* () {
				const made: Array<string> = [];
				const runtime = yield* Effect.gen(function* () {
					const appDirs = yield* AppDirs;
					return yield* appDirs.ensureRuntime;
				}).pipe(
					provideLayer(
						AppDirs.layer({ namespace: "myapp" }).pipe(
							Layer.provide(Xdg.layerFrom(xdgPaths())),
							Layer.provide(Layer.mergeAll(Path.layer, recordingFs(made))),
						),
					),
				);
				assertNone(runtime);
				assert.deepStrictEqual(made, []);
			}),
		);

		it.effect("maps a mkdir failure to AppDirsError with the right kind and path", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(
					Effect.gen(function* () {
						const appDirs = yield* AppDirs;
						return yield* appDirs.ensureCache;
					}).pipe(
						provideLayer(
							AppDirs.layer({ namespace: "myapp", dirs: { cache: "/denied" } }).pipe(
								Layer.provide(Xdg.layerFrom(xdgPaths())),
								Layer.provide(Layer.mergeAll(Path.layer, recordingFs([], "/denied"))),
							),
						),
					),
				);
				assert.instanceOf(error, AppDirsError);
				assert.strictEqual(error._tag, "AppDirsError");
				assert.strictEqual(error.directory, "cache");
				assert.strictEqual(error.path, "/denied");
				// The underlying failure is preserved, not stringified.
				assert.instanceOf(error.cause, Error);
			}),
		);
	});

	describe("the namespace guard", () => {
		const build = (namespace: string) =>
			AppDirs.pipe(
				provideLayer(
					AppDirs.layer({ namespace }).pipe(Layer.provide(Xdg.layerFrom(xdgPaths())), Layer.provide(base)),
				),
			);

		const assertDefect = (name: string, namespace: string) =>
			it.effect(name, () =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(build(namespace));
					assertExitFailure(exit, exit.pipe(Exit.getCause, O.getOrThrow));
					const reasons = exit.cause.reasons;
					// The discriminating assertion: it is a DEFECT, not laundered into E.
					// Without this line, an implementation that raised a typed error would
					// still pass every other assertion here.
					assert.isFalse(reasons.some(Cause.isFailReason));
					const die = reasons.find(Cause.isDieReason);
					assert.instanceOf(die?.defect, AppDirsNamespaceError);
				}),
			);

		assertDefect("an empty namespace dies", "");
		assertDefect("a namespace with a forward slash dies", "my/app");
		assertDefect("a namespace with a backslash dies", "my\\app");
		assertDefect("a traversal namespace dies", "..");

		assertDefect("a current-directory namespace dies", ".");

		it.effect("schema guards preserve namespace messages and control-character boundaries", () =>
			Effect.gen(function* () {
				const emptyExit = yield* Effect.exit(build(""));
				const emptyCause = emptyExit.pipe(Exit.getCause, O.getOrThrow);
				const emptyDefect = emptyCause.reasons.find(Cause.isDieReason)?.defect;
				assert(S.is(AppDirsNamespaceError)(emptyDefect));
				assert.strictEqual(emptyDefect.message, "AppDirs.layer: `namespace` must not be empty");
				const componentExit = yield* Effect.exit(build("my\\app"));
				const componentCause = componentExit.pipe(Exit.getCause, O.getOrThrow);
				const componentDefect = componentCause.reasons.find(Cause.isDieReason)?.defect;
				assert(S.is(AppDirsNamespaceError)(componentDefect));
				assert.strictEqual(componentDefect.message,
					'AppDirs.layer: `namespace` must be a single path component, received "my\\\\app"');
				for (const namespace of [" ", ".\n", "..\n"]) {
					const appDirs = yield* build(namespace);
					assert.strictEqual(appDirs.namespace, namespace);
				}
			}),
		);

		it.effect("a plain namespace builds fine", () =>
			Effect.gen(function* () {
				const appDirs = yield* build("my-app.v2");
				assert.strictEqual(appDirs.namespace, "my-app.v2");
				assert.strictEqual(appDirs.dirs.config, "/home/ada/.my-app.v2");
			}),
		);
	});
});
