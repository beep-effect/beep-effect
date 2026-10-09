// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file processEnvInEffect:skip-file
// The declared-version resolution ladder, driven through BOTH replaying layers
// against one on-disk fixture — a fake `.pnpm-config` install and a fake pnpm
// store `links/` tree — so `layerLive` and `layerSubprocess` are pinned to
// resolve identically. And `layerFrom`, the hermetic seam that resolves
// nothing.
//
// Real filesystem by necessity: the ladder reads through `node:fs` (the store
// is real even when a caller's FileSystem is virtual), and the subprocess
// layer spawns a real `node`.

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { CatalogAssemblyError } from "../../../effected/npm/index.ts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { ConfigDependencyHooks, WorkspaceCatalogs, Workspaces } from "../../../effected/workspaces/index.ts";
import type { Tree } from "../fixtures.ts";
import { manifest, platform } from "../fixtures.ts";
import {
	installConfigDependency,
	installedDir,
	linkConfigDependency,
	pnpmfileInjecting,
	pnpmfileInjectingCjs,
	storeConfigDependency,
	writeModulesYaml,
} from "./utils/configDependencyFixtures.ts";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const SEED = { default: { effect: "^4.0.0" } } as const;

// The dependency under test: 1.0.0 installed under `.pnpm-config`, 2.0.0 only
// in the store, 3.0.0 nowhere. Each pnpmfile injects a DIFFERENT range so the
// injected catalog proves which file ran.
const NAME = "cfg-ladder";
// Installed at 2.0.0 with NO pnpmfile: the one legitimate skip.
const NO_HOOK = "cfg-nohook";
// A `.pnpm-config` directory with no package.json at all.
const NO_MANIFEST = "cfg-nomanifest";
// A `.pnpm-config` manifest with no `version` field, and one whose version is
// the empty string: both carry no usable version (part of effected#613).
const UNVERSIONED = "cfg-unversioned";
const EMPTY_VERSION = "cfg-emptyversion";
// Only in the store, shipping ONLY `pnpmfile.js`.
const JS_ONLY = "cfg-js";
// A scoped name, only in the store.
const SCOPED = "@scope/cfg-scoped";
// In the store TWICE at one version, under two hash directories, both honest.
const AMBIGUOUS = "cfg-ambiguous";
// Only in a store reachable through `$PNPM_HOME/store` — rung 3 of discovery.
const ENV_ONLY = "cfg-env";
// Held by BOTH the workspace's store (rung 1) and the `$PNPM_HOME` store (rung 3).
const TWO_STORES = "cfg-twostores";
// Held by three store FORMATS under one `$PNPM_HOME` (`v9`, `v10`, `v11`).
const FORMATS = "cfg-formats";

let root: string;
let store: string;
/** A second root with NO `.modules.yaml`, whose only `.pnpm-config` entry is a symlink into `store`. */
let linkedRoot: string;
/** A third root with nothing under node_modules at all. */
let bareRoot: string;
/** A fake `$PNPM_HOME` whose `store/v11` holds ENV_ONLY and a second TWO_STORES. */
let envHome: string;
/** A root whose `.modules.yaml` names `store` through a SYMLINK spelling, beside a `.pnpm-config` symlink that realpaths into it. */
let aliasRoot: string;

const Spawner = NodeChildProcessSpawner.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)));
const HooksSubprocess = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(Spawner));

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "effected-ladder-root-"));
	store = join(mkdtempSync(join(tmpdir(), "effected-ladder-store-")), "v11");
	linkedRoot = mkdtempSync(join(tmpdir(), "effected-ladder-linked-"));
	bareRoot = mkdtempSync(join(tmpdir(), "effected-ladder-bare-"));

	writeModulesYaml(root, store);
	installConfigDependency(root, NAME, "1.0.0", ["pnpmfile.mjs", pnpmfileInjecting("^1.0.0")]);
	installConfigDependency(root, NO_HOOK, "2.0.0");
	mkdirSync(installedDir(root, NO_MANIFEST), { recursive: true });
	installConfigDependency(root, UNVERSIONED, undefined, ["pnpmfile.mjs", pnpmfileInjecting("^6.0.0")]);
	mkdirSync(installedDir(root, EMPTY_VERSION), { recursive: true });
	writeFileSync(
		join(installedDir(root, EMPTY_VERSION), "package.json"),
		JSON.stringify({ name: EMPTY_VERSION, version: "" }),
	);

	const stored = storeConfigDependency(store, NAME, "2.0.0", "a".repeat(64), [
		"pnpmfile.mjs",
		pnpmfileInjecting("^2.0.0"),
	]);
	// A second hash directory for the same version whose manifest LIES (a
	// different version) — the ladder must verify the inner manifest, not trust
	// the path.
	const liar = join(store, "links", NAME, "2.0.0", "b".repeat(64), "node_modules", NAME);
	mkdirSync(liar, { recursive: true });
	writeFileSync(join(liar, "package.json"), JSON.stringify({ name: NAME, version: "9.9.9" }));
	writeFileSync(join(liar, "pnpmfile.mjs"), pnpmfileInjecting("^9.9.9"));
	storeConfigDependency(store, JS_ONLY, "1.0.0", "c".repeat(64), ["pnpmfile.js", pnpmfileInjectingCjs("^7.0.0")]);
	storeConfigDependency(store, SCOPED, "1.0.0", "d".repeat(64), ["pnpmfile.mjs", pnpmfileInjecting("^5.0.0")]);

	// Two HONEST copies of one version: neither manifest lies, so the version
	// check cannot separate them — only an integrity the store does not record
	// could, and the ladder must refuse to guess.
	storeConfigDependency(store, AMBIGUOUS, "1.0.0", "e".repeat(64), ["pnpmfile.mjs", pnpmfileInjecting("^1.0.0")]);
	storeConfigDependency(store, AMBIGUOUS, "1.0.0", "f".repeat(64), ["pnpmfile.mjs", pnpmfileInjecting("^1.0.1")]);

	// The linked root: `.pnpm-config/cfg-ladder -> <store>/links/cfg-ladder/2.0.0/…`,
	// the way pnpm installs, and no `.modules.yaml` to name the store.
	linkConfigDependency(linkedRoot, NAME, stored);

	// Rung 3: a store that ONLY `$PNPM_HOME/store` can name.
	envHome = mkdtempSync(join(tmpdir(), "effected-ladder-pnpmhome-"));
	storeConfigDependency(join(envHome, "store", "v11"), ENV_ONLY, "1.0.0", "1".repeat(64), [
		"pnpmfile.mjs",
		pnpmfileInjecting("^8.0.0"),
	]);
	// One version in TWO distinct stores, each with a different pnpmfile so the
	// injected range proves which store answered.
	storeConfigDependency(store, TWO_STORES, "1.0.0", "2".repeat(64), ["pnpmfile.mjs", pnpmfileInjecting("^3.0.0")]);
	storeConfigDependency(join(envHome, "store", "v11"), TWO_STORES, "1.0.0", "3".repeat(64), [
		"pnpmfile.mjs",
		pnpmfileInjecting("^4.0.0"),
	]);

	// Three store formats side by side, as a pnpm major upgrade leaves them; the
	// injected range names the format that answered.
	for (const [format, range] of [
		["v9", "^9.0.0"],
		["v10", "^10.0.0"],
		["v11", "^11.0.0"],
	] as const) {
		storeConfigDependency(join(envHome, "store", format), FORMATS, "1.0.0", "4".repeat(64), [
			"pnpmfile.mjs",
			pnpmfileInjecting(range),
		]);
	}

	// The alias root: `.modules.yaml` spells the store through a symlink while
	// the `.pnpm-config` entry realpaths into the same store — one physical
	// store, two spellings.
	aliasRoot = mkdtempSync(join(tmpdir(), "effected-ladder-alias-"));
	const alias = join(aliasRoot, "store-alias");
	symlinkSync(store, alias, "dir");
	writeModulesYaml(aliasRoot, alias);
	linkConfigDependency(aliasRoot, NAME, stored);
});

afterAll(() => {
	for (const dir of [root, dirname(store), linkedRoot, bareRoot, envHome, aliasRoot]) {
		if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
	}
});

const hooked = (result: { readonly catalogs: Readonly<Record<string, Readonly<Record<string, string>>>> }) =>
	result.catalogs.default?.["hooked-dep"];

const ladderCases = (label: string, hooksLayer: Layer.Layer<ConfigDependencyHooks>) => {
	describe(`${label} — resolves the DECLARED version`, () => {
		it.effect("declared version installed under .pnpm-config → that copy runs (candidate A)", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(root, { [NAME]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^1.0.0");
				assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
				assert.deepStrictEqual(result.replays, { [NAME]: { version: "1.0.0", source: "installed" } });
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a `<version>+<integrity>` spec resolves by its version part", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(root, { [NAME]: "1.0.0+sha512-abcdef" }, SEED);
				assert.strictEqual(hooked(result), "^1.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("declared version NOT installed but in the store → the store copy runs (candidate B)", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// `.pnpm-config` holds 1.0.0; the ref declares 2.0.0. The injected range
				// is the STORE pnpmfile's, proving the installed one did not run.
				const result = yield* hooks.inject(root, { [NAME]: "2.0.0+sha512-xyz" }, SEED);
				assert.strictEqual(hooked(result), "^2.0.0");
				// The record names the DECLARED version (integrity stripped) and the rung.
				assert.deepStrictEqual(result.replays, { [NAME]: { version: "2.0.0", source: "store" } });
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a store hash directory whose manifest carries another version is not trusted", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// Both `links/<name>/2.0.0/<hash>` entries exist; only the one whose
				// inner package.json says 2.0.0 may run. Wrong-in-one-way: `^9.9.9`
				// here means the ladder trusted the path.
				const result = yield* hooks.inject(root, { [NAME]: "2.0.0" }, SEED);
				assert.notStrictEqual(hooked(result), "^9.9.9");
				assert.strictEqual(hooked(result), "^2.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("declared version installed nowhere → typed, fail-closed, naming the remediation", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const error = yield* Effect.flip(hooks.inject(root, { [NAME]: "3.0.0+sha512-nope" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "hooks");
				assert.strictEqual(error.path, NAME);
				if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
				const message = error.cause.message;
				assert.include(message, `${NAME}@3.0.0`);
				// What `.pnpm-config` holds instead.
				assert.include(message, "version 1.0.0");
				// Where the store was searched.
				assert.include(message, store);
				// And how to fix it.
				assert.include(message, `pnpm add --config ${NAME}@3.0.0`);
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a .pnpm-config directory with no package.json is 'nothing', not a match", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const error = yield* Effect.flip(hooks.inject(root, { [NO_MANIFEST]: "1.0.0" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.path, NO_MANIFEST);
				if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
				assert.include(error.cause.message, "holds nothing");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a .pnpm-config manifest with no usable version is 'a package with no version', not a match", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// The subprocess layer would fetch, but a bare spec with no lockfile
				// records no integrity, so it fails before any spawn — with the same
				// not-installed diagnosis.
				const reason = label.includes("layerSubprocess") ? "integrityUnavailable" : "notInstalled";
				for (const name of [UNVERSIONED, EMPTY_VERSION]) {
					const error = yield* Effect.flip(hooks.inject(root, { [name]: "1.0.0" }, SEED));
					assert.instanceOf(error, CatalogAssemblyError);
					assert.strictEqual(error.path, name);
					assert.strictEqual(error.reason, reason);
					if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
					const message = error.cause.message;
					assert.include(message, `node_modules/.pnpm-config/${name} holds a package with no version,`);
					// No version to compare, so no "declares a different version" diagnosis.
					assert.notInclude(message, "declares a different version");
				}
				// Nor does an empty declared version match an unversioned manifest.
				const empty = yield* Effect.flip(hooks.inject(root, { [EMPTY_VERSION]: "" }, SEED));
				assert.strictEqual(empty.reason, reason);
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a declared dependency that is not installed at all fails closed — never a silent skip", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// The pre-ladder behaviour was to skip an absent directory as "no
				// pnpmfile". A declared config dependency that cannot be found is now
				// an error: silently skipping it is exactly how a hook-only catalog
				// went missing on one side of a diff.
				const error = yield* Effect.flip(hooks.inject(root, { "absent-dep": "1.0.0" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "hooks");
				assert.strictEqual(error.path, "absent-dep");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("the store is found through a .pnpm-config symlink's realpath when .modules.yaml is absent", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// `linkedRoot` has no `.modules.yaml`; its only `.pnpm-config` entry is
				// `cfg-ladder` symlinked into the fake store. Declaring a SIBLING that
				// lives only in that store proves the store was discovered by walking
				// the symlink up to its `links` ancestor — not by rung 1, and not by
				// candidate A (cfg-js is not installed here at all).
				const result = yield* hooks.inject(linkedRoot, { [JS_ONLY]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^7.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a symlinked .pnpm-config entry at the declared version is candidate A", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(linkedRoot, { [NAME]: "2.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^2.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("pnpmfile.js is accepted, after .mjs and .cjs", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(root, { [JS_ONLY]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^7.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a scoped name resolves through the store's nested links directory", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(root, { [SCOPED]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^5.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a resolved dependency with no pnpmfile contributes nothing — the one legitimate skip", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const result = yield* hooks.inject(root, { [NO_HOOK]: "2.0.0" }, SEED);
				assert.deepStrictEqual(result, {
					catalogs: SEED,
					releaseAge: {},
					peerDependencyRules: { allowedVersions: {}, ignoreMissing: [], allowAny: [] },
					// Still RECORDED: it was resolved, it just contributed nothing.
					replays: { [NO_HOOK]: { version: "2.0.0", source: "installed" } },
				});
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("declaration order is replay order across installed and store copies", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// cfg-ladder@1.0.0 (installed) then cfg-js@1.0.0 (store): the later hook
				// rewrites `hooked-dep`, last write wins — and swapping the order flips it.
				const forward = yield* hooks.inject(root, { [NAME]: "1.0.0", [JS_ONLY]: "1.0.0" }, SEED);
				const reverse = yield* hooks.inject(root, { [JS_ONLY]: "1.0.0", [NAME]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(forward), "^7.0.0");
				assert.strictEqual(hooked(reverse), "^1.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("two honest store copies of one version are AMBIGUOUS → typed, naming both, replaying neither", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const error = yield* Effect.flip(hooks.inject(root, { [AMBIGUOUS]: "1.0.0+sha512-pinned" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "hooks");
				assert.strictEqual(error.path, AMBIGUOUS);
				if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
				const message = error.cause.message;
				assert.include(message, "ambiguous");
				assert.include(message, "2 copies");
				// The store is named by its REALPATH (macOS's `/var` is `/private/var`):
				// discovery canonicalizes spellings so one store never counts twice.
				assert.include(message, `store at ${realpathSync(store)}`);
				assert.include(message, "e".repeat(64));
				assert.include(message, "f".repeat(64));
				// The control that makes this discriminating: the SAME two-hash shape
				// with one manifest lying (NAME@2.0.0) resolves fine — ambiguity is
				// about two HONEST copies, not about a second directory existing.
				const fine = yield* hooks.inject(root, { [NAME]: "2.0.0" }, SEED);
				assert.strictEqual(hooked(fine), "^2.0.0");
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("one store reached by two spellings is ONE store — an aliased path is never 'ambiguous'", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				// aliasRoot discovers `store` twice: once through the symlink spelling
				// in .modules.yaml (rung 1) and once through the .pnpm-config
				// realpath (rung 2). JS_ONLY lives ONLY in that store, under exactly
				// one honest hash — so it must resolve from the store, once.
				const result = yield* hooks.inject(aliasRoot, { [JS_ONLY]: "1.0.0" }, SEED);
				assert.strictEqual(hooked(result), "^7.0.0");
				assert.deepStrictEqual(result.replays, { [JS_ONLY]: { version: "1.0.0", source: "store" } });
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a version held by two distinct stores resolves from the FIRST in discovery order", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const previous = process.env.PNPM_HOME;
				process.env.PNPM_HOME = envHome;
				try {
					// `root` names `store` in .modules.yaml (rung 1); $PNPM_HOME adds a
					// second store (rung 3) that also holds TWO_STORES@1.0.0. Not
					// ambiguous — the workspace's own store wins, and its pnpmfile ran.
					const result = yield* hooks.inject(root, { [TWO_STORES]: "1.0.0" }, SEED);
					assert.strictEqual(hooked(result), "^3.0.0");
				} finally {
					if (previous === undefined) delete process.env.PNPM_HOME;
					else process.env.PNPM_HOME = previous;
				}
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("store formats are consulted NEWEST first, numerically — v11 beats v10 beats v9", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const previous = process.env.PNPM_HOME;
				process.env.PNPM_HOME = envHome;
				try {
					// A lexical sort would put v10 first (and v9 last); the newest
					// format must answer, or a pnpm upgrade that left the old store
					// behind replays the stale copy.
					const result = yield* hooks.inject(bareRoot, { [FORMATS]: "1.0.0" }, SEED);
					assert.strictEqual(hooked(result), "^11.0.0");
				} finally {
					if (previous === undefined) delete process.env.PNPM_HOME;
					else process.env.PNPM_HOME = previous;
				}
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("rung 3: a store named only by $PNPM_HOME is found when .modules.yaml and .pnpm-config say nothing", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const previous = process.env.PNPM_HOME;
				process.env.PNPM_HOME = envHome;
				try {
					// bareRoot has no node_modules at all, so rungs 1 and 2 contribute
					// no store; only the environment rung can answer.
					const result = yield* hooks.inject(bareRoot, { [ENV_ONLY]: "1.0.0" }, SEED);
					assert.strictEqual(hooked(result), "^8.0.0");
					assert.deepStrictEqual(result.replays, { [ENV_ONLY]: { version: "1.0.0", source: "store" } });
				} finally {
					if (previous === undefined) delete process.env.PNPM_HOME;
					else process.env.PNPM_HOME = previous;
				}
				// The control: without the variable the same declaration fails closed
				// and the message shows the env store was NOT among those searched.
				const error = yield* Effect.flip(hooks.inject(bareRoot, { [ENV_ONLY]: "1.0.0" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
				assert.notInclude(error.cause.message, envHome);
			}).pipe(Effect.provide(hooksLayer)),
		);

		it.effect("a '..' segment is refused before any path is built", () =>
			Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				const error = yield* Effect.flip(hooks.inject(bareRoot, { "../../evil": "1.0.0" }, SEED));
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.path, "../../evil");
				if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
				assert.include(error.cause.message, "'..' path segment");
			}).pipe(Effect.provide(hooksLayer)),
		);
	});
};

ladderCases("ConfigDependencyHooks.layerLive", ConfigDependencyHooks.layerLive);
ladderCases("ConfigDependencyHooks.layerSubprocess", HooksSubprocess);

describe("layerLive and layerSubprocess — the ladder is one implementation", () => {
	it.effect("both layers produce identical injections across installed, store and skipped dependencies", () =>
		Effect.gen(function* () {
			const deps = { [NAME]: "2.0.0+sha512-x", [NO_HOOK]: "2.0.0", [SCOPED]: "1.0.0" };
			const run = Effect.gen(function* () {
				const hooks = yield* ConfigDependencyHooks;
				return yield* hooks.inject(root, deps, SEED);
			});
			const live = yield* run.pipe(Effect.provide(ConfigDependencyHooks.layerLive));
			const subprocess = yield* run.pipe(Effect.provide(HooksSubprocess));
			assert.deepStrictEqual(subprocess, live);
			assert.strictEqual(hooked(live), "^5.0.0");
			assert.deepStrictEqual(live.replays, {
				[NAME]: { version: "2.0.0", source: "store" },
				[NO_HOOK]: { version: "2.0.0", source: "installed" },
				[SCOPED]: { version: "1.0.0", source: "store" },
			});
		}),
	);
});

// ── layerFrom: the hermetic seam ────────────────────────────────────────────

describe("ConfigDependencyHooks.layerFrom — replays caller-supplied files, resolving nothing", () => {
	const ONE = join(FIXTURES, "hook-pnpmfile.mjs");
	const TWO = join(FIXTURES, "hook-pnpmfile.cjs");

	it.effect("a hit replays the mapped file for that declared version", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			// The root is a path that does not exist: layerFrom must not look there.
			const result = yield* hooks.inject("/nowhere/at/all", { "@scope/plugin": "1.0.0+sha512-abc" }, SEED);
			// hook-pnpmfile.mjs injects `mjs-dep`; the .cjs would inject `hooked-dep`.
			assert.strictEqual(result.catalogs.default?.["mjs-dep"], "^2.0.0");
			assert.isUndefined(result.catalogs.default?.["hooked-dep"]);
			assert.strictEqual(result.catalogs.default?.effect, "^4.0.0");
			assert.deepStrictEqual(result.replays, { "@scope/plugin": { version: "1.0.0", source: "supplied" } });
		}).pipe(
			Effect.provide(ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE, "@scope/plugin@2.0.0": TWO })),
		),
	);

	it.effect("two declared versions of one name map to two different files", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const v2 = yield* hooks.inject("/nowhere", { "@scope/plugin": "2.0.0" }, SEED);
			assert.strictEqual(v2.catalogs.default?.["hooked-dep"], "^9.9.9");
			assert.isUndefined(v2.catalogs.default?.["mjs-dep"]);
		}).pipe(
			Effect.provide(ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE, "@scope/plugin@2.0.0": TWO })),
		),
	);

	it.effect("a miss fails closed with the same hooks-source shape as an uninstalled version", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject("/nowhere", { "@scope/plugin": "3.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "hooks");
			assert.strictEqual(error.path, "@scope/plugin");
			if (!(error.cause instanceof Error)) return assert.fail("expected an Error cause");
			assert.include(error.cause.message, "@scope/plugin@3.0.0");
		}).pipe(Effect.provide(ConfigDependencyHooks.layerFrom({ "@scope/plugin@1.0.0": ONE }))),
	);

	it.effect("empty configDependencies returns the seed untouched", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const rules = { allowedVersions: { "a>b": "1.0.0" }, ignoreMissing: [], allowAny: [] };
			const result = yield* hooks.inject("/nowhere", {}, SEED, rules);
			assert.deepStrictEqual(result, { catalogs: SEED, releaseAge: {}, peerDependencyRules: rules, replays: {} });
		}).pipe(Effect.provide(ConfigDependencyHooks.layerFrom({}))),
	);

	it.effect("a '..' segment is refused before the lookup", () =>
		Effect.gen(function* () {
			const hooks = yield* ConfigDependencyHooks;
			const error = yield* Effect.flip(hooks.inject("/nowhere", { "../../evil": "1.0.0" }, SEED));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.path, "../../evil");
		}).pipe(Effect.provide(ConfigDependencyHooks.layerFrom({ "../../evil@1.0.0": ONE }))),
	);

	it.effect("works under a memfs FileSystem: the whole catalog path replays with no real root", () => {
		// The point of the seam: a virtual workspace whose `pnpm-workspace.yaml`
		// declares a config dependency, replayed through layerFrom against a real
		// fixture file — no `.pnpm-config`, no store, no `.modules.yaml`.
		const tree: Tree = {
			"/repo/pnpm-workspace.yaml": [
				"packages:",
				"  - packages/*",
				"catalog:",
				"  effect: ^4.0.0",
				"configDependencies:",
				"  '@scope/plugin': '2.0.0+sha512-abc'",
				"",
			].join("\n"),
			"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0", private: true }),
			"/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
		};
		const hooks = ConfigDependencyHooks.layerFrom({ "@scope/plugin@2.0.0": TWO });
		const core = Workspaces.layer({ cwd: "/repo" });
		const catalogs = Layer.effect(WorkspaceCatalogs, WorkspaceCatalogs.make({ cwd: "/repo" })).pipe(
			Layer.provide(hooks),
			Layer.provide(core),
		);
		// Last wins in `mergeAll`: the replaying catalogs layer replaces the
		// core's no-op one.
		const appLayer = Layer.mergeAll(core, catalogs).pipe(Layer.provideMerge(platform(tree)));
		return Effect.gen(function* () {
			const set = yield* (yield* WorkspaceCatalogs).set;
			assert.deepStrictEqual(set.rangeOf("effect", O.none()), O.some("^4.0.0"));
			assert.deepStrictEqual(set.rangeOf("hooked-dep", O.none()), O.some("^9.9.9"));
		}).pipe(Effect.provide(appLayer));
	});
});
