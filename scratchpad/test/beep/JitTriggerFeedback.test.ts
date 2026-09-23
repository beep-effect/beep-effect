import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  JITTriggerFeedbackReceipt,
  JitDisableFeedbackReceipt,
  JitFalsePositiveFeedbackReceipt,
  JitMissedOrLateFeedbackReceipt,
  JitSnoozeFeedbackReceipt,
  JitTriggerFeedbackAction,
  JitUsefulFeedbackReceipt,
  decodeJitTriggerFeedbackReceipt,
} from "../../beep/JitTriggerFeedback.ts";

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failsWith = <A, E>(effect: Effect.Effect<A, E>): boolean => Effect.runSyncExit(effect)._tag === "Failure";

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);

const base = {
  schemaVersion: "jit_trigger_feedback.v1",
  uid: "  user-1  ",
  feedbackId: hash,
  eventId: otherHash,
  triggerMemoryId: "trigger-1",
  accountGeneration: 2,
  expectedTriggerRevision: 3,
  recordedAt: "2026-09-22T10:00:00Z",
  requestHash: hash,
};

describe("JitTriggerFeedback", () => {
  it("derives arbitraries for every exported schema", () => {
    for (const schema of [
      JitTriggerFeedbackAction,
      JitUsefulFeedbackReceipt,
      JitFalsePositiveFeedbackReceipt,
      JitSnoozeFeedbackReceipt,
      JitDisableFeedbackReceipt,
      JitMissedOrLateFeedbackReceipt,
      JITTriggerFeedbackReceipt,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("decodes present values and trims identifiers", () => {
    const decoded = decode(JitUsefulFeedbackReceipt, { ...base, action: "useful", appliedTriggerRevision: 4 });
    assert.strictEqual(decoded.action, "useful");
    assert.strictEqual(decoded.uid, "user-1");
    assert.strictEqual(decoded.expectedTriggerRevision, 3);
    assert.strictEqual(O.getOrNull(decoded.appliedTriggerRevision), 4);
    assert.strictEqual(DateTime.formatIso(decoded.recordedAt), "2026-09-22T10:00:00.000Z");
  });

  it("decodes a missing or null applied revision to None and encodes None as null", () => {
    const missing = decode(JitUsefulFeedbackReceipt, { ...base, action: "useful" });
    const nulled = decode(JitUsefulFeedbackReceipt, { ...base, action: "useful", appliedTriggerRevision: null });
    assert.strictEqual(O.isNone(missing.appliedTriggerRevision), true);
    assert.strictEqual(O.isNone(nulled.appliedTriggerRevision), true);
    const encoded = Effect.runSync(S.encodeEffect(JitUsefulFeedbackReceipt)(missing));
    assert.strictEqual(encoded.appliedTriggerRevision, null);
    assert.strictEqual(encoded.recordedAt, "2026-09-22T10:00:00.000Z");
  });

  it("rejects out-of-bound identifiers and revisions", () => {
    assert.strictEqual(decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", uid: "a/b" }), true);
    assert.strictEqual(decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", feedbackId: "nope" }), true);
    assert.strictEqual(
      decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", expectedTriggerRevision: 0 }),
      true,
    );
    assert.strictEqual(
      decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", appliedTriggerRevision: 0 }),
      true,
    );
    assert.strictEqual(
      decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", recordedAt: "2026-09-22T10:00:00" }),
      true,
    );
    assert.strictEqual(
      decodeFails(JitUsefulFeedbackReceipt, { ...base, action: "useful", schemaVersion: "v0" }),
      true,
    );
  });

  it("decodes every tagged-union member on action", () => {
    const useful = decode(JITTriggerFeedbackReceipt, { ...base, action: "useful" });
    const falsePositive = decode(JITTriggerFeedbackReceipt, { ...base, action: "false_positive" });
    const snooze = decode(JITTriggerFeedbackReceipt, {
      ...base,
      action: "snooze",
      snoozedUntil: "2026-09-22T11:00:00Z",
    });
    const disable = decode(JITTriggerFeedbackReceipt, { ...base, action: "disable" });
    const missed = decode(JITTriggerFeedbackReceipt, { ...base, action: "missed_or_late" });
    assert.strictEqual(useful.action, "useful");
    assert.strictEqual(falsePositive.action, "false_positive");
    assert.strictEqual(snooze.action, "snooze");
    assert.strictEqual(disable.action, "disable");
    assert.strictEqual(missed.action, "missed_or_late");
    if (snooze.action === "snooze") {
      assert.strictEqual(DateTime.formatIso(snooze.snoozedUntil), "2026-09-22T11:00:00.000Z");
    }
    assert.strictEqual(decodeFails(JITTriggerFeedbackReceipt, { ...base, action: "later" }), true);
  });

  it("requires snoozedUntil after recordedAt on the snooze arm", () => {
    assert.strictEqual(
      decodeFails(JITTriggerFeedbackReceipt, { ...base, action: "snooze", snoozedUntil: "2026-09-22T10:00:00Z" }),
      true,
    );
    assert.strictEqual(
      decodeFails(JITTriggerFeedbackReceipt, { ...base, action: "snooze", snoozedUntil: "2026-09-22T09:00:00Z" }),
      true,
    );
    assert.strictEqual(decodeFails(JITTriggerFeedbackReceipt, { ...base, action: "snooze" }), true);
  });

  it("decodeJitTriggerFeedbackReceipt rejects excess properties", () => {
    const decoded = Effect.runSync(decodeJitTriggerFeedbackReceipt({ ...base, action: "disable" }));
    assert.strictEqual(decoded.action, "disable");
    assert.strictEqual(
      failsWith(decodeJitTriggerFeedbackReceipt({ ...base, action: "useful", snoozedUntil: "2026-09-22T11:00:00Z" })),
      true,
    );
    assert.strictEqual(failsWith(decodeJitTriggerFeedbackReceipt({ ...base, action: "useful", extra: 1 })), true);
  });

  it("make applies the schema version default", () => {
    const made = JitDisableFeedbackReceipt.make({
      uid: "user-1",
      feedbackId: hash,
      eventId: otherHash,
      triggerMemoryId: "trigger-1",
      accountGeneration: 0,
      expectedTriggerRevision: 1,
      recordedAt: DateTime.makeUnsafe("2026-09-22T10:00:00Z"),
      requestHash: hash,
    });
    assert.strictEqual(made.schemaVersion, "jit_trigger_feedback.v1");
    assert.strictEqual(made.action, "disable");
    assert.strictEqual(O.isNone(made.appliedTriggerRevision), true);
  });
});
