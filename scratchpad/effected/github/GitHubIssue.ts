import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import type { GitHubGraphQLError } from "./GraphQL.ts";
import { GraphQLDocument } from "./GraphQL.ts";
import { numericId } from "./internal/ids.ts";
import type { CommentMarker } from "./PullRequestComment.ts";
import { CommentRecord } from "./PullRequestComment.ts";
import { Repo } from "./Repo.ts";
import type { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/GitHubIssue");

/**
 * An issue, projected to what callers read.
 *
 * @public
 */
export class IssueInfo extends S.Class<IssueInfo>($I`IssueInfo`)({
	number: S.Int.annotateKey({ description: "The issue's repository-local number, used to read, close and comment on it" }),
	title: S.String.annotateKey({ description: "The issue's heading as reported by GitHub" }),
	state: S.Literals(["open", "closed"]).annotateKey({ description: "Whether the issue is `open` or `closed`" }),
	/** Label names, normalized from GitHub's `string | { name }` union. */
	labels: S.Array(S.String).annotateKey({ description: "Label names, normalized from GitHub's `string | { name }` union." }),
	url: S.String.annotateKey({ description: "The web URL of the issue on GitHub" }),
	/** The GraphQL node id. */
	nodeId: S.String.annotateKey({ description: "The GraphQL node id." }),
}, $I.annote("IssueInfo", { description: "An issue, projected to what callers read." })) {}

/**
 * An issue a pull request closes.
 *
 * @public
 */
export class LinkedIssue extends S.Class<LinkedIssue>($I`LinkedIssue`)({
	number: S.Int.annotateKey({ description: "The repository-local number of an issue the pull request closes" }),
	title: S.String.annotateKey({ description: "The heading of an issue the pull request closes, as reported by GitHub" }),
	state: S.String.annotateKey({ description: "The linked issue's state as returned by GitHub's GraphQL closing references, without normalization" }),
	url: S.String.annotateKey({ description: "The web URL of an issue the pull request closes" }),
	nodeId: S.String.annotateKey({ description: "GitHub's GraphQL node identifier for an issue the pull request closes" }),
	/**
	 * Whether a human wrote the link, rather than GitHub inferring it from the
	 * branch or commit messages.
	 *
	 * @remarks
	 * Resolved by querying the pull request's closing references twice, once with
	 * `userLinkedOnly`, and marking the issues present in the second result.
	 */
	userLinked: S.Boolean.annotateKey({ description: "Whether a human wrote the link, rather than GitHub inferring it from the branch or commit messages." }),
}, $I.annote("LinkedIssue", { description: "An issue a pull request closes." })) {}

/**
 * What {@link GitHubIssueShape.commentOnce} found or wrote.
 *
 * @remarks
 * `wrote` is the field the caller branches on: `true` means this call created
 * the comment, `false` means the marker was already on the issue and nothing
 * was posted. Either way `comment` is the marked comment itself.
 *
 * @public
 */
export class CommentOnceResult extends S.Class<CommentOnceResult>($I`CommentOnceResult`)({
	/** Did this call post the comment (`true`), or find it already there (`false`)? */
	wrote: S.Boolean.annotateKey({ description: "Did this call post the comment (`true`), or find it already there (`false`)?" }),
	/** The marked comment — the one created, or the one that made us skip. */
	comment: CommentRecord.annotateKey({ description: "The marked comment — the one created, or the one that made us skip." }),
}, $I.annote("CommentOnceResult", { description: "What GitHubIssueShape.commentOnce found or wrote." })) {}

const IssueNodes = S.Struct({
	id: S.String,
	number: S.Int,
	title: S.String,
	state: S.String,
	url: S.String,
});

const LinkedIssuesResponse = S.Struct({
	repository: S.Struct({
		pullRequest: S.Struct({
			allLinked: S.Struct({ nodes: S.Array(IssueNodes) }),
			manuallyLinked: S.Struct({ nodes: S.Array(IssueNodes) }),
		}),
	}),
});

const LinkedIssuesDocument = GraphQLDocument.make({
	name: "linkedIssues",
	document: `query ($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $prNumber) {
      allLinked: closingIssuesReferences(first: 50) { nodes { id number title state url } }
      manuallyLinked: closingIssuesReferences(first: 50, userLinkedOnly: true) { nodes { id number title state url } }
    }
  }
}`,
	response: LinkedIssuesResponse,
})<{ readonly owner: string; readonly repo: string; readonly prNumber: number }>();

const CrossReferencedResponse = S.Struct({
	repository: S.Struct({
		issue: S.Struct({
			timelineItems: S.Struct({
				nodes: S.Array(
					S.Struct({
						source: S.optionalKey(
							S.Struct({
								__typename: S.optionalKey(S.String),
								number: S.optionalKey(S.Int),
							}),
						),
					}),
				),
			}),
		}),
	}),
});

const CrossReferencedDocument = GraphQLDocument.make({
	name: "issueCrossReferences",
	document: `query ($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      timelineItems(last: 50, itemTypes: CROSS_REFERENCED_EVENT) {
        nodes {
          __typename
          ... on CrossReferencedEvent { source { __typename ... on PullRequest { number } } }
        }
      }
    }
  }
}`,
	response: CrossReferencedResponse,
})<{ readonly owner: string; readonly repo: string; readonly issueNumber: number }>();

/**
 * Read, list, close and comment on issues, and resolve the issues a pull
 * request closes.
 *
 * @public
 */
export interface GitHubIssueShape {
	/** Read one issue. Fails `notFound` when it does not exist. */
	readonly get: (number: number) => Effect.Effect<IssueInfo, GitHubError, Repo>;
	/**
	 * List issues, paginated. `state` is omitted from the request when unset, so GitHub's default applies.
	 *
	 * @remarks
	 * GitHub's issues endpoint also returns pull requests; this does not filter them out.
	 */
	readonly list: (options?: {
		readonly state?: "open" | "closed" | "all" | undefined;
		readonly labels?: ReadonlyArray<string> | undefined;
		readonly page?: PageOptions | undefined;
	}) => Effect.Effect<ReadonlyArray<IssueInfo>, GitHubError, Repo>;
	/** Close an issue. `reason` is sent as `state_reason` when given; unset, GitHub chooses. */
	readonly close: (number: number, reason?: "completed" | "not_planned") => Effect.Effect<void, GitHubError, Repo>;
	/** Post a comment and return its id. */
	readonly comment: (number: number, body: string) => Effect.Effect<number, GitHubError, Repo>;
	/**
	 * Post a marked comment once: create it, or skip if it already exists.
	 *
	 * @remarks
	 * Create-or-skip, **never edit** — the counterpart to
	 * `PullRequestComment.upsert`, which edits in place. The marker is appended
	 * to the body exactly as `upsert` formats it, so a comment either member
	 * writes stays findable by the other.
	 *
	 * The check-then-create is **not atomic** — GitHub offers no conditional
	 * create, so two callers racing the same issue can both observe no marker
	 * and both post. The guard is idempotence across *sequential* invocations
	 * (a re-run workflow, the motivating case), not mutual exclusion across
	 * concurrent ones; a caller needing the latter must serialize externally.
	 *
	 * The existence check is the comment itself: the issue's comments are
	 * paginated and the first body carrying the marker means skip. That is the
	 * guard {@link GitHubIssueShape.isCrossReferencedBy}'s docstring tells you
	 * to build — an issue reached via `linkedIssues` is cross-referenced from
	 * the outset, so only the marker answers "have I commented yet?".
	 */
	readonly commentOnce: (
		issueNumber: number,
		marker: CommentMarker,
		body: string,
	) => Effect.Effect<CommentOnceResult, GitHubError, Repo>;
	/** The issues a pull request closes, with `userLinked` telling you who linked them. */
	readonly linkedIssues: (prNumber: number) => Effect.Effect<ReadonlyArray<LinkedIssue>, GitHubGraphQLError, Repo>;
	/**
	 * Has `prNumber` already been cross-referenced on this issue?
	 *
	 * @remarks
	 * An idempotence guard over the issue's timeline, so that re-running a
	 * workflow does not comment twice.
	 *
	 * Two hazards before building on it:
	 *
	 * - **An issue obtained from `linkedIssues(pr)` answers `true` from the
	 *   outset** — the closing link itself puts a cross-reference on the
	 *   issue's timeline. As a "have I commented yet?" guard on those issues
	 *   the answer is always yes, and the comment is never posted. Guard a
	 *   comment by looking for the comment (a marker in its body), not for a
	 *   cross-reference.
	 * - **It observes `CROSS_REFERENCED_EVENT` only, not `ConnectedEvent`** —
	 *   an issue a human attached through the sidebar's Development section is
	 *   connected, not cross-referenced, and reads `false` here even though
	 *   GitHub's UI shows the link.
	 */
	readonly isCrossReferencedBy: (
		issueNumber: number,
		prNumber: number,
	) => Effect.Effect<boolean, GitHubGraphQLError, Repo>;
}

/**
 * Read, list, close and comment on issues, and resolve the issues a pull
 * request closes.
 *
 * @remarks
 * Provide it with {@link GitHubIssue.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { GitHubIssue } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const closeWontFix = (number: number) =>
 *   Effect.gen(function* () {
 *     const issues = yield* GitHubIssue;
 *     yield* issues.comment(number, "Closing as not planned.");
 *     yield* issues.close(number, "not_planned");
 *   });
 * ```
 *
 * @public
 */
export class GitHubIssue extends Context.Service<GitHubIssue, GitHubIssueShape>()($I`GitHubIssue`) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<GitHubIssue, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<GitHubIssueShape> = {}): GitHubIssueShape => ({
		get: overrides.get ?? (() => unstubbed("get")),
		list: overrides.list ?? (() => unstubbed("list")),
		close: overrides.close ?? (() => unstubbed("close")),
		comment: overrides.comment ?? (() => unstubbed("comment")),
		commentOnce: overrides.commentOnce ?? (() => unstubbed("commentOnce")),
		linkedIssues: overrides.linkedIssues ?? (() => unstubbed("linkedIssues")),
		isCrossReferencedBy: overrides.isCrossReferencedBy ?? (() => unstubbed("isCrossReferencedBy")),
	});

	/** {@link GitHubIssue.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<GitHubIssueShape> = {}): Layer.Layer<GitHubIssue> =>
		Layer.succeed(GitHubIssue, GitHubIssue.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw new Error(`GitHubIssue.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/**
 * The REST calendar version this module's requests pin.
 *
 * @remarks
 * The routes are not deprecated — the **default api-version** is. When no
 * `x-github-api-version` header is sent (octokit sends none), GitHub serves
 * calendar version 2022-11-28, which it deprecated when 2026-03-10 shipped and
 * sunsets on 2028-03-10. Every response from an endpoint the new version
 * changed then carries a `Deprecation` header, which `@octokit/request` prints
 * straight to the consumer's console — the constructor's `log` option cannot
 * silence it, because the fetch wrapper resolves `request.log ?? console`.
 * `PATCH /repos/{owner}/{repo}/issues/{issue_number}` is on that list (the
 * singular `assignee` parameter was removed), so every `close` warned once per
 * issue in consumer workflow logs.
 *
 * Nothing this module sends or reads changed in 2026-03-10: `state` and
 * `state_reason` are untouched, and the projections read only fields both
 * versions carry. Pinning the current version is therefore the whole fix, and
 * it deliberately does **not** hide future deprecations — when GitHub
 * deprecates 2026-03-10 in turn, the header comes back and octokit warns
 * again.
 */
const API_VERSION_HEADERS = { "x-github-api-version": "2026-03-10" } as const;

/** GitHub sends a label as either a string or an object; callers want the name. */
const labelNames = (labels: ReadonlyArray<string | { name?: string | undefined }>): ReadonlyArray<string> =>
	labels.flatMap((label) => (typeof label === "string" ? [label] : label.name !== undefined ? [label.name] : []));

interface RawIssue {
	readonly number: number;
	readonly title: string;
	readonly state: string;
	readonly labels: ReadonlyArray<string | { name?: string | undefined }>;
	readonly html_url: string;
	readonly node_id: string;
}

const project = (raw: RawIssue): IssueInfo =>
	IssueInfo.make({
		number: raw.number,
		title: raw.title,
		state: raw.state === "closed" ? "closed" : "open",
		labels: labelNames(raw.labels),
		url: raw.html_url,
		nodeId: raw.node_id,
	});

const make = (client: GitHubClient["Service"]): GitHubIssueShape => ({
	get: Effect.fn("GitHubIssue.get")(function* (number: number) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, number });
		const raw = yield* client.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
			owner,
			repo,
			issue_number: number,
			headers: API_VERSION_HEADERS,
		});
		return project(raw);
	}),

	list: Effect.fn("GitHubIssue.list")(function* (options?: {
		readonly state?: "open" | "closed" | "all" | undefined;
		readonly labels?: ReadonlyArray<string> | undefined;
		readonly page?: PageOptions | undefined;
	}) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo });
		const raw = yield* client.paginate(
			"GET /repos/{owner}/{repo}/issues",
			{
				owner,
				repo,
				...(options?.state !== undefined ? { state: options.state } : {}),
				...(options?.labels !== undefined ? { labels: options.labels.join(",") } : {}),
				headers: API_VERSION_HEADERS,
			},
			options?.page,
		);
		return raw.map(project);
	}),

	close: Effect.fn("GitHubIssue.close")(function* (number: number, reason?: "completed" | "not_planned") {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, number });
		yield* client.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
			owner,
			repo,
			issue_number: number,
			state: "closed",
			...(reason !== undefined ? { state_reason: reason } : {}),
			headers: API_VERSION_HEADERS,
		});
	}),

	comment: Effect.fn("GitHubIssue.comment")(function* (number: number, body: string) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, number });
		const created = yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner,
			repo,
			issue_number: number,
			body,
			headers: API_VERSION_HEADERS,
		});
		return numericId(created.id);
	}),

	commentOnce: Effect.fn("GitHubIssue.commentOnce")(function* (
		issueNumber: number,
		marker: CommentMarker,
		body: string,
	) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber, marker: marker.key });
		const comments = yield* client.paginate("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner,
			repo,
			issue_number: issueNumber,
			headers: API_VERSION_HEADERS,
		});
		const existing = comments.find((comment) => marker.matches(comment.body ?? ""));
		if (existing !== undefined) {
			return CommentOnceResult.make({
				wrote: false,
				comment: CommentRecord.make({ id: numericId(existing.id), body: existing.body ?? "", url: existing.html_url }),
			});
		}
		const created = yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
			owner,
			repo,
			issue_number: issueNumber,
			body: `${body}\n\n${marker.html}`,
			headers: API_VERSION_HEADERS,
		});
		return CommentOnceResult.make({
			wrote: true,
			comment: CommentRecord.make({ id: numericId(created.id), body: created.body ?? "", url: created.html_url }),
		});
	}),

	linkedIssues: Effect.fn("GitHubIssue.linkedIssues")(function* (prNumber: number) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, prNumber });
		const result = yield* client.graphql(LinkedIssuesDocument, { owner, repo, prNumber });
		const manual = new Set(result.repository.pullRequest.manuallyLinked.nodes.map((node) => node.number));
		return result.repository.pullRequest.allLinked.nodes.map((node) =>
			LinkedIssue.make({
				number: node.number,
				title: node.title,
				state: node.state,
				url: node.url,
				nodeId: node.id,
				userLinked: manual.has(node.number),
			}),
		);
	}),

	isCrossReferencedBy: Effect.fn("GitHubIssue.isCrossReferencedBy")(function* (issueNumber: number, prNumber: number) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, issueNumber, prNumber });
		const result = yield* client.graphql(CrossReferencedDocument, { owner, repo, issueNumber });
		return result.repository.issue.timelineItems.nodes.some(
			(node) => node.source?.__typename === "PullRequest" && node.source.number === prNumber,
		);
	}),
});
