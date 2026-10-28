/**
 * Shared conservative lexical compatibility for the tree and antecedent policy.
 * @packageDocumentation
 * @since 0.0.0
 */
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
