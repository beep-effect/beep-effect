// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schema from "effect/Schema";
import { FileContent, FileDeletion, GitCommit } from "../../effected/github/GitCommit.ts";
import type { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GitHubCommit } from "../../effected/github/GitHubCommit.ts";
import { GitHubContent } from "../../effected/github/GitHubContent.ts";
import { GitHubRepository } from "../../effected/github/GitHubRepository.ts";
import { GitTag, versionFromTag } from "../../effected/github/GitTag.ts";
import type { Repo } from "../../effected/github/Repo.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import type { Reply } from "./fixtures.ts";
import { linkNext } from "./fixtures.ts";
import { harness } from "./harness.ts";

const JsonObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

/**
 * Run a resource against scripted HTTP, handing back the value and the recording.
 *
 * @remarks
 * Every resource layer has the same shape — it needs a `GitHubClient` and
 * nothing else, and its methods need a `Repo` — so one helper serves them all
 * with no casts.
 */
const drive = Effect.fn("drive")(function*<I, S, A, E>(
	replies: ReadonlyArray<Reply>,
	service: { readonly layer: Layer.Layer<I, never, GitHubClient> },
	tag: Effect.Effect<S, never, I>,
	use: (resource: S) => Effect.Effect<A, E, Repo>,
) {
		const { script, base } = harness(replies);
		const value = yield* Effect.provide(Effect.flatMap(tag, use), service.layer.pipe(Layer.provideMerge(base)));
		return { value, script };
	});

describe("GitCommit", () => {
	it.effect("reads a commit's sha, tree and parents", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[{ status: 200, body: { sha: "c1", tree: { sha: "t1" }, parents: [{ sha: "p1" }, { sha: "p2" }] } }],
				GitCommit,
				GitCommit,
				(commit) => commit.get("c1"),
			);
			// The treeSha two consumers each wrote eight lines of cast to reach.
			assert.strictEqual(value.treeSha, "t1");
			assert.deepStrictEqual([...value.parents], ["p1", "p2"]);
			assert.include(script.calls[0]?.path ?? "", "/git/commits/c1");
		}),
	);

	it.effect("builds a tree with contents and deletions", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([{ status: 201, body: { sha: "t2" } }], GitCommit, GitCommit, (commit) =>
				commit.createTree({
					changes: [
						FileContent.make({ path: "a.txt", content: "hello" }),
						FileDeletion.make({ path: "gone.txt" }),
						FileContent.make({ path: "run.sh", content: "#!/bin/sh", mode: "100755" }),
					],
					baseTree: "t1",
				}),
			);
			const body = (yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"));
			assert.strictEqual(body.base_tree, "t1");
			assert.deepStrictEqual(body.tree, [
				{ path: "a.txt", mode: "100644", type: "blob", content: "hello" },
				// A null sha is how the Git Database API spells a removal.
				{ path: "gone.txt", mode: "100644", type: "blob", sha: null },
				{ path: "run.sh", mode: "100755", type: "blob", content: "#!/bin/sh" },
			]);
		}),
	);

	it.effect("commitFiles walks ref, commit, tree, commit, ref", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{ status: 200, body: { object: { sha: "head", type: "commit" } } },
					{ status: 200, body: { sha: "head", tree: { sha: "headtree" }, parents: [] } },
					{ status: 201, body: { sha: "newtree" } },
					{ status: 201, body: { sha: "newcommit" } },
					{ status: 200, body: {} },
				],
				GitCommit,
				GitCommit,
				(commit) =>
					commit.commitFiles({
						branch: "main",
						message: "chore: update",
						changes: [FileContent.make({ path: "a.txt", content: "x" })],
					}),
			);
			assert.strictEqual(value, "newcommit");
			assert.strictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[2]?.body ?? "{}")).base_tree, "headtree");
			assert.deepStrictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[3]?.body ?? "{}")).parents, ["head"]);
			// Not forced: a branch that moved underneath you is a conflict worth
			// hearing about.
			assert.deepStrictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[4]?.body ?? "{}")), { sha: "newcommit", force: false });
		}),
	);
});

describe("GitTag", () => {
	const tags = (names: ReadonlyArray<string>, next?: string): Reply => ({
		status: 200,
		body: names.map((name) => ({ name, commit: { sha: `sha-${name}` } })),
		...(next !== undefined ? { headers: linkNext(next) } : {}),
	});

	it.effect("lists tags and filters by prefix client-side", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([tags(["pkg-a@v1.0.0", "pkg-b@v2.0.0"])], GitTag, GitTag, (tag) =>
				tag.list({ prefix: "pkg-a" }),
			);
			assert.lengthOf(value, 1);
			assert.strictEqual(value[0]?.tag, "pkg-a@v1.0.0");
			assert.strictEqual(value[0]?.sha, "sha-pkg-a@v1.0.0");
		}),
	);

	it.effect("upsert creates, then resets on already-exists", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
				[
					{ status: 422, body: { message: "Reference already exists" } },
					{ status: 200, body: {} },
				],
				GitTag,
				GitTag,
				(tag) => tag.upsert("v1.0.0", "abc"),
			);
			assert.strictEqual(script.calls[1]?.method, "PATCH");
			assert.include(script.calls[1]?.path ?? "", "/git/refs/tags/v1.0.0");
		}),
	);

	it.effect("upsert resets when already-exists arrives only as a structured code", () =>
		Effect.gen(function* () {
			const { script } = yield* drive(
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
				GitTag,
				GitTag,
				(tag) => tag.upsert("v1.0.0", "abc"),
			);
			assert.strictEqual(script.calls[1]?.method, "PATCH");
			assert.include(script.calls[1]?.path ?? "", "/git/refs/tags/v1.0.0");
		}),
	);

	it.effect("resolve dereferences an annotated tag", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[
					{ status: 200, body: { object: { sha: "tagobj", type: "tag" } } },
					{ status: 200, body: { object: { sha: "commit1", type: "commit" } } },
				],
				GitTag,
				GitTag,
				(tag) => tag.resolve("v1.0.0"),
			);
			assert.strictEqual(value, "commit1");
		}),
	);

	it.effect("resolve refuses a tag that nests too deep rather than looping", () =>
		Effect.gen(function* () {
			const { script, base } = harness([{ status: 200, body: { object: { sha: "t", type: "tag" } } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitTag, (tag) => tag.resolve("v1.0.0")),
					GitTag.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.strictEqual(error.kind, "rejected");
			assert.include(error.reason, "deeper than 5");
			assert.strictEqual(script.count(), 6, "one ref read plus five peels, then it stops");
		}),
	);

	it.effect("latestSemver picks the newest release across pages", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[
					tags(["v1.0.0", "v1.10.0"], "https://api.github.com/repositories/1/tags?page=2"),
					tags(["v1.9.0", "not-a-version"]),
				],
				GitTag,
				GitTag,
				(tag) => tag.latestSemver(),
			);
			// 1.10.0 > 1.9.0 — the comparison is semver's, not the string's.
			assert.strictEqual(O.getOrThrow(value).tag, "v1.10.0");
		}),
	);

	it.effect("latestSemver skips prereleases by default", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([tags(["v1.0.0", "v2.0.0-rc.1"])], GitTag, GitTag, (tag) => tag.latestSemver());
			assert.strictEqual(O.getOrThrow(value).tag, "v1.0.0");
		}),
	);

	it.effect("latestSemver can include prereleases", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([tags(["v1.0.0", "v2.0.0-rc.1"])], GitTag, GitTag, (tag) =>
				tag.latestSemver({ includePrerelease: true }),
			);
			assert.strictEqual(O.getOrThrow(value).tag, "v2.0.0-rc.1");
		}),
	);

	it.effect("latestSemver reads scoped package tags", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([tags(["@scope/pkg@1.2.3", "@scope/pkg@1.3.0"])], GitTag, GitTag, (tag) =>
				tag.latestSemver({ prefix: "@scope/pkg@" }),
			);
			assert.strictEqual(O.getOrThrow(value).version.minor, 3);
		}),
	);

	it.effect("latestSemver is none when nothing is version-shaped", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([tags(["nightly", "latest"])], GitTag, GitTag, (tag) => tag.latestSemver());
			assert.isTrue(O.isNone(value));
		}),
	);
});

describe("versionFromTag", () => {
	it("reads the three tag shapes the kit cuts", () => {
		assert.deepStrictEqual(versionFromTag("v1.2.3"), O.some("1.2.3"));
		assert.deepStrictEqual(versionFromTag("pkg@v1.2.3"), O.some("1.2.3"));
		assert.deepStrictEqual(versionFromTag("@scope/pkg@1.2.3"), O.some("1.2.3"));
	});

	it("takes the LAST @, so a scope does not confuse it", () => {
		assert.deepStrictEqual(versionFromTag("@a/b@2.0.0"), O.some("2.0.0"));
	});

	it("has nothing to say about an empty name", () => {
		assert.isTrue(O.isNone(versionFromTag("v")));
	});
});

describe("GitHubRepository", () => {
	const repository: Reply = {
		status: 200,
		body: { default_branch: "trunk", node_id: "R_kg1", allow_auto_merge: true, name: "widget" },
	};

	it.effect("defaultBranch is one expression", () =>
		Effect.gen(function* () {
			// Before: an eight-line hand-written octokit interface plus eleven lines
			// of code, to read one string.
			const { value } = yield* drive([repository], GitHubRepository, GitHubRepository, (repo) => repo.defaultBranch);
			assert.strictEqual(value, "trunk");
		}),
	);

	it.effect("nodeId reads the GraphQL id the mutations need", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([repository], GitHubRepository, GitHubRepository, (repo) => repo.nodeId);
			assert.strictEqual(value, "R_kg1");
		}),
	);

	it.effect("settings hands back the faithful payload, not a re-declaration", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([repository], GitHubRepository, GitHubRepository, (repo) => repo.settings);
			// Typed straight off the OpenAPI description — the sixteen fields one
			// consumer re-declared by hand are all here already.
			assert.strictEqual(value.allow_auto_merge, true);
			assert.strictEqual(value.name, "widget");
		}),
	);

	it.effect("updateSettings PATCHes the coordinate in", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([repository], GitHubRepository, GitHubRepository, (repo) =>
				repo.updateSettings({ allow_auto_merge: false }),
			);
			assert.strictEqual(script.calls[0]?.method, "PATCH");
			assert.deepStrictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}")), { allow_auto_merge: false });
		}),
	);
});

describe("GitHubContent", () => {
	const file = (content: string, encoding = "base64"): Reply => ({
		status: 200,
		body: { type: "file", encoding, content: Buffer.from(content).toString("base64"), name: "f", path: "f" },
	});

	it.effect("decodes a base64 file", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([file("hello\n")], GitHubContent, GitHubContent, (content) =>
				content.getFile("README.md"),
			);
			assert.strictEqual(value, "hello\n");
		}),
	);

	it.effect("passes a ref through", () =>
		Effect.gen(function* () {
			const { script } = yield* drive([file("x")], GitHubContent, GitHubContent, (content) =>
				content.getFile("a.txt", { ref: "v1.0.0" }),
			);
			assert.strictEqual(script.queryOf(0).get("ref"), "v1.0.0");
		}),
	);

	it.effect("refuses a directory rather than reading it as a file", () =>
		Effect.gen(function* () {
			const { base } = harness([{ status: 200, body: [{ type: "file", name: "a" }] }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitHubContent, (content) => content.getFile("src")),
					GitHubContent.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.include(error.reason, "directory");
		}),
	);

	it.effect("refuses a non-base64 encoding rather than decoding garbage", () =>
		Effect.gen(function* () {
			// Over ~1MB GitHub answers `encoding: "none"` with an empty body, which
			// base64-decodes to an empty string indistinguishable from an empty file.
			const { base } = harness([{ status: 200, body: { type: "file", encoding: "none", content: "" } }]);
			const error = yield* Effect.flip(
				Effect.provide(
					Effect.flatMap(GitHubContent, (content) => content.getFile("big.bin")),
					GitHubContent.layer.pipe(Layer.provideMerge(base)),
				),
			);
			assert.include(error.reason, "too large");
		}),
	);

	it.effect("getFileOption reads absence as none", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 404, body: { message: "Not Found" } }],
				GitHubContent,
				GitHubContent,
				(content) => content.getFileOption("missing.md"),
			);
			assert.isTrue(O.isNone(value));
		}),
	);
});

describe("GitHubCommit", () => {
	const commit = (sha: string, extra: Record<string, unknown> = {}) => ({
		sha,
		html_url: `https://github.com/acme/widget/commit/${sha}`,
		commit: { message: `subject for ${sha}\n\nbody`, author: { name: "Ada" } },
		author: { login: "ada" },
		parents: [{ sha: `parent-of-${sha}` }],
		...extra,
	});

	it.effect("projects a commit to the fields callers read", () =>
		Effect.gen(function* () {
			const { value } = yield* drive([{ status: 200, body: commit("c1") }], GitHubCommit, GitHubCommit, (commits) =>
				commits.get("c1"),
			);
			assert.strictEqual(value.sha, "c1");
			assert.strictEqual(value.author, "Ada");
			assert.strictEqual(value.authorLogin, "ada");
			assert.strictEqual(value.subject, "subject for c1");
			assert.deepStrictEqual([...value.parents], ["parent-of-c1"]);
		}),
	);

	it.effect("carries every parent of a merge commit, in order", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 200, body: commit("m1", { parents: [{ sha: "p1" }, { sha: "p2" }] }) }],
				GitHubCommit,
				GitHubCommit,
				(commits) => commits.get("m1"),
			);
			assert.deepStrictEqual([...value.parents], ["p1", "p2"]);
		}),
	);

	it.effect("survives a commit GitHub cannot attribute", () =>
		Effect.gen(function* () {
			// GitHub sends an empty object, not null, for an unattributed author.
			const { value } = yield* drive(
				[{ status: 200, body: { ...commit("c1"), author: {}, commit: { message: "m", author: null } } }],
				GitHubCommit,
				GitHubCommit,
				(commits) => commits.get("c1"),
			);
			assert.strictEqual(value.author, "Unknown");
			assert.strictEqual(value.authorLogin, undefined);
		}),
	);

	it.effect("compare projects status, counts, commits and files", () =>
		Effect.gen(function* () {
			const { value, script } = yield* drive(
				[
					{
						status: 200,
						body: {
							status: "ahead",
							ahead_by: 2,
							behind_by: 0,
							commits: [commit("c1"), commit("c2")],
							files: [
								{ filename: "a.txt", status: "modified", additions: 1, deletions: 2 },
								{ filename: "new.txt", status: "renamed", additions: 0, deletions: 0, previous_filename: "old.txt" },
							],
						},
					},
				],
				GitHubCommit,
				GitHubCommit,
				(commits) => commits.compare("main", "feature"),
			);
			assert.strictEqual(value.aheadBy, 2);
			assert.lengthOf(value.commits, 2);
			assert.strictEqual(value.files[1]?.previousPath, "old.txt");
			assert.include(script.calls[0]?.path ?? "", "/compare/main...feature");
		}),
	);

	it.effect("compare rejects an unknown file status through GitHubError", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 200, body: {
					status: "ahead", ahead_by: 1, behind_by: 0, commits: [commit("c1")],
					files: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }],
				} }],
				GitHubCommit, GitHubCommit,
				(commits) => Effect.flip(commits.compare("main", "feature")),
			);
			assert.instanceOf(value, GitHubError);
			assert.strictEqual(value.kind, "decode");
			assert.strictEqual(value.operation, "GitHubCommit.compare");
			assert.isDefined(value.cause);
		}),
	);

	it.effect("changedFiles rejects an unknown file status through GitHubError", () =>
		Effect.gen(function* () {
			const { value } = yield* drive(
				[{ status: 200, body: commit("c1", {
					files: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }],
				}) }],
				GitHubCommit, GitHubCommit,
				(commits) => Effect.flip(commits.changedFiles("c1")),
			);
			assert.instanceOf(value, GitHubError);
			assert.strictEqual(value.kind, "decode");
			assert.strictEqual(value.operation, "GitHubCommit.changedFiles");
			assert.isDefined(value.cause);
		}),
	);

	it.effect("changedFiles pages BY FILE through the shared engine", () =>
		Effect.gen(function* () {
			const page = (names: ReadonlyArray<string>) => ({
				status: 200,
				body: {
					...commit("c1"),
					files: names.map((filename) => ({ filename, status: "modified", additions: 1, deletions: 0 })),
				},
			});
			const { value, script } = yield* drive([page(["a", "b"]), page(["c"])], GitHubCommit, GitHubCommit, (commits) =>
				commits.changedFiles("c1", { page: PageOptions.make({ perPage: 2 }) }),
			);
			assert.deepStrictEqual(
				value.map((file) => file.path),
				["a", "b", "c"],
			);
			assert.strictEqual(script.queryOf(0).get("page"), "1");
			assert.strictEqual(script.queryOf(1).get("page"), "2");
		}),
	);

	it.effect("changedFiles honors a page budget", () =>
		Effect.gen(function* () {
			const page = (names: ReadonlyArray<string>) => ({
				status: 200,
				body: {
					...commit("c1"),
					files: names.map((filename) => ({ filename, status: "modified", additions: 1, deletions: 0 })),
				},
			});
			const { value, script } = yield* drive(
				[page(["a", "b"]), page(["c", "d"])],
				GitHubCommit,
				GitHubCommit,
				(commits) => commits.changedFiles("c1", { page: PageOptions.make({ perPage: 2, maxPages: 1 }) }),
			);
			assert.lengthOf(value, 2);
			assert.strictEqual(script.count(), 1);
		}),
	);
});
