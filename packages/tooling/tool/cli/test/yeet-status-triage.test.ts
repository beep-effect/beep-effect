import {
  deriveYeetMergeReady,
  renderYeetReviewThreadBlock,
  renderYeetStatusSummary,
  YeetStatusArtifact,
  YeetStatusRemote,
  YeetStatusReviewThread,
  YeetStatusSnapshot,
  YeetStatusSnapshotJson,
  YeetStatusWorktree,
  yeetReviewThreadExcerpt,
} from "@beep/repo-cli/test/Yeet";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

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

const closeoutArtifact = (issueCount: number, greptileScore: O.Option<string>) =>
  YeetStatusArtifact.make({
    detail: "PR #560",
    issueCount,
    path: ".beep/yeet/runs/feature/pr-closeout.json",
    state: "present",
    greptileScore,
  });

const openRemote = (fields: {
  readonly checkCount?: number;
  readonly failingCheckCount?: number;
  readonly pendingCheckCount?: number;
  readonly unresolvedReviewThreadCount?: number;
  readonly unresolvedThreads?: O.Option<ReadonlyArray<YeetStatusReviewThread>>;
}) =>
  YeetStatusRemote.make({
    available: true,
    checked: true,
    detail: "PR #560 OPEN",
    unresolvedReviewThreadCount: fields.unresolvedReviewThreadCount ?? 0,
    unresolvedThreads: fields.unresolvedThreads ?? O.some(A.empty<YeetStatusReviewThread>()),
    ...(fields.checkCount === undefined ? {} : { checkCount: fields.checkCount }),
    ...(fields.failingCheckCount === undefined ? {} : { failingCheckCount: fields.failingCheckCount }),
    ...(fields.pendingCheckCount === undefined ? {} : { pendingCheckCount: fields.pendingCheckCount }),
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

describe("yeet merge readiness", () => {
  it("is unknown, not blocked, when the pull request was not read", () => {
    expect(
      deriveYeetMergeReady(
        closeoutArtifact(0, O.some("5/5")),
        YeetStatusRemote.make({ available: false, checked: false, detail: "pass --remote" })
      )
    ).toStrictEqual(O.none());
  });

  it("names checks-green first when the pipeline is red and threads are also open", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(1, O.some("4/5")),
      openRemote({ checkCount: 24, failingCheckCount: 1, unresolvedReviewThreadCount: 2 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(false));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("checks-green"));
  });

  it("treats a still-pending pipeline as not green", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.none()),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 3 })
    );

    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.some("checks-green"));
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

  it("treats a missing closeout artifact as unknown, not as an open-thread blocker", () => {
    const mergeReady = deriveYeetMergeReady(
      YeetStatusArtifact.make({
        detail: "no closeout artifact found for this branch",
        path: ".beep/yeet/runs/feature/pr-closeout.json",
        state: "missing",
      }),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 0 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.none());
  });

  it("is ready with no failing criterion when both hard criteria hold, carrying Greptile as display only", () => {
    const mergeReady = deriveYeetMergeReady(
      closeoutArtifact(0, O.some("4/5")),
      openRemote({ checkCount: 24, failingCheckCount: 0, pendingCheckCount: 0, unresolvedReviewThreadCount: 0 })
    );

    expect(O.map(mergeReady, (value) => value.ready)).toStrictEqual(O.some(true));
    expect(O.flatMap(mergeReady, (value) => value.failing)).toStrictEqual(O.none());
    expect(O.flatMap(mergeReady, (value) => value.criteria.greptileScore)).toStrictEqual(O.some("4/5"));
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
    })
  );
});
