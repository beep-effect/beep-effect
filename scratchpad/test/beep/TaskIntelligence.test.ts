import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  MemoryCohortEligible,
  TaskIntelligenceAttributionEvent,
  TaskIntelligenceAttributionEventLinkage,
  TaskIntelligenceLinkageError,
  TaskIntelligenceRolloutDecision,
  TaskWorkflowControl,
  linkageFailure,
  persistedPayload,
  requireEventSpecificLinkage,
  stripRetiredChatFirstFlag,
} from "../../beep/TaskIntelligence.ts";

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const base = {
  schemaVersion: 1,
  eventId: "event-1",
  sourceClass: "manual",
  occurredAt: "2020-01-02T03:04:05.000Z",
};

const event = (fields: Record<string, unknown>): TaskIntelligenceAttributionEvent =>
  Effect.runSync(S.decodeUnknownEffect(TaskIntelligenceAttributionEvent)({ ...base, ...fields }));

const message = (value: TaskIntelligenceAttributionEvent): string =>
  O.getOrElse(linkageFailure(value), () => "");

describe("TaskIntelligence", () => {
  it("constructs rollout and control defaults and drops the retired flag", () => {
    const decision = TaskIntelligenceRolloutDecision.make({
      uid: "user-1",
      workflowMode: "off",
      legacyReadsAuthoritative: true,
      legacyWritesEnabled: false,
      intelligenceEvaluationEnabled: false,
      canonicalSidecarWritesEnabled: false,
      canonicalReadsAuthoritative: false,
      compatibilityProjectionRequired: false,
      intelligenceProductEnabled: false,
    });
    expect(decision.memoryCohortEligible).toBe(true);
    expect(decision.accountGeneration).toBe(0);
    expect(S.is(MemoryCohortEligible)(false)).toBe(false);
    expect(fails(TaskIntelligenceRolloutDecision, {
      uid: "",
      workflowMode: "off",
      memoryCohortEligible: true,
      accountGeneration: 0,
      legacyReadsAuthoritative: true,
      legacyWritesEnabled: false,
      intelligenceEvaluationEnabled: false,
      canonicalSidecarWritesEnabled: false,
      canonicalReadsAuthoritative: false,
      compatibilityProjectionRequired: false,
      intelligenceProductEnabled: false,
    })).toBe(true);
    const control = TaskWorkflowControl.make({});
    expect(control.workflowMode).toBe("off");
    expect(control.chatFirstUi).toBe(false);
    expect(persistedPayload(TaskWorkflowControl.make({ chatFirstUi: true }))).toEqual({
      workflow_mode: "off",
      account_generation: 0,
    });
    const stripped = stripRetiredChatFirstFlag({ workflowMode: "off", chat_first_ui_enabled: true });
    expect(P.isObject(stripped) && Rec.has(stripped, "chat_first_ui_enabled")).toBe(false);
    expect(stripRetiredChatFirstFlag("off")).toBe("off");
  });

  it("requires the identifiers for each event type", () => {
    expect(message(event({ eventType: "candidate_captured" }))).toBe("candidate_captured requires candidate_id");
    const captured = event({ eventType: "candidate_captured", candidateId: "candidate-1" });
    expect(message(captured)).toBe("");
    expect(Effect.runSync(requireEventSpecificLinkage(captured)).eventId).toBe("event-1");
    expect(message(event({ eventType: "candidate_resolved", candidateId: "candidate-1" }))).toBe(
      "candidate_resolved requires candidate_id and resolution_code",
    );
    expect(message(event({
      eventType: "candidate_resolved",
      candidateId: "candidate-1",
      resolutionCode: "accepted",
    }))).toBe("accepted candidate_resolved requires a task_id or workstream_id");
    expect(message(event({
      eventType: "candidate_resolved",
      candidateId: "candidate-1",
      resolutionCode: "rejected",
    }))).toBe("");
    expect(message(event({
      eventType: "candidate_resolved",
      candidateId: "candidate-1",
      resolutionCode: "accepted",
      workstreamId: "work-1",
    }))).toBe("");
    expect(message(event({ eventType: "intervention_presented", interventionId: "int-1" }))).toBe(
      "intervention_presented requires intervention_id and subject",
    );
    expect(message(event({
      eventType: "intervention_presented",
      interventionId: "int-1",
      taskId: "task-1",
    }))).toBe("");
    expect(message(event({
      eventType: "feedback_recorded",
      interventionId: "int-1",
      taskId: "task-1",
    }))).toBe("feedback_recorded requires intervention_id, subject, and feedback_action");
    expect(message(event({
      eventType: "feedback_recorded",
      interventionId: "int-1",
      taskId: "task-1",
      feedbackAction: "do_now",
      feedbackReason: "not_mine",
    }))).toBe("feedback_reason is only valid for dismiss feedback");
    expect(message(event({
      eventType: "feedback_recorded",
      interventionId: "int-1",
      taskId: "task-1",
      feedbackAction: "dismiss",
      feedbackReason: "not_useful",
    }))).toBe("");
    expect(message(event({ eventType: "outcome_recorded", outcomeCode: "task_completed" }))).toBe(
      "outcome_recorded requires attribution_chain_id, subject, and outcome_code",
    );
    expect(message(event({
      eventType: "outcome_recorded",
      attributionChainId: "chain-1",
      artifactId: "artifact-1",
      outcomeCode: "artifact_approved",
    }))).toBe("");
    const failed = requireEventSpecificLinkage(event({ eventType: "candidate_captured" })).pipe(
      Effect.flip,
      Effect.runSync,
    );
    expect(failed).toBeInstanceOf(TaskIntelligenceLinkageError);
    expect(failed.message).toBe("candidate_captured requires candidate_id");
    expect(fails(TaskIntelligenceAttributionEventLinkage, {
      ...base,
      eventType: "candidate_captured",
    })).toBe(true);
  });

  it("decodes null optional ids as None and builds arbitraries", () => {
    const decoded = event({
      eventType: "candidate_captured",
      candidateId: null,
      confidenceBand: "high",
    });
    expect(O.isNone(decoded.candidateId)).toBe(true);
    expect(decoded.confidenceBand).toEqual(O.some("high"));
    for (const model of [
      TaskIntelligenceRolloutDecision,
      TaskWorkflowControl,
      TaskIntelligenceAttributionEvent,
      TaskIntelligenceAttributionEventLinkage,
    ]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
