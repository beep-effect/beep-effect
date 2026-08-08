/**
 * Shared order helpers for NLP ranking and sorting.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { Order } from "effect";

/**
 * Build a descending numeric order from a projection.
 *
 * **Example** (Descending order by score)
 *
 * ```ts
 * import { descendingNumber } from "./order"
 *
 * const byScore = descendingNumber((value: { readonly score: number }) => value.score)
 * console.log(byScore)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const descendingNumber = <A>(f: (value: A) => number): Order.Order<A> =>
  Order.mapInput(Order.Number, (value: A) => -f(value));

/**
 * Build an ascending numeric order from a projection.
 *
 * **Example** (Ascending order by index)
 *
 * ```ts
 * import { ascendingNumber } from "./order"
 *
 * const byIndex = ascendingNumber((value: { readonly index: number }) => value.index)
 * console.log(byIndex)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ascendingNumber = <A>(f: (value: A) => number): Order.Order<A> => Order.mapInput(Order.Number, f);

/**
 * Build an ascending string order from a projection.
 *
 * **Example** (Ascending order by name)
 *
 * ```ts
 * import { ascendingString } from "./order"
 *
 * const byName = ascendingString((value: { readonly name: string }) => value.name)
 * console.log(byName)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ascendingString = <A>(f: (value: A) => string): Order.Order<A> => Order.mapInput(Order.String, f);
