/**
 * UsageRecordId schema and runtime type.
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
 * Usage record entity identifier.
 *
 * **Example** (Log entity type)
 *
 * ```ts
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 *
 * console.log(Epistemic.UsageRecordId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const UsageRecordId = make("usage_record", {
  description: "Identifier for a usage attribution record entity.",
});

/**
 * Runtime type for {@link UsageRecordId}.
 *
 * **Example** (Decode UsageRecordId value)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as Epistemic from "@beep/shared-domain/identity/Epistemic"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const id: Epistemic.UsageRecordId = yield* S.decodeUnknownEffect(Epistemic.UsageRecordId)(1)
 *   return id
 * })
 * console.log(program)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export type UsageRecordId = typeof UsageRecordId.Type;
