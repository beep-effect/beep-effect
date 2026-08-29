/**
 * AgentId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $SharedDomainId.create("identity/Shared");
const make = EntityId.factory("shared", $I);

/**
 * Agent entity identifier.
 *
 * **Example** (Log agent table name)
 *
 * ```ts
 * import { AgentId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(AgentId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const AgentId = make("agent", {
  description: "Identifier for a shared-kernel agent entity.",
});

/**
 * Companion type for {@link AgentId.Type}.
 *
 * **Example** (Decode AgentId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AgentId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(AgentId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type AgentId = typeof AgentId.Type;
