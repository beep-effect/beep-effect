import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { LockfileReadError, LockfileReader, WorkspaceDiscovery, Workspaces } from "../../effected/workspaces/index.ts";
import type { Tree } from "./fixtures.ts";
import { manifest, platform } from "./fixtures.ts";

const workspacesOver = (tree: Tree) => Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform(tree)));

// The shape pnpm 11 actually writes when a workspace uses configDependencies:
// a small config-dependency lockfile FIRST, then the real one. Framing is
// `@effected/lockfiles`' job as of #58 — pnpm's writer always emits the
// config-dependencies document as a PREFIX, so the real lockfile is
// deterministically the LAST document. These tests pin that end-to-end through
// the reader: a naive first-document parse reports an empty workspace rather
// than a failure, which is the worst shape a bug can take.
const multiDocument: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\ncatalog:\n  effect: ^4.0.0\n",
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/a/package.json": manifest("@x/a"),
	"/repo/packages/b/package.json": manifest("@x/b"),
	"/repo/pnpm-lock.yaml": [
		"---",
		"lockfileVersion: '9.0'",
		"importers:",
		"  .:",
		"    configDependencies:",
		"      some-plugin:",
		"        specifier: 1.0.0",
		"        version: 1.0.0",
		"---",
		"lockfileVersion: '9.0'",
		"catalogs:",
		"  default:",
		"    effect:",
		"      specifier: ^4.0.0",
		"      version: 4.0.0",
		"importers:",
		"  .:",
		"    dependencies: {}",
		"  packages/a:",
		"    dependencies: {}",
		"  packages/b:",
		"    dependencies: {}",
		"",
	].join("\n"),
};

describe("LockfileReader — a multi-document pnpm lockfile", () => {
	layer(workspacesOver(multiDocument))((it) => {
		it.effect("selects the REAL lockfile, not the configDependencies preamble", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const lockfile = yield* reader.read;
				const workspaces = lockfile.packages.filter((pkg) => pkg.isWorkspace);
				// The preamble document has zero workspace importers. Taking it would
				// look like an empty workspace rather than a failure.
				assert.isAbove(workspaces.length, 0);
			}),
		);

		it.effect("resolves pnpm importer paths to real package names", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const lockfile = yield* reader.read;
				const names = lockfile.packages.filter((pkg) => pkg.isWorkspace).map((pkg) => pkg.name);
				assert.include(names, "@x/a");
				assert.include(names, "@x/b");
				assert.notInclude(names, "packages/a");
			}),
		);

		it.effect("resolvedVersion looks a package up by its resolved name", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const found = yield* reader.resolvedVersion("@x/a");
				assert.isTrue(O.isSome(found));
			}),
		);

		it.effect("resolvedVersion is none for a package the lockfile does not record", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				assert.isTrue(O.isNone(yield* reader.resolvedVersion("not-in-the-lockfile")));
			}),
		);

		it.effect("integrity compares the lockfile against the discovered manifests", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const report = yield* reader.integrity;
				// No workspace declares a dependency on another, so nothing is missing.
				assert.deepStrictEqual(report.unsatisfiedConstraints, []);
			}),
		);

		it.effect("discovery and the lockfile agree on the non-root membership", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const reader = yield* LockfileReader;
				// The root importer is not a workspace *package* in the lockfile model
				// (`@effected/lockfiles` emits only the non-root importers), so the
				// comparison is against discovery's non-root members.
				const discovered = (yield* discovery.listPackages)
					.filter((pkg) => !pkg.isRootWorkspace)
					.map((pkg) => pkg.name)
					.sort();
				const locked = (yield* reader.read).packages
					.filter((pkg) => pkg.isWorkspace)
					.map((pkg) => pkg.name)
					.sort();
				assert.deepStrictEqual(locked, discovered);
			}),
		);
	});
});

// ── a preamble followed by an empty main document ──────────────────────────

// pnpm 12.7.0's own output, verbatim (`@effected/lockfiles` fixture
// `pnpm/env-configonly-pnpm12`): an env preamble, then an EMPTY main document.
// pnpm writes these exact bytes both for a config-dependency-only workspace with
// no root package.json AND after a first install that failed once the config
// dependencies were in (fixture `pnpm/unsupported-interrupted-pnpm12`, byte-
// identical). Only the root package.json tells the two apart, and only this
// reader can look at it.
const configOnlyLockfile = [
	"---",
	"lockfileVersion: '9.0'",
	"",
	"importers:",
	"",
	"  .:",
	"    configDependencies:",
	"      '@effected/pnpm-plugin-effect':",
	"        specifier: 0.11.1",
	"        version: 0.11.1",
	"",
	"packages:",
	"",
	"  '@effected/pnpm-plugin-effect@0.11.1':",
	"    resolution: {integrity: sha512-m35mtvgU4nbE8ZHd4EFqKu5jJeQY0gPUYHzKTno57JT/QeHzM9RRLNQsIcG0npsFYBxJfJ1tC/NH4zEWc2gdxQ==}",
	"",
	"snapshots:",
	"",
	"  '@effected/pnpm-plugin-effect@0.11.1': {}",
	"",
	"---",
	"",
].join("\n");

const configOnlyWorkspace: Tree = {
	"/repo/pnpm-workspace.yaml": "configDependencies:\n  '@effected/pnpm-plugin-effect': 0.11.1\n",
	"/repo/pnpm-lock.yaml": configOnlyLockfile,
};

const interruptedInstall: Tree = {
	...configOnlyWorkspace,
	"/repo/package.json": JSON.stringify({
		name: "probe-root",
		private: true,
		dependencies: { "@effected/this-package-does-not-exist-xyz": "^1.0.0" },
	}),
};

describe("LockfileReader — a config-dependency-only workspace (no root package.json)", () => {
	layer(workspacesOver(configOnlyWorkspace))((it) => {
		it.effect("reads the preamble-plus-empty-main stream as an empty lockfile", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const lockfile = yield* reader.read;
				assert.strictEqual(lockfile.format, "pnpm");
				assert.strictEqual(lockfile.lockfileVersion, "9.0");
				assert.deepStrictEqual(lockfile.packages, []);
				assert.deepStrictEqual(lockfile.importers, []);
				// The preamble's config dependency is not a workspace package.
				assert.isTrue(O.isNone(yield* reader.resolvedVersion("@effected/pnpm-plugin-effect")));
			}),
		);
	});
});

describe("LockfileReader — the same bytes under a root package.json (an interrupted install)", () => {
	layer(workspacesOver(interruptedInstall))((it) => {
		it.effect("fails typed with 'noLockfileDocument', never an empty lockfile", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const error = yield* Effect.flip(reader.read);
				assert.strictEqual(error._tag, "LockfileFramingError");
				if (error._tag !== "LockfileFramingError") return;
				assert.strictEqual(error.reason, "noLockfileDocument");
				assert.strictEqual(error.documents, 2);
			}),
		);
	});
});

describe("LockfileReader — the root package.json probe itself fails", () => {
	// `exists` answers NotFound as `false`, but re-fails PermissionDenied. The
	// reader must not read "could not look" as "absent": configOnly is an
	// assertion of absence, so it fails closed.
	const deniedProbe = Workspaces.layer({ cwd: "/repo" }).pipe(
		Layer.provideMerge(platform(configOnlyWorkspace, { unreadableExists: new Set(["/repo/package.json"]) })),
	);
	layer(deniedProbe)((it) => {
		it.effect("does not assert configOnly: the ambiguous stream fails 'noLockfileDocument'", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const error = yield* Effect.flip(reader.read);
				assert.strictEqual(error._tag, "LockfileFramingError");
				if (error._tag !== "LockfileFramingError") return;
				assert.strictEqual(error.reason, "noLockfileDocument");
			}),
		);
	});
});

// ── the lockfile is missing ────────────────────────────────────────────────

const noLockfile: Tree = {
	"/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
	"/repo/package.json": JSON.stringify({ name: "root", version: "0.0.0" }),
	"/repo/packages/a/package.json": manifest("@x/a"),
};

describe("LockfileReader — no lockfile on disk", () => {
	layer(workspacesOver(noLockfile))((it) => {
		it.effect("fails typed with the path it could not read", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const result = yield* Effect.result(reader.read);
				assert.strictEqual(result._tag, "Failure");
				const error = yield* Effect.flip(reader.read);
				assert.instanceOf(error, LockfileReadError);
				assert.strictEqual(error.lockfilePath, "/repo/pnpm-lock.yaml");
				assert.strictEqual(error.format, "pnpm");
			}),
		);

		it.effect("discovery is unaffected — a missing lockfile is not a missing workspace", () =>
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				const names = (yield* discovery.listPackages).map((pkg) => pkg.name);
				assert.include(names, "@x/a");
			}),
		);
	});
});

// ── a malformed lockfile ───────────────────────────────────────────────────

const brokenLockfile: Tree = {
	...noLockfile,
	"/repo/pnpm-lock.yaml": "lockfileVersion: '9.0'\nimporters:\n\t- [oops\n",
};

describe("LockfileReader — a malformed lockfile", () => {
	layer(workspacesOver(brokenLockfile))((it) => {
		it.effect("fails typed through @effected/lockfiles, never as a defect", () =>
			Effect.gen(function* () {
				const reader = yield* LockfileReader;
				const result = yield* Effect.result(reader.read);
				assert.strictEqual(result._tag, "Failure");
				const error = yield* Effect.flip(reader.read);
				// The parse error belongs to @effected/lockfiles and is NOT redefined here.
				assert.strictEqual(error._tag, "LockfileParseError");
			}),
		);
	});
});
