/**
 * Reason-free egress denial vocabulary.
 *
 * A governed egress boundary that refuses a destination tells the caller only
 * THAT it refused, never WHY: a denial reason returned to an agent is a
 * payload-smuggling and probing channel, so the bounded reason lives with the
 * policy's own record keeping and the server log, and this error deliberately
 * carries no fields at all. This package is the right home because it is the
 * shared transport vocabulary both the enforcing side and the consuming side
 * already speak — the error is vocabulary, not an enforcement seam.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ApiTransportId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ApiTransportId.create("EgressDenied");

/**
 * A governed egress boundary refused the request's destination.
 *
 * **Details**
 *
 * Deliberately field-free: the denial reason is recorded by the policy that
 * refused, never surfaced to the caller. Consumers match on the tag (or use
 * {@link EgressDenied.is}) inside a failure cause and translate to their own
 * typed refusal.
 *
 * **Example** (Make and is check)
 *
 * ```ts
 * import { EgressDenied } from "@beep/api-transport"
 *
 * const denial = EgressDenied.make({})
 * console.log(denial._tag)
 * // "EgressDenied"
 * console.log(EgressDenied.is(denial))
 * // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class EgressDenied extends TaggedErrorClass<EgressDenied>($I`EgressDenied`)(
  "EgressDenied",
  {},
  $I.annote("EgressDenied", {
    description: "A governed egress boundary refused the request's destination; deliberately reason-free.",
  })
) {
  static readonly is = S.is(EgressDenied);
}
