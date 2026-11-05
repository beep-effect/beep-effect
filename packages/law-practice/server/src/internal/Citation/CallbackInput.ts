/** Shared verified preparation at the callback failure boundary.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { CitationCallbackFailure } from "./CallbackResource.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";

/** Verify once and translate only the closed input-failure reason.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationCallbackInput = Effect.fn("Citation.prepareCallbackInput")(function* (input: unknown) {
  return yield* prepareCitationResolution(input).pipe(
    Effect.mapError((error) => CitationCallbackFailure.make({ reason: error.reason }))
  );
});
