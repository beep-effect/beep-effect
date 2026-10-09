import { A } from "@beep/utils";
import { flow } from "effect/Function";
import * as O from "effect/Option";

/**
 * Return the first present Option from a list of candidates.
 *
 * @since 0.0.0
 * @category utilities
 */
export const firstSome: <A>(options: ReadonlyArray<O.Option<A>>) => O.Option<A> = flow(
  A.findFirst(O.isSome),
  O.flatten
);

/**
 * Convert an Option into a readonly array of length 0 or 1.
 *
 * @since 0.0.0
 * @category utilities
 */
export const optionToReadonlyArray = <A>(option: O.Option<A>): ReadonlyArray<A> =>
  O.match(option, {
    onNone: A.empty,
    onSome: A.of,
  });
