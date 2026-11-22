/**
 * Resolving a selector in one text capture, with ambiguity as its own outcome.
 *
 * **Details**
 *
 * `resolve` never returns the first of several matches: a selector that
 * matches more than once is `Ambiguous` with the count, and callers that need
 * the candidates search for them explicitly. Outcomes are values, never
 * errors.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TextId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { constant, dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { convertPosition, Position } from "./OffsetUnit.ts";
import { Selector } from "./Selector.ts";
import { isUtf16Boundary } from "./TextAnchor.ts";
import type { QuoteSelector, RangeSelector, RefinedSelector } from "./Selector.ts";

const $I = $TextId.create("Resolution");

/**
 * Outcome of resolving a selector in one text capture. `Unique` carries a
 * `utf16-code-unit` position and the text it selects; `Ambiguous` carries how
 * many selections matched and fails closed.
 *
 * **Example** (Match on an outcome)
 *
 * ```ts import.meta.vitest name="Match on an outcome"
 * import { Resolution } from "@beep/text/Resolution"
 *
 * const outcome = Resolution.cases.Ambiguous.make({ count: 3 })
 * Resolution.match(outcome, {
 *   Unique: (unique) => unique.quote,
 *   Ambiguous: (ambiguous) => `${ambiguous.count} matches`,
 *   NotFound: () => "none",
 * }) // => "3 matches"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Resolution = S.TaggedUnion({
  Unique: { position: Position, quote: S.NonEmptyString },
  Ambiguous: { count: S.Int.check(S.isGreaterThanOrEqualTo(2)) },
  NotFound: {},
}).pipe($I.annoteSchema("Resolution", { description: "Unique, Ambiguous or NotFound." }));

/**
 * Type for {@link Resolution}.
 *
 * **Example** (Annotate an outcome)
 *
 * ```ts
 * import { Resolution } from "@beep/text/Resolution"
 *
 * const outcome: Resolution = Resolution.cases.NotFound.make({})
 * console.log(outcome._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Resolution = typeof Resolution.Type;

const notFound: Resolution = Resolution.cases.NotFound.make({});

const ambiguous = (count: number): Resolution => Resolution.cases.Ambiguous.make({ count });

const unique = (sourceText: string, start: number, end: number): Resolution =>
  Resolution.cases.Unique.make({
    position: Position.make({ unit: "utf16-code-unit", start, end }),
    quote: Str.slice(start, end)(sourceText),
  });

// The count of a part of a composite that is not NotFound: a Unique part counts once.
const countOf = (outcome: Resolution): number => (Resolution.guards.Ambiguous(outcome) ? outcome.count : 1);

const shiftBy =
  (offset: number) =>
  (outcome: Resolution): Resolution =>
    Resolution.guards.Unique(outcome)
      ? Resolution.cases.Unique.make({
          position: Position.make({
            unit: "utf16-code-unit",
            start: outcome.position.start + offset,
            end: outcome.position.end + offset,
          }),
          quote: outcome.quote,
        })
      : outcome;

const resolvePosition = (sourceText: string, position: Position): Resolution =>
  Result.match(convertPosition(position, "utf16-code-unit", sourceText), {
    onFailure: () => notFound,
    onSuccess: (utf16) => unique(sourceText, utf16.start, utf16.end),
  });

const getUnsafe = A.getUnsafe;
const emptyText = constant("");

// Performance boundary (KMP scan): one pass over every UTF-16 code unit of the text and of the needle, with native
// string indexing; the same boundary is drawn in `@beep/langextract` `VerifiedSpan.behavior.ts`. The prefix table
// is the one allocation and is not mutated once built.
const prefixTable = (needle: string): ReadonlyArray<number> => {
  const table = [0];
  let matched = 0;
  for (let index = 1; index < needle.length; index++) {
    while (matched > 0 && needle[index] !== needle[matched]) {
      matched = getUnsafe(table, matched - 1);
    }
    if (needle[index] === needle[matched]) {
      matched++;
    }
    table.push(matched);
  }
  return table;
};

// Every start of `exact` whose context matches is one hit, overlapping hits included, so the scan runs over the
// concatenated needle `prefix + exact + suffix` and applies the scalar-boundary test to the `exact` range only.
const resolveQuote = (sourceText: string, quote: QuoteSelector): Resolution => {
  const prefix = O.getOrElse(quote.prefix, emptyText);
  const needle = `${prefix}${quote.exact}${O.getOrElse(quote.suffix, emptyText)}`;
  const table = prefixTable(needle);
  let matched = 0;
  let hits = 0;
  let first = 0;
  for (let index = 0; index < sourceText.length; index++) {
    while (matched > 0 && sourceText[index] !== needle[matched]) {
      matched = getUnsafe(table, matched - 1);
    }
    if (sourceText[index] === needle[matched]) {
      matched++;
    }
    if (matched === needle.length) {
      const start = index + 1 - needle.length + prefix.length;
      if (isUtf16Boundary(sourceText, start) && isUtf16Boundary(sourceText, start + quote.exact.length)) {
        first = hits === 0 ? start : first;
        hits++;
      }
      matched = getUnsafe(table, matched - 1);
    }
  }
  return hits === 0 ? notFound : hits === 1 ? unique(sourceText, first, first + quote.exact.length) : ambiguous(hits);
};

// `by` applies inside the segment `base` selects; a base that is not Unique has no segment, so it is the outcome.
const resolveRefined = (sourceText: string, refined: RefinedSelector): Resolution => {
  const base = resolveSelector(sourceText, refined.base);
  return Resolution.guards.Unique(base) ? shiftBy(base.position.start)(resolveSelector(base.quote, refined.by)) : base;
};

const resolveRange = (sourceText: string, range: RangeSelector): Resolution => {
  const from = resolveSelector(sourceText, range.from);
  const to = resolveSelector(sourceText, range.to);
  if (Resolution.guards.NotFound(from) || Resolution.guards.NotFound(to)) {
    return notFound;
  }
  if (Resolution.guards.Unique(from) && Resolution.guards.Unique(to)) {
    return from.position.start < to.position.start
      ? unique(sourceText, from.position.start, to.position.start)
      : notFound;
  }
  return ambiguous(countOf(from) * countOf(to));
};

const resolveSelector = (sourceText: string, selector: Selector): Resolution =>
  Selector.match(selector, {
    Position: (position) => resolvePosition(sourceText, position),
    Quote: (quote) => resolveQuote(sourceText, quote),
    Fragment: () => notFound,
    Refined: (refined) => resolveRefined(sourceText, refined),
    Range: (range) => resolveRange(sourceText, range),
  });

/**
 * Resolve a selector in one text capture.
 *
 * **Details**
 *
 * - `Position` converts to UTF-16; a refused conversion is `NotFound`.
 * - `Quote` counts every start at a scalar boundary where `exact` matches with
 *   its stated prefix before and suffix after, overlapping matches included,
 *   in one linear scan.
 * - `Fragment` is `NotFound`: no fragment specification is interpreted over
 *   plain text.
 * - `Refined` resolves `by` inside the text `base` selects and shifts it by the
 *   base start; when `base` is not `Unique`, `by` has no segment to apply in
 *   and the outcome is the base's.
 * - `Range` runs from the start of `from` to the start of `to`, exclusive; an
 *   empty or inverted span is `NotFound`.
 * - A `Range` whose part is `NotFound` is `NotFound`; otherwise an `Ambiguous`
 *   part makes it `Ambiguous` with the product of the counts.
 *
 * **Example** (A repeated passage is ambiguous)
 *
 * ```ts import.meta.vitest name="A repeated passage is ambiguous"
 * import { resolve } from "@beep/text/Resolution"
 * import { QuoteSelector } from "@beep/text/Selector"
 * import * as O from "effect/Option"
 *
 * const repeated = QuoteSelector.make({ exact: "1 U.S. 1", prefix: O.none(), suffix: O.none() })
 * resolve("😀 1 U.S. 1; 1 U.S. 1", repeated)._tag // => "Ambiguous"
 * const second = QuoteSelector.make({ exact: "1 U.S. 1", prefix: O.some("; "), suffix: O.none() })
 * resolve("😀 1 U.S. 1; 1 U.S. 1", second)._tag // => "Unique"
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const resolve: {
  (selector: Selector): (sourceText: string) => Resolution;
  (sourceText: string, selector: Selector): Resolution;
} = dual(2, resolveSelector);
