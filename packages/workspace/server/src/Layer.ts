/**
 * Workspace server layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { Layer } from "effect";
import { ThreadStoreDrizzleLayer, ThreadStoreInMemoryLayer } from "./aggregates/Thread/index.ts";
import { WorkspaceVaultStoreDrizzleLayer, WorkspaceVaultStoreInMemoryLayer } from "./aggregates/Workspace/index.ts";

/**
 * Live workspace server layer backed by Drizzle persistence.
 *
 * **Example** (Log live workspace layer)
 *
 * ```ts
 * import { WorkspaceServerLive } from "@beep/workspace-server/layer"
 *
 * console.log(WorkspaceServerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceServerLive = Layer.mergeAll(ThreadStoreDrizzleLayer, WorkspaceVaultStoreDrizzleLayer);

/**
 * In-memory workspace server layer for fast proofs.
 *
 * **Example** (Log in-memory server layer)
 *
 * ```ts
 * import { WorkspaceServerInMemory } from "@beep/workspace-server/layer"
 *
 * console.log(WorkspaceServerInMemory)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceServerInMemory = Layer.mergeAll(ThreadStoreInMemoryLayer, WorkspaceVaultStoreInMemoryLayer);
