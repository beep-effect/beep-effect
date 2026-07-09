/**
 * Workspace vault RPC contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { SetWorkspaceVaultInput, WorkspaceVaultActionError, WorkspaceVaultConfig } from "./WorkspaceVault.js";

/**
 * RPC for reading the configured workspace vault path.
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetWorkspaceVaultRpc = Rpc.make("GetWorkspaceVault", {
  payload: { workspaceId: WorkspaceIdentity.WorkspaceId },
  success: WorkspaceVaultConfig,
  error: WorkspaceVaultActionError,
});

/**
 * RPC for persisting the configured workspace vault path.
 *
 * @category protocols
 * @since 0.0.0
 */
export const SetWorkspaceVaultRpc = Rpc.make("SetWorkspaceVault", {
  payload: SetWorkspaceVaultInput,
  success: WorkspaceVaultConfig,
  error: WorkspaceVaultActionError,
});

/**
 * Workspace vault RPC group exposed to app clients.
 *
 * @category protocols
 * @since 0.0.0
 */
export const WorkspaceVaultRpcs = RpcGroup.make(GetWorkspaceVaultRpc, SetWorkspaceVaultRpc);
