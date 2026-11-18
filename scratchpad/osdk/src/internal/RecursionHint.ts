/**
 * Arbitrary-only size hint for arrays that sit on a recursive schema cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("osdk/internal/RecursionHint");

/**
 * Caps derived arbitraries of a recursive child array at two elements without constraining decoding.
 *
 * **Details**
 *
 * The predicate always passes, so real documents of any size decode. Only
 * `Arbitrary.schema` reads the constraint, which keeps generated trees finite.
 *
 * **Example** (Bound generation without bounding decoding)
 *
 * ```ts import.meta.vitest name="Bound generation without bounding decoding"
 * import * as S from "effect/Schema"
 * import { RecursiveArraySizeHint } from "@beep/scratchpad/osdk/src/internal/RecursionHint"
 *
 * const Children = S.Array(S.String).check(RecursiveArraySizeHint)
 * const acceptsLongArrays = S.is(Children)(["a", "b", "c", "d"])
 * acceptsLongArrays // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RecursiveArraySizeHint = S.makeFilter<ReadonlyArray<unknown>>(
  () => true,
  $I.annote("RecursiveArraySizeHint", {
    title: "Recursive array size hint",
    description: "Caps derived arbitrary child arrays at two elements without constraining decoded values.",
    arbitraryConstraint: { maxLength: 2 },
  })
);
