import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Xdg, XdgEnvError, XdgPaths, XdgPlatform } from "../../effected/xdg/index.ts";

/** Build the fixture graph in a scope that owns its acquired resources. */
const provideLayer = <ROut, E, RIn>(layer: Layer.Layer<ROut, E, RIn>) =>
	<A, E2, R>(self: Effect.Effect<A, E2, R>) =>
		Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(self, context)),
		);

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
				provideLayer(
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
			}).pipe(provideLayer(env({ HOME: "/home/ada" }))),
		);

		it.effect("fails with XdgEnvError, not a raw ConfigError, when HOME is unset", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Effect.void.pipe(provideLayer(env({}))));
				assert.instanceOf(error, XdgEnvError);
				assert.strictEqual(error._tag, "XdgEnvError");
				assert.strictEqual(error.variable, "HOME");
				assert.include(error.message, "HOME");
				// The ConfigError is preserved structurally rather than stringified.
				const cause = error.cause;
				assert(P.hasProperty(cause, "_tag"));
				assert.strictEqual(cause._tag, "ConfigError");
			}),
		);

		it.effect("HOME being unset is a typed failure, never a defect", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.void.pipe(provideLayer(env({}))));
				const cause = Exit.getCause(exit);
				assert.isTrue(O.isSome(cause));
				const reasons = O.getOrThrow(cause).reasons;
				assert.isTrue(reasons.some(Cause.isFailReason));
				assert.isFalse(reasons.some(Cause.isDieReason));
			}),
		);
	});

	describe("empty environment values", () => {
		const optionalDirectories = [
			["XDG_CONFIG_HOME", "configHome"],
			["XDG_DATA_HOME", "dataHome"],
			["XDG_CACHE_HOME", "cacheHome"],
			["XDG_STATE_HOME", "stateHome"],
			["XDG_RUNTIME_DIR", "runtimeDir"],
			["APPDATA", "appData"],
			["LOCALAPPDATA", "localAppData"],
		] as const;

		for (const [variable, field] of optionalDirectories) {
			it.effect(`treats an empty ${variable} as an absent ${field}`, () =>
				Effect.gen(function* () {
					const paths = yield* Xdg;
					assert.isFalse(field in paths);
					assert.isUndefined(paths[field]);
				}).pipe(provideLayer(env({ HOME: "/home/ada", [variable]: "" }))),
			);
		}

		it.effect("an empty HOME is a typed XdgEnvError, never a defect", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.void.pipe(provideLayer(env({ HOME: "" }))));
				const cause = exit.pipe(Exit.getCause, O.getOrThrow);
				assert.isTrue(cause.reasons.some(Cause.isFailReason));
				assert.isFalse(cause.reasons.some(Cause.isDieReason));
				const failure = cause.reasons.find(Cause.isFailReason);
				assert(P.isTagged("XdgEnvError")(failure?.error));
				assert.instanceOf(failure.error, XdgEnvError);
				assert.strictEqual(failure.error.variable, "HOME");
				assert.strictEqual(failure.error.message, "The HOME environment variable is not set");
				assert(P.isTagged("ConfigError")(failure.error.cause));
			}),
		);
	});

	it.effect("keeps the annotated XdgPlatform literal kit surface", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual(XdgPlatform.literals, [
				"aix", "android", "darwin", "freebsd", "haiku", "linux",
				"openbsd", "sunos", "win32", "cygwin", "netbsd",
			]);
			for (const platform of XdgPlatform.literals) {
				assert.strictEqual(XdgPlatform.Enum[platform], platform);
				assert.isTrue(XdgPlatform.is[platform](platform));
				assert.isTrue(S.is(XdgPlatform)(platform));
			}
			assert.isFalse(XdgPlatform.is.linux("darwin"));
			assert.isFalse(S.is(XdgPlatform)("other"));
			assert.deepStrictEqual(XdgPlatform.pick(["linux", "darwin"]).literals, ["linux", "darwin"]);
			assert.strictEqual(XdgPlatform.mapMembers((members) => members).members.length, 11);
			assert.strictEqual(XdgPlatform.$match("linux", {
				aix: () => "aix", android: () => "android", darwin: () => "darwin",
				freebsd: () => "freebsd", haiku: () => "haiku", linux: () => "selected",
				openbsd: () => "openbsd", sunos: () => "sunos", win32: () => "win32",
				cygwin: () => "cygwin", netbsd: () => "netbsd",
			}), "selected");
			const PlatformEvent = XdgPlatform.toTaggedUnion("platform")({
				aix: {}, android: {}, darwin: {}, freebsd: {}, haiku: {}, linux: {},
				openbsd: {}, sunos: {}, win32: {}, cygwin: {}, netbsd: {},
			});
			assert.isTrue(S.is(PlatformEvent)({ platform: "linux" }));
			assert.isFalse(S.is(PlatformEvent)({ platform: "other" }));
			assert.strictEqual(yield* S.decodeEffect(XdgPlatform)("linux"), "linux");
		}),
	);

	it.effect("preserves the XdgEnvError cause stack across encoding and decoding", () =>
		Effect.gen(function* () {
			const cause = new Error("missing HOME");
			cause.stack = "Error: missing HOME\n    at readHome (xdg-fixture.ts:12:3)";
			const error = XdgEnvError.make({ variable: "HOME", cause });
			assert.strictEqual(error.cause, cause);
			const encoded = yield* S.encodeEffect(XdgEnvError)(error);
			assert(P.hasProperty(encoded.cause, "stack"));
			assert.strictEqual(encoded.cause.stack, cause.stack);
			assert.strictEqual(encoded._tag, "XdgEnvError");
			const decoded = yield* S.decodeEffect(XdgEnvError)(encoded);
			assert.instanceOf(decoded, XdgEnvError);
			assert.strictEqual(decoded._tag, error._tag);
			assert.strictEqual(decoded.variable, error.variable);
			assert.strictEqual(decoded.message, error.message);
			assert.instanceOf(decoded.cause, Error);
			assert(P.hasProperty(decoded.cause, "stack"));
			assert.strictEqual(decoded.cause.stack, cause.stack);
			assert(P.hasProperty(decoded.cause, "message"));
			assert.strictEqual(decoded.cause.message, cause.message);
		}),
	);

	describe("search paths", () => {
		it.effect("splits XDG_CONFIG_DIRS and XDG_DATA_DIRS on the colon", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg", "/opt/xdg"]);
				assert.deepStrictEqual([...paths.dataDirs], ["/opt/share", "/usr/share"]);
			}).pipe(
				provideLayer(
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
			}).pipe(provideLayer(env({ HOME: "/home/ada" }))),
		);

		it.effect("treats an EMPTY XDG_CONFIG_DIRS as unset, per the spec", () =>
			Effect.gen(function* () {
				// The spec is explicit: an empty value takes the default, it does not
				// mean "no system directories". A naive `split(":")` would yield [""].
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg"]);
			}).pipe(provideLayer(env({ HOME: "/home/ada", XDG_CONFIG_DIRS: "" }))),
		);

		it.effect("drops empty entries from a partially-empty list", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.deepStrictEqual([...paths.configDirs], ["/a", "/b"]);
			}).pipe(provideLayer(env({ HOME: "/home/ada", XDG_CONFIG_DIRS: "/a::/b:" }))),
		);
	});

	describe("layerFrom", () => {
		it.effect("preserves explicit empty paths instead of applying environment normalization", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.strictEqual(paths.home, "");
				assert.strictEqual(paths.configHome, "");
				assert.strictEqual(paths.runtimeDir, "");
				assert.isTrue("configHome" in paths);
				assert.isTrue("runtimeDir" in paths);
			}).pipe(provideLayer(Xdg.layerFrom(XdgPaths.make({
				home: "", configHome: "", runtimeDir: "", configDirs: [], dataDirs: [],
			})))),
		);

		it.effect("serves fixed paths without reading the environment at all", () =>
			Effect.gen(function* () {
				const paths = yield* Xdg;
				assert.strictEqual(paths.home, "/fixture");
				assert.deepStrictEqual([...paths.configDirs], ["/etc/xdg"]);
			}).pipe(
				provideLayer(
					Xdg.layerFrom(XdgPaths.make({ home: "/fixture", configDirs: ["/etc/xdg"], dataDirs: ["/usr/share"] })),
				),
			),
		);
	});
});
