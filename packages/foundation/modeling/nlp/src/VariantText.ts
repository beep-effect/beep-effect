/**
 * Ordered string-variant helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { A, Str } from "@beep/utils";
import { flow, Order } from "effect";
import { dual } from "effect/Function";

const stringEquals: {
  (left: string, right: string): boolean;
  (right: string): (left: string) => boolean;
} = dual(2, (left: string, right: string): boolean => Order.String(left, right) === 0);

/**
 * Remove blank variants and keep the first spelling of each unique string.
 *
 * **Details**
 *
 * Lookup helpers use this after generating increasingly lossy alternatives.
 * Preserving order lets exact or less-normalized spellings win before fallback
 * forms such as basenames or compact identifier spellings.
 *
 * **Example** (Dedupe keeping first occurrence)
 *
 * ```ts import.meta.vitest name="Dedupe keeping first occurrence"
 * import * as VariantText from "@beep/nlp/VariantText"
 *
 * const deduped = VariantText.orderedDedupe(["foo", "bar", "foo", "", "baz"])
 * deduped // => ["foo", "bar", "baz"]
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const orderedDedupe: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  A.filter(Str.isNonEmpty),
  A.dedupeWith(stringEquals)
);
