/**
 * App-level document intake orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentIntakeActionError, DocumentsRpcs, IntakeDroppedFileInput } from "@beep/documents-use-cases/public";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { observeWorkflow } from "@beep/observability/Metric";
import { WorkspaceVaultActionError, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import { IntakeOperationDuration, IntakeOperations } from "@/ProfessionalDesktop.instruments";

const intakeOperations = Metric.counter(IntakeOperations.name, { incremental: true });
const intakeDuration = Metric.timer(IntakeOperationDuration.name);

const observeIntakeOperation = Effect.fnUntraced(function* <A, E, R>(
  operation: string,
  effect: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* observeWorkflow(effect, {
    name: `professional_desktop.intake.${operation}`,
    attributes: { "beep.desktop.operation": operation },
    outcomes: intakeOperations,
    duration: intakeDuration,
  }).pipe(Effect.withSpan("DesktopIntake.run", { attributes: { "beep.desktop.operation": operation } }));
});

/**
 * Largest document the intake RPC accepts, in decoded bytes.
 *
 * The client refuses an oversized file before reading it, but the client is not
 * the boundary: content crosses this RPC base64-expanded and is held in memory
 * on both sides through extraction and filing, so a payload posted straight at
 * the sidecar could still exhaust it. Kept in step with the composer's limit.
 *
 * @category constants
 * @since 0.0.0
 */
const MAX_INTAKE_CONTENT_BYTES = 25 * 1024 * 1024;

const toWorkspaceVaultActionError = (context: string) =>
  Effect.fnUntraced(function* (error: { readonly _tag: string }): Effect.fn.Return<never, WorkspaceVaultActionError> {
    yield* logRedactedCause(
      Cause.fail(error),
      LogRedactedCauseOptions.make({
        message: "workspace vault action dropped internal failure",
        level: "Warn",
        attributes: {
          "professional_desktop.subsystem": "workspace_vault",
          "professional_desktop.workspace_vault.context": context,
        },
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
        attributes: {
          "professional_desktop.intake.context": context,
          "professional_desktop.subsystem": "document_intake",
        },
      })
    );
    return yield* DocumentIntakeActionError.failEffect(context);
  });

/**
 * RPC handler layer for workspace vault configuration commands.
 *
 * **Example** (Verify Layer Instance)
 *
 * ```ts
 * import { WorkspaceVaultHandlersLive } from "@/intake/DocumentIntakeOrchestrator"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(WorkspaceVaultHandlersLive)) // true
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
 * **Example** (Verify Layer Instance)
 *
 * ```ts
 * import { DocumentIntakeHandlersLive } from "@/intake/DocumentIntakeOrchestrator"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(DocumentIntakeHandlersLive)) // true
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
      IntakeDroppedFile: Effect.fn("professional_desktop.intake.intake_dropped_file")(function* (payload) {
        return yield* observeIntakeOperation(
          "dropped_file",
          Effect.gen(function* () {
            // decision: intake-rpc-rechecks-client-refusals
            if (payload.content.length > MAX_INTAKE_CONTENT_BYTES) {
              return yield* DocumentIntakeActionError.failEffect(
                `Document exceeds the ${Math.round(MAX_INTAKE_CONTENT_BYTES / (1024 * 1024))} MB intake limit.`
              );
            }
            if (payload.content.length === 0) {
              return yield* DocumentIntakeActionError.failEffect("The document is empty, so there is nothing to file.");
            }
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
              .intakeDroppedFile(IntakeDroppedFileInput.make({ ...payload, vaultRootPath }))
              .pipe(Effect.catch(toDocumentIntakeActionError("IntakeDroppedFile")));
          })
        );
      }),
    });
  })
);
