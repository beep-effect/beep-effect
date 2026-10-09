import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Schema from "effect/Schema";
import { FileContent, FileDeletion, GitCommit } from "../../effected/github/GitCommit.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { GitHubCommit } from "../../effected/github/GitHubCommit.ts";
import { GitHubContent } from "../../effected/github/GitHubContent.ts";
import { GitHubRepository } from "../../effected/github/GitHubRepository.ts";
import { GitTag, versionFromTag } from "../../effected/github/GitTag.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import type { Reply } from "./fixtures.ts";
import { linkNext } from "./fixtures.ts";
import { harness } from "./harness.ts";

const JsonObject = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

describe("GitCommit", () => {
	{
		const { script, base } = harness([
			{ status: 200, body: { sha: "c1", tree: { sha: "t1" }, parents: [{ sha: "p1" }, { sha: "p2" }] } },
		]);
		it.layer(GitCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("reads a commit's sha, tree and parents", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitCommit, (commit) => commit.get("c1"));
					// The treeSha two consumers each wrote eight lines of cast to reach.
					assert.strictEqual(value.treeSha, "t1");
					assert.deepStrictEqual([...value.parents], ["p1", "p2"]);
					assert.include(script.calls[0]?.path ?? "", "/git/commits/c1");
				}),
			);
		});
	}

	{
		const { script, base } = harness([{ status: 201, body: { sha: "t2" } }]);
		it.layer(GitCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("builds a tree with contents and deletions", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitCommit, (commit) =>
						commit.createTree({
							changes: [
								FileContent.make({ path: "a.txt", content: "hello" }),
								FileDeletion.make({ path: "gone.txt" }),
								FileContent.make({ path: "run.sh", content: "#!/bin/sh", mode: "100755" }),
							],
							baseTree: "t1",
						}),
					);
					const body = yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}");
					assert.strictEqual(body.base_tree, "t1");
					assert.deepStrictEqual(body.tree, [
						{ path: "a.txt", mode: "100644", type: "blob", content: "hello" },
						// A null sha is how the Git Database API spells a removal.
						{ path: "gone.txt", mode: "100644", type: "blob", sha: null },
						{ path: "run.sh", mode: "100755", type: "blob", content: "#!/bin/sh" },
					]);
				}),
			);
		});
	}

	{
		const { script, base } = harness([
			{ status: 200, body: { object: { sha: "head", type: "commit" } } },
			{ status: 200, body: { sha: "head", tree: { sha: "headtree" }, parents: [] } },
			{ status: 201, body: { sha: "newtree" } },
			{ status: 201, body: { sha: "newcommit" } },
			{ status: 200, body: {} },
		]);
		it.layer(GitCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("commitFiles walks ref, commit, tree, commit, ref", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitCommit, (commit) =>
						commit.commitFiles({
							branch: "main",
							message: "chore: update",
							changes: [FileContent.make({ path: "a.txt", content: "x" })],
						}),
					);
					assert.strictEqual(value, "newcommit");
					assert.strictEqual(
						(yield* Schema.decodeEffect(JsonObject)(script.calls[2]?.body ?? "{}")).base_tree,
						"headtree",
					);
					assert.deepStrictEqual((yield* Schema.decodeEffect(JsonObject)(script.calls[3]?.body ?? "{}")).parents, [
						"head",
					]);
					// Not forced: a branch that moved underneath you is a conflict worth
					// hearing about.
					assert.deepStrictEqual(yield* Schema.decodeEffect(JsonObject)(script.calls[4]?.body ?? "{}"), {
						sha: "newcommit",
						force: false,
					});
				}),
			);
		});
	}
});

describe("GitTag", () => {
	const tags = (names: ReadonlyArray<string>, next?: string): Reply => ({
		status: 200,
		body: names.map((name) => ({ name, commit: { sha: `sha-${name}` } })),
		...(next !== undefined ? { headers: linkNext(next) } : {}),
	});

	{
		const { base } = harness([tags(["pkg-a@v1.0.0", "pkg-b@v2.0.0"])]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("lists tags and filters by prefix client-side", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.list({ prefix: "pkg-a" }));
					assert.lengthOf(value, 1);
					assert.strictEqual(value[0]?.tag, "pkg-a@v1.0.0");
					assert.strictEqual(value[0]?.sha, "sha-pkg-a@v1.0.0");
				}),
			);
		});
	}

	{
		const { script, base } = harness([
			{ status: 422, body: { message: "Reference already exists" } },
			{ status: 200, body: {} },
		]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("upsert creates, then resets on already-exists", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitTag, (tag) => tag.upsert("v1.0.0", "abc"));
					assert.strictEqual(script.calls[1]?.method, "PATCH");
					assert.include(script.calls[1]?.path ?? "", "/git/refs/tags/v1.0.0");
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
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("upsert resets when already-exists arrives only as a structured code", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitTag, (tag) => tag.upsert("v1.0.0", "abc"));
					assert.strictEqual(script.calls[1]?.method, "PATCH");
					assert.include(script.calls[1]?.path ?? "", "/git/refs/tags/v1.0.0");
				}),
			);
		});
	}

	{
		const { base } = harness([
			{ status: 200, body: { object: { sha: "tagobj", type: "tag" } } },
			{ status: 200, body: { object: { sha: "commit1", type: "commit" } } },
		]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("resolve dereferences an annotated tag", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.resolve("v1.0.0"));
					assert.strictEqual(value, "commit1");
				}),
			);
		});
	}

	{
		const { script, base } = harness([{ status: 200, body: { object: { sha: "t", type: "tag" } } }]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("resolve refuses a tag that nests too deep rather than looping", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitTag, (tag) => tag.resolve("v1.0.0")));
					assert.strictEqual(error.kind, "rejected");
					assert.include(error.reason, "deeper than 5");
					assert.strictEqual(script.count(), 6, "one ref read plus five peels, then it stops");
				}),
			);
		});
	}

	{
		const { base } = harness([
			tags(["v1.0.0", "v1.10.0"], "https://api.github.com/repositories/1/tags?page=2"),
			tags(["v1.9.0", "not-a-version"]),
		]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("latestSemver picks the newest release across pages", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.latestSemver());
					// 1.10.0 > 1.9.0 — the comparison is semver's, not the string's.
					assert.strictEqual(O.getOrThrow(value).tag, "v1.10.0");
				}),
			);
		});
	}

	{
		const { base } = harness([tags(["v1.0.0", "v2.0.0-rc.1"])]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("latestSemver skips prereleases by default", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.latestSemver());
					assert.strictEqual(O.getOrThrow(value).tag, "v1.0.0");
				}),
			);
		});
	}

	{
		const { base } = harness([tags(["v1.0.0", "v2.0.0-rc.1"])]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("latestSemver can include prereleases", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.latestSemver({ includePrerelease: true }));
					assert.strictEqual(O.getOrThrow(value).tag, "v2.0.0-rc.1");
				}),
			);
		});
	}

	{
		const { base } = harness([tags(["@scope/pkg@1.2.3", "@scope/pkg@1.3.0"])]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("latestSemver reads scoped package tags", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.latestSemver({ prefix: "@scope/pkg@" }));
					assert.strictEqual(O.getOrThrow(value).version.minor, 3);
				}),
			);
		});
	}

	{
		const { base } = harness([tags(["nightly", "latest"])]);
		it.layer(GitTag.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("latestSemver is none when nothing is version-shaped", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitTag, (tag) => tag.latestSemver());
					assertNone(value);
				}),
			);
		});
	}
});

describe("versionFromTag", () => {
	it("reads the three tag shapes the kit cuts", () => {
		assertSome(versionFromTag("v1.2.3"), "1.2.3");
		assertSome(versionFromTag("pkg@v1.2.3"), "1.2.3");
		assertSome(versionFromTag("@scope/pkg@1.2.3"), "1.2.3");
	});

	it("takes the LAST @, so a scope does not confuse it", () => {
		assertSome(versionFromTag("@a/b@2.0.0"), "2.0.0");
	});

	it("has nothing to say about an empty name", () => {
		assertNone(versionFromTag("v"));
	});
});

describe("GitHubRepository", () => {
	const repository: Reply = {
		status: 200,
		body: { default_branch: "trunk", node_id: "R_kg1", allow_auto_merge: true, name: "widget" },
	};

	{
		const { base } = harness([repository]);
		it.layer(GitHubRepository.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("defaultBranch is one expression", () =>
				Effect.gen(function* () {
					// Before: an eight-line hand-written octokit interface plus eleven lines
					// of code, to read one string.
					const value = yield* Effect.flatMap(GitHubRepository, (repo) => repo.defaultBranch);
					assert.strictEqual(value, "trunk");
				}),
			);
		});
	}

	{
		const { base } = harness([repository]);
		it.layer(GitHubRepository.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("nodeId reads the GraphQL id the mutations need", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubRepository, (repo) => repo.nodeId);
					assert.strictEqual(value, "R_kg1");
				}),
			);
		});
	}

	{
		const { base } = harness([repository]);
		it.layer(GitHubRepository.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("settings hands back the faithful payload, not a re-declaration", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubRepository, (repo) => repo.settings);
					// Typed straight off the OpenAPI description — the sixteen fields one
					// consumer re-declared by hand are all here already.
					assert.strictEqual(value.allow_auto_merge, true);
					assert.strictEqual(value.name, "widget");
				}),
			);
		});
	}

	{
		const { script, base } = harness([repository]);
		it.layer(GitHubRepository.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("updateSettings PATCHes the coordinate in", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitHubRepository, (repo) => repo.updateSettings({ allow_auto_merge: false }));
					assert.strictEqual(script.calls[0]?.method, "PATCH");
					assert.deepStrictEqual(yield* Schema.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"), {
						allow_auto_merge: false,
					});
				}),
			);
		});
	}
});

describe("GitHubContent", () => {
	const file = (content: string, encoding = "base64"): Reply => ({
		status: 200,
		body: { type: "file", encoding, content: Buffer.from(content).toString("base64"), name: "f", path: "f" },
	});

	{
		const { base } = harness([file("hello\n")]);
		it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("decodes a base64 file", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubContent, (content) => content.getFile("README.md"));
					assert.strictEqual(value, "hello\n");
				}),
			);
		});
	}

	{
		const { script, base } = harness([file("x")]);
		it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("passes a ref through", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(GitHubContent, (content) => content.getFile("a.txt", { ref: "v1.0.0" }));
					assert.strictEqual(script.queryOf(0).get("ref"), "v1.0.0");
				}),
			);
		});
	}

	{
		const { base } = harness([{ status: 200, body: [{ type: "file", name: "a" }] }]);
		it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("refuses a directory rather than reading it as a file", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitHubContent, (content) => content.getFile("src")));
					assert.include(error.reason, "directory");
				}),
			);
		});
	}

	{
		const { base } = harness([{ status: 200, body: { type: "file", encoding: "none", content: "" } }]);
		it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("refuses a non-base64 encoding rather than decoding garbage", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(GitHubContent, (content) => content.getFile("big.bin")));
					assert.include(error.reason, "too large");
				}),
			);
		});
	}

	{
		const { base } = harness([{ status: 404, body: { message: "Not Found" } }]);
		it.layer(GitHubContent.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("getFileOption reads absence as none", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubContent, (content) => content.getFileOption("missing.md"));
					assertNone(value);
				}),
			);
		});
	}
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

	{
		const { base } = harness([{ status: 200, body: commit("c1") }]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("projects a commit to the fields callers read", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) => commits.get("c1"));
					assert.strictEqual(value.sha, "c1");
					assert.strictEqual(value.author, "Ada");
					assert.strictEqual(value.authorLogin, "ada");
					assert.strictEqual(value.subject, "subject for c1");
					assert.deepStrictEqual([...value.parents], ["parent-of-c1"]);
				}),
			);
		});
	}

	{
		const { base } = harness([{ status: 200, body: commit("m1", { parents: [{ sha: "p1" }, { sha: "p2" }] }) }]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("carries every parent of a merge commit, in order", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) => commits.get("m1"));
					assert.deepStrictEqual([...value.parents], ["p1", "p2"]);
				}),
			);
		});
	}

	{
		const { base } = harness([
			{ status: 200, body: { ...commit("c1"), author: {}, commit: { message: "m", author: null } } },
		]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("survives a commit GitHub cannot attribute", () =>
				Effect.gen(function* () {
					// GitHub sends an empty object, not null, for an unattributed author.
					const value = yield* Effect.flatMap(GitHubCommit, (commits) => commits.get("c1"));
					assert.strictEqual(value.author, "Unknown");
					assert.strictEqual(value.authorLogin, undefined);
				}),
			);
		});
	}

	{
		const { script, base } = harness([
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
		]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("compare projects status, counts, commits and files", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) => commits.compare("main", "feature"));
					assert.strictEqual(value.aheadBy, 2);
					assert.lengthOf(value.commits, 2);
					assert.strictEqual(value.files[1]?.previousPath, "old.txt");
					assert.include(script.calls[0]?.path ?? "", "/compare/main...feature");
				}),
			);
		});
	}

	{
		const { base } = harness([
			{
				status: 200,
				body: {
					status: "ahead",
					ahead_by: 1,
					behind_by: 0,
					commits: [commit("c1")],
					files: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }],
				},
			},
		]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("compare rejects an unknown file status through GitHubError", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) =>
						Effect.flip(commits.compare("main", "feature")),
					);
					assert.instanceOf(value, GitHubError);
					assert.strictEqual(value.kind, "decode");
					assert.strictEqual(value.operation, "GitHubCommit.compare");
					assert.isDefined(value.cause);
				}),
			);
		});
	}

	{
		const { base } = harness([
			{
				status: 200,
				body: commit("c1", {
					files: [{ filename: "a.txt", status: "future_status", additions: 1, deletions: 0 }],
				}),
			},
		]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("changedFiles rejects an unknown file status through GitHubError", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) => Effect.flip(commits.changedFiles("c1")));
					assert.instanceOf(value, GitHubError);
					assert.strictEqual(value.kind, "decode");
					assert.strictEqual(value.operation, "GitHubCommit.changedFiles");
					assert.isDefined(value.cause);
				}),
			);
		});
	}

	{
		const page = (names: ReadonlyArray<string>) => ({
			status: 200,
			body: {
				...commit("c1"),
				files: names.map((filename) => ({ filename, status: "modified", additions: 1, deletions: 0 })),
			},
		});
		const { script, base } = harness([page(["a", "b"]), page(["c"])]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("changedFiles pages BY FILE through the shared engine", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) =>
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
		});
	}

	{
		const page = (names: ReadonlyArray<string>) => ({
			status: 200,
			body: {
				...commit("c1"),
				files: names.map((filename) => ({ filename, status: "modified", additions: 1, deletions: 0 })),
			},
		});
		const { script, base } = harness([page(["a", "b"]), page(["c", "d"])]);
		it.layer(GitHubCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("changedFiles honors a page budget", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(GitHubCommit, (commits) =>
						commits.changedFiles("c1", { page: PageOptions.make({ perPage: 2, maxPages: 1 }) }),
					);
					assert.lengthOf(value, 2);
					assert.strictEqual(script.count(), 1);
				}),
			);
		});
	}
});
