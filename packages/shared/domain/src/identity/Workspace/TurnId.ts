/**
 * TurnId schema and runtime type.
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
 * Turn entity identifier.
 *
 * **Example** (Log TurnId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.TurnId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const TurnId = make("turn", {
  description: "Identifier for a workspace conversation turn aggregate.",
});

/**
 * Runtime type for {@link TurnId}.
 *
 * **Example** (Decode TurnId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.TurnId = yield* S.decodeUnknownEffect(Workspace.TurnId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type TurnId = typeof TurnId.Type;
