import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { environmentFixture } from "./fixtures.ts";
import { DeploymentEnvironment, DeploymentEnvironmentInfo } from "../../effected/github/DeploymentEnvironment.ts";
import { harness } from "./harness.ts";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
describe("DeploymentEnvironment.upsert", () => {
	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: {
								"PUT /repos/{owner}/{repo}/environments/{environment_name}": Result.succeed(environmentFixture({})),
							},
							paginate: {},
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("PUTs the environment with its config", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(DeploymentEnvironment, (e) => e.upsert("prod", { wait_timer: 15 }));

					assert.strictEqual(requested[0]?.route, "PUT /repos/{owner}/{repo}/environments/{environment_name}");
					assert.deepStrictEqual(requested[0]?.params, {
						owner: "acme",
						repo: "widget",
						environment_name: "prod",
						wait_timer: 15,
					});
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: {
								"PUT /repos/{owner}/{repo}/environments/{environment_name}": Result.succeed(environmentFixture({})),
							},
							paginate: {},
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("needs no config, and does not list first", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(DeploymentEnvironment, (e) => e.upsert("prod"));

					// The route is idempotent, so unlike variables there is no read-then-branch.
					assert.deepStrictEqual(
						requested.map((c) => c.route),
						["PUT /repos/{owner}/{repo}/environments/{environment_name}"],
					);
					assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", environment_name: "prod" });
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: {
								"PUT /repos/{owner}/{repo}/environments/{environment_name}": Result.succeed(environmentFixture({})),
							},
							paginate: {},
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("a config key cannot retarget the request at another repository", () =>
				Effect.gen(function* () {
					// `config` is an open record. Spread AFTER the coordinates it would
					// overwrite them, silently sending the request somewhere else while the
					// span still annotated the intended repository.
					yield* Effect.flatMap(DeploymentEnvironment, (e) =>
						e.upsert("prod", { owner: "attacker", repo: "elsewhere", wait_timer: 5 }),
					);
					assert.strictEqual(requested[0]?.params.owner, "acme");
					assert.strictEqual(requested[0]?.params.repo, "widget");
					assert.strictEqual(requested[0]?.params.wait_timer, 5, "the real body still passes through");
				}),
			);
		});
	}
});

describe("DeploymentEnvironment.list", () => {
	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: {},
							paginate: {
								"GET /repos/{owner}/{repo}/environments": Result.succeed([
									environmentFixture({ name: "prod" }),
									environmentFixture({ name: "staging" }),
								]),
							},
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("maps the names", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(DeploymentEnvironment, (e) => e.list);

					assert.deepStrictEqual(value, [{ name: "prod" }, { name: "staging" }]);
					assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: {},
							paginate: { "GET /repos/{owner}/{repo}/environments": Result.succeed([]) },
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("tolerates a response with no environments key at all", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(DeploymentEnvironment, (e) => e.list);

					assert.deepStrictEqual(value, []);
				}),
			);
		});
	}
});

describe("DeploymentEnvironment.delete", () => {
	{
		const { base, script } = harness([{ status: 204 }]);
		it.layer(DeploymentEnvironment.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
			it.effect("returns undefined after HTTP 204 through the live client", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(DeploymentEnvironment, (environment) => environment.delete("prod"));
					assert.strictEqual(value, undefined);
					assert.strictEqual(script.calls[0]?.method, "DELETE");
					assert.strictEqual(script.calls[0]?.path, "/repos/acme/widget/environments/prod");
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			DeploymentEnvironment.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: { "DELETE /repos/{owner}/{repo}/environments/{environment_name}": Result.succeed("") },
							paginate: {},
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("removes by name", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(DeploymentEnvironment, (e) => e.delete("prod"));

					assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", environment_name: "prod" });
				}),
			);
		});
	}
});

describe("DeploymentEnvironmentInfo", () => {
	it.effect("decodes and encodes an open environment name as a plain object", () =>
		Effect.gen(function* () {
			const input = { name: "preview/customer branch" };
			const value = yield* S.decodeEffect(DeploymentEnvironmentInfo)(input);
			assert.deepStrictEqual(value, input);
			assert.deepStrictEqual(yield* S.encodeEffect(DeploymentEnvironmentInfo)(value), input);
		}),
	);
});
