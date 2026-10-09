// @effect-diagnostics asyncFunction:skip-file
import type * as Rest from "../../effected/github/Rest.ts";

/**
 * A scripted `fetch` for driving the REAL request path.
 *
 * @remarks
 * octokit accepts a replacement `fetch` as a documented option, so a test can
 * exercise the whole live client — classification, header capture, retry,
 * pagination — against canned HTTP responses. That is strictly more than a
 * hand-written double of the service can prove, because a double cannot get the
 * transport wrong.
 */

/** One scripted reply. */
export interface Reply {
	readonly status: number;
	readonly body?: unknown;
	readonly headers?: Record<string, string>;
}

/** What the scripted fetch recorded about one call. */
export interface Recorded {
	readonly url: string;
	/**
	 * The path, percent-decoded.
	 *
	 * @remarks
	 * octokit encodes every path parameter with `encodeURIComponent`, so a ref
	 * like `heads/main` goes on the wire as `heads%2Fmain` — which GitHub accepts,
	 * and which octokit's own resource methods send too, but which makes a raw-URL
	 * assertion read as a bug when it is not. Assertions use this.
	 */
	readonly path: string;
	readonly method: string;
	readonly headers: Record<string, string>;
	readonly body: string | undefined;
}

export interface ScriptedFetch {
	readonly fetch: typeof globalThis.fetch;
	/** Every call, in order. */
	readonly calls: ReadonlyArray<Recorded>;
	/** `calls.length`, for readability at assertion sites. */
	readonly count: () => number;
	/** The query parameters of call `index`. */
	readonly queryOf: (index: number) => URLSearchParams;
}

/**
 * A `Response` that knows its own URL.
 *
 * @remarks
 * A manually constructed `Response` has `url === ""`, and octokit reads that
 * back for the search-shaped endpoints — its paginator does `new URL(response.url)`
 * whenever the payload carries a `total_count`, which throws `TypeError: Invalid
 * URL` on an empty string. Real fetch responses always carry one, so the failure
 * is purely an artifact of the double; defining the property removes it.
 */
const toResponse = (reply: Reply, url: string): Response => {
	const response = new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
		status: reply.status,
		headers: { "content-type": "application/json", ...reply.headers },
	});
	Object.defineProperty(response, "url", { value: url });
	return response;
};

/**
 * A `fetch` that answers with `replies` in order, repeating the last one once
 * the script runs out.
 */
export const scriptedFetch = (replies: ReadonlyArray<Reply>): ScriptedFetch => {
	const calls: Array<Recorded> = [];
	let index = 0;
	const fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const request = input instanceof URL
			? new Request(input.href, init)
			: typeof input === "string"
				? new Request(input, init)
				: new Request(input, init);
		calls.push({
			url: request.url,
			path: decodeURIComponent(new URL(request.url).pathname),
			method: request.method,
			headers: Object.fromEntries(request.headers.entries()),
			body: init?.body === undefined || init.body === null ? undefined : String(init.body),
		});
		const reply = replies[Math.min(index, replies.length - 1)] ?? { status: 500 };
		index += 1;
		if (init?.signal?.aborted === true) {
			throw new DOMException("aborted", "AbortError");
		}
		return toResponse(reply, request.url);
	}, { preconnect: globalThis.fetch.preconnect });
	return {
		fetch,
		calls,
		count: () => calls.length,
		queryOf: (at) => new URL(calls[at]?.url ?? "https://example.invalid").searchParams,
	};
};

/** A `Link` header pointing at the next page of the same route. */
export const linkNext = (url: string): Record<string, string> => ({ link: `<${url}>; rel="next"` });

/** GitHub's rate-limit header triple. */
export const rateLimitHeaders = (options: {
	remaining: number;
	limit?: number;
	resetEpochSeconds?: number;
}): Record<string, string> => ({
	"x-ratelimit-remaining": String(options.remaining),
	"x-ratelimit-limit": String(options.limit ?? 5000),
	"x-ratelimit-reset": String(options.resetEpochSeconds ?? 1_700_000_000),
});

/** A complete GET /repos/{owner}/{repo} response with caller-selected test fields. */
export const repositoryFixture = (overrides: Partial<Rest.Data<"GET /repos/{owner}/{repo}">> = {}): Rest.Data<"GET /repos/{owner}/{repo}"> => ({
	"id": 0,
	"node_id": "",
	"name": "",
	"full_name": "",
	"owner": {
		"login": "",
		"id": 0,
		"node_id": "",
		"avatar_url": "",
		"gravatar_id": null,
		"url": "",
		"html_url": "",
		"followers_url": "",
		"following_url": "",
		"gists_url": "",
		"starred_url": "",
		"subscriptions_url": "",
		"organizations_url": "",
		"repos_url": "",
		"events_url": "",
		"received_events_url": "",
		"type": "",
		"site_admin": false
	},
	"private": false,
	"html_url": "",
	"description": null,
	"fork": false,
	"url": "",
	"archive_url": "",
	"assignees_url": "",
	"blobs_url": "",
	"branches_url": "",
	"collaborators_url": "",
	"comments_url": "",
	"commits_url": "",
	"compare_url": "",
	"contents_url": "",
	"contributors_url": "",
	"deployments_url": "",
	"downloads_url": "",
	"events_url": "",
	"forks_url": "",
	"git_commits_url": "",
	"git_refs_url": "",
	"git_tags_url": "",
	"git_url": "",
	"issue_comment_url": "",
	"issue_events_url": "",
	"issues_url": "",
	"keys_url": "",
	"labels_url": "",
	"languages_url": "",
	"merges_url": "",
	"milestones_url": "",
	"notifications_url": "",
	"pulls_url": "",
	"releases_url": "",
	"ssh_url": "",
	"stargazers_url": "",
	"statuses_url": "",
	"subscribers_url": "",
	"subscription_url": "",
	"tags_url": "",
	"teams_url": "",
	"trees_url": "",
	"clone_url": "",
	"mirror_url": null,
	"hooks_url": "",
	"svn_url": "",
	"homepage": null,
	"language": null,
	"forks_count": 0,
	"stargazers_count": 0,
	"watchers_count": 0,
	"size": 0,
	"default_branch": "",
	"open_issues_count": 0,
	"has_issues": false,
	"has_projects": false,
	"has_wiki": false,
	"has_pages": false,
	"has_discussions": false,
	"archived": false,
	"disabled": false,
	"pushed_at": "",
	"created_at": "",
	"updated_at": "",
	"subscribers_count": 0,
	"network_count": 0,
	"license": null,
	"forks": 0,
	"open_issues": 0,
	"watchers": 0
,
	...overrides
});

/** A complete GET /users/{username} response with caller-selected test fields. */
export const userFixture = (overrides: Partial<Rest.Data<"GET /users/{username}">> = {}): Rest.Data<"GET /users/{username}"> => ({
	"login": "",
	"id": 0,
	"node_id": "",
	"avatar_url": "",
	"gravatar_id": null,
	"url": "",
	"html_url": "",
	"followers_url": "",
	"following_url": "",
	"gists_url": "",
	"starred_url": "",
	"subscriptions_url": "",
	"organizations_url": "",
	"repos_url": "",
	"events_url": "",
	"received_events_url": "",
	"type": "",
	"site_admin": false,
	"name": null,
	"company": null,
	"blog": null,
	"location": null,
	"email": null,
	"hireable": null,
	"bio": null,
	"public_repos": 0,
	"public_gists": 0,
	"followers": 0,
	"following": 0,
	"created_at": "",
	"updated_at": "",
	"private_gists": 0,
	"total_private_repos": 0,
	"owned_private_repos": 0,
	"disk_usage": 0,
	"collaborators": 0,
	"two_factor_authentication": false
,
	...overrides
});

/** A complete GET /orgs/{org}/teams/{team_slug} response with caller-selected test fields. */
export const teamFixture = (overrides: Partial<Rest.Data<"GET /orgs/{org}/teams/{team_slug}">> = {}): Rest.Data<"GET /orgs/{org}/teams/{team_slug}"> => ({
	"id": 0,
	"node_id": "",
	"url": "",
	"html_url": "",
	"name": "",
	"slug": "",
	"description": null,
	"permission": "",
	"members_url": "",
	"repositories_url": "",
	"members_count": 0,
	"repos_count": 0,
	"created_at": "",
	"updated_at": "",
	"organization": {
		"login": "",
		"id": 0,
		"node_id": "",
		"url": "",
		"repos_url": "",
		"events_url": "",
		"hooks_url": "",
		"issues_url": "",
		"members_url": "",
		"public_members_url": "",
		"avatar_url": "",
		"description": null,
		"has_organization_projects": false,
		"has_repository_projects": false,
		"public_repos": 0,
		"public_gists": 0,
		"followers": 0,
		"following": 0,
		"html_url": "",
		"created_at": "",
		"type": "",
		"updated_at": "",
		"archived_at": null
	},
	"type": "enterprise"
,
	...overrides
});

/** A complete POST /repos/{owner}/{repo}/rulesets response with caller-selected test fields. */
export const rulesetFixture = (overrides: Partial<Rest.Data<"POST /repos/{owner}/{repo}/rulesets">> = {}): Rest.Data<"POST /repos/{owner}/{repo}/rulesets"> => ({
	"id": 0,
	"name": "",
	"source": "",
	"enforcement": "disabled"
,
	...overrides
});

/** A complete GET /repos/{owner}/{repo}/environments response with caller-selected test fields. */
export const environmentFixture = (overrides: Partial<Rest.Item<"GET /repos/{owner}/{repo}/environments">> = {}): Rest.Item<"GET /repos/{owner}/{repo}/environments"> => ({
	"id": 0,
	"node_id": "",
	"name": "",
	"url": "",
	"html_url": "",
	"created_at": "",
	"updated_at": ""
,
	...overrides
});

/** The repository projection carried by a listed pull request. */
const pullRepositoryFixture = (): Rest.Item<"GET /repos/{owner}/{repo}/pulls">["base"]["repo"] => ({
	"id": 0,
	"node_id": "",
	"name": "",
	"full_name": "",
	"license": null,
	"forks": 0,
	"owner": {
		"login": "",
		"id": 0,
		"node_id": "",
		"avatar_url": "",
		"gravatar_id": null,
		"url": "",
		"html_url": "",
		"followers_url": "",
		"following_url": "",
		"gists_url": "",
		"starred_url": "",
		"subscriptions_url": "",
		"organizations_url": "",
		"repos_url": "",
		"events_url": "",
		"received_events_url": "",
		"type": "",
		"site_admin": false
	},
	"private": false,
	"html_url": "",
	"description": null,
	"fork": false,
	"url": "",
	"archive_url": "",
	"assignees_url": "",
	"blobs_url": "",
	"branches_url": "",
	"collaborators_url": "",
	"comments_url": "",
	"commits_url": "",
	"compare_url": "",
	"contents_url": "",
	"contributors_url": "",
	"deployments_url": "",
	"downloads_url": "",
	"events_url": "",
	"forks_url": "",
	"git_commits_url": "",
	"git_refs_url": "",
	"git_tags_url": "",
	"git_url": "",
	"issue_comment_url": "",
	"issue_events_url": "",
	"issues_url": "",
	"keys_url": "",
	"labels_url": "",
	"languages_url": "",
	"merges_url": "",
	"milestones_url": "",
	"notifications_url": "",
	"pulls_url": "",
	"releases_url": "",
	"ssh_url": "",
	"stargazers_url": "",
	"statuses_url": "",
	"subscribers_url": "",
	"subscription_url": "",
	"tags_url": "",
	"teams_url": "",
	"trees_url": "",
	"clone_url": "",
	"mirror_url": null,
	"hooks_url": "",
	"svn_url": "",
	"homepage": null,
	"language": null,
	"forks_count": 0,
	"stargazers_count": 0,
	"watchers_count": 0,
	"size": 0,
	"default_branch": "",
	"open_issues_count": 0,
	"has_issues": false,
	"has_projects": false,
	"has_wiki": false,
	"has_pages": false,
	"has_downloads": false,
	"archived": false,
	"disabled": false,
	"pushed_at": null,
	"created_at": null,
	"updated_at": null,
	"open_issues": 0,
	"watchers": 0
});

/** A complete GET /repos/{owner}/{repo}/pulls response with caller-selected test fields. */
export const pullFixture = (overrides: Partial<Rest.Item<"GET /repos/{owner}/{repo}/pulls">> = {}): Rest.Item<"GET /repos/{owner}/{repo}/pulls"> => ({
	"url": "",
	"id": 0,
	"node_id": "",
	"html_url": "",
	"diff_url": "",
	"patch_url": "",
	"issue_url": "",
	"commits_url": "",
	"review_comments_url": "",
	"review_comment_url": "",
	"comments_url": "",
	"statuses_url": "",
	"number": 0,
	"state": "",
	"locked": false,
	"title": "",
	"user": null,
	"body": null,
	"labels": [],
	"milestone": null,
	"created_at": "",
	"updated_at": "",
	"closed_at": null,
	"merged_at": null,
	"merge_commit_sha": null,
	"assignee": null,
	"head": {
		"label": "",
		"ref": "",
		"repo": pullRepositoryFixture(),
		"sha": "",
		"user": null
	},
	"base": {
		"label": "",
		"ref": "",
		"repo": pullRepositoryFixture(),
		"sha": "",
		"user": null
	},
	"_links": {
		"comments": {
			"href": ""
		},
		"commits": {
			"href": ""
		},
		"statuses": {
			"href": ""
		},
		"html": {
			"href": ""
		},
		"issue": {
			"href": ""
		},
		"review_comments": {
			"href": ""
		},
		"review_comment": {
			"href": ""
		},
		"self": {
			"href": ""
		}
	},
	"author_association": "COLLABORATOR",
	"auto_merge": null
,
	...overrides
});

/** A complete GET /repos/{owner}/{repo}/actions/variables response with caller-selected test fields. */
export const variableFixture = (overrides: Partial<Rest.Item<"GET /repos/{owner}/{repo}/actions/variables">> = {}): Rest.Item<"GET /repos/{owner}/{repo}/actions/variables"> => ({
	"name": "",
	"value": "",
	"created_at": "",
	"updated_at": ""
,
	...overrides
});

/** A complete GET /repos/{owner}/{repo}/actions/secrets response with caller-selected test fields. */
export const secretFixture = (overrides: Partial<Rest.Item<"GET /repos/{owner}/{repo}/actions/secrets">> = {}): Rest.Item<"GET /repos/{owner}/{repo}/actions/secrets"> => ({
	"name": "",
	"created_at": "",
	"updated_at": ""
,
	...overrides
});

/** A complete GET /repos/{owner}/{repo}/rulesets response with caller-selected test fields. */
export const listedRulesetFixture = (overrides: Partial<Rest.Item<"GET /repos/{owner}/{repo}/rulesets">> = {}): Rest.Item<"GET /repos/{owner}/{repo}/rulesets"> => ({
	"id": 0,
	"name": "",
	"source": "",
	"enforcement": "disabled"
,
	...overrides
});
