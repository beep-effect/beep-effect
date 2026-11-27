import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { Repo, RepoRef } from "@beep/github/Repo";
import { RepositorySecurity } from "@beep/github/RepositorySecurity";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import type { GitHubFixtures, RecordedCall } from "@beep/github/GitHubClient";

const run = Effect.fn("run")(function* <A, E>(
  effect: Effect.Effect<A, E, RepositorySecurity | GitHubClient | Repo>,
  request: NonNullable<GitHubFixtures["request"]>
) {
  const requested: RecordedCall[] = [];
  const layer = RepositorySecurity.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        GitHubClient.layerFixture({ request, requested }),
        Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
      )
    )
  );
  const testScopedContext = yield* Layer.build(layer);
  const value = yield* Effect.provideContext(effect, testScopedContext);
  return { value, requested };
});

const FEATURES = [
  { setter: "setVulnerabilityAlerts", segment: "vulnerability-alerts" },
  { setter: "setAutomatedSecurityFixes", segment: "automated-security-fixes" },
  { setter: "setPrivateVulnerabilityReporting", segment: "private-vulnerability-reporting" },
] as const;

describe("RepositorySecurity setters", () => {
  for (const { setter, segment } of FEATURES) {
    it.effect(`${setter}(true) sends PUT and (false) sends DELETE to /${segment}`, () =>
      Effect.gen(function* () {
        const on = yield* run(
          Effect.flatMap(RepositorySecurity, (s) => s[setter](true)),
          { [`PUT /repos/{owner}/{repo}/${segment}`]: Result.succeed("") }
        );
        assert.strictEqual(on.value, undefined);
        assert.strictEqual(on.requested[0]?.route, `PUT /repos/{owner}/{repo}/${segment}`);
        assert.deepStrictEqual(
          on.requested[0]?.params,
          { owner: "acme", repo: "widget" },
          "the HTTP verb is the value; there is no body either way"
        );

        const off = yield* run(
          Effect.flatMap(RepositorySecurity, (s) => s[setter](false)),
          { [`DELETE /repos/{owner}/{repo}/${segment}`]: Result.succeed("") }
        );
        assert.strictEqual(off.value, undefined);
        assert.strictEqual(off.requested[0]?.route, `DELETE /repos/{owner}/{repo}/${segment}`);
        assert.deepStrictEqual(off.requested[0]?.params, { owner: "acme", repo: "widget" });
      })
    );
  }
});

describe("RepositorySecurity.vulnerabilityAlerts", () => {
  it.effect("reports true when the read succeeds", () =>
    Effect.gen(function* () {
      const { value, requested } = yield* run(
        Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts),
        { "GET /repos/{owner}/{repo}/vulnerability-alerts": Result.succeed("") }
      );

      assert.strictEqual(value, true, "a 204 with no payload: enabled is the absence of a 404");
      assert.deepStrictEqual(requested[0]?.params, { owner: "acme", repo: "widget" });
    })
  );

  it.effect("reports false on 404, because that is how GitHub says disabled", () =>
    Effect.gen(function* () {
      const { value } = yield* run(
        Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts),
        {
          "GET /repos/{owner}/{repo}/vulnerability-alerts": Result.fail(
            GitHubError.notFound("test", "vulnerability alerts")
          ),
        }
      );

      assert.strictEqual(value, false);
    })
  );

  it.effect("does NOT absorb any other failure", () =>
    Effect.gen(function* () {
      const error = yield* run(
        Effect.flatMap(RepositorySecurity, (s) => s.vulnerabilityAlerts),
        {
          "GET /repos/{owner}/{repo}/vulnerability-alerts": Result.fail(
            GitHubError.make({
              kind: "unauthorized",
              operation: "test",
              reason: "the token lacks the required scope",
              status: 403,
            })
          ),
        }
      ).pipe(Effect.flip);

      assert.instanceOf(error, GitHubError, 'the failure value, since the fixture text also holds "unauthorized"');
      assert.strictEqual(error.kind, "unauthorized", "a mis-scoped token is never reported as the feature being off");
    })
  );
});

describe("RepositorySecurity flag reads", () => {
  for (const [method, segment] of [
    ["automatedSecurityFixes", "automated-security-fixes"],
    ["privateVulnerabilityReporting", "private-vulnerability-reporting"],
  ] as const) {
    it.effect(`${method} reads the enabled flag both ways`, () =>
      Effect.gen(function* () {
        const on = yield* run(
          Effect.flatMap(RepositorySecurity, (s) => s[method]),
          { [`GET /repos/{owner}/{repo}/${segment}`]: Result.succeed({ enabled: true }) }
        );
        assert.strictEqual(on.value, true);

        const off = yield* run(
          Effect.flatMap(RepositorySecurity, (s) => s[method]),
          { [`GET /repos/{owner}/{repo}/${segment}`]: Result.succeed({ enabled: false }) }
        );
        assert.strictEqual(off.value, false, "these answer 200 with a payload either way, unlike vulnerability-alerts");

        const missing = yield* run(
          Effect.flatMap(RepositorySecurity, (s) => s[method]),
          { [`GET /repos/{owner}/{repo}/${segment}`]: Result.succeed({}) }
        );
        assert.strictEqual(missing.value, false, "a response with no flag at all is not enabled");
      })
    );
  }
});
