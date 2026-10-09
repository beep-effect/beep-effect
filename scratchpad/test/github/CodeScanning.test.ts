// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { CodeScanning } from "../../effected/github/CodeScanning.ts";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";

const run = Effect.fn("run")(function*<A, E>(
	effect: Effect.Effect<A, E, CodeScanning | GitHubClient | Repo>,
	fixtures: Record<string, unknown>,
) {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(CodeScanning.layer),
			Effect.provide(GitHubClient.layerFixture({ request: fixtures, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested };
	});

describe("CodeScanning", () => {
	it.effect("configure sends only the keys the caller set", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(CodeScanning, (cs) => cs.configure({ state: "configured", languages: ["go"] })),
				{ "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": {} },
			);

			assert.deepStrictEqual(requested, [
				{
					kind: "request",
					route: "PATCH /repos/{owner}/{repo}/code-scanning/default-setup",
					params: { owner: "acme", repo: "widget", state: "configured", languages: ["go"] },
				},
			]);
		}),
	);

	it.effect("configure sends every key when every key is set", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(CodeScanning, (cs) =>
					cs.configure({
						state: "configured",
						languages: ["javascript-typescript"],
						query_suite: "extended",
						threat_model: "remote_and_local",
						runner_type: "labeled",
						runner_label: "big",
					}),
				),
				{ "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": {} },
			);

			assert.deepStrictEqual(requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				state: "configured",
				languages: ["javascript-typescript"],
				query_suite: "extended",
				threat_model: "remote_and_local",
				runner_type: "labeled",
				runner_label: "big",
			});
		}),
	);

	it.effect("languages returns the names, in GitHub's order", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(CodeScanning, (cs) => cs.languages()),
				{ "GET /repos/{owner}/{repo}/languages": { TypeScript: 12000, Go: 300 } },
			);

			assert.deepStrictEqual(value, ["TypeScript", "Go"]);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
		}),
	);

	it.effect("resolves Repo per call, so a scoped override is honoured", () =>
		Effect.gen(function* () {
			const requested: RecordedCall[] = [];
			yield* Effect.gen(function* () {
				const cs = yield* CodeScanning;
				yield* cs.languages();
				// The whole reason the coordinate is not captured at layer
				// construction: this must reach a DIFFERENT repository.
				yield* cs.languages().pipe(Repo.provide(RepoRef.make({ owner: "other", repo: "thing" })));
			}).pipe(
				Effect.provide(CodeScanning.layer),
				Effect.provide(
					GitHubClient.layerFixture({ request: { "GET /repos/{owner}/{repo}/languages": {} }, requested }),
				),
				Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
			);

			assert.deepStrictEqual(
				requested.map((call) => call.params),
				[
					{ owner: "acme", repo: "widget" },
					{ owner: "other", repo: "thing" },
				],
			);
		}),
	);
});
