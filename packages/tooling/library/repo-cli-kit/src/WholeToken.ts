/**
 * Whole-token text matching for package names, workspace paths and identity
 * accessors.
 *
 * **Details**
 *
 * The delete-package path, its registration-geometry probes and the identity
 * registry rewrite all search source text for one package. A plain substring
 * search lets `@beep/schema` match `@beep/schema-org` and `$SchemaId` match
 * `$SchemaIdentityId`, so this module owns the token rule once. A path has one
 * more collision: a short root path such as `deploy` also ends another
 * workspace's path (`packages/tooling/deploy/x`), so path searches skip the
 * occurrences that a sibling workspace path accounts for.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
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
 * Collect the prefixes under which another workspace's path ends in `repoPath`.
 *
 * **Details**
 *
 * A workspace path that contains `repoPath` as a whole trailing run of
 * segments after a `/` (`packages/tooling/deploy/budget` for `deploy`)
 * contributes the text before that run (`packages/tooling/`). An occurrence of
 * `repoPath` right after such a prefix names the other workspace, not
 * `repoPath`. The target's own path never contributes, and a segment that only
 * starts with the path (`apps/deploy-console`) does not either. The result is
 * deduplicated and sorted.
 *
 * **Example** (Find the prefix of a nested sibling)
 *
 * ```ts
 * import { shadowPrefixesFor } from "@beep/repo-cli-kit/WholeToken"
 *
 * console.log(shadowPrefixesFor("deploy", ["deploy", "packages/tooling/deploy/hosts", "apps/deploy-console"]))
 * // ["packages/tooling/"]
 * ```
 *
 * @internal
 * @param repoPath - Repository-relative path of the package being searched for.
 * @param workspacePaths - Repository-relative paths of every workspace.
 * @returns The sorted, distinct prefixes that turn an occurrence into another workspace's path.
 * @category constructors
 * @since 0.0.0
 */
export const shadowPrefixesFor: {
  (workspacePaths: ReadonlyArray<string>): (repoPath: string) => ReadonlyArray<string>;
  (repoPath: string, workspacePaths: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(2, (repoPath: string, workspacePaths: ReadonlyArray<string>): ReadonlyArray<string> => {
  const pattern = new RegExp(`(?<=/)${Regex.escape(repoPath)}(?=/|$)`, "g");
  return pipe(
    workspacePaths,
    A.filter((workspacePath) => !Str.equivalence(workspacePath, repoPath)),
    A.flatMap((workspacePath) =>
      A.map(A.fromIterable(Str.matchAll(pattern)(workspacePath)), (match) => Str.slice(0, match.index)(workspacePath))
    ),
    A.dedupe,
    A.sort(Order.String)
  );
});

/**
 * Build a predicate that reports whether a text mentions a repository path,
 * skipping occurrences that belong to a shadowing workspace path.
 *
 * **Details**
 *
 * Every occurrence must pass the {@link mentionsToken} rule. An occurrence
 * that directly follows one of `shadowPrefixes` is part of another workspace's
 * path and does not count; the text matches when any other occurrence
 * remains. With no prefixes the predicate equals `mentionsToken(repoPath)`.
 * Derive the prefixes with {@link shadowPrefixesFor}.
 *
 * **Example** (Ignore a nested sibling, keep a root reference)
 *
 * ```ts
 * import { mentionsRepoPath } from "@beep/repo-cli-kit/WholeToken"
 *
 * const mentionsDeploy = mentionsRepoPath("deploy", ["packages/tooling/"])
 * console.log(mentionsDeploy('"directory": "packages/tooling/deploy/hosts"')) // false
 * console.log(mentionsDeploy('"path": "./deploy/src/index.ts"')) // true
 * ```
 *
 * @internal
 * @param repoPath - Repository-relative path of the package being searched for.
 * @param shadowPrefixes - Prefixes from {@link shadowPrefixesFor}.
 * @returns A predicate over the searched text.
 * @category predicates
 * @since 0.0.0
 */
export const mentionsRepoPath: {
  (shadowPrefixes: ReadonlyArray<string>): (repoPath: string) => (text: string) => boolean;
  (repoPath: string, shadowPrefixes: ReadonlyArray<string>): (text: string) => boolean;
} = dual(2, (repoPath: string, shadowPrefixes: ReadonlyArray<string>): ((text: string) => boolean) => {
  const pattern = new RegExp(`(?<![\\w$-])${Regex.escape(repoPath)}(?![\\w$-])`, "g");
  return (text) =>
    A.some(A.fromIterable(Str.matchAll(pattern)(text)), (match) => {
      const before = Str.slice(0, match.index)(text);
      return !A.some(shadowPrefixes, (prefix) => Str.endsWith(prefix)(before));
    });
});

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
