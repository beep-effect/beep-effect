import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { outstanding, ReviewThreads } from "@beep/github/ReviewThread";
import {
  GoalCompletionIoLive,
  goalCompletionIo,
  memoizeGoalCompletionRuleSuites,
  readGoalCompletion,
} from "@beep/repo-cli/commands/Goals/CompletionEvidence";
import { GoalCompletionRuleSuiteList } from "@beep/repo-cli/commands/Goals/CompletionEvidence.schemas";
import { GoalCompletionIo } from "@beep/repo-cli/commands/Goals/CompletionEvidence.service";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { YeetCommandError } from "@beep/repo-cli/test/Yeet";
import { expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { completionFetch } from "./support/CompletionFetch.ts";
import { completionIoFixture, noReviewThreads } from "./support/CompletionIo.ts";
import { scriptedSpawner } from "./support/GithubLedgerFakes.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const encode = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const decodeRuleSuites = flow(S.decodeUnknownEffect(GoalCompletionRuleSuiteList), Effect.orDie);

const comment = (login: string, createdAt: string) => ({
  id: `PRRC_${login}`,
  databaseId: 1,
  author: { __typename: "User", login },
  body: "Please rename this.",
  path: "src/index.ts",
  line: 3,
  originalLine: 3,
  createdAt,
  url: "https://github.com/example/repo/pull/7#discussion_r1",
});

const thread = (id: string, isResolved: boolean) => ({
  id,
  isResolved,
  isOutdated: false,
  isCollapsed: false,
  path: "src/index.ts",
  line: 3,
  startLine: null,
  diffSide: "RIGHT",
  resolvedBy: isResolved ? { login: "octocat" } : null,
  comments: {
    pageInfo: { hasNextPage: false, endCursor: null },
    nodes: [comment("reviewer", "2026-11-03T00:00:00Z")],
  },
  latest: { nodes: [comment(isResolved ? "octocat" : "reviewer", "2026-11-03T00:00:00Z")] },
});

const emptyListing = completionIoFixture({
  manifest: Effect.succeed("{}"),
  origin: Effect.succeed("git@github.com:example/repo.git"),
  respond: () => Effect.succeed("[[]]"),
});

const spawner = () =>
  ScriptedSpawner.make((command, args) =>
    command === "gh" && args[0] === "auth"
      ? { stdout: "fixture-token" }
      : { stdout: "git@github.com:example/repo.git\n" }
  );

it.layer(NodeTestLayer, { timeout: "30 seconds" })("completion kit", (it) => {
  it.effect("completion typed reads follow every page and preserve filter, ref and parent parameters", () =>
    Effect.gen(function* () {
      const transport = completionFetch((url) => {
        const page2 = url.searchParams.get("page") === "2";
        const at = "2026-11-03T00:00:00Z";
        const row = {
          id: page2 ? 2 : 1,
          name: "Check",
          status: "completed",
          conclusion: "success",
          head_sha: "head",
          started_at: at,
          completed_at: at,
          event: "ready_for_review",
          created_at: at,
          version_id: page2 ? 2 : 1,
          updated_at: at,
          ref: "refs/heads/main",
          after_sha: "merge",
          source_type: "Repository",
        };
        return {
          body: Str.endsWith("/check-runs")(url.pathname)
            ? { total_count: 2, check_runs: [row] }
            : Str.endsWith("/check-suites")(url.pathname)
              ? { total_count: 2, check_suites: [row] }
              : [row],
          next: !page2,
        };
      });
      const io = yield* goalCompletionIo();
      const observed = yield* Effect.all([
        io.checkRuns(".", "head"),
        io.timeline(".", 7),
        io.checkSuites(".", "head"),
        io.rulesetHistory(".", 42),
        io.ruleSuites(".", "refs/heads/main"),
        io.rulesets("."),
      ]).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)));
      for (const result of observed) {
        expect(result).toHaveLength(1);
      }
      expect(observed[0]).toMatchObject([{ check_runs: [{ id: 1 }, { id: 2 }] }]);
      expect(observed[2]).toMatchObject([
        { check_suites: [{ created_at: expect.anything() }, { created_at: expect.anything() }] },
      ]);
      expect(transport.calls.length).toBe(12);
      expect(
        A.every(
          A.filter(transport.calls, (url) => Str.endsWith("/check-runs")(url.pathname)),
          (url) => url.searchParams.get("filter") === "all"
        )
      ).toBe(true);
      expect(A.some(transport.calls, (url) => url.searchParams.get("includes_parents") === "true")).toBe(true);
      expect(
        A.some(
          transport.calls,
          (url) => url.searchParams.get("ref") === "refs/heads/main" && url.searchParams.get("time_period") === "month"
        )
      ).toBe(true);
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion commit, ruleset version and rule suite reads decode their typed observations", () =>
    Effect.gen(function* () {
      const commit = { sha: "merge", parents: [{ sha: "parent" }], commit: { tree: { sha: "tree" } } };
      const version = {
        state: {
          enforcement: "active",
          target: "branch",
          conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
          rules: [],
        },
      };
      const suite = {
        id: 7,
        ref: "refs/heads/main",
        after_sha: "merge",
        pushed_at: "2026-11-03T00:00:00Z",
        result: "pass",
        rule_evaluations: [],
      };
      const transport = completionFetch((url) => ({
        body: Str.includes("/commits/")(url.pathname)
          ? commit
          : Str.includes("/history/")(url.pathname)
            ? version
            : suite,
      }));
      const io = yield* goalCompletionIo();
      const values = yield* Effect.all([
        io.commit(".", "merge"),
        io.rulesetVersion(".", 42, 3),
        io.ruleSuite(".", 7),
      ]).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)));
      expect(values).toEqual([commit, version, { ...suite, pushed_at: DateTime.makeUnsafe(suite.pushed_at) }]);
      expect(A.map(transport.calls, (url) => url.pathname)).toEqual([
        "/repos/example/repo/commits/merge",
        "/repos/example/repo/rulesets/42/history/3",
        "/repos/example/repo/rulesets/rule-suites/7",
      ]);
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion rejects invalid paginated observations and failed git reads", () =>
    Effect.gen(function* () {
      const io = yield* goalCompletionIo();
      const transport = completionFetch(() => ({ body: { check_runs: [{}], total_count: 1 } }));
      const malformed = yield* io
        .checkRuns(".", "head")
        .pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)), Effect.flip);
      expect(malformed.message).toBe("Invalid goal completion GitHub payload");
      const failed = yield* Effect.flatMap(goalCompletionIo(), (port) =>
        port.manifestAtHead(".", "head", "manifest.json")
      ).pipe(provideSpawner(ScriptedSpawner.make(() => ({ exit: 128, stderr: "fatal" }))), Effect.flip);
      expect(failed.message).toBe("Goal completion git read failed");
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("completion refused reads and malformed payloads stay typed failures", () =>
    Effect.gen(function* () {
      const refused = completionFetch(() => ({ status: 403, body: { message: "Forbidden" } }));
      const invalid = completionFetch(() => ({ body: { malformed: true } }));
      for (const transport of [refused, invalid]) {
        const error = yield* readGoalCompletion(".", (io, root) => io.pullRequest(root, 7)).pipe(
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(spawner()),
          Effect.flip
        );
        expect(error._tag).toBe("YeetCommandError");
      }
    })
  );

  it.effect("completion review threads read every thread through the GitHub GraphQL kit", () =>
    Effect.gen(function* () {
      const transport = completionFetch((url) => ({
        body:
          url.pathname === "/graphql"
            ? {
                data: {
                  repository: {
                    pullRequest: {
                      author: { login: "octocat" },
                      reviewThreads: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: [thread("PRRT_open", false), thread("PRRT_done", true)],
                      },
                    },
                  },
                },
              }
            : { message: "Not Found" },
        status: url.pathname === "/graphql" ? 200 : 404,
      }));
      const io = yield* goalCompletionIo();
      const read = yield* io
        .reviewThreads(".", 7)
        .pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)));
      expect(A.map(read.threads, (row) => row.id)).toEqual(["PRRT_open", "PRRT_done"]);
      assertSome(read.pullRequestAuthor, "octocat");
      expect(outstanding(read)).toBe(1);
      expect(A.map(transport.calls, (url) => url.pathname)).toEqual(["/graphql"]);
      const refused = completionFetch(() => ({ status: 502, body: { message: "Bad Gateway" } }));
      const failure = yield* io
        .reviewThreads(".", 7)
        .pipe(Effect.provideService(GithubTransportFetch, O.some(refused.fetch)), Effect.flip);
      expect(failure._tag).toBe("YeetCommandError");
    }).pipe(provideSpawner(spawner()))
  );

  it.effect("the completion fixture answers no review threads unless a test overrides the read", () =>
    Effect.gen(function* () {
      const defaulted = yield* emptyListing.reviewThreads(".", 7);
      expect(defaulted).toBe(noReviewThreads);
      const overridden = completionIoFixture({
        manifest: Effect.succeed("{}"),
        origin: Effect.succeed("git@github.com:example/repo.git"),
        respond: () => Effect.succeed("{}"),
        reviewThreads: (number) =>
          number === 7
            ? Effect.succeed(ReviewThreads.make({ pullRequestAuthor: O.some("octocat"), threads: [] }))
            : Effect.fail(YeetCommandError.make({ message: "Synthetic thread read failure" })),
      });
      const overriddenRead = yield* overridden.reviewThreads(".", 7);
      assertSome(overriddenRead.pullRequestAuthor, "octocat");
      expect((yield* overridden.reviewThreads(".", 8).pipe(Effect.flip)).message).toBe("Synthetic thread read failure");
      // A recorded pull body without `state` takes it from `merged`.
      const pull = (merged: boolean) =>
        completionIoFixture({
          manifest: Effect.succeed("{}"),
          origin: Effect.succeed("git@github.com:example/repo.git"),
          respond: () =>
            Effect.succeed(
              encode({
                number: 7,
                merged,
                created_at: "2026-10-05T23:00:00Z",
                merged_at: merged ? "2026-10-06T01:00:00Z" : null,
                merge_commit_sha: merged ? "merge-result" : null,
                head: { sha: "accepted-head" },
                base: { ref: "main", repo: { full_name: "example/repo" } },
              })
            ),
        }).pullRequest(".", 7);
      expect((yield* pull(true)).state).toBe("closed");
      expect((yield* pull(false)).state).toBe("open");
    })
  );

  it.effect("memoized rule-suite listings read once per root and ref and retry a failed read", () =>
    Effect.gen(function* () {
      const reads: Array<readonly [string, string]> = [];
      let failing = true;
      const port = GoalCompletionIo.of({
        ...emptyListing,
        ruleSuites: Effect.fn("CompletionKitTest.ruleSuites")(function* (root, ref) {
          reads.push([root, ref]);
          if (ref === "refs/heads/flaky" && failing)
            return yield* YeetCommandError.make({ message: "Synthetic rule-suite failure" });
          return yield* decodeRuleSuites([[{ id: A.length(reads), ref, after_sha: "merge" }]]);
        }),
      });
      const memo = yield* memoizeGoalCompletionRuleSuites(port);
      const first = yield* memo.ruleSuites("/repo", "refs/heads/main");
      const again = yield* memo.ruleSuites("/repo", "refs/heads/main");
      expect(again).toBe(first);
      yield* memo.ruleSuites("/repo", "refs/heads/release");
      yield* memo.ruleSuites("/other", "refs/heads/main");
      expect(reads).toEqual([
        ["/repo", "refs/heads/main"],
        ["/repo", "refs/heads/release"],
        ["/other", "refs/heads/main"],
      ]);
      const failure = yield* memo.ruleSuites("/repo", "refs/heads/flaky").pipe(Effect.flip);
      expect(failure.message).toBe("Synthetic rule-suite failure");
      failing = false;
      yield* memo.ruleSuites("/repo", "refs/heads/flaky");
      yield* memo.ruleSuites("/repo", "refs/heads/flaky");
      expect(A.length(A.filter(reads, ([, ref]) => ref === "refs/heads/flaky"))).toBe(2);
      // Every other read passes through unchanged.
      expect(memo.pullRequest).toBe(port.pullRequest);
      expect(memo.reviewThreads).toBe(port.reviewThreads);
    })
  );

  it.effect("the live completion layer fails cleanly when every process fails and never caches a failed listing", () =>
    Effect.gen(function* () {
      const { spawner, spawned } = scriptedSpawner({});
      const io = yield* Layer.build(GoalCompletionIoLive).pipe(
        Effect.map(Context.get(GoalCompletionIo)),
        Effect.scoped,
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
      const threads = yield* io.reviewThreads("/repo", 7).pipe(Effect.flip);
      expect(threads._tag).toBe("YeetCommandError");
      const listing = yield* io.ruleSuites("/repo", "refs/heads/main").pipe(Effect.flip);
      expect(listing._tag).toBe("YeetCommandError");
      const before = A.length(spawned);
      expect(before).toBeGreaterThan(0);
      yield* io.ruleSuites("/repo", "refs/heads/main").pipe(Effect.flip);
      expect(A.length(spawned)).toBeGreaterThan(before);
    })
  );

  it.effect("a port provided outside the run is the one the live layer wraps", () =>
    Effect.gen(function* () {
      let reads = 0;
      const outer = GoalCompletionIo.of({
        ...emptyListing,
        ruleSuites: Effect.fn("CompletionKitTest.outerRuleSuites")(function* () {
          reads += 1;
          return yield* Effect.succeed([[]]);
        }),
      });
      const io = yield* Layer.build(GoalCompletionIoLive).pipe(
        Effect.map(Context.get(GoalCompletionIo)),
        Effect.scoped,
        Effect.provideService(GoalCompletionIo, outer),
        provideSpawner(ScriptedSpawner.make(() => ({ exit: 1, stderr: "no process expected" })))
      );
      yield* io.ruleSuites("/repo", "refs/heads/main");
      yield* io.ruleSuites("/repo", "refs/heads/main");
      expect(reads).toBe(1);
      expect(io.pullRequest).toBe(outer.pullRequest);
    })
  );

  it.effect("completion contents returns absence for 404, refuses directories and decodes regular files", () =>
    Effect.gen(function* () {
      const io = yield* goalCompletionIo();
      for (const { body, status, result } of [
        { body: { message: "Not Found" }, status: 404, result: "none" },
        { body: [], status: 200, result: "failure" },
        { body: { type: "file", encoding: "base64", content: "bWFuaWZlc3Q=" }, status: 200, result: "manifest" },
      ]) {
        const transport = completionFetch(() => ({ body, status }));
        const value = yield* io.hostedManifest(".", "head", "goals/demo/ops/manifest.json").pipe(
          Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
          provideSpawner(spawner()),
          Effect.map(O.getOrElse(() => "none")),
          Effect.orElseSucceed(() => "failure")
        );
        expect(value).toBe(result);
      }
    }).pipe(provideSpawner(spawner()))
  );
});
