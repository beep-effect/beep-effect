import { assert, describe, it, layer } from "@effect/vitest";
import { Lockfile } from "../../effected/lockfiles/index.ts";
import { CatalogAssemblyError } from "../../effected/npm/index.ts";
import { Effect, Layer, Option, Result, Schema } from "effect";
import { CatalogSet, WorkspaceCatalogs, Workspaces } from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform } from "./fixtures.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

/** The full workspaces stack over a virtual tree, rooted at `/repo`. */
const workspacesOver = (tree: Tree) => Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform(tree)));

// ── CatalogSet.fromManifestWorkspaces: the hard-fail package.json reader ─────

describe("CatalogSet.fromManifestWorkspaces", () => {
	it.effect("an absent workspaces field yields the empty set", () =>
		Effect.gen(function* () {
			const set = yield* CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ name: "root" })));
			assert.isTrue(set.isEmpty);
		}),
	);

	it.effect("an explicitly null workspaces field yields the empty set", () =>
		Effect.gen(function* () {
			const set = yield* CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: null })));
			assert.isTrue(set.isEmpty);
		}),
	);

	it.effect("the plain array (npm/yarn) form carries no catalogs", () =>
		Effect.gen(function* () {
			const set = yield* CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: ["packages/*"] })));
			assert.isTrue(set.isEmpty);
		}),
	);

	it.effect("bun's workspaces.catalog and workspaces.catalogs assemble", () =>
		Effect.gen(function* () {
			const set = yield* CatalogSet.fromManifestWorkspaces(
				Result.getOrThrow(Schema.encodeResult(JsonValue)({
					workspaces: {
						packages: ["packages/*"],
						catalog: { effect: "^4.0.0" },
						catalogs: { build: { typescript: "^6.0.0" } },
					},
				})),
			);
			assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
			// The named catalog, not just the default — a bug keeping only one passes on the other.
			assert.deepStrictEqual(set.rangeOf("typescript", Option.some("build")), Option.some("^6.0.0"));
		}),
	);

	it.effect("a number workspaces field fails typed, never as a defect", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: 42 }))));
			assert.strictEqual(result._tag, "Failure");
			const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: 42 }))));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "manifest");
		}),
	);

	it.effect("a malformed workspaces.catalog fails typed", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				CatalogSet.fromManifestWorkspaces(Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: { catalog: "not-an-object" } }))),
			);
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "catalog");
			assert.strictEqual(error.path, "workspaces.catalog");
		}),
	);

	it.effect("the default catalog declared twice is rejected — even when empty (structural)", () =>
		Effect.gen(function* () {
			const text = Result.getOrThrow(Schema.encodeResult(JsonValue)({ workspaces: { catalog: {}, catalogs: { default: {} } } }));
			const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(text));
			assert.instanceOf(error, CatalogAssemblyError);
			assert.strictEqual(error.source, "catalog");
			assert.strictEqual(error.path, "default");
		}),
	);
});

// ── CatalogSet.fromLockfile: PM-aware lockfile catalogs ──────────────────────

describe("CatalogSet.fromLockfile", () => {
	it.effect("assembles a bun lockfile's BunExtension catalogs", () =>
		Effect.gen(function* () {
			const lockfile = yield* Lockfile.parse(
				Result.getOrThrow(Schema.encodeResult(JsonValue)({
					lockfileVersion: 1,
					catalog: { react: "^18.0.0" },
					catalogs: { build: { typescript: "^5.0.0" } },
				})),
				{ format: "bun" },
			);
			const set = CatalogSet.fromLockfile(lockfile);
			// The bun default catalog normalizes under "default".
			assert.deepStrictEqual(set.rangeOf("react", Option.none()), Option.some("^18.0.0"));
			assert.deepStrictEqual(set.rangeOf("typescript", Option.some("build")), Option.some("^5.0.0"));
		}),
	);

	it.effect("assembles a pnpm lockfile's catalogs", () =>
		Effect.gen(function* () {
			const lockfile = yield* Lockfile.parse(
				["lockfileVersion: '9.0'", "catalogs:", "  default:", "    effect: ^4.0.0", "importers:", "  .: {}", ""].join(
					"\n",
				),
				{ format: "pnpm" },
			);
			const set = CatalogSet.fromLockfile(lockfile);
			assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
		}),
	);
});

// ── Through the stack: a malformed package.json workspaces fails set() ────────

const doubleDefaultTree: Tree = {
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		workspaces: {
			packages: ["packages/*"],
			catalog: { effect: "^4.0.0" },
			catalogs: { default: { effect: "^3.0.0" } },
		},
	}),
	"/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceCatalogs.set — the double-default rejection through the stack", () => {
	layer(workspacesOver(doubleDefaultTree))((it) => {
		it.effect("the default catalog declared twice fails set() typed", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const result = yield* Effect.result(catalogs.set);
				assert.strictEqual(result._tag, "Failure");
				const error = yield* Effect.flip(catalogs.set);
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.path, "default");
			}),
		);
	});
});

const malformedTree: Tree = {
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		workspaces: { packages: ["packages/*"], catalog: "not-an-object" },
	}),
	"/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceCatalogs.set — a malformed workspaces shape through the stack", () => {
	layer(workspacesOver(malformedTree))((it) => {
		it.effect("a malformed workspaces.catalog fails set() typed", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const error = yield* Effect.flip(catalogs.set);
				assert.instanceOf(error, CatalogAssemblyError);
				assert.strictEqual(error.source, "catalog");
			}),
		);
	});
});

// ── Through the stack: a bun workspace — PM-aware inline AND lockfile ─────────

const bunWorkspace: Tree = {
	"/repo/package.json": JSON.stringify({
		name: "root",
		version: "0.0.0",
		private: true,
		packageManager: "bun@1.2.0",
		workspaces: {
			packages: ["packages/*"],
			catalog: { effect: "^4.0.0" },
			catalogs: { build: { typescript: "^6.0.0" } },
		},
	}),
	"/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
	// The bun lockfile records react (default) and a STALE typescript in `build`.
	// Inline must win on typescript; react must survive from the lockfile.
	"/repo/bun.lock": JSON.stringify({
		lockfileVersion: 1,
		catalog: { react: "^18.0.0" },
		catalogs: { build: { typescript: "^5.0.0" } },
	}),
};

describe("WorkspaceCatalogs.set — a bun workspace with no pnpm-workspace.yaml", () => {
	layer(workspacesOver(bunWorkspace))((it) => {
		it.effect("reads inline catalogs from the package.json workspaces block", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set;
				assert.deepStrictEqual(set.rangeOf("effect", Option.none()), Option.some("^4.0.0"));
			}),
		);

		it.effect("assembles the bun lockfile's BunExtension catalogs", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set;
				// react comes only from bun.lock — proof the BunExtension is assembled.
				assert.deepStrictEqual(set.rangeOf("react", Option.none()), Option.some("^18.0.0"));
			}),
		);

		it.effect("the inline block beats the lockfile within a named catalog", () =>
			Effect.gen(function* () {
				const catalogs = yield* WorkspaceCatalogs;
				const set = yield* catalogs.set;
				assert.deepStrictEqual(set.rangeOf("typescript", Option.some("build")), Option.some("^6.0.0"));
			}),
		);
	});
});
