/**
 * MessageId schema and runtime type.
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
 * Message entity identifier.
 *
 * **Example** (Log MessageId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.MessageId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const MessageId = make("message", {
  description: "Identifier for md-aligned workspace message content.",
}).pipe(SchemaUtils.withSyncCodecStatics);

/**
 * Runtime type for {@link MessageId}.
 *
 * **Example** (Decode MessageId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.MessageId = yield* S.decodeUnknownEffect(Workspace.MessageId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type MessageId = typeof MessageId.Type;
