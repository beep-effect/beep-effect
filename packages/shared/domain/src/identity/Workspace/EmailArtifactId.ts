/**
 * EmailArtifactId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $WorkspaceDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $WorkspaceDomainId.create("identity/Workspace");
const make = EntityId.factory("workspace", $I);

/**
 * Email artifact entity identifier.
 *
 * **Example** (Log EmailArtifactId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.EmailArtifactId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EmailArtifactId = make("email_artifact", {
  description: "Identifier for a normalized email artifact entity.",
});

/**
 * Runtime type for {@link EmailArtifactId}.
 *
 * **Example** (Decode EmailArtifactId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.EmailArtifactId = yield* S.decodeUnknownEffect(Workspace.EmailArtifactId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EmailArtifactId = typeof EmailArtifactId.Type;
