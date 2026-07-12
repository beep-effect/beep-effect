/**
 * App-level document intake orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentIntakeActionError, DocumentsRpcs } from "@beep/documents-use-cases/public";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { LogRedactedCauseOptions, logRedactedCause, observeWorkflow } from "@beep/observability";
import { WorkspaceVaultActionError, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Cause, Effect, Metric, pipe } from "effect";
import * as O from "effect/Option";

const intakeStarted = Metric.counter("desktop_intake_operations_started_total", { incremental: true });
const intakeCompleted = Metric.counter("desktop_intake_operations_completed_total", { incremental: true });
const intakeFailed = Metric.counter("desktop_intake_operations_failed_total", { incremental: true });
const intakeInterrupted = Metric.counter("desktop_intake_operations_interrupted_total", { incremental: true });
const intakeDuration = Metric.timer("desktop_intake_operation_duration");

const observeIntakeOperation = Effect.fnUntraced(function* <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* observeWorkflow(effect, {
    name: `documents.intake.${operation}`,
    attributes: { operation },
    started: intakeStarted,
    completed: intakeCompleted,
    failed: intakeFailed,
    interrupted: intakeInterrupted,
    duration: intakeDuration,
  }).pipe(Effect.withSpan(`documents.intake.${operation}`));
});

const toWorkspaceVaultActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }): Effect.fn.Return<never, WorkspaceVaultActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "workspace vault action dropped internal failure",
        level: "Warn",
        attributes: { context, subsystem: "workspace_vault" },
      })
    );
    return yield* WorkspaceVaultActionError.failEffect(context);
  });

const toDocumentIntakeActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }): Effect.fn.Return<never, DocumentIntakeActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "document intake action dropped internal failure",
        level: "Warn",
        attributes: { context, subsystem: "document_intake" },
      })
    );
    return yield* DocumentIntakeActionError.failEffect(context);
  });

/**
 * RPC handler layer for workspace vault configuration commands.
 *
 * @example
 * ```ts
 * import { WorkspaceVaultHandlersLive } from "@/intake/DocumentIntakeOrchestrator"
 *
 * console.log(WorkspaceVaultHandlersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WorkspaceVaultHandlersLive = WorkspaceVaultRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
    return WorkspaceVaultRpcs.of({
      GetWorkspaceVault: ({ workspaceId }) =>
        observeIntakeOperation(
          "get_workspace_vault",
          store.getVaultConfig(workspaceId).pipe(Effect.catch(toWorkspaceVaultActionError("GetWorkspaceVault")))
        ),
      SetWorkspaceVault: (input) =>
        observeIntakeOperation(
          "set_workspace_vault",
          store.setVaultRoot(input).pipe(Effect.catch(toWorkspaceVaultActionError("SetWorkspaceVault")))
        ),
    });
  })
);

/**
 * RPC handler layer for dropped legal document intake commands.
 *
 * @example
 * ```ts
 * import { DocumentIntakeHandlersLive } from "@/intake/DocumentIntakeOrchestrator"
 *
 * console.log(DocumentIntakeHandlersLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DocumentIntakeHandlersLive = DocumentsRpcs.toLayer(
  Effect.gen(function* () {
    const workspaceVaultStore = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
    const documentIntake = yield* DocumentUseCases.Document.DocumentIntake;
    return DocumentsRpcs.of({
      IntakeDroppedFile: Effect.fn("IntakeDroppedFile")(function* (payload) {
        return yield* observeIntakeOperation(
          "dropped_file",
          Effect.gen(function* () {
            const config = yield* workspaceVaultStore
              .getVaultConfig(payload.workspaceId)
              .pipe(Effect.catch(toDocumentIntakeActionError("IntakeDroppedFile.workspaceVault")));
            const vaultRootPath = yield* pipe(
              config.vaultRootPath,
              O.match({
                onNone: () => DocumentIntakeActionError.failEffect("Workspace vault is not configured."),
                onSome: Effect.succeed,
              })
            );
            return yield* documentIntake
              .intakeDroppedFile({ ...payload, vaultRootPath })
              .pipe(Effect.catch(toDocumentIntakeActionError("IntakeDroppedFile")));
          })
        );
      }),
    });
  })
);
