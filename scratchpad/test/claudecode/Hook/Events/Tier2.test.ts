/**
 * Round-trip + decision smoke tests for the 10 Tier-2 hook events.
 *
 * @since 0.1.0
 */
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

import * as ConfigChange from "../../../../claudecode/Hook/Events/ConfigChange.ts";
import * as CwdChanged from "../../../../claudecode/Hook/Events/CwdChanged.ts";
import * as FileChanged from "../../../../claudecode/Hook/Events/FileChanged.ts";
import * as InstructionsLoaded from "../../../../claudecode/Hook/Events/InstructionsLoaded.ts";
import * as PermissionDenied from "../../../../claudecode/Hook/Events/PermissionDenied.ts";
import * as PermissionRequest from "../../../../claudecode/Hook/Events/PermissionRequest.ts";
import * as PostCompact from "../../../../claudecode/Hook/Events/PostCompact.ts";
import * as PostToolUseFailure from "../../../../claudecode/Hook/Events/PostToolUseFailure.ts";
import * as StopFailure from "../../../../claudecode/Hook/Events/StopFailure.ts";
import * as SubagentStart from "../../../../claudecode/Hook/Events/SubagentStart.ts";
import * as Testing from "../../../../claudecode/Testing.ts";

const baseEnvelope = {
  session_id: "test-session",
  transcript_path: "/tmp/t.jsonl",
  cwd: "/tmp/ws",
} as const;

const envelopeWithMode = {
  ...baseEnvelope,
  permission_mode: "default",
} as const;

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

// ---------------------------------------------------------------------------
// PostCompact
// ---------------------------------------------------------------------------

describe("Hook.PostCompact", () => {
  it.effect("decodes via runner", () =>
    Effect.gen(function* () {
      const hook = PostCompact.define({
        handler: () => Effect.succeed(PostCompact.passthrough()),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "PostCompact",
        trigger: "auto",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// PermissionRequest
// ---------------------------------------------------------------------------

describe("Hook.PermissionRequest", () => {
  it.effect("decodes via runner and allows with rule update", () =>
    Effect.gen(function* () {
      const hook = PermissionRequest.define({
        handler: () =>
          Effect.succeed(
            PermissionRequest.allow({
              updatedInput: { command: "git status" },
            })
          ),
      });
      const json = encodeJson({
        ...envelopeWithMode,
        hook_event_name: "PermissionRequest",
        tool_name: "Bash",
        tool_input: { command: "git status" },
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PermissionRequest",
          decision: { behavior: "allow" },
        },
      });
    })
  );

  it("deny() includes a message", () => {
    const out = PermissionRequest.deny("unsafe path");
    const decision = O.getOrThrow(out.hookSpecificOutput).decision;
    expect(decision.behavior).toBe("deny");
    expect(decision.message).toEqual(O.some("unsafe path"));
  });
});

// ---------------------------------------------------------------------------
// PermissionDenied
// ---------------------------------------------------------------------------

describe("Hook.PermissionDenied", () => {
  it.effect("retry() signals model may try again", () =>
    Effect.gen(function* () {
      const hook = PermissionDenied.define({
        handler: () => Effect.succeed(PermissionDenied.retry()),
      });
      const json = encodeJson({
        ...envelopeWithMode,
        hook_event_name: "PermissionDenied",
        tool_name: "Bash",
        tool_input: { command: "rm file" },
        reason: "auto-classifier blocked",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: { retry: true },
      });
    })
  );
});

// ---------------------------------------------------------------------------
// PostToolUseFailure
// ---------------------------------------------------------------------------

describe("Hook.PostToolUseFailure", () => {
  it.effect("addContext attaches context to a failed tool call", () =>
    Effect.gen(function* () {
      const hook = PostToolUseFailure.define({
        handler: () => Effect.succeed(PostToolUseFailure.addContext("Try again")),
      });
      const json = encodeJson({
        ...envelopeWithMode,
        hook_event_name: "PostToolUseFailure",
        tool_name: "Bash",
        tool_input: { command: "false" },
        error: "non-zero exit",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: { additionalContext: "Try again" },
      });
    })
  );
});

// ---------------------------------------------------------------------------
// SubagentStart
// ---------------------------------------------------------------------------

describe("Hook.SubagentStart", () => {
  it.effect("addContext injects context for the subagent", () =>
    Effect.gen(function* () {
      const hook = SubagentStart.define({
        handler: () => Effect.succeed(SubagentStart.addContext("preloaded state")),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "SubagentStart",
        agent_id: "a-1",
        agent_type: "Explore",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// ConfigChange
// ---------------------------------------------------------------------------

describe("Hook.ConfigChange", () => {
  it.effect("block() prevents a config change", () =>
    Effect.gen(function* () {
      const hook = ConfigChange.define({
        handler: () => Effect.succeed(ConfigChange.block("locked")),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "ConfigChange",
        source: "project_settings",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        decision: "block",
        reason: "locked",
      });
    })
  );
});

// ---------------------------------------------------------------------------
// InstructionsLoaded
// ---------------------------------------------------------------------------

describe("Hook.InstructionsLoaded", () => {
  it.effect("decodes a full nested-traversal payload", () =>
    Effect.gen(function* () {
      const hook = InstructionsLoaded.define({
        handler: () => Effect.succeed(InstructionsLoaded.passthrough()),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "InstructionsLoaded",
        file_path: "/repo/sub/CLAUDE.md",
        memory_type: "Project",
        load_reason: "nested_traversal",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// StopFailure
// ---------------------------------------------------------------------------

describe("Hook.StopFailure", () => {
  it.effect("decodes rate_limit error type", () =>
    Effect.gen(function* () {
      const hook = StopFailure.define({
        handler: () => Effect.succeed(StopFailure.passthrough()),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "StopFailure",
        error: "rate_limit",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// CwdChanged
// ---------------------------------------------------------------------------

describe("Hook.CwdChanged", () => {
  it.effect("decodes cwd transition payload", () =>
    Effect.gen(function* () {
      const hook = CwdChanged.define({
        handler: () => Effect.succeed(CwdChanged.passthrough()),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "CwdChanged",
        old_cwd: "/tmp/ws",
        new_cwd: "/tmp/ws/src",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// FileChanged
// ---------------------------------------------------------------------------

describe("Hook.FileChanged", () => {
  it.effect("decodes file modification event", () =>
    Effect.gen(function* () {
      const hook = FileChanged.define({
        handler: () => Effect.succeed(FileChanged.passthrough()),
      });
      const json = encodeJson({
        ...baseEnvelope,
        hook_event_name: "FileChanged",
        file_path: "/repo/.env",
        event: "change",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});
