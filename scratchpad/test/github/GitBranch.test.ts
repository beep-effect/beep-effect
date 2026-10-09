// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
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

const run = Effect.fn("run")(function*<A, E>(replies: ReadonlyArray<Reply>, use: (branch: GitBranch["Service"]) => Effect.Effect<A, E, Repo>) {
		const { script, base } = harness(replies);
		const value = yield* Effect.provide(Effect.flatMap(GitBranch, use), GitBranch.layer.pipe(Layer.provideMerge(base)));
		return { value, script };
	});

describe("GitBranch.create", () => {
	it.effect("posts a full refs/heads ref", () =>
		Effect.gen(function* () {
			const { script } = yield* run([{ status: 201, body: {} }], (branch) => branch.create("release/1.2", "abc"));
			assert.strictEqual(script.calls[0]?.method, "POST");
			assert.include(script.calls[0]?.path ?? "", "/repos/acme/widget/git/refs");
			assert.deepStrictEqual((yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}")), {
				ref: "refs/heads/release/1.2",
				sha: "abc",
			});
		}),
	);

	it.effect("accepts a name the caller already qualified", () =>
		Effect.gen(function* () {
			// GitHub's own API is inconsistent about this, so callers pass whichever
			// form they last saw.
			const { script } = yield* run([{ status: 201, body: {} }], (branch) => branch.create("refs/heads/main", "abc"));
			assert.strictEqual((yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}")).ref, "refs/heads/main");
		}),
	);

	it.effect("fails alreadyExists structurally", () =>
		Effect.gen(function* () {
			const { script, base } = harness([alreadyExists]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.create("main", "abc")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "alreadyExists");
			assert.strictEqual(script.count(), 1);
		}),
	);

	it.effect("refuses an empty branch name before any request", () =>
		Effect.gen(function* () {
			const { script, base } = harness([]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.create("   ", "abc")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "rejected");
			assert.strictEqual(script.count(), 0, "no request may be issued for a nameless branch");
		}),
	);
});

describe("GitBranch.upsert", () => {
	it.effect("creates in one round trip when the branch is absent", () =>
		Effect.gen(function* () {
			const { value, script } = yield* run([{ status: 201, body: {} }], (branch) => branch.upsert("main", "abc"));
			assert.strictEqual(value, "created");
			assert.strictEqual(script.count(), 1, "the common case must not cost an existence check");
		}),
	);

	it.effect("resets in two when a concurrent creator won the race", () =>
		Effect.gen(function* () {
			const { value, script } = yield* run([alreadyExists, { status: 200, body: {} }], (branch) =>
				branch.upsert("main", "abc"),
			);
			assert.strictEqual(value, "reset");
			assert.strictEqual(script.count(), 2);
			assert.strictEqual(script.calls[1]?.method, "PATCH");
			assert.include(script.calls[1]?.path ?? "", "/git/refs/heads/main");
			// Reset, not "proceed": a creator that rooted the branch somewhere else
			// is corrected rather than inherited.
			assert.deepStrictEqual((yield* S.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}")), { sha: "abc", force: true });
		}),
	);

	it.effect("resets when already-exists arrives only as a structured code", () =>
		Effect.gen(function* () {
			// GitHub's documented validation shape with no message anywhere but the
			// generic top-level one — the shape the releases endpoint answers with.
			const { value, script } = yield* run(
				[
					{
						status: 422,
						body: {
							message: "Validation Failed",
							errors: [{ resource: "Reference", code: "already_exists", field: "ref" }],
						},
					},
					{ status: 200, body: {} },
				],
				(branch) => branch.upsert("main", "abc"),
			);
			assert.strictEqual(value, "reset");
			assert.strictEqual(script.calls[1]?.method, "PATCH");
		}),
	);

	it.effect("does not recover from a failure that is not already-exists", () =>
		Effect.gen(function* () {
			const { script, base } = harness([{ status: 422, body: { message: "Object does not exist" } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "rejected");
			assert.strictEqual(script.count(), 1, "a genuine failure must not be retried as a reset");
		}),
	);

	it.effect("surfaces a failure of the recovery itself", () =>
		Effect.gen(function* () {
			const { base } = harness([alreadyExists, { status: 403, body: { message: "protected branch" } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.upsert("main", "abc")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "unauthorized");
		}),
	);
});

describe("GitBranch reads", () => {
	it.effect("sha returns the ref's object sha", () =>
		Effect.gen(function* () {
			const { value, script } = yield* run([ref("deadbeef")], (branch) => branch.sha("main"));
			assert.strictEqual(value, "deadbeef");
			assert.include(script.calls[0]?.path ?? "", "/git/ref/heads/main");
		}),
	);

	it.effect("sha fails notFound for a branch that is not there", () =>
		Effect.gen(function* () {
			const { base } = harness([notFound]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.sha("gone")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "notFound");
		}),
	);

	it.effect("shaOption degrades absence to none", () =>
		Effect.gen(function* () {
			const { value } = yield* run([notFound], (branch) => branch.shaOption("gone"));
			assert.isTrue(O.isNone(value));
		}),
	);

	it.effect("exists answers false on a 404 rather than failing", () =>
		Effect.gen(function* () {
			const { value } = yield* run([notFound], (branch) => branch.exists("gone"));
			assert.isFalse(value);
		}),
	);

	it.effect("exists answers true for a branch that resolves", () =>
		Effect.gen(function* () {
			const { value } = yield* run([ref("abc")], (branch) => branch.exists("main"));
			assert.isTrue(value);
		}),
	);

	it.effect("exists still fails on a real error", () =>
		Effect.gen(function* () {
			// "Absent" is a 404 and nothing else — a 500 is not an answer.
			const { base } = harness([{ status: 500, body: { message: "boom" } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitBranch, (branch) => branch.exists("main")),
					GitBranch.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "transport");
		}),
	);
});

describe("GitBranch.delete", () => {
	it.effect("returns undefined after HTTP 204", () =>
		Effect.gen(function* () {
			const { value } = yield* run([{ status: 204 }], (branch) => branch.delete("release/1.2"));
			assert.strictEqual(value, undefined);
		}),
	);

	it.effect("deletes the short ref", () =>
		Effect.gen(function* () {
			const { script } = yield* run([{ status: 204 }], (branch) => branch.delete("release/1.2"));
			assert.strictEqual(script.calls[0]?.method, "DELETE");
			assert.include(script.calls[0]?.path ?? "", "/git/refs/heads/release/1.2");
		}),
	);
});

describe("the ManifestCommitter rewrite", () => {
	it.effect("what took a 7-line comment and 4 round trips is one call", () =>
		Effect.gen(function* () {
			// Before: getSha -> exists -> create -> (on failure) exists -> reset,
			// with a comment explaining that re-checking existence was the only
			// robust way to tell a concurrent creator from a real failure.
			const { value, script } = yield* run([{ status: 201, body: {} }], (branch) =>
				branch.upsert("chore/manifest", "abc"),
			);
			assert.strictEqual(value, "created");
			assert.strictEqual(script.count(), 1);
		}),
	);
});

describe("Repo", () => {
	it.effect("acts on the repository in context", () =>
		Effect.gen(function* () {
			const { script } = yield* run([ref("abc")], (branch) => branch.sha("main"));
			assert.include(script.calls[0]?.path ?? "", "/repos/acme/widget/");
		}),
	);

	it.effect("Repo.provide redirects a program at another repository", () =>
		Effect.gen(function* () {
			const { script, base } = harness([ref("abc")]);
			const other = RepoRef.make({ owner: "other", repo: "thing" });
			yield* Effect.provide(
				Effect.flatMap(GitBranch, (branch) => branch.sha("main")).pipe(Repo.provide(other)),
				GitBranch.layer.pipe(Layer.provideMerge(base)),
			);
			// The multi-repository case silk-sync-action loops over.
			assert.include(script.calls[0]?.path ?? "", "/repos/other/thing/");
		}),
	);
});
