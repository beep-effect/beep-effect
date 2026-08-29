/**
 * AgentVersionId schema and runtime type.
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
 * Agent-version entity identifier.
 *
 * **Example** (Log agent-version table name)
 *
 * ```ts
 * import { AgentVersionId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(AgentVersionId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const AgentVersionId = make("agent_version", {
  description: "Identifier for a shared-kernel agent version entity.",
});

/**
 * Companion type for {@link AgentVersionId.Type}.
 *
 * **Example** (Decode AgentVersionId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { AgentVersionId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(AgentVersionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type AgentVersionId = typeof AgentVersionId.Type;
