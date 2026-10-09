import { assert, describe, it } from "@effect/vitest";
import { ConfigFile, JsonCodec, MergeStrategy } from "../../effected/config-file/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import type { XdgPlatform } from "../../effected/xdg/index.ts";
import { AppDirs, CurrentPlatform, Xdg, XdgConfig, XdgPaths } from "../../effected/xdg/index.ts";

/** Build the fixture graph in a scope that owns its acquired resources. */
const provideLayer = <ROut, E, RIn>(layer: Layer.Layer<ROut, E, RIn>) =>
	<A, E2, R>(self: Effect.Effect<A, E2, R>) =>
		Effect.scopedWith((scope) =>
			Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(self, context)),
		);

const JsonValue = S.fromJsonString(S.Unknown);

const paths = XdgPaths.make({
	home: "/home/ada",
	configHome: "/home/ada/.config",
	configDirs: ["/etc/xdg", "/opt/xdg"],
	dataDirs: ["/usr/share"],
});

/**
 * A real in-memory volume where every `present` path holds `files[path]` (or an
 * empty file), every `denied` path is seeded too but its probe raises
 * PermissionDenied, and everything else is honestly absent. Seeding the denied
 * paths makes the fault load-bearing: with it disarmed the probe would FIND
 * them. `probed` records every path the resolver actually looked at, when the
 * probe executes, so short-circuiting is observable.
 */
const fsFixture = (options: {
	readonly present?: ReadonlyArray<string>;
	readonly files?: Readonly<Record<string, string>>;
	readonly denied?: ReadonlyArray<string>;
	readonly probed?: Array<string>;
}) =>
	MemoryFileSystem.layerWith(
		Object.fromEntries(
			[...(options.present ?? []), ...(options.denied ?? [])].map((target) => [target, options.files?.[target] ?? ""]),
		),
		{
			faults: {
				exists: (target) => {
					options.probed?.push(target);
					if (options.denied?.includes(target) === true) {
						return Effect.fail(
							PlatformError.systemError({
								_tag: "PermissionDenied",
								module: "FileSystem",
								method: "exists",
								pathOrDescriptor: target,
							}),
						);
					}
					return undefined; // delegate: the volume answers
				},
			},
		},
	);

/** Platform, environment, filesystem and a resolved `AppDirs` — all in the R channel. */
const context = (options: Parameters<typeof fsFixture>[0], platform: XdgPlatform = "linux") => {
	const base = Layer.mergeAll(
		Path.layer,
		fsFixture(options),
		Layer.succeed(CurrentPlatform, platform),
		Xdg.layerFrom(paths),
	);
	return Layer.provideMerge(AppDirs.layer({ namespace: "myapp" }), base);
};

const resolve = <R>(resolver: { readonly resolve: Effect.Effect<O.Option<string>, never, R> }) => resolver.resolve;

describe("XdgConfig.resolver", () => {
	it.effect("finds the file in the app's own config directory", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/home/ada/.config/myapp/rc.json"));
		}).pipe(provideLayer(context({ present: ["/home/ada/.config/myapp/rc.json"] }))),
	);

	it.effect("falls through to a system config dir — the search path v3 never had", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/etc/xdg/myapp/rc.json"));
		}).pipe(provideLayer(context({ present: ["/etc/xdg/myapp/rc.json"] }))),
	);

	it.effect("finds a file present ONLY in the last system dir", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/opt/xdg/myapp/rc.json"));
		}).pipe(provideLayer(context({ present: ["/opt/xdg/myapp/rc.json"] }))),
	);

	it.effect("earlier entries in XDG_CONFIG_DIRS win over later ones", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/etc/xdg/myapp/rc.json"));
		}).pipe(provideLayer(context({ present: ["/etc/xdg/myapp/rc.json", "/opt/xdg/myapp/rc.json"] }))),
	);

	it.effect("the app's own directory beats every system dir", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/home/ada/.config/myapp/rc.json"));
		}).pipe(
			provideLayer(
				context({
					present: ["/home/ada/.config/myapp/rc.json", "/etc/xdg/myapp/rc.json", "/opt/xdg/myapp/rc.json"],
				}),
			),
		),
	);

	it.effect("short-circuits: candidates after the first hit are never probed", () =>
		Effect.gen(function* () {
			const probed: Array<string> = [];
			yield* resolve(XdgConfig.resolver({ filename: "rc.json" })).pipe(
				provideLayer(context({ present: ["/home/ada/.config/myapp/rc.json"], probed })),
			);
			assert.deepStrictEqual(probed, ["/home/ada/.config/myapp/rc.json"]);
		}),
	);

	it.effect("an UNREADABLE candidate does not hide a readable one behind it", () =>
		Effect.gen(function* () {
			// This is the v3 bug. Its resolver wrapped the whole probe in one
			// `catchAll`, so an EACCES on the first candidate returned `none` and the
			// remaining search path was never consulted.
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/etc/xdg/myapp/rc.json"));
		}).pipe(
			provideLayer(
				context({
					denied: ["/home/ada/.config/myapp/rc.json"],
					present: ["/etc/xdg/myapp/rc.json"],
				}),
			),
		),
	);

	it.effect("is None when the file is nowhere on the search path", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.resolver({ filename: "rc.json" }));
			assert.isTrue(O.isNone(found));
		}).pipe(provideLayer(context({}))),
	);
});

describe("XdgConfig.nativeResolver", () => {
	it.effect("probes the macOS Application Support directory", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.nativeResolver({ namespace: "myapp", filename: "rc.json" }));
			assert.deepStrictEqual(found, O.some("/home/ada/Library/Application Support/myapp/rc.json"));
		}).pipe(provideLayer(context({ present: ["/home/ada/Library/Application Support/myapp/rc.json"] }, "darwin"))),
	);

	it.effect("returns None on linux WITHOUT probing — XDG already owns ~/.config there", () =>
		Effect.gen(function* () {
			const probed: Array<string> = [];
			const found = yield* resolve(XdgConfig.nativeResolver({ namespace: "myapp", filename: "rc.json" })).pipe(
				provideLayer(context({ probed }, "linux")),
			);
			assert.isTrue(O.isNone(found));
			assert.deepStrictEqual(probed, []);
		}),
	);

	it.effect("absorbs an unreadable native directory into None", () =>
		Effect.gen(function* () {
			const found = yield* resolve(XdgConfig.nativeResolver({ namespace: "myapp", filename: "rc.json" }));
			assert.isTrue(O.isNone(found));
		}).pipe(provideLayer(context({ denied: ["/home/ada/Library/Application Support/myapp/rc.json"] }, "darwin"))),
	);
});

describe("XdgConfig.savePath", () => {
	it.effect("joins the filename onto the app's config directory", () =>
		Effect.gen(function* () {
			const target = yield* XdgConfig.savePath("rc.json");
			assert.strictEqual(target, "/home/ada/.config/myapp/rc.json");
		}).pipe(provideLayer(context({}))),
	);

	it.effect("drops into ConfigFile.defaultPath, whose slot demands a `never` channel", () =>
		Effect.gen(function* () {
			// The end-to-end proof that resolving at layer-construction time was the
			// right call: `defaultPath` is typed `Effect<string, never, RR>`, so a
			// fallible savePath simply would not fit here without an `orDie`.
			const AppShape = S.Struct({ port: S.Finite });
			class AppConfig extends ConfigFile.Service<AppConfig, typeof AppShape.Type>()("test/AppConfig") {}

			const configLayer = ConfigFile.layer(AppConfig, {
				schema: AppShape,
				codec: JsonCodec,
				strategy: MergeStrategy.firstMatch<typeof AppShape.Type>(),
				resolvers: [XdgConfig.resolver({ filename: "rc.json" })],
				defaultPath: XdgConfig.savePath("rc.json"),
			});

			const saved = yield* Effect.gen(function* () {
				const config = yield* AppConfig;
				const loaded = yield* config.load;
				assert.deepStrictEqual(loaded, { port: 4242 });
				const target = yield* config.save({ port: 8080 });
				// Same provide, same volume: the save really landed.
				const volume = yield* MemoryFileSystem.Volume;
				assert.deepStrictEqual(
					yield* S.decodeEffect(JsonValue)(volume.text(target) ?? "null"),
					{ port: 8080 },
				);
				return target;
			}).pipe(
				provideLayer(
					Layer.provideMerge(
						configLayer,
						context({
							present: ["/home/ada/.config/myapp/rc.json"],
							files: { "/home/ada/.config/myapp/rc.json": `{"port":4242}` },
						}),
					),
				),
			);

			assert.strictEqual(saved, "/home/ada/.config/myapp/rc.json");
		}),
	);
});
