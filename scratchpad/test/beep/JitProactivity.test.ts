import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  JIT_AMBIGUOUS_NANO_TRIAGES_PER_DAY,
  JIT_CONTENT_FREE_ID_PATTERN,
  JIT_FULL_TURNS_PER_CANDIDATE,
  JIT_MAX_CALENDAR_EVENTS,
  JIT_PLANNED_NOTIFICATIONS_PER_TRIGGER_PER_DAY,
  JIT_POLICY_VALID_FOR_SECONDS,
  JIT_TOTAL_FULL_TURNS_PER_DAY,
  JIT_TOTAL_PROACTIVE_NOTIFICATIONS_PER_DAY,
  JITProactivityEventReceipt,
  JitAmbientNotificationReceipt,
  JitFullTurnReceipt,
  JitNanoTriageReceipt,
  JitPlannedNotificationReceipt,
  JitProactivityOperation,
  JitTriggerPairInvalid,
  decodeJitProactivityEventReceipt,
  isJitTriggerPaidAuthority,
  type JitTriggerAuthorityItem,
} from "../../beep/JitProactivity.ts";

const encodeJitAmbientNotificationReceipt = S.encodeEffect(JitAmbientNotificationReceipt);
const isJitTriggerPairInvalid = S.is(JitTriggerPairInvalid);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failure = <A, E>(effect: Effect.Effect<A, E>): E => effect.pipe(Effect.flip, Effect.runSync);

const hash = "0".repeat(63) + "1";
const parent = "f".repeat(64);

const base = {
  schemaVersion: "jit_proactivity_event.v1",
  uid: " user-1 ",
  eventId: hash,
  candidateId: hash,
  accountGeneration: 1,
  budgetDay: "2026-09-22",
  budgetTimezone: "America/Chicago",
  deviceId: hash,
  createdAt: "2026-09-22T10:00:00+00:00",
  requestHash: hash,
};

describe("JitProactivity", () => {
  it("exposes the budget constants and the content-free id pattern", () => {
    assert.strictEqual(JIT_PLANNED_NOTIFICATIONS_PER_TRIGGER_PER_DAY, 1);
    assert.strictEqual(JIT_TOTAL_PROACTIVE_NOTIFICATIONS_PER_DAY, 3);
    assert.strictEqual(JIT_AMBIGUOUS_NANO_TRIAGES_PER_DAY, 8);
    assert.strictEqual(JIT_FULL_TURNS_PER_CANDIDATE, 1);
    assert.strictEqual(JIT_TOTAL_FULL_TURNS_PER_DAY, 3);
    assert.strictEqual(JIT_MAX_CALENDAR_EVENTS, 32);
    assert.strictEqual(JIT_POLICY_VALID_FOR_SECONDS, 30);
    assert.strictEqual(JIT_CONTENT_FREE_ID_PATTERN.test(hash), true);
    assert.strictEqual(JIT_CONTENT_FREE_ID_PATTERN.test("abc"), false);
  });

  it("derives arbitraries for every exported schema", () => {
    for (const schema of [
      JitProactivityOperation,
      JitPlannedNotificationReceipt,
      JitAmbientNotificationReceipt,
      JitNanoTriageReceipt,
      JitFullTurnReceipt,
      JITProactivityEventReceipt,
      JitTriggerPairInvalid,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("decodes a planned receipt with present values", () => {
    const decoded = decode(JitPlannedNotificationReceipt, {
      ...base,
      operation: "planned_notification",
      triggerMemoryId: " trigger-1 ",
      triggerRevision: 2,
      feedbackId: "fb-1",
    });
    assert.strictEqual(decoded.uid, "user-1");
    assert.strictEqual(decoded.triggerMemoryId, "trigger-1");
    assert.strictEqual(decoded.triggerRevision, 2);
    assert.strictEqual(O.getOrNull(decoded.feedbackId), "fb-1");
    assert.strictEqual(DateTime.formatIso(decoded.createdAt), "2026-09-22T10:00:00.000Z");
    assert.strictEqual(
      decodeFails(JitPlannedNotificationReceipt, { ...base, operation: "planned_notification" }),
      true,
    );
  });

  it("decodes missing and null Option fields to None and encodes None as null", () => {
    const missing = decode(JitAmbientNotificationReceipt, { ...base, operation: "ambient_notification" });
    const nulled = decode(JitAmbientNotificationReceipt, {
      ...base,
      operation: "ambient_notification",
      triggerMemoryId: null,
      triggerRevision: null,
      feedbackId: null,
    });
    for (const row of [missing, nulled]) {
      assert.strictEqual(O.isNone(row.triggerMemoryId), true);
      assert.strictEqual(O.isNone(row.triggerRevision), true);
      assert.strictEqual(O.isNone(row.feedbackId), true);
    }
    const encoded = Effect.runSync(encodeJitAmbientNotificationReceipt(missing));
    assert.strictEqual(encoded.triggerMemoryId, null);
    assert.strictEqual(encoded.triggerRevision, null);
    assert.strictEqual(encoded.feedbackId, null);
  });

  it("rejects out-of-bound fields", () => {
    const ambient = { ...base, operation: "ambient_notification" };
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, uid: "a/b" }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, uid: "x".repeat(129) }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, eventId: "short" }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, accountGeneration: -1 }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, budgetDay: "2026-9-2" }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, budgetTimezone: "" }), true);
    assert.strictEqual(decodeFails(JitAmbientNotificationReceipt, { ...ambient, triggerRevision: 0 }), true);
    assert.strictEqual(
      decodeFails(JitAmbientNotificationReceipt, { ...ambient, createdAt: "2026-09-22 10:00:00" }),
      true,
    );
  });

  it("decodes every tagged-union member on operation", () => {
    const planned = decode(JITProactivityEventReceipt, {
      ...base,
      operation: "planned_notification",
      triggerMemoryId: "trigger-1",
      triggerRevision: 1,
    });
    const ambient = decode(JITProactivityEventReceipt, { ...base, operation: "ambient_notification" });
    const nano = decode(JITProactivityEventReceipt, { ...base, operation: "nano_triage" });
    const full = decode(JITProactivityEventReceipt, { ...base, operation: "full_turn", parentEventId: parent });
    assert.strictEqual(planned.operation, "planned_notification");
    assert.strictEqual(ambient.operation, "ambient_notification");
    assert.strictEqual(nano.operation, "nano_triage");
    assert.strictEqual(full.operation, "full_turn");
    if (full.operation === "full_turn") assert.strictEqual(full.parentEventId, parent);
    assert.strictEqual(decodeFails(JITProactivityEventReceipt, { ...base, operation: "full_turn" }), true);
    assert.strictEqual(decodeFails(JITProactivityEventReceipt, { ...base, operation: "other" }), true);
  });

  it("decodeJitProactivityEventReceipt enforces the trigger pair and excess properties", () => {
    const together = Effect.runSync(
      decodeJitProactivityEventReceipt({
        ...base,
        operation: "nano_triage",
        triggerMemoryId: "trigger-1",
        triggerRevision: 1,
      }),
    );
    assert.strictEqual(together.operation, "nano_triage");
    const absent = Effect.runSync(decodeJitProactivityEventReceipt({ ...base, operation: "nano_triage" }));
    assert.strictEqual(absent.operation, "nano_triage");
    if (absent.operation === "nano_triage") assert.strictEqual(O.isNone(absent.triggerMemoryId), true);
    const idOnly = failure(
      decodeJitProactivityEventReceipt({ ...base, operation: "ambient_notification", triggerMemoryId: "trigger-1" }),
    );
    assert.strictEqual(isJitTriggerPairInvalid(idOnly), true);
    const revisionOnly = failure(
      decodeJitProactivityEventReceipt({
        ...base,
        operation: "full_turn",
        parentEventId: parent,
        triggerRevision: 2,
      }),
    );
    assert.strictEqual(isJitTriggerPairInvalid(revisionOnly), true);
    const excess = failure(
      decodeJitProactivityEventReceipt({ ...base, operation: "planned_notification", triggerMemoryId: "t", triggerRevision: 1, parentEventId: parent }),
    );
    assert.strictEqual(isJitTriggerPairInvalid(excess), false);
  });

  it("make applies schema version and timezone defaults", () => {
    const made = JitNanoTriageReceipt.make({
      uid: "user-1",
      eventId: hash,
      candidateId: hash,
      accountGeneration: 0,
      budgetDay: "2026-09-22",
      deviceId: hash,
      createdAt: DateTime.makeUnsafe("2026-09-22T10:00:00Z"),
      requestHash: hash,
    });
    assert.strictEqual(made.schemaVersion, "jit_proactivity_event.v1");
    assert.strictEqual(made.budgetTimezone, "UTC");
    assert.strictEqual(made.operation, "nano_triage");
    assert.strictEqual(O.isNone(made.triggerRevision), true);
  });

  it("isJitTriggerPaidAuthority accepts a paid trigger and rejects each broken clause", () => {
    const at = DateTime.makeUnsafe("2026-09-22T10:00:00Z");
    const item: JitTriggerAuthorityItem = {
      ledgerSchemaVersion: "knowledge_ledger.v1",
      kind: "trigger",
      tier: "long_term",
      processingState: "processed",
      status: "active",
      validTo: null,
      supersededBy: null,
      validFrom: DateTime.makeUnsafe("2026-09-21T00:00:00Z"),
      sourceState: "active",
      evidence: [{ sourceState: "tombstoned" }, { sourceState: "active" }],
      intentBacked: true,
      subjectScope: "primary_user",
      sensitivityLabels: ["travel"],
      triggerCondition: { action: { type: "agent_prompt", prompt: "  remind   me  " } },
    };
    assert.strictEqual(isJitTriggerPaidAuthority({ item, at }), true);
    assert.strictEqual(isJitTriggerPaidAuthority({ item: { ...item, validFrom: null }, at }), true);
    const broken: ReadonlyArray<Partial<JitTriggerAuthorityItem>> = [
      { ledgerSchemaVersion: "knowledge_ledger.v0" },
      { kind: "fact" },
      { tier: "short_term" },
      { processingState: "pending" },
      { status: "superseded" },
      { validTo: at },
      { supersededBy: "other" },
      { validFrom: DateTime.makeUnsafe("2026-09-23T00:00:00Z") },
      { sourceState: "tombstoned" },
      { evidence: [{ sourceState: "tombstoned" }] },
      { intentBacked: false },
      { subjectScope: "third_party" },
      { sensitivityLabels: ["health"] },
      { triggerCondition: null },
      { triggerCondition: { action: "agent_prompt" } },
      { triggerCondition: { action: { type: "webhook", prompt: "x" } } },
      { triggerCondition: { action: { type: "agent_prompt" } } },
      { triggerCondition: { action: { type: "agent_prompt", prompt: "   " } } },
      { triggerCondition: { action: { type: "agent_prompt", prompt: "x".repeat(2001) } } },
    ];
    for (const patch of broken) {
      assert.strictEqual(isJitTriggerPaidAuthority({ item: { ...item, ...patch }, at }), false);
    }
  });
});
