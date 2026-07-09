/**
 * Workspace vault store layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Layer } from "effect";
import { makeDrizzleWorkspaceVaultStore, makeInMemoryWorkspaceVaultStore } from "./WorkspaceVault.repo.js";

const WorkspaceVaultStore = WorkspaceUseCases.Workspace.WorkspaceVaultStore;

/**
 * In-memory workspace vault store layer for deterministic tests.
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreInMemoryLayer = Layer.effect(WorkspaceVaultStore, makeInMemoryWorkspaceVaultStore());

/**
 * Drizzle-backed workspace vault store layer.
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreDrizzleLayer = Layer.effect(WorkspaceVaultStore, makeDrizzleWorkspaceVaultStore());

/**
 * Default workspace vault store layer used by local server wiring.
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultStoreLive = WorkspaceVaultStoreInMemoryLayer;
