/**
 * Test helpers for effect-claudecode.
 *
 * Provides a test harness (`runHookWithMockStdin`) that exercises the entire
 * runner pipeline — stdin → decode → handler → encode → stdout — without
 * spawning a process. Plus mock constructors and assertion helpers.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";

import {
  HookControlledExit,
  HookHandlerError,
  HookInputDecodeError,
  HookOutputEncodeError,
  HookStdinReadError,
  HookStdoutWriteError,
} from "./Errors.ts";
import type * as HookContext from "./Hook/Context.ts";
import { HookEnvelope } from "./Hook/Envelope.ts";
import type * as Events from "./Hook/Events/index.ts";
import { type HookDefinition, runHookProgram } from "./Hook/Runner.ts";
import * as Plugin from "./Plugin.ts";

const $I = $ScratchpadId.create("claudecode/Testing");

// ---------------------------------------------------------------------------
// Mock context
// ---------------------------------------------------------------------------

const defaultContext: HookContext.Interface = {
  sessionId: "test-session",
  transcriptPath: "/tmp/transcript.jsonl",
  cwd: "/tmp/workspace",
  permissionMode: O.some("default"),
  promptId: O.none(),
  hookEventName: "TestEvent",
  effort: O.none(),
  agentId: O.none(),
  agentType: O.none(),
};

/**
 * Build a `HookContext.Interface` with sensible defaults, overridable
 * via the `overrides` argument.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const context = Testing.makeMockHookContext({ cwd: "/repo" })
 * console.log(context.cwd)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeMockHookContext = (overrides?: Partial<HookContext.Interface>): HookContext.Interface =>
  overrides === undefined ? defaultContext : { ...defaultContext, ...overrides };

const defaultEnvelope = HookEnvelope.make({
  session_id: "test-session",
  transcript_path: "/tmp/transcript.jsonl",
  cwd: "/tmp/workspace",
  hook_event_name: "TestEvent",
  permission_mode: O.some("default"),
  effort: O.none(),
  agent_id: O.none(),
  agent_type: O.none(),
});

const defaultEnvelopeFields = {
  session_id: "test-session",
  transcript_path: "/tmp/transcript.jsonl",
  cwd: "/tmp/workspace",
  hook_event_name: "TestEvent",
  permission_mode: "default",
} as const;

/**
 * Build a `HookEnvelope` with sensible defaults, overridable via `overrides`.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const envelope = Testing.makeMockEnvelope()
 * console.log(envelope.session_id)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeMockEnvelope = (overrides?: Partial<HookEnvelope>): HookEnvelope =>
  overrides === undefined ? defaultEnvelope : HookEnvelope.make({ ...defaultEnvelope, ...overrides });

// ---------------------------------------------------------------------------
// Mock Stdio layer
// ---------------------------------------------------------------------------

/**
 * Build a `Layer<Stdio.Stdio>` whose stdin emits the given JSON string once
 * and whose stdout/stderr push into the given arrays.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const stdout: Array<string> = []
 * const layer = Testing.makeMockStdioLayer({
 *   stdinJson: "{}",
 *   stdoutBuffer: stdout
 * })
 * console.log(layer)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeMockStdioLayer = (options: {
  readonly stdinJson: string;
  readonly stdoutBuffer: Array<string>;
  readonly stderrBuffer?: Array<string>;
}) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const writeStdoutChunk = (chunk: string | Uint8Array) =>
    Effect.sync(() => {
      options.stdoutBuffer.push(typeof chunk === "string" ? chunk : decoder.decode(chunk));
    });
  const writeStderrChunk = (chunk: string | Uint8Array) =>
    Effect.sync(() => {
      const buf = options.stderrBuffer;
      if (buf !== undefined) {
        buf.push(typeof chunk === "string" ? chunk : decoder.decode(chunk));
      }
    });
  const stdoutSink = (): Sink.Sink<void, string | Uint8Array, never, never> => Sink.forEach(writeStdoutChunk);
  const stderrSink = (): Sink.Sink<void, string | Uint8Array, never, never> => Sink.forEach(writeStderrChunk);
  return Stdio.layerTest({
    stdin: Stream.make(encoder.encode(options.stdinJson)),
    stdout: stdoutSink,
    stderr: stderrSink,
  });
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

interface ErrorClassification {
  readonly exitCode: number;
  readonly errorTag: string | undefined;
}

const successClassification: ErrorClassification = {
  exitCode: 0,
  errorTag: undefined,
};

const interruptClassification: ErrorClassification = {
  exitCode: 130,
  errorTag: undefined,
};

const classifyFailure = (squashed: unknown): ErrorClassification => {
  if (S.is(HookInputDecodeError)(squashed)) {
    return { exitCode: 2, errorTag: "HookInputDecodeError" };
  }
  if (S.is(HookStdinReadError)(squashed)) {
    return { exitCode: 1, errorTag: "HookStdinReadError" };
  }
  if (S.is(HookHandlerError)(squashed)) {
    return { exitCode: 1, errorTag: "HookHandlerError" };
  }
  if (S.is(HookOutputEncodeError)(squashed)) {
    return { exitCode: 1, errorTag: "HookOutputEncodeError" };
  }
  if (S.is(HookStdoutWriteError)(squashed)) {
    return { exitCode: 1, errorTag: "HookStdoutWriteError" };
  }
  if (S.is(HookControlledExit)(squashed)) {
    return {
      exitCode: squashed.code,
      errorTag: "HookControlledExit",
    };
  }
  return { exitCode: 1, errorTag: undefined };
};

const classifyExit = <E, A>(exit: Exit.Exit<E, A>): ErrorClassification => {
  if (Exit.isSuccess(exit)) return successClassification;
  if (Cause.hasInterruptsOnly(exit.cause)) return interruptClassification;
  return classifyFailure(exit.cause.pipe(Cause.squash));
};

// ---------------------------------------------------------------------------
// runHookWithMockStdin
// ---------------------------------------------------------------------------

type HookInputEnvelope = Pick<HookEnvelope, "session_id" | "transcript_path" | "cwd" | "hook_event_name">;

/**
 * Result of running a hook against a mock stdin.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * const result = {
 *   output: undefined,
 *   stdout: "",
 *   stderr: "",
 *   exitCode: 0,
 *   errorTag: undefined
 * } satisfies Testing.RunHookResult
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface RunHookResult {
  /** Parsed JSON written to stdout, or `undefined` if nothing was written. */
  readonly output: unknown;
  /** Raw stdout string. */
  readonly stdout: string;
  /** Captured stderr string. */
  readonly stderr: string;
  /**
   * Exit code the runner would produce under the real `runMain` teardown.
   * `0` success, handler-authored `HookProcessOutput` exits use their
   * requested code, `2` input decode failure, `1` other runner failure,
   * `130` interrupt.
   */
  readonly exitCode: number;
  /** The `_tag` of the runner failure, if any. */
  readonly errorTag: string | undefined;
}

/**
 * Run a hook definition end-to-end against a mock stdin payload and capture
 * the stdout the runner would have written.
 *
 * This exercises the full runner pipeline (stdin read → JSON parse →
 * schema decode → handler → schema encode → stdout write) using
 * `Stdio.layerTest` instead of the real `process.stdin`/`process.stdout`.
 * No fiber is forked; no process.exit is called.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const hook = Hook.PreToolUse.define({
 *   handler: () => Effect.succeed(Hook.PreToolUse.passthrough())
 * })
 * const program = Testing.runHookWithMockStdin(
 *   hook,
 *   Testing.fixtures.PreToolUse()
 * )
 * console.log(program)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runHookWithMockStdin = <In extends HookInputEnvelope, Out, E, R>(
  hook: HookDefinition<In, Out, E, R>,
  stdinJson: string
): Effect.Effect<RunHookResult, never, Exclude<Exclude<R, HookContext.Service>, Stdio.Stdio>> =>
  Effect.gen(function* () {
    const stdoutBuffer: Array<string> = [];
    const stderrBuffer: Array<string> = [];

    const layer = makeMockStdioLayer({
      stdinJson,
      stdoutBuffer,
      stderrBuffer,
    });

    const exit = yield* Effect.exit(
      // This helper is the application boundary for the isolated hook run.
      // @effect-diagnostics-next-line strictEffectProvide:off
      runHookProgram(hook).pipe(Effect.provide(layer))
    );

    const stdout = stdoutBuffer.join("");
    const stderr = stderrBuffer.join("");
    const trimmed = stdout.trim();
    const output: unknown =
      trimmed.length > 0
        ? yield* S.decodeUnknownEffect(S.UnknownFromJsonString)(trimmed).pipe(Effect.orElseSucceed(() => undefined))
        : undefined;

    const { exitCode, errorTag } = classifyExit(exit);

    return { output, stdout, stderr, exitCode, errorTag };
  });

// ---------------------------------------------------------------------------
// Event input fixtures
// ---------------------------------------------------------------------------

/**
 * Build a fixture function for a single event. The returned function
 * takes an `overrides` object and produces the JSON wire string the
 * runner would decode. Defaults are merged in from the common
 * envelope and the per-event defaults passed here; overrides win.
 *
 * The generic `TInput` parameter carries the event's `Input` class
 * type so call sites get typed IntelliSense over the override shape.
 *
 * @internal
 */
const makeFixture =
  <TInput>(event: string, defaults: Record<string, unknown>) =>
  (overrides?: Partial<TInput>): string =>
    // `avoid-direct-json` (info): writing a JSON wire string IS the
    // point of a fixture builder.
    JSON.stringify({
      ...defaultEnvelopeFields,
      hook_event_name: event,
      ...defaults,
      ...overrides,
    });

/**
 * Fixture builders for every Claude Code hook event. Each entry
 * returns a JSON string suitable for passing to
 * `runHookWithMockStdin`.
 *
 * Defaults carry only the minimum fields required by the event
 * schema; callers override only what matters for the test.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const json = Testing.fixtures.PreToolUse({
 *   tool_name: "Bash",
 *   tool_input: { command: "echo safe" }
 * })
 * console.log(json)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const fixtures = {
  // ---- Tier 1 ----
  PreToolUse: makeFixture<typeof Events.PreToolUse.Input.Encoded>("PreToolUse", {
    tool_name: "Bash",
    tool_input: { command: "echo test" },
  }),
  PostToolUse: makeFixture<typeof Events.PostToolUse.Input.Encoded>("PostToolUse", {
    tool_name: "Bash",
    tool_input: { command: "echo test" },
    tool_response: {
      stdout: "test\n",
      stderr: "",
      interrupted: false,
      isImage: false,
    },
  }),
  UserPromptSubmit: makeFixture<typeof Events.UserPromptSubmit.Input.Encoded>("UserPromptSubmit", { prompt: "hello" }),
  Notification: makeFixture<typeof Events.Notification.Input.Encoded>("Notification", {
    message: "test notification",
    notification_type: "permission_prompt",
  }),
  Stop: makeFixture<typeof Events.Stop.Input.Encoded>("Stop", {
    stop_hook_active: false,
  }),
  SubagentStop: makeFixture<typeof Events.SubagentStop.Input.Encoded>("SubagentStop", {
    stop_hook_active: false,
    agent_id: "agent-1",
    agent_type: "default",
    agent_transcript_path: "/tmp/agent.jsonl",
    last_assistant_message: "done",
  }),
  SessionStart: makeFixture<typeof Events.SessionStart.Input.Encoded>("SessionStart", {
    source: "startup",
  }),
  Setup: makeFixture<typeof Events.Setup.Input.Encoded>("Setup", {
    trigger: "init",
  }),
  SessionEnd: makeFixture<typeof Events.SessionEnd.Input.Encoded>("SessionEnd", {
    reason: "clear",
  }),
  PreCompact: makeFixture<typeof Events.PreCompact.Input.Encoded>("PreCompact", {
    trigger: "manual",
  }),

  // ---- Tier 2 ----
  PostCompact: makeFixture<typeof Events.PostCompact.Input.Encoded>("PostCompact", {
    trigger: "manual",
  }),
  PermissionRequest: makeFixture<typeof Events.PermissionRequest.Input.Encoded>("PermissionRequest", {
    tool_name: "Bash",
    tool_input: { command: "echo test" },
  }),
  PermissionDenied: makeFixture<typeof Events.PermissionDenied.Input.Encoded>("PermissionDenied", {
    tool_name: "Bash",
    tool_input: { command: "echo test" },
    reason: "denied by policy",
  }),
  PostToolUseFailure: makeFixture<typeof Events.PostToolUseFailure.Input.Encoded>("PostToolUseFailure", {
    tool_name: "Bash",
    tool_input: { command: "echo test" },
    error: "command failed",
  }),
  InstructionsLoaded: makeFixture<typeof Events.InstructionsLoaded.Input.Encoded>("InstructionsLoaded", {
    file_path: "/repo/CLAUDE.md",
    memory_type: "Project",
    load_reason: "session_start",
  }),
  StopFailure: makeFixture<typeof Events.StopFailure.Input.Encoded>("StopFailure", {
    error: "rate_limit",
  }),
  CwdChanged: makeFixture<typeof Events.CwdChanged.Input.Encoded>("CwdChanged", {
    old_cwd: "/tmp/workspace",
    new_cwd: "/tmp/workspace/src",
  }),
  FileChanged: makeFixture<typeof Events.FileChanged.Input.Encoded>("FileChanged", {
    file_path: "/repo/src/index.ts",
    event: "change",
  }),
  ConfigChange: makeFixture<typeof Events.ConfigChange.Input.Encoded>("ConfigChange", {
    source: "user_settings",
  }),
  SubagentStart: makeFixture<typeof Events.SubagentStart.Input.Encoded>("SubagentStart", {
    agent_id: "agent-1",
    agent_type: "default",
  }),

  // ---- Tier 3 ----
  TaskCreated: makeFixture<typeof Events.TaskCreated.Input.Encoded>("TaskCreated", {
    task_id: "task-1",
    task_subject: "Do something",
  }),
  TaskCompleted: makeFixture<typeof Events.TaskCompleted.Input.Encoded>("TaskCompleted", {
    task_id: "task-1",
    task_subject: "Do something",
  }),
  TeammateIdle: makeFixture<typeof Events.TeammateIdle.Input.Encoded>("TeammateIdle", {}),
  WorktreeCreate: makeFixture<typeof Events.WorktreeCreate.Input.Encoded>("WorktreeCreate", { name: "feature-auth" }),
  WorktreeRemove: makeFixture<typeof Events.WorktreeRemove.Input.Encoded>("WorktreeRemove", {
    worktree_path: "/repo/.worktrees/feature",
  }),
  Elicitation: makeFixture<typeof Events.Elicitation.Input.Encoded>("Elicitation", {
    mcp_server_name: "test-server",
    message: "Please provide credentials",
  }),
  ElicitationResult: makeFixture<typeof Events.ElicitationResult.Input.Encoded>("ElicitationResult", {
    mcp_server_name: "test-server",
    action: "accept",
  }),
  UserPromptExpansion: makeFixture<typeof Events.UserPromptExpansion.Input.Encoded>("UserPromptExpansion", {
    expansion_type: "slash_command",
    command_name: "example-skill",
    command_args: "arg1 arg2",
    command_source: "plugin",
    prompt: "/example-skill arg1 arg2",
  }),
  PostToolBatch: makeFixture<typeof Events.PostToolBatch.Input.Encoded>("PostToolBatch", {
    tool_calls: [],
  }),
  MessageDisplay: makeFixture<typeof Events.MessageDisplay.Input.Encoded>("MessageDisplay", {
    turn_id: "turn-1",
    message_id: "message-1",
    index: 0,
    final: true,
    delta: "Hello\n",
  }),
};

// ---------------------------------------------------------------------------
// Decision assertion helpers
// ---------------------------------------------------------------------------

const AnyString = Symbol.for("effect-claudecode/Testing/AnyString");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const formatAssertionValue = (value: unknown): string =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? String(value));

const failAssertion = (message: string): never => {
  throw new Error(message);
};

const matchesExpected = (actual: unknown, expected: unknown): boolean => {
  if (O.isOption(actual) && !O.isOption(expected)) {
    return O.isSome(actual) && matchesExpected(actual.value, expected);
  }

  if (expected === AnyString) {
    return typeof actual === "string";
  }

  if (expected instanceof RegExp) {
    return typeof actual === "string" && expected.test(actual);
  }

  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => matchesExpected(actual[index], item))
    );
  }

  if (isRecord(expected)) {
    return isRecord(actual) && Object.entries(expected).every(([key, value]) => matchesExpected(actual[key], value));
  }

  return Object.is(actual, expected);
};

const assertMatchObject = (actual: unknown, expected: Record<string, unknown>, label: string): void => {
  if (!matchesExpected(actual, expected)) {
    failAssertion(`${label}\nExpected: ${formatAssertionValue(expected)}\nActual: ${formatAssertionValue(actual)}`);
  }
};

const assertEqual = (actual: unknown, expected: unknown, label: string): void => {
  if (!matchesExpected(actual, expected)) {
    failAssertion(`${label}\nExpected: ${formatAssertionValue(expected)}\nActual: ${formatAssertionValue(actual)}`);
  }
};

const assertMatch = (actual: unknown, expected: unknown, label: string): void => {
  if (!matchesExpected(actual, expected)) {
    failAssertion(`${label}\nExpected: ${formatAssertionValue(expected)}\nActual: ${formatAssertionValue(actual)}`);
  }
};

const assertDefined = <A>(value: A | undefined, label: string): A => {
  if (value !== undefined) {
    return value;
  }

  return failAssertion(label);
};

/**
 * Assert that `output` is a PreToolUse `allow` decision. If `reason`
 * is provided, it must match `permissionDecisionReason`.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * Testing.expectAllowDecision(Hook.PreToolUse.allow())
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectAllowDecision = (output: unknown, reason?: string): void => {
  const expected: Record<string, unknown> = {
    permissionDecision: "allow",
  };
  if (reason !== undefined) {
    expected.permissionDecisionReason = reason;
  }
  assertMatchObject(output, { hookSpecificOutput: expected }, "Expected an allow decision.");
};

/**
 * Assert that `output` is a PreToolUse `deny` decision. If `reason`
 * is provided, it must match `permissionDecisionReason`.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * Testing.expectDenyDecision(Hook.PreToolUse.deny("blocked"), "blocked")
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectDenyDecision = (output: unknown, reason?: string): void => {
  const expected: Record<string, unknown> = {
    permissionDecision: "deny",
  };
  if (reason !== undefined) {
    expected.permissionDecisionReason = reason;
  }
  assertMatchObject(output, { hookSpecificOutput: expected }, "Expected a deny decision.");
};

/**
 * Assert that `output` is a PreToolUse `ask` decision. If `reason`
 * is provided, it must match `permissionDecisionReason`.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * Testing.expectAskDecision(Hook.PreToolUse.ask("review"), "review")
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectAskDecision = (output: unknown, reason?: string): void => {
  const expected: Record<string, unknown> = {
    permissionDecision: "ask",
  };
  if (reason !== undefined) {
    expected.permissionDecisionReason = reason;
  }
  assertMatchObject(output, { hookSpecificOutput: expected }, "Expected an ask decision.");
};

/**
 * Assert that `output` is a top-level `block` decision. If `reason`
 * is provided, it must match `reason`.
 *
 * Applies to events that encode a top-level JSON `decision: "block"`, such
 * as UserPromptSubmit, PostToolUse, PostToolUseFailure, PostToolBatch, Stop,
 * SubagentStop, ConfigChange, UserPromptExpansion, and PreCompact. Events
 * that block with a controlled exit (TaskCreated, TaskCompleted,
 * TeammateIdle, WorktreeCreate) should assert on `exitCode` and `stderr`.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * Testing.expectBlockDecision(
 *   Hook.UserPromptSubmit.block("blocked"),
 *   "blocked"
 * )
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectBlockDecision = (output: unknown, reason?: string): void => {
  const expected: Record<string, unknown> = { decision: "block" };
  if (reason !== undefined) {
    expected.reason = reason;
  }
  assertMatchObject(output, expected, "Expected a block decision.");
};

/**
 * Assert that `output` carries an `additionalContext` entry in its
 * `hookSpecificOutput`. When `context` is provided, the string must
 * match exactly.
 *
 * @example
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * Testing.expectAddContext(
 *   Hook.UserPromptSubmit.addContext("context"),
 *   "context"
 * )
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectAddContext = (output: unknown, context?: string): void => {
  const expected: Record<string, unknown> =
    context === undefined ? { additionalContext: AnyString } : { additionalContext: context };
  assertMatchObject(output, { hookSpecificOutput: expected }, "Expected an addContext decision.");
};

// ---------------------------------------------------------------------------
// Mock FileSystem
// ---------------------------------------------------------------------------

/**
 * Operations that the mock file system can intercept.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const operation = Testing.MockFileSystemOperation.Enum.readFile
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MockFileSystemOperation = LiteralKit([
  "exists",
  "readFile",
  "readFileString",
  "writeFile",
  "writeFileString",
  "makeDirectory",
  "readDirectory",
  "remove",
  "copy",
]).pipe(
  $I.annoteSchema("MockFileSystemOperation", {
    description: "Operation that the in-memory file-system harness can intercept.",
  })
);

/**
 * Types derived from {@link MockFileSystemOperation}.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * const operation = "readFile" satisfies Testing.MockFileSystemOperation.Type
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MockFileSystemOperation {
  /**
   * Decoded mock file-system operation name.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof MockFileSystemOperation.Type;
}

/**
 * Options for the in-memory file system harness.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * const options = {
 *   failOn: (operation) => operation === "writeFile"
 * } satisfies Testing.MockFileSystemOptions
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export interface MockFileSystemOptions {
  readonly failOn?: (operation: MockFileSystemOperation.Type, path: string) => boolean;
}

/**
 * Deterministic snapshot of the mock file system state.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * type Snapshot = Testing.MockFileSystemSnapshot
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface MockFileSystemSnapshot {
  readonly files: ReadonlyMap<string, string>;
  readonly directories: ReadonlyArray<string>;
}

/**
 * Stateful in-memory file system harness used by tests.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * type FileSystem = Testing.MockFileSystem
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export interface MockFileSystem {
  readonly layer: Layer.Layer<FileSystem.FileSystem | Path.Path>;
  readonly snapshot: () => MockFileSystemSnapshot;
  readonly readFile: (path: string) => string | undefined;
  readonly exists: (path: string) => boolean;
}

type MockFileEntries = ReadonlyMap<string, string> | Record<string, string>;

const textEncoder = new TextEncoder();

const normalizeDirectoryPath = (path: string): string => {
  if (path === "/") {
    return "/";
  }
  const normalized = path.replace(/\/+$/, "");
  return normalized.length === 0 ? "/" : normalized;
};

const parentDirectory = (path: string): string => {
  const normalized = normalizeDirectoryPath(path);
  if (normalized === "/") {
    return "/";
  }
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex <= 0 ? "/" : normalized.slice(0, slashIndex);
};

const ancestorDirectories = (path: string): ReadonlyArray<string> => {
  const normalized = normalizeDirectoryPath(path);
  if (normalized === "/") {
    return ["/"];
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0);
  const directories = ["/"];
  let current = "";

  for (const segment of segments) {
    current = `${current}/${segment}`;
    directories.push(current);
  }

  return directories;
};

const toFileMap = (files?: MockFileEntries): Map<string, string> =>
  files === undefined ? new Map() : files instanceof Map ? new Map(files) : new Map(Object.entries(files));

const permissionDeniedError = (path: string, method: MockFileSystemOperation.Type) =>
  PlatformError.systemError({
    _tag: "PermissionDenied",
    module: "FileSystem",
    method,
    description: "Permission denied",
    pathOrDescriptor: path,
  });

const notFoundError = (path: string, method: MockFileSystemOperation.Type) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method,
    description: "No such file or directory",
    pathOrDescriptor: path,
  });

const directoryNotEmptyError = (path: string) =>
  PlatformError.systemError({
    _tag: "BadResource",
    module: "FileSystem",
    method: "remove",
    description: "Directory not empty",
    pathOrDescriptor: path,
  });

const ensureInitialDirectories = (files: Map<string, string>): Set<string> => {
  const directories = new Set<string>(["/"]);
  for (const filePath of files.keys()) {
    for (const directory of ancestorDirectories(parentDirectory(filePath))) {
      directories.add(directory);
    }
  }
  return directories;
};

const hasEntry = (files: ReadonlyMap<string, string>, directories: ReadonlySet<string>, path: string): boolean =>
  files.has(path) || directories.has(normalizeDirectoryPath(path));

const directDirectoryEntries = (
  files: ReadonlyMap<string, string>,
  directories: ReadonlySet<string>,
  dirPath: string
): ReadonlyArray<string> => {
  const normalized = normalizeDirectoryPath(dirPath);
  const prefix = normalized === "/" ? "/" : `${normalized}/`;
  const entries = new Set<string>();

  for (const filePath of files.keys()) {
    if (!filePath.startsWith(prefix)) continue;
    const remainder = filePath.slice(prefix.length);
    const slashIndex = remainder.indexOf("/");
    entries.add(slashIndex === -1 ? remainder : remainder.slice(0, slashIndex));
  }

  for (const directoryPath of directories) {
    if (directoryPath === normalized || !directoryPath.startsWith(prefix)) continue;
    const remainder = directoryPath.slice(prefix.length);
    if (remainder.length === 0) continue;
    const slashIndex = remainder.indexOf("/");
    entries.add(slashIndex === -1 ? remainder : remainder.slice(0, slashIndex));
  }

  return Array.from(entries)
    .filter((entry) => entry.length > 0)
    .sort();
};

const recursiveDirectoryEntries = (
  files: ReadonlyMap<string, string>,
  directories: ReadonlySet<string>,
  dirPath: string
): ReadonlyArray<string> => {
  const normalized = normalizeDirectoryPath(dirPath);
  const prefix = normalized === "/" ? "/" : `${normalized}/`;
  const entries = new Set<string>();

  for (const filePath of files.keys()) {
    if (filePath.startsWith(prefix)) {
      const remainder = filePath.slice(prefix.length);
      if (remainder.length > 0) {
        entries.add(remainder);
      }
    }
  }

  for (const directoryPath of directories) {
    if (directoryPath === normalized || !directoryPath.startsWith(prefix)) continue;
    const remainder = directoryPath.slice(prefix.length);
    if (remainder.length > 0) {
      entries.add(remainder);
    }
  }

  return Array.from(entries).sort();
};

/**
 * Build a stateful in-memory file system harness with a ready-to-provide
 * `FileSystem` + `Path` layer and snapshot helpers for assertions.
 *
 * Unlike the earlier read-only helper, this harness supports directory
 * listings and writes, so it can exercise `Plugin.write`, `Plugin.scan`,
 * `Plugin.load`, `Settings.load`, frontmatter parsing, transcript reads, and
 * install/sync flows against one consistent in-memory project tree.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/repo/settings.json": "{}"
 * })
 * console.log(fileSystem.exists("/repo/settings.json"))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const makeMockFileSystem = (files?: MockFileEntries, options?: MockFileSystemOptions): MockFileSystem => {
  const fileMap = toFileMap(files);
  const directories = ensureInitialDirectories(fileMap);
  const shouldFail = options?.failOn ?? (() => false);

  const failIfRequested = (operation: MockFileSystemOperation.Type, path: string) =>
    shouldFail(operation, path) ? O.some(permissionDeniedError(path, operation)) : O.none();

  const layer = Layer.mergeAll(
    FileSystem.layerNoop({
      copy: (fromPath: string, toPath: string) => {
        const failure = failIfRequested("copy", fromPath);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const sourceDir = normalizeDirectoryPath(fromPath);
        if (!fileMap.has(fromPath) && !directories.has(sourceDir)) {
          return Effect.fail(notFoundError(fromPath, "copy"));
        }
        return Effect.sync(() => {
          const addDirectories = (paths: ReadonlyArray<string>): void => {
            A.forEach(paths, (directory) => {
              directories.add(directory);
            });
          };

          if (fileMap.has(fromPath)) {
            const content = fileMap.get(fromPath);
            if (content !== undefined) {
              addDirectories(ancestorDirectories(parentDirectory(toPath)));
              fileMap.set(toPath, content);
            }
            return;
          }

          const targetDir = normalizeDirectoryPath(toPath);
          addDirectories(ancestorDirectories(targetDir));
          const prefix = sourceDir === "/" ? "/" : `${sourceDir}/`;
          pipe(
            A.fromIterable(directories),
            A.filter((directoryPath) => directoryPath === sourceDir || directoryPath.startsWith(prefix)),
            A.map((directoryPath) => {
              const relativePath = directoryPath === sourceDir ? "" : directoryPath.slice(prefix.length);
              return relativePath.length === 0 ? targetDir : `${targetDir}/${relativePath}`;
            }),
            addDirectories
          );
          pipe(
            A.fromIterable(fileMap.entries()),
            A.filter(([filePath]) => filePath.startsWith(prefix)),
            A.forEach(([filePath, content]) => {
              fileMap.set(`${targetDir}/${filePath.slice(prefix.length)}`, content);
            })
          );
        });
      },
      exists: (path: string) => {
        const failure = failIfRequested("exists", path);
        return O.isSome(failure) ? Effect.fail(failure.value) : Effect.succeed(hasEntry(fileMap, directories, path));
      },
      readFileString: (path: string) => {
        const failure = failIfRequested("readFileString", path);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const content = fileMap.get(path);
        return content === undefined ? Effect.fail(notFoundError(path, "readFileString")) : Effect.succeed(content);
      },
      readFile: (path: string) => {
        const failure = failIfRequested("readFile", path);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const content = fileMap.get(path);
        return content === undefined
          ? Effect.fail(notFoundError(path, "readFile"))
          : Effect.succeed(textEncoder.encode(content));
      },
      writeFileString: (path: string, content: string) => {
        const failure = failIfRequested("writeFileString", path);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const directory = parentDirectory(path);
        if (!directories.has(directory)) {
          return Effect.fail(notFoundError(path, "writeFileString"));
        }
        return Effect.sync(() => {
          fileMap.set(path, content);
        });
      },
      writeFile: (path: string, data: Uint8Array) => {
        const failure = failIfRequested("writeFile", path);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const directory = parentDirectory(path);
        if (!directories.has(directory)) {
          return Effect.fail(notFoundError(path, "writeFile"));
        }
        return Effect.sync(() => {
          fileMap.set(path, new TextDecoder().decode(data));
        });
      },
      makeDirectory: Effect.fn("Testing.makeMockFileSystem.makeDirectory")(function* (path: string, makeOptions) {
        const failure = failIfRequested("makeDirectory", path);
        if (O.isSome(failure)) {
          return yield* failure.value;
        }
        const normalized = normalizeDirectoryPath(path);
        const recursive = makeOptions?.recursive ?? false;
        if (!recursive && !directories.has(parentDirectory(normalized))) {
          return yield* notFoundError(path, "makeDirectory");
        }
        yield* Effect.sync(() => {
          for (const directory of recursive ? ancestorDirectories(normalized) : [normalized]) {
            directories.add(directory);
          }
        });
      }),
      readDirectory: (path: string, readOptions) => {
        const failure = failIfRequested("readDirectory", path);
        if (O.isSome(failure)) {
          return Effect.fail(failure.value);
        }
        const normalized = normalizeDirectoryPath(path);
        if (!directories.has(normalized)) {
          return Effect.fail(notFoundError(path, "readDirectory"));
        }
        return Effect.succeed(
          readOptions?.recursive === true
            ? [...recursiveDirectoryEntries(fileMap, directories, normalized)]
            : [...directDirectoryEntries(fileMap, directories, normalized)]
        );
      },
      remove: Effect.fn("Testing.makeMockFileSystem.remove")(function* (path: string, removeOptions) {
        const failure = failIfRequested("remove", path);
        if (O.isSome(failure)) {
          return yield* failure.value;
        }
        const normalized = normalizeDirectoryPath(path);
        const recursive = removeOptions?.recursive ?? false;
        const force = removeOptions?.force ?? false;

        if (fileMap.has(path)) {
          return yield* Effect.sync(() => {
            fileMap.delete(path);
          });
        }

        if (!directories.has(normalized)) {
          if (force) {
            return;
          }
          return yield* notFoundError(path, "remove");
        }

        const descendants = Array.from(fileMap.keys()).filter((filePath) => filePath.startsWith(`${normalized}/`));
        const descendantDirectories = Array.from(directories).filter(
          (directoryPath) => directoryPath !== normalized && directoryPath.startsWith(`${normalized}/`)
        );

        if (!recursive && (descendants.length > 0 || descendantDirectories.length > 0)) {
          return yield* directoryNotEmptyError(path);
        }

        yield* Effect.sync(() => {
          for (const filePath of descendants) {
            fileMap.delete(filePath);
          }
          for (const directoryPath of descendantDirectories) {
            directories.delete(directoryPath);
          }
          directories.delete(normalized);
        });
      }),
    }),
    Path.layer
  );

  return {
    layer,
    snapshot: () => ({
      files: new Map(Array.from(fileMap.entries()).sort(([left], [right]) => left.localeCompare(right))),
      directories: Array.from(directories).sort(),
    }),
    readFile: (path: string) => fileMap.get(path),
    exists: (path: string) => hasEntry(fileMap, directories, path),
  };
};

/**
 * Assert that a written plugin tree matches the expected file set exactly.
 *
 * String expectations must match exactly. `RegExp` expectations must match the
 * full file content via `expect(...).toMatch(...)`.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const fileSystem = Testing.makeMockFileSystem({
 *   "/plugin/.claude-plugin/plugin.json": "{}"
 * })
 * Testing.expectPluginTree(fileSystem, {
 *   "/plugin/.claude-plugin/plugin.json": "{}"
 * })
 * ```
 *
 * @category assertions
 * @since 0.0.0
 */
export const expectPluginTree = (
  input: MockFileSystem | MockFileSystemSnapshot,
  expected: Readonly<Record<string, string | RegExp>>
): void => {
  const snapshot = "layer" in input ? input.snapshot() : input;
  const actualPaths = Array.from(snapshot.files.keys()).sort();
  const expectedPaths = Object.keys(expected).sort();

  assertEqual(actualPaths, expectedPaths, "Plugin tree paths did not match.");

  for (const path of expectedPaths) {
    const actual = assertDefined(snapshot.files.get(path), `Expected plugin tree to contain ${path}.`);
    const matcher = expected[path];
    if (matcher instanceof RegExp) {
      assertMatch(actual, matcher, `Plugin tree file ${path} did not match the expected pattern.`);
    } else {
      assertEqual(actual, matcher, `Plugin tree file ${path} did not match the expected contents.`);
    }
  }
};

/**
 * Write a plugin definition into an in-memory file system harness and return
 * the harness for further assertions or round-trip loading.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const write = Testing.writePluginToMemory
 * console.log(write)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const writePluginToMemory = (
  definition: Plugin.PluginDefinition,
  destDir = "/plugin",
  options?: MockFileSystemOptions
): Effect.Effect<MockFileSystem, import("./Errors.ts").PluginWriteError> =>
  Effect.gen(function* () {
    const fileSystem = makeMockFileSystem(undefined, options);
    // This helper is the application boundary for the isolated plugin write.
    yield* Plugin.write(definition, destDir).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      Effect.provide(fileSystem.layer)
    );
    return fileSystem;
  });

/**
 * Result of writing a plugin to an in-memory file system and loading it back.
 *
 * @example
 * ```ts
 * import type { Testing } from "effect-claudecode"
 *
 * type Result = Testing.PluginRoundTripResult
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PluginRoundTripResult {
  readonly fileSystem: MockFileSystem;
  readonly loaded: Plugin.LoadedPlugin;
}

/**
 * Round-trip a plugin definition through `Plugin.write` and `Plugin.load`
 * without touching disk.
 *
 * @example
 * ```ts
 * import { Testing } from "effect-claudecode"
 *
 * const roundTrip = Testing.roundTripPlugin
 * console.log(roundTrip)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const roundTripPlugin = (
  definition: Plugin.PluginDefinition,
  destDir = "/plugin",
  options?: MockFileSystemOptions
): Effect.Effect<
  PluginRoundTripResult,
  import("./Errors.ts").PluginWriteError | import("./Errors.ts").PluginLoadError
> =>
  Effect.gen(function* () {
    const fileSystem = yield* writePluginToMemory(definition, destDir, options);
    // This helper is the application boundary for the isolated plugin read.
    const loaded = yield* Plugin.load(destDir).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      Effect.provide(fileSystem.layer)
    );
    return { fileSystem, loaded };
  });
