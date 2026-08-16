/**
 * AgentId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $AgentsDomainId.create("identity/Agents");
const make = EntityId.factory("agents", $I);

/**
 * Agent entity identifier.
 *
 * **Example** (Log AgentId entityType)
 *
 * ```ts
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 *
 * console.log(Agents.AgentId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const AgentId = make("agent", {
  description: "Identifier for an agents slice agent entity.",
});

/**
 * Runtime type for {@link AgentId}.
 *
 * **Example** (Decode AgentId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Agents.AgentId = yield* S.decodeUnknownEffect(Agents.AgentId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type;
