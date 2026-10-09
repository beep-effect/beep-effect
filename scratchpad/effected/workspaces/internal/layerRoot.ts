// The layer-bound root lookup every root-consuming service shares.
//
// `WorkspaceDiscovery`, `LockfileReader`, `WorkspaceCatalogs` and
// `WorkspaceSnapshots` each resolve their workspace root from a layer-level
// `cwd` and optional `stopAt`. One implementation means the four cannot
// disagree about which root a layer's options name — discovery refusing an
// enclosing workspace while the lockfile and catalog reads adopt it.

import { Effect } from "effect";
import type { WorkspaceRootNotFoundError, WorkspaceRootShape } from "../WorkspaceRoot.ts";

/** The layer-level options every root-consuming service reads its root from. */
export interface LayerRootOptions {
	readonly cwd?: string;
	readonly stopAt?: string | undefined;
}

/**
 * Resolve the workspace root a layer's options name. `Effect.suspend` so the
 * ambient `process.cwd()` is read at first use, not at layer construction.
 */
export const findLayerRoot = (
	roots: WorkspaceRootShape,
	options: LayerRootOptions | undefined,
): Effect.Effect<string, WorkspaceRootNotFoundError> =>
	Effect.suspend(() => {
		const stopAt = options?.stopAt;
		return roots.find(options?.cwd ?? process.cwd(), stopAt === undefined ? undefined : { stopAt });
	});
