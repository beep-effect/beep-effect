import { assert, describe, layer } from "@effect/vitest";
import { Effect, Option, Path } from "effect";
import type { XdgPlatform } from "../../effected/xdg/index.ts";
import { NativeDirs, XdgPaths } from "../../effected/xdg/index.ts";

const paths = (overrides?: { readonly appData?: string; readonly localAppData?: string }) =>
	XdgPaths.make({
		home: "/home/ada",
		configDirs: ["/etc/xdg"],
		dataDirs: ["/usr/share"],
		...(overrides?.appData !== undefined && { appData: overrides.appData }),
		...(overrides?.localAppData !== undefined && { localAppData: overrides.localAppData }),
	});

/**
 * The whole platform matrix runs against a POSIX `Path` and a record — no real
 * platform, no filesystem, no `process.platform` stubbing. `NativeDirs.resolve`
 * is pure and takes the platform as a parameter, which is exactly what makes
 * this possible.
 */
describe("NativeDirs.resolve", () => {
	layer(Path.layer)((it) => {
		const resolve = Effect.fn("resolve")(function* (platform: XdgPlatform, xdg: XdgPaths = paths()) {
			const path = yield* Path.Path;
			return NativeDirs.resolve({ platform, namespace: "myapp", paths: xdg, path });
		});

		it.effect("maps darwin onto Application Support and Caches", () =>
			Effect.gen(function* () {
				const native = yield* resolve("darwin");
				assert.isTrue(Option.isSome(native));
				const dirs = Option.getOrThrow(native);
				assert.strictEqual(dirs.config, "/home/ada/Library/Application Support/myapp");
				assert.strictEqual(dirs.data, "/home/ada/Library/Application Support/myapp");
				assert.strictEqual(dirs.state, "/home/ada/Library/Application Support/myapp");
				// Cache is the one that does NOT collapse into Application Support.
				assert.strictEqual(dirs.cache, "/home/ada/Library/Caches/myapp");
			}),
		);

		it.effect("maps win32 onto APPDATA and LOCALAPPDATA when both are set", () =>
			Effect.gen(function* () {
				const native = yield* resolve("win32", paths({ appData: "/R", localAppData: "/L" }));
				const dirs = Option.getOrThrow(native);
				assert.strictEqual(dirs.config, "/R/myapp");
				assert.strictEqual(dirs.data, "/R/myapp");
				assert.strictEqual(dirs.cache, "/L/myapp/Cache");
				assert.strictEqual(dirs.state, "/L/myapp");
			}),
		);

		it.effect("falls back to AppData/Roaming and AppData/Local when NEITHER var is set", () =>
			Effect.gen(function* () {
				const native = yield* resolve("win32");
				const dirs = Option.getOrThrow(native);
				assert.strictEqual(dirs.config, "/home/ada/AppData/Roaming/myapp");
				assert.strictEqual(dirs.cache, "/home/ada/AppData/Local/myapp/Cache");
				assert.strictEqual(dirs.state, "/home/ada/AppData/Local/myapp");
			}),
		);

		it.effect("falls back per-variable, not all-or-nothing", () =>
			Effect.gen(function* () {
				// LOCALAPPDATA set, APPDATA not: the roaming fallback must still apply
				// while the local one does not. An all-or-nothing branch passes the two
				// tests above and fails this one.
				const native = yield* resolve("win32", paths({ localAppData: "/L" }));
				const dirs = Option.getOrThrow(native);
				assert.strictEqual(dirs.config, "/home/ada/AppData/Roaming/myapp");
				assert.strictEqual(dirs.cache, "/L/myapp/Cache");
			}),
		);

		it.effect("has no native mapping on linux — XDG is the native convention there", () =>
			Effect.gen(function* () {
				assert.isTrue(Option.isNone(yield* resolve("linux")));
			}),
		);

		it.effect("has no native mapping on other unix platforms", () =>
			Effect.gen(function* () {
				assert.isTrue(Option.isNone(yield* resolve("freebsd")));
				assert.isTrue(Option.isNone(yield* resolve("openbsd")));
				assert.isTrue(Option.isNone(yield* resolve("sunos")));
			}),
		);
	});
});
