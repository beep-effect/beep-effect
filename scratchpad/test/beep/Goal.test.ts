import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AdviceResponse,
  GoalCreate,
  GoalDeleteResponse,
  GoalDeleteResponseWire,
  GoalFocusRequest,
  GoalHistoryEntryResponse,
  GoalLifecycleRequest,
  GoalMetric,
  GoalProgressEvent,
  GoalProgressEventCreate,
  GoalResponse,
  GoalResponseWire,
  GoalSource,
  GoalStatus,
  GoalProgressEventKind,
  GoalRelationshipDisposition,
  GoalSuggestionResponse,
  GoalType,
  GoalUpdate,
  decodeGoalCreate,
  decodeGoalLifecycleRequest,
  decodeGoalUpdate,
  normalizeLegacyDescription,
  normalizeLegacyMetric,
  normalizeLegacySource,
  protectRequiredFields,
  validateMetricBounds,
  validateTerminalStatus,
} from "../../beep/Goal.ts";

const isStringUnknownRecord = S.is(S.Record(S.String, S.Unknown));
const decodeGoalResponseWire = S.decodeEffect(GoalResponseWire);
const decodeGoalDeleteResponseWire = S.decodeEffect(GoalDeleteResponseWire);
const decodeAdviceResponse = S.decodeEffect(AdviceResponse);

describe("Goal", () => {
  it("promotes description, rewrites source, and synthesizes a metric", () => {
    const prepared = normalizeLegacyDescription({ title: "Run", description: "5k" });
    assert.strictEqual(isStringUnknownRecord(prepared) && prepared.desired_outcome, "5k");
    const kept = normalizeLegacyDescription({ title: "Run", description: "5k", desired_outcome: "kept" });
    assert.strictEqual(isStringUnknownRecord(kept) && kept.desired_outcome, "kept");
    assert.strictEqual(normalizeLegacyDescription("nope"), "nope");
    assert.strictEqual(normalizeLegacySource("ai"), "ai_suggested");
    assert.strictEqual(normalizeLegacySource("onboarding_typed"), "user");
    assert.strictEqual(normalizeLegacySource(1), 1);
    assert.strictEqual(normalizeLegacySource("imported"), "imported");
    const created = Effect.runSync(
      decodeGoalCreate({
        title: "  Run  ",
        success_criteria: [],
        status: "background",
        source: "ai",
        description: "5k",
      }),
    );
    assert.strictEqual(created.title, "Run");
    assert.strictEqual(created.source, "ai_suggested");
    assert.strictEqual(O.getOrElse(created.desiredOutcome, () => ""), "5k");
    const synthesized = Effect.runSync(
      decodeGoalCreate({
        title: "Run",
        success_criteria: [" a ", " "],
        status: "background",
        source: "user",
        target_value: 5,
        goal_type: "numeric",
      }),
    );
    assert.strictEqual(O.isSome(synthesized.metric), true);
    if (O.isSome(synthesized.metric)) {
      assert.strictEqual(synthesized.metric.value.type, "numeric");
      assert.strictEqual(synthesized.metric.value.target, 5);
      assert.strictEqual(synthesized.metric.value.current, 0);
    }
    const currentOnly = Effect.runSync(
      decodeGoalCreate({
        title: "Run",
        success_criteria: [],
        status: "background",
        source: "user",
        current_value: 3,
      }),
    );
    assert.strictEqual(O.isNone(currentOnly.metric), true);
    assert.strictEqual(currentOnly.successCriteria.length, 0);
    assert.strictEqual(
      Effect.runSyncExit(
        decodeGoalCreate({ title: "Run", success_criteria: [], status: "focused", source: "user" }),
      )._tag,
      "Failure",
    );
    assert.strictEqual(
      Effect.runSyncExit(
        decodeGoalCreate({ title: "   ", success_criteria: [], status: "background", source: "onboarding_typed" }),
      )._tag,
      "Failure",
    );
    const criteria = Effect.runSync(normalizeLegacyMetric(GoalCreate.make({ title: "Run", successCriteria: [" a ", " "] })));
    assert.strictEqual(criteria.successCriteria.length, 1);
    const inverted = GoalMetric.make({ type: "scale", current: 0, target: 1, min: O.some(4), max: O.some(1) });
    assert.strictEqual(Effect.runSyncExit(validateMetricBounds(inverted))._tag, "Failure");
    const ordered = GoalMetric.make({ type: "scale", current: 0, target: 1, min: O.some(1), max: O.some(4) });
    assert.strictEqual(Effect.runSync(validateMetricBounds(ordered)).type, "scale");
  });

  it("rejects explicit update nulls and non-terminal lifecycle statuses", () => {
    const omitted = Effect.runSync(decodeGoalUpdate({ clear_metric: false }));
    assert.strictEqual(O.isNone(omitted.title), true);
    assert.strictEqual(omitted.clearMetric, false);
    assert.strictEqual(Effect.runSyncExit(decodeGoalUpdate({ title: null, clear_metric: false }))._tag, "Failure");
    assert.strictEqual(
      Effect.runSyncExit(decodeGoalUpdate({ success_criteria: null, clear_metric: false }))._tag,
      "Failure",
    );
    assert.strictEqual(
      Effect.runSyncExit(decodeGoalUpdate({ current_value: null, clear_metric: false }))._tag,
      "Failure",
    );
    assert.strictEqual(Effect.runSyncExit(protectRequiredFields({ target_value: null }, GoalUpdate.make({})))._tag, "Failure");
    const trimmed = Effect.runSync(
      decodeGoalUpdate({ title: "  Run  ", desired_outcome: "  5k  ", clear_metric: false }),
    );
    assert.strictEqual(O.getOrElse(trimmed.title, () => ""), "Run");
    assert.strictEqual(O.getOrElse(trimmed.desiredOutcome, () => ""), "5k");
    assert.strictEqual(
      Effect.runSyncExit(decodeGoalUpdate({ desired_outcome: "   ", clear_metric: false }))._tag,
      "Failure",
    );
    const cleared = Effect.runSync(decodeGoalUpdate({ clear_metric: true }));
    assert.strictEqual(cleared.clearMetric, true);
    const paused = Effect.runSync(decodeGoalLifecycleRequest({ status: "paused", relationship_disposition: "detach" }));
    assert.strictEqual(paused.relationshipDisposition, "detach");
    assert.strictEqual(Effect.runSyncExit(decodeGoalLifecycleRequest({ status: "focused", relationship_disposition: "retain" }))._tag, "Failure");
    const background = GoalLifecycleRequest.make({ status: "background", relationshipDisposition: "retain" });
    assert.strictEqual(Effect.runSyncExit(validateTerminalStatus(background))._tag, "Failure");
    const achieved = GoalLifecycleRequest.make({ status: "achieved", relationshipDisposition: "retain" });
    assert.strictEqual(Effect.runSync(validateTerminalStatus(achieved)).status, "achieved");
  });

  it("decodes response aliases and constructs suggestion defaults", () => {
    const response = Effect.runSync(
      decodeGoalResponseWire({
        id: "goal-1",
        goal_id: "goal-1",
        title: "Run",
        desired_outcome: "5k",
        success_criteria: [],
        status: "background",
        source: "user",
        created_at: "2020-01-02T03:04:05.000Z",
        updated_at: "2020-01-02T03:04:05.000Z",
        latest_progress_sequence: 0,
        goal_type: "scale",
        target_value: 5,
        current_value: 0,
        min_value: 0,
        max_value: 10,
        is_active: true,
        why_it_matters: null,
        metric: null,
      }),
    );
    assert.strictEqual(response.targetValue, 5);
    assert.strictEqual(O.isNone(response.whyItMatters), true);
    assert.strictEqual(O.isNone(response.metric), true);
    assert.strictEqual(O.isNone(response.focusRank), true);
    const suggestion = GoalSuggestionResponse.make({
      suggestedTitle: "Run",
      suggestedType: "scale",
      suggestedTarget: 5,
      reasoning: "mentioned",
    });
    assert.strictEqual(suggestion.suggestedMin, 0);
    assert.strictEqual(suggestion.suggestedMax, 10);
    const deleted = Effect.runSync(decodeGoalDeleteResponseWire({ success: true, deleted_id: "goal-1" }));
    assert.strictEqual(deleted.deletedId, "goal-1");
    const advice = Effect.runSync(decodeAdviceResponse({ advice: "Keep going" }));
    assert.strictEqual(advice.advice, "Keep going");
    const event = GoalProgressEventCreate.make({ kind: "milestone", summary: "Started" });
    assert.strictEqual(event.evidenceRefs.length, 0);
    assert.strictEqual(GoalCreate.make({ title: "Run" }).source, "user");
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [
      GoalType,
      GoalStatus,
      GoalSource,
      GoalRelationshipDisposition,
      GoalProgressEventKind,
      GoalMetric,
      GoalCreate,
      GoalUpdate,
      GoalFocusRequest,
      GoalLifecycleRequest,
      GoalProgressEventCreate,
      GoalProgressEvent,
      GoalResponse,
      GoalHistoryEntryResponse,
      GoalDeleteResponse,
      GoalSuggestionResponse,
      AdviceResponse,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
