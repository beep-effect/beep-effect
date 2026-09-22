import {
  deriveYeetReviewThreadState,
  summarizeYeetReviewThreadStates,
  YeetReviewThreadNewestComment,
  YeetReviewThreadStateInput,
  yeetReviewCommentAuthorKind,
  yeetReviewThreadStateOutstanding,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";

const AUTHOR = "kriegcloud";

const comment = (authorLogin: string, authorKind: "user" | "bot", createdAt?: string) =>
  O.some(
    YeetReviewThreadNewestComment.make({
      authorLogin,
      authorKind,
      createdAt: createdAt === undefined ? O.none() : O.some(createdAt),
    })
  );

const input = (overrides: Partial<Parameters<typeof YeetReviewThreadStateInput.make>[0]>) =>
  YeetReviewThreadStateInput.make({
    threadId: "PRRT_1",
    isResolved: true,
    isOutdated: false,
    path: O.some("packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts"),
    line: O.some(412),
    pullRequestAuthor: O.some(AUTHOR),
    resolvedBy: O.some(AUTHOR),
    ...overrides,
  });

describe("review thread state derivation", () => {
  it("classifies an open thread as unresolved", () => {
    const state = deriveYeetReviewThreadState(input({ isResolved: false, newestComment: comment("reviewer", "user") }));

    expect(state.state).toBe("unresolved");
    expect(yeetReviewThreadStateOutstanding(state)).toBe(true);
  });

  it("carries the thread's location onto every state", () => {
    // Follow-ups are printed as an operator worklist, so a state that dropped
    // path/line would name a thread the operator cannot find.
    const state = deriveYeetReviewThreadState(input({ isOutdated: true, newestComment: comment("reviewer", "user") }));

    expect(state.threadId).toBe("PRRT_1");
    expect(state.isOutdated).toBe(true);
    expect(O.getOrNull(state.path)).toBe("packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts");
    expect(O.getOrNull(state.line)).toBe(412);
  });

  it("answers a resolved thread whose pull request author is unknown", () => {
    // Doctrine: unknown must not masquerade as a named blocker. A status run
    // that could not read the PR author is missing information, not evidence
    // of an open objection.
    const state = deriveYeetReviewThreadState(
      input({ pullRequestAuthor: O.none(), newestComment: comment("reviewer", "user") })
    );

    expect(state.state).toBe("resolved-answered");
    expect(yeetReviewThreadStateOutstanding(state)).toBe(false);
  });

  it("answers a resolved thread whose resolver is unknown", () => {
    const state = deriveYeetReviewThreadState(
      input({ resolvedBy: O.none(), newestComment: comment("reviewer", "user") })
    );

    expect(state.state).toBe("resolved-answered");
  });

  it("answers a thread a reviewer resolved themselves", () => {
    // The reviewer closed their own thread after speaking last. Nothing is
    // owed: the person who could object already signed off by resolving.
    const state = deriveYeetReviewThreadState(
      input({ resolvedBy: O.some("reviewer"), newestComment: comment("reviewer", "user") })
    );

    expect(state.state).toBe("resolved-answered");
    expect(yeetReviewThreadStateOutstanding(state)).toBe(false);
  });

  it("answers a thread the author resolved with no comments read", () => {
    const state = deriveYeetReviewThreadState(input({ newestComment: O.none() }));

    expect(state.state).toBe("resolved-answered");
  });

  it("answers a thread the author resolved after replying last", () => {
    const state = deriveYeetReviewThreadState(input({ newestComment: comment(AUTHOR, "user") }));

    expect(state.state).toBe("resolved-answered");
  });

  it("acknowledges a thread a review bot spoke on after the author resolved it", () => {
    // Review bots post a confirmation onto threads they never re-open, so the
    // bot's last word is a receipt. Reported, never gating, never replied to.
    const state = deriveYeetReviewThreadState(
      input({ newestComment: comment("coderabbitai", "bot", "2026-09-22T10:00:00Z") })
    );

    expect(state.state).toBe("resolved-acknowledged");
    expect(yeetReviewThreadStateOutstanding(state)).toBe(false);
    expect(state.state === "resolved-acknowledged" ? state.followUpAuthor : "").toBe("coderabbitai");
    expect(state.state === "resolved-acknowledged" ? O.getOrNull(state.followUpAt) : null).toBe("2026-09-22T10:00:00Z");
  });

  it("gates a thread a human reviewer spoke on after the author resolved it", () => {
    // The lived failure: the author resolves, the reviewer keeps typing, and
    // every unresolved-thread count reports the PR as clean.
    const state = deriveYeetReviewThreadState(
      input({ newestComment: comment("reviewer", "user", "2026-09-22T11:00:00Z") })
    );

    expect(state.state).toBe("resolved-follow-up");
    expect(yeetReviewThreadStateOutstanding(state)).toBe(true);
    expect(state.state === "resolved-follow-up" ? state.followUpAuthor : "").toBe("reviewer");
    expect(state.state === "resolved-follow-up" ? O.getOrNull(state.followUpAt) : null).toBe("2026-09-22T11:00:00Z");
  });

  it("keeps a follow-up without a timestamp", () => {
    const state = deriveYeetReviewThreadState(input({ newestComment: comment("reviewer", "user") }));

    expect(state.state).toBe("resolved-follow-up");
    expect(state.state === "resolved-follow-up" ? O.isNone(state.followUpAt) : false).toBe(true);
  });

  it("compares the bot resolver suffix against the author's plain login", () => {
    // GitHub reports `coderabbitai[bot]` as a resolver and `coderabbitai` as a
    // comment author. Only the author comparison matters, and the PR author is
    // always a User, so a bot-resolved thread simply is not author-resolved.
    const state = deriveYeetReviewThreadState(
      input({ resolvedBy: O.some("coderabbitai[bot]"), newestComment: comment("reviewer", "user") })
    );

    expect(state.state).toBe("resolved-answered");
  });
});

describe("review comment author kind", () => {
  it("reads Bot as a bot and everything else as a person", () => {
    expect(yeetReviewCommentAuthorKind(O.some("Bot"))).toBe("bot");
    expect(yeetReviewCommentAuthorKind(O.some("User"))).toBe("user");
    expect(yeetReviewCommentAuthorKind(O.some("Organization"))).toBe("user");
    // An absent typename means the query did not select it. Treating it as a
    // person is the conservative reading: at worst a thread keeps gating.
    expect(yeetReviewCommentAuthorKind(O.none())).toBe("user");
  });
});

describe("review thread state tallies", () => {
  it("counts every state and leaves nothing uncounted", () => {
    const counts = summarizeYeetReviewThreadStates([
      deriveYeetReviewThreadState(input({ threadId: "a", isResolved: false })),
      deriveYeetReviewThreadState(input({ threadId: "b", newestComment: comment("reviewer", "user") })),
      deriveYeetReviewThreadState(input({ threadId: "c", newestComment: comment("coderabbitai", "bot") })),
      deriveYeetReviewThreadState(input({ threadId: "d", newestComment: comment(AUTHOR, "user") })),
      deriveYeetReviewThreadState(input({ threadId: "e", newestComment: O.none() })),
    ]);

    expect(counts.unresolved).toBe(1);
    expect(counts.followUp).toBe(1);
    expect(counts.acknowledged).toBe(1);
    expect(counts.answered).toBe(2);
  });

  it("tallies an empty pull request at zero", () => {
    const counts = summarizeYeetReviewThreadStates([]);

    expect(counts.unresolved).toBe(0);
    expect(counts.followUp).toBe(0);
    expect(counts.acknowledged).toBe(0);
    expect(counts.answered).toBe(0);
  });
});
