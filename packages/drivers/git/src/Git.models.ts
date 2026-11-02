/**
 * Parsed Git repository models and their pure presentation helpers.
 *
 * **Details**
 *
 * The Git identity scope and service-path re-exports preserve existing schema
 * identifiers and constructor identity. This module has no process dependency.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $GitId.create("Git");

/**
 * One entry of a `git ls-tree` listing.
 *
 * **Example** (Represent a tracked blob)
 *
 * ```ts import.meta.vitest name="Represent a tracked blob"
 * import { LsTreeEntry } from "@beep/git/Git";
 *
 * const entry = LsTreeEntry.make({ mode: "100644", type: "blob", oid: "abc", path: "src/index.ts" });
 * entry.path // => "src/index.ts"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsTreeEntry extends S.Opaque<LsTreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The entry's file mode, e.g. `100644`. */
    mode: S.String.pipe($I.annoteKey("LsTreeEntry.mode", { description: "The entry's file mode, e.g. `100644`." })),
    /** The kind of object the entry points at. */
    type: S.Literals(["blob", "tree", "commit"]).pipe(
      $I.annoteKey("LsTreeEntry.type", { description: "The kind of object the entry points at." })
    ),
    /** The object id the entry points at. */
    oid: S.String.pipe($I.annoteKey("LsTreeEntry.oid", { description: "The object id the entry points at." })),
    /** The entry's path, relative to the tree root. May contain spaces or newlines. */
    path: S.String.pipe(
      $I.annoteKey("LsTreeEntry.path", {
        description: "The entry's path, relative to the tree root. May contain spaces or newlines.",
      })
    ),
  }).pipe($I.annoteSchema("LsTreeEntry", { description: "One entry of a `git ls-tree` listing." }))
) {}

const NameStatusCode = LiteralKit([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "unmerged",
  "unknown",
  "broken",
]).pipe($I.annoteSchema("NameStatusCode", { description: "The decoded change kinds in a name-status listing." }));

/**
 * One entry of a `git diff --name-status` listing.
 *
 * **Gotchas**
 *
 * The `status` vocabulary is this package's own decoded spelling:
 * `"typeChanged"` and `"broken"` — deliberately NOT git porcelain's
 * `"typechange"` word. A consumer mapping these values onto an existing
 * enum that follows porcelain's spelling must translate.
 *
 * **Example** (Represent a renamed path)
 *
 * ```ts import.meta.vitest name="Represent a renamed path"
 * import { NameStatusEntry } from "@beep/git/Git";
 *
 * const entry = NameStatusEntry.make({ status: "renamed", oldPath: "old.ts", path: "new.ts" });
 * [entry.status, entry.oldPath, entry.path] // => ["renamed", "old.ts", "new.ts"]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class NameStatusEntry extends S.Opaque<NameStatusEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The change kind, decoded from git's one-letter status code. `T` decodes
     * to `"typeChanged"` and `B` to `"broken"` — this package's spelling, not
     * porcelain's `"typechange"`.
     */
    status: NameStatusCode.pipe(
      $I.annoteKey("NameStatusEntry.status", {
        description:
          'The change kind, decoded from git\'s one-letter status code. `T` decodes to `"typeChanged"` and `B` to `"broken"` — this package\'s spelling, not porcelain\'s `"typechange"`.',
      })
    ),
    /** The entry's path — for a rename or copy, the NEW path. */
    path: S.String.pipe(
      $I.annoteKey("NameStatusEntry.path", { description: "The entry's path — for a rename or copy, the NEW path." })
    ),
    /** The pre-rename/pre-copy path; present only for renamed/copied entries. */
    oldPath: S.optionalKey(S.String).pipe(
      $I.annoteKey("NameStatusEntry.oldPath", {
        description: "The pre-rename/pre-copy path; present only for renamed/copied entries.",
      })
    ),
  }).pipe($I.annoteSchema("NameStatusEntry", { description: "One entry of a `git diff --name-status` listing." }))
) {}

/**
 * The metadata of a single commit, read via `git log -1` with NUL-separated
 * `%H` / `%G?` / `%B` placeholders.
 *
 * **Example** (Retain a raw commit message)
 *
 * ```ts import.meta.vitest name="Retain a raw commit message"
 * import { CommitInfo } from "@beep/git/Git";
 * import * as Str from "effect/String";
 *
 * const entry = CommitInfo.make({ sha: "abc", signatureStatus: "N", message: "Initial commit\n" });
 * Str.endsWith("\n")(entry.message) // => true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitInfo extends S.Opaque<CommitInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The commit's full object id (`%H`). */
    sha: S.String.pipe($I.annoteKey("CommitInfo.sha", { description: "The commit's full object id (`%H`)." })),
    /** git's `%G?` signature verdict: Good, Bad, Unknown validity, eXpired, expired-key (Y), Revoked, cannot-check (E), None. */
    signatureStatus: S.Literals(["G", "B", "U", "X", "Y", "R", "E", "N"]).pipe(
      $I.annoteKey("CommitInfo.signatureStatus", {
        description:
          "git's `%G?` signature verdict: Good, Bad, Unknown validity, eXpired, expired-key (Y), Revoked, cannot-check (E), None.",
      })
    ),
    /** The raw commit message (`%B`), untrimmed — includes git's trailing format newline. */
    message: S.String.pipe(
      $I.annoteKey("CommitInfo.message", {
        description: "The raw commit message (`%B`), untrimmed — includes git's trailing format newline.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CommitInfo", {
      description:
        "The metadata of a single commit, read via `git log -1` with NUL-separated `%H` / `%G?` / `%B` placeholders.",
    })
  )
) {}

/**
 * One commit of a `git log` listing, with the paths that commit touched.
 *
 * **Gotchas**
 *
 * Both dates are decoded from git's strict-ISO `%aI` / `%cI` into
 * `DateTime.Utc` — the instant, comparable and orderable across commits made
 * in different timezones. **The committer's local UTC offset is not
 * preserved**: git records it, `DateTime.Utc` does not carry it, and encoding
 * a `CommitLogEntry` therefore renders both dates as `Z`-suffixed UTC rather
 * than the offset git printed. Nothing in the kit needs the offset; a consumer
 * that does wants a different member, not a wider entry.
 *
 * `paths` is the commit's `--name-only` listing, **repository-root-relative
 * regardless of the `cwd` the log ran in**, and raw (`-z` disables git's
 * C-style path quoting, so a path containing a space, a quote or a newline
 * arrives verbatim). It is EMPTY for a commit that touched nothing under the
 * requested pathspec — most commonly a merge commit, whose diff git omits by
 * default (see `Git.log`'s `firstParentDiffMerges`).
 *
 * **Example** (Decode a commit timestamp)
 *
 * ```ts import.meta.vitest name="Decode a commit timestamp"
 * import { CommitLogEntry } from "@beep/git/Git";
 * import * as S from "effect/Schema";
 * import * as Effect from "effect/Effect";
 * import * as DateTime from "effect/DateTime";
 *
 * const entry = await Effect.runPromise(S.decodeEffect(CommitLogEntry)({
 *   sha: "abc", authoredAt: "2026-01-01T01:00:00+01:00", committedAt: "2026-01-01T00:00:00Z",
 *   authorName: "Ada", authorEmail: "ada@example.com", paths: ["src/index.ts"],
 * }));
 * DateTime.formatIso(entry.authoredAt) // => "2026-01-01T00:00:00.000Z"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitLogEntry extends S.Opaque<CommitLogEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The commit's full object id (`%H`). */
    sha: S.String.pipe($I.annoteKey("CommitLogEntry.sha", { description: "The commit's full object id (`%H`)." })),
    /** When the change was authored (`%aI`), as a UTC instant. */
    authoredAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("CommitLogEntry.authoredAt", {
        description: "When the change was authored (`%aI`), as a UTC instant.",
      })
    ),
    /** When the commit object was written (`%cI`), as a UTC instant. */
    committedAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("CommitLogEntry.committedAt", {
        description: "When the commit object was written (`%cI`), as a UTC instant.",
      })
    ),
    /** The author's name (`%an`). */
    authorName: S.String.pipe($I.annoteKey("CommitLogEntry.authorName", { description: "The author's name (`%an`)." })),
    /** The author's email address (`%ae`). */
    authorEmail: S.String.pipe(
      $I.annoteKey("CommitLogEntry.authorEmail", { description: "The author's email address (`%ae`)." })
    ),
    /** The paths this commit touched, root-relative and raw; empty when it touched none. */
    paths: S.Array(S.String).pipe(
      $I.annoteKey("CommitLogEntry.paths", {
        description: "The paths this commit touched, root-relative and raw; empty when it touched none.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CommitLogEntry", {
      description: "One commit of a `git log` listing, with the paths that commit touched.",
    })
  )
) {}

/** One two-letter porcelain v1 status axis code. */
const porcelainCode = LiteralKit([" ", "M", "T", "A", "D", "R", "C", "U", "?", "!"]).pipe(
  $I.annoteSchema("PorcelainCode", { description: "One porcelain v1 status axis code." })
);

/**
 * Options for {@link StatusEntry.toLine} / {@link StatusEntry.format}: how a
 * rename/copy entry's path field renders.
 *
 * **Details**
 *
 * The renderers accept the plain {@link StatusRenderOptions.Encoded} shape,
 * so callers pass an object literal such as `{ renames: "arrow" }`.
 *
 * **Example** (Decode render options)
 *
 * ```ts import.meta.vitest name="Decode render options"
 * import * as S from "effect/Schema";
 * import * as Effect from "effect/Effect";
 * import { StatusRenderOptions } from "@beep/git/Git";
 *
 * const options = await Effect.runPromise(S.decodeEffect(StatusRenderOptions)({ renames: "arrow" }));
 * options.renames // => "arrow"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StatusRenderOptions extends S.Opaque<StatusRenderOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    renames: S.optionalKey(S.Literals(["new", "arrow"])).pipe(
      $I.annoteKey("StatusRenderOptions.renames", {
        description:
          '`"new"` (the default) renders only the NEW path — the entry\'s current path, the one that exists on disk. `"arrow"` renders git\'s own non-`-z` porcelain form, `<origPath> -> <path>`. Non-rename entries are unaffected either way.',
      })
    ),
  }).pipe(
    $I.annoteSchema("StatusRenderOptions", {
      description: "How a rename/copy status entry's path field renders.",
    })
  )
) {}

/**
 * Companion namespace for {@link StatusRenderOptions}.
 *
 * **Example** (Type plain render options)
 *
 * ```ts import.meta.vitest name="Type plain render options"
 * import type { StatusRenderOptions } from "@beep/git/Git";
 *
 * const options: StatusRenderOptions.Encoded = { renames: "arrow" };
 * options.renames // => "arrow"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export declare namespace StatusRenderOptions {
  /**
   * The plain options object the status renderers accept.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof StatusRenderOptions.Encoded;
}

/**
 * One entry of a `git status --porcelain -z` listing.
 *
 * **Example** (Render a renamed entry)
 *
 * ```ts import.meta.vitest name="Render a renamed entry"
 * import { StatusEntry } from "@beep/git/Git";
 *
 * const entry = StatusEntry.make({ x: "R", y: " ", origPath: "old.ts", path: "new.ts" });
 * entry.toLine() // => "R  new.ts"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StatusEntry extends S.Class<StatusEntry, { readonly brand: unique symbol }>($I`StatusEntry`)(
  {
    /** The index-side status code (first porcelain column). */
    x: porcelainCode.pipe(
      $I.annoteKey("StatusEntry.x", { description: "The index-side status code (first porcelain column)." })
    ),
    /** The working-tree-side status code (second porcelain column). */
    y: porcelainCode.pipe(
      $I.annoteKey("StatusEntry.y", { description: "The working-tree-side status code (second porcelain column)." })
    ),
    /** The entry's path — for a rename or copy, the NEW path. */
    path: S.String.pipe(
      $I.annoteKey("StatusEntry.path", { description: "The entry's path — for a rename or copy, the NEW path." })
    ),
    /** The original path; present only on rename/copy entries. */
    origPath: S.optionalKey(S.String).pipe(
      $I.annoteKey("StatusEntry.origPath", { description: "The original path; present only on rename/copy entries." })
    ),
  },
  $I.annote("StatusEntry", { description: "One entry of a `git status --porcelain -z` listing." })
) {
  /**
   * Renders this entry back to one porcelain-shaped line: `XY <path>`.
   *
   * **Gotchas**
   *
   * **The rename convention is decided here, once, for every consumer.** By
   * default a rename/copy entry renders its NEW path only — `path` IS the
   * entry's current path, the one a line-oriented downstream can actually
   * open — which is a deliberate divergence from git's own non-`-z`
   * rendering (`orig -> new`). The arrow form is ambiguous to naive
   * line/whitespace splitters (paths may contain spaces, or a literal
   * `" -> "`), so it is opt-in via `renames: "arrow"` for consumers that
   * want git parity.
   *
   * A second recorded divergence: git's non-`-z` porcelain C-quotes paths
   * containing special characters; this renderer emits paths raw. It exists
   * for whitespace-insensitive text consumers — a machine parser should
   * consume the decoded {@link StatusEntry} values (or `-z` output)
   * directly, never re-parse this rendering.
   *
   * **Example** (Choose the arrow rename rendering)
   *
   * ```ts import.meta.vitest name="Choose the arrow rename rendering"
   * import { StatusEntry } from "@beep/git/Git";
   *
   * const entry = StatusEntry.make({ x: "R", y: " ", origPath: "old.ts", path: "new.ts" });
   * entry.toLine({ renames: "arrow" }) // => "R  old.ts -> new.ts"
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  toLine(options?: StatusRenderOptions.Encoded): string {
    const rendered =
      options?.renames === "arrow" && this.origPath !== undefined ? `${this.origPath} -> ${this.path}` : this.path;
    return `${this.x}${this.y} ${rendered}`;
  }

  /**
   * Renders entries back to porcelain-shaped text: one {@link StatusEntry.toLine}
   * line per entry, newline-joined, no trailing newline.
   *
   * **Details**
   *
   * The route back from `Git.status`'s parsed entries to line-oriented text,
   * so a consumer whose downstream contract is porcelain-shaped text does
   * not hand-roll its own renderer (and re-decide the rename convention —
   * see {@link StatusEntry.toLine} for that decision). An empty array
   * renders as the empty string.
   *
   * **Example** (Join status entries without a trailing newline)
   *
   * ```ts import.meta.vitest name="Join status entries without a trailing newline"
   * import { StatusEntry } from "@beep/git/Git";
   *
   * const entries = [StatusEntry.make({ x: "M", y: " ", path: "file.ts" })];
   * StatusEntry.format(entries) // => "M  file.ts"
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  static readonly format: {
    (entries: ReadonlyArray<StatusEntry>, options?: StatusRenderOptions.Encoded): string;
    (options?: StatusRenderOptions.Encoded): (entries: ReadonlyArray<StatusEntry>) => string;
  } = dual(
    (args) => A.isArray(args[0]),
    (entries: ReadonlyArray<StatusEntry>, options?: StatusRenderOptions.Encoded): string =>
      pipe(
        entries,
        A.map((entry) => entry.toLine(options)),
        A.join("\n")
      )
  );
}

/**
 * One line of a `git submodule status` listing.
 *
 * **Details**
 *
 * The `state` decodes git's one-character prefix: `" "` → `"current"` (the
 * checked-out commit matches the index gitlink), `"-"` → `"uninitialized"`,
 * `"+"` → `"outOfSync"` (the checked-out commit differs from the gitlink),
 * `"U"` → `"conflict"` (merge conflicts). `describe` carries the
 * parenthesized `git describe` suffix git appends for initialized
 * submodules.
 *
 * **Example** (Represent an uninitialized submodule)
 *
 * ```ts import.meta.vitest name="Represent an uninitialized submodule"
 * import { SubmoduleStatusEntry } from "@beep/git/Git";
 *
 * const entry = SubmoduleStatusEntry.make({ state: "uninitialized", sha: "abc", path: "vendor/lib" });
 * entry.state // => "uninitialized"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SubmoduleStatusEntry extends S.Opaque<SubmoduleStatusEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The decoded state prefix. */
    state: S.Literals(["current", "uninitialized", "outOfSync", "conflict"]).pipe(
      $I.annoteKey("SubmoduleStatusEntry.state", { description: "The decoded state prefix." })
    ),
    /** The submodule's checked-out (or, uninitialized, gitlink) commit sha. */
    sha: S.String.pipe(
      $I.annoteKey("SubmoduleStatusEntry.sha", {
        description: "The submodule's checked-out (or, uninitialized, gitlink) commit sha.",
      })
    ),
    /** The submodule's path relative to the superproject root. */
    path: S.String.pipe(
      $I.annoteKey("SubmoduleStatusEntry.path", {
        description: "The submodule's path relative to the superproject root.",
      })
    ),
    /** The `git describe` suffix, present only for initialized submodules. */
    describe: S.optionalKey(S.String).pipe(
      $I.annoteKey("SubmoduleStatusEntry.describe", {
        description: "The `git describe` suffix, present only for initialized submodules.",
      })
    ),
  }).pipe($I.annoteSchema("SubmoduleStatusEntry", { description: "One line of a `git submodule status` listing." }))
) {}

/**
 * One ref a remote advertises, from `git ls-remote`.
 *
 * **Details**
 *
 * `ref` is the FULL refname as advertised (`refs/heads/main`,
 * `refs/tags/v1`), including the `^{}` suffix on an annotated tag's peeled
 * entry — an annotated tag appears twice, once as the tag object and once
 * peeled to its commit.
 *
 * **Example** (Read an advertised tag name)
 *
 * ```ts import.meta.vitest name="Read an advertised tag name"
 * import { LsRemoteEntry } from "@beep/git/Git";
 *
 * const entry = LsRemoteEntry.make({ sha: "abc", ref: "refs/tags/v1^{}" });
 * LsRemoteEntry.shortName(entry.ref) // => "v1"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsRemoteEntry extends S.Opaque<LsRemoteEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The sha the advertised ref points at. */
    sha: S.String.pipe($I.annoteKey("LsRemoteEntry.sha", { description: "The sha the advertised ref points at." })),
    /** The full advertised refname, `^{}` peel suffix included. */
    ref: S.String.pipe(
      $I.annoteKey("LsRemoteEntry.ref", { description: "The full advertised refname, `^{}` peel suffix included." })
    ),
  }).pipe($I.annoteSchema("LsRemoteEntry", { description: "One ref a remote advertises, from `git ls-remote`." }))
) {
  /**
   * The human-facing short name of an advertised refname: the
   * `refs/heads/` / `refs/tags/` / `refs/remotes/` prefix and any `^{}`
   * peel suffix stripped (`refs/tags/v1^{}` → `v1`).
   *
   * **Example** (Strip the peeled tag suffix)
   *
   * ```ts import.meta.vitest name="Strip the peeled tag suffix"
   * import { LsRemoteEntry } from "@beep/git/Git";
   *
   * LsRemoteEntry.shortName("refs/tags/v1^{}") // => "v1"
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  static readonly shortName = (ref: string): string => {
    const base = Str.endsWith("^{}")(ref) ? Str.slice(0, -3)(ref) : ref;
    for (const prefix of ["refs/heads/", "refs/tags/", "refs/remotes/"]) {
      if (Str.startsWith(prefix)(base)) {
        return Str.slice(prefix.length)(base);
      }
    }
    return base;
  };

  /**
   * The entries whose short name is a NEAR MISS for `ref`: not an exact
   * match, but ending in `ref` right behind a separator (`@`, `/`, `-`,
   * `_`) — the monorepo-prefixed-tag case, where a caller asks for
   * `4.0.0` and the remote advertises `effect@4.0.0`.
   *
   * **Details**
   *
   * A pure, decode-side helper for validate-before-mutate flows: run
   * `lsRemote`, look for the wanted ref, and when it is absent hand the
   * listing to this to compute a suggestion. Deliberately a helper on the
   * ENTRY value rather than behavior baked into the service — the service
   * returns the full listing and the caller owns the matching policy. An
   * annotated tag's peeled `^{}` entry shares its base short name, so a
   * near miss on such a tag can surface both of its entries.
   *
   * **Example** (Suggest a package-prefixed tag)
   *
   * ```ts import.meta.vitest name="Suggest a package-prefixed tag"
   * import { LsRemoteEntry } from "@beep/git/Git";
   *
   * const entries = [LsRemoteEntry.make({ sha: "abc", ref: "refs/tags/effect@4.0.0" })];
   * LsRemoteEntry.nearMatches(entries, "4.0.0")[0]?.ref // => "refs/tags/effect@4.0.0"
   * ```
   *
   * @category filtering
   * @since 0.0.0
   */
  static readonly nearMatches: {
    (entries: ReadonlyArray<LsRemoteEntry>, ref: string): ReadonlyArray<LsRemoteEntry>;
    (ref: string): (entries: ReadonlyArray<LsRemoteEntry>) => ReadonlyArray<LsRemoteEntry>;
  } = dual(2, (entries: ReadonlyArray<LsRemoteEntry>, ref: string): ReadonlyArray<LsRemoteEntry> => {
    const separators = ["@", "/", "-", "_"];
    return A.filter(entries, (entry) => {
      const short = LsRemoteEntry.shortName(entry.ref);
      if (short === ref || !Str.endsWith(ref)(short)) {
        return false;
      }
      return separators.includes(Str.slice(short.length - ref.length - 1, short.length - ref.length)(short));
    });
  });
}

/**
 * One stash entry, from `git stash list`.
 *
 * **Example** (Represent a stash selector)
 *
 * ```ts import.meta.vitest name="Represent a stash selector"
 * import { StashEntry } from "@beep/git/Git";
 *
 * const entry = StashEntry.make({ ref: "stash@{0}", sha: "abc", message: "On main: save work" });
 * entry.ref // => "stash@{0}"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StashEntry extends S.Opaque<StashEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The reflog selector (`stash@{0}`) — the index other stash methods take. */
    ref: S.String.pipe(
      $I.annoteKey("StashEntry.ref", {
        description: "The reflog selector (`stash@{0}`) — the index other stash methods take.",
      })
    ),
    /** The stash commit's sha. */
    sha: S.String.pipe($I.annoteKey("StashEntry.sha", { description: "The stash commit's sha." })),
    /** The reflog subject: `WIP on <branch>: ...` or `On <branch>: <message>`. */
    message: S.String.pipe(
      $I.annoteKey("StashEntry.message", {
        description: "The reflog subject: `WIP on <branch>: ...` or `On <branch>: <message>`.",
      })
    ),
  }).pipe($I.annoteSchema("StashEntry", { description: "One stash entry, from `git stash list`." }))
) {}

/**
 * One local (or remote-tracking) branch, from `git branch --list`.
 *
 * **Example** (Represent the current branch)
 *
 * ```ts import.meta.vitest name="Represent the current branch"
 * import { BranchEntry } from "@beep/git/Git";
 *
 * const entry = BranchEntry.make({ name: "main", sha: "abc", current: true });
 * [entry.name, entry.current] // => ["main", true]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class BranchEntry extends S.Opaque<BranchEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The short branch name (`main`, or `origin/main` for a remote branch). */
    name: S.String.pipe(
      $I.annoteKey("BranchEntry.name", {
        description: "The short branch name (`main`, or `origin/main` for a remote branch).",
      })
    ),
    /** The branch tip's sha. */
    sha: S.String.pipe($I.annoteKey("BranchEntry.sha", { description: "The branch tip's sha." })),
    /** Whether this branch is checked out in the current working tree. */
    current: S.Boolean.pipe(
      $I.annoteKey("BranchEntry.current", {
        description: "Whether this branch is checked out in the current working tree.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BranchEntry", { description: "One local (or remote-tracking) branch, from `git branch --list`." })
  )
) {}

/**
 * One ref, from `git for-each-ref`.
 *
 * **Example** (Represent an annotated tag object)
 *
 * ```ts import.meta.vitest name="Represent an annotated tag object"
 * import { RefEntry } from "@beep/git/Git";
 *
 * const entry = RefEntry.make({ ref: "refs/tags/v1", sha: "abc", objectType: "tag" });
 * entry.objectType // => "tag"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RefEntry extends S.Opaque<RefEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The full refname (`refs/tags/v1`). */
    ref: S.String.pipe($I.annoteKey("RefEntry.ref", { description: "The full refname (`refs/tags/v1`)." })),
    /** The sha of the object the ref points at. */
    sha: S.String.pipe($I.annoteKey("RefEntry.sha", { description: "The sha of the object the ref points at." })),
    /**
     * The pointed-at object's type. An annotated tag is `tag` (the tag
     * object itself, not its target commit).
     */
    objectType: S.Literals(["commit", "tag", "tree", "blob"]).pipe(
      $I.annoteKey("RefEntry.objectType", {
        description:
          "The pointed-at object's type. An annotated tag is `tag` (the tag object itself, not its target commit).",
      })
    ),
  }).pipe($I.annoteSchema("RefEntry", { description: "One ref, from `git for-each-ref`." }))
) {}

/**
 * One configuration entry, from `git config --list`.
 *
 * **Example** (Represent a valueless config key)
 *
 * ```ts import.meta.vitest name="Represent a valueless config key"
 * import { ConfigListEntry } from "@beep/git/Git";
 *
 * const entry = ConfigListEntry.make({ key: "core.bare", value: "" });
 * entry.value === "" // => true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ConfigListEntry extends S.Opaque<ConfigListEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The canonical dotted key (`section.subsection.key`). */
    key: S.String.pipe(
      $I.annoteKey("ConfigListEntry.key", { description: "The canonical dotted key (`section.subsection.key`)." })
    ),
    /**
     * The raw value. A valueless key (git's boolean-true shorthand,
     * `[section]` + bare `key`) surfaces as the empty string — distinguish it
     * with `configGetAll` if the difference matters.
     */
    value: S.String.pipe(
      $I.annoteKey("ConfigListEntry.value", {
        description:
          "The raw value. A valueless key (git's boolean-true shorthand, `[section]` + bare `key`) surfaces as the empty string — distinguish it with `configGetAll` if the difference matters.",
      })
    ),
  }).pipe($I.annoteSchema("ConfigListEntry", { description: "One configuration entry, from `git config --list`." }))
) {}

/**
 * One working tree, from `git worktree list --porcelain`.
 *
 * **Example** (Represent a detached worktree)
 *
 * ```ts import.meta.vitest name="Represent a detached worktree"
 * import { WorktreeEntry } from "@beep/git/Git";
 *
 * const entry = WorktreeEntry.make({ path: "/repo", head: "abc", detached: true, bare: false });
 * entry.detached // => true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorktreeEntry extends S.Opaque<WorktreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The working tree's absolute path. */
    path: S.String.pipe($I.annoteKey("WorktreeEntry.path", { description: "The working tree's absolute path." })),
    /** The checked-out commit sha; absent for a bare repository entry. */
    head: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.head", {
        description: "The checked-out commit sha; absent for a bare repository entry.",
      })
    ),
    /** The checked-out branch's full refname; absent when detached or bare. */
    branch: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.branch", {
        description: "The checked-out branch's full refname; absent when detached or bare.",
      })
    ),
    /** Whether the working tree is in detached-HEAD state. */
    detached: S.Boolean.pipe(
      $I.annoteKey("WorktreeEntry.detached", { description: "Whether the working tree is in detached-HEAD state." })
    ),
    /** Whether the entry is the bare repository itself. */
    bare: S.Boolean.pipe(
      $I.annoteKey("WorktreeEntry.bare", { description: "Whether the entry is the bare repository itself." })
    ),
    /** Present when the worktree is locked; holds the lock reason (possibly empty). */
    locked: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.locked", {
        description: "Present when the worktree is locked; holds the lock reason (possibly empty).",
      })
    ),
    /** Present when the worktree is prunable; holds the reason (possibly empty). */
    prunable: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.prunable", {
        description: "Present when the worktree is prunable; holds the reason (possibly empty).",
      })
    ),
  }).pipe($I.annoteSchema("WorktreeEntry", { description: "One working tree, from `git worktree list --porcelain`." }))
) {}

/**
 * One index (staging area) entry, from `git ls-files --stage`.
 *
 * **Details**
 *
 * The index-side sibling of {@link LsTreeEntry}: this is the ONLY place a
 * staged-but-uncommitted gitlink (`mode` `160000`) is visible — `lsTree`
 * reads the committed tree and misses exactly that window.
 *
 * **Example** (Represent an unresolved index stage)
 *
 * ```ts import.meta.vitest name="Represent an unresolved index stage"
 * import { LsFilesEntry } from "@beep/git/Git";
 *
 * const entry = LsFilesEntry.make({ mode: "100644", oid: "abc", stage: 2, path: "file.ts" });
 * entry.stage // => 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsFilesEntry extends S.Opaque<LsFilesEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The entry's file mode, e.g. `100644` — `160000` for a gitlink. */
    mode: S.String.pipe(
      $I.annoteKey("LsFilesEntry.mode", {
        description: "The entry's file mode, e.g. `100644` — `160000` for a gitlink.",
      })
    ),
    /** The staged object id. */
    oid: S.String.pipe($I.annoteKey("LsFilesEntry.oid", { description: "The staged object id." })),
    /** The merge stage: `0` normally; `1`/`2`/`3` during an unresolved merge. */
    stage: S.Finite.pipe(
      $I.annoteKey("LsFilesEntry.stage", {
        description: "The merge stage: `0` normally; `1`/`2`/`3` during an unresolved merge.",
      })
    ),
    /** The entry's path, relative to `cwd`. May contain spaces or newlines. */
    path: S.String.pipe(
      $I.annoteKey("LsFilesEntry.path", {
        description: "The entry's path, relative to `cwd`. May contain spaces or newlines.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LsFilesEntry", { description: "One index (staging area) entry, from `git ls-files --stage`." })
  )
) {}
