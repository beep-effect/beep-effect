import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github/GitCommit");

/**
 * A blob's file mode, as the Git Database API spells it.
 *
 * @public
 */
export const FileMode = S.Literals(["100644", "100755", "120000"]).pipe($I.annoteSchema("FileMode", { description: "A blob's file mode, as the Git Database API spells it." }));

/**
 * A file to write in a commit.
 *
 * @public
 */
export class FileContent extends S.TaggedClass<FileContent>($I`FileContent`)("FileContent", {
	/** Repository-relative path. */
	path: S.NonEmptyString.annotateKey({ description: "Repository-relative path." }),
	/** The file's new contents. */
	content: S.String.annotateKey({ description: "The file's new contents." }),
	/** Defaults to a regular file. */
	mode: S.optionalKey(FileMode).annotateKey({ description: "Defaults to a regular file." }),
}, $I.annote("FileContent", { description: "A file to write in a commit." })) {}

/**
 * A file to remove in a commit.
 *
 * @public
 */
export class FileDeletion extends S.TaggedClass<FileDeletion>($I`FileDeletion`)("FileDeletion", {
	/** Repository-relative path. */
	path: S.NonEmptyString.annotateKey({ description: "Repository-relative path." }),
}, $I.annote("FileDeletion", { description: "A file to remove in a commit." })) {}

/**
 * One change in a commit.
 *
 * @public
 */
export const FileChange = S.Union([FileContent, FileDeletion]).pipe($I.annoteSchema("FileChange", { description: "One change in a commit." }));

/** One change in a commit. @public */
export type FileChange = FileContent | FileDeletion;

/**
 * A commit, projected to the three fields callers actually use.
 *
 * @remarks
 * `treeSha` is here because the Git Data API's `base_tree` wants a tree SHA,
 * not a commit SHA.
 *
 * @public
 */
export class CommitRef extends S.Class<CommitRef>($I`CommitRef`)({
	/** The commit's own sha. */
	sha: S.String.annotateKey({ description: "The commit's own sha." }),
	/** The tree the commit points at — what `baseTree` wants. */
	treeSha: S.String.annotateKey({ description: "The tree the commit points at — what `baseTree` wants." }),
	/** Parent commit shas, in order. */
	parents: S.Array(S.String).annotateKey({ description: "Parent commit shas, in order." }),
}, $I.annote("CommitRef", { description: "A commit, projected to the three fields callers actually use." })) {}

/**
 * Commits and trees in GitHub's Git Database API.
 *
 * @public
 */
export interface GitCommitShape {
	/** Read a commit's sha, tree and parents. */
	readonly get: (sha: string) => Effect.Effect<CommitRef, GitHubError, Repo>;
	/** Build a tree, optionally on top of an existing one. */
	readonly createTree: (options: {
		readonly changes: ReadonlyArray<FileChange>;
		readonly baseTree?: string | undefined;
	}) => Effect.Effect<string, GitHubError, Repo>;
	/** Create a commit object. */
	readonly createCommit: (options: {
		readonly message: string;
		readonly tree: string;
		readonly parents: ReadonlyArray<string>;
	}) => Effect.Effect<string, GitHubError, Repo>;
	/**
	 * Write `changes` onto `branch` as one commit, returning its sha.
	 *
	 * @remarks
	 * The four-call sequence — read the branch, build a tree on its commit's
	 * tree, create the commit, move the ref — as one operation. The ref update is
	 * **not** forced: a branch that moved underneath you is a conflict worth
	 * hearing about, not one to overwrite.
	 *
	 * **This is "commit onto a branch you own", not a rebase.** Putting a commit
	 * on top of *another* branch's head — the release-branch pattern — is a
	 * different operation, and it composes from the members above with no
	 * observable intermediate state: {@link GitCommitShape.get} the target head
	 * for its `treeSha`, {@link GitCommitShape.createTree} on it,
	 * {@link GitCommitShape.createCommit} with the target as parent, then one
	 * `GitBranch.upsert` straight to the finished commit. Do **not** spell a
	 * rebase as `upsert(branch, targetHead)` followed by `commitFiles`: between
	 * those calls the branch *is* the target head, an open pull request from it
	 * has an empty diff, and GitHub auto-closes PRs in that state.
	 */
	readonly commitFiles: (options: {
		readonly branch: string;
		readonly message: string;
		readonly changes: ReadonlyArray<FileChange>;
	}) => Effect.Effect<string, GitHubError, Repo>;
}

/**
 * Read commits and build trees and commits through GitHub's Git Database API,
 * including a one-call "commit these files onto a branch".
 *
 * @remarks
 * Provide it with {@link GitCommit.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`. No local git runs: this is the REST API,
 * not `@effected/git`.
 *
 * @example
 * ```ts
 * import { FileContent, GitCommit } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const writeNotes = Effect.gen(function* () {
 *   const commits = yield* GitCommit;
 *   return yield* commits.commitFiles({
 *     branch: "docs/notes",
 *     message: "docs: add notes",
 *     changes: [FileContent.make({ path: "NOTES.md", content: "# Notes\n" })],
 *   }); // the new commit's sha
 * });
 * ```
 *
 * @public
 */
export class GitCommit extends Context.Service<GitCommit, GitCommitShape>()($I`GitCommit`) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitCommit, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitCommitShape> = {}): GitCommitShape => ({
		get: overrides.get ?? (() => unstubbed("get")),
		createTree: overrides.createTree ?? (() => unstubbed("createTree")),
		createCommit: overrides.createCommit ?? (() => unstubbed("createCommit")),
		commitFiles: overrides.commitFiles ?? (() => unstubbed("commitFiles")),
	});

	/** {@link GitCommit.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitCommitShape> = {}): Layer.Layer<GitCommit> =>
		Layer.succeed(GitCommit, GitCommit.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitCommit.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/** The Git Database tree entry for one change. */
const treeEntry = (change: FileChange) =>
	change._tag === "FileContent"
		? { path: change.path, mode: change.mode ?? ("100644" as const), type: "blob" as const, content: change.content }
		: // A null sha is how the Git Database API spells "remove this path".
			{ path: change.path, mode: "100644" as const, type: "blob" as const, sha: null };

const make = (client: GitHubClient["Service"]): GitCommitShape => {
	const get = Effect.fn("GitCommit.get")(function* (sha: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, sha });
		const commit = yield* client.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", {
			owner,
			repo,
			commit_sha: sha,
		});
		return CommitRef.make({
			sha: commit.sha,
			treeSha: commit.tree.sha,
			parents: commit.parents.map((parent) => parent.sha),
		});
	});

	const createTree = Effect.fn("GitCommit.createTree")(function* (options: {
		readonly changes: ReadonlyArray<FileChange>;
		readonly baseTree?: string | undefined;
	}) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, changes: options.changes.length });
		const tree = yield* client.request("POST /repos/{owner}/{repo}/git/trees", {
			owner,
			repo,
			tree: options.changes.map(treeEntry),
			...O.getSomesStruct({ base_tree: O.fromUndefinedOr(options.baseTree) }),
		});
		return tree.sha;
	});

	const createCommit = Effect.fn("GitCommit.createCommit")(function* (options: {
		readonly message: string;
		readonly tree: string;
		readonly parents: ReadonlyArray<string>;
	}) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, tree: options.tree });
		const commit = yield* client.request("POST /repos/{owner}/{repo}/git/commits", {
			owner,
			repo,
			message: options.message,
			tree: options.tree,
			parents: [...options.parents],
		});
		return commit.sha;
	});

	return {
		get,
		createTree,
		createCommit,
		commitFiles: Effect.fn("GitCommit.commitFiles")(function* (options: {
			readonly branch: string;
			readonly message: string;
			readonly changes: ReadonlyArray<FileChange>;
		}) {
			const { owner, repo } = yield* Repo;
			const short = options.branch.replace(/^refs\/heads\//, "").replace(/^heads\//, "");
			yield* Effect.annotateCurrentSpan({ owner, repo, branch: short, changes: options.changes.length });
			const ref = yield* client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
				owner,
				repo,
				ref: `heads/${short}`,
			});
			const head = yield* get(ref.object.sha);
			const tree = yield* createTree({ changes: options.changes, baseTree: head.treeSha });
			const commit = yield* createCommit({ message: options.message, tree, parents: [head.sha] });
			yield* client.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
				owner,
				repo,
				ref: `heads/${short}`,
				sha: commit,
				force: false,
			});
			return commit;
		}),
	};
};
