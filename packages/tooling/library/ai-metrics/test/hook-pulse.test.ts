import { fcRuns } from "@beep/fc-runs";
import {
  HookPulseAgentKind,
  HookPulseEvent,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseNotificationType,
  HookPulseRawEvent,
  HookPulseV1,
  HookPulseV1FromLegacyRecord,
  HookPulseV1FromRawEvent,
  HookPulseWaitReason,
} from "@beep/repo-ai-metrics";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const baseRawEventFixture = {
  session_id: "ccd-session-raw-1",
  cwd: "/worktrees/beep-effect2",
  transcript_path: "/tmp/claude/session-raw-1.jsonl",
};

const baseRawInputFixture = {
  notifierRev: "spike-0",
  instrumentClass: HookPulseInstrumentClass.Enum.spike,
  agentKind: HookPulseAgentKind.Enum["claude-code"],
  evidenceTier: HookPulseEvidenceTier.Enum.observed,
};

const rawInput = <const Event extends object>(ts: string, event: Event) => ({
  ...baseRawInputFixture,
  ts,
  event: { ...baseRawEventFixture, ...event },
});

const autoApprovedPreToolUse = rawInput("2026-08-01T08:39:55.000Z", {
  session_id: "ccd-session-auto-approved",
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  tool_name: "Bash",
  tool_use_id: "tool-auto-approved",
});

const autoApprovedPostToolUse = rawInput("2026-08-01T08:39:56.000Z", {
  session_id: "ccd-session-auto-approved",
  hook_event_name: HookPulseEvent.Enum.PostToolUse,
  tool_name: "Bash",
  tool_use_id: "tool-auto-approved",
  duration_ms: 1_000,
});

const autoApprovedSequence = [autoApprovedPreToolUse, autoApprovedPostToolUse];

const approvedToolPreToolUse = rawInput("2026-08-01T08:40:11.000Z", {
  session_id: "ccd-session-tool-approved",
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  tool_name: "Bash",
  tool_use_id: "tool-permission-approved",
});

const approvedToolPermissionRequest = rawInput("2026-08-01T08:40:11.000Z", {
  session_id: "ccd-session-tool-approved",
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  tool_name: "Bash",
});

const approvedToolPostToolUse = rawInput("2026-08-01T08:40:12.000Z", {
  session_id: "ccd-session-tool-approved",
  hook_event_name: HookPulseEvent.Enum.PostToolUse,
  tool_name: "Bash",
  tool_use_id: "tool-permission-approved",
});

const approvedToolPermissionSequence = [approvedToolPreToolUse, approvedToolPermissionRequest, approvedToolPostToolUse];

const deniedToolPreToolUse = rawInput("2026-08-01T08:41:36.000Z", {
  session_id: "ccd-session-tool-denied",
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  tool_name: "Bash",
  tool_use_id: "tool-permission-denied",
});

const deniedToolPermissionRequest = rawInput("2026-08-01T08:41:36.000Z", {
  session_id: "ccd-session-tool-denied",
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  tool_name: "Bash",
});

const deniedToolNotification = rawInput("2026-08-01T08:41:42.000Z", {
  session_id: "ccd-session-tool-denied",
  hook_event_name: HookPulseEvent.Enum.Notification,
  notification_type: HookPulseNotificationType.Enum.permission_prompt,
});

const deniedToolPermissionSequence = [deniedToolPreToolUse, deniedToolPermissionRequest, deniedToolNotification];

const approvedPlanPreToolUse = rawInput("2026-08-01T06:40:07.000Z", {
  session_id: "ccd-session-plan-approved",
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  tool_name: "ExitPlanMode",
  tool_use_id: "tool-plan-approved",
});

const approvedPlanPermissionRequest = rawInput("2026-08-01T06:40:07.000Z", {
  session_id: "ccd-session-plan-approved",
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  tool_name: "ExitPlanMode",
});

const approvedPlanNotification = rawInput("2026-08-01T06:40:13.000Z", {
  session_id: "ccd-session-plan-approved",
  hook_event_name: HookPulseEvent.Enum.Notification,
  notification_type: HookPulseNotificationType.Enum.permission_prompt,
});

const approvedPlanPostToolUse = rawInput("2026-08-01T06:41:29.000Z", {
  session_id: "ccd-session-plan-approved",
  hook_event_name: HookPulseEvent.Enum.PostToolUse,
  tool_name: "ExitPlanMode",
  tool_use_id: "tool-plan-approved",
});

const approvedPlanSequence = [
  approvedPlanPreToolUse,
  approvedPlanPermissionRequest,
  approvedPlanNotification,
  approvedPlanPostToolUse,
];

const rejectedPlanPreToolUse = rawInput("2026-08-01T08:43:13.000Z", {
  session_id: "ccd-session-plan-rejected",
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  tool_name: "ExitPlanMode",
  tool_use_id: "tool-plan-rejected",
});

const rejectedPlanPermissionRequest = rawInput("2026-08-01T08:43:13.000Z", {
  session_id: "ccd-session-plan-rejected",
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  tool_name: "ExitPlanMode",
});

const rejectedPlanNotification = rawInput("2026-08-01T08:43:19.000Z", {
  session_id: "ccd-session-plan-rejected",
  hook_event_name: HookPulseEvent.Enum.Notification,
  notification_type: HookPulseNotificationType.Enum.permission_prompt,
});

const rejectedPlanSequence = [rejectedPlanPreToolUse, rejectedPlanPermissionRequest, rejectedPlanNotification];

const permissionRequestWithoutTool = rawInput("2026-08-01T08:45:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
});

const idleNotification = rawInput("2026-08-01T06:28:21.000Z", {
  hook_event_name: HookPulseEvent.Enum.Notification,
  notification_type: HookPulseNotificationType.Enum.idle_prompt,
});

const userPromptSubmit = rawInput("2026-08-01T06:26:45.000Z", {
  hook_event_name: HookPulseEvent.Enum.UserPromptSubmit,
  prompt_id: "prompt-1",
});

const stop = rawInput("2026-08-01T06:27:21.000Z", {
  hook_event_name: HookPulseEvent.Enum.Stop,
});

const sessionEnd = rawInput("2026-08-01T06:29:09.000Z", {
  hook_event_name: HookPulseEvent.Enum.SessionEnd,
  reason: "prompt_input_exit",
});

const permissionDenied = rawInput("2026-08-01T08:46:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.PermissionDenied,
  tool_name: "Bash",
  reason: "User denied permission",
});

// Harness 2.1.223 ends a tool call with PostToolUse *or* PostToolUseFailure,
// never both, so this is the terminal event for an approved-then-failed call —
// the case that would otherwise leave its wait bracket open forever.
const postToolUseFailure = rawInput("2026-08-01T08:47:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.PostToolUseFailure,
  tool_name: "Bash",
  tool_use_id: "tool-failed-1",
  duration_ms: 12,
  is_interrupt: true,
});

// The other half of the only distinction `isInterrupt` exists to draw: this call
// errored on its own rather than being interrupted by a human.
const postToolUseFailureErrored = rawInput("2026-08-01T08:47:30.000Z", {
  hook_event_name: HookPulseEvent.Enum.PostToolUseFailure,
  tool_name: "Bash",
  tool_use_id: "tool-failed-2",
  duration_ms: 8,
  is_interrupt: false,
});

// A raw event carrying a field owned by a different hook event. Decode must drop
// it exactly as encode does; forwarding it would hand
// `HookPulseEventOwnedFieldInvariant` a record it must reject and fail the whole
// decode, losing a legitimate `Stop` row over a field the ledger never wanted.
const misownedNotificationTypeOnStop = rawInput("2026-08-01T08:48:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.Stop,
  notification_type: HookPulseNotificationType.Enum.idle_prompt,
});

// Same class, other two owned fields: a `reason` outside SessionEnd and an
// `is_interrupt` outside PostToolUseFailure.
const misownedReasonOnStop = rawInput("2026-08-01T08:48:30.000Z", {
  hook_event_name: HookPulseEvent.Enum.Stop,
  reason: "prompt_input_exit",
});

const misownedIsInterruptOnStop = rawInput("2026-08-01T08:49:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.Stop,
  is_interrupt: true,
});

const decodeRawHookPulse = S.decodeUnknownEffect(HookPulseRawEvent);
const encodeRawHookPulse = S.encodeUnknownEffect(HookPulseRawEvent);
const decodeHookPulseFromRaw = S.decodeUnknownEffect(HookPulseV1FromRawEvent);
const decodeHookPulseFromLegacy = S.decodeUnknownEffect(HookPulseV1FromLegacyRecord);
const decodeHookPulse = S.decodeUnknownEffect(HookPulseV1);
const encodeHookPulse = S.encodeUnknownEffect(HookPulseV1);
const encodeHookPulseToRaw = S.encodeUnknownEffect(HookPulseV1FromRawEvent);
const hookPulseEquivalent = S.toEquivalence(HookPulseV1);
const isHookPulseWaitReason = S.is(HookPulseWaitReason);

describe("HookPulseV1", () => {
  it.effect("migrates legacy v1 rows without retaining raw private identifiers", () =>
    Effect.gen(function* () {
      const legacy = {
        schemaVersion: "hook-pulse/v1",
        ts: "2026-08-01T08:00:00.000Z",
        sessionId: "legacy-session-id",
        agentKind: "claude-code",
        hookEvent: "Stop",
        cwd: "/workspace/legacy-checkout",
        notifierRev: "spike-0",
        instrumentClass: "spike",
        evidenceTier: "observed",
        waitReason: "none",
        transcriptPath: "/tmp/legacy-session.jsonl",
      };

      const decoded = yield* decodeHookPulseFromLegacy(legacy);
      const serialized = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(yield* encodeHookPulse(decoded));

      expect(decoded).toBeInstanceOf(HookPulseV1);
      expect(decoded.sessionId).toMatch(/^[0-9a-f]{64}$/u);
      expect(decoded.cwd).toMatch(/^[0-9a-f]{64}$/u);
      expect(O.getOrThrow(decoded.transcriptPath)).toMatch(/^[0-9a-f]{64}$/u);
      expect(serialized).not.toContain(legacy.sessionId);
      expect(serialized).not.toContain(legacy.cwd);
      expect(serialized).not.toContain(legacy.transcriptPath);
    })
  );

  it("round-trips schema-derived arbitrary values", () => {
    const encode = S.encodeResult(HookPulseV1);
    const decode = S.decodeUnknownResult(HookPulseV1);

    fc.assert(
      fc.property(S.toArbitrary(HookPulseV1)(fc), (value) => {
        const encoded = Result.getOrThrow(encode(value));
        const decoded = Result.getOrThrow(decode(encoded));

        expect(hookPulseEquivalent(decoded, value)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("round-trips arbitrary encodable canonical values through the raw-event codec", () => {
    const encode = S.encodeResult(HookPulseV1FromRawEvent);
    const decode = S.decodeUnknownResult(HookPulseV1FromRawEvent);
    // The raw codec requires transcriptPath and intentionally clamps observed evidence to derived.
    const arbitrary = S.toArbitrary(HookPulseV1)(fc)
      .filter((value) => O.isSome(value.transcriptPath))
      .filter((value) => Bool.not(HookPulseEvidenceTier.is.observed(value.evidenceTier)));

    fc.assert(
      fc.property(arbitrary, (value) => {
        const encoded = Result.getOrThrow(encode(value));
        const decoded = Result.getOrThrow(decode(encoded));

        expect(hookPulseEquivalent(decoded, value)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it.effect("derives a total wait reason for arbitrary raw events", () =>
    Effect.forEach(
      fc.sample(S.toArbitrary(HookPulseRawEvent)(fc), { numRuns: 50, seed: 804 }),
      Effect.fnUntraced(function* (event) {
        const encodedEvent = yield* encodeRawHookPulse(event);
        const decoded = yield* decodeHookPulseFromRaw({
          ...baseRawInputFixture,
          ts: "2026-08-01T08:00:00.000Z",
          event: encodedEvent,
        });

        expect(decoded.waitReason).toBeDefined();
        expect(isHookPulseWaitReason(decoded.waitReason)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("pseudonymizes raw session and filesystem identifiers", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeHookPulseFromRaw(
        rawInput("2026-08-01T08:00:00.000Z", {
          hook_event_name: HookPulseEvent.Enum.Stop,
        })
      );
      const encoded = yield* encodeHookPulse(decoded);
      const serialized = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(encoded);

      expect(decoded.sessionId).toMatch(/^[0-9a-f]{64}$/u);
      expect(decoded.cwd).toMatch(/^[0-9a-f]{64}$/u);
      expect(O.getOrThrow(decoded.transcriptPath)).toMatch(/^[0-9a-f]{64}$/u);
      expect(serialized).not.toContain(baseRawEventFixture.session_id);
      expect(serialized).not.toContain(baseRawEventFixture.cwd);
      expect(serialized).not.toContain(baseRawEventFixture.transcript_path);
    })
  );

  it.effect(
    "derives the auto-approved control as none, never tool-permission",
    Effect.fn("HookPulseTest.derivesAutoApprovedControl")(function* () {
      const decoded = yield* Effect.forEach(autoApprovedSequence, (fixture) => decodeHookPulseFromRaw(fixture), {
        concurrency: 1,
      });

      expect(A.map(decoded, (record) => record.hookEvent)).toEqual(["PreToolUse", "PostToolUse"]);
      expect(decoded[0]?.waitReason).toBe("none");
      expect(decoded[0]?.waitReason).not.toBe("tool-permission");
      expect(decoded[1]?.waitReason).toBe("none");
    })
  );

  it.effect(
    "matches the round-2 approved, denied, and plan sequences",
    Effect.fn("HookPulseTest.matchesRoundTwoSequences")(function* () {
      const decoded = yield* Effect.all(
        {
          approvedTool: Effect.forEach(approvedToolPermissionSequence, (fixture) => decodeHookPulseFromRaw(fixture), {
            concurrency: 1,
          }),
          deniedTool: Effect.forEach(deniedToolPermissionSequence, (fixture) => decodeHookPulseFromRaw(fixture), {
            concurrency: 1,
          }),
          approvedPlan: Effect.forEach(approvedPlanSequence, (fixture) => decodeHookPulseFromRaw(fixture), {
            concurrency: 1,
          }),
          rejectedPlan: Effect.forEach(rejectedPlanSequence, (fixture) => decodeHookPulseFromRaw(fixture), {
            concurrency: 1,
          }),
        },
        { concurrency: 1 }
      );

      expect(A.map(decoded.approvedTool, (record) => record.hookEvent)).toEqual([
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
      ]);
      expect(A.map(decoded.approvedTool, (record) => record.waitReason)).toEqual(["none", "tool-permission", "none"]);
      expect(A.map(decoded.deniedTool, (record) => record.hookEvent)).toEqual([
        "PreToolUse",
        "PermissionRequest",
        "Notification",
      ]);
      expect(A.map(decoded.deniedTool, (record) => record.waitReason)).toEqual(["none", "tool-permission", "unknown"]);
      expect(A.map(decoded.approvedPlan, (record) => record.hookEvent)).toEqual([
        "PreToolUse",
        "PermissionRequest",
        "Notification",
        "PostToolUse",
      ]);
      expect(A.map(decoded.approvedPlan, (record) => record.waitReason)).toEqual([
        "none",
        "plan-approval",
        "unknown",
        "none",
      ]);
      expect(A.map(decoded.rejectedPlan, (record) => record.hookEvent)).toEqual([
        "PreToolUse",
        "PermissionRequest",
        "Notification",
      ]);
      expect(A.map(decoded.rejectedPlan, (record) => record.waitReason)).toEqual(["none", "plan-approval", "unknown"]);
    })
  );

  it.effect(
    "derives absent-tool, idle, and terminal truth-table rows",
    Effect.fn("HookPulseTest.derivesRemainingTruthTableRows")(function* () {
      const decoded = yield* Effect.forEach(
        [permissionRequestWithoutTool, idleNotification, userPromptSubmit, stop, sessionEnd, permissionDenied],
        (fixture) => decodeHookPulseFromRaw(fixture),
        { concurrency: 1 }
      );

      expect(A.map(decoded, (record) => record.hookEvent)).toEqual([
        "PermissionRequest",
        "Notification",
        "UserPromptSubmit",
        "Stop",
        "SessionEnd",
        "PermissionDenied",
      ]);
      expect(A.map(decoded, (record) => record.waitReason)).toEqual([
        "unknown",
        "idle-input",
        "none",
        "none",
        "none",
        "none",
      ]);
    })
  );

  it.effect(
    "attributes reasons only to SessionEnd events",
    Effect.fn("HookPulseTest.attributesOnlySessionEndReasons")(function* () {
      const decoded = yield* Effect.all(
        {
          permissionDenied: decodeHookPulseFromRaw(permissionDenied),
          sessionEnd: decodeHookPulseFromRaw(sessionEnd),
        },
        { concurrency: 1 }
      );

      expect(decoded.permissionDenied.sessionEndReason).toEqual(O.none());
      expect(decoded.sessionEnd.sessionEndReason).toEqual(O.some("prompt_input_exit"));
    })
  );

  it.effect(
    "rejects sessionEndReason on a non-SessionEnd event",
    Effect.fn("HookPulseTest.rejectsMisownedSessionEndReason")(function* () {
      const canonical = yield* decodeHookPulseFromRaw(autoApprovedPostToolUse);
      const encoded = yield* encodeHookPulse(canonical);
      const failure = yield* Effect.flip(
        decodeHookPulse({
          ...encoded,
          sessionEndReason: "misattributed termination",
        })
      );

      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain("sessionEndReason");
      expect(failure.message).toContain("SessionEnd");
      expect(failure.message).toContain("PostToolUse");
    })
  );

  it.effect(
    "rejects notificationType on a non-Notification event",
    Effect.fn("HookPulseTest.rejectsMisownedNotificationType")(function* () {
      const canonical = yield* decodeHookPulseFromRaw(autoApprovedPostToolUse);
      const encoded = yield* encodeHookPulse(canonical);
      const failure = yield* Effect.flip(
        decodeHookPulse({
          ...encoded,
          notificationType: HookPulseNotificationType.Enum.permission_prompt,
        })
      );

      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain("notificationType");
      expect(failure.message).toContain("Notification");
      expect(failure.message).toContain("PostToolUse");
    })
  );

  it.effect(
    "attributes isInterrupt only to PostToolUseFailure events",
    Effect.fn("HookPulseTest.attributesOnlyPostToolUseFailureInterrupts")(function* () {
      const decoded = yield* Effect.all(
        {
          postToolUse: decodeHookPulseFromRaw(autoApprovedPostToolUse),
          postToolUseFailure: decodeHookPulseFromRaw(postToolUseFailure),
          erroredFailure: decodeHookPulseFromRaw(postToolUseFailureErrored),
        },
        { concurrency: 1 }
      );
      const reencoded = yield* Effect.all(
        {
          interrupted: encodeHookPulseToRaw(decoded.postToolUseFailure),
          errored: encodeHookPulseToRaw(decoded.erroredFailure),
        },
        { concurrency: 1 }
      );

      expect(decoded.postToolUse.isInterrupt).toEqual(O.none());
      expect(decoded.postToolUseFailure.isInterrupt).toEqual(O.some(true));
      expect(decoded.erroredFailure.isInterrupt).toEqual(O.some(false));
      expect(reencoded.interrupted.event.is_interrupt).toBe(true);
      // `false` must survive the encode path as a value. A regression to a
      // truthiness check would drop the key and erase every "the tool errored"
      // row's distinction from "the human hit escape" — and the loss is
      // invisible, because the resulting row still decodes cleanly.
      expect(reencoded.errored.event.is_interrupt).toBe(false);
      // A failed call is a bracket *end*, not a human wait.
      expect(decoded.postToolUseFailure.waitReason).toBe(HookPulseWaitReason.Enum.none);
      // The closing evidence the two-hop join needs: without both of these a
      // failed call's wait is unmeasurable rather than merely unrecorded.
      expect(decoded.postToolUseFailure.toolUseId).toEqual(O.some("tool-failed-1"));
      expect(decoded.postToolUseFailure.durationMs).toEqual(O.some(12));
    })
  );

  it.effect(
    "drops every event-owned field arriving on a foreign raw event",
    Effect.fn("HookPulseTest.dropsMisownedRawFields")(function* () {
      // Decode must agree with encode here. Encode already drops all three; a
      // decode that forwarded any of them would fail
      // `HookPulseEventOwnedFieldInvariant` and lose the whole row.
      const decoded = yield* Effect.all(
        {
          notificationType: decodeHookPulseFromRaw(misownedNotificationTypeOnStop),
          reason: decodeHookPulseFromRaw(misownedReasonOnStop),
          isInterrupt: decodeHookPulseFromRaw(misownedIsInterruptOnStop),
        },
        { concurrency: 1 }
      );

      expect(decoded.notificationType.hookEvent).toBe(HookPulseEvent.Enum.Stop);
      expect(decoded.notificationType.notificationType).toEqual(O.none());
      expect(decoded.notificationType.waitReason).toBe(HookPulseWaitReason.Enum.none);
      expect(decoded.reason.sessionEndReason).toEqual(O.none());
      expect(decoded.isInterrupt.isInterrupt).toEqual(O.none());
    })
  );

  it.effect(
    "rejects isInterrupt on a non-PostToolUseFailure event",
    Effect.fn("HookPulseTest.rejectsMisownedIsInterrupt")(function* () {
      const canonical = yield* decodeHookPulseFromRaw(autoApprovedPostToolUse);
      const encoded = yield* encodeHookPulse(canonical);
      const failure = yield* Effect.flip(
        decodeHookPulse({
          ...encoded,
          isInterrupt: true,
        })
      );

      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain("isInterrupt");
      // Asserting the whole clause: "PostToolUse" alone is a substring of
      // "PostToolUseFailure" and would pass vacuously.
      expect(failure.message).toContain("belongs to PostToolUseFailure, not hookEvent PostToolUse");
    })
  );

  it.effect(
    "round-trips fields owned by SessionEnd and Notification events",
    Effect.fn("HookPulseTest.roundTripsEventOwnedFields")(function* () {
      const canonical = yield* Effect.all(
        {
          sessionEnd: decodeHookPulseFromRaw(sessionEnd),
          notification: decodeHookPulseFromRaw(idleNotification),
        },
        { concurrency: 1 }
      );
      const encoded = yield* Effect.all(
        {
          sessionEnd: encodeHookPulseToRaw(canonical.sessionEnd),
          notification: encodeHookPulseToRaw(canonical.notification),
        },
        { concurrency: 1 }
      );
      const roundTripped = yield* Effect.all(
        {
          sessionEnd: decodeHookPulseFromRaw(encoded.sessionEnd),
          notification: decodeHookPulseFromRaw(encoded.notification),
        },
        { concurrency: 1 }
      );

      expect(encoded.sessionEnd.event.reason).toBe("prompt_input_exit");
      expect(encoded.notification.event.notification_type).toBe(HookPulseNotificationType.Enum.idle_prompt);
      expect(roundTripped.sessionEnd.sessionEndReason).toEqual(O.some("prompt_input_exit"));
      expect(roundTripped.notification.notificationType).toEqual(O.some(HookPulseNotificationType.Enum.idle_prompt));
      expect(hookPulseEquivalent(roundTripped.sessionEnd, canonical.sessionEnd)).toBe(true);
      expect(hookPulseEquivalent(roundTripped.notification, canonical.notification)).toBe(true);
    })
  );

  it.effect(
    "rejects inconsistent canonical wait reasons and decodes consistent plan approvals",
    Effect.fn("HookPulseTest.rejectsInconsistentWaitReasons")(function* () {
      const consistent = yield* decodeHookPulseFromRaw(approvedPlanPermissionRequest);
      const encoded = yield* encodeHookPulse(consistent);

      const failure = yield* Effect.flip(
        decodeHookPulse({
          ...encoded,
          hookEvent: HookPulseEvent.Enum.PostToolUse,
        })
      );
      const decoded = yield* decodeHookPulse(encoded);
      const raw = yield* encodeHookPulseToRaw(decoded);
      const roundTripped = yield* decodeHookPulseFromRaw(raw);

      expect(failure._tag).toBe("SchemaError");
      expect(failure.message).toContain(
        "Expected waitReason to match the value derived from hookEvent, toolName, and notificationType"
      );
      expect(decoded.hookEvent).toBe("PermissionRequest");
      expect(decoded.toolName).toEqual(O.some("ExitPlanMode"));
      expect(decoded.waitReason).toBe("plan-approval");
      expect(hookPulseEquivalent(roundTripped, decoded)).toBe(true);
    })
  );

  it.effect(
    "clamps derived records without upgrading weaker evidence tiers",
    Effect.fn("HookPulseTest.clampsDerivedEvidenceTier")(function* () {
      const inputTiers = [
        HookPulseEvidenceTier.Enum.observed,
        HookPulseEvidenceTier.Enum.derived,
        HookPulseEvidenceTier.Enum.heuristic,
        HookPulseEvidenceTier.Enum.unknown,
      ];
      const expectedTiers = ["derived", "derived", "heuristic", "unknown"];
      const decoded = yield* Effect.forEach(
        inputTiers,
        (evidenceTier) => decodeHookPulseFromRaw({ ...approvedToolPermissionRequest, evidenceTier }),
        { concurrency: 1 }
      );
      const encoded = yield* Effect.forEach(
        inputTiers,
        (evidenceTier) =>
          encodeHookPulseToRaw(
            HookPulseV1.make({
              ...decoded[0],
              evidenceTier,
            })
          ),
        { concurrency: 1 }
      );

      expect(A.map(decoded, (record) => record.evidenceTier)).toEqual(expectedTiers);
      expect(A.map(encoded, (record) => record.evidenceTier)).toEqual(expectedTiers);
    })
  );

  it.effect(
    "round-trips all nine hook events and all three observed wait classes after derivation",
    Effect.fn("HookPulseTest.roundTripsDerivedEvents")(function* () {
      const fixtures = [
        autoApprovedPreToolUse,
        approvedToolPermissionRequest,
        autoApprovedPostToolUse,
        postToolUseFailure,
        idleNotification,
        userPromptSubmit,
        stop,
        sessionEnd,
        permissionDenied,
        approvedPlanPermissionRequest,
      ];
      const derived = yield* Effect.forEach(fixtures, (fixture) => decodeHookPulseFromRaw(fixture), {
        concurrency: 1,
      });
      const encoded = yield* Effect.forEach(derived, (record) => encodeHookPulse(record), { concurrency: 1 });
      const roundTripped = yield* Effect.forEach(encoded, (record) => decodeHookPulse(record), { concurrency: 1 });
      const reencoded = yield* Effect.forEach(roundTripped, (record) => encodeHookPulse(record), { concurrency: 1 });

      expect(reencoded).toEqual(encoded);
      expect(A.map(roundTripped, (record) => record.hookEvent)).toEqual([
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PostToolUseFailure",
        "Notification",
        "UserPromptSubmit",
        "Stop",
        "SessionEnd",
        "PermissionDenied",
        "PermissionRequest",
      ]);
      // Every member of `HookPulseEvent` survives derivation and both round-trip
      // hops; a member added to the literal domain without a fixture here would
      // otherwise ride along untested.
      expect(A.dedupe(A.map(roundTripped, (record) => record.hookEvent)).length).toBe(HookPulseEvent.Options.length);
      expect(A.map(roundTripped, (record) => record.waitReason)).toEqual([
        "none",
        "tool-permission",
        "none",
        "none",
        "idle-input",
        "none",
        "none",
        "none",
        "none",
        "plan-approval",
      ]);
    })
  );

  it.effect(
    "preserves an unrecognized Notification as an existing unknown wait record",
    Effect.fn("HookPulseTest.preservesUnknownRawNotification")(function* () {
      const decoded = yield* decodeHookPulseFromRaw(
        rawInput("2026-08-01T06:50:00.000Z", {
          hook_event_name: HookPulseEvent.Enum.Notification,
          notification_type: "future_notification_shape",
          message: "A future harness message with no recognized pattern",
        })
      );

      expect(decoded).toBeInstanceOf(HookPulseV1);
      expect(decoded.hookEvent).toBe("Notification");
      expect(decoded.waitReason).toBe("unknown");
      expect(decoded.notificationType).toEqual(O.none());
      expect(decoded).not.toHaveProperty("message");
    })
  );

  it.effect(
    "makes content and permission suggestions unrepresentable at both layers",
    Effect.fn("HookPulseTest.stripsRawContentFields")(function* () {
      const contentBearingRawInput = rawInput("2026-08-01T06:51:00.000Z", {
        hook_event_name: HookPulseEvent.Enum.PermissionRequest,
        tool_name: "Bash",
        permission_suggestions: [{ command: "privacy-probe-suggestion" }],
        message: "privacy-probe-message",
        prompt: "privacy-probe-prompt",
        tool_input: { command: "privacy-probe-command" },
        tool_response: { output: "privacy-probe-result" },
        last_assistant_message: "privacy-probe-assistant-message",
      });
      const rawEvent = yield* decodeRawHookPulse(contentBearingRawInput.event);
      const canonical = yield* decodeHookPulseFromRaw(contentBearingRawInput);

      expect(rawEvent).not.toHaveProperty("permission_suggestions");
      expect(rawEvent).not.toHaveProperty("message");
      expect(rawEvent).not.toHaveProperty("prompt");
      expect(rawEvent).not.toHaveProperty("tool_input");
      expect(rawEvent).not.toHaveProperty("tool_response");
      expect(rawEvent).not.toHaveProperty("last_assistant_message");
      expect(canonical.waitReason).toBe("tool-permission");
      expect(canonical).not.toHaveProperty("permission_suggestions");
      expect(canonical).not.toHaveProperty("message");
      expect(canonical).not.toHaveProperty("prompt");
      expect(canonical).not.toHaveProperty("tool_input");
      expect(canonical).not.toHaveProperty("tool_response");
      expect(canonical).not.toHaveProperty("last_assistant_message");
    })
  );
});
