/**
 * Tests for the Hook runner — the stdio FFI boundary that decodes hook
 * input, runs a handler, encodes the output, and maps failures to exit codes.
 *
 * Uses a synthetic "TestEvent" schema so Phase 2 can verify the runner
 * before any real event schemas land in Phase 3.
 *
 * @since 0.1.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import * as HookContext from "../../../claudecode/Hook/Context.ts";
import { envelopeFields, HookPermissionMode } from "../../../claudecode/Hook/Envelope.ts";
import type { HookDefinition } from "../../../claudecode/Hook/Runner.ts";
import * as Testing from "../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Synthetic test event + error
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("test/claudecode/Hook/Runner.test");

class TestInput extends S.Class<TestInput>($I`TestInput`)({
  ...envelopeFields,
  hook_event_name: S.Literal("TestEvent"),
  value: S.Finite,
}) {}

class TestOutput extends S.Class<TestOutput>($I`TestOutput`)({
  echoed: S.Finite,
  sessionId: S.String,
  promptId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  permissionMode: S.OptionFromOptionalKey(HookPermissionMode).pipe(SchemaUtils.withNoneDefault),
}) {}

class TestFailure extends TaggedErrorClass<TestFailure>($I`TestFailure`)("TestFailure", {
  message: S.String,
}) {}

const makeTestHook = <E>(
  handler: (input: TestInput) => Effect.Effect<TestOutput, E, HookContext.Service>
): HookDefinition<TestInput, TestOutput, E, HookContext.Service> => ({
  event: "TestEvent",
  inputSchema: TestInput,
  outputSchema: TestOutput,
  handler,
});

const encodeTestInput = S.encodeSync(S.fromJsonString(TestInput));
const encodeJson = S.encodeSync(S.UnknownFromJsonString);

const validInput = encodeTestInput(
  TestInput.make({
    session_id: "session-42",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/tmp/ws",
    hook_event_name: "TestEvent",
    permission_mode: O.some("default"),
    prompt_id: O.some("prompt-17"),
    value: 21,
  })
);

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("Hook.runHookProgram", () => {
  it.effect("decodes input, runs handler, encodes output, exit 0", () =>
    Effect.gen(function* () {
      const hook = makeTestHook((input) =>
        Effect.gen(function* () {
          const ctx = yield* HookContext.Service;
          return TestOutput.make({
            echoed: input.value * 2,
            sessionId: ctx.sessionId,
          });
        })
      );

      const result = yield* Testing.runHookWithMockStdin(hook, validInput);

      expect(result.exitCode).toBe(0);
      expect(result.errorTag).toBeUndefined();
      expect(result.output).toEqual({
        echoed: 42,
        sessionId: "session-42",
      });
    })
  );

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  it.effect("malformed JSON → HookInputDecodeError (phase=json), exit 2", () =>
    Effect.gen(function* () {
      const hook = makeTestHook((input) => Effect.succeed(TestOutput.make({ echoed: input.value, sessionId: "x" })));

      const result = yield* Testing.runHookWithMockStdin(hook, "this is not json");

      expect(result.exitCode).toBe(2);
      expect(result.errorTag).toBe("HookInputDecodeError");
    })
  );

  it.effect("invalid schema → HookInputDecodeError (phase=schema), exit 2", () =>
    Effect.gen(function* () {
      const hook = makeTestHook((input) => Effect.succeed(TestOutput.make({ echoed: input.value, sessionId: "x" })));

      const badInput = encodeJson({
        session_id: "x",
        transcript_path: "/tmp/t",
        cwd: "/tmp",
        hook_event_name: "TestEvent",
        // missing: value
      });

      const result = yield* Testing.runHookWithMockStdin(hook, badInput);

      expect(result.exitCode).toBe(2);
      expect(result.errorTag).toBe("HookInputDecodeError");
    })
  );

  it.effect("handler failure → HookHandlerError, exit 1", () =>
    Effect.gen(function* () {
      const hook = makeTestHook(() => Effect.fail(TestFailure.make({ message: "kaboom" })));

      const result = yield* Testing.runHookWithMockStdin(hook, validInput);

      expect(result.exitCode).toBe(1);
      expect(result.errorTag).toBe("HookHandlerError");
    })
  );
});

// ---------------------------------------------------------------------------
// HookContext provision
// ---------------------------------------------------------------------------

describe("HookContext", () => {
  it.effect("envelope fields are projected into HookContext", () =>
    Effect.gen(function* () {
      const hook = makeTestHook((input) =>
        Effect.gen(function* () {
          const ctx = yield* HookContext.Service;
          return TestOutput.make({
            echoed: input.value,
            sessionId: ctx.sessionId,
            promptId: ctx.promptId,
            permissionMode: ctx.permissionMode,
          });
        })
      );

      const result = yield* Testing.runHookWithMockStdin(hook, validInput);

      expect(result.exitCode).toBe(0);
      expect(result.output).toMatchObject({
        sessionId: "session-42",
        promptId: "prompt-17",
        permissionMode: "default",
      });
    })
  );
});
