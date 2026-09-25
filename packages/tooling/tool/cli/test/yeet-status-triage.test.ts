import {
  deriveYeetMergeReady,
  GateUnproven,
  GhStatusCheck,
  PrCloseoutReport,
  renderYeetLaneDigestBlock,
  renderYeetReviewThreadBlock,
  renderYeetStatusSummary,
  summarizeRemoteChecksForTesting,
  YeetCheckSignal,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusReviewThread,
  YeetStatusSnapshot,
  YeetStatusSnapshotJson,
  YeetStatusWorktree,
  YeetVerdict,
  YeetVerdictLane,
  YeetWatchCheck,
  yeetReviewThreadExcerpt,
  yeetStatusArtifactFromVerdictForTesting,
  yeetStatusNextCommandForTesting,
  yeetStatusThreadTriageForTesting,
} from "@beep/repo-cli/test/Yeet";
import { A } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodePrCloseoutReport = S.decodeEffect(PrCloseoutReport);

const HEAD_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HEAD_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// Verbatim shape of a Greptile inline review body: a machine marker, a
// shields.io severity badge, then the sentence a human actually reads.
const greptileBody = A.join(
  [
    "<!-- greptile_comment -->",
    "![](https://img.shields.io/badge/severity-logic-red)",
    "",
    "**logic**: The rerun budget is keyed on the job alone, so a new head SHA never earns a fresh allowance.",
    "",
    "<details><summary>Context</summary>",
    "See `planYeetMonitorReruns`.",
    "</details>",
  ],
  "\n"
);

const humanBody = "Please  add a regression test\nfor the truncated-capture path.";

const triageThread = YeetStatusReviewThread.make({
  threadId: "PRRT_kwDOAbC1",
  author: "greptile-apps[bot]",
  excerpt: yeetReviewThreadExcerpt(greptileBody),
  path: O.some("src/commands/Yeet/internal/MonitorLoop.ts"),
  line: O.some(88),
  commentDatabaseId: O.some(2412551122),
});

const humanThread = YeetStatusReviewThread.make({
  threadId: "PRRT_kwDOAbC2",
  author: "octocat",
  excerpt: yeetReviewThreadExcerpt(humanBody),
  path: O.none(),
  line: O.none(),
  commentDatabaseId: O.some(2412551123),
});

const closeoutArtifact = (
  issueCount: number,
  greptileScore: O.Option<string>,
  reviewedHeadSha: O.Option<string> = O.some(HEAD_A)
) =>
  YeetStatusArtifact.make({
    detail: "PR #560",
    issueCount,
    path: ".beep/yeet/runs/feature/pr-closeout.json",
    reviewedHeadSha,
    state: "present",
    greptileScore,
  });

const openRemote = (fields: {
  readonly checkCount?: number;
  readonly failingCheckCount?: number;
  readonly pendingCheckCount?: number;
  readonly unresolvedReviewThreadCount?: number;
  readonly unresolvedThreads?: O.Option<ReadonlyArray<YeetStatusReviewThread>>;
  readonly headSha?: O.Option<string>;
  readonly isDraft?: boolean;
  readonly mergeable?: string;
  readonly mergeStateStatus?: string;
  readonly reviewDecision?: string;
  readonly state?: string;
}) =>
  YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: "PR #560 OPEN",
    state: fields.state ?? "OPEN",
    isDraft: fields.isDraft ?? false,
    mergeable: fields.mergeable ?? "MERGEABLE",
    mergeStateStatus: fields.mergeStateStatus ?? "CLEAN",
    headSha: fields.headSha ?? O.some(HEAD_A),
    unresolvedReviewThreadCount: fields.unresolvedReviewThreadCount ?? 0,
    unresolvedThreads: fields.unresolvedThreads ?? O.some(A.empty<YeetStatusReviewThread>()),
    ...O.getSomesStruct({
      reviewDecision: O.fromUndefinedOr(fields.reviewDecision),
      checkCount: O.fromUndefinedOr(fields.checkCount),
      failingCheckCount: O.fromUndefinedOr(fields.failingCheckCount),
      pendingCheckCount: O.fromUndefinedOr(fields.pendingCheckCount),
      requiredCheckCount: O.fromUndefinedOr(fields.checkCount),
      failingRequiredCheckCount: O.fromUndefinedOr(fields.failingCheckCount),
      pendingRequiredCheckCount: O.fromUndefinedOr(fields.pendingCheckCount),
    }),
  });

describe("yeet review-thread excerpts", () => {
  it("reduces a badge-prefixed bot body to its first readable sentence", () => {
    const excerpt = yeetReviewThreadExcerpt(greptileBody);

    expect(excerpt).toBe(
      "logic: The rerun budget is keyed on the job alone, so a new head SHA never earns a fresh allowance."
    );
    expect(excerpt).not.toContain("img.shields.io");
    expect(excerpt).not.toContain("<!--");
    expect(excerpt).not.toContain("**");
  });

  it("collapses whitespace in a plain human comment", () => {
    expect(yeetReviewThreadExcerpt(humanBody)).toBe("Please add a regression test");
  });

  it("names an empty body rather than rendering a blank line", () => {
    expect(yeetReviewThreadExcerpt("<!-- greptile_comment -->\n")).toBe("(no comment body)");
  });
});

describe("yeet unresolved-thread listing", () => {
  it("carries author, comment databaseId, location, and excerpt on one line per thread", () => {
    const block = renderYeetReviewThreadBlock(
      openRemote({ unresolvedReviewThreadCount: 2, unresolvedThreads: O.some([triageThread, humanThread]) })
    );
    const lines = Str.split("\n")(block);

    expect(lines[0]).toBe("review threads: 2 unresolved");
    expect(lines[1]).toBe(
      "  - PRRT_kwDOAbC1 comment 2412551122 src/commands/Yeet/internal/MonitorLoop.ts:88 @greptile-apps[bot]: logic: The rerun budget is keyed on the job alone, so a new head SHA never earns a fresh allowance."
    );
    // A conversation-level thread has no file location; the reply identifiers
    // still have to be readable straight off this line.
    expect(lines[2]).toBe("  - PRRT_kwDOAbC2 comment 2412551123 @octocat: Please add a regression test");
  });

  it("lists resolved threads where a reviewer spoke last as follow-ups under the unresolved block", () => {
    const block = renderYeetReviewThreadBlock(
      YeetStatusRemote.make({
        available: true,
        checked: true,
        detail: "PR #560 OPEN",
        unresolvedReviewThreadCount: 0,
        unresolvedThreads: O.some([]),
        followUpThreadCount: 1,
        followUpThreads: O.some([triageThread]),
      })
    );
    const lines = Str.split("\n")(block);

    expect(lines[0]).toBe("review threads: 0 unresolved");
    expect(lines[1]).toBe(
      "review follow-ups: 1 resolved thread(s) where a reviewer spoke last; read and answer them (yeet reply posts on them)"
    );
    expect(lines[2]).toContain("PRRT_kwDOAbC1 comment 2412551122");
  });

  it("lists bot acknowledgements as advisory under the gating sections", () => {
    const block = renderYeetReviewThreadBlock(
      YeetStatusRemote.make({
        available: true,
        checked: true,
        detail: "PR #560 OPEN",
        unresolvedReviewThreadCount: 0,
        unresolvedThreads: O.some([]),
        acknowledgedThreadCount: 1,
        acknowledgedThreads: O.some([triageThread]),
      })
    );
    const lines = Str.split("\n")(block);

    expect(lines[0]).toBe("review threads: 0 unresolved");
    expect(lines[1]).toBe(
      "review acknowledgements: 1 resolved thread(s) a review bot confirmed; advisory, nothing owed"
    );
    expect(lines[2]).toContain("PRRT_kwDOAbC1 comment 2412551122");
  });

  it("falls back to the legacy inline id list when a snapshot carries no triage context", () => {
    const remote = YeetStatusRemote.make({
      available: true,
      checked: true,
      detail: "PR #560 OPEN",
      unresolvedReviewThreadCount: 1,
      unresolvedReviewThreads: ["PRRT_kwDOAbC1 (src/example.ts)"],
    });

    expect(renderYeetReviewThreadBlock(remote)).toBe("review threads: 1 unresolved -> PRRT_kwDOAbC1 (src/example.ts)");
  });

  it("says so when the pull request was never read", () => {
    expect(
      renderYeetReviewThreadBlock(YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" }))
    ).toBe("review threads: not checked");
  });
});

// The GraphQL payload shape `gh api graphql` prints for one page of the status
// thread query, built from the fields the state rule actually reads.
const threadComment = (login: string, body: string, typename = "User", databaseId = 2412551122) => ({
  author: { __typename: typename, login },
  body,
  databaseId,
});

const threadNode = (fields: {
  readonly id: string;
  readonly isResolved: boolean;
  readonly resolvedBy?: string;
  readonly opening?: ReturnType<typeof threadComment>;
  readonly latest?: ReturnType<typeof threadComment>;
  readonly openingHasMorePages?: boolean;
}) => ({
  id: fields.id,
  isResolved: fields.isResolved,
  isOutdated: false,
  path: "src/commands/Yeet/internal/MonitorLoop.ts",
  line: 88,
  resolvedBy: fields.resolvedBy === undefined ? null : { login: fields.resolvedBy },
  comments: {
    nodes: [fields.opening ?? threadComment("greptile-apps[bot]", greptileBody, "Bot")],
    // Selected by the real query only as `first: 1`; a thread with more
    // comments than that is exactly the case `latest` exists to classify.
    pageInfo: { hasNextPage: fields.openingHasMorePages ?? false },
  },
  latest: { nodes: fields.latest === undefined ? [] : [fields.latest] },
});

const threadsPayload = (nodes: ReadonlyArray<ReturnType<typeof threadNode>>, author: string | null = "kriegcloud") =>
  JSON.stringify({
    data: {
      node: {
        author: author === null ? null : { login: author },
        reviewThreads: { nodes, pageInfo: { hasNextPage: false, endCursor: null } },
      },
    },
  });

describe("yeet review-thread classification", () => {
  it.effect("counts a resolved thread whose newest comment is a reviewer's as an outstanding follow-up", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([
          threadNode({
            id: "PRRT_kwDOAbC1",
            isResolved: true,
            resolvedBy: "kriegcloud",
            latest: threadComment("octocat", humanBody),
          }),
        ])
      );

      expect(triage.counts.followUp).toBe(1);
      expect(triage.counts.answered).toBe(0);
      expect(A.map(triage.followUpThreads, (thread) => thread.author)).toEqual(["octocat"]);
      // The row is triaged from the follow-up itself, not from the opening
      // comment: the sentence the operator owes an answer to is the new one.
      expect(A.map(triage.followUpThreads, (thread) => thread.excerpt)).toEqual(["Please add a regression test"]);

      const mergeReady = deriveYeetMergeReady(
        closeoutArtifact(0, O.some("5/5")),
        YeetStatusRemote.make({
          ...openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 }),
          followUpThreadCount: triage.counts.followUp,
        })
      );

      expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
    })
  );

  it.effect("stops counting the same thread once the author has replied on it", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([
          threadNode({
            id: "PRRT_kwDOAbC1",
            isResolved: true,
            resolvedBy: "kriegcloud",
            latest: threadComment("kriegcloud", "Fixed in the follow-up commit."),
          }),
        ])
      );

      expect(triage.counts.followUp).toBe(0);
      expect(triage.counts.answered).toBe(1);
      expect(triage.followUpThreads).toEqual([]);
    })
  );

  it.effect("classifies a thread with more comments than the opening page from its newest comment", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([
          threadNode({
            id: "PRRT_kwDOAbC1",
            isResolved: true,
            resolvedBy: "kriegcloud",
            opening: threadComment("kriegcloud", "Opened by the author."),
            openingHasMorePages: true,
            latest: threadComment("octocat", humanBody),
          }),
        ])
      );

      expect(triage.counts.followUp).toBe(1);
    })
  );

  it.effect("reports a review bot's last word as an acknowledgement that does not gate", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([
          threadNode({
            id: "PRRT_kwDOAbC1",
            isResolved: true,
            resolvedBy: "kriegcloud",
            latest: threadComment("coderabbitai", "Verified, thanks!", "Bot"),
          }),
        ])
      );

      expect(triage.counts.acknowledged).toBe(1);
      expect(triage.counts.followUp).toBe(0);
      expect(A.map(triage.acknowledgedThreads, (thread) => thread.author)).toEqual(["coderabbitai"]);

      const mergeReady = deriveYeetMergeReady(
        closeoutArtifact(0, O.some("5/5")),
        YeetStatusRemote.make({
          ...openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 }),
          acknowledgedThreadCount: triage.counts.acknowledged,
        })
      );

      expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
    })
  );

  it.effect("treats a thread resolved by somebody other than the author as answered", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([
          threadNode({
            id: "PRRT_kwDOAbC1",
            isResolved: true,
            resolvedBy: "octocat",
            latest: threadComment("octocat", humanBody),
          }),
        ])
      );

      expect(triage.counts.answered).toBe(1);
      expect(triage.counts.followUp).toBe(0);
    })
  );

  it.effect("triages an unresolved thread from its opening comment", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(
        threadsPayload([threadNode({ id: "PRRT_kwDOAbC1", isResolved: false })])
      );

      expect(triage.counts.unresolved).toBe(1);
      expect(A.map(triage.unresolvedThreads, (thread) => thread.author)).toEqual(["greptile-apps[bot]"]);
    })
  );
});

// The review-thread page `gh api graphql` actually returned for PR #1184 on
// 2026-09-22, kept verbatim in `test/fixtures/`. Two adaptations, neither
// touching a fact the rule reads: the capture was taken through the
// repository-rooted query, so its `data.repository.pullRequest` is moved under
// the `data.node` root the status query selects, and its comment selection
// asked only for authors, so the two display-only fields the status query also
// selects are filled in as absent. Logins, actor typenames, `resolvedBy` and
// resolution state are the file's own.
const readCapturedThreads = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(new URL("./fixtures/pr-review-bodies/pr1184-threads.json", import.meta.url).pathname);
});

const capturedThreadsText = await Effect.runPromise(
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(
      Effect.flatMap((context) => readCapturedThreads().pipe(Effect.provide(context)))
    )
  )
);

const capturedThreadsPayload = (): string => {
  const captured = JSON.parse(capturedThreadsText) as {
    readonly data: {
      readonly repository: {
        readonly pullRequest: {
          readonly author: { readonly login: string };
          readonly reviewThreads: { readonly nodes: ReadonlyArray<Record<string, unknown>> };
        };
      };
    };
  };
  const pullRequest = captured.data.repository.pullRequest;
  const displayable = (connection: unknown) => ({
    nodes: A.map((connection as { readonly nodes: ReadonlyArray<Record<string, unknown>> }).nodes, (node) => ({
      body: null,
      databaseId: null,
      ...node,
    })),
  });
  return JSON.stringify({
    data: {
      node: {
        author: pullRequest.author,
        reviewThreads: {
          nodes: A.map(pullRequest.reviewThreads.nodes, (thread) => ({
            ...thread,
            comments: displayable(thread.comments),
            latest: displayable(thread.latest),
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
};

describe("yeet review-thread classification against a captured pull request", () => {
  it.effect("reads PR #1184's eight threads as six answered and two bot acknowledgements", () =>
    Effect.gen(function* () {
      const triage = yield* yeetStatusThreadTriageForTesting(capturedThreadsPayload());

      // Nothing is owed on that pull request: five threads a reviewer closed
      // themselves or the author had the last word on, one the author closed
      // after speaking last, and the two CodeRabbit confirmed after the author
      // closed them. A rule that read "resolved by the author, somebody else
      // spoke last" as a follow-up would have blocked the merge on those two.
      expect(triage.counts).toMatchObject({ unresolved: 0, followUp: 0, acknowledged: 2, answered: 6 });
      expect(triage.followUpThreads).toEqual([]);
      expect(triage.unresolvedThreads).toEqual([]);
      expect(A.map(triage.acknowledgedThreads, (thread) => thread.author)).toEqual(["coderabbitai", "coderabbitai"]);
      expect(A.map(triage.acknowledgedThreads, (thread) => thread.threadId)).toEqual([
        "PRRT_kwDOPbO_N86knAXS",
        "PRRT_kwDOPbO_N86ksUUr",
      ]);
    })
  );
});

describe("yeet merge readiness", () => {
  it("is unknown, not blocked, when the pull request was not read", () => {
    expect(
      deriveYeetMergeReady(
        closeoutArtifact(0, O.some("5/5")),
        YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
      )
    ).toStrictEqual(O.none());
  });

  it("names required-checks-green first when the pipeline is red and threads are also open", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(1, O.some("4/5")),
      openRemote({ checkCount: 24, failingCheckCount: 1, unresolvedReviewThreadCount: 2 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(false));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("required-checks-green"));
  });

  it("treats a still-pending pipeline as not green", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.none()),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 3 })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("required-checks-green"));
  });

  it("names threads-resolved once the pipeline is green", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("5/5")),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 1 })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
  });

  it("counts unresolved closeout issues as an open-thread blocker", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(2, O.some("5/5")),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 0 })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
  });

  it("blocks on closeout-run when the closeout artifact is missing without mislabeling threads", () => {
    const mergeReady = deriveYeetMergeReady(
      YeetStatusArtifact.make({
        detail: "no closeout artifact found for this branch",
        path: ".beep/yeet/runs/feature/pr-closeout.json",
        state: "missing",
      }),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 0 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(false));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("closeout-run"));
    expect(O.map(mergeReady, (value) => value.criteria.threadsResolved)).toStrictEqual(O.some(true));
  });

  it("blocks on closeout-run when the reviewed head no longer matches the remote head", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("5/5"), O.some(HEAD_A)),
      openRemote({
        checkCount: 24,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        unresolvedReviewThreadCount: 0,
        headSha: O.some(HEAD_B),
      })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("closeout-run"));
  });

  it("satisfies closeout-run when the reviewed and remote heads match", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("5/5"), O.some(HEAD_A)),
      openRemote({
        checkCount: 24,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        unresolvedReviewThreadCount: 0,
        headSha: O.some(HEAD_A),
      })
    );

    expect(O.map(mergeReady, (value) => value.criteria.closeoutRun)).toStrictEqual(O.some(true));
    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
  });

  it.effect("decodes a legacy headless closeout report and treats it as stale", () =>
    Effect.gen(function* () {
      const report = yield* decodePrCloseoutReport({
        actionableReviewThreadCount: 0,
        botCommentCount: 0,
        greptile: {},
        issueCount: 0,
        issues: [],
        prNumber: 560,
        prUrl: "https://github.com/example/repo/pull/560",
        retriggeredGreptile: false,
        schemaVersion: "yeet-pr-closeout/v1",
      });
      const mergeReady = deriveYeetMergeReady(
        YeetStatusArtifact.make({
          detail: "PR #560",
          issueCount: report.issueCount,
          path: "pr-closeout.json",
          reviewedHeadSha: report.reviewedHeadSha,
          state: "present",
        }),
        openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 })
      );

      expect(report.reviewedHeadSha).toStrictEqual(O.none());
      expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("closeout-run"));
    })
  );

  it("recommends closeout before any remote rerun handoff when its artifact is missing", () => {
    const closeout = YeetStatusArtifact.make({ detail: "missing", path: "pr-closeout.json", state: "missing" });
    const remote = YeetStatusRemote.make({
      ...openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 }),
      rerunFailedCommand: "gh run view 42",
      rerunFailedDecision: "same-SHA failed workflow",
    });

    expect(
      yeetStatusNextCommandForTesting(
        YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
        YeetStatusArtifact.make({
          detail: "publish success",
          outcome: "success",
          path: "verdict.json",
          state: "present",
        }),
        closeout,
        remote
      )
    ).toContain("beep yeet closeout");
  });

  it("suggests yeet reply when a reviewer follow-up is the one thing blocking the merge", () => {
    const remote = YeetStatusRemote.make({
      ...openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 }),
      followUpThreadCount: 1,
      followUpThreads: O.some([triageThread]),
    });
    const command = yeetStatusNextCommandForTesting(
      YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
      YeetStatusArtifact.make({ detail: "success", outcome: "success", path: "verdict.json", state: "present" }),
      closeoutArtifact(0, O.some("5/5")),
      remote
    );

    expect(command).toContain("bun run beep yeet reply");
  });

  it("does not send the operator to yeet reply while the required checks are also red", () => {
    // `failing` names only the first blocker in protocol order, and threads
    // lead required checks in that order. Answering reviewers would not make
    // this branch mergeable, so the command has to stay on the red pipeline.
    const remote = YeetStatusRemote.make({
      ...openRemote({ checkCount: 24, failingCheckCount: 3, pendingCheckCount: 0 }),
      followUpThreadCount: 1,
      followUpThreads: O.some([triageThread]),
      rerunFailedCommand: "gh run view 42",
      rerunFailedDecision: "same-SHA failed workflow",
    });
    const command = yeetStatusNextCommandForTesting(
      YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
      YeetStatusArtifact.make({ detail: "success", outcome: "success", path: "verdict.json", state: "present" }),
      closeoutArtifact(0, O.some("5/5")),
      remote
    );

    expect(command).not.toContain("yeet reply");
    expect(command).toContain("gh run view 42");
  });

  it("keeps recommending closeout when only the closeout artifact's own issues block threads-resolved", () => {
    const command = yeetStatusNextCommandForTesting(
      YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
      YeetStatusArtifact.make({ detail: "success", outcome: "success", path: "verdict.json", state: "present" }),
      closeoutArtifact(2, O.some("5/5")),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0 })
    );

    expect(command).toContain("beep yeet closeout");
    expect(command).not.toContain("yeet reply");
  });

  it("is ready with no failing criterion when all hard criteria hold, carrying Greptile as display only", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("4/5")),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 0 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.none());
    expect(O.flatMap(mergeReady, (value) => value.criteria.greptileScore)).toStrictEqual(O.some("4/5"));
  });

  it("treats gh's empty review decision as absent", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("5/5")),
      openRemote({
        checkCount: 17,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        reviewDecision: "",
        unresolvedReviewThreadCount: 0,
      })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.none());
  });

  it("does not let an optional red block required-check readiness", () => {
    const remote = YeetStatusRemote.make({
      ...openRemote({ checkCount: 17, failingCheckCount: 0, pendingCheckCount: 0 }),
      checkCount: 18,
      failingCheckCount: 1,
      optionalCheckCount: 1,
      failingOptionalCheckCount: 1,
    });
    const mergeReady = deriveYeetMergeReady(closeoutArtifact(0, O.some("5/5")), remote);

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
  });

  it.each([
    ["pr-open", { state: "CLOSED" }],
    ["not-draft", { isDraft: true }],
    ["mergeable", { mergeable: "CONFLICTING" }],
    ["merge-state-acceptable", { mergeStateStatus: "BLOCKED" }],
    ["review-decision-acceptable", { reviewDecision: "CHANGES_REQUESTED" }],
  ] as const)("blocks on %s when that live pull request surface is unsatisfied", (criterion, fields) => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("5/5")),
      openRemote({
        checkCount: 17,
        failingCheckCount: 0,
        pendingCheckCount: 0,
        unresolvedReviewThreadCount: 0,
        ...fields,
      })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some(criterion));
  });
});

describe("yeet remote check partitions", () => {
  it("counts required and optional failures independently", () => {
    const required = GhStatusCheck.make({ bucket: "pass", name: "Check / Lint", state: "SUCCESS" });
    const optionalFailure = GhStatusCheck.make({ bucket: "fail", name: "Vercel", state: "FAILURE" });
    const optionalPending = GhStatusCheck.make({ bucket: "pending", name: "Preview", state: "IN_PROGRESS" });
    const summary = summarizeRemoteChecksForTesting(
      O.some([required, optionalFailure, optionalPending]),
      O.some([required])
    );

    expect(O.getOrThrow(summary.checkCount)).toBe(3);
    expect(O.getOrThrow(summary.failingCheckCount)).toBe(1);
    expect(O.getOrThrow(summary.pendingCheckCount)).toBe(1);
    expect(O.getOrThrow(summary.requiredCheckCount)).toBe(1);
    expect(O.getOrThrow(summary.failingRequiredCheckCount)).toBe(0);
    expect(O.getOrThrow(summary.pendingRequiredCheckCount)).toBe(0);
    expect(O.getOrThrow(summary.optionalCheckCount)).toBe(2);
    expect(O.getOrThrow(summary.failingOptionalCheckCount)).toBe(1);
    expect(O.getOrThrow(summary.pendingOptionalCheckCount)).toBe(1);
  });

  it("keeps the optional partition unknown when the required capture is unavailable", () => {
    const required = GhStatusCheck.make({ bucket: "pass", name: "Check / Lint", state: "SUCCESS" });
    const summary = summarizeRemoteChecksForTesting(O.some([required]), O.none());

    expect(O.getOrThrow(summary.checkCount)).toBe(1);
    expect(summary.requiredCheckCount).toStrictEqual(O.none());
    expect(summary.optionalCheckCount).toStrictEqual(O.none());
  });
});

describe("yeet status snapshot rendering and encoding", () => {
  const remote = openRemote({
    checkCount: 24,
    failingCheckCount: 0,
    pendingCheckCount: 0,
    unresolvedReviewThreadCount: 1,
    unresolvedThreads: O.some([triageThread]),
  });
  const closeout = closeoutArtifact(0, O.some("5/5"));
  const snapshot = YeetStatusSnapshot.make({
    base: "origin/main",
    branch: "feat/merge-loop",
    closeout,
    createdAt: "2026-08-04T00:00:00.000Z",
    head: "HEAD",
    nextCommand: "bun run beep yeet closeout --summary",
    remote,
    runId: "feat_merge-loop",
    schemaVersion: "yeet-status/v1",
    statusPath: ".beep/yeet/runs/feat_merge-loop/status.json",
    verdict: YeetStatusArtifact.make({ detail: "publish success", path: "verdict.json", state: "present" }),
    worktree: YeetStatusWorktree.make({ clean: true, staged: 0, unstaged: 0, untracked: 0 }),
    mergeReady: deriveYeetMergeReady(closeout, remote),
  });

  it("renders the single failing criterion beside the thread triage block", () => {
    const summary = renderYeetStatusSummary(snapshot);

    expect(summary).toContain("- review threads: 1 unresolved");
    expect(summary).toContain("  - PRRT_kwDOAbC1 comment 2412551122");
    expect(summary).toContain("- merge-ready: no, blocked on threads-resolved (greptile 5/5)");
  });

  it("renders the per-lane Turbo digests recorded on the verdict", () => {
    const summary = renderYeetStatusSummary(
      YeetStatusSnapshot.make({
        ...snapshot,
        verdict: YeetStatusArtifact.make({
          ...snapshot.verdict,
          laneDigests: [{ id: "quality:knip", inputDigest: "0d5970886d36b416" }],
        }),
      })
    );

    expect(summary).toContain("- lane digests: 1 lane(s)");
    expect(summary).toContain("  quality:knip: 0d5970886d36b416");
    expect(renderYeetStatusSummary(snapshot)).toContain("- lane digests: none recorded");
  });

  it("renders missing gate artifacts as unproven rather than clean", () => {
    const summary = renderYeetStatusSummary(
      YeetStatusSnapshot.make({
        ...snapshot,
        unprovenGates: [GateUnproven.make({ gateId: "jsdoc-inventory", detail: "artifact does not exist" })],
      })
    );

    expect(summary).toContain("gate staleness: 0 stale, 1 unproven");
    expect(summary).not.toContain("gate staleness: none");
  });

  it("renders legacy unsplit and unavailable check snapshots without overstating required-check state", () => {
    const legacySummary = renderYeetStatusSummary(
      YeetStatusSnapshot.make({
        ...snapshot,
        remote: YeetStatusRemote.make({
          available: true,
          checked: true,
          checkCount: 18,
          detail: "PR #560 OPEN",
          failingCheckCount: 1,
          pendingCheckCount: 2,
        }),
      })
    );
    const unavailableSummary = renderYeetStatusSummary(
      YeetStatusSnapshot.make({
        ...snapshot,
        remote: YeetStatusRemote.make({ available: true, checked: true, detail: "PR #560 OPEN" }),
      })
    );

    expect(legacySummary).toContain("checks: 18 total, 1 failing, 2 pending (legacy unsplit snapshot)");
    expect(unavailableSummary).toContain("checks: not checked");
  });

  it.effect("round-trips through the status JSON codec instead of leaking Option runtime objects", () =>
    Effect.gen(function* () {
      const json = yield* YeetStatusSnapshotJson.encode(snapshot);
      const decoded = yield* YeetStatusSnapshotJson.decode(json);

      // Regression: the writer used a generic JSON encoder over the decoded
      // snapshot, which rendered Option fields as {"_id":"Option",...} and
      // produced an artifact that no longer decoded.
      expect(json).not.toContain('"_id":"Option"');
      expect(O.flatMap(decoded.mergeReady, (value) => value.failing)).toStrictEqual(O.some("threads-resolved"));
      expect(
        O.map(decoded.remote.unresolvedThreads, (threads) => A.map(threads, (thread) => thread.commentDatabaseId))
      ).toStrictEqual(O.some([O.some(2412551122)]));
    })
  );

  it.effect("decodes a status artifact written before merge readiness and thread triage existed", () =>
    Effect.gen(function* () {
      const legacy = [
        '{"base":"origin/main","branch":"feature","closeout":{"detail":"missing","path":"pr-closeout.json",',
        '"state":"missing"},"createdAt":"2026-06-11T00:00:00.000Z","head":"HEAD","nextCommand":"bun run beep yeet verify",',
        '"remote":{"available":false,"checked":false,"detail":"pass --remote"},"runId":"feature",',
        '"schemaVersion":"yeet-status/v1","statusPath":"status.json",',
        '"verdict":{"detail":"missing","path":"verdict.json","state":"missing"},',
        '"worktree":{"clean":true,"staged":0,"unstaged":0,"untracked":0}}',
      ].join("");
      const decoded = yield* YeetStatusSnapshotJson.decode(legacy);

      expect(decoded.mergeReady).toStrictEqual(O.none());
      expect(decoded.remote.unresolvedThreads).toStrictEqual(O.none());
      expect(decoded.remote.headSha).toStrictEqual(O.none());
      expect(decoded.remote.checks).toStrictEqual([]);
      expect(decoded.unprovenGates).toStrictEqual([]);
    })
  );

  it.effect("round-trips each check's whole record and omits GitHub's instants when absent", () =>
    Effect.gen(function* () {
      const red = YeetWatchCheck.make({
        name: "Check / Coverage",
        outcome: "fail",
        required: true,
        link: "https://github.com/beep/beep/actions/runs/9/job/9",
        signal: YeetCheckSignal.make({ bucket: "fail", state: "FAILURE" }),
        workflow: "Check",
        startedAt: O.some("2026-09-25T11:27:04Z"),
        completedAt: O.some("2026-09-25T11:53:05Z"),
      });
      const external = YeetWatchCheck.make({
        name: "Vercel",
        outcome: "fail",
        required: false,
        signal: YeetCheckSignal.make({ bucket: "fail", state: "FAILURE" }),
      });
      const withChecks = YeetStatusSnapshot.make({
        ...snapshot,
        remote: YeetStatusRemote.make({ ...snapshot.remote, checks: [red, external] }),
      });
      const json = yield* YeetStatusSnapshotJson.encode(withChecks);
      const decoded = yield* YeetStatusSnapshotJson.decode(json);

      expect(decoded.remote.checks).toStrictEqual([red, external]);
      expect(json).toContain('"completedAt":"2026-09-25T11:53:05Z"');
      expect(Str.split(json, '"startedAt"')).toHaveLength(2);
      expect(json).not.toContain('"_id":"Option"');
    })
  );

  it("projects verdict lanes with digests into the artifact and renders them", () => {
    const lane = (id: string, inputDigest: O.Option<string>, status: "passed" | "failed") =>
      YeetVerdictLane.make({
        id,
        label: id,
        phase: "full",
        status,
        inputDigest,
        ...(status === "failed" ? { repairCommand: `bun run beep ${id}` } : {}),
      });
    const verdict = YeetVerdict.make({
      schemaVersion: "yeet-verdict/v2",
      base: "origin/main",
      branch: "feat/x",
      committed: true,
      createdAt: "2026-09-12T00:00:00.000Z",
      head: "HEAD",
      lanes: [lane("quality:knip", O.some("abc"), "passed"), lane("quality:check", O.none(), "failed")],
      message: "one lane failed",
      mode: "publish",
      outcome: "failure",
      packetPaths: [],
      pushed: false,
      runId: "feat_x",
    });
    const artifact = yeetStatusArtifactFromVerdictForTesting("verdict.json", verdict);
    expect(artifact.laneDigests).toEqual([{ id: "quality:knip", inputDigest: "abc" }]);
    expect(artifact.repairCommand).toBe("bun run beep quality:check");
    expect(renderYeetLaneDigestBlock(artifact)).toBe("lane digests: 1 lane(s)\n  quality:knip: abc");
  });
});
