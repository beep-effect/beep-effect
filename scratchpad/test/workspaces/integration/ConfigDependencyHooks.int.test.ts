import { env } from "node:process";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { NodeFileSystem } from "@effect/platform-node";
import * as Context from "effect/Context";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { ScriptedSpawner } from "../../../effected/commands/index.ts";
import { Git } from "../../../effected/git/index.ts";
import { CatalogAssemblyError } from "../../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
	CatalogSet,
	ChangeDetector,
	ConfigDependencyHooks,
	WorkspaceCatalogs,
	WorkspaceSnapshots,
	Workspaces,
} from "../../../effected/workspaces/index.ts";
import type { Tree } from "../fixtures.ts";
import { manifest, platform } from "../fixtures.ts";

// The hook-replay seam is inherently real-filesystem: the live layer dynamically
// `import()`s a `pnpmfile.cjs`, driving Node's module loader over disk fixtures.
// That makes this an INTEGRATION suite, not a virtual-FS unit test. It builds a
// temp workspace root with a real `node_modules/.pnpm-config/<name>/pnpmfile.cjs`
// (node_modules is gitignored, so it cannot be committed) by copying the
// committed fixture module, and points the config-dependency resolution at it.
// Every fixture directory carries a `package.json` at `1.0.0`, the version the
// tests declare: the replaying layers resolve the DECLARED version and a
// directory holding no manifest is "nothing installed" (see
// `ConfigDependencyResolution.int.test.ts` for the ladder itself).

const { dirname, join } = Effect.runSync(
	Path.layer.pipe(
		Layer.build,
		Effect.map((context) => Context.get(context, Path.Path)),
		Effect.scoped,
	),
);
class RealFileSystem extends Context.Service<RealFileSystem, FileSystem.FileSystem>()(
	"@beep/scratchpad/test/workspaces/integration/ConfigDependencyHooks.int.test/RealFileSystem",
) {}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const CJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.cjs");
const MJS_FIXTURE = join(FIXTURES, "hook-pnpmfile.mjs");
const NESTED_MISSING_FIXTURE = join(FIXTURES, "hook-pnpmfile-nested-missing.mjs");
const AGE_4320_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-4320.mjs");
const AGE_1440_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-1440.mjs");
const AGE_GARBAGE_FIXTURE = join(FIXTURES, "hook-pnpmfile-age-garbage.mjs");
const PEER_RULES_FIXTURE = join(FIXTURES, "hook-pnpmfile-peer-rules.mjs");

const DEP_NAME = "cfg-fixture";
// A config dependency shipping ONLY `pnpmfile.mjs` — the pnpm-11-native shape.
const MJS_DEP_NAME = "cfg-fixture-mjs";
// A config dependency directory that exists but ships NEITHER pnpmfile.
const NEITHER_DEP_NAME = "cfg-fixture-neither";
// A config dependency whose `pnpmfile.mjs` has a missing nested import.
const NESTED_DEP_NAME = "cfg-fixture-nested-missing";
// Config dependencies whose hooks set pnpm's release-age keys.
const AGE_4320_DEP_NAME = "cfg-fixture-age-4320";
const AGE_1440_DEP_NAME = "cfg-fixture-age-1440";
const AGE_GARBAGE_DEP_NAME = "cfg-fixture-age-garbage";
// A config dependency whose hook contributes a peerDependencyRules entry.
const PEER_RULES_DEP_NAME = "cfg-fixture-peer-rules";
const SEED = { default: { effect: "^4.0.0" } } as const;

let root: string;

/** The `.pnpm-config/<name>` directory under the temp root, created with a `package.json` at `1.0.0`. */
const configDepDir = Effect.fn("configDepDir")(function* (name: string) {
	const fs = yield* RealFileSystem;
	const dir = join(root, "node_modules", ".pnpm-config", name);
	yield* fs.makeDirectory(dir, { recursive: true });
	yield* fs.writeFileString(join(dir, "package.json"), manifest(name));
	return dir;
});

const FixtureLayer = Layer.effect(
	RealFileSystem,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const createConfigDepDir = Effect.fn("createConfigDepDir")(function* (name: string) {
			const dir = join(root, "node_modules", ".pnpm-config", name);
			yield* fs.makeDirectory(dir, { recursive: true });
			yield* fs.writeFileString(join(dir, "package.json"), manifest(name));
			return dir;
		});

		root = yield* fs.makeTempDirectoryScoped({ prefix: "effected-hooks-" });
		// The legacy `.cjs`-only config dependency.
		const cjsDir = yield* createConfigDepDir(DEP_NAME);
		yield* fs.makeDirectory(cjsDir, { recursive: true });
		yield* fs.copyFile(CJS_FIXTURE, join(cjsDir, "pnpmfile.cjs"));
		// A pnpm-11-native config dependency shipping ONLY `pnpmfile.mjs`.
		const mjsDir = yield* createConfigDepDir(MJS_DEP_NAME);
		yield* fs.makeDirectory(mjsDir, { recursive: true });
		yield* fs.copyFile(MJS_FIXTURE, join(mjsDir, "pnpmfile.mjs"));
		// A config-dependency directory that exists but carries neither pnpmfile.
		yield* createConfigDepDir(NEITHER_DEP_NAME);
		// A config dependency whose `pnpmfile.mjs` imports a module that does not resolve.
		const nestedDir = yield* createConfigDepDir(NESTED_DEP_NAME);
		yield* fs.makeDirectory(nestedDir, { recursive: true });
		yield* fs.copyFile(NESTED_MISSING_FIXTURE, join(nestedDir, "pnpmfile.mjs"));
		// Config dependencies whose hooks set pnpm's release-age keys.
		const age4320Dir = yield* createConfigDepDir(AGE_4320_DEP_NAME);
		yield* fs.makeDirectory(age4320Dir, { recursive: true });
		yield* fs.copyFile(AGE_4320_FIXTURE, join(age4320Dir, "pnpmfile.mjs"));
		const age1440Dir = yield* createConfigDepDir(AGE_1440_DEP_NAME);
		yield* fs.makeDirectory(age1440Dir, { recursive: true });
		yield* fs.copyFile(AGE_1440_FIXTURE, join(age1440Dir, "pnpmfile.mjs"));
		const ageGarbageDir = yield* createConfigDepDir(AGE_GARBAGE_DEP_NAME);
		yield* fs.makeDirectory(ageGarbageDir, { recursive: true });
		yield* fs.copyFile(AGE_GARBAGE_FIXTURE, join(ageGarbageDir, "pnpmfile.mjs"));
		const peerRulesDir = yield* createConfigDepDir(PEER_RULES_DEP_NAME);
		yield* fs.makeDirectory(peerRulesDir, { recursive: true });
		yield* fs.copyFile(PEER_RULES_FIXTURE, join(peerRulesDir, "pnpmfile.mjs"));
		return fs;
	}),
).pipe(Layer.provide(NodeFileSystem.layer));

it.layer(FixtureLayer, { timeout: "30 seconds" })((it) => {
	describe("ConfigDependencyHooks.layerLive — replays the pnpmfile", () => {
		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("loads the config dependency's updateConfig and injects its catalogs", () => {
				const markerPath = join(root, "live-marker.txt");
				env.HOOK_MARKER = markerPath;
				return Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					const result = yield* hooks.inject(root, { [DEP_NAME]: "1.0.0" }, SEED);
					// The hook injected into the default catalog and a named one, and the seed
					// survived.
					assert.strictEqual(result.catalogs.default?.["hooked-dep"], "^9.9.9");
					assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
					assert.strictEqual(result.catalogs.extra?.["extra-dep"], "^1.2.3");
					// This fixture sets no release-age keys, so it contributes an empty gate.
					assert.deepStrictEqual(result.releaseAge, {});
					// The side-effect marker proves the fixture actually executed.
					assert.isTrue(yield* (yield* RealFileSystem).exists(markerPath));
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							delete env.HOOK_MARKER;
						}),
					),
				);
			});
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a declared config dependency that is installed nowhere fails closed, never a silent skip", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// `absent-dep` has no `.pnpm-config/absent-dep/` directory and no store
					// copy. The declared version cannot be honoured, so this is a typed
					// `hooks` failure naming the dependency — a silent skip here is how a
					// hook-only catalog went missing on one side of a diff.
					const error = yield* Effect.flip(hooks.inject(root, { "absent-dep": "1.0.0" }, SEED));
					assert.instanceOf(error, CatalogAssemblyError);
					assert.strictEqual(error.source, "hooks");
					assert.strictEqual(error.path, "absent-dep");
					if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
					assert.include(error.cause.message, "pnpm add --config absent-dep@1.0.0");
				}),
			);
		});
	});

	describe("ConfigDependencyHooks.layerLive — pnpm 11 .mjs pnpmfile and load discrimination", () => {
		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("an .mjs-only config dependency replays its hook — proving .mjs is loaded", () => {
				const markerPath = join(root, "mjs-marker.txt");
				env.HOOK_MARKER = markerPath;
				return Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// The dep ships ONLY `pnpmfile.mjs`. The seam tries `.mjs` first, loads it,
					// and replays it — the DISTINCT `mjs-dep` / `mjsExtra` entries prove it was
					// the `.mjs` (there is no `.cjs` to have loaded), and the seed survived.
					const result = yield* hooks.inject(root, { [MJS_DEP_NAME]: "1.0.0" }, SEED);
					assert.strictEqual(result.catalogs.default?.["mjs-dep"], "^2.0.0");
					assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
					assert.strictEqual(result.catalogs.mjsExtra?.["mjs-extra-dep"], "^3.4.5");
					// The side-effect marker proves the `.mjs` fixture actually executed.
					assert.isTrue(yield* (yield* RealFileSystem).exists(markerPath));
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							delete env.HOOK_MARKER;
						}),
					),
				);
			});
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect(
				"a config-dependency directory with neither pnpmfile.mjs nor pnpmfile.cjs is skipped, not a failure",
				() =>
					Effect.gen(function* () {
						const hooks = yield* ConfigDependencyHooks;
						// The directory exists at the declared version but carries no pnpmfile
						// candidate — the one legitimate skip.
						const result = yield* hooks.inject(root, { [NEITHER_DEP_NAME]: "1.0.0" }, SEED);
						assert.deepStrictEqual(result, {
							catalogs: SEED,
							releaseAge: {},
							peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
							// Resolved (so recorded), contributed nothing.
							replays: { [NEITHER_DEP_NAME]: { version: "1.0.0", source: "installed" } },
						});
					}),
			);
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a pnpmfile whose OWN nested import is missing fails typed, never silently skipped", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// `pnpmfile.mjs` exists but statically imports a module that does not
					// resolve. That raises ERR_MODULE_NOT_FOUND for the NESTED module (err.url
					// differs from the candidate pnpmfile URL), so it must surface typed — the
					// exact case a broad "ERR_MODULE_NOT_FOUND ⇒ no pnpmfile" skip would swallow.
					const error = yield* Effect.flip(hooks.inject(root, { [NESTED_DEP_NAME]: "1.0.0" }, SEED));
					assert.instanceOf(error, CatalogAssemblyError);
					assert.strictEqual(error.source, "hooks");
					assert.strictEqual(error.path, NESTED_DEP_NAME);
				}),
			);
		});
	});

	describe("ConfigDependencyHooks.layerLive — rejects a traversal name before import()", () => {
		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a config dependency name with a '..' segment fails typed, never escaping .pnpm-config", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// `../../evil` would `import()` a path OUTSIDE `.pnpm-config`. The guard
					// rejects it typed, on the `hooks` source, before any path is built.
					const error = yield* Effect.flip(hooks.inject(root, { "../../evil": "1.0.0" }, SEED));
					assert.instanceOf(error, CatalogAssemblyError);
					assert.strictEqual(error.source, "hooks");
					assert.strictEqual(error.path, "../../evil");
				}),
			);
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a scoped name (a legitimate '/') is NOT rejected — only '..' segments are", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// `@scope/pkg` contains a `/` but no `..`; it resolves inside `.pnpm-config`
					// (installed at 1.0.0 with no pnpmfile), and contributes nothing — the seed
					// passes through.
					yield* configDepDir("@scope/pkg");
					const result = yield* hooks.inject(root, { "@scope/pkg": "1.0.0" }, SEED);
					assert.deepStrictEqual(result, {
						catalogs: SEED,
						releaseAge: {},
						peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
						replays: { "@scope/pkg": { version: "1.0.0", source: "installed" } },
					});
				}),
			);
		});
	});

	describe("Workspaces.layer default — provably never executes a config dependency's pnpmfile", () => {
		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const tree: Tree = {
						[`${root}/pnpm-workspace.yaml`]: [
							"packages:",
							"  - packages/*",
							"catalog:",
							"  effect: ^4.0.0",
							"configDependencies:",
							`  ${DEP_NAME}: '1.0.0'`,
							"",
						].join("\n"),
						[`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
						[`${root}/packages/a/package.json`]: manifest("@x/a", { dependencies: { effect: "catalog:" } }),
					};
					const defaultLayer = Workspaces.layer({ cwd: root }).pipe(Layer.provideMerge(platform(tree)));
					return defaultLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("set() succeeds and the real pnpmfile marker is never written under the DEFAULT layer", () => {
				// A pnpm-workspace.yaml declaring a configDependencies entry whose REAL
				// pnpmfile.cjs exists on disk (copied under root by FixtureLayer). The default
				// Workspaces.layer wires ConfigDependencyHooks.layerNoop, so assembly must
				// NEVER import that pnpmfile. Switch the default composite to layerLive and
				// the marker appears — this is the discriminating test that lack of one let
				// the default silently regress.
				const markerPath = join(root, "default-layer-marker.txt");
				env.HOOK_MARKER = markerPath;
				// The virtual tree is keyed to the REAL temp root, so the effect-FileSystem
				// read of pnpm-workspace.yaml is virtual while layerLive's node:fs read of
				// the pnpmfile (were it wired) would hit the real file under the same root.

				return Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const set = yield* catalogs.set;
					// The inline catalog assembled — proof the default catalog path actually ran.
					assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
					// ...and the config dependency's real pnpmfile never executed.
					assert.isFalse(yield* (yield* RealFileSystem).exists(markerPath));
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							delete env.HOOK_MARKER;
						}),
					),
				);
			});
		});
	});

	// The composite that did not exist before: snapshots + change detection + git,
	// over catalog assembly that REPLAYS config-dependency hooks. A consumer wanting
	// all four had to rebuild `layerWithGit`'s whole service graph by hand, because
	// `layerWithGit` hard-wires the no-op catalogs layer.
	//
	// The pair of tests below is the discrimination: the same tree, the same fixture
	// config dependency, the same assertions — and the ONLY difference is which
	// composite is provided. A `layerWithGitAndConfigDependencies` that quietly wired
	// the no-op catalogs would pass every "is the service present" check and fail
	// exactly one of these.
	// Git is PROVIDED here but never invoked: these tests ask about catalogs and
	// about which services exist, and none of them runs a command. A script that
	// throws on any spawn turns that assumption into an assertion — if a future
	// change makes composing this layer shell out, these tests fail loudly instead
	// of quietly spawning during an assembly test.
	const noSpawns = ScriptedSpawner.make((command, args) => {
		throw new Error(`unexpected spawn: ${command} ${args.join(" ")}`);
	});

	describe("Workspaces.layerWithGitAndConfigDependencies", () => {
		const hookedTree = (): Tree => ({
			[`${root}/pnpm-workspace.yaml`]: [
				"packages:",
				"  - packages/*",
				"catalog:",
				"  effect: ^4.0.0",
				"configDependencies:",
				`  ${DEP_NAME}: '1.0.0'`,
				"",
			].join("\n"),
			[`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
			[`${root}/packages/a/package.json`]: manifest("@x/a", { dependencies: { effect: "catalog:" } }),
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const appLayer = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(
						Layer.provideMerge(platform(hookedTree())),
						Layer.provideMerge(noSpawns.layer),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("assembles the hook-injected catalog AND provides the git tier in one composite", () =>
				Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const set = yield* catalogs.set;
					// The inline catalog — the control proving assembly ran at all.
					assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
					// The hook-injected one — proof the REPLAYING catalogs layer is wired,
					// not the no-op `layerWithGit` uses.
					assertSome(set.rangeOf("hooked-dep", O.none()), "^9.9.9");
					// ...and the three services the git composite adds are all reachable from
					// the same layer. Resolving them is the whole point: before this
					// composite existed, having both halves at once meant hand-composing.
					assert.isDefined(yield* WorkspaceSnapshots);
					assert.isDefined(yield* ChangeDetector);
					assert.isDefined(yield* Git);
				}),
			);
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const appLayer = Workspaces.layerWithGit({ cwd: root }).pipe(
						Layer.provideMerge(platform(hookedTree())),
						Layer.provideMerge(noSpawns.layer),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("layerWithGit over the same tree sees no hook-injected catalog — the control", () =>
				Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const set = yield* catalogs.set;
					assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
					// The default composite executes no config-dependency code, and this is
					// the assertion that keeps it that way.
					assertNone(set.rangeOf("hooked-dep", O.none()));
				}),
			);
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const seedCatalogs = CatalogSet.make({ entries: { default: { "seeded-dep": "^1.0.0" } } });
					const appLayer = Workspaces.layerWithGitAndConfigDependencies({ cwd: root, seedCatalogs }).pipe(
						Layer.provideMerge(platform(hookedTree())),
						Layer.provideMerge(noSpawns.layer),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("threads seedCatalogs through to the snapshots it provides", () =>
				Effect.gen(function* () {
					const snapshots = yield* WorkspaceSnapshots;
					const live = yield* snapshots.worktree;
					assertSome(live.resolve("seeded-dep", "catalog:"), "^1.0.0");
				}),
			);
		});
	});

	describe("ConfigDependencyHooks.layerNoop — provably never loads the pnpmfile", () => {
		it.layer(ConfigDependencyHooks.layerNoop, { timeout: "30 seconds" })((it) => {
			it.effect("returns the seed untouched and executes no config-dependency code", () => {
				// A marker path the fixture WOULD write if it ran. Under the no-op it must
				// stay absent — proving the default catalog path never loads the pnpmfile.
				const markerPath = join(root, "noop-marker.txt");
				env.HOOK_MARKER = markerPath;
				return Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					const result = yield* hooks.inject(root, { [DEP_NAME]: "1.0.0" }, SEED);
					// Same root and same declared config dependency as the live test — the ONLY
					// difference is the layer. The seed is unchanged, the fixture never ran,
					// and nothing was resolved — so nothing is recorded as replayed.
					assert.deepStrictEqual(result, {
						catalogs: SEED,
						releaseAge: {},
						peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
						replays: {},
					});
					assert.isFalse(yield* (yield* RealFileSystem).exists(markerPath));
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							delete env.HOOK_MARKER;
						}),
					),
				);
			});
		});

		it.layer(ConfigDependencyHooks.layerNoop, { timeout: "30 seconds" })((it) => {
			it.effect("contributes an empty release-age gate — the no-op runs no hooks", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// Declaring the age-setting config dependency changes nothing under the
					// no-op: it runs no hooks, so it contributes no release-age keys.
					const result = yield* hooks.inject(root, { [AGE_4320_DEP_NAME]: "1.0.0" }, SEED);
					assert.deepStrictEqual(result.releaseAge, {});
				}),
			);
		});
	});

	describe("ConfigDependencyHooks.layerLive — surfaces the release-age keys hooks set", () => {
		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a hook's numeric minimumReleaseAge and array exclude become the gate contribution", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// The `age-1440` fixture sets `minimumReleaseAge: 1440` and
					// `minimumReleaseAgeExclude: ["@scope/b"]`; both must survive to `releaseAge`
					// (mapped onto `ageMinutes` / `exclude`), and the catalog seed is unchanged.
					const result = yield* hooks.inject(root, { [AGE_1440_DEP_NAME]: "1.0.0" }, SEED);
					assert.deepStrictEqual(result.releaseAge, { ageMinutes: 1440, exclude: ["@scope/b"] });
					assert.deepStrictEqual(result.catalogs, SEED);
				}),
			);
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a later hook rewrites an earlier hook's release-age value — last-wins, not max", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// Two config deps replayed IN ORDER: `age-4320` (4320) THEN `age-1440`
					// (1440). Threading is last-wins over one config object exactly as pnpm
					// replays — so the LATER, LOWER 1440 wins. A strictest-wins merge WITHIN the
					// replay would have kept 4320, so 1440 is the discriminating result. The
					// exclude is last-wins too (`@scope/b`, not `@scope/a`).
					const result = yield* hooks.inject(
						root,
						{ [AGE_4320_DEP_NAME]: "1.0.0", [AGE_1440_DEP_NAME]: "1.0.0" },
						SEED,
					);
					assert.deepStrictEqual(result.releaseAge, { ageMinutes: 1440, exclude: ["@scope/b"] });
				}),
			);
		});

		it.layer(ConfigDependencyHooks.layerLive, { timeout: "30 seconds" })((it) => {
			it.effect("a hook returning garbage release-age values drops them — tolerant, never a typed failure", () =>
				Effect.gen(function* () {
					const hooks = yield* ConfigDependencyHooks;
					// The `age-garbage` fixture returns a non-numeric age and a non-array
					// exclude. A hook's returned DATA is read tolerantly (only a load/replay
					// mechanism failure is typed), so both are dropped: an empty contribution.
					const result = yield* hooks.inject(root, { [AGE_GARBAGE_DEP_NAME]: "1.0.0" }, SEED);
					assert.deepStrictEqual(result.releaseAge, {});
				}),
			);
		});
	});

	describe("WorkspaceCatalogs.releaseAgeGate — combines inline + hook sources strictest-wins", () => {
		// The virtual tree is keyed to the REAL temp root: the effect-FileSystem read of
		// pnpm-workspace.yaml is virtual, while layerLive's node:fs read of the config
		// dependency's real pnpmfile hits disk under the same root — the same split the
		// default-layer test above relies on.
		const treeWith = (inlineAge: number, inlineExclude: readonly string[], dep: string): Tree => ({
			[`${root}/pnpm-workspace.yaml`]: [
				"packages:",
				"  - packages/*",
				`minimumReleaseAge: ${inlineAge}`,
				// Emit the exclude block only when non-empty — a bare `key:` line yields a
				// null value pnpm treats as no excludes.
				...(inlineExclude.length > 0
					? ["minimumReleaseAgeExclude:", ...inlineExclude.map((pattern) => `  - "${pattern}"`)]
					: []),
				"configDependencies:",
				`  ${dep}: '1.0.0'`,
				"",
			].join("\n"),
			[`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
			[`${root}/packages/a/package.json`]: manifest("@x/a"),
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const tree = treeWith(1440, ["inline-excl"], AGE_4320_DEP_NAME);
					const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
						Layer.provideMerge(platform(tree)),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("the hook's stricter age wins and excludes union", () =>
				Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const gate = yield* catalogs.releaseAgeGate;
					// Inline 1440 vs hook 4320 → max is the hook's 4320.
					assert.strictEqual(gate.ageMinutes, 4320);
					// Excludes union: the inline pattern plus the hook's two, deduped.
					assert.deepStrictEqual([...gate.exclude].sort(), ["@scope/a", "inline-excl", "typescript"]);
				}),
			);
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const tree = treeWith(10_000, [], AGE_1440_DEP_NAME);
					const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
						Layer.provideMerge(platform(tree)),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("the inline stricter age wins", () =>
				Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const gate = yield* catalogs.releaseAgeGate;
					// Inline 10000 vs hook 1440 → max is the inline 10000.
					assert.strictEqual(gate.ageMinutes, 10_000);
					// Only the hook set an exclude here.
					assert.deepStrictEqual([...gate.exclude], ["@scope/b"]);
				}),
			);
		});
	});

	// The link this suite exists to pin: rules computed by `inject` must actually be
	// READ BACK at the WorkspaceCatalogs call site. That link was written correctly
	// and had no test — a discard-by-projection there would have compiled, passed
	// every seam unit test, and returned an empty rules set indistinguishable from
	// "this workspace declares none".
	describe("WorkspaceCatalogs.peerDependencyRules — the injected rules reach the caller", () => {
		const tree = (): Tree => ({
			[`${root}/pnpm-workspace.yaml`]: [
				"packages:",
				"  - packages/*",
				// The workspace-file half, in the parent-VERSIONED spelling `pnpm:export`
				// materializes.
				"peerDependencyRules:",
				"  allowedVersions:",
				'    "inline-parent@1.2.3>inline-peer": "^1.0.0"',
				"configDependencies:",
				`  ${PEER_RULES_DEP_NAME}: '1.0.0'`,
				"",
			].join("\n"),
			[`${root}/package.json`]: manifest("root", { version: "0.0.0", private: true }),
			[`${root}/packages/a/package.json`]: manifest("@x/a"),
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
						Layer.provideMerge(platform(tree())),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("a hook-injected rule arrives, alongside the seeded workspace-file rule", () =>
				Effect.gen(function* () {
					const catalogs = yield* WorkspaceCatalogs;
					const rules = yield* catalogs.peerDependencyRules;

					// The hook's contribution — the assertion that fails if the call site
					// stops reading `injection.peerDependencyRules`, and only then.
					assert.strictEqual(rules.allowedVersions["hooked-parent>hooked-peer"], "^9.0.0");
					// And the seeded half survives the replay, which is why seeding works.
					assert.strictEqual(rules.allowedVersions["inline-parent@1.2.3>inline-peer"], "^1.0.0");
					// Both key spellings coexist, unversioned from the plugin and versioned
					// from the file.
					assert.strictEqual(Object.keys(rules.allowedVersions).length, 2);
				}),
			);
		});

		it.layer(
			Layer.unwrap(
				Effect.sync(() => {
					const appLayer = Workspaces.layerWithConfigDependencies({ cwd: root }).pipe(
						Layer.provideMerge(platform(tree())),
					);
					return appLayer;
				}),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("the unconsumed axes arrive empty rather than absent", () =>
				Effect.gen(function* () {
					const rules = yield* (yield* WorkspaceCatalogs).peerDependencyRules;
					assert.deepStrictEqual(rules.ignoreMissing, []);
					assert.deepStrictEqual(rules.allowAny, []);
				}),
			);
		});
	});
});
