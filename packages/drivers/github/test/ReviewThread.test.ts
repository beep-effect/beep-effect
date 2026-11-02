import { GitHubClient, RecordedCall } from "@beep/github/GitHubClient";
import { GitHubGraphQLError } from "@beep/github/GraphQL";
import { Repo } from "@beep/github/Repo";
import {
  isOutstanding,
  outstanding,
  ReviewThread,
  ReviewThreadActor,
  ReviewThreadComment,
  ReviewThreadNode,
  ReviewThreads,
} from "@beep/github/ReviewThread";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as References from "effect/References";
import * as Str from "effect/String";
import { harness, REPO } from "./support/harness.ts";
import type { GitHubFixtures } from "@beep/github/GitHubClient";

// --- Recorded GraphQL payloads ------------------------------------------------

const wireComment = (overrides: Record<string, unknown> = {}) => ({
  id: "PRRC_1",
  databaseId: 1001,
  author: { __typename: "User", login: "reviewer" },
  body: "nit: rename this",
  path: "src/a.ts",
  line: 3,
  originalLine: 3,
  createdAt: "2026-11-02T00:00:00Z",
  url: "https://github.com/acme/widget/pull/7#discussion_r1001",
  ...overrides,
});

const closedPage = { hasNextPage: false, endCursor: null };

const wireThread = (overrides: Record<string, unknown> = {}) => ({
  id: "PRRT_1",
  isResolved: false,
  isOutdated: false,
  isCollapsed: false,
  path: "src/a.ts",
  line: 3,
  startLine: null,
  diffSide: "RIGHT",
  resolvedBy: null,
  comments: { pageInfo: closedPage, nodes: [wireComment()] },
  latest: { nodes: [wireComment()] },
  ...overrides,
});

const listPage = (
  nodes: ReadonlyArray<unknown>,
  pageInfo: { hasNextPage: boolean; endCursor: string | null } = closedPage,
  author: { login: string } | null = { login: "octocat" }
) => ({ repository: { pullRequest: { author, reviewThreads: { pageInfo, nodes } } } });

const truncatedThread = wireThread({
  id: "PRRT_trunc",
  comments: { pageInfo: { hasNextPage: true, endCursor: "comment-cursor" }, nodes: [wireComment()] },
  latest: { nodes: [wireComment({ id: "PRRC_newest", databaseId: null, author: null, line: null })] },
});

const resolvedThread = wireThread({
  id: "PRRT_resolved",
  isResolved: true,
  resolvedBy: { login: "octocat" },
  latest: { nodes: [wireComment({ id: "PRRC_bot", author: { __typename: "Bot", login: "greptile-apps" } })] },
});

const outdatedThread = wireThread({ id: "PRRT_outdated", isOutdated: true, line: null, startLine: 10 });

// --- Fixture helpers ----------------------------------------------------------

let warnings: ReadonlyArray<{ message: unknown; annotations: Record<string, unknown> }> = [];
const warningCollector = Logger.make(({ fiber, logLevel, message }) => {
  if (logLevel === "Warn") {
    warnings = A.append(warnings, { message, annotations: fiber.getRef(References.CurrentLogAnnotations) });
  }
});

const fixtureLayer = (fixtures: GitHubFixtures.Encoded) =>
  ReviewThread.layer.pipe(
    Layer.provideMerge(Layer.mergeAll(GitHubClient.layerFixture(fixtures), Repo.layer(REPO))),
    Layer.provideMerge(Logger.layer([warningCollector]))
  );

const withFixtures = <A, E>(
  fixtures: GitHubFixtures.Encoded,
  use: (service: ReviewThread["Service"]) => Effect.Effect<A, E, Repo>
) =>
  Effect.scopedWith((scope) =>
    Effect.gen(function* () {
      const context = yield* Layer.buildWithScope(fixtureLayer(fixtures), scope);
      return yield* Effect.flatMap(ReviewThread, use).pipe(Effect.provideContext(context));
    })
  );

const messageText = (message: unknown): string =>
  A.isArray(message) ? A.join(A.filter(message, P.isString), " ") : P.isString(message) ? message : "";

// --- Model helpers --------------------------------------------------------------

const newestComment = (author: O.Option<ReviewThreadActor>): O.Option<ReviewThreadComment> =>
  O.some(
    ReviewThreadComment.make({
      id: "PRRC_x",
      databaseId: O.none(),
      author,
      body: "",
      path: "src/a.ts",
      line: O.none(),
      originalLine: O.none(),
      createdAt: "2026-11-02T00:00:00Z",
      url: "https://example.test",
    })
  );

/** The newest comment is by a human with this login. */
const lastWordFrom = (login: string) => newestComment(O.some(ReviewThreadActor.make({ login, isBot: false })));
/** The newest comment is by a bot with this login. */
const lastWordFromBot = (login: string) => newestComment(O.some(ReviewThreadActor.make({ login, isBot: true })));
/** The newest comment's author account is gone. */
const lastWordAnonymous = newestComment(O.none());

const node = (
  overrides: Partial<{
    isResolved: boolean;
    isOutdated: boolean;
    resolvedBy: O.Option<string>;
    newestComment: O.Option<ReviewThreadComment>;
  }> = {}
): ReviewThreadNode =>
  ReviewThreadNode.make({
    id: "PRRT_x",
    isResolved: false,
    isOutdated: false,
    isCollapsed: false,
    path: "src/a.ts",
    line: O.some(1),
    startLine: O.none(),
    diffSide: "RIGHT",
    resolvedBy: O.none(),
    comments: [],
    commentsTruncated: false,
    newestComment: O.none(),
    ...overrides,
  });

// --- Pagination over the real client -----------------------------------------------

describe("ReviewThread.list pagination", () => {
  it.effect("walks every page and threads the end cursor into the next request", () =>
    Effect.scopedWith((scope) =>
      Effect.gen(function* () {
        const { script, base } = harness([
          {
            status: 200,
            body: {
              data: listPage([wireThread({ id: "PRRT_1" }), wireThread({ id: "PRRT_2" })], {
                hasNextPage: true,
                endCursor: "cursor-1",
              }),
            },
          },
          { status: 200, body: { data: listPage([wireThread({ id: "PRRT_3" })]) } },
        ]);
        const context = yield* Layer.buildWithScope(ReviewThread.layer.pipe(Layer.provideMerge(base)), scope);
        const read = yield* Effect.flatMap(ReviewThread, (threads) => threads.list(7)).pipe(
          Effect.provideContext(context)
        );
        assert.deepStrictEqual(
          A.map(read.threads, (thread) => thread.id),
          ["PRRT_1", "PRRT_2", "PRRT_3"]
        );
        assertSome(read.pullRequestAuthor, "octocat");
        assert.strictEqual(script.count(), 2);
        assert.strictEqual(script.calls[0]?.path, "/graphql");
        assert.isFalse(Str.includes('"after"')(script.calls[0]?.body ?? ""));
        assert.isTrue(Str.includes('"after":"cursor-1"')(script.calls[1]?.body ?? ""));
        assert.isTrue(Str.includes('"number":7')(script.calls[1]?.body ?? ""));
      })
    )
  );

  it.effect("fails typed when GitHub reports a next page without a cursor", () =>
    Effect.scopedWith((scope) =>
      Effect.gen(function* () {
        const { script, base } = harness([
          { status: 200, body: { data: listPage([wireThread()], { hasNextPage: true, endCursor: null }) } },
        ]);
        const context = yield* Layer.buildWithScope(ReviewThread.layer.pipe(Layer.provideMerge(base)), scope);
        const error = yield* Effect.flatMap(ReviewThread, (threads) => threads.list(7)).pipe(
          Effect.provideContext(context),
          Effect.flip
        );
        assert.instanceOf(error, GitHubGraphQLError);
        assert.strictEqual(error.kind, "decode");
        assert.strictEqual(error.operation, "pullRequestReviewThreads");
        assert.strictEqual(error.reason, "another page was reported without an end cursor");
        assert.strictEqual(script.count(), 1);
      })
    )
  );

  it.effect("carries GitHub's GraphQL error list as a typed failure", () =>
    Effect.scopedWith((scope) =>
      Effect.gen(function* () {
        const { base } = harness([
          {
            status: 200,
            body: {
              data: null,
              errors: [{ message: "Could not resolve to a PullRequest with the number of 7.", type: "NOT_FOUND" }],
            },
          },
        ]);
        const context = yield* Layer.buildWithScope(ReviewThread.layer.pipe(Layer.provideMerge(base)), scope);
        const error = yield* Effect.flatMap(ReviewThread, (threads) => threads.list(7)).pipe(
          Effect.provideContext(context),
          Effect.flip
        );
        assert.strictEqual(error._tag, "GitHubGraphQLError");
        assert.strictEqual(error.kind, "notFound");
        assert.strictEqual(error.operation, "pullRequestReviewThreads");
        assert.lengthOf(error.errors, 1);
      })
    )
  );
});

// --- Projection, truncation and the warning -----------------------------------------

describe("ReviewThread.list projection", () => {
  it.effect("projects threads, flags truncated comment connections and warns once per page", () =>
    Effect.gen(function* () {
      const requested: Array<RecordedCall> = [];
      warnings = [];
      const read = yield* withFixtures(
        {
          graphql: { pullRequestReviewThreads: listPage([truncatedThread, resolvedThread, outdatedThread]) },
          requested,
        },
        (threads) => threads.list(7)
      );

      assert.lengthOf(read.threads, 3);
      assertSome(read.pullRequestAuthor, "octocat");

      const [truncated, resolved, outdated] = read.threads;
      assert.strictEqual(truncated?.id, "PRRT_trunc");
      assert.isTrue(truncated?.commentsTruncated);
      assert.lengthOf(truncated?.comments ?? [], 1);
      assertSome(truncated?.comments[0]?.databaseId ?? O.none(), 1001);
      assertSome(
        truncated?.comments[0]?.author ?? O.none(),
        ReviewThreadActor.make({ login: "reviewer", isBot: false })
      );
      const newest = O.getOrThrow(truncated?.newestComment ?? O.none());
      assert.strictEqual(newest.id, "PRRC_newest");
      assertNone(newest.author);
      assertNone(newest.databaseId);
      assertNone(newest.line);
      assert.strictEqual(newest.url, "https://github.com/acme/widget/pull/7#discussion_r1001");

      assert.isTrue(resolved?.isResolved);
      assert.isFalse(resolved?.commentsTruncated);
      assertSome(resolved?.resolvedBy ?? O.none(), "octocat");
      assertSome(
        O.flatMap(resolved?.newestComment ?? O.none(), (c) => c.author),
        ReviewThreadActor.make({ login: "greptile-apps", isBot: true })
      );

      assert.isTrue(outdated?.isOutdated);
      assertNone(outdated?.line ?? O.some(0));
      assertSome(outdated?.startLine ?? O.none(), 10);
      assert.strictEqual(outdated?.diffSide, "RIGHT");

      assert.deepStrictEqual(requested, [
        RecordedCall.make({
          kind: "graphql",
          route: "pullRequestReviewThreads",
          params: { owner: "acme", name: "widget", number: 7 },
        }),
      ]);

      assert.lengthOf(warnings, 1);
      const text = messageText(warnings[0]?.message);
      assert.isTrue(Str.includes("PRRT_trunc")(text));
      assert.isTrue(Str.includes("more than 100 comments")(text));
      assert.isFalse(Str.includes("PRRT_resolved")(text));
      assert.deepStrictEqual(warnings[0]?.annotations.truncatedThreadIds, ["PRRT_trunc"]);
    })
  );

  it.effect("logs nothing when no thread is truncated", () =>
    Effect.gen(function* () {
      warnings = [];
      const read = yield* withFixtures(
        { graphql: { pullRequestReviewThreads: listPage([wireThread()], closedPage, null) } },
        (threads) => threads.list(7)
      );
      assertNone(read.pullRequestAuthor);
      assert.lengthOf(warnings, 0);
    })
  );
});

// --- The node(id:) entry point ------------------------------------------------------

describe("ReviewThread.listByNodeId", () => {
  it.effect("reads threads from a pull request node without a Repo", () =>
    Effect.gen(function* () {
      const requested: Array<RecordedCall> = [];
      const fixtures: GitHubFixtures.Encoded = {
        graphql: {
          pullRequestReviewThreadsByNodeId: {
            node: {
              __typename: "PullRequest",
              author: { login: "octocat" },
              reviewThreads: { pageInfo: closedPage, nodes: [wireThread()] },
            },
          },
        },
        requested,
      };
      // No Repo in the layer: the node form must not require one.
      const read = yield* Effect.scopedWith((scope) =>
        Effect.gen(function* () {
          const layer = ReviewThread.layer.pipe(Layer.provide(GitHubClient.layerFixture(fixtures)));
          const context = yield* Layer.buildWithScope(layer, scope);
          return yield* Effect.flatMap(ReviewThread, (threads) => threads.listByNodeId("PR_kwDO")).pipe(
            Effect.provideContext(context)
          );
        })
      );
      assert.lengthOf(read.threads, 1);
      assertSome(read.pullRequestAuthor, "octocat");
      assert.deepStrictEqual(requested[0]?.params, { id: "PR_kwDO" });
    })
  );

  for (const [label, node] of [
    ["a missing node", null],
    ["a node of another kind", { __typename: "Issue" }],
  ] as const) {
    it.effect(`fails as notFound for ${label}`, () =>
      Effect.gen(function* () {
        const error = yield* withFixtures({ graphql: { pullRequestReviewThreadsByNodeId: { node } } }, (threads) =>
          threads.listByNodeId("I_kwDO")
        ).pipe(Effect.flip);
        assert.strictEqual(error.kind, "notFound");
        assert.strictEqual(error.operation, "pullRequestReviewThreadsByNodeId");
        assert.isTrue(Str.includes("I_kwDO")(error.reason));
      })
    );
  }
});

// --- Mutations -------------------------------------------------------------------------

describe("ReviewThread mutations", () => {
  it.effect("reply returns the new comment and sends the thread id and body", () =>
    Effect.gen(function* () {
      const requested: Array<RecordedCall> = [];
      const created = yield* withFixtures(
        {
          graphql: {
            addPullRequestReviewThreadReply: {
              addPullRequestReviewThreadReply: { comment: wireComment({ id: "PRRC_new", databaseId: 2002 }) },
            },
          },
          requested,
        },
        (threads) => threads.reply("PRRT_1", "Fixed in abc123.")
      );
      assert.strictEqual(created.id, "PRRC_new");
      assertSome(created.databaseId, 2002);
      assert.deepStrictEqual(requested[0]?.params, { threadId: "PRRT_1", body: "Fixed in abc123." });
    })
  );

  it.effect("reply refuses a blank body before any request", () =>
    Effect.gen(function* () {
      const requested: Array<RecordedCall> = [];
      const error = yield* withFixtures({ graphql: {}, requested }, (threads) =>
        threads.reply("  \n\t")("PRRT_1")
      ).pipe(Effect.flip);
      assert.strictEqual(error.kind, "rejected");
      assert.strictEqual(error.operation, "addPullRequestReviewThreadReply");
      assert.strictEqual(error.reason, "reply body is blank");
      assert.lengthOf(requested, 0);
    })
  );

  it.effect("reply fails as decode when GitHub returns no comment", () =>
    Effect.gen(function* () {
      const error = yield* withFixtures(
        { graphql: { addPullRequestReviewThreadReply: { addPullRequestReviewThreadReply: { comment: null } } } },
        (threads) => threads.reply("PRRT_1", "ok")
      ).pipe(Effect.flip);
      assert.strictEqual(error.kind, "decode");
      assert.strictEqual(error.reason, "GitHub returned no comment for the reply");
    })
  );

  it.effect("resolve and unresolve answer with the thread's new resolution", () =>
    Effect.gen(function* () {
      const requested: Array<RecordedCall> = [];
      const [resolved, unresolved] = yield* withFixtures(
        {
          graphql: {
            resolveReviewThread: { result: { thread: { id: "PRRT_1", isResolved: true } } },
            unresolveReviewThread: { result: { thread: { id: "PRRT_1", isResolved: false } } },
          },
          requested,
        },
        (threads) => Effect.all([threads.resolve("PRRT_1"), threads.unresolve("PRRT_1")])
      );
      assert.isTrue(resolved);
      assert.isFalse(unresolved);
      assert.deepStrictEqual(
        A.map(requested, (call) => call.route),
        ["resolveReviewThread", "unresolveReviewThread"]
      );
      assert.deepStrictEqual(requested[0]?.params, { threadId: "PRRT_1" });
    })
  );

  it.effect("resolve fails as decode when GitHub returns no thread", () =>
    Effect.gen(function* () {
      const error = yield* withFixtures({ graphql: { resolveReviewThread: { result: { thread: null } } } }, (threads) =>
        threads.resolve("PRRT_1")
      ).pipe(Effect.flip);
      assert.strictEqual(error.kind, "decode");
      assert.strictEqual(error.operation, "resolveReviewThread");
    })
  );

  it.effect("a malformed recorded payload is a decode failure, never a defect", () =>
    Effect.gen(function* () {
      const exit = yield* withFixtures({ graphql: { pullRequestReviewThreads: { repository: null } } }, (threads) =>
        threads.list(7)
      ).pipe(Effect.exit);
      assert.isTrue(Exit.hasFails(exit));
      assert.isFalse(Exit.hasDies(exit));
    })
  );
});

// --- The outstanding rule ------------------------------------------------------------

describe("ReviewThread.outstanding", () => {
  const author = O.some("octocat");

  it("counts an unresolved thread, outdated or not", () => {
    assert.isTrue(isOutstanding(node(), author));
    assert.isTrue(isOutstanding(node({ isOutdated: true }), O.none()));
  });

  it("a thread resolved by a reviewer owes nothing", () => {
    assert.isFalse(
      isOutstanding(
        node({ isResolved: true, resolvedBy: O.some("reviewer"), newestComment: lastWordFrom("reviewer") }),
        author
      )
    );
  });

  it("a thread the author resolved with a later human comment by someone else is outstanding", () => {
    assert.isTrue(
      isOutstanding(author)(node({ isResolved: true, resolvedBy: author, newestComment: lastWordFrom("reviewer") }))
    );
  });

  it("a bot acknowledgement after the author resolved is not outstanding", () => {
    assert.isFalse(
      isOutstanding(
        node({ isResolved: true, resolvedBy: author, newestComment: lastWordFromBot("greptile-apps") }),
        author
      )
    );
  });

  it("the author's own last word, a deleted author or an unknown pull request author owe nothing", () => {
    const authorResolved = { isResolved: true, resolvedBy: author };
    assert.isFalse(isOutstanding(node({ ...authorResolved, newestComment: lastWordFrom("octocat") }), author));
    assert.isFalse(isOutstanding(node({ ...authorResolved, newestComment: lastWordAnonymous }), author));
    assert.isFalse(isOutstanding(node({ ...authorResolved, newestComment: O.none() }), author));
    assert.isFalse(isOutstanding(node({ ...authorResolved, newestComment: lastWordFrom("reviewer") }), O.none()));
  });

  it("outstanding tallies the threads that block a merge", () => {
    const read = ReviewThreads.make({
      pullRequestAuthor: author,
      threads: [
        node(),
        node({ isResolved: true, resolvedBy: author, newestComment: lastWordFrom("reviewer") }),
        node({ isResolved: true, resolvedBy: author, newestComment: lastWordFromBot("greptile-apps") }),
        node({ isResolved: true, resolvedBy: O.some("reviewer") }),
      ],
    });
    assert.strictEqual(outstanding(read), 2);
    assert.strictEqual(outstanding(ReviewThreads.make({ pullRequestAuthor: O.none(), threads: [] })), 0);
  });
});

// --- Test doubles ----------------------------------------------------------------------

describe("ReviewThread test doubles", () => {
  it.layer(ReviewThread.layerTest({ resolve: () => Effect.succeed(true) }), { timeout: "30 seconds" })((it) => {
    it.effect("unstubbed members name themselves and overrides are retained", () =>
      Effect.gen(function* () {
        const service = yield* ReviewThread;
        assert.isTrue(yield* service.resolve("PRRT_1"));
        for (const [name, call] of [
          ["list", () => service.list(7)],
          ["listByNodeId", () => service.listByNodeId("PR_1")],
          ["reply", () => service.reply("PRRT_1", "x")],
          ["unresolve", () => service.unresolve("PRRT_1")],
        ] as const) {
          assert.throws(call, `ReviewThread.makeTest: ${name}() was called but not stubbed`);
        }
        assert.throws(() => ReviewThread.makeTest().resolve("PRRT_1"), "ReviewThread.makeTest: resolve()");
      })
    );
  });
});
