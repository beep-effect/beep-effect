// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { Ruleset } from "../../effected/github/Ruleset.ts";

const run = <A, E>(
	effect: Effect.Effect<A, E, Ruleset | GitHubClient | Repo>,
	fixtures: Record<string, unknown>,
	paginate: Record<string, ReadonlyArray<unknown>> = {},
) =>
	Effect.gen(function* () {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(Ruleset.layer),
			Effect.provide(GitHubClient.layerFixture({ request: fixtures, paginate, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested };
	});

const PAYLOAD = { name: "main", target: "branch", enforcement: "active" };

describe("Ruleset.upsert", () => {
	it.effect("PUTs against a ruleset the repository owns", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					"PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}": {},
				},
				{ "GET /repos/{owner}/{repo}/rulesets": [{ id: 99, name: "main", source_type: "Repository" }] },
			);

			assert.deepStrictEqual(
				requested.map((call) => call.route),
				["GET /repos/{owner}/{repo}/rulesets", "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
			);
			assert.strictEqual(requested[1]?.params.ruleset_id, 99);
		}),
	);

	it.effect("POSTs a new ruleset rather than writing to the ORGANIZATION'S ruleset of the same name", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					// The repository's listing includes the org's. Matching on name
					// alone would PUT at id 7 and rewrite policy for every repository
					// the organization owns.
					"POST /repos/{owner}/{repo}/rulesets": {},
				},
				{ "GET /repos/{owner}/{repo}/rulesets": [{ id: 7, name: "main", source_type: "Organization" }] },
			);

			assert.deepStrictEqual(
				requested.map((call) => call.route),
				["GET /repos/{owner}/{repo}/rulesets", "POST /repos/{owner}/{repo}/rulesets"],
			);
			// Nothing was written to the organization's ruleset.
			assert.strictEqual(
				requested.some((call) => call.route.includes("{ruleset_id}")),
				false,
			);
			assert.notInclude(JSON.stringify(requested), '"ruleset_id":7');
		}),
	);

	it.effect("prefers the repository's own ruleset when both exist under one name", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					"PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}": {},
				},
				{
					"GET /repos/{owner}/{repo}/rulesets": [
						{ id: 7, name: "main", source_type: "Organization" },
						{ id: 99, name: "main", source_type: "Repository" },
					],
				},
			);

			// The org's comes FIRST in the listing, so a `find` without the filter
			// would take it.
			assert.strictEqual(requested[1]?.params.ruleset_id, 99);
		}),
	);

	it.effect("omits conditions, rules and bypass_actors when the payload has none", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{ "POST /repos/{owner}/{repo}/rulesets": {} },
				{ "GET /repos/{owner}/{repo}/rulesets": [] },
			);

			assert.deepStrictEqual(requested[1]?.params, {
				owner: "acme",
				repo: "widget",
				name: "main",
				target: "branch",
				enforcement: "active",
			});
		}),
	);
});

describe("Ruleset.list and delete", () => {
	it.effect("list carries source_type, so a caller can tell inherited from own", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.list()),
				{},
				{
					"GET /repos/{owner}/{repo}/rulesets": [
						{ id: 1, name: "own", source_type: "Repository" },
						{ id: 2, name: "inherited", source_type: "Organization" },
					],
				},
			);

			assert.deepStrictEqual(value, [
				{ id: 1, name: "own", source_type: "Repository" },
				{ id: 2, name: "inherited", source_type: "Organization" },
			]);
		}),
	);

	it.effect("delete removes by id", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.delete(99)),
				{ "DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}": {} },
			);

			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", ruleset_id: 99 });
		}),
	);
});

describe("Ruleset bypass-actor lookups", () => {
	it.effect("teamId sources the org from Repo.owner", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.teamId("platform")),
				{ "GET /orgs/{org}/teams/{team_slug}": { id: 4242 } },
			);

			assert.strictEqual(value, 4242);
			assert.deepStrictEqual(requested[0]?.params, { org: "acme", team_slug: "platform" });
		}),
	);

	it.effect("roleId finds a role by name", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("security_manager")),
				{ "GET /orgs/{org}/organization-roles": { roles: [{ id: 5, name: "security_manager" }] } },
			);

			assert.strictEqual(value, 5);
			assert.deepStrictEqual(requested[0]?.params, { org: "acme" });
		}),
	);

	it.effect("roleId fails listing what WAS available, since role ids are per-org", () =>
		Effect.gen(function* () {
			const exit = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("missing")),
				{ "GET /orgs/{org}/organization-roles": { roles: [{ id: 5, name: "other" }] } },
			).pipe(Effect.exit);

			assert.include(JSON.stringify(exit), "available: other");
			assert.include(JSON.stringify(exit), "missing");
		}),
	);

	it.effect("roleId says 'none' rather than an empty parenthesis when there are no roles", () =>
		Effect.gen(function* () {
			const exit = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("missing")),
				{ "GET /orgs/{org}/organization-roles": {} },
			).pipe(Effect.exit);

			assert.include(JSON.stringify(exit), "available: none");
		}),
	);
});
