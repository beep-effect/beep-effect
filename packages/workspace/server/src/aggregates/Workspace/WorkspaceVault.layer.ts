/**
 * Workspace vault store layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Layer } from "effect";
import { makeDrizzleWorkspaceVaultStore, makeInMemoryWorkspaceVaultStore } from "./WorkspaceVault.repo.ts";

const WorkspaceVaultStore = WorkspaceUseCases.Workspace.WorkspaceVaultStore;

/**
 * In-memory workspace vault store layer for deterministic tests.
 *
 * **Example** (Import in-memory vault layer)
 *
 * ```ts
 * import { WorkspaceVaultStoreInMemoryLayer } from "@beep/workspace-server/aggregates/Workspace"
 *
 * console.log(WorkspaceVaultStoreInMemoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreInMemoryLayer = Layer.effect(WorkspaceVaultStore, makeInMemoryWorkspaceVaultStore());

/**
 * Drizzle-backed workspace vault store layer.
 *
 * **Example** (Import Drizzle vault layer)
 *
 * ```ts
 * import { WorkspaceVaultStoreDrizzleLayer } from "@beep/workspace-server/aggregates/Workspace"
 *
 * console.log(WorkspaceVaultStoreDrizzleLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreDrizzleLayer = Layer.effect(WorkspaceVaultStore, makeDrizzleWorkspaceVaultStore());

/**
 * Default workspace vault store layer used by local server wiring.
 *
 * **Example** (Import live vault layer)
 *
 * ```ts
 * import { WorkspaceVaultStoreLive } from "@beep/workspace-server/aggregates/Workspace"
 *
 * console.log(WorkspaceVaultStoreLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreLive = WorkspaceVaultStoreInMemoryLayer;
