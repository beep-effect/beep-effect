/**
 * Tests for typed hook tool adapters.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import * as PostToolUse from "../../../claudecode/Hook/Events/PostToolUse.ts";
import * as PreToolUse from "../../../claudecode/Hook/Events/PreToolUse.ts";
import * as Tool from "../../../claudecode/Hook/Tool.ts";
import * as Testing from "../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePreToolUseJson = (toolName: string, toolInput: Record<string, unknown>) =>
  JSON.stringify({
    session_id: "test-session",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "PreToolUse",
    permission_mode: "default",
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: "call-1",
  });

const makePostToolUseJson = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResponse: Record<string, unknown>
) =>
  JSON.stringify({
    session_id: "test-session",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "PostToolUse",
    permission_mode: "default",
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
    tool_use_id: "call-1",
  });

class EditToolInput extends S.Class<EditToolInput>("EditToolInput")({
  file_path: S.String,
  old_string: S.String,
  new_string: S.String,
}) {}

class EditToolResponse extends S.Class<EditToolResponse>("EditToolResponse")({
  status: S.String,
}) {}

const EditAdapter = Tool.definePostAdapter({
  toolName: "Edit",
  inputSchema: EditToolInput,
  responseSchema: EditToolResponse,
});

// ---------------------------------------------------------------------------
// Decoder helpers
// ---------------------------------------------------------------------------

describe("Hook.Tool decoders", () => {
  it.effect("decodes a Bash PreToolUse payload", () =>
    Effect.gen(function* () {
      const decoded = yield* Tool.decodePreToolUse(
        "Bash",
        PreToolUse.Input.make({
          session_id: "session-1",
          transcript_path: "/tmp/t.jsonl",
          cwd: "/tmp/ws",
          hook_event_name: "PreToolUse",
          permission_mode: O.some("default"),
          tool_name: "Bash",
          tool_input: { command: "ls -la" },
          tool_use_id: O.some("call-1"),
        })
      );

      expect(decoded.tool).toBeInstanceOf(Tool.BashToolInput);
      expect(decoded.tool.command).toBe("ls -la");
    })
  );

  it.effect("decodes a Bash PostToolUse payload with the current response shape", () =>
    Effect.gen(function* () {
      const decoded = yield* Tool.decodePostToolUse(
        "Bash",
        PostToolUse.Input.make({
          session_id: "session-1",
          transcript_path: "/tmp/t.jsonl",
          cwd: "/tmp/ws",
          hook_event_name: "PostToolUse",
          permission_mode: O.some("default"),
          tool_name: "Bash",
          tool_input: {
            command: "npm test",
            description: "Run tests",
            timeout: 120000,
            run_in_background: false,
          },
          tool_response: {
            stdout: "ok\n",
            stderr: "",
            interrupted: false,
            isImage: false,
          },
          tool_use_id: O.some("call-1"),
        })
      );

      expect(decoded.tool.timeout).toEqual(O.some(120000));
      expect(decoded.response.stdout).toEqual(O.some("ok\n"));
      expect(decoded.response.interrupted).toEqual(O.some(false));
    })
  );

  it.effect("decodes a Read PostToolUse payload", () =>
    Effect.gen(function* () {
      const decoded = yield* Tool.decodePostToolUse(
        "Read",
        PostToolUse.Input.make({
          session_id: "session-1",
          transcript_path: "/tmp/t.jsonl",
          cwd: "/tmp/ws",
          hook_event_name: "PostToolUse",
          permission_mode: O.some("default"),
          tool_name: "Read",
          tool_input: { file_path: "/tmp/a.ts" },
          tool_response: { content: "hello" },
          tool_use_id: O.some("call-1"),
        })
      );

      expect(decoded.tool).toBeInstanceOf(Tool.ReadToolInput);
      expect(decoded.response).toBeInstanceOf(Tool.ReadToolResponse);
      expect(decoded.tool.file_path).toBe("/tmp/a.ts");
      expect(decoded.response.content).toEqual(O.some("hello"));
    })
  );

  it.effect("decodes a custom post-tool adapter payload", () =>
    Effect.gen(function* () {
      const decoded = yield* Tool.decodePostToolUseWith(
        EditAdapter,
        PostToolUse.Input.make({
          session_id: "session-1",
          transcript_path: "/tmp/t.jsonl",
          cwd: "/tmp/ws",
          hook_event_name: "PostToolUse",
          permission_mode: O.some("default"),
          tool_name: "Edit",
          tool_input: {
            file_path: "/tmp/a.ts",
            old_string: "before",
            new_string: "after",
          },
          tool_response: { status: "ok" },
          tool_use_id: O.some("call-1"),
        })
      );

      expect(decoded.tool).toBeInstanceOf(EditToolInput);
      expect(decoded.response).toBeInstanceOf(EditToolResponse);
      expect(decoded.tool.new_string).toBe("after");
      expect(decoded.response.status).toBe("ok");
    })
  );

  it.effect("fails when a pre-tool decoder is asked for the wrong tool name", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Tool.decodePreToolUse(
          "Bash",
          PreToolUse.Input.make({
            session_id: "session-1",
            transcript_path: "/tmp/t.jsonl",
            cwd: "/tmp/ws",
            hook_event_name: "PreToolUse",
            permission_mode: O.some("default"),
            tool_name: "Read",
            tool_input: { file_path: "/tmp/a.ts" },
            tool_use_id: O.some("call-1"),
          })
        )
      );

      expect(error).toMatchObject({
        _tag: "HookToolDecodeError",
        toolName: "Bash",
        payload: "tool_name",
      });
    })
  );

  it.effect("fails when a post-tool decoder is asked for the wrong tool name", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        Tool.decodePostToolUse(
          "Read",
          PostToolUse.Input.make({
            session_id: "session-1",
            transcript_path: "/tmp/t.jsonl",
            cwd: "/tmp/ws",
            hook_event_name: "PostToolUse",
            permission_mode: O.some("default"),
            tool_name: "Bash",
            tool_input: { command: "ls -la" },
            tool_response: {
              stdout: "ok",
              stderr: "",
              interrupted: false,
              isImage: false,
            },
            tool_use_id: O.some("call-1"),
          })
        )
      );

      expect(error).toMatchObject({
        _tag: "HookToolDecodeError",
        toolName: "Read",
        payload: "tool_name",
      });
    })
  );
});

// ---------------------------------------------------------------------------
// onTool helpers
// ---------------------------------------------------------------------------

describe("Hook.PreToolUse.onTool", () => {
  it.effect("invokes the typed Bash handler for matching tool names", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.onTool({
        toolName: "Bash",
        handler: ({ tool }) =>
          Effect.succeed(
            tool.command.includes("rm -rf /") ? PreToolUse.deny("destructive command") : PreToolUse.allow()
          ),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, makePreToolUseJson("Bash", { command: "rm -rf /" }));

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "destructive command",
        },
      });
    })
  );

  it.effect("defaults to passthrough() when the tool name does not match", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.onTool({
        toolName: "Bash",
        handler: ({ tool }) => Effect.succeed(PreToolUse.deny(tool.command)),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, makePreToolUseJson("Read", { file_path: "/tmp/a.ts" }));

      expect(result.exitCode).toBe(0);
      expect(result.output).toEqual({});
    })
  );

  it.effect("invokes the typed WebSearch handler for matching tool names", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.onTool({
        toolName: "WebSearch",
        handler: ({ tool }) => Effect.succeed(PreToolUse.deny(`search blocked: ${tool.query}`)),
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makePreToolUseJson("WebSearch", {
          query: "react hooks",
          allowed_domains: ["react.dev"],
        })
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "search blocked: react hooks",
        },
      });
    })
  );

  it.effect("invokes a custom adapter handler for matching tool names", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.onAdapter({
        adapter: EditAdapter,
        handler: ({ tool }) =>
          Effect.succeed(
            tool.file_path.endsWith(".ts") ? PreToolUse.deny("typed Edit adapter matched") : PreToolUse.allow()
          ),
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makePreToolUseJson("Edit", {
          file_path: "/tmp/a.ts",
          old_string: "before",
          new_string: "after",
        })
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          permissionDecision: "deny",
          permissionDecisionReason: "typed Edit adapter matched",
        },
      });
    })
  );
});

describe("Hook.PostToolUse.onTool", () => {
  it.effect("invokes the typed Read handler for matching tool names", () =>
    Effect.gen(function* () {
      const hook = PostToolUse.onTool({
        toolName: "Read",
        handler: ({ tool, response }) => {
          const content = response.content.pipe(O.getOrElse(() => ""));
          return Effect.succeed(
            content.length > 0
              ? PostToolUse.addContext(`Read ${tool.file_path} (${content.length} chars)`)
              : PostToolUse.passthrough()
          );
        },
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makePostToolUseJson("Read", { file_path: "/tmp/a.ts" }, { content: "hello" })
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          additionalContext: "Read /tmp/a.ts (5 chars)",
        },
      });
    })
  );

  it.effect("can recover from decode errors with onDecodeError", () =>
    Effect.gen(function* () {
      const hook = PostToolUse.onTool({
        toolName: "Read",
        handler: () => Effect.succeed(PostToolUse.passthrough()),
        onDecodeError: () => Effect.succeed(PostToolUse.block("invalid Read payload")),
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makePostToolUseJson("Read", { file_path: 42 }, { content: "hello" })
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        decision: "block",
        reason: "invalid Read payload",
      });
    })
  );

  it.effect("invokes a custom adapter handler for matching tool names", () =>
    Effect.gen(function* () {
      const hook = PostToolUse.onAdapter({
        adapter: EditAdapter,
        handler: ({ tool, response }) => Effect.succeed(PostToolUse.addContext(`${tool.file_path}:${response.status}`)),
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makePostToolUseJson(
          "Edit",
          {
            file_path: "/tmp/a.ts",
            old_string: "before",
            new_string: "after",
          },
          { status: "ok" }
        )
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          additionalContext: "/tmp/a.ts:ok",
        },
      });
    })
  );
});
