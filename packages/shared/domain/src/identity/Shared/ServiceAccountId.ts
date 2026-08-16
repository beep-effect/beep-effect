/**
 * ServiceAccountId schema and runtime type.
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
 * Service-account entity identifier.
 *
 * **Example** (Log service-account table name)
 *
 * ```ts
 * import { ServiceAccountId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ServiceAccountId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ServiceAccountId = make("service_account", {
  description: "Identifier for a shared-kernel service account entity.",
});

/**
 * Companion type for {@link ServiceAccountId.Type}.
 *
 * **Example** (Decode ServiceAccountId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ServiceAccountId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ServiceAccountId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ServiceAccountId = typeof ServiceAccountId.Type;
