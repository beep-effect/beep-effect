import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  ContextMatchSignal,
  DecisionDebugProjection,
  DecisionRecord,
  DeterministicFacts,
  EvaluationRequest,
  EvidenceKind,
  EvidenceRef,
  EvidenceScope,
  ShortlistEligibility,
  FeedbackCreate,
  FeedbackRecord,
  FeedbackSubjectKind,
  InterventionCreate,
  InterventionRecord,
  InterventionSurface,
  NormalizedContextMatch,
  NormalizedContextSnapshot,
  OpenLoopDescriptor,
  OpenLoopKind,
  OpenLoopSnapshot,
  OpenLoopStatus,
  OutcomeCreate,
  OutcomeRecord,
  Recommendation,
  RecommendationSubjectKind,
  SnapshotReceipt,
  TaskIntelligenceFeedbackAction,
  TaskIntelligenceFeedbackReason,
  TaskIntelligenceOutcomeCode,
  WhatMattersNowProjection,
  requireUniqueContextSignals,
  requireUniqueMatchSignals,
  validateEvidenceScope,
  validateFeedbackAction,
} from "../../beep/TaskRecommendation.ts";

const decode = <A extends S.Top>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Top, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const evidence = EvidenceRef.make({ kind: "conversation", id: "c1", scope: "canonical" });

describe("TaskRecommendation", () => {
  it("decodes evidence and rejects illegal scope combinations", () => {
    const present = decode(toWire(EvidenceRef), {
      kind: "conversation",
      id: "c1",
      version: "1",
      scope: "canonical",
      excerpt_hash: "a".repeat(64),
      start_seconds: 1,
      end_seconds: 2,
    });
    assert.strictEqual(present.kind, "conversation");
    assert.strictEqual(O.getOrElse(present.version, () => ""), "1");
    const missing = decode(toWire(EvidenceRef), { kind: "memory_item", id: "m1", scope: "canonical" });
    assert.strictEqual(O.isNone(missing.deviceId), true);
    assert.strictEqual(O.isNone(missing.excerptHash), true);
    assert.strictEqual(O.isNone(missing.startSeconds), true);
    const nulled = decode(toWire(EvidenceRef), {
      kind: "conversation",
      id: "c1",
      scope: "canonical",
      version: null,
      device_id: null,
      excerpt_hash: null,
      transcript_segment_ids: null,
      start_seconds: null,
      end_seconds: null,
    });
    assert.strictEqual(O.isNone(nulled.transcriptSegmentIds), true);
    assert.strictEqual(
      Effect.runSyncExit(validateEvidenceScope(EvidenceRef.make({ kind: "conversation", id: "c1", scope: "canonical", deviceId: O.some("d1") })))._tag,
      "Failure",
    );
    assert.strictEqual(
      Effect.runSyncExit(validateEvidenceScope(EvidenceRef.make({ kind: "local_screen", id: "s1", scope: "canonical" })))._tag,
      "Failure",
    );
    assert.strictEqual(
      Effect.runSyncExit(validateEvidenceScope(EvidenceRef.make({ kind: "conversation", id: "c1", scope: "device_local" })))._tag,
      "Failure",
    );
    assert.strictEqual(Effect.runSync(validateEvidenceScope(evidence)).id, "c1");
    assert.strictEqual(fails(toWire(EvidenceRef), { kind: "conversation", id: "c1", scope: "canonical", excerpt_hash: "zz" }), true);
  });

  it("covers feedback action branches and unique signals", () => {
    const dismiss = FeedbackCreate.make({
      subjectKind: "task",
      subjectId: "t1",
      action: "dismiss",
      interventionId: O.some("i1"),
      reason: O.some("not_mine"),
    });
    assert.strictEqual(Effect.runSync(validateFeedbackAction(dismiss)).action, "dismiss");
    const reason = FeedbackCreate.make({
      subjectKind: "task",
      subjectId: "t1",
      action: "do_now",
      interventionId: O.some("i1"),
      reason: O.some("not_mine"),
    });
    assert.strictEqual(Effect.runSyncExit(validateFeedbackAction(reason))._tag, "Failure");
    const later = FeedbackCreate.make({
      subjectKind: "task",
      subjectId: "t1",
      action: "complete",
      laterUntil: O.some(DateTime.makeUnsafe("2020-01-02T03:04:05Z")),
    });
    assert.strictEqual(Effect.runSyncExit(validateFeedbackAction(later))._tag, "Failure");
    const missingId = FeedbackCreate.make({ subjectKind: "task", subjectId: "t1", action: "later" });
    assert.strictEqual(Effect.runSyncExit(validateFeedbackAction(missingId))._tag, "Failure");
    const complete = FeedbackCreate.make({ subjectKind: "artifact", subjectId: "a1", action: "complete" });
    assert.strictEqual(Effect.runSync(validateFeedbackAction(complete)).action, "complete");
    assert.strictEqual(Effect.runSync(requireUniqueContextSignals(["app", "meeting"])).length, 2);
    assert.strictEqual(Effect.runSyncExit(requireUniqueContextSignals(["app", "app"]))._tag, "Failure");
    assert.strictEqual(Effect.runSyncExit(requireUniqueMatchSignals([]))._tag, "Failure");
    assert.strictEqual(fails(DeterministicFacts, { hasConcreteNextAction: true, captureConfidence: 1, contextMatchSignals: ["app", "app"] }), true);
    const facts = decode(toWire(DeterministicFacts), {
      has_concrete_next_action: true,
      capture_confidence: 0.5,
      someone_blocked: false,
      focused_goal_linked: false,
      context_match_signals: [],
      days_to_due: null,
    });
    assert.strictEqual(facts.someoneBlocked, false);
    assert.strictEqual(O.isNone(facts.daysToDue), true);
  });

  it("decodes a recommendation and a naive snapshot receipt", () => {
    const recommendation = decode(toWire(Recommendation), {
      intervention_id: "i1",
      output_version: "o1",
      subject_kind: "agent_open_loop",
      subject_id: "s1",
      feedback_subject_kind: "task",
      feedback_subject_id: "t1",
      headline: "Call",
      why_now: "Now",
      recommended_action: "call",
      evidence_preview: "",
      evidence_refs: [{ kind: "conversation", id: "c1", scope: "canonical" }],
      dedupe_key: "d1",
      expires_at: "2020-01-02T03:04:05Z",
    });
    assert.strictEqual(recommendation.subjectKind, "agent_open_loop");
    assert.strictEqual(O.isNone(recommendation.destinationTaskId), true);
    assert.strictEqual(fails(awareReject, "2020-01-02T03:04:05"), true);
    const receipt = decode(toWire(SnapshotReceipt), { snapshot_id: "s1", replaced: false, expires_at: "2020-01-02T03:04:05" });
    assert.strictEqual(DateTime.formatIso(receipt.expiresAt), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(EvaluationRequest.make({}).deviceId._tag, "None");
    assert.strictEqual(WhatMattersNowProjection.make({
      evaluationId: "e1",
      outputVersion: "o1",
      materialVersion: "m1",
      generatedAt: DateTime.makeUnsafe("2020-01-02T03:04:05Z"),
      expiresAt: DateTime.makeUnsafe("2020-01-03T03:04:05Z"),
      recommendations: [],
    }).schemaVersion, 1);
  });

  it("derives an arbitrary for every exported model", () => {
    for (const schema of [
      RecommendationSubjectKind,
      FeedbackSubjectKind,
      InterventionSurface,
      ContextMatchSignal,
      OpenLoopKind,
      OpenLoopStatus,
      TaskIntelligenceFeedbackAction,
      TaskIntelligenceFeedbackReason,
      TaskIntelligenceOutcomeCode,
      EvidenceKind,
      EvidenceScope,
      EvidenceRef,
      DeterministicFacts,
      ShortlistEligibility,
      Recommendation,
      WhatMattersNowProjection,
      FeedbackCreate,
      InterventionCreate,
      InterventionRecord,
      FeedbackRecord,
      OutcomeCreate,
      OutcomeRecord,
      NormalizedContextMatch,
      NormalizedContextSnapshot,
      OpenLoopDescriptor,
      OpenLoopSnapshot,
      EvaluationRequest,
      DecisionRecord,
      DecisionDebugProjection,
      SnapshotReceipt,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(Arbitrary.schema(schema)), true);
    }
  });
});

const awareReject = S.String.check(
  S.isPattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})$/),
);
