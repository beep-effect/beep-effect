/**
 * ContextPacketId schema and runtime type.
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
 * Context packet entity identifier.
 *
 * **Example** (Log ContextPacketId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ContextPacketId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ContextPacketId = make("context_packet", {
  description: "Identifier for a bounded context packet entity.",
});

/**
 * Runtime type for {@link ContextPacketId}.
 *
 * **Example** (Decode ContextPacketId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ContextPacketId = yield* S.decodeUnknownEffect(Workspace.ContextPacketId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ContextPacketId = typeof ContextPacketId.Type;
