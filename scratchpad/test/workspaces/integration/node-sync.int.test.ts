// The node-sync preset driving the sync entry points against the repository
// it lives in — the real filesystem, no virtual tree.
//
// `self.int.test.ts` already pins the hand-wired sync ops against the Effect
// surface; this one proves the SHIPPED preset is that same wiring: the
// node-bound ops must find the same root and the same packages a consumer
// wiring `node:fs` / `node:path` by hand would find, from a `packages/`
// subdirectory of a real pnpm workspace.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import nodePathModule, { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import type { WorkspacesSyncOptions } from "../../../effected/workspaces/index.ts";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "../../../effected/workspaces/index.ts";
import { nodeFileSystem, nodePath, nodeSyncOps } from "../../../effected/workspaces/node-sync.ts";

/** This package's own directory — the repo root is somewhere above it. */
const here = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(here, "..", "..");

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
		assert.isTrue(nodeFileSystem.exists(nodePath.join(root as string, "pnpm-workspace.yaml")));
	});

	it("getWorkspacePackagesSync enumerates this package and its siblings", () => {
		const root = findWorkspaceRootSync(cwd, nodeSyncOps);
		assert.isNotNull(root);
		const names = getWorkspacePackagesSync(root as string, nodeSyncOps).map((pkg) => pkg.name);
		assert.include(names, "@effected/workspaces");
		assert.include(names, "@effected/glob");
		assert.include(names, "@effected/walker");
	});

	it("agrees exactly with hand-wired node ops", () => {
		const presetRoot = findWorkspaceRootSync(cwd, nodeSyncOps);
		const manualRoot = findWorkspaceRootSync(cwd, handWired);
		assert.strictEqual(presetRoot, manualRoot);
		assert.isNotNull(presetRoot);

		const preset = getWorkspacePackagesSync(presetRoot as string, nodeSyncOps).map((pkg) => pkg.name);
		const manual = getWorkspacePackagesSync(manualRoot as string, handWired).map((pkg) => pkg.name);
		assert.deepStrictEqual(preset, manual);
	});
});
