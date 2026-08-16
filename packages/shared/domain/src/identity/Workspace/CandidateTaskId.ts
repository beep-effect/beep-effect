/**
 * CandidateTaskId schema and runtime type.
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
 * Candidate task entity identifier.
 *
 * **Example** (Log CandidateTaskId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateTaskId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateTaskId = make("candidate_task", {
  description: "Identifier for a candidate task entity.",
});

/**
 * Runtime type for {@link CandidateTaskId}.
 *
 * **Example** (Decode CandidateTaskId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateTaskId = yield* S.decodeUnknownEffect(Workspace.CandidateTaskId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateTaskId = typeof CandidateTaskId.Type;
