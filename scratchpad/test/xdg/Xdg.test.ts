// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Cause, ConfigProvider, Effect, Exit, Layer, Option } from "effect";
import { Xdg, XdgEnvError, XdgPaths } from "../../effected/xdg/index.ts";

/** Drive `Config` from a record instead of mutating the real environment. */
const env = (vars: Record<string, string>) =>
	Layer.provide(Xdg.layer, ConfigProvider.layer(ConfigProvider.fromUnknown(vars)));

describe("Xdg", () => {
	describe("layer", () => {
		it.effect("reads every XDG variable from the environment", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.strictEqual(paths.home, "/home/ada");
				assert.strictEqual(paths.configHome, "/home/ada/.config");
				assert.strictEqual(paths.dataHome, "/home/ada/.local/share");
				assert.strictEqual(paths.cacheHome, "/home/ada/.cache");
				assert.strictEqual(paths.stateHome, "/home/ada/.local/state");
				assert.strictEqual(paths.runtimeDir, "/run/user/1000");
				assert.strictEqual(paths.appData, "C:\\Users\\ada\\AppData\\Roaming");
				assert.strictEqual(paths.localAppData, "C:\\Users\\ada\\AppData\\Local");
			}).pipe(
				Effect.provide(
					env({
						HOME: "/home/ada",
						XDG_CONFIG_HOME: "/home/ada/.config",
						XDG_DATA_HOME: "/home/ada/.local/share",
						XDG_CACHE_HOME: "/home/ada/.cache",
						XDG_STATE_HOME: "/home/ada/.local/state",
						XDG_RUNTIME_DIR: "/run/user/1000",
						APPDATA: "C:\\Users\\ada\\AppData\\Roaming",
						LOCALAPPDATA: "C:\\Users\\ada\\AppData\\Local",
					}),
				),
			),
		);

		it.effect("leaves an unset variable as an absent key, not undefined", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.isFalse("configHome" in paths);
				assert.isFalse("runtimeDir" in paths);
				assert.isUndefined(paths.configHome);
			}).pipe(Effect.provide(env({ HOME: "/home/ada" }))),
		);

		it.effect("fails with XdgEnvError, not a raw ConfigError, when HOME is unset", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Effect.provide(Effect.void, env({})));
				assert.instanceOf(error, XdgEnvError);
				assert.strictEqual(error._tag, "XdgEnvError");
				assert.strictEqual(error.variable, "HOME");
				assert.include(error.message, "HOME");
				// The ConfigError is preserved structurally rather than stringified.
				assert.strictEqual((error.cause as { _tag?: string })._tag, "ConfigError");
			}),
		);

		it.effect("HOME being unset is a typed failure, never a defect", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.provide(Effect.void, env({})));
				const cause = Exit.getCause(exit);
				assert.isTrue(Option.isSome(cause));
				const reasons = Option.getOrThrow(cause).reasons;
				assert.isTrue(reasons.some(Cause.isFailReason));
				assert.isFalse(reasons.some(Cause.isDieReason));
			}),
		);
	});

	describe("search paths", () => {
		it.effect("splits XDG_CONFIG_DIRS and XDG_DATA_DIRS on the colon", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg", "/opt/xdg"]);
				assert.deepStrictEqual([...paths.dataDirs], ["/opt/share", "/usr/share"]);
			}).pipe(
				Effect.provide(
					env({
						HOME: "/home/ada",
						XDG_CONFIG_DIRS: "/etc/xdg:/opt/xdg",
						XDG_DATA_DIRS: "/opt/share:/usr/share",
					}),
				),
			),
		);

		it.effect("defaults the system search paths per the spec when unset", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg"]);
				assert.deepStrictEqual([...paths.dataDirs], ["/usr/local/share", "/usr/share"]);
			}).pipe(Effect.provide(env({ HOME: "/home/ada" }))),
		);

		it.effect("treats an EMPTY XDG_CONFIG_DIRS as unset, per the spec", () =>
			Effect.gen(function* () {
				// The spec is explicit: an empty value takes the default, it does not
				// mean "no system directories". A naive `split(":")` would yield [""].
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg"]);
			}).pipe(Effect.provide(env({ HOME: "/home/ada", XDG_CONFIG_DIRS: "" }))),
		);

		it.effect("drops empty entries from a partially-empty list", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/a", "/b"]);
			}).pipe(Effect.provide(env({ HOME: "/home/ada", XDG_CONFIG_DIRS: "/a::/b:" }))),
		);
	});

	describe("layerFrom", () => {
		it.effect("serves fixed paths without reading the environment at all", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.strictEqual(paths.home, "/fixture");
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg"]);
			}).pipe(
				Effect.provide(
					Xdg.layerFrom(XdgPaths.make({ home: "/fixture", configDirs: ["/etc/xdg"], dataDirs: ["/usr/share"] })),
				),
			),
		);
	});
});
