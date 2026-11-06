/** Captured Effect services for private stages of one admitted extraction.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { CitationOperationAdmission } from "./Admission.ts";
import { CitationFrozenEditions } from "./FrozenEditions.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

/** The owner must admit its outer operation before providing this Context to
 * private child installation/work. No child service may escape that invocation.
 * Reuse the parent permit; preserve native admission and Scope/text authority.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationExtractionChildren = Effect.fn("Citation.captureExtractionChildren")(function* () {
  const admission = yield* CitationOperationAdmission;
  const editions = yield* CitationFrozenEditions;
  const zone = yield* DateTime.CurrentTimeZone;
  const nested = CitationOperationAdmission.of({
    run: Effect.fn("Citation.reuseExtractionPermit")(
      <A, E>(_: CitationSafetyLimitExceeded["operation"], body: Effect.Effect<A, E>) => body
    ),
    snapshot: admission.snapshot,
  });
  return Context.make(CitationOperationAdmission, nested).pipe(
    Context.add(CitationFrozenEditions, editions),
    Context.add(DateTime.CurrentTimeZone, zone)
  );
});
