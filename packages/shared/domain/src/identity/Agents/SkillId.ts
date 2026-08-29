/**
 * SkillId schema and runtime type.
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
