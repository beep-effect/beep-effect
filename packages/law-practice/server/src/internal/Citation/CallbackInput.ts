/** Shared verified preparation at the callback failure boundary.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import { copyCitationCallbackFailure } from "./CallbackResource.ts";
import { prepareCitationResolution } from "./ResolutionInput.ts";

/** Verify once and preserve closed input-failure and actual budget metadata.
 * @internal @category operations @since 0.0.0
 */
export const prepareCitationCallbackInput = Effect.fn("Citation.prepareCallbackInput")(function* (input: unknown) {
  return yield* prepareCitationResolution(input).pipe(Effect.mapError(copyCitationCallbackFailure));
});
