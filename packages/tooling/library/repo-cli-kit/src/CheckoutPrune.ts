/**
 * A checkout's own declaration of the paths it removed, replaced or keeps.
 *
 * **Details**
 *
 * A trimmed checkout or downstream fork may carry one optional tracked file,
 * `standards/checkout-prune.jsonc`, naming what it changed relative to the
 * full repository. A prune entry names a path the checkout removed, an owned
 * entry a path it replaced with its own content, and a keep entry carves a
 * path out of a broader prune or owned glob, or out of a product leaf. Each
 * entry's `path` is a repository-relative git `:(glob)` pathspec: `*` and `?`
 * stay inside one segment, `**` (only as a whole segment) crosses segments,
 * and a pattern also matches every path under the directory it names
 * literally. A path is declared pruned when it matches a prune or owned entry
 * and no keep entry.
 *
 * The full repository ships no declaration, so every check that consults one
 * stays as strict as before. A missing file is an empty declaration; a present
 * file that does not parse or decode, an unknown key included, is a
 * {@link CheckoutPruneDeclarationError}, never an empty declaration. A prune
 * entry that matches a live path outside every keep entry is a
 * {@link CheckoutPruneFinding}: a declaration cannot claim a path the checkout
 * still holds.
 *
 * `CheckoutSubject.ts` decides what a declared entry means for a packet, a
 * workspace or a repository path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { $RepoCliKitId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { compileAndExpand } from "@beep/walker/Expand";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GitCommandError, UnknownRefError } from "@beep/git/Git";
import type { GlobExpansionError } from "@beep/walker/Expand";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliKitId.create("CheckoutPrune");

/**
 * Repository-relative path of the optional checkout prune declaration.
 *
 * **Example** (Locate the declaration)
 *
 * ```ts
 * import { CHECKOUT_PRUNE_DECLARATION_PATH } from "@beep/repo-cli-kit/CheckoutPrune"
 *
 * console.log(CHECKOUT_PRUNE_DECLARATION_PATH) // "standards/checkout-prune.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CHECKOUT_PRUNE_DECLARATION_PATH = "standards/checkout-prune.jsonc";

const gitGlobOptions = {
  dot: true,
  nobrace: true,
  noext: true,
  nonegate: true,
  nocomment: true,
} as const;

const GIT_GLOB = GlobPatternOptions.make(gitGlobOptions);

const compileGitGlob = (source: string): Result.Result<GlobPattern, unknown> =>
  GlobPattern.compileResult(source, GIT_GLOB);

const segmentsOf = Str.split("/");

const isCleanSegment = (segment: string): boolean => Str.isNonEmpty(segment) && segment !== "." && segment !== "..";

const isWholeSegmentGlobstar = (segment: string): boolean => !Str.includes("**")(segment) || segment === "**";

const CheckoutPrunePathspecChecks = S.makeFilterGroup(
  [
    S.isNonEmpty(
      $I.annote("CheckoutPrunePathspecNonEmptyCheck", {
        description: "A checkout prune pathspec that is not empty.",
        message: "A checkout prune path must not be empty",
      })
    ),
    S.makeFilter(
      (source: string) => !Str.startsWith("/")(source) && !Str.startsWith(":")(source),
      $I.annote("CheckoutPrunePathspecRelativeCheck", {
        description: "A repository-relative pathspec without a leading slash or pathspec magic.",
        message: "A checkout prune path is repository-relative: no leading / and no :(magic) prefix",
      })
    ),
    S.makeFilter(
      (source: string) => !Str.includes("\\")(source),
      $I.annote("CheckoutPrunePathspecSeparatorCheck", {
        description: "A pathspec that uses forward slashes and no backslash escapes.",
        message: "A checkout prune path uses forward slashes and no backslash",
      })
    ),
    S.makeFilter(
      (source: string) => A.every(segmentsOf(source), isCleanSegment),
      $I.annote("CheckoutPrunePathspecSegmentsCheck", {
        description: "A pathspec whose segments are non-empty and neither . nor .., with no trailing slash.",
        message: "A checkout prune path has no empty, . or .. segment and no trailing slash",
      })
    ),
    S.makeFilter(
      (source: string) => A.every(segmentsOf(source), isWholeSegmentGlobstar),
      $I.annote("CheckoutPrunePathspecGlobstarCheck", {
        description: "A pathspec whose ** appears only as a whole segment, as git's glob magic requires.",
        message: "A checkout prune path uses ** only as a whole segment",
      })
    ),
    S.makeFilter(
      (source: string) => Result.isSuccess(compileGitGlob(source)),
      $I.annote("CheckoutPrunePathspecCompilesCheck", {
        description: "A pathspec that compiles as a glob within the matcher's length and nesting caps.",
        message: "A checkout prune path must compile as a glob",
      })
    ),
  ],
  $I.annote("CheckoutPrunePathspecChecks", {
    description: "Checks for a repository-relative git :(glob) pathspec in a checkout prune declaration.",
  })
);

/**
 * **Details**
 *
 * `*` and `?` match within one path segment, `**` (only as a whole segment)
 * crosses segments, and `[...]` is a character class. Wildcards match dot
 * files, as git's do. The pathspec also matches every path under the
 * directory it names literally, so `goals/demo` covers
 * `goals/demo/README.md`, while `goals/demo-*` matches only paths of that one
 * segment and `goals/demo/**` everything inside `goals/demo` but not
 * `goals/demo` itself.
 *
 * **Example** (Accept and reject pathspecs)
 *
 * ```ts
 * import { CheckoutPrunePathspec } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const isPathspec = S.is(CheckoutPrunePathspec)
 * console.log(isPathspec("packages/demo/**")) // true
 * console.log(isPathspec("/packages/demo")) // false: absolute
 * console.log(isPathspec("packages/demo/")) // false: trailing slash
 * console.log(isPathspec("packages/de**")) // false: ** inside a segment
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckoutPrunePathspec = S.String.check(CheckoutPrunePathspecChecks).pipe(
  S.brand("CheckoutPrunePathspec"),
  $I.annoteSchema("CheckoutPrunePathspec", {
    description: "A repository-relative git :(glob) pathspec naming what a checkout pruned, owns or keeps.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CheckoutPrunePathspec = typeof CheckoutPrunePathspec.Type;

const isLiteralPathspec = (source: string): boolean =>
  O.exists(Result.getSuccess(compileGitGlob(source)), (glob) => !glob.hasMagic);

/**
 * One declared path: what it names, why, and the workspace package it is,
 * when it names one.
 *
 * **Details**
 *
 * An entry with `packageName` declares that workspace, and its `path` is the
 * workspace's last-known directory, which must be a literal path. An entry
 * without one declares the packet whose root its `path` matches, or the
 * repository paths it matches.
 *
 * **Example** (Declare a removed driver and match its files)
 *
 * ```ts
 * import { CheckoutPruneEntry } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const entry = S.decodeUnknownSync(CheckoutPruneEntry)({
 *   path: "packages/drivers/demo",
 *   why: "this checkout does not ship the demo driver",
 *   packageName: "@beep/demo",
 * })
 * console.log(entry.matches("packages/drivers/demo/src/index.ts")) // true
 * console.log(entry.matches("packages/drivers/demo-extra/package.json")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutPruneEntry extends S.Class<CheckoutPruneEntry, { readonly brand: unique symbol }>(
  $I`CheckoutPruneEntry`
)(
  S.Struct({
    path: CheckoutPrunePathspec,
    why: S.NonEmptyString,
    packageName: S.optionalKey(S.NonEmptyString),
  }).check(
    S.makeFilter(
      (entry: { readonly path: string; readonly packageName?: string }) =>
        entry.packageName === undefined || isLiteralPathspec(entry.path),
      $I.annote("CheckoutPruneEntryWorkspaceDirectoryCheck", {
        description: "An entry that names a workspace package gives its last-known directory as a literal path.",
        message: "An entry with packageName names the workspace's directory as a literal path, without wildcards",
      })
    )
  ),
  $I.annote("CheckoutPruneEntry", {
    description:
      "One checkout prune declaration entry: a git :(glob) pathspec, the reason, and the workspace package it names.",
  })
) {
  #glob: GlobPattern | undefined;

  /**
   * Whether this entry's pathspec matches a repository path.
   *
   * **Details**
   *
   * Git's rule: the path equals the pathspec, lies under the directory the
   * pathspec names literally, or matches it as a glob.
   *
   * **Example** (Match a packet glob)
   *
   * ```ts
   * import { CheckoutPruneEntry } from "@beep/repo-cli-kit/CheckoutPrune"
   * import * as S from "effect/Schema"
   *
   * const entry = S.decodeUnknownSync(CheckoutPruneEntry)({ path: "goals/demo-*", why: "demo packets" })
   * console.log(entry.matches("goals/demo-loop")) // true
   * console.log(entry.matches("goals/demo-loop/README.md")) // false: * stays in one segment
   * ```
   *
   * @param repoPath - A repository-relative POSIX path.
   * @returns `true` when the entry covers the path.
   * @category predicates
   * @since 0.0.0
   */
  matches(repoPath: string): boolean {
    if (repoPath === this.path || Str.startsWith(`${this.path}/`)(repoPath)) {
      return true;
    }
    if (this.#glob === undefined) {
      this.#glob = Result.getOrThrow(compileGitGlob(this.path));
    }
    return this.#glob.matches(repoPath);
  }

  /**
   * Whether the entry's pathspec names one literal path, with no wildcard.
   *
   * **Example** (Tell a literal path from a glob)
   *
   * ```ts
   * import { CheckoutPruneEntry } from "@beep/repo-cli-kit/CheckoutPrune"
   * import * as S from "effect/Schema"
   *
   * const literal = S.decodeUnknownSync(CheckoutPruneEntry)({ path: "docs/demo", why: "demo" })
   * const glob = S.decodeUnknownSync(CheckoutPruneEntry)({ path: "docs/demo/*.md", why: "demo" })
   * console.log([literal.isLiteral, glob.isLiteral]) // [true, false]
   * ```
   *
   * @returns `true` when the pathspec has no wildcard.
   * @category getters
   * @since 0.0.0
   */
  get isLiteral(): boolean {
    return isLiteralPathspec(this.path);
  }
}

const Entries = S.Array(CheckoutPruneEntry).pipe(
  S.withConstructorDefault(Effect.succeed(A.empty<CheckoutPruneEntry>())),
  S.withDecodingDefaultKey(Effect.succeed(A.empty<CheckoutPruneEntry>()))
);

/**
 * **Details**
 *
 * `prune` names paths the checkout removed, `owned` paths it replaced with
 * its own content, and `keep` paths carved out of a broader prune or owned
 * glob, or out of a product leaf. A missing list is empty.
 *
 * **Example** (Declare one prune and its carve-out)
 *
 * ```ts
 * import { CheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   prune: [{ path: "docs/demo", why: "the demo docs are not shipped" }],
 *   keep: [{ path: "docs/demo/README.md", why: "kept tooling links to it" }],
 * })
 * console.log([declaration.prune.length, declaration.owned.length]) // [1, 0]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutPruneDeclaration extends S.Opaque<CheckoutPruneDeclaration, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(1),
    prune: Entries,
    keep: Entries,
    owned: Entries,
  }).pipe(
    $I.annoteSchema("CheckoutPruneDeclaration", {
      description:
        "A checkout's prune declaration: the paths it removed (prune), replaced (owned) and carves out of both (keep).",
    })
  )
) {}

/**
 * The declaration of a checkout that ships no declaration file.
 *
 * **Example** (Start from nothing declared)
 *
 * ```ts
 * import { emptyCheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 *
 * console.log(emptyCheckoutPruneDeclaration.prune.length) // 0
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const emptyCheckoutPruneDeclaration: CheckoutPruneDeclaration = CheckoutPruneDeclaration.make({});

/**
 * **Example** (Describe an invalid declaration)
 *
 * ```ts
 * import { CheckoutPruneDeclarationError } from "@beep/repo-cli-kit/CheckoutPrune"
 *
 * const error = CheckoutPruneDeclarationError.make({
 *   path: "standards/checkout-prune.jsonc",
 *   message: "missing version",
 * })
 * console.log(error._tag) // "CheckoutPruneDeclarationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckoutPruneDeclarationError extends S.TaggedError<
  CheckoutPruneDeclarationError,
  { readonly brand: unique symbol }
>($I`CheckoutPruneDeclarationError`)(
  "CheckoutPruneDeclarationError",
  {
    path: S.String,
    message: S.String,
  },
  $I.annoteError<CheckoutPruneDeclarationError>("CheckoutPruneDeclarationError", {
    description: "A present checkout prune declaration that cannot be read, parsed or decoded.",
  })
) {}

/**
 * A prune entry that matches a path the checkout still holds, outside every
 * keep entry.
 *
 * **Details**
 *
 * `live` is the live path the entry matched, or the package name of a
 * discovered workspace an entry's `packageName` names.
 *
 * **Example** (Name a stale prune entry)
 *
 * ```ts
 * import { CheckoutPruneFinding } from "@beep/repo-cli-kit/CheckoutPrune"
 *
 * const finding = CheckoutPruneFinding.make({ path: "docs/demo", live: "docs/demo/guide.md" })
 * console.log(finding.live) // "docs/demo/guide.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckoutPruneFinding extends S.Opaque<CheckoutPruneFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    packageName: S.optionalKey(S.NonEmptyString),
    live: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CheckoutPruneFinding", {
      description: "A prune entry that matches a live path or a discovered workspace outside every keep entry.",
    })
  )
) {}

const renderFinding = (finding: CheckoutPruneFinding): string =>
  finding.packageName === undefined
    ? `prune entry "${finding.path}" matches live path ${finding.live}`
    : `prune entry "${finding.path}" names ${finding.packageName}, a workspace the checkout still holds`;

/**
 * **Example** (Report a stale prune entry)
 *
 * ```ts
 * import { CheckoutPruneFinding, CheckoutPruneFindingsError } from "@beep/repo-cli-kit/CheckoutPrune"
 *
 * const error = CheckoutPruneFindingsError.make({
 *   findings: [CheckoutPruneFinding.make({ path: "docs/demo", live: "docs/demo/guide.md" })],
 * })
 * console.log(error.message.includes("docs/demo/guide.md")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CheckoutPruneFindingsError extends S.TaggedError<
  CheckoutPruneFindingsError,
  { readonly brand: unique symbol }
>($I`CheckoutPruneFindingsError`)(
  "CheckoutPruneFindingsError",
  {
    findings: S.NonEmptyArray(CheckoutPruneFinding),
  },
  $I.annoteError<CheckoutPruneFindingsError>("CheckoutPruneFindingsError", {
    description: "A checkout prune declaration whose prune entries match paths the checkout still holds.",
  })
) {
  /**
   * One line naming every finding.
   *
   * **Example** (Read the finding summary)
   *
   * ```ts
   * import { CheckoutPruneFinding, CheckoutPruneFindingsError } from "@beep/repo-cli-kit/CheckoutPrune"
   *
   * const error = CheckoutPruneFindingsError.make({
   *   findings: [CheckoutPruneFinding.make({ path: "docs/demo", live: "docs/demo/guide.md" })],
   * })
   * console.log(error.message.startsWith("standards/checkout-prune.jsonc")) // true
   * ```
   *
   * @returns The declaration path, then each finding, then the remedy.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `${CHECKOUT_PRUNE_DECLARATION_PATH}: ${A.join(A.map(this.findings, renderFinding), "; ")}; a prune entry may name only what the checkout removed, so remove the path or narrow the entry (an owned or keep entry may match a live path)`;
  }
}

/**
 * Whether a keep entry covers a repository path.
 *
 * **Example** (Carve one file out of a pruned directory)
 *
 * ```ts
 * import { CheckoutPruneDeclaration, isCheckoutPathKept } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   prune: [{ path: "docs/demo", why: "not shipped" }],
 *   keep: [{ path: "docs/demo/README.md", why: "linked from kept docs" }],
 * })
 * console.log(isCheckoutPathKept(declaration, "docs/demo/README.md")) // true
 * console.log(isCheckoutPathKept(declaration, "docs/demo/guide.md")) // false
 * ```
 *
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @param repoPath - A repository-relative POSIX path.
 * @returns `true` when a keep entry matches the path.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutPathKept: {
  (repoPath: string): (declaration: CheckoutPruneDeclaration) => boolean;
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean;
} = dual(2, (declaration: CheckoutPruneDeclaration, repoPath: string): boolean =>
  A.some(declaration.keep, (entry) => entry.matches(repoPath))
);

const declaresPath = (entries: ReadonlyArray<CheckoutPruneEntry>, repoPath: string): boolean =>
  A.some(entries, (entry) => entry.packageName === undefined && entry.matches(repoPath));

/**
 * Whether the declaration prunes a repository path: a prune or owned entry
 * matches it and no keep entry does.
 *
 * **Details**
 *
 * Only entries without `packageName` declare repository paths; an entry that
 * names a workspace package declares that workspace (see
 * `CheckoutSubject.ts`).
 *
 * **Example** (Check a pruned and a kept path)
 *
 * ```ts
 * import { CheckoutPruneDeclaration, isCheckoutPathDeclaredPruned } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   prune: [{ path: "docs/demo", why: "not shipped" }],
 *   keep: [{ path: "docs/demo/README.md", why: "linked from kept docs" }],
 * })
 * console.log(isCheckoutPathDeclaredPruned(declaration, "docs/demo/guide.md")) // true
 * console.log(isCheckoutPathDeclaredPruned(declaration, "docs/demo/README.md")) // false
 * console.log(isCheckoutPathDeclaredPruned(declaration, "docs/other.md")) // false
 * ```
 *
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @param repoPath - A repository-relative POSIX path.
 * @returns `true` when the declaration removes or replaces the path.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutPathDeclaredPruned: {
  (repoPath: string): (declaration: CheckoutPruneDeclaration) => boolean;
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean;
} = dual(
  2,
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean =>
    !isCheckoutPathKept(declaration, repoPath) &&
    (declaresPath(declaration.prune, repoPath) || declaresPath(declaration.owned, repoPath))
);

/**
 * Whether a prune entry declares a repository path: a prune entry matches it
 * and no keep entry does.
 *
 * **Details**
 *
 * The prune half of {@link isCheckoutPathDeclaredPruned}: a path the checkout
 * removed, as opposed to one it owns. Only entries without `packageName`
 * declare repository paths.
 *
 * **Example** (Tell a removed path from an owned one)
 *
 * ```ts
 * import { CheckoutPruneDeclaration, isCheckoutPathPruneDeclared } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   prune: [{ path: "docs/demo", why: "not shipped" }],
 *   owned: [{ path: "renovate.json", why: "own dependency bot" }],
 * })
 * console.log(isCheckoutPathPruneDeclared(declaration, "docs/demo/guide.md")) // true
 * console.log(isCheckoutPathPruneDeclared(declaration, "renovate.json")) // false
 * ```
 *
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @param repoPath - A repository-relative POSIX path.
 * @returns `true` when a prune entry, and no keep entry, matches the path.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutPathPruneDeclared: {
  (repoPath: string): (declaration: CheckoutPruneDeclaration) => boolean;
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean;
} = dual(
  2,
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean =>
    !isCheckoutPathKept(declaration, repoPath) && declaresPath(declaration.prune, repoPath)
);

/**
 * Whether the declaration owns a repository path: an owned entry matches it
 * and no keep entry does.
 *
 * **Details**
 *
 * An owned path is one the checkout replaced with its own content, so
 * upstream checks of it do not apply, whether or not it exists.
 *
 * **Example** (Check an owned path)
 *
 * ```ts
 * import { CheckoutPruneDeclaration, isCheckoutPathOwned } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   owned: [{ path: "renovate.json", why: "this checkout runs its own dependency bot" }],
 * })
 * console.log(isCheckoutPathOwned(declaration, "renovate.json")) // true
 * ```
 *
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @param repoPath - A repository-relative POSIX path.
 * @returns `true` when an owned entry, and no keep entry, matches the path.
 * @category predicates
 * @since 0.0.0
 */
export const isCheckoutPathOwned: {
  (repoPath: string): (declaration: CheckoutPruneDeclaration) => boolean;
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean;
} = dual(
  2,
  (declaration: CheckoutPruneDeclaration, repoPath: string): boolean =>
    !isCheckoutPathKept(declaration, repoPath) && declaresPath(declaration.owned, repoPath)
);

/**
 * The prune entries that name a path or workspace the checkout still holds,
 * outside every keep entry.
 *
 * **Details**
 *
 * `livePaths` are the paths the checkout holds: its files, and the roots of
 * its packets and workspaces. A prune entry with `packageName` is also a
 * finding when workspace discovery finds that package. One finding per
 * entry, naming the first live path in sorted order. Owned and keep entries
 * match live paths by design and are never findings.
 *
 * **Example** (Find a prune entry that names a live file)
 *
 * ```ts
 * import { CheckoutPruneDeclaration, checkoutPruneFindings } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const declaration = S.decodeUnknownSync(CheckoutPruneDeclaration)({
 *   version: 1,
 *   prune: [{ path: "docs/demo", why: "not shipped" }],
 * })
 * const findings = checkoutPruneFindings(declaration, ["docs/demo/guide.md"], HashSet.empty())
 * console.log(findings.map((finding) => finding.live)) // ["docs/demo/guide.md"]
 * ```
 *
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @param livePaths - The repository-relative paths the checkout holds.
 * @param liveWorkspaces - The package names workspace discovery finds.
 * @returns One finding per prune entry that names something live.
 * @category validation
 * @since 0.0.0
 */
export const checkoutPruneFindings: {
  (
    livePaths: Iterable<string>,
    liveWorkspaces: HashSet.HashSet<string>
  ): (declaration: CheckoutPruneDeclaration) => ReadonlyArray<CheckoutPruneFinding>;
  (
    declaration: CheckoutPruneDeclaration,
    livePaths: Iterable<string>,
    liveWorkspaces: HashSet.HashSet<string>
  ): ReadonlyArray<CheckoutPruneFinding>;
} = dual(
  3,
  (
    declaration: CheckoutPruneDeclaration,
    livePaths: Iterable<string>,
    liveWorkspaces: HashSet.HashSet<string>
  ): ReadonlyArray<CheckoutPruneFinding> => {
    const live = A.sort(A.dedupe(A.fromIterable(livePaths)), Order.String);
    return A.filterMap(declaration.prune, (entry) => {
      if (entry.packageName !== undefined && HashSet.has(liveWorkspaces, entry.packageName)) {
        return Result.succeed(
          CheckoutPruneFinding.make({ path: entry.path, packageName: entry.packageName, live: entry.packageName })
        );
      }
      return pipe(
        A.findFirst(live, (candidate) => entry.matches(candidate) && !isCheckoutPathKept(declaration, candidate)),
        O.match({
          onNone: () => Result.failVoid,
          onSome: (candidate) => Result.succeed(CheckoutPruneFinding.make({ path: entry.path, live: candidate })),
        })
      );
    });
  }
);

const decodeDeclarationText = S.decodeEffect(Jsonc.schema(CheckoutPruneDeclaration));

/**
 * Decode the text of a checkout prune declaration.
 *
 * **Details**
 *
 * The text is JSONC, so a comment-free strict-JSON file decodes too. An
 * unknown key, at the top level or in an entry, is an error, so a misspelled
 * list never reads as an empty one.
 *
 * **Example** (Decode a strict-JSON declaration)
 *
 * ```ts
 * import { decodeCheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as Effect from "effect/Effect"
 *
 * const declaration = Effect.runSync(
 *   decodeCheckoutPruneDeclaration('{ "version": 1, "prune": [{ "path": "docs/demo", "why": "not shipped" }] }')
 * )
 * console.log(declaration.prune[0]?.path) // "docs/demo"
 * ```
 *
 * @param text - The declaration file's text.
 * @returns The decoded declaration, or a {@link CheckoutPruneDeclarationError}.
 * @category decoding
 * @since 0.0.0
 */
export const decodeCheckoutPruneDeclaration = (
  text: string
): Effect.Effect<CheckoutPruneDeclaration, CheckoutPruneDeclarationError> =>
  decodeDeclarationText(text, { onExcessProperty: "error" }).pipe(
    Effect.mapError((cause) =>
      CheckoutPruneDeclarationError.make({ path: CHECKOUT_PRUNE_DECLARATION_PATH, message: cause.message })
    )
  );

/**
 * Read a checkout's prune declaration from its working tree.
 *
 * **Details**
 *
 * A checkout without `standards/checkout-prune.jsonc` has the empty
 * declaration. A present file that cannot be read or decoded fails.
 *
 * **Example** (Compose the declaration read)
 *
 * ```ts
 * import { loadCheckoutPruneDeclaration } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(loadCheckoutPruneDeclaration("/repo"))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @returns The checkout's declaration, empty when it ships none.
 * @category utilities
 * @since 0.0.0
 */
export const loadCheckoutPruneDeclaration = Effect.fn("CheckoutPrune.loadCheckoutPruneDeclaration")(function* (
  repoRoot: string
): Effect.fn.Return<CheckoutPruneDeclaration, CheckoutPruneDeclarationError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(repoRoot, CHECKOUT_PRUNE_DECLARATION_PATH);
  const unreadable = (cause: { readonly message: string }) =>
    CheckoutPruneDeclarationError.make({ path: CHECKOUT_PRUNE_DECLARATION_PATH, message: cause.message });
  if (!(yield* fs.exists(file).pipe(Effect.mapError(unreadable)))) {
    return emptyCheckoutPruneDeclaration;
  }
  const text = yield* fs.readFileString(file).pipe(Effect.mapError(unreadable));
  return yield* decodeCheckoutPruneDeclaration(text);
});

const expansionPatterns = (entry: CheckoutPruneEntry): ReadonlyArray<string> =>
  entry.isLiteral ? [entry.path, `${entry.path}/**`] : [entry.path];

const ignoredFiles = Effect.fnUntraced(function* (repoRoot: string, files: ReadonlyArray<string>) {
  if (A.isReadonlyArrayEmpty(files)) {
    return HashSet.empty<string>();
  }
  const git = yield* Git;
  const ignored = yield* git
    .checkIgnore(repoRoot, files)
    .pipe(Effect.catchTag("NotARepositoryError", () => Effect.succeed(A.empty<string>())));
  return HashSet.fromIterable(ignored);
});

/**
 * The files in a checkout's working tree that its prune entries match.
 *
 * **Details**
 *
 * Each prune entry is expanded against the working tree, files only, never
 * following symbolic links or descending into `node_modules` or `.git`. A
 * literal entry names a file or a directory, so everything beneath it is read
 * too; a glob entry matches files only, as git's pathspecs do. A
 * file git ignores is not checkout content, so build output left under a
 * pruned directory is no live file; a tracked file always is. The result
 * feeds {@link checkoutPruneFindings}; a checkout without prune entries reads
 * nothing, and git runs only when a prune entry matches a file on disk.
 *
 * **Example** (Compose the live-file scan)
 *
 * ```ts
 * import { emptyCheckoutPruneDeclaration, liveCheckoutPruneFiles } from "@beep/repo-cli-kit/CheckoutPrune"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(liveCheckoutPruneFiles("/repo", emptyCheckoutPruneDeclaration))) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param declaration - What the checkout says it removed, replaced and keeps.
 * @returns The repository-relative files some prune entry matches that git does not ignore.
 * @category utilities
 * @since 0.0.0
 */
export const liveCheckoutPruneFiles = Effect.fn("CheckoutPrune.liveCheckoutPruneFiles")(function* (
  repoRoot: string,
  declaration: CheckoutPruneDeclaration
): Effect.fn.Return<
  ReadonlyArray<string>,
  GlobExpansionError | GitCommandError | UnknownRefError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const expanded = yield* Effect.forEach(
    A.flatMap(declaration.prune, expansionPatterns),
    (pattern) =>
      compileAndExpand(pattern, {
        cwd: repoRoot,
        glob: gitGlobOptions,
        prune: ["node_modules", ".git"],
        followSymlinks: false,
      }),
    { concurrency: 1 }
  );
  const files = A.dedupe(A.flatten(expanded));
  const ignored = yield* ignoredFiles(repoRoot, files).pipe(Effect.provideServiceEffect(Git, Git.make));
  return A.filter(files, (file) => !HashSet.has(ignored, file));
});
