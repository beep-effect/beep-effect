/**
 * Vault sync engine port implemented by the documents server.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DmsProvider } from "@beep/documents-domain/values/Sync";
import { $DocumentsUseCasesId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { Context, Effect } from "effect";
import * as S from "effect/Schema";
import {
  SyncConflictRepositoryNotFound,
  SyncConflictRepositoryUnavailable,
} from "../../entities/SyncConflict/SyncConflict.repository.ts";
import { SyncCursorRepositoryUnavailable } from "../../entities/SyncCursor/SyncCursor.repository.ts";
import {
  SyncItemRepositoryConflict,
  SyncItemRepositoryNotFound,
  SyncItemRepositoryUnavailable,
} from "../../entities/SyncItem/SyncItem.repository.ts";
import {
  SyncOperationRepositoryConflict,
  SyncOperationRepositoryNotFound,
  SyncOperationRepositoryUnavailable,
} from "../../entities/SyncOperation/SyncOperation.repository.ts";
import { DmsMirrorDisconnectReason } from "./DmsMirror.ts";
import { DmsMirrorUnavailable, VaultScanFailed } from "./Sync.errors.ts";
import type * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";

const $I = $DocumentsUseCasesId.create("aggregates/Sync/VaultSyncEngine");

/**
 * Point-in-time vault sync status read model for one workspace mirror.
 *
 * **Example** (Decode vault sync status)
 *
 * ```ts
 * import { VaultSyncStatus } from "@beep/documents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(VaultSyncStatus)({
 *   conflictItems: 0,
 *   connected: true,
 *   disconnectReason: null,
 *   currentItems: 3,
 *   cursorPosition: "now",
 *   errorItems: 0,
 *   failedOperations: 0,
 *   openConflicts: 0,
 *   pendingItems: 1,
 *   probedAt: null,
 *   provider: "box",
 *   queuedOperations: 1
 * })
 * console.log(status.pendingItems)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class VaultSyncStatus extends S.Class<VaultSyncStatus>($I`VaultSyncStatus`)(
  {
    conflictItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the conflict reconciliation state.",
    }),
    connected: S.Boolean.annotateKey({
      description: "Whether the DMS mirror adapter can reach the provider.",
    }),
    // The encoded key is optional with a null decoding default: an older
    // sidecar that predates the field must still produce a decodable status
    // (missing key -> none), not an unavailable panel.
    disconnectReason: S.OptionFromNullOr(DmsMirrorDisconnectReason)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Why the provider is disconnected; none while the mirror probe reports connected.",
      }),
    currentItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the current reconciliation state.",
    }),
    cursorPosition: S.OptionFromNullOr(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Opaque remote-event stream position; none before the cursor bootstraps.",
    }),
    errorItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the error reconciliation state.",
    }),
    failedOperations: NonNegativeInt.annotateKey({
      description: "Number of outbox operations in the failed status.",
    }),
    openConflicts: NonNegativeInt.annotateKey({
      description: "Number of drift records awaiting review.",
    }),
    pendingItems: NonNegativeInt.annotateKey({
      description: "Number of tracked items in the pending reconciliation state.",
    }),
    // Same older-sidecar tolerance as disconnectReason: a status that predates
    // the field must decode (missing key -> none), not go unavailable.
    probedAt: S.OptionFromNullOr(S.DateTimeUtcFromString)
      .pipe(S.withDecodingDefaultKey(Effect.succeed(null)), SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "When the mirror probe last actually asked the provider; none when no probe has contacted it.",
      }),
    provider: DmsProvider.annotateKey({
      description: "DMS provider the status describes.",
    }),
    queuedOperations: NonNegativeInt.annotateKey({
      description: "Number of outbox operations in the queued status.",
    }),
  },
  $I.annote("VaultSyncStatus", {
    description: "Point-in-time vault sync status read model for one workspace mirror.",
  })
) {}

/**
 * Internal typed failure raised by the vault sync engine.
 *
 * **Details**
 *
 * The member set is exactly the failures reachable through the engine's ports:
 * vault scanning, the DMS mirror adapter, and the four sync repositories.
 *
 * **Example** (Decode tagged scan failure)
 *
 * ```ts
 * import { VaultScanFailed, VaultSyncError } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(VaultSyncError)(
 *   VaultScanFailed.make({ reason: "vault root is not readable" })
 * )
 * console.log(decoded._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const VaultSyncError = S.Union([
  DmsMirrorUnavailable,
  SyncConflictRepositoryNotFound,
  SyncConflictRepositoryUnavailable,
  SyncCursorRepositoryUnavailable,
  SyncItemRepositoryConflict,
  SyncItemRepositoryNotFound,
  SyncItemRepositoryUnavailable,
  SyncOperationRepositoryConflict,
  SyncOperationRepositoryNotFound,
  SyncOperationRepositoryUnavailable,
  VaultScanFailed,
]).pipe(
  $I.annoteSchema("VaultSyncError", {
    description: "Internal typed failure raised by the vault sync engine.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Runtime type for {@link VaultSyncError}.
 *
 * **Example** (Type a vault sync error)
 *
 * ```ts
 * import { VaultScanFailed, type VaultSyncError } from "@beep/documents-use-cases/aggregates/Sync/server"
 *
 * const error: VaultSyncError = VaultScanFailed.make({ reason: "vault root is not readable" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type VaultSyncError = typeof VaultSyncError.Type;

/**
 * Input for one full push-and-poll sync pass over a workspace vault.
 *
 * **Example** (Construct sync-once input)
 *
 * ```ts
 * import { SyncOnceInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = SyncOnceInput.make({
 *   vaultRootPath: "/tmp/beep-documents-vault",
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.vaultRootPath)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class SyncOnceInput extends S.Class<SyncOnceInput>($I`SyncOnceInput`)(
  {
    vaultRootPath: S.NonEmptyString.annotateKey({
      description: "Absolute workspace vault root path read from workspace configuration.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault is synced.",
    }),
  },
  $I.annote("SyncOnceInput", {
    description: "Input for one full push-and-poll sync pass over a workspace vault.",
  })
) {}

/**
 * Input for reading the current vault sync status of one workspace.
 *
 * **Example** (Construct status query input)
 *
 * ```ts
 * import { VaultSyncStatusInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = VaultSyncStatusInput.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.workspaceId)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class VaultSyncStatusInput extends S.Class<VaultSyncStatusInput>($I`VaultSyncStatusInput`)(
  {
    // Default-false and missing-key tolerant so pre-forceProbe callers stay
    // wire-compatible and keep the cached read path.
    forceProbe: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "When true, the status read bypasses the cached mirror probe and asks the provider now.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose vault sync status is read.",
    }),
  },
  $I.annote("VaultSyncStatusInput", {
    description: "Input for reading the current vault sync status of one workspace.",
  })
) {}

/**
 * Input for listing the open drift records of one workspace.
 *
 * **Example** (Construct list-conflicts input)
 *
 * ```ts
 * import { ListOpenConflictsInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = ListOpenConflictsInput.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.workspaceId)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class ListOpenConflictsInput extends S.Class<ListOpenConflictsInput>($I`ListOpenConflictsInput`)(
  {
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace whose open drift records are listed.",
    }),
  },
  $I.annote("ListOpenConflictsInput", {
    description: "Input for listing the open drift records of one workspace.",
  })
) {}

/**
 * Input for marking one drift record as reviewed.
 *
 * **Details**
 *
 * `workspaceId` scopes the review: the engine verifies the drift record belongs
 * to this workspace before marking it, so a conflict id from one workspace
 * cannot be reviewed under another workspace's request.
 *
 * **Example** (Construct mark-reviewed input)
 *
 * ```ts
 * import * as Documents from "@beep/shared-domain/identity/Documents"
 * import { MarkConflictReviewedInput } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const input = MarkConflictReviewedInput.make({
 *   conflictId: S.decodeUnknownSync(Documents.SyncConflictId)(1),
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 * console.log(input.conflictId)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class MarkConflictReviewedInput extends S.Class<MarkConflictReviewedInput>($I`MarkConflictReviewedInput`)(
  {
    conflictId: Documents.SyncConflictId.annotateKey({
      description: "Drift record to mark as reviewed.",
    }),
    workspaceId: WorkspaceIdentity.WorkspaceId.annotateKey({
      description: "Workspace that must own the drift record for the review to apply.",
    }),
  },
  $I.annote("MarkConflictReviewedInput", {
    description: "Input for marking one drift record as reviewed.",
  })
) {}

/**
 * Vault sync engine shape implemented by the documents server and consumed by
 * the desktop orchestrator.
 *
 * **Details**
 *
 * `syncOnce` runs one full push-and-poll pass and returns the resulting
 * status; `status` reads without mutating.
 *
 * **Example** (Implement stub engine shape)
 *
 * ```ts
 * import {
 *   VaultScanFailed,
 *   VaultSyncStatus,
 *   VaultSyncStatusInput,
 *   type VaultSyncEngineShape
 * } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const idleStatus = S.decodeUnknownSync(VaultSyncStatus)({
 *   conflictItems: 0,
 *   connected: false,
 *   disconnectReason: "credentials-missing",
 *   currentItems: 0,
 *   cursorPosition: null,
 *   errorItems: 0,
 *   failedOperations: 0,
 *   openConflicts: 0,
 *   pendingItems: 0,
 *   provider: "box",
 *   queuedOperations: 0
 * })
 * const engine: VaultSyncEngineShape = {
 *   listOpenConflicts: () => Effect.succeed([]),
 *   markConflictReviewed: () => Effect.fail(VaultScanFailed.make({ reason: "stub engine" })),
 *   status: () => Effect.succeed(idleStatus),
 *   syncOnce: () => Effect.succeed(idleStatus)
 * }
 * const input = VaultSyncStatusInput.make({
 *   workspaceId: S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1)
 * })
 *
 * Effect.runPromise(engine.status(input)).then((status) => console.log(status.connected))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export interface VaultSyncEngineShape {
  readonly listOpenConflicts: (
    input: ListOpenConflictsInput
  ) => Effect.Effect<ReadonlyArray<DomainSyncConflict.SyncConflict>, VaultSyncError>;
  readonly markConflictReviewed: (
    input: MarkConflictReviewedInput
  ) => Effect.Effect<DomainSyncConflict.SyncConflict, VaultSyncError>;
  readonly status: (input: VaultSyncStatusInput) => Effect.Effect<VaultSyncStatus, VaultSyncError>;
  readonly syncOnce: (input: SyncOnceInput) => Effect.Effect<VaultSyncStatus, VaultSyncError>;
}

/**
 * Context tag for the vault sync engine port.
 *
 * **Example** (Provide engine service tag)
 *
 * ```ts
 * import {
 *   VaultScanFailed,
 *   VaultSyncEngine,
 *   VaultSyncStatus,
 *   type VaultSyncEngineShape
 * } from "@beep/documents-use-cases/aggregates/Sync/server"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const idleStatus = S.decodeUnknownSync(VaultSyncStatus)({
 *   conflictItems: 0,
 *   connected: false,
 *   disconnectReason: "credentials-missing",
 *   currentItems: 0,
 *   cursorPosition: null,
 *   errorItems: 0,
 *   failedOperations: 0,
 *   openConflicts: 0,
 *   pendingItems: 0,
 *   provider: "box",
 *   queuedOperations: 0
 * })
 * const engine: VaultSyncEngineShape = {
 *   listOpenConflicts: () => Effect.succeed([]),
 *   markConflictReviewed: () => Effect.fail(VaultScanFailed.make({ reason: "stub engine" })),
 *   status: () => Effect.succeed(idleStatus),
 *   syncOnce: () => Effect.succeed(idleStatus)
 * }
 *
 * const program = Effect.gen(function* () {
 *   return (yield* VaultSyncEngine) === engine
 * }).pipe(Effect.provideService(VaultSyncEngine, engine))
 * console.log(Effect.runSync(program))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export class VaultSyncEngine extends Context.Service<VaultSyncEngine, VaultSyncEngineShape>()($I`VaultSyncEngine`) {}
