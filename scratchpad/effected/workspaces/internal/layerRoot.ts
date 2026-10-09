import { dual } from "effect/Function";
// The layer-bound root lookup every root-consuming service shares.
//
// `WorkspaceDiscovery`, `LockfileReader`, `WorkspaceCatalogs` and
// `WorkspaceSnapshots` each resolve their workspace root from a layer-level
// `cwd` and optional `stopAt`. One implementation means the four cannot
// disagree about which root a layer's options name — discovery refusing an
// enclosing workspace while the lockfile and catalog reads adopt it.

import * as Effect from "effect/Effect";
import type { WorkspaceRootNotFoundError, WorkspaceRootShape } from "../WorkspaceRoot.ts";

/**
 * Shares the layer-level options every root-consuming service reads its root from.
 *
 * @category configuration
 * @since 0.0.0
 */
export interface LayerRootOptions {
	readonly cwd?: string;
	readonly stopAt?: string | undefined;
}

/**
 * Resolves the workspace root a layer's options name.
 *
 * **Details**
 *
 * Uses `Effect.suspend` so the ambient `process.cwd()` is read at first use,
 * not at layer construction.
 *
 * **Example** (Resolve an explicit starting directory)
 *
 * ```ts
 * import { findLayerRoot } from "@beep/scratchpad/effected/workspaces/internal/layerRoot";
 * import type { WorkspaceRootShape } from "@beep/scratchpad/effected/workspaces/WorkspaceRoot";
 * import * as Effect from "effect/Effect";
 *
 * const roots: WorkspaceRootShape = { find: (cwd) => Effect.succeed(cwd) };
 * const program = findLayerRoot(roots, { cwd: "/repo" });
 * console.log(Effect.runSync(program)); // /repo
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findLayerRoot: {
	(options: LayerRootOptions | undefined): (roots: WorkspaceRootShape) => Effect.Effect<string, WorkspaceRootNotFoundError>;
	(roots: WorkspaceRootShape, options: LayerRootOptions | undefined): Effect.Effect<string, WorkspaceRootNotFoundError>;
} = dual(2, (
	roots: WorkspaceRootShape,
	options: LayerRootOptions | undefined,
): Effect.Effect<string, WorkspaceRootNotFoundError> =>
	Effect.suspend(() => {
		const stopAt = options?.stopAt;
		return roots.find(options?.cwd ?? process.cwd(), stopAt === undefined ? undefined : { stopAt });
	}));
