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
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { observeWorkflow } from "@beep/observability/Metric";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";

const syncStarted = Metric.counter("desktop_vault_sync_operations_started_total", { incremental: true });
const syncCompleted = Metric.counter("desktop_vault_sync_operations_completed_total", { incremental: true });
const syncFailed = Metric.counter("desktop_vault_sync_operations_failed_total", { incremental: true });
const syncInterrupted = Metric.counter("desktop_vault_sync_operations_interrupted_total", { incremental: true });
const syncDuration = Metric.timer("desktop_vault_sync_operation_duration");

const observeSyncOperation = Effect.fnUntraced(function* <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* observeWorkflow(effect, {
    name: `documents.sync.${operation}`,
    attributes: { operation },
    started: syncStarted,
    completed: syncCompleted,
    failed: syncFailed,
    interrupted: syncInterrupted,
    duration: syncDuration,
  }).pipe(Effect.withSpan(`documents.sync.${operation}`));
});

const toVaultSyncActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }): Effect.fn.Return<never, VaultSyncActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "vault sync action dropped internal failure",
        level: "Warn",
        attributes: { context, subsystem: "vault_sync" },
      })
    );
    return yield* VaultSyncActionError.failEffect(context);
  });

/**
 * RPC handler layer for workspace vault sync commands.
 *
 * **Details**
 *
 * Resolves the workspace vault configuration before triggering a sync pass and
 * translates every internal engine failure into the client-safe
 * {@link VaultSyncActionError} so no driver or repository detail leaks over the
 * wire.
 *
 * **Example** (Verify as Effect Layer)
 *
 * ```ts
 * import { VaultSyncHandlersLive } from "@/sync/VaultSyncOrchestrator"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(VaultSyncHandlersLive)) // true
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
      GetVaultSyncStatus: ({ forceProbe, workspaceId }) =>
        observeSyncOperation(
          "get_status",
          engine
            .status(VaultSyncStatusInput.make({ forceProbe, workspaceId }))
            .pipe(Effect.catch(toVaultSyncActionError("GetVaultSyncStatus")))
        ),
      ListVaultSyncConflicts: ({ workspaceId }) =>
        observeSyncOperation(
          "list_conflicts",
          engine
            .listOpenConflicts(ListOpenConflictsInput.make({ workspaceId }))
            .pipe(Effect.catch(toVaultSyncActionError("ListVaultSyncConflicts")))
        ),
      MarkVaultSyncConflictReviewed: ({ conflictId, workspaceId }) =>
        observeSyncOperation(
          "mark_conflict_reviewed",
          engine
            .markConflictReviewed(MarkConflictReviewedInput.make({ conflictId, workspaceId }))
            .pipe(Effect.catch(toVaultSyncActionError("MarkVaultSyncConflictReviewed")))
        ),
      TriggerVaultSync: Effect.fn("TriggerVaultSync")(function* (payload) {
        return yield* observeSyncOperation(
          "trigger",
          Effect.gen(function* () {
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
          })
        );
      }),
    });
  })
);
