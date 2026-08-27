/**
 * Hook runner — the FFI boundary between Claude Code's stdio process API
 * and Effect.
 *
 * `Hook.runMain(hookDefinition)` is the primary entry point for scripts
 * that handle a single event. `Hook.dispatch(map)` is for scripts that
 * handle multiple events from one entry file — it reads stdin once,
 * peeks `hook_event_name`, and routes to the matching handler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { runMain as platformRunMain } from "@effect/platform-node-shared/NodeRuntime";
import * as NodeStdio from "@effect/platform-node-shared/NodeStdio";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

import {
  HookControlledExit,
  HookHandlerError,
  HookInputDecodeError,
  HookOutputEncodeError,
  HookStdinReadError,
  HookStdoutWriteError,
} from "../Errors.ts";
import * as HookContext from "./Context.ts";
import { HookEnvelope } from "./Envelope.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Runner");

// ---------------------------------------------------------------------------
// HookDefinition
// ---------------------------------------------------------------------------

/**
 * Raw stdout, stderr, and exit-code control for hooks whose protocol is not
 * represented by a JSON output schema.
 *
 * **Example** (Inspect a blocking process output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.processOutput({ stderr: "Task is not ready", exitCode: 2 })
 * console.log(output.exitCode) // 2
 * console.log(O.isSome(output.stderr)) // true
 * ```
 *
 * @see {@link processOutput} to construct this response from optional stdio and an exit code.
 * @category models
 * @since 0.0.0
 */
export class HookProcessOutput extends S.TaggedClass<HookProcessOutput>($I`HookProcessOutput`)(
  "HookProcessOutput",
  {
    stdout: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    stderr: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    exitCode: S.Finite,
  },
  $I.annote("HookProcessOutput", {
    description: "Raw stdio and exit-code response requested by a hook handler.",
  })
) {}

/**
 * Build a raw stdio and exit-code response the runner writes instead of JSON.
 *
 * **Details**
 *
 * Missing `exitCode` defaults to `0`. Omitted streams become `Option.none`.
 *
 * **Example** (Construct process output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.processOutput({ stdout: "ok\n" })
 * console.log(output.exitCode) // 0
 * console.log(O.isSome(output.stdout)) // true
 * console.log(O.isNone(output.stderr)) // true
 * ```
 *
 * @see {@link stderrExit} to write an error message and exit non-zero.
 * @see {@link rawStdout} to write a success string to stdout.
 * @category constructors
 * @since 0.0.0
 */
export const processOutput = (options: {
  readonly exitCode?: number;
  readonly stdout?: string;
  readonly stderr?: string;
}): HookProcessOutput =>
  HookProcessOutput.make({
    exitCode: options.exitCode ?? 0,
    stdout: O.fromNullishOr(options.stdout),
    stderr: O.fromNullishOr(options.stderr),
  });

/**
 * Build a process-output response that writes a message to stderr and exits
 * with a non-zero code (default 2).
 *
 * **Example** (Write an error and exit)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.stderrExit("blocked", 2)
 * console.log(output.exitCode) // 2
 * console.log(O.getOrUndefined(output.stderr)) // "blocked"
 * ```
 *
 * @see {@link processOutput} for the general stdio constructor this wraps.
 * @see {@link rawStdout} to write a success string to stdout instead.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const stderrExit = (stderr: string, exitCode = 2): HookProcessOutput => processOutput({ stderr, exitCode });

/**
 * Build a process-output response that writes a raw string to stdout and
 * exits 0.
 *
 * **Example** (Write raw stdout)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.rawStdout("/tmp/wt\n")
 * console.log(output.exitCode) // 0
 * console.log(O.getOrUndefined(output.stdout)) // "/tmp/wt\n"
 * ```
 *
 * @see {@link processOutput} for the general stdio constructor this wraps.
 * @see {@link stderrExit} to write an error message and exit non-zero.
 * @category constructors
 * @since 0.0.0
 */
export const rawStdout = (stdout: string): HookProcessOutput => processOutput({ stdout });

const isHookProcessOutput = S.is(HookProcessOutput);

type HookInputEnvelope = Pick<HookEnvelope, "session_id" | "transcript_path" | "cwd" | "hook_event_name">;

/**
 * Runnable contract returned by each event `define()`: the event name,
 * stdin/stdout codecs, and the handler Effect, which may succeed with
 * either the event's structured output or a {@link HookProcessOutput}
 * stdio payload.
 *
 * **Example** (Describe a session-start hook)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type SessionStartHook = Hook.HookDefinition<
 *   Hook.SessionStart.Input,
 *   Hook.SessionStart.Output,
 *   never,
 *   never
 * >
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface HookDefinition<In extends HookInputEnvelope, Out, E, R> {
  readonly event: string;
  readonly inputSchema: S.Codec<In, unknown>;
  readonly outputSchema: S.Codec<Out, unknown>;
  handler(input: In): Effect.Effect<Out | HookProcessOutput, E, R>;
}

/**
 * Dispatch map for `Hook.dispatch` — keys are hook event names and values
 * are complete `HookDefinition`s for that event.
 *
 * The error and service parameters capture the union shared by entries
 * while each event factory preserves its own narrow input and output.
 *
 * **Example** (Describe a dispatch map)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Hooks = Hook.DispatchMap<never, Hook.Context.Service>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DispatchMap<E, R> = Readonly<Record<string, HookDefinition<HookInputEnvelope, unknown, E, R>>>;

/**
 * The union of every error the runner can produce internally.
 *
 * @internal
 */
type RunnerError =
  | HookStdinReadError
  | HookInputDecodeError
  | HookHandlerError
  | HookOutputEncodeError
  | HookStdoutWriteError
  | HookControlledExit;

type HandlerRequirements<R> = Exclude<R, HookContext.Service>;

// ---------------------------------------------------------------------------
// Internal: stdin/stdout
// ---------------------------------------------------------------------------

/**
 * Read all bytes from stdin and decode as UTF-8.
 *
 * @internal
 */
const readStdin: Effect.Effect<string, HookStdinReadError, Stdio.Stdio> = Effect.gen(function* () {
  yield* Effect.logDebug("reading hook stdin");
  const stdio = yield* Stdio.Stdio;
  const chunks = yield* Stream.decodeText(stdio.stdin).pipe(
    Stream.runCollect,
    Effect.mapError((cause) => HookStdinReadError.make({ cause }))
  );
  const raw = A.join(A.fromIterable(chunks), "");
  yield* Effect.logDebug("read hook stdin").pipe(Effect.annotateLogs({ byteLength: raw.length }));
  return raw;
}).pipe(Effect.withLogSpan("Hook.readStdin"));

/**
 * Write a single JSON line to stdout.
 *
 * @internal
 */
const writeStdout = (json: string): Effect.Effect<void, HookStdoutWriteError, Stdio.Stdio> =>
  Effect.gen(function* () {
    yield* Effect.logDebug("writing hook stdout").pipe(Effect.annotateLogs({ byteLength: json.length }));
    const stdio = yield* Stdio.Stdio;
    yield* Stream.run(Stream.make(Str.concat(json, "\n")), stdio.stdout()).pipe(
      Effect.mapError((cause) => HookStdoutWriteError.make({ cause }))
    );
  }).pipe(Effect.withLogSpan("Hook.writeStdout"));

const writeRawStdout = (text: string): Effect.Effect<void, HookStdoutWriteError, Stdio.Stdio> =>
  Effect.gen(function* () {
    yield* Effect.logDebug("writing raw hook stdout").pipe(Effect.annotateLogs({ byteLength: text.length }));
    const stdio = yield* Stdio.Stdio;
    yield* Stream.run(Stream.make(text), stdio.stdout()).pipe(
      Effect.mapError((cause) => HookStdoutWriteError.make({ cause }))
    );
  }).pipe(Effect.withLogSpan("Hook.writeRawStdout"));

const writeStderr = (text: string): Effect.Effect<void, HookStdoutWriteError, Stdio.Stdio> =>
  Effect.gen(function* () {
    yield* Effect.logDebug("writing hook stderr").pipe(Effect.annotateLogs({ byteLength: text.length }));
    const stdio = yield* Stdio.Stdio;
    yield* Stream.run(Stream.make(text), stdio.stderr()).pipe(
      Effect.mapError((cause) => HookStdoutWriteError.make({ cause }))
    );
  }).pipe(Effect.withLogSpan("Hook.writeStderr"));

// ---------------------------------------------------------------------------
// Per-hook execution
// ---------------------------------------------------------------------------

/**
 * Run a single hook against a pre-parsed JSON value (already JSON.parsed
 * into an `unknown`). Used by both `runHookProgram` and `dispatch` — the
 * former reads stdin first, the latter peeks the event name before
 * choosing which hook to apply.
 *
 * @internal
 */
const runHookFromParsed = Effect.fn("Hook.runHookFromParsed")(function* <In extends HookInputEnvelope, Out, E, R>(
  hook: HookDefinition<In, Out, E, R>,
  parsed: unknown
): Effect.fn.Return<void, RunnerError, Stdio.Stdio | HandlerRequirements<R>> {
  yield* Effect.logDebug("decoding hook input").pipe(Effect.annotateLogs({ expectedEvent: hook.event }));
  const envelope = yield* S.decodeUnknownEffect(HookEnvelope)(parsed).pipe(
    Effect.mapError((cause) =>
      HookInputDecodeError.make({
        cause,
        phase: "schema",
      })
    )
  );
  const input = yield* S.decodeUnknownEffect(hook.inputSchema)(parsed).pipe(
    Effect.mapError((cause) => HookInputDecodeError.make({ cause, phase: "schema" }))
  );
  yield* Effect.annotateCurrentSpan("hook.event", input.hook_event_name);
  yield* Effect.logDebug("running hook handler").pipe(Effect.annotateLogs({ hookEventName: input.hook_event_name }));
  const output = yield* hook.handler(input).pipe(
    Effect.provideService(HookContext.Service, HookContext.fromEnvelope(envelope)),
    Effect.mapError((cause) => HookHandlerError.make({ cause }))
  );
  if (isHookProcessOutput(output)) {
    yield* O.match(output.stdout, {
      onNone: () => Effect.void,
      onSome: writeRawStdout,
    });
    yield* O.match(output.stderr, {
      onNone: () => Effect.void,
      onSome: writeStderr,
    });
    if (output.exitCode !== 0) {
      return yield* HookControlledExit.make({ code: output.exitCode });
    }
    return;
  }
  yield* Effect.logDebug("encoding hook output").pipe(Effect.annotateLogs({ hookEventName: input.hook_event_name }));
  const encoded = yield* S.encodeUnknownEffect(S.fromJsonString(hook.outputSchema))(output).pipe(
    Effect.mapError((cause) => HookOutputEncodeError.make({ cause }))
  );
  yield* writeStdout(encoded);
});

// ---------------------------------------------------------------------------
// Runner programs
// ---------------------------------------------------------------------------

/**
 * Build the Effect program that executes one hook invocation end-to-end.
 *
 * Pure Effect form of the runner, exposed primarily for testing.
 * Production code should use `runMain`.
 *
 * **Example** (Construct a single-hook program)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const hook = Hook.PreToolUse.define({
 *   handler: () => Effect.succeed(Hook.PreToolUse.allow())
 * })
 * const program = Hook.runHookProgram(hook)
 * console.log(hook.event) // "PreToolUse"
 * console.log(typeof program) // "object"
 * ```
 *
 * @effects Requires `Stdio.Stdio`, reads stdin, invokes the handler, and writes its encoded response to stdout.
 * @see {@link runMain} for the process-main wrapper that reads stdin and exits.
 * @see {@link hookTeardown} for how runner errors map to process exit codes.
 * @category workflows
 * @since 0.0.0
 */
export const runHookProgram = Effect.fn("Hook.runHookProgram")(function* <In extends HookInputEnvelope, Out, E, R>(
  hook: HookDefinition<In, Out, E, R>
): Effect.fn.Return<void, RunnerError, Stdio.Stdio | HandlerRequirements<R>> {
  yield* Effect.logDebug("starting single hook runner").pipe(Effect.annotateLogs({ hookEventName: hook.event }));
  const raw = yield* readStdin;
  const parsed = yield* Unknown.decodeEffectFromJsonString(raw).pipe(
    Effect.mapError((cause) => HookInputDecodeError.make({ cause, phase: "json" }))
  );
  yield* runHookFromParsed(hook, parsed);
});

/**
 * Build the Effect program that reads stdin, peeks `hook_event_name`,
 * and dispatches to the matching handler in the map. If no handler is
 * registered for the event, the program succeeds with no output.
 *
 * **Example** (Construct a dispatch program)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const hooks = {
 *   PreToolUse: Hook.PreToolUse.define({
 *     handler: () => Effect.succeed(Hook.PreToolUse.allow())
 *   })
 * }
 * const program = Hook.runDispatchProgram(hooks)
 * console.log(Object.keys(hooks)) // ["PreToolUse"]
 * console.log(typeof program) // "object"
 * ```
 *
 * @effects Requires `Stdio.Stdio`, reads stdin, dispatches the selected handler, and writes its encoded response.
 * @see {@link dispatch} for the process-main wrapper that reads stdin and exits.
 * @see {@link hookTeardown} for how runner errors map to process exit codes.
 * @category workflows
 * @since 0.0.0
 */
export const runDispatchProgram = Effect.fn("Hook.runDispatchProgram")(function* <E, R>(
  hooks: DispatchMap<E, R>
): Effect.fn.Return<void, RunnerError, Stdio.Stdio | HandlerRequirements<R>> {
  yield* Effect.logDebug("starting hook dispatch runner").pipe(
    Effect.annotateLogs({ registeredHandlers: R.keys(hooks).length })
  );
  const raw = yield* readStdin;
  const parsed = yield* Unknown.decodeEffectFromJsonString(raw).pipe(
    Effect.mapError((cause) => HookInputDecodeError.make({ cause, phase: "json" }))
  );
  const envelope = yield* S.decodeUnknownEffect(HookEnvelope)(parsed).pipe(
    Effect.mapError((cause) =>
      HookInputDecodeError.make({
        cause,
        phase: "schema",
      })
    )
  );
  yield* Effect.annotateCurrentSpan("hook.event", envelope.hook_event_name);
  const hook = hooks[envelope.hook_event_name];
  if (hook === undefined) {
    yield* Effect.logDebug("no registered hook handler for event").pipe(
      Effect.annotateLogs({ hookEventName: envelope.hook_event_name })
    );
    return;
  }
  yield* runHookFromParsed(hook, parsed);
});

// ---------------------------------------------------------------------------
// Teardown: Effect Exit → OS exit code
// ---------------------------------------------------------------------------

/**
 * Custom teardown that maps the runner's typed errors to Claude Code's
 * hook exit-code convention:
 *
 * - `0` success
 * - handler-authored `HookProcessOutput` exits use their requested code
 * - `2` for `HookInputDecodeError` (Claude Code interprets exit 2 per
 *   event: blocking/denying for gate events such as PreToolUse,
 *   PermissionRequest, and ConfigChange; feedback-only or ignored for
 *   several observability events)
 * - `1` non-blocking runner error (stdin read, handler crash, encode, write)
 * - `130` fiber interruption (SIGINT-style)
 *
 * **Example** (Map a successful exit)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Exit from "effect/Exit"
 *
 * Hook.hookTeardown(Exit.succeed(undefined), (code) => console.log(code)) // 0
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const hookTeardown: Runtime.Teardown = <E, A>(exit: Exit.Exit<E, A>, onExit: (code: number) => void) => {
  if (Exit.isSuccess(exit)) return onExit(0);
  if (Cause.hasInterruptsOnly(exit.cause)) return onExit(130);
  const squashed = Cause.squash(exit.cause);
  if (S.is(HookControlledExit)(squashed)) return onExit(squashed.code);
  if (S.is(HookInputDecodeError)(squashed)) return onExit(2);
  return onExit(1);
};

// ---------------------------------------------------------------------------
// Public runMain / dispatch
// ---------------------------------------------------------------------------

/**
 * Run a single-event hook definition as the main program of the current
 * process.
 *
 * **Example** (Define a single-event hook process)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PreToolUse.define({
 *   handler: () => Effect.succeed(Hook.PreToolUse.allow())
 * })
 *
 * console.log(hook.event) // "PreToolUse"
 * ```
 *
 * @effects Reads process stdin, writes the hook response to stdout, and exits according to {@link hookTeardown}.
 * @see {@link runHookProgram} for the testable Effect form that does not take over the process.
 * @see {@link hookTeardown} for how runner errors map to process exit codes.
 * @category workflows
 * @since 0.0.0
 */
export const runMain = <In extends HookInputEnvelope, Out, E>(
  hook: HookDefinition<In, Out, E, HookContext.Service>
): void =>
  platformRunMain(
    runHookProgram(hook).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      Effect.provide(NodeStdio.layer)
    ),
    { teardown: hookTeardown }
  );

/**
 * Run a multi-event dispatch script as the main program of the current
 * process. The map's keys are hook event names and values are
 * `HookDefinition`s produced by each event's `define()` factory.
 *
 * **Gotchas**
 *
 * An unregistered `hook_event_name` succeeds with no stdout and exit 0, which
 * Claude Code treats as passthrough.
 *
 * **Example** (Dispatch multiple hook events)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hooks = {
 *   PreToolUse: Hook.PreToolUse.define({
 *     handler: () => Effect.succeed(Hook.PreToolUse.allow())
 *   }),
 *   PostToolUse: Hook.PostToolUse.define({
 *     handler: () => Effect.succeed(Hook.PostToolUse.passthrough())
 *   })
 * }
 * console.log(Object.keys(hooks)) // ["PreToolUse", "PostToolUse"]
 * ```
 *
 * @effects Reads process stdin, dispatches one handler, writes stdout, and exits according to {@link hookTeardown}.
 * @see {@link runDispatchProgram} for the testable Effect form that does not take over the process.
 * @see {@link hookTeardown} for how runner errors map to process exit codes.
 * @category workflows
 * @since 0.0.0
 */
export const dispatch = <E>(hooks: DispatchMap<E, HookContext.Service>): void =>
  platformRunMain(
    runDispatchProgram<E, HookContext.Service>(hooks).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      Effect.provide(NodeStdio.layer)
    ),
    { teardown: hookTeardown }
  );

/**
 * Decoded and wire-encoded companion types for {@link HookProcessOutput}.
 *
 * **Example** (Inspect the companion output type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const output = Hook.processOutput({ stderr: "Task is not ready", exitCode: 2 })
 * console.log(output.exitCode) // 2
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookProcessOutput {
  /**
   * Decoded runtime representation of {@link HookProcessOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookProcessOutput;
  /**
   * Wire-encoded representation of {@link HookProcessOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookProcessOutput.Encoded;
}
