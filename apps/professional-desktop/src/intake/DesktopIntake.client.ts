/**
 * Desktop RPC client shared by the document intake statechart and its atoms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { chatProtocolLayerAtom } from "@beep/agents-client";
import { DocumentsRpcs } from "@beep/documents-use-cases/public";
import { WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import { AtomRpc } from "effect/reactivity";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { VaultDirectoryPickerRpcs } from "./VaultDirectoryPicker.rpc.ts";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const DesktopIntakeRpcs = WorkspaceVaultRpcs.merge(DocumentsRpcs, VaultDirectoryPickerRpcs);

/**
 * Desktop RPC context used by document intake and workspace-vault flows.
 *
 * **Details**
 *
 * Exported so machine and runtime-atom tests can provide deterministic service
 * layers without opening a transport.
 *
 * **Example** (Check runtime function type)
 *
 * ```ts
 * import { DesktopIntakeClient } from "@/intake/DesktopIntake.client"
 *
 * console.log(typeof DesktopIntakeClient.runtime.fn === "function") // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DesktopIntakeClient extends AtomRpc.Service<DesktopIntakeClient>()("DesktopIntakeClient", {
  group: DesktopIntakeRpcs,
  protocol: (get) => get(chatProtocolLayerAtom),
  runtime: professionalBrowserRuntime.factory,
}) {}

/**
 * Reactivity key that invalidates workspace vault configuration reads.
 *
 * **Example** (Build a vault reactivity key)
 *
 * ```ts
 * import { workspaceVaultKey } from "@/intake/DesktopIntake.client"
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * console.log(workspaceVaultKey(DEFAULT_PROFESSIONAL_WORKSPACE_ID).startsWith("workspace-vault:")) // true
 * ```
 *
 * @param workspaceId - Workspace whose vault configuration is keyed.
 * @returns The reactivity key for that workspace's vault configuration.
 * @category reactivity
 * @since 0.0.0
 */
export const workspaceVaultKey = (workspaceId: WorkspaceIdentity.WorkspaceId): string =>
  `workspace-vault:${workspaceId}`;
