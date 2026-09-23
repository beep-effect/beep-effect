import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  FeedbackContextHydrated,
  FeedbackContextPointer,
  FeedbackContextTurn,
  FeedbackContextTurnText,
  FeedbackEvent,
  FeedbackEventWire,
  FeedbackReport,
  FeedbackReportEntry,
  MemoryUseFeedback,
  MobileFeedbackReceipt,
  MobileFeedbackRequest,
  decodeMemoryUseFeedback,
  decodeMobileFeedbackRequest,
  trimFeedbackIdentifier,
  trimMemoryUseIdentifier,
  validateReasonSurface,
} from "../../beep/Feedback.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("Feedback", () => {
  it("decodes a ledger event with null and missing provenance", () => {
    const present = decode(FeedbackEventWire, {
      id: "e1",
      uid: "user-1",
      surface: "chat_text",
      target_kind: "chat_message",
      target_id: "m1",
      value: -1,
      created_at: "2020-01-02T03:04:05.000Z",
      reason: "bad_timing",
      comment: "long",
    });
    assert.strictEqual(O.getOrElse(present.reason, () => "other"), "bad_timing");
    const nulled = decode(FeedbackEventWire, {
      id: "e1",
      uid: "user-1",
      surface: "memory",
      target_kind: "memory",
      target_id: "mem-1",
      value: 0,
      created_at: "2020-01-02T03:04:05.000Z",
      reason: null,
      feedback_kind: null,
    });
    assert.strictEqual(O.isNone(nulled.reason), true);
    assert.strictEqual(O.isNone(nulled.feedbackKind), true);
    const missing = decode(FeedbackEventWire, {
      id: "e1",
      uid: "user-1",
      surface: "chat_voice",
      target_kind: "chat_message",
      target_id: "m1",
      value: 1,
      created_at: "2020-01-02T03:04:05.000Z",
    });
    assert.strictEqual(O.isNone(missing.comment), true);
    assert.strictEqual(O.isNone(missing.chatSessionId), true);
  });

  it("trims identifiers and checks reason families", () => {
    assert.strictEqual(Effect.runSync(trimFeedbackIdentifier("  f1  ")), "f1");
    assert.strictEqual(Effect.runSyncExit(trimFeedbackIdentifier("   "))._tag, "Failure");
    assert.strictEqual(Effect.runSyncExit(trimMemoryUseIdentifier(" "))._tag, "Failure");
    const decoded = Effect.runSync(
      decodeMobileFeedbackRequest({
        schema_version: "mobile_feedback.v1",
        feedback_id: "  f1  ",
        kind: "summary_helpfulness",
        target_kind: "conversation",
        target_id: "c1",
        value: 1,
      }),
    );
    assert.strictEqual(decoded.feedbackId, "f1");
    assert.strictEqual(O.isNone(decoded.reason), true);
    const wrongTarget = MobileFeedbackRequest.make({
      feedbackId: "f1",
      kind: "summary_helpfulness",
      targetKind: O.some<"recording">("recording"),
      targetId: "r1",
      value: -1,
    });
    assert.strictEqual(Effect.runSyncExit(validateReasonSurface(wrongTarget))._tag, "Failure");
    const wrongReason = MobileFeedbackRequest.make({
      feedbackId: "f1",
      kind: "summary_helpfulness",
      targetKind: O.some<"conversation">("conversation"),
      targetId: "c1",
      value: -1,
      reason: O.some<"recording_other">("recording_other"),
    });
    assert.strictEqual(Effect.runSyncExit(validateReasonSurface(wrongReason))._tag, "Failure");
    const ok = MobileFeedbackRequest.make({
      feedbackId: "f1",
      kind: "recording_quality",
      targetId: "r1",
      value: -1,
      reason: O.some<"recording_other">("recording_other"),
    });
    assert.strictEqual(Effect.runSync(validateReasonSurface(ok)).reason, ok.reason);
    const memory = Effect.runSync(
      decodeMemoryUseFeedback({
        schema_version: "memory_use_feedback.v1",
        uid: " user-1 ",
        feedback_id: "f1",
        target_memory_id: "mem-1",
        action: "useful",
        created_at: "2020-01-02T03:04:05.000Z",
      }),
    );
    assert.strictEqual(memory.uid, "user-1");
    assert.strictEqual(Effect.runSyncExit(decodeMemoryUseFeedback({
      schema_version: "memory_use_feedback.v1",
      uid: "user-1",
      feedback_id: "f1",
      target_memory_id: " ",
      action: "allow",
      created_at: "2020-01-02T03:04:05.000Z",
    }))._tag, "Failure");
  });

  it("constructs receipt, pointer, and report defaults", () => {
    const receipt = MobileFeedbackReceipt.make({ feedbackId: "f1", eventId: "e1", created: true });
    assert.strictEqual(receipt.persisted, true);
    const pointer = FeedbackContextPointer.make({
      eventId: "e1",
      uid: "user-1",
      targetKind: "chat_message",
      targetId: "m1",
    });
    assert.strictEqual(pointer.turns.length, 0);
    assert.strictEqual(pointer.truncatedAfter, false);
    const report = FeedbackReport.make({
      date: "2020-01-02",
      generatedAt: DateTime.makeUnsafe("2020-01-03T00:00:00.000Z"),
      totalNegative: 0,
    });
    assert.strictEqual(report.entries.length, 0);
    const hydrated = FeedbackContextHydrated.make({ eventId: "e1", targetKind: "memory", targetId: "m1" });
    assert.strictEqual(hydrated.unavailable.length, 0);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [
      FeedbackEvent,
      MobileFeedbackRequest,
      MobileFeedbackReceipt,
      MemoryUseFeedback,
      FeedbackContextTurn,
      FeedbackContextPointer,
      FeedbackReportEntry,
      FeedbackReport,
      FeedbackContextTurnText,
      FeedbackContextHydrated,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
