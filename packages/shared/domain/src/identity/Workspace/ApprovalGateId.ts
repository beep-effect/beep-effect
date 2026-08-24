/**
 * ApprovalGateId schema and runtime type.
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
 * Approval gate entity identifier.
 *
 * **Example** (Log ApprovalGateId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ApprovalGateId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ApprovalGateId = make("approval_gate", {
  description: "Identifier for an approval gate entity.",
});

/**
 * Runtime type for {@link ApprovalGateId}.
 *
 * **Example** (Decode ApprovalGateId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ApprovalGateId = yield* S.decodeUnknownEffect(Workspace.ApprovalGateId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ApprovalGateId = typeof ApprovalGateId.Type;
