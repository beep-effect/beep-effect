/**
 * Vault sync RPC contract for the desktop webview.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as S from "effect/Schema";
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
export class VaultSyncWorkspacePayload extends S.Class<VaultSyncWorkspacePayload, { readonly brand: unique symbol }>(
  $I`VaultSyncWorkspacePayload`
)(
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
 * Payload of the vault sync trigger: the workspace, and the intent id an
 * offline-capable client minted for this request.
 *
 * **Details**
 *
 * A client that queues the trigger while the sidecar is unreachable sends the
 * same `intentId` on every delivery attempt; the server uses it as the request
 * identity, so a replayed intent requests one pass, not one per attempt. A
 * caller that omits it gets a fresh identity per call.
 *
 * **Example** (Make trigger payload with an intent id)
 *
 * ```ts
 * import { TriggerVaultSyncPayload } from "@beep/documents-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const payload = TriggerVaultSyncPayload.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1),
 *   intentId: "intent-1",
 * })
 * console.log(payload.intentId) // "intent-1"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class TriggerVaultSyncPayload extends S.Class<TriggerVaultSyncPayload, { readonly brand: unique symbol }>(
  $I`TriggerVaultSyncPayload`
)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault mirror the RPC addresses.",
    }),
    intentId: S.optionalKey(V.RequestToken).annotateKey({
      description: "Client-minted intent id, stable across replays of one queued trigger.",
    }),
  },
  $I.annote("TriggerVaultSyncPayload", {
    description: "Workspace-scoped trigger payload carrying the client intent id for idempotent replay.",
  })
) {}

/**
 * Payload for marking one vault sync drift record as reviewed.
 *
 * **Example** (Make conflict reviewed payload)
 *
 * ```ts
 * import * as Documents from "@beep/shared-domain/identity/Documents"
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
export class MarkVaultSyncConflictReviewedPayload extends S.Opaque<
  MarkVaultSyncConflictReviewedPayload,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    conflictId: Documents.SyncConflictId.annotateKey({
      description: "Drift record to mark as reviewed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault mirror the RPC addresses.",
    }),
  }).pipe(
    $I.annoteSchema("MarkVaultSyncConflictReviewedPayload", {
      description: "Payload for marking one vault sync drift record as reviewed.",
    })
  )
) {}

/**
 * Payload for reading vault sync status, optionally forcing a fresh mirror
 * probe.
 *
 * **Details**
 *
 * `forceProbe` defaults to `false` for both construction and missing-key
 * decoding, so pre-forceProbe peers stay wire-compatible and keep the cached
 * probe path. An operator's explicit "retry connection" sends `true`, which
 * makes the sidecar discard any cached probe failure and ask the provider now.
 *
 * **Example** (Make status payload with defaults)
 *
 * ```ts
 * import { GetVaultSyncStatusPayload } from "@beep/documents-use-cases/public"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const payload = GetVaultSyncStatusPayload.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(payload.forceProbe) // false
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export class GetVaultSyncStatusPayload extends VaultSyncWorkspacePayload.extend<GetVaultSyncStatusPayload>(
  $I`GetVaultSyncStatusPayload`
)(
  {
    forceProbe: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "When true, the status read bypasses the cached mirror probe and asks the provider now.",
    }),
  },
  $I.annote("GetVaultSyncStatusPayload", {
    description: "Payload for reading vault sync status, optionally forcing a fresh mirror probe.",
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
  payload: TriggerVaultSyncPayload,
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
  payload: GetVaultSyncStatusPayload,
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
 * Streaming RPC that pushes the vault sync status each time the status View changes.
 *
 * **Details**
 *
 * The panel subscribes once and its counts update when a pass finishes, instead
 * of re-reading the status that `TriggerVaultSync` returned at acceptance.
 *
 * **Example** (Verify watch RPC registration)
 *
 * ```ts
 * import { VaultSyncRpcs, WatchVaultSyncStatusRpc } from "@beep/documents-use-cases/public"
 *
 * const registered = VaultSyncRpcs.requests.get("WatchVaultSyncStatus")
 * console.log(registered === WatchVaultSyncStatusRpc)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export const WatchVaultSyncStatusRpc = Rpc.make("WatchVaultSyncStatus", {
  payload: VaultSyncWorkspacePayload,
  success: VaultSyncStatus,
  error: VaultSyncActionError,
  stream: true,
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
  MarkVaultSyncConflictReviewedRpc,
  WatchVaultSyncStatusRpc
);
