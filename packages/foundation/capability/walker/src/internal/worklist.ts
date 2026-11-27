/**
 * The head-index worklist the downward walk iterates, and its parent real-path lookup.
 *
 * **Details**
 *
 * The descent is a worklist, not a recursion, so it cannot overflow the
 * stack; it is dequeued by head index, never `Array.shift()`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";

/**
 * Iterate a growing worklist by head index, stopping at a missing frame.
 *
 * **Details**
 *
 * `Array.shift()` re-indexes the whole array on every dequeue, so a
 * shift-based queue would make a large walk quadratic.
 *
 * **Example** (Visit queued frames)
 *
 * ```ts
 * import { walkFrames } from "@beep/walker/internal/worklist";
 * console.log([...walkFrames(["root", "child"])]) // ["root", "child"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function* walkFrames<T>(frames: ReadonlyArray<T | undefined>): Generator<T> {
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
 * import { parentRealPath } from "@beep/walker/internal/worklist";
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
  O.getOrElse(A.last(ancestors), () => absolute)
);
