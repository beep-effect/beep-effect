/**
 * Tests for `Hook.dispatch` — multi-event routing from a single script.
 *
 * @since 0.1.0
 */
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import * as PreToolUse from "../../../claudecode/Hook/Events/PreToolUse.ts";
import * as SessionStart from "../../../claudecode/Hook/Events/SessionStart.ts";
import { type DispatchMap, runDispatchProgram } from "../../../claudecode/Hook/Runner.ts";
import * as Testing from "../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Helpers: run dispatch against a mock stdin layer (mirrors Testing.runHookWithMockStdin)
// ---------------------------------------------------------------------------

interface DispatchResult {
  readonly output: unknown;
  readonly stdout: string;
  readonly stderr: string;
  readonly succeeded: boolean;
}

const decodeJson = UnknownFromJsonString.decodeUnknownEffect;
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const runDispatchWithMockStdin = (
  hooks: DispatchMap<never, never>,
  stdinJson: string
): Effect.Effect<DispatchResult, never> =>
  Effect.gen(function* () {
    const stdoutBuffer: Array<string> = [];
    const stderrBuffer: Array<string> = [];
    const layer = Testing.makeMockStdioLayer({
      stdinJson,
      stdoutBuffer,
      stderrBuffer,
    });
    const exit = yield* Effect.exit(runDispatchProgram(hooks).pipe(Effect.provide(layer)));
    const stdout = stdoutBuffer.join("");
    const stderr = stderrBuffer.join("");
    const succeeded = Exit.isSuccess(exit);
    if (!succeeded) {
      // propagate for easier debugging in tests
      const cause = Exit.isFailure(exit) ? exit.cause : Cause.empty;
      yield* Effect.logDebug(`dispatch failed: ${Cause.pretty(cause)}`);
    }
    const trimmed = stdout.trim();
    const output: unknown = trimmed.length > 0 ? yield* decodeJson(trimmed).pipe(Effect.orDie) : undefined;
    return { output, stdout, stderr, succeeded };
  });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Hook.dispatch", () => {
  const hooks: DispatchMap<never, never> = {
    PreToolUse: PreToolUse.define({
      handler: () => Effect.succeed(PreToolUse.allow()),
    }),
    SessionStart: SessionStart.define({
      handler: () => Effect.succeed(SessionStart.addContext("dispatch-context")),
    }),
  };

  it.effect("routes PreToolUse to the PreToolUse handler", () =>
    Effect.gen(function* () {
      const json = encodeJson({
        session_id: "x",
        transcript_path: "/tmp/t",
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        permission_mode: "default",
        tool_name: "Bash",
        tool_input: { command: "ls" },
        tool_use_id: "c-1",
      });
      const result = yield* runDispatchWithMockStdin(hooks, json);
      expect(result.succeeded).toBe(true);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
        },
      });
    })
  );

  it.effect("routes SessionStart to the SessionStart handler", () =>
    Effect.gen(function* () {
      const json = encodeJson({
        session_id: "x",
        transcript_path: "/tmp/t",
        cwd: "/tmp",
        hook_event_name: "SessionStart",
        source: "startup",
        model: "claude-opus-4-6",
      });
      const result = yield* runDispatchWithMockStdin(hooks, json);
      expect(result.succeeded).toBe(true);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: "dispatch-context",
        },
      });
    })
  );

  it.effect("no-ops when event has no registered handler", () =>
    Effect.gen(function* () {
      const json = encodeJson({
        session_id: "x",
        transcript_path: "/tmp/t",
        cwd: "/tmp",
        hook_event_name: "Stop",
        permission_mode: "default",
        stop_hook_active: false,
      });
      const result = yield* runDispatchWithMockStdin(hooks, json);
      expect(result.succeeded).toBe(true);
      expect(result.output).toBeUndefined();
    })
  );
});
/** @effect-diagnostics strictEffectProvide:skip-file -- Vitest cases are application entry points; each provided Layer is composed immediately before the terminal Effect runner. */
