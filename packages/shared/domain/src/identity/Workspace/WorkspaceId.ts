/**
 * WorkspaceId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $WorkspaceDomainId.create("identity/Workspace");
const make = EntityId.factory("workspace", $I);

/**
 * Workspace entity identifier.
 *
 * **Example** (Log WorkspaceId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.WorkspaceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const WorkspaceId = make("workspace", {
  description: "Identifier for a workspace entity.",
});

/**
 * Runtime type for {@link WorkspaceId}.
 *
 * **Example** (Decode WorkspaceId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.WorkspaceId = yield* S.decodeUnknownEffect(Workspace.WorkspaceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type WorkspaceId = typeof WorkspaceId.Type;
