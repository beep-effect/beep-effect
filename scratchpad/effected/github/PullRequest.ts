import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { CommitFile } from "./GitHubCommit.ts";
import { fileOf } from "./GitHubCommit.ts";
import { GitHubError } from "./GitHubError.ts";
import type { GitHubGraphQLError } from "./GraphQL.ts";
import { GraphQLDocument } from "./GraphQL.ts";
import { Repo } from "./Repo.ts";
import { PageOptions } from "./Rest.ts";

const $I = $ScratchpadId.create("effected/github/PullRequest");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
	message: S.String.annotateKey({ description: "The test-double member that needs an override." }),
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/** How a pull request is merged. @public */
export const MergeMethod = LiteralKit(["merge", "squash", "rebase"]).pipe($I.annoteSchema("MergeMethod", { description: "How a pull request is merged." }));

/** The values accepted by {@link MergeMethod}. @public */
export type MergeMethod = typeof MergeMethod.Type;

/**
 * A pull request, projected to what callers read.
 *
 * **Details**
 *
 * This is the **domain** shape, and the only pull-request type this package
 * exports. It flattens GitHub's nested `head`/`base` objects to
 * `head`/`headSha` and `base`/`baseSha`, and spells the link `url`. If you are
 * writing a test double or a fixture, this is the type you build.
 *
 * @public
 */
export class PullRequestInfo extends S.Class<PullRequestInfo>($I`PullRequestInfo`)({
	/** The number in `#123`. */
	number: S.Int.annotateKey({ description: "The number in `#123`." }),
	/** The GraphQL node id, which the auto-merge mutations need. */
	nodeId: S.String.annotateKey({ description: "The GraphQL node id, which the auto-merge mutations need." }),
	/** The web URL. */
	url: S.String.annotateKey({ description: "The web URL." }),
	title: S.String.annotateKey({ description: "The pull request's heading as reported by GitHub" }),
	state: S.Literals(["open", "closed"]).annotateKey({ description: "Whether the pull request is `open` or `closed`, with merge status reported separately" }),
	/** The source branch name. */
	head: S.String.annotateKey({ description: "The source branch name." }),
	/** The sha the source branch pointed at when GitHub answered. */
	headSha: S.String.annotateKey({ description: "The sha the source branch pointed at when GitHub answered." }),
	/** The target branch name. */
	base: S.String.annotateKey({ description: "The target branch name." }),
	/** The sha the target branch pointed at when GitHub answered — the commit the pull request branches from. */
	baseSha: S.String.annotateKey({ description: "The sha the target branch pointed at when GitHub answered — the commit the pull request branches from." }),
	draft: S.Boolean.annotateKey({ description: "Whether GitHub marks the pull request as a draft, defaulting to false when omitted" }),
	merged: S.Boolean.annotateKey({ description: "Whether the pull request merged, using GitHub's explicit flag or, when absent, the presence of a merge timestamp" }),
	/**
  * When it merged, if it did.
  *
  * **Details**
  *
  * An `Option`, not an optional field. Whether a pull request has merged is a
  * fact GitHub always reports, so modelling it as "maybe absent" would be
  * modelling a gap in our fixtures rather than a gap in the domain.
  */
	mergedAt: S.Option(S.DateTimeUtcFromString).annotateKey({ description: "When it merged, if it did." }),
	/** The description, when GitHub sent one. */
	body: S.optionalKey(S.String).annotateKey({ description: "The description, when GitHub sent one." }),
	/** The merge commit, once there is one. */
	mergeCommitSha: S.optionalKey(S.String).annotateKey({ description: "The merge commit, once there is one." }),
}, $I.annote("PullRequestInfo", { description: "A pull request, projected to what callers read." })) {}

/**
 * What {@link PullRequestShape.upsert} did.
 *
 * @public
 */
export const UpsertedPullRequest = S.Struct({
	/** The pull request, as created or as updated. */
	pullRequest: PullRequestInfo.annotateKey({ description: "The pull request, as created or as updated." }),
	/** `true` when a new pull request was opened, `false` when an open one was updated. */
	created: S.Boolean.annotateKey({ description: "Whether this operation opened a new pull request rather than updating one." }),
}).pipe($I.annoteSchema("UpsertedPullRequest", { description: "What PullRequest.upsert did, retaining its plain-object return boundary." }));

/** What {@link PullRequestShape.upsert} did. @public */
export type UpsertedPullRequest = typeof UpsertedPullRequest.Type;

const AutoMergeResponse = S.Struct({});

const EnableAutoMerge = GraphQLDocument.make({
	name: "enablePullRequestAutoMerge",
	document: `mutation ($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod!) {
  enablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId, mergeMethod: $mergeMethod }) {
    clientMutationId
  }
}`,
	response: AutoMergeResponse,
})<{ readonly pullRequestId: string; readonly mergeMethod: string }>();

const DisableAutoMerge = GraphQLDocument.make({
	name: "disablePullRequestAutoMerge",
	document: `mutation ($pullRequestId: ID!) {
  disablePullRequestAutoMerge(input: { pullRequestId: $pullRequestId }) { clientMutationId }
}`,
	response: AutoMergeResponse,
})<{ readonly pullRequestId: string }>();

/** GraphQL spells the merge methods in capitals. */
const GRAPHQL_MERGE_METHOD = { merge: "MERGE", squash: "SQUASH", rebase: "REBASE" } as const;

/**
 * Read, list, create, update, merge and label pull requests, and control
 * auto-merge.
 *
 * @public
 */
export interface PullRequestShape {
	/** Read one pull request. Fails `notFound` when it does not exist. */
	readonly get: (number: number) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
	/**
  * Open, closed or all pull requests, optionally filtered.
  *
  * **Gotchas**
  *
  * `head` accepts **either** the qualified `owner:ref` GitHub's filter wants
  * or a bare `ref`, which is qualified with the current repo's owner on the
  * way out. So for a pull request opened **from the current repository**,
  * feeding this method `PullRequestInfo.head` (the bare branch name)
  * round-trips correctly; GitHub's own route ignores an unqualified ref.
  *
  * **The round trip does not hold for a fork-originated pull request.**
  * `PullRequestInfo` projects only the ref and drops the source owner, so
  * qualifying it here prefixes the *current* repo's owner and names a branch
  * in the wrong account — the filter then matches nothing, silently. When the
  * head may live in a fork, pass a qualified `owner:ref` built from the source
  * owner rather than from anything this projection carries.
  */
	readonly list: (options?: {
		readonly head?: string | undefined;
		readonly base?: string | undefined;
		readonly state?: "open" | "closed" | "all" | undefined;
		readonly page?: PageOptions | undefined;
	}) => Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError, Repo>;
	/**
  * The files a pull request changes.
  *
  * **Details**
  *
  * Each entry is a full {@link CommitFile} — path **and** status, plus the
  * line counts and any pre-rename path — the same projection
  * `GitHubCommit.changedFiles` returns, because GitHub answers both
  * endpoints with the same `diff-entry` shape.
  */
	readonly listFiles: (
		number: number,
		options?: { readonly page?: PageOptions | undefined },
	) => Effect.Effect<ReadonlyArray<CommitFile>, GitHubError, Repo>;
	/**
  * The pull requests associated with a commit.
  *
  * **Details**
  *
  * Paginated: pass `page` to bound the walk.
  */
	readonly listAssociatedWithCommit: (
		sha: string,
		options?: { readonly page?: PageOptions | undefined },
	) => Effect.Effect<ReadonlyArray<PullRequestInfo>, GitHubError, Repo>;
	/** Open a pull request from `head` into `base`. */
	readonly create: (input: {
		readonly title: string;
		readonly head: string;
		readonly base: string;
		readonly body?: string | undefined;
		readonly draft?: boolean | undefined;
	}) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
	/** Patch a pull request; only the fields given are sent. */
	readonly update: (
		number: number,
		patch: {
			readonly title?: string | undefined;
			readonly body?: string | undefined;
			readonly state?: "open" | "closed" | undefined;
			readonly base?: string | undefined;
		},
	) => Effect.Effect<PullRequestInfo, GitHubError, Repo>;
	/**
  * Update the open pull request for `head`→`base`, or open one.
  *
  * **Gotchas**
  *
  * When a pull request is already open, only `title` and `body` are updated;
  * `draft` applies only when a new pull request is opened.
  */
	readonly upsert: (input: {
		readonly title: string;
		readonly head: string;
		readonly base: string;
		readonly body?: string | undefined;
		readonly draft?: boolean | undefined;
	}) => Effect.Effect<UpsertedPullRequest, GitHubError, Repo>;
	/** Merge a pull request and return the merge commit sha. `method` defaults to GitHub's choice. */
	readonly merge: (
		number: number,
		options?: {
			readonly method?: MergeMethod | undefined;
			readonly commitTitle?: string | undefined;
			readonly commitMessage?: string | undefined;
		},
	) => Effect.Effect<string, GitHubError, Repo>;
	/** Add labels to a pull request (as an issue), keeping the ones already there. */
	readonly addLabels: (number: number, labels: ReadonlyArray<string>) => Effect.Effect<void, GitHubError, Repo>;
	/** Request reviews from users and/or teams (team slugs). */
	readonly requestReviewers: (
		number: number,
		reviewers: {
			readonly users?: ReadonlyArray<string> | undefined;
			readonly teams?: ReadonlyArray<string> | undefined;
		},
	) => Effect.Effect<void, GitHubError, Repo>;
	/**
  * Turn auto-merge on or off.
  *
  * **Details**
  *
  * An explicit call, not an option on `create`/`update`, so a create that
  * worked is never reported as failed because auto-merge was refused. Pass
  * `"off"` to disable it.
  */
	readonly setAutoMerge: (
		pullRequest: PullRequestInfo,
		method: MergeMethod | "off",
	) => Effect.Effect<void, GitHubGraphQLError, Repo>;
}

/**
 * Read, list, create, update, merge and label pull requests, and control
 * auto-merge.
 *
 * **Details**
 *
 * Provide it with {@link PullRequest.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * **Example** (Upsert a release pull request and enable squash auto-merge)
 *
 * ```ts
 * import { PullRequest } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const openOrUpdate = Effect.gen(function* () {
 *   const pulls = yield* PullRequest;
 *   const { pullRequest, created } = yield* pulls.upsert({
 *     title: "chore: release",
 *     head: "changeset-release/main",
 *     base: "main",
 *   });
 *   yield* pulls.setAutoMerge(pullRequest, "squash");
 *   return created;
 * });
 * ```
 *
 * @public
 */
export class PullRequest extends Context.Service<PullRequest, PullRequestShape>()($I`PullRequest`) {
	/** The live service, built over a `GitHubClient`. */
	static readonly layer: Layer.Layer<PullRequest, never, GitHubClient> = Layer.effect(
		this,
		Effect.map(GitHubClient, (client) => make(client)),
	);

	/** An in-memory double; unstubbed members die naming themselves. */
	static readonly makeTest = (overrides: Partial<PullRequestShape> = {}): PullRequestShape => ({
		get: overrides.get ?? (() => unstubbed("get")),
		list: overrides.list ?? (() => unstubbed("list")),
		listFiles: overrides.listFiles ?? (() => unstubbed("listFiles")),
		listAssociatedWithCommit: overrides.listAssociatedWithCommit ?? (() => unstubbed("listAssociatedWithCommit")),
		create: overrides.create ?? (() => unstubbed("create")),
		update: overrides.update ?? (() => unstubbed("update")),
		upsert: overrides.upsert ?? (() => unstubbed("upsert")),
		merge: overrides.merge ?? (() => unstubbed("merge")),
		addLabels: overrides.addLabels ?? (() => unstubbed("addLabels")),
		requestReviewers: overrides.requestReviewers ?? (() => unstubbed("requestReviewers")),
		setAutoMerge: overrides.setAutoMerge ?? (() => unstubbed("setAutoMerge")),
	});

	/** {@link PullRequest.makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<PullRequestShape> = {}): Layer.Layer<PullRequest> =>
		Layer.succeed(PullRequest, PullRequest.makeTest(overrides));
}

const unstubbed = (member: string): never => {
	throw UnstubbedError.make({ message: `PullRequest.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

/**
 * The raw REST wire shape, as GitHub answers it — **not** the domain type.
 * {@link PullRequestInfo} is what callers read; `project` below is the one
 * conversion between them. Private on purpose: nothing outside this module
 * should hold a value of this shape.
 */
interface RawPull {
	readonly number: number;
	readonly node_id: string;
	readonly html_url: string;
	readonly title: string;
	readonly state: string;
	readonly head: { readonly ref: string; readonly sha: string };
	readonly base: { readonly ref: string; readonly sha: string };
	readonly draft?: boolean | undefined;
	readonly merged?: boolean | undefined;
	readonly merged_at?: string | null | undefined;
	readonly body?: string | null | undefined;
	readonly merge_commit_sha?: string | null | undefined;
}

const project = (raw: RawPull): Effect.Effect<PullRequestInfo, GitHubError> =>
	Effect.try({
		try: () =>
			PullRequestInfo.make({
				number: raw.number,
				nodeId: raw.node_id,
				url: raw.html_url,
				title: raw.title,
				state: raw.state === "closed" ? "closed" : "open",
				head: raw.head.ref,
				headSha: raw.head.sha,
				base: raw.base.ref,
				baseSha: raw.base.sha,
				draft: raw.draft ?? false,
				merged: raw.merged ?? raw.merged_at != null,
				// Constructed rather than decoded: the Type side of
				// `Schema.Option(DateTimeUtcFromString)` is an `Option<DateTime.Utc>`,
				// and GitHub's wire form is a nullable ISO string — two different
				// shapes, so the conversion belongs here rather than in a codec that
				// would have to describe GitHub's encoding as if it were ours.
				mergedAt: raw.merged_at == null ? O.none() : O.some(DateTime.makeUnsafe(raw.merged_at)),
				...(raw.body != null ? { body: raw.body } : {}),
				...(raw.merge_commit_sha != null ? { mergeCommitSha: raw.merge_commit_sha } : {}),
			}),
		catch: (error) => GitHubError.decode("PullRequest", "GitHub returned an unexpected pull request", error),
	});

/** `owner:branch` is what GitHub's `head` filter wants for a cross-fork search. */
const qualifyHead = (owner: string, head: string): string => (head.includes(":") ? head : `${owner}:${head}`);

const make = (client: GitHubClient["Service"]): PullRequestShape => {
	const list = Effect.fn("PullRequest.list")(function* (options?: {
		readonly head?: string | undefined;
		readonly base?: string | undefined;
		readonly state?: "open" | "closed" | "all" | undefined;
		readonly page?: PageOptions | undefined;
	}) {
		const { owner, repo } = yield* Repo;
		const raw = yield* client.paginate(
			"GET /repos/{owner}/{repo}/pulls",
			{
				owner,
				repo,
				...O.getSomesStruct({ state: O.fromUndefinedOr(options?.state) }),
				...O.getSomesStruct({ head: O.map(O.fromUndefinedOr(options?.head), (head) => qualifyHead(owner, head)) }),
				...O.getSomesStruct({ base: O.fromUndefinedOr(options?.base) }),
			},
			options?.page,
		);
		return yield* Effect.forEach(raw, project);
	});

	const create = Effect.fn("PullRequest.create")(function* (input: {
		readonly title: string;
		readonly head: string;
		readonly base: string;
		readonly body?: string | undefined;
		readonly draft?: boolean | undefined;
	}) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, head: input.head, base: input.base });
		const created = yield* client.request("POST /repos/{owner}/{repo}/pulls", {
			owner,
			repo,
			title: input.title,
			head: input.head,
			base: input.base,
			...O.getSomesStruct({ body: O.fromUndefinedOr(input.body) }),
			...O.getSomesStruct({ draft: O.fromUndefinedOr(input.draft) }),
		});
		return yield* project(created);
	});

	const update = Effect.fn("PullRequest.update")(function* (
		number: number,
		patch: {
			readonly title?: string | undefined;
			readonly body?: string | undefined;
			readonly state?: "open" | "closed" | undefined;
			readonly base?: string | undefined;
		},
	) {
		const { owner, repo } = yield* Repo;
		yield* Effect.annotateCurrentSpan({ owner, repo, number });
		const updated = yield* client.request("PATCH /repos/{owner}/{repo}/pulls/{pull_number}", {
			owner,
			repo,
			pull_number: number,
			// Conditional spreads, not `...patch`: under exactOptionalPropertyTypes a
			// present-but-undefined key is not the same as an absent one, and octokit's
			// generated parameter types say so.
			...O.getSomesStruct({ title: O.fromUndefinedOr(patch.title) }),
			...O.getSomesStruct({ body: O.fromUndefinedOr(patch.body) }),
			...O.getSomesStruct({ state: O.fromUndefinedOr(patch.state) }),
			...O.getSomesStruct({ base: O.fromUndefinedOr(patch.base) }),
		});
		return yield* project(updated);
	});

	return {
		list,
		create,
		update,

		get: Effect.fn("PullRequest.get")(function* (number: number) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, number });
			const raw = yield* client.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
				owner,
				repo,
				pull_number: number,
			});
			return yield* project(raw);
		}),

		listFiles: Effect.fn("PullRequest.listFiles")(function* (
			number: number,
			options?: { readonly page?: PageOptions | undefined },
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, number });
			const files = yield* client.paginate(
				"GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
				{ owner, repo, pull_number: number },
				options?.page,
			);
			// The same `diff-entry` wire shape the single-commit read answers with,
			// so the same projection turns it into `CommitFile`s.
			return yield* Effect.forEach(files, (file) => fileOf(file, "PullRequest.listFiles"));
		}),

		listAssociatedWithCommit: Effect.fn("PullRequest.listAssociatedWithCommit")(function* (
			sha: string,
			options?: { readonly page?: PageOptions | undefined },
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, sha });
			const raw = yield* client.paginate(
				"GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
				{ owner, repo, commit_sha: sha },
				options?.page,
			);
			return yield* Effect.forEach(raw, project);
		}),

		upsert: Effect.fn("PullRequest.upsert")(function* (input: {
			readonly title: string;
			readonly head: string;
			readonly base: string;
			readonly body?: string | undefined;
			readonly draft?: boolean | undefined;
		}) {
			const existing = yield* list({
				head: input.head,
				base: input.base,
				state: "open",
				page: PageOptions.make({ perPage: 1, maxPages: 1 }),
			});
			const found = existing[0];
			if (found === undefined) {
				return { pullRequest: yield* create(input), created: true };
			}
			const patch = {
				title: input.title,
				...O.getSomesStruct({ body: O.fromUndefinedOr(input.body) }),
			};
			return { pullRequest: yield* update(found.number, patch), created: false };
		}),

		merge: Effect.fn("PullRequest.merge")(function* (
			number: number,
			options?: {
				readonly method?: MergeMethod | undefined;
				readonly commitTitle?: string | undefined;
				readonly commitMessage?: string | undefined;
			},
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, number, method: options?.method ?? "merge" });
			const merged = yield* client.request("PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge", {
				owner,
				repo,
				pull_number: number,
				...O.getSomesStruct({ merge_method: O.fromUndefinedOr(options?.method) }),
				...O.getSomesStruct({ commit_title: O.fromUndefinedOr(options?.commitTitle) }),
				...O.getSomesStruct({ commit_message: O.fromUndefinedOr(options?.commitMessage) }),
			});
			return merged.sha;
		}),

		addLabels: Effect.fn("PullRequest.addLabels")(function* (number: number, labels: ReadonlyArray<string>) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, number, labels: labels.length });
			yield* client.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
				owner,
				repo,
				issue_number: number,
				labels: [...labels],
			});
		}),

		requestReviewers: Effect.fn("PullRequest.requestReviewers")(function* (
			number: number,
			reviewers: {
				readonly users?: ReadonlyArray<string> | undefined;
				readonly teams?: ReadonlyArray<string> | undefined;
			},
		) {
			const { owner, repo } = yield* Repo;
			yield* Effect.annotateCurrentSpan({ owner, repo, number });
			yield* client.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers", {
				owner,
				repo,
				pull_number: number,
				...O.getSomesStruct({ reviewers: O.map(O.fromUndefinedOr(reviewers.users), (values) => [...values]) }),
				...O.getSomesStruct({ team_reviewers: O.map(O.fromUndefinedOr(reviewers.teams), (values) => [...values]) }),
			});
		}),

		setAutoMerge: Effect.fn("PullRequest.setAutoMerge")(function* (
			pullRequest: PullRequestInfo,
			method: MergeMethod | "off",
		) {
			yield* Effect.annotateCurrentSpan({ number: pullRequest.number, method });
			if (method === "off") {
				yield* client.graphql(DisableAutoMerge, { pullRequestId: pullRequest.nodeId });
				return;
			}
			yield* client.graphql(EnableAutoMerge, {
				pullRequestId: pullRequest.nodeId,
				mergeMethod: GRAPHQL_MERGE_METHOD[method],
			});
		}),
	};
};
