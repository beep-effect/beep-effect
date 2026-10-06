import {
  decideGraphqlBudget,
  GithubCheckRunRecord,
  GithubPullRequestRecord,
  GithubRest,
  GithubReviewThreadNode,
  GithubReviewThreads,
  GraphqlBudget,
  GraphqlBudgetDecisionInput,
  GraphqlBudgetExhausted,
  GraphqlBudgetPolicy,
  GraphqlBudgetSnapshot,
  layerGithubRest,
  layerGraphqlBudget,
  repoSlugFromRemote,
  selectGithubIdentity,
} from "@beep/repo-cli/test/SharedInternals";
import {
  countOutstandingThreads,
  decideYeetGhMergeGate,
  foldCommitMessage,
  latestCheckRunsByName,
  YeetGhGateFacts,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { GitHubClient, GitHubError, GitHubGraphQLError, Repo, RepoRef } from "@effected/github";
import { ConfigProvider, DateTime, Duration, Effect, Fiber, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

// Recorded REST payloads (trimmed to the fields the wire schemas read).
const pullPayload = {
  number: 1501,
  node_id: "PR_kwDOtest",
  title: "feat(yeet): REST-first GitHub operations",
  body: null,
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  mergeable_state: "clean",
  head: { ref: "feat/gh-rest-first", sha: "abc1234def0000000000000000000000000000ff" },
  base: { ref: "main" },
  html_url: "https://github.com/beep-effect/beep-effect/pull/1501",
  user: { login: "kriegcloud" },
  labels: [{ name: "ready-for-heavy" }],
  created_at: "2026-10-06T16:00:00Z",
  updated_at: "2026-10-06T16:30:00Z",
};
const checkRunsPayload = [
  { id: 10, name: "Lint", status: "completed", conclusion: "failure" },
  { id: 11, name: "Lint", status: "completed", conclusion: "success" },
  { id: 12, name: "Test Unit", status: "in_progress", conclusion: null },
];
const rulesPayload = [
  { type: "pull_request" },
  {
    type: "required_status_checks",
    parameters: { required_status_checks: [{ context: "Lint" }, { context: "Test Unit" }] },
  },
];
const timelinePayload = [
  { event: "labeled", created_at: "2026-10-06T16:01:00Z" },
  { event: "ready_for_review", created_at: "2026-10-06T16:10:00Z" },
  { event: "ready_for_review", created_at: "2026-10-06T16:20:00Z" },
];

const repoLayer = Repo.layer(RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }));

const restLayer = (fixtures: Parameters<typeof GitHubClient.layerFixture>[0]) =>
  layerGithubRest.pipe(Layer.provide(Layer.mergeAll(GitHubClient.layerFixture(fixtures), repoLayer)));

it.layer(
  restLayer({
    request: {
      "GET /repos/{owner}/{repo}/pulls/{pull_number}": pullPayload,
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments": [],
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}": GitHubError.notFound("DELETE label", "label"),
    },
    paginate: {
      "GET /repos/{owner}/{repo}/pulls": [pullPayload],
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": checkRunsPayload,
      "GET /repos/{owner}/{repo}/rules/branches/{branch}": rulesPayload,
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline": timelinePayload,
    },
  }),
  { timeout: "30 seconds" }
)("GithubRest over recorded REST payloads", (it) => {
  it.effect("decodes a pull request, its check runs, required contexts, and ready event", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const pr = yield* rest.pullRequest(1501);
      expect(pr.draft).toBe(false);
      expect(pr.body).toBe("");
      expect(pr.labels).toEqual(["ready-for-heavy"]);
      assertSome(pr.mergeableState, "clean");
      expect(A.length(yield* rest.checkRuns(pr.headSha))).toBe(3);
      expect(yield* rest.requiredStatusContexts("main")).toEqual(["Lint", "Test Unit"]);
      assertSome(O.map(yield* rest.readyForReviewAt(1501), DateTime.formatIso), "2026-10-06T16:20:00.000Z");
    })
  );

  it.effect("finds the open pull request for a branch and reports none for another", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      assertSome(
        O.map(yield* rest.openPullRequestForBranch("beep-effect", "feat/gh-rest-first"), (pr) => pr.number),
        1501
      );
      assertNone(yield* rest.openPullRequestForBranch("beep-effect", "feat/other"));
    })
  );

  it.effect("treats removing an absent label as done", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      yield* rest.removeLabel(1501, "absent");
      // An empty one-item page of inline comments proves zero review threads.
      expect(yield* rest.hasReviewComments(1501)).toBe(false);
    })
  );
});

it.layer(restLayer({ request: { "GET /repos/{owner}/{repo}/pulls/{pull_number}": { number: "not a number" } } }), {
  timeout: "30 seconds",
})("GithubRest decode boundary", (it) => {
  it.effect("surfaces a malformed payload as a decode GitHubError", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const error = yield* Effect.flip(rest.pullRequest(1501));
      expect(error.kind).toBe("decode");
    })
  );
});

const snapshot = (remaining: number, resetAt: string) =>
  GraphqlBudgetSnapshot.make({ remaining, resetAt: DateTime.makeUnsafe(resetAt), source: "graphql-probe" });

describe("GraphQL budget decisions", () => {
  const now = DateTime.makeUnsafe("2026-10-06T17:19:00Z");
  const decide = (remaining: number, resetAt: string, policy: GraphqlBudgetPolicy) =>
    decideGraphqlBudget(GraphqlBudgetDecisionInput.make({ snapshot: snapshot(remaining, resetAt), policy, now }));

  it("proceeds at or above the threshold, waits for a near reset, refuses a far one or with no-wait", () => {
    expect(decide(25, "2026-10-06T17:29:00Z", GraphqlBudgetPolicy.default).action).toBe("proceed");
    const wait = decide(3, "2026-10-06T17:29:00Z", GraphqlBudgetPolicy.default);
    expect(wait.action).toBe("wait");
    expect(Duration.toSeconds(wait.waitFor)).toBe(605);
    expect(decide(3, "2026-10-06T19:29:00Z", GraphqlBudgetPolicy.default).action).toBe("refuse");
    expect(decide(3, "2026-10-06T17:29:00Z", GraphqlBudgetPolicy.noWait).action).toBe("refuse");
  });
});

const rateLimitData = (remaining: number, resetAt: string) => ({ rateLimit: { remaining, resetAt } });

const budgetLayer = (client: Parameters<typeof GitHubClient.layerTest>[0]) =>
  layerGraphqlBudget.pipe(Layer.provide(GitHubClient.layerTest(client)));

it.layer(
  budgetLayer({
    graphql: (document) => document.decode(rateLimitData(4000, "2026-10-06T17:29:00Z")).pipe(Effect.orDie),
  }),
  { timeout: "30 seconds" }
)("GraphqlBudget guard with budget", (it) => {
  it.effect("runs the guarded effect when the probe shows enough points", () =>
    Effect.gen(function* () {
      const budget = yield* GraphqlBudget;
      expect(yield* budget.guard("op", GraphqlBudgetPolicy.noWait)(Effect.succeed("ran"))).toBe("ran");
    })
  );
});

it.layer(
  budgetLayer({
    graphql: () =>
      Effect.fail(
        new GitHubGraphQLError({
          kind: "rateLimited",
          operation: "rateLimit",
          reason: "API rate limit exceeded",
          errors: [],
        })
      ),
    // REST reports 4999 here (it misreports GraphQL); only its reset time is used.
    requestDecoded: (_route, _params, schema) =>
      S.decodeUnknownEffect(schema)({ resources: { graphql: { remaining: 4999, reset: 1791307765 } } }).pipe(
        Effect.orDie
      ),
  }),
  { timeout: "30 seconds" }
)("GraphqlBudget guard with a spent budget", (it) => {
  it.effect("fails with resetAt under no-wait, falling back to REST when the probe itself is rate limited", () =>
    Effect.gen(function* () {
      const budget = yield* GraphqlBudget;
      const error = yield* Effect.flip(
        budget.guard("markPullRequestReadyForReview", GraphqlBudgetPolicy.noWait)(Effect.succeed("ran"))
      );
      assertInstanceOf(error, GraphqlBudgetExhausted);
      expect(error.remaining).toBe(0);
      expect(DateTime.formatIso(error.resetAt)).toBe("2026-10-06T17:29:25.000Z");
    })
  );
});

// The first probe reports a spent budget resetting in ten minutes, every later
// probe a fresh one; the guard must sleep through the reset and probe again.
const resettingBudget = Layer.unwrap(
  Effect.map(Ref.make(0), (probes) =>
    budgetLayer({
      graphql: (document) =>
        Ref.getAndUpdate(probes, (n) => n + 1).pipe(
          Effect.flatMap((n) =>
            document.decode(
              n === 0 ? rateLimitData(0, "1970-01-01T00:10:00Z") : rateLimitData(5000, "1970-01-01T01:10:00Z")
            )
          ),
          Effect.orDie
        ),
    })
  )
);

it.layer(resettingBudget, { timeout: "30 seconds" })("GraphqlBudget guard across a reset", (it) => {
  it.effect("waits until the reset, then runs once the re-probe has budget", () =>
    Effect.gen(function* () {
      const budget = yield* GraphqlBudget;
      const fiber = yield* Effect.forkChild(budget.guard("op", GraphqlBudgetPolicy.default)(Effect.succeed("ran")));
      yield* TestClock.adjust(Duration.minutes(11));
      expect(yield* Fiber.join(fiber)).toBe("ran");
    })
  );
});

const pr = (overrides: Partial<ConstructorParameters<typeof GithubPullRequestRecord>[0]> = {}) =>
  GithubPullRequestRecord.make({
    number: 1501,
    nodeId: "PR_kwDOtest",
    title: "feat(yeet): REST-first GitHub operations",
    body: "",
    state: "open",
    draft: false,
    merged: false,
    mergeableState: O.some("clean"),
    headRef: "feat/gh-rest-first",
    headSha: "abc1234def0000000000000000000000000000ff",
    baseRef: "main",
    htmlUrl: "https://github.com/beep-effect/beep-effect/pull/1501",
    author: "kriegcloud",
    labels: [],
    createdAt: DateTime.makeUnsafe("2026-10-06T16:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-10-06T16:00:00Z"),
    ...overrides,
  });

const run = (id: number, name: string, status: string, conclusion: string | null) =>
  GithubCheckRunRecord.make({ id, name, status, conclusion: O.fromNullishOr(conclusion) });

const facts = (overrides: Partial<ConstructorParameters<typeof YeetGhGateFacts>[0]> = {}) =>
  YeetGhGateFacts.make({
    pullRequest: pr(),
    pinnedSha: "abc1234def",
    requiredContexts: O.some(["Lint", "Test Unit"]),
    checkRuns: [run(1, "Lint", "completed", "success"), run(2, "Test Unit", "completed", "skipped")],
    readyAt: O.some(DateTime.makeUnsafe("2026-10-06T16:10:00Z")),
    headCommittedAt: O.some(DateTime.makeUnsafe("2026-10-06T16:05:00Z")),
    outstandingThreads: O.some(0),
    totalThreads: O.some(2),
    tolerated: [],
    forceWindow: false,
    now: DateTime.makeUnsafe("2026-10-06T16:40:00Z"),
    ...overrides,
  });

const reasons = (input: YeetGhGateFacts) => A.map(decideYeetGhMergeGate(input).findings, (finding) => finding.reason);

describe("REST merge gate", () => {
  it("folds the squash body under the 100-character commitlint limit", () => {
    const folded = foldCommitMessage(
      `Squash-merged at ${"a".repeat(40)} by beep yeet gh merge. Tolerated: ${"Heavy / Coverage Regression; ".repeat(4)}`
    );
    expect(A.every(folded.split("\n"), (line) => line.length < 100)).toBe(true);
    expect(folded.replaceAll("\n", " ")).toContain("by beep yeet gh merge.");
  });

  it("is met when every required context is green, the window passed, and threads are zero", () => {
    const verdict = decideYeetGhMergeGate(facts());
    expect(verdict.met).toBe(true);
    expect(verdict.requiredGreen).toBe(2);
  });

  it("keeps the newest run per check name", () => {
    const latest = latestCheckRunsByName([
      run(1, "Lint", "completed", "failure"),
      run(5, "Lint", "completed", "success"),
    ]);
    assertSome(
      O.map(HashMap.get(latest, "Lint"), (entry) => entry.id),
      5
    );
  });

  it("refuses a moved head, a draft, a conflicted base, and a required red", () => {
    expect(
      reasons(
        facts({
          pinnedSha: "fedcba9876",
          pullRequest: pr({ draft: true, mergeableState: O.some("dirty") }),
          checkRuns: [run(1, "Lint", "completed", "failure"), run(2, "Test Unit", "completed", "success")],
        })
      )
    ).toEqual(["head-moved", "draft", "merge-conflict", "required-red"]);
  });

  it("holds on a pending required context and an open review window, and reports holds only", () => {
    const verdict = decideYeetGhMergeGate(
      facts({
        checkRuns: [run(1, "Lint", "completed", "success")],
        now: DateTime.makeUnsafe("2026-10-06T16:20:00Z"),
      })
    );
    expect(A.map(verdict.findings, (finding) => finding.reason)).toEqual(["required-pending", "review-window-open"]);
    expect(verdict.onlyHolds).toBe(true);
  });

  it("never reads an unknown thread count or ruleset as zero", () => {
    expect(reasons(facts({ outstandingThreads: O.none(), requiredContexts: O.none() }))).toEqual([
      "required-contexts-unknown",
      "threads-unknown",
    ]);
  });

  it("refuses a non-required red unless it is tolerated, and the window can be forced", () => {
    const red = [...facts().checkRuns, run(9, "Heavy / Coverage Regression", "completed", "failure")];
    expect(reasons(facts({ checkRuns: red }))).toEqual(["check-red"]);
    expect(reasons(facts({ checkRuns: red, tolerated: ["Heavy / Coverage Regression"] }))).toEqual([]);
    expect(reasons(facts({ now: DateTime.makeUnsafe("2026-10-06T16:12:00Z"), forceWindow: true }))).toEqual([]);
  });
});

const thread = (overrides: Partial<ConstructorParameters<typeof GithubReviewThreadNode>[0]> = {}) =>
  GithubReviewThreadNode.make({
    id: "PRRT_1",
    isResolved: true,
    isOutdated: false,
    path: "a.ts",
    line: 1,
    resolvedBy: { login: "kriegcloud" },
    comments: { nodes: [{ author: { __typename: "User", login: "kriegcloud" }, createdAt: "2026-10-06T16:00:00Z" }] },
    ...overrides,
  });

describe("outstanding review threads", () => {
  it("counts unresolved threads and author-resolved threads a human followed up, not bot acknowledgements", () => {
    const read = GithubReviewThreads.make({
      author: O.some("kriegcloud"),
      threads: [
        thread(),
        thread({ id: "PRRT_2", isResolved: false, resolvedBy: null }),
        thread({ id: "PRRT_3", comments: { nodes: [{ author: { __typename: "User", login: "reviewer" } }] } }),
        thread({ id: "PRRT_4", comments: { nodes: [{ author: { __typename: "Bot", login: "greptile" } }] } }),
      ],
    });
    expect(countOutstandingThreads(read)).toBe(2);
  });
});

describe("GitHub identity selection", () => {
  const select = (env: Record<string, string>, explicit: O.Option<string> = O.none()) =>
    selectGithubIdentity(explicit).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
    );

  it.effect("prefers an explicit token reference, then the env reference, then an App, then gh", () =>
    Effect.gen(function* () {
      assertSome(
        (yield* select({ BEEP_GH_TOKEN_REF: "op://v/env/token" }, O.some("op://v/flag/token"))).tokenRef,
        "op://v/flag/token"
      );
      expect((yield* select({ BEEP_GH_TOKEN_REF: "op://v/env/token" })).kind).toBe("op-ref");
      const app = yield* select({
        BEEP_GH_APP_ID: "123",
        BEEP_GH_APP_INSTALLATION_ID: "456",
        BEEP_GH_APP_KEY_REF: "op://v/app/key",
      });
      expect(app.kind).toBe("github-app");
      assertSome(app.installationId, 456);
      expect((yield* select({})).kind).toBe("gh-cli");
    })
  );

  it.effect("refuses a partial App configuration instead of silently using gh", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(select({ BEEP_GH_APP_ID: "123" }));
      expect(error.reason).toBe("app-config");
    })
  );

  it("parses owner/repo slugs from SSH and HTTPS remotes", () => {
    assertSome(repoSlugFromRemote("https://github.com/beep-effect/beep-effect.git"), "beep-effect/beep-effect");
    assertSome(repoSlugFromRemote("ssh://git@github.com/beep-effect/beep-effect"), "beep-effect/beep-effect");
    assertNone(repoSlugFromRemote("not a remote"));
  });
});
