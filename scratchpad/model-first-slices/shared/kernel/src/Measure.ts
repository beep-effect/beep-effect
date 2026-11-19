import * as S from "effect/Schema";
import * as Str from "effect/String";

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
 * The text of an id: it starts with a letter or a digit and holds letters,
 * digits, and `_`, `.`, `:`, `~` and `-`. It is never empty and never holds
 * a `/`, so an id can be a segment of a stream id or a storage path as it is.
 *
 * **Example** (A run's continuation id)
 * ```ts
 * import { IdText } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(IdText)("run_1~1");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IdText = S.String.check(
  S.isPattern(/^[A-Za-z0-9][A-Za-z0-9_.:~-]*$/, {
    identifier: "IdTextCheck",
    title: "Id text",
    description: "An id: a letter or digit, then letters, digits, `_`, `.`, `:`, `~` or `-`.",
    message: "Expected an id of letters, digits, `_`, `.`, `:`, `~` and `-` that starts with a letter or digit",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type IdText = typeof IdText.Type;

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

/**
 * The id of one aggregate's stream: the aggregate's {@link Name}, a `/`, and
 * the record's {@link IdText}. It is what an event's envelope carries and
 * what a record-scoped grant names.
 *
 * **Example** (A claim's stream)
 * ```ts
 * import { StreamId } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(StreamId)("Claim/claim_1");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StreamId = S.String.check(
  S.isPattern(/^[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9][A-Za-z0-9_.:~-]*$/, {
    identifier: "StreamIdCheck",
    title: "Stream id",
    description: "A stream id: an aggregate name, `/`, and a record id.",
    message: "Expected a stream id of the form `Aggregate/id`",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type StreamId = typeof StreamId.Type;

/**
 * Text a person or a model wrote: a purpose, a reason, a rationale, a quote.
 * Any content is allowed, as long as it stores and travels unchanged: it is
 * well-formed Unicode (no half of a surrogate pair) and holds no NUL, which
 * neither JSON over UTF-8 nor a Postgres `text` column keeps.
 *
 * **Example** (A reason)
 * ```ts
 * import { Text } from "@proto/kernel/Measure";
 * import * as S from "effect/Schema";
 *
 * const valid = S.is(Text)("Duplicate of claim 7; see the intake note.");
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Text = S.String.check(
  S.makeFilter((text) => text.isWellFormed() && !Str.includes("\u0000")(text), {
    identifier: "TextCheck",
    title: "Text",
    description: "Well-formed Unicode text with no NUL character.",
    message: "Expected well-formed text with no NUL character",
  }),
);
/**
 * @category models
 * @since 0.0.0
 */
export type Text = typeof Text.Type;
