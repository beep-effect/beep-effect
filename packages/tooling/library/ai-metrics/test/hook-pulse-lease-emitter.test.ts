import {
  HookPulseLeaseProjection,
  HookPulseLeaseProjectionInput,
  HookPulseV1,
  projectHookPulseLease,
  transitionSessionLease,
} from "@beep/repo-ai-metrics";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { HookPulseEvent, HookPulseV1 as HookPulseV1Type, SessionLease } from "@beep/repo-ai-metrics";

const sessionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const cwd = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const waitReasonByEvent = (hookEvent: HookPulseEvent, toolName: string | undefined): string => {
  if (hookEvent === "Notification") return "unknown";
  if (hookEvent !== "PermissionRequest") return "none";
  return toolName === "ExitPlanMode" ? "plan-approval" : "tool-permission";
};

const pulse = (
  hookEvent: HookPulseEvent,
  ts: string,
  fields: {
    readonly agentKind?: "claude-code" | "codex-cli";
    readonly cwd?: string;
    readonly sessionId?: string;
    readonly toolName?: string;
    readonly toolUseId?: string;
    readonly durationMs?: number;
  } = {}
) =>
  HookPulseV1.decodeEffect({
    schemaVersion: "hook-pulse/v1",
    ts,
    sessionId: fields.sessionId ?? sessionId,
    agentKind: fields.agentKind ?? "claude-code",
    hookEvent,
    cwd: fields.cwd ?? cwd,
    notifierRev: "desktop-ntfy-1",
    instrumentClass: "production",
    evidenceTier: "derived",
    waitReason: waitReasonByEvent(hookEvent, fields.toolName),
    ...(fields.toolName === undefined ? {} : { toolName: fields.toolName }),
    ...(fields.toolUseId === undefined ? {} : { toolUseId: fields.toolUseId }),
    ...(fields.durationMs === undefined ? {} : { durationMs: fields.durationMs }),
  });

const claudeClosedWaitRows = Effect.all(
  [
    pulse("SessionStart", "2026-09-03T12:00:00.000Z"),
    pulse("PreToolUse", "2026-09-03T12:01:00.000Z", { toolName: "Bash", toolUseId: "tool-1" }),
    pulse("PermissionRequest", "2026-09-03T12:01:00.000Z", { toolName: "Bash" }),
    pulse("Notification", "2026-09-03T12:01:06.000Z"),
    pulse("PostToolUse", "2026-09-03T12:02:00.000Z", {
      toolName: "Bash",
      toolUseId: "tool-1",
      durationMs: 11_000,
    }),
    pulse("SessionEnd", "2026-09-03T12:03:00.000Z"),
  ],
  { concurrency: 1 }
);

const project = (rows: A.NonEmptyReadonlyArray<HookPulseV1Type>) =>
  projectHookPulseLease(HookPulseLeaseProjectionInput.make({ rows, oipTaint: "clear" }));

const requireRows = (rows: ReadonlyArray<HookPulseV1Type>) =>
  A.match(rows, {
    onEmpty: () => Effect.die("Expected non-empty hook-pulse rows."),
    onNonEmpty: Effect.succeed,
  });

const requireAccepted = (projection: HookPulseLeaseProjection) =>
  projection.status === "accepted" ? Effect.succeed(projection) : Effect.die(`Unexpected ${projection.reason}`);

it.effect("projects Claude rows into start, renewal, exact wait, and observed-end lease events", () =>
  Effect.gen(function* () {
    const projection = yield* requireAccepted(yield* project(yield* requireRows(yield* claudeClosedWaitRows)));
    const eventKinds = A.map(projection.events, (event) => event.event);
    const opened = projection.events[2];
    const closed = projection.events[4];

    expect(projection.sourceKind).toBe("claude");
    expect(projection.evidenceTier).toBe("derived");
    expect(eventKinds).toEqual(["session-start", "activity", "wait-opened", "activity", "wait-closed", "session-end"]);
    expect(opened?.event).toBe("wait-opened");
    expect(closed?.event).toBe("wait-closed");
    if (opened?.event === "wait-opened" && closed?.event === "wait-closed") {
      expect(closed.waitId).toBe(opened.wait.waitId);
      expect(closed.executionDurationMs).toBe(11_000);
      expect(opened.wait.reason).toBe("tool-permission");
    }
  })
);

it.effect("maps Codex sessions to the same lease schema without claiming Claude provenance", () =>
  Effect.gen(function* () {
    const rows = yield* Effect.all(
      [
        pulse("SessionStart", "2026-09-03T12:00:00.000Z", { agentKind: "codex-cli" }),
        pulse("Stop", "2026-09-03T12:00:01.000Z", { agentKind: "codex-cli" }),
      ],
      { concurrency: 1 }
    );
    const projection = yield* requireAccepted(yield* project(yield* requireRows(rows)));

    expect(projection.sourceKind).toBe("codex");
    expect(A.map(projection.events, (event) => event.event)).toEqual(["session-start", "activity"]);
  })
);

it.effect("keeps an unmatched permission open so expiry reconciliation cannot tombstone a live wait", () =>
  Effect.gen(function* () {
    const rows = yield* Effect.all(
      [
        pulse("SessionStart", "2026-09-03T12:00:00.000Z"),
        pulse("PreToolUse", "2026-09-03T12:01:00.000Z", {
          toolName: "ExitPlanMode",
          toolUseId: "plan-1",
        }),
        pulse("PermissionRequest", "2026-09-03T12:01:00.000Z", { toolName: "ExitPlanMode" }),
        pulse("Notification", "2026-09-03T12:01:06.000Z"),
      ],
      { concurrency: 1 }
    );
    const projection = yield* requireAccepted(yield* project(yield* requireRows(rows)));
    const final = A.reduce(projection.events, O.none<SessionLease>(), (current, event) => {
      const transition = transitionSessionLease(current, event);
      return transition.status === "active" ? O.some(transition.lease) : O.none();
    });
    const lease = yield* O.match(final, {
      onNone: () => Effect.die("Expected an active lease."),
      onSome: Effect.succeed,
    });

    expect(lease.openWaits).toHaveLength(1);
    expect(lease.openWaits[0]?.reason).toBe("plan-approval");
    expect(lease.lastObservedAt).toEqual(rows[3]?.ts);
  })
);

it.effect("quarantines histories with missing starts, mixed identity, or backwards time", () =>
  Effect.gen(function* () {
    const cases = yield* Effect.all(
      [
        Effect.all([pulse("Stop", "2026-09-03T12:00:01.000Z")], { concurrency: 1 }),
        Effect.all(
          [
            pulse("SessionStart", "2026-09-03T12:00:00.000Z"),
            pulse("Stop", "2026-09-03T12:00:01.000Z", {
              cwd: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            }),
          ],
          { concurrency: 1 }
        ),
        Effect.all([pulse("SessionStart", "2026-09-03T12:00:02.000Z"), pulse("Stop", "2026-09-03T12:00:01.000Z")], {
          concurrency: 1,
        }),
      ],
      { concurrency: 1 }
    );
    const projections = yield* Effect.forEach(
      cases,
      Effect.fnUntraced(function* (rows) {
        return yield* project(yield* requireRows(rows));
      }),
      { concurrency: 1 }
    );

    expect(A.map(projections, (projection) => projection.status)).toEqual([
      "quarantined",
      "quarantined",
      "quarantined",
    ]);
    expect(
      A.map(projections, (projection) =>
        projection.status === "quarantined" ? projection.reason : "unexpected-accept"
      )
    ).toEqual(["missing-session-start", "identity-mismatch", "time-regression"]);
  })
);

it.effect("quarantines a PermissionRequest whose two-hop tool attempt is absent", () =>
  Effect.gen(function* () {
    const rows = yield* Effect.all(
      [
        pulse("SessionStart", "2026-09-03T12:00:00.000Z"),
        pulse("PermissionRequest", "2026-09-03T12:01:00.000Z", { toolName: "Bash" }),
      ],
      { concurrency: 1 }
    );
    const projection = yield* project(yield* requireRows(rows));

    expect(projection.status).toBe("quarantined");
    if (projection.status === "quarantined") {
      expect(projection.reason).toBe("permission-attribution-missing");
    }
  })
);

it.effect("is deterministic and round-trips only the bounded projection surface", () =>
  Effect.gen(function* () {
    const rows = yield* requireRows(yield* claudeClosedWaitRows);
    const first = yield* project(rows);
    const second = yield* project(rows);
    const json = yield* HookPulseLeaseProjection.encodeJsonEffect(first);
    const roundTripped = yield* HookPulseLeaseProjection.decodeJsonEffect(json);

    expect(second).toEqual(first);
    expect(roundTripped).toEqual(first);
    expect(json).not.toContain("command");
    expect(json).not.toContain("tool_input");
    expect(json).not.toContain("tool_result");
  })
);
