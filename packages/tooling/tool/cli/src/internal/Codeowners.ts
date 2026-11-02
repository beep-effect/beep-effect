/**
 * CODEOWNERS pattern compilation and last-match owner lookup for the repo CLI.
 *
 * The knowledge-doctor lease binding and the skills patch series each carried a
 * byte-identical copy of the CODEOWNERS glob compiler and line parser. This
 * module owns them once. Each caller keeps its own projection of the winning
 * line's owners: the lease binding reads them as a set, the patch series joins
 * them into one owner string.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Regex from "effect/RegExp";
import * as Str from "effect/String";

const globTokens: Readonly<Record<string, string>> = {
  "**/": "(?:.*/)?",
  "/**": "(?:/.*)?",
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

// Splitting on the wildcard tokens leaves only literal text between them, so `*` and `?` never reach
// `Regex.escape`. Everything it escapes is a syntax character or `/`, both legal escapes under `u`.
const globSource = (glob: string): string =>
  A.join(
    A.map(Str.split(glob, /(\*\*\/|\/\*\*|\*\*|\*|\?)/u), (token) =>
      O.getOrElse(R.get(globTokens, token), () => Regex.escape(token))
    ),
    ""
  );

/**
 * Compile one CODEOWNERS pattern into a whole-path `RegExp`.
 *
 * **Details**
 *
 * gitignore-style matching: a leading or inner slash anchors the pattern to the
 * repository root, a trailing slash matches only below a directory, and a
 * matched directory owns everything under it. `*` and `?` stay within one path
 * segment; `**` crosses segments.
 *
 * **Example** (Anchor a pattern with an inner slash)
 *
 * ```ts
 * import { codeownersPatternToRegExp } from "@beep/repo-cli/test/SharedInternals"
 *
 * const docs = codeownersPatternToRegExp("docs/**")
 * console.log(docs.test("docs/guides/guide.md")) // true
 * console.log(docs.test("packages/docs/guide.md")) // false
 * ```
 *
 * @param pattern - The pattern column of one CODEOWNERS line.
 * @returns A `RegExp` that tests repository-relative paths with forward slashes.
 * @category constructors
 * @since 0.0.0
 */
export const codeownersPatternToRegExp = (pattern: string): RegExp => {
  const directoryOnly = Str.endsWith("/")(pattern);
  const body = Str.replace(/^\/+|\/+$/gu, "")(pattern);
  const anchored = Str.startsWith("/")(pattern) || Str.includes("/")(body);
  const prefix = anchored ? "^" : "^(?:.*/)?";
  const suffix = directoryOnly ? "/.*$" : "(?:/.*)?$";
  return new RegExp(`${prefix}${globSource(body)}${suffix}`, "u");
};

type CodeownersRule = { readonly pattern: RegExp; readonly owners: ReadonlyArray<string> };

const parseCodeownersLine = (line: string): O.Option<CodeownersRule> =>
  pipe(
    O.liftPredicate(Str.trim(Str.replace(/(^|\s)#.*$/u, "")(line)), Str.isNonEmpty),
    O.map(Str.split(/\s+/u)),
    O.flatMap((words) =>
      O.map(A.head(words), (pattern) => ({ pattern: codeownersPatternToRegExp(pattern), owners: A.drop(words, 1) }))
    )
  );

/**
 * Find the owners named by the last CODEOWNERS line that matches a path.
 *
 * **Details**
 *
 * GitHub semantics: the last matching line wins and `#` starts a comment.
 * `None` means no line matches; `Some` of an empty array means the winning
 * line names no owner, which leaves the path deliberately unowned.
 *
 * **Example** (Let the last match win)
 *
 * ```ts
 * import { matchCodeownersOwners } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * const codeowners = "* @kriegcloud\ndocs/ @docs-team @kriegcloud\n"
 *
 * console.log(O.getOrNull(matchCodeownersOwners(codeowners, "docs/README.md"))) // [ "@docs-team", "@kriegcloud" ]
 * ```
 *
 * @param codeowners - The CODEOWNERS file text.
 * @param repoPath - A repository-relative path with forward slashes.
 * @returns The winning line's owners, or `None` when no line matches.
 * @category utilities
 * @since 0.0.0
 */
export const matchCodeownersOwners: {
  (repoPath: string): (codeowners: string) => O.Option<ReadonlyArray<string>>;
  (codeowners: string, repoPath: string): O.Option<ReadonlyArray<string>>;
} = dual(
  2,
  (codeowners: string, repoPath: string): O.Option<ReadonlyArray<string>> =>
    O.map(
      A.findLast(A.getSomes(A.map(Str.split(codeowners, "\n"), parseCodeownersLine)), (rule) =>
        rule.pattern.test(repoPath)
      ),
      (rule) => rule.owners
    )
);
