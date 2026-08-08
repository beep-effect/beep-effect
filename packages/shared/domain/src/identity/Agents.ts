/**
 * Agents slice entity-id registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsDomainId } from "@beep/identity/packages";
import * as EntityId from "../entity/EntityId.ts";

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

/**
 * Skill entity identifier.
 *
 * **Example** (Log SkillId entityType)
 *
 * ```ts
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 *
 * console.log(Agents.SkillId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const SkillId = make("skill", {
  description: "Identifier for an agents slice skill entity.",
});

/**
 * Runtime type for {@link SkillId}.
 *
 * **Example** (Decode SkillId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Agents from "@beep/shared-domain/identity/Agents"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Agents.SkillId = yield* S.decodeUnknownEffect(Agents.SkillId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type SkillId = typeof SkillId.Type;
