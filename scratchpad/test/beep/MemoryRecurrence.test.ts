import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CanonicalRecurrenceSignal,
  RecurrenceEvidenceKind,
  RecurrenceEvidenceRef,
  RecurrenceRejected,
  assertCanonicalRecurrenceSignal,
  stableLoopKey,
} from "../../beep/MemoryRecurrence.ts";

const encodeRecurrenceEvidenceRef = S.encodeEffect(RecurrenceEvidenceRef);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const rejectionReason = (effect: Effect.Effect<unknown, RecurrenceRejected>): string =>
  Effect.runSync(Effect.match(effect, { onFailure: (error) => error.reason, onSuccess: () => "accepted" }));

const refWire = { kind: "memory_item", id: "memory-1", scope: "canonical" };

const signalWire = {
  signalId: "signal-1",
  title: "Weekly report",
  objective: "Send the weekly report",
  anchorTaskDescription: "Draft the report",
  occurrenceCount: 3,
  distinctDayCount: 2,
  unresolved: true,
  confidence: 0.8,
  firstSeenAt: "2026-09-01T10:00:00+02:00",
  lastSeenAt: "2026-09-03T10:00:00Z",
  evidenceRefs: [refWire, { kind: "conversation", id: "conversation-1", scope: "canonical", version: "v1" }],
};

const signal = (patch: Record<string, unknown> = {}): CanonicalRecurrenceSignal =>
  decode(CanonicalRecurrenceSignal, { ...signalWire, ...patch });

describe("RecurrenceEvidenceRef", () => {
  it("decodes present optional fields", () => {
    const ref = decode(RecurrenceEvidenceRef, {
      ...refWire,
      version: "v2",
      deviceId: "device-1",
      excerptHash: "a".repeat(64),
      startSeconds: 1.5,
      endSeconds: 2.5,
    });
    assert.strictEqual(O.getOrNull(ref.version), "v2");
    assert.strictEqual(O.getOrNull(ref.deviceId), "device-1");
    assert.strictEqual(O.getOrNull(ref.startSeconds), 1.5);
    assert.strictEqual(O.getOrNull(ref.endSeconds), 2.5);
  });

  it("decodes missing and null optionals to none and encodes none as null", () => {
    const missing = decode(RecurrenceEvidenceRef, refWire);
    assert.strictEqual(O.isNone(missing.version), true);
    assert.strictEqual(O.isNone(missing.deviceId), true);
    assert.strictEqual(O.isNone(missing.excerptHash), true);
    const nulled = decode(RecurrenceEvidenceRef, { ...refWire, version: null, deviceId: null, startSeconds: null });
    assert.strictEqual(O.isNone(nulled.version), true);
    assert.strictEqual(O.isNone(nulled.startSeconds), true);
    const encoded = Effect.runSync(encodeRecurrenceEvidenceRef(nulled));
    assert.strictEqual(encoded.version, null);
    assert.strictEqual(encoded.deviceId, null);
  });

  it("rejects each violated bound", () => {
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, kind: "device" }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, scope: "device_local" }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, version: "v".repeat(129) }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, excerptHash: "A".repeat(64) }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, excerptHash: "a".repeat(63) }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, startSeconds: -1 }), true);
    assert.strictEqual(decodeFails(RecurrenceEvidenceRef, { ...refWire, endSeconds: -0.5 }), true);
  });
});

describe("CanonicalRecurrenceSignal", () => {
  it("decodes and stores aware instants as UTC", () => {
    const decoded = signal();
    assert.strictEqual(DateTime.formatIso(decoded.firstSeenAt), "2026-09-01T08:00:00.000Z");
    assert.strictEqual(DateTime.formatIso(decoded.lastSeenAt), "2026-09-03T10:00:00.000Z");
    assert.strictEqual(decoded.evidenceRefs.length, 2);
    assert.strictEqual(decoded.confidence, 0.8);
  });

  it("rejects out-of-range fields", () => {
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, title: "" }), true);
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, objective: "o".repeat(2049) }), true);
    assert.strictEqual(
      decodeFails(CanonicalRecurrenceSignal, { ...signalWire, anchorTaskDescription: "a".repeat(2001) }),
      true,
    );
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, occurrenceCount: 0 }), true);
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, distinctDayCount: 0 }), true);
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, confidence: 1.2 }), true);
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, firstSeenAt: "2026-09-01T10:00:00" }), true);
    assert.strictEqual(decodeFails(CanonicalRecurrenceSignal, { ...signalWire, evidenceRefs: [] }), true);
    assert.strictEqual(
      decodeFails(CanonicalRecurrenceSignal, { ...signalWire, evidenceRefs: A.makeBy(51, () => refWire) }),
      true,
    );
  });
});

describe("assertCanonicalRecurrenceSignal", () => {
  it("accepts a consistent signal", () => {
    const accepted = Effect.runSync(assertCanonicalRecurrenceSignal(signal()));
    assert.strictEqual(accepted.signalId, "signal-1");
  });

  it("rejects device-local evidence", () => {
    assert.strictEqual(
      rejectionReason(assertCanonicalRecurrenceSignal(signal({ evidenceRefs: [{ ...refWire, deviceId: "device-1" }] }))),
      "canonical evidence cannot carry device_id",
    );
  });

  it("rejects an inverted evidence span", () => {
    assert.strictEqual(
      rejectionReason(
        assertCanonicalRecurrenceSignal(signal({ evidenceRefs: [{ ...refWire, startSeconds: 5, endSeconds: 4 }] })),
      ),
      "end_seconds must be greater than or equal to start_seconds",
    );
  });

  it("rejects first_seen_at after last_seen_at", () => {
    assert.strictEqual(
      rejectionReason(assertCanonicalRecurrenceSignal(signal({ lastSeenAt: "2026-08-31T10:00:00Z" }))),
      "first_seen_at must not be after last_seen_at",
    );
  });

  it("rejects distinct_day_count above occurrence_count", () => {
    assert.strictEqual(
      rejectionReason(assertCanonicalRecurrenceSignal(signal({ occurrenceCount: 1, distinctDayCount: 2 }))),
      "distinct_day_count cannot exceed occurrence_count",
    );
  });

  it("rejects distinct_day_count above the observed UTC date span", () => {
    assert.strictEqual(
      rejectionReason(
        assertCanonicalRecurrenceSignal(
          signal({ occurrenceCount: 5, distinctDayCount: 4, lastSeenAt: "2026-09-02T23:59:59Z" }),
        ),
      ),
      "distinct_day_count cannot exceed the observed date span",
    );
    const boundary = signal({ occurrenceCount: 5, distinctDayCount: 2, lastSeenAt: "2026-09-02T00:00:00Z" });
    assert.strictEqual(Effect.runSync(assertCanonicalRecurrenceSignal(boundary)).distinctDayCount, 2);
  });
});

describe("stableLoopKey", () => {
  it.effect("hashes the first evidence ref into a 40-hex loop key", () =>
    Effect.gen(function* () {
      const key = yield* stableLoopKey(signal());
      assert.match(key, /^recurrence_loop_[a-f0-9]{40}$/);
      assert.strictEqual(yield* stableLoopKey(signal({ title: "Other" })), key);
      assert.notStrictEqual(yield* stableLoopKey(signal({ evidenceRefs: [{ ...refWire, id: "memory-2" }] })), key);
    }),
  );

  it.effect("uses the sha256 of scope:kind:id truncated to 40 characters", () =>
    Effect.gen(function* () {
      const key = yield* stableLoopKey(signal({ evidenceRefs: [refWire] }));
      const digest = createHash("sha256").update("canonical:memory_item:memory-1", "utf8").digest("hex");
      assert.strictEqual(key, `recurrence_loop_${digest.slice(0, 40)}`);
    }),
  );
});

describe("arbitraries", () => {
  it("derive for the exported schemas", () => {
    assert.isDefined(Arbitrary.schema(RecurrenceEvidenceKind));
    assert.isDefined(Arbitrary.schema(RecurrenceEvidenceRef));
    assert.isDefined(Arbitrary.schema(CanonicalRecurrenceSignal));
    assert.isDefined(Arbitrary.schema(RecurrenceRejected));
  });
});
