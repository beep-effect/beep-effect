/** Source-only callback preparation; selector is supplied by the fixed public helper boundary. */
import * as Effect from "effect/Effect";
import { CoworkLifecycleCodecs } from "./cowork-lifecycle-schemas.ts";
import { failure } from "./cursor-lifecycle-schemas.ts";
import { exchangeLifecycle, validateLifecycleCallbackInput } from "./lifecycle-exchange.ts";
/** Internal injected-selector boundary; production reads only its own inherited public selector. */
export const prepareCoworkCallback = Effect.fn("AiMetrics.coworkLifecycle.prepare")(function* (
  socketPath: string,
  body: string,
  selector: string | undefined,
  occurrenceId: string
) {
  if (selector !== "local-agent") return yield* failure("callback");
  yield* validateLifecycleCallbackInput(socketPath, body);
  const callback = yield* CoworkLifecycleCodecs.decodeCallback(body).pipe(Effect.mapError(() => failure("callback")));
  const projected = yield* CoworkLifecycleCodecs.encodeEnvelope(
    CoworkLifecycleCodecs.makeEnvelope({ callback, occurrenceId })
  ).pipe(Effect.mapError(() => failure("callback")));
  // The prepared send retains this occurrence identity for explicit transport retry/readback; never a model retry.
  return { send: exchangeLifecycle(socketPath, projected, 1200) };
});
