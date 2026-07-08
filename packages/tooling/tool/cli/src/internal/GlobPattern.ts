/**
 * Shared glob-to-`RegExp` translation for the repo CLI.
 *
 * The Docgen and Quality analyzers each carried a character-for-character copy
 * of a small glob compiler (`**`/`*` handling plus per-character escaping). This
 * module owns that compiler once.
 *
 * {@link globPatternToRegExp} is the pure compiler and does not normalize its
 * input: the Docgen call sites normalize path separators and a leading `./`
 * before matching, and that normalization stays at the call sites (it is
 * matching-context policy, not part of pattern compilation). One prior copy
 * folded normalization inside the compiler; on adoption that call site
 * normalizes its input before calling.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Str from "effect/String";

/**
 * Escape a single character for safe literal inclusion in a `RegExp` source.
 *
 * @param char - The character to escape.
 * @returns The character with regex metacharacters backslash-escaped.
 * @example
 * ```ts
 * import { escapeRegexChar } from "@beep/repo-cli/internal/GlobPattern"
 *
 * console.log(escapeRegexChar("."))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const escapeRegexChar = (char: string): string => Str.replace(/[.+?^${}()|[\]\\]/g, "\\$&")(char);

/**
 * Compile a glob pattern into an anchored `RegExp`.
 *
 * Supported wildcards: a `**` immediately followed by a slash matches any number
 * of path segments (including none), a bare `**` matches across separators, and
 * `*` matches within a single segment. All other characters match literally. The
 * pattern is anchored at both ends; slash and leading-`./` normalization is the
 * caller's responsibility.
 *
 * @param pattern - The glob pattern to compile.
 * @returns An anchored `RegExp` matching paths against the pattern.
 * @example
 * ```ts
 * import { globPatternToRegExp } from "@beep/repo-cli/internal/GlobPattern"
 *
 * const re = globPatternToRegExp("src/**\/*.ts")
 * console.log(re.test("src/a/b/c.ts"))
 * console.log(re.test("src/a.ts"))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const globPatternToRegExp = (pattern: string): RegExp => {
  let source = "^";
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];
    const next = pattern[index + 1];
    const afterNext = pattern[index + 2];

    if (char === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 3;
      continue;
    }

    if (char === "*" && next === "*") {
      source += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      index += 1;
      continue;
    }

    source += escapeRegexChar(char ?? "");
    index += 1;
  }

  return new RegExp(`${source}$`);
};

/**
 * Test whether a candidate path matches a compiled glob pattern.
 *
 * A convenience over {@link globPatternToRegExp} for the exclude-matching call
 * sites, which test one pattern against several candidate relative paths. As
 * with the compiler, the caller is responsible for normalizing candidates and
 * patterns first.
 *
 * @param pattern - The glob pattern to test against.
 * @returns A predicate over candidate paths.
 * @example
 * ```ts
 * import { globMatches } from "@beep/repo-cli/internal/GlobPattern"
 *
 * const matchesTests = globMatches("**\/*.test.ts")
 * console.log(matchesTests("src/a.test.ts"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const globMatches =
  (pattern: string) =>
  (candidate: string): boolean =>
    globPatternToRegExp(pattern).test(candidate);
