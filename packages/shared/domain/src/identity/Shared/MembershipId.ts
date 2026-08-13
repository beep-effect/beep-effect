/**
 * MembershipId schema and runtime type.
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
 * Membership entity identifier.
 *
 * **Example** (Log membership table name)
 *
 * ```ts
 * import { MembershipId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(MembershipId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MembershipId = make("membership", {
  description: "Identifier for a shared-kernel membership entity.",
});

/**
 * Companion type for {@link MembershipId.Type}.
 *
 * **Example** (Decode MembershipId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { MembershipId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(MembershipId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type MembershipId = typeof MembershipId.Type;
