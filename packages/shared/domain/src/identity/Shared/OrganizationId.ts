/**
 * OrganizationId schema and runtime type.
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
 * Organization entity identifier.
 *
 * **Example** (Log organization table name)
 *
 * ```ts
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(OrganizationId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const OrganizationId = make("organization", {
  description: "Identifier for a shared-kernel organization entity.",
});

/**
 * Companion type for {@link OrganizationId.Type}.
 *
 * **Example** (Decode OrganizationId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { OrganizationId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(OrganizationId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type OrganizationId = typeof OrganizationId.Type;
