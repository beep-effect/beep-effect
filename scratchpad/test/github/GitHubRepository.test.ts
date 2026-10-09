import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";
import { repositoryFixture, userFixture } from "./fixtures.ts";
import type { GitHubFixtures, RecordedCall } from "../../effected/github/GitHubClient.ts";
import { GitHubClient } from "../../effected/github/GitHubClient.ts";
import { AppliedSettings, GitHubRepository, repositoryPatch, transformSecurityAndAnalysis } from "../../effected/github/GitHubRepository.ts";
import type { RepositoryPatch } from "../../effected/github/GitHubRepository.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";

/**
 * A wrong-but-valid route literal typechecks, so every method asserts the route
 * it hits AND the parameters it sends.
 */
const run = Effect.fn("run")(function*<A, E>(
	effect: Effect.Effect<A, E, GitHubRepository | GitHubClient | Repo>,
	request: NonNullable<GitHubFixtures["request"]> = {},
	graphql: Record<string, unknown> = {},
) {
		const requested: RecordedCall[] = [];
		const value = yield* Effect.scopedWith((scope) => Effect.flatMap(
			Layer.buildWithScope(GitHubRepository.layer.pipe(Layer.provideMerge(Layer.mergeAll(
				GitHubClient.layerFixture({ request, graphql, requested }),
				Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })),
			))), scope),
			(context) => Effect.provideContext(effect, context),
		));
		return { value, requested, routes: requested.filter((c) => c.kind !== "graphql").map((c) => c.route) };
	});

const REPO = { node_id: "R_node123", default_branch: "main" };
const UPDATE_REPOSITORY = { UpdateRepository: { updateRepository: { repository: { id: "R_node123" } } } };

describe("GitHubRepository reads", () => {
	it.effect("keeps coordinate annotations on resource spans, including derived settings reads", () =>
		Effect.gen(function* () {
			const baseTracer = yield* Effect.tracer;
			const spans: Array<Tracer.Span> = [];
			const tracer = Tracer.make({
				...baseTracer,
				span: (options) => {
					const span = baseTracer.span(options);
					spans.push(span);
					return span;
				},
			});
			yield* run(
				Effect.flatMap(GitHubRepository, (r) => Effect.gen(function* () {
					yield* r.settings;
					yield* r.defaultBranch;
					yield* r.nodeId;
					yield* r.ownerType;
				})),
				{
					"GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
					"GET /users/{username}": Result.succeed(userFixture({ type: "Organization" })),
				},
			).pipe(Effect.withSpan("caller"), Effect.withTracer(tracer));
			const settingsSpans = spans.filter((span) => span.name === "GitHubRepository.settings");
			assert.lengthOf(settingsSpans, 3);
			for (const span of settingsSpans) {
				assert.strictEqual(span.attributes.get("owner"), "acme");
				assert.strictEqual(span.attributes.get("repo"), "widget");
			}
			const ownerSpans = spans.filter((span) => span.name === "GitHubRepository.ownerType");
			assert.lengthOf(ownerSpans, 1);
			assert.strictEqual(ownerSpans[0]?.attributes.get("owner"), "acme");
			assert.isUndefined(ownerSpans[0]?.attributes.get("repo"));
			const caller = spans.find((span) => span.name === "caller");
			assert.isDefined(caller);
			assert.isUndefined(caller?.attributes.get("owner"));
			assert.isUndefined(caller?.attributes.get("repo"));
		}),
	);
	it.effect("settings, defaultBranch and nodeId all come off one GET", () =>
		Effect.gen(function* () {
			const branch = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.defaultBranch),
				{ "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);
			assert.strictEqual(branch.value, "main");
			assert.deepStrictEqual(branch.requested[0]?.params, { owner: "acme", repo: "widget" });

			const node = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.nodeId),
				{ "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);
			assert.strictEqual(node.value, "R_node123");
		}),
	);

	it.effect("ownerType reads the OWNER, not the repository", () =>
		Effect.gen(function* () {
			const org = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.ownerType),
				{ "GET /users/{username}": Result.succeed(userFixture({ type: "Organization" })) },
			);
			assert.strictEqual(org.value, "Organization");
			assert.strictEqual(org.requested[0]?.route, "GET /users/{username}");
			assert.deepStrictEqual(org.requested[0]?.params, { username: "acme" });

			// Anything that is not an organization is a User, including a Bot.
			const bot = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.ownerType),
				{ "GET /users/{username}": Result.succeed(userFixture({ type: "Bot" })) },
			);
			assert.strictEqual(bot.value, "User");
		}),
	);
});

describe("GitHubRepository.updateSettings", () => {
	it.effect("PATCHes the patch it was given", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.updateSettings({ has_issues: true })),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			assert.strictEqual(requested[0]?.route, "PATCH /repos/{owner}/{repo}");
			assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", has_issues: true });
		}),
	);

	it.effect("passes an already-wrapped security_and_analysis through instead of dropping it", () =>
		Effect.gen(function* () {
			// `RepositoryPatch` is GitHub's own parameter type, so `{ status }` is
			// what it declares and what a caller following the types will send. An
			// earlier fold wrapped bare strings only, which silently discarded the
			// whole block for exactly that caller — data loss on the type-correct
			// input, invisible because the request still succeeded.
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.updateSettings({ security_and_analysis: { advanced_security: { status: "enabled" } } }),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);
			assert.deepStrictEqual(requested[0]?.params.security_and_analysis, {
				advanced_security: { status: "enabled" },
			});
		}),
	);

	it("accepts both shapes and drops neither", () => {
		assert.deepStrictEqual(transformSecurityAndAnalysis({ advanced_security: "enabled" }), {
			advanced_security: { status: "enabled" },
		});
		assert.deepStrictEqual(transformSecurityAndAnalysis({ advanced_security: { status: "enabled" } }), {
			advanced_security: { status: "enabled" },
		});
		// A value that is neither is still dropped, which is the intended floor.
		assert.strictEqual(transformSecurityAndAnalysis({ advanced_security: 42 }), undefined);
	});

	it.effect("folds security_and_analysis into the body it sends", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.updateSettings(deliberatelyInvalid<RepositoryPatch>({
						security_and_analysis: {
							secret_scanning: "enabled",
							delegated_bypass_reviewers: [{ reviewer_id: 7 }],
						},
					})),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			// The user-facing shape is not the API's shape.
			assert.deepStrictEqual(requested[0]?.params.security_and_analysis, {
				secret_scanning: { status: "enabled" },
				secret_scanning_delegated_bypass_options: { reviewers: [{ reviewer_id: 7 }] },
			});
		}),
	);

	it.effect("drops merge-commit config when its strategy is being disabled", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.updateSettings({
						allow_merge_commit: false,
						merge_commit_title: "PR_TITLE",
						allow_squash_merge: false,
						squash_merge_commit_message: "BLANK",
					}),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			// GitHub answers 422 for title/message config on a strategy being turned
			// off in the same request.
			assert.deepStrictEqual(requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				allow_merge_commit: false,
				allow_squash_merge: false,
			});
		}),
	);

	it.effect("keeps merge-commit config when the strategy stays ON", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.updateSettings({ allow_merge_commit: true, merge_commit_title: "PR_TITLE" }),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			// The discriminating case: dropping unconditionally would silently stop
			// anyone configuring merge titles at all.
			assert.strictEqual(requested[0]?.params.merge_commit_title, "PR_TITLE");
		}),
	);
});

describe("GitHubRepository.applySettings", () => {
	it.effect("PATCHes REST-only fields and never touches GraphQL", () =>
		Effect.gen(function* () {
			const { requested, routes } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_wiki: false })),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			assert.deepStrictEqual(requested[0]?.params, {
				owner: "acme",
				repo: "widget",
				has_issues: true,
				has_wiki: false,
			});
			assert.lengthOf(
				requested.filter((c) => c.kind === "graphql"),
				0,
			);
			// No node-id read when nothing needs GraphQL.
			assert.notInclude(routes, "GET /repos/{owner}/{repo}");
		}),
	);

	it.effect("routes the three GraphQL-only settings to the mutation, via a node-id read", () =>
		Effect.gen(function* () {
			const { requested, routes } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.applySettings({ has_sponsorships: true, has_pull_requests: false, has_discussions: true }),
				),
				{ "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
				UPDATE_REPOSITORY,
			);

			// Nothing left for REST, so no PATCH at all. `has_discussions` above
			// all: the REST patch silently ignores it and answers 200, which is how
			// it read as "applied on every run" while never changing anything
			// (effected#358).
			assert.deepStrictEqual(routes, ["GET /repos/{owner}/{repo}"]);
			assert.deepStrictEqual(
				requested.filter((c) => c.kind === "graphql"),
				[
					{
						kind: "graphql",
						route: "UpdateRepository",
						params: {
							input: {
								repositoryId: "R_node123",
								hasSponsorshipsEnabled: true,
								hasPullRequestsEnabled: false,
								// Verified against UpdateRepositoryInput by introspection.
								hasDiscussionsEnabled: true,
							},
						},
					},
				],
			);
		}),
	);

	it.effect("splits a map across REST and GraphQL", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_sponsorships: true })),
				{ "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)), "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
				UPDATE_REPOSITORY,
			);

			assert.deepStrictEqual(requested.find((c) => c.route === "PATCH /repos/{owner}/{repo}")?.params, {
				owner: "acme",
				repo: "widget",
				has_issues: true,
			});
			assert.deepStrictEqual(requested.find((c) => c.kind === "graphql")?.params, {
				input: { repositoryId: "R_node123", hasSponsorshipsEnabled: true },
			});
		}),
	);

	it.effect("shares the patch preparation with updateSettings", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.applySettings({ security_and_analysis: { secret_scanning: "enabled" } }),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			// A caller must not get a different shape depending on which of the two
			// write paths they reached for.
			assert.deepStrictEqual(requested[0]?.params.security_and_analysis, { secret_scanning: { status: "enabled" } });
		}),
	);

	it.effect("sends nothing at all for an empty map", () =>
		Effect.gen(function* () {
			const { requested } = yield* run(Effect.flatMap(GitHubRepository, (r) => r.applySettings({})));

			assert.deepStrictEqual(requested, []);
		}),
	);
});

describe("transformSecurityAndAnalysis", () => {
	it("accepts wrapped enabled and disabled statuses while retaining excess properties and identity", () => {
		for (const status of ["enabled", "disabled"]) {
			const wrapped = { status, extra: "retained" };
			const transformed = transformSecurityAndAnalysis({ secret_scanning: wrapped });
			assert.strictEqual(transformed?.secret_scanning, wrapped);
			assert.deepStrictEqual(transformed, { secret_scanning: { status, extra: "retained" } });
		}
	});

	it("rejects missing and invalid wrapped statuses and array-shaped status values", () => {
		for (const wrapped of [{}, { status: "on" }, { status: 42 }, { status: null }, null, undefined]) {
			assert.isUndefined(transformSecurityAndAnalysis({ secret_scanning: wrapped }));
		}
		assert.isUndefined(transformSecurityAndAnalysis({ secret_scanning: Object.assign([], { status: "enabled" }) }));
	});
	it("wraps status fields and returns undefined when nothing survives", () => {
		assert.deepStrictEqual(transformSecurityAndAnalysis({ secret_scanning: "enabled" }), {
			secret_scanning: { status: "enabled" },
		});
		assert.isUndefined(transformSecurityAndAnalysis({}));
		assert.isUndefined(transformSecurityAndAnalysis(null));
		assert.isUndefined(transformSecurityAndAnalysis("nonsense"));
		// An unknown key is not a status field and is not forwarded.
		assert.isUndefined(transformSecurityAndAnalysis({ made_up: "enabled" }));
		// Only the two literals GitHub accepts.
		assert.isUndefined(transformSecurityAndAnalysis({ secret_scanning: "on" }));
	});

	it("treats an EMPTY reviewer list as no change rather than no reviewers", () => {
		// GitHub rejects `{ reviewers: [] }` outright when delegated bypass is on,
		// so forwarding it would turn an omission into a failure.
		assert.isUndefined(transformSecurityAndAnalysis({ delegated_bypass_reviewers: [] }));
	});
});

describe("GitHubRepository.applySettings reporting", () => {
	it.effect("returns a plain object compatible with the owning AppliedSettings schema", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_sponsorships: true })),
				{
					"GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
					"PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
				},
				UPDATE_REPOSITORY,
			);
			const report: AppliedSettings = value;
			assert.isTrue(S.is(AppliedSettings)(report));
			assert.deepStrictEqual(report, { rest: ["has_issues"], graphql: ["has_sponsorships"] });
			const decoded = yield* S.decodeEffect(AppliedSettings)(report);
			assert.deepStrictEqual(decoded, report);
			assert.isFalse(S.is(AppliedSettings)({ rest: [] }));
			assert.isFalse(S.is(AppliedSettings)({ rest: [42], graphql: [] }));
		}),
	);
	it.effect("reports the fields it SENT, not the fields it was given", () =>
		Effect.gen(function* () {
			// The case the whole return value exists for. `merge_commit_title` is
			// asked for and dropped, because its strategy is being disabled — so a
			// caller reporting Object.keys(input) names a field that never went out.
			// A dry run is precisely where someone checks whether a conditional
			// field survived its gate, so being wrong here is wrong in the direction
			// that looks like success.
			const { value, requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) =>
					r.applySettings({
						allow_merge_commit: false,
						merge_commit_title: "PR_TITLE",
						has_issues: true,
					}),
				),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);

			assert.deepStrictEqual([...value.rest].sort(), ["allow_merge_commit", "has_issues"]);
			assert.notInclude(value.rest, "merge_commit_title");
			assert.deepStrictEqual([...value.graphql], []);
			// And the report agrees with the wire, which is the property that makes
			// it trustworthy rather than merely plausible.
			assert.notProperty(requested[0]?.params ?? {}, "merge_commit_title");
		}),
	);

	it.effect("sends nothing when preparation drops every field it was given", () =>
		Effect.gen(function* () {
			// The reviewer's reproduction. `security_and_analysis: 42` normalises to
			// nothing, so `prepared` is empty — but the gate used to test the RAW
			// keys, firing a PATCH carrying only owner and repo while the report
			// said `rest: []`. The report contradicting the wire is exactly what
			// AppliedSettings exists to prevent, so it must not happen here.
			const { value, requested } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.applySettings({ security_and_analysis: 42 })),
				{ "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
			);
			assert.deepStrictEqual([...value.rest], []);
			assert.lengthOf(requested, 0, "no request should have been made at all");
		}),
	);

	it.effect("names GraphQL-only fields in the caller's vocabulary", () =>
		Effect.gen(function* () {
			const { value } = yield* run(
				Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_sponsorships: true })),
				{ "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
				UPDATE_REPOSITORY,
			);
			// `has_sponsorships`, not `hasSponsorshipsEnabled`: the audience is a
			// person reading a plan against the config they wrote.
			assert.deepStrictEqual([...value.graphql], ["has_sponsorships"]);
			assert.deepStrictEqual([...value.rest], []);
		}),
	);
});

describe("repositoryPatch", () => {
	it("drops explicitly-undefined fields rather than sending them", () => {
		// PATCH treats an absent field as "leave it alone"; an explicit undefined
		// is a value. Sending one would overwrite a setting the user never named.
		const patch = repositoryPatch({ has_issues: true, has_wiki: undefined, description: "x" });
		assert.deepStrictEqual(patch, { has_issues: true, description: "x" });
		assert.isFalse("has_wiki" in patch, "an unset field must not reach the wire at all");
	});

	it("keeps a field whose value is legitimately false or empty", () => {
		// The filter is on `undefined`, NOT on falsiness: `has_issues: false` is
		// the whole point of a patch that disables a feature, and a truthiness
		// check here would silently refuse to turn anything off.
		const patch = repositoryPatch({ has_issues: false, description: "" });
		assert.deepStrictEqual(patch, { has_issues: false, description: "" });
	});

	it("answers an empty patch when nothing was configured", () => {
		assert.deepStrictEqual(repositoryPatch({ has_issues: undefined, has_wiki: undefined }), {});
	});

	it("accepts a draft built from a settings source, which is the shape that would not assign", () => {
		// This is the case from the report: a value typed `boolean | undefined`
		// does not satisfy octokit's `has_issues?: boolean` under
		// exactOptionalPropertyTypes, so the draft type is the thing that makes
		// the natural call site compile without a cast.
		const configured: { has_issues?: boolean | undefined; has_projects?: boolean | undefined } = {
			has_issues: true,
		};
		const patch = repositoryPatch({ has_issues: configured.has_issues, has_projects: configured.has_projects });
		assert.deepStrictEqual(patch, { has_issues: true });
	});
});
