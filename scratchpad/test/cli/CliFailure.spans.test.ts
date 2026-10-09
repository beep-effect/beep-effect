// @effect-diagnostics strictEffectProvide:skip-file
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Cause, ConfigProvider, Console, Context, Effect, Exit, Layer, Path, Stdio, Terminal } from "effect";
import { Command } from "effect/cli";
import type { CliFailureOptions, CliLogOptions, FailureDetails } from "../../effected/cli/index.ts";
import { CliAudience, CliFailure, CliRuntime, Render } from "../../effected/cli/index.ts";

interface Frame {
	readonly name: string;
	readonly stack: () => string | undefined;
	readonly parent: Frame | undefined;
}

const KIT = "/home/u/.npm/lib/node_modules/reposets/node_modules/@effected/config-file/dist/ConfigFile.js:41:7";
const PNPM_KIT =
	"/repo/node_modules/.pnpm/@effected+config-file@0.14.0/node_modules/@effected/config-file/dist/index.js:12:3";
const EFFECT = "/repo/node_modules/effect/dist/esm/internal/effect.js:100:1";
const APP = "/home/u/.npm/lib/node_modules/reposets/dist/sync.js:20:5";

const at = (file: string | undefined) => () => (file === undefined ? undefined : `at file://${file}`);

/**
 * The span chain the runtime records for `reposets sync` calling `ConfigFile.discover`, which calls
 * `ConfigFile.loadFrom`: each `Effect.fn` call carries its definition as its parent, innermost first.
 */
const chain = (sites: { readonly app: string; readonly kit: string }): Frame => {
	const root: Frame = { name: "sync", stack: at(sites.app), parent: undefined };
	const rootDef: Frame = { name: "sync (definition)", stack: at(sites.app), parent: undefined };
	const sync: Frame = { ...root, parent: rootDef };
	const discoverDef: Frame = { name: "ConfigFile.discover (definition)", stack: at(sites.kit), parent: sync };
	// The program calls discover, so the call site is the program's: it is judged by its definition, in the kit.
	const discover: Frame = { name: "ConfigFile.discover", stack: at(sites.app), parent: discoverDef };
	const loadDef: Frame = { name: "ConfigFile.loadFrom (definition)", stack: at(sites.kit), parent: discover };
	return { name: "ConfigFile.loadFrom", stack: at(sites.kit), parent: loadDef };
};

const failedUnder = (frame: Frame) =>
	Cause.annotate(Cause.fail(new Error("Config validation failed")), Context.make(Cause.StackTrace, frame));

const trail = (frame: Frame, options?: CliFailureOptions): string =>
	Render.plain(CliFailure.toDoc(failedUnder(frame), options), Render.contextOf({ audience: "agent" }))
		.split("\n")
		.filter((line) => line.startsWith("in: "))
		.join("\n");

describe("CliFailure.toDoc: the span trail", () => {
	it("all is every span, outermost first, as before", () => {
		assert.strictEqual(
			trail(chain({ app: APP, kit: KIT }), { spans: "all" }),
			"in: sync > ConfigFile.discover > ConfigFile.loadFrom",
		);
	});

	it("app, the default, drops spans the kit defined, a kit function the program called included", () => {
		const expected = "in: sync";
		assert.strictEqual(trail(chain({ app: APP, kit: KIT })), expected);
		assert.strictEqual(trail(chain({ app: APP, kit: KIT }), { spans: "app" }), expected);
		assert.strictEqual(trail(chain({ app: APP, kit: PNPM_KIT })), expected, "a pnpm store path is the kit's too");
	});

	it("app drops Effect's own spans as well", () => {
		const inner: Frame = {
			name: "effect/internal",
			stack: at(EFFECT),
			parent: { name: "mine", stack: at(APP), parent: undefined },
		};
		assert.strictEqual(trail(inner), "in: mine");
	});

	it("control: app keeps every span whose site is the program's, or not known", () => {
		const own = chain({ app: APP, kit: APP });
		assert.strictEqual(trail(own), trail(own, { spans: "all" }));
		const unknown: Frame = { name: "withSpan", stack: at(undefined), parent: undefined };
		assert.strictEqual(trail(unknown), "in: withSpan");
		const throwing: Frame = {
			name: "odd",
			stack: () => {
				throw new Error("no stack");
			},
			parent: undefined,
		};
		assert.strictEqual(trail(throwing), "in: odd");
	});

	it("app leaves no in: line when every span is the kit's", () => {
		const kitOnly: Frame = { name: "ConfigFile.loadFrom", stack: at(KIT), parent: undefined };
		assert.strictEqual(trail(kitOnly), "");
		assert.strictEqual(trail(kitOnly, { spans: "all" }), "in: ConfigFile.loadFrom");
	});

	it("a call and its definition are one entry under all and app alike; a lone definition stays as it is", () => {
		const lone: Frame = { name: "orphan (definition)", stack: at(APP), parent: undefined };
		const other: Frame = { name: "inner", stack: at(APP), parent: lone };
		assert.strictEqual(
			trail(other, { spans: "all" }),
			"in: orphan (definition) > inner",
			"names that differ never pair",
		);
		assert.notInclude(trail(chain({ app: APP, kit: KIT }), { spans: "all" }), "(definition)");
		assert.notInclude(trail(chain({ app: APP, kit: KIT })), "(definition)");
	});

	it("off drops the trail and keeps the failure", () => {
		const doc = CliFailure.toDoc(failedUnder(chain({ app: APP, kit: KIT })), { spans: "off" });
		const text = Render.plain(doc, Render.contextOf({ audience: "agent" }));
		assert.notInclude(text, "in: ");
		assert.include(text, "Config validation failed");
	});

	it.effect("a real Effect.fn defined in this repository is the program's, so the default keeps it", () =>
		Effect.gen(function* () {
			const load = Effect.fn("load")(function* () {
				return yield* Effect.fail(new Error("nope"));
			});
			const exit = yield* Effect.exit(load());
			if (!Exit.isFailure(exit)) throw new Error("expected a failure");
			const text = Render.plain(CliFailure.toDoc(exit.cause), Render.contextOf({ audience: "agent" }));
			assert.include(text, "in: load");
			assert.notInclude(text, "(definition)", "a real Effect.fn's call and definition are one entry");
		}),
	);
});

describe("CliFailure.toDoc: the running program's own package (appModule)", () => {
	/** schemastore-cli, installed globally beside the kit packages it uses: its own spans are under @effected too. */
	const GLOBAL = "/usr/local/lib/node_modules";
	const BIN = `file://${GLOBAL}/@effected/schemastore-cli/dist/bin.js`;
	const LOADER = `${GLOBAL}/@effected/schemastore-cli/dist/ConfigLoader.js:30:9`;
	const HOISTED_KIT = `${GLOBAL}/@effected/config-file/dist/ConfigFile.js:41:7`;
	const NESTED_KIT = `${GLOBAL}/@effected/schemastore-cli/node_modules/@effected/config-file/dist/ConfigFile.js:41:7`;
	const PNPM_BIN =
		"file:///store/.pnpm/@effected+schemastore-cli@0.17.0/node_modules/@effected/schemastore-cli/dist/bin.js";
	const PNPM_LOADER =
		"/store/.pnpm/@effected+schemastore-cli@0.17.0/node_modules/@effected/schemastore-cli/dist/ConfigLoader.js:30:9";
	const PNPM_KIT = "/store/.pnpm/@effected+config-file@0.14.0/node_modules/@effected/config-file/dist/index.js:12:3";

	const companion = (sites: { readonly loader: string; readonly kit: string }): Frame => {
		const loadDef: Frame = { name: "ConfigLoader.load (definition)", stack: at(sites.loader), parent: undefined };
		const load: Frame = { name: "ConfigLoader.load", stack: at(sites.loader), parent: loadDef };
		const decodeDef: Frame = { name: "ConfigFile.loadFrom (definition)", stack: at(sites.kit), parent: load };
		return { name: "ConfigFile.loadFrom", stack: at(sites.kit), parent: decodeDef };
	};

	it("keeps a kit companion's own spans and still drops the kit packages it uses", () => {
		const expected = "in: ConfigLoader.load";
		assert.strictEqual(trail(companion({ loader: LOADER, kit: HOISTED_KIT }), { appModule: BIN }), expected);
		assert.strictEqual(
			trail(companion({ loader: LOADER, kit: NESTED_KIT }), { appModule: BIN }),
			expected,
			"a kit package nested in the program's own node_modules is still the kit's",
		);
		assert.strictEqual(
			trail(companion({ loader: PNPM_LOADER, kit: PNPM_KIT }), { appModule: PNPM_BIN }),
			expected,
			"in a pnpm store",
		);
		assert.strictEqual(
			trail(companion({ loader: LOADER, kit: HOISTED_KIT }), {
				appModule: `${GLOBAL}/@effected/schemastore-cli/dist/bin.js`,
			}),
			expected,
			"a plain path works as well as a file: URL",
		);
	});

	it("negative control: without appModule the companion's spans are dropped with the kit's", () => {
		assert.strictEqual(trail(companion({ loader: LOADER, kit: HOISTED_KIT })), "");
	});

	it("negative control: another package's appModule does not keep the companion's spans", () => {
		assert.strictEqual(
			trail(companion({ loader: LOADER, kit: HOISTED_KIT }), { appModule: `file://${GLOBAL}/reposets/dist/bin.js` }),
			"",
		);
		assert.strictEqual(
			trail(companion({ loader: LOADER, kit: HOISTED_KIT }), {
				appModule: `file://${GLOBAL}/@effected/schemastore/dist/index.js`,
			}),
			"",
			"a sibling whose name is a prefix of the companion's is not the companion",
		);
	});

	it("an appModule not under node_modules changes nothing", () => {
		assert.strictEqual(
			trail(chain({ app: APP, kit: KIT }), { appModule: "file:///repo/src/bin.ts" }),
			trail(chain({ app: APP, kit: KIT })),
		);
	});
});

describe("CliFailure.toDoc: appModule on Windows paths", () => {
	const ROOT = "C:\\Users\\u\\AppData\\Roaming\\npm\\node_modules";
	/** A CommonJS frame: a bare Windows path with backslashes, no file: URL. */
	const raw = (file: string) => () => `at ${file}`;
	const companion = (loader: string, kit: string): Frame => {
		const loadDef: Frame = { name: "ConfigLoader.load (definition)", stack: raw(loader), parent: undefined };
		const load: Frame = { name: "ConfigLoader.load", stack: raw(loader), parent: loadDef };
		const decodeDef: Frame = { name: "ConfigFile.loadFrom (definition)", stack: raw(kit), parent: load };
		return { name: "ConfigFile.loadFrom", stack: raw(kit), parent: decodeDef };
	};
	const LOADER = `${ROOT}\\@effected\\schemastore-cli\\dist\\ConfigLoader.js:30:9`;
	const KIT = `${ROOT}\\@effected\\config-file\\dist\\ConfigFile.js:41:7`;
	const NESTED = `${ROOT}\\@effected\\schemastore-cli\\node_modules\\@effected\\config-file\\dist\\x.js:1:1`;
	const BIN = "file:///C:/Users/u/AppData/Roaming/npm/node_modules/@effected/schemastore-cli/dist/bin.js";

	it("a backslashed CommonJS frame matches an import.meta.url-derived appModule", () => {
		assert.strictEqual(trail(companion(LOADER, KIT), { appModule: BIN }), "in: ConfigLoader.load");
	});

	it("a drive letter in another case is the same drive", () => {
		assert.strictEqual(trail(companion(LOADER, KIT), { appModule: BIN.replace("C:", "c:") }), "in: ConfigLoader.load");
		assert.strictEqual(
			trail(companion(LOADER.replace("C:", "c:"), KIT), { appModule: BIN }),
			"in: ConfigLoader.load",
			"either side may carry the lower case",
		);
	});

	it("controls: without appModule, or with another package's, the companion's spans go; a nested kit still goes", () => {
		assert.strictEqual(trail(companion(LOADER, KIT)), "");
		assert.strictEqual(
			trail(companion(LOADER, KIT), {
				appModule: "file:///C:/Users/u/AppData/Roaming/npm/node_modules/reposets/dist/bin.js",
			}),
			"",
		);
		assert.strictEqual(trail(companion(LOADER, NESTED), { appModule: BIN }), "in: ConfigLoader.load");
		assert.strictEqual(
			trail(companion(LOADER, KIT), {
				appModule: "file:///D:/Users/u/AppData/Roaming/npm/node_modules/@effected/schemastore-cli/dist/bin.js",
			}),
			"",
			"another drive is another install",
		);
	});
});

describe("CliFailure.toDoc: a monorepo's own packages/effect is the program's", () => {
	const MONOREPO_EFFECT = "/work/monorepo/packages/effect/src/Thing.ts:9:1";

	it("a span defined under packages/effect/src/ is kept: only node_modules marks Effect's own", () => {
		const frame: Frame = { name: "Thing.make", stack: at(MONOREPO_EFFECT), parent: undefined };
		assert.strictEqual(trail(frame), "in: Thing.make");
	});

	it("negative control: installed effect is still left out", () => {
		const frame: Frame = { name: "Thing.make", stack: at(EFFECT), parent: undefined };
		assert.strictEqual(trail(frame), "");
	});
});

describe("CliRuntime.main's env.spans", () => {
	const platform = Layer.mergeAll(
		Stdio.layerTest({ stdinIsTerminal: Effect.succeed(false), stdoutIsTerminal: Effect.succeed(false) }),
		Layer.succeed(
			Terminal.Terminal,
			Terminal.make({
				columns: Effect.succeed(100),
				rows: Effect.succeed(24),
				readInput: Effect.die("unused"),
				readLine: Effect.die("unused"),
				display: () => Effect.void,
			}),
		),
	);

	const runTool = (
		spans: "app" | "all" | "off" | undefined,
		render?: (error: unknown, details: FailureDetails) => ReadonlyArray<string>,
		appModule?: string,
		variable?: { readonly spansEnvVar: string; readonly value?: string },
		log?: CliLogOptions,
		extraEnv: Record<string, string> = {},
	) =>
		Effect.gen(function* () {
			const err: Array<string> = [];
			const double: Console.Console = Object.assign(Object.create(console) as Console.Console, {
				log: () => undefined,
				error: (...args: ReadonlyArray<unknown>) => err.push(args.map(String).join(" ")),
			});
			const tool = Command.make("tool").pipe(
				Command.withSharedFlags(CliAudience.flags()),
				Command.withSubcommands([
					Command.make("go", {}, () => Effect.failCause(failedUnder(chain({ app: APP, kit: KIT })))),
				]),
			);
			yield* CliRuntime.main(
				CliAudience.runWith(tool, { version: "1.0.0" })(["--agent", "go"]).pipe(Effect.provide(NodeServices.layer)),
				{
					platform,
					env: {
						...(spans === undefined ? {} : { spans }),
						...(appModule === undefined ? {} : { appModule }),
						...(variable === undefined ? {} : { spansEnvVar: variable.spansEnvVar }),
						...(log === undefined ? {} : { log }),
					},
					...(render === undefined ? {} : { render }),
				},
			).pipe(
				Effect.exit,
				Effect.provideService(
					ConfigProvider.ConfigProvider,
					ConfigProvider.fromUnknown(
						variable?.value === undefined ? extraEnv : { ...extraEnv, [variable.spansEnvVar]: variable.value },
					),
				),
				Effect.provideService(Console.Console, double),
				// `env.log` types a file sink's FileSystem and Path into main's requirements; none is written here.
				Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
			);
			return err.join("\n");
		});

	it.effect("defaults to app and keeps the setting through an audience flag's rewrite of the report", () =>
		Effect.gen(function* () {
			const byDefault = yield* runTool(undefined);
			assert.include(byDefault, "Config validation failed");
			assert.include(byDefault, "in: sync");
			assert.notInclude(byDefault, "(definition)");
			assert.notInclude(byDefault, "ConfigFile");
			assert.include(yield* runTool("all"), "ConfigFile.loadFrom", "control: all keeps the kit's spans");
			const off = yield* runTool("off");
			assert.include(off, "Config validation failed");
			assert.notInclude(off, "in: ");
		}),
	);

	it.effect("env.appModule reaches the report: the program's own spans under @effected are kept", () =>
		Effect.gen(function* () {
			const kept = yield* runTool(
				undefined,
				undefined,
				`file://${KIT.replace(/dist\/ConfigFile\.js:41:7$/, "dist/bin.js")}`,
			);
			assert.include(kept, "ConfigFile.loadFrom", "the bin's own package is config-file's here, so its spans stay");
			const dropped = yield* runTool(undefined);
			assert.notInclude(dropped, "ConfigFile", "control: without appModule they are left out");
		}),
	);

	it.effect("env.spansEnvVar sets the trail at run time, case-insensitive, as log.envVar sets the level", () =>
		Effect.gen(function* () {
			const variable = (value?: string) => ({ spansEnvVar: "TOOL_SPANS", ...(value === undefined ? {} : { value }) });
			const all = yield* runTool(undefined, undefined, undefined, variable("ALL"));
			assert.include(all, "ConfigFile.loadFrom", "TOOL_SPANS=ALL shows the kit's spans");
			const off = yield* runTool(undefined, undefined, undefined, variable("off"));
			assert.notInclude(off, "in: ");
			const unset = yield* runTool(undefined, undefined, undefined, variable());
			assert.include(unset, "in: sync");
			assert.notInclude(unset, "ConfigFile", "unset: the default, app");
			const empty = yield* runTool(undefined, undefined, undefined, variable(""));
			assert.notInclude(empty, "ConfigFile", "empty: the default, app");
		}),
	);

	it.effect("env.spans beats env.spansEnvVar, which is then not read at all", () =>
		Effect.gen(function* () {
			const text = yield* runTool("off", undefined, undefined, { spansEnvVar: "TOOL_SPANS", value: "loud" });
			assert.notInclude(text, "in: ", "the explicit setting won");
			assert.notInclude(text, "TOOL_SPANS", "an invalid value is not even read, so it does not warn");
		}),
	);

	it.effect("an invalid value is ignored with one warning naming the variable and the settings", () =>
		Effect.gen(function* () {
			const text = yield* runTool(undefined, undefined, undefined, { spansEnvVar: "TOOL_SPANS", value: "loud" });
			const warnings = text.split("\n").filter((line) => line.includes("TOOL_SPANS=loud"));
			assert.lengthOf(warnings, 1, text);
			assert.include(warnings[0], "is not a span setting (app|all|off); ignoring it");
			assert.include(text, "in: sync", "the default applies");
			assert.notInclude(text, "ConfigFile");
		}),
	);

	it.effect(
		"the invalid-value warning is delivered as log.envVar's is: printed at level None, never into the sink",
		() =>
			Effect.gen(function* () {
				const bad = { spansEnvVar: "TOOL_SPANS", value: "loud" };
				const warnings = (text: string) => text.split("\n").filter((line) => line.includes("TOOL_SPANS=loud"));
				const atNone = yield* runTool(undefined, undefined, undefined, bad, { level: "None" });
				assert.lengthOf(warnings(atNone), 1, `printed at level None: ${atNone}`);
				// With the sink live (Debug, NDJSON), the warning is still one plain line, and no record carries it.
				const sinkOn = yield* runTool(undefined, undefined, undefined, bad, { level: "Debug", format: "json" });
				assert.lengthOf(warnings(sinkOn), 1, sinkOn);
				assert.isFalse(warnings(sinkOn)[0]?.startsWith("{"), "a plain line, not an NDJSON record");
				// Side by side with log.envVar's own invalid value: delivered the same way.
				const both = yield* runTool(
					undefined,
					undefined,
					undefined,
					bad,
					{ envVar: "TOOL_LOG", format: "json" },
					{ TOOL_LOG: "shout" },
				);
				const logWarning = both.split("\n").filter((line) => line.includes("TOOL_LOG=shout"));
				assert.lengthOf(logWarning, 1, both);
				assert.lengthOf(warnings(both), 1, both);
				assert.strictEqual(
					warnings(both)[0]?.startsWith("{"),
					logWarning[0]?.startsWith("{"),
					"the two env vars' warnings take the same shape",
				);
			}),
	);

	it.effect("FailureDetails.lines takes spans for its own lines, beside the run's setting", () =>
		Effect.gen(function* () {
			const seen: Array<ReadonlyArray<string>> = [];
			yield* runTool("off", (_error, details) => {
				seen.push(
					details.defaultLines,
					details.lines({ spans: "all" }),
					details.lines({ status: false, spans: "app" }),
				);
				return details.defaultLines;
			});
			const [defaults = [], all = [], app = []] = seen;
			assert.isFalse(
				defaults.some((line) => line.startsWith("in: ")),
				"the run's off",
			);
			assert.isTrue(all.some((line) => line.includes("ConfigFile.loadFrom")));
			assert.isTrue(app.some((line) => line === "in: sync"));
			assert.notMatch(app[0] ?? "", /^\[FAIL\]/, "status: false still applies beside spans");
		}),
	);
});
