/**
 * Round-trip + decision smoke tests for the 7 Tier-3 hook events.
 *
 * @since 0.1.0
 */
import { Unknown } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

import * as Elicitation from "../../../../claudecode/Hook/Events/Elicitation.ts";
import * as ElicitationResult from "../../../../claudecode/Hook/Events/ElicitationResult.ts";
import * as TaskCompleted from "../../../../claudecode/Hook/Events/TaskCompleted.ts";
import * as TaskCreated from "../../../../claudecode/Hook/Events/TaskCreated.ts";
import * as TeammateIdle from "../../../../claudecode/Hook/Events/TeammateIdle.ts";
import * as WorktreeCreate from "../../../../claudecode/Hook/Events/WorktreeCreate.ts";
import * as WorktreeRemove from "../../../../claudecode/Hook/Events/WorktreeRemove.ts";
import * as Testing from "../../../../claudecode/Testing.ts";

const base = {
  session_id: "test-session",
  transcript_path: "/tmp/t.jsonl",
  cwd: "/tmp/ws",
} as const;

const baseWithMode = {
  ...base,
  permission_mode: "default",
} as const;

const encodeJson = Unknown.encodeSyncFromJsonString;

// ---------------------------------------------------------------------------
// TaskCreated / TaskCompleted
// ---------------------------------------------------------------------------

describe("Hook.TaskCreated", () => {
  it.effect("block() exits 2 with stderr feedback", () =>
    Effect.gen(function* () {
      const hook = TaskCreated.define({
        handler: () => Effect.succeed(TaskCreated.block("quota exceeded")),
      });
      const json = encodeJson({
        ...baseWithMode,
        hook_event_name: "TaskCreated",
        task_id: "t-1",
        task_subject: "Write tests",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe("quota exceeded");
      expect(result.output).toBeUndefined();
    })
  );
});

describe("Hook.TaskCompleted", () => {
  it.effect("decodes envelope and passes through", () =>
    Effect.gen(function* () {
      const hook = TaskCompleted.define({
        handler: () => Effect.succeed(TaskCompleted.allow()),
      });
      const json = encodeJson({
        ...baseWithMode,
        hook_event_name: "TaskCompleted",
        task_id: "t-2",
        task_subject: "Deploy",
        teammate_name: "Alice",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// TeammateIdle
// ---------------------------------------------------------------------------

describe("Hook.TeammateIdle", () => {
  it.effect("keepWorking prevents idle", () =>
    Effect.gen(function* () {
      const hook = TeammateIdle.define({
        handler: () => Effect.succeed(TeammateIdle.keepWorking("still tasks queued")),
      });
      const json = encodeJson({
        ...baseWithMode,
        hook_event_name: "TeammateIdle",
        team_name: "frontend",
        teammate_name: "Bob",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe("still tasks queued");
      expect(result.output).toBeUndefined();
    })
  );
});

// ---------------------------------------------------------------------------
// WorktreeCreate / WorktreeRemove
// ---------------------------------------------------------------------------

describe("Hook.WorktreeCreate", () => {
  it.effect("created() writes a raw worktree path to stdout", () =>
    Effect.gen(function* () {
      const hook = WorktreeCreate.define({
        handler: () => Effect.succeed(WorktreeCreate.created("/tmp/wt-1")),
      });
      const json = encodeJson({
        ...base,
        hook_event_name: "WorktreeCreate",
        name: "feature-auth",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("/tmp/wt-1\n");
      expect(result.output).toBeUndefined();
    })
  );
});

describe("Hook.WorktreeRemove", () => {
  it.effect("decodes and passes through", () =>
    Effect.gen(function* () {
      const hook = WorktreeRemove.define({
        handler: () => Effect.succeed(WorktreeRemove.passthrough()),
      });
      const json = encodeJson({
        ...base,
        hook_event_name: "WorktreeRemove",
        worktree_path: "/tmp/wt-1",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
    })
  );
});

// ---------------------------------------------------------------------------
// Elicitation / ElicitationResult
// ---------------------------------------------------------------------------

describe("Hook.Elicitation", () => {
  it.effect("accept() with content", () =>
    Effect.gen(function* () {
      const hook = Elicitation.define({
        handler: () => Effect.succeed(Elicitation.accept({ username: "alice" })),
      });
      const json = encodeJson({
        ...baseWithMode,
        hook_event_name: "Elicitation",
        mcp_server_name: "memory",
        message: "Please provide credentials",
        mode: "form",
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          action: "accept",
          content: { username: "alice" },
        },
      });
    })
  );

  it("decline() sets action to decline", () => {
    const out = Elicitation.decline();
    expect(O.getOrThrow(out.hookSpecificOutput).action).toBe("decline");
  });
});

describe("Hook.ElicitationResult", () => {
  it.effect("accept overrides user response", () =>
    Effect.gen(function* () {
      const hook = ElicitationResult.define({
        handler: () => Effect.succeed(ElicitationResult.accept({ override: true })),
      });
      const json = encodeJson({
        ...baseWithMode,
        hook_event_name: "ElicitationResult",
        mcp_server_name: "memory",
        action: "accept",
        content: { choice: "yes" },
      });
      const result = yield* Testing.runHookWithMockStdin(hook, json);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: { action: "accept", content: { override: true } },
      });
    })
  );
});
