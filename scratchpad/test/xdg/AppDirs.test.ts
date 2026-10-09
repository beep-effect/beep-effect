// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { AppDirsNamespaceError } from "../../effected/xdg/AppDirs.ts";
import type { AppDirsOptions, XdgPlatform } from "../../effected/xdg/index.ts";
import { AppDirs, AppDirsError, CurrentPlatform, Xdg, XdgPaths } from "../../effected/xdg/index.ts";

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
		Effect.provide(
			AppDirs.layer(options).pipe(
				Layer.provide(Xdg.layerFrom(paths)),
				Layer.provide(base),
				Layer.provide(Layer.succeed(CurrentPlatform, platform)),
			),
		),
	);

describe("AppDirs", () => {
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
					Effect.provide(
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
					Effect.provide(
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
					Effect.provide(
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
					Effect.provide(
						AppDirs.layer({ namespace: "myapp" }).pipe(
							Layer.provide(Xdg.layerFrom(xdgPaths())),
							Layer.provide(Layer.mergeAll(Path.layer, recordingFs(made))),
						),
					),
				);
				assert.isTrue(O.isNone(runtime));
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
						Effect.provide(
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
				Effect.provide(
					AppDirs.layer({ namespace }).pipe(Layer.provide(Xdg.layerFrom(xdgPaths())), Layer.provide(base)),
				),
			);

		const assertDefect = (name: string, namespace: string) =>
			it.effect(name, () =>
				Effect.gen(function* () {
					const exit = yield* Effect.exit(build(namespace));
					const cause = Exit.getCause(exit);
					assert.isTrue(O.isSome(cause));
					const reasons = O.getOrThrow(cause).reasons;
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

		it.effect("a plain namespace builds fine", () =>
			Effect.gen(function* () {
				const appDirs = yield* build("my-app.v2");
				assert.strictEqual(appDirs.namespace, "my-app.v2");
				assert.strictEqual(appDirs.dirs.config, "/home/ada/.my-app.v2");
			}),
		);
	});
});
