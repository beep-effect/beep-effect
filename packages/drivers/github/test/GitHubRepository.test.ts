import { GitHubClient } from "@beep/github/GitHubClient";
import {
  AppliedSettings,
  GitHubRepository,
  repositoryPatch,
  transformSecurityAndAnalysis,
} from "@beep/github/GitHubRepository";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";
import { repositoryFixture, userFixture } from "./support/fixtures.ts";
import { harness } from "./support/harness.ts";
import type { GitHubFixtures, RecordedCall } from "@beep/github/GitHubClient";
import type { RepositoryPatch } from "@beep/github/GitHubRepository";

const run = Effect.fn("run")(function* <A, E>(
  effect: Effect.Effect<A, E, GitHubRepository | GitHubClient | Repo>,
  request: NonNullable<GitHubFixtures["request"]> = {},
  graphql: Record<string, unknown> = {}
) {
  const requested: RecordedCall[] = [];
  const value = yield* Effect.scopedWith((scope) =>
    Effect.flatMap(
      Layer.buildWithScope(
        GitHubRepository.layer.pipe(
          Layer.provideMerge(
            Layer.mergeAll(
              GitHubClient.layerFixture({ request, graphql, requested }),
              Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
            )
          )
        ),
        scope
      ),
      (context) => Effect.provideContext(effect, context)
    )
  );
  return {
    value,
    requested,
    routes: A.map(
      A.filter(requested, (c) => c.kind !== "graphql"),
      (c) => c.route
    ),
  };
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
        Effect.flatMap(GitHubRepository, (r) =>
          Effect.gen(function* () {
            yield* r.settings;
            yield* r.defaultBranch;
            yield* r.nodeId;
            yield* r.ownerType;
          })
        ),
        {
          "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
          "GET /users/{username}": Result.succeed(userFixture({ type: "Organization" })),
        }
      ).pipe(Effect.withSpan("caller"), Effect.withTracer(tracer));
      const settingsSpans = A.filter(spans, (span) => span.name === "GitHubRepository.settings");
      assert.lengthOf(settingsSpans, 3);
      for (const span of settingsSpans) {
        assert.strictEqual(span.attributes.get("owner"), "acme");
        assert.strictEqual(span.attributes.get("repo"), "widget");
      }
      const ownerSpans = A.filter(spans, (span) => span.name === "GitHubRepository.ownerType");
      assert.lengthOf(ownerSpans, 1);
      assert.strictEqual(ownerSpans[0]?.attributes.get("owner"), "acme");
      assert.isUndefined(ownerSpans[0]?.attributes.get("repo"));
      const caller = O.getOrThrow(A.findFirst(spans, (span) => span.name === "caller"));
      assert.isUndefined(caller.attributes.get("owner"));
      assert.isUndefined(caller.attributes.get("repo"));
    })
  );
  it.effect("settings, defaultBranch and nodeId all come off one GET", () =>
    Effect.gen(function* () {
      const branch = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.defaultBranch),
        { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );
      assert.strictEqual(branch.value, "main");
      assert.deepStrictEqual(branch.requested[0]?.params, { owner: "acme", repo: "widget" });

      const node = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.nodeId),
        { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );
      assert.strictEqual(node.value, "R_node123");
    })
  );

  it.effect("ownerType reads the OWNER, not the repository", () =>
    Effect.gen(function* () {
      const org = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.ownerType),
        { "GET /users/{username}": Result.succeed(userFixture({ type: "Organization" })) }
      );
      assert.strictEqual(org.value, "Organization");
      assert.strictEqual(
        org.requested[0]?.route,
        "GET /users/{username}",
        "a wrong-but-valid route literal typechecks, so each method asserts its route and params"
      );
      assert.deepStrictEqual(org.requested[0]?.params, { username: "acme" });

      const bot = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.ownerType),
        { "GET /users/{username}": Result.succeed(userFixture({ type: "Bot" })) }
      );
      assert.strictEqual(bot.value, "User", "anything that is not an organization is a User, including a Bot");
    })
  );
});

describe("GitHubRepository.updateSettings", () => {
  it.effect("PATCHes the patch it was given", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.updateSettings({ has_issues: true })),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.strictEqual(requested[0]?.route, "PATCH /repos/{owner}/{repo}");
      assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget", has_issues: true });
    })
  );

  it.effect("passes an already-wrapped security_and_analysis through instead of dropping it", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.updateSettings({ security_and_analysis: { advanced_security: { status: "enabled" } } })
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );
      assert.deepStrictEqual(
        requested[0]?.params.security_and_analysis,
        {
          advanced_security: { status: "enabled" },
        },
        "RepositoryPatch declares the wrapped status form, so a type-following caller sends it"
      );
    })
  );

  it("accepts both shapes and drops neither", () => {
    assert.deepStrictEqual(
      transformSecurityAndAnalysis({ advanced_security: "enabled" }),
      O.some({ advanced_security: { status: "enabled" } })
    );
    assert.deepStrictEqual(
      transformSecurityAndAnalysis({ advanced_security: { status: "enabled" } }),
      O.some({ advanced_security: { status: "enabled" } })
    );
    const neitherShapeDropped = transformSecurityAndAnalysis({ advanced_security: 42 });
    assertNone(neitherShapeDropped);
  });

  it.effect("folds security_and_analysis into the body it sends", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.updateSettings(
            deliberatelyInvalid<RepositoryPatch>({
              security_and_analysis: {
                secret_scanning: "enabled",
                delegated_bypass_reviewers: [{ reviewer_id: 7 }],
              },
            })
          )
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.deepStrictEqual(
        requested[0]?.params.security_and_analysis,
        {
          secret_scanning: { status: "enabled" },
          secret_scanning_delegated_bypass_options: { reviewers: [{ reviewer_id: 7 }] },
        },
        "the user-facing shape is not the API shape"
      );
    })
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
          })
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.deepStrictEqual(
        requested[0]?.params,
        {
          owner: "acme",
          repo: "widget",
          allow_merge_commit: false,
          allow_squash_merge: false,
        },
        "GitHub answers 422 for title or message config on a strategy turned off in the same request"
      );
    })
  );

  it.effect("keeps merge-commit config when the strategy stays ON", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.updateSettings({ allow_merge_commit: true, merge_commit_title: "PR_TITLE" })
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.strictEqual(
        requested[0]?.params.merge_commit_title,
        "PR_TITLE",
        "dropping unconditionally would stop anyone configuring merge titles"
      );
    })
  );
});

describe("GitHubRepository.applySettings", () => {
  it.effect("PATCHes REST-only fields and never touches GraphQL", () =>
    Effect.gen(function* () {
      const { requested, routes } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_wiki: false })),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.deepStrictEqual(requested[0]?.params, {
        owner: "acme",
        repo: "widget",
        has_issues: true,
        has_wiki: false,
      });
      assert.lengthOf(
        A.filter(requested, (c) => c.kind === "graphql"),
        0
      );
      assert.notInclude(routes, "GET /repos/{owner}/{repo}", "no node-id read when nothing needs GraphQL");
    })
  );

  it.effect("routes the three GraphQL-only settings to the mutation, via a node-id read", () =>
    Effect.gen(function* () {
      const { requested, routes } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.applySettings({ has_sponsorships: true, has_pull_requests: false, has_discussions: true })
        ),
        { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
        UPDATE_REPOSITORY
      );

      assert.deepStrictEqual(
        routes,
        ["GET /repos/{owner}/{repo}"],
        "no PATCH: the REST patch silently ignores has_discussions and answers 200"
      );
      assert.deepStrictEqual(
        A.map(
          A.filter(requested, (c) => c.kind === "graphql"),
          ({ kind, route, params }) => ({ kind, route, params })
        ),
        [
          {
            kind: "graphql",
            route: "UpdateRepository",
            params: {
              input: {
                repositoryId: "R_node123",
                hasSponsorshipsEnabled: true,
                hasPullRequestsEnabled: false,
                hasDiscussionsEnabled: true,
              },
            },
          },
        ],
        "hasDiscussionsEnabled is verified against UpdateRepositoryInput by introspection"
      );
    })
  );

  it.effect("splits a map across REST and GraphQL", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_sponsorships: true })),
        {
          "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
          "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
        },
        UPDATE_REPOSITORY
      );

      assert.deepStrictEqual(
        O.getOrUndefined(A.findFirst(requested, (c) => c.route === "PATCH /repos/{owner}/{repo}"))?.params,
        {
          owner: "acme",
          repo: "widget",
          has_issues: true,
        }
      );
      assert.deepStrictEqual(O.getOrUndefined(A.findFirst(requested, (c) => c.kind === "graphql"))?.params, {
        input: { repositoryId: "R_node123", hasSponsorshipsEnabled: true },
      });
    })
  );

  it.effect("shares the patch preparation with updateSettings", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.applySettings({ security_and_analysis: { secret_scanning: "enabled" } })
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.deepStrictEqual(
        requested[0]?.params.security_and_analysis,
        { secret_scanning: { status: "enabled" } },
        "both write paths give a caller the same shape"
      );
    })
  );

  it.effect("sends nothing at all for an empty map", () =>
    Effect.gen(function* () {
      const { requested } = yield* run(Effect.flatMap(GitHubRepository, (r) => r.applySettings({})));

      assert.deepStrictEqual(requested, []);
    })
  );
});

describe("transformSecurityAndAnalysis", () => {
  it("accepts wrapped enabled and disabled statuses while retaining excess properties and identity", () => {
    for (const status of ["enabled", "disabled"]) {
      const wrapped = { status, extra: "retained" };
      const transformed = transformSecurityAndAnalysis({ secret_scanning: wrapped });
      assert.strictEqual(O.getOrUndefined(transformed)?.secret_scanning, wrapped);
      assert.deepStrictEqual(transformed, O.some({ secret_scanning: { status, extra: "retained" } }));
    }
  });

  it("rejects missing and invalid wrapped statuses and array-shaped status values", () => {
    for (const wrapped of [{}, { status: "on" }, { status: 42 }, { status: null }, null, undefined]) {
      assertNone(transformSecurityAndAnalysis({ secret_scanning: wrapped }));
    }
    assertNone(transformSecurityAndAnalysis({ secret_scanning: Object.assign([], { status: "enabled" }) }));
  });
  it("wraps status fields and returns none when nothing survives", () => {
    assert.deepStrictEqual(
      transformSecurityAndAnalysis({ secret_scanning: "enabled" }),
      O.some({ secret_scanning: { status: "enabled" } })
    );
    assertNone(transformSecurityAndAnalysis({}));
    assertNone(transformSecurityAndAnalysis(null));
    assertNone(transformSecurityAndAnalysis("nonsense"));
    const unknownKeyNotForwarded = transformSecurityAndAnalysis({ made_up: "enabled" });
    assertNone(unknownKeyNotForwarded);
    const nonGitHubStatusLiteral = transformSecurityAndAnalysis({ secret_scanning: "on" });
    assertNone(nonGitHubStatusLiteral);
  });

  it("treats an EMPTY reviewer list as no change rather than no reviewers", () => {
    const emptyReviewersGitHubRejects = transformSecurityAndAnalysis({ delegated_bypass_reviewers: [] });
    assertNone(emptyReviewersGitHubRejects);
  });
});

describe("GitHubRepository.applySettings reporting", () => {
  for (const key of ["has_issues", "has_discussions"]) {
    const { script, base } = harness([]);
    it.layer(GitHubRepository.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
      it.effect(`omits undefined ${key} from writes and reports`, () =>
        Effect.gen(function* () {
          const repository = yield* GitHubRepository;
          const report = yield* repository.applySettings({ [key]: undefined });
          assert.deepStrictEqual(report, AppliedSettings.make({ rest: [], graphql: [] }));
          assert.strictEqual(script.count(), 0);
        })
      );
    });
  }
  it.effect("returns a plain object compatible with the owning AppliedSettings schema", () =>
    Effect.gen(function* () {
      const { value } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_issues: true, has_sponsorships: true })),
        {
          "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
          "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)),
        },
        UPDATE_REPOSITORY
      );
      const report: AppliedSettings = value;
      assert.isTrue(S.is(AppliedSettings)(report));
      assert.deepStrictEqual(report, AppliedSettings.make({ rest: ["has_issues"], graphql: ["has_sponsorships"] }));
      const decoded = yield* S.decodeEffect(AppliedSettings)(report);
      assert.deepStrictEqual(decoded, report);
      assert.isFalse(S.is(AppliedSettings)({ rest: [] }));
      assert.isFalse(S.is(AppliedSettings)({ rest: [42], graphql: [] }));
    })
  );
  it.effect("reports the fields it SENT, not the fields it was given", () =>
    Effect.gen(function* () {
      const { value, requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) =>
          r.applySettings({
            allow_merge_commit: false,
            merge_commit_title: "PR_TITLE",
            has_issues: true,
          })
        ),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );

      assert.deepStrictEqual([...value.rest].sort(), ["allow_merge_commit", "has_issues"]);
      assert.notInclude(
        value.rest,
        "merge_commit_title",
        "merge_commit_title is dropped because its strategy is being disabled"
      );
      assert.deepStrictEqual([...value.graphql], []);
      assert.notProperty(requested[0]?.params ?? {}, "merge_commit_title", "the report agrees with the wire");
    })
  );

  it.effect("sends nothing when preparation drops every field it was given", () =>
    Effect.gen(function* () {
      const { value, requested } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.applySettings({ security_and_analysis: 42 })),
        { "PATCH /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) }
      );
      assert.deepStrictEqual(
        [...value.rest],
        [],
        "security_and_analysis: 42 normalises to nothing, so the gate sees no field"
      );
      assert.lengthOf(requested, 0, "no request should have been made at all");
    })
  );

  it.effect("names GraphQL-only fields in the caller's vocabulary", () =>
    Effect.gen(function* () {
      const { value } = yield* run(
        Effect.flatMap(GitHubRepository, (r) => r.applySettings({ has_sponsorships: true })),
        { "GET /repos/{owner}/{repo}": Result.succeed(repositoryFixture(REPO)) },
        UPDATE_REPOSITORY
      );
      assert.deepStrictEqual(
        [...value.graphql],
        ["has_sponsorships"],
        "the report names config keys, not GraphQL input fields"
      );
      assert.deepStrictEqual([...value.rest], []);
    })
  );
});

describe("repositoryPatch", () => {
  it("drops explicitly-undefined fields rather than sending them", () => {
    const patch = repositoryPatch({ has_issues: true, has_wiki: undefined, description: "x" });
    assert.deepStrictEqual(
      patch,
      { has_issues: true, description: "x" },
      "an explicit undefined would overwrite a setting"
    );
    assert.isFalse("has_wiki" in patch, "an unset field must not reach the wire at all");
  });

  it("keeps a field whose value is legitimately false or empty", () => {
    const patch = repositoryPatch({ has_issues: false, description: "" });
    assert.deepStrictEqual(
      patch,
      { has_issues: false, description: "" },
      "the filter is on undefined, not on falsiness"
    );
  });

  it("answers an empty patch when nothing was configured", () => {
    assert.deepStrictEqual(repositoryPatch({ has_issues: undefined, has_wiki: undefined }), {});
  });

  it("accepts a draft built from a settings source, which is the shape that would not assign", () => {
    const configured: { has_issues?: boolean | undefined; has_projects?: boolean | undefined } = {
      has_issues: true,
    };
    const patch = repositoryPatch({ has_issues: configured.has_issues, has_projects: configured.has_projects });
    assert.deepStrictEqual(
      patch,
      { has_issues: true },
      "a boolean | undefined value compiles under exactOptionalPropertyTypes"
    );
  });
});
