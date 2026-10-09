import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CodeScanning, CodeScanningSetup } from "../../effected/github/CodeScanning.ts";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
describe("CodeScanning", () => {
	{
		const requested: RecordedCall[] = [];
		it.layer(
			CodeScanning.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: { "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": Result.succeed({}) },
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("configure sends only the keys the caller set", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(CodeScanning, (cs) => cs.configure({ state: "configured", languages: ["go"] }));

					assert.deepStrictEqual(requested, [
						{
							kind: "request",
							route: "PATCH /repos/{owner}/{repo}/code-scanning/default-setup",
							params: { owner: "acme", repo: "widget", state: "configured", languages: ["go"] },
						},
					]);
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			CodeScanning.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: { "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": Result.succeed({}) },
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("configure sends every key when every key is set", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(CodeScanning, (cs) =>
						cs.configure({
							state: "configured",
							languages: ["javascript-typescript"],
							query_suite: "extended",
							threat_model: "remote_and_local",
							runner_type: "labeled",
							runner_label: "big",
						}),
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
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			CodeScanning.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: { "GET /repos/{owner}/{repo}/languages": Result.succeed({ TypeScript: 12000, Go: 300 }) },
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("languages returns the names, in GitHub's order", () =>
				Effect.gen(function* () {
					const value = yield* Effect.flatMap(CodeScanning, (cs) => cs.languages);

					assert.deepStrictEqual(value, ["TypeScript", "Go"]);
					assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
				}),
			);
		});
	}

	{
		const requested: RecordedCall[] = [];
		it.layer(
			CodeScanning.layer.pipe(
				Layer.provideMerge(
					Layer.mergeAll(
						GitHubClient.layerFixture({
							request: { "GET /repos/{owner}/{repo}/languages": Result.succeed({}) },
							requested,
						}),
						Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
					),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("resolves Repo per call, so a scoped override is honoured", () =>
				Effect.gen(function* () {
					const cs = yield* CodeScanning;
					yield* cs.languages;
					yield* cs.languages.pipe(Repo.provide(RepoRef.make({ owner: "other", repo: "thing" })));

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
	}
});

describe("CodeScanningSetup", () => {
	it.effect("preserves omitted keys and explicit undefined keys", () =>
		Effect.gen(function* () {
			const omitted = yield* S.decodeEffect(CodeScanningSetup)({});
			assert.deepStrictEqual(omitted, {});
			assert.deepStrictEqual(yield* S.encodeEffect(CodeScanningSetup)(omitted), {});
			const explicit = { runner_label: undefined };
			const value = yield* S.decodeEffect(CodeScanningSetup)(explicit);
			assert.deepStrictEqual(value, explicit);
			assert.deepStrictEqual(yield* S.encodeEffect(CodeScanningSetup)(value), explicit);
		}),
	);

	it.effect("retains open language and configuration string inputs", () =>
		Effect.gen(function* () {
			const input = {
				state: "configured" as const,
				languages: ["future-language"],
				query_suite: "future-suite",
				threat_model: "future-model",
				runner_type: "future-runner",
				runner_label: "custom runner",
			};
			const value = yield* S.decodeEffect(CodeScanningSetup)(input);
			assert.deepStrictEqual(value, input);
			assert.deepStrictEqual(yield* S.encodeEffect(CodeScanningSetup)(value), input);
		}),
	);
});
