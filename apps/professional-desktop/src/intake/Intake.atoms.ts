/**
 * Desktop document intake client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy";
import { DocumentsRpcs, IntakeDroppedFilePayload } from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { SetWorkspaceVaultInput, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";

const $I = $ProfessionalDesktopId.create("intake/Intake.atoms");

export const DEFAULT_WORKSPACE_ID = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1);

const DesktopIntakeRpcs = WorkspaceVaultRpcs.merge(DocumentsRpcs);

class DesktopIntakeClient extends AtomRpc.Service<DesktopIntakeClient>()("DesktopIntakeClient", {
  group: DesktopIntakeRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
}) {}

const workspaceVaultKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `workspace-vault:${workspaceId}`;

export const workspaceVaultConfigAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.query("GetWorkspaceVault", { workspaceId }, { reactivityKeys: [workspaceVaultKey(workspaceId)] })
);

export class ConfigureWorkspaceVaultInput extends S.Class<ConfigureWorkspaceVaultInput>(
  $I`ConfigureWorkspaceVaultInput`
)(
  {
    vaultRootPath: S.NonEmptyString,
    workspaceId: WorkspaceIdentity.WorkspaceId,
  },
  $I.annote("ConfigureWorkspaceVaultInput", {
    description: "Browser-side workspace vault configuration input.",
  })
) {}

export const configureWorkspaceVaultAtom = DesktopIntakeClient.runtime.fn<ConfigureWorkspaceVaultInput>()(
  Effect.fn("configureWorkspaceVault")(function* (input) {
    const client = yield* DesktopIntakeClient;
    const payload = yield* S.decodeUnknownEffect(SetWorkspaceVaultInput)(input);
    yield* Reactivity.mutation(client("SetWorkspaceVault", payload), [workspaceVaultKey(input.workspaceId)]);
  })
);

export class DroppedDocumentInput extends S.Class<DroppedDocumentInput>($I`DroppedDocumentInput`)(
  {
    content: S.Uint8ArrayFromBase64,
    intakeBatchId: S.NonEmptyString,
    originalFileName: S.NonEmptyString,
    workspaceId: WorkspaceIdentity.WorkspaceId,
  },
  $I.annote("DroppedDocumentInput", {
    description: "Browser-side dropped document input.",
  })
) {}

export const intakeDroppedDocumentAtom = DesktopIntakeClient.runtime.fn<DroppedDocumentInput>()(
  Effect.fn("intakeDroppedDocument")(function* (input) {
    const client = yield* DesktopIntakeClient;
    const payload = yield* S.decodeUnknownEffect(IntakeDroppedFilePayload)({
      ...input,
      filingContext: DefaultVaultFilingContext,
    });
    yield* Reactivity.mutation(client("IntakeDroppedFile", payload), [workspaceVaultKey(input.workspaceId)]);
  })
);
