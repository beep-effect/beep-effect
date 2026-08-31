/**
 * Tests for the PreToolUse hook event.
 *
 * @since 0.1.0
 */
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import * as HookContext from "../../../../claudecode/Hook/Context.ts";
import * as PreToolUse from "../../../../claudecode/Hook/Events/PreToolUse.ts";
import * as Testing from "../../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface InputOverrides {
  readonly tool_name?: string;
  readonly tool_input?: Readonly<Record<string, unknown>>;
}

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const makeInputJson = (overrides?: InputOverrides): string =>
  encodeJson({
    session_id: "test-session",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "PreToolUse",
    permission_mode: "default",
    tool_name: overrides?.tool_name ?? "Bash",
    tool_input: overrides?.tool_input ?? { command: "ls" },
    tool_use_id: "call-1",
  });

const decodeFromJson = S.decodeUnknownEffect(S.fromJsonString(PreToolUse.Input));

// ---------------------------------------------------------------------------
// Schema tests
// ---------------------------------------------------------------------------

describe("Hook.PreToolUse schema", () => {
  it.effect("decodes a well-formed JSON input", () =>
    Effect.gen(function* () {
      const input = yield* decodeFromJson(makeInputJson());
      expect(input.tool_name).toBe("Bash");
      expect(input.hook_event_name).toBe("PreToolUse");
    })
  );

  it.effect("rejects input missing tool_name", () =>
    Effect.gen(function* () {
      const badJson = encodeJson({
        session_id: "x",
        transcript_path: "/tmp/t",
        cwd: "/tmp",
        hook_event_name: "PreToolUse",
        tool_input: { command: "ls" },
      });
      const error = yield* Effect.flip(decodeFromJson(badJson));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

describe("Hook.PreToolUse decisions", () => {
  it("allow() produces permissionDecision=allow", () => {
    const out = PreToolUse.allow();
    expect(O.getOrThrow(out.hookSpecificOutput).permissionDecision).toBe("allow");
  });

  it("deny(reason) includes the reason", () => {
    const out = PreToolUse.deny("no raw SQL");
    const hookSpecificOutput = O.getOrThrow(out.hookSpecificOutput);
    expect(hookSpecificOutput.permissionDecision).toBe("deny");
    expect(hookSpecificOutput.permissionDecisionReason).toEqual(O.some("no raw SQL"));
  });

  it("ask() and defer() produce their respective decisions", () => {
    expect(O.getOrThrow(PreToolUse.ask().hookSpecificOutput).permissionDecision).toBe("ask");
    expect(O.getOrThrow(PreToolUse.defer().hookSpecificOutput).permissionDecision).toBe("defer");
  });

  it("allowWithUpdatedInput rewrites the tool input", () => {
    const out = PreToolUse.allowWithUpdatedInput({ command: "ls -la" }, "normalized");
    const hookSpecificOutput = O.getOrThrow(out.hookSpecificOutput);
    expect(hookSpecificOutput.updatedInput).toEqual(
      O.some({
        command: "ls -la",
      })
    );
    expect(hookSpecificOutput.permissionDecisionReason).toEqual(O.some("normalized"));
  });
});

// ---------------------------------------------------------------------------
// End-to-end via runner
// ---------------------------------------------------------------------------

describe("Hook.PreToolUse runner", () => {
  it.effect("denies rm -rf / and returns a parseable decision", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.define({
        handler: (input) => {
          const command = input.tool_input.command;
          const cmd = P.isString(command) ? command : "";
          return Effect.succeed(
            Str.includes("rm -rf /")(cmd) ? PreToolUse.deny("destructive command") : PreToolUse.allow()
          );
        },
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        makeInputJson({
          tool_name: "Bash",
          tool_input: { command: "rm -rf /" },
        })
      );

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "destructive command",
        },
      });
    })
  );

  it.effect("allows benign commands and reads HookContext", () =>
    Effect.gen(function* () {
      const hook = PreToolUse.define({
        handler: Effect.fn("PreToolUse.test.contextHandler")(function* () {
          const ctx = yield* HookContext.Service;
          expect(ctx.sessionId).toBe("test-session");
          return PreToolUse.allow();
        }),
      });

      const result = yield* Testing.runHookWithMockStdin(hook, makeInputJson());

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        hookSpecificOutput: { permissionDecision: "allow" },
      });
    })
  );
});
