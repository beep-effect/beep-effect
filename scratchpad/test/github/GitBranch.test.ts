import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { assertNone } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import { GitBranch } from "../../effected/github/GitBranch.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import type { Reply } from "./fixtures.ts";
import { harness } from "./harness.ts";

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

const ref = (sha: string): Reply => ({ status: 200, body: { ref: "refs/heads/x", object: { sha, type: "commit" } } });
const notFound: Reply = { status: 404, body: { message: "Not Found" } };
const alreadyExists: Reply = {
	status: 422,
	body: { message: "Reference already exists", errors: [{ message: "Reference already exists" }] },
};
describe("GitBranch.create", () => {
	{
		const { script, base } = harness([{ status: 201, body: {} }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("posts a full refs/heads ref", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitBranch, (branch) => branch.create("release/1.2", "abc"));
					assert.strictEqual(script.calls[0]?.method, "POST");
					assert.include(script.calls[0]?.path ?? "", "/repos/acme/widget/git/refs");
					assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"), {
						ref: "refs/heads/release/1.2",
						sha: "abc",
					});
				}),
			);
		});
	}

	{
		const { script, base } = harness([{ status: 201, body: {} }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("accepts a name the caller already qualified", () =>
				Effect.gen(function* () {
					// GitHub's own API is inconsistent about this, so callers pass whichever
					// form they last saw.
					yield* Effect.flatMap(GitBranch, (branch) => branch.create("refs/heads/main", "abc"));
					assert.strictEqual((yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}")).ref, "refs/heads/main");
				}),
			);
		});
	}

	{
		const { script, base } = harness([alreadyExists]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("fails alreadyExists structurally", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.create("main", "abc")));
					assert.strictEqual(error.kind, "alreadyExists");
					assert.strictEqual(script.count(), 1);
				}),
			);
		});
	}

	{
		const { script, base } = harness([]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("refuses an empty branch name before any request", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.create("   ", "abc")));
					assert.strictEqual(error.kind, "rejected");
					assert.strictEqual(script.count(), 0, "no request may be issued for a nameless branch");
				}),
			);
		});
	}
});

describe("GitBranch.upsert", () => {
	{
		const { script, base } = harness([{ status: 201, body: {} }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("creates in one round trip when the branch is absent", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc"));
					assert.strictEqual(value, "created");
					assert.strictEqual(script.count(), 1, "the common case must not cost an existence check");
				}),
			);
		});
	}

	{
		const { script, base } = harness([alreadyExists, { status: 200, body: {} }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("resets in two when a concurrent creator won the race", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc"));
					assert.strictEqual(value, "reset");
					assert.strictEqual(script.count(), 2);
					assert.strictEqual(script.calls[1]?.method, "PATCH");
					assert.include(script.calls[1]?.path ?? "", "/git/refs/heads/main");
					// Reset, not "proceed": a creator that rooted the branch somewhere else
					// is corrected rather than inherited.
					assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}"), {
						sha: "abc",
						force: true,
					});
				}),
			);
		});
	}

	{
		const { script, base } = harness([
			{
				status: 422,
				body: {
					message: "Validation Failed",
					errors: [{ resource: "Reference", code: "already_exists", field: "ref" }],
				},
			},
			{ status: 200, body: {} },
		]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("resets when already-exists arrives only as a structured code", () =>
				Effect.gen(function* () {
					// GitHub's documented validation shape with no message anywhere but the
					// generic top-level one — the shape the releases endpoint answers with.
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc"));
					assert.strictEqual(value, "reset");
					assert.strictEqual(script.calls[1]?.method, "PATCH");
				}),
			);
		});
	}

	{
		const { script, base } = harness([{ status: 422, body: { message: "Object does not exist" } }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("does not recover from a failure that is not already-exists", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc")));
					assert.strictEqual(error.kind, "rejected");
					assert.strictEqual(script.count(), 1, "a genuine failure must not be retried as a reset");
				}),
			);
		});
	}

	{
		const { base } = harness([alreadyExists, { status: 403, body: { message: "protected branch" } }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("surfaces a failure of the recovery itself", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc")));
					assert.strictEqual(error.kind, "unauthorized");
				}),
			);
		});
	}
});

describe("GitBranch reads", () => {
	{
		const { script, base } = harness([ref("deadbeef")]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("sha returns the ref's object sha", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.sha("main"));
					assert.strictEqual(value, "deadbeef");
					assert.include(script.calls[0]?.path ?? "", "/git/ref/heads/main");
				}),
			);
		});
	}

	{
		const { base } = harness([notFound]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("sha fails notFound for a branch that is not there", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.sha("gone")));
					assert.strictEqual(error.kind, "notFound");
				}),
			);
		});
	}

	{
		const { base } = harness([notFound]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("shaOption degrades absence to none", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.shaOption("gone"));
					assertNone(value);
				}),
			);
		});
	}

	{
		const { base } = harness([notFound]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("exists answers false on a 404 rather than failing", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.exists("gone"));
					assert.isFalse(value);
				}),
			);
		});
	}

	{
		const { base } = harness([ref("abc")]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("exists answers true for a branch that resolves", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.exists("main"));
					assert.isTrue(value);
				}),
			);
		});
	}

	{
		const { base } = harness([{ status: 500, body: { message: "boom" } }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("exists still fails on a real error", () =>
				Effect.gen(function* () {
					// "Absent" is a 404 and nothing else — a 500 is not an answer.
					const error = yield* Effect.flip(Effect.flatMap(GitBranch, (branch) => branch.exists("main")));
					assert.strictEqual(error.kind, "transport");
				}),
			);
		});
	}
});

describe("GitBranch.delete", () => {
	{
		const { base } = harness([{ status: 204 }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("returns undefined after HTTP 204", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.delete("release/1.2"));
					assert.strictEqual(value, undefined);
				}),
			);
		});
	}

	{
		const { script, base } = harness([{ status: 204 }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("deletes the short ref", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitBranch, (branch) => branch.delete("release/1.2"));
					assert.strictEqual(script.calls[0]?.method, "DELETE");
					assert.include(script.calls[0]?.path ?? "", "/git/refs/heads/release/1.2");
				}),
			);
		});
	}
});

describe("the ManifestCommitter rewrite", () => {
	{
		const { script, base } = harness([{ status: 201, body: {} }]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("what took a 7-line comment and 4 round trips is one call", () =>
				Effect.gen(function* () {
					// Before: getSha -> exists -> create -> (on failure) exists -> reset,
					// with a comment explaining that re-checking existence was the only
					// robust way to tell a concurrent creator from a real failure.
					const value = yield* Effect.flatMap(GitBranch, (branch) => branch.upsert("chore/manifest", "abc"));
					assert.strictEqual(value, "created");
					assert.strictEqual(script.count(), 1);
				}),
			);
		});
	}
});

describe("Repo", () => {
	{
		const { script, base } = harness([ref("abc")]);
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("acts on the repository in context", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitBranch, (branch) => branch.sha("main"));
					assert.include(script.calls[0]?.path ?? "", "/repos/acme/widget/");
				}),
			);
		});
	}

	{
		const { script, base } = harness([ref("abc")]);
		const other = RepoRef.make({ owner: "other", repo: "thing" });
		it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("Repo.provide redirects a program at another repository", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitBranch, (branch) => branch.sha("main")).pipe(Repo.provide(other));
					// The multi-repository case silk-sync-action loops over.
					assert.include(script.calls[0]?.path ?? "", "/repos/other/thing/");
				}),
			);
		});
	}
});
