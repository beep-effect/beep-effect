import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubError } from "@beep/github/GitHubError";
import {
  classifyYeetGithubRateLimit,
  decideYeetGithubRateLimitPause,
  readYeetGithubRateLimit,
  renderYeetGithubRateLimitPause,
  resolveYeetGithubRateLimitKind,
  stepYeetMonitorPollBudget,
  YEET_MONITOR_POLL_ERROR_BUDGET,
  YEET_MONITOR_RATE_LIMIT_BUDGET,
  YeetGithubRateLimitBucket,
  YeetGithubRateLimitPause,
  YeetGithubRateLimitPauseInput,
  YeetGithubRateLimitResources,
  YeetGithubRateLimitSnapshot,
  YeetMonitorPollBudget,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { YeetGithubRateLimitKind, YeetMonitorPollOutcome } from "@beep/repo-cli/test/Yeet";

const nowSeconds = 1_789_516_800;
const now = DateTime.makeUnsafe(nowSeconds * 1000);
const interval = Duration.seconds(90);

const snapshot = (core: readonly [number, number], graphql: readonly [number, number]) =>
  YeetGithubRateLimitSnapshot.make({
    resources: YeetGithubRateLimitResources.make({
      core: YeetGithubRateLimitBucket.make({ remaining: core[0], reset: core[1] }),
      graphql: YeetGithubRateLimitBucket.make({ remaining: graphql[0], reset: graphql[1] }),
    }),
  });

type PauseFields = Parameters<typeof YeetGithubRateLimitPauseInput.make>[0];

const pause = (input: Partial<PauseFields>) =>
  decideYeetGithubRateLimitPause(
    YeetGithubRateLimitPauseInput.make({
      attempt: 1,
      interval,
      limit: "primary",
      now,
      snapshot: O.none(),
      ...input,
    })
  );

const sleepMillis = (input: Partial<PauseFields>) => Duration.toMillis(pause(input).sleep);

describe("classifyYeetGithubRateLimit", () => {
  const positives: ReadonlyArray<readonly [string, YeetGithubRateLimitKind]> = [
    ["HTTP 403: API rate limit exceeded for user ID 106790222.", "primary"],
    ["gh: API rate limit already exceeded for user ID 106790222.", "primary"],
    [
      'GraphQL: {"errors":[{"type":"RATE_LIMIT","code":"graphql_rate_limit","message":"API rate limit exceeded"}]}',
      "primary",
    ],
    ['{"errors":[{"type": "RATE_LIMITED","message":"rate limited"}]}', "primary"],
    ["graphql_rate_limit: budget spent", "primary"],
    ["You have exceeded a secondary rate limit. Please wait a few minutes before you try again.", "secondary"],
    ["HTTP 429: Too Many Requests (https://api.github.com/graphql)", "secondary"],
    ["Rate limit exceeded", "primary"],
  ];
  for (const [message, kind] of positives)
    it(`classifies "${message}" as ${kind}`, () => {
      assertSome(classifyYeetGithubRateLimit(message), kind);
    });

  const negatives: ReadonlyArray<string> = [
    "HTTP 502: Bad Gateway (https://api.github.com/graphql)",
    "request timed out after 30 seconds",
    "Failed to read the complete pull request check census",
    "read unavailable",
    "job exceeded the runtime limit",
    "HTTP 403: Resource not accessible by integration",
  ];
  for (const message of negatives)
    it(`leaves "${message}" as an ordinary failure`, () => {
      assertNone(classifyYeetGithubRateLimit(message));
    });
});

describe("resolveYeetGithubRateLimitKind", () => {
  const census = "Failed to read the complete pull request check census.";
  const threads =
    "Failed to collect the paginated PR review-thread closeout gate.; REST fallback: review comments exist; thread resolution is unknown";

  it("counts a text-less failure as a primary limit when the GraphQL bucket is empty", () => {
    const drained = O.some(snapshot([4000, nowSeconds + 600], [0, nowSeconds + 1200]));
    assertSome(resolveYeetGithubRateLimitKind(census, drained), "primary");
    assertSome(resolveYeetGithubRateLimitKind(threads, drained), "primary");
  });

  it("counts a text-less failure as a primary limit when the core bucket is empty", () => {
    assertSome(
      resolveYeetGithubRateLimitKind(census, O.some(snapshot([0, nowSeconds + 600], [10, nowSeconds]))),
      "primary"
    );
  });

  it("leaves a text-less failure ordinary when no bucket is empty or the read failed", () => {
    assertNone(
      resolveYeetGithubRateLimitKind(census, O.some(snapshot([4000, nowSeconds + 600], [4000, nowSeconds + 600])))
    );
    assertNone(resolveYeetGithubRateLimitKind(census, O.none()));
  });

  it("keeps the text classification when the read shows healthy buckets", () => {
    const healthy = O.some(snapshot([4000, nowSeconds + 600], [4000, nowSeconds + 600]));
    assertSome(resolveYeetGithubRateLimitKind("You have exceeded a secondary rate limit.", healthy), "secondary");
    assertSome(resolveYeetGithubRateLimitKind("HTTP 403: API rate limit exceeded", O.none()), "primary");
  });
});

describe("decideYeetGithubRateLimitPause", () => {
  it("sleeps until an exhausted core reset plus the margin", () => {
    const decided = pause({ snapshot: O.some(snapshot([0, nowSeconds + 600], [4000, nowSeconds + 3000])) });
    expect(Duration.toMillis(decided.sleep)).toBe(605_000);
    expect(
      YeetGithubRateLimitPause.match(decided, {
        reset: (reset) => A.join(reset.buckets, "+"),
        backoff: () => "backoff",
      })
    ).toBe("core");
    expect(renderYeetGithubRateLimitPause(decided)).toBe(
      "[yeet] GitHub rate limit (primary, core): sleeping until 00:10:05Z (10m 5s) instead of spending the poll-error budget"
    );
  });

  it("waits for the latest reset when both buckets are exhausted", () => {
    const decided = pause({ snapshot: O.some(snapshot([0, nowSeconds + 600], [0, nowSeconds + 1200])) });
    expect(Duration.toMillis(decided.sleep)).toBe(1_205_000);
    expect(renderYeetGithubRateLimitPause(decided)).toContain("(primary, core+graphql)");
  });

  it("clamps a past or imminent reset up to the poll interval", () => {
    expect(sleepMillis({ snapshot: O.some(snapshot([0, nowSeconds - 30], [10, nowSeconds])) })).toBe(90_000);
    expect(sleepMillis({ snapshot: O.some(snapshot([0, nowSeconds + 10], [10, nowSeconds])) })).toBe(90_000);
  });

  it("clamps a distant reset down to 65 minutes", () => {
    expect(sleepMillis({ snapshot: O.some(snapshot([0, nowSeconds + 3 * 3600], [10, nowSeconds])) })).toBe(65 * 60_000);
  });

  it("backs off exponentially from one minute to a 15-minute cap without an exhausted bucket", () => {
    const healthy = O.some(snapshot([4000, nowSeconds + 600], [4000, nowSeconds + 600]));
    expect(
      A.map([1, 2, 3, 4, 5, 8], (attempt) => sleepMillis({ attempt, limit: "secondary", snapshot: healthy }))
    ).toEqual([60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
  });

  it("backs off when the rate-limit read failed", () => {
    const decided = pause({ attempt: 2, snapshot: O.none() });
    expect(Duration.toMillis(decided.sleep)).toBe(120_000);
    expect(renderYeetGithubRateLimitPause(decided)).toBe(
      `[yeet] GitHub rate limit (primary): backing off 2m (rate-limited poll 2/${YEET_MONITOR_RATE_LIMIT_BUDGET}) instead of spending the poll-error budget`
    );
  });
});

describe("stepYeetMonitorPollBudget", () => {
  const run = (outcomes: ReadonlyArray<YeetMonitorPollOutcome>) =>
    A.reduce(outcomes, YeetMonitorPollBudget.make({}), (budget, outcome) => stepYeetMonitorPollBudget(budget, outcome));

  it("keeps rate-limited polls out of the poll-error budget", () => {
    const budget = run(["failed", "failed", "rate-limited", "rate-limited", "failed"]);
    expect([budget.failures, budget.rateLimited, budget.outcome]).toEqual([3, 2, "failed"]);
  });

  it("does not reset the poll-error budget on a rate-limited poll", () => {
    const budget = run(["failed", "failed", "rate-limited"]);
    expect([budget.failures, budget.rateLimited, budget.outcome]).toEqual([2, 1, "rate-limited"]);
  });

  it("resets both counters on a successful poll", () => {
    const budget = run(["failed", "rate-limited", "succeeded"]);
    expect([budget.failures, budget.rateLimited, budget.outcome]).toEqual([0, 0, "succeeded"]);
  });

  it("demotes rate-limited polls past the cap to ordinary failures", () => {
    const capped = run(A.replicate("rate-limited" as const, YEET_MONITOR_RATE_LIMIT_BUDGET));
    expect([capped.failures, capped.rateLimited, capped.outcome]).toEqual([
      0,
      YEET_MONITOR_RATE_LIMIT_BUDGET,
      "rate-limited",
    ]);
    const spent = run(
      A.replicate("rate-limited" as const, YEET_MONITOR_RATE_LIMIT_BUDGET + YEET_MONITOR_POLL_ERROR_BUDGET)
    );
    expect([spent.failures, spent.outcome]).toEqual([YEET_MONITOR_POLL_ERROR_BUDGET, "failed"]);
  });
});

// The full `GET /rate_limit` shape GitHub returns: extra buckets and fields
// beyond the core and graphql remaining/reset pair the read keeps.
const liveRateLimitPayload = {
  resources: {
    core: { limit: 5000, used: 5000, remaining: 0, reset: 1794260538, resource: "core" },
    graphql: { limit: 5000, used: 127, remaining: 4873, reset: 1794260222, resource: "graphql" },
    search: { limit: 30, used: 0, remaining: 30, reset: 1794256998, resource: "search" },
  },
  rate: { limit: 5000, used: 5000, remaining: 0, reset: 1794260538, resource: "core" },
};

const rateLimitClient = (payload: unknown) =>
  GitHubClient.layerTest({
    requestDecoded: dual(3, <A, I>(route: string, _params: Record<string, unknown>, schema: S.Codec<A, I>) =>
      S.decodeUnknownEffect(schema)(payload).pipe(
        Effect.mapError((cause) => GitHubError.decode(route, "recorded response did not match its schema", cause))
      )
    ),
  });

it.layer(rateLimitClient(liveRateLimitPayload))("readYeetGithubRateLimit on GitHub's full payload", (it) => {
  it.effect("decodes the core and graphql buckets and ignores the rest", () =>
    Effect.gen(function* () {
      const read = yield* readYeetGithubRateLimit;
      expect([read.resources.core.remaining, read.resources.core.reset]).toEqual([0, 1794260538]);
      expect([read.resources.graphql.remaining, read.resources.graphql.reset]).toEqual([4873, 1794260222]);
      assertSome(
        resolveYeetGithubRateLimitKind("Failed to read the complete pull request check census.", O.some(read)),
        "primary"
      );
    })
  );
});

it.layer(rateLimitClient({ resources: { core: { remaining: 1, reset: 1 } } }))(
  "readYeetGithubRateLimit on a payload without a graphql bucket",
  (it) => {
    it.effect("fails with a GitHubError", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(readYeetGithubRateLimit);
        assertInstanceOf(error, GitHubError);
      })
    );
  }
);
