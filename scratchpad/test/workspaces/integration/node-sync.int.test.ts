// @effect-diagnostics nodeBuiltinImport:skip-file
// The node-sync preset driving the sync entry points against the repository
// it lives in — the real filesystem, no virtual tree.
//
// `self.int.test.ts` already pins the hand-wired sync ops against the Effect
// surface; this one proves the SHIPPED preset is that same wiring: the
// node-bound ops must find the same root and the same packages a consumer
// wiring `node:fs` / `node:path` by hand would find, from a `packages/`
// subdirectory of a real Bun workspace.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import nodePathModule, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import type { WorkspacesSyncOptions } from "../../../effected/workspaces/index.ts";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "../../../effected/workspaces/index.ts";
import { nodeFileSystem, nodePath, nodeSyncOps } from "../../../effected/workspaces/node-sync.ts";

/** This package's own directory — the repo root is somewhere above it. */
const here = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(here, "..", "..", "..", "..", "packages", "foundation", "modeling", "utils");

// The hand-wiring the preset replaces, kept as the oracle.
const handWired: WorkspacesSyncOptions = {
	fileSystem: {
		exists: existsSync,
		readFile: (p) => readFileSync(p, "utf8"),
		readDirectory: (p) => readdirSync(p),
		isDirectory: (p) => statSync(p).isDirectory(),
	},
	path: nodePathModule,
};

describe("the node-sync preset against the real repository", () => {
	it("findWorkspaceRootSync finds the workspace root from a packages/ subdir", () => {
		const root = findWorkspaceRootSync(cwd, nodeSyncOps);
		assert.isNotNull(root);
		if (root === null) return assert.fail("expected a workspace root");
		assert.isTrue(nodeFileSystem.exists(nodePath.join(root, "bun.lock")));
	});

	it("getWorkspacePackagesSync enumerates this package and its siblings", () => {
		const root = findWorkspaceRootSync(cwd, nodeSyncOps);
		assert.isNotNull(root);
		if (root === null) return assert.fail("expected a workspace root");
		const names = getWorkspacePackagesSync(root, nodeSyncOps).map((pkg) => pkg.name);
		assert.include(names, "@beep/scratchpad");
		assert.include(names, "@beep/utils");
		assert.include(names, "@beep/identity");
	});

	it("agrees exactly with hand-wired node ops", () => {
		const presetRoot = findWorkspaceRootSync(cwd, nodeSyncOps);
		const manualRoot = findWorkspaceRootSync(cwd, handWired);
		assert.strictEqual(presetRoot, manualRoot);
		assert.isNotNull(presetRoot);
		if (presetRoot === null || manualRoot === null) return assert.fail("expected both workspace roots");

		const preset = getWorkspacePackagesSync(presetRoot, nodeSyncOps).map((pkg) => pkg.name);
		const manual = getWorkspacePackagesSync(manualRoot, handWired).map((pkg) => pkg.name);
		assert.deepStrictEqual(preset, manual);
	});
});
