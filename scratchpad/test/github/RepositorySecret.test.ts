// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import * as Base64 from "effect/encoding/Base64";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import type { SecretScope } from "../../effected/github/RepositorySecret.ts";
import { RepositorySecret } from "../../effected/github/RepositorySecret.ts";

/** A base64 Curve25519 public key, so the seal has something real to work against. */
const PUBLIC_KEY = { key: Base64.encode(new Uint8Array(32).fill(7)), key_id: "key-123" };

const run = <A, E>(
	effect: Effect.Effect<A, E, RepositorySecret | GitHubClient | Repo>,
	request: Record<string, unknown>,
	paginate: Record<string, ReadonlyArray<unknown>> = {},
) =>
	Effect.gen(function* () {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(RepositorySecret.layer),
			Effect.provide(GitHubClient.layerFixture({ request, paginate, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested, routes: requested.map((c) => c.route) };
	});

const SCOPES: ReadonlyArray<SecretScope> = ["actions", "dependabot", "codespaces"];

describe("RepositorySecret, per store", () => {
	for (const scope of SCOPES) {
		it.effect(`set (${scope}) reads that store's public key then PUTs the sealed value`, () =>
			Effect.gen(function* () {
				const { requested, routes } = yield* run(
					Effect.flatMap(RepositorySecret, (s) => s.set("TOKEN", Redacted.make("plaintext"), scope)),
					{
						[`GET /repos/{owner}/{repo}/${scope}/secrets/public-key`]: PUBLIC_KEY,
						[`PUT /repos/{owner}/{repo}/${scope}/secrets/{secret_name}`]: {},
					},
				);

				assert.deepStrictEqual(routes, [
					`GET /repos/{owner}/{repo}/${scope}/secrets/public-key`,
					`PUT /repos/{owner}/{repo}/${scope}/secrets/{secret_name}`,
				]);

				const put = requested[1];
				assert.strictEqual(put?.params.owner, "acme");
				assert.strictEqual(put?.params.repo, "widget");
				assert.strictEqual(put?.params.secret_name, "TOKEN");
				assert.strictEqual(put?.params.key_id, "key-123");
				// The plaintext must never appear in the request, on any path.
				assert.notStrictEqual(put?.params.encrypted_value, "plaintext");
				assert.strictEqual(typeof put?.params.encrypted_value, "string");
				assert.notInclude(JSON.stringify(put?.params), "plaintext");
			}),
		);

		it.effect(`list (${scope}) reads that store's list route`, () =>
			Effect.gen(function* () {
				const { value, requested } = yield* run(
					Effect.flatMap(RepositorySecret, (s) => s.list(scope)),
					{},
					{ [`GET /repos/{owner}/{repo}/${scope}/secrets`]: [{ name: "A" }, { name: "B" }] },
				);

				assert.deepStrictEqual(value, [{ name: "A" }, { name: "B" }]);
				assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
			}),
		);

		it.effect(`delete (${scope}) deletes on that store's route`, () =>
			Effect.gen(function* () {
				const { requested } = yield* run(
					Effect.flatMap(RepositorySecret, (s) => s.delete("TOKEN", scope)),
					{ [`DELETE /repos/{owner}/{repo}/${scope}/secrets/{secret_name}`]: {} },
				);

				assert.strictEqual(requested[0]?.route, `DELETE /repos/{owner}/{repo}/${scope}/secrets/{secret_name}`);
				assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", secret_name: "TOKEN" });
			}),
		);
	}

	it.effect("defaults to the actions store", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(RepositorySecret, (s) => s.list()),
				{},
				{ "GET /repos/{owner}/{repo}/actions/secrets": [] },
			);

			assert.strictEqual(requested[0]?.route, "GET /repos/{owner}/{repo}/actions/secrets");
		}),
	);
});

describe("RepositorySecret, per environment", () => {
	it.effect("setForEnvironment uses the environment's own public key", () =>
		Effect.gen(function* () {
			const { requested, routes } = yield* run(
				Effect.flatMap(RepositorySecret, (s) => s.setForEnvironment("prod", "TOKEN", Redacted.make("plaintext"))),
				{
					"GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key": PUBLIC_KEY,
					"PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}": {},
				},
			);

			assert.deepStrictEqual(routes, [
				"GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key",
				"PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}",
			]);
			assert.strictEqual(requested[1]?.params.environment_name, "prod");
			assert.strictEqual(requested[1]?.params.secret_name, "TOKEN");
			assert.notInclude(JSON.stringify(requested[1]?.params), "plaintext");
		}),
	);

	it.effect("listForEnvironment and deleteForEnvironment hit the environment routes", () =>
		Effect.gen(function* () {
			const listed = yield* run(
				Effect.flatMap(RepositorySecret, (s) => s.listForEnvironment("prod")),
				{},
				{ "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets": [{ name: "A" }] },
			);
			assert.deepStrictEqual(listed.value, [{ name: "A" }]);
			assert.deepStrictEqual(listed.requested[0]?.params, { owner: "acme", repo: "widget", environment_name: "prod" });

			const deleted = yield* run(
				Effect.flatMap(RepositorySecret, (s) => s.deleteForEnvironment("prod", "TOKEN")),
				{ "DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}": {} },
			);
			assert.deepStrictEqual(deleted.requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				environment_name: "prod",
				secret_name: "TOKEN",
			});
		}),
	);
});

describe("RepositorySecret, when the public key is unusable", () => {
	it.effect("fails typed rather than throwing, naming the route it came from", () =>
		Effect.gen(function* () {
			const exit = yield* run(
				Effect.flatMap(RepositorySecret, (s) => s.set("TOKEN", Redacted.make("plaintext"))),
				{
					// Garbage from the API is INPUT, so it fails typed. A throw here
					// would be a defect escaping from the secrets path.
					"GET /repos/{owner}/{repo}/actions/secrets/public-key": { key: "!!! not base64 !!!", key_id: "k" },
				},
			).pipe(Effect.exit);

			assert.include(JSON.stringify(exit), "public key");
			// And nothing was written.
			assert.notInclude(JSON.stringify(exit), "plaintext");
		}),
	);
});

describe("the Redacted seam", () => {
	it("keeps the plaintext out of the obvious leak paths before it is ever sealed", () => {
		const value = Redacted.make("hunter2");

		assert.notInclude(String(value), "hunter2");
		assert.notInclude(JSON.stringify({ value }), "hunter2");
		assert.notInclude(`${value}`, "hunter2");
		// And it is still readable where the code deliberately asks.
		assert.strictEqual(Redacted.value(value), "hunter2");
	});
});
