/**
 * Tests for matcher-aware hook constructors.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import * as Elicitation from "../../../../claudecode/Hook/Events/Elicitation.ts";
import * as FileChanged from "../../../../claudecode/Hook/Events/FileChanged.ts";
import * as Notification from "../../../../claudecode/Hook/Events/Notification.ts";
import * as PermissionRequest from "../../../../claudecode/Hook/Events/PermissionRequest.ts";
import * as PreToolUse from "../../../../claudecode/Hook/Events/PreToolUse.ts";
import * as Testing from "../../../../claudecode/Testing.ts";

const encodeJson = S.encodeSync(S.fromJsonString(S.Unknown));

const notificationJson = (notificationType: string) =>
  encodeJson({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "Notification",
    message: "Heads up",
    notification_type: notificationType,
  });

const fileChangedJson = (filePath: string) =>
  encodeJson({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "FileChanged",
    file_path: filePath,
    event: "change",
  });

const permissionRequestJson = (toolName: string) =>
  encodeJson({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "PermissionRequest",
    permission_mode: "default",
    tool_name: toolName,
    tool_input: { command: "ls -la" },
  });

const elicitationJson = (serverName: string) =>
  encodeJson({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "Elicitation",
    mcp_server_name: serverName,
    message: "Please authenticate",
    mode: "form",
  });

const preToolUseJson = (toolName: string) =>
  encodeJson({
    session_id: "session-1",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "PreToolUse",
    permission_mode: "default",
    tool_name: toolName,
    tool_input: { file_path: "/tmp/a.ts" },
    tool_use_id: "call-1",
  });

describe("matcher-aware constructors", () => {
  it.effect("Notification.onMatcher runs the handler for matching values", () =>
    Effect.gen(function* () {
      const hook = Notification.onMatcher({
        matcher: "permission_prompt|idle_prompt",
        handler: () =>
          Effect.succeed(
            Notification.Output.make({
              systemMessage: O.some("matched notification"),
            })
          ),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, notificationJson("permission_prompt"));

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        systemMessage: "matched notification",
      });
    })
  );

  it.effect("FileChanged.onMatcher matches against the file basename", () =>
    Effect.gen(function* () {
      const hook = FileChanged.onMatcher({
        matcher: "package\\.json",
        handler: () => Effect.succeed(FileChanged.passthrough()),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, fileChangedJson("/tmp/ws/packages/app/package.json"));

      expect(result.exitCode).toBe(0);
      expect(result.output).toEqual({});
    })
  );

  it.effect("PermissionRequest.onMatcher leaves non-matching inputs untouched", () =>
    Effect.gen(function* () {
      const hook = PermissionRequest.onMatcher({
        matcher: "^Read$",
        handler: () => Effect.succeed(PermissionRequest.deny("should not run")),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, permissionRequestJson("Bash"));

      expect(result.exitCode).toBe(0);
      expect(result.output).toEqual({});
    })
  );

  it.effect("Elicitation.onMatcher runs the handler for matching MCP servers", () =>
    Effect.gen(function* () {
      const hook = Elicitation.onMatcher({
        matcher: "memory|filesystem",
        handler: () => Effect.succeed(Elicitation.cancel()),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, elicitationJson("memory"));

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          action: "cancel",
        },
      });
    })
  );

  it.effect("PreToolUse.onMatcher defaults non-matching tools to passthrough()", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.onMatcher({
        matcher: "Bash|Read",
        handler: () => Effect.succeed(PreToolUse.deny("should not run")),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, preToolUseJson("Edit"));

      expect(result.exitCode).toBe(0);
      expect(result.output).toEqual({});
    })
  );
});
