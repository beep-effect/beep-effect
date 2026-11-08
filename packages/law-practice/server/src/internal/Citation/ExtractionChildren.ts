/** Captured Effect services for private stages of one admitted extraction.
 * @internal @packageDocumentation @since 0.0.0
 */

import { CitationExtractionCleanerPlans } from "@beep/law-practice-use-cases/server";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { captureCitationOperationChildren } from "./Admission.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";

/** The owner must admit its outer operation before providing this Context to
 * private child installation/work. No child service may escape that invocation.
 * Reuse the parent permit; preserve native admission and Scope/text authority.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationExtractionChildren = Effect.fn("Citation.captureExtractionChildren")(function* () {
  const children = yield* captureCitationOperationChildren();
  const editions = yield* CitationFrozenEditions;
  const zone = yield* DateTime.CurrentTimeZone;
  const plans = yield* Effect.serviceOption(CitationExtractionCleanerPlans);
  const captured = children.pipe(
    Context.add(CitationFrozenEditions, editions),
    Context.add(DateTime.CurrentTimeZone, zone)
  );
  return O.isSome(plans) ? Context.add(captured, CitationExtractionCleanerPlans, plans.value) : captured;
});
