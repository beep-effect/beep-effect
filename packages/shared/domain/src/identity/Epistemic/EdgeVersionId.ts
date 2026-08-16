/**
 * EdgeVersionId schema and runtime type.
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
 * Bitemporal epistemic edge version entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.EdgeVersionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const EdgeVersionId = make("edge_version", {
  description: "Identifier for a bitemporal epistemic edge version entity.",
});

/**
 * Runtime type for {@link EdgeVersionId}.
 *
 * **Example** (Decode EdgeVersionId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.EdgeVersionId = yield* S.decodeUnknownEffect(Epistemic.EdgeVersionId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type EdgeVersionId = typeof EdgeVersionId.Type;
