/**
 * Round-trip + decision smoke tests for the remaining 8 Tier-1 hook
 * events beyond PreToolUse. Each event gets: one valid-decode test,
 * one decision-helper test, and one runner end-to-end test.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import * as Notification from "../../../../claudecode/Hook/Events/Notification.ts";
import * as PostToolUse from "../../../../claudecode/Hook/Events/PostToolUse.ts";
import * as PreCompact from "../../../../claudecode/Hook/Events/PreCompact.ts";
import * as SessionEnd from "../../../../claudecode/Hook/Events/SessionEnd.ts";
import * as SessionStart from "../../../../claudecode/Hook/Events/SessionStart.ts";
import * as Stop from "../../../../claudecode/Hook/Events/Stop.ts";
import * as SubagentStop from "../../../../claudecode/Hook/Events/SubagentStop.ts";
import * as UserPromptSubmit from "../../../../claudecode/Hook/Events/UserPromptSubmit.ts";
import * as Testing from "../../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Shared envelope
// ---------------------------------------------------------------------------

const envelope = {
  session_id: "test-session",
  transcript_path: "/tmp/t.jsonl",
  cwd: "/tmp/ws",
  permission_mode: "default",
} as const;

const encodeJson = S.encodeSync(S.fromJsonString(S.Unknown));

// ---------------------------------------------------------------------------
// PostToolUse
// ---------------------------------------------------------------------------

describe("Hook.PostToolUse", () => {
  it.effect("decodes and encodes via runner", () =>
    Effect.gen(function* () {
      const hook = PostToolUse.define({
        handler: () => Effect.succeed(PostToolUse.addContext("logged")),
      });
      const json = encodeJson({
        ...envelope,
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        tool_input: { file_path: "/tmp/a" },
        tool_response: { content: "hello" },
        tool_use_id: "call-1",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "logged",
        },
      });
    })
  );

  it('block() produces decision: "block"', () => {
    const out = PostToolUse.block("unsafe");
    expect(out.decision).toEqual(O.some("block"));
    expect(out.reason).toEqual(O.some("unsafe"));
  });
});

// ---------------------------------------------------------------------------
// UserPromptSubmit
// ---------------------------------------------------------------------------

describe("Hook.UserPromptSubmit", () => {
  it.effect("decodes via runner and adds context", () =>
    Effect.gen(function* () {
      const hook = UserPromptSubmit.define({
        handler: () => Effect.succeed(UserPromptSubmit.addContext("Current time: noon")),
      });
      const json = encodeJson({
        ...envelope,
        hook_event_name: "UserPromptSubmit",
        prompt: "what time is it?",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: "Current time: noon",
        },
      });
    })
  );

  it("block(reason) erases prompt with reason", () => {
    const out = UserPromptSubmit.block("off-topic");
    expect(out.decision).toEqual(O.some("block"));
    expect(out.reason).toEqual(O.some("off-topic"));
  });

  it("renameSession sets sessionTitle", () => {
    const out = UserPromptSubmit.renameSession("New title");
    expect(O.getOrThrow(out.hookSpecificOutput).sessionTitle).toEqual(O.some("New title"));
  });
});

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

describe("Hook.Notification", () => {
  it.effect("decodes via runner and passes through", () =>
    Effect.gen(function* () {
      const hook = Notification.define({
        handler: () => Effect.succeed(Notification.passthrough()),
      });
      const json = encodeJson({
        ...envelope,
        hook_event_name: "Notification",
        message: "Permission needed",
        notification_type: "permission_prompt",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );

  it("rejects an unknown notification_type", () => {
    expect(() =>
      S.decodeUnknownSync(Notification.Input)({
        ...envelope,
        hook_event_name: "Notification",
        message: "hi",
        notification_type: "unknown",
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Stop
// ---------------------------------------------------------------------------

describe("Hook.Stop", () => {
  it.effect("decodes via runner and blocks to continue", () =>
    Effect.gen(function* () {
      const hook = Stop.define({
        handler: () => Effect.succeed(Stop.block("keep going")),
      });
      const json = encodeJson({
        ...envelope,
        hook_event_name: "Stop",
        stop_hook_active: false,
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        decision: "block",
        reason: "keep going",
      });
    })
  );
});

// ---------------------------------------------------------------------------
// SubagentStop
// ---------------------------------------------------------------------------

describe("Hook.SubagentStop", () => {
  it.effect("decodes via runner and passes through", () =>
    Effect.gen(function* () {
      const hook = SubagentStop.define({
        handler: () => Effect.succeed(SubagentStop.allowStop()),
      });
      const json = encodeJson({
        ...envelope,
        hook_event_name: "SubagentStop",
        stop_hook_active: false,
        agent_id: "agent-1",
        agent_type: "Explore",
        agent_transcript_path: "/tmp/agent.jsonl",
        last_assistant_message: "done",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// SessionStart
// ---------------------------------------------------------------------------

describe("Hook.SessionStart", () => {
  it.effect("decodes via runner (no permission_mode) and injects context", () =>
    Effect.gen(function* () {
      const hook = SessionStart.define({
        handler: () => Effect.succeed(SessionStart.addContext("Project uses Effect v4")),
      });
      const json = encodeJson({
        session_id: "test-session",
        transcript_path: "/tmp/t.jsonl",
        cwd: "/tmp/ws",
        hook_event_name: "SessionStart",
        source: "startup",
        model: "claude-opus-4-6",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: "Project uses Effect v4",
        },
      });
    })
  );

  it.effect("rejects an unknown source", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        S.decodeUnknownEffect(SessionStart.Input)({
          session_id: "x",
          transcript_path: "/tmp/t",
          cwd: "/tmp",
          hook_event_name: "SessionStart",
          source: "nonsense",
        })
      );
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// SessionEnd
// ---------------------------------------------------------------------------

describe("Hook.SessionEnd", () => {
  it.effect("decodes via runner and passes through", () =>
    Effect.gen(function* () {
      const hook = SessionEnd.define({
        handler: () => Effect.succeed(SessionEnd.passthrough()),
      });
      const json = encodeJson({
        session_id: "test-session",
        transcript_path: "/tmp/t.jsonl",
        cwd: "/tmp/ws",
        hook_event_name: "SessionEnd",
        reason: "logout",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// PreCompact
// ---------------------------------------------------------------------------

describe("Hook.PreCompact", () => {
  it.effect("decodes via runner for auto trigger", () =>
    Effect.gen(function* () {
      const hook = PreCompact.define({
        handler: () => Effect.succeed(PreCompact.passthrough()),
      });
      const json = encodeJson({
        session_id: "test-session",
        transcript_path: "/tmp/t.jsonl",
        cwd: "/tmp/ws",
        hook_event_name: "PreCompact",
        trigger: "auto",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});
