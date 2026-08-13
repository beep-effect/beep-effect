/**
 * ConnectorAccountId schema and runtime type.
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
 * Connector-account entity identifier.
 *
 * **Example** (Log connector-account table name)
 *
 * ```ts
 * import { ConnectorAccountId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(ConnectorAccountId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ConnectorAccountId = make("connector_account", {
  description: "Identifier for a shared-kernel connector account entity.",
});

/**
 * Companion type for {@link ConnectorAccountId.Type}.
 *
 * **Example** (Decode ConnectorAccountId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { ConnectorAccountId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(ConnectorAccountId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ConnectorAccountId = typeof ConnectorAccountId.Type;
