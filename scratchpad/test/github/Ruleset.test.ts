// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { listedRulesetFixture, rulesetFixture, teamFixture } from "./fixtures.ts";
import * as S from "effect/Schema";
import type { GitHubFixtures, RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { Ruleset, RulesetInfo, RulesetPayload } from "../../effected/github/Ruleset.ts";

const decodeRulesetInfos = S.decodeResult(S.Array(RulesetInfo));

const JsonValue = S.fromJsonString(S.Unknown);

const run = Effect.fn("run")(function*<A, E>(
	effect: Effect.Effect<A, E, Ruleset | GitHubClient | Repo>,
	fixtures: NonNullable<GitHubFixtures["request"]>,
	paginate: NonNullable<GitHubFixtures["paginate"]> = {},
	requestDecoded: NonNullable<GitHubFixtures["requestDecoded"]> = {},
) {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(Ruleset.layer),
			Effect.provide(GitHubClient.layerFixture({ request: fixtures, requestDecoded, paginate, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested };
	});

const runUpsert = Effect.fn("runUpsert")(function*<A, E>(
	effect: Effect.Effect<A, E, Ruleset | GitHubClient | Repo>,
	requestDecoded: NonNullable<GitHubFixtures["requestDecoded"]>,
	paginate: NonNullable<GitHubFixtures["paginate"]> = {},
) {
	return yield* run(effect, {}, paginate, requestDecoded);
});

const PAYLOAD = { name: "main", target: "branch", enforcement: "active" };

describe("Ruleset.upsert", () => {
	it.effect("PUTs against a ruleset the repository owns", () =>
		Effect.gen(function* () {
			const { requested } = yield* runUpsert(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					"PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}": rulesetFixture({}),
				},
				{ "GET /repos/{owner}/{repo}/rulesets": Result.succeed([listedRulesetFixture({ id: 99, name: "main", source_type: "Repository" })]) },
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
			const { requested } = yield* runUpsert(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					// The repository's listing includes the org's. Matching on name
					// alone would PUT at id 7 and rewrite policy for every repository
					// the organization owns.
					"POST /repos/{owner}/{repo}/rulesets": rulesetFixture({}),
				},
				{ "GET /repos/{owner}/{repo}/rulesets": Result.succeed([listedRulesetFixture({ id: 7, name: "main", source_type: "Organization" })]) },
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
			assert.notInclude((yield* S.encodeEffect(JsonValue)(requested)), '"ruleset_id":7');
		}),
	);

	it.effect("prefers the repository's own ruleset when both exist under one name", () =>
		Effect.gen(function* () {
			const { requested } = yield* runUpsert(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{
					"PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}": rulesetFixture({}),
				},
				{
					"GET /repos/{owner}/{repo}/rulesets": Result.succeed([listedRulesetFixture({ id: 7, name: "main", source_type: "Organization" }), listedRulesetFixture({ id: 99, name: "main", source_type: "Repository" })]),
				},
			);

			// The org's comes FIRST in the listing, so a `find` without the filter
			// would take it.
			assert.strictEqual(requested[1]?.params.ruleset_id, 99);
		}),
	);

	it.effect("omits conditions, rules and bypass_actors when the payload has none", () =>
		Effect.gen(function* () {
			const { requested } = yield* runUpsert(
				Effect.flatMap(Ruleset, (r) => r.upsert(PAYLOAD)),
				{ "POST /repos/{owner}/{repo}/rulesets": rulesetFixture({}) },
				{ "GET /repos/{owner}/{repo}/rulesets": Result.succeed([]) },
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
				Effect.flatMap(Ruleset, (r) => r.list),
				{},
				{
					"GET /repos/{owner}/{repo}/rulesets": Result.succeed([listedRulesetFixture({ id: 1, name: "own", source_type: "Repository" }), listedRulesetFixture({ id: 2, name: "inherited", source_type: "Organization" })]),
				},
			);

			assert.deepStrictEqual(Result.getOrThrow(decodeRulesetInfos(value)), value);
			assert.deepStrictEqual(value, [
				{ id: 1, name: "own", source_type: "Repository" },
				{ id: 2, name: "inherited", source_type: "Organization" },
			]);
		}),
	);

	it.effect("delete removes by id", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.delete(99)),
				{ "DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}": Result.succeed("") },
			);

			assert.strictEqual(value, undefined);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", ruleset_id: 99 });
		}),
	);
});

describe("Ruleset bypass-actor lookups", () => {
	it.effect("teamId sources the org from Repo.owner", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.teamId("platform")),
				{ "GET /orgs/{org}/teams/{team_slug}": Result.succeed(teamFixture({ id: 4242 })) },
			);

			assert.strictEqual(value, 4242);
			assert.deepStrictEqual(requested[0]?.params, { org: "acme", team_slug: "platform" });
		}),
	);

	it.effect("roleId finds a role by name", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("security_manager")),
				{ "GET /orgs/{org}/organization-roles": Result.succeed({ roles: [{ id: 5, name: "security_manager", permissions: [], organization: null, created_at: "", updated_at: "" }] }) },
			);

			assert.strictEqual(value, 5);
			assert.deepStrictEqual(requested[0]?.params, { org: "acme" });
		}),
	);

	it.effect("roleId fails listing what WAS available, since role ids are per-org", () =>
		Effect.gen(function* () {
			const exit = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("missing")),
				{ "GET /orgs/{org}/organization-roles": Result.succeed({ roles: [{ id: 5, name: "other", permissions: [], organization: null, created_at: "", updated_at: "" }] }) },
			).pipe(Effect.exit);

			assert.include((yield* S.encodeEffect(JsonValue)(exit)), "available: other");
			assert.include((yield* S.encodeEffect(JsonValue)(exit)), "missing");
		}),
	);

	it.effect("roleId says 'none' rather than an empty parenthesis when there are no roles", () =>
		Effect.gen(function* () {
			const exit = yield* run(
				Effect.flatMap(Ruleset, (r) => r.roleId("missing")),
				{ "GET /orgs/{org}/organization-roles": Result.succeed({}) },
			).pipe(Effect.exit);

			assert.include((yield* S.encodeEffect(JsonValue)(exit)), "available: none");
		}),
	);
});


describe("RulesetPayload open boundary", () => {
	for (const existing of [false, true]) {
		it.effect(`passes future vocabulary, partial rules and non-ref-name conditions through ${existing ? "PUT" : "POST"}`, () =>
			Effect.gen(function* () {
				const payload = {
					name: "main",
					target: "future-target",
					enforcement: "future-enforcement",
					conditions: { repository_name: { include: ["widget"] } },
					rules: [{ type: "future-rule", parameters: { partial: true } }, { type: "pull_request", parameters: { required_approving_review_count: 1 } }],
					bypass_actors: [{ actor_type: "FutureActor", actor_id: "future-id" }],
				};
				const decoded = Result.getOrThrow(S.decodeResult(RulesetPayload)(payload));
				assert.deepStrictEqual(decoded, payload);
				assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(RulesetPayload)(decoded)), payload);
				const route = existing ? "PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}" : "POST /repos/{owner}/{repo}/rulesets";
				const { value, requested } = yield* runUpsert(
					Effect.flatMap(Ruleset, (r) => r.upsert(decoded)),
					{ [route]: { response: "discarded" } },
					{ "GET /repos/{owner}/{repo}/rulesets": Result.succeed(existing ? [listedRulesetFixture({ id: 99, name: "main", source_type: "Repository" })] : []) },
				);
				assert.strictEqual(value, undefined);
				assert.strictEqual(requested[1]?.route, route);
				assert.deepStrictEqual(requested[1]?.params, {
					owner: "acme", repo: "widget", ...payload, ...(existing ? { ruleset_id: 99 } : {}),
				});
			}),
		);
	}

	it("preserves omitted, undefined and null open fields", () => {
		for (const payload of [
			PAYLOAD,
			{ ...PAYLOAD, conditions: undefined, rules: undefined, bypass_actors: undefined },
			{ ...PAYLOAD, conditions: null, rules: null, bypass_actors: null },
		]) {
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(RulesetPayload)(payload)), payload);
			assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(RulesetPayload)(payload)), payload);
		}
	});
});

describe("RulesetInfo boundary", () => {
	it("preserves plain listing fields with absent, undefined or present ownership", () => {
		const infos: ReadonlyArray<RulesetInfo> = [
			{ id: 1, name: "unspecified" },
			{ id: 2, name: "undefined", source_type: undefined },
			{ id: 3, name: "owned", source_type: "Repository" },
			{ id: 4, name: "inherited", source_type: "Organization" },
		];
		for (const info of infos) {
			assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(RulesetInfo)(info)), info);
			assert.deepStrictEqual(Result.getOrThrow(S.encodeResult(RulesetInfo)(info)), info);
		}
	});
});
