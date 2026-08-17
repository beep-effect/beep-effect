/**
 * ProviderInstanceId schema and runtime type.
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
 * Provider instance entity identifier.
 *
 * **Example** (Log ProviderInstanceId entityType)
 *
 * ```ts
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 *
 * console.log(Agents.ProviderInstanceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ProviderInstanceId = make("provider_instance", {
  description: "Identifier for an agents slice LLM provider CLI instance entity.",
});

/**
 * Runtime type for {@link ProviderInstanceId}.
 *
 * **Example** (Decode ProviderInstanceId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Agents.ProviderInstanceId = yield* S.decodeUnknownEffect(Agents.ProviderInstanceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ProviderInstanceId = typeof ProviderInstanceId.Type;
