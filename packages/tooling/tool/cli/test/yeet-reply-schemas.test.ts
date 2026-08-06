import {
  ReplyDraft,
  ReplyDraftOutcome,
  ReplyDrafts,
  ReplyDraftsJson,
  ReplyOutcomeStatus,
  ReplyReport,
  ReplyReportJson,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";

const drafts = ReplyDrafts.make({
  schemaVersion: "yeet-reply-drafts/v1",
  prNumber: 558,
  drafts: [
    ReplyDraft.make({
      threadId: O.some("PRRT_kwDOKq9lNc5b8Xy1"),
      body: "Fixed in 0123456: the verdict writer now encodes through the schema codec.",
    }),
    ReplyDraft.make({
      commentId: O.some(2_284_119_001),
      body: "Not a defect: the sweep reports the skip rather than force-deleting.",
      resolve: false,
    }),
  ],
});

const report = ReplyReport.make({
  schemaVersion: "yeet-reply-report/v1",
  prNumber: 558,
  createdAt: "2026-08-04T00:00:00.000Z",
  outcomes: [
    ReplyDraftOutcome.make({
      threadId: O.some("PRRT_kwDOKq9lNc5b8Xy1"),
      status: "resolved",
      detail: "reply posted and thread resolved",
    }),
    ReplyDraftOutcome.make({
      commentId: O.some(2_284_119_001),
      status: "posted",
      detail: "reply posted; draft opted out of resolving",
    }),
    ReplyDraftOutcome.make({
      threadId: O.some("PRRT_kwDOKq9lNc5b8Xy2"),
      status: "stale",
      detail: "thread was already resolved upstream",
    }),
    ReplyDraftOutcome.make({
      threadId: O.some("PRRT_kwDOKq9lNc5b8Xy3"),
      status: "failed",
      detail: "resolveReviewThread returned RESOURCE_NOT_ACCESSIBLE",
    }),
  ],
});

describe("reply outcome statuses", () => {
  it("pins the reply outcome domain", () => {
    expect(ReplyOutcomeStatus.Options).toEqual(["posted", "resolved", "stale", "failed"]);
  });
});

describe("ReplyDrafts", () => {
  it.effect("round-trips through its JSON codec", () =>
    Effect.gen(function* () {
      const text = yield* ReplyDraftsJson.encode(drafts);
      const decoded = yield* ReplyDraftsJson.decode(text);
      expect(decoded).toEqual(drafts);
    })
  );

  it("defaults resolve to true when the draft omits it", () => {
    expect(drafts.drafts[0]?.resolve).toBe(true);
    expect(drafts.drafts[1]?.resolve).toBe(false);
  });

  it.effect("defaults resolve to true when the drafts file omits the key", () =>
    Effect.gen(function* () {
      const decoded = yield* ReplyDraftsJson.decode(
        '{"schemaVersion":"yeet-reply-drafts/v1","prNumber":558,"drafts":[{"threadId":"PRRT_kwDOKq9lNc5b8Xy1","body":"ack"}]}'
      );
      expect(decoded.drafts[0]?.resolve).toBe(true);
      expect(decoded.drafts[0]?.commentId).toEqual(O.none());
    })
  );

  it.effect("accepts a draft targeted by numeric REST comment id alone", () =>
    Effect.gen(function* () {
      const decoded = yield* ReplyDraftsJson.decode(
        '{"schemaVersion":"yeet-reply-drafts/v1","prNumber":558,"drafts":[{"commentId":2284119001,"body":"ack"}]}'
      );
      expect(decoded.drafts[0]?.threadId).toEqual(O.none());
      expect(decoded.drafts[0]?.commentId).toEqual(O.some(2_284_119_001));
    })
  );

  it.effect("rejects a draft that names neither a thread nor a comment", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        ReplyDraftsJson.decode('{"schemaVersion":"yeet-reply-drafts/v1","prNumber":558,"drafts":[{"body":"ack"}]}')
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a GraphQL comment id pasted into the thread id field", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        ReplyDraftsJson.decode(
          '{"schemaVersion":"yeet-reply-drafts/v1","prNumber":558,"drafts":[{"threadId":"PRRC_kwDOKq9lNc5b8Xy1","body":"ack"}]}'
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects an empty reply body", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        ReplyDraftsJson.decode(
          '{"schemaVersion":"yeet-reply-drafts/v1","prNumber":558,"drafts":[{"threadId":"PRRT_kwDOKq9lNc5b8Xy1","body":""}]}'
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("ReplyReport", () => {
  it.effect("round-trips every outcome status through its JSON codec", () =>
    Effect.gen(function* () {
      const text = yield* ReplyReportJson.encode(report);
      const decoded = yield* ReplyReportJson.decode(text);
      expect(decoded).toEqual(report);
    })
  );

  it.effect("omits absent target keys instead of writing Option runtime objects", () =>
    Effect.gen(function* () {
      const text = yield* ReplyReportJson.encode(report);
      expect(text).not.toContain('"_id":"Option"');
      expect(text).toContain('{"commentId":2284119001,"status":"posted"');
    })
  );
});
