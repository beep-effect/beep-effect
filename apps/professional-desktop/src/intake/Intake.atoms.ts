/**
 * Desktop document intake client atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy";
import { DocumentsRpcs, IntakeDroppedFilePayload } from "@beep/documents-use-cases/public";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { SetWorkspaceVaultInput, WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Atom, AtomRpc, Reactivity } from "effect/unstable/reactivity";
import { VaultDirectoryPickerRpcs } from "./VaultDirectoryPicker.rpc.ts";

const $I = $ProfessionalDesktopId.create("intake/Intake.atoms");

/**
 * Fixed local workspace id used by P1 desktop vault onboarding.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID } from "@/intake/Intake.atoms"
 *
 * console.log(DEFAULT_WORKSPACE_ID)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_WORKSPACE_ID = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(1);

const DesktopIntakeRpcs = WorkspaceVaultRpcs.merge(DocumentsRpcs, VaultDirectoryPickerRpcs);

class DesktopIntakeClient extends AtomRpc.Service<DesktopIntakeClient>()("DesktopIntakeClient", {
  group: DesktopIntakeRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
}) {}

const workspaceVaultKey = (workspaceId: WorkspaceIdentity.WorkspaceId) => `workspace-vault:${workspaceId}`;

/**
 * Atom family that reads the workspace vault configuration over desktop RPC.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID, workspaceVaultConfigAtom } from "@/intake/Intake.atoms"
 *
 * console.log(workspaceVaultConfigAtom(DEFAULT_WORKSPACE_ID))
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const workspaceVaultConfigAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  DesktopIntakeClient.query("GetWorkspaceVault", { workspaceId }, { reactivityKeys: [workspaceVaultKey(workspaceId)] })
);

/**
 * Browser-side form input for persisting a selected workspace vault root.
 *
 * @example
 * ```ts
 * import { ConfigureWorkspaceVaultInput, DEFAULT_WORKSPACE_ID } from "@/intake/Intake.atoms"
 *
 * const input = ConfigureWorkspaceVaultInput.make({
 *   vaultRootPath: "/tmp/beep-documents-vault",
 *   workspaceId: DEFAULT_WORKSPACE_ID
 * })
 * console.log(input.vaultRootPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
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

/**
 * Mutation atom that persists the selected workspace vault root.
 *
 * @example
 * ```ts
 * import { configureWorkspaceVaultAtom } from "@/intake/Intake.atoms"
 *
 * console.log(configureWorkspaceVaultAtom)
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const configureWorkspaceVaultAtom = DesktopIntakeClient.runtime.fn<ConfigureWorkspaceVaultInput>()(
  Effect.fn("configureWorkspaceVault")(function* (input) {
    const client = yield* DesktopIntakeClient;
    const payload = yield* S.decodeUnknownEffect(SetWorkspaceVaultInput)(input);
    yield* Reactivity.mutation(client("SetWorkspaceVault", payload), [workspaceVaultKey(input.workspaceId)]);
  })
);

/**
 * Mutation atom that asks the sidecar to open its host's native folder dialog
 * and resolves with the picked absolute directory path, or `null` on cancel.
 *
 * @example
 * ```ts
 * import { pickVaultDirectoryAtom } from "@/intake/Intake.atoms"
 *
 * console.log(pickVaultDirectoryAtom)
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const pickVaultDirectoryAtom = DesktopIntakeClient.runtime.fn<void>()(
  Effect.fn("pickVaultDirectory")(function* () {
    const client = yield* DesktopIntakeClient;
    return yield* client("PickVaultDirectory", void 0);
  })
);

/**
 * Browser-side dropped document input before the default filing context is attached.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID, DroppedDocumentInput } from "@/intake/Intake.atoms"
 *
 * const input = DroppedDocumentInput.make({
 *   content: new Uint8Array([1, 2, 3]),
 *   intakeBatchId: "batch-20260709",
 *   originalFileName: "complaint.pdf",
 *   workspaceId: DEFAULT_WORKSPACE_ID
 * })
 * console.log(input.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DroppedDocumentInput extends S.Class<DroppedDocumentInput>($I`DroppedDocumentInput`)(
  {
    content: S.Uint8ArrayFromBase64,
    intakeBatchId: IntakeBatchId,
    originalFileName: S.NonEmptyString,
    workspaceId: WorkspaceIdentity.WorkspaceId,
  },
  $I.annote("DroppedDocumentInput", {
    description: "Browser-side dropped document input.",
  })
) {}

/**
 * Attach the default filing context to a typed dropped document input.
 *
 * @example
 * ```ts
 * import { DEFAULT_WORKSPACE_ID, DroppedDocumentInput, intakeDroppedFilePayload } from "@/intake/Intake.atoms"
 *
 * const payload = intakeDroppedFilePayload(
 *   DroppedDocumentInput.make({
 *     content: new Uint8Array([1, 2, 3]),
 *     intakeBatchId: "batch-1",
 *     originalFileName: "complaint.pdf",
 *     workspaceId: DEFAULT_WORKSPACE_ID
 *   })
 * )
 * console.log(payload.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const intakeDroppedFilePayload = (input: DroppedDocumentInput): IntakeDroppedFilePayload =>
  IntakeDroppedFilePayload.make({
    ...input,
    filingContext: DefaultVaultFilingContext,
  });

/**
 * Mutation atom that sends one dropped document to the intake RPC and returns
 * the materialized document (vault path + filing outcome) for the intake UI.
 *
 * @example
 * ```ts
 * import { intakeDroppedDocumentAtom } from "@/intake/Intake.atoms"
 *
 * console.log(intakeDroppedDocumentAtom)
 * ```
 *
 * @category state
 * @since 0.0.0
 */
export const intakeDroppedDocumentAtom = DesktopIntakeClient.runtime.fn<DroppedDocumentInput>()(
  Effect.fn("intakeDroppedDocument")(function* (input) {
    const client = yield* DesktopIntakeClient;
    const payload = intakeDroppedFilePayload(input);
    return yield* Reactivity.mutation(client("IntakeDroppedFile", payload), [workspaceVaultKey(input.workspaceId)]);
  })
);
