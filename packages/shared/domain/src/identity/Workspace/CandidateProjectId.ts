/**
 * CandidateProjectId schema and runtime type.
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
 * Candidate project entity identifier.
 *
 * **Example** (Log CandidateProjectId entity type)
 *
 * ```ts
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 *
 * console.log(Workspace.CandidateProjectId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandidateProjectId = make("candidate_project", {
  description: "Identifier for a candidate project entity.",
});

/**
 * Runtime type for {@link CandidateProjectId}.
 *
 * **Example** (Decode CandidateProjectId with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Workspace.CandidateProjectId = yield* S.decodeUnknownEffect(Workspace.CandidateProjectId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type CandidateProjectId = typeof CandidateProjectId.Type;
