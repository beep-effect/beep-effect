import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import { GitHubGraphQLError } from "@beep/github/GraphQL";
import { Repo, RepoRef } from "@beep/github/Repo";
import {
  outstanding,
  ReviewThreadActor,
  ReviewThreadComment,
  ReviewThreadNode,
  ReviewThreads,
} from "@beep/github/ReviewThread";
import {
  decideGraphqlBudget,
  GithubCheckRunRecord,
  GithubPullRequestRecord,
  GithubRest,
  GithubTransportFetch,
  GraphqlBudget,
  GraphqlBudgetDecisionInput,
  GraphqlBudgetExhausted,
  GraphqlBudgetPolicy,
  GraphqlBudgetSnapshot,
  isAgentCancellableWorkflowRun,
  layerGithubRest,
  layerGraphqlBudget,
  repoSlugFromRemote,
  selectGithubIdentity,
} from "@beep/repo-cli/test/SharedInternals";
import {
  buildYeetGhLogin,
  decideYeetGhMergeGate,
  foldCommitMessage,
  latestCheckRunsByName,
  layerYeetHeadMoveClassifierTest,
  provideYeetGhLogin,
  recordInheritedRedsWithRest,
  replacePullRequestBodyWithRest,
  runYeetGhMerge,
  SHADOWED_REQUIRED_REMEDY,
  spliceYeetInheritedRedsSection,
  YeetGhGateFacts,
  YeetHeadMoveUnknown,
  YeetReadyInheritedRed,
  YeetReviewWindowUnknown,
} from "@beep/repo-cli/test/Yeet";
import { NodeCrypto } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { dual, flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import {
  ADMITTED_SUITE,
  admittedSuite,
  CHECK_SUITE,
  checkSuite,
  HEAVY_ADMIT_WORKFLOW,
  LIVE_SUITE,
  liveSuite,
  pr3133Suites,
  SHADOWED_CONTEXTS,
  SKIPPED_RUN,
  SKIPPED_SUITE,
  skippedSuite,
  workflowSuite,
} from "./support/ShadowedSuites.ts";
import { recordedGithub } from "./support/YeetGithub.ts";
import type { GraphQLDocument } from "@beep/github/GraphQL";
import type { GithubAnswer, GithubCall } from "./support/YeetGithub.ts";

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
  base: { ref: "main", sha: "base000000" },
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
// The PR head sha also carries a main push run (a branch fast-forwarded to
// main's tip): cancel-queued must leave it alone.
const workflowRunsPayload = [
  {
    id: 20,
    name: "Check",
    status: "queued",
    conclusion: null,
    head_sha: pullPayload.head.sha,
    event: "pull_request",
    head_branch: "feat/gh-rest-first",
    path: ".github/workflows/check.yml",
    created_at: "2026-10-06T16:30:00Z",
  },
  {
    id: 21,
    name: "Check",
    status: "in_progress",
    conclusion: null,
    head_sha: pullPayload.head.sha,
    event: "push",
    head_branch: "main",
    path: ".github/workflows/check.yml",
    created_at: "2026-10-06T16:31:00Z",
  },
  {
    id: 22,
    name: "Check",
    status: "queued",
    conclusion: null,
    head_sha: pullPayload.head.sha,
    path: ".github/workflows/check.yml",
    created_at: "2026-10-06T16:32:00Z",
  },
];
const timelinePayload = [
  { event: "labeled", created_at: "2026-10-06T16:01:00Z" },
  { event: "ready_for_review", created_at: "2026-10-06T16:10:00Z" },
  { event: "ready_for_review", created_at: "2026-10-06T16:20:00Z" },
  { event: "head_ref_force_pushed", created_at: "2026-10-06T16:35:00Z", commit_id: "after-sha" },
  { event: "head_ref_force_pushed", created_at: "2026-10-06T16:34:00Z", commit_id: null },
  { event: "head_ref_force_pushed", created_at: "2026-10-06T16:33:00Z" },
];

const repoLayer = Repo.layer(RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }));

// The recorded pages are trimmed to the fields GithubRest's wire schemas read,
// so they cannot meet octokit's full item types; GithubRest re-decodes every
// item it reads, which is the boundary these suites exercise.
const TrimmedPage = S.Array(S.Any);

// Decode a recorded payload against the schema the code under test asked for,
// failing the way the live client does when GitHub's answer does not fit.
const decodeRecorded = <A, I>(route: string, schema: S.Codec<A, I>, recorded: unknown): Effect.Effect<A, GitHubError> =>
  S.decodeUnknownEffect(schema)(recorded).pipe(
    Effect.mapError((cause) => GitHubError.decode(route, "recorded response did not match its schema", cause))
  );

// Recorded responses keyed by route: `requestDecoded` holds raw payloads (or the
// `GitHubError` the call fails with) and `paginate` holds whole collections.
const restLayer = (
  requestDecoded: Readonly<Record<string, unknown>>,
  paginate: Readonly<Record<string, ReadonlyArray<unknown>>> = {}
) =>
  layerGithubRest.pipe(
    Layer.provide(
      Layer.mergeAll(
        GitHubClient.layerTest({
          requestDecoded: dual(3, <A, I>(route: string, _params: Record<string, unknown>, schema: S.Codec<A, I>) =>
            O.match(R.get(requestDecoded, route), {
              onNone: () => Effect.die(`no recorded requestDecoded response for ${route}`),
              onSome: (recorded): Effect.Effect<A, GitHubError> =>
                S.is(GitHubError)(recorded) ? Effect.fail(recorded) : decodeRecorded(route, schema, recorded),
            })
          ),
          paginate: dual(
            (args) => P.isString(args[0]),
            (route: string) =>
              S.decodeEffect(TrimmedPage)(O.getOrElse(R.get(paginate, route), A.empty)).pipe(Effect.orDie)
          ),
        }),
        repoLayer
      )
    )
  );

it.layer(
  restLayer(
    {
      "GET /repos/{owner}/{repo}/pulls/{pull_number}": pullPayload,
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments": [],
      "GET /repos/{owner}/{repo}/commits/{ref}/check-suites": {
        check_suites: [{ created_at: "2026-10-06T16:30:00Z" }],
      },
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}": GitHubError.notFound("DELETE label", "label"),
    },
    {
      "GET /repos/{owner}/{repo}/pulls": [pullPayload],
      "GET /repos/{owner}/{repo}/commits/{ref}/check-runs": checkRunsPayload,
      "GET /repos/{owner}/{repo}/rules/branches/{branch}": rulesPayload,
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline": timelinePayload,
      "GET /repos/{owner}/{repo}/actions/runs": workflowRunsPayload,
    }
  ),
  { timeout: "30 seconds" }
)("GithubRest over recorded REST payloads", (it) => {
  it.effect("keeps only pull-request runs cancellable, never a main push run on the same sha", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const runs = yield* rest.workflowRunsForSha(pullPayload.head.sha);
      expect(A.map(runs, (run) => [run.id, run.event] as const)).toEqual([
        [20, "pull_request"],
        [21, "push"],
        [22, "unknown"],
      ]);
      assertSome(
        O.flatMap(
          A.findFirst(runs, (run) => run.id === 21),
          (run) => run.headBranch
        ),
        "main"
      );
      expect(A.map(A.filter(runs, isAgentCancellableWorkflowRun), (run) => run.id)).toEqual([20]);
    })
  );

  it.effect("decodes a pull request, its check runs, required contexts, and ready event", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const pr = yield* rest.pullRequest(1501);
      expect(pr.draft).toBe(false);
      expect(pr.baseSha).toBe("base000000");
      expect(pr.body).toBe("");
      expect(pr.labels).toEqual(["ready-for-heavy"]);
      assertSome(pr.mergeableState, "clean");
      const checkRuns1 = yield* rest.checkRuns(pr.headSha);
      expect(A.length(checkRuns1)).toBe(3);
      const requiredStatusContexts2 = yield* rest.requiredStatusContexts("main");
      expect(requiredStatusContexts2).toEqual(["Lint", "Test Unit"]);
      const timeline = yield* rest.reviewTimeline(1501);
      assertSome(O.map(timeline.readyAt, DateTime.formatIso), "2026-10-06T16:20:00.000Z");
      assertSome(
        O.map(
          A.reduce(timeline.forcePushes, DateTime.makeUnsafe("1970-01-01T00:00:00Z"), (at, event) =>
            DateTime.max(at, event.at)
          ).pipe(O.some),
          DateTime.formatIso
        ),
        "2026-10-06T16:35:00.000Z"
      );
      expect(A.length(timeline.forcePushes)).toBe(3);
      assertSome(
        O.flatMap(A.head(timeline.forcePushes), (push) => push.commitId),
        "after-sha"
      );
      expect(A.map(A.drop(timeline.forcePushes, 1), (push) => O.isNone(push.commitId))).toEqual([true, true]);
      const headFirstReceivedAt3 = yield* rest.headFirstReceivedAt(pr.headSha);
      assertSome(O.map(headFirstReceivedAt3, DateTime.formatIso), "2026-10-06T16:30:00.000Z");
    })
  );

  it.effect("finds the open pull request for a branch and reports none for another", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      const openPullRequestForBranch4 = yield* rest.openPullRequestForBranch("beep-effect", "feat/gh-rest-first");
      assertSome(
        O.map(openPullRequestForBranch4, (pr) => pr.number),
        1501
      );
      const openPullRequestForBranch5 = yield* rest.openPullRequestForBranch("beep-effect", "feat/other");
      assertNone(openPullRequestForBranch5);
    })
  );

  it.effect("treats removing an absent label as done", () =>
    Effect.gen(function* () {
      const rest = yield* GithubRest;
      yield* rest.removeLabel(1501, "absent");
      // An empty one-item page of inline comments proves zero review threads.
      const hasReviewComments6 = yield* rest.hasReviewComments(1501);
      expect(hasReviewComments6).toBe(false);
    })
  );
});

it.layer(restLayer({ "GET /repos/{owner}/{repo}/pulls/{pull_number}": { number: "not a number" } }), {
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

// `graphql` answers every document; `restRateLimit` is the raw `GET /rate_limit`
// payload the REST fallback decodes.
const budgetLayer = (stubs: {
  readonly graphql: <A, V extends Record<string, unknown>>(
    document: GraphQLDocument<A, V>
  ) => Effect.Effect<A, GitHubGraphQLError>;
  readonly restRateLimit?: unknown;
}) =>
  layerGraphqlBudget.pipe(
    Layer.provide(
      GitHubClient.layerTest({
        graphql: dual(2, <A, V extends Record<string, unknown>>(document: GraphQLDocument<A, V>, _variables: V) =>
          stubs.graphql(document)
        ),
        requestDecoded: dual(3, <A, I>(route: string, _params: Record<string, unknown>, schema: S.Codec<A, I>) =>
          decodeRecorded(route, schema, stubs.restRateLimit).pipe(Effect.orDie)
        ),
      })
    )
  );

it.layer(
  budgetLayer({
    graphql: (document) => document.decode(rateLimitData(4000, "2026-10-06T17:29:00Z")).pipe(Effect.orDie),
  }),
  { timeout: "30 seconds" }
)("GraphqlBudget guard with budget", (it) => {
  it.effect("runs the guarded effect when the probe shows enough points", () =>
    Effect.gen(function* () {
      const budget = yield* GraphqlBudget;
      const value = yield* budget.guard("op", GraphqlBudgetPolicy.noWait)(Effect.succeed("ran"));
      expect(value).toBe("ran");
    })
  );
});

it.layer(
  budgetLayer({
    graphql: () =>
      Effect.fail(
        GitHubGraphQLError.make({
          kind: "rateLimited",
          operation: "rateLimit",
          reason: "API rate limit exceeded",
          errors: [],
        })
      ),
    // REST reports 4999 here (it misreports GraphQL); only its reset time is used.
    restRateLimit: { resources: { graphql: { remaining: 4999, reset: 1791307765 } } },
  }),
  { timeout: "30 seconds" }
)("GraphqlBudget guard with a spent budget", (it) => {
  it.effect("fails with resetAt under no-wait, falling back to REST when the probe itself is rate limited", () =>
    Effect.gen(function* () {
      const budget = yield* GraphqlBudget;
      const error = yield* Effect.succeed("ran").pipe(
        budget.guard("markPullRequestReadyForReview", GraphqlBudgetPolicy.noWait),
        Effect.flip
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
      const fiber = yield* Effect.succeed("ran").pipe(
        budget.guard("op", GraphqlBudgetPolicy.default),
        Effect.forkChild
      );
      yield* TestClock.adjust(Duration.minutes(11));
      const join7 = yield* Fiber.join(fiber);
      expect(join7).toBe("ran");
    })
  );
});

const pr = (overrides: Partial<Parameters<typeof GithubPullRequestRecord.make>[0]> = {}) =>
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
    baseSha: "base000000",
    htmlUrl: "https://github.com/beep-effect/beep-effect/pull/1501",
    author: "kriegcloud",
    labels: [],
    createdAt: DateTime.makeUnsafe("2026-10-06T16:00:00Z"),
    updatedAt: DateTime.makeUnsafe("2026-10-06T16:00:00Z"),
    ...overrides,
  });

describe("yeet gh pr body", () => {
  const footer = "<!-- yeet-provenance:start -->\nfooter\n<!-- yeet-provenance:end -->\n";
  const fakeRest = (body: string, writes: Ref.Ref<ReadonlyArray<string>>) => ({
    pullRequest: () => Effect.succeed(pr({ body })),
    updatePullRequest: (_number: number, update: { readonly body?: string | undefined }) =>
      Ref.update(writes, A.append(update.body ?? "")).pipe(Effect.as(pr({ body: update.body ?? "" }))),
  });

  it.effect("writes the new body with the live footer kept", () =>
    Effect.gen(function* () {
      const writes = yield* Ref.make<ReadonlyArray<string>>([]);
      const kept = yield* replacePullRequestBodyWithRest(fakeRest(`Old\n\n${footer}`, writes), 1501, "New summary");
      expect(kept).toBe(true);
      const got = yield* Ref.get(writes);
      expect(got).toEqual([`New summary\n\n${footer}`]);
    })
  );

  it.effect("reports a body that had no footer to keep", () =>
    Effect.gen(function* () {
      const writes = yield* Ref.make<ReadonlyArray<string>>([]);
      const kept = yield* replacePullRequestBodyWithRest(fakeRest("Old", writes), 1501, "New summary\n");
      expect(kept).toBe(false);
      const got = yield* Ref.get(writes);
      expect(got).toEqual(["New summary"]);
    })
  );
});

describe("inherited-red body reconciliation", () => {
  const entries = [YeetReadyInheritedRed.make({ check: "Lint", attribution: "inherited from main" })];

  it.effect("re-splices a concurrent provenance edit before writing", () =>
    Effect.gen(function* () {
      const source = "Summary";
      const concurrent = `${source}\n\n<!-- beep:pr-provenance:start -->\nNew provenance\n<!-- beep:pr-provenance:end -->`;
      const reads = yield* Ref.make(0);
      const writes = yield* Ref.make(A.empty<string>());
      const expected = O.getOrThrow(spliceYeetInheritedRedsSection(concurrent, entries, pr().headSha));
      const rest = {
        pullRequest: () =>
          Ref.getAndUpdate(reads, (n) => n + 1).pipe(
            Effect.map((n) => pr({ body: n === 0 ? source : n < 3 ? concurrent : expected }))
          ),
        updatePullRequest: (_number: number, update: { readonly body?: string | undefined }) =>
          Ref.update(writes, A.append(update.body ?? "")).pipe(Effect.as(pr({ body: update.body ?? "" }))),
      };
      yield* recordInheritedRedsWithRest(rest, 1501, entries, pr().headSha);
      const got = yield* Ref.get(writes);
      expect(got).toEqual([expected]);
      expect(expected).toContain("New provenance");
    })
  );

  it.effect("refuses persistent contention after three rounds without writing", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const writes = yield* Ref.make(0);
      const error = yield* Effect.flip(
        recordInheritedRedsWithRest(
          {
            pullRequest: () => Ref.getAndUpdate(reads, (n) => n + 1).pipe(Effect.map((n) => pr({ body: `Edit ${n}` }))),
            updatePullRequest: () => Ref.update(writes, (n) => n + 1).pipe(Effect.as(pr())),
          },
          1501,
          entries,
          pr().headSha
        )
      );
      expect(error.message).toContain("all three");
      const got8 = yield* Ref.get(reads);
      expect(got8).toBe(4);
      const got9 = yield* Ref.get(writes);
      expect(got9).toBe(0);
    })
  );

  it.effect("refuses malformed markers on a fresh concurrent body without writing", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const writes = yield* Ref.make(0);
      const error = yield* Effect.flip(
        recordInheritedRedsWithRest(
          {
            pullRequest: () =>
              Ref.getAndUpdate(reads, (n) => n + 1).pipe(
                Effect.map((n) => pr({ body: n === 0 ? "Summary" : "<!-- yeet-inherited-reds:start -->" }))
              ),
            updatePullRequest: () => Ref.update(writes, (n) => n + 1).pipe(Effect.as(pr())),
          },
          1501,
          entries,
          pr().headSha
        )
      );
      expect(error.message).toContain("markers");
      const got10 = yield* Ref.get(writes);
      expect(got10).toBe(0);
    })
  );

  it.effect("refuses readback drift after a write", () =>
    Effect.gen(function* () {
      const reads = yield* Ref.make(0);
      const writes = yield* Ref.make(0);
      const error = yield* Effect.flip(
        recordInheritedRedsWithRest(
          {
            pullRequest: () =>
              Ref.getAndUpdate(reads, (n) => n + 1).pipe(
                Effect.map((n) => pr({ body: n < 2 ? "Summary" : "Concurrent edit after PATCH" }))
              ),
            updatePullRequest: () => Ref.update(writes, (n) => n + 1).pipe(Effect.as(pr())),
          },
          1501,
          entries,
          pr().headSha
        )
      );
      expect(error.message).toContain("drifted");
      const got11 = yield* Ref.get(writes);
      expect(got11).toBe(1);
    })
  );

  it.effect("rewrites an existing section to None through the same bounded writer when no reds apply", () =>
    Effect.gen(function* () {
      const source = O.getOrThrow(spliceYeetInheritedRedsSection("Summary", entries, pr().headSha));
      const body = yield* Ref.make(source);
      const writes = yield* Ref.make(0);
      yield* recordInheritedRedsWithRest(
        {
          pullRequest: () => Ref.get(body).pipe(Effect.map((body) => pr({ body }))),
          updatePullRequest: (_number: number, update: { readonly body?: string | undefined }) =>
            Ref.set(body, update.body ?? "").pipe(Effect.andThen(Ref.update(writes, (n) => n + 1)), Effect.as(pr())),
        },
        1501,
        [],
        pr().headSha
      );
      const got12 = yield* Ref.get(body);
      expect(got12).toContain("None: no required check is red on this head.");
      const got13 = yield* Ref.get(body);
      expect(got13).toContain(`Inherited reds (S11) at ${Str.slice(0, 10)(pr().headSha)}`);
      const got14 = yield* Ref.get(body);
      expect(got14).toContain("Summary");
      const got15 = yield* Ref.get(writes);
      expect(got15).toBe(1);
    })
  );

  it.effect("writes nothing for an empty set without an existing section", () =>
    Effect.gen(function* () {
      const writes = yield* Ref.make(0);
      yield* recordInheritedRedsWithRest(
        {
          pullRequest: () => Effect.succeed(pr({ body: "Summary" })),
          updatePullRequest: () => Ref.update(writes, (n) => n + 1).pipe(Effect.as(pr())),
        },
        1501,
        [],
        pr().headSha
      );
      const got16 = yield* Ref.get(writes);
      expect(got16).toBe(0);
    })
  );

  it.effect("confirms an already-current section without writing", () =>
    Effect.gen(function* () {
      const body = O.getOrThrow(spliceYeetInheritedRedsSection("Summary", entries, pr().headSha));
      const writes = yield* Ref.make(0);
      yield* recordInheritedRedsWithRest(
        {
          pullRequest: () => Effect.succeed(pr({ body })),
          updatePullRequest: () => Ref.update(writes, (n) => n + 1).pipe(Effect.as(pr())),
        },
        1501,
        entries,
        pr().headSha
      );
      const got17 = yield* Ref.get(writes);
      expect(got17).toBe(0);
    })
  );
});

const run = (id: number, name: string, status: string, conclusion: string | null) =>
  GithubCheckRunRecord.make({ id, name, status, conclusion: O.fromNullishOr(conclusion) });

const facts = (overrides: Partial<Parameters<typeof YeetGhGateFacts.make>[0]> = {}) =>
  YeetGhGateFacts.make({
    pullRequest: pr(),
    pinnedSha: "abc1234def",
    requiredContexts: O.some(["Lint", "Test Unit"]),
    checkRuns: [run(1, "Lint", "completed", "success"), run(2, "Test Unit", "completed", "skipped")],
    readyAt: O.some(DateTime.makeUnsafe("2026-10-06T16:10:00Z")),
    headPushedAt: O.some(DateTime.makeUnsafe("2026-10-06T16:05:00Z")),
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
      `Squash-merged at ${Str.repeat(40)("a")} by beep yeet gh merge. Tolerated: ${Str.repeat(4)("Heavy / Coverage Regression; ")}`
    );
    expect(A.every(Str.split("\n")(folded), (line) => line.length < 100)).toBe(true);
    expect(Str.replaceAll("\n", " ")(folded)).toContain("by beep yeet gh merge.");
  });

  it("is met when every required context is green, the window passed, and threads are zero", () => {
    const verdict = decideYeetGhMergeGate(facts());
    expect(verdict.met).toBe(true);
    expect(verdict.requiredGreen).toBe(2);
  });

  it("holds a ready pull request for a newly received head even when its commit metadata is old", () => {
    const verdict = decideYeetGhMergeGate(facts({ headPushedAt: O.some(DateTime.makeUnsafe("2026-10-06T16:39:00Z")) }));
    expect(A.map(verdict.findings, (finding) => finding.reason)).toEqual(["review-window-open"]);
  });

  it("holds transient unknown windows with their reason and refuses invalid local configuration", () => {
    const unknownFacts = (reason: string) =>
      facts({ headPushedAt: O.none(), windowResult: O.some(YeetReviewWindowUnknown.make({ reason })) });
    const transient = decideYeetGhMergeGate(unknownFacts("the timeline of pull request #1501 could not be read"));
    expect(transient.onlyHolds).toBe(true);
    expect(transient.findings).toMatchObject([
      { reason: "review-window-unknown", detail: "the timeline of pull request #1501 could not be read" },
    ]);
    const invalid = decideYeetGhMergeGate(
      facts({
        headPushedAt: O.none(),
        windowConfigValid: false,
        windowResult: O.some(
          YeetReviewWindowUnknown.make({ reason: "BEEP_YEET_REVIEW_WINDOW is not a duration such as 20 minutes" })
        ),
      })
    );
    expect(invalid.onlyHolds).toBe(false);
    expect(invalid.findings).toMatchObject([
      { reason: "review-window-config", detail: "BEEP_YEET_REVIEW_WINDOW is not a duration such as 20 minutes" },
    ]);
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

  it("keeps the newest run when an older one is listed after it", () => {
    const latest = latestCheckRunsByName([
      run(5, "Lint", "completed", "success"),
      run(1, "Lint", "completed", "failure"),
    ]);
    assertSome(
      O.map(HashMap.get(latest, "Lint"), (entry) => entry.id),
      5
    );
  });

  it("holds on a required context whose run is still in progress, naming it without a no-run note", () => {
    const verdict = decideYeetGhMergeGate(
      facts({ checkRuns: [run(1, "Lint", "completed", "success"), run(2, "Test Unit", "in_progress", null)] })
    );
    const pending = A.findFirst(verdict.findings, (finding) => finding.reason === "required-pending");
    assertSome(
      O.map(pending, (finding) => finding.detail),
      "Test Unit"
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

  // #3133 (2026-11-12): a later label's Heavy Admit run skipped, so the ruleset read the heavy
  // checks the earlier run reported as "expected".
  it("refuses a required context green only in a suite a newer skipped Heavy Admit run replaced", () => {
    const required = ["Lint", "Heavy / Test Integration", ...SHADOWED_CONTEXTS];
    const suiteRun = (id: number, name: string, suite: number, conclusion = "success") =>
      GithubCheckRunRecord.make({
        id,
        name,
        status: "completed",
        conclusion: O.some(conclusion),
        checkSuiteId: O.some(suite),
      });
    const shadowFacts = (workflowSuites: typeof pr3133Suites, heavy = "success") =>
      facts({
        requiredContexts: O.some(required),
        checkRuns: [
          suiteRun(1, "Lint", CHECK_SUITE),
          suiteRun(2, "Heavy / Test Integration", CHECK_SUITE),
          ...A.map(SHADOWED_CONTEXTS, (name, index) => suiteRun(10 + index, name, ADMITTED_SUITE, heavy)),
          suiteRun(20, "Heavy Admission", SKIPPED_SUITE, "skipped"),
          suiteRun(21, "Heavy", SKIPPED_SUITE, "skipped"),
        ],
        workflowSuites,
      });
    const refused = decideYeetGhMergeGate(shadowFacts(pr3133Suites));
    expect(refused.findings).toMatchObject([
      {
        reason: "required-shadowed",
        detail: `the ruleset reads these as expected: Heavy / Check, Heavy / Docgen, Heavy / Doctest passed only in check suite ${ADMITTED_SUITE}, replaced by newer ${HEAVY_ADMIT_WORKFLOW} pull_request run ${SKIPPED_RUN} (skipped); ${SHADOWED_REQUIRED_REMEDY}`,
      },
    ]);
    // A refusal, not a hold: `yeet gh merge` exits 1, as for a required red.
    expect(refused.onlyHolds).toBe(false);
    expect(decideYeetGhMergeGate(shadowFacts([checkSuite, admittedSuite])).met).toBe(true);
    // While the newer run is still going it may yet re-report them: a hold (exit 75).
    const running = decideYeetGhMergeGate(
      shadowFacts([
        checkSuite,
        admittedSuite,
        workflowSuite({ ...skippedSuite, status: "in_progress", conclusion: O.none() }),
      ])
    );
    expect(A.map(running.findings, (finding) => finding.reason)).toEqual(["required-pending"]);
    expect(running.onlyHolds).toBe(true);
    // A red admitted run hidden by the later skipped run is a refusal (exit 1), never a pending
    // hold (exit 75) that time cannot clear, even while the replacing run is still going.
    for (const suites of [
      pr3133Suites,
      [checkSuite, admittedSuite, workflowSuite({ ...skippedSuite, status: "in_progress", conclusion: O.none() })],
    ]) {
      const hiddenRed = decideYeetGhMergeGate(shadowFacts(suites, "failure"));
      expect(A.map(hiddenRed.findings, (finding) => finding.reason)).toEqual(["required-red"]);
      expect(hiddenRed.onlyHolds).toBe(false);
    }
    expect(decideYeetGhMergeGate(shadowFacts(pr3133Suites, "failure")).findings).toMatchObject([
      {
        reason: "required-red",
        detail: `red in a replaced check suite: Heavy / Check=failure, Heavy / Docgen=failure, Heavy / Doctest=failure failed only in check suite ${ADMITTED_SUITE}, replaced by newer ${HEAVY_ADMIT_WORKFLOW} pull_request run ${SKIPPED_RUN} (skipped)`,
      },
    ]);
    // The admitted run re-run after a later run reported the heavy checks: the copy's higher ids
    // never override the live suite, so a red copy holds nothing and a green copy hides no red.
    const rerunFacts = (live: string, copy: string) =>
      facts({
        requiredContexts: O.some(required),
        checkRuns: [
          ...shadowFacts(pr3133Suites).checkRuns,
          ...A.map(SHADOWED_CONTEXTS, (name, index) => suiteRun(30 + index, name, LIVE_SUITE, live)),
          ...A.map(SHADOWED_CONTEXTS, (name, index) => suiteRun(40 + index, name, ADMITTED_SUITE, copy)),
        ],
        workflowSuites: [...pr3133Suites, liveSuite],
      });
    expect(decideYeetGhMergeGate(rerunFacts("success", "failure")).met).toBe(true);
    expect(reasons(rerunFacts("failure", "success"))).toEqual(["required-red"]);
    // A re-report (heavy.yml with `admitted: false`) reports each lane skipped, which passes.
    expect(decideYeetGhMergeGate(rerunFacts("skipped", "success")).met).toBe(true);
    // An optional red the admitted run reported is still `check-red`: the ruleset reads required contexts only.
    const optionalRed = facts({
      requiredContexts: O.some(required),
      checkRuns: [
        ...shadowFacts(pr3133Suites).checkRuns,
        suiteRun(15, "Heavy / Lint Policy", ADMITTED_SUITE, "failure"),
      ],
      workflowSuites: pr3133Suites,
    });
    expect(decideYeetGhMergeGate(optionalRed).findings).toMatchObject([
      { reason: "required-shadowed" },
      { reason: "check-red", detail: `Heavy / Lint Policy=failure (attribute it, then --tolerate "<name>")` },
    ]);
  });
});

const comment = (login: string, isBot = false) =>
  ReviewThreadComment.make({
    id: "PRRC_1",
    databaseId: O.none(),
    author: O.some(ReviewThreadActor.make({ login, isBot })),
    body: "",
    path: "a.ts",
    line: O.some(1),
    originalLine: O.some(1),
    createdAt: "2026-10-06T16:00:00Z",
    url: "https://github.com/beep-effect/beep-effect/pull/1#discussion_r1",
  });

const thread = (overrides: Partial<Parameters<typeof ReviewThreadNode.make>[0]> = {}) =>
  ReviewThreadNode.make({
    id: "PRRT_1",
    isResolved: true,
    isOutdated: false,
    isCollapsed: false,
    path: "a.ts",
    line: O.some(1),
    startLine: O.none(),
    diffSide: "RIGHT",
    resolvedBy: O.some("kriegcloud"),
    comments: [],
    commentsTruncated: false,
    newestComment: O.some(comment("kriegcloud")),
    ...overrides,
  });

describe("outstanding review threads", () => {
  it("counts unresolved threads and author-resolved threads a human followed up, not bot acknowledgements", () => {
    const read = ReviewThreads.make({
      pullRequestAuthor: O.some("kriegcloud"),
      threads: [
        thread(),
        thread({ id: "PRRT_2", isResolved: false, resolvedBy: O.none() }),
        thread({ id: "PRRT_3", newestComment: O.some(comment("reviewer")) }),
        thread({ id: "PRRT_4", newestComment: O.some(comment("greptile", true)) }),
      ],
    });
    expect(outstanding(read)).toBe(2);
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

it.layer(NodeCrypto.layer)("the gh-login edge", (it) => {
  // `gh auth token` answers `token` (a failure when empty); `git remote get-url origin` names the repository.
  const spawner = (token: string) =>
    ScriptedSpawner.make((_command, args) => {
      const output = A.contains(args, "token") ? token : "git@github.com:beep-effect/beep-effect.git\n";
      return { stdout: output, exit: Str.isEmpty(output) ? 1 : 0 };
    });
  const withSpawner = (token: string) =>
    flow(
      provideSpawner(spawner(token)),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} }))
    );

  it.effect("builds the services as the gh login, with the repository from origin", () =>
    Effect.gen(function* () {
      const context = yield* Effect.scoped(buildYeetGhLogin("."));
      const repo = Context.get(context, Repo);
      expect(`${repo.owner}/${repo.repo}`).toBe("beep-effect/beep-effect");
    }).pipe(withSpawner("gho_operator"))
  );

  it.effect("folds a gh login that returns no token into a GitHub access failure", () =>
    Effect.gen(function* () {
      const error = yield* provideYeetGhLogin(".")(GithubRest.use((rest) => rest.pullRequest(1))).pipe(Effect.flip);
      expect(error.message).toMatch(/^GitHub access failed \(/u);
      expect(error._tag).toBe("YeetCommandError");
    }).pipe(withSpawner(""))
  );
});

// #3133 end to end: `yeet gh merge` reads the head's check runs with their suites and its workflow
// runs over the recorded REST transport, refuses the shadowed checks and never sends the merge.
// The window and head-move reads have nothing to classify here (the window is forced).
it.layer(
  Layer.mergeAll(
    NodeCrypto.layer,
    // The merge path never touches the filesystem here (the window is forced, nothing is fetched).
    FileSystem.layerNoop({}),
    layerYeetHeadMoveClassifierTest((request) => YeetHeadMoveUnknown.make({ ...request, reason: "fixture" }))
  ),
  { timeout: "60 seconds" }
)("yeet gh merge over recorded REST (#3133)", (it) => {
  const headSha = pullPayload.head.sha;
  const required = ["Lint", ...SHADOWED_CONTEXTS];
  const checkRun = (id: number, name: string, suite: number, conclusion: string) => ({
    id,
    name,
    status: "completed",
    conclusion,
    check_suite: { id: suite },
  });
  const routes =
    (heavy: string) =>
    (call: GithubCall): GithubAnswer | undefined => {
      if (call.path === "{repo}/pulls/1501") return { body: pullPayload };
      if (call.path === "{repo}/rules/branches/main")
        return {
          body: [
            {
              type: "required_status_checks",
              parameters: { required_status_checks: A.map(required, (context) => ({ context })) },
            },
          ],
        };
      if (call.path === `{repo}/commits/${headSha}/check-runs`)
        return {
          body: {
            total_count: 6,
            check_runs: [
              checkRun(1, "Lint", CHECK_SUITE, "success"),
              ...A.map(SHADOWED_CONTEXTS, (name, index) => checkRun(10 + index, name, ADMITTED_SUITE, heavy)),
              checkRun(20, "Heavy Admission", SKIPPED_SUITE, "skipped"),
              checkRun(21, "Heavy", SKIPPED_SUITE, "skipped"),
            ],
          },
        };
      if (call.path === "{repo}/actions/runs" && call.query.get("head_sha") === headSha)
        return {
          body: {
            total_count: A.length(pr3133Suites),
            workflow_runs: A.map(pr3133Suites, (suite) => ({
              id: suite.runId,
              name: "Heavy Admit",
              head_sha: headSha,
              status: suite.status,
              conclusion: O.getOrNull(suite.conclusion),
              check_suite_id: suite.checkSuiteId,
              path: suite.workflowPath,
              event: suite.event,
              created_at: DateTime.formatIso(suite.createdAt),
            })),
          },
        };
      // No inline review comments: the REST fallback proves zero threads when GraphQL is not served.
      if (call.path === "{repo}/pulls/1501/comments") return { body: [] };
      return undefined;
    };
  const ghAuthToken = ScriptedSpawner.make((command, args) =>
    A.join([command, ...args], " ") === "gh auth token"
      ? { stdout: "gho_operator\n" }
      : { exit: 1, stderr: "yeet gh merge spawns only gh auth token here" }
  );

  // The admitted run's heavy lanes green (shadowed) or red (a hidden red): both refuse with exit 1.
  const refusesWithoutMerging = Effect.fnUntraced(function* (heavy: string, reason: string) {
    const github = recordedGithub(routes(heavy));
    const failure = yield* runYeetGhMerge({
      tokenRef: O.none(),
      number: 1501,
      sha: headSha,
      tolerate: [],
      forceWindow: true,
      dryRun: false,
      noWait: true,
    }).pipe(
      Effect.flip,
      Effect.provideService(GithubTransportFetch, O.some(github.fetch)),
      provideSpawner(ghAuthToken),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ GH_REPO: "beep-effect/beep-effect" })
      )
    );
    expect(failure).toMatchObject({ _tag: "CliReportedExit", exitCode: 1 });
    expect(failure.message).toBe(`[gh] not merging #1501: ${reason}`);
    expect(A.some(github.calls, (call) => call.path === "{repo}/actions/runs")).toBe(true);
    expect(A.some(github.calls, (call) => call.method === "PUT" || Str.includes("/merge")(call.path))).toBe(false);
  });

  it.effect("refuses required-shadowed with exit 1 and sends no merge request", () =>
    refusesWithoutMerging("success", "required-shadowed")
  );

  it.effect("refuses a hidden red as required-red with exit 1, not a pending hold (75)", () =>
    refusesWithoutMerging("failure", "required-red")
  );
});

describe("GithubRest ref activity", () => {
  const row = {
    activity_type: "force_push",
    before: "before",
    after: "after",
    timestamp: "2026-11-10T02:46:04Z",
    actor: { login: "ignored" },
  };
  const activityService = (pageSize: number) =>
    recordedGithub((call) => {
      if (call.path !== "{repo}/activity") return undefined;
      const page = Number(call.query.get("after") ?? "0") + 1;
      return {
        body: A.makeBy(pageSize, (index) => ({ ...row, after: `${page}-${index}` })),
        headers: { link: `<https://api.github.com/repos/beep-effect/beep-effect/activity?after=${page}>; rel="next"` },
      };
    });
  it.effect("uses cursor pagination and truncates at three pages of 100", () =>
    Effect.gen(function* () {
      const github = activityService(100);
      const rows = yield* GithubRest.use((rest) => rest.refActivity("feat/stack probe")).pipe(github.provide);
      expect(A.length(github.calls)).toBe(3);
      expect(A.map(github.calls, (call) => call.query.get("after"))).toEqual([null, "1", "2"]);
      expect(A.every(github.calls, (call) => !call.query.has("page"))).toBe(true);
      expect(github.calls[0]?.query.get("ref")).toBe("refs/heads/feat/stack probe");
      expect(github.calls[0]?.query.get("per_page")).toBe("100");
      expect(A.length(rows)).toBe(300);
      expect(A.map(A.take(rows, 2), (value) => value.after)).toEqual(["1-0", "1-1"]);
      assertSome(
        O.map(A.head(rows), (value) => DateTime.formatIso(value.timestamp)),
        "2026-11-10T02:46:04.000Z"
      );
    })
  );
});
