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
	const fetch: typeof globalThis.fetch = async (input, init) => {
		const request = new Request(input as URL | globalThis.Request | string, init);
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
	};
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
