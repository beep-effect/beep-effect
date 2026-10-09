// @effect-diagnostics strictEffectProvide:skip-file nodeBuiltinImport:skip-file processEnv:skip-file processEnvInEffect:skip-file
// `WorkspaceSnapshots.at(ref)` through the REAL composites, over a real git
// repository: two commits that declare two different versions of one config
// dependency, with the older version installed under `.pnpm-config` and the
// newer one present only in a (fake) pnpm store.
//
// Pins the two composite-level truths at once:
// - `layerWithGitAndConfigDependencies` replays each ref's hook at THAT ref's
//   declared version — so the config-dependency bump between the refs is a
//   visible catalog change, on `at(ref)` alone, with no seed.
// - `layerWithGit` (the default) executes no config-dependency code on the
//   ref side either: the marker the pnpmfile would write stays absent and the
//   hook-only catalog stays unresolved.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import {
	ConfigDependencyHooks,
	WorkspaceSnapshots,
	WorkspaceStateSnapshot,
	Workspaces,
} from "../../../effected/workspaces/index.ts";
import { installConfigDependency, storeConfigDependency, writeModulesYaml } from "./utils/configDependencyFixtures.ts";
import { assertSome, assertNone } from "@effect/vitest/utils";

const NAME = "cfg-replay";

let root: string;
let store: string;
let markerPath: string;

/** A pnpmfile injecting `hooked-dep` at `range`, and touching `HOOK_MARKER` so execution is observable. */
const markingPnpmfile = (range: string): string =>
	[
		'import { writeFileSync } from "node:fs";',
		"export const hooks = {",
		"\tupdateConfig(config) {",
		"\t\tconst marker = process.env.HOOK_MARKER;",
		`\t\tif (marker) writeFileSync(marker, "${range}");`,
		`\t\treturn { ...config, catalog: { ...(config.catalog ?? {}), "hooked-dep": "${range}" } };`,
		"\t},",
		"};",
		"",
	].join("\n");

const workspaceYaml = (spec: string): string =>
	[
		"packages:",
		"  - packages/*",
		"catalog:",
		"  effect: ^4.0.0",
		"configDependencies:",
		`  ${NAME}: '${spec}'`,
		"",
	].join("\n");

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "effected-replay-repo-"));
	store = join(mkdtempSync(join(tmpdir(), "effected-replay-store-")), "v11");
	markerPath = join(dirname(store), "marker.txt");

	// 1.0.0 installed under .pnpm-config; 2.0.0 only in the store.
	writeModulesYaml(root, store);
	installConfigDependency(root, NAME, "1.0.0", ["pnpmfile.mjs", markingPnpmfile("^1.0.0")]);
	storeConfigDependency(store, NAME, "2.0.0", "f".repeat(64), ["pnpmfile.mjs", markingPnpmfile("^2.0.0")]);

	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "0.0.0", private: true }));
	mkdirSync(join(root, "packages", "a"), { recursive: true });
	writeFileSync(
		join(root, "packages", "a", "package.json"),
		JSON.stringify({ name: "@x/a", version: "1.0.0", dependencies: { effect: "catalog:", "hooked-dep": "catalog:" } }),
	);
	writeFileSync(join(root, ".gitignore"), "node_modules\n");

	const git = (...args: ReadonlyArray<string>): void => {
		execFileSync("git", args, { cwd: root, env: { ...process.env, LC_ALL: "C", GIT_TERMINAL_PROMPT: "0" } });
	};
	git("init", "-q");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "Test");
	// `before`: declares 1.0.0 (with the integrity suffix pnpm writes).
	writeFileSync(join(root, "pnpm-workspace.yaml"), workspaceYaml("1.0.0+sha512-before"));
	git("add", "-A");
	git("commit", "-q", "-m", "before");
	git("tag", "before");
	// `after`: bumps the config dependency to 2.0.0 (bare spec), nothing else.
	writeFileSync(join(root, "pnpm-workspace.yaml"), workspaceYaml("2.0.0"));
	git("add", "-A");
	git("commit", "-q", "-m", "after");
	git("tag", "after");
});

afterAll(() => {
	for (const dir of [root, dirname(store)]) {
		if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
	}
});

describe("Workspaces.layerWithGitAndConfigDependencies — at(ref) replays the ref's pinned config dependency", () => {
	it.layer(
		Layer.unwrap(
			Effect.sync(() => {
				const Live = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(
					Layer.provideMerge(NodeServices.layer),
				);
				return Live;
			}),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a config-dependency bump between two refs is a visible catalog change, with no seed", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				const after = yield* snapshots.at("after");
				// `before` declares 1.0.0 → the INSTALLED pnpmfile; `after` declares
				// 2.0.0 → the STORE pnpmfile. Each ref's OWN catalogs carry its range.
				assertSome(before.catalogs.rangeOf("hooked-dep", O.none()), "^1.0.0");
				assertSome(after.catalogs.rangeOf("hooked-dep", O.none()), "^2.0.0");
				// The diff shape a consumer reads: cross-seeding does not blur it.
				const [seededBefore, seededAfter] = WorkspaceStateSnapshot.crossSeed(before, after);
				assertSome(seededBefore.resolve("hooked-dep", "catalog:"), "^1.0.0");
				assertSome(seededAfter.resolve("hooked-dep", "catalog:"), "^2.0.0");
				// The control: the committed inline catalog reads the same on both.
				assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
				assertSome(after.resolve("effect", "catalog:"), "^4.0.0");
				// And each side records WHICH version it replayed (the installed copy
				// answered 1.0.0, the store 2.0.0 — that rung is live provenance on the
				// injection, not on the snapshot).
				assert.deepStrictEqual(before.hookReplays, { [NAME]: "1.0.0" });
				assert.deepStrictEqual(after.hookReplays, { [NAME]: "2.0.0" });
			}),
		);
	});

	it.layer(
		Layer.unwrap(
			Effect.sync(() => {
				const Live = Workspaces.layerWithGitAndConfigDependencies({ cwd: root }).pipe(
					Layer.provideMerge(NodeServices.layer),
				);
				return Live;
			}),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("worktree() and at(HEAD) agree — the same hooks layer serves both sides", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const head = yield* snapshots.at("HEAD");
				const live = yield* snapshots.worktree;
				assertSome(head.resolve("hooked-dep", "catalog:"), "^2.0.0");
				assertSome(live.resolve("hooked-dep", "catalog:"), "^2.0.0");
				// worktree() carries the record too, off WorkspaceCatalogs' one memo.
				assert.deepStrictEqual(live.hookReplays, { [NAME]: "2.0.0" });
				assert.deepStrictEqual(live.hookReplays, head.hookReplays);
			}),
		);
	});
});

describe("Workspaces.layerWithGitAndHooks — the hermetic seam reaches at(ref) without rebuilding the git graph", () => {
	it.layer(
		Layer.unwrap(
			Effect.sync(() => {
				const installed = join(root, "node_modules", ".pnpm-config", NAME, "pnpmfile.mjs");
				const stored = join(store, "links", NAME, "2.0.0", "f".repeat(64), "node_modules", NAME, "pnpmfile.mjs");
				const hooks = ConfigDependencyHooks.layerFrom({ [`${NAME}@1.0.0`]: stored, [`${NAME}@2.0.0`]: installed });
				const Live = Workspaces.layerWithGitAndHooks(hooks, { cwd: root }).pipe(Layer.provideMerge(NodeServices.layer));
				return Live;
			}),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layerFrom decides what each ref replays, and the disk is never consulted", () =>
			Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				const after = yield* snapshots.at("after");
				assertSome(before.catalogs.rangeOf("hooked-dep", O.none()), "^2.0.0");
				assertSome(after.catalogs.rangeOf("hooked-dep", O.none()), "^1.0.0");
				// The record still carries the DECLARED version — provenance is on the
				// injection (`supplied`), never on the snapshot.
				assert.deepStrictEqual(before.hookReplays, { [NAME]: "1.0.0" });
				assert.deepStrictEqual(after.hookReplays, { [NAME]: "2.0.0" });
				// And worktree() runs through the same supplied map as at(HEAD).
				const live = yield* snapshots.worktree;
				assertSome(live.resolve("hooked-dep", "catalog:"), "^1.0.0");
			}),
		);
	});
});

describe("Workspaces.layerWithGit — the default composite executes no config-dependency code at a ref", () => {
	it.layer(
		Layer.unwrap(
			Effect.sync(() => {
				const Default = Workspaces.layerWithGit({ cwd: root }).pipe(Layer.provideMerge(NodeServices.layer));
				return Default;
			}),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("at(ref) never writes the marker and abstains on the hook-only catalog", () => {
			process.env.HOOK_MARKER = markerPath;
			return Effect.gen(function* () {
				const snapshots = yield* WorkspaceSnapshots;
				const before = yield* snapshots.at("before");
				const after = yield* snapshots.at("after");
				const live = yield* snapshots.worktree;
				// Assembly ran — the committed catalog is there on every side.
				assertSome(before.resolve("effect", "catalog:"), "^4.0.0");
				// ...and no pnpmfile executed on any side: the ref reads, or the live one.
				assert.isFalse(existsSync(markerPath));
				assertNone(before.resolve("hooked-dep", "catalog:"));
				assertNone(after.resolve("hooked-dep", "catalog:"));
				assertNone(live.resolve("hooked-dep", "catalog:"));
				// Empty on every side: the no-op layer resolved nothing.
				assert.deepStrictEqual(before.hookReplays, {});
				assert.deepStrictEqual(live.hookReplays, {});
			}).pipe(
				Effect.ensuring(
					Effect.sync(() => {
						delete process.env.HOOK_MARKER;
					}),
				),
			);
		});
	});
});
