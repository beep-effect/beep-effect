/**
 * Commits, comparisons and changed files through GitHub's commits API.
 *
 * **Details**
 *
 * Reads one commit, lists commits reachable from a ref, compares two refs and
 * pages every file one commit touched. Commits as Git Database objects (trees,
 * parents for new commits) live in `@beep/github/GitCommit`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import { unstubbedFor } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import { paginate } from "./internal/paginate.ts";
import { Repo } from "./Repo.ts";
import type { PageSource } from "./internal/paginate.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $GithubId.create("GitHubCommit");

/**
 * A commit, projected to what callers read.
 *
 * **Example** (Read a commit subject)
 *
 * ```ts
 * import { CommitSummary } from "@beep/github/GitHubCommit";
 *
 * const commit = CommitSummary.make({
 *   sha: "abc123",
 *   message: "Fix parser\n\nPreserve empty input.",
 *   author: "Ada",
 *   url: "https://github.com/acme/project/commit/abc123",
 *   parents: ["def456"],
 * });
 * console.log(commit.subject); // Fix parser
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitSummary extends S.Class<CommitSummary, { readonly brand: unique symbol }>($I`CommitSummary`)(
  {
    /** The commit sha. */
    sha: S.String.pipe($I.annoteKey("CommitSummary.sha", { description: "The commit sha." })),
    /** The full commit message, untrimmed — this package does not decide what "the message" means. */
    message: S.String.pipe(
      $I.annoteKey("CommitSummary.message", {
        description: 'The full commit message, untrimmed — this package does not decide what "the message" means.',
      })
    ),
    /** The author's name as git recorded it, or `"Unknown"` when GitHub reports none. */
    author: S.String.pipe(
      $I.annoteKey("CommitSummary.author", {
        description: 'The author\'s name as git recorded it, or `"Unknown"` when GitHub reports none.',
      })
    ),
    /** The GitHub login of the authoring account, when GitHub could attribute one. */
    authorLogin: S.optionalKey(S.String).pipe(
      $I.annoteKey("CommitSummary.authorLogin", {
        description: "The GitHub login of the authoring account, when GitHub could attribute one.",
      })
    ),
    /** The web URL for the commit. */
    url: S.String.pipe($I.annoteKey("CommitSummary.url", { description: "The web URL for the commit." })),
    /**
     * The parent commit shas, in the order GitHub lists them.
     *
     * **Details**
     *
     * Empty for a root commit, two or more for a merge commit. A required field,
     * not an optional one: every commit endpoint this package reads reports
     * `parents`, so "which commit(s) did this come from" never needs a raw route.
     */
    parents: S.Array(S.String).pipe(
      $I.annoteKey("CommitSummary.parents", { description: "The parent commit shas, in the order GitHub lists them." })
    ),
  },
  $I.annote("CommitSummary", { description: "A commit, projected to what callers read." })
) {
  /**
   * The message's first line.
   *
   * **Example** (Extract the first message line)
   *
   * ```ts
   * import { CommitSummary } from "@beep/github/GitHubCommit";
   *
   * const commit = CommitSummary.make({
   *   sha: "abc123",
   *   message: "Fix parser\n\nPreserve empty input.",
   *   author: "Ada",
   *   url: "https://github.com/acme/project/commit/abc123",
   *   parents: ["def456"],
   * });
   * console.log(commit.subject); // Fix parser
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get subject(): string {
    return O.match(Str.indexOf("\n")(this.message), {
      onNone: () => this.message,
      onSome: (end) => Str.takeLeft(this.message, end),
    });
  }
}

/**
 * How a file changed in a commit or a comparison.
 *
 * **Example** (Validate a renamed file status)
 *
 * ```ts
 * import { FileStatus } from "@beep/github/GitHubCommit";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(FileStatus)("renamed")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const FileStatus = LiteralKit([
  "added",
  "removed",
  "modified",
  "renamed",
  "copied",
  "changed",
  "unchanged",
]).pipe($I.annoteSchema("FileStatus", { description: "How a file changed in a commit or a comparison." }));

/**
 * The values accepted by {@link FileStatus}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FileStatus = typeof FileStatus.Type;

/**
 * One changed file.
 *
 * **Example** (Inspect the path before a rename)
 *
 * ```ts
 * import { CommitFile } from "@beep/github/GitHubCommit";
 *
 * const file = CommitFile.make({
 *   path: "src/new.ts",
 *   status: "renamed",
 *   additions: 2,
 *   deletions: 1,
 *   previousPath: "src/old.ts",
 * });
 * console.log(file.previousPath); // src/old.ts
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitFile extends S.Opaque<CommitFile, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Repository-relative path, after any rename. */
    path: S.String.pipe(
      $I.annoteKey("CommitFile.path", { description: "Repository-relative path, after any rename." })
    ),
    /** What happened to it. */
    status: FileStatus.pipe($I.annoteKey("CommitFile.status", { description: "What happened to it." })),
    /** Lines added. */
    additions: S.Int.pipe($I.annoteKey("CommitFile.additions", { description: "Lines added." })),
    /** Lines removed. */
    deletions: S.Int.pipe($I.annoteKey("CommitFile.deletions", { description: "Lines removed." })),
    /** The path before a rename or copy. */
    previousPath: S.optionalKey(S.String).pipe(
      $I.annoteKey("CommitFile.previousPath", { description: "The path before a rename or copy." })
    ),
  }).pipe($I.annoteSchema("CommitFile", { description: "One changed file." }))
) {}

/**
 * The result of comparing two refs.
 *
 * **Example** (Inspect commits ahead of base)
 *
 * ```ts
 * import { CommitComparison } from "@beep/github/GitHubCommit";
 *
 * const comparison = CommitComparison.make({
 *   status: "ahead",
 *   aheadBy: 1,
 *   behindBy: 0,
 *   commits: [],
 *   files: [],
 * });
 * console.log(comparison.aheadBy); // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitComparison extends S.Opaque<CommitComparison, { readonly brand: unique symbol }>()(
  S.Struct({
    /** How head relates to base. */
    status: S.Literals(["diverged", "ahead", "behind", "identical"]).pipe(
      $I.annoteKey("CommitComparison.status", { description: "How head relates to base." })
    ),
    /** Commits head has that base does not. */
    aheadBy: S.Int.pipe(
      $I.annoteKey("CommitComparison.aheadBy", { description: "Commits head has that base does not." })
    ),
    /** Commits base has that head does not. */
    behindBy: S.Int.pipe(
      $I.annoteKey("CommitComparison.behindBy", { description: "Commits base has that head does not." })
    ),
    /** The commits in the range. */
    commits: S.Array(CommitSummary).pipe(
      $I.annoteKey("CommitComparison.commits", { description: "The commits in the range." })
    ),
    /** The files that differ, subject to GitHub's own 300-file cap on this endpoint. */
    files: S.Array(CommitFile).pipe(
      $I.annoteKey("CommitComparison.files", {
        description: "The files that differ, subject to GitHub's own 300-file cap on this endpoint.",
      })
    ),
  }).pipe($I.annoteSchema("CommitComparison", { description: "The result of comparing two refs." }))
) {}

/**
 * Read commits, list them, compare two refs and list the files a commit touched.
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export interface GitHubCommitShape {
  /** The files one commit touched, paginated by file. */
  readonly changedFiles: {
    (
      ref: string,
      options?: { readonly page?: PageOptions | undefined }
    ): Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
    (options?: {
      readonly page?: PageOptions | undefined;
    }): (ref: string) => Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
  };
  /**
   * Compare two refs.
   *
   * **Gotchas**
   *
   * GitHub paginates this **by commit**, while the single-commit read paginates
   * **by file** at 300 per page — so a one-commit comparison is permanently
   * truncated at 300 files no matter what you pass. That is GitHub's
   * constraint; use {@link GitHubCommitShape.changedFiles} to page every file
   * of one commit.
   */
  readonly compare: {
    (base: string, head: string): Effect.Effect<CommitComparison, GitHubError, Repo>;
    (head: string): (base: string) => Effect.Effect<CommitComparison, GitHubError, Repo>;
  };
  /** Read one commit by sha or ref. */
  readonly get: (ref: string) => Effect.Effect<CommitSummary, GitHubError, Repo>;
  /** List commits reachable from `ref` (the default branch when omitted), newest first, optionally limited to those touching `path`. */
  readonly list: (options?: {
    readonly ref?: string | undefined;
    readonly path?: string | undefined;
    readonly page?: PageOptions | undefined;
  }) => Effect.Effect<ReadonlyArray<CommitSummary>, GitHubError, Repo>;
}

/**
 * Read commits, compare refs and list changed files through GitHub's commits
 * API.
 *
 * **Details**
 *
 * Provide it with {@link GitHubCommit.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`. For commits as Git Database objects (trees,
 * parents), use `GitCommit` instead.
 *
 * **Example** (List changed file paths between main and feature)
 *
 * ```ts
 * import { GitHubCommit } from "@beep/github/GitHubCommit";
 * import * as Effect from "effect/Effect";
 * import * as A from "effect/Array";
 *
 * const changedSinceMain = Effect.gen(function* () {
 *   const commits = yield* GitHubCommit;
 *   const comparison = yield* commits.compare("main", "feature");
 *   return A.map(comparison.files, (file) => file.path);
 * });
 * console.log(Effect.isEffect(changedSinceMain)); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class GitHubCommit extends Context.Service<GitHubCommit, GitHubCommitShape>()($I`GitHubCommit`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Construct a commit read with the live layer)
   *
   * ```ts
   * import { GitHubCommit } from "@beep/github/GitHubCommit";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.flatMap(GitHubCommit, (commits) => commits.get("main")).pipe(
   *   Effect.provide(GitHubCommit.layer),
   * );
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GitHubCommit, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client))
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Override the commit listing)
   *
   * ```ts
   * import { GitHubCommit } from "@beep/github/GitHubCommit";
   * import * as Effect from "effect/Effect";
   *
   * const commits = GitHubCommit.makeTest({ list: () => Effect.succeed([]) });
   * console.log(Effect.isEffect(commits.list())); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitHubCommitShape> = {}): GitHubCommitShape => ({
    get: overrides.get ?? (() => unstubbed("get")),
    list: overrides.list ?? (() => unstubbed("list")),
    compare: overrides.compare ?? (() => unstubbed("compare")),
    changedFiles: overrides.changedFiles ?? (() => unstubbed("changedFiles")),
  });

  /**
   * {@link GitHubCommit.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a commit test layer)
   *
   * ```ts
   * import { GitHubCommit } from "@beep/github/GitHubCommit";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.map(GitHubCommit, () => "ready").pipe(
   *   Effect.provide(GitHubCommit.layerTest()),
   * );
   * console.log(Effect.runSync(program)); // ready
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitHubCommitShape> = {}): Layer.Layer<GitHubCommit> =>
    Layer.succeed(GitHubCommit, GitHubCommit.makeTest(overrides));
}

const unstubbed = unstubbedFor({ service: "GitHubCommit" });

/**
 * The minimum of a commit payload this projection reads.
 *
 * **Details**
 *
 * `author.login` is **optional**, not required, because GitHub answers with an
 * empty object — typed `Record<string, never>` — for a commit it cannot
 * attribute to an account.
 */
const CommitResponse = S.Struct({
  sha: S.String,
  html_url: S.String,
  commit: S.Struct({
    message: S.String,
    author: S.Struct({ name: S.String.pipe(S.NullOr, S.optionalKey) }).pipe(S.NullOr, S.optionalKey),
  }),
  author: S.Struct({ login: S.optionalKey(S.String) }).pipe(S.NullOr, S.optionalKey),
  parents: S.Array(S.Struct({ sha: S.String })),
}).pipe($I.annoteSchema("CommitResponse", { description: "The selected fields used to summarize a commit response." }));

const summarize: {
  (input: unknown, operation: string): Effect.Effect<CommitSummary, GitHubError>;
  (operation: string): (input: unknown) => Effect.Effect<CommitSummary, GitHubError>;
} = dual(
  2,
  Effect.fn("GitHubCommit.summarize")(function* (input: unknown, operation: string) {
    const raw = yield* S.decodeUnknownEffect(CommitResponse)(input).pipe(
      Effect.mapError((error) => GitHubError.decode(operation, "GitHub returned an unexpected commit", error))
    );
    return CommitSummary.make({
      sha: raw.sha,
      message: raw.commit.message,
      author: raw.commit.author?.name ?? "Unknown",
      ...O.getSomesStruct({ authorLogin: O.fromUndefinedOr(raw.author?.login) }),
      url: raw.html_url,
      parents: A.map(raw.parents, (parent) => parent.sha),
    });
  })
);

/**
 * The minimum of GitHub's `diff-entry` payload the {@link CommitFile}
 * projection reads.
 *
 * **Details**
 *
 * Exported for `PullRequest.listFiles`, whose files endpoint answers with the
 * same wire shape; not re-exported from the package entrypoint.
 *
 * **Example** (Validate a diff entry)
 *
 * ```ts
 * import { RawFile } from "@beep/github/GitHubCommit";
 * import * as S from "effect/Schema";
 *
 * const entry = { filename: "src/parser.ts", status: "modified", additions: 3, deletions: 1 };
 * console.log(S.is(RawFile)(entry)); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RawFile extends S.Opaque<RawFile, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Lines added. */
    additions: S.Finite.pipe($I.annoteKey("RawFile.additions", { description: "Lines added." })),
    /** Lines removed. */
    deletions: S.Finite.pipe($I.annoteKey("RawFile.deletions", { description: "Lines removed." })),
    /** Repository-relative path, after any rename. */
    filename: S.String.pipe(
      $I.annoteKey("RawFile.filename", { description: "Repository-relative path, after any rename." })
    ),
    /** The path before a rename or copy. */
    previous_filename: S.optionalKey(S.String).pipe(
      $I.annoteKey("RawFile.previous_filename", { description: "The path before a rename or copy." })
    ),
    /** GitHub's change status, validated against {@link FileStatus} by the projection. */
    status: S.String.pipe(
      $I.annoteKey("RawFile.status", { description: "GitHub's change status, validated by the projection." })
    ),
  }).pipe($I.annoteSchema("RawFile", { description: "The diff-entry fields the CommitFile projection reads." }))
) {}

/**
 * Companion types for {@link RawFile}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RawFile {
  /**
   * The plain diff-entry shape accepted by {@link fileOf}, so a caller can pass a REST payload.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RawFile.Encoded;
}

const ComparisonResponse = S.Struct({
  status: S.String,
  ahead_by: S.Finite,
  behind_by: S.Finite,
  commits: S.Array(CommitResponse),
  files: S.Array(RawFile).pipe(S.NullOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("ComparisonResponse", {
    description: "The selected comparison fields, including nested commits and diff entries.",
  })
);

/**
 * Project a `diff-entry` to a {@link CommitFile}. Shared with
 * `PullRequest.listFiles`; not re-exported from the package entrypoint.
 *
 * **Example** (Project a GitHub diff entry)
 *
 * ```ts
 * import { fileOf } from "@beep/github/GitHubCommit";
 * import * as Effect from "effect/Effect";
 *
 * const file = Effect.runSync(fileOf({
 *   filename: "src/parser.ts",
 *   status: "modified",
 *   additions: 3,
 *   deletions: 1,
 * }, "example"));
 * console.log(file.path); // src/parser.ts
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const fileOf: {
  (raw: RawFile.Encoded, operation: string): Effect.Effect<CommitFile, GitHubError>;
  (operation: string): (raw: RawFile.Encoded) => Effect.Effect<CommitFile, GitHubError>;
} = dual(
  2,
  Effect.fn("GitHubCommit.fileOf")(function* (raw: RawFile.Encoded, operation: string) {
    return yield* S.decodeUnknownEffect(CommitFile)({
      path: raw.filename,
      status: raw.status,
      additions: raw.additions,
      deletions: raw.deletions,
      ...O.getSomesStruct({ previousPath: O.fromUndefinedOr(raw.previous_filename) }),
    }).pipe(
      Effect.mapError((error) => GitHubError.decode(operation, "GitHub returned an unexpected commit file", error))
    );
  })
);

const make = (client: GitHubClient["Service"]): GitHubCommitShape => ({
  get: Effect.fn("GitHubCommit.get")(function* (ref: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, ref });
    const commit = yield* client.request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref });
    return yield* summarize(commit, "GitHubCommit.get");
  }),

  list: Effect.fn("GitHubCommit.list")(function* (options?: {
    readonly ref?: string | undefined;
    readonly path?: string | undefined;
    readonly page?: PageOptions | undefined;
  }) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, ref: options?.ref ?? "" });
    const commits = yield* client.paginate(
      "GET /repos/{owner}/{repo}/commits",
      {
        owner,
        repo,
        ...O.getSomesStruct({ sha: O.fromUndefinedOr(options?.ref) }),
        ...O.getSomesStruct({ path: O.fromUndefinedOr(options?.path) }),
      },
      options?.page
    );
    return yield* Effect.forEach(commits, summarize("GitHubCommit.list"));
  }),

  compare: dual(
    2,
    Effect.fn("GitHubCommit.compare")(function* (base: string, head: string) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, base, head });
      const comparison = yield* client.request("GET /repos/{owner}/{repo}/compare/{basehead}", {
        owner,
        repo,
        basehead: `${base}...${head}`,
      });
      const selected = yield* S.decodeEffect(ComparisonResponse)(comparison).pipe(
        Effect.mapError((error) =>
          GitHubError.decode("GitHubCommit.compare", "GitHub returned an unexpected commit comparison", error)
        )
      );
      return yield* S.decodeUnknownEffect(CommitComparison)({
        status: selected.status,
        aheadBy: selected.ahead_by,
        behindBy: selected.behind_by,
        commits: yield* Effect.forEach(selected.commits, summarize("GitHubCommit.compare")),
        files: yield* Effect.forEach(selected.files ?? [], fileOf("GitHubCommit.compare")),
      }).pipe(
        Effect.mapError((error) =>
          GitHubError.decode("GitHubCommit.compare", "GitHub returned an unexpected commit comparison", error)
        )
      );
    })
  ),

  changedFiles: dual(
    (args) => P.isString(args[0]),
    Effect.fn("GitHubCommit.changedFiles")(function* (
      ref: string,
      options?: { readonly page?: PageOptions | undefined }
    ) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, ref });
      // This endpoint pages by FILE, not by commit — 300 per page, up to 3000 —
      // so octokit does not list it as a paginating route at all: its payload is
      // a commit object, not an array. The traversal is therefore a custom
      // `PageSource` handed to the SAME engine every other paginated read uses,
      // which is exactly what that seam exists for. There is still one pagination
      // implementation in this package.
      const perPage = options?.page?.perPage ?? 100;
      const source = (): PageSource<CommitFile> => {
        let page = 0;
        let finished = false;
        return {
          next: Effect.suspend(() => {
            if (finished) return Effect.succeedNone;
            page += 1;
            return client
              .request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref, page, per_page: perPage })
              .pipe(
                Effect.flatMap((commit) => {
                  const files = commit.files ?? [];
                  if (files.length < perPage) finished = true;
                  return files.length === 0
                    ? Effect.succeedNone
                    : Effect.asSome(Effect.forEach(files, fileOf("GitHubCommit.changedFiles")));
                })
              );
          }),
        };
      };
      return yield* Stream.runCollect(paginate(source, options?.page?.maxPages));
    })
  ),
});
