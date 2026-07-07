/**
 * Pattern builders and patch helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A, Str } from "@beep/utils";
import { Chunk, Number as Num } from "effect";
import { dual, identity } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { EntityPatternElement, LiteralPatternElement, Pattern, POSPatternElement } from "./Pattern.ts";
import type { MarkRange, NamedEntityType, PatternElement, UniversalPOSTag } from "./Pattern.ts";

type NonEmptyChoices<A> = readonly [A, ...A[]];
type LiteralReplacer = (values: ReadonlyArray<string>, index: number) => PatternElement;
type PatternDual<Arg, Output = Pattern> = {
  (pattern: Pattern, arg: Arg): Output;
  (arg: Arg): (pattern: Pattern) => Output;
};
type MakeDualArgs =
  | readonly [id: string, elements: ReadonlyArray<PatternElement>]
  | readonly [elements: ReadonlyArray<PatternElement>, id: string];

const ensureNonEmpty = <A>(values: ReadonlyArray<A>, fallback: A): NonEmptyChoices<A> => {
  const [head, ...tail] = values;
  return P.isUndefined(head) ? A.of(fallback) : [head, ...tail];
};

const normalizeLiteralValues = (values: ReadonlyArray<string>): NonEmptyChoices<string> => {
  const filtered = A.filter(values, Str.isNonEmpty);
  return ensureNonEmpty(filtered, "");
};

const prependEmptyChoice = <A>(values: ReadonlyArray<A>): readonly [A | "", ...(A | "")[]] => ["", ...values];
const isPosChoiceArray = (
  value: (UniversalPOSTag | "") | ReadonlyArray<UniversalPOSTag | "">
): value is ReadonlyArray<UniversalPOSTag | ""> => A.isArray(value);
const isEntityChoiceArray = (
  value: (NamedEntityType | "") | ReadonlyArray<NamedEntityType | "">
): value is ReadonlyArray<NamedEntityType | ""> => A.isArray(value);
const isLiteralValueArray = (value: string | ReadonlyArray<string>): value is ReadonlyArray<string> => A.isArray(value);
const isRequiredPosChoiceArray = (
  value: UniversalPOSTag | ReadonlyArray<UniversalPOSTag>
): value is ReadonlyArray<UniversalPOSTag> => A.isArray(value);
const isRequiredEntityChoiceArray = (
  value: NamedEntityType | ReadonlyArray<NamedEntityType>
): value is ReadonlyArray<NamedEntityType> => A.isArray(value);

const toElements = (pattern: Pattern): ReadonlyArray<PatternElement> => Chunk.toReadonlyArray(pattern.elements);

const makePattern = (id: string, elements: ReadonlyArray<PatternElement>): Pattern =>
  Pattern.make({
    elements: Chunk.fromIterable(elements),
    id: Pattern.Id(id),
  });

const rebuildPattern = (pattern: Pattern, changes: Partial<Pick<Pattern, "elements" | "id" | "mark">>): Pattern =>
  Pattern.make({
    elements: changes.elements ?? pattern.elements,
    id: changes.id ?? pattern.id,
    mark: changes.mark ?? (P.isUndefined(changes.elements) ? pattern.mark : O.none()),
  });

const getCombineId = (options: { readonly id: string } | string): string =>
  P.isString(options) ? options : options.id;
const isMakeDataFirstArgs = (
  args: MakeDualArgs
): args is readonly [id: string, elements: ReadonlyArray<PatternElement>] => P.isString(args[0]);

/**
 * Create a POS pattern element.
 *
 * @example
 * ```ts
 * import { pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = pos("ADJ", "NOUN")
 * console.log(element.value) // ["ADJ", "NOUN"]
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function pos(first: UniversalPOSTag | "", ...rest: ReadonlyArray<UniversalPOSTag | "">): POSPatternElement;
export function pos(tags: ReadonlyArray<UniversalPOSTag | "">): POSPatternElement;
export function pos(
  firstOrTags: (UniversalPOSTag | "") | ReadonlyArray<UniversalPOSTag | "">,
  ...rest: ReadonlyArray<UniversalPOSTag | "">
): POSPatternElement {
  const tags = isPosChoiceArray(firstOrTags) ? firstOrTags : [firstOrTags, ...rest];
  return POSPatternElement.make({
    value: ensureNonEmpty(tags, ""),
  });
}

/**
 * Create an entity pattern element.
 *
 * @example
 * ```ts
 * import { entity } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = entity("EMAIL", "URL")
 * console.log(element._tag) // "EntityPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function entity(first: NamedEntityType | "", ...rest: ReadonlyArray<NamedEntityType | "">): EntityPatternElement;
export function entity(types: ReadonlyArray<NamedEntityType | "">): EntityPatternElement;
export function entity(
  firstOrTypes: (NamedEntityType | "") | ReadonlyArray<NamedEntityType | "">,
  ...rest: ReadonlyArray<NamedEntityType | "">
): EntityPatternElement {
  const types = isEntityChoiceArray(firstOrTypes) ? firstOrTypes : [firstOrTypes, ...rest];
  return EntityPatternElement.make({
    value: ensureNonEmpty(types, ""),
  });
}

/**
 * Create a literal pattern element.
 *
 * @example
 * ```ts
 * import { literal } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = literal("Effect", "Schema")
 * console.log(element.value[0]) // "Effect"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function literal(first: string, ...rest: ReadonlyArray<string>): LiteralPatternElement;
export function literal(values: ReadonlyArray<string>): LiteralPatternElement;
export function literal(firstOrValues: string | ReadonlyArray<string>, ...rest: ReadonlyArray<string>) {
  const values = isLiteralValueArray(firstOrValues) ? firstOrValues : [firstOrValues, ...rest];
  return LiteralPatternElement.make({
    value: normalizeLiteralValues(values),
  });
}

/**
 * Create an optional POS pattern element.
 *
 * @example
 * ```ts
 * import { optionalPos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = optionalPos("ADJ")
 * console.log(element.value[0]) // ""
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function optionalPos(first: UniversalPOSTag, ...rest: ReadonlyArray<UniversalPOSTag>): POSPatternElement;
export function optionalPos(tags: ReadonlyArray<UniversalPOSTag>): POSPatternElement;
export function optionalPos(
  firstOrTags: UniversalPOSTag | ReadonlyArray<UniversalPOSTag>,
  ...rest: ReadonlyArray<UniversalPOSTag>
): POSPatternElement {
  const tags = isRequiredPosChoiceArray(firstOrTags) ? firstOrTags : [firstOrTags, ...rest];
  return POSPatternElement.make({
    value: prependEmptyChoice(tags),
  });
}

/**
 * Create an optional entity pattern element.
 *
 * @example
 * ```ts
 * import { optionalEntity } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = optionalEntity("EMAIL")
 * console.log(element.value) // ["", "EMAIL"]
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function optionalEntity(first: NamedEntityType, ...rest: ReadonlyArray<NamedEntityType>): EntityPatternElement;
export function optionalEntity(types: ReadonlyArray<NamedEntityType>): EntityPatternElement;
export function optionalEntity(
  firstOrTypes: NamedEntityType | ReadonlyArray<NamedEntityType>,
  ...rest: ReadonlyArray<NamedEntityType>
): EntityPatternElement {
  const types = isRequiredEntityChoiceArray(firstOrTypes) ? firstOrTypes : [firstOrTypes, ...rest];
  return EntityPatternElement.make({
    value: prependEmptyChoice(types),
  });
}

/**
 * Create an optional literal pattern element.
 *
 * @example
 * ```ts
 * import { optionalLiteral } from "@beep/nlp/Core/PatternBuilders"
 *
 * const element = optionalLiteral("Inc.")
 * console.log(element.value) // ["", "Inc."]
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function optionalLiteral(first: string, ...rest: ReadonlyArray<string>): LiteralPatternElement;
export function optionalLiteral(values: ReadonlyArray<string>): LiteralPatternElement;
export function optionalLiteral(
  firstOrValues: string | ReadonlyArray<string>,
  ...rest: ReadonlyArray<string>
): LiteralPatternElement {
  const values = A.filter(
    isLiteralValueArray(firstOrValues) ? firstOrValues : [firstOrValues, ...rest],
    Str.isNonEmpty
  );
  return LiteralPatternElement.make({
    value: prependEmptyChoice(values),
  });
}

/**
 * Construct a pattern from an id and ordered elements.
 *
 * @example
 * ```ts
 * import { literal, make } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("company-suffix", [literal("Inc.")])
 * console.log(pattern.id) // "company-suffix"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const make: {
  (id: string, elements: ReadonlyArray<PatternElement>): Pattern;
  (id: string): (elements: ReadonlyArray<PatternElement>) => Pattern;
} = dual(
  (args) => Num.isGreaterThanOrEqualTo(2)(args.length),
  (...args: MakeDualArgs): Pattern =>
    isMakeDataFirstArgs(args) ? makePattern(args[0], args[1]) : makePattern(args[1], args[0])
);

/**
 * Add a mark range to a pattern.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { hasMark, literal, make, withMark } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("marked-company", [literal("Acme"), literal("Inc.")])
 * const marked = withMark(pattern, [NonNegativeInt.make(0), NonNegativeInt.make(1)])
 * console.log(hasMark(marked)) // true
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const withMark: PatternDual<MarkRange> = dual(
  2,
  (pattern: Pattern, mark: MarkRange): Pattern => rebuildPattern(pattern, { mark: O.some(mark) })
);

/**
 * Remove a mark range from a pattern.
 *
 * @example
 * ```ts
 * import { NonNegativeInt } from "@beep/schema"
 * import { hasMark, literal, make, withMark, withoutMark } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = withMark(make("marked-company", [literal("Acme")]), [
 *   NonNegativeInt.make(0),
 *   NonNegativeInt.make(0)
 * ])
 * console.log(hasMark(withoutMark(pattern))) // false
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const withoutMark: {
  (): (pattern: Pattern) => Pattern;
  (pattern: Pattern): Pattern;
} = dual(
  (args) => Num.isGreaterThanOrEqualTo(1)(args.length),
  (pattern: Pattern): Pattern => rebuildPattern(pattern, { mark: O.none() })
);

/**
 * Append elements to a pattern.
 *
 * @example
 * ```ts
 * import { addElements, elements, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("noun-phrase", [pos("ADJ")])
 * const expanded = addElements(pattern, [literal("portfolio")])
 * console.log(elements(expanded).length) // 2
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const addElements: PatternDual<ReadonlyArray<PatternElement>> = dual(
  2,
  (pattern: Pattern, extraElements: ReadonlyArray<PatternElement>): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.appendAll(pattern.elements, Chunk.fromIterable(extraElements)),
    })
);

/**
 * Prepend elements to a pattern.
 *
 * @example
 * ```ts
 * import { elements, literal, make, pos, prependElements } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("suffix", [literal("Inc.")])
 * const expanded = prependElements(pattern, [pos("PROPN")])
 * console.log(elements(expanded)[0]?._tag) // "POSPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const prependElements: PatternDual<ReadonlyArray<PatternElement>> = dual(
  2,
  (pattern: Pattern, leadingElements: ReadonlyArray<PatternElement>): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.appendAll(Chunk.fromIterable(leadingElements), pattern.elements),
    })
);

/**
 * Replace the pattern id.
 *
 * @example
 * ```ts
 * import { literal, make, withId } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("old-id", [literal("Effect")])
 * console.log(withId(pattern, "new-id").id) // "new-id"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const withId: PatternDual<string> = dual(
  2,
  (pattern: Pattern, id: string): Pattern => rebuildPattern(pattern, { id: Pattern.Id(id) })
);

/**
 * Test whether a pattern has a mark.
 *
 * @example
 * ```ts
 * import { literal, make, hasMark } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("unmarked", [literal("Effect")])
 * console.log(hasMark(pattern)) // false
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const hasMark = (pattern: Pattern): boolean => O.isSome(pattern.mark);

/**
 * Get a pattern's mark if present.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { NonNegativeInt } from "@beep/schema"
 * import { getMark, literal, make, withMark } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = withMark(make("marked", [literal("Effect")]), [
 *   NonNegativeInt.make(0),
 *   NonNegativeInt.make(0)
 * ])
 * console.log(O.getOrThrow(getMark(pattern))[0]) // 0
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const getMark = (pattern: Pattern): O.Option<MarkRange> => pattern.mark;

/**
 * Count pattern elements.
 *
 * @example
 * ```ts
 * import { length, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("two-slots", [pos("ADJ"), literal("brief")])
 * console.log(length(pattern)) // 2
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const length = (pattern: Pattern): number => Chunk.size(pattern.elements);

/**
 * Materialize pattern elements as a readonly array.
 *
 * @example
 * ```ts
 * import { elements, literal, make } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("literal-only", [literal("Effect")])
 * console.log(elements(pattern)[0]?._tag) // "LiteralPatternElement"
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const elements = (pattern: Pattern): ReadonlyArray<PatternElement> => toElements(pattern);

/**
 * Get an element by index.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { elementAt, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * console.log(O.map(elementAt(pattern, 1), (element) => element._tag)) // some("LiteralPatternElement")
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const elementAt: {
  (pattern: Pattern, index: number): O.Option<PatternElement>;
  (index: number): (pattern: Pattern) => O.Option<PatternElement>;
} = dual<
  (index: number) => (pattern: Pattern) => O.Option<PatternElement>,
  (pattern: Pattern, index: number) => O.Option<PatternElement>
>(2, (pattern: Pattern, index: number): O.Option<PatternElement> => Chunk.get(pattern.elements, index));

/**
 * Test whether a pattern is empty.
 *
 * @example
 * ```ts
 * import { isEmpty, make } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("empty-pattern", [])
 * console.log(isEmpty(pattern)) // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isEmpty = (pattern: Pattern): boolean => Chunk.isEmpty(pattern.elements);

/**
 * Get the first pattern element.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { head, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * console.log(O.map(head(pattern), (element) => element._tag)) // some("POSPatternElement")
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const head = elementAt(0);

/**
 * Get the last pattern element.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { last, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * console.log(O.map(last(pattern), (element) => element._tag)) // some("LiteralPatternElement")
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const last = (pattern: Pattern): O.Option<PatternElement> => elementAt(pattern, length(pattern) - 1);

/**
 * Map pattern elements.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { elementAt, literal, make, mapElements } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("company", [literal("Acme")])
 * const mapped = mapElements(pattern, () => literal("Globex"))
 * console.log(O.map(elementAt(mapped, 0), (element) => element.value[0])) // some("Globex")
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const mapElements: PatternDual<(element: PatternElement, index: number) => PatternElement> = dual(
  2,
  (pattern: Pattern, f: (element: PatternElement, index: number) => PatternElement): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.fromIterable(A.map(toElements(pattern), f)),
    })
);

/**
 * Filter pattern elements.
 *
 * @example
 * ```ts
 * import { filterElements, length, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * const literalsOnly = filterElements(pattern, (element) => element._tag === "LiteralPatternElement")
 * console.log(length(literalsOnly)) // 1
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const filterElements: PatternDual<(element: PatternElement, index: number) => boolean> = dual(
  2,
  (pattern: Pattern, predicate: (element: PatternElement, index: number) => boolean): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.fromIterable(A.filter(toElements(pattern), predicate)),
    })
);

/**
 * Take the first `count` elements.
 *
 * @example
 * ```ts
 * import { length, literal, make, pos, take } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * console.log(length(take(pattern, 1))) // 1
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const take: PatternDual<number> = dual(
  2,
  (pattern: Pattern, count: number): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.take(pattern.elements, count),
    })
);

/**
 * Drop the first `count` elements.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { drop, head, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("phrase", [pos("ADJ"), literal("brief")])
 * console.log(O.getOrThrow(head(drop(pattern, 1))).value[0]) // "brief"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const drop: PatternDual<number> = dual(
  2,
  (pattern: Pattern, count: number): Pattern =>
    rebuildPattern(pattern, {
      elements: Chunk.drop(pattern.elements, count),
    })
);

/**
 * Combine two patterns into a new one.
 *
 * @example
 * ```ts
 * import { combine, length, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const left = make("modifier", [pos("ADJ")])
 * const right = make("head", [literal("brief")])
 * console.log(length(combine(left, right, { id: "noun-phrase" }))) // 2
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const combine: {
  (left: Pattern, right: Pattern, options: { readonly id: string }): Pattern;
  (right: Pattern, options: { readonly id: string }): (left: Pattern) => Pattern;
} = dual(
  3,
  (left: Pattern, right: Pattern, options: { readonly id: string }): Pattern =>
    makePattern(getCombineId(options), [...toElements(left), ...toElements(right)])
);

/**
 * Functional patch over a pattern.
 *
 * @example
 * ```ts
 * import type { PatternPatch } from "@beep/nlp/Core/PatternBuilders"
 *
 * type Example = PatternPatch
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type PatternPatch = (pattern: Pattern) => Pattern;

/**
 * Apply a patch to a pattern.
 *
 * @example
 * ```ts
 * import { applyPatch, literal, make, withId } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("draft", [literal("Effect")])
 * const patched = applyPatch(pattern, withId("published"))
 * console.log(patched.id) // "published"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const applyPatch: PatternDual<PatternPatch> = dual(
  2,
  (pattern: Pattern, patch: PatternPatch): Pattern => patch(pattern)
);

/**
 * Compose multiple patches from left to right.
 *
 * @example
 * ```ts
 * import { composePatches, literal, make, withId } from "@beep/nlp/Core/PatternBuilders"
 *
 * const patch = composePatches(withId("first"), withId("second"))
 * console.log(patch(make("draft", [literal("Effect")])).id) // "second"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const composePatches = (...patches: ReadonlyArray<PatternPatch>): PatternPatch =>
  A.reduce(patches, identity satisfies PatternPatch, (acc, patch) => (pattern) => patch(acc(pattern)));

/**
 * Replace a literal element at a given index.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { applyPatch, elementAt, literal, make, patchReplaceLiteralAt } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("company", [literal("Acme"), literal("Inc.")])
 * const patched = applyPatch(pattern, patchReplaceLiteralAt(1, () => literal("LLC")))
 * console.log(O.getOrThrow(elementAt(patched, 1)).value[0]) // "LLC"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const patchReplaceLiteralAt: {
  (index: number, replacer: (values: ReadonlyArray<string>) => PatternElement): PatternPatch;
  (replacer: (values: ReadonlyArray<string>) => PatternElement): (index: number) => PatternPatch;
} = dual<
  (replacer: (values: ReadonlyArray<string>) => PatternElement) => (index: number) => PatternPatch,
  (index: number, replacer: (values: ReadonlyArray<string>) => PatternElement) => PatternPatch
>(
  2,
  (index: number, replacer: (values: ReadonlyArray<string>) => PatternElement): PatternPatch =>
    (pattern) =>
      mapElements(pattern, (element: PatternElement, elementIndex: number) =>
        elementIndex === index && Pattern.Literal.is(element) ? replacer(element.value) : element
      )
);

/**
 * Replace all literal elements.
 *
 * @example
 * ```ts
 * import { applyPatch, elements, literal, make, patchReplaceAllLiterals } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("aliases", [literal("Acme"), literal("Globex")])
 * const patched = applyPatch(pattern, patchReplaceAllLiterals((values) => literal(values[0]?.toLowerCase() ?? "")))
 * console.log(elements(patched)[0]?.value[0]) // "acme"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const patchReplaceAllLiterals =
  (replacer: LiteralReplacer): PatternPatch =>
  (pattern) =>
    mapElements(pattern, (element: PatternElement, index: number) =>
      Pattern.Literal.is(element) ? replacer(element.value, index) : element
    );

const toLiteralReplacer = (replacement: PatternElement | LiteralReplacer): LiteralReplacer =>
  P.isFunction(replacement) ? replacement : () => replacement;

/**
 * Generalize literal elements into other element kinds.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { generalizeLiterals, head, literal, make, pos } from "@beep/nlp/Core/PatternBuilders"
 *
 * const pattern = make("specific", [literal("agreement")])
 * const generalized = generalizeLiterals(pattern, pos("NOUN"))
 * console.log(O.map(head(generalized), (element) => element._tag)) // some("POSPatternElement")
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const generalizeLiterals: {
  (to: PatternElement): (pattern: Pattern) => Pattern;
  (f: LiteralReplacer): (pattern: Pattern) => Pattern;
  (pattern: Pattern, to: PatternElement): Pattern;
  (pattern: Pattern, f: LiteralReplacer): Pattern;
} = dual(
  2,
  (pattern: Pattern, replacement: PatternElement | LiteralReplacer): Pattern =>
    patchReplaceAllLiterals(toLiteralReplacer(replacement))(pattern)
);
