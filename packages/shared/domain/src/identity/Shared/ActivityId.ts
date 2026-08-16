/**
 * ActivityId schema and runtime type.
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
 * Activity entity identifier used by provenance and lifecycle entity fields.
 *
 * **Example** (Log activity table name)
 *
 * ```ts
 * import { ActivityId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ActivityId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ActivityId = make("activity", {
  description: "Identifier for a shared-kernel provenance activity entity.",
});

/**
 * Companion type for {@link ActivityId.Type}.
 *
 * **Example** (Decode ActivityId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ActivityId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ActivityId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ActivityId = typeof ActivityId.Type;
