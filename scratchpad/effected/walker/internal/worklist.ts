import { dual } from "effect/Function";

/**
 * Iterate a growing worklist by head index, stopping at a missing frame.
 *
 * **Example** (Visit queued frames)
 *
 * ```ts
 * import { walkFrames } from "@beep/scratchpad/effected/walker/internal/worklist";
 * console.log([...walkFrames(["root", "child"])]) // ["root", "child"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function* walkFrames<T>(frames: ReadonlyArray<T | undefined>): Generator<T> {
  // A head index, never Array.shift(): shift() re-indexes the whole array on
  // every dequeue, turning a large walk quadratic.
  for (let head = 0; head < frames.length; head += 1) {
    const frame = frames[head];
    if (frame === undefined) break;
    yield frame;
  }
}

/**
 * Resolve a frame's parent identity, retaining the empty-chain fallback.
 *
 * **Example** (Resolve an empty ancestor chain)
 *
 * ```ts
 * import { parentRealPath } from "@beep/scratchpad/effected/walker/internal/worklist";
 * console.log(parentRealPath([], "/repo")) // "/repo"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parentRealPath: {
  (absolute: string): (ancestors: ReadonlyArray<string>) => string;
  (ancestors: ReadonlyArray<string>, absolute: string): string;
} = dual(2, (ancestors: ReadonlyArray<string>, absolute: string): string =>
  ancestors[ancestors.length - 1] ?? absolute);
