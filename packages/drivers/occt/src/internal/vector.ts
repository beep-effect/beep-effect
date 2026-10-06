/**
 * Private 3-vector arithmetic shared by projection and shading.
 *
 * @internal
 */

import { dual } from "effect/Function";

/**
 * A 3-vector in model coordinates.
 *
 * @internal
 */
export type V3 = readonly [number, number, number];

type Binary<B, R> = {
  (b: B): (a: V3) => R;
  (a: V3, b: B): R;
};

/**
 * Dot product.
 *
 * @internal
 */
export const dot: Binary<V3, number> = dual(2, (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);

/**
 * Cross product.
 *
 * @internal
 */
export const cross: Binary<V3, [number, number, number]> = dual(2, (a: V3, b: V3): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]);

/**
 * Component-wise sum.
 *
 * @internal
 */
export const add: Binary<V3, V3> = dual(2, (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);

/**
 * Scalar multiple.
 *
 * @internal
 */
export const scale: Binary<number, V3> = dual(2, (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]);

/**
 * Unit vector, or the input unchanged when its length is zero.
 *
 * @internal
 */
export const unit = (a: V3): V3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
