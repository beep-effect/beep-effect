/**
 * Shared FPS sampling state for desktop renderer spikes.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */
import * as P from "@beep/utils/Predicate";
import * as Duration from "effect/Duration";
import { Atom } from "effect/unstable/reactivity";

const FPS_SAMPLE_INTERVAL = Duration.millis(500);
const fpsSampleIntervalMillis = Duration.toMillis(FPS_SAMPLE_INTERVAL);

interface FpsSource {
  readonly fps: () => number;
}

/**
 * Per-renderer FPS samples, throttled so benchmark instrumentation does not
 * force a React render on every animation frame.
 *
 * **Example** (Building FPS sample atoms)
 *
 * ```ts
 * import { fpsSampleAtoms } from "@/spikes/Fps.atoms"
 *
 * const sample = fpsSampleAtoms({ fps: () => 60 })
 * console.log(typeof sample === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const fpsSampleAtoms = Atom.family((source: FpsSource) =>
  Atom.readable((get) => {
    if (!P.isFunction(globalThis.requestAnimationFrame)) return 0;

    const frame = { active: true, id: 0, lastSample: 0 };
    const tick = (time: number): void => {
      if (time - frame.lastSample >= fpsSampleIntervalMillis) {
        frame.lastSample = time;
        get.setSelf(source.fps());
      }
      if (frame.active) {
        frame.id = globalThis.requestAnimationFrame(tick);
      }
    };

    frame.id = globalThis.requestAnimationFrame(tick);
    get.addFinalizer(() => {
      frame.active = false;
      if (P.isFunction(globalThis.cancelAnimationFrame)) {
        globalThis.cancelAnimationFrame(frame.id);
      }
    });
    return 0;
  })
);
