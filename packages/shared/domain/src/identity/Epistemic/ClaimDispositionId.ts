/**
 * ClaimDispositionId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $EpistemicDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $EpistemicDomainId.create("identity/Epistemic");
const make = EntityId.factory("epistemic", $I);

/**
 * Durable claim disposition entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.ClaimDispositionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ClaimDispositionId = make("claim_disposition", {
  description: "Identifier for a durable claim disposition entity.",
});

/**
 * Runtime type for {@link ClaimDispositionId}.
 *
 * **Example** (Decode ClaimDispositionId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.ClaimDispositionId = yield* S.decodeUnknownEffect(Epistemic.ClaimDispositionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type ClaimDispositionId = typeof ClaimDispositionId.Type;
