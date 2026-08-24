/**
 * ThreadId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $WorkspaceDomainId.create("identity/Workspace");
const make = EntityId.factory("workspace", $I);

/**
 * Thread entity identifier.
 *
 * **Example** (Log ThreadId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.ThreadId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ThreadId = make("thread", {
  description: "Identifier for a durable workspace conversation thread.",
}).pipe(SchemaUtils.withSyncCodecStatics);

/**
 * Runtime type for {@link ThreadId}.
 *
 * **Example** (Decode ThreadId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.ThreadId = yield* S.decodeUnknownEffect(Workspace.ThreadId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ThreadId = typeof ThreadId.Type;
