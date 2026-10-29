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
 * @example
 * ```ts
 * import { isSingleModifiedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isSingleModifiedHead("sensor")("optical sensor")) // true
 * ```
 * @category domain-logic
 * @since 0.0.0
 */
export const isSingleModifiedHead =
  (head: string) =>
  (candidate: string): boolean =>
    Str.endsWith(` ${head}`)(candidate) &&
    !Str.includes(" ")(Str.slice(0, Str.length(candidate) - Str.length(head) - 1)(candidate));

/**
 * Match only an abbreviation explicitly written in an introduction's parentheses.
 * @example
 * ```ts
 * import { isExplicitAbbreviatedHead } from "../../src/values/ClaimElement/ClaimTerm.compatibility.ts"
 * console.log(isExplicitAbbreviatedHead("ir sensor")("infrared (ir) sensor")) // true
 * ```
 * @category domain-logic
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
