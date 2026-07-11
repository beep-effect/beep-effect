/**
 * App-level vault sync orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ListOpenConflictsInput,
  MarkConflictReviewedInput,
  SyncOnceInput,
  VaultSyncEngine,
  VaultSyncStatusInput,
} from "@beep/documents-use-cases/aggregates/Sync/server";
import { VaultSyncActionError, VaultSyncRpcs } from "@beep/documents-use-cases/public";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";

const toVaultSyncActionError =
  (context: string) =>
  (error: { readonly _tag: string }): Effect.Effect<never, VaultSyncActionError> =>
    Effect.logWarning("vault sync action dropped internal failure", { context, detail: error }).pipe(
      Effect.andThen(VaultSyncActionError.failEffect(context))
    );

/**
 * RPC handler layer for workspace vault sync commands.
 *
 * Resolves the workspace vault configuration before triggering a sync pass and
 * translates every internal engine failure into the client-safe
 * {@link VaultSyncActionError} so no driver or repository detail leaks over the
 * wire.
 *
 * @example
 * ```ts
 * import { VaultSyncHandlersLive } from "@/sync/VaultSyncOrchestrator"
 *
 * console.log(VaultSyncHandlersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const VaultSyncHandlersLive = VaultSyncRpcs.toLayer(
  Effect.gen(function* () {
    const workspaceVaultStore = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
    const engine = yield* VaultSyncEngine;
    return VaultSyncRpcs.of({
      GetVaultSyncStatus: ({ workspaceId }) =>
        engine
          .status(VaultSyncStatusInput.make({ workspaceId }))
          .pipe(Effect.catch(toVaultSyncActionError("GetVaultSyncStatus"))),
      ListVaultSyncConflicts: ({ workspaceId }) =>
        engine
          .listOpenConflicts(ListOpenConflictsInput.make({ workspaceId }))
          .pipe(Effect.catch(toVaultSyncActionError("ListVaultSyncConflicts"))),
      MarkVaultSyncConflictReviewed: ({ conflictId }) =>
        engine
          .markConflictReviewed(MarkConflictReviewedInput.make({ conflictId }))
          .pipe(Effect.catch(toVaultSyncActionError("MarkVaultSyncConflictReviewed"))),
      TriggerVaultSync: Effect.fn("TriggerVaultSync")(function* (payload) {
        const config = yield* workspaceVaultStore
          .getVaultConfig(payload.workspaceId)
          .pipe(Effect.catch(toVaultSyncActionError("TriggerVaultSync.workspaceVault")));
        const vaultRootPath = yield* pipe(
          config.vaultRootPath,
          O.match({
            onNone: () => VaultSyncActionError.failEffect("Workspace vault is not configured."),
            onSome: Effect.succeed,
          })
        );
        return yield* engine
          .syncOnce(SyncOnceInput.make({ vaultRootPath, workspaceId: payload.workspaceId }))
          .pipe(Effect.catch(toVaultSyncActionError("TriggerVaultSync")));
      }),
    });
  })
);
