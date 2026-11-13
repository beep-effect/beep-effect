/**
 * The mulberry32 generator behind seeded node ids: a reproducible, non-secret
 * sequence of unsigned 32-bit integers.
 *
 * @internal
 */

import type { LazyArg } from "effect/Function";

/**
 * A mulberry32 sequence from `seed`: each call returns the next unsigned
 * 32-bit integer. Each sequence has its own state.
 *
 * **Example** (Draw from two sequences with one seed)
 *
 * ```ts
 * import { mulberry32 } from "@beep/agent-memory-store/internal/Mulberry32"
 *
 * const first = mulberry32(7)
 * const second = mulberry32(7)
 * console.log(first() === second()) // true
 * ```
 *
 * @param seed - The generator seed.
 * @returns The next value of the sequence on each call.
 * @category utilities
 * @since 0.0.0
 */
export const mulberry32 = (seed: number): LazyArg<number> => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
};
