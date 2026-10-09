import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import type { PageSource } from "./internal/paginate.ts";
import { paginate } from "./internal/paginate.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

/**
 * A commit, projected to what callers read.
 *
 * @public
 */
export class CommitSummary extends S.Class<CommitSummary>("CommitSummary")({
	/** The commit sha. */
	sha: S.String,
	/** The full commit message, untrimmed — this package does not decide what "the message" means. */
	message: S.String,
	/** The author's name as git recorded it, or `"Unknown"` when GitHub reports none. */
	author: S.String,
	/** The GitHub login of the authoring account, when GitHub could attribute one. */
	authorLogin: S.optionalKey(S.String),
	/** The web URL for the commit. */
	url: S.String,
	/**
	 * The parent commit shas, in the order GitHub lists them.
	 *
	 * @remarks
	 * Empty for a root commit, two or more for a merge commit. A required field,
	 * not an optional one: every commit endpoint this package reads reports
	 * `parents`, so "which commit(s) did this come from" never needs a raw route.
	 */
	parents: S.Array(S.String),
}) {
	/** The message's first line. */
	get subject(): string {
		return this.message.split("\n", 1)[0] ?? "";
	}
}

/**
 * How a file changed in a commit or a comparison.
 *
 * @public
 */
export const FileStatus = S.Literals([
	"added",
	"removed",
	"modified",
	"renamed",
	"copied",
	"changed",
	"unchanged",
]);

/**
 * One changed file.
 *
 * @public
 */
export class CommitFile extends S.Class<CommitFile>("CommitFile")({
	/** Repository-relative path, after any rename. */
	path: S.String,
	/** What happened to it. */
	status: FileStatus,
	/** Lines added. */
	additions: S.Int,
	/** Lines removed. */
	deletions: S.Int,
	/** The path before a rename or copy. */
	previousPath: S.optionalKey(S.String),
}) {}

/**
 * The result of comparing two refs.
 *
 * @public
 */
export class CommitComparison extends S.Class<CommitComparison>("CommitComparison")({
	/** How head relates to base. */
	status: S.Literals(["diverged", "ahead", "behind", "identical"]),
	/** Commits head has that base does not. */
	aheadBy: S.Int,
	/** Commits base has that head does not. */
	behindBy: S.Int,
	/** The commits in the range. */
	commits: S.Array(CommitSummary),
	/** The files that differ, subject to GitHub's own 300-file cap on this endpoint. */
	files: S.Array(CommitFile),
}) {}

/**
 * Read commits, list them, compare two refs and list the files a commit touched.
 *
 * @public
 */
export interface GitHubCommitShape {
	/** Read one commit by sha or ref. */
	readonly get: (ref: string) => Effect.Effect<CommitSummary, GitHubError, Repo>;
	/** List commits reachable from `ref` (the default branch when omitted), newest first, optionally limited to those touching `path`. */
	readonly list: (options?: {
		readonly ref?: string | undefined;
		readonly path?: string | undefined;
		readonly page?: PageOptions | undefined;
	}) => Effect.Effect<ReadonlyArray<CommitSummary>, GitHubError, Repo>;
	/**
	 * Compare two refs.
	 *
	 * @remarks
	 * GitHub paginates this **by commit**, while the single-commit read paginates
	 * **by file** at 300 per page — so a one-commit comparison is permanently
	 * truncated at 300 files no matter what you pass. That is GitHub's
	 * constraint; use {@link GitHubCommitShape.changedFiles} to page every file
	 * of one commit.
	 */
	readonly compare: (base: string, head: string) => Effect.Effect<CommitComparison, GitHubError, Repo>;
	/** The files one commit touched, paginated by file. */
	readonly changedFiles: (
		ref: string,
		options?: { readonly page?: PageOptions | undefined },
	) => Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
}

/**
 * Read commits, compare refs and list changed files through GitHub's commits
 * API.
 *
 * @remarks
 * Provide it with {@link GitHubCommit.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`. For commits as Git Database objects (trees,
 * parents), use `GitCommit` instead.
 *
 * @example
 * ```ts
 * import { GitHubCommit } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const changedSinceMain = Effect.gen(function* () {
 *   const commits = yield* GitHubCommit;
 *   const comparison = yield* commits.compare("main", "feature");
 *   return comparison.files.map((file) => file.path);
 * });
 * ```
 *
 * @public
 */
export class GitHubCommit extends Context.Service<GitHubCommit, GitHubCommitShape>()("@beep/scratchpad/effected/github/GitHubCommit") {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitHubCommit, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitHubCommitShape> = {}): GitHubCommitShape => ({
		get: overrides.get ?? (() => unstubbed("get")),
		list: overrides.list ?? (() => unstubbed("list")),
		compare: overrides.compare ?? (() => unstubbed("compare")),
		changedFiles: overrides.changedFiles ?? (() => unstubbed("changedFiles")),
	});

	/** {@link GitHubCommit.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitHubCommitShape> = {}): Layer.Layer<GitHubCommit> =>
		Layer.succeed(GitHubCommit, GitHubCommit.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitHubCommit.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/**
 * The minimum of a commit payload this projection reads.
 *
 * @remarks
 * `author.login` is **optional**, not required, because GitHub answers with an
 * empty object — typed `Record<string, never>` — for a commit it cannot
 * attribute to an account.
 */
interface RawCommit {
	readonly sha: string;
	readonly html_url: string;
	readonly commit: { readonly message: string; readonly author?: { readonly name?: string | null } | null };
	readonly author?: { readonly login?: string } | null;
	readonly parents: ReadonlyArray<{ readonly sha: string }>;
}

const summarize = (raw: RawCommit): CommitSummary =>
	CommitSummary.make({
		sha: raw.sha,
		message: raw.commit.message,
		author: raw.commit.author?.name ?? "Unknown",
		...(raw.author?.login !== undefined ? { authorLogin: raw.author.login } : {}),
		url: raw.html_url,
		parents: raw.parents.map((parent) => parent.sha),
	});

/**
 * The minimum of GitHub's `diff-entry` payload the {@link CommitFile}
 * projection reads. Exported for `PullRequest.listFiles`, whose files endpoint
 * answers with the same wire shape; not re-exported from the package
 * entrypoint.
 */
export interface RawFile {
	readonly filename: string;
	readonly status: string;
	readonly additions: number;
	readonly deletions: number;
	readonly previous_filename?: string | undefined;
}

/**
 * Project a `diff-entry` to a {@link CommitFile}. Shared with
 * `PullRequest.listFiles`; not re-exported from the package entrypoint.
 */
export const fileOf = (raw: RawFile): CommitFile =>
	CommitFile.make({
		path: raw.filename,
		status: raw.status as CommitFile["status"],
		additions: raw.additions,
		deletions: raw.deletions,
		...(raw.previous_filename !== undefined ? { previousPath: raw.previous_filename } : {}),
	});

const make = (client: GitHubClient["Service"]): GitHubCommitShape => ({
	get: Effect.fn("GitHubCommit.get")(function* (ref: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, ref });
		const commit = yield* client.request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref });
		return summarize(commit);
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
				...(options?.ref !== undefined ? { sha: options.ref } : {}),
				...(options?.path !== undefined ? { path: options.path } : {}),
			},
			options?.page,
		);
		return commits.map(summarize);
	}),

	compare: Effect.fn("GitHubCommit.compare")(function* (base: string, head: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, base, head });
		const comparison = yield* client.request("GET /repos/{owner}/{repo}/compare/{basehead}", {
			owner,
			repo,
			basehead: `${base}...${head}`,
		});
		return CommitComparison.make({
			status: comparison.status,
			aheadBy: comparison.ahead_by,
			behindBy: comparison.behind_by,
			commits: comparison.commits.map(summarize),
			files: (comparison.files ?? []).map(fileOf),
		});
	}),

	changedFiles: Effect.fn("GitHubCommit.changedFiles")(function* (
		ref: string,
		options?: { readonly page?: PageOptions | undefined },
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
					if (finished) return Effect.succeed(O.none<ReadonlyArray<CommitFile>>());
					page += 1;
					return client
						.request("GET /repos/{owner}/{repo}/commits/{ref}", { owner, repo, ref, page, per_page: perPage })
						.pipe(
							Effect.map((commit) => {
								const files = commit.files ?? [];
								if (files.length < perPage) finished = true;
								return files.length === 0 ? O.none<ReadonlyArray<CommitFile>>() : O.some(files.map(fileOf));
							}),
						);
				}),
			};
		};
		return yield* Stream.runCollect(paginate(source, options?.page?.maxPages));
	}),
});
