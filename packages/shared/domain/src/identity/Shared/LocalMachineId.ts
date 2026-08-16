/**
 * LocalMachineId schema and runtime type.
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
 * Local-machine entity identifier used by synchronization metadata.
 *
 * **Example** (Log local-machine table name)
 *
 * ```ts
 * import { LocalMachineId } from "@beep/shared-domain/identity/Shared"
 *
 * console.log(LocalMachineId.tableName)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const LocalMachineId = make("local_machine", {
  description: "Identifier for a local machine participating in sync.",
});

/**
 * Companion type for {@link LocalMachineId.Type}.
 *
 * **Example** (Decode LocalMachineId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { LocalMachineId } from "@beep/shared-domain/identity/Shared"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id = yield* S.decodeUnknownEffect(LocalMachineId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type LocalMachineId = typeof LocalMachineId.Type;
