/**
 * Vault sync RPC contract for the desktop webview.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import * as Documents from "@beep/documents-domain/identity/Documents";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import { VaultSyncActionError } from "./Sync.errors.ts";
import { VaultSyncStatus } from "./VaultSyncEngine.ts";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/Sync.rpc");

/**
 * Workspace-scoped payload shared by the vault sync trigger, status, and
 * conflict-listing RPCs.
 *
 * **Example** (Make workspace payload)
 *
 * ```ts
 * import { VaultSyncWorkspacePayload } from "@beep/documents-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const payload = VaultSyncWorkspacePayload.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(payload.workspaceId)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class VaultSyncWorkspacePayload extends S.Class<VaultSyncWorkspacePayload>($I`VaultSyncWorkspacePayload`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault mirror the RPC addresses.",
    }),
  },
  $I.annote("VaultSyncWorkspacePayload", {
    description: "Workspace-scoped payload shared by the vault sync RPCs.",
  })
) {}

/**
 * Payload for marking one vault sync drift record as reviewed.
 *
 * **Example** (Make conflict reviewed payload)
 *
 * ```ts
 * import * as Documents from "@beep/documents-domain/identity/Documents"
 * import { MarkVaultSyncConflictReviewedPayload } from "@beep/documents-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const payload = MarkVaultSyncConflictReviewedPayload.make({
 *   conflictId: S.decodeUnknownSync(Documents.SyncConflictId)(1),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(payload.conflictId)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class MarkVaultSyncConflictReviewedPayload extends S.Class<MarkVaultSyncConflictReviewedPayload>(
  $I`MarkVaultSyncConflictReviewedPayload`
)(
  {
    conflictId: Documents.SyncConflictId.annotateKey({
      description: "Drift record to mark as reviewed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault mirror the RPC addresses.",
    }),
  },
  $I.annote("MarkVaultSyncConflictReviewedPayload", {
    description: "Payload for marking one vault sync drift record as reviewed.",
  })
) {}

/**
 * RPC used by the desktop webview to trigger one vault sync pass.
 *
 * **Example** (Verify trigger RPC registration)
 *
 * ```ts
 * import { TriggerVaultSyncRpc, VaultSyncRpcs } from "@beep/documents-use-cases/public"
 *
 * const registered = VaultSyncRpcs.requests.get("TriggerVaultSync")
 * console.log(registered === TriggerVaultSyncRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const TriggerVaultSyncRpc = Rpc.make("TriggerVaultSync", {
  payload: VaultSyncWorkspacePayload,
  success: VaultSyncStatus,
  error: VaultSyncActionError,
});

/**
 * RPC used by the desktop webview to read the current vault sync status.
 *
 * **Example** (Verify status RPC registration)
 *
 * ```ts
 * import { GetVaultSyncStatusRpc, VaultSyncRpcs } from "@beep/documents-use-cases/public"
 *
 * const registered = VaultSyncRpcs.requests.get("GetVaultSyncStatus")
 * console.log(registered === GetVaultSyncStatusRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const GetVaultSyncStatusRpc = Rpc.make("GetVaultSyncStatus", {
  payload: VaultSyncWorkspacePayload,
  success: VaultSyncStatus,
  error: VaultSyncActionError,
});

/**
 * RPC used by the desktop webview to list open vault sync drift records.
 *
 * **Example** (Verify list conflicts registration)
 *
 * ```ts
 * import { ListVaultSyncConflictsRpc, VaultSyncRpcs } from "@beep/documents-use-cases/public"
 *
 * const registered = VaultSyncRpcs.requests.get("ListVaultSyncConflicts")
 * console.log(registered === ListVaultSyncConflictsRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const ListVaultSyncConflictsRpc = Rpc.make("ListVaultSyncConflicts", {
  payload: VaultSyncWorkspacePayload,
  success: S.Array(SyncConflict),
  error: VaultSyncActionError,
});

/**
 * RPC used by the desktop webview to mark one drift record as reviewed.
 *
 * **Example** (Verify mark reviewed registration)
 *
 * ```ts
 * import { MarkVaultSyncConflictReviewedRpc, VaultSyncRpcs } from "@beep/documents-use-cases/public"
 *
 * const registered = VaultSyncRpcs.requests.get("MarkVaultSyncConflictReviewed")
 * console.log(registered === MarkVaultSyncConflictReviewedRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const MarkVaultSyncConflictReviewedRpc = Rpc.make("MarkVaultSyncConflictReviewed", {
  payload: MarkVaultSyncConflictReviewedPayload,
  success: SyncConflict,
  error: VaultSyncActionError,
});

/**
 * Vault sync RPC group exposed by the professional desktop server.
 *
 * **Example** (Check trigger request exists)
 *
 * ```ts
 * import { VaultSyncRpcs } from "@beep/documents-use-cases/public"
 *
 * console.log(VaultSyncRpcs.requests.has("TriggerVaultSync"))
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const VaultSyncRpcs = RpcGroup.make(
  TriggerVaultSyncRpc,
  GetVaultSyncStatusRpc,
  ListVaultSyncConflictsRpc,
  MarkVaultSyncConflictReviewedRpc
);
