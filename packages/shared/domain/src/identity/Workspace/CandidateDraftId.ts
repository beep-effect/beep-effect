/**
 * CandidateDraftId schema and runtime type.
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
 * Candidate draft entity identifier.
 *
 * **Example** (Log CandidateDraftId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateDraftId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateDraftId = make("candidate_draft", {
  description: "Identifier for a candidate draft entity.",
}).pipe(SchemaUtils.withSyncCodecStatics);

/**
 * Runtime type for {@link CandidateDraftId}.
 *
 * **Example** (Decode CandidateDraftId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateDraftId = yield* S.decodeUnknownEffect(Workspace.CandidateDraftId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateDraftId = typeof CandidateDraftId.Type;
