/**
 * Shared conservative lexical compatibility for the tree and antecedent policy.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

/**
 * Whether an introduction adds exactly one modifier to a referring head.
 *
 * **Example** (Match One Added Modifier)
 * ```ts
 * import { isSingleModifiedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isSingleModifiedHead("sensor")("optical sensor")) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isSingleModifiedHead =
  (head: string) =>
  (candidate: string): boolean =>
    Str.endsWith(` ${head}`)(candidate) &&
    !Str.includes(" ")(Str.slice(0, Str.length(candidate) - Str.length(head) - 1)(candidate));

/**
 * Match only an abbreviation explicitly written in an introduction's parentheses.
 * **Example** (Match an Explicit Abbreviation)
 * ```ts
 * import { isExplicitAbbreviatedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isExplicitAbbreviatedHead("ir sensor")("infrared (ir) sensor")) // true
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isExplicitAbbreviatedHead =
  (head: string) =>
  (candidate: string): boolean => {
    const matched = Str.match(/\(([a-z][a-z0-9-]+)\)([^()]*)$/u)(candidate);
    return O.exists(matched, (parts) =>
      O.exists(
        O.all([A.get(parts, 1), A.get(parts, 2)]),
        ([abbreviation, tail]) => Str.trim(`${abbreviation}${tail}`) === head
      )
    );
  };

const matchesCapturedHead =
  (pattern: RegExp) =>
  (head: string) =>
  (candidate: string): boolean =>
    O.exists(Str.match(pattern)(candidate), (match) => O.contains(A.get(match, 1), head));

/**
 * Match a name whose source supplies a trailing letter-number designator.
 * **Example** (Match a Letter Number Designator)
 * ```ts
 * import { isDesignatedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isDesignatedHead("relaxation time")("relaxation time t2")) // true
 * console.log(isDesignatedHead("sensor")("sensor 12")) // false
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isDesignatedHead = matchesCapturedHead(/^(.+)\s+[a-z]{1,4}\d+[a-z0-9]*$/u);

/**
 * Match an exact plural head under an explicit number-of quantity wrapper.
 *
 * **Example** (Retain the complete source phrase while resolving its contents)
 *
 * ```ts
 * import { isCountedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isCountedHead("packets")("specified number of packets")) // true
 * console.log(isCountedHead("sensor")("number of sensors")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isCountedHead = matchesCapturedHead(/^(?:(?:specified|predetermined|selected|fixed)\s+)?number of (.+)$/u);

/**
 * Match only the exact contents of an explicit plurality reference.
 *
 * **Example** (Preserve a collective reference head)
 * ```ts
 * import { isPluralityReferenceHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isPluralityReferenceHead("plurality of pins")("pins")) // true
 * console.log(isPluralityReferenceHead("plurality of pins")("pin")) // false
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const isPluralityReferenceHead =
  (head: string) =>
  (candidate: string): boolean =>
    O.contains(pluralityReferenceContent(head), candidate);

/**
 * Exact nominal contents of an explicitly named plurality, when present.
 *
 * **Example** (Read collective contents)
 * ```ts
 * import { pluralityReferenceContent } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * import * as O from "effect/Option"
 * console.log(O.getOrElse(pluralityReferenceContent("plurality of pins"), () => "")) // pins
 * ```
 * @category parsers
 * @since 0.0.0
 */
export const pluralityReferenceContent = (head: string): O.Option<string> =>
  O.flatMap(Str.match(/^plurality of (.+)$/u)(head), (match) => A.get(match, 1));

/**
 * Match an explicitly written acronym expansion while retaining a source prefix.
 *
 * @category predicates
 * @since 0.0.0
 */
export const isSourcePrefixAbbreviatedHead =
  (head: string) =>
  (candidate: string): boolean => {
    const matched = Str.match(/\(([a-z][a-z0-9-]+)\)([^()]*)$/u)(candidate);
    return O.exists(matched, (parts) => {
      const abbreviation = O.getOrElse(A.get(parts, 1), () => "");
      const tail = O.getOrElse(A.get(parts, 2), () => "");
      const before = Str.trim(
        Str.slice(
          0,
          O.getOrElse(O.fromUndefinedOr(parts.index), () => 0)
        )(candidate)
      );
      const words = Str.split(before, " ");
      const start = words.length - abbreviation.length;
      return (
        start >= 0 &&
        A.join(
          A.map(A.drop(words, start), (word) => Str.slice(0, 1)(word)),
          ""
        ) === abbreviation &&
        Str.trim(`${A.join(A.take(words, start), " ")} ${abbreviation}${tail}`) === head
      );
    });
  };
