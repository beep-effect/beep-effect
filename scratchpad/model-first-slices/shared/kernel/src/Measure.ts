import * as S from "effect/Schema";

/**
 * A count: a whole number that is never negative. A generation, a version,
 * a sequence number, a number of pending items.
 *
 * **Example** (A generated count is a valid count)
 * ```ts
 * import { Count } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(Count)(0);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Count = S.Int.check(
  S.isGreaterThanOrEqualTo(0, { identifier: "CountCheck", title: "Count", description: "A whole number that is zero or more." }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type Count = typeof Count.Type;

/**
 * A sequence number: a position in a log, counted from 1. Zero is not one; a
 * record of what was taken in reads 0 when nothing was.
 *
 * **Example** (The first position of a log)
 * ```ts
 * import { Sequence } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(Sequence)(1);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Sequence = S.Int.check(
  S.isGreaterThanOrEqualTo(1, { identifier: "SequenceCheck", title: "Sequence", description: "A whole number that is one or more." }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type Sequence = typeof Sequence.Type;

/**
 * A declared name: of a model, a view, a projection, an event or a stream.
 * It starts with a letter and holds letters and digits only, so it can be
 * part of a storage path or a target id without escaping.
 *
 * **Example** (A model name)
 * ```ts
 * import { Name } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(Name)("ClaimFacts");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Name = S.String.check(
  S.isPattern(/^[A-Za-z][A-Za-z0-9]*$/, {
    identifier: "NameCheck",
    title: "Name",
    description: "A declared name: a letter, then letters and digits.",
    message: "Expected a name that starts with a letter and holds only letters and digits",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type Name = typeof Name.Type;
