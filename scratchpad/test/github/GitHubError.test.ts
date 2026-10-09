import { assert, describe, it } from "@effect/vitest";
import { GitHubError, readRateLimitHeaders } from "../../effected/github/GitHubError.ts";

/** Builds the shape octokit's RequestError actually throws. */
const thrown = (options: {
	status?: number;
	message?: string;
	headers?: Record<string, unknown>;
	errors?: ReadonlyArray<unknown>;
}): unknown => ({
	name: "HttpError",
	message: options.message ?? "boom",
	...(options.status !== undefined ? { status: options.status } : {}),
	response: {
		headers: options.headers ?? {},
		data: options.errors !== undefined ? { errors: options.errors } : {},
	},
});

const NOW = 1_700_000_000_000;

describe("GitHubError.fromOctokit", () => {
	it("classifies a 404 as notFound", () => {
		const error = GitHubError.fromOctokit("GitBranch.sha", thrown({ status: 404, message: "Not Found" }), NOW);
		assert.strictEqual(error.kind, "notFound");
		assert.strictEqual(error.status, 404);
		assert.strictEqual(error.reason, "Not Found");
		assert.isFalse(error.retryable);
	});

	it("classifies a 401 as unauthorized", () => {
		const error = GitHubError.fromOctokit("x", thrown({ status: 401, message: "Bad credentials" }), NOW);
		assert.strictEqual(error.kind, "unauthorized");
		assert.isFalse(error.retryable);
	});

	it("classifies a bare 403 as unauthorized, not rate limited", () => {
		// A 403 with no rate-limit evidence is a permission problem. The package
		// this replaces retried these, because its retry had no predicate.
		const error = GitHubError.fromOctokit("x", thrown({ status: 403, message: "Resource not accessible" }), NOW);
		assert.strictEqual(error.kind, "unauthorized");
		assert.isFalse(error.retryable);
		assert.strictEqual(error.retryAfterMillis, undefined);
	});

	it("classifies a 403 with an exhausted budget as rateLimited, with the reset as a delay", () => {
		const resetEpochSeconds = Math.floor(NOW / 1000) + 90;
		const error = GitHubError.fromOctokit(
			"x",
			thrown({
				status: 403,
				message: "API rate limit exceeded",
				headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(resetEpochSeconds) },
			}),
			NOW,
		);
		assert.strictEqual(error.kind, "rateLimited");
		assert.strictEqual(error.retryAfterMillis, 90_000);
		assert.isTrue(error.retryable);
	});

	it("prefers an explicit retry-after over the rate-limit reset", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({
				status: 403,
				headers: {
					"retry-after": "12",
					"x-ratelimit-remaining": "0",
					"x-ratelimit-reset": String(Math.floor(NOW / 1000) + 3600),
				},
			}),
			NOW,
		);
		assert.strictEqual(error.retryAfterMillis, 12_000);
	});

	it("ignores a reset header when the budget is NOT exhausted", () => {
		// Every successful response carries a reset header. Reading it as a delay
		// would make an unrelated failure look rate limited.
		const error = GitHubError.fromOctokit(
			"x",
			thrown({
				status: 403,
				headers: { "x-ratelimit-remaining": "4999", "x-ratelimit-reset": String(Math.floor(NOW / 1000) + 60) },
			}),
			NOW,
		);
		assert.strictEqual(error.retryAfterMillis, undefined);
		assert.strictEqual(error.kind, "unauthorized");
	});

	it("classifies a 429 as rateLimited even with no headers", () => {
		const error = GitHubError.fromOctokit("x", thrown({ status: 429 }), NOW);
		assert.strictEqual(error.kind, "rateLimited");
		assert.isTrue(error.retryable);
	});

	it("classifies 5xx as transport", () => {
		for (const status of [500, 502, 503]) {
			const error = GitHubError.fromOctokit("x", thrown({ status }), NOW);
			assert.strictEqual(error.kind, "transport", `status ${status}`);
			assert.isTrue(error.retryable);
		}
	});

	it("classifies a throwable with no status as transport", () => {
		const error = GitHubError.fromOctokit("x", new TypeError("fetch failed"), NOW);
		assert.strictEqual(error.kind, "transport");
		assert.strictEqual(error.status, undefined);
		assert.strictEqual(error.reason, "fetch failed");
	});

	it("classifies a non-object throwable as transport", () => {
		const error = GitHubError.fromOctokit("x", "exploded", NOW);
		assert.strictEqual(error.kind, "transport");
		assert.strictEqual(error.reason, "exploded");
	});

	it("reads already-exists off the top-level message", () => {
		const error = GitHubError.fromOctokit(
			"GitBranch.create",
			thrown({ status: 422, message: "Reference already exists" }),
			NOW,
		);
		assert.strictEqual(error.kind, "alreadyExists");
	});

	it("reads already-exists out of the nested errors array", () => {
		// GitHub often puts the useful sentence in data.errors[].message and leaves
		// the top-level message as "Validation Failed".
		const error = GitHubError.fromOctokit(
			"GitTag.create",
			thrown({ status: 422, message: "Validation Failed", errors: [{ message: "Reference already exists" }] }),
			NOW,
		);
		assert.strictEqual(error.kind, "alreadyExists");
	});

	it("reads already-exists off a structured already_exists code with no message", () => {
		// The exact body POST /repos/{owner}/{repo}/releases answers for a tag that
		// already has a release: no errors[].message, only the documented code.
		const error = GitHubError.fromOctokit(
			"Release.create",
			thrown({
				status: 422,
				message: "Validation Failed",
				errors: [{ resource: "Release", code: "already_exists", field: "tag_name" }],
			}),
			NOW,
		);
		assert.strictEqual(error.kind, "alreadyExists");
	});

	it("classifies a 422 whose structured code is something else as rejected", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({
				status: 422,
				message: "Validation Failed",
				errors: [{ resource: "Release", code: "invalid", field: "tag_name" }],
			}),
			NOW,
		);
		assert.strictEqual(error.kind, "rejected");
	});

	it("classifies a 409 saying so as alreadyExists", () => {
		const error = GitHubError.fromOctokit("x", thrown({ status: 409, message: "Ref already exists" }), NOW);
		assert.strictEqual(error.kind, "alreadyExists");
	});

	it("classifies a 422 that says nothing about existence as rejected", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({ status: 422, message: "Validation Failed", errors: [{ message: "body is too long" }] }),
			NOW,
		);
		assert.strictEqual(error.kind, "rejected");
		assert.isFalse(error.retryable);
	});

	it("carries each validation entry, skipping ones with nothing GitHub-shaped in them", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({
				status: 422,
				message: "Validation Failed",
				errors: [
					{ resource: "Label", code: "invalid", field: "color" },
					{ code: "custom", message: "name is reserved" },
					"not an object",
					{},
					{ code: 7 },
				],
			}),
			NOW,
		);
		assert.deepStrictEqual(
			error.validation?.map((entry) => ({ ...entry })),
			[
				{ resource: "Label", field: "color", code: "invalid" },
				{ code: "custom", message: "name is reserved" },
			],
		);
	});

	it("omits validation when GitHub sent no errors array", () => {
		const error = GitHubError.fromOctokit("x", thrown({ status: 422, message: "Update is not a fast forward" }), NOW);
		assert.isUndefined(error.validation);
	});

	it("classifies an undocumented code as rejected rather than failing to build the error", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({ status: 422, message: "Validation Failed", errors: [{ code: "too_many" }] }),
			NOW,
		);
		assert.strictEqual(error.kind, "rejected");
		assert.strictEqual(error.validation?.[0]?.code, "too_many");
	});

	it("replaces an HTML error page with a sentence", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({ status: 500, message: "<html><body>unicorn</body></html>" }),
			NOW,
		);
		assert.notInclude(error.reason, "<html>");
		assert.include(error.reason, "HTML error page");
	});

	it("truncates an absurdly long reason", () => {
		const error = GitHubError.fromOctokit("x", thrown({ status: 500, message: "x".repeat(5000) }), NOW);
		assert.isBelow(error.reason.length, 600);
		assert.isTrue(error.reason.endsWith("…"));
	});

	it("keeps the original throwable on cause", () => {
		const original = thrown({ status: 404 });
		const error = GitHubError.fromOctokit("x", original, NOW);
		assert.strictEqual(error.cause, original);
	});
});

describe("GitHubError statics", () => {
	it("notFound builds a 404-shaped error from a subject", () => {
		const error = GitHubError.notFound("GitHubRelease.getByTag", "v1.2.3");
		assert.strictEqual(error.kind, "notFound");
		assert.strictEqual(error.status, 404);
		assert.include(error.message, "GitHubRelease.getByTag");
		assert.include(error.message, "v1.2.3");
	});

	it("alreadyExists is reachable without a live failure", () => {
		const error = GitHubError.alreadyExists("GitTag.create", "refs/tags/v1");
		assert.strictEqual(error.kind, "alreadyExists");
		assert.include(error.reason, "already exists");
	});

	it("rejected carries the status a caller branches on", () => {
		const error = GitHubError.rejected("Repository.updateSettings", 422, "rejected by org policy");
		assert.strictEqual(error.status, 422);
		assert.strictEqual(error.kind, "rejected");
	});

	it("decode records the underlying schema failure", () => {
		const cause = new Error("expected string");
		const error = GitHubError.decode("Attestation.listForSubject", "bad payload", cause);
		assert.strictEqual(error.kind, "decode");
		assert.strictEqual(error.cause, cause);
		assert.strictEqual(error.status, undefined);
	});

	it("message omits the status when there is none", () => {
		const error = GitHubError.decode("x", "nope");
		assert.strictEqual(error.message, "x failed: nope");
	});

	it("hasKind matches any of the listed kinds and nothing else", () => {
		const predicate = GitHubError.hasKind("notFound", "alreadyExists");
		assert.isTrue(predicate(GitHubError.notFound("x", "y")));
		assert.isTrue(predicate(GitHubError.alreadyExists("x", "y")));
		assert.isFalse(predicate(GitHubError.rejected("x", 422, "no")));
	});

	it("hasValidationCode matches any listed code and is false without validation", () => {
		const error = GitHubError.fromOctokit(
			"x",
			thrown({ status: 422, message: "Validation Failed", errors: [{ code: "missing_field", field: "tag_name" }] }),
			NOW,
		);
		assert.isTrue(GitHubError.hasValidationCode("invalid", "missing_field")(error));
		assert.isFalse(GitHubError.hasValidationCode("missing")(error));
		assert.isFalse(GitHubError.hasValidationCode("missing_field")(GitHubError.rejected("x", 422, "no")));
	});

	it("is a tagged error whose tag is stable", () => {
		assert.strictEqual(GitHubError.notFound("x", "y")._tag, "GitHubError");
	});
});

describe("readRateLimitHeaders", () => {
	it("reads a complete header triple", () => {
		const snapshot = readRateLimitHeaders({
			"x-ratelimit-remaining": "4321",
			"x-ratelimit-limit": "5000",
			"x-ratelimit-reset": "1700000090",
		});
		assert.deepStrictEqual(snapshot, { remaining: 4321, limit: 5000, resetEpochSeconds: 1_700_000_090 });
	});

	it("accepts numeric header values", () => {
		const snapshot = readRateLimitHeaders({
			"x-ratelimit-remaining": 1,
			"x-ratelimit-limit": 60,
			"x-ratelimit-reset": 100,
		});
		assert.deepStrictEqual(snapshot, { remaining: 1, limit: 60, resetEpochSeconds: 100 });
	});

	it("returns undefined when any of the three is missing", () => {
		assert.strictEqual(readRateLimitHeaders({ "x-ratelimit-remaining": "1" }), undefined);
		assert.strictEqual(readRateLimitHeaders(undefined), undefined);
	});

	it("returns undefined when a header is not a number", () => {
		assert.strictEqual(
			readRateLimitHeaders({
				"x-ratelimit-remaining": "many",
				"x-ratelimit-limit": "5000",
				"x-ratelimit-reset": "1",
			}),
			undefined,
		);
	});
});
