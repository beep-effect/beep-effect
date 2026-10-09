import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { numericId } from "./internal/ids.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/PullRequestComment");

/**
 * The hidden marker that makes a comment findable again.
 *
 * @remarks
 * The marker is `<!-- namespace:key -->`, an HTML comment appended to the body.
 * The namespace is the caller's, so the library has no opinion about whose
 * comments these are, and a marker is testable without a client.
 *
 * @public
 */
export class CommentMarker extends S.Class<CommentMarker>($I`CommentMarker`)({
	/** Whose comments these are, e.g. your action's name. */
	namespace: S.NonEmptyString.annotateKey({ description: "Whose comments these are, e.g. your action's name." }),
	/** Which comment, within that namespace. */
	key: S.NonEmptyString.annotateKey({ description: "Which comment, within that namespace." }),
}, $I.annote("CommentMarker", { description: "The hidden marker that makes a comment findable again." })) {
	/** The HTML comment appended to a body so the comment can be found again. */
	get html(): string {
		return `<!-- ${this.namespace}:${this.key} -->`;
	}

	/** Does this body carry the marker? */
	matches(body: string): boolean {
		return body.includes(this.html);
	}
}

/**
 * A comment this package wrote or found: its id, body and web URL.
 *
 * @public
 */
export class CommentRecord extends S.Class<CommentRecord>($I`CommentRecord`)({
	id: S.Int.annotateKey({ description: "GitHub-assigned comment identifier used to update or delete the comment" }),
	body: S.String.annotateKey({ description: "Comment text returned by GitHub, including any hidden marker, or empty when GitHub supplies none" }),
	url: S.String.annotateKey({ description: "Web URL for viewing the comment on GitHub" }),
}, $I.annote("CommentRecord", { description: "A comment this package wrote or found: its id, body and web URL." })) {}

/**
 * Post, update, find and delete comments on a pull request or issue, including
 * a "sticky" comment kept current through a marker.
 *
 * @public
 */
export interface PullRequestCommentShape {
	/** Post a new comment. */
	readonly create: (issueNumber: number, body: string) => Effect.Effect<CommentRecord, GitHubError, Repo>;
	/**
	 * Update the marked comment if there is one, or post it.
	 *
	 * @remarks
	 * The marker is appended to the body, so a comment written by `upsert` is
	 * always findable by the same marker afterwards.
	 */
	readonly upsert: (
		issueNumber: number,
		marker: CommentMarker,
		body: string,
	) => Effect.Effect<CommentRecord, GitHubError, Repo>;
	/**
	 * Find the marked comment.
	 *
	 * @remarks
	 * **Paginates**, so the marker is found on a busy pull request too; pass
	 * `page` to bound the walk.
	 */
	readonly find: (
		issueNumber: number,
		marker: CommentMarker,
		options?: { readonly page?: PageOptions | undefined },
	) => Effect.Effect<O.Option<CommentRecord>, GitHubError, Repo>;
	/** Delete a comment by id. */
	readonly delete: (commentId: number) => Effect.Effect<void, GitHubError, Repo>;
}

/**
 * Post, update, find and delete comments on a pull request or issue, including
 * a "sticky" comment kept current through a `CommentMarker`.
 *
 * @remarks
 * Provide it with {@link PullRequestComment.layer}, which needs a `GitHubClient`;
 * each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { CommentMarker, PullRequestComment } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const marker = CommentMarker.make({ namespace: "my-action", key: "report" });
 *
 * const report = (pullNumber: number, body: string) =>
 *   Effect.gen(function* () {
 *     const comments = yield* PullRequestComment;
 *     return yield* comments.upsert(pullNumber, marker, body); // edits the marked comment in place
 *   });
 * ```
 *
 * @public
 */
export class PullRequestComment extends Context.Service<PullRequestComment, PullRequestCommentShape>()(
	$I`PullRequestComment`,
) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<PullRequestComment, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<PullRequestCommentShape> = {}): PullRequestCommentShape => ({
		create: overrides.create ?? (() => unstubbed("create")),
		upsert: overrides.upsert ?? (() => unstubbed("upsert")),
		find: overrides.find ?? (() => unstubbed("find")),
		delete: overrides.delete ?? (() => unstubbed("delete")),
	});

	/** {@link PullRequestComment.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<PullRequestCommentShape> = {}): Layer.Layer<PullRequestComment> =>
		Layer.succeed(PullRequestComment, PullRequestComment.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`PullRequestComment.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const recordOf = (raw: { id: number | bigint; body?: string | null; html_url: string }): CommentRecord =>
	CommentRecord.make({ id: numericId(raw.id), body: raw.body ?? "", url: raw.html_url });

const make = (client: GitHubClient["Service"]): PullRequestCommentShape => {
	const create = Effect.fn("PullRequestComment.create")(function* (issueNumber: number, body: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber });
		const created = yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner,
			repo,
			issue_number: issueNumber,
			body,
		});
		return recordOf(created);
	});

	const find = Effect.fn("PullRequestComment.find")(function* (
		issueNumber: number,
		marker: CommentMarker,
		options?: { readonly page?: PageOptions | undefined },
	) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber, marker: marker.key });
		const comments = yield* client.paginate(
			"GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
			{ owner, repo, issue_number: issueNumber },
			options?.page,
		);
		const found = comments.find((comment) => marker.matches(comment.body ?? ""));
		return found === undefined ? O.none() : O.some(recordOf(found));
	});

	return {
		create,
		find,

		upsert: Effect.fn("PullRequestComment.upsert")(function* (
			issueNumber: number,
			marker: CommentMarker,
			body: string,
		) {
			const { owner, repo } = yield* Repo;
			const marked = `${body}\n\n${marker.html}`;
			const existing = yield* find(issueNumber, marker);
			if (O.isNone(existing)) {
				return yield* create(issueNumber, marked);
			}
			const updated = yield* client.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
				owner,
				repo,
				comment_id: existing.value.id,
				body: marked,
			});
			return recordOf(updated);
		}),

		delete: Effect.fn("PullRequestComment.delete")(function* (commentId: number) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, commentId });
			return yield* client.request("DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}", {
    owner,
    repo,
    comment_id: commentId,
});
		}),
	};
};
