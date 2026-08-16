/**
 * UserId schema and runtime type.
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
 * User entity identifier.
 *
 * **Example** (Log user table name)
 *
 * ```ts
 * import { UserId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(UserId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const UserId = make("user", {
  description: "Identifier for a shared-kernel user entity.",
});

/**
 * Companion type for {@link UserId.Type}.
 *
 * **Example** (Decode UserId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { UserId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(UserId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type UserId = typeof UserId.Type;
