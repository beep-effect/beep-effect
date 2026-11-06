/** Synthetic fixture ports; never an actual Cowork enrollment.
 * @internal
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { makeCoworkLifecycleCore } from "../internal/cowork-lifecycle-core.ts";
import { prepareCoworkCallback } from "../internal/cowork-lifecycle-forward.ts";
import { CursorLifecycleSourceContract } from "../internal/cursor-lifecycle-schemas.ts";
import type { CoworkLifecyclePolicy } from "../internal/cowork-lifecycle-schemas.ts";
/**
 * Creates an offline receiver using explicitly enrolled synthetic public files.
 * Never supplies an actual Cowork enrollment.
 *
 * **Example** (Inspect the synthetic constructor without opening a listener)
 *
 * ```ts
 * import { makeCoworkLifecycleFixtureReceiver } from "@beep/repo-ai-metrics/test/claude-cowork-lifecycle"
 *
 * console.log(typeof makeCoworkLifecycleFixtureReceiver)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeCoworkLifecycleFixtureReceiver = (policy: CoworkLifecyclePolicy) =>
  makeCoworkLifecycleCore(
    policy,
    CursorLifecycleSourceContract.make({
      pins: A.map(policy.sourcePins, (pin) => ({ suffix: pin.path, sha256: pin.sha256 })),
    })
  );
/**
 * Prepares an offline callback with explicit selector and occurrence injection.
 * The production plugin reads its own selector and generates its own occurrence.
 *
 * **Example** (Inspect the fixture callback port without sending a callback)
 *
 * ```ts
 * import { prepareCoworkLifecycleFixtureHook } from "@beep/repo-ai-metrics/test/claude-cowork-lifecycle"
 *
 * console.log(typeof prepareCoworkLifecycleFixtureHook)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const prepareCoworkLifecycleFixtureHook = prepareCoworkCallback;
export { coworkPeerSource } from "../internal/cowork-peer-source.ts";
export { hashObservationPayload, nativeTraceWire } from "../internal/native-trace-wire.ts";
