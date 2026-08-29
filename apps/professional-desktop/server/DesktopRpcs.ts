/**
 * Side-effect-free RPC contract served by the professional desktop sidecar.
 *
 * Keeping the merged group outside the executable sidecar entrypoint lets
 * registration tests exercise the exact public contract without starting a
 * transport or reading process configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ChatRpcs } from "@beep/agents-use-cases/public";
import { DocumentsRpcs, VaultSyncRpcs } from "@beep/documents-use-cases/public";
import { ContradictionRpcs } from "@beep/epistemic-use-cases/public";
import { OntologyRpcs } from "@beep/ontology-use-cases/public";
import { WorkspaceVaultRpcs } from "@beep/workspace-use-cases/public";
import { VaultDirectoryPickerRpcs } from "@/intake/VaultDirectoryPicker.rpc";

/**
 * Complete RPC contract exposed over the authenticated desktop sidecar.
 *
 * @example
 * ```ts
 * import { DesktopRpcs } from "../../server/DesktopRpcs.js"
 *
 * console.log(DesktopRpcs.requests.size > 0) // true
 * ```
 *
 * @category RPCs
 * @since 0.0.0
 */
export const DesktopRpcs = ChatRpcs.merge(
  WorkspaceVaultRpcs,
  DocumentsRpcs,
  VaultSyncRpcs,
  OntologyRpcs,
  VaultDirectoryPickerRpcs,
  ContradictionRpcs
);
