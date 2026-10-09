// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { DeploymentEnvironment } from "../../effected/github/DeploymentEnvironment.ts";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";

const run = Effect.fn("run")(function*<A, E>(
	effect: Effect.Effect<A, E, DeploymentEnvironment | GitHubClient | Repo>,
	request: Record<string, unknown>,
	paginate: Record<string, ReadonlyArray<unknown>> = {},
) {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(DeploymentEnvironment.layer),
			Effect.provide(GitHubClient.layerFixture({ request, paginate, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested };
	});

describe("DeploymentEnvironment.upsert", () => {
	it.effect("PUTs the environment with its config", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) => e.upsert("prod", { wait_timer: 15 })),
				{ "PUT /repos/{owner}/{repo}/environments/{environment_name}": {} },
			);

			assert.strictEqual(requested[0]?.route, "PUT /repos/{owner}/{repo}/environments/{environment_name}");
			assert.deepStrictEqual(requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				environment_name: "prod",
				wait_timer: 15,
			});
		}),
	);

	it.effect("needs no config, and does not list first", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) => e.upsert("prod")),
				{ "PUT /repos/{owner}/{repo}/environments/{environment_name}": {} },
			);

			// The route is idempotent, so unlike variables there is no read-then-branch.
			assert.deepStrictEqual(
				requested.map((c) => c.route),
				["PUT /repos/{owner}/{repo}/environments/{environment_name}"],
			);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", environment_name: "prod" });
		}),
	);

	it.effect("a config key cannot retarget the request at another repository", () =>
		Effect.gen(function* () {
			// `config` is an open record. Spread AFTER the coordinates it would
			// overwrite them, silently sending the request somewhere else while the
			// span still annotated the intended repository.
			const { requested } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) =>
					e.upsert("prod", { owner: "attacker", repo: "elsewhere", wait_timer: 5 } as never),
				),
				{ "PUT /repos/{owner}/{repo}/environments/{environment_name}": {} },
			);
			assert.strictEqual(requested[0]?.params.owner, "acme");
			assert.strictEqual(requested[0]?.params.repo, "widget");
			assert.strictEqual(requested[0]?.params.wait_timer, 5, "the real body still passes through");
		}),
	);
});

describe("DeploymentEnvironment.list", () => {
	it.effect("maps the names", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) => e.list()),
				{},
				{ "GET /repos/{owner}/{repo}/environments": [{ name: "prod" }, { name: "staging" }] },
			);

			assert.deepStrictEqual(value, [{ name: "prod" }, { name: "staging" }]);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
		}),
	);

	it.effect("tolerates a response with no environments key at all", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) => e.list()),
				// A repository with none. The read is paginated, so "no environments"
				// arrives as an empty page rather than as a response missing the key —
				// octokit's paginator normalises the envelope before this code sees
				// it. The property under test is unchanged: none is `[]`, not an error.
				{},
				{ "GET /repos/{owner}/{repo}/environments": [] },
			);

			assert.deepStrictEqual(value, []);
		}),
	);
});

describe("DeploymentEnvironment.delete", () => {
	it.effect("removes by name", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(DeploymentEnvironment, (e) => e.delete("prod")),
				{ "DELETE /repos/{owner}/{repo}/environments/{environment_name}": {} },
			);

			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", environment_name: "prod" });
		}),
	);
});
