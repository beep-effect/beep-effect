import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ClassifierEvidence,
  ClassifierResult,
  FairUseEvent,
  FairUseEventWire,
  FairUseStage,
  FairUseState,
  FairUseStateWire,
  FairUseUserSummary,
  NaiveUtcTimestamp,
  SoftCapTrigger,
  UsageType,
  fairUseUtcNow,
} from "../../beep/FairUse.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("FairUse", () => {
  it("encodes a naive UTC stamp without a zone suffix", () => {
    const decoded = decode(NaiveUtcTimestamp, "2020-01-02T03:04:05.000");
    const encoded = Effect.runSync(S.encodeEffect(NaiveUtcTimestamp)(decoded));
    assert.strictEqual(encoded, "2020-01-02T03:04:05.000");
    assert.strictEqual(typeof Effect.runSync(fairUseUtcNow()).epochMilliseconds, "number");
    assert.strictEqual(decode(SoftCapTrigger, "3day"), "3day");
  });

  it("decodes a null classifier and constructs idle state", () => {
    const state = FairUseState.make({});
    assert.strictEqual(state.stage, "none");
    assert.strictEqual(state.violationCount7d, 0);
    const event = decode(FairUseEventWire, {
      created_at: "2020-01-02T03:04:05.000",
      session_id: "",
      trigger: "3day",
      window_speech_ms: { daily: 1 },
      thresholds_ms: {},
      classifier: null,
      enforcement_action: "",
      previous_stage: "none",
      new_stage: "warning",
      admin_notes: "",
      resolved: false,
      resolved_at: null,
      resolved_by: "",
    });
    assert.strictEqual(O.isNone(event.classifier), true);
    assert.strictEqual(event.trigger, "3day");
    assert.strictEqual(event.windowSpeechMs.daily, 1);
    const decodedState = decode(FairUseStateWire, {
      stage: "none",
      violation_count_7d: 0,
      violation_count_30d: 0,
      last_violation_at: null,
      throttle_until: null,
      restrict_until: null,
      last_classifier_score: 0,
      last_classifier_type: "none",
      updated_at: "2020-01-02T03:04:05.000",
    });
    assert.strictEqual(O.isNone(decodedState.throttleUntil), true);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [
      FairUseStage,
      UsageType,
      SoftCapTrigger,
      NaiveUtcTimestamp,
      ClassifierEvidence,
      ClassifierResult,
      FairUseState,
      FairUseEvent,
      FairUseUserSummary,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});
