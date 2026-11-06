/** Source-only synthetic port for exercising the real kernel/socket boundary.
 * @internal
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { makeCursorLifecycleCore } from "../internal/cursor-lifecycle-core.ts";
import { CursorLifecycleSourceContract } from "../internal/cursor-lifecycle-schemas.ts";
import type { CursorLifecyclePolicy } from "../internal/cursor-lifecycle-schemas.ts";
/**
 * Synthetic source-file enrollment. Never used by the production receiver.
 *
 * **Example** (Inspect the offline fixture factory)
 * ```ts
 * import { makeCursorLifecycleFixtureReceiver } from "@beep/repo-ai-metrics/test/cursor-lifecycle"
 * console.log(typeof makeCursorLifecycleFixtureReceiver)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const makeCursorLifecycleFixtureReceiver = (policy: CursorLifecyclePolicy) =>
  makeCursorLifecycleCore(
    policy,
    CursorLifecycleSourceContract.make({
      pins: A.map(policy.sourcePins, (pin) => ({ suffix: pin.path, sha256: pin.sha256 })),
    })
  );
export { cursorPeerSource } from "../internal/cursor-peer-source.ts";
export { hashObservationPayload, nativeTraceWire } from "../internal/native-trace-wire.ts";
