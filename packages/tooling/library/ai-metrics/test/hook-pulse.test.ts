import {
  HookPulseAgentKind,
  HookPulseDisarmSentinel,
  HookPulseDisarmWindow,
  HookPulseEvent,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseNotificationType,
  HookPulseRawEvent,
  HookPulseV1,
  HookPulseV1FromLegacyRecord,
  HookPulseV1FromRawEvent,
  HookPulseWaitReason,
  hashPrivateIdentifier,
  hookPulseHashSalt,
} from "@beep/repo-ai-metrics";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Result } from "effect";
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

const sessionStart = rawInput("2026-08-01T06:25:00.000Z", {
  hook_event_name: HookPulseEvent.Enum.SessionStart,
  source: "startup",
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

// Every identifier below is already 64 lowercase hex, which is exactly what a
// writer row carries. `privateReference` must pass such a value through
// untouched under any salt; hashing it again would mint a digest no producer can
// reproduce and would silently orphan the whole live corpus.
const alreadyHashedRawEventFixture = {
  session_id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  cwd: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
  transcript_path: "89abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
};

const alreadyHashedRawInput = {
  ...baseRawInputFixture,
  ts: "2026-08-01T09:10:00.000Z",
  event: {
    ...alreadyHashedRawEventFixture,
    hook_event_name: HookPulseEvent.Enum.Stop,
  },
};

// Distinct per rung so a digest can name which variable it came from. Neither is
// a salt any clone would configure, so neither can collide with a real one.
const HOOK_RUNG_SALT = "hook-pulse-codec-hook-rung-salt";
const AI_RUNG_SALT = "hook-pulse-codec-ai-rung-salt";

// The workstation that owns this instrument exports a real operator salt into
// the environment vitest inherits, so a case that read the ambient provider
// would assert one thing here and another in CI — and would print that salt into
// a failure diff. Every case below pins its own provider, cleared cases
// included: `ConfigProvider.fromEnv` snapshots the environment once per process
// and `Context.Reference` memoizes its default, so mutating `process.env` could
// not work even if the repo permitted reading it.
const withSaltEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const decodeRawHookPulse = HookPulseRawEvent.decodeEffect;
const encodeRawHookPulse = HookPulseRawEvent.encodeEffect;
const decodeHookPulseFromRaw = HookPulseV1FromRawEvent.decodeUnknownEffect;
const decodeHookPulseFromLegacy = HookPulseV1FromLegacyRecord.decodeUnknownEffect;
const decodeHookPulse = HookPulseV1.decodeEffect;
const encodeHookPulse = HookPulseV1.encodeEffect;
const encodeHookPulseToRaw = HookPulseV1FromRawEvent.encodeUnknownEffect;
const hookPulseEquivalent = S.toEquivalence(HookPulseV1);
const isHookPulseWaitReason = S.is(HookPulseWaitReason);

describe("HookPulseV1", () => {
  it("round-trips disarm artifacts through their production JSON codecs", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(HookPulseDisarmSentinel)(fc),
        S.toArbitrary(HookPulseDisarmWindow)(fc),
        (sentinel, window) => {
          const sentinelJson = Result.getOrThrow(HookPulseDisarmSentinel.encodeJsonResult(sentinel));
          const windowJson = Result.getOrThrow(HookPulseDisarmWindow.encodeJsonResult(window));

          expect(Result.getOrThrow(HookPulseDisarmSentinel.decodeJsonResult(sentinelJson))).toEqual(sentinel);
          expect(Result.getOrThrow(HookPulseDisarmWindow.decodeJsonResult(windowJson))).toEqual(window);
        }
      ),
      fcRuns(25)
    );
  });

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

      // Pinned to the no-salt rung. Before the codec resolved a salt this test
      // was pinned by construction; now an unpinned decode would mean the
      // developer's environment here and the empty one in CI.
      const decoded = yield* withSaltEnv({}, decodeHookPulseFromLegacy(legacy));
      const serialized = yield* UnknownFromJsonString.encodeUnknownEffect(yield* encodeHookPulse(decoded));

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
    fc.assert(
      fc.property(S.toArbitrary(HookPulseV1)(fc), (value) => {
        const encoded = Result.getOrThrow(HookPulseV1.encodeResult(value));
        const decoded = Result.getOrThrow(HookPulseV1.decodeResult(encoded));

        expect(hookPulseEquivalent(decoded, value)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("round-trips arbitrary encodable canonical values through the raw-event codec", () => {
    // The raw codec requires transcriptPath and intentionally clamps observed evidence to derived.
    const arbitrary = S.toArbitrary(HookPulseV1)(fc)
      .filter((value) => O.isSome(value.transcriptPath))
      .filter((value) => Bool.not(HookPulseEvidenceTier.is.observed(value.evidenceTier)));

    fc.assert(
      fc.property(arbitrary, (value) => {
        const encoded = Result.getOrThrow(HookPulseV1FromRawEvent.encodeResult(value));
        const decoded = Result.getOrThrow(HookPulseV1FromRawEvent.decodeUnknownResult(encoded));

        expect(hookPulseEquivalent(decoded, value)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it.effect("derives a total wait reason for arbitrary raw events", () =>
    Effect.forEach(
      fc.sample(S.toArbitrary(HookPulseRawEvent)(fc), {
        numRuns: 50,
        seed: 804,
      }),
      Effect.fnUntraced(function* (event) {
        const encodedEvent = yield* encodeRawHookPulse(event);
        const decoded = yield* withSaltEnv(
          {},
          decodeHookPulseFromRaw({
            ...baseRawInputFixture,
            ts: "2026-08-01T08:00:00.000Z",
            event: encodedEvent,
          })
        );

        expect(decoded.waitReason).toBeDefined();
        expect(isHookPulseWaitReason(decoded.waitReason)).toBe(true);
      }),
      { discard: true }
    )
  );

  it.effect("pseudonymizes raw session and filesystem identifiers", () =>
    Effect.gen(function* () {
      const decoded = yield* withSaltEnv(
        {},
        decodeHookPulseFromRaw(
          rawInput("2026-08-01T08:00:00.000Z", {
            hook_event_name: HookPulseEvent.Enum.Stop,
          })
        )
      );
      const encoded = yield* encodeHookPulse(decoded);
      const serialized = yield* UnknownFromJsonString.encodeUnknownEffect(encoded);

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
        (evidenceTier) =>
          decodeHookPulseFromRaw({
            ...approvedToolPermissionRequest,
            evidenceTier,
          }),
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
    "round-trips all ten hook events and all three observed wait classes after derivation",
    Effect.fn("HookPulseTest.roundTripsDerivedEvents")(function* () {
      const fixtures = [
        sessionStart,
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
        "SessionStart",
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

  it.effect(
    "resolves the hash salt through the writer's precedence",
    Effect.fn("HookPulseTest.resolvesHashSaltPrecedence")(function* () {
      // `.claude/hooks/hook-pulse.sh` reads
      // `${BEEP_HOOK_PULSE_HASH_SALT:-${BEEP_AI_METRICS_HASH_SALT:-}}` and then
      // collapses a blank result. Each row below is one rung of that chain, and
      // the last two are the rows where a shell reading and a trim-first reading
      // could disagree while both looked correct: `""` is absence to `${:-}` and
      // falls through, while `"   "` is a *value* that wins the contest and is
      // only afterwards collapsed by `resolveAiMetricsHashSaltValue`.
      const cases: ReadonlyArray<{
        readonly env: Record<string, string>;
        readonly expectedSalt: string | undefined;
      }> = [
        { env: {}, expectedSalt: undefined },
        {
          env: { BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT },
          expectedSalt: AI_RUNG_SALT,
        },
        {
          env: { BEEP_HOOK_PULSE_HASH_SALT: HOOK_RUNG_SALT },
          expectedSalt: HOOK_RUNG_SALT,
        },
        {
          env: {
            BEEP_HOOK_PULSE_HASH_SALT: HOOK_RUNG_SALT,
            BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT,
          },
          expectedSalt: HOOK_RUNG_SALT,
        },
        {
          env: {
            BEEP_HOOK_PULSE_HASH_SALT: "",
            BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT,
          },
          expectedSalt: AI_RUNG_SALT,
        },
        {
          env: {
            BEEP_HOOK_PULSE_HASH_SALT: "   ",
            BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT,
          },
          expectedSalt: "   ",
        },
      ];
      // Compared as digests of a fixed probe, never as salts. A `withSaltEnv`
      // that ever stopped providing its literal record would resolve this
      // workstation's real operator salt, and a value assertion would then print
      // it into the failure diff and into CI logs. A digest pins the same six
      // rungs and can only ever print a truncated digest.
      const probe = "hook-pulse-salt-precedence-probe";
      const resolved = yield* Effect.forEach(
        cases,
        ({ env }) =>
          withSaltEnv(
            env,
            Effect.flatMap(hookPulseHashSalt, (hashSalt) => hashPrivateIdentifier(probe, hashSalt))
          ),
        { concurrency: 1 }
      );
      const expected = yield* Effect.forEach(
        cases,
        ({ expectedSalt }) => hashPrivateIdentifier(probe, O.fromUndefinedOr(expectedSalt)),
        { concurrency: 1 }
      );

      expect(resolved).toEqual(expected);
      // The rungs are genuinely distinguishable: without this a codec that
      // returned one constant digest for every environment would satisfy the
      // equality above.
      expect(A.dedupe(resolved).length).toBe(3);
    })
  );

  it.effect(
    "hashes codec identifiers with the resolved salt, not the library default",
    Effect.fn("HookPulseTest.hashesWithResolvedSalt")(function* () {
      const decoded = yield* withSaltEnv(
        { BEEP_HOOK_PULSE_HASH_SALT: HOOK_RUNG_SALT },
        decodeHookPulseFromRaw(
          rawInput("2026-08-01T09:00:00.000Z", {
            hook_event_name: HookPulseEvent.Enum.Stop,
          })
        )
      );

      expect(decoded.sessionId).toBe(
        yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.some(HOOK_RUNG_SALT))
      );
      expect(decoded.cwd).toBe(yield* hashPrivateIdentifier(baseRawEventFixture.cwd, O.some(HOOK_RUNG_SALT)));
      expect(decoded.transcriptPath).toEqual(
        O.some(yield* hashPrivateIdentifier(baseRawEventFixture.transcript_path, O.some(HOOK_RUNG_SALT)))
      );
      // Non-vacuity: every shape assertion elsewhere in this file is satisfied
      // by a codec that ignored the salt entirely, because the library default
      // is what such a codec would have used anyway.
      expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.none()));
    })
  );

  it.effect(
    "reads the ai-metrics rung when the hook-pulse rung is unset",
    Effect.fn("HookPulseTest.readsAiMetricsSaltRung")(function* () {
      // The second rung is what keeps hook rows in the same pseudonym namespace
      // as every other ai-metrics producer on a machine that exports one salt.
      const decoded = yield* withSaltEnv(
        { BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT },
        decodeHookPulseFromRaw(
          rawInput("2026-08-01T09:01:00.000Z", {
            hook_event_name: HookPulseEvent.Enum.Stop,
          })
        )
      );

      expect(decoded.sessionId).toBe(
        yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.some(AI_RUNG_SALT))
      );
      expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.none()));
    })
  );

  it.effect(
    "falls back to the library default when neither salt is configured",
    Effect.fn("HookPulseTest.fallsBackToLibraryDefaultSalt")(function* () {
      // The CI rung, and the backward-compatibility rung: an unconfigured clone
      // must keep producing byte-identical digests to the committed conformance
      // corpus and to every pre-cutover row.
      const decoded = yield* withSaltEnv(
        {},
        decodeHookPulseFromRaw(
          rawInput("2026-08-01T09:02:00.000Z", {
            hook_event_name: HookPulseEvent.Enum.Stop,
          })
        )
      );

      expect(decoded.sessionId).toBe(yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.none()));
      expect(decoded.cwd).toBe(yield* hashPrivateIdentifier(baseRawEventFixture.cwd, O.none()));
      expect(decoded.transcriptPath).toEqual(
        O.some(yield* hashPrivateIdentifier(baseRawEventFixture.transcript_path, O.none()))
      );
    })
  );

  it.effect(
    "collapses a whitespace-only salt to the insecure default, exactly as the writer does",
    Effect.fn("HookPulseTest.collapsesWhitespaceOnlySalt")(function* () {
      // The writer's own `case "${hash_salt}" in *[![:space:]]*)` arm, restated
      // as a digest. `hook-pulse-writer.test.ts` pins the shell half of this
      // same input.
      const decoded = yield* withSaltEnv(
        { BEEP_HOOK_PULSE_HASH_SALT: "   " },
        decodeHookPulseFromRaw(
          rawInput("2026-08-01T09:03:00.000Z", {
            hook_event_name: HookPulseEvent.Enum.Stop,
          })
        )
      );

      expect(decoded.sessionId).toBe(yield* hashPrivateIdentifier(baseRawEventFixture.session_id, O.none()));
      expect(decoded.cwd).toBe(yield* hashPrivateIdentifier(baseRawEventFixture.cwd, O.none()));
    })
  );

  it.effect(
    "migrates legacy rows under the resolved salt",
    Effect.fn("HookPulseTest.migratesLegacyRowsUnderResolvedSalt")(function* () {
      // The legacy codec reads pre-pseudonymization rows, which are older than
      // the operator cutover. Migrating them under the resolved salt is what
      // puts a migrated row in the same namespace as its live siblings.
      const legacy = {
        schemaVersion: "hook-pulse/v1",
        ts: "2026-08-01T09:04:00.000Z",
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
      const decoded = yield* withSaltEnv(
        { BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT },
        decodeHookPulseFromLegacy(legacy)
      );

      expect(decoded.sessionId).toBe(yield* hashPrivateIdentifier(legacy.sessionId, O.some(AI_RUNG_SALT)));
      expect(decoded.cwd).toBe(yield* hashPrivateIdentifier(legacy.cwd, O.some(AI_RUNG_SALT)));
      expect(decoded.transcriptPath).toEqual(
        O.some(yield* hashPrivateIdentifier(legacy.transcriptPath, O.some(AI_RUNG_SALT)))
      );
      expect(decoded.sessionId).not.toBe(yield* hashPrivateIdentifier(legacy.sessionId, O.none()));
    })
  );

  it.effect(
    "leaves an already-hashed identifier untouched under any salt",
    Effect.fn("HookPulseTest.passesThroughHashedIdentifiers")(function* () {
      // Why the live ledger is unaffected by any of the above: a writer row
      // arrives already 64-hex and takes the pass-through branch, so no salt can
      // double-hash it into a digest neither half can reproduce.
      const decoded = yield* Effect.all(
        {
          hookRung: withSaltEnv(
            { BEEP_HOOK_PULSE_HASH_SALT: HOOK_RUNG_SALT },
            decodeHookPulseFromRaw(alreadyHashedRawInput)
          ),
          aiRung: withSaltEnv(
            { BEEP_AI_METRICS_HASH_SALT: AI_RUNG_SALT },
            decodeHookPulseFromRaw(alreadyHashedRawInput)
          ),
          unsalted: withSaltEnv({}, decodeHookPulseFromRaw(alreadyHashedRawInput)),
        },
        { concurrency: 1 }
      );

      expect(A.map([decoded.hookRung, decoded.aiRung, decoded.unsalted], (row) => row.sessionId)).toEqual(
        A.replicate(alreadyHashedRawEventFixture.session_id, 3)
      );
      expect(A.map([decoded.hookRung, decoded.aiRung, decoded.unsalted], (row) => row.cwd)).toEqual(
        A.replicate(alreadyHashedRawEventFixture.cwd, 3)
      );
      expect(A.map([decoded.hookRung, decoded.aiRung, decoded.unsalted], (row) => row.transcriptPath)).toEqual(
        A.replicate(O.some(alreadyHashedRawEventFixture.transcript_path), 3)
      );
    })
  );

  it("decodes an already-hashed raw event synchronously", () => {
    // The Result adapter proves the already-hashed fast path stays synchronous.
    const decoded = Result.getOrThrow(HookPulseV1FromRawEvent.decodeUnknownResult(alreadyHashedRawInput));

    expect(decoded).toBeInstanceOf(HookPulseV1);
    expect(decoded.sessionId).toBe(alreadyHashedRawEventFixture.session_id);
  });
});
