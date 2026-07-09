/**
 * App-level document intake orchestration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DocumentIntakeActionError, DocumentsRpcs } from "@beep/documents-use-cases/public";
import * as DocumentUseCases from "@beep/documents-use-cases/server";
import { WorkspaceVaultActionError, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import * as WorkspaceUseCases from "@beep/workspace-use-cases/server";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";

const toWorkspaceVaultActionError =
  (context: string) =>
  (error: { readonly _tag: string }): Effect.Effect<never, WorkspaceVaultActionError> =>
    Effect.logWarning("workspace vault action dropped internal failure", { context, detail: error }).pipe(
      Effect.andThen(WorkspaceVaultActionError.failEffect(context))
    );

const toDocumentIntakeActionError =
  (context: string) =>
  (error: { readonly _tag: string }): Effect.Effect<never, DocumentIntakeActionError> =>
    Effect.logWarning("document intake action dropped internal failure", { context, detail: error }).pipe(
      Effect.andThen(DocumentIntakeActionError.failEffect(context))
    );

export const WorkspaceVaultHandlersLive = WorkspaceVaultRpcs.toLayer(
  Effect.gen(function* () {
    const store = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
    return WorkspaceVaultRpcs.of({
      GetWorkspaceVault: ({ workspaceId }) =>
        store.getVaultConfig(workspaceId).pipe(Effect.catch(toWorkspaceVaultActionError("GetWorkspaceVault"))),
      SetWorkspaceVault: (input) =>
        store.setVaultRoot(input).pipe(Effect.catch(toWorkspaceVaultActionError("SetWorkspaceVault"))),
    });
  })
);

export const DocumentIntakeHandlersLive = DocumentsRpcs.toLayer(
  Effect.gen(function* () {
    const workspaceVaultStore = yield* WorkspaceUseCases.Workspace.WorkspaceVaultStore;
    const documentIntake = yield* DocumentUseCases.Document.DocumentIntake;
    return DocumentsRpcs.of({
      IntakeDroppedFile: Effect.fn("IntakeDroppedFile")(function* (payload) {
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
      }),
    });
  })
);
