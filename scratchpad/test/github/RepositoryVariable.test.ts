import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { harness } from "./harness.ts";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import { variableFixture } from "./fixtures.ts";
import type { GitHubFixtures, RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { GitHubError } from "../../effected/github/GitHubError.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import * as S from "effect/Schema";
import { RepositoryVariable, VariableInfo } from "../../effected/github/RepositoryVariable.ts";

const decodeVariableInfos = S.decodeResult(S.Array(VariableInfo));

const run = Effect.fn("run")(function*<A, E>(
	effect: Effect.Effect<A, E, RepositoryVariable | GitHubClient | Repo>,
	request: NonNullable<GitHubFixtures["request"]>,
	paginate: NonNullable<GitHubFixtures["paginate"]> = {},
) {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(RepositoryVariable.layer),
			Effect.provide(GitHubClient.layerFixture({ request, paginate, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested, routes: requested.map((c) => c.route) };
	});

describe("RepositoryVariable.set", () => {
	it.effect("PATCHes an existing variable", () =>
		Effect.gen(function* () {
			const { requested, routes } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.set("NODE_ENV", "production")),
				{
					"GET /repos/{owner}/{repo}/actions/variables/{name}": Result.succeed(variableFixture({ name: "NODE_ENV", value: "old" })),
					"PATCH /repos/{owner}/{repo}/actions/variables/{name}": Result.succeed(""),
				},
			);

			// GitHub has no upsert: the read is what decides the verb. It is a
			// by-NAME read, so the cost does not grow with the repository.
			assert.deepStrictEqual(routes, [
				"GET /repos/{owner}/{repo}/actions/variables/{name}",
				"PATCH /repos/{owner}/{repo}/actions/variables/{name}",
			]);
			assert.deepStrictEqual(requested[1]?.params, {
				owner: "acme",
				repo: "widget",
				name: "NODE_ENV",
				value: "production",
			});
		}),
	);

	it.effect("POSTs a new variable", () =>
		Effect.gen(function* () {
			const { requested, routes } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.set("NODE_ENV", "production")),
				{
					// Absent is a 404 from GitHub, stubbed as the response rather than
					// by leaving the route unwired — absence would mean "unstubbed".
					"GET /repos/{owner}/{repo}/actions/variables/{name}": Result.fail(GitHubError.notFound("read", "NODE_ENV")),
					"POST /repos/{owner}/{repo}/actions/variables": Result.succeed({}),
				},
			);

			assert.deepStrictEqual(routes, [
				"GET /repos/{owner}/{repo}/actions/variables/{name}",
				"POST /repos/{owner}/{repo}/actions/variables",
			]);
			assert.deepStrictEqual(requested[1]?.params, {
				owner: "acme",
				repo: "widget",
				name: "NODE_ENV",
				value: "production",
			});
		}),
	);

	it.effect("asks GitHub about the exact name, so a longer one cannot look like a match", () =>
		Effect.gen(function* () {
			// This used to be a substring hazard: the check scanned a listing, so
			// `NODE_ENV` present could have made `NODE` look like an update. The
			// by-name read removes the class — GitHub is asked about `NODE` and
			// answers 404 — so what is pinned now is the name that was ASKED FOR.
			const { requested, routes } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.set("NODE", "x")),
				{
					"GET /repos/{owner}/{repo}/actions/variables/{name}": Result.fail(GitHubError.notFound("read", "NODE")),
					"POST /repos/{owner}/{repo}/actions/variables": Result.succeed({}),
				},
			);

			assert.strictEqual(requested[0]?.params.name, "NODE");
			assert.strictEqual(routes[1], "POST /repos/{owner}/{repo}/actions/variables");
		}),
	);
});

describe("RepositoryVariable.list and delete", () => {
	it.effect("list carries the VALUE, not just the name", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.list),
				{},
				{
					"GET /repos/{owner}/{repo}/actions/variables": Result.succeed([variableFixture({ name: "A", value: "1" }), variableFixture({ name: "B", value: "2" })]),
				},
			);

			assert.deepStrictEqual(Result.getOrThrow(decodeVariableInfos(value)), value);

			// Variables are readable, unlike secrets — discarding the value here
			// would make an EDITED variable undetectable downstream.
			assert.deepStrictEqual(value, [
				{ name: "A", value: "1" },
				{ name: "B", value: "2" },
			]);
		}),
	);

	it.effect("delete removes by name", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.delete("NODE_ENV")),
				{ "DELETE /repos/{owner}/{repo}/actions/variables/{name}": Result.succeed("") },
			);

			assert.strictEqual(value, undefined);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", name: "NODE_ENV" });
		}),
	);
});

describe("RepositoryVariable pagination", () => {
	it.effect("returns every variable across pages, not just the first", () =>
		Effect.gen(function* () {
			// The defect this pins: these reads used a single `request`, which
			// returns ONE page. A repository with more variables than a page holds
			// reported a truncated list that looked complete — and the symptom is
			// exactly what the reporting consumer saw, a listing length that
			// disagrees with GitHub's own total_count. `layerFixture` pages the
			// recorded array through the real pagination engine, so 60 items with a
			// 30-item page is a genuine two-page read.
			const many = Array.from({ length: 60 }, (_, i) => ({ name: `VAR_${i}`, value: String(i) }));
			const { value } = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.list),
				{},
				{ "GET /repos/{owner}/{repo}/actions/variables": Result.succeed(many.map(variableFixture)) },
			);
			assert.lengthOf(value, 60);
			assert.strictEqual(value[59]?.name, "VAR_59");
		}),
	);
});

describe("RepositoryVariable, per environment", () => {
	it.effect("setForEnvironment branches on existence within the environment", () =>
		Effect.gen(function* () {
			const updated = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.setForEnvironment("prod", "LEVEL", "high")),
				{
					"GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}": Result.succeed(variableFixture({
						name: "LEVEL",
						value: "low",
					})),
					"PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}": Result.succeed(""),
				},
			);
			assert.deepStrictEqual(updated.requested[1]?.params, {
				owner: "acme",
				repo: "widget",
				environment_name: "prod",
				name: "LEVEL",
				value: "high",
			});

			const created = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.setForEnvironment("prod", "LEVEL", "high")),
				{
					"GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}": Result.fail(GitHubError.notFound(
						"read",
						"LEVEL",
					)),
					"POST /repos/{owner}/{repo}/environments/{environment_name}/variables": Result.succeed({}),
				},
			);
			assert.strictEqual(
				created.requested[1]?.route,
				"POST /repos/{owner}/{repo}/environments/{environment_name}/variables",
			);
			assert.deepStrictEqual(created.requested[1]?.params, {
				owner: "acme",
				repo: "widget",
				environment_name: "prod",
				name: "LEVEL",
				value: "high",
			});
		}),
	);

	it.effect("listForEnvironment and deleteForEnvironment stay within the environment", () =>
		Effect.gen(function* () {
			const listed = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.listForEnvironment("prod")),
				{},
				{ "GET /repos/{owner}/{repo}/environments/{environment_name}/variables": Result.succeed([variableFixture({ name: "LEVEL", value: "high" })]) },
			);
			assert.deepStrictEqual(listed.value, [{ name: "LEVEL", value: "high" }]);
			assert.deepStrictEqual(Result.getOrThrow(decodeVariableInfos(listed.value)), listed.value);

			const deleted = yield* run(
				Effect.flatMap(RepositoryVariable, (v) => v.deleteForEnvironment("prod", "LEVEL")),
				{ "DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}": Result.succeed("") },
			);
			assert.strictEqual(deleted.value, undefined);
			assert.deepStrictEqual(deleted.requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				environment_name: "prod",
				name: "LEVEL",
			});
		}),
	);
});


describe("VariableInfo boundary", () => {
	it("keeps plain listing fields and requires the readable value", () => {
		const info: VariableInfo = { name: "LEVEL", value: "high" };
		assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(VariableInfo)(info)), info);
		assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(VariableInfo)(info)), info);
		assert.strictEqual(Result.isFailure(S.decodeUnknownResult(VariableInfo)({ name: "LEVEL" })), true);
		assert.strictEqual(Result.isFailure(S.decodeUnknownResult(VariableInfo)({ name: "LEVEL", value: 7 })), true);
	});
});

describe("RepositoryVariable list response decoding", () => {
  for (const environment of [false, true]) {
    for (const [field, malformed] of [["name", { name: 42, value: "ok" }], ["value", { name: "B", value: null }]] as const) {
      it.effect(`${environment ? "environment" : "repository"} list rejects malformed ${field} in the typed channel`, () =>
        Effect.scopedWith((scope) => Effect.gen(function* () {
          const { base } = harness([{ status: 200, body: { total_count: 2, variables: [{ name: "A", value: "ok" }, malformed] } }]);
          const context = yield* Layer.buildWithScope(RepositoryVariable.layer.pipe(Layer.provideMerge(base)), scope);
          const exit = yield* Effect.flatMap(RepositoryVariable, (variables) =>
            environment ? variables.listForEnvironment("prod") : variables.list)
            .pipe(Effect.provideContext(context), Effect.exit);
          assert.strictEqual(Exit.hasFails(exit), true);
          assert.strictEqual(Exit.hasDies(exit), false);
          const error = exit.pipe(Exit.findError, Result.getOrThrow);
          assert.instanceOf(error, GitHubError);
          assert.strictEqual(error.kind, "decode");
          assert.strictEqual(error.operation, environment ? "RepositoryVariable.listForEnvironment" : "RepositoryVariable.list");
        })),
      );
    }

    it.effect(`${environment ? "environment" : "repository"} list selects plain name/value objects in API order`, () =>
      Effect.scopedWith((scope) => Effect.gen(function* () {
        const { script, base } = harness([{ status: 200, body: { total_count: 2, variables: [
          { name: "B", value: "two", created_at: "ignored" }, { name: "A", value: "one", updated_at: "ignored" },
        ] } }]);
        const context = yield* Layer.buildWithScope(RepositoryVariable.layer.pipe(Layer.provideMerge(base)), scope);
        const value = yield* Effect.flatMap(RepositoryVariable, (variables) =>
          environment ? variables.listForEnvironment("prod") : variables.list).pipe(Effect.provideContext(context));
        assert.deepStrictEqual(Result.getOrThrow(decodeVariableInfos(value)), value);
        assert.deepStrictEqual(value, [{ name: "B", value: "two" }, { name: "A", value: "one" }]);
        assert.strictEqual(script.calls[0]?.path, environment
          ? "/repos/acme/widget/environments/prod/variables" : "/repos/acme/widget/actions/variables");
      })),
    );
  }
});
