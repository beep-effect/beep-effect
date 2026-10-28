import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  buildYeetEconomicsReviewLane,
  classifyYeetReviewer,
  EconomicsReviewLanePrecisionRow,
  EconomicsScopeRequest,
  planReplyActions,
  ReplyDraft,
  ReplyDraftOutcome,
  ReplyDrafts,
  ReplyLiveThread,
  ReplyPassFacts,
  ReplyPostAction,
  ReplyThreadComment,
  ReplyThreadCommentConnection,
  ReviewLaneDispositionRow,
  ReviewLaneFlipRow,
  ReviewLaneHeadRow,
  ReviewLaneLedger,
  ReviewLaneMergeReadyRow,
  ReviewLaneReviewRow,
  ReviewLaneRow,
  ReviewLaneRowJson,
  readYeetReviewLaneLedger,
  recordYeetReviewLaneRows,
  renderYeetEconomicsReviewLane,
  replyDispositionRows,
  resolveReviewLaneLedgerLocation,
  reviewLaneRowKey,
  runYeetEconomics,
  YEET_ECONOMICS_PRECISION_METHOD,
  YEET_REVIEW_LANE_LEDGER_FILE_NAME,
  YeetEconomicsOptions,
  YeetEconomicsReportJson,
  YeetEconomicsSource,
  YeetReviewDisposition,
  YeetReviewerIdentity,
  YeetReviewerKind,
  YeetReviewLaneLedger,
  YeetReviewLaneSource,
} from "@beep/repo-cli/test/Yeet";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { YeetThreadDisposition } from "@beep/repo-cli/test/Yeet";

const BRANCH = "feat/review-lane";
const OTHER_BRANCH = "feat/other";
const PR = 2300;
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";
const SHA_Z = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";
const BASE = "2026-10-27T10:";
const at = (minute: number): string => `${BASE}${Str.padStart(2, "0")(`${minute}`)}:00.000Z`;
const RECORDED_AT = at(59);

const BEEP = YeetReviewerIdentity.make({ login: "beep-reviewer[bot]", kind: "beep-reviewer" });
const GREPTILE = YeetReviewerIdentity.make({ login: "greptile-apps[bot]", kind: "greptile" });
const HUMAN = YeetReviewerIdentity.make({ login: "octocat", kind: "human" });

const base = (branch = BRANCH) => ({
  schemaVersion: "yeet-review-lane/v1" as const,
  prNumber: PR,
  branch,
  recordedAt: RECORDED_AT,
});

const flip = (minute: number, headSha = SHA_A, branch = BRANCH): ReviewLaneRow =>
  ReviewLaneFlipRow.make({ ...base(branch), headSha, at: at(minute) });

const head = (minute: number, headSha: string): ReviewLaneRow =>
  ReviewLaneHeadRow.make({ ...base(), headSha, pushedAt: O.some(at(minute)), observedAt: at(minute + 1) });

const review = (
  reviewId: number,
  minute: number,
  commitSha: O.Option<string>,
  reviewer: YeetReviewerIdentity = BEEP,
  state = "COMMENTED"
): ReviewLaneRow =>
  ReviewLaneReviewRow.make({ ...base(), reviewId, reviewer, commitSha, state, submittedAt: at(minute) });

const mergeReady = (minute: number, headSha: string): ReviewLaneRow =>
  ReviewLaneMergeReadyRow.make({ ...base(), headSha, at: at(minute) });

const disposition = (
  threadId: string,
  value: YeetThreadDisposition,
  reviewer: O.Option<YeetReviewerIdentity> = O.some(BEEP),
  prNumber = PR
): ReviewLaneRow => ReviewLaneDispositionRow.make({ ...base(), prNumber, threadId, reviewer, disposition: value });

const ledger = (rows: ReadonlyArray<ReviewLaneRow>, malformedRows = 0): ReviewLaneLedger =>
  ReviewLaneLedger.make({ ledgerPath: "/repo/.beep/yeet/review-lane.ndjson", rows, malformedRows });

// One pull request through two rounds: reviewed on A after the flip, pushed
// B, reviewed on B, announced merge-ready on B. A review before the flip and
// one after the announcement sit outside the window.
const twoRounds: ReadonlyArray<ReviewLaneRow> = [
  review(1, 0, O.some(SHA_Z)),
  head(1, SHA_A),
  flip(5),
  review(2, 6, O.some(SHA_A)),
  review(3, 7, O.some(SHA_A), GREPTILE),
  head(10, SHA_B),
  review(4, 12, O.some(SHA_B)),
  mergeReady(15, SHA_B),
  review(5, 20, O.some(SHA_C)),
];

const precisionRows = (ledgers: ReadonlyArray<ReviewLaneLedger>, reviewer: YeetReviewerKind) =>
  A.findFirst(buildYeetEconomicsReviewLane(ledgers, O.none()).precision, (row) => row.reviewer === reviewer);

const precisionRow = (rows: ReadonlyArray<ReviewLaneRow>, reviewer: YeetReviewerKind) =>
  precisionRows([ledger(rows)], reviewer);

const ledgerAt = (root: string, rows: ReadonlyArray<ReviewLaneRow>): ReviewLaneLedger =>
  ReviewLaneLedger.make({
    ledgerPath: `${root}/.beep/yeet/${YEET_REVIEW_LANE_LEDGER_FILE_NAME}`,
    rows,
    malformedRows: 0,
  });

const rowsEquivalent = S.toEquivalence(ReviewLaneRow);

describe("review lane ledger rows", () => {
  it.effect.prop("round-trips every generated row through the ledger line codec", [ReviewLaneRow], ([row]) =>
    Effect.gen(function* () {
      const decoded = yield* ReviewLaneRowJson.decode(yield* ReviewLaneRowJson.encode(row));
      assertTrue(rowsEquivalent(decoded, row));
    })
  );
});

describe("review lane rounds to ready", () => {
  it("counts one round per reviewed head between the flip and the first merge-ready", () => {
    const section = buildYeetEconomicsReviewLane([ledger(twoRounds)], O.none());
    const { roundsToReady: rounds } = section;
    expect(rounds.closedPullRequests).toBe(1);
    expect(rounds.openPullRequests).toBe(0);
    assertSome(rounds.p50Rounds, 2);
    assertSome(rounds.p95Rounds, 2);
    expect(rounds.roundsMix).toEqual([{ key: "2", count: 1 }]);
    expect(rounds.unassignedReviews).toBe(0);
    expect(rounds.pullRequests).toHaveLength(1);
    const pullRequest = A.getUnsafe(rounds.pullRequests, 0);
    assertSome(pullRequest.mergeReadyAt, at(15));
    expect(pullRequest).toMatchObject({
      prNumber: PR,
      flipAt: at(5),
      rounds: 2,
      reviews: 3,
      heads: 1,
      unassignedReviews: 0,
    });
    expect(section.ledgerQuality).toEqual({
      ledgersRead: 1,
      unreadableLedgers: 0,
      rows: 9,
      malformedRows: 0,
      duplicateReviewRowsDeduplicated: 0,
      pullRequestsWithoutFlip: 0,
      unattributedDispositions: 0,
    });
  });

  // Must-fail fixture (ruling 81): a watermark migration reseeds the
  // review-body cursor earlier and the stream re-emits reviews it already
  // printed; two monitors on one branch record the same review. Neither may
  // add a round.
  it("never counts a round twice when the same review rows are recorded again", () => {
    const once = buildYeetEconomicsReviewLane([ledger(twoRounds)], O.none());
    const replayed = [...twoRounds, review(2, 6, O.some(SHA_A)), review(4, 12, O.some(SHA_B)), head(10, SHA_B)];
    const twice = buildYeetEconomicsReviewLane([ledger(replayed)], O.none());
    expect(twice.roundsToReady).toEqual(once.roundsToReady);
    expect(twice.ledgerQuality.duplicateReviewRowsDeduplicated).toBe(2);
    // The same replay split across two ledgers of the fleet folds the same way.
    const split = buildYeetEconomicsReviewLane([ledger(twoRounds), ledger(A.drop(replayed, 9))], O.none());
    expect(split.roundsToReady).toEqual(once.roundsToReady);
  });

  it("keeps an open pull request out of the sample and a merge-ready before the flip from closing it", () => {
    const open = buildYeetEconomicsReviewLane(
      [ledger([mergeReady(1, SHA_Z), flip(5), review(2, 6, O.some(SHA_A))])],
      O.none()
    );
    expect(open.roundsToReady.closedPullRequests).toBe(0);
    expect(open.roundsToReady.openPullRequests).toBe(1);
    assertNone(open.roundsToReady.p50Rounds);
    assertNone(open.roundsToReady.p95Rounds);
    expect(open.roundsToReady.roundsMix).toEqual([]);
    assertNone(A.getUnsafe(open.roundsToReady.pullRequests, 0).mergeReadyAt);
    expect(A.getUnsafe(open.roundsToReady.pullRequests, 0).rounds).toBe(1);
  });

  it("counts a review pinned to no commit as unassigned, never as a round", () => {
    const section = buildYeetEconomicsReviewLane(
      [ledger([flip(5), review(2, 6, O.none()), mergeReady(15, SHA_A)])],
      O.none()
    );
    expect(section.roundsToReady.pullRequests).toMatchObject([{ rounds: 0, reviews: 1, unassignedReviews: 1 }]);
    expect(section.roundsToReady.unassignedReviews).toBe(1);
    assertSome(section.roundsToReady.p50Rounds, 0);
  });

  it("counts a pull request with reviews and no flip, and never samples it", () => {
    const section = buildYeetEconomicsReviewLane(
      [ledger([review(2, 6, O.some(SHA_A)), mergeReady(15, SHA_A)])],
      O.none()
    );
    expect(section.roundsToReady.closedPullRequests).toBe(0);
    expect(section.roundsToReady.openPullRequests).toBe(0);
    expect(section.roundsToReady.pullRequests).toEqual([]);
    expect(section.ledgerQuality.pullRequestsWithoutFlip).toBe(1);
  });

  it("takes nearest-rank percentiles over the closed pull requests only", () => {
    const pullRequest = (prNumber: number, rounds: number, closed: boolean): ReadonlyArray<ReviewLaneRow> => [
      ReviewLaneFlipRow.make({ ...base(), prNumber, headSha: SHA_A, at: at(0) }),
      ...A.map(A.range(1, rounds), (round) =>
        ReviewLaneReviewRow.make({
          ...base(),
          prNumber,
          reviewId: prNumber * 100 + round,
          reviewer: BEEP,
          commitSha: O.some(`${Str.padStart(40, "0")(`${prNumber * 100 + round}`)}`),
          state: "COMMENTED",
          submittedAt: at(round),
        })
      ),
      ...(closed ? [ReviewLaneMergeReadyRow.make({ ...base(), prNumber, headSha: SHA_B, at: at(30) })] : []),
    ];
    const rows = A.flatten([
      pullRequest(1, 1, true),
      pullRequest(2, 1, true),
      pullRequest(3, 2, true),
      pullRequest(4, 5, true),
      pullRequest(5, 9, false),
    ]);
    const { roundsToReady: rounds } = buildYeetEconomicsReviewLane([ledger(rows)], O.none());
    expect(rounds.closedPullRequests).toBe(4);
    expect(rounds.openPullRequests).toBe(1);
    assertSome(rounds.p50Rounds, 1);
    assertSome(rounds.p95Rounds, 5);
    expect(rounds.roundsMix).toEqual([
      { key: "1", count: 2 },
      { key: "2", count: 1 },
      { key: "5", count: 1 },
    ]);
  });

  it("narrows to the pull requests with a row recorded under the branch", () => {
    const other = ReviewLaneFlipRow.make({ ...base(OTHER_BRANCH), prNumber: PR + 1, headSha: SHA_B, at: at(1) });
    const all = buildYeetEconomicsReviewLane([ledger([...twoRounds, other])], O.none());
    expect(all.roundsToReady.closedPullRequests + all.roundsToReady.openPullRequests).toBe(2);
    const narrowed = buildYeetEconomicsReviewLane([ledger([...twoRounds, other])], O.some(BRANCH));
    expect(A.map(narrowed.roundsToReady.pullRequests, (pullRequest) => pullRequest.prNumber)).toEqual([PR]);
    const otherOnly = buildYeetEconomicsReviewLane([ledger([...twoRounds, other])], O.some(OTHER_BRANCH));
    expect(A.map(otherOnly.roundsToReady.pullRequests, (pullRequest) => pullRequest.prNumber)).toEqual([PR + 1]);
  });

  it("counts unreadable and malformed ledgers without reading rows from an unreadable one", () => {
    const unreadable = ReviewLaneLedger.make({
      ledgerPath: "/other/.beep/yeet/review-lane.ndjson",
      rows: twoRounds,
      malformedRows: 3,
      unreadable: true,
    });
    const section = buildYeetEconomicsReviewLane([ledger([], 2), unreadable], O.none());
    expect(section.ledgerQuality).toMatchObject({
      ledgersRead: 1,
      unreadableLedgers: 1,
      rows: 0,
      malformedRows: 2,
    });
    expect(section.roundsToReady.pullRequests).toEqual([]);
  });
});

describe("review lane review window", () => {
  it("opens the window at the earliest flip and places a head by its observation when it carries no push time", () => {
    const observedOnly = ReviewLaneHeadRow.make({ ...base(), headSha: SHA_B, pushedAt: O.none(), observedAt: at(11) });
    const rows = [
      flip(9, SHA_B),
      flip(5),
      review(2, 6, O.some(SHA_A)),
      observedOnly,
      head(10, SHA_C),
      mergeReady(15, SHA_B),
    ];
    const section = buildYeetEconomicsReviewLane([ledger(rows)], O.none());
    const pullRequest = A.getUnsafe(section.roundsToReady.pullRequests, 0);
    expect(pullRequest.flipAt).toBe(at(5));
    expect(pullRequest.heads).toBe(2);
    expect(pullRequest.rounds).toBe(1);
  });
});

describe("review lane reviewer precision", () => {
  it("is fixed over fixed, rejected and immaterial, with intentional and unknown beside it", () => {
    const rows = [
      disposition("PRRT_1", "fixed"),
      disposition("PRRT_2", "fixed"),
      disposition("PRRT_3", "fixed"),
      disposition("PRRT_4", "rejected"),
      disposition("PRRT_5", "immaterial"),
      disposition("PRRT_6", "intentional"),
      disposition("PRRT_7", "intentional"),
      disposition("PRRT_8", "unknown"),
      disposition("PRRT_9", "rejected", O.some(HUMAN)),
      disposition("PRRT_10", "fixed", O.some(GREPTILE)),
      disposition("PRRT_11", "fixed", O.some(GREPTILE)),
      disposition("PRRT_12", "immaterial", O.some(GREPTILE)),
    ];
    const section = buildYeetEconomicsReviewLane([ledger(rows)], O.none());
    expect(section.precisionMethod).toBe(YEET_ECONOMICS_PRECISION_METHOD);
    expect(A.map(section.precision, (row) => row.reviewer)).toEqual(YeetReviewerKind.literals);
    expect(
      A.map(section.precision, (row) => [
        row.reviewer,
        row.fixed,
        row.rejected,
        row.intentional,
        row.immaterial,
        row.unknown,
      ])
    ).toEqual([
      ["beep-reviewer", 3, 1, 2, 1, 1],
      ["greptile", 2, 0, 0, 1, 0],
      ["coderabbit", 0, 0, 0, 0, 0],
      ["human", 0, 1, 0, 0, 0],
      ["bot", 0, 0, 0, 0, 0],
    ]);
    const pct = (reviewer: YeetReviewerKind) =>
      O.flatMap(
        A.findFirst(section.precision, (row) => row.reviewer === reviewer),
        (row) => row.precisionPct
      );
    assertSome(pct("beep-reviewer"), 60);
    assertSome(pct("greptile"), 66.67);
    assertNone(pct("coderabbit"));
    assertSome(pct("human"), 0);
    assertNone(pct("bot"));
  });

  // Must-fail fixture (ruling 81): an undeclared disposition is `unknown`
  // and stays out of both sides of the ratio; only a later declaration on
  // the same thread moves it.
  it("keeps an undeclared disposition unknown and lets only a later declaration replace it", () => {
    const undeclared = [disposition("PRRT_1", "unknown"), disposition("PRRT_2", "rejected")];
    assertSome(
      precisionRow(undeclared, "beep-reviewer"),
      EconomicsReviewLanePrecisionRow.make({
        reviewer: "beep-reviewer",
        fixed: 0,
        rejected: 1,
        intentional: 0,
        immaterial: 0,
        unknown: 1,
        precisionPct: O.some(0),
      })
    );
    assertSome(
      precisionRow([...undeclared, disposition("PRRT_1", "fixed")], "beep-reviewer"),
      EconomicsReviewLanePrecisionRow.make({
        reviewer: "beep-reviewer",
        fixed: 1,
        rejected: 1,
        intentional: 0,
        immaterial: 0,
        unknown: 0,
        precisionPct: O.some(50),
      })
    );
  });

  // Must-fail fixture (review thread on #2310): across ledgers the latest
  // declaration wins by its recorded instant, never by ledger path order;
  // ledger order decides only a tie or an instant that does not parse.
  it("keeps the latest declaration per thread by its recorded instant across ledgers", () => {
    const declared = (value: YeetThreadDisposition, recordedAt: string): ReviewLaneRow =>
      ReviewLaneDispositionRow.make({
        ...base(),
        recordedAt,
        threadId: "PRRT_1",
        reviewer: O.some(BEEP),
        disposition: value,
      });
    const at30rejected = ledgerAt("/a", [declared("rejected", at(30))]);
    const at10fixed = ledgerAt("/b", [declared("fixed", at(10))]);
    const at30fixed = ledgerAt("/c", [declared("fixed", at(30))]);
    const unparseable = ledgerAt("/d", [declared("intentional", "never")]);
    const counts = (ledgers: ReadonlyArray<ReviewLaneLedger>) =>
      O.map(precisionRows(ledgers, "beep-reviewer"), (row) => [row.fixed, row.rejected, row.intentional]);
    assertSome(counts([at30rejected, at10fixed]), [0, 1, 0]);
    assertSome(counts([at10fixed, at30rejected]), [0, 1, 0]);
    assertSome(counts([at30rejected, at30fixed]), [1, 0, 0]);
    assertSome(counts([at30fixed, at30rejected]), [0, 1, 0]);
    assertSome(counts([at30rejected, unparseable]), [0, 0, 1]);
    assertSome(counts([unparseable, at30rejected]), [0, 1, 0]);
  });

  it("counts a disposition with no attributable reviewer and keeps it out of every row", () => {
    const section = buildYeetEconomicsReviewLane([ledger([disposition("PRRT_1", "fixed", O.none())])], O.none());
    expect(section.ledgerQuality.unattributedDispositions).toBe(1);
    expect(A.every(section.precision, (row) => row.fixed === 0)).toBe(true);
  });

  it("renders three lines naming the rounds, the precision method and the ledger", () => {
    const lines = renderYeetEconomicsReviewLane(buildYeetEconomicsReviewLane([ledger(twoRounds)], O.none()));
    expect(A.length(lines)).toBe(3);
    expect(A.getUnsafe(lines, 0)).toBe(
      "review lane (rounds to ready; its own denominators, never summed with the lane populations): 1 closed PR(s), 0 open; rounds p50 2, p95 2; mix: 2 round(s) 1; unassigned reviews 0"
    );
    expect(A.getUnsafe(lines, 1)).toContain(`precision (${YEET_ECONOMICS_PRECISION_METHOD}): beep-reviewer n/a (`);
    expect(A.getUnsafe(lines, 2)).toBe(
      "  ledger: 9 row(s) from 1 ledger(s), 0 unreadable, 0 malformed; 0 duplicate review row(s) deduplicated; 0 PR(s) without a flip; 0 unattributed disposition(s)"
    );
  });
});

describe("review lane reviewer classification", () => {
  it("names the three reviewers by login, other apps as bot, and everyone else as human", () => {
    expect(classifyYeetReviewer("beep-reviewer[bot]", O.some("Bot"))).toBe("beep-reviewer");
    expect(classifyYeetReviewer("beep-reviewer", O.none())).toBe("beep-reviewer");
    expect(classifyYeetReviewer("greptile-apps[bot]", O.none())).toBe("greptile");
    expect(classifyYeetReviewer("Greptile", O.some("User"))).toBe("greptile");
    expect(classifyYeetReviewer("coderabbitai", O.some("Bot"))).toBe("coderabbit");
    expect(classifyYeetReviewer("coderabbitai[bot]", O.none())).toBe("coderabbit");
    expect(classifyYeetReviewer("Copilot", O.some("Bot"))).toBe("bot");
    expect(classifyYeetReviewer("github-actions[bot]", O.none())).toBe("bot");
    expect(classifyYeetReviewer("octocat", O.some("User"))).toBe("human");
    expect(classifyYeetReviewer("octocat", O.none())).toBe("human");
  });

  it("keys every row but a disposition, which records again whenever a thread is answered again", () => {
    assertSome(reviewLaneRowKey(flip(5)), `flip:${PR}:${SHA_A}`);
    assertSome(reviewLaneRowKey(head(1, SHA_A)), `head:${PR}:${SHA_A}`);
    assertSome(reviewLaneRowKey(review(2, 6, O.some(SHA_A))), `review:${PR}:2`);
    assertSome(reviewLaneRowKey(mergeReady(15, SHA_B)), `merge-ready:${PR}:${SHA_B}`);
    assertNone(reviewLaneRowKey(disposition("PRRT_1", "fixed")));
  });
});

describe("review lane dispositions from a reply pass", () => {
  const openThread = (author: { readonly login: string; readonly __typename?: string } | null) =>
    ReplyLiveThread.make({
      comments: ReplyThreadCommentConnection.make({
        nodes: [
          ReplyThreadComment.make({ databaseId: 1, id: "PRRC_1", author }),
          ReplyThreadComment.make({ databaseId: 2, id: "PRRC_2", author: { login: "kriegcloud", __typename: "User" } }),
        ],
        pageInfo: { endCursor: null, hasNextPage: false },
      }),
      id: "PRRT_open",
      isOutdated: false,
      isResolved: false,
      line: 1,
      path: "src/a.ts",
    });
  const drafts = (draft: ReplyDraft) =>
    ReplyDrafts.make({ schemaVersion: "yeet-reply-drafts/v1", prNumber: PR, drafts: [draft] });

  it("attributes the thread to its opening comment's author", () => {
    const actions = planReplyActions(drafts(ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed." })), [
      openThread({ login: "greptile-apps[bot]", __typename: "Bot" }),
    ]);
    const action = A.getUnsafe(actions, 0);
    expect(action._tag).toBe("post");
    if (action._tag === "post") {
      assertSome(action.reviewer, GREPTILE);
    }
    const unattributed = A.getUnsafe(
      planReplyActions(drafts(ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed." })), [openThread(null)]),
      0
    );
    if (unattributed._tag === "post") {
      assertNone(unattributed.reviewer);
    }
  });

  // Must-fail fixture (ruling 81): a body that says "Fixed" declares nothing.
  it("records unknown for an undeclared draft, whatever its body says, and the declaration otherwise", () => {
    const undeclared = ReplyDraft.make({ threadId: O.some("PRRT_open"), body: "Fixed in 0123456, thanks." });
    const declared = ReplyDraft.make({
      threadId: O.some("PRRT_a"),
      body: "Not a bug.",
      disposition: O.some("rejected"),
    });
    const rows = replyDispositionRows(
      ReplyPassFacts.make({
        branch: BRANCH,
        prNumber: PR,
        recordedAt: RECORDED_AT,
        actions: [
          ReplyPostAction.make({ draft: undeclared, threadId: "PRRT_open", reviewer: O.some(GREPTILE) }),
          ReplyPostAction.make({ draft: declared, threadId: "PRRT_a", reviewer: O.some(BEEP) }),
          ReplyPostAction.make({ draft: declared, threadId: "PRRT_failed", reviewer: O.some(BEEP) }),
        ],
        outcomes: [
          ReplyDraftOutcome.make({ threadId: O.some("PRRT_open"), status: "resolved", detail: "done" }),
          ReplyDraftOutcome.make({
            threadId: O.some("PRRT_a"),
            status: "posted",
            detail: "done",
            disposition: "rejected",
          }),
          ReplyDraftOutcome.make({
            threadId: O.some("PRRT_failed"),
            status: "failed",
            detail: "denied",
            disposition: "rejected",
          }),
        ],
      })
    );
    expect(A.map(rows, (row) => [row.threadId, row.disposition])).toEqual([
      ["PRRT_open", "unknown"],
      ["PRRT_a", "rejected"],
    ]);
    assertSome(A.getUnsafe(rows, 0).reviewer, GREPTILE);
    assertSome(A.getUnsafe(rows, 1).reviewer, BEEP);
  });

  it("decodes a report written before dispositions existed as unknown, and refuses unknown as a declaration", () => {
    assertSome(
      O.map(
        S.decodeOption(ReplyDraftOutcome)({ threadId: "PRRT_1", status: "resolved", detail: "done" }),
        (outcome) => outcome.disposition
      ),
      "unknown"
    );
    assertNone(S.decodeUnknownOption(YeetReviewDisposition)("unknown"));
    assertSome(S.decodeOption(YeetReviewDisposition)("immaterial"), "immaterial");
    assertNone(S.decodeUnknownOption(ReplyDraft)({ threadId: "PRRT_1", body: "x", disposition: "unknown" }));
    assertSome(
      O.map(S.decodeOption(ReplyDraft)({ threadId: "PRRT_1", body: "x" }), (draft) => draft.disposition),
      O.none()
    );
  });
});

const Platform = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer, NodeCrypto.layer);

it.layer(Layer.mergeAll(Platform, TestConsole.layer), { timeout: "30 seconds" })("review lane ledger", (layerIt) => {
  const tempRoot = (prefix: string) => FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix }));

  layerIt.effect(
    "names the owning clone's ledger when it is unreadable, and the checkout's own path only when unresolvable",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const base = yield* tempRoot("review-lane-clone-");
        // A linked worktree the way `git worktree add` writes it.
        const clone = path.join(base, "repo");
        const lane = path.join(base, "repo-worktrees", "lane");
        const gitDir = path.join(clone, ".git", "worktrees", "lane");
        yield* fs.makeDirectory(gitDir, { recursive: true });
        yield* fs.makeDirectory(lane, { recursive: true });
        yield* fs.writeFileString(path.join(gitDir, "commondir"), "../..\n");
        yield* fs.writeFileString(path.join(gitDir, "gitdir"), `${path.join(lane, ".git")}\n`);
        yield* fs.writeFileString(path.join(lane, ".git"), `gitdir: ${gitDir}\n`);
        const cloneLedger = path.join(clone, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME);
        yield* fs.makeDirectory(cloneLedger, { recursive: true });
        const fromLane = yield* readYeetReviewLaneLedger(lane);
        expect(fromLane).toMatchObject({ ledgerPath: cloneLedger, unreadable: true, rows: [] });
        // A `.git` file without a gitdir line cannot be resolved: the checkout's own path stands in.
        const unresolvable = path.join(base, "not-a-checkout");
        yield* fs.makeDirectory(unresolvable, { recursive: true });
        yield* fs.writeFileString(path.join(unresolvable, ".git"), "no gitdir line\n");
        const fallback = yield* readYeetReviewLaneLedger(unresolvable);
        expect(fallback).toMatchObject({
          ledgerPath: path.join(unresolvable, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME),
          unreadable: true,
        });
      })
  );

  layerIt.effect("records nothing for an empty batch and never creates the ledger", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* tempRoot("review-lane-empty-");
      expect(yield* recordYeetReviewLaneRows(root, [])).toBe(0);
      const loaded = yield* readYeetReviewLaneLedger(root);
      expect(loaded.rows).toEqual([]);
      expect(yield* fs.exists(loaded.ledgerPath)).toBe(false);
    })
  );

  layerIt.effect("appends rows, skips the identities it already holds, and keeps every disposition", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot("review-lane-append-");
      const service = yield* YeetReviewLaneLedger.make(root);
      expect(yield* service.appendNew([flip(5), review(2, 6, O.some(SHA_A))])).toBe(2);
      expect(
        yield* service.appendNew([
          review(2, 6, O.some(SHA_A)),
          review(3, 7, O.some(SHA_A), GREPTILE),
          review(3, 7, O.some(SHA_A), GREPTILE),
          disposition("PRRT_1", "fixed"),
        ])
      ).toBe(2);
      expect(yield* service.appendNew([disposition("PRRT_1", "rejected")])).toBe(1);
      expect(yield* service.appendNew([])).toBe(0);
      const loaded = yield* service.load;
      expect(loaded.ledgerPath).toBe(`${root}/.beep/yeet/${YEET_REVIEW_LANE_LEDGER_FILE_NAME}`);
      expect(loaded.malformedRows).toBe(0);
      expect(loaded.unreadable).toBe(false);
      expect(A.map(loaded.rows, (row) => row._tag)).toEqual(["flip", "review", "review", "disposition", "disposition"]);
      // The fold reads the file as recorded, and the replayed review is still one.
      const section = buildYeetEconomicsReviewLane([loaded], O.none());
      expect(section.roundsToReady.pullRequests).toMatchObject([{ rounds: 1, reviews: 2 }]);
    })
  );

  layerIt.effect("tolerates a torn tail, counts malformed rows, and heals the tail on the next append", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* tempRoot("review-lane-torn-");
      const ledgerPath = path.join(root, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME);
      yield* fs.makeDirectory(path.dirname(ledgerPath), { recursive: true });
      const good = yield* ReviewLaneRowJson.encode(flip(5));
      yield* fs.writeFileString(
        ledgerPath,
        `${good}\nnot json\n{"_tag":"review","schemaVersion":"yeet-review-lane/v0"}\n{"_tag":"head"`
      );
      const before = yield* readYeetReviewLaneLedger(root);
      expect(before.malformedRows).toBe(2);
      expect(A.map(before.rows, (row) => row._tag)).toEqual(["flip"]);
      yield* recordYeetReviewLaneRows(root, [mergeReady(15, SHA_A)]);
      const after = yield* readYeetReviewLaneLedger(root);
      expect(A.map(after.rows, (row) => row._tag)).toEqual(["flip", "merge-ready"]);
      expect(after.malformedRows).toBe(3);
    })
  );

  layerIt.effect(
    "reads a missing ledger as empty and an unreadable one as unreadable, and never fails a recorder",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* tempRoot("review-lane-missing-");
        const missing = yield* readYeetReviewLaneLedger(root);
        expect(missing).toMatchObject({ rows: [], malformedRows: 0, unreadable: false });
        yield* fs.makeDirectory(path.join(root, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME), {
          recursive: true,
        });
        const unreadable = yield* readYeetReviewLaneLedger(root);
        expect(unreadable.unreadable).toBe(true);
        expect(unreadable.rows).toEqual([]);
        expect(yield* recordYeetReviewLaneRows(root, [flip(5)])).toBe(0);
        const warned = A.join(A.map(yield* TestConsole.errorLines, String), "\n");
        expect(warned).toContain("review lane ledger not updated");
      })
  );

  layerIt.effect("keeps a linked worktree's ledger in its owning clone", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* tempRoot("review-lane-clone-");
      const clone = path.join(baseDir, "repo");
      const lane = path.join(baseDir, "repo-worktrees", "lane-a");
      const gitDir = path.join(clone, ".git", "worktrees", "lane-a");
      yield* fs.makeDirectory(gitDir, { recursive: true });
      yield* fs.makeDirectory(lane, { recursive: true });
      yield* fs.writeFileString(path.join(gitDir, "commondir"), "../..\n");
      yield* fs.writeFileString(path.join(lane, ".git"), `gitdir: ${gitDir}\n`);
      const location = yield* resolveReviewLaneLedgerLocation(lane);
      expect(location.ledgerRoot).toBe(clone);
      expect(location.ledgerPath).toBe(path.join(clone, ".beep", "yeet", YEET_REVIEW_LANE_LEDGER_FILE_NAME));
      yield* recordYeetReviewLaneRows(lane, [flip(5)]);
      yield* recordYeetReviewLaneRows(clone, [mergeReady(15, SHA_A)]);
      expect(A.map((yield* readYeetReviewLaneLedger(lane)).rows, (row) => row._tag)).toEqual(["flip", "merge-ready"]);
      expect((yield* readYeetReviewLaneLedger(clone)).ledgerPath).toBe(location.ledgerPath);
    })
  );
});

const Sources = Layer.provideMerge(Layer.mergeAll(YeetEconomicsSource.layer, YeetReviewLaneSource.layer), Platform);

it.layer(Layer.mergeAll(Sources, TestConsole.layer), { timeout: "30 seconds" })(
  "yeet economics review lane",
  (layerIt) => {
    layerIt.effect("reads each sibling checkout's ledger once in a fleet scope, sorted by path", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const projects = yield* fs.makeTempDirectoryScoped({ prefix: "review-lane-fleet-" });
        const clone = path.join(projects, "beep-effect7");
        const sibling = path.join(projects, "beep-effect8");
        yield* fs.makeDirectory(clone, { recursive: true });
        yield* fs.makeDirectory(sibling, { recursive: true });
        yield* recordYeetReviewLaneRows(clone, [flip(5)]);
        yield* recordYeetReviewLaneRows(sibling, [flip(5), review(2, 6, O.some(SHA_A))]);
        const source = yield* YeetReviewLaneSource;
        const fleet = yield* source.read(
          EconomicsScopeRequest.make({ repoRoot: sibling, branch: O.none(), fleet: true })
        );
        expect(A.map(fleet, (ledger) => [path.relative(projects, ledger.ledgerPath), A.length(ledger.rows)])).toEqual([
          [`beep-effect7/.beep/yeet/${YEET_REVIEW_LANE_LEDGER_FILE_NAME}`, 1],
          [`beep-effect8/.beep/yeet/${YEET_REVIEW_LANE_LEDGER_FILE_NAME}`, 2],
        ]);
        const alone = yield* source.read(
          EconomicsScopeRequest.make({ repoRoot: sibling, branch: O.none(), fleet: false })
        );
        expect(A.length(alone)).toBe(1);
      })
    );

    layerIt.effect("prints rounds to ready and reviewer precision from the checkout's ledger", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "review-lane-economics-" });
        yield* recordYeetReviewLaneRows(root, [
          ...twoRounds,
          disposition("PRRT_1", "fixed"),
          disposition("PRRT_2", "immaterial"),
        ]);
        yield* runYeetEconomics(
          YeetEconomicsOptions.make({ json: true, branch: O.none(), fleet: false }),
          Effect.succeed(root)
        );
        yield* runYeetEconomics(
          YeetEconomicsOptions.make({ json: false, branch: O.some(BRANCH), fleet: false }),
          Effect.succeed(root)
        );
        yield* runYeetEconomics(
          YeetEconomicsOptions.make({ json: false, branch: O.some(OTHER_BRANCH), fleet: false }),
          Effect.succeed(root)
        );
        const lines = yield* TestConsole.logLines;
        const report = yield* YeetEconomicsReportJson.decode(`${A.getUnsafe(lines, 0)}`);
        expect(report.schemaVersion).toBe("yeet-economics/v2");
        assertSome(report.reviewLane.roundsToReady.p50Rounds, 2);
        assertSome(report.reviewLane.roundsToReady.p95Rounds, 2);
        assertSome(
          A.findFirst(report.reviewLane.precision, (row) => row.reviewer === "beep-reviewer"),
          EconomicsReviewLanePrecisionRow.make({
            reviewer: "beep-reviewer",
            fixed: 1,
            rejected: 0,
            intentional: 0,
            immaterial: 1,
            unknown: 0,
            precisionPct: O.some(50),
          })
        );
        // The section is beside the lane populations, with its own denominators.
        expect(report.wrapperLanes.executions).toBe(0);
        expect(report.innerLanes.executions).toBe(0);
        const text = `${A.getUnsafe(lines, 1)}`;
        expect(text).toContain("rounds p50 2, p95 2");
        expect(text).toContain("beep-reviewer 50% (fixed 1, rejected 0, immaterial 1; intentional 0, unknown 0)");
        expect(`${A.getUnsafe(lines, 2)}`).toContain("0 closed PR(s), 0 open; rounds p50 n/a, p95 n/a");
        const request = EconomicsScopeRequest.make({ repoRoot: root, branch: O.none(), fleet: false });
        const ledgers = yield* (yield* YeetReviewLaneSource).read(request);
        expect(A.length(ledgers)).toBe(1);
        expect(A.getUnsafe(ledgers, 0).rows.length).toBe(11);
      })
    );
  }
);
