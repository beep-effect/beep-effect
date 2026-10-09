/**
 * The Node.js binding for the sync entry points — ready-made `SyncFileSystem`
 * and `SyncPath` operations over `node:fs` / `node:path`, so adopting
 * `findWorkspaceRootSync` / `getWorkspacePackagesSync` is one import instead
 * of four hand-wired one-liners.
 *
 * **Details**
 *
 * Deliberately a **separate subpath** (`@beep/scratchpad/effected/workspaces/node-sync`), not
 * part of the main entry: the main entry imports nothing platform-shaped, and
 * re-exporting these from it would drag `node:*` imports into every consumer —
 * including the ones supplying their own operations (a win32-explicit `path`,
 * a Bun or Deno binding, a test fake). Import this module only where Node's
 * built-ins are the platform you mean; `nodePath` is the running platform's
 * `node:path`, so on Windows the paths handed back are win32 paths.
 *
 * **Example** (Enumerate workspace packages with the Node sync binding)
 *
 * ```ts
 * import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@beep/scratchpad/effected/workspaces/WorkspacesSync";
 * import { nodeSyncOps } from "@beep/scratchpad/effected/workspaces/node-sync";
 * import * as A from "effect/Array";
 *
 * const root = findWorkspaceRootSync(process.cwd(), nodeSyncOps);
 * const packages = root === null ? [] : getWorkspacePackagesSync(root, nodeSyncOps);
 * console.log(A.isArray(packages)) // true
 * ```
 *
 * @packageDocumentation
 */

import type { SyncFileSystem, SyncPath, WorkspacesSyncOptions } from "./WorkspacesSync.ts";

// Effect FileSystem is asynchronous, and Path.layer cannot preserve the running platform's path semantics.
const { existsSync, readFileSync, readdirSync, statSync } = process.getBuiltinModule("node:fs");
const path = process.getBuiltinModule("node:path");

// This module is an ENTRY POINT, so re-exporting is allowed (and required):
// api-extractor models each entry as its own surface, and the three op types
// appear in this entry's public declarations — without the re-export the
// build reports ae-forgotten-export for all three. It also lets a consumer
// type against the subpath alone.
export type { SyncDirectoryEntry, SyncFileSystem, SyncPath, WorkspacesSyncOptions } from "./WorkspacesSync.ts";

/**
 * Provides synchronous filesystem operations over `node:fs` for workspace discovery.
 *
 * **Details**
 *
 * `existsSync` never throws, satisfying `exists`'s must-not-throw contract;
 * the other three may throw and every throw lands in the sync entry points'
 * documented degraded-skip semantics.
 *
 * **Example** (Check a missing workspace file without throwing)
 *
 * ```ts
 * import { nodeFileSystem } from "@beep/scratchpad/effected/workspaces/node-sync";
 *
 * console.log(nodeFileSystem.exists("")) // false
 * ```
 *
 * @public
 * @category adapters
 * @since 0.0.0
 */
export const nodeFileSystem: SyncFileSystem = {
	exists: existsSync,
	readFile: (p) => readFileSync(p, "utf8"),
	readDirectory: (p) => readdirSync(p),
	isDirectory: (p) => statSync(p).isDirectory(),
	// The optional fast path: one `readdirSync` carries every entry's type, so
	// enumeration stops paying a `statSync` per entry. Links keep reporting as
	// links — enumeration re-resolves those itself.
	readDirectoryWithTypes: (p) =>
		readdirSync(p, { withFileTypes: true }).map((entry) => ({
			name: entry.name,
			isDirectory: entry.isDirectory(),
			isSymbolicLink: entry.isSymbolicLink(),
		})),
};

/**
 * Provides synchronous path operations using the running platform's `node:path`.
 *
 * **Details**
 *
 * Uses win32 semantics on Windows, posix elsewhere. Pass `node:path/win32` or
 * `node:path/posix` yourself to pin a dialect.
 *
 * **Example** (Find a workspace manifest directory across platforms)
 *
 * ```ts
 * import { nodePath } from "@beep/scratchpad/effected/workspaces/node-sync";
 *
 * console.log(nodePath.dirname(nodePath.join("workspace", "package.json"))) // workspace
 * ```
 *
 * @public
 * @category adapters
 * @since 0.0.0
 */
export const nodePath: SyncPath = path;

/**
 * The complete Node-bound options bag for `findWorkspaceRootSync` and
 * `getWorkspacePackagesSync` — {@link nodeFileSystem} plus {@link nodePath}.
 *
 * **Details**
 *
 * Both helpers take their path positionally, so this bag usually passes
 * through verbatim; spread it only to add `getWorkspacePackagesSync`'s
 * traversal extras: `{ ...nodeSyncOps, maxDepth }`.
 *
 * **Example** (Add a traversal depth to the Node options)
 *
 * ```ts
 * import { nodeFileSystem, nodePath, nodeSyncOps } from "@beep/scratchpad/effected/workspaces/node-sync";
 *
 * const options = { ...nodeSyncOps, maxDepth: 2 };
 * console.log(options.fileSystem === nodeFileSystem) // true
 * console.log(options.path === nodePath) // true
 * console.log(options.maxDepth) // 2
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export const nodeSyncOps: WorkspacesSyncOptions = {
	fileSystem: nodeFileSystem,
	path: nodePath,
};
