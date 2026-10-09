// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type { RecordedCall } from "../../effected/github/index.ts";
import { GitHubClient, GitHubError } from "../../effected/github/index.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { RepositorySecurity } from "../../effected/github/RepositorySecurity.ts";

const run = <A, E>(
	effect: Effect.Effect<A, E, RepositorySecurity | GitHubClient | Repo>,
	request: Record<string, unknown>,
) =>
	Effect.gen(function* () {
		const requested: RecordedCall[] = [];
		const value = yield* effect.pipe(
			Effect.provide(RepositorySecurity.layer),
			Effect.provide(GitHubClient.layerFixture({ request, requested })),
			Effect.provide(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
		);
		return { value, requested };
	});

const FEATURES = [
	{ setter: "setVulnerabilityAlerts", segment: "vulnerability-alerts" },
	{ setter: "setAutomatedSecurityFixes", segment: "automated-security-fixes" },
	{ setter: "setPrivateVulnerabilityReporting", segment: "private-vulnerability-reporting" },
] as const;

describe("RepositorySecurity setters", () => {
	for (const { setter, segment } of FEATURES) {
		it.effect(`${setter}(true) PUTs and (false) DELETEs /${segment}`, () =>
			Effect.gen(function* () {
				// The HTTP verb IS the value; there is no body either way.
				const on = yield* run(
					Effect.flatMap(RepositorySecurity, (s) => s[setter](true)),
					{ [`PUT /repos/{owner}/{repo}/${segment}`]: {} },
				);
				assert.strictEqual(on.requested[0]?.route, `PUT /repos/{owner}/{repo}/${segment}`);
				assert.deepStrictEqual(on.requested[0]?.params, { owner: "acme", repo: "widget" });

				const off = yield* run(
					Effect.flatMap(RepositorySecurity, (s) => s[setter](false)),
					{ [`DELETE /repos/{owner}/{repo}/${segment}`]: {} },
				);
				assert.strictEqual(off.requested[0]?.route, `DELETE /repos/{owner}/{repo}/${segment}`);
				assert.deepStrictEqual(off.requested[0]?.params, { owner: "acme", repo: "widget" });
			}),
		);
	}
});

describe("RepositorySecurity.vulnerabilityAlerts", () => {
	it.effect("reports true when the read succeeds", () =>
		Effect.gen(function* () {
			const { value, requested } = yield* run(
				Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts()),
				{ "GET /repos/{owner}/{repo}/vulnerability-alerts": {} },
			);

			// 204, no payload — enabled is the ABSENCE of a 404.
			assert.strictEqual(value, true);
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
		}),
	);

	it.effect("reports false on 404, because that is how GitHub says disabled", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts()),
				{
					"GET /repos/{owner}/{repo}/vulnerability-alerts": GitHubError.notFound("test", "vulnerability alerts"),
				},
			);

			assert.strictEqual(value, false);
		}),
	);

	it.effect("does NOT absorb any other failure", () =>
		Effect.gen(function* () {
			const error = yield* run(
				Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts()),
				{
					// A mis-scoped token is not "disabled". A blanket catch here would
					// report a permissions problem as a feature being off, and the sync
					// that follows would try to turn it "on" forever.
					"GET /repos/{owner}/{repo}/vulnerability-alerts": GitHubError.make({
						kind: "unauthorized",
						operation: "test",
						reason: "the token lacks the required scope",
						status: 403,
					}),
				},
			).pipe(Effect.flip);

			// Assert the failure VALUE, not a serialisation of the Exit. A
			// JSON.stringify check depends on the shape of Exit and GitHubError, and
			// "unauthorized" appears in the fixture too — so it would pass even if
			// the error surfaced with a different kind, which is the whole subject
			// of this test.
			assert.instanceOf(error, GitHubError);
			assert.strictEqual(error.kind, "unauthorized");
		}),
	);
});

describe("RepositorySecurity flag reads", () => {
	for (const [method, segment] of [
		["automatedSecurityFixes", "automated-security-fixes"],
		["privateVulnerabilityReporting", "private-vulnerability-reporting"],
	] as const) {
		it.effect(`${method} reads the enabled flag both ways`, () =>
			Effect.gen(function* () {
				// These two answer 200 with a payload either way — the opposite of
				// vulnerability-alerts, and the reason the 404 mapping is not applied
				// uniformly.
				const on = yield* run(
					Effect.flatMap(RepositorySecurity, (s) => s[method]()),
					{ [`GET /repos/{owner}/{repo}/${segment}`]: { enabled: true } },
				);
				assert.strictEqual(on.value, true);

				const off = yield* run(
					Effect.flatMap(RepositorySecurity, (s) => s[method]()),
					{ [`GET /repos/{owner}/{repo}/${segment}`]: { enabled: false } },
				);
				assert.strictEqual(off.value, false);

				// A response with no flag at all is not "enabled".
				const missing = yield* run(
					Effect.flatMap(RepositorySecurity, (s) => s[method]()),
					{ [`GET /repos/{owner}/{repo}/${segment}`]: {} },
				);
				assert.strictEqual(missing.value, false);
			}),
		);
	}
});
