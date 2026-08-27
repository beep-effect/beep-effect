/**
 * Effect service carrying per-invocation hook context.
 *
 * **Details**
 *
 * Every hook handler has access to `HookContext.Service` via `yield*`
 * (or the individual accessor effects). The service is constructed by
 * the runner from the decoded envelope of the incoming stdin payload,
 * so handlers never touch the raw JSON.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Context, Effect, Layer } from "effect";
import type * as O from "effect/Option";
import type { HookEnvelope } from "./Envelope.ts";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Context");

/**
 * Camel-case view of the envelope available to every hook handler.
 *
 * @see {@link fromEnvelope} to construct this view from a decoded envelope.
 * @see {@link layer} to provide it as {@link Service}.
 * @category services
 * @since 0.0.0
 */
export interface Interface {
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly cwd: string;
  readonly permissionMode: HookEnvelope["permission_mode"];
  readonly promptId: O.Option<string>;
  readonly hookEventName: string;
  readonly effort: HookEnvelope["effort"];
  readonly agentId: O.Option<string>;
  readonly agentType: O.Option<string>;
}

/**
 * Per-invocation hook context service.
 *
 * **Example** (Read session id from the provided service)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.service(Hook.Context.Service).pipe(
 *   Effect.map((context) => context.sessionId),
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then((id) => console.log(id)) // "test-session"
 * ```
 *
 * @see {@link layer} for the layer that must be provided.
 * @see {@link fromEnvelope} to build the service payload from a decoded envelope.
 * @category services
 * @since 0.0.0
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

/**
 * Build hook context from a decoded envelope.
 *
 * **Example** (Convert an envelope)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * const context = Hook.Context.fromEnvelope(Testing.makeMockEnvelope())
 * console.log(context.sessionId) // "test-session"
 * ```
 *
 * @see {@link layer} to provide the resulting view as {@link Service}.
 * @category constructors
 * @since 0.0.0
 */
export const fromEnvelope = (envelope: HookEnvelope): Interface => ({
  sessionId: envelope.session_id,
  transcriptPath: envelope.transcript_path,
  cwd: envelope.cwd,
  permissionMode: envelope.permission_mode,
  promptId: envelope.prompt_id,
  hookEventName: envelope.hook_event_name,
  effort: envelope.effort,
  agentId: envelope.agent_id,
  agentType: envelope.agent_type,
});

/**
 * Provide one decoded envelope as the current hook context.
 *
 * **Example** (Provide a mock envelope and read session id)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.sessionId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then((id) => console.log(id)) // "test-session"
 * ```
 *
 * @see {@link fromEnvelope} for the constructor this layer wraps.
 * @see {@link sessionId} for one accessor that requires this layer.
 * @category layers
 * @since 0.0.0
 */
export const layer = (envelope: HookEnvelope): Layer.Layer<Service> =>
  Layer.succeed(Service, Service.of(fromEnvelope(envelope)));

// ---------------------------------------------------------------------------
// Convenience accessors (yield*-able inside handlers)
// ---------------------------------------------------------------------------

/**
 * Identifier that correlates this invocation with other hook events in the
 * same Claude Code session.
 *
 * **Example** (Read the session ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.sessionId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log) // "test-session"
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const sessionId: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.sessionId)
);

/**
 * Filesystem path of this session's JSONL conversation transcript.
 *
 * **Example** (Read the transcript path)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.transcriptPath.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link readTranscript} to parse the JSONL file at this path.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const transcriptPath: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.transcriptPath)
);

/**
 * Working directory of the Claude Code process when this hook fired.
 *
 * **Example** (Read the working directory)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.cwd.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const cwd: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.cwd)
);

/**
 * Claude Code permission mode on this invocation, or `Option.none` when the
 * envelope omitted it.
 *
 * **Example** (Read the permission mode)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.permissionMode.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const permissionMode: Effect.Effect<HookEnvelope["permission_mode"], never, Service> = Effect.service(
  Service
).pipe(Effect.map((context) => context.permissionMode));

/**
 * Prompt identifier for this invocation, or `Option.none` when the envelope
 * omitted it.
 *
 * **Example** (Read the prompt ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.promptId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const promptId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.promptId)
);

/**
 * Name of the hook event being handled, such as `PreToolUse`.
 *
 * **Example** (Read the event name)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.hookEventName.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const hookEventName: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.hookEventName)
);

/**
 * Effort metadata for this invocation, or `Option.none` when the envelope
 * omitted it.
 *
 * **Example** (Read the effort level)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.effort.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const effort: Effect.Effect<HookEnvelope["effort"], never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.effort)
);

/**
 * Subagent or session agent identifier, or `Option.none` when the envelope
 * omitted it.
 *
 * **Example** (Read the agent ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.agentId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const agentId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentId)
);

/**
 * Subagent or session agent type, or `Option.none` when the envelope omitted
 * it.
 *
 * **Example** (Read the agent type)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.agentType.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link fromEnvelope} to construct the service payload from a decoded envelope.
 * @category getters
 * @since 0.0.0
 */
export const agentType: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentType)
);
