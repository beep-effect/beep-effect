// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { ArtifactMetadata, StorageRecordInput } from "../../effected/github/ArtifactMetadata.ts";
import { GitBranch } from "../../effected/github/GitBranch.ts";
import { TokenPermissions } from "../../effected/github/TokenPermissions.ts";
import { harness } from "./harness.ts";

describe("TokenPermissions", () => {
	const granted = TokenPermissions.fromGitHub({ contents: "write", metadata: "read", issues: "admin" });

	it("needs no layer, no client and no double", () => {
		// The point of demoting this from a service: the whole comparison is
		// reachable from a plain value. Its predecessor's test double
		// reimplemented the entire read<write<admin ranking.
		assert.deepStrictEqual({ ...granted.granted }, { contents: "write", metadata: "read", issues: "admin" });
	});

	it("ignores permission levels it does not recognize", () => {
		// GitHub adds levels over time; an unknown one on an unrelated permission
		// is not a reason to fail a comparison about a different permission.
		const odd = TokenPermissions.fromGitHub({ contents: "write", future_thing: "superuser" });
		assert.strictEqual(odd.granted.future_thing, undefined);
		assert.strictEqual(odd.granted.contents, "write");
	});

	it("is satisfied by an exact match", () => {
		assert.isTrue(granted.compare({ contents: "write", metadata: "read", issues: "admin" }).satisfied);
	});

	it("is satisfied by more access than asked for", () => {
		const result = granted.compare({ contents: "read" });
		assert.isTrue(result.satisfied);
		assert.isAbove(result.extra.length, 0);
	});

	it("reports a permission held too weakly", () => {
		const result = granted.compare({ metadata: "write" });
		assert.deepStrictEqual(
			result.missing.map((gap) => [gap.permission, gap.required, gap.granted]),
			[["metadata", "write", "read"]],
		);
	});

	it("reports a permission not held at all", () => {
		const result = granted.compare({ packages: "read" });
		assert.strictEqual(result.missing[0]?.permission, "packages");
		assert.strictEqual(result.missing[0]?.granted, undefined);
	});

	it("reports both over- and under-permission at once", () => {
		const result = granted.compare({ metadata: "write" });
		assert.isFalse(result.satisfied);
		assert.isFalse(result.exact);
		assert.isAbove(result.extra.length, 0);
	});

	it("ranks read below write below admin", () => {
		assert.isTrue(TokenPermissions.fromGitHub({ x: "admin" }).compare({ x: "write" }).satisfied);
		assert.isTrue(TokenPermissions.fromGitHub({ x: "write" }).compare({ x: "read" }).satisfied);
		assert.isFalse(TokenPermissions.fromGitHub({ x: "read" }).compare({ x: "write" }).satisfied);
	});

	it.effect("assertSufficient passes when nothing is missing", () => granted.assertSufficient({ contents: "write" }));

	it.effect("assertSufficient fails typed, carrying the comparison", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(granted.assertSufficient({ packages: "write" }));
			assert.strictEqual(error.kind, "insufficient");
			assert.strictEqual(error.result.missing[0]?.permission, "packages");
			assert.include(error.message, "packages:write");
		}),
	);

	it.effect("assertExact refuses a token that is broader than asked", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(granted.assertExact({ contents: "write" }));
			assert.strictEqual(error.kind, "excess");
		}),
	);

	it.effect("assertExact reports insufficiency before excess", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(granted.assertExact({ packages: "read" }));
			assert.strictEqual(error.kind, "insufficient");
		}),
	);

	it.effect("assertExact passes on an exact match", () =>
		granted.assertExact({ contents: "write", metadata: "read", issues: "admin" }),
	);
});

describe("ArtifactMetadata", () => {
	it.effect("posts the fields the endpoint actually accepts", () =>
		Effect.gen(function* () {
			const { script, base } = harness([{ status: 201, body: { storage_records: [{ id: 11 }, { id: 12 }] } }]);
			const ids = yield* Effect.provide(
				Effect.flatMap(ArtifactMetadata, (metadata) =>
					metadata.createStorageRecord(
						StorageRecordInput.make({
							name: "libfoo-1.2.3",
							digest: "sha256:abc",
							registryUrl: "https://reg.example.com/",
							repository: "bar/libfoo",
						}),
					),
				),
				ArtifactMetadata.layer.pipe(Layer.provideMerge(base)),
			);
			assert.deepStrictEqual([...ids], [11, 12]);
			// The organization comes from Repo's owner, like every other resource —
			// not from a positional argument.
			assert.include(script.calls[0]?.path ?? "", "/orgs/acme/artifacts/metadata/storage-record");
			const body = JSON.parse(script.calls[0]?.body ?? "{}");
			assert.deepStrictEqual(body, {
				name: "libfoo-1.2.3",
				digest: "sha256:abc",
				registry_url: "https://reg.example.com/",
				repository: "bar/libfoo",
			});
			// No `version` key: the endpoint has no such field, and the version this
			// replaces sent one.
			assert.notProperty(body, "version");
		}),
	);
});

describe("GitBranch.createLinked", () => {
	it.effect("sends the one mutation with no REST equivalent", () =>
		Effect.gen(function* () {
			const { script, base } = harness([{ status: 200, body: { data: { createLinkedBranch: {} } } }]);
			yield* Effect.provide(
				Effect.flatMap(GitBranch, (branch) =>
					branch.createLinked({
						issueNodeId: "I_1",
						repositoryNodeId: "R_1",
						name: "refs/heads/42-fix-thing",
						sha: "abc",
					}),
				),
				GitBranch.layer.pipe(Layer.provideMerge(base)),
			);
			const body = JSON.parse(script.calls[0]?.body ?? "{}");
			assert.include(body.query, "createLinkedBranch");
			assert.deepStrictEqual(body.variables, {
				issueId: "I_1",
				repositoryId: "R_1",
				// Normalized, so a caller passing the qualified form does not create
				// a branch literally named `refs/heads/...`.
				name: "42-fix-thing",
				oid: "abc",
			});
		}),
	);
});
