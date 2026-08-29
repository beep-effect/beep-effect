/**
 * Professional Desktop workspace identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

/**
 * The single workspace owned by the current desktop increment.
 *
 * **Details**
 *
 * Chat, document intake, and vault sync share this identity until the shell
 * grows an explicit workspace-selection state machine.
 *
 * **Example** (Log default workspace ID)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 *
 * console.log(Number(DEFAULT_PROFESSIONAL_WORKSPACE_ID)) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_PROFESSIONAL_WORKSPACE_ID = WorkspaceIdentity.WorkspaceId.make(1);
