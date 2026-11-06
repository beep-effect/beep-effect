/** Synthetic fixture ports; never an actual Cowork enrollment.
 * @internal
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { makeCoworkLifecycleCore } from "../internal/cowork-lifecycle-core.ts";
import { prepareCoworkCallback } from "../internal/cowork-lifecycle-forward.ts";
import { CursorLifecycleSourceContract } from "../internal/cursor-lifecycle-schemas.ts";
import type { CoworkLifecyclePolicy } from "../internal/cowork-lifecycle-schemas.ts";
/** Synthetic pinned-file contract, unavailable from the production receiver. */
export const makeCoworkLifecycleFixtureReceiver = (policy: CoworkLifecyclePolicy) =>
  makeCoworkLifecycleCore(
    policy,
    CursorLifecycleSourceContract.make({
      pins: A.map(policy.sourcePins, (pin) => ({ suffix: pin.path, sha256: pin.sha256 })),
    })
  );
/** Selector and occurrence injection belongs only to offline fixtures. */
export const prepareCoworkLifecycleFixtureHook = prepareCoworkCallback;
export { coworkPeerSource } from "../internal/cowork-peer-source.ts";
export { hashObservationPayload, nativeTraceWire } from "../internal/native-trace-wire.ts";
