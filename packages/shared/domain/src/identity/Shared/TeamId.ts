/**
 * TeamId schema and runtime type.
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
 * Team entity identifier.
 *
 * **Example** (Log team table name)
 *
 * ```ts
 * import { TeamId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(TeamId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const TeamId = make("team", {
  description: "Identifier for a shared-kernel team entity.",
});

/**
 * Companion type for {@link TeamId.Type}.
 *
 * **Example** (Decode TeamId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { TeamId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(TeamId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type TeamId = typeof TeamId.Type;
