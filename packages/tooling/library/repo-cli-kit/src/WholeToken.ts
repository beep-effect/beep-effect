/**
 * Whole-token text matching for package names, workspace paths and identity
 * accessors.
 *
 * **Details**
 *
 * The delete-package path, its registration-geometry probes and the identity
 * registry rewrite all search source text for one package. A plain substring
 * search lets `@beep/schema` match `@beep/schema-org` and `$SchemaId` match
 * `$SchemaIdentityId`, so this module owns the token rule once.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import * as O from "effect/Option";
import * as Regex from "effect/RegExp";

/**
 * Build a predicate that reports whether a text mentions `needle` as a whole token.
 *
 * **Details**
 *
 * The characters directly before and after the needle must not continue an
 * identifier or a package name (`[A-Za-z0-9_$-]`). Dots, slashes, quotes and
 * whitespace end a token, so `$SchemaId.create` and `@beep/schema/sub` match
 * while `$SchemaIdentityId` and `@beep/schema-org` do not. The pattern is built
 * once per needle.
 *
 * **Example** (Reject a prefix-sharing sibling)
 *
 * ```ts
 * import { mentionsToken } from "@beep/repo-cli-kit/WholeToken"
 *
 * const mentionsSchema = mentionsToken("@beep/schema")
 * console.log(mentionsSchema('"@beep/schema": patch')) // true
 * console.log(mentionsSchema('"@beep/schema-org": patch')) // false
 * ```
 *
 * @internal
 * @param needle - Literal package name, path or accessor to find.
 * @returns A predicate over the searched text.
 * @category predicates
 * @since 0.0.0
 */
export const mentionsToken = (needle: string): ((text: string) => boolean) => {
  const pattern = new RegExp(`(?<![\\w$-])${Regex.escape(needle)}(?![\\w$-])`);
  return (text) => O.isSome(Str.match(pattern)(text));
};

/**
 * Build a predicate that reports whether a text mentions any needle as a whole token.
 *
 * **Example** (Match a package by name or path)
 *
 * ```ts
 * import { mentionsAnyToken } from "@beep/repo-cli-kit/WholeToken"
 *
 * const mentionsTarget = mentionsAnyToken(["@beep/x", "packages/x"])
 * console.log(mentionsTarget("see packages/x/src")) // true
 * console.log(mentionsTarget("see packages/x-identity")) // false
 * ```
 *
 * @internal
 * @param needles - Literal package names, paths or accessors to find.
 * @returns A predicate over the searched text.
 * @category predicates
 * @since 0.0.0
 */
export const mentionsAnyToken = (needles: ReadonlyArray<string>): ((text: string) => boolean) => {
  const matchers = A.map(needles, mentionsToken);
  return (text) => A.some(matchers, (matches) => matches(text));
};
