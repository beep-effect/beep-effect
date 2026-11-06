import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  failedReplyOutcomes,
  failYeetReplyOnFailedOutcomes,
  findReplyThread,
  markReplyThreadStates,
  PrCloseoutOptions,
  planReplyActions,
  REPLY_DRAFTS_FILE_NAME,
  REPLY_REPORT_FILE_NAME,
  REPLY_RERUN_COMMAND,
  ReplyDraft,
  ReplyDraftOutcome,
  ReplyDrafts,
  ReplyDraftsJson,
  ReplyLiveThread,
  ReplyReport,
  ReplyReportJson,
  ReplyThreadComment,
  ReplyThreadCommentConnection,
  ReplyThreadLatestComment,
  ReplyThreadLatestConnection,
  RepoRunContext,
  renderYeetReplyFailureVerdict,
  replyDraftsPathForContext,
  replyOutcomeTarget,
  replyReportPathForContext,
  replyResolveRetryCommand,
  runPrCloseout,
  runYeetReply,
  yeetAutomaticCloseoutOptions,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertDefined, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { expectReportedExit } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { githubCallLine, isGraphql, recordedGithub } from "./support/YeetGithub.ts";
import type { ReplyAction } from "@beep/repo-cli/test/Yeet";
import type { GithubAnswer, GithubRoutes } from "./support/YeetGithub.ts";

const OPEN_COMMENT_ID = 2_284_119_001;
const RESOLVED_COMMENT_ID = 2_284_119_002;
const OUTDATED_COMMENT_ID = 2_284_119_003;
const FOLLOW_UP_COMMENT_ID = 2_284_119_004;
const ACKNOWLEDGED_COMMENT_ID = 2_284_119_007;
const UNKNOWN_COMMENT_ID = 2_284_119_999;

const closedPageInfo = { endCursor: null, hasNextPage: false };

const openThread = ReplyLiveThread.make({
  comments: ReplyThreadCommentConnection.make({
    nodes: [ReplyThreadComment.make({ databaseId: OPEN_COMMENT_ID, id: "PRRC_open" })],
    pageInfo: closedPageInfo,
  }),
  id: "PRRT_open",
  isOutdated: false,
  isResolved: false,
  line: 42,
  path: "src/commands/Yeet/internal/Reply.ts",
});

const resolvedThread = ReplyLiveThread.make({
  comments: ReplyThreadCommentConnection.make({
    nodes: [ReplyThreadComment.make({ databaseId: RESOLVED_COMMENT_ID, id: "PRRC_resolved" })],
    pageInfo: closedPageInfo,
  }),
  id: "PRRT_resolved",
  isOutdated: false,
  isResolved: true,
  line: 7,
  path: "src/commands/Yeet/internal/Verdict.ts",
  state: "resolved-answered",
});

// A thread whose diff hunk moved: still open, still counts against the
// "threads resolved" merge criterion, and its only comment predates the
// databaseId field being requested.
const outdatedThread = ReplyLiveThread.make({
  comments: ReplyThreadCommentConnection.make({
    nodes: [
      ReplyThreadComment.make({ databaseId: null, id: "PRRC_outdated_legacy" }),
      ReplyThreadComment.make({ databaseId: OUTDATED_COMMENT_ID, id: "PRRC_outdated" }),
    ],
    pageInfo: closedPageInfo,
  }),
  id: "PRRT_outdated",
  isOutdated: true,
  isResolved: false,
  line: null,
  path: null,
});

// Resolved by the author, then answered again by a human reviewer: the last
// word is not the author's, so a reply is still owed and the thread is
// postable. (A GitHub App speaking last is `acknowledgedThread` below.)
const followUpThread = ReplyLiveThread.make({
  comments: ReplyThreadCommentConnection.make({
    nodes: [
      ReplyThreadComment.make({
        databaseId: FOLLOW_UP_COMMENT_ID,
        id: "PRRC_followup_reviewer",
        author: { login: "reviewer" },
      }),
      ReplyThreadComment.make({ databaseId: 2_284_119_005, id: "PRRC_followup_author", author: { login: "octocat" } }),
      ReplyThreadComment.make({
        databaseId: 2_284_119_006,
        id: "PRRC_followup_again",
        author: { login: "reviewer" },
      }),
    ],
    pageInfo: closedPageInfo,
  }),
  latest: ReplyThreadLatestConnection.make({
    nodes: [ReplyThreadLatestComment.make({ author: { login: "reviewer", __typename: "User" } })],
  }),
  id: "PRRT_followup",
  isOutdated: false,
  isResolved: true,
  line: 12,
  path: "src/commands/Yeet/internal/Status.ts",
  resolvedBy: { login: "octocat" },
  state: "resolved-follow-up",
});

// Resolved by the author, then confirmed by a GitHub App: the last word is a
// bot's, so nothing is owed and a draft aimed here settles as stale.
const acknowledgedThread = ReplyLiveThread.make({
  comments: ReplyThreadCommentConnection.make({
    nodes: [
      ReplyThreadComment.make({ databaseId: ACKNOWLEDGED_COMMENT_ID, id: "PRRC_ack", author: { login: "octocat" } }),
    ],
    pageInfo: closedPageInfo,
  }),
  latest: ReplyThreadLatestConnection.make({
    nodes: [ReplyThreadLatestComment.make({ author: { login: "coderabbitai", __typename: "Bot" } })],
  }),
  id: "PRRT_acknowledged",
  isOutdated: false,
  isResolved: true,
  line: 3,
  path: "src/commands/Yeet/internal/Handler.ts",
  resolvedBy: { login: "octocat" },
  state: "resolved-acknowledged",
});
const liveThreads = [openThread, resolvedThread, outdatedThread, followUpThread, acknowledgedThread];

const draftsOf = (drafts: ReadonlyArray<ReplyDraft>): ReplyDrafts =>
  ReplyDrafts.make({ schemaVersion: "yeet-reply-drafts/v1", prNumber: 558, drafts });

const postThreadIds = (actions: ReadonlyArray<ReplyAction>): ReadonlyArray<string> =>
  A.filterMap(actions, (action) => (action._tag === "post" ? Result.succeed(action.threadId) : Result.failVoid));

const settledOutcomes = (actions: ReadonlyArray<ReplyAction>): ReadonlyArray<ReplyDraftOutcome> =>
  A.filterMap(actions, (action) => (action._tag === "settled" ? Result.succeed(action.outcome) : Result.failVoid));

describe("findReplyThread", () => {
  it("matches a draft that names the GraphQL thread id", () => {
    const draft = ReplyDraft.make({ threadId: O.some("PRRT_resolved"), body: "ack" });
    assertSome(
      O.map(findReplyThread(liveThreads, draft), (thread) => thread.id),
      "PRRT_resolved"
    );
  });

  it("maps a REST comment id onto its thread through the comment databaseId", () => {
    const draft = ReplyDraft.make({ commentId: O.some(OPEN_COMMENT_ID), body: "ack" });
    assertSome(
      O.map(findReplyThread(liveThreads, draft), (thread) => thread.id),
      "PRRT_open"
    );
  });

  it("prefers the thread id when a draft carries both handles", () => {
    const draft = ReplyDraft.make({
      threadId: O.some("PRRT_resolved"),
      commentId: O.some(OPEN_COMMENT_ID),
      body: "ack",
    });
    assertSome(
      O.map(findReplyThread(liveThreads, draft), (thread) => thread.id),
      "PRRT_resolved"
    );
  });

  it("falls back to the comment id when the named thread id is not live", () => {
    const draft = ReplyDraft.make({
      threadId: O.some("PRRT_gone"),
      commentId: O.some(OPEN_COMMENT_ID),
      body: "ack",
    });
    assertSome(
      O.map(findReplyThread(liveThreads, draft), (thread) => thread.id),
      "PRRT_open"
    );
  });

  it("returns None for a comment id no live thread carries", () => {
    const draft = ReplyDraft.make({ commentId: O.some(UNKNOWN_COMMENT_ID), body: "ack" });
    assertNone(findReplyThread(liveThreads, draft));
  });

  it("skips comments whose databaseId is absent instead of matching them", () => {
    const draft = ReplyDraft.make({ commentId: O.some(OUTDATED_COMMENT_ID), body: "ack" });
    assertSome(
      O.map(findReplyThread(liveThreads, draft), (thread) => thread.id),
      "PRRT_outdated"
    );
  });
});

describe("planReplyActions", () => {
  it("plans a write for a live, unresolved thread named by thread id", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed in 0123456." })]),
      liveThreads
    );
    expect(A.map(actions, (action) => action._tag)).toEqual(["post"]);
    expect(postThreadIds(actions)).toEqual(["PRRT_open"]);
  });

  it("plans a write for a comment-id draft, resolving it to the thread id", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ commentId: O.some(OPEN_COMMENT_ID), body: "Fixed in 0123456." })]),
      liveThreads
    );
    expect(postThreadIds(actions)).toEqual(["PRRT_open"]);
  });

  it("still plans a write for an outdated but unresolved thread", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_outdated"), body: "Fixed in 0123456." })]),
      liveThreads
    );
    expect(postThreadIds(actions)).toEqual(["PRRT_outdated"]);
  });

  it("plans a write regardless of the draft's resolve flag", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Not a defect.", resolve: false })]),
      liveThreads
    );
    expect(postThreadIds(actions)).toEqual(["PRRT_open"]);
  });

  it("classifies a resolved thread by who resolved it and who spoke last", () => {
    const unmarked = ReplyLiveThread.make({ ...followUpThread, state: "unresolved" });
    const [marked] = markReplyThreadStates([unmarked], O.some("octocat"));
    expect(marked?.state).toBe("resolved-follow-up");
    // The author had the last word: the thread is answered, so nothing is owed.
    const [authorLast] = markReplyThreadStates(
      [
        ReplyLiveThread.make({
          ...unmarked,
          latest: ReplyThreadLatestConnection.make({
            nodes: [ReplyThreadLatestComment.make({ author: { login: "octocat" } })],
          }),
        }),
      ],
      O.some("octocat")
    );
    expect(authorLast?.state).toBe("resolved-answered");
    // An unknown pull request author must not block: unknown is never a gate.
    const [unknownAuthor] = markReplyThreadStates([unmarked], O.none());
    expect(unknownAuthor?.state).toBe("resolved-answered");
    // A reviewer closing their own thread owes nothing either.
    const [reviewerResolved] = markReplyThreadStates(
      [ReplyLiveThread.make({ ...unmarked, resolvedBy: { login: "reviewer" } })],
      O.some("octocat")
    );
    expect(reviewerResolved?.state).toBe("resolved-answered");
    // A bot having the last word is an acknowledgement, not a follow-up.
    const [acknowledged] = markReplyThreadStates(
      [ReplyLiveThread.make({ ...acknowledgedThread, state: "unresolved" })],
      O.some("octocat")
    );
    expect(acknowledged?.state).toBe("resolved-acknowledged");
    const [open] = markReplyThreadStates([openThread], O.some("someone-else"));
    expect(open?.state).toBe("unresolved");
  });

  it("reads the newest comment from comments(last: 1) when the thread spans more than one page", () => {
    const longThread = ReplyLiveThread.make({
      ...followUpThread,
      state: "unresolved",
      comments: ReplyThreadCommentConnection.make({
        // First page ends with the author's own reply; the real newest comment is on a later page.
        nodes: A.take(followUpThread.comments.nodes, 2),
        pageInfo: { endCursor: "cursor-2", hasNextPage: true },
      }),
    });
    const [marked] = markReplyThreadStates([longThread], O.some("octocat"));
    expect(marked?.state).toBe("resolved-follow-up");
    // Without the latest node, a multi-page thread never claims to know who
    // spoke last, and an unknown last speaker is answered, never a gate.
    const { latest: _latest, ...withoutLatest } = longThread;
    const [unknown] = markReplyThreadStates([ReplyLiveThread.make(withoutLatest)], O.some("octocat"));
    expect(unknown?.state).toBe("resolved-answered");
  });

  it("posts on a resolved thread that carries a reviewer follow-up", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_followup"), body: "answered" })]),
      liveThreads
    );
    expect(postThreadIds(actions)).toEqual(["PRRT_followup"]);
  });

  it("settles a bot-acknowledged thread as stale, posting nothing", () => {
    const [outcome] = settledOutcomes(
      planReplyActions(draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_acknowledged"), body: "ack" })]), liveThreads)
    );
    expect(outcome?.status).toBe("stale");
    expect(outcome?.detail).toContain("already resolved upstream");
  });

  it("settles an already-resolved thread as stale, naming its location", () => {
    const [outcome] = settledOutcomes(
      planReplyActions(draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_resolved"), body: "ack" })]), liveThreads)
    );
    expect(outcome?.status).toBe("stale");
    {
      const optionUnderTest = outcome?.threadId;
      const expectedOptionValue = "PRRT_resolved";
      assertDefined(optionUnderTest);
      assertSome(optionUnderTest, expectedOptionValue);
    }
    expect(outcome?.detail).toContain("already resolved upstream");
    expect(outcome?.detail).toContain("src/commands/Yeet/internal/Verdict.ts:7");
  });

  it("settles an unknown thread id as failed and quotes the handle", () => {
    const [outcome] = settledOutcomes(
      planReplyActions(draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_gone"), body: "ack" })]), liveThreads)
    );
    expect(outcome?.status).toBe("failed");
    {
      const optionUnderTest = outcome?.threadId;
      const expectedOptionValue = "PRRT_gone";
      assertDefined(optionUnderTest);
      assertSome(optionUnderTest, expectedOptionValue);
    }
    expect(outcome?.detail).toContain("thread id PRRT_gone");
    expect(outcome?.detail).toContain("pull request #558");
  });

  it("settles an unknown comment id as failed and keeps the comment id for triage", () => {
    const [outcome] = settledOutcomes(
      planReplyActions(draftsOf([ReplyDraft.make({ commentId: O.some(UNKNOWN_COMMENT_ID), body: "ack" })]), liveThreads)
    );
    expect(outcome?.status).toBe("failed");
    {
      const optionUnderTest = outcome?.threadId;
      assertDefined(optionUnderTest);
      assertNone(optionUnderTest);
    }
    {
      const optionUnderTest = outcome?.commentId;
      const expectedOptionValue = UNKNOWN_COMMENT_ID;
      assertDefined(optionUnderTest);
      assertSome(optionUnderTest, expectedOptionValue);
    }
    expect(outcome?.detail).toContain(`comment id ${UNKNOWN_COMMENT_ID}`);
  });

  it("names both handles when a draft carrying both matches nothing", () => {
    const [outcome] = settledOutcomes(
      planReplyActions(
        draftsOf([
          ReplyDraft.make({ threadId: O.some("PRRT_gone"), commentId: O.some(UNKNOWN_COMMENT_ID), body: "ack" }),
        ]),
        liveThreads
      )
    );
    expect(outcome?.detail).toContain("thread id PRRT_gone / comment id");
  });

  it("fails the second draft that targets a thread an earlier draft already claimed", () => {
    const actions = planReplyActions(
      draftsOf([
        ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "first" }),
        ReplyDraft.make({ commentId: O.some(OPEN_COMMENT_ID), body: "second" }),
      ]),
      liveThreads
    );
    expect(A.map(actions, (action) => action._tag)).toEqual(["post", "settled"]);
    const [outcome] = settledOutcomes(actions);
    expect(outcome?.status).toBe("failed");
    expect(outcome?.detail).toContain("already targeted by an earlier draft");
    {
      const optionUnderTest = outcome?.commentId;
      const expectedOptionValue = OPEN_COMMENT_ID;
      assertDefined(optionUnderTest);
      assertSome(optionUnderTest, expectedOptionValue);
    }
    {
      const optionUnderTest = outcome?.threadId;
      const expectedOptionValue = "PRRT_open";
      assertDefined(optionUnderTest);
      assertSome(optionUnderTest, expectedOptionValue);
    }
  });

  it("emits exactly one action per draft, in drafts-file order", () => {
    const actions = planReplyActions(
      draftsOf([
        ReplyDraft.make({ threadId: O.some("PRRT_resolved"), body: "stale one" }),
        ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "live one" }),
        ReplyDraft.make({ threadId: O.some("PRRT_gone"), body: "unknown one" }),
      ]),
      liveThreads
    );
    expect(A.map(actions, (action) => action._tag)).toEqual(["settled", "post", "settled"]);
  });

  it("plans everything as failed when the live snapshot is empty", () => {
    const actions = planReplyActions(
      draftsOf([ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "ack" })]),
      A.empty<ReplyLiveThread>()
    );
    expect(A.map(settledOutcomes(actions), (outcome) => outcome.status)).toEqual(["failed"]);
  });

  it.effect("produces settled outcomes that round-trip through the report codec", () =>
    Effect.gen(function* () {
      const outcomes = settledOutcomes(
        planReplyActions(
          draftsOf([
            ReplyDraft.make({ threadId: O.some("PRRT_resolved"), body: "stale one" }),
            ReplyDraft.make({ commentId: O.some(UNKNOWN_COMMENT_ID), body: "unknown one" }),
          ]),
          liveThreads
        )
      );
      const report = ReplyReport.make({
        schemaVersion: "yeet-reply-report/v1",
        prNumber: 558,
        createdAt: "2026-08-05T00:00:00.000Z",
        outcomes,
      });
      const text = yield* ReplyReportJson.encode(report);
      expect(text).not.toContain('"_id":"Option"');
      const decoded1 = yield* ReplyReportJson.decode(text);
      expect(decoded1).toEqual(report);
    })
  );
});

type CommandStub = {
  readonly exitCode: number;
  readonly output: string;
};

const ok = (output: string): CommandStub => ({ exitCode: 0, output });

/**
 * A scripted spawner that fails every unlisted command.
 * Its `spawns` record every command line so a test can assert what was *not*
 * run — which is the whole point of the follow-up routing.
 */
const stubSpawner = (stubs: ReadonlyArray<readonly [string, CommandStub]>) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    return pipe(
      A.findFirst(stubs, ([marker]) => Str.includes(marker)(line)),
      O.match({
        onNone: () => ({ exit: 1, stderr: `Unscripted reply command: ${line}` }),
        onSome: ([, stub]) => ({ stdout: stub.output, exit: stub.exitCode }),
      })
    );
  });

const repoViewJson = `{"name":"beep-effect","owner":{"login":"YeeBois"}}`;

// The GraphQL page `ReviewThread.list` reads, in the kit's selection.
const wireComment = (id: string, databaseId: number | null, author: unknown = null) => ({
  id,
  databaseId,
  author,
  body: "",
  path: "src/commands/Yeet/internal/Reply.ts",
  line: null,
  originalLine: null,
  createdAt: "2026-08-16T00:00:00Z",
  url: `https://github.com/YeeBois/beep-effect/pull/558#discussion_${id}`,
});

const wireThread = (
  fields: {
    readonly id: string;
    readonly isResolved: boolean;
    readonly path: string;
    readonly line: number;
    readonly resolvedBy?: string;
  },
  comments: ReadonlyArray<ReturnType<typeof wireComment>>,
  latest: ReadonlyArray<ReturnType<typeof wireComment>> = comments
) => ({
  ...fields,
  isOutdated: false,
  isCollapsed: false,
  startLine: null,
  diffSide: "RIGHT",
  resolvedBy: fields.resolvedBy === undefined ? null : { login: fields.resolvedBy },
  comments: { pageInfo: closedPageInfo, nodes: comments },
  latest: { nodes: A.takeRight(latest, 1) },
});

const threadsPage = (author: string | null, nodes: ReadonlyArray<ReturnType<typeof wireThread>>) => ({
  data: {
    repository: {
      pullRequest: {
        author: author === null ? null : { login: author },
        reviewThreads: { pageInfo: closedPageInfo, nodes },
      },
    },
  },
});

const livePage = threadsPage(null, [
  wireThread({ id: "PRRT_open", isResolved: false, path: "src/commands/Yeet/internal/Reply.ts", line: 42 }, [
    wireComment("PRRC_open", OPEN_COMMENT_ID),
  ]),
  wireThread({ id: "PRRT_resolved", isResolved: true, path: "src/commands/Yeet/internal/Verdict.ts", line: 7 }, [
    wireComment("PRRC_resolved", RESOLVED_COMMENT_ID),
  ]),
]);

// A pull request whose author resolved both threads: a human reviewer spoke
// last on the first (a follow-up), a bot on the second (an acknowledgement).
const resolvedThreads = threadsPage("octocat", [
  wireThread(
    {
      id: "PRRT_followup",
      isResolved: true,
      path: "src/commands/Yeet/internal/Status.ts",
      line: 12,
      resolvedBy: "octocat",
    },
    [wireComment("PRRC_followup", FOLLOW_UP_COMMENT_ID)],
    [wireComment("PRRC_followup_latest", null, { __typename: "User", login: "reviewer" })]
  ),
  wireThread(
    {
      id: "PRRT_acknowledged",
      isResolved: true,
      path: "src/commands/Yeet/internal/Handler.ts",
      line: 3,
      resolvedBy: "octocat",
    },
    [wireComment("PRRC_ack", ACKNOWLEDGED_COMMENT_ID)],
    [wireComment("PRRC_ack_latest", null, { __typename: "Bot", login: "coderabbitai" })]
  ),
]);

const replied = { data: { addPullRequestReviewThreadReply: { comment: wireComment("PRRC_reply", 1) } } };
const resolved = { data: { result: { thread: { id: "PRRT_open", isResolved: true } } } };

// The GitHub side of a reply pass: the thread page, then each mutation.
const replyRoutes =
  (threads: unknown, reply: GithubAnswer = { body: replied }): GithubRoutes =>
  (call) =>
    isGraphql("addPullRequestReviewThreadReply")(call)
      ? reply
      : isGraphql("resolveReviewThread")(call)
        ? { body: resolved }
        : isGraphql("reviewThreads")(call)
          ? { body: threads }
          : undefined;

const replyContext = (root: string): RepoRunContext =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/merge-loop",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: root,
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

const writeDrafts = Effect.fnUntraced(function* (context: RepoRunContext, drafts: ReplyDrafts) {
  const fs = yield* FileSystem.FileSystem;
  const replyDraftsPathForContext2 = yield* replyDraftsPathForContext(context);
  const encoded = yield* ReplyDraftsJson.encode(drafts);
  yield* fs.writeFileString(replyDraftsPathForContext2, encoded);
});

const replyTestLayer = (stubs: ReadonlyArray<readonly [string, CommandStub]>) =>
  Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer, stubSpawner(stubs).layer);

const deniedRepoViewStubs: ReadonlyArray<readonly [string, CommandStub]> = [
  ["gh repo view", { exitCode: 1, output: "gh: authentication required" }],
];

const repoViewStubs: ReadonlyArray<readonly [string, CommandStub]> = [["gh repo view", ok(repoViewJson)]];

describe("runYeetReply", () => {
  const twoDrafts = draftsOf([
    ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed in 0123456." }),
    ReplyDraft.make({ commentId: O.some(RESOLVED_COMMENT_ID), body: "Already handled." }),
  ]);

  it.layer(replyTestLayer(deniedRepoViewStubs), { timeout: "30 seconds" })((it) => {
    it.effect("settles every loaded draft when the preflight repo read fails, then fails the run", () =>
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
        const context = replyContext(root);
        yield* writeDrafts(context, twoDrafts);

        const error = yield* Effect.flip(runYeetReply(context).pipe(recordedGithub(replyRoutes(livePage)).provide));
        expect(error.message).toContain("preflight failed before any draft could be posted");
        expect(error.exitCode).toBe(1);

        const fs = yield* FileSystem.FileSystem;
        const reportPath = yield* replyReportPathForContext(context);
        expect(error.file).toBe(reportPath);
        const written = yield* fs.readFileString(reportPath);
        const report = yield* ReplyReportJson.decode(written);
        expect(A.map(report.outcomes, (outcome) => outcome.status)).toEqual(["failed", "failed"]);
        deepStrictEqual(
          A.map(report.outcomes, (outcome) => outcome.threadId),
          [O.some("PRRT_open"), O.none()]
        );
        for (const outcome of report.outcomes) {
          expect(outcome.detail).toContain("gh: authentication required");
          expect(outcome.detail).toContain(REPLY_RERUN_COMMAND);
        }
      })
    );
  });

  it.layer(replyTestLayer(repoViewStubs), { timeout: "30 seconds" })((it) => {
    it.effect("writes a reply-report.json that decodes back through ReplyReportJson", () =>
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
        const spawner = stubSpawner(repoViewStubs);
        const github = recordedGithub(replyRoutes(livePage));
        const context = replyContext(root);
        yield* writeDrafts(context, twoDrafts);

        const report = yield* runYeetReply(context).pipe(github.provide, provideSpawner(spawner));
        expect(A.map(report.outcomes, (outcome) => outcome.status)).toEqual(["resolved", "stale"]);

        expect(A.map(github.calls, githubCallLine)).toEqual([
          "graphql reviewThreads",
          "graphql addPullRequestReviewThreadReply",
          "graphql resolveReviewThread",
        ]);
        expect(A.map(A.drop(github.calls, 1), (call) => call.body)).toMatchObject([
          { variables: { threadId: "PRRT_open", body: "Fixed in 0123456." } },
          { variables: { threadId: "PRRT_open" } },
        ]);
        // The thread page is read from the repository `gh repo view` names.
        expect(A.map(A.take(github.calls, 1), (call) => call.body)).toMatchObject([
          { variables: { owner: "YeeBois", name: "beep-effect", number: 558 } },
        ]);
        expect(spawner.spawns).toHaveLength(1);
        const fs = yield* FileSystem.FileSystem;
        const replyReportPathForContext3 = yield* replyReportPathForContext(context);
        const written = yield* fs.readFileString(replyReportPathForContext3);
        expect(written).not.toContain('"_id":"Option"');
        const decoded4 = yield* ReplyReportJson.decode(written);
        expect(decoded4).toEqual(report);
      })
    );
  });

  it.layer(replyTestLayer(repoViewStubs), { timeout: "30 seconds" })((it) => {
    it.effect("answers a reviewer follow-up without resolving, and leaves an acknowledgement alone", () =>
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
        const github = recordedGithub(replyRoutes(resolvedThreads));
        const context = replyContext(root);
        yield* writeDrafts(
          context,
          draftsOf([
            ReplyDraft.make({ threadId: O.some("PRRT_followup"), body: "Answered: the cast is load-bearing." }),
            ReplyDraft.make({ threadId: O.some("PRRT_acknowledged"), body: "Nothing left to say." }),
          ])
        );

        const report = yield* runYeetReply(context).pipe(github.provide);
        expect(A.map(report.outcomes, (outcome) => outcome.status)).toEqual(["posted", "stale"]);
        const [followUp, acknowledged] = report.outcomes;
        expect(followUp?.detail).toContain("answered a reviewer follow-up on a resolved thread");
        expect(acknowledged?.detail).toContain("already resolved upstream");
        // The follow-up thread is already resolved on GitHub: the run posts the
        // answer and must not fire the resolve mutation for either thread.
        expect(A.map(github.calls, githubCallLine)).toEqual([
          "graphql reviewThreads",
          "graphql addPullRequestReviewThreadReply",
        ]);
      })
    );
  });
});

describe("reply operator surfaces", () => {
  it("renders a body-free resolve retry for a thread left open", () => {
    const command = replyResolveRetryCommand("PRRT_open");
    expect(command).toContain("resolveReviewThread");
    expect(command).toContain("threadId=PRRT_open");
    expect(command).not.toContain("body=");
  });

  it("pins the artifact file names and the rerun command", () => {
    expect(REPLY_DRAFTS_FILE_NAME).toBe("reply-drafts.json");
    expect(REPLY_REPORT_FILE_NAME).toBe("reply-report.json");
    expect(REPLY_RERUN_COMMAND).toBe("bun run beep yeet reply");
  });
});

// A7 (ship-velocity): a pass whose replies were rejected used to exit 0, so
// `yeet reply && bun run beep yeet monitor` walked straight past threads that
// are still open — and an unresolved thread is a hard merge gate. The batch
// still runs to completion; the exit code is what changed.
const deniedReply: GithubAnswer = { status: 403, body: { message: "Resource not accessible by integration" } };

const reportOf = (outcomes: ReadonlyArray<ReplyDraftOutcome>): ReplyReport =>
  ReplyReport.make({
    schemaVersion: "yeet-reply-report/v1",
    prNumber: 558,
    createdAt: "2026-08-16T00:00:00.000Z",
    outcomes,
  });

describe("replyOutcomeTarget", () => {
  it("prefers the thread id the draft named", () => {
    expect(replyOutcomeTarget({ threadId: O.some("PRRT_open"), commentId: O.some(OPEN_COMMENT_ID) })).toBe("PRRT_open");
  });

  it("falls back to the comment handle when only a comment id was named", () => {
    expect(replyOutcomeTarget({ threadId: O.none(), commentId: O.some(OPEN_COMMENT_ID) })).toBe(
      `comment ${OPEN_COMMENT_ID}`
    );
  });

  // Unreachable through a decoded outcome — ReplyTargetPresenceCheck rejects an
  // empty target — but reachable here, which is why the function takes the
  // handles instead of the outcome.
  it("renders an unknown handle rather than throwing on an empty target", () => {
    expect(replyOutcomeTarget({ threadId: O.none(), commentId: O.none() })).toBe("comment ?");
  });
});

describe("reply run verdict", () => {
  it("counts only failed outcomes, never stale ones", () => {
    const report = reportOf([
      ReplyDraftOutcome.make({ threadId: O.some("PRRT_stale"), status: "stale", detail: "already resolved upstream" }),
      ReplyDraftOutcome.make({ threadId: O.some("PRRT_posted"), status: "posted", detail: "reply posted" }),
      ReplyDraftOutcome.make({ threadId: O.some("PRRT_open"), status: "failed", detail: "denied" }),
    ]);
    deepStrictEqual(
      A.map(failedReplyOutcomes(report), (outcome) => outcome.threadId),
      [O.some("PRRT_open")]
    );
  });

  it("names every failed handle, the report, and the still-open threads", () => {
    const verdict = renderYeetReplyFailureVerdict(
      reportOf([
        ReplyDraftOutcome.make({ threadId: O.some("PRRT_open"), status: "failed", detail: "denied" }),
        ReplyDraftOutcome.make({ commentId: O.some(OPEN_COMMENT_ID), status: "failed", detail: "denied" }),
      ]),
      "/repo/.beep/yeet/reply-report.json"
    );
    verdict.pipe(O.isSome, assertTrue);
    const text = O.getOrElse(verdict, () => "");
    expect(text).toContain("2 of 2 drafts");
    expect(text).toContain("PRRT_open");
    expect(text).toContain(`comment ${OPEN_COMMENT_ID}`);
    expect(text).toContain("/repo/.beep/yeet/reply-report.json");
    expect(text).toContain("still open");
    // The retry is per outcome: a draft that posted and only failed to resolve
    // must never be told to re-run the pass, which would post the body twice.
    expect(text).not.toContain(REPLY_RERUN_COMMAND);
  });

  it("has no verdict for a pass where nothing failed", () => {
    assertNone(
      renderYeetReplyFailureVerdict(
        reportOf([
          ReplyDraftOutcome.make({ threadId: O.some("PRRT_a"), status: "resolved", detail: "reply posted" }),
          ReplyDraftOutcome.make({ threadId: O.some("PRRT_b"), status: "stale", detail: "already resolved upstream" }),
        ]),
        "reply-report.json"
      )
    );
  });

  it.effect("exits zero when every outcome is posted, resolved, or stale", () =>
    failYeetReplyOnFailedOutcomes(
      reportOf([
        ReplyDraftOutcome.make({ threadId: O.some("PRRT_a"), status: "resolved", detail: "reply posted" }),
        ReplyDraftOutcome.make({ threadId: O.some("PRRT_b"), status: "stale", detail: "already resolved upstream" }),
      ]),
      "reply-report.json"
    )
  );

  it.effect("exits non-zero, and silently, when any outcome failed", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        failYeetReplyOnFailedOutcomes(
          reportOf([ReplyDraftOutcome.make({ threadId: O.some("PRRT_open"), status: "failed", detail: "denied" })]),
          "reply-report.json"
        )
      );

      // Exit code 1, and reported=false: the pass already printed every
      // outcome, so the sentinel adds the code, not a second rendering.
      expectReportedExit(exit);
    })
  );

  it.layer(replyTestLayer(repoViewStubs), { timeout: "30 seconds" })((it) => {
    it.effect("fails the whole reply run when a live draft's reply is rejected", () =>
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
        const context = replyContext(root);
        yield* writeDrafts(
          context,
          draftsOf([
            ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed in 0123456." }),
            ReplyDraft.make({ commentId: O.some(RESOLVED_COMMENT_ID), body: "Already handled." }),
          ])
        );

        const report = yield* runYeetReply(context).pipe(recordedGithub(replyRoutes(livePage, deniedReply)).provide);
        // The batch still ran: the stale draft was still classified.
        expect(A.map(report.outcomes, (outcome) => outcome.status)).toEqual(["failed", "stale"]);

        const replyReportPathForContext6 = yield* replyReportPathForContext(context);
        const exit5 = yield* Effect.exit(failYeetReplyOnFailedOutcomes(report, replyReportPathForContext6));
        expectReportedExit(exit5);
      })
    );
  });
});

// The closeout collector reads the same kit thread page the reply engine does;
// its comment and review pages and the pull request view stay on gh.
const emptyConnection = { pageInfo: closedPageInfo, nodes: [] };
const closeoutStubs: ReadonlyArray<readonly [string, CommandStub]> = [
  ["gh repo view", ok(repoViewJson)],
  [
    "gh pr view",
    ok(
      Result.getOrThrowWith(
        S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
          number: 558,
          headRefName: "feat/merge-loop",
          state: "OPEN",
          url: "https://github.com/YeeBois/beep-effect/pull/558",
          headRefOid: "abc1234def",
          isDraft: false,
          author: { login: "octocat" },
        }),
        identity
      )
    ),
  ],
  [
    "YeetPrCloseoutComments",
    ok(
      Result.getOrThrowWith(
        S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
          data: { repository: { pullRequest: { comments: emptyConnection } } },
        }),
        identity
      )
    ),
  ],
  [
    "YeetPrCloseoutReviews",
    ok(
      Result.getOrThrowWith(
        S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
          data: { repository: { pullRequest: { reviews: emptyConnection } } },
        }),
        identity
      )
    ),
  ],
];

describe("runPrCloseout", () => {
  it.layer(replyTestLayer(closeoutStubs), { timeout: "30 seconds" })((it) => {
    it.effect("reads the threads through the kit and re-triggers Greptile with a REST comment", () =>
      Effect.gen(function* () {
        const root = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
        const github = recordedGithub((call) =>
          call.path === "{repo}/issues/558/comments"
            ? { status: 201, body: { id: 1, html_url: "https://github.com/c/1" } }
            : replyRoutes(livePage)(call)
        );
        const report = yield* runPrCloseout(
          replyContext(root),
          PrCloseoutOptions.make({ ...yeetAutomaticCloseoutOptions, retriggerGreptile: true })
        ).pipe(github.provide);
        expect(report.prNumber).toBe(558);
        expect(report.retriggeredGreptile).toBe(true);
        expect(A.map(github.calls, githubCallLine)).toEqual([
          "graphql reviewThreads",
          "POST {repo}/issues/558/comments",
        ]);
      })
    );
  });
});
