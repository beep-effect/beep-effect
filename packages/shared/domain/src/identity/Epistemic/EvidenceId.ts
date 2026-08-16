/**
 * EvidenceId schema and runtime type.
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
 * Evidence entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.EvidenceId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EvidenceId = make("evidence", {
  description: "Identifier for an evidence entity.",
});

/**
 * Runtime type for {@link EvidenceId}.
 *
 * **Example** (Decode EvidenceId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.EvidenceId = yield* S.decodeUnknownEffect(Epistemic.EvidenceId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EvidenceId = typeof EvidenceId.Type;
